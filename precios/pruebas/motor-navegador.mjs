// ARKEN PRECIOS · los conectores de punta a punta en Chromium (Fase 3, §7.1, §7.2, §11 y §17.3).
//
// La app de escritorio se simula con el mismo puente que pone su preload
// (window.arkenPreciosEscritorio): el motor de verdad (precios/motor) corre en Node y lee las
// páginas guardadas (pruebas/fixtures/motor), sin internet, y los secretos van a una bóveda en
// memoria, como la del sistema operativo.
//
//   · página web sin motor: lo dice en los módulos 02, 03 y 10, y no deja probar una fuente
//   · Configuración › Motor: el correo de contacto va en cada solicitud; el token del servidor
//     queda en la bóveda del equipo, no en la base del navegador ni en la página (criterio 8)
//   · Módulo 03: firmar la revisión legal, probar y activar las seis fuentes; cambiar la
//     configuración obliga a probar otra vez; Homecenter queda solo a mano
//   · Módulo 02: vista previa con las fuentes, lectura de las seis y resultado por fuente
//   · base: precios con su fuente y su evidencia, vínculos, bandeja (≤ 3 por búsqueda),
//     índices del ICOCED, salud y última lectura de cada fuente
//   · criterio 9 con un motor alterado: un precio que no está en lo leído no entra, y el texto
//     de las tiendas se ve escapado en la bandeja (criterio 8)
//   · segunda lectura sin duplicados · paquete del servidor válido, alterado y repetido
//   · actualización programada que se perdió: corre al abrir, sin IA y una sola vez
//
// Uso: npm run prueba:motor-navegador   (CAPTURAS=carpeta guarda imágenes de cada pantalla)

import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  RUTA_PRECIOS, servidor, navegador, contexto, vigilarErrores, abrirPrecios, ingresarPrecios, cerrarModales, irA, marcador,
} from './comun.mjs';
import { cargarNucleo } from '../motor/nucleo.mjs';
import { ejecutar, probar } from '../motor/motor.mjs';
import { OPCIONES_RAPIDAS, internetNormal } from './fixtures/motor/internet.mjs';

const marca = marcador('Los conectores en el navegador, con la app de escritorio simulada');
const m = {
  ok(cond, msg, detalle) { return marca.ok(cond, msg + (!cond && detalle !== undefined ? ' · ' + JSON.stringify(detalle).slice(0, 600) : '')); },
};
const N = cargarNucleo(undefined, { semilla: true });
const R = N.Recoleccion;
const CONTACTO = 'compras@constructora.example';
const TOKEN = 'tok_' + 'z'.repeat(40) + '_PRUEBA';
const CEMENTO = 'G02-0001';
const TUBO = 'G13-0003';
const CERTIFICABLES = ['easy', 'casitaroja', 'aldia', 'idu', 'tvec', 'dane'];
const XSS = '<img src=x onerror="window.__xss=1">';
const tmp = mkdtempSync(join(tmpdir(), 'arken-motor-nav-'));

const srv = await servidor();
const nav = await navegador();

/* ── El motor de la app de escritorio, en Node ── */
const net = internetNormal();
const motor = { planes: [], pruebas: [], alterar: false, pagina: null, control: null };
const secretos = new Map();
/** Lo que hace un motor alterado (o un paquete manipulado): cambia un precio, mete una dirección
    «javascript:» y trae texto con etiquetas de una tienda. El programa no debe creerle. */
function alterar(r) {
  const x = JSON.parse(JSON.stringify(r));
  const easy = x.hallazgos.find((h) => h.fuenteId === 'easy' && h.insumoId === CEMENTO);
  if (easy) easy.h.precio = 30000;                                           // la página dice 33.333
  const otra = x.hallazgos.find((h) => h.fuenteId === 'casitaroja' && h.insumoId === CEMENTO);
  if (otra) otra.h.url = 'javascript:alert(1)';
  const tubo = x.hallazgos.find((h) => h.fuenteId === 'casitaroja' && h.insumoId === TUBO && /TUBO/.test(h.h.titulo));
  if (tubo) {
    tubo.h.proveedor = '<b>Ferretería XSS</b>';
    tubo.h.condiciones = '<script>window.__xss=2</script>';
    const lit = tubo.h.textoLiteral;                                         // la «página» trae etiquetas junto al precio
    tubo.pagina.texto = tubo.pagina.texto.replace(lit, lit + ' ' + XSS);
    tubo.h.textoLiteral = lit + ' ' + XSS;
  }
  return x;
}
async function correrMotor(plan) {
  motor.planes.push(plan);
  const pagina = motor.pagina;
  const pendientes = [];
  motor.control = new AbortController();
  const r = await ejecutar(plan, {
    fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RAPIDAS, senal: motor.control.signal,
    alEvento: (ev) => pendientes.push(pagina.evaluate((e) => window.__arkenEvento && window.__arkenEvento(e), ev).catch(() => {})),
  });
  await Promise.allSettled(pendientes);
  delete r.bitacora;
  return motor.alterar ? alterar(r) : r;
}

