import uuid
from datetime import datetime
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.survey import Survey, SurveyQuestion, SurveySession, SurveyAssignment, SurveyAnswer
from app.models.company import Employee


class SurveyService:
    @staticmethod
    async def create_survey(
            db: AsyncSession,
            company_id: uuid.UUID,
            created_by: uuid.UUID,
            title: str,
            description: str | None,
            category: str | None,
            questions: list
    ):
        # Создаем опрос
        survey = Survey(
            company_id=company_id,
            title=title,
            description=description,
            category=category,
            is_active=True,
            created_by=created_by
        )
        db.add(survey)
        await db.flush()

        # Создаем вопросы
        for idx, q_data in enumerate(questions):
            question = SurveyQuestion(
                survey_id=survey.id,
                question_text=q_data['question_text'],
                question_type=q_data.get('question_type', 'slider'),
                order_index=q_data.get('order_index', idx),
                is_required=q_data.get('is_required', True),
                options_json=q_data.get('options_json')
            )
            db.add(question)

        await db.commit()
        await db.refresh(survey)

        # Загружаем вопросы
        await db.execute(
            select(Survey)
            .options(selectinload(Survey.questions))
            .where(Survey.id == survey.id)
        )

        return survey

    @staticmethod
    async def get_survey(db: AsyncSession, survey_id: uuid.UUID, company_id: uuid.UUID):
        result = await db.execute(
            select(Survey)
            .options(selectinload(Survey.questions))
            .where(Survey.id == survey_id, Survey.company_id == company_id)
        )
        survey = result.scalar_one_or_none()
        return survey

    @staticmethod
    async def update_survey(
            db: AsyncSession,
            survey_id: uuid.UUID,
            company_id: uuid.UUID,
            update_data: dict
    ):
        result = await db.execute(
            select(Survey)
            .where(Survey.id == survey_id, Survey.company_id == company_id)
        )
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
        result = await db.execute(
            select(Survey).where(Survey.id == survey_id, Survey.company_id == company_id)
        )
        survey = result.scalar_one_or_none()
        if not survey:
            raise ValueError("Опрос не найден")

        await db.delete(survey)
        await db.commit()
        return True

    @staticmethod
    async def create_session(
            db: AsyncSession,
            survey_id: uuid.UUID,
            company_id: uuid.UUID,
            created_by: uuid.UUID,
            title: str,
            start_date: datetime | None,
            end_date: datetime | None,
            status: str
    ):
        # Проверяем существование опроса
        survey = await db.get(Survey, survey_id)
        if not survey or survey.company_id != company_id:
            raise ValueError("Опрос не найден или не принадлежит этой компании")

        session = SurveySession(
            survey_id=survey_id,
            company_id=company_id,
            title=title,
            start_date=start_date,
            end_date=end_date,
            status=status,
            created_by=created_by
        )
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
        # Проверяем, что сотрудник существует в компании
        respondent = await db.get(Employee, respondent_id)
        target = await db.get(Employee, target_id)

        if not respondent or not target:
            raise ValueError("Сотрудник не найден")

        if respondent.company_id != target.company_id:
            raise ValueError("Сотрудники должны быть из одной компании")

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
    async def submit_answer(
            db: AsyncSession,
            assignment_id: uuid.UUID,
            question_id: uuid.UUID,
            numeric_value: float | None = None,
            text_value: str | None = None,
            boolean_value: bool | None = None
    ):
        # Проверяем назначение
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