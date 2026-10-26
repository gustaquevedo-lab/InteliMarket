import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { evaluar, LineaInput, ActividadInput } from './actividades';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar fixture de casos compartidos con Python
const fixturePath = path.resolve(__dirname, '../../api/tests/fixtures/actividades_casos.json');
const rawData = fs.readFileSync(fixturePath, 'utf8');
const casos = JSON.parse(rawData);

let passed = 0;
let failed = 0;

for (const caso of casos) {
  const nombre = caso.nombre;
  const lineas: LineaInput[] = caso.lineas.map((l: any) => ({
    product_id: l.product_id,
    cantidad: Number(l.cantidad),
    precio: Number(l.precio),
    costo: l.costo ? Number(l.costo) : null,
  }));

  const actividades: ActividadInput[] = caso.actividades.map((a: any) => ({
    id: a.id,
    tipo: a.tipo,
    producto_ids: a.producto_ids,
    vigente_hasta: a.vigente_hasta,
    saldo: a.saldo ? Number(a.saldo) : undefined,
    valoriza: a.valoriza,
    tramos: a.tramos.map((t: any) => ({
      desde: t.desde ? Number(t.desde) : null,
      porcentaje: t.porcentaje ? Number(t.porcentaje) : null,
      cada: t.cada ? Number(t.cada) : null,
      bonifica: t.bonifica ? Number(t.bonifica) : null,
      producto_bonificado_id: t.producto_bonificado_id,
      tope: t.tope ? Number(t.tope) : null,
    })),
  }));

  const obtenido = evaluar(lineas, actividades);
  const esperado = caso.esperado;

  let casoOk = true;
  if (obtenido.length !== esperado.length) {
    console.error(`[FAIL] ${nombre}: tamaño esperado ${esperado.length}, obtenido ${obtenido.length}`);
    casoOk = false;
  } else {
    for (let i = 0; i < esperado.length; i++) {
      const esp = esperado[i];
      const obt = obtenido[i];
      const prodOk = obt.product_id === esp.product_id;
      const actOk = obt.actividad_id === esp.actividad_id;
      const descOk = obt.descuento_unitario === Number(esp.descuento_unitario);
      const boniOk = obt.bonificada === esp.bonificada;
      const valorOk = obt.valor === Number(esp.valor);
      const cantOk = esp.cantidad == null || obt.cantidad === Number(esp.cantidad);

      if (!prodOk || !actOk || !descOk || !boniOk || !valorOk || !cantOk) {
        console.error(`[FAIL] ${nombre} en índice ${i}:`, {
          esperado: esp,
          obtenido: obt,
        });
        casoOk = false;
        break;
      }
    }
  }

  if (casoOk) {
    console.log(`[PASS] ${nombre}`);
    passed++;
  } else {
    failed++;
  }
}

console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron de ${casos.length} casos.`);
if (failed > 0) {
  process.exit(1);
}
