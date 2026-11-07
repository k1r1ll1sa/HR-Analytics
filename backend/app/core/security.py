from datetime import datetime, timedelta, timezone
from typing import Any
import jwt
from passlib.context import CryptContext
from app.core.config import settings
import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.company import Company, Employee

security = HTTPBearer()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    print(f"[DEBUG] Хеширование пароля, длина: {len(password)} символов, тип: {type(password)}")
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


async def get_current_user(
        credentials: HTTPAuthorizationCredentials = Depends(security),
        db: AsyncSession = Depends(get_db)
) -> User:
    """Извлекает пользователя из JWT токена"""
    try:
        payload = jwt.decode(credentials.credentials, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверные учетные данные")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный или просроченный токен")

    stmt = select(User).where(User.id == uuid.UUID(user_id))
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Пользователь не найден или неактивен")
    return user


async def get_current_owner(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Недостаточно прав.")
    return current_user


async def check_company_ownership(company_id: uuid.UUID, current_user: User = Depends(get_current_owner), db: AsyncSession = Depends(get_db)) -> Company:
    stmt = select(Company).where(Company.id == company_id, Company.owner_id == current_user.id)
    result = await db.execute(stmt)
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="У вас нет прав на управление этой компанией")
    return company


async def check_owner_or_hr(company_id: uuid.UUID, current_user: User = Depends(get_current_user),
                            db: AsyncSession = Depends(get_db)) -> User:
    if current_user.role == "owner":
        stmt = select(Company).where(Company.id == company_id, Company.owner_id == current_user.id)
        if (await db.execute(stmt)).scalar_one_or_none():
            return current_user

    if current_user.role == "hr":
        stmt = select(Employee).where(
            Employee.user_id == current_user.id,
            Employee.company_id == company_id,
            Employee.role == "hr",
            Employee.is_active == True
        )
        if (await db.execute(stmt)).scalar_one_or_none():
            return current_user

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Недостаточно прав. Требуется роль Владельца или HR этой компании."
    )