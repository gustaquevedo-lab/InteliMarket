from pydantic import BaseModel, ConfigDict, Field, model_validator
from typing import Optional, List, Any
from datetime import date, time, datetime
from decimal import Decimal


class PromotionCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    # Ver tipos_validos en validar_consistencia() para la lista completa y
    # calcular_precio_promocional() en service.py para la logica de cada uno.
    tipo: str = "precio_fijo_oferta"
    valor: Optional[Decimal] = None
    precio_fijo_promocional: Optional[Decimal] = None
    valor_maximo: Optional[Decimal] = None
    # venta | costo -- solo aplica a tipo=porcentaje
    base_calculo_pct: Optional[str] = "venta"
    # 0-99: fuerza los ultimos 2 digitos del precio final calculado, ej. 77 -> Gs. 12.977
    terminacion_psicologica: Optional[int] = None

    # producto | categoria | carrito | marca
    aplica_a: str = "producto"
    producto_ids: Optional[list[str]] = None
    categoria_ids: Optional[list[str]] = None

    # Trade Marketing
    origen: Optional[str] = "iniciativa_propia"  # corto_vencimiento | accion_proveedor | iniciativa_propia
    financiamiento: Optional[str] = "propio_supermercado"  # proveedor_sell_out | proveedor_sell_in | propio_supermercado | co_financiado
    supplier_id: Optional[str] = None
    purchases_invoices_ids: Optional[list[str]] = None
    porcentaje_aporte_proveedor: Optional[Decimal] = Decimal("0")
    porcentaje_aporte_tienda: Optional[Decimal] = Decimal("0")
    monto_aporte_proveedor_pyg: Optional[Decimal] = Decimal("0")
    monto_aporte_tienda_pyg: Optional[Decimal] = Decimal("0")

    # Costo, Margen y Compromiso de NC
    costo_unitario_referencia: Optional[Decimal] = Decimal("0")
    porcentaje_nc_costo: Optional[Decimal] = Decimal("0")  # % de NC acordado sobre el costo (ej: 40%)
    monto_total_nc_comprometido: Optional[Decimal] = Decimal("0")  # Obligación en firme generada
    fecha_vencimiento_lote: Optional[date] = None  # Fecha real de vencimiento del lote
    vende_bajo_costo: Optional[bool] = False

    # Restricciones de Compra & Stock Límite
    limite_por_compra: Optional[int] = None
    limitar_unidades: Optional[bool] = False
    stock_limite_unidades: Optional[Decimal] = None

    # Condiciones
    monto_minimo_compra: Optional[Decimal] = None
    cantidad_minima: Optional[int] = None
    cantidad_maxima_items: Optional[int] = None
    aplicaciones_por_cliente: Optional[int] = None
    combinable: bool = False

    # Vigencia & Días
    valido_desde: date
    valido_hasta: date
    horario_desde: Optional[time] = None
    horario_hasta: Optional[time] = None
    dias_semana: Optional[list[int]] = None  # 0=Dom, 1=Lun ... 6=Sab

    # Cupón
    codigo_cupon: Optional[str] = None
    requiere_cupon: bool = False
    usos_maximos: Optional[int] = None
    activo: bool = True
    estado: Optional[str] = "activa"

    @model_validator(mode="after")
    def validar_consistencia(self):
        tipos_validos = (
            "precio_fijo_oferta", "porcentaje", "monto_fijo",
            "dos_por_uno", "tres_por_dos", "nxm", "cantidad_lleva",
            "segunda_unidad_pct", "combo_pack", "combo_precio"
        )
        if self.tipo not in tipos_validos:
            raise ValueError(f"Tipo de promoción '{self.tipo}' no válido. Tipos soportados: {', '.join(tipos_validos)}.")
        if self.valido_hasta < self.valido_desde:
            raise ValueError("La fecha de fin de vigencia no puede ser anterior a la de inicio.")
        if self.tipo in ("porcentaje", "segunda_unidad_pct") and self.valor is not None:
            if self.valor <= 0 or self.valor > 100:
                raise ValueError("El porcentaje de descuento debe estar entre 0 y 100.")
        if self.aplica_a == "producto" and not self.producto_ids:
            raise ValueError("Debe seleccionar al menos un producto para esta promoción.")
        if self.aplica_a == "categoria" and not self.categoria_ids:
            raise ValueError("Debe seleccionar al menos una categoría para esta promoción.")
        if self.base_calculo_pct and self.base_calculo_pct not in ("venta", "costo"):
            raise ValueError("base_calculo_pct debe ser 'venta' o 'costo'.")
        if self.tipo == "porcentaje" and self.base_calculo_pct == "costo":
            if not self.costo_unitario_referencia or self.costo_unitario_referencia <= 0:
                raise ValueError("Para calcular el % sobre el costo, debe indicar el costo unitario de referencia.")
        if self.terminacion_psicologica is not None and not (0 <= self.terminacion_psicologica <= 99):
            raise ValueError("La terminación psicológica de precio debe estar entre 0 y 99.")
        return self


class PromotionUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    valor: Optional[Decimal] = None
    precio_fijo_promocional: Optional[Decimal] = None
    valor_maximo: Optional[Decimal] = None
    base_calculo_pct: Optional[str] = None
    terminacion_psicologica: Optional[int] = None
    aplica_a: Optional[str] = None
    producto_ids: Optional[list[str]] = None
    categoria_ids: Optional[list[str]] = None
    
    origen: Optional[str] = None
    financiamiento: Optional[str] = None
    supplier_id: Optional[str] = None
    purchases_invoices_ids: Optional[list[str]] = None
    porcentaje_aporte_proveedor: Optional[Decimal] = None
    porcentaje_aporte_tienda: Optional[Decimal] = None
    monto_aporte_proveedor_pyg: Optional[Decimal] = None
    monto_aporte_tienda_pyg: Optional[Decimal] = None
    
    costo_unitario_referencia: Optional[Decimal] = None
    vende_bajo_costo: Optional[bool] = None
    estado: Optional[str] = None
    
    limite_por_compra: Optional[int] = None
    limitar_unidades: Optional[bool] = None
    stock_limite_unidades: Optional[Decimal] = None
    
    monto_minimo_compra: Optional[Decimal] = None
    cantidad_minima: Optional[int] = None
    cantidad_maxima_items: Optional[int] = None
    aplicaciones_por_cliente: Optional[int] = None
    combinable: Optional[bool] = None
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None
    horario_desde: Optional[time] = None
    horario_hasta: Optional[time] = None
    dias_semana: Optional[list[int]] = None
    codigo_cupon: Optional[str] = None
    requiere_cupon: Optional[bool] = None
    usos_maximos: Optional[int] = None
    activo: Optional[bool] = None


class PromotionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Any
    company_id: Optional[Any] = None
    nombre: str
    descripcion: Optional[str] = None
    tipo: str
    valor: Optional[float] = None
    precio_fijo_promocional: Optional[float] = None
    valor_maximo: Optional[float] = None
    base_calculo_pct: Optional[str] = "venta"
    terminacion_psicologica: Optional[int] = None
    aplica_a: str
    producto_ids: Optional[Any] = None
    categoria_ids: Optional[Any] = None
    
    origen: Optional[str] = "iniciativa_propia"
    financiamiento: Optional[str] = "propio_supermercado"
    supplier_id: Optional[Any] = None
    purchases_invoices_ids: Optional[Any] = None
    porcentaje_aporte_proveedor: Optional[float] = 0
    porcentaje_aporte_tienda: Optional[float] = 0
    monto_aporte_proveedor_pyg: Optional[float] = 0
    monto_aporte_tienda_pyg: Optional[float] = 0
    
    costo_unitario_referencia: Optional[float] = 0
    vende_bajo_costo: bool = False
    estado: str = "activa"
    aprobado_por: Optional[str] = None
    fecha_aprobacion: Optional[datetime] = None

    limite_por_compra: Optional[int] = None
    limitar_unidades: bool = False
    stock_limite_unidades: Optional[float] = None
    unidades_vendidas_promo: float = 0
    unidades_disponibles_promo: Optional[float] = None

    monto_minimo_compra: Optional[float] = None
    cantidad_minima: Optional[int] = None
    cantidad_maxima_items: Optional[int] = None
    aplicaciones_por_cliente: Optional[int] = None
    combinable: bool = False
    valido_desde: Optional[date] = None
    valido_hasta: Optional[date] = None
    horario_desde: Optional[str] = None
    horario_hasta: Optional[str] = None
    dias_semana: Optional[list[int]] = None
    codigo_cupon: Optional[str] = None
    requiere_cupon: bool = False
    
    nc_estado: Optional[str] = "pendiente_liquidacion"
    porcentaje_nc_costo: Optional[float] = 0
    monto_total_nc_comprometido: Optional[float] = 0
    fecha_vencimiento_lote: Optional[date] = None
    ar_receivable_id: Optional[Any] = None
    nc_numero_proveedor: Optional[str] = None
    nc_timbrado_proveedor: Optional[str] = None
    nc_monto_total: Optional[float] = 0
    
    origen_fuente: Optional[str] = "intelimarket"
    legacy_id: Optional[int] = None

    usos_maximos: Optional[int] = None
    usos_actuales: int = 0
    activo: bool = True
    created_at: Optional[datetime] = None


