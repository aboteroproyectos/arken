// ARKEN PRECIOS · la app de escritorio empacada, de punta a punta (Fase 3: §3, §5 y §17.3; criterio 8).
//
// Abre la app de Linux que arma electron-builder (dist/linux-unpacked) con perfiles nuevos y
// prueba lo que solo existe dentro de la app:
//   · el programa se sirve desde app://precios (contexto seguro) sin internet: las librerías y el
//     lector de PDF son locales, la página no tiene acceso a Node y el puente window.arkenPrecios
//     está completo; su política de seguridad (CSP) solo deja correr los scripts de la app
//   · sin llavero, el programa sabe de entrada que el equipo no cifra y usa los secretos solo en
//     la sesión; con llavero, la clave de API queda cifrada en secretos.json y en ningún otro lado
//     (la base, la página, el respaldo, la copia interna ni otro archivo de la app) (criterio 8)
//   · el motor de verdad, con la red de Chromium, lee una tienda de prueba en este equipo: primero
//     su robots.txt, revisa la redirección antes de seguirla, se identifica con el agente y el
//     correo de contacto y no devuelve cookies; la fuente se prueba y se activa en su ficha y se
//     lee desde el Módulo 02
//   · los enlaces de afuera se abren en el navegador del sistema, nunca dentro de la app, y un
//     correo de las alertas (mailto:) en el programa de correo; un PDF que el programa abre en
//     otra ventana se ofrece para guardar; y una segunda copia de la app no abre otra ventana
//     sobre los mismos datos
//   · al cerrar, la copia interna, la copia del día y la bitácora de la lectura; al abrir otra vez
//     los datos siguen; si el almacenamiento interno se pierde, la app los recupera de la copia
//
// Uso (Linux): npm run dist:linux y luego
//   xvfb-run -a dbus-run-session -- sh pruebas/con-llavero.sh npm run prueba:escritorio
// Sin llavero la prueba corre igual y la bóveda cifrada queda sin probar; con
// ARKEN_PRECIOS_EXIGIR_LLAVERO=1 (así corre en CI) la falta de llavero es una falla.

import { _electron as electron } from 'playwright-core';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PRECIOS, vigilarErrores, ingresarPrecios, cerrarModales, irA, marcador } from './comun.mjs';

const marca = marcador('La app de escritorio empacada (Linux)');
const m = {
  ok(cond, msg, detalle) {
    return marca.ok(cond, msg + (!cond && detalle !== undefined ? ' · ' + JSON.stringify(detalle).slice(0, 700) : ''));
  },
};

const BINARIO = join(PRECIOS, 'dist', 'linux-unpacked', 'arken-precios');
const VERSION = JSON.parse(readFileSync(join(PRECIOS, 'package.json'), 'utf8')).version;
const CONTACTO = 'compras@constructora.example';
const CLAVE = 'sk-ant-api03-' + 'P'.repeat(24) + '_escritorio_' + 'x'.repeat(30) + 'AA'; // de mentira, con la forma de una clave
const TOKEN = 'tok_' + 'w'.repeat(40) + '_ESCRITORIO';
const CEMENTO = 'G02-0001';
const FUENTE = 'fu-tienda-prueba';
const exigirLlavero = process.env.ARKEN_PRECIOS_EXIGIR_LLAVERO === '1';

if (process.platform !== 'linux') {
  console.log('Esta prueba abre la app empacada para Linux; en este sistema no corre.');
  process.exit(0);
}
if (!existsSync(BINARIO)) {
  console.error('\n✖ No está la app empacada (' + BINARIO + '). Ejecute antes: npm run dist:linux\n');
  process.exit(1);
}

