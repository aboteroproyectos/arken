// ARKEN PRECIOS · el Investigador IA de punta a punta en Chromium (Fase 2, §7.3 y §12).
//
// La API de Claude se simula: el navegador habla con el SDK oficial incrustado en el
// programa, y las solicitudes a api.anthropic.com las atiende la prueba con respuestas en
// streaming (SSE) con la forma exacta de las reales. Nunca se usa una clave de verdad.
//
//   · configuración: aviso visible, autorización, clave cifrada en el equipo o solo en la
//     sesión, probar la conexión, activar y apagar
//   · ninguna clave en el HTML, el almacenamiento del navegador, los respaldos ni las copias (criterio 8)
//   · Módulo 02: vista previa con costo, búsqueda con IA, avance y resultado por fuente
//   · solicitud: herramientas web 2026, registrar_hallazgo estricta, esfuerzo, sin «thinking»,
//     caché y conversación que solo crece al final
//   · cada hallazgo a su bandeja: registrado, por revisar, pendiente, nuevo y descartado;
//     ningún precio entra si no está escrito en la página leída (criterio 9)
//   · texto de internet escapado en la bandeja, el catálogo y las fuentes propuestas (criterio 8)
//   · revisar: confirmar con sugerido, verificar con el enlace, rechazar la propuesta, retirar
//   · vínculos de producto en la ficha y «Actualizar este insumo ahora» con IA
//   · error de la API y falta de red explicados en español (el recálculo sigue) · tope de gasto del mes
//   · una base de la Fase 1 (IndexedDB versión 1) se actualiza a la versión 2 sin perder nada
//
// Uso: npm run prueba:investigador   (CAPTURAS=carpeta guarda imágenes de cada pantalla)

import {
  RUTA_PRECIOS, servidor, navegador, contexto, vigilarErrores, abrirPrecios, ingresarPrecios, cerrarModales, irA, marcador,
} from './comun.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const marca = marcador('El Investigador IA en el navegador, con la API simulada');
const m = {
  ok(cond, msg, detalle) { return marca.ok(cond, msg + (!cond && detalle !== undefined ? ' · ' + JSON.stringify(detalle).slice(0, 400) : '')); },
  get pruebas() { return marca.pruebas; },
  get fallas() { return marca.fallas; },
};
const srv = await servidor();
const nav = await navegador();

const CLAVE = 'sk-ant-api03-PRUEBA_' + 'x'.repeat(40) + '_NOESREAL';
const CLAVE2 = 'sk-ant-api03-SESION_' + 'y'.repeat(40) + '_NOESREAL';
const CEMENTO = 'G02-0001';
const BLANCO = 'G02-0002';
const MEDELLIN = '05001';

/* ── Páginas y respuestas con la forma de la API ── */
const URL_HC = 'https://www.homecenter.com.co/homecenter-co/product/123456/cemento-gris-uso-general-50-kg-argos/123456/';
const PAG_HC = 'Inicio > Construcción\n\n# Cemento Gris Uso General 50 kg Argos\n\nCódigo: 123456 · Marca: ARGOS\n\n**$32.900**\n\nPrecio con IVA incluido. Precio válido para Medellín (tienda Industriales).';
const URL_BL = 'https://www.homecenter.com.co/homecenter-co/product/654321/cemento-blanco-25-kg-argos/654321/';
const PAG_BL = 'Inicio > Construcción\n\n# Cemento Blanco Argos 25 kg\n\nCódigo: 654321 · Marca: ARGOS\n\n**$41.500**\n\nPrecio con IVA incluido. Medellín.';
const URL_EASY = 'https://www.easy.com.co/p/cemento-argos-50kg';
const XSS = '<img src=x onerror="window.__xss=1">';
const URL_XSS = 'https://tiendaxss.com.co/kit';
const PAG_XSS = `Kit ${XSS} infantil de jardinería con regadera\n\nPrecio $ 45.900\n\nEnvíos a Medellín`;

let nId = 0;
const id = (p) => p + '_' + String(++nId).padStart(3, '0');
function busqueda(query, urls) {
  const i = id('srvtoolu');
  return [
    { type: 'server_tool_use', id: i, name: 'web_search', input: { query } },
    { type: 'web_search_tool_result', tool_use_id: i, content: urls.map((u) => ({ type: 'web_search_result', url: u, title: 'Resultado', encrypted_content: 'RW5jcmlwdGFkbw==', page_age: '2 days ago' })) },
  ];
}
function lectura(url, texto) {
  const i = id('srvtoolu');
  return [
    { type: 'server_tool_use', id: i, name: 'web_fetch', input: { url } },
    { type: 'web_fetch_tool_result', tool_use_id: i, content: { type: 'web_fetch_result', url, retrieved_at: '2026-10-04T15:00:00Z', content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: texto }, title: 'Página' } } },
  ];
}
const pensamiento = () => ({ type: 'thinking', thinking: '', signature: 'EqQBCkgIBxABGAIqQFirmaDePrueba' + ++nId });
const hallazgo = (extra) => ({ type: 'tool_use', id: id('toolu'), name: 'registrar_hallazgo', input: Object.assign({
  url: URL_HC, titulo: 'Cemento Gris Uso General 50 kg Argos', texto_literal: 'Cemento Gris Uso General 50 kg Argos\n\nCódigo: 123456 · Marca: ARGOS\n\n**$32.900**',
  precio: 32900, moneda: 'COP', unidad_publicada: 'bulto', presentacion: 'bulto de 50 kg', incluye_iva: 'sí', ciudad: 'Medellín',
  fecha_visible: '', proveedor: 'Homecenter', condiciones: '',
}, extra || {}) });
const uso = (e, s, w, l, busquedas) => ({ input_tokens: e, output_tokens: s, cache_creation_input_tokens: w, cache_read_input_tokens: l, server_tool_use: { web_search_requests: busquedas } });
const respuesta = (content, stop_reason, usage) => ({ id: id('msg'), type: 'message', role: 'assistant', model: 'claude-opus-5-5', content, stop_reason, stop_sequence: null, usage });

