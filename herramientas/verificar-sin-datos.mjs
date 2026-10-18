// ARKEN · comprueba que el repositorio no traiga datos de la empresa ni secretos.
// El repositorio es público: los programas se guardan aquí siempre vacíos.
//
//   · ningún HTML de programa/, de la raíz ni de analytica/ trae <script id="arken-datos"> lleno
//   · ningún archivo de analytica/ trae una clave de API ni una llave privada en claro
//   · en analytica/ no hay paquetes de invitación, ofertas, sobres, respaldos ni respaldos de llaves
//
// Uso: npm run verificar-sin-datos

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = ['programa', '.', 'analytica', 'analytica/programa'];
const reDatos = /<script id="arken-datos" type="application\/json">([\s\S]*?)<\/script>/g;

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
  }
}

/* ARKEN ANALYTICA: secretos y archivos de un proceso real que nunca se suben. */
const PROHIBIDOS = [
  [/^ARKEN_INVITACION.*\.zip$/i, 'paquete de invitación'],
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

if (problemas) process.exit(1);
console.log('✔ Ningún programa trae datos de la empresa, y ARKEN ANALYTICA no trae secretos, paquetes, sobres ni respaldos.');
