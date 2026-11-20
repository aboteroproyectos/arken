// ARKEN OBRA · prueba de la app de escritorio empaquetada (Electron).
//
// Abre ARKEN OBRA ya empaquetada para Linux (el mismo código de Windows), y comprueba:
//   · la pantalla de inicio muestra las apps y abre cada una en su ventana, con su origen y su puente;
//   · CONTROL guarda, escribe su copia interna y sus datos siguen ahí al volver a abrir;
//   · los datos de una app propia instalada antes (aquí, una carpeta «ARKEN CONTROL» armada con
//     los datos de la primera vuelta) se traen la primera vez que se abre esa app.
//
// Uso (Linux): npm run dist:linux && xvfb-run -a npm run prueba:escritorio

import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';

const OBRA = join(dirname(fileURLToPath(import.meta.url)), '..');
const EJECUTABLE = join(OBRA, 'dist', 'linux-unpacked', 'arken-obra');
const CONFIG = join(homedir(), '.config');
const DATOS = join(CONFIG, 'ARKEN OBRA');
const VIEJA = join(CONFIG, 'ARKEN CONTROL');
if (!existsSync(EJECUTABLE)) {
  console.error('Falta la app empaquetada. Ejecute: npm run dist:linux');
  process.exit(1);
}
const manifiesto = JSON.parse(readFileSync(join(OBRA, 'apps', 'manifiesto.json'), 'utf8'));
rmSync(DATOS, { recursive: true, force: true });
rmSync(VIEJA, { recursive: true, force: true });

let fallas = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✔ ' + msg);
  else {
    fallas++;
    console.error('  ✖ ' + msg);
  }
};
const errores = [];
const lanzar = async () => {
  const a = await electron.launch({ executablePath: EJECUTABLE, args: ['--no-sandbox'], timeout: 60000 });
  a.on('window', (w) => w.on('pageerror', (e) => errores.push(w.url() + ': ' + e.message)));
  const w = await a.firstWindow();
  w.on('pageerror', (e) => errores.push(w.url() + ': ' + e.message));
  await w.waitForSelector('.app', { timeout: 30000 });
  return { app: a, inicio: w };
};
async function abrir(app, inicio, id) {
  const [w] = await Promise.all([app.waitForEvent('window', { timeout: 30000 }), inicio.click(`.app[data-app="${id}"]`)]);
  await w.waitForLoadState('domcontentloaded');
  return w;
}
async function cerrarTodo(app) {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((v) => v.close()));
  await app.waitForEvent('close', { timeout: 30000 }).catch(() => {});
}
async function ingresarControl(w, clave, nueva) {
  await w.waitForSelector('#gate', { state: 'visible', timeout: 60000 });
  await w.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 60000 });
  await w.fill('#gUser', 'admin');
  await w.fill('#gPass', clave);
  await w.click('#gBtn');
  if (nueva) {
    await w.waitForSelector('#ccA', { timeout: 30000 });
    await w.waitForFunction(() => document.activeElement && document.activeElement.id === 'ccA', null, { timeout: 5000 });
    await w.fill('#ccA', nueva);
    await w.fill('#ccB', nueva);
    await w.click('text=Cambiar y continuar');
  }
  await w.waitForSelector('#topbar', { state: 'visible', timeout: 30000 });
}

