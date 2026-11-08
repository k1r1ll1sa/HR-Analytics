from fastapi import APIRouter
from app.api.v1.endpoints.registration import router as registration_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.departments import router as department_router
from app.api.v1.endpoints.employees import router as employees_router
from app.api.v1.endpoints.profile import router as profile_router

api_router = APIRouter()

api_router.include_router(registration_router)
api_router.include_router(auth_router)
api_router.include_router(department_router)
api_router.include_router(employees_router)
api_router.include_router(profile_router)