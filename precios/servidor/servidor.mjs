// ARKEN PRECIOS · servidor de recolección (opcional, §17.3).
//
// Corre el mismo motor de la app de escritorio en un equipo que queda encendido: lee las fuentes
// certificadas a la hora programada (hora de Colombia) o cuando el programa lo pide, y deja cada
// lectura en un paquete de precios con su hash. El programa descarga los paquetes y vuelve a
// verificar cada precio con su núcleo, como si los hubiera leído él: el servidor no escribe en la
// base de nadie.
//
// API (todo con «Authorization: Bearer <token>»; responde JSON):
//   GET  /salud                          versión, horario, plan guardado, último paquete
//   POST /plan                           guarda el plan de las lecturas programadas
//   POST /ejecutar                       lee ahora con el plan que llega → 202 { id }
//   GET  /ejecuciones/:id?desde=n        { estado, eventos (desde el n), siguiente, paqueteId, error }
//   POST /ejecuciones/:id/cancelar
//   POST /probar                         prueba técnica de una ficha → { prueba }
//   GET  /paquetes?desde=<id>            { paquetes: [{ id }] } posteriores a <id>
//   GET  /paquetes/ultimo                el paquete más reciente
//   GET  /paquetes/:id                   un paquete
//
// Lo que guarda (carpeta de datos): plan.json (fuentes certificadas, catálogo y vínculos; sin
// precios, usuarios ni claves), estado.json, paquetes/ (los últimos 30) y cache/ (respuestas de
// los sitios, para no volver a pedir lo que no cambió).

import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ejecutar, probar, validarPlan as validarEnMotor, VERSION_PLAN } from '../motor/motor.mjs';
import { cargarNucleo, plano } from '../motor/nucleo.mjs';
import { cacheEnDisco } from '../motor/cache.mjs';
import { VERSION_AGENTE, contactoValido } from '../motor/red.mjs';
import { ErrorMotor } from '../motor/errores.mjs';

export const NOMBRE = 'ARKEN PRECIOS · servidor de recolección';
export const VERSION = VERSION_AGENTE;
/** El token se compara entero y en tiempo constante; uno corto se adivina. */
export const LARGO_MINIMO_TOKEN = 32;
export const MAXIMO_PAQUETES = 30;
const MAXIMO_EJECUCIONES = 20;
const MAXIMO_EVENTOS = 3000;
const LIMITE_CUERPO = 25 * 1024 * 1024;
const LIMITE_PRUEBA = 2 * 1024 * 1024;
const RE_ID = /^[\w-]{4,80}$/;
const DESFASE_COLOMBIA = -5 * 3600000;

/** Error con el código HTTP que corresponde. */
class ErrorHttp extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.status = status;
  }
}

const iso = (ms) => new Date(ms).toISOString();
const hoyColombia = (ms) => new Date(ms + DESFASE_COLOMBIA).toISOString().slice(0, 10);
const huella = (t) => createHash('sha256').update(String(t), 'utf8').digest();
const decodificar = (t) => {
  try {
    return decodeURIComponent(t);
  } catch {
    return '';
  }
};

/** Id de paquete o de ejecución: se ordena por fecha y hora, al milisegundo (20261005T110000123Z-1a2b). */
let ultimoMs = 0;
function nuevoId(ms) {
  ultimoMs = Math.max(ms, ultimoMs + 1);
  return iso(ultimoMs).replace(/[-:.]/g, '') + '-' + randomBytes(2).toString('hex');
}

/** Escritura que nunca deja un archivo a medias. */
async function escribirAtomico(ruta, texto) {
  const tmp = ruta + '.' + randomBytes(4).toString('hex') + '.tmp';
  await writeFile(tmp, texto, 'utf8');
  await rename(tmp, ruta);
}
async function leerJson(ruta, porDefecto) {
  try {
    return JSON.parse(await readFile(ruta, 'utf8'));
  } catch {
    return porDefecto;
  }
}

/**
 * «diaria 06:00», «semanal lunes 06:00» (o «semanal 1 06:00»), «mensual 5 06:00»; vacío o «no»: sin
 * programación. Devuelve la programación tal como la entiende el núcleo del programa.
 */
