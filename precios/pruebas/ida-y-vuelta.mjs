// ARKEN PRECIOS · prueba de ida y vuelta con el ARKEN CONTROL real (§10.1 y §18, criterio 1).
//
//   1. ARKEN PRECIOS: ingreso, demostración, tres precios a mano para insumos que ARKEN
//      no tiene, y el Excel para ARKEN por el asistente del Módulo 08 (con su validador).
//   2. El archivo, leído aquí con SheetJS: siete categorías, precios numéricos mayores que
//      cero, sin descripciones repetidas, y los de la semilla con la unidad y la categoría
//      exactas de ARKEN.
//   3. ARKEN CONTROL (programa/ARKEN_CONTROL.html): proyecto nuevo, Módulo 04 › Importar
//      desde Excel. Todos los de la semilla salen «Ya existe»; al sobrescribir cambia solo
//      el precio; los nuevos se crean con su categoría, unidad y precio.
//   4. Vuelta: la lista maestra que exporta ARKEN se importa en ARKEN PRECIOS (Módulo 09)
//      y el siguiente Excel ya sale con todos sus renglones como «Ya existe».
//
// Uso: npm run prueba:ida-y-vuelta

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import {
  RAIZ, RUTA_PRECIOS, RUTA_ARKEN, servidor, navegador, contexto, vigilarErrores,
  abrirPrecios, ingresarPrecios, cerrarModales, irA, abrirArken, ingresarArken, marcador,
} from './comun.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const CATEGORIAS = ['Materiales', 'Mano de Obra', 'Herramientas', 'Equipos', 'Ferretería', 'Consumibles', 'Todo Costo'];
const normaliza = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** La semilla de ARKEN, leída del programa: [código, descripción, unidad, tipo, precio]. */
function semillaArken() {
  const html = readFileSync(join(RAIZ, 'programa/ARKEN_CONTROL.html'), 'utf8');
  const i = html.indexOf('const INSUMOS_BASE = [');
  const j = html.indexOf('\n];', i);
  const filas = Function('return ' + html.slice(i + 'const INSUMOS_BASE = '.length, j + 2))();
  const CAT = { MO: 'Mano de Obra', MT: 'Materiales', HE: 'Herramientas', FE: 'Ferretería', EQ: 'Equipos', TC: 'Todo Costo' };
  return new Map(filas.map(([, des, un, tipo, precio]) => [normaliza(des), { descripcion: des, unidad: un, categoria: CAT[tipo] || 'Materiales', precio: Number(precio) || 0 }]));
}

/** Lo que ARKEN lee de la primera hoja (misma lógica que elegirArchivoInsumos). */
function leerComoArken(ruta) {
  const wb = XLSX.read(readFileSync(ruta));
  const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  const inicio = filas.findIndex((r) => r && String(r[0] || '').toLowerCase().indexOf('categor') >= 0);
  return { hojas: wb.SheetNames, encabezado: filas[inicio], filas: filas.slice(inicio + 1).filter((r) => r && r[2]) };
}

/** Asistente del Módulo 08 hasta guardar el Excel para ARKEN. Devuelve la validación y la ruta. */
async function excelParaArken(pagina, carpeta, nombre, { incluirDemo, incluirReferencia }) {
  await irA(pagina, '08');
  if (await pagina.locator('#e8Otra').count()) await pagina.click('#e8Otra');   // el asistente quedó en «Generar»
  await pagina.click('.opcion[data-t="arken"]');
  await pagina.click('#e8Sig');                                   // 1 → 2
  await pagina.click('#e8Sig');                                   // 2 → 3 (toda la base)
  await pagina.selectOption('#e8Corte', '');                       // la base vigente
  await pagina.click('#e8Sig');                                   // 3 → 4
  for (const [k, v] of [['incluirDemo', incluirDemo], ['incluirReferencia', incluirReferencia]]) {
    const caja = pagina.locator(`[data-o="${k}"]`);
    if (await caja.count()) await caja.setChecked(v);
  }
  await pagina.click('#e8Sig');                                   // 4 → 5
  await pagina.waitForSelector('#e8Paso .validador', { timeout: 60000 });
  const validacion = await pagina.evaluate(() => {
    const r = ExportarUI.estado().resultado;
    const motivos = {};
    r.excluidos.forEach((x) => { motivos[x.motivo] = (motivos[x.motivo] || 0) + 1; });
    return { ...r.validacion, nombre: r.nombre, renglones: r.renglones.length, existentes: r.existentes, nuevos: r.nuevos, motivos, boton: !document.getElementById('e8Sig').disabled };
  });
  if (!validacion.ok) return { validacion };
  const [descarga] = await Promise.all([pagina.waitForEvent('download', { timeout: 30000 }), pagina.click('#e8Sig')]);
  const ruta = join(carpeta, nombre);
  await descarga.saveAs(ruta);
  await pagina.waitForSelector('#e8Otra', { timeout: 15000 });
  return { validacion, ruta, sugerido: descarga.suggestedFilename() };
}

