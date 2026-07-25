from sqlalchemy import select, func as sa_func, and_, desc, asc, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, date, timedelta, timezone
from typing import Optional
import uuid

from api.src.capacitacion.models import (
    TrainingCourse, TrainingModule, TrainingAssignment,
    TrainingModuleProgress, TrainingCertificate,
)
from api.src.capacitacion.schemas import (
    TrainingCourseCreate, TrainingCourseResponse,
    TrainingModuleCreate, TrainingModuleResponse,
    TrainingAssignmentCreate, TrainingAssignmentResponse,
    ModuleProgressUpdate, TrainingModuleProgressResponse,
    TrainingCertificateResponse, TrainingDashboardResponse,
)


PRELOADED_COURSES = [
    {
        "title": "Manipulación de Alimentos",
        "description": "Curso obligatorio sobre buenas prácticas de manipulación, conservación y almacenamiento de alimentos según normativa SENACSA/INAN.",
        "category": "seguridad_alimentaria",
        "area": None,
        "position": None,
        "estimated_minutes": 45,
        "is_mandatory": True,
        "modules": [
            {"title": "Introducción a la Manipulación de Alimentos", "content_type": "video", "content_url": "https://training.intelimarket.com/manipulacion-intro", "order_index": 1, "estimated_minutes": 10},
            {"title": "Principios de Higiene Personal", "content_type": "text", "content_text": "Lavado de manos frecuente, uso de cofia y guantes, uñas cortas, uniforme limpio. Evitar joyas y maquillaje.", "order_index": 2, "estimated_minutes": 8},
            {"title": "Temperaturas Seguras de Conservación", "content_type": "video", "content_url": "https://training.intelimarket.com/temperaturas", "order_index": 3, "estimated_minutes": 12},
            {"title": "Evaluación Manipulación de Alimentos", "content_type": "quiz", "order_index": 4, "estimated_minutes": 15, "passing_score": 70, "max_score": 100},
        ],
    },
    {
        "title": "HACCP Básico",
        "description": "Fundamentos del sistema de Análisis de Peligros y Puntos Críticos de Control para supermercados.",
        "category": "seguridad_alimentaria",
        "area": None,
        "position": None,
        "estimated_minutes": 60,
        "is_mandatory": True,
        "modules": [
            {"title": "¿Qué es HACCP?", "content_type": "video", "content_url": "https://training.intelimarket.com/haccp-intro", "order_index": 1, "estimated_minutes": 15},
            {"title": "Los 7 Principios de HACCP", "content_type": "text", "content_text": "1. Identificar peligros\n2. Determinar PCC\n3. Establecer límites críticos\n4. Monitorear PCC\n5. Acciones correctivas\n6. Verificación\n7. Documentación", "order_index": 2, "estimated_minutes": 20},
            {"title": "PCC en Supermercados", "content_type": "video", "content_url": "https://training.intelimarket.com/pcc-supermercado", "order_index": 3, "estimated_minutes": 15},
            {"title": "Evaluación HACCP", "content_type": "quiz", "order_index": 4, "estimated_minutes": 10, "passing_score": 70, "max_score": 100},
        ],
    },
    {
        "title": "Atención al Cliente",
        "description": "Técnicas de atención al cliente, manejo de objeciones y experiencia de compra en el punto de venta.",
        "category": "servicio",
        "area": None,
        "position": None,
        "estimated_minutes": 40,
        "is_mandatory": True,
        "modules": [
            {"title": "La Importancia del Servicio al Cliente", "content_type": "video", "content_url": "https://training.intelimarket.com/servicio-intro", "order_index": 1, "estimated_minutes": 10},
            {"title": "Protocolo de Atención", "content_type": "text", "content_text": "Saludar siempre. Sonreír. Escuchar activamente. Preguntar cómo ayudar. Ofrecer alternativas. Agradecer la visita.", "order_index": 2, "estimated_minutes": 8},
            {"title": "Manejo de Reclamos", "content_type": "video", "content_url": "https://training.intelimarket.com/reclamos", "order_index": 3, "estimated_minutes": 12},
            {"title": "Evaluación Atención al Cliente", "content_type": "quiz", "order_index": 4, "estimated_minutes": 10, "passing_score": 70, "max_score": 100},
        ],
    },
    {
        "title": "Uso del POS",
        "description": "Capacitación completa sobre el sistema POS: cobro, devoluciones, facturación electrónica y cierre de caja.",
        "category": "operaciones",
        "area": "caja",
        "position": "cajero",
        "estimated_minutes": 55,
        "is_mandatory": True,
        "modules": [
            {"title": "Componentes del POS", "content_type": "video", "content_url": "https://training.intelimarket.com/pos-componentes", "order_index": 1, "estimated_minutes": 10},
            {"title": "Proceso de Cobro", "content_type": "video", "content_url": "https://training.intelimarket.com/pos-cobro", "order_index": 2, "estimated_minutes": 15},
            {"title": "Devoluciones y Notas de Crédito", "content_type": "text", "content_text": "Procedimiento para devoluciones: verificar ticket, inspeccionar producto, autorización de supervisor, procesar en POS, emitir nota de crédito.", "order_index": 3, "estimated_minutes": 10},
            {"title": "Facturación Electrónica - SIFEN", "content_type": "video", "content_url": "https://training.intelimarket.com/sifen-factura", "order_index": 4, "estimated_minutes": 10},
            {"title": "Evaluación POS", "content_type": "quiz", "order_index": 5, "estimated_minutes": 10, "passing_score": 80, "max_score": 100},
        ],
    },
    {
        "title": "Prevención de Pérdidas",
        "description": "Identificación y prevención de pérdidas en el supermercado: robos internos y externos, mermas y control de inventario.",
        "category": "seguridad",
        "area": None,
        "position": None,
        "estimated_minutes": 50,
        "is_mandatory": False,
        "modules": [
            {"title": "Tipos de Pérdidas en el Supermercado", "content_type": "video", "content_url": "https://training.intelimarket.com/perdidas-tipos", "order_index": 1, "estimated_minutes": 12},
            {"title": "Señales de Alerta", "content_type": "text", "content_text": "Clientes con ropa holgada, grupos que distraen, productos fuera de lugar, etiquetas cambiadas, empaques dañados.", "order_index": 2, "estimated_minutes": 10},
            {"title": "Procedimientos de Seguridad", "content_type": "video", "content_url": "https://training.intelimarket.com/seguridad-procedimientos", "order_index": 3, "estimated_minutes": 15},
            {"title": "Control de Mermas", "content_type": "text", "content_text": "Registrar productos vencidos, dañados o en mal estado. Separar del inventario. Informar al supervisor. Documentar en sistema.", "order_index": 4, "estimated_minutes": 8},
            {"title": "Evaluación Prevención de Pérdidas", "content_type": "quiz", "order_index": 5, "estimated_minutes": 5, "passing_score": 70, "max_score": 100},
        ],
    },
]


