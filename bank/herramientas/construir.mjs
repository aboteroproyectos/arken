// ARKEN BANK · ensambla el programa en un solo HTML.
//
// El código vive en bank/fuente/ (núcleo de cálculo, que también corre en Node para las
// pruebas, y la interfaz). Este ensamblador los une, en orden de nombre de archivo, con las
// librerías de node_modules incrustadas para que el programa funcione sin internet —también la
// lectura de PDF (pdf.js) y el reconocimiento de texto en español (Tesseract)— y escribe
// bank/programa/ARKEN_BANK.html.
//
//   node herramientas/construir.mjs              escribe el programa
//   node herramientas/construir.mjs --comprobar  falla si el programa del repositorio no es
//                                                idéntico al que sale de fuente/ (CI)
//
// El programa nunca lleva datos: el bloque <script id="arken-datos"> queda en null y
// ../herramientas/verificar-sin-datos.mjs lo comprueba.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = join(RAIZ, 'fuente');
const SALIDA = join(RAIZ, 'programa', 'ARKEN_BANK.html');
const MODULOS = join(RAIZ, 'node_modules');
const LOGO = join(RAIZ, '..', 'recursos', 'logo-original.png');
const VERSION = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;

/* Las mismas librerías y versiones que ARKEN CONTROL y ARKEN ANALYTICA, más Tesseract 5.1.1 para el OCR. */
const LIBRERIAS = [
  ['jspdf', 'dist/jspdf.umd.min.js', '2.5.1'],
  ['jspdf-autotable', 'dist/jspdf.plugin.autotable.min.js', '3.8.2'],
  ['jszip', 'dist/jszip.min.js', '3.10.1'],
  ['pdfjs-dist', 'build/pdf.min.js', '3.11.174'],
  ['tesseract.js', 'dist/tesseract.min.js', '5.1.1']
];
/* Lo que se carga como blob dentro del programa: el worker de pdf.js, el worker y el núcleo
   WebAssembly de Tesseract (LSTM con SIMD) y el modelo del español (4.0.0_best_int). */
const BLOBS = [
  ['pdfjs-worker', 'pdfjs-dist', 'build/pdf.worker.min.js', '3.11.174'],
  ['ocr-worker', 'tesseract.js', 'dist/worker.min.js', '5.1.1'],
  ['ocr-core', 'tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js', '5.1.1'],
  ['ocr-spa', '@tesseract.js-data/spa', '4.0.0_best_int/spa.traineddata.gz', '1.0.0']
];

/* Content Security Policy: scripts y estilos solo los del propio archivo; workers e imágenes
   desde blob: o data:; WebAssembly para el OCR. Nada sale a la red. */
const CSP = [
  "default-src 'none'", "script-src 'unsafe-inline' 'wasm-unsafe-eval' blob:", "style-src 'unsafe-inline'", "img-src data: blob:",
  "font-src data:", "worker-src blob:", "connect-src blob: data:", "frame-src blob:", "object-src 'none'", "base-uri 'none'", "form-action 'none'"
].join('; ');

function leer(ruta) { return readFileSync(ruta, 'utf8'); }
function archivos(carpeta) { return readdirSync(carpeta).filter((n) => n.endsWith('.js')).sort(); }
/** Dentro de <script>, «</script» cerraría el bloque antes de tiempo. */
function seguro(js) { return js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'); }
function version(nombre, esperada) {
  const pkg = JSON.parse(leer(join(MODULOS, nombre, 'package.json')));
  if (pkg.version !== esperada) throw new Error(`${nombre} debe ser ${esperada} y node_modules trae ${pkg.version}. Ejecute npm ci.`);
}
function libreria([nombre, ruta, v]) {
  version(nombre, v);
  return `<script data-libreria="${nombre}@${v}">\n${seguro(leer(join(MODULOS, nombre, ruta)))}\n</script>`;
}
function blob([id, nombre, ruta, v]) {
  version(nombre, v);
  return `<script id="${id}" type="text/plain" data-libreria="${nombre}@${v}">${readFileSync(join(MODULOS, nombre, ruta)).toString('base64')}</script>`;
}
function fuentes(carpeta) {
  return archivos(join(FUENTE, carpeta)).map((n) => `/* ─── fuente/${carpeta}/${n} ─── */\n` + leer(join(FUENTE, carpeta, n))).join('\n');
}

export function construir() {
  const logo = 'data:image/png;base64,' + readFileSync(LOGO).toString('base64');
  const css = leer(join(FUENTE, 'estilos-arken.css')) + '\n' + leer(join(FUENTE, 'estilos-ayuda.css')) + '\n' + leer(join(FUENTE, 'estilos.css'));
  return `<!DOCTYPE html>
<html lang="es" data-density="normal" data-tema="claro"><head>
<!--
  ARKEN BANK ${VERSION} · Análisis de créditos bancarios
  De la familia ARKEN 360: mismo sistema visual que ARKEN CONTROL y ARKEN
  ANALYTICA. Un solo archivo HTML que funciona abierto desde el disco y sin
  internet. No edite este archivo: se arma desde bank/fuente/ con
  «npm run construir».
-->
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-title" content="ARKEN BANK">
<meta name="theme-color" content="#16181A">
<meta name="arken-bank-version" content="${VERSION}">
<link rel="icon" href="${logo}">
<title>ARKEN BANK — Análisis de créditos</title>
<style>
${css}
</style>
</head>
<body>
${leer(join(FUENTE, 'cuerpo.html')).replaceAll('{{LOGO}}', logo)}
${LIBRERIAS.map(libreria).join('\n')}
${BLOBS.map(blob).join('\n')}
<script>
"use strict";
${seguro(fuentes('nucleo'))}
${seguro(fuentes('app').replaceAll('{{LOGO}}', logo).replaceAll('{{VERSION}}', VERSION))}
</script>
</body>
</html>
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = construir();
  if (process.argv.includes('--comprobar')) {
    if (!existsSync(SALIDA) || leer(SALIDA) !== html) {
      console.error('✖ programa/ARKEN_BANK.html no corresponde a fuente/. Ejecute «npm run construir» y suba el resultado.');
      process.exit(1);
    }
    console.log('✔ programa/ARKEN_BANK.html corresponde a fuente/.');
  } else {
    mkdirSync(dirname(SALIDA), { recursive: true });
    writeFileSync(SALIDA, html);
    console.log(`✔ programa/ARKEN_BANK.html (${(html.length / 1048576).toFixed(2)} MB, versión ${VERSION})`);
  }
}
