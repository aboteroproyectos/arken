// ARKEN PRECIOS · pruebas de la recolección (Fase 3, §7.2, §11 y §17.3).
//
// Lo que comparten el programa, la app de escritorio y el servidor (Nucleo.Recoleccion), leído
// del programa armado, sin copias. Sin internet: el motor lee las páginas guardadas
// (pruebas/fixtures/motor) y su resultado pasa por el mismo código con que el programa lo recibe.
//
//   · plan del motor: fuentes certificadas, búsquedas por insumo, listas, vínculos y topes
//   · estimación de solicitudes y tiempo para la vista previa
//   · actualizaciones programadas en hora de Colombia: diaria, semanal, mensual y las perdidas
//   · reparto de lo que trae el motor: el programa vuelve a verificar cada precio (criterio 9)
//   · índices del ICOCED, salud de las fuentes y paquetes del servidor con su hash
//   · fichas de una base anterior puestas al día con la revisión legal de la semilla
//
// Uso: npm run prueba:recoleccion

import { cargarNucleo } from '../motor/nucleo.mjs';
import { ejecutar, validarPlan as validarEnMotor } from '../motor/motor.mjs';
import { CONTACTO, OPCIONES_RED, internetNormal, fichaDePrueba, fuentesDePrueba } from './fixtures/motor/internet.mjs';

let fallas = 0;
let pruebas = 0;
function seccion(t) {
  console.log('\n▸ ' + t);
}
function ok(cond, msg, detalle) {
  pruebas++;
  if (cond) console.log('  ✔ ' + msg);
  else {
    fallas++;
    console.error('  ✖ ' + msg + (detalle !== undefined ? '\n      ' + JSON.stringify(detalle).slice(0, 1500) : ''));
  }
}
const copia = (x) => JSON.parse(JSON.stringify(x));

const N = cargarNucleo(undefined, { semilla: true });
const C = N.Conectores;
const R = N.Recoleccion;
const S = N.Semilla;
const CATALOGO = S.catalogo();
const CIUDADES = S.ciudades();
const CEMENTO = CATALOGO.find((i) => i.id === 'G02-0001');
const TUBO = CATALOGO.find((i) => i.id === 'G13-0003');
const MANO_DE_OBRA = CATALOGO.find((i) => i.categoriaArken === 'Mano de Obra');
const FUENTES = fuentesDePrueba(C);
const HOY = '2026-10-05';

