// ARKEN PRECIOS · pruebas del Investigador IA (Fase 2, §7.3).
//
// Se lee el bloque «núcleo» del programa armado (precios/programa/ARKEN_PRECIOS.html) y se
// prueba el código que corre en la página, sin copias. No hay red: la API de Claude se
// simula con respuestas que tienen la forma exacta de las reales (búsquedas, páginas
// leídas, errores de las herramientas, pausas, rechazo, respaldo de modelo).
//
//   · verificación literal: ningún precio entra si no está escrito en la página leída (criterio 9)
//   · entrada de registrar_hallazgo · solicitud (herramientas, ciudad, caché, esfuerzo)
//   · conversación completa con la API simulada: pausa, herramienta, fin, errores, tope
//   · emparejamiento con el catálogo y destino de cada hallazgo (§7.2)
//   · costo por respuesta y estimación antes de ejecutar · caché semanal y prioridad ABC
//
// Uso: npm run prueba:investigador

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const PRECIOS = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(PRECIOS, 'programa/ARKEN_PRECIOS.html'), 'utf8');
function bloque(id) {
  const m = html.match(new RegExp(`<script id="${id}">\\n?([\\s\\S]*?)</script>`));
  if (!m) throw new Error('No se encontró el bloque ' + id);
  return m[1];
}
const ctx = vm.createContext({ console, TextEncoder, URL, Intl });
vm.runInContext(bloque('arken-precios-nucleo') + '\n' + bloque('arken-precios-semilla') + '\nthis.Nucleo = Nucleo; this.Semilla = Semilla;', ctx);
const N = ctx.Nucleo;
const I = N.Investigador;
const S = ctx.Semilla;
const CATALOGO = S.catalogo();
const CIUDADES = S.ciudades();
const CEMENTO = CATALOGO.find((i) => i.id === 'G02-0001'); // Cemento gris tipo UG (bulto 50 kg)
const MEDELLIN = CIUDADES.find((c) => c.codigoDivipola === '05001');

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
    console.error('  ✖ ' + msg + (detalle !== undefined ? '\n      ' + JSON.stringify(detalle) : ''));
  }
}
const cerca = (a, b, tol = 1e-9) => typeof a === 'number' && Math.abs(a - b) <= tol;
const json = (x) => JSON.stringify(x);

/* ── Páginas y respuestas con la forma de la API ── */
const URL_HC = 'https://www.homecenter.com.co/homecenter-co/product/123456/cemento-gris-uso-general-50-kg-argos/123456/';
const PAG_HC = [
  'Inicio > Construcción y ferretería > Cemento y concreto',
  '',
  '# Cemento Gris Uso General 50 kg Argos',
  '',
  'Código: 123456 · Marca: ARGOS',
  '',
  '**$32.900**',
  '',
  'Precio con IVA incluido. Precio válido para Medellín (tienda Industriales).',
  '',
  '[Agregar al carro](https://www.homecenter.com.co/carro?sku=123456&precio=29900)',
  '',
  'Productos relacionados',
  '- Cemento blanco 25 kg $ 1.232.900 (pallet x 40)',
].join('\n');
const URL_FE = 'https://ferreteriaelpuerto.com.co/cemento-gris-uso-general-x-50-kg';
const PAG_FE = 'Ferretería El Puerto · Bogotá\n\nCemento gris uso general x 50 kg\n\nPrecio: $ 33.500\n\nPrecio antes de IVA: no aplica. Despachos en Bogotá.';
const URL_SIN_LEER = 'https://www.easy.com.co/p/cemento-argos-50kg';

