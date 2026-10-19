// ARKEN OFERTA · prueba de humo de la interfaz en Chromium (§15, §25).
//
//   · la plantilla sin pliego no deja ofertar; un ARKEN OFERTA con el pliego editado no pasa la verificación
//   · recorrido de los dieciséis módulos sin un solo error, rotulado DEMOSTRACIÓN
//   · temas claro y oscuro, y 360 px sin desplazamiento lateral en todos los módulos (criterio 13)
//   · el borrador se guarda en un archivo y se vuelve a cargar igual
//   · la sesión se cierra por inactividad y la contraseña local la protege
//   · después del cierre ya no se genera el sobre
//   · ninguna petición a internet
//
// Uso: npm run prueba:oferta

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  RUTA_ANALYTICA, servidor, navegador, contexto, vigilarErrores, abrirAnalytica, ingresar, marcador, prepararEmitido,
} from './comun.mjs';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const m = marcador('Prueba de humo de ARKEN OFERTA');
const carpeta = mkdtempSync(join(tmpdir(), 'arken-oferta-humo-'));
const srv = await servidor();
const nav = await navegador();
const FRASE = 'el comité abre las ofertas';

/* El principal emite y arma el paquete del segundo invitado (acuerdo ya verificado). */
const ctxP = await contexto(nav);
const pp = await ctxP.newPage();
await abrirAnalytica(pp, srv.url(RUTA_ANALYTICA));
await ingresar(pp, 'admin', 'arken', 'prueba-oferta-2026');
const prep = await prepararEmitido(pp, FRASE);
const paq = await pp.evaluate(async (FRASE) => {
  const p = Modelo.activo();
  const i = Util.copia(Modelo.invitados(p.id)[1]);
  i.confidencialidad = Object.assign({}, i.confidencialidad, { estado: 'verificado', facultades: true, firmante: 'Representante DEMO', fecha: Util.hoyISO() });
  await Modelo.guardarInvitado(i, 'prueba');
  Sesion.llaves[p.id] = await Cripto.abrirLlaves(Modelo.llaves(p.id), FRASE);
  const r = await Paquetes.generar(p, Modelo.invitados(p.id)[1]);
  const b = new Uint8Array(await r.blob.arrayBuffer());
  let s = ''; for (let k = 0; k < b.length; k += 0x8000) s += String.fromCharCode.apply(null, b.subarray(k, k + 0x8000));
  return { nombre: r.nombre, b64: btoa(s), plantilla: await Paquetes.plantillaOferta(), cierre: Recepcion.cierre(p) };
}, FRASE);
await ctxP.close();
const rutaZip = join(carpeta, paq.nombre);
writeFileSync(rutaZip, Buffer.from(paq.b64, 'base64'));
const zip = await JSZip.loadAsync(readFileSync(rutaZip));
const nombreHtml = Object.keys(zip.files).find((n) => /^ARKEN_OFERTA.*\.html$/.test(n));
const rutaHtml = join(carpeta, nombreHtml);
const html = await zip.file(nombreHtml).async('string');
writeFileSync(rutaHtml, html);
const rutaPlantilla = join(carpeta, 'plantilla.html'); writeFileSync(rutaPlantilla, paq.plantilla);

async function abrir(ruta, opciones) {
  const ctx = await contexto(nav, opciones);
  const pg = await ctx.newPage();
  const errores = vigilarErrores(pg);
  await pg.goto('file://' + ruta);
  return { ctx, pg, errores };
}
async function verificar(pg) {
  const [fc] = await Promise.all([pg.waitForEvent('filechooser'), pg.click('#gVerificar')]);
  await fc.setFiles(rutaZip);
}

m.seccion('Autenticidad');
{
  const o = await abrir(rutaPlantilla);
  await o.pg.waitForSelector('#gateCuerpo .alert');
  m.ok(/no trae un pliego/.test(await o.pg.textContent('#gateCuerpo')), 'La plantilla sin pliego no deja ofertar y dice qué abrir');
  await o.ctx.close();
  const editado = html.replace(/("cantidad":)(\d+)/, (x, a, n) => a + (Number(n) + 1));
  const rutaEd = join(carpeta, 'editado.html'); writeFileSync(rutaEd, editado);
  const e = await abrir(rutaEd);
  await e.pg.waitForSelector('#gVerificar');
  await verificar(e.pg);
  await e.pg.waitForSelector('#gateCuerpo .alert.bad', { timeout: 60000 });
  const t = await e.pg.textContent('#gateCuerpo .alert.bad');
  m.ok(editado !== html && /no es válido/.test(t) && /pliego/i.test(t), 'Un ARKEN OFERTA con una cantidad del pliego editada no pasa la verificación');
  await e.ctx.close();
}