try {
  /* ════════════════  PÁGINA WEB SIN MOTOR  ════════════════ */
  {
    const ctx = await contexto(nav);
    const p = await ctx.newPage();
    const errores = vigilarErrores(p);
    await abrirPrecios(p, srv.url(RUTA_PRECIOS));
    await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
    await irA(p, '02');
    await p.waitForSelector('#a2Sig');
    const texto = await p.textContent('#a2Paso');
    m.ok(/Conectores de fuentes/.test(texto) && /no disponible/.test(texto) && /app de escritorio/.test(texto) && (await p.locator('#a2CfgMotor').count()) === 1,
      'página web: el Módulo 02 dice que los conectores corren en la app de escritorio o en un servidor, y lleva a configurarlos');
    await p.evaluate(() => FuentesUI.ficha('easy'));
    await p.waitForSelector('#f3Probar');
    const probarWeb = await p.evaluate(() => ({ dis: document.getElementById('f3Probar').disabled, txt: document.querySelector('#modales .modal').textContent }));
    m.ok(probarWeb.dis && /por certificar/.test(probarWeb.txt) && /✗ Revisión legal aprobada/.test(probarWeb.txt),
      'página web: la ficha de Easy está por certificar, con lo que le falta, y «Probar ahora» no se puede usar', probarWeb.txt.slice(0, 300));
    await cerrarModales(p);
    await p.evaluate(() => { Sesion.tabs['10'] = 'motor'; App.ir('10'); });
    await p.waitForSelector('#cfMotor');
    m.ok(/sin motor/.test(await p.textContent('#cfMotor')), 'página web: Configuración › Motor dice «sin motor»');
    m.ok(errores.length === 0, 'página web: sin errores de JavaScript', errores.slice(0, 3));
    await ctx.close();
  }

  /* ════════════════  APP DE ESCRITORIO (SIMULADA)  ════════════════ */
  const ctx = await contexto(nav);
  await ctx.exposeFunction('__motorCorrer', correrMotor);
  await ctx.exposeFunction('__motorCancelar', () => { if (motor.control) motor.control.abort(); return true; });
  await ctx.exposeFunction('__motorProbar', async (ficha, o) => {
    motor.pruebas.push({ ficha, o });
    const x = await probar(ficha, { contacto: o && o.contacto, plan: { limites: (o && o.limites) || {} }, fetch: net.fetch, nucleo: N, opcionesRed: OPCIONES_RAPIDAS });
    return JSON.parse(JSON.stringify(x));
  });
  await ctx.exposeFunction('__secretoGuardar', (n, v, meta) => { secretos.set(n, { v, meta }); return true; });
  await ctx.exposeFunction('__secretoInfo', (n) => (secretos.has(n) ? secretos.get(n).meta : null));
  await ctx.exposeFunction('__secretoLeer', (n) => (secretos.has(n) ? secretos.get(n).v : null));
  await ctx.exposeFunction('__secretoBorrar', (n) => secretos.delete(n));
  await ctx.addInitScript(() => {
    const oyentes = new Set();
    window.__arkenEvento = (ev) => oyentes.forEach((cb) => { try { cb(ev); } catch (e) { /* solo pinta */ } });
    window.arkenPreciosEscritorio = {
      version: 'prueba',
      secretos: {
        disponible: () => Promise.resolve(true),
        guardar: (n, v, meta) => window.__secretoGuardar(n, v, meta),
        info: (n) => window.__secretoInfo(n),
        leer: (n) => window.__secretoLeer(n),
        borrar: (n) => window.__secretoBorrar(n),
      },
      motor: {
        correr: (plan) => window.__motorCorrer(plan),
        alEvento: (cb) => { oyentes.add(cb); return () => oyentes.delete(cb); },
        cancelar: () => window.__motorCancelar(),
        probar: (ficha, o) => window.__motorProbar(ficha, o),
      },
    };
  });
  const p = await ctx.newPage();
  motor.pagina = p;
  const errores = vigilarErrores(p);
  await abrirPrecios(p, srv.url(RUTA_PRECIOS));
  await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
  const bd = (expr, arg) => p.evaluate(expr, arg);
  const conAviso = async (texto, accion) => {
    await bd(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
    await accion();
    await p.locator('#toasts .toast', { hasText: texto }).first().waitFor({ timeout: 60000 });
  };
  const boton = (texto) => p.click(`#modales .overlay:last-child .modal-foot button:text-is("${texto}")`);
  const capturar = async (nombre) => {
    if (!process.env.CAPTURAS) return;
    mkdirSync(process.env.CAPTURAS, { recursive: true });
    await p.screenshot({ path: join(process.env.CAPTURAS, nombre + '.png'), fullPage: true });
  };

  await bd(() => Datos.fijarConfig('empresa', Object.assign({}, Datos.config('empresa', {}), { razonSocial: 'Constructora de prueba S.A.S.' })));

  /* ── Configuración › Motor: contacto y token ── */
  m.ok(await bd(() => Recolector.donde() === 'escritorio' && /correo de contacto/.test(Recolector.motivoNoDisponible())),
    'en la app de escritorio el motor está, pero sin correo de contacto no lee', await bd(() => Recolector.motivoNoDisponible()));
  await bd(() => { Sesion.tabs['10'] = 'motor'; App.ir('10'); });
  await p.waitForSelector('#cfMotor');
  m.ok(/app de escritorio/.test(await p.textContent('#cfMotor')), 'Configuración › Motor dice que el motor corre en este equipo');
  await p.fill('#cfMotor #f_contacto', 'no es un correo');
  await conAviso('Escriba un correo válido', () => p.click('#cfMotorG'));
  await p.fill('#cfMotor #f_contacto', CONTACTO);
  await p.fill('#cfMotor #f_busquedasPorFuente', '9999');
  await conAviso('Motor guardado', () => p.click('#cfMotorG'));
  const cfgMotor = await bd(() => Datos.config('motor', {}));
  m.ok(cfgMotor.contacto === CONTACTO && cfgMotor.limites.busquedasPorFuente === R.TOPES.busquedasPorFuente && await bd(() => Recolector.disponible()),
    'el correo de contacto queda guardado y nadie sube los topes de lectura (9999 búsquedas → ' + R.TOPES.busquedasPorFuente + ')', cfgMotor);
  await p.fill('#cfSrv #f_url', 'https://precios.constructora.example/');
  await p.fill('#cfSrv #f_token', TOKEN);
  await conAviso('Servidor guardado', () => p.click('#cfSrvG'));
  const boveda = await bd(async (t) => ({
    idb: JSON.stringify(await BD.todos('secretos')).includes(t),
    html: document.documentElement.outerHTML.includes(t),
    almacen: JSON.stringify(Object.assign({}, localStorage, sessionStorage)).includes(t),
    estado: ClaveServidor.estado(), url: ServidorRecoleccion.cfg().url,
  }), TOKEN);
  m.ok(secretos.get('token-servidor') && secretos.get('token-servidor').v === TOKEN && !boveda.idb && !boveda.html && !boveda.almacen && boveda.estado.donde === 'equipo' && boveda.estado.final === TOKEN.slice(-4),
    'el token del servidor va a la bóveda del equipo: no queda en la base del navegador, en la página ni en el almacenamiento (criterio 8)', boveda);
  const respaldo = await bd(async () => JSON.stringify(await Respaldos.armar()));
  m.ok(!respaldo.includes(TOKEN) && boveda.url === 'https://precios.constructora.example', 'el respaldo no lleva el token');
  await p.waitForSelector('#cfSrvB');
  await p.click('#cfSrvB');
  await conAviso('Token borrado', () => boton('Borrar el token'));
  m.ok(!secretos.has('token-servidor') && await bd(() => !ClaveServidor.hay() && !ServidorRecoleccion.configurado()), '«Borrar el token» lo quita de la bóveda del equipo');

  /* ── Módulo 03: lista de fuentes y Homecenter ── */
  await irA(p, '03');
  await p.waitForSelector('#tFuentes');
  const listaFuentes = await bd(() => Object.fromEntries(Array.from(document.querySelectorAll('#tFuentes tbody tr')).map((tr) => [tr.cells[0].querySelector('b').textContent, tr.cells[6].textContent])));
  m.ok(/^no \(rechazada\)/.test(listaFuentes['Homecenter (Sodimac Colombia)']) && /por certificar/.test(listaFuentes['Easy Colombia']) && /ninguna/.test(await p.textContent('#c03 .nota-tab')),
    'Fuentes: Homecenter se usa solo a mano (sus términos lo prohíben) y Easy está por certificar; hoy ninguna se lee sola', listaFuentes);

  /* ── Certificar las seis fuentes desde la pantalla ── */
  async function firmar(id) {
    await bd((i) => { cerrarTodo(); FuentesUI.ficha(i); }, id).catch(async () => { await cerrarModales(p); await bd((i) => FuentesUI.ficha(i), id); });
    await p.click('#f3Legal');
    await p.waitForSelector('#f_resultado');
    await p.selectOption('#f_resultado', 'aprobada');
    await p.fill('#f_responsable', 'Persona de prueba');
    await boton('Guardar la revisión');
    m.ok(await p.locator('#modales .modal-foot').last().textContent().then((t) => /Guardar la revisión/.test(t)), 'sin marcar «Leí el robots.txt…» la revisión no se guarda');
    await p.check('#f_leido');
    await conAviso('Revisión legal guardada: aprobada', () => boton('Guardar la revisión'));
    await p.waitForSelector('#f3Probar');
  }
  async function probarEnPantalla() {
    await p.click('#f3Probar');
    await p.waitForSelector('#modales .modal h3:text-matches("Prueba técnica: ")', { timeout: 60000 });
    const t = await p.textContent('#modales .overlay:last-child .modal');
    await boton('Ver la ficha');
    await p.waitForSelector('#f3Legal');
    return t;
  }
  async function activarEnPantalla() {
    await p.click('#f3Activar');
    await conAviso('Fuente activa', () => boton('Activar'));
    await p.waitForSelector('#f3Suspender');
  }
  await bd(() => { window.cerrarTodo = () => document.querySelectorAll('#modales .overlay').forEach((o) => o.remove()); });

  await firmar('easy');
  const antes = await bd(() => Datos.fuente('easy'));
  m.ok(antes.revisionLegal.resultado === 'aprobada' && antes.revisionLegal.responsable === 'Persona de prueba' && antes.revisionLegal.firmadoPor === 'admin' && /API/.test(antes.revisionLegal.robotsTxt) && antes.actualizado,
    'la revisión legal queda firmada (quién, cuándo) con la evidencia de la semilla', antes.revisionLegal);
  m.ok(await bd(() => !document.getElementById('f3Activar').disabled === false), '«Activar» no se puede usar antes de la prueba técnica');
  const prueba = await probarEnPantalla();
  const fEasy = await bd(() => Datos.fuente('easy'));
  m.ok(/Prueba técnica: aprobada/.test(prueba) && fEasy.ultimaPrueba.resultado === 'aprobada' && fEasy.ultimaPrueba.verificados > 0 && fEasy.ultimaPrueba.donde === 'escritorio' && /ARKEN-PRECIOS/.test(fEasy.ultimaPrueba.agente),
    'la prueba técnica de Easy se aprueba con precios verificados, leída desde la app de escritorio', fEasy.ultimaPrueba);
  const pr = motor.pruebas[motor.pruebas.length - 1];
  m.ok(pr.o.contacto === CONTACTO && !('notas' in pr.ficha) && pr.ficha.revisionLegal.responsable === 'Persona de prueba', 'el motor recibe la ficha sin notas, con el correo de contacto');
  m.ok(await bd(() => Datos.fuente('easy').salud === 'suspendida' && Conectores.certificacion(Datos.fuente('easy')).estado === 'certificada'), 'probar no cambia la salud: la fuente sigue suspendida hasta activarla');
  await activarEnPantalla();
  m.ok(await bd(() => Datos.fuente('easy').salud === 'activa' && Datos.fuente('easy').historialSalud[0].a === 'activa' && Recolector.fuentesQueLeen().length === 1),
    'activada: Easy queda certificada y activa, con su historial de salud');

  // Aldia: si la configuración cambia después de la prueba, hay que probar otra vez
  await firmar('aldia');
  await probarEnPantalla();
  await p.click('#f3Config');
  await p.waitForSelector('#f_json');
  await p.fill('#f_json', '{ "lista": { "urls": ["javascript:alert(1)"] } }');
  await conAviso('no es una dirección http(s)', () => boton('Guardar la configuración'));
  m.ok(await bd(() => !!document.getElementById('f_json') && !JSON.stringify(Datos.fuente('aldia').configuracion).includes('javascript')), 'una configuración con una dirección «javascript:» no se guarda');
  await p.fill('#f_json', '{ "lista": { "urls": ["https://aldiaferreteria.com/cementos-concretos-y-morteros"] } }');
  await conAviso('Cambió: repita la prueba técnica', () => boton('Guardar la configuración'));
  const cfgAldia = await bd(() => ({ c: Datos.fuente('aldia').configuracion, cert: Conectores.certificacion(Datos.fuente('aldia')) }));
  m.ok(cfgAldia.c.conector === 'aldia' && cfgAldia.c.lista.urls.length === 1 && cfgAldia.cert.estado === 'por certificar' && /cambió después de probarla/.test(cfgAldia.cert.falta.join()),
    'Aldia con una sola categoría: la configuración cambió y hay que probarla de nuevo antes de leer', cfgAldia);
  m.ok(await bd(() => document.getElementById('f3Activar').disabled), '… y mientras tanto no se puede activar');
  await probarEnPantalla();
  await activarEnPantalla();

  for (const id of ['casitaroja', 'idu', 'tvec', 'dane']) {
    await firmar(id);
    const t = await probarEnPantalla();
    m.ok(/Prueba técnica: aprobada/.test(t), 'prueba técnica de ' + id + ' aprobada', t.slice(0, 300));
    await activarEnPantalla();
  }
  await cerrarModales(p);
  m.ok(await bd(() => Recolector.fuentesQueLeen().map((f) => f.id).sort().join()) === CERTIFICABLES.slice().sort().join(), 'las seis fuentes quedan certificadas y activas');
  const pedidas = net.pedidas;
  m.ok(pedidas.length > 0 && pedidas.every((x) => /^ARKEN-PRECIOS\//.test(x.ua) && x.ua.includes(CONTACTO) && x.from === CONTACTO),
    'cada solicitud lleva el agente ARKEN-PRECIOS con el correo de contacto (encabezados User-Agent y From)', pedidas.slice(0, 2));
  const primeras = new Map();
  pedidas.forEach((x) => { if (!primeras.has(x.host)) primeras.set(x.host, x.ruta); });
  m.ok(Array.from(primeras.values()).every((r) => r === '/robots.txt') && primeras.size === 6, 'en cada sitio lo primero que se lee es su robots.txt', Object.fromEntries(primeras));
  m.ok(await bd(async () => (await BD.todos('auditoria')).filter((a) => /firmar revisión legal|probar fuente|activar fuente|configurar conector/.test(a.accion)).length >= 6 * 3),
    'la auditoría guarda cada firma, prueba, configuración y activación');

  /* ════════════════  MÓDULO 02: LEER LAS SEIS FUENTES  ════════════════ */
  const insumos = [CEMENTO, TUBO];
  const ciudades = ['11001', '13001', '68001'];
  const actualizar = async () => {
    await bd(({ insumos, ciudades }) => { cerrarTodo(); Sesion.tabs['02'] = 'actualizar'; App.ir('02', { alcance: 'insumos', insumoIds: insumos, ciudades }); }, { insumos, ciudades });
    await p.waitForSelector('#a2Ejecutar');
  };
  await bd(() => { Sesion.tabs['02'] = 'actualizar'; });
  await actualizar();
  const vista = await p.textContent('#a2Paso');
  const textoBoton = await p.textContent('#a2Ejecutar');
  m.ok(/Leer 6 fuente\(s\) y actualizar 2 insumo\(s\)/.test(textoBoton) && /Fuentes que se leen/.test(vista) && /se leen enteras/.test(vista) && /Los conectores leen 6 fuente/.test(vista),
    'vista previa: las seis fuentes, las solicitudes y el aviso de que las listas se leen enteras', textoBoton);
  await capturar('01-vista-previa');
  const obsAntes = await bd(async () => (await BD.todos('observaciones')).length);
  await p.click('#a2Ejecutar');
  await p.waitForSelector('#a2Nueva', { timeout: 120000 });
  await capturar('02-resultado');
  const res = await p.textContent('#a2Paso');
  const filasFuente = await bd(() => Array.from(document.querySelectorAll('#a2Paso .card')).find((c) => /Resultado por fuente/.test(c.textContent)).querySelectorAll('tbody tr').length);
  m.ok(/Resultado por fuente/.test(res) && filasFuente === 6 && /la app de escritorio/.test(res) && !/Resultado por sitio/.test(res), 'resultado: la tabla por fuente con las seis, leídas desde la app de escritorio', filasFuente);
  const plan = motor.planes[motor.planes.length - 1];
  const planTexto = JSON.stringify(plan);
  m.ok(plan.contacto === CONTACTO && plan.fuentes.length === 6 && plan.insumos.length > 800 && !planTexto.includes(TOKEN) && !N.contieneClave(planTexto) && !planTexto.includes('Constructora de prueba') && !/"rol"\s*:/.test(planTexto),
    'el plan que recibe el motor: las fuentes, el catálogo y el contacto; ni tokens ni claves ni datos de la empresa', { fuentes: plan.fuentes.length, insumos: plan.insumos.length });
  const r1 = await bd(async () => {
    const ej = Datos.lista('ejecuciones').sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0];
    const obs = (await BD.todos('observaciones')).filter((o) => o.ejecucionId === ej.id);
    const hall = Datos.lista('hallazgos').filter((h) => h.ejecucionId === ej.id);
    const porBusqueda = {};
    hall.forEach((h) => { const k = h.fuenteId + '|' + h.insumoId; porBusqueda[k] = (porBusqueda[k] || 0) + 1; });
    return {
      ej: { modo: ej.modo, estado: ej.estado, con: ej.conectores && { obs: ej.conectores.observaciones, bandeja: ej.conectores.bandeja, indices: ej.conectores.indices, donde: ej.conectores.donde, fuentes: ej.conectores.fuentes.map((f) => f.fuenteId + ':' + f.estado) } },
      obs: obs.map((o) => ({ fuenteId: o.fuenteId, insumoId: o.insumoId, metodo: o.metodo, precio: o.precioPublicado, verificacion: o.verificacion, vinculoId: o.vinculoId, hash: o.hashEvidencia, tipo: o.tipoPrecio, ciudad: o.ciudad, url: o.url, lit: o.textoLiteral })),
      vinc: Datos.lista('vinculosProducto').map((v) => ({ id: v.id, clave: v.clave, fuenteId: v.fuenteId, origen: v.origen, estado: v.estado, insumoId: v.insumoId })),
      hall: hall.map((h) => ({ fuenteId: h.fuenteId, insumoId: h.insumoId, origen: h.origen, estado: h.estado, destino: h.destino, clave: h.clave })), porBusqueda,
      indices: (await BD.todos('indices')).length, cita: (await BD.todos('indices')).every((x) => /Departamento Administrativo Nacional de Estadística/.test(x.cita)),
      lect: Datos.fuentes().filter((f) => f.ultimaLectura).map((f) => f.id + ':' + f.ultimaLectura.estado + ':' + f.salud),
      audit: (await BD.todos('auditoria')).some((a) => a.accion === 'leer fuentes con el motor'),
    };
  });
  m.ok(r1.ej.modo === 'local + conectores' && r1.ej.con && r1.ej.con.donde === 'escritorio' && r1.ej.con.fuentes.length === 6 && r1.ej.con.fuentes.every((x) => /:leída$/.test(x)),
    'la ejecución queda en el historial con lo que leyó cada fuente', r1.ej);
  m.ok(r1.obs.length >= 5 && r1.obs.length === r1.ej.con.obs && (await bd(async () => (await BD.todos('observaciones')).length)) === obsAntes + r1.obs.length,
    'los precios verificados entran como observaciones nuevas (' + r1.obs.length + ')', r1.obs.length);
  m.ok(r1.obs.every((o) => o.verificacion === 'texto leído por el conector' && /^[0-9a-f]{64}$/.test(o.hash) && o.vinculoId && /^https:\/\//.test(o.url) && o.lit),
    'cada precio con su texto literal, su enlace, el hash de lo leído y su vínculo de producto', r1.obs[0]);
  const de = (f, i) => r1.obs.find((o) => o.fuenteId === f && o.insumoId === i);
  m.ok(de('easy', CEMENTO) && de('easy', CEMENTO).precio === 33333 && de('easy', CEMENTO).metodo === 'api-json' && de('casitaroja', CEMENTO).ciudad === '13001' && de('aldia', CEMENTO).ciudad === '68001',
    'el cemento de Easy (nacional), La Casita Roja (Cartagena) y Aldia (Bucaramanga) con su método y su ciudad', [de('easy', CEMENTO), de('casitaroja', CEMENTO) && de('casitaroja', CEMENTO).ciudad]);
  m.ok(r1.obs.filter((o) => o.fuenteId === 'idu').length >= 1 && r1.obs.filter((o) => o.fuenteId === 'idu').every((o) => o.tipo === 'oficial' && o.ciudad === '11001'), 'las filas del IDU entran como precio oficial de Bogotá');
  m.ok(r1.vinc.some((v) => v.clave === 'easy:9000001' && v.fuenteId === 'easy' && v.insumoId === CEMENTO) && r1.obs.every((o) => r1.vinc.some((v) => v.id === o.vinculoId)),
    'cada producto queda vinculado a su insumo con la clave de la fuente (easy:9000001)', r1.vinc.slice(0, 3));
  m.ok(r1.hall.length >= 1 && r1.hall.every((h) => h.origen === 'motor' && h.estado === 'por revisar') && Object.values(r1.porBusqueda).every((n) => n <= 3),
    'lo dudoso queda en la bandeja «por revisar», a lo sumo 3 por insumo y fuente', r1.porBusqueda);
  m.ok(r1.indices > 50 && r1.cita, 'los índices del ICOCED quedan guardados, cada uno con la cita del DANE', r1.indices);
  m.ok(r1.lect.length === 6 && r1.lect.every((x) => /:leída:activa$/.test(x)), 'cada ficha guarda su última lectura y sigue activa', r1.lect);
  m.ok(r1.audit, 'la auditoría registra la lectura de las fuentes');

  // La bandeja muestra lo del motor con el nombre de la fuente
  await p.click('#a2Hallazgos');
  await p.waitForSelector('#tHall');
  const bandeja = await p.textContent('#tHall');
  m.ok(/Ferretería La Casita Roja|Tienda Virtual del Estado/.test(bandeja), 'Revisar hallazgos: cada fila dice de qué fuente vino');

  /* ── Criterio 9: un motor alterado ── */
  motor.alterar = true;
  await actualizar();
  await p.click('#a2Ejecutar');
  await p.waitForSelector('#a2Nueva', { timeout: 120000 });
  motor.alterar = false;
  const r2 = await bd(async () => ({
    precios: (await BD.todos('observaciones')).filter((o) => o.fuenteId === 'easy' && o.insumoId === 'G02-0001').map((o) => o.precioPublicado),
    js: JSON.stringify(await BD.todos('observaciones')).includes('javascript:') || JSON.stringify(Datos.lista('hallazgos')).includes('javascript:') || JSON.stringify(Datos.lista('vinculosProducto')).includes('javascript:'),
    xss: Datos.lista('hallazgos').find((h) => h.proveedor === '<b>Ferretería XSS</b>'),
  }));
  m.ok(!r2.precios.includes(30000) && r2.precios.includes(33333), 'un precio cambiado por el motor (30.000 en vez de 33.333) no entra: el programa lo busca en el texto leído (criterio 9)', r2.precios);
  m.ok(!r2.js, 'una dirección «javascript:» no se guarda en ninguna parte');
  m.ok(!!r2.xss, 'el producto con texto de etiquetas de la tienda llega a la bandeja como texto');
  await bd(() => { Sesion.tabs['02'] = 'hallazgos'; Sesion.filtros.hallazgos = { vista: 'por revisar', q: 'XSS', ejecucionId: '', pagina: 1 }; cerrarTodo(); App.ir('02'); });
  await p.waitForSelector('#tHall');
  await capturar('03-bandeja-escapada');
  const esc = await bd(() => ({ texto: document.getElementById('tHall').textContent, img: document.querySelectorAll('#tHall img').length, b: Array.from(document.querySelectorAll('#tHall b')).some((b) => b.textContent === 'Ferretería XSS'), xss: window.__xss }));
  m.ok(esc.texto.includes('<b>Ferretería XSS</b>') && esc.texto.includes('<script>window.__xss=2</script>') && esc.texto.includes(XSS) && esc.img === 0 && !esc.b && esc.xss === undefined,
    'en la bandeja, el texto de la tienda se ve tal cual y no se ejecuta (criterio 8)', esc);

  /* ── Segunda lectura: nada se duplica ── */
  const cuenta = () => bd(async () => ({ obs: (await BD.todos('observaciones')).length, hall: Datos.lista('hallazgos').length, vinc: Datos.lista('vinculosProducto').length, idx: (await BD.todos('indices')).length }));
  const c0 = await cuenta();
  await bd(() => { Sesion.tabs['02'] = 'actualizar'; });
  await actualizar();
  await p.click('#a2Ejecutar');
  await p.waitForSelector('#a2Nueva', { timeout: 120000 });
  const c1 = await cuenta();
  const ej3 = await bd(() => Datos.lista('ejecuciones').sort((a, b) => (a.inicio < b.inicio ? 1 : -1))[0].conectores);
  const vistos = await bd(() => Datos.lista('hallazgos').filter((h) => h.origen === 'motor' && h.vecesVisto > 1).length);
  m.ok(c1.obs === c0.obs && c1.hall === c0.hall && c1.vinc === c0.vinc && c1.idx === c0.idx && ej3.observaciones === 0 && ej3.repetidas > 0 && vistos > 0,
    'una segunda lectura igual no duplica precios, bandeja, vínculos ni índices: lo ya visto suma «visto N veces»', { c0, c1, nuevas: ej3.observaciones, repetidas: ej3.repetidas, vistos });

  /* ════════════════  PAQUETE DEL SERVIDOR  ════════════════ */
  // Un día después, el servidor lee las mismas fuentes y Easy subió el cemento de 33.333 a 35.555
  const otroInternet = internetNormal();
  const easyAyer = otroInternet.sitios.get('www.easy.com.co');
  otroInternet.sitios.set('www.easy.com.co', async (u, init) => {
    const r = await easyAyer(u, init);
    if (r && typeof r.body === 'string') r.body = r.body.replace(/33333/g, '35555');
    return r;
  });
  const otroDia = await ejecutar(plan, { fetch: otroInternet.fetch, nucleo: N, opcionesRed: OPCIONES_RAPIDAS });
  delete otroDia.bitacora;
  const paquete = N.Formatos.envolver(R.PAQUETE, R.contenidoPaquete(plan, otroDia, { servidor: 'prueba' }), { id: '20261006T110000Z-prueba' });
  const alterado = JSON.parse(JSON.stringify(paquete));
  alterado.id = '20261006T120000Z-alterado';
  alterado.contenido.resultado.hallazgos[0].h.precio = 1;
  const rehecho = JSON.parse(JSON.stringify(paquete));
  rehecho.id = '20261006T130000Z-rehecho';
  rehecho.contenido.resultado.hallazgos.find((x) => x.fuenteId === 'easy' && x.insumoId === CEMENTO).h.precio = 31111;
  rehecho.hash = N.Cripto.sha256Hex(N.Cripto.jsonCanonico(rehecho.contenido));
  const archivo = (nombre, obj) => { const ruta = join(tmp, nombre); writeFileSync(ruta, JSON.stringify(obj)); return ruta; };
  const importar = async (ruta, texto) => {
    await bd(() => { cerrarTodo(); Sesion.tabs['02'] = 'programacion'; App.ir('02'); });
    await p.waitForSelector('#pgImportar');
    await bd(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
    const [selector] = await Promise.all([p.waitForEvent('filechooser'), p.click('#pgImportar')]);
    await selector.setFiles(ruta);
    await p.locator('#toasts .toast', { hasText: texto }).first().waitFor({ timeout: 120000 });
    return p.locator('#toasts .toast', { hasText: texto }).first().textContent();
  };
  await importar(archivo('paquete.json', paquete), 'Paquete importado');
  // El programa abre el resultado de la ejecución en «Actualizar precios», como cualquier otra
  await p.waitForSelector('#c02 h3:text-is("Resultado por fuente")');
  const vistaPaquete = await p.textContent('#c02');
  const rp = await bd(async () => {
    const ej = Datos.lista('ejecuciones').find((e) => e.conectores && e.conectores.paquete === '20261006T110000Z-prueba');
    const easy = (await BD.todos('observaciones')).filter((o) => o.fuenteId === 'easy' && o.insumoId === 'G02-0001').map((o) => o.precioPublicado);
    return { ej: ej && { modo: ej.modo, donde: ej.conectores.donde, obs: ej.conectores.observaciones, pares: ej.pares, cambios: ej.cambiosDePrecio }, easy, importados: Datos.config('paquetesImportados', []) };
  });
  m.ok(rp.ej && rp.ej.modo === 'paquete del servidor' && rp.ej.donde === 'paquete' && rp.ej.obs >= 1 && rp.easy.includes(35555) && rp.ej.pares > 0,
    'un paquete del servidor entra como una ejecución: el programa verifica cada precio (35.555 de Easy) y recalcula los insumos que trae', rp);
  m.ok(/Resultado por fuente/.test(vistaPaquete) && /un paquete del servidor/.test(vistaPaquete), 'el historial muestra lo que trajo el paquete, fuente por fuente');
  m.ok((await importar(archivo('paquete.json', paquete), 'ya se había importado')).includes('20261006T110000Z-prueba'), 'el mismo paquete no se importa dos veces');
  const t2 = await importar(archivo('alterado.json', alterado), 'No se pudo importar el paquete');
  m.ok(/hash no coincide/.test(t2) && !(await bd(() => Datos.config('paquetesImportados', []))).includes('20261006T120000Z-alterado'), 'un paquete alterado no se importa: el hash no coincide', t2);
  await importar(archivo('rehecho.json', rehecho), 'Paquete importado');
  m.ok(!(await bd(async () => (await BD.todos('observaciones')).some((o) => o.precioPublicado === 31111))), 'aunque alguien rehaga el hash, el precio cambiado no entra (criterio 9)');
  await cerrarModales(p);

  /* ════════════════  ACTUALIZACIÓN PROGRAMADA PERDIDA  ════════════════ */
  const hace = (dias) => new Date(Date.now() - dias * 86400000).toISOString();
  const ejecucionesAntes = await bd(() => Datos.lista('ejecuciones').length);
  const planesAntes = motor.planes.length;
  await bd(async ({ a, u }) => { await Datos.fijarConfig('programacion', { activa: true, frecuencia: 'diaria', dia: 1, hora: '00:00', alcance: 'todo', activada: a, ultima: u }); }, { a: hace(3), u: hace(2) });
  await bd(() => Programacion.revisar());
  const prog = await bd(() => {
    const p0 = Datos.config('programacion', {});
    const ej = Datos.lista('ejecuciones').find((e) => e.id === p0.ultimaEjecucion);
    return { p: p0, ej: ej && { tipo: ej.alcance.tipo, modo: ej.modo, ia: ej.ia, con: ej.conectores && ej.conectores.fuentes.length, insumos: ej.alcance.insumos } };
  });
  m.ok(prog.ej && prog.ej.tipo === 'programada' && prog.ej.modo === 'local + conectores' && prog.ej.ia === null && prog.ej.con === 6 && prog.ej.insumos > 800 && motor.planes.length === planesAntes + 1,
    'la actualización programada que se perdió corre al abrir: lee las seis fuentes para toda la base, sin el Investigador IA', prog);
  m.ok(Date.now() - Date.parse(prog.p.ultima) < 10 * 60000 && /terminada|con errores/.test(prog.p.ultimoEstado), 'queda anotado cuándo corrió y cómo terminó', prog.p);
  await bd(() => Programacion.revisar());
  m.ok((await bd(() => Datos.lista('ejecuciones').length)) === ejecucionesAntes + 1 && motor.planes.length === planesAntes + 1, 'al revisar otra vez no vuelve a correr');
  await bd(() => { cerrarTodo(); Sesion.tabs['02'] = 'programacion'; App.ir('02'); });
  await p.waitForSelector('#pgForm');
  const estadoProg = await p.textContent('#c02');
  m.ok(/Todos los días a las 00:00/.test(estadoProg) && /Los conectores leen 6 fuente/.test(estadoProg) && /la app de escritorio/.test(estadoProg), 'Programación muestra el horario, la próxima y cómo corre');

  // El paquete alterado deja su anotación en el registro técnico: es lo esperado
  const inesperados = errores.filter((e) => !/^\[ARKEN PRECIOS\] Importar paquete Error: El hash no coincide/.test(e));
  m.ok(inesperados.length === 0, 'sin errores de JavaScript', inesperados.slice(0, 5));
  await ctx.close();
} catch (e) {
  console.error(e);
  m.ok(false, 'la prueba terminó sin excepciones: ' + (e && e.message));
} finally {
  await nav.close();
  await srv.cerrar();
  rmSync(tmp, { recursive: true, force: true });
}

console.log('\n' + (marca.fallas ? '✖ ' + marca.fallas + ' de ' + marca.pruebas + ' comprobaciones fallaron.' : marca.pruebas + ' de ' + marca.pruebas + ' comprobaciones bien.'));
process.exit(marca.fallas ? 1 : 0);
