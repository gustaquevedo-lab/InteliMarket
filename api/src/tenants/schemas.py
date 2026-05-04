"""Tenant schemas"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class TenantCreateRequest(BaseModel):
    nombre: str = Field(min_length=2, max_length=100)
    slug: str = Field(min_length=2, max_length=50, pattern=r"^[a-z0-9-]+$")
    plan: str = "starter"


class TenantResponse(BaseModel):
    id: UUID
    nombre: str
    slug: str
    plan: str
    schema_name: str
    estado: str
    fecha_inicio: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class UserTenantResponse(BaseModel):
    tenant_id: UUID
    tenant_nombre: str
    tenant_slug: str
    plan: str
    rol: str
