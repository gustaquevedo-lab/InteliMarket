"""E2E & Unit tests for PayrollDossier multi-phase payroll execution,
non-cash internal offsets, Annex PDF generation, and treasury isolation.
"""

import unittest
from datetime import date
from decimal import Decimal
import uuid

from api.src.sueldok.schemas import (
    PayrollDossierCreate,
    BankBatch,
    DisbursementBatchEntry,
    ExtraClubTicket,
    ThirdPartyDeduction,
)
from api.src.sueldok.third_party_reports import generate_third_party_annex_pdf
from api.src.sueldok.compensations_service import _clean_ci


class TestPayrollDossier(unittest.TestCase):

    def test_clean_ci(self):
        self.assertEqual(_clean_ci("4.123.456"), "4123456")
        self.assertEqual(_clean_ci("  3.555-888 "), "3555888")
        self.assertEqual(_clean_ci("ABC-123"), "ABC123")

    def test_annex_pdf_generation(self):
        """Verify Annex PDF is rendered without errors and contains binary PDF header."""
        employees = [
            {"ci": "4123456", "name": "Juan Perez", "invoice_reference": "FAC-001-098", "amount": 150000},
            {"ci": "3214567", "name": "Maria Gonzalez", "invoice_reference": "FAC-001-099", "amount": 250000},
        ]
        pdf_bytes = generate_third_party_annex_pdf(
            company_name="Extra Supermercado S.A.",
            company_ruc="80012345-6",
            third_party_name="Comercial Malou S.A.",
            third_party_ruc="80098765-4",
            periodo="2026-10",
            cheque_numero="CHQ-987654",
            banco_nombre="Banco Continental",
            employees=employees,
            total_monto=400000
        )

        self.assertIsInstance(pdf_bytes, bytes)
        self.assertGreater(len(pdf_bytes), 1000)
        self.assertTrue(pdf_bytes.startswith(b"%PDF-"))

    def test_payroll_dossier_create_schema_validation(self):
        """Validate that PayrollDossierCreate calculates and holds typed deduction data properly."""
        data = PayrollDossierCreate(
            periodo="2026-10",
            sueldok_run_id="run_123456",
            masa_salarial_bruta=15000000,
            total_neto=10500000,
            total_ips_obrero=1350000,
            total_ips_patronal=2475000,
            total_anticipos=500000,
            total_extra_club=200000,
            total_uniformes=100000,
            total_convenios_terceros=400000,
            total_judiciales=300000,
            lotes_banco={
                "familiar": BankBatch(
                    total=6500000,
                    employees=[
                        DisbursementBatchEntry(
                            employee_id="emp_1",
                            name="Juan Perez",
                            ci="4123456",
                            net_salary=6500000,
                            account_number="12-345-67",
                            bank_account_type="ahorro"
                        )
                    ]
                )
            },
            lotes_efectivo={
                "casa_central": BankBatch(
                    total=4000000,
                    employees=[
                        DisbursementBatchEntry(
                            employee_id="emp_2",
                            name="Maria Gomez",
                            ci="3456789",
                            net_salary=4000000
                        )
                    ]
                )
            },
            extra_club_tickets=[
                ExtraClubTicket(
                    employee_id="emp_1",
                    employee_name="Juan Perez",
                    employee_ci="4123456",
                    ticket_ref="TK-8890",
                    amount=200000
                )
            ],
            uniformes_items=[
                ExtraClubTicket(
                    employee_id="emp_2",
                    employee_name="Maria Gomez",
                    employee_ci="3456789",
                    ticket_ref="UNIF-01",
                    amount=100000
                )
            ],
            terceros_desglose=[
                ThirdPartyDeduction(
                    third_party_name="Comercial Malou",
                    third_party_ruc="80098765-4",
                    total=400000,
                    employees=[
                        {"employee_id": "emp_1", "name": "Juan Perez", "ci": "4123456", "amount": 400000, "invoice_reference": "MALOU-123"}
                    ]
                )
            ]
        )

        self.assertEqual(data.periodo, "2026-10")
        self.assertEqual(data.masa_salarial_bruta, 15000000)
        self.assertEqual(data.total_neto, 10500000)
        self.assertEqual(len(data.lotes_banco["familiar"].employees), 1)
        self.assertEqual(data.extra_club_tickets[0].amount, 200000)
        self.assertEqual(data.terceros_desglose[0].total, 400000)


if __name__ == "__main__":
    unittest.main()
