from api.src.integrations.scales.drivers.base import ScaleDriver
from api.src.integrations.scales.drivers.toledo_p03 import ToledoP03Driver
from api.src.integrations.scales.drivers.balmak_edge import BalmakEdgeDriver
from api.src.integrations.scales.drivers.filizola import FilizolaDriver
from api.src.integrations.scales.drivers.generic_serial import GenericSerialDriver
from api.src.integrations.scales.drivers.usb_hid import UsbHidDriver

DRIVER_REGISTRY: dict[str, type[ScaleDriver]] = {
    "toledo_p03": ToledoP03Driver,
    "balmak_sdl": BalmakEdgeDriver,
    "filizola": FilizolaDriver,
    "rinnert": GenericSerialDriver,
    "generic_ascii": GenericSerialDriver,
    "usb_hid_pos": UsbHidDriver,
}

__all__ = [
    "ScaleDriver",
    "ToledoP03Driver",
    "BalmakEdgeDriver",
    "FilizolaDriver",
    "GenericSerialDriver",
    "UsbHidDriver",
    "DRIVER_REGISTRY",
]