class ExpiringPromotionAlert(BaseModel):
    promotion_id: Any
    promotion_nombre: str
    product_id: Optional[Any] = None
    product_nombre: str
    fecha_vencimiento: date
    dias_restantes: int
    nivel_alerta: str  # "vencido" (0 o menos), "urgente_5_dias", "alerta_10_dias", "aviso_15_dias"
    stock_limite_inicial: float = 0
    unidades_vendidas: float = 0
    unidades_restantes: float = 0
    monto_nc_comprometido: float = 0
    supplier_nombre: Optional[str] = None
    mensaje_accion: str


class ProductDualPriceResponse(BaseModel):
    en_promocion: bool = False
    precio_regular: float
    precio_promocional: float
    ahorro_unitario: float = 0
    ahorro_porcentaje: float = 0
    promocion_id: Optional[str] = None
    promocion_nombre: Optional[str] = None
    badge: Optional[str] = None
    limite_por_compra: Optional[int] = None
    valido_hasta: Optional[date] = None
    dias_semana_activos: Optional[list[int]] = None
    es_activo_hoy: bool = True
    mensaje_dias: Optional[str] = None

    # Tolerancia de Promoción Relámpago (Grace Period <= 60 min post-cierre)
    es_relampago_expirada_en_tolerancia: bool = False
    minutos_retraso_relampago: int = 0
    requiere_autorizacion_supervisor: bool = False
    mensaje_tolerancia: Optional[str] = None


class AuthorizeFlashGraceInput(BaseModel):
    promotion_id: str
    product_id: str
    sale_id: Optional[str] = None
    supervisor_id: Optional[str] = None
    supervisor_pin: Optional[str] = None
    cajero_id: Optional[str] = None
    caja_numero: Optional[str] = "012"
    precio_regular: Decimal
    precio_autorizado: Decimal
    minutos_retraso: int
    motivo: Optional[str] = "Demora en fila de cajas / cliente retiró de góndola en horario"


class AuthorizeFlashGraceResponse(BaseModel):
    autorizado: bool
    audit_event_id: str
    descuento_aplicado: float
    precio_final_unitario: float
    mensaje: str



class ReactivatePromoInput(BaseModel):
    valido_desde: date
    valido_hasta: date
    limite_por_compra: Optional[int] = None
    stock_limite_unidades: Optional[Decimal] = None


class ApproveLossPromoInput(BaseModel):
    pin_aprobacion: Optional[str] = None
    motivo: Optional[str] = None


class RecordVendorCreditNoteInput(BaseModel):
    nc_numero_proveedor: str
    nc_timbrado_proveedor: str
    nc_monto_total: Decimal
    observaciones: Optional[str] = None


class VendorClaimResponse(BaseModel):
    promotion_id: str
    promotion_nombre: str
    financiamiento: Optional[str] = "proveedor_sell_out"
    porcentaje_aporte_proveedor: Optional[float] = 100
    porcentaje_aporte_tienda: Optional[float] = 0
    supplier_id: Optional[str] = None
    supplier_nombre: Optional[str] = None
    supplier_ruc: Optional[str] = None
    supplier_email: Optional[str] = None
    supplier_telefono: Optional[str] = None
    unidades_vendidas: float
    total_descuento_general: float = 0
    total_rebate_reclamar: float
    total_aporte_tienda: float = 0
    facturas_compra_referencia: list[dict] = []
    fecha_corte: datetime = Field(default_factory=datetime.utcnow)


class ValidateCartInput(BaseModel):
    """Input for POS to check applicable promotions"""
    items: list["CartItemInput"]
    customer_id: Optional[str] = None
    branch_id: Optional[str] = None
    codigo_cupon: Optional[str] = None


class CartItemInput(BaseModel):
    producto_id: str
    categoria_id: Optional[str] = None
    cantidad: float
    precio_unitario: Decimal


class ValidatedPromotion(BaseModel):
    promotion_id: str
    nombre: str
    tipo: str
    descuento: float
    descuento_maximo: Optional[float] = None
    items_aplicados: list[str]  # producto_ids
    descripcion: Optional[str] = None


class CalculatePromoResponse(BaseModel):
    applicable_promotions: list[ValidatedPromotion]
    total_descuento_promociones: float
    total_descuento_mayorista: float
    total_descuento_general: float
    total_final: float
    ahorro_total_compra: float
    recuadro_ticket_texto: str
