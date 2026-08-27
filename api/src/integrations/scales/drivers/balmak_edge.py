"""Balmak Edge driver — TCP directo al protocolo real de SDL (Novatek).

Protocolo capturado y decodificado en vivo (26-ago-2026, tcpdump/pktmon
contra la PC de Compras -- `192.168.0.231` -- y las 3 balanzas físicas de
Extra Supermercado durante un envío real desde SDL.exe). NO es binario: es
texto plano, BOM UTF-8 al inicio de cada mensaje, líneas separadas por
`\\r\\n`, campos separados por tab. Reemplaza a `SDL.exe` -- no depende de
Windows ni del software del fabricante.

Balanzas confirmadas (mismo catálogo completo a las 3, ver INF de cada una):
  192.168.0.72:4011 -> CARNICERIA1  (MDS-33A+ CC003 V6.55D)
  192.168.0.73:4001 -> PANADERIA
  192.168.0.74:4010 -> CARNICERIA

Comandos observados:
  UPL\\tINF\\t              -> pide info de la balanza
    resp: DWL\\tINF\\t\\r\\nINF\\t<depto>\\t<depto>\\t1\\t<modelo>\\t0\\t1\\t<serial>\\t\\r\\nEND\\tINF\\t
  DWL\\tTIM\\t\\r\\nTIM\\t<yy>\\t<mm>\\t<dd>\\t<hh>\\t<mi>\\t<ss>\\t  -> sincroniza hora
    resp: DWL\\tTIM\\t<YYYYMMDDHHMMSS>\\t1\\t\\r\\nTIM\\t...\\r\\nEND\\tTIM\\t1\\t\\t
  DWL\\tPLU\\t\\r\\n\\r\\n<record>\\r\\n<record>...\\r\\nEND\\tPLU\\t  -> carga catálogo completo
    resp: DWL\\tPLU\\t<YYYYMMDDHHMMSS>\\t1\\t\\r\\nEND\\tPLU\\t1\\t\\t

OJO -- el orden real de TIM es <yy>\\t<mm>\\t<dd>, NO <dd>\\t<mm>\\t<yy> como
parecía sugerir la primera captura (donde día y año coincidían en 26 y no
se podía distinguir el orden). Se confirmó mal en una prueba en vivo
27-ago-2026: mandar "27\\t8\\t26" (con la intención día=27,mes=8,año=26)
la balanza lo interpretó como año=2027,mes=8,día=26 (eco: "20270826...").
Corregido acá; si se vuelve a tocar este campo, verificar contra una fecha
donde día y año NO coincidan, no contra los primeros días del mes.

Cada `<record>` tiene 148 campos separados por tab (constante en las 505
filas reales capturadas). Solo 3 varían por producto: PLUID (campo 1),
precio (campo 5, formato `<entero>,0`) y nombre (campo 15). El resto es una
plantilla fija que SDL siempre envía igual (impuestos, promociones y demás
campos que este cliente nunca configuró) -- se replica tal cual para no
romper el import, tomada byte a byte de un registro real (`PLU 1 = ML
PICAÑA/TAPA CUADRIL KG, Gs 77.777`) confirmado contra `SDL.mdb`.

El PLU (`products.plu_balanza`) es global y ya viene resuelto para 504/505
productos reales (ver HANDOFF_SUPERMERCADO.md, sección INTEGRACIÓN BALANZAS
BALMAK EDGE) -- no se inventa un PLU nuevo acá, se usa el que ya está
asignado.

CONFIRMADO EN VIVO (27-ago-2026, PLU 7 = costilla, Gs 29.000, contra
CARNICERIA1): la balanza acepta el push de PLU con ack en todos los casos,
pero **el precio nuevo no se refleja en el visor físico si la balanza nunca
recibió un TIM válido en esa sesión** -- el primer push (sin TIM previo)
quedó "aceptado" pero invisible; recién después de un TIM correcto se vio
el cambio real en el display. Por eso `sync_plu()` manda TIM automáticamente
antes de cada push de PLU.

Para peso/impresión de etiqueta (no investigado en esta sesión, fuera de
alcance -- la báscula de checkout ya está integrada por un flujo aparte):
se mantiene el fallback previo vía ToledoP03Driver, sin cambios.
"""

