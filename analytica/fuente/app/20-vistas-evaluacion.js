/* ─────────────── Fase 3 en el principal ───────────────
   11 · Verificación y subsanaciones, 12 · Análisis presupuestal,
   13 · Análisis técnico, legal y financiero, 14 · Evaluación y puntajes.
   Las vistas solo pintan lo que calcula el Motor y llaman a Evaluacion,
   que valida, guarda y audita. Ningún cálculo de dinero aquí. */

const pctD = x => x === null || x === undefined || !isFinite(x) ? '—' : (x >= 0 ? '+' : '') + Util.cant(Util.redondearDec(x * 100, 1)) + ' %';
function claseDesv(x, umbral){ return x === null || x === undefined ? '' : Math.abs(x) * 100 > (umbral || 30) ? ' class="n desv-alta"' : Math.abs(x) * 100 > (umbral || 30) / 2 ? ' class="n desv-media"' : ' class="n"'; }
const TAG_CUMPLE = { 'sí':'ok', 'no':'bad', 'subsanable':'warn', 'pendiente':'', 'no aplica':'info' };
function tagCumple(v){ return v ? UI.tag(v.cumple, TAG_CUMPLE[v.cumple]) : '<span class="small muted">sin verificar</span>'; }
function tagHabilitacion(h){ return UI.tag(h.estado, h.estado === 'habilitada' ? 'ok' : h.estado === 'no habilitada' ? 'bad' : 'warn'); }
function pastilla(p, o){ return '<span class="pastilla" style="background:' + Recepcion.colorDe(p, o.invitadoId) + '"></span>'; }
function idDom(s){ return String(s||'').replace(/[^0-9a-z_-]/gi, '_'); }

/** Lo común de los módulos 11 a 14: el proceso, que haya apertura y el análisis. */
function contextoEvaluacion(num, titulo){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso(num, titulo) };
  const sub = esc(p.codigo) + etiquetaDemo(p);
  if (!Evaluacion.hayOfertas(p)) return { html:cabecera(num, titulo, sub) + '<div class="card"><div class="card-body">' +
    UI.vacio('Aún no hay ofertas abiertas', 'La verificación y el análisis empiezan después de la apertura (módulo 09).' + (p.demo && Permisos.puede('demostracion') ? ' En la demostración puede cargar cinco ofertas ficticias desde el módulo 09.' : '')) + '</div></div>' };
  let R;
  try { R = Evaluacion.analisis(p); }
  catch(e){ RegistroTecnico.anotar('análisis', e); return { html:cabecera(num, titulo, sub) + '<div class="nota bad">No se pudo analizar las ofertas: ' + esc(e.message) + '. El detalle quedó en Administración › Registro técnico.</div>' }; }
  return { p, R, sub };
}
/** Pestañas de una oferta, con su color. */
function pestanasOferta(clave, p, R){
  const act = UI.pestanaActiva(clave, R.ofertas[0].id);
  const o = R.ofertas.find(x => x.id === act) || R.ofertas[0];
  return { o, html:'<div class="tabs" role="tablist">' + R.ofertas.map(x => '<button class="tab' + (x.id === o.id ? ' active' : '') + '" role="tab" data-pestana="' + clave + '" data-id="' + x.id + '" type="button">' + pastilla(p, x) + esc(x.nombre) + '</button>').join('') + '</div>' };
}
/** Después de pintar: lleva a la fila que pidió la evidencia de una alerta y la resalta. */
function irAResaltado(){
  const id = Sesion.resaltar; if (!id) return;
  Sesion.resaltar = null;
  const el = document.getElementById(id);
  if (el){ el.classList.add('resaltado'); el.scrollIntoView({ block:'center' }); }
}
const MODULO_EVAL = { 'Jurídico':'juridico', 'Financiero':'financiero', 'Organizacional':'financiero', 'Experiencia':'experiencia', 'Personal':'personal', 'Equipos':'otros',
  'Sistemas de gestión':'sistemas', 'SG-SST':'sistemas', 'Ambiental':'sistemas', 'Programación':'programacion', 'Organigrama':'programacion', 'Proveedores':'otros', 'Económico':'economico', 'Otro':'otros' };

