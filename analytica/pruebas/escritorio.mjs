// ARKEN ANALYTICA · la app de escritorio real (Electron), no simulada:
//
//   · la ventana abre el programa desde app://analytica/ y no queda en blanco
//   · se puede ingresar y cambiar la contraseña del primer ingreso
//   · el programa no tiene errores de JavaScript ni de la política de seguridad
//   · nada sale a internet
//   · con la app empacada, también desde una carpeta con espacios, tildes y «ñ», con los datos en
//     otra así (en Windows y Linux se copia la app; en macOS solo cambia la de los datos)
//
// Sin argumento abre la app desde esta carpeta (npm run preparar antes). Con la ruta de un ejecutable
// empacado (dist/linux-unpacked/arken-analytica, dist/win-unpacked/arken-analytica.exe…) abre ese.
// En Linux sin pantalla, con xvfb-run.
//
// Uso: npm run prueba:escritorio [-- ruta/al/ejecutable]

import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { _electron } from 'playwright-core';
import { ANALYTICA, marcador, ingresar } from './comun.mjs';

const require = createRequire(import.meta.url);
const m = marcador('App de escritorio de ARKEN ANALYTICA');
const empacada = process.argv[2];
const temporal = mkdtempSync(join(tmpdir(), 'analytica-escritorio-'));

/** Copia archivo por archivo: en Windows, fs.cpSync de Node 22 daña los nombres de carpeta con «ñ». */
function copiar(origen, destino) {
  mkdirSync(destino, { recursive: true });
  for (const e of readdirSync(origen, { withFileTypes: true })) {
    const a = join(origen, e.name), b = join(destino, e.name);
    if (e.isSymbolicLink()) symlinkSync(readlinkSync(a), b);
    else if (e.isDirectory()) copiar(a, b);
    else copyFileSync(a, b);
  }
}

async function probar(ejecutable, datos, titulo) {
  mkdirSync(datos, { recursive: true });
  const args = [...(process.platform === 'linux' ? ['--no-sandbox'] : []), '--user-data-dir=' + datos];
  let app;
  try {
    app = await _electron.launch({
      executablePath: ejecutable || require('electron'),
      args: ejecutable ? args : [...args, ANALYTICA],
      cwd: ANALYTICA,
      // Sin un idioma UTF-8 (locale POSIX), Chromium en Linux no abre desde una carpeta con «ñ»
      env: { ...process.env, LANG: process.env.LANG || 'C.UTF-8' },
      timeout: 60000,
    });
    const w = await app.firstWindow({ timeout: 60000 });
    const errores = [];
    w.on('pageerror', (e) => errores.push(e.message));
    w.on('console', (x) => { if (x.type() === 'error' || /Content Security Policy|Refused to/i.test(x.text())) errores.push(x.text()); });

    m.seccion(titulo);
    await w.waitForLoadState('domcontentloaded');
    m.ok(w.url().startsWith('app://analytica/'), 'La ventana abre el programa desde app://analytica/ (' + w.url() + ')');
    const ingreso = await w.waitForSelector('#gBtn:not([disabled])', { timeout: 60000 }).then(() => true, () => false);
    m.ok(ingreso, 'Se ve la pantalla de ingreso: la ventana no queda en blanco');
    m.ok(await w.isVisible('#gate'), 'La ventana se muestra');
    const version = await app.evaluate(({ app: a }) => a.getVersion());
    m.ok(version === require('../package.json').version, 'La app es la versión ' + version);

    m.seccion('Ingreso');
    await ingresar(w, 'admin', 'arken', 'prueba-escritorio-2026');
    m.ok(await w.isVisible('#stage .page-head'), 'Se ingresa y se cambia la contraseña del primer ingreso');
    const plataforma = await w.evaluate(() => document.documentElement.getAttribute('data-app'));
    const esperada = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux';
    m.ok(plataforma === esperada, 'El programa sabe que corre en la app de escritorio (' + plataforma + ')');
    m.ok(!errores.length, 'Sin errores de JavaScript ni de la política de seguridad' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));

    m.seccion('Sin internet');
    const pagina = await w.evaluate(async () => {
      try { await fetch('https://example.com/', { mode: 'no-cors' }); return 'salió'; } catch { return 'bloqueada'; }
    });
    m.ok(pagina === 'bloqueada', 'Una petición del programa a internet no sale');
    // Aunque la política de la página fallara, la app cancela la petición
    const app_ = await app.evaluate(async ({ net }) => {
      try { await net.fetch('https://example.com/'); return 'salió'; } catch { return 'bloqueada'; }
    });
    m.ok(app_ === 'bloqueada', 'La app cancela cualquier petición a internet');
  } catch (e) {
    m.ok(false, 'La app abre: ' + ((e && e.message) || e).split('\n')[0]);
  } finally {
    if (app) await app.close().catch(() => {});
  }
}

try {
  await probar(empacada, join(temporal, 'datos'), empacada ? 'App empacada: ' + empacada : 'App desde la carpeta');
  if (empacada) {
    // Como en el equipo de una persona: «C:\Users\Peña\…\ARKEN ANALYTICA»
    let ejecutable = empacada;
    if (process.platform !== 'darwin') {
      const carpeta = join(temporal, 'Programas de Peña Ñandú', 'ARKEN ANALYTICA');
      copiar(dirname(empacada), carpeta);
      ejecutable = join(carpeta, basename(empacada));
    }
    await probar(ejecutable, join(temporal, 'Datos de José Muñoz', 'ARKEN ANALYTICA'), 'Carpetas con espacios, tildes y «ñ»: ' + ejecutable);
  }
} finally {
  rmSync(temporal, { recursive: true, force: true });
}
m.terminar();