# ── Preloaded Courses ────────────────────────────────────────────

async def ensure_preloaded_courses(db: AsyncSession, company_id: str):
    r = await db.execute(
        select(TrainingCourse).where(
            TrainingCourse.company_id == uuid.UUID(company_id),
            TrainingCourse.is_preloaded == True,
        ).limit(1)
    )
    if r.scalar():
        return

    for course_data in PRELOADED_COURSES:
        modules = course_data.pop("modules")
        course = TrainingCourse(
            company_id=uuid.UUID(company_id),
            is_preloaded=True,
            **course_data,
        )
        db.add(course)
        await db.flush()
        for mod_data in modules:
            mod = TrainingModule(
                course_id=course.id,
                **mod_data,
            )
            db.add(mod)
        await db.flush()


# ── Courses ──────────────────────────────────────────────────────

async def list_courses(
    db: AsyncSession, company_id: str, category: Optional[str] = None,
    area: Optional[str] = None, position: Optional[str] = None,
    include_preloaded: bool = True, limit: int = 100,
) -> list[dict]:
    q = select(
        TrainingCourse,
        sa_func.count(TrainingModule.id).label("module_count"),
    ).outerjoin(
        TrainingModule, TrainingModule.course_id == TrainingCourse.id
    ).where(
        TrainingCourse.company_id == uuid.UUID(company_id),
        TrainingCourse.is_active == True,
    ).group_by(TrainingCourse.id)

    if category:
        q = q.where(TrainingCourse.category == category)
    if area:
        q = q.where(or_(TrainingCourse.area == area, TrainingCourse.area == None))
    if position:
        q = q.where(or_(TrainingCourse.position == position, TrainingCourse.position == None))
    if not include_preloaded:
        q = q.where(TrainingCourse.is_preloaded == False)

    q = q.order_by(TrainingCourse.title).limit(limit)
    r = await db.execute(q)
    results = []
    for course, count in r.all():
        d = TrainingCourseResponse.model_validate(course).model_dump()
        d["module_count"] = count
        results.append(d)
    return results


