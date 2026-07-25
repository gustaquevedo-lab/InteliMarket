import os
import subprocess
import tempfile
import gzip
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.backups.models import Backup


BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "/tmp/intelimarket-backups"))
BACKUP_RETENTION_DAYS = int(os.getenv("BACKUP_RETENTION_DAYS", "30"))
PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = os.getenv("PG_PORT", "5432")
PG_USER = os.getenv("PG_USER", "postgres")
PG_PASSWORD = os.getenv("PG_PASSWORD", "")
PG_DB = os.getenv("PG_DB", "intelimarket")


BACKUP_DIR.mkdir(parents=True, exist_ok=True)


def _build_pg_env() -> dict:
    env = os.environ.copy()
    env["PGPASSWORD"] = PG_PASSWORD
    return env


def _build_pg_args(db_name: str) -> list:
    return [
        "-h", PG_HOST,
        "-p", PG_PORT,
        "-U", PG_USER,
        "-d", db_name,
    ]


async def create_backup(
    db: AsyncSession,
    schema_name: str,
    tenant_id: Optional[str] = None,
    tenant_slug: Optional[str] = None,
    backup_type: str = "manual",
    notes: Optional[str] = None,
) -> Backup:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{schema_name}_{timestamp}.sql.gz"
    filepath = BACKUP_DIR / filename

    backup_record = Backup(
        tenant_id=tenant_id,
        tenant_slug=tenant_slug,
        schema_name=schema_name,
        filename=filename,
        file_size=0,
        status="pending",
        backup_type=backup_type,
        notes=notes,
        expires_at=datetime.now() + timedelta(days=BACKUP_RETENTION_DAYS),
    )
    db.add(backup_record)
    await db.commit()
    await db.refresh(backup_record)

    try:
        with tempfile.NamedTemporaryFile(suffix=".sql", delete=False) as tmp:
            tmp_path = tmp.name

        env = _build_pg_env()
        pg_args = ["pg_dump", "--schema", schema_name] + _build_pg_args(PG_DB)

        result = subprocess.run(
            pg_args,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode != 0:
            raise Exception(f"pg_dump failed: {result.stderr}")

        with open(tmp_path, "w") as f:
            f.write(result.stdout)

        with open(tmp_path, "rb") as f_in:
            with gzip.open(filepath, "wb") as f_out:
                shutil.copyfileobj(f_in, f_out)

        file_size = filepath.stat().st_size

        backup_record.status = "completed"
        backup_record.file_size = file_size
        backup_record.completed_at = datetime.now()

        os.unlink(tmp_path)

    except Exception as e:
        backup_record.status = "failed"
        backup_record.notes = str(e)
        if filepath.exists():
            filepath.unlink()

    await db.commit()
    await db.refresh(backup_record)
    return backup_record


async def list_backups(
    db: AsyncSession,
    tenant_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> list:
    query = select(Backup).order_by(Backup.created_at.desc()).limit(limit).offset(offset)
    if tenant_id:
        query = query.where(Backup.tenant_id == tenant_id)
    result = await db.execute(query)
    return result.scalars().all()


async def get_backup(db: AsyncSession, backup_id: str) -> Optional[Backup]:
    import uuid
    try:
        bid = uuid.UUID(backup_id)
    except ValueError:
        return None
    result = await db.execute(select(Backup).where(Backup.id == bid))
    return result.scalar_one_or_none()


async def delete_backup(db: AsyncSession, backup_id: str) -> bool:
    import uuid
    try:
        bid = uuid.UUID(backup_id)
    except ValueError:
        return False
    result = await db.execute(select(Backup).where(Backup.id == bid))
    backup = result.scalar_one_or_none()
    if not backup:
        return False

    filepath = BACKUP_DIR / backup.filename
    if filepath.exists():
        filepath.unlink()

    await db.delete(backup)
    await db.commit()
    return True


async def cleanup_expired(db: AsyncSession) -> int:
    result = await db.execute(
        select(Backup).where(Backup.expires_at < datetime.now())
    )
    expired = result.scalars().all()
    count = 0
    for backup in expired:
        filepath = BACKUP_DIR / backup.filename
        if filepath.exists():
            filepath.unlink()
        await db.delete(backup)
        count += 1
    if count > 0:
        await db.commit()
    return count
