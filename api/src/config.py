"""Configuration settings for InteliMarket API"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "InteliMarket"
    app_env: str = "development"
    app_debug: bool = True
    app_secret_key: str = "dev-secret-key-change-in-production"

    # Database
    database_url: str = "postgresql+asyncpg://intelimarket:intelimarket_dev@localhost:5432/intelimarket"
    db_pool_size: int = 20
    db_max_overflow: int = 10

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # JWT
    jwt_secret_key: str = "dev-jwt-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 60 * 24 * 7  # 7 días para ERP operativo
    jwt_refresh_token_expire_days: int = 30

    # SIFEN
    sifen_api_url: str = "https://ekuatia.set.gov.py/ekuatia/api"
    sifen_env: str = "pruebas"
    sifen_cert_path: str = ""
    sifen_cert_password: str = ""

    # Pasarelas
    pagopar_api_key: str = ""
    pagopar_secret_key: str = ""
    pagopar_env: str = "sandbox"

    kuapay_api_key: str = ""
    kuapay_secret_key: str = ""
    kuapay_env: str = "sandbox"

    # BCP
    bcp_api_url: str = "https://www.bcp.gov.py/web_services/api/tipo-cambio-referencial"

    # Intelicont
    intelicont_webhook_url: str = ""
    intelicont_api_key: str = ""
    intelicont_hmac_secret: str = ""

    # InteliAudit
    inteliaudit_webhook_url: str = ""
    inteliaudit_api_key: str = ""
    inteliaudit_hmac_secret: str = ""

    # SueldOK
    sueldok_api_url: str = "https://api.sueldok.com"
    sueldok_api_key: str = ""

    # AI / LLM
    gemini_api_key: str = ""
    anthropic_api_key: str = ""

    # Conector Ñemuha (ConceptoComercial/FlexPDV) — legacy MySQL del cliente, vía VM puente
    nemuha_mysql_host: str = ""
    nemuha_mysql_port: int = 3306
    nemuha_mysql_user: str = ""
    nemuha_mysql_password: str = ""
    nemuha_mysql_database: str = ""

    # Email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@intelimarket.py"

    # Logging
    log_level: str = "INFO"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = [".env", "/home/intellihouse/intelimarket/.env", "../.env"]
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
