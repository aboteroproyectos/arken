// ARKEN PRECIOS · motor · conector certificado: DANE · ICOCED (índice de costos de la construcción).
//
// El DANE publica cada mes el boletín del Índice de Costos de la Construcción de Edificaciones con
// un Excel de anexos. El conector lee la página del ICOCED, toma el enlace a los anexos vigentes
// («anex-ICOCED-<mes><año>.xlsx») y lee dos hojas:
//   · Anexo 1    número índice y variaciones (mensual, año corrido, anual) del total nacional y de
//                cada dominio geográfico, mes a mes desde 2022.
//   · Anexo 6.7  el último mes por dominio geográfico y grupo de costos, con el peso de cada grupo.
// No son precios: son índices, y van a su propio almacén con la cita que exige el DANE.

import { leerExcel, buscarEncabezado, textoCelda, celda, normaliza } from '../tablas.mjs';
import { ubicarArchivo, descargarArchivo } from './archivos.mjs';
import { formato, fechaDeTexto, unaLinea } from './comun.mjs';

export const PAGINA = 'https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-costos-de-la-construccion-de-edificaciones-icoced';
export const CONFIGURACION = {
  archivo: { pagina: PAGINA, patron: 'anex-ICOCED-[a-z]+\\d{4}\\.xlsx$' },
  hojas: { dominios: 'Anexo 1', grupos: 'Anexo 6.7' },
};

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Número del mes (1-12) de un nombre («Agosto», «Septiembre*», «setiembre»), o 0. */
export function numeroMes(t) {
  const n = normaliza(t).replace(/^setiembre/, 'septiembre');
  const k = MESES.findIndex((m) => n.startsWith(m));
  return k + 1;
}
/** «Agosto de 2026» → «2026-08». Con `estricto`, el texto tiene que ser solo eso (no «base diciembre de 2021 = 100»). */
export function mesDeTexto(t, estricto) {
  const re = estricto ? /^\s*([a-záéíóú]+)\s+(?:de\s+|del\s+)?(\d{4})\s*$/i : /([a-záéíóú]+)\s+(?:de\s+|del\s+)?(\d{4})/i;
  const m = re.exec(String(t || ''));
  if (!m) return '';
  const k = numeroMes(m[1]);
  return k ? m[2] + '-' + String(k).padStart(2, '0') : '';
}
/** Número de una celda, sin el ruido binario de los decimales (0,30000000000000004 → 0,3). */
function numero(c) {
  if (!c) return null;
  let v = null;
  if (typeof c.v === 'number') v = c.v;
  else {
    const t = String(c.v).replace(/\s/g, '').replace(',', '.');
    v = /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : null;
  }
  return v === null || !isFinite(v) ? null : Math.round(v * 1e6) / 1e6;
}
function pct(c) {
  const v = numero(c);
  return v === null ? '—' : textoCelda(c) + ' %';
}

