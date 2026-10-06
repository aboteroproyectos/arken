// ARKEN PRECIOS · motor · conector certificado: Easy Colombia (tienda en línea).
//
// Lee la API pública del catálogo de la tienda (VTEX), la misma que usa su página:
//   búsqueda   /api/catalog_system/pub/products/search?ft={consulta}&_from=0&_to=9
//   producto   /api/catalog_system/pub/products/search/{enlace}/p
// Revisión (decisiones de la Fase 3): su robots.txt no cierra /api/ (sí /busca, /account y los
// filtros con «map», «fq» y «specificationFilter»; una consulta que los contenga no se hace) y
// sus términos dicen que los precios publicados incluyen IVA. El precio es el del vendedor por
// defecto; si es menor que el precio de lista, es una promoción.

import { crudo, pares, unaLinea, disponibilidad } from './comun.mjs';

const BASE = 'https://www.easy.com.co';
const BUSQUEDA = BASE + '/api/catalog_system/pub/products/search?ft={consulta}&_from=0&_to={hasta|crudo}';
const PRODUCTO = BASE + '/api/catalog_system/pub/products/search/{enlace}/p';
const RE_PRODUCTO = /^https?:\/\/(?:www\.)?easy\.com\.co\/([^/?#]+)\/p\/?(?:[?#].*)?$/i;

/** Enlace de la página de un producto → su «linkText» en la API. */
export function enlaceDe(url) {
  const m = RE_PRODUCTO.exec(String(url || ''));
  return m ? m[1] : null;
}

function texto(v) {
  return v === undefined || v === null ? '' : unaLinea(v);
}

/** Un producto de la API → un hallazgo por cada referencia (item) con precio. */
export function hallazgosDeProducto(p, lectura, cfg, soloItem) {
  const out = [];
  const items = Array.isArray(p.items) ? p.items : [];
  for (const it of items.slice(0, 4)) {
    if (soloItem && String(it.itemId) !== String(soloItem)) continue;
    const vendedores = Array.isArray(it.sellers) ? it.sellers : [];
    const v = vendedores.find((s) => s.sellerDefault) || vendedores[0];
    const o = v && v.commertialOffer;
    if (!o || !(Number(o.Price) > 0)) continue;
    const nombre = texto(it.nameComplete || it.name || p.productName);
    // Evidencia: el producto como lo entrega la API, con el nombre y el precio al comienzo
    const literal = pares([
      ['productName', p.productName],
      ['Price', o.Price],
    ]);
    const resto = pares([
      ['ListPrice', o.ListPrice],
      ['PriceWithoutDiscount', o.PriceWithoutDiscount],
      ['itemName', it.name],
      ['measurementUnit', it.measurementUnit],
      ['unitMultiplier', it.unitMultiplier],
      ['IsAvailable', o.IsAvailable],
      ['AvailableQuantity', o.AvailableQuantity],
      ['PriceValidUntil', o.PriceValidUntil],
      ['sellerName', v.sellerName],
      ['brand', p.brand],
      ['categories', Array.isArray(p.categories) ? p.categories[0] : p.categories],
      ['ean', it.ean],
      ['itemId', it.itemId],
      ['link', p.link],
    ]);
    const lista = Number(o.ListPrice);
    const precio = Number(o.Price);
    out.push(
      crudo({
        titulo: nombre,
        url: texto(p.link) || lectura.url,
        precioTexto: String(o.Price),
        unidadTexto: texto(it.measurementUnit),
        presentacion: '',
        disponibilidad: disponibilidad(!!o.IsAvailable && Number(o.AvailableQuantity) > 0),
        proveedor: cfg.proveedor || 'Easy Colombia',
        textoLiteral: literal,
        precio,
        incluyeIva: cfg.incluyeIva === false ? false : true,
        ciudad: cfg.ciudad || '',
        condiciones: lista > precio ? 'Promoción: precio de lista ' + lista + '.' : '',
        clave: 'easy:' + it.itemId,
        pagina: { url: lectura.url, texto: literal + (resto ? ' | ' + resto : ''), leida: true, tipo: 'json', recuperada: lectura.recuperada },
      }),
    );
  }
  return out;
}

async function leer(url, contexto) {
  const r = await contexto.traer(url, { accept: 'application/json', tipo: 'json' });
  return { url: r.final || r.url || url, json: r.json, recuperada: r.recuperada };
}

export default {
  id: 'easy',
  nombre: 'Easy Colombia',
  tipo: 'tienda en línea',
  metodo: 'api-json',
  modo: 'busqueda',
  async buscar({ insumo, contexto }) {
    const consulta = contexto.consulta(insumo);
    if (!consulta) return [];
    const max = Math.min(contexto.limites.resultadosPorBusqueda || 10, 20);
    const lectura = await leer(contexto.plantilla(BUSQUEDA, { consulta, hasta: max - 1 }), contexto);
    if (!Array.isArray(lectura.json)) throw contexto.errorFormato('La búsqueda de Easy no devolvió una lista de productos.', lectura.url);
    return lectura.json.flatMap((p) => hallazgosDeProducto(p, lectura, contexto.config)).slice(0, max);
  },
  async leerProducto({ vinculo, contexto }) {
    const enlace = enlaceDe(vinculo.url);
    if (!enlace) return null;
    const lectura = await leer(contexto.plantilla(PRODUCTO, { enlace }), contexto);
    const p = Array.isArray(lectura.json) ? lectura.json[0] : null;
    if (!p) return null;
    const item = vinculo.clave && /^easy:/.test(vinculo.clave) ? vinculo.clave.slice(5) : null;
    const h = hallazgosDeProducto(p, lectura, contexto.config, item)[0] || null;
    if (h) h.url = vinculo.url;
    return h;
  },
};
