"""Tests for Institutional Vouchers (Vales Institucionales / Convenio Universidad del Pacífico)"""

import unittest
from datetime import date
from decimal import Decimal
import uuid

from api.src.vouchers.service import (
    normalize_barcode,
    seed_convenio_up,
    check_voucher,
    redeem_voucher,
    get_convenio_summary,
)


class TestVouchers(unittest.TestCase):
    def test_normalize_barcode(self):
        # Caso 1: Solo dígitos
        res = normalize_barcode("001")
        self.assertIn("001", res)
        self.assertIn("VALE-001", res)
        self.assertIn("VALE 001", res)

        # Caso 2: Prefijo con espacio
        res2 = normalize_barcode("VALE 002")
        self.assertIn("002", res2)
        self.assertIn("VALE-002", res2)

        # Caso 3: Texto de ticket impreso
        res3 = normalize_barcode("VALE N.º 075")
        self.assertIn("075", res3)
        self.assertIn("VALE-075", res3)


if __name__ == "__main__":
    unittest.main()

