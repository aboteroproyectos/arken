// ARKEN PRECIOS · motor · conector genérico de datos abiertos en Socrata (datos.gov.co) (§7.2).
//
// Se configura en la ficha de la fuente:
//   dominio      'www.datos.gov.co'
//   conjunto     identificador del conjunto de datos ('3hdv-smhz')
//   campos       columnas: { titulo, precio, unidad, fecha, proveedor, id, cantidad, ciudad, entidad }
//   filtro       condición SoQL adicional; {desde} es la fecha de hace `diasAtras` días
//   diasAtras    365
//   orden        'fecha DESC'
//   limite       50 filas por búsqueda
//   limpiarTitulo  expresión regular que se quita del comienzo del nombre (códigos internos)
//   union        { conjunto, local, remoto, campos: { ciudad, entidad, proveedor } }: completa cada
//                fila con otra tabla (por ejemplo, la ciudad de la orden de compra)
//   enlace       plantilla de la dirección de cada fila; por defecto la consulta de su id
//   incluyeIva, ciudad, tipoPrecio, atribucion
//
// La búsqueda usa el texto completo de Socrata ($q). La evidencia de cada fila es la fila misma
// escrita como texto («columna: valor | …»).

import { crudo, pares, formato, unaLinea, huellaTexto } from './comun.mjs';

const NO_DEFINIDO = /^(no\s+defin|no\s+aplica|n\/a$|sin\s+defin)/i;

function valorUtil(v) {
  const t = unaLinea(v);
  return t && !NO_DEFINIDO.test(t) ? t : '';
}

function columna(c) {
  return /^[a-z0-9_]+$/.test(String(c || '')) ? c : null;
}

/** Dirección de una consulta SoQL: los parámetros $… van sin codificar el «$», los valores sí. */
export function consultaSoql(dominio, conjunto, parametros) {
  const q = Object.entries(parametros)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => k + '=' + encodeURIComponent(String(v)))
    .join('&');
  return 'https://' + dominio + '/resource/' + conjunto + '.json' + (q ? '?' + q : '');
}

function hace(dias, hoy) {
  const base = hoy ? Date.parse(hoy + 'T12:00:00Z') : Date.now();
  return new Date(base - dias * 86400000).toISOString().slice(0, 10);
}

/** Limpia el nombre de una fila: códigos del comienzo y el nombre repetido («A. A - UND»). */
export function limpiarNombre(texto, patron) {
  let t = unaLinea(texto);
  if (patron) {
    try {
      t = t.replace(new RegExp(patron, 'i'), '').trim();
    } catch {
      // La ficha valida la expresión; si aun así falla, el nombre queda como viene
    }
  }
  t = t.replace(/\s+\./g, '.');
  const m = /^(.{6,}?)\.{1,2}\s+(.*)$/.exec(t);
  if (m && m[2].toLowerCase().startsWith(m[1].toLowerCase())) t = m[2];
  return t.replace(/\s+-\s*(und|unidad|un)\.?$/i, '').trim();
}

async function unir(filas, cfg, contexto) {
  const u = cfg.union;
  if (!u || !u.conjunto || !columna(u.local) || !columna(u.remoto)) return new Map();
  const ids = Array.from(new Set(filas.map((f) => String(f[u.local] || '')).filter((x) => /^[\w-]{1,40}$/.test(x)))).slice(0, 100);
  if (!ids.length) return new Map();
  const campos = Object.values(u.campos || {}).filter(columna);
  const url = consultaSoql(cfg.dominio, u.conjunto, {
    $select: [u.remoto].concat(campos).join(','),
    $where: u.remoto + ' in (' + ids.map((x) => "'" + x + "'").join(',') + ')',
    $limit: ids.length * 2,
  });
  const r = await contexto.traer(url, { accept: 'application/json', tipo: 'json' });
  const mapa = new Map();
  for (const x of Array.isArray(r.json) ? r.json : []) mapa.set(String(x[u.remoto]), x);
  return mapa;
}

