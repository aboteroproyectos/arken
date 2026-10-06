// ARKEN PRECIOS · pruebas unitarias del núcleo (§16).
//
// Se leen los bloques «núcleo» y «semilla» del programa armado
// (precios/programa/ARKEN_PRECIOS.html): se prueba exactamente el código que corre en la
// página y en el Web Worker del tablero, sin copias.
//
//   · lector de precios colombianos (60 formatos reales) y precio literal (criterio 9)
//   · unidades y presentaciones · IVA y AIU · estadísticos · consolidación y confianza
//   · emparejamiento · calculadora laboral contra el ejemplo hecho a mano (criterio 10)
//   · contrato con ARKEN (validador) · escape, enlaces y claves (criterio 8)
//   · SHA-256 y PBKDF2 frente a Node · agregados del tablero con 50.000 observaciones
//   · registro por cambios · índices Jevons y Laspeyres, IPC, pesos constantes y proyección (Fase 4)
//   · fletes y precio puesto en obra, también en el libro para ARKEN (Fase 4)
//
// Uso: npm run prueba:unitarias

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import crypto from 'node:crypto';

const PRECIOS = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(PRECIOS, 'programa/ARKEN_PRECIOS.html'), 'utf8');
function bloque(id) {
  const m = html.match(new RegExp(`<script id="${id}">\\n?([\\s\\S]*?)</script>`));
  if (!m) throw new Error('No se encontró el bloque ' + id);
  return m[1];
}
const ctx = vm.createContext({ console, TextEncoder, URL, Intl });
vm.runInContext(bloque('arken-precios-nucleo') + '\n' + bloque('arken-precios-semilla') + '\nthis.Nucleo = Nucleo; this.Semilla = Semilla;', ctx);
const N = ctx.Nucleo;
const Semilla = ctx.Semilla;

let fallas = 0;
let pruebas = 0;
function seccion(t) {
  console.log('\n▸ ' + t);
}
function ok(cond, msg) {
  pruebas++;
  if (cond) console.log('  ✔ ' + msg);
  else {
    fallas++;
    console.error('  ✖ ' + msg);
  }
}
const cerca = (a, b, tol = 0.0005) => typeof a === 'number' && Math.abs(a - b) <= tol;

/* ── Lector de precios colombianos (§8.1) ── */
seccion('Lector de precios: formatos reales');
const CASOS = [
  ['$ 32.900', { valor: 32900 }], ['$32.900,50', { valor: 32900.5 }], ['32,900.50', { valor: 32900.5 }], ['COP 32900', { valor: 32900 }],
  ['32 mil', { valor: 32000 }], ['antes $40.000 ahora $32.900', { valor: 32900, promocion: true, precioAnterior: 40000 }],
  ['desde $18.500', { valor: 18500, desde: true }], ['$30.000 - $35.000', { valor: 32500, esRango: true }],
  ['entre $30.000 y $35.000', { valor: 32500, esRango: true }], ['$ 1.250.000 IVA incluido', { valor: 1250000, incluyeIva: true }],
  ['$ 1.050.000 + IVA', { valor: 1050000, incluyeIva: false }], ['Precio antes de IVA: $ 850.000', { valor: 850000, incluyeIva: false }],
  ["$ 1'250.000", { valor: 1250000 }], ['$1.250.000,00', { valor: 1250000 }], ['1.250.000 COP', { valor: 1250000 }],
  ['$ 3.290 c/u', { valor: 3290, unidad: 'UN' }], ['$ 50.000 /m2', { valor: 50000, unidad: 'M2' }],
  ['Caja x 1,44 m² $ 72.000', { valor: 72000, porPaquete: true, unidad: 'CAJA' }], ['Bulto de 50 kg $ 34.500', { valor: 34500, unidad: 'BTO' }],
  ['Cemento gris 42,5 kg $ 29.900', { valor: 29900 }], ['Rollo x 100 m $ 480.000', { valor: 480000, unidad: 'ROLLO' }],
  ['Galón $ 148.000', { valor: 148000, unidad: 'GL' }], ['Cuñete (5 galones) $ 610.000', { valor: 610000 }],
  ['$ 9.800 el kilo', { valor: 9800, unidad: 'KG' }], ['$ 4.800 metro', { valor: 4800, unidad: 'ML' }], ['Precio: 2.350.000 pesos', { valor: 2350000 }],
  ['Valor: $2,350,000', { valor: 2350000 }], ['$ 96.000 m³', { valor: 96000, unidad: 'M3' }],
  ['Oferta $ 199.900 Precio normal $ 249.900', { valor: 199900, promocion: true, precioAnterior: 249900 }],
  ['Precio regular: $ 64.900 Precio oferta: $ 54.900', { valor: 54900, promocion: true, precioAnterior: 64900 }],
  ['-20% $ 47.920', { valor: 47920, promocion: true }], ['1,5 millones', { valor: 1500000 }], ['$ 1.5 millones', { valor: 1500000 }],
  ['$ 450 mil', { valor: 450000 }], ['COP$ 12.500', { valor: 12500 }], ['$12.500 und', { valor: 12500, unidad: 'UN' }],
  ['Varilla corrugada No. 4 (1/2") x 6 m $ 32.900', { valor: 32900 }], ['Tubo PVC presión 1/2" RDE 9 x 6 m: $ 40.800', { valor: 40800 }],
  ['Porcelanato 60x60 cm $ 69.000 m2', { valor: 69000, unidad: 'M2' }], ['Hora de retroexcavadora $ 298.000 + IVA', { valor: 298000, incluyeIva: false, unidad: 'HR' }],
  ['Jornal $ 100.000', { valor: 100000, unidad: 'JOR' }], ['Viaje volqueta doble troque $ 420.000', { valor: 420000, unidad: 'VJE' }],
  ['$ 6.800 ML', { valor: 6800, unidad: 'ML' }], ['Precio con IVA $ 34.500 (sin IVA $ 28.992)', { valor: 34500, incluyeIva: true }],
  ['$ 0', { ok: false }], ['Agotado', { ok: false, disponibilidad: 'agotado' }], ['US$ 120', { valor: 120, moneda: 'USD' }],
  ['Desde $ 1.290.000 hasta $ 1.590.000', { valor: 1440000, esRango: true }], ['Precio unitario: $ 18.500 + IVA (19 %)', { valor: 18500, incluyeIva: false }],
  ['Total: $ 1.190.000 (IVA incluido)', { valor: 1190000, incluyeIva: true }],
  ['Subtotal $ 1.000.000 IVA $ 190.000 Total $ 1.190.000', { valor: 1190000, incluyeIva: true }],
  ['$ 1 250 000', { valor: 1250000 }], ['1 millón 250 mil', { valor: 1250000 }], ['Lámina drywall 1,22 x 2,44 m $ 38.900', { valor: 38900 }],
  ['Precio $ 45.900 Ahorra $ 5.000', { valor: 45900 }], ['Cable THHN No. 12 AWG rollo 100 m $ 285.000', { valor: 285000 }],
  ['Arena de peña m3 $ 85.000 puesto en obra', { valor: 85000, unidad: 'M3' }], ['Pintura vinilo tipo 1 cuñete $ 389.000', { valor: 389000 }],
  ['$ 2.350.000 /mes', { valor: 2350000, unidad: 'MES' }], ['Hoy $ 39.900 Antes $ 49.900', { valor: 39900, promocion: true, precioAnterior: 49900 }],
];
let lectorMal = 0;
for (const [texto, esperado] of CASOS) {
  const r = N.LectorPrecios.leer(texto);
  const malos = [];
  if (esperado.ok === false) {
    if (r.ok) malos.push('debía no encontrar precio');
  } else if (!r.ok) malos.push('no encontró precio');
  for (const k of Object.keys(esperado)) {
    if (k === 'ok') continue;
    const bien = typeof esperado[k] === 'number' ? cerca(r[k], esperado[k], 0.001) : r[k] === esperado[k];
    if (!bien) malos.push(`${k} = ${JSON.stringify(r[k])}, se esperaba ${JSON.stringify(esperado[k])}`);
  }
  if (malos.length) {
    lectorMal++;
    console.error(`  ✖ «${texto}»: ${malos.join('; ')}`);
  }
}
ok(CASOS.length >= 40 && lectorMal === 0, `${CASOS.length - lectorMal} de ${CASOS.length} formatos leídos bien (mínimo 40)`);