/* ═════════════════════════════  PLAN  ═════════════════════════════ */
seccion('Plan del motor');
{
  ok(R.contactoValido('compras@constructora.example') && R.contactoValido('https://constructora.example/contacto'), 'contacto: un correo o una página http(s)');
  ok(!R.contactoValido('') && !R.contactoValido('compras') && !R.contactoValido('javascript:alert(1)'), 'contacto: sin correo ni página no hay contacto');
  const lim = R.limites({ busquedasPorFuente: 9999, fuentesALaVez: -1, minutosPorFuente: '15' });
  ok(lim.busquedasPorFuente === R.TOPES.busquedasPorFuente && lim.fuentesALaVez === R.LIMITES.fuentesALaVez && lim.minutosPorFuente === 15, 'límites: nadie sube los topes que protegen a los sitios', lim);

  const manual = S.fuentes(HOY + 'T00:00:00-05:00').find((f) => f.id === 'homecenter');
  const porCertificar = S.fuentes(HOY + 'T00:00:00-05:00').find((f) => f.id === 'easy');
  const suspendida = Object.assign(fichaDePrueba(C, 'suspendida', 'api-json', { conector: 'easy' }), { salud: 'suspendida' });
  const bloqueada = Object.assign(fichaDePrueba(C, 'bloqueada', 'api-json', { conector: 'easy' }), { salud: 'bloqueada' });
  const inactivo = Object.assign({}, CATALOGO.find((i) => i.id === 'G02-0003'), { activo: false });
  const catalogo = CATALOGO.map((i) => (i.id === inactivo.id ? inactivo : i));
  const p = R.armar({ ejecucionId: 'ej-plan', contacto: CONTACTO, fuentes: FUENTES.concat([manual, porCertificar, suspendida, bloqueada]), catalogo, hoy: HOY, descripcion: 'Prueba' });
  ok(p.fuentes.map((f) => f.id).join() === 'easy,casitaroja,aldia,idu,tvec,dane', 'solo viajan las fuentes certificadas con una salud que deja leer (ni la manual, ni la que falta certificar, ni la suspendida, ni la bloqueada)', p.fuentes.map((f) => f.id));
  ok(Object.keys(p.busquedas).join() === 'easy,casitaroja,tvec', 'buscan las fuentes de búsqueda; las listas y los índices no', Object.keys(p.busquedas));
  ok(p.busquedas.easy.length === R.LIMITES.busquedasPorFuente, 'cada fuente busca a lo sumo su límite de insumos', p.busquedas.easy.length);
  ok(p.insumos.length === catalogo.filter((i) => i.activo !== false).length && !p.insumos.some((i) => i.id === inactivo.id), 'con una lista en el plan viaja todo el catálogo activo, para emparejar sus filas', p.insumos.length);
  ok(!Object.values(p.busquedas).some((l) => l.some((b) => b.insumoId === MANO_DE_OBRA.id || b.insumoId === inactivo.id)), 'no se busca la mano de obra ni un insumo inactivo');
  const plano = p.fuentes[0];
  ok(!('notas' in plano) && !('urlRobots' in plano.revisionLegal) && plano.ultimaPrueba.huella === FUENTES[0].ultimaPrueba.huella, 'la ficha viaja sin notas ni evidencia, con la huella de su prueba técnica', plano);
  ok(Object.keys(p.insumos[0]).join() === 'id,codigo,descripcion,unidad,sinonimos,especificacion,consultaBusqueda,grupo,categoria,categoriaArken,investigable', 'de cada insumo viaja lo que sirve para buscarlo y emparejarlo, sin precios', Object.keys(p.insumos[0]));
  ok(R.validarPlan(p).ok, 'el plan es válido para el programa');
  let motorLoAcepta = true;
  try {
    validarEnMotor(p);
  } catch {
    motorLoAcepta = false;
  }
  ok(motorLoAcepta, '… y para el motor');
  const sinContacto = R.validarPlan(Object.assign({}, p, { contacto: '' }));
  ok(!sinContacto.ok && /correo de contacto/.test(sinContacto.errores.join()), 'un plan sin contacto no es válido', sinContacto);
  ok(!R.validarPlan(Object.assign({}, p, { version: 2 })).ok && !R.validarPlan(null).ok, 'ni uno de otra versión ni uno vacío');

  // Alcance, orden y categorías
  const otro = CATALOGO.find((i) => i.id === 'G02-0002');
  const soloTiendas = R.armar({
    contacto: CONTACTO,
    fuentes: [Object.assign(fichaDePrueba(C, 'easy', 'api-json', { conector: 'easy' }), { categorias: [CEMENTO.grupo] }), fichaDePrueba(C, 'tvec', 'socrata', { conector: 'tvec' })],
    catalogo: CATALOGO,
    insumoIds: [CEMENTO.id, TUBO.id, otro.id, MANO_DE_OBRA.id],
    ultimas: { [CEMENTO.id]: '2026-09-01', [TUBO.id]: '2026-01-15' },
    limites: { busquedasPorFuente: 2 },
  });
  ok(soloTiendas.busquedas.tvec.map((b) => b.insumoId).join() === [otro.id, TUBO.id].join(), 'primero lo que nunca ha tenido precio, después lo que lleva más tiempo sin precio, hasta el límite', soloTiendas.busquedas.tvec);
  ok(soloTiendas.busquedas.easy.every((b) => CATALOGO.find((i) => i.id === b.insumoId).grupo === CEMENTO.grupo) && soloTiendas.busquedas.easy.length === 2, 'una tienda con categorías solo busca los insumos de sus grupos', soloTiendas.busquedas.easy);
  ok(soloTiendas.insumos.length === 3 && !soloTiendas.insumos.some((i) => i.id === MANO_DE_OBRA.id), 'sin listas, viajan solo los insumos que se buscan', soloTiendas.insumos.map((i) => i.id));

  // Vínculos: solo los que decidió una persona, con dirección http(s)
  const vinculos = [
    { id: 'v1', insumoId: CEMENTO.id, fuenteId: 'easy', url: 'https://www.easy.com.co/cemento/p', clave: 'easy:1', estado: 'confirmado' },
    { id: 'v2', insumoId: CEMENTO.id, fuenteId: 'easy', url: 'https://www.easy.com.co/otro/p', clave: 'easy:2', estado: 'rechazado' },
    { id: 'v3', insumoId: CEMENTO.id, fuenteId: 'easy', url: 'https://www.easy.com.co/sugerido/p', estado: 'sugerido' },
    { id: 'v4', insumoId: CEMENTO.id, fuenteId: 'easy', url: 'javascript:alert(1)', estado: 'confirmado' },
  ];
  const conVinc = R.armar({ contacto: CONTACTO, fuentes: FUENTES, catalogo: CATALOGO, vinculos });
  ok(conVinc.vinculos.map((v) => v.id).join() === 'v1,v2' && conVinc.vinculos[0].claveUrl === N.claveUrl(vinculos[0].url), 'viajan los vínculos confirmados y rechazados con dirección http(s); los sugeridos y los «javascript:» no', conVinc.vinculos);

  // Modo «probar»: la fuente viaja aunque no esté certificada (la prueba es parte de certificarla)
  const prueba = R.armar({ modo: 'probar', contacto: CONTACTO, fuentes: [porCertificar], catalogo: CATALOGO });
  ok(prueba.modo === 'probar' && prueba.fuentes.length === 1, 'para probar, la fuente viaja aunque falte certificarla');
}

