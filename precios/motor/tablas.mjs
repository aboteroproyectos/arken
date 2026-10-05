// ARKEN PRECIOS · motor · tablas en Excel y en PDF.
//
// Excel con SheetJS 0.18.5 y PDF con pdf.js 3.11.174, las mismas versiones que usa ARKEN.
// Las dos leen archivos que llegan de internet, así que se usan con cuidado:
//   · SheetJS corre en un contexto aparte (node:vm) que solo recibe y entrega texto, con un
//     tiempo máximo. Las fallas conocidas de esa versión (contaminación de prototipos y
//     expresiones regulares lentas con un archivo hecho a propósito) quedan encerradas en ese
//     contexto y no tocan el resto del motor (decisión 62).
//   · pdf.js corre sin evaluar código (isEvalSupported: false), que es lo que cierra su falla
//     conocida de esa versión, y sin fuentes del sistema.

import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const requerir = createRequire(import.meta.url);

/** Minúsculas, sin tildes y con un solo espacio: para comparar encabezados. */
export function normaliza(t) {
  return String(t === null || t === undefined ? '' : t)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/* ─────────────────────────  EXCEL  ───────────────────────── */

let contextoExcel = null;
const EXTRAER = `
function __extraer(entrada, opciones){
  var pedidas = opciones.hojas && opciones.hojas.length ? opciones.hojas : null;
  var leer = { type:'base64', cellNF:false, cellText:true, cellDates:false, dense:false };
  if (pedidas) leer.sheets = pedidas;
  var wb = XLSX.read(entrada, leer);
  var out = { hojas:[] };
  for (var i = 0; i < wb.SheetNames.length; i++){
    var nombre = wb.SheetNames[i];
    if (pedidas && pedidas.indexOf(nombre) < 0) continue;
    var ws = wb.Sheets[nombre];
    if (!ws || !ws['!ref']) { out.hojas.push({ nombre:nombre, filas:[] }); continue; }
    var r = XLSX.utils.decode_range(ws['!ref']);
    var maxFila = Math.min(r.e.r, opciones.maxFilas || 200000);
    var maxCol = Math.min(r.e.c, 255);
    var filas = [];
    for (var f = 0; f <= maxFila; f++){
      var fila = [];
      var alguna = false;
      for (var c = 0; c <= maxCol; c++){
        var celda = ws[XLSX.utils.encode_cell({ r:f, c:c })];
        if (!celda || celda.v === undefined || celda.v === null || celda.v === ''){ fila.push(null); continue; }
        var w = celda.w !== undefined ? String(celda.w) : String(celda.v);
        fila.push({ v:(typeof celda.v === 'number' || typeof celda.v === 'boolean') ? celda.v : String(celda.v), w:w, t:celda.t });
        alguna = true;
      }
      while (fila.length && fila[fila.length - 1] === null) fila.pop();
      filas.push(alguna ? fila : []);
    }
    out.hojas.push({ nombre:nombre, filas:filas, ref:ws['!ref'] });
  }
  out.nombres = wb.SheetNames.slice();
  return JSON.stringify(out);
}`;

function crearContextoExcel() {
  if (contextoExcel) return contextoExcel;
  const codigo = readFileSync(requerir.resolve('xlsx/dist/xlsx.full.min.js'), 'utf8');
  const ctx = vm.createContext({});
  vm.runInContext(codigo + '\n' + EXTRAER, ctx, { filename: 'xlsx.full.min.js', timeout: 20000 });
  if (!ctx.XLSX || typeof ctx.__extraer !== 'function') throw new Error('No se pudo cargar la librería de Excel.');
  contextoExcel = ctx;
  return ctx;
}

/**
 * Lee un libro de Excel (xlsx, xls o csv) y devuelve sus hojas como filas de celdas.
 * @param {Uint8Array} bytes
 * @param {object} [o] { hojas: [nombres], maxFilas, tiempoMaximoMs }
 * @returns {{ nombres: string[], hojas: Array<{ nombre, filas: Array<Array<{v,w,t}|null>> }> }}
 */
export function leerExcel(bytes, o = {}) {
  const ctx = crearContextoExcel();
  ctx.__entrada = Buffer.from(bytes).toString('base64');
  ctx.__opciones = JSON.stringify({ hojas: o.hojas || null, maxFilas: o.maxFilas || 200000 });
  try {
    const texto = vm.runInContext('__extraer(__entrada, JSON.parse(__opciones))', ctx, { timeout: o.tiempoMaximoMs || 60000 });
    return JSON.parse(texto);
  } catch (e) {
    // Tras un tiempo agotado o una falla, el contexto se descarta: el siguiente archivo empieza limpio
    contextoExcel = null;
    if (/timed out/i.test(String(e && e.message))) throw new Error('El archivo de Excel tardó demasiado en leerse.');
    throw new Error('No se pudo leer el archivo de Excel: ' + String((e && e.message) || e).slice(0, 200));
  } finally {
    if (contextoExcel) {
      ctx.__entrada = null;
      ctx.__opciones = null;
    }
  }
}

/** Letra de columna («A», «AB») a índice desde 0. */
export function columnaIndice(letra) {
  const s = String(letra || '').trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(s)) return -1;
  let n = 0;
  for (const ch of s) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}
