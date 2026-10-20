// ARKEN PRECIOS · la app de escritorio empacada abre en Windows, macOS y Linux.
//
// La prueba completa de la app (escritorio.mjs) corre solo en Linux. Esta, corta, corre en los tres
// sistemas sobre la app que arma electron-builder y prueba lo que cambia de un sistema a otro:
//   · la ventana muestra el programa servido desde app://precios y no queda en blanco: con sus
//     librerías, el lector de PDF y el puente con la app, sin errores de JavaScript ni de la
//     política de seguridad
//   · se ingresa y se cambia la contraseña del primer ingreso; al cerrar, la app guarda su copia
//     interna, y al abrir otra vez la contraseña nueva sirve: los datos quedaron en el disco
//   · la app lee sus archivos y guarda sus datos en carpetas con espacios y una «ñ» en el nombre,
//     como las de un usuario de Windows que se llame así. En Windows y Linux la app se copia antes a
//     una carpeta así; en macOS ya está dentro de «ARKEN PRECIOS.app».
// Los datos van a una carpeta temporal (--user-data-dir), nunca a la del usuario de este equipo.
//
// Uso: npm run dist:windows (o dist:mac, o dist:linux) y luego
//   npm run prueba:escritorio-abre [-- ruta/al/ejecutable]
// En Linux sin pantalla, con xvfb-run -a delante.

import { _electron as electron } from 'playwright-core';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { PRECIOS, vigilarErrores, ingresarPrecios, marcador } from './comun.mjs';

const SISTEMA = { win32: 'Windows', darwin: 'macOS', linux: 'Linux' }[process.platform] || process.platform;
const PLATAFORMA = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux';
const DIST = { win32: 'dist:windows', darwin: 'dist:mac' }[process.platform] || 'dist:linux';
const VERSION = JSON.parse(readFileSync(join(PRECIOS, 'package.json'), 'utf8')).version;
const CARPETA = 'Programas con espacios y ñ';
const CLAVE = 'prueba-abre-2026';

const marca = marcador('La app de escritorio empacada abre (' + SISTEMA + ')');
const m = {
  ok(cond, msg, detalle) {
    return marca.ok(cond, msg + (!cond && detalle !== undefined ? ' · ' + JSON.stringify(detalle).slice(0, 700) : ''));
  },
};

/** El ejecutable que deja electron-builder en dist/ para este sistema. */
function ejecutableDeDist() {
  const dist = join(PRECIOS, 'dist');
  if (process.platform === 'win32') return join(dist, 'win-unpacked', 'arken-precios.exe');
  if (process.platform === 'darwin') {
    // dist/mac-universal (o mac, mac-arm64…)/ARKEN PRECIOS.app/Contents/MacOS/<ejecutable>
    for (const d of existsSync(dist) ? readdirSync(dist) : []) {
      const macos = join(dist, d, 'ARKEN PRECIOS.app', 'Contents', 'MacOS');
      if (d.startsWith('mac') && existsSync(macos)) return join(macos, readdirSync(macos)[0]);
    }
    return join(dist, 'mac-universal', 'ARKEN PRECIOS.app', 'Contents', 'MacOS', 'ARKEN PRECIOS');
  }
  return join(dist, 'linux-unpacked', 'arken-precios');
}

/** La misma carpeta, aunque se escriba distinto (enlaces, nombres cortos de Windows, mayúsculas, la «ñ» de macOS). */
function mismaCarpeta(a, b) {
  const normal = (r) => {
    try {
      r = realpathSync.native(r);
    } catch {
      // Si no existe se compara tal cual
    }
    r = r.normalize('NFC');
    return process.platform === 'linux' ? r : r.toLowerCase();
  };
  return normal(a) === normal(b);
}

let ejecutable = process.argv[2] || ejecutableDeDist();
if (!existsSync(ejecutable)) {
  console.error('\n✖ No está la app empacada (' + ejecutable + '). Ejecute antes: npm run ' + DIST + '\n');
  process.exit(1);
}
const base = mkdtempSync(join(tmpdir(), 'arken-precios-abre-'));
const datos = join(base, 'Datos de ARKEN PRECIOS ñ');
if (process.platform !== 'darwin') {
  const origen = dirname(ejecutable);
  const destino = join(base, CARPETA, basename(origen));
  cpSync(origen, destino, { recursive: true, verbatimSymlinks: true });
  ejecutable = join(destino, basename(ejecutable));
}
const args = [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--user-data-dir=' + datos];
const env = Object.assign({}, process.env);
// Un escritorio Linux usa un idioma UTF-8. Con el idioma POSIX de algunos contenedores, la app no
// arranca desde una carpeta con «ñ»: eso es del contenedor, no de la app
if (process.platform === 'linux' && !/utf-?8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || '')) env.LC_ALL = 'C.UTF-8';
marca.nota('App: ' + ejecutable);

/** Abre la app y espera el programa listo. Antes de nada revisa que sus datos vayan a la carpeta de la prueba.
    La primera vez, Windows revisa el ejecutable nuevo antes de dejarlo correr: por eso se espera hasta 2 minutos. */
