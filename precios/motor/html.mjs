// ARKEN PRECIOS · motor · lectura de HTML.
//
// htmlparser2 con css-select: el analizador y el selector sobre los que está hecho cheerio,
// sin el resto de cheerio. Lo mismo corre en el escritorio (proceso principal de Electron)
// y en el servidor, así el código del motor es uno solo (decisión 59).
//
// Un selector de la ficha de una fuente es CSS, con dos añadidos:
//   · «css@atributo» devuelve el valor del atributo («a.nombre@href», «meta[itemprop=price]@content»).
//   · «@atributo» lee el atributo del elemento mismo (la tarjeta).

import { parseDocument } from 'htmlparser2';
import { selectAll, selectOne } from 'css-select';
import { getAttributeValue } from 'domutils';

const INVISIBLES = new Set(['script', 'style', 'noscript', 'template', 'svg', 'head', 'iframe', 'object']);
const BLOQUES = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer',
  'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'ol', 'p', 'pre', 'section', 'table',
  'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'option', 'label',
]);

/** Documento a partir del texto HTML. */
export function leerHtml(texto) {
  return parseDocument(String(texto || ''), { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true });
}

/** Separa «css@atributo». */
export function partirSelector(spec) {
  const s = String(spec || '').trim();
  const i = s.lastIndexOf('@');
  // Un «@» dentro de corchetes es parte del CSS ([href^="mailto:a@b"])
  if (i < 0 || s.indexOf(']', i) > i) return { css: s, atributo: null };
  return { css: s.slice(0, i).trim(), atributo: s.slice(i + 1).trim().toLowerCase() || null };
}

/** Elementos que cumplen el selector CSS dentro de `raiz`. */
export function todos(raiz, css) {
  if (!css) return [];
  try {
    return selectAll(css, raiz);
  } catch (e) {
    throw new Error('Selector CSS inválido «' + css + '»: ' + (e.message || e));
  }
}
export function uno(raiz, css) {
  if (!css) return null;
  try {
    return selectOne(css, raiz);
  } catch (e) {
    throw new Error('Selector CSS inválido «' + css + '»: ' + (e.message || e));
  }
}

/** Texto que una persona ve en el elemento: sin scripts ni estilos, con saltos entre bloques. */
export function textoVisible(nodo) {
  const partes = [];
  (function recorrer(n) {
    if (!n) return;
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (n.type === 'text') {
      partes.push(n.data);
      return;
    }
    if (n.type === 'tag' || n.type === 'script' || n.type === 'style' || n.type === 'root') {
      const nombre = (n.name || '').toLowerCase();
      if (INVISIBLES.has(nombre)) return;
      if (n.attribs && (n.attribs.hidden !== undefined || /display\s*:\s*none|visibility\s*:\s*hidden/i.test(n.attribs.style || ''))) return;
      const bloque = BLOQUES.has(nombre);
      if (bloque) partes.push('\n');
      if (nombre === 'img' && n.attribs && n.attribs.alt) partes.push(' ' + n.attribs.alt + ' ');
      (n.children || []).forEach(recorrer);
      if (bloque) partes.push('\n');
      else if (nombre === 'td' || nombre === 'th') partes.push(' ');
    } else if (n.children) n.children.forEach(recorrer);
  })(nodo);
  return partes
    .join('')
    .replace(/[   ]/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n[\s]*/g, '\n')
    .trim();
}

/** Valor de un selector de la ficha dentro de `raiz`: texto visible o atributo del primero que cumple. */
export function valor(raiz, spec) {
  const { css, atributo } = partirSelector(spec);
  const el = css ? uno(raiz, css) : raiz;
  if (!el) return '';
  if (atributo) return String(getAttributeValue(el, atributo) || '').trim();
  return textoVisible(el);
}

/** Dirección absoluta a partir de un enlace del documento. Solo http y https. */
export function absoluta(href, base) {
  try {
    const u = new URL(String(href || '').trim(), base);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    u.hash = '';
    return u.href;
  } catch {
    return '';
  }
}

/** Enlaces del documento con su texto. */
export function enlaces(raiz, base) {
  return todos(raiz, 'a[href]')
    .map((a) => ({ href: absoluta(getAttributeValue(a, 'href'), base), texto: textoVisible(a) }))
    .filter((x) => x.href);
}

/** Objetos JSON-LD del documento (los de @graph, aplanados). Los que no se pueden leer se omiten. */
export function jsonLd(raiz) {
  const out = [];
  const agregar = (x) => {
    if (!x || typeof x !== 'object') return;
    if (Array.isArray(x)) return x.forEach(agregar);
    if (Array.isArray(x['@graph'])) x['@graph'].forEach(agregar);
    out.push(x);
  };
  for (const s of todos(raiz, 'script[type="application/ld+json"]')) {
    const t = (s.children || []).map((c) => c.data || '').join('');
    try {
      agregar(JSON.parse(t));
    } catch {
      // JSON-LD mal formado: se ignora, como lo hacen los buscadores
    }
  }
  return out;
}

/** Productos del JSON-LD (schema.org/Product). */
export function productosJsonLd(raiz) {
  const tipo = (x) => [].concat(x['@type'] || []).map(String);
  return jsonLd(raiz).filter((x) => tipo(x).some((t) => /(^|\/)Product$/i.test(t)));
}

/** <meta> del documento: name, property e itemprop → content. */
export function metas(raiz) {
  const m = {};
  for (const el of todos(raiz, 'meta[content]')) {
    const k = getAttributeValue(el, 'property') || getAttributeValue(el, 'name') || getAttributeValue(el, 'itemprop');
    if (k && m[k.toLowerCase()] === undefined) m[k.toLowerCase()] = String(getAttributeValue(el, 'content') || '').trim();
  }
  return m;
}

/** Título de la página. */
export function tituloPagina(raiz) {
  const t = uno(raiz, 'title');
  return t ? textoVisible({ type: 'root', children: t.children || [] }) : '';
}
