// ARKEN PRECIOS · motor · conector certificado: IDU · base de precios unitarios de referencia (Bogotá).
//
// El Instituto de Desarrollo Urbano publica su base de precios en un Excel cuyo nombre cambia en
// cada versión. El conector lee la página del portafolio, toma el enlace «Precios unitarios de
// referencia» (el visor vigente) y lee la hoja de insumos: código, nombre, unidad (UM) y precio.
// La fecha de los precios es la del último ajuste que dice la hoja (o la de publicación).
// Términos de uso del IDU: ver la ficha de la fuente; su revisión legal la decide una persona.

import { leerListaExcel } from './generico-excel.mjs';

export const PORTAFOLIO = 'https://www.idu.gov.co/page/siipviales/economico/portafolio';

export const CONFIGURACION = {
  archivo: { pagina: PORTAFOLIO, texto: 'Precios unitarios de referencia', patron: 'Visor_BPR.*\\.xlsx$' },
  hoja: 'Inusmos',
  columnas: { codigo: 'Código', titulo: 'Nombre', unidad: 'UM', precio: 'Precio', grupo: 'Grupo de base de datos' },
  fecha: { celdas: ['G7', 'G8'] },
  incluyeIva: true,
  tipoPrecio: 'oficial',
  ciudad: 'Bogotá',
  proveedor: 'Instituto de Desarrollo Urbano (IDU)',
  clavePrefijo: 'idu',
};

/** Nombres que ha tenido la hoja de insumos («Inusmos» en el archivo de 2026). */
const HOJAS = ['Inusmos', 'Insumos'];

export default {
  id: 'idu',
  nombre: 'IDU · base de precios de referencia',
  tipo: 'entidad pública (Excel)',
  metodo: 'excel',
  modo: 'lista',
  tipoPrecio: 'oficial',
  async leerLista({ contexto }) {
    const c = contexto.config || {};
    const base = Object.assign({}, CONFIGURACION, {
      ciudad: c.ciudad || CONFIGURACION.ciudad,
      incluyeIva: c.incluyeIva === false ? false : CONFIGURACION.incluyeIva,
    });
    let ultimo = null;
    for (const hoja of c.hoja ? [c.hoja] : HOJAS) {
      try {
        return await leerListaExcel({ contexto }, Object.assign({}, base, { hoja }));
      } catch (e) {
        // Si la hoja no existe con ese nombre se prueba el siguiente; cualquier otra falla sale
        if (!(e && e.codigo === 'formato' && /no tiene la hoja/.test(e.message))) throw e;
        ultimo = e;
      }
    }
    throw ultimo;
  },
  async buscar() {
    return [];
  },
  async leerProducto() {
    return null;
  },
};