export function leerProgramacion(texto, N) {
  const t = String(texto || '')
    .trim()
    .toLowerCase();
  if (!t || t === 'no' || t === 'ninguna') return { activa: false, frecuencia: 'diaria', dia: 1, hora: '06:00' };
  const partes = t.split(/\s+/);
  const frecuencia = partes[0];
  if (N.Recoleccion.FRECUENCIAS.indexOf(frecuencia) < 0) throw new Error('Programación no válida: «' + texto + '». Use «diaria 06:00», «semanal lunes 06:00» o «mensual 5 06:00».');
  const hora = partes[partes.length - 1];
  if (!/^\d{1,2}:\d{2}$/.test(hora)) throw new Error('Programación sin hora válida: «' + texto + '» (por ejemplo, 06:00).');
  let dia = 1;
  if (frecuencia !== 'diaria') {
    const d = partes.length === 3 ? partes[1] : '';
    const k = N.Recoleccion.DIAS_SEMANA.indexOf(d);
    dia = frecuencia === 'semanal' && k >= 0 ? k + 1 : Number(d);
    if (!(dia >= 1 && dia <= (frecuencia === 'semanal' ? 7 : 28))) throw new Error('Programación sin día válido: «' + texto + '».');
  }
  return N.Recoleccion.normalizarProgramacion({ activa: true, frecuencia, dia, hora });
}

/** Lo que se guarda (y se lee) de un plan: cada parte con la forma que el motor usa, nada más, y
    sin nada con forma de clave. Un plan con campos de más no los lleva al disco ni al motor. */
function planGuardable(p, N) {
  const R = N.Recoleccion;
  const x = N.limpiarClaves(plano(p));
  const fuentes = x.fuentes.filter((f) => f && typeof f === 'object').map((f) => plano(R.fichaPlana(f)));
  const ids = new Set(fuentes.map((f) => f.id));
  const busquedas = {};
  const b0 = x.busquedas && typeof x.busquedas === 'object' ? x.busquedas : {};
  Object.keys(b0).forEach((id) => {
    if (!ids.has(id) || !Array.isArray(b0[id])) return;
    busquedas[id] = b0[id]
      .slice(0, R.TOPES.busquedasPorFuente)
      .map((b) => ({ insumoId: String((b && b.insumoId) || ''), ciudad: (b && b.ciudad) || null }))
      .filter((b) => b.insumoId);
  });
  return {
    version: VERSION_PLAN,
    modo: 'actualizar',
    contacto: String(x.contacto || '').trim(),
    descripcion: String(x.descripcion || '').slice(0, 300),
    fuentes,
    insumos: x.insumos.filter((i) => i && i.id).map((i) => plano(R.insumoPlano(i))),
    vinculos: (Array.isArray(x.vinculos) ? x.vinculos : [])
      .filter((v) => v && v.id && v.url)
      .map((v) => ({ id: v.id, insumoId: v.insumoId, fuenteId: v.fuenteId || null, url: v.url, claveUrl: v.claveUrl || '', clave: v.clave || null, estado: v.estado })),
    busquedas,
    limites: plano(R.limites(x.limites)),
  };
}

/**
 * Crea el servidor.
 * @param {object} o { token, datos (carpeta), contacto, programacion (texto), origenes ('*' o lista),
 *   fetch, nucleo, programa, opcionesRed, cache, reloj (() => ms), maximoPaquetes, revisarCadaMs (60000; 0 = no
 *   revisa sola), registro (como console) }
 */
