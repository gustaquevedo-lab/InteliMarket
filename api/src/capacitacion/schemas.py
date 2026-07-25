from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
import uuid


# ── TrainingCourse ───────────────────────────────────────────────

class TrainingCourseCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    area: Optional[str] = None
    position: Optional[str] = None
    estimated_minutes: int = 0
    is_mandatory: bool = False
    is_active: bool = True


class TrainingCourseResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    title: str
    description: Optional[str]
    category: Optional[str]
    area: Optional[str]
    position: Optional[str]
    estimated_minutes: int
    is_mandatory: bool
    is_active: bool
    is_preloaded: bool
    module_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ── TrainingModule ───────────────────────────────────────────────

class TrainingModuleCreate(BaseModel):
    title: str
    content_type: str
    content_url: Optional[str] = None
    content_text: Optional[str] = None
    order_index: int = 0
    estimated_minutes: int = 0
    passing_score: Optional[int] = None
    max_score: Optional[int] = None


class TrainingModuleResponse(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    content_type: str
    content_url: Optional[str]
    content_text: Optional[str]
    order_index: int
    estimated_minutes: int
    passing_score: Optional[int]
    max_score: Optional[int]

    class Config:
        from_attributes = True


# ── TrainingAssignment ───────────────────────────────────────────

class TrainingAssignmentCreate(BaseModel):
    employee_id: str
    employee_name: Optional[str] = None
    course_id: str
    due_date: Optional[str] = None


class BulkAssignRequest(BaseModel):
    employee_ids: list[str]
    course_id: str
    due_date: Optional[str] = None


class TrainingAssignmentResponse(BaseModel):
    id: uuid.UUID
    company_id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str]
    course_id: uuid.UUID
    assigned_at: Optional[datetime]
    due_date: Optional[date]
    status: str
    progress_pct: float
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    course_title: Optional[str] = None

    class Config:
        from_attributes = True


# ── TrainingModuleProgress ───────────────────────────────────────

class ModuleProgressUpdate(BaseModel):
    status: str
    score: Optional[float] = None
    max_score: Optional[float] = None


class TrainingModuleProgressResponse(BaseModel):
    id: uuid.UUID
    assignment_id: uuid.UUID
    module_id: uuid.UUID
    status: str
    score: Optional[float]
    max_score: Optional[float]
    attempts: int
    completed_at: Optional[datetime]
    module_title: Optional[str] = None

    class Config:
        from_attributes = True


# ── TrainingCertificate ──────────────────────────────────────────

class TrainingCertificateResponse(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    employee_name: Optional[str]
    course_id: uuid.UUID
    course_title: Optional[str] = None
    issued_at: Optional[datetime]
    expires_at: Optional[date]
    score: Optional[float]
    is_valid: bool
    recertified_at: Optional[datetime]

    class Config:
        from_attributes = True


# ── Dashboard ────────────────────────────────────────────────────

class TrainingDashboardResponse(BaseModel):
    total_courses: int
    total_assignments: int
    certified_employees: int
    pending_employees: int
    avg_progress_pct: float
    compliance_by_area: list[dict]
    most_assigned_courses: list[dict]
    recent_certificates: list[TrainingCertificateResponse]
