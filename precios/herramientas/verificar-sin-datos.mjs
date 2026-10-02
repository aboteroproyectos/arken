// ARKEN PRECIOS · comprueba que ningún HTML de precios/programa/ traiga datos de la
// empresa ni algo con forma de clave de API. El repositorio es público: el programa se
// guarda aquí siempre vacío (el bloque de datos embebidos en null).
// Uso: npm run verificar-sin-datos

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CARPETA = join(dirname(fileURLToPath(import.meta.url)), '..', 'programa');
const reDatos = /<script id="arken-precios-datos" type="application\/json">([\s\S]*?)<\/script>/g;
const reClave = /sk-ant-[A-Za-z0-9_-]{8,}/;

let problemas = 0, revisados = 0;
for (const nombre of readdirSync(CARPETA).filter((n) => /\.html?$/i.test(n))) {
  const html = readFileSync(join(CARPETA, nombre), 'utf8');
  revisados++;
  const bloques = [...html.matchAll(reDatos)];
  if (!bloques.length) {
    problemas++;
    console.error(`✖ precios/programa/${nombre} no tiene el bloque <script id="arken-precios-datos">.`);
  }
  for (const [, datos] of bloques) {
    const d = datos.trim();
    if (d !== 'null') {
      problemas++;
      console.error(`✖ precios/programa/${nombre} trae ${(d.length / 1024).toFixed(0)} kB de datos embebidos. ` +
        'El contenido de <script id="arken-precios-datos"> debe ser null antes de subirlo.');
    }
  }
  if (reClave.test(html)) {
    problemas++;
    console.error(`✖ precios/programa/${nombre} contiene algo con forma de clave de API (sk-ant-…). Quítelo antes de subirlo.`);
  }
}
if (!revisados) { console.error('✖ No hay programas en precios/programa/.'); process.exit(1); }
if (problemas) process.exit(1);
console.log('✔ precios/programa/ no contiene datos de la empresa ni claves.');
