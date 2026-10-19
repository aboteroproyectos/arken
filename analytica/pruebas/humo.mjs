// ARKEN ANALYTICA · prueba de humo de la interfaz en Chromium (§25), de punta a punta de la Fase 1.
//
//   · ingreso con cambio obligatorio de contraseña; recorrido de todos los módulos y pestañas
//   · demostración rotulada en cada pantalla y en cada PDF, y borrada con un botón sin tocar lo real
//   · PDF del presupuesto en sus cuatro niveles: carta, encabezado de ARKEN y «Página x de y»
//   · base de precios desde un Excel de ARKEN PRECIOS y paso de sus precios al presupuesto
//   · condiciones: un puntaje que descuadra los 1.000 puntos se avisa y bloquea la emisión
//   · documentos con huella SHA-256 (la misma de Node), repetidos detectados, versiones y enlace verificado
//   · invitados: el NIT con DV errado se rechaza; un nombre con HTML se pinta escapado
//   · no se puede emitir sin el acuerdo aprobado por abogado ni sin el respaldo de llaves (criterio 12)
//   · el rol Jurídico aprueba; llaves, respaldo, cronograma, pliego (sin precios) y emisión
//   · respaldo .zip sin llaves privadas en claro, y restauración desde la pantalla de ingreso
//   · temas claro y oscuro, tres densidades y 360 px sin desplazamiento lateral (criterio 13)
//   · ninguna petición a internet
//
// Uso: npm run prueba:humo

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  RUTA_ANALYTICA, RAIZ, servidor, navegador, contexto, vigilarErrores, abrirAnalytica, ingresar, irA, pestana, botonModal, cerrarModales, marcador, XLSX,
} from './comun.mjs';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const [avisar, anotar] = [console.warn, console.log];
console.warn = console.log = () => {};          // pdf.js avisa que en Node no hay canvas: aquí solo se lee texto
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
[console.warn, console.log] = [avisar, anotar];
const FUENTES = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts') + '/';

const m = marcador('Prueba de humo de ARKEN ANALYTICA');
const carpeta = mkdtempSync(join(tmpdir(), 'arken-analytica-humo-'));
const srv = await servidor();
const nav = await navegador();
const MODULOS = ['00', '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17'];
const PESTANAS = { '02': ['actividades', 'apu', 'insumos', 'aiu'], '06': ['invitados', 'acuerdo'], '07': ['revision', 'cronograma', 'pliego', 'llaves'] };
const CLAVE = 'prueba-humo-2026';
const sha = (b) => createHash('sha256').update(b).digest('hex');

async function leerPDF(ruta) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(ruta)), isEvalSupported: false, standardFontDataUrl: FUENTES, verbosity: 0 }).promise;
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const t = await p.getTextContent();
    paginas.push({ ancho: Math.round(p.view[2]), alto: Math.round(p.view[3]), texto: t.items.map((x) => x.str).join(' ') });
  }
  return paginas;
}
const esCarta = (ps) => ps.every((p) => (p.ancho === 612 && p.alto === 792) || (p.ancho === 792 && p.alto === 612));
const numerado = (ps, portada = 0) => ps.slice(portada).every((p, i) => p.texto.includes(`Página ${i + 1 + portada} de ${ps.length}`));
async function descargar(pagina, accion, nombre) {
  const [d] = await Promise.all([pagina.waitForEvent('download', { timeout: 60000 }), accion()]);
  const ruta = join(carpeta, nombre || d.suggestedFilename());
  await d.saveAs(ruta);
  return { ruta, nombre: d.suggestedFilename() };
}
async function conArchivos(pagina, accion, rutas) {
  const [fc] = await Promise.all([pagina.waitForEvent('filechooser'), accion()]);
  await fc.setFiles(rutas);
}
const accion = (pagina, nombre, extra = '') => pagina.click(`#stage [data-accion="${nombre}"]${extra}`);
const toast = async (pagina) => { await pagina.waitForSelector('#toasts .toast'); return pagina.evaluate(() => Array.from(document.querySelectorAll('#toasts .toast')).map((t) => t.textContent).join(' | ')); };
const limpiarToasts = (pagina) => pagina.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
const sinDesborde = (pagina) => pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
const revision = (pagina) => pagina.evaluate(() => Modelo.revision(Modelo.activo()).filter((x) => !x.ok).map((x) => x.texto));

