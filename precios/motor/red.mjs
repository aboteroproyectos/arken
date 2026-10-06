// ARKEN PRECIOS · motor · red.
//
// La única puerta del motor a internet. Toda solicitud pasa por aquí y cumple, sin
// excepción, la recolección legal y respetuosa del prompt maestro (§4.4 y §7.2):
//   · Agente identificado con un contacto: «User-Agent: ARKEN-PRECIOS/x.y.z (+sitio;
//     contacto)» y la cabecera «From». Sin contacto no se lee nada.
//   · robots.txt antes de cada sitio (robots.mjs), con su Crawl-delay.
//   · Una solicitud a la vez por dominio, con una pausa mínima entre solicitudes y el
//     límite por minuto de la ficha de la fuente.
//   · Tiempo máximo por solicitud y tamaño máximo de respuesta.
//   · Reintentos con espera creciente solo ante fallas pasajeras (red, tiempo, 408, 429
//     y 5xx), respetando Retry-After.
//   · Caché por dirección, con revalidación (ETag y Last-Modified).
//   · Redirecciones: hasta cinco, y cada salto se revisa antes de pedirlo (solo http o https,
//     permitido por el robots.txt del destino y sin llevar a una página de inicio de sesión).
//   · Nada de evadir: un 401 o 403, un CAPTCHA o una página de inicio de sesión detienen
//     la lectura y la fuente queda bloqueada hasta que una persona la revise.
//
// La función fetch se inyecta: en el escritorio usa la red de Chromium (electron/red.cjs, con el
// proxy y los certificados del sistema), en el servidor y en las pruebas es el fetch de Node.

import { ErrorMotor } from './errores.mjs';
import { cacheEnMemoria } from './cache.mjs';
import { permitido as permitidoPorRobots, segunRespuesta, MAXIMO_BYTES as MAXIMO_ROBOTS } from './robots.mjs';

export const VERSION_AGENTE = '0.4.0';
export const SITIO_AGENTE = 'https://github.com/aboteroproyectos/arken';

const RE_CORREO = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
const RE_CAPTCHA = /g-recaptcha|grecaptcha|h-captcha|hcaptcha|cf-chl-|challenge-platform|cf_chl_opt|captcha-delivery|px-captcha|attention required! \| cloudflare|verifica que eres humano|verify you are human/i;
const RE_LOGIN = /\/(login|signin|sign-in|iniciar-sesion|iniciar_sesion|ingresar|mi-cuenta\/ingresar|account\/login|customer\/account\/login)(\/|\?|$)/i;

/** ¿Es un contacto válido para el agente? Un correo o una dirección web. */
export function contactoValido(c) {
  const t = String(c || '').trim();
  if (RE_CORREO.test(t)) return true;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Texto del User-Agent con el que el motor se identifica. */
export function textoAgente(agente) {
  const a = agente || {};
  const nombre = a.nombre || 'ARKEN-PRECIOS';
  const version = a.version || VERSION_AGENTE;
  const sitio = a.sitio || SITIO_AGENTE;
  const contacto = String(a.contacto || '').trim();
  return `${nombre}/${version} (+${sitio}${contacto ? '; contacto: ' + contacto : ''})`;
}

/** Espera de Retry-After en milisegundos (segundos o fecha HTTP), o null. */
export function esperaRetryAfter(valor, ahoraMs) {
  if (valor === null || valor === undefined || valor === '') return null;
  const t = String(valor).trim();
  if (/^\d+$/.test(t)) return Number(t) * 1000;
  const f = Date.parse(t);
  if (!isFinite(f)) return null;
  return Math.max(0, f - (ahoraMs === undefined ? Date.now() : ahoraMs));
}

/** Juego de caracteres de un Content-Type, para decodificar el texto como lo envió el sitio. */
function juegoDeCaracteres(tipo, bytes) {
  const m = /charset\s*=\s*"?([\w-]+)/i.exec(tipo || '');
  if (m) return m[1].toLowerCase();
  // Si la cabecera no lo dice, se mira la etiqueta <meta charset> del comienzo del HTML
  const inicio = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
  const m2 = /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(inicio);
  return m2 ? m2[1].toLowerCase() : 'utf-8';
}
export function decodificar(bytes, tipo) {
  let juego = juegoDeCaracteres(tipo, bytes);
  if (juego === 'iso-8859-1' || juego === 'latin1') juego = 'windows-1252';
  try {
    return new TextDecoder(juego, { fatal: false }).decode(bytes).replace(/^﻿/, '');
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes).replace(/^﻿/, '');
  }
}

