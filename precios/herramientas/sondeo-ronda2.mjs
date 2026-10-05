// Segunda ronda del sondeo (rama desechable): estructura exacta de las fuentes elegidas,
// texto completo de sus términos y archivos reducidos para las pruebas del motor.
// Uso: SONDEO=tvec|idu|icoced|tiendas node --max-http-header-size=131072 herramientas/sondeo-ronda2.mjs salida
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  XLSX, SALIDA, recorte, titulo, traerRespetando, textoDeHtml, enlaces, verRobots, verPagina, uniq,
} from './sondeo-comun.mjs';

const CLAVES = /robot|automatiz|autom[aá]tic|scrap|rastre|ara[ñn]a|spider|crawler|\bbots?\b|extrae|extracci|miner[ií]a|copiar|copia\b|reproduc|descarg|masiv|sistem[aá]tic|software|comercial|propiedad intelectual|licencia|uso personal|prohib|sin autorizaci|consentimiento previo|bases? de datos|precio|reutiliz|cita|fuente/i;

function escribir(nombre, datos) {
  writeFileSync(join(SALIDA, nombre), typeof datos === 'string' || Buffer.isBuffer(datos) ? datos : JSON.stringify(datos, null, 1));
}

async function textoDePdf(bytes) {
  const modulo = await import('pdfjs-dist/legacy/build/pdf.js');
  const pdfjs = modulo.getDocument ? modulo : modulo.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false, useSystemFonts: false }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const c = await p.getTextContent();
    paginas.push(c.items.map((x) => x.str + (x.hasEOL ? '\n' : '')).join(' '));
  }
  return paginas.join('\n\n— página —\n\n').replace(/[ \t]+/g, ' ');
}

/** Lee unos términos completos, los guarda y muestra las frases que hablan de lectura, copia o uso. */
async function terminosCompletos(url, nombre) {
  const r = await traerRespetando(url, { accept: 'text/html,application/pdf,*/*' });
  if (!r.ok) { console.log('✖ términos ' + url + ' → ' + (r.error || 'HTTP ' + r.status)); return ''; }
  let texto;
  if (/pdf/i.test(r.tipo) || /\.pdf(\?|$)/i.test(url)) {
    try { texto = await textoDePdf(r.bytes); } catch (e) { texto = '[PDF ilegible: ' + e.message + ']'; }
  } else texto = textoDeHtml(r.bytes.toString('utf8'));
  escribir('terminos-' + nombre + '.txt', 'Fuente: ' + url + '\nLeído: ' + new Date().toISOString() + '\nHTTP ' + r.status + '\n\n' + texto);
  console.log('✔ términos ' + url + ' → HTTP ' + r.status + ' · ' + texto.length + ' caracteres (guardado terminos-' + nombre + '.txt)');
  const frases = texto.split(/(?<=[.;:])\s+|\n/).map((f) => f.trim()).filter((f) => f.length > 25 && CLAVES.test(f));
  console.log('  frases relevantes (' + frases.length + '):');
  frases.slice(0, 90).forEach((f) => console.log('    » ' + recorte(f, 700)));
  return texto;
}