import asyncio
import time
from datetime import datetime
from decimal import Decimal
from typing import Optional

from api.src.integrations.scales.drivers.base import ScaleDriver, ScaleConfig, WeightReading, ConnectionStatus, PLUResult, LabelData
from api.src.integrations.scales.drivers.toledo_p03 import ToledoP03Driver

_BOM = b"\xef\xbb\xbf"

# Plantilla real de un registro PLU (148 campos tab-delimited), extraída
# byte a byte de una captura de red real (PLU 1, ML PICAÑA/TAPA CUADRIL KG,
# Gs 77.777, confirmado contra SDL.mdb). Solo se sobreescriben los índices
# 1 (PLUID), 5 (precio) y 15 (nombre) -- el resto es constante en las 505
# filas reales observadas.
_PLU_TEMPLATE_FIELDS = [
    'PLU',  # 0
    '1',  # 1  (PLUID -- sobreescrito por producto)
    '0', '', '3',  # 2-4
    '77777,0',  # 5  (precio -- sobreescrito por producto)
    '0,0', '0,0', '0', '0', '0', '0', '0', '0', '1',  # 6-14
    'ML PICAÑA/TAPA CUADRIL KG',  # 15  (nombre -- sobreescrito por producto)
    '', '', '', '', '', '', '',  # 16-22
    '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0',  # 23-33
    '0',  # 34
    '0,0', '0,0', '0', '0',  # 35-38
    '0,0', '0,0', '0,0', '0', '0',  # 39-43
    '0,0', '0,0', '0,0', '0', '0',  # 44-48
    '0,0', '0,0', '0,0', '0', '0',  # 49-53
    '0,0', '0,0', '0,0', '0', '0', '0',  # 54-59
    '0,0', '0', '0',  # 60-62
    '0,0', '0,0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0', '0',  # 63-75
    '0,0', '0', '0,0',  # 76-78
    '', '', '', '', '', '', '', '', '', '', '', '',  # 79-90
    '', '0', '0',  # 91-93
    '0,0', '0,0', '0,0', '0', '0',  # 94-98
    '0,0', '0,0', '0,0',  # 99-101
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',  # 102-121
    '4',  # 122
    '0,0', '1,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0',  # 123-133
    '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0', '0,0',  # 134-146
    '',  # 147
]
assert len(_PLU_TEMPLATE_FIELDS) == 148, len(_PLU_TEMPLATE_FIELDS)


def _build_plu_record(plu_id: int, precio: Decimal, nombre: str) -> str:
    fields = list(_PLU_TEMPLATE_FIELDS)
    fields[1] = str(plu_id)
    fields[5] = f"{int(round(precio))},0"
    fields[15] = nombre
    return "\t".join(fields)


