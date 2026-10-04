// Sondeo exploratorio de fuentes candidatas (rama desechable, no va al programa).
// Lee robots.txt, la página principal, los términos de uso y una muestra de datos de cada
// candidata, respetando robots.txt, con un agente identificado y pausas por dominio.
// Uso: node herramientas/sondeo-fuentes.mjs [salida]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const SALIDA = process.argv[2] || 'salida-sondeo';
mkdirSync(SALIDA, { recursive: true });

const AGENTE = 'ARKEN-PRECIOS/0.3 (+https://github.com/aboteroproyectos/arken; prueba tecnica de fuentes)';
const TOKEN_AGENTE = 'arken-precios';
const PAUSA_MS = 2500;
const ultimo = new Map();
const robots = new Map();
let n = 0;

const recorte = (t, m) => (String(t).length > m ? String(t).slice(0, m) + ' […]' : String(t));
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
function titulo(t) { console.log('\n' + '═'.repeat(100) + '\n■ ' + t + '\n' + '═'.repeat(100)); }
function guardar(nombre, datos) {
  const f = join(SALIDA, String(++n).padStart(3, '0') + '-' + nombre.replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80));
  writeFileSync(f, datos);
  return f;
}

/* robots.txt (RFC 9309, versión corta: grupos, allow/disallow, comodines, coincidencia más larga) */
function leerRobots(texto) {
  const grupos = [];
  let actual = null, ultimoFueAgente = false;
  for (const linea0 of String(texto).split(/\r?\n/)) {
    const linea = linea0.replace(/#.*$/, '').trim();
    const m = /^([a-zA-Z-]+)\s*:\s*(.*)$/.exec(linea);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') {
      if (!actual || !ultimoFueAgente) { actual = { agentes: [], reglas: [], demora: null }; grupos.push(actual); }
      actual.agentes.push(v.toLowerCase());
      ultimoFueAgente = true;
    } else {
      ultimoFueAgente = false;
      if (!actual) continue;
      if (k === 'allow' || k === 'disallow') actual.reglas.push({ permite: k === 'allow', ruta: v });
      else if (k === 'crawl-delay') actual.demora = Number(v) || null;
    }
  }
  return grupos;
}
function grupoPara(grupos) {
  const propio = grupos.filter((g) => g.agentes.some((a) => a !== '*' && TOKEN_AGENTE.startsWith(a)));
  if (propio.length) return propio;
  return grupos.filter((g) => g.agentes.includes('*'));
}
function coincide(ruta, patron) {
  if (!patron) return -1;
  const fin = patron.endsWith('$');
  const p = (fin ? patron.slice(0, -1) : patron).split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  const re = new RegExp('^' + p + (fin ? '$' : ''));
  return re.test(ruta) ? patron.length : -1;
}
function permitido(grupos, url) {
  const u = new URL(url);
  const ruta = u.pathname + u.search;
  let mejor = { largo: -1, permite: true };
  for (const g of grupoPara(grupos)) for (const r of g.reglas) {
    if (!r.permite && r.ruta === '') continue;
    const l = coincide(ruta, r.ruta);
    if (l > mejor.largo || (l === mejor.largo && r.permite)) mejor = { largo: l, permite: r.permite, regla: (r.permite ? 'Allow: ' : 'Disallow: ') + r.ruta };
  }
  return mejor;
}