seccion('Precio literal: nadie crea un precio que no esté escrito (criterio 9)');
const L = N.LectorPrecios;
ok(L.estaEnTexto(32900, 'Cemento gris uso general x 50 kg $ 32.900 IVA incluido'), 'la cifra escrita se reconoce');
ok(L.estaEnTexto(1250000, "Tanque 1.000 L $ 1'250.000"), 'con separadores colombianos');
ok(L.estaEnTexto(45000, 'Antes $ 50.000, ahora $ 45.000'), 'el vigente de una promoción');
ok(!L.estaEnTexto(658, 'Cemento gris uso general x 50 kg $ 32.900'), 'un precio calculado (por kilo) no está en el texto');
ok(!L.estaEnTexto(47500, 'Entre $ 45.000 y $ 50.000'), 'el promedio de un rango no está en el texto');
ok(!L.estaEnTexto(32900, ''), 'sin texto no hay precio');
ok(!L.estaEnTexto(0, '$ 0'), 'cero nunca es un precio');

/* ── Unidades y presentaciones (§8.2 y Anexo B) ── */
seccion('Unidades y presentaciones');
const U = N.Unidades;
ok(['M', 'mt', 'metro'].every((u) => U.normalizar(u) === 'ML'), '«M», «mt» y «metro» se leen como ML');
ok(U.normalizar('m²') === 'M2' && U.normalizar('m3') === 'M3' && U.normalizar('bulto') === 'BTO' && U.normalizar('galón') === 'GL' && U.normalizar('c/u') === 'UN', 'm², m3, bulto, galón y c/u');
ok(U.factorFisico('LB', 'KG') === 0.5, 'la libra del comercio colombiano es de 500 g');
ok(U.factorFisico('TON', 'KG') === 1000, 'una tonelada son 1.000 kg');
const cemento = { id: 'c', descripcion: 'Cemento gris', unidad: 'BTO', contenido: { cantidad: 50, unidad: 'KG' } };
ok(cerca(U.factorACanonica(cemento, 'BTO', { cantidad: 42.5, unidad: 'KG' }).factor, 0.85, 1e-9), 'bulto de 42,5 kg = 0,85 del bulto de 50 kg');
ok(cerca(U.factorACanonica(cemento, 'KG', null).factor, 0.02, 1e-9), 'precio por kilo frente a bulto de 50 kg: factor 0,02');
ok(cerca(U.factorACanonica({ id: 'v', descripcion: 'Varilla', unidad: 'KG' }, 'UN', { cantidad: 5.964, unidad: 'KG' }).factor, 5.964, 1e-9), 'varilla de 6 m publicada por unidad con 5,964 kg');
ok(U.factorACanonica({ id: 'm', descripcion: 'Oficial', unidad: 'HC' }, 'JOR', null, { horasJornal: 7, divisorMensual: 210 }).factor === 7, 'un jornal son 7 horas');
const sinConversion = U.factorACanonica({ id: 'x', descripcion: 'Pintura', unidad: 'GL' }, 'M2', null);
ok(sinConversion.factor === null && /no hay una conversi/i.test(sinConversion.advertencia), 'sin conversión segura no se inventa un factor: se pide la presentación');
const norm = N.Observaciones.normalizar({ precioPublicado: 29900, unidadPublicada: 'BTO', presentacion: { cantidad: 42.5, unidad: 'KG' }, incluyeIva: true }, { tarifaIva: 19, ...cemento });
ok(norm.ok && cerca(norm.precioConIva, 35176.471) && cerca(norm.precioSinIva, 29560.059), 'bulto de 42,5 kg a $ 29.900 → $ 35.176,471 por bulto de 50 kg con IVA ($ 29.560,059 sin IVA)');

/* ── IVA y AIU (§8.3) ── */
seccion('IVA y AIU');
const I = N.Impuestos;
ok(cerca(I.sinIva(119000, 19), 100000) && cerca(I.conIva(100000, 19), 119000), 'IVA general del 19 %: $ 119.000 ↔ $ 100.000');
ok(cerca(I.conIva(100000, 5), 105000) && cerca(I.conIva(100000, 0), 100000), 'tarifa del 5 % y bienes exentos o excluidos');
const am = I.ambos(1050000, false, 19);
ok(cerca(am.sinIva, 1050000) && cerca(am.conIva, 1249500), 'precio «+ IVA»: $ 1.050.000 sin IVA → $ 1.249.500 con IVA');
const aiu = I.aiu({ costoDirecto: 10000000, a: 10, i: 5, u: 5, tarifaIva: 19 });
ok(cerca(aiu.administracion, 1000000) && cerca(aiu.imprevistos, 500000) && cerca(aiu.utilidad, 500000) && cerca(aiu.ivaUtilidad, 95000) && cerca(aiu.total, 12095000),
  'AIU 10/5/5 sobre $ 10.000.000 con IVA del 19 % solo sobre la utilidad → $ 12.095.000');

