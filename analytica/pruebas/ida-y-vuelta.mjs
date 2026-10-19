// ARKEN ANALYTICA · ida y vuelta con el ARKEN CONTROL real (§4.2 y §25, criterio 1).
//
// Ida y vuelta:
//   1. ANALYTICA: demostración (22 actividades, 20 APU, 35 insumos) y «Exportar para ARKEN
//      CONTROL» con su validador.
//   2. ARKEN CONTROL (programa/ARKEN_CONTROL.html): proyecto nuevo en blanco, módulo 03 ›
//      Importar desde Excel, sin editar el archivo. Se comparan capítulos, subcapítulos,
//      actividades, cantidades, APU, insumos, precios y costo directo.
//   3. ARKEN exporta el presupuesto con «Excel editable» (exportarPresupuestoImportable) y
//      ANALYTICA lo importa en un proceso nuevo: todo igual al original, con tolerancia de un
//      peso por actividad.
// Al revés:
//   4. La plantilla de ejemplo de ARKEN entra en ANALYTICA; ANALYTICA la exporta y ARKEN la
//      importa en otro proyecto. Se compara con la plantilla importada directamente en ARKEN.
//
// Uso: npm run prueba:ida-y-vuelta

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RUTA_ANALYTICA, RUTA_ARKEN, servidor, navegador, contexto, vigilarErrores, abrirAnalytica, ingresar, irA, botonModal,
  abrirArken, ingresarArken, marcador, XLSX,
} from './comun.mjs';

const m = marcador('Ida y vuelta con ARKEN CONTROL');
const carpeta = mkdtempSync(join(tmpdir(), 'arken-analytica-'));
const srv = await servidor();
const nav = await navegador();
const normaliza = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();

/* ── Fotografía comparable de un presupuesto: por código de actividad y por nombre ── */
const fotoAnalytica = (pagina) => pagina.evaluate(() => {
  const pres = Modelo.presupuesto(Sesion.procesoActivo);
  const acts = [];
  Calculo.recorrerActividades(pres, (a, s, c) => acts.push({ cap: c.codigo + ' ' + c.nombre, sub: s.codigo + ' ' + s.nombre, codigo: a.codigo, nombre: a.nombre, unidad: a.unidad,
    cantidad: Number(a.cantidad), unitario: Calculo.unitarioActividad(pres, a), valor: Calculo.valorActividad(pres, a),
    apus: (a.apus || []).map((id) => { const x = Calculo.apu(pres, id); return x.nombre; }) }));
  const usados = new Set(); pres.apus.forEach((ap) => ap.insumos.forEach((l) => usados.add(l.idInsumo)));
  return { acts, costoDirecto: Calculo.costoDirecto(pres),
    apus: pres.apus.map((ap) => ({ nombre: ap.nombre, unidad: ap.unidad, lineas: ap.insumos.map((l) => { const i = Calculo.insumo(pres, l.idInsumo); return i.nombre + '×' + Number(l.cantidad); }).sort() })),
    insumos: pres.insumos.filter((i) => usados.has(i.id)).map((i) => ({ nombre: i.nombre, unidad: i.unidad, categoria: i.categoria, precio: Number(i.precio) })) };
});
const fotoArken = (pagina, id) => pagina.evaluate((idp) => {
  const p = S.proyectos.find((x) => x.id === (idp || Sesion.proyectoActivo));
  const acts = [];
  (p.capitulos || []).forEach((c) => (c.subs || []).forEach((s) => (s.acts || []).forEach((a) => acts.push({ cap: c.codigo + ' ' + c.nombre, sub: s.codigo + ' ' + s.nombre,
    codigo: a.codigo, nombre: a.nombre, unidad: a.unidad, cantidad: Number(a.cantidad), unitario: Calculo.unitarioActividad(p, a),
    apus: (a.apus || []).map((x) => Modelo.apu(p, x).nombre) }))));
  const usadosApu = new Set(); acts.length; (p.capitulos || []).forEach((c) => c.subs.forEach((s) => s.acts.forEach((a) => (a.apus || []).forEach((x) => usadosApu.add(x)))));
  const apus = p.apus.filter((ap) => usadosApu.has(ap.id));
  const usadosIns = new Set(); apus.forEach((ap) => ap.insumos.forEach((l) => usadosIns.add(l.idInsumo)));
  return { acts, costoDirecto: Calculo.costoDirecto(p),
    apus: apus.map((ap) => ({ nombre: ap.nombre, unidad: ap.unidad, lineas: ap.insumos.map((l) => Modelo.insumo(p, l.idInsumo).nombre + '×' + Number(l.cantidad)).sort() })),
    insumos: p.insumos.filter((i) => usadosIns.has(i.id)).map((i) => ({ nombre: i.nombre, unidad: i.unidad, categoria: i.categoria, precio: Number(i.precio) })) };
}, id);

