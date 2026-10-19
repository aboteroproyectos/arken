// ARKEN ANALYTICA · pruebas unitarias del núcleo (§25).
//
// Se carga fuente/nucleo/ tal como lo une el ensamblador (la comprobación de CI asegura
// que el programa armado es exactamente ese código).
//
//   · cálculo del presupuesto contra un ejemplo hecho a mano, AIU e IVA en sus tres modos
//   · dígito de verificación del NIT (DIAN), festivos de Colombia y días hábiles
//   · nombres de archivo y código de invitación
//   · las funciones de lectura de ARKEN CONTROL son copia fiel del ARKEN_CONTROL.html real
//   · Excel para ARKEN: ida y vuelta en Node con el validador de ARKEN, sin errores
//   · Excel de ARKEN PRECIOS y su comparación con la base de precios
//   · plantilla del Anexo B: 1.000 puntos y sin problemas
//   · acuerdo de confidencialidad: aprobación ligada al texto, cláusula penal y su rango
//   · SMMLV y conversión de experiencia · revisión antes de emitir · cronograma
//   · el pliego no lleva un solo precio del presupuesto base (criterio 2)
//
// Uso: npm run prueba:unitarias

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { nucleo, marcador, XLSX, RAIZ } from './comun.mjs';

const N = nucleo();
const { Util, Calculo, Nit, Festivos, ExcelArken, ExcelPrecios, Parametros, PlantillaCondiciones, Confidencialidad, Cronograma, Revision, Pliego, Demo } = N;
const m = marcador('Pruebas unitarias del núcleo de ARKEN ANALYTICA');
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ── Presupuesto hecho a mano ── */
function ejemplo() {
  return {
    capitulos: [
      { id: 'c1', codigo: '01', nombre: 'Cimentación', subs: [{ id: 's1', codigo: '01.01', nombre: 'Concretos', acts: [
        { id: 'a1', codigo: '01.01.01', nombre: 'Concreto de zapatas', unidad: 'M3', cantidad: 12.5, apus: ['p1'] },
        { id: 'a2', codigo: '01.01.02', nombre: 'Pañete de muros', unidad: 'M2', cantidad: 140, apus: ['p2'] }] }] },
      { id: 'c2', codigo: '02', nombre: 'Estructura', subs: [{ id: 's2', codigo: '02.01', nombre: 'Placas', acts: [
        { id: 'a3', codigo: '02.01.01', nombre: 'Placa con acabado', unidad: 'M3', cantidad: 3, apus: ['p1', 'p2'] }] }] }],
    apus: [
      { id: 'p1', codigo: 'APU-1', nombre: 'Concreto de 3.000 psi', unidad: 'M3', insumos: [
        { idInsumo: 'i1', cantidad: 7 }, { idInsumo: 'i2', cantidad: 0.55 }, { idInsumo: 'i3', cantidad: 8 }, { idInsumo: 'i4', cantidad: 0.5 }] },
      { id: 'p2', codigo: 'APU-2', nombre: 'Mortero de pega', unidad: 'M2', insumos: [
        { idInsumo: 'i1', cantidad: 0.25 }, { idInsumo: 'i2', cantidad: 0.03 }, { idInsumo: 'i3', cantidad: 0.6 }] }],
    insumos: [
      { id: 'i1', codigo: 'CEM', nombre: 'Cemento gris 50 kg', unidad: 'BULTO', categoria: 'Materiales', precio: 32500 },
      { id: 'i2', codigo: 'ARE', nombre: 'Arena de pega', unidad: 'M3', categoria: 'Materiales', precio: 85000 },
      { id: 'i3', codigo: 'OFI', nombre: 'Oficial de construcción', unidad: 'HORA', categoria: 'Mano de Obra', precio: 15000 },
      { id: 'i4', codigo: 'MEZ', nombre: 'Mezcladora de 1 bulto', unidad: 'HORA', categoria: 'Equipos', precio: 9500.5 }],
    aiu: { a: 10, i: 2, u: 5 }, iva: { tarifa: 19, base: 'utilidad' },
  };
}

