// ARKEN PRECIOS · motor · errores con nombre.
//
// Cada falla del motor lleva un código estable que la salud de fuentes, el registro de
// errores de la ficha y los mensajes al usuario entienden sin leer el texto.

/** Códigos de falla y lo que significan para la persona que usa el programa. */
export const CODIGOS = {
  'sin-contacto': 'Falta el correo de contacto del motor (Configuración › Motor y servidor). Sin él no se lee ningún sitio.',
  url: 'La dirección no es válida o no es http/https.',
  robots: 'El robots.txt del sitio no permite leer esta dirección.',
  'robots-no-disponible': 'No se pudo leer el robots.txt del sitio; mientras no se pueda, el motor no lee nada de ese sitio.',
  bloqueado: 'El sitio negó el acceso (401 o 403). El motor no intenta saltarse el bloqueo.',
  captcha: 'El sitio pidió resolver un CAPTCHA. El motor no los resuelve: la fuente queda bloqueada hasta revisarla.',
  'inicio-sesion': 'El sitio pidió iniciar sesión. El motor no entra a zonas con usuario y clave.',
  'no-encontrado': 'La página ya no existe (404 o 410).',
  http: 'El sitio respondió con un error.',
  tiempo: 'El sitio tardó demasiado en responder.',
  red: 'No hubo conexión con el sitio.',
  'tamaño': 'La respuesta es más grande que el máximo permitido.',
  demasiadas: 'El sitio pidió esperar más de lo razonable antes de volver a consultar.',
  cancelado: 'La lectura se canceló.',
  formato: 'El sitio cambió de formato: no se encontró lo que el conector espera.',
  configuracion: 'La configuración del conector está incompleta o no es válida.',
  'fuente-no-disponible': 'La fuente está suspendida, bloqueada o caída.',
};

/** Fallas que pueden pasar solas: se reintentan con espera creciente. */
export const PASAJERAS = new Set(['tiempo', 'red', 'http-pasajero']);

/** Fallas que exigen que una persona revise la fuente antes de volver a leerla. */
export const DE_BLOQUEO = new Set(['bloqueado', 'captcha', 'inicio-sesion']);

export class ErrorMotor extends Error {
  /**
   * @param {string} codigo uno de CODIGOS
   * @param {string} [mensaje] detalle en español para la bitácora
   * @param {object} [extra] { url, status, esperaMs, pasajero }
   */
  constructor(codigo, mensaje, extra) {
    super(mensaje || CODIGOS[codigo] || codigo);
    this.name = 'ErrorMotor';
    this.codigo = codigo;
    Object.assign(this, extra || {});
  }
}

/** Convierte cualquier falla en un registro corto para la ficha de la fuente. */
export function comoRegistro(e, url) {
  const codigo = (e && e.codigo) || 'red';
  return {
    codigo,
    mensaje: String((e && e.message) || e || CODIGOS[codigo] || codigo).slice(0, 400),
    url: (e && e.url) || url || '',
    status: (e && e.status) || null,
  };
}
