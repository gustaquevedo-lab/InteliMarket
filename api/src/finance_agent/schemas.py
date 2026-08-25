from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID


class TriggerRunRequest(BaseModel):
    company_id: UUID


class FinanceRecommendationResponse(BaseModel):
    id: UUID
    company_id: UUID
    run_id: UUID
    tipo: str
    titulo: str
    descripcion: str
    entidad_relacionada: Optional[str] = None
    monto_relacionado: Optional[str] = None
    requested_by: str
    approved_by: Optional[UUID] = None
    status: str
    comments: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FinanceAgentRunResponse(BaseModel):
    id: UUID
    company_id: UUID
    started_at: datetime
    finished_at: Optional[datetime] = None
    model: Optional[str] = None
    status: str
    diagnostico: Optional[str] = None
    error_message: Optional[str] = None

    class Config:
        from_attributes = True


class DecisionRequest(BaseModel):
    approved_by: UUID
    comments: Optional[str] = None


class BulkDecisionRequest(BaseModel):
    ids: list[UUID]
    approved_by: UUID
    comments: Optional[str] = None


# ── Nuevos Schemas para la Torre de Control y Enlace Inter-Agente ─────────────

class BankBalanceItem(BaseModel):
    banco: str
    numero_cuenta: Optional[str] = None
    saldo_gs: float
    moneda: str = "PYG"


class LiquidityControlTower(BaseModel):
    liquidez_total_gs: float
    bancos_total_gs: float
    boveda_central_gs: float
    cajas_pos_gs: float
    desglose_bancos: List[BankBalanceItem]
    
    # Cuentas por Pagar (Proveedores)
    ap_proximos_7d_gs: float
    ap_proximos_15d_gs: float
    ap_total_mes_gs: float
    ap_facturas_pendientes_count: int
    
    # Cuentas por Cobrar (Clientes)
    ar_vigente_gs: float
    ar_moroso_gs: float
    ar_total_gs: float
    ar_clientes_morosos_count: int
    
    # Indicadores de Salud Financiera
    cash_runway_dias: float
    cobertura_7d_ratio: float
    estado_liquidez: str  # "optimo" | "precaucion" | "critico"
    gastos_operativos_mes_gs: float
    margen_bruto_mes_pct: float
    ebitda_estimado_mes_gs: float


class OverstockFlashOpportunity(BaseModel):
    product_id: str
    producto: str
    stock_actual: float
    dias_sin_rotacion: int
    monto_inmovilizado_gs: float
    descuento_sugerido_pct: float
    recaudacion_estimada_gs: float


class CreditRiskAlert(BaseModel):
    customer_id: str
    cliente: str
    limite_credito: float
    deuda_actual: float
    dias_mora_max: int
    accion_sugerida: str


class InterAgentSyncResponse(BaseModel):
    estado_enlace: str
    timestamp: datetime
    cfo_summary: str
    
    # Directivas enviadas al Gerente de Ventas
    directivas_a_ventas: List[Dict[str, Any]]
    oportunidades_flash_stock: List[OverstockFlashOpportunity]
    alertas_riesgo_crediticio: List[CreditRiskAlert]
    meta_margen_minimo_exigido_pct: float
    
    # Proyecciones recibidas del Gerente de Ventas
    ventas_proyectadas_fin_semana_gs: float
    ventas_proyectadas_cierre_mes_gs: float


class CashFlowDayForecast(BaseModel):
    fecha: str
    dia_semana: str
    saldo_inicial_estimado: float
    ingresos_esperados: float
    egresos_comprometidos: float
    saldo_final_estimado: float
    estado: str  # "superavit" | "ajustado" | "deficit"


class CashFlowForecastResponse(BaseModel):
    saldo_actual_gs: float
    total_ingresos_30d_gs: float
    total_egresos_30d_gs: float
    saldo_proyectado_30d_gs: float
    dias_en_riesgo_count: int
    proyeccion_diaria: List[CashFlowDayForecast]


class FinanceChatRequest(BaseModel):
    company_id: UUID
    message: str
    conversation_history: Optional[List[Dict[str, str]]] = None


class FinanceChatResponse(BaseModel):
    response: str
    suggestions: List[str]
    action_proposal: Optional[Dict[str, Any]] = None