/* ── Estadísticos (§8.4 y §8.5) ── */
seccion('Estadísticos');
const E = N.Estadistica;
ok(E.mediana([5, 1, 3]) === 3 && E.mediana([1, 2, 3, 4]) === 2.5, 'mediana con número impar y par de datos');
ok(E.mad([1, 2, 3, 4, 100]) === 1, 'desviación absoluta mediana');
ok(JSON.stringify(E.atipicos([100, 104, 98, 101, 300, 102])) === JSON.stringify([false, false, false, false, true, false]), 'regla MAD: |x − mediana| > 3,5 × 1,4826 × MAD marca el 300');
ok(JSON.stringify(E.atipicos([100, 100, 100, 100, 5000])) === JSON.stringify([false, false, false, false, true]), 'con MAD cero un precio absurdo igual se marca');
ok(E.medianaPonderada([10, 20, 30], [1, 1, 10]) === 30 && E.medianaPonderada([10, 20, 30], [1, 1, 1]) === 20, 'mediana ponderada');
ok(cerca(E.coefVariacion([100, 100, 100]), 0, 1e-12), 'coeficiente de variación de datos iguales es cero');
ok(cerca(E.mediaGeometrica([1, 4]), 2, 1e-12), 'media geométrica (índice de Jevons)');

/* ── Consolidación y confianza (§8.5) ── */
seccion('Consolidación y confianza');
const ciudades = {
  '05001': { codigoDivipola: '05001', nombre: 'Medellín', region: 'Valle de Aburrá', regionAmplia: 'Antioquia' },
  '05266': { codigoDivipola: '05266', nombre: 'Envigado', region: 'Valle de Aburrá', regionAmplia: 'Antioquia' },
  '11001': { codigoDivipola: '11001', nombre: 'Bogotá', region: 'Bogotá-Cundinamarca', regionAmplia: 'Centro' },
};
const insumo = { id: 'i1', descripcion: 'Insumo de prueba', unidad: 'UN', grupo: 'G01', tarifaIva: 19 };
const obs = [];
const o = (c, f, p, fuente, tipo) => obs.push({ id: 'o' + obs.length, insumoId: 'i1', ciudad: c, fechaCaptura: f, precioConIva: p, fuenteId: fuente, tipoPrecio: tipo || 'lista', estado: 'válida', confianza: 0.8 });
o('05001', '2026-09-20', 100, 'f1'); o('05001', '2026-09-25', 104, 'f2'); o('05001', '2026-09-28', 98, 'f3', 'cotización');
o('05001', '2026-09-30', 101, 'f1'); o('05001', '2026-10-01', 300, 'f2'); o('05001', '2026-09-15', 102, 'f3');
o('05266', '2026-09-30', 110, 'f1'); o('', '2026-01-01', 90, 'ref', 'referencia');
const C = N.Consolidacion;
let r = C.consolidar(insumo, '05001', '2026-10-02', obs, { ciudades });
ok(r.recomendado === 101 && r.n === 5 && r.nFuentes === 3, 'Medellín: el 300 sale como atípico y la mediana ponderada de los otros cinco es 101');
ok(r.confianza === 'alta' && r.nivel === 'ciudad', 'Medellín: confianza alta (n ≥ 5, 3 fuentes, CV ≤ 15 %, ≤ 30 días) en la ciudad');
r = C.consolidar(insumo, '05266', '2026-10-02', obs, { ciudades });
ok(r.nivel === 'subregión' && r.confianza === 'media', 'Envigado, con una sola observación: se amplía a la subregión y la confianza baja a media');
r = C.consolidar(insumo, '11001', '2026-10-02', obs, { ciudades });
ok(r.nivel === 'país' && r.confianza === 'baja', 'Bogotá, sin datos en su región: nivel país y confianza baja');
r = C.consolidar(insumo, '11001', '2026-10-02', obs.filter((x) => x.tipoPrecio === 'referencia'), { ciudades });
ok(r.recomendado === 90 && r.soloReferencia === true && r.confianza === 'referencia', 'solo con la referencia de ARKEN: se usa y queda rotulada «referencia»');
r = C.consolidar(insumo, '11001', '2026-10-02', [], { ciudades });
ok(r.recomendado === null && r.confianza === 'sin dato', 'sin observaciones no hay precio');
const val = N.Observaciones.validar({ id: 'z', insumoId: 'i1', ciudad: '05001', fechaCaptura: '2026-10-02', precioConIva: 250 }, obs);
ok(val.estado === 'atípica', 'un precio fuera del rango aprendido entra como atípico, sin borrarse');

/* ── Registro por cambios (§6) ── */
seccion('Registro por cambios: un precio vale hasta su última vista');
const vieja = { id: 'rv', insumoId: 'i1', ciudad: '05001', fechaCaptura: '2026-06-24', fechaUltimaVista: '2026-09-27', precioConIva: 120, fuenteId: 'f9', tipoPrecio: 'lista', estado: 'válida', confianza: 0.8 };
const sinVista = Object.assign({}, vieja, { fechaUltimaVista: '' });
ok(N.Observaciones.vistaHasta(vieja, '2026-10-02') === '2026-09-27' && N.Observaciones.vistaHasta(vieja, '2026-08-01') === '2026-08-01' &&
  N.Observaciones.vistaHasta(vieja, '2026-06-01') === null && N.Observaciones.vistaHasta(sinVista, '2026-10-02') === '2026-06-24',
  'vistaHasta: la última vista, o la fecha pedida si es anterior; nada si se capturó después; sin otra vista, la captura');
r = C.consolidar(insumo, '05001', '2026-10-02', [vieja], { ciudades });
ok(r.recomendado === 120 && r.n === 1 && r.edadMediana === 5 && r.ultimaObservacion.fecha === '2026-09-27',
  'capturado hace 100 días y visto otra vez hace 5: sigue en la ventana de 45 días y su edad se cuenta desde la última vista');
r = C.consolidar(insumo, '05001', '2026-10-02', [sinVista], { ciudades });
ok(r.recomendado === null && r.confianza === 'sin dato' && r.ultimaObservacion.fecha === '2026-06-24', 'sin esa vista, el mismo precio queda fuera de la ventana');
r = C.consolidar(insumo, '05001', '2026-07-15', [vieja], { ciudades });
ok(r.recomendado === 120 && r.edadMediana === 0, 'consolidado en una fecha pasada, el precio cuenta como visto ese día (la serie queda completa)');

/* ── Emparejamiento (§9) ── */
seccion('Emparejamiento');
const catalogo = [
  { id: 'a', descripcion: 'Tubería PVC presión 1/2" RDE 9', unidad: 'ML', sinonimos: ['tubo pvc presion'] },
  { id: 'b', descripcion: 'Tubería PVC presión 3/4" RDE 11', unidad: 'ML' },
  { id: 'c', descripcion: 'Varilla corrugada 1/2" (No. 4)', unidad: 'KG' },
  { id: 'd', descripcion: 'Cemento gris de uso general (bulto 50 kg)', unidad: 'BTO' },
];
const emp = (t) => N.Emparejamiento.emparejar(t, catalogo);
ok(emp('Tubo PVC presión 1/2 pulgada RDE 9 x 6 m').candidatos[0].insumo.id === 'a', 'tubo de 1/2" con sinónimo y pulgadas en letras');
ok(emp('Tubo PVC 3/4" RDE 11 Pavco').candidatos[0].insumo.id === 'b', 'el diámetro decide entre 1/2" y 3/4"');
ok(emp('Varilla corrugada No. 4 de 6 m').candidatos[0].insumo.id === 'c', 'varilla No. 4 = 1/2"');
ok(emp('Cemento gris Argos uso general 50 kg').candidatos[0].insumo.id === 'd', 'cemento con marca');

