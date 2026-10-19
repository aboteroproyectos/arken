// ARKEN ANALYTICA · utilidades de las pruebas.
//
// · nucleo(): carga fuente/nucleo/*.js en un contexto de Node, en el mismo orden en que
//   los une herramientas/construir.mjs, para probar el código del programa sin copias.
// · servidor(), navegador(), contexto(): sirven la raíz del repositorio por
//   http://localhost (contexto seguro, como cuando se abre el programa) y lanzan
//   Chromium. ARKEN CONTROL pide sus librerías a cdnjs: se le entregan las mismas
//   versiones de node_modules, para que las pruebas no dependan de internet.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { chromium } from 'playwright-core';

export const ANALYTICA = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RAIZ = join(ANALYTICA, '..');
export const RUTA_ANALYTICA = '/analytica/programa/ARKEN_ANALYTICA.html';
export const RUTA_ARKEN = '/programa/ARKEN_CONTROL.html';
const require = createRequire(import.meta.url);
export const XLSX = require('xlsx');

/** El núcleo del programa, listo para usar desde Node. */
export function nucleo() {
  const leerCarpeta = (c) => { const carpeta = join(ANALYTICA, 'fuente', c); return readdirSync(carpeta).filter((n) => n.endsWith('.js')).sort().map((n) => readFileSync(join(carpeta, n), 'utf8')).join('\n'); };
  const codigo = leerCarpeta('nucleo') + '\n' + leerCarpeta('evaluacion');
  const ctx = vm.createContext({ crypto: webcrypto, Intl, console, XLSX, TextEncoder, TextDecoder, btoa, atob, URL });
  vm.runInContext(codigo + '\n;this.N = { Util, Calculo, Nit, Festivos, ExcelArken, ExcelPrecios, Parametros, PlantillaCondiciones, Confidencialidad, Cronograma, Revision, Cripto, Pliego, Demo, Paquete, Sobre, Adendas, Actas, Estadistica, Presupuestal, Tecnico, Puntaje, Alertas, Motor, DemoOfertas };', ctx);
  return ctx.N;
}

const LIBRERIAS = {
  'jspdf/2.5.1/jspdf.umd.min.js': 'jspdf/dist/jspdf.umd.min.js',
  'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js': 'jspdf-autotable/dist/jspdf.plugin.autotable.min.js',
  'xlsx/0.18.5/xlsx.full.min.js': 'xlsx/dist/xlsx.full.min.js',
  'pdf.js/3.11.174/pdf.min.js': 'pdfjs-dist/build/pdf.min.js',
  'pdf.js/3.11.174/pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js',
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

export async function servidor() {
  const s = createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ) || !existsSync(archivo)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] || 'application/octet-stream' });
    res.end(readFileSync(archivo));
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  const base = `http://localhost:${s.address().port}`;
  return { url: (ruta) => base + ruta, cerrar: () => new Promise((r) => s.close(r)) };
}

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
export async function navegador() {
  const ejecutable = rutaChromium();
  return chromium.launch(ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' });
}
/** Contexto nuevo, con almacenamiento propio y las librerías locales para ARKEN CONTROL.
    ANALYTICA no pide nada a la red: cualquier petición fuera de localhost se registra. */
export async function contexto(nav, opciones = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true, ...opciones });
  ctx.peticionesExternas = [];
  await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/**', (ruta) => {
    const local = LIBRERIAS[ruta.request().url().replace('https://cdnjs.cloudflare.com/ajax/libs/', '')];
    if (!local) return ruta.abort();
    return ruta.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(join(ANALYTICA, 'node_modules', local)) });
  });
  ctx.on('request', (r) => { const u = r.url(); if (!/^(http:\/\/localhost|blob:|data:|https:\/\/cdnjs\.cloudflare\.com)/.test(u)) ctx.peticionesExternas.push(u); });
  await ctx.addInitScript(() => { Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true }); });
  return ctx;
}
export function vigilarErrores(pagina) {
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text()); });
  return errores;
}

/* ── ARKEN ANALYTICA ── */
export async function abrirAnalytica(pagina, url) {
  await pagina.goto(url);
  await pagina.waitForSelector('#gBtn:not([disabled])', { timeout: 60000 });
}
async function esperarFoco(pagina, id) {
  await pagina.waitForFunction((i) => document.activeElement && document.activeElement.id === i, id, { timeout: 5000 }).catch(() => {});
}
export async function ingresar(pagina, usuario, clave, nuevaClave) {
  await pagina.fill('#gUser', usuario);
  await pagina.fill('#gPass', clave);
  await pagina.click('#gBtn');
  if (nuevaClave) {
    await pagina.waitForSelector('#ccA', { timeout: 60000 });
    await esperarFoco(pagina, 'ccA');
    await pagina.fill('#ccA', nuevaClave);
    await pagina.fill('#ccB', nuevaClave);
    await pagina.click('text=Cambiar y continuar');
  }
  await pagina.waitForSelector('#stage .page-head', { timeout: 60000 });
}
export async function irA(pagina, modulo) {
  await pagina.click(`#railList .nav-item[data-m="${modulo}"]`);
  await pagina.waitForFunction((m) => document.querySelector(`#railList .nav-item[data-m="${m}"].active`), modulo, { timeout: 15000 });
}
export async function pestana(pagina, id) {
  await pagina.click(`#stage [data-pestana][data-id="${id}"]`);
  await pagina.waitForSelector(`#stage [data-pestana][data-id="${id}"].active`);
}
/** Botón del modal visible con ese texto exacto. */
export async function botonModal(pagina, texto) {
  await pagina.locator('#modales .overlay').last().locator('.modal-foot button', { hasText: texto }).click();
}
export async function cerrarModales(pagina) {
  await pagina.evaluate(() => document.querySelectorAll('#modales .overlay').forEach((o) => o.remove()));
}

