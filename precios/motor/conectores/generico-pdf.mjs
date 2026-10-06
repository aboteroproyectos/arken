// ARKEN PRECIOS · motor · conector genérico de una tabla en PDF (§7.2).
//
// Se configura en la ficha de la fuente:
//   archivo      { url } o { pagina, texto, patron }: dónde está el PDF vigente
//   columnas     { titulo, precio, unidad, codigo }: el texto de cada encabezado de la tabla
//   maxPaginas   páginas que se leen (200)
//   fecha        { patron }: expresión que encuentra la fecha de los precios en el texto
//   incluyeIva, ciudad, tipoPrecio
//
// El PDF tiene que traer texto (no una imagen escaneada). Cada línea de la tabla con nombre y
// precio es un hallazgo; su texto literal es la línea tal como se lee en el PDF.

import { leerPdf, tablaPdf } from '../tablas.mjs';
import { ubicarArchivo, descargarArchivo } from './archivos.mjs';
import { crudo, formato, unaLinea, fechaDeTexto, huellaTexto } from './comun.mjs';

export async function leerListaPdf({ contexto }, cfg) {
  const ubicado = await ubicarArchivo(cfg.archivo, contexto);
  const archivo = await descargarArchivo(ubicado.url, contexto, { accept: 'application/pdf,*/*;q=0.5' });
  contexto.progreso({ archivo: ubicado.url, bytes: archivo.bytes.length });
  let pdf;
  try {
    pdf = await leerPdf(archivo.bytes, { maxPaginas: cfg.maxPaginas || 200 });
  } catch (e) {
    throw formato('No se pudo leer el PDF: ' + String(e.message || e).slice(0, 200), ubicado.url);
  }
  const lineas = pdf.paginas.reduce((n, p) => n + p.lineas.length, 0);
  if (!lineas) throw formato('El PDF no trae texto (¿es una imagen escaneada?).', ubicado.url);
  const tabla = tablaPdf(pdf, { columnas: cfg.columnas, requeridos: ['titulo', 'precio'] });
  if (!tabla.ok) throw formato(tabla.motivo, ubicado.url);
  // La fecha de los precios, si la ficha dice cómo encontrarla en el texto
  let fecha = '';
  if (cfg.fecha && cfg.fecha.patron) {
    let re = null;
    try {
      re = new RegExp(cfg.fecha.patron, 'i');
    } catch {
      re = null;
    }
    for (const p of pdf.paginas) {
      for (const l of p.lineas) {
        const m = re && re.exec(l.texto);
        if (m) {
          fecha = fechaDeTexto(m[1] || m[0]);
          if (fecha) break;
        }
      }
      if (fecha) break;
    }
  }
  const textoPagina = new Map(pdf.paginas.map((p) => [p.numero, p.lineas.map((l) => l.texto).join('\n')]));
  const prefijo = cfg.clavePrefijo || (contexto.fuente && contexto.fuente.id) || 'pdf';
  const crudos = [];
  for (const f of tabla.filas) {
    const titulo = unaLinea(f.valores.titulo);
    const precioTexto = unaLinea(f.valores.precio);
    if (!titulo || !/\d/.test(precioTexto)) continue;
    const literal = unaLinea(f.texto);
    crudos.push(
      crudo({
        titulo,
        url: ubicado.url,
        precioTexto,
        unidadTexto: unaLinea(f.valores.unidad || ''),
        textoLiteral: literal,
        proveedor: cfg.proveedor || '',
        fechaVisible: fecha,
        incluyeIva: cfg.incluyeIva,
        ciudad: cfg.ciudad || '',
        condiciones: 'Página ' + f.pagina + ' del PDF',
        clave: prefijo + ':' + (f.valores.codigo ? unaLinea(f.valores.codigo) : huellaTexto(titulo)),
        pagina: { url: ubicado.url, texto: textoPagina.get(f.pagina) || literal, leida: true, tipo: 'pdf', recuperada: archivo.recuperada },
      }),
    );
  }
  if (!crudos.length) throw formato('La tabla del PDF no tiene líneas con nombre y precio.', ubicado.url);
  return { crudos, paginas: pdf.paginas.length, archivo: ubicado.url, fecha };
}

export default {
  id: 'generico-pdf',
  nombre: 'Tabla en PDF (genérico)',
  tipo: 'genérico',
  metodo: 'pdf',
  async leerLista(a) {
    return leerListaPdf(a, a.contexto.config);
  },
  async buscar() {
    return [];
  },
  async leerProducto() {
    return null;
  },
};
