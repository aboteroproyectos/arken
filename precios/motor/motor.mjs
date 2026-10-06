// ARKEN PRECIOS · motor de recolección (§7.2).
//
// Recibe un plan del programa (las fichas de las fuentes, el catálogo, los vínculos y qué buscar)
// y devuelve lo que leyó: hallazgos ya verificados, índices, la salud de cada fuente y la cuenta
// de solicitudes. El motor no escribe en la base de datos: el programa vuelve a verificar cada
// hallazgo con su mismo núcleo y decide a dónde va (observación, bandeja «Por revisar», nuevos
// insumos o descarte). Así la regla de oro se cumple dos veces: ningún precio entra si no está
// escrito, tal cual, en lo que se leyó.
//
// Corre en el proceso principal de la app de escritorio y en el servidor de recolección, con la
// misma red (robots.txt, pausas, reintentos, caché, agente identificado) y el mismo interruptor
// de salud por fuente.
//
// Plan (versión 1):
//   { version, ejecucionId, modo: 'actualizar'|'probar', contacto, hoy,
//     fuentes: [fichas], insumos: [{ id, codigo, descripcion, unidad, sinonimos, … }],
//     vinculos: [{ id, insumoId, fuenteId, url, claveUrl, clave, estado }],
//     busquedas: { [fuenteId]: [{ insumoId, ciudad }] },
//     limites: { busquedasPorFuente, productosPorFuente, paginasPorLista, resultadosPorBusqueda,
//                fuentesALaVez, minutosPorFuente } }
// Resultado:
//   { version, ejecucionId, modo, inicio, fin, agente, cancelado,
//     fuentes: { [id]: { estado, motivo, conector, modo, solicitudes, desdeCache, crudos, verificados,
//                        noVerificables, sinPareja, hallazgos, indices, paginas, errores, avisos,
//                        duracionMs, prueba? } },
//     hallazgos: [{ id, fuenteId, metodo, tipoPrecio, insumoId, clave, lista, vinculoId, h,
//                   pagina: { url, texto, leida, tipo, recuperada }, verificacion, emparejamiento }],
//     indices: [...], salud: [...], estadisticas, bitacora }

import { crearRed, contactoValido } from './red.mjs';
import { crearSalud } from './salud.mjs';
import { ErrorMotor, comoRegistro, DE_BLOQUEO } from './errores.mjs';
import { cargarNucleo, plano } from './nucleo.mjs';
import { conectorPara } from './conectores/index.mjs';

export const VERSION_PLAN = 1;
export const LIMITES = {
  busquedasPorFuente: 40,
  productosPorFuente: 60,
  paginasPorLista: 60,
  resultadosPorBusqueda: 10,
  fuentesALaVez: 3,
  minutosPorFuente: 30,
};

/** Fallas que tocan un solo elemento (una búsqueda, una página, un producto) y no la fuente. */
const DE_ELEMENTO = new Set(['no-encontrado', 'robots', 'url', 'tamaño']);
/** Fallas tras las cuales no tiene sentido seguir leyendo la fuente en esta ejecución. */
const DETIENEN = new Set(['bloqueado', 'captcha', 'inicio-sesion', 'formato', 'robots-no-disponible', 'sin-contacto', 'configuracion']);

/** Insumos de prueba para una fuente que busca, cuando el programa no manda cuáles. */
export const PRUEBA_BUSQUEDAS = [
  { id: 'prueba-cemento', descripcion: 'Cemento gris uso general 50 kg', unidad: 'BTO' },
  { id: 'prueba-varilla', descripcion: 'Varilla corrugada 1/2" x 6 m', unidad: 'UN' },
  { id: 'prueba-tubo', descripcion: 'Tubo PVC sanitario 4" x 6 m', unidad: 'UN' },
];

