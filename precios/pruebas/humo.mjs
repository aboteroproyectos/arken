// ARKEN PRECIOS · prueba de humo de la interfaz en Chromium (§16 y §18).
//
//   · ingreso con cambio obligatorio de contraseña y recorrido de todos los módulos y pestañas
//   · por la interfaz: un precio a mano con su soporte, una lista en CSV, una cotización en
//     Excel y una lista en PDF, con su revisión antes de guardar
//   · demostración con más de 50.000 observaciones y el tablero filtrado en menos de 1 s (criterio 6)
//   · a lo sumo dos clics de un precio a sus observaciones (criterio 2)
//   · actualizar una categoría no toca las demás ni borra historia (criterio 3)
//   · texto externo escapado, enlaces solo http(s) y ninguna clave en respaldos ni paquetes (criterio 8)
//   · la IA no registra un precio que no esté escrito en el texto leído (criterio 9)
//   · exportaciones: Excel de análisis, PDF completo y por categorías, impresión, paquete,
//     intercambio y respaldo; carta, encabezado y pie de ARKEN y «Página x de y» (criterio 5)
//   · sin conexión todo funciona salvo actualizar desde internet (criterio 4)
//   · temas claro y oscuro, tres densidades y 360 px sin desplazamiento lateral (criterio 7)
//   · la demostración se borra con un botón y los datos reales quedan
//
// Uso: npm run prueba:humo

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import {
  RUTA_PRECIOS, servidor, navegador, contexto, vigilarErrores, abrirPrecios, ingresarPrecios, cerrarModales, irA, marcador,
} from './comun.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
const [avisar, anotar] = [console.warn, console.log];
console.warn = console.log = () => {};          // pdf.js avisa que en Node no hay canvas: aquí solo se lee texto
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
[console.warn, console.log] = [avisar, anotar];
const FUENTES_PDF = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/';

const MODULOS = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11'];
const m = marcador('Prueba de humo de ARKEN PRECIOS');
const carpeta = mkdtempSync(join(tmpdir(), 'arken-precios-humo-'));
const srv = await servidor();
const nav = await navegador();

/** Texto de cada página de un PDF y su tamaño en puntos. */
async function leerPDF(ruta) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(ruta)), isEvalSupported: false, standardFontDataUrl: FUENTES_PDF, verbosity: 0 }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const t = await p.getTextContent();
    paginas.push({ ancho: Math.round(p.view[2] - p.view[0]), alto: Math.round(p.view[3] - p.view[1]), texto: t.items.map((x) => x.str).join(' ') });
  }
  return paginas;
}
const esCarta = (p) => (p.ancho === 612 && p.alto === 792) || (p.ancho === 792 && p.alto === 612);
const numeracion = (paginas) => paginas.every((p, i) => p.texto.includes(`Página ${i + 1} de ${paginas.length}`));

/** Recorre el asistente del Módulo 08 hasta el paso 5 y genera. Devuelve la ruta descargada. */
async function exportar(pagina, tipo, ajustes = {}, { descarga = true } = {}) {
  await irA(pagina, '08');
  if (await pagina.locator('#e8Otra').count()) await pagina.click('#e8Otra');
  await pagina.click(`.opcion[data-t="${tipo}"]`);
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const paso = await pagina.evaluate(() => ExportarUI.estado().paso);
    if (paso === 5) break;
    if (ajustes[paso]) await ajustes[paso](pagina);
    await pagina.click('#e8Sig');
    await pagina.waitForFunction((p) => ExportarUI.estado().paso !== p, paso, { timeout: 15000 });
  }
  await pagina.waitForFunction(() => { const b = document.getElementById('e8Sig'); return b && !b.disabled; }, null, { timeout: 120000 });
  if (!descarga) {
    await pagina.click('#e8Sig');
    await pagina.waitForSelector('#e8Otra', { timeout: 60000 });
    return null;
  }
  const [d] = await Promise.all([pagina.waitForEvent('download', { timeout: 120000 }), pagina.click('#e8Sig')]);
  const ruta = join(carpeta, d.suggestedFilename());
  await d.saveAs(ruta);
  await pagina.waitForSelector('#e8Otra', { timeout: 60000 });
  return ruta;
}
const elegirCiudades = (codigos) => async (pagina) => {
  await pagina.click('#e8Ciudades button.multi-btn');
  for (const c of codigos) await pagina.check(`#e8Ciudades input[value="${c}"]`);
  await pagina.click('#e8Paso h3');
};

