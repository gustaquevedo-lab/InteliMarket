"""Gateway angosto para exponer SOLO /api/v1/inteliforce/* al exterior
(via tunel), sin exponer el resto de la API de Intelimarket. Proceso
Python separado del backend principal (que sigue escuchando solo en
localhost:8000) — misma base de datos, mismo codigo del router, pero
ningun otro endpoint del sistema queda alcanzable desde afuera."""

from fastapi import FastAPI

from api.src.inteliforce.router import router as inteliforce_router

app = FastAPI(title="Intelimarket Inteliforce Gateway", docs_url=None, redoc_url=None, openapi_url=None)
app.include_router(inteliforce_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "inteliforce-gateway"}
