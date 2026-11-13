// ARKEN FOLDER · qué rutas puede ver el programa.
//
// El usuario da acceso a una carpeta. Con eso el programa puede ver:
//   · esa carpeta y todas sus subcarpetas, a cualquier profundidad
//   · sus supercarpetas (las carpetas que la contienen, hasta la unidad), si el acceso las incluye
// Cualquier otra ruta se rechaza en el proceso principal, sin importar lo que pida la ventana.
//
// Funciona con rutas de Windows (sin distinguir mayúsculas, con «\») y de Linux/macOS. Las pruebas
// le pasan el módulo de rutas de cada sistema.

const pathNativo = require('node:path');

function crearAccesos(p = pathNativo) {
  const windows = p.sep === '\\';

  /** Ruta absoluta, sin «..», sin barra final (salvo la raíz de la unidad). */
  function normalizar(ruta) {
    if (typeof ruta !== 'string' || !ruta.trim()) throw new Error('Ruta vacía.');
    if (ruta.includes('\0')) throw new Error('Ruta inválida.');
    let r = p.resolve(ruta);
    if (windows && /^[a-z]:/.test(r)) r = r[0].toUpperCase() + r.slice(1);
    const raiz = p.parse(r).root;
    while (r.length > raiz.length && (r.endsWith(p.sep) || (windows && r.endsWith('/')))) r = r.slice(0, -1);
    return r;
  }

  const clave = (ruta) => (windows ? ruta.toLowerCase() : ruta);

  /** ¿«ruta» es «base» o está dentro de ella? */
  function estaDentro(ruta, base) {
    const r = clave(normalizar(ruta));
    const b = clave(normalizar(base));
    if (r === b) return true;
    const conSep = b.endsWith(p.sep) ? b : b + p.sep;
    return r.startsWith(conSep);
  }

  /** Las supercarpetas de «ruta», de la unidad hacia abajo, sin incluirla a ella. */
  function supercarpetas(ruta) {
    const r = normalizar(ruta);
    const lista = [];
    let actual = p.dirname(r);
    let anterior = r;
    while (actual !== anterior) {
      lista.unshift(actual);
      anterior = actual;
      actual = p.dirname(actual);
    }
    return lista;
  }

  /** Nombre para mostrar: el de la carpeta, o la unidad («C:») en la raíz. */
  function nombre(ruta) {
    const r = normalizar(ruta);
    const base = p.basename(r);
    if (base) return base;
    return windows ? r.replace(/[\\/]+$/, '') : '/';
  }

  /**
   * ¿Puede el programa ver «ruta»?
   * accesos: [{ ruta, supercarpetas }]
   * Devuelve { permitido, acceso, como } — como: 'dentro' (la carpeta o una subcarpeta) o 'super'.
   * Una supercarpeta da acceso a todo lo que contiene: el usuario la eligió al dar el acceso.
   */
  function permiso(ruta, accesos) {
    let r;
    try { r = normalizar(ruta); } catch { return { permitido: false }; }
    for (const a of accesos || []) {
      if (estaDentro(r, a.ruta)) return { permitido: true, acceso: a, como: 'dentro' };
    }
    for (const a of accesos || []) {
      if (!a.supercarpetas) continue;
      const supers = supercarpetas(a.ruta);
      // Solo la supercarpeta más alta que el usuario dejó visible marca el límite
      const tope = a.tope ? supers.find((s) => clave(s) === clave(normalizar(a.tope))) : supers[0];
      if (tope && estaDentro(r, tope)) return { permitido: true, acceso: a, como: 'super' };
    }
    return { permitido: false };
  }

  /** Las supercarpetas que el acceso deja ver (desde «tope», si lo hay). */
  function supercarpetasVisibles(acceso) {
    if (!acceso.supercarpetas) return [];
    const supers = supercarpetas(acceso.ruta);
    if (!acceso.tope) return supers;
    const i = supers.findIndex((s) => clave(s) === clave(normalizar(acceso.tope)));
    return i < 0 ? supers : supers.slice(i);
  }

  return { normalizar, estaDentro, supercarpetas, supercarpetasVisibles, nombre, permiso, clave, windows };
}

module.exports = { crearAccesos };
