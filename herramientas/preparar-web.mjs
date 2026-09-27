// ARKEN CONTROL · genera www/, la carpeta que empaquetan Capacitor (Android, iOS)
// y Electron (Windows, macOS), a partir de programa/ARKEN_CONTROL.html.
//
// El programa se usa tal cual. Solo se hacen estos cambios, y ninguno toca su lógica:
//   1. Se quitan los datos embebidos, si los hubiera: la app arranca vacía y cada
//      equipo carga los suyos desde un respaldo.
//   2. Las librerías que el programa trae de cdnjs se sirven desde la app, así
//      funciona sin internet.
//   3. Se agrega la capa de la app (app/arken-app.js y app/arken-app.css).
//   4. La impresión de documentos pasa por la capa de la app. En el celular sale
//      el PDF del documento, porque ahí la impresión del navegador no existe.
//
// Uso: npm run preparar

import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROGRAMA = join(RAIZ, 'programa', 'ARKEN_CONTROL.html');
const WWW = join(RAIZ, 'www');

// Librerías que el programa carga desde cdnjs y el archivo equivalente en node_modules.
// Si una versión nueva del programa cambia alguna, agréguela aquí y en package.json.
const LIBRERIAS = {
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js': 'node_modules/jspdf/dist/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js':
    'node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js': 'node_modules/xlsx/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js': 'node_modules/html2canvas/dist/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js': 'node_modules/pdfjs-dist/build/pdf.min.js',
};
// Archivos de apoyo que no aparecen como <script> en el programa.
const APOYO = {
  'pdf.worker.min.js': 'node_modules/pdfjs-dist/build/pdf.worker.min.js',
  'capacitor.js': 'node_modules/@capacitor/core/dist/capacitor.js',
};

const avisos = [];
const fallar = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

if (!existsSync(PROGRAMA)) fallar('No existe programa/ARKEN_CONTROL.html.');
let html = readFileSync(PROGRAMA, 'utf8');

// 1 · Datos embebidos fuera
const reDatos = /(<script id="arken-datos" type="application\/json">)([\s\S]*?)(<\/script>)/g;
const contenedores = [...html.matchAll(reDatos)];
if (contenedores.length !== 1) {
  fallar(`Se esperaba un solo contenedor de datos <script id="arken-datos"> y hay ${contenedores.length}.`);
}
const datos = contenedores[0][2].trim();
if (datos !== '' && datos !== 'null') {
  avisos.push(
    `El programa traía ${(datos.length / 1048576).toFixed(1)} MB de datos embebidos. Se quitaron de la app, ` +
      'pero el archivo programa/ARKEN_CONTROL.html no debe subirse con datos: el repositorio es público.',
  );
}
html = html.replace(reDatos, '$1null$3');

// 2 · Librerías locales
const reCdn = /<script src="(https:\/\/cdnjs\.cloudflare\.com\/[^"]+)"><\/script>/g;
const desconocidas = [];
let ultimaLibreria = -1;
html = html.replace(reCdn, (etiqueta, url, pos) => {
  if (!LIBRERIAS[url]) {
    desconocidas.push(url);
    return etiqueta;
  }
  ultimaLibreria = pos;
  return `<script src="vendor/${basename(LIBRERIAS[url])}" data-cdn="${url}"></script>`;
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
  '$1\n<script src="vendor/capacitor.js" data-arken-app></script>\n<script src="app/arken-app.js" data-arken-app></script>',
);
if (!html.includes('</head>')) fallar('El programa no tiene </head>.');
html = html.replace('</head>', '<link rel="stylesheet" href="app/arken-app.css" data-arken-app>\n</head>');

// 4 · Impresión de documentos: la capa de la app recibe el documento completo
const impresion = 'setTimeout(() => { window.print(); }, 120);';
const vecesImpresion = html.split(impresion).length - 1;
if (vecesImpresion === 1) {
  html = html.replace(impresion, 'setTimeout(() => { (window.ARKEN_IMPRIMIR || window.print).call(window, cfg); }, 120);');
} else {
  avisos.push(
    'No se encontró la llamada de impresión de imprimirHTML(). En el celular, «Imprimir» usará la copia en imagen ' +
      'del documento en lugar del PDF.',
  );
}

// Salida
rmSync(WWW, { recursive: true, force: true });
mkdirSync(join(WWW, 'vendor'), { recursive: true });
for (const origen of [...Object.values(LIBRERIAS), ...Object.values(APOYO)]) {
  const ruta = join(RAIZ, origen);
  if (!existsSync(ruta)) fallar(`Falta ${origen}. Ejecute npm install.`);
  copyFileSync(ruta, join(WWW, 'vendor', basename(origen)));
}
cpSync(join(RAIZ, 'app'), join(WWW, 'app'), { recursive: true });
writeFileSync(join(WWW, 'index.html'), html);

const kb = (Buffer.byteLength(html) / 1024).toFixed(0);
console.log(`✔ www/ lista: index.html (${kb} KB), ${Object.keys(LIBRERIAS).length + Object.keys(APOYO).length} librerías locales.`);
for (const a of avisos) console.warn('⚠ ' + a);