m.seccion('Cálculo contra el ejemplo hecho a mano');
{
  const p = ejemplo();
  // APU-1 = 7×32.500 + 0,55×85.000 + 8×15.000 + 0,5×9.500,5 = 227.500 + 46.750 + 120.000 + 4.750,25 = 399.000,25
  // APU-2 = 0,25×32.500 + 0,03×85.000 + 0,6×15.000 = 8.125 + 2.550 + 9.000 = 19.675
  m.ok(Math.abs(Calculo.unitarioAPU(p, 'p1') - 399000.25) < 1e-6, 'Unitario del APU-1 = 399.000,25');
  m.ok(Math.abs(Calculo.unitarioAPU(p, 'p2') - 19675) < 1e-6, 'Unitario del APU-2 = 19.675');
  m.ok(Math.abs(Calculo.unitarioActividad(p, p.capitulos[1].subs[0].acts[0]) - 418675.25) < 1e-6, 'Una actividad con dos APU suma sus unitarios (418.675,25)');
  // 12,5×399.000,25 + 140×19.675 + 3×418.675,25 = 4.987.503,125 + 2.754.500 + 1.256.025,75 = 8.998.028,875
  m.ok(Math.abs(Calculo.costoDirecto(p) - 8998028.875) < 1e-6, 'Costo directo sin redondear = 8.998.028,875');
  const t = Calculo.totales(p);
  m.ok(t.costoDirecto === 8998029, 'Costo directo en pesos enteros = 8.998.029');
  m.ok(t.a === 899803 && t.i === 179961 && t.u === 449901, 'A 10 % = 899.803 · I 2 % = 179.961 · U 5 % = 449.901');
  m.ok(t.subtotal === 10527694, 'Subtotal = 10.527.694');
  m.ok(t.iva === 85481 && t.total === 10613175, 'IVA del 19 % sobre la utilidad = 85.481 y total = 10.613.175');
  m.ok(t.total === t.costoDirecto + t.a + t.i + t.u + t.iva, 'El total es la suma de los componentes impresos');
  p.iva.base = 'total'; Calculo.invalidar(p);
  m.ok(Calculo.totales(p).iva === 2000262, 'IVA sobre el total = 2.000.262');
  p.iva.base = 'ninguno'; Calculo.invalidar(p);
  m.ok(Calculo.totales(p).iva === 0 && Calculo.totales(p).total === 10527694, 'Sin IVA, el total es el subtotal');
  const q = Calculo.cantidadesInsumo(p);
  // Cemento: 7×12,5 + 0,25×140 + (7 + 0,25)×3 = 87,5 + 35 + 21,75 = 144,25 bultos
  m.ok(Math.abs(q.get('i1') - 144.25) < 1e-9, 'Cantidad total de cemento = 144,25 bultos');
  const pc = Calculo.porCategoria(p);
  m.ok(Math.abs(Object.values(pc).reduce((a, b) => a + b, 0) - 8998028.875) < 1e-6, 'Las categorías de insumo suman el costo directo');
  const par = Calculo.pareto(p);
  // a1 = 55,4 % del costo directo, a2 = 30,6 %: con las dos se pasa del 80 % y a3 queda fuera.
  m.ok(par.has('a1') && par.has('a2') && !par.has('a3'), 'Pareto: las actividades que suman el 80 % del valor (a1 y a2, no a3)');
  m.ok(Calculo.exigenApu(p, 'todas').size === 3 && Calculo.exigenApu(p, 'manual').size === 0, 'Política de APU: todas o solo las marcadas');
}

