"""Auth request/response schemas"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1)


class VerifySupervisorRequest(BaseModel):
    email: str
    password: str



class VerifySupervisorResponse(BaseModel):
    valid: bool
    id: Optional[str] = None
    nombre: Optional[str] = None
    rol: Optional[str] = None


class SetPosPinRequest(BaseModel):
    # 4-6 digitos numericos -- corto a proposito, se tipea muchas veces por
    # turno en caja. No es la contrasena real de login.
    pin: str = Field(min_length=4, max_length=6, pattern=r"^\d{4,6}$")


class PosSupervisorPin(BaseModel):
    id: str
    nombre: str
    rol: str
    pin_hash: str


class PosSupervisorPinsResponse(BaseModel):
    supervisors: list[PosSupervisorPin]


class LoginCedulaRequest(BaseModel):
    """Login para vendedores/supervisores/gerente del modulo de metas: no
    tienen email real, usan cedula como usuario y contraseña (pedido
    explicito del cliente, mas practico para gente de calle con celular)."""
    cedula: str = Field(min_length=4, max_length=20)
    password: str = Field(min_length=4)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=3)
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
    foto_url: Optional[str] = None
    tenant_id: Optional[str] = None
    tenant_slug: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=1)


class ResetPasswordRequest(BaseModel):
    new_password: Optional[str] = Field(default=None, min_length=1)


class ResetPasswordResponse(BaseModel):
    temporary_password: Optional[str] = None
    message: str


class AdminCreateUserRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = Field(default=None, min_length=1)
    nombre: str = Field(min_length=2, max_length=100)
    telefono: Optional[str] = None
    rol: str = "operador"
    foto_url: Optional[str] = None
    role_id: Optional[UUID] = None


class AdminCreateUserResponse(BaseModel):
    id: UUID
    email: str
    nombre: str
    rol: str
    temporary_password: Optional[str] = None


class UpdateUserRequest(BaseModel):
    nombre: Optional[str] = None
    telefono: Optional[str] = None
    rol: Optional[str] = None
    activo: Optional[bool] = None
    foto_url: Optional[str] = None


class TenantUserResponse(BaseModel):
    id: UUID
    email: str
    nombre: str
    telefono: Optional[str] = None
    rol: str
    activo: bool
    foto_url: Optional[str] = None
    is_superadmin: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    tenant_rol: str
    role_names: list[str] = []


class PosStaffItem(BaseModel):
    id: str
    email: str
    nombre: str
    rol: str
    foto_url: Optional[str] = None
    en_turno: bool


class PosStaffListResponse(BaseModel):
    staff: list[PosStaffItem]


class ActiveSupervisorResponse(BaseModel):
    has_supervisor: bool
    nombre: Optional[str] = None
