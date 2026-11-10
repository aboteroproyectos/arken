// ARKEN CONTROL · genera sitio/, la versión para iPhone y iPad que se instala desde Safari
// («Compartir › Agregar a pantalla de inicio»), sin App Store, sin firma y sin vencimiento.
//
// Parte de www/ (npm run preparar) y le agrega:
//   · manifest.webmanifest e íconos, para que quede como app en la pantalla de inicio;
//   · sw.js, que guarda todo el programa en el teléfono: abre sin internet y, cuando se
//     publica una versión nueva en GitHub, la descarga sola y la aplica;
//   · app/arken-iphone.js, que registra sw.js, pide almacenamiento persistente y avisa
//     cuando hay versión nueva.
// El programa no cambia. Los datos siguen en el teléfono (IndexedDB) y no se tocan al actualizar.
//
// Uso: npm run iphone   (equivale a npm run preparar && node herramientas/preparar-iphone.mjs)

import { cpSync, existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const WWW = join(RAIZ, 'www');
const SITIO = join(RAIZ, 'sitio');
const FONDO = '#16181A';
const fallar = (msg) => {
  console.error('\n✖ ' + msg + '\n');
  process.exit(1);
};

if (!existsSync(join(WWW, 'index.html'))) fallar('Falta www/. Ejecute primero: npm run preparar');
const version = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;

rmSync(SITIO, { recursive: true, force: true });
cpSync(WWW, SITIO, { recursive: true });
rmSync(join(SITIO, 'app', 'sw-iphone.js'), { force: true }); // plantilla: el sw.js real va en la raíz

// Íconos (generados una vez desde recursos/icono.png y guardados en recursos/iphone/)
cpSync(join(RAIZ, 'recursos', 'iphone'), join(SITIO, 'iconos'), { recursive: true });

// Manifiesto
writeFileSync(
  join(SITIO, 'manifest.webmanifest'),
  JSON.stringify(
    {
      name: 'ARKEN CONTROL',
      short_name: 'ARKEN',
      description: 'Sistema integral para el control de obra',
      lang: 'es-CO',
      id: './',
      start_url: './',
      scope: './',
      display: 'standalone',
      orientation: 'any',
      background_color: FONDO,
      theme_color: FONDO,
      icons: [
        { src: 'iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  ),
);

// index.html: manifiesto, ícono de iPhone y capa del iPhone
let html = readFileSync(join(SITIO, 'index.html'), 'utf8');
const cabecera =
  '<link rel="manifest" href="manifest.webmanifest" data-arken-iphone>\n' +
  '<link rel="apple-touch-icon" href="iconos/icono-180.png" data-arken-iphone>\n' +
  (html.includes('name="apple-mobile-web-app-capable"') ? '' : '<meta name="apple-mobile-web-app-capable" content="yes">\n') +
  (html.includes('name="mobile-web-app-capable"') ? '' : '<meta name="mobile-web-app-capable" content="yes">\n') +
  `<script src="app/arken-iphone.js" data-arken-iphone data-version="${version}"></script>\n`;
if (!html.includes('</head>')) fallar('El programa no tiene </head>.');
html = html.replace('</head>', cabecera + '</head>');
writeFileSync(join(SITIO, 'index.html'), html);

// Lista de archivos y huella: la huella cambia con cualquier cambio del programa, y eso
// es lo que hace que el iPhone descargue la versión nueva.
const archivos = [];
const recorrer = (dir) => {
  for (const n of readdirSync(dir).sort()) {
    const r = join(dir, n);
    if (statSync(r).isDirectory()) recorrer(r);
    else archivos.push(relative(SITIO, r).split(sep).join('/'));
  }
};
recorrer(SITIO);
const huella = createHash('sha256');
for (const a of archivos) huella.update(a).update(readFileSync(join(SITIO, a)));
const id = `${version}-${huella.digest('hex').slice(0, 12)}`;

const sw = readFileSync(join(RAIZ, 'app', 'sw-iphone.js'), 'utf8')
  .replace('__VERSION__', id)
  .replace('__ARCHIVOS__', JSON.stringify(['./', ...archivos.filter((a) => a !== 'index.html')]));
writeFileSync(join(SITIO, 'sw.js'), sw);
writeFileSync(join(SITIO, 'version.json'), JSON.stringify({ version, id, fecha: new Date().toISOString() }) + '\n');
writeFileSync(join(SITIO, '.nojekyll'), '');

const mb = archivos.reduce((s, a) => s + statSync(join(SITIO, a)).size, 0) / 1048576;
console.log(`✔ sitio/ lista: versión ${id}, ${archivos.length} archivos, ${mb.toFixed(1)} MB.`);