/* ── Una tienda de prueba en este equipo ── */
const LISTA = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Cementos · Tienda de prueba</title></head><body>
<h1>Cementos y morteros</h1>
<div class="item" data-sku="T1"><h2 class="nombre"><a href="/p/cemento-gris">Cemento Gris Uso General 50 Kg Prueba</a></h2><p class="valor">$ 31.111</p></div>
<div class="item" data-sku="T2"><h2 class="nombre"><a href="/p/mortero">Mortero Seco Para Pega 25 Kg Prueba</a></h2><p class="valor">Ahora $ 22.222</p><p class="antes">$ 24.444</p></div>
<div class="item" data-sku="T3"><h2 class="nombre"><a href="/p/consultar">Producto sin precio Prueba</a></h2><p class="valor">Consultar</p></div>
<p>Precios con IVA incluido. Página de prueba de ARKEN PRECIOS.</p>
</body></html>`;

async function crearTienda() {
  const pedidas = [];
  const s = createServer((req, res) => {
    const u = new URL(req.url, 'http://tienda');
    const h = req.headers;
    pedidas.push({ ruta: u.pathname, metodo: req.method, ua: h['user-agent'] || '', from: h.from || '', cookie: h.cookie || '', autorizacion: h.authorization || '' });
    if (u.pathname === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'set-cookie': 'rastreo=prueba; Path=/' });
      return res.end('User-agent: *\nDisallow: /privado/\n');
    }
    if (u.pathname === '/categoria/cementos') {
      res.writeHead(301, { location: '/c/cementos', 'set-cookie': 'otra=prueba; Path=/' });
      return res.end();
    }
    if (u.pathname === '/c/cementos') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', etag: '"lista-1"' });
      return res.end(LISTA);
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('No existe');
  });
  await new Promise((r) => s.listen(0, '127.0.0.1', r));
  return { base: 'http://127.0.0.1:' + s.address().port, pedidas, cerrar: () => new Promise((r) => s.close(r)) };
}

/* ── Abrir y cerrar la app con un perfil propio ── */
const perfiles = [];
const abiertas = new Set();
function nuevoPerfil() {
  const d = mkdtempSync(join(tmpdir(), 'arken-precios-escritorio-'));
  perfiles.push(d);
  return d;
}
const datosApp = (home) => join(home, '.config', 'ARKEN PRECIOS');
const entorno = (home) => Object.assign({}, process.env, { HOME: home, XDG_CONFIG_HOME: join(home, '.config') });

/** Abre la app y espera el programa listo. `aviso`: un texto de aviso que se espera al abrir. */
async function abrirApp(home, o = {}) {
  const app = await electron.launch({ executablePath: BINARIO, args: ['--no-sandbox', ...(o.args || [])], env: entorno(home), timeout: 60000 });
  abiertas.add(app);
  app.on('close', () => abiertas.delete(app));
  const p = await app.firstWindow();
  const errores = vigilarErrores(p);
  const aviso = o.aviso
    ? p.locator('#toasts .toast', { hasText: o.aviso }).first().waitFor({ timeout: 60000 }).then(() => true, () => false)
    : Promise.resolve(null);
  await p.waitForFunction(() => document.documentElement.dataset.listo === '1', null, { timeout: 60000 });
  await p.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
  return { app, p, errores, aviso };
}
/** Cierra la ventana como el usuario: el programa termina de guardar y la app sale. */
async function cerrarApp(app) {
  const cerrada = app.waitForEvent('close', { timeout: 30000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.close())).catch(() => {});
  await cerrada;
}
const ayudantes = (p) => ({
  bd: (fn, arg) => p.evaluate(fn, arg),
  async conAviso(texto, accion) {
    await p.evaluate(() => {
      const t = document.getElementById('toasts');
      if (t) t.innerHTML = '';
    });
    await accion();
    await p.locator('#toasts .toast', { hasText: texto }).first().waitFor({ timeout: 60000 });
  },
  boton: (texto) => p.click(`#modales .overlay:last-child .modal-foot button:text-is("${texto}")`),
});
/** Todos los archivos de una carpeta, con su contenido. */
function archivos(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) out.push(...archivos(ruta));
    else if (e.isFile() && statSync(ruta).size < 64 * 1024 * 1024) out.push({ ruta, datos: readFileSync(ruta) });
  }
  return out;
}
const hoyLocal = () => {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
};