export function columnaLetra(i) {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Texto de una celda tal como se ve en Excel. */
export function textoCelda(c) {
  if (!c) return '';
  return String(c.w !== undefined && c.w !== null ? c.w : c.v).replace(/\s+/g, ' ').trim();
}

/** Celda por referencia («G7»). */
export function celda(hoja, ref) {
  const m = /^([A-Z]{1,3})(\d+)$/i.exec(String(ref || '').trim());
  if (!m || !hoja) return null;
  const fila = hoja.filas[Number(m[2]) - 1];
  return (fila && fila[columnaIndice(m[1])]) || null;
}

/** Fecha ISO de un número de serie de Excel (sistema 1900). */
export function fechaExcel(serie) {
  const n = Number(serie);
  if (!isFinite(n) || n < 1 || n > 2958465) return null;
  return new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000)).toISOString().slice(0, 10);
}

/**
 * Busca la fila de encabezados: la primera, entre las `maxFila` primeras, que tiene todos los
 * encabezados pedidos. Un encabezado coincide si su texto normalizado es igual o empieza igual.
 * @param {Array} filas
 * @param {object} columnas { campo: 'Texto del encabezado' | 'letra:G' }
 * @returns {{ fila: number, indices: object } | null}  fila desde 1
 */
export function buscarEncabezado(filas, columnas, maxFila = 60) {
  const pedidos = Object.entries(columnas || {}).filter(([, v]) => v && !String(v).startsWith('letra:'));
  for (let f = 0; f < Math.min(filas.length, maxFila); f++) {
    const fila = filas[f] || [];
    const textos = fila.map((c) => normaliza(textoCelda(c)));
    const indices = {};
    let todos = true;
    for (const [campo, nombre] of pedidos) {
      const n = normaliza(nombre);
      let i = textos.findIndex((t) => t === n);
      if (i < 0) i = textos.findIndex((t) => t && t.startsWith(n));
      if (i < 0) {
        todos = false;
        break;
      }
      indices[campo] = i;
    }
    if (todos && pedidos.length) {
      for (const [campo, v] of Object.entries(columnas)) {
        if (String(v).startsWith('letra:')) indices[campo] = columnaIndice(String(v).slice(6));
      }
      return { fila: f + 1, indices, encabezados: fila.map(textoCelda) };
    }
  }
  return null;
}

/**
 * Filas de datos de una hoja como objetos, con el renglón completo en texto para la evidencia.
 * @param {object} hoja { nombre, filas }
 * @param {object} cfg { columnas: { campo: encabezado }, filaEncabezado?, requeridos: [campos] }
 */
