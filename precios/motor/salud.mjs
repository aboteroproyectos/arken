// ARKEN PRECIOS · motor · salud de las fuentes (interruptor automático, §7.2).
//
// Cada fuente tiene uno de los estados de su ficha (§6):
//   · activa      responde bien.
//   · degradada   falló varias veces seguidas; se sigue intentando y se avisa.
//   · caída       falló muchas veces seguidas; el motor no la vuelve a intentar hasta que
//                 pase el tiempo de enfriamiento, y entonces hace un solo intento de prueba.
//   · bloqueada   el sitio negó el acceso, pidió un CAPTCHA o una sesión, o cambió de
//                 formato: no se vuelve a leer hasta que una persona la revise.
//   · suspendida  una persona la apagó.
// Solo las fallas de la fuente cuentan: que un producto ya no exista (404 de un vínculo)
// no dice nada de la salud del sitio.

import { DE_BLOQUEO, comoRegistro } from './errores.mjs';

export const ESTADOS = ['activa', 'degradada', 'caída', 'bloqueada', 'suspendida'];
const MAX_ERRORES = 50;

export function crearSalud(o = {}) {
  const umbralDegradada = o.umbralDegradada ?? 2;
  const umbralCaida = o.umbralCaida ?? 5;
  const enfriamientoMs = o.enfriamientoMs ?? 6 * 3600 * 1000;
  const ahora = o.ahora || Date.now;
  const alCambiar = o.alCambiar || (() => {});
  const fuentes = new Map();

  function nueva(id) {
    return { fuenteId: id, estado: 'activa', fallosSeguidos: 0, exitos: 0, fallos: 0, ultimoExito: null, ultimoFallo: null, motivo: '', errores: [] };
  }
  function de(id) {
    if (!fuentes.has(id)) fuentes.set(id, nueva(id));
    return fuentes.get(id);
  }
  function cambiar(s, estado, motivo) {
    if (s.estado === estado && s.motivo === motivo) return;
    const antes = s.estado;
    s.estado = estado;
    s.motivo = motivo || '';
    s.desde = new Date(ahora()).toISOString();
    try {
      alCambiar({ fuenteId: s.fuenteId, antes, ahora: estado, motivo: s.motivo });
    } catch {
      // Un aviso que falla no cambia el estado
    }
  }

  /** ¿Se puede leer la fuente ahora? Una caída se prueba una vez pasado el enfriamiento. */
  function puedeIntentar(id) {
    const s = de(id);
    if (s.estado === 'suspendida') return { ok: false, motivo: 'La fuente está suspendida.' };
    if (s.estado === 'bloqueada') return { ok: false, motivo: 'La fuente está bloqueada: ' + (s.motivo || 'requiere revisión') + '.' };
    if (s.estado === 'caída') {
      const desde = s.ultimoFallo ? Date.parse(s.ultimoFallo) : 0;
      if (ahora() - desde < enfriamientoMs) {
        const min = Math.ceil((enfriamientoMs - (ahora() - desde)) / 60000);
        return { ok: false, motivo: `La fuente está caída; se vuelve a probar en ${min} min.` };
      }
      return { ok: true, prueba: true, motivo: 'Intento de prueba después de la caída.' };
    }
    return { ok: true };
  }

  function exito(id) {
    const s = de(id);
    s.exitos++;
    s.fallosSeguidos = 0;
    s.ultimoExito = new Date(ahora()).toISOString();
    if (s.estado === 'degradada' || s.estado === 'caída') cambiar(s, 'activa', 'Volvió a responder.');
    return s;
  }

  /**
   * Registra una falla.
   * @param {string} id fuente
   * @param {Error|object} e falla con `codigo`
   * @param {object} [op] { nivel: 'fuente'|'elemento', url }
   */
  function fallo(id, e, op = {}) {
    const s = de(id);
    const reg = Object.assign({ fecha: new Date(ahora()).toISOString(), nivel: op.nivel || 'fuente' }, comoRegistro(e, op.url));
    s.errores.unshift(reg);
    if (s.errores.length > MAX_ERRORES) s.errores.length = MAX_ERRORES;
    if (op.nivel === 'elemento') return s;
    s.fallos++;
    s.fallosSeguidos++;
    s.ultimoFallo = reg.fecha;
    if (DE_BLOQUEO.has(reg.codigo)) cambiar(s, 'bloqueada', reg.mensaje);
    else if (reg.codigo === 'formato') cambiar(s, 'bloqueada', 'El sitio cambió de formato; hay que revisar la configuración del conector');
    else if (s.fallosSeguidos >= umbralCaida) cambiar(s, 'caída', `${s.fallosSeguidos} fallas seguidas (${reg.codigo})`);
    else if (s.fallosSeguidos >= umbralDegradada && s.estado === 'activa') cambiar(s, 'degradada', `${s.fallosSeguidos} fallas seguidas (${reg.codigo})`);
    return s;
  }

  function suspender(id, motivo) {
    cambiar(de(id), 'suspendida', motivo || 'Suspendida por una persona.');
  }
  /** Vuelve a activar una fuente suspendida, bloqueada o caída (después de revisarla). */
  function reanudar(id, motivo) {
    const s = de(id);
    s.fallosSeguidos = 0;
    cambiar(s, 'activa', motivo || 'Reactivada por una persona.');
  }

  function estado(id) {
    return JSON.parse(JSON.stringify(de(id)));
  }
  function exportar() {
    return Array.from(fuentes.values()).map((s) => JSON.parse(JSON.stringify(s)));
  }
  /** Carga los estados guardados (por ejemplo, los de las fichas del programa). */
  function importar(lista) {
    for (const x of lista || []) {
      if (!x || !x.fuenteId) continue;
      const s = Object.assign(nueva(x.fuenteId), x);
      if (ESTADOS.indexOf(s.estado) < 0) s.estado = 'activa';
      s.errores = Array.isArray(s.errores) ? s.errores.slice(0, MAX_ERRORES) : [];
      fuentes.set(x.fuenteId, s);
    }
  }

  return { puedeIntentar, exito, fallo, suspender, reanudar, estado, exportar, importar, ESTADOS };
}