seccion('Estimación para la vista previa');
{
  const f = (id, metodo, cfg, limitePorMinuto, extra) => Object.assign(fichaDePrueba(C, id, metodo, cfg, extra), { limitePorMinuto });
  const plan = R.armar({
    contacto: CONTACTO,
    fuentes: [f('easy', 'api-json', { conector: 'easy' }, 10), f('aldia', 'html', { conector: 'aldia' }, 6), f('dane', 'excel', { conector: 'icoced' }, 10)],
    catalogo: CATALOGO,
    insumoIds: [CEMENTO.id, TUBO.id],
    vinculos: [{ id: 'v1', insumoId: CEMENTO.id, fuenteId: 'easy', url: 'https://www.easy.com.co/cemento/p', estado: 'confirmado' }],
  });
  const e = R.estimar(plan);
  const por = Object.fromEntries(e.porFuente.map((x) => [x.id, x]));
  ok(por.easy.solicitudes === 1 + 2 + 1 && por.easy.segundos === 4 * 6, 'búsqueda: robots.txt, una por insumo y una por vínculo confirmado, a su ritmo (10 por minuto = 6 s)', por.easy);
  ok(por.aldia.solicitudes === 1 + R.LIMITES.paginasPorLista && por.aldia.segundos === 61 * 10, 'lista: hasta su tope de páginas, a 6 por minuto', por.aldia);
  ok(por.dane.solicitudes === 4 && por.dane.segundos === 4 * 6, 'índices: robots.txt, la página y sus anexos', por.dane);
  ok(e.solicitudes === 4 + 61 + 4 && e.busquedas === 2 && e.fuentes === 3, 'totales del plan', e);
  ok(e.segundos === 610, 'se leen varias fuentes a la vez: el tiempo es el de la más lenta', e.segundos);
  const lenta = R.estimar(Object.assign({}, plan, { fuentes: [Object.assign({}, plan.fuentes[1], { limitePorMinuto: 1 })], limites: { minutosPorFuente: 5 } }));
  ok(lenta.segundos === 300, 'ninguna fuente pasa de sus minutos máximos', lenta);
}

