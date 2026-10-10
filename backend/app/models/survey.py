import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    String, Text, Boolean, DateTime, Integer, Float,
    ForeignKey, func, Enum, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ENUMS для типизации
class QuestionType(str, enum.Enum):
    slider = "slider"  # Ползунок
    checkbox = "checkbox"  # Чекбокс (Да/Нет или множественный выбор)
    text = "text"  # Свободный текстовый ответ
    radio = "radio"  # Радио-кнопки


class SessionStatus(str, enum.Enum):
    draft = "draft"  # Черновик
    active = "active"  # Активная сессия (сотрудники могут отвечать)
    completed = "completed"  # Сессия завершена, идёт сбор аналитики


# ШАБЛОН ОПРОСНИКА
class Survey(Base):
    __tablename__ = "surveys"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    title: Mapped[str] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)  # leadership, hard_skills, communication
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), onupdate=func.now())

    # Связи
    company = relationship("Company", backref="surveys")
    creator = relationship("User", backref="created_surveys")
    questions = relationship("SurveyQuestion", back_populates="survey", cascade="all, delete-orphan")
    sessions = relationship("SurveySession", back_populates="survey", cascade="all, delete-orphan")


# === 2. ВОПРОСЫ В ШАБЛОНЕ ===
class SurveyQuestion(Base):
    __tablename__ = "survey_questions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id"))
    question_text: Mapped[str] = mapped_column(Text, nullable=True)
    question_type: Mapped[QuestionType] = mapped_column(Enum(QuestionType), default=QuestionType.slider, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=True)  # Порядок отображения вопросов
    is_required: Mapped[bool] = mapped_column(Boolean, default=True)
    # Для radio/checkbox храним варианты ответов в JSON: ["Вариант 1", "Вариант 2"]
    options_json: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    # Связи
    survey = relationship("Survey", back_populates="questions")
    answers = relationship("SurveyAnswer", back_populates="question", cascade="all, delete-orphan")


# СЕССИЯ ОПРОСА (Конкретный запуск, например "Оценка Q3 2026") ===
class SurveySession(Base):
    __tablename__ = "survey_sessions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    survey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("surveys.id"))
    company_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("companies.id"))
    title: Mapped[str] = mapped_column(String(255), nullable=True)  # "Оценка за Q3 2026"
    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    end_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    status: Mapped[SessionStatus] = mapped_column(Enum(SessionStatus), default=SessionStatus.draft, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now(), nullable=True)

    # Связи
    survey = relationship("Survey", back_populates="sessions")
    company = relationship("Company", backref="survey_sessions")
    assignments = relationship("SurveyAssignment", back_populates="session", cascade="all, delete-orphan")


# НАЗНАЧЕНИЕ (Кто кого оценивает в рамках сессии)
# Это сердце метода "360 градусов": респондент оценивает таргета
class SurveyAssignment(Base):
    __tablename__ = "survey_assignments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("survey_sessions.id"))
    respondent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"))  # Кто заполняет
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("employees.id"))  # Кого оценивают
    status: Mapped[str] = mapped_column(String(50), default="pending")  # pending, completed
    notified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    __table_args__ = (
        # Запрещаем дубликаты: один респондент не может оценить одного таргета дважды в одной сессии
        UniqueConstraint('session_id', 'respondent_id', 'target_id', name='uq_session_respondent_target'),
    )

    # Связи
    session = relationship("SurveySession", back_populates="assignments")
    respondent = relationship("Employee", foreign_keys=[respondent_id], backref="given_assignments")
    target = relationship("Employee", foreign_keys=[target_id], backref="received_assignments")
    answers = relationship("SurveyAnswer", back_populates="assignment", cascade="all, delete-orphan")


# ОТВЕТЫ (Защищены от просмотра другими сотрудниками)
class SurveyAnswer(Base):
    __tablename__ = "survey_answers"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    assignment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("survey_assignments.id"))
    question_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("survey_questions.id"))

    # Храним ответы в разных колонках в зависимости от типа вопроса
    numeric_value: Mapped[float | None] = mapped_column(Float, nullable=True)  # Для slider/radio
    text_value: Mapped[str | None] = mapped_column(Text, nullable=True)  # Для text
    boolean_value: Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # Для checkbox

    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())

    __table_args__ = (
        UniqueConstraint('assignment_id', 'question_id', name='uq_assignment_question'),
    )

    # Связи
    assignment = relationship("SurveyAssignment", back_populates="answers")
    question = relationship("SurveyQuestion", back_populates="answers")