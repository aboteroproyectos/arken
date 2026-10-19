/* ══════════════════════════════════════════════════════════════════════════
   ARKEN OFERTA · REQUISITOS (módulos 05 a 12) — cada requisito del pliego
   con su ayuda al lado, el formato aceptado y el peso máximo. Los documentos
   se adjuntan contra su requisito (y, en las tablas, contra su renglón), con
   su fecha de expedición y su vigencia. 07 agrega los indicadores
   financieros, 08 el diagrama de Gantt y 09 el organigrama.
   ══════════════════════════════════════════════════════════════════════════ */
const Requisitos = (function(){

  const ACUERDO = { codigo:'ACUERDO', grupo:'Jurídico', nombre:'Acuerdo de confidencialidad firmado', tipoRespuesta:'documento', obligatorio:true,
    documento:{ tipos:['pdf'], pesoMaxMB:25, varios:false }, descripcion:'El acuerdo de confidencialidad del proceso, firmado por quien tiene facultades.', reglasVerificacion:[] };
  function buscar(pl, codigo){ return codigo === 'ACUERDO' ? ACUERDO : (pl.requisitos||[]).find(r => r.codigo === codigo); }

  function etiquetas(r){
    return UI.tag(r.naturaleza || 'habilitante', r.naturaleza === 'ponderable' ? 'brass' : 'info') + (r.tambienHabilitante ? ' ' + UI.tag('y habilitante', 'info') : '') +
      (r.obligatorio === false ? ' ' + UI.tag('opcional') : ' ' + UI.tag('obligatorio', 'bad')) + (r.puntajeMaximo ? ' ' + UI.tag(r.puntajeMaximo + ' puntos', 'brass') : '') +
      (r.subsanable === false ? ' ' + UI.tag('no subsanable', 'warn') : '');
  }
  function ayuda(r){
    const d = r.documento || {};
    return '<div class="ayuda-lado"><b>Cómo responderlo</b>' + esc(r.ayuda || r.descripcion || '') +
      (r.condicional ? '<p class="small" style="margin:6px 0 0"><i>' + esc(r.condicional) + '</i></p>' : '') +
      ((r.reglasVerificacion||[]).length ? '<p style="margin:8px 0 0"><b>Lo que se verifica</b></p><ul>' + r.reglasVerificacion.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '') +
      (r.reglaPuntaje ? '<p style="margin:8px 0 0"><b>Cómo se califica</b>' + esc(r.reglaPuntaje.nombre || '') + (r.reglaPuntaje.criterio ? ': ' + esc(r.reglaPuntaje.criterio) : '') + '</p>' : '') +
      (r.tipoRespuesta === 'documento' ? '<p class="small muted" style="margin:8px 0 0">Formato: ' + esc(Intercambio.tiposAceptados(r).join(', ')) + ' · máximo ' + (d.pesoMaxMB || 25) + ' MB' + (d.varios ? ' · varios archivos' : '') + '</p>' : '') +
      (r.notaSubsanable ? '<p class="small muted" style="margin:6px 0 0">' + esc(r.notaSubsanable) + '</p>' : '') + '</div>';
  }
  function listaAdjuntos(b, codigo, fila, columna){
    return Borrador.adjuntosDe(b, codigo, fila, columna).map(x => '<div class="adj"><b>' + esc(x.nombre) + '</b> <span class="small muted">' + Util.pesoLegible(x.peso) + '</span>' +
      (fila === undefined ? '<label class="small">Expedido <input type="date" data-cambio="adj-fecha" data-id="' + x.id + '" data-c="fechaDocumento" value="' + esc(x.fechaDocumento || '') + '"></label>' +
        '<label class="small">Vigente hasta <input type="date" data-cambio="adj-fecha" data-id="' + x.id + '" data-c="vigenteHasta" value="' + esc(x.vigenteHasta || '') + '"></label>' : '') +
      '<span class="huella">' + esc(x.sha256) + '</span>' + boton('adj-quitar', 'Quitar', 'xs ghost', ' data-id="' + x.id + '"') + '</div>').join('');
  }
  function botonAdjuntar(r, fila, columna){
    return boton('adjuntar', 'Adjuntar', 'xs', ' data-req="' + esc(r.codigo) + '"' + (fila !== undefined ? ' data-fila="' + fila + '"' : '') + (columna ? ' data-col="' + esc(columna) + '"' : ''));
  }

  function control(b, r){
    const v = b.respuestas[r.codigo];
    const d = r.dato || {};
    const a = ' data-cambio="dato" data-req="' + esc(r.codigo) + '" aria-label="' + esc(r.nombre) + '"';
    if (d.tipo === 'sí o no') return '<select' + a + '><option value=""></option>' + ['Sí','No'].map(o => '<option' + (v === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>';
    if (d.tipo === 'lista de opciones') return '<select' + a + '><option value=""></option>' + (d.opciones||[]).map(o => '<option' + (v === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>';
    const tipo = d.tipo === 'fecha' ? 'date' : ['número','moneda','porcentaje'].indexOf(d.tipo) >= 0 ? 'number' : 'text';
    return '<input type="' + tipo + '"' + (tipo === 'number' ? ' step="any"' : '') + ' value="' + esc(v === undefined ? '' : v) + '"' + a + '>';
  }
  function tipoInput(t){ return t === 'fecha' ? 'date' : ['número','moneda','porcentaje'].indexOf(t) >= 0 ? 'number' : 'text'; }
  function tabla(b, r){
    const cols = (r.tabla||{}).columnas || [];
    const fs = Borrador.filas(b, r);
    return '<div class="tw"><table class="t"><thead><tr><th>#</th>' + cols.map(c => '<th>' + esc(c.titulo) + '</th>').join('') + '<th></th></tr></thead><tbody>' +
      fs.map((f, i) => '<tr><td>' + (i + 1) + '</td>' + cols.map(c => c.tipo === 'documento'
        ? '<td>' + listaAdjuntos(b, r.codigo, i, c.clave) + (Borrador.adjuntosDe(b, r.codigo, i, c.clave).length ? '' : botonAdjuntar(r, i, c.clave)) + '</td>'
        : '<td><input type="' + tipoInput(c.tipo) + '"' + (tipoInput(c.tipo) === 'number' ? ' step="any" class="num"' : (c.tipo === 'texto' ? ' class="ancho"' : '')) +
          ' data-cambio="celda" data-req="' + esc(r.codigo) + '" data-i="' + i + '" data-c="' + esc(c.clave) + '" value="' + esc(f[c.clave] === undefined ? '' : f[c.clave]) + '" aria-label="' + esc(c.titulo) + ' del renglón ' + (i + 1) + '"></td>').join('') +
        '<td class="act">' + boton('fila-menos', '✕', 'xs', ' data-req="' + esc(r.codigo) + '" data-i="' + i + '" aria-label="Quitar renglón"') + '</td></tr>').join('') +
      '</tbody></table></div><div class="btn-row" style="margin-top:8px">' + boton('fila-mas', '+ Renglón', 'sm', ' data-req="' + esc(r.codigo) + '"') + '</div>';
  }
  /** La ficha de un requisito: qué pide, su respuesta y su ayuda al lado. */
  function tarjeta(b, r){
    const falta = Borrador.faltaRequisito(b, r);
    const revisar = (b.revisar.requisitos||[]).indexOf(r.codigo) >= 0;
    let cuerpo = '';
    if (r.tipoRespuesta === 'documento') cuerpo = listaAdjuntos(b, r.codigo) + ((r.documento||{}).varios || !Borrador.adjuntosDe(b, r.codigo).length ? '<div class="btn-row" style="margin-top:8px">' + botonAdjuntar(r) + '</div>' : '');
    else if (r.tipoRespuesta === 'dato') cuerpo = '<div class="field" style="max-width:360px">' + control(b, r) + '</div>';
    else cuerpo = tabla(b, r);
    return '<div class="card' + (revisar ? ' revisar' : '') + '" id="req-' + esc(r.codigo) + '"><div class="card-head"><h3>' + esc(r.codigo) + ' · ' + esc(r.nombre) + '</h3><div>' + etiquetas(r) + ' ' +
      UI.tag(falta.length ? 'falta' : 'completo', falta.length ? (r.obligatorio === false ? '' : 'bad') : 'ok') + '</div></div><div class="card-body"><div class="req"><div>' +
      '<p class="small">' + esc(r.descripcion || '') + '</p>' + (revisar ? '<div class="nota warn">Una adenda cambió este requisito. Revíselo. ' + boton('req-revisado', 'Marcar como revisado', 'xs', ' data-req="' + esc(r.codigo) + '"') + '</div>' : '') +
      cuerpo + '</div>' + ayuda(r) + '</div></div></div>';
  }
  function tarjetaAcuerdo(b, pl){ return tarjeta(b, ACUERDO); }

  function acciones(b, pl){
    return {
      'adjuntar':async el => {
        const r = buscar(pl, el.dataset.req);
        const fila = el.dataset.fila === undefined ? undefined : +el.dataset.fila;
        const acepta = Intercambio.tiposAceptados(r).map(x => '.' + x).join(',');
        const files = await UI.elegirArchivos(acepta, fila === undefined && !!(r.documento||{}).varios);
        if (!files.length) return;
        for (const f of files){
          await Intercambio.revisarAdjunto(f, fila === undefined ? r : { codigo:r.codigo, documento:{ tipos:['pdf','imagen'], pesoMaxMB:25 } });
          const g = await Intercambio.guardarAdjunto(f);
          b.adjuntos.push({ id:Util.uid('aj'), requisito:r.codigo, fila, columna:el.dataset.col || undefined, nombre:Paquete.nombreSeguro(f.name), sha256:g.sha256, peso:g.peso, fechaDocumento:'', vigenteHasta:'', agregado:new Date().toISOString() });
        }
        await Oferta.guardar(); UI.toast(files.length + ' archivo(s) adjunto(s) a ' + r.codigo, 'ok'); App.render();
      },
      'adj-quitar':async el => { b.adjuntos = b.adjuntos.filter(x => x.id !== el.dataset.id); await Oferta.guardar(); App.render(); },
      'fila-mas':async el => { const v = b.respuestas[el.dataset.req]; b.respuestas[el.dataset.req] = (Array.isArray(v) ? v : []).concat([{}]); await Oferta.guardar(); App.render(); },
      'fila-menos':async el => {
        const c = el.dataset.req, i = +el.dataset.i;
        b.respuestas[c].splice(i, 1);
        // Los adjuntos de los renglones siguientes suben un lugar.
        b.adjuntos = b.adjuntos.filter(x => !(x.requisito === c && x.fila === i)).map(x => x.requisito === c && x.fila > i ? Object.assign(x, { fila:x.fila - 1 }) : x);
        await Oferta.guardar(); App.render();
      },
      'req-revisado':async el => { Borrador.marcarRevisado(b, 'requisitos', el.dataset.req); await Oferta.guardar(); App.render(); }
    };
  }
  function cambios(b, pl){
    return {
      'dato':async el => { b.respuestas[el.dataset.req] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; await Oferta.guardar(); App.pintarCinta(); },
      'celda':async el => { const f = b.respuestas[el.dataset.req][+el.dataset.i]; f[el.dataset.c] = el.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value; await Oferta.guardar(); App.pintarCinta(); },
      'adj-fecha':async el => { const x = b.adjuntos.find(a => a.id === el.dataset.id); if (x){ x[el.dataset.c] = el.value; await Oferta.guardar(); } }
    };
  }

  /* ── Vista genérica de un módulo de requisitos ── */
  function vista(id, titulo, extra){
    return function(){
      const b = Oferta.borrador(), pl = Oferta.pl();
      const reqs = Borrador.requisitosDe(pl, id);
      const ex = extra ? extra(b, pl, reqs) : null;
      const html = cabecera(id, titulo, reqs.length + ' requisito(s) del pliego' + etiquetaDemo(pl), ex && ex.acciones ? ex.accionesHtml : '') + (ex ? ex.html : '') +
        reqs.filter(r => !(ex && ex.omitir && ex.omitir(r))).map(r => tarjeta(b, r)).join('');
      return { html, acciones:Object.assign(acciones(b, pl), ex ? ex.acciones || {} : {}), cambios:Object.assign(cambios(b, pl), ex ? ex.cambios || {} : {}) };
    };
  }
  return { ACUERDO, buscar, tarjeta, tarjetaAcuerdo, acciones, cambios, vista };
})();

Vistas['05'] = Requisitos.vista('05', 'Personal');
Vistas['06'] = Requisitos.vista('06', 'Experiencia');
Vistas['10'] = Requisitos.vista('10', 'Proveedores');
Vistas['11'] = Requisitos.vista('11', 'Sistemas de gestión');
Vistas['12'] = Requisitos.vista('12', 'Requisitos adicionales');

/* ── 07 · Financiero: un solo formulario para todos los indicadores ── */
const COLS_FIN = PlantillaCondiciones.columnas('financiero');
function indicadores(f){
  const n = k => Number((f||{})[k] || 0);
  const div = (a, c) => c ? a / c : null;
  return [['Liquidez (AC / PC)', div(n('activoCorriente'), n('pasivoCorriente')), 2], ['Endeudamiento (PT / AT)', div(n('pasivoTotal'), n('activoTotal')), 2],
    ['Cobertura de intereses (UO / GI)', n('gastosIntereses') ? n('utilidadOperacional') / n('gastosIntereses') : (n('utilidadOperacional') ? 'Sin gastos de intereses' : null), 2],
    ['Capital de trabajo (AC − PC)', n('activoCorriente') - n('pasivoCorriente'), -1], ['Rentabilidad del patrimonio (UO / P)', div(n('utilidadOperacional'), n('patrimonio')), 3],
    ['Rentabilidad del activo (UO / AT)', div(n('utilidadOperacional'), n('activoTotal')), 3]];
}
Vistas['07'] = Requisitos.vista('07', 'Financiero', (b, pl, reqs) => {
  const fin = reqs.filter(r => r.tipoRespuesta === 'tabla' && (r.tabla||{}).plantilla === 'financiero');
  if (!fin.length) return null;
  const f = b.financiero || {};
  const html = '<div class="card"><div class="card-head"><h3>Estados financieros · ' + fin.map(r => r.codigo).join(', ') + '</h3>' + boton('guardar-fin', 'Guardar', 'sm primary') + '</div><div class="card-body">' +
    '<p class="small">Escriba una sola vez las cifras del último año: sirven para todos los indicadores del pliego. Las cifras se verifican contra los estados financieros que adjunte.</p>' +
    UI.formulario(COLS_FIN.map(c => ({ k:c.clave, lab:c.titulo, tipo:c.tipo === 'fecha' ? 'date' : 'number', val:f[c.clave] })), 'fi') +
    '<div class="tw" style="margin-top:12px"><table class="t"><thead><tr><th>Indicador</th><th class="n">Valor</th></tr></thead><tbody>' +
      indicadores(f).map(([n, v, d]) => '<tr><td>' + esc(n) + '</td><td class="n">' + (v === null ? '—' : typeof v === 'string' ? esc(v) : d < 0 ? money(v) : Util.redondearDec(v, d).toFixed(d)) + '</td></tr>').join('') +
    '</tbody></table></div><p class="small muted">Lo que exige el pliego está en cada requisito, abajo. El programa no califica: la EMPRESA PRINCIPAL verifica.</p></div></div>';
  return { html, omitir:r => fin.indexOf(r) >= 0, acciones:{ 'guardar-fin':async () => {
    const v = UI.leer(COLS_FIN.map(c => ({ k:c.clave, tipo:c.tipo === 'fecha' ? 'date' : 'number' })), document, 'fi');
    b.financiero = v;
    fin.forEach(r => { b.respuestas[r.codigo] = [Object.assign({}, v)]; });
    await Oferta.guardar(); UI.toast('Estados financieros guardados', 'ok'); App.render();
  } } };
});

/* ── 08 · Programación: Gantt con dependencias, desde Project o Excel ── */
function gantt(filas, plazoDias){
  const ds = filas.map(f => [Util.fechaDe(f.inicio), Util.fechaDe(f.fin)]).filter(([a, c]) => a && c);
  if (!ds.length) return '<div class="nota">Escriba inicio y fin de las actividades para ver el diagrama.</div>';
  const min = Math.min.apply(null, ds.map(x => x[0].getTime())), max = Math.max.apply(null, ds.map(x => x[1].getTime()));
  const total = Math.max(1, Math.round((max - min) / 86400000) + 1);
  const meses = [];
  for (let d = new Date(min); d.getTime() <= max; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) meses.push(Util.MESES[d.getMonth()].slice(0, 3) + ' ' + String(d.getFullYear()).slice(2));
  const porNombre = new Map(filas.map((f, i) => [Util.normaliza(f.actividad), i]));
  return '<div class="gantt"><div class="gantt-inner"><div class="g-row head"><div class="g-lab"><b>Actividad</b></div><div class="g-track" style="padding:0"><div class="g-months">' + meses.map(m => '<div class="m">' + esc(m) + '</div>').join('') + '</div></div></div>' +
    filas.map(f => {
      const a = Util.fechaDe(f.inicio), c = Util.fechaDe(f.fin);
      const preds = String(f.predecesoras||'').split(',').map(s => s.trim()).filter(Boolean);
      const malas = preds.filter(p => !porNombre.has(Util.normaliza(p)));
      const bar = a && c ? '<div class="g-bar" style="left:' + ((a - min) / 86400000 / total * 100).toFixed(2) + '%;width:' + Math.max(0.6, ((c - a) / 86400000 + 1) / total * 100).toFixed(2) + '%" title="' + esc(Util.fmtFecha(f.inicio) + ' a ' + Util.fmtFecha(f.fin)) + '"><i style="width:100%"></i></div>' : '';
      return '<div class="g-row"><div class="g-lab"><span class="t">' + esc(f.actividad) + '</span>' + (preds.length ? '<span class="small muted">← ' + esc(preds.join(', ')) + '</span>' : '') + (malas.length ? UI.tag('predecesora no encontrada', 'bad') : '') + '</div><div class="g-track">' + bar + '</div></div>';
    }).join('') + '</div></div><p class="small ' + (plazoDias && total > plazoDias ? 'bad-txt' : 'muted') + '" style="margin-top:6px">Plazo total programado: ' + total + ' días calendario' + (plazoDias ? ' · plazo máximo del pliego: ' + plazoDias + ' días' : '') + '.</p>';
}
Vistas['08'] = Requisitos.vista('08', 'Programación', (b, pl, reqs) => {
  const r = reqs.find(x => x.tipoRespuesta === 'tabla');
  if (!r) return null;
  const filas = Borrador.filas(b, r);
  const asignar = async (nuevas, origen) => {
    if (filas.length && !(await UI.confirmar({ titulo:'Reemplazar la programación', mensaje:'La programación actual (' + filas.length + ' renglones) se reemplaza por la de ' + origen + ' (' + nuevas.length + ' renglones).', textoAceptar:'Reemplazar' }))) return;
    b.respuestas[r.codigo] = nuevas; await Oferta.guardar(); UI.toast(nuevas.length + ' actividades importadas de ' + origen, 'ok'); App.render();
  };
  return { html:'<div class="card"><div class="card-head"><h3>Diagrama de Gantt · ' + esc(r.codigo) + '</h3><div class="btn-row">' + boton('prog-project', 'Importar de Microsoft Project (XML)', 'sm') + boton('prog-excel', 'Importar de Excel', 'sm') +
      boton('prog-actividades', 'Agregar las actividades del presupuesto', 'sm') + '</div></div><div class="card-body">' + gantt(filas, pl.proceso.plazoMaximoDias) +
      '<p class="small muted">Las predecesoras se escriben con el nombre (o el código) de la actividad, separadas por comas. Edite los renglones en la tabla del requisito, abajo.</p></div></div>',
    acciones:{
      'prog-project':async () => { const [f] = await UI.elegirArchivos('.xml'); if (f) await asignar(Intercambio.leerProject(await f.text()), 'Microsoft Project'); },
      'prog-excel':async () => { const [f] = await UI.elegirArchivos('.xlsx,.xls'); if (f) await asignar(Intercambio.leerProgramacionExcel(await f.arrayBuffer()), 'Excel'); },
      'prog-actividades':async () => {
        const ya = new Set(filas.map(f => Util.normaliza(f.actividad)));
        const nuevas = Borrador.actividades(pl).filter(a => !ya.has(Util.normaliza(a.codigo))).map(a => ({ actividad:a.codigo, inicio:'', fin:'', predecesoras:'', cuadrillas:'' }));
        b.respuestas[r.codigo] = filas.concat(nuevas); await Oferta.guardar(); UI.toast(nuevas.length + ' actividades agregadas: escriba su inicio y su fin', 'ok'); App.render();
      }
    } };
});

/* ── 09 · Organigrama ── */
function arbolOrganigrama(lista){
  const hijos = (jefe) => lista.filter(x => Util.normaliza(x.reportaA) === Util.normaliza(jefe) && Util.normaliza(x.cargo) !== Util.normaliza(jefe));
  const raiz = lista.filter(x => !x.reportaA || !lista.some(y => Util.normaliza(y.cargo) === Util.normaliza(x.reportaA)));
  const pinta = (xs, prof) => prof > 8 || !xs.length ? '' : '<ul>' + xs.map(x => '<li><b>' + esc(x.cargo) + '</b>' + (x.nombre ? ' · ' + esc(x.nombre) : '') + pinta(hijos(x.cargo), prof + 1) + '</li>').join('') + '</ul>';
  return '<div class="organigrama">' + pinta(raiz, 0) + '</div>';
}
Vistas['09'] = Requisitos.vista('09', 'Organigrama', (b) => {
  const L = b.organigrama || [];
  return { html:'<div class="card"><div class="card-head"><h3>Organigrama de la obra</h3>' + boton('org-mas', '+ Cargo', 'sm') + '</div><div class="card-body"><div class="grid g2"><div class="tw"><table class="t"><thead><tr><th>Cargo</th><th>Nombre</th><th>Reporta a (cargo)</th><th></th></tr></thead><tbody>' +
      L.map((x, i) => '<tr>' + ['cargo','nombre','reportaA'].map(c => '<td><input data-cambio="org" data-i="' + i + '" data-c="' + c + '" value="' + esc(x[c] || '') + '" aria-label="' + c + '"></td>').join('') + '<td class="act">' + boton('org-menos', '✕', 'xs', ' data-i="' + i + '" aria-label="Quitar cargo"') + '</td></tr>').join('') +
      '</tbody></table></div><div>' + (L.length ? arbolOrganigrama(L) : '<p class="small muted">Agregue los cargos para ver el organigrama. Debe coincidir con el personal ofrecido.</p>') + '</div></div></div></div>',
    acciones:{ 'org-mas':async () => { b.organigrama = L.concat([{ cargo:'', nombre:'', reportaA:'' }]); await Oferta.guardar(); App.render(); },
      'org-menos':async el => { L.splice(+el.dataset.i, 1); await Oferta.guardar(); App.render(); } },
    cambios:{ 'org':async el => { L[+el.dataset.i][el.dataset.c] = el.value.trim(); await Oferta.guardar(); } } };
});