/* ═════════════════════════════  PROGRAMACIÓN  ═════════════════════════════ */
seccion('Actualizaciones programadas (hora de Colombia, UTC−5)');
{
  const t = (iso) => Date.parse(iso);
  const semanal = { activa: true, frecuencia: 'semanal', dia: 1, hora: '06:00' };
  let x = R.instantes(semanal, t('2026-10-05T12:00:00Z'));
  ok(x.anterior === t('2026-10-05T11:00:00Z') && x.siguiente === t('2026-10-12T11:00:00Z'), 'semanal: el lunes a las 7 a. m. la última fue hoy a las 6 y la siguiente es el otro lunes', [new Date(x.anterior), new Date(x.siguiente)]);
  x = R.instantes(semanal, t('2026-10-05T10:59:00Z'));
  ok(x.anterior === t('2026-09-28T11:00:00Z') && x.siguiente === t('2026-10-05T11:00:00Z'), 'semanal: un minuto antes de las 6 todavía cuenta la de la semana pasada');
  x = R.instantes(semanal, t('2026-10-12T04:00:00Z'));
  ok(x.anterior === t('2026-10-05T11:00:00Z') && x.siguiente === t('2026-10-12T11:00:00Z'), 'semanal: el domingo a las 11 p. m. en Colombia (ya lunes en UTC) la del lunes todavía no llega', [new Date(x.anterior), new Date(x.siguiente)]);
  x = R.instantes({ frecuencia: 'diaria', hora: '06:00' }, t('2026-10-06T04:00:00Z'));
  ok(x.anterior === t('2026-10-05T11:00:00Z') && x.siguiente === t('2026-10-06T11:00:00Z'), 'diaria: a las 11 p. m. la última fue hoy y la siguiente es mañana');
  x = R.instantes({ frecuencia: 'mensual', dia: 28, hora: '23:30' }, t('2027-01-10T12:00:00Z'));
  ok(x.anterior === t('2026-12-29T04:30:00Z') && x.siguiente === t('2027-01-29T04:30:00Z'), 'mensual: cruza el cambio de año (28 de diciembre y 28 de enero a las 11:30 p. m.)', [new Date(x.anterior), new Date(x.siguiente)]);

  const ahora = t('2026-10-05T12:00:00Z');
  ok(R.debeCorrer(semanal, '2026-09-28T11:05:00Z', ahora, '2026-09-01T00:00:00Z'), 'toca: la hora de esta semana ya pasó y no ha corrido');
  ok(!R.debeCorrer(semanal, '2026-10-05T11:01:00Z', ahora, '2026-09-01T00:00:00Z'), 'no toca: ya corrió después de la hora');
  ok(!R.debeCorrer(semanal, null, ahora, '2026-10-05T11:30:00Z'), 'no toca: se activó después de la hora de esta semana (espera a la siguiente)');
  ok(!R.debeCorrer(Object.assign({}, semanal, { activa: false }), null, ahora, null), 'apagada no corre');
  const tarde = t('2026-10-20T15:00:00Z');
  ok(R.debeCorrer(semanal, '2026-10-05T11:01:00Z', tarde, '2026-09-01T00:00:00Z'), 'el equipo estuvo apagado dos lunes: corre al abrir el programa…');
  ok(!R.debeCorrer(semanal, new Date(tarde).toISOString(), tarde + 60000, '2026-09-01T00:00:00Z'), '… una sola vez, no una por cada lunes perdido');

  ok(R.describir(semanal) === 'Cada lunes a las 06:00' && R.describir({ frecuencia: 'diaria', hora: '6:00' }) === 'Todos los días a las 06:00' && R.describir({ frecuencia: 'mensual', dia: 28, hora: '23:30' }) === 'El día 28 de cada mes a las 23:30', 'descripción para la pantalla');
  const n = R.normalizarProgramacion({ frecuencia: 'cada rato', dia: 9, hora: '25:99' });
  ok(n.frecuencia === 'semanal' && n.dia === 7 && n.hora === '23:59' && n.activa === false, 'una programación mal escrita queda en valores posibles, y apagada', n);
  ok(R.horaColombia(t('2026-10-12T11:00:00Z')) === '2026-10-12 06:00', 'hora de Colombia para mostrar');
}

