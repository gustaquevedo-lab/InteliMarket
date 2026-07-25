"""Filizola protocol driver — used by Filizola scales and some Balmak compatible models

Protocol:
- Continuous transmission mode (auto-send weight every ~100ms)
- Frame: STX (0x02) + 6 bytes weight + 1 byte flags + 1 byte terminator (0x0D)
- Weight: 6 ASCII digits, e.g. "001500" = 1.500kg
- Config: 9600 baud, 7 bits, even parity, 1 stop bit (or 8/N/1 depending on model)

Also supports command mode:
- ENQ (0x05) → request single weight reading
- Returns same frame format
"""

import asyncio
from decimal import Decimal
from typing import Optional

from api.src.integrations.scales.drivers.base import ScaleDriver, ScaleConfig, WeightReading

STX = b"\x02"
ENQ = b"\x05"
CR = b"\x0d"


class FilizolaDriver(ScaleDriver):
    """Filizola protocol — continuous or command mode."""

    async def connect(self) -> bool:
        try:
            import serial_asyncio
            parity = self.config.paridad.upper()[0] if self.config.paridad else "E"
            self._reader, self._writer = await serial_asyncio.open_serial_connection(
                url=self.config.puerto_com,
                baudrate=self.config.baudrate,
                bytesize=self.config.data_bits or 7,
                parity=parity,
                stopbits=float(self.config.stop_bits or 1),
                timeout=self.config.timeout,
            )
            self._connected = True
            return True
        except ImportError:
            raise RuntimeError("serial_asyncio required. pip install pyserial-asyncio")
        except Exception as e:
            raise ConnectionError(f"Filizola connect failed: {e}")

    async def disconnect(self):
        if self._writer:
            try:
                self._writer.close()
            except Exception:
                pass
        self._connected = False

    async def _read_frame(self) -> bytes:
        buf = bytearray()
        while True:
            b = await asyncio.wait_for(self._reader.read(1), timeout=self.config.timeout)
            if b == STX:
                buf = bytearray(b)
            elif b == CR:
                buf.extend(b)
                return bytes(buf)
            else:
                buf.extend(b)
                if len(buf) > 20:
                    raise ConnectionError("Frame too long")

    async def read_weight(self) -> WeightReading:
        if not self._connected:
            await self.connect()
        self._writer.write(ENQ)
        await self._writer.drain()
        raw = await self._read_frame()
        if len(raw) < 9:
            raise ConnectionError(f"Short frame: {raw.hex()}")
        peso_str = raw[1:7].decode("ascii", errors="replace").strip()
        flags = raw[7]
        try:
            peso_g = int(peso_str)
        except ValueError:
            raise ConnectionError(f"Invalid weight: {peso_str}")
        return WeightReading(
            peso_bruto=Decimal(peso_g) / Decimal("1000"),
            estable=not bool(flags & 0x01),
            raw_response=raw.hex(),
        )