const tienda = await crearTienda();
try {
  /* ════════════════  SIN LLAVERO  ════════════════
     --password-store=basic: Electron cifraría con una clave fija, que no protege nada. */
  {
    const home = nuevoPerfil();
    const { app, p, errores } = await abrirApp(home, { args: ['--password-store=basic'] });
    const { bd, conAviso } = ayudantes(p);
    const puente = await bd(async () => {
      const S = window.arkenPrecios.secretos;
      const falla = async (f) => {
        try {
          await f();
          return '';
        } catch (e) {
          return String(e.message || e);
        }
      };
      return {
        disponible: await S.disponible(),
        guardar: await falla(() => S.guardar('clave-ia', 'sk-ant-' + 'z'.repeat(30), {})),
        otroNombre: await falla(() => S.guardar('cualquier-cosa', 'valor', {})),
      };
    });
    m.ok(puente.disponible === false && /no ofrece cifrado/.test(puente.guardar), 'sin llavero, la bóveda dice que el sistema no cifra y no guarda la clave', puente);
    m.ok(/no guarda un secreto con ese nombre/.test(puente.otroNombre), 'la bóveda solo guarda la clave de API y el token del servidor', puente.otroNombre);
    await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
    const token = await bd(async (t) => ({ cifra: ClaveIA.cifradoDisponible(), donde: await ClaveServidor.guardar(t), estado: ClaveServidor.estado().donde }), TOKEN);
    m.ok(!token.cifra && token.donde === 'sesión' && token.estado === 'sesión', 'el programa lo sabe de entrada: el token del servidor queda solo en la sesión, sin error', token);
    await bd(() => {
      Sesion.tabs['10'] = 'ia';
      App.ir('10');
    });
    await p.waitForSelector('#iaGuardarClave');
    const ui = await bd(() => ({
      equipo: document.querySelector('input[name="iaDonde"][value="equipo"]').disabled,
      sesion: document.querySelector('input[name="iaDonde"][value="sesion"]').checked,
      tarjeta: document.getElementById('iaGuardarClave').closest('.card').textContent,
    }));
    m.ok(ui.equipo && ui.sesion && /no ofrece cifrado/.test(ui.tarjeta) && /llavero/.test(ui.tarjeta) && /esta app/.test(ui.tarjeta),
      'Configuración › Investigador IA: «Guardarla cifrada» no se puede elegir y dice por qué; el texto habla de la app, no del navegador', ui.tarjeta.slice(0, 400));
    await p.check('#iaAutorizo');
    await p.fill('#iaClave', CLAVE);
    await conAviso('Clave lista para esta sesión', () => p.click('#iaGuardarClave'));
    m.ok(await bd(() => ClaveIA.estado().donde === 'sesión'), 'la clave se usa solo en esta sesión');
    await cerrarApp(app);
    const dir = datosApp(home);
    const copia = gunzipSync(readFileSync(join(dir, 'datos', 'copia.json.gz'))).toString('utf8');
    m.ok(!existsSync(join(dir, 'secretos.json')) && !copia.includes(CLAVE) && !copia.includes(TOKEN), 'al cerrar no queda ni la clave ni el token en ningún archivo de la app (ni en la copia interna)');
    m.ok(errores.length === 0, 'sin llavero: sin errores de JavaScript', errores.slice(0, 3));
  }

  /* ════════════════  LA APP, DE PUNTA A PUNTA  ════════════════ */
  const home = nuevoPerfil();
  const dir = datosApp(home);
  let { app, p, errores } = await abrirApp(home);
  let h = ayudantes(p);
  const llavero = await p.evaluate(() => window.arkenPrecios.secretos.disponible());
  if (!llavero) {
    if (exigirLlavero) m.ok(false, 'hay un llavero desbloqueado para la bóveda (ARKEN_PRECIOS_EXIGIR_LLAVERO=1)');
    else marca.nota('Este equipo no tiene llavero: la bóveda cifrada no se prueba aquí (con pruebas/con-llavero.sh sí).');
  }

  /* ── La app y el puente ── */
  const base = await h.bd(() => ({
    origen: location.origin,
    seguro: isSecureContext,
    version: window.arkenPrecios.version,
    plataforma: window.arkenApp && window.arkenApp.plataforma,
    movil: window.arkenApp && window.arkenApp.movil,
    puente: ['secretos', 'motor', 'copia'].map((k) => k + ':' + Object.keys(window.arkenPrecios[k]).sort().join()).join(' '),
    externos: performance
      .getEntriesByType('resource')
      .map((r) => r.name)
      .filter((u) => !/^(app|blob|data):/.test(u)),
    scripts: Array.from(document.scripts)
      .map((s) => s.src)
      .filter((s) => s && !s.startsWith('app://precios/')),
    librerias: [typeof jspdf, typeof XLSX, typeof pdfjsLib].join(),
    lectorPdf: window.pdfjsLib && pdfjsLib.GlobalWorkerOptions.workerSrc,
    node: typeof require + ' ' + typeof process,
  }));
  m.ok(base.origen === 'app://precios' && base.seguro && base.version === VERSION && base.plataforma === 'linux' && base.movil === false,
    'el programa se sirve desde app://precios, en contexto seguro, con la versión de la app (' + VERSION + ')', base);
  m.ok(base.puente === 'secretos:borrar,disponible,guardar,info,leer motor:alEvento,cancelar,correr,probar copia:abrirCarpeta,borrar,guardar,leer,meta',
    'el puente window.arkenPrecios trae la bóveda, el motor y la copia', base.puente);
  m.ok(base.externos.length === 0 && base.scripts.length === 0 && base.librerias === 'object,object,object' && base.lectorPdf === 'app://precios/vendor/pdf.worker.min.js',
    'sin internet: las librerías de Excel y PDF y el lector de PDF salen de la app', base);
  m.ok(base.node === 'undefined undefined', 'la página no tiene acceso a Node: todo pasa por el puente');
  // La política de seguridad de la app (CSP, §16): solo corren sus scripts; un atributo on… colado no se ejecuta
  const politica = await h.bd(async () => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' · ' + (e.blockedURI || 'en línea')));
    const meta = (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '';
    const d = document.createElement('div');
    d.innerHTML = '<img src="data:," onerror="window.__colado = 1">';
    document.body.appendChild(d);
    await new Promise((r) => setTimeout(r, 400));
    d.remove();
    const r = { huellas: (meta.match(/'sha256-/g) || []).length, corrio: window.__colado === 1, bloqueado: window.__csp.slice() };
    window.__csp.length = 0;
    return r;
  });
  for (let i = errores.length - 1; i >= 0; i--) if (/inline event handler/.test(errores[i])) errores.splice(i, 1);
  m.ok(politica.huellas === 4 && !politica.corrio && politica.bloqueado.length === 1 && /^script-src/.test(politica.bloqueado[0]),
    'la app trae su política de seguridad: solo corren sus scripts y un atributo onerror colado no se ejecuta', politica);
  const principal = await app.evaluate(({ app: a, Menu }) => ({
    empacada: a.isPackaged,
    datos: a.getPath('userData'),
    menu: Menu.getApplicationMenu().items.map((i) => i.label),
    roles: JSON.stringify(Menu.getApplicationMenu().items.map((i) => (i.submenu ? i.submenu.items.map((s) => s.role || s.label) : []))),
  }));
  m.ok(principal.empacada && principal.datos === dir && principal.menu.join() === 'Archivo,Edición,Ver,Ventana,Ayuda' && !/devtools/i.test(principal.roles) && /copias diarias/.test(principal.roles),
    'app empacada: datos en ~/.config/ARKEN PRECIOS, menú en español, sin herramientas de desarrollo', principal);

  /* ── Enlaces de afuera ── */
  const desvio = await app.evaluate(({ shell }) => {
    try {
      globalThis.__abiertas = [];
      shell.openExternal = async (u) => {
        globalThis.__abiertas.push(u);
      };
      return true;
    } catch (e) {
      return false;
    }
  });
  if (desvio) {
    const ventanas = await h.bd(() => [window.open('https://www.example.com/precios?x=1'), window.open('file:///etc/passwd')].map((v) => v === null));
    await p.waitForTimeout(500);
    const fuera = await app.evaluate(() => globalThis.__abiertas);
    // Chromium avisa en la consola que no carga el archivo local: es lo que se buscaba, no un error del programa
    for (let i = errores.length - 1; i >= 0; i--) if (/Not allowed to load local resource: file:\/\/\/etc\/passwd/.test(errores[i])) errores.splice(i, 1);
    m.ok(ventanas.every(Boolean) && fuera.join() === 'https://www.example.com/precios?x=1',
      'los enlaces de afuera se abren en el navegador del sistema (nunca en una ventana de la app) y un archivo local no se abre', { ventanas, fuera });
  } else marca.nota('No se pudo interceptar shell.openExternal: los enlaces de afuera no se prueban aquí.');

  await ingresarPrecios(p, 'admin', 'arken', 'prueba123');

  /* ── Bóveda con llavero: la clave de API ── */
  if (llavero) {
    await h.bd(() => {
      Sesion.tabs['10'] = 'ia';
      App.ir('10');
    });
    await p.waitForSelector('#iaGuardarClave');
    m.ok(await h.bd(() => !document.querySelector('input[name="iaDonde"][value="equipo"]').disabled), 'con llavero se puede guardar la clave cifrada en el equipo');
    await p.check('#iaAutorizo');
    await p.fill('#iaClave', CLAVE);
    await p.check('input[name="iaDonde"][value="equipo"]');
    await h.conAviso('Clave guardada, cifrada, en este equipo', () => p.click('#iaGuardarClave'));
    const sec = await h.bd(
      async (k) => ({
        estado: ClaveIA.estado(),
        idb: JSON.stringify(await BD.todos('secretos')).includes(k),
        html: document.documentElement.outerHTML.includes(k),
        almacen: JSON.stringify(Object.assign({}, localStorage, sessionStorage)).includes(k),
        respaldo: JSON.stringify(await Respaldos.armar()).includes(k),
        leida: (ClaveIA.olvidarSesion(), (await ClaveIA.obtener()) === k),
      }),
      CLAVE,
    );
    m.ok(sec.estado.donde === 'equipo' && sec.estado.escritorio && sec.leida && !sec.idb && !sec.html && !sec.almacen && !sec.respaldo,
      'la clave queda en la bóveda del sistema: el programa la lee de allí y no está en la base, la página, el almacenamiento ni el respaldo (criterio 8)', sec);
    const archivo = join(dir, 'secretos.json');
    const crudo = readFileSync(archivo, 'utf8');
    const x = JSON.parse(crudo);
    const s = x.secretos['clave-ia'] || {};
    m.ok(Object.keys(x.secretos).join() === 'clave-ia' && !crudo.includes(CLAVE) && !Buffer.from(String(s.cifrado), 'base64').toString('latin1').includes(CLAVE) &&
      s.meta.final === CLAVE.slice(-4) && (statSync(archivo).mode & 0o777) === 0o600,
      'secretos.json guarda la clave cifrada por el sistema (no legible), con sus últimos caracteres, y solo el usuario lo puede leer', { meta: s.meta, modo: (statSync(archivo).mode & 0o777).toString(8) });
  }

  /* ── El motor: contacto, fuente, prueba técnica y activación ── */
  await h.bd(() => {
    Sesion.tabs['10'] = 'motor';
    App.ir('10');
  });
  await p.waitForSelector('#cfMotor');
  m.ok(/app de escritorio/.test(await p.textContent('#cfMotor')), 'Configuración › Motor dice que el motor corre en este equipo');
  await p.fill('#cfMotor #f_contacto', CONTACTO);
  await h.conAviso('Motor guardado', () => p.click('#cfMotorG'));
  await irA(p, '03');
  await h.bd(
    async ({ id, base }) => {
      await Datos.guardar('fuentes', {
        id,
        nombre: 'Tienda de prueba (este equipo)',
        tipo: 'tienda en línea',
        metodo: 'html',
        urlBase: base,
        alcance: 'ciudad',
        ciudades: ['11001'],
        confiabilidad: 0.6,
        salud: 'suspendida',
        limitePorMinuto: 0,
        categorias: [],
        notas: '',
        esDemo: false,
        creado: ahoraISO(),
        actualizado: ahoraISO(),
        ultimaPrueba: null,
        configuracion: {
          modo: 'lista',
          lista: { urls: [base + '/categoria/cementos'] },
          tarjeta: '.item',
          campos: { titulo: '.nombre', enlace: '.nombre a@href', precio: '.valor', precioAnterior: '.antes', id: '@data-sku' },
          incluyeIva: true,
          ciudad: 'Bogotá',
        },
        revisionLegal: {
          resultado: 'aprobada',
          fecha: hoyISO(),
          robotsTxt: 'User-agent: * · Disallow: /privado/ (las categorías y los productos se pueden leer).',
          terminos: 'Tienda de prueba de ARKEN PRECIOS en este equipo: permite el acceso automatizado.',
          responsable: 'Persona de prueba',
          firmadoPor: 'admin',
        },
      });
      App.render();
      FuentesUI.ficha(id);
    },
    { id: FUENTE, base: tienda.base },
  );
  await p.waitForSelector('#f3Probar');
  m.ok(await h.bd(() => !document.getElementById('f3Probar').disabled && document.getElementById('f3Activar').disabled), 'la ficha deja probar la fuente, y activarla solo después');
  await p.click('#f3Probar');
  await p.waitForSelector('#modales .modal h3:text-matches("Prueba técnica: ")', { timeout: 120000 });
  const prueba = await p.textContent('#modales .overlay:last-child .modal');
  await h.boton('Ver la ficha');
  await p.waitForSelector('#f3Activar');
  const fichaProbada = await h.bd((id) => Datos.fuente(id).ultimaPrueba, FUENTE);
  m.ok(/Prueba técnica: aprobada/.test(prueba) && fichaProbada.resultado === 'aprobada' && fichaProbada.donde === 'escritorio' && fichaProbada.verificados >= 1 && /^ARKEN-PRECIOS\//.test(fichaProbada.agente),
    'la prueba técnica corre en el motor de la app y se aprueba con precios verificados', { prueba: prueba.slice(0, 300), fichaProbada });
  await p.click('#f3Activar');
  await h.conAviso('Fuente activa', () => h.boton('Activar'));
  const pedidas = tienda.pedidas.slice();
  m.ok(pedidas.length >= 3 && pedidas[0].ruta === '/robots.txt', 'lo primero que pide a la tienda es su robots.txt', pedidas.map((x) => x.ruta));
  m.ok(pedidas.every((x) => /^ARKEN-PRECIOS\/\d+\.\d+\.\d+ \(\+https:\/\/github\.com\/aboteroproyectos\/arken; contacto: /.test(x.ua) && x.ua.includes(CONTACTO) && x.from === CONTACTO),
    'cada solicitud lleva el agente ARKEN-PRECIOS con el correo de contacto (User-Agent y From)', pedidas[0]);
  m.ok(pedidas.findIndex((x) => x.ruta === '/categoria/cementos') >= 0 && pedidas.findIndex((x) => x.ruta === '/c/cementos') > pedidas.findIndex((x) => x.ruta === '/categoria/cementos'),
    'la redirección (301) la revisa el motor y pide él mismo el destino', pedidas.map((x) => x.ruta));
  m.ok(pedidas.every((x) => !x.cookie && !x.autorizacion) && pedidas.every((x) => x.metodo === 'GET'), 'no devuelve las cookies que puso la tienda ni envía credenciales', pedidas.map((x) => x.cookie));

  /* ── Módulo 02: leer la fuente ── */
  await cerrarModales(p);
  await h.bd(
    ({ ins }) => {
      Sesion.tabs['02'] = 'actualizar';
      App.ir('02', { alcance: 'insumos', insumoIds: [ins], ciudades: ['11001'] });
    },
    { ins: CEMENTO },
  );
  await p.waitForSelector('#a2Ejecutar');
  m.ok(/Leer 1 fuente\(s\)/.test(await p.textContent('#a2Ejecutar')), 'Módulo 02: la vista previa ofrece leer la fuente activa', await p.textContent('#a2Ejecutar'));
  await p.click('#a2Ejecutar');
  await p.waitForSelector('#a2Nueva', { timeout: 180000 });
  const res = await p.textContent('#a2Paso');
  const leido = await h.bd(async (fid) => {
    const ej = Datos.lista('ejecuciones').sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
    const obs = (await BD.todos('observaciones')).filter((o) => o.fuenteId === fid);
    return {
      ej: { modo: ej.modo, donde: ej.conectores && ej.conectores.donde, fuentes: ej.conectores && ej.conectores.fuentes.map((f) => f.fuenteId + ':' + f.estado) },
      obs: obs.map((o) => ({ insumoId: o.insumoId, precio: o.precioPublicado, ciudad: o.ciudad, url: o.url, verificacion: o.verificacion, lit: o.textoLiteral, hash: o.hashEvidencia })),
      lectura: Datos.fuente(fid).ultimaLectura,
    };
  }, FUENTE);
  const cemento = leido.obs.find((o) => o.insumoId === CEMENTO);
  m.ok(/Resultado por fuente/.test(res) && leido.ej.donde === 'escritorio' && leido.ej.fuentes.join() === FUENTE + ':leída', 'el resultado dice que la fuente se leyó desde la app de escritorio', leido.ej);
  m.ok(cemento && cemento.precio === 31111 && cemento.ciudad === '11001' && cemento.url === tienda.base + '/p/cemento-gris' && cemento.verificacion === 'texto leído por el conector' &&
    /\$ 31\.111/.test(cemento.lit) && /^[0-9a-f]{64}$/.test(cemento.hash),
    'el cemento entra con su precio (31.111), su ciudad, su enlace y el texto literal leído', leido.obs);
  m.ok(leido.lectura && leido.lectura.estado === 'leída', 'la ficha guarda su última lectura', leido.lectura);
  const bitacora = JSON.parse(readFileSync(join(dir, 'motor', 'ultima-lectura.json'), 'utf8'));
  m.ok(String(bitacora.agente).includes(CONTACTO) && bitacora.fuentes[FUENTE] && bitacora.fuentes[FUENTE].estado === 'leída' && Array.isArray(bitacora.bitacora) &&
    existsSync(join(dir, 'motor', 'cache')) && readdirSync(join(dir, 'motor', 'cache')).length > 0,
    'la bitácora de la última lectura y la caché del motor quedan en la carpeta de la app', Object.keys(bitacora));

  /* ── Una sola copia de la app ── */
  const segunda = spawn(BINARIO, ['--no-sandbox'], { env: entorno(home), stdio: 'ignore' });
  const salida = await new Promise((r) => {
    const t = setTimeout(() => {
      segunda.kill();
      r('sigue abierta');
    }, 30000);
    segunda.on('exit', (c) => {
      clearTimeout(t);
      r(c);
    });
  });
  m.ok(salida === 0 && (await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)) === 1,
    'una segunda copia de la app no abre otra ventana sobre los mismos datos: se cierra y deja la primera', salida);

  /* ── Un PDF que el programa abre en otra ventana (imprimir en una pantalla táctil pequeña) ── */
  const carpetaPdf = mkdtempSync(join(tmpdir(), 'arken-precios-pdf-'));
  await app.evaluate(({ session }, carpeta) => {
    session.defaultSession.on('will-download', (_e, item) => {
      globalThis.__nombrePdf = item.getFilename();
      item.setSavePath(carpeta + '/documento.pdf'); // en lugar del cuadro «Guardar archivo»
      item.once('done', (_e2, estado) => {
        globalThis.__pdf = estado;
      });
    });
  }, carpetaPdf);
  await h.bd(() => {
    const doc = new jspdf.jsPDF();
    doc.text('ARKEN PRECIOS', 20, 20);
    window.open(URL.createObjectURL(doc.output('blob')), '_blank');
  });
  const t0pdf = Date.now();
  while (!(await app.evaluate(() => globalThis.__pdf)) && Date.now() - t0pdf < 15000) await new Promise((r) => setTimeout(r, 200));
  const pdf = await app.evaluate(({ BrowserWindow }) => ({ estado: globalThis.__pdf, ventanas: BrowserWindow.getAllWindows().length }));
  const bytesPdf = existsSync(join(carpetaPdf, 'documento.pdf')) ? readFileSync(join(carpetaPdf, 'documento.pdf')) : Buffer.alloc(0);
  m.ok(pdf.estado === 'completed' && pdf.ventanas === 1 && bytesPdf.subarray(0, 5).toString() === '%PDF-',
    'un PDF que el programa abre en otra ventana no deja una ventana vacía: se ofrece guardarlo', pdf);
  rmSync(carpetaPdf, { recursive: true, force: true });

  const bloqueado = await h.bd(() => (window.__csp || ['la página se recargó y no se pudo vigilar']).slice());
  m.ok(bloqueado.length === 0, 'la política de seguridad no bloqueó nada del programa en toda la sesión (bóveda, motor, fuentes, Módulo 02)', bloqueado);

  /* ── Al cerrar: copia interna, copia del día y bitácora ── */
  const obsAntes = leido.obs.length;
  await cerrarApp(app);
  m.ok(errores.length === 0, 'primera sesión: sin errores de JavaScript', errores.slice(0, 3));
  const textoCopia = gunzipSync(readFileSync(join(dir, 'datos', 'copia.json.gz'))).toString('utf8');
  const copia = JSON.parse(textoCopia);
  const meta = JSON.parse(readFileSync(join(dir, 'datos', 'copia-meta.json'), 'utf8'));
  const alm = (copia.contenido && copia.contenido.almacenes) || {};
  m.ok((alm.fuentes || []).some((f) => f.id === FUENTE && f.salud === 'activa') && (alm.observaciones || []).some((o) => o.fuenteId === FUENTE && o.precioPublicado === 31111) && !('secretos' in alm),
    'al cerrar, la copia interna tiene todo lo del día (la fuente activa y su precio) y no la bóveda', Object.keys(alm));
  m.ok(meta.actualizado > 0 && meta.caracteres === textoCopia.length && !textoCopia.includes(CLAVE) && !textoCopia.includes(TOKEN), 'la copia no lleva claves y su ficha dice cuándo se hizo', meta);
  const diaria = join(dir, 'datos', 'copias-diarias', 'ARKEN_PRECIOS_copia_' + hoyLocal() + '.json.gz');
  const textoDiaria = existsSync(diaria) ? gunzipSync(readFileSync(diaria)).toString('utf8') : '';
  m.ok(textoDiaria && readdirSync(join(dir, 'datos', 'copias-diarias')).length === 1, 'queda la copia del día en copias-diarias/', readdirSync(join(dir, 'datos')));
  m.ok(existsSync(join(dir, 'ventana.json')), 'la app recuerda el tamaño y la posición de la ventana');
  if (llavero) {
    const conClave = archivos(dir).filter((a) => a.datos.includes(Buffer.from(CLAVE)) || a.datos.includes(Buffer.from(CLAVE, 'utf16le')));
    m.ok(conClave.length === 0, 'ningún archivo de la app tiene la clave escrita (la base del navegador, la caché, la bitácora, las copias)', conClave.map((a) => a.ruta));
  }

  /* ── Al abrir otra vez ── */
  ({ app, p, errores } = await abrirApp(home));
  h = ayudantes(p);
  await ingresarPrecios(p, 'admin', 'prueba123');
  const despues = await h.bd(async (fid) => ({
    salud: Datos.fuente(fid) && Datos.fuente(fid).salud,
    obs: (await BD.todos('observaciones')).filter((o) => o.fuenteId === fid).length,
    clave: ClaveIA.estado().donde,
  }), FUENTE);
  m.ok(despues.salud === 'activa' && despues.obs === obsAntes && (!llavero || despues.clave === 'equipo'), 'al abrir otra vez todo sigue: la fuente activa, sus precios y la clave en la bóveda', despues);
  const verificada = await h.bd((t) => Formatos.verificar(JSON.parse(t), Formatos.RESPALDO), textoDiaria);
  m.ok(verificada && verificada.ok, 'la copia del día es un respaldo válido, de los que abre «Restaurar…»', verificada);
  await h.bd(() => Admin.abrir('respaldos'));
  await p.waitForSelector('[data-copia-interna]');
  await p.waitForFunction(() => /Última copia/.test(document.querySelector('[data-copia-interna]').textContent), null, { timeout: 10000 }).catch(() => {});
  const panel = await h.bd(() => ({
    copia: document.querySelector('[data-copia-interna]').textContent,
    boton: !!document.querySelector('[data-copias-diarias]'),
    aviso: (document.querySelector('#adCuerpo .alert.warn') || {}).textContent || '',
  }));
  m.ok(/Última copia/.test(panel.copia) && /últimos 10 días/.test(panel.copia) && panel.boton, 'Administración › Respaldos muestra la copia interna, la última fecha y la carpeta de copias diarias', panel);
  await cerrarModales(p);
  await cerrarApp(app);
  m.ok(errores.length === 0, 'segunda sesión: sin errores de JavaScript', errores.slice(0, 3));

  /* ── Si el almacenamiento interno se pierde ── */
  rmSync(join(dir, 'IndexedDB'), { recursive: true, force: true });
  let aviso;
  ({ app, p, errores, aviso } = await abrirApp(home, { aviso: 'Se recuperaron los datos de la copia interna' }));
  h = ayudantes(p);
  const avisado = await aviso;
  await ingresarPrecios(p, 'admin', 'prueba123');
  const rec = await h.bd(async (fid) => ({
    salud: Datos.fuente(fid) && Datos.fuente(fid).salud,
    obs: (await BD.todos('observaciones')).filter((o) => o.fuenteId === fid).length,
    auditoria: (await BD.todos('auditoria')).filter((a) => a.accion === 'recuperar copia interna').map((a) => a.detalle),
    clave: ClaveIA.estado().donde,
  }), FUENTE);
  m.ok(avisado && rec.salud === 'activa' && rec.obs === obsAntes && rec.auditoria.length === 1, 'sin la base del navegador, la app recupera los datos de la copia interna, lo avisa y lo anota en la auditoría', Object.assign({ avisado }, rec));
  m.ok(!llavero || rec.clave === 'equipo', 'la clave sigue en la bóveda del sistema: no dependía de la base');
  m.ok(errores.length === 0, 'recuperación: sin errores de JavaScript', errores.slice(0, 3));

  /* ── La ventana no sale de la app ── (al final: después de esto la página no se vuelve a usar) */
  const desvio2 = await app.evaluate(({ shell }) => {
    try {
      globalThis.__abiertas = [];
      shell.openExternal = async (u) => {
        globalThis.__abiertas.push(u);
      };
      return true;
    } catch (e) {
      return false;
    }
  });
  if (desvio2) {
    // «Enviar» un correo de la bandeja de salida de las alertas es un enlace mailto: sin ventana nueva
    await h.bd(() => {
      const a = document.createElement('a');
      a.href = 'mailto:costos%40ejemplo.com?subject=ARKEN%20PRECIOS';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
    await new Promise((r) => setTimeout(r, 1000));
    const correo = await app.evaluate(({ BrowserWindow }) => ({ url: BrowserWindow.getAllWindows()[0].webContents.getURL(), fuera: globalThis.__abiertas.slice() }));
    m.ok(correo.url === 'app://precios/index.html' && correo.fuera.join() === 'mailto:costos%40ejemplo.com?subject=ARKEN%20PRECIOS',
      'un correo de la bandeja de salida de las alertas se abre en el programa de correo del sistema', correo);
    await app.evaluate(() => { globalThis.__abiertas = []; });
    await h.bd(() => {
      location.href = 'https://www.example.com/otra';
    });
    await new Promise((r) => setTimeout(r, 1500));
    const nav = await app.evaluate(({ BrowserWindow }) => ({ url: BrowserWindow.getAllWindows()[0].webContents.getURL(), fuera: globalThis.__abiertas }));
    m.ok(nav.url === 'app://precios/index.html' && nav.fuera.join() === 'https://www.example.com/otra', 'si el programa intenta ir a otra página, la ventana se queda en la app y el enlace se abre en el navegador del sistema', nav);
  }
} catch (e) {
  m.ok(false, 'la prueba terminó sin errores inesperados: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  for (const a of abiertas) await a.close().catch(() => {});
  await tienda.cerrar();
  for (const d of perfiles) rmSync(d, { recursive: true, force: true });
}

console.log('\n' + (marca.fallas ? '✖ ' + marca.fallas + ' de ' + marca.pruebas + ' comprobaciones fallaron.' : marca.pruebas + ' de ' + marca.pruebas + ' comprobaciones bien.'));
process.exit(marca.fallas ? 1 : 0);
