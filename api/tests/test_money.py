"""La regla de montos en Gs. es canónica: vive solo en api/src/common/money.py."""
import pathlib
import re
from decimal import Decimal

from api.src.common.money import gs, iva_incluido, iva_sobre_neto


def test_gs_entero_hacia_arriba_antes_de_multiplicar():
    assert gs(Decimal("1567.7")) == 1568
    assert gs(Decimal("1567.7")) * 10 == 15680  # nunca 15677
    assert gs(3083) == 3083


def test_iva_al_mas_proximo():
    assert iva_incluido(6166, 10) == 561   # 560,55
    assert iva_incluido(15680, 10) == 1425  # 1425,45
    assert iva_incluido(1050, 5) == 50
    assert iva_incluido(1000, 0) == 0
    assert iva_sobre_neto(5279, 10) == 528  # 527,9


def test_ningun_modulo_redondea_montos_por_su_cuenta():
    src = pathlib.Path(__file__).resolve().parents[1] / "src"
    prohibido = re.compile(r'ROUND_CEILING|Decimal\("1[1]"\)|Decimal\("21"\)|/ *11(\.0)?\b|/ *21(\.0)?\b')
    fuera = []
    for f in src.rglob("*.py"):
        if f.name == "money.py" or "supermer" in f.parts:
            continue
        for n, line in enumerate(f.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if prohibido.search(line) and re.search(r"iva|grav|total|monto|precio|cost|ROUND_CEILING", line, re.I):
                fuera.append(f"{f.relative_to(src)}:{n}: {line.strip()[:100]}")
    assert not fuera, "Usar api/src/common/money.py (gs / iva_incluido):\n" + "\n".join(fuera)
