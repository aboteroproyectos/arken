// ARKEN PRECIOS · motor · archivos publicados (Excel y PDF) y cómo encontrarlos.
//
// Una entidad pública suele publicar su lista de precios como un archivo cuyo nombre cambia con
// cada versión. La ficha dice dónde está: la dirección fija del archivo o la página que lo enlaza,
// con el texto del enlace o un patrón de su dirección. El motor lee la página, toma el primer
// enlace que cumple y descarga el archivo con las mismas reglas de siempre (robots.txt, pausa,
// caché de un día y revalidación).

import { leerHtml, enlaces } from '../html.mjs';
import { enlaceArchivo, formato } from './comun.mjs';

const UN_DIA = 24 * 3600 * 1000;

/**
 * Dirección vigente del archivo.
 * @param {object} archivo { url } o { pagina, texto, patron }
 * @returns {Promise<{ url: string, pagina: string|null, textoEnlace: string }>}
 */
export async function ubicarArchivo(archivo, contexto) {
  const a = archivo || {};
  if (a.url && !a.pagina) return { url: a.url, pagina: null, textoEnlace: '' };
  const r = await contexto.traer(a.pagina, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', tipo: 'texto', ttlMs: 6 * 3600 * 1000 });
  const doc = leerHtml(r.texto);
  const e = enlaceArchivo(enlaces(doc, r.final || a.pagina), { patron: a.patron, texto: a.texto });
  if (!e) {
    if (a.url) return { url: a.url, pagina: a.pagina, textoEnlace: '' };
    throw formato('La página ya no enlaza el archivo' + (a.texto ? ' «' + a.texto + '»' : '') + (a.patron ? ' (' + a.patron + ')' : '') + '.', a.pagina);
  }
  return { url: e.href, pagina: a.pagina, textoEnlace: e.texto };
}

/** Descarga el archivo (bytes), con caché de un día. */
export async function descargarArchivo(url, contexto, o = {}) {
  const r = await contexto.traer(url, {
    accept: o.accept || '*/*',
    tipo: 'bytes',
    ttlMs: o.ttlMs || UN_DIA,
    maxBytes: o.maxBytes || 40 * 1024 * 1024,
    tiempoMaximoMs: o.tiempoMaximoMs || 120000,
  });
  return { url: r.final || r.url || url, bytes: r.bytes, recuperada: r.recuperada, desdeCache: r.desdeCache, tipo: r.tipo };
}