/* ═════════════════════════════  LO QUE DEVUELVE EL MOTOR  ═════════════════════════════ */
seccion('Reparto de una lectura real del motor (páginas guardadas)');
const plan = R.armar({ ejecucionId: 'ej-1', contacto: CONTACTO, fuentes: FUENTES, catalogo: CATALOGO, insumoIds: [CEMENTO.id, TUBO.id], limites: { busquedasPorFuente: 5 }, hoy: HOY });
const net = internetNormal();
const resultado = await ejecutar(plan, { fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED });
const ctx = { catalogo: CATALOGO, vinculos: [], ciudades: CIUDADES, fuentes: FUENTES, hoy: HOY };
const rep = R.repartir(resultado, ctx);
{
  ok(Object.values(resultado.fuentes).every((f) => f.estado === 'leída'), 'el motor leyó las seis fuentes', Object.fromEntries(Object.entries(resultado.fuentes).map(([k, f]) => [k, f.estado + ' ' + f.motivo])));
  ok(rep.observaciones.length + rep.bandeja.length + rep.descartados.length === resultado.hallazgos.length, 'cada hallazgo tiene un destino: precio, bandeja o descartado', [rep.observaciones.length, rep.bandeja.length, rep.descartados.length, resultado.hallazgos.length]);
  ok(rep.observaciones.length >= 4 && rep.observaciones.every((y) => y.x.verificacion.estado === 'verificado' && y.cl.destino === 'observación'), 'los precios que entran fueron verificados de nuevo por el programa', rep.observaciones.length);
  const espacios = (t) => String(t).replace(/\s+/g, ' ');
  ok(rep.observaciones.every((y) => espacios(y.x.pagina.texto).includes(y.x.h.textoLiteral) && y.cl.captura && y.cl.captura.precioPublicado === y.x.h.precio), 'el texto literal de cada precio está en lo leído (con sus espacios) y el precio es el de ese texto');
  const de = (fuente, insumo) => rep.observaciones.find((y) => y.x.fuenteId === fuente && y.x.insumoId === insumo);
  ok(de('easy', CEMENTO.id) && de('casitaroja', CEMENTO.id) && de('aldia', CEMENTO.id), 'el cemento de Easy, de La Casita Roja y de Aldia entra como precio');
  ok(de('casitaroja', CEMENTO.id).x.h.ciudad === 'Cartagena' && de('aldia', CEMENTO.id).x.h.ciudad === 'Bucaramanga', 'cada tienda con su ciudad');
  ok(rep.observaciones.filter((y) => y.x.fuenteId === 'idu').every((y) => y.x.tipoPrecio === 'oficial' && y.x.h.ciudad === 'Bogotá'), 'las filas del IDU entran como precio oficial de Bogotá');
  ok(rep.bandeja.filter((y) => y.x.fuenteId === 'tvec').length >= 1 && rep.bandeja.filter((y) => y.x.fuenteId === 'tvec').every((y) => y.x.tipoPrecio === 'contrato'), 'las órdenes de compra del Estado son precio de contrato', rep.bandeja.map((y) => [y.x.fuenteId, y.x.tipoPrecio]));
  const porBusqueda = {};
  rep.bandeja.forEach((y) => (porBusqueda[y.x.fuenteId + '|' + y.x.insumoId] = (porBusqueda[y.x.fuenteId + '|' + y.x.insumoId] || 0) + 1));
  ok(Object.values(porBusqueda).every((n) => n <= R.EN_BANDEJA_POR_BUSQUEDA), 'a la bandeja llegan a lo sumo 3 productos por búsqueda', porBusqueda);
  const productos = new Set(rep.observaciones.map((y) => y.x.fuenteId + '|' + y.x.clave));
  ok(!rep.bandeja.some((y) => productos.has(y.x.fuenteId + '|' + y.x.clave)), 'un producto que ya quedó como precio de un insumo no llega a la bandeja por otro');
  ok(rep.descartados.some((d) => d.x.fuenteId === 'easy' && /Se parece 0 % al insumo buscado; se parece más a otro insumo/.test(d.motivo)), 'el cemento que trajo la búsqueda del tubo no llega a la bandeja del tubo', rep.descartados.map((d) => d.motivo));
  ok(rep.descartados.some((d) => /ni a otro del catálogo/.test(d.motivo)), 'lo que no se parece a nada del catálogo se descarta: no son insumos nuevos');
  ok(rep.descartados.some((d) => d.x.fuenteId === 'aldia' && /al menos 60 %/.test(d.motivo)), 'una fila de una lista que se parece menos de 60 % se descarta');
  ok(!rep.bandeja.some((y) => (y.cl.emparejamiento.puntaje || 0) < C.MINIMO_BUSQUEDA), 'en la bandeja no hay productos que se parezcan menos de 30 % al insumo buscado', rep.bandeja.map((y) => y.cl.emparejamiento.puntaje));
  ok(rep.porFuente.easy && rep.porFuente.easy.observaciones === 1, 'cuentas por fuente', rep.porFuente);

  // Lo que decidió una persona manda
  const fila = resultado.hallazgos.find((x) => x.fuenteId === 'aldia' && x.insumoId === CEMENTO.id);
  const rechazo = R.repartir(resultado, Object.assign({}, ctx, { vinculos: [{ id: 'v1', insumoId: CEMENTO.id, fuenteId: 'aldia', clave: fila.clave, lista: true, estado: 'rechazado' }] }));
  ok(!rechazo.observaciones.some((y) => y.x.fuenteId === 'aldia' && y.x.insumoId === CEMENTO.id) && rechazo.descartados.some((d) => d.x.clave === fila.clave && /Una persona indicó/.test(d.motivo)), 'una fila que una persona rechazó para un insumo no vuelve a entrar como su precio', rechazo.descartados.map((d) => d.motivo));
  const sinFuente = R.repartir(resultado, Object.assign({}, ctx, { fuentes: FUENTES.filter((f) => f.id !== 'easy') }));
  ok(sinFuente.descartados.filter((d) => /La fuente ya no está/.test(d.motivo)).length === resultado.hallazgos.filter((x) => x.fuenteId === 'easy').length, 'lo de una fuente que ya no existe se descarta');
  const sinInsumo = R.repartir(resultado, Object.assign({}, ctx, { catalogo: CATALOGO.map((i) => (i.id === CEMENTO.id ? Object.assign({}, i, { activo: false }) : i)) }));
  ok(!sinInsumo.observaciones.some((y) => y.x.insumoId === CEMENTO.id) && sinInsumo.descartados.some((d) => /inactivo/.test(d.motivo)), 'lo de un insumo que se desactivó mientras corría se descarta');
}

