// ARKEN PRECIOS · pruebas del motor de recolección (Fase 3, §7.2 y §16).
//
// Sin internet. Dos maneras de simular los sitios:
//   · un servidor HTTP local de verdad, para la red: robots.txt, redirecciones, bloqueos,
//     reintentos, Retry-After, tiempo máximo, tamaño, caché y revalidación, pausas por sitio;
//   · un «internet» en memoria que responde por cada dominio real con páginas guardadas
//     (pruebas/fixtures/motor), para los conectores y el motor completo.
//
//   · robots.txt: reglas, agente propio, «*», Allow/Disallow, $, Crawl-delay, 4xx y 5xx
//   · red: agente identificado con contacto, sin contacto no lee, bloqueos que no se evaden
//   · salud de fuentes: degradada, caída, bloqueada, enfriamiento, exportar e importar
//   · lectores: HTML, Excel (en contexto aislado) y PDF
//   · los seis conectores certificados y los cinco genéricos con páginas guardadas
//   · el motor: certificación antes de leer, verificación literal, emparejamiento de listas,
//     prueba técnica, cancelación, cambios de formato y CAPTCHA
//
// Uso: npm run prueba:motor

import http from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { leerRobots, permitido, segunRespuesta, tokenDe } from '../motor/robots.mjs';
import { crearRed, contactoValido, textoAgente, esperaRetryAfter } from '../motor/red.mjs';
import { crearSalud } from '../motor/salud.mjs';
import { cacheEnMemoria, cacheEnDisco } from '../motor/cache.mjs';
import { leerHtml, valor, textoVisible, todos, productosJsonLd, partirSelector, absoluta } from '../motor/html.mjs';
import { leerExcel, tablaExcel, fechaExcel, leerPdf, tablaPdf, columnaIndice, columnaLetra } from '../motor/tablas.mjs';
import { cargarNucleo } from '../motor/nucleo.mjs';
import { ejecutar, probar, validarPlan } from '../motor/motor.mjs';
import { CERTIFICADOS, GENERICOS, conectorPara } from '../motor/conectores/index.mjs';
import { ventana, aplanar, textoDeHtml, fechaDeTexto } from '../motor/conectores/comun.mjs';
import { limpiarNombre, consultaSoql } from '../motor/conectores/generico-socrata.mjs';
import { enlaceDe } from '../motor/conectores/easy.mjs';
import { mesDeTexto } from '../motor/conectores/icoced.mjs';
import { excelIdu, pdfPrecios, FILAS_IDU, DOMINIOS_ANEXO1 } from './fixtures/motor/fabricar.mjs';
import { leer, CONTACTO, LEGAL, OPCIONES_RED, texto, json, XLSX_TIPO, crearInternet, internetNormal, fichaDePrueba, fuentesDePrueba } from './fixtures/motor/internet.mjs';

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
async function falla(promesa) {
  try {
    await promesa;
    return null;
  } catch (e) {
    return e;
  }
}

const N = cargarNucleo(undefined, { semilla: true });
const C = N.Conectores;
const CATALOGO = N.Semilla.catalogo();

/* ═════════════════════════════  ROBOTS.TXT  ═════════════════════════════ */
seccion('robots.txt (RFC 9309)');
{
  const AG = textoAgente({ contacto: CONTACTO });
  ok(tokenDe(AG) === 'arken-precios', 'el token del agente es «arken-precios»', tokenDe(AG));
  const easy = leerRobots(leer('easy/robots.txt'));
  const p = (r, ruta) => permitido(r, 'https://www.easy.com.co' + ruta, AG).permite;
  ok(p(easy, '/api/catalog_system/pub/products/search?ft=cemento%20gris&_from=0&_to=9'), 'Easy: la API del catálogo se puede leer (la línea «User-agent» con espacio al comienzo se entiende)');
  ok(!p(easy, '/api/catalog_system/pub/products/search?ft=mapei&_from=0&_to=9'), 'Easy: una búsqueda con «map» queda cerrada por «/*?*map*»');
  ok(!p(easy, '/busca/?ft=cemento'), 'Easy: /busca/ cerrada');
  ok(p(easy, '/robots.txt'), '/robots.txt siempre se puede leer');
  const aldia = leerRobots(leer('aldia/robots.txt'));
  const a = (ruta) => permitido(aldia, 'https://aldiaferreteria.com' + ruta, AG).permite;
  ok(a('/cementos-concretos-y-morteros?page=2'), 'Aldia: la paginación ?page= se puede leer');
  ok(!a('/cementos-concretos-y-morteros?order=product.price.asc') && !a('/x?search_query=cemento') && !a('/busqueda'), 'Aldia: ordenar, buscar y la búsqueda quedan cerradas');
  ok(a('/modules/x/estilo.css'), 'Aldia: «Allow: */modules/*.css» abre los estilos');
  const propio = leerRobots('User-agent: *\nDisallow: /\n\nUser-agent: ARKEN-PRECIOS\nDisallow: /privado\nAllow: /privado/publico$\n');
  const q = (ruta) => permitido(propio, 'https://x.example' + ruta, AG).permite;
  ok(q('/catalogo') && !q('/privado/a'), 'un grupo para el agente propio reemplaza al de «*»');
  ok(q('/privado/publico') && !q('/privado/publico/otro'), 'gana la regla más larga y «$» marca el final');
  const empate = leerRobots('User-agent: *\nDisallow: /a\nAllow: /a\n');
  ok(permitido(empate, 'https://x.example/a', AG).permite, 'si un Allow y un Disallow empatan, gana el Allow');
  const dane = leerRobots(leer('dane/robots.txt'));
  ok(!permitido(dane, 'https://www.dane.gov.co/index.php/calendario/', AG).permite && permitido(dane, 'https://www.dane.gov.co/files/operaciones/ICOCED/anex.xlsx', AG).permite, 'DANE: el grupo de Googlebot no aplica; el de «*» sí');
  const tvec = leerRobots(leer('tvec/robots.txt'));
  ok(permitido(tvec, 'https://www.datos.gov.co/resource/3hdv-smhz.json?$q=cemento', AG).demora === 1, 'datos.gov.co: se lee su Crawl-delay de 1 s');
  ok(segunRespuesta(404, '').estado === 'sin reglas' && segunRespuesta(404, '').robots, 'robots.txt con 404: no hay reglas, se puede leer todo');
  ok(segunRespuesta(503, '').estado === 'no disponible' && !segunRespuesta(503, '').robots, 'robots.txt con 503: no se sabe, no se lee nada');
}

