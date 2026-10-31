# Especificación de Diseño: Política Canónica de Textos en MAYÚSCULAS y Normalización de Datos

- **Fecha:** 2026-10-31
- **Autor:** Antigravity (Pair Programming con Gusta Quevedo)
- **Estado:** Aprobado para Planificación
- **Rama:** `vertical/supermercado`

---

## 1. Resumen Ejecutivo y Decisión Canónica

El sistema **InteliMarket (Vertical Supermercado / Extra Supermercado)** adopta una **política canónica universal de textos en MAYÚSCULAS**:
1. Todo texto ingresado por operadores en cualquier formulario, campo de búsqueda o entrada de texto (inputs y textareas) se convierte y almacena automáticamente en **MAYÚSCULAS**.
2. Los datos textuales existentes en la base de datos (catálogo de productos, clientes, proveedores, compras, gastos, etc.) se normalizan a **MAYÚSCULAS**.
3. **Exclusiones estrictas:**
   - Campos de contraseña (`type="password"`, `password_hash`, PINs) quedan estrictamente excluidos.
   - Correos electrónicos (`type="email"`, campos `email`) se preservan en formato estándar para compatibilidad con clientes de correo y estándares RFC.
   - Campos técnicos de sistema (UUIDs, tokens JWT, URLs, payloads JSONB, firmas HMAC de medios de pago, XMLs de SIFEN y enums de estado de máquina como `'approved'`, `'draft'`, `'ticket'`) quedan excluidos.
4. **Ventana de activación para Terminales POS (Cajas 2 a 5):**
   - El ERP administrativo adopta la regla de inmediato.
   - Las terminales de punto de venta (`/pos`) mantendrán la exclusión temporal durante la jornada diurna y activarán automáticamente la regla a las **22:00 hs** (tras el cierre de sucursal), evitando cualquier interrupción a cajeras y clientes en línea de cajas.

---

## 2. Arquitectura de Solución (Enfoque Ponytail)

Siguiendo el principio de **máxima simplicidad y mínimo cambio (*Ponytail*)**, se evita refactorizar individualmente cientos de componentes React. La solución opera en 3 capas coordinadas:

### 2.1. Capa Visual (CSS Global)
En `ui-web/src/index.css`:
```css
/* Política Canónica: Textos en Mayúsculas */
input:not([type="password"]):not([type="email"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not(.keep-case),
textarea:not(.keep-case) {
  text-transform: uppercase;
}
```
Esto asegura que cualquier carácter tipeado o pegado aparezca visualmente en mayúsculas de manera inmediata y sin parpadeo.

### 2.2. Capa de Eventos React / DOM (Sincronización de Estado)
En `ui-web/src/App.tsx`, se inicializa un listener global en la fase de captura (`capture: true`):
```ts
// Interceptor universal de inputs a MAYÚSCULAS
const handleGlobalInput = (e: Event) => {
  const target = e.target as HTMLInputElement | HTMLTextAreaElement;
  if (!target || !(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
  
  // Exclusión de cajas POS antes de las 22:00 hs
  const isPosRoute = window.location.pathname.startsWith('/pos');
  const now = new Date();
  // Hora local Paraguay (America/Asuncion)
  const pyHour = parseInt(now.toLocaleTimeString('en-US', { timeZone: 'America/Asuncion', hour12: false, hour: '2-digit' }), 10);
  if (isPosRoute && pyHour < 22) return;

  // Exclusiones técnicas
  if (target.type === 'password' || target.type === 'email' || target.type === 'file' || 
      target.type === 'checkbox' || target.type === 'radio' || target.type === 'range' || 
      target.type === 'color' || target.classList.contains('keep-case')) {
    return;
  }

  const originalValue = target.value;
  if (typeof originalValue !== 'string') return;
  const upperValue = originalValue.toUpperCase();

  if (originalValue !== upperValue) {
    const start = target.selectionStart;
    const end = target.selectionEnd;

    // Disparar setter nativo de prototipo para que React 18 registre el cambio en su estado interno
    const proto = target instanceof HTMLInputElement ? window.HTMLInputElement.prototype : window.HTMLTextAreaElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) {
      nativeSetter.call(target, upperValue);
    } else {
      target.value = upperValue;
    }

    if (start !== null && end !== null) {
      target.setSelectionRange(start, end);
    }
  }
};
```
Este interceptor intercepta las pulsaciones de teclado, pegado de portapapeles y autocompletado antes de que el árbol de eventos de React lo despache a los manejadores `onChange`, garantizando que el `state` de React reciba la cadena en mayúsculas de manera nativa y transparente.