function hostDe(u) {
  try {
    return new URL(u).host.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Estado de la ficha → estado del interruptor del motor. */
function estadoMotor(salud) {
  if (salud === 'degradada' || salud === 'caída' || salud === 'bloqueada' || salud === 'suspendida') return salud;
  if (salud === 'inactiva') return 'suspendida';
  return 'activa';
}

/** Revisa el plan antes de leer nada. */
export function validarPlan(plan) {
  if (!plan || typeof plan !== 'object') throw new ErrorMotor('configuracion', 'El plan está vacío.');
  if (plan.version !== undefined && plan.version !== VERSION_PLAN) throw new ErrorMotor('configuracion', 'Versión de plan desconocida: ' + plan.version + '.');
  if (!contactoValido(plan.contacto)) throw new ErrorMotor('sin-contacto');
  if (!Array.isArray(plan.fuentes)) throw new ErrorMotor('configuracion', 'El plan no trae fuentes.');
  if (plan.modo && plan.modo !== 'actualizar' && plan.modo !== 'probar') throw new ErrorMotor('configuracion', 'Modo desconocido: ' + plan.modo + '.');
  return true;
}

/** Señal que se cancela con la de afuera o al pasar `ms`. */
function senalCon(externa, ms) {
  const ctl = new AbortController();
  const t = ms > 0 ? setTimeout(() => ctl.abort(), ms) : null;
  const alAbortar = () => ctl.abort();
  if (externa) {
    if (externa.aborted) ctl.abort();
    else externa.addEventListener('abort', alAbortar, { once: true });
  }
  return {
    senal: ctl.signal,
    porTiempo: () => ctl.signal.aborted && !(externa && externa.aborted),
    soltar() {
      if (t) clearTimeout(t);
      if (externa) externa.removeEventListener('abort', alAbortar);
    },
  };
}

/** Corre `tareas` con a lo sumo `n` a la vez. */
async function enParalelo(tareas, n) {
  let i = 0;
  const trabajar = async () => {
    while (i < tareas.length) {
      const k = i++;
      await tareas[k]();
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, tareas.length)) }, trabajar));
}

/**
 * Ejecuta un plan.
 * @param {object} plan
 * @param {object} [o] { nucleo, programa, fetch, cache, red, senal, alEvento(evento), opcionesRed, opcionesSalud, ahora }
 */
