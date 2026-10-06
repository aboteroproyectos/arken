// ARKEN PRECIOS · genera www/, la carpeta que empaquetan Electron (Windows, macOS y Linux) y
// Capacitor (Android e iOS), a partir de programa/ARKEN_PRECIOS.html.
//
// El programa se usa tal cual. Solo se hacen estos cambios, y ninguno toca su lógica:
//   1. Se quitan los datos embebidos, si los hubiera: la app arranca vacía y cada equipo
//      carga los suyos desde un respaldo.
//   2. Las librerías que el programa trae de cdnjs se sirven desde la app, así funciona sin
//      internet. Se comprueba que cada una sea la misma versión que pide el programa.
//   3. Se agrega la capa de la app (app/precios-app.js y app/precios-app.css).
//   4. Se agrega la política de seguridad de contenido (CSP, §16): la app solo ejecuta sus
//      propios scripts. Los del programa van en línea y se permiten por su huella SHA-256.
// El núcleo del programa queda igual: el motor de la app de escritorio lo lee de www/index.html.
//
// Uso: npm run preparar

import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROGRAMA = join(RAIZ, 'programa', 'ARKEN_PRECIOS.html');
const WWW = join(RAIZ, 'www');

// Librerías que el programa carga desde cdnjs: el archivo equivalente en node_modules y su paquete.
// Si una versión nueva del programa cambia alguna, agréguela aquí y en package.json.
const LIBRERIAS = {
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js': ['jspdf', '2.5.1', 'node_modules/jspdf/dist/jspdf.umd.min.js'],
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js': [
    'jspdf-autotable',
    '3.8.2',
    'node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js',
  ],
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js': ['xlsx', '0.18.5', 'node_modules/xlsx/dist/xlsx.full.min.js'],
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js': ['pdfjs-dist', '3.11.174', 'node_modules/pdfjs-dist/build/pdf.min.js'],
};
// Archivos de apoyo que no aparecen como <script> en el programa.
const APOYO = {
  'pdf.worker.min.js': ['pdfjs-dist', '3.11.174', 'node_modules/pdfjs-dist/build/pdf.worker.min.js'],
  'capacitor.js': ['@capacitor/core', null, 'node_modules/@capacitor/core/dist/capacitor.js'],
};

const avisos = [];
const fallar = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

if (!existsSync(PROGRAMA)) fallar('No existe programa/ARKEN_PRECIOS.html.');
let html = readFileSync(PROGRAMA, 'utf8');
const original = html;

// 1 · Datos embebidos fuera
const reDatos = /(<script id="arken-precios-datos" type="application\/json">)([\s\S]*?)(<\/script>)/g;
const contenedores = [...html.matchAll(reDatos)];
if (contenedores.length !== 1) {
  fallar(`Se esperaba un solo contenedor de datos <script id="arken-precios-datos"> y hay ${contenedores.length}.`);
}
const datos = contenedores[0][2].trim();
if (datos !== '' && datos !== 'null') {
  avisos.push(
    `El programa traía ${(datos.length / 1048576).toFixed(1)} MB de datos embebidos. Se quitaron de la app, ` +
      'pero el archivo programa/ARKEN_PRECIOS.html no debe subirse con datos: el repositorio es público.',
  );
}
html = html.replace(reDatos, '$1null$3');

// 2 · Librerías locales, con la misma versión que pide el programa
for (const [paquete, version, archivo] of [...Object.values(LIBRERIAS), ...Object.values(APOYO)]) {
  if (!existsSync(join(RAIZ, archivo))) fallar(`Falta ${archivo}. Ejecute npm ci.`);
  const instalada = JSON.parse(readFileSync(join(RAIZ, 'node_modules', paquete, 'package.json'), 'utf8')).version;
  if (version && instalada !== version) fallar(`El programa usa ${paquete} ${version} y está instalada la ${instalada}. Revise package.json.`);
}
const reCdn = /<script src="(https:\/\/cdnjs\.cloudflare\.com\/[^"]+)"><\/script>/g;
const desconocidas = [];
let ultimaLibreria = -1;
html = html.replace(reCdn, (etiqueta, url, pos) => {
  if (!LIBRERIAS[url]) {
    desconocidas.push(url);
    return etiqueta;
  }
  ultimaLibreria = pos;
  return `<script src="vendor/${basename(LIBRERIAS[url][2])}" data-cdn="${url}"></script>`;
});
if (desconocidas.length) {
  fallar(
    'El programa usa librerías que la app no conoce todavía:\n  ' +
      desconocidas.join('\n  ') +
      '\nAgréguelas en herramientas/preparar-web.mjs (LIBRERIAS) y en package.json.',
  );
}
const externos = html.match(/<(script|link)\b[^>]*\s(src|href)="https?:\/\/[^"]*"[^>]*>/g);
if (externos) fallar('El programa carga recursos de internet que la app no puede servir:\n  ' + externos.join('\n  '));
if (ultimaLibreria < 0) fallar('No se encontraron las etiquetas <script> de las librerías.');

