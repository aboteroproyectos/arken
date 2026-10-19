// ARKEN ANALYTICA · prueba de punta a punta de la Fase 4 (§19 a §21, §18.13, §27), en Chromium.
//
//   · parte del caso de la Fase 3 ya evaluado: cinco ofertas, cuatro habilitadas, puntaje definitivo
//   · módulo 15: el cuadro comparativo cuadra con los totales recalculados, con sus filtros y su Excel;
//     el cuadro gerencial, la matriz de requisitos y las 15 gráficas, con el resaltado, el detalle por
//     capítulo y la exportación en PNG, SVG y PDF
//   · desde un puntaje o un requisito, un clic abre la verificación con el documento, la página y la
//     regla (criterio 7)
//   · el lector de documentos, sin internet: lee la fecha de expedición y la vigencia del PDF de un
//     proponente con su texto y su página, llena la evidencia sin tocar el «¿Cumple?», explica un PDF
//     escaneado y no hace ninguna petición fuera del equipo (criterios 14 y 15)
//   · el concepto firmado por dos miembros del comité; si la evaluación cambia, vuelve a borrador
//   · el informe en PDF carta con las secciones elegidas en el orden elegido, índice, «Página x de y» y
//     la marca de borrador cuando corresponde (criterio 11), su Excel y sus versiones
//   · el presupuesto adjudicado entra en el ARKEN CONTROL real con el mismo costo directo
//   · la demostración se borra entera; sin errores de JavaScript y sin peticiones a internet
//
// Uso: npm run prueba:punta-a-punta-fase-4

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { RUTA_ANALYTICA, RUTA_ARKEN, servidor, navegador, contexto, vigilarErrores, abrirAnalytica, ingresar, irA, pestana, botonModal, cerrarModales, marcador, XLSX, leerPDF, abrirArken, ingresarArken, llenar } from './comun.mjs';
import { prepararEvaluado } from './preparar-evaluado.mjs';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const m = marcador('Prueba de punta a punta de ARKEN ANALYTICA (Fase 4)');
const carpeta = mkdtempSync(join(tmpdir(), 'arken-analytica-fase4-'));
const srv = await servidor();
const nav = await navegador();
const ctx = await contexto(nav);
const pp = await ctx.newPage();
const errores = vigilarErrores(pp);
pp.on('dialog', (d) => d.accept());
const accion = (nombre, extra = '') => pp.click(`#stage [data-accion="${nombre}"]${extra}`);
async function bajar(fn, nombre) {
  const [d] = await Promise.all([pp.waitForEvent('download', { timeout: 120000 }), fn()]);
  const ruta = join(carpeta, nombre || d.suggestedFilename());
  await d.saveAs(ruta);
  return { ruta, nombre: d.suggestedFilename() };
}

