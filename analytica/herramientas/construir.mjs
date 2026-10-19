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
import { createRequire } from 'node:module';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FUENTE = join(RAIZ, 'fuente');
const SALIDA = join(RAIZ, 'programa', 'ARKEN_ANALYTICA.html');
const MODULOS = join(RAIZ, 'node_modules');
const LOGO = join(RAIZ, '..', 'recursos', 'logo-original.png');
const VERSION = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;
/* ARKEN OFERTA (§15) comparte el núcleo y la base de la interfaz del principal. */
const APP_COMPARTIDA = ['01-base.js', '04-ui.js', '05-pdf.js'];
const LIB_OFERTA = ['jspdf', 'jspdf-autotable', 'xlsx', 'jszip'];
/* La plantilla de ARKEN OFERTA viaja comprimida dentro del principal; la fecha
   fija hace que el ZIP salga idéntico en cada construcción. */
const FECHA_ZIP = new Date('2026-01-01T00:00:00Z');

/* Las mismas librerías y versiones que ARKEN CONTROL, más JSZip 3.10.1 (§6). */
const LIBRERIAS = [
  ['jspdf', 'dist/jspdf.umd.min.js', '2.5.1'],
  ['jspdf-autotable', 'dist/jspdf.plugin.autotable.min.js', '3.8.2'],
  ['xlsx', 'dist/xlsx.full.min.js', '0.18.5'],
  ['jszip', 'dist/jszip.min.js', '3.10.1'],
  ['pdfjs-dist', 'build/pdf.min.js', '3.11.174']
];

/* Content Security Policy (§24): scripts y estilos solo los del propio archivo; workers
   e imágenes desde blob: o data:. Nada sale a la red. */
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

function logoDataUrl() { return 'data:image/png;base64,' + readFileSync(LOGO).toString('base64'); }
function fuentes(carpeta, lista) {
  return (lista || archivos(join(FUENTE, carpeta))).map((n) => `/* ─── fuente/${carpeta}/${n} ─── */\n` + leer(join(FUENTE, carpeta, n))).join('\n');
}

/** ARKEN OFERTA, con el lugar del pliego vacío (<script id="arken-pliego">null). */
export function construirOferta() {
  const logo = logoDataUrl();
  const js = fuentes('nucleo') + '\n' + fuentes('app', APP_COMPARTIDA) + '\n' + fuentes('oferta');
  const css = leer(join(FUENTE, 'estilos-arken.css')) + '\n' + leer(join(FUENTE, 'estilos.css')) + '\n' + leer(join(FUENTE, 'oferta', 'estilos-oferta.css'));
  return `<!DOCTYPE html>
<html lang="es" data-density="normal" data-tema="claro"><head>
<!--
  ARKEN OFERTA ${VERSION} · Programa del proponente
  Lo genera ARKEN ANALYTICA dentro de cada paquete de invitación, con el pliego
  del invitado adentro. Funciona abierto desde el disco, sin internet y sin
  instalar nada. No edite este archivo.
-->
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#16181A">
<meta name="arken-oferta-version" content="${VERSION}">
<link rel="icon" href="${logo}">
<title>ARKEN OFERTA — Programa del proponente</title>
<style>
${css}
</style>
</head>
<body>
${leer(join(FUENTE, 'oferta', 'cuerpo.html')).replaceAll('{{LOGO}}', logo)}
${LIBRERIAS.filter((l) => LIB_OFERTA.includes(l[0])).map(libreria).join('\n')}
<script>
"use strict";
${seguro(js.replaceAll('{{LOGO}}', logo).replaceAll('{{VERSION}}', VERSION))}
</script>
</body>
</html>
`;
}
/** La plantilla de ARKEN OFERTA comprimida en base64, para incrustarla en el principal. */
async function plantillaOferta() {
  const require = createRequire(import.meta.url);
  const JSZip = require(join(MODULOS, 'jszip'));
  const z = new JSZip();
  z.file('ARKEN_OFERTA.html', construirOferta(), { date:FECHA_ZIP });
  return z.generateAsync({ type:'base64', compression:'DEFLATE', compressionOptions:{ level:9 } });
}

export async function construir() {
  const logo = logoDataUrl();
  const worker = readFileSync(join(MODULOS, 'pdfjs-dist', 'build', 'pdf.worker.min.js')).toString('base64');
  const oferta = await plantillaOferta();
  /* La evaluación (Fase 3) es solo del principal: ARKEN OFERTA no la lleva. */
  const nucleo = fuentes('nucleo') + '\n' + fuentes('evaluacion');
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
<script id="plantilla-oferta" type="text/plain">${oferta}</script>
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
  const html = await construir();
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
