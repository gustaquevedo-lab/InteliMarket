"""Salud del sistema: expone lo que reporta el vigía (infra/operacion/vigia.py).

El vigía corre cada minuto por su cuenta, fuera del API, para poder avisar
aunque el API esté caído. Este endpoint solo lee lo que dejó escrito. Si el
archivo es viejo, lo que falla es el vigía mismo, y eso también se informa.
"""
import json
import os
import time

from fastapi import APIRouter, Depends, HTTPException

from api.src.auth.middleware import require_auth

router = APIRouter(prefix="/api/v1/sistema", tags=["sistema"])

ESTADO = "/home/intellihouse/salud/estado.json"
VIGIA_VIVO_SEG = 180  # corre cada minuto: 3 minutos sin reportar es que se cayó


def _solo_superadmin(user=Depends(require_auth)):
    # Muestra servicios, procesos y rutas internas del servidor: solo para
    # administradores de la plataforma, no para cualquier admin de empresa.
    if not user.get("is_superadmin"):
        raise HTTPException(status_code=403, detail="Solo superadministradores")
    return user


@router.get("/salud")
async def salud_del_sistema(user=Depends(_solo_superadmin)):
    try:
        edad = int(time.time() - os.path.getmtime(ESTADO))
        with open(ESTADO) as f:
            datos = json.load(f)
    except FileNotFoundError:
        return {"vigia_vivo": False, "edad_segundos": None, "checks": [],
                "mensaje": "El vigía todavía no generó ningún reporte."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"No se pudo leer el estado del vigía: {e}")
    datos["edad_segundos"] = edad
    datos["vigia_vivo"] = edad <= VIGIA_VIVO_SEG
    return datos
