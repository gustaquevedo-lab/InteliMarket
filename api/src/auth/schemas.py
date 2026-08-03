"""Auth request/response schemas"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class LoginCedulaRequest(BaseModel):
    """Login para vendedores/supervisores/gerente del modulo de metas: no
    tienen email real, usan cedula como usuario y contraseña (pedido
    explicito del cliente, mas practico para gente de calle con celular)."""
    cedula: str = Field(min_length=4, max_length=20)
    password: str = Field(min_length=4)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    nombre: str = Field(min_length=2, max_length=100)
    tenant_nombre: str = Field(min_length=2, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class UserResponse(BaseModel):
    id: UUID
    email: str
    nombre: str
    telefono: Optional[str] = None
    rol: str
    activo: bool
    tenant_id: Optional[str] = None
    tenant_slug: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