m.seccion('NIT, festivos y días hábiles');
{
  m.ok(Nit.digitoVerificacion('890903938') === 8, 'DV de 890.903.938 = 8');
  m.ok(Nit.digitoVerificacion('800197268') === 4, 'DV de 800.197.268 = 4');
  m.ok(Nit.digitoVerificacion('860002964') === 4, 'DV de 860.002.964 = 4');
  m.ok(Nit.valido('890.903.938', '8') && !Nit.valido('890903938', '7'), 'Valida el NIT con puntos y rechaza un DV errado');
  m.ok(Nit.formatear('890903938', 8) === '890.903.938-8', 'Formato 890.903.938-8');
  const f2026 = Festivos.delAnio(2026).map((x) => x.fecha);
  const esperados = ['2026-01-01', '2026-01-12', '2026-03-23', '2026-04-02', '2026-04-03', '2026-05-01', '2026-05-18', '2026-06-08', '2026-06-15',
    '2026-06-29', '2026-07-20', '2026-08-07', '2026-08-17', '2026-10-12', '2026-11-02', '2026-11-16', '2026-12-08', '2026-12-25'];
  m.ok(igual(f2026, esperados), 'Los 18 festivos de Colombia en 2026 (Ley 51 de 1983 y Pascua del 5 de abril)');
  m.ok(Festivos.pascua(2027).getMonth() === 2 && Festivos.pascua(2027).getDate() === 28, 'Pascua de 2027: 28 de marzo');
  m.ok(Festivos.sumarDias('2026-03-20', 1, true) === '2026-03-24', '1 día hábil después del viernes 20 de marzo de 2026 es el martes 24 (el 23 es San José)');
  // 31 de marzo, 1, 6, 7 y 8 de abril: el 2 y el 3 son Jueves y Viernes Santo.
  m.ok(Festivos.sumarDias('2026-03-30', 5, true) === '2026-04-08', '5 hábiles desde el lunes 30 de marzo saltan la Semana Santa: miércoles 8 de abril');
  m.ok(Festivos.diasEntre('2026-03-30', '2026-04-08', true) === 5, 'Días hábiles entre dos fechas = 5');
  m.ok(Festivos.sumarDias('2026-12-30', 3, false) === '2027-01-02', 'Días calendario cruzan el año');
}

m.seccion('Nombres de archivo y código de invitación');
{
  m.ok(Util.razonSocialArchivo('Construcciones Ñandú & Cía. S.A.S.') === 'CONSTRUCCIONES-NANDU-CIA-S-A-S', 'Razón social sin tildes ni símbolos');
  m.ok(Util.razonSocialArchivo('A'.repeat(60)).length === 40, 'Razón social recortada a 40 caracteres');
  m.ok(Util.codigoArchivo('lic 2026/014') === 'LIC-2026-014', 'Código del proceso para archivo');
  m.ok(ExcelArken.nombreArchivo('LIC-2026-014') === 'ARKEN_ANALYTICA_LIC-2026-014_base_presupuesto.xlsx', 'Nombre del Excel del presupuesto base');
  const codigos = new Set(Array.from({ length: 2000 }, () => Util.codigoInvitacion()));
  m.ok(codigos.size === 2000, '2.000 códigos de invitación sin repetirse');
  m.ok([...codigos].every((c) => /^[ACDEFGHJKMNPQRTUVWXY34679]{12}$/.test(c) && Util.codigoInvitacionValido(c)), 'Códigos de 12 caracteres sin ambigüedad (sin 0/O, 1/I/L, 2/Z, 5/S, 8/B)');
  m.ok(Util.esc('<img src=x onerror=alert(1)>') === '&lt;img src=x onerror=alert(1)&gt;', 'esc() escapa HTML');
  m.ok(Util.enlaceSeguro('javascript:alert(1)') === '' && Util.enlaceSeguro('https://nube.ejemplo/a') !== '', 'Solo enlaces http y https');
}

m.seccion('Las funciones de lectura de ARKEN CONTROL son copia fiel');
{
  const fuente = readFileSync(join(RAIZ, 'analytica/fuente/nucleo/30-excel-arken.js'), 'utf8');
  const arken = readFileSync(join(RAIZ, 'programa/ARKEN_CONTROL.html'), 'utf8').split('\n').map((l) => l.trim());
  const copia = fuente.split('Copia fiel de ARKEN CONTROL: inicio')[1].split('Copia fiel de ARKEN CONTROL: fin')[0].split('\n').slice(1, -1);
  const segmentos = [];
  copia.forEach((l) => { if (/^(function |const COLS_)/.test(l) || !segmentos.length) segmentos.push([]); segmentos[segmentos.length - 1].push(l.trim()); });
  for (const seg of segmentos) {
    const lineas = seg.filter((l, i) => l !== '' || i < seg.length - 1);
    while (lineas.length && lineas[lineas.length - 1] === '') lineas.pop();
    const inicio = arken.findIndex((l, i) => l === lineas[0] && lineas.every((x, k) => arken[i + k] === x));
    m.ok(inicio >= 0, `${lineas[0].slice(0, 60)}… es idéntica a la de ARKEN_CONTROL.html (${lineas.length} líneas${inicio >= 0 ? ', desde la ' + (inicio + 1) : ''})`);
  }
}

