// ARKEN PRECIOS · arma el SDK oficial de Anthropic que va dentro del programa.
//
// El Investigador IA (Fase 2) llama a la API de Claude con el SDK oficial,
// @anthropic-ai/sdk. El programa es un solo archivo que funciona sin servidor, así que el
// SDK va incrustado en el bloque <script id="arken-precios-sdk">: la clave de API solo pasa
// por código que está a la vista en el propio archivo, sin depender de una CDN.
//
// El bloque se empaqueta con esbuild a partir de las versiones fijadas en
// herramientas/sdk/package.json y su package-lock.json, así que cualquiera puede rehacerlo
// y compararlo con el que trae el programa:
//
//   npm ci --prefix herramientas/sdk
//   node herramientas/armar-sdk.mjs              reescribe el bloque en el programa
//   node herramientas/armar-sdk.mjs --comprobar  falla si el bloque no es idéntico (CI)

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERRAMIENTAS = dirname(fileURLToPath(import.meta.url));
const SDK = join(HERRAMIENTAS, 'sdk');
const PROGRAMA = join(HERRAMIENTAS, '..', 'programa', 'ARKEN_PRECIOS.html');
const RE_BLOQUE = /(<script id="arken-precios-sdk">\n)([\s\S]*?)(\n<\/script>)/;

/** Texto de la licencia de un paquete, sin nada que cierre el comentario. */
function licencia(carpeta, declarada) {
  for (const n of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license', 'COPYING']) {
    const f = join(carpeta, n);
    if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  }
  return null;
}

/** Empaqueta el SDK y devuelve el contenido del bloque. */
export async function armarSdk() {
  const nm = join(SDK, 'node_modules');
  if (!existsSync(join(nm, '@anthropic-ai', 'sdk')) || !existsSync(join(nm, 'esbuild'))) {
    throw new Error('Faltan las dependencias del SDK. Corra antes: npm ci --prefix herramientas/sdk');
  }
  const fijado = JSON.parse(readFileSync(join(SDK, 'package.json'), 'utf8')).dependencies;
  const version = (p) => JSON.parse(readFileSync(join(nm, p, 'package.json'), 'utf8')).version;
  for (const p of Object.keys(fijado)) {
    if (version(p) !== fijado[p]) throw new Error(`Está instalado ${p} ${version(p)} y el fijado es ${fijado[p]}: corra npm ci --prefix herramientas/sdk`);
  }
  const esbuild = await import(pathToFileURL(join(nm, 'esbuild', 'lib', 'main.js')).href);
  const r = await esbuild.build({
    absWorkingDir: SDK,
    entryPoints: ['entrada.mjs'],
    bundle: true,
    format: 'iife',
    globalName: 'AnthropicSDK',
    minify: true,
    platform: 'browser',
    target: 'es2020',
    legalComments: 'inline',
    charset: 'ascii',
    metafile: true,
    write: false,
    logLevel: 'silent',
  });
  const codigo = r.outputFiles[0].text.trim();

  // Paquetes que quedaron dentro, con su versión y su licencia.
  const paquetes = [];
  for (const entrada of Object.keys(r.metafile.inputs)) {
    const m = /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(entrada);
    if (m && !paquetes.includes(m[1])) paquetes.push(m[1]);
  }
  paquetes.sort((a, b) => (a === '@anthropic-ai/sdk' ? -1 : b === '@anthropic-ai/sdk' ? 1 : a < b ? -1 : 1));
  const MIT_SDK = licencia(join(nm, '@anthropic-ai', 'sdk')).split('\n').slice(1).join('\n').trim();
  const avisos = paquetes.map((p) => {
    const pj = JSON.parse(readFileSync(join(nm, p, 'package.json'), 'utf8'));
    const texto = licencia(join(nm, p));
    const encabezado = `--- ${p} ${pj.version} (${pj.license}) ---`;
    if (texto) return encabezado + '\n' + texto;
    // El paquete publicado no trae el archivo: se cita lo que declara su package.json.
    const autor = typeof pj.author === 'string' ? pj.author : (pj.author && pj.author.name) || '';
    return encabezado + '\nLicencia declarada en su package.json; el paquete publicado no trae el archivo de licencia.' +
      (autor ? '\nAutor: ' + autor + '.' : '') + (pj.repository ? '\nRepositorio: ' + (pj.repository.url || pj.repository) : '') +
      (pj.license === 'MIT' ? '\n\n' + MIT_SDK : '');
  });
  const encabezado = [
    `SDK oficial de Anthropic (@anthropic-ai/sdk ${version('@anthropic-ai/sdk')}), empaquetado con esbuild ${version('esbuild')}`,
    'por precios/herramientas/armar-sdk.mjs. No se edita a mano: se rehace con esa herramienta y la',
    'integración continua comprueba que sea idéntico al que sale de las versiones fijadas.',
    '',
    'Licencias de lo que incluye:',
    '',
    avisos.join('\n\n'),
  ].join('\n');
  const comentario = '/*!\n' + encabezado.replace(/\*\//g, '* /').split('\n').map((l) => (' * ' + l).replace(/\s+$/, '')).join('\n') + '\n */';
  const texto = comentario + '\n' + codigo;

  if (/<\/script/i.test(texto)) throw new Error('El SDK empaquetado contiene «</script»: rompería el HTML.');
  if (/sk-ant-[A-Za-z0-9_-]{8,}/.test(texto)) throw new Error('El SDK empaquetado contiene algo con forma de clave de API.');
  return { texto, version: version('@anthropic-ai/sdk'), paquetes, bytes: Buffer.byteLength(texto) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const comprobar = process.argv.includes('--comprobar');
  try {
    const { texto, version, paquetes, bytes } = await armarSdk();
    const html = readFileSync(PROGRAMA, 'utf8');
    const m = RE_BLOQUE.exec(html);
    if (!m) throw new Error('El programa no tiene el bloque <script id="arken-precios-sdk">.');
    if (comprobar) {
      if (m[2] !== texto) {
        console.error(`✖ El SDK incrustado en precios/programa/ARKEN_PRECIOS.html no es idéntico al que sale de @anthropic-ai/sdk ${version}.`);
        console.error('  Rehágalo con: npm ci --prefix herramientas/sdk && node herramientas/armar-sdk.mjs');
        process.exit(1);
      }
      console.log(`✔ El SDK incrustado es idéntico al de @anthropic-ai/sdk ${version} (${(bytes / 1024).toFixed(0)} kB; incluye ${paquetes.join(', ')}).`);
    } else {
      writeFileSync(PROGRAMA, html.replace(RE_BLOQUE, (x, a, b, c) => a + texto + c));
      console.log(`✔ SDK @anthropic-ai/sdk ${version} incrustado en precios/programa/ARKEN_PRECIOS.html (${(bytes / 1024).toFixed(0)} kB).`);
    }
  } catch (e) {
    console.error('✖ ' + (e.message || e));
    process.exit(1);
  }
}