async function traer(url, o = {}) {
  const u = new URL(url);
  const dominio = u.host;
  const espera = (ultimo.get(dominio) || 0) + PAUSA_MS - Date.now();
  if (espera > 0) await pausa(espera);
  ultimo.set(dominio, Date.now());
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), o.tiempo || 45000);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': AGENTE, Accept: o.accept || '*/*', 'Accept-Language': 'es-CO,es;q=0.9' }, redirect: 'follow', signal: ctl.signal });
    const max = o.max || 20e6;
    const partes = [];
    let total = 0;
    const lector = r.body ? r.body.getReader() : null;
    if (lector) {
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        total += value.length;
        if (total > max) { partes.push(value.slice(0, value.length - (total - max))); ctl.abort(); break; }
        partes.push(value);
      }
    }
    const bytes = Buffer.concat(partes.map((p) => Buffer.from(p)));
    return { ok: r.ok, status: r.status, final: r.url, tipo: r.headers.get('content-type') || '', bytes, cortado: total > max, cabeceras: Object.fromEntries(r.headers) };
  } catch (e) {
    return { ok: false, status: 0, error: String((e && e.cause && e.cause.code) || (e && e.message) || e) };
  } finally {
    clearTimeout(t);
  }
}

async function robotsDe(url) {
  const base = new URL(url).origin;
  if (robots.has(base)) return robots.get(base);
  const r = await traer(base + '/robots.txt', { max: 500000 });
  const texto = r.ok ? r.bytes.toString('utf8') : '';
  const info = { status: r.status, error: r.error, texto, grupos: r.ok ? leerRobots(texto) : [] };
  robots.set(base, info);
  return info;
}

async function traerRespetando(url, o) {
  const rb = await robotsDe(url);
  if (rb.status >= 500 || (rb.status === 0)) return { ok: false, status: 0, error: 'robots.txt no disponible (' + (rb.error || rb.status) + '): no se lee' };
  const p = permitido(rb.grupos, url);
  if (!p.permite) return { ok: false, status: 0, error: 'bloqueado por robots.txt (' + p.regla + ')' };
  return traer(url, o);
}

function textoDeHtml(h) {
  return String(h)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>|<\/div>|<\/tr>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú').replace(/&ntilde;/g, 'ñ')
    .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
}
function enlaces(h, base) {
  const out = [];
  const re = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(h))) {
    try { out.push({ url: new URL(m[1].replace(/&amp;/g, '&'), base).href, texto: textoDeHtml(m[2]).slice(0, 120) }); } catch {}
  }
  return out;
}
const CLAVES_TERMINOS = /t[ée]rminos|condiciones|aviso legal|uso del sitio|pol[ií]tica de uso|legal/i;
const CLAVES_LECTURA = /robot|automatiz|scrap|rastre|ara[ñn]a|crawler|extrae|extracci|miner[ií]a de datos|copiar|copia |reproduc|comercial|propiedad intelectual|licencia|creative commons|cc by|datos abiertos|prohib|sin autorizaci|consentimiento/i;

async function verRobots(url) {
  const rb = await robotsDe(url);
  console.log('robots.txt de ' + new URL(url).origin + ' → HTTP ' + (rb.status || rb.error));
  if (rb.texto) {
    console.log(recorte(rb.texto, 5000));
    guardar('robots-' + new URL(url).host + '.txt', rb.texto);
  }
  return rb;
}

async function verPagina(url, o = {}) {
  const r = await traerRespetando(url, { accept: 'text/html,*/*' });
  if (!r.ok) { console.log('✖ ' + url + ' → ' + (r.error || 'HTTP ' + r.status)); return null; }
  const html = r.bytes.toString('utf8');
  guardar('pagina-' + new URL(url).host + '.html', html);
  const t = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  console.log('✔ ' + url + ' → HTTP ' + r.status + ' · ' + r.tipo + ' · ' + r.bytes.length + ' bytes · final ' + r.final);
  console.log('  título: ' + (t ? textoDeHtml(t[1]) : '—'));
  const pistas = [];
  if (/vtex/i.test(html)) pistas.push('vtex');
  if (/cdn\.shopify|Shopify\.theme/i.test(html)) pistas.push('shopify');
  if (/woocommerce|wp-content/i.test(html)) pistas.push('wordpress/woocommerce');
  if (/__NEXT_DATA__/.test(html)) pistas.push('next.js');
  if (/magento/i.test(html)) pistas.push('magento');
  if (/hybris|\/_ui\//i.test(html)) pistas.push('sap-commerce');
  if (/application\/ld\+json/i.test(html)) pistas.push('ld+json');
  if (pistas.length) console.log('  plataforma: ' + pistas.join(', '));
  const ls = enlaces(html, r.final || url);
  const terminos = ls.filter((l) => CLAVES_TERMINOS.test(l.texto) || /terminos|condiciones|legal/i.test(l.url));
  const datos = ls.filter((l) => /\.(xlsx|xls|csv|pdf|zip)(\?|$)/i.test(l.url));
  if (terminos.length) console.log('  enlaces de términos:\n' + uniq(terminos).slice(0, 12).map((l) => '    · ' + l.texto + ' → ' + l.url).join('\n'));
  if (o.datos !== false && datos.length) console.log('  enlaces a archivos (' + datos.length + '):\n' + uniq(datos).slice(0, o.maxDatos || 40).map((l) => '    · ' + l.texto + ' → ' + l.url).join('\n'));
  if (o.texto) console.log('  texto:\n' + recorte(textoDeHtml(html), o.texto));
  if (o.ldjson) {
    const blq = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((x) => x[1]);
    blq.slice(0, 3).forEach((b) => console.log('  ld+json: ' + recorte(b.replace(/\s+/g, ' '), 1500)));
  }
  return { html, enlaces: ls, terminos: uniq(terminos), datos: uniq(datos), final: r.final };
}
function uniq(l) { const s = new Set(); return l.filter((x) => (s.has(x.url) ? false : (s.add(x.url), true))); }

