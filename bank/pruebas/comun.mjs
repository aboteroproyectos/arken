// ARKEN BANK · utilidades de las pruebas.
//
// · nucleo(): carga fuente/nucleo/*.js en un contexto de Node, en el mismo orden en que los une
//   herramientas/construir.mjs, para probar el código del programa sin copias.
// · servidor(), navegador(): sirven la raíz del repositorio por http://localhost (contexto
//   seguro, como cuando se abre el programa) y lanzan Chromium.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { chromium } from 'playwright-core';

export const BANK = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RAIZ = join(BANK, '..');
export const RUTA_BANK = '/bank/programa/ARKEN_BANK.html';

/** El núcleo del programa, listo para usar desde Node. */
export function nucleo() {
  const carpeta = join(BANK, 'fuente', 'nucleo');
  const codigo = readdirSync(carpeta).filter((n) => n.endsWith('.js')).sort().map((n) => readFileSync(join(carpeta, n), 'utf8')).join('\n');
  const ctx = vm.createContext({ crypto: webcrypto, Intl, console, TextEncoder, TextDecoder, btoa, atob, URL });
  vm.runInContext(codigo + '\n;this.N = { Util, Cripto, Catalogo, Bancos, Lector, Motor, Coherencia, Concepto, Demo };', ctx);
  return ctx.N;
}

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

let fallas = 0;
export function afirmar(cond, msg) { if (cond) console.log('  ✔ ' + msg); else { fallas++; console.error('  ✖ ' + msg); } }
export function igual(a, b, msg) { afirmar(a === b, msg + (a === b ? '' : ` (esperado ${JSON.stringify(b)}, salió ${JSON.stringify(a)})`)); }
export function terminar(nombre) {
  if (fallas){ console.error(`✖ ${nombre}: ${fallas} falla(s)`); process.exit(1); }
  console.log(`✔ ${nombre}`);
}