class BalmakEdgeDriver(ScaleDriver):
    """Balmak Edge — PLU/info vía TCP directo (protocolo SDL real); peso/etiqueta sin confirmar (fallback Toledo P03)."""

    def __init__(self, config: ScaleConfig):
        super().__init__(config)
        self._weight_driver = ToledoP03Driver(config)

    async def _open(self):
        if not self.config.host:
            raise RuntimeError("Balanza sin host configurado")
        return await asyncio.wait_for(
            asyncio.open_connection(self.config.host, self.config.puerto_tcp),
            timeout=self.config.timeout,
        )

    async def connect(self) -> bool:
        status = await self.test_connection()
        self._connected = status.conectada
        return self._connected

    async def disconnect(self):
        self._connected = False

    async def read_weight(self) -> WeightReading:
        return await self._weight_driver.read_weight()

    async def tare(self) -> Optional[Decimal]:
        return await self._weight_driver.tare()

    async def zero(self) -> bool:
        return await self._weight_driver.zero()

    async def test_connection(self) -> ConnectionStatus:
        """Consulta INF real de la balanza (departamento, modelo, serial)."""
        start = time.monotonic()
        try:
            reader, writer = await self._open()
            try:
                writer.write(_BOM + b"\r\nUPL\tINF\t\r\n")
                await writer.drain()
                raw = await asyncio.wait_for(reader.readuntil(b"END\tINF"), timeout=self.config.timeout)
                writer.write(b"UPL\tEND\t\r\n")
                await writer.drain()
            finally:
                writer.close()
            latencia_ms = int((time.monotonic() - start) * 1000)

            text = raw.decode("utf-8", errors="replace")
            inf_line = next((l for l in text.split("\r\n") if l.startswith("INF\t")), "")
            info = inf_line.split("\t")
            depto = info[1] if len(info) > 1 else "?"
            modelo = info[4] if len(info) > 4 else "?"
            serial = info[7] if len(info) > 7 else "?"
            return ConnectionStatus(
                conectada=True,
                protocolo_detectado="balmak_sdl",
                mensaje=f"{depto} · {modelo} · S/N {serial}",
                latencia_ms=latencia_ms,
            )
        except Exception as e:
            return ConnectionStatus(conectada=False, mensaje=str(e))

    async def _sync_time(self, reader, writer):
        """Sincroniza la hora de la balanza. Necesario -- comprobado en vivo -- para
        que un push de PLU posterior en la misma sesión se refleje en el visor."""
        now = datetime.now()
        tim = f"{now.year % 100}\t{now.month}\t{now.day}\t{now.hour}\t{now.minute}\t{now.second}\t"
        writer.write(_BOM + f"\r\nDWL\tTIM\t\r\nTIM\t{tim}\r\nEND\tTIM\t\r\n".encode("utf-8"))
        await writer.drain()
        await asyncio.wait_for(reader.readuntil(b"END\tTIM"), timeout=self.config.timeout)

    async def sync_plu(self, productos: list[dict]) -> PLUResult:
        """Empuja el catálogo completo directo a la balanza vía TCP (protocolo SDL real).

        Productos sin `plu_balanza` se saltean -- ese campo ya viene resuelto
        (504/505 productos reales, cruzado por código de barras contra
        `SDL.mdb`), no se inventa un PLU nuevo acá."""
        result = PLUResult(total_productos=len(productos))
        records: list[str] = []
        errors: list[dict] = []

        for p in productos:
            plu_balanza = p.get("plu_balanza")
            if not plu_balanza:
                errors.append({"producto_id": p.get("id"), "error": "sin plu_balanza asignado"})
                continue
            try:
                precio = Decimal(str(p.get("precio_venta") or p.get("precio") or 0))
                nombre = p.get("nombre") or ""
                records.append(_build_plu_record(int(plu_balanza), precio, nombre))
            except Exception as e:
                errors.append({"producto_id": p.get("id"), "error": str(e)})

        if not records:
            result.fallidos = len(errors)
            result.errores = errors
            return result

        body = "\r\n".join(records)
        payload = _BOM + f"\r\nDWL\tPLU\t\r\n\r\n{body}\r\nEND\tPLU\t\r\n".encode("utf-8")

        reader, writer = await self._open()
        try:
            await self._sync_time(reader, writer)
            writer.write(payload)
            await writer.drain()
            ack = await asyncio.wait_for(reader.readuntil(b"END\tPLU"), timeout=max(self.config.timeout, 15))
        finally:
            writer.close()

        ack_text = ack.decode("utf-8", errors="replace")
        if "DWL\tPLU" not in ack_text:
            raise RuntimeError(f"La balanza no confirmó la carga del catálogo: {ack_text!r}")

        result.exitosos = len(records)
        result.fallidos = len(errors)
        result.errores = errors
        return result

    async def print_label(self, label: LabelData) -> bool:
        """Sin confirmar contra hardware real -- fuera de alcance de esta sesión."""
        try:
            if not self._weight_driver._connected:
                await self._weight_driver.connect()

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
