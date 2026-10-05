// ARKEN PRECIOS · la capa de la app y las piezas de la app de escritorio, sin empacar (Fase 3, §3 y §17.3).
//
//   · Node: la bóveda (solo dos nombres, una operación a la vez, sin cifrado no guarda, el archivo
//     solo para el usuario), las copias (comprimidas, la anterior si la escritura se cortó, una por
//     día y solo las últimas 10) y el motor de la app (una tarea a la vez, cancelar, bitácora y
//     caché en su carpeta, sin claves) con el internet de prueba
//   · Chromium con www/ (la carpeta que empaquetan Electron y Capacitor), con el puente de la app
//     de escritorio simulado: copia interna al cambiar los datos y al cerrar, nunca con algo con
//     forma de clave; recuperación de una base vacía; «Guardar copia» igual al archivo del
//     repositorio; el panel de respaldos
//   · Chromium con Capacitor simulado (Android): archivos al visor o al menú Compartir, imprimir,
//     enlaces a otras apps, botón «atrás», compartir, copia en los archivos internos de la app al
//     pasar a segundo plano y recuperación
//   · La política de seguridad de la app (CSP): solo corren sus scripts, un atributo on… colado no
//     se ejecuta, y en todos los módulos, el tablero (su Web Worker), los PDF y los Excel no bloquea
//     nada del programa
//
// La app de escritorio empacada, con Electron de verdad, la prueba pruebas/escritorio.mjs.
// Uso: npm run prueba:app   (www/ se prepara antes con npm run preparar)

import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PRECIOS, servidor, navegador, vigilarErrores, ingresarPrecios, cerrarModales, irA, marcador } from './comun.mjs';
import { cargarNucleo } from '../motor/nucleo.mjs';
import { internetNormal, fuentesDePrueba, OPCIONES_RAPIDAS, CONTACTO } from './fixtures/motor/internet.mjs';

const requerir = createRequire(import.meta.url);
const { crearBoveda, cifradoDelSistema, NOMBRES } = requerir('../electron/boveda.cjs');
const { crearCopias, RE_DIARIA } = requerir('../electron/copias.cjs');
const { crearMotor } = requerir('../electron/motor.cjs');

const marca = marcador('La capa de la app y las piezas de la app de escritorio');
const m = {
  ok(cond, msg, detalle) {
    return marca.ok(cond, msg + (!cond && detalle !== undefined ? ' · ' + JSON.stringify(detalle).slice(0, 700) : ''));
  },
};
const CLAVE = 'sk-ant-api03-' + 'Q'.repeat(30) + '_app_' + 'y'.repeat(20) + 'AA'; // de mentira, con la forma de una clave
const tmp = mkdtempSync(join(tmpdir(), 'arken-precios-app-'));
const falla = async (fn) => {
  try {
    await fn();
    return '';
  } catch (e) {
    return String((e && e.message) || e);
  }
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
/** Lo que la política de seguridad de la app (CSP) bloquea en las páginas del contexto, en orden. */
const vigilarCSP = (ctx) =>
  ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' · ' + (e.blockedURI || 'en línea') + (e.sample ? ' · ' + e.sample : '')));
  });

