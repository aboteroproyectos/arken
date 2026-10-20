// ARKEN PRECIOS · la app de escritorio empacada abre en Windows, macOS y Linux.
//
// La prueba completa de la app (escritorio.mjs) corre solo en Linux. Esta, corta, corre en los tres
// sistemas sobre la app que arma electron-builder y prueba lo que cambia de un sistema a otro:
//   · la ventana muestra el programa servido desde app://precios y no queda en blanco: con sus
//     librerías, el lector de PDF y el puente con la app, sin errores de JavaScript ni de la
//     política de seguridad
//   · se ingresa y se cambia la contraseña del primer ingreso; al cerrar, la app guarda su copia
//     interna, y al abrir otra vez la contraseña nueva sirve: los datos quedaron en el disco
//   · en Windows y Linux, la app también abre copiada a una carpeta con espacios y una «ñ» en el
//     nombre, con sus datos en otra igual, como las de un usuario que se llame así. En macOS la app
//     se instala en Aplicaciones, una ruta que no lleva el nombre del usuario.
// Los datos van a carpetas temporales (--user-data-dir), nunca a la del usuario de este equipo. Si la
// app no arranca, la prueba la abre sola con el registro de Chromium y dice cómo se cerró.
//
// Uso: npm run dist:windows (o dist:mac, o dist:linux) y luego
//   npm run prueba:escritorio-abre [-- ruta/al/ejecutable]
// En Linux sin pantalla, con xvfb-run -a delante.

import { _electron as electron } from 'playwright-core';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
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

/** El ejecutable que deja electron-builder en dist/ para este sistema. En macOS, el que está dentro de la
    primera app (.app) de dist/mac-universal (o mac, mac-arm64…), sin las carpetas temporales del empaque
    universal: los nombres de la app y del ejecutable los pone electron-builder. */
