"""Tests for supplier commercial rules model, schemas and distributor specific configurations (Paresa, Chortitzer, Trociuk)"""

import uuid
from decimal import Decimal
import pytest
from api.src.purchases.schemas import SupplierCreate, SupplierUpdate, SupplierResponse
from api.src.purchases.models import Supplier


class TestSupplierRulesSchemas:
    def test_supplier_create_defaults(self):
        company_id = uuid.uuid4()
        data = SupplierCreate(
            company_id=company_id,
            razon_social="Proveedor Genérico S.A.",
            ruc="80001234-5"
        )
        assert data.admite_bonificaciones is False
        assert data.control_envases is False
        assert data.vida_util_minima_dias == 0
        assert data.unidad_compra_minima == "unidad"
        assert data.escalas_costo_volumen is None

    def test_supplier_paresa_rules(self):
        """Paresa: Bonificaciones y control de envases retornables"""
        company_id = uuid.uuid4()
        data = SupplierCreate(
            company_id=company_id,
            razon_social="PARAGUAY REFRESCOS S.A. (PARESA)",
            ruc="80003058-2",
            admite_bonificaciones=True,
            control_envases=True,
            unidad_compra_minima="fardo"
        )
        assert data.admite_bonificaciones is True
        assert data.control_envases is True
        assert data.unidad_compra_minima == "fardo"

    def test_supplier_chortitzer_rules(self):
        """Chortitzer: Control estricto de vida útil en muelle (lácteos)"""
        company_id = uuid.uuid4()
        data = SupplierCreate(
            company_id=company_id,
            razon_social="COOPERATIVA CHORTITZER LTDA",
            ruc="80001099-7",
            vida_util_minima_dias=20,
            unidad_compra_minima="caja"
        )
        assert data.vida_util_minima_dias == 20
        assert data.unidad_compra_minima == "caja"

    def test_supplier_trociuk_rules(self):
        """Trociuk: Unidades en bolsas de 50kg / toneladas y escalas por volumen"""
        company_id = uuid.uuid4()
        escalas = {
            "escalas": [
                {"desde_kg": 5000, "descuento_pct": 3.0},
                {"desde_kg": 10000, "descuento_pct": 6.0}
            ]
        }
        data = SupplierCreate(
            company_id=company_id,
            razon_social="TROCIUK Y COMPAÑIA AGISA",
            ruc="80005555-1",
            unidad_compra_minima="bolsa_50kg",
            escalas_costo_volumen=escalas
        )
        assert data.unidad_compra_minima == "bolsa_50kg"
        assert data.escalas_costo_volumen == escalas

    def test_supplier_update_rules(self):
        update = SupplierUpdate(
            admite_bonificaciones=True,
            control_envases=True,
            vida_util_minima_dias=15,
            unidad_compra_minima="pack_12",
            escalas_costo_volumen={"flete_incluido": True}
        )
        dumped = update.model_dump(exclude_unset=True)
        assert dumped["admite_bonificaciones"] is True
        assert dumped["control_envases"] is True
        assert dumped["vida_util_minima_dias"] == 15
        assert dumped["unidad_compra_minima"] == "pack_12"
        assert dumped["escalas_costo_volumen"] == {"flete_incluido": True}


class TestSupplierModelColumns:
    def test_model_has_supplier_rules_columns(self):
        """Check that SQLAlchemy Supplier model has the new rule columns"""
        columns = {c.name for c in Supplier.__table__.columns}
        assert "admite_bonificaciones" in columns
        assert "control_envases" in columns
        assert "vida_util_minima_dias" in columns
        assert "unidad_compra_minima" in columns
        assert "escalas_costo_volumen" in columns
