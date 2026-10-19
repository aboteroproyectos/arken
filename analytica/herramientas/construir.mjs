// ARKEN ANALYTICA · ensambla el programa principal en un solo HTML.
//
// El código vive en analytica/fuente/ (núcleo de cálculo, que también corre en Node para
// las pruebas, y la interfaz). Este ensamblador los une, en orden de nombre de archivo,
// con las librerías de node_modules incrustadas para que el programa funcione sin
// internet, y escribe analytica/programa/ARKEN_ANALYTICA.html.
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
const SALIDA = join(RAIZ, 'programa', 'ARKEN_ANALYTICA.html');
const MODULOS = join(RAIZ, 'node_modules');
const LOGO = join(RAIZ, '..', 'recursos', 'logo-original.png');
const VERSION = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;

/* Las mismas librerías y versiones que ARKEN CONTROL, más JSZip 3.10.1 (§6). */
const LIBRERIAS = [
  ['jspdf', 'dist/jspdf.umd.min.js', '2.5.1'],
  ['jspdf-autotable', 'dist/jspdf.plugin.autotable.min.js', '3.8.2'],
  ['xlsx', 'dist/xlsx.full.min.js', '0.18.5'],
  ['jszip', 'dist/jszip.min.js', '3.10.1'],
  ['pdfjs-dist', 'build/pdf.min.js', '3.11.174']
];

/* Content Security Policy (§24): nada sale a la red; scripts y estilos solo los del
   propio archivo; workers e imágenes desde blob: o data:. */
const CSP = [
  "default-src 'none'", "script-src 'unsafe-inline' blob:", "style-src 'unsafe-inline'", "img-src data: blob:",
  "font-src data:", "worker-src blob:", "connect-src blob: data:", "object-src 'none'", "base-uri 'none'", "form-action 'none'"
].join('; ');

function leer(ruta) { return readFileSync(ruta, 'utf8'); }
function archivos(carpeta) { return readdirSync(carpeta).filter((n) => n.endsWith('.js')).sort(); }
/** Dentro de <script>, «</script» cerraría el bloque antes de tiempo. */
function seguro(js) { return js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--'); }
function libreria([nombre, ruta, version]) {
  const pkg = JSON.parse(leer(join(MODULOS, nombre, 'package.json')));
  if (pkg.version !== version) throw new Error(`${nombre} debe ser ${version} y node_modules trae ${pkg.version}. Ejecute npm ci.`);
  return `<script data-libreria="${nombre}@${version}">\n${seguro(leer(join(MODULOS, nombre, ruta)))}\n</script>`;
}

export function construir() {
  const logo = 'data:image/png;base64,' + readFileSync(LOGO).toString('base64');
  const worker = readFileSync(join(MODULOS, 'pdfjs-dist', 'build', 'pdf.worker.min.js')).toString('base64');
  const nucleo = archivos(join(FUENTE, 'nucleo')).map((n) => `/* ─── fuente/nucleo/${n} ─── */\n` + leer(join(FUENTE, 'nucleo', n))).join('\n');
  const app = archivos(join(FUENTE, 'app')).map((n) => `/* ─── fuente/app/${n} ─── */\n` + leer(join(FUENTE, 'app', n))).join('\n');
  const css = leer(join(FUENTE, 'estilos-arken.css')) + '\n' + leer(join(FUENTE, 'estilos.css'));
  const cuerpo = leer(join(FUENTE, 'cuerpo.html'));
  const html = `<!DOCTYPE html>
<html lang="es" data-density="normal" data-tema="claro"><head>
<!--
  ARKEN ANALYTICA ${VERSION} · Evaluación de propuestas
  Complemento de ARKEN CONTROL: mismo sistema visual, mismo formato de
  intercambio de presupuestos. Un solo archivo HTML que funciona abierto desde
  el disco y sin internet. No edite este archivo: se arma desde analytica/fuente/
  con «npm run construir».
-->
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="ARKEN ANALYTICA">
<meta name="theme-color" content="#16181A">
<meta name="arken-analytica-version" content="${VERSION}">
<link rel="icon" href="${logo}">
<title>ARKEN ANALYTICA — Evaluación de propuestas</title>
<style>
${css}
</style>
</head>
<body>
${cuerpo.replaceAll('{{LOGO}}', logo)}
${LIBRERIAS.map(libreria).join('\n')}
<script id="pdfjs-worker" type="text/plain">${worker}</script>
<script>
"use strict";
${seguro(nucleo)}
${seguro(app.replaceAll('{{LOGO}}', logo).replaceAll('{{VERSION}}', VERSION))}
</script>
</body>
</html>
`;
  return html;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const html = construir();
  if (process.argv.includes('--comprobar')) {
    if (!existsSync(SALIDA) || leer(SALIDA) !== html) {
      console.error('✖ programa/ARKEN_ANALYTICA.html no corresponde a fuente/. Ejecute «npm run construir» y suba el resultado.');
      process.exit(1);
    }
    console.log('✔ programa/ARKEN_ANALYTICA.html corresponde a fuente/.');
  } else {
    mkdirSync(dirname(SALIDA), { recursive: true });
    writeFileSync(SALIDA, html);
    console.log(`✔ programa/ARKEN_ANALYTICA.html (${(html.length / 1048576).toFixed(2)} MB, versión ${VERSION})`);
  }
}
