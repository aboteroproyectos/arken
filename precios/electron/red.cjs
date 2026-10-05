// ARKEN PRECIOS · app de escritorio · la red del motor.
//
// El motor (precios/motor) pide cada página con una función que tiene la forma de fetch. En la
// app de escritorio esa función usa la red de Chromium (net.request de Electron) y no la de
// Node, por dos razones: respeta el proxy del sistema y confía en los certificados instalados
// en el equipo (los antivirus y las redes de empresa que revisan el tráfico cifrado instalan
// el suyo), igual que el navegador.
//
// net.fetch de Electron no sirve tal cual: con redirect: 'manual' falla en lugar de devolver
// la redirección, y su respuesta no trae la dirección final. El motor necesita ver cada
// redirección para revisar el destino (http o https, sin inicio de sesión y permitido por su
// robots.txt) antes de pedirlo. Esta función nunca sigue una redirección: la devuelve como una
// respuesta 3xx con su Location y el motor decide. Tampoco envía ni guarda cookies, no usa la
// caché de Chromium (el motor tiene la suya, con ETag y Last-Modified) y no responde a pedidos
// de usuario y clave: un sitio que los pide queda como «inicio de sesión».

const { net, session } = require('electron');
const { Readable } = require('node:stream');

const PARTICION = 'arken-precios-motor';
const SIN_CUERPO = new Set([204, 205, 304]);

function abortado(senal) {
  const r = senal && senal.reason;
  if (r instanceof Error) return r;
  const e = new Error('La solicitud se canceló.');
  e.name = 'AbortError';
  return e;
}

function cabecerasDe(obj) {
  const h = new Headers();
  for (const [k, v] of Object.entries(obj || {})) {
    for (const x of [].concat(v)) {
      try {
        h.append(k, String(x));
      } catch {
        // Una cabecera que no se puede representar se omite: el motor no la necesita
      }
    }
  }
  return h;
}

/**
 * Crea la función con forma de fetch que usa el motor en la app de escritorio.
 * @param {object} [o] { sesion }: una sesión de Electron; por defecto, una en memoria y sin caché.
 */
function crearFetch(o = {}) {
  const sesion = o.sesion || session.fromPartition(PARTICION, { cache: false });
  return function fetchMotor(url, init = {}) {
    return new Promise((resolver, rechazar) => {
      const senal = init.signal || null;
      if (senal && senal.aborted) return rechazar(abortado(senal));
      const metodo = String(init.method || 'GET').toUpperCase();
      let solicitud;
      try {
        solicitud = net.request({
          url: String(url),
          method: metodo,
          session: sesion,
          redirect: 'manual',
          credentials: 'omit',
          useSessionCookies: false,
          cache: 'no-store',
        });
        new Headers(init.headers || {}).forEach((v, k) => solicitud.setHeader(k, v));
      } catch (e) {
        return rechazar(e);
      }
      let listo = false;
      let respuesta = null;
      const soltar = () => {
        if (senal) senal.removeEventListener('abort', alCancelar);
      };
      const terminar = (fn, x) => {
        if (listo) return;
        listo = true;
        fn(x);
      };
      function alCancelar() {
        const e = abortado(senal);
        if (respuesta) respuesta.destroy(e);
        try {
          solicitud.abort();
        } catch {}
        soltar();
        terminar(rechazar, e);
      }
      if (senal) senal.addEventListener('abort', alCancelar, { once: true });

      // Los errores que llegan después de responder (por ejemplo, al cancelar la redirección) no importan
      solicitud.on('error', (e) => {
        soltar();
        terminar(rechazar, e);
      });
      solicitud.on('login', (_info, responder) => responder());
      solicitud.on('redirect', (status, _metodo, destino, cabeceras) => {
        // Sin followRedirect, Electron cancela la solicitud: el motor revisa el destino y lo pide él
        soltar();
        const h = cabecerasDe(cabeceras);
        h.set('location', destino);
        try {
          terminar(resolver, new Response(null, { status, headers: h }));
        } catch (e) {
          terminar(rechazar, e);
        }
      });
      solicitud.on('response', (r) => {
        if (listo) {
          r.destroy();
          return;
        }
        respuesta = r;
        r.on('end', soltar);
        r.on('error', soltar);
        const vacio = SIN_CUERPO.has(r.statusCode) || metodo === 'HEAD';
        if (vacio) r.resume();
        try {
          terminar(
            resolver,
            new Response(vacio ? null : Readable.toWeb(r), { status: r.statusCode, statusText: r.statusMessage || '', headers: cabecerasDe(r.headers) }),
          );
        } catch (e) {
          r.destroy();
          soltar();
          terminar(rechazar, e);
        }
      });
      solicitud.end();
    });
  };
}

module.exports = { crearFetch, PARTICION };
