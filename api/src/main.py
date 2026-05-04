"""InteliMarket API — FastAPI Application Entry Point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.src.config import settings

app = FastAPI(
    title="InteliMarket API",
    description="SaaS ERP para comercios y distribuidores en Paraguay",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "0.1.0"}


# TODO: Registrar routers por módulo
# from api.src.auth.router import router as auth_router
# app.include_router(auth_router, prefix="/api/v1/auth")
# ... etc
