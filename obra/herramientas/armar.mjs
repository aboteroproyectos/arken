// ARKEN OBRA · arma obra/apps/, lo que el instalador lleva de cada app de la familia.
//
// ARKEN OBRA no tiene un programa propio: abre los mismos programas de cada app, ya preparados
// para escritorio por su propio `npm run preparar` (la carpeta www/ de cada una). Aquí solo se
// copian, sin cambiarlos:
//   CONTROL    www/            + electron/preload.cjs
//   ANALYTICA  analytica/www/  + analytica/electron/{preload,copias}.cjs
//   PRECIOS    precios/www/    + precios/electron/{preload,copias,boveda,motor,red}.cjs + precios/motor/
//   BANK       bank/programa/ARKEN_BANK.html (si ya está en el repositorio; es un HTML listo)
// y se escribe apps/manifiesto.json con la versión de cada una.
//
// Antes, en la raíz, en analytica/ y en precios/: npm ci && npm run preparar
// Uso: npm run armar

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OBRA = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO = join(OBRA, '..');
const APPS = join(OBRA, 'apps');

const version = (carpeta) => JSON.parse(readFileSync(join(carpeta, 'package.json'), 'utf8')).version;

const FUENTES = [
  { id: 'control', carpeta: REPO, electron: ['preload.cjs'], extra: [] },
  { id: 'analytica', carpeta: join(REPO, 'analytica'), electron: ['preload.cjs', 'copias.cjs'], extra: [] },
  { id: 'precios', carpeta: join(REPO, 'precios'), electron: ['preload.cjs', 'copias.cjs', 'boveda.cjs', 'motor.cjs', 'red.cjs'], extra: ['motor'] },
];

rmSync(APPS, { recursive: true, force: true });
mkdirSync(APPS, { recursive: true });
const manifiesto = {};
let fallas = 0;

for (const f of FUENTES) {
  const www = join(f.carpeta, 'www');
  if (!existsSync(join(www, 'index.html'))) {
    console.error(`✖ Falta ${www}/index.html. En ${f.carpeta} ejecute: npm ci && npm run preparar`);
    fallas++;
    continue;
  }
  const destino = join(APPS, f.id);
  cpSync(www, join(destino, 'www'), { recursive: true });
  for (const a of f.electron) cpSync(join(f.carpeta, 'electron', a), join(destino, 'electron', a));
  for (const d of f.extra) cpSync(join(f.carpeta, d), join(destino, d), { recursive: true });
  manifiesto[f.id] = { version: version(f.carpeta) };
  console.log(`✔ ${f.id} ${manifiesto[f.id].version}`);
}

// BANK: un solo HTML, sin capa de app. Entra cuando esté en el repositorio (rama arken-bank, PR #18).
const bank = join(REPO, 'bank', 'programa', 'ARKEN_BANK.html');
if (existsSync(bank)) {
  const html = readFileSync(bank, 'utf8');
  // El repositorio es público: el HTML que se empaqueta no puede traer datos
  const m = html.match(/<script[^>]*id=["']arken-datos["'][^>]*>([\s\S]*?)<\/script>/i);
  if (m && m[1].trim() && m[1].trim() !== 'null') {
    console.error('✖ ARKEN_BANK.html trae datos embebidos: no se empaqueta.');
    fallas++;
  } else {
    mkdirSync(join(APPS, 'bank', 'www'), { recursive: true });
    writeFileSync(join(APPS, 'bank', 'www', 'index.html'), html);
    manifiesto.bank = { version: version(join(REPO, 'bank')) };
    console.log(`✔ bank ${manifiesto.bank.version}`);
  }
} else {
  console.log('· bank: todavía no está en esta rama (entra cuando se apruebe ARKEN BANK)');
}

writeFileSync(join(APPS, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2) + '\n');
if (fallas) process.exit(1);
console.log('✔ obra/apps/ lista.');
