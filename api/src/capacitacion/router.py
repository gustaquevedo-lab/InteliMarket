from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.features.deps import require_feature
from api.src.capacitacion import service
from api.src.capacitacion.schemas import (
    TrainingCourseCreate, TrainingModuleCreate, TrainingAssignmentCreate,
    BulkAssignRequest, ModuleProgressUpdate,
)

router = APIRouter(
    prefix="/api/v1/capacitacion",
    tags=["capacitacion"],
    dependencies=[Depends(require_feature("capacitacion")), Depends(require_auth)],
)


# ── Preloaded Courses ────────────────────────────────────────────

@router.post("/ensure-preloaded")
async def ensure_preloaded(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    await service.ensure_preloaded_courses(db, user["company_id"])
    return {"ok": True}


# ── Courses ──────────────────────────────────────────────────────

@router.get("/courses")
async def list_courses(
    category: Optional[str] = Query(None), area: Optional[str] = Query(None),
    position: Optional[str] = Query(None), include_preloaded: bool = Query(True),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    await service.ensure_preloaded_courses(db, user["company_id"])
    return await service.list_courses(db, user["company_id"], category, area, position, include_preloaded, limit)


@router.get("/courses/{course_id}")
async def get_course(course_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.get_course(db, user["company_id"], course_id)
    if not result:
        raise HTTPException(status_code=404, detail="Course not found")
    return result


@router.post("/courses")
async def create_course(data: TrainingCourseCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.create_course(db, user["company_id"], data)


@router.post("/courses/{course_id}/modules")
async def add_module(course_id: str, data: TrainingModuleCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.add_module(db, course_id, data)


# ── Assignments ──────────────────────────────────────────────────

@router.post("/assign")
async def assign_course(data: TrainingAssignmentCreate, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.assign_course(db, user["company_id"], data)


@router.post("/bulk-assign")
async def bulk_assign(data: BulkAssignRequest, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    return await service.bulk_assign(db, user["company_id"], data.employee_ids, data.course_id, data.due_date)


@router.get("/assignments")
async def list_assignments(
    employee_id: Optional[str] = Query(None), course_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None), limit: int = Query(100), offset: int = Query(0),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_assignments(db, user["company_id"], employee_id, course_id, status, limit, offset)


@router.get("/assignments/{assignment_id}/progress")
async def get_progress(assignment_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.get_assignment_progress(db, user["company_id"], assignment_id)
    if not result:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return result


@router.patch("/assignments/{assignment_id}/modules/{module_id}")
async def update_module_progress(
    assignment_id: str, module_id: str, data: ModuleProgressUpdate,
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    try:
        return await service.update_module_progress(db, user["company_id"], assignment_id, module_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ── Certificates ─────────────────────────────────────────────────

@router.get("/certificates")
async def list_certificates(
    employee_id: Optional[str] = Query(None), is_valid: Optional[bool] = Query(None),
    limit: int = Query(100),
    db: AsyncSession = Depends(get_db), user=Depends(require_auth),
):
    return await service.list_certificates(db, user["company_id"], employee_id, is_valid, limit)


@router.post("/certificates/{certificate_id}/recertify")
async def recertify(certificate_id: str, db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    result = await service.recertify(db, user["company_id"], certificate_id)
    if not result:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return result


# ── Dashboard ────────────────────────────────────────────────────

@router.get("/dashboard")
async def get_dashboard(db: AsyncSession = Depends(get_db), user=Depends(require_auth)):
    await service.ensure_preloaded_courses(db, user["company_id"])
    return await service.get_dashboard(db, user["company_id"])