/* ── Mano de obra (§14, criterio 10) ── */
seccion('Calculadora laboral contra el ejemplo hecho a mano (criterio 10)');
// Ejemplo hecho a mano con los parámetros de 2026, para un oficial con el salario mínimo,
// riesgo V, dotación de $ 150.000 por entrega y EPP de $ 30.000 al mes, con exoneración
// del art. 114-1 ET (salud, ICBF y SENA en cero):
//   salario 1.750.905 + auxilio 249.095 = 2.000.000 de base para cesantías, intereses y prima
//   cesantías 8,33 % × 2.000.000 = 166.600 · intereses 1 % × 2.000.000 = 20.000 · prima 166.600
//   vacaciones 4,17 % × 1.750.905 = 73.012,7385 · pensión 12 % = 210.108,6 · ARL V 6,96 % = 121.862,988
//   caja 4 % = 70.036,2 · dotación 3 × 150.000 ÷ 12 = 37.500 · EPP 30.000 · FIC 1.750.905 ÷ 40 = 43.772,625
//   total = 2.939.493,1515 → 2.939.493,152 · hora = total ÷ 210 = 13.997,586 · jornal = hora × 7 = 97.983,105
const P = N.Laboral.enFecha(Semilla.parametros('2026-10-02T00:00:00-05:00'), '2026-10-02');
const lab = N.Laboral.costoEmpresa({ salario: 1750905, claseRiesgo: 'V', dotacionPorEntrega: 150000, eppMensual: 30000 }, P);
const aMano = {
  Salario: 1750905, 'Auxilio de transporte': 249095, Cesantías: 166600, 'Intereses sobre cesantías': 20000, 'Prima de servicios': 166600,
  Vacaciones: 73012.7385, Pensión: 210108.6, Salud: 0, 'ARL clase V': 121862.988, 'Caja de compensación': 70036.2, ICBF: 0, SENA: 0,
  Dotación: 37500, 'Elementos de protección personal': 30000, FIC: 43772.625,
};
const lineasMal = lab.lineas.filter((l) => !(l.concepto in aMano) || !cerca(l.valor, aMano[l.concepto], 0.0006));
ok(lab.lineas.length === Object.keys(aMano).length && lineasMal.length === 0, 'cada línea del desglose coincide con la cuenta a mano' + (lineasMal.length ? ': ' + lineasMal.map((l) => l.concepto + ' ' + l.valor).join(', ') : ''));
ok(cerca(lab.totalMensual, 2939493.152), `costo mensual para la empresa: ${lab.totalMensual} (a mano: 2.939.493,1515)`);
ok(cerca(lab.costoHora, 13997.586) && lab.divisor === 210, `costo por hora con el divisor de 210 h: ${lab.costoHora}`);
ok(cerca(lab.jornal, 97983.105) && lab.horasJornal === 7, `jornal de 7 h: ${lab.jornal}`);
const antesDeJulio = N.Laboral.enFecha(Semilla.parametros(), '2026-07-14');
ok(antesDeJulio.divisorMensual === 220 && P.divisorMensual === 210, 'jornada de 42 h desde el 15 de julio de 2026: divisor 220 → 210');
ok(P.recargoDominical === 90 && N.Laboral.enFecha(Semilla.parametros(), '2027-07-01').recargoDominical === 100 && P.inicioNocturno === '19:00',
  'recargos de la Ley 2466 de 2025: dominical 90 % (100 % desde julio de 2027) y nocturno desde las 7:00 p. m.');
const alto = N.Laboral.costoEmpresa({ salario: 4000000, claseRiesgo: 'V', dotacionPorEntrega: 150000 }, P);
ok(alto.lineas.find((l) => l.concepto === 'Auxilio de transporte').valor === 0 && alto.lineas.find((l) => l.concepto === 'Dotación').valor === 0,
  'más de 2 SMMLV: sin auxilio de transporte ni dotación');
const cuad = N.Laboral.cuadrilla([{ oficio: 'Oficial', cantidad: 1, costoHora: lab.costoHora }, { oficio: 'Ayudante', cantidad: 1, costoHora: 10000 }]);
ok(cerca(cuad.costoHora, 23997.586) && cerca(N.Laboral.enUnidad(cuad.costoHora, 'JOR', P), 167983.102), 'cuadrilla AA = oficial + ayudante, en HC y en JOR');

/* ── Contrato con ARKEN (§10.1, criterio 1) ── */
seccion('Contrato con ARKEN: el validador lee como ARKEN');
const K = N.ContratoArken;
const ENC = N.ENCABEZADO_ARKEN;
const lista = [{ nombre: 'Cemento gris tipo I x 50 kg', unidad: 'BTO', categoria: 'Materiales' }];
const hojaBuena = [['ARKEN PRECIOS'], ENC, ['Materiales', 'BTO', 'Cemento gris tipo I x 50 kg', 33500.5], ['Ferretería', 'LB', 'Clavo de acero 2"', 6400]];
const vb = K.validar(hojaBuena, [
  { categoria: 'Materiales', unidad: 'BTO', descripcion: 'Cemento gris tipo I x 50 kg', precio: 33500.5 },
  { categoria: 'Ferretería', unidad: 'LB', descripcion: 'Clavo de acero 2"', precio: 6400 },
], lista);
ok(vb.ok && vb.leidas === 2 && vb.coinciden === 1 && vb.nuevas === 1, 'archivo bueno: 2 renglones, 1 «Ya existe» y 1 nuevo');
const vm1 = K.validar([ENC, ['Material', 'UN', 'A', 10], ['Materiales', 'UN', 'B', 0], ['Materiales', 'UN', 'C', '1.000'], ['Materiales', 'UN', 'b ', 5]], null, null);
ok(!vm1.ok && vm1.categoriasInvalidas === 1 && vm1.preciosInvalidos === 2 && vm1.duplicadas === 1, 'detecta categoría inválida, precio en cero, precio en texto y descripción repetida');
const vm2 = K.validar([ENC, ['Materiales', 'KG', 'Cemento gris tipo I x 50 kg', 700]], null, lista);
ok(!vm2.ok && vm2.cambiarian === 1, 'detecta que al sobrescribir ARKEN cambiaría la unidad');
const vm3 = K.validar([['Categorías incluidas: todas'], ENC, ['Materiales', 'UN', 'A', 10]], null, null);
ok(!vm3.ok, 'una fila informativa con «categor» en la columna A haría que ARKEN tome el encabezado equivocado');
const libro = K.armarLibro({ ciudadNombre: 'Medellín', corteNombre: 'Corte 2026-10', corteFecha: '2026-10-01', precioExportado: 'Recomendado', redondeo: 'ninguno',
  usuario: 'admin', incluyeDemo: false, excluidos: [], renglones: [{ categoria: 'Materiales', unidad: 'BTO', descripcion: 'Cemento gris tipo I x 50 kg', precioArken: 33500.4999, codigoInterno: 'G02-0001',
    factor: 1, unidadCanonica: 'BTO', tarifaIva: 19, n: 6, minimo: 32000, mediana: 33500, maximo: 34900, confianza: 'alta', fuentes: [], enlaces: [] }] });
