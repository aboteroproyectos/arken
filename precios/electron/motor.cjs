// ARKEN PRECIOS · app de escritorio · el motor de conectores en el proceso principal.
//
// Es el mismo motor del servidor de recolección (precios/motor): respeta el robots.txt de cada
// sitio, se identifica con el agente ARKEN-PRECIOS y el correo de contacto, hace pausas por
// sitio, guarda en caché lo que no cambió y nunca intenta pasar un CAPTCHA ni un inicio de
// sesión. Las reglas de cada precio (lector, verificación literal, emparejamiento) salen del
// núcleo del mismo programa que muestra la ventana (www/index.html), no de una copia.
//
// Lee una cosa a la vez: una lectura o una prueba técnica. Lo que devuelve, el programa lo
// vuelve a verificar contra el texto leído antes de guardar un precio (criterio 9).

const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MOTOR = path.join(__dirname, '..', 'motor');

/**
 * @param {object} o
 *   programa: ruta del HTML del programa (su núcleo y su semilla)
 *   carpeta: carpeta del motor en los datos de la app (caché y bitácora)
 *   fetch: la función de red (electron/red.cjs)
 *   opcionesRed: opciones de la red del motor (las pruebas acortan las pausas)
 */
function crearMotor(o) {
  let cargado = null;
  let enCurso = null;

  /** El motor es un módulo ES: se carga la primera vez que se usa. */
  function cargar() {
    if (!cargado) {
      cargado = (async () => {
        const [m, n, c] = await Promise.all(['motor.mjs', 'nucleo.mjs', 'cache.mjs'].map((a) => import(pathToFileURL(path.join(MOTOR, a)).href)));
        const N = n.cargarNucleo(o.programa, { semilla: true });
        return { ejecutar: m.ejecutar, probar: m.probar, N, plano: n.plano, cache: c.cacheEnDisco(path.join(o.carpeta, 'cache')) };
      })();
      cargado.catch(() => {
        cargado = null;
      });
    }
    return cargado;
  }

  function ocupar(tipo) {
    if (enCurso) {
      throw new Error(enCurso.tipo === 'prueba' ? 'El motor está haciendo una prueba técnica: espere a que termine.' : 'El motor ya está leyendo las fuentes: espere a que termine.');
    }
    enCurso = { tipo, ctl: new AbortController() };
    return enCurso;
  }
  const esObjeto = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

  async function guardarBitacora(r, bitacora) {
    try {
      await fsp.mkdir(o.carpeta, { recursive: true });
      const fuentes = {};
      for (const [id, x] of Object.entries(r.fuentes || {})) fuentes[id] = { estado: x.estado, solicitudes: x.solicitudes, verificados: x.verificados, errores: (x.errores || []).slice(0, 5) };
      await fsp.writeFile(
        path.join(o.carpeta, 'ultima-lectura.json'),
        JSON.stringify({ ejecucionId: r.ejecucionId, inicio: r.inicio, fin: r.fin, cancelado: r.cancelado, agente: r.agente, fuentes, bitacora }, null, 1),
        'utf8',
      );
    } catch {
      // La bitácora ayuda a revisar una lectura; si no se puede escribir, la lectura sigue valiendo
    }
  }

  /** Corre un plan del programa. alEvento recibe el avance (progreso, salud, avisos). */
  async function correr(plan, alEvento) {
    if (!esObjeto(plan)) throw new Error('El plan del motor no es válido.');
    const t = ocupar('lectura');
    try {
      const M = await cargar();
      const emitir = (e) => {
        try {
          alEvento(M.plano(e));
        } catch {
          // La ventana pudo cerrarse: la lectura sigue
        }
      };
      const r = M.plano(
        await M.ejecutar(M.N.limpiarClaves(M.plano(plan)), { fetch: o.fetch, nucleo: M.N, cache: M.cache, opcionesRed: o.opcionesRed, senal: t.ctl.signal, alEvento: emitir }),
      );
      const bitacora = Array.isArray(r.bitacora) ? r.bitacora : [];
      delete r.bitacora;
      await guardarBitacora(r, bitacora);
      await M.cache.podar().catch(() => {});
      return r;
    } finally {
      enCurso = null;
    }
  }

  /** Prueba técnica de una ficha: lee poco, con la configuración de la ficha. */
  async function probar(ficha, op) {
    if (!esObjeto(ficha) || typeof ficha.id !== 'string' || !ficha.id || ficha.id.length > 120) throw new Error('Falta la ficha de la fuente que se va a probar.');
    const x = esObjeto(op) ? op : {};
    const t = ocupar('prueba');
    try {
      const M = await cargar();
      const r = await M.probar(M.N.limpiarClaves(M.plano(ficha)), {
        contacto: String(x.contacto || '').trim(),
        plan: { limites: esObjeto(x.limites) ? M.plano(x.limites) : {} },
        fetch: o.fetch,
        nucleo: M.N,
        cache: M.cache,
        opcionesRed: o.opcionesRed,
        senal: t.ctl.signal,
      });
      return M.plano(r);
    } finally {
      enCurso = null;
    }
  }

  function cancelar() {
    if (!enCurso) return false;
    enCurso.ctl.abort();
    return true;
  }

  return { correr, probar, cancelar, ocupado: () => (enCurso ? enCurso.tipo : null), cargar };
}

module.exports = { crearMotor };