export async function crearServidor(o = {}) {
  const token = String(o.token || '');
  if (token.length < LARGO_MINIMO_TOKEN) throw new Error('El token del servidor debe tener al menos ' + LARGO_MINIMO_TOKEN + ' caracteres.');
  if (!o.datos) throw new Error('Falta la carpeta de datos del servidor.');
  const huellaToken = huella(token);
  const N = o.nucleo || cargarNucleo(o.programa, { semilla: true });
  const reloj = o.reloj || (() => Date.now());
  const registro = o.registro || { log() {}, error() {} };
  const contactoServidor = String(o.contacto || '').trim();
  if (contactoServidor && !contactoValido(contactoServidor)) throw new Error('El correo de contacto del servidor no es válido: ' + contactoServidor);
  const maximoPaquetes = o.maximoPaquetes || MAXIMO_PAQUETES;
  const origenes = Array.isArray(o.origenes)
    ? o.origenes
    : String(o.origenes || '*')
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
  const textoProgramacion = String(o.programacion || '').trim();
  const programacion = leerProgramacion(textoProgramacion, N);

  const carpeta = o.datos;
  const rutaPaquetes = join(carpeta, 'paquetes');
  await mkdir(rutaPaquetes, { recursive: true });
  const cache = o.cache || cacheEnDisco(join(carpeta, 'cache'));
  const rutaEstado = join(carpeta, 'estado.json');
  const rutaPlan = join(carpeta, 'plan.json');

  const estado = Object.assign({ ultimoPaquete: null, ultimaProgramada: null, programacion: null, ultimaEjecucion: null }, await leerJson(rutaEstado, {}));
  let plan = await leerJson(rutaPlan, null);
  // La programación cuenta desde que se puso: un servidor nuevo no corre por una hora que ya pasó
  if (!estado.programacion || estado.programacion.texto !== textoProgramacion) {
    estado.programacion = { texto: textoProgramacion, activada: iso(reloj()) };
    await guardarEstado();
  }

  const ejecuciones = new Map();
  let ocupado = null;
  let reloj60 = null;
  let servidorHttp = null;

  async function guardarEstado() {
    await escribirAtomico(rutaEstado, JSON.stringify(estado, null, 1));
  }

  /* ── Paquetes ── */
  async function listaPaquetes() {
    const archivos = await readdir(rutaPaquetes).catch(() => []);
    return archivos
      .filter((a) => /\.json$/.test(a))
      .map((a) => a.slice(0, -5))
      .filter((id) => RE_ID.test(id))
      .sort();
  }
  async function guardarPaquete(p, r, extra) {
    const id = nuevoId(reloj());
    const contenido = N.Recoleccion.contenidoPaquete(p, r, Object.assign({ nombre: NOMBRE, version: VERSION }, extra));
    const paquete = N.Formatos.envolver(N.Recoleccion.PAQUETE, contenido, { id });
    await escribirAtomico(join(rutaPaquetes, id + '.json'), JSON.stringify(paquete));
    const todos = await listaPaquetes();
    for (const viejo of todos.slice(0, Math.max(0, todos.length - maximoPaquetes))) await rm(join(rutaPaquetes, viejo + '.json'), { force: true });
    estado.ultimoPaquete = { id, generado: paquete.generado };
    await guardarEstado();
    return id;
  }

  /** La salud que dejó una lectura pasa al plan guardado: la próxima programada no insiste con un sitio bloqueado. */
  async function saludAlPlan(r) {
    if (!plan || !r || !Array.isArray(r.salud)) return;
    const porId = new Map(r.salud.map((s) => [s.fuenteId, s]));
    let cambio = false;
    plan.fuentes = plan.fuentes.map((f) => {
      const x = r.fuentes && r.fuentes[f.id];
      if (!x || x.estado === 'omitida' || !porId.has(f.id)) return f;
      const s = N.Recoleccion.saludParaFicha(f, porId.get(f.id));
      if (!s) return f;
      cambio = true;
      return Object.assign({}, f, plano(s));
    });
    if (cambio) await escribirAtomico(rutaPlan, JSON.stringify(plan));
  }

  /* ── Ejecuciones ── */
  function resumenEjecucion(ej) {
    return { id: ej.id, origen: ej.origen, estado: ej.estado, inicio: ej.inicio, fin: ej.fin, paqueteId: ej.paqueteId, error: ej.error };
  }
  function podarEjecuciones() {
    const terminadas = Array.from(ejecuciones.values()).filter((e) => e.estado !== 'en curso');
    while (ejecuciones.size > MAXIMO_EJECUCIONES && terminadas.length) ejecuciones.delete(terminadas.shift().id);
  }
  function contactoDe(p) {
    return contactoServidor || String((p && p.contacto) || '').trim();
  }

  function iniciarEjecucion(p, origen) {
    if (ocupado) throw new ErrorHttp(409, ocupado.tipo === 'prueba' ? 'El servidor está haciendo una prueba técnica: espere a que termine.' : 'El servidor ya está leyendo las fuentes: espere a que termine.');
    const ahora = reloj();
    const id = nuevoId(ahora);
    const ctl = new AbortController();
    const ej = { id, origen, estado: 'en curso', inicio: iso(ahora), fin: null, eventos: [], paqueteId: null, error: null, ctl, termino: null };
    ejecuciones.set(id, ej);
    podarEjecuciones();
    ocupado = { tipo: 'ejecución', id };
    const plan1 = Object.assign({}, p, { ejecucionId: 'servidor-' + id, contacto: contactoDe(p), hoy: hoyColombia(ahora), modo: 'actualizar' });
    registro.log('[' + iso(reloj()) + '] Lectura ' + id + ' (' + origen + '): ' + plan1.fuentes.length + ' fuente(s).');
    ej.termino = (async () => {
      try {
        const r = await ejecutar(plan1, {
          fetch: o.fetch,
          nucleo: N,
          cache,
          opcionesRed: o.opcionesRed,
          senal: ctl.signal,
          alEvento: (e) => {
            if (ej.eventos.length >= MAXIMO_EVENTOS && e && e.tipo === 'progreso') return;
            ej.eventos.push(plano(e));
          },
        });
        await saludAlPlan(r);
        if (r.cancelado || ctl.signal.aborted) {
          ej.estado = 'cancelada';
          ej.error = 'La lectura se canceló.';
          return;
        }
        ej.paqueteId = await guardarPaquete(plan1, r, { origen, ejecucion: id });
        ej.estado = 'terminada';
      } catch (e) {
        ej.estado = ctl.signal.aborted ? 'cancelada' : 'falló';
        ej.error = String((e && e.message) || e).slice(0, 500);
        registro.error('[' + iso(reloj()) + '] La lectura ' + id + ' falló: ' + ej.error);
      } finally {
        // La caché no crece sin límite: después de cada lectura se borra lo más viejo si pasa del máximo
        if (typeof cache.podar === 'function') await cache.podar().catch((e) => registro.error('No se pudo podar la caché: ' + e.message));
        ej.fin = iso(reloj());
        if (ocupado && ocupado.id === id) ocupado = null;
        estado.ultimaEjecucion = resumenEjecucion(ej);
        await guardarEstado().catch((e) => registro.error('No se pudo guardar el estado: ' + e.message));
        registro.log('[' + ej.fin + '] Lectura ' + id + ': ' + ej.estado + (ej.paqueteId ? ' · paquete ' + ej.paqueteId : ''));
      }
    })();
    return ej;
  }

  /* ── Programación ── */
  function infoProgramacion() {
    if (!programacion.activa) return { activa: false, descripcion: 'sin programación' };
    const { siguiente } = N.Recoleccion.instantes(programacion, reloj());
    return { activa: true, descripcion: N.Recoleccion.describir(programacion) + ' (hora de Colombia)', siguiente: N.Recoleccion.horaColombia(siguiente) };
  }
  /** Si ya pasó la hora programada y hay plan, lee. Devuelve la ejecución que empezó, o null. */
  async function revisarProgramacion() {
    if (!programacion.activa || !plan || ocupado) return null;
    const ahora = reloj();
    if (!N.Recoleccion.debeCorrer(programacion, estado.ultimaProgramada, ahora, estado.programacion.activada)) return null;
    // Se anota antes de leer: si el equipo se apaga a mitad, no queda repitiendo la misma hora
    estado.ultimaProgramada = iso(ahora);
    await guardarEstado();
    return iniciarEjecucion(plan, 'programada');
  }

  /* ── HTTP ── */
  function cabecerasCors(req) {
    const origen = req.headers.origin;
    if (!origen) return {};
    const permitido = origenes.includes('*') ? '*' : origenes.includes(origen) ? origen : '';
    if (!permitido) return {};
    return {
      'Access-Control-Allow-Origin': permitido,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    };
  }
  function responder(req, res, status, cuerpo, extra) {
    const texto = typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
    res.writeHead(
      status,
      Object.assign(
        { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(texto) },
        cabecerasCors(req),
        extra || {},
      ),
    );
    res.end(texto);
  }
  function autorizado(req) {
    const m = /^Bearer\s+(\S+)\s*$/i.exec(String(req.headers.authorization || ''));
    return !!m && timingSafeEqual(huella(m[1]), huellaToken);
  }
  function leerCuerpo(req, limite) {
    const grande = () => new ErrorHttp(413, 'El cuerpo de la solicitud es demasiado grande.');
    if (Number(req.headers['content-length']) > limite) return Promise.reject(grande());
    return new Promise((resolver, rechazar) => {
      const partes = [];
      let total = 0;
      req.on('data', (c) => {
        if (total > limite) return;
        total += c.length;
        if (total > limite) {
          partes.length = 0;
          rechazar(grande());
          return;
        }
        partes.push(c);
      });
      req.on('end', () => {
        try {
          resolver(JSON.parse(Buffer.concat(partes).toString('utf8') || 'null'));
        } catch {
          rechazar(new ErrorHttp(400, 'El cuerpo no es un JSON válido.'));
        }
      });
      req.on('error', rechazar);
    });
  }
  function validarPlanEntrante(p) {
    const v = N.Recoleccion.validarPlan(p);
    if (!v.ok) throw new ErrorHttp(400, v.errores.join(' '));
    try {
      validarEnMotor(Object.assign({}, p, { contacto: contactoDe(p) }));
    } catch (e) {
      throw new ErrorHttp(400, e.message);
    }
    if (p.fuentes.length > 200 || p.insumos.length > 50000) throw new ErrorHttp(400, 'El plan es más grande de lo que el servidor acepta.');
  }

  async function atender(req, res) {
    const u = new URL(req.url, 'http://servidor');
    const ruta = u.pathname.replace(/\/+$/, '') || '/';
    const metodo = req.method;
    if (metodo === 'OPTIONS') {
      res.writeHead(204, Object.assign({ 'Cache-Control': 'no-store' }, cabecerasCors(req)));
      return res.end();
    }
    if (!autorizado(req)) return responder(req, res, 401, { error: 'Falta el token del servidor o no es el correcto.' }, { 'WWW-Authenticate': 'Bearer' });
    const solo = (m) => {
      if (metodo !== m) throw new ErrorHttp(405, 'Método no permitido en ' + ruta + '.');
    };

    if (ruta === '/salud') {
      solo('GET');
      return responder(req, res, 200, {
        ok: true,
        servidor: NOMBRE,
        version: VERSION,
        programacion: infoProgramacion(),
        plan: plan ? { fuentes: plan.fuentes.length, insumos: plan.insumos.length, recibido: plan.recibido || null, descripcion: plan.descripcion || '' } : null,
        ultimoPaquete: estado.ultimoPaquete,
        ultimaEjecucion: estado.ultimaEjecucion,
        enCurso: !!ocupado,
      });
    }
    if (ruta === '/plan') {
      solo('POST');
      const p = await leerCuerpo(req, LIMITE_CUERPO);
      validarPlanEntrante(p);
      plan = Object.assign(planGuardable(p, N), { recibido: iso(reloj()) });
      await escribirAtomico(rutaPlan, JSON.stringify(plan));
      const pr = infoProgramacion();
      registro.log('[' + iso(reloj()) + '] Plan recibido: ' + plan.fuentes.length + ' fuente(s), ' + plan.insumos.length + ' insumo(s).');
      return responder(req, res, 200, { ok: true, fuentes: plan.fuentes.length, insumos: plan.insumos.length, siguiente: pr.activa ? pr.siguiente + ' (hora de Colombia)' : null });
    }
    if (ruta === '/ejecutar') {
      solo('POST');
      const p = await leerCuerpo(req, LIMITE_CUERPO);
      validarPlanEntrante(p);
      const ej = iniciarEjecucion(planGuardable(p, N), 'pedida');
      return responder(req, res, 202, { id: ej.id });
    }
    let m = /^\/ejecuciones\/([^/]+)(\/cancelar)?$/.exec(ruta);
    if (m) {
      const id = decodificar(m[1]);
      const ej = RE_ID.test(id) ? ejecuciones.get(id) : null;
      if (!ej) throw new ErrorHttp(404, 'No hay una lectura con ese número en este servidor.');
      if (m[2]) {
        solo('POST');
        if (ej.estado === 'en curso') ej.ctl.abort();
        return responder(req, res, 200, { ok: true, estado: ej.estado === 'en curso' ? 'cancelando' : ej.estado });
      }
      solo('GET');
      const desde = Math.max(0, Math.floor(Number(u.searchParams.get('desde')) || 0));
      return responder(req, res, 200, Object.assign(resumenEjecucion(ej), { eventos: ej.eventos.slice(desde), siguiente: ej.eventos.length }));
    }
    if (ruta === '/probar') {
      solo('POST');
      const x = await leerCuerpo(req, LIMITE_PRUEBA);
      const f = x && x.fuente;
      if (!f || typeof f !== 'object' || typeof f.id !== 'string' || !f.id || f.id.length > 120) throw new ErrorHttp(400, 'Falta la ficha de la fuente que se va a probar.');
      const contacto = contactoServidor || String(x.contacto || '').trim();
      if (!contactoValido(contacto)) throw new ErrorHttp(400, new ErrorMotor('sin-contacto').message);
      if (ocupado) throw new ErrorHttp(409, 'El servidor está leyendo las fuentes: pruebe cuando termine.');
      ocupado = { tipo: 'prueba' };
      try {
        const prueba = await probar(N.limpiarClaves(plano(f)), { contacto, fetch: o.fetch, nucleo: N, cache, opcionesRed: o.opcionesRed });
        registro.log('[' + iso(reloj()) + '] Prueba técnica de ' + f.id + ': ' + prueba.resultado + (prueba.motivo ? ' · ' + prueba.motivo : ''));
        return responder(req, res, 200, { prueba: plano(prueba) });
      } catch (e) {
        // Una ficha que el motor no acepta (configuración incompleta) es un error de quien la manda
        if (e && e.name === 'ErrorMotor') throw new ErrorHttp(400, e.message);
        throw e;
      } finally {
        ocupado = null;
      }
    }
    if (ruta === '/paquetes') {
      solo('GET');
      const desde = String(u.searchParams.get('desde') || '');
      const lista = (await listaPaquetes()).filter((id) => !desde || id > desde);
      return responder(req, res, 200, { paquetes: lista.map((id) => ({ id })) });
    }
    m = /^\/paquetes\/([^/]+)$/.exec(ruta);
    if (m) {
      solo('GET');
      let id = decodificar(m[1]);
      if (id === 'ultimo') id = (await listaPaquetes()).pop() || '';
      if (!RE_ID.test(id)) throw new ErrorHttp(404, 'Todavía no hay paquetes en este servidor.');
      let texto;
      try {
        texto = await readFile(join(rutaPaquetes, id + '.json'), 'utf8');
      } catch {
        throw new ErrorHttp(404, 'No hay un paquete con ese número (el servidor guarda los últimos ' + maximoPaquetes + ').');
      }
      return responder(req, res, 200, texto);
    }
    throw new ErrorHttp(404, 'No existe ' + ruta + ' en este servidor.');
  }

  async function manejar(req, res) {
    try {
      await atender(req, res);
    } catch (e) {
      const status = e instanceof ErrorHttp ? e.status : 500;
      if (status === 500) registro.error('[' + iso(reloj()) + '] ' + req.method + ' ' + String(req.url).split('?')[0] + ': ' + ((e && e.stack) || e));
      // Con un cuerpo demasiado grande se responde y se cierra la conexión: el resto no se lee
      if (!res.headersSent) responder(req, res, status, { error: status === 500 ? 'Error interno del servidor.' : e.message }, status === 413 ? { Connection: 'close' } : undefined);
      else res.destroy();
    }
  }

  return {
    manejar,
    revisarProgramacion,
    iniciarEjecucion,
    ejecucion: (id) => ejecuciones.get(id) || null,
    /** Espera a que termine la lectura `id` (pruebas y cierre ordenado). */
    async esperar(id) {
      const ej = ejecuciones.get(id);
      if (ej && ej.termino) await ej.termino;
      return ej ? resumenEjecucion(ej) : null;
    },
    estado: () => JSON.parse(JSON.stringify({ estado, plan: plan ? { fuentes: plan.fuentes.length, insumos: plan.insumos.length } : null, ocupado })),
    programacion: infoProgramacion,
    /** Escucha en `puerto` y `host` y revisa la programación cada minuto. */
    escuchar(puerto = 8787, host = '127.0.0.1') {
      return new Promise((resolver, rechazar) => {
        servidorHttp = http.createServer((req, res) => {
          manejar(req, res);
        });
        servidorHttp.requestTimeout = 10 * 60000;
        servidorHttp.once('error', rechazar);
        servidorHttp.listen(puerto, host, () => {
          const d = servidorHttp.address();
          const cada = o.revisarCadaMs === undefined ? 60000 : o.revisarCadaMs;
          if (cada > 0)
            reloj60 = setInterval(() => {
              revisarProgramacion().catch((e) => registro.error('Programación: ' + e.message));
            }, cada);
          revisarProgramacion().catch((e) => registro.error('Programación: ' + e.message));
          resolver({ puerto: d.port, host: d.address, url: 'http://' + (d.address.includes(':') ? '[' + d.address + ']' : d.address) + ':' + d.port });
        });
      });
    },
    /** Cancela la lectura en curso, espera a que se guarde su estado y deja de escuchar. */
    async cerrar() {
      if (reloj60) clearInterval(reloj60);
      const enCurso = Array.from(ejecuciones.values()).filter((e) => e.estado === 'en curso');
      enCurso.forEach((e) => e.ctl.abort());
      await Promise.all(enCurso.map((e) => e.termino));
      if (servidorHttp) {
        await new Promise((r) => {
          servidorHttp.close(() => r());
          // Las consultas largas del programa (cada 2,5 s) no detienen el cierre
          servidorHttp.closeAllConnections?.();
        });
      }
    },
  };
}