async def get_course(db: AsyncSession, company_id: str, course_id: str) -> Optional[dict]:
    r = await db.execute(
        select(TrainingCourse).where(
            TrainingCourse.id == uuid.UUID(course_id),
            TrainingCourse.company_id == uuid.UUID(company_id),
        )
    )
    course = r.scalar_one_or_none()
    if not course:
        return None
    d = TrainingCourseResponse.model_validate(course).model_dump()

    r2 = await db.execute(
        select(TrainingModule)
        .where(TrainingModule.course_id == course.id)
        .order_by(TrainingModule.order_index)
    )
    d["modules"] = [TrainingModuleResponse.model_validate(m).model_dump() for m in r2.scalars().all()]
    return d


async def create_course(db: AsyncSession, company_id: str, data: TrainingCourseCreate) -> dict:
    course = TrainingCourse(company_id=uuid.UUID(company_id), **data.model_dump())
    db.add(course)
    await db.flush()
    return TrainingCourseResponse.model_validate(course).model_dump()


# ── Modules ──────────────────────────────────────────────────────

async def add_module(db: AsyncSession, course_id: str, data: TrainingModuleCreate) -> dict:
    mod = TrainingModule(course_id=uuid.UUID(course_id), **data.model_dump())
    db.add(mod)
    await db.flush()
    return TrainingModuleResponse.model_validate(mod).model_dump()


# ── Assignments ──────────────────────────────────────────────────

async def assign_course(db: AsyncSession, company_id: str, data: TrainingAssignmentCreate) -> dict:
    assignment = TrainingAssignment(
        company_id=uuid.UUID(company_id),
        employee_id=uuid.UUID(data.employee_id),
        employee_name=data.employee_name,
        course_id=uuid.UUID(data.course_id),
        due_date=datetime.strptime(data.due_date, "%Y-%m-%d").date() if data.due_date else None,
        status="assigned",
    )
    db.add(assignment)
    await db.flush()

    # create module progress entries
    r = await db.execute(
        select(TrainingModule).where(TrainingModule.course_id == assignment.course_id).order_by(TrainingModule.order_index)
    )
    for mod in r.scalars().all():
        prog = TrainingModuleProgress(
            assignment_id=assignment.id,
            module_id=mod.id,
            status="pending",
        )
        db.add(prog)
    await db.flush()

    return TrainingAssignmentResponse.model_validate(assignment).model_dump()


async def bulk_assign(db: AsyncSession, company_id: str, employee_ids: list[str], course_id: str, due_date: Optional[str] = None) -> list[dict]:
    results = []
    for emp_id in employee_ids:
        data = TrainingAssignmentCreate(employee_id=emp_id, course_id=course_id, due_date=due_date)
        result = await assign_course(db, company_id, data)
        results.append(result)
    return results


async def list_assignments(
    db: AsyncSession, company_id: str, employee_id: Optional[str] = None,
    course_id: Optional[str] = None, status_filter: Optional[str] = None,
    limit: int = 100, offset: int = 0,
) -> list[dict]:
    q = select(
        TrainingAssignment,
        TrainingCourse.title.label("course_title"),
    ).join(
        TrainingCourse, TrainingCourse.id == TrainingAssignment.course_id
    ).where(
        TrainingAssignment.company_id == uuid.UUID(company_id),
    )

    if employee_id:
        q = q.where(TrainingAssignment.employee_id == uuid.UUID(employee_id))
    if course_id:
        q = q.where(TrainingAssignment.course_id == uuid.UUID(course_id))
    if status_filter:
        q = q.where(TrainingAssignment.status == status_filter)

    q = q.order_by(desc(TrainingAssignment.assigned_at)).limit(limit).offset(offset)
    r = await db.execute(q)
    results = []
    for assignment, course_title in r.all():
        d = TrainingAssignmentResponse.model_validate(assignment).model_dump()
        d["course_title"] = course_title
        results.append(d)
    return results


# ── Module Progress ──────────────────────────────────────────────