const filasInfo = libro.hojas[0].filas.slice(0, libro.hojas[0].filas.findIndex((f) => f[0] === 'Categoría'));
ok(libro.hojas[0].nombre === 'Insumos' && filasInfo.every((f) => !/categor/i.test(N.normaliza(f[0]))), 'la primera hoja es «Insumos» y ninguna fila informativa dice «categor»');
ok(K.validar(libro.hojas[0].filas, libro.esperado, lista).ok && libro.esperado[0].precio === 33500.5, 'el libro armado pasa su propia validación, con 3 decimales');
const lm = K.leerListaMaestra([['ARKEN CONTROL — Empresa'], ['Lista maestra'], [], ['Código', 'Descripción', 'Unidad', 'Categoría', 'Precio unitario', 'Cantidad presupuestada', 'Valor presupuestado', 'Proveedor sugerido'],
  ['MAT-0001', 'Cemento gris tipo I x 50 kg', 'BTO', 'Materiales', 33500, 10, 335000, '']]);
ok(lm.ok && lm.filas.length === 1 && lm.filas[0].codigo === 'MAT-0001' && lm.filas[0].valor === 335000, 'lee la lista maestra que exporta ARKEN (encabezado por nombre)');
const abc = K.abc([{ descripcion: 'a', valor: 800 }, { descripcion: 'b', valor: 150 }, { descripcion: 'c', valor: 50 }]);
ok(abc.map((x) => x.clase).join('') === 'ABC', 'análisis ABC por valor presupuestado (80 % · 95 %)');
// Precio puesto en obra (§8.7): el archivo lo declara y trae el detalle del flete
const libroObra = K.armarLibro({ ciudadNombre: 'Medellín', corteNombre: 'Corte 2026-10', corteFecha: '2026-10-01', precioExportado: 'Recomendado', redondeo: 'ninguno',
  usuario: 'admin', incluyeDemo: false, excluidos: [],
  puestoEnObra: { nombre: 'Rionegro · Vereda de prueba', fletes: ['Camión · viaje de 8 toneladas · $ 520,000 · desde Medellín · 20/09/2026', 'Acarreo en mula · por bulto · $ 6,500 · desde Fin de la vía · 20/09/2026'],
    grupos: ['G02', 'G07'], kgPorBulto: 50, conFlete: 1, sinFlete: [{ descripcion: 'Bloque de prueba', motivo: 'No se sabe cuánto pesa una unidad (UN)' }] },
  renglones: [
    { categoria: 'Materiales', unidad: 'BTO', descripcion: 'Cemento gris tipo I x 50 kg', precioArken: 43250.5, precioAlmacenArken: 33500.5, fleteArken: 9750,
      fleteDetalle: 'Camión · viaje de 8 toneladas + Acarreo en mula · por bulto', codigoInterno: 'G02-0001', factor: 1, unidadCanonica: 'BTO', tarifaIva: 19, n: 6,
      minimo: 32000, mediana: 33500, maximo: 34900, confianza: 'alta', fuentes: [], enlaces: [] },
    { categoria: 'Ferretería', unidad: 'LB', descripcion: 'Clavo de acero 2"', precioArken: 6400, codigoInterno: 'G13-0001', factor: 1, unidadCanonica: 'LB', tarifaIva: 19, n: 4,
      minimo: 6000, mediana: 6400, maximo: 6900, confianza: 'media', fuentes: [], enlaces: [] }] });
const infoObra = libroObra.hojas[0].filas.slice(0, libroObra.hojas[0].filas.findIndex((f) => f[0] === 'Categoría'));
ok(infoObra.some((f) => /^PRECIO PUESTO EN OBRA en Rionegro · Vereda de prueba: 1 insumos voluminosos/.test(f[0])) && infoObra.every((f) => !/categor/i.test(N.normaliza(f[0]))),
  'con precio puesto en obra, el encabezado del archivo lo declara (y sigue sin decir «categor»)');
ok(K.validar(libroObra.hojas[0].filas, libroObra.esperado, lista).ok && libroObra.esperado[0].precio === 43250.5 && libroObra.hojas[0].filas.length === infoObra.length + 3,
  'el libro puesto en obra pasa la validación de ARKEN con el precio de almacén más el flete');
const detObra = libroObra.hojas[1].filas;
ok(detObra[0].length === 24 && detObra[0][23] === 'Flete aplicado' && detObra[1].slice(21).join('|') === '33500.5|9750|Camión · viaje de 8 toneladas + Acarreo en mula · por bulto' &&
  detObra[2].slice(21).join('|') === '6400|0|' && libro.hojas[1].filas[0].length === 21,
  'la hoja «Detalle» agrega precio de almacén, flete y flete aplicado solo cuando se pide');
const notasObra = libroObra.hojas[2].filas.map((f) => f[0]).join('\n');
ok(/Fletes usados \(2\)/.test(notasObra) && /van SIN flete.*\(1\)/.test(notasObra) && /No se sabe cuánto pesa una unidad \(UN\) \(1\):\n   Bloque de prueba/.test(notasObra),
  'las notas listan los fletes usados y los voluminosos que van sin flete, con el motivo');
ok(/_puesto-en-obra_Rionegro/.test(libroObra.nombreArchivo) && !/puesto-en-obra/.test(libro.nombreArchivo), 'el nombre del archivo dice que es puesto en obra, y en qué obra');

/* ── Seguridad (§16, criterio 8) ── */
seccion('Escape, enlaces y claves');
ok(!/[<>]/.test(N.esc('<img src=x onerror=alert(1)>')) && N.esc(`"'&`) === '&quot;&#39;&amp;', 'esc() neutraliza HTML y comillas');
ok(N.urlSegura('javascript:alert(1)') === '' && N.urlSegura('data:text/html,<b>x</b>') === '' && N.urlSegura('ftp://x.co/a') === '' && N.urlSegura('https://x.co/a b') === '',
  'solo se aceptan enlaces http y https bien formados');
