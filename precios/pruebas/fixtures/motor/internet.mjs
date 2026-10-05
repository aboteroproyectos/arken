// ARKEN PRECIOS · pruebas · internet simulado con las páginas guardadas (sin red).
//
// Lo comparten las pruebas del motor, de la recolección, del servidor y del programa en el
// navegador. Cada sitio responde con sus páginas guardadas de esta carpeta (datos de prueba,
// ver LEAME.md) y todo lo demás es 404. `pedidas` guarda cada solicitud con su agente y su
// correo, para revisar que el motor se identifica y respeta robots.txt.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { excelIdu, excelIcoced } from './fabricar.mjs';
import { ErrorMotor } from '../../../motor/errores.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
/** Una página guardada de esta carpeta, como texto. */
export const leer = (r) => readFileSync(join(AQUI, r), 'utf8');

export const CONTACTO = 'pruebas@arken.example';
export const LEGAL = { robotsTxt: 'Permite lo que se lee.', terminos: 'No prohíben el acceso automatizado.', fecha: '2026-10-05', responsable: 'Persona de prueba', resultado: 'aprobada' };
/** Pausas cortas: el internet simulado responde al instante. */
export const OPCIONES_RED = { pausaMinimaMs: 2, esperaBaseMs: 2, tiempoMaximoMs: 5000 };
/** Espera de a lo sumo 5 ms, cancelable como la del motor: con fichas reales (6 o 10 solicitudes por
    minuto) la prueba no tiene que esperar minutos. El ritmo por sitio lo prueba pruebas/motor.mjs. */
export function esperaRapida(ms, senal) {
  return new Promise((resolver, rechazar) => {
    if (senal && senal.aborted) return rechazar(new ErrorMotor('cancelado'));
    const alAbortar = () => {
      clearTimeout(t);
      rechazar(new ErrorMotor('cancelado'));
    };
    const t = setTimeout(() => {
      if (senal) senal.removeEventListener('abort', alAbortar);
      resolver();
    }, Math.min(5, Math.max(0, ms)));
    if (senal) senal.addEventListener('abort', alAbortar, { once: true });
  });
}
export const OPCIONES_RAPIDAS = Object.assign({}, OPCIONES_RED, { esperar: esperaRapida });

export const texto = (cuerpo, tipo = 'text/html; charset=utf-8', status = 200, headers = {}) => ({ status, body: cuerpo, headers: Object.assign({ 'content-type': tipo }, headers) });
export const json = (cuerpo) => texto(cuerpo, 'application/json; charset=utf-8');
export const XLSX_TIPO = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const RUTA_ICOCED = '/index.php/estadisticas-por-tema/precios-y-costos/indice-de-costos-de-la-construccion-de-edificaciones-icoced';

