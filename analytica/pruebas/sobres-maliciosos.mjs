// ARKEN ANALYTICA · sobres maliciosos (§16, §24), contra la recepción y la apertura reales, en Chromium.
//
// Los sobres se arman en la página con las mismas funciones de formato que usa ARKEN OFERTA
// (Sobre.cabecera, Sobre.huellaContenido, Cripto.cifrarSobre) y después se alteran:
//
//   · al recibir: un archivo que no es ZIP, rutas que salen de la carpeta, nombres con HTML,
//     contenido cambiado (la huella no coincide), sobre.json con el código de otro invitado o con un NIT
//     falso, un sobre de otro proceso, uno generado después del cierre y uno sin cifrar en un proceso cerrado
//   · al abrir: un adjunto PDF con JavaScript, un adjunto cuya huella no es la declarada, un archivo
//     que no está declarado, un ZIP interno con una ruta peligrosa y un sobre cifrado para otro proceso
//   · nada de eso ejecuta código ni detiene la apertura de los demás
//
// Uso: npm run prueba:sobres-maliciosos

import {
  RUTA_ANALYTICA, servidor, navegador, contexto, vigilarErrores, abrirAnalytica, ingresar, marcador, prepararEmitido,
} from './comun.mjs';

const m = marcador('Sobres maliciosos');
const srv = await servidor();
const nav = await navegador();
const ctx = await contexto(nav);
const pg = await ctx.newPage();
const errores = vigilarErrores(pg);
const FRASE = 'el comité abre las ofertas';
await abrirAnalytica(pg, srv.url(RUTA_ANALYTICA));
await ingresar(pg, 'admin', 'arken', 'prueba-maliciosos-2026');
const prep = await prepararEmitido(pg, FRASE);
m.ok(prep.estado === 'emitido', 'Proceso de demostración emitido');

