/* ══════════════════════════════════════════════════════════════════════════
   ACTAS Y DOCUMENTOS DE LA FASE 2 — contenido en bloques neutros, que Pdf
   dibuja con el estilo de ARKEN (como Pliego): LEAME_PRIMERO del paquete,
   acta de cierre, acta de apertura, documento de respuestas, adenda y el
   resumen de la oferta que imprime el proponente.
   ══════════════════════════════════════════════════════════════════════════ */
const Actas = (function(){

  const kvProceso = (p, e) => ({ t:'kv', cols:2, pares:[['Proceso', p.codigo], ['Nombre', p.nombre],
    ['EMPRESA PRINCIPAL', (e && e.razonSocial) || '—'], ['NIT', e && e.nit ? (String(e.nit).indexOf('-') >= 0 ? e.nit : Nit.formatear(e.nit, e.dv)) : '—']] });

  /** LEAME_PRIMERO.pdf: una página con lo que el invitado debe hacer. */
  function leame(c){
    const p = c.pliego.proceso, conf = c.pliego.etapa === 'confidencialidad';
    const B = [{ t:'texto', txt:'LÉAME PRIMERO · ' + (conf ? 'Acuerdo de confidencialidad del proceso ' : 'Invitación al proceso ') + p.codigo, negrita:true, tam:11 },
      kvProceso(p, c.pliego.empresaPrincipal),
      { t:'kv', cols:2, pares:[['Invitado', c.pliego.invitado.razonSocial], ['NIT', c.pliego.invitado.nit], ['Código de invitación', c.pliego.invitado.codigoInvitacion], ['Versión del pliego', String(c.pliego.versionPliego)]] },
      { t:'sec', nivel:2, txt:'Qué hacer' },
      { t:'lista', numerada:true, items:(conf ? [
        'Descomprima este paquete en una carpeta de su equipo.',
        'Abra con doble clic ' + Paquete.nombreOferta(p.codigo) + '. Funciona sin internet y sin instalar nada.',
        'El programa le pide elegir este mismo archivo ZIP para comprobar que nadie lo alteró.',
        'Lea el acuerdo de confidencialidad, fírmelo como indica y adjúntelo en el programa.',
        'Genere el sobre de confidencialidad y envíelo a la EMPRESA PRINCIPAL. Cuando lo verifique, le enviará el paquete completo del proceso.'
      ] : [
        'Descomprima este paquete en una carpeta de su equipo.',
        'Abra con doble clic ' + Paquete.nombreOferta(p.codigo) + '. Funciona sin internet y sin instalar nada, en Chrome, Edge, Firefox o Safari recientes.',
        'El programa le pide elegir este mismo archivo ZIP para comprobar que el pliego es auténtico y que ningún archivo fue alterado.',
        'Cree su usuario local, diligencie cada módulo y adjunte los documentos contra su requisito.',
        'En «Revisar y generar sobre» corrija lo que esté en rojo y genere el sobre. Entréguelo antes del cierre: ' + c.cierreTexto + '.'
      ]) },
      { t:'sec', nivel:2, txt:'Autenticidad' },
      { t:'texto', txt:'Huella de la llave de firma del proceso: ' + c.huellaFirma + '. Si tiene dudas, pida a la EMPRESA PRINCIPAL que se la confirme por teléfono: ARKEN OFERTA muestra la misma huella al verificar el paquete.', gris:true },
      { t:'texto', txt:'Este paquete es personal: está a nombre de ' + c.pliego.invitado.razonSocial + '. No lo comparta con otros invitados.', gris:true }];
    return B;
  }

  /** Acta de cierre (§17.2). c = { proceso, empresa, cierre, sobres:[{ proponente, archivo, sha256, recibido, estado, motivo }], usuario, fecha } */
  function cierre(c){
    const vig = c.sobres.filter(s => s.estado === 'recibido sellado');
    return [{ t:'texto', txt:'ACTA DE CIERRE DEL PROCESO ' + c.proceso.codigo, negrita:true, tam:11 },
      kvProceso(c.proceso, c.empresa),
      { t:'texto', txt:'Cierre y entrega de ofertas: ' + Util.fmtSello(c.cierre) + '. Acta generada el ' + Util.fmtSello(c.fecha) + ' por ' + c.usuario + '. ' +
        'Se recibieron ' + c.sobres.length + ' archivo(s); quedan ' + vig.length + ' sobre(s) vigente(s), uno por proponente, sin abrir.' },
      { t:'tabla', cabeza:['Proponente','Archivo','Recibido','Estado','Huella SHA-256'], anchos:[38, 52, 22, 26, 62], letraChica:true,
        filas:c.sobres.map(s => ({ celdas:[s.proponente || '—', s.archivo, Util.fmtSello(s.recibido), s.estado + (s.motivo ? ' · ' + s.motivo : ''), s.sha256] })) },
      { t:'texto', txt:'Ningún sobre se abrió antes de este cierre. Los sobres reemplazados por uno posterior del mismo proponente se conservan sin abrir.', gris:true }];
  }

  /** Acta de apertura (§17.2). c = { proceso, empresa, fecha, filas:[{ proponente, declarado, recalculado, documentos, novedades }],
      rechazados:[{ proponente, archivo, motivo }], firmantes:[{ nombre, cargo, usuario, fecha }] } */
  function apertura(c){
    const B = [{ t:'texto', txt:'ACTA DE APERTURA DE OFERTAS · PROCESO ' + c.proceso.codigo, negrita:true, tam:11 },
      kvProceso(c.proceso, c.empresa),
      { t:'texto', txt:'Apertura realizada el ' + Util.fmtSello(c.fecha) + ' con la frase del proceso y ' + c.firmantes.length + ' miembros del comité autenticados en el momento. ' +
        'Cada sobre se verificó (huella del contenido, huella de cada adjunto) y sus totales se recalcularon con las cantidades del pliego.' },
      { t:'tabla', cabeza:['Proponente','Valor declarado','Valor recalculado','Documentos','Novedades'], anchos:[44, 30, 30, 18, 58], alinear:{ 1:'right', 2:'right', 3:'right' },
        filas:c.filas.map(f => ({ celdas:[f.proponente, Util.money(f.declarado), Util.money(f.recalculado), String(f.documentos), f.novedades.length ? f.novedades.join(' ') : 'Ninguna'] })) }];
    if (c.rechazados && c.rechazados.length)
      B.push({ t:'sec', nivel:2, txt:'Sobres que no se pudieron abrir' }, { t:'tabla', cabeza:['Proponente','Archivo','Motivo'], anchos:[44, 60, 76],
        filas:c.rechazados.map(r => ({ celdas:[r.proponente || '—', r.archivo, r.motivo] })) });
    B.push({ t:'sec', nivel:2, txt:'Firmas' },
      { t:'tabla', cabeza:['Nombre','Cargo','Usuario','Fecha','Firma'], anchos:[46, 36, 26, 30, 42], filas:c.firmantes.map(f => ({ celdas:[f.nombre, f.cargo || '—', f.usuario, Util.fmtSello(f.fecha), ''] })) },
      { t:'texto', txt:'Esta acta queda inmutable en ARKEN ANALYTICA con su huella. El valor recalculado es el que resulta de los precios unitarios ofrecidos y las cantidades del pliego; las diferencias se analizan en la verificación.', gris:true });
    return B;
  }

  /** Documento de respuestas: numerado y sin decir quién preguntó (§12.3). */
  function respuestas(c){
    const B = [{ t:'texto', txt:'DOCUMENTO DE RESPUESTAS N.º ' + c.numero + ' · PROCESO ' + c.proceso.codigo, negrita:true, tam:11 },
      kvProceso(c.proceso, c.empresa),
      { t:'texto', txt:'Se publica a todos los invitados por igual, sin indicar quién formuló cada pregunta. Fecha: ' + Util.fmtSello(c.fecha) + '.', gris:true }];
    c.items.forEach(x => { B.push({ t:'sec', nivel:2, txt:'Pregunta ' + x.numero + (x.referencia ? ' · ' + x.referencia : '') }, { t:'texto', txt:x.pregunta }, { t:'texto', txt:'Respuesta: ' + x.respuesta, negrita:false }); });
    return B;
  }

  /** Adenda: versión nueva del pliego y su lista de cambios. */
  function adenda(c){
    return [{ t:'texto', txt:'ADENDA N.º ' + c.numero + ' · PROCESO ' + c.proceso.codigo, negrita:true, tam:11 },
      kvProceso(c.proceso, c.empresa),
      { t:'kv', cols:2, pares:[['Versión anterior del pliego', String(c.versionAnterior)], ['Versión nueva', String(c.versionNueva)], ['Fecha', Util.fmtSello(c.fecha)], ['Huella del pliego nuevo', c.huellaPliegoPdf || '—']] },
      { t:'sec', nivel:2, txt:'Motivo' }, { t:'texto', txt:c.motivo || '—' },
      { t:'sec', nivel:2, txt:'Cambios' }, { t:'lista', numerada:true, items:c.cambios.length ? c.cambios : ['Sin cambios de contenido.'] },
      { t:'texto', txt:'Importe el archivo de esta adenda en ARKEN OFERTA (módulo 13 · Preguntas). El programa conserva lo que ya diligenció y marca para revisar lo que la adenda cambió.', gris:true }];
  }

  /** Resumen de la oferta que el proponente imprime y firma como carta de presentación. */
  function resumenOferta(c){
    const t = c.totales;
    const B = [{ t:'texto', txt:'RESUMEN DE LA OFERTA · PROCESO ' + c.pliego.proceso.codigo, negrita:true, tam:11 },
      { t:'kv', cols:2, pares:[['Proceso', c.pliego.proceso.codigo + ' · ' + c.pliego.proceso.nombre], ['EMPRESA PRINCIPAL', c.pliego.empresaPrincipal.razonSocial],
        ['Proponente', c.proponente.razonSocial], ['NIT', c.proponente.nit], ['Representante legal', c.proponente.representante || '—'], ['Versión del pliego', String(c.pliego.versionPliego)]] },
      { t:'tabla', cabeza:['Concepto','Porcentaje','Valor'], anchos:[90, 30, 60], alinear:{ 1:'right', 2:'right' }, filas:[
        { celdas:['Costo directo', '', Util.money(t.costoDirecto)] }, { celdas:['Administración', Util.pct(t.pctA, 2), Util.money(t.a)] },
        { celdas:['Imprevistos', Util.pct(t.pctI, 2), Util.money(t.i)] }, { celdas:['Utilidad', Util.pct(t.pctU, 2), Util.money(t.u)] },
        { celdas:['IVA', Util.pct(t.tarifaIva, 0), Util.money(t.iva)] }, { tipo:'cap', celdas:['VALOR TOTAL DE LA OFERTA', '', Util.money(t.total)] }] },
      { t:'sec', nivel:2, txt:'Por capítulo' },
      { t:'tabla', cabeza:['Código','Capítulo','Valor'], anchos:[20, 110, 50], alinear:{ 2:'right' }, filas:c.capitulos.map(x => ({ celdas:[x.codigo, x.nombre, Util.money(x.valor)] })) },
      { t:'texto', txt:'El suscrito, en nombre de ' + c.proponente.razonSocial + ', presenta esta oferta para el proceso ' + c.pliego.proceso.codigo +
        '. Declaro que conozco y acepto el pliego (versión ' + c.pliego.versionPliego + '), sus adendas y las respuestas publicadas; que la oferta es irrevocable y vigente por noventa (90) días desde el cierre; y que la información entregada es veraz.' },
      { t:'texto', txt:'\nFirma del representante legal: ______________________________\nNombre: ' + (c.proponente.representante || '') + '\nDocumento: ' + (c.proponente.documentoRepresentante || '') }];
    return B;
  }
  return { leame, cierre, apertura, respuestas, adenda, resumenOferta };
})();