/* ═════════════════════════════  RED (servidor local)  ═════════════════════════════ */
seccion('Red: agente, robots.txt, bloqueos, reintentos, caché y pausas (servidor local)');
{
  const visitas = [];
  let robotsActual = 'User-agent: *\nDisallow: /privado\nCrawl-delay: 0\n';
  let robotsStatus = 200;
  let inestable = 0;
  let limite = 0;
  const servidor = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://127.0.0.1');
    visitas.push({ ruta: u.pathname + u.search, ua: req.headers['user-agent'], from: req.headers.from, inm: req.headers['if-none-match'], t: Date.now() });
    const enviar = (status, cuerpo, h = {}) => {
      res.writeHead(status, Object.assign({ 'content-type': 'text/plain; charset=utf-8' }, h));
      res.end(cuerpo);
    };
    switch (u.pathname) {
      case '/robots.txt':
        return enviar(robotsStatus, robotsActual);
      case '/ok':
        if (req.headers['if-none-match'] === '"v1"') return enviar(304, '', { etag: '"v1"' });
        return enviar(200, 'Precio: $ 12.345', { etag: '"v1"', 'content-type': 'text/html; charset=utf-8' });
      case '/eco':
        return enviar(200, JSON.stringify({ ua: req.headers['user-agent'], from: req.headers.from || null }), { 'content-type': 'application/json' });
      case '/privado/x':
        return enviar(200, 'secreto');
      case '/redir-privado':
        return enviar(302, '', { location: '/privado/x' });
      case '/redir-ok':
        return enviar(301, '', { location: '/ok' });
      case '/redir-login':
        return enviar(302, '', { location: '/login?back=/cuenta' });
      case '/prohibido':
        return enviar(403, '<h1>Forbidden</h1>');
      case '/captcha':
        return enviar(403, '<div class="g-recaptcha" data-sitekey="x"></div>');
      case '/sesion':
        return enviar(401, 'Unauthorized');
      case '/no-existe':
        return enviar(404, 'Not found');
      case '/inestable':
        inestable++;
        return inestable === 1 ? enviar(503, 'Ocupado', { 'retry-after': '0' }) : enviar(200, 'bien');
      case '/limite':
        limite++;
        return limite === 1 ? enviar(429, 'Despacio', { 'retry-after': '1' }) : enviar(200, 'bien');
      case '/siempre-500':
        return enviar(500, 'Error');
      case '/lento':
        return setTimeout(() => enviar(200, 'tarde'), 1500);
      case '/grande':
        return enviar(200, 'x'.repeat(300 * 1024));
      case '/turno':
        return setTimeout(() => enviar(200, 'turno'), 120);
      default:
        return enviar(404, 'Not found');
    }
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const BASE = 'http://127.0.0.1:' + servidor.address().port;
  const opciones = { agente: { contacto: CONTACTO }, pausaMinimaMs: 40, tiempoMaximoMs: 500, reintentos: 2, esperaBaseMs: 10, maxBytes: 100 * 1024 };
  const nuevaRed = (o = {}) => crearRed(Object.assign({}, opciones, o));
  const veces = (ruta) => visitas.filter((v) => v.ruta === ruta).length;

  try {
    ok(!contactoValido('') && !contactoValido('sin-arroba') && contactoValido(CONTACTO) && contactoValido('https://arken.example/contacto'), 'el contacto es un correo o una dirección web');
    let e = await falla(crearRed({ agente: { contacto: '' } }).traer(BASE + '/ok'));
    ok(e && e.codigo === 'sin-contacto' && visitas.length === 0, 'sin contacto, el motor no lee nada (ni el robots.txt)', e && e.codigo);

    const red = nuevaRed();
    const eco = await red.traer(BASE + '/eco', { tipo: 'json', cache: false });
    ok(/^ARKEN-PRECIOS\/\d+\.\d+\.\d+ \(\+https:\/\/github\.com\/aboteroproyectos\/arken; contacto: pruebas@arken\.example\)$/.test(eco.json.ua), 'se identifica con nombre, versión, sitio y contacto', eco.json.ua);
    ok(eco.json.from === CONTACTO, 'y con la cabecera From (el correo de contacto)');
    ok(visitas[0].ruta === '/robots.txt', 'lo primero que pide a un sitio es su robots.txt');

    e = await falla(red.traer(BASE + '/privado/x'));
    ok(e && e.codigo === 'robots' && veces('/privado/x') === 0, 'una ruta cerrada por robots.txt no se pide', e && e.codigo);
    e = await falla(red.traer(BASE + '/redir-privado'));
    ok(e && e.codigo === 'robots' && veces('/privado/x') === 0, 'una redirección hacia una ruta cerrada tampoco se sigue', e && e.codigo);
    const r1 = await red.traer(BASE + '/redir-ok', { cache: false });
    ok(r1.status === 200 && /12\.345/.test(r1.texto) && r1.final === BASE + '/ok', 'una redirección permitida se sigue y se dice a dónde llegó', r1.final);
    e = await falla(red.traer(BASE + '/redir-login'));
    ok(e && e.codigo === 'inicio-sesion' && veces('/login?back=/cuenta') === 0, 'una redirección a una página de inicio de sesión detiene la lectura', e && e.codigo);
    e = await falla(red.traer(BASE + '/prohibido'));
    ok(e && e.codigo === 'bloqueado' && veces('/prohibido') === 1, '403: bloqueado, sin reintentar', e && e.codigo);
    e = await falla(red.traer(BASE + '/captcha'));
    ok(e && e.codigo === 'captcha', '403 con un CAPTCHA: se reconoce y no se intenta resolver', e && e.codigo);
    e = await falla(red.traer(BASE + '/sesion'));
    ok(e && e.codigo === 'inicio-sesion', '401: pide sesión; no se entra', e && e.codigo);
    e = await falla(red.traer(BASE + '/no-existe'));
    ok(e && e.codigo === 'no-encontrado' && veces('/no-existe') === 1, '404: no encontrado, sin reintentar', e && e.codigo);

    const r2 = await red.traer(BASE + '/inestable', { cache: false });
    ok(r2.texto === 'bien' && veces('/inestable') === 2 && red.estadisticas().reintentos >= 1, '503 pasajero: se reintenta y se lee');
    const t0 = Date.now();
    const r3 = await red.traer(BASE + '/limite', { cache: false });
    ok(r3.texto === 'bien' && Date.now() - t0 >= 950, '429 con Retry-After: 1 → espera un segundo antes de volver a pedir', Date.now() - t0);
    e = await falla(red.traer(BASE + '/siempre-500', { cache: false }));
    ok(e && e.codigo === 'http' && veces('/siempre-500') === 3, '500 que no se arregla: tres intentos (con espera creciente) y se rinde', [e && e.codigo, veces('/siempre-500')]);
    ok(esperaRetryAfter('120', 0) === 120000 && esperaRetryAfter(new Date(60000).toUTCString(), 0) === 60000 && esperaRetryAfter('x') === null, 'Retry-After en segundos o como fecha');

    const sinReintentos = nuevaRed({ reintentos: 0 });
    e = await falla(sinReintentos.traer(BASE + '/lento', { cache: false }));
    ok(e && e.codigo === 'tiempo', 'tiempo máximo por solicitud', e && e.codigo);
    e = await falla(red.traer(BASE + '/grande', { cache: false }));
    ok(e && e.codigo === 'tamaño', 'tamaño máximo de respuesta', e && e.codigo);
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), 100);
    e = await falla(sinReintentos.traer(BASE + '/lento', { cache: false, senal: ctl.signal, tiempoMaximoMs: 5000 }));
    ok(e && e.codigo === 'cancelado', 'una lectura se puede cancelar', e && e.codigo);

    // Caché y revalidación
    const antes = veces('/ok');
    const c1 = await red.traer(BASE + '/ok');
    const c2 = await red.traer(BASE + '/ok');
    ok(!c1.desdeCache && c2.desdeCache && veces('/ok') === antes + 1, 'la segunda lectura sale de la caché, sin pedir de nuevo');
    const vencida = nuevaRed({ ttlMs: 1 });
    await vencida.traer(BASE + '/ok');
    await new Promise((r) => setTimeout(r, 5));
    const c3 = await vencida.traer(BASE + '/ok');
    const ultima = visitas.filter((v) => v.ruta === '/ok').pop();
    ok(c3.desdeCache && c3.status === 200 && /12\.345/.test(c3.texto) && ultima.inm === '"v1"', 'vencida, se pregunta con If-None-Match y un 304 renueva la copia', ultima);
    const dir = mkdtempSync(join(tmpdir(), 'arken-cache-'));
    try {
      const enDisco = cacheEnDisco(dir);
      await enDisco.guardar('k', { cuerpo: 'abc', expira: 1 });
      const leida = await enDisco.leer('k');
      ok(leida && leida.cuerpo === 'abc', 'la caché en disco guarda y lee');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    const mem = cacheEnMemoria(2);
    await mem.guardar('a', 1);
    await mem.guardar('b', 2);
    await mem.leer('a');
    await mem.guardar('c', 3);
    ok((await mem.leer('b')) === null && (await mem.leer('a')) === 1, 'la caché en memoria suelta primero lo que lleva más tiempo sin usarse');

    // Una solicitud a la vez por sitio, con pausa entre ellas
    const turnos = nuevaRed({ pausaMinimaMs: 80 });
    await turnos.traer(BASE + '/eco', { cache: false });
    const desde = visitas.length;
    await Promise.all([turnos.traer(BASE + '/turno', { cache: false }), turnos.traer(BASE + '/turno?2', { cache: false })]);
    const [v1, v2] = visitas.slice(desde);
    ok(v1 && v2 && v2.t - v1.t >= 120 + 70, 'dos lecturas al mismo sitio van una tras otra, con pausa', v1 && v2 && v2.t - v1.t);
    robotsActual = 'User-agent: *\nCrawl-delay: 1\n';
    const lenta = nuevaRed({ pausaMinimaMs: 10 });
    const d0 = visitas.length;
    await lenta.traer(BASE + '/eco', { cache: false });
    await lenta.traer(BASE + '/eco?b', { cache: false });
    const [, w1, w2] = visitas.slice(d0);
    ok(w1 && w2 && w2.t - w1.t >= 950, 'se respeta el Crawl-delay del sitio', w1 && w2 && w2.t - w1.t);
    ok(lenta.estadisticas().porSitio['127.0.0.1:' + servidor.address().port] === 3, 'la red lleva la cuenta de solicitudes por sitio');

    robotsStatus = 404;
    const r404 = nuevaRed();
    ok((await r404.traer(BASE + '/privado/x', { cache: false })).texto === 'secreto', 'robots.txt con 404: se puede leer todo');
    robotsStatus = 503;
    const r503 = nuevaRed({ reintentos: 0 });
    const antesPriv = veces('/eco');
    e = await falla(r503.traer(BASE + '/eco', { cache: false }));
    ok(e && e.codigo === 'robots-no-disponible' && veces('/eco') === antesPriv, 'robots.txt con 503: no se lee nada del sitio', e && e.codigo);
  } finally {
    servidor.close();
  }
}