async function abrirApp() {
  const app = await electron.launch({ executablePath: ejecutable, args, env, timeout: 120000 });
  const principal = await app.evaluate(({ app: a }) => ({ empacada: a.isPackaged, datos: a.getPath('userData') }));
  if (!mismaCarpeta(principal.datos, datos)) {
    app.process().kill();
    throw new Error('La app no usó la carpeta de datos de la prueba (' + principal.datos + '): se cerró sin tocar nada');
  }
  let p = null;
  let errores = [];
  try {
    p = await app.firstWindow({ timeout: 120000 });
    errores = vigilarErrores(p);
    await p.waitForFunction(() => document.documentElement.dataset.listo === '1', null, { timeout: 60000 });
    await p.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
    return { app, p, errores, principal };
  } catch (e) {
    // Lo que muestra la ventana, para saber en el registro de la prueba por qué no abrió
    const ventana = p
      ? await p
          .evaluate(() => ({ url: location.href, listo: document.documentElement.dataset.listo, texto: (document.body ? document.body.innerText : '').slice(0, 300) }))
          .catch((x) => String(x))
      : 'sin ventana';
    await app.close().catch(() => {});
    throw new Error('El programa no quedó listo: ' + JSON.stringify(ventana) + (errores.length ? ' · errores: ' + errores.slice(0, 3).join(' | ') : '') + ' · ' + ((e && e.message) || e).split('\n')[0]);
  }
}
/** Cierra la ventana como el usuario: el programa termina de guardar y la app sale. */
async function cerrarApp(app) {
  const cerrada = app.waitForEvent('close', { timeout: 30000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.close())).catch(() => {});
  await cerrada;
}

let abierta = null;
try {
  /* ── Primera vez ── */
  let { app, p, errores, principal } = await abrirApp();
  abierta = app;
  const errores1 = errores;
  m.ok(principal.empacada, 'es la app empacada y sus datos van a la carpeta de la prueba', principal);
  const info = await p.evaluate(async () => {
    const lector = window.pdfjsLib && pdfjsLib.GlobalWorkerOptions.workerSrc;
    let bytes = 0;
    try {
      const r = await fetch(lector);
      bytes = r.ok ? (await r.text()).length : 'HTTP ' + r.status;
    } catch (e) {
      bytes = String(e);
    }
    return {
      url: location.href,
      seguro: isSecureContext,
      version: window.arkenPrecios && window.arkenPrecios.version,
      plataforma: window.arkenApp && window.arkenApp.plataforma,
      puente: ['secretos', 'motor', 'copia'].map((k) => k + ':' + Object.keys((window.arkenPrecios || {})[k] || {}).sort().join()).join(' '),
      externos: performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => !/^(app|blob|data):/.test(u)),
      librerias: [typeof jspdf, typeof XLSX, typeof pdfjsLib].join(),
      lector,
      bytes,
      ingreso: !!document.querySelector('#gBtn') && document.querySelector('#gBtn').offsetParent !== null,
    };
  });
  m.ok(info.url === 'app://precios/index.html' && info.seguro && info.version === VERSION && info.plataforma === PLATAFORMA && info.ingreso,
    'la ventana muestra el programa desde app://precios, con la versión de la app (' + VERSION + '), y no queda en blanco: se ve el ingreso', info);
  m.ok(info.externos.length === 0 && info.librerias === 'object,object,object' && info.lector === 'app://precios/vendor/pdf.worker.min.js' && info.bytes > 100000,
    'las librerías de Excel y PDF y el lector de PDF salen de la app, sin internet', info);
  m.ok(info.puente === 'secretos:borrar,disponible,guardar,info,leer motor:alEvento,cancelar,correr,probar copia:abrirCarpeta,borrar,guardar,leer,meta',
    'el puente window.arkenPrecios trae la bóveda, el motor y la copia', info.puente);
  await ingresarPrecios(p, 'admin', 'arken', CLAVE);
  m.ok(await p.isVisible('#stage .cover-hero'), 'se ingresa y se cambia la contraseña del primer ingreso');
  await cerrarApp(app);
  abierta = null;
  m.ok(existsSync(join(datos, 'datos', 'copia.json.gz')), 'al cerrar, la app guarda su copia interna en su carpeta de datos');

  /* ── Otra vez ── */
  ({ app, p, errores } = await abrirApp());
  abierta = app;
  await ingresarPrecios(p, 'admin', CLAVE);
  m.ok(await p.isVisible('#stage .cover-hero'), 'al abrir otra vez, la contraseña nueva sirve: los datos quedaron en el disco');
  const todos = [...errores1, ...errores];
  m.ok(todos.length === 0, 'sin errores de JavaScript ni de la política de seguridad', todos.slice(0, 3));
  await cerrarApp(app);
  abierta = null;
} catch (e) {
  m.ok(false, 'la prueba terminó sin errores inesperados: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  if (abierta) await abierta.close().catch(() => {});
  try {
    rmSync(base, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch (e) {
    marca.nota('No se pudo borrar la carpeta temporal ' + base + ': ' + ((e && e.message) || e));
  }
}

console.log('\n' + (marca.fallas ? '✖ ' + marca.fallas + ' de ' + marca.pruebas + ' comprobaciones fallaron.' : marca.pruebas + ' de ' + marca.pruebas + ' comprobaciones bien.'));
process.exit(marca.fallas ? 1 : 0);
