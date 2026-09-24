"""Helpers de rango de fechas compartidos.

Un filtro "hasta" que llega como fecha pura (sin hora, típicamente desde un
<input type=date> del frontend) se parsea como medianoche. Un
`columna <= hasta` con eso excluye todo lo cargado ese mismo día después de
las 00:00 -- el mismo bug apareció de forma independiente en varios módulos
(supermer, caja, financial, cheques, sueldok, donaciones, plugpay).
end_of_day() empuja ese valor al último instante del día para que la
comparación sea inclusiva del día completo.
"""

from datetime import datetime, timedelta
from typing import Optional


def end_of_day(hasta: Optional[datetime]) -> Optional[datetime]:
    if hasta is None:
        return None
    if hasta.time() == datetime.min.time():
        return hasta + timedelta(days=1) - timedelta(microseconds=1)
    return hasta
