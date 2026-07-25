from sqlalchemy import Column, String, Boolean, DateTime, Float, Integer, Text, Date, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from api.src.db import Base


class TrainingCourse(Base):
    __tablename__ = "tr_courses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)
    area = Column(String(50), nullable=True)
    position = Column(String(50), nullable=True)
    estimated_minutes = Column(Integer, default=0)
    is_mandatory = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_preloaded = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TrainingModule(Base):
    __tablename__ = "tr_modules"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id = Column(UUID(as_uuid=True), ForeignKey("tr_courses.id"), nullable=False, index=True)

    title = Column(String(200), nullable=False)
    content_type = Column(String(20), nullable=False)
    content_url = Column(String(500), nullable=True)
    content_text = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)
    estimated_minutes = Column(Integer, default=0)
    passing_score = Column(Integer, nullable=True)
    max_score = Column(Integer, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TrainingAssignment(Base):
    __tablename__ = "tr_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_name = Column(String(200), nullable=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("tr_courses.id"), nullable=False)

    assigned_by = Column(UUID(as_uuid=True), nullable=True)
    assigned_at = Column(DateTime(timezone=True), server_default=func.now())
    due_date = Column(Date, nullable=True)

    status = Column(String(20), default="assigned")
    progress_pct = Column(Float, default=0)

    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TrainingModuleProgress(Base):
    __tablename__ = "tr_module_progress"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("tr_assignments.id"), nullable=False, index=True)
    module_id = Column(UUID(as_uuid=True), ForeignKey("tr_modules.id"), nullable=False)

    status = Column(String(20), default="pending")
    score = Column(Float, nullable=True)
    max_score = Column(Float, nullable=True)
    attempts = Column(Integer, default=0)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TrainingCertificate(Base):
    __tablename__ = "tr_certificates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    employee_name = Column(String(200), nullable=True)
    course_id = Column(UUID(as_uuid=True), ForeignKey("tr_courses.id"), nullable=False)
    assignment_id = Column(UUID(as_uuid=True), ForeignKey("tr_assignments.id"), nullable=True)

    issued_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(Date, nullable=True)
    score = Column(Float, nullable=True)
    is_valid = Column(Boolean, default=True)
    recertified_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
