// ARKEN PRECIOS · prueba de la analítica completa (Fase 4: §12, §13, §8.7 y §18) en Chromium.
//
//   · catálogo semilla de más de 1.000 insumos
//   · alertas: reglas de partida, revisión automática tras los cambios, sin repetir lo avisado,
//     fuente caída con correo y WhatsApp en la bandeja de salida, dato nuevo del IPC, resolver,
//     marcar enviada y una regla nueva desde el editor
//   · IPC desde un archivo (CSV sintético, no es el del DANE) y pesos constantes en el tablero
//   · tablero completo con la demostración: todas las gráficas, desglose con un clic, periodo
//     arrastrando sobre la gráfica resumen, proyección rotulada, canasta propia y la del
//     presupuesto real (una lista maestra con la forma de la que exporta ARKEN)
//   · comparador: ciudades y fechas, corte contra corte y fuente contra fuente, en Excel y PDF
//   · fletes: registrar con validación, retirar y reactivar, pesos para el flete, precio puesto
//     en obra en la pantalla y en el Excel para ARKEN, que lo declara en su encabezado; sin
//     pedirlo nada cambia, y sin la demostración los fletes DEMO no cuentan
//   · borrar la demostración se lleva sus alertas y sus fletes y deja lo registrado a mano
//   · 360 px sin desplazamiento lateral en las pantallas nuevas y sin errores de JavaScript
//
// Uso: npm run prueba:analitica

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  RUTA_PRECIOS, servidor, navegador, contexto, vigilarErrores, abrirPrecios, ingresarPrecios, cerrarModales, irA, marcador,
} from './comun.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const m = marcador('Analítica completa de ARKEN PRECIOS (Fase 4)');
const carpeta = mkdtempSync(join(tmpdir(), 'arken-precios-analitica-'));
const srv = await servidor();
const nav = await navegador();

/** IPC sintético (no es el del DANE): 0,4 % mensual, de hace 36 meses a hace 2. */
function ipcDePrueba() {
  const hoy = new Date();
  const filas = ['Año;Mes;Índice'];
  const meses = [];
  let v = 130;
  for (let k = 36; k >= 2; k--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - k, 1);
    filas.push(d.getFullYear() + ';' + (d.getMonth() + 1) + ';' + v.toFixed(2).replace('.', ','));
    meses.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    v *= 1.004;
  }
  const ruta = join(carpeta, 'ipc-sintetico.csv');
  writeFileSync(ruta, filas.join('\n'));
  return { ruta, meses };
}