m.seccion('Excel para ARKEN CONTROL, leído con el validador de ARKEN');
{
  const p = ejemplo();
  p.apus.push({ id: 'p9', codigo: 'APU-9', nombre: 'APU sin usar', unidad: 'UN', insumos: [{ idInsumo: 'i9', cantidad: 1 }] });
  p.insumos.push({ id: 'i9', codigo: 'CEM', nombre: 'Insumo sin usar con código repetido', unidad: 'UN', categoria: 'Ferretería', precio: 1 });
  const wb = ExcelArken.libro(ExcelArken.hojasPresupuesto(p, { proceso: 'LIC-1', versionPliego: 1 }), 'Empresa de prueba', 'usuario con apu y actividad en el nombre');
  const leido = XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
  m.ok(igual(leido.SheetNames, ['Instrucciones', 'Insumos', 'APU', 'Actividades', 'Resumen']), 'Hojas: Instrucciones, Insumos, APU, Actividades y Resumen');
  const r = ExcelArken.revisar(leido);
  m.ok(r.errores.length === 0, 'El validador de ARKEN no encuentra errores' + (r.errores.length ? ': ' + r.errores.slice(0, 3).join(' | ') : ''));
  m.ok(igual(r.conteo, { capitulos: 2, subcapitulos: 2, actividades: 3, apus: 2, insumos: 4 }), 'Solo van los APU e insumos usados (como exporta ARKEN): 2 capítulos, 3 actividades, 2 APU, 4 insumos');
  const vuelta = ExcelArken.aplicarPlan({ capitulos: [], apus: [], insumos: [], aiu: { a: 0, i: 0, u: 0 } }, r.plan, { modo: 'reemplazar' });
  m.ok(Calculo.totales(vuelta).costoDirecto === 8998029, 'Ida y vuelta: el costo directo sigue en 8.998.029');
  const res = ExcelArken.leerResumen(leido);
  m.ok(res && igual(res.aiu, { a: 10, i: 2, u: 5 }) && res.iva.base === 'utilidad', 'La hoja Resumen devuelve el AIU y el IVA');
  const demo = Object.assign({ id: 'x' }, Demo.presupuesto());
  const rd = ExcelArken.revisar(XLSX.read(XLSX.write(ExcelArken.libro(ExcelArken.hojasPresupuesto(demo, {}), 'E', 'u'), { type: 'array', bookType: 'xlsx' }), { type: 'array' }));
  const vd = ExcelArken.aplicarPlan({ capitulos: [], apus: [], insumos: [] }, rd.plan);
  let maxDif = 0;
  Calculo.recorrerActividades(demo, (a, s, c) => {
    const b = vd.capitulos.find((x) => x.codigo === c.codigo).subs.find((x) => x.codigo === s.codigo).acts.find((x) => x.codigo === a.codigo);
    maxDif = Math.max(maxDif, Math.abs(Calculo.valorActividad(demo, a) - Calculo.valorActividad(vd, b)));
  });
  m.ok(rd.errores.length === 0 && maxDif <= 1, `Demostración completa (22 actividades): sin errores y diferencia máxima por actividad de ${maxDif.toFixed(4)} pesos`);
}

