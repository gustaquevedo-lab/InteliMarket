"""Toledo P03 protocol driver — most universal for Brazilian scales (Balmak, Toledo, Filizola compatible)

Protocol:
- Command: ENQ (0x05)
- Response: STX (0x02) + status(1) + weight(6) + terminator(1) + ETX (0x03) + checksum(2)
- Weight format: 6 ASCII digits, e.g. "001500" = 1.500kg
- Status byte: bit 6 = stable (0=stable), bit 5 = sign (0=positive), bit 0 = under/over range

Supports both RS-232 serial and TCP/IP (port 9000 is default for Toledo/MGV).
"""

import asyncio
from decimal import Decimal
from typing import Optional

from api.src.integrations.scales.drivers.base import ScaleDriver, ScaleConfig, WeightReading, ConnectionStatus

ENQ = b"\x05"
STX = b"\x02"
ETX = b"\x03"
ACK = b"\x06"
NAK = b"\x15"


class ToledoP03Driver(ScaleDriver):
    """P03 protocol — works with Toledo, Balmak (compatible), Filizola (compatible)."""

    def __init__(self, config: ScaleConfig):
        super().__init__(config)
        self._reader: Optional[asyncio.StreamReader] = None
        self._writer: Optional[asyncio.StreamWriter] = None
        self._lock = asyncio.Lock()

    async def connect(self) -> bool:
        try:
            if self.config.host and self.config.puerto_tcp:
                self._reader, self._writer = await asyncio.wait_for(
                    asyncio.open_connection(self.config.host, self.config.puerto_tcp),
                    timeout=self.config.timeout,
                )
            elif self.config.puerto_com:
                try:
                    import serial_asyncio
                    self._reader, self._writer = await serial_asyncio.open_serial_connection(
                        url=self.config.puerto_com,
                        baudrate=self.config.baudrate,
                        bytesize=self.config.data_bits,
                        parity=self.config.paridad[0].upper() if self.config.paridad else "N",
                        stopbits=float(self.config.stop_bits) if self.config.stop_bits else 1.0,
                        timeout=self.config.timeout,
                    )
                except ImportError:
                    raise RuntimeError("serial_asyncio required for serial scales. pip install pyserial-asyncio")
            else:
                raise ValueError("Must provide host:port (TCP) or puerto_com (serial)")
            self._connected = True
            return True
        except Exception as e:
            self._connected = False
            raise ConnectionError(f"Cannot connect to scale: {e}")

    async def disconnect(self):
        if self._writer:
            try:
                self._writer.close()
                if hasattr(self._writer, "wait_closed"):
                    await self._writer.wait_closed()
            except Exception:
                pass
        self._reader = None
        self._writer = None
        self._connected = False

    async def read_weight(self) -> WeightReading:
        if not self._connected:
            await self.connect()
        async with self._lock:
            self._writer.write(ENQ)
            await self._writer.drain()
            raw = await asyncio.wait_for(self._reader.read(11), timeout=self.config.timeout)
        if len(raw) < 11:
            raise ConnectionError(f"Short response: {raw.hex()}")
        if raw[0:1] != STX or raw[8:9] != ETX:
            raise ConnectionError(f"Invalid frame: {raw.hex()}")
        status = raw[1]
        peso_str = raw[2:8].decode("ascii", errors="replace").strip()
        try:
            peso_g = int(peso_str)
        except ValueError:
            raise ConnectionError(f"Invalid weight data: {peso_str}")
        peso_kg = Decimal(peso_g) / Decimal("1000")
        estable = bool(status & 0x40)
        if status & 0x20:
            peso_kg = -peso_kg
        return WeightReading(
            peso_bruto=abs(peso_kg),
            peso_neto=abs(peso_kg),
            tara=Decimal("0"),
            estable=estable,
            raw_response=raw.hex(),
        )

    async def tare(self) -> Optional[Decimal]:
        if not self._connected:
            await self.connect()
        async with self._lock:
            self._writer.write(b"\x06")
            await self._writer.drain()
            raw = await asyncio.wait_for(self._reader.read(11), timeout=self.config.timeout)
        w = await self.read_weight()
        return w.tara

    async def zero(self) -> bool:
        if not self._connected:
            await self.connect()
        async with self._lock:
            self._writer.write(b"\x15")
            await self._writer.drain()
            await asyncio.sleep(0.5)
        return True

    async def test_connection(self) -> ConnectionStatus:
        import time
        start = time.monotonic()
        try:
            w = await self.read_weight()
            latencia = int((time.monotonic() - start) * 1000)
            return ConnectionStatus(
                conectada=True,
                protocolo_detectado="toledo_p03",
                mensaje=f"P03 OK — {w.peso_bruto}kg {'estable' if w.estable else 'inestable'}",
                latencia_ms=latencia,
                peso_actual=w.peso_bruto,
            )
        except Exception as e:
            return ConnectionStatus(conectada=False, mensaje=str(e))

    async def send_raw_command(self, command: bytes) -> Optional[bytes]:
        if not self._connected:
            await self.connect()
        async with self._lock:
            self._writer.write(command)
            await self._writer.drain()
            return await asyncio.wait_for(self._reader.read(256), timeout=self.config.timeout)