/* ── Matriz requisito × proponente ── */
function matriz(p, R, reqs){
  if (!reqs.length) return UI.vacio('Sin requisitos en este grupo', '');
  return '<div class="tw scroll"><table class="t matriz"><thead><tr><th>Requisito</th>' + R.ofertas.map(o => '<th>' + pastilla(p, o) + esc(o.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
    reqs.map(r => '<tr id="q-' + idDom(r.codigo) + '"><td><b>' + esc(r.codigo) + '</b> ' + esc(r.nombre) + '<div class="small muted">' + esc(r.naturaleza) + (r.tambienHabilitante ? ' y habilitante' : '') + ' · ' + esc(r.evaluador) +
      (r.subsanable ? '' : ' · no subsanable') + '</div></td>' + R.ofertas.map(o => {
        const v = R.vigente(o.id, r.codigo), s = (R.sugerencias[o.id]||{})[r.codigo] || {};
        const pts = R.puntaje.filas.find(f => f.id === o.id);
        const pt = pts && pts.puntos[r.codigo] !== undefined ? '<div class="small">' + Util.cant(pts.puntos[r.codigo]) + ' / ' + Util.cant(r.puntajeMaximo) + ' pts</div>' : '';
        return '<td><button class="celda-eval" type="button" data-accion="verificar" data-of="' + o.id + '" data-req="' + esc(r.codigo) + '">' + tagCumple(v) +
          (!v && s.cumple ? '<div class="small muted">sugiere: ' + esc(s.cumple) + '</div>' : '') + pt + '</button></td>';
      }).join('') + '</tr>').join('') + '</tbody></table></div>';
}

/* ── Modal de verificación: el requisito, lo declarado, lo sugerido y el documento a la vista ── */
function abrirVerificacion(p, R, ofertaId, codigo){
  const r = R.requisitos.find(x => x.codigo === codigo), o = R.ofertas.find(x => x.id === ofertaId);
  const v = R.vigente(ofertaId, codigo), s = (R.sugerencias[ofertaId]||{})[codigo] || {};
  const docs = Motor.adjuntosDe(o, codigo);
  const ed = Permisos.puede('evaluar') && Evaluacion.puedeEvaluar(r);
  const rp = r.reglaPuntaje || {};
  const conValor = r.naturaleza === 'ponderable' && Puntaje.automatica(r);
  const conPuntaje = r.naturaleza === 'ponderable' && rp.tipo === 'calificacion';
  const hist = Evaluacion.historia(p, ofertaId, codigo);
  const filas = Motor.filasDe(o.oferta, r);
  const cols = ((r.tabla||{}).columnas || []).filter(c => c.tipo !== 'documento');
  const campos = [{ k:'cumple', lab:'¿Cumple?', tipo:'select', val:v ? v.cumple : (s.cumple || 'pendiente'), opts:Motor.CUMPLE, deshabilitado:!ed }]
    .concat(conValor ? [{ k:'valorVerificado', lab:'Valor verificado (' + (rp.criterio || PlantillaCondiciones.TIPOS_REGLA[rp.tipo]) + ')', tipo:rp.tipo === 'sino' ? 'select' : 'number', opts:['Sí','No'],
      val:v && v.valorVerificado !== undefined ? v.valorVerificado : s.valor, deshabilitado:!ed }] : [])
    .concat(conPuntaje ? [{ k:'puntaje', lab:'Puntaje (0 a ' + r.puntajeMaximo + ')', tipo:'number', min:0, val:v && v.puntaje !== undefined ? v.puntaje : '', deshabilitado:!ed }] : [])
    .concat([{ k:'observacion', lab:'Observación' + (conPuntaje ? ' y justificación del puntaje' : '') + ' (obligatoria si no cumple o es subsanable)', tipo:'textarea', filas:3, c2:true, val:v ? v.observacion : (s.motivo || ''), deshabilitado:!ed }])
    .concat(docs.length ? [{ k:'doc', lab:'Evidencia: documento', tipo:'select', opts:[{ v:'', n:'(ninguno)' }].concat(docs.map(d => ({ v:d.id, n:d.nombre }))), val:v && v.evidencia && v.evidencia[0] ? v.evidencia[0].docId : docs[0].id, deshabilitado:!ed },
      { k:'pagina', lab:'Página', tipo:'number', min:1, val:v && v.evidencia && v.evidencia[0] ? v.evidencia[0].pagina : 1, deshabilitado:!ed },
      { k:'texto', lab:'Texto literal del documento que lo prueba', c2:true, val:v && v.evidencia && v.evidencia[0] ? v.evidencia[0].texto : '', deshabilitado:!ed },
      { k:'sinFirma', lab:'Al documento le falta la firma', tipo:'check', c2:true, val:v ? v.sinFirma : false, deshabilitado:!ed }] : []);
  const cuerpo = '<p class="small">' + esc(r.descripcion) + '</p>' +
    ((r.reglasVerificacion||[]).length ? '<div class="small"><b>Reglas de verificación del pliego:</b><ul>' + r.reglasVerificacion.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>' : '') +
    '<div class="grid g3"><div class="stat"><div class="lab">Declarado</div><div class="val" style="font-size:14px">' + esc(Motor.declarado(o, r) || '—') + '</div></div>' +
      '<div class="stat"><div class="lab">El programa sugiere</div><div class="val" style="font-size:14px">' + esc(s.cumple || 'revisar') + '</div></div>' +
      '<div class="stat"><div class="lab">Vigente</div><div class="val" style="font-size:14px">' + (v ? esc(v.cumple) + ' · ' + esc(v.evaluador) : 'sin verificar') + '</div></div></div>' +
    (s.motivo ? '<div class="nota">' + esc(s.motivo) + '</div>' : '') +
    (filas.length && cols.length ? '<div class="tw scroll"><table class="t"><thead><tr>' + cols.map(c => '<th>' + esc(c.titulo) + '</th>').join('') + '</tr></thead><tbody>' +
      filas.slice(0, 40).map(f => '<tr>' + cols.map(c => '<td class="small">' + esc(c.tipo === 'moneda' && f[c.clave] !== undefined ? money(f[c.clave]) : f[c.clave] === undefined ? '' : f[c.clave]) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : '') +
    (docs.length ? '<div class="small" style="margin:8px 0"><b>Documentos:</b> ' + docs.map(d => '<a href="#" data-verdoc="' + d.id + '">' + esc(d.nombre) + '</a>' + (d.vigenteHasta ? ' (hasta ' + Util.fmtFecha(d.vigenteHasta) + ')' : '') + (d.ronda === 2 ? ' ' + UI.tag('subsanación', 'info') : '')).join(' · ') + '</div>' : '') +
    (ed && docs.some(d => Archivos.extension(d.nombre) === 'pdf') ? '<div class="ia-lectura"><button class="btn sm" type="button" id="vrLeer">Leer el documento</button> <span class="small muted">Busca en el PDF los datos del requisito y muestra dónde están; usted confirma. Sin internet.</span><div id="vrLector"></div></div>' : '') +
    UI.formulario(campos, 'vr') +
    (ed ? '' : '<div class="nota warn">Este requisito lo verifica el ' + esc((r.evaluador||'').toLowerCase()) + '. Su usuario solo lo consulta.</div>') +
    (hist.length ? '<details class="small"><summary>Historia (' + hist.length + ')</summary><ul>' + hist.map(h => '<li>' + Util.fmtSello(h.fecha) + ' · ' + esc(h.evaluador) + ' · ' + esc(h.cumple) + (h.puntaje !== undefined ? ' · ' + h.puntaje + ' pts' : '') +
      (h.valorVerificado !== undefined ? ' · valor ' + esc(h.valorVerificado) : '') + ' · ronda ' + h.ronda + (h.observacion ? ' · ' + esc(h.observacion) : '') + '</li>').join('') + '</ul></details>' : '');
  const m = UI.modal({ titulo:codigo + ' · ' + r.nombre, eyebrow:o.nombre, ancho:'xwide', cuerpo,
    botones:[{ texto:'Cerrar' }].concat(ed ? [{ texto:'Guardar la verificación', clase:'primary', accion:async mm => {
      const x = UI.leer(campos, mm.el, 'vr');
      await Evaluacion.evaluar(p, ofertaId, codigo, { cumple:x.cumple, valorVerificado:x.valorVerificado, puntaje:x.puntaje, observacion:x.observacion,
        evidencia:x.doc ? [{ docId:x.doc, pagina:x.pagina, texto:x.texto }] : [], sinFirma:x.sinFirma });
      mm.cerrar();
      await Evaluacion.actualizarAlertas(p);
      UI.toast('Verificación guardada', 'ok'); App.render();
    } }] : []) });
  $$('[data-verdoc]', m.el).forEach(a => a.onclick = e => { e.preventDefault(); Archivos.ver(docs.find(d => d.id === a.dataset.verdoc)).catch(er => UI.error(er, 'visor')); });
  const bL = $('#vrLeer', m.el);
  if (bL) bL.onclick = () => Lector.enVerificacion(p, o, r, docs, m.el);
}
function accionesVerificar(p, R){
  return { 'verificar':b => abrirVerificacion(p, R, b.dataset.of, b.dataset.req) };
}

/* ─────────────── 11 · Verificación y subsanaciones ─────────────── */
Vistas['11'] = function(){
  const c = contextoEvaluacion('11', 'Verificación y subsanaciones');
  if (!c.R) return c;
  const { p, R } = c;
  const tab = UI.pestanaActiva('v11', 'verificacion');
  const pend = R.ofertas.reduce((t, o) => t + R.porOferta[o.id].habilitacion.pendientes.length, 0);
  const html = cabecera('11', 'Verificación y subsanaciones', c.sub + ' · ' + R.ofertas.length + ' oferta(s) · ' + pend + ' punto(s) pendiente(s)',
      Permisos.puede('evaluar') ? boton('leer-docs', 'Leer los documentos', 'sm') : '') +
    UI.pestanas('v11', [['verificacion','Habilitantes'],['habilitacion','Habilitación'],['subsanaciones','Subsanaciones'],['comite','Decisiones del comité']], 'verificacion') +
    (tab === 'habilitacion' ? vistaHabilitacion(p, R) : tab === 'subsanaciones' ? vistaSubsanaciones(p, R) : tab === 'comite' ? vistaComite(p, R)
      : '<div class="card"><div class="card-head"><h3>Requisitos habilitantes</h3></div><div class="card-body flush">' + matriz(p, R, Puntaje.habilitantes(R.requisitos)) + '</div></div>' +
        '<p class="small muted">Toque una celda para verificar el requisito con el documento a la vista. El programa sugiere; la persona decide. Cada corrección queda como una fila nueva, con su autor y su fecha.</p>');
  return { html, alPintar:irAResaltado, acciones:Object.assign(accionesVerificar(p, R), accionesSubsanacion(p, R), {
    'leer-docs':async () => { UI.toast('Leyendo los documentos…'); const n = await Evaluacion.leerDocumentos(p); await Evaluacion.actualizarAlertas(p); UI.toast(n + ' documento(s) leído(s)', 'ok'); App.render(); }
  }) };
};
function vistaHabilitacion(p, R){
  return '<div class="grid g2">' + R.ofertas.map(o => {
    const h = R.porOferta[o.id].habilitacion;
    return '<div class="card" style="border-top:4px solid ' + Recepcion.colorDe(p, o.invitadoId) + '"><div class="card-head"><h3>' + esc(o.nombre) + '</h3>' + tagHabilitacion(h) + '</div><div class="card-body small">' +
      (h.causales.length ? '<b>Causales:</b><ul>' + h.causales.map(x => '<li>' + esc(x.texto) + '</li>').join('') + '</ul>' : '') +
      (h.pendientes.length ? '<b>Pendiente:</b><ul>' + h.pendientes.slice(0, 12).map(x => '<li>' + esc(x.texto) + '</li>').join('') + (h.pendientes.length > 12 ? '<li>y ' + (h.pendientes.length - 12) + ' más</li>' : '') + '</ul>' : '') +
      (!h.causales.length && !h.pendientes.length ? 'Cumple todos los requisitos habilitantes.' : '') + '</div></div>';
  }).join('') + '</div>';
}
function vistaSubsanaciones(p, R){
  const L = Evaluacion.subsanaciones(p.id);
  const ed = Permisos.puede('gestionarSubsanaciones');
  const sugeridas = [];
  R.ofertas.forEach(o => R.porOferta[o.id].habilitacion.pendientes.filter(x => /falta pedir/.test(x.texto)).forEach(x => sugeridas.push({ o, x })));
  return (sugeridas.length ? '<div class="card"><div class="card-head"><h3>Por pedir</h3></div><div class="card-body flush"><div class="tw"><table class="t"><tbody>' +
      sugeridas.map(({ o, x }) => '<tr><td>' + pastilla(p, o) + esc(o.nombre) + '</td><td>' + esc(x.texto) + '</td><td class="act">' + (ed ? boton(x.codigo === 'ECO' ? 'pedir-justificacion' : 'pedir-subsanacion', 'Pedir', 'xs primary', ' data-of="' + o.id + '" data-req="' + esc(x.codigo) + '"') : '') + '</td></tr>').join('') +
      '</tbody></table></div></div></div>' : '') +
    '<div class="card"><div class="card-head"><h3>' + L.length + ' solicitud(es)</h3></div><div class="card-body flush">' +
    (L.length ? '<div class="tw scroll"><table class="t"><thead><tr><th>Proponente</th><th>Qué se pide</th><th>Plazo</th><th>Respuesta</th><th>Decisión</th><th></th></tr></thead><tbody>' + L.map(s => {
      const o = R.ofertas.find(x => x.id === s.ofertaId) || { nombre:'', invitadoId:'' };
      const vencida = !s.respuesta && Util.hoyISO() > s.plazo;
      return '<tr><td>' + pastilla(p, o) + esc(o.nombre) + '</td><td><b>' + esc(s.tipo === 'justificacion' ? 'Justificación del valor' : s.requisito) + '</b><div class="small">' + esc(s.texto) + '</div></td>' +
        '<td class="small">' + Util.fmtFecha(s.plazo) + (vencida ? ' ' + UI.tag('vencido', 'bad') : '') + '</td>' +
        '<td class="small">' + (s.respuesta ? Util.fmtSello(s.respuesta.fecha) + ' · ' + s.respuesta.documentos.length + ' archivo(s)' + (s.respuesta.enPlazo ? '' : ' ' + UI.tag('fuera de plazo', 'warn')) + (s.respuesta.nota ? '<div>' + esc(s.respuesta.nota) + '</div>' : '') : '<span class="muted">Sin respuesta</span>') + '</td>' +
        '<td class="small">' + (s.tipo === 'justificacion' ? (s.decision ? UI.tag(s.decision, s.decision === 'aceptada' ? 'ok' : 'bad') + ' ' + esc(s.motivo) : '<span class="muted">Falta la decisión del comité</span>') : '') + '</td>' +
        '<td class="act">' + boton('bajar-arch', 'PDF', 'xs ghost', ' data-sha="' + s.sha256Pdf + '" data-nombre="Solicitud_' + esc(Util.codigoArchivo(p.codigo)) + '.pdf"') + ' ' +
          (ed && !s.respuesta ? boton('responder-sub', 'Registrar respuesta', 'xs', ' data-id="' + s.id + '"') : '') +
          (s.tipo === 'justificacion' && s.respuesta && !s.decision && Permisos.puede('decidirComite') ? boton('decidir-just', 'Decidir', 'xs primary', ' data-id="' + s.id + '"') : '') +
          (s.respuesta && s.requisito ? boton('verificar', 'Verificar de nuevo', 'xs', ' data-of="' + s.ofertaId + '" data-req="' + esc(s.requisito) + '"') : '') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : UI.vacio('Sin solicitudes', 'Cuando un requisito subsanable no cumple, pida aquí la subsanación con su plazo en días hábiles. Si una oferta tiene un valor artificialmente bajo, pida aquí la justificación.')) + '</div></div>' +
    '<p class="small muted">' + esc(R.general.reglasSubsanacion || '') + '</p>';
}
function vistaComite(p, R){
  const dec = (p.evaluacion||{}).decisiones || {};
  const ver = R.ofertas.filter(o => o.versionAnterior);
  const bajos = R.valorBajo.filas.filter(f => f.bajo);
  return '<div class="card"><div class="card-head"><h3>Valor artificialmente bajo</h3></div><div class="card-body small">' +
      (bajos.length ? bajos.map(f => { const o = R.ofertas.find(x => x.id === f.id); const j = Motor.ultimaSubsanacion(Evaluacion.subsanaciones(p.id), f.id, null, 'justificacion');
        return '<div>' + pastilla(p, o) + '<b>' + esc(o.nombre) + '</b>: ' + money(f.total) + ', ' + pctD(f.desvMediana) + ' frente a la mediana. ' + (j ? (j.decision ? 'Justificación ' + esc(j.decision) + ': ' + esc(j.motivo) : j.respuesta ? 'Justificación recibida; falta la decisión.' : 'Justificación pedida, plazo hasta el ' + Util.fmtFecha(j.plazo) + '.') : 'Falta pedir la justificación (pestaña Subsanaciones).') + '</div>'; }).join('')
        : 'Ninguna oferta queda por debajo del ' + R.valorBajo.umbralPct + ' % de la mediana.') + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Ofertas sobre una versión anterior del pliego</h3></div><div class="card-body small">' +
      (ver.length ? ver.map(o => '<div>' + pastilla(p, o) + '<b>' + esc(o.nombre) + '</b> (versión ' + esc(o.versionPliego) + '): ' + ((dec[o.id]||{}).version ? UI.tag((dec[o.id]).version, dec[o.id].version === 'aceptada' ? 'ok' : 'bad') + ' ' + esc(dec[o.id].motivoVersion) :
        (Permisos.puede('decidirComite') ? boton('decidir-version', 'Decidir', 'xs primary', ' data-of="' + o.id + '"') : 'falta la decisión del comité')) + '</div>').join('') : 'Todas las ofertas son sobre la versión vigente.') + '</div></div>';
}
function accionesSubsanacion(p, R){
  return {
    'pedir-subsanacion':async b => {
      const r = R.requisitos.find(x => x.codigo === b.dataset.req), o = R.ofertas.find(x => x.id === b.dataset.of);
      const v = R.vigente(o.id, r.codigo);
      const x = await UI.pedir({ titulo:'Pedir la subsanación de ' + r.codigo, eyebrow:o.nombre, textoAceptar:'Generar la solicitud',
        campos:[{ k:'texto', lab:'Qué debe subsanar', tipo:'textarea', filas:4, c2:true, val:(v && v.observacion) || r.nombre }, { k:'dias', lab:'Plazo en días hábiles', tipo:'number', min:1, val:3 }] });
      if (!x) return;
      const res = await Evaluacion.pedir(p, o.id, r.codigo, x.dias, x.texto);
      UI.descargar(res.nombre, res.pdf); App.render();
    },
    'pedir-justificacion':async b => {
      const o = R.ofertas.find(x => x.id === b.dataset.of), f = R.valorBajo.filas.find(z => z.id === o.id);
      const x = await UI.pedir({ titulo:'Pedir la justificación del valor', eyebrow:o.nombre, textoAceptar:'Generar la solicitud',
        campos:[{ k:'texto', lab:'Qué se le pide', tipo:'textarea', filas:4, c2:true, val:'Su oferta, por ' + money(f.total) + ', está ' + pctD(f.desvMediana) + ' frente a la mediana de las ofertas. Justifique el valor con los soportes de sus precios principales.' },
          { k:'dias', lab:'Plazo en días hábiles', tipo:'number', min:1, val:3 }] });
      if (!x) return;
      const res = await Evaluacion.pedir(p, o.id, null, x.dias, x.texto, 'justificacion');
      UI.descargar(res.nombre, res.pdf); App.render();
    },
    'responder-sub':async b => {
      const x = await UI.pedir({ titulo:'Registrar la respuesta del proponente', textoAceptar:'Elegir archivos y registrar', campos:[{ k:'nota', lab:'Nota de la respuesta (cómo llegó, qué trae)', tipo:'textarea', filas:3, c2:true }] });
      if (!x) return;
      const fs = await UI.elegirArchivos('.pdf,.zip,.xlsx,.jpg,.png', true);
      await Evaluacion.responder(p, b.dataset.id, fs, x.nota);
      await Evaluacion.actualizarAlertas(p); App.render();
    },
    'decidir-just':async b => {
      const x = await UI.pedir({ titulo:'Decisión del comité sobre la justificación', textoAceptar:'Registrar la decisión',
        campos:[{ k:'decision', lab:'Decisión', tipo:'select', opts:[{ v:'aceptada', n:'Se acepta la justificación' }, { v:'rechazada', n:'No se acepta: la oferta queda no habilitada' }], c2:true }, { k:'motivo', lab:'Motivo', tipo:'textarea', filas:3, c2:true }] });
      if (!x) return;
      await Evaluacion.decidirJustificacion(p, b.dataset.id, x.decision, x.motivo); App.render();
    },
    'decidir-version':async b => {
      const x = await UI.pedir({ titulo:'Oferta sobre una versión anterior del pliego', textoAceptar:'Registrar la decisión',
        campos:[{ k:'decision', lab:'Decisión del comité', tipo:'select', opts:[{ v:'aceptada', n:'Se acepta' }, { v:'rechazada', n:'No se acepta' }], c2:true }, { k:'motivo', lab:'Motivo', tipo:'textarea', filas:3, c2:true }] });
      if (!x) return;
      await Evaluacion.decidirVersion(p, b.dataset.of, x.decision, x.motivo); App.render();
    },
    'bajar-arch':b => Archivos.descargar(b.dataset.sha, b.dataset.nombre)
  };
}

/* ─────────────── 12 · Análisis presupuestal ─────────────── */
Vistas['12'] = function(){
  const c = contextoEvaluacion('12', 'Análisis presupuestal');
  if (!c.R) return c;
  const { p, R } = c;
  if (ocultarPrecios()) return { html:cabecera('12', 'Análisis presupuestal', c.sub) + '<div class="nota warn">Los precios están ocultos para los evaluadores técnicos hasta terminar la calificación técnica (Configuración).</div>' };
  const tabs = [['aritmetica','Aritmética'],['capitulos','Capítulos'],['subcapitulos','Subcapítulos'],['actividades','Actividades'],['insumos','Insumos'],['aiu','AIU'],['desbalance','Desbalance'],['apu','APU'],['configuracion','Configuración']];
  const tab = UI.pestanaActiva('a12', 'aritmetica');
  const f = { aritmetica:vistaAritmetica, capitulos:(p, R) => vistaNivel(p, R, 'capitulo'), subcapitulos:(p, R) => vistaNivel(p, R, 'subcapitulo'), actividades:(p, R) => vistaNivel(p, R, 'actividad'),
    insumos:vistaInsumos, aiu:vistaAiu, desbalance:vistaDesbalance, apu:vistaApu, configuracion:vistaConfigEval }[tab] || vistaAritmetica;
  const html = cabecera('12', 'Análisis presupuestal', c.sub + ' · presupuesto base ' + money(R.presupuestoOficial)) + UI.pestanas('a12', tabs, 'aritmetica') + f(p, R);
  return { html, alPintar:irAResaltado, acciones:accionesAnalisis(p, R) };
};
function vistaAritmetica(p, R){
  const { o, html } = pestanasOferta('of12', p, R);
  const ar = R.porOferta[o.id].aritmetica;
  return html + '<div class="grid g3"><div class="stat"><div class="lab">Total declarado</div><div class="val">' + money(ar.totalDeclarado) + '</div></div>' +
    '<div class="stat"><div class="lab">Total recalculado</div><div class="val">' + money(ar.totalRecalculado) + '</div></div>' +
    '<div class="stat"><div class="lab">Diferencia</div><div class="val">' + money(ar.totalDeclarado - ar.totalRecalculado) + '</div></div></div>' +
    '<p class="small muted">' + esc(R.general.reglaCorreccion || ar.regla) + ' Tolerancia de un peso por renglón.</p>' +
    (ar.totales.length ? '<div class="nota warn"><b>Totales que no cuadran:</b> ' + ar.totales.map(t => esc(t.concepto) + ' declarado ' + money(t.declarado) + ' y recalculado ' + money(t.recalculado)).join('; ') + '.</div>' : '') +
    '<div class="card"><div class="card-head"><h3>' + ar.renglones.length + ' renglón(es) con problemas</h3></div><div class="card-body flush">' +
    (ar.renglones.length ? '<div class="tw scroll"><table class="t"><thead><tr><th>Actividad</th><th class="n">Cantidad</th><th class="n">Unitario declarado</th><th class="n">Recalculado</th><th class="n">Diferencia</th><th>Problema</th></tr></thead><tbody>' +
      ar.renglones.map(z => '<tr id="r-' + idDom(z.codigo) + '"><td><b>' + esc(z.codigo) + '</b> ' + esc(z.nombre) + '</td><td class="n">' + cant(z.cantidad) + '</td><td class="n">' + (z.declarado === null ? '—' : money3(z.declarado)) + '</td><td class="n">' + money3(z.recalculado) + '</td>' +
        '<td class="n">' + (z.diferencia === null ? '—' : money3(z.diferencia)) + '</td><td>' + z.problemas.map(q => UI.tag(q, q === 'sin precio' ? 'bad' : 'warn')).join(' ') + '</td></tr>').join('') + '</tbody></table></div>'
      : UI.vacio('Sin diferencias', 'Cada precio unitario es la suma de su APU y ninguna actividad quedó sin precio.')) + '</div></div>' +
    (ar.sobrantes.length ? '<p class="small"><b>Actividades de la oferta que no están en el pliego (no se tienen en cuenta):</b> ' + esc(ar.sobrantes.join(', ')) + '.</p>' : '');
}
function vistaNivel(p, R, nivel){
  const filas = Presupuestal.niveles(R.ctx, nivel);
  const act = nivel === 'actividad';
  const u = R.ctx.config.desbalance.pct;
  return '<div class="card"><div class="card-body flush"><div class="tw scroll"><table class="t comparativo"><thead><tr><th>Código</th><th>Nombre</th>' + (act ? '<th class="n">Cantidad</th>' : '') + '<th class="n">Base</th>' +
      R.ofertas.map(o => '<th class="n">' + pastilla(p, o) + esc(o.nombre) + '</th>').join('') + '<th class="n">Mediana</th><th class="n">Mín.</th><th class="n">Máx.</th></tr></thead><tbody>' +
    filas.map(f => '<tr id="r-' + idDom(f.codigo) + '"><td><b>' + esc(f.codigo) + '</b></td><td>' + esc(f.nombre) + (f.cantidadIncierta ? ' ' + UI.tag('cantidad incierta', 'warn') : '') + '</td>' +
      (act ? '<td class="n">' + cant(f.cantidad) + ' ' + esc(f.unidad) + '</td>' : '') + '<td class="n">' + money(f.base) + (act ? '<div class="small muted">' + money3(f.unitarioBase) + '</div>' : '') + '</td>' +
      R.ofertas.map(o => '<td' + claseDesv(f.desvBase[o.id], u) + '>' + money(f.valores[o.id]) + '<div class="small">' + pctD(f.desvBase[o.id]) + ' · med ' + pctD(f.desvMediana[o.id]) + '</div></td>').join('') +
      '<td class="n">' + money(f.estadisticos.mediana) + '</td><td class="n">' + money(f.estadisticos.min) + '</td><td class="n">' + money(f.estadisticos.max) + '</td></tr>').join('') +
    '</tbody></table></div></div></div><p class="small muted">Cada valor con su desviación frente a la base y frente a la mediana de los proponentes. En rojo, más de ±' + u + ' % frente a la base.</p>';
}
function vistaInsumos(p, R){
  const L = Presupuestal.insumos(R.ctx);
  const ed = Permisos.puede('configurarEvaluacion');
  const sug = L.filter(f => f.estado === 'sugerido' || f.estado === 'sin pareja');
  return (sug.length ? '<div class="card"><div class="card-head"><h3>Emparejamientos por confirmar (' + sug.length + ')</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Insumo de las ofertas</th><th>Sugerido de la base</th><th class="n">Parecido</th><th></th></tr></thead><tbody>' +
      sug.slice(0, 200).map(f => '<tr><td>' + esc(f.nombre) + ' <span class="small muted">' + esc(f.unidad) + '</span></td><td>' + (f.base ? esc(f.base.nombre) + ' <span class="small muted">' + esc(f.base.unidad) + '</span>' : '<span class="muted">ninguno</span>') + '</td>' +
        '<td class="n">' + (f.base ? Util.cant(Util.redondearDec(f.parecido * 100, 0)) + ' %' : '') + '</td><td class="act">' + (ed ? (f.base ? boton('emparejar', 'Confirmar', 'xs primary', ' data-clave="' + esc(f.clave) + '" data-base="' + esc(f.base.id) + '"') + ' ' : '') +
        boton('emparejar', 'Sin pareja', 'xs ghost', ' data-clave="' + esc(f.clave) + '" data-base=""') : '') + '</td></tr>').join('') + '</tbody></table></div></div></div>' : '') +
    '<div class="card"><div class="card-head"><h3>Precios de insumo frente a la base</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t comparativo"><thead><tr><th>Insumo</th><th>Pareja</th><th class="n">Base</th>' +
      R.ofertas.map(o => '<th class="n">' + pastilla(p, o) + esc(o.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
    L.map(f => '<tr><td>' + esc(f.nombre) + ' <span class="small muted">' + esc(f.unidad) + ' · ' + esc(f.categoria) + '</span></td><td class="small">' + esc(f.estado) + '</td><td class="n">' + (f.precioBase === null ? '—' : money3(f.precioBase)) + '</td>' +
      R.ofertas.map(o => '<td' + claseDesv(f.desvBase[o.id], R.ctx.config.apu.insumoBajoPct) + '>' + (f.precios[o.id] === undefined ? '—' : money3(f.precios[o.id]) + '<div class="small">' + pctD(f.desvBase[o.id]) + '</div>') + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div></div></div><p class="small muted">Solo cuentan los emparejamientos exactos (misma descripción y unidad) y los que una persona confirmó.</p>';
}
function vistaAiu(p, R){
  const cat = Presupuestal.categorias(R.ctx);
  const cats = Calculo.CATEGORIAS_INSUMO;
  return '<div class="card"><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Proponente</th><th class="n">A / I / U</th><th class="n">Administración</th><th class="n">Desglose de A</th><th>Cuadra</th><th class="n">IVA</th><th>Hallazgos</th></tr></thead><tbody>' +
    R.ofertas.map(o => { const a = R.porOferta[o.id].aiu, h = R.porOferta[o.id].administracion;
      return '<tr><td>' + pastilla(p, o) + esc(o.nombre) + '</td><td class="n">' + cant(a.pctA) + ' / ' + cant(a.pctI) + ' / ' + cant(a.pctU) + ' %</td><td class="n">' + money(a.a) + '</td><td class="n">' + money(a.totalDesglose) + '</td>' +
        '<td>' + UI.tag(a.cuadra ? 'sí' : 'no', a.cuadra ? 'ok' : 'warn') + '</td><td class="n">' + money(a.iva) + (a.ivaBien ? '' : ' ' + UI.tag('base distinta', 'bad')) + '</td>' +
        '<td class="small">' + (h.length ? h.map(x => esc(x.detalle)).join('<br>') : 'Sin hallazgos') + '</td></tr>'; }).join('') +
    '</tbody></table></div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Peso de cada categoría de insumo en el costo directo</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Categoría</th><th class="n">Base</th>' +
      R.ofertas.map(o => '<th class="n">' + pastilla(p, o) + esc(o.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
    cats.map(k => '<tr><td>' + esc(k) + '</td><td class="n">' + Util.cant(Util.redondearDec((cat.base.pct[k]||0) * 100, 1)) + ' %</td>' + R.ofertas.map(o => '<td class="n">' + Util.cant(Util.redondearDec((cat.ofertas[o.id].pct[k]||0) * 100, 1)) + ' %</td>').join('') + '</tr>').join('') +
    '</tbody></table></div></div></div>';
}
/** Barras de la desviación de cada actividad frente a la base, en el orden de su programación (cargue al inicio). */
function graficaCargue(cg){
  const L = (cg.grupos || []).flat();
  if (!L.length) return '';
  const W = 640, H = 160, m = 80, bw = Math.max(2, (W - 20) / L.length - 1);
  const y = d => H / 2 - Math.max(-1, Math.min(1, d)) * m * 0.9;
  return '<svg class="grafica" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Desviación frente a la base, por actividad, en el orden de la programación">' +
    '<line x1="10" y1="' + H / 2 + '" x2="' + (W - 10) + '" y2="' + H / 2 + '" stroke="currentColor" stroke-opacity=".4"/>' +
    L.map((z, i) => { const d = z.desv || 0, yy = y(d); return '<rect x="' + (10 + i * (bw + 1)) + '" y="' + Math.min(yy, H / 2) + '" width="' + bw + '" height="' + Math.abs(H / 2 - yy) + '" fill="' + (d >= 0 ? 'var(--bad, #96362E)' : 'var(--ok, #3B6E52)') + '"><title>' + esc(z.codigo) + ' ' + pctD(d) + '</title></rect>'; }).join('') +
    '<text x="10" y="12" font-size="10" fill="currentColor">Primer tercio</text><text x="' + (W - 10) + '" y="12" font-size="10" text-anchor="end" fill="currentColor">Último tercio</text></svg>';
}
function vistaDesbalance(p, R){
  const D = R.desbalance;
  const { o, html } = pestanasOferta('of12', p, R);
  const marc = D.marcadas.filter(z => z.ofertaId === o.id);
  const cg = R.porOferta[o.id].cargue;
  return '<div class="card"><div class="card-head"><h3>Indicador de desbalance</h3></div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Proponente</th><th class="n">Indicador</th><th class="n">Actividades marcadas</th><th>Cargue al inicio</th></tr></thead><tbody>' +
      R.ofertas.map(x => { const c2 = R.porOferta[x.id].cargue; return '<tr><td>' + pastilla(p, x) + esc(x.nombre) + '</td><td class="n">' + Util.cant(Util.redondearDec(D.indicador[x.id] * 100, 2)) + ' %</td><td class="n">' + D.marcadas.filter(z => z.ofertaId === x.id).length + '</td>' +
        '<td class="small">' + (c2.aplica ? (c2.alerta ? UI.tag('sí', 'bad') + ' ' : '') + 'primer tercio ' + pctD(c2.desviaciones[0]) + ', último ' + pctD(c2.desviaciones[2]) : esc(c2.motivo)) + '</td></tr>'; }).join('') +
    '</tbody></table></div></div></div><p class="small muted">Indicador: suma ponderada por valor de las desviaciones absolutas frente a la base. ' + esc(D.nota) + '</p>' + html +
    (cg.aplica ? '<div class="card"><div class="card-head"><h3>Desviación por actividad a lo largo de la programación</h3></div><div class="card-body">' + graficaCargue(cg) + '<p class="small">' + esc(cg.detalle || '') + '</p></div></div>' : '') +
    '<div class="card"><div class="card-head"><h3>' + marc.length + ' actividad(es) marcada(s)</h3></div><div class="card-body flush">' +
    (marc.length ? '<div class="tw scroll"><table class="t"><thead><tr><th>Actividad</th><th class="n">Unitario</th><th class="n">Base</th><th class="n">Mediana</th><th class="n">Peso</th><th>Regla</th></tr></thead><tbody>' +
      marc.map(z => '<tr id="r-' + idDom(z.codigo) + '"><td><b>' + esc(z.codigo) + '</b> ' + esc(z.nombre) + '</td><td class="n">' + money3(z.unitario) + '<div class="small">' + pctD(z.razonBase === null ? null : z.razonBase - 1) + '</div></td><td class="n">' + money3(z.base) + '</td>' +
        '<td class="n">' + money3(z.mediana) + '</td><td class="n">' + Util.cant(Util.redondearDec(z.peso * 100, 2)) + ' %</td><td class="small">' + esc(z.reglas.join('; ')) + '</td></tr>').join('') + '</tbody></table></div>'
      : UI.vacio('Sin actividades desbalanceadas', '')) + '</div></div>';
}
function vistaApu(p, R){
  const H = R.apu.hallazgos;
  const lab = R.laboral;
  return (lab ? '<div class="nota">Costo empresa mínimo a la fecha de cierre: ' + money(lab.mensual) + ' al mes, ' + money(lab.jornal) + ' el jornal de ' + lab.horasJornal + ' horas y ' + money(lab.hora) + ' la hora (SMMLV ' + money(lab.smmlv) + ', divisor ' + lab.divisor + '; Parámetros).</div>' : '<div class="nota warn">Falta el SMMLV de la vigencia en Parámetros: no se revisa la mano de obra.</div>') +
    '<div class="card"><div class="card-head"><h3>' + H.length + ' hallazgo(s) en los APU</h3></div><div class="card-body flush">' +
    (H.length ? '<div class="tw scroll"><table class="t"><thead><tr><th>Proponente</th><th>Actividad</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>' +
      H.map(h => { const o = R.ofertas.find(x => x.id === h.ofertaId); return '<tr id="r-' + idDom(h.codigo) + '"><td>' + pastilla(p, o) + esc(o.nombre) + '</td><td><b>' + esc(h.codigo) + '</b></td><td>' + UI.tag(h.tipo, h.tipo === 'mano de obra bajo el mínimo' ? 'bad' : 'warn') + '</td><td class="small">' + esc(h.detalle) + '</td></tr>'; }).join('') + '</tbody></table></div>'
      : UI.vacio('Sin hallazgos', 'Solo se revisan los APU desglosados (con al menos dos insumos).')) + '</div></div>';
}
function vistaConfigEval(p, R){
  const c = R.ctx.config, e = p.evaluacion || {};
  const ed = Permisos.puede('configurarEvaluacion');
  const campos = camposConfigEval(c, e, !ed);
  return '<div class="card"><div class="card-head"><h3>Umbrales del análisis</h3></div><div class="card-body">' + UI.formulario(campos, 'ce') +
    (ed ? '<div class="btn-row">' + boton('guardar-config-eval', 'Guardar', 'primary') + '</div>' : '') + '</div></div>' +
    '<p class="small muted">Valores por defecto del prompt maestro (§18.3 y §18.4). Cada cambio queda en la auditoría y el análisis se recalcula al instante. El umbral de valor bajo y el método económico son del pliego (módulo 07).</p>';
}
function camposConfigEval(c, e, dis){
  return [{ k:'z', lab:'Desbalance: z robusto mayor que', tipo:'number', val:c.desbalance.z, deshabilitado:dis }, { k:'pctDesbalance', lab:'Desbalance: ± % frente a la base', tipo:'number', val:c.desbalance.pct, deshabilitado:dis },
    { k:'pesoMinPct', lab:'… en actividades que pesan más del (%)', tipo:'number', val:c.desbalance.pesoMinPct, deshabilitado:dis }, { k:'minPct', lab:'El z marca solo si además se aparta (%) de la mediana', tipo:'number', val:c.desbalance.minPct, deshabilitado:dis },
    { k:'pctCargue', lab:'Cargue al inicio: ± % por tercio', tipo:'number', val:c.cargue.pct, deshabilitado:dis }, { k:'pctCantidades', lab:'Riesgo de cantidades: ± %', tipo:'number', val:c.cantidades.pct, deshabilitado:dis },
    { k:'rendimientoPct', lab:'APU: rendimiento ± % frente a la base', tipo:'number', val:c.apu.rendimientoPct, deshabilitado:dis }, { k:'insumoBajoPct', lab:'APU: insumo % por debajo del mercado', tipo:'number', val:c.apu.insumoBajoPct, deshabilitado:dis },
    { k:'pesoFaltantePct', lab:'APU: falta un insumo que pesa (%) o más', tipo:'number', val:c.apu.pesoFaltantePct, deshabilitado:dis }, { k:'desperdicioPct', lab:'APU: desperdicio % por encima de la base', tipo:'number', val:c.apu.desperdicioPct, deshabilitado:dis },
    { k:'tipologia', lab:'Tipología del proceso (experiencia específica)', val:e.tipologia || '', c2:true, deshabilitado:dis, ayuda:'Si la escribe, EXP-02 solo cuenta el área de los contratos de esa tipología.' },
    { k:'trm', lab:'TRM del día de la apertura (método por TRM)', tipo:'number', val:e.trm || '', deshabilitado:dis }];
}
function accionesAnalisis(p, R){
  return {
    'emparejar':async b => { await Evaluacion.emparejar(p, b.dataset.clave, b.dataset.base || null); await Evaluacion.actualizarAlertas(p); App.render(); },
    'guardar-config-eval':async () => { const v = UI.leer(camposConfigEval(R.ctx.config, p.evaluacion || {}), document, 'ce'); await Evaluacion.guardarConfig(p, v); await Evaluacion.actualizarAlertas(p); UI.toast('Umbrales guardados', 'ok'); App.render(); }
  };
}

/* ─────────────── 13 · Análisis técnico, legal y financiero ─────────────── */
const GRUPOS_13 = [['juridico','Jurídico'],['financiero','Financiero'],['experiencia','Experiencia'],['personal','Personal'],['sistemas','Sistemas de gestión'],['programacion','Programación y organigrama'],['otros','Equipos, proveedores y otros']];
Vistas['13'] = function(){
  const c = contextoEvaluacion('13', 'Análisis técnico, legal y financiero');
  if (!c.R) return c;
  const { p, R } = c;
  const tab = UI.pestanaActiva('g13', 'juridico');
  const reqs = R.requisitos.filter(r => MODULO_EVAL[r.grupo] === tab || (tab === 'otros' && !MODULO_EVAL[r.grupo]));
  const detalle = { financiero:detalleFinanciero, experiencia:detalleExperiencia, personal:detallePersonal, programacion:detalleProgramacion }[tab];
  const html = cabecera('13', 'Análisis técnico, legal y financiero', c.sub) + UI.pestanas('g13', GRUPOS_13, 'juridico') +
    '<div class="card"><div class="card-head"><h3>Requisito por proponente</h3></div><div class="card-body flush">' + matriz(p, R, reqs) + '</div></div>' + (detalle ? detalle(p, R) : '') +
    (tab === 'juridico' ? '<p class="small muted">El programa no consulta en línea: registra el documento y su fecha. El evaluador confirma cada punto con el documento a la vista; la vigencia se compara con la fecha de cierre y con la fecha prevista de firma.</p>' : '');
  return { html, alPintar:irAResaltado, acciones:accionesVerificar(p, R) };
};
function detalleFinanciero(p, R){
  const reqs = Object.keys(R.porOferta[R.ofertas[0].id].financiero);
  return '<div class="card"><div class="card-head"><h3>Indicadores, con el cálculo a la vista</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Indicador</th>' +
      R.ofertas.map(o => '<th>' + pastilla(p, o) + esc(o.nombre) + (R.porOferta[o.id].financiero[reqs[0]] && R.porOferta[o.id].financiero[reqs[0]].consorcio ? ' ' + UI.tag('consorcio', 'info') : '') + '</th>').join('') + '</tr></thead><tbody>' +
    reqs.flatMap(c => (R.umbralesFinancieros.filter(u => u.requisito === c)).map(u => '<tr><td><b>' + esc(u.nombre) + '</b><div class="small muted">' + esc(u.texto) + ' (' + esc(c) + ')</div></td>' +
      R.ofertas.map(o => { const x = (R.porOferta[o.id].financiero[c] || { indicadores:[] }).indicadores.find(i => i.clave === u.clave);
        return '<td class="small">' + (x ? UI.tag(x.cumple ? 'cumple' : 'no cumple', x.cumple ? 'ok' : 'bad') + '<div>' + esc(x.calculo) + '</div>' : '<span class="muted">sin datos</span>') + '</td>'; }).join('') + '</tr>')).join('') +
    '</tbody></table></div></div></div><p class="small muted">En consorcio, cada componente se suma ponderado por la participación antes de dividir (Anexo C).</p>';
}
function detalleExperiencia(p, R){
  const { o, html } = pestanasOferta('of13', p, R);
  return html + Object.keys(R.porOferta[o.id].experiencia).map(c => {
    const e = R.porOferta[o.id].experiencia[c];
    return '<div class="card"><div class="card-head"><h3>' + esc(c) + '</h3>' + (e.cumpleSuma === null ? '' : UI.tag(e.cumpleSuma ? 'alcanza' : 'no alcanza', e.cumpleSuma ? 'ok' : 'bad')) + '</div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Contratante</th><th>Terminación</th><th class="n">Valor</th><th class="n">Part.</th><th class="n">SMMLV</th><th class="n">m²</th><th>Cuenta</th></tr></thead><tbody>' +
      e.contratos.map(x => '<tr><td>' + esc(x.contratante) + '<div class="small muted">' + esc(x.objeto || '') + '</div></td><td class="small">' + Util.fmtFecha(x.terminacion) + '</td><td class="n">' + money(x.valor) + '</td><td class="n">' + cant(x.participacion) + ' %</td>' +
        '<td class="n">' + (x.enSmmlv === null ? '—' : cant(Util.redondearDec(x.enSmmlv, 2))) + '<div class="small muted">' + (x.smmlv ? 'SMMLV ' + x.anio + ': ' + money(x.smmlv) : '') + '</div></td><td class="n">' + cant(x.area) + '</td>' +
        '<td>' + (x.cuenta ? UI.tag('sí', 'ok') : UI.tag('no', '') + '<div class="small">' + esc(x.motivo) + '</div>') + '</td></tr>').join('') + '</tbody></table></div>' +
      '<div class="small" style="padding:8px 12px">Suma ' + cant(Util.redondearDec(e.suma, 2)) + ' SMMLV' + (e.exigido !== null ? ' frente a ' + cant(Util.redondearDec(e.exigido, 2)) + ' exigidos (' + cant(e.reglas.multiplo) + ' × ' + cant(Util.redondearDec(e.smmlvPO, 2)) + ' del presupuesto oficial)' : '') +
        ' · área acreditada ' + cant(e.area) + ' m²' + (e.avisos.length ? '<br>' + e.avisos.map(a => esc(a.detalle)).join('<br>') : '') + '</div></div></div>';
  }).join('');
}
function detallePersonal(p, R){
  return '<div class="card"><div class="card-head"><h3>Personal ofrecido</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Proponente</th><th>Cargo</th><th>Persona</th><th class="n">Años</th><th class="n">Dedicación</th><th>Cumple</th></tr></thead><tbody>' +
    R.ofertas.flatMap(o => Object.keys(R.porOferta[o.id].personal).flatMap(c => R.porOferta[o.id].personal[c].map(f => '<tr><td>' + pastilla(p, o) + esc(o.nombre) + '</td><td>' + esc(f.cargo) + ' <span class="small muted">' + esc(c) + '</span></td>' +
      '<td>' + esc(f.nombre) + '<div class="small muted">' + esc(f.profesion || '') + (f.matricula ? ' · matrícula ' + esc(f.matricula) : '') + '</div></td><td class="n">' + cant(f.anios) + '</td><td class="n">' + cant(f.dedicacion) + ' %</td>' +
      '<td>' + (f.cumple ? UI.tag('sí', 'ok') : UI.tag('no', 'bad') + '<div class="small">' + esc(f.faltas.join('; ')) + '</div>') + '</td></tr>'))).join('') +
    '</tbody></table></div></div></div><p class="small muted">La misma persona en dos ofertas, o en dos cargos que suman más del 100 % de dedicación, aparece en la bandeja de alertas.</p>';
}
function detalleProgramacion(p, R){
  const { o, html } = pestanasOferta('of13', p, R);
  const x = R.porOferta[o.id].programacion;
  if (!x.aplica) return html + '<div class="nota warn">' + esc(x.hallazgos[0].detalle) + '</div>';
  const org = R.porOferta[o.id].organigrama;
  return html + '<div class="grid g3"><div class="stat"><div class="lab">Plazo programado</div><div class="val">' + x.plazo + ' días</div></div><div class="stat"><div class="lab">Máximo del pliego</div><div class="val">' + (p.plazoMaximoDias || '—') + ' días</div></div>' +
    '<div class="stat"><div class="lab">Sin programar</div><div class="val">' + x.sinProgramar.length + '</div></div></div>' +
    (x.hallazgos.length ? '<div class="nota warn"><ul>' + x.hallazgos.slice(0, 20).map(h => '<li>' + esc(h.detalle) + '</li>').join('') + '</ul></div>' : '<div class="nota ok">Dentro del plazo, toda actividad programada y las dependencias se respetan.</div>') +
    (x.cpm && !x.cpm.ciclo ? '<div class="card"><div class="card-head"><h3>Ruta crítica (' + x.cpm.duracion + ' días)</h3></div><div class="card-body small">' + x.cpm.critica.map(esc).join(' → ') + '</div></div>' : '') +
    '<div class="card"><div class="card-head"><h3>Curva S</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Mes</th><th class="n">Valor programado</th><th class="n">Acumulado</th></tr></thead><tbody>' +
      x.curva.map(m => '<tr><td>' + esc(m.mes) + '</td><td class="n">' + money(m.valor) + '</td><td class="n">' + Util.cant(Util.redondearDec(m.pct * 100, 1)) + ' %</td></tr>').join('') + '</tbody></table></div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Organigrama</h3></div><div class="card-body small">' + ((o.oferta.organigrama||[]).length ? '<ul>' + o.oferta.organigrama.map(z => '<li>' + esc(z.cargo) + ': ' + esc(z.nombre) + (z.reportaA ? ' (reporta a ' + esc(z.reportaA) + ')' : '') + '</li>').join('') + '</ul>' : '') +
      (org.length ? '<div class="nota warn">' + org.map(esc).join('<br>') + '</div>' : 'Coincide con el personal ofrecido y con la administración del AIU.') + '</div></div>';
}

/* ─────────────── 14 · Evaluación y puntajes ─────────────── */
Vistas['14'] = function(){
  const c = contextoEvaluacion('14', 'Evaluación y puntajes');
  if (!c.R) return c;
  const { p, R } = c;
  const P = R.puntaje, g = R.general;
  const oculto = ocultarPrecios();
  const reqs = R.requisitos.filter(r => r.naturaleza === 'ponderable');
  const eco = Object.values(P.economicos)[0];
  const metodo = Pliego.METODOS[g.metodoEconomico] || Pliego.METODOS.menor;
  const html = cabecera('14', 'Evaluación y puntajes', c.sub) +
    (P.provisional ? '<div class="nota warn">Puntaje <b>provisional</b>: hay ofertas con la habilitación pendiente o requisitos sin calificar. Se calcula con las ofertas que no están descartadas.</div>' : '') +
    '<div class="card"><div class="card-head"><h3>Evaluación económica: ' + esc(metodo.nombre) + '</h3></div><div class="card-body small">' +
      '<div>' + esc(Pliego.formula(g)) + '</div>' + (eco ? '<div style="margin-top:6px">' + (oculto ? 'Valores ocultos hasta terminar la calificación técnica.' : esc(eco.detalle)) + '</div>' : '') +
      (g.metodoEconomico === 'trm' ? '<div class="nota' + ((p.evaluacion||{}).trm ? '' : ' warn') + '">TRM del día de la apertura: ' + ((p.evaluacion||{}).trm ? esc((p.evaluacion).trm) : 'sin registrar') + '. ' +
        (Permisos.puede('configurarEvaluacion') ? boton('registrar-trm', 'Registrar la TRM', 'xs') : '') + '</div>' : '') +
      (g.versionDocumentoTipo ? '<div class="muted">Documento tipo: ' + esc(g.versionDocumentoTipo) + '</div>' : '') + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Orden de elegibilidad</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th class="n">Puesto</th><th>Proponente</th><th class="n">Económico</th><th class="n">Técnico y demás</th><th class="n">Total</th><th>Por calificar</th></tr></thead><tbody>' +
      P.orden.map(f => { const o = R.ofertas.find(x => x.id === f.id); return '<tr><td class="n"><b>' + f.puesto + '</b></td><td>' + pastilla(p, o) + esc(f.nombre) + ' ' + tagHabilitacion(R.porOferta[f.id].habilitacion) + '</td><td class="n">' + (oculto ? '—' : cant(f.economico)) + '</td>' +
        '<td class="n">' + cant(f.tecnico) + '</td><td class="n"><b>' + (oculto ? '—' : cant(f.total)) + '</b></td><td class="small">' + esc(f.faltan.join(', ')) + '</td></tr>'; }).join('') +
      P.noHabilitadas.map(id => { const o = R.ofertas.find(x => x.id === id); return '<tr class="muted"><td class="n">—</td><td>' + pastilla(p, o) + esc(o.nombre) + ' ' + UI.tag('no habilitada', 'bad') + '</td><td colspan="4" class="small">' +
        esc(R.porOferta[id].habilitacion.causales.map(x => x.texto).join(' ')) + '</td></tr>'; }).join('') + '</tbody></table></div></div></div>' +
    (P.empates.length ? '<div class="nota warn">Empate sin resolver entre ' + P.empates.map(e => e.map(id => esc(R.ofertas.find(x => x.id === id).nombre)).join(' y ')).join('; ') + ', después de aplicar las reglas del pliego. ' +
      (Permisos.puede('decidirComite') ? boton('registrar-sorteo', 'Registrar el sorteo', 'xs primary') : 'Falta el sorteo en audiencia.') + '</div>' : '') +
    '<div class="card"><div class="card-head"><h3>Puntaje por requisito</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Requisito</th><th class="n">Máximo</th>' +
      P.filas.map(f => '<th class="n">' + pastilla(p, R.ofertas.find(x => x.id === f.id)) + esc(f.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
    reqs.map(r => '<tr id="q-' + idDom(r.codigo) + '"><td><b>' + esc(r.codigo) + '</b> ' + esc(r.nombre) + '<div class="small muted">' + esc(PlantillaCondiciones.TIPOS_REGLA[(r.reglaPuntaje||{}).tipo] || '') + '</div></td><td class="n">' + cant(r.puntajeMaximo) + '</td>' +
      P.filas.map(f => '<td class="n">' + (f.puntos[r.codigo] === undefined ? '<button class="celda-eval" type="button" data-accion="verificar" data-of="' + f.id + '" data-req="' + esc(r.codigo) + '"><span class="small muted">por calificar</span></button>'
        : (r.reglaPuntaje||{}).tipo === 'economica' && oculto ? '—' : '<button class="celda-eval" type="button" data-accion="verificar" data-of="' + f.id + '" data-req="' + esc(r.codigo) + '">' + cant(f.puntos[r.codigo]) + '</button>') + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div></div></div>' +
    (P.sensibilidad.length && !oculto ? '<div class="card"><div class="card-head"><h3>Sensibilidad: el orden si cada grupo pesa ±10 %</h3></div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Grupo</th><th>+10 %</th><th>−10 %</th></tr></thead><tbody>' +
      P.sensibilidad.map(s => '<tr><td>' + esc(s.grupo) + '</td>' + [s.mas, s.menos].map(x => '<td class="small">' + (x.cambia ? UI.tag(x.cambiaPrimero ? 'cambia el primero' : 'cambia el orden', x.cambiaPrimero ? 'bad' : 'warn') + ' ' : UI.tag('igual', 'ok') + ' ') +
        esc(x.orden.map(id => R.ofertas.find(o => o.id === id).nombre).join(' > ')) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></div></div>' : '');
  return { html, alPintar:irAResaltado, acciones:Object.assign(accionesVerificar(p, R), {
    'registrar-trm':async () => {
      const v = await UI.pedir({ titulo:'TRM del día de la apertura', campos:[{ k:'trm', lab:'Tasa representativa del mercado (pesos por dólar, con centavos)', tipo:'number', val:(p.evaluacion||{}).trm || '' }] });
      if (!v) return;
      const cfg = Object.assign({}, ...Object.entries(R.ctx.config).map(([k, x]) => ({ [k]:x })));
      await Evaluacion.guardarConfig(p, { z:cfg.desbalance.z, pctDesbalance:cfg.desbalance.pct, pesoMinPct:cfg.desbalance.pesoMinPct, minPct:cfg.desbalance.minPct, pctCargue:cfg.cargue.pct, pctCantidades:cfg.cantidades.pct,
        rendimientoPct:cfg.apu.rendimientoPct, insumoBajoPct:cfg.apu.insumoBajoPct, pesoFaltantePct:cfg.apu.pesoFaltantePct, desperdicioPct:cfg.apu.desperdicioPct, tipologia:(p.evaluacion||{}).tipologia || '', trm:v.trm });
      App.render();
    },
    'registrar-sorteo':async () => {
      const ids = P.empates[0];
      const v = await UI.pedir({ titulo:'Resultado del sorteo en audiencia', antes:'<p class="small">Escriba el puesto que salió para cada empatado (1 es el primero).</p>',
        campos:ids.map(id => ({ k:id, lab:R.ofertas.find(o => o.id === id).nombre, tipo:'number', min:1 })).concat([{ k:'acta', lab:'Acta del sorteo (número o referencia)', c2:true }]),
        validar:z => ids.some(id => !(z[id] >= 1)) ? 'Escriba el puesto de cada uno.' : '' });
      if (!v) return;
      await Evaluacion.registrarSorteo(p, ids.slice().sort((a, b) => v[a] - v[b]), v.acta); App.render();
    }
  }) };
};
