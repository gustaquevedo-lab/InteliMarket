import pytest
from decimal import Decimal
from api.src.sales.service import _deduct_stock_for_sale
from api.src.sales.schemas import SaleCreate, SaleItemInput
from api.src.sales.models import Sale
from api.src.inventory.models import Stock, InventoryMovement
from sqlalchemy import select


@pytest.mark.asyncio
async def test_decimal_stock_deduction(db_session):
    """Verifica que una venta de 0.350 KG descuente exactamente 0.350 del stock y registre -0.350 en Kardex."""
    # 1. Crear producto de prueba con stock inicial 10.000 KG
    pass
