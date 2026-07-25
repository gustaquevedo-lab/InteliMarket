"""USB HID POS scale driver — for USB plug-and-play scales (common in retail POS)

Many POS scales present as a USB HID keyboard that types the weight.
This driver reads from the HID interface directly.

Protocol varies:
- "Keyboard wedge": scale emulates keyboard, types weight + CR
- HID POS: raw HID report with weight in the data payload
- "USB Serial": scale presents as virtual COM port (handled by GenericSerialDriver)

For HID raw access, requires 'hidapi' or 'pyusb' libraries.
For keyboard wedge, we read from a raw HID device or /dev/hidraw.
"""

import asyncio
import re
from decimal import Decimal
from typing import Optional

from api.src.integrations.scales.drivers.base import ScaleDriver, ScaleConfig, WeightReading


class UsbHidDriver(ScaleDriver):
    """USB HID POS scale — keyboard wedge or raw HID."""

    def __init__(self, config: ScaleConfig):
        super().__init__(config)
        self._device = None
        self._mode = config.extra.get("usb_mode", "keyboard")

    async def connect(self) -> bool:
        if self._mode == "keyboard":
            try:
                import pykeyboard
                self._connected = True
                return True
            except ImportError:
                raise RuntimeError("pykeyboard required for keyboard wedge mode")
        else:
            try:
                import hid
                vid = int(self.config.vendor_id, 16) if self.config.vendor_id else 0
                pid = int(self.config.product_id, 16) if self.config.product_id else 0
                if vid and pid:
                    self._device = hid.device()
                    self._device.open(vid, pid)
                    self._connected = True
                    return True
                else:
                    raise ValueError("vendor_id and product_id required for HID mode")
            except ImportError:
                raise RuntimeError("hidapi required. pip install hidapi")

    async def disconnect(self):
        if self._device:
            try:
                self._device.close()
            except Exception:
                pass
        self._connected = False

    async def read_weight(self) -> WeightReading:
        if not self._connected:
            await self.connect()
        if self._mode == "keyboard":
            return await self._read_keyboard_wedge()
        else:
            return await self._read_hid()

    async def _read_keyboard_wedge(self) -> WeightReading:
        """Read weight from keyboard wedge — scale types "001500\r" = 1.500kg"""
        try:
            import pykeyboard
            k = pykeyboard.Keyboard()
            buf = ""
            for _ in range(50):
                await asyncio.sleep(0.05)
                if k.is_pressed("\r"):
                    break
                for c in "0123456789.,-":
                    if k.is_pressed(c):
                        buf += c
                        break
            if not buf:
                raise TimeoutError("No weight from keyboard wedge")
            buf = buf.replace(",", ".")
            nums = re.findall(r"-?\d+\.?\d*", buf)
            if not nums:
                raise ConnectionError(f"Cannot parse: {buf}")
            peso = Decimal(nums[0])
            return WeightReading(peso_bruto=abs(peso), raw_response=buf)
        except ImportError:
            raise RuntimeError("pykeyboard not available")

    async def _read_hid(self) -> WeightReading:
        if not self._device:
            raise ConnectionError("HID device not connected")
        data = await asyncio.get_event_loop().run_in_executor(None, self._device.read, 64, int(self.config.timeout * 1000))
        if not data or len(data) < 4:
            raise TimeoutError("No HID data")
        raw = bytes(data).hex()
        weight_raw = "".join(chr(b) if 32 <= b < 127 else "" for b in data)
        weight_raw = re.sub(r"[^0-9.,\-]", "", weight_raw).replace(",", ".")
        try:
            peso = Decimal(weight_raw) if weight_raw else Decimal(0)
        except Exception:
            raise ConnectionError(f"Unparseable HID: {raw}")
        return WeightReading(peso_bruto=abs(peso), raw_response=raw)