const m = marcador('Ida y vuelta con ARKEN CONTROL');
const carpeta = mkdtempSync(join(tmpdir(), 'arken-precios-'));
const srv = await servidor();
const nav = await navegador();
const semilla = semillaArken();

try {
  /* ── 1. ARKEN PRECIOS ── */
  const ctxP = await contexto(nav);
  const pp = await ctxP.newPage();
  const erroresP = vigilarErrores(pp);
  await abrirPrecios(pp, srv.url(RUTA_PRECIOS));
  await ingresarPrecios(pp, 'admin', 'arken', 'prueba123');
  m.ok(true, 'ARKEN PRECIOS: ingreso y cambio obligatorio de contraseña');

  const demo = await pp.evaluate(() => Admin.cargarDemo({ silencioso: true, meses: 3, cobertura: 1 }));
  await cerrarModales(pp);
  m.ok(demo && demo.observaciones > 0, `demostración cargada (${demo ? demo.observaciones : 0} observaciones sintéticas)`);

  // Tres precios a mano para insumos que ARKEN no tiene (la prueba los inventa en un navegador desechable).
  const nuevos = await pp.evaluate(async () => {
    const ref = Datos.ciudadReferencia().codigoDivipola;
    const elegidos = [];
    for (const cat of ['Materiales', 'Ferretería', 'Equipos']) {
      const ins = Datos.insumosActivos().find((i) => i.origen === 'semilla' && i.investigable !== false && i.categoriaArken === cat && !Datos.equivalencia(i.id) && elegidos.indexOf(i) < 0);
      if (ins) elegidos.push(ins);
    }
    const capturas = elegidos.map((ins, k) => ({
      insumoId: ins.id, ciudad: ref, fechaCaptura: hoyISO(), precioPublicado: 1000 * (k + 1) + 0.5, unidadPublicada: ins.unidad, presentacion: null,
      incluyeIva: true, tipoPrecio: 'lista', esDesde: false, fuenteId: 'manual', proveedor: 'Prueba automática', url: '',
      textoLiteral: 'PRUEBA AUTOMÁTICA ' + ins.descripcion + ' $ ' + (1000 * (k + 1) + 0.5) + ' IVA incluido', metodo: 'manual', evidencia: 'Prueba de ida y vuelta',
    }));
    const r = await Registro.registrar(capturas, { origen: 'precio a mano' });
    await Motor.ejecutar({ tipo: 'insumos', descripcion: 'Prueba de ida y vuelta', insumoIds: elegidos.map((i) => i.id), ciudades: [ref] }, {});
    return { registradas: r.nuevas.length, insumos: elegidos.map((i) => ({ descripcion: i.descripcion, unidad: i.unidad, categoria: i.categoriaArken })) };
  });
  m.ok(nuevos.registradas === 3, `tres precios a mano para insumos nuevos (${nuevos.insumos.map((i) => i.descripcion).join(' · ')})`);

  const ida = await excelParaArken(pp, carpeta, 'ida.xlsx', { incluirDemo: true, incluirReferencia: true });
  const v = ida.validacion;
  m.ok(v.ok && v.boton, `el validador aprueba el archivo (${v.leidas} renglones, ${v.coinciden} «Ya existe», ${v.nuevas} nuevos)`);
  if (!v.ok) m.nota('Errores: ' + (v.errores || []).slice(0, 5).join(' | '));
  Object.entries(v.motivos).forEach(([motivo, n]) => m.nota(`No van (${n}): ${motivo}`));
  m.ok(v.categoriasInvalidas === 0 && v.preciosInvalidos === 0 && v.duplicadas === 0 && v.cambiarian === 0,
    'validador: 0 categorías inválidas, 0 precios en cero, 0 repetidas, 0 cambios de unidad o categoría');
  m.ok(/^ARKEN_PRECIOS_.*_DEMO\.xlsx$/.test(ida.sugerido || ''), `nombre del archivo rotulado DEMO (${ida.sugerido})`);

  /* ── 2. El archivo, leído con SheetJS ── */
  const leido = leerComoArken(ida.ruta);
  m.ok(leido.hojas[0] === 'Insumos', `la primera hoja es «Insumos» (${leido.hojas.join(', ')})`);
  m.ok(leido.encabezado[0] === 'Categoría' && leido.encabezado[1] === 'Unidad' && leido.encabezado[2] === 'Descripción del insumo' && /^Precio unitario/.test(leido.encabezado[3]),
    `encabezado en el orden de ARKEN (${leido.encabezado.slice(0, 4).join(' · ')})`);
  m.ok(leido.filas.length === v.leidas, `${leido.filas.length} renglones, los mismos que contó el validador`);
  m.ok(leido.filas.every((r) => CATEGORIAS.includes(r[0])), 'todas las categorías son de las siete de ARKEN');
  m.ok(leido.filas.every((r) => typeof r[3] === 'number' && r[3] > 0), 'todos los precios son números mayores que cero');
  m.ok(new Set(leido.filas.map((r) => normaliza(r[2]))).size === leido.filas.length, 'ninguna descripción repetida');
  const deSemilla = leido.filas.filter((r) => semilla.has(normaliza(r[2])));
  const malos = deSemilla.filter((r) => { const s = semilla.get(normaliza(r[2])); return s.unidad !== r[1] || s.categoria !== r[0] || s.descripcion !== r[2]; });
  m.ok(deSemilla.length >= 330 && malos.length === 0, `${deSemilla.length} de la semilla con la descripción, unidad y categoría exactas de ARKEN` + (malos.length ? ` (difieren: ${malos.slice(0, 3).map((r) => r[2]).join(' · ')})` : ''));
  const nuevosEnArchivo = leido.filas.filter((r) => !semilla.has(normaliza(r[2])));
  m.ok(nuevosEnArchivo.length === 3 && nuevos.insumos.every((i) => nuevosEnArchivo.some((r) => r[2] === i.descripcion && r[0] === i.categoria)), 'los tres insumos nuevos van con su categoría');
  const conCambio = deSemilla.filter((r) => Math.abs(r[3] - semilla.get(normaliza(r[2])).precio) > 0.0005);
  m.ok(conCambio.length > 0, `${conCambio.length} precios de la semilla cambian (demostración)`);

  /* ── 3. ARKEN CONTROL ── */
  const ctxA = await contexto(nav);
  const pa = await ctxA.newPage();
  const erroresA = vigilarErrores(pa);
  await abrirArken(pa, srv.url(RUTA_ARKEN));
  await ingresarArken(pa, 'admin', 'arken', 'prueba123');
  await pa.click('#btnNuevoProy');
  await pa.fill('#f_nombre', 'Prueba de ARKEN PRECIOS');
  await pa.selectOption('#f_semilla', 'blanco');
  await pa.click('.overlay:last-child .modal-foot .btn.primary');
  await pa.waitForFunction(() => { const p = S.proyectos.find((x) => x.id === Sesion.proyectoActivo); return p && p.nombre === 'Prueba de ARKEN PRECIOS'; }, null, { timeout: 15000 });
  const insumosActivos = () => pa.evaluate(() => S.proyectos.find((x) => x.id === Sesion.proyectoActivo).insumos
    .map((i) => ({ id: i.id, codigo: i.codigo, nombre: i.nombre, unidad: i.unidad, categoria: i.categoria, precio: i.precio })));
  const antes = await insumosActivos();
  m.ok(antes.length === 336, `ARKEN CONTROL: proyecto nuevo «En blanco» con los ${antes.length} insumos de la semilla`);

  await pa.click('#railList .nav-item[data-m="04"]');
  await pa.waitForSelector('#b4Exp', { timeout: 15000 });
  await pa.selectOption('#b4Exp', 'xlsIn');
  const [selector] = await Promise.all([pa.waitForEvent('filechooser'), pa.click('text=Seleccionar archivo…')]);
  await selector.setFiles(ida.ruta);
  await pa.waitForSelector('#riCuerpo tr', { timeout: 15000 });
  const revision = await pa.evaluate(() => {
    const filas = Array.from(document.querySelectorAll('#riCuerpo tr')).map((tr) => ({ nombre: tr.cells[0].textContent, existe: !!tr.querySelector('.tag.warn') }));
    const stats = Array.from(document.querySelectorAll('.overlay:last-child .stat .val')).map((x) => Number(x.textContent));
    return { filas, stats };
  });
  const [leidas, nuevasA, coincidenA] = revision.stats;
  m.ok(leidas === leido.filas.length, `ARKEN lee ${leidas} filas`);
  m.ok(coincidenA === deSemilla.length && nuevasA === 3, `«Ya existe»: ${coincidenA} (todos los de la semilla) · nuevos: ${nuevasA}`);
  const semillaSinYaExiste = revision.filas.filter((f) => semilla.has(normaliza(f.nombre)) && !f.existe);
  m.ok(semillaSinYaExiste.length === 0, 'cada insumo de la semilla del archivo aparece como «Ya existe»');

  await pa.click('#riSobreTodos');
  await pa.click('.overlay:last-child .modal-foot .btn.primary');     // Importar
  await pa.click('text=Sí, importar con estos precios');
  await pa.waitForFunction((n) => S.proyectos.find((x) => x.id === Sesion.proyectoActivo).insumos.length === n, antes.length + 3, { timeout: 15000 }).catch(() => {});
  const despues = await insumosActivos();
  m.ok(despues.length === antes.length + 3, `después de importar: ${despues.length} insumos (336 + 3 nuevos)`);
  const porId = new Map(despues.map((i) => [i.id, i]));
  const precioArchivo = new Map(leido.filas.map((r) => [normaliza(r[2]), r[3]]));
  let soloPrecio = true, preciosBien = true, cambiados = 0;
  for (const a of antes) {
    const d = porId.get(a.id);
    if (!d || d.codigo !== a.codigo || d.nombre !== a.nombre || d.unidad !== a.unidad || d.categoria !== a.categoria) soloPrecio = false;
    const p = precioArchivo.get(normaliza(a.nombre));
    if (p !== undefined) {
      if (!d || Math.abs(d.precio - p) > 0.0005) preciosBien = false;
      if (Math.abs(p - a.precio) > 0.0005) cambiados++;
    } else if (d && d.precio !== a.precio) preciosBien = false;
  }
  m.ok(soloPrecio, 'al sobrescribir no cambia el código, la descripción, la unidad ni la categoría de ningún insumo');
  m.ok(preciosBien && cambiados === conCambio.length, `el precio queda igual al del archivo (${cambiados} cambiaron; los que no venían, intactos)`);
  const creados = despues.filter((d) => !antes.some((a) => a.id === d.id));
  m.ok(creados.length === 3 && creados.every((c) => nuevosEnArchivo.some((r) => r[2] === c.nombre && r[1] === c.unidad && r[0] === c.categoria && Math.abs(r[3] - c.precio) < 0.0005)),
    'los tres nuevos se crean con la categoría, la unidad y el precio del archivo');

  /* ── 4. Vuelta: lista maestra de ARKEN → ARKEN PRECIOS ── */
  await pa.selectOption('#b4Exp', 'excel');
  const descargaLista = await pa.waitForEvent('download', { timeout: 30000 });
  const rutaLista = join(carpeta, 'lista-maestra.xlsx');
  await descargaLista.saveAs(rutaLista);
  m.ok(/ARKEN_lista_maestra/.test(descargaLista.suggestedFilename()), `ARKEN exporta la lista maestra (${descargaLista.suggestedFilename()})`);

  await pp.evaluate(() => { Sesion.tabs['09'] = 'lista'; });
  await irA(pp, '09');
  await pp.waitForSelector('#lmImp', { timeout: 15000 });
  const [selector2] = await Promise.all([pp.waitForEvent('filechooser'), pp.click('#lmImp')]);
  await selector2.setFiles(rutaLista);
  await pp.waitForSelector('#lmFilas tr', { timeout: 60000 });
  const cuenta = await pp.textContent('#lmCuenta');
  m.ok(/^339 a confirmar/.test(cuenta), `ARKEN PRECIOS empareja la lista maestra: ${cuenta}`);
  await pp.click('.overlay:last-child .modal-foot .btn.primary');      // Guardar
  await pp.waitForFunction(() => Datos.lista('listasArken').length === 1, null, { timeout: 15000 });

  const vuelta = await excelParaArken(pp, carpeta, 'vuelta.xlsx', { incluirDemo: true, incluirReferencia: true });
  const v2 = vuelta.validacion;
  m.ok(v2.ok && v2.nuevas === 0 && v2.coinciden === v2.leidas, `con la lista maestra, los ${v2.leidas} renglones salen «Ya existe» (nuevos: ${v2.nuevas})`);

  m.ok(erroresP.length === 0, 'ARKEN PRECIOS sin errores de JavaScript' + (erroresP.length ? ': ' + erroresP.join(' | ') : ''));
  m.ok(erroresA.length === 0, 'ARKEN CONTROL sin errores de JavaScript' + (erroresA.length ? ': ' + erroresA.join(' | ') : ''));
  const registro = await pp.evaluate(() => RegistroTecnico.entradas().map((e) => e.contexto + ': ' + e.mensaje));
  m.ok(registro.length === 0, 'registro técnico vacío' + (registro.length ? ': ' + registro.join(' | ') : ''));
} catch (e) {
  m.ok(false, 'la prueba se detuvo: ' + (e.stack || e.message || e));
} finally {
  await nav.close();
  await srv.cerrar();
}
console.log(`\n${m.pruebas - m.fallas} de ${m.pruebas} comprobaciones bien.`);
process.exit(m.fallas ? 1 : 0);