function ejecutableDeDist(dist = join(PRECIOS, 'dist'), sistema = process.platform) {
  if (sistema === 'win32') return join(dist, 'win-unpacked', 'arken-precios.exe');
  if (sistema === 'darwin') {
    const carpetas = (existsSync(dist) ? readdirSync(dist, { withFileTypes: true }) : [])
      .filter((e) => e.isDirectory() && /^mac/.test(e.name) && !/-temp$/.test(e.name))
      .map((e) => e.name)
      .sort((a, b) => (b === 'mac-universal') - (a === 'mac-universal') || a.localeCompare(b));
    for (const d of carpetas) {
      for (const a of readdirSync(join(dist, d)).filter((n) => n.endsWith('.app')).sort()) {
        const macos = join(dist, d, a, 'Contents', 'MacOS');
        const dentro = existsSync(macos) ? readdirSync(macos).filter((n) => !n.startsWith('.')) : [];
        if (dentro.length) return join(macos, dentro[0]);
      }
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

/** Copia una carpeta archivo por archivo. fs.cpSync no sirve: en Windows, Node 22 le pasa la ruta de destino
    a std::filesystem sin convertirla desde UTF-8, así que la carpeta con «ñ» queda con otro nombre y la app
    copiada no está donde se pidió. mkdirSync y copyFileSync sí convierten la ruta. */
function copiarCarpeta(origen, destino) {
  mkdirSync(destino, { recursive: true });
  for (const e of readdirSync(origen, { withFileTypes: true })) {
    const de = join(origen, e.name);
    const a = join(destino, e.name);
    if (e.isDirectory()) copiarCarpeta(de, a);
    else if (e.isSymbolicLink()) symlinkSync(readlinkSync(de), a);
    else copyFileSync(de, a);
  }
}

const original = process.argv[2] || ejecutableDeDist();
if (!existsSync(original)) {
  const dist = join(PRECIOS, 'dist');
  const hay = existsSync(dist) ? ' En dist/ hay: ' + readdirSync(dist).join(', ') + '.' : '';
  console.error('\n✖ No está la app empacada (' + original + ').' + hay + ' Ejecute antes: npm run ' + DIST + '\n');
  process.exit(1);
}
const base = mkdtempSync(join(tmpdir(), 'arken-precios-abre-'));
const env = Object.assign({}, process.env);
// Un escritorio Linux usa un idioma UTF-8. Con el idioma POSIX de algunos contenedores, la app no
// arranca desde una carpeta con «ñ»: eso es del contenedor, no de la app
if (process.platform === 'linux' && !/utf-?8/i.test(env.LC_ALL || env.LC_CTYPE || env.LANG || '')) env.LC_ALL = 'C.UTF-8';
// Cuando la app se cierra antes de arrancar, Playwright deja sin atender algunas de sus esperas. La
// falla llega igual a la espera de la prueba, que la cuenta: aquí solo se anota
process.on('unhandledRejection', (e) => marca.nota('(Playwright: ' + String((e && e.message) || e).split('\n')[0] + ')'));

const argumentos = (datos) => [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--user-data-dir=' + datos];
const ultimas = (t) => t.trim().split(/\r?\n/).slice(-12).join(' | ') || '(sin registro)';

/** La app sola, sin Playwright, con el registro de Chromium: dice si se cierra (y con qué código) o si sigue abierta. */
function sola(exe, datos) {
  return new Promise((resolver) => {
    let salida = '';
    let hijo;
    try {
      hijo = spawn(exe, [...argumentos(datos), '--enable-logging=stderr'], { env, windowsHide: true });
    } catch (e) {
      return resolver('no se pudo ejecutar (' + e.message + ')');
    }
    const guardar = (d) => {
      salida = (salida + d.toString()).slice(-6000);
    };
    hijo.stdout.on('data', guardar);
    hijo.stderr.on('data', guardar);
    let abierta = false;
    // Si a los 20 s sigue abierta, se cierra y se espera a que salga (hasta 10 s más) antes de seguir
    const reloj = setTimeout(() => {
      abierta = true;
      hijo.kill();
      setTimeout(() => resolver('sola sigue abierta a los 20 s · ' + ultimas(salida)), 10000);
    }, 20000);
    hijo.on('error', (e) => {
      clearTimeout(reloj);
      resolver('no se pudo ejecutar (' + e.message + ')');
    });
    hijo.on('close', (codigo, senal) => {
      clearTimeout(reloj);
      resolver(abierta ? 'sola sigue abierta a los 20 s · ' + ultimas(salida) : 'sola se cierra con el código ' + codigo + (senal ? ' (' + senal + ')' : '') + ' · ' + ultimas(salida));
    });
  });
}

/** Abre la app y espera el programa listo. Antes de nada revisa que sus datos vayan a la carpeta de la prueba.
    La primera vez, Windows revisa el ejecutable nuevo antes de dejarlo correr: por eso se espera hasta 2 minutos. */
async function abrirApp(exe, datos) {
  let app;
  try {
    app = await electron.launch({ executablePath: exe, args: argumentos(datos), env, timeout: 120000 });
  } catch (e) {
    throw new Error('la app no arrancó (' + ((e && e.message) || e).split('\n')[0] + '); ' + (await sola(exe, datos)));
  }
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
  /* ════════  Donde la deja electron-builder  ════════ */
  const datos = join(base, 'datos');
  marca.nota('App: ' + original);
  let { app, p, errores, principal } = await abrirApp(original, datos);
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

  ({ app, p, errores } = await abrirApp(original, datos));
  abierta = app;
  await ingresarPrecios(p, 'admin', CLAVE);
  m.ok(await p.isVisible('#stage .cover-hero'), 'al abrir otra vez, la contraseña nueva sirve: los datos quedaron en el disco');
  const todos = [...errores1, ...errores];
  m.ok(todos.length === 0, 'sin errores de JavaScript ni de la política de seguridad', todos.slice(0, 3));
  await cerrarApp(app);
  abierta = null;

  /* ════════  Copiada a una carpeta con espacios y «ñ»  ════════ */
  if (process.platform !== 'darwin') {
    const copia = join(base, CARPETA, basename(dirname(original)), basename(original));
    copiarCarpeta(dirname(original), dirname(copia));
    const datosN = join(base, 'Datos de ARKEN PRECIOS ñ');
    marca.nota('App: ' + copia);
    try {
      ({ app, p, errores } = await abrirApp(copia, datosN));
      abierta = app;
      const r = await p.evaluate(() => ({ url: location.href, version: window.arkenPrecios && window.arkenPrecios.version }));
      await ingresarPrecios(p, 'admin', 'arken', CLAVE);
      m.ok(r.url === 'app://precios/index.html' && r.version === VERSION && errores.length === 0,
        'también abre y deja ingresar desde una carpeta con espacios y «ñ», con sus datos en otra igual', { r, errores: errores.slice(0, 3) });
      await cerrarApp(app);
      abierta = null;
      m.ok(existsSync(join(datosN, 'datos', 'copia.json.gz')), 'y guarda su copia interna en la carpeta de datos con «ñ»');
    } catch (e) {
      if (abierta) await abierta.close().catch(() => {});
      abierta = null;
      // Cuál de las dos carpetas la detiene
      const programa = await sola(copia, join(base, 'datos-simple'));
      const datosConN = await sola(original, join(base, 'Datos con ñ ' + Date.now()));
      m.ok(false, 'también abre desde una carpeta con espacios y «ñ»: ' + ((e && e.message) || e).split('\n')[0] +
        ' ║ la app en la carpeta con «ñ» y sus datos en una simple: ' + programa + ' ║ la app donde la deja electron-builder y sus datos en una carpeta con «ñ»: ' + datosConN);
    }
  }
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
