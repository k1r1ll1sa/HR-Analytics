import uuid
from datetime import datetime
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.survey import Survey, SurveyQuestion, SurveySession, SurveyAssignment, SurveyAnswer
from app.models.company import Employee, EmployeeDepartment


class SurveyService:
    @staticmethod
    async def create_survey(db: AsyncSession, company_id: uuid.UUID, created_by: uuid.UUID, title: str, description: str | None,
                            category: str | None, questions: list):
        survey = Survey(company_id=company_id,
                        title=title,
                        description=description,
                        category=category,
                        is_active=True,
                        created_by=created_by)
        db.add(survey)
        await db.flush()

        for idx, q_data in enumerate(questions):
            question = SurveyQuestion(survey_id=survey.id,
                                      question_text=q_data['question_text'],
                                      question_type=q_data.get('question_type', 'slider'),
                                      order_index=q_data.get('order_index', idx),
                                      is_required=q_data.get('is_required', True),
                                      options_json=q_data.get('options_json'))
            db.add(question)

        await db.commit()
        await db.refresh(survey)

        await db.execute(select(Survey).options(selectinload(Survey.questions)).where(Survey.id == survey.id))

        return survey

    @staticmethod
    async def get_survey(db: AsyncSession, survey_id: uuid.UUID, company_id: uuid.UUID):
        result = await db.execute(select(Survey).options(selectinload(Survey.questions))
                                  .where(Survey.id == survey_id, Survey.company_id == company_id))
        survey = result.scalar_one_or_none()
        return survey

    @staticmethod
    async def update_survey(db: AsyncSession, survey_id: uuid.UUID, company_id: uuid.UUID, update_data: dict):
        result = await db.execute(select(Survey).where(Survey.id == survey_id, Survey.company_id == company_id))

        survey = result.scalar_one_or_none()
        if not survey:
            raise ValueError("Опрос не найден или не принадлежит этой компании")

        for field, value in update_data.items():
            if value is not None:
                setattr(survey, field, value)

        await db.commit()
        await db.refresh(survey)
        return survey

    @staticmethod
    async def delete_survey(db: AsyncSession, survey_id: uuid.UUID, company_id: uuid.UUID):
        result = await db.execute(select(Survey).where(Survey.id == survey_id, Survey.company_id == company_id))

        survey = result.scalar_one_or_none()
        if not survey:
            raise ValueError("Опрос не найден")

        await db.delete(survey)
        await db.commit()
        return True

    @staticmethod
    async def create_session(db: AsyncSession, survey_id: uuid.UUID, company_id: uuid.UUID, created_by: uuid.UUID,
                             title: str, start_date: datetime | None, end_date: datetime | None, status: str):
        survey = await db.get(Survey, survey_id)
        if not survey or survey.company_id != company_id:
            raise ValueError("Опрос не найден или не принадлежит этой компании")

        if start_date and start_date.tzinfo is not None:
            start_date = start_date.replace(tzinfo=None)

        if end_date and end_date.tzinfo is not None:
            end_date = end_date.replace(tzinfo=None)

        session = SurveySession(survey_id=survey_id,
                                company_id=company_id,
                                title=title,
                                start_date=start_date,
                                end_date=end_date,
                                status=status,
                                created_by=created_by)
        db.add(session)
        await db.commit()
        await db.refresh(session)
        return session

    @staticmethod
    async def create_assignment(
            db: AsyncSession,
            session_id: uuid.UUID,
            respondent_id: uuid.UUID,
            target_id: uuid.UUID
    ):
        # 1. Проверяем, что оба сотрудника существуют и активны
        respondent = (await db.execute(
            select(Employee).where(Employee.id == respondent_id, Employee.is_active == True)
        )).scalar_one_or_none()

        target = (await db.execute(
            select(Employee).where(Employee.id == target_id, Employee.is_active == True)
        )).scalar_one_or_none()

        if not respondent or not target:
            raise ValueError("Сотрудник не найден или неактивен")

        # 2. Проверяем, что они из одной компании
        if respondent.company_id != target.company_id:
            raise ValueError("Сотрудники должны быть из одной компании")

        # 3. НОВАЯ ПРОВЕРКА: у них должен быть хотя бы один общий отдел
        respondent_depts_stmt = select(EmployeeDepartment.department_id).where(
            EmployeeDepartment.employee_id == respondent_id
        )
        target_depts_stmt = select(EmployeeDepartment.department_id).where(
            EmployeeDepartment.employee_id == target_id
        )

        # Запрос на пересечение множеств отделов
        common_depts_stmt = (
            select(EmployeeDepartment.department_id)
            .where(EmployeeDepartment.employee_id == respondent_id)
            .intersect(
                select(EmployeeDepartment.department_id)
                .where(EmployeeDepartment.employee_id == target_id)
            )
        )
        common_depts = (await db.execute(common_depts_stmt)).scalars().all()

        if not common_depts:
            raise ValueError(
                "Респондент и оцениваемый не имеют общих отделов. "
                "Оценка возможна только в рамках одного отдела."
            )

        # 4. Проверка, что сессия существует и активна (опционально, но полезно)
        session = await db.get(SurveySession, session_id)
        if not session:
            raise ValueError("Сессия опроса не найдена")

        # 5. Создаём назначение
        assignment = SurveyAssignment(
            session_id=session_id,
            respondent_id=respondent_id,
            target_id=target_id,
            status="pending"
        )
        db.add(assignment)
        await db.commit()
        await db.refresh(assignment)
        return assignment

    @staticmethod
    async def submit_answer(db: AsyncSession, assignment_id: uuid.UUID, question_id: uuid.UUID, numeric_value: float | None = None,
                            text_value: str | None = None, boolean_value: bool | None = None):
        assignment = await db.get(SurveyAssignment, assignment_id)
        if not assignment or assignment.status != "active":
            raise ValueError("Назначение не найдено или не активно")

        # Проверяем вопрос
        question = await db.get(SurveyQuestion, question_id)
        if not question:
            raise ValueError("Вопрос не найден")

        # Проверяем, нет ли уже ответа
        existing = await db.execute(
            select(SurveyAnswer).where(
                SurveyAnswer.assignment_id == assignment_id,
                SurveyAnswer.question_id == question_id
            )
        )

        if existing.scalar_one_or_none():
            raise ValueError("Ответ на этот вопрос уже предоставлен")

        answer = SurveyAnswer(
            assignment_id=assignment_id,
            question_id=question_id,
            numeric_value=numeric_value,
            text_value=text_value,
            boolean_value=boolean_value
        )
        db.add(answer)
        await db.commit()
        return answer

    @staticmethod
    async def bulk_create_assignments(
            db: AsyncSession,
            session_id: uuid.UUID,
            department_ids: list[uuid.UUID],
            exclude_employee_ids: list[uuid.UUID] | None = None
    ) -> dict:
        """
        Автоматически создаёт все назначения для выбранных отделов.
        Каждый сотрудник оценивает каждого коллегу из тех же отделов (кроме себя).
        """
        exclude_ids = exclude_employee_ids or []

        # 1. Получаем всех активных сотрудников из выбранных отделов
        emp_stmt = (
            select(Employee)
            .join(EmployeeDepartment, Employee.id == EmployeeDepartment.employee_id)
            .where(
                EmployeeDepartment.department_id.in_(department_ids),
                Employee.is_active == True,
                Employee.id.notin_(exclude_ids)
            )
            .distinct()
        )
        employees = (await db.execute(emp_stmt)).scalars().all()

        if len(employees) < 2:
            raise ValueError("Нужно минимум 2 сотрудника для оценки")

        # 2. Генерируем все пары (respondent, target), где respondent != target
        assignments_created = 0
        for respondent in employees:
            for target in employees:
                if respondent.id == target.id:
                    continue  # Пропускаем самооценку

                # Проверяем, есть ли уже такое назначение
                existing = await db.execute(
                    select(SurveyAssignment).where(
                        and_(
                            SurveyAssignment.session_id == session_id,
                            SurveyAssignment.respondent_id == respondent.id,
                            SurveyAssignment.target_id == target.id
                        )
                    )
                )

                if not existing.scalar_one_or_none():
                    assignment = SurveyAssignment(
                        session_id=session_id,
                        respondent_id=respondent.id,
                        target_id=target.id,
                        status="pending"
                    )
                    db.add(assignment)
                    assignments_created += 1

        await db.commit()

        return {
            "message": f"Создано {assignments_created} назначений",
            "total_employees": len(employees),
            "assignments_created": assignments_created
        }