/* ═════════════════════════════  SALUD  ═════════════════════════════ */
seccion('Salud de las fuentes (interruptor)');
{
  let t = Date.parse('2026-10-05T12:00:00Z');
  const cambios = [];
  const s = crearSalud({ ahora: () => t, alCambiar: (c) => cambios.push(c) });
  const red = { codigo: 'red', message: 'Sin conexión' };
  s.fallo('x', { codigo: 'no-encontrado', message: '404' }, { nivel: 'elemento' });
  ok(s.estado('x').estado === 'activa' && s.estado('x').errores.length === 1, 'un producto que ya no existe no cuenta para la salud del sitio (pero queda en el registro)');
  s.fallo('x', red);
  ok(s.estado('x').estado === 'activa', 'una falla: sigue activa');
  s.fallo('x', red);
  ok(s.estado('x').estado === 'degradada' && cambios.length === 1, 'dos fallas seguidas: degradada, con aviso');
  s.exito('x');
  ok(s.estado('x').estado === 'activa', 'vuelve a responder: activa');
  for (let i = 0; i < 5; i++) s.fallo('x', red);
  ok(s.estado('x').estado === 'caída' && !s.puedeIntentar('x').ok, 'cinco fallas seguidas: caída, y no se intenta');
  t += 6 * 3600 * 1000 + 1;
  ok(s.puedeIntentar('x').ok && s.puedeIntentar('x').prueba, 'pasado el enfriamiento, un intento de prueba');
  s.fallo('y', { codigo: 'captcha', message: 'CAPTCHA' });
  ok(s.estado('y').estado === 'bloqueada' && !s.puedeIntentar('y').ok, 'un CAPTCHA bloquea la fuente hasta que una persona la revise');
  s.fallo('z', { codigo: 'formato', message: 'cambió' });
  ok(s.estado('z').estado === 'bloqueada', 'un cambio de formato también');
  s.reanudar('y', 'Revisada');
  ok(s.estado('y').estado === 'activa', 'una persona la reanuda');
  s.suspender('w');
  ok(!s.puedeIntentar('w').ok, 'una fuente suspendida no se lee');
  const s2 = crearSalud();
  s2.importar(s.exportar());
  ok(s2.estado('z').estado === 'bloqueada' && s2.estado('x').errores.length > 0, 'el estado se exporta y se importa (vive en la ficha)');
}

