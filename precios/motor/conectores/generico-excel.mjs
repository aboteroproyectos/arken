// ARKEN PRECIOS · motor · conector genérico de una tabla en Excel (§7.2).
//
// Se configura en la ficha de la fuente:
//   archivo         { url } o { pagina, texto, patron }: dónde está el archivo vigente
//   hoja            nombre de la hoja (por defecto, la primera)
//   filaEncabezado  fila de los encabezados (si no, se busca en las primeras 60)
//   columnas        { titulo, precio, unidad, codigo, grupo, presentacion }: el texto de cada
//                   encabezado, o «letra:G» para una columna fija
//   fecha           { celda: 'G8' } o { celdas: ['G7', 'G8'] }: dónde dice la fecha de los precios
//   incluyeIva, ciudad, tipoPrecio
//
// Cada fila con nombre y precio es un hallazgo. Su texto literal es el renglón completo, con sus
// encabezados («Código: 322 | Nombre: … | Precio: $ 564,303»), y el precio es el número que se
// ve en la celda.

import { leerExcel, tablaExcel, textoCelda, celda } from '../tablas.mjs';
import { ubicarArchivo, descargarArchivo } from './archivos.mjs';
import { crudo, formato, ventana, unaLinea, fechaDeTexto, huellaTexto } from './comun.mjs';

/** Fecha de los precios según las celdas de la ficha: la más reciente que se pueda leer. */
export function fechaDeCeldas(hoja, cfgFecha) {
  if (!cfgFecha) return { fecha: '', textos: [] };
  const refs = [].concat(cfgFecha.celdas || [], cfgFecha.celda || []).filter(Boolean);
  const textos = [];
  let fecha = '';
  for (const ref of refs) {
    const t = textoCelda(celda(hoja, ref));
    if (!t) continue;
    textos.push(t);
    const f = fechaDeTexto(t);
    if (f && f > fecha) fecha = f;
  }
  return { fecha, textos };
}

/** Lee el libro, la hoja y la tabla de la ficha. */
export async function leerTablaExcel(cfg, contexto) {
  const ubicado = await ubicarArchivo(cfg.archivo, contexto);
  const archivo = await descargarArchivo(ubicado.url, contexto);
  contexto.progreso({ archivo: ubicado.url, bytes: archivo.bytes.length });
  let libro;
  try {
    libro = leerExcel(archivo.bytes, { hojas: cfg.hoja ? [cfg.hoja] : null, maxFilas: cfg.maxFilas || 100000 });
  } catch (e) {
    throw formato(String(e.message || e), ubicado.url);
  }
  const hoja = cfg.hoja ? libro.hojas.find((h) => h.nombre === cfg.hoja) : libro.hojas[0];
  if (!hoja) throw formato('El archivo no tiene la hoja «' + cfg.hoja + '» (tiene: ' + libro.nombres.slice(0, 12).join(', ') + ').', ubicado.url);
  const tabla = tablaExcel(hoja, { columnas: cfg.columnas, filaEncabezado: cfg.filaEncabezado, requeridos: ['titulo', 'precio'] });
  if (!tabla.ok) throw formato(tabla.motivo, ubicado.url);
  return { ubicado, archivo, libro, hoja, tabla };
}

/** Fila de la tabla → hallazgo crudo. */
export function filaExcel(fila, hoja, cfg, archivo, extra) {
  const v = fila.valores;
  const titulo = unaLinea(textoCelda(v.titulo));
  const precioTexto = unaLinea(textoCelda(v.precio));
  if (!titulo || !precioTexto) return null;
  // Solo filas con un precio numérico: los subtítulos y las notas no son precios
  if (!(typeof v.precio.v === 'number' && v.precio.v > 0) && !/\d/.test(precioTexto)) return null;
  const codigo = v.codigo ? unaLinea(textoCelda(v.codigo)) : '';
  const renglon = unaLinea(fila.texto);
  const literal = renglon.length <= 700 ? renglon : ventana(renglon, precioTexto, 350, 150) || precioTexto;
  const ubicacion = 'Hoja «' + hoja.nombre + '», fila ' + fila.fila + ': ';
  const prefijo = cfg.clavePrefijo || (extra && extra.fuenteId) || 'excel';
  return crudo({
    titulo,
    url: archivo.url,
    precioTexto,
    unidadTexto: v.unidad ? unaLinea(textoCelda(v.unidad)) : '',
    presentacion: v.presentacion ? unaLinea(textoCelda(v.presentacion)) : '',
    disponibilidad: '',
    proveedor: cfg.proveedor || '',
    fechaVisible: (extra && extra.fecha) || '',
    textoLiteral: literal,
    incluyeIva: cfg.incluyeIva,
    ciudad: cfg.ciudad || '',
    condiciones: [v.grupo ? 'Grupo: ' + unaLinea(textoCelda(v.grupo)) : '', extra && extra.condiciones ? extra.condiciones : ''].filter(Boolean).join(' · '),
    clave: prefijo + ':' + (codigo || huellaTexto(titulo)),
    pagina: { url: archivo.url, texto: ubicacion + renglon, leida: true, tipo: 'excel', recuperada: archivo.recuperada },
  });
}

export async function leerListaExcel({ contexto }, cfg) {
  const { ubicado, archivo, hoja, tabla } = await leerTablaExcel(cfg, contexto);
  const f = fechaDeCeldas(hoja, cfg.fecha);
  const extra = { fecha: f.fecha, condiciones: f.textos.join(' · '), fuenteId: contexto.fuente && contexto.fuente.id };
  const crudos = [];
  for (const fila of tabla.filas) {
    const c = filaExcel(fila, hoja, cfg, { url: ubicado.url, recuperada: archivo.recuperada }, extra);
    if (c) crudos.push(c);
  }
  if (!crudos.length) throw formato('La hoja «' + hoja.nombre + '» no tiene filas con nombre y precio.', ubicado.url);
  return { crudos, paginas: 1, archivo: ubicado.url, fecha: f.fecha, filas: tabla.filas.length };
}

export default {
  id: 'generico-excel',
  nombre: 'Tabla en Excel (genérico)',
  tipo: 'genérico',
  metodo: 'excel',
  async leerLista(a) {
    return leerListaExcel(a, a.contexto.config);
  },
  async buscar() {
    return [];
  },
  async leerProducto() {
    return null;
  },
};
