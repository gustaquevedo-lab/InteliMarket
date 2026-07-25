"""Balmak Edge driver — hybrid: Toledo P03 for weight + SDL file-based for PLU/labels

The Balmak Edge is a "balança computadora" with:
- Wi-Fi / Ethernet connectivity
- Integrated thermal printer
- DGI/RGI (file-based import/export for product/PLU sync)
- Compatible with Toledo P03 protocol for weight reading
- SDL software for management

For weight reading: uses ToledoP03Driver via TCP (port 9000 default)
For PLU sync: generates SDL-compatible CSV/TXT files and pushes via SMB/HTTP
For label printing: sends label commands directly to the scale's printer

SDL File Format (tab-delimited):
  PLU\tDESCRIPTION\tPRICE\tTARE\tBARCODE\tSHELF_LIFE\tNUTRITION_INFO
"""

import csv
import io
import os
from decimal import Decimal
from datetime import datetime
from typing import Optional

from api.src.integrations.scales.drivers.base import ScaleDriver, ScaleConfig, WeightReading, ConnectionStatus, PLUResult, LabelData
from api.src.integrations.scales.drivers.toledo_p03 import ToledoP03Driver


class BalmakEdgeDriver(ScaleDriver):
    """Balmak Edge — weight via P03 over TCP, PLU via SDL file, label via ESC/POS-like commands."""

    def __init__(self, config: ScaleConfig):
        super().__init__(config)
        self._weight_driver = ToledoP03Driver(config)

    async def connect(self) -> bool:
        return await self._weight_driver.connect()

    async def disconnect(self):
        await self._weight_driver.disconnect()
        self._connected = False

    async def read_weight(self) -> WeightReading:
        return await self._weight_driver.read_weight()

    async def tare(self) -> Optional[Decimal]:
        return await self._weight_driver.tare()

    async def zero(self) -> bool:
        return await self._weight_driver.zero()

    async def test_connection(self) -> ConnectionStatus:
        return await self._weight_driver.test_connection()

    async def sync_plu(self, productos: list[dict]) -> PLUResult:
        """Generate SDL-compatible CSV and write to ruta_carga or return content."""
        result = PLUResult(total_productos=len(productos))
        output = io.StringIO()
        writer = csv.writer(output, delimiter="\t")
        errors = []
        ok = 0

        for p in productos:
            try:
                plu = p.get("codigo") or p.get("sku") or p.get("id", "")[:20]
                nombre = (p.get("nombre") or "Producto")[:40]
                precio = p.get("precio_venta") or p.get("precio", 0)
                tara = p.get("tara", 0)
                barcode = p.get("codigo_barras") or p.get("barcode", "")
                vida_util = p.get("vida_util_dias", "")
                writer.writerow([plu, nombre, precio, tara, barcode, vida_util])
                ok += 1
            except Exception as e:
                errors.append({"producto_id": p.get("id"), "error": str(e)})

        content = output.getvalue()

        if self.config.ruta_carga:
            os.makedirs(self.config.ruta_carga, exist_ok=True)
            fname = f"plu_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
            fpath = os.path.join(self.config.ruta_carga, fname)
            with open(fpath, "w", encoding="utf-8") as f:
                f.write(content)
            result.archivo_generado = fpath

        result.exitosos = ok
        result.fallidos = len(errors)
        result.errores = errors
        return result

    async def print_label(self, label: LabelData) -> bool:
        """Send label commands to the scale's integrated printer via TCP."""
        try:
            if not self._weight_driver._connected:
                await self.connect()

            lines = [
                f"\x1b\x61\x01{label.producto_nombre[:40]}",
                f"\x1b\x61\x01{'=' * 20}",
                f"\x1b\x61\x00Peso: {label.peso_kg:.3f} kg",
                f"\x1b\x61\x00P.Unit: Gs {label.precio_unitario:,.0f}",
                f"\x1b\x61\x01TOTAL: Gs {label.precio_total:,.0f}",
            ]
            if label.fecha_vencimiento:
                lines.append(f"\x1b\x61\x00Vence: {label.fecha_vencimiento}")
            if label.lote:
                lines.append(f"\x1b\x61\x00Lote: {label.lote}")
            if label.codigo_barras:
                barcode_cmd = f"\x1d\x6b{chr(len(label.codigo_barras) + 2)}{label.codigo_barras}"
                lines.append(barcode_cmd)
            lines.append("\n\n\n")

            payload = "\n".join(lines).encode("utf-8")
            self._weight_driver._writer.write(payload)
            await self._weight_driver._writer.drain()
            return True
        except Exception as e:
            raise RuntimeError(f"Label print failed: {e}")

    async def send_raw_command(self, command: bytes) -> Optional[bytes]:
        return await self._weight_driver.send_raw_command(command)
