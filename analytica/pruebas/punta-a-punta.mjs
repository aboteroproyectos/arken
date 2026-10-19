// ARKEN ANALYTICA · prueba de punta a punta de la Fase 2 (§25, §26), en Chromium.
//
//   · el principal prepara y emite un proceso de demostración y genera un paquete por invitado
//   · un invitado recorre el camino de la confidencialidad: paquete de solo acuerdo → sobre de
//     confidencialidad → acuerdo verificado → paquete completo
//   · cinco ARKEN OFERTA, cada una en su propio navegador: verifican el paquete, diligencian
//     precios y documentos, preguntan, importan respuestas y una adenda sin perder lo hecho, y
//     generan su sobre cerrado
//   · un paquete alterado dice qué archivo falló
//   · el principal recibe los cinco sobres a la vez (más un repetido, uno ajeno y uno reemplazado),
//     no abre nada antes del cierre, con el reloj después del cierre genera el acta de cierre y abre
//     con la frase y dos miembros del comité; los totales se recalculan y los documentos quedan
//     en la carpeta de cada proponente
//   · ningún paquete, adenda ni respuesta lleva precios del presupuesto base; ninguna petición a internet
//
// Uso: npm run prueba:punta-a-punta

import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import {
  RUTA_ANALYTICA, servidor, navegador, contexto, vigilarErrores, abrirAnalytica, ingresar, irA, pestana, botonModal, marcador, XLSX, prepararEmitido, llenar } from './comun.mjs';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');
const m = marcador('Prueba de punta a punta de ARKEN ANALYTICA (Fase 2)');
const carpeta = mkdtempSync(join(tmpdir(), 'arken-analytica-e2e-'));
const srv = await servidor();
const nav = await navegador();
const CLAVE = 'prueba-e2e-2026';
const FRASE = 'el comité abre las ofertas';
const sha = (b) => createHash('sha256').update(b).digest('hex');
const DEBUG = !!process.env.DEBUG;
const [avisar, anotar] = [console.warn, console.log];
console.warn = console.log = () => {};
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
[console.warn, console.log] = [avisar, anotar];
async function textoPdf(ruta) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(ruta)), isEvalSupported: false, verbosity: 0 }).promise;
  let t = '';
  for (let i = 1; i <= doc.numPages; i++) t += (await (await doc.getPage(i)).getTextContent()).items.map((x) => x.str).join(' ') + ' ';
  return t;
}
const dbg = (...a) => { if (DEBUG) console.log('    ·', ...a); };

async function descargar(pagina, accion, nombre) {
  const [d] = await Promise.all([pagina.waitForEvent('download', { timeout: 120000 }).catch(async (e) => {
    const estado = await pagina.evaluate(() => ({ toasts: Array.from(document.querySelectorAll('#toasts .toast')).map((t) => t.textContent),
      modales: Array.from(document.querySelectorAll('#modales .overlay')).map((o) => o.textContent.slice(0, 200)) })).catch(() => ({}));
    throw new Error('No llegó la descarga: ' + JSON.stringify(estado) + ' · ' + e.message.split('\n')[0]);
  }), accion()]);
  const ruta = join(carpeta, nombre || d.suggestedFilename());
  await d.saveAs(ruta);
  return { ruta, nombre: d.suggestedFilename() };
}
async function accion(pg, nombre, extra = '') { await pg.click(`#stage [data-accion="${nombre}"]${extra}`); }
async function conArchivos(pg, disparar, rutas) {
  const [fc] = await Promise.all([pg.waitForEvent('filechooser', { timeout: 30000 }), disparar()]);
  await fc.setFiles(rutas);
}
async function toastMalo(pg) {
  const t = await pg.locator('#toasts .toast.bad').allTextContents();
  return t.join(' | ');
}

/* ══ 1. El principal prepara y emite ══ */
const ctxP = await contexto(nav);
const pp = await ctxP.newPage();
const erroresP = vigilarErrores(pp);
await abrirAnalytica(pp, srv.url(RUTA_ANALYTICA));
await ingresar(pp, 'admin', 'arken', CLAVE);

m.seccion('El principal prepara y emite el proceso');
const prep = await prepararEmitido(pp, FRASE);
m.ok(prep.estado === 'emitido', 'Proceso de demostración emitido' + (prep.rojo.length ? ': falta ' + prep.rojo.join(' | ') : ''));
m.ok(prep.invitados.length === 5 && prep.envios === 'dos', 'Cinco invitados ficticios y el acuerdo en dos envíos');
// Para ir al grano, el acuerdo de cuatro invitados ya llegó firmado y verificado; el quinto recorre el camino completo.
await pp.evaluate(async (id) => {
  for (const i of Modelo.invitados(id).slice(1)) {
    const x = Util.copia(i); x.confidencialidad = Object.assign({}, x.confidencialidad, { estado: 'verificado', firmante: 'Representante DEMO', fecha: Util.hoyISO(), facultades: true });
    await Modelo.guardarInvitado(x, 'acuerdo verificado (prueba)');
  }
  App.render();
}, prep.id);

