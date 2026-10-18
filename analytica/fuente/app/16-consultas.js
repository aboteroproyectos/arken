/* ══════════════════════════════════════════════════════════════════════════
   PREGUNTAS, RESPUESTAS Y ADENDAS en el principal (§12.3).
   · Las preguntas llegan en el archivo de ARKEN OFERTA o por correo; se
     registran con su autor, pero el documento de respuestas sale numerado y
     sin decir quién preguntó, igual para todos los invitados.
   · Una adenda es una versión nueva del pliego (n+1): se prepara editando el
     proceso como antes de emitir, y al emitirla se firma un archivo de adenda
     con la lista de cambios y el pliego nuevo, que ARKEN OFERTA importa sin
     perder lo diligenciado. Después del plazo de adendas solo se admite
     prorrogar el cierre.
   ══════════════════════════════════════════════════════════════════════════ */
const Consultas = (function(){

  function preguntas(procesoId){ return (S.preguntas||[]).filter(q => q.procesoId === procesoId).sort((a, b) => a.recibida < b.recibida ? -1 : 1); }
  function documentosRespuestas(procesoId){ return (S.actas||[]).filter(a => a.procesoId === procesoId && a.tipo === 'respuestas').sort((a, b) => a.numero - b.numero); }
  function adendas(procesoId){ return (S.adendas||[]).filter(a => a.procesoId === procesoId).sort((a, b) => a.numero - b.numero); }
  function instante(p, clave){ const h = Cronograma.hito(p.cronograma, clave); return h && h.fecha ? new Date(Cronograma.instante(h)).getTime() : NaN; }

  /* ── Preguntas ── */
  async function registrar(p, d){
    Permisos.exigir('gestionarPreguntas');
    if (!String(d.texto||'').trim()) throw new Error('La pregunta está vacía.');
    const inv = Modelo.invitados(p.id).find(i => i.id === d.invitadoId);
    const ahora = d.recibida || new Date().toISOString();
    const q = { id:Util.uid('pq'), procesoId:p.id, demo:!!p.demo, invitadoId:d.invitadoId || null, autor:inv ? inv.razonSocial : (d.autor || 'Sin identificar'),
      texto:String(d.texto).trim(), referencia:String(d.referencia||'').trim(), origen:d.origen || 'correo', archivo:d.archivo || '', recibida:ahora,
      extemporanea:new Date(ahora).getTime() > instante(p, 'preguntas'), respuesta:'', estado:'pendiente', publicadaEn:null };
    await Almacen.poner('preguntas', q);
    await Auditoria.registrar('registrar', 'pregunta', q.autor + ' · ' + q.texto.slice(0, 80) + (q.extemporanea ? ' · después del plazo' : ''), p.id);
    return q;
  }
  /** Archivo ARKEN-PREGUNTAS de ARKEN OFERTA: se asigna al invitado por su código. */
  async function importarArchivo(p, file){
    const o = Adendas.leerPreguntas(await file.text(), p.codigo);
    const inv = Modelo.invitados(p.id).find(i => i.codigoInvitacion === (o.invitado||{}).codigoInvitacion);
    if (!inv) throw new Error('El código de invitación del archivo (' + ((o.invitado||{}).codigoInvitacion || '—') + ') no es de ningún invitado de este proceso.');
    const ya = new Set(preguntas(p.id).filter(q => q.invitadoId === inv.id).map(q => Util.normaliza(q.texto)));
    let n = 0;
    for (const x of o.preguntas){
      if (!String(x.texto||'').trim() || ya.has(Util.normaliza(x.texto))) continue;
      await registrar(p, { invitadoId:inv.id, texto:x.texto, referencia:x.referencia, origen:'archivo', archivo:file.name, recibida:o.generado });
      n++;
    }
    return { invitado:inv, nuevas:n, total:o.preguntas.length };
  }
  async function responder(q, respuesta){
    Permisos.exigir('gestionarPreguntas');
    if (q.publicadaEn) throw new Error('Esta pregunta ya se publicó en el documento de respuestas N.º ' + q.publicadaEn + '.');
    await Almacen.poner('preguntas', Object.assign(Util.copia(q), { respuesta:String(respuesta||'').trim(), estado:String(respuesta||'').trim() ? 'respondida' : 'pendiente' }));
  }
  /** Documento de respuestas N: firmado, sin autores. Devuelve { json, pdf, nombreJson, nombrePdf }. */
  async function publicarRespuestas(p, ids){
    Permisos.exigir('gestionarPreguntas');
    const qs = preguntas(p.id).filter(q => ids.indexOf(q.id) >= 0 && q.estado === 'respondida' && !q.publicadaEn);
    if (!qs.length) throw new Error('Marque al menos una pregunta respondida y sin publicar.');
    const ll = await Paquetes.llavesAbiertas(p, 'Firma del documento de respuestas');
    const numero = documentosRespuestas(p.id).length + 1;
    const fecha = new Date().toISOString();
    const items = qs.map((q, i) => ({ numero:i + 1, pregunta:q.texto, respuesta:q.respuesta, referencia:q.referencia }));
    const o = await Adendas.firmar(Adendas.archivoRespuestas({ proceso:p.codigo, numero, versionPliego:Modelo.versionVigente(p), fecha, items }), ll.firma);
    const json = JSON.stringify(o, null, 1);
    const pdf = Pdf.generar({ titulo:'', documento:'Respuestas N.º ' + numero + ' · ' + p.codigo, lineaIzquierda:'Proceso: ' + p.codigo + ' · ' + p.nombre, marcaAgua:p.demo ? 'DEMOSTRACIÓN' : '',
      bloques:Actas.respuestas({ proceso:p, empresa:S.empresa, numero, fecha, items }) }).blob;
    const sha256Json = await Cripto.sha256(json), sha256Pdf = await Archivos.huella(pdf);
    await Almacen.ponerArchivo(sha256Json, new Blob([json], { type:'application/json' }));
    await Almacen.ponerArchivo(sha256Pdf, pdf);
    await Almacen.poner('actas', { id:Util.uid('ac'), procesoId:p.id, demo:!!p.demo, tipo:'respuestas', numero, fecha, usuario:Sesion.usuario.usuario, preguntas:qs.map(q => q.id), sha256Json, sha256Pdf, inmutable:true });
    for (const q of qs) await Almacen.poner('preguntas', Object.assign(Util.copia(q), { estado:'publicada', publicadaEn:numero }));
    await Auditoria.registrar('publicar', 'documento de respuestas', 'N.º ' + numero + ' · ' + qs.length + ' respuesta(s) · ' + sha256Json, p.id);
    return { json, pdf, nombreJson:Adendas.nombreRespuestas(p.codigo, numero), nombrePdf:'Respuestas_' + Util.codigoArchivo(p.codigo) + '_' + String(numero).padStart(2,'0') + '.pdf' };
  }

  /* ── Adendas ── */
  function puedeIniciarAdenda(p){
    if (!p.emitido) return 'El proceso aún no se ha emitido: los cambios se hacen directamente.';
    if (p.adendaEnCurso) return 'Ya hay una adenda en preparación.';
    if (p.estado !== 'emitido') return 'El proceso está ' + p.estado + ': ya no admite adendas.';
    return '';
  }
  /** Crea la versión n+1 del presupuesto y las condiciones, y abre el proceso para editarla. */
  async function iniciarAdenda(p){
    Permisos.exigir('emitirAdenda');
    const no = puedeIniciarAdenda(p); if (no) throw new Error(no);
    const n = p.versionPliego, numero = adendas(p.id).length + 1;
    const pres = Util.copia(Modelo.presupuesto(p.id, n));
    await Almacen.poner('presupuestosBase', Object.assign(pres, { id:p.id + '@' + (n + 1), version:n + 1, congelado:false }));
    await Almacen.poner('requisitos', { id:p.id + '@' + (n + 1), procesoId:p.id, version:n + 1, demo:!!p.demo, lista:Util.copia(Modelo.requisitosVersion(p.id, n)) });
    p.adendaEnCurso = { numero, versionAnterior:n, iniciada:new Date().toISOString(), usuario:Sesion.usuario.usuario,
      antes:{ cronograma:Util.copia(p.cronograma), general:Util.copia(p.general), pliego:Util.copia(p.pliego), presupuestoOficialVisible:p.presupuestoOficialVisible,
        documentos:Modelo.documentos(p.id, true).map(d => ({ id:d.id, vigente:d.vigente !== false })) } };
    p.versionPliego = n + 1;
    p.pliego = { generado:null, revisado:false };
    await Modelo.guardarProceso(p, 'Adenda ' + numero + ' en preparación (versión ' + (n + 1) + ')');
  }
  /** Deshace la adenda en preparación: vuelve todo como estaba en la versión n. */
  async function descartarAdenda(p){
    Permisos.exigir('emitirAdenda');
    const a = p.adendaEnCurso; if (!a) return;
    await Almacen.borrar('presupuestosBase', p.id + '@' + p.versionPliego);
    await Almacen.borrar('requisitos', p.id + '@' + p.versionPliego);
    const antes = new Map(a.antes.documentos.map(d => [d.id, d]));
    for (const d of Modelo.documentos(p.id, true)){
      if (!antes.has(d.id)) await Almacen.borrar('documentosProceso', d.id);
      else if ((d.vigente !== false) !== antes.get(d.id).vigente) await Almacen.poner('documentosProceso', Object.assign(Util.copia(d), { vigente:antes.get(d.id).vigente }));
    }
    Object.assign(p, { cronograma:a.antes.cronograma, general:a.antes.general, pliego:a.antes.pliego, presupuestoOficialVisible:a.antes.presupuestoOficialVisible, versionPliego:a.versionAnterior, adendaEnCurso:null });
    await Modelo.guardarProceso(p, 'Adenda ' + a.numero + ' descartada');
  }
  /** Pliego de la versión anterior, tal como lo recibieron los invitados (sin invitado). */
  function pliegoAnterior(p){
    const a = p.adendaEnCurso;
    const docs = new Set(a.antes.documentos.filter(d => d.vigente).map(d => d.id));
    const prev = Object.assign({}, p, { versionPliego:a.versionAnterior, cronograma:a.antes.cronograma, general:a.antes.general, presupuestoOficialVisible:a.antes.presupuestoOficialVisible });
    return Paquete.pliego({ proceso:prev, empresa:S.empresa, presupuesto:Modelo.presupuesto(p.id, a.versionAnterior), requisitos:Modelo.requisitosVersion(p.id, a.versionAnterior),
      documentos:Modelo.documentos(p.id, true).filter(d => docs.has(d.id)).map(d => Object.assign({}, d, { vigente:true })), llaves:Modelo.llaves(p.id), invitado:{},
      etapa:'completo', huellaPliegoPdf:((a.antes.pliego||{}).generado||{}).sha256 || '', nombrePliegoPdf:((a.antes.pliego||{}).generado||{}).nombre || '' });
  }
  /** Lo que la adenda cambia, para mostrarlo antes de emitirla. */
  function vistaPrevia(p){
    const antes = pliegoAnterior(p), despues = Paquetes.pliegoDe(p, {}, 'completo');
    const dif = Adendas.diferencias(antes, despues);
    return { antes, despues, dif, soloProrroga:Adendas.soloProrroga(dif, antes, despues) };
  }
  async function emitirAdenda(p, motivo){
    Permisos.exigir('emitirAdenda');
    const a = p.adendaEnCurso; if (!a) throw new Error('No hay una adenda en preparación.');
    if (!String(motivo||'').trim()) throw new Error('Escriba el motivo de la adenda.');
    if (!Modelo.pliegoVigente(p) || !p.pliego.revisado) throw new Error('Genere el pliego de la versión ' + p.versionPliego + ' y márquelo como revisado (módulo 07 › Pliego).');
    const v = vistaPrevia(p);
    if (!v.dif.lista.length) throw new Error('La adenda no cambia nada del pliego.');
    const plazo = (h => h && h.fecha ? new Date(Cronograma.instante(h)).getTime() : NaN)(Cronograma.hito(a.antes.cronograma, 'adendas'));
    if (Date.now() > plazo && !v.soloProrroga) throw new Error('El plazo de adendas venció el ' + Util.fmtSello(plazo) + '. Después del plazo solo se admite una adenda que prorrogue el cierre.');
    const probl = Cronograma.validar(p.cronograma).filter(x => !x.aviso);
    if (probl.length) throw new Error('El cronograma nuevo tiene problemas: ' + probl.map(x => x.msg).join(' '));
    const ll = await Paquetes.llavesAbiertas(p, 'Firma de la adenda ' + a.numero);
    const fecha = new Date().toISOString();
    const despues = Paquetes.pliegoDe(p, {}, 'completo');
    despues.adendas = despues.adendas.concat([{ numero:a.numero, version:p.versionPliego, fecha }]);
    const o = await Adendas.firmar(Adendas.archivoAdenda({ proceso:p.codigo, numero:a.numero, versionAnterior:a.versionAnterior, versionNueva:p.versionPliego, fecha,
      motivo, soloProrroga:v.soloProrroga, cambios:v.dif.lista, huellaPliegoPdf:p.pliego.generado.sha256, pliego:despues }), ll.firma);
    const json = JSON.stringify(o);
    const pdf = Pdf.generar({ titulo:'', documento:'Adenda N.º ' + a.numero + ' · ' + p.codigo, lineaIzquierda:'Proceso: ' + p.codigo + ' · ' + p.nombre, marcaAgua:p.demo ? 'DEMOSTRACIÓN' : '',
      bloques:Actas.adenda({ proceso:p, empresa:S.empresa, numero:a.numero, versionAnterior:a.versionAnterior, versionNueva:p.versionPliego, fecha, motivo, cambios:v.dif.lista, huellaPliegoPdf:p.pliego.generado.sha256 }) }).blob;
    const sha256Json = await Cripto.sha256(json), sha256Pdf = await Archivos.huella(pdf);
    await Almacen.ponerArchivo(sha256Json, new Blob([json], { type:'application/json' }));
    await Almacen.ponerArchivo(sha256Pdf, pdf);
    const pres = Modelo.presupuesto(p.id); pres.congelado = true; await Almacen.poner('presupuestosBase', pres);
    const req = (S.requisitos||[]).find(x => x.procesoId === p.id && x.version === p.versionPliego); req.congelado = true; await Almacen.poner('requisitos', req);
    await Almacen.poner('adendas', { id:Util.uid('ad'), procesoId:p.id, demo:!!p.demo, numero:a.numero, versionAnterior:a.versionAnterior, versionNueva:p.versionPliego, fecha, motivo,
      soloProrroga:v.soloProrroga, cambios:v.dif.lista, usuario:Sesion.usuario.usuario, sha256Json, sha256Pdf });
    p.emitido = { fecha, usuario:Sesion.usuario.usuario, version:p.versionPliego, huellaPliego:p.pliego.generado.sha256, primeraEmision:(p.emitido||{}).primeraEmision || (p.emitido||{}).fecha };
    p.adendaEnCurso = null;
    await Modelo.guardarProceso(p, 'Adenda ' + a.numero + ' emitida · versión ' + p.versionPliego + ' · ' + sha256Json);
    await Auditoria.registrar('emitir', 'adenda', 'N.º ' + a.numero + ' · versión ' + a.versionAnterior + ' → ' + p.versionPliego + (v.soloProrroga ? ' · solo prórroga' : '') + ' · ' + v.dif.lista.length + ' cambio(s)', p.id);
    return { json, pdf, nombreJson:Adendas.nombreAdenda(p.codigo, a.numero), nombrePdf:'Adenda_' + Util.codigoArchivo(p.codigo) + '_' + String(a.numero).padStart(2,'0') + '.pdf', cambios:v.dif.lista };
  }
  async function descargar(sha256, nombre){ return Archivos.descargar(sha256, nombre); }

  return { preguntas, documentosRespuestas, adendas, registrar, importarArchivo, responder, publicarRespuestas,
    puedeIniciarAdenda, iniciarAdenda, descartarAdenda, pliegoAnterior, vistaPrevia, emitirAdenda, descargar };
})();
