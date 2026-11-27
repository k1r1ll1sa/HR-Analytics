import uuid
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, field_validator, ConfigDict
from app.models.survey import QuestionType, SessionStatus


class AnswerCreate(BaseModel):
    """Запрос на отправку одного ответа."""
    question_id: uuid.UUID
    numeric_value: Optional[float] = None
    text_value: Optional[str] = None
    boolean_value: Optional[bool] = None

    @field_validator('numeric_value')
    @classmethod
    def validate_numeric_range(cls, v):
        if v is not None and not (0 <= v <= 100):
            raise ValueError("Числовой ответ должен быть в диапазоне 0–100")
        return v


class AssignmentResponse(BaseModel):
    """Отображение назначения для респондента."""
    id: uuid.UUID
    session_id: uuid.UUID
    survey_id: uuid.UUID
    target_id: uuid.UUID
    status: str
    session_title: str
    session_status: SessionStatus
    survey_title: str
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QuestionForAnswer(BaseModel):
    """Вопрос, который респондент видит при заполнении."""
    id: uuid.UUID
    question_text: str
    question_type: QuestionType
    order_index: Optional[int] = None
    is_required: bool
    options_json: Optional[list] = None
    # Уже данный ответ (если респондент возвращался к опросу)
    existing_answer: Optional[dict] = None

    class Config:
        from_attributes = True


class SurveyToFillResponse(BaseModel):
    """Полный "пакет" для заполнения: опрос + вопросы + статус назначения."""
    assignment_id: uuid.UUID
    survey_id: uuid.UUID
    survey_title: str
    survey_description: Optional[str] = None
    session_title: str
    target_id: uuid.UUID
    status: str
    questions: List[QuestionForAnswer]


class AnswerResponse(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    question_id: uuid.UUID
    numeric_value: Optional[float] = None
    text_value: Optional[str] = None
    boolean_value: Optional[bool] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CompleteSurveyResponse(BaseModel):
    message: str
    assignment_id: uuid.UUID
    status: str
    completed_at: Optional[datetime] = None
    answered_count: int
    total_required_count: int