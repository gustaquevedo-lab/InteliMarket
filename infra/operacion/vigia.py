#!/usr/bin/env python3
"""
Vigía de salud de InteliMarket (Extra Supermercado).

Corre cada minuto desde el crontab de intellihouse. Es independiente del API a
propósito: si el API está caído, el vigía igual tiene que poder avisar.

POR QUÉ EXISTE
  El 14-09-2026 el API estuvo desde las 10:55 corriendo fuera de systemd,
  lanzado a mano desde una sesión SSH, mientras la unidad oficial fallaba y se
  reintentaba cada 12 s (1.663 veces). Ya había pasado el 9, 11 y 12 de
  septiembre. Nadie se enteró porque nada avisaba.

QUÉ HACE
  1. Revisa servicios, reinicios en ciclo, que los puertos los tenga systemd,
     que el API responda, la base, el archivado de WAL, el disco, los
     respaldos y la conexión de WhatsApp.
  2. Si un servicio esencial fue lanzado a mano, lo CORRIGE SOLO: termina el
     proceso suelto y reinicia la unidad. Si la unidad no responde, restaura
     el proceso anterior tal como estaba, para no dejar a las cajas sin API.
     No pelea: si en 15 minutos lo vuelven a lanzar a mano, avisa y no toca.
  3. Avisa por WhatsApp y en la campana de los superadmins cuando algo se
     rompe, cuando sigue roto (cada hora) y cuando se resuelve.
  4. Manda un resumen diario a las 07:30: si un día no llega, el vigía está
     caído.
  5. Deja el estado en /home/intellihouse/salud/estado.json para el panel
     "Salud del Sistema".

USO
  vigia.py               corrida normal (la que usa cron)
  vigia.py --sin-avisos  revisa y escribe el estado, sin mandar nada
  vigia.py --prueba      manda un aviso de prueba por los dos canales
"""
import datetime as dt
import fcntl
import glob
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

BASE = "/home/intellihouse/salud"
ESTADO = f"{BASE}/estado.json"
MEMORIA = f"{BASE}/memoria.json"
ENV_FILE = "/home/intellihouse/intelimarket/.env"
REPO = "/home/intellihouse/intelimarket"

TELEFONO_ALERTAS = "595994516360"
TENANT_ID = "00000000-0000-0000-0000-000000000001"
ZONA = ZoneInfo("America/Asuncion")

RECORDATORIO_SEG = 60 * 60
NO_PELEAR_SEG = 15 * 60
HORA_RESUMEN = (7, 30)

# (unidad, nivel si está caída, nombre para humanos)
# "intelimarket-ui" NO va acá: es la unidad vieja del servidor de desarrollo
# de Vite, deshabilitada a propósito porque nginx sirve la version compilada
# directo desde /var/www/intelimarket-ui/current. Chequearla por ActiveState
# generaba una falsa alarma de "Interfaz web detenida" con el sitio
# funcionando -- el chequeo real y correcto ya existe en chequear_interfaz()
# (HTTP contra :5173, valida hasta que el bundle sea el publicado).
SERVICIOS = [
    ("intelimarket-api", "critico", "API (cajas y sistema)"),
    ("nginx", "critico", "Acceso web (nginx)"),
    ("postgresql@18-main", "critico", "Base de datos"),
    ("cron", "critico", "Tareas programadas (respaldos, sincronización)"),
    ("redis-server", "aviso", "Redis"),
    ("tailscaled", "aviso", "Tailscale (acceso remoto)"),
    ("intelimarket-sandbox-api", "aviso", "API de pruebas (sandbox)"),
    ("intelimarket-sandbox-ui", "aviso", "Interfaz de pruebas (sandbox)"),
]

# Puerto -> unidad que debe tenerlo, y comando de reinicio permitido sin
# contraseña (tiene que coincidir EXACTO con /etc/sudoers).
PUERTOS = {
    8000: ("intelimarket-api", ["/usr/bin/systemctl", "restart", "intelimarket-api"]),
    8001: ("intelimarket-sandbox-api", ["/usr/bin/systemctl", "restart", "intelimarket-sandbox-api.service"]),
}
# El 5173 NO va en esta lista: no lo sirve la unidad de desarrollo sino la
# version compilada publicada (lo usan la estacion de gondola y otros accesos).
# Se controla aparte, por lo que sirve y no por quien lo tiene.


# ── utilidades ──────────────────────────────────────────────────────────────

