/**
 * Motor puro de evaluación de actividades de proveedor para Inteliforce (móvil).
 * Espejo de api/src/actividades/engine.py
 */

export function gs(amount: number): number {
  return Math.ceil(amount);
}

export interface LineaInput {
  product_id: string;
  cantidad: number;
  precio: number;
  costo?: number | null;
}

export interface TramoInput {
  desde?: number | null;
  porcentaje?: number | null;
  cada?: number | null;
  bonifica?: number | null;
  producto_bonificado_id?: string | null;
  tope?: number | null;
}

export interface ActividadInput {
  id: string;
  nombre?: string;
  tipo: 'escala' | 'bonificacion';
  producto_ids: string[];
  vigente_hasta?: string;
  saldo?: number;
  valoriza?: 'lista' | 'costo';
  tramos: TramoInput[];
}

export interface LineaResultado {
  product_id: string;
  actividad_id: string | null;
  cantidad?: number;
  descuento_unitario: number;
  bonificada: boolean;
  valor: number;
  nombre_actividad?: string;
}

export function evaluar(
  lineas: LineaInput[],
  actividades: ActividadInput[]
): LineaResultado[] {
  // 1. Candidatos de descuento por cada línea original
  const ofertasPorLinea: Array<
    Array<{
      actividad_id: string;
      descuento_unitario: number;
      vigente_hasta: string;
      valor: number;
      nombre?: string;
    }>
  > = lineas.map(() => []);

  const bonificacionesAplicadas: LineaResultado[] = [];

  for (const act of actividades) {
    const prodSet = new Set(act.producto_ids || []);
    // Sumar cantidades de productos en el alcance
    let base = 0;
    for (const l of lineas) {
      if (prodSet.has(l.product_id)) {
        base += Number(l.cantidad);
      }
    }
    if (base <= 0) continue;

    const tipo = act.tipo;
    const tramos = act.tramos || [];

    if (tipo === 'escala') {
      const tramosCumplidos = tramos.filter(
        (t) => t.desde != null && Number(t.desde) <= base
      );
      if (tramosCumplidos.length === 0) continue;

      // Quedarse con el tramo mayor (máximo desde)
      const tramo = tramosCumplidos.reduce((prev, curr) =>
        Number(curr.desde) > Number(prev.desde) ? curr : prev
      );
      const pct = Number(tramo.porcentaje || 0);
      if (pct <= 0) continue;

      for (let idx = 0; idx < lineas.length; idx++) {
        const l = lineas[idx];
        if (prodSet.has(l.product_id)) {
          const precio = Number(l.precio);
          const cant = Number(l.cantidad);
          const descUnit = gs((precio * pct) / 100);
          const valor = gs(descUnit * cant);
          ofertasPorLinea[idx].push({
            actividad_id: act.id,
            descuento_unitario: descUnit,
            vigente_hasta: act.vigente_hasta || '9999-12-31',
            valor,
            nombre: act.nombre,
          });
        }
      }
    } else if (tipo === 'bonificacion') {
      const tramosCumplidos = tramos.filter(
        (t) => t.desde != null && Number(t.desde) <= base
      );
      if (tramosCumplidos.length === 0) continue;

      const tramo = tramosCumplidos.reduce((prev, curr) =>
        Number(curr.desde) > Number(prev.desde) ? curr : prev
      );
      const cada = Number(tramo.cada || 1);
      const bonifica = Number(tramo.bonifica || 0);
      if (cada <= 0 || bonifica <= 0) continue;

      const veces = Math.floor(base / cada);
      let unidades = veces * bonifica;
      if (tramo.tope != null) {
        const tope = Number(tramo.tope);
        if (unidades > tope) {
          unidades = tope;
        }
      }

      if (unidades > 0) {
        let prodBoni = tramo.producto_bonificado_id;
        if (!prodBoni) {
          const matching = lineas.filter((l) => prodSet.has(l.product_id));
          prodBoni = matching.length > 0 ? matching[0].product_id : null;
        }

        if (prodBoni) {
          const valorizaModo = act.valoriza || 'lista';
          const matchingBoni = lineas.filter((l) => l.product_id === prodBoni);
          let costoRef: number | null = null;
          let precioRef: number | null = null;
          if (matchingBoni.length > 0) {
            costoRef = matchingBoni[0].costo ?? null;
            precioRef = matchingBoni[0].precio ?? null;
          }

          let valUnit = 0;
          if (valorizaModo === 'costo' && costoRef != null) {
            valUnit = Number(costoRef);
          } else if (precioRef != null) {
            valUnit = Number(precioRef);
          }

          const valorTotal = gs(unidades * valUnit);
          bonificacionesAplicadas.push({
            product_id: prodBoni,
            actividad_id: act.id,
            cantidad: unidades,
            descuento_unitario: 0,
            bonificada: true,
            valor: valorTotal,
            nombre_actividad: act.nombre,
          });
        }
      }
    }
  }

  // 2. Construir resultado para líneas originales
  const resultado: LineaResultado[] = [];
  for (let idx = 0; idx < lineas.length; idx++) {
    const l = lineas[idx];
    const ofertas = ofertasPorLinea[idx];
    if (ofertas.length === 0) {
      resultado.push({
        product_id: l.product_id,
        actividad_id: null,
        descuento_unitario: 0,
        bonificada: false,
        valor: 0,
      });
    } else {
      // Gana mayor descuento unitario; empate: vence antes (menor fecha YYYY-MM-DD)
      const mejor = ofertas.reduce((prev, curr) => {
        if (curr.descuento_unitario > prev.descuento_unitario) return curr;
        if (curr.descuento_unitario < prev.descuento_unitario) return prev;
        return curr.vigente_hasta < prev.vigente_hasta ? curr : prev;
      });
      resultado.push({
        product_id: l.product_id,
        actividad_id: mejor.actividad_id,
        descuento_unitario: mejor.descuento_unitario,
        bonificada: false,
        valor: mejor.valor,
        nombre_actividad: mejor.nombre,
      });
    }
  }

  // 3. Agregar bonificaciones al final
  resultado.push(...bonificacionesAplicadas);
  return resultado;
}
