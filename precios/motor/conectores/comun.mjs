// ARKEN PRECIOS · motor · piezas comunes de los conectores.
//
// Un conector entrega «hallazgos crudos» (§7.2):
//   { titulo, url, precioTexto, unidadTexto, presentacion, disponibilidad, proveedor, fechaVisible, textoLiteral }
// y además, cuando la fuente los da:
//   precio       el número que publica la fuente (un JSON o una celda de Excel); el texto literal lo contiene
//   incluyeIva   true, false o null
//   ciudad       nombre de la ciudad del precio (si la fuente es de una sola ciudad)
//   condiciones  texto corto (promoción, cantidad mínima…)
//   clave        identificador estable de una fila de una lista («idu:322»), para sus vínculos y su serie
//   pagina       { texto, leida, tipo, recuperada }: lo leído donde está escrito el texto literal, que
//                es la evidencia y contra lo que se verifica el precio

import { ErrorMotor } from '../errores.mjs';

/** Valor en una ruta de un JSON: «items[0].sellers[0].commertialOffer.Price», «data.rows». */
export function obtener(obj, ruta) {
  if (!ruta) return obj;
  const partes = String(ruta)
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let x = obj;
  for (const p of partes) {
    if (x === null || x === undefined) return undefined;
    x = x[p];
  }
  return x;
}

/** Elementos de una lista en un JSON: «» (la raíz es la lista), «products», «data.items». */
export function elementos(obj, ruta) {
  const x = ruta ? obtener(obj, ruta.replace(/\[\*\]$/, '')) : obj;
  return Array.isArray(x) ? x : [];
}

