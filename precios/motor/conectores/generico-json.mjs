// ARKEN PRECIOS · motor · conector genérico de una API que responde JSON (§7.2).
//
// Se configura en la ficha de la fuente:
//   modo         'busqueda' o 'lista'
//   busqueda     { plantilla: 'https://sitio/api/productos?q={consulta}', maxResultados }
//   lista        { urls: [...], paginar: { parametro: 'page', desde: 1, maxPaginas } }
//   elementos    ruta de la lista de productos en la respuesta («products», «data.items»; vacía si la
//                respuesta ya es la lista)
//   campos       rutas dentro de cada producto: { titulo, precio, divisor, precioTexto, precioAnterior,
//                enlace, unidad, presentacion, disponibilidad, id }
//                · precio es el número; divisor lo divide (100 si viene en centavos)
//                · precioTexto es el precio como lo muestra el sitio (puede traer HTML)
//   producto     { plantilla: 'https://sitio/api/productos?slug={slug}', desdeUrl: '/producto/([^/]+)', elementos }
//   incluyeIva, ciudad, tipoPrecio
//
// La evidencia de cada producto es su objeto JSON escrito como texto («ruta: valor | …»), con el
// nombre y el precio al comienzo; el texto literal es ese comienzo.

import { obtener, elementos, textoDeHtml, aplanar, pares, crudo, disponibilidad, formato, unaLinea } from './comun.mjs';
import { absoluta } from '../html.mjs';

/** Lee una dirección que responde JSON. */
export async function leerJson(url, contexto) {
  const r = await contexto.traer(url, { accept: 'application/json', tipo: 'json' });
  return { url: r.final || r.url || url, json: r.json, recuperada: r.recuperada };
}

