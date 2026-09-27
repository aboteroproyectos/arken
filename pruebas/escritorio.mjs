// ARKEN CONTROL · prueba de la app de escritorio empaquetada (Electron).
//
// Abre la app ya empaquetada para Linux (el mismo código de Windows y macOS), ingresa,
// abre una vista previa en ventana aparte, lee un PDF sin internet, cierra la app y
// comprueba que la copia interna y la copia del día quedaron escritas. Luego la vuelve
// a abrir y verifica que los datos siguen ahí.
//
// Uso (Linux): npx electron-builder --linux dir --publish never && xvfb-run -a npm run prueba:escritorio

import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _electron as electron } from 'playwright-core';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const EJECUTABLE = join(RAIZ, 'dist', 'linux-unpacked', 'arken-control');
const DATOS = join(homedir(), '.config', 'ARKEN CONTROL');
if (!existsSync(EJECUTABLE)) {
  console.error('Falta la app empaquetada. Ejecute: npx electron-builder --linux dir --publish never');
  process.exit(1);
}
rmSync(DATOS, { recursive: true, force: true });

let fallas = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✔ ' + msg);
  else {
    fallas++;
    console.error('  ✖ ' + msg);
  }
};
const lanzar = () => electron.launch({ executablePath: EJECUTABLE, args: ['--no-sandbox'], timeout: 60000 });
async function listo(w) {
  await w.waitForSelector('#gate', { state: 'visible', timeout: 60000 });
  await w.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 60000 });
}

console.log('▸ App de escritorio');
let app = null;
try {
  app = await lanzar();
  let w = await app.firstWindow();
  const errores = [];
  w.on('pageerror', (e) => errores.push(e.message));
  await listo(w);
  const info = await w.evaluate(() => ({
    origen: location.origin,
    seguro: isSecureContext && !!crypto.subtle,
    capa: !!window.ArkenApp && !!window.arkenEscritorio,
  }));
  ok(info.origen === 'app://arken' && info.seguro, 'se sirve desde app://arken en contexto seguro');
  ok(info.capa, 'la capa de la app y el puente del computador están activos');

  await w.fill('#gUser', 'admin');
  await w.fill('#gPass', 'arken');
  await w.click('#gBtn');
  await w.waitForSelector('#ccA', { timeout: 30000 });
  await w.fill('#ccA', 'prueba123');
  await w.fill('#ccB', 'prueba123');
  await w.click('text=Cambiar y continuar');
  await w.waitForSelector('#topbar', { state: 'visible', timeout: 30000 });
  ok(true, 'ingreso y cambio obligatorio de contraseña');

  const [hija] = await Promise.all([
    app.waitForEvent('window', { timeout: 15000 }),
    w.evaluate(() => {
      const v = window.open('', '_blank');
      v.document.write('<title>Vista</title><p id="x">vista previa</p>');
      v.document.close();
    }),
  ]);
  await hija.waitForSelector('#x', { timeout: 10000 });
  ok(true, 'las vistas previas se abren en una ventana aparte');
  await hija.close();

  const texto = await w.evaluate(async () => {
    const d = new jspdf.jsPDF();
    d.text('ARKEN PRUEBA PDF', 20, 20);
    return await extraerTextoPDF(d.output('datauristring'));
  });
  ok(/ARKEN PRUEBA PDF/.test(texto), 'el lector de PDF funciona sin internet');

  await w.evaluate(() => {
    S.empresa.razonSocial = 'EMPRESA DE PRUEBA';
    App.guardar();
  });
  await w.waitForTimeout(800);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
  await app.waitForEvent('close', { timeout: 20000 }).catch(() => {});
  app = null;
  const copia = join(DATOS, 'datos', 'copia.json');
  ok(existsSync(copia) && JSON.parse(readFileSync(copia, 'utf8')).empresa.razonSocial === 'EMPRESA DE PRUEBA', 'al cerrar se guarda la copia interna con el último cambio');
  const diarias = join(DATOS, 'datos', 'copias-diarias');
  ok(existsSync(diarias) && readdirSync(diarias).some((n) => /^ARKEN_CONTROL_copia_\d{4}-\d{2}-\d{2}\.json$/.test(n)), 'copia del día creada');

  app = await lanzar();
  w = await app.firstWindow();
  w.on('pageerror', (e) => errores.push(e.message));
  await listo(w);
  await w.fill('#gUser', 'admin');
  await w.fill('#gPass', 'prueba123');
  await w.click('#gBtn');
  await w.waitForSelector('#topbar', { state: 'visible', timeout: 30000 });
  ok((await w.evaluate(() => S.empresa.razonSocial)) === 'EMPRESA DE PRUEBA', 'al volver a abrir, los datos siguen ahí');
  ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.join(' | ') : ''));
} catch (e) {
  fallas++;
  console.error('\n✖ La prueba se detuvo: ' + (e && e.stack ? e.stack : e));
} finally {
  if (app) await app.close().catch(() => {});
}

if (fallas) {
  console.error(`\n✖ ${fallas} comprobación(es) fallaron.`);
  process.exit(1);
}
console.log('\n✔ Todo en orden.');