/* ═════════════════════════════  LECTORES  ═════════════════════════════ */
seccion('Lectores: HTML, Excel y PDF');
{
  const doc = leerHtml('<html><head><title>T</title><script>var p="$ 9.999";</script></head><body><div class="p" data-id="7"><a class="n" href="/x#y">Nombre</a><span class="precio">$ 1.234</span><span hidden>$ 5.555</span><span style="display:none">$ 6.666</span><img alt="foto"></div></body></html>');
  const p = todos(doc, '.p')[0];
  ok(valor(p, '.n') === 'Nombre' && valor(p, '.n@href') === '/x#y' && valor(p, '@data-id') === '7', 'selectores CSS, «css@atributo» y «@atributo»');
  ok(absoluta('/x#y', 'https://t.example/a') === 'https://t.example/x' && absoluta('javascript:alert(1)', 'https://t.example') === '', 'enlaces absolutos, sin #, solo http(s)');
  const visible = textoVisible(doc);
  ok(/\$ 1\.234/.test(visible) && !/9\.999|5\.555|6\.666/.test(visible), 'el texto visible no incluye scripts ni lo oculto (lo que la persona no ve no es evidencia)', visible);
  ok(partirSelector('a[href^="mailto:a@b"]').atributo === null, 'un «@» dentro de corchetes es parte del CSS');
  ok(productosJsonLd(leerHtml(leer('aldia/producto.html'))).length === 1, 'JSON-LD de producto');

  const libro = leerExcel(excelIdu(), { hojas: ['Inusmos'] });
  ok(libro.hojas.length === 1 && libro.nombres.length === 4, 'Excel: se lee solo la hoja pedida (las demás ni se procesan)');
  const tabla = tablaExcel(libro.hojas[0], { columnas: { codigo: 'Código', titulo: 'Nombre', unidad: 'UM', precio: 'Precio' } });
  ok(tabla.ok && tabla.encabezado === 11 && tabla.filas.length === FILAS_IDU.length, 'Excel: encuentra la fila de encabezados y las filas de datos', tabla.motivo);
  ok(/Precio: \$ 611,111/.test(tabla.filas[0].texto), 'Excel: el texto de cada celda es el que se ve (con su formato)', tabla.filas[0].texto);
  ok(fechaExcel(46300) === '2026-10-05' && fechaExcel(45658) === '2025-01-01' && columnaIndice('AB') === 27 && columnaLetra(27) === 'AB', 'fechas de Excel y letras de columnas', fechaExcel(46300));
  let e = null;
  try {
    leerExcel(new TextEncoder().encode('esto no es un excel'.repeat(10)));
  } catch (x) {
    e = x;
  }
  ok(!e || /Excel/.test(e.message), 'un archivo dañado no rompe el motor (falla con un mensaje)');
  ok(Object.getPrototypeOf({}).hasOwnProperty('__proto__') === Object.prototype.hasOwnProperty('__proto__') && !({}).contaminado, 'el contexto de la librería de Excel no toca los prototipos del motor');

  const pdf = await leerPdf(pdfPrecios());
  const tp = tablaPdf(pdf, { columnas: { codigo: 'Código', titulo: 'Descripción', unidad: 'Unidad', precio: 'Valor' } });
  ok(tp.ok && tp.filas.length === 3 && tp.filas[0].valores.precio === '$ 33.333', 'PDF: tabla por la posición de los encabezados', tp);
}

