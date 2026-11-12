import uuid
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field, field_validator
import enum


class QuestionType(str, enum.Enum):
    slider = "slider"
    checkbox = "checkbox"
    text = "text"
    radio = "radio"


class SessionStatus(str, enum.Enum):
    draft = "draft"
    active = "active"
    completed = "completed"


# === СХЕМЫ ДЛЯ ВОПРОСОВ ===
class SurveyQuestionCreate(BaseModel):
    question_text: str = Field(..., min_length=1, max_length=1000)
    question_type: QuestionType = QuestionType.slider
    order_index: Optional[int] = None
    is_required: bool = True
    options_json: Optional[list] = None  # Для radio/checkbox


class SurveyQuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[QuestionType] = None
    order_index: Optional[int] = None
    is_required: Optional[bool] = None
    options_json: Optional[list] = None


class SurveyQuestionResponse(BaseModel):
    id: uuid.UUID
    survey_id: uuid.UUID
    question_text: str
    question_type: QuestionType
    order_index: Optional[int] = None
    is_required: bool
    options_json: Optional[list] = None

    class Config:
        from_attributes = True


# === СХЕМЫ ДЛЯ ОПРОСА ===
class SurveyCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    questions: List[SurveyQuestionCreate] = Field(..., min_items=1)

    @field_validator('category')
    @classmethod
    def validate_category(cls, v):
        if v and v not in ['leadership', 'hard_skills', 'communication', 'soft_skills', 'other']:
            raise ValueError("Недопустимая категория")
        return v


class SurveyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None


class SurveyResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    is_active: bool
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    questions: List[SurveyQuestionResponse] = []

    class Config:
        from_attributes = True


# === СХЕМЫ ДЛЯ СЕССИИ ===
class SurveySessionCreate(BaseModel):
    survey_id: uuid.UUID
    title: str = Field(..., min_length=1, max_length=255)
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: SessionStatus = SessionStatus.draft


class SurveySessionResponse(BaseModel):
    id: uuid.UUID
    survey_id: uuid.UUID
    company_id: uuid.UUID
    title: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: SessionStatus
    created_by: Optional[uuid.UUID] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# === СХЕМЫ ДЛЯ НАЗНАЧЕНИЙ ===
class SurveyAssignmentCreate(BaseModel):
    respondent_id: uuid.UUID
    target_id: uuid.UUID


class SurveyAssignmentResponse(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    respondent_id: uuid.UUID
    target_id: uuid.UUID
    status: str
    notified_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True