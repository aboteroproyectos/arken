// ARKEN PRECIOS · utilidades de las pruebas en Chromium.
//
// Sirve la raíz del repositorio por http://localhost (contexto seguro, como cuando
// se abre el programa), lanza Chromium y atiende las librerías que los programas
// piden a cdnjs con las mismas versiones instaladas en node_modules: así las
// pruebas no dependen de internet.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const PRECIOS = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RAIZ = join(PRECIOS, '..');
export const RUTA_PRECIOS = '/precios/programa/ARKEN_PRECIOS.html';
export const RUTA_ARKEN = '/programa/ARKEN_CONTROL.html';

const LIBRERIAS = {
  'jspdf/2.5.1/jspdf.umd.min.js': 'jspdf/dist/jspdf.umd.min.js',
  'jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js': 'jspdf-autotable/dist/jspdf.plugin.autotable.min.js',
  'xlsx/0.18.5/xlsx.full.min.js': 'xlsx/dist/xlsx.full.min.js',
  'html2canvas/1.4.1/html2canvas.min.js': 'html2canvas/dist/html2canvas.min.js',
  'pdf.js/3.11.174/pdf.min.js': 'pdfjs-dist/build/pdf.min.js',
  'pdf.js/3.11.174/pdf.worker.min.js': 'pdfjs-dist/build/pdf.worker.min.js',
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };

/** Servidor de archivos de la raíz del repositorio. */
export async function servidor() {
  const s = createServer((req, res) => {
    const ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const archivo = normalize(join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ) || !existsSync(archivo)) {
      res.writeHead(404).end();
      return;
    }
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
      for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
        if (existsSync(join(base, d, sub))) return join(base, d, sub);
      }
    }
  }
  return undefined;
}

export async function navegador() {
  const ejecutable = rutaChromium();
  return chromium.launch(ejecutable ? { executablePath: ejecutable } : { channel: 'chrome' });
}

/** Contexto nuevo (almacenamiento propio) con las librerías locales. Sin el
    selector de «Guardar como…» del sistema: los archivos llegan como descargas. */
export async function contexto(nav, opciones = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true, ...opciones });
  await ctx.route('https://cdnjs.cloudflare.com/ajax/libs/**', (ruta) => {
    const local = LIBRERIAS[ruta.request().url().replace('https://cdnjs.cloudflare.com/ajax/libs/', '')];
    if (!local) return ruta.abort();
    return ruta.fulfill({ status: 200, contentType: 'text/javascript', body: readFileSync(join(PRECIOS, 'node_modules', local)) });
  });
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true });
  });
  return ctx;
}

/** Errores de JavaScript de la página: se revisan al final de cada prueba. */
export function vigilarErrores(pagina) {
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(e.message));
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errores.push(m.text());
  });
  return errores;
}

/* ── ARKEN PRECIOS ── */
export async function abrirPrecios(pagina, url) {
  await pagina.goto(url);
  await pagina.waitForFunction(() => document.documentElement.dataset.listo === '1', null, { timeout: 60000 });
  await pagina.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
}
export async function ingresarPrecios(pagina, usuario, clave, nuevaClave) {
  await pagina.fill('#gUser', usuario);
  await pagina.fill('#gPass', clave);
  await pagina.click('#gBtn');
  if (nuevaClave) {
    await pagina.waitForSelector('#ccA', { timeout: 30000 });
    await pagina.fill('#ccA', nuevaClave);
    await pagina.fill('#ccB', nuevaClave);
    await pagina.click('text=Guardar contraseña');
  }
  await pagina.waitForSelector('#stage .cover-hero', { timeout: 30000 });
}
/** Cierra los avisos que hayan quedado abiertos. */
export async function cerrarModales(pagina) {
  await pagina.evaluate(() => document.querySelectorAll('#modales .overlay').forEach((o) => o.remove()));
}
export async function irA(pagina, modulo) {
  await pagina.click(`#railList .nav-item[data-m="${modulo}"]`);
  await pagina.waitForFunction((m) => document.querySelector(`#railList .nav-item[data-m="${m}"].active`), modulo, { timeout: 15000 });
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
    await pagina.fill('#ccA', nuevaClave);
    await pagina.fill('#ccB', nuevaClave);
    await pagina.click('text=Cambiar y continuar');
  }
  await pagina.waitForSelector('#topbar', { state: 'visible', timeout: 30000 });
}

/* ── Resultado ── */
export function marcador(titulo) {
  let fallas = 0;
  let pruebas = 0;
  console.log('\n▸ ' + titulo);
  return {
    ok(cond, msg) {
      pruebas++;
      if (cond) console.log('  ✔ ' + msg);
      else {
        fallas++;
        console.error('  ✖ ' + msg);
      }
      return !!cond;
    },
    nota(msg) {
      console.log('    ' + msg);
    },
    get fallas() {
      return fallas;
    },
    get pruebas() {
      return pruebas;
    },
  };
}