function esperaCancelable(ms, senal) {
  return new Promise((resolver, rechazar) => {
    if (senal && senal.aborted) return rechazar(new ErrorMotor('cancelado'));
    const t = setTimeout(() => {
      if (senal) senal.removeEventListener('abort', alAbortar);
      resolver();
    }, Math.max(0, ms));
    function alAbortar() {
      clearTimeout(t);
      rechazar(new ErrorMotor('cancelado'));
    }
    if (senal) senal.addEventListener('abort', alAbortar, { once: true });
  });
}

/**
 * Crea la red del motor.
 * @param {object} o
 *   agente: { nombre, version, sitio, contacto }   contacto es obligatorio (correo o URL)
 *   fetch, ahora, esperar(ms, senal)                 inyectables
 *   pausaMinimaMs (3000), tiempoMaximoMs (30000), reintentos (3), esperaBaseMs (2000),
 *   esperaMaximaMs (120000), maxBytes (30 MB), ttlMs (6 h), robotsTtlMs (24 h)
 *   cache: { leer, guardar }, registro(evento)
 */
export function crearRed(o = {}) {
  const agente = Object.assign({ nombre: 'ARKEN-PRECIOS', version: VERSION_AGENTE, sitio: SITIO_AGENTE, contacto: '' }, o.agente || {});
  const ua = textoAgente(agente);
  const fetchFn = o.fetch || globalThis.fetch;
  const ahora = o.ahora || Date.now;
  const esperar = o.esperar || esperaCancelable;
  const pausaMinimaMs = o.pausaMinimaMs ?? 3000;
  const tiempoMaximoMs = o.tiempoMaximoMs ?? 30000;
  const reintentos = o.reintentos ?? 3;
  const esperaBaseMs = o.esperaBaseMs ?? 2000;
  const esperaMaximaMs = o.esperaMaximaMs ?? 120000;
  const maxBytes = o.maxBytes ?? 30 * 1024 * 1024;
  const ttlPorDefecto = o.ttlMs ?? 6 * 3600 * 1000;
  const robotsTtlMs = o.robotsTtlMs ?? 24 * 3600 * 1000;
  const cache = o.cache || cacheEnMemoria(300);
  const registro = o.registro || (() => {});
  const sitios = new Map(); // host → { cola, ultimo }
  const robots = new Map(); // origen → { estado, robots, leido, status }
  const pendientesRobots = new Map(); // origen → promesa de la lectura en curso
  const cuenta = { solicitudes: 0, desdeCache: 0, revalidadas: 0, bytes: 0, reintentos: 0, porSitio: {} };

  function anotar(evento) {
    try {
      registro(Object.assign({ fecha: new Date(ahora()).toISOString() }, evento));
    } catch {
      // La bitácora nunca detiene una lectura
    }
  }
  function sitio(host) {
    if (!sitios.has(host)) sitios.set(host, { cola: Promise.resolve(), ultimo: 0 });
    return sitios.get(host);
  }
  /** Corre `fn` cuando le toque al sitio: una solicitud a la vez y con pausa entre ellas. */
  function enTurno(host, fn) {
    const s = sitio(host);
    const r = s.cola.then(fn, fn);
    s.cola = r.catch(() => {});
    return r;
  }
  async function pausarSiHaceFalta(host, intervaloMs, senal) {
    const s = sitio(host);
    const falta = s.ultimo + intervaloMs - ahora();
    if (falta > 0) await esperar(falta, senal);
    s.ultimo = ahora();
  }
  function intervalo(demoraRobots, limitePorMinuto) {
    const porRobots = demoraRobots ? Math.min(demoraRobots, 120) * 1000 : 0;
    const porLimite = limitePorMinuto > 0 ? Math.ceil(60000 / limitePorMinuto) : 0;
    return Math.max(pausaMinimaMs, porRobots, porLimite);
  }

  function validar(url) {
    if (!contactoValido(agente.contacto)) throw new ErrorMotor('sin-contacto', undefined, { url });
    let u;
    try {
      u = new URL(url);
    } catch {
      throw new ErrorMotor('url', 'Dirección inválida: ' + String(url).slice(0, 200), { url });
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ErrorMotor('url', 'Solo se leen direcciones http y https.', { url });
    if (u.username || u.password) throw new ErrorMotor('url', 'La dirección no puede llevar usuario ni clave.', { url });
    u.hash = '';
    return u;
  }

  function cabeceras(extra) {
    const h = {
      'User-Agent': ua,
      Accept: '*/*',
      'Accept-Language': 'es-CO,es;q=0.9',
    };
    if (RE_CORREO.test(String(agente.contacto).trim())) h.From = String(agente.contacto).trim();
    return Object.assign(h, extra || {});
  }

  /** Lee el cuerpo sin pasar del máximo. */
  async function leerCuerpo(r, maximo, ctl) {
    if (!r.body) return new Uint8Array(0);
    const lector = r.body.getReader();
    const partes = [];
    let total = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > maximo) {
        try {
          ctl.abort();
        } catch {}
        throw new ErrorMotor('tamaño', `La respuesta pasa de ${Math.round(maximo / 1048576)} MB.`, { status: r.status });
      }
      partes.push(value);
    }
    const out = new Uint8Array(total);
    let k = 0;
    for (const p of partes) {
      out.set(p, k);
      k += p.length;
    }
    return out;
  }

  /** Una solicitud HTTP sin seguir redirecciones: las sigue `una`, que revisa cada salto. */
  async function pedir(u, op, previa, seguir) {
    const ctl = new AbortController();
    const maximoMs = op.tiempoMaximoMs || tiempoMaximoMs;
    const reloj = setTimeout(() => ctl.abort(), maximoMs);
    const alCancelar = () => ctl.abort();
    if (op.senal) op.senal.addEventListener('abort', alCancelar, { once: true });
    const extra = { Accept: op.accept || '*/*' };
    if (previa && previa.etag) extra['If-None-Match'] = previa.etag;
    if (previa && previa.ultimaModificacion) extra['If-Modified-Since'] = previa.ultimaModificacion;
    const inicio = ahora();
    cuenta.solicitudes++;
    cuenta.porSitio[u.host] = (cuenta.porSitio[u.host] || 0) + 1;
    const falla = (e) => {
      if (e instanceof ErrorMotor) return e;
      if (op.senal && op.senal.aborted) return new ErrorMotor('cancelado', undefined, { url: u.href });
      if (ctl.signal.aborted) return new ErrorMotor('tiempo', `Sin respuesta completa en ${Math.round(maximoMs / 1000)} s.`, { url: u.href, pasajero: true });
      const causa = (e && e.cause && (e.cause.code || e.cause.message)) || (e && e.message) || String(e);
      return new ErrorMotor('red', 'Sin conexión: ' + causa, { url: u.href, pasajero: true });
    };
    try {
      let r;
      try {
        r = await fetchFn(u.href, { method: 'GET', headers: cabeceras(extra), redirect: seguir ? 'follow' : 'manual', signal: ctl.signal });
      } catch (e) {
        throw falla(e);
      }
      const tipo = r.headers.get('content-type') || '';
      // Algunas implementaciones de fetch no dejan ver la redirección (respuesta opaca)
      if (!seguir && (r.type === 'opaqueredirect' || r.status === 0)) return { opaca: true };
      if (r.status >= 300 && r.status < 400 && r.status !== 304) {
        const destino = r.headers.get('location');
        try {
          await r.body?.cancel();
        } catch {}
        if (!destino) throw new ErrorMotor('http', `HTTP ${r.status} sin dirección de destino.`, { url: u.href, status: r.status });
        return { redireccion: destino, status: r.status };
      }
      if (r.status === 304 && previa) {
        cuenta.revalidadas++;
        return { revalidada: true, status: 304, final: r.url || u.href };
      }
      if (r.status === 401 || r.status === 403) {
        let muestra = '';
        try {
          muestra = decodificar(await leerCuerpo(r, 256 * 1024, ctl), tipo);
        } catch {}
        const codigo = RE_CAPTCHA.test(muestra) ? 'captcha' : r.status === 401 ? 'inicio-sesion' : 'bloqueado';
        throw new ErrorMotor(codigo, `HTTP ${r.status} en ${u.host}.`, { url: u.href, status: r.status });
      }
      if (r.status === 404 || r.status === 410) throw new ErrorMotor('no-encontrado', `HTTP ${r.status}.`, { url: u.href, status: r.status });
      if (r.status === 408 || r.status === 425 || r.status === 429 || r.status >= 500) {
        let muestra = '';
        try {
          muestra = decodificar(await leerCuerpo(r, 256 * 1024, ctl), tipo);
        } catch {}
        if ((r.status === 429 || r.status === 503) && RE_CAPTCHA.test(muestra)) {
          throw new ErrorMotor('captcha', `HTTP ${r.status} con desafío en ${u.host}.`, { url: u.href, status: r.status });
        }
        const espera = esperaRetryAfter(r.headers.get('retry-after'), ahora());
        throw new ErrorMotor('http', `HTTP ${r.status} en ${u.host}.`, { url: u.href, status: r.status, pasajero: true, esperaMs: espera });
      }
      if (r.status < 200 || r.status >= 300) throw new ErrorMotor('http', `HTTP ${r.status} en ${u.host}.`, { url: u.href, status: r.status });
      let bytes;
      try {
        bytes = await leerCuerpo(r, op.maxBytes || maxBytes, ctl);
      } catch (e) {
        throw falla(e);
      }
      cuenta.bytes += bytes.length;
      return {
        status: r.status,
        final: r.url || u.href,
        tipo,
        bytes,
        etag: r.headers.get('etag') || null,
        ultimaModificacion: r.headers.get('last-modified') || null,
        recuperada: new Date(ahora()).toISOString(),
        duracionMs: ahora() - inicio,
      };
    } finally {
      clearTimeout(reloj);
      if (op.senal) op.senal.removeEventListener('abort', alCancelar);
      // La pausa con el sitio se cuenta desde que terminó de responder, no desde que se le pidió
      sitio(u.host).ultimo = ahora();
    }
  }

  /** Revisa una dirección a la que lleva una redirección: http(s), sin inicio de sesión y permitida por su robots.txt. */
  async function revisarSalto(origen, destino, op) {
    const d = validar(destino.href);
    if (RE_LOGIN.test(d.pathname) && !RE_LOGIN.test(origen.pathname)) {
      throw new ErrorMotor('inicio-sesion', 'El sitio redirigió a una página de inicio de sesión.', { url: origen.href });
    }
    if (op.sinRobots) return d;
    const p = await permitido(d.href, op.senal);
    if (!p.permite) {
      if (p.estado === 'no disponible') throw new ErrorMotor('robots-no-disponible', undefined, { url: origen.href });
      throw new ErrorMotor('robots', 'La dirección redirige a ' + d.host + d.pathname + ', que su robots.txt no permite.', { url: origen.href });
    }
    return d;
  }

  /** Una solicitud, sin reintentos. Sigue hasta 5 redirecciones y revisa cada una antes de pedirla. */
  async function una(u, op, previa) {
    let actual = u;
    for (let salto = 0; ; salto++) {
      const r = await pedir(actual, op, salto === 0 ? previa : null, false);
      if (r.opaca) {
        // Sin acceso a la redirección: se sigue de una vez y se revisa a dónde llegó
        const s = await pedir(actual, op, salto === 0 ? previa : null, true);
        if (!s.revalidada && s.final && s.final !== actual.href) await revisarSalto(actual, new URL(s.final), op);
        return Object.assign(s, { url: u.href, final: s.final || actual.href });
      }
      if (r.redireccion) {
        if (salto >= 5) throw new ErrorMotor('http', 'Demasiadas redirecciones.', { url: u.href, status: r.status });
        let destino;
        try {
          destino = new URL(r.redireccion, actual);
        } catch {
          throw new ErrorMotor('url', 'Redirección a una dirección inválida.', { url: u.href });
        }
        actual = await revisarSalto(u, destino, op);
        continue;
      }
      return Object.assign(r, { url: u.href, final: actual.href });
    }
  }

  /** robots.txt del origen, con caché de 24 horas (RFC 9309, §2.4). No usa la cola del sitio:
      se pide dentro del turno de la lectura que lo necesita, así nunca se espera a sí mismo. */
  async function robotsDe(origen, senal) {
    const guardado = robots.get(origen);
    if (guardado && ahora() - guardado.leido < robotsTtlMs) return guardado;
    if (pendientesRobots.has(origen)) return pendientesRobots.get(origen);
    const u = new URL('/robots.txt', origen);
    const tarea = (async () => {
      const otra = robots.get(origen);
      await pausarSiHaceFalta(u.host, pausaMinimaMs, senal);
      let status = 0;
      let texto = '';
      try {
        const r = await una(u, { accept: 'text/plain,*/*', maxBytes: MAXIMO_ROBOTS * 2, senal, sinRobots: true }, null);
        status = r.status;
        texto = decodificar(r.bytes, r.tipo).slice(0, MAXIMO_ROBOTS);
      } catch (e) {
        if (e.codigo === 'cancelado') throw e;
        // 401/403 al pedir robots.txt: la norma lo trata como «sin reglas» (4xx)
        status = e.status || 0;
      }
      const s = segunRespuesta(status, texto);
      const info = { estado: s.estado, robots: s.robots, status, leido: ahora(), texto: s.estado === 'leído' ? texto : '' };
      // Si no se pudo leer pero hay una copia de menos de 30 días, se usa (RFC 9309, §2.4)
      if (s.estado === 'no disponible' && otra && otra.robots && ahora() - otra.leido < 30 * 86400000) {
        anotar({ tipo: 'robots', origen, estado: 'copia guardada', status });
        return Object.assign({}, otra, { estado: 'copia guardada', leido: ahora() - robotsTtlMs + 3600000 });
      }
      anotar({ tipo: 'robots', origen, estado: s.estado, status });
      return info;
    })();
    pendientesRobots.set(origen, tarea);
    try {
      const nuevo = await tarea;
      robots.set(origen, nuevo);
      return nuevo;
    } finally {
      pendientesRobots.delete(origen);
    }
  }

  /** ¿Se puede leer esta dirección? Lee el robots.txt del sitio si hace falta. */
  async function permitido(url, senal) {
    const u = validar(url);
    const r = await robotsDe(u.origin, senal);
    if (!r.robots) return { permite: false, estado: r.estado, regla: 'robots.txt no disponible', demora: null };
    const p = permitidoPorRobots(r.robots, u.href, ua);
    return Object.assign({ estado: r.estado }, p);
  }

  function claveDe(u, op) {
    return (op.accept || '*/*') + ' ' + u.href;
  }
  function reintentable(e) {
    return !!(e && e.pasajero);
  }
  function espera(intento, e) {
    if (e && e.esperaMs !== null && e.esperaMs !== undefined) return e.esperaMs;
    // Espera creciente con un poco de azar para no sincronizarse con otros clientes
    return Math.round(esperaBaseMs * Math.pow(2, intento) * (0.85 + Math.random() * 0.3));
  }

  /**
   * Trae una dirección cumpliendo todas las reglas.
   * @param {string} url
   * @param {object} op { accept, tipo: 'texto'|'bytes'|'json', cache (true), ttlMs, limitePorMinuto,
   *                      maxBytes, tiempoMaximoMs, senal }
   * @returns {Promise<{status, url, final, tipo, texto?, bytes?, json?, desdeCache, recuperada}>}
   */
  async function traer(url, op = {}) {
    const u = validar(url);
    if (op.senal && op.senal.aborted) throw new ErrorMotor('cancelado', undefined, { url });
    const clave = claveDe(u, op);
    const usarCache = op.cache !== false;
    const previa = usarCache ? await cache.leer(clave) : null;
    if (previa && previa.expira > ahora()) {
      cuenta.desdeCache++;
      return entregar(previa, op, true);
    }
    return enTurno(u.host, async () => {
      const p = await permitido(u.href, op.senal);
      if (!p.permite) {
        if (p.estado === 'no disponible') throw new ErrorMotor('robots-no-disponible', undefined, { url: u.href });
        throw new ErrorMotor('robots', 'robots.txt no permite ' + u.pathname + (p.regla ? ' (' + p.regla + ')' : '') + '.', { url: u.href });
      }
      const paso = intervalo(p.demora, op.limitePorMinuto);
      for (let intento = 0; ; intento++) {
        await pausarSiHaceFalta(u.host, paso, op.senal);
        try {
          const r = await una(u, op, previa);
          if (r.revalidada) {
            const renovada = Object.assign({}, previa, { expira: ahora() + (op.ttlMs || ttlPorDefecto), recuperada: new Date(ahora()).toISOString() });
            await guardarEnCache(clave, renovada, usarCache);
            anotar({ tipo: 'solicitud', url: u.href, status: 304, cache: 'revalidada' });
            return entregar(renovada, op, true);
          }
          const guardar = {
            status: r.status,
            url: r.url,
            final: r.final,
            tipo: r.tipo,
            cuerpo: Buffer.from(r.bytes).toString('base64'),
            etag: r.etag,
            ultimaModificacion: r.ultimaModificacion,
            recuperada: r.recuperada,
            expira: ahora() + (op.ttlMs || ttlPorDefecto),
          };
          await guardarEnCache(clave, guardar, usarCache);
          anotar({ tipo: 'solicitud', url: u.href, status: r.status, bytes: r.bytes.length, ms: r.duracionMs });
          return entregar(guardar, op, false, r.bytes);
        } catch (e) {
          if (!reintentable(e) || intento >= reintentos) {
            anotar({ tipo: 'falla', url: u.href, codigo: e.codigo || 'red', mensaje: String(e.message || e).slice(0, 300) });
            throw e;
          }
          const ms = espera(intento, e);
          if (ms > esperaMaximaMs) throw new ErrorMotor('demasiadas', `El sitio pidió esperar ${Math.round(ms / 1000)} s.`, { url: u.href, status: e.status });
          cuenta.reintentos++;
          anotar({ tipo: 'reintento', url: u.href, intento: intento + 1, esperaMs: ms, codigo: e.codigo, status: e.status || null });
          await esperar(ms, op.senal);
        }
      }
    });
  }

  async function guardarEnCache(clave, valor, usar) {
    if (!usar) return;
    try {
      await cache.guardar(clave, valor);
    } catch (e) {
      anotar({ tipo: 'cache', mensaje: 'No se pudo guardar en la caché: ' + String(e.message || e).slice(0, 200) });
    }
  }

  function entregar(g, op, desdeCache, bytesYa) {
    const bytes = bytesYa || new Uint8Array(Buffer.from(g.cuerpo || '', 'base64'));
    const out = { status: g.status, url: g.url, final: g.final, tipo: g.tipo, recuperada: g.recuperada, desdeCache: !!desdeCache };
    const tipo = op.tipo || 'texto';
    if (tipo === 'bytes') out.bytes = bytes;
    else {
      out.texto = decodificar(bytes, g.tipo);
      if (tipo === 'json') {
        try {
          out.json = JSON.parse(out.texto);
        } catch {
          throw new ErrorMotor('formato', 'La respuesta no es JSON válido.', { url: g.url });
        }
      }
    }
    return out;
  }

  return {
    agente: ua,
    contacto: agente.contacto,
    traer,
    permitido,
    robotsDe,
    olvidarRobots: () => robots.clear(),
    estadisticas: () => JSON.parse(JSON.stringify(cuenta)),
  };
}
