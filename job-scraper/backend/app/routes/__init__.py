from fastapi import APIRouter

from app.routes.dashboard import router as dashboard_router
from app.routes.jobs import router as jobs_router
from app.routes.applications import router as applications_router
from app.routes.settings import router as settings_router

api_router = APIRouter(prefix="/api")
api_router.include_router(dashboard_router)
api_router.include_router(jobs_router)
api_router.include_router(applications_router)
api_router.include_router(settings_router)
