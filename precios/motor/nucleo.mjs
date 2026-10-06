// ARKEN PRECIOS · motor · el núcleo del programa, cargado desde el HTML.
//
// El motor no copia reglas: lee el bloque «núcleo» del programa (el mismo código que decide cada
// precio en la página y que prueban las pruebas de Node) y lo corre en un contexto aparte. Así la
// verificación literal, el lector de precios y el emparejamiento son uno solo en el programa, en
// la app de escritorio y en el servidor.

import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const AQUI = dirname(fileURLToPath(import.meta.url));
/** Ruta del programa en el repositorio. La app de escritorio pasa la de su copia empaquetada. */
export const PROGRAMA = join(AQUI, '..', 'programa', 'ARKEN_PRECIOS.html');

/** Texto de un bloque <script id="…"> del programa. */
export function bloque(html, id) {
  const m = html.match(new RegExp(`<script id="${id}">\\n?([\\s\\S]*?)</script>`));
  if (!m) throw new Error('El programa no tiene el bloque ' + id + '.');
  return m[1];
}

const cargados = new Map();

/**
 * Carga el núcleo (y, si se pide, la semilla) del programa.
 * @param {string} [ruta] archivo HTML del programa
 * @param {object} [o] { semilla: boolean }
 * @returns {object} Nucleo (y Nucleo.Semilla si se pidió)
 */
export function cargarNucleo(ruta = PROGRAMA, o = {}) {
  const clave = ruta + (o.semilla ? '|semilla' : '');
  if (cargados.has(clave)) return cargados.get(clave);
  const html = readFileSync(ruta, 'utf8');
  const ctx = vm.createContext({ console, TextEncoder, TextDecoder, URL, Intl });
  let codigo = bloque(html, 'arken-precios-nucleo') + '\nthis.Nucleo = Nucleo;';
  if (o.semilla) codigo += '\n' + bloque(html, 'arken-precios-semilla') + '\nthis.Semilla = Semilla;';
  vm.runInContext(codigo, ctx, { filename: 'ARKEN_PRECIOS.html#nucleo' });
  const N = ctx.Nucleo;
  if (!N || !N.Conectores || !N.Investigador || !N.Recoleccion) throw new Error('El programa no trae el núcleo de la Fase 3 (Conectores y Recolección).');
  if (o.semilla) N.Semilla = ctx.Semilla;
  cargados.set(clave, N);
  return N;
}

/** Copia simple entre contextos: los objetos del núcleo vienen de otro contexto de vm. */
export function plano(x) {
  return x === undefined ? undefined : JSON.parse(JSON.stringify(x));
}
