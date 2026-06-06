"""Router del modulo Servicios Profesionales (sv_*)."""
import logging
from typing import Optional, List
from datetime import date
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Path, Body
from sqlalchemy.ext.asyncio import AsyncSession

from api.src.auth.deps import get_current_user
from api.src.db import get_db
from api.src.servicios import service, schemas, models

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/servicios", tags=["servicios"])


def _cid(user: dict) -> str:
    """Resuelve company_id del user, o default demo."""
    cid = user.get("company_id") or user.get("tenant_id")
    if cid:
        return str(cid)
    return "00000000-0000-0000-0000-000000000010"


# ============================================================
# DASHBOARD
# ============================================================
@router.get("/dashboard", response_model=schemas.ServiciosDashboard)
async def get_dashboard(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.build_dashboard(db, _cid(user))


# ============================================================
# VERTICALES / SKILLS
# ============================================================
@router.get("/verticals")
async def list_verticals(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.list_verticals(db)


@router.get("/skills")
async def list_skills(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                     categoria: Optional[str] = None):
    return await service.list_skills(db, categoria)


@router.post("/skills", response_model=schemas.SkillOut)
async def create_skill(data: schemas.SkillCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_skill(db, data.model_dump())


# ============================================================
# TECNICOS
# ============================================================
@router.get("/technicians", response_model=List[schemas.TechnicianOut])
async def list_technicians(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                           vertical: Optional[str] = None, active_only: bool = True):
    return await service.list_technicians(db, _cid(user), vertical=vertical, active_only=active_only)


@router.post("/technicians", response_model=schemas.TechnicianOut)
async def create_technician(data: schemas.TechnicianCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    d = data.model_dump()
    company_id = d.pop("company_id", _cid(user))
    return await service.create_technician(db, {"company_id": company_id, **d})


@router.get("/technicians/{tech_id}", response_model=schemas.TechnicianOut)
async def get_technician(tech_id: str = Path(...), user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = await service.get_technician(db, tech_id)
    if not t: raise HTTPException(404, "Tecnico no encontrado")
    return t


@router.patch("/technicians/{tech_id}", response_model=schemas.TechnicianOut)
async def update_technician(tech_id: str, data: schemas.TechnicianUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    t = await service.update_technician(db, tech_id, data.model_dump(exclude_unset=True))
    if not t: raise HTTPException(404, "Tecnico no encontrado")
    return t


@router.post("/technicians/{tech_id}/skills", response_model=schemas.TechnicianSkillOut)
async def add_skill(tech_id: str, data: schemas.TechnicianSkillCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.add_skill_to_technician(db, _cid(user), tech_id, data.model_dump())


@router.get("/technicians/{tech_id}/skills", response_model=List[schemas.TechnicianSkillOut])
async def list_tech_skills(tech_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.list_technician_skills(db, tech_id)


@router.post("/technicians/{tech_id}/certifications", response_model=schemas.CertificationOut)
async def add_certification(tech_id: str, data: schemas.CertificationCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.add_certification(db, _cid(user), tech_id, data.model_dump())


@router.get("/technicians/{tech_id}/certifications", response_model=List[schemas.CertificationOut])
async def list_certifications(tech_id: Optional[str] = None, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.list_certifications(db, tech_id=tech_id, company_id=_cid(user))


# ============================================================
# PROPIEDADES / EQUIPOS
# ============================================================
@router.post("/properties", response_model=schemas.PropertyOut)
async def create_property(data: schemas.PropertyCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_property(db, _cid(user), data.model_dump())


@router.get("/properties", response_model=List[schemas.PropertyOut])
async def list_properties(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db), customer_id: Optional[str] = None):
    return await service.list_properties(db, _cid(user), customer_id)


@router.post("/equipment", response_model=schemas.EquipmentOut)
async def create_equipment(data: schemas.EquipmentCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_equipment(db, _cid(user), data.model_dump())


@router.get("/equipment", response_model=List[schemas.EquipmentOut])
async def list_equipment(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db), property_id: Optional[str] = None):
    return await service.list_equipment(db, _cid(user), property_id)


# ============================================================
# COTIZACIONES
# ============================================================
@router.post("/quotes", response_model=schemas.QuoteOut)
async def create_quote(data: schemas.QuoteCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_quote(db, _cid(user), data.model_dump())


@router.get("/quotes", response_model=List[schemas.QuoteOut])
async def list_quotes(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                     estado: Optional[str] = None, customer_id: Optional[str] = None, limit: int = 50):
    return await service.list_quotes(db, _cid(user), estado=estado, customer_id=customer_id, limit=limit)


@router.get("/quotes/{quote_id}", response_model=schemas.QuoteOut)
async def get_quote(quote_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = await service.get_quote(db, quote_id)
    if not q: raise HTTPException(404, "Cotizacion no encontrada")
    return q


@router.patch("/quotes/{quote_id}", response_model=schemas.QuoteOut)
async def update_quote(quote_id: str, data: schemas.QuoteUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = await service.update_quote(db, quote_id, data.model_dump(exclude_unset=True))
    if not q: raise HTTPException(404, "Cotizacion no encontrada")
    return q


@router.post("/quotes/{quote_id}/convert-to-wo")
async def convert_quote(quote_id: str, fecha_programada: date, technician_id: Optional[str] = None,
                         user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await service.convert_quote_to_work_order(db, quote_id, fecha_programada, technician_id)
    if not r: raise HTTPException(400, "No se pudo convertir la cotizacion")
    return r


# ============================================================
# AGENDA
# ============================================================
@router.post("/appointments", response_model=schemas.AppointmentOut)
async def create_appointment(data: schemas.AppointmentCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_appointment(db, _cid(user), data.model_dump())


@router.get("/appointments", response_model=List[schemas.AppointmentOut])
async def list_appointments(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                             fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None,
                             technician_id: Optional[str] = None, estado: Optional[str] = None):
    return await service.list_appointments(db, _cid(user), fecha_desde, fecha_hasta, technician_id, estado)


@router.get("/appointments/{ap_id}", response_model=schemas.AppointmentOut)
async def get_appointment(ap_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = await service.get_appointment(db, ap_id)
    if not a: raise HTTPException(404, "Cita no encontrada")
    return a


@router.patch("/appointments/{ap_id}", response_model=schemas.AppointmentOut)
async def update_appointment(ap_id: str, data: schemas.AppointmentUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    a = await service.update_appointment(db, ap_id, data.model_dump(exclude_unset=True))
    if not a: raise HTTPException(404, "Cita no encontrada")
    return a


@router.get("/dispatch")
async def ai_dispatch(lat: float, lng: float, fecha: date, hora_desde: str = "09:00",
                      duracion_min: int = 60, skill_id: Optional[str] = None,
                      user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """AI-powered dispatch: ranking de tecnicos disponibles por cercania + skills + conflictos."""
    from datetime import time
    try:
        hh, mm = hora_desde.split(":")
        hd = time(int(hh), int(mm))
    except Exception:
        hd = time(9, 0)
    return await service.ai_dispatch(db, _cid(user), lat, lng, fecha, hd, duracion_min, skill_id)


# ============================================================
# WORK ORDERS
# ============================================================
@router.post("/work-orders", response_model=schemas.WorkOrderOut)
async def create_work_order(data: schemas.WorkOrderCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_work_order(db, _cid(user), data.model_dump())


@router.get("/work-orders", response_model=List[schemas.WorkOrderOut])
async def list_work_orders(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                            estado: Optional[str] = None, technician_id: Optional[str] = None,
                            customer_id: Optional[str] = None,
                            fecha_desde: Optional[date] = None, fecha_hasta: Optional[date] = None,
                            limit: int = 100):
    return await service.list_work_orders(db, _cid(user), estado, technician_id, customer_id, fecha_desde, fecha_hasta, limit)


@router.get("/work-orders/{wo_id}", response_model=schemas.WorkOrderOut)
async def get_work_order(wo_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wo = await service.get_work_order(db, wo_id)
    if not wo: raise HTTPException(404, "Orden de trabajo no encontrada")
    return wo


@router.patch("/work-orders/{wo_id}", response_model=schemas.WorkOrderOut)
async def update_work_order(wo_id: str, data: schemas.WorkOrderUpdate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    wo = await service.update_work_order(db, wo_id, data.model_dump(exclude_unset=True))
    if not wo: raise HTTPException(404, "Orden de trabajo no encontrada")
    return wo


# ============================================================
# CONTRATOS
# ============================================================
@router.post("/contracts", response_model=schemas.ServiceContractOut)
async def create_contract(data: schemas.ServiceContractCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_contract(db, _cid(user), data.model_dump())


@router.get("/contracts", response_model=List[schemas.ServiceContractOut])
async def list_contracts(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db), estado: Optional[str] = None):
    return await service.list_contracts(db, _cid(user), estado)


@router.get("/contracts/{contract_id}", response_model=schemas.ServiceContractOut)
async def get_contract(contract_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    c = await service.get_contract(db, contract_id)
    if not c: raise HTTPException(404, "Contrato no encontrado")
    return c


@router.post("/contracts/{contract_id}/generate-visits")
async def generate_visits(contract_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    n = await service.generate_contract_visits(db, contract_id)
    return {"visitas_creadas": n}


@router.get("/contracts/{contract_id}/visits", response_model=List[schemas.ContractVisitOut])
async def list_visits(contract_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.list_contract_visits(db, contract_id)


# ============================================================
# INVENTARIO
# ============================================================
@router.get("/truck-inventory", response_model=List[schemas.TruckInventoryOut])
async def list_truck_inventory(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db), technician_id: Optional[str] = None):
    return await service.list_truck_inventory(db, _cid(user), technician_id)


@router.post("/inventory-movements", response_model=schemas.InventoryMovementOut)
async def register_movement(data: schemas.InventoryMovementCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await service.register_inventory_movement(db, _cid(user), data.model_dump())
    if not r: raise HTTPException(400, "Movimiento no procesado")
    return r


@router.get("/inventory-movements", response_model=List[schemas.InventoryMovementOut])
async def list_movements(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                          technician_id: Optional[str] = None, product_id: Optional[str] = None, limit: int = 100):
    return await service.list_inventory_movements(db, _cid(user), technician_id, product_id, limit)


# ============================================================
# FACTURAS
# ============================================================
@router.get("/invoices", response_model=List[schemas.ServiceInvoiceOut])
async def list_invoices(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db),
                        estado: Optional[str] = None, customer_id: Optional[str] = None, limit: int = 100):
    return await service.list_invoices(db, _cid(user), estado, customer_id, limit)


@router.get("/invoices/{invoice_id}", response_model=schemas.ServiceInvoiceOut)
async def get_invoice(invoice_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    inv = await service.get_invoice(db, invoice_id)
    if not inv: raise HTTPException(404, "Factura no encontrada")
    return inv


@router.post("/invoices/{invoice_id}/payments", response_model=schemas.InvoicePaymentOut)
async def register_payment(invoice_id: str, data: schemas.InvoicePaymentCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await service.register_payment(db, _cid(user), invoice_id, data.model_dump())
    if not p: raise HTTPException(404, "Factura no encontrada")
    return p


# ============================================================
# QUOTE REQUESTS (public lead form)
# ============================================================
@router.post("/quote-requests", response_model=schemas.QuoteRequestOut)
async def create_quote_request(data: schemas.QuoteRequestCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.create_quote_request(db, _cid(user), data.model_dump())


@router.get("/quote-requests", response_model=List[schemas.QuoteRequestOut])
async def list_quote_requests(user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db), estado: Optional[str] = None):
    return await service.list_quote_requests(db, _cid(user), estado)


# ============================================================
# REVIEWS
# ============================================================
@router.post("/technicians/{tech_id}/reviews", response_model=schemas.TechnicianReviewOut)
async def add_review(tech_id: str, data: schemas.TechnicianReviewCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.add_review(db, _cid(user), tech_id, data.model_dump())


# ============================================================
# TIME TRACKING
# ============================================================
@router.post("/work-orders/{wo_id}/time/start")
async def start_timer(wo_id: str, tecnico_id: str = Body(..., embed=True), tipo: str = Body("trabajo", embed=True),
                      user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await service.start_timer(db, _cid(user), wo_id, tecnico_id, tipo)


@router.post("/time/{timer_id}/stop")
async def stop_timer(timer_id: str, facturable: bool = True, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    r = await service.stop_timer(db, timer_id, facturable)
    if not r: raise HTTPException(404, "Timer no encontrado")
    return r