ok(N.urlSegura('https://www.ejemplo.com.co/producto?id=7') === 'https://www.ejemplo.com.co/producto?id=7', 'un enlace https válido se conserva');
const conClave = { ia: { claveApi: 'sk-ant-api03-ABCDEFGHIJKLMNOP', modelo: 'x' }, nota: 'la clave es sk-ant-api03-ABCDEFGHIJKLMNOP' };
const limpio = N.limpiarClaves(conClave);
ok(!N.contieneClave(JSON.stringify(limpio)) && limpio.ia.modelo === 'x' && !('claveApi' in limpio.ia), 'las claves se retiran de respaldos y paquetes, aun escritas dentro de un texto');

/* ── Criptografía ── */
seccion('SHA-256 y PBKDF2 frente a Node');
ok(N.Cripto.sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'SHA-256 del vector «abc»');
const largo = 'ñ'.repeat(1000);
ok(N.Cripto.sha256Hex(largo) === crypto.createHash('sha256').update(largo).digest('hex'), 'SHA-256 de un texto largo con tildes');
const sal = crypto.randomBytes(16);
ok([1, 2, 1000].every((it) => N.Cripto.pbkdf2('contraseña segura', new Uint8Array(sal), it) === crypto.pbkdf2Sync(Buffer.from('contraseña segura'), sal, it, 32, 'sha256').toString('hex')),
  'PBKDF2-HMAC-SHA256 igual al de Node');
const env = N.Formatos.envolver(N.Formatos.PAQUETE, { a: 1 });
const alterado = JSON.parse(JSON.stringify(env));
alterado.contenido.a = 2;
ok(N.Formatos.verificar(env, N.Formatos.PAQUETE).ok && !N.Formatos.verificar(alterado, N.Formatos.PAQUETE).ok, 'un paquete alterado no pasa la verificación del hash');

/* ── Tablero (§13, criterio 6) ── */
seccion('Agregados del tablero con 50.000 observaciones');
const compactas = [];
let semillaAzar = 7;
const azar = () => ((semillaAzar = (semillaAzar * 16807) % 2147483647) / 2147483647);
const ciudadesT = ['05001', '11001', '76001', '08001', '68001', '66001', '17001', '13001'];
for (let k = 0; k < 50000; k++) {
  const ins = 'i' + (k % 400), c = ciudadesT[k % 8], mes = 1 + Math.floor(azar() * 24);
  const fecha = (2024 + Math.floor((mes - 1) / 12)) + '-' + String(((mes - 1) % 12) + 1).padStart(2, '0') + '-15';
  compactas.push({ i: ins, c, f: fecha, p: 1000 * (1 + (k % 400) / 40) * (1 + mes / 100) * (0.9 + azar() * 0.2), s: 'f' + (k % 5), d: 0, t: 'lista', id: 'o' + k });
}
let t0 = performance.now();
const ag = N.Agregados.construir(compactas);
const msConstruir = performance.now() - t0;
const meses = [];
for (let a = 2025; a <= 2025; a++) for (let mm = 1; mm <= 12; mm++) meses.push(a + '-' + String(mm).padStart(2, '0'));
const ids = Array.from({ length: 200 }, (_, k) => 'i' + k);
t0 = performance.now();
const ind = N.Agregados.indice(ag, ids, ciudadesT.slice(0, 4), meses, 'med');
const comp = N.Agregados.compararCiudades(ag, ids, ciudadesT, '05001', '2025-01', '2025-12');
const ext = N.Agregados.extremos(ag, ids, ciudadesT.slice(0, 4), '2025-01', '2025-12', 10);
const msConsulta = performance.now() - t0;
ok(ind.length === 12 && ind[0].indice === 100 && comp.length === 7 && ext.alzas.length === 10, 'índice, comparación entre ciudades y mayores alzas con filtros de fechas, ciudades e insumos');
ok(msConstruir + msConsulta < 1000, `construir ${msConstruir.toFixed(0)} ms + consultar ${msConsulta.toFixed(0)} ms, menos de un segundo`);
const indTarde = N.Agregados.indice(ag, ids, ciudadesT.slice(0, 4), ['2023-11', '2023-12', '2024-01', '2024-02'], 'med');
ok(indTarde[0].indice === null && indTarde[1].indice === null && indTarde[2].indice === 100 && indTarde[3].indice > 0,
  'si los datos empiezan a mitad del periodo, el índice toma como base el primer mes con datos');

/* ── Índices, pesos constantes y proyección (§13) ── */
seccion('Índices, IPC y proyección');
const A = N.Analitica;
const mesesI = ['2026-01', '2026-02', '2026-03'];
const valsI = new Map([
  ['a', new Map([['2026-01', 100], ['2026-02', 110], ['2026-03', 121]])],
  ['b', new Map([['2026-01', 50], ['2026-02', 50], ['2026-03', 60]])],
]);
const jev = A.indicesEncadenados(valsI, () => 'k', mesesI).get('k');
ok(jev.base === '2026-01' && jev.puntos[0].indice === 100 && cerca(jev.puntos[1].indice, 100 * Math.sqrt(1.1), 1e-9) && cerca(jev.puntos[2].indice, 100 * Math.sqrt(1.1) * Math.sqrt(1.32), 1e-9),
  'Jevons encadenado: cada eslabón es la media geométrica de los relativos del mes');
const porClave = A.indicesEncadenados(valsI, (id) => (id === 'a' ? 'x' : 'y'), mesesI);
const las = A.laspeyres(porClave, { x: 3, y: 1 }, mesesI);
ok(cerca(las.puntos[1].indice, 107.5, 1e-9) && cerca(las.puntos[2].indice, 120.75, 1e-9) && las.puntos[2].cobertura === 1,
  'Laspeyres encadenado con pesos 3 y 1: igual al de base fija (107,5 y 120,75) cuando todas las claves tienen dato');
const valsHueco = new Map([['a', new Map([['2026-01', 100], ['2026-03', 121]])], ['b', new Map([['2026-01', 50], ['2026-02', 55], ['2026-03', 60.5]])]]);
const hueco = A.indicesEncadenados(valsHueco, () => 'k', mesesI).get('k');
ok(cerca(hueco.puntos[1].indice, 110, 1e-9) && cerca(hueco.puntos[2].indice, 121, 1e-9), 'un insumo sin dato un mes se imputa con su clase y no salta el índice cuando vuelve');
ok(A.CANASTAS_TIPO.length === 3 && A.CANASTAS_TIPO.every((c) => cerca(Object.values(c.pesos).reduce((s, w) => s + w, 0), 100, 1e-9)),
  'las tres canastas tipo suman 100 en sus pesos por grupo');
const pe = A.pesosElementales({ i1: { g: 'G01', a: 'Materiales' }, i2: { g: 'G01', a: 'Materiales' }, i3: { g: 'G01', a: 'Equipo' }, i4: { g: 'G02', a: 'Materiales' } }, { pesos: { G01: 3, G02: 1 } });
ok(pe['G01|Materiales'] === 2 && pe['G01|Equipo'] === 1 && pe['G02|Materiales'] === 1, 'el peso de un grupo se reparte entre sus categorías según cuántos insumos tiene cada una');
ok(A.numeroIndice('144,62') === 144.62 && A.numeroIndice('144.62') === 144.62 && A.numeroIndice('1.234,5') === 1234.5 && A.numeroIndice('abc') === null,
  'número índice con coma o punto decimal');
