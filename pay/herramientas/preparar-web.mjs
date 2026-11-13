// ARKEN PAY · arma www/, la carpeta que muestra la app de escritorio, a partir de programa/,
// nucleo/ y recursos/. No transforma nada: copia los archivos tal cual.
// Uso: npm run preparar
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(RAIZ, 'www');
const ARCHIVOS = [
  ['programa/index.html', 'index.html'],
  ['programa/app.css', 'app.css'],
  ['programa/app.js', 'app.js'],
  ['nucleo/arken-pay-nucleo.js', 'arken-pay-nucleo.js'],
  ['nucleo/arken-pay-xml.js', 'arken-pay-xml.js'],
  ['recursos/logo.png', 'logo.png'],
];
rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });
for (const [de, a] of ARCHIVOS) {
  const origen = join(RAIZ, de);
  if (!existsSync(origen)) {
    console.error('✖ Falta ' + de);
    process.exit(1);
  }
  copyFileSync(origen, join(WWW, a));
}
console.log(`✔ www/ lista (${ARCHIVOS.length} archivos).`);
