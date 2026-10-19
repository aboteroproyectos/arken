/* ─────────────── Fase 2 en el principal ───────────────
   07 › Paquetes y envío, 08 · Preguntas y adendas, 09 · Recepción y
   apertura, 10 · Documentos de proponentes. Las vistas solo pintan y llaman
   a Paquetes, Consultas y Recepcion, que validan y escriben. */

/** Un aviso con los archivos recién generados, para descargarlos. */
function avisoArchivos(titulo, texto, archivos){
  const m = UI.modal({ titulo, ancho:'', cuerpo:'<p>' + texto + '</p><div class="btn-row">' + archivos.map((a, i) => '<button class="btn' + (i ? '' : ' primary') + '" type="button" data-arch="' + i + '">Descargar ' + esc(a.nombre) + '</button>').join('') + '</div>',
    botones:[{ texto:'Cerrar' }] });
  $$('[data-arch]', m.el).forEach(b => b.onclick = () => { const a = archivos[+b.dataset.arch]; UI.descargar(a.nombre, a.blob, a.tipo); });
  archivos.filter(a => a.automatico).forEach(a => UI.descargar(a.nombre, a.blob, a.tipo));
}

/* ── 07 › Paquetes y envío ── */
function vistaPaquetes(p){
  if (!p.emitido) return '<div class="nota warn">Los paquetes se generan después de emitir el proceso (pestaña «Revisión y emisión»).</div>';
  const puede = Permisos.puede('emitir');
  const lista = Modelo.invitados(p.id).filter(i => i.estado !== 'retirado');
  const ad = Consultas.adendas(p.id), resp = Consultas.documentosRespuestas(p.id);
  const filas = lista.map(i => {
    const et = Paquetes.etapa(p, i);
    const ult = (i.paquetesEmitidos||[]).slice(-1)[0];
    const desact = ult && et === 'completo' && (ult.etapa !== 'completo' || ult.version < p.versionPliego);
    return '<tr><td><b>' + esc(i.razonSocial) + '</b>' + etiquetaDemo(i) + '<div class="small muted">' + esc((i.contacto||{}).correo || '') + '</div></td><td class="num">' + esc(i.codigoInvitacion) + '</td>' +
      '<td>' + UI.tag(et === 'confidencialidad' ? 'solo acuerdo' : 'completo', et === 'confidencialidad' ? 'warn' : 'info') + '</td>' +
      '<td class="small">' + (ult ? (ult.etapa === 'confidencialidad' ? 'Acuerdo' : 'Completo') + ' v' + ult.version + ' · ' + Util.fmtSello(ult.fecha) + '<div class="huella">' + esc(ult.sha256) + '</div>' : '<span class="muted">Ninguno</span>') +
        (desact ? ' ' + UI.tag('le toca uno nuevo', 'warn') : '') + '</td><td class="small">' + (i.envios||[]).length + '</td><td class="act">' +
      (puede ? boton('generar-paq', 'Generar y descargar', 'xs primary', ' data-id="' + i.id + '"') + ' ' : '') +
      (ult ? boton('correo-paq', 'Correo', 'xs', ' data-id="' + i.id + '"') + ' ' + boton('enviado-paq', 'Registrar envío', 'xs ghost', ' data-id="' + i.id + '"') : '') + '</td></tr>';
  }).join('');
  return (p.adendaEnCurso ? '<div class="nota warn">Hay una adenda en preparación (módulo 08). Los paquetes se generan cuando se emita o se descarte.</div>' : '') +
    '<div class="card"><div class="card-head"><h3>Un paquete por invitado</h3>' + (puede && lista.length ? boton('generar-todos', 'Generar todos', 'sm') : '') + '</div><div class="card-body flush">' +
    (filas ? '<div class="tw scroll"><table class="t"><thead><tr><th>Invitado</th><th>Código</th><th>Le toca</th><th>Último paquete</th><th>Envíos</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : UI.vacio('No hay invitados', 'Regístrelos en el módulo 06.')) + '</div></div>' +
    '<p class="small muted">Cada paquete es un ZIP con ARKEN OFERTA (con el pliego de ese invitado adentro), LEAME_PRIMERO.pdf, el acuerdo de confidencialidad' +
      ((p.confidencialidad||{}).envios === 'uno' ? '' : ' y, cuando el acuerdo firmado está verificado,') + ' el pliego en PDF y los documentos vigentes, todo con su huella en un manifiesto firmado con la llave del proceso. ' +
      'Ningún paquete lleva precios del presupuesto base. El programa prepara el correo; usted lo envía desde su cuenta.</p>' +
    (ad.length || resp.length ? '<div class="card"><div class="card-head"><h3>Para enviar a todos los invitados</h3></div><div class="card-body small">' +
      ad.map(a => '<div>Adenda N.º ' + a.numero + ' (versión ' + a.versionNueva + ') · ' + Util.fmtSello(a.fecha) + ' ' + boton('bajar-arch', 'Archivo para ARKEN OFERTA', 'xs', ' data-sha="' + a.sha256Json + '" data-nombre="' + esc(Adendas.nombreAdenda(p.codigo, a.numero)) + '"') + ' ' +
        boton('bajar-arch', 'PDF', 'xs ghost', ' data-sha="' + a.sha256Pdf + '" data-nombre="Adenda_' + esc(Util.codigoArchivo(p.codigo)) + '_' + String(a.numero).padStart(2, '0') + '.pdf"') + '</div>').join('') +
      resp.map(r => '<div>Respuestas N.º ' + r.numero + ' · ' + Util.fmtSello(r.fecha) + ' ' + boton('bajar-arch', 'Archivo para ARKEN OFERTA', 'xs', ' data-sha="' + r.sha256Json + '" data-nombre="' + esc(Adendas.nombreRespuestas(p.codigo, r.numero)) + '"') + ' ' +
        boton('bajar-arch', 'PDF', 'xs ghost', ' data-sha="' + r.sha256Pdf + '" data-nombre="Respuestas_' + esc(Util.codigoArchivo(p.codigo)) + '_' + String(r.numero).padStart(2, '0') + '.pdf"') + '</div>').join('') + '</div></div>' : '');
}
function accionesPaquetes(p){
  const buscar = id => Modelo.invitados(p.id).find(i => i.id === id);
  async function uno(inv){
    UI.toast('Armando el paquete de ' + inv.razonSocial + '…');
    const r = await Paquetes.generar(p, inv);
    UI.descargar(r.nombre, r.blob);
    return r;
  }
  async function registrarEnvio(inv, medio){
    const i = Util.copia(buscar(inv.id));
    const ult = (i.paquetesEmitidos||[]).slice(-1)[0] || {};
    i.envios = (i.envios||[]).concat([{ fecha:Util.hoyISO(), medio:medio || 'correo electrónico', que:ult.etapa === 'confidencialidad' ? 'acuerdo de confidencialidad' : 'paquete de invitación',
      quien:Sesion.usuario.nombre || Sesion.usuario.usuario, nota:ult.nombre || '', registrado:new Date().toISOString(), usuario:Sesion.usuario.usuario }]);
    if (ult.etapa === 'confidencialidad' && (i.confidencialidad||{}).estado === 'pendiente') i.confidencialidad = Object.assign({}, i.confidencialidad, { estado:'enviado', enviado:Util.hoyISO() });
    await Modelo.guardarInvitado(i, 'envío de ' + (ult.nombre || 'paquete'));
  }
  return {
    'generar-paq':async b => { const r = await uno(buscar(b.dataset.id)); UI.toast('Paquete ' + r.nombre + ' descargado', 'ok'); App.render(); },
    'generar-todos':async () => {
      const lista = Modelo.invitados(p.id).filter(i => i.estado !== 'retirado');
      if (!(await UI.confirmar({ titulo:'Generar todos los paquetes', mensaje:'Se generan y descargan ' + lista.length + ' paquete(s), uno por invitado, cada uno con su código. El navegador puede pedirle permiso para descargar varios archivos.', textoAceptar:'Generar' }))) return;
      let n = 0;
      for (const i of lista){ await uno(i); n++; }
      UI.toast(n + ' paquete(s) generados', 'ok'); App.render();
    },
    'correo-paq':b => { const i = buscar(b.dataset.id); const ult = i.paquetesEmitidos.slice(-1)[0]; Paquetes.abrirCorreo(Paquetes.correo(p, i, ult.nombre, ult.etapa)); },
    'enviado-paq':async b => {
      const i = buscar(b.dataset.id);
      if (!(await UI.confirmar({ titulo:'Registrar envío', mensaje:'Se registra que hoy se envió a ' + i.razonSocial + ' el paquete ' + i.paquetesEmitidos.slice(-1)[0].nombre + ' por correo electrónico.', textoAceptar:'Registrar' }))) return;
      await registrarEnvio(i); App.render();
    },
    'bajar-arch':b => Archivos.descargar(b.dataset.sha, b.dataset.nombre)
  };
}

/* ─────────────── 08 · Preguntas y adendas ─────────────── */
Vistas['08'] = function(){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso('08', 'Preguntas y adendas') };
  const tab = UI.pestanaActiva('pa', 'preguntas');
  const html = cabecera('08', 'Preguntas y adendas', esc(p.codigo) + ' · versión ' + p.versionPliego + ' del pliego' + etiquetaDemo(p)) +
    (p.emitido ? '' : '<div class="nota warn">El proceso aún no se ha emitido: no hay invitados con el pliego, ni preguntas ni adendas.</div>') +
    UI.pestanas('pa', [['preguntas','Preguntas y respuestas'],['adendas','Adendas']], 'preguntas') + (tab === 'adendas' ? vistaAdendas(p) : vistaPreguntas(p));
  return { html, acciones:Object.assign(accionesPreguntas(p), accionesAdendas(p), accionesPaquetes(p)) };
};
function vistaPreguntas(p){
  const ed = Permisos.puede('gestionarPreguntas') && !!p.emitido;
  const L = Consultas.preguntas(p.id);
  const plazo = Cronograma.hito(p.cronograma, 'preguntas');
  const filas = L.map((q, k) => '<tr><td>' + (ed && q.estado === 'respondida' ? '<input type="checkbox" data-pub="' + q.id + '" aria-label="Publicar la pregunta ' + (k + 1) + '">' : '') + '</td><td class="num">' + (k + 1) + '</td>' +
    '<td><b>' + esc(q.autor) + '</b><div class="small muted">' + Util.fmtSello(q.recibida) + ' · ' + esc(q.origen) + '</div>' + (q.extemporanea ? UI.tag('después del plazo', 'warn') : '') + '</td>' +
    '<td>' + esc(q.texto) + (q.referencia ? '<div class="small muted">' + esc(q.referencia) + '</div>' : '') + '</td>' +
    '<td>' + (q.publicadaEn ? esc(q.respuesta) : '<textarea rows="3" data-resp="' + q.id + '"' + (ed ? '' : ' disabled') + ' aria-label="Respuesta a la pregunta ' + (k + 1) + '">' + esc(q.respuesta) + '</textarea>') + '</td>' +
    '<td>' + UI.tag(q.publicadaEn ? 'publicada en N.º ' + q.publicadaEn : q.estado, q.publicadaEn ? 'ok' : q.estado === 'respondida' ? 'info' : 'warn') + '</td>' +
    '<td class="act">' + (ed && !q.publicadaEn ? boton('guardar-resp', 'Guardar', 'xs', ' data-id="' + q.id + '"') : '') + '</td></tr>').join('');
  const docs = Consultas.documentosRespuestas(p.id);
  return '<div class="card"><div class="card-head"><h3>' + L.length + ' pregunta(s)</h3><div class="btn-row">' +
      (ed ? boton('importar-preguntas', 'Importar archivo de ARKEN OFERTA', 'sm') + boton('nueva-pregunta', '+ Pregunta recibida por correo', 'sm') + boton('publicar-resp', 'Publicar las marcadas', 'sm primary') : '') + '</div></div><div class="card-body flush">' +
    (filas ? '<div class="tw scroll"><table class="t"><thead><tr><th></th><th>N.º</th><th>Quién pregunta</th><th>Pregunta</th><th>Respuesta</th><th>Estado</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : UI.vacio('Sin preguntas', 'Las preguntas llegan en el archivo ARKEN-PREGUNTAS que genera ARKEN OFERTA, o por correo.')) + '</div></div>' +
    '<p class="small muted">Plazo para preguntas: ' + (plazo && plazo.fecha ? Util.fmtFecha(plazo.fecha) + ' ' + esc(plazo.hora || '') : 'sin fecha') + '. El documento de respuestas sale numerado y firmado, <b>sin decir quién preguntó</b>, y es el mismo para todos los invitados. Si una respuesta cambia el pliego, haga además una adenda.</p>' +
    (docs.length ? '<div class="card"><div class="card-head"><h3>Documentos de respuestas publicados</h3></div><div class="card-body small">' + docs.map(r => '<div>N.º ' + r.numero + ' · ' + Util.fmtSello(r.fecha) + ' · ' + r.preguntas.length + ' respuesta(s) ' +
      boton('bajar-arch', 'Archivo para ARKEN OFERTA', 'xs', ' data-sha="' + r.sha256Json + '" data-nombre="' + esc(Adendas.nombreRespuestas(p.codigo, r.numero)) + '"') + ' ' +
      boton('bajar-arch', 'PDF', 'xs ghost', ' data-sha="' + r.sha256Pdf + '" data-nombre="Respuestas_' + esc(Util.codigoArchivo(p.codigo)) + '_' + String(r.numero).padStart(2, '0') + '.pdf"') + '</div>').join('') + '</div></div>' : '');
}
function accionesPreguntas(p){
  const buscar = id => Consultas.preguntas(p.id).find(q => q.id === id);
  return {
    'importar-preguntas':async () => {
      const fs = await UI.elegirArchivos('.json', true);
      const msgs = [];
      for (const f of fs){
        try { const r = await Consultas.importarArchivo(p, f); msgs.push(f.name + ': ' + r.nuevas + ' pregunta(s) nueva(s) de ' + r.invitado.razonSocial + (r.total > r.nuevas ? ' (' + (r.total - r.nuevas) + ' ya estaban)' : '') + '.'); }
        catch(e){ msgs.push(f.name + ': ' + e.message); }
      }
      if (msgs.length) UI.aviso('Preguntas importadas', '<ul>' + msgs.map(m => '<li>' + esc(m) + '</li>').join('') + '</ul>');
      App.render();
    },
    'nueva-pregunta':async () => {
      const inv = Modelo.invitados(p.id).filter(i => i.estado !== 'retirado');
      const v = await UI.pedir({ titulo:'Pregunta recibida por correo', campos:[
        { k:'invitadoId', lab:'Quién pregunta', tipo:'select', c2:true, opts:inv.map(i => ({ v:i.id, n:i.razonSocial })).concat([{ v:'', n:'Otro (sin identificar)' }]) },
        { k:'fecha', lab:'Fecha de recibo', tipo:'date', val:Util.hoyISO() }, { k:'hora', lab:'Hora de recibo', tipo:'time', val:new Date().toTimeString().slice(0, 5) },
        { k:'texto', lab:'Pregunta', tipo:'textarea', filas:4, c2:true }, { k:'referencia', lab:'Referencia en el pliego (opcional)', c2:true }],
        validar:z => !z.texto ? 'Escriba la pregunta.' : '' });
      if (!v) return;
      await Consultas.registrar(p, { invitadoId:v.invitadoId, texto:v.texto, referencia:v.referencia, origen:'correo', recibida:Cronograma.instante({ fecha:v.fecha, hora:v.hora || '00:00' }) });
      App.render();
    },
    'guardar-resp':async b => { const t = $('[data-resp="' + b.dataset.id + '"]'); await Consultas.responder(buscar(b.dataset.id), t.value); UI.toast('Respuesta guardada', 'ok'); App.render(); },
    'publicar-resp':async () => {
      const ids = $$('[data-pub]').filter(x => x.checked).map(x => x.dataset.pub);
      if (!ids.length) throw new Error('Marque las preguntas respondidas que va a publicar.');
      if (!(await UI.confirmar({ titulo:'Publicar respuestas', mensaje:'Se genera el documento de respuestas N.º ' + (Consultas.documentosRespuestas(p.id).length + 1) + ' con ' + ids.length + ' pregunta(s), sin el nombre de quien preguntó, firmado con la llave del proceso. Después no se puede cambiar.', textoAceptar:'Publicar' }))) return;
      const r = await Consultas.publicarRespuestas(p, ids);
      App.render();
      avisoArchivos('Respuestas publicadas', 'Envíe los dos archivos a todos los invitados. El archivo .json lo importa ARKEN OFERTA en «Preguntas y adendas».',
        [{ nombre:r.nombreJson, blob:new Blob([r.json], { type:'application/json' }) }, { nombre:r.nombrePdf, blob:r.pdf }]);
    }
  };
}
function vistaAdendas(p){
  const ed = Permisos.puede('emitirAdenda');
  const L = Consultas.adendas(p.id), a = p.adendaEnCurso;
  const plazo = Cronograma.hito(a ? a.antes.cronograma : p.cronograma, 'adendas');
  const vencido = plazo && plazo.fecha && Date.now() > new Date(Cronograma.instante(plazo)).getTime();
  let curso = '';
  if (a){
    let v = null; try { v = Consultas.vistaPrevia(p); } catch(e){ RegistroTecnico.anotar('vista previa adenda', e); }
    curso = '<div class="card"><div class="card-head"><h3>Adenda N.º ' + a.numero + ' en preparación</h3>' + UI.tag('versión ' + a.versionAnterior + ' → ' + p.versionPliego, 'warn') + '</div><div class="card-body">' +
      '<p class="small">Edite lo que cambia en los módulos 02 (presupuesto), 04 (condiciones), 05 (documentos) y 07 (cronograma y condiciones generales), como antes de emitir. Luego genere el pliego de la versión ' + p.versionPliego + ' y márquelo como revisado.</p>' +
      (v ? (v.dif.lista.length ? '<div class="nota"><b>' + v.dif.lista.length + ' cambio(s) frente a la versión ' + a.versionAnterior + (v.soloProrroga ? ' (solo prórroga del cierre)' : '') + ':</b><ul>' + v.dif.lista.slice(0, 30).map(x => '<li>' + esc(x) + '</li>').join('') +
        (v.dif.lista.length > 30 ? '<li>y ' + (v.dif.lista.length - 30) + ' más</li>' : '') + '</ul></div>' : '<div class="nota warn">Todavía no cambia nada del pliego.</div>') : '') +
      itemChk(Modelo.pliegoVigente(p) && p.pliego.revisado, 'Pliego de la versión ' + p.versionPliego + ' generado y revisado (módulo 07 › Pliego)') +
      (vencido ? '<div class="nota bad">El plazo de adendas venció el ' + Util.fmtFecha(plazo.fecha) + ' ' + esc(plazo.hora || '') + ': solo se puede emitir si lo único que cambia es la fecha de cierre (prórroga).</div>' : '') +
      '<div class="btn-row" style="margin-top:12px">' + (ed ? boton('emitir-adenda', 'Emitir la adenda', 'primary') + boton('descartar-adenda', 'Descartar la adenda', 'danger') : '') + boton('ir-07', 'Ir al pliego', '', ' data-pestana-ir="pliego"') + '</div></div></div>';
  }
  const no = Consultas.puedeIniciarAdenda(p);
  return curso + (!a ? '<div class="card"><div class="card-head"><h3>Nueva adenda</h3></div><div class="card-body"><p class="small">Una adenda crea la versión ' + (p.versionPliego + 1) + ' del pliego: abre el proceso para editarlo, y al emitirla se firma un archivo con la lista de cambios y el pliego nuevo. ARKEN OFERTA lo importa sin perder lo diligenciado y marca para revisar lo que cambió.</p>' +
      (vencido ? '<p class="small"><b>El plazo de adendas ya venció:</b> solo se admite prorrogar el cierre.</p>' : '') +
      (ed && !no ? boton('iniciar-adenda', 'Preparar la adenda N.º ' + (L.length + 1), 'primary') : '<p class="small muted">' + esc(no || 'Pueden emitir adendas: ' + Roles.quienPuede('emitirAdenda').join(', ') + '.') + '</p>') + '</div></div>' : '') +
    '<div class="card"><div class="card-head"><h3>' + L.length + ' adenda(s) emitida(s)</h3></div><div class="card-body flush">' +
    (L.length ? '<div class="tw"><table class="t"><thead><tr><th>N.º</th><th>Fecha</th><th>Versión</th><th>Motivo</th><th>Cambios</th><th></th></tr></thead><tbody>' + L.map(x => '<tr><td class="num">' + x.numero + '</td><td class="small">' + Util.fmtSello(x.fecha) + '</td><td>' + x.versionAnterior + ' → ' + x.versionNueva + '</td>' +
      '<td>' + esc(x.motivo) + (x.soloProrroga ? ' ' + UI.tag('prórroga', 'info') : '') + '</td><td class="small">' + x.cambios.length + '</td><td class="act">' +
      boton('ver-cambios', 'Cambios', 'xs', ' data-id="' + x.id + '"') + ' ' + boton('bajar-arch', 'Archivo', 'xs', ' data-sha="' + x.sha256Json + '" data-nombre="' + esc(Adendas.nombreAdenda(p.codigo, x.numero)) + '"') + ' ' +
      boton('bajar-arch', 'PDF', 'xs ghost', ' data-sha="' + x.sha256Pdf + '" data-nombre="Adenda_' + esc(Util.codigoArchivo(p.codigo)) + '_' + String(x.numero).padStart(2, '0') + '.pdf"') + '</td></tr>').join('') + '</tbody></table></div>'
      : UI.vacio('Sin adendas', 'El pliego vigente es la versión ' + p.versionPliego + '.')) + '</div></div>';
}
function accionesAdendas(p){
  return {
    'ir-07':b => { if (b.dataset.pestanaIr) Sesion.pestanas.emi = b.dataset.pestanaIr; App.ir('07'); },
    'iniciar-adenda':async () => {
      if (!(await UI.confirmar({ titulo:'Preparar una adenda', mensaje:'Se crea la versión ' + (p.versionPliego + 1) + ' del pliego como copia de la ' + p.versionPliego + ' y el proceso se abre para editarla. Mientras tanto no se generan paquetes. Puede descartarla sin dejar rastro en el pliego.', textoAceptar:'Preparar' }))) return;
      await Consultas.iniciarAdenda(p); UI.toast('Adenda en preparación: edite la versión ' + p.versionPliego, 'ok'); App.render();
    },
    'descartar-adenda':async () => {
      if (!(await UI.confirmar({ titulo:'Descartar la adenda', mensaje:'Se pierden los cambios de la versión ' + p.versionPliego + ' y el proceso vuelve a la versión ' + p.adendaEnCurso.versionAnterior + '.', textoAceptar:'Descartar', claseAceptar:'danger' }))) return;
      await Consultas.descartarAdenda(p); App.render();
    },
    'emitir-adenda':async () => {
      const v = await UI.pedir({ titulo:'Emitir la adenda N.º ' + p.adendaEnCurso.numero, eyebrow:'Acción que no se puede deshacer', textoAceptar:'Emitir', ancho:'',
        antes:'<p class="small">La versión ' + p.versionPliego + ' queda congelada y es la vigente. Se firma el archivo de adenda para ARKEN OFERTA y su PDF.</p>',
        campos:[{ k:'motivo', lab:'Motivo de la adenda', tipo:'textarea', filas:3, c2:true }], validar:z => !z.motivo ? 'Escriba el motivo.' : '' });
      if (!v) return;
      const r = await Consultas.emitirAdenda(p, v.motivo);
      App.render();
      avisoArchivos('Adenda emitida', 'Envíe los dos archivos a todos los invitados (módulo 07 › Paquetes y envío). ARKEN OFERTA importa el .json en «Preguntas y adendas».',
        [{ nombre:r.nombreJson, blob:new Blob([r.json], { type:'application/json' }) }, { nombre:r.nombrePdf, blob:r.pdf }]);
    },
    'ver-cambios':b => { const x = Consultas.adendas(p.id).find(a => a.id === b.dataset.id);
      UI.aviso('Adenda N.º ' + x.numero, '<p>' + esc(x.motivo) + '</p><ul>' + x.cambios.map(c => '<li>' + esc(c) + '</li>').join('') + '</ul>', 'wide'); }
  };
}

/* ─────────────── 09 · Recepción y apertura ─────────────── */
Vistas['09'] = function(){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso('09', 'Recepción y apertura') };
  const tab = UI.pestanaActiva('rec', 'recepcion');
  const ap = Recepcion.actas(p.id, 'apertura')[0];
  /* En la demostración: cinco sobres cerrados de proponentes ficticios y el cierre adelantado, para seguir sin esperar. */
  const demo = p.demo && p.emitido && !ap && Permisos.puede('demostracion') && !Recepcion.cerrado(p);
  const html = cabecera('09', 'Recepción y apertura', esc(p.codigo) + ' · ' + esc(p.estado) + etiquetaDemo(p),
      (demo && !Recepcion.vigentes(p.id).length ? boton('demo-ofertas', 'Ofertas de demostración', 'sm') : '') + (demo && Recepcion.vigentes(p.id).length ? boton('demo-cierre', 'Adelantar el cierre (demostración)', 'sm') : '') +
      (Permisos.puede('recibirOfertas') && p.emitido && !ap ? boton('cargar-sobres', 'Cargar sobres', 'primary') : '')) +
    UI.pestanas('rec', [['recepcion','Recepción'],['apertura','Cierre y apertura'],['ofertas','Ofertas abiertas']], 'recepcion') +
    (tab === 'apertura' ? vistaCierre(p) : tab === 'ofertas' ? vistaOfertas(p) : vistaRecepcion(p));
  return { html, acciones:Object.assign(accionesRecepcion(p), {
    'demo-ofertas':async () => {
      if (!(await UI.confirmar({ titulo:'Ofertas de demostración', mensaje:'Se generan cinco sobres cerrados de proponentes ficticios (cada uno con un rasgo que el análisis debe encontrar: desbalance, valor bajo, documento vencido, el mismo profesional en dos ofertas y aritmética errada) y se reciben como cualquier sobre. Todo queda marcado como demostración y se borra con «Borrar la demostración».', textoAceptar:'Generar y recibir' }))) return;
      UI.toast('Generando los sobres de demostración…');
      const r = await DemoEvaluacion.recibirOfertas(p);
      UI.toast(r.filter(x => x.estado === 'recibido sellado').length + ' sobre(s) recibido(s)', 'ok'); App.render();
    },
    'demo-cierre':async () => {
      if (!(await UI.confirmar({ titulo:'Adelantar el cierre', mensaje:'Solo en la demostración: el cierre pasa a este momento, para generar el acta de cierre y abrir las ofertas sin esperar. Queda en la auditoría.', textoAceptar:'Adelantar' }))) return;
      await DemoEvaluacion.adelantarCierre(p); Sesion.pestanas.rec = 'apertura'; App.render();
    }
  }), alPintar:() => conectarZona(p) };
};
const ESTADO_SOBRE = { 'recibido sellado':'ok', 'recibido':'ok', reemplazado:'', rechazado:'bad', abierto:'info', 'no se pudo abrir':'bad' };
function vistaRecepcion(p){
  if (!p.emitido) return '<div class="nota warn">El proceso aún no se ha emitido.</div>';
  const L = Recepcion.sobres(p.id);
  const inv = Modelo.invitados(p.id).filter(i => i.estado !== 'retirado');
  const ci = Recepcion.cierre(p);
  const ap = Recepcion.actas(p.id, 'apertura').length;
  const filasInv = inv.map(i => {
    const s = L.filter(x => x.invitadoId === i.id && x.tipo === 'oferta' && x.estado !== 'rechazado' && x.estado !== 'reemplazado').slice(-1)[0];
    return '<tr><td><span class="pastilla" style="background:' + Recepcion.colorDe(p, i.id) + '"></span><b>' + esc(i.razonSocial) + '</b></td><td class="num">' + esc(i.codigoInvitacion) + '</td>' +
      '<td>' + UI.tag(ESTADOS_ACUERDO[(i.confidencialidad||{}).estado || 'pendiente'][0], (i.confidencialidad||{}).estado === 'verificado' ? 'ok' : '') + '</td>' +
      '<td>' + (s ? UI.tag(s.estado, ESTADO_SOBRE[s.estado]) + '<div class="small muted">' + esc(s.archivo) + '</div>' : '<span class="muted small">Sin sobre</span>') + '</td></tr>';
  }).join('');
  const filas = L.slice().reverse().map(s => {
    const i = inv.find(x => x.id === s.invitadoId) || Modelo.invitados(p.id).find(x => x.id === s.invitadoId);
    return '<tr><td class="small num">' + Util.fmtSello(s.recibido) + '</td><td>' + esc(s.archivo) + '<div class="huella">' + esc(s.sha256) + '</div></td><td>' + esc(i ? i.razonSocial : '—') + '</td>' +
      '<td class="small">' + (s.tipo === 'confidencialidad' ? 'Confidencialidad' : 'Oferta' + (s.cifrado ? ' · cerrado' : ' · sin cifrar')) + (s.versionPliego ? ' · v' + s.versionPliego : '') + (s.generado ? '<div class="muted">generado ' + Util.fmtSello(s.generado) + '</div>' : '') + '</td>' +
      '<td>' + UI.tag(s.estado, ESTADO_SOBRE[s.estado]) + (s.motivo ? '<div class="small bad-txt">' + esc(s.motivo) + '</div>' : '') + ((s.avisos||[]).length ? '<ul class="small">' + s.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') + '</td></tr>';
  }).join('');
  return '<div class="grid g4"><div class="stat"><div class="lab">Cierre</div><div class="val" style="font-size:15px">' + (ci ? Util.fmtSello(ci) : '—') + '</div><div class="foot">' + (Recepcion.cerrado(p) ? 'Cerrado' : 'Abierto para entregas') + '</div></div>' +
      '<div class="stat"><div class="lab">Sobres vigentes</div><div class="val">' + Recepcion.vigentes(p.id).length + '</div><div class="foot">Uno por proponente, sin abrir</div></div>' +
      '<div class="stat"><div class="lab">Archivos recibidos</div><div class="val">' + L.length + '</div><div class="foot">' + L.filter(s => s.estado === 'reemplazado').length + ' reemplazado(s)</div></div>' +
      '<div class="stat"><div class="lab">Rechazados</div><div class="val">' + L.filter(s => s.estado === 'rechazado').length + '</div><div class="foot">Con su motivo</div></div></div>' +
    (!ap && Permisos.puede('recibirOfertas') ? '<div class="zona-sobres" id="zonaSobres" tabindex="0" role="button" aria-label="Soltar aquí los sobres">Suelte aquí los sobres (.zip), todos a la vez, o <b>haga clic para elegirlos</b>.<div class="small muted">Cada sobre se asigna a su invitado por el código de invitación, no por el nombre del archivo. Nada se abre antes de la apertura.</div></div>' : '') +
    '<div class="grid g2"><div class="card"><div class="card-head"><h3>Invitados</h3></div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Proponente</th><th>Código</th><th>Acuerdo</th><th>Sobre</th></tr></thead><tbody>' + filasInv + '</tbody></table></div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Qué se comprueba al recibir</h3></div><div class="card-body small"><ul><li>Que sea un ZIP sano: sin rutas peligrosas, sin bombas de compresión, dentro del límite de tamaño.</li><li>Que sobre.json sea de este proceso y de un código de invitación registrado.</li>' +
      '<li>La huella del contenido y la versión del pliego (si es de una versión anterior, se recibe con aviso).</li><li>Que se haya generado antes del cierre. De cada invitado vale el último sobre generado; los anteriores quedan «reemplazado».</li></ul>' +
      '<p>El contenido (precios y documentos) se verifica en la apertura, porque antes está cifrado.</p></div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Archivos recibidos</h3></div><div class="card-body flush">' + (filas ? '<div class="tw scroll"><table class="t"><thead><tr><th>Recibido</th><th>Archivo</th><th>Proponente</th><th>Tipo</th><th>Estado</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : UI.vacio('Aún no llega ningún sobre', 'Los sobres los genera ARKEN OFERTA en el módulo 14 de cada invitado.')) + '</div></div>';
}
function vistaCierre(p){
  const ci = Recepcion.cierre(p), cerrado = Recepcion.cerrado(p);
  const ac = Recepcion.actas(p.id, 'cierre')[0], ap = Recepcion.actas(p.id, 'apertura')[0];
  const llaves = Modelo.llaves(p.id);
  const bajar = (a, n) => boton('bajar-arch', 'Descargar el acta', 'sm', ' data-sha="' + a.sha256Pdf + '" data-nombre="' + n + '"');
  const cod = esc(Util.codigoArchivo(p.codigo));
  return '<div class="grid g2"><div class="card"><div class="card-head"><h3>Acta de cierre</h3>' + (ac ? UI.tag('generada', 'ok') : '') + '</div><div class="card-body">' +
      (ac ? '<p class="small">Generada el ' + Util.fmtSello(ac.fecha) + ' por ' + esc(ac.usuario) + ' con ' + ac.sobres.length + ' archivo(s). <span class="huella">SHA-256 ' + esc(ac.sha256Pdf) + '</span></p>' + bajar(ac, 'Acta_de_cierre_' + cod + '.pdf')
        : !cerrado ? '<div class="nota">El cierre es el <b>' + Util.fmtSello(ci) + '</b> (hora de Colombia). Este equipo marca ' + Util.fmtSello(Date.now()) + '. El acta de cierre se genera a esa hora.</div>'
        : '<p class="small">La hora de cierre pasó. El acta deja la lista de sobres recibidos con su huella, sin abrir ninguno.</p>' + (Permisos.puede('recibirOfertas') ? boton('acta-cierre', 'Generar el acta de cierre', 'primary') : '')) +
    '</div></div><div class="card"><div class="card-head"><h3>Apertura</h3>' + (ap ? UI.tag('hecha', 'ok') : '') + '</div><div class="card-body">' +
      (ap ? '<p class="small">Hecha el ' + Util.fmtSello(ap.fecha) + ' con ' + ap.firmantes.map(f => esc(f.nombre)).join(' y ') + '. ' + ap.filas.length + ' oferta(s) abierta(s)' + (ap.rechazados.length ? ', ' + ap.rechazados.length + ' sin abrir' : '') + '. El acta es inmutable. <span class="huella">SHA-256 ' + esc(ap.sha256Pdf) + '</span></p>' + bajar(ap, 'Acta_de_apertura_' + cod + '.pdf')
        : '<p class="small">La apertura exige, al mismo tiempo:</p>' + itemChk(cerrado, 'La hora de cierre (' + esc(Util.fmtSello(ci)) + ')') + itemChk(!!ac, 'El acta de cierre') +
          itemChk(!!llaves, 'La frase del proceso, que abre su llave privada') + itemChk((S.usuarios||[]).filter(u => u.activo !== false && (u.roles||[]).indexOf('comite') >= 0).length >= 2, 'Dos miembros del comité, que se autentican en el momento con su usuario y contraseña') +
          '<div class="btn-row" style="margin-top:12px">' + (Permisos.puede('abrirOfertas') ? '<button class="btn primary" type="button" data-accion="abrir-ofertas"' + (cerrado && ac ? '' : ' disabled') + '>Abrir los ' + Recepcion.vigentes(p.id).length + ' sobre(s)</button>' : '') + '</div>') +
    '</div></div></div>';
}
function vistaOfertas(p){
  const L = Recepcion.ofertas(p.id);
  const ap = Recepcion.actas(p.id, 'apertura')[0];
  if (!ap) return '<div class="card"><div class="card-body">' + UI.vacio('Aún no hay ofertas abiertas', 'Las ofertas se ven después de la apertura, que se hace en la pestaña «Cierre y apertura».') + '</div></div>';
  const filas = L.map(o => {
    const i = Modelo.invitados(p.id).find(x => x.id === o.invitadoId) || {};
    const r = o.recalculo;
    return '<tr><td><span class="pastilla" style="background:' + Recepcion.colorDe(p, o.invitadoId) + '"></span><b>' + esc(i.razonSocial || o.proponente.razonSocial) + '</b>' + (o.consorcio ? ' ' + UI.tag(o.proponente.tipo || 'plural', 'info') : '') + '</td>' +
      '<td class="n">' + money(r.totalDeclarado) + '</td><td class="n">' + money(r.totales.total) + '</td>' +
      '<td class="n">' + (r.diferencias.length ? '<span class="bad-txt">' + r.diferencias.length + '</span>' : '0') + '</td><td class="n">' + o.documentos + '</td>' +
      '<td class="small">' + (o.novedades.length ? '<ul>' + o.novedades.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : 'Ninguna') + '</td><td class="act">' + boton('detalle-oferta', 'Diferencias', 'xs', ' data-id="' + o.id + '"') + '</td></tr>';
  }).join('');
  return '<div class="card"><div class="card-head"><h3>' + L.length + ' oferta(s) abierta(s)</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Proponente</th><th class="n">Valor declarado</th><th class="n">Valor recalculado</th><th class="n">Precios distintos</th><th class="n">Documentos</th><th>Novedades</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div></div></div>' +
    (ap.rechazados.length ? '<div class="nota bad"><b>Sobres que no se pudieron abrir:</b><ul>' + ap.rechazados.map(r => '<li>' + esc(r.proponente) + ' · ' + esc(r.archivo) + ': ' + esc(r.motivo) + '</li>').join('') + '</ul></div>' : '') +
    '<p class="small muted">El valor recalculado se obtiene con las cantidades del pliego y los APU de cada oferta. Los documentos de cada proponente están en el módulo 10; la verificación, en el 11; el análisis presupuestal, en el 12; el técnico, legal y financiero, en el 13; y los puntajes, en el 14.</p>';
}
/** La zona para soltar sobres. */
function conectarZona(p){
  const z = $('#zonaSobres'); if (!z) return;
  const recibir = async fs => {
    const lista = Array.from(fs || []).filter(f => /\.zip$/i.test(f.name));
    if (!lista.length){ UI.toast('Suelte archivos .zip', 'bad'); return; }
    try { mostrarRecibidos(await Recepcion.recibir(p, lista)); } catch(e){ UI.error(e, 'recibir sobres'); }
    App.render();
  };
  z.onclick = async () => recibir(await UI.elegirArchivos('.zip', true));
  z.onkeydown = e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); z.click(); } };
  z.ondragover = e => { e.preventDefault(); z.classList.add('encima'); };
  z.ondragleave = () => z.classList.remove('encima');
  z.ondrop = e => { e.preventDefault(); z.classList.remove('encima'); recibir(e.dataTransfer.files); };
}
function mostrarRecibidos(res){
  UI.aviso(res.length + ' archivo(s) procesado(s)', '<div class="tw"><table class="t"><thead><tr><th>Archivo</th><th>Proponente</th><th>Resultado</th></tr></thead><tbody>' +
    res.map(r => '<tr><td>' + esc(r.archivo) + '</td><td>' + esc(r.invitado || '—') + '</td><td>' + UI.tag(r.estado, ESTADO_SOBRE[r.estado] || 'warn') + (r.motivo ? '<div class="small">' + esc(r.motivo) + '</div>' : '') +
      ((r.avisos||[]).length ? '<ul class="small">' + r.avisos.map(a => '<li>' + esc(a) + '</li>').join('') + '</ul>' : '') + '</td></tr>').join('') + '</tbody></table></div>', 'wide');
}
function accionesRecepcion(p){
  return {
    'cargar-sobres':async () => {
      const fs = await UI.elegirArchivos('.zip', true);
      if (!fs.length) return;
      mostrarRecibidos(await Recepcion.recibir(p, fs));
      Sesion.pestanas.rec = 'recepcion'; App.render();
    },
    'acta-cierre':async () => { const r = await Recepcion.actaCierre(p); UI.descargar(r.nombre, r.pdf); App.render(); },
    'abrir-ofertas':async () => {
      const n = Recepcion.vigentes(p.id).length;
      const v = await UI.pedir({ titulo:'Apertura de ofertas', eyebrow:p.codigo, textoAceptar:'Abrir los ' + n + ' sobre(s)',
        antes:'<p class="small">Se descifran todos los sobres vigentes a la vez, se verifica cada adjunto y se recalculan los totales. El acta de apertura queda inmutable. Hacen falta la frase del proceso y dos miembros del comité.</p>',
        campos:[{ k:'frase', lab:'Frase del proceso', tipo:'password', c2:true },
          { k:'u1', lab:'Comité 1: usuario' }, { k:'c1', lab:'Comité 1: contraseña', tipo:'password' },
          { k:'u2', lab:'Comité 2: usuario' }, { k:'c2', lab:'Comité 2: contraseña', tipo:'password' }],
        validar:z => !z.frase || !z.u1 || !z.c1 || !z.u2 || !z.c2 ? 'Escriba la frase y los dos usuarios del comité con su contraseña.' : '' });
      if (!v) return;
      UI.toast('Abriendo los sobres…');
      const r = await Recepcion.abrir(p, v.frase, [{ usuario:v.u1, clave:v.c1 }, { usuario:v.u2, clave:v.c2 }]);
      UI.descargar(r.nombre, r.pdf);
      Sesion.pestanas.rec = 'ofertas'; App.render();
      UI.toast(r.filas.length + ' oferta(s) abierta(s)' + (r.rechazados.length ? ', ' + r.rechazados.length + ' sin abrir' : ''), r.rechazados.length ? 'bad' : 'ok');
    },
    'detalle-oferta':b => {
      const o = Recepcion.ofertas(p.id).find(x => x.id === b.dataset.id), r = o.recalculo;
      UI.aviso(o.proponente.razonSocial, '<div class="grid g3"><div class="stat"><div class="lab">Declarado</div><div class="val">' + money(r.totalDeclarado) + '</div></div><div class="stat"><div class="lab">Recalculado</div><div class="val">' + money(r.totales.total) + '</div></div>' +
        '<div class="stat"><div class="lab">AIU</div><div class="val" style="font-size:14px">' + r.totales.pctA + ' / ' + r.totales.pctI + ' / ' + r.totales.pctU + ' %</div></div></div>' +
        (r.diferencias.length ? '<div class="tw scroll" style="margin-top:12px"><table class="t"><thead><tr><th>Actividad</th><th class="n">Unitario declarado</th><th class="n">Recalculado</th><th class="n">Diferencia</th></tr></thead><tbody>' +
          r.diferencias.map(d => '<tr><td>' + esc(d.codigo) + ' · ' + esc(d.nombre) + '</td><td class="n">' + money(d.declarado) + '</td><td class="n">' + money(d.recalculado) + '</td><td class="n">' + money(d.declarado - d.recalculado) + '</td></tr>').join('') + '</tbody></table></div>'
          : '<p>Todos los precios unitarios declarados coinciden con los recalculados.</p>') +
        (r.diferenciasTotales.length ? '<p class="small"><b>Totales distintos:</b> ' + r.diferenciasTotales.map(d => esc(d.concepto) + ' ' + money(d.declarado) + ' frente a ' + money(d.recalculado)).join('; ') + '.</p>' : '') +
        (r.faltantes.length ? '<p class="small"><b>Sin precio:</b> ' + esc(r.faltantes.join(', ')) + '.</p>' : '') + (r.sobrantes.length ? '<p class="small"><b>No están en el pliego:</b> ' + esc(r.sobrantes.join(', ')) + '.</p>' : ''), 'xwide');
    },
    'bajar-arch':b => Archivos.descargar(b.dataset.sha, b.dataset.nombre)
  };
}