let app = null;
try {
  console.log('▸ Pantalla de inicio');
  let r = await lanzar();
  app = r.app;
  const tarjetas = await r.inicio.$$eval('.app', (L) => L.map((b) => ({ id: b.dataset.app, activa: !b.disabled })));
  ok(['control', 'precios', 'analytica'].every((id) => tarjetas.some((t) => t.id === id && t.activa)), 'muestra CONTROL, PRECIOS y ANALYTICA listas para abrir');
  ok(tarjetas.some((t) => t.id === 'bank' && t.activa === !!manifiesto.bank), 'ARKEN BANK aparece ' + (manifiesto.bank ? 'lista para abrir' : 'como «Próximamente»'));

  console.log('▸ Cada app en su ventana');
  const esperado = {
    precios: { origen: 'app://precios', puente: 'arkenPrecios' },
    analytica: { origen: 'app://analytica', puente: 'arkenAnalytica' },
    ...(manifiesto.bank ? { bank: { origen: 'app://bank', puente: null } } : {}),
  };
  for (const [id, e] of Object.entries(esperado)) {
    const w = await abrir(app, r.inicio, id);
    await w.waitForLoadState('load');
    await w.waitForTimeout(1500);
    const info = await w.evaluate((p) => ({ origen: location.origin, seguro: isSecureContext && !!crypto.subtle, puente: p ? !!window[p] : true, version: p && window[p] ? window[p].version : null }), e.puente);
    ok(info.origen === e.origen && info.seguro, `${id}: se sirve desde ${e.origen} en contexto seguro`);
    ok(info.puente, `${id}: tiene su puente con el computador`);
    if (e.puente) ok(info.version === manifiesto[id].version, `${id}: recibe su versión (${manifiesto[id].version})`);
    // Pedir la misma app otra vez no abre una segunda ventana
    const antes = app.windows().length;
    await r.inicio.click(`.app[data-app="${id}"]`);
    await w.waitForTimeout(500);
    ok(app.windows().length === antes, `${id}: una sola ventana por app`);
  }

  console.log('▸ CONTROL guarda y conserva los datos');
  let c = await abrir(app, r.inicio, 'control');
  await ingresarControl(c, 'arken', 'prueba123');
  ok((await c.evaluate(() => location.origin)) === 'app://arken' && (await c.evaluate(() => !!window.arkenEscritorio && !!window.ArkenApp)), 'control: app://arken con su capa de app y su puente');
  await c.evaluate(() => {
    S.empresa.razonSocial = 'EMPRESA DE PRUEBA';
    App.guardar();
  });
  await c.waitForTimeout(800);
  await cerrarTodo(app);
  app = null;
  const copia = join(DATOS, 'apps', 'control', 'datos', 'copia.json');
  ok(existsSync(copia) && JSON.parse(readFileSync(copia, 'utf8')).empresa.razonSocial === 'EMPRESA DE PRUEBA', 'al cerrar se guarda la copia interna con el último cambio');

  r = await lanzar();
  app = r.app;
  c = await abrir(app, r.inicio, 'control');
  await ingresarControl(c, 'prueba123');
  ok((await c.evaluate(() => S.empresa.razonSocial)) === 'EMPRESA DE PRUEBA', 'al volver a abrir, los datos siguen ahí');
  await cerrarTodo(app);
  app = null;

  console.log('▸ Datos de la app ARKEN CONTROL instalada antes');
  // Se arma una carpeta como la de la app propia con los datos de arriba y se empieza ARKEN OBRA de cero
  mkdirSync(VIEJA, { recursive: true });
  for (const n of ['Local Storage', 'IndexedDB']) {
    const d = join(DATOS, 'Partitions', 'control', n);
    if (existsSync(d)) cpSync(d, join(VIEJA, n), { recursive: true });
  }
  renameSync(join(DATOS, 'apps', 'control', 'datos'), join(VIEJA, 'datos'));
  rmSync(DATOS, { recursive: true, force: true });

  r = await lanzar();
  app = r.app;
  c = await abrir(app, r.inicio, 'control');
  await ingresarControl(c, 'prueba123');
  ok((await c.evaluate(() => S.empresa.razonSocial)) === 'EMPRESA DE PRUEBA', 'la primera vez se traen los datos de la app anterior');
  const marca = JSON.parse(readFileSync(join(DATOS, 'migracion.json'), 'utf8'));
  ok(marca.control && marca.control.estado === 'traidos', 'queda anotado que los datos se trajeron (no se repite)');
  ok(existsSync(join(VIEJA, 'datos', 'copia.json')), 'la app anterior conserva sus datos');
  await cerrarTodo(app);
  app = null;

  ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
} catch (e) {
  fallas++;
  console.error('\n✖ La prueba se detuvo: ' + (e && e.stack ? e.stack : e));
} finally {
  if (app) await app.close().catch(() => {});
  rmSync(VIEJA, { recursive: true, force: true });
}

if (fallas) {
  console.error(`\n✖ ${fallas} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log('\n✔ ARKEN OBRA funciona.');