export async function ejecutar(plan, o = {}) {
  validarPlan(plan);
  const N = o.nucleo || cargarNucleo(o.programa, { semilla: true });
  const C = N.Conectores;
  const dominios = (N.Semilla && N.Semilla.DOMINIOS_ICOCED) || [];
  const modoPlan = plan.modo || 'actualizar';
  const limites = Object.assign({}, LIMITES, plan.limites || {});
  const inicio = new Date().toISOString();
  const alEvento = o.alEvento || (() => {});
  const emitir = (e) => {
    try {
      alEvento(e);
    } catch {
      // Un aviso que falla no detiene la lectura
    }
  };
  const bitacora = [];
  const red =
    o.red ||
    crearRed(
      Object.assign(
        {
          agente: { contacto: String(plan.contacto).trim() },
          fetch: o.fetch,
          cache: o.cache,
          registro: (e) => {
            bitacora.push(e);
            if (bitacora.length > 600) bitacora.splice(0, bitacora.length - 500);
          },
        },
        o.opcionesRed || {},
      ),
    );
  const salud = crearSalud(Object.assign({ alCambiar: (c) => emitir(Object.assign({ tipo: 'salud' }, c)) }, o.opcionesSalud || {}));
  salud.importar(
    plan.fuentes.map((f) =>
      Object.assign({}, f.saludDetalle || {}, { fuenteId: f.id, estado: estadoMotor(f.salud), errores: Array.isArray(f.errores) ? f.errores : [] }),
    ),
  );
  const resultado = {
    version: VERSION_PLAN,
    ejecucionId: plan.ejecucionId || null,
    modo: modoPlan,
    inicio,
    fin: null,
    agente: red.agente,
    cancelado: false,
    fuentes: {},
    hallazgos: [],
    indices: [],
    salud: [],
    estadisticas: null,
    bitacora: [],
  };
  const insumos = Array.isArray(plan.insumos) ? plan.insumos : [];
  const porId = new Map(insumos.map((i) => [i.id, i]));
  const vinculos = Array.isArray(plan.vinculos) ? plan.vinculos : [];
  let indiceCatalogo = null;
  const indice = () => indiceCatalogo || (indiceCatalogo = C.indiceCatalogo(insumos));
  let consecutivo = 0;

  emitir({ tipo: 'inicio', ejecucionId: resultado.ejecucionId, modo: modoPlan, fuentes: plan.fuentes.length });

  function nuevoResumen(f) {
    return {
      estado: 'pendiente',
      motivo: '',
      conector: null,
      modo: C.modo(f),
      solicitudes: 0,
      desdeCache: 0,
      crudos: 0,
      verificados: 0,
      noVerificables: 0,
      sinPareja: 0,
      hallazgos: 0,
      indices: 0,
      paginas: 0,
      errores: [],
      avisos: [],
      ejemplos: [],
      duracionMs: 0,
    };
  }

  async function leerFuente(f) {
    const t0 = Date.now();
    const r = nuevoResumen(f);
    resultado.fuentes[f.id] = r;
    const omitir = (motivo, estado = 'omitida') => {
      r.estado = estado;
      r.motivo = motivo;
      emitir({ tipo: 'fuente', fuenteId: f.id, estado, motivo });
      return r;
    };
    // 1. ¿Se puede leer?
    if (!C.automatica(f)) return omitir('La fuente no se lee de forma automática (' + (f.metodo || 'sin método') + ').');
    if (modoPlan === 'probar') {
      const p = C.puedeProbar(f);
      if (!p.ok) return omitir('Antes de probarla falta: ' + p.falta.join('; ') + '.');
    } else {
      const cert = C.certificacion(f);
      if (cert.estado !== 'certificada') return omitir('No está certificada. Falta: ' + cert.falta.join('; ') + '.');
      if (!cert.puedeLeer) return omitir('La fuente está ' + (f.salud || 'sin estado') + '.');
      const puede = salud.puedeIntentar(f.id);
      if (!puede.ok) return omitir(puede.motivo);
    }
    const conector = conectorPara(f);
    if (!conector) return omitir('Este motor no tiene conector para «' + ((f.configuracion && f.configuracion.conector) || f.metodo) + '».');
    r.conector = conector.id;
    const tipoPrecio = (f.configuracion && f.configuracion.tipoPrecio) || conector.tipoPrecio || 'lista';

    // 2. Contexto del conector: la red con el límite de la fuente, y lo que necesita del núcleo
    const tiempo = senalCon(o.senal, (limites.minutosPorFuente || 30) * 60000);
    const contexto = {
      fuente: f,
      config: (f.configuracion && typeof f.configuracion === 'object' ? f.configuracion : {}) || {},
      limites: modoPlan === 'probar' ? Object.assign({}, limites, { paginasPorLista: Math.min(limites.paginasPorLista, 3) }) : limites,
      hoy: plan.hoy || new Date().toISOString().slice(0, 10),
      senal: tiempo.senal,
      async traer(url, op) {
        const x = await red.traer(url, Object.assign({ limitePorMinuto: f.limitePorMinuto, senal: tiempo.senal }, op || {}));
        r.solicitudes++;
        if (x.desdeCache) r.desdeCache++;
        return x;
      },
      consulta: (ins) => C.consulta(ins),
      plantilla: (t, v) => C.plantilla(t, v),
      leerPrecio: (t) => {
        const l = N.LectorPrecios.leer(t);
        return l.ok ? l.valor : null;
      },
      errorFormato: (m, url) => new ErrorMotor('formato', m, { url }),
      esDeElemento: (e) => DE_ELEMENTO.has(e && e.codigo),
      falla(e, url) {
        salud.fallo(f.id, e, { nivel: 'elemento', url });
        if (r.errores.length < 30) r.errores.push(Object.assign({ nivel: 'elemento' }, comoRegistro(e, url)));
      },
      aviso(texto) {
        if (r.avisos.length < 30) r.avisos.push(String(texto).slice(0, 300));
        emitir({ tipo: 'aviso', fuenteId: f.id, texto: String(texto).slice(0, 300) });
      },
      progreso: (x) => emitir(Object.assign({ tipo: 'progreso', fuenteId: f.id }, x || {})),
      indices: {
        dominioCanonico: (n) => C.dominioCanonico(n, dominios),
        idIndice: (x) => C.idIndice(x),
        CITA_DANE: C.CITA_DANE,
      },
    };

    // 3. Cada hallazgo crudo: al formato interno, verificado, y (en una lista) emparejado
    const vistos = new Set();
    const procesar = (c, ctx) => {
      r.crudos++;
      const a = C.aHallazgo(c, f);
      if (!a.ok) {
        r.noVerificables++;
        if (r.errores.length < 30) r.errores.push({ nivel: 'elemento', codigo: 'no-verificable', mensaje: a.motivo, url: (c && c.url) || '' });
        return;
      }
      const h = plano(a.h);
      const v = C.verificar(h, c.pagina);
      if (v.estado !== 'verificado') {
        r.noVerificables++;
        if (r.errores.length < 30) r.errores.push({ nivel: 'elemento', codigo: 'no-verificable', mensaje: v.motivo || v.estado, url: h.url });
        return;
      }
      r.verificados++;
      if (r.ejemplos.length < 5) r.ejemplos.push({ titulo: h.titulo, precio: h.precio, textoLiteral: h.textoLiteral.slice(0, 300), url: h.url });
      if (modoPlan === 'probar') return;
      let insumoId = ctx.insumoId || null;
      let emparejamiento = null;
      if (ctx.lista) {
        const e = C.elegirInsumo(h, indice(), { vinculos, clave: c.clave });
        if (!e) {
          r.sinPareja++;
          return;
        }
        insumoId = e.insumo.id;
        emparejamiento = plano({ insumoId, puntaje: e.puntaje, segundo: e.segundo || null, motivo: e.motivo || '' });
      }
      const k = (c.clave || N.claveUrl(h.url)) + '|' + (insumoId || '');
      if (vistos.has(k)) return;
      vistos.add(k);
      const texto = String(c.pagina.texto || '');
      // La evidencia viaja recortada alrededor del literal: el programa la vuelve a verificar
      const desde = Math.max(0, (v.inicio || 0) - 1500);
      const hasta = Math.min(texto.length, (v.fin || 0) + 1500);
      r.hallazgos++;
      resultado.hallazgos.push({
        id: (resultado.ejecucionId || 'motor') + '-' + f.id + '-' + ++consecutivo,
        fuenteId: f.id,
        metodo: f.metodo,
        tipoPrecio,
        insumoId,
        clave: c.clave || null,
        lista: !!ctx.lista,
        vinculoId: ctx.vinculoId || null,
        h,
        pagina: { url: c.pagina.url || h.url, texto: texto.slice(desde, hasta), leida: true, tipo: c.pagina.tipo || 'html', recuperada: c.pagina.recuperada || null },
        verificacion: { estado: v.estado, extracto: v.extracto || '' },
        emparejamiento,
      });
    };

    // 4. Una falla de la fuente: cuenta para su salud; las de bloqueo la detienen
    let seguidas = 0;
    const fallaDeFuente = (falla) => {
      if (falla && falla.codigo === 'cancelado') throw falla;
      // Una excepción que no es del motor (un dato que el conector no esperaba) es un cambio de formato
      const e = falla instanceof ErrorMotor ? falla : new ErrorMotor('formato', 'El conector no pudo interpretar lo leído: ' + String((falla && falla.message) || falla).slice(0, 200));
      const reg = comoRegistro(e, e && e.url);
      salud.fallo(f.id, e, { url: reg.url });
      if (r.errores.length < 30) r.errores.push(Object.assign({ nivel: 'fuente' }, reg));
      seguidas++;
      return DETIENEN.has(reg.codigo) || DE_BLOQUEO.has(reg.codigo) || seguidas >= 3;
    };
    const exito = () => {
      seguidas = 0;
      salud.exito(f.id);
    };

    emitir({ tipo: 'fuente', fuenteId: f.id, estado: 'leyendo', conector: conector.id, modo: r.modo });
    let detenida = null;
    try {
      if (r.modo === 'indices') {
        try {
          const res = await conector.leerIndices({ contexto });
          exito();
          const lista = (res && res.indices) || [];
          r.indices = lista.length;
          if (modoPlan !== 'probar') for (const x of lista) resultado.indices.push(Object.assign({}, x, { fuenteId: f.id }));
          if (r.ejemplos.length < 5)
            for (const x of lista.slice(-3)) r.ejemplos.push({ titulo: x.dominio + ' · ' + x.grupo + ' · ' + x.mes, precio: x.indice, textoLiteral: x.evidencia || '', url: x.url });
          if (res && res.mes) r.mes = res.mes;
        } catch (e) {
          if (fallaDeFuente(e)) detenida = e;
        }
      } else if (r.modo === 'lista') {
        try {
          const res = await conector.leerLista({ contexto });
          exito();
          r.paginas = (res && res.paginas) || 0;
          for (const c of (res && res.crudos) || []) procesar(c, { lista: true });
        } catch (e) {
          if (fallaDeFuente(e)) detenida = e;
        }
      } else {
        // Primero los productos ya vinculados (lo más preciso), después las búsquedas
        const propios = vinculos
          .filter((v) => v && v.estado === 'confirmado' && v.url && (v.fuenteId === f.id || (f.urlBase && hostDe(v.url) === hostDe(f.urlBase))))
          .slice(0, modoPlan === 'probar' ? 2 : limites.productosPorFuente);
        for (const v of propios) {
          if (detenida) break;
          try {
            const c = await conector.leerProducto({ vinculo: v, ciudad: null, contexto });
            exito();
            if (c) procesar(c, { insumoId: v.insumoId, vinculoId: v.id });
          } catch (e) {
            if (contexto.esDeElemento(e)) contexto.falla(e, v.url);
            else if (fallaDeFuente(e)) detenida = e;
          }
        }
        let busquedas = ((plan.busquedas && plan.busquedas[f.id]) || []).map((b) => Object.assign({}, b, { insumo: porId.get(b.insumoId) })).filter((b) => b.insumo);
        if (modoPlan === 'probar' && !busquedas.length) busquedas = PRUEBA_BUSQUEDAS.map((insumo) => ({ insumo, ciudad: null }));
        busquedas = busquedas.slice(0, modoPlan === 'probar' ? 3 : limites.busquedasPorFuente);
        let hechas = 0;
        for (const b of busquedas) {
          if (detenida) break;
          try {
            const crudos = await conector.buscar({ insumo: b.insumo, ciudad: b.ciudad || null, contexto });
            exito();
            for (const c of crudos || []) procesar(c, { insumoId: b.insumo.id });
          } catch (e) {
            if (contexto.esDeElemento(e)) contexto.falla(e, e.url);
            else if (fallaDeFuente(e)) detenida = e;
          }
          hechas++;
          emitir({ tipo: 'progreso', fuenteId: f.id, hechas, total: busquedas.length });
        }
      }
      if (detenida) {
        r.estado = DE_BLOQUEO.has(detenida.codigo) || detenida.codigo === 'formato' ? 'bloqueada' : 'falló';
        r.motivo = comoRegistro(detenida).mensaje;
      } else if (r.errores.some((x) => x.nivel === 'fuente')) {
        r.estado = 'con fallas';
        r.motivo = r.errores.find((x) => x.nivel === 'fuente').mensaje;
      } else r.estado = 'leída';
    } catch (e) {
      // Solo una cancelación llega aquí: la de afuera detiene todo; la del tiempo, solo la fuente
      if (tiempo.porTiempo()) {
        r.estado = 'incompleta';
        r.motivo = 'Se alcanzó el tiempo máximo de ' + limites.minutosPorFuente + ' minutos para esta fuente.';
      } else {
        r.estado = 'cancelada';
        r.motivo = 'La lectura se canceló.';
        resultado.cancelado = true;
      }
    } finally {
      tiempo.soltar();
      r.duracionMs = Date.now() - t0;
    }
    if (modoPlan === 'probar') r.prueba = resultadoPrueba(f, r, C, red);
    emitir({ tipo: 'fuente', fuenteId: f.id, estado: r.estado, motivo: r.motivo, hallazgos: r.hallazgos, verificados: r.verificados, indices: r.indices });
    return r;
  }

  const tareas = plan.fuentes.map((f) => async () => {
    if (o.senal && o.senal.aborted) {
      resultado.cancelado = true;
      resultado.fuentes[f.id] = Object.assign(nuevoResumen(f), { estado: 'cancelada', motivo: 'La lectura se canceló.' });
      if (modoPlan === 'probar') resultado.fuentes[f.id].prueba = resultadoPrueba(f, resultado.fuentes[f.id], C, red);
      return;
    }
    await leerFuente(f);
  });
  await enParalelo(tareas, limites.fuentesALaVez || 3);

  resultado.fin = new Date().toISOString();
  resultado.salud = salud.exportar().filter((s) => plan.fuentes.some((f) => f.id === s.fuenteId));
  resultado.estadisticas = red.estadisticas();
  resultado.bitacora = bitacora.slice(-300);
  emitir({ tipo: 'fin', ejecucionId: resultado.ejecucionId, hallazgos: resultado.hallazgos.length, indices: resultado.indices.length, cancelado: resultado.cancelado });
  return resultado;
}