/** Compara dos fotografías; devuelve la lista de diferencias (vacía si son iguales). */
function comparar(a, b) {
  const dif = [];
  if (a.acts.length !== b.acts.length) dif.push(`actividades: ${a.acts.length} contra ${b.acts.length}`);
  const porCodigo = new Map(b.acts.map((x) => [x.codigo, x]));
  let maxPeso = 0;
  for (const x of a.acts) {
    const y = porCodigo.get(x.codigo);
    if (!y) { dif.push('falta la actividad ' + x.codigo); continue; }
    if (normaliza(x.cap) !== normaliza(y.cap) || normaliza(x.sub) !== normaliza(y.sub)) dif.push(`${x.codigo}: capítulo o subcapítulo distinto (${x.sub} / ${y.sub})`);
    if (normaliza(x.nombre) !== normaliza(y.nombre) || normaliza(x.unidad) !== normaliza(y.unidad)) dif.push(`${x.codigo}: nombre o unidad distintos`);
    if (Math.abs(x.cantidad - y.cantidad) > 1e-9) dif.push(`${x.codigo}: cantidad ${x.cantidad} contra ${y.cantidad}`);
    if (JSON.stringify(x.apus.map(normaliza).sort()) !== JSON.stringify(y.apus.map(normaliza).sort())) dif.push(`${x.codigo}: APU distintos`);
    const dv = Math.abs(x.unitario * x.cantidad - y.unitario * y.cantidad);
    maxPeso = Math.max(maxPeso, dv);
    if (dv > 1) dif.push(`${x.codigo}: valor difiere en ${dv.toFixed(2)} pesos`);
  }
  const clave = (l) => l.map((x) => JSON.stringify(Object.assign({}, x, { nombre: normaliza(x.nombre), unidad: normaliza(x.unidad), precio: x.precio === undefined ? undefined : Math.round(x.precio * 1000) / 1000,
    lineas: x.lineas ? x.lineas.map(normaliza) : undefined }))).sort();
  const ia = clave(a.insumos), ib = clave(b.insumos);
  if (JSON.stringify(ia) !== JSON.stringify(ib)) dif.push('insumos distintos: ' + ia.filter((x) => !ib.includes(x)).slice(0, 2).join(' | '));
  const pa = clave(a.apus), pb = clave(b.apus);
  if (JSON.stringify(pa) !== JSON.stringify(pb)) dif.push('APU distintos: ' + pa.filter((x) => !pb.includes(x)).slice(0, 2).join(' | '));
  if (Math.abs(a.costoDirecto - b.costoDirecto) > Math.max(1, a.acts.length)) dif.push(`costo directo ${a.costoDirecto.toFixed(2)} contra ${b.costoDirecto.toFixed(2)}`);
  return { dif, maxPeso, cd: [a.costoDirecto, b.costoDirecto] };
}

