"""Tests for sales tax calculation (Paraguayan IVA rules)"""


def calculate_iva(precio: int, tasa: float) -> dict:
    """Calculate IVA breakdown for a sale line."""
    if tasa == 10:
        base = round(precio / 1.1)
        iva = precio - base
    elif tasa == 5:
        base = round(precio / 1.05)
        iva = precio - base
    else:
        base = precio
        iva = 0
    return {"base": base, "iva": iva, "total": precio}


class TestIVA10:
    def test_iva_10_percent(self):
        result = calculate_iva(110000, 10)
        assert result["base"] == 100000
        assert result["iva"] == 10000
        assert result["total"] == 110000

    def test_iva_10_rounding(self):
        result = calculate_iva(110001, 10)
        assert result["base"] + result["iva"] == result["total"]

    def test_iva_10_large_amount(self):
        result = calculate_iva(11000000, 10)
        assert result["base"] == 10000000
        assert result["iva"] == 1000000


class TestIVA5:
    def test_iva_5_percent(self):
        result = calculate_iva(105000, 5)
        assert result["base"] == 100000
        assert result["iva"] == 5000
        assert result["total"] == 105000

    def test_iva_5_rounding(self):
        result = calculate_iva(105001, 5)
        assert result["base"] + result["iva"] == result["total"]


class TestIVAExento:
    def test_exento(self):
        result = calculate_iva(50000, 0)
        assert result["base"] == 50000
        assert result["iva"] == 0
        assert result["total"] == 50000


class TestMultipleItems:
    def test_total_calculation(self):
        items = [
            calculate_iva(110000, 10),
            calculate_iva(105000, 5),
            calculate_iva(50000, 0),
        ]
        total_base = sum(i["base"] for i in items)
        total_iva = sum(i["iva"] for i in items)
        total = sum(i["total"] for i in items)
        assert total_base + total_iva == total
        assert total == 265000
