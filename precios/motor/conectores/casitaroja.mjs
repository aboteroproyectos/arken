// ARKEN PRECIOS · motor · conector certificado: Ferretería La Casita Roja (Cartagena).
//
// Lee la API pública de la tienda (WooCommerce Store API), la que usa su propia página:
//   búsqueda   /wp-json/wc/store/v1/products?search={consulta}&per_page=10
//   producto   /wp-json/wc/store/v1/products?slug={slug}
// Su robots.txt no cierra /wp-json/. El precio viene en centavos (currency_minor_unit) y el
// texto literal es el precio tal como lo muestra la tienda (price_html). Es precio al
// consumidor: incluye los impuestos (Ley 1480 de 2011, art. 26).

import { crudo, pares, unaLinea, textoDeHtml, disponibilidad } from './comun.mjs';

const BASE = 'https://ferreterialacasitaroja.com';
const BUSQUEDA = BASE + '/wp-json/wc/store/v1/products?search={consulta}&per_page={n|crudo}';
const PRODUCTO = BASE + '/wp-json/wc/store/v1/products?slug={slug}';
const RE_PRODUCTO = /^https?:\/\/(?:www\.)?ferreterialacasitaroja\.com\/product\/([^/?#]+)\/?/i;

export function slugDe(url) {
  const m = RE_PRODUCTO.exec(String(url || ''));
  return m ? m[1] : null;
}

/** Un producto de la API → hallazgo crudo (o null si no tiene un precio único). */
export function hallazgoDeProducto(p, lectura, cfg) {
  const pr = p && p.prices;
  if (!pr || pr.price_range || p.type === 'variable') return null;
  const menor = Number.isInteger(pr.currency_minor_unit) ? pr.currency_minor_unit : 2;
  const divisor = Math.pow(10, menor);
  const precio = Number(pr.price) / divisor;
  if (!(precio > 0)) return null;
  const regular = Number(pr.regular_price) / divisor;
  const visible = textoDeHtml(p.price_html);
  if (!visible) return null;
  const nombre = textoDeHtml(p.name);
  const literal = pares([
    ['name', nombre],
    ['price_html', visible],
  ]);
  const resto = pares([
    ['prices.price', pr.price],
    ['prices.regular_price', pr.regular_price],
    ['prices.sale_price', pr.sale_price],
    ['prices.currency_minor_unit', menor],
    ['prices.currency_code', pr.currency_code],
    ['is_in_stock', p.is_in_stock],
    ['categories', (p.categories || []).map((c) => (typeof c === 'string' ? c : c && c.name)).filter(Boolean).join(', ')],
    ['sku', p.sku],
    ['id', p.id],
    ['permalink', p.permalink],
  ]);
  return crudo({
    titulo: nombre,
    url: unaLinea(p.permalink) || lectura.url,
    precioTexto: visible,
    unidadTexto: '',
    disponibilidad: disponibilidad(p.is_in_stock === true ? true : p.is_in_stock === false ? false : ''),
    proveedor: cfg.proveedor || 'Ferretería La Casita Roja',
    textoLiteral: literal,
    precio,
    // Precio al consumidor: incluye los impuestos (Ley 1480 de 2011, art. 26), salvo que la ficha diga otra cosa
    incluyeIva: cfg.incluyeIva === false ? false : true,
    ciudad: cfg.ciudad || 'Cartagena',
    condiciones: regular > precio ? 'Promoción: precio regular ' + regular + '.' : '',
    clave: 'casitaroja:' + p.id,
    pagina: { url: lectura.url, texto: literal + (resto ? ' | ' + resto : ''), leida: true, tipo: 'json', recuperada: lectura.recuperada },
  });
}

async function leer(url, contexto) {
  const r = await contexto.traer(url, { accept: 'application/json', tipo: 'json' });
  return { url: r.final || r.url || url, json: r.json, recuperada: r.recuperada };
}

export default {
  id: 'casitaroja',
  nombre: 'Ferretería La Casita Roja',
  tipo: 'tienda en línea',
  metodo: 'api-json',
  modo: 'busqueda',
  async buscar({ insumo, contexto }) {
    const consulta = contexto.consulta(insumo);
    if (!consulta) return [];
    const n = Math.min(contexto.limites.resultadosPorBusqueda || 10, 20);
    const lectura = await leer(contexto.plantilla(BUSQUEDA, { consulta, n }), contexto);
    if (!Array.isArray(lectura.json)) throw contexto.errorFormato('La búsqueda de La Casita Roja no devolvió una lista de productos.', lectura.url);
    return lectura.json.map((p) => hallazgoDeProducto(p, lectura, contexto.config)).filter(Boolean);
  },
  async leerProducto({ vinculo, contexto }) {
    const slug = slugDe(vinculo.url);
    if (!slug) return null;
    const lectura = await leer(contexto.plantilla(PRODUCTO, { slug }), contexto);
    const p = Array.isArray(lectura.json) ? lectura.json[0] : null;
    const h = p ? hallazgoDeProducto(p, lectura, contexto.config) : null;
    if (h) h.url = vinculo.url;
    return h;
  },
};