ok(['2025-01', '2025-01-31', '01/2025', '31/01/2025', 'ene-25', 'Enero de 2025', 'Ene. 2025', 45688].every((v) => A.mesDeCelda(v) === '2025-01') && A.mesDeCelda('13/2025') === '',
  'el mes se lee en ocho formatos, también un serial de Excel');
const ipcMatriz = A.leerIpc([['Índice (sintético, solo para la prueba)'], ['Mes', 2024, 2025], ['Enero', '100,00', '104,00'], ['Febrero', '101,00', '105,50'], ['Total', '', '']]);
ok(ipcMatriz.forma.startsWith('matriz') && ipcMatriz.filas.map((x) => x.mes + '=' + x.indice).join(' ') === '2024-01=100 2024-02=101 2025-01=104 2025-02=105.5' && !ipcMatriz.avisos.length,
  'IPC en matriz (meses en filas, años en columnas), como los anexos del DANE');
const ipcLarga = A.leerIpc([['Año', 'Mes', 'Índice'], [2025, 1, 104], [2025, 'febrero', '105,5'], [2025, 3, 'x'], [2025, 4, 140]]);
ok(ipcLarga.forma === 'larga (año y mes)' && ipcLarga.filas.length === 3 && ipcLarga.avisos.some((t) => /mezcla dos bases/.test(t)) === false,
  'IPC en tabla larga: año y mes en columnas aparte; una celda que no es número se omite');
ok(A.leerIpc([['Fecha', 'Índice'], ['2025-01', 100], ['2025-02', 130]]).avisos.some((t) => /mezcla dos bases/.test(t)) && !A.leerIpc([['nada']]).filas.length,
  'un salto de más del 20 % en un mes se avisa; una hoja sin IPC no se lee');
const df = A.deflactor([{ mes: '2025-01', indice: 100 }, { mes: '2025-02', indice: 102 }, { mes: '2025-03', indice: 105 }], ['2024-12', '2025-01', '2025-02', '2025-03', '2025-04'], '2025-03');
ok(df.ok && df.base === '2025-03' && df.factores.get('2024-12') === null && cerca(df.factores.get('2025-01'), 1.05, 1e-12) && cerca(df.factores.get('2025-02'), 105 / 102, 1e-12) &&
  df.factores.get('2025-04') === 1 && df.arrastrados.join() === '2025-04' && df.sinIpc.join() === '2024-12' && !A.deflactor([], ['2025-01']).ok,
  'pesos constantes: IPC(base)/IPC(mes); después del último IPC se usa el último, antes del primero no se deflacta');
const tramoI = A.tramoContinuo([{ mes: '2024-01', valor: 50 }, { mes: '2024-06', valor: 60 }, { mes: '2025-01', valor: 100 }, { mes: '2025-04', valor: 133.1 }]);
ok(tramoI.puntos.map((p) => p.mes).join() === '2025-01,2025-02,2025-03,2025-04' && tramoI.interpolados === 2 && cerca(tramoI.puntos[1].valor, 110, 1e-9),
  'para proyectar se toma el último tramo sin huecos de más de dos meses; los huecos se interpolan con crecimiento constante');
const serieP = (n, f) => Array.from({ length: n }, (_, t) => ({ mes: N.sumaMeses('2024-01', t), valor: f(t) }));
const corta = A.proyectar(serieP(11, (t) => 1000 * Math.pow(1.01, t)));
ok(!corta.ok && /12 meses/.test(corta.motivo) && corta.rotulo === A.ROTULO_PROYECCION, 'con menos de 12 meses de historia no se proyecta, y se dice por qué');
const exacta = A.proyectar(serieP(24, (t) => 1000 * Math.pow(1.01, t)));
ok(exacta.ok && exacta.puntos.length === 6 && exacta.puntos[0].mes === '2026-01' && cerca(exacta.puntos[0].valor, 1000 * Math.pow(1.01, 24), 1e-6) &&
  cerca(exacta.puntos[5].valor, 1000 * Math.pow(1.01, 29), 1e-6) && A.proyectar(serieP(24, (t) => 1000 + t), 3).puntos.length === 3,
  'Holt sobre el logaritmo: una serie que crece 1 % al mes se proyecta con ese 1 %, de 3 a 6 meses');
const ruidosa = A.proyectar(serieP(30, (t) => 1000 * Math.pow(1.008, t) * (1 + 0.03 * Math.sin(t * 1.7))), 9);
ok(ruidosa.ok && ruidosa.horizonte === 6 && ruidosa.puntos.every((p, k, l) => p.bajo < p.valor && p.valor < p.alto && (!k || p.alto - p.bajo > l[k - 1].alto - l[k - 1].bajo)) &&
  ruidosa.rotulo === 'Proyección: no es un precio de mercado', 'la banda del 95 % rodea la proyección y se abre con el horizonte; siempre va rotulada');