export function tablaExcel(hoja, cfg) {
  const columnas = cfg.columnas || {};
  let enc;
  if (cfg.filaEncabezado) {
    const fila = hoja.filas[cfg.filaEncabezado - 1] || [];
    const textos = fila.map((c) => normaliza(textoCelda(c)));
    const indices = {};
    for (const [campo, nombre] of Object.entries(columnas)) {
      if (String(nombre).startsWith('letra:')) indices[campo] = columnaIndice(String(nombre).slice(6));
      else {
        const n = normaliza(nombre);
        let i = textos.findIndex((t) => t === n);
        if (i < 0) i = textos.findIndex((t) => t && t.startsWith(n));
        if (i >= 0) indices[campo] = i;
      }
    }
    enc = { fila: cfg.filaEncabezado, indices, encabezados: fila.map(textoCelda) };
  } else enc = buscarEncabezado(hoja.filas, columnas, cfg.maxFilaEncabezado || 60);
  if (!enc) return { ok: false, motivo: 'No se encontró la fila de encabezados (' + Object.values(columnas).join(', ') + ') en la hoja «' + hoja.nombre + '».', filas: [] };
  const faltan = Object.keys(columnas).filter((k) => enc.indices[k] === undefined);
  if (faltan.length) return { ok: false, motivo: 'Faltan columnas en la hoja «' + hoja.nombre + '»: ' + faltan.map((k) => columnas[k]).join(', ') + '.', filas: [] };
  const requeridos = cfg.requeridos || Object.keys(columnas);
  const out = [];
  for (let f = enc.fila; f < hoja.filas.length; f++) {
    const fila = hoja.filas[f] || [];
    const valores = {};
    for (const [campo, i] of Object.entries(enc.indices)) valores[campo] = fila[i] || null;
    if (requeridos.some((k) => !valores[k])) continue;
    // El renglón completo, con sus encabezados: lo que una persona ve en el archivo
    const texto = fila
      .map((c, i) => (c ? (enc.encabezados[i] ? enc.encabezados[i] + ': ' : '') + textoCelda(c) : ''))
      .filter(Boolean)
      .join(' | ');
    out.push({ fila: f + 1, valores, texto });
  }
  return { ok: true, encabezado: enc.fila, filas: out };
}

/* ─────────────────────────  PDF  ───────────────────────── */

let pdfjs = null;
async function cargarPdfjs() {
  if (pdfjs) return pdfjs;
  // pdf.js avisa por la consola que no puede dibujar sin «canvas»; aquí solo se lee el texto
  const avisos = [console.log, console.warn];
  const filtro = (f) => (...a) => {
    if (/Cannot polyfill|standard font|fetchStandardFontData|TT: undefined function/i.test(String(a[0] || ''))) return;
    f.apply(console, a);
  };
  console.log = filtro(avisos[0]);
  console.warn = filtro(avisos[1]);
  try {
    const modulo = await import('pdfjs-dist/legacy/build/pdf.js');
    pdfjs = modulo.getDocument ? modulo : modulo.default;
  } finally {
    [console.log, console.warn] = avisos;
  }
  return pdfjs;
}

/**
 * Texto de un PDF agrupado en líneas, con la posición de cada fragmento.
 * @returns {Promise<{ paginas: Array<{ numero, lineas: Array<{ y, texto, items: Array<{x, ancho, texto}> }> }> }>}
 */
