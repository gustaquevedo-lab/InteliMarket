// ── CLIENTE TCP CRUDO PARA TERMINAL DINELCO (protocolo pipe-delimited, puerto 9600) ──
// Ver manual "Integracion Caja - POS WIFI/LAN/USB v2.6" (Bepsa/Dinelco).
// Mensajes: campos separados por '|', terminados en ';'. El terminal actua de servidor TCP.
const net = require('net')

const DINELCO_PORT = 9600
const sessions = new Map() // sessionId -> { socket, buffer }

function nextSessionId() {
  return `dnl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function parseResponse(raw) {
  // raw viene sin el ';' final, ej: "RBIN|OK|123456789" o "ENDOP|NOK|05|Rechazada"
  const parts = raw.split('|')
  const comando = parts[0]
  if (parts[1] === 'OK') {
    return { comando, ok: true, campos: parts.slice(2) }
  }
  if (parts[1] === 'NOK') {
    return { comando, ok: false, code: parts[2] || null, desc: parts[3] || 'Error desconocido', campos: parts.slice(2) }
  }
  return { comando, ok: false, code: null, desc: 'Respuesta no reconocida: ' + raw, campos: parts.slice(1) }
}

function openSession(ip, timeoutMs) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket()
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      socket.destroy()
      reject(new Error('timeout_conexion'))
    }, timeoutMs || 5000)

    socket.connect(DINELCO_PORT, ip, () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      const sessionId = nextSessionId()
      sessions.set(sessionId, { socket, buffer: '' })
      resolve(sessionId)
    })

    socket.on('error', (err) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(err.code || err.message || 'connection_error'))
    })
  })
}

function closeSession(sessionId) {
  const s = sessions.get(sessionId)
  if (s) {
    try { s.socket.destroy() } catch (e) {}
    sessions.delete(sessionId)
  }
}

function sendOnSession(sessionId, comando, timeoutMs) {
  return new Promise((resolve, reject) => {
    const s = sessions.get(sessionId)
    if (!s) return reject(new Error('sesion_inexistente'))
    const { socket } = s
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
      reject(new Error('timeout_respuesta'))
    }, timeoutMs || 45000)

    function onData(chunk) {
      s.buffer += chunk.toString('utf8')
      const idx = s.buffer.indexOf(';')
      if (idx === -1) return // mensaje fragmentado, esperar mas datos
      const raw = s.buffer.slice(0, idx)
      s.buffer = s.buffer.slice(idx + 1)
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.removeListener('data', onData)
      socket.removeListener('error', onError)
      resolve(parseResponse(raw))
    }

    function onError(err) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.removeListener('data', onData)
      reject(new Error(err.code || err.message || 'connection_error'))
    }

    socket.on('data', onData)
    socket.on('error', onError)
    socket.write(comando + ';')
  })
}

// tipo -> arma el comando pipe-delimited segun el manual
function buildCommand(tipo, params) {
  const monto = Math.round(Number(params.monto || 0))
  switch (tipo) {
    case 'venta_inicio': // RBIN -- OP: 01 venta, 02 adelanto RED DE PAGOS, 03 adelanto DINELCO
      return `RBIN|${params.op || '01'}|${monto}`
    case 'venta_confirmar': // ENDOP -- CTAS: 0 contado, >1 cuotas
      return `ENDOP|${params.cuotas || 0}|${monto}`
    case 'cancelar':
      return 'CANCEL'
    case 'qr': // PAGOQR -- OP: 01 venta, 02/03 adelantos
      return `PAGOQR|${params.op || '01'}|${monto}`
    case 'pix': // PIX|MONTO|CPF
      return `PIX|${monto}|${params.cpf || ''}`
    case 'puntos_canje':
      return `PUNCAN|${monto}`
    case 'puntos_consulta':
      return 'PUNCON'
    case 'spi':
      return `SPICOM|${params.alias || ''}|${monto}`
    default:
      throw new Error('tipo_operacion_desconocido: ' + tipo)
  }
}

// Punto de entrada unico usado por el handler IPC.
// - Para 'venta_inicio': abre una sesion nueva, la deja abierta, devuelve sessionId en la respuesta.
// - Para el resto de comandos de una sola ida (ENDOP incluido): reusa sessionId si se pasa, sino abre/cierra una sesion efimera.
async function dinelcoCall({ ip, tipo, params, sessionId, timeoutMs }) {
  const esInicioVenta = tipo === 'venta_inicio'
  let sid = sessionId
  let sesionPropia = false

  try {
    if (!sid) {
      sid = await openSession(ip, timeoutMs)
      sesionPropia = true
    }
    const comando = buildCommand(tipo, params || {})
    const respuesta = await sendOnSession(sid, comando, timeoutMs)

    if (esInicioVenta && respuesta.ok) {
      // dejamos la sesion abierta para el ENDOP que sigue
      return { ok: true, sessionId: sid, comando: respuesta.comando, campos: respuesta.campos }
    }
    if (esInicioVenta && !respuesta.ok) {
      closeSession(sid)
      return { ok: false, sessionId: null, code: respuesta.code, desc: respuesta.desc }
    }
    // ENDOP o comando de una sola ida: cerramos la sesion, ya no se necesita
    if (sessionId) closeSession(sessionId)
    else if (sesionPropia) closeSession(sid)
    return { ok: respuesta.ok, comando: respuesta.comando, campos: respuesta.campos, code: respuesta.code, desc: respuesta.desc }
  } catch (err) {
    if (sid) closeSession(sid)
    return { ok: false, error: err.message || 'error_desconocido' }
  }
}

function cancelarSesion(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) return { ok: false }
  return sendOnSession(sessionId, 'CANCEL', 5000)
    .catch(() => ({ ok: false }))
    .finally(() => closeSession(sessionId))
}

module.exports = { dinelcoCall, cancelarSesion, closeSession }