/* ── Fletes y precio puesto en obra (§5 y §8.7) ── */
seccion('Fletes y precio puesto en obra');
{
const FL = N.Fletes;
const arena = { id: 'ar', descripcion: 'Arena de pega', unidad: 'M3', grupo: 'G01' };
const cemento = { id: 'ce', descripcion: 'Cemento gris', unidad: 'BTO', grupo: 'G02', contenido: { cantidad: 50, unidad: 'KG' } };
const acero = { id: 'ac', descripcion: 'Acero de refuerzo', unidad: 'KG', grupo: 'G05' };
const bloque = { id: 'bl', descripcion: 'Bloque de concreto', unidad: 'UN', grupo: 'G07' };
const pintura = { id: 'pi', descripcion: 'Pintura', unidad: 'GL', grupo: 'G25' };
let nFlete = 0;
const flete = (vehiculo, unidad, precio, extra) => Object.assign({ id: 'fl' + ++nFlete, origen: 'Medellín', destino: 'Rionegro', vereda: '', vehiculo, unidad, precio,
  capacidad: null, capacidadUnidad: '', distanciaKm: null, fecha: '2026-09-20', fuente: 'Transportador de prueba', creado: '2026-09-20T10:00:00-05:00' }, extra);
const volq = flete('volqueta sencilla', 'viaje', 380000, { capacidad: 6, capacidadUnidad: 'm3' });
const cam = flete('camión', 'viaje', 520000, { capacidad: 8, capacidadUnidad: 't' });
const mula = flete('acarreo en mula', 'bulto', 6500, { origen: 'Fin de la vía' });
const porKm = flete('volqueta sencilla', 'm3km', 3500, { distanciaKm: 25 });
const porTon = flete('camión', 'tonelada', 70000);
ok(FL.esVoluminoso(arena) && FL.esVoluminoso(cemento) && FL.esVoluminoso(bloque) && !FL.esVoluminoso(pintura) && FL.esVoluminoso(pintura, { grupos: ['G25'] }),
  'son voluminosos los grupos de agregados, cemento, acero, mampostería, prefabricados y cubiertas (se puede cambiar)');
const v = (ins, f, P) => { const x = FL.porUnidad(ins, f, P); return x ? Math.round(x.valor * 1000) / 1000 + ' ' + x.base : null; };
ok(v(arena, volq) === '63333.333 volumen' && v(acero, volq) === null && v(arena, porKm) === '87500 volumen',
  'volqueta de 6 m³ a $ 380.000: $ 63.333,333 por m³ de arena; por m³·km, precio × km; el acero no va por volumen');
ok(v(cemento, cam) === '3250 peso' && v(acero, cam) === '65 peso' && v(cemento, porTon) === '3500 peso' && v(bloque, cam) === null &&
  v(Object.assign({}, bloque, { pesoKg: 9 }), cam) === '585 peso',
  'camión de 8 t a $ 520.000: $ 3.250 por bulto de 50 kg y $ 65 por kg; el bloque necesita su peso (con 9 kg, $ 585)');
ok(v(cemento, mula) === '6500 bultos' && v(acero, mula) === '130 bultos' && v(arena, mula) === null && v(Object.assign({}, arena, { pesoKg: 1500 }), mula) === '195000 bultos' &&
  v(acero, mula, { kgPorBulto: 40 }) === '162.5 bultos',
  'mula por bulto: un bulto de cemento es un bulto; un kg de acero es 1/50 de bulto (el bulto de carga se puede cambiar)');
const pi = FL.paraInsumo(cemento, [volq, cam, porTon, mula]);
ok(pi.valor === 9750 && pi.vehiculo.flete === cam && pi.mula.flete === mula && FL.paraInsumo(arena, [volq, porKm]).vehiculo.flete === volq && FL.paraInsumo(pintura, [cam]) === null,
  'puesto en obra: el vehículo más barato que lo lleva, más la mula del último tramo ($ 3.250 + $ 6.500)');
ok(/escriba su peso/.test(FL.motivoSinFlete(bloque)) && /va por volumen \(escriba la masa de un m³/.test(FL.motivoSinFlete(arena)), 'si un voluminoso queda sin flete se dice por qué');
ok(FL.tarifa(volq).valor === 380000 / 6 && FL.tarifa(volq).por === 'm³' && FL.tarifa(porKm).valor === 87500 && FL.tarifa(cam).por === 'tonelada' && FL.tarifa(mula).por === 'bulto',
  'la tabla muestra cuánto sale cada m³, tonelada o bulto');
ok(FL.validar({}).length === 6 && FL.validar(flete('camión', 'viaje', 520000)).some((t) => /lo que carga/.test(t)) &&
  FL.validar(flete('volqueta sencilla', 'm3km', 3500)).some((t) => /kilómetros/.test(t)) && FL.validar(Object.assign({}, cam, { fecha: '2026-10-09' }), '2026-10-02').some((t) => /posterior/.test(t)) &&
  FL.validar(cam, '2026-10-02').length === 0, 'un flete sin destino, vehículo, cobro, precio, fecha o fuente no se guarda; tampoco con fecha futura');
const viejo = Object.assign({}, cam, { id: 'fl-viejo', precio: 500000, fecha: '2026-08-01' });
const retirado = Object.assign({}, volq, { id: 'fl-ret', retirado: true });
const vig = FL.vigentes([viejo, cam, mula, retirado, Object.assign({}, cam, { id: 'fl-otra', destino: 'Guarne' })], FL.claveDestino({ destino: 'RIONEGRO' }));
ok(vig.length === 2 && vig[0] === cam && vig[1] === mula, 'de cada ruta, vehículo y cobro cuenta el registro más reciente; los retirados no cuentan; la mula va de último');
const des = FL.destinos([cam, Object.assign({}, mula, { vereda: 'Vereda de prueba' }), Object.assign({}, cam, { id: 'x', destino: 'Medellin', esDemo: true }), Object.assign({}, cam, { id: 'y', destino: 'Medellín', esDemo: true })]);
ok(des.length === 3 && des.map((d) => d.nombre).join(' | ') === 'Medellin | Rionegro | Rionegro · Vereda de prueba' && des[0].n === 2 && des[0].demo && !des[1].demo,
  'cada obra es un municipio y, si se quiere, una vereda (sin importar tildes ni mayúsculas)');
ok(FL.describir(Object.assign({}, cam, { esDemo: true })).replace(/\s/g, ' ') === 'Camión · viaje de 8 toneladas · $ 520,000 · desde Medellín · 20/09/2026 · DEMO', 'cada flete usado se describe en una línea');
}

/* ── Semilla (§9, §15 y Anexo A) ── */
seccion('Semilla');
const res = Semilla.resumen();
ok(res.arken === 336 && res.nuevos >= 300, `${res.arken} insumos de ARKEN (Anexo A) y ${res.nuevos} nuevos (mínimo 300 en la Fase 1)`);
ok(res.total > 1000, `${res.total} insumos en el catálogo semilla: más de 1.000 (Fase 4)`);
const cat = Semilla.catalogo('2026-10-02T00:00:00-05:00');
ok(cat.every((i) => N.CATEGORIAS_ARKEN.includes(i.categoriaArken)), 'cada insumo tiene una de las siete categorías de ARKEN');
ok(new Set(cat.map((i) => i.codigo)).size === cat.length && new Set(cat.map((i) => N.normaliza(i.descripcion))).size === cat.length, 'códigos y descripciones sin repetir');
ok(cat.every((i) => i.palabrasClave.every((t) => typeof t === 'string')), 'las palabras clave del catálogo son texto (también las de «Oficial constructor en guadua»)');
ok(N.Emparejamiento.tokens('Oficial constructor valueOf toString').every((t) => typeof t === 'string') && N.Unidades.normalizar('constructor') === null &&
  N.Unidades.dimension('constructor') === null, 'un texto externo con «constructor» o «valueOf» no devuelve propiedades heredadas de Object');
const eqs = Semilla.equivalencias(cat, '2026-10-02T00:00:00-05:00');
ok(eqs.length === 336 && eqs.every((e) => e.estado === 'exacta'), 'las 336 equivalencias con ARKEN vienen confirmadas, con la descripción literal');
const refs = Semilla.observacionesReferencia(cat, '2026-10-02T00:00:00-05:00');
ok(refs.every((x) => x.tipoPrecio === 'referencia' && x.fuenteId === 'ref-arken') && refs.length === 334, 'el único precio de la semilla es el de partida de ARKEN, rotulado referencia (334 con precio)');

console.log(`\n${pruebas - fallas} de ${pruebas} comprobaciones bien.`);
process.exit(fallas ? 1 : 0);
