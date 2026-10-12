from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from uuid import UUID


class TriggerRunRequest(BaseModel):
    company_id: UUID


class FinanceRecommendationResponse(BaseModel):
    id: str
    company_id: Optional[str] = None
    run_id: Optional[str] = None
    tipo: str
    titulo: str
    descripcion: str
    entidad_relacionada: Optional[str] = None
    monto_relacionado: Optional[str] = None
    requested_by: Optional[str] = None
    approved_by: Optional[str] = None
    status: str
    comments: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

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
    
    # Pasivo Comercial y Deuda Real Consolidada
    deuda_total_exigible_gs: float = 0.0
    deuda_exigible_inmediata_gs: float = 0.0
    deuda_cheques_emitidos_total_gs: float = 0.0
    deuda_cheques_en_fecha_cobro_gs: float = 0.0
    deuda_cheques_proximos_30d_gs: float = 0.0
    deuda_cheques_count: int = 0
    deuda_facturas_proveedores_total_gs: float = 0.0
    deuda_facturas_vencidas_mora_gs: float = 0.0
    deuda_facturas_proximos_30d_gs: float = 0.0
    deuda_facturas_count: int = 0
    posicion_financiera_neta_gs: float = 0.0
    deficit_cobertura_inmediata_gs: float = 0.0
    ratio_cobertura_inmediata: float = 0.0
    
    # Cuentas por Pagar (Proveedores) - Retrocompatibilidad
    ap_proximos_7d_gs: float = 0.0
    ap_proximos_15d_gs: float = 0.0
    ap_total_mes_gs: float = 0.0
    ap_facturas_pendientes_count: int = 0
    
    # Cuentas por Cobrar (Clientes)
    ar_vigente_gs: float = 0.0
    ar_moroso_gs: float = 0.0
    ar_total_gs: float = 0.0
    ar_clientes_morosos_count: int = 0
    
    # Indicadores de Salud Financiera
    cash_runway_dias: float = 0.0
    cobertura_7d_ratio: float = 0.0
    estado_liquidez: str = "critico"  # "optimo" | "precaucion" | "critico"
    gastos_operativos_mes_gs: float = 0.0
    margen_bruto_mes_pct: float = 0.0
    ebitda_estimado_mes_gs: float = 0.0

    # Aliases para compatibilidad con la UI
    dias_cobertura_operativa: Optional[float] = None
    ratio_solvencia_7d: Optional[float] = None


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
    # Detalle de obligaciones y rubros reales
    cheques_dia_gs: float = 0.0
    facturas_dia_gs: float = 0.0
    reposicion_mercaderia_gs: float = 0.0
    gastos_operativos_dia_gs: float = 0.0
    ventas_dia_gs: float = 0.0
    cobranzas_dia_gs: float = 0.0
    deficit_brecha_gs: float = 0.0


class CashFlowForecastResponse(BaseModel):
    saldo_actual_gs: float
    total_ingresos_30d_gs: float
    total_egresos_30d_gs: float
    saldo_proyectado_30d_gs: float
    dias_en_riesgo_count: int
    proyeccion_diaria: List[CashFlowDayForecast]
    # Resumen de pasivos y déficit
    pasivo_exigible_inmediato_gs: float = 0.0
    total_cheques_30d_gs: float = 0.0
    total_facturas_30d_gs: float = 0.0
    deuda_total_comprometida_gs: float = 0.0
    posicion_neta_inicial_gs: float = 0.0
    estado_general_flujo: str = "deficit"


class FinanceBusinessRuleCreate(BaseModel):
    company_id: UUID
    regla: str
    categoria: Optional[str] = 'financiera'
    origen: Optional[str] = 'usuario_manual'


class FinanceBusinessRuleResponse(BaseModel):
    id: UUID
    regla: str
    categoria: str
    origen: str
    activa: bool
    confianza: float
    created_at: Optional[datetime] = None


class FinanceChatRequest(BaseModel):
    company_id: UUID
    message: str
    conversation_history: Optional[List[Dict[str, Any]]] = None
    attachment_name: Optional[str] = None
    attachment_type: Optional[str] = None
    attachment_data: Optional[str] = None


class FinanceChatResponse(BaseModel):
    response: str
    suggestions: List[str]
    action_proposal: Optional[Dict[str, Any]] = None
    tools_executed: Optional[List[Dict[str, Any]]] = None
    provider_used: Optional[str] = None


class FinanceAgentSettingResponse(BaseModel):
    id: UUID
    company_id: UUID
    colchon_minimo_bancos_gs: float
    dias_alerta_mora: int
    limite_pago_diario_sin_autorizacion_gs: float
    prioridad_pagos: Dict[str, Any]
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FinanceAgentSettingUpdate(BaseModel):
    colchon_minimo_bancos_gs: Optional[float] = None
    dias_alerta_mora: Optional[int] = None
    limite_pago_diario_sin_autorizacion_gs: Optional[float] = None
    prioridad_pagos: Optional[Dict[str, Any]] = None


class InterAgentDirectiveCreate(BaseModel):
    receptor: str = "sales_agent"
    titulo: str
    mensaje: str
    accion_sugerida: Optional[str] = None
    prioridad: str = "alta"
    payload: Optional[Dict[str, Any]] = None
    impacto_estimado_gs: Optional[float] = 0.0


class InterAgentDirectiveResponse(BaseModel):
    id: UUID
    company_id: UUID
    codigo: str
    emisor: str
    receptor: str
    titulo: str
    mensaje: str
    accion_sugerida: Optional[str] = None
    prioridad: str
    estado: str
    payload: Dict[str, Any]
    impacto_estimado_gs: float
    impacto_real_recaudado_gs: float
    feedback_receptor: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class InterAgentDirectiveUpdateStatus(BaseModel):
    estado: str
    feedback: Optional[str] = None
    impacto_real_gs: Optional[float] = None


class CashFlowSimulationRequest(BaseModel):
    variacion_ventas_pct: float = 0.0  # Ej: -10.0 a +15.0
    prorroga_proveedores_dias: int = 0  # Ej: 7 dias de prorroga en pagos
    recuperacion_mora_pct: float = 0.0  # Ej: 30% cobro de cartera vencida
    meta_liquidacion_sobrestock_gs: float = 0.0  # Ej: 35.000.000


class CashFlowSimulationResponse(BaseModel):
    saldo_actual_gs: float
    saldo_proyectado_30d_base_gs: float
    saldo_proyectado_30d_simulado_gs: float
    impacto_neto_gs: float
    dias_en_riesgo_base: int
    dias_en_riesgo_simulado: int
    proyeccion_simulada: List[CashFlowDayForecast]
    conclusion_cfo: str

