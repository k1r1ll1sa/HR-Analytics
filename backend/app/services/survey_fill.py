import uuid
from datetime import datetime, timezone
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.company import Employee, EmployeeDepartment
from app.models.survey import (
    Survey, SurveyQuestion, SurveySession,
    SurveyAssignment, SurveyAnswer, SessionStatus, QuestionType)


class SurveyFillService: # Просмотр назначение респондента
    @staticmethod
    async def get_respondent_employee(db: AsyncSession, company_id: uuid.UUID, user: User) -> Employee:
        # Employee.id текущего пользователя в указанной компании
        stmt = select(Employee).where(Employee.user_id == user.id,
                                      Employee.company_id == company_id,
                                      Employee.is_active == True)
        emp = (await db.execute(stmt)).scalar_one_or_none()
        if not emp:
            raise ValueError("Вы не являетесь сотрудником этой компании")
        return emp

    @staticmethod
    async def list_my_assignments(db: AsyncSession, company_id: uuid.UUID, user: User) -> list:
        # Назначения, где пользователь — респондент
        emp = await SurveyFillService.get_respondent_employee(db, company_id, user)

        stmt = (
            select(SurveyAssignment)
            .options(
                selectinload(SurveyAssignment.session)
                .selectinload(SurveySession.survey)
            )
            .join(SurveySession, SurveyAssignment.session_id == SurveySession.id)
            .join(Survey, SurveySession.survey_id == Survey.id)
            .where(
                SurveyAssignment.respondent_id == emp.id,
                SurveySession.company_id == company_id
            )
            .order_by(SurveySession.created_at.desc())
        )
        result = await db.execute(stmt)
        assignments = result.scalars().all()

        items = []
        for a in assignments:
            session = a.session
            survey = session.survey
            items.append({
                "id": a.id,
                "session_id": a.session_id,
                "survey_id": survey.id,
                "target_id": a.target_id,
                "status": a.status,
                "session_title": session.title,
                "session_status": session.status,
                "survey_title": survey.title,
                "completed_at": a.completed_at,
            })
        return items

    @staticmethod
    async def _get_assignment_for_respondent(db: AsyncSession, assignment_id: uuid.UUID, user: User) -> SurveyAssignment:
        # Проверка принадлежности назначения пользователю
        stmt = (
            select(SurveyAssignment)
            .options(
                selectinload(SurveyAssignment.session).selectinload(SurveySession.survey)
            )
            .where(SurveyAssignment.id == assignment_id)
        )
        assignment = (await db.execute(stmt)).scalar_one_or_none()
        if not assignment:
            raise ValueError("Назначение не найдено")

        respondent_stmt = select(Employee).where(
            Employee.id == assignment.respondent_id,
            Employee.user_id == user.id)

        respondent = (await db.execute(respondent_stmt)).scalar_one_or_none()
        if not respondent:
            raise PermissionError("Это назначение не принадлежит вам")

        return assignment

    @staticmethod
    async def get_questions_for_assignment(db: AsyncSession, assignment_id: uuid.UUID, user: User) -> dict:
        # Опрос, вопросы, сохранённые ответы
        assignment = await SurveyFillService._get_assignment_for_respondent(db, assignment_id, user)
        session = assignment.session
        survey = session.survey

        # Проверка статуса сессии
        if session.status != SessionStatus.active:
            raise ValueError(f"Сессия не активна (статус: {session.status.value})")

        # Проверка дат
        now = datetime.utcnow()

        if session.start_date and now < session.start_date:
            raise ValueError("Опрос ещё не начался")
        if session.end_date and now > session.end_date:
            raise ValueError("Срок прохождения опроса истёк")

        # Вопросы
        q_stmt = (
            select(SurveyQuestion)
            .where(SurveyQuestion.survey_id == survey.id)
            .order_by(SurveyQuestion.order_index.asc().nulls_last())
        )
        questions = (await db.execute(q_stmt)).scalars().all()

        # Уже данные ответы по назначению
        a_stmt = select(SurveyAnswer).where(SurveyAnswer.assignment_id == assignment.id)
        answers = (await db.execute(a_stmt)).scalars().all()
        answers_map = {a.question_id: a for a in answers}

        result_questions = []
        for q in questions:
            existing = answers_map.get(q.id)
            result_questions.append({
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "order_index": q.order_index,
                "is_required": q.is_required,
                "options_json": q.options_json,
                "existing_answer": {
                    "id": existing.id,
                    "numeric_value": existing.numeric_value,
                    "text_value": existing.text_value,
                    "boolean_value": existing.boolean_value,
                } if existing else None,
            })

        return {
            "assignment_id": assignment.id,
            "survey_id": survey.id,
            "survey_title": survey.title,
            "survey_description": survey.description,
            "session_title": session.title,
            "target_id": assignment.target_id,
            "status": assignment.status,
            "questions": result_questions,
        }

    @staticmethod
    async def submit_answer(db: AsyncSession, assignment_id: uuid.UUID, user: User,
                            question_id: uuid.UUID, numeric_value: float | None,
                            text_value: str | None, boolean_value: bool | None,) -> SurveyAnswer:
        # Сохранение или обновление ответа на вопрос
        assignment = await SurveyFillService._get_assignment_for_respondent(db, assignment_id, user)

        common_depts_stmt = (
            select(EmployeeDepartment.department_id)
            .where(EmployeeDepartment.employee_id == assignment.respondent_id)
            .intersect(
                select(EmployeeDepartment.department_id)
                .where(EmployeeDepartment.employee_id == assignment.target_id)
            )
        )
        common_depts = (await db.execute(common_depts_stmt)).scalars().all()
        if not common_depts:
            raise ValueError(
                "Респондент и оцениваемый больше не находятся в одном отделе."
                "Ответить на опрос невозможно.")

        session = assignment.session
        survey = session.survey

        if session.status != SessionStatus.active:
            raise ValueError("Отвечать можно только в активной сессии")

        if assignment.status == "completed":
            raise ValueError("Опрос уже завершён, ответы больше нельзя менять")

        q_stmt = select(SurveyQuestion).where(
            SurveyQuestion.id == question_id,
            SurveyQuestion.survey_id == survey.id)

        question = (await db.execute(q_stmt)).scalar_one_or_none()
        if not question:
            raise ValueError("Вопрос не принадлежит этому опросу")

        # Валидация по типу вопроса
        SurveyFillService._validate_answer_by_type(question, numeric_value, text_value, boolean_value)

        a_stmt = select(SurveyAnswer).where(
            and_(SurveyAnswer.assignment_id == assignment.id,
                 SurveyAnswer.question_id == question_id))

        existing = (await db.execute(a_stmt)).scalar_one_or_none()

        if existing:
            # Обновление
            existing.numeric_value = numeric_value
            existing.text_value = text_value
            existing.boolean_value = boolean_value
            answer = existing
        else:
            # Создание нового
            answer = SurveyAnswer(
                assignment_id=assignment.id,
                question_id=question_id,
                numeric_value=numeric_value,
                text_value=text_value,
                boolean_value=boolean_value)
            db.add(answer)

        await db.commit()
        await db.refresh(answer)
        return answer

    @staticmethod
    def _validate_answer_by_type(question, numeric_value, text_value, boolean_value):
        # Проверка соответствия типов вопроса
        q_type = question.question_type

        if q_type == QuestionType.slider:
            if numeric_value is None:
                raise ValueError("Для типа 'slider' требуется numeric_value")
            if not (0 <= numeric_value <= 100):
                raise ValueError("Значение slider должно быть в диапазоне 0–100")

        elif q_type == QuestionType.radio:
            if numeric_value is None:
                raise ValueError("Для типа 'radio' требуется numeric_value (индекс варианта)")
            if question.options_json and not (0 <= int(numeric_value) < len(question.options_json)):
                raise ValueError("Индекс варианта вне диапазона")

        elif q_type == QuestionType.text:
            if not text_value or not text_value.strip():
                raise ValueError("Для типа 'text' требуется непустой text_value")

        elif q_type == QuestionType.checkbox:
            if boolean_value is None:
                raise ValueError("Для типа 'checkbox' требуется boolean_value")

    @staticmethod
    async def complete_assignment(db: AsyncSession, assignment_id: uuid.UUID, user: User) -> dict:
        # Завершение опроса
        assignment = await SurveyFillService._get_assignment_for_respondent(db, assignment_id, user)

        session = assignment.session

        if session.status != SessionStatus.active:
            raise ValueError("Сессия не активна")

        if assignment.status == "completed":
            raise ValueError("Опрос уже завершён")

        # Обязательные вопросы
        req_stmt = select(SurveyQuestion.id).where(
            SurveyQuestion.survey_id == session.survey_id,
            SurveyQuestion.is_required == True)
        required_ids = set((await db.execute(req_stmt)).scalars().all())

        # Отвеченные вопросы
        ans_stmt = select(SurveyAnswer.question_id).where(
            SurveyAnswer.assignment_id == assignment.id)
        answered_ids = set((await db.execute(ans_stmt)).scalars().all())

        missing = required_ids - answered_ids
        if missing:
            raise ValueError(f"Нет ответов на обязательные вопросы. Пропущено: {len(missing)} шт.")

        assignment.status = "completed"
        assignment.completed_at = datetime.utcnow()
        await db.commit()

        return {
            "message": "Опрос успешно завершён",
            "assignment_id": assignment.id,
            "status": assignment.status,
            "completed_at": assignment.completed_at,
            "answered_count": len(answered_ids),
            "total_required_count": len(required_ids),
        }