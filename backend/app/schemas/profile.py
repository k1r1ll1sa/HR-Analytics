import uuid
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr


class ProfileResponse(BaseModel):
    """Полный профиль пользователя с данными сотрудника"""
    id: uuid.UUID
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    telegram: Optional[str] = None
    city: Optional[str] = None
    about: Optional[str] = None
    notify_by_email: bool = True
    role: str
    is_active: bool
    created_at: datetime

    employee_id: Optional[uuid.UUID] = None
    company_id: Optional[uuid.UUID] = None
    company_name: Optional[str] = None
    position: Optional[str] = None
    department_names: List[str] = []
    hire_date: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ProfileUpdateRequest(BaseModel):
    """Запрос на обновление профиля"""
    full_name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    phone: Optional[str] = Field(default=None, max_length=50)
    avatar_url: Optional[str] = Field(default=None, max_length=500)
    telegram: Optional[str] = Field(default=None, max_length=100)
    city: Optional[str] = Field(default=None, max_length=100)
    about: Optional[str] = Field(default=None, max_length=1000)
    notify_by_email: Optional[bool] = None
    position: Optional[str] = Field(default=None, max_length=255)


class ProfileActionResponse(BaseModel):
    """Универсальный ответ для операций с профилем"""
    success: bool
    message: str
    profile: Optional[ProfileResponse] = None