"""Fase 2 — Schemas for DSD Receiving, Inventory, Replenishment, Returns & Backhaul"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================================
# DSD RECEIVING SCHEMAS
# ============================================================

class DsdScheduleCreate(BaseModel):
    proveedor_id: UUID
    numero_oc: str
    fecha_programada: date
    ventana_inicio: datetime
    ventana_fin: datetime
    muelle: Optional[str] = None
    tipo_carga: str = "seco"
    transportista: Optional[str] = None
    patente: Optional[str] = None
    conductor: Optional[str] = None
    conductor_telefono: Optional[str] = None
    total_bultos_estimado: Optional[int] = None
    total_peso_estimado_kg: Optional[Decimal] = None
    notas: Optional[str] = None

class DsdScheduleUpdate(BaseModel):
    fecha_programada: Optional[date] = None
    ventana_inicio: Optional[datetime] = None
    ventana_fin: Optional[datetime] = None
    muelle: Optional[str] = None
    transportista: Optional[str] = None
    patente: Optional[str] = None
    conductor: Optional[str] = None
    conductor_telefono: Optional[str] = None
    total_bultos_estimado: Optional[int] = None
    total_peso_estimado_kg: Optional[Decimal] = None
    estado: Optional[str] = None
    notas: Optional[str] = None

class DsdScheduleResponse(BaseModel):
    id: UUID
    proveedor_id: UUID
    proveedor_nombre: Optional[str] = None
    numero_oc: str
    fecha_programada: date
    ventana_inicio: datetime
    ventana_fin: datetime
    muelle: Optional[str] = None
    tipo_carga: str
    transportista: Optional[str] = None
    patente: Optional[str] = None
    conductor: Optional[str] = None
    conductor_telefono: Optional[str] = None
    total_bultos_estimado: Optional[int] = None
    total_peso_estimado_kg: Optional[Decimal] = None
    estado: str
    notas: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class DsdReceivingCreate(BaseModel):
    schedule_id: UUID
    proveedor_id: UUID
    numero_oc: str
    numero_remito: Optional[str] = None
    recibido_por: UUID
    temp_ambiente_descarga: Optional[Decimal] = None
    temp_check_method: str = "manual"
    observaciones: Optional[str] = None

class DsdReceivingUpdate(BaseModel):
    numero_remito: Optional[str] = None
    total_bultos_recibidos: Optional[int] = None
    total_bultos_rechazados: Optional[int] = None
    hora_fin: Optional[datetime] = None
    estado: Optional[str] = None
    observaciones: Optional[str] = None

class DsdReceivingItemCreate(BaseModel):
    producto_id: UUID
    cantidad_solicitada: Decimal
    cantidad_recibida: Decimal
    cantidad_aceptada: Optional[Decimal] = None
    temperatura_producto: Optional[Decimal] = None
    temp_conforme: Optional[bool] = None
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    condicion_visual: Optional[str] = None
    inspeccion_conforme: bool = True

class DsdReceivingItemResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    cantidad_solicitada: Decimal
    cantidad_recibida: Decimal
    cantidad_aceptada: Optional[Decimal] = None
    temperatura_producto: Optional[Decimal] = None
    temp_conforme: Optional[bool] = None
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    condicion_visual: Optional[str] = None
    inspeccion_conforme: bool
    created_at: datetime

class DsdRejectionCreate(BaseModel):
    item_id: UUID
    producto_id: UUID
    cantidad_rechazada: Decimal
    motivo: str
    detalle: Optional[str] = None
    foto_evidencia_url: Optional[str] = None
    genera_nota_credito: bool = True

class DsdRejectionResponse(BaseModel):
    id: UUID
    receiving_id: UUID
    item_id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    cantidad_rechazada: Decimal
    motivo: str
    detalle: Optional[str] = None
    foto_evidencia_url: Optional[str] = None
    genera_nota_credito: bool
    nota_credito_numero: Optional[str] = None
    created_at: datetime
    resuelto: bool

class DsdReceivingResponse(BaseModel):
    id: UUID
    schedule_id: UUID
    proveedor_id: UUID
    proveedor_nombre: Optional[str] = None
    numero_oc: str
    numero_remito: Optional[str] = None
    fecha_recepcion: datetime
    recibido_por: UUID
    recibido_por_nombre: Optional[str] = None
    total_bultos_recibidos: Optional[int] = None
    total_bultos_rechazados: Optional[int] = None
    temp_ambiente_descarga: Optional[Decimal] = None
    temp_check_method: str
    hora_inicio: Optional[datetime] = None
    hora_fin: Optional[datetime] = None
    estado: str
    observaciones: Optional[str] = None
    items: list[DsdReceivingItemResponse] = []
    rechazos: list[DsdRejectionResponse] = []
    created_at: datetime
    updated_at: datetime

class DsdDashboard(BaseModel):
    hoy_programadas: int = 0
    en_curso: int = 0
    completadas_hoy: int = 0
    bultos_recibidos_hoy: int = 0
    bultos_rechazados_hoy: int = 0
    rechazos_temp: int = 0
    proximas_programadas: list[dict] = []


# ============================================================
# PHYSICAL INVENTORY SCHEMAS
# ============================================================

class CountSessionCreate(BaseModel):
    codigo: str
    area: str
    ubicacion: Optional[str] = None
    tipo: str = "ciclico"
    abc_category: Optional[str] = None
    contador_principal: Optional[UUID] = None
    contador_verificador: Optional[UUID] = None
    requiere_doble_conteo: bool = False
    notas: Optional[str] = None

class CountSessionUpdate(BaseModel):
    contador_principal: Optional[UUID] = None
    contador_verificador: Optional[UUID] = None
    estado: Optional[str] = None
    fecha_fin: Optional[datetime] = None
    notas: Optional[str] = None

class CountSessionResponse(BaseModel):
    id: UUID
    codigo: str
    area: str
    ubicacion: Optional[str] = None
    tipo: str
    abc_category: Optional[str] = None
    contador_principal: Optional[UUID] = None
    contador_verificador: Optional[UUID] = None
    fecha_inicio: datetime
    fecha_fin: Optional[datetime] = None
    estado: str
    total_items_sistema: int
    total_items_contados: int
    total_discrepancias: int
    valor_discrepancia_total: Decimal
    requiere_doble_conteo: bool
    notas: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class CountItemCreate(BaseModel):
    producto_id: UUID
    codigo_barra: Optional[str] = None
    cantidad_sistema: Decimal
    cantidad_contada: Optional[Decimal] = None
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    contado_por: Optional[UUID] = None
    foto_evidencia_url: Optional[str] = None
    observaciones: Optional[str] = None

class CountItemUpdate(BaseModel):
    cantidad_contada: Optional[Decimal] = None
    cantidad_verificada: Optional[Decimal] = None
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    conforme: Optional[bool] = None
    verificado_por: Optional[UUID] = None
    foto_evidencia_url: Optional[str] = None
    observaciones: Optional[str] = None

class CountItemResponse(BaseModel):
    id: UUID
    session_id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    codigo_barra: Optional[str] = None
    cantidad_sistema: Decimal
    cantidad_contada: Optional[Decimal] = None
    cantidad_verificada: Optional[Decimal] = None
    diferencia: Optional[Decimal] = None
    costo_promedio: Optional[Decimal] = None
    valor_diferencia: Optional[Decimal] = None
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    conforme: Optional[bool] = None
    requiere_ajuste: bool
    contado_por: Optional[UUID] = None
    verificado_por: Optional[UUID] = None
    contado_at: Optional[datetime] = None
    verificado_at: Optional[datetime] = None
    foto_evidencia_url: Optional[str] = None
    observaciones: Optional[str] = None
    created_at: datetime

class AdjustmentCreate(BaseModel):
    count_item_id: UUID
    producto_id: UUID
    tipo: str
    cantidad_ajuste: Decimal
    costo_unitario: Optional[Decimal] = None
    motivo: Optional[str] = None

class AdjustmentResponse(BaseModel):
    id: UUID
    session_id: UUID
    count_item_id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    tipo: str
    cantidad_ajuste: Decimal
    costo_unitario: Optional[Decimal] = None
    valor_ajuste: Optional[Decimal] = None
    motivo: Optional[str] = None
    aprobado_por: Optional[UUID] = None
    aprobado_at: Optional[datetime] = None
    estado: str
    created_at: datetime

class CountSessionDashboard(BaseModel):
    sesiones_abiertas: int = 0
    sesiones_en_curso: int = 0
    sesiones_completadas: int = 0
    total_items_contados_mes: int = 0
    discrepancias_pendientes: int = 0
    ajustes_pendientes: int = 0
    cobertura_abc_a_pct: Decimal = Decimal("0")
    cobertura_abc_b_pct: Decimal = Decimal("0")


# ============================================================
# REPLENISHMENT SCHEMAS
# ============================================================

class ReplenishmentRuleCreate(BaseModel):
    producto_id: UUID
    proveedor_preferente_id: Optional[UUID] = None
    proveedor_secundario_id: Optional[UUID] = None
    lead_time_dias: int
    stock_seguridad_dias: int = 3
    stock_seguridad_unidades: Optional[Decimal] = None
    lote_economico: Optional[Decimal] = None
    multiplo_pedido: Optional[Decimal] = None
    cantidad_minima_pedido: Optional[Decimal] = None
    metodo_pronostico: str = "promedio"
    dias_historial: int = 90
    activa: bool = True

class ReplenishmentRuleUpdate(BaseModel):
    proveedor_preferente_id: Optional[UUID] = None
    proveedor_secundario_id: Optional[UUID] = None
    lead_time_dias: Optional[int] = None
    stock_seguridad_dias: Optional[int] = None
    stock_seguridad_unidades: Optional[Decimal] = None
    lote_economico: Optional[Decimal] = None
    multiplo_pedido: Optional[Decimal] = None
    cantidad_minima_pedido: Optional[Decimal] = None
    metodo_pronostico: Optional[str] = None
    dias_historial: Optional[int] = None
    activa: Optional[bool] = None

class ReplenishmentRuleResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    proveedor_preferente_id: Optional[UUID] = None
    proveedor_preferente_nombre: Optional[str] = None
    proveedor_secundario_id: Optional[UUID] = None
    lead_time_dias: int
    stock_seguridad_dias: int
    stock_seguridad_unidades: Optional[Decimal] = None
    lote_economico: Optional[Decimal] = None
    multiplo_pedido: Optional[Decimal] = None
    cantidad_minima_pedido: Optional[Decimal] = None
    punto_pedido: Optional[Decimal] = None
    metodo_pronostico: str
    dias_historial: int
    activa: bool
    created_at: datetime
    updated_at: datetime

class ReplenishmentSuggestionResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    proveedor_id: Optional[UUID] = None
    proveedor_nombre: Optional[str] = None
    fecha_generacion: datetime
    stock_actual: Decimal
    stock_pendiente_recibir: Decimal
    demanda_diaria_avg: Optional[Decimal] = None
    demanda_pronosticada: Optional[Decimal] = None
    cantidad_sugerida: Decimal
    costo_unitario_estimado: Optional[Decimal] = None
    costo_total_estimado: Optional[Decimal] = None
    oc_generada: bool
    oc_numero: Optional[str] = None
    estado: str
    revisado_por: Optional[UUID] = None
    revisado_nombre: Optional[str] = None
    revisado_at: Optional[datetime] = None
    notas: Optional[str] = None
    created_at: datetime

class SuggestionReview(BaseModel):
    accion: str  # aprobar, rechazar
    notas: Optional[str] = None

class ReplenishmentGenerateInput(BaseModel):
    proveedor_id: Optional[UUID] = None
    solo_criticos: bool = False

class CrossDockOrderCreate(BaseModel):
    producto_id: UUID
    proveedor_id: Optional[UUID] = None
    receiving_item_id: Optional[UUID] = None
    cantidad: Decimal
    fecha_crossdock: date
    destino: str = "gondola"
    asignado_a: Optional[UUID] = None

class CrossDockOrderResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    proveedor_id: Optional[UUID] = None
    proveedor_nombre: Optional[str] = None
    receiving_item_id: Optional[UUID] = None
    cantidad: Decimal
    fecha_crossdock: date
    destino: str
    asignado_a: Optional[UUID] = None
    estado: str
    completado_at: Optional[datetime] = None
    created_at: datetime

class ReplenishmentDashboard(BaseModel):
    reglas_activas: int = 0
    sugerencias_pendientes: int = 0
    sugerencias_aprobadas: int = 0
    productos_criticos: int = 0
    crossdock_hoy: int = 0
    ahorro_crossdock_hrs: Decimal = Decimal("0")


# ============================================================
# SUPPLIER RETURNS & BACKHAUL SCHEMAS
# ============================================================

class SupplierReturnCreate(BaseModel):
    proveedor_id: UUID
    codigo: str
    tipo: str = "devolucion"
    fecha_estimada_retiro: Optional[date] = None
    observaciones: Optional[str] = None
    items: list["ReturnItemCreate"] = []

class SupplierReturnUpdate(BaseModel):
    fecha_estimada_retiro: Optional[date] = None
    estado: Optional[str] = None
    nota_credito_numero: Optional[str] = None
    nota_credito_monto: Optional[Decimal] = None
    observaciones: Optional[str] = None

class ReturnItemCreate(BaseModel):
    producto_id: UUID
    cantidad: Decimal
    costo_promedio: Optional[Decimal] = None
    valor_unitario: Optional[Decimal] = None
    motivo: str
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    detalle: Optional[str] = None

class ReturnItemResponse(BaseModel):
    id: UUID
    producto_id: UUID
    producto_nombre: Optional[str] = None
    cantidad: Decimal
    costo_promedio: Optional[Decimal] = None
    valor_unitario: Optional[Decimal] = None
    valor_total: Optional[Decimal] = None
    motivo: str
    lote: Optional[str] = None
    fecha_vencimiento: Optional[date] = None
    detalle: Optional[str] = None
    created_at: datetime

class SupplierReturnResponse(BaseModel):
    id: UUID
    proveedor_id: UUID
    proveedor_nombre: Optional[str] = None
    codigo: str
    tipo: str
    fecha_creacion: datetime
    fecha_estimada_retiro: Optional[date] = None
    total_items: int
    valor_total_estimado: Optional[Decimal] = None
    nota_credito_numero: Optional[str] = None
    nota_credito_monto: Optional[Decimal] = None
    estado: str
    autorizado_por: Optional[UUID] = None
    autorizado_at: Optional[datetime] = None
    completado_por: Optional[UUID] = None
    completado_at: Optional[datetime] = None
    observaciones: Optional[str] = None
    items: list[ReturnItemResponse] = []
    created_at: datetime
    updated_at: datetime

class ReturnAuthCreate(BaseModel):
    proveedor_id: UUID
    numero_autorizacion: str
    fecha_autorizacion: date
    valido_hasta: Optional[date] = None
    autorizado_por_proveedor: Optional[str] = None
    nota_credito_numero: Optional[str] = None
    nota_credito_monto: Optional[Decimal] = None
    observaciones: Optional[str] = None

class ReturnAuthResponse(BaseModel):
    id: UUID
    return_id: UUID
    proveedor_id: UUID
    proveedor_nombre: Optional[str] = None
    numero_autorizacion: str
    fecha_autorizacion: date
    valido_hasta: Optional[date] = None
    autorizado_por_proveedor: Optional[str] = None
    nota_credito_numero: Optional[str] = None
    nota_credito_monto: Optional[Decimal] = None
    observaciones: Optional[str] = None
    created_at: datetime

class BackhaulCreate(BaseModel):
    proveedor_id: UUID
    return_ids: list[UUID]
    fecha_programada: datetime
    ventana_inicio: Optional[datetime] = None
    ventana_fin: Optional[datetime] = None
    transportista: Optional[str] = None
    patente: Optional[str] = None
    conductor: Optional[str] = None
    total_bultos: Optional[int] = None
    peso_estimado_kg: Optional[Decimal] = None
    destino_direccion: Optional[str] = None
    notas_logisticas: Optional[str] = None

class BackhaulUpdate(BaseModel):
    ventana_inicio: Optional[datetime] = None
    ventana_fin: Optional[datetime] = None
    transportista: Optional[str] = None
    patente: Optional[str] = None
    conductor: Optional[str] = None
    total_bultos: Optional[int] = None
    peso_estimado_kg: Optional[Decimal] = None
    estado: Optional[str] = None
    notas_logisticas: Optional[str] = None

class BackhaulResponse(BaseModel):
    id: UUID
    proveedor_id: UUID
    proveedor_nombre: Optional[str] = None
    return_ids: list[UUID]
    fecha_programada: datetime
    ventana_inicio: Optional[datetime] = None
    ventana_fin: Optional[datetime] = None
    transportista: Optional[str] = None
    patente: Optional[str] = None
    conductor: Optional[str] = None
    total_bultos: Optional[int] = None
    peso_estimado_kg: Optional[Decimal] = None
    destino_direccion: Optional[str] = None
    estado: str
    notas_logisticas: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class ReturnsDashboard(BaseModel):
    returns_pendientes: int = 0
    returns_activos: int = 0
    returns_completados_mes: int = 0
    valor_total_pendiente: Decimal = Decimal("0")
    credito_recibido_mes: Decimal = Decimal("0")
    backhaul_programados: int = 0
    backhaul_pendientes: int = 0
