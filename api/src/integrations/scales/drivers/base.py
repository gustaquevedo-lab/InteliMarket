"""Base scale driver — all protocol drivers inherit from this"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Optional


@dataclass
class ScaleConfig:
    host: Optional[str] = None
    puerto_tcp: int = 9000
    puerto_com: Optional[str] = None
    baudrate: int = 9600
    data_bits: int = 8
    paridad: str = "N"
    stop_bits: str = "1"
    timeout: int = 5
    vendor_id: Optional[str] = None
    product_id: Optional[str] = None
    ruta_carga: Optional[str] = None
    etiqueta_formato: str = "40x30"
    extra: dict = field(default_factory=dict)


@dataclass
class WeightReading:
    peso_bruto: Decimal
    peso_neto: Optional[Decimal] = None
    tara: Decimal = Decimal("0")
    unidad: str = "kg"
    estable: bool = True
    raw_response: Optional[str] = None


@dataclass
class ConnectionStatus:
    conectada: bool
    protocolo_detectado: Optional[str] = None
    mensaje: str = ""
    latencia_ms: Optional[int] = None
    peso_actual: Optional[Decimal] = None


@dataclass
class PLUResult:
    total_productos: int = 0
    exitosos: int = 0
    fallidos: int = 0
    archivo_generado: Optional[str] = None
    errores: list[dict] = field(default_factory=list)


@dataclass
class LabelData:
    producto_nombre: str
    peso_kg: Decimal
    precio_unitario: Decimal
    precio_total: Decimal
    fecha_vencimiento: Optional[str] = None
    lote: Optional[str] = None
    codigo_barras: Optional[str] = None
    info_nutricional: Optional[str] = None
    formato: str = "40x30"


class ScaleDriver(ABC):
    """Abstract base for all scale protocol drivers."""

    def __init__(self, config: ScaleConfig):
        self.config = config
        self._connected = False

    @abstractmethod
    async def connect(self) -> bool:
        ...

    @abstractmethod
    async def disconnect(self):
        ...

    @abstractmethod
    async def read_weight(self) -> WeightReading:
        ...

    async def tare(self) -> Optional[Decimal]:
        return None

    async def zero(self) -> bool:
        return False

    async def test_connection(self) -> ConnectionStatus:
        try:
            w = await self.read_weight()
            return ConnectionStatus(
                conectada=True,
                mensaje=f"Peso: {w.peso_bruto} {w.unidad}",
                peso_actual=w.peso_bruto,
            )
        except Exception as e:
            return ConnectionStatus(conectada=False, mensaje=str(e))

    async def sync_plu(self, productos: list[dict]) -> PLUResult:
        return PLUResult()

    async def print_label(self, label: LabelData) -> bool:
        return False

    async def send_raw_command(self, command: bytes) -> Optional[bytes]:
        return None

    @property
    def protocol_name(self) -> str:
        return self.__class__.__name__.replace("Driver", "").lower()

    @property
    def is_connected(self) -> bool:
        return self._connected