/** Fila → hallazgo crudo. */
export function filaSocrata(f, extra, cfg, lectura, contexto) {
  const c = cfg.campos || {};
  const tituloOriginal = unaLinea(f[c.titulo]);
  const precioTexto = unaLinea(f[c.precio]);
  if (!tituloOriginal || !precioTexto) return null;
  const precio = Number(precioTexto);
  if (!(precio > 0)) return null;
  const u = (cfg.union && cfg.union.campos) || {};
  const id = valorUtil(f[c.id]);
  const ciudad = valorUtil(extra && u.ciudad ? extra[u.ciudad] : f[c.ciudad]) || cfg.ciudad || '';
  const entidad = valorUtil(extra && u.entidad ? extra[u.entidad] : f[c.entidad]);
  const proveedor = valorUtil(extra && u.proveedor ? extra[u.proveedor] : '') || valorUtil(f[c.proveedor]);
  const unidad = unaLinea(f[c.unidad]);
  // Literal: el nombre, el precio y la unidad, al comienzo de la evidencia
  const literal = pares([
    [c.titulo, tituloOriginal],
    [c.precio, precioTexto],
    [c.unidad, unidad],
  ]);
  const resto = Object.keys(f)
    .filter((k) => k !== c.titulo && k !== c.precio && k !== c.unidad && !/^:/.test(k))
    .map((k) => [k, f[k]]);
  const deUnion = extra && cfg.union ? Object.entries(u).map(([k, col]) => [k + ' (' + cfg.union.conjunto + ')', extra[col]]) : [];
  const texto = [literal, pares(resto), pares(deUnion)].filter(Boolean).join(' | ');
  const enlace = cfg.enlace
    ? contexto.plantilla(cfg.enlace, { id, dominio: cfg.dominio, conjunto: cfg.conjunto })
    : consultaSoql(cfg.dominio, cfg.conjunto, id && columna(c.id) ? { [c.id]: id } : {});
  const condiciones = [
    id ? 'Orden ' + id : '',
    entidad ? 'Comprador: ' + entidad : '',
    c.cantidad && f[c.cantidad] ? 'Cantidad: ' + unaLinea(f[c.cantidad]) : '',
    cfg.atribucion ? 'Datos: ' + cfg.atribucion : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return crudo({
    titulo: limpiarNombre(tituloOriginal, cfg.limpiarTitulo),
    url: enlace,
    precioTexto,
    unidadTexto: unidad,
    presentacion: '',
    disponibilidad: '',
    proveedor,
    fechaVisible: unaLinea(f[c.fecha]).slice(0, 10),
    textoLiteral: literal,
    precio,
    incluyeIva: cfg.incluyeIva,
    ciudad,
    condiciones,
    clave: (cfg.clavePrefijo || (contexto && contexto.fuente && contexto.fuente.id) || cfg.conjunto) + ':' + (id || '-') + ':' + huellaTexto(tituloOriginal + '|' + precioTexto),
    pagina: { url: lectura.url, texto, leida: true, tipo: 'json', recuperada: lectura.recuperada },
  });
}

export async function buscarSocrata({ insumo, contexto }, cfg) {
  const consulta = contexto.consulta(insumo);
  if (!consulta) return [];
  const c = cfg.campos || {};
  const desde = hace(Number(cfg.diasAtras) > 0 ? Number(cfg.diasAtras) : 365, contexto.hoy);
  // El filtro es SoQL, no una dirección: {desde} se reemplaza por la fecha tal cual
  const where = cfg.filtro ? String(cfg.filtro).replace(/\{desde\}/g, desde) : '';
  const url = consultaSoql(cfg.dominio, cfg.conjunto, {
    $q: consulta,
    $where: where,
    $order: cfg.orden || (columna(c.fecha) ? c.fecha + ' DESC' : ''),
    $limit: Math.min(Number(cfg.limite) || 50, 200),
  });
  const r = await contexto.traer(url, { accept: 'application/json', tipo: 'json' });
  if (!Array.isArray(r.json)) throw formato('La consulta de datos abiertos no devolvió una lista de filas.', url);
  const lectura = { url: r.final || r.url || url, recuperada: r.recuperada };
  // Filas repetidas (el mismo renglón de la misma orden con otra cantidad) se cuentan una vez
  const vistas = new Set();
  const filas = r.json.filter((f) => {
    const k = [f[c.id], f[c.titulo], f[c.precio]].join('|');
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  });
  let extra = new Map();
  try {
    extra = await unir(filas, cfg, contexto);
  } catch (e) {
    if (!contexto.esDeElemento(e)) throw e;
    contexto.falla(e, url);
  }
  return filas
    .map((f) => filaSocrata(f, cfg.union ? extra.get(String(f[cfg.union.local])) : null, cfg, lectura, contexto))
    .filter(Boolean)
    .slice(0, contexto.limites.resultadosPorBusqueda || 50);
}

export default {
  id: 'generico-socrata',
  nombre: 'Datos abiertos Socrata (genérico)',
  tipo: 'genérico',
  metodo: 'socrata',
  async buscar(a) {
    return buscarSocrata(a, a.contexto.config);
  },
  // Una fila de datos abiertos es un hecho pasado (una compra): no se vuelve a leer
  async leerProducto() {
    return null;
  },
};
