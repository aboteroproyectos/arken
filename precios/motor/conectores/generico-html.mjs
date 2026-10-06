// ARKEN PRECIOS · motor · conector genérico de páginas HTML (§7.2).
//
// Se configura en la ficha de la fuente, sin programar:
//   modo         'busqueda' (una página de resultados por insumo) o 'lista' (páginas de categorías)
//   busqueda     { plantilla: 'https://sitio/buscar?q={consulta}', maxResultados }
//   lista        { urls: [...], siguiente: 'a[rel=next]@href', maxPaginas }
//   tarjeta      selector CSS de cada producto en la página
//   campos       { titulo, enlace, precio, precioAnterior, unidad, presentacion, disponibilidad, id }
//   producto     { titulo, precio, precioAnterior, unidad, presentacion, disponibilidad } en la página de un producto
//   incluyeIva, ciudad, tipoPrecio
// Un selector es CSS; «css@atributo» lee un atributo y «@atributo» el de la tarjeta misma.
//
// El texto literal de cada producto es el trozo del texto visible de su tarjeta alrededor del
// precio; la evidencia es el texto visible de la página donde se leyó.

import { leerHtml, todos, valor, textoVisible, absoluta, tituloPagina, productosJsonLd } from '../html.mjs';
import { crudo, disponibilidad, ventana, alrededor, formato, unaLinea } from './comun.mjs';

const SIGUIENTE = 'a[rel=next]@href';