try {
  const ctx = await contexto(nav);
  const p = await ctx.newPage();
  const errores = vigilarErrores(p);
  const desborde = () => p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const texto = (sel) => p.evaluate((s) => Array.from(document.querySelectorAll(s)).map((e) => e.textContent.replace(/\s+/g, ' ').trim()), sel);
  async function bajar(clic) {
    const [d] = await Promise.all([p.waitForEvent('download', { timeout: 120000 }), clic()]);
    const ruta = join(carpeta, d.suggestedFilename());
    await d.saveAs(ruta);
    return ruta;
  }
  /** PDF desde la vista previa: el botón abre el documento y «Guardar PDF» lo descarga. */
  async function pdf(boton) {
    await p.click(boton);
    await p.waitForSelector('.modal-foot .btn.primary', { timeout: 60000 });
    const ruta = await bajar(() => p.click('.modal-foot .btn.primary'));
    await cerrarModales(p);
    return ruta;
  }
  const esPdf = (ruta) => readFileSync(ruta).subarray(0, 5).toString() === '%PDF-';
  const hoja = (ruta, nombre) => { const wb = XLSX.read(readFileSync(ruta)); return XLSX.utils.sheet_to_json(wb.Sheets[nombre || wb.SheetNames[0]], { header: 1 }); };
  /** El tablero escribe en #stage data-ms cuando termina de pintar. */
  async function tablero(accion) {
    await p.evaluate(() => { const s = document.getElementById('stage'); if (s) delete s.dataset.ms; });
    await accion();
    await p.waitForFunction(() => { const s = document.getElementById('stage'); return s && s.dataset.ms !== undefined; }, null, { timeout: 120000 });
    return Number(await p.evaluate(() => document.getElementById('stage').dataset.ms));
  }
  /** Revisión de alertas a pedido (si ya había una corriendo, espera y repite). */
  async function revisarAlertas() {
    for (let i = 0; i < 20; i++) {
      const r = await p.evaluate(async () => { const x = await AlertasSrv.revisar(); return x === null ? null : x.map((a) => a.reglaId); });
      if (r !== null) return r;
      await p.waitForTimeout(500);
    }
    return null;
  }
  /** Asistente del Módulo 08 para el Excel para ARKEN hasta el paso 5, con ajustes en el paso 4. */
  async function asistenteArken(paso4) {
    await p.evaluate(() => { Sesion.opciones = { exportar: { tipo: 'arken' } }; });
    await irA(p, '08');
    for (let vuelta = 0; vuelta < 6; vuelta++) {
      const paso = await p.evaluate(() => ExportarUI.estado().paso);
      if (paso === 5) break;
      if (paso === 4 && paso4) await paso4();
      await p.click('#e8Sig');
      await p.waitForFunction((x) => ExportarUI.estado().paso !== x, paso, { timeout: 30000 });
    }
    await p.waitForSelector('#e8Paso .validador', { timeout: 120000 });
  }

  await abrirPrecios(p, srv.url(RUTA_PRECIOS));
  await ingresarPrecios(p, 'admin', 'arken', 'prueba123');

  /* ── Catálogo ── */
  const catalogo = await p.evaluate(() => ({ activos: Datos.insumosActivos().length, semilla: Semilla.resumen().total }));
  m.ok(catalogo.activos > 1000 && catalogo.activos === catalogo.semilla, `catálogo semilla de ${catalogo.activos} insumos: más de 1.000`);

  /* ── Sin fletes, la opción «Precio puesto en obra» está apagada y dice por qué ── */
  await p.evaluate(() => { Sesion.opciones = { exportar: { tipo: 'arken' } }; });
  await irA(p, '08');
  while ((await p.evaluate(() => ExportarUI.estado().paso)) < 4) await p.click('#e8Sig');
  const apagada = await p.evaluate(() => { const c = document.querySelector('[data-o="puestoEnObra"]'); return c ? { dis: c.disabled, txt: c.closest('label').textContent } : null; });
  m.ok(apagada && apagada.dis && /registre los fletes hasta la obra en Cotizaciones › Fletes/.test(apagada.txt), 'sin fletes registrados, «Precio puesto en obra» está apagado y dice dónde registrarlos');

  /* ── Alertas: reglas de partida ── */
  const reglas = await p.evaluate(() => AlertasSrv.reglas().map((r) => ({ id: r.id, activa: r.activa, base: r.base })));
  m.ok(reglas.length === 7 && reglas.every((r) => r.activa && r.base), `siete reglas de partida, activas (${reglas.map((r) => r.id.replace('regla-', '')).join(', ')})`);

  /* ── Demostración ── */
  let t0 = Date.now();
  const demo = await p.evaluate(() => Admin.cargarDemo({ silencioso: true, meses: 14, cobertura: 1 }));
  await cerrarModales(p);
  m.ok(demo && demo.observaciones > 20000, `demostración de 14 meses: ${demo ? demo.observaciones : 0} observaciones sintéticas (${Math.round((Date.now() - t0) / 1000)} s)`);

  // La demostración es suave (ninguna variación de 30 días pasa del 10 %): con la regla en 5 % sí avisa
  await p.evaluate(async () => {
    const r = Datos.uno('alertas', 'regla-variacion');
    await Datos.guardar('alertas', Object.assign({}, r, { parametros: Object.assign({}, r.parametros, { umbral: 5 }) }));
  });
  const emitidas = await revisarAlertas();
  const trasDemo = await p.evaluate(() => ({ alertas: AlertasSrv.alertas().map((a) => ({ regla: a.reglaId, demo: a.esDemo, titulo: a.titulo, total: a.total })), nuevas: AlertasSrv.nuevas(),
    insignia: (document.querySelector('#railList .nav-item[data-m="07"] .nav-b') || {}).textContent || '' }));
  const variacion = trasDemo.alertas.find((a) => a.regla === 'regla-variacion');
  m.ok(emitidas.includes('regla-variacion') && variacion && variacion.demo && /de más del 5 % en 30 días/.test(variacion.titulo) && trasDemo.insignia === String(trasDemo.nuevas),
    `con la demostración, «${variacion ? variacion.titulo : '?'}», rotulada DEMO; la insignia del menú cuenta ${trasDemo.insignia}`);
  m.ok((await revisarAlertas()).length === 0, 'revisar otra vez no repite lo que ya se avisó');

  // Fuente caída, con destinatario por correo y por WhatsApp
  await p.evaluate(async () => {
    const u = Datos.usuarios().find((x) => x.usuario === 'admin');
    await Datos.guardar('usuarios', Object.assign({}, u, { correo: 'costos@ejemplo.com', celular: '300 123 4567' }));
    const r = Datos.uno('alertas', 'regla-fuente-caida');
    await Datos.guardar('alertas', Object.assign({}, r, { destinatarios: [u.id], canales: ['correo', 'whatsapp'] }));
    const f = Datos.fuentes().find((x) => x.esDemo);
    await Datos.guardar('fuentes', Object.assign({}, f, { salud: 'caída', saludDetalle: { desde: ahoraISO(), motivo: 'Cinco fallas seguidas (prueba)' } }));
  });
  // La revisión corre sola unos segundos después de un cambio en las fuentes
  await p.waitForFunction(() => AlertasSrv.alertas().some((a) => a.reglaId === 'regla-fuente-caida'), null, { timeout: 60000 });
  const caida = await p.evaluate(() => {
    const a = AlertasSrv.alertas().find((x) => x.reglaId === 'regla-fuente-caida');
    return { titulo: a.titulo, salidas: a.salidas.map((s) => s.canal + ':' + s.estado + ':' + s.destino), enlaces: a.salidas.map((s) => AlertasSrv.enlace(a, s)) };
  });
  m.ok(caida.salidas.join(' ') === 'correo:pendiente:costos@ejemplo.com whatsapp:pendiente:573001234567' &&
    /^mailto:costos%40ejemplo\.com\?subject=/.test(caida.enlaces[0]) && /^https:\/\/wa\.me\/573001234567\?text=/.test(caida.enlaces[1]),
    `la revisión automática avisa la fuente caída («${caida.titulo}») con su correo y su WhatsApp listos en la bandeja de salida`);
  m.ok(!(await revisarAlertas()).includes('regla-fuente-caida'), 'la misma fuente sigue caída y no se vuelve a avisar');

  /* ── IPC desde un archivo y pesos constantes ── */
  const ipc = ipcDePrueba();
  await irA(p, '03');
  await p.click('#stage .tab[data-k="indices"]');
  await p.selectOption('#i3Serie', 'ipc');
  await p.click('#i3Ipc');
  await p.setInputFiles('#filePicker', ipc.ruta);
  await p.waitForSelector('#modales .overlay .btn.primary', { timeout: 30000 });
  const previa = (await p.textContent('#modales .overlay')).replace(/\s+/g, ' ');
  await p.click('#modales .overlay .btn.primary');
  await p.waitForFunction((n) => Datos.lista('indices').filter((x) => x.serie === 'ipc').length === n, ipc.meses.length, { timeout: 30000 });
  const mesIpc = await p.evaluate((mes) => { const x = Datos.lista('indices').find((y) => y.serie === 'ipc' && y.mes === mes); return x && { m: x.variacionMensual, a: x.variacionAnual }; }, ipc.meses[24]);
  m.ok(/larga \(año y mes\)/.test(previa) && Math.abs(mesIpc.m - 0.4) < 0.02 && Math.abs(mesIpc.a - (Math.pow(1.004, 12) - 1) * 100) < 0.05,
    `IPC desde un CSV: ${ipc.meses.length} meses, con variaciones en porcentaje (mensual ${mesIpc.m} %, anual ${mesIpc.a} %)`);
  await p.waitForFunction(() => AlertasSrv.alertas().some((a) => a.reglaId === 'regla-indices'), null, { timeout: 60000 });
  m.ok(true, 'el dato nuevo del IPC emite su alerta');
  // La tabla muestra cada variación como la publica el DANE: 0,4 % y no 40 %
  await p.waitForSelector('#tIndices tbody tr', { timeout: 10000 });
  const tablaIpc = await p.evaluate(() => Array.from(document.querySelectorAll('#tIndices tbody tr')).slice(0, 3).map((tr) => Array.from(tr.cells).map((td) => td.textContent.trim())));
  m.ok(tablaIpc.length === 3 && tablaIpc.every((f) => / %$/.test(f[2]) && / %$/.test(f[4]) && Math.abs(parseFloat(f[2]) - 0.4) < 0.02 &&
    Math.abs(parseFloat(f[4]) - (Math.pow(1.004, 12) - 1) * 100) < 0.05),
    `la tabla del IPC muestra las variaciones en porcentaje (${tablaIpc[0] ? tablaIpc[0][0] + ': mensual ' + tablaIpc[0][2] + ', anual ' + tablaIpc[0][4] : '—'})`);

  /* ── Tablero completo ── */
  let ms = await tablero(() => irA(p, '00'));
  const graficas = await p.evaluate(() => ['t0Evol', 't0Idx', 't0CalorC', 't0CalorM', 't0Ciu', 't0Ext', 't0Disp', 't0Comp', 't0Mapa', 't0Proy']
    .filter((id) => !document.querySelector('#' + id + ' svg')));
  m.ok(graficas.length === 0, `las diez gráficas del tablero se pintan con 14 meses de demostración (${ms} ms)` + (graficas.length ? ': faltan ' + graficas.join(', ') : ''));
  const proy = await p.evaluate(() => ({ txt: document.getElementById('t0Proy').textContent, tit: document.getElementById('t0ProyTit').textContent }));
  m.ok(/Proyección: no es un precio de mercado/.test(proy.txt) && /Holt sobre \d+ meses/.test(proy.txt) && /^Proyección a 6 meses/.test(proy.tit),
    `la proyección dice cómo se hizo y va rotulada «Proyección: no es un precio de mercado» (${proy.tit})`);
  const claves = await p.evaluate(() => Array.from(document.querySelectorAll('#t0Idx .leyenda-clic [data-dato]')).map((e) => e.dataset.dato));
  ms = await tablero(() => p.click('#t0Idx .leyenda-clic [data-dato="Materiales"]'));
  const migas = await p.textContent('#t0Migas');
  m.ok(claves.includes('Materiales') && /Todas las categorías\s*›\s*Materiales/.test(migas) && (await p.evaluate(() => Sesion.filtros.tablero.categoriaArken)) === 'Materiales',
    `un clic en «Materiales» del gráfico de índices filtra todo el tablero y deja la miga (${ms} ms)`);
  await p.evaluate(() => document.getElementById('t0Tramo').scrollIntoView({ block: 'center' }));
  const caja = await p.locator('#t0Tramo svg').boundingBox();
  ms = await tablero(async () => {
    await p.mouse.move(caja.x + caja.width * 0.3, caja.y + caja.height * 0.5);
    await p.mouse.down();
    await p.mouse.move(caja.x + caja.width * 0.6, caja.y + caja.height * 0.5, { steps: 6 });
    await p.mouse.up();
  });
  const periodo = await p.evaluate(() => { const F = Sesion.filtros.tablero; return { rango: F.rango, desde: F.desde, hasta: F.hasta }; });
  m.ok(periodo.rango === 'pers' && /^\d{4}-\d{2}-01$/.test(periodo.desde) && periodo.desde < periodo.hasta,
    `arrastrar sobre la gráfica resumen elige el periodo (${periodo.desde} a ${periodo.hasta}, ${ms} ms)`);
  await tablero(() => p.click('#t0Migas [data-miga="todo"]'));
  ms = await tablero(() => p.selectOption('#t0Pesos', 'constantes'));
  const constantes = await p.evaluate(() => ({ tit: document.getElementById('t0EvolTit').textContent, ms: document.getElementById('t0Ms').textContent }));
  m.ok(/pesos constantes/.test(constantes.tit) && /Pesos constantes de /.test(constantes.ms), `pesos constantes con el IPC cargado: ${constantes.ms.replace(/\s+/g, ' ').trim()}`);
  await tablero(() => p.selectOption('#t0Pesos', 'corrientes'));
  // Canasta propia, a partir de la canasta tipo VIS
  await p.click('#t0Canastas');
  await p.waitForSelector('#modales .overlay .btn.primary', { timeout: 10000 });
  await p.click('#modales .overlay .btn.primary');                       // + Nueva canasta
  await p.waitForSelector('#cnNom', { timeout: 10000 });
  await p.fill('#cnNom', 'Canasta de la prueba');
  await p.selectOption('#cnDesde', 'tipo-vis');
  await p.click('#modales .overlay:last-child .btn.primary');
  await p.waitForFunction(() => Canastas.propias().length === 1, null, { timeout: 10000 });
  await p.keyboard.press('Escape');                                      // cerrar la lista de canastas
  await p.waitForFunction(() => !document.querySelector('#modales .overlay'), null, { timeout: 10000 });
  const canasta = await p.evaluate(() => { const c = Canastas.propias()[0]; return { id: c.id, n: Object.keys(c.pesos).length, vis: Object.keys(Analitica.CANASTAS_TIPO.find((x) => x.id === 'tipo-vis').pesos).length }; });
  ms = await tablero(() => p.selectOption('#t0Canasta', canasta.id));
  m.ok(canasta.n === canasta.vis && (await p.evaluate(() => /Canasta de la prueba/.test(document.getElementById('t0Comp').textContent))),
    `canasta propia con los ${canasta.n} grupos de la canasta VIS, elegida en el tablero (${ms} ms)`);

  // Canasta del presupuesto real: una lista maestra con la forma de la que exporta ARKEN (decisión 95).
  // Tres insumos de ARKEN de categorías distintas (ninguno voluminoso, para no tocar el precio puesto
  // en obra que se prueba después) y un renglón sin equivalencia, que queda fuera y se dice.
  const deArken = await p.evaluate(() => {
    const porCat = new Map();
    Datos.equivalencias().filter((e) => e.estado === 'exacta').forEach((e) => {
      const ins = Datos.insumo(e.insumoId);
      if (!ins || ins.activo === false || Fletes.esVoluminoso(ins) || porCat.has(ins.categoriaArken)) return;
      porCat.set(ins.categoriaArken, { codigo: e.codigoArken || ins.codigo, descripcion: e.descripcionArken, unidad: e.unidadArken, categoria: ins.categoriaArken, grupo: ins.grupo });
    });
    return Array.from(porCat.values()).slice(0, 3);
  });
  const valores = [6000000, 3000000, 1000000];
  const rutaLista = join(carpeta, 'ARKEN_lista_maestra_prueba.xlsx');
  const libroLista = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libroLista, XLSX.utils.aoa_to_sheet([['Lista maestra de insumos · Proyecto de la prueba'], [],
    ['Código', 'Descripción', 'Unidad', 'Categoría', 'Precio unitario', 'Cantidad presupuestada', 'Valor presupuestado', 'Proveedor sugerido']]
    .concat(deArken.map((x, i) => [x.codigo, x.descripcion, x.unidad, x.categoria, 1000, valores[i] / 1000, valores[i], '']))
    .concat([['X-001', 'Partida global de la prueba sin equivalencia', 'GL', 'Materiales', 2000000, 1, 2000000, '']])), 'Lista maestra');
  XLSX.writeFile(libroLista, rutaLista);
  await p.evaluate(() => { Sesion.tabs['09'] = 'lista'; });
  await irA(p, '09');
  await p.waitForSelector('#lmImp', { timeout: 15000 });
  const [selLista] = await Promise.all([p.waitForEvent('filechooser'), p.click('#lmImp')]);
  await selLista.setFiles(rutaLista);
  await p.waitForSelector('#lmFilas tr', { timeout: 60000 });
  await p.selectOption('#lmFilas [data-acc="3"]', 'omitir');            // el renglón sin equivalencia no va a la bandeja
  const cuentaLista = await p.textContent('#lmCuenta');
  await p.click('#modales .overlay:last-child .modal-foot .btn.primary'); // Guardar
  await p.waitForFunction(() => Datos.lista('listasArken').length === 1, null, { timeout: 15000 });
  const pres = await p.evaluate(() => { const c = Canastas.presupuesto(); return c && { nombre: c.nombre, pesos: c.pesos, supuesto: c.supuesto, nota: c.nota }; });
  const pesosEsperados = {};
  deArken.forEach((x, i) => { pesosEsperados[x.grupo + '|' + x.categoria] = valores[i]; });
  const ordenar = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
  m.ok(deArken.length === 3 && /^3 a confirmar · 0 por confirmar · 0 a la bandeja · 1 sin acción/.test(cuentaLista) && pres && !pres.supuesto &&
    ordenar(pres.pesos) === ordenar(pesosEsperados) &&
    /^3 insumos del presupuesto con equivalencia confirmada; el 16\.7 % del valor presupuestado no la tiene y queda fuera\.$/.test(pres.nota),
    `la lista maestra con su valor presupuestado da la canasta «${pres ? pres.nombre : '?'}»: ${pres ? pres.nota : '—'}`);
  await tablero(() => irA(p, '00'));
  ms = await tablero(() => p.selectOption('#t0Canasta', 'presupuesto'));
  const enTablero = await p.evaluate(() => ({
    primera: document.querySelector('#t0Canasta option').textContent,
    ind: document.querySelector('#t0Ind .stat .foot').textContent,
    leyenda: Array.from(document.querySelectorAll('#t0Comp .legend .li')).map((li) => [li.querySelector('.nm').textContent, li.querySelector('.vl').textContent]),
  }));
  const porCategoria = deArken.map((x, i) => [x.categoria, (100 * valores[i] / 10000000).toFixed(1) + ' %']);
  m.ok(/^Presupuesto real de ARKEN · /.test(enTablero.primera) && enTablero.ind.startsWith(pres.nombre) && !/supuestos/.test(enTablero.ind) &&
    JSON.stringify(enTablero.leyenda) === JSON.stringify(porCategoria),
    `el índice de costo de obra se pondera con el presupuesto real: ${enTablero.leyenda.map((x) => x.join(' ')).join(', ')} (${ms} ms)`);

  /* ── Comparador ── */
  const comparadorListo = () => p.waitForFunction(() => { const z = document.getElementById('cpRes'); return z && !/Calculando/.test(z.textContent); }, null, { timeout: 120000 });
  await irA(p, '06');
  await comparadorListo();
  const ciu = await p.evaluate(() => ({ filas: document.querySelectorAll('#tCmpCiu tbody tr').length, ciudades: Sesion.filtros.cmpCiu.ciudades.length,
    base: document.querySelector('#cpBase').selectedOptions[0].textContent }));
  m.ok(ciu.filas > 100 && ciu.ciudades >= 2, `ciudades lado a lado: ${ciu.filas} insumos en ${ciu.ciudades} ciudades, en pesos y en porcentaje frente a ${ciu.base}`);
  await p.evaluate(() => { const F = Sesion.filtros.cmpCiu; F.ciudades = Informes.ciudadesPorDefecto().slice(0, 2); F.elegidas = true; F.fechas = ['hoy', '-6m']; F.base = ''; App.render(); });
  await comparadorListo();
  const xCiu = hoja(await bajar(() => p.click('#cpXls')), 'Comparación');
  const filasTabla = await p.evaluate(() => document.querySelectorAll('#tCmpCiu tbody tr').length);
  const iEnc = xCiu.findIndex((f) => f[0] === 'Código' && f[1] === 'Descripción');
  const columnas = iEnc > 0 ? xCiu[iEnc].filter((t) => / · (Hoy|\d{2}\/\d{2}\/\d{4})$/.test(t) && !/^Dif\./.test(t)) : [];
  const diferencias = iEnc > 0 ? xCiu[iEnc].filter((t) => /^Dif\. (\$|%) · /.test(t)).length : 0;
  m.ok(columnas.length === 4 && diferencias === 6 && xCiu.length - iEnc - 1 === filasTabla,
    `dos ciudades × dos fechas (${columnas.join(', ')}), con la diferencia en pesos y en porcentaje; el Excel trae los ${filasTabla} renglones de la pantalla`);
  m.ok(esPdf(await pdf('#cpPdf')), 'la comparación por ciudades y fechas sale en PDF');
  await p.evaluate(async () => { await CortesSrv.crear({ nombre: 'Corte de la prueba', ciudades: Informes.ciudadesPorDefecto(), cerrar: true, activar: false }); });
  await p.evaluate(() => { Sesion.tabs['06'] = 'cortes'; App.render(); });
  await p.waitForSelector('#cmCiu', { timeout: 10000 });
  await p.selectOption('#cmCiu', '*');
  await p.waitForFunction(() => document.querySelectorAll('#tCmpCor tbody tr').length > 0, null, { timeout: 60000 });
  const cortes = await p.evaluate(() => ({ filas: document.querySelectorAll('#tCmpCor tbody tr').length, a: document.querySelector('#cmA').selectedOptions[0].textContent, b: document.querySelector('#cmB').selectedOptions[0].textContent }));
  const xCor = hoja(await bajar(() => p.click('#cmXls')), 'Comparación');
  m.ok(cortes.filas > 0 && xCor.length > cortes.filas && esPdf(await pdf('#cmPdf')), `corte contra corte en todas las ciudades: ${cortes.filas} renglones (${cortes.a} frente a ${cortes.b}), en Excel y PDF`);
  await p.evaluate(() => { Sesion.tabs['06'] = 'fuentes'; App.render(); });
  await p.evaluate(() => {
    const o = Array.from(Datos.obsTodas().values()).find((x) => x.tipoPrecio !== 'referencia' && x.estado === 'válida' && x.esDemo);
    Sesion.filtros.cmpFue.insumoId = o.insumoId; Sesion.filtros.cmpFue.ciudad = o.ciudad; App.render();
  });
  await p.waitForFunction(() => document.querySelectorAll('#tCmpFue tbody tr').length > 0, null, { timeout: 30000 });
  const unIns = await p.evaluate(() => document.querySelectorAll('#tCmpFue tbody tr').length);
  m.ok(unIns >= 2 && esPdf(await pdf('#cfPdf')), `fuente contra fuente para un insumo: ${unIns} fuentes frente a la mediana de todas, en PDF`);
  await p.click('[data-modo="dos"]');
  await p.waitForSelector('#cfTodas2', { timeout: 10000 });
  await p.check('#cfTodas2');
  await p.waitForFunction(() => document.querySelectorAll('#tCmpDos tbody tr').length > 0, null, { timeout: 60000 });
  const dos = await p.evaluate(() => ({ filas: document.querySelectorAll('#tCmpDos tbody tr').length, a: document.querySelector('#cfA').selectedOptions[0].textContent, b: document.querySelector('#cfB').selectedOptions[0].textContent }));
  const xDos = hoja(await bajar(() => p.click('#cfXls2')), 'Comparación');
  m.ok(dos.filas > 0 && xDos.length > dos.filas && esPdf(await pdf('#cfPdf2')), `dos fuentes en todas las ciudades: ${dos.filas} renglones (${dos.a} frente a ${dos.b}), en Excel y PDF`);

  /* ── Fletes y precio puesto en obra ── */
  await irA(p, '04');
  await p.evaluate(() => { Sesion.tabs['04'] = 'fletes'; Sesion.filtros.fletes = Object.assign(Sesion.filtros.fletes || {}, { sub: 'tabla' }); App.render(); });
  await p.waitForSelector('#tFletes', { timeout: 10000 });
  const tabla = await p.evaluate(() => ({ filas: document.querySelectorAll('#tFletes tbody tr').length, demo: Datos.lista('fletes').filter((f) => f.esDemo).length }));
  m.ok(tabla.demo === 5 && tabla.filas === 5, 'la demostración trae cinco fletes sintéticos, rotulados DEMO, con la mula hasta la vereda');
  await p.click('#flNuevo');
  await p.waitForSelector('#f_destino', { timeout: 10000 });
  await p.fill('#f_destino', 'Rionegro');
  await p.selectOption('#f_vehiculo', 'doble troque');
  await p.fill('#f_fuente', 'Transportes de la prueba');
  await p.fill('#f_precio', '0');
  await p.click('.modal-foot .btn.primary');
  const aviso = (await texto('#toasts .toast.bad')).join(' ');
  await p.fill('#f_precio', '900000');
  await p.fill('#f_capacidad', '14');
  const visibles = () => p.evaluate(() => ['capacidad', 'distanciaKm'].map((k) => document.getElementById('f_' + k).closest('.field').style.display !== 'none').join(','));
  const porViaje = await visibles();
  await p.selectOption('#f_unidad', 'm3km');
  const porKm = await visibles();
  await p.selectOption('#f_unidad', 'viaje');
  await p.click('.modal-foot .btn.primary');
  await p.waitForFunction(() => Datos.lista('fletes').some((f) => f.destino === 'Rionegro'), null, { timeout: 10000 });
  const propio = await p.evaluate(() => { const f = Datos.lista('fletes').find((x) => x.destino === 'Rionegro'); return { id: f.id, tarifa: Fletes.tarifa(f).valor, por: Fletes.tarifa(f).por }; });
  m.ok(/precio debe ser mayor que cero/.test(aviso) && porViaje === 'true,false' && porKm === 'false,true' && Math.abs(propio.tarifa - 900000 / 14) < 1e-6 && propio.por === 'm³',
    'registrar un flete: el precio en cero no pasa, los campos cambian con la forma de cobro y la tabla dice cuánto sale el m³');
  const auditoria = await p.evaluate(async () => (await Auditoria.lista(5)).map((a) => a.accion));
  await p.click(`[data-ret="${propio.id}"]`);
  await p.waitForFunction((id) => Datos.lista('fletes').find((f) => f.id === id).retirado, propio.id, { timeout: 10000 });
  const ocultas = await p.evaluate(() => document.querySelectorAll('#tFletes tbody tr').length);
  await p.check('#flRet');
  await p.click(`[data-ret="${propio.id}"]`);
  await p.waitForFunction((id) => !Datos.lista('fletes').find((f) => f.id === id).retirado, propio.id, { timeout: 10000 });
  m.ok(auditoria.includes('registrar flete') && ocultas === 5, 'el flete queda en la auditoría; retirado sale de la tabla y se puede reactivar');
  // Un texto con HTML en un flete (por ejemplo, copiado de una cotización) se pinta como texto
  await p.evaluate(async () => {
    await Datos.guardar('fletes', { id: 'fl-html', origen: 'Planta <b>norte</b>', destino: 'Guarne', vereda: '', vehiculo: 'camión', unidad: 'tonelada', precio: 50000,
      capacidad: null, capacidadUnidad: '', distanciaKm: null, fecha: hoyISO(), fuente: '<img src=x onerror="window.__xss=1">Transportes', nota: '', creado: ahoraISO() });
    App.render();
  });
  await p.waitForFunction(() => document.querySelectorAll('#tFletes tbody tr').length === 7, null, { timeout: 10000 });
  const escapado = await p.evaluate(() => ({ html: document.querySelectorAll('#tFletes img, #tFletes b').length, texto: document.getElementById('tFletes').textContent, xss: window.__xss }));
  m.ok(escapado.html === 0 && escapado.texto.includes('<img src=x') && escapado.texto.includes('Planta <b>norte</b>') && escapado.xss === undefined,
    'un flete con HTML en su origen o su fuente se pinta como texto (criterio 8)');
  await p.evaluate(async () => { await Datos.borrar('fletes', 'fl-html'); App.render(); });

  // Precio puesto en obra en la pantalla
  await p.evaluate(() => { Sesion.filtros.fletes.sub = 'obra'; App.render(); });
  await p.waitForSelector('#foObra', { timeout: 10000 });
  const obras = await p.evaluate(() => Array.from(document.querySelectorAll('#foObra option')).map((o) => ({ v: o.value, n: o.textContent })));
  const vereda = obras.find((o) => /vereda/i.test(o.n));
  await p.selectOption('#foObra', vereda.v);
  const filaCemento = () => p.evaluate(() => {
    const fila = Array.from(document.querySelectorAll('#tObra tbody tr')).find((tr) => /Cemento gris tipo UG/.test(tr.textContent) && tr.cells.length > 4);
    return fila ? Array.from(fila.cells).map((c) => c.dataset.v !== undefined ? Number(c.dataset.v) : c.textContent.trim()) : null;
  });
  await p.waitForFunction(() => document.querySelectorAll('#tObra tbody tr').length > 0, null, { timeout: 30000 });
  const conMula = await filaCemento();
  await p.evaluate(() => { const c = Array.from(document.querySelectorAll('[data-fo]')).find((x) => /mula/i.test(x.closest('label').textContent)); c.click(); });
  await p.waitForTimeout(300);
  const sinMula = await filaCemento();
  const numeros = (fila) => (fila || []).filter((x) => typeof x === 'number');
  m.ok(obras.length === 3 && conMula && numeros(conMula).includes(12500) && numeros(sinMula).includes(6000),
    `obra en la vereda: el cemento lleva $ 6.000 del camión más $ 6.500 de la mula; sin la mula, $ 6.000 (${obras.map((o) => o.n).join(' · ')})`);
  const xObra = await bajar(() => p.click('#foXls'));
  m.ok(/^ARKEN_PRECIOS_puesto_en_obra_/.test(xObra.split('/').pop()), 'la tabla de precio puesto en obra sale en Excel');

  // Pesos para el flete: el bloque sin peso no lleva flete hasta que se escribe
  await p.evaluate(() => { Sesion.filtros.fletes.sub = 'pesos'; App.render(); });
  await p.waitForSelector('#fpGuardar', { timeout: 10000 });
  const bloque = await p.evaluate(() => { const i = Datos.insumosActivos().find((x) => /^Bloque de arcilla No\. 5/.test(x.descripcion)); return { id: i.id, antes: Fletes.paraInsumo(i, Datos.lista('fletes').filter((f) => f.destino && !f.retirado)) }; });
  await p.fill(`[data-peso="${bloque.id}"]`, '9.5');
  await p.click('#fpGuardar');
  await p.waitForFunction((id) => Datos.insumo(id).pesoKg === 9.5, bloque.id, { timeout: 10000 });
  const conPeso = await p.evaluate((id) => !!Fletes.paraInsumo(Datos.insumo(id), Datos.lista('fletes').filter((f) => f.esDemo && !f.vereda)), bloque.id);
  m.ok(bloque.antes === null && conPeso, 'el bloque No. 5 no lleva flete mientras no se sabe su peso; con 9,5 kg ya lo lleva');

  // El Excel para ARKEN con precio puesto en obra (vereda, con la demostración)
  await asistenteArken(async () => {
    await p.check('[data-o="incluirDemo"]');
    await p.check('[data-o="puestoEnObra"]');
    await p.selectOption('#e8ObraSel', vereda.v);
  });
  const avisoObra = (await texto('#e8Paso .alert')).find((t) => /Precio puesto en obra en/.test(t)) || '';
  const rutaObra = await bajar(() => p.click('#e8Sig'));
  const ins = hoja(rutaObra, 'Insumos');
  const iCab = ins.findIndex((f) => f[0] === 'Categoría');
  const det = hoja(rutaObra, 'Detalle');
  const notas = hoja(rutaObra, 'Notas').map((f) => f[0]).filter(Boolean).join('\n');
  const conFlete = det.slice(1).filter((f) => f[22] > 0);
  const sumaBien = conFlete.every((f) => Math.abs(f[7] - Math.round((f[21] + f[22]) * 1000) / 1000) < 0.0006);
  const cem = det.find((f) => /Cemento gris tipo UG/.test(f[2] || '') && f[22] > 0);
  m.ok(/_puesto-en-obra_/.test(rutaObra) && ins.slice(0, iCab).some((f) => /^PRECIO PUESTO EN OBRA en .*Vereda de demostración: \d+ insumos voluminosos llevan el flete/.test(f[0])),
    `el Excel para ARKEN declara en su encabezado que es precio puesto en obra (${rutaObra.split('/').pop()})`);
  m.ok(avisoObra && det[0].length === 24 && conFlete.length > 0 && sumaBien && cem && cem[22] === 12500 && /Acarreo en mula/.test(cem[23]),
    `${conFlete.length} voluminosos con precio de almacén más flete; el cemento, ${cem ? cem[21] : '?'} + 12.500`);
  m.ok(/Fletes usados \(2\)/.test(notas) && /van SIN flete/.test(notas), 'las notas del archivo listan los fletes usados y los voluminosos que van sin flete, con el motivo');
  // Sin la demostración, los fletes DEMO no cuentan y el archivo no sale
  await asistenteArken(async () => {
    await p.check('[data-o="puestoEnObra"]');
    await p.selectOption('#e8ObraSel', vereda.v);
  });
  const bloqueado = await p.evaluate(() => ({ alerta: Array.from(document.querySelectorAll('#e8Paso .alert.bad')).some((a) => /flete/i.test(a.textContent)), boton: document.getElementById('e8Sig').disabled }));
  m.ok(bloqueado.alerta && bloqueado.boton, 'sin incluir la demostración, los fletes DEMO no cuentan: el asistente lo dice y no deja guardar');
  // Sin pedirlo, el precio es el de almacén y el archivo no declara nada
  await asistenteArken(async () => { await p.check('[data-o="incluirDemo"]'); });
  const rutaAlmacen = await bajar(() => p.click('#e8Sig'));
  const insA = hoja(rutaAlmacen, 'Insumos');
  const cemA = insA.find((f) => f[2] === cem[2]);
  m.ok(!/puesto-en-obra/.test(rutaAlmacen) && !insA.some((f) => /PUESTO EN OBRA/.test(f[0] || '')) && cemA && Math.abs(cemA[3] - cem[21]) < 0.0006 && hoja(rutaAlmacen, 'Detalle')[0].length === 21,
    'sin pedir precio puesto en obra, el cemento va con su precio de almacén y el archivo no cambia');

  /* ── Alertas en pantalla ── */
  await irA(p, '07');
  await p.waitForSelector('#tAlertas [data-res]', { timeout: 10000 });
  await p.click('#tAlertas [data-res]');
  await p.fill('#f_nota', 'Revisado en la prueba');
  await p.click('.modal-foot .btn.primary');
  await p.waitForFunction(() => AlertasSrv.alertas().some((a) => a.estado === 'resuelta'), null, { timeout: 10000 });
  await p.evaluate(() => { Sesion.tabs['07'] = 'salida'; App.render(); });
  await p.waitForSelector('#tSalida [data-env]', { timeout: 10000 });
  await p.evaluate(() => { document.querySelectorAll('#tSalida [data-env]').forEach((a) => a.addEventListener('click', (e) => e.preventDefault())); });
  await p.click('#tSalida [data-env]');
  await p.waitForFunction(() => AlertasSrv.alertas().some((a) => (a.salidas || []).some((s) => s.estado === 'enviada')), null, { timeout: 10000 });
  const resuelta = await p.evaluate(() => { const a = AlertasSrv.alertas().find((x) => x.estado === 'resuelta'); return a.resuelta.nota; });
  m.ok(resuelta === 'Revisado en la prueba', 'una alerta se resuelve con su nota, y abrir un correo de la bandeja de salida lo marca enviado');
  await p.evaluate(() => { Sesion.tabs['07'] = 'reglas'; App.render(); });
  await p.click('#a7Nueva');
  await p.selectOption('#f_condicion', 'variacion');
  await p.click('.modal-foot .btn.primary');
  await p.waitForSelector('#f_umbral', { timeout: 10000 });
  await p.fill('#f_nombre', 'Acero: más del 3 %');
  await p.fill('#f_umbral', '3');
  await p.selectOption('#f_grupo', 'G05');
  await p.click('.modal-foot .btn.primary');
  await p.waitForFunction(() => AlertasSrv.reglas().some((r) => r.nombre === 'Acero: más del 3 %'), null, { timeout: 10000 });
  const nueva = await p.evaluate(() => { const r = AlertasSrv.reglas().find((x) => x.nombre === 'Acero: más del 3 %'); return { umbral: r.parametros.umbral, grupo: r.parametros.grupo, base: !!r.base }; });
  m.ok(nueva.umbral === 3 && nueva.grupo === 'G05' && !nueva.base, 'una regla nueva desde el editor: variación de más del 3 % en el acero');

  /* ── 360 px ── */
  await p.setViewportSize({ width: 360, height: 780 });
  const anchas = [];
  await tablero(() => irA(p, '00'));
  if ((await desborde()) > 0) anchas.push('00');
  for (const [mod, tabs, sub] of [['06', ['ciudades', 'cortes', 'fuentes']], ['07', ['bandeja', 'reglas', 'salida']], ['04', ['tabla', 'obra', 'pesos'], true]]) {
    await irA(p, mod);
    for (const t of tabs) {
      await p.evaluate(([mo, x, s]) => { if (s) { Sesion.tabs[mo] = 'fletes'; Sesion.filtros.fletes.sub = x; } else Sesion.tabs[mo] = x; App.render(); }, [mod, t, !!sub]);
      if (mod === '06' && t === 'ciudades') await comparadorListo();
      await p.waitForTimeout(300);
      if ((await desborde()) > 0) anchas.push(mod + '/' + t);
    }
  }
  m.ok(anchas.length === 0, 'a 360 px el tablero, el comparador, las alertas y los fletes caben sin desplazamiento lateral' + (anchas.length ? ': ' + anchas.join(', ') : ''));
  await p.setViewportSize({ width: 1366, height: 900 });

  /* ── Borrar la demostración ── */
  await p.evaluate(() => Admin.borrarDemo(true));
  await p.waitForFunction(() => !Datos.lista('fletes').some((f) => f.esDemo), null, { timeout: 60000 });
  const tras = await p.evaluate(() => ({ fletes: Datos.lista('fletes').map((f) => f.destino), alertasDemo: AlertasSrv.alertas().filter((a) => a.esDemo).length,
    canastas: Canastas.propias().length, ipc: Datos.lista('indices').filter((x) => x.serie === 'ipc').length }));
  m.ok(tras.fletes.join() === 'Rionegro' && tras.alertasDemo === 0 && tras.canastas === 1 && tras.ipc === ipc.meses.length,
    'borrar la demostración se lleva sus fletes y sus alertas; quedan el flete, la canasta y el IPC registrados en la prueba');

  m.ok(errores.length === 0, 'sin errores de JavaScript' + (errores.length ? ': ' + errores.slice(0, 5).join(' | ') : ''));
  const registro = await p.evaluate(() => RegistroTecnico.entradas().map((e) => e.contexto + ': ' + e.mensaje));
  m.ok(registro.length === 0, 'registro técnico vacío' + (registro.length ? ': ' + registro.slice(0, 5).join(' | ') : ''));
  console.log('\n  Archivos de la prueba en ' + carpeta);
} catch (e) {
  m.ok(false, 'la prueba se detuvo: ' + (e.stack || e.message || e));
} finally {
  await nav.close();
  await srv.cerrar();
}
console.log(`\n${m.pruebas - m.fallas} de ${m.pruebas} comprobaciones bien.`);
process.exit(m.fallas ? 1 : 0);
