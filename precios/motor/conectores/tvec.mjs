// ARKEN PRECIOS · motor · conector certificado: Tienda Virtual del Estado Colombiano (datos abiertos).
//
// Colombia Compra Eficiente publica en datos.gov.co cada renglón de las órdenes de compra de la
// Tienda Virtual del Estado (conjunto 3hdv-smhz) y cada orden con su ciudad (rgxm-mmea). El
// conector busca el insumo con el texto completo de Socrata en el último año y completa cada
// renglón con la ciudad, la entidad y el proveedor de su orden. Licencia CC BY-SA 4.0: cada
// precio lleva la atribución. Son precios pagados por el Estado (tipo «contrato»); los datos
// traen ruido (unidades confundidas), que la detección de atípicos del registro filtra.

import { buscarSocrata } from './generico-socrata.mjs';

export const CONFIGURACION = {
  dominio: 'www.datos.gov.co',
  conjunto: '3hdv-smhz',
  campos: {
    titulo: 'item',
    precio: 'price',
    unidad: 'unidad_de_medida',
    fecha: 'fecha',
    proveedor: 'provedor',
    entidad: 'entidad',
    id: 'orden_de_compra',
    cantidad: 'qty',
  },
  filtro: "fecha >= '{desde}'",
  diasAtras: 365,
  orden: 'fecha DESC',
  limite: 50,
  limpiarTitulo: '^\\s*(?:(?:mcf|gsf)[- ]?\\d{2}\\b\\s*-?\\s*)?(?:[a-z0-9]+-[a-z]+_[a-z0-9]+\\.\\s*)?',
  union: {
    conjunto: 'rgxm-mmea',
    local: 'orden_de_compra',
    remoto: 'identificador_de_la_orden',
    campos: { ciudad: 'ciudad', entidad: 'entidad', proveedor: 'proveedor' },
  },
  incluyeIva: null,
  tipoPrecio: 'contrato',
  clavePrefijo: 'tvec',
  atribucion: 'Agencia Nacional de Contratación Pública - Colombia Compra Eficiente, CC BY-SA 4.0',
};

export default {
  id: 'tvec',
  nombre: 'Tienda Virtual del Estado Colombiano',
  tipo: 'datos abiertos',
  metodo: 'socrata',
  modo: 'busqueda',
  tipoPrecio: 'contrato',
  async buscar({ insumo, contexto }) {
    const c = contexto.config || {};
    const cfg = Object.assign({}, CONFIGURACION, { diasAtras: Number(c.diasAtras) > 0 ? Number(c.diasAtras) : CONFIGURACION.diasAtras });
    return buscarSocrata({ insumo, contexto }, cfg);
  },
  async leerProducto() {
    return null;
  },
};
