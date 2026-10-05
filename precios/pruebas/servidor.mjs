// ARKEN PRECIOS · pruebas del servidor de recolección (Fase 3, §17.3).
//
// El servidor de verdad (precios/servidor) en un puerto local, con el motor leyendo las páginas
// guardadas (pruebas/fixtures/motor, sin internet) y carpetas de datos temporales.
//
//   · token: sin él, o con otro, nada responde; va en el encabezado, nunca en la dirección
//   · CORS para el programa abierto desde otra dirección (o como archivo)
//   · plan validado y guardado sin campos de más ni nada con forma de clave
//   · lectura a pedido: eventos, cancelar, ocupado (409) y paquete con su hash, que el núcleo del
//     programa vuelve a verificar; se guardan los últimos 30
//   · prueba técnica de una ficha
//   · programación en hora de Colombia: una vez por hora programada, también la que se perdió; la
//     salud que deja una lectura (un CAPTCHA) cuenta en la siguiente
//   · lo guardado sobrevive a un reinicio · tamaños, rutas y métodos
//   · arranque por línea de comandos con variables de entorno
//   · el programa en una página web con el servidor: probar, leer, enviar el plan y descargar
//
// Uso: npm run prueba:servidor

import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { crearServidor, leerProgramacion, MAXIMO_PAQUETES, LARGO_MINIMO_TOKEN, VERSION } from '../servidor/servidor.mjs';
import { cargarNucleo } from '../motor/nucleo.mjs';
import { cacheEnMemoria } from '../motor/cache.mjs';
import { CONTACTO, OPCIONES_RED, OPCIONES_RAPIDAS, internetNormal, fuentesDePrueba } from './fixtures/motor/internet.mjs';
import { PRECIOS, RUTA_PRECIOS, servidor as servidorArchivos, navegador, contexto, vigilarErrores, abrirPrecios, ingresarPrecios, cerrarModales } from './comun.mjs';

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
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
async function hasta(cond, ms = 30000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (await cond()) return true;
    await pausa(25);
  }
  return false;
}

const N = cargarNucleo(undefined, { semilla: true });
const C = N.Conectores;
const R = N.Recoleccion;
const S = N.Semilla;
const CATALOGO = S.catalogo();
const CEMENTO = 'G02-0001';
const TUBO = 'G13-0003';
const FUENTES = fuentesDePrueba(C);
const CERTIFICABLES = ['easy', 'casitaroja', 'aldia', 'idu', 'tvec', 'dane'];
const TOKEN = 'tok_' + 'x'.repeat(40) + '_PRUEBA';
const CLAVE_FALSA = 'sk-ant-api03-' + 'A'.repeat(90);
const silencio = { log() {}, error() {} };
const tmp = mkdtempSync(join(tmpdir(), 'arken-servidor-'));
const plan = (o = {}) =>
  JSON.parse(JSON.stringify(R.armar(Object.assign({ ejecucionId: 'ej-prueba', contacto: CONTACTO, fuentes: FUENTES, catalogo: CATALOGO, insumoIds: [CEMENTO, TUBO], limites: { busquedasPorFuente: 5 }, hoy: '2026-10-05' }, o))));

/** Cliente de la API con fetch, como el del programa. */
const cliente = (base) => async (ruta, o = {}) => {
  const headers = Object.assign(o.sinToken ? {} : { Authorization: 'Bearer ' + (o.token || TOKEN) }, o.cuerpo !== undefined ? { 'Content-Type': 'application/json' } : {}, o.headers || {});
  const r = await fetch(base + ruta, { method: o.metodo || 'GET', headers, body: o.cuerpo === undefined ? undefined : typeof o.cuerpo === 'string' ? o.cuerpo : JSON.stringify(o.cuerpo) });
  const texto = await r.text();
  let datos = null;
  try {
    datos = JSON.parse(texto);
  } catch {
    datos = null;
  }
  return { status: r.status, datos, texto, headers: r.headers };
};
/** Solicitud cruda (para Origin, preflight y cuerpos grandes). */
function crudo(base, metodo, ruta, headers, cuerpo) {
  return new Promise((resolver) => {
    const u = new URL(base + ruta);
    const req = request({ host: u.hostname, port: u.port, path: u.pathname + u.search, method: metodo, headers }, (res) => {
      let texto = '';
      res.on('data', (c) => (texto += c));
      res.on('end', () => resolver({ status: res.statusCode, headers: res.headers, texto }));
    });
    req.on('error', (e) => resolver({ status: 0, error: e.code || e.message }));
    if (cuerpo) req.end(cuerpo);
    else req.end();
  });
}
async function esperarFin(pedir, id) {
  for (let i = 0; i < 2000; i++) {
    const r = await pedir('/ejecuciones/' + id);
    if (r.datos && r.datos.estado !== 'en curso') return r.datos;
    await pausa(20);
  }
  throw new Error('La lectura ' + id + ' no terminó.');
}

