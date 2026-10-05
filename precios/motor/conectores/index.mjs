// ARKEN PRECIOS · motor · registro de conectores.
//
// Un conector a la medida (certificado) se elige por configuracion.conector; si la ficha no lo
// nombra, se usa el genérico de su método, configurado en la ficha misma (§7.2).

import easy from './easy.mjs';
import casitaroja from './casitaroja.mjs';
import aldia from './aldia.mjs';
import idu from './idu.mjs';
import tvec from './tvec.mjs';
import icoced from './icoced.mjs';
import genericoHtml from './generico-html.mjs';
import genericoJson from './generico-json.mjs';
import genericoSocrata from './generico-socrata.mjs';
import genericoExcel from './generico-excel.mjs';
import genericoPdf from './generico-pdf.mjs';

export const CERTIFICADOS = { easy, casitaroja, aldia, idu, tvec, icoced };
export const GENERICOS = { html: genericoHtml, 'api-json': genericoJson, socrata: genericoSocrata, excel: genericoExcel, pdf: genericoPdf };

/** Conector de una fuente, o null si su método no se lee de forma automática. */
export function conectorPara(fuente) {
  const c = (fuente && fuente.configuracion) || {};
  if (c.conector) return CERTIFICADOS[c.conector] || null;
  return GENERICOS[fuente && fuente.metodo] || null;
}