/* Arma un sobre como ARKEN OFERTA y le aplica una alteración. */
const resultado = await pg.evaluate(async () => {
  const p = Modelo.activo();
  const invs = Modelo.invitados(p.id);
  const ll = Modelo.llaves(p.id);
  const enc = new TextEncoder();
  const formulario = Paquete.formulario(Modelo.presupuesto(p.id), p.politicaApu);
  const pdfLimpio = () => { const d = new window.jspdf.jsPDF(); d.text('Certificado DEMOSTRACIÓN', 20, 20); return new Uint8Array(d.output('arraybuffer')); };
  const pdfConJs = enc.encode('%PDF-1.7\n1 0 obj << /Type /Catalog /OpenAction << /S /JavaScript /JS (window.__pwned=1) >> >> endobj\n%%EOF');

  async function sobre(inv, o = {}) {
    const adj = [];
    const interno = new JSZip();
    const docs = o.docs || [{ req: 'JUR-01', nombre: 'Camara.pdf', bytes: pdfLimpio() }];
    for (const d of docs) {
      const ruta = Sobre.rutaAdjunto(d.req, d.nombre);
      interno.file(ruta, d.bytes);
      adj.push({ requisito: d.req, nombre: d.nombre, ruta, sha256: d.shaFalso || await Cripto.sha256(d.bytes), peso: d.bytes.length });
    }
    const acts = formulario.capitulos.flatMap((c) => c.subs.flatMap((s) => s.acts.map((a) => ({ capitulo: c.codigo, subcapitulo: s.codigo, codigo: a.codigo, precioUnitario: 50000,
      apus: [{ codigo: 'APU-' + a.codigo, nombre: a.nombre, unidad: a.unidad, insumos: [{ descripcion: 'Todo costo', unidad: a.unidad, categoria: 'Todo Costo', precio: 50000, cantidad: 1 }] }] }))));
    const of = { formato: 'ARKEN-OFERTA', version: 1, proceso: p.codigo, versionPliego: p.versionPliego, generado: new Date().toISOString(),
      proponente: { razonSocial: inv.razonSocial, nit: Nit.formatear(inv.nit, inv.dv), codigoInvitacion: inv.codigoInvitacion },
      presupuesto: { actividades: acts, aiu: { a: 20, i: 4, u: 6 }, iva: { tarifa: 19, base: 'utilidad' } }, adjuntos: adj };
    of.presupuesto.totales = Sobre.recalcular(of, formulario).totales;
    interno.file('oferta.json', JSON.stringify(of));
    if (o.extraInterno) interno.file(o.extraInterno, 'x');
    const claro = await interno.generateAsync({ type: 'uint8array' });
    const destino = o.publicaAjena || ll.publicaCifrado;
    const c = await Cripto.cifrarSobre(destino, claro);
    const archivos = [{ ruta: 'oferta.cifrada', bytes: c.cifrado }, { ruta: 'llave.envuelta', bytes: enc.encode(JSON.stringify(c.envuelta)) }];
    if (o.sinCifrar) { archivos.length = 0; archivos.push({ ruta: 'oferta.json', bytes: enc.encode(JSON.stringify(of)) }); }
    if (o.extraExterno) archivos.push({ ruta: o.extraExterno, bytes: enc.encode('x') });
    const lista = [];
    for (const a of archivos) lista.push({ ruta: a.ruta, sha256: await Cripto.sha256(a.bytes) });
    const cab = Sobre.cabecera({ proceso: o.proceso || p.codigo, versionPliego: p.versionPliego, invitado: { razonSocial: inv.razonSocial, nit: o.nit || Nit.formatear(inv.nit, inv.dv), codigoInvitacion: o.codigo || inv.codigoInvitacion },
      generado: o.generado || new Date().toISOString(), sha256Contenido: await Sobre.huellaContenido(lista), cifrado: !o.sinCifrar });
    const z = new JSZip();
    z.file('sobre.json', JSON.stringify(cab));
    for (const a of archivos) z.file(a.ruta, o.alterar === a.ruta ? Uint8Array.from(a.bytes, (b, i) => i === 20 ? b ^ 1 : b) : a.bytes);
    const blob = await z.generateAsync({ type: 'blob' });
    return new File([blob], o.nombre || Sobre.nombre(inv.razonSocial, p.codigo, p.versionPliego, cab.generado), { type: 'application/zip' });
  }
  const cierre = Recepcion.cierre(p);
  const otro = await Cripto.crearLlaves('otra frase del comité aquí', 'OTRO', 1000);
  const recibir1 = [
    new File([new TextEncoder().encode('esto no es un zip')], 'no_es_zip.zip'),
    await sobre(invs[0], { extraExterno: '../../fuera.txt', nombre: 'ruta_fuera.zip' }),
    await sobre(invs[0], { extraExterno: 'Adjuntos/<img src=x onerror=window.__pwned=1>.pdf', nombre: 'nombre_html.zip' }),
    await sobre(invs[0], { alterar: 'oferta.cifrada', nombre: 'contenido_alterado.zip' }),
    await sobre(invs[0], { codigo: 'ZZZZ-9999', nombre: 'codigo_ajeno.zip' }),
    await sobre(invs[0], { nit: '999999999-1', nombre: 'nit_falso.zip' }),
    await sobre(invs[0], { proceso: 'OTRO-2026-1', nombre: 'otro_proceso.zip' }),
    await sobre(invs[0], { generado: new Date(new Date(cierre).getTime() + 1000).toISOString(), nombre: 'despues_del_cierre.zip' }),
    await sobre(invs[0], { sinCifrar: true, nombre: 'sin_cifrar.zip' }),
    // Estos se reciben y fallan o dejan novedades en la apertura:
    await sobre(invs[1], { docs: [{ req: 'JUR-01', nombre: 'Camara_con_script.pdf', bytes: pdfConJs }, { req: 'JUR-02', nombre: 'RUT.pdf', bytes: pdfLimpio(), shaFalso: '0'.repeat(64) }], extraInterno: 'Adjuntos/no_declarado.exe', nombre: 'adjuntos_malos.zip' }),
    await sobre(invs[2], { extraInterno: '../escapa.txt', nombre: 'interno_peligroso.zip' }),
    await sobre(invs[3], { publicaAjena: otro.publicaCifrado, nombre: 'cifrado_para_otro.zip' }),
    await sobre(invs[4]),
  ];
  const res = await Recepcion.recibir(p, recibir1);
  return { res, cierre, pwned: !!window.__pwned, html: !!document.querySelector('img[src="x"]') };
});
const est = (n) => resultado.res.find((r) => r.archivo === n) || {};
m.seccion('Al recibir');
for (const [n, re, txt] of [['no_es_zip.zip', /no es un archivo ZIP/i, 'Un archivo que no es ZIP'], ['ruta_fuera.zip', /sale de su carpeta/, 'Un ZIP con una ruta que sale de su carpeta'],
  ['nombre_html.zip', /nombre de archivo con HTML/, 'Un ZIP con un nombre de archivo con HTML'], ['contenido_alterado.zip', /huella del contenido/, 'Un sobre con un byte cambiado en oferta.cifrada'],
  ['codigo_ajeno.zip', /no corresponde a ningún invitado/, 'Un sobre con un código de invitación que no existe'], ['nit_falso.zip', /NIT/, 'Un sobre con el NIT de otra empresa'],
  ['otro_proceso.zip', /es del proceso/, 'Un sobre de otro proceso'], ['despues_del_cierre.zip', /después del cierre/, 'Un sobre generado después del cierre']]) {
  m.ok(est(n).estado === 'rechazado' && re.test(est(n).motivo), txt + ' se rechaza: ' + est(n).motivo);
}
m.ok(est('sin_cifrar.zip').estado === 'recibido sellado' && (est('sin_cifrar.zip').avisos || []).some((a) => /sin cifrar/.test(a)), 'Un sobre sin cifrar en un proceso de sobre cerrado se recibe con aviso para el comité');
const bueno = resultado.res.find((r) => r.invitado === prep.invitados[4].razonSocial) || {};
m.ok(['adjuntos_malos.zip', 'interno_peligroso.zip', 'cifrado_para_otro.zip'].every((n) => est(n).estado === 'recibido sellado') && bueno.estado === 'recibido sellado' && !bueno.avisos.length, 'Los sobres cifrados en regla se reciben sellados, sin abrir');
m.ok(!resultado.pwned && !resultado.html, 'Nada de lo recibido ejecutó código ni pintó HTML');