/* ═════════════════════════════  NÚCLEO DE CONECTORES  ═════════════════════════════ */
seccion('Certificación y conectores (núcleo del programa)');
const ficha = (id, metodo, configuracion, extra) => fichaDePrueba(C, id, metodo, configuracion, extra);
{
  for (const [id, x] of Object.entries(CERTIFICADOS)) {
    const k = C.CERTIFICADOS[id];
    ok(k && k.metodo === x.metodo && k.modo === x.modo, 'el conector «' + id + '» del motor y el del programa leen igual (' + x.metodo + ', ' + x.modo + ')', [k, x.metodo, x.modo]);
  }
  ok(Object.keys(C.CERTIFICADOS).every((k) => CERTIFICADOS[k]), 'todo conector que el programa ofrece existe en el motor');
  const f = ficha('easy', 'api-json', { conector: 'easy' });
  ok(C.certificacion(f).estado === 'certificada' && C.certificacion(f).puedeLeer, 'con revisión legal, configuración y prueba técnica: certificada y lee');
  const cambiada = Object.assign({}, f, { configuracion: { conector: 'easy', ciudad: 'Cali' } });
  ok(C.certificacion(cambiada).estado === 'por certificar' && /cambió/.test(C.certificacion(cambiada).falta.join(' ')), 'si la configuración cambia después de la prueba, hay que volver a probar');
  const sinLegal = Object.assign({}, f, { revisionLegal: Object.assign({}, LEGAL, { responsable: '' }) });
  ok(!C.certificacion(sinLegal).puedeLeer && !C.puedeProbar(sinLegal).ok, 'sin responsable de la revisión legal no se lee ni se prueba');
  const rechazada = Object.assign({}, f, { revisionLegal: Object.assign({}, LEGAL, { resultado: 'rechazada' }) });
  ok(C.certificacion(rechazada).estado === 'solo a mano', 'una revisión legal rechazada deja la fuente solo a mano');
  ok(!C.validarConfiguracion({ metodo: 'html', configuracion: { modo: 'lista', lista: { urls: ['javascript:alert(1)'] }, tarjeta: '.p', campos: { titulo: '.t', precio: '.p' } } }).ok, 'una configuración con una dirección que no es http(s) no es válida');
  ok(!C.validarConfiguracion({ metodo: 'api-json', configuracion: { conector: 'easy' } }).ok === false, 'un conector certificado se valida por su nombre');
  ok(!C.validarConfiguracion({ metodo: 'html', configuracion: { conector: 'easy' } }).ok, 'un conector certificado con otro método no es válido');
  ok(C.plantilla('https://x/?q={consulta}&n={n|crudo}', { consulta: 'tubo 1/2" & codo', n: '10' }) === 'https://x/?q=tubo%201%2F2%22%20%26%20codo&n=10', 'plantillas: los valores van codificados');
  ok(C.consulta({ descripcion: 'Cemento gris tipo UG (bulto 50 kg)' }) === 'Cemento gris UG', 'texto de búsqueda de un insumo');
  ok(C.dominioCanonico('Valle del Aburra*', N.Semilla.DOMINIOS_ICOCED) === 'Valle de Aburrá' && C.dominioCanonico('Bogotá_Cundinamarca AR*', N.Semilla.DOMINIOS_ICOCED) === 'Bogotá-Cundinamarca' && C.dominioCanonico('Total', []) === 'Total nacional', 'nombres de los dominios del ICOCED');
  ok(ventana('uno dos tres $ 1.234 cuatro cinco', '$ 1.234', 6, 8) === 'tres $ 1.234 cuatro', 'el literal de una tarjeta se corta en espacios, sin partir palabras', ventana('uno dos tres $ 1.234 cuatro cinco', '$ 1.234', 6, 8));
  ok(ventana('uno dos tres $ 1.234 cuatro cinco', '$ 1.234', 6, 6) === 'tres $ 1.234', 'una palabra que no cabe entera queda por fuera');
  ok(textoDeHtml('<span>&#036;&nbsp;37.777,00</span>') === '$ 37.777,00', 'texto visible de un precio en HTML');
  ok(fechaDeTexto('Actualizado el 30 de septiembre de 2026') === '2026-09-30' && fechaDeTexto('Fecha de publicación: 4/09/2026') === '2026-09-04', 'fechas escritas en texto');
  ok(mesDeTexto('Agosto de 2026') === '2026-08', 'mes de un anexo');
  ok(limpiarNombre('mcf01 - Z4-CyF_CCE339. Cemento Gris 50Kl - (De Uso General)', '^\\s*(?:(?:mcf|gsf)[- ]?\\d{2}\\b\\s*-?\\s*)?(?:[a-z0-9]+-[a-z]+_[a-z0-9]+\\.\\s*)?') === 'Cemento Gris 50Kl - (De Uso General)', 'TVEC: el nombre sin códigos internos');
  ok(limpiarNombre('mcf01 - Bulto de cemento gris x 50 kg. Bulto de cemento gris x 50 kg - UND', '^mcf01 - ') === 'Bulto de cemento gris x 50 kg', 'TVEC: el nombre repetido se dice una vez');
  ok(consultaSoql('www.datos.gov.co', '3hdv-smhz', { $q: 'cemento gris', $limit: 5 }) === 'https://www.datos.gov.co/resource/3hdv-smhz.json?$q=cemento%20gris&$limit=5', 'consulta SoQL');
  ok(enlaceDe('https://www.easy.com.co/cemento-gris-x-50-kg/p') === 'cemento-gris-x-50-kg' && enlaceDe('https://otra.com/x/p') === null, 'Easy: el enlace del producto en la API');
  ok(/^ruta: /.test(aplanar({ ruta: 1 })), 'un objeto JSON como texto');
}

/* ═════════════════════════════  INTERNET SIMULADO  ═════════════════════════════ */
const FUENTES = () => fuentesDePrueba(C);
const CEMENTO = CATALOGO.find((i) => i.id === 'G02-0001');
const TUBO = CATALOGO.find((i) => i.id === 'G13-0003');
// robots.txt distingue mayúsculas (RFC 9309, §2.2.2): «/*?*map*» cierra «ft=mapei» pero no «ft=Mapei»
const MAPEI = { id: 'prueba-mapei', descripcion: 'mapei pegante cerámico', unidad: 'BTO' };

