"""Tests for delivery_notes module — TDD first pass"""
import pytest
from unittest.mock import AsyncMock, MagicMock
import uuid
from decimal import Decimal
from datetime import date
from fastapi import HTTPException

CONCEPTOS = ["no_es_su_pedido", "faltante_deposito", "sin_dinero", "vencimiento_averia", "otro"]


@pytest.mark.asyncio
async def test_concepto_values_are_valid():
    """All 5 legacy concepts must be accepted by the schema."""
    from api.src.delivery_notes.schemas import DeliveryNoteCreate
    for c in CONCEPTOS:
        d = DeliveryNoteCreate(
            company_id=str(uuid.uuid4()),
            customer_id=str(uuid.uuid4()),
            numero_nota="NC-001",
            fecha=date.today(),
            monto=Decimal("100000"),
            concepto=c,
        )
        assert d.concepto == c


@pytest.mark.asyncio
async def test_apply_already_applied_note_raises_409():
    """Re-applying an already applied delivery note must raise HTTP 409."""
    from api.src.delivery_notes.service import DeliveryNoteService
    from api.src.delivery_notes.models import DeliveryNote
    from api.src.delivery_notes.schemas import DeliveryNoteApplyInput

    mock_db = AsyncMock()
    note = DeliveryNote()
    note.id = uuid.uuid4()
    note.estado = "aplicada"
    note.monto = Decimal("100000")

    mock_result = MagicMock()
    mock_result.scalar_one_or_none = MagicMock(return_value=note)
    mock_db.execute = AsyncMock(return_value=mock_result)

    svc = DeliveryNoteService(mock_db)
    with pytest.raises(HTTPException) as exc_info:
        await svc.apply(
            note.id,
            DeliveryNoteApplyInput(cobro_id=str(uuid.uuid4())),
            created_by=str(uuid.uuid4()),
        )
    assert exc_info.value.status_code == 409