/** Lee una página HTML con las reglas del motor. */
export async function leerPaginaHtml(url, contexto) {
  const r = await contexto.traer(url, { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', tipo: 'texto' });
  const doc = leerHtml(r.texto);
  return { url: r.final || r.url || url, pedida: url, doc, texto: textoVisible(doc), recuperada: r.recuperada, desdeCache: r.desdeCache };
}

/** Página leída → la parte que viaja con cada hallazgo como evidencia. */
export function evidencia(pagina, literal, tipo = 'html') {
  return { url: pagina.url, texto: alrededor(pagina.texto, literal, 1500), leida: true, tipo, recuperada: pagina.recuperada };
}

function condicionesPromocion(actual, anterior, leer) {
  if (!anterior) return '';
  const a = leer ? leer(anterior) : null;
  const b = leer ? leer(actual) : null;
  if (a && b && a > b) return 'Promoción: precio anterior ' + unaLinea(anterior) + '.';
  return '';
}

/** Productos de una página: una tarjeta por producto, con su texto literal. */
export function tarjetasDe(pagina, cfg, contexto) {
  const campos = cfg.campos || {};
  const out = [];
  const tarjetas = todos(pagina.doc, cfg.tarjeta);
  for (const t of tarjetas) {
    const titulo = unaLinea(valor(t, campos.titulo));
    const precioTexto = unaLinea(valor(t, campos.precio));
    if (!titulo || !precioTexto) continue;
    const href = valor(t, campos.enlace || 'a@href');
    const url = absoluta(href, pagina.url) || pagina.url;
    const textoTarjeta = unaLinea(textoVisible(t));
    // El literal es el texto de la tarjeta alrededor del precio, para que el nombre quede cerca
    const literal = ventana(textoTarjeta, precioTexto, 220, 120) || precioTexto;
    const anterior = campos.precioAnterior ? unaLinea(valor(t, campos.precioAnterior)) : '';
    const id = campos.id ? unaLinea(valor(t, campos.id)) : '';
    out.push(
      crudo({
        titulo,
        url,
        precioTexto,
        unidadTexto: campos.unidad ? unaLinea(valor(t, campos.unidad)) : '',
        presentacion: campos.presentacion ? unaLinea(valor(t, campos.presentacion)) : '',
        disponibilidad: campos.disponibilidad ? disponibilidad(valor(t, campos.disponibilidad)) : '',
        proveedor: cfg.proveedor || '',
        textoLiteral: literal,
        incluyeIva: cfg.incluyeIva,
        ciudad: cfg.ciudad || '',
        condiciones: condicionesPromocion(precioTexto, anterior, contexto && contexto.leerPrecio),
        clave: id ? (cfg.clavePrefijo || (contexto && contexto.fuente && contexto.fuente.id) || 'html') + ':' + id : null,
        pagina: evidencia(pagina, literal),
      }),
    );
  }
  return { crudos: out, tarjetas: tarjetas.length };
}

/** Busca un insumo con la plantilla de búsqueda de la ficha. */
export async function buscarHtml({ insumo, contexto }, cfg) {
  const consulta = contexto.consulta(insumo);
  if (!consulta) return [];
  const url = contexto.plantilla(cfg.busqueda.plantilla, { consulta });
  const pagina = await leerPaginaHtml(url, contexto);
  const { crudos } = tarjetasDe(pagina, cfg, contexto);
  return crudos.slice(0, (cfg.busqueda && cfg.busqueda.maxResultados) || contexto.limites.resultadosPorBusqueda || 12);
}

/**
 * Lee las páginas de la lista (categorías) y su paginación.
 * @returns {{ crudos, paginas, vacias }}
 */
export async function leerListaHtml({ contexto }, cfg) {
  const lista = cfg.lista || {};
  const urls = (lista.urls || []).slice();
  const maxPorLista = lista.maxPaginas || 20;
  const maxTotal = contexto.limites.paginasPorLista || 60;
  const vistas = new Set();
  const crudos = [];
  let paginas = 0;
  let vacias = 0;
  let conTarjetas = 0;
  for (const inicio of urls) {
    let url = inicio;
    for (let k = 0; url && k < maxPorLista && paginas < maxTotal; k++) {
      if (vistas.has(url)) break;
      vistas.add(url);
      let pagina;
      try {
        pagina = await leerPaginaHtml(url, contexto);
      } catch (e) {
        // Una categoría que ya no existe, o una dirección que el robots.txt no permite, no
        // detiene las demás; un bloqueo o una caída del sitio sí (lo decide el motor)
        if (contexto.esDeElemento(e)) {
          contexto.falla(e, url);
          break;
        }
        throw e;
      }
      paginas++;
      contexto.progreso({ paginas, url });
      const r = tarjetasDe(pagina, cfg, contexto);
      if (r.tarjetas) conTarjetas++;
      else vacias++;
      for (const c of r.crudos) crudos.push(c);
      const sig = absoluta(valor(pagina.doc, lista.siguiente || SIGUIENTE), pagina.url);
      url = sig && new URL(sig).host === new URL(pagina.url).host ? sig : null;
    }
    if (paginas >= maxTotal) {
      contexto.aviso('Se leyó el máximo de ' + maxTotal + ' páginas de la lista en esta ejecución.');
      break;
    }
  }
  if (paginas && !conTarjetas) throw formato('Ninguna página de la lista tiene productos con el selector «' + cfg.tarjeta + '».', urls[0]);
  return { crudos, paginas, vacias };
}

/** Lee la página de un producto ya vinculado: el precio visible y, si hay, su JSON-LD. */
export async function leerProductoHtml({ vinculo, contexto }, cfg) {
  const p = cfg.producto || {};
  const pagina = await leerPaginaHtml(vinculo.url, contexto);
  const ld = productosJsonLd(pagina.doc)[0] || null;
  const titulo = unaLinea((p.titulo && valor(pagina.doc, p.titulo)) || (ld && ld.name) || tituloPagina(pagina.doc));
  const precioTexto = unaLinea(p.precio ? valor(pagina.doc, p.precio) : '');
  if (!precioTexto) throw formato('La página del producto no muestra el precio con el selector «' + (p.precio || '') + '».', vinculo.url);
  const literal = ventana(pagina.texto, precioTexto, 160, 100) || precioTexto;
  const anterior = p.precioAnterior ? unaLinea(valor(pagina.doc, p.precioAnterior)) : '';
  const oferta = ld && [].concat(ld.offers || [])[0];
  return crudo({
    titulo,
    url: vinculo.url,
    precioTexto,
    unidadTexto: p.unidad ? unaLinea(valor(pagina.doc, p.unidad)) : '',
    presentacion: p.presentacion ? unaLinea(valor(pagina.doc, p.presentacion)) : '',
    disponibilidad: p.disponibilidad
      ? disponibilidad(valor(pagina.doc, p.disponibilidad))
      : oferta && oferta.availability
        ? disponibilidad(String(oferta.availability).replace(/^.*\//, ''))
        : '',
    proveedor: cfg.proveedor || '',
    textoLiteral: literal,
    incluyeIva: cfg.incluyeIva,
    ciudad: cfg.ciudad || '',
    condiciones: condicionesPromocion(precioTexto, anterior, contexto.leerPrecio),
    clave: vinculo.clave || null,
    pagina: evidencia(pagina, literal),
  });
}

export default {
  id: 'generico-html',
  nombre: 'Páginas HTML (genérico)',
  tipo: 'genérico',
  metodo: 'html',
  async buscar(a) {
    return buscarHtml(a, a.contexto.config);
  },
  async leerLista(a) {
    return leerListaHtml(a, a.contexto.config);
  },
  async leerProducto(a) {
    return leerProductoHtml(a, a.contexto.config);
  },
};
