from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DeptoPylItem(BaseModel):
    depto: str
    ventas: float
    costo_ventas: float
    margen_bruto: float
    margen_porcentaje: float
    merma_total: float
    merma_porcentaje: float
    markdowns_activos: int


class ProductoRanking(BaseModel):
    producto_id: str
    producto_nombre: str
    categoria: Optional[str] = None
    cantidad_vendida: float
    total_ventas: float
    margen: float
    rotacion_dias: Optional[float] = None
    participacion_porcentaje: float


class VentaPorHora(BaseModel):
    hora: int
    total_ventas: float
    cantidad_transacciones: int
    ticket_promedio: float


class GerencialDashboard(BaseModel):
    ventas_hoy: float
    ventas_semana: float
    ventas_mes: float
    margen_promedio: float
    ticket_promedio: float
    clientes_atendidos: int
    productos_vendidos: int
    top_productos: list[ProductoRanking]
    ventas_por_hora: list[VentaPorHora]
    deptos: list[DeptoPylItem]