seccion('Criterio 9: un precio que no está escrito en lo leído no entra');
{
  const base = resultado.hallazgos.find((x) => x.fuenteId === 'easy' && x.insumoId === CEMENTO.id);
  const uno = (cambio) => {
    const x = copia(base);
    cambio(x);
    return R.repartir({ hallazgos: [x] }, ctx);
  };
  let r = uno(() => {});
  ok(r.observaciones.length === 1, 'sin cambios, el precio de Easy entra', r.descartados);
  r = uno((x) => (x.h.precio = 30000));
  ok(!r.observaciones.length && !r.bandeja.length && /no encontró el precio en el texto leído/.test(r.descartados[0].motivo), 'un precio cambiado (30.000 en vez de 33.333) se descarta', r.descartados);
  r = uno((x) => (x.h.textoLiteral = 'Price: 30000'));
  ok(!r.observaciones.length && !r.bandeja.length, 'un texto literal que no está en la página se descarta', r.descartados);
  r = uno((x) => (x.h.url = 'javascript:alert(1)'));
  ok(!r.observaciones.length && /http\(s\)/.test(r.descartados[0].motivo), 'una dirección que no es http(s) se descarta', r.descartados);
  r = uno((x) => delete x.pagina);
  ok(!r.observaciones.length && !r.bandeja.length && /no entregó el texto leído/.test(r.descartados[0].motivo), 'sin el texto leído no hay precio', r.descartados);
  r = uno((x) => (x.verificacion = { estado: 'verificado' }) && (x.h.precio = 1));
  ok(!r.observaciones.length, 'la verificación que dice traer el motor no cuenta: el programa verifica por su cuenta');
  r = uno((x) => (x.tipoPrecio = 'inventado'));
  ok(r.observaciones.length === 1 && r.observaciones[0].x.tipoPrecio === 'lista', 'un tipo de precio desconocido queda como precio de lista');
  r = R.repartir({ hallazgos: [null, 'texto', 42, { fuenteId: 'easy' }] }, ctx);
  ok(!r.observaciones.length && !r.bandeja.length, 'basura en el resultado no produce precios', r);
}