/** Anexo 1: índice del total y de cada dominio, mes a mes. */
export function leerAnexo1(hoja, comun) {
  const filas = hoja.filas;
  const enc = buscarEncabezado(filas, { anio: 'Año', mes: 'Mes' }, 40);
  if (!enc) throw formato('El Anexo 1 del ICOCED no tiene la fila de encabezados «Año» y «Mes».');
  const filaEnc = filas[enc.fila - 1] || [];
  const filaDom = filas[enc.fila] || [];
  const bloques = [];
  filaEnc.forEach((c, i) => {
    if (i > enc.indices.mes && /^total/.test(normaliza(textoCelda(c)))) bloques.push({ nombre: 'Total', col: i });
  });
  filaDom.forEach((c, i) => {
    const t = textoCelda(c);
    if (t && i > enc.indices.mes) bloques.push({ nombre: t, col: i });
  });
  if (bloques.length < 2) throw formato('El Anexo 1 del ICOCED no trae los dominios geográficos donde se esperaban.');
  const out = [];
  const desconocidos = new Set();
  let anio = null;
  for (let f = enc.fila; f < filas.length; f++) {
    const fila = filas[f] || [];
    const a = /^(\d{4})/.exec(textoCelda(fila[enc.indices.anio]));
    if (a) anio = Number(a[1]);
    const k = numeroMes(textoCelda(fila[enc.indices.mes]));
    if (!k || !anio) continue;
    const mes = anio + '-' + String(k).padStart(2, '0');
    for (const b of bloques) {
      const indice = numero(fila[b.col]);
      if (indice === null || !(indice > 0)) continue;
      const dominio = comun.dominioCanonico(b.nombre);
      if (!dominio) {
        desconocidos.add(b.nombre);
        continue;
      }
      out.push({
        dominio,
        grupo: 'Total',
        mes,
        indice,
        variacionMensual: numero(fila[b.col + 1]),
        variacionAnioCorrido: numero(fila[b.col + 2]),
        variacionAnual: numero(fila[b.col + 3]),
        peso: null,
        evidencia:
          hoja.nombre + ', fila ' + (f + 1) + ': ' + textoCelda(fila[enc.indices.mes]) + ' ' + anio + ' · ' + unaLinea(b.nombre) +
          ': número índice ' + textoCelda(fila[b.col]) + '; variación mensual ' + pct(fila[b.col + 1]) + ', año corrido ' + pct(fila[b.col + 2]) +
          ', anual ' + pct(fila[b.col + 3]),
      });
    }
  }
  return { indices: out, desconocidos: Array.from(desconocidos) };
}

/** Anexo 6.7: el último mes por dominio y grupo de costos. */
export function leerAnexo67(hoja, comun) {
  const filas = hoja.filas;
  // El mes está en una de las primeras filas («Agosto de 2026»)
  let mes = '';
  for (let f = 0; f < Math.min(filas.length, 12) && !mes; f++) mes = mesDeTexto(textoCelda((filas[f] || [])[0]), true);
  if (!mes) throw formato('El Anexo 6.7 del ICOCED no dice de qué mes es.');
  const enc = buscarEncabezado(filas, { dominio: 'Dominio geográfico', grupo: 'Grupos de costos' }, 40);
  if (!enc) throw formato('El Anexo 6.7 del ICOCED no tiene los encabezados «Dominio geográfico» y «Grupos de costos».');
  // Columnas de peso, número índice y variaciones, en las filas siguientes al encabezado
  let col = null;
  for (let f = enc.fila - 1; f < Math.min(filas.length, enc.fila + 6) && !col; f++) {
    const fila = filas[f] || [];
    const t = fila.map((c) => normaliza(textoCelda(c)));
    const indice = t.findIndex((x) => x.startsWith('numero indice'));
    const variacion = t.findIndex((x) => x.startsWith('variacion'));
    if (indice >= 0 && variacion >= 0) col = { peso: t.findIndex((x) => x.startsWith('peso')), indice, variacion, fila: f };
  }
  if (!col) throw formato('El Anexo 6.7 del ICOCED no tiene las columnas «Número índice» y «Variación».');
  const out = [];
  const desconocidos = new Set();
  let dominioActual = '';
  let publicado = '';
  for (let f = col.fila + 1; f < filas.length; f++) {
    const fila = filas[f] || [];
    const primero = textoCelda(fila[enc.indices.dominio]);
    if (/actualizado/i.test(primero)) publicado = fechaDeTexto(primero) || publicado;
    if (primero && !/^fuente|^nota|^\*/i.test(normaliza(primero))) dominioActual = primero;
    const grupo = textoCelda(fila[enc.indices.grupo]);
    const indice = numero(fila[col.indice]);
    if (!grupo || indice === null || !(indice > 0) || !dominioActual) continue;
    const dominio = comun.dominioCanonico(dominioActual);
    if (!dominio) {
      desconocidos.add(dominioActual);
      continue;
    }
    out.push({
      dominio,
      grupo: unaLinea(grupo),
      mes,
      indice,
      variacionMensual: numero(fila[col.variacion]),
      variacionAnioCorrido: numero(fila[col.variacion + 1]),
      variacionAnual: numero(fila[col.variacion + 2]),
      peso: col.peso >= 0 ? numero(fila[col.peso]) : null,
      evidencia:
        hoja.nombre + ', fila ' + (f + 1) + ': ' + unaLinea(dominioActual) + ' · ' + unaLinea(grupo) +
        (col.peso >= 0 ? ' · peso ' + textoCelda(fila[col.peso]) + ' %' : '') + ': número índice ' + textoCelda(fila[col.indice]) +
        '; variación mensual ' + pct(fila[col.variacion]) + ', año corrido ' + pct(fila[col.variacion + 1]) + ', anual ' + pct(fila[col.variacion + 2]),
    });
  }
  // La fecha de actualización también puede estar en otra columna del pie
  if (!publicado) {
    for (let f = filas.length - 1; f >= Math.max(0, filas.length - 40) && !publicado; f--) {
      for (const c of filas[f] || []) {
        const t = textoCelda(c);
        if (/actualizado/i.test(t)) publicado = fechaDeTexto(t);
      }
    }
  }
  return { mes, indices: out, publicado, desconocidos: Array.from(desconocidos) };
}