// 3 · Capa de la app: se carga después de las librerías y antes del programa
const reUltimaLibreria = /(<script src="vendor\/[^"]+" data-cdn="[^"]+"><\/script>)(?![\s\S]*<script src="vendor\/)/;
html = html.replace(
  reUltimaLibreria,
  '$1\n<script src="vendor/capacitor.js" data-precios-app></script>\n<script src="app/precios-app.js" data-precios-app></script>',
);
if (!html.includes('</head>')) fallar('El programa no tiene </head>.');
html = html.replace('</head>', '<link rel="stylesheet" href="app/precios-app.css" data-precios-app>\n</head>');

// El núcleo que lee el motor de escritorio debe ser el mismo del programa
const nucleo = (t) => (t.match(/<script id="arken-precios-nucleo">[\s\S]*?<\/script>/) || [''])[0];
if (!nucleo(original) || nucleo(html) !== nucleo(original)) fallar('El núcleo del programa cambió al preparar la app.');
if (html.indexOf('<script src="app/precios-app.js"') > html.indexOf('<script id="arken-precios-nucleo">')) {
  fallar('La capa de la app quedó después del programa: debe cargarse antes.');
}

// 4 · Política de seguridad de contenido (§16). Cada script en línea del programa se permite por
//     su huella: un <script> o un atributo on… que llegara a colarse en la página (por ejemplo,
//     desde el texto de un sitio que no se escapó) no corre. Los estilos en línea sí se permiten:
//     el programa los usa en todas partes y no ejecutan código. La red queda abierta a https
//     porque la dirección del servidor de recolección la escribe el usuario (y la API de Claude
//     es https), y a este mismo equipo para un servidor local.
const huellas = [];
for (const [, atributos, codigo] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
  if (/\ssrc=/.test(atributos)) continue;
  const tipo = (atributos.match(/\stype="([^"]*)"/) || [])[1];
  if (tipo && !/^(text\/javascript|module)$/i.test(tipo)) continue; // bloques de datos (application/json): no se ejecutan
  huellas.push(`'sha256-${createHash('sha256').update(codigo.replace(/\r\n?/g, '\n'), 'utf8').digest('base64')}'`);
}
if (!huellas.length) fallar('No se encontraron los scripts en línea del programa.');
const sinScripts = html.replace(/<script\b[\s\S]*?<\/script>/g, '');
if (/<[a-z][^>]*\son[a-z]+\s*=/i.test(sinScripts) || /\shref\s*=\s*["']?javascript:/i.test(sinScripts)) {
  fallar('El programa trae atributos on… o enlaces javascript: en su HTML. La política de seguridad de la app los bloquearía: páselos a código.');
}
const CSP = [
  "default-src 'self'",
  `script-src 'self' ${huellas.join(' ')}`,
  "worker-src 'self' blob:", // el tablero calcula en un Web Worker creado desde el núcleo
  "child-src 'self' blob:", // lo mismo, para los WebView que no conocen worker-src
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:* data: blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');
const reCharset = /<meta charset="utf-8">/i;
if (!reCharset.test(html)) fallar('El programa no tiene <meta charset="utf-8">.');
html = html.replace(reCharset, (m) => `${m}\n<meta http-equiv="Content-Security-Policy" content="${CSP}" data-precios-app>`);
if (html.search(/<meta http-equiv="Content-Security-Policy"/) > html.search(/<script\b/)) fallar('La política de seguridad quedó después de un script.');

// Salida
rmSync(WWW, { recursive: true, force: true });
mkdirSync(join(WWW, 'vendor'), { recursive: true });
for (const [, , archivo] of [...Object.values(LIBRERIAS), ...Object.values(APOYO)]) copyFileSync(join(RAIZ, archivo), join(WWW, 'vendor', basename(archivo)));
cpSync(join(RAIZ, 'app'), join(WWW, 'app'), { recursive: true });
writeFileSync(join(WWW, 'index.html'), html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`✔ www/ lista: index.html (${kb} KB), ${Object.keys(LIBRERIAS).length + Object.keys(APOYO).length} librerías locales, ${huellas.length} scripts permitidos por su huella.`);
for (const a of avisos) console.warn('⚠ ' + a);
