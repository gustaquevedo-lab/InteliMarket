from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.src.db import get_db
from api.src.auth.middleware import require_auth
from api.src.backups import service
from api.src.backups.models import Backup, BackupScheduleConfig

router = APIRouter(prefix="/api/v1/backups", tags=["backups"], dependencies=[Depends(require_auth)])


@router.post("/create")
async def create_backup(
    schema_name: str = Query(..., description="Schema name to backup"),
    tenant_id: str | None = Query(None),
    tenant_slug: str | None = Query(None),
    notes: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    backup = await service.create_backup(db, schema_name, tenant_id, tenant_slug, notes=notes)
    return {
        "id": str(backup.id),
        "status": backup.status,
        "filename": backup.filename,
        "file_size": backup.file_size,
        "created_at": backup.created_at.isoformat() if backup.created_at else None,
    }


@router.get("/")
async def list_backups(
    tenant_id: str | None = Query(None),
    limit: int = Query(50, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    backups = await service.list_backups(db, tenant_id, limit, offset)
    return [
        {
            "id": str(b.id),
            "tenant_slug": b.tenant_slug,
            "schema_name": b.schema_name,
            "filename": b.filename,
            "file_size": b.file_size,
            "status": b.status,
            "backup_type": b.backup_type,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "expires_at": b.expires_at.isoformat() if b.expires_at else None,
        }
        for b in backups
    ]


@router.get("/{backup_id}/download")
async def download_backup(
    backup_id: str,
    db: AsyncSession = Depends(get_db),
):
    backup = await service.get_backup(db, backup_id)
    if not backup:
        raise HTTPException(status_code=404, detail="Backup no encontrado")
    if backup.status != "completed":
        raise HTTPException(status_code=400, detail="Backup no completado")

    filepath = service.BACKUP_DIR / backup.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="Archivo de backup no encontrado")

    return FileResponse(
        path=str(filepath),
        filename=backup.filename,
        media_type="application/gzip",
    )


@router.delete("/{backup_id}")
async def delete_backup(
    backup_id: str,
    db: AsyncSession = Depends(get_db),
):
    deleted = await service.delete_backup(db, backup_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Backup no encontrado")
    return {"status": "deleted"}


@router.post("/cleanup")
async def cleanup_expired(db: AsyncSession = Depends(get_db)):
    count = await service.cleanup_expired(db)
    return {"deleted": count, "message": f"{count} backups expirados eliminados"}


@router.get("/schedule")
async def get_schedule(
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(BackupScheduleConfig)
    if tenant_id:
        query = query.where(BackupScheduleConfig.tenant_id == tenant_id)
    else:
        query = query.where(BackupScheduleConfig.tenant_id.is_(None))

    result = await db.execute(query)
    config = result.scalar_one_or_none()

    if not config:
        return {
            "enabled": True,
            "frequency": "daily",
            "hour": 2,
            "minute": 0,
            "day_of_week": None,
            "day_of_month": None,
            "retention_days": 30,
            "max_backups": None,
        }

    return {
        "id": str(config.id),
        "tenant_id": str(config.tenant_id) if config.tenant_id else None,
        "enabled": config.enabled,
        "frequency": config.frequency,
        "hour": config.hour,
        "minute": config.minute,
        "day_of_week": config.day_of_week,
        "day_of_month": config.day_of_month,
        "retention_days": config.retention_days,
        "max_backups": config.max_backups,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }


@router.put("/schedule")
async def update_schedule(
    body: dict,
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    query = select(BackupScheduleConfig)
    if tenant_id:
        query = query.where(BackupScheduleConfig.tenant_id == tenant_id)
    else:
        query = query.where(BackupScheduleConfig.tenant_id.is_(None))

    result = await db.execute(query)
    config = result.scalar_one_or_none()

    if config:
        config.enabled = body.get("enabled", config.enabled)
        config.frequency = body.get("frequency", config.frequency)
        config.hour = body.get("hour", config.hour)
        config.minute = body.get("minute", config.minute)
        config.day_of_week = body.get("day_of_week", config.day_of_week)
        config.day_of_month = body.get("day_of_month", config.day_of_month)
        config.retention_days = body.get("retention_days", config.retention_days)
        config.max_backups = body.get("max_backups", config.max_backups)
    else:
        config = BackupScheduleConfig(
            tenant_id=tenant_id,
            enabled=body.get("enabled", True),
            frequency=body.get("frequency", "daily"),
            hour=body.get("hour", 2),
            minute=body.get("minute", 0),
            day_of_week=body.get("day_of_week"),
            day_of_month=body.get("day_of_month"),
            retention_days=body.get("retention_days", 30),
            max_backups=body.get("max_backups"),
        )
        db.add(config)

    await db.commit()
    await db.refresh(config)

    return {
        "id": str(config.id),
        "enabled": config.enabled,
        "frequency": config.frequency,
        "hour": config.hour,
        "minute": config.minute,
        "day_of_week": config.day_of_week,
        "day_of_month": config.day_of_month,
        "retention_days": config.retention_days,
        "max_backups": config.max_backups,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
    }
