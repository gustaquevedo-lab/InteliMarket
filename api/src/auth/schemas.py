"""Auth request/response schemas"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    nombre: str = Field(min_length=2, max_length=100)
    tenant_nombre: str = Field(min_length=2, max_length=100)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: UUID
    email: str
    nombre: str
    telefono: Optional[str] = None
    rol: str
    activo: bool
    created_at: datetime

    class Config:
        from_attributes = True