/** Recortes del HTML de un producto: ld+json, metadatos de precio y el contexto de cada precio visible. */
export function extractosDeProducto(html, nombre) {
  const ld = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((x) => x[1].trim());
  const productos = [];
  for (const b of ld) {
    try {
      const j = JSON.parse(b);
      const lista = [].concat(j['@graph'] || j);
      for (const o of lista) if (o && /product/i.test(String(o['@type']))) productos.push(o);
    } catch {}
  }
  const metas = [...html.matchAll(/<meta[^>]+(?:product:price|og:price|itemprop=["']price|priceCurrency)[^>]*>/gi)].map((x) => x[0]);
  const itemprops = [...html.matchAll(/<[^>]+itemprop=["'](?:price|priceCurrency|lowPrice|highPrice)["'][^>]*>/gi)].map((x) => x[0]).slice(0, 8);
  const precios = [];
  const re = /\$\s*(?:&nbsp;|\u00a0)?\s*\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?/g;
  let m;
  while ((m = re.exec(html)) && precios.length < 8) {
    precios.push(html.slice(Math.max(0, m.index - 260), m.index + 120).replace(/\s+/g, ' '));
  }
  const next = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  let nextPrecios = [];
  if (next) {
    try {
      const j = JSON.parse(next[1]);
      const visto = new Set();
      (function recorrer(o, ruta) {
        if (!o || typeof o !== 'object' || visto.has(o) || nextPrecios.length > 25) return;
        visto.add(o);
        for (const [k, v] of Object.entries(o)) {
          const r = ruta + '.' + k;
          if (/price|precio|zone|store|tienda|region|comuna|ciudad/i.test(k) && (typeof v !== 'object' || Array.isArray(v))) nextPrecios.push(r + ' = ' + recorte(JSON.stringify(v), 160));
          else if (v && typeof v === 'object') recorrer(v, r);
        }
      })(j, '');
    } catch {}
  }
  const res = { productos, metas, itemprops, precios, nextPrecios };
  escribir('producto-' + nombre + '.json', res);
  console.log('  ld+json de producto (' + productos.length + '):');
  productos.forEach((p) => console.log('    ' + recorte(JSON.stringify({ name: p.name, sku: p.sku, gtin: p.gtin13 || p.gtin, brand: p.brand, offers: p.offers }), 1500)));
  if (metas.length) console.log('  meta de precio:\n' + metas.map((x) => '    ' + recorte(x, 300)).join('\n'));
  if (itemprops.length) console.log('  itemprop:\n' + itemprops.map((x) => '    ' + recorte(x, 300)).join('\n'));
  console.log('  precios visibles en el HTML (' + precios.length + '):');
  precios.forEach((x) => console.log('    … ' + x));
  if (nextPrecios.length) console.log('  __NEXT_DATA__ con precio o ubicación:\n' + nextPrecios.map((x) => '    ' + x).join('\n'));
  return res;
}

async function json(url) {
  const r = await traerRespetando(url, { accept: 'application/json' });
  if (!r.ok) { console.log('✖ ' + url + ' → ' + (r.error || 'HTTP ' + r.status) + (r.bytes ? ' · ' + recorte(r.bytes.toString('utf8'), 500) : '')); return null; }
  console.log('✔ ' + url + ' → HTTP ' + r.status + ' · ' + r.bytes.length + ' bytes');
  try { return JSON.parse(r.bytes.toString('utf8')); } catch { console.log('  (no es JSON) ' + recorte(r.bytes.toString('utf8'), 400)); return null; }
}

/* ─────────────── datos.gov.co · Tienda Virtual del Estado Colombiano ─────────────── */
function columnas(meta) {
  return (meta.columns || []).filter((c) => !String(c.fieldName).startsWith(':')).map((c) => ({ nombre: c.name, campo: c.fieldName, tipo: c.dataTypeName, descripcion: recorte(c.description || '', 200) }));
}
function verMeta(meta) {
  console.log('  nombre: ' + meta.name + '\n  descripción: ' + recorte(meta.description || '', 600) + '\n  atribución: ' + meta.attribution + ' · licencia: ' + (meta.licenseId || '—') + ' ' + JSON.stringify(meta.license || {}) +
    '\n  filas actualizadas: ' + new Date((meta.rowsUpdatedAt || 0) * 1000).toISOString() + ' · vista: ' + new Date((meta.viewLastModified || 0) * 1000).toISOString());
  console.log('  columnas:\n' + columnas(meta).map((c) => '    · ' + c.campo + ' (' + c.tipo + ') «' + c.nombre + '» ' + c.descripcion).join('\n'));
}
async function sondearTvec() {
  titulo('datos.gov.co · TVEC (compras por ítem) y consolidado de órdenes');
  await verRobots('https://www.datos.gov.co');
  const base = 'https://www.datos.gov.co';
  const meta = await json(base + '/api/views/3hdv-smhz.json');
  if (!meta) return;
  verMeta(meta);
  escribir('tvec-items-metadatos.json', { id: meta.id, nombre: meta.name, descripcion: meta.description, atribucion: meta.attribution, licencia: meta.licenseId, license: meta.license, rowsUpdatedAt: meta.rowsUpdatedAt, columnas: columnas(meta) });
  const campos = columnas(meta).map((c) => c.campo);
  const cItem = campos.find((c) => /^item$/i.test(c)) || campos.find((c) => /item/i.test(c));
  const cFecha = campos.find((c) => /fecha/i.test(c));
  const cOrden = campos.find((c) => /orden/i.test(c));
  console.log('  campos elegidos: ítem=' + cItem + ' fecha=' + cFecha + ' orden=' + cOrden);
  const muestra = await json(base + '/resource/3hdv-smhz.json?$limit=3&$order=' + encodeURIComponent(cFecha + ' DESC'));
  if (muestra) console.log(recorte(JSON.stringify(muestra, null, 1), 3000));
  const consultas = {
    cemento: "upper(" + cItem + ") like '%CEMENTO%'",
    varilla: "upper(" + cItem + ") like '%VARILLA%'",
    tuberia: "upper(" + cItem + ") like '%TUBO%PVC%'",
    pintura: "upper(" + cItem + ") like '%PINTURA%'",
    bloque: "upper(" + cItem + ") like '%BLOQUE%'",
  };
  const filas = {};
  for (const [k, w] of Object.entries(consultas)) {
    const q = '$where=' + encodeURIComponent(w + ' AND ' + cFecha + " >= '2026-01-01'") + '&$order=' + encodeURIComponent(cFecha + ' DESC') + '&$limit=12';
    const r = await json(base + '/resource/3hdv-smhz.json?' + q);
    if (r) {
      filas[k] = r;
      console.log('  «' + k + '» (' + r.length + '):');
      r.forEach((f) => console.log('    ' + recorte(JSON.stringify(f), 600)));
    }
    const n = await json(base + '/resource/3hdv-smhz.json?$select=count(*)&$where=' + encodeURIComponent(w + ' AND ' + cFecha + " >= '2026-01-01'"));
    if (n) console.log('  filas 2026 para «' + k + '»: ' + JSON.stringify(n));
  }
  escribir('tvec-items-muestra.json', filas);
  // Consolidado de órdenes: trae la ciudad y el instrumento de cada orden
  const meta2 = await json(base + '/api/views/rgxm-mmea.json');
  if (meta2) {
    verMeta(meta2);
    escribir('tvec-ordenes-metadatos.json', { id: meta2.id, nombre: meta2.name, atribucion: meta2.attribution, licencia: meta2.licenseId, rowsUpdatedAt: meta2.rowsUpdatedAt, columnas: columnas(meta2) });
    const campos2 = columnas(meta2).map((c) => c.campo);
    const cId = campos2.find((c) => /identificador/i.test(c)) || campos2.find((c) => /orden/i.test(c));
    const ordenes = [...new Set(Object.values(filas).flat().map((f) => f[cOrden]).filter(Boolean))].slice(0, 10);
    console.log('  campo de orden en el consolidado: ' + cId + ' · órdenes a cruzar: ' + ordenes.join(', '));
    if (cId && ordenes.length) {
      const w = cId + ' in (' + ordenes.map((o) => "'" + String(o).replace(/'/g, "''") + "'").join(',') + ')';
      const r = await json(base + '/resource/rgxm-mmea.json?$where=' + encodeURIComponent(w) + '&$limit=20');
      if (r) {
        r.forEach((f) => console.log('    ' + recorte(JSON.stringify(f), 900)));
        escribir('tvec-ordenes-muestra.json', r);
      }
    }
  }
}

/* ─────────────── IDU · Base de precios de referencia ─────────────── */
export function describirLibroCompleto(wb, nombre, maxFilas) {
  const resumen = { libro: nombre, hojas: [] };
  console.log('  libro ' + nombre + ': ' + wb.SheetNames.length + ' hojas → ' + wb.SheetNames.join(' | '));
  for (const h of wb.SheetNames) {
    const s = wb.Sheets[h];
    const filas = XLSX.utils.sheet_to_json(s, { header: 1, raw: true, defval: '' });
    const llenas = filas.map((f, i) => [i, f]).filter(([, f]) => f.some((c) => String(c).trim() !== ''));
    console.log('  ── hoja «' + h + '» · ' + filas.length + ' filas (' + llenas.length + ' con datos) · rango ' + (s['!ref'] || '—') + ' · celdas combinadas ' + ((s['!merges'] || []).length));
    const mostrar = (i, f) => console.log('    ' + String(i + 1).padStart(4) + ' │ ' + recorte(f.map((c, j) => (String(c).trim() === '' ? '' : XLSX.utils.encode_col(j) + '=' + String(c).replace(/\s+/g, ' ').trim())).filter(Boolean).join(' │ '), 520));
    llenas.slice(0, maxFilas).forEach(([i, f]) => mostrar(i, f));
    if (llenas.length > maxFilas + 10) {
      console.log('    …');
      llenas.slice(Math.floor(llenas.length / 2), Math.floor(llenas.length / 2) + 5).forEach(([i, f]) => mostrar(i, f));
      console.log('    …');
      llenas.slice(-5).forEach(([i, f]) => mostrar(i, f));
    }
    resumen.hojas.push({ hoja: h, filas: filas.length, conDatos: llenas.length, rango: s['!ref'] });
  }
  return resumen;
}
/** Libro reducido: conserva las primeras filas, unas del medio y las últimas de cada hoja, en sus mismas posiciones. */
export function libroReducido(wb, primeras, medio, ultimas, hojas) {
  const nuevo = XLSX.utils.book_new();
  for (const h of hojas || wb.SheetNames) {
    const s = wb.Sheets[h];
    if (!s || !s['!ref']) continue;
    const rango = XLSX.utils.decode_range(s['!ref']);
    const total = rango.e.r + 1;
    const conservar = new Set();
    for (let r = 0; r < Math.min(primeras, total); r++) conservar.add(r);
    const mitad = Math.floor(total / 2);
    for (let r = mitad; r < Math.min(mitad + medio, total); r++) conservar.add(r);
    for (let r = Math.max(0, total - ultimas); r < total; r++) conservar.add(r);
    const ns = {};
    let maxC = 0;
    for (const dir of Object.keys(s)) {
      if (dir[0] === '!') continue;
      const c = XLSX.utils.decode_cell(dir);
      if (!conservar.has(c.r)) continue;
      ns[dir] = { t: s[dir].t, v: s[dir].v, w: s[dir].w, z: s[dir].z };
      maxC = Math.max(maxC, c.c);
    }
    ns['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rango.e.r, c: Math.max(maxC, 0) } });
    if (s['!merges']) ns['!merges'] = s["!merges"].filter((m) => conservar.has(m.s.r));
    XLSX.utils.book_append_sheet(nuevo, ns, h.slice(0, 31));
  }
  return XLSX.write(nuevo, { type: 'buffer', bookType: 'xlsx', compression: true });
}
async function sondearIdu() {
  titulo('IDU · portafolio de precios unitarios de referencia');
  await verRobots('https://www.idu.gov.co');
  await terminosCompletos('https://www.idu.gov.co/Archivos_Portal/Home/footer/DU-TI-03_CONDICIONES_DE_USO_Y_POLITICAS_DE_PRIVACIDAD_DE_LA_2.pdf', 'idu');
  const p = await verPagina('https://www.idu.gov.co/page/siipviales/economico/portafolio', { maxDatos: 12 });
  if (!p) return;
  const xl = p.datos.filter((l) => /\.xlsx?(\?|$)/i.test(l.url));
  escribir('idu-enlaces.json', xl);
  // El HTML alrededor de los enlaces, para saber cómo reconocer el vigente sin depender del nombre
  const html = p.html;
  const i = html.indexOf('Visor_BPR');
  if (i > 0) console.log('  HTML alrededor del primer enlace:\n    ' + recorte(html.slice(Math.max(0, i - 1500), i + 400).replace(/\s+/g, ' '), 2000));
  const vigente = xl.find((l) => /precios unitarios de referencia/i.test(l.texto)) || xl.find((l) => /BPR/i.test(l.url));
  if (!vigente) { console.log('  ✖ no se encontró el libro vigente'); return; }
  const r = await traerRespetando(vigente.url, { max: 60e6 });
  if (!r.ok) { console.log('✖ ' + vigente.url + ' → ' + (r.error || r.status)); return; }
  console.log('✔ ' + vigente.url + ' → ' + r.bytes.length + ' bytes · ' + r.tipo + ' · última modificación ' + (r.cabeceras['last-modified'] || '—'));
  const wb = XLSX.read(r.bytes, { type: 'buffer', cellDates: false, cellNF: true });
  const resumen = describirLibroCompleto(wb, vigente.url.split('/').pop(), 45);
  escribir('idu-libro-resumen.json', { url: vigente.url, texto: vigente.texto, bytes: r.bytes.length, ultimaModificacion: r.cabeceras['last-modified'], ...resumen });
  escribir('idu-reducido.xlsx', libroReducido(wb, 40, 15, 8));
}

/* ─────────────── DANE · ICOCED ─────────────── */
async function sondearIcoced() {
  titulo('DANE · ICOCED, términos completos y anexo reducido');
  await verRobots('https://www.dane.gov.co');
  await terminosCompletos('https://www.dane.gov.co/index.php/terrminos-y-condiciones-dane', 'dane');
  const p = await verPagina('https://www.dane.gov.co/index.php/estadisticas-por-tema/precios-y-costos/indice-de-costos-de-la-construccion-de-edificaciones-icoced', { maxDatos: 20 });
  if (!p) return;
  escribir('icoced-enlaces.json', p.datos);
  const html = p.html;
  const i = html.indexOf('anex-ICOCED');
  if (i > 0) console.log('  HTML alrededor del enlace del anexo:\n    ' + recorte(html.slice(Math.max(0, i - 1200), i + 300).replace(/\s+/g, ' '), 1600));
  const fecha = /Fecha de publicaci[oó]n[^<]{0,80}/i.exec(textoDeHtml(html));
  if (fecha) console.log('  ' + fecha[0]);
  const anexo = p.datos.find((l) => /anex-ICOCED/i.test(l.url));
  if (!anexo) { console.log('  ✖ no se encontró el anexo'); return; }
  const r = await traerRespetando(anexo.url, { max: 40e6 });
  if (!r.ok) { console.log('✖ ' + anexo.url + ' → ' + (r.error || r.status)); return; }
  console.log('✔ ' + anexo.url + ' → ' + r.bytes.length + ' bytes · última modificación ' + (r.cabeceras['last-modified'] || '—'));
  const wb = XLSX.read(r.bytes, { type: 'buffer', cellDates: false });
  // Índice completo
  const indice = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
  console.log('  ── Índice completo');
  indice.forEach((f, k) => { const v = f.filter((c) => String(c).trim() !== ''); if (v.length) console.log('    ' + String(k + 1).padStart(3) + ' │ ' + v.join(' │ ')); });
  // Encabezados y últimas filas de cada anexo
  for (const h of wb.SheetNames.slice(1)) {
    const filas = XLSX.utils.sheet_to_json(wb.Sheets[h], { header: 1, raw: true, defval: '' });
    const llenas = filas.map((f, k) => [k, f]).filter(([, f]) => f.some((c) => String(c).trim() !== ''));
    console.log('  ── hoja «' + h + '» · ' + filas.length + ' filas · rango ' + wb.Sheets[h]['!ref'] + ' · combinadas ' + ((wb.Sheets[h]['!merges'] || []).length));
    const mostrar = ([k, f]) => console.log('    ' + String(k + 1).padStart(3) + ' │ ' + recorte(f.map((c, j) => (String(c).trim() === '' ? '' : XLSX.utils.encode_col(j) + '=' + String(c).replace(/\s+/g, ' ').trim())).filter(Boolean).join(' │ '), 900));
    llenas.slice(0, 12).forEach(mostrar);
    console.log('    …');
    llenas.slice(-9).forEach(mostrar);
  }
  escribir('icoced-reducido.xlsx', libroReducido(wb, 13, 0, 14));
  escribir('icoced-resumen.json', { url: anexo.url, bytes: r.bytes.length, ultimaModificacion: r.cabeceras['last-modified'], hojas: wb.SheetNames });
}

/* ─────────────── Tiendas en línea ─────────────── */
async function producto(url, nombre) {
  const r = await traerRespetando(url, { accept: 'text/html' });
  if (!r.ok) { console.log('✖ ' + url + ' → ' + (r.error || 'HTTP ' + r.status)); return null; }
  console.log('✔ producto ' + url + ' → HTTP ' + r.status + ' · ' + r.bytes.length + ' bytes · final ' + r.final);
  const html = r.bytes.toString('utf8');
  return { html, ...extractosDeProducto(html, nombre) };
}
function resumenVtex(lista) {
  return (lista || []).map((p) => ({
    productId: p.productId, productName: p.productName, brand: p.brand, link: p.link, categories: p.categories && p.categories[0],
    items: (p.items || []).slice(0, 2).map((it) => ({
      itemId: it.itemId, name: it.name, measurementUnit: it.measurementUnit, unitMultiplier: it.unitMultiplier, ean: it.ean,
      sellers: (it.sellers || []).slice(0, 2).map((s) => ({ sellerId: s.sellerId, sellerName: s.sellerName, sellerDefault: s.sellerDefault,
        oferta: s.commertialOffer && { Price: s.commertialOffer.Price, ListPrice: s.commertialOffer.ListPrice, PriceWithoutDiscount: s.commertialOffer.PriceWithoutDiscount, Tax: s.commertialOffer.Tax, taxPercentage: s.commertialOffer.taxPercentage, AvailableQuantity: s.commertialOffer.AvailableQuantity, IsAvailable: s.commertialOffer.IsAvailable, PriceValidUntil: s.commertialOffer.PriceValidUntil } })),
    })),
  }));
}
function resumenWoo(lista) {
  return (lista || []).map((p) => ({ id: p.id, name: p.name, permalink: p.permalink, sku: p.sku, type: p.type, prices: p.prices, is_in_stock: p.is_in_stock, stock: p.stock_availability, categories: (p.categories || []).map((c) => c.name), price_html: recorte(p.price_html || '', 400) }));
}
async function sondearTiendas() {
  // Easy (VTEX)
  titulo('TIENDA Easy (VTEX)');
  await verRobots('https://www.easy.com.co');
  await terminosCompletos('https://www.easy.com.co/terminos-y-condiciones', 'easy');
  const pe = await producto('https://www.easy.com.co/cemento-argos-portland-tipo-i-x-50-kg/p', 'easy');
  if (pe) {
    const ls = uniq(enlaces(pe.html, 'https://www.easy.com.co')).filter((l) => /t[ée]rminos|condiciones|legal|pol[ií]tica|uso del sitio/i.test(l.texto + ' ' + l.url));
    console.log('  enlaces legales en la página:\n' + ls.slice(0, 20).map((l) => '    · ' + l.texto + ' → ' + l.url).join('\n'));
  }
  const ve = await json('https://www.easy.com.co/api/catalog_system/pub/products/search?ft=' + encodeURIComponent('cemento gris 50') + '&_from=0&_to=4');
  if (ve) { const rs = resumenVtex(ve); console.log(recorte(JSON.stringify(rs, null, 1), 6000)); escribir('easy-api-busqueda.json', rs); }
  for (const sc of [1, 2, 3]) {
    const v = await json('https://www.easy.com.co/api/catalog_system/pub/products/search?ft=' + encodeURIComponent('cemento gris 50') + '&_from=0&_to=0&sc=' + sc);
    if (v) console.log('  sc=' + sc + ' → ' + recorte(JSON.stringify(resumenVtex(v).map((p) => [p.productName, p.items.map((i) => i.sellers.map((s) => s.oferta && s.oferta.Price))])), 400));
  }
  // La Casita Roja (WooCommerce, Cartagena)
  titulo('TIENDA Ferretería La Casita Roja (WooCommerce)');
  await verRobots('https://ferreterialacasitaroja.com');
  await terminosCompletos('https://ferreterialacasitaroja.com/terminos-y-condiciones/', 'casitaroja');
  const ph = await verPagina('https://ferreterialacasitaroja.com', { datos: false });
  if (ph) {
    const ls = uniq(ph.enlaces).filter((l) => /t[ée]rminos|condiciones|legal|pol[ií]tica|aviso|privacidad|nosotros|contacto/i.test(l.texto + ' ' + l.url));
    console.log('  enlaces legales en la portada:\n' + ls.slice(0, 20).map((l) => '    · ' + l.texto + ' → ' + l.url).join('\n'));
    for (const l of ls.filter((l) => /legal|aviso|uso/i.test(l.texto + l.url) && !/terminos-y-condiciones\/?$/.test(l.url)).slice(0, 2)) await terminosCompletos(l.url, 'casitaroja-' + l.url.split('/').filter(Boolean).pop());
  }
  await producto('https://ferreterialacasitaroja.com/product/cemento-gris-uso-general-argos-50kg/', 'casitaroja');
  const wc = await json('https://ferreterialacasitaroja.com/wp-json/wc/store/v1/products?search=cemento&per_page=5');
  if (wc) { const rs = resumenWoo(wc); console.log(recorte(JSON.stringify(rs, null, 1), 6000)); escribir('casitaroja-api-busqueda.json', rs); }
  const wc1 = await json('https://ferreterialacasitaroja.com/wp-json/wc/store/v1/products?slug=cemento-gris-uso-general-argos-50kg');
  if (wc1) { const rs = resumenWoo(wc1); console.log(recorte(JSON.stringify(rs, null, 1), 2500)); escribir('casitaroja-api-producto.json', rs); }
  // Homecenter: términos completos y ld+json del producto
  titulo('TIENDA Homecenter');
  await verRobots('https://www.homecenter.com.co');
  await terminosCompletos('https://www.homecenter.com.co/homecenter-co/content/terminos-y-condiciones/', 'homecenter');
  await producto('https://www.homecenter.com.co/homecenter-co/product/13846/cemento-argos-gris-50kg/13846/', 'homecenter');
  // Corona (cabeceras grandes)
  titulo('TIENDA Corona');
  await verRobots('https://corona.co');
  const pc = await verPagina('https://corona.co', { datos: false });
  if (pc) {
    const ls = uniq(pc.enlaces).filter((l) => /t[ée]rminos|condiciones|legal|pol[ií]tica de uso|aviso/i.test(l.texto + ' ' + l.url));
    console.log('  enlaces legales:\n' + ls.slice(0, 20).map((l) => '    · ' + l.texto + ' → ' + l.url).join('\n'));
    for (const l of ls.slice(0, 2)) await terminosCompletos(l.url, 'corona-' + (l.url.split('/').filter(Boolean).pop() || 'x').slice(0, 30));
  }
  await producto('https://corona.co/productos/cementos/cemento-alion-gris-de-uso-general-50-kg/p/CEMCUGB50', 'corona');
  // Al Día (PrestaShop, Bucaramanga)
  titulo('TIENDA Ferretería Aldia');
  await verRobots('https://aldiaferreteria.com');
  const pa = await verPagina('https://aldiaferreteria.com', { datos: false });
  if (pa) {
    const ls = uniq(pa.enlaces).filter((l) => /t[ée]rminos|condiciones|legal|pol[ií]tica|aviso|content\//i.test(l.texto + ' ' + l.url));
    console.log('  enlaces legales:\n' + ls.slice(0, 20).map((l) => '    · ' + l.texto + ' → ' + l.url).join('\n'));
    for (const l of ls.filter((l) => /t[ée]rminos|condiciones|uso/i.test(l.texto + l.url)).slice(0, 2)) await terminosCompletos(l.url, 'aldia-' + (l.url.split('/').filter(Boolean).pop() || 'x').slice(0, 30));
  }
  const lc = await producto('https://aldiaferreteria.com/cementos-concretos-y-morteros/cementos', 'aldia-lista');
  if (lc) {
    const prod = uniq(enlaces(lc.html, 'https://aldiaferreteria.com')).filter((l) => /\/cementos\/\d+-|\.html$/.test(l.url)).slice(0, 3);
    console.log('  productos: ' + prod.map((l) => l.url).join(' · '));
    if (prod[0]) await producto(prod[0].url, 'aldia');
  }
}

/* ─────────────── Tercera ronda: términos del IDU y búsqueda de texto en la TVEC ─────────────── */
async function sondearRonda3() {
  titulo('IDU · términos (PDF)');
  await terminosCompletos('https://www.idu.gov.co/Archivos_Portal/Home/footer/DU-TI-03_CONDICIONES_DE_USO_Y_POLITICAS_DE_PRIVACIDAD_DE_LA_2.pdf', 'idu');
  titulo('TVEC · búsqueda de texto completo ($q)');
  const base = 'https://www.datos.gov.co/resource/3hdv-smhz.json';
  for (const q of ['cemento gris', 'varilla corrugada', 'bloque cemento', 'tubo pvc sanitario']) {
    const t0 = Date.now();
    const r = await json(base + '?$q=' + encodeURIComponent(q) + '&$where=' + encodeURIComponent("fecha >= '2025-10-01'") + '&$order=' + encodeURIComponent('fecha DESC') + '&$limit=15');
    console.log('  «' + q + '» → ' + (r ? r.length : '✖') + ' filas en ' + (Date.now() - t0) + ' ms');
    if (r) r.slice(0, 15).forEach((f) => console.log('    ' + f.fecha.slice(0, 10) + ' · ' + recorte(f.item, 110) + ' · ' + f.price + ' / ' + f.unidad_de_medida + ' · orden ' + f.orden_de_compra));
    if (r) escribir('tvec-q-' + q.replace(/\s+/g, '-') + '.json', r);
  }
  titulo('Easy · producto por su enlace (API pública)');
  const e = await json('https://www.easy.com.co/api/catalog_system/pub/products/search/cemento-argos-portland-tipo-i-x-50-kg/p');
  if (e) { console.log(recorte(JSON.stringify(resumenVtex(e), null, 1), 2000)); escribir('easy-api-producto.json', resumenVtex(e)); }
  titulo('Aldia · segunda página de la categoría');
  const a = await traerRespetando('https://aldiaferreteria.com/cementos-concretos-y-morteros/cementos?page=2', { accept: 'text/html' });
  console.log('  ?page=2 → ' + (a.ok ? 'HTTP ' + a.status + ' · ' + a.bytes.length + ' bytes' : a.error || a.status));
  if (a.ok) {
    const html = a.bytes.toString('utf8');
    const i = html.indexOf('product-miniature');
    console.log('  primera tarjeta: ' + recorte(html.slice(i, i + 2500).replace(/\s+/g, ' '), 2500));
    const n = (html.match(/class="product-miniature/g) || []).length;
    console.log('  tarjetas en la página: ' + n);
    const pag = /<nav class="pagination"[\s\S]*?<\/nav>/.exec(html);
    if (pag) console.log('  paginación: ' + recorte(pag[0].replace(/\s+/g, ' '), 1500));
  }
}

const tareas = { tvec: sondearTvec, idu: sondearIdu, icoced: sondearIcoced, tiendas: sondearTiendas, ronda3: sondearRonda3 };
if (process.env.SONDEO) {
  for (const k of process.env.SONDEO.split(',')) {
    try { await tareas[k](); } catch (e) { console.log('✖ error en ' + k + ': ' + (e && e.stack || e)); }
  }
  console.log('\nFin de la segunda ronda. Archivos en ' + SALIDA);
}