const abiertos = [];
try {
  /* ═════════════════════════════  ARRANQUE Y TOKEN  ═════════════════════════════ */
  seccion('Arranque, token y CORS');
  let error = null;
  try {
    await crearServidor({ token: 'corto', datos: join(tmp, 'x'), nucleo: N, registro: silencio });
  } catch (e) {
    error = e;
  }
  ok(error && /32 caracteres/.test(error.message) && LARGO_MINIMO_TOKEN >= 32, 'sin un token largo (32 caracteres o más) el servidor no arranca', error && error.message);
  error = null;
  try {
    await crearServidor({ token: TOKEN, datos: join(tmp, 'x'), nucleo: N, contacto: 'no es un correo', registro: silencio });
  } catch (e) {
    error = e;
  }
  ok(error && /contacto/.test(error.message), 'con un correo de contacto inválido tampoco', error && error.message);

  const net = internetNormal();
  let retraso = 0;
  const fetchPrueba = async (u, i) => {
    if (retraso) await pausa(retraso);
    return net.fetch(u, i);
  };
  const A = await crearServidor({ token: TOKEN, datos: join(tmp, 'a'), fetch: fetchPrueba, nucleo: N, opcionesRed: OPCIONES_RED, registro: silencio, revisarCadaMs: 0 });
  abiertos.push(A);
  const { url: baseA } = await A.escuchar(0, '127.0.0.1');
  const pedirA = cliente(baseA);

  const sin = await pedirA('/salud', { sinToken: true });
  ok(sin.status === 401 && /token/.test(sin.datos.error) && sin.headers.get('www-authenticate') === 'Bearer', 'sin token: 401, y nada más', sin.datos);
  const casi = await pedirA('/salud', { token: TOKEN.slice(0, -1) + 'Y' });
  ok(casi.status === 401, 'con un token casi igual: 401 (se compara entero y en tiempo constante)');
  const enUrl = await pedirA('/salud?token=' + encodeURIComponent(TOKEN), { sinToken: true });
  ok(enUrl.status === 401, 'el token en la dirección no sirve: va en el encabezado Authorization');
  const minus = await pedirA('/salud', { sinToken: true, headers: { Authorization: 'bearer ' + TOKEN } });
  ok(minus.status === 200, '«bearer» en minúsculas también vale');

  const pre = await crudo(baseA, 'OPTIONS', '/plan', { Origin: 'http://localhost:9999', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' });
  ok(pre.status === 204 && pre.headers['access-control-allow-origin'] === '*' && /Authorization/.test(pre.headers['access-control-allow-headers']) && /POST/.test(pre.headers['access-control-allow-methods']),
    'CORS: el programa abierto desde otra dirección puede consultarlo (el límite es el token)', pre.headers);
  const D = await crearServidor({ token: TOKEN, datos: join(tmp, 'd'), nucleo: N, origenes: 'https://precios.constructora.example,null', registro: silencio, revisarCadaMs: 0 });
  abiertos.push(D);
  const { url: baseD } = await D.escuchar(0, '127.0.0.1');
  const otraPagina = await crudo(baseD, 'OPTIONS', '/salud', { Origin: 'https://otra.example', 'Access-Control-Request-Method': 'GET' });
  const suPagina = await crudo(baseD, 'GET', '/salud', { Origin: 'https://precios.constructora.example', Authorization: 'Bearer ' + TOKEN });
  const archivo = await crudo(baseD, 'GET', '/salud', { Origin: 'null', Authorization: 'Bearer ' + TOKEN });
  ok(!otraPagina.headers['access-control-allow-origin'] && suPagina.headers['access-control-allow-origin'] === 'https://precios.constructora.example' && suPagina.headers.vary === 'Origin' &&
    archivo.headers['access-control-allow-origin'] === 'null', 'con ARKEN_PRECIOS_ORIGENES solo esas páginas (y «null», el programa abierto como archivo) leen sus respuestas');

  const lp = (t) => {
    try {
      return leerProgramacion(t, N);
    } catch (e) {
      return { error: e.message };
    }
  };
  ok(lp('diaria 06:00').activa && lp('diaria 06:00').frecuencia === 'diaria' && !lp('').activa && !lp('no').activa, 'programación: «diaria 06:00», o vacía');
  ok(lp('semanal lunes 06:30').dia === 1 && lp('semanal 5 06:30').dia === 5 && lp('semanal miércoles 7:05').dia === 3 && lp('semanal miércoles 7:05').hora === '07:05' && lp('mensual 15 23:59').dia === 15,
    'programación: «semanal lunes 06:30» (o con el número del día) y «mensual 15 23:59»');
  ok(lp('cada rato').error && lp('diaria').error && lp('mensual 31 06:00').error && lp('semanal domingo').error, 'una programación que no se entiende no arranca el servidor (no corre a una hora inventada)');

  /* ═════════════════════════════  PLAN  ═════════════════════════════ */
  seccion('Plan del servidor');
  const s0 = await pedirA('/salud');
  ok(s0.status === 200 && s0.datos.version === VERSION && s0.datos.plan === null && s0.datos.ultimoPaquete === null && s0.datos.programacion.activa === false && s0.datos.enCurso === false &&
    s0.headers.get('cache-control') === 'no-store', '/salud: versión, sin plan, sin paquetes y sin programación', s0.datos);
  const sinContacto = await pedirA('/plan', { metodo: 'POST', cuerpo: Object.assign(plan(), { contacto: '' }) });
  ok(sinContacto.status === 400 && /contacto/.test(sinContacto.datos.error), 'un plan sin correo de contacto no se acepta', sinContacto.datos);
  const malo = await pedirA('/plan', { metodo: 'POST', cuerpo: '{"version":' });
  ok(malo.status === 400 && /JSON/.test(malo.datos.error), 'un cuerpo que no es JSON: 400');
  const conDeMas = plan();
  conDeMas.descripcion = 'Plan de prueba ' + CLAVE_FALSA;
  conDeMas.fuentes[0].notas = 'Notas internas de la empresa';
  conDeMas.fuentes[0].token = 'algo-secreto';
  conDeMas.insumos[0].precioReferencia = 123456;
  conDeMas.usuarios = [{ usuario: 'admin', hash: 'x' }];
  const p1 = await pedirA('/plan', { metodo: 'POST', cuerpo: conDeMas });
  const guardado = readFileSync(join(tmp, 'a', 'plan.json'), 'utf8');
  ok(p1.status === 200 && p1.datos.fuentes === 6 && p1.datos.insumos === conDeMas.insumos.length && p1.datos.siguiente === null, 'el plan se guarda: 6 fuentes y sus insumos', p1.datos);
  ok(!/sk-ant-/.test(guardado) && !guardado.includes('Notas internas') && !/"token"/.test(guardado) && !/"precioReferencia":|"usuarios":/.test(guardado) && guardado.includes('[clave retirada]'),
    'del plan solo se guarda lo que usa el motor: sin notas, usuarios, precios ni nada con forma de clave');
  const s1 = await pedirA('/salud');
  ok(s1.datos.plan && s1.datos.plan.fuentes === 6 && s1.datos.plan.recibido, '/salud dice qué plan tiene');

  /* ═════════════════════════════  LECTURA A PEDIDO  ═════════════════════════════ */
  seccion('Lectura a pedido y paquetes');
  const e1 = await pedirA('/ejecutar', { metodo: 'POST', cuerpo: plan() });
  ok(e1.status === 202 && /^[\w-]{4,80}$/.test(e1.datos.id), 'POST /ejecutar responde 202 con el número de la lectura', e1.datos);
  const fin1 = await esperarFin(pedirA, e1.datos.id);
  const tipos = fin1.eventos.map((e) => e.tipo);
  ok(fin1.estado === 'terminada' && fin1.paqueteId && fin1.origen === 'pedida', 'la lectura termina y deja su paquete', fin1);
  ok(tipos[0] === 'inicio' && tipos.includes('fuente') && tipos[tipos.length - 1] === 'fin' && fin1.siguiente === fin1.eventos.length, 'los eventos llegan en orden: inicio, cada fuente y fin', tipos);
  const parcial = await pedirA('/ejecuciones/' + e1.datos.id + '?desde=' + (fin1.siguiente - 1));
  ok(parcial.datos.eventos.length === 1 && parcial.datos.eventos[0].tipo === 'fin', 'con «desde» llegan solo los eventos que faltan');
  ok(net.pedidas.length > 0 && net.pedidas.every((x) => /^ARKEN-PRECIOS\//.test(x.ua) && x.from === CONTACTO), 'el servidor lee con el agente ARKEN-PRECIOS y el correo de contacto del plan');
  const lista1 = await pedirA('/paquetes');
  ok(lista1.datos.paquetes.length === 1 && lista1.datos.paquetes[0].id === fin1.paqueteId, '/paquetes lo lista');
  const paq = (await pedirA('/paquetes/' + fin1.paqueteId)).datos;
  const v = N.Formatos.verificar(paq, R.PAQUETE);
  ok(v.ok && paq.id === fin1.paqueteId && paq.contenido.resultado.hallazgos.length > 0 && !('bitacora' in paq.contenido.resultado) && paq.contenido.servidor.origen === 'pedida' &&
    paq.contenido.servidor.version === VERSION, 'el paquete trae el formato, el hash que verifica el programa y lo que leyó el motor, sin la bitácora', v);
  const textoPaq = JSON.stringify(paq);
  ok(!textoPaq.includes(TOKEN) && !/sk-ant-/.test(textoPaq), 'el paquete no lleva el token ni nada con forma de clave');
  const rep = R.repartir(paq.contenido.resultado, { catalogo: CATALOGO, vinculos: [], ciudades: S.ciudades(), fuentes: FUENTES, hoy: '2026-10-05' });
  ok(rep.observaciones.length > 0, 'el núcleo del programa vuelve a verificar lo que trae: ' + rep.observaciones.length + ' precio(s) entran');
  ok((await pedirA('/paquetes/ultimo')).datos.id === fin1.paqueteId && (await pedirA('/paquetes?desde=' + fin1.paqueteId)).datos.paquetes.length === 0, '/paquetes/ultimo y /paquetes?desde=… para descargar solo lo nuevo');

  retraso = 150;
  const e2 = await pedirA('/ejecutar', { metodo: 'POST', cuerpo: plan() });
  const otra = await pedirA('/ejecutar', { metodo: 'POST', cuerpo: plan() });
  const pruebaOcupado = await pedirA('/probar', { metodo: 'POST', cuerpo: { fuente: FUENTES[0], contacto: CONTACTO } });
  const saludOcupado = await pedirA('/salud');
  ok(otra.status === 409 && /leyendo/.test(otra.datos.error) && pruebaOcupado.status === 409 && saludOcupado.datos.enCurso === true, 'mientras lee, otra lectura o una prueba esperan (409): un sitio nunca se lee dos veces a la vez');
  await pausa(300);
  const can = await pedirA('/ejecuciones/' + e2.datos.id + '/cancelar', { metodo: 'POST' });
  const fin2 = await esperarFin(pedirA, e2.datos.id);
  retraso = 0;
  ok(can.datos.estado === 'cancelando' && fin2.estado === 'cancelada' && !fin2.paqueteId && (await pedirA('/paquetes')).datos.paquetes.length === 1, 'cancelar detiene la lectura y no deja paquete', { can: can.datos, fin2 });
  const libre = await pedirA('/salud');
  ok(!libre.datos.enCurso && libre.datos.ultimaEjecucion.estado === 'cancelada', 'el servidor queda libre y recuerda cómo terminó la última lectura');
  ok((await pedirA('/ejecuciones/no-existe-1')).status === 404, 'una lectura que no existe: 404');

  /* ═════════════════════════════  PRUEBA TÉCNICA  ═════════════════════════════ */
  seccion('Prueba técnica de una ficha');
  const pr = await pedirA('/probar', { metodo: 'POST', cuerpo: { fuente: FUENTES[0], contacto: CONTACTO } });
  ok(pr.status === 200 && pr.datos.prueba.resultado === 'aprobada' && pr.datos.prueba.verificados > 0 && pr.datos.prueba.agente.includes(CONTACTO), 'la prueba técnica de Easy se aprueba con precios verificados', pr.datos);
  const prSin = await pedirA('/probar', { metodo: 'POST', cuerpo: { fuente: FUENTES[0], contacto: 'x' } });
  const prSinFicha = await pedirA('/probar', { metodo: 'POST', cuerpo: { contacto: CONTACTO } });
  ok(prSin.status === 400 && /contacto/.test(prSin.datos.error) && prSinFicha.status === 400, 'sin correo de contacto o sin ficha no prueba nada');

  /* ═════════════════════════════  RUTAS Y TAMAÑOS  ═════════════════════════════ */
  seccion('Rutas, métodos y tamaños');
  ok((await pedirA('/nada')).status === 404 && (await pedirA('/plan')).status === 405 && (await pedirA('/salud', { metodo: 'POST', cuerpo: {} })).status === 405, 'rutas que no existen (404) y métodos que no van (405)');
  ok((await pedirA('/paquetes/..%2F..%2Festado')).status === 404 && (await pedirA('/paquetes/%E0%A4%A')).status === 404 && (await pedirA('/paquetes/no-existe-1')).status === 404,
    'un nombre de paquete raro no sale de la carpeta de paquetes');
  const grande = await crudo(baseA, 'POST', '/probar', { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json', 'Content-Length': 3 * 1024 * 1024 }, 'x'.repeat(3 * 1024 * 1024));
  ok(grande.status === 413, 'un cuerpo demasiado grande: 413', grande);
  ok((await pedirA('/salud')).status === 200, '… y el servidor sigue atendiendo');

  /* ═════════════════════════════  PROGRAMACIÓN  ═════════════════════════════ */
  seccion('Lecturas programadas (hora de Colombia)');
  let ahora = Date.parse('2026-10-05T10:00:00Z'); // 05:00 en Colombia
  const netB = internetNormal();
  const opcionesB = { token: TOKEN, datos: join(tmp, 'b'), fetch: netB.fetch, nucleo: N, opcionesRed: OPCIONES_RED, cache: cacheEnMemoria(0), programacion: 'diaria 06:00', reloj: () => ahora, registro: silencio, revisarCadaMs: 0 };
  const B = await crearServidor(opcionesB);
  abiertos.push(B);
  const { url: baseB } = await B.escuchar(0, '127.0.0.1');
  const pedirB = cliente(baseB);
  const sB = await pedirB('/salud');
  ok(sB.datos.programacion.activa && /Todos los días a las 06:00 \(hora de Colombia\)/.test(sB.datos.programacion.descripcion) && sB.datos.programacion.siguiente === '2026-10-05 06:00',
    '/salud dice el horario y la próxima lectura en hora de Colombia', sB.datos.programacion);
  ok((await B.revisarProgramacion()) === null, 'sin plan no lee');
  const pB = await pedirB('/plan', { metodo: 'POST', cuerpo: plan() });
  ok(pB.datos.siguiente === '2026-10-05 06:00 (hora de Colombia)', 'al recibir el plan dice cuándo es la próxima lectura', pB.datos);
  ok((await B.revisarProgramacion()) === null, 'antes de la hora no lee');
  ahora = Date.parse('2026-10-05T11:01:00Z'); // 06:01
  const ejB1 = await B.revisarProgramacion();
  const finB1 = ejB1 && (await B.esperar(ejB1.id));
  ok(ejB1 && ejB1.origen === 'programada' && finB1.estado === 'terminada' && finB1.paqueteId, 'a las 06:00 lee con el plan guardado y deja su paquete', finB1);
  ok((await B.revisarProgramacion()) === null, 'una sola vez por hora programada');
  netB.estado.easyCaptcha = true;
  ahora = Date.parse('2026-10-07T14:00:00Z'); // 09:00 del 7: el equipo estuvo apagado el 6 y el 7 a las 06:00
  const ejB2 = await B.revisarProgramacion();
  const finB2 = ejB2 && (await B.esperar(ejB2.id));
  ok(finB2 && finB2.estado === 'terminada' && (await B.revisarProgramacion()) === null, 'la que se perdió corre en la primera oportunidad, una sola vez');
  const planB = JSON.parse(readFileSync(join(tmp, 'b', 'plan.json'), 'utf8'));
  const easyB = planB.fuentes.find((f) => f.id === 'easy');
  ok(easyB.salud === 'bloqueada', 'Easy pidió un CAPTCHA: queda bloqueada en el plan del servidor', easyB.salud);
  netB.estado.easyCaptcha = false;
  ahora = Date.parse('2026-10-08T11:05:00Z');
  const ejB3 = await B.revisarProgramacion();
  const finB3 = ejB3 && (await B.esperar(ejB3.id));
  const easyB3 = finB3 && (await pedirB('/paquetes/' + finB3.paqueteId)).datos.contenido.resultado.fuentes.easy;
  ok(easyB3 && easyB3.estado === 'omitida' && /bloqueada/.test(easyB3.motivo), 'la lectura siguiente no vuelve a Easy hasta que una persona la revise en el programa', easyB3);
  const sB2 = (await pedirB('/salud')).datos;
  ok(sB2.ultimaEjecucion.origen === 'programada' && sB2.programacion.siguiente === '2026-10-09 06:00' && sB2.ultimoPaquete.id === finB3.paqueteId, '/salud: la última lectura, el último paquete y la próxima', sB2);

  const activada = B.estado().estado.programacion.activada;
  await B.cerrar();
  const B2 = await crearServidor(opcionesB);
  abiertos.push(B2);
  const e = B2.estado();
  ok(e.plan && e.plan.fuentes === 6 && e.estado.ultimoPaquete.id === finB3.paqueteId && e.estado.programacion.activada === activada && (await B2.revisarProgramacion()) === null,
    'tras reiniciar conserva el plan, el último paquete y la programación (no repite la lectura de hoy)', e);
  const B3 = await crearServidor(Object.assign({}, opcionesB, { programacion: 'semanal lunes 06:00' }));
  abiertos.push(B3);
  ok(B3.estado().estado.programacion.activada !== activada, 'una programación nueva cuenta desde que se puso');

  const Cs = await crearServidor({ token: TOKEN, datos: join(tmp, 'c'), fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED, maximoPaquetes: 3, registro: silencio, revisarCadaMs: 0 });
  abiertos.push(Cs);
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const ej = Cs.iniciarEjecucion(plan({ insumoIds: [CEMENTO] }), 'pedida');
    ids.push((await Cs.esperar(ej.id)).paqueteId);
  }
  const quedan = readdirSync(join(tmp, 'c', 'paquetes')).filter((a) => a.endsWith('.json')).sort();
  ok(MAXIMO_PAQUETES === 30 && quedan.join() === ids.slice(2).map((i) => i + '.json').join(), 'se guardan los últimos paquetes (30; aquí 3) y se borran los más viejos', { quedan, ids });

  /* ═════════════════════════════  LÍNEA DE COMANDOS  ═════════════════════════════ */
  seccion('Arranque por línea de comandos');
  const cli = (env) =>
    spawn(process.execPath, [join(PRECIOS, 'servidor', 'iniciar.mjs')], { env: Object.assign({}, process.env, { ARKEN_PRECIOS_DATOS: join(tmp, 'cli') }, env) });
  const sinToken = cli({ ARKEN_PRECIOS_TOKEN: '' });
  let errSin = '';
  sinToken.stderr.on('data', (d) => (errSin += d));
  const codigoSin = await new Promise((r) => sinToken.on('exit', r));
  ok(codigoSin === 1 && /ARKEN_PRECIOS_TOKEN/.test(errSin), 'sin ARKEN_PRECIOS_TOKEN no arranca y dice cómo generar uno', errSin);
  const proc = cli({ ARKEN_PRECIOS_TOKEN: TOKEN, ARKEN_PRECIOS_PUERTO: '0', ARKEN_PRECIOS_PROGRAMACION: 'semanal lunes 06:00' });
  let salida = '';
  proc.stdout.on('data', (d) => (salida += d));
  proc.stderr.on('data', (d) => (salida += d));
  const arranco = await hasta(() => /en http:\/\/127\.0\.0\.1:\d+/.test(salida), 30000);
  const urlCli = arranco ? salida.match(/en (http:\/\/127\.0\.0\.1:\d+)/)[1] : '';
  const sCli = arranco ? await cliente(urlCli)('/salud') : { status: 0 };
  ok(arranco && sCli.status === 200 && /Cada lunes a las 06:00/.test(sCli.datos.programacion.descripcion) && /Programación: Cada lunes a las 06:00/.test(salida) && !salida.includes(TOKEN),
    'con las variables de entorno arranca en 127.0.0.1, dice su horario y nunca escribe el token', salida);
  proc.kill('SIGTERM');
  const codigo = await new Promise((r) => proc.on('exit', r));
  ok(codigo === 0, 'se cierra en orden con SIGTERM', codigo);

  /* ═════════════════════════════  EL PROGRAMA CON EL SERVIDOR  ═════════════════════════════ */
  seccion('El programa en una página web, con el servidor');
  let ahoraW = Date.parse('2026-10-05T12:00:00Z'); // 07:00 en Colombia
  const netW = internetNormal();
  const W = await crearServidor({ token: TOKEN, datos: join(tmp, 'w'), fetch: netW.fetch, nucleo: N, opcionesRed: OPCIONES_RAPIDAS, programacion: 'diaria 06:00', reloj: () => ahoraW, registro: silencio, revisarCadaMs: 0 });
  abiertos.push(W);
  const { url: baseW } = await W.escuchar(0, '127.0.0.1');
  const srv = await servidorArchivos();
  const nav = await navegador();
  try {
    const ctx = await contexto(nav);
    const p = await ctx.newPage();
    const errores = vigilarErrores(p);
    await abrirPrecios(p, srv.url(RUTA_PRECIOS));
    await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
    const bd = (expr, arg) => p.evaluate(expr, arg);
    const conAviso = async (texto, accion) => {
      await bd(() => {
        const t = document.getElementById('toasts');
        if (t) t.innerHTML = '';
      });
      await accion();
      await p.locator('#toasts .toast', { hasText: texto }).first().waitFor({ timeout: 120000 });
      return p.locator('#toasts .toast', { hasText: texto }).first().textContent();
    };
    const boton = (texto) => p.click(`#modales .overlay:last-child .modal-foot button:text-is("${texto}")`);
    const programacion = async () => {
      await cerrarModales(p);
      await bd(() => {
        Sesion.tabs['02'] = 'programacion';
        App.ir('02');
      });
      await p.waitForSelector('#pgImportar');
    };

    // Configuración › Motor y servidor: el correo de contacto y el servidor, con su token
    await bd(() => {
      Sesion.tabs['10'] = 'motor';
      App.ir('10');
    });
    await p.waitForSelector('#cfMotor');
    await p.fill('#cfMotor #f_contacto', CONTACTO);
    await conAviso('Motor guardado', () => p.click('#cfMotorG'));
    await p.fill('#cfSrv #f_url', baseW);
    await p.fill('#cfSrv #f_token', TOKEN);
    await conAviso('Servidor guardado', () => p.click('#cfSrvG'));
    const web = await bd(async (t) => ({
      donde: Recolector.donde(),
      disponible: Recolector.disponible(),
      idb: JSON.stringify(await BD.todos('secretos')).includes(t),
      config: JSON.stringify(await BD.todos('configuracion')).includes(t),
      html: document.documentElement.outerHTML.includes(t),
      almacen: JSON.stringify(Object.assign({}, localStorage, sessionStorage)).includes(t),
      respaldo: JSON.stringify(await Respaldos.armar()).includes(t),
    }), TOKEN);
    ok(web.donde === 'servidor' && web.disponible, 'en la página web, con el servidor configurado, los conectores corren en el servidor', web);
    ok(!web.idb && !web.config && !web.html && !web.almacen && !web.respaldo, 'el token queda cifrado en este navegador: no aparece en la base, la página, el almacenamiento ni el respaldo (criterio 8)', web);

    await programacion();
    await p.click('#pgProbar');
    await p.waitForSelector('#pgSrvEstado .tag');
    const conexion = await p.textContent('#pgSrvEstado');
    ok(/conectado/.test(conexion) && new RegExp('servidor ' + VERSION.replace(/\./g, '\\.')).test(conexion) && /Todos los días a las 06:00/.test(conexion) && /sin plan/.test(conexion),
      '«Probar la conexión» muestra la versión, el horario y que todavía no tiene plan', conexion);

    // Revisión legal firmada (la firma en pantalla la prueba motor-navegador) y prueba técnica en el servidor
    await bd(async (ids) => {
      for (const id of ids) {
        const f = Datos.fuente(id);
        const rl = Object.assign({}, f.revisionLegal || {}, { fecha: hoyISO(), responsable: 'Persona de prueba', resultado: 'aprobada' });
        const extra = id === 'aldia' ? { configuracion: { conector: 'aldia', lista: { urls: ['https://aldiaferreteria.com/cementos-concretos-y-morteros'] } } } : {};
        await Datos.guardar('fuentes', Object.assign({}, f, { revisionLegal: rl }, extra));
      }
    }, CERTIFICABLES);
    await bd(() => FuentesUI.ficha('easy'));
    await p.waitForSelector('#f3Probar:not([disabled])');
    await p.click('#f3Probar');
    await p.waitForSelector('#modales .modal h3:text-matches("Prueba técnica: ")', { timeout: 120000 });
    const pantalla = await p.textContent('#modales .overlay:last-child .modal');
    const fEasy = await bd(() => Datos.fuente('easy').ultimaPrueba);
    ok(/Prueba técnica: aprobada/.test(pantalla) && fEasy.donde === 'servidor' && fEasy.verificados > 0, 'la prueba técnica de Easy, desde su ficha, la hace el servidor y se aprueba', fEasy);
    await cerrarModales(p);
    const otras = await bd(async (ids) => {
      const out = {};
      for (const id of ids) out[id] = (await Recolector.probar(id)).resultado;
      return out;
    }, CERTIFICABLES.slice(1));
    ok(Object.values(otras).every((x) => x === 'aprobada'), 'las otras cinco también se aprueban en el servidor', otras);
    await bd(async (ids) => {
      for (const id of ids) await Datos.guardar('fuentes', Object.assign({}, Datos.fuente(id), { salud: 'activa' }));
    }, CERTIFICABLES);
    ok((await bd(() => Recolector.fuentesQueLeen().length)) === 6, 'las seis quedan certificadas y activas');

    // Módulo 02: la lectura la hace el servidor; el programa vuelve a verificar y guarda
    await bd(({ insumos, ciudades }) => {
      Sesion.tabs['02'] = 'actualizar';
      App.ir('02', { alcance: 'insumos', insumoIds: insumos, ciudades });
    }, { insumos: [CEMENTO, TUBO], ciudades: ['11001', '13001', '68001'] });
    await p.waitForSelector('#a2Ejecutar');
    await p.click('#a2Ejecutar');
    await p.waitForSelector('#a2Nueva', { timeout: 180000 });
    const res = await p.textContent('#a2Paso');
    const ejW = await bd(() => {
      const ej = Datos.lista('ejecuciones').sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
      return { modo: ej.modo, donde: ej.conectores && ej.conectores.donde, obs: ej.conectores && ej.conectores.observaciones, paquete: ej.conectores && ej.conectores.paquete, importados: Datos.config('paquetesImportados', []) };
    });
    ok(/Resultado por fuente/.test(res) && /el servidor de recolección/.test(res) && ejW.donde === 'servidor' && ejW.obs > 0, 'Actualizar precios: lee el servidor y los precios verificados entran a la base', ejW);
    ok(ejW.paquete && ejW.paquete === W.estado().estado.ultimoPaquete.id && ejW.importados.includes(ejW.paquete), 'el paquete de esa lectura queda como importado: no se vuelve a descargar', ejW);

    // Enviar el plan y una lectura programada en el servidor
    await programacion();
    await p.click('#pgPlan');
    await p.waitForSelector('#modales .modal-foot button:text-is("Enviar el plan")');
    const avisoPlan = await conAviso('El servidor recibió el plan', () => boton('Enviar el plan'));
    const planW = W.estado().plan;
    ok(planW && planW.fuentes === 6 && planW.insumos > 800 && /próxima lectura es 2026-10-06 06:00/.test(avisoPlan), '«Enviar el plan al servidor»: las seis fuentes y el catálogo, y la próxima lectura', { planW, avisoPlan });
    const planDisco = readFileSync(join(tmp, 'w', 'plan.json'), 'utf8');
    ok(!planDisco.includes(TOKEN) && !/"precioPublicado":|"usuarios":|"hash":/.test(planDisco) && !planDisco.includes('Constructora'), 'el plan que llega al servidor no lleva precios, usuarios, datos de la empresa ni el token');
    ahoraW = Date.parse('2026-10-06T11:30:00Z'); // 06:30 del día siguiente
    const ejProg = await W.revisarProgramacion();
    const finProg = ejProg && (await W.esperar(ejProg.id));
    ok(finProg && finProg.estado === 'terminada' && finProg.paqueteId, 'el servidor hace la lectura programada con ese plan', finProg);
    await programacion();
    const avisoDesc = await conAviso('paquete(s) importado(s)', () => p.click('#pgDescargar'));
    const imp = await bd(() => ({
      ultimo: ServidorRecoleccion.cfg().ultimoPaquete,
      importados: Datos.config('paquetesImportados', []),
      deServidor: Datos.lista('ejecuciones').filter((e) => e.modo === 'paquete del servidor').length,
    }));
    ok(/^1 paquete\(s\) importado\(s\)/.test(avisoDesc) && imp.ultimo === finProg.paqueteId && imp.importados.includes(finProg.paqueteId) && imp.deServidor === 1,
      '«Descargar paquetes ahora» trae solo el de la lectura programada', { avisoDesc, imp });
    const otraVez = await conAviso('No había paquetes nuevos', () => p.click('#pgDescargar'));
    ok(/No había paquetes nuevos en el servidor/.test(otraVez), 'y la segunda vez no hay nada nuevo');

    // Un token que no es el del servidor
    await bd(() => ClaveServidor.guardar('otro-token-que-no-es-el-del-servidor'));
    await programacion();
    await p.click('#pgProbar');
    await p.waitForSelector('#pgSrvEstado .tag');
    const rechazo = await p.textContent('#pgSrvEstado');
    ok(/sin conexión/.test(rechazo) && /no aceptó el token/.test(rechazo), 'con otro token el servidor no responde nada y el programa lo dice', rechazo);
    ok(errores.length === 0, 'sin errores de JavaScript', errores.slice(0, 5));
    await ctx.close();
  } finally {
    await nav.close();
    await srv.cerrar();
  }
} catch (e) {
  console.error(e);
  ok(false, 'la prueba terminó sin excepciones: ' + (e && e.message));
} finally {
  for (const s of abiertos) await s.cerrar().catch(() => {});
  rmSync(tmp, { recursive: true, force: true });
}

console.log('\n' + (fallas ? '✖ ' + fallas + ' de ' + pruebas + ' comprobaciones fallaron.' : pruebas + ' de ' + pruebas + ' comprobaciones bien.'));
process.exit(fallas ? 1 : 0);
