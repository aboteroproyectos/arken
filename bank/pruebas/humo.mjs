// ARKEN BANK · prueba de humo en Chromium, sobre el HTML compilado.
//
// Ingresa con admin/arken (cambio obligatorio de contraseña), carga la demostración (que
// genera PDF reales y los lee con pdf.js), recorre todos los módulos sin errores, filtra la
// cartera, emite un concepto con su PDF, carga una IMAGEN de un certificado laboral para
// comprobar el OCR sin internet, y verifica que el programa no haga ninguna petición externa.

import { servidor, navegador, RUTA_BANK, afirmar, igual, terminar } from './comun.mjs';

const srv = await servidor();
const nav = await navegador();
const ctx = await nav.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
const externas = [];
ctx.on('request', (r) => { const u = r.url(); if (!/^(blob:|data:|http:\/\/localhost)/.test(u)) externas.push(u); });
const p = await ctx.newPage();
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });

try {
  await p.goto(srv.url(RUTA_BANK));
  await p.waitForFunction(() => !document.querySelector('#gBtn').disabled);
  console.log('Ingreso');
  await p.fill('#gUser', 'admin'); await p.fill('#gPass', 'arken'); await p.click('#gBtn');
  await p.waitForSelector('#ccA'); await p.fill('#ccA', 'clave-segura-1'); await p.fill('#ccB', 'clave-segura-1');
  await p.click('.modal-foot .btn.primary');
  await p.waitForSelector('#stage .page-head');
  afirmar(await p.isVisible('#topbar'), 'entra al programa tras cambiar la contraseña');

  console.log('Demostración');
  await p.click('[data-accion="cargar-demo"]');
  await p.waitForFunction(() => typeof S !== "undefined" && S.clientes && S.clientes.length === 6 && !document.querySelector('#dmAviso'), null, { timeout: 120000 });
  const leidos = await p.evaluate(() => S.documentos.filter((d) => d.lectura && d.lectura.datos.length).length);
  const totalDocs = await p.evaluate(() => S.documentos.length);
  afirmar(totalDocs >= 6 && leidos === totalDocs, `los ${totalDocs} documentos de ejemplo se generaron en PDF y se leyeron (${leidos})`);
  const salario = await p.evaluate(() => { const d = S.documentos.find((x) => x.tipoDoc === 'cert_laboral'); const x = d.lectura.datos.find((y) => y.campo === 'salario'); return x && x.normalizado; });
  igual(salario, 11000000, 'el lector toma el salario del certificado laboral generado en PDF');

  console.log('Módulos');
  for (const m of ['00', '01', '02', '03', '04', '05', '06', '07', '16', 'admin', 'config']) {
    await p.evaluate((x) => App.ir(x), m);
    const t = await p.textContent('#stage .page-head h1');
    afirmar(!/No se pudo mostrar/.test(t || ''), `módulo ${m}: ${t}`);
  }
  await p.evaluate(() => { Sesion.pestanas.cli = 'matriz'; App.ir('01'); });
  afirmar(await p.locator('table.matriz-v td.celda-v').count() >= 30, 'la matriz de viabilidad pinta clientes × bancos');

  console.log('Filtros');
  await p.evaluate(() => { Sesion.pestanas.cli = 'lista'; App.ir('01'); });
  await p.selectOption('#fl_tipo', 'constructora');
  await p.waitForFunction(() => document.querySelectorAll('#stage table.t tbody tr').length === 1);
  afirmar(true, 'filtrar por tipo «constructora» deja un cliente');
  await p.click('[data-accion="limpiar-filtros"]');
  await p.selectOption('#fl_banco', 'bco_fna');
  const enFna = await p.locator('#stage table.t tbody tr').count();
  afirmar(enFna >= 1 && enFna < 6, `«Viable en el banco: FNA» filtra la cartera (${enFna})`);
  await p.click('[data-accion="limpiar-filtros"]');

  console.log('Concepto');
  await p.evaluate(() => { Modelo.abrir('cli_demo_laura'); Sesion.analisis = null; App.ir('05'); });
  const dictamen = await p.textContent('.dict-banda b');
  afirmar(/Viable/.test(dictamen), `Laura: ${dictamen}`);
  const descarga = p.waitForEvent('download');
  await p.click('[data-accion="emitir-concepto"]');
  await p.click('.modal-foot .btn.primary');
  const d = await descarga;
  afirmar(/^Concepto_CV-\d{8}-0001/.test(d.suggestedFilename()), 'emite el concepto ' + d.suggestedFilename());
  igual(await p.evaluate(() => S.conceptos.length), 1, 'el concepto queda guardado');

  console.log('Ayuda');
  await p.evaluate(() => App.ir('16'));
  await p.fill('#ayBuscar', 'leasing');
  await p.waitForSelector('#ayResultados .ay-rtotal');
  afirmar(/resultado/.test(await p.textContent('#ayResultados .ay-rtotal')), 'el buscador del centro de ayuda encuentra «leasing»');
  await p.fill('#ayBuscar', '');
  await p.click('[data-accion="ay-tab"][data-k="info"]');
  afirmar(/ARKEN 360/.test(await p.textContent('.ay-rotulo')), 'la placa de información dice «ARKEN 360»');
  const manual = p.waitForEvent('download');
  await p.click('[data-accion="ay-tab"][data-k="inicio"]');
  await p.click('[data-accion="ay-manual"]');
  afirmar((await manual).suggestedFilename() === 'ARKEN_BANK_manual_de_usuario.pdf', 'descarga el manual de usuario en PDF');

  console.log('OCR de una imagen, sin internet');
  const png = await p.evaluate(async () => {
    const cv = document.createElement('canvas'); cv.width = 1400; cv.height = 520;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, cv.width, cv.height); x.fillStyle = '#111'; x.font = '30px Arial';
    ['INDUSTRIAS DEL VALLE S.A.S.', 'CERTIFICA QUE:', 'Laura Gómez Restrepo, identificada con cédula 1.037.588.214,', 'labora con contrato a término indefinido, con un', 'salario básico mensual de $ 11.000.000.', 'Se expide el 3 de octubre de 2026.']
      .forEach((l, i) => x.fillText(l, 40, 70 + i * 70));
    return cv.toDataURL('image/png').split(',')[1];
  });
  await p.evaluate(() => App.ir('03'));
  const [selector] = await Promise.all([p.waitForEvent('filechooser'), p.click('[data-accion="cargar-doc"][data-tipo="cert_laboral"]')]);
  await selector.setFiles({ name: 'certificado-foto.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await p.waitForFunction(() => S.documentos.some((d) => d.nombre === 'certificado-foto.png' && d.lectura), null, { timeout: 180000 });
  const ocr = await p.evaluate(() => { const d = S.documentos.find((x) => x.nombre === 'certificado-foto.png'); return { metodo: d.lectura.metodo, salario: (d.lectura.datos.find((y) => y.campo === 'salario') || {}).normalizado, texto: d.lectura.texto.join(' ').slice(0, 300) }; });
  igual(ocr.metodo, 'ocr', 'la imagen se lee con OCR');
  igual(ocr.salario, 11000000, 'el OCR encuentra el salario en la imagen');

  console.log('Red y errores');
  igual(externas.length, 0, 'el programa no hace peticiones fuera del equipo' + (externas.length ? ': ' + externas.slice(0, 3).join(', ') : ''));
  igual(errores.length, 0, 'sin errores en la consola' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
  const reg = await p.evaluate(() => RegistroTecnico.entradas().map((e) => e.contexto + ': ' + e.mensaje));
  igual(reg.length, 0, 'registro técnico vacío' + (reg.length ? ': ' + reg.slice(0, 3).join(' | ') : ''));
} catch (e) {
  afirmar(false, 'la prueba se detuvo: ' + e.message);
  try { await p.screenshot({ path: '/tmp/arken-bank-humo.png', fullPage: true }); console.error('  captura en /tmp/arken-bank-humo.png'); } catch {}
} finally {
  await nav.close(); await srv.cerrar();
}
terminar('Prueba de humo de ARKEN BANK');