/** Una respuesta como la manda la API con stream: true. */
function sse(msg) {
  const out = [];
  const ev = (type, data) => out.push(`event: ${type}\ndata: ${JSON.stringify(Object.assign({ type }, data))}\n\n`);
  const u = msg.usage;
  ev('message_start', { message: { id: msg.id, type: 'message', role: 'assistant', model: msg.model, content: [], stop_reason: null, stop_sequence: null,
    usage: { input_tokens: u.input_tokens, output_tokens: 1, cache_creation_input_tokens: u.cache_creation_input_tokens, cache_read_input_tokens: u.cache_read_input_tokens } } });
  msg.content.forEach((b, i) => {
    if (b.type === 'text') {
      ev('content_block_start', { index: i, content_block: { type: 'text', text: '' } });
      ev('content_block_delta', { index: i, delta: { type: 'text_delta', text: b.text } });
    } else if (b.type === 'thinking') {
      ev('content_block_start', { index: i, content_block: { type: 'thinking', thinking: '', signature: '' } });
      ev('content_block_delta', { index: i, delta: { type: 'signature_delta', signature: b.signature } });
    } else if (b.type === 'tool_use' || b.type === 'server_tool_use') {
      ev('content_block_start', { index: i, content_block: Object.assign({}, b, { input: {} }) });
      const j = JSON.stringify(b.input);
      const corte = Math.floor(j.length / 2);
      ev('content_block_delta', { index: i, delta: { type: 'input_json_delta', partial_json: j.slice(0, corte) } });
      ev('content_block_delta', { index: i, delta: { type: 'input_json_delta', partial_json: j.slice(corte) } });
    } else ev('content_block_start', { index: i, content_block: b });
    ev('content_block_stop', { index: i });
  });
  ev('message_delta', { delta: { stop_reason: msg.stop_reason, stop_sequence: null }, usage: { output_tokens: u.output_tokens, input_tokens: u.input_tokens,
    cache_creation_input_tokens: u.cache_creation_input_tokens, cache_read_input_tokens: u.cache_read_input_tokens, server_tool_use: u.server_tool_use } });
  ev('message_stop', {});
  return out.join('');
}

/* ── La búsqueda del cemento gris en Medellín: un precio de cada destino ── */
const R1 = respuesta([
  pensamiento(),
  ...busqueda('precio cemento gris 50 kg Medellín', [URL_HC, URL_BL, URL_EASY, URL_XSS]),
  ...lectura(URL_HC, PAG_HC), ...lectura(URL_BL, PAG_BL), ...lectura(URL_XSS, PAG_XSS),
  { type: 'text', text: 'Encontré estos precios.' },
  hallazgo(),                                                                                              // verificado y seguro → observación
  hallazgo({ url: URL_BL, titulo: 'Cemento Blanco Argos 25 kg', texto_literal: 'Cemento Blanco Argos 25 kg\n\nCódigo: 654321 · Marca: ARGOS\n\n**$41.500**',
    precio: 41500, presentacion: 'bulto de 25 kg' }),                                                     // otro insumo → por revisar, sugiere el blanco
  hallazgo({ texto_literal: 'Cemento Gris Uso General 50 kg Argos $29.900', precio: 29900 }),            // inventado → descartado
  hallazgo({ url: URL_EASY, titulo: 'Cemento Argos gris 50 kg', texto_literal: 'Cemento Argos 50kg $ 30.500', precio: 30500, proveedor: 'Easy' }), // sin leer → pendiente
  hallazgo({ url: URL_XSS, titulo: `Kit ${XSS} infantil de jardinería con regadera`, texto_literal: `Kit ${XSS} infantil de jardinería con regadera\n\nPrecio $ 45.900`,
    precio: 45900, unidad_publicada: 'unidad', presentacion: '', proveedor: '<b>Tienda XSS</b>', condiciones: '<script>window.__xss=2</script>' }), // → producto nuevo
], 'tool_use', uso(6000, 2000, 3000, 0, 1));
const R2 = respuesta([{ type: 'text', text: 'Registré los precios.' }], 'end_turn', uso(500, 80, 0, 12000, 0));
const SIN_DATO = () => respuesta([pensamiento(), ...busqueda('precio cemento gris Medellín', []), { type: 'text', text: 'No encontré precios publicados.' }], 'end_turn', uso(3000, 300, 0, 2000, 1));
// Costo esperado con la tarifa de Opus 5.5 (US$ por millón: 4 entrada, 5 escritura de caché, 0,2 lectura, 20 salida) y US$ 0,01 por búsqueda
const COSTO_R1R2 = (6000 * 4 + 2000 * 20 + 3000 * 5) / 1e6 + 0.01 + (500 * 4 + 80 * 20 + 12000 * 0.2) / 1e6;

