from decimal import Decimal
import unittest
from api.src.products.models import Product


class TestProductCostAlias(unittest.TestCase):
    def test_product_cost_properties(self):
        p = Product()
        p.ultimo_costo = Decimal("1000")
        p.costo_promedio = Decimal("950")

        self.assertEqual(p.costo_unitario, Decimal("1000"))
        self.assertEqual(p.precio_costo, Decimal("950"))

        p.costo_promedio = None
        self.assertEqual(p.precio_costo, Decimal("1000"))

        p.precio_costo = Decimal("1200")
        self.assertEqual(p.costo_promedio, Decimal("1200"))
