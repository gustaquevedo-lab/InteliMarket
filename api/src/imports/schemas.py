"""Import schemas"""

from pydantic import BaseModel
from typing import Optional


class ImportRow(BaseModel):
    row: int
    status: str  # success, error, warning
    message: str
    data: Optional[dict] = None


class ImportResult(BaseModel):
    total_rows: int
    success: int
    errors: int
    warnings: int
    details: list[ImportRow]


class ImportPreview(BaseModel):
    headers: list[str]
    rows: list[dict]
    total_rows: int
