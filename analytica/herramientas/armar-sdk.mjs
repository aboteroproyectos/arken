// ARKEN ANALYTICA · arma el SDK oficial de Anthropic que va dentro del programa.
//
// El asistente de IA (§18.13, Fase 4) llama a la API de Claude con el SDK oficial,
// @anthropic-ai/sdk, como el Investigador IA de ARKEN PRECIOS. El programa es un solo archivo
// que funciona sin servidor, así que el SDK va incrustado: esta herramienta lo empaqueta en
// fuente/sdk/anthropic-sdk.js y construir.mjs lo pone en el bloque
// <script id="arken-analytica-sdk">. La clave de API solo pasa por código que está a la vista
// en el propio archivo, sin depender de una CDN.
//
// El bloque se empaqueta con esbuild a partir de las versiones fijadas en
// herramientas/sdk/package.json y su package-lock.json, así que cualquiera puede rehacerlo
// y compararlo con el que trae el programa:
//
//   npm ci --prefix herramientas/sdk
//   node herramientas/armar-sdk.mjs              reescribe fuente/sdk/anthropic-sdk.js
//   node herramientas/armar-sdk.mjs --comprobar  falla si no es idéntico (CI)

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERRAMIENTAS = dirname(fileURLToPath(import.meta.url));
const SDK = join(HERRAMIENTAS, 'sdk');
const SALIDA = join(HERRAMIENTAS, '..', 'fuente', 'sdk', 'anthropic-sdk.js');

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
    'por analytica/herramientas/armar-sdk.mjs. No se edita a mano: se rehace con esa herramienta y la',
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
    if (comprobar) {
      if (!existsSync(SALIDA) || readFileSync(SALIDA, 'utf8') !== texto + '\n') {
        console.error(`✖ fuente/sdk/anthropic-sdk.js no es idéntico al que sale de @anthropic-ai/sdk ${version}.`);
        console.error('  Rehágalo con: npm run sdk:instalar && npm run sdk:armar && npm run construir');
        process.exit(1);
      }
      console.log(`✔ El SDK incrustado es idéntico al de @anthropic-ai/sdk ${version} (${(bytes / 1024).toFixed(0)} kB; incluye ${paquetes.join(', ')}).`);
    } else {
      mkdirSync(dirname(SALIDA), { recursive: true });
      writeFileSync(SALIDA, texto + '\n');
      console.log(`✔ SDK @anthropic-ai/sdk ${version} en fuente/sdk/anthropic-sdk.js (${(bytes / 1024).toFixed(0)} kB). Ahora: npm run construir`);
    }
  } catch (e) {
    console.error('✖ ' + (e.message || e));
    process.exit(1);
  }
}