let nId = 0;
const id = (p) => p + '_' + String(++nId).padStart(3, '0');
function busqueda(query, resultados) {
  const i = id('srvtoolu');
  return [
    { type: 'server_tool_use', id: i, name: 'web_search', input: { query } },
    { type: 'web_search_tool_result', tool_use_id: i, content: resultados.map((u) => ({ type: 'web_search_result', url: u, title: 'Resultado', encrypted_content: 'RW5jcmlwdGFkbw==', page_age: '2 days ago' })) },
  ];
}
function lectura(url, texto, opciones = {}) {
  const i = id('srvtoolu');
  const fuente = opciones.pdf ? { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjQK' } : { type: 'text', media_type: 'text/plain', data: texto };
  return [
    { type: 'server_tool_use', id: i, name: 'web_fetch', input: { url } },
    { type: 'web_fetch_tool_result', tool_use_id: i, content: { type: 'web_fetch_result', url, retrieved_at: '2026-10-04T15:00:00Z', content: { type: 'document', source: fuente, title: opciones.titulo || 'Página' } } },
  ];
}
function errorLectura(url, codigo) {
  const i = id('srvtoolu');
  return [
    { type: 'server_tool_use', id: i, name: 'web_fetch', input: { url } },
    { type: 'web_fetch_tool_result', tool_use_id: i, content: { type: 'web_fetch_tool_result_error', error_code: codigo } },
  ];
}
const pensamiento = () => ({ type: 'thinking', thinking: '', signature: 'EqQBCkgIBxABGAIqQFirmaDePrueba' + nId });
const llamada = (input) => ({ type: 'tool_use', id: id('toolu'), name: 'registrar_hallazgo', input });
const uso = (e, s, w = 0, l = 0, busquedas = 0) => ({ input_tokens: e, output_tokens: s, cache_creation_input_tokens: w, cache_read_input_tokens: l, server_tool_use: { web_search_requests: busquedas } });
const respuesta = (content, stop_reason, usage, model = 'claude-opus-5-5') => ({ id: id('msg'), type: 'message', role: 'assistant', model, content, stop_reason, stop_sequence: null, usage });
function hallazgo(extra) {
  return Object.assign({
    url: URL_HC, titulo: 'Cemento Gris Uso General 50 kg Argos', texto_literal: 'Cemento Gris Uso General 50 kg Argos\n\nCódigo: 123456 · Marca: ARGOS\n\n**$32.900**',
    precio: 32900, moneda: 'COP', unidad_publicada: 'bulto', presentacion: 'bulto de 50 kg', incluye_iva: 'sí', ciudad: 'Medellín',
    fecha_visible: '', proveedor: 'Homecenter', condiciones: '',
  }, extra || {});
}
const pagina = (url, texto, extra) => Object.assign({ url, pedida: url, recuperada: '2026-10-04T15:00:00Z', titulo: '', tipo: 'texto', texto }, extra || {});
const verificarCon = (entrada, paginas) => I.verificar(I.validarEntrada(hallazgo(entrada)).h, paginas);
const TAREA = { insumoId: CEMENTO.id, insumo: CEMENTO, ciudad: MEDELLIN, fecha: '2026-10-04', vinculos: [] };

/* ════════════════════════  VERIFICACIÓN LITERAL (criterio 9)  ════════════════════════ */
seccion('Verificación literal: ningún precio entra si no está escrito en la página leída (criterio 9)');
{
  const P = [pagina(URL_HC, PAG_HC)];
  const v = verificarCon({}, P);
  ok(v.estado === 'verificado', 'texto literal y precio presentes en la página leída → verificado', v);
  ok(v.extracto && v.extracto.includes('$32.900') && v.extracto.includes('Cemento Gris Uso General'), 'se guarda un extracto de la página alrededor del precio como evidencia');

  const inventado = verificarCon({ texto_literal: 'Cemento Gris Uso General 50 kg Argos $29.900', precio: 29900 }, P);
  ok(inventado.estado === 'no verificable', 'un precio inventado (texto que no está en la página) → no verificable', inventado);

  const otroPrecio = verificarCon({ precio: 31900 }, P);
  ok(otroPrecio.estado === 'no verificable' && /no aparece en el texto literal/.test(otroPrecio.motivo), 'un precio que no está en el texto literal → no verificable, aunque el texto sí esté en la página');

  const enEnlace = verificarCon({ texto_literal: 'Agregar al carro precio=29900', precio: 29900 }, P);
  ok(enEnlace.estado === 'no verificable', 'una cifra que solo está dentro de un enlace no cuenta como precio escrito');

  const cortado = verificarCon({ texto_literal: 'Cemento blanco 25 kg $ 232.900', precio: 232900, titulo: 'Cemento blanco 25 kg' }, P);
  const cortado2 = verificarCon({ texto_literal: '$ 232.900 (pallet x 40)', precio: 232900 }, P);
  ok(cortado.estado === 'no verificable' && cortado2.estado === 'no verificable', '«232.900» no se acepta dentro de «1.232.900» (no se corta un número)');
  const entero = verificarCon({ texto_literal: 'Cemento blanco 25 kg $ 1.232.900', precio: 1232900 }, P);
  ok(entero.estado === 'verificado', 'el número completo «$ 1.232.900» sí está en la página → verificado');

  const sinLeer = verificarCon({ url: URL_SIN_LEER }, P);
  ok(sinLeer.estado === 'pendiente', 'página que no se leyó con web_fetch en la búsqueda → pendiente de verificación', sinLeer);
  ok(verificarCon({}, [pagina(URL_HC, '')]).estado === 'pendiente', 'lectura sin texto (filtrada) → pendiente, no aceptada');
  ok(verificarCon({}, [pagina(URL_HC, '', { tipo: 'pdf' })]).motivo.includes('PDF'), 'PDF cuyo texto no se pudo leer → pendiente, con el motivo');
  ok(verificarCon({}, []).estado === 'pendiente', 'sin páginas leídas → pendiente');
}

seccion('Verificación literal: espacios, separadores, Markdown y direcciones equivalentes');
{
  const P = [pagina(URL_HC, PAG_HC)];
  const formas = ['**$32.900**', '$32.900', '$ 32.900', '$32,900', '$ 32 900', '$32900', '$ 32.900', 'Marca: ARGOS **$32.900**', 'Marca: ARGOS\n\n$32.900'];
  ok(formas.every((t) => verificarCon({ texto_literal: t }, P).estado === 'verificado'), 'el mismo precio con punto, coma, espacio, sin separador o con negrilla → verificado (' + formas.length + ' formas)');
  ok(verificarCon({ texto_literal: 'Cemento Gris Uso General 50 kg Argos   Código: 123456 · Marca: ARGOS $32.900' }, P).estado === 'verificado', 'saltos de línea y espacios distintos entre palabras → verificado');
  ok(verificarCon({ texto_literal: 'Cemento Gris Uso Genral 50 kg Argos **$32.900**' }, P).estado === 'no verificable', 'una palabra cambiada en el texto literal → no verificable');
  const conDecimales = [pagina(URL_HC, 'Cemento gris 50 kg\nPrecio: $ 32.900,00 IVA incluido')];
  ok(verificarCon({ texto_literal: 'Precio: $ 32.900' }, conDecimales).estado === 'verificado', '«$ 32.900» dentro de «$ 32.900,00» (ceros decimales) → verificado');
  const conCentavos = [pagina(URL_HC, 'Cemento gris 50 kg\nPrecio: $ 32.900,50 IVA incluido')];
  ok(verificarCon({ texto_literal: 'Precio: $ 32.900' }, conCentavos).estado === 'no verificable', '«$ 32.900» dentro de «$ 32.900,50» → no verificable (sería otro precio)');
  const variantes = ['https://homecenter.com.co/homecenter-co/product/123456/cemento-gris-uso-general-50-kg-argos/123456',
    'http://www.homecenter.com.co/homecenter-co/product/123456/cemento-gris-uso-general-50-kg-argos/123456/?utm_source=google&gclid=x',
    URL_HC + '#detalles'];
  ok(variantes.every((u) => verificarCon({ url: u }, P).estado === 'verificado'), 'la misma página con o sin «www.», barra final, parámetros de seguimiento o «#» → verificado');
  ok(verificarCon({ url: 'https://www.homecenter.com.co/homecenter-co/product/999999/otro' }, P).estado === 'pendiente', 'otra página del mismo sitio no sirve para verificar');
  ok(I.comparable('Caja x 1,44 m²').texto === I.comparable('caja x 1.44 m2').texto, '«1,44 m²» y «1.44 m2» se comparan igual');
  ok(I.comparable('1 32.900').texto !== I.comparable('132.900').texto, 'dos números separados por un espacio no se pegan: «1 32.900» ≠ «132.900»');
}

seccion('Verificación: moneda y dominios');
{
  const P = [pagina(URL_HC, PAG_HC.replace('**$32.900**', '**USD 25**'))];
  ok(verificarCon({ texto_literal: 'Marca: ARGOS\n\n**USD 25**', precio: 25, moneda: 'USD' }, P).estado === 'moneda', 'precio en dólares → descartado por moneda');
  ok(verificarCon({ texto_literal: 'Marca: ARGOS\n\n**USD 25**', precio: 25 }, P).estado === 'moneda', 'texto en dólares aunque la IA diga COP → descartado por moneda');
  const d = I.normalizarDominios('https://www.Homecenter.com.co/, easy.com.co; ferreteria.com/precios/  javascript:alert(1) *.malo.com');
  ok(json(d.dominios) === json(['homecenter.com.co', 'easy.com.co', 'ferreteria.com/precios']), 'dominios escritos por el usuario → sin esquema ni «www.» y con ruta opcional', d);
  ok(d.invalidos.length === 2, 'entradas inválidas (esquema raro, comodín en el dominio) se informan aparte', d.invalidos);
  const cfgP = I.configuracion({ modoDominios: 'permitir', dominiosPermitidos: ['homecenter.com.co', 'ferreteria.com/precios'] });
  ok(I.dominioPermitido(URL_HC, cfgP) && I.dominioPermitido('https://tienda.homecenter.com.co/x', cfgP), 'lista de permitidos: el dominio cubre sus subdominios');
  ok(I.dominioPermitido('https://ferreteria.com/precios/cemento', cfgP) && !I.dominioPermitido('https://ferreteria.com/blog/cemento', cfgP), 'lista de permitidos con ruta: solo lo que sigue a esa ruta');
  ok(!I.dominioPermitido('https://otrohomecenter.com.co/x', cfgP), 'un dominio que solo termina igual no pasa («otrohomecenter.com.co»)');
  const cfgB = I.configuracion({ modoDominios: 'bloquear', dominiosBloqueados: ['mercadolibre.com.co', 'easy.com.co/usados'] });
  ok(!I.dominioPermitido('https://articulo.mercadolibre.com.co/MCO-1', cfgB) && !I.dominioPermitido('https://www.easy.com.co/usados/x', cfgB) && I.dominioPermitido('https://www.easy.com.co/p/1', cfgB),
    'lista de bloqueados: dominio con subdominios y rutas');
}

/* ════════════════════════  ENTRADA DE LA HERRAMIENTA  ════════════════════════ */
seccion('Entrada de registrar_hallazgo: se revisa contra el esquema antes de usarla');
{
  const v = I.validarEntrada(hallazgo());
  ok(v.ok && v.h.incluyeIva === true && v.h.textoLiteral.startsWith('Cemento') && v.h.url === URL_HC, 'entrada completa → aceptada y llevada al formato interno');
  ok(I.validarEntrada(hallazgo({ incluye_iva: 'no indica' })).h.incluyeIva === null, '«no indica» queda como IVA sin dato');
  const falta = hallazgo(); delete falta.texto_literal;
  ok(!I.validarEntrada(falta).ok, 'falta un campo → entrada inválida');
  ok(!I.validarEntrada(hallazgo({ extra: 1 })).ok, 'un campo de más → entrada inválida');
  ok(!I.validarEntrada(hallazgo({ precio: '32900' })).ok, 'precio como texto → entrada inválida');
  ok(!I.validarEntrada(hallazgo({ precio: -5 })).ok && !I.validarEntrada(hallazgo({ precio: 0 })).ok, 'precio cero o negativo → entrada inválida');
  ok(!I.validarEntrada(hallazgo({ url: 'javascript:alert(1)' })).ok, 'dirección javascript: → entrada inválida');
  ok(!I.validarEntrada(hallazgo({ moneda: 'pesos' })).ok, 'moneda fuera de la lista → entrada inválida');
  ok(!I.validarEntrada(hallazgo({ texto_literal: 'x'.repeat(1200) })).ok, 'texto literal de más de 1.000 caracteres → entrada inválida');
  ok(!I.validarEntrada(null).ok && !I.validarEntrada([1]).ok && !I.validarEntrada('{"url":').ok, 'nulo, lista o JSON cortado → entrada inválida');
  ok(I.CAMPOS.length === 12 && I.HERRAMIENTA_HALLAZGO.strict === true && I.HERRAMIENTA_HALLAZGO.input_schema.additionalProperties === false,
    'la herramienta tiene los 12 campos de §7.3, modo estricto y sin campos adicionales');
  ok(json(I.HERRAMIENTA_HALLAZGO.input_schema.required) === json(I.CAMPOS), 'los 12 campos son obligatorios en el esquema');
}

/* ════════════════════════  SOLICITUD  ════════════════════════ */
seccion('Solicitud a la API: modelo, esfuerzo, herramientas, ciudad y caché');
{
  const s = I.solicitud({}, TAREA);
  ok(s.model === 'claude-opus-5-5' && s.output_config.effort === 'medium', 'por defecto: claude-opus-5-5 con esfuerzo medio');
  ok(!('thinking' in s), 'no se envía «thinking» (el modelo razona siempre)');
  ok(json(s.tool_choice) === json({ type: 'auto' }), 'tool_choice automático, nunca forzado');
  const [b, f, h] = s.tools;
  ok(b.type === 'web_search_20260209' && b.name === 'web_search' && b.max_uses === 4, 'búsqueda web_search_20260209 con máximo de búsquedas');
  ok(f.type === 'web_fetch_20260209' && f.name === 'web_fetch' && f.max_uses === 5 && f.max_content_tokens === 8000, 'lectura web_fetch_20260209 con máximo de páginas y de tokens por página');
  ok(json(b.allowed_callers) === json(['direct']) && json(f.allowed_callers) === json(['direct']), 'búsqueda y lectura directas, para que el texto de la página vuelva completo y se pueda verificar');
  ok(json(b.user_location) === json({ type: 'approximate', city: 'Medellín', region: 'Antioquia', country: 'CO', timezone: 'America/Bogota' }), 'ubicación: Colombia y la ciudad de la tarea');
  ok(h.name === 'registrar_hallazgo' && h.strict === true && h.eager_input_streaming === true, 'registrar_hallazgo estricta y con entrada anticipada (streaming)');
  ok(s.system[0].cache_control.type === 'ephemeral' && s.cache_control.type === 'ephemeral', 'caché de instrucciones (parte fija) y caché automática de la conversación');
  ok(json(s.betas) === json([I.BETA_RESPALDO]) && s.fallbacks === 'default', 'respaldo de modelo del lado de Anthropic activado');
  ok(!('betas' in I.solicitud({ respaldo: false }, TAREA)), 'el respaldo se puede apagar');
  ok(!('eager_input_streaming' in I.solicitud({}, TAREA, { entradaAnticipada: false }).tools[2]), 'la entrada anticipada se puede quitar si la API no la acepta');
  const hk = I.solicitud({ modelo: 'claude-haiku-4-5' }, TAREA);
  ok(hk.tools[0].type === 'web_search_20250305' && hk.tools[1].type === 'web_fetch_20250910' && !hk.tools[0].allowed_callers, 'Haiku 4.5: herramientas web_search_20250305 y web_fetch_20250910');
  ok(!hk.output_config && !hk.betas, 'Haiku 4.5: sin esfuerzo ni respaldo');
  const so = I.solicitud({ modelo: 'claude-sonnet-5-5', esfuerzo: 'high' }, TAREA);
  ok(so.model === 'claude-sonnet-5-5' && so.output_config.effort === 'high' && so.tools[0].type === 'web_search_20260209', 'Sonnet 5.5 con esfuerzo alto');
  const msg = I.mensaje(Object.assign({}, TAREA, { vinculos: [{ url: URL_HC }, { url: 'javascript:alert(1)' }] }), {});
  ok(msg.includes('Cemento gris tipo UG (bulto 50 kg)') && msg.includes('Medellín, Antioquia') && msg.includes('como máximo 4'), 'el mensaje lleva el insumo, la ciudad y el máximo de hallazgos');
  ok(msg.includes(URL_HC) && !msg.includes('javascript:'), 'las páginas ya confirmadas van en el mensaje (web_fetch solo abre direcciones de la conversación); nunca una dirección insegura');
  const cfgP = { modoDominios: 'permitir', dominiosPermitidos: ['homecenter.com.co/construccion', 'easy.com.co'] };
  const sp = I.solicitud(cfgP, TAREA);
  ok(json(sp.tools[0].allowed_domains) === json(['homecenter.com.co/construccion', 'easy.com.co']) && json(sp.tools[1].allowed_domains) === json(['homecenter.com.co', 'easy.com.co']),
    'permitidos: la búsqueda acepta rutas; la lectura recibe solo dominios (con ruta nunca coincidiría)');
  const sb = I.solicitud({ modoDominios: 'bloquear', dominiosBloqueados: ['mercadolibre.com.co', 'easy.com.co/usados'] }, TAREA);
  ok(json(sb.tools[0].blocked_domains) === json(['mercadolibre.com.co', 'easy.com.co/usados']) && json(sb.tools[1].blocked_domains) === json(['mercadolibre.com.co']),
    'bloqueados: la lectura recibe solo los dominios sin ruta; las rutas las revisa el programa');
  ok(!('allowed_domains' in sb.tools[0]) && !('blocked_domains' in I.solicitud({}, TAREA).tools[0]), 'nunca permitidos y bloqueados a la vez; sin lista, sin filtro');
  const c = I.configuracion({ busquedas: 99, paginas: 0, tokensPagina: 100, hallazgos: 'x', esfuerzo: 'turbo', modoDominios: 'otro', topeMensualUsd: -3 });
  ok(c.busquedas === 10 && c.paginas === 1 && c.tokensPagina === 2000 && c.hallazgos === 4 && c.esfuerzo === 'medium' && c.modoDominios === 'ninguno' && c.topeMensualUsd === 0,
    'la configuración se mantiene dentro de sus límites');
}

/* ════════════════════════  CONVERSACIÓN CON LA API SIMULADA  ════════════════════════ */
function apiSimulada(guion) {
  const pedidos = [];
  let i = 0;
  return {
    pedidos,
    llamar: async (cuerpo) => {
      pedidos.push(JSON.parse(JSON.stringify(cuerpo)));
      const r = guion[i++];
      if (!r) throw new Error('El guion se acabó');
      if (r instanceof Error) throw r;
      return JSON.parse(JSON.stringify(r));
    },
  };
}

seccion('Conversación completa: búsqueda, pausa, hallazgos verificados y descartados');
{
  const p1 = pensamiento();
  const r1 = respuesta([p1, ...busqueda('precio cemento gris 50 kg Medellín', [URL_HC, URL_FE, URL_SIN_LEER]), ...lectura(URL_HC, PAG_HC, { titulo: 'Cemento Argos' })], 'pause_turn', uso(5000, 800, 3000, 0, 1));
  const r2 = respuesta([pensamiento(), ...lectura(URL_FE, PAG_FE), { type: 'text', text: 'Encontré precios.' },
    llamada(hallazgo()),
    llamada(hallazgo({ url: URL_FE, titulo: 'Cemento gris uso general x 50 kg', texto_literal: 'Cemento gris uso general x 50 kg\n\nPrecio: $ 33.500', precio: 33500, ciudad: 'Bogotá', proveedor: 'Ferretería El Puerto', incluye_iva: 'no indica' })),
    llamada(hallazgo({ url: URL_FE, texto_literal: 'Cemento gris uso general x 50 kg Precio: $ 31.000', precio: 31000 })),
    llamada(hallazgo({ url: URL_SIN_LEER, texto_literal: 'Cemento Argos 50kg $ 30.500', precio: 30500 })),
  ], 'tool_use', uso(2000, 1500, 9000, 3000, 0));
  const r3 = respuesta([{ type: 'text', text: 'Registré 2 precios.' }], 'end_turn', uso(400, 60, 0, 14000, 0));
  const api = apiSimulada([r1, r2, r3]);
  const eventos = [];
  const r = await I.correrTarea(TAREA, {}, { llamar: api.llamar, alEvento: (e) => eventos.push(e) });
  ok(r.estado === 'completa' && r.solicitudes === 3, 'la tarea termina: 3 solicitudes (pausa, herramienta, fin)', { estado: r.estado, s: r.solicitudes });
  ok(json(r.hallazgos.map((x) => x.verificacion.estado)) === json(['verificado', 'verificado', 'no verificable', 'pendiente']),
    'cada hallazgo con su verificación: 2 verificados, 1 inventado (no verificable), 1 de una página no leída (pendiente)', r.hallazgos.map((x) => x.verificacion.estado));
  const [q1, q2, q3] = api.pedidos;
  ok(q2.messages.length === 2 && json(q2.messages[1].content) === json(r1.content), 'tras la pausa se reenvía la respuesta tal cual, con el bloque de razonamiento intacto');
  const res = q3.messages[3].content;
  ok(q3.messages[3].role === 'user' && res.length === 4 && res.every((x) => x.type === 'tool_result'), 'cada llamada a registrar_hallazgo recibe su resultado');
  ok(/^Verificado/.test(res[0].content) && /^No verificable/.test(res[2].content) && /^Pendiente de verificación/.test(res[3].content), 'la IA sabe qué pasó con cada precio (verificado, no verificable, pendiente)');
  const fijo = (q) => json({ model: q.model, system: q.system, tools: q.tools, tool_choice: q.tool_choice, output_config: q.output_config, cache_control: q.cache_control });
  ok(fijo(q1) === fijo(q2) && fijo(q2) === fijo(q3), 'instrucciones y herramientas idénticas byte a byte en toda la tarea (caché y razonamiento preservado)');
  const prefijo = (a, b) => a.messages.every((m, k) => json(m) === json(b.messages[k]));
  ok(prefijo(q1, q2) && prefijo(q2, q3), 'los mensajes solo crecen al final: nada se edita ni se reordena');
  ok(r.consultas.length === 1 && r.lecturas.length === 2 && r.paginas.every((p) => p.texto), 'se registran la búsqueda y las dos páginas leídas con su texto');
  ok(eventos.some((e) => e.tipo === 'búsqueda') && eventos.filter((e) => e.tipo === 'hallazgo').length === 4 && eventos[eventos.length - 1].tipo === 'fin', 'el registro en vivo recibe búsquedas, lecturas, hallazgos y el fin');
  const esperado = (5000 * 4 + 800 * 20 + 3000 * 5) / 1e6 + 0.01 + (2000 * 4 + 1500 * 20 + 9000 * 5 + 3000 * 0.2) / 1e6 + (400 * 4 + 60 * 20 + 14000 * 0.2) / 1e6;
  ok(cerca(r.costo.usd, Number(esperado.toFixed(6)), 1e-6), 'el costo suma las 3 respuestas con la tarifa de Opus 5.5 y la búsqueda (USD ' + r.costo.usd + ')');

  const cls = r.hallazgos.map((x) => I.clasificar(x, { insumo: CEMENTO, catalogo: CATALOGO, ciudades: CIUDADES, vinculos: [], tarea: TAREA }));
  ok(json(cls.map((c) => c.destino)) === json(['observación', 'observación', 'descartado', 'pendiente']), 'destinos: 2 observaciones, 1 descartado, 1 pendiente', cls.map((c) => c.destino));
  const cap = cls[0].captura;
  ok(cap.metodo === 'ia' && cap.exigirLiteral === true && cap.fuenteId === 'investigador-ia' && cap.precioPublicado === 32900, 'la observación va por el registro con método IA y exige el precio en el texto literal');
  ok(cap.ciudad === '05001' && cap.alcance === 'ciudad' && cap.fechaCaptura === '2026-10-04', 'ciudad de la página (Medellín) y fecha de la lectura');
  ok(cap.unidadPublicada === 'BTO' && cap.presentacion && cap.presentacion.cantidad === 50 && cap.incluyeIva === true, 'unidad «bulto», presentación de 50 kg e IVA incluido');
  ok(cap.evidencia.includes('$32.900') && N.LectorPrecios.estaEnTexto(cap.precioPublicado, cap.textoLiteral), 'evidencia guardada y el precio está en el texto literal');
  ok(cls[1].captura.ciudad === '11001' && cls[1].captura.incluyeIva === undefined, 'el precio de Bogotá queda en Bogotá aunque la tarea fuera Medellín; IVA sin dato');
  const params = N.Laboral.enFecha(S.parametros(), '2026-10-04');
  const n = N.Observaciones.normalizar({ precioPublicado: cap.precioPublicado, unidadPublicada: cap.unidadPublicada, presentacion: cap.presentacion, incluyeIva: cap.incluyeIva }, CEMENTO, params);
  ok(n.ok && n.factorConversion === 1 && n.precioConIva === 32900 && cerca(n.precioSinIva, 27647.059, 0.001), 'normalizado a la unidad del insumo: $32.900 con IVA, $27.647 sin IVA');
  const nuevos = I.dominiosNuevos(r.hallazgos, S.fuentes());
  ok(json(nuevos.map((x) => x.dominio)) === json(['ferreteriaelpuerto.com.co']) || json(nuevos.map((x) => x.dominio)) === json(['ferreteriaelpuerto.com.co', 'homecenter.com.co']),
    'los sitios nuevos con precios verificados se proponen como fuentes', nuevos.map((x) => x.dominio));
  ok(!nuevos.some((x) => x.dominio === 'easy.com.co'), 'un sitio sin precio verificado no se propone');
}

seccion('Conversación: errores de las herramientas, rechazo, error de la API, cancelación y tope');
{
  const rErr = respuesta([...busqueda('cemento', [URL_HC]), ...errorLectura(URL_HC, 'url_not_accessible'), { type: 'text', text: 'sin dato' }], 'end_turn', uso(3000, 200, 0, 0, 1));
  const a = await I.correrTarea(TAREA, {}, apiSimulada([rErr]));
  ok(a.estado === 'completa' && a.errores.length === 1 && a.errores[0].codigo === 'url_not_accessible' && a.hallazgos.length === 0, 'error de lectura dentro de una respuesta HTTP 200 → se anota, sin hallazgos');
  ok(I.nombreError('url_not_accessible') === 'no se pudo abrir la página', 'el error se explica en español');

  const b = await I.correrTarea(TAREA, {}, apiSimulada([respuesta([], 'refusal', uso(1000, 0))]));
  ok(b.estado === 'rechazada', 'rechazo de la IA (stop_reason «refusal») → tarea rechazada, sin hallazgos');

  const c = await I.correrTarea(TAREA, {}, apiSimulada([Object.assign(new Error('invalid x-api-key'), { status: 401 })]));
  ok(c.estado === 'error' && c.error.status === 401 && c.solicitudes === 0, 'error de la API (clave inválida) → la tarea se detiene con el error');

  let cancelar = false;
  const lento = { llamar: async () => { cancelar = true; return respuesta([...busqueda('x', [URL_HC])], 'pause_turn', uso(100, 10)); }, cancelada: () => cancelar };
  const d = await I.correrTarea(TAREA, {}, lento);
  ok(d.estado === 'cancelada' && d.solicitudes === 1, 'cancelar entre solicitudes detiene la tarea');

  const e = await I.correrTarea(TAREA, {}, { llamar: async () => respuesta([], 'end_turn', uso(10, 1)), puedeSeguir: () => false });
  ok(e.estado === 'tope' && e.solicitudes === 0, 'sin presupuesto no se hace ninguna solicitud (tope mensual)');

  let esperas = 0;
  const f = await I.correrTarea(TAREA, {}, { llamar: async () => respuesta([{ type: 'text', text: 'sin dato' }], 'end_turn', uso(10, 1)), esperar: async () => { esperas++; } });
  ok(f.estado === 'completa' && esperas === 1 && f.texto === 'sin dato', 'antes de cada solicitud se respeta la pausa del usuario');

  const pausas = Array.from({ length: 10 }, () => respuesta([{ type: 'text', text: '…' }], 'pause_turn', uso(10, 1)));
  const g = await I.correrTarea(TAREA, {}, apiSimulada(pausas));
  ok(g.solicitudes === I.MAX_SOLICITUDES && /máximo/.test(g.motivo), 'nunca más de ' + I.MAX_SOLICITUDES + ' solicitudes por insumo');
}

seccion('Conversación: límite de hallazgos, repetidos, entrada inválida, dominio y PDF');
{
  const muchos = [1, 2, 3, 4, 5, 6].map((k) => llamada(hallazgo({ texto_literal: 'Código: 123456 · Marca: ARGOS **$32.900**', titulo: 'Cemento ' + k })));
  const r1 = respuesta([...lectura(URL_HC, PAG_HC), ...muchos, llamada({ url: URL_HC })], 'tool_use', uso(100, 10));
  const r2 = respuesta([{ type: 'text', text: 'listo' }], 'end_turn', uso(100, 10));
  const api = apiSimulada([r1, r2]);
  const r = await I.correrTarea(TAREA, { hallazgos: 2 }, api);
  const est = r.hallazgos.map((x) => x.verificacion.estado);
  ok(est[0] === 'verificado' && est.slice(1).every((x) => x === 'repetido' || x === 'límite'), 'el mismo precio de la misma página cuenta una vez; luego, repetido o límite', est);
  const ult = api.pedidos[1].messages[2].content.slice(-1)[0];
  ok(ult.is_error === true && /^Entrada inválida/.test(ult.content), 'entrada inválida → resultado con error para que la IA corrija');

  const cfg = { modoDominios: 'permitir', dominiosPermitidos: ['ferreteriaelpuerto.com.co'] };
  const r3 = respuesta([...lectura(URL_HC, PAG_HC), llamada(hallazgo())], 'tool_use', uso(100, 10));
  const fuera = await I.correrTarea(TAREA, cfg, apiSimulada([r3, r2]));
  ok(fuera.hallazgos[0].verificacion.estado === 'dominio', 'un precio de un sitio fuera de los permitidos se descarta aunque esté en la página');
  ok(I.clasificar(fuera.hallazgos[0], { insumo: CEMENTO, catalogo: CATALOGO, ciudades: CIUDADES, tarea: TAREA }).destino === 'descartado', '… y su destino es descartado');

  const r4 = respuesta([...lectura('https://www.argos.com.co/lista.pdf', '', { pdf: true }), llamada(hallazgo({ url: 'https://www.argos.com.co/lista.pdf', texto_literal: 'Cemento gris uso general 50 kg $ 32.900', titulo: 'Cemento gris uso general 50 kg' }))], 'tool_use', uso(100, 10));
  const sinPdf = await I.correrTarea(TAREA, {}, apiSimulada([r4, r2]));
  ok(sinPdf.hallazgos[0].verificacion.estado === 'pendiente', 'PDF sin lector de texto → pendiente');
  const conPdf = await I.correrTarea(TAREA, {}, Object.assign(apiSimulada([r4, r2]), { textoPdf: async () => 'Lista de precios Argos\nCemento gris uso general 50 kg $ 32.900\nVigente desde octubre' }));
  ok(conPdf.hallazgos[0].verificacion.estado === 'verificado', 'PDF con su texto extraído en el equipo → verificado contra ese texto');
}

seccion('Respaldo de modelo y costo por intento');
{
  const u = Object.assign(uso(1000, 200, 0, 0, 2), { iterations: [
    { type: 'message', model: 'claude-opus-5-5', input_tokens: 1000, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    { type: 'fallback_message', model: 'claude-opus-5', input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  ] });
  const c = I.costo(u, 'claude-opus-5-5', 'claude-opus-5');
  ok(cerca(c.usd, 1000 * 4 / 1e6 + (1000 * 5 + 200 * 25) / 1e6 + 0.02, 1e-9), 'cada intento se costea con la tarifa de su modelo, más las búsquedas', c);
  const m = respuesta([{ type: 'fallback', from: { model: 'claude-opus-5-5' }, to: { model: 'claude-opus-5' } }, { type: 'text', text: 'sin dato' }], 'end_turn', u, 'claude-opus-5');
  const r = await I.correrTarea(TAREA, {}, apiSimulada([m]));
  ok(r.servidoPor === 'claude-opus-5' && r.respaldo.length === 1 && r.respaldo[0].a === 'claude-opus-5', 'se sabe qué modelo respondió cuando actuó el respaldo');
  ok(I.costo(uso(1000000, 0), 'modelo-desconocido').aproximado === true, 'un modelo sin tarifa conocida se costea aproximado y se avisa');
  ok(I.tarifa('claude-haiku-4-5-20251001').id === 'claude-haiku-4-5' && I.tarifa('claude-opus-5').id === 'claude-opus-5' && I.tarifa('claude-opus-5-5').id === 'claude-opus-5-5',
    'tarifas: nombre con fecha, y «claude-opus-5» no se confunde con «claude-opus-5-5»');
  const c1 = I.costo(uso(10000, 2000, 5000, 20000, 3), 'claude-opus-5-5');
  ok(cerca(c1.usd, 0.139, 1e-9), 'Opus 5.5: 10k entrada, 5k escritura de caché, 20k lectura de caché, 2k salida y 3 búsquedas = USD 0,139', c1.usd);
  ok(cerca(I.costo(uso(10000, 2000, 5000, 20000, 3), 'claude-haiku-4-5').usd, (10000 * 1 + 5000 * 1.25 + 20000 * 0.1 + 2000 * 5) / 1e6 + 0.03, 1e-9), 'Haiku 4.5 con su tarifa');
}

/* ════════════════════════  EMPAREJAMIENTO Y DESTINO  ════════════════════════ */
seccion('Emparejamiento con el catálogo y destino de cada hallazgo (§7.2)');
{
  const P = [pagina(URL_HC, PAG_HC)];
  const ctxC = { insumo: CEMENTO, catalogo: CATALOGO, ciudades: CIUDADES, vinculos: [], tarea: TAREA };
  const una = (entrada, paginas = P, c = ctxC) => {
    const h = I.validarEntrada(hallazgo(entrada)).h;
    return I.clasificar({ h, verificacion: I.verificar(h, paginas) }, c);
  };
  ok(una({}).destino === 'observación', 'el producto buscado, verificado y sin dudas → observación');
  const art = [pagina(URL_HC, PAG_HC.replace('# Cemento Gris Uso General 50 kg Argos', '# Cemento Gris ART 50 kg Argos'))];
  const rArt = una({ titulo: 'Cemento Gris ART 50 kg Argos', texto_literal: 'Cemento Gris ART 50 kg Argos\n\nCódigo: 123456 · Marca: ARGOS\n\n**$32.900**' }, art);
  ok(rArt.destino === 'por revisar' && rArt.emparejamiento.sugerido === 'G02-0004' && /ART/.test(rArt.motivo), 'cemento ART cuando se buscaba UG → por revisar, y sugiere el insumo ART', rArt.emparejamiento);
  const rBlanco = una({ titulo: 'Cemento blanco Argos 25 kg', presentacion: 'bulto de 25 kg', texto_literal: 'Cemento Gris Uso General 50 kg Argos\n\nCódigo: 123456 · Marca: ARGOS\n\n**$32.900**' });
  ok(rBlanco.destino === 'por revisar' && rBlanco.emparejamiento.estado === 'otro' && rBlanco.emparejamiento.sugerido === 'G02-0002', 'cemento blanco cuando se buscaba gris → «es otro insumo», sugiere el cemento blanco', rBlanco.emparejamiento);
  const pintura = [pagina('https://tienda.com/pintura', 'Pintura epóxica bicomponente industrial gris x galón\n\nPrecio $ 389.000')];
  const rNuevo = una({ url: 'https://tienda.com/pintura', titulo: 'Pintura epóxica bicomponente industrial gris x galón', texto_literal: 'Pintura epóxica bicomponente industrial gris x galón\n\nPrecio $ 389.000', precio: 389000, unidad_publicada: 'galón', presentacion: '' }, pintura,
    Object.assign({}, ctxC, { catalogo: [CEMENTO, CATALOGO.find((i) => i.id === 'G02-0002')] }));
  ok(rNuevo.destino === 'nuevo insumo', 'un producto que no se parece a nada del catálogo → bandeja de nuevos insumos', rNuevo);
  const lejos = [pagina(URL_HC, 'Cemento Gris Uso General 50 kg Argos\n' + 'texto '.repeat(400) + '\nOferta del día: $32.900')];
  const rLejos = una({ texto_literal: 'Oferta del día: $32.900' }, lejos);
  ok(rLejos.destino === 'por revisar' && /no aparece cerca/.test(rLejos.motivo), 'el nombre del producto lejos del precio en la página → por revisar', rLejos.motivo);
  const rCiudad = una({ ciudad: 'Leticia' });
  ok(rCiudad.destino === 'por revisar' && /Leticia/.test(rCiudad.motivo), 'una ciudad que no está en la lista → por revisar, no se toma como nacional');
  const rNac = una({ ciudad: '' });
  ok(rNac.destino === 'observación' && rNac.captura.ciudad === null && rNac.captura.alcance === 'nacional', 'sin ciudad en la página → precio de alcance nacional');
  const tachado = [pagina(URL_HC, PAG_HC.replace('**$32.900**', 'Antes $40.000 Ahora $32.900'))];
  const rAnt = una({ texto_literal: 'Marca: ARGOS\n\nAntes $40.000 Ahora $32.900', precio: 40000 }, tachado);
  ok(rAnt.destino === 'por revisar' && /tachado/.test(rAnt.motivo), 'si la IA tomó el precio tachado («antes») → por revisar', rAnt.motivo);
  const rProm = una({ texto_literal: 'Marca: ARGOS\n\nAntes $40.000 Ahora $32.900' }, tachado);
  ok(rProm.destino === 'observación' && rProm.captura.tipoPrecio === 'promoción', 'el precio vigente de una oferta → observación de promoción (fuera del recomendado por defecto)');
  const vinc = (estado) => Object.assign({}, ctxC, { vinculos: [{ claveUrl: N.claveUrl(URL_HC), estado }] });
  const rRech = una({}, P, vinc('rechazado'));
  ok(rRech.destino === 'descartado' && /no corresponde/.test(rRech.motivo), 'página que una persona rechazó para este insumo → descartado');
  const corto = [pagina(URL_HC, 'Bulto gris Argos\n\n**$32.900**')];
  const rCorto = una({ titulo: 'Bulto gris Argos', texto_literal: 'Bulto gris Argos\n\n**$32.900**' }, corto);
  const rConf = una({ titulo: 'Bulto gris Argos', texto_literal: 'Bulto gris Argos\n\n**$32.900**' }, corto, vinc('confirmado'));
  ok(rCorto.destino === 'por revisar' && rConf.destino === 'observación', 'un título corto es dudoso; si la página ya la confirmó una persona para el insumo → observación');
  const rPend = una({ url: URL_SIN_LEER });
  ok(rPend.destino === 'pendiente', 'sin página leída → bandeja de pendientes, con el enlace para revisarla');
}

/* ════════════════════════  COSTO, CACHÉ Y PRIORIDAD  ════════════════════════ */
seccion('Estimación antes de ejecutar y tope mensual');
{
  const e0 = I.estimar(100, {}, []);
  ok(e0.base === 'supuesto' && e0.tareas === 100 && e0.usd > 0 && e0.maximo > e0.usd, 'sin historia: estimación con un supuesto por tarea y un máximo (USD ' + e0.usd + ' a ' + e0.maximo + ')');
  const hist = [0.05, 0.06, 0.07, 0.08, 0.09].map((usd) => ({ modelo: 'claude-opus-5-5', usd, solicitudes: 3, busquedas: 2 }));
  const e1 = I.estimar(10, {}, hist);
  ok(e1.base === 'historia' && cerca(e1.usd, 0.7, 1e-9) && e1.solicitudes === 30 && e1.busquedas === 20, 'con 5 tareas del mismo modelo: promedio real × tareas (USD 0,70 para 10)');
  ok(I.estimar(10, { modelo: 'claude-haiku-4-5' }, hist).base === 'supuesto', 'la historia de otro modelo no se usa');
  ok(I.estimar(10, { modelo: 'claude-haiku-4-5' }, []).usd < I.estimar(10, {}, []).usd, 'Haiku 4.5 se estima más barato que Opus 5.5');
  ok(I.tareasQueCaben(1, e1) === Math.floor(1 / (e1.maximo / 10)) && I.tareasQueCaben(0, e1) === 0, 'cuántas tareas caben en lo que queda del tope');
}

seccion('Caché por insumo, ciudad y semana · prioridad por peso en el presupuesto');
{
  ok(I.semanaISO('2026-10-04') === '2026-W40' && I.semanaISO('2026-10-05') === '2026-W41', 'semana ISO: el domingo 4 de octubre es la 40 y el lunes 5 la 41');
  ok(I.semanaISO('2027-01-01') === '2026-W53' && I.semanaISO('2026-01-01') === '2026-W01', 'semana ISO en el cambio de año (2026 tiene 53 semanas)');
  ok(I.claveCache('G02-0001', '05001', '2026-10-04') === I.claveCache('G02-0001', '05001', '2026-09-28') && I.claveCache('G02-0001', '05001', '2026-10-04') !== I.claveCache('G02-0001', '05001', '2026-10-05'),
    'la misma semana reutiliza la búsqueda; la siguiente busca de nuevo');
  ok(I.investigable(CEMENTO) && !I.investigable(CATALOGO.find((i) => i.categoriaArken === 'Mano de Obra')) && !I.investigable(CATALOGO.find((i) => i.investigable === false)),
    'no se investiga la mano de obra (sale de la calculadora laboral) ni lo no investigable');
  const tareas = [{ insumoId: 'a', ciudad: '05001' }, { insumoId: 'b', ciudad: '05001' }, { insumoId: 'c', ciudad: '05001' }, { insumoId: 'd', ciudad: '05001' }];
  const pesos = new Map([['a', { clase: 'C', valor: 10 }], ['b', { clase: 'A', valor: 500 }], ['c', { clase: 'A', valor: 900 }]]);
  const ultimas = new Map([['d|05001', '2026-01-01']]);
  ok(json(I.priorizar(tareas, pesos, ultimas).map((t) => t.insumoId)) === json(['c', 'b', 'a', 'd']), 'primero la clase A de mayor valor, luego B y C, y al final lo que no tiene peso');
}

seccion('Registro por cambios: cada página del Investigador es su propia serie');
{
  const base = { insumoId: 'G02-0001', fuenteId: 'investigador-ia', ciudad: '05001', presentacion: { cantidad: 50, unidad: 'KG' }, precioPublicado: 32900, incluyeIva: true, unidadPublicada: 'BTO', metodo: 'ia', fechaCaptura: '2026-10-01' };
  const previa = Object.assign({ id: 'o1', url: URL_HC }, base);
  const otraPagina = Object.assign({}, base, { url: URL_FE, fechaCaptura: '2026-10-04' });
  const mismaPagina = Object.assign({}, base, { url: URL_HC + '?utm_source=x', fechaCaptura: '2026-10-04' });
  ok(N.Observaciones.comparar(otraPagina, [previa]).accion === 'nueva', 'el mismo precio en otro sitio es una observación nueva (no se funde)');
  ok(N.Observaciones.comparar(mismaPagina, [previa]).accion === 'fundir', 'el mismo precio en la misma página se funde con la anterior (registro por cambios)');
  const fi = N.Consolidacion.fuenteIndependiente;
  ok(fi(Object.assign({}, base, { url: URL_HC })) !== fi(Object.assign({}, base, { url: URL_FE })) && fi(Object.assign({}, base, { url: URL_HC })) === fi(Object.assign({}, base, { url: 'https://homecenter.com.co/otro' })),
    'para contar fuentes distintas, cada sitio (dominio) es una fuente');
}

console.log('\n' + (fallas ? `✖ ${fallas} de ${pruebas} comprobaciones fallaron.` : `${pruebas} de ${pruebas} comprobaciones bien.`));
process.exit(fallas ? 1 : 0);