m.seccion('Recorrido');
const o = await abrir(rutaHtml);
await o.pg.waitForSelector('#gVerificar');
await verificar(o.pg);
await o.pg.waitForSelector('#gBtn', { timeout: 60000 });
m.ok(/Pliego auténtico/.test(await o.pg.textContent('#gateCuerpo')) && /Huella de la llave de firma/.test(await o.pg.textContent('#gateCuerpo')), 'El paquete se verifica y muestra la huella de la llave de firma para confirmarla por teléfono');
await o.pg.fill('#gUser', 'oferente'); await o.pg.fill('#gPass', 'corta'); await o.pg.fill('#gPass2', 'corta'); await o.pg.click('#gBtn');
m.ok(/8 caracteres/.test(await o.pg.textContent('#gateErr')), 'La contraseña local exige 8 caracteres');
await o.pg.fill('#gPass', 'clave-oferta-2026'); await o.pg.fill('#gPass2', 'clave-oferta-2026'); await o.pg.click('#gBtn');
await o.pg.waitForSelector('#stage .page-head', { timeout: 60000 });
m.ok(await o.pg.isVisible('#cintaDemo'), 'El proceso de demostración se rotula DEMOSTRACIÓN');
const modulos = await o.pg.evaluate(() => Array.from(document.querySelectorAll('#railList [data-m]')).map((b) => b.dataset.m));
const anchos = [];
for (const tema of ['claro', 'oscuro']) {
  if (tema === 'oscuro') await o.pg.click('#btnTema');
  for (const mod of modulos) {
    await o.pg.click(`#railList [data-m="${mod}"]`);
    await o.pg.waitForSelector(`#railList [data-m="${mod}"].active`);
    for (const t of await o.pg.$$eval('#stage [data-pestana]', (xs) => xs.map((x) => x.dataset.id))) await o.pg.click(`#stage [data-pestana][data-id="${t}"]`);
  }
}
m.ok(await o.pg.evaluate(() => document.documentElement.dataset.tema) === 'oscuro', 'El tema oscuro se aplica y se recuerda');
m.ok(o.errores.length === 0, `${modulos.length} módulos y sus pestañas, en los dos temas, sin un solo error` + (o.errores.length ? ': ' + o.errores.slice(0, 3).join(' | ') : ''));
await o.pg.setViewportSize({ width: 360, height: 760 });
for (const mod of modulos) {
  await o.pg.click(`#railList [data-m="${mod}"]`).catch(async () => { await o.pg.evaluate((x) => App.ir(x), mod); });
  await o.pg.evaluate((x) => App.ir(x), mod);
  const a = await o.pg.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  if (a.s > a.c + 1) anchos.push(mod + ' (' + a.s + ' px)');
}
m.ok(anchos.length === 0, 'A 360 px ningún módulo se desplaza de lado (criterio 13)' + (anchos.length ? ': ' + anchos.join(', ') : ''));
await o.pg.setViewportSize({ width: 1366, height: 860 });

m.seccion('Borrador en archivo');
await o.pg.evaluate(async () => { const b = Oferta.borrador(); b.proponente.representante = 'Representante del borrador'; b.aiu = { a: 17, i: 2, u: 4 }; await Oferta.guardar(); });
const [d] = await Promise.all([o.pg.waitForEvent('download'), o.pg.click('#btnBorradorArchivo')]);
const rutaB = join(carpeta, d.suggestedFilename()); await d.saveAs(rutaB);
m.ok(/_BORRADOR_/.test(d.suggestedFilename()), 'El borrador se guarda en un archivo: ' + d.suggestedFilename());
await o.pg.evaluate(async () => { const b = Oferta.borrador(); b.proponente.representante = 'Otro'; b.aiu = { a: 0, i: 0, u: 0 }; await Oferta.guardar(); App.ir('00'); });
const [fc] = await Promise.all([o.pg.waitForEvent('filechooser'), o.pg.click('#stage [data-accion="cargar-borrador"]')]);
await fc.setFiles(rutaB);
const ov = o.pg.locator('#modales .overlay').last();
await ov.waitFor();
await ov.locator('.modal-foot button', { hasText: 'Reemplazar mi borrador' }).click();
await o.pg.waitForFunction(() => Oferta.borrador().proponente.representante === 'Representante del borrador', null, { timeout: 30000 });
m.ok(await o.pg.evaluate(() => Oferta.borrador().aiu.a === 17), 'Al cargar el archivo, el borrador vuelve tal como estaba');

m.seccion('Sesión');
await o.pg.clock.install();
await o.pg.evaluate(() => document.dispatchEvent(new Event('click')));
await o.pg.clock.runFor(21 * 60000);
await o.pg.waitForSelector('#gate', { state: 'visible', timeout: 30000 });
await o.pg.waitForFunction(() => /inactividad/.test((document.querySelector('#gateErr') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
m.ok(/inactividad/.test(await o.pg.textContent('#gateErr')), 'Veinte minutos sin uso cierran la sesión');
await o.pg.fill('#gPass', 'otra-clave-2026'); await o.pg.click('#gBtn');
await o.pg.waitForFunction(() => /incorrectos/.test(document.querySelector('#gateErr').textContent), null, { timeout: 30000 }).catch(() => {});
m.ok(/incorrectos/.test(await o.pg.textContent('#gateErr')), 'Con otra contraseña no se entra al borrador');
await o.pg.fill('#gPass', 'clave-oferta-2026'); await o.pg.click('#gBtn');
await o.pg.waitForSelector('#stage .page-head', { timeout: 60000 });
m.ok(true, 'Con la contraseña local se vuelve a entrar');

m.seccion('Después del cierre');
await o.pg.clock.setFixedTime(new Date(paq.cierre).getTime() + 60000);
await o.pg.evaluate(() => App.ir('14'));
m.ok(await o.pg.isDisabled('#stage [data-accion="generar-sobre"]') && /cierre ya pasó/.test(await o.pg.getAttribute('#stage [data-accion="generar-sobre"]', 'title')), 'Después del cierre el botón de generar sobre se deshabilita');
const externas = o.ctx.peticionesExternas.filter((u) => !u.startsWith('file://'));
m.ok(externas.length === 0, 'Ninguna petición a internet' + (externas.length ? ': ' + externas.slice(0, 3).join(' | ') : ''));
m.ok(o.errores.length === 0, 'Sin errores de JavaScript en toda la prueba' + (o.errores.length ? ': ' + o.errores.slice(0, 3).join(' | ') : ''));
await nav.close(); await srv.cerrar();
m.terminar();
