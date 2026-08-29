from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

from api.src.pos_terminals.models import PosTerminalAssignment
from api.src.pos_terminals.schemas import PosTerminalAssignmentCreate, PosTerminalAssignmentUpdate


async def list_assignments(db: AsyncSession, company_id: str) -> list[dict]:
    result = await db.execute(
        select(PosTerminalAssignment).where(PosTerminalAssignment.company_id == company_id).order_by(PosTerminalAssignment.punto_emision)
    )
    assignments = list(result.scalars().all())

    # Cargar secuencias fiscales de Factura y Nota de Crédito usando SQL directo
    seq_result = await db.execute(
        text("""
            SELECT punto_emision, LOWER(tipo_documento) as tipo, numero_actual, numero_final, activo
            FROM punto_emision_secuencias
            WHERE company_id = :company_id AND activo = true
        """),
        {"company_id": company_id}
    )
    all_seqs = seq_result.fetchall()

    # Mapear secuencias por punto de emisión
    seqs_by_punto: dict[str, dict] = {}
    for s in all_seqs:
        p = str(s[0]).zfill(3) if s[0] else ""
        tipo = str(s[1]).lower()
        if p not in seqs_by_punto:
            seqs_by_punto[p] = {}
        seqs_by_punto[p][tipo] = {
            "numero_actual": s[2],
            "numero_final": s[3],
            "activo": s[4]
        }

    enriched = []
    for a in assignments:
        p = a.punto_emision.zfill(3) if a.punto_emision else ""
        p_seqs = seqs_by_punto.get(p, {})
        factura_seq = p_seqs.get("factura")
        nc_seq = p_seqs.get("nota_credito")

        enriched.append({
            "id": a.id,
            "hostname": a.hostname,
            "ip_address": a.ip_address,
            "punto_emision": a.punto_emision,
            "caja_nombre": a.caja_nombre,
            "activo": a.activo,
            "factura_actual": factura_seq["numero_actual"] if factura_seq else None,
            "factura_final": factura_seq["numero_final"] if factura_seq else None,
            "nc_actual": nc_seq["numero_actual"] if nc_seq else None,
            "nc_final": nc_seq["numero_final"] if nc_seq else None,
            "tiene_factura": bool(factura_seq),
            "tiene_nc": bool(nc_seq),
            "created_at": a.created_at,
            "updated_at": a.updated_at,
        })

    return enriched


async def get_by_hostname(db: AsyncSession, company_id: str, hostname: str) -> PosTerminalAssignment | None:
    clean_host = hostname.strip().upper()
    result = await db.execute(
        select(PosTerminalAssignment).where(
            PosTerminalAssignment.company_id == company_id,
            PosTerminalAssignment.hostname == clean_host,
            PosTerminalAssignment.activo == True,
        )
    )
    return result.scalar_one_or_none()


async def get_by_ip(db: AsyncSession, company_id: str, ip_address: str) -> PosTerminalAssignment | None:
    clean_ip = ip_address.strip()
    result = await db.execute(
        select(PosTerminalAssignment).where(
            PosTerminalAssignment.company_id == company_id,
            PosTerminalAssignment.ip_address == clean_ip,
            PosTerminalAssignment.activo == True,
        )
    )
    return result.scalar_one_or_none()


async def detect_terminal(db: AsyncSession, company_id: str, client_ip: str | None, hostname: str | None = None) -> PosTerminalAssignment | None:
    """Busca la caja asignada primero por IP fija y luego por Hostname."""
    if client_ip:
        by_ip = await get_by_ip(db, company_id, client_ip)
        if by_ip:
            return by_ip
    if hostname:
        by_host = await get_by_hostname(db, company_id, hostname)
        if by_host:
            return by_host
    return None


async def create_assignment(db: AsyncSession, company_id: str, data: PosTerminalAssignmentCreate) -> PosTerminalAssignment:
    clean_host = data.hostname.strip().upper()
    clean_ip = data.ip_address.strip() if data.ip_address else None

    existing_host = await db.execute(
        select(PosTerminalAssignment).where(PosTerminalAssignment.hostname == clean_host)
    )
    if existing_host.scalar_one_or_none():
        raise ValueError(f"El hostname '{clean_host}' ya tiene una caja asignada")

    if clean_ip:
        existing_ip = await db.execute(
            select(PosTerminalAssignment).where(PosTerminalAssignment.ip_address == clean_ip)
        )
        if existing_ip.scalar_one_or_none():
            raise ValueError(f"La IP '{clean_ip}' ya está asignada a otra caja")

    assignment = PosTerminalAssignment(
        company_id=company_id,
        hostname=clean_host,
        ip_address=clean_ip,
        punto_emision=data.punto_emision.strip(),
        caja_nombre=data.caja_nombre.strip(),
    )
    db.add(assignment)
    await db.flush()
    await db.refresh(assignment)
    return assignment


async def update_assignment(db: AsyncSession, assignment_id: str, data: PosTerminalAssignmentUpdate) -> PosTerminalAssignment | None:
    result = await db.execute(select(PosTerminalAssignment).where(PosTerminalAssignment.id == uuid.UUID(assignment_id)))
    assignment = result.scalar_one_or_none()
    if not assignment:
        return None
    if data.hostname is not None:
        assignment.hostname = data.hostname.strip().upper()
    if data.ip_address is not None:
        assignment.ip_address = data.ip_address.strip() if data.ip_address.strip() else None
    if data.punto_emision is not None:
        assignment.punto_emision = data.punto_emision.strip()
    if data.caja_nombre is not None:
        assignment.caja_nombre = data.caja_nombre.strip()
    if data.activo is not None:
        assignment.activo = data.activo
    await db.flush()
    await db.refresh(assignment)
    return assignment


async def delete_assignment(db: AsyncSession, assignment_id: str) -> bool:
    result = await db.execute(select(PosTerminalAssignment).where(PosTerminalAssignment.id == uuid.UUID(assignment_id)))
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False
    await db.delete(assignment)
    await db.flush()
    return True