async function verTerminos(url) {
  const r = await traerRespetando(url, { accept: 'text/html,*/*' });
  if (!r.ok) { console.log('✖ términos ' + url + ' → ' + (r.error || 'HTTP ' + r.status)); return; }
  let texto;
  if (/pdf/i.test(r.tipo) || /\.pdf(\?|$)/i.test(url)) texto = '[PDF de ' + r.bytes.length + ' bytes]';
  else texto = textoDeHtml(r.bytes.toString('utf8'));
  guardar('terminos-' + new URL(url).host + '.txt', texto);
  console.log('✔ términos ' + url + ' → HTTP ' + r.status + ' · ' + texto.length + ' caracteres');
  const frases = texto.split(/(?<=[.;:])\s+|\n/).filter((f) => CLAVES_LECTURA.test(f)).map((f) => f.trim()).filter((f) => f.length > 20);
  console.log('  frases relevantes (' + frases.length + '):');
  frases.slice(0, 40).forEach((f) => console.log('    » ' + recorte(f, 600)));
  console.log('  comienzo:\n' + recorte(texto, 1800));
}

async function verJson(url, max) {
  const r = await traerRespetando(url, { accept: 'application/json' });
  if (!r.ok) { console.log('✖ ' + url + ' → ' + (r.error || 'HTTP ' + r.status) + (r.bytes ? ' · ' + recorte(r.bytes.toString('utf8'), 400) : '')); return null; }
  const t = r.bytes.toString('utf8');
  guardar('json-' + new URL(url).host + '.json', t);
  console.log('✔ ' + url + ' → HTTP ' + r.status + ' · ' + r.tipo + ' · ' + r.bytes.length + ' bytes');
  try { const j = JSON.parse(t); console.log(recorte(JSON.stringify(j, null, 1), max || 5000)); return j; }
  catch { console.log(recorte(t, 1500)); return null; }
}

function describirLibro(bytes, nombre) {
  try {
    const wb = XLSX.read(bytes, { type: 'buffer', cellDates: false });
    console.log('  libro ' + nombre + ': hojas ' + wb.SheetNames.length + ' → ' + wb.SheetNames.slice(0, 30).join(' | '));
    wb.SheetNames.slice(0, 6).forEach((h) => {
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, raw: true, defval: '' });
      console.log('  ── hoja «' + h + '» (' + filas.length + ' filas, rango ' + (wb.Sheets[h]['!ref'] || '—') + ')');
      filas.slice(0, 22).forEach((f, i) => console.log('    ' + String(i + 1).padStart(3) + ' │ ' + recorte(f.map((c) => String(c).replace(/\s+/g, ' ').trim()).join(' │ '), 400)));
      // Una muestra del medio para ver los datos, no solo los títulos
      if (filas.length > 60) filas.slice(Math.floor(filas.length / 2), Math.floor(filas.length / 2) + 6).forEach((f, i) => console.log('    ' + String(Math.floor(filas.length / 2) + i + 1).padStart(3) + ' │ ' + recorte(f.map((c) => String(c).replace(/\s+/g, ' ').trim()).join(' │ '), 400)));
    });
  } catch (e) { console.log('  ✖ no se pudo leer el libro: ' + e.message); }
}