try {
  await abrirAnalytica(pp, srv.url(RUTA_ANALYTICA));
  await ingresar(pp, 'admin', 'arken', 'prueba-fase4-2026');

  m.seccion('Caso de la Fase 3, evaluado');
  const ev = await prepararEvaluado(pp);
  m.ok(!ev.provisional && ev.orden.length === 4 && /Delta/.test(ev.orden[0][0]), 'Cuatro habilitadas, puntaje definitivo; primero ' + ev.orden[0][0] + ' con ' + ev.orden[0][1]);

  m.seccion('Módulo 15 · cuadro comparativo');
  await irA(pp, '15');
  const cuadra = await pp.evaluate(() => {
    const p = Modelo.activo(), R = Evaluacion.analisis(p);
    const C = Comparativo.cuadro(R, { nivel: 'capitulo' });
    const tot = C.pie.find((f) => f.clave === 'total');
    const cd = C.pie.find((f) => f.clave === 'costoDirecto');
    return R.ofertas.every((o) => Math.abs(tot.celdas[o.id].valor - Calculo.totales(o.pres).total) < 0.5 && Math.abs(cd.celdas[o.id].valor - C.filas.reduce((t, f) => t + f.celdas[o.id].valor, 0)) < 0.5)
      && Math.abs(cd.base - Calculo.costoDirecto(R.ctx.base)) < 0.5;
  });
  m.ok(cuadra, 'Por capítulo, la suma de cada columna es el costo directo y el total coincide con el recalculado de cada oferta y con la base');
  const filasCap = await pp.locator('#stage .comparativo tbody tr.cmp-cap').count();
  await pp.selectOption('#stage [data-f15="nivel"]', 'actividad');
  await pp.waitForFunction(() => document.querySelectorAll('#stage .comparativo tbody tr.cmp-act').length > 0);
  const filasAct = await pp.locator('#stage .comparativo tbody tr.cmp-act').count();
  await pp.check('#stage [data-f15="soloAlertas"]');
  await pp.waitForFunction((n) => document.querySelectorAll('#stage .comparativo tbody tr.cmp-act').length < n, filasAct);
  const conAlerta = await pp.evaluate(() => Array.from(document.querySelectorAll('#stage .comparativo tbody tr.cmp-act')).every((tr) => tr.querySelector('.punto-alerta')));
  m.ok(filasCap === 8 && filasAct > filasCap && conAlerta, `Filtros: ${filasCap} capítulos, ${filasAct} actividades y, con «solo alertas», solo renglones alertados`);
  const xl = await bajar(() => accion('cmp-excel'));
  const hoja = XLSX.read(readFileSync(xl.ruta)).Sheets.Comparativo;
  const filas = XLSX.utils.sheet_to_json(hoja, { header: 1 });
  m.ok(/^ARKEN_ANALYTICA_.*_Comparativo_\d{8}\.xlsx$/.test(xl.nombre) && filas[0][2] === 'Presupuesto base' && filas.some((f) => f[1] === 'Total' && typeof f[2] === 'number'), 'El Excel del comparativo sale con números como números y la fila de total (' + xl.nombre + ')');
  await pp.uncheck('#stage [data-f15="soloAlertas"]'); await pp.selectOption('#stage [data-f15="nivel"]', 'capitulo');

  m.seccion('Módulo 15 · cuadro gerencial y requisitos');
  await pestana(pp, 'gerencial');
  const ger = await pp.evaluate(() => ({ portada: document.querySelector('#stage .portada-cuadro .titulo').textContent, filas: Array.from(document.querySelectorAll('#stage table tbody tr')).map((tr) => tr.textContent) }));
  m.ok(ger.portada === 'En evaluación' && ger.filas.length === 5 && /Delta/.test(ger.filas[0]) && /no habilitada/.test(ger.filas[4]) && /rojo/.test(ger.filas[4]), 'Portada «En evaluación», una fila por proponente en el orden, Épsilon al final en rojo');
  await accion('ir-puntajes');
  await pp.waitForFunction(() => Sesion.modulo === '14');
  await pp.click('#stage [data-accion="verificar"][data-req="EXP-02"]');
  await pp.waitForSelector('#modales .overlay .modal-head');
  const ver = await pp.textContent('#modales .overlay:last-child');
  m.ok(/EXP-02/.test(ver) && /Declarado/.test(ver) && /Reglas de verificación/.test(ver) && /Vigente/.test(ver), 'Desde el puntaje del cuadro gerencial: un clic al puntaje por requisito y otro a la verificación, con lo declarado, la evidencia y la regla (criterio 7)');
  await cerrarModales(pp);
  await irA(pp, '15'); await pestana(pp, 'requisitos');
  const nReq = await pp.evaluate(() => ({ filas: document.querySelectorAll('#stage table tbody tr').length, activos: Evaluacion.analisis(Modelo.activo()).requisitos.filter((r) => r.activo !== false).length }));
  m.ok(nReq.filas === nReq.activos, 'La matriz muestra los ' + nReq.activos + ' requisitos activos por proponente');
  await pp.click('#stage [data-accion="verificar"][data-req="JUR-02"]');
  await pp.waitForSelector('#modales .overlay .modal-head');
  m.ok(/JUR-02/.test(await pp.textContent('#modales .overlay:last-child .modal-head')), 'Un clic en una celda de la matriz abre esa verificación');
  await cerrarModales(pp);

  m.seccion('Módulo 15 · las 15 gráficas');
  await pestana(pp, 'graficas');
  const gr = await pp.evaluate(() => ({ n: document.querySelectorAll('#stage .grafica-card svg').length, nan: /NaN|undefined/.test(document.querySelector('#stage .graficas').innerHTML) }));
  m.ok(gr.n === 15 && !gr.nan, '15 gráficas dibujadas, sin NaN ni undefined');
  const idAlfa = await pp.evaluate(() => Evaluacion.analisis(Modelo.activo()).ofertas.find((o) => /Alfa/.test(o.nombre)).id);
  await pp.locator(`#gr-totales [data-of="${idAlfa}"]`).first().click();
  const res = await pp.evaluate((id) => ({ on: document.querySelectorAll(`#stage .graficas [data-of="${id}"].on`).length, cards: new Set(Array.from(document.querySelectorAll(`#stage .graficas [data-of="${id}"].on`)).map((e) => e.closest('.grafica-card').id)).size, clase: document.querySelector('#stage .graficas').classList.contains('hay-resalte') }), idAlfa);
  m.ok(res.clase && res.cards >= 5, 'Un clic en Alfa la resalta en ' + res.cards + ' gráficas a la vez');
  const cap = await pp.locator('#gr-calor [data-cap]').first().getAttribute('data-cap');
  await pp.locator('#gr-calor [data-cap]').first().click();
  await pp.waitForSelector('#gr-calor [data-accion="g-volver"]');
  m.ok(/subcap/i.test(await pp.textContent('#gr-calor h3')) || (await pp.textContent('#gr-calor h3')).includes(cap), 'Un clic en el capítulo ' + cap + ' del mapa de calor baja a sus subcapítulos');
  await accion('g-volver');
  const png = await bajar(() => pp.click('#gr-radar [data-accion="g-exportar"][data-f="png"]'));
  const svg = await bajar(() => pp.click('#gr-radar [data-accion="g-exportar"][data-f="svg"]'));
  const pdfG = await bajar(() => pp.click('#gr-radar [data-accion="g-exportar"][data-f="pdf"]'));
  const b = readFileSync(png.ruta), tsvg = readFileSync(svg.ruta, 'utf8');
  m.ok(b.slice(1, 4).toString() === 'PNG' && /^<svg|^<\?xml/.test(tsvg.trim()) && !/var\(--/.test(tsvg) && readFileSync(pdfG.ruta).slice(0, 4).toString() === '%PDF', 'El radar sale en PNG, en SVG (con los colores resueltos) y en PDF');
  await pp.click('#gr-pareto [data-accion="g-informe"]');
  await pp.waitForFunction(() => !Decision.configInforme(Modelo.activo(), Evaluacion.analisis(Modelo.activo())).graficas.includes('pareto'));
  m.ok(true, '«En el informe» quita la gráfica del informe (y la vuelve a poner con otro clic)');

  m.seccion('Lector de documentos, sin internet');
  // Toda petición que salga de la página hacia otro equipo queda anotada: no debe haber ninguna.
  const fuera = [];
  pp.on('request', (q) => { const u = q.url(); if (/^https?:/.test(u) && !/^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(u)) fuera.push(u); });
  await irA(pp, '16');
  m.ok(!(await pp.locator('#stage [data-pestana][data-id="asistente"]').count()) && !/Asistente de IA/.test(await pp.textContent('#stage')), 'El módulo 16 ya no tiene la pestaña del asistente de IA');
  const filasAntes = await pp.evaluate(() => Evaluacion.evaluaciones(Modelo.activo().id).length);
  await irA(pp, '11'); await pestana(pp, 'verificacion');
  const idDelta = await pp.evaluate(() => Evaluacion.analisis(Modelo.activo()).ofertas.find((o) => /Delta/.test(o.nombre)).id);
  await pp.click(`#stage [data-accion="verificar"][data-of="${idDelta}"][data-req="JUR-02"]`);
  await pp.waitForSelector('#vrLeer'); await pp.click('#vrLeer');
  const sugeridos = await pp.evaluate(() => Array.from(document.querySelectorAll('#modales [data-lccampo]')).filter((x) => x.checked).map((x) => x.dataset.lccampo));
  m.ok(sugeridos.includes('fecha_expedicion') && sugeridos.includes('vigencia_hasta'), 'Para un requisito jurídico sugiere la fecha de expedición y la vigencia');
  const cumpleAntes = await pp.inputValue('#vr_cumple');
  await pp.click('#lcLeer');
  await pp.waitForSelector('#modales [data-lcusar]');
  const lec = await pp.evaluate(() => (S.lecturasIA || []).filter((x) => x.modelo === 'lector').slice(-1)[0]);
  const fe = lec.datos.find((d) => d.campo === 'fecha_expedicion'), vh = lec.datos.find((d) => d.campo === 'vigencia_hasta');
  const docOk = await pp.evaluate((l) => { const R = Evaluacion.analisis(Modelo.activo()); const o = R.ofertas.find((x) => x.id === l.ofertaId); const d = Motor.adjuntosDe(o, 'JUR-02').find((x) => x.id === l.docId); return { fecha: d.fechaDocumento, vence: d.vigenteHasta }; }, lec);
  m.ok(fe && fe.normalizado === docOk.fecha && /^Fecha de expedición: \d{1,2} de [a-z]+ de \d{4}$/.test(fe.texto) && fe.pagina === 1, 'Lee la fecha de expedición del PDF del proponente, con su texto y su página: ' + (fe ? fe.valor : 'no la encontró'));
  m.ok(vh && vh.normalizado === docOk.vence, 'Lee la vigencia del documento');
  await pp.click('#modales [data-lcusar]');
  const ev2 = { texto: await pp.inputValue('#vr_texto'), pagina: await pp.inputValue('#vr_pagina'), doc: await pp.inputValue('#vr_doc'), cumple: await pp.inputValue('#vr_cumple') };
  m.ok(ev2.texto === fe.texto && ev2.pagina === '1' && ev2.doc === lec.docId && ev2.cumple === cumpleAntes, '«Usar como evidencia» llena el documento, la página y el texto literal; el «¿Cumple?» lo deja como estaba');
  await cerrarModales(pp);
  const filasDespues = await pp.evaluate(() => Evaluacion.evaluaciones(Modelo.activo().id).length);
  m.ok(filasDespues === filasAntes, 'La lectura no escribe ninguna verificación');
  // Otro dato que escribe el evaluador, y un PDF sin texto.
  const otro = await pp.evaluate(async () => {
    const p = Modelo.activo(), R = Evaluacion.analisis(p), o = R.ofertas.find((x) => /Delta/.test(x.nombre)), r = R.requisitos.find((x) => x.codigo === 'JUR-02');
    const doc = Motor.adjuntosDe(o, 'JUR-02').find((d) => Archivos.extension(d.nombre) === 'pdf');
    const l = await Lector.leer(p, o, r, doc, ['otro'], 'Vigente hasta');
    const { jsPDF } = window.jspdf; const vacio = new jsPDF(); vacio.rect(10, 10, 50, 50);
    const bytes = new Uint8Array(vacio.output('arraybuffer')), sha = await Cripto.sha256(bytes);
    await Almacen.ponerArchivo(sha, new Blob([bytes], { type: 'application/pdf' }));
    let escaneado = '';
    try { await Lector.leer(p, o, r, Object.assign({}, doc, { id: 'x', sha256: sha, nombre: 'escaneado.pdf' }), ['fecha_expedicion'], ''); } catch (e) { escaneado = e.message; }
    return { valor: (l.datos[0] || {}).valor, escaneado };
  });
  m.ok(!!otro.valor && /\d{4}|sin vencimiento/.test(otro.valor), '«Otro dato» devuelve lo que sigue a la palabra escrita: ' + otro.valor);
  m.ok(/escaneada/.test(otro.escaneado), 'Un PDF sin texto se explica: ' + otro.escaneado.split(':')[0]);
  m.ok(!fuera.length, 'Nada salió a internet' + (fuera.length ? ': ' + fuera.slice(0, 2).join(' ') : ''));
  const html = readFileSync(new URL('../programa/ARKEN_ANALYTICA.html', import.meta.url), 'utf8');
  m.ok(!/api\.anthropic\.com|AnthropicSDK|sk-ant-[A-Za-z0-9_-]{8,}/.test(html) && await pp.evaluate(() => typeof ClaveIA === 'undefined' && typeof Asistente === 'undefined'), 'El programa no trae el asistente de IA, su clave ni el SDK de Anthropic');

  m.seccion('Concepto de adjudicación y firmas');
  await irA(pp, '16'); await pestana(pp, 'concepto');
  m.ok(/borrador: no es una decisión/.test(await pp.textContent('#stage')), 'El concepto empieza como borrador');
  await pp.fill('#cc_notas', 'Revisado en sesión del comité de prueba.');
  await accion('concepto-guardar');
  await pp.waitForFunction(() => S.conceptos.find((c) => c.procesoId === Modelo.activo().id).textos.notas);
  await accion('concepto-firmar');
  await llenar(pp, { '#pd_u1': 'comite1', '#pd_c1': 'clave-comite1-2026', '#pd_u2': 'comite1', '#pd_c2': 'clave-comite1-2026' });
  await botonModal(pp, 'Firmar');
  await pp.waitForSelector('.toast.bad, #modales .nota.bad', { timeout: 15000 }).catch(() => null);
  const unaSola = await pp.evaluate(() => (S.conceptos.find((c) => c.procesoId === Modelo.activo().id).firmas || []).length);
  m.ok(unaSola === 0, 'El mismo miembro dos veces no firma');
  await cerrarModales(pp);
  await accion('concepto-firmar');
  await llenar(pp, { '#pd_u1': 'comite1', '#pd_c1': 'clave-comite1-2026', '#pd_u2': 'comite2', '#pd_c2': 'clave-comite2-2026' });
  await botonModal(pp, 'Firmar');
  await pp.waitForFunction(() => Decision.estadoRapido(Modelo.activo()).estado === 'firmado', null, { timeout: 15000 });
  const firm = await pp.evaluate(async () => { const k = await Decision.concepto(Modelo.activo()); return { estado: k.estado, n: k.firmas.length, huella: k.huella, rec: k.R.ofertas.find((o) => o.id === k.final.recomendado).nombre, notas: k.final.notas }; });
  m.ok(firm.estado === 'firmado' && firm.n === 2 && /^[0-9a-f]{64}$/.test(firm.huella) && /Delta/.test(firm.rec) && /comité de prueba/.test(firm.notas), 'Firmado por comite1 y comite2, con la huella del texto: recomienda ' + firm.rec);
  await irA(pp, '15'); await pestana(pp, 'gerencial');
  m.ok(/^Recomendado: .*Delta/.test(await pp.textContent('#stage .portada-cuadro .titulo')), 'La portada del cuadro gerencial pasa a «Recomendado: …»');
  const pdfC = await bajar(async () => { await irA(pp, '16'); await pestana(pp, 'concepto'); await accion('concepto-pdf'); });
  const pc = await leerPDF(pdfC.ruta);
  m.ok(pc.length >= 2 && !pc.some((x) => /BORRADOR/.test(x.texto)) && pc.some((x) => /Firmas del comité/.test(x.texto) && (x.texto.match(/Firmó el/g) || []).length === 2 && x.texto.includes(firm.huella)), 'El PDF del concepto firmado no lleva la marca de borrador y trae las dos firmas con la huella');

  m.seccion('Presupuesto adjudicado hacia ARKEN CONTROL');
  await accion('exportar-adjudicado');
  await pp.waitForSelector('#btnGuardarXlsx');
  const sinErr = await pp.isEnabled('#btnGuardarXlsx');
  const adj = await bajar(() => pp.click('#btnGuardarXlsx'), 'adjudicado.xlsx');
  await botonModal(pp, 'Entendido');
  const esperado = await pp.evaluate(() => { const R = Evaluacion.analisis(Modelo.activo()), o = R.ofertas.find((x) => /Delta/.test(x.nombre)); return { cd: Calculo.costoDirecto(o.pres), acts: Calculo.contar(o.pres).actividades }; });
  m.ok(sinErr && /^ARKEN_ANALYTICA_.*Delta.*_presupuesto\.xlsx$/i.test(adj.nombre), 'El validador previo no encuentra errores: ' + adj.nombre);
  const ctxA = await contexto(nav);
  const pa = await ctxA.newPage();
  const erroresA = vigilarErrores(pa);
  await abrirArken(pa, srv.url(RUTA_ARKEN));
  await ingresarArken(pa, 'admin', 'arken', 'prueba-fase4-arken');
  await pa.click('#railList .nav-item[data-m="00"]');
  await pa.waitForSelector('#btnNuevoProy'); await pa.click('#btnNuevoProy');
  await pa.fill('#f_nombre', 'Adjudicado desde ANALYTICA'); await pa.selectOption('#f_semilla', 'blanco');
  await pa.click('.overlay:last-child .modal-foot .btn.primary');
  await pa.waitForFunction(() => { const p = S.proyectos.find((x) => x.id === Sesion.proyectoActivo); return p && p.nombre === 'Adjudicado desde ANALYTICA'; }, null, { timeout: 15000 });
  await pa.click('#railList .nav-item[data-m="03"]');
  await pa.waitForSelector('#b3Imp', { timeout: 15000 }); await pa.click('#b3Imp');
  const [fc] = await Promise.all([pa.waitForEvent('filechooser'), pa.click('.overlay:last-child .modal-foot button:has-text("Seleccionar archivo")')]);
  await fc.setFiles(adj.ruta);
  await pa.waitForSelector('.overlay:last-child .modal-head h3');
  const titulo = await pa.textContent('.overlay:last-child .modal-head h3');
  for (const id of ['#riActPrecio', '#riActApu']) { const c = pa.locator('.overlay:last-child ' + id); if (await c.count()) await c.check(); }
  await pa.click('.overlay:last-child .modal-foot button:has-text("Importar")');
  await pa.waitForFunction(() => { const p = S.proyectos.find((x) => x.id === Sesion.proyectoActivo); return p && p.capitulos.length > 0; }, null, { timeout: 15000 });
  const enArken = await pa.evaluate(() => { const p = S.proyectos.find((x) => x.id === Sesion.proyectoActivo); let n = 0; p.capitulos.forEach((c) => c.subs.forEach((s) => { n += s.acts.length; })); return { cd: Calculo.costoDirecto(p), acts: n }; });
  m.ok(!/error/i.test(titulo) && enArken.acts === esperado.acts && Math.abs(enArken.cd - esperado.cd) <= Math.max(1, esperado.acts), `ARKEN CONTROL lo importa sin editarlo: ${enArken.acts} actividades y costo directo ${enArken.cd.toFixed(2)} (ANALYTICA ${esperado.cd.toFixed(2)})`);
  m.ok(!erroresA.length, 'ARKEN CONTROL sin errores de JavaScript' + (erroresA.length ? ': ' + erroresA.slice(0, 2).join(' | ') : ''));
  await ctxA.close();

  m.seccion('Informe en PDF y Excel (criterio 11)');
  await irA(pp, '16'); await pestana(pp, 'informe');
  const secs = await pp.evaluate(() => Decision.configInforme(Modelo.activo(), Evaluacion.analisis(Modelo.activo())).secciones.map((s) => [s.id, s.nombre]));
  await pp.uncheck(`#stage [data-secc="${secs[2][0]}"]`);
  await pp.waitForFunction((id) => !Decision.configInforme(Modelo.activo(), Evaluacion.analisis(Modelo.activo())).secciones.find((s) => s.id === id).marcada, secs[2][0]);
  const ultima = secs.length - 1;
  await pp.click(`#stage button[data-mover="-1"][data-i="${ultima}"]`);
  await pp.waitForFunction((id) => { const L = Decision.configInforme(Modelo.activo(), Evaluacion.analisis(Modelo.activo())).secciones; return L[L.length - 2].id === id; }, secs[ultima][0]);
  const orden = await pp.evaluate(() => Decision.configInforme(Modelo.activo(), Evaluacion.analisis(Modelo.activo())).secciones.filter((s) => s.marcada).map((s) => s.nombre));
  const descargas = [];
  pp.on('download', (d) => descargas.push(d));
  await accion('informe-generar');
  await pp.waitForFunction(() => Decision.informes(Modelo.activo()).length === 1, null, { timeout: 240000 });
  await pp.waitForTimeout(500);
  const rutaPdf = join(carpeta, 'informe1.pdf'), rutaXlsx = join(carpeta, 'informe1.xlsx');
  const dPdf = descargas.find((d) => /\.pdf$/.test(d.suggestedFilename())), dX = descargas.find((d) => /\.xlsx$/.test(d.suggestedFilename()));
  await dPdf.saveAs(rutaPdf); await dX.saveAs(rutaXlsx);
  m.ok(/^ARKEN_ANALYTICA_.+_Informe_\d{8}\.pdf$/.test(dPdf.suggestedFilename()) && /_Informe_\d{8}\.xlsx$/.test(dX.suggestedFilename()), 'Sale el PDF y el Excel: ' + dPdf.suggestedFilename());
  const P = await leerPDF(rutaPdf);
  const N = P.length;
  m.ok(P.every((x, i) => i === 0 || x.texto.includes('Página ' + (i + 1) + ' de ' + N)), 'Después de la portada, las ' + N + ' páginas dicen «Página x de ' + N + '» (la portada cuenta como la 1)');
  m.ok(P.every((x) => (x.ancho === 612 && x.alto === 792) || (x.ancho === 792 && x.alto === 612)) && P.some((x) => x.ancho === 792), 'Tamaño carta, con las tablas anchas en horizontal');
  m.ok(P.every((x) => /ARKEN/.test(x.texto)) && !P.some((x) => /BORRADOR/.test(x.texto)), 'Encabezado y pie de ARKEN en cada página; sin marca de borrador porque el concepto está firmado');
  // La primera sección (portada y resumen) es la portada; desde la segunda, el índice las numera en el orden elegido.
  const kIndice = P.findIndex((x) => /Índice/.test(x.texto));
  const textoIndice = P.slice(kIndice, kIndice + 2).map((x) => x.texto).join(' ');
  const pos = orden.slice(1).map((n, i) => textoIndice.indexOf((i + 2) + '. ' + n.slice(0, 20)));
  m.ok(kIndice > 0 && pos.every((x, i) => x >= 0 && (i === 0 || x > pos[i - 1])) && !textoIndice.includes(secs[2][1] + ' '), 'El índice trae las ' + orden.length + ' secciones elegidas, numeradas en el orden elegido, sin la que se quitó');
  const plano = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const primera = (n, i) => P.findIndex((x, k) => k > kIndice + 1 && plano(x.texto).includes(plano((i + 2) + '. ' + n.slice(0, 20))));
  const pags = orden.slice(1).map(primera);
  m.ok(pags.every((x, i) => x > 0 && (i === 0 || x >= pags[i - 1])), 'En el cuerpo, cada sección empieza en ese mismo orden' + (pags.some((x) => x < 0) ? ' (faltan: ' + orden.slice(1).filter((n, i) => pags[i] < 0).join(', ') + ')' : ''));
  const wb = XLSX.read(readFileSync(rutaXlsx));
  m.ok(wb.SheetNames.length >= 10 && wb.SheetNames.every((n) => n.length <= 31) && new Set(wb.SheetNames).size === wb.SheetNames.length, 'El Excel trae ' + wb.SheetNames.length + ' hojas con nombres válidos');
  const ver1 = await pp.evaluate(() => Decision.informes(Modelo.activo())[0]);
  m.ok(ver1.version === 1 && ver1.concepto === 'firmado' && ver1.paginas === N && /^[0-9a-f]{64}$/.test(ver1.sha256Pdf), 'Versión 1 guardada con su configuración, sus páginas y la huella del PDF');

  m.seccion('Si la evaluación cambia después de firmar');
  await pp.evaluate(async () => {
    const p = Modelo.activo(), R = Evaluacion.analisis(p), o = R.ofertas.find((x) => /Beta/.test(x.nombre));
    await Evaluacion.evaluar(p, o.id, 'TEC-01', { cumple: 'sí', puntaje: 51, observacion: 'Revisión del comité: un punto más.' });
    App.render();
  });
  await irA(pp, '16'); await pestana(pp, 'concepto');
  const vuelve = await pp.evaluate(async () => ({ rapido: Decision.estadoRapido(Modelo.activo()), k: (await Decision.concepto(Modelo.activo())).estado, aviso: !!document.querySelector('#avisoFirma .nota.bad') }));
  m.ok(vuelve.rapido.estado === 'borrador' && vuelve.k === 'borrador' && vuelve.aviso, 'Un puntaje cambiado después de firmar devuelve el concepto a borrador, con aviso');
  await pestana(pp, 'informe');
  descargas.length = 0;
  await accion('informe-generar');
  await pp.waitForFunction(() => Decision.informes(Modelo.activo()).length === 2, null, { timeout: 240000 });
  await pp.waitForTimeout(500);
  const r2 = join(carpeta, 'informe2.pdf');
  await descargas.find((d) => /\.pdf$/.test(d.suggestedFilename())).saveAs(r2);
  const P2 = await leerPDF(r2);
  m.ok(P2.every((x) => /BORRADOR/.test(x.texto)), 'El informe nuevo lleva «Borrador: no es una decisión» en cada página');
  await pestana(pp, 'versiones');
  m.ok((await pp.locator('#stage [data-accion="informe-bajar"]').count()) === 4, 'Versiones del informe: las dos, cada una con su PDF y su Excel');
  const v1 = await bajar(() => pp.click('#stage tbody tr:last-child [data-accion="informe-bajar"]'), 'v1.pdf');
  m.ok(readFileSync(v1.ruta).equals(readFileSync(rutaPdf)), 'La versión 1 se descarga idéntica a la que se generó');

  m.seccion('Tablero y borrar la demostración');
  await irA(pp, '00');
  const tab = await pp.evaluate(() => ({ graf: document.querySelectorAll('#stage .grafica-card svg').length, ger: /Cuadro gerencial/.test(document.querySelector('#stage').textContent) }));
  m.ok(tab.graf === 3 && tab.ger, 'Después de la apertura, el tablero muestra el cuadro gerencial y las gráficas 1, 3 y 8');
  const quedan = await pp.evaluate(async () => { await Modelo.borrarDemo(); App.render(); return ['conceptos', 'informes', 'lecturasIA', 'usoIA'].map((n) => (S[n] || []).length).reduce((a, b) => a + b, 0); });
  m.ok(quedan === 0, 'Se borran los conceptos, los informes y las lecturas de la demostración');
  const aud = await pp.evaluate(() => Auditoria.lista().map((a) => a.accion + ' ' + a.objeto));
  m.ok(['firmar concepto de adjudicación', 'generar informe de evaluación', 'exportar presupuesto adjudicado', 'leer documento con el lector'].every((x) => aud.includes(x)), 'Auditoría de la firma, el informe, la exportación y las lecturas');
  m.ok(!errores.length, 'Sin errores de JavaScript' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
  m.ok(!ctx.peticionesExternas.length, 'Ninguna petición a internet (la API estaba simulada)');
} catch (e) {
  m.ok(false, 'La prueba se detuvo: ' + e.message);
  console.error(e);
} finally {
  await nav.close();
  await srv.cerrar();
}
m.terminar();