m.seccion('Al abrir');
await pg.clock.setFixedTime(new Date(resultado.cierre).getTime() + 60000);
const ap = await pg.evaluate(async (FRASE) => {
  const p = Modelo.activo();
  await Recepcion.actaCierre(p);
  const r = await Recepcion.abrir(p, FRASE, [{ usuario: 'comite1', clave: 'clave-comite1-2026' }, { usuario: 'comite2', clave: 'clave-comite2-2026' }]);
  App.ir('10');
  return { filas: r.filas, rechazados: r.rechazados, docs: (S.documentosOferta || []).map((d) => d.nombre), pwned: !!window.__pwned };
}, FRASE);
const fila = (n) => ap.filas.find((f) => f.proponente === prep.invitados[n].razonSocial);
const rech = (n) => ap.rechazados.find((f) => f.proponente === prep.invitados[n].razonSocial);
const nov = (fila(1) || { novedades: [] }).novedades.join(' ');
m.ok(/Camara_con_script\.pdf.*trae JavaScript/.test(nov) && !ap.docs.includes('Camara_con_script.pdf'), 'Un adjunto PDF con JavaScript no se abre ni se guarda, y queda en las novedades');
m.ok(/RUT\.pdf.*no coincide con su huella/.test(nov), 'Un adjunto cuya huella no es la declarada queda en las novedades');
m.ok(/no_declarado\.exe.*no está declarado/.test(nov), 'Un archivo que no está declarado en oferta.json no se tiene en cuenta y se anota');
m.ok(rech(2) && /sale de su carpeta/.test(rech(2).motivo), 'Un ZIP interno con una ruta peligrosa no se abre: ' + (rech(2) || {}).motivo);
m.ok(rech(3) && /no corresponde a este proceso/.test(rech(3).motivo), 'Un sobre cifrado para la llave de otro proceso no se abre: ' + (rech(3) || {}).motivo);
m.ok(fila(4) && fila(4).novedades.length === 0 && fila(4).documentos === 1, 'El sobre en regla se abre sin novedades, aunque otros fallen' + (fila(4) ? ': ' + fila(4).novedades.join(' | ') + ' · ' + fila(4).documentos + ' doc.' : ''));
m.ok(fila(0) && /sin cifrar/.test(fila(0).novedades.join(' ')), 'El sobre sin cifrar se abre y lleva su aviso al acta');
m.ok(!ap.pwned, 'La apertura no ejecutó ningún script');
m.ok(errores.length === 0, 'Sin errores de JavaScript' + (errores.length ? ': ' + errores.slice(0, 3).join(' | ') : ''));
m.ok(ctx.peticionesExternas.length === 0, 'Ninguna petición a internet');
await nav.close(); await srv.cerrar();
m.terminar();
