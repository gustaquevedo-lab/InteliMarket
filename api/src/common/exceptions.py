class AppError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class NotFoundError(AppError):
    def __init__(self, entity: str, id: str | None = None):
        msg = f"{entity} no encontrado"
        if id:
            msg += f" ({id})"
        super().__init__(code="NOT_FOUND", message=msg, status_code=404)


class ConflictError(AppError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(code="CONFLICT", message=message, status_code=409, details=details)


class ForbiddenError(AppError):
    def __init__(self, message: str = "Acceso denegado"):
        super().__init__(code="FORBIDDEN", message=message, status_code=403)


class ValidationError_(AppError):
    def __init__(self, message: str, details: dict | None = None):
        super().__init__(code="VALIDATION_ERROR", message=message, status_code=422, details=details)


class FeatureDisabledError(AppError):
    def __init__(self, feature: str):
        super().__init__(
            code="FEATURE_DISABLED",
            message=f"El módulo '{feature}' no está habilitado para este tenant",
            status_code=403,
            details={"feature": feature},
        )
