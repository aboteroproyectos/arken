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

/* ── Semilla (§9, §15 y Anexo A) ── */
seccion('Semilla');
const res = Semilla.resumen();
ok(res.arken === 336 && res.nuevos >= 300, `${res.arken} insumos de ARKEN (Anexo A) y ${res.nuevos} nuevos (mínimo 300 en la Fase 1)`);
const cat = Semilla.catalogo('2026-10-02T00:00:00-05:00');
ok(cat.every((i) => N.CATEGORIAS_ARKEN.includes(i.categoriaArken)), 'cada insumo tiene una de las siete categorías de ARKEN');
ok(new Set(cat.map((i) => i.codigo)).size === cat.length && new Set(cat.map((i) => N.normaliza(i.descripcion))).size === cat.length, 'códigos y descripciones sin repetir');
const eqs = Semilla.equivalencias(cat, '2026-10-02T00:00:00-05:00');
ok(eqs.length === 336 && eqs.every((e) => e.estado === 'exacta'), 'las 336 equivalencias con ARKEN vienen confirmadas, con la descripción literal');
const refs = Semilla.observacionesReferencia(cat, '2026-10-02T00:00:00-05:00');
ok(refs.every((x) => x.tipoPrecio === 'referencia' && x.fuenteId === 'ref-arken') && refs.length === 334, 'el único precio de la semilla es el de partida de ARKEN, rotulado referencia (334 con precio)');

console.log(`\n${pruebas - fallas} de ${pruebas} comprobaciones bien.`);
process.exit(fallas ? 1 : 0);