/* ── Acciones por la interfaz ── */
async function exportarDeAnalytica(pagina, nombre) {
  await irA(pagina, '02');
  await pagina.click('[data-accion="exportar-arken"]');
  await pagina.waitForSelector('#btnGuardarXlsx');
  const conteo = await pagina.evaluate(() => Array.from(document.querySelectorAll('#modales .overlay:last-child .stat .val')).map((x) => Number(x.textContent)));
  const habilitado = await pagina.isEnabled('#btnGuardarXlsx');
  const [d] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#btnGuardarXlsx')]);
  const ruta = join(carpeta, nombre);
  await d.saveAs(ruta);
  await botonModal(pagina, 'Entendido');
  return { ruta, conteo, habilitado, sugerido: d.suggestedFilename() };
}
async function importarEnAnalytica(pagina, ruta) {
  await irA(pagina, '02');
  const [fc] = await Promise.all([pagina.waitForEvent('filechooser'), pagina.click('[data-accion="importar-arken"]')]);
  await fc.setFiles(ruta);
  await pagina.waitForSelector('#modales .overlay .modal-foot button:has-text("Importar")');
  const errores = await pagina.locator('#modales .nota.bad').count();
  await botonModal(pagina, 'Importar');
  await pagina.waitForFunction(() => !document.querySelector('#modales .overlay'), null, { timeout: 15000 });
  return { errores };
}
async function procesoNuevo(pagina, codigo) {
  await irA(pagina, '01');
  await pagina.click('[data-accion="nuevo-proceso"]');
  await pagina.fill('#pd_codigo', codigo);
  await pagina.fill('#pd_nombre', 'Prueba de ida y vuelta ' + codigo);
  await botonModal(pagina, 'Crear proceso');
  await pagina.waitForFunction((c) => { const p = Modelo.activo(); return p && p.codigo === c; }, codigo);
}
async function proyectoArken(pagina, nombre) {
  // Cierra el aviso que deja la importación anterior y vuelve a la lista de proyectos.
  await pagina.evaluate(() => { document.querySelectorAll('.overlay').forEach((o) => o.remove()); Sesion.tab00 = 'proyectos'; });
  await pagina.click('#railList .nav-item[data-m="00"]');
  await pagina.waitForSelector('#btnNuevoProy');
  await pagina.click('#btnNuevoProy');
  await pagina.fill('#f_nombre', nombre);
  await pagina.selectOption('#f_semilla', 'blanco');
  await pagina.click('.overlay:last-child .modal-foot .btn.primary');
  await pagina.waitForFunction((n) => { const p = S.proyectos.find((x) => x.id === Sesion.proyectoActivo); return p && p.nombre === n; }, nombre, { timeout: 15000 });
  return pagina.evaluate(() => Sesion.proyectoActivo);
}
async function importarEnArken(pagina, ruta) {
  await pagina.click('#railList .nav-item[data-m="03"]');
  await pagina.waitForSelector('#b3Imp', { timeout: 15000 });
  await pagina.click('#b3Imp');
  const [fc] = await Promise.all([pagina.waitForEvent('filechooser'), pagina.click('.overlay:last-child .modal-foot button:has-text("Seleccionar archivo")')]);
  await fc.setFiles(ruta);
  await pagina.waitForSelector('.overlay:last-child .modal-head h3');
  const titulo = await pagina.textContent('.overlay:last-child .modal-head h3');
  if (/error/i.test(titulo)) {
    const errores = await pagina.evaluate(() => Array.from(document.querySelectorAll('.overlay:last-child tbody tr')).map((tr) => tr.textContent).slice(0, 5));
    return { ok: false, titulo, errores };
  }
  const stats = await pagina.evaluate(() => Array.from(document.querySelectorAll('.overlay:last-child .stat .val')).map((x) => Number(x.textContent)));
  const caja = pagina.locator('.overlay:last-child #riActPrecio');
  if (await caja.count()) await caja.check();
  const cajaApu = pagina.locator('.overlay:last-child #riActApu');
  if (await cajaApu.count()) await cajaApu.check();
  await pagina.click('.overlay:last-child .modal-foot button:has-text("Importar")');
  await pagina.waitForFunction(() => { const p = S.proyectos.find((x) => x.id === Sesion.proyectoActivo); return p && p.capitulos.length > 0; }, null, { timeout: 15000 });
  return { ok: true, titulo, stats };
}
async function excelEditableDeArken(pagina, nombre) {
  const [d] = await Promise.all([pagina.waitForEvent('download'), pagina.evaluate(() => exportarPresupuestoImportable(S.proyectos.find((x) => x.id === Sesion.proyectoActivo)))]);
  const ruta = join(carpeta, nombre);
  await d.saveAs(ruta);
  return ruta;
}