def ahora() -> float:
    return time.time()


def hora_local(ts: float | None = None) -> str:
    return dt.datetime.fromtimestamp(ts or ahora(), ZONA).strftime("%d/%m %H:%M")


def sh(cmd: list[str], timeout: int = 15) -> tuple[int, str]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout or "") + (r.stderr or "")
    except Exception as e:
        return 99, str(e)


def leer_env() -> dict:
    env = {}
    try:
        for linea in open(ENV_FILE):
            m = re.match(r"^([A-Z_][A-Z0-9_]*)=(.*)$", linea.strip())
            if m:
                env[m.group(1)] = m.group(2).strip().strip('"')
    except Exception:
        pass
    return env


ENV = leer_env()


def _db():
    m = re.match(r".*://([^:]+):([^@]+)@([^:/]+):?(\d*)/([^?]+)", ENV.get("DATABASE_URL", ""))
    if not m:
        return None
    return {"user": m.group(1), "pw": m.group(2), "host": m.group(3), "port": m.group(4) or "5432", "db": m.group(5)}


def psql(sql: str, timeout: int = 10) -> tuple[int, str]:
    d = _db()
    if not d:
        return 99, "sin DATABASE_URL"
    try:
        r = subprocess.run(
            ["psql", "-U", d["user"], "-h", d["host"], "-p", d["port"], "-d", d["db"], "-tAX", "-v", "ON_ERROR_STOP=1", "-c", sql],
            capture_output=True, text=True, timeout=timeout, env={**os.environ, "PGPASSWORD": d["pw"]},
        )
        return r.returncode, (r.stdout or "").strip() or (r.stderr or "").strip()
    except Exception as e:
        return 99, str(e)


def unidad(nombre: str) -> dict:
    _, out = sh(["systemctl", "show", nombre, "-p", "ActiveState", "-p", "SubState", "-p", "NRestarts",
                 "-p", "MainPID", "-p", "ActiveEnterTimestamp"])
    info = {}
    for linea in out.splitlines():
        if "=" in linea:
            k, v = linea.split("=", 1)
            info[k] = v
    return info


def duenos_del_puerto(puerto: int) -> list[int]:
    _, out = sh(["ss", "-lntpH"])
    pids = []
    for linea in out.splitlines():
        partes = linea.split()
        if len(partes) >= 4 and partes[3].rsplit(":", 1)[-1] == str(puerto):
            pids += [int(p) for p in re.findall(r"pid=(\d+)", linea)]
    return sorted(set(pids))


def cgroup(pid: int) -> str:
    try:
        return open(f"/proc/{pid}/cgroup").read().strip().splitlines()[-1]
    except Exception:
        return ""


def api_responde(puerto: int = 8000) -> bool:
    # 401/422 = el API está vivo y rechaza credenciales vacías.
    try:
        req = urllib.request.Request(
            f"http://127.0.0.1:{puerto}/api/v1/auth/login",
            data=b'{"email":"x@x","password":"x"}', headers={"Content-Type": "application/json"}, method="POST",
        )
        urllib.request.urlopen(req, timeout=5)
        return True
    except urllib.error.HTTPError as e:
        return e.code in (401, 422)
    except Exception:
        return False


def cargar(ruta: str, defecto):
    try:
        return json.load(open(ruta))
    except Exception:
        return defecto


def guardar(ruta: str, datos) -> None:
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    tmp = ruta + ".tmp"
    with open(tmp, "w") as f:
        json.dump(datos, f, ensure_ascii=False, indent=1)
    os.replace(tmp, ruta)


# ── canales ─────────────────────────────────────────────────────────────────

def whatsapp_estado() -> str:
    url, clave, inst = ENV.get("EVOLUTION_API_URL", "").rstrip("/"), ENV.get("EVOLUTION_API_KEY", ""), ENV.get("EVOLUTION_INSTANCE_NAME", "")
    if not (url and clave and inst):
        return "sin_configurar"
    try:
        req = urllib.request.Request(f"{url}/instance/connectionState/{inst}", headers={"apikey": clave})
        data = json.loads(urllib.request.urlopen(req, timeout=8).read())
        return (data.get("instance") or {}).get("state") or data.get("state") or "desconocido"
    except Exception:
        return "sin_respuesta"