async def update_module_progress(
    db: AsyncSession, company_id: str, assignment_id: str, module_id: str, data: ModuleProgressUpdate,
) -> dict:
    r = await db.execute(
        select(TrainingAssignment).where(
            TrainingAssignment.id == uuid.UUID(assignment_id),
            TrainingAssignment.company_id == uuid.UUID(company_id),
        )
    )
    assignment = r.scalar_one_or_none()
    if not assignment:
        raise ValueError("Assignment not found")

    r2 = await db.execute(
        select(TrainingModuleProgress).where(
            TrainingModuleProgress.assignment_id == assignment.id,
            TrainingModuleProgress.module_id == uuid.UUID(module_id),
        )
    )
    prog = r2.scalar_one_or_none()
    if not prog:
        raise ValueError("Module progress not found")

    prog.status = data.status
    if data.score is not None:
        prog.score = data.score
    if data.max_score is not None:
        prog.max_score = data.max_score
    prog.attempts += 1
    if data.status == "completed":
        prog.completed_at = datetime.now(timezone.utc)

    await db.flush()

    # recalc overall progress
    r3 = await db.execute(
        select(
            sa_func.count(TrainingModuleProgress.id),
            sa_func.count().filter(TrainingModuleProgress.status == "completed"),
        ).where(TrainingModuleProgress.assignment_id == assignment.id)
    )
    total, completed = r3.one()
    assignment.progress_pct = round((completed / total) * 100, 1) if total > 0 else 0

    if assignment.progress_pct >= 100:
        assignment.status = "completed"
        assignment.completed_at = datetime.now(timezone.utc)
        # issue certificate
        await _issue_certificate(db, company_id, assignment.id)

    elif assignment.progress_pct > 0 and assignment.status == "assigned":
        assignment.status = "in_progress"
        assignment.started_at = assignment.started_at or datetime.now(timezone.utc)

    await db.flush()

    d = TrainingModuleProgressResponse.model_validate(prog).model_dump()
    r4 = await db.execute(
        select(TrainingModule.title).where(TrainingModule.id == prog.module_id)
    )
    mod_title = r4.scalar()
    d["module_title"] = mod_title
    return d


async def get_assignment_progress(db: AsyncSession, company_id: str, assignment_id: str) -> Optional[dict]:
    r = await db.execute(
        select(TrainingAssignment).where(
            TrainingAssignment.id == uuid.UUID(assignment_id),
            TrainingAssignment.company_id == uuid.UUID(company_id),
        )
    )
    assignment = r.scalar_one_or_none()
    if not assignment:
        return None

    r2 = await db.execute(
        select(TrainingModuleProgress, TrainingModule.title)
        .join(TrainingModule, TrainingModule.id == TrainingModuleProgress.module_id)
        .where(TrainingModuleProgress.assignment_id == assignment.id)
        .order_by(TrainingModule.order_index)
    )
    modules_progress = []
    for prog, title in r2.all():
        d = TrainingModuleProgressResponse.model_validate(prog).model_dump()
        d["module_title"] = title
        modules_progress.append(d)

    d = TrainingAssignmentResponse.model_validate(assignment).model_dump()
    d["modules_progress"] = modules_progress
    return d


# ── Certificates ─────────────────────────────────────────────────

async def _issue_certificate(db: AsyncSession, company_id: str, assignment_id: str):
    r = await db.execute(
        select(TrainingAssignment).where(TrainingAssignment.id == assignment_id)
    )
    assignment = r.scalar_one_or_none()
    if not assignment:
        return

    # calculate score as average of quiz scores
    r2 = await db.execute(
        select(
            sa_func.avg(TrainingModuleProgress.score),
        ).where(
            TrainingModuleProgress.assignment_id == assignment.id,
            TrainingModuleProgress.score.isnot(None),
        )
    )
    avg_score = r2.scalar()

    # expires in 1 year
    expires = date.today() + timedelta(days=365)

    cert = TrainingCertificate(
        company_id=uuid.UUID(company_id),
        employee_id=assignment.employee_id,
        employee_name=assignment.employee_name,
        course_id=assignment.course_id,
        assignment_id=assignment.id,
        score=round(avg_score, 1) if avg_score else None,
        expires_at=expires,
    )
    db.add(cert)
    await db.flush()


async def list_certificates(
    db: AsyncSession, company_id: str, employee_id: Optional[str] = None,
    is_valid: Optional[bool] = None, limit: int = 100,
) -> list[dict]:
    q = select(
        TrainingCertificate,
        TrainingCourse.title,
    ).join(
        TrainingCourse, TrainingCourse.id == TrainingCertificate.course_id
    ).where(
        TrainingCertificate.company_id == uuid.UUID(company_id),
    )

    if employee_id:
        q = q.where(TrainingCertificate.employee_id == uuid.UUID(employee_id))
    if is_valid is not None:
        q = q.where(TrainingCertificate.is_valid == is_valid)

    q = q.order_by(desc(TrainingCertificate.issued_at)).limit(limit)
    r = await db.execute(q)
    results = []
    for cert, course_title in r.all():
        d = TrainingCertificateResponse.model_validate(cert).model_dump()
        d["course_title"] = course_title
        results.append(d)
    return results