try {
  /* ── 1. ANALYTICA ── */
  const ctxN = await contexto(nav);
  const pn = await ctxN.newPage();
  const erroresN = vigilarErrores(pn);
  await abrirAnalytica(pn, srv.url(RUTA_ANALYTICA));
  await ingresar(pn, 'admin', 'arken', 'prueba-ida-y-vuelta');
  await pn.click('[data-accion="cargar-demo"]');
  await pn.waitForFunction(() => Modelo.activo() && Modelo.activo().demo);
  const original = await fotoAnalytica(pn);
  m.ok(original.acts.length === 22, `ANALYTICA: demostración con ${original.acts.length} actividades, ${original.apus.length} APU y ${original.insumos.length} insumos`);
  const ida = await exportarDeAnalytica(pn, 'ida.xlsx');
  m.ok(ida.habilitado, `el validador previo no encuentra errores y deja guardar ${ida.sugerido}`);
  m.ok(JSON.stringify(ida.conteo) === JSON.stringify([8, 13, 22, original.apus.length, original.insumos.length]), `el validador anuncia lo que leerá ARKEN: ${ida.conteo.join(' · ')} (capítulos · subcapítulos · actividades · APU · insumos)`);
  const wb = XLSX.read(readFileSync(ida.ruta));
  m.ok(['Insumos', 'APU', 'Actividades'].every((h) => wb.SheetNames.includes(h)), `hojas del contrato: ${wb.SheetNames.join(', ')}`);

  /* ── 2. ARKEN CONTROL importa sin editar ── */
  const ctxA = await contexto(nav);
  const pa = await ctxA.newPage();
  const erroresA = vigilarErrores(pa);
  await abrirArken(pa, srv.url(RUTA_ARKEN));
  await ingresarArken(pa, 'admin', 'arken', 'prueba-ida-y-vuelta');
  await proyectoArken(pa, 'Desde ANALYTICA');
  const impA = await importarEnArken(pa, ida.ruta);
  m.ok(impA.ok, 'ARKEN CONTROL importa el Excel de ANALYTICA sin errores' + (impA.ok ? ` (${impA.stats.join(' · ')})` : ': ' + impA.titulo + ' ' + (impA.errores || []).join(' | ')));
  const enArken = await fotoArken(pa);
  const c1 = comparar(original, enArken);
  m.ok(c1.dif.length === 0, 'en ARKEN quedan los mismos capítulos, subcapítulos, actividades, cantidades, APU, insumos y precios' + (c1.dif.length ? ': ' + c1.dif.slice(0, 4).join(' | ') : ''));
  m.ok(Math.abs(c1.cd[0] - c1.cd[1]) <= 1, `costo directo igual: ANALYTICA ${c1.cd[0].toFixed(2)} · ARKEN ${c1.cd[1].toFixed(2)} (diferencia máxima por actividad ${c1.maxPeso.toFixed(4)} pesos)`);

  /* ── 3. ARKEN exporta «Excel editable» y ANALYTICA lo importa ── */
  const vuelta = await excelEditableDeArken(pa, 'vuelta.xlsx');
  await procesoNuevo(pn, 'VUELTA-001');
  const impN = await importarEnAnalytica(pn, vuelta);
  m.ok(impN.errores === 0, 'ANALYTICA importa el «Excel editable» de ARKEN sin errores');
  const deVuelta = await fotoAnalytica(pn);
  const c2 = comparar(original, deVuelta);
  m.ok(c2.dif.length === 0, 'de vuelta en ANALYTICA, todo igual al original' + (c2.dif.length ? ': ' + c2.dif.slice(0, 4).join(' | ') : ''));
  m.ok(Math.abs(c2.cd[0] - c2.cd[1]) <= 1, `costo directo igual al original (${c2.cd[1].toFixed(2)}), diferencia máxima por actividad ${c2.maxPeso.toFixed(4)} pesos`);

  /* ── 4. Al revés: la plantilla de ARKEN ── */
  const [dp] = await Promise.all([pa.waitForEvent('download'), pa.evaluate(() => plantillaEjemploPresupuesto())]);
  const plantilla = join(carpeta, 'plantilla.xlsx');
  await dp.saveAs(plantilla);
  const idDirecto = await proyectoArken(pa, 'Plantilla directa');
  const impDirecto = await importarEnArken(pa, plantilla);
  const directa = await fotoArken(pa, idDirecto);
  m.ok(impDirecto.ok && directa.acts.length > 0, `la plantilla de ARKEN, importada en ARKEN: ${directa.acts.length} actividades`);
  await procesoNuevo(pn, 'PLANTILLA-ARKEN');
  const impP = await importarEnAnalytica(pn, plantilla);
  const enN = await fotoAnalytica(pn);
  const c3 = comparar(directa, enN);
  m.ok(impP.errores === 0 && c3.dif.length === 0, 'ANALYTICA lee la plantilla de ARKEN igual que ARKEN' + (c3.dif.length ? ': ' + c3.dif.slice(0, 4).join(' | ') : ''));
  const vuelta2 = await exportarDeAnalytica(pn, 'plantilla-desde-analytica.xlsx');
  m.ok(vuelta2.habilitado, 'ANALYTICA la exporta sin errores');
  await proyectoArken(pa, 'Plantilla vía ANALYTICA');
  const impV = await importarEnArken(pa, vuelta2.ruta);
  const via = await fotoArken(pa);
  const c4 = comparar(directa, via);
  m.ok(impV.ok && c4.dif.length === 0, 'ARKEN la importa de nuevo y queda igual a la plantilla importada directamente' + (c4.dif.length ? ': ' + c4.dif.slice(0, 4).join(' | ') : ''));
  m.ok(Math.abs(c4.cd[0] - c4.cd[1]) <= 1, `costo directo de la plantilla: directo ${c4.cd[0].toFixed(2)} · vía ANALYTICA ${c4.cd[1].toFixed(2)}`);

  m.ok(erroresN.length === 0, 'ANALYTICA sin errores de JavaScript' + (erroresN.length ? ': ' + erroresN.slice(0, 3).join(' | ') : ''));
  m.ok(erroresA.length === 0, 'ARKEN CONTROL sin errores de JavaScript' + (erroresA.length ? ': ' + erroresA.slice(0, 3).join(' | ') : ''));
  m.ok(ctxN.peticionesExternas.length === 0, 'ANALYTICA no hizo ninguna petición a internet' + (ctxN.peticionesExternas.length ? ': ' + ctxN.peticionesExternas.slice(0, 3).join(' ') : ''));
} catch (e) {
  m.ok(false, 'la prueba se interrumpió: ' + e.message);
} finally {
  await nav.close();
  await srv.cerrar();
}
m.terminar();
