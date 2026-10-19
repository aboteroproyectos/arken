// ARKEN ANALYTICA · genera www/, la carpeta que empaquetan Electron (Windows, macOS y Linux) y
// Capacitor (Android e iOS), a partir de programa/ARKEN_ANALYTICA.html (§6).
//
// El programa se usa tal cual: ya trae dentro sus librerías, así que no
// hay nada que bajar de internet. Solo se hacen estos cambios, y ninguno toca su lógica:
//   1. Se comprueba que no traiga datos (el bloque <script id="arken-datos"> en null).
//   2. Se agrega la capa de la app (app/arken-app.js y app/arken-app.css), antes del programa, y
//      para el celular capacitor.js.
//   3. La política de seguridad de contenido (CSP) pasa a permitir cada script en línea del
//      programa por su huella SHA-256 en lugar de 'unsafe-inline': un <script> o un atributo on…
//      que llegara a colarse en la página (el texto de un proponente sin escapar) no corre. La red
//      sigue cerrada.
//
// Uso: npm run preparar

import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROGRAMA = join(RAIZ, 'programa', 'ARKEN_ANALYTICA.html');
const WWW = join(RAIZ, 'www');
const CAPACITOR = join(RAIZ, 'node_modules', '@capacitor', 'core', 'dist', 'capacitor.js');

const fallar = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

export function preparar(html, { conCapacitor = true } = {}) {
  // 1 · Sin datos
  const datos = [...html.matchAll(/<script id="arken-datos"[^>]*>([\s\S]*?)<\/script>/g)];
  if (datos.length > 1 || (datos.length === 1 && datos[0][1].trim() !== 'null')) throw new Error('El programa trae datos embebidos: no se empaqueta. El repositorio es público.');
  const externos = html.match(/<(script|link)\b[^>]*\s(src|href)="https?:\/\/[^"]*"[^>]*>/g);
  if (externos) throw new Error('El programa carga recursos de internet:\n  ' + externos.join('\n  '));

  // 2 · Capa de la app: antes del primer script del programa
  const capa = (conCapacitor ? '<script src="vendor/capacitor.js" data-arken-app></script>\n' : '') + '<script src="app/arken-app.js" data-arken-app></script>\n';
  const i = html.search(/<script data-libreria=/);
  if (i < 0) throw new Error('No se encontraron los scripts del programa.');
  html = html.slice(0, i) + capa + html.slice(i);
  html = html.replace('</head>', '<link rel="stylesheet" href="app/arken-app.css" data-arken-app>\n</head>');

  // 3 · CSP por huellas
  const huellas = [];
  for (const [, atributos, codigo] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/\ssrc=/.test(atributos)) continue;
    const tipo = (atributos.match(/\stype="([^"]*)"/) || [])[1];
    if (tipo && !/^(text\/javascript|module)$/i.test(tipo)) continue; // bloques de datos (text/plain): no se ejecutan
    huellas.push(`'sha256-${createHash('sha256').update(codigo.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`);
  }
  const sinScripts = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
  if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(sinScripts) || /\shref\s*=\s*["']?javascript:/i.test(sinScripts)) throw new Error('El programa trae atributos on… o enlaces javascript: en su HTML; la política de la app los bloquearía.');
  const CSP = [
    "default-src 'self'",
    `script-src 'self' blob: ${huellas.join(' ')}`,
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' blob: data:",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  const reCsp = /<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
  if (!reCsp.test(html)) throw new Error('El programa no trae su política de seguridad de contenido.');
  html = html.replace(reCsp, `<meta http-equiv="Content-Security-Policy" content="${CSP}" data-arken-app>`);
  return { html, scripts: huellas.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!existsSync(PROGRAMA)) fallar('No existe programa/ARKEN_ANALYTICA.html. Ejecute npm run construir.');
  const conCapacitor = existsSync(CAPACITOR);
  let r;
  try {
    r = preparar(readFileSync(PROGRAMA, 'utf8'), { conCapacitor });
  } catch (e) {
    fallar(e.message);
  }
  rmSync(WWW, { recursive: true, force: true });
  mkdirSync(join(WWW, 'vendor'), { recursive: true });
  if (conCapacitor) copyFileSync(CAPACITOR, join(WWW, 'vendor', 'capacitor.js'));
  cpSync(join(RAIZ, 'app'), join(WWW, 'app'), { recursive: true });
  writeFileSync(join(WWW, 'index.html'), r.html);
  console.log(`✔ www/ lista: index.html (${(Buffer.byteLength(r.html) / 1048576).toFixed(2)} MB), ${r.scripts} scripts permitidos por su huella${conCapacitor ? ', con capacitor.js' : ' (sin @capacitor/core: solo escritorio)'}.`);
}