export async function leerPdf(bytes, o = {}) {
  const p = await cargarPdfjs();
  const tarea = p.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const doc = await tarea.promise;
  const paginas = [];
  try {
    const n = Math.min(doc.numPages, o.maxPaginas || 200);
    for (let k = 1; k <= n; k++) {
      const pag = await doc.getPage(k);
      const tc = await pag.getTextContent();
      const items = tc.items
        .filter((it) => it.str && it.str.trim())
        .map((it) => ({ x: it.transform[4], y: it.transform[5], ancho: it.width || 0, alto: Math.abs(it.transform[3]) || 8, texto: it.str }));
      paginas.push({ numero: k, lineas: agruparLineas(items) });
      pag.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return { paginas };
}

/** Agrupa fragmentos en líneas por su altura (y) y los ordena de izquierda a derecha. */
export function agruparLineas(items) {
  const ordenados = items.slice().sort((a, b) => b.y - a.y || a.x - b.x);
  const lineas = [];
  for (const it of ordenados) {
    const tol = Math.max(2, it.alto * 0.4);
    const l = lineas.find((x) => Math.abs(x.y - it.y) <= tol);
    if (l) l.items.push(it);
    else lineas.push({ y: it.y, items: [it] });
  }
  for (const l of lineas) {
    l.items.sort((a, b) => a.x - b.x);
    let texto = '';
    let fin = null;
    for (const it of l.items) {
      if (fin !== null && it.x - fin > 1) texto += ' ';
      texto += it.texto;
      fin = it.x + it.ancho;
    }
    l.texto = texto.replace(/\s+/g, ' ').trim();
  }
  return lineas.sort((a, b) => b.y - a.y);
}

/**
 * Tabla de un PDF por la posición de sus encabezados: cada fragmento va a la columna cuyo
 * encabezado tiene más cerca. Sirve para listas de precios con columnas alineadas.
 * @param {object} pdf resultado de leerPdf
 * @param {object} cfg { columnas: { campo: 'Encabezado' }, requeridos }
 */
export function tablaPdf(pdf, cfg) {
  const columnas = cfg.columnas || {};
  const requeridos = cfg.requeridos || Object.keys(columnas);
  const out = [];
  let posiciones = null;
  for (const pag of pdf.paginas) {
    for (const l of pag.lineas) {
      const enc = encabezadoPdf(l, columnas);
      if (enc) {
        posiciones = enc;
        continue;
      }
      if (!posiciones) continue;
      const valores = {};
      for (const it of l.items) {
        const centro = it.x + it.ancho / 2;
        let mejor = null;
        for (const [campo, pos] of Object.entries(posiciones)) {
          const d = centro >= pos.desde && centro <= pos.hasta ? 0 : Math.min(Math.abs(centro - pos.desde), Math.abs(centro - pos.hasta));
          if (!mejor || d < mejor.d) mejor = { campo, d };
        }
        if (mejor && mejor.d < 60) valores[mejor.campo] = (valores[mejor.campo] ? valores[mejor.campo] + ' ' : '') + it.texto.trim();
      }
      if (requeridos.some((k) => !valores[k])) continue;
      out.push({ pagina: pag.numero, valores, texto: l.texto });
    }
  }
  if (!posiciones) return { ok: false, motivo: 'No se encontró la línea de encabezados (' + Object.values(columnas).join(', ') + ') en el PDF.', filas: [] };
  return { ok: true, filas: out };
}

function encabezadoPdf(linea, columnas) {
  const pos = {};
  const usados = new Set();
  for (const [campo, nombre] of Object.entries(columnas)) {
    const n = normaliza(nombre);
    const i = linea.items.findIndex((it, k) => !usados.has(k) && normaliza(it.texto) === n);
    const j = i >= 0 ? i : linea.items.findIndex((it, k) => !usados.has(k) && normaliza(it.texto).startsWith(n));
    if (j < 0) return null;
    usados.add(j);
    pos[campo] = { desde: linea.items[j].x, hasta: linea.items[j].x + linea.items[j].ancho };
  }
  // Cada columna se extiende hasta la mitad del espacio con la vecina
  const orden = Object.entries(pos)
    .sort((a, b) => a[1].desde - b[1].desde)
    .map(([campo, p]) => ({ campo, desde: p.desde, hasta: p.hasta }));
  const out = {};
  orden.forEach((x, k) => {
    const ant = orden[k - 1];
    const sig = orden[k + 1];
    out[x.campo] = { desde: ant ? (ant.hasta + x.desde) / 2 : x.desde - 40, hasta: sig ? (x.hasta + sig.desde) / 2 : x.hasta + 80 };
  });
  return out;
}
