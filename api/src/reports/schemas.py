"""Reports module schemas"""

from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class SalesReportParams(BaseModel):
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    agrupar_por: str = "dia"  # dia, semana, mes, categoria
    incluir_iva: bool = True


class SalesSummary(BaseModel):
    total_ventas: int
    monto_total: float
    monto_iva_10: float
    monto_iva_5: float
    monto_exento: float
    ticket_promedio: float
    total_items: int


class SalesByPeriod(BaseModel):
    periodo: str
    cantidad: int
    monto: float
    iva_10: float
    items: int


class SalesByCategory(BaseModel):
    categoria: str
    cantidad: int
    monto: float
    porcentaje: float


class SalesByProduct(BaseModel):
    producto: str
    sku: str
    cantidad: int
    monto: float
    costo: float
    margen: float


class SalesByClient(BaseModel):
    cliente: str
    ruc: Optional[str]
    cantidad_compras: int
    monto_total: float
    ultima_compra: Optional[datetime]


class InventoryReportParams(BaseModel):
    warehouse_id: Optional[int] = None
    incluir_valorizado: bool = True


class InventorySummary(BaseModel):
    total_productos: int
    total_unidades: int
    valor_total: float
    valor_costo: float
    bajo_stock: int
    sin_stock: int


class InventoryItem(BaseModel):
    producto: str
    sku: str
    categoria: str
    warehouse: str
    cantidad: int
    reservada: int
    disponible: int
    costo_unitario: float
    valor_total: float
    bajo_stock: bool


class InventoryRotation(BaseModel):
    producto: str
    sku: str
    ventas_30d: int
    stock_actual: int
    dias_inventario: float
    clasificacion: str  # A: alta, B: media, C: baja, D: sin movimiento


class FiscalReportParams(BaseModel):
    fecha_desde: Optional[date] = None
    fecha_hasta: Optional[date] = None
    tipo_libro: str = "ventas"  # ventas, compras


class FiscalBookEntry(BaseModel):
    fecha: datetime
    nro_comprobante: str
    ruc_emisor: Optional[str]
    ruc_receptor: Optional[str]
    razon_social: str
    condicion_iva: str
    monto_5: float
    monto_10: float
    monto_exento: float
    iva_5: float
    iva_10: float
    total: float


class FiscalSummary(BaseModel):
    total_operaciones: int
    total_5: float
    total_10: float
    total_exento: float
    total_iva_5: float
    total_iva_10: float
    total_general: float


class FinancialSummary(BaseModel):
    ingresos: float
    egresos: float
    saldo: float
    cuentas_por_cobrar: float
    cuentas_por_pagar: float
    flujo_caja: float


class FinancialByDay(BaseModel):
    fecha: date
    ingresos: float
    egresos: float
    saldo: float
