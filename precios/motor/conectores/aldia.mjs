// ARKEN PRECIOS · motor · conector certificado: Ferretería Aldia (Bucaramanga).
//
// Tienda en PrestaShop. Su robots.txt no permite la búsqueda (/*?search_query=, controller=search)
// ni ordenar o cambiar el número de productos por página (?order=, ?n=), así que se leen sus
// páginas de categorías, con la paginación que el sitio mismo enlaza (rel="next", ?page=N).
// Cada tarjeta trae nombre, precio visible y disponibilidad; el precio incluye impuestos («Impuestos
// incluidos» en la tienda; Ley 1480 de 2011, art. 26). La ficha puede cambiar la lista de
// categorías en configuracion.lista.urls.

import { leerListaHtml, leerProductoHtml } from './generico-html.mjs';

const BASE = 'https://aldiaferreteria.com';
export const CATEGORIAS = [
  '/cementos-concretos-y-morteros',
  '/obras-y-construccion-/hierro-ductil-',
  '/obras-y-construccion-/placas-de-yeso-drywall',
  '/estucos-y-masillas',
  '/pegantes-y-boquillas',
  '/impermeabilizantes-aditivos-toxement',
  '/aditivos-para-construccion',
  '/sistemas-de-impermeabilizacion',
  '/tuberias-y-accesorios-pvc',
  '/pisos-y-paredes',
  '/porcelana-sanitaria',
  '/cubiertas',
  '/pinturas',
  '/electricos',
].map((p) => BASE + p);

export const CONFIGURACION = {
  modo: 'lista',
  lista: { urls: CATEGORIAS, siguiente: 'a[rel=next]@href', maxPaginas: 15 },
  tarjeta: '.product-miniature',
  campos: {
    titulo: '.product_name',
    enlace: '.product_name@href',
    precio: '.price',
    precioAnterior: '.regular-price',
    disponibilidad: '.availability',
    id: '@data-id-product',
  },
  producto: {
    titulo: 'h1',
    precio: '.current-price-value, .current-price .price, .product-prices .price',
    precioAnterior: '.product-discount .regular-price',
    disponibilidad: '#product-availability',
  },
  incluyeIva: true,
  ciudad: 'Bucaramanga',
  proveedor: 'Ferretería Aldia',
  clavePrefijo: 'aldia',
};

/** La configuración base con lo que la ficha cambie (solo la lista de categorías y la ciudad). */
export function configuracion(cfg) {
  const c = cfg || {};
  const urls = c.lista && Array.isArray(c.lista.urls) && c.lista.urls.length ? c.lista.urls : CONFIGURACION.lista.urls;
  return Object.assign({}, CONFIGURACION, {
    lista: Object.assign({}, CONFIGURACION.lista, { urls }),
    ciudad: c.ciudad || CONFIGURACION.ciudad,
    incluyeIva: c.incluyeIva === false ? false : true,
  });
}

export default {
  id: 'aldia',
  nombre: 'Ferretería Aldia',
  tipo: 'tienda en línea',
  metodo: 'html',
  modo: 'lista',
  async leerLista({ contexto }) {
    return leerListaHtml({ contexto }, configuracion(contexto.config));
  },
  async leerProducto({ vinculo, contexto }) {
    return leerProductoHtml({ vinculo, contexto }, configuracion(contexto.config));
  },
  // La tienda no permite su búsqueda a los robots: no se busca
  async buscar() {
    return [];
  },
};
// Para pruebas: el genérico con esta configuración también sirve para una búsqueda simulada
