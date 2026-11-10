// ARKEN CONTROL · prueba de la versión para iPhone (sitio/), con un iPhone simulado en Chromium.
//
// Sirve sitio/ bajo /arken/, como GitHub Pages, y comprueba:
//   · ingreso, cambio de contraseña y sistema abierto;
//   · que el programa quede guardado en el teléfono y abra SIN internet;
//   · que una versión nueva publicada se descargue y se aplique sola, sin perder los datos.
//
// Uso: npm run iphone && node pruebas/iphone.mjs

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright-core';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const SITIO = join(RAIZ, 'sitio');
if (!existsSync(join(SITIO, 'sw.js'))) {
  console.error('Falta sitio/. Ejecute primero: npm run iphone');
  process.exit(1);
}

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};
let swPublicado = readFileSync(join(SITIO, 'sw.js'), 'utf8');
let vecesIndex = 0;
const servidor = createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (!ruta.startsWith('/arken/')) return res.writeHead(404).end();
  ruta = ruta.slice('/arken'.length);
  if (ruta === '/') ruta = '/index.html';
  if (ruta === '/index.html') vecesIndex++;
  const archivo = normalize(join(SITIO, ruta));
  if (!archivo.startsWith(SITIO) || !existsSync(archivo)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
  res.end(ruta === '/sw.js' ? swPublicado : readFileSync(archivo));
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const URL_APP = `http://localhost:${servidor.address().port}/arken/`;

function rutaChromium() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = '/opt/pw-browsers';
  if (existsSync(base)) {
    for (const d of readdirSync(base).filter((n) => /^chromium-\d+$/.test(n)).sort().reverse()) {
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) if (existsSync(join(base, d, sub))) return join(base, d, sub);
    }
  }
  return undefined;
}
const ejecutable = rutaChromium();
const navegador = await chromium.launch(ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' });

let fallas = 0;
const ok = (cond, msg) => {
  if (cond) console.log('  ✔ ' + msg);
  else {
    fallas++;
    console.error('  ✖ ' + msg);
  }
};

const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const contexto = await navegador.newContext({ ...iphone, serviceWorkers: 'allow' });
const pagina = await contexto.newPage();
const errores = [];
pagina.on('pageerror', (e) => errores.push(e.message));

async function esperarPrograma() {
  await pagina.waitForSelector('#gate, #topbar', { state: 'visible', timeout: 60000 });
  await pagina.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 60000 });
}
const versionActiva = () =>
  pagina.evaluate(
    () =>
      new Promise((res) => {
        const c = navigator.serviceWorker.controller;
        if (!c) return res('');
        navigator.serviceWorker.addEventListener('message', (e) => e.data && e.data.arkenVersion && res(e.data.arkenVersion), { once: true });
        c.postMessage('version');
        setTimeout(() => res('?'), 3000);
      }),
  );

console.log('\n▸ iPhone simulado');
await pagina.goto(URL_APP);
await esperarPrograma();
await pagina.evaluate(() => navigator.serviceWorker.ready);
ok(await pagina.evaluate(() => !!document.querySelector('link[rel="manifest"]')), 'trae el manifiesto para instalarse en la pantalla de inicio');

// Ingreso y cambio de contraseña (la contraseña nueva queda guardada en el teléfono)
await pagina.fill('#gUser', 'admin');
await pagina.fill('#gPass', 'arken');
await pagina.click('#gBtn');
await pagina.waitForSelector('#ccA', { timeout: 30000 });
await pagina.waitForFunction(() => document.activeElement && document.activeElement.id === 'ccA', null, { timeout: 5000 });
await pagina.fill('#ccA', 'iphone123');
await pagina.fill('#ccB', 'iphone123');
await pagina.click('text=Cambiar y continuar');
await pagina.waitForSelector('#topbar', { state: 'visible', timeout: 30000 });
ok(true, 'ingreso con admin, cambio de contraseña y sistema abierto');
await pagina.waitForTimeout(2500); // deja que el programa guarde en IndexedDB

const v1 = await versionActiva();
ok(v1 && v1 !== '?', `programa guardado en el teléfono (versión ${v1})`);

// Sin internet
await contexto.setOffline(true);
await pagina.reload();
await esperarPrograma();
ok(await pagina.isVisible('#gate'), 'abre sin internet');
await contexto.setOffline(false);

// Versión nueva publicada: cambia sw.js en el servidor
swPublicado = swPublicado.replace(/const VERSION = '([^']+)'/, "const VERSION = '$1-nueva'");
const antes = vecesIndex;
await pagina.reload(); // abrir la app: Safari revisa sw.js, descarga la versión nueva y recarga sola
await pagina.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 60000 });
let v2 = '';
for (let i = 0; i < 30 && !(v2 || '').endsWith('-nueva'); i++) {
  await pagina.waitForTimeout(1000);
  v2 = await versionActiva().catch(() => '');
}
ok(v2.endsWith('-nueva'), `la versión nueva se aplicó sola (${v2})`);
ok(vecesIndex > antes, 'descargó de nuevo el programa');
await esperarPrograma();

// Los datos siguen: entra con la contraseña nueva
await pagina.fill('#gUser', 'admin');
await pagina.fill('#gPass', 'iphone123');
await pagina.click('#gBtn');
const entro = await pagina.waitForSelector('#topbar', { state: 'visible', timeout: 30000 }).then(() => true, () => false);
ok(entro, 'después de actualizar, los datos siguen (entra con la contraseña nueva)');

const graves = errores.filter((m) => !/ResizeObserver/.test(m));
ok(graves.length === 0, 'sin errores de JavaScript' + (graves.length ? ': ' + graves.slice(0, 3).join(' | ') : ''));

await navegador.close();
servidor.close();
console.log(fallas ? `\n✖ ${fallas} comprobación(es) fallaron\n` : '\n✔ Versión iPhone lista\n');
process.exit(fallas ? 1 : 0);
