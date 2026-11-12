import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import check_owner_or_hr
from app.models.user import User
from app.models.company import Company
from app.schemas.survey import (
    SurveyCreate, SurveyUpdate, SurveyResponse,
    SurveySessionCreate, SurveySessionResponse,
    SurveyAssignmentCreate, SurveyAssignmentResponse
)
from app.services.survey import SurveyService

router = APIRouter(prefix="/companies/{company_id}/surveys", tags=["Опросы"])

# === УПРАВЛЕНИЕ ОПРОСАМИ ===

@router.post("/", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
async def create_survey(
    company_id: uuid.UUID,
    survey_in: SurveyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_owner_or_hr)
):
    """Создать новый опрос (только Owner/HR)"""
    try:
        survey = await SurveyService.create_survey(
            db=db,
            company_id=company_id,
            created_by=current_user.id,
            title=survey_in.title,
            description=survey_in.description,
            category=survey_in.category,
            questions=[q.model_dump() for q in survey_in.questions]
        )
        return survey
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{survey_id}", response_model=SurveyResponse)
async def get_survey(
    company_id: uuid.UUID,
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_owner_or_hr)
):
    """Получить опрос по ID"""
    survey = await SurveyService.get_survey(db, survey_id, company_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Опрос не найден")
    return survey

@router.put("/{survey_id}", response_model=SurveyResponse)
async def update_survey(
    company_id: uuid.UUID,
    survey_id: uuid.UUID,
    survey_in: SurveyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_owner_or_hr)
):
    """Обновить опрос (только Owner/HR)"""
    try:
        survey = await SurveyService.update_survey(
            db=db,
            survey_id=survey_id,
            company_id=company_id,
            update_data=survey_in.model_dump(exclude_unset=True)
        )
        return survey
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{survey_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_survey(
    company_id: uuid.UUID,
    survey_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_owner_or_hr)
):
    """Удалить опрос (только Owner/HR)"""
    try:
        await SurveyService.delete_survey(db, survey_id, company_id)
        return None
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# === УПРАВЛЕНИЕ СЕССИЯМИ ===

@router.post("/{survey_id}/sessions", response_model=SurveySessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    company_id: uuid.UUID,
    survey_id: uuid.UUID,
    session_in: SurveySessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_owner_or_hr)
):
    """Создать сессию опроса (запуск)"""
    try:
        session = await SurveyService.create_session(
            db=db,
            survey_id=survey_id,
            company_id=company_id,
            created_by=current_user.id,
            title=session_in.title,
            start_date=session_in.start_date,
            end_date=session_in.end_date,
            status=session_in.status.value
        )
        return session
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# === НАЗНАЧЕНИЯ ===

@router.post("/sessions/{session_id}/assignments", response_model=SurveyAssignmentResponse, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    company_id: uuid.UUID,
    session_id: uuid.UUID,
    assignment_in: SurveyAssignmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_owner_or_hr)
):
    """Назначить сотрудника для оценки другого сотрудника"""
    try:
        assignment = await SurveyService.create_assignment(
            db=db,
            session_id=session_id,
            respondent_id=assignment_in.respondent_id,
            target_id=assignment_in.target_id
        )
        return assignment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# === ОТВЕТЫ НА ОПРОС ===

@router.post("/assignments/{assignment_id}/answers", status_code=status.HTTP_201_CREATED)
async def submit_answer(
    company_id: uuid.UUID,
    assignment_id: uuid.UUID,
    question_id: uuid.UUID,
    answer_data: dict,  # numeric_value, text_value, boolean_value
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(check_owner_or_hr)
):
    """Отправить ответ на вопрос опроса"""
    try:
        answer = await SurveyService.submit_answer(
            db=db,
            assignment_id=assignment_id,
            question_id=question_id,
            numeric_value=answer_data.get('numeric_value'),
            text_value=answer_data.get('text_value'),
            boolean_value=answer_data.get('boolean_value')
        )
        return {"message": "Ответ сохранен", "success": True}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))