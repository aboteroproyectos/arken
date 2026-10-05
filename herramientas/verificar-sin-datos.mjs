// ARKEN CONTROL · comprueba que ningún HTML de programa/ ni de la raíz traiga datos de la empresa.
// El repositorio es público: el programa se guarda aquí siempre vacío.
// Uso: npm run verificar-sin-datos

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const CARPETAS = ['programa', '.'];
const reDatos = /<script id="arken-datos" type="application\/json">([\s\S]*?)<\/script>/g;

let problemas = 0;
for (const carpeta of CARPETAS)
for (const nombre of readdirSync(join(RAIZ, carpeta)).filter((n) => /\.html?$/i.test(n))) {
  const ruta = carpeta === '.' ? nombre : carpeta + '/' + nombre;
  const html = readFileSync(join(RAIZ, ruta), 'utf8');
  for (const [, datos] of html.matchAll(reDatos)) {
    const d = datos.trim();
    if (d !== '' && d !== 'null') {
      problemas++;
      console.error(
        `✖ ${ruta} trae ${(d.length / 1048576).toFixed(1)} MB de datos embebidos. ` +
          'Quítelos (el contenido de <script id="arken-datos"> debe ser null) antes de subirlo.',
      );
    }
  }
}
if (problemas) process.exit(1);
console.log('✔ Ningún HTML de programa/ ni de la raíz contiene datos de la empresa.');