/** Esquema de la base de la Fase 1 (IndexedDB «arken_precios», versión 1), copiado del programa 0.1.0. */
const ESQUEMA_V1 = {
  insumos: { keyPath: 'id', indices: { grupo: 'grupo', categoriaArken: 'categoriaArken' } },
  taxonomia: { keyPath: 'codigo' },
  equivalenciasArken: { keyPath: 'id', indices: { insumoId: 'insumoId' } },
  ciudades: { keyPath: 'codigoDivipola' },
  fuentes: { keyPath: 'id' },
  vinculosProducto: { keyPath: 'id', indices: { insumoId: 'insumoId' } },
  observaciones: { keyPath: 'id', indices: { insumoCiudadFecha: ['insumoId', 'ciudad', 'fechaCaptura'], fuenteId: 'fuenteId', ejecucionId: 'ejecucionId', insumoId: 'insumoId' } },
  consolidados: { keyPath: 'id', indices: { insumoCiudadFecha: ['insumoId', 'ciudad', 'fecha'] } },
  cortes: { keyPath: 'id' }, preciosAdoptados: { keyPath: 'id', indices: { insumoId: 'insumoId' } }, ejecuciones: { keyPath: 'id' },
  cotizaciones: { keyPath: 'id' }, solicitudes: { keyPath: 'id' }, fletes: { keyPath: 'id' }, parametros: { keyPath: 'id' }, salarios: { keyPath: 'id' },
  cuadrillas: { keyPath: 'id' }, alertas: { keyPath: 'id' }, vistasGuardadas: { keyPath: 'id' }, propuestas: { keyPath: 'id' }, listasArken: { keyPath: 'id' },
  usuarios: { keyPath: 'id' }, auditoria: { keyPath: 'id' }, configuracion: { keyPath: 'id' },
};