async function verArchivo(url, max) {
  const r = await traerRespetando(url, { max: max || 25e6 });
  if (!r.ok) { console.log('✖ ' + url + ' → ' + (r.error || 'HTTP ' + r.status)); return; }
  guardar('archivo-' + url.split('/').pop().slice(0, 60), r.bytes);
  console.log('✔ ' + url + ' → HTTP ' + r.status + ' · ' + r.tipo + ' · ' + r.bytes.length + ' bytes' + (r.cortado ? ' (cortado)' : '') + ' · última modificación ' + (r.cabeceras['last-modified'] || '—'));
  if (/\.(xlsx|xls)(\?|$)/i.test(url) || /sheet|excel/i.test(r.tipo)) describirLibro(r.bytes, url.split('/').pop());
  else if (/\.pdf(\?|$)/i.test(url) || /pdf/i.test(r.tipo)) console.log('  PDF (' + r.bytes.length + ' bytes); cabecera ' + r.bytes.slice(0, 8).toString('latin1'));
  else console.log(recorte(r.bytes.toString('utf8'), 1500));
}

/* ───────────── Candidatas ───────────── */
const TIENDAS = [
  { home: 'https://www.homecenter.com.co', busqueda: ['https://www.homecenter.com.co/homecenter-co/search?Ntt=cemento%20gris', 'https://www.homecenter.com.co/homecenter-co/product/13846/cemento-argos-gris-50kg/13846/'] },
  { home: 'https://www.easy.com.co', busqueda: ['https://www.easy.com.co/cemento-argos-portland-tipo-i-x-50-kg/p'], vtex: true },
  { home: 'https://corona.co', busqueda: ['https://corona.co/productos/cementos/cemento-alion-gris-de-uso-general-50-kg/p/CEMCUGB50'] },
  { home: 'https://www.metropoliscenter.com.co', busqueda: ['https://www.metropoliscenter.com.co/p/cemento-gris-x-50-kg-argos/'] },
  { home: 'https://www.comaderas.com', busqueda: ['https://www.comaderas.com/materiales-de-construccion/obra-gruesa/cemento'] },
  { home: 'https://mayoristademateriales.com', busqueda: ['https://mayoristademateriales.com/producto/cemento-gris-50-kilos/'] },
  { home: 'https://aldiaferreteria.com', busqueda: ['https://aldiaferreteria.com/cementos-concretos-y-morteros/cementos'] },
  { home: 'https://ferreterialacasitaroja.com', busqueda: ['https://ferreterialacasitaroja.com/product/cemento-gris-uso-general-argos-50kg/'] },
];

async function sondearTienda(t) {
  titulo('TIENDA ' + t.home);
  await verRobots(t.home);
  const p = await verPagina(t.home, { datos: false });
  if (p) for (const l of p.terminos.slice(0, 3)) await verTerminos(l.url);
  for (const b of t.busqueda) await verPagina(b, { datos: false, ldjson: true, texto: 1200 });
  const html = p ? p.html : '';
  if (t.vtex || /vtex/i.test(html)) await verJson(t.home + '/api/catalog_system/pub/products/search?ft=cemento%20gris&_from=0&_to=1', 3500);
  if (/woocommerce|wp-content/i.test(html)) {
    await verJson(t.home + '/wp-json/wc/store/v1/products?search=cemento&per_page=2', 3500);
  }
  if (/cdn\.shopify|Shopify\.theme/i.test(html)) await verJson(t.home + '/products.json?limit=2', 3000);
}

async function sondearSocrata() {
  titulo('DATOS ABIERTOS · datos.gov.co (Socrata)');
  await verRobots('https://www.datos.gov.co');
  const p = await verPagina('https://www.datos.gov.co', { datos: false });
  if (p) for (const l of p.terminos.slice(0, 3)) await verTerminos(l.url);
  await verRobots('https://api.us.socrata.com');
  for (const q of ['precios insumos', 'precios de referencia', 'precios unitarios', 'materiales de construccion', 'listado de precios obra']) {
    const j = await verJson('https://api.us.socrata.com/api/catalog/v1?domains=www.datos.gov.co&search_context=www.datos.gov.co&limit=30&q=' + encodeURIComponent(q), 400);
    if (j && j.results) {
      console.log('  conjuntos para «' + q + '»:');
      j.results.forEach((x) => {
        const r = x.resource || {};
        console.log('    · ' + r.id + ' · ' + recorte(r.name, 110) + ' · actualizado ' + (r.data_updated_at || r.updatedAt || '—') + ' · ' + (x.classification && x.classification.domain_category || '') +
          ' · columnas: ' + recorte((r.columns_name || []).join(', '), 260));
      });
    }
  }
  for (const id of ['e839-6uct', 'ae7u-y7m2', 'qhrj-9sz9']) {
    await verJson('https://www.datos.gov.co/api/views/' + id + '.json', 2500);
    await verJson('https://www.datos.gov.co/resource/' + id + '.json?$limit=4', 2500);
  }
}