/* ══ 2. Paquetes ══ */
m.seccion('Un paquete por invitado');
await irA(pp, '07'); await pestana(pp, 'paquetes');
const paquetes = [];
for (const [k, inv] of prep.invitados.entries()) {
  const d = await descargar(pp, async () => {
    await accion(pp, 'generar-paq', `[data-id="${inv.id}"]`);
    if (k === 0) { await pp.waitForSelector('#pd_frase'); await pp.fill('#pd_frase', FRASE); await botonModal(pp, 'Abrir las llaves'); }
  });
  paquetes.push(d);
  dbg('paquete', d.nombre);
}
m.ok(/confidencialidad/i.test(paquetes[0].nombre) && paquetes.slice(1).every((d) => !/confidencialidad/i.test(d.nombre)), 'Sin acuerdo verificado, el paquete solo trae el acuerdo; con él, el paquete completo');
const contenidos = [];
for (const d of paquetes) {
  const z = await JSZip.loadAsync(readFileSync(d.ruta));
  const nombres = Object.keys(z.files);
  contenidos.push({ z, nombres });
}
m.ok(contenidos[0].nombres.every((n) => !/^Documentos_del_proceso\//.test(n) && !/Pliego.*\.pdf$/i.test(n)), 'El paquete de confidencialidad no trae el pliego ni los documentos');
m.ok(contenidos.slice(1).every((c) => c.nombres.some((n) => /^Documentos_del_proceso\//.test(n)) && c.nombres.includes('LEAME_PRIMERO.pdf') && c.nombres.includes('manifiesto.firma')),
  'Los paquetes completos traen ARKEN OFERTA, LEAME_PRIMERO, el pliego, los documentos y el manifiesto firmado');
// Ningún paquete lleva precios del presupuesto base (criterio 2).
let fugas = [];
for (const [k, c] of contenidos.entries()) {
  for (const n of c.nombres.filter((x) => /\.(html|json)$/.test(x))) {
    const t = await c.z.file(n).async('string');
    const pl = /<script id="arken-pliego" type="application\/json">([\s\S]*?)<\/script>/.exec(t);
    const texto = pl ? pl[1] : t;
    for (const s of prep.precios) if (s.length > 6 && texto.includes(s)) fugas.push(paquetes[k].nombre + ' › ' + n + ' › ' + s);
  }
}
m.ok(fugas.length === 0, 'Ningún paquete lleva un precio del presupuesto base' + (fugas.length ? ': ' + fugas.slice(0, 3).join(' | ') : ''));
const htmls = [];
for (const [k, c] of contenidos.entries()) {
  const n = c.nombres.find((x) => /^ARKEN_OFERTA.*\.html$/.test(x));
  const dir = join(carpeta, 'inv' + k); mkdirSync(dir, { recursive: true });
  const ruta = join(dir, n); writeFileSync(ruta, await c.z.file(n).async('nodebuffer'));
  htmls.push(ruta);
}
m.ok(htmls.length === 5, 'Cada paquete trae su ARKEN OFERTA con el pliego adentro');

/* ══ 3. ARKEN OFERTA ══ */
async function abrirOferta(k) {
  const ctx = await contexto(nav);
  const pg = await ctx.newPage();
  const errores = vigilarErrores(pg);
  await pg.goto('file://' + htmls[k]);
  await pg.waitForSelector('#gVerificar', { timeout: 60000 });
  return { ctx, pg, errores };
}
async function verificarYEntrar(o, rutaZip) {
  await conArchivos(o.pg, () => o.pg.click('#gVerificar'), rutaZip);
  await o.pg.waitForSelector('#gBtn', { timeout: 120000 });
  await o.pg.fill('#gUser', 'oferente');
  await o.pg.fill('#gPass', 'clave-oferta-2026');
  await o.pg.fill('#gPass2', 'clave-oferta-2026');
  await o.pg.click('#gBtn');
  await o.pg.waitForSelector('#stage .page-head', { timeout: 60000 });
}

m.seccion('Un paquete alterado dice qué archivo falló');
{
  const z = await JSZip.loadAsync(readFileSync(paquetes[1].ruta));
  const leame = await z.file('LEAME_PRIMERO.pdf').async('uint8array');
  leame[leame.length - 10] ^= 0x20;
  z.file('LEAME_PRIMERO.pdf', leame);
  const ruta = join(carpeta, 'alterado.zip');
  writeFileSync(ruta, await z.generateAsync({ type: 'nodebuffer' }));
  const o = await abrirOferta(1);
  await conArchivos(o.pg, () => o.pg.click('#gVerificar'), ruta);
  await o.pg.waitForSelector('#gateCuerpo .alert.bad', { timeout: 60000 });
  const t = await o.pg.textContent('#gateCuerpo .alert.bad');
  m.ok(/LEAME_PRIMERO\.pdf/.test(t) && /no es válido/.test(t), 'El paquete con un byte cambiado se rechaza y nombra LEAME_PRIMERO.pdf');
  await o.ctx.close();
}

m.seccion('El quinto invitado: primero el acuerdo de confidencialidad');
const o0 = await abrirOferta(0);
await verificarYEntrar(o0, paquetes[0].ruta);
const rail0 = await o0.pg.evaluate(() => Array.from(document.querySelectorAll('#railList [data-m]')).map((b) => b.dataset.m));
m.ok(rail0.join(',') === '00,01,02,14,15', 'En el primer envío ARKEN OFERTA solo muestra el proponente, el acuerdo, el sobre y la ayuda');
dbg('rail0', rail0);


/* Un PDF de prueba, con texto que se puede buscar. */
const { jsPDF } = require('jspdf');
function pdfPrueba(nombre, texto) {
  const d = new jsPDF(); d.text(texto, 20, 20); d.text('DEMOSTRACIÓN · documento ficticio', 20, 30);
  const ruta = join(carpeta, nombre); writeFileSync(ruta, Buffer.from(d.output('arraybuffer'))); return ruta;
}
async function generarSobre(o, nombre) {
  await o.pg.click('#railList [data-m="14"]');
  await o.pg.waitForSelector('#stage [data-accion="generar-sobre"]');
  const rojos = await o.pg.evaluate(() => Borrador.revision(Oferta.borrador(), Oferta.pl()).filter((x) => !x.ok).map((x) => x.texto + ' ' + x.detalle.slice(0, 3).join(', ')));
  if (rojos.length) dbg('rojo en 14:', rojos);
  const d = await descargar(o.pg, async () => { await o.pg.click('#stage [data-accion="generar-sobre"]'); await botonModal(o.pg, 'Generar sobre'); }, nombre);
  return d;
}
async function cargarSobres(rutas) {
  await irA(pp, '09');
  await conArchivos(pp, () => pp.click('#stage [data-accion="cargar-sobres"]'), rutas);
  await pp.waitForSelector('#modales .overlay', { timeout: 120000 });
  const filas = await pp.locator('#modales .overlay').last().locator('tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.cells).map((c) => c.textContent)));
  await botonModal(pp, 'Entendido');
  return filas;
}

{
  await o0.pg.click('#railList [data-m="01"]');
  await o0.pg.fill('#pr_representante', 'Representante DEMO Alfa');
  await o0.pg.fill('#pr_documentoRepresentante', '1000000001');
  await o0.pg.fill('#pr_domicilio', 'Medellín');
  await o0.pg.fill('#pr_correo', 'oferta@alfa.invalid');
  await o0.pg.click('#stage [data-accion="guardar-proponente"]');
  await o0.pg.click('#railList [data-m="02"]');
  await conArchivos(o0.pg, () => o0.pg.click('#stage [data-accion="adjuntar"][data-req="ACUERDO"]'), pdfPrueba('Acuerdo_firmado_Alfa.pdf', 'Acuerdo de confidencialidad firmado'));
  await o0.pg.waitForFunction(() => Oferta.borrador().adjuntos.some((a) => a.requisito === 'ACUERDO'));
  const sc = await generarSobre(o0, 'sobre_confidencialidad_alfa.zip');
  const zc = await JSZip.loadAsync(readFileSync(sc.ruta));
  m.ok(!!zc.file('confidencialidad.json') && !zc.file('oferta.cifrada'), 'ARKEN OFERTA genera el sobre de confidencialidad con el acuerdo firmado');
  const filas = await cargarSobres([sc.ruta]);
  dbg('recibido conf', filas);
  const conf = await pp.evaluate((id) => Modelo.invitados(Modelo.activo().id).find((i) => i.id === id).confidencialidad, prep.invitados[0].id);
  m.ok(conf.estado === 'firmado' && /^[0-9a-f]{64}$/.test(conf.sha256 || ''), 'El principal recibe el sobre de confidencialidad: acuerdo firmado, con su huella, pendiente de verificar facultades');
  await irA(pp, '06');
  await accion(pp, 'acuerdo-inv', `[data-id="${prep.invitados[0].id}"]`);
  await pp.check('#pd_facultades');
  await botonModal(pp, 'Guardar');
  await pp.waitForFunction((id) => Modelo.invitados(Modelo.activo().id).find((i) => i.id === id).confidencialidad.estado === 'verificado', prep.invitados[0].id);
  await irA(pp, '07'); await pestana(pp, 'paquetes');
  const d = await descargar(pp, () => accion(pp, 'generar-paq', `[data-id="${prep.invitados[0].id}"]`));
  m.ok(!/confidencialidad/i.test(d.nombre), 'Con las facultades verificadas, al mismo invitado le toca el paquete completo: ' + d.nombre);
  paquetes[0] = d;
  const z = await JSZip.loadAsync(readFileSync(d.ruta));
  const n = Object.keys(z.files).find((x) => /^ARKEN_OFERTA.*\.html$/.test(x));
  writeFileSync(htmls[0], await z.file(n).async('nodebuffer'));
  await o0.ctx.close();
}

m.seccion('Cinco ARKEN OFERTA diligencian su oferta');
const ofertas = [];
for (let k = 0; k < 5; k++) {
  const o = await abrirOferta(k);
  await verificarYEntrar(o, paquetes[k].ruta);
  ofertas.push(o);
}
m.ok(ofertas.length === 5, 'Los cinco paquetes completos se verifican y cada invitado crea su usuario local');
const rail = await ofertas[1].pg.evaluate(() => Array.from(document.querySelectorAll('#railList [data-m]')).map((b) => b.dataset.m).join(','));
m.ok(rail === '00,01,02,03,04,05,06,07,08,09,10,11,12,13,14,15', 'El paquete completo muestra los dieciséis módulos de ARKEN OFERTA');

// Invitado 2: los precios llegan por la plantilla de Excel, con APU.
{
  const o = ofertas[1];
  await o.pg.click('#railList [data-m="03"]');
  const pt = await descargar(o.pg, () => o.pg.click('#stage [data-accion="plantilla-precios"]'));
  const wb = XLSX.readFile(pt.ruta);
  const precios = XLSX.utils.sheet_to_json(wb.Sheets.Precios, { header: 1 });
  const apu = [XLSX.utils.sheet_to_json(wb.Sheets.APU, { header: 1 })[0]];
  precios.slice(1).forEach((f, i) => {
    apu.push([f[4], 'APU-' + f[4], 'APU de ' + f[5], f[6], 'Materiales de ' + f[5], f[6], 'Materiales', 20000 + 137 * i, 1]);
    apu.push([f[4], 'APU-' + f[4], 'APU de ' + f[5], f[6], 'Cuadrilla', 'día', 'Mano de Obra', 180000, 0.05]);
  });
  wb.Sheets.APU = XLSX.utils.aoa_to_sheet(apu);
  const ruta = join(carpeta, 'plantilla_llena.xlsx'); XLSX.writeFile(wb, ruta);
  await conArchivos(o.pg, () => o.pg.click('#stage [data-accion="importar-precios"]'), ruta);
  await o.pg.waitForSelector('#modales .overlay');
  const titulo = await o.pg.locator('#modales .overlay .modal-foot button.primary').textContent();
  await botonModal(o.pg, titulo.trim());
  const n = await o.pg.evaluate(() => Object.values(Oferta.borrador().acts).filter((x) => x.apus.some((a) => a.insumos.length === 2)).length);
  m.ok(n === precios.length - 1, `La plantilla de precios con APU se importa: ${n} actividades con su APU de dos insumos`);
  await o.pg.click('#railList [data-m="13"]');
  await o.pg.click('#stage [data-accion="preg-mas"]');
  await o.pg.fill('#stage textarea[data-cambio="preg"]', '¿La cantidad de la excavación incluye el retiro de sobrantes?');
  await o.pg.locator('#stage textarea[data-cambio="preg"]').dispatchEvent('change');
  await o.pg.waitForFunction(() => Oferta.borrador().preguntas[0].texto.length > 10);
  const pq = await descargar(o.pg, () => o.pg.click('#stage [data-accion="preg-archivo"]'));
  ofertas[1].preguntas = pq.ruta;
  m.ok(/PREGUNTAS/.test(pq.nombre), 'ARKEN OFERTA genera el archivo de preguntas: ' + pq.nombre);
}

/* El resto se diligencia con la lógica del programa: cada requisito con su respuesta y un PDF por documento. */
async function diligenciar(o, k) {
  return o.pg.evaluate(async (k) => {
    const b = Oferta.borrador(), pl = Oferta.pl();
    Object.assign(b.proponente, { representante: b.proponente.representante || 'Representante DEMO ' + k, documentoRepresentante: b.proponente.documentoRepresentante || '100000000' + k,
      domicilio: b.proponente.domicilio || 'Medellín', correo: b.proponente.correo || 'oferta' + k + '@demo.invalid' });
    const pdf = async (n) => { const d = new window.jspdf.jsPDF(); d.text('Documento ' + n, 20, 20); d.text('DEMOSTRACIÓN matrícula profesional ' + k, 20, 30);
      const f = new File([d.output('blob')], n, { type: 'application/pdf' }); const g = await Intercambio.guardarAdjunto(f); return { nombre: n, sha256: g.sha256, peso: g.peso }; };
    const factor = 1 + k * 0.04;
    Borrador.actividades(pl).forEach((a, i) => {
      if ((Borrador.act(b, a.clave).apus || []).some((x) => x.insumos.length)) return;
      b.acts[a.clave] = { precioUnitario: 0, apus: [{ id: Util.uid('ap'), codigo: 'APU-' + a.codigo, nombre: a.nombre, unidad: a.unidad,
        insumos: [{ descripcion: 'Todo costo de ' + a.nombre, unidad: a.unidad, categoria: 'Todo Costo', precio: Math.round((25000 + 911 * i) * factor), cantidad: 1 }] }] };
    });
    b.aiu = { a: 18 + k, i: 3, u: 5 };
    const valor = (t, opciones) => t === 'sí o no' ? 'Sí' : t === 'lista de opciones' ? (opciones || [])[0] : t === 'fecha' ? '2026-08-01' : ['número', 'moneda', 'porcentaje'].indexOf(t) >= 0 ? 10 : 'Respuesta DEMO';
    for (const r of (pl.requisitos || []).filter((r) => !Borrador.automatico(r))) {
      if (!Borrador.faltaRequisito(b, r).length) continue;
      if (r.tipoRespuesta === 'documento') {
        const a = await pdf(r.codigo + '.pdf');
        b.adjuntos.push(Object.assign({ id: Util.uid('aj'), requisito: r.codigo, fechaDocumento: '2026-09-01', vigenteHasta: k === 3 && r.grupo === 'Jurídico' ? '2026-01-31' : '2027-12-31' }, a));
      } else if (r.tipoRespuesta === 'dato') b.respuestas[r.codigo] = valor((r.dato || {}).tipo, (r.dato || {}).opciones);
      else {
        const fila = {};
        for (const c of ((r.tabla || {}).columnas || [])) {
          if (c.tipo === 'documento') b.adjuntos.push(Object.assign({ id: Util.uid('aj'), requisito: r.codigo, fila: 0, columna: c.clave }, await pdf(r.codigo + '_' + c.clave + '.pdf')));
          else fila[c.clave] = valor(c.tipo, c.opciones);
        }
        b.respuestas[r.codigo] = [fila];
      }
    }
    const t = Borrador.calculo(b, pl).totales;
    b.desglose.forEach((d) => { if (d.personal) d.filas = []; d.valor = 0; });
    b.desglose[1].valor = Util.redondear(t.a);
    await Oferta.guardar(); App.render();
    return { rojo: Borrador.revision(b, pl).filter((x) => !x.ok).map((x) => x.texto + ': ' + x.detalle.slice(0, 2).join(', ')), total: Borrador.calculo(b, pl).totales.total };
  }, k);
}
const diligencias = [];
for (let k = 0; k < 5; k++) diligencias.push(await diligenciar(ofertas[k], k));
const enRojo = diligencias.flatMap((d, k) => d.rojo.map((x) => 'oferta ' + (k + 1) + ' › ' + x));
m.ok(enRojo.length === 0, 'Las cinco ofertas quedan completas: la lista del módulo 14 en verde' + (enRojo.length ? ': ' + enRojo.slice(0, 4).join(' | ') : ''));

m.seccion('Preguntas, respuestas y una adenda');
{
  await irA(pp, '08');
  await conArchivos(pp, () => accion(pp, 'importar-preguntas'), ofertas[1].preguntas);
  await pp.waitForSelector('#modales .overlay'); await botonModal(pp, 'Entendido');
  const q = await pp.evaluate(() => Consultas.preguntas(Modelo.activo().id));
  m.ok(q.length === 1 && q[0].invitadoId, 'El principal importa el archivo de preguntas y lo asigna al invitado por su código');
  await pp.fill('#stage textarea[data-resp]', 'Sí: incluye el retiro de sobrantes a la escombrera autorizada.');
  await accion(pp, 'guardar-resp');
  await pp.waitForSelector('#stage [data-pub]');
  await pp.check('#stage [data-pub]');
  await accion(pp, 'publicar-resp');
  await botonModal(pp, 'Publicar');
  await pp.waitForSelector('#modales .overlay [data-arch="0"]', { timeout: 60000 });
  const rj = await descargar(pp, () => pp.click('#modales .overlay [data-arch="0"]'));
  await botonModal(pp, 'Cerrar');
  const tr = readFileSync(rj.ruta, 'utf8');
  m.ok(/ARKEN-RESPUESTAS/.test(tr) && !tr.includes(prep.invitados[1].razonSocial) && /firma/.test(tr), 'El documento de respuestas sale firmado y sin decir quién preguntó');
  // Adenda: cambia la cantidad de una actividad y prorroga nada.
  await pestana(pp, 'adendas');
  await accion(pp, 'iniciar-adenda'); await botonModal(pp, 'Preparar');
  await pp.waitForFunction(() => !!Modelo.activo().adendaEnCurso);
  const cambio = await pp.evaluate(async () => {
    const p = Modelo.activo(), pres = Modelo.presupuesto(p.id);
    const a = pres.capitulos[0].subs[0].acts[0]; a.cantidad = Number(a.cantidad) + 10;
    await Modelo.guardarPresupuesto(pres, 'adenda de prueba');
    await Documentos.pdfPliego(p); p.pliego.revisado = true; await Modelo.guardarProceso(p, 'revisado');
    App.render();
    return a.codigo;
  });
  await pp.waitForSelector('#stage [data-accion="emitir-adenda"]');
  await accion(pp, 'emitir-adenda');
  await pp.fill('#pd_motivo', 'Ajuste de la cantidad de una actividad.');
  await botonModal(pp, 'Emitir');
  await pp.waitForSelector('#modales .overlay [data-arch="0"]', { timeout: 60000 });
  const aj = await descargar(pp, () => pp.click('#modales .overlay [data-arch="0"]'));
  await botonModal(pp, 'Cerrar');
  const ta = readFileSync(aj.ruta, 'utf8');
  fugas = prep.precios.filter((s) => s.length > 6 && ta.includes(s));
  m.ok(/ARKEN-ADENDA/.test(ta) && ta.includes(cambio) && await pp.evaluate(() => Modelo.activo().versionPliego === 2 && !Modelo.activo().adendaEnCurso), 'La adenda N.º 1 se emite firmada, crea la versión 2 y nombra la actividad que cambió');
  m.ok(fugas.length === 0 && !/"precio":\s*[1-9]/.test(ta), 'La adenda no lleva precios del presupuesto base');
  // Cuatro ofertas importan respuestas y adenda; la quinta se queda en la versión 1.
  for (const k of [0, 1, 2, 3]) {
    const o = ofertas[k];
    await o.pg.click('#railList [data-m="13"]');
    if (k === 1) { await conArchivos(o.pg, () => o.pg.click('#stage [data-accion="imp-respuestas"]'), rj.ruta); await o.pg.waitForFunction(() => Oferta.borrador().respuestasRecibidas.length === 1); }
    await conArchivos(o.pg, () => o.pg.click('#stage [data-accion="imp-adenda"]'), aj.ruta);
    await botonModal(o.pg, 'Importar adenda');
    await o.pg.waitForFunction(() => Oferta.pl().versionPliego === 2, null, { timeout: 30000 });
  }
  const tras = await ofertas[1].pg.evaluate(() => ({ revisar: Oferta.borrador().revisar.actividades.length, conservados: Object.keys(Oferta.borrador().acts).length, adj: Oferta.borrador().adjuntos.length }));
  m.ok(tras.revisar === 1 && tras.conservados > 10 && tras.adj > 5, `ARKEN OFERTA importa la adenda sin perder lo diligenciado (${tras.conservados} actividades, ${tras.adj} adjuntos) y marca para revisar la actividad que cambió`);
  for (const k of [0, 1, 2, 3]) await ofertas[k].pg.evaluate(async () => {
    // El oferente revisa la actividad que cambió y ajusta el desglose de la administración a la A nueva.
    const b = Oferta.borrador(); b.revisar.actividades = [];
    b.desglose[1].valor = Util.redondear(Borrador.calculo(b, Oferta.pl()).totales.a); await Oferta.guardar();
  });
}

m.seccion('Los sobres');
const sobres = [];
for (let k = 0; k < 5; k++) sobres.push(await generarSobre(ofertas[k], 'sobre_' + (k + 1) + '.zip'));
// La tercera oferta cambia un precio y genera otro sobre: vale el último.
await ofertas[2].pg.evaluate(async () => { const b = Oferta.borrador(); const x = Object.values(b.acts)[0]; x.apus[0].insumos[0].precio += 1000; await Oferta.guardar(); });
const sobre3b = await generarSobre(ofertas[2], 'sobre_3_bis.zip');
const zs = await JSZip.loadAsync(readFileSync(sobres[1].ruta));
const cab = JSON.parse(await zs.file('sobre.json').async('string'));
m.ok(cab.cifrado && !!zs.file('oferta.cifrada') && !!zs.file('llave.envuelta') && !zs.file('oferta.json'), 'El sobre sale cerrado: oferta.cifrada y llave.envuelta, sin oferta.json en claro');
const crudo = readFileSync(sobres[1].ruta).toString('latin1');
m.ok(!crudo.includes('Materiales de') && !JSON.stringify(cab).includes('precio'), 'Ni el ZIP ni su cabecera dejan ver un precio');

// Cada ARKEN OFERTA abre su propia ventana y deja la del principal en segundo plano. Chromium frena
// los temporizadores de una página oculta (hasta uno por minuto pasados cinco minutos), y JSZip y
// las huellas los usan: el principal vuelve al frente antes de recibir y de abrir, como lo tendría
// quien opera.
m.seccion('Recepción: todos los sobres a la vez');
await pp.bringToFront();
const filasRec = await cargarSobres([...sobres.map((x) => x.ruta), sobre3b.ruta, sobres[0].ruta, paquetes[2].ruta]);
dbg('recepción', filasRec.map((f) => f.join(' · ')));
const rec = await pp.evaluate(() => Recepcion.sobres(Modelo.activo().id).map((s) => ({ archivo: s.archivo, estado: s.estado, motivo: s.motivo, avisos: s.avisos, inv: s.invitadoId, version: s.versionPliego })));
const est = (n) => (rec.find((r) => r.archivo === n) || {}).estado;
m.ok(rec.filter((r) => r.estado === 'recibido sellado').length === 5, 'Quedan cinco sobres vigentes, uno por proponente, asignados por su código de invitación');
m.ok(est('sobre_3.zip') === 'reemplazado' && est('sobre_3_bis.zip') === 'recibido sellado', 'De la tercera oferta vale el último sobre generado; el anterior queda «reemplazado»');
m.ok(filasRec.some((f) => /sobre_1\.zip/.test(f[0]) && /repetido/.test(f[2])), 'El mismo archivo cargado dos veces se reconoce como repetido');
m.ok(est(paquetes[2].nombre) === 'rechazado' && /sobre\.json/.test(rec.find((r) => r.archivo === paquetes[2].nombre).motivo), 'Un ZIP que no es un sobre se rechaza con su motivo');
const v1 = rec.find((r) => r.archivo === 'sobre_5.zip');
m.ok(v1.estado === 'recibido sellado' && v1.version === 1 && v1.avisos.some((a) => /versión 1 del pliego/.test(a)), 'El sobre de la versión 1 del pliego se recibe con un aviso: ' + (v1.avisos.find((a) => /versión 1 del pliego/.test(a)) || ''));

m.seccion('Nada se abre antes del cierre');
const antes = await pp.evaluate(async (FRASE) => {
  const p = Modelo.activo(); const r = {};
  try { await Recepcion.abrir(p, FRASE, [{ usuario: 'comite1', clave: 'clave-comite1-2026' }, { usuario: 'comite2', clave: 'clave-comite2-2026' }]); r.abrir = 'abrió'; } catch (e) { r.abrir = e.message; }
  try { await Recepcion.actaCierre(p); r.acta = 'generó'; } catch (e) { r.acta = e.message; }
  return Object.assign(r, { cierre: Recepcion.cierre(p), ofertas: Recepcion.ofertas(p.id).length });
}, FRASE);
m.ok(/antes del cierre/.test(antes.abrir) && antes.ofertas === 0, 'Antes de la hora de cierre la apertura se rechaza, aun llamando a la lógica directamente');
m.ok(/acta de cierre se genera a esa hora/.test(antes.acta), 'El acta de cierre tampoco se genera antes de la hora');
await irA(pp, '09'); await pestana(pp, 'apertura');
m.ok(await pp.isDisabled('#stage [data-accion="abrir-ofertas"]'), 'El botón de apertura está deshabilitado antes del cierre');

m.seccion('Cierre y apertura');
await pp.bringToFront();
await pp.clock.setFixedTime(new Date(antes.cierre).getTime() + 3600000);
await irA(pp, '00'); await irA(pp, '09'); await pestana(pp, 'apertura');
const ac = await descargar(pp, () => accion(pp, 'acta-cierre'));
const tAc = await textoPdf(ac.ruta);
m.ok(/ACTA DE CIERRE/.test(tAc) && /quedan 5 sobre\(s\) vigente\(s\)/.test(tAc), `${ac.nombre}: la lista de sobres con su huella y cinco vigentes, sin abrir`);
async function intentarApertura(u1, c1, u2, c2) {
  await pp.click('#stage [data-accion="abrir-ofertas"]');
  await llenar(pp, { '#pd_frase': FRASE, '#pd_u1': u1, '#pd_c1': c1, '#pd_u2': u2, '#pd_c2': c2 });
  await botonModal(pp, 'Abrir los 5 sobre(s)');
}
await intentarApertura('comite1', 'clave-comite1-2026', 'comite1', 'clave-comite1-2026');
await pp.waitForSelector('#toasts .toast.bad', { timeout: 30000 });
const tDistintos = await toastMalo(pp);
m.ok(/personas distintas/.test(tDistintos), 'La apertura exige dos miembros del comité distintos' + (/personas distintas/.test(tDistintos) ? '' : ': ' + tDistintos));
await intentarApertura('comite1', 'clave-comite1-2026', 'abogada', 'clave-abogada-2026');
await pp.waitForFunction(() => /rol Comité/.test(document.querySelector('#toasts').textContent), null, { timeout: 30000 });
m.ok(true, 'Un usuario sin el rol Comité no sirve para abrir');
const aa = await descargar(pp, () => intentarApertura('comite1', 'clave-comite1-2026', 'comite2', 'clave-comite2-2026'));
const tAa = await textoPdf(aa.ruta);
m.ok(/ACTA DE APERTURA/.test(tAa) && prep.invitados.every((i) => tAa.includes(i.razonSocial)), `${aa.nombre}: los cinco proponentes con su valor declarado y recalculado`);
const finales = [];
for (const o of ofertas) finales.push(await o.pg.evaluate(() => Borrador.calculo(Oferta.borrador(), Oferta.pl()).totales.total));
const ab = await pp.evaluate(() => Recepcion.ofertas(Modelo.activo().id).map((o) => ({ inv: o.invitadoId, dec: o.recalculo.totalDeclarado, rec: o.recalculo.totales.total,
  dif: o.recalculo.diferencias.length + o.recalculo.diferenciasTotales.length, docs: o.documentos, nov: o.novedades, v: o.versionPliego })));
m.ok(ab.length === 5, 'Se abren las cinco ofertas a la vez');
const cuadran = prep.invitados.every((inv, k) => { const o = ab.find((x) => x.inv === inv.id); return o && o.dif === 0 && Math.abs(o.rec - finales[k]) < 1; });
m.ok(cuadran, 'El valor recalculado de cada oferta es el que mostró su ARKEN OFERTA, sin diferencias de precio');
m.ok(ab.every((o) => o.docs > 5) && ab.every((o) => !o.nov.some((n) => /huella|no se abre|Falta el adjunto/.test(n))), 'Cada adjunto llega con su huella verificada');
m.ok(await pp.evaluate(() => Recepcion.actas(Modelo.activo().id, 'apertura')[0].inmutable && Modelo.activo().estado === 'abierto'), 'El acta de apertura queda inmutable y el proceso, abierto');
const cinta = await pp.textContent('#ledger');
m.ok(/Oferta más baja\s*\$/.test(cinta), 'La cinta muestra la oferta más baja, recalculada');
let tarde = '';
try { await pp.evaluate(() => Recepcion.recibir(Modelo.activo(), [])); } catch (e) { tarde = e.message; }
m.ok(/apertura ya se hizo/.test(tarde), 'Después de la apertura no se reciben más sobres');

m.seccion('Documentos de proponentes');
await irA(pp, '10');
const tabs = await pp.locator('#stage [data-pestana="dp"]').count();
m.ok(tabs === 5, 'Una pestaña y un color por proponente');
const idDelta = await pp.evaluate((id) => Recepcion.ofertas(Modelo.activo().id).find((o) => o.invitadoId === id).id, prep.invitados[3].id);
await pestana(pp, idDelta);
m.ok(await pp.locator('#stage .tag.bad', { hasText: 'vencido' }).count() > 0, 'Un documento con vigencia anterior al cierre se marca vencido');
await pp.fill('#dpBuscar', 'matrícula profesional');
await pp.waitForSelector('#dpResultados [data-hallazgo]', { timeout: 60000 });
const hall = await pp.locator('#dpResultados [data-hallazgo]').count();
await pp.click('#dpResultados [data-hallazgo="0"]');
await pp.waitForSelector('#modales #visorB canvas', { timeout: 60000 });
m.ok(hall > 3, `La búsqueda de texto encuentra «matrícula profesional» (${hall} hallazgos) y abre la página con el hallazgo resaltado`);
await botonModal(pp, 'Cerrar');
const zc = await descargar(pp, () => accion(pp, 'zip-carpeta'));
const zcz = await JSZip.loadAsync(readFileSync(zc.ruta));
const raiz = Object.keys(zcz.files)[0].split('/')[0];
m.ok(raiz.startsWith('DEMO Consorcio Delta') && !!zcz.file(raiz + '/INDICE.txt') && Object.keys(zcz.files).filter((n) => /\.pdf$/.test(n)).length > 5, `La carpeta del proponente se descarga en un ZIP cuyo nombre empieza por su razón social (${raiz})`);

m.seccion('La demostración se borra con un botón');
const borrado = await pp.evaluate(async () => { await Modelo.borrarDemo(); return ['sobres', 'ofertas', 'documentosOferta', 'actas', 'preguntas', 'adendas'].map((n) => (S[n] || []).length).reduce((a, b) => a + b, 0); });
m.ok(borrado === 0, 'Al borrar la demostración se van también sus sobres, ofertas, documentos, actas, preguntas y adendas');

m.ok(erroresP.length === 0, 'El principal sin errores de JavaScript' + (erroresP.length ? ': ' + erroresP.slice(0, 3).join(' | ') : ''));
const erroresO = ofertas.flatMap((o) => o.errores);
m.ok(erroresO.length === 0, 'Las cinco ARKEN OFERTA sin errores de JavaScript' + (erroresO.length ? ': ' + erroresO.slice(0, 3).join(' | ') : ''));
const externas = [ctxP, ...ofertas.map((o) => o.ctx)].flatMap((c) => c.peticionesExternas).filter((u) => !u.startsWith('file://'));
m.ok(externas.length === 0, 'Ninguna petición a internet' + (externas.length ? ': ' + externas.slice(0, 3).join(' | ') : ''));
await nav.close(); await srv.cerrar();
m.terminar();