/**
 * La prueba técnica de una fuente (§7.1): lee poco (tres búsquedas, tres páginas de la lista o
 * los índices) y dice si el conector funciona con la configuración de la ficha. Se aprueba si
 * lo leído trae precios (o índices) verificados, la mayoría de lo leído se verifica y nada
 * bloqueó la lectura.
 */
export function resultadoPrueba(f, r, C, red) {
  const fallaFuente = r.errores.find((x) => x.nivel === 'fuente');
  const leidos = r.modo === 'indices' ? r.indices : r.verificados;
  let resultado = 'aprobada';
  let motivo = '';
  if (r.estado === 'omitida' || r.estado === 'cancelada') {
    resultado = 'rechazada';
    motivo = r.motivo;
  } else if (r.estado === 'bloqueada' || r.estado === 'falló') {
    resultado = 'rechazada';
    motivo = r.motivo || (fallaFuente && fallaFuente.mensaje) || 'La lectura falló.';
  } else if (!leidos) {
    resultado = 'rechazada';
    motivo = r.modo === 'indices' ? 'No se leyó ningún índice.' : 'No se leyó ningún precio verificable.';
  } else if (r.modo !== 'indices' && r.noVerificables > r.verificados) {
    resultado = 'rechazada';
    motivo = 'La mayoría de lo leído (' + r.noVerificables + ' de ' + (r.noVerificables + r.verificados) + ') no se pudo verificar.';
  }
  return {
    resultado,
    motivo,
    fecha: new Date().toISOString(),
    huella: C.huella(f),
    agente: red.agente,
    conector: r.conector,
    modo: r.modo,
    solicitudes: r.solicitudes,
    desdeCache: r.desdeCache,
    crudos: r.crudos,
    verificados: r.verificados,
    noVerificables: r.noVerificables,
    indices: r.indices,
    paginas: r.paginas,
    ejemplos: r.ejemplos.slice(0, 5),
    errores: r.errores.slice(0, 10),
    avisos: r.avisos.slice(0, 10),
    duracionMs: r.duracionMs,
  };
}

/** Prueba técnica de una sola fuente. */
export async function probar(fuente, o = {}) {
  const plan = Object.assign({ version: VERSION_PLAN, ejecucionId: 'prueba-' + Date.now().toString(36), modo: 'probar' }, o.plan || {}, {
    fuentes: [fuente],
    contacto: o.contacto || (o.plan && o.plan.contacto),
  });
  const r = await ejecutar(plan, o);
  const x = r.fuentes[fuente.id];
  return Object.assign({}, x.prueba || resultadoPrueba(fuente, x, (o.nucleo || cargarNucleo(o.programa, { semilla: true })).Conectores, { agente: r.agente }), {
    salud: r.salud[0] || null,
  });
}
