/* ─────────────── 13 · Preguntas ───────────────
   El proponente escribe sus preguntas y genera el archivo para enviarlo
   dentro del plazo; importa el documento de respuestas y las adendas, que
   llegan firmadas con la llave del proceso. */
function instanteHito(pl, clave){ const h = (pl.cronograma||[]).find(x => x.clave === clave); return h && h.fecha ? new Date(Cronograma.instante(h)).getTime() : NaN; }
Vistas['13'] = function(){
  const b = Oferta.borrador(), pl = Oferta.pl();
  const plazo = instanteHito(pl, 'preguntas');
  const abierto = !(Date.now() > plazo);
  const pendientes = (b.preguntas||[]).filter(q => !q.enviada);
  const html = cabecera('13', 'Preguntas', 'Plazo para preguntas: ' + (isFinite(plazo) ? Util.fmtSello(plazo) : 'sin fecha') + (abierto ? '' : ' · ' + UI.tag('vencido', 'bad'))) +
    '<div class="grid g2"><div class="card"><div class="card-head"><h3>Mis preguntas</h3><div class="btn-row">' + boton('preg-mas', '+ Pregunta', 'sm') +
      boton('preg-archivo', 'Generar archivo de preguntas (' + pendientes.length + ')', 'sm primary', abierto && pendientes.length ? '' : ' disabled') + '</div></div><div class="card-body">' +
      ((b.preguntas||[]).length ? (b.preguntas||[]).map((q, i) => '<div class="adj" style="align-items:flex-start"><div style="flex:1 1 300px"><textarea rows="2" data-cambio="preg" data-i="' + i + '" data-c="texto" aria-label="Pregunta ' + (i + 1) + '"' + (q.enviada ? ' disabled' : '') + '>' + esc(q.texto) + '</textarea>' +
          '<input data-cambio="preg" data-i="' + i + '" data-c="referencia" value="' + esc(q.referencia || '') + '" placeholder="Referencia (actividad, requisito, plano)" aria-label="Referencia"' + (q.enviada ? ' disabled' : '') + ' style="margin-top:4px"></div>' +
          (q.enviada ? UI.tag('enviada ' + Util.fmtFecha(q.enviada.slice(0, 10)), 'ok') : boton('preg-menos', 'Quitar', 'xs ghost', ' data-i="' + i + '"')) + '</div>').join('')
        : UI.vacio('Sin preguntas', 'Las observaciones a las cantidades, a los documentos o a las condiciones se hacen aquí.')) +
      '<p class="small muted">El archivo de preguntas se envía a la EMPRESA PRINCIPAL por el canal del proceso. Las respuestas se publican a todos los invitados, sin decir quién preguntó.</p></div></div>' +
    '<div class="card"><div class="card-head"><h3>Respuestas y adendas recibidas</h3><div class="btn-row">' + boton('imp-respuestas', 'Importar respuestas', 'sm') + boton('imp-adenda', 'Importar adenda', 'sm brass') + '</div></div><div class="card-body">' +
      ((b.respuestasRecibidas||[]).map(r => '<h4 style="margin:8px 0 4px">Documento de respuestas N.º ' + esc(r.numero) + ' · ' + Util.fmtFecha(String(r.fecha).slice(0, 10)) + '</h4>' +
        r.items.map(x => '<div class="small" style="margin:4px 0 8px"><b>' + esc(x.numero) + '. ' + esc(x.pregunta) + '</b><br>' + esc(x.respuesta) + '</div>').join('')).join('') +
       (b.adendas||[]).map(a => '<h4 style="margin:10px 0 4px">Adenda N.º ' + esc(a.numero) + ' · versión ' + esc(a.versionNueva) + '</h4><p class="small">' + esc(a.motivo || '') + '</p><ul class="small">' + (a.cambios||[]).map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>').join('')) ||
       UI.vacio('Nada recibido aún', 'Cuando la EMPRESA PRINCIPAL publique respuestas o adendas, impórtelas aquí. El programa verifica su firma.') +
    '</div></div></div>';
  return { html, acciones:{
    'preg-mas':async () => { b.preguntas = (b.preguntas||[]).concat([{ id:Util.uid('q'), texto:'', referencia:'' }]); await Oferta.guardar(); App.render(); },
    'preg-menos':async el => { b.preguntas.splice(+el.dataset.i, 1); await Oferta.guardar(); App.render(); },
    'preg-archivo':async () => {
      if (Date.now() > plazo) throw new Error('El plazo para preguntas venció el ' + Util.fmtSello(plazo) + '.');
      const qs = pendientes.filter(q => String(q.texto||'').trim());
      if (!qs.length) throw new Error('Escriba al menos una pregunta.');
      const r = Intercambio.archivoPreguntas(b, pl, qs);
      UI.descargar(r.nombre, r.texto, 'application/json');
      const ahora = new Date().toISOString();
      qs.forEach(q => { q.enviada = ahora; });
      await Oferta.guardar(); UI.toast('Archivo de preguntas generado: envíelo a la EMPRESA PRINCIPAL', 'ok'); App.render();
    },
    'imp-respuestas':async () => {
      const [f] = await UI.elegirArchivos('.json'); if (!f) return;
      const r = await Intercambio.leerRespuestas(await f.text(), pl);
      if ((b.respuestasRecibidas||[]).some(x => x.numero === r.numero)) throw new Error('El documento de respuestas N.º ' + r.numero + ' ya estaba importado.');
      b.respuestasRecibidas = (b.respuestasRecibidas||[]).concat([{ numero:r.numero, fecha:r.fecha, items:r.items }]);
      await Oferta.guardar(); UI.toast('Respuestas N.º ' + r.numero + ' importadas: firma verificada', 'ok'); App.render();
    },
    'imp-adenda':async () => {
      const [f] = await UI.elegirArchivos('.json'); if (!f) return;
      const a = await Intercambio.leerAdenda(await f.text(), pl);
      const ok = await UI.confirmar({ titulo:'Importar la adenda N.º ' + a.numero, textoAceptar:'Importar adenda',
        cuerpo:'<p>Firma verificada con la llave del proceso. La adenda lleva el pliego de la versión ' + a.versionAnterior + ' a la <b>' + a.versionNueva + '</b>' + (a.soloProrroga ? ' (solo prorroga el cierre)' : '') + ':</p><ul>' + (a.cambios||[]).map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>' +
          '<p class="small">Lo que ya diligenció se conserva. Lo que la adenda cambió queda marcado para que lo revise.</p>' });
      if (!ok) return;
      const dif = Borrador.aplicarAdenda(b, pl, a);
      Plg.usar(a.pliego);
      await Oferta.guardar();
      UI.toast('Adenda ' + a.numero + ' importada · ' + dif.lista.length + ' cambio(s)', 'ok'); App.render();
    }
  }, cambios:{ 'preg':async el => { b.preguntas[+el.dataset.i][el.dataset.c] = el.value; await Oferta.guardar(); } } };
};

/* ─────────────── 14 · Revisar y generar sobre ─────────────── */
function pdfResumen(b, pl){
  const k = Borrador.calculo(b, pl);
  const caps = (k.pres.capitulos||[]).map(c => ({ codigo:c.codigo, nombre:c.nombre, valor:Calculo.valorCapitulo(k.pres, c) }));
  return Pdf.generar({ encabezado:'ARKEN OFERTA', subEncabezado:'OFERTA DEL PROPONENTE', titulo:'Resumen de la oferta', documento:'Resumen de la oferta ' + pl.proceso.codigo,
    lineaIzquierda:'Proceso: ' + pl.proceso.codigo + ' · ' + pl.proceso.nombre, marcaAgua:pl.proceso.demo ? 'DEMOSTRACIÓN' : '',
    bloques:Actas.resumenOferta({ pliego:pl, proponente:b.proponente, totales:k.totales, capitulos:caps }) });
}
Vistas['14'] = function(){
  const b = Oferta.borrador(), pl = Oferta.pl();
  const conf = pl.etapa === 'confidencialidad';
  const rev = Borrador.revision(b, pl), listo = Borrador.listo(rev);
  const cierre = instanteCierre(pl), cerrado = Date.now() > cierre;
  const grupos = [];
  rev.forEach(x => { if (grupos.indexOf(x.grupo) < 0) grupos.push(x.grupo); });
  const html = cabecera('14', conf ? 'Generar sobre de confidencialidad' : 'Revisar y generar sobre', conf ? '' : 'Cierre: ' + esc(textoCierre(pl)) + (cerrado ? ' · ' + UI.tag('cerrado', 'bad') : '')) +
    '<div class="card"><div class="card-head"><h3>Lista de verificación</h3>' + UI.tag(listo ? 'todo completo' : rev.filter(x => !x.ok).length + ' pendiente(s)', listo ? 'ok' : 'bad') + '</div><div class="card-body">' +
      grupos.map(g => '<div class="chk-grupo">' + esc(g) + '</div>' + rev.filter(x => x.grupo === g).map(x => itemChk(x.ok, esc(x.texto),
        (x.ok ? '' : boton('ir-modulo', 'Ir a corregir (módulo ' + x.modulo + ')', 'xs ghost', ' data-modulo="' + x.modulo + '"')) +
        (!x.ok && x.detalle.length ? '<ul>' + x.detalle.slice(0, 8).map(d => '<li>' + esc(d) + '</li>').join('') + (x.detalle.length > 8 ? '<li>y ' + (x.detalle.length - 8) + ' más</li>' : '') + '</ul>' : ''))).join('')).join('') +
      '<div class="btn-row" style="margin-top:18px">' + (conf ? '' : boton('resumen-pdf', 'Vista previa del resumen (PDF)')) +
        '<button class="btn primary" type="button" data-accion="generar-sobre"' + (listo && !(cerrado && !conf) ? '' : ' disabled title="' + (cerrado ? 'El cierre ya pasó' : 'Falta lo que está en rojo') + '"') + '>' + (conf ? 'Generar sobre de confidencialidad' : 'Generar sobre') + '</button></div>' +
      (conf ? '' : '<p class="small muted" style="margin-top:8px">' + (pl.proceso.sobreCerrado !== false ? 'El sobre sale cerrado: cifrado con la llave pública del proceso. Solo se abre en el programa de la EMPRESA PRINCIPAL, con su frase, después del cierre.' : 'Este proceso no usa sobre cerrado: el contenido viaja sin cifrar, con la huella de cada archivo.') +
        ' El resumen en PDF le sirve como carta de presentación: imprímalo, fírmelo y adjúntelo donde el pliego lo pida.</p>') + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Sobres generados</h3></div><div class="card-body flush">' + ((b.sobres||[]).length ? '<div class="tw"><table class="t"><thead><tr><th>Archivo</th><th>Generado</th><th>Versión</th><th class="n">Peso</th><th>Huella SHA-256</th></tr></thead><tbody>' +
      b.sobres.slice().reverse().map((s, i) => '<tr><td><b>' + esc(s.nombre) + '</b>' + (i === 0 ? ' ' + UI.tag('el último', 'ok') : ' ' + UI.tag('reemplazado')) + '</td><td>' + Util.fmtSello(s.generado) + '</td><td>' + esc(s.versionPliego) + '</td><td class="n">' + Util.pesoLegible(s.peso) + '</td><td><span class="huella">' + esc(s.sha256) + '</span></td></tr>').join('') +
      '</tbody></table></div><p class="small muted" style="padding:10px 14px">Puede generar un sobre nuevo antes del cierre: la EMPRESA PRINCIPAL se queda con el último que usted generó antes del cierre y guarda los demás como reemplazados.</p>'
      : UI.vacio('Aún no ha generado un sobre', '')) + '</div></div>';
  return { html, acciones:{
    'ir-modulo':el => App.ir(el.dataset.modulo),
    'resumen-pdf':() => { const r = pdfResumen(b, pl); UI.descargar('Resumen_oferta_' + Util.razonSocialArchivo(b.proponente.razonSocial) + '_' + Util.codigoArchivo(pl.proceso.codigo) + '.pdf', r.blob); },
    'generar-sobre':async () => {
      if (!Borrador.listo(Borrador.revision(b, pl))) throw new Error('Falta lo que está en rojo en la lista.');
      if (!conf && Date.now() > instanteCierre(pl)) throw new Error('El cierre fue el ' + Util.fmtSello(instanteCierre(pl)) + ': la EMPRESA PRINCIPAL no recibe sobres generados después.');
      const k = conf ? null : Borrador.calculo(b, pl);
      const ok = await UI.confirmar({ titulo:conf ? 'Generar sobre de confidencialidad' : 'Generar el sobre de oferta', textoAceptar:'Generar sobre',
        cuerpo:conf ? '<p>El sobre lleva sus datos y el acuerdo firmado. Envíelo a la EMPRESA PRINCIPAL.</p>'
          : '<p>Valor total de la oferta: <b>' + money(k.totales.total) + '</b>. ' + (b.adjuntos||[]).length + ' documento(s) adjunto(s).</p><p class="small">El programa genera el archivo; usted lo envía a la EMPRESA PRINCIPAL antes del cierre. Si después genera otro, vale el último generado antes del cierre.</p>' });
      if (!ok) return;
      UI.toast('Generando el sobre…');
      const r = await Intercambio.sobre(b, pl);
      UI.descargar(r.nombre, r.blob);
      b.sobres = (b.sobres||[]).concat([{ nombre:r.nombre, generado:r.cabecera.generado, versionPliego:pl.versionPliego, peso:r.blob.size, sha256:await huellaBlob(r.blob), tipo:r.cabecera.tipo }]);
      await Oferta.guardar(); UI.toast('Sobre generado: ' + r.nombre, 'ok'); App.render();
    }
  } };
};
