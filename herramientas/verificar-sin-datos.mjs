// ARKEN · comprueba que el repositorio no traiga datos de la empresa ni secretos.
// El repositorio es público: los programas se guardan aquí siempre vacíos.
//
//   · ningún HTML de programa/, de la raíz ni de analytica/ trae <script id="arken-datos"> lleno
//   · ningún archivo de analytica/ trae una clave de API ni una llave privada en claro
//   · en analytica/ no hay paquetes de invitación, ofertas, sobres, borradores, preguntas, respuestas,
//     adendas, actas, respaldos ni respaldos de llaves
//   · ningún HTML trae un pliego de ARKEN OFERTA incrustado (<script id="arken-pliego"> lleno), ni
//     siquiera la plantilla que va comprimida dentro de ARKEN_ANALYTICA.html
//
// Uso: npm run verificar-sin-datos

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = ['programa', '.', 'analytica', 'analytica/programa'];
const reDatos = /<script id="arken-datos" type="application\/json">([\s\S]*?)<\/script>/g;
const rePliego = /(?<!['"+\\])<script id="arken-pliego" type="application\/json">([\s\S]*?)<\/script>/g;
const rePlantilla = /<script id="plantilla-oferta" type="text\/plain">([\s\S]*?)<\/script>/;
const plantillas = [];

let problemas = 0;
const falla = (msg) => { problemas++; console.error('✖ ' + msg); };

for (const carpeta of CARPETAS) {
  let nombres;
  try { nombres = readdirSync(join(RAIZ, carpeta)); } catch { continue; }
  for (const nombre of nombres.filter((n) => /\.html?$/i.test(n))) {
    const ruta = carpeta === '.' ? nombre : carpeta + '/' + nombre;
    const html = readFileSync(join(RAIZ, ruta), 'utf8');
    for (const [, datos] of html.matchAll(reDatos)) {
      const d = datos.trim();
      if (d !== '' && d !== 'null') {
        falla(`${ruta} trae ${(d.length / 1048576).toFixed(1)} MB de datos embebidos. ` +
          'Quítelos (el contenido de <script id="arken-datos"> debe ser null) antes de subirlo.');
      }
    }
    revisarPliego(ruta, html);
    const pt = rePlantilla.exec(html);
    if (pt) plantillas.push([ruta, pt[1].trim()]);
  }
}
function revisarPliego(ruta, html) {
  for (const [, pliego] of html.matchAll(rePliego)) {
    const d = pliego.trim();
    if (d !== '' && d !== 'null') falla(`${ruta} trae un pliego de ARKEN OFERTA incrustado (el de un invitado). Los paquetes nunca se suben al repositorio.`);
  }
}

/* ARKEN ANALYTICA: secretos y archivos de un proceso real que nunca se suben. */
const PROHIBIDOS = [
  [/^ARKEN_INVITACION.*\.zip$/i, 'paquete de invitación'],
  [/^ARKEN_OFERTA.*\.html?$/i, 'ARKEN OFERTA con el pliego de un invitado'],
  [/_BORRADOR_.*\.zip$/i, 'borrador de oferta'],
  [/_CONFIDENCIALIDAD_.*\.zip$/i, 'sobre de confidencialidad'],
  [/_PREGUNTAS_.*\.json$/i, 'archivo de preguntas'],
  [/^ARKEN_(RESPUESTAS|ADENDA)_.*\.json$/i, 'documento de respuestas o adenda'],
  [/_PLANTILLA_PRECIOS_.*\.xlsx?$/i, 'plantilla de precios de un invitado'],
  [/^(Acta_de_(cierre|apertura)|Adenda|Respuestas|Resumen_oferta)_.*\.pdf$/i, 'acta o documento de un proceso'],
  [/OFERTA.*\.zip$/i, 'paquete de oferta'],
  [/^sobre.*\.json$/i, 'sobre de oferta'],
  [/\.sobre$/i, 'sobre de oferta'],
  [/respaldo.*\.zip$/i, 'respaldo'],
  [/respaldo.*\.json$/i, 'respaldo'],
  [/llaves.*\.json$/i, 'respaldo de llaves'],
];
const SECRETOS = [
  [/sk-ant-[A-Za-z0-9_-]{16,}/, 'una clave de API'],
  [/"kty"\s*:\s*"(EC|RSA|OKP)"[^}]{0,400}?"d"\s*:\s*"[A-Za-z0-9_-]{20,}"/, 'una llave privada en claro'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'una llave privada en claro'],
];
const TEXTO = /\.(html?|js|mjs|cjs|json|md|txt|css|csv|yml|yaml)$/i;
function recorrer(carpeta) {
  for (const nombre of readdirSync(carpeta)) {
    if (nombre === 'node_modules' || nombre === '.git') continue;
    const ruta = join(carpeta, nombre);
    const rel = relative(RAIZ, ruta);
    if (statSync(ruta).isDirectory()) { recorrer(ruta); continue; }
    for (const [re, que] of PROHIBIDOS) if (re.test(nombre)) falla(`${rel} parece un ${que}: no se sube al repositorio.`);
    if (!TEXTO.test(nombre)) continue;
    const contenido = readFileSync(ruta, 'utf8');
    for (const [re, que] of SECRETOS) if (re.test(contenido)) falla(`${rel} trae ${que}. Quítela antes de subirlo.`);
  }
}
try { recorrer(join(RAIZ, 'analytica')); } catch (e) { if (e.code !== 'ENOENT') throw e; }

/* La plantilla de ARKEN OFERTA viaja comprimida dentro de ARKEN_ANALYTICA.html: su pliego también debe ir vacío. */
let JSZip = null;
try { JSZip = createRequire(join(RAIZ, 'analytica', 'package.json'))('jszip'); } catch { /* sin node_modules de analytica: no se revisa */ }
if (JSZip) {
  for (const [ruta, b64] of plantillas) {
    try {
      const z = await JSZip.loadAsync(b64, { base64: true });
      for (const n of Object.keys(z.files).filter((x) => /\.html?$/i.test(x))) revisarPliego(ruta + ' › ' + n, await z.file(n).async('string'));
    } catch (e) { falla(`${ruta}: la plantilla de ARKEN OFERTA no se pudo leer (${e.message}).`); }
  }
} else if (plantillas.length) console.log('· jszip no está instalado en analytica/: la plantilla comprimida de ARKEN OFERTA no se revisó.');

if (problemas) process.exit(1);
console.log('✔ Ningún programa trae datos de la empresa ni un pliego incrustado, y ARKEN ANALYTICA no trae secretos, paquetes, sobres, actas ni respaldos.');
