"""Balmak Edge driver — hybrid: Toledo P03 for weight + SDL file-based for PLU/labels

The Balmak Edge is a "balança computadora" running Novatek's SDL management
software (found installed as `C:\\Program Files (x86)\\EDGE\\EDGE\\SDL.exe` on
the client's scale-management PC, Extra Supermercado, 26-ago-2026).

For weight reading: uses ToledoP03Driver via TCP (port 9000 default) --
unconfirmed for this specific model, kept as-is (out of scope, POS checkout
scale integration already solved separately).

For PLU sync: writes a fixed-width text file, one 284-byte record per
product, CRLF-terminated. Format reverse-engineered from a real file already
accepted by the client's SDL install (`SDLtxt.tmp`, 348 real products):

  bytes[0:2]    "01"            constante (idéntica en las 348 filas reales)
  bytes[2:9]    PLU             7 dígitos, zero-padded (p.ej. "1000001")
  bytes[9:18]   PRECIO          9 dígitos, zero-padded = precio_real * 1000
  bytes[18:68]  NOMBRE          50 chars, CP1252, espacio-padded/truncado
  bytes[68:284] (reservado)     216 bytes -- idénticos en las 348 filas
                                 reales (impuestos/fechas/etiqueta sin usar
                                 por este cliente), se copian tal cual

For label printing: sends label commands directly to the scale's printer
(unconfirmed format, kept as-is -- fuera de alcance de esta investigación).
"""

import os
from datetime import datetime
from decimal import Decimal
from typing import Optional

from api.src.integrations.scales.drivers.base import ScaleDriver, ScaleConfig, WeightReading, ConnectionStatus, PLUResult, LabelData
from api.src.integrations.scales.drivers.toledo_p03 import ToledoP03Driver

# Cola de 216 bytes idéntica en las 348 filas reales de SDLtxt.tmp (26-ago-2026,
# extraído vía WinRM de la PC de compras que administra la balanza). Campos
# opcionales de SDL (impuestos, fechas de venc/empaque, etiqueta) que este
# cliente nunca configuró -- se replica tal cual para no romper el import.
_SDL_RECORD_TAIL = (
    "0000000000000000000000                       "
    "0000000000000000000000000000000000000000000||"
    "                                                                      "
    "0000000000000000000000000||0||            00000000000000"
)


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
        """Write a fixed-width SDL PLU file (see module docstring for the real
        284-byte record layout) to ruta_carga.

        Productos sin `plu_balanza` se saltean: no hay forma segura de
        inventarles un PLU nuevo sin colisionar con el catálogo ya cargado
        en la balanza (numeración propia del software SDL, sin relación con
        ningún ID de InteliMarket ni del ERP legacy)."""
        result = PLUResult(total_productos=len(productos))
        records = []
        errors = []
        ok = 0

        for p in productos:
            try:
                plu_balanza = p.get("plu_balanza")
                if not plu_balanza:
                    errors.append({"producto_id": p.get("id"), "error": "sin plu_balanza asignado"})
                    continue
                plu = f"{int(plu_balanza):07d}"
                if len(plu) != 7:
                    raise ValueError(f"plu_balanza fuera de rango (7 digitos): {plu_balanza}")
                precio = p.get("precio_venta") or p.get("precio") or 0
                precio_field = f"{round(float(precio) * 1000):09d}"
                nombre = (p.get("nombre") or "")[:50].ljust(50)
                record = f"01{plu}{precio_field}{nombre}{_SDL_RECORD_TAIL}"
                records.append(record.encode("cp1252", errors="replace"))
                ok += 1
            except Exception as e:
                errors.append({"producto_id": p.get("id"), "error": str(e)})

        content = b"\r\n".join(records)
        if records:
            content += b"\r\n"

        if self.config.ruta_carga and records:
            os.makedirs(self.config.ruta_carga, exist_ok=True)
            fname = f"plu_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.txt"
            fpath = os.path.join(self.config.ruta_carga, fname)
            with open(fpath, "wb") as f:
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
