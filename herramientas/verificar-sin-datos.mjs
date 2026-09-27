// ARKEN CONTROL · comprueba que ningún HTML de programa/ traiga datos de la empresa.
// El repositorio es público: el programa se guarda aquí siempre vacío.
// Uso: npm run verificar-sin-datos

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARPETA = join(dirname(fileURLToPath(import.meta.url)), '..', 'programa');
const reDatos = /<script id="arken-datos" type="application\/json">([\s\S]*?)<\/script>/g;

let problemas = 0;
for (const nombre of readdirSync(CARPETA).filter((n) => /\.html?$/i.test(n))) {
  const html = readFileSync(join(CARPETA, nombre), 'utf8');
  for (const [, datos] of html.matchAll(reDatos)) {
    const d = datos.trim();
    if (d !== '' && d !== 'null') {
      problemas++;
      console.error(
        `✖ programa/${nombre} trae ${(d.length / 1048576).toFixed(1)} MB de datos embebidos. ` +
          'Quítelos (el contenido de <script id="arken-datos"> debe ser null) antes de subirlo.',
      );
    }
  }
}
if (problemas) process.exit(1);
console.log('✔ programa/ no contiene datos de la empresa.');