/** Un proceso de demostración emitido, listo para la Fase 2: usuarios abogada, comite1 y comite2
    (contraseña «clave-<usuario>-2026»), un documento, el acuerdo aprobado, llaves con respaldo y el pliego. */
export async function prepararEmitido(pagina, FRASE) {
  return pagina.evaluate(async ({ FRASE }) => {
  const yo = Sesion.usuario;
  for (const [usuario, nombre, roles] of [['abogada', 'Abogada de prueba', ['juridico']], ['comite1', 'Comité uno', ['comite']], ['comite2', 'Comité dos', ['comite']]]) {
    await Usuarios.guardar({ usuario, nombre, cargo: 'Prueba', roles }, 'clave-' + usuario + '-2026');
  }
  const p = await Modelo.cargarDemo();
  App.abrirProceso(p.id, '07');
  // Un documento del proceso: un PDF de planos.
  const doc = new window.jspdf.jsPDF(); doc.text('Planos arquitectónicos · DEMOSTRACIÓN', 20, 20);
  const f = new File([doc.output('blob')], 'Planos_arquitectonicos.pdf', { type: 'application/pdf' });
  const r = await Archivos.guardar(f);
  await Modelo.guardarDocumento({ id: Util.uid('dp'), procesoId: p.id, demo: true, nombre: f.name, clase: 'Planos', disciplina: 'Arquitectura', descripcion: 'Planos de la demostración',
    sha256: r.sha256, peso: f.size, version: 1, vigente: true }, 'prueba');
  // El abogado aprueba el acuerdo.
  Sesion.usuario = S.usuarios.find((u) => u.usuario === 'abogada');
  try { await Modelo.aprobarConfidencialidad(p, { nombre: 'Abogada de prueba', tarjetaProfesional: '000000 del C. S. de la J.', fecha: Util.hoyISO() }); }
  finally { Sesion.usuario = yo; }
  await Modelo.crearLlaves(p, FRASE);
  await Modelo.marcarRespaldoLlaves(p, 'descargado'); await Modelo.marcarRespaldoLlaves(p, 'confirmado');
  await Documentos.pdfPliego(p);
  p.pliego.revisado = true; await Modelo.guardarProceso(p, 'revisado');
  const rojo = Modelo.revision(p).filter((x) => !x.ok).map((x) => x.texto);
  if (!rojo.length) await Modelo.emitir(p);
  const pres = Modelo.presupuesto(p.id), t = Calculo.totales(pres);
  return { id: p.id, codigo: p.codigo, rojo, estado: p.estado, envios: p.confidencialidad.envios,
    precios: pres.insumos.map((i) => Util.money3(i.precio)).concat([t.total, t.costoDirecto, t.aiu].map(Util.money)),
    preciosCrudos: pres.insumos.map((i) => i.precio).filter((x) => x >= 1000).map(String),
    invitados: Modelo.invitados(p.id).map((i) => ({ id: i.id, razonSocial: i.razonSocial, codigo: i.codigoInvitacion })) };
  }, { FRASE });
}

/* ── ARKEN CONTROL ── */
export async function abrirArken(pagina, url) {
  await pagina.goto(url);
  await pagina.waitForSelector('#gate', { state: 'visible', timeout: 30000 });
  await pagina.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
}
export async function ingresarArken(pagina, usuario, clave, nuevaClave) {
  await pagina.fill('#gUser', usuario);
  await pagina.fill('#gPass', clave);
  await pagina.click('#gBtn');
  if (nuevaClave) {
    await pagina.waitForSelector('#ccA', { timeout: 30000 });
    await esperarFoco(pagina, 'ccA');
    await pagina.fill('#ccA', nuevaClave);
    await pagina.fill('#ccB', nuevaClave);
    await pagina.click('text=Cambiar y continuar');
  }
  await pagina.waitForSelector('#topbar', { state: 'visible', timeout: 30000 });
}

/* ── Resultado ── */
export function marcador(titulo) {
  let fallas = 0, pruebas = 0;
  console.log('\n▸ ' + titulo);
  return {
    ok(cond, msg) { pruebas++; if (cond) console.log('  ✔ ' + msg); else { fallas++; console.error('  ✖ ' + msg); } return !!cond; },
    seccion(t) { console.log('\n  · ' + t); },
    nota(msg) { console.log('    ' + msg); },
    terminar() {
      console.log(`\n${pruebas - fallas} de ${pruebas} comprobaciones pasaron.`);
      if (fallas) process.exitCode = 1;
    },
    get fallas() { return fallas; },
  };
}