try {
  const ctx = await contexto(nav);
  await ctx.addInitScript(() => { window.print = () => { window.__impresiones = (window.__impresiones || 0) + 1; }; });
  const p = await ctx.newPage();
  const errores = vigilarErrores(p);

  /* ── Ingreso y recorrido ── */
  await abrirPrecios(p, srv.url(RUTA_PRECIOS));
  await ingresarPrecios(p, 'admin', 'arken', 'prueba123');
  m.ok(true, 'ingreso con admin, cambio obligatorio de contraseña y sistema abierto');
  m.ok(await p.evaluate(() => document.getElementById('arken-precios-datos').textContent.trim() === 'null'), 'el HTML no trae datos de la empresa');

  async function recorrer(etiqueta) {
    const fallas = [];
    for (const mod of MODULOS) {
      await irA(p, mod);
      await p.waitForTimeout(250);
      const tabs = await p.evaluate(() => Array.from(document.querySelectorAll('#stage .tabs:not(.sub) .tab')).map((t) => t.dataset.k));
      for (const t of [null, ...tabs.slice(1)]) {
        if (t) {
          await p.click(`#stage .tabs:not(.sub) .tab[data-k="${t}"]`);
          await p.waitForTimeout(200);
        }
        const f = await p.evaluate(() => (document.querySelector('#stage .warn-box') || {}).textContent || '');
        if (f) fallas.push(`${mod}${t ? '/' + t : ''}: ${f.slice(0, 120)}`);
      }
      if (tabs.length > 1) await p.click(`#stage .tabs:not(.sub) .tab[data-k="${tabs[0]}"]`);   // cada módulo queda en su primera pestaña
    }
    m.ok(fallas.length === 0, `${etiqueta}: los 12 módulos y sus pestañas se pintan sin fallas` + (fallas.length ? ' · ' + fallas.join(' | ') : ''));
  }
  await recorrer('sin datos');

  /* ── Precios a mano, listas y cotizaciones por la interfaz ── */
  const refC = await p.evaluate(() => Datos.ciudadReferencia().codigoDivipola);
  const hoy = await p.evaluate(() => hoyISO());
  const pesosCO = (n) => '$ ' + Math.round(n).toLocaleString('de-DE');     // «$ 35.200», como se escribe en Colombia
  const deReferencia = (grupo) => p.evaluate((g) => Datos.insumosActivos().filter((i) => i.grupo === g && i.codigoArken).slice(0, 3)
    .map((i) => ({ id: i.id, codigo: i.codigo, descripcion: i.descripcion, unidad: i.unidad, ref: (Datos.obs(i.id).find((o) => o.tipoPrecio === 'referencia') || {}).precioConIva })), grupo);
  const consolidados = (ids) => p.evaluate(([l, c]) => l.map((id) => { const k = Datos.consolidado(id, c); return k ? { rec: k.recomendado, n: k.n } : null; }), [ids, refC]);
  /** Sube un archivo por Módulo 04 › Importar y devuelve lo que propone la revisión. */
  async function subir(ruta, pestana) {
    await irA(p, '04');
    await p.click(`#stage .tabs:not(.sub) .tab[data-k="${pestana}"]`);
    const [selector] = await Promise.all([p.waitForEvent('filechooser'), p.click('#c4Importar')]);
    await selector.setFiles(ruta);
    await p.waitForSelector('#tRev tbody tr[data-i]', { timeout: 30000 });
    return p.evaluate(() => Array.from(document.querySelectorAll('#tRev tbody tr[data-i]'))
      .map((tr) => ({ marcado: tr.querySelector('[data-c=incluir]').checked, insumo: tr.querySelector('[data-c=insumoId]').value })));
  }
  const emparejados = (filas, insumos) => filas.length === insumos.length && filas.every((f, k) => f.marcado && f.insumo === insumos[k].id);

  // Un precio a mano: el soporte se lee y, al guardar, el insumo se actualiza en la ciudad.
  const cemento = await p.evaluate(() => Datos.insumosActivos().find((i) => i.codigoSemillaArken === 'MT001').id);
  await irA(p, '04');
  await p.click('#c4Precio');
  await p.fill('#pmIns', 'cemento gris tipo ug');
  await p.click('.sugerir-lista.abierta button >> nth=0');
  await p.fill('#pmLit', 'Cemento gris uso general x 50 kg $ 35.200 IVA incluido · llamada a la ferretería');
  await p.click('#pmLeer');
  const leido = await p.evaluate(() => ['pmPrecio', 'pmIva', 'pmPres'].map((id) => document.getElementById(id).value));
  await p.click('.overlay:last-child .modal-foot .btn.primary');
  await p.waitForFunction(([id, c]) => !Motor.enCurso() && (Datos.consolidado(id, c) || {}).n === 1, [cemento, refC], { timeout: 30000 });
  const [manual] = await consolidados([cemento]);
  m.ok(leido.join(' · ') === '35,200 · si · 50 KG' && manual.rec === 35200,
    `precio a mano: el soporte se lee (${leido.join(' · ')}) y el cemento queda en ${manual.rec} en la base`);
  await cerrarModales(p);

  // Lista de precios en CSV con punto y coma, emparejada por código, y «Actualizar estos insumos ahora».
  const enCsv = await deReferencia('G05');
  const rutaCsv = join(carpeta, 'Lista ferreteria prueba.csv');
  writeFileSync(rutaCsv, 'Código;Descripción;Unidad;Precio unitario\n' + enCsv.map((i) => [i.codigo, i.descripcion, i.unidad, pesosCO(i.ref * 1.03)].join(';')).join('\n') + '\n');
  const filasCsv = await subir(rutaCsv, 'listas');
  await p.fill('#f_fecha', hoy);
  await p.click('.overlay:last-child .modal-foot .btn.primary');
  await p.click('.overlay:last-child .modal-foot button:has-text("Actualizar estos")');
  await p.waitForFunction(([l, c]) => !Motor.enCurso() && l.every((id) => (Datos.consolidado(id, c) || {}).n === 1), [enCsv.map((i) => i.id), refC], { timeout: 30000 });
  const trasCsv = await consolidados(enCsv.map((i) => i.id));
  m.ok(emparejados(filasCsv, enCsv) && trasCsv.every((x, k) => x.rec === Math.round(enCsv[k].ref * 1.03)),
    `lista en CSV con punto y coma: 3 renglones emparejados por código y llevados a la base (${trasCsv.map((x) => x.rec).join(', ')})`);
  await cerrarModales(p);

  // Cotización en Excel con «Ítem» antes de «Descripción»: se empareja por la descripción
  // (2.500, 3.000 y 3.500 psi no se confunden) y la base no cambia hasta actualizar.
  const enXlsx = await deReferencia('G03');
  const libroCot = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libroCot, XLSX.utils.aoa_to_sheet([['COTIZACIÓN 0457'], ['Cliente: obra de prueba'], [],
    ['Ítem', 'Descripción', 'Unidad', 'Cantidad', 'Valor unitario', 'Valor total'],
    ...enXlsx.map((i, k) => [k + 1, i.descripcion, i.unidad, 10, Math.round(i.ref * 0.98), 10 * Math.round(i.ref * 0.98)])]), 'Cotización');
  const rutaXlsx = join(carpeta, 'Cotizacion 0457.xlsx');
  XLSX.writeFile(libroCot, rutaXlsx);
  const antesXlsx = await consolidados(enXlsx.map((i) => i.id));
  const filasXlsx = await subir(rutaXlsx, 'cotizaciones');
  await p.fill('#f_proveedor', 'Concretos de Prueba S.A.S.');
  await p.click('.overlay:last-child .modal-foot .btn.primary');
  await p.click('.overlay:last-child .modal-foot button:has-text("Cerrar")');
  const cotizacion = await p.evaluate(([l, c]) => {
    const x = Datos.lista('cotizaciones').find((k) => k.proveedor === 'Concretos de Prueba S.A.S.');
    return { renglones: x ? x.renglones.map((r) => r.precio) : [], pendientes: l.every((id) => Precios.pendientes(c).includes(id)) };
  }, [enXlsx.map((i) => i.id), refC]);
  const despuesXlsx = await consolidados(enXlsx.map((i) => i.id));
  m.ok(emparejados(filasXlsx, enXlsx) && cotizacion.renglones.join() === enXlsx.map((i) => Math.round(i.ref * 0.98)).join() &&
    cotizacion.pendientes && JSON.stringify(antesXlsx) === JSON.stringify(despuesXlsx),
    'cotización en Excel: emparejada por la descripción, guardada con sus precios y pendiente hasta actualizar');

  // Lista de precios en PDF (armada aquí con jsPDF): las columnas salen de su encabezado.
  const enPdf = await deReferencia('G10');
  const pdfLista = await p.evaluate(([filas]) => {
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'letter' });
    doc.setFontSize(9);
    doc.text('FERRETERIA DE PRUEBA - LISTA DE PRECIOS', 40, 50);
    const xs = [40, 110, 400, 470];
    ['Código', 'Descripción', 'Und', 'Precio'].forEach((t, i) => doc.text(t, xs[i], 80));
    filas.forEach((f, k) => [f.codigo, f.descripcion, f.unidad, f.precio].forEach((t, i) => doc.text(String(t), xs[i], 100 + k * 16)));
    return doc.output('datauristring').split(',')[1];
  }, [enPdf.map((i) => ({ ...i, precio: pesosCO(i.ref * 1.02) }))]);
  const rutaPdfLista = join(carpeta, 'Lista PDF prueba.pdf');
  writeFileSync(rutaPdfLista, Buffer.from(pdfLista, 'base64'));
  const filasPdf = await subir(rutaPdfLista, 'listas');
  await p.fill('#f_fecha', hoy);
  await p.click('.overlay:last-child .modal-foot .btn.primary');
  await p.click('.overlay:last-child .modal-foot button:has-text("Cerrar")');
  const listaPdf = await p.evaluate(() => {
    const x = Datos.lista('cotizaciones').find((k) => k.archivo && k.archivo.nombre === 'Lista PDF prueba.pdf');
    return x ? { precios: x.renglones.map((r) => r.precio), nuevas: x.resumen.nuevas, hash: x.archivo.hash.length } : null;
  });
  m.ok(emparejados(filasPdf, enPdf) && listaPdf && listaPdf.nuevas === 3 && listaPdf.hash === 64 &&
    listaPdf.precios.join() === enPdf.map((i) => Math.round(i.ref * 1.02)).join(),
    'lista en PDF: columnas leídas por su encabezado, 3 renglones guardados con la huella del archivo');
  await cerrarModales(p);

  // 02 · Actualizar precios por la interfaz, solo los cementos: los concretos de la cotización
  // siguen pendientes y la base no los toca.
  const blanco = await p.evaluate(async (c) => {
    const ins = Datos.insumosActivos().filter((i) => i.grupo === 'G02' && i.codigoArken)[1];
    const precio = Math.round(Datos.obs(ins.id).find((o) => o.tipoPrecio === 'referencia').precioConIva * 1.02);
    await Registro.registrar([{ insumoId: ins.id, ciudad: c, fechaCaptura: hoyISO(), precioPublicado: precio, unidadPublicada: ins.unidad, incluyeIva: true,
      tipoPrecio: 'cotización', fuenteId: 'manual', proveedor: 'Prueba', textoLiteral: 'Cotización telefónica $ ' + precio, metodo: 'manual' }], { origen: 'prueba' });
    return { id: ins.id, precio, pendiente: Precios.pendientes(c).includes(ins.id) };
  }, refC);
  await irA(p, '02');
  await p.check('input[name=a2Tipo][value=categorias]');
  await p.check('#a2Arbol input[data-grupo="G02"]');
  await p.click('#a2Sig');
  await p.click('#a2Ejecutar');
  await p.waitForSelector('#a2Nueva', { timeout: 60000 });
  const trasUI = await p.evaluate(([b, l, c]) => ({ blanco: (Datos.consolidado(b, c) || {}).recomendado, sigue: Precios.pendientes(c).includes(b),
    concretos: l.every((id) => Precios.pendientes(c).includes(id)) }), [blanco.id, enXlsx.map((i) => i.id), refC]);
  const concretosDespues = await consolidados(enXlsx.map((i) => i.id));
  m.ok(blanco.pendiente && trasUI.blanco === blanco.precio && !trasUI.sigue && trasUI.concretos && JSON.stringify(concretosDespues) === JSON.stringify(antesXlsx),
    'actualizar solo los cementos desde el Módulo 02: el cemento toma su precio nuevo y los concretos de la cotización siguen pendientes, sin cambios');

  /* ── Demostración y tablero ── */
  const demo = await p.evaluate(() => Admin.cargarDemo({ silencioso: true, meses: 24, cobertura: 1 }));
  await cerrarModales(p);
  const totalObs = await p.evaluate(() => Datos.totalObs());
  m.ok(demo && demo.observaciones >= 50000, `demostración rotulada con ${demo ? demo.observaciones : 0} observaciones sintéticas (${totalObs} en total)`);

  await irA(p, '00');
  await p.waitForFunction(() => document.getElementById('stage').dataset.ms !== undefined, null, { timeout: 60000 });
  const tiempos = await p.evaluate(async () => {
    const ciudades = Datos.ciudadesActivas().slice(0, 3).map((c) => c.codigoDivipola);
    const base = { ciudades, grupos: [], categorias: [], insumos: [], fuentes: [], tipo: '', est: 'med', incluirDemo: true, referencia: Datos.ciudadReferencia().codigoDivipola, umbralAlza: 0.05 };
    const casos = [
      { ...base, desde: sumaDias(hoyISO(), -365), hasta: hoyISO(), categoriaArken: 'Materiales' },
      { ...base, desde: sumaDias(hoyISO(), -182), hasta: hoyISO(), categoriaArken: '', categorias: ['G02|Cementos', 'G05|Barras corrugadas'] },
      { ...base, desde: sumaDias(hoyISO(), -730), hasta: sumaDias(hoyISO(), -365), categoriaArken: 'Ferretería', ciudades: [] },
    ];
    const out = [];
    for (const f of casos) {
      const t0 = performance.now();
      const r = await Tablero.consultar(f);
      out.push({ ms: Math.round(performance.now() - t0), series: r.evol.series.length, insumos: r.nInsumos });
    }
    return out;
  });
  m.ok(tiempos.every((t) => t.ms < 1000 && t.insumos > 0), `tablero filtrado por fechas, ciudades y categorías a la vez: ${tiempos.map((t) => t.ms + ' ms').join(', ')}`);
  await p.evaluate(() => { delete document.getElementById('stage').dataset.ms; });
  await p.selectOption('#t0CatA', 'Equipos');
  await p.waitForFunction(() => document.getElementById('stage').dataset.ms !== undefined, null, { timeout: 15000 });
  const msUI = Number(await p.evaluate(() => document.getElementById('stage').dataset.ms));
  m.ok(msUI < 1000, `en pantalla, cambiar la categoría recalcula en ${msUI} ms`);

  /* ── Dos clics al soporte ── */
  await irA(p, '01');
  await p.locator('#stage [data-ficha]').first().click();
  await p.waitForSelector('#modales .overlay .tab.active[data-k="obs"]', { timeout: 15000 });
  const ficha = await p.evaluate(() => {
    const ov = document.querySelector('#modales .overlay:last-child');
    const enc = Array.from(ov.querySelectorAll('thead th')).map((t) => t.textContent.trim().toLowerCase());
    return { enc, filas: ov.querySelectorAll('tbody tr').length };
  });
  m.ok(ficha.filas > 0 && ['fecha', 'texto', 'enlace'].every((k) => ficha.enc.some((h) => h.includes(k))), `un clic en un precio de la base abre sus observaciones con fecha, texto literal y enlace (${ficha.filas} filas)`);
  await cerrarModales(p);
  await irA(p, '06');
  await p.waitForSelector('#stage [data-fi]', { timeout: 15000 });
  await p.locator('#stage [data-fi]').first().click();
  m.ok(await p.waitForSelector('#modales .overlay .tab.active[data-k="obs"]', { timeout: 15000 }).then(() => true, () => false), 'desde el comparador, también un clic');
  await cerrarModales(p);

  /* ── Actualizar una categoría ── */
  const c3 = await p.evaluate(async () => {
    const ref = Datos.ciudadReferencia().codigoDivipola;
    const activos = Datos.insumosActivos().filter((i) => i.investigable !== false);
    const elegida = activos.find((i) => i.grupo === 'G02' && Datos.consolidado(i.id, ref));
    const otra = activos.find((i) => i.grupo === 'G05' && Datos.consolidado(i.id, ref));
    const foto = () => { const m2 = {}; Datos.consolidados().forEach((v, k) => { m2[k] = JSON.stringify(v); }); return m2; };
    const antes = foto(), obsAntes = Datos.totalObs();
    const precioOtra = Datos.consolidado(otra.id, ref).recomendado;
    // Precios plausibles (3 % sobre el actual) para que entren como válidos y no como atípicos.
    const captura = (ins) => { const precio = redondear(Datos.consolidado(ins.id, ref).recomendado * 1.03); return { insumoId: ins.id, ciudad: ref, fechaCaptura: hoyISO(), precioPublicado: precio,
      unidadPublicada: ins.unidad, incluyeIva: true, tipoPrecio: 'cotización', fuenteId: 'manual', proveedor: 'Prueba', textoLiteral: 'Cotización de prueba $ ' + precio, metodo: 'manual' }; };
    const r = await Registro.registrar([captura(elegida), captura(otra)], { origen: 'prueba' });
    const ids = activos.filter((i) => i.grupo === elegida.grupo && i.categoria === elegida.categoria).map((i) => i.id);
    await Motor.ejecutar({ tipo: 'categorias', descripcion: 'Prueba: una categoría', insumoIds: ids, ciudades: [ref] }, {});
    const despues = foto();
    const enAlcance = new Set(ids);
    const tocadas = Object.keys(despues).filter((k) => antes[k] !== despues[k] && !enAlcance.has(JSON.parse(despues[k]).insumoId));
    const perdidas = Object.keys(antes).filter((k) => !(k in despues));
    return { nuevas: r.nuevas.length, validas: r.nuevas.filter((x) => x.estado === 'válida').length, obsAntes, obsDespues: Datos.totalObs(), tocadas: tocadas.length, perdidas: perdidas.length,
      otraIgual: Datos.consolidado(otra.id, ref).recomendado === precioOtra, pendiente: Precios.pendientes(ref).includes(otra.id), elegidaPendiente: Precios.pendientes(ref).includes(elegida.id) };
  });
  m.ok(c3.validas === 2 && c3.tocadas === 0 && c3.otraIgual && c3.pendiente && !c3.elegidaPendiente,
    'actualizar una categoría no toca las demás: el precio nuevo de otra categoría queda pendiente' + (c3.validas === 2 ? '' : ` (${JSON.stringify(c3)})`));
  m.ok(c3.obsDespues === c3.obsAntes + 2 && c3.perdidas === 0, 'ninguna actualización borra historia (observaciones y cálculos anteriores intactos)');

  /* ── Escape y enlaces ── */
  const xss = await p.evaluate(async () => {
    const ref = Datos.ciudadReferencia().codigoDivipola;
    const ins = Datos.insumosActivos().find((i) => i.grupo === 'G02');
    const r = await Registro.registrar([{ insumoId: ins.id, ciudad: ref, fechaCaptura: hoyISO(), precioPublicado: 31000, unidadPublicada: ins.unidad, incluyeIva: true, tipoPrecio: 'lista',
      fuenteId: 'manual', proveedor: '<img src=x onerror="window.__xss=1">', url: 'javascript:window.__xss=2', metodo: 'manual',
      textoLiteral: '<script>window.__xss=3</script><img src=y onerror="window.__xss=4"> $ 31.000' }], { origen: 'prueba' });
    return { id: ins.id, url: r.nuevas[0] && r.nuevas[0].url };
  });
  await p.evaluate((id) => Ficha.abrir(id, Datos.ciudadReferencia().codigoDivipola, 'obs'), xss.id);
  await p.waitForSelector('#modales .overlay .tab.active[data-k="obs"]', { timeout: 15000 });
  await p.waitForTimeout(400);
  const inyectado = await p.evaluate(() => ({ xss: window.__xss, imgs: document.querySelectorAll('#modales img[src="x"], #modales img[src="y"]').length,
    scripts: document.querySelectorAll('#modales script').length, js: document.querySelectorAll('a[href^="javascript"]').length }));
  m.ok(!inyectado.xss && !inyectado.imgs && !inyectado.scripts && !inyectado.js && xss.url === '', 'el texto externo se pinta escapado y un enlace javascript: se descarta');
  await cerrarModales(p);

  /* ── La IA no crea precios ── */
  const ia = await p.evaluate(async () => {
    const ref = Datos.ciudadReferencia().codigoDivipola;
    const ins = Datos.insumosActivos().find((i) => i.grupo === 'G02');
    const base = { insumoId: ins.id, ciudad: ref, fechaCaptura: hoyISO(), unidadPublicada: ins.unidad, incluyeIva: true, tipoPrecio: 'lista', fuenteId: 'manual', metodo: 'ia' };
    const r1 = await Registro.registrar([{ ...base, precioPublicado: 33333, textoLiteral: 'Cemento gris x 50 kg $ 32.900' }], { origen: 'prueba IA' });
    const r2 = await Registro.registrar([{ ...base, precioPublicado: 32900, textoLiteral: 'Cemento gris x 50 kg $ 32.900' }], { origen: 'prueba IA' });
    return { rechazada: r1.rechazadas.length === 1 && r1.nuevas.length === 0, motivo: (r1.rechazadas[0] || {}).motivo, aceptada: r2.nuevas.length === 1 };
  });
  m.ok(ia.rechazada && ia.aceptada, `un precio que no está escrito en el texto leído no se registra («${ia.motivo}»)`);

  /* ── Exportaciones ── */
  const ref = await p.evaluate(() => Datos.ciudadReferencia().codigoDivipola);
  const otraCiudad = await p.evaluate((r) => Datos.ciudadesActivas().map((c) => c.codigoDivipola).find((c) => c !== r && Datos.consolidados().size), ref);

  const rutaAnalisis = await exportar(p, 'analisis', { 3: elegirCiudades([otraCiudad]), 4: async (pg) => pg.check('[data-o="incluirDemo"]') });
  const libro = XLSX.read(readFileSync(rutaAnalisis));
  const filasPrecios = XLSX.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]], { header: 1 }).length;
  m.ok(libro.SheetNames.length >= 5 && filasPrecios > 100, `Excel de análisis: ${libro.SheetNames.join(', ')}`);

  const rutaPdf = await exportar(p, 'pdf', { 4: async (pg) => pg.check('[data-o="incluirDemo"]') });
  const pdf = await leerPDF(rutaPdf);
  m.ok(pdf.length > 5 && pdf.every(esCarta), `PDF de la base completa: ${pdf.length} páginas tamaño carta`);
  m.ok(numeracion(pdf) && pdf.every((pg) => /ARKEN/.test(pg.texto)), 'cada página con el encabezado y el pie de ARKEN y «Página x de y»');
  const rutaPdfCat = await exportar(p, 'pdf', {
    2: async (pg) => { await pg.check('input[name=e8Alc][value=categorias]'); await pg.check('#e8Arbol input[data-grupo="G02"]'); },
    4: async (pg) => pg.check('[data-o="incluirDemo"]'),
  });
  const pdfCat = await leerPDF(rutaPdfCat);
  m.ok(pdfCat.length < pdf.length && pdfCat.every(esCarta) && numeracion(pdfCat) && /Cementos/.test(pdfCat.map((x) => x.texto).join(' ')), `PDF por categorías (G02): ${pdfCat.length} páginas`);

  await exportar(p, 'imprimir', { 2: async (pg) => { await pg.check('input[name=e8Alc][value=categorias]'); await pg.check('#e8Arbol input[data-grupo="G02"]'); } }, { descarga: false });
  await p.waitForFunction(() => window.__impresiones > 0, null, { timeout: 15000 });
  const estiloPagina = await p.evaluate(() => document.getElementById('printPageStyle').textContent);
  m.ok(/size:\s*letter/.test(estiloPagina) && /counter\(page\)/.test(estiloPagina) && /counter\(pages\)/.test(estiloPagina), 'imprimir: @page carta con «Página x de y»');
  await p.emulateMedia({ media: 'print' });
  const rutaImpresa = join(carpeta, 'impresion.pdf');
  await p.pdf({ path: rutaImpresa, preferCSSPageSize: true, printBackground: true });
  await p.emulateMedia({ media: 'screen' });
  const impreso = await leerPDF(rutaImpresa);
  m.ok(impreso.length > 0 && impreso.every(esCarta) && numeracion(impreso) && /ARKEN PRECIOS/.test(impreso[0].texto), `la impresión del navegador sale en carta con su numeración (${impreso.length} páginas)`);

  await p.evaluate(() => Datos.fijarConfig('ia', { claveApi: 'sk-ant-api03-PRUEBAPRUEBAPRUEBA', modelo: 'prueba' }));
  const rutaPaquete = await exportar(p, 'paquete');
  const textoPaquete = readFileSync(rutaPaquete, 'utf8');
  const verificado = await p.evaluate((t) => Formatos.verificar(JSON.parse(t), Formatos.PAQUETE).ok, textoPaquete);
  m.ok(verificado && !/sk-ant-/.test(textoPaquete), 'paquete de precios con su hash y sin claves');
  const rutaIntercambio = await exportar(p, 'intercambio', { 4: async (pg) => pg.check('[data-o="incluirDemo"]') });
  const textoInter = readFileSync(rutaIntercambio, 'utf8');
  m.ok(await p.evaluate((t) => Formatos.verificar(JSON.parse(t), Formatos.INTERCAMBIO).ok, textoInter), 'archivo de intercambio con su hash');
  const rutaRespaldo = await exportar(p, 'respaldo');
  const bytes = readFileSync(rutaRespaldo);
  const textoRespaldo = rutaRespaldo.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
  m.ok(/ARKEN/.test(textoRespaldo) && !/sk-ant-/.test(textoRespaldo) && !/prueba123/.test(textoRespaldo), 'respaldo completo sin claves ni contraseñas en claro');
  await p.evaluate(() => Datos.fijarConfig('ia', null));

  /* ── Sin conexión ── */
  const pedidos = [];
  p.on('request', (r) => { if (!r.url().startsWith('blob:') && !r.url().startsWith('data:')) pedidos.push(r.url()); });
  await ctx.setOffline(true);
  await recorrer('sin conexión');
  const sinRed = await p.evaluate(async () => {
    const ref = Datos.ciudadReferencia().codigoDivipola;
    const ins = Datos.insumosActivos().find((i) => i.grupo === 'G01');
    const r = await Registro.registrar([{ insumoId: ins.id, ciudad: ref, fechaCaptura: hoyISO(), precioPublicado: 77000, unidadPublicada: ins.unidad, incluyeIva: true, tipoPrecio: 'cotización',
      fuenteId: 'manual', proveedor: 'Sin conexión', textoLiteral: 'Cotización telefónica $ 77.000', metodo: 'manual' }], { origen: 'prueba sin conexión' });
    const e = await Motor.ejecutar({ tipo: 'insumos', descripcion: 'Sin conexión', insumoIds: [ins.id], ciudades: [ref] }, {});
    return { registrada: r.nuevas.length === 1, estado: e.estado };
  });
  const rutaOffline = await exportar(p, 'arken', { 3: async (pg) => pg.selectOption('#e8Corte', ''), 4: async (pg) => { await pg.check('[data-o="incluirDemo"]'); await pg.check('[data-o="incluirReferencia"]'); } });
  await ctx.setOffline(false);
  m.ok(sinRed.registrada && /\.xlsx$/.test(rutaOffline || ''), `sin conexión: registrar, recalcular (${sinRed.estado}) y exportar el Excel para ARKEN`);
  m.ok(pedidos.length === 0, 'sin conexión el programa no intentó ningún pedido a la red' + (pedidos.length ? ': ' + pedidos.slice(0, 3).join(', ') : ''));

  /* ── Temas, densidades y 360 px ── */
  await irA(p, '10');
  await p.click('#stage .tabs:not(.sub) .tab[data-k="apariencia"]');
  await p.check('input[name=cfTema][value=oscuro]');
  await p.check('input[name=cfDens][value=compacta]');
  await p.click('#cfApG');
  const oscuro = await p.evaluate(() => ({ tema: document.documentElement.dataset.tema, dens: document.documentElement.dataset.density, fondo: getComputedStyle(document.body).backgroundColor }));
  m.ok(oscuro.tema === 'oscuro' && oscuro.dens === 'compacta', `Configuración › Apariencia aplica el tema oscuro y la densidad compacta (fondo ${oscuro.fondo})`);
  await p.setViewportSize({ width: 360, height: 760 });
  const anchos = [];
  for (const tema of ['claro', 'oscuro']) {
    for (const dens of ['compacta', 'normal', 'amplia']) {
      await p.evaluate(([t, d]) => Datos.fijarConfig('apariencia', { tema: t, densidad: d }).then(() => App.aplicarConfig()), [tema, dens]);
      for (const mod of MODULOS) {
        await p.evaluate((x) => App.ir(x), mod);
        await p.waitForTimeout(120);
        const ancho = await p.evaluate(() => document.documentElement.scrollWidth);
        if (ancho > 361) anchos.push(`${tema}/${dens}/${mod}: ${ancho} px`);
      }
    }
  }
  m.ok(anchos.length === 0, 'a 360 px ningún módulo se desplaza de lado, en los dos temas y las tres densidades' + (anchos.length ? ' · ' + anchos.slice(0, 6).join(', ') : ''));
  await p.evaluate(() => App.ir('01'));
  await p.waitForTimeout(300);
  await p.locator('#stage [data-ficha]').first().click();
  await p.waitForSelector('#modales .overlay', { timeout: 15000 });
  const anchoFicha = await p.evaluate(() => document.documentElement.scrollWidth);
  m.ok(anchoFicha <= 361, `la ficha de un precio cabe en 360 px (${anchoFicha} px)`);
  await cerrarModales(p);
  await p.screenshot({ path: join(carpeta, 'base-360-oscuro.png') });
  await p.setViewportSize({ width: 1366, height: 860 });
  await p.evaluate(() => Datos.fijarConfig('apariencia', { tema: 'claro', densidad: 'normal' }).then(() => App.aplicarConfig()));

  /* ── Borrar la demostración ── */
  await irA(p, '00');
  await p.evaluate(() => Admin.abrir('demo'));
  await p.click('#adDemoB');
  await p.click('.overlay:last-child .modal-foot .btn.danger');
  await p.waitForFunction(() => !Admin.hayDemo() && !Motor.enCurso(), null, { timeout: 120000 });
  const tras = await p.evaluate(() => {
    let demoObs = 0, reales = 0;
    Datos.obsTodas().forEach((o) => { if (o.esDemo) demoObs++; else if (o.tipoPrecio !== 'referencia') reales++; });
    return { demoObs, reales, cortesDemo: Datos.cortes().filter((c) => c.incluyeDemo).length, fuentesDemo: Datos.fuentes().filter((f) => f.esDemo).length };
  });
  m.ok(tras.demoObs === 0 && tras.cortesDemo === 0 && tras.fuentesDemo === 0, 'un botón borra la demostración: observaciones, fuentes y cortes DEMO');
  m.ok(tras.reales >= 5, `los precios registrados de verdad se conservan (${tras.reales})`);
  await cerrarModales(p);
  await recorrer('después de borrar la demostración');

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
