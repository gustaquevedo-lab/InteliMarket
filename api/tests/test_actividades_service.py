from decimal import Decimal
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from api.src.actividades.models import Actividad, ActividadAplicacion
from api.src.sales.models import Sale, SaleItem


@pytest.mark.asyncio
async def test_consumir_agrega_aplicacion_y_suma_consumido():
    from api.src.actividades.service import consumir

    company_id = uuid.uuid4()
    sale_id = uuid.uuid4()
    item_id = uuid.uuid4()
    act_id = uuid.uuid4()

    sale = MagicMock(spec=Sale)
    sale.id = sale_id
    sale.company_id = company_id

    item = MagicMock(spec=SaleItem)
    item.id = item_id
    item.actividad_id = act_id
    item.cantidad = Decimal("12")
    item.precio_unitario = Decimal("16884")
    item.descuento_monto = Decimal("10140")
    item.total = Decimal("192468")
    item.costo_unitario = Decimal("12000")

    actividad = Actividad(
        id=act_id,
        company_id=company_id,
        nombre="MARILAN 5%",
        presupuesto=Decimal("1000000"),
        consumido=Decimal("0"),
        valoriza_bonificacion="lista",
    )

    db = AsyncMock()

    # Primera query: verificar aplicaciones existentes -> vacio
    # Segunda query: sale items con actividad_id
    # Tercera query: select Actividad with_for_update
    mock_app_res = MagicMock()
    mock_app_res.scalars().all.return_value = []

    mock_items_res = MagicMock()
    mock_items_res.scalars().all.return_value = [item]

    mock_act_res = MagicMock()
    mock_act_res.scalar_one_or_none.return_value = actividad

    db.execute.side_effect = [mock_app_res, mock_items_res, mock_act_res]

    await consumir(db, sale)

    assert actividad.consumido == Decimal("10140")
    # Se agregó una ActividadAplicacion
    db.add.assert_called_once()
    app = db.add.call_args[0][0]
    assert isinstance(app, ActividadAplicacion)
    assert app.sale_id == sale_id
    assert app.actividad_id == act_id
    assert app.valor == Decimal("10140")


@pytest.mark.asyncio
async def test_consumir_idempotente_rf3():
    from api.src.actividades.service import consumir

    sale_id = uuid.uuid4()
    sale = MagicMock(spec=Sale)
    sale.id = sale_id

    existing_app = MagicMock(spec=ActividadAplicacion)

    db = AsyncMock()
    mock_app_res = MagicMock()
    mock_app_res.scalars().all.return_value = [existing_app]
    db.execute.return_value = mock_app_res

    await consumir(db, sale)

    # No debe agregar nada ni volver a consumir
    db.add.assert_not_called()


@pytest.mark.asyncio
async def test_liberar_resta_y_borra_rf5():
    from api.src.actividades.service import liberar

    company_id = uuid.uuid4()
    sale_id = uuid.uuid4()
    act_id = uuid.uuid4()

    app = ActividadAplicacion(
        id=uuid.uuid4(),
        company_id=company_id,
        actividad_id=act_id,
        sale_id=sale_id,
        valor=Decimal("10140"),
    )

    actividad = Actividad(
        id=act_id,
        company_id=company_id,
        nombre="MARILAN 5%",
        presupuesto=Decimal("1000000"),
        consumido=Decimal("50000"),
    )

    db = AsyncMock()
    mock_app_res = MagicMock()
    mock_app_res.scalars().all.return_value = [app]

    mock_act_res = MagicMock()
    mock_act_res.scalar_one_or_none.return_value = actividad

    db.execute.side_effect = [mock_app_res, mock_act_res]

    await liberar(db, sale_id)

    assert actividad.consumido == Decimal("39860")
    db.delete.assert_called_once_with(app)


@pytest.mark.asyncio
async def test_consumir_usa_with_for_update_rf4():
    from api.src.actividades.service import consumir

    company_id = uuid.uuid4()
    sale_id = uuid.uuid4()
    act_id = uuid.uuid4()

    sale = MagicMock(spec=Sale)
    sale.id = sale_id
    sale.company_id = company_id

    item = MagicMock(spec=SaleItem)
    item.id = uuid.uuid4()
    item.actividad_id = act_id
    item.cantidad = Decimal("1")
    item.precio_unitario = Decimal("1000")
    item.descuento_monto = Decimal("100")
    item.total = Decimal("900")
    item.costo_unitario = Decimal("800")

    actividad = Actividad(
        id=act_id,
        company_id=company_id,
        presupuesto=Decimal("10000"),
        consumido=Decimal("0"),
        valoriza_bonificacion="lista",
    )

    db = AsyncMock()
    mock_app_res = MagicMock()
    mock_app_res.scalars().all.return_value = []

    mock_items_res = MagicMock()
    mock_items_res.scalars().all.return_value = [item]

    mock_act_res = MagicMock()
    mock_act_res.scalar_one_or_none.return_value = actividad

    queries = []
    def record_execute(stmt, *args, **kwargs):
        queries.append(stmt)
        if len(queries) == 1:
            return mock_app_res
        elif len(queries) == 2:
            return mock_items_res
        else:
            return mock_act_res

    db.execute.side_effect = record_execute

    await consumir(db, sale)

    # Verificar que la query sobre Actividad usó with_for_update
    act_query = queries[2]
    assert act_query._for_update_arg is not None