export default {
  id: 'icoced',
  nombre: 'DANE · ICOCED',
  tipo: 'índice (Excel)',
  metodo: 'excel',
  modo: 'indices',
  async leerIndices({ contexto }) {
    const ubicado = await ubicarArchivo(CONFIGURACION.archivo, contexto);
    const archivo = await descargarArchivo(ubicado.url, contexto);
    contexto.progreso({ archivo: ubicado.url, bytes: archivo.bytes.length });
    const nombres = CONFIGURACION.hojas;
    let libro;
    try {
      libro = leerExcel(archivo.bytes, { hojas: [nombres.dominios, nombres.grupos] });
    } catch (e) {
      throw formato(String(e.message || e), ubicado.url);
    }
    const hoja = (n) => libro.hojas.find((h) => h.nombre === n);
    if (!hoja(nombres.dominios)) throw formato('Los anexos del ICOCED ya no tienen la hoja «' + nombres.dominios + '».', ubicado.url);
    const comun = contexto.indices;
    const a1 = leerAnexo1(hoja(nombres.dominios), comun);
    let a67 = { mes: '', indices: [], publicado: '', desconocidos: [] };
    if (hoja(nombres.grupos)) a67 = leerAnexo67(hoja(nombres.grupos), comun);
    else contexto.aviso('Los anexos del ICOCED no traen la hoja «' + nombres.grupos + '»; se leen solo los dominios.');
    if (!a1.indices.length) throw formato('El Anexo 1 del ICOCED no trae índices.', ubicado.url);
    const ultimo = a1.indices.reduce((m, x) => (x.mes > m ? x.mes : m), '');
    if (a67.mes && ultimo && a67.mes !== ultimo) contexto.aviso('El Anexo 6.7 es de ' + a67.mes + ' y el Anexo 1 llega a ' + ultimo + '.');
    for (const d of a1.desconocidos.concat(a67.desconocidos)) contexto.aviso('Dominio del ICOCED que el programa no conoce: «' + d + '».');
    const publicado = a67.publicado || '';
    const indices = a1.indices.concat(a67.indices).map((x) =>
      Object.assign({ serie: 'icoced' }, x, {
        url: ubicado.url,
        publicado,
        recuperado: archivo.recuperada,
        cita: comun.CITA_DANE,
      }),
    );
    for (const x of indices) x.id = comun.idIndice(x);
    return { indices, url: ubicado.url, publicado, mes: ultimo, filas: a1.indices.length + a67.indices.length };
  },
  async buscar() {
    return [];
  },
  async leerProducto() {
    return null;
  },
};