/** Una base con datos de la Fase 1 se abre con este programa: se actualiza a la versión 2 sin perder nada. */
async function migracion() {
  const ctx = await contexto(nav);
  await ctx.route('**/__vacia.html', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>vacía</title>' }));
  const p = await ctx.newPage();
  const errores = vigilarErrores(p);
  await abrirPrecios(p, srv.url(RUTA_PRECIOS));
  await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
  // Datos como los deja la Fase 1: un precio a mano y la empresa configurada
  const volcado = await p.evaluate(async (esquema) => {
    const ins = Datos.insumo('G02-0001');
    const r = await Registro.registrar([{ insumoId: ins.id, ciudad: '05001', fechaCaptura: hoyISO(), precioPublicado: 31500, unidadPublicada: ins.unidad, incluyeIva: true,
      tipoPrecio: 'cotización', fuenteId: 'manual', proveedor: 'Depósito de prueba', textoLiteral: 'Cemento gris 50 kg $ 31.500', metodo: 'manual' }], { origen: 'prueba de migración' });
    await Datos.fijarConfig('empresa', { razonSocial: 'Constructora de prueba S.A.S.' });
    const d = {};
    for (const a of Object.keys(esquema)) d[a] = await BD.todos(a);
    return { d, obs: r.nuevas[0].id };
  }, ESQUEMA_V1);
  // La misma base, pero creada con el esquema de la versión 1
  await p.goto(srv.url('/__vacia.html'));
  await p.evaluate(async ({ esquema, d }) => {
    await new Promise((res, rej) => { const q = indexedDB.deleteDatabase('arken_precios'); q.onsuccess = res; q.onerror = () => rej(q.error); q.onblocked = res; });
    const db = await new Promise((res, rej) => {
      const q = indexedDB.open('arken_precios', 1);
      q.onupgradeneeded = () => {
        for (const [nombre, def] of Object.entries(esquema)) {
          const st = q.result.createObjectStore(nombre, { keyPath: def.keyPath });
          for (const [ix, ruta] of Object.entries(def.indices || {})) st.createIndex(ix, ruta, { unique: false });
        }
      };
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    const tx = db.transaction(Object.keys(esquema), 'readwrite');
    for (const [nombre, filas] of Object.entries(d)) for (const f of filas) tx.objectStore(nombre).put(f);
    await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    db.close();
  }, { esquema: ESQUEMA_V1, d: volcado.d });
  const antes = await p.evaluate(async () => (await indexedDB.databases()).find((x) => x.name === 'arken_precios').version);
  await abrirPrecios(p, srv.url(RUTA_PRECIOS));
  await ingresarPrecios(p, 'admin', 'prueba123');
  const despues = await p.evaluate(async (obsId) => {
    const o = await Datos.observacion(obsId);
    return { version: (await indexedDB.databases()).find((x) => x.name === 'arken_precios').version, backend: BD.backend,
             nuevos: ['hallazgos', 'investigaciones', 'secretos'].every((a) => typeof BD.ESQUEMA[a] === 'object'),
             cuenta: await BD.contar('hallazgos') + await BD.contar('investigaciones') + await BD.contar('secretos'),
             precio: o && o.precioPublicado, empresa: (Datos.config('empresa', {}) || {}).razonSocial, insumos: Datos.insumos().length };
  }, volcado.obs);
  m.ok(antes === 1 && despues.version === 2 && despues.backend === 'indexeddb' && despues.nuevos && despues.cuenta === 0,
    'una base de la Fase 1 (versión 1) se actualiza a la versión 2: agrega hallazgos, búsquedas y secretos', { antes, despues });
  m.ok(despues.precio === 31500 && despues.empresa === 'Constructora de prueba S.A.S.' && despues.insumos === 884,
    'con la actualización no se pierde nada: el precio registrado, la empresa, el catálogo y la contraseña cambiada', despues);
  m.ok(errores.length === 0, 'la actualización de la base no deja errores de JavaScript', errores.slice(0, 3));
  await ctx.close();
}

try {
  await migracion();
  const ctx = await contexto(nav);
  const p = await ctx.newPage();
  const errores = vigilarErrores(p);

  /* ── La API simulada ── */
  const pedidos = [];
  let guion = [];
  await ctx.route('https://api.anthropic.com/**', async (ruta) => {
    const req = ruta.request();
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': req.headers()['access-control-request-headers'] || '*', 'access-control-expose-headers': 'request-id' };
    if (req.method() === 'OPTIONS') return ruta.fulfill({ status: 204, headers: cors });
    const url = new URL(req.url());
    const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
    pedidos.push({ metodo: req.method(), ruta: url.pathname, consulta: url.search, cabeceras: req.headers(), cuerpo });
    const json = (status, obj) => ruta.fulfill({ status, headers: Object.assign({ 'content-type': 'application/json', 'request-id': id('req') }, cors), body: JSON.stringify(obj) });
    if (req.method() === 'GET' && url.pathname.startsWith('/v1/models/')) {
      return json(200, { type: 'model', id: decodeURIComponent(url.pathname.split('/').pop()), display_name: 'Claude Opus 5.5', created_at: '2026-01-01T00:00:00Z' });
    }
    if (req.method() === 'POST' && url.pathname === '/v1/messages') {
      const r = guion.shift();
      if (!r) return json(500, { type: 'error', error: { type: 'api_error', message: 'La prueba no tenía más respuestas' } });
      if (r.sinRed) return ruta.abort('internetdisconnected');
      if (r.estado) return json(r.estado, { type: 'error', error: { type: r.tipo, message: r.mensaje } });
      return ruta.fulfill({ status: 200, headers: Object.assign({ 'content-type': 'text/event-stream', 'request-id': id('req') }, cors), body: sse(r) });
    }
    return json(404, { type: 'error', error: { type: 'not_found_error', message: 'Ruta desconocida en la prueba' } });
  });
  const mensajes = () => pedidos.filter((x) => x.ruta === '/v1/messages');

  await abrirPrecios(p, srv.url(RUTA_PRECIOS));
  await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
  const bd = (expr, arg) => p.evaluate(expr, arg);
  const sinModales = () => cerrarModales(p);
  // Cada acción termina con su aviso (después solo se vuelve a pintar la pantalla): se espera ese aviso, no un dato intermedio
  const conAviso = async (texto, accion) => {
    await bd(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
    await accion();
    await p.locator('#toasts .toast', { hasText: texto }).first().waitFor({ timeout: 30000 });
  };
  const capturar = async (nombre) => {
    if (!process.env.CAPTURAS) return;
    mkdirSync(process.env.CAPTURAS, { recursive: true });
    await p.screenshot({ path: join(process.env.CAPTURAS, nombre + '.png'), fullPage: true });
  };

  /* ════════════════  CONFIGURACIÓN Y CLAVE  ════════════════ */
  await irA(p, '10');
  await p.click('#stage .tabs .tab[data-k="ia"]');
  await p.waitForSelector('#iaAvisoClave');
  const aviso = await p.textContent('#iaAvisoClave');
  m.ok(/gastar/.test(aviso) && /este navegador/.test(aviso) && /cifrada/.test(aviso) && /respaldos, paquetes ni copias/.test(aviso) && /otro HTML que se abra desde el disco/.test(aviso),
    'el aviso de la clave se ve antes de escribirla: gasta dinero, se usa desde el navegador, se guarda cifrada, no viaja en respaldos y otro archivo local podría usarla');
  m.ok(await bd(() => !ClaveIA.hay() && Investigacion.motivoNoDisponible().includes('apagado')), 'sin activar, el Investigador IA dice por qué no está disponible');

  await p.fill('#iaClave', CLAVE);
  await p.click('#iaGuardarClave');
  m.ok(await bd(() => !ClaveIA.hay()), 'sin marcar la autorización, la clave no se guarda');
  await p.fill('#iaClave', 'no-es-una-clave');
  await p.check('#iaAutorizo');
  await p.click('#iaGuardarClave');
  m.ok(await bd(() => !ClaveIA.hay()), 'un texto sin la forma de una clave de Anthropic no se guarda');
  await p.fill('#iaClave', CLAVE);
  await p.check('input[name=iaDonde][value=equipo]');
  await conAviso('Clave guardada, cifrada, en este equipo', () => p.click('#iaGuardarClave'));
  const est = await bd(() => ClaveIA.estado());
  m.ok(est.donde === 'equipo' && est.final === CLAVE.slice(-4), 'la clave queda guardada en el equipo y la pantalla solo muestra sus últimos 4 caracteres');
  m.ok(await bd(() => !!Datos.config('investigadorIA', {}).autorizadoPor), 'queda anotado quién autorizó usar la clave en este navegador');

  const secretos = await bd(async (k) => {
    const l = await BD.todos('secretos');
    const clave = l.find((x) => x.id === 'clave-ia'), llave = l.find((x) => x.id === 'llave-equipo');
    const bytes = new Uint8Array(clave.datos);
    const texto = new TextDecoder('latin1').decode(bytes);
    return { cifrada: bytes.length > 0 && !texto.includes(k) && !texto.includes('sk-ant'), json: !JSON.stringify(l).includes(k),
             noExportable: llave && llave.llave instanceof CryptoKey && llave.llave.extractable === false, algoritmo: llave && llave.llave.algorithm.name };
  }, CLAVE);
  m.ok(secretos.cifrada && secretos.json, 'en la base del navegador la clave está cifrada: sus bytes no contienen el texto de la clave');
  m.ok(secretos.noExportable && secretos.algoritmo === 'AES-GCM', 'la llave que la cifra es AES-GCM y el navegador no la deja exportar');
  const fuga = await bd((k) => {
    const html = document.documentElement.outerHTML;
    const ls = JSON.stringify(Object.assign({}, localStorage)), ss = JSON.stringify(Object.assign({}, sessionStorage));
    return { html: html.includes(k), ls: ls.includes(k), ss: ss.includes(k), campo: (document.getElementById('iaClave') || {}).value || '' };
  }, CLAVE);
  m.ok(!fuga.html && !fuga.ls && !fuga.ss && fuga.campo === '', 'la clave no queda en el HTML de la página, en localStorage ni en sessionStorage, y el campo se vacía');

  await capturar('01-configuracion');
  await p.click('#iaProbar');
  await p.waitForSelector('#modales .modal h3:text("Conexión correcta")');
  const prueba = pedidos.find((x) => x.ruta === '/v1/models/claude-opus-5-5');
  m.ok(!!prueba && prueba.cabeceras['x-api-key'] === CLAVE && prueba.cabeceras['anthropic-dangerous-direct-browser-access'] === 'true',
    '«Probar la conexión» pide la ficha del modelo (sin costo) con la clave, directo desde el navegador');
  await sinModales();

  await p.fill('#ia_hallazgos', '6');
  await p.fill('#ia_topeMensualUsd', '5');
  await conAviso('Configuración guardada', () => p.click('#iaGuardar'));
  m.ok(await bd(() => Investigacion.cfg().hallazgos === 6 && Investigacion.cfg().topeMensualUsd === 5 && Investigacion.cfg().modelo === 'claude-opus-5-5' && Investigacion.cfg().esfuerzo === 'medium'),
    'la configuración se guarda: tope de US$ 5 al mes, Claude Opus 5.5 con esfuerzo medio');
  await conAviso('Investigador IA activado', () => p.click('#iaActivar'));
  m.ok(await bd(() => Investigacion.cfg().activo === true && Investigacion.disponible() && Datos.fuente('investigador-ia').salud === 'activa'), 'activado: el Investigador IA queda disponible y su fuente, activa');

  /* ════════════════  MÓDULO 02: VISTA PREVIA, EJECUCIÓN Y RESULTADO  ════════════════ */
  await bd(({ ins, ciu }) => App.ir('02', { alcance: 'insumos', insumoIds: [ins], ciudades: [ciu] }), { ins: CEMENTO, ciu: MEDELLIN });
  await p.waitForSelector('#a2Ejecutar');
  const vista = await p.textContent('#a2Paso');
  m.ok(/Buscar con IA y actualizar 1 insumo/.test(await p.textContent('#a2Ejecutar')) && /Costo de IA estimado/.test(vista) && /US\$/.test(vista) && /Gasto del mes/.test(vista),
    'vista previa: búsquedas con IA, costo estimado en dólares y gasto del mes antes de ejecutar');

  await capturar('02-vista-previa');
  guion = [R1, R2];
  await p.click('#a2Ejecutar');
  await p.waitForSelector('#a2Hallazgos', { timeout: 60000 });
  await capturar('03-resultado');
  const res = await p.textContent('#a2Paso');
  m.ok(/Revisar hallazgos \(3\)/.test(await p.textContent('#a2Hallazgos')) && /Resultado por fuente/.test(res) && /tiendaxss\.com\.co/.test(res),
    'resultado: 3 hallazgos para revisar y el resultado por fuente (sitios leídos)');
  const q = mensajes();
  m.ok(q.length === 2, 'la búsqueda hizo 2 solicitudes a la API (herramientas y cierre)', q.length);
  const [q1, q2] = q;
  const tipos = (q1.cuerpo.tools || []).map((t) => t.type || t.name);
  const reg = (q1.cuerpo.tools || []).find((t) => t.name === 'registrar_hallazgo');
  m.ok(tipos.includes('web_search_20260209') && tipos.includes('web_fetch_20260209') && reg && reg.strict === true,
    'herramientas: búsqueda y lectura web 2026, y registrar_hallazgo con esquema estricto', tipos);
  m.ok(q1.cuerpo.model === 'claude-opus-5-5' && q1.cuerpo.output_config && q1.cuerpo.output_config.effort === 'medium' && !('thinking' in q1.cuerpo) && q1.cuerpo.stream === true,
    'solicitud: Claude Opus 5.5, esfuerzo medio, sin parámetro «thinking» y en streaming');
  m.ok(q1.cabeceras['x-api-key'] === CLAVE && q1.cabeceras['anthropic-dangerous-direct-browser-access'] === 'true', 'la clave viaja solo en la cabecera x-api-key hacia api.anthropic.com');
  m.ok(/server-side-fallback-2026-07-01/.test(q1.cabeceras['anthropic-beta'] || '') && q1.cuerpo.fallbacks === 'default' && !('betas' in q1.cuerpo),
    'el respaldo de modelo va encendido: la cabecera beta y «fallbacks: default»', { beta: q1.cabeceras['anthropic-beta'], fallbacks: q1.cuerpo.fallbacks });
  const web = (q1.cuerpo.tools || []).filter((t) => /^web_/.test(t.name));
  m.ok(web.length === 2 && web.every((t) => JSON.stringify(t.allowed_callers) === '["direct"]'),
    'búsqueda y lectura con llamada directa: el texto de cada página vuelve en la respuesta para verificarlo', web);
  m.ok(JSON.stringify(q1.cuerpo).includes('cache_control'), 'las instrucciones fijas van marcadas para la caché de Anthropic');
  m.ok(q2.cuerpo.messages.length === 3 && JSON.stringify(q2.cuerpo.messages[0]) === JSON.stringify(q1.cuerpo.messages[0]) &&
    JSON.stringify(q2.cuerpo.messages[1].content) === JSON.stringify(R1.content) && q2.cuerpo.messages[2].content.filter((x) => x.type === 'tool_result').length === 5,
    'la conversación solo crece al final: la respuesta se reenvía tal cual y cada hallazgo recibe su resultado');
  m.ok(!JSON.stringify(q1.cuerpo).includes(CLAVE), 'la clave no va dentro del cuerpo de la solicitud');

  const datos = await bd(async ({ ins, url }) => {
    const h = Datos.lista('hallazgos');
    const porEstado = {};
    h.forEach((x) => { porEstado[x.estado] = (porEstado[x.estado] || 0) + 1; });
    const obs = (await BD.todos('observaciones')).filter((o) => o.metodo === 'ia');
    const inv = Datos.lista('investigaciones');
    const v = Vinculos.buscar(ins, url);
    return { porEstado, obs: obs.map((o) => ({ insumoId: o.insumoId, ciudad: o.ciudad, precio: o.precioPublicado, url: o.url, fuente: o.fuenteId, lit: o.textoLiteral, verificacion: o.verificacion, hash: o.hashEvidencia })),
             costo: inv.reduce((s, x) => s + x.costo.usd, 0), inv: inv.length, vinculo: v && v.estado,
             propFuente: Datos.lista('propuestas').filter((x) => x.tipo === 'fuente').map((x) => x.datos.dominio),
             propInsumo: Datos.lista('propuestas').filter((x) => x.tipo === 'insumo').map((x) => x.datos.descripcion) };
  }, { ins: CEMENTO, url: URL_HC });
  m.ok(JSON.stringify(datos.porEstado) === JSON.stringify({ registrado: 1, 'por revisar': 1, descartado: 1, pendiente: 1, nuevo: 1 }) ||
       (datos.porEstado.registrado === 1 && datos.porEstado['por revisar'] === 1 && datos.porEstado.descartado === 1 && datos.porEstado.pendiente === 1 && datos.porEstado.nuevo === 1),
    'cada hallazgo en su bandeja: 1 registrado, 1 por revisar, 1 pendiente, 1 producto nuevo y 1 descartado', datos.porEstado);
  const o = datos.obs[0] || {};
  m.ok(datos.obs.length === 1 && o.insumoId === CEMENTO && o.precio === 32900 && o.url === URL_HC && o.fuente === 'investigador-ia' && o.ciudad === MEDELLIN && /\$32\.900/.test(o.lit) && /^[0-9a-f]{64}$/.test(o.hash || ''),
    'solo el precio verificado y sin dudas entró a la base: $32.900 con su enlace, su texto literal y la huella de la página', datos.obs);
  m.ok(!datos.obs.some((x) => x.precio === 29900), 'el precio inventado ($29.900, no escrito en la página) no entró a la base (criterio 9)');
  m.ok(Math.abs(datos.costo - COSTO_R1R2) < 1e-6, `el costo de la búsqueda se calcula con la tarifa y las búsquedas web (US$ ${datos.costo.toFixed(6)})`);
  m.ok(datos.vinculo === 'automático', 'la página del producto queda como vínculo automático del cemento gris');
  m.ok(datos.propFuente.includes('tiendaxss.com.co') && !datos.propFuente.includes('homecenter.com.co'), 'el sitio nuevo con un precio verificado va a «Fuentes propuestas»; Homecenter ya es una fuente');
  m.ok(datos.propInsumo.length === 1 && datos.propInsumo[0].includes('infantil de jardinería'), 'el producto que no se parece a nada del catálogo va a la bandeja de nuevos insumos');

  /* ════════════════  BANDEJA DE HALLAZGOS  ════════════════ */
  await p.click('#a2Hallazgos');
  await p.waitForSelector('#tHall');
  const hayXss = () => bd(() => ({ xss: window.__xss, img: document.querySelectorAll('img[src="x"]').length, scr: document.querySelectorAll('#stage script, #modales script').length }));
  const vistaDe = async (k) => { await p.click(`#stage .tabs.sub .tab[data-k="${k}"]`); await p.waitForFunction((x) => Sesion.filtros.hallazgos.vista === x, k); };
  await capturar('04-por-revisar');
  m.ok(/Se parece más a: G02-0002/.test(await p.textContent('#tHall')), '«Por revisar» muestra el insumo que se busca y el que se parece más (cemento blanco)');
  await vistaDe('nuevo');
  await capturar('05-nuevos');
  const textoNuevo = await p.textContent('#tHall');
  let x = await hayXss();
  m.ok(textoNuevo.includes(XSS) && textoNuevo.includes('<script>window.__xss=2</script>') && x.xss === undefined && x.img === 0 && x.scr === 0,
    'el texto de internet se ve tal cual, escapado: ninguna etiqueta de la página se ejecuta en la bandeja (criterio 8)');
  await vistaDe('descartado');
  m.ok(/no aparece tal cual en la página leída/.test(await p.textContent('#tHall')), '«Descartados» dice por qué: el texto literal no está en la página leída');

  // Por revisar: es el cemento blanco
  await vistaDe('por revisar');
  await conAviso('Registrado', () => p.click(`#tHall [data-reg][data-ins="${BLANCO}"]`));
  const blanco = await bd(({ b, g, url }) => ({ v1: (Vinculos.buscar(b, url) || {}).estado, v2: (Vinculos.buscar(g, url) || {}).estado,
    h: Datos.lista('hallazgos').find((h) => h.url === url).estado, obs: Array.from(Datos.obsTodas().values()).some((o) => o.insumoId === b && o.metodo === 'ia') }), { b: BLANCO, g: CEMENTO, url: URL_BL });
  m.ok(blanco.obs && blanco.h === 'registrado' && blanco.v1 === 'confirmado' && blanco.v2 === 'rechazado',
    '«Es el cemento blanco»: el precio entra al blanco, su página queda confirmada para él y rechazada para el gris');

  // Pendiente: verificar con el enlace
  await vistaDe('pendiente');
  await p.click('#tHall [data-ver]');
  await p.waitForSelector('#hvVi');
  await capturar('06-verificar-con-enlace');
  const enlaceModal = await p.getAttribute('#modales .kv a', 'href');
  await conAviso('Marque que abrió la página', () => p.click('#modales .modal-foot button:text("Registrar")'));
  m.ok(await bd((u) => Datos.lista('hallazgos').find((h) => h.url === u).estado === 'pendiente', URL_EASY), 'sin marcar «Abrí la página…», un pendiente no se registra');
  await p.check('#hvVi');
  await conAviso('Registrado', () => p.click('#modales .modal-foot button:text("Registrar")'));
  const easy = await bd(async (u) => {
    const o = (await BD.todos('observaciones')).find((x) => x.url === u), h = Datos.lista('hallazgos').find((x) => x.url === u);
    return { verificacion: o && o.verificacion, h: h.estado, hv: h.verificacion.estado };
  }, URL_EASY);
  m.ok(enlaceModal === URL_EASY && easy.verificacion === 'confirmado por persona' && easy.h === 'registrado' && easy.hv === 'confirmado por persona',
    'pendiente: con el enlace a la vista y «Abrí la página…» marcado, entra como «confirmado por persona»', easy);

  // Producto nuevo: el catálogo y las fuentes propuestas lo muestran escapado; rechazar la propuesta descarta el hallazgo
  await bd(() => { Sesion.tabs['09'] = 'bandeja'; App.ir('09'); });
  await p.waitForSelector('#tBand');
  await capturar('07-bandeja-nuevos');
  const band = await p.textContent('#tBand');
  x = await hayXss();
  m.ok(band.includes(XSS) && /esperan esta decisión/.test(band) && x.img === 0 && x.xss === undefined, 'Catálogo › Bandeja de nuevos: la propuesta de la IA con su enlace y su precio, escapada');
  await p.click('#tBand [data-re]');
  await p.fill('#f_motivo', 'No es un insumo de obra.');
  await conAviso('quedan descartados', () => p.click('#modales .modal-foot button:text("Rechazar")'));
  m.ok(await bd((u) => Datos.lista('hallazgos').find((h) => h.url === u).estado === 'descartado', URL_XSS), 'rechazar la propuesta en el Módulo 09 descarta el hallazgo que la originó');
  await bd(() => { Sesion.tabs['03'] = 'propuestas'; App.ir('03'); });
  await p.waitForSelector('#c03 table');
  await capturar('08-fuentes-propuestas');
  const prop = await bd(() => ({ texto: document.getElementById('c03').textContent, negrita: Array.from(document.querySelectorAll('#c03 b')).some((b) => b.textContent === 'Tienda XSS') }));
  m.ok(prop.texto.includes('<b>Tienda XSS</b>') && !prop.negrita && /Páginas leídas/.test(prop.texto) && /Investigador IA/.test(prop.texto),
    'Fuentes › Fuentes propuestas: el sitio que encontró la IA, con su nombre escapado y las páginas leídas; no se activa solo');

  // Registrado: retirar
  await bd(() => { Sesion.tabs['02'] = 'hallazgos'; Sesion.filtros.hallazgos = { vista: 'registrado', q: '', ejecucionId: '', pagina: 1 }; App.ir('02'); });
  await p.waitForSelector('#tHall');
  m.ok((await p.locator('#tHall tbody tr').count()) === 3, '«Registrados» lista los 3 precios que entraron (uno solo, dos revisados por una persona)');
  const fila = p.locator('#tHall tbody tr', { hasText: '32.900' });
  await fila.locator('[data-ret]').click();
  await p.fill('#f_motivo', 'Prueba: precio de una sola tienda.');
  await conAviso('Retirado', () => p.click('#modales .modal-foot button:text("Retirar")'));
  const retiro = await bd(async (u) => {
    const o = (await BD.todos('observaciones')).find((x) => x.url === u && x.precioPublicado === 32900), h = Datos.lista('hallazgos').find((x) => x.url === u);
    return { obs: o && o.estado, motivo: o && o.motivoEstado, h: h.estado };
  }, URL_HC);
  m.ok(retiro.obs === 'descartada' && /precio de una sola tienda/.test(retiro.motivo || '') && retiro.h === 'rechazado',
    '«Retirar…» deja la observación descartada con su motivo; la historia se conserva', retiro);

  /* ════════════════  FICHA: VÍNCULOS Y ACTUALIZAR CON IA  ════════════════ */
  await bd((i) => Ficha.abrir(i, '05001', 'vinculos'), CEMENTO);
  await p.waitForSelector('#fiCuerpo table');
  await capturar('09-ficha-vinculos');
  const vinc = await p.textContent('#fiCuerpo');
  m.ok(/confirmado/.test(vinc) && /automático/.test(vinc) && /rechazado/.test(vinc) && /easy\.com\.co/.test(vinc),
    'ficha › Vínculos de producto: la página confirmada (Easy), la automática (Homecenter) y la rechazada (el cemento blanco)');
  const antes = mensajes().length;
  guion = [SIN_DATO()];
  await p.click('#fiAct');
  await p.waitForSelector('#modales .modal-foot button:text("Buscar con IA y recalcular")');
  await capturar('10-ficha-actualizar');
  m.ok(/Costo estimado/.test(await p.textContent('#modales .overlay:last-child')), '«Actualizar este insumo ahora» ofrece buscar con la IA y muestra el costo estimado');
  await p.click('#modales .modal-foot button:text("Buscar con IA y recalcular")');
  await p.waitForSelector('#modales .modal h3:text("Actualización con el Investigador IA")', { timeout: 60000 });
  const q3 = mensajes()[antes];
  const usuario3 = JSON.stringify(q3 && q3.cuerpo.messages[0]);
  m.ok(mensajes().length === antes + 1 && usuario3.includes('easy.com.co') && !usuario3.includes('cemento-blanco'),
    'la búsqueda desde la ficha le pasa a la IA las páginas conocidas del producto (la confirmada), no la rechazada');
  await sinModales();

  /* ════════════════  ERRORES Y TOPE  ════════════════ */
  guion = [{ estado: 401, tipo: 'authentication_error', mensaje: 'invalid x-api-key' }];
  const conError = await bd(async () => {
    const ej = await Motor.ejecutar({ tipo: 'insumos', descripcion: 'Prueba de error', insumoIds: ['G02-0004'], ciudades: ['05001'], ia: { tareas: [{ insumoId: 'G02-0004', ciudad: '05001' }] } }, {});
    return { errores: ej.errores.map((e) => e.mensaje), detenido: ej.ia && ej.ia.detenido };
  });
  m.ok(conError.errores.some((e) => /La clave de API no es válida/.test(e)) && conError.detenido === 'error', 'un 401 de la API se explica en español y detiene el Investigador IA en esa actualización', conError);
  // Sin red: el SDK intenta tres veces (dos reintentos) y el programa lo explica; el recálculo sigue con lo registrado
  guion = [{ sinRed: true }, { sinRed: true }, { sinRed: true }];
  const sinRed = await bd(async () => {
    const ej = await Motor.ejecutar({ tipo: 'insumos', descripcion: 'Prueba sin conexión', insumoIds: ['G02-0004'], ciudades: ['05001'], ia: { tareas: [{ insumoId: 'G02-0004', ciudad: '05001' }] } }, {});
    return { errores: ej.errores.map((e) => e.mensaje), detenido: ej.ia && ej.ia.detenido, pares: ej.pares, estado: ej.estado };
  });
  m.ok(sinRed.errores.some((e) => /No hay conexión con la API de Claude/.test(e)) && sinRed.detenido === 'error' && sinRed.pares === 1 && guion.length === 0,
    'sin conexión, el Investigador IA dice por qué no buscó y la actualización recalcula igual con lo registrado (criterio 4)', sinRed);
  await bd(async () => { await Datos.fijarConfig('investigadorIA', Object.assign({}, Datos.config('investigadorIA', {}), { topeMensualUsd: 0.01 })); });
  m.ok(await bd(() => /tope del mes/.test(Investigacion.motivoNoDisponible()) && !Investigacion.disponible()), 'con el tope del mes gastado, el Investigador IA no busca y dice por qué');
  await bd(async () => { await Datos.fijarConfig('investigadorIA', Object.assign({}, Datos.config('investigadorIA', {}), { topeMensualUsd: 5 })); });

  /* ════════════════  NINGUNA CLAVE EN RESPALDOS NI COPIAS  ════════════════ */
  const respaldo = await bd(async () => JSON.stringify(await Respaldos.armar()));
  m.ok(!respaldo.includes(CLAVE) && !/sk-ant-/.test(respaldo) && !/"secretos"/.test(respaldo) && respaldo.includes('investigaciones'),
    'el respaldo completo lleva hallazgos y búsquedas, pero no la clave ni el almacén de secretos');
  const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 60000 }), bd(() => Respaldos.guardarCopia())]);
  const copia = readFileSync(await descarga.path(), 'utf8');
  m.ok(copia.length > 100000 && !copia.includes(CLAVE) && !/sk-ant-api/.test(copia), 'la copia del programa no lleva la clave');
  await sinModales();

  /* ════════════════  SOLO EN LA SESIÓN, SALIR Y APAGAR  ════════════════ */
  await bd(() => { Sesion.tabs['10'] = 'ia'; App.ir('10'); });
  await p.waitForSelector('#iaClave');
  await p.fill('#iaClave', CLAVE2);
  await p.check('input[name=iaDonde][value=sesion]');
  await conAviso('Clave lista para esta sesión', () => p.click('#iaGuardarClave'));
  m.ok(await bd(async () => ClaveIA.estado().donde === 'sesión' && !(await BD.todos('secretos')).some((x) => x.id === 'clave-ia')), '«Usarla solo en esta sesión» no la guarda y borra la que estaba guardada en el equipo');
  await bd(() => Auth.salir());
  await ingresarPrecios(p, 'admin', 'prueba123');
  m.ok(await bd(() => !ClaveIA.hay()), 'al salir se olvida la clave de la sesión');
  await bd(() => { Sesion.tabs['10'] = 'ia'; App.ir('10'); });
  await p.waitForSelector('#iaApagar');
  await conAviso('Investigador IA apagado', () => p.click('#iaApagar'));
  m.ok(await bd(() => Investigacion.cfg().activo === false && Datos.fuente('investigador-ia').salud === 'suspendida' && /apagado/.test(Investigacion.motivoNoDisponible())), 'apagado: la fuente queda suspendida y no se busca nada');

  const pedidosAjenos = pedidos.filter((x) => !/^\/v1\/(messages|models\/)/.test(x.ruta));
  m.ok(pedidosAjenos.length === 0, 'el programa solo habló con /v1/messages y /v1/models de la API');
  // El 401 y la falta de red de la prueba quedan anotados en la consola por el registro técnico: son los únicos errores esperados
  const inesperados = errores.filter((e) => !/^\[ARKEN PRECIOS\] Investigador IA · G02-0004 · Medellín[^:]*: (401 |Connection error)/.test(e));
  m.ok(inesperados.length === 0, 'sin errores de JavaScript', inesperados.slice(0, 5));
  const tecnico = await bd(() => RegistroTecnico.entradas().map((e) => e.contexto + ': ' + e.mensaje));
  const ajenos = tecnico.filter((t) => !/^Investigador IA · G02-0004 · Medellín: (401 |Connection error)/.test(t));
  m.ok(!ajenos.length && tecnico.some((t) => /: 401 /.test(t)) && tecnico.some((t) => /Connection error/.test(t)),
    'registro técnico sin fallas inesperadas: solo el 401 y la falta de red de la prueba, sin la clave', tecnico.slice(0, 5));
  m.ok(!tecnico.some((t) => t.includes(CLAVE) || t.includes(CLAVE2)), 'el registro técnico no lleva la clave');
} catch (e) {
  m.ok(false, 'la prueba se interrumpió: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  await nav.close();
  await srv.cerrar();
}

console.log(`\n${m.pruebas - m.fallas} de ${m.pruebas} comprobaciones bien.`);
process.exit(m.fallas ? 1 : 0);
