// ARKEN ANALYTICA · la capa de las apps (§6), en Chromium, sin Electron ni un teléfono:
//
//   · herramientas/preparar-web.mjs arma www/ con la capa antes del programa y una CSP que permite
//     cada script del programa por su huella; un script inyectado en la página no corre
//   · en un navegador normal la capa no hace nada
//   · escritorio simulado (window.arkenAnalytica): al entrar se guarda la copia del día, un ZIP
//     restaurable sin la clave de API; la clave va a la bóveda del sistema operativo
//   · Android simulado (window.Capacitor): solo consulta (tablero, procesos, comparativo, informe y
//     ayuda); lo demás queda atenuado y una acción que cambia datos se rechaza; las descargas van al
//     menú Compartir
//
// Uso: npm run prueba:app

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { ANALYTICA, servidor, navegador, contexto, vigilarErrores, ingresar, irA, marcador } from './comun.mjs';
import { preparar } from '../herramientas/preparar-web.mjs';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const m = marcador('Capa de las apps de ARKEN ANALYTICA');
const srv = await servidor();
const nav = await navegador();
const RUTA = '/analytica/www/index.html';

async function abrir(ctx, url) {
  const pg = await ctx.newPage();
  const errores = vigilarErrores(pg);
  const csp = [];
  pg.on('console', (x) => { if (/Content Security Policy|Refused to execute/i.test(x.text())) csp.push(x.text()); });
  await pg.goto(url);
  await pg.waitForSelector('#gate', { state: 'visible', timeout: 30000 });
  return { pg, errores, csp };
}