seccion('Índices del ICOCED y salud de las fuentes');
{
  const iv = R.indicesValidos(resultado.indices, { dominios: S.DOMINIOS_ICOCED, fuentes: FUENTES });
  ok(iv.validos.length === resultado.indices.length && iv.validos.length > 50, 'los índices del anexo del DANE son válidos', [iv.validos.length, resultado.indices.length, iv.descartados]);
  ok(iv.validos.every((x) => x.cita === C.CITA_DANE && x.id === C.idIndice(x) && /^https:\/\/www\.dane\.gov\.co\//.test(x.url)), 'cada índice lleva la cita del DANE, su id y su anexo');
  const malo = (cambio) => R.indicesValidos([Object.assign(copia(resultado.indices[0]), cambio)], { dominios: S.DOMINIOS_ICOCED, fuentes: FUENTES });
  ok(malo({ dominio: 'Dominio Inventado AU*' }).descartados === 1 && malo({ mes: '2026-13' }).descartados === 1 && malo({ indice: -4 }).descartados === 1, 'se descartan un dominio desconocido, un mes imposible y un índice negativo');
  ok(malo({ url: 'javascript:alert(1)' }).descartados === 1 && malo({ fuenteId: 'otra' }).descartados === 1 && malo({ id: 'inventado' }).validos[0].id !== 'inventado', 'y una dirección que no es http(s) o una fuente que no existe; el id lo pone el programa');

  const s = { fuenteId: 'easy', estado: 'bloqueada', fallosSeguidos: 1, motivo: 'CAPTCHA', desde: '2026-10-05T12:00:00Z', errores: [{ fecha: '2026-10-05', codigo: 'captcha', mensaje: 'Pidió un CAPTCHA', url: 'javascript:alert(1)', status: 403 }] };
  const a = R.saludParaFicha({ salud: 'activa' }, s);
  ok(a.salud === 'bloqueada' && a.saludDetalle.motivo === 'CAPTCHA' && a.errores[0].url === '' && a.errores[0].status === 403, 'la salud que trae el motor queda en la ficha, con sus errores (sin direcciones que no sean http(s))', a);
  ok(R.saludParaFicha({ salud: 'suspendida' }, s).salud === 'suspendida', 'una fuente que una persona suspendió mientras corría sigue suspendida');
  ok(R.saludParaFicha({ salud: 'activa' }, { estado: 'inventada' }).salud === 'activa' && R.saludParaFicha({}, null) === null, 'un estado desconocido no cambia nada');
}

/* ═════════════════════════════  PAQUETES DEL SERVIDOR  ═════════════════════════════ */
seccion('Paquetes del servidor');
{
  const sucio = copia(resultado);
  sucio.hallazgos[0].pagina.texto += ' sk-ant-api03-' + 'x'.repeat(40);
  sucio.token = 'secreto';
  const env = N.Formatos.envolver(R.PAQUETE, R.contenidoPaquete(plan, sucio, { origen: 'servidor de prueba' }), { id: '20261005T120000Z-prueba' });
  ok(N.Formatos.verificar(env, R.PAQUETE).ok && env.id === '20261005T120000Z-prueba', 'el paquete lleva su formato, su id y el hash del contenido');
  ok(!('bitacora' in env.contenido.resultado) && env.contenido.plan.fuentes.join() === plan.fuentes.map((f) => f.id).join(), 'sin la bitácora detallada; del plan, solo los ids de las fuentes');
  ok(!N.contieneClave(JSON.stringify(env)) && !/secreto/.test(JSON.stringify(env)), 'nada con forma de clave viaja en un paquete (criterio 8)');
  const alterado = copia(env);
  alterado.contenido.resultado.hallazgos[0].h.precio = 1;
  ok(!N.Formatos.verificar(alterado, R.PAQUETE).ok, 'un paquete alterado no pasa la verificación del hash');
  ok(!N.Formatos.verificar(env, N.Formatos.RESPALDO).ok, 'un paquete no se confunde con un respaldo');
  // Aunque alguien rehaga el hash, el programa vuelve a verificar cada precio
  const rehecho = copia(env);
  const h0 = rehecho.contenido.resultado.hallazgos.find((x) => x.fuenteId === 'easy' && x.insumoId === CEMENTO.id);
  h0.h.precio = 1;
  rehecho.hash = N.Cripto.sha256Hex(N.Cripto.jsonCanonico(rehecho.contenido));
  ok(N.Formatos.verificar(rehecho, R.PAQUETE).ok, 'un paquete con el hash rehecho pasa la verificación de integridad…');
  const r2 = R.repartir(rehecho.contenido.resultado, ctx);
  ok(!r2.observaciones.some((y) => y.x.fuenteId === 'easy' && y.x.insumoId === CEMENTO.id) && r2.observaciones.length === rep.observaciones.length - 1, '… pero el precio cambiado no entra (criterio 9)', r2.observaciones.length);
}

/* ═════════════════════════════  FICHAS DE UNA BASE ANTERIOR  ═════════════════════════════ */
seccion('Fuentes de una base anterior, al día con la semilla');
{
  const ahora = '2026-10-05T08:00:00-05:00';
  const viejas = [
    // Nadie la tocó: se reemplaza por la de la semilla (Homecenter pasa a manual y rechazada)
    { id: 'homecenter', nombre: 'Homecenter', tipo: 'tienda en línea', metodo: 'html', salud: 'suspendida', revisionLegal: { resultado: 'por certificar' }, creado: '2026-10-02T00:00:00-05:00' },
    // Una persona la revisó sin evidencia: recibe la evidencia, conserva su resultado y su responsable
    { id: 'easy', nombre: 'Easy', metodo: 'api-json', salud: 'activa', configuracion: {}, actualizado: '2026-10-03T00:00:00-05:00', revisionLegal: { resultado: 'aprobada', responsable: 'Ana Prueba', fecha: '2026-10-03', robotsTxt: '', terminos: '' } },
    // Una persona la revisó con su propia evidencia: la conserva
    { id: 'aldia', nombre: 'Aldia', metodo: 'html', salud: 'activa', configuracion: { conector: 'aldia', lista: { urls: ['https://aldiaferreteria.com/cementos-concretos-y-morteros'] } }, actualizado: '2026-10-03T00:00:00-05:00', revisionLegal: { resultado: 'aprobada', responsable: 'Ana Prueba', fecha: '2026-10-03', robotsTxt: 'Lo que escribió Ana.', terminos: 'Lo que leyó Ana.' } },
    // Sin tocar pero con historia: conserva su salud y su prueba
    { id: 'tvec', nombre: 'TVEC', metodo: 'socrata', salud: 'degradada', ultimaPrueba: { resultado: 'aprobada', fecha: '2026-10-04' }, creado: '2026-10-02T00:00:00-05:00' },
  ];
  const cambios = S.ponerAlDiaFuentes(viejas, ahora);
  const de = (id) => cambios.find((f) => f.id === id);
  ok(de('homecenter').metodo === 'manual' && de('homecenter').revisionLegal.resultado === 'rechazada' && de('homecenter').creado === viejas[0].creado, 'una ficha que nadie tocó toma la de la semilla (Homecenter: solo a mano), con su fecha de creación', de('homecenter'));
  ok(C.certificacion(de('homecenter')).estado === 'manual', '… y queda fuera de la lectura automática');
  const easy = de('easy');
  ok(easy.revisionLegal.resultado === 'aprobada' && easy.revisionLegal.responsable === 'Ana Prueba' && /API/.test(easy.revisionLegal.robotsTxt) && easy.revisionLegal.urlTerminos && easy.revisionLegal.recomendacion, 'una ficha revisada sin evidencia la recibe, sin cambiar el resultado ni el responsable', easy.revisionLegal);
  ok(easy.configuracion.conector === 'easy' && easy.actualizado === viejas[1].actualizado, '… y recibe la configuración del conector que le faltaba');
  const aldia = de('aldia');
  ok(aldia && aldia.revisionLegal.robotsTxt === 'Lo que escribió Ana.' && aldia.configuracion.lista.urls.length === 1 && aldia.revisionLegal.recomendacion, 'la evidencia y la configuración que puso una persona se conservan; solo llega la recomendación', aldia);
  ok(de('tvec').salud === 'degradada' && de('tvec').ultimaPrueba.fecha === '2026-10-04' && de('tvec').configuracion.conector === 'tvec', 'una ficha sin tocar con historia conserva su salud y su prueba', de('tvec'));
  ok(de('dane') && de('idu') && de('casitaroja'), 'las fuentes nuevas de la semilla se agregan');
  const otraVez = S.ponerAlDiaFuentes(S.fuentes(ahora).map((f) => Object.assign(f, { actualizado: ahora })), ahora);
  ok(otraVez.length === 0, 'una base ya al día no cambia', otraVez.map((f) => f.id));
  ok(S.VERSION_FUENTES >= 2, 'la semilla de fuentes tiene versión');
}

seccion('Registro por cambios con los conectores: cada producto es su serie');
{
  const URL_P = 'https://www.easy.com.co/cemento-gris-50-kg/p';
  const base = { insumoId: 'G02-0001', fuenteId: 'easy', ciudad: null, presentacion: { cantidad: 50, unidad: 'KG' }, precioPublicado: 33333, incluyeIva: true, unidadPublicada: 'BTO', metodo: 'api-json', url: URL_P, serie: 'easy:9000001', fechaCaptura: HOY };
  const previa = Object.assign({ id: 'o1' }, base);
  const comparar = (x) => N.Observaciones.comparar(Object.assign({}, base, x), [previa]).accion;
  ok(comparar({}) === 'duplicado', 'el mismo producto, el mismo día y al mismo precio es un duplicado');
  ok(comparar({ precioPublicado: 35555 }) === 'nueva', 'el mismo día con otro precio es una observación nueva: el precio cambió (la lectura de la mañana y el paquete de la tarde)');
  ok(comparar({ fechaCaptura: '2026-10-06' }) === 'fundir', 'otro día al mismo precio se funde con la anterior («visto N veces»)');
  ok(comparar({ serie: 'easy:9000002', url: 'https://www.easy.com.co/otro-cemento/p' }) === 'nueva', 'otro producto de la misma fuente para el mismo insumo es su propia serie');
}

console.log('\n' + (fallas ? '✖ ' + fallas + ' de ' + pruebas + ' comprobaciones fallaron.' : pruebas + ' de ' + pruebas + ' comprobaciones bien.'));
process.exit(fallas ? 1 : 0);
