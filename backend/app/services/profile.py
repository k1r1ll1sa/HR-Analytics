import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.models.user import User
from app.models.company import Employee, Department, Company
from app.schemas.profile import ProfileResponse, ProfileUpdateRequest


class ProfileService:

    @staticmethod
    async def get_profile(db: AsyncSession, user_id: uuid.UUID) -> ProfileResponse:
        """Получить полный профиль пользователя с данными сотрудника"""
        result = await db.execute(
            select(User)
            .where(User.id == user_id)
            .options(
                selectinload(User.employee).selectinload(Employee.company),
                selectinload(User.employee).selectinload(Employee.department)
            )
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("Пользователь не найден")

        profile_data = {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "avatar_url": user.avatar_url,
            "telegram": user.telegram,
            "city": user.city,
            "about": user.about,
            "notify_by_email": user.notify_by_email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at,
        }

        if user.employee:
            emp = user.employee
            profile_data.update({
                "employee_id": emp.id,
                "company_id": emp.company_id,
                "company_name": emp.company.name if emp.company else None,
                "position": emp.position,
                "department_names": [emp.department.name] if emp.department else [],
                "hire_date": emp.hire_date,
            })

        return ProfileResponse(**profile_data)

    @staticmethod
    async def update_profile(
            db: AsyncSession,
            user_id: uuid.UUID,
            profile_data: ProfileUpdateRequest
    ) -> ProfileResponse:
        """Обновить профиль пользователя"""

        result = await db.execute(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.employee))
        )
        user = result.scalar_one_or_none()

        if not user:
            raise ValueError("Пользователь не найден")

        user_fields = ["full_name", "phone", "avatar_url", "telegram", "city", "about", "notify_by_email"]
        for field in user_fields:
            value = getattr(profile_data, field)
            if value is not None:
                setattr(user, field, value)

        if profile_data.position is not None and user.employee:
            user.employee.position = profile_data.position

        await db.commit()
        await db.refresh(user)

        return await ProfileService.get_profile(db, user_id)