def enviar_whatsapp(texto: str) -> bool:
    url, clave, inst = ENV.get("EVOLUTION_API_URL", "").rstrip("/"), ENV.get("EVOLUTION_API_KEY", ""), ENV.get("EVOLUTION_INSTANCE_NAME", "")
    try:
        cuerpo = json.dumps({"number": TELEFONO_ALERTAS, "text": texto,
                             "options": {"delay": 500, "presence": "composing", "linkPreview": False}}).encode()
        req = urllib.request.Request(f"{url}/message/sendText/{inst}", data=cuerpo,
                                     headers={"apikey": clave, "Content-Type": "application/json"}, method="POST")
        return urllib.request.urlopen(req, timeout=15).status in (200, 201)
    except Exception:
        return False


def notificar_campana(titulo: str, cuerpo: str) -> bool:
    # Dollar-quoting: el texto no necesita escaparse. Se descarta si contiene
    # el delimitador, cosa que el vigía nunca genera.
    if "$v$" in titulo or "$v$" in cuerpo:
        return False
    rc, _ = psql(
        "INSERT INTO notifications (tenant_id, user_id, title, body, tipo, link) "
        f"SELECT '{TENANT_ID}', id, $v${titulo[:490]}$v$, $v${cuerpo}$v$, 'salud_sistema', '/salud-sistema' "
        "FROM users WHERE is_superadmin AND activo"
    )
    return rc == 0


# ── chequeos ────────────────────────────────────────────────────────────────

def chequear_servicios(mem: dict) -> tuple[list, list]:
    checks, filas = [], []
    hist = mem.setdefault("reinicios", {})
    t = ahora()
    for u, nivel, nombre in SERVICIOS:
        info = unidad(u)
        activo = info.get("ActiveState") == "active"
        n = int(info.get("NRestarts") or 0)
        serie = [x for x in hist.get(u, []) if t - x[0] <= 600]
        serie.append([t, n])
        hist[u] = serie
        # Un reinicio manual pone el contador en 0: se toma solo lo que subió.
        subida = max(0, n - min(x[1] for x in serie))
        filas.append({"unidad": u, "nombre": nombre, "activo": activo, "estado": info.get("SubState", ""),
                      "reinicios": n, "desde": info.get("ActiveEnterTimestamp", ""), "pid": info.get("MainPID", "")})
        checks.append({"id": f"servicio:{u}", "grupo": "Servicios", "nombre": nombre,
                       "estado": "ok" if activo else nivel,
                       "detalle": "funcionando" if activo else f"detenido ({info.get('ActiveState') or 'desconocido'})"})
        if subida >= 3:
            checks.append({"id": f"ciclo:{u}", "grupo": "Servicios", "nombre": f"{nombre}: reinicios en ciclo",
                           "estado": "aviso" if nivel == "aviso" else "critico",
                           "detalle": f"se reinició {subida} veces en los últimos 10 minutos"})
        else:
            checks.append({"id": f"ciclo:{u}", "grupo": "Servicios", "nombre": f"{nombre}: reinicios en ciclo",
                           "estado": "ok", "detalle": "sin reinicios en ciclo"})
    return checks, filas