/* ─────────────── 10 · Documentos de proponentes ─────────────── */
const TextoPdf = (function(){
  const cache = new Map();
  /** Texto de cada página de un PDF (pdf.js, sin scripts), con caché por huella. */
  async function paginas(sha256){
    if (cache.has(sha256)) return cache.get(sha256);
    const b = await Almacen.leerArchivo(sha256);
    if (!b || !window.pdfjsLib) return [];
    const pdf = await window.pdfjsLib.getDocument({ data:new Uint8Array(await b.arrayBuffer()), isEvalSupported:false, enableXfa:false }).promise;
    const L = [];
    for (let i = 1; i <= pdf.numPages; i++){ const t = await (await pdf.getPage(i)).getTextContent(); L.push(t.items.map(x => x.str).join(' ')); }
    cache.set(sha256, L);
    return L;
  }
  async function buscar(docs, termino){
    const q = Util.normaliza(termino), R = [];
    if (!q) return R;
    for (const d of docs.filter(x => Archivos.extension(x.nombre) === 'pdf')){
      let pags = [];
      try { pags = await paginas(d.sha256); } catch(e){ RegistroTecnico.anotar('texto PDF', e); }
      pags.forEach((t, k) => {
        const n = Util.normaliza(t), j = n.indexOf(q);
        if (j >= 0) R.push({ doc:d, pagina:k + 1, extracto:t.slice(Math.max(0, j - 60), j + q.length + 60) });
      });
    }
    return R;
  }
  /** Visor de una página con los hallazgos resaltados. */
  async function ver(doc, pagina, termino){
    const b = await Almacen.leerArchivo(doc.sha256);
    if (!b) throw new Error('El archivo no está en este equipo.');
    const m = UI.modal({ titulo:doc.nombre, eyebrow:'Página ' + pagina + (termino ? ' · «' + termino + '»' : ''), ancho:'xwide', cuerpo:'<div class="visor" id="visorB"></div>',
      botones:[{ texto:'Descargar', accion:() => Archivos.descargar(doc.sha256, doc.nombre) }, { texto:'Cerrar', clase:'primary' }] });
    const pdf = await window.pdfjsLib.getDocument({ data:new Uint8Array(await b.arrayBuffer()), isEvalSupported:false, enableXfa:false }).promise;
    const page = await pdf.getPage(pagina);
    const vp = page.getViewport({ scale:1.5 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    $('#visorB', m.el).appendChild(c);
    const ctx = c.getContext('2d');
    await page.render({ canvasContext:ctx, viewport:vp }).promise;
    const q = Util.normaliza(termino);
    if (!q) return;
    ctx.fillStyle = 'rgba(169,139,84,.38)';
    (await page.getTextContent()).items.filter(x => Util.normaliza(x.str).indexOf(q) >= 0).forEach(x => {
      const t = window.pdfjsLib.Util.transform(vp.transform, x.transform);
      const h = Math.hypot(t[2], t[3]);
      ctx.fillRect(t[4], t[5] - h, x.width * vp.scale, h * 1.2);
    });
  }
  return { paginas, buscar, ver };
})();
Vistas['10'] = function(){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso('10', 'Documentos de proponentes') };
  const L = Recepcion.ofertas(p.id);
  if (!L.length) return { html:cabecera('10', 'Documentos de proponentes', esc(p.codigo) + etiquetaDemo(p)) + '<div class="card"><div class="card-body">' + UI.vacio('Aún no hay ofertas abiertas', 'Los documentos de cada proponente aparecen aquí después de la apertura (módulo 09).') + '</div></div>' };
  const nombre = o => (Modelo.invitados(p.id).find(i => i.id === o.invitadoId) || {}).razonSocial || o.proponente.razonSocial;
  const act = UI.pestanaActiva('dp', L[0].id);
  const o = L.find(x => x.id === act) || L[0];
  const docs = Recepcion.documentos(o.id);
  const ref = Recepcion.cierre(p) || new Date().toISOString();
  const grupos = [];
  docs.forEach(d => { if (grupos.indexOf(d.grupo) < 0) grupos.push(d.grupo); });
  const color = Recepcion.colorDe(p, o.invitadoId);
  const tabs = '<div class="tabs" role="tablist">' + L.map(x => '<button class="tab' + (x.id === o.id ? ' active' : '') + '" role="tab" data-pestana="dp" data-id="' + x.id + '" type="button"><span class="pastilla" style="background:' + Recepcion.colorDe(p, x.invitadoId) + '"></span>' + esc(nombre(x)) + '</button>').join('') + '</div>';
  const vencido = d => d.vigenteHasta && d.vigenteHasta < String(ref).slice(0, 10);
  const html = cabecera('10', 'Documentos de proponentes', esc(p.codigo) + etiquetaDemo(p) + ' · ' + L.length + ' proponente(s)') + tabs +
    '<div class="card carpeta" style="border-top:4px solid ' + color + '"><div class="card-head"><h3>' + esc(Paquete.nombreSeguro(nombre(o))) + '</h3><div class="btn-row">' + boton('zip-carpeta', 'Descargar la carpeta (.zip)', 'sm', ' data-id="' + o.id + '"') + '</div></div><div class="card-body">' +
      '<div class="form" style="margin-bottom:10px"><div class="field c2"><label for="dpBuscar">Buscar en los PDF de este proponente</label><input id="dpBuscar" type="search" placeholder="Una palabra o frase, por ejemplo: matrícula profesional"></div></div>' +
      '<div id="dpResultados"></div>' +
      (docs.length ? grupos.map(g => '<div class="chk-grupo">' + esc(g) + '</div><div class="tw"><table class="t"><thead><tr><th>Requisito</th><th>Documento</th><th>Fecha</th><th>Vigencia</th><th class="n">Peso</th><th></th></tr></thead><tbody>' +
        docs.filter(d => d.grupo === g).map(d => '<tr><td><b>' + esc(d.requisito) + '</b><div class="small muted">' + esc(d.nombreRequisito) + (d.fila ? ' · ' + esc(d.fila) : '') + '</div></td><td>' + esc(d.nombre) + '<div class="huella">' + esc(d.sha256) + '</div></td>' +
          '<td class="small">' + (d.fechaDocumento ? Util.fmtFecha(d.fechaDocumento) : '—') + '</td><td>' + (d.vigenteHasta ? UI.tag((vencido(d) ? 'vencido el ' : 'hasta ') + Util.fmtFecha(d.vigenteHasta), vencido(d) ? 'bad' : 'ok') : '<span class="small muted">—</span>') + '</td>' +
          '<td class="n small">' + Util.pesoLegible(d.peso) + '</td><td class="act">' + boton('ver-docp', 'Ver', 'xs', ' data-id="' + d.id + '"') + ' ' + boton('bajar-docp', 'Descargar', 'xs ghost', ' data-id="' + d.id + '"') + '</td></tr>').join('') + '</tbody></table></div>').join('')
        : UI.vacio('Sin documentos', 'La oferta no trajo adjuntos.')) +
    '</div></div>' +
    (o.novedades.length ? '<div class="nota warn"><b>Novedades de la apertura:</b><ul>' + o.novedades.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul></div>' : '') +
    '<p class="small muted">La vigencia se compara con la fecha de cierre. Cada requisito se verifica con su evaluador en los módulos 11 y 13.</p>';
  const buscarDoc = id => docs.find(d => d.id === id);
  let ultimo = '';
  return { html, alPintar:() => {
      const inp = $('#dpBuscar'); let t = null;
      inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(async () => {
        const q = inp.value.trim(); ultimo = q;
        const out = $('#dpResultados');
        if (q.length < 3){ out.innerHTML = ''; return; }
        out.innerHTML = '<p class="small muted">Buscando…</p>';
        const R = await TextoPdf.buscar(docs, q);
        if (ultimo !== q || !document.body.contains(out)) return;
        out.innerHTML = R.length ? '<div class="nota"><b>' + R.length + ' hallazgo(s):</b><ul>' + R.slice(0, 50).map((r, k) => '<li><a href="#" data-hallazgo="' + k + '">' + esc(r.doc.nombre) + ' · página ' + r.pagina + '</a> <span class="small muted">…' + esc(r.extracto) + '…</span></li>').join('') + '</ul></div>'
          : '<p class="small muted">Ningún PDF de este proponente contiene «' + esc(q) + '» como texto (los escaneados sin texto no se pueden buscar).</p>';
        $$('[data-hallazgo]', out).forEach(a => a.onclick = e => { e.preventDefault(); const r = R[+a.dataset.hallazgo]; TextoPdf.ver(r.doc, r.pagina, q).catch(er => UI.error(er, 'visor')); });
      }, 350); });
    },
    acciones:{
      'ver-docp':b => Archivos.ver(buscarDoc(b.dataset.id)),
      'bajar-docp':b => { const d = buscarDoc(b.dataset.id); return Archivos.descargar(d.sha256, d.nombre); },
      'zip-carpeta':async () => {
        const raiz = Paquete.nombreSeguro(nombre(o));
        const z = new JSZip();
        const indice = ['Carpeta de ' + nombre(o) + ' · proceso ' + p.codigo + (p.demo ? ' · DEMOSTRACIÓN' : ''), ''];
        for (const d of docs){
          const b = await Almacen.leerArchivo(d.sha256);
          if (!b) throw new Error('El documento «' + d.nombre + '» no está en este equipo.');
          const ruta = raiz + '/' + Paquete.nombreSeguro(d.grupo) + '/' + Paquete.nombreSeguro(d.requisito + ' ' + d.nombre);
          z.file(ruta, b);
          indice.push(d.requisito + '\t' + d.nombre + '\t' + d.sha256);
        }
        z.file(raiz + '/INDICE.txt', indice.join('\r\n'));
        UI.descargar(raiz + '.zip', await z.generateAsync({ type:'blob', compression:'DEFLATE' }));
        await Auditoria.registrar('exportar', 'carpeta de proponente', nombre(o) + ' · ' + docs.length + ' documento(s)', p.id);
      }
    } };
};
