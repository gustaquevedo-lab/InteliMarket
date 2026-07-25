"""Generic serial / Rinnert protocol driver — fallback for unknown scales

Rinnert protocol (used by Jundiaí and some Balmak):
- Request: ENQ (0x05)
- Response: STX + weight(7-8 chars) + ETX + checksum
- Weight format varies by model, usually ASCII with or without decimal point

Generic ASCII mode:
- Read line from serial, try to parse numeric value
- Configurable via extra parameters
"""

import asyncio
import re
from decimal import Decimal
from typing import Optional

from api.src.integrations.scales.drivers.base import ScaleDriver, ScaleConfig, WeightReading

ENQ = b"\x05"
STX = b"\x02"
ETX = b"\x03"


class GenericSerialDriver(ScaleDriver):
    """Generic/Rinnert — configurable serial protocol."""

    async def connect(self) -> bool:
        try:
            import serial_asyncio
            parity = self.config.paridad.upper()[0] if self.config.paridad else "N"
            self._reader, self._writer = await serial_asyncio.open_serial_connection(
                url=self.config.puerto_com,
                baudrate=self.config.baudrate,
                bytesize=self.config.data_bits or 8,
                parity=parity,
                stopbits=float(self.config.stop_bits or 1),
                timeout=self.config.timeout,
            )
            self._connected = True
            return True
        except ImportError:
            raise RuntimeError("serial_asyncio required. pip install pyserial-asyncio")
        except Exception as e:
            raise ConnectionError(f"Serial connect failed: {e}")

    async def disconnect(self):
        if self._writer:
            try:
                self._writer.close()
            except Exception:
                pass
        self._connected = False

    async def read_weight(self) -> WeightReading:
        if not self._connected:
            await self.connect()
        mode = self.config.extra.get("mode", "rinnert")
        if mode == "rinnert":
            return await self._read_rinnert()
        elif mode == "line":
            return await self._read_line()
        else:
            return await self._read_rinnert()

    async def _read_rinnert(self) -> WeightReading:
        self._writer.write(ENQ)
        await self._writer.drain()
        raw = await asyncio.wait_for(self._reader.read(32), timeout=self.config.timeout)
        if len(raw) < 5:
            raise ConnectionError(f"Short response: {raw.hex()}")
        if raw[0:1] == STX:
            weight_raw = raw[1:-2].decode("ascii", errors="replace").strip()
            weight_raw = re.sub(r"[^0-9.,\-]", "", weight_raw)
            weight_raw = weight_raw.replace(",", ".")
            try:
                peso = Decimal(weight_raw)
            except Exception:
                raise ConnectionError(f"Unparseable weight: {weight_raw}")
            return WeightReading(peso_bruto=abs(peso), raw_response=raw.hex())
        else:
            weight_raw = raw.decode("ascii", errors="replace").strip()
            weight_raw = re.sub(r"[^0-9.,\-]", "", weight_raw).replace(",", ".")
            try:
                peso = Decimal(weight_raw)
            except Exception:
                raise ConnectionError(f"Unparseable: {weight_raw}")
            return WeightReading(peso_bruto=abs(peso), raw_response=raw.hex())

    async def _read_line(self) -> WeightReading:
        raw = await asyncio.wait_for(self._reader.readline(), timeout=self.config.timeout)
        text = raw.decode("ascii", errors="replace").strip()
        nums = re.findall(r"-?\d+\.?\d*", text)
        if not nums:
            raise ConnectionError(f"No numeric weight: {text}")
        return WeightReading(peso_bruto=Decimal(nums[0]), raw_response=text)
