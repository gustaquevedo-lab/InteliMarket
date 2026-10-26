import pytest
from sqlalchemy import inspect

def test_tablas_actividades():
    from api.src.actividades.models import Actividad, ActividadTramo, ActividadAplicacion, ActividadRendicion
    from api.src.sales.models import SaleItem
    from api.src.products.models import Product
    from api.src.financial.models import SupplierCreditNote
    from api.src.credit_accounts.models import CreditApprovalRequest

    assert Actividad.__tablename__ == "actividades"
    assert {"presupuesto", "consumido", "valoriza_bonificacion", "alcance", "alcance_ids", "legacy_id"} <= set(Actividad.__table__.c.keys())
    assert ActividadTramo.__tablename__ == "actividad_tramos"
    assert ActividadAplicacion.__tablename__ == "actividad_aplicaciones"
    assert ActividadRendicion.__tablename__ == "actividad_rendiciones"

    # Verificamos columnas agregadas a modelos existentes
    assert "actividad_id" in SaleItem.__table__.c.keys()
    assert "unidades_por_caja" in Product.__table__.c.keys()
    assert "division_id" in Product.__table__.c.keys()
    assert "rendicion_id" in SupplierCreditNote.__table__.c.keys()
    assert "motivo" in CreditApprovalRequest.__table__.c.keys()
    assert "detalle" in CreditApprovalRequest.__table__.c.keys()
    assert CreditApprovalRequest.__table__.c.credit_account_id.nullable is True