try {
  m.seccion('www/ con la capa y la política por huellas');
  const html = readFileSync(join(ANALYTICA, 'www', 'index.html'), 'utf8');
  const prog = readFileSync(join(ANALYTICA, 'programa', 'ARKEN_ANALYTICA.html'), 'utf8');
  m.ok(html === preparar(prog, { conCapacitor: html.includes('vendor/capacitor.js') }).html, 'www/index.html es el que sale del programa con preparar-web (npm run preparar)');
  const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/) || [])[1] || '';
  m.ok(/script-src 'self' blob: 'sha256-/.test(csp) && !/unsafe-inline'[^;]*;/.test(csp.split('script-src')[1].split(';')[0] + ';') && /connect-src 'self' blob: data: https:\/\/api\.anthropic\.com;/.test(csp),
    'La CSP de la app permite los scripts por su huella (sin unsafe-inline) y la red solo hacia la API de Anthropic');
  m.ok(html.indexOf('app/arken-app.js') < html.indexOf('<script data-libreria='), 'La capa se carga antes que el programa');

  m.seccion('Navegador normal');
  const c1 = await contexto(nav);
  const n1 = await abrir(c1, srv.url(RUTA));
  await ingresar(n1.pg, 'admin', 'arken', 'prueba-app-2026');
  const web = await n1.pg.evaluate(() => ({ app: window.ArkenApp || null, attr: document.documentElement.getAttribute('data-app') }));
  m.ok(!web.app && !web.attr, 'En un navegador la capa no hace nada');
  m.ok(!n1.errores.length, 'Sin errores de JavaScript con la CSP de la app' + (n1.errores.length ? ': ' + n1.errores.slice(0, 2).join(' | ') : ''));
  const inyectado = await n1.pg.evaluate(async () => { window.__corrio = false; const d = document.createElement('div'); d.innerHTML = '<img src="x" onerror="window.__corrio = true">'; document.body.appendChild(d); const s = document.createElement('script'); s.textContent = 'window.__corrio = true'; document.body.appendChild(s); await new Promise((r) => setTimeout(r, 300)); return window.__corrio; });
  m.ok(!inyectado, 'Un script o un atributo onerror inyectados en la página no corren');
  await c1.close();

  m.seccion('Escritorio simulado');
  const c2 = await contexto(nav);
  await c2.addInitScript(() => {
    const secretos = new Map(); window.__copias = [];
    window.arkenAnalytica = { version: '0.4.0', plataforma: 'windows',
      secretos: { disponible: async () => true, guardar: async (n, v, meta) => { secretos.set(n, { v, meta }); return true; }, info: async (n) => (secretos.has(n) ? secretos.get(n).meta : null), leer: async (n) => (secretos.has(n) ? secretos.get(n).v : null), borrar: async (n) => secretos.delete(n) },
      copias: { hayDeHoy: async () => window.__copias.length > 0, guardar: async (b) => { window.__copias.push(Array.from(b.slice(0, 4)).join(',') + ':' + b.length); window.__ultima = b; return { bytes: b.length }; }, abrirCarpeta: async () => true } };
  });
  const n2 = await abrir(c2, srv.url(RUTA));
  await ingresar(n2.pg, 'admin', 'arken', 'prueba-app-2026');
  await n2.pg.waitForFunction(() => window.__copias.length === 1, null, { timeout: 60000 });
  const copia = await n2.pg.evaluate(async () => { await ClaveIA.guardar('sk-ant-prueba-' + 'y'.repeat(30), true); const b = window.__ultima; let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return { b64: btoa(s), app: window.ArkenApp, enIDB: await Almacen.secreto('clave-ia'), estado: ClaveIA.estado() }; });
  const zip = await JSZip.loadAsync(Buffer.from(copia.b64, 'base64'));
  m.ok(!!zip.file('manifiesto.json') && JSON.parse(await zip.file('manifiesto.json').async('string')).formato === 'ARKEN-ANALYTICA-RESPALDO', 'Al entrar se guarda la copia del día: un respaldo completo y restaurable');
  m.ok(copia.app.plataforma === 'windows' && !copia.app.soloConsulta, 'En el computador el programa hace todo (no es solo consulta)');
  m.ok(copia.estado.donde === 'equipo' && copia.estado.escritorio && !copia.enIDB, 'La clave de API va a la bóveda del sistema operativo, no a la base del navegador');
  const aud = await n2.pg.evaluate(() => Auditoria.lista().filter((a) => a.objeto === 'respaldo').length);
  m.ok(aud === 0, 'La copia del día no llena la auditoría');
  m.ok(!n2.errores.length, 'Sin errores de JavaScript' + (n2.errores.length ? ': ' + n2.errores.slice(0, 2).join(' | ') : ''));
  await c2.close();

  m.seccion('Android simulado: solo consulta');
  const c3 = await contexto(nav);
  await c3.addInitScript(() => {
    // El capacitor.js de www/ decide la plataforma por el puente nativo (window.androidBridge) y
    // conserva los Plugins que ya existan: aquí, el sistema de archivos y Compartir simulados.
    window.__compartido = []; const arch = new Map();
    window.androidBridge = { postMessage: () => {} };
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', registerPlugin: (n) => window.Capacitor.Plugins[n],
      Plugins: { Filesystem: { writeFile: async (o) => { arch.set(o.path, o.data.length); }, appendFile: async (o) => { arch.set(o.path, arch.get(o.path) + o.data.length); }, getUri: async (o) => ({ uri: 'file:///cache/' + o.path }) },
        Share: { share: async (o) => { window.__compartido.push(o.files[0]); } } } };
  });
  const n3 = await abrir(c3, srv.url(RUTA));
  await ingresar(n3.pg, 'admin', 'arken', 'prueba-app-2026');
  const movil = await n3.pg.evaluate(() => ({ consulta: Permisos.soloConsulta(), off: Array.from(document.querySelectorAll('#railList .nav-item.off')).map((b) => b.dataset.m), attr: document.documentElement.getAttribute('data-app') }));
  const atenuados = ['02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14'];
  m.ok(movil.consulta && movil.attr === 'android' && atenuados.every((x) => movil.off.includes(x)) && !['01', '17'].some((x) => movil.off.includes(x)), 'Solo consulta: del 02 al 14 atenuados; procesos, tablero, comparativo, informe y ayuda disponibles');
  await n3.pg.click('#railList .nav-item[data-m="11"]');
  m.ok(await n3.pg.evaluate(() => Sesion.modulo !== '11'), 'Tocar un módulo de trabajo no lo abre');
  const rechazo = await n3.pg.evaluate(async () => { try { await Modelo.crearProceso({ codigo: 'X-1', nombre: 'x' }); return 'creó'; } catch (e) { return e.message; } });
  m.ok(/solo consulta/.test(rechazo), 'Crear un proceso desde el celular se rechaza: ' + rechazo);
  await n3.pg.evaluate(() => UI.descargar('ARKEN_ANALYTICA_prueba.pdf', new Blob(['%PDF-1.4 prueba'], { type: 'application/pdf' })));
  await n3.pg.waitForFunction(() => window.__compartido.length === 1);
  m.ok((await n3.pg.evaluate(() => window.__compartido[0])).endsWith('exportados/ARKEN_ANALYTICA_prueba.pdf'), 'Lo que se descarga se abre en el menú Compartir del teléfono');
  m.ok(!n3.errores.length, 'Sin errores de JavaScript' + (n3.errores.length ? ': ' + n3.errores.slice(0, 2).join(' | ') : ''));
  await c3.close();
} catch (e) {
  m.ok(false, 'La prueba se detuvo: ' + e.message);
  console.error(e);
} finally {
  await nav.close();
  await srv.cerrar();
}
m.terminar();
