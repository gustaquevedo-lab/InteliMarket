"""InteliMarket API — FastAPI Application Entry Point"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.src.config import settings
from api.src.auth.router import router as auth_router
from api.src.tenants.router import router as tenants_router
from api.src.companies.router import router as companies_router
from api.src.products.router import router as products_router
from api.src.inventory.router import router as inventory_router
from api.src.sales.router import router as sales_router
from api.src.customers.router import router as customers_router
from api.src.sifen.router import router as sifen_router

app = FastAPI(
    title="InteliMarket API",
    description="SaaS ERP para comercios y distribuidores en Paraguay",
    version="0.1.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

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


app.include_router(auth_router)
app.include_router(tenants_router)
app.include_router(companies_router)
app.include_router(products_router)
app.include_router(inventory_router)
app.include_router(sales_router)
app.include_router(customers_router)
app.include_router(sifen_router)
