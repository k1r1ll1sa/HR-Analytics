import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.profile import ProfileResponse, ProfileUpdateRequest, ProfileActionResponse
from app.services.profile import ProfileService

router = APIRouter(prefix="/users", tags=["Профиль"])


@router.get("/me/profile", response_model=ProfileResponse)
async def get_my_profile(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить свой профиль"""
    try:
        profile = await ProfileService.get_profile(db, current_user.id)
        return profile
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/me/profile", response_model=ProfileActionResponse)
async def update_my_profile(
    profile_data: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить свой профиль"""
    try:
        updated_profile = await ProfileService.update_profile(
            db, current_user.id, profile_data
        )
        return ProfileActionResponse(
            success=True,
            message="Профиль успешно обновлен",
            profile=updated_profile
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))