/** Texto visible de un fragmento HTML (para campos de un JSON que traen HTML, como price_html). */
export function textoDeHtml(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&#36;|&dollar;/gi, '$')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[   ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Un objeto JSON en texto, «ruta: valor | ruta: valor», como lo vería una persona: los textos con
 * HTML pasan a texto visible y los muy largos se recortan. Es la evidencia de un hallazgo de una API.
 * Las rutas `primero` van al comienzo (el nombre y el precio).
 */
export function aplanar(obj, o = {}) {
  const pares = [];
  const maxValor = o.maxValor || 240;
  (function recorrer(x, ruta, prof) {
    if (pares.length > 400 || prof > 8) return;
    if (x === null || x === undefined) return;
    if (Array.isArray(x)) {
      x.slice(0, o.maxLista || 12).forEach((y, i) => recorrer(y, ruta + '[' + i + ']', prof + 1));
      return;
    }
    if (typeof x === 'object') {
      for (const k of Object.keys(x)) recorrer(x[k], ruta ? ruta + '.' + k : k, prof + 1);
      return;
    }
    let v = typeof x === 'string' ? (/<[a-z][\s\S]*>/i.test(x) ? textoDeHtml(x) : x.replace(/\s+/g, ' ').trim()) : String(x);
    if (!v) return;
    if (v.length > maxValor) v = v.slice(0, maxValor) + '…';
    pares.push([ruta, v]);
  })(obj, '', 0);
  const primero = new Set(o.primero || []);
  pares.sort((a, b) => (primero.has(b[0]) ? 1 : 0) - (primero.has(a[0]) ? 1 : 0));
  return pares
    .map(([k, v]) => k + ': ' + v)
    .join(' | ')
    .slice(0, o.maxTexto || 8000);
}

/** Última parte de una ruta JSON: «items[0].sellers[0].commertialOffer.Price» → «Price». */
export function nombreCampo(ruta) {
  const p = String(ruta || '').replace(/\[\d+\]/g, '').split('.');
  return p[p.length - 1] || String(ruta || '');
}

/** Un trozo de un texto largo alrededor del literal, para que la evidencia no pese de más. */
export function alrededor(texto, literal, margen = 2500) {
  const t = String(texto || '');
  if (t.length <= margen * 2 + 400) return t;
  const patron = String(literal || '')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s*');
  const m = patron ? new RegExp(patron).exec(t) : null;
  const i = m ? m.index : 0;
  const a = Math.max(0, i - margen);
  return t.slice(a, Math.min(t.length, i + (m ? m[0].length : 0) + margen));
}

/** Arma un hallazgo crudo con los campos de §7.2 y lo que se leyó. */
export function crudo(d) {
  return {
    titulo: String(d.titulo || '').replace(/\s+/g, ' ').trim(),
    url: d.url,
    precioTexto: String(d.precioTexto || '').replace(/\s+/g, ' ').trim(),
    unidadTexto: d.unidadTexto || '',
    presentacion: d.presentacion || '',
    disponibilidad: d.disponibilidad || '',
    proveedor: d.proveedor || '',
    fechaVisible: d.fechaVisible || '',
    textoLiteral: String(d.textoLiteral || d.precioTexto || '').replace(/\s+/g, ' ').trim(),
    precio: d.precio === undefined ? undefined : d.precio,
    incluyeIva: d.incluyeIva === true || d.incluyeIva === false ? d.incluyeIva : null,
    ciudad: d.ciudad || '',
    condiciones: d.condiciones || '',
    clave: d.clave || null,
    pagina: d.pagina || null,
  };
}

/** Disponibilidad legible: «agotado», «disponible» o el texto que da la fuente. */
export function disponibilidad(x) {
  if (x === true) return 'disponible';
  if (x === false) return 'agotado';
  const t = String(x || '').trim();
  if (/outofstock|out of stock|agotad|sin existencias/i.test(t)) return 'agotado';
  if (/instock|in stock|disponible/i.test(t)) return 'disponible';
  return t.slice(0, 80);
}

/** Fecha ISO de un texto «4/09/2026», «2026-09-04» o «30 de septiembre de 2026». */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export function fechaDeTexto(t) {
  const s = String(t || '');
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(s);
  if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  m = /\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de|del)\s+(\d{4})\b/i.exec(s);
  if (m) {
    const k = MESES.indexOf(m[2].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
    if (k >= 0) return m[3] + '-' + String(k + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0');
  }
  return '';
}

/** Falla de formato: el sitio cambió y el conector no encuentra lo que espera. */
export function formato(mensaje, url) {
  return new ErrorMotor('formato', mensaje, { url });
}

/** Busca, en el texto de una página, el enlace a un archivo por su texto o por un patrón. */
export function enlaceArchivo(enlaces, o) {
  const patron = o.patron ? new RegExp(o.patron, 'i') : null;
  const texto = o.texto ? String(o.texto).toLowerCase() : '';
  const candidatos = enlaces.filter((e) => (patron ? patron.test(e.href) : true) && (texto ? e.texto.toLowerCase().includes(texto) : true));
  return candidatos[0] || null;
}

/**
 * Trozo de un texto alrededor de una aguja (el precio), cortado en espacios para no partir
 * palabras ni números: es el texto literal de una tarjeta o una página.
 * @returns {string} el trozo, o '' si la aguja no está
 */
export function ventana(texto, aguja, antes = 200, despues = 120) {
  const t = String(texto || '').replace(/\s+/g, ' ').trim();
  const a = String(aguja || '').replace(/\s+/g, ' ').trim();
  if (!t || !a) return '';
  const i = t.indexOf(a);
  if (i < 0) return '';
  let ini = Math.max(0, i - antes);
  let fin = Math.min(t.length, i + a.length + despues);
  if (ini > 0) {
    const e = t.indexOf(' ', ini);
    ini = e >= 0 && e < i ? e + 1 : i;
  }
  if (fin < t.length) {
    const e = t.lastIndexOf(' ', fin);
    fin = e > i + a.length ? e : i + a.length;
  }
  return t.slice(ini, fin).trim();
}

/** Texto en una sola línea. */
export function unaLinea(t) {
  return String(t === null || t === undefined ? '' : t).replace(/\s+/g, ' ').trim();
}

/**
 * Lista de pares «nombre: valor» en una línea, en el orden dado, sin los vacíos: la forma en
 * que el motor escribe un objeto de una API como texto (la evidencia de un hallazgo).
 */
export function pares(lista) {
  return lista
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(([k, v]) => k + ': ' + unaLinea(v))
    .join(' | ');
}

/** Huella corta de un texto (para la clave de una fila sin identificador propio). */
export function huellaTexto(t) {
  let h = 2166136261;
  const s = String(t || '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}