try {
  const ctx = await contexto(nav);
  const pg = await ctx.newPage();
  const errores = vigilarErrores(pg);

  m.seccion('Ingreso y recorrido');
  await abrirAnalytica(pg, srv.url(RUTA_ANALYTICA));
  m.ok(await pg.isVisible('#gate') && /Analytica · Evaluación de propuestas/i.test(await pg.textContent('#gate .sb')), 'Pantalla de ingreso de ARKEN, con «Analytica · Evaluación de propuestas»');
  await pg.fill('#gUser', 'admin'); await pg.fill('#gPass', 'equivocada'); await pg.click('#gBtn');
  await pg.waitForFunction(() => /incorrectos/.test(document.getElementById('gateErr').textContent));
  m.ok(true, 'Una contraseña equivocada no entra');
  await ingresar(pg, 'admin', 'arken', CLAVE);
  m.ok(await pg.evaluate(() => !Sesion.usuario.debeCambiar), 'El primer ingreso obliga a cambiar la contraseña');
  m.seccion('Proceso real y demostración');
  await irA(pg, '01');
  await accion(pg, 'nuevo-proceso');
  await pg.fill('#pd_codigo', 'LIC-2026-REAL'); await pg.fill('#pd_nombre', 'Proceso real que no se borra');
  await botonModal(pg, 'Crear proceso');
  await pg.waitForFunction(() => Modelo.activo() && Modelo.activo().codigo === 'LIC-2026-REAL');
  m.ok(await pg.evaluate(() => Modelo.requisitos(Modelo.activo().id).length > 40), 'Un proceso nuevo trae la plantilla de condiciones del Anexo B');
  await irA(pg, '01');
  await accion(pg, 'cargar-demo');
  await pg.waitForFunction(() => Modelo.activo() && Modelo.activo().demo);
  let sinRotulo = [];
  for (const mod of MODULOS.slice(0, 8)) {
    await irA(pg, mod);
    const rot = await pg.evaluate(() => !document.getElementById('cintaDemo').classList.contains('hide') && /DEMOSTRACIÓN/.test(document.getElementById('tbProceso').textContent));
    if (!rot) sinRotulo.push(mod);
  }
  m.ok(sinRotulo.length === 0, 'La demostración va rotulada en cada pantalla (cinta y barra superior)' + (sinRotulo.length ? ': falta en ' + sinRotulo.join(', ') : ''));
  for (const mod of MODULOS) {
    await irA(pg, mod);
    for (const t of PESTANAS[mod] || []) await pestana(pg, t);
  }
  for (const [boton, tabs] of [['#btnAdmin', ['usuarios', 'auditoria', 'respaldos', 'llaves', 'registro', 'demo']], ['#btnConfig', ['empresa', 'apariencia', 'parametros', 'programa']]]) {
    await pg.click(boton);
    for (const t of tabs) await pestana(pg, t);
  }
  m.ok(errores.length === 0, `18 módulos, administración y configuración sin un solo error${errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''}`);
  const fase = await pg.evaluate(() => Array.from(document.querySelectorAll('#railList .nav-item.off')).map((b) => b.dataset.m + ' ' + b.title));
  m.ok(fase.filter((x) => /Fase 4/.test(x)).length === 2 && !fase.some((x) => /^1[1-4] .*Fase/.test(x)), 'Los módulos 15 y 16 se ven atenuados con la fase en que llegan; del 11 al 14 ya funcionan');

  const ledger = await pg.textContent('#ledger');
  m.ok(/969,008,207/.test(ledger) && /5 \/ 0/.test(ledger), 'Cinta de totales: presupuesto base $ 969,008,207 e invitados 5 / 0');

  m.seccion('PDF del presupuesto');
  await irA(pg, '02'); await pestana(pg, 'actividades');
  for (const nivel of ['capitulos', 'subcapitulos', 'actividades', 'apu']) {
    await pg.selectOption('#nivelPdf', nivel);
    const d = await descargar(pg, () => accion(pg, 'pdf-presupuesto'), 'presupuesto_' + nivel + '.pdf');
    const ps = await leerPDF(d.ruta);
    m.ok(esCarta(ps) && numerado(ps) && ps[0].texto.includes('ARKEN ANALYTICA') && ps[0].texto.includes('EVALUACIÓN DE PROPUESTAS') && ps.every((p) => p.texto.includes('DEMOSTRACIÓN')),
      `${d.nombre}: ${ps.length} página(s) carta, encabezado de ARKEN, «Página x de y» y rótulo DEMOSTRACIÓN`);
  }
  const pdfPres = join(carpeta, 'presupuesto_capitulos.pdf');

  m.seccion('Base de precios desde ARKEN PRECIOS');
  const lista = await pg.evaluate(() => Modelo.presupuesto(Modelo.activo().id).insumos.slice(0, 3).map((i) => ({ categoria: i.categoria, unidad: i.unidad, nombre: i.nombre, precio: i.precio })));
  const ws = XLSX.utils.aoa_to_sheet([['ARKEN PRECIOS · Lista para ARKEN CONTROL'], [], ['Categoría', 'Unidad', 'Descripción del insumo', 'Precio unitario (con IVA incluido)']]
    .concat(lista.map((i, k) => [i.categoria, i.unidad, i.nombre, k === 0 ? i.precio * 1.1 : i.precio])).concat([['Materiales', 'UN', 'Insumo nuevo de la prueba', 1234.567]]));
  const wbP = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wbP, ws, 'Insumos');
  const rutaPrecios = join(carpeta, 'ARKEN_PRECIOS_prueba.xlsx');
  XLSX.writeFile(wbP, rutaPrecios);
  await irA(pg, '03');
  await conArchivos(pg, () => accion(pg, 'importar-precios'), rutaPrecios);
  await botonModal(pg, 'Aplicar lo marcado');
  await pg.waitForFunction(() => (S.basePrecios || []).length === 4);
  m.ok(true, 'El Excel de ARKEN PRECIOS entra a la base: 4 insumos con su fuente y fecha');
  await irA(pg, '02'); await pestana(pg, 'insumos');
  const cdAntes = await pg.evaluate(() => Calculo.totales(Modelo.presupuesto(Modelo.activo().id)).costoDirecto);
  await accion(pg, 'actualizar-desde-base');
  const previa = await pg.textContent('#modales .overlay:last-child .modal-body');
  await botonModal(pg, 'Actualizar 1 precio(s)');
  await pg.waitForFunction((a) => Calculo.totales(Modelo.presupuesto(Modelo.activo().id)).costoDirecto > a, cdAntes);
  m.ok(/Antes/.test(previa) && /Después/.test(previa), 'Los precios nuevos pasan al presupuesto después de una vista previa con antes y después');

  m.seccion('Condiciones de la oferta');
  await irA(pg, '04');
  const idPond = await pg.evaluate(() => Modelo.requisitos(Modelo.activo().id).find((x) => x.activo !== false && Number(x.puntajeMaximo) > 0).id);
  await accion(pg, 'activar-req', `[data-id="${idPond}"]`);
  await pg.waitForSelector('#stage .nota.bad');
  const req = await pg.evaluate(() => Modelo.requisitos(Modelo.activo().id).find((x) => x.activo === false));
  m.ok(!!req && (await revision(pg)).some((t) => /puntajes suman/.test(t)), `Desactivar ${req && req.codigo} descuadra los 1.000 puntos: se avisa en el módulo 04 y la revisión lo bloquea`);
  await pg.click(`#stage [data-accion="activar-req"][data-id="${req.id}"]`);
  await pg.waitForSelector('#stage .nota.ok');
  m.ok(true, 'Al activarlo otra vez, las condiciones quedan completas');

  m.seccion('Documentos del proceso');
  await irA(pg, '05');
  const logo = join(RAIZ, 'recursos/logo-original.png');
  await conArchivos(pg, () => accion(pg, 'subir-docs'), [pdfPres, logo]);
  await pg.waitForFunction(() => Modelo.documentos(Modelo.activo().id).length === 2);
  const hashes = await pg.evaluate(() => Modelo.documentos(Modelo.activo().id).map((d) => [d.nombre, d.sha256, d.clase]));
  const esperado = new Map([['presupuesto_capitulos.pdf', sha(readFileSync(pdfPres))], ['logo-original.png', sha(readFileSync(logo))]]);
  m.ok(hashes.every(([n, h]) => esperado.get(n) === h), 'La huella SHA-256 de cada archivo es la misma que calcula Node');
  await conArchivos(pg, () => accion(pg, 'subir-docs'), [logo]);
  await pg.waitForSelector('#modales .overlay .modal-head h3:has-text("Archivo repetido")');
  await botonModal(pg, 'Cancelar');
  m.ok(await pg.evaluate(() => Modelo.documentos(Modelo.activo().id).length === 2), 'Un archivo repetido se detecta antes de agregarlo');
  const idLogo = await pg.evaluate(() => Modelo.documentos(Modelo.activo().id).find((d) => d.nombre === 'logo-original.png').id);
  const otroPng = join(carpeta, 'logo-v2.png'); writeFileSync(otroPng, Buffer.concat([readFileSync(logo), Buffer.from('v2')]));
  await conArchivos(pg, () => accion(pg, 'version-doc', `[data-id="${idLogo}"]`), [otroPng]);
  await pg.waitForFunction(() => Modelo.documentos(Modelo.activo().id, true).length === 3);
  const versiones = await pg.evaluate(() => Modelo.documentos(Modelo.activo().id, true).filter((d) => d.nombre === 'logo-original.png').map((d) => [d.version, d.vigente]));
  m.ok(JSON.stringify(versiones.sort()) === JSON.stringify([[1, false], [2, true]]), 'Una versión nueva reemplaza a la anterior sin borrarla (v1 reemplazada, v2 vigente)');
  await accion(pg, 'doc-enlace');
  await pg.fill('#pd_nombre', 'Modelo_estructural.rvt'); await pg.fill('#pd_enlace', 'https://nube.ejemplo.invalid/modelo.rvt');
  await botonModal(pg, 'Guardar');
  await pg.waitForFunction(() => Modelo.documentos(Modelo.activo().id).some((d) => d.enlace));
  m.ok((await revision(pg)).some((t) => /enlace están verificados/.test(t)), 'Un documento por enlace sin verificar deja la revisión en rojo');
  const idEnlace = await pg.evaluate(() => Modelo.documentos(Modelo.activo().id).find((d) => d.enlace).id);
  await conArchivos(pg, () => accion(pg, 'verificar-enlace', `[data-id="${idEnlace}"]`), [otroPng]);
  await pg.waitForFunction(() => Modelo.documentos(Modelo.activo().id).find((d) => d.enlace).enlaceVerificado);
  await cerrarModales(pg);
  m.ok(await pg.evaluate((h) => Modelo.documentos(Modelo.activo().id).find((d) => d.enlace).sha256 === h, sha(readFileSync(otroPng))), 'Al verificar el enlace queda su huella, sin guardar el archivo');

  m.seccion('Invitados y escape de texto');
  await irA(pg, '06'); await pestana(pg, 'invitados');
  await accion(pg, 'nuevo-inv');
  await pg.fill('#pd_razonSocial', '<img src=x onerror="window.__xss=1"> Constructora de prueba');
  await pg.fill('#pd_nit', '890903938'); await pg.press('#pd_nit', 'Tab'); await pg.fill('#pd_dv', '7');
  await pg.fill('#pd_contactoNombre', 'Contacto de prueba'); await pg.fill('#pd_contactoCorreo', 'contacto@prueba.invalid');
  await limpiarToasts(pg);
  await botonModal(pg, 'Guardar');
  m.ok(/no corresponde al dígito de verificación/.test(await toast(pg)), 'Un NIT con el dígito de verificación errado se rechaza (890.903.938-7; el correcto es 8)');
  await pg.fill('#pd_dv', '8');
  await botonModal(pg, 'Guardar');
  await pg.waitForFunction(() => Modelo.invitados(Modelo.activo().id).length === 6 && /Constructora de prueba/.test(document.getElementById('stage').textContent));
  const xss = await pg.evaluate(() => ({ x: !!window.__xss, img: !!document.querySelector('#stage img[src="x"]'), visible: document.querySelector('#stage').textContent.includes('<img src=x') }));
  m.ok(!xss.x && !xss.img && xss.visible, 'Una razón social con HTML se pinta escapada y no ejecuta nada');

  m.seccion('No se puede emitir sin abogado ni respaldo de llaves (criterio 12)');
  await irA(pg, '07'); await pestana(pg, 'revision');
  let rojos = await revision(pg);
  m.ok(await pg.isDisabled('#stage [data-accion="emitir"]'), '«Emitir» está deshabilitado');
  m.ok(rojos.some((t) => /aprobado por abogado/.test(t)) && rojos.some((t) => /Respaldo de llaves/.test(t)), 'La revisión pide el acuerdo aprobado por abogado y el respaldo de llaves');
  let rechazo = '';
  try { await pg.evaluate(() => Modelo.emitir(Modelo.activo())); } catch (e) { rechazo = e.message; }
  m.ok(/No se puede emitir/.test(rechazo), 'Aun llamando a la lógica directamente, la emisión se rechaza');
  await irA(pg, '06'); await pestana(pg, 'acuerdo');
  m.ok(!(await pg.locator('#stage [data-accion="aprobar-acuerdo"]').count()), 'El administrador no ve «Aprobado por abogado»: es del rol Jurídico');
  const d0 = await descargar(pg, () => accion(pg, 'pdf-acuerdo'));
  const pa0 = await leerPDF(d0.ruta);
  m.ok(pa0.some((p) => /BORRADOR/.test(p.texto)) && numerado(pa0), `El PDF del acuerdo sin aprobar va marcado BORRADOR (${pa0.length} páginas)`);
  m.ok(!pa0.some((p) => /19,380,164|DIECINUEVE MILLONES/.test(p.texto)), 'Con el presupuesto oculto, la cláusula penal no revela el total en pesos');

  m.seccion('El rol Jurídico aprueba el acuerdo');
  await pg.click('#btnAdmin'); await pestana(pg, 'usuarios');
  await accion(pg, 'nuevo-usuario');
  await pg.fill('#pd_usuario', 'abogada'); await pg.fill('#pd_nombre', 'Abogada de prueba');
  await pg.check('#pd_rol_juridico'); await pg.fill('#pd_clave', 'temporal-2026');
  await botonModal(pg, 'Guardar');
  await pg.waitForFunction(() => S.usuarios.some((u) => u.usuario === 'abogada'));
  await pg.click('#btnSalir');
  await pg.waitForSelector('#gate', { state: 'visible' });
  await ingresar(pg, 'abogada', 'temporal-2026', 'abogada-nueva-2026');
  await irA(pg, '06'); await pestana(pg, 'acuerdo');
  await accion(pg, 'aprobar-acuerdo');
  await pg.fill('#pd_tarjetaProfesional', '000000 del C. S. de la J.');
  await botonModal(pg, 'Registrar aprobación');
  await pg.waitForFunction(() => Modelo.estadoConfidencialidad(Modelo.activo()) === 'aprobado');
  m.ok(await pg.isVisible('#stage .nota.ok'), 'Aprobado por abogado, con nombre, tarjeta profesional, fecha y huella del texto');
  const huella = await pg.evaluate(() => Modelo.activo().confidencialidad.aprobacion.huella);
  m.ok(/^[0-9a-f]{64}$/.test(huella), 'La aprobación guarda la huella SHA-256 del texto aprobado');
  await pg.click('#btnSalir');
  await ingresar(pg, 'admin', CLAVE);

  m.seccion('Llaves, cronograma, pliego y emisión');
  await irA(pg, '07'); await pestana(pg, 'llaves');
  await pg.fill('#ll_frase', 'corta'); await pg.fill('#ll_frase2', 'corta');
  await limpiarToasts(pg);
  await accion(pg, 'crear-llaves');
  m.ok(/16 caracteres/.test(await toast(pg)), 'Una frase corta se rechaza');
  await pg.fill('#ll_frase', 'el comité abre las ofertas'); await pg.fill('#ll_frase2', 'el comité abre las ofertas');
  await accion(pg, 'crear-llaves');
  await pg.waitForSelector('#stage [data-accion="bajar-llaves"]', { timeout: 60000 });
  m.ok((await revision(pg)).some((t) => /Respaldo de llaves/.test(t)), 'Con las llaves creadas, sin respaldo, sigue sin poderse emitir');
  const rl = await descargar(pg, () => accion(pg, 'bajar-llaves'));
  const respaldoLlaves = readFileSync(rl.ruta, 'utf8');
  m.ok(/ARKEN-LLAVES/.test(respaldoLlaves) && !/"d":/.test(respaldoLlaves) && /Si se pierden la llave y su respaldo/.test(respaldoLlaves), `${rl.nombre}: privadas cifradas, ninguna en claro, con la advertencia`);
  await accion(pg, 'confirmar-llaves');
  await botonModal(pg, 'Lo guardé fuera de este computador');
  await pg.waitForFunction(() => Modelo.llaves(Modelo.activo().id).respaldo.confirmado);
  await pestana(pg, 'cronograma');
  m.ok(await pg.isVisible('#stage .nota.ok'), 'Cronograma de la demostración completo y en orden');
  await pestana(pg, 'pliego');
  const pl = await descargar(pg, () => accion(pg, 'generar-pliego'));
  const pps = await leerPDF(pl.ruta);
  const textoPliego = pps.map((p) => p.texto).join(' ');
  const precios = await pg.evaluate(() => { const p = Modelo.presupuesto(Modelo.activo().id); const t = Calculo.totales(p);
    return p.insumos.map((i) => Util.money3(i.precio)).concat([t.total, t.costoDirecto].map(Util.money)).map((s) => s.replace(/\s/g, ' ')); });
  const fugas = precios.filter((s) => textoPliego.replace(/\s/g, ' ').includes(s));
  m.ok(esCarta(pps) && numerado(pps, 1) && /Formulario de cantidades/i.test(textoPliego) && !/"e /.test(textoPliego), `${pl.nombre}: ${pps.length} páginas carta, portada, índice, numeración, formulario de cantidades y sin caracteres rotos`);
  m.ok(fugas.length === 0, 'El pliego en PDF no trae ningún precio, unitario ni total del presupuesto base (criterio 2)' + (fugas.length ? ': ' + fugas.slice(0, 3).join(', ') : ''));
  m.ok(await pg.evaluate((h) => Modelo.activo().pliego.generado.sha256 === h, sha(readFileSync(pl.ruta))), 'La huella registrada es la del PDF descargado');
  await pg.check('#stage [data-accion="marcar-revisado"]');
  await pg.waitForFunction(() => Modelo.activo().pliego.revisado);
  await pestana(pg, 'revision');
  rojos = await revision(pg);
  m.ok(rojos.length === 0, 'Con todo listo, la revisión queda en verde' + (rojos.length ? ': falta ' + rojos.join(' | ') : ''));
  await accion(pg, 'emitir');
  await pg.fill('#cfPalabra', 'EMITIR');
  await botonModal(pg, 'Emitir');
  await pg.waitForFunction(() => Modelo.activo().estado === 'emitido');
  await irA(pg, '02'); await pestana(pg, 'actividades');
  m.ok(await pg.isVisible('#stage .congelado') && !(await pg.locator('#stage [data-accion="nuevo-cap"]').count()), 'Emitido: el presupuesto queda congelado y sin botones de edición');
  let congelado = '';
  try { await pg.evaluate(() => Modelo.guardarPresupuesto(Modelo.presupuesto(Modelo.activo().id), 'intento')); } catch (e) { congelado = e.message; }
  m.ok(/congelad/.test(congelado), 'La lógica tampoco deja editar lo emitido');

  m.seccion('Respaldo y restauración');
  await pg.click('#btnAdmin'); await pestana(pg, 'respaldos');
  const rz = await descargar(pg, () => accion(pg, 'descargar-respaldo'));
  const zip = await JSZip.loadAsync(readFileSync(rz.ruta));
  const man = JSON.parse(await zip.file('manifiesto.json').async('string'));
  const llavesZip = await zip.file('datos/llaves.json').async('string');
  m.ok(man.formato === 'ARKEN-ANALYTICA-RESPALDO' && man.archivos.length >= 3, `${rz.nombre}: manifiesto con ${Object.keys(man.almacenes).length} almacenes y ${man.archivos.length} archivos`);
  m.ok(!/"d":/.test(llavesZip) && /privadasCifradas/.test(llavesZip), 'El respaldo no trae llaves privadas en claro');
  let huellasBien = true;
  for (const a of man.archivos) if (sha(await zip.file('archivos/' + a.sha256).async('nodebuffer')) !== a.sha256) huellasBien = false;
  m.ok(huellasBien, 'Cada archivo del respaldo corresponde a su huella');
  const ctx2 = await contexto(nav);
  const pr = await ctx2.newPage();
  const errores2 = vigilarErrores(pr);
  await abrirAnalytica(pr, srv.url(RUTA_ANALYTICA));
  await pr.click('#gRestaurar');
  await pr.fill('#pd_usuario', 'admin'); await pr.fill('#pd_clave', 'arken');
  await conArchivos(pr, () => botonModal(pr, 'Continuar'), rz.ruta);
  await pr.waitForSelector('#cfPalabra', { timeout: 60000 });
  await pr.fill('#cfPalabra', 'REEMPLAZAR');
  await botonModal(pr, 'Reemplazar todos los datos');
  await pr.waitForFunction(() => /restaurado/.test(document.getElementById('gateErr').textContent), null, { timeout: 60000 });
  await ingresar(pr, 'admin', CLAVE);
  m.ok(await pr.evaluate(() => S.procesos.length === 2 && S.procesos.some((p) => p.estado === 'emitido')), 'En otro equipo, la restauración (con un administrador y escribiendo REEMPLAZAR) trae todo');

  m.seccion('Temas, densidades y 360 px');
  await pr.click('#btnConfig'); await pestana(pr, 'apariencia');
  let bienTemas = true;
  for (const [tema, densidad] of [['oscuro', 'compacta'], ['oscuro', 'amplia'], ['claro', 'normal']]) {
    await pr.selectOption('#ap_tema', tema); await pr.selectOption('#ap_densidad', densidad);
    await accion(pr, 'guardar-apariencia');
    await pr.waitForFunction(([t, d]) => document.documentElement.dataset.tema === t && document.documentElement.dataset.density === d, [tema, densidad]);
    const fondo = await pr.evaluate(() => getComputedStyle(document.querySelector('.topbar')).backgroundColor);
    if (tema === 'oscuro' && fondo !== 'rgb(14, 16, 18)') bienTemas = false;
  }
  m.ok(bienTemas, 'Tema oscuro (barra #0E1012) y claro, densidades compacta, amplia y normal');
  const p360 = await ctx2.newPage();
  await p360.setViewportSize({ width: 360, height: 740 });
  await abrirAnalytica(p360, srv.url(RUTA_ANALYTICA));
  m.ok(await sinDesborde(p360), 'Ingreso a 360 px sin desplazamiento lateral');
  await ingresar(p360, 'admin', CLAVE);
  const desbordan = [];
  for (const mod of MODULOS) {
    await p360.evaluate((x) => App.ir(x), mod);
    for (const t of PESTANAS[mod] || [null]) {
      if (t) await p360.evaluate((id) => { Sesion.pestanas[{ actividades: 'pres', apu: 'pres', insumos: 'pres', aiu: 'pres', invitados: 'inv', acuerdo: 'inv' }[id] || 'emi'] = id; App.render(); }, t);
      if (!(await sinDesborde(p360))) desbordan.push(mod + (t ? '/' + t : ''));
    }
  }
  m.ok(desbordan.length === 0, 'A 360 px ningún módulo se desplaza de lado (las tablas se desplazan por dentro)' + (desbordan.length ? ': ' + desbordan.join(', ') : ''));

  m.seccion('Borrar la demostración');
  await pg.click('#btnAdmin'); await pestana(pg, 'demo');
  await accion(pg, 'borrar-demo');
  await botonModal(pg, 'Borrar demostración');
  await pg.waitForFunction(() => !Modelo.hayDemo());
  m.ok(await pg.evaluate(() => S.procesos.length === 1 && S.procesos[0].codigo === 'LIC-2026-REAL' && !S.invitados.some((i) => i.demo) && !S.documentosProceso.length),
    'Se borran el proceso, los invitados, los documentos y la empresa de demostración; el proceso real queda');
  m.ok(await pg.evaluate(() => document.getElementById('cintaDemo').classList.contains('hide')), 'La cinta de DEMOSTRACIÓN desaparece');
  const auditoria = await pg.evaluate(() => Auditoria.lista().map((a) => a.accion));
  m.ok(['ingresar', 'crear', 'aprobar', 'emitir', 'exportar', 'borrar'].every((x) => auditoria.includes(x)), `Auditoría de todo: ${auditoria.length} registros (ingresar, crear, aprobar, emitir, exportar, borrar…)`);

  m.ok(errores.length === 0 && errores2.length === 0, 'Sin errores de JavaScript en toda la prueba' + (errores.concat(errores2).length ? ': ' + errores.concat(errores2).slice(0, 3).join(' | ') : ''));
  m.ok(ctx.peticionesExternas.length === 0 && ctx2.peticionesExternas.length === 0, 'Ninguna petición a internet: el programa funciona sin conexión');
} catch (e) {
  m.ok(false, 'la prueba se interrumpió: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' '));
} finally {
  await nav.close();
  await srv.cerrar();
}
m.terminar();