m.seccion('Excel de ARKEN PRECIOS');
{
  const ws = XLSX.utils.aoa_to_sheet([['ARKEN PRECIOS · Lista para ARKEN'], [], ['Categoría', 'Unidad', 'Descripción del insumo', 'Precio unitario (con IVA incluido)'],
    ['Materiales', 'BULTO', 'Cemento gris 50 kg', 33900.5], ['Mano de Obra', 'HORA', 'Oficial de construcción', 15000], ['Inventada', 'UN', 'Clavo 2"', 120], ['Materiales', 'M3', 'Grava', 'no es número'], ['', '', '', '']]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Precios');
  const r = ExcelPrecios.leer(wb);
  m.ok(r.errores.length === 0 && r.filas.length === 3, 'Encabezado en la fila con «Categoría» y tres filas válidas');
  m.ok(r.filas[2].categoria === 'Materiales' && r.avisos.length === 2, 'Categoría desconocida pasa a Materiales y el precio inválido se avisa');
  const cmp = ExcelPrecios.compararConBase(r.filas, [{ nombre: 'CEMENTO GRIS 50 KG', precio: 32500 }, { nombre: 'Oficial de construcción', precio: 15000 }]);
  m.ok(cmp.cambios.length === 1 && cmp.nuevos.length === 1 && cmp.iguales.length === 1, 'Vista previa: un cambio, un nuevo, uno igual (por descripción normalizada)');
}

m.seccion('Condiciones de la oferta: plantilla del Anexo B');
{
  const L = PlantillaCondiciones.anexoB();
  m.ok(PlantillaCondiciones.puntosPonderables(L) === 1000, 'Los ponderables suman 1.000 puntos');
  m.ok(PlantillaCondiciones.problemas(L, 1000).length === 0, 'Sin problemas: todo requisito con evaluador y regla');
  m.ok(new Set(L.map((x) => x.codigo)).size === L.length, 'Códigos únicos');
  m.ok(L.filter((x) => x.grupo === 'Económico').every((x) => x.evaluador === 'Evaluador financiero'), 'El grupo Económico lo evalúa el evaluador financiero');
  const menos = L.map((x) => (x.codigo === 'SG-05' ? Object.assign({}, x, { activo: false }) : x));
  m.ok(PlantillaCondiciones.problemas(menos, 1000).some((x) => /suman 980/.test(x.msg)), 'Si se desactiva un ponderable, el programa avisa que no suman 1.000');
}

m.seccion('Acuerdo de confidencialidad');
{
  const proceso = { codigo: 'LIC-9', nombre: 'Obra de prueba', objeto: 'Construir', ciudad: 'Medellín', presupuestoOficialVisible: false };
  const empresa = Object.assign({}, Demo.EMPRESA, { dv: Nit.digitoVerificacion(Demo.EMPRESA.nit) });
  const config = Confidencialidad.configPorDefecto();
  const ctx = { proceso, empresa, config, smmlv: 1750905, presupuestoOficial: 969008207 };
  m.ok(Confidencialidad.faltantes(ctx).length === 0, 'Con los datos de la empresa no falta ningún valor');
  const texto = Confidencialidad.textoParaAprobar(ctx);
  m.ok(texto.indexOf('[razón social del invitado]') >= 0, 'El texto que aprueba el abogado deja los datos del invitado como marcadores');
  m.ok(!/19[.,]380[.,]164|DIECINUEVE MILLONES/.test(texto), 'Con el presupuesto oculto, la cláusula penal no dice el valor en pesos (no revela el total)');
  m.ok(Confidencialidad.estado(ctx) === 'borrador', 'Sin aprobación, el acuerdo está en borrador');
  config.aprobacion = { nombre: 'Abogada de prueba', tarjetaProfesional: '000000', fecha: '2026-10-18', texto };
  m.ok(Confidencialidad.estado(ctx) === 'aprobado', 'Con la aprobación sobre el texto vigente queda aprobado');
  config.duracionAnios = 3;
  m.ok(Confidencialidad.estado(ctx) === 'borrador', 'Cambiar la duración vuelve el acuerdo a borrador');
  config.duracionAnios = 5;
  config.textos = { firma: 'El Acuerdo se perfecciona con la firma de las partes.' };
  m.ok(Confidencialidad.estado(ctx) === 'borrador', 'Editar una cláusula vuelve el acuerdo a borrador');
  delete config.textos.firma;
  m.ok(Confidencialidad.estado(ctx) === 'aprobado', 'Volver al texto aprobado lo deja aprobado otra vez');
  m.ok(/VEINTIÚN \(21\) años/.test(Confidencialidad.armar(Object.assign({}, ctx, { config: Object.assign({}, config, { duracionAnios: 21 }) })).map((c) => c.segmentos.map((s) => s.valor || '').join('')).join('')), '«VEINTIÚN (21) años» con apócope');
  const pen = Confidencialidad.revisarPenal({ penal: { modo: 'porcentaje', valor: 2 } }, 1750905, 969008207);
  m.ok(pen.nivel === 'ok' && pen.valor === 19380164 && pen.sugerido.desde === 9690082, 'Penal del 2 %: 19.380.164 pesos, dentro del rango sugerido (1 % a 5 %)');
  m.ok(Confidencialidad.revisarPenal({ penal: { modo: 'porcentaje', valor: 12 } }, 1750905, 969008207).nivel === 'warn', 'Por encima del 10 % advierte (artículo 1601 del Código Civil)');
  m.ok(Confidencialidad.revisarPenal({ penal: { modo: 'smmlv', valor: 100 } }, 1750905, 969008207).valor === 175090500, 'Penal en SMMLV: 100 × 1.750.905');
  m.ok(Confidencialidad.advertenciaPais('Perú') !== '' && Confidencialidad.advertenciaPais('Colombia') === '', 'Advierte cuando el invitado es de otro país');
}

m.seccion('Parámetros: SMMLV');
{
  const P = Parametros.iniciales();
  m.ok(Parametros.smmlv(P, 2026) === 1750905 && Parametros.smmlv(P, 2025) === 1423500, 'SMMLV 2026 = 1.750.905 y 2025 = 1.423.500');
  m.ok(P.filter((x) => x.clave === 'smmlv' && x.anio < 2010).every((x) => x.porVerificar), '2000 a 2009 quedan marcados por verificar');
  m.ok(Math.abs(Parametros.enSmmlv(P, 1300000000, 2024, 50) - 500) < 1e-9, 'Experiencia: 1.300 millones de 2024 al 50 % = 500 SMMLV');
}

m.seccion('Cronograma y revisión antes de emitir');
{
  const c = Cronograma.proponer(Cronograma.nuevo(), '2026-03-30');
  m.ok(Cronograma.hito(c, 'cierre').fecha === Festivos.sumarDias('2026-03-30', 15, true) && Cronograma.validar(c).filter((x) => !x.aviso).length === 0, 'Cronograma propuesto en días hábiles, completo y en orden');
  const malo = Util.copia(c); Cronograma.hito(malo, 'cierre').fecha = Cronograma.hito(malo, 'adendas').fecha;
  m.ok(Cronograma.validar(malo).some((x) => /adendas y el cierre/.test(x.msg)), 'Avisa si entre adendas y cierre no hay tres días hábiles');
  m.ok(Cronograma.instante({ fecha: '2026-04-15', hora: '15:00' }) === '2026-04-15T15:00:00-05:00', 'Hora de Colombia, UTC−05:00');
  const pres = Object.assign({ id: 'p@1' }, Demo.presupuesto());
  const base = { proceso: { puntajeTotal: 1000, cronograma: c }, presupuesto: pres, requisitos: PlantillaCondiciones.anexoB(),
    documentos: [{ nombre: 'Planos.pdf', sha256: 'a'.repeat(64) }], invitados: Demo.invitados('p'), estadoConfidencialidad: 'aprobado',
    llaves: { publicaFirma: {}, publicaCifrado: {}, respaldo: { descargado: true, confirmado: true } }, pliego: { generado: true, revisado: true } };
  m.ok(Revision.listo(Revision.revisar(base)), 'Con todo completo, la revisión queda en verde');
  const sinAbogado = Revision.revisar(Object.assign({}, base, { estadoConfidencialidad: 'borrador' }));
  m.ok(!Revision.listo(sinAbogado) && sinAbogado.some((x) => !x.ok && /abogado/.test(x.texto)), 'Sin el acuerdo aprobado por abogado no se puede emitir (criterio 12)');
  const sinRespaldo = Revision.revisar(Object.assign({}, base, { llaves: { publicaFirma: {}, publicaCifrado: {}, respaldo: { descargado: false, confirmado: false } } }));
  m.ok(!Revision.listo(sinRespaldo) && sinRespaldo.some((x) => !x.ok && /Respaldo de llaves/.test(x.texto)), 'Sin el respaldo de llaves descargado no se puede emitir (criterio 12)');
  m.ok(Revision.revisar(base).length === 17, 'La revisión tiene los 17 puntos de §12.4');
}

m.seccion('El pliego no lleva precios del presupuesto base (criterio 2)');
{
  const pres = Object.assign({ id: 'p@1' }, Demo.presupuesto());
  const proceso = { codigo: 'DEMO-1', nombre: 'Prueba', cronograma: Cronograma.proponer(Cronograma.nuevo(), '2026-11-02'), general: Pliego.generalPorDefecto(), politicaApu: 'pareto', presupuestoOficialVisible: false, confidencialidad: Confidencialidad.configPorDefecto() };
  const ctx = { proceso, empresa: Demo.EMPRESA, presupuesto: pres, requisitos: PlantillaCondiciones.anexoB(), documentos: [], versionPliego: 1 };
  const texto = JSON.stringify(Pliego.bloques(ctx));
  const precios = pres.insumos.map((i) => Util.money3(i.precio).replace(/\s/g, ' '));
  const t = Calculo.totales(pres);
  const sensibles = [t.total, t.costoDirecto, t.aiu, t.iva].map(Util.money).concat(precios);
  const fugas = sensibles.filter((s) => texto.replace(/\s/g, ' ').indexOf(s.replace(/\s/g, ' ')) >= 0);
  m.ok(fugas.length === 0, 'Ningún precio de insumo, unitario, AIU, IVA ni total aparece en el pliego' + (fugas.length ? ': ' + fugas.slice(0, 3).join(', ') : ''));
  const actividades = new Set(); Calculo.recorrerActividades(pres, (a) => actividades.add(a.nombre));
  // Un insumo «todo costo» puede llamarse igual que su actividad: esa descripción sí va en el formulario.
  const sinNombres = pres.insumos.filter((i) => !actividades.has(i.nombre) && texto.indexOf(i.nombre) >= 0);
  m.ok(sinNombres.length === 0, 'Tampoco los insumos ni sus descripciones (el APU es del proponente)');
  m.ok(!/APU-0\d\d/.test(texto), 'Ni los códigos de los APU del presupuesto base');
  proceso.presupuestoOficialVisible = true;
  m.ok(JSON.stringify(Pliego.bloques(ctx)).indexOf(Util.money(t.total)) >= 0, 'Si el proceso lo permite, el pliego dice el valor total, y solo el total');
  const f = Pliego.formularioCantidades(pres, 'pareto');
  m.ok(f.filter((x) => x.tipo === 'act').length === 22 && f.every((x) => x.celdas.length === 5), 'Formulario de cantidades: 22 actividades con código, descripción, unidad, cantidad y si el APU es obligatorio');
  const h1 = Pliego.huellaContenido(Pliego.bloques(ctx));
  pres.capitulos[0].subs[0].acts[0].cantidad += 1; N.Calculo.invalidar(pres);
  m.ok(Pliego.huellaContenido(Pliego.bloques(ctx)) !== h1, 'La huella del contenido cambia si cambia una cantidad (el pliego generado deja de estar vigente)');
}

m.seccion('Demostración');
{
  const inv = Demo.invitados('p');
  m.ok(inv.length === 5 && inv.every((i) => /^DEMO /.test(i.razonSocial) && /^9991/.test(i.nit) && /\.demo\.invalid$/.test(i.contacto.correo) && i.demo), 'Cinco invitados ficticios: nombre DEMO, NIT de la serie 999 y correo .invalid');
  m.ok(/^DEMO /.test(Demo.EMPRESA.razonSocial) && Demo.EMPRESA.nit === '999000001', 'La empresa de demostración también es ficticia');
}

m.terminar();
