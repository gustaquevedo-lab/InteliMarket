from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date, datetime
from uuid import UUID


class SueldokSSOResponse(BaseModel):
    sso_url: str
    target_route: str
    company_id: str
    expires_at: int


class ShiftAssignmentInput(BaseModel):
    user_id: str
    user_nombre: str
    rol: str
    seccion: str
    lun: str = "M"
    mar: str = "M"
    mie: str = "M"
    jue: str = "M"
    vie: str = "M"
    sab: str = "T"
    dom: str = "F"
    hs_extras: int = 0


class SyncShiftsPayload(BaseModel):
    company_id: str
    semana_inicio: str
    assignments: List[ShiftAssignmentInput]


class CashierBonusItem(BaseModel):
    cajero_id: str
    cajero_nombre: str
    pos_sesiones: int
    tickets_atendidos: int
    facturacion_total_gs: float
    items_por_minuto: float
    precision_arqueo_pct: float
    diferencia_arqueo_gs: float
    bono_rendimiento_gs: float
    categoria_bono: str  # "ORO", "PLATA", "BRONCE", "STANDARD"
    estado: str = "calculado"  # "calculado", "aprobado", "exportado"


class ExportBonusesPayload(BaseModel):
    company_id: str
    periodo_mes: str  # "2026-08"
    bonuses: List[CashierBonusItem]


class SueldokSummaryStats(BaseModel):
    company_id: str
    total_colaboradores: int
    turnos_activos_hoy: int
    cajeros_operativos: int
    repositores_operativos: int
    horas_extras_mes: int
    costo_horas_extras_gs: float
    masa_salarial_estimada_gs: float
    aporte_ips_estimado_gs: float
    descuentos_arqueo_mes_gs: float
    bonos_productividad_mes_gs: float
    sueldok_connected: bool
    sueldok_base_url: str
