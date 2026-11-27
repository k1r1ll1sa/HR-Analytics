import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.survey_answer import (
    AnswerCreate, AssignmentResponse, SurveyToFillResponse,
    AnswerResponse, CompleteSurveyResponse)
from app.services.survey_fill import SurveyFillService

router = APIRouter(prefix="/companies/{company_id}", tags=["Прохождение опросов"])


@router.get("/me/assignments", response_model=list[AssignmentResponse])
async def list_my_assignments(company_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        items = await SurveyFillService.list_my_assignments(db, company_id, current_user)
        return items
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/assignments/{assignment_id}/questions", response_model=SurveyToFillResponse)
async def get_questions(company_id: uuid.UUID, assignment_id: uuid.UUID,
                        db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        data = await SurveyFillService.get_questions_for_assignment(db, assignment_id, current_user)
        return data
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/assignments/{assignment_id}/answers", response_model=AnswerResponse,status_code=status.HTTP_201_CREATED)
async def submit_answer(company_id: uuid.UUID, assignment_id: uuid.UUID, answer_in: AnswerCreate,
                        db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        answer = await SurveyFillService.submit_answer(db=db,
                                                       assignment_id=assignment_id,
                                                       user=current_user,
                                                       question_id=answer_in.question_id,
                                                       numeric_value=answer_in.numeric_value,
                                                       text_value=answer_in.text_value,
                                                       boolean_value=answer_in.boolean_value)
        return answer
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/assignments/{assignment_id}/complete", response_model=CompleteSurveyResponse)
async def complete_survey(company_id: uuid.UUID, assignment_id: uuid.UUID,
                          db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        result = await SurveyFillService.complete_assignment(db, assignment_id, current_user)
        return result
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))