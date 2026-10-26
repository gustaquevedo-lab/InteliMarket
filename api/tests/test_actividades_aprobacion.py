from decimal import Decimal
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from api.src.credit_accounts.models import CreditApprovalRequest
from api.src.sales.models import Sale, SaleItem


@pytest.mark.asyncio
async def test_crear_pedido_aprobacion_sin_credit_account_id():
    from api.src.credit_accounts.service import create_approval_request

    company_id = uuid.uuid4()
    sale_id = uuid.uuid4()
    customer_id = uuid.uuid4()

    db = AsyncMock()
    # Mock no existing request
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = None
    db.execute.return_value = mock_res

    req = await create_approval_request(
        db, company_id, sale_id, customer_id,
        credit_account_id=None,
        monto=Decimal("150000"),
        motivo="actividades",
        detalle=[{"motivo": "descuento_distinto"}],
    )

    assert req.credit_account_id is None
    assert req.motivo == "actividades"
    assert req.detalle == [{"motivo": "descuento_distinto"}]
    db.add.assert_called_once()


@pytest.mark.asyncio
async def test_segundo_motivo_sobre_mismo_sale_id_se_fusiona():
    from api.src.credit_accounts.service import create_approval_request

    company_id = uuid.uuid4()
    sale_id = uuid.uuid4()
    customer_id = uuid.uuid4()
    credit_account_id = uuid.uuid4()

    existing_req = CreditApprovalRequest(
        id=uuid.uuid4(),
        company_id=company_id,
        sale_id=sale_id,
        customer_id=customer_id,
        credit_account_id=None,
        monto=Decimal("150000"),
        motivo="actividades",
        detalle=[{"motivo": "descuento_distinto"}],
    )

    db = AsyncMock()
    mock_res = MagicMock()
    mock_res.scalar_one_or_none.return_value = existing_req
    db.execute.return_value = mock_res

    # Segundo motivo: credito
    req = await create_approval_request(
        db, company_id, sale_id, customer_id,
        credit_account_id=credit_account_id,
        monto=Decimal("150000"),
        motivo="credito",
    )

    assert req is existing_req
    assert "actividades" in req.motivo
    assert "credito" in req.motivo
    assert req.credit_account_id == credit_account_id


@pytest.mark.asyncio
async def test_corregir_deja_los_descuentos_del_servidor():
    from api.src.credit_accounts.service import resolver_aprobacion_actividades

    company_id = uuid.uuid4()
    sale_id = uuid.uuid4()
    req_id = uuid.uuid4()
    user_id = uuid.uuid4()
    prod_id = uuid.uuid4()
    act_srv_id = uuid.uuid4()

    req = MagicMock(spec=CreditApprovalRequest)
    req.id = req_id
    req.sale_id = sale_id
    req.estado = "pendiente"
    req.motivo = "actividades"
    # detalle tiene lo que el servidor calculó
    req.detalle = [
        {
            "product_id": str(prod_id),
            "motivo": "descuento_distinto",
            "celular": {"descuento_unitario": "800", "actividad_id": "act-old"},
            "servidor": {"descuento_unitario": "500", "actividad_id": str(act_srv_id)},
        }
    ]

    sale = MagicMock(spec=Sale)
    sale.id = sale_id
    sale.company_id = company_id
    sale.condicion = "contado"
    sale.estado = "pendiente_aprobacion"

    item = MagicMock(spec=SaleItem)
    item.product_id = prod_id
    item.cantidad = Decimal("10")
    item.precio_unitario = Decimal("10000")
    item.descuento_unitario = Decimal("800")
    item.descuento_monto = Decimal("8000")
    item.descuento_pct = Decimal("0")
    item.iva_tasa = Decimal("10")
    item.total = Decimal("92000")
    item.actividad_id = uuid.uuid4()

    db = AsyncMock()

    with patch("api.src.credit_accounts.service.get_approval_request", return_value=req), \
         patch("api.src.sales.service.get_sale", return_value=sale), \
         patch("api.src.sales.service.get_sale_items", return_value=[{"product_id": prod_id, "cantidad": 10, "precio_unitario": 10000, "descuento_pct": 0, "iva_tasa": 10}]), \
         patch("api.src.sales.service._deduct_stock_for_sale"), \
         patch("api.src.actividades.service.consumir") as mock_consumir:

        # Simular que db.execute sobre SaleItem devuelve [item]
        mock_items_res = MagicMock()
        mock_items_res.scalars().all.return_value = [item]
        db.execute.return_value = mock_items_res

        res = await resolver_aprobacion_actividades(db, str(req_id), "corregir", user_id)

        assert res["success"] is True
        assert sale.estado == "confirmado"
        # Item fue actualizado con descuento_unitario del servidor
        assert item.descuento_monto == Decimal("5000")
        assert item.actividad_id == act_srv_id
        mock_consumir.assert_called_once()


@pytest.mark.asyncio
async def test_con_credito_pendiente_no_confirma():
    from api.src.credit_accounts.service import resolver_aprobacion_actividades

    company_id = uuid.uuid4()
    sale_id = uuid.uuid4()
    req_id = uuid.uuid4()
    user_id = uuid.uuid4()

    req = MagicMock(spec=CreditApprovalRequest)
    req.id = req_id
    req.sale_id = sale_id
    req.estado = "pendiente"
    req.motivo = "actividades, credito"
    req.detalle = []

    sale = MagicMock(spec=Sale)
    sale.id = sale_id
    sale.company_id = company_id
    sale.condicion = "credito"
    sale.estado = "pendiente_aprobacion"

    db = AsyncMock()

    with patch("api.src.credit_accounts.service.get_approval_request", return_value=req), \
         patch("api.src.sales.service.get_sale", return_value=sale), \
         patch("api.src.actividades.service.consumir") as mock_consumir:

        res = await resolver_aprobacion_actividades(db, str(req_id), "aprobar", user_id)

        assert res["success"] is True
        # Debe permanecer pendiente_aprobacion porque falta resolver credito
        assert sale.estado == "pendiente_aprobacion"
        assert "credito" in req.motivo
        assert "actividades" not in req.motivo
        # No debe consumir aun
        mock_consumir.assert_not_called()