async def recertify(db: AsyncSession, company_id: str, certificate_id: str) -> Optional[dict]:
    r = await db.execute(
        select(TrainingCertificate).where(
            TrainingCertificate.id == uuid.UUID(certificate_id),
            TrainingCertificate.company_id == uuid.UUID(company_id),
        )
    )
    cert = r.scalar_one_or_none()
    if not cert:
        return None

    cert.recertified_at = datetime.now(timezone.utc)
    cert.expires_at = date.today() + timedelta(days=365)
    cert.is_valid = True
    await db.flush()
    d = TrainingCertificateResponse.model_validate(cert).model_dump()
    r2 = await db.execute(
        select(TrainingCourse.title).where(TrainingCourse.id == cert.course_id)
    )
    d["course_title"] = r2.scalar()
    return d


# ── Dashboard ────────────────────────────────────────────────────

async def get_dashboard(db: AsyncSession, company_id: str) -> dict:
    company_uuid = uuid.UUID(company_id)

    r = await db.execute(
        select(sa_func.count(TrainingCourse.id)).where(
            TrainingCourse.company_id == company_uuid, TrainingCourse.is_active == True,
        )
    )
    total_courses = r.scalar() or 0

    r = await db.execute(
        select(sa_func.count(TrainingAssignment.id)).where(
            TrainingAssignment.company_id == company_uuid,
        )
    )
    total_assignments = r.scalar() or 0

    r = await db.execute(
        select(sa_func.count(sa_func.distinct(TrainingCertificate.employee_id))).where(
            TrainingCertificate.company_id == company_uuid,
            TrainingCertificate.is_valid == True,
        )
    )
    certified_employees = r.scalar() or 0

    r = await db.execute(
        select(sa_func.count(sa_func.distinct(TrainingAssignment.employee_id))).where(
            TrainingAssignment.company_id == company_uuid,
            TrainingAssignment.status.in_(["assigned", "in_progress"]),
        )
    )
    pending_employees = r.scalar() or 0

    r = await db.execute(
        select(sa_func.coalesce(sa_func.avg(TrainingAssignment.progress_pct), 0)).where(
            TrainingAssignment.company_id == company_uuid,
        )
    )
    avg_progress = round(r.scalar() or 0, 1)

    # compliance by area (via course area or employee area)
    r = await db.execute(
        select(
            TrainingCourse.area,
            sa_func.count(sa_func.distinct(TrainingAssignment.employee_id)),
            sa_func.count(sa_func.distinct(TrainingAssignment.employee_id)).filter(
                TrainingAssignment.status == "completed"
            ),
        )
        .join(TrainingCourse, TrainingCourse.id == TrainingAssignment.course_id)
        .where(
            TrainingAssignment.company_id == company_uuid,
            TrainingCourse.area.isnot(None),
        )
        .group_by(TrainingCourse.area)
    )
    compliance_by_area = [
        {"area": row[0], "total": row[1], "completed": row[2],
         "pct": round((row[2] / row[1]) * 100, 1) if row[1] > 0 else 0}
        for row in r.all()
    ]

    # most assigned courses
    r = await db.execute(
        select(
            TrainingCourse.title,
            sa_func.count(TrainingAssignment.id).label("count"),
        )
        .join(TrainingAssignment, TrainingAssignment.course_id == TrainingCourse.id)
        .where(TrainingAssignment.company_id == company_uuid)
        .group_by(TrainingCourse.title)
        .order_by(desc("count"))
        .limit(5)
    )
    most_assigned = [{"title": row[0], "count": row[1]} for row in r.all()]

    r = await db.execute(
        select(TrainingCertificate, TrainingCourse.title)
        .join(TrainingCourse, TrainingCourse.id == TrainingCertificate.course_id)
        .where(TrainingCertificate.company_id == company_uuid)
        .order_by(desc(TrainingCertificate.issued_at))
        .limit(10)
    )
    recent_certs = []
    for cert, course_title in r.all():
        d = TrainingCertificateResponse.model_validate(cert).model_dump()
        d["course_title"] = course_title
        recent_certs.append(d)

    return TrainingDashboardResponse(
        total_courses=total_courses,
        total_assignments=total_assignments,
        certified_employees=certified_employees,
        pending_employees=pending_employees,
        avg_progress_pct=avg_progress,
        compliance_by_area=compliance_by_area,
        most_assigned_courses=most_assigned,
        recent_certificates=recent_certs,
    ).model_dump()
