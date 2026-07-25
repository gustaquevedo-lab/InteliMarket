import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import ValidationError as PydanticValidationError
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from api.src.common.exceptions import AppError

logger = logging.getLogger("intelimarket")


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Global error handler — returns consistent JSON for all error types."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint):
        try:
            return await call_next(request)
        except AppError as exc:
            return self._json(exc.status_code, exc.code, exc.message, exc.details)
        except IntegrityError as exc:
            logger.warning("IntegrityError: %s", str(exc.orig)[:200])
            return self._json(409, "CONFLICT", "El recurso ya existe o tiene dependencias")
        except SQLAlchemyError as exc:
            logger.error("Database error: %s", str(exc)[:300])
            return self._json(500, "DATABASE_ERROR", "Error en la base de datos")
        except PydanticValidationError as exc:
            errors = exc.errors()
            return JSONResponse(status_code=422, content={
                "success": False,
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "Error de validación",
                    "details": {
                        "fields": [
                            {
                                "field": ".".join(str(loc) for loc in err.get("loc", [])),
                                "message": err.get("msg", ""),
                                "type": err.get("type", ""),
                            }
                            for err in errors
                        ]
                    },
                },
            })
        except Exception as exc:
            logger.exception("Unhandled exception: %s", str(exc)[:500])
            return self._json(500, "INTERNAL_ERROR", "Ocurrió un error interno")

    def _json(self, status: int, code: str, message: str, details: dict | None = None):
        return JSONResponse(status_code=status, content={
            "success": False,
            "error": {"code": code, "message": message, "details": details or {}},
        })


def register_exception_handlers(app: FastAPI) -> None:
    """Register the global error handling middleware."""
    app.add_middleware(ErrorHandlingMiddleware)