async function sondearEntidades() {
  titulo('ENTIDADES PÚBLICAS');
  await verRobots('https://www.invias.gov.co');
  const p1 = await verPagina('https://www.invias.gov.co/publicaciones/4149/analisis-de-precios-unitarios-apu-regionalizados-de-referencia/', { maxDatos: 60 });
  await verPagina('https://www.invias.gov.co/index.php/informacion-institucional/hechos-de-transparencia/analisis-de-precio-unitarios', { maxDatos: 60 });
  const pi = await verPagina('https://www.invias.gov.co', { datos: false });
  if (pi) for (const l of pi.terminos.slice(0, 2)) await verTerminos(l.url);
  if (p1) {
    const xl = p1.datos.filter((l) => /\.(xlsx|xls)(\?|$)/i.test(l.url));
    const ant = xl.filter((l) => /antioquia/i.test(l.url + ' ' + l.texto));
    for (const l of (ant.length ? ant : xl).slice(0, 2)) await verArchivo(l.url, 30e6);
  }

  await verRobots('http://secretariainfraestructura.antioquia.gov.co');
  const p2 = await verPagina('http://secretariainfraestructura.antioquia.gov.co/descargas/', { maxDatos: 60, texto: 1500 });
  if (p2) {
    const dirs = p2.enlaces.filter((l) => /dir=/i.test(l.url)).slice(0, 40);
    console.log('  carpetas:\n' + dirs.map((l) => '    · ' + l.texto + ' → ' + l.url).join('\n'));
    const precio = dirs.filter((l) => /precio|apu|base/i.test(l.url + ' ' + l.texto)).slice(0, 3);
    for (const d of precio) {
      const q = await verPagina(d.url, { maxDatos: 60 });
      if (q) {
        const sub = q.enlaces.filter((l) => /dir=/i.test(l.url) && /2026|2025/.test(l.url + l.texto)).slice(0, 2);
        for (const s of sub) await verPagina(s.url, { maxDatos: 60 });
      }
    }
  }
  await verRobots('https://www.antioquia.gov.co');
  const pa = await verPagina('https://www.antioquia.gov.co', { datos: false });
  if (pa) for (const l of pa.terminos.slice(0, 2)) await verTerminos(l.url);

  await verRobots('https://www.valledelcauca.gov.co');
  await verPagina('https://www.valledelcauca.gov.co/infraestructura/publicaciones/68057/gobernacion-entrega-listado-de-precios-de-referencia-para-contratacion-de-obras-civiles/', { maxDatos: 30 });
  await verRobots('http://www.risaralda.gov.co');
  await verPagina('http://www.risaralda.gov.co/documentos/1221/precios-unitarios/', { maxDatos: 30 });
  await verRobots('https://www.idu.gov.co');
  await verPagina('https://www.idu.gov.co/page/siipviales/economico/portafolio', { maxDatos: 30 });
}

async function sondearDane() {
  titulo('DANE · ICOCED');
  await verRobots('https://www.dane.gov.co');
  const p = await verPagina('https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-costos-de-la-construccion-de-edificaciones-icoced', { maxDatos: 40 });
  const ph = await verPagina('https://www.dane.gov.co', { datos: false });
  if (ph) for (const l of ph.terminos.slice(0, 3)) await verTerminos(l.url);
  if (p) {
    const anexos = p.datos.filter((l) => /\.xlsx?(\?|$)/i.test(l.url));
    for (const l of anexos.slice(0, 2)) await verArchivo(l.url, 30e6);
  }
}

const tareas = { tiendas: async () => { for (const t of TIENDAS) await sondearTienda(t); }, socrata: sondearSocrata, entidades: sondearEntidades, dane: sondearDane };
const pedidas = (process.env.SONDEO || 'dane,socrata,entidades,tiendas').split(',');
for (const k of pedidas) {
  try { await tareas[k](); } catch (e) { console.log('✖ ' + k + ': ' + (e.stack || e)); }
}
console.log('\nFin del sondeo. Archivos en ' + SALIDA);