try {
  /* ════════════════  BÓVEDA (electron/boveda.cjs)  ════════════════ */
  {
    let cifra = true;
    // Un cifrado de prueba: invierte los bytes en hexadecimal (lo que importa es que no quede el texto)
    const cifrado = {
      disponible: () => cifra,
      cifrar: (t) => Buffer.from('v11' + Buffer.from(t, 'utf8').toString('hex').split('').reverse().join('')),
      descifrar: (b) => Buffer.from(b.toString().slice(3).split('').reverse().join(''), 'hex').toString('utf8'),
    };
    const archivo = join(tmp, 'boveda', 'secretos.json');
    const B = crearBoveda({ archivo, cifrado });
    m.ok(NOMBRES.size === 2 && NOMBRES.has('clave-ia') && NOMBRES.has('token-servidor'), 'bóveda: guarda solo la clave de API y el token del servidor');
    m.ok(B.disponible() && (await B.info('clave-ia')) === null && (await B.leer('clave-ia')) === null, 'bóveda vacía: sin archivo no hay secretos');
    await B.guardar('clave-ia', CLAVE, { final: CLAVE.slice(-4), usuario: 'admin', anidado: { x: 1 }, 'con espacio': 'x', largo: 'y'.repeat(300), n: 5, si: true });
    const info = await B.info('clave-ia');
    m.ok(info.final === 'yyAA' && info.usuario === 'admin' && !('anidado' in info) && !('con espacio' in info) && info.largo.length === 200 && info.n === 5 && info.si === true,
      'bóveda: de cada secreto guarda solo datos visibles cortos (texto, número o sí/no)', info);
    const crudo = readFileSync(archivo, 'utf8');
    m.ok((await B.leer('clave-ia')) === CLAVE && !crudo.includes(CLAVE) && (statSync(archivo).mode & 0o777) === 0o600, 'bóveda: el secreto queda cifrado en un archivo que solo el usuario puede leer, y se lee de vuelta');
    m.ok(/no guarda un secreto con ese nombre/.test(await falla(() => B.guardar('otra-cosa', 'x'))) && /no guarda un secreto/.test(await falla(() => B.leer('../secretos'))),
      'bóveda: cualquier otro nombre se rechaza');
    m.ok(/vacío o es demasiado largo/.test(await falla(() => B.guardar('token-servidor', '   '))) && /vacío o es demasiado largo/.test(await falla(() => B.guardar('token-servidor', 'z'.repeat(5000)))),
      'bóveda: no guarda un secreto vacío ni uno de más de 4.096 caracteres');
    const TOKEN = 'tok_' + 'k'.repeat(40);
    await Promise.all([B.guardar('token-servidor', TOKEN, { final: 'kkkk' }), B.borrar('clave-ia'), B.guardar('clave-ia', CLAVE + 'B', {})]);
    m.ok((await B.leer('token-servidor')) === TOKEN && (await B.leer('clave-ia')) === CLAVE + 'B', 'bóveda: varias operaciones seguidas se hacen en orden, sin pisarse el archivo');
    cifra = false;
    m.ok(/no ofrece cifrado/.test(await falla(() => B.guardar('clave-ia', CLAVE, {}))) && /llavero está bloqueado/.test(await falla(() => B.leer('clave-ia'))) && (await B.info('token-servidor')).final === 'kkkk',
      'bóveda: sin cifrado del sistema no guarda ni descifra, pero sigue mostrando qué hay guardado');
    await B.borrar('clave-ia');
    m.ok((await B.info('clave-ia')) === null && (await B.info('token-servidor')) !== null, 'bóveda: borrar quita solo ese secreto, aun sin cifrado');
    writeFileSync(archivo, '{ esto no es json');
    m.ok((await B.info('token-servidor')) === null, 'bóveda: un archivo dañado no detiene la app (no hay secretos)');
    const so = (backend, disponible = true) => ({ isEncryptionAvailable: () => disponible, getSelectedStorageBackend: () => backend, encryptString: () => Buffer.alloc(0), decryptString: () => '' });
    if (process.platform === 'linux') {
      m.ok(!cifradoDelSistema(so('basic_text')).disponible() && !cifradoDelSistema(so('unknown')).disponible() && cifradoDelSistema(so('gnome_libsecret')).disponible() && !cifradoDelSistema(so('kwallet6', false)).disponible(),
        'bóveda en Linux: el cifrado con clave fija («basic_text») cuenta como «sin cifrado»; el llavero sí cifra');
    }
  }

  /* ════════════════  COPIAS (electron/copias.cjs)  ════════════════ */
  {
    const carpeta = join(tmp, 'copias', 'datos');
    let ahora = new Date(2026, 9, 1, 10, 0, 0).getTime();
    const C = crearCopias({ carpeta, ahora: () => ahora });
    const diarias = () => (existsSync(join(carpeta, 'copias-diarias')) ? readdirSync(join(carpeta, 'copias-diarias')).filter((n) => RE_DIARIA.test(n)).sort() : []);
    const leerDiaria = (n) => gunzipSync(readFileSync(join(carpeta, 'copias-diarias', n))).toString('utf8');
    m.ok((await C.meta()) === null && (await C.leer()) === null, 'copias: al comienzo no hay copia');
    const t1 = JSON.stringify({ formato: 'prueba', n: 1, texto: 'ñandú ✓' });
    m.ok((await C.guardar(t1, 1234)) === true, 'copias: guarda la copia');
    const gz = readFileSync(join(carpeta, 'copia.json.gz'));
    const meta = await C.meta();
    m.ok(gz[0] === 0x1f && gz[1] === 0x8b && (await C.leer()) === t1 && meta.actualizado === 1234 && meta.caracteres === t1.length && meta.bytes === gz.length,
      'copias: la copia va comprimida (gzip), se lee igual (con tildes) y su ficha dice cuándo y cuánto', meta);
    m.ok(diarias().join() === 'ARKEN_PRECIOS_copia_2026-10-01.json.gz' && leerDiaria(diarias()[0]) === t1, 'copias: queda la copia del día con la fecha en el nombre', diarias());
    ahora += 5 * 60 * 1000;
    await C.guardar(JSON.stringify({ n: 2 }), ahora);
    m.ok(leerDiaria(diarias()[0]) === t1 && JSON.parse(await C.leer()).n === 2, 'copias: la copia interna se renueva siempre; la del día, cada 10 minutos de trabajo');
    ahora += 6 * 60 * 1000;
    await C.guardar(JSON.stringify({ n: 3 }), ahora);
    m.ok(JSON.parse(leerDiaria(diarias()[0])).n === 3, 'copias: pasados 10 minutos, la del día queda con lo último');
    writeFileSync(join(carpeta, 'copias-diarias', 'notas del usuario.txt'), 'no se borra');
    for (let d = 2; d <= 13; d++) {
      ahora = new Date(2026, 9, d, 9, 0, 0).getTime();
      await C.guardar(JSON.stringify({ dia: d }), ahora);
    }
    const quedan = diarias();
    m.ok(quedan.length === 10 && quedan[0] === 'ARKEN_PRECIOS_copia_2026-10-04.json.gz' && quedan[9] === 'ARKEN_PRECIOS_copia_2026-10-13.json.gz' && existsSync(join(carpeta, 'copias-diarias', 'notas del usuario.txt')),
      'copias: quedan las de los últimos 10 días, y lo que no es una copia no se toca', quedan);
    writeFileSync(join(carpeta, 'copia.json.gz'), Buffer.from('cortado a la mitad'));
    writeFileSync(join(carpeta, 'copia.json.gz.tmp'), gzipSync(Buffer.from('{"rescatada":true}')));
    m.ok((await C.leer()) === '{"rescatada":true}', 'copias: si la escritura se cortó al reemplazar el archivo, se lee la copia anterior');
    m.ok((await C.guardar('', 1)) === false && (await C.guardar(null, 1)) === false && JSON.parse((await C.leer()) || '{}').rescatada, 'copias: nunca reemplaza la copia con un texto vacío');
    await C.borrar();
    m.ok((await C.meta()) === null && diarias().length === 10, 'copias: borrar la copia interna deja las copias diarias');
  }

  /* ════════════════  MOTOR DE LA APP (electron/motor.cjs)  ════════════════ */
  {
    const N = cargarNucleo(undefined, { semilla: true });
    const C = N.Conectores;
    const CATALOGO = N.Semilla.catalogo();
    const CEMENTO = 'G02-0001';
    const net = internetNormal();
    let demora = 0;
    const fetchLento = async (url, init) => {
      if (demora) await pausa(demora);
      return net.fetch(url, init);
    };
    const carpeta = join(tmp, 'motor');
    const M = crearMotor({ programa: join(PRECIOS, 'programa', 'ARKEN_PRECIOS.html'), carpeta, fetch: fetchLento, opcionesRed: OPCIONES_RAPIDAS });
    const easy = fuentesDePrueba(C)[0];
    const plan = { contacto: CONTACTO, fuentes: [Object.assign({}, easy, { notas: 'pegada por error: ' + CLAVE })], insumos: CATALOGO, busquedas: { easy: [{ insumoId: CEMENTO }] } };
    const eventos = [];
    const r = await M.correr(plan, (e) => eventos.push(e));
    m.ok(r.fuentes.easy && r.fuentes.easy.estado === 'leída' && r.hallazgos.some((h) => h.insumoId === CEMENTO) && !('bitacora' in r) && eventos.some((e) => e.tipo === 'inicio'),
      'motor de la app: corre el plan, avisa el avance y devuelve lo leído (sin la bitácora)', r.fuentes.easy);
    const bit = readFileSync(join(carpeta, 'ultima-lectura.json'), 'utf8');
    const b = JSON.parse(bit);
    m.ok(b.fuentes.easy.estado === 'leída' && Array.isArray(b.bitacora) && b.bitacora.some((x) => x.tipo === 'solicitud') && readdirSync(join(carpeta, 'cache')).length > 0,
      'motor de la app: deja la bitácora de la última lectura y la caché en su carpeta', Object.keys(b));
    m.ok(!bit.includes(CLAVE) && !JSON.stringify(r).includes(CLAVE) && !JSON.stringify(net.pedidas).includes(CLAVE), 'motor de la app: algo con forma de clave en el plan no llega a la red, al resultado ni a la bitácora');
    const antes = net.pedidas.length;
    const r2 = await M.correr(plan, () => {});
    m.ok(r2.fuentes.easy.estado === 'leída' && r2.fuentes.easy.desdeCache > 0 && net.pedidas.length - antes < antes, 'motor de la app: la segunda lectura usa la caché', { pedidas: net.pedidas.length - antes, desdeCache: r2.fuentes.easy.desdeCache });
    demora = 150;
    const enCurso = M.correr(Object.assign({}, plan, { busquedas: { easy: [{ insumoId: CEMENTO }, { insumoId: 'G13-0003' }] } }), () => {});
    await pausa(30);
    const ocupado = M.ocupado();
    const otra = await falla(() => M.correr(plan, () => {}));
    const prueba = await falla(() => M.probar(easy, { contacto: CONTACTO }));
    m.ok(ocupado === 'lectura' && /ya está leyendo las fuentes/.test(otra) && /ya está leyendo las fuentes/.test(prueba), 'motor de la app: una tarea a la vez (otra lectura o una prueba esperan)', { ocupado, otra, prueba });
    m.ok(M.cancelar() === true, 'motor de la app: la lectura en curso se puede cancelar');
    const cancelada = await enCurso;
    demora = 0;
    m.ok(cancelada.cancelado === true && M.ocupado() === null && M.cancelar() === false, 'motor de la app: la lectura cancelada termina y el motor queda libre', { cancelado: cancelada.cancelado });
    const pr = await M.probar(easy, { contacto: CONTACTO, limites: { busquedasPorFuente: 2 } });
    m.ok(pr.resultado === 'aprobada' && pr.verificados > 0, 'motor de la app: la prueba técnica de una ficha', pr);
    m.ok(/Falta la ficha/.test(await falla(() => M.probar({ nombre: 'sin id' }, {}))) && /plan del motor no es válido/.test(await falla(() => M.correr([], () => {}))) && /contacto/i.test(await falla(() => M.correr({ fuentes: [] }, () => {}))),
      'motor de la app: rechaza una ficha sin id, un plan que no es un objeto y un plan sin contacto');
  }

  /* ════════════════  LA CAPA EN CHROMIUM  ════════════════ */
  execFileSync(process.execPath, [join(PRECIOS, 'herramientas', 'preparar-web.mjs')], { stdio: 'ignore' });
  const RUTA = '/precios/www/index.html';
  const srv = await servidor();
  const nav = await navegador();
  const original = readFileSync(join(PRECIOS, 'programa', 'ARKEN_PRECIOS.html'), 'utf8');
  const etiquetas = (html) => (html.match(/<script\b[^>]*>/g) || []).concat(html.match(/<link\b[^>]*>/g) || []);
  try {
    /* ── Navegador normal: la capa no hace nada ── */
    {
      const ctx = await nav.newContext();
      const p = await ctx.newPage();
      const errores = vigilarErrores(p);
      await p.goto(srv.url(RUTA));
      await p.waitForFunction(() => document.documentElement.dataset.listo === '1', null, { timeout: 60000 });
      const web = await p.evaluate(() => ({ app: typeof window.arkenApp, worker: pdfjsLib.GlobalWorkerOptions.workerSrc }));
      m.ok(web.app === 'undefined' && !/vendor/.test(web.worker), 'en un navegador normal la capa de la app no hace nada', web);
      m.ok(errores.length === 0, 'navegador normal: sin errores de JavaScript', errores.slice(0, 3));
      await ctx.close();
    }

    /* ── Política de seguridad de contenido (CSP, §16): en la app solo corren sus scripts ── */
    {
      const ctx = await nav.newContext({ viewport: { width: 1366, height: 860 } });
      await vigilarCSP(ctx);
      const p = await ctx.newPage();
      const errores = vigilarErrores(p);
      await p.goto(srv.url(RUTA));
      await p.waitForFunction(() => document.documentElement.dataset.listo === '1', null, { timeout: 60000 });
      await p.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
      const csp = await p.evaluate(() => (document.querySelector('meta[http-equiv="Content-Security-Policy"]') || {}).content || '');
      const directiva = (n) => csp.split(';').map((d) => d.trim()).find((d) => d.split(' ')[0] === n) || '';
      const huellas = (directiva('script-src').match(/'sha256-[A-Za-z0-9+/=]+'/g) || []).length;
      m.ok(huellas === 4 && !/unsafe-inline|unsafe-eval|https?:|\*|data:|blob:/.test(directiva('script-src')) && directiva('object-src') === "object-src 'none'" &&
        directiva('base-uri') === "base-uri 'none'" && directiva('form-action') === "form-action 'none'",
        'la app trae su política de seguridad: solo corren sus scripts (los 4 del programa, por su huella), sin eval, objetos incrustados ni formularios', csp.slice(0, 300));
      await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
      // Un atributo on… colado en la página no corre: el texto externo ya se escapa (criterio 8) y, además, la política lo bloquea
      await p.evaluate(() => {
        const d = document.createElement('div');
        d.id = 'colado';
        d.innerHTML = '<img src="data:," onerror="window.__colado = 1">';
        document.body.appendChild(d);
      });
      await pausa(400);
      const colado = await p.evaluate(() => ({ corrio: window.__colado === 1, csp: window.__csp.slice() }));
      m.ok(!colado.corrio && colado.csp.length === 1 && /^script-src/.test(colado.csp[0]), 'un atributo onerror colado en la página no se ejecuta: la política de seguridad lo bloquea', colado);
      await p.evaluate(() => {
        document.getElementById('colado').remove();
        window.__csp.length = 0;
      });
      for (let i = errores.length - 1; i >= 0; i--) if (/inline event handler/.test(errores[i])) errores.splice(i, 1);
      // Con la política puesta: el tablero calcula en su Web Worker y los 12 módulos con sus pestañas se pintan
      const demo = await p.evaluate(() => Admin.cargarDemo({ silencioso: true, meses: 6, cobertura: 0.3 }));
      await cerrarModales(p);
      await irA(p, '00');
      await p.waitForFunction(() => document.getElementById('stage').dataset.ms !== undefined, null, { timeout: 60000 });
      const enPagina = await p.evaluate(() => Trabajador.enPagina);
      m.ok(demo && demo.observaciones > 0 && enPagina === false, 'con la política de seguridad, el tablero calcula en su Web Worker (no en la página)', { demo: demo && demo.observaciones, enPagina });
      const fallas = [];
      for (const mod of ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11']) {
        await irA(p, mod);
        await pausa(200);
        const tabs = await p.evaluate(() => Array.from(document.querySelectorAll('#stage .tabs:not(.sub) .tab')).map((t) => t.dataset.k));
        for (const t of [null, ...tabs.slice(1)]) {
          if (t) {
            await p.click(`#stage .tabs:not(.sub) .tab[data-k="${t}"]`);
            await pausa(150);
          }
          const f = await p.evaluate(() => (document.querySelector('#stage .warn-box') || {}).textContent || '');
          if (f) fallas.push(`${mod}${t ? '/' + t : ''}: ${f.slice(0, 120)}`);
        }
      }
      const bloqueado = await p.evaluate(() => window.__csp.slice());
      m.ok(fallas.length === 0 && bloqueado.length === 0, 'con la política de seguridad, los 12 módulos y sus pestañas se pintan y no se bloquea nada del programa', { fallas, bloqueado });
      m.ok(errores.length === 0, 'política de seguridad: sin errores de JavaScript', errores.slice(0, 3));
      await ctx.close();
    }

    /* ── App de escritorio con el puente simulado ── */
    const escritorio = { copia: null, guardadas: 0, carpetas: 0 };
    async function contextoEscritorio() {
      const ctx = await nav.newContext({ viewport: { width: 1366, height: 860 }, acceptDownloads: true });
      await ctx.exposeFunction('__copiaGuardar', (texto, actualizado) => {
        escritorio.copia = { texto, actualizado };
        escritorio.guardadas++;
        return true;
      });
      await ctx.exposeFunction('__copiaLeer', () => (escritorio.copia ? escritorio.copia.texto : null));
      await ctx.exposeFunction('__copiaMeta', () => (escritorio.copia ? { actualizado: escritorio.copia.actualizado, caracteres: escritorio.copia.texto.length } : null));
      await ctx.exposeFunction('__abrirCarpeta', () => {
        escritorio.carpetas++;
        return true;
      });
      await ctx.addInitScript(() => {
        Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true });
        const no = () => Promise.reject(new Error('no está en esta prueba'));
        window.arkenPrecios = {
          version: 'prueba',
          plataforma: 'linux',
          secretos: { disponible: () => Promise.resolve(false), guardar: no, info: () => Promise.resolve(null), leer: () => Promise.resolve(null), borrar: () => Promise.resolve(true) },
          motor: { correr: no, alEvento: () => () => {}, cancelar: () => Promise.resolve(false), probar: no },
          copia: {
            meta: () => window.__copiaMeta(),
            leer: () => window.__copiaLeer(),
            guardar: (t, a) => window.__copiaGuardar(t, a),
            borrar: () => Promise.resolve(true),
            abrirCarpeta: () => window.__abrirCarpeta(),
          },
          alCerrar: (fn) => {
            window.__alCerrar = fn;
          },
          listoParaCerrar: () => {
            window.__listos = (window.__listos || 0) + 1;
          },
        };
      });
      await vigilarCSP(ctx);
      return ctx;
    }
    const abrir = async (ctx, aviso) => {
      const p = await ctx.newPage();
      const errores = vigilarErrores(p);
      const avisado = aviso
        ? p.locator('#toasts .toast', { hasText: aviso }).first().waitFor({ timeout: 60000 }).then(() => true, () => false)
        : Promise.resolve(null);
      await p.goto(srv.url(RUTA));
      await p.waitForFunction(() => document.documentElement.dataset.listo === '1', null, { timeout: 60000 });
      await p.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
      return { p, errores, avisado };
    };
    {
      const ctx = await contextoEscritorio();
      const { p, errores } = await abrir(ctx);
      const capa = await p.evaluate(() => ({
        plataforma: window.arkenApp.plataforma,
        movil: window.arkenApp.movil,
        descargar: typeof window.arkenApp.descargar,
        imprimir: typeof window.arkenApp.imprimir,
        cerrar: typeof window.__alCerrar,
        worker: pdfjsLib.GlobalWorkerOptions.workerSrc,
      }));
      m.ok(capa.plataforma === 'linux' && !capa.movil && capa.descargar === 'undefined' && capa.imprimir === 'undefined' && capa.cerrar === 'function' && /\/vendor\/pdf\.worker\.min\.js$/.test(capa.worker),
        'escritorio: la capa se activa, deja descargas e impresión al sistema y avisa al cerrar', capa);
      m.ok(escritorio.guardadas === 0, 'escritorio: abrir el programa no escribe la copia (todavía no hay cambios)');
      await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
      await p.evaluate(() => Datos.fijarConfig('empresa', Object.assign({}, Datos.config('empresa', {}), { razonSocial: 'Constructora de prueba S.A.S.' })));
      await p.evaluate(() => window.arkenApp.guardarTodo());
      const copia1 = escritorio.copia && JSON.parse(escritorio.copia.texto);
      const verif1 = await p.evaluate((t) => Formatos.verificar(JSON.parse(t), Formatos.RESPALDO), escritorio.copia ? escritorio.copia.texto : '{}');
      m.ok(escritorio.guardadas === 1 && verif1.ok && JSON.stringify(copia1.contenido.almacenes.configuracion).includes('Constructora de prueba') && !('secretos' in copia1.contenido.almacenes),
        'escritorio: después de un cambio, la copia interna es el respaldo completo (con su hash) y sin la bóveda', verif1);

      // Algo con forma de clave pegado en los datos: la copia sale sin eso, como un respaldo
      await p.evaluate((k) => Datos.guardar('fuentes', Object.assign({}, Datos.fuente('easy'), { notas: 'pegada por error: ' + k })), CLAVE);
      await p.evaluate(() => window.arkenApp.guardarTodo());
      m.ok(escritorio.guardadas === 2 && !escritorio.copia.texto.includes(CLAVE) && escritorio.copia.texto.includes('pegada por error: [clave retirada]'),
        'escritorio: algo con forma de clave de API pegado en los datos no llega a la copia interna (sale «[clave retirada]»)');

      // Al cerrar la ventana (el proceso principal avisa): se copia lo pendiente y se confirma
      await p.evaluate(() => Datos.guardar('fuentes', Object.assign({}, Datos.fuente('easy'), { notas: '' })));
      await p.evaluate(() => window.__alCerrar());
      await p.waitForFunction(() => window.__listos === 1, null, { timeout: 15000 });
      m.ok(escritorio.guardadas === 3 && !escritorio.copia.texto.includes('pegada por error'), 'escritorio: al cerrar se copia lo pendiente y la app recibe «listo para cerrar»', escritorio.guardadas);

      // Sin pedirlo: la copia se hace sola unos segundos después del último cambio
      await p.evaluate(() => Datos.fijarConfig('empresa', Object.assign({}, Datos.config('empresa', {}), { nit: '900123456' })));
      const t0 = Date.now();
      while (escritorio.guardadas < 4 && Date.now() - t0 < 40000) await pausa(250);
      m.ok(escritorio.guardadas === 4 && escritorio.copia.texto.includes('900123456'), 'escritorio: sin cerrar, la copia se actualiza sola poco después del cambio (' + Math.round((Date.now() - t0) / 1000) + ' s)');

      // «Guardar copia»: el HTML que se descarga es el del repositorio, con los datos
      const descarga = p.waitForEvent('download', { timeout: 60000 });
      await p.evaluate(() => Respaldos.guardarCopia());
      const html = readFileSync(await (await descarga).path(), 'utf8');
      const sinDatos = (h) => h.replace(/(<script id="arken-precios-datos" type="application\/json">)[\s\S]*?(<\/script>)/, '$1null$2');
      m.ok(!/vendor\/|data-precios-app|data-cdn|Content-Security-Policy/.test(html) && etiquetas(sinDatos(html)).join('\n') === etiquetas(original).join('\n') && /"formato":"ARKEN-PRECIOS-COPIA"/.test(html),
        '«Guardar copia» desde la app produce el HTML del repositorio (librerías de cdnjs, sin la capa ni su política de seguridad) con los datos', etiquetas(html).filter((e) => !etiquetas(original).includes(e)));

      // Administración › Respaldos
      await p.evaluate(() => Admin.abrir('respaldos'));
      await p.waitForSelector('[data-copia-interna]');
      await p.waitForFunction(() => /Última copia/.test(document.querySelector('[data-copia-interna]').textContent), null, { timeout: 10000 }).catch(() => {});
      const panel = await p.evaluate(() => ({ copia: document.querySelector('[data-copia-interna]').textContent, alerta: (document.querySelector('#adCuerpo .alert.warn') || {}).textContent || '' }));
      await p.click('[data-copias-diarias]');
      await p.waitForFunction(() => true);
      await pausa(200);
      m.ok(/Última copia/.test(panel.copia) && /últimos 10 días/.test(panel.copia) && /copia interna en este equipo/.test(panel.alerta) && escritorio.carpetas === 1,
        'Administración › Respaldos explica la copia interna, su fecha y abre la carpeta de copias diarias', panel);
      await cerrarModales(p);
      const bloqueado = await p.evaluate(() => window.__csp.slice());
      m.ok(bloqueado.length === 0, 'escritorio: la política de seguridad no bloqueó nada del programa ni de la capa', bloqueado);
      m.ok(errores.length === 0, 'escritorio: sin errores de JavaScript', errores.slice(0, 3));
      await ctx.close();
    }
    {
      // Otro equipo… o el mismo, sin la base del navegador: con la copia interna, los datos vuelven
      const ctx = await contextoEscritorio();
      const antes = escritorio.guardadas;
      const { p, errores, avisado } = await abrir(ctx, 'Se recuperaron los datos de la copia interna');
      const ok = await avisado;
      await ingresarPrecios(p, 'admin', 'prueba123');
      const rec = await p.evaluate(async () => ({ empresa: Datos.config('empresa', {}).razonSocial, nit: Datos.config('empresa', {}).nit, audit: (await BD.todos('auditoria')).filter((a) => a.accion === 'recuperar copia interna').length }));
      m.ok(ok && rec.empresa === 'Constructora de prueba S.A.S.' && rec.nit === '900123456' && rec.audit === 1 && escritorio.guardadas === antes,
        'escritorio: con la base vacía, los datos vuelven de la copia interna, con aviso y en la auditoría (la contraseña también)', rec);
      m.ok(errores.length === 0, 'recuperación: sin errores de JavaScript', errores.slice(0, 3));
      await ctx.close();
    }

    /* ── App de celular (Android) con Capacitor simulado ── */
    const nativo = { archivos: null };
    const CAPACITOR = `(function(){
  const reg = window.__nativo = { archivos:{}, compartidos:[], abiertos:[], oyentes:{}, minimizada:0, estilo:null, borrados:[] };
  const b64aBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const bytesAb64 = (b) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const ruta = (dir, p) => dir + '/' + p;
  for (const [k, v] of Object.entries(window.__archivosIniciales || {})) reg.archivos[k] = v.texto !== undefined ? { texto:v.texto } : { bytes:b64aBytes(v.b64) };
  const Filesystem = {
    async writeFile(o){ reg.archivos[ruta(o.directory, o.path)] = o.encoding ? { texto:String(o.data) } : { bytes:b64aBytes(o.data) }; return { uri:'file:///' + ruta(o.directory, o.path) }; },
    async appendFile(o){ const f = reg.archivos[ruta(o.directory, o.path)]; if (!f) throw new Error('File does not exist'); const n = b64aBytes(o.data), j = new Uint8Array(f.bytes.length + n.length); j.set(f.bytes); j.set(n, f.bytes.length); f.bytes = j; },
    async readFile(o){ const f = reg.archivos[ruta(o.directory, o.path)]; if (!f) throw new Error('File does not exist'); return { data:f.texto !== undefined ? f.texto : bytesAb64(f.bytes) }; },
    async readFileInChunks(o, cb){
      const f = reg.archivos[ruta(o.directory, o.path)];
      setTimeout(() => {
        if (!f || !f.bytes) return cb(null, new Error('File does not exist'));
        for (let i = 0; i < f.bytes.length; i += o.chunkSize) cb({ data:bytesAb64(f.bytes.subarray(i, i + o.chunkSize)) });
        cb({ data:'' });
      }, 0);
      return 'lectura';
    },
    async deleteFile(o){ const k = ruta(o.directory, o.path); if (!reg.archivos[k]) throw new Error('File does not exist'); delete reg.archivos[k]; },
    async rename(o){ const a = ruta(o.directory, o.from), b = ruta(o.toDirectory || o.directory, o.to); if (!reg.archivos[a]) throw new Error('File does not exist'); reg.archivos[b] = reg.archivos[a]; delete reg.archivos[a]; },
    async getUri(o){ return { uri:'file:///' + ruta(o.directory, o.path) }; },
    async rmdir(o){ reg.borrados.push(ruta(o.directory, o.path)); for (const k of Object.keys(reg.archivos)) if (k.indexOf(ruta(o.directory, o.path) + '/') === 0) delete reg.archivos[k]; }
  };
  const Plugins = {
    Filesystem,
    Share:{ async share(o){ reg.compartidos.push(JSON.parse(JSON.stringify(o))); return {}; } },
    App:{ async addListener(ev, cb){ reg.oyentes[ev] = cb; return { remove(){} }; }, async minimizeApp(){ reg.minimizada++; } },
    AppLauncher:{ async openUrl(o){ reg.abiertos.push(o.url); return { completed:true }; } },
    SystemBars:{ async setStyle(o){ reg.estilo = o.style; } }
  };
  window.Capacitor = { isNativePlatform:() => true, getPlatform:() => 'android', Plugins, registerPlugin:(n) => Plugins[n] };
})();`;
    async function contextoCelular() {
      const ctx = await nav.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      await ctx.route('**/precios/www/vendor/capacitor.js', (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: CAPACITOR }));
      await ctx.addInitScript((iniciales) => {
        window.__archivosIniciales = iniciales;
      }, nativo.archivos || {});
      await vigilarCSP(ctx);
      return ctx;
    }
    const archivosDe = (p) =>
      p.evaluate(() => {
        const bytesAb64 = (b) => {
          let s = '';
          for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
          return btoa(s);
        };
        const out = {};
        for (const [k, v] of Object.entries(window.__nativo.archivos)) out[k] = v.texto !== undefined ? { texto: v.texto } : { b64: bytesAb64(v.bytes) };
        return out;
      });
    const bytes = (archivos, k) => (archivos[k] && archivos[k].b64 ? Buffer.from(archivos[k].b64, 'base64') : null);
    {
      const ctx = await contextoCelular();
      const { p, errores } = await abrir(ctx);
      const n = () => p.evaluate(() => JSON.parse(JSON.stringify(Object.assign({}, window.__nativo, { archivos: Object.keys(window.__nativo.archivos), oyentes: Object.keys(window.__nativo.oyentes) }))));
      let r = await n();
      const capa = await p.evaluate(() => ({ plataforma: window.arkenApp.plataforma, movil: window.arkenApp.movil, descargar: typeof window.arkenApp.descargar, imprimir: typeof window.arkenApp.imprimir }));
      m.ok(capa.plataforma === 'android' && capa.movil && capa.descargar === 'function' && capa.imprimir === 'function' && r.estilo === 'DARK' && r.borrados.includes('CACHE/exportados') &&
        ['pause', 'appStateChange', 'backButton'].every((e) => r.oyentes.includes(e)),
        'celular: la capa se activa, pone la barra de estado clara, limpia lo exportado antes y escucha «atrás» y el segundo plano', { capa, r });
      await ingresarPrecios(p, 'admin', 'arken', 'prueba123');

      // Un Excel: al menú Compartir del teléfono, con el archivo entero
      const contenido = 'x'.repeat(2 * 1024 * 1024 + 17); // más de una parte: se escribe por trozos
      await p.evaluate((t) => UI.descargar('ARKEN_PRECIOS_prueba.xlsx', new Blob([t], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })), contenido);
      await p.waitForFunction(() => window.__nativo.compartidos.length === 1, null, { timeout: 15000 });
      r = await n();
      let arch = await archivosDe(p);
      const xlsx = bytes(arch, 'CACHE/exportados/ARKEN_PRECIOS_prueba.xlsx');
      m.ok(xlsx && xlsx.length === contenido.length && r.compartidos[0].files[0] === 'file:///CACHE/exportados/ARKEN_PRECIOS_prueba.xlsx' && /Compartir o guardar/.test(r.compartidos[0].dialogTitle),
        'celular: un Excel que el programa descarga llega entero al menú Compartir (guardar o enviar)', { largo: xlsx && xlsx.length, compartido: r.compartidos[0] });

      // Un PDF: al visor, con sus páginas dibujadas sin internet
      await p.evaluate(() => {
        const d = new jspdf.jsPDF();
        d.text('Documento de prueba de la app', 10, 20);
        d.addPage();
        d.text('Segunda página', 10, 20);
        UI.descargar('ARKEN_PRECIOS_prueba.pdf', d.output('blob'));
      });
      await p.waitForSelector('.precios-visor .precios-visor-pagina canvas', { timeout: 30000 });
      const visor = await p.evaluate(() => ({ titulo: document.querySelector('.precios-visor-titulo').textContent, paginas: document.querySelectorAll('.precios-visor-pagina').length }));
      m.ok(visor.titulo === 'ARKEN_PRECIOS_prueba.pdf' && visor.paginas === 2, 'celular: un PDF se abre en el visor de la app, con sus páginas', visor);
      await p.click('.precios-visor .precios-visor-boton.primario');
      await p.waitForFunction(() => window.__nativo.compartidos.length === 2, null, { timeout: 15000 });
      r = await n();
      m.ok(r.compartidos[1].files[0] === 'file:///CACHE/exportados/ARKEN_PRECIOS_prueba.pdf', 'celular: «Compartir» en el visor entrega el PDF al teléfono (imprimir, guardar, enviar)', r.compartidos[1]);
      await p.evaluate(() => window.__nativo.oyentes.backButton());
      m.ok(await p.evaluate(() => !document.querySelector('.precios-visor')), 'celular: «atrás» cierra el visor');

      // «atrás» con ventanas del programa
      await p.evaluate(() => UI.modal({ titulo: 'Ventana de prueba', cuerpo: '<p>Hola</p>', botones: [{ texto: 'Cerrar' }] }));
      await p.waitForSelector('#modales .overlay');
      await p.evaluate(() => window.__nativo.oyentes.backButton());
      await pausa(400);
      const sinModal = await p.evaluate(() => document.querySelectorAll('#modales .overlay').length);
      await p.evaluate(() => UI.modal({ titulo: 'Ventana fija', cuerpo: '<p>Espere</p>', fijo: true }));
      await p.evaluate(() => window.__nativo.oyentes.backButton());
      await pausa(400);
      const fija = await p.evaluate(() => document.querySelectorAll('#modales .overlay').length);
      await cerrarModales(p);
      await p.evaluate(() => window.__nativo.oyentes.backButton());
      await pausa(100);
      r = await n();
      m.ok(sinModal === 0 && fija === 1 && r.minimizada === 1, 'celular: «atrás» cierra la ventana abierta, no la que no tiene ✕, y en la pantalla principal minimiza la app', { sinModal, fija, minimizada: r.minimizada });

      // Enlaces a otras apps (tiendas, correo, WhatsApp)
      const ventana = await p.evaluate(() => {
        const w = window.open('https://www.easy.com.co/cemento');
        const a = document.createElement('a');
        a.href = 'mailto:compras@constructora.example';
        a.textContent = 'correo';
        document.body.appendChild(a);
        a.click();
        a.remove();
        return { cerrada: w && w.closed };
      });
      await p.waitForFunction(() => window.__nativo.abiertos.length === 2, null, { timeout: 5000 }).catch(() => {});
      r = await n();
      m.ok(ventana.cerrada && r.abiertos.join() === 'https://www.easy.com.co/cemento,mailto:compras@constructora.example', 'celular: los enlaces a tiendas y al correo se abren en la app del teléfono', r.abiertos);

      // Imprimir: el PDF del documento, en el visor
      await p.evaluate(() => {
        document.getElementById('toasts').innerHTML = '';
        window.print();
      });
      const avisoImprimir = await p.locator('#toasts .toast', { hasText: 'Para imprimir' }).first().waitFor({ timeout: 5000 }).then(() => true, () => false);
      await p.evaluate(() =>
        Documentos.imprimirHTML({ titulo: 'Documento de prueba', documento: 'Prueba de la app', nombre: 'ARKEN_PRECIOS_prueba_imprimir', orientacion: 'p', bloques: [{ t: 'sec', txt: 'Sección' }, { t: 'texto', txt: 'Texto de prueba de la app.' }] }),
      );
      await p.waitForSelector('.precios-visor .precios-visor-pagina canvas', { timeout: 30000 });
      const impreso = await p.evaluate(() => document.querySelector('.precios-visor-titulo').textContent);
      await p.evaluate(() => window.__nativo.oyentes.backButton());
      m.ok(avisoImprimir && impreso === 'Documento de prueba', 'celular: «Imprimir» abre el PDF del documento en el visor (y window.print avisa cómo imprimir)', impreso);

      // Compartir desde el programa
      await p.evaluate(async () => {
        const f = new File(['hola'], 'nota.txt', { type: 'text/plain' });
        if (navigator.canShare({ files: [f] })) await navigator.share({ title: 'Nota', files: [f] });
      });
      r = await n();
      m.ok(r.compartidos.length === 3 && r.compartidos[2].files[0] === 'file:///CACHE/exportados/nota.txt' && r.compartidos[2].title === 'Nota', 'celular: compartir desde el programa usa el menú del teléfono con el archivo', r.compartidos[2]);

      // El selector de archivos no esconde los respaldos .json.gz
      const accept = await p.evaluate(() => {
        const out = [];
        const inp = document.getElementById('filePicker');
        const clic = inp.click;
        inp.click = () => {};
        UI.pedirArchivo('.json,.gz,application/json,application/gzip', () => {});
        out.push(inp.accept);
        UI.pedirArchivo('.xlsx,.xls', () => {});
        out.push(inp.accept);
        inp.click = clic;
        return out;
      });
      m.ok(accept[0] === '' && accept[1] === '.xlsx,.xls', 'celular: al restaurar, el selector muestra todos los archivos (el teléfono no conoce .gz); al importar Excel filtra igual', accept);

      // Copia interna: al pasar a segundo plano
      await p.evaluate(() => Datos.fijarConfig('empresa', Object.assign({}, Datos.config('empresa', {}), { razonSocial: 'Constructora del celular S.A.S.' })));
      await p.evaluate(() => window.__nativo.oyentes.pause());
      await p.evaluate(() => window.arkenApp.guardarTodo());
      arch = await archivosDe(p);
      const gz = bytes(arch, 'LIBRARY/precios/copia.bin');
      const textoCopia = gz && gunzipSync(gz).toString('utf8');
      const metaCopia = arch['LIBRARY/precios/copia-meta.json'] && JSON.parse(arch['LIBRARY/precios/copia-meta.json'].texto);
      const verif = textoCopia && (await p.evaluate((t) => Formatos.verificar(JSON.parse(t), Formatos.RESPALDO), textoCopia));
      m.ok(gz && gz[0] === 0x1f && verif && verif.ok && textoCopia.includes('Constructora del celular') && metaCopia.caracteres === textoCopia.length && !arch['LIBRARY/precios/copia.tmp'],
        'celular: al pasar a segundo plano, la copia interna queda comprimida en los archivos de la app (Library), con su ficha', { verif, metaCopia });

      // «Guardar copia» en el celular: el HTML del repositorio, al menú Compartir
      await p.evaluate(() => Respaldos.guardarCopia());
      await p.waitForFunction(() => window.__nativo.compartidos.some((c) => /ARKEN_PRECIOS_copia_/.test(c.files[0])), null, { timeout: 30000 });
      arch = await archivosDe(p);
      const clave = Object.keys(arch).find((k) => /exportados\/ARKEN_PRECIOS_copia_.*\.html$/.test(k));
      const html = clave ? bytes(arch, clave).toString('utf8') : '';
      m.ok(html && !/vendor\/|data-precios-app|Content-Security-Policy/.test(html) && /cdnjs\.cloudflare\.com\/ajax\/libs\/jspdf\/2\.5\.1/.test(html), 'celular: «Guardar copia» entrega el HTML del repositorio, que abre en cualquier navegador', clave);
      nativo.archivos = Object.fromEntries(Object.entries(arch).filter(([k]) => k.startsWith('LIBRARY/')));
      const bloqueado = await p.evaluate(() => window.__csp.slice());
      m.ok(bloqueado.length === 0, 'celular: la política de seguridad no bloqueó nada (Excel, visor de PDF con pdf.js, Compartir, copia)', bloqueado);
      m.ok(errores.length === 0, 'celular: sin errores de JavaScript', errores.slice(0, 3));
      await ctx.close();
    }
    {
      // El sistema borró el almacenamiento del navegador de la app: los datos vuelven de la copia
      const ctx = await contextoCelular();
      const { p, errores, avisado } = await abrir(ctx, 'Se recuperaron los datos de la copia interna');
      const ok = await avisado;
      await ingresarPrecios(p, 'admin', 'prueba123');
      const rec = await p.evaluate(async () => ({ empresa: Datos.config('empresa', {}).razonSocial, audit: (await BD.todos('auditoria')).filter((a) => a.accion === 'recuperar copia interna').length }));
      m.ok(ok && rec.empresa === 'Constructora del celular S.A.S.' && rec.audit === 1, 'celular: con la base vacía, los datos vuelven de la copia interna de la app', rec);
      m.ok(errores.length === 0, 'celular, recuperación: sin errores de JavaScript', errores.slice(0, 3));
      await ctx.close();
    }
  } finally {
    await nav.close();
    await srv.cerrar();
  }
} catch (e) {
  m.ok(false, 'la prueba terminó sin errores inesperados: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('\n' + (marca.fallas ? '✖ ' + marca.fallas + ' de ' + marca.pruebas + ' comprobaciones fallaron.' : marca.pruebas + ' de ' + marca.pruebas + ' comprobaciones bien.'));
process.exit(marca.fallas ? 1 : 0);