/** Un internet vacío: `sitios` lleva un manejador por dominio (u, init) => { status, body, headers } | null. */
export function crearInternet() {
  const pedidas = [];
  const sitios = new Map();
  async function fetchFalso(url, init = {}) {
    const u = new URL(url);
    const h = init.headers || {};
    pedidas.push({ url: u.href, host: u.host, ruta: u.pathname + u.search, ua: h['User-Agent'], from: h.From });
    if (init.signal && init.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const sitio = sitios.get(u.host);
    const r = (sitio && (await sitio(u, init))) || { status: 404, body: 'No encontrado', headers: { 'content-type': 'text/plain' } };
    const status = r.status || 200;
    return new Response(status === 304 || status === 204 ? null : r.body, { status, headers: r.headers || {} });
  }
  return { fetch: fetchFalso, pedidas, sitios };
}

/** Los seis sitios de las fuentes certificadas con sus páginas guardadas.
    `estado` cambia su comportamiento: easyCaptcha (Easy responde con un CAPTCHA) y
    aldiaSinTarjetas (Aldia cambió de forma). */
export function internetNormal() {
  const net = crearInternet();
  const estado = { easyCaptcha: false, aldiaSinTarjetas: false };
  net.estado = estado;
  net.sitios.set('www.easy.com.co', (u) => {
    if (u.pathname === '/robots.txt') return texto(leer('easy/robots.txt'), 'text/plain');
    if (estado.easyCaptcha) return texto('<html><div class="g-recaptcha"></div></html>', 'text/html', 403);
    if (u.pathname === '/api/catalog_system/pub/products/search') return json(leer('easy/busqueda.json'));
    if (/^\/api\/catalog_system\/pub\/products\/search\/[^/]+\/p$/.test(u.pathname)) return json(leer('easy/producto.json'));
    return null;
  });
  net.sitios.set('ferreterialacasitaroja.com', (u) => {
    if (u.pathname === '/robots.txt') return texto(leer('casitaroja/robots.txt'), 'text/plain');
    if (u.pathname === '/wp-json/wc/store/v1/products' && u.searchParams.get('slug')) return json(leer('casitaroja/producto.json'));
    if (u.pathname === '/wp-json/wc/store/v1/products') return json(leer('casitaroja/busqueda.json'));
    return null;
  });
  net.sitios.set('aldiaferreteria.com', (u) => {
    if (u.pathname === '/robots.txt') return texto(leer('aldia/robots.txt'), 'text/plain');
    if (u.pathname === '/cementos-concretos-y-morteros') {
      if (estado.aldiaSinTarjetas) return texto('<html><body><div class="lista-nueva"><div class="item">Cemento $33.333</div></div></body></html>');
      return texto(leer(u.searchParams.get('page') === '2' ? 'aldia/cementos-p2.html' : 'aldia/cementos.html'));
    }
    if (u.pathname === '/cementos/5101-cemento-gris-uso-general-50-kg-prueba') return texto(leer('aldia/producto.html'));
    return null;
  });
  net.sitios.set('www.idu.gov.co', (u) => {
    if (u.pathname === '/robots.txt') return texto(leer('idu/robots.txt'), 'text/plain');
    if (u.pathname === '/page/siipviales/economico/portafolio') return texto(leer('idu/portafolio.html'));
    if (/1A_Visor_BPR_2026-I_Fase_II_PRUEBA_28-09-2026\.xlsx$/.test(u.pathname)) return { status: 200, body: excelIdu(), headers: { 'content-type': XLSX_TIPO } };
    return null;
  });
  net.sitios.set('www.dane.gov.co', (u) => {
    if (u.pathname === '/robots.txt') return texto(leer('dane/robots.txt'), 'text/plain');
    if (u.pathname === RUTA_ICOCED) return texto(leer('dane/icoced.html'));
    if (u.pathname === '/files/operaciones/ICOCED/anex-ICOCED-ago2026.xlsx') return { status: 200, body: excelIcoced(), headers: { 'content-type': XLSX_TIPO } };
    return null;
  });
  net.sitios.set('www.datos.gov.co', (u) => {
    if (u.pathname === '/robots.txt') return texto(leer('tvec/robots.txt'), 'text/plain');
    if (u.pathname === '/resource/3hdv-smhz.json') return json(leer('tvec/items.json'));
    if (u.pathname === '/resource/rgxm-mmea.json') return json(leer('tvec/ordenes.json'));
    return null;
  });
  return net;
}

/** Una ficha certificada, como la deja el programa después de la revisión legal y la prueba
    técnica (con la huella de su configuración). C es el núcleo de conectores del programa. */
export function fichaDePrueba(C, id, metodo, configuracion, extra = {}) {
  const f = Object.assign(
    { id, nombre: id, tipo: 'tienda', urlBase: '', metodo, configuracion, revisionLegal: Object.assign({}, LEGAL), limitePorMinuto: 60000, salud: 'activa', confiabilidad: 0.6 },
    extra,
  );
  f.ultimaPrueba = { resultado: 'aprobada', fecha: '2026-10-05', huella: C.huella(f) };
  return f;
}

/** Las seis fuentes certificadas, una de cada conector, apuntando a las páginas guardadas. */
export function fuentesDePrueba(C) {
  return [
    fichaDePrueba(C, 'easy', 'api-json', { conector: 'easy' }, { urlBase: 'https://www.easy.com.co', nombre: 'Easy Colombia' }),
    fichaDePrueba(C, 'casitaroja', 'api-json', { conector: 'casitaroja' }, { urlBase: 'https://ferreterialacasitaroja.com', nombre: 'Ferretería La Casita Roja' }),
    fichaDePrueba(C, 'aldia', 'html', { conector: 'aldia', lista: { urls: ['https://aldiaferreteria.com/cementos-concretos-y-morteros', 'https://aldiaferreteria.com/categoria-que-ya-no-existe'] } }, { urlBase: 'https://aldiaferreteria.com', nombre: 'Ferretería Aldia' }),
    fichaDePrueba(C, 'idu', 'excel', { conector: 'idu' }, { urlBase: 'https://www.idu.gov.co', tipo: 'entidad pública', nombre: 'IDU' }),
    fichaDePrueba(C, 'tvec', 'socrata', { conector: 'tvec' }, { urlBase: 'https://www.datos.gov.co', tipo: 'datos abiertos', nombre: 'TVEC' }),
    fichaDePrueba(C, 'dane', 'excel', { conector: 'icoced' }, { urlBase: 'https://www.dane.gov.co', tipo: 'entidad pública', nombre: 'DANE' }),
  ];
}
