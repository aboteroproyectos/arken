// ARKEN PRECIOS · motor · lector de robots.txt (RFC 9309).
//
// Antes de pedir cualquier página, el motor pregunta aquí si el sitio la permite para su
// agente. Reglas que se cumplen:
//   · Se usan los grupos cuyo «User-agent» coincide con el token del agente
//     («arken-precios»); si no hay ninguno, los grupos de «*». Los grupos que coinciden se
//     suman en uno solo.
//   · Gana la regla con la ruta más larga; si un Allow y un Disallow empatan, gana el Allow.
//     «*» es cualquier secuencia y «$» marca el final de la ruta.
//   · /robots.txt siempre se puede leer.
//   · Según la respuesta al pedir robots.txt: 2xx se lee; 4xx significa que no hay reglas
//     (se puede leer todo); 5xx o falla de red significa que no se sabe y no se lee nada.
//   · «Crawl-delay» no es parte de la norma, pero se respeta como pausa mínima entre
//     solicitudes al mismo sitio.

/** Máximo que se lee de un robots.txt (la norma pide al menos 500 KiB). */
export const MAXIMO_BYTES = 512 * 1024;

/** Lee el texto de un robots.txt y devuelve sus grupos. */
export function leerRobots(texto) {
  const grupos = [];
  const mapas = [];
  let actual = null;
  let enCabecera = false;
  const lineas = String(texto || '').slice(0, MAXIMO_BYTES).split(/\r\n|\r|\n/);
  for (const cruda of lineas) {
    const linea = cruda.replace(/#.*$/, '').trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(linea);
    if (!m) continue;
    const clave = m[1].toLowerCase();
    const valor = m[2].trim();
    if (clave === 'user-agent') {
      // Varias líneas User-agent seguidas comparten el mismo grupo
      if (!actual || !enCabecera) {
        actual = { agentes: [], reglas: [], demora: null };
        grupos.push(actual);
      }
      actual.agentes.push(valor.toLowerCase());
      enCabecera = true;
      continue;
    }
    if (clave === 'sitemap') {
      mapas.push(valor);
      continue;
    }
    enCabecera = false;
    if (!actual) continue;
    if (clave === 'allow' || clave === 'disallow') {
      // «Disallow:» vacío no prohíbe nada: no es una regla
      if (valor === '' && clave === 'disallow') continue;
      actual.reglas.push({ permite: clave === 'allow', ruta: normalizarPatron(valor) });
    } else if (clave === 'crawl-delay') {
      const s = Number(valor.replace(',', '.'));
      if (isFinite(s) && s >= 0) actual.demora = Math.max(actual.demora || 0, s);
    }
  }
  return { grupos, mapas };
}

/** Normaliza el escape de una ruta para comparar igual a los dos lados: «%7e» y «~» son lo mismo. */
function normalizarRuta(ruta) {
  return String(ruta).replace(/%([0-9a-fA-F]{2})/g, (_m, h) => {
    const c = String.fromCharCode(parseInt(h, 16));
    // Solo se decodifican los caracteres que no cambian el sentido de la ruta
    return /[A-Za-z0-9\-._~]/.test(c) ? c : '%' + h.toUpperCase();
  });
}
function normalizarPatron(patron) {
  return normalizarRuta(patron);
}

/** Token de producto del agente: lo que va antes de «/» en minúsculas («ARKEN-PRECIOS/0.3 (…)» → «arken-precios»). */
export function tokenDe(agente) {
  return String(agente || '').trim().split(/[\s/]/)[0].toLowerCase();
}

/** Reglas que aplican a un agente: sus grupos, o los de «*» si no tiene propios. */
export function reglasPara(robots, agente) {
  const token = tokenDe(agente);
  const grupos = (robots && robots.grupos) || [];
  // La norma compara el token completo, sin distinguir mayúsculas
  let propios = grupos.filter((g) => g.agentes.some((a) => a !== '*' && a === token));
  if (!propios.length) propios = grupos.filter((g) => g.agentes.includes('*'));
  const reglas = [];
  let demora = null;
  for (const g of propios) {
    reglas.push(...g.reglas);
    if (g.demora !== null) demora = Math.max(demora || 0, g.demora);
  }
  return { reglas, demora, propio: propios.some((g) => !g.agentes.includes('*')) };
}

/** Largo de la coincidencia de un patrón con una ruta, o -1 si no coincide. */
export function coincidencia(ruta, patron) {
  if (!patron) return -1;
  const alFinal = patron.endsWith('$');
  const cuerpo = alFinal ? patron.slice(0, -1) : patron;
  const re = new RegExp(
    '^' +
      cuerpo
        .split('*')
        .map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[\\s\\S]*') +
      (alFinal ? '$' : ''),
  );
  return re.test(ruta) ? patron.length : -1;
}

/** ¿Permite el robots.txt leer esta dirección? Devuelve la regla que decidió y la pausa pedida. */
export function permitido(robots, url, agente) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return { permite: false, regla: 'dirección inválida', demora: null };
  }
  const ruta = normalizarRuta((u.pathname || '/') + (u.search || ''));
  if (ruta === '/robots.txt') return { permite: true, regla: null, demora: null };
  const { reglas, demora } = reglasPara(robots, agente);
  let mejor = { largo: -1, permite: true, regla: null };
  for (const r of reglas) {
    const largo = coincidencia(ruta, r.ruta);
    if (largo < 0) continue;
    if (largo > mejor.largo || (largo === mejor.largo && r.permite && !mejor.permite)) {
      mejor = { largo, permite: r.permite, regla: (r.permite ? 'Allow: ' : 'Disallow: ') + r.ruta };
    }
  }
  return { permite: mejor.permite, regla: mejor.regla, demora };
}

/** Qué hacer según la respuesta al pedir robots.txt (RFC 9309, §2.3.1). Un 429 no es
    «sin reglas»: el sitio pide calma, así que se trata como no disponible. */
export function segunRespuesta(status, texto) {
  if (status >= 200 && status < 300) return { estado: 'leído', robots: leerRobots(texto) };
  if (status >= 400 && status < 500 && status !== 429) return { estado: 'sin reglas', robots: { grupos: [], mapas: [] } };
  return { estado: 'no disponible', robots: null };
}