def corregir_suelto(puerto: int, u: str, reinicio: list[str], sueltos: list[int], mem: dict, eventos: list) -> tuple[str, str]:
    ultimo = mem.setdefault("autocorreccion", {}).get(u, 0)
    if ahora() - ultimo < NO_PELEAR_SEG:
        return "critico", (f"el puerto {puerto} lo volvió a tomar un proceso lanzado a mano (pid {', '.join(map(str, sueltos))}) "
                           "menos de 15 minutos después de corregirlo. No se toca para no pelear: revisar quién lo lanza.")
    # Se guarda cómo estaba lanzado, para poder restaurarlo si systemd falla.
    lanzados = []
    for p in sueltos:
        try:
            argv = open(f"/proc/{p}/cmdline").read().split("\0")
            lanzados.append(([a for a in argv if a], os.readlink(f"/proc/{p}/cwd")))
        except Exception:
            pass
    for p in sueltos:
        try:
            os.kill(p, signal.SIGTERM)
        except Exception:
            pass
    time.sleep(2)
    for p in sueltos:
        try:
            os.kill(p, 0)
            os.kill(p, signal.SIGKILL)
        except Exception:
            pass
    sh(["sudo", "-n"] + reinicio, timeout=30)
    mem["autocorreccion"][u] = ahora()

    for _ in range(45):
        duenos = duenos_del_puerto(puerto)
        propio = duenos and all(f"system.slice/{u}.service" in cgroup(p) for p in duenos)
        if propio and (puerto != 8000 or api_responde(8000)):
            texto = f"{u}: el puerto {puerto} lo tenía un proceso lanzado a mano (pid {', '.join(map(str, sueltos))}); se reemplazó por el servicio oficial."
            eventos.append({"ts": ahora(), "nivel": "aviso", "texto": "Corregido automáticamente — " + texto})
            return "ok", "corregido automáticamente: " + texto
        time.sleep(1)

    # Red de seguridad: se restaura lo que funcionaba.
    for argv, cwd in lanzados:
        try:
            log = open("/tmp/uvicorn.log" if puerto == 8000 else os.devnull, "a")
            subprocess.Popen(argv, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
        except Exception:
            pass
    return "critico", (f"{u}: se intentó devolver el puerto {puerto} a systemd pero no respondió en 45 s; "
                       "se restauró el proceso anterior. Hay que revisarlo a mano.")


def chequear_puertos(mem: dict, eventos: list) -> list:
    checks = []
    for puerto, (u, reinicio) in PUERTOS.items():
        nombre = f"Puerto {puerto} en manos de systemd"
        duenos = duenos_del_puerto(puerto)
        if not duenos:
            checks.append({"id": f"puerto:{puerto}", "grupo": "Servicios", "nombre": nombre,
                           "estado": "critico" if puerto != 8001 else "aviso", "detalle": "nadie escucha en el puerto"})
            continue
        ajenos = [p for p in duenos if f"system.slice/{u}.service" not in cgroup(p)]
        if not ajenos:
            checks.append({"id": f"puerto:{puerto}", "grupo": "Servicios", "nombre": nombre, "estado": "ok",
                           "detalle": f"lo tiene {u}"})
            continue
        sueltos = [p for p in ajenos if "session-" in cgroup(p)]
        if sueltos:
            estado, detalle = corregir_suelto(puerto, u, reinicio, sueltos, mem, eventos)
        else:
            estado, detalle = "critico", f"lo tiene un proceso ajeno (pid {', '.join(map(str, ajenos))}), fuera de {u}"
        checks.append({"id": f"puerto:{puerto}", "grupo": "Servicios", "nombre": nombre, "estado": estado, "detalle": detalle})
    return checks


def chequear_api(mem: dict) -> dict:
    ok = api_responde(8000)
    fallas = 0 if ok else mem.get("api_fallas", 0) + 1
    mem["api_fallas"] = fallas
    if ok:
        return {"id": "api:responde", "grupo": "Servicios", "nombre": "El API responde", "estado": "ok", "detalle": "responde"}
    return {"id": "api:responde", "grupo": "Servicios", "nombre": "El API responde",
            "estado": "critico" if fallas >= 2 else "ok",
            "detalle": f"no responde ({fallas} chequeos seguidos)" if fallas >= 2 else "una falla aislada, se reintenta"}


def chequear_base(mem: dict) -> list:
    checks = []
    d = _db()
    rc, _ = sh(["pg_isready", "-h", d["host"], "-p", d["port"]] if d else ["false"])
    checks.append({"id": "base:acepta", "grupo": "Base de datos", "nombre": "La base acepta conexiones",
                   "estado": "ok" if rc == 0 else "critico", "detalle": "acepta conexiones" if rc == 0 else "no acepta conexiones"})
    rc, out = psql("SELECT failed_count, archived_count, coalesce(extract(epoch from now() - last_archived_time)::int, -1) FROM pg_stat_archiver")
    if rc == 0 and "|" in out:
        fallidos, archivados, edad = (int(x) for x in out.split("|"))
        previos = mem.get("archivado_fallidos", fallidos)
        mem["archivado_fallidos"] = fallidos
        nuevos = max(0, fallidos - previos)
        checks.append({"id": "base:archivado", "grupo": "Respaldos", "nombre": "Archivado continuo (WAL)",
                       "estado": "aviso" if nuevos else "ok",
                       "detalle": f"falló {nuevos} vez/veces desde el último chequeo" if nuevos else f"{archivados} segmentos archivados, sin fallas nuevas"})
    return checks


def chequear_disco() -> dict:
    uso = shutil.disk_usage("/")
    pct = round(uso.used * 100 / uso.total)
    libre = round(uso.free / 1024 ** 3, 1)
    estado = "critico" if pct >= 92 else "aviso" if pct >= 85 else "ok"
    return {"id": "disco", "grupo": "Recursos", "nombre": "Espacio en disco", "estado": estado,
            "detalle": f"{pct}% usado, {libre} GB libres" + (" — con el disco lleno la base deja de aceptar ventas" if estado != "ok" else "")}


def _edad_horas(ruta: str) -> float | None:
    try:
        return (ahora() - os.path.getmtime(ruta)) / 3600
    except Exception:
        return None


def chequear_respaldos() -> list:
    checks = []
    dumps = sorted(glob.glob("/home/intellihouse/backups/database/*.dump"), key=os.path.getmtime)
    edad = _edad_horas(dumps[-1]) if dumps else None
    if edad is None:
        checks.append({"id": "resp:dump", "grupo": "Respaldos", "nombre": "Volcado nocturno", "estado": "critico", "detalle": "no hay ningún volcado"})
    else:
        estado = "critico" if edad > 50 else "aviso" if edad > 26 else "ok"
        checks.append({"id": "resp:dump", "grupo": "Respaldos", "nombre": "Volcado nocturno", "estado": estado,
                       "detalle": f"el último tiene {edad:.0f} h"})
    edad_bb = _edad_horas("/home/intellihouse/basebackup.log")
    checks.append({"id": "resp:fisica", "grupo": "Respaldos", "nombre": "Copia física semanal",
                   "estado": "aviso" if edad_bb is None or edad_bb > 8 * 24 else "ok",
                   "detalle": "sin registro" if edad_bb is None else f"última corrida hace {edad_bb / 24:.1f} días"})
    fallas = 0
    corte = dt.datetime.now() - dt.timedelta(minutes=15)
    try:
        for linea in open("/home/intellihouse/ship_wal.log").readlines()[-40:]:
            m = re.match(r"^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]", linea)
            if m and "no se pudo enviar" in linea and dt.datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S") >= corte:
                fallas += 1
    except Exception:
        pass
    checks.append({"id": "resp:envio_wal", "grupo": "Respaldos", "nombre": "Envío de WAL a minisforum",
                   "estado": "aviso" if fallas >= 5 else "ok",
                   "detalle": f"falló {fallas} veces en 15 minutos" if fallas >= 5 else "enviando normalmente"})
    return checks


def chequear_interfaz() -> dict:
    nombre = "Interfaz de las estaciones (puerto 5173)"
    try:
        html = urllib.request.urlopen("http://127.0.0.1:5173/", timeout=5).read().decode("utf-8", "replace")
    except Exception:
        return {"id": "interfaz:5173", "grupo": "Servicios", "nombre": nombre, "estado": "critico",
                "detalle": "no responde (la usan la estación de góndola y otros accesos)"}
    if "/@vite/client" in html:
        return {"id": "interfaz:5173", "grupo": "Servicios", "nombre": nombre, "estado": "aviso",
                "detalle": "sirve el servidor de desarrollo en vez de la versión publicada"}
    sirve = re.search(r"/assets/(index-[A-Za-z0-9_-]+\.js)", html)
    try:
        pub = re.search(r"/assets/(index-[A-Za-z0-9_-]+\.js)", open("/var/www/intelimarket-ui/current/index.html").read())
    except Exception:
        pub = None
    if sirve and pub and sirve.group(1) != pub.group(1):
        return {"id": "interfaz:5173", "grupo": "Servicios", "nombre": nombre, "estado": "aviso",
                "detalle": f"sirve una versión vieja ({sirve.group(1)}); la publicada es {pub.group(1)}"}
    return {"id": "interfaz:5173", "grupo": "Servicios", "nombre": nombre, "estado": "ok",
            "detalle": "responde con la versión publicada"}


def _es_servicio_suelto(argv: list[str]) -> str | None:
    """Reconoce SOLO procesos reales de uvicorn/vite del proyecto, por su forma
    exacta de argv. Nunca por texto suelto: un 'bash -c ... vite ...' de una
    sesion SSH no es un servidor y no se toca."""
    if not argv:
        return None
    base = os.path.basename(argv[0])
    resto = argv[1:]
    if "api.src.main:app" in argv and any(os.path.basename(a) == "uvicorn" for a in argv[:2]):
        return "API (uvicorn)"
    if base == "node" and resto and resto[0].endswith("/vite"):
        return "interfaz de desarrollo (vite)"
    if base == "npm" and (("exec" in resto and "vite" in resto) or ("run" in resto and "dev" in resto)):
        return "interfaz de desarrollo (npm)"
    if base == "sh" and len(resto) >= 2 and resto[0] == "-c" and resto[1].startswith("vite "):
        return "interfaz de desarrollo (vite)"
    return None


def chequear_sueltos(eventos: list) -> dict:
    nombre = "Servicios lanzados a mano"
    huerfanos, en_uso = [], []
    for d in os.listdir("/proc"):
        if not d.isdigit():
            continue
        pid = int(d)
        try:
            argv = [a for a in open(f"/proc/{pid}/cmdline").read().split("\0") if a]
            cwd = os.readlink(f"/proc/{pid}/cwd")
        except Exception:
            continue
        tipo = _es_servicio_suelto(argv)
        cg = cgroup(pid)
        if not tipo or "session-" not in cg or not cwd.startswith(REPO):
            continue
        m = re.search(r"session-(\d+)\.scope", cg)
        _, estado_sesion = sh(["loginctl", "show-session", m.group(1) if m else "0", "-p", "State", "--value"])
        (en_uso if estado_sesion.strip() == "active" else huerfanos).append((pid, tipo, m.group(1) if m else "?"))

    for pid, tipo, sesion in huerfanos:
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
    if huerfanos:
        time.sleep(2)
        for pid, _, _ in huerfanos:
            try:
                os.kill(pid, 0)
                os.kill(pid, signal.SIGKILL)
            except Exception:
                pass
        tipos = sorted({t for _, t, _ in huerfanos})
        eventos.append({"ts": ahora(), "nivel": "aviso",
                        "texto": f"Terminados {len(huerfanos)} proceso(s) lanzados a mano y abandonados ({', '.join(tipos)}), de sesiones SSH ya cerradas"})
    if en_uso:
        detalle = "; ".join(f"{t} pid {p} (sesión SSH {s} abierta)" for p, t, s in en_uso)
        return {"id": "sueltos", "grupo": "Servicios", "nombre": nombre, "estado": "aviso",
                "detalle": f"hay procesos lanzados a mano con la sesión todavía abierta, no se tocan: {detalle}"}
    return {"id": "sueltos", "grupo": "Servicios", "nombre": nombre, "estado": "ok",
            "detalle": (f"se terminaron {len(huerfanos)} proceso(s) abandonados" if huerfanos else "ninguno")}


# ── principal ───────────────────────────────────────────────────────────────

ICONO = {"ok": "✅", "aviso": "🟡", "critico": "🔴"}
ORDEN = {"ok": 0, "aviso": 1, "critico": 2}


def main() -> None:
    sin_avisos = "--sin-avisos" in sys.argv
    os.makedirs(BASE, exist_ok=True)
    candado = open(f"{BASE}/.vigia.lock", "w")
    try:
        fcntl.flock(candado, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return  # la corrida anterior sigue (por ejemplo, corrigiendo un servicio)

    mem = cargar(MEMORIA, {})
    eventos = mem.get("eventos", [])

    if "--prueba" in sys.argv:
        texto = f"InteliMarket · Extra Supermercado\n✅ Prueba de alertas del vigía de salud.\nSi te llega, las alertas funcionan.\n{hora_local()}"
        wa = whatsapp_estado() == "open" and enviar_whatsapp(texto)
        campana = notificar_campana("Prueba de alertas del sistema", "Si ves esto, las alertas en la campana funcionan.")
        print(f"prueba: whatsapp={'enviado' if wa else 'NO enviado (' + whatsapp_estado() + ')'} campana={'ok' if campana else 'fallo'}")
        return

    checks, servicios = chequear_servicios(mem)
    checks += chequear_puertos(mem, eventos)
    checks.append(chequear_sueltos(eventos))
    checks.append(chequear_interfaz())
    checks.append(chequear_api(mem))
    checks += chequear_base(mem)
    checks.append(chequear_disco())
    checks += chequear_respaldos()
    wa = whatsapp_estado()
    checks.append({"id": "whatsapp", "grupo": "Avisos", "nombre": "WhatsApp conectado",
                   "estado": "ok" if wa == "open" else "aviso",
                   "detalle": "conectado" if wa == "open" else
                   f"desconectado ({wa}): las alertas solo llegan a la campana. Reconectar escaneando el QR en WhatsApp & IntelliZapp."})

    # Qué cambió desde la corrida anterior
    previos = mem.get("checks", {})
    t = ahora()
    problemas, resueltos, siguen = [], [], []
    for c in checks:
        p = previos.get(c["id"], {"estado": "ok", "desde": t, "ultimo_aviso": 0})
        if c["estado"] != p["estado"]:
            (resueltos if c["estado"] == "ok" else problemas).append(c)
            previos[c["id"]] = {"estado": c["estado"], "desde": t, "ultimo_aviso": t}
        elif c["estado"] != "ok" and t - p.get("ultimo_aviso", 0) >= RECORDATORIO_SEG:
            siguen.append(c)
            p["ultimo_aviso"] = t
            previos[c["id"]] = p
        else:
            previos.setdefault(c["id"], p)
    mem["checks"] = previos

    corregidos = [e for e in eventos if e.get("nuevo")]
    for e in corregidos:
        e.pop("nuevo", None)
    for c in problemas:
        eventos.append({"ts": t, "nivel": c["estado"], "texto": f"{c['nombre']}: {c['detalle']}"})
    for c in resueltos:
        eventos.append({"ts": t, "nivel": "ok", "texto": f"Resuelto — {c['nombre']}"})
    mem["eventos"] = eventos[-80:]

    if not sin_avisos and (problemas or resueltos or siguen):
        lineas = []
        if problemas:
            lineas.append("PROBLEMA")
            lineas += [f"{ICONO[c['estado']]} {c['nombre']}: {c['detalle']}" for c in sorted(problemas, key=lambda c: -ORDEN[c['estado']])]
        if siguen:
            lineas.append("SIGUE SIN RESOLVERSE")
            lineas += [f"{ICONO[c['estado']]} {c['nombre']}: {c['detalle']}" for c in siguen]
        if resueltos:
            lineas.append("RESUELTO")
            lineas += [f"✅ {c['nombre']}" for c in resueltos]
        cuerpo = "\n".join(lineas)
        peor = max((ORDEN[c["estado"]] for c in problemas + siguen), default=0)
        titulo = ("🔴 Problema en el sistema" if peor == 2 else "🟡 Aviso del sistema" if peor == 1 else "✅ Sistema normalizado")
        notificar_campana(titulo, cuerpo)
        # Que WhatsApp esté caído ya se avisa en la campana; no tiene sentido
        # intentar mandarlo por el mismo canal que está caído.
        if wa == "open":
            enviar_whatsapp(f"InteliMarket · Extra Supermercado\n{titulo}\n\n{cuerpo}\n\n{hora_local()}")

    # Resumen diario: la prueba de vida del propio vigía.
    local = dt.datetime.now(ZONA)
    hoy = local.strftime("%Y-%m-%d")
    if not sin_avisos and (local.hour, local.minute) >= HORA_RESUMEN and mem.get("resumen_fecha") != hoy:
        malos = [c for c in checks if c["estado"] != "ok"]
        texto = (f"InteliMarket · Extra Supermercado\nResumen diario {local.strftime('%d/%m')}\n"
                 + ("✅ Todo en orden." if not malos else f"{len(malos)} punto(s) para revisar:\n" +
                    "\n".join(f"{ICONO[c['estado']]} {c['nombre']}: {c['detalle']}" for c in malos))
                 + "\n\nSi un día no llega este resumen, el vigía de salud dejó de funcionar.")
        if wa == "open" and enviar_whatsapp(texto):
            mem["resumen_fecha"] = hoy

    carga = os.getloadavg()
    uso = shutil.disk_usage("/")
    peor = max((ORDEN[c["estado"]] for c in checks), default=0)
    guardar(ESTADO, {
        "generado": dt.datetime.now(ZONA).isoformat(timespec="seconds"),
        "resumen": ["ok", "aviso", "critico"][peor],
        "checks": checks,
        "servicios": servicios,
        "recursos": {"disco_pct": round(uso.used * 100 / uso.total), "disco_libre_gb": round(uso.free / 1024 ** 3, 1),
                     "carga_1m": round(carga[0], 2), "carga_15m": round(carga[2], 2), "nucleos": os.cpu_count()},
        "whatsapp": wa,
        "telefono_alertas": "+" + TELEFONO_ALERTAS,
        "eventos": [{**e, "hora": hora_local(e["ts"])} for e in reversed(mem["eventos"][-40:])],
    })
    guardar(MEMORIA, mem)


if __name__ == "__main__":
    main()
