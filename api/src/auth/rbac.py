"""Role-based access control.

No existia ningun mecanismo de autorizacion por rol en la app — require_auth
solo valida que el JWT sea valido. UserTenant.rol existe en el modelo pero
esta vacio para el tenant real de Casa Gonzalito (confirmado: el usuario
admin no tiene fila en user_tenants), asi que la fuente de verdad de rol
es el claim "rol" del JWT (users.rol), que si se popula siempre en login.
"""

from fastapi import Depends, HTTPException, status

from api.src.auth.middleware import require_auth


def require_role(*roles: str):
    """FastAPI dependency: 403 si el rol del usuario autenticado no esta en `roles`.
    is_superadmin siempre pasa, sin importar los roles pedidos."""

    async def _check_role(user: dict = Depends(require_auth)) -> dict:
        user_rol = user.get("rol")
        # Mismo criterio que /auth/login: super_admin es equivalente a is_superadmin
        # aunque el token no traiga el claim explicito (ej. tokens generados a mano).
        if user.get("is_superadmin") or user_rol == "super_admin":
            return user
        if user_rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Rol '{user_rol}' no autorizado para esta accion. Requiere: {', '.join(roles)}",
            )
        return user

    return _check_role