function textoDe(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return /<[a-z][\s\S]*>/i.test(v) ? textoDeHtml(v) : unaLinea(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

/**
 * Un producto de la respuesta → hallazgo crudo.
 * @param {object} el objeto del producto
 * @param {object} cfg configuración (campos…)
 * @param {object} lectura { url, recuperada } de la respuesta
 */
export function productoJson(el, cfg, lectura, contexto, urlProducto) {
  const c = cfg.campos || {};
  const titulo = textoDe(obtener(el, c.titulo));
  const crudoPrecio = c.precio ? obtener(el, c.precio) : undefined;
  const divisor = Number(c.divisor) > 0 ? Number(c.divisor) : 1;
  const numero = crudoPrecio === undefined || crudoPrecio === null || crudoPrecio === '' ? NaN : Number(crudoPrecio) / divisor;
  const precioTexto = c.precioTexto ? textoDe(obtener(el, c.precioTexto)) : textoDe(crudoPrecio);
  if (!titulo || !precioTexto) return null;
  const anterior = c.precioAnterior ? obtener(el, c.precioAnterior) : undefined;
  const numAnterior = anterior === undefined || anterior === null || anterior === '' ? NaN : Number(anterior) / divisor;
  const claveCampo = c.precioTexto || c.precio;
  // El comienzo de la evidencia: nombre y precio, juntos; el literal es ese comienzo
  const literal = pares([
    [c.titulo, titulo],
    [claveCampo, precioTexto],
  ]);
  const resto = pares([
    [c.precioAnterior, textoDe(anterior)],
    [c.unidad, textoDe(obtener(el, c.unidad))],
    [c.presentacion, textoDe(obtener(el, c.presentacion))],
    [c.disponibilidad, textoDe(obtener(el, c.disponibilidad))],
    [c.enlace, textoDe(obtener(el, c.enlace))],
    [c.id, textoDe(obtener(el, c.id))],
  ]);
  const texto = [literal, resto, aplanar(el, { maxTexto: 3000 })].filter(Boolean).join(' | ');
  const enlace = urlProducto || absoluta(textoDe(obtener(el, c.enlace)), lectura.url) || lectura.url;
  const id = c.id ? textoDe(obtener(el, c.id)) : '';
  const promo = numAnterior > 0 && numero > 0 && numAnterior > numero;
  return crudo({
    titulo,
    url: enlace,
    precioTexto,
    unidadTexto: textoDe(obtener(el, c.unidad)),
    presentacion: textoDe(obtener(el, c.presentacion)),
    disponibilidad: c.disponibilidad ? disponibilidad(obtener(el, c.disponibilidad)) : '',
    proveedor: cfg.proveedor || '',
    textoLiteral: literal,
    precio: numero > 0 ? numero : undefined,
    incluyeIva: cfg.incluyeIva,
    ciudad: cfg.ciudad || '',
    condiciones: promo ? 'Promoción: precio anterior ' + textoDe(anterior) + (divisor !== 1 ? ' (en centavos)' : '') + '.' : '',
    clave: id ? (cfg.clavePrefijo || (contexto && contexto.fuente && contexto.fuente.id) || 'api') + ':' + id : null,
    pagina: { url: lectura.url, texto, leida: true, tipo: 'json', recuperada: lectura.recuperada },
  });
}

export async function buscarJson({ insumo, contexto }, cfg) {
  const consulta = contexto.consulta(insumo);
  if (!consulta) return [];
  const url = contexto.plantilla(cfg.busqueda.plantilla, { consulta });
  const lectura = await leerJson(url, contexto);
  const lista = cfg.elementos ? obtener(lectura.json, String(cfg.elementos).replace(/\[\*\]$/, '')) : lectura.json;
  if (!Array.isArray(lista)) throw formato('La respuesta no trae la lista de productos en «' + (cfg.elementos || '(raíz)') + '».', url);
  const max = (cfg.busqueda && cfg.busqueda.maxResultados) || contexto.limites.resultadosPorBusqueda || 12;
  return lista
    .slice(0, max)
    .map((el) => productoJson(el, cfg, lectura, contexto))
    .filter(Boolean);
}

export async function leerListaJson({ contexto }, cfg) {
  const lista = cfg.lista || {};
  const pag = lista.paginar || null;
  const maxTotal = contexto.limites.paginasPorLista || 60;
  const crudos = [];
  let paginas = 0;
  for (const base of lista.urls || []) {
    const maxPaginas = pag ? pag.maxPaginas || 20 : 1;
    for (let k = 0; k < maxPaginas && paginas < maxTotal; k++) {
      let url = base;
      if (pag) {
        const u = new URL(base);
        u.searchParams.set(pag.parametro || 'page', String((pag.desde === undefined ? 1 : Number(pag.desde)) + k));
        url = u.href;
      }
      let lectura;
      try {
        lectura = await leerJson(url, contexto);
      } catch (e) {
        if (contexto.esDeElemento(e)) {
          contexto.falla(e, url);
          break;
        }
        throw e;
      }
      paginas++;
      contexto.progreso({ paginas, url });
      const els = elementos(lectura.json, cfg.elementos);
      if (!els.length) break;
      for (const el of els) {
        const c = productoJson(el, cfg, lectura, contexto);
        if (c) crudos.push(c);
      }
    }
  }
  return { crudos, paginas };
}

export async function leerProductoJson({ vinculo, contexto }, cfg) {
  const p = cfg.producto || {};
  if (!p.plantilla) return null;
  let valores = {};
  if (p.desdeUrl) {
    const m = new RegExp(p.desdeUrl).exec(vinculo.url);
    if (!m) return null;
    valores = Object.assign({ slug: m[1] }, m.groups || {});
  }
  const url = contexto.plantilla(p.plantilla, valores);
  const lectura = await leerJson(url, contexto);
  const el = elementos(lectura.json, p.elementos !== undefined ? p.elementos : cfg.elementos)[0];
  if (!el) return null;
  return productoJson(el, cfg, lectura, contexto, vinculo.url);
}

export default {
  id: 'generico-json',
  nombre: 'API JSON (genérico)',
  tipo: 'genérico',
  metodo: 'api-json',
  async buscar(a) {
    return buscarJson(a, a.contexto.config);
  },
  async leerLista(a) {
    return leerListaJson(a, a.contexto.config);
  },
  async leerProducto(a) {
    return leerProductoJson(a, a.contexto.config);
  },
};