seccion('Prueba técnica de cada conector certificado (páginas guardadas)');
{
  const net = internetNormal();
  for (const f of FUENTES()) {
    const plan = { contacto: CONTACTO, insumos: [CEMENTO], busquedas: { tvec: [{ insumoId: CEMENTO.id }] } };
    const p = await probar(f, { plan, fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED });
    const leidos = p.modo === 'indices' ? p.indices : p.verificados;
    ok(p.resultado === 'aprobada' && leidos > 0 && p.huella === C.huella(f), 'prueba técnica de «' + f.id + '»: aprobada (' + leidos + (p.modo === 'indices' ? ' índices' : ' precios verificados') + ', ' + p.solicitudes + ' solicitudes)', p);
  }
  const hosts = new Set(net.pedidas.map((x) => x.host));
  ok(
    Array.from(hosts).every((h) => net.pedidas.find((x) => x.host === h).ruta === '/robots.txt'),
    'en cada sitio, lo primero que se pidió fue su robots.txt',
  );
  ok(net.pedidas.every((x) => /^ARKEN-PRECIOS\//.test(x.ua) && x.from === CONTACTO), 'todas las solicitudes van identificadas');
  ok(!net.pedidas.some((x) => x.host === 'aldiaferreteria.com' && /search_query|busqueda|order=|[?&]n=/.test(x.ruta)), 'en Aldia no se buscó, ni se ordenó, ni se cambió el número de productos (su robots.txt no lo permite)');
  const sinLegal = Object.assign(FUENTES()[0], { revisionLegal: Object.assign({}, LEGAL, { resultado: 'por certificar' }) });
  const p = await probar(sinLegal, { contacto: CONTACTO, fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED });
  ok(p.resultado === 'rechazada' && /revisión legal/.test(p.motivo), 'sin la revisión legal aprobada no se prueba (ni se pide nada)', p.motivo);
}

seccion('Motor completo: actualizar con las seis fuentes');
{
  const net = internetNormal();
  const vinculo = { id: 'v1', insumoId: CEMENTO.id, fuenteId: 'easy', url: 'https://www.easy.com.co/cemento-gris-uso-general-ug-50-kg-prueba/p', claveUrl: N.claveUrl('https://www.easy.com.co/cemento-gris-uso-general-ug-50-kg-prueba/p'), clave: 'easy:9000001', estado: 'confirmado' };
  const eventos = [];
  const plan = {
    version: 1,
    ejecucionId: 'e-prueba',
    modo: 'actualizar',
    contacto: CONTACTO,
    hoy: '2026-10-05',
    fuentes: FUENTES(),
    insumos: CATALOGO,
    vinculos: [vinculo],
    busquedas: {
      easy: [{ insumoId: CEMENTO.id }, { insumoId: MAPEI.id }],
      casitaroja: [{ insumoId: CEMENTO.id }, { insumoId: TUBO.id }],
      tvec: [{ insumoId: CEMENTO.id }],
    },
  };
  plan.insumos = CATALOGO.concat([MAPEI]);
  const r = await ejecutar(plan, { fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED, alEvento: (e) => eventos.push(e) });
  const F = r.fuentes;
  const de = (id) => r.hallazgos.filter((h) => h.fuenteId === id);
  ok(Object.values(F).every((x) => x.estado === 'leída' || x.estado === 'con fallas'), 'las seis fuentes se leyeron', Object.fromEntries(Object.entries(F).map(([k, v]) => [k, v.estado + ' ' + v.motivo])));
  ok(r.hallazgos.every((x) => x.verificacion.estado === 'verificado'), 'todo hallazgo que sale del motor está verificado');
  const reverificados = r.hallazgos.filter((x) => C.verificar(x.h, x.pagina).estado === 'verificado').length;
  ok(reverificados === r.hallazgos.length, 'y el programa lo puede volver a verificar con lo que viaja (el literal está en la evidencia)', [reverificados, r.hallazgos.length]);
  ok(r.hallazgos.every((x) => N.LectorPrecios.estaEnTexto(x.h.precio, x.h.textoLiteral)), 'el precio de cada hallazgo está escrito en su texto literal (criterio 9)');

  const easy = de('easy');
  const delVinculo = easy.find((x) => x.vinculoId === 'v1');
  ok(delVinculo && delVinculo.h.precio === 32222 && /Promoción/.test(delVinculo.h.condiciones) && delVinculo.insumoId === CEMENTO.id, 'Easy: el producto vinculado se vuelve a leer (precio y promoción)', delVinculo && delVinculo.h);
  ok(easy.some((x) => x.clave === 'easy:9000002' && x.h.precio === 55555 && x.h.incluyeIva === true && x.h.ciudad === '' && /Promoción/.test(x.h.condiciones)), 'Easy: la búsqueda trae los productos con IVA incluido, alcance nacional y su promoción', easy.map((x) => [x.clave, x.h.precio]));
  ok(easy.filter((x) => x.clave === 'easy:9000001' && x.insumoId === CEMENTO.id).length === 1, 'Easy: el mismo producto para el mismo insumo viaja una vez (primero el vínculo)');
  ok(!easy.some((x) => /sin precio/i.test(x.h.titulo)), 'Easy: un producto sin precio no es un hallazgo');
  ok(easy.some((x) => /Disponibilidad: agotado/.test(x.h.condiciones)), 'Easy: la disponibilidad viaja en las condiciones');
  ok(!net.pedidas.some((x) => /mapei/i.test(x.ruta)) && F.easy.errores.some((x) => x.codigo === 'robots'), 'Easy: la búsqueda de «mapei» no se hizo (su robots.txt cierra «map») y quedó en el registro', F.easy.errores);
  const casita = de('casitaroja');
  ok(casita.some((x) => x.h.precio === 34444 && /Promoción/.test(x.h.condiciones) && x.h.ciudad === 'Cartagena'), 'La Casita Roja: precio en centavos → pesos, promoción y ciudad', casita.map((x) => x.h));
  ok(!casita.some((x) => /varios colores/i.test(x.h.titulo)), 'La Casita Roja: un producto con rango de precios no se toma');
  const aldia = de('aldia');
  const claves = aldia.map((x) => x.clave);
  ok(aldia.length >= 2 && new Set(claves).size === claves.length && F.aldia.paginas === 2, 'Aldia: dos páginas de la categoría, sin repetir el producto que sale en las dos', [claves, F.aldia.paginas]);
  ok(F.aldia.sinPareja >= 1 && !aldia.some((x) => /boquillas/i.test(x.h.titulo)), 'Aldia: lo que no se parece a ningún insumo del catálogo no viaja');
  ok(aldia.every((x) => x.lista && x.emparejamiento && x.emparejamiento.puntaje >= 0.5 && x.h.ciudad === 'Bucaramanga'), 'Aldia: cada fila viaja con el insumo más parecido del catálogo');
  ok(aldia.some((x) => x.insumoId === TUBO.id && /agotado/.test(x.h.condiciones)), 'Aldia: el tubo sanitario de 4" se empareja con su insumo', aldia.map((x) => [x.h.titulo, x.insumoId]));
  ok(F.aldia.errores.some((x) => x.codigo === 'no-encontrado' && x.nivel === 'elemento'), 'Aldia: una categoría que ya no existe queda en el registro sin detener la fuente');
  const idu = de('idu');
  ok(idu.length >= 2 && idu.every((x) => x.tipoPrecio === 'oficial' && x.h.ciudad === 'Bogotá' && x.h.fechaVisible === '2026-09-28' && /^idu:\d+$/.test(x.clave)), 'IDU: filas del Excel con precio oficial, Bogotá, la fecha del último ajuste y su código', idu.map((x) => [x.h.titulo, x.h.fechaVisible, x.clave]));
  // Dos insumos del catálogo dicen «concreto … 3000 psi»: el motor propone el más parecido y deja el
  // segundo a la vista; el programa decide (si se parecen igual, va a la bandeja «Por revisar»)
  const concreto = idu.find((x) => /CONCRETO/.test(x.h.titulo));
  const desc = (id) => (CATALOGO.find((i) => i.id === id) || {}).descripcion || '';
  ok(concreto && /3000 psi/.test(desc(concreto.insumoId)) && concreto.emparejamiento.segundo && /3000 psi/.test(desc(concreto.emparejamiento.segundo.insumoId)), 'IDU: el concreto de 3000 psi se empareja con un concreto de 3000 psi, con el segundo candidato a la vista', concreto && concreto.emparejamiento);
  ok(idu.some((x) => x.insumoId === 'G07-0001') && idu.some((x) => x.insumoId === 'G01-0001'), 'IDU: el ladrillo tolete y la arena de río se emparejan con sus insumos', idu.map((x) => [x.h.titulo, x.insumoId]));
  ok(!idu.some((x) => /COMPACTADOR/.test(x.h.titulo)) && F.idu.sinPareja >= 1, 'IDU: lo que el catálogo no tiene no viaja');
  const tvec = de('tvec');
  ok(tvec.length >= 1 && tvec.every((x) => x.tipoPrecio === 'contrato' && /CC BY-SA 4\.0/.test(x.h.condiciones)), 'TVEC: precios de contrato, con la atribución de la licencia', tvec.map((x) => x.h));
  const t1 = tvec.find((x) => /900001/.test(x.clave) && /^Cemento Gris/i.test(x.h.titulo));
  ok(t1 && t1.h.precio === 29999.92 && /medellin/i.test(t1.h.ciudad) && t1.h.proveedor === 'PROVEEDOR DE PRUEBA S.A.S' && t1.h.fechaVisible === '2026-07-28', 'TVEC: precio redondeado, ciudad y proveedor de la orden', t1 && t1.h);
  ok(tvec.filter((x) => /900001/.test(x.clave) && /^Cemento Gris/i.test(x.h.titulo)).length === 1, 'TVEC: el mismo renglón repetido en una orden cuenta una vez');
  const t2 = tvec.find((x) => /900002/.test(x.clave));
  ok(t2 && /bucaramanga/i.test(t2.h.ciudad) && t2.h.proveedor === 'TVEC', 'TVEC: «No Definido» no se toma como proveedor (queda el nombre de la fuente)', t2 && t2.h);
  ok(r.indices.length > 0 && F.dane.indices === r.indices.length, 'ICOCED: índices leídos', F.dane);
  const ago = r.indices.filter((x) => x.mes === '2026-08');
  ok(ago.some((x) => x.dominio === 'Total nacional' && x.grupo === 'Total') && ago.some((x) => x.dominio === 'Valle de Aburrá' && x.grupo === 'Materiales' && x.peso === 49.34), 'ICOCED: total y dominios (Anexo 1) y grupos con su peso (Anexo 6.7)', ago.slice(0, 4));
  ok(r.indices.every((x) => x.cita === C.CITA_DANE && x.url && x.id === C.idIndice(x)), 'ICOCED: cada índice lleva la cita del DANE y su dirección');
  ok(F.dane.avisos.some((x) => /Dominio Inventado/.test(x)), 'ICOCED: un dominio que el programa no conoce se avisa y no se inventa');
  const deVenta = r.indices.find((x) => x.dominio === 'Valle de Aburrá' && x.grupo === 'Total' && x.mes === '2026-08');
  ok(deVenta && Math.abs(deVenta.indice - (110 + 2 + 19 * 0.5)) < 1e-9, 'ICOCED: el valor del índice es el de la celda', deVenta);
  ok(eventos[0].tipo === 'inicio' && eventos[eventos.length - 1].tipo === 'fin' && eventos.some((e) => e.tipo === 'progreso'), 'el motor avisa el inicio, el progreso y el fin');
  ok(r.salud.length === 6 && r.salud.every((s) => s.estado === 'activa'), 'la salud de cada fuente vuelve con el resultado');
  ok(r.estadisticas.solicitudes > 0 && r.agente.includes(CONTACTO), 'el resultado dice cuántas solicitudes se hicieron y con qué agente');
}

seccion('Motor: lo que no se lee, bloqueos y cambios de formato');
{
  const net = internetNormal();
  const sinCertificar = Object.assign(FUENTES()[0], { ultimaPrueba: null });
  const manual = { id: 'manual', nombre: 'Manual', metodo: 'manual', salud: 'activa' };
  const suspendida = Object.assign(FUENTES()[1], { salud: 'suspendida' });
  const r = await ejecutar({ contacto: CONTACTO, fuentes: [sinCertificar, manual, suspendida], insumos: CATALOGO, busquedas: { easy: [{ insumoId: CEMENTO.id }] } }, { fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED });
  ok(r.fuentes.easy.estado === 'omitida' && /prueba técnica/.test(r.fuentes.easy.motivo), 'una fuente sin prueba técnica no se lee', r.fuentes.easy.motivo);
  ok(r.fuentes.manual.estado === 'omitida' && r.fuentes.casitaroja.estado === 'omitida', 'ni una fuente manual ni una suspendida');
  ok(net.pedidas.length === 0, 'y no se pidió nada a ningún sitio');

  net.estado.easyCaptcha = true;
  const r2 = await ejecutar({ contacto: CONTACTO, fuentes: [FUENTES()[0]], insumos: CATALOGO, busquedas: { easy: [{ insumoId: CEMENTO.id }, { insumoId: TUBO.id }] } }, { fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED });
  ok(r2.fuentes.easy.estado === 'bloqueada' && r2.salud[0].estado === 'bloqueada', 'un CAPTCHA bloquea la fuente; no se intenta resolver', r2.fuentes.easy);
  ok(net.pedidas.filter((x) => x.host === 'www.easy.com.co' && x.ruta !== '/robots.txt').length === 1, 'y no se hizo ninguna otra solicitud después del CAPTCHA');
  const r3 = await ejecutar({ contacto: CONTACTO, fuentes: [Object.assign(FUENTES()[0], { salud: 'bloqueada' })], insumos: CATALOGO, busquedas: { easy: [{ insumoId: CEMENTO.id }] } }, { fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED });
  ok(r3.fuentes.easy.estado === 'omitida', 'una fuente bloqueada no se vuelve a leer hasta que una persona la revise');

  net.estado.aldiaSinTarjetas = true;
  const al = FUENTES()[2];
  al.configuracion = Object.assign({}, al.configuracion, { lista: { urls: ['https://aldiaferreteria.com/cementos-concretos-y-morteros'] } });
  al.ultimaPrueba.huella = C.huella(al);
  const r4 = await ejecutar({ contacto: CONTACTO, fuentes: [al], insumos: CATALOGO }, { fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED });
  ok(r4.fuentes.aldia.estado === 'bloqueada' && r4.fuentes.aldia.errores.some((x) => x.codigo === 'formato'), 'si el sitio cambia de forma, la fuente queda bloqueada por «formato» y se avisa', r4.fuentes.aldia);

  const ctl = new AbortController();
  ctl.abort();
  const r5 = await ejecutar({ contacto: CONTACTO, fuentes: FUENTES(), insumos: CATALOGO }, { fetch: internetNormal().fetch, nucleo: N, opcionesRed: OPCIONES_RED, senal: ctl.signal });
  ok(r5.cancelado && Object.values(r5.fuentes).every((x) => x.estado === 'cancelada'), 'una ejecución cancelada no lee nada más');
  let e = null;
  try {
    validarPlan({ contacto: '', fuentes: [] });
  } catch (x) {
    e = x;
  }
  ok(e && e.codigo === 'sin-contacto', 'un plan sin contacto no se ejecuta');
}

seccion('Conectores genéricos configurados en la ficha');
{
  const net = crearInternet();
  const tiendaHtml = `<!doctype html><html><body>
    <div class="item" data-sku="A1"><h2 class="nombre"><a href="/p/cemento">Cemento gris uso general 50 kg Prueba</a></h2><p class="valor">Ahora $ 31.111</p><p class="antes">$ 35.555</p></div>
    <div class="item" data-sku="A2"><h2 class="nombre"><a href="/p/tubo">Tubo PVC sanitario 4 pulgadas Prueba</a></h2><p class="valor">$ 77.777</p></div>
    <div class="item" data-sku="A3"><h2 class="nombre"><a href="/p/nada">Sin precio Prueba</a></h2><p class="valor">Consultar</p></div>
  </body></html>`;
  net.sitios.set('tienda.example', (u) => {
    if (u.pathname === '/robots.txt') return texto('User-agent: *\nDisallow: /carrito\n', 'text/plain');
    if (u.pathname === '/buscar') return texto(tiendaHtml);
    if (u.pathname === '/api/productos') return json(JSON.stringify({ datos: { productos: [{ nombre: 'Cemento gris 50 kg Prueba', valor: 3222200, valorTexto: '$ 32.222', url: '/p/cemento', id: 9 }, { nombre: 'Sin nada' }] } }));
    if (u.pathname === '/lista.xlsx') return { status: 200, body: excelIdu({ hoja: 'Precios' }), headers: { 'content-type': XLSX_TIPO } };
    if (u.pathname === '/lista.pdf') return { status: 200, body: pdfPrecios(), headers: { 'content-type': 'application/pdf' } };
    return null;
  });
  const base = { urlBase: 'https://tienda.example' };
  const html = ficha('tienda-html', 'html', { modo: 'busqueda', busqueda: { plantilla: 'https://tienda.example/buscar?q={consulta}' }, tarjeta: '.item', campos: { titulo: '.nombre', enlace: '.nombre a@href', precio: '.valor', precioAnterior: '.antes', id: '@data-sku' }, incluyeIva: true, ciudad: 'Medellín' }, base);
  const api = ficha('tienda-api', 'api-json', { modo: 'busqueda', busqueda: { plantilla: 'https://tienda.example/api/productos?q={consulta}' }, elementos: 'datos.productos', campos: { titulo: 'nombre', precio: 'valor', divisor: 100, precioTexto: 'valorTexto', enlace: 'url', id: 'id' } }, base);
  const excel = ficha('tienda-excel', 'excel', { archivo: { url: 'https://tienda.example/lista.xlsx' }, hoja: 'Precios', columnas: { codigo: 'Código', titulo: 'Nombre', unidad: 'UM', precio: 'Precio' }, fecha: { celdas: ['G7'] } }, base);
  const pdf = ficha('tienda-pdf', 'pdf', { archivo: { url: 'https://tienda.example/lista.pdf' }, columnas: { codigo: 'Código', titulo: 'Descripción', unidad: 'Unidad', precio: 'Valor' }, fecha: { patron: 'vigente desde el ([0-9/]+)' } }, base);
  for (const f of [html, api, excel, pdf]) ok(C.validarConfiguracion(f).ok && conectorPara(f) === GENERICOS[f.metodo], 'ficha válida para el conector genérico «' + f.metodo + '»', C.validarConfiguracion(f).errores);
  const r = await ejecutar(
    { contacto: CONTACTO, fuentes: [html, api, excel, pdf], insumos: CATALOGO, busquedas: { 'tienda-html': [{ insumoId: CEMENTO.id }], 'tienda-api': [{ insumoId: CEMENTO.id }] } },
    { fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RED },
  );
  const de = (id) => r.hallazgos.filter((h) => h.fuenteId === id);
  const h1 = de('tienda-html').find((x) => /Cemento/.test(x.h.titulo));
  ok(h1 && h1.h.precio === 31111 && /Promoción/.test(h1.h.condiciones) && h1.h.url === 'https://tienda.example/p/cemento' && h1.clave === 'tienda-html:A1' && h1.h.ciudad === 'Medellín', 'HTML: tarjeta, enlace, precio vigente, promoción y ciudad de la ficha', h1 && h1.h);
  ok(!de('tienda-html').some((x) => /Sin precio/.test(x.h.titulo)), 'HTML: una tarjeta sin precio legible no es un hallazgo');
  const h2 = de('tienda-api')[0];
  ok(h2 && h2.h.precio === 32222 && h2.h.url === 'https://tienda.example/p/cemento', 'API JSON: precio en centavos con su texto visible, y enlace absoluto', h2 && h2.h);
  ok(de('tienda-excel').length >= 2 && de('tienda-excel').every((x) => x.h.fechaVisible === '2026-09-04'), 'Excel: filas emparejadas y la fecha de la celda de la ficha', de('tienda-excel').map((x) => x.h.fechaVisible));
  const pdfs = r.fuentes['tienda-pdf'];
  ok(pdfs.verificados === 2 && de('tienda-pdf').some((x) => x.h.precio === 33333 && x.h.fechaVisible === '2026-10-01'), 'PDF: líneas con precio (la que dice «A convenir» no) y la fecha del texto', [pdfs, de('tienda-pdf').map((x) => x.h)]);
}

console.log('\n' + (fallas ? '✖ ' + fallas + ' de ' + pruebas + ' comprobaciones fallaron.' : pruebas + ' de ' + pruebas + ' comprobaciones bien.'));
process.exit(fallas ? 1 : 0);