### 2.3. Capa de Base de Datos (Normalización Idempotente)
Se crea una migración SQL / script de saneamiento ejecutado en la VM que actualiza datos existentes en lotes seguros:
- `products`: `nombre = UPPER(nombre)`, `descripcion = UPPER(descripcion)`, `marca = UPPER(marca)`, `categoria = UPPER(categoria)`, `unidad_medida = UPPER(unidad_medida)`
- `customers`: `razon_social = UPPER(razon_social)`, `nombre_fantasia = UPPER(nombre_fantasia)`, `direccion = UPPER(direccion)`, `contacto = UPPER(contacto)`, `ciudad = UPPER(ciudad)`, `departamento = UPPER(departamento)`
- `suppliers`: `razon_social = UPPER(razon_social)`, `nombre_fantasia = UPPER(nombre_fantasia)`, `contacto = UPPER(contacto)`, `direccion = UPPER(direccion)`, `ciudad = UPPER(ciudad)`, `rubro = UPPER(rubro)`
- `expenses`: `descripcion = UPPER(descripcion)`, `proveedor = UPPER(proveedor)`, `notas = UPPER(notas)`, `employee_nombre = UPPER(employee_nombre)`
- `product_categories`: `nombre = UPPER(nombre)`, `descripcion = UPPER(descripcion)`
- `product_brands`: `nombre = UPPER(nombre)`
- `purchase_orders`: `observaciones = UPPER(observaciones)`
- `purchase_order_items`: `descripcion = UPPER(descripcion)`
- `purchase_receipt_items`: `descripcion = UPPER(descripcion)`

---

## 3. Matriz de Exclusiones y Seguridad

| Campo / Contexto | Tratamiento | Motivo Técnico |
| :--- | :--- | :--- |
| **Passwords / PINs** | `keep-case` / Excluido | Sensible a mayúsculas/minúsculas; hashes irreversibles. |
| **Correos (`email`)** | `keep-case` / Excluido | Compatibilidad con servidores SMTP, RFC 5321 y estándares web. |
| **Tokens / UUIDs / URLs** | Excluido | Claves primarias foráneas, firmas JWT y rutas web. |
| **Payloads SIFEN / XML** | Excluido | Certificados digitales y firmas electrónicas se invalidarían. |
| **Webhooks Dinelco / Bancard / PIX** | Excluido | Firmas criptográficas HMAC dependientes del payload exacto. |
| **Enums de Sistema** (`estado`, `tipo`) | Excluido | Condicionales backend en Python dependen de `'draft'`, `'ticket'`, etc. |
| **Terminales POS (`/pos`)** | Diferido a 22:00 hs | Operación continua sin riesgo de desajustes en horario de atención. |

---

## 4. Estrategia de Pruebas y Verificación

1. **Pruebas de Componentes Frontend (Playwright):**
   - Escribir texto en minúsculas en un formulario administrativo (ej. nuevo proveedor o producto).
   - Verificar que el valor del input y el payload enviado al API estén en mayúsculas (`VALOR.toBe("TEXTO")`).
   - Verificar que un campo de contraseña conserve exactamente minúsculas, mayúsculas y caracteres especiales.
2. **Pruebas de Base de Datos:**
   - Validar conteo de registros antes y después de la migración (`SELECT count(*) WHERE col != UPPER(col)` -> 0).
3. **Verificación de Despliegue:**
   - Despliegue zero-downtime con `deploy-ui.sh`.
