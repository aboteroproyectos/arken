/* ─────────────── Fase 4 en el principal ───────────────
   15 · Comparativo y cuadro gerencial, 16 · Concepto e informe.
   Las vistas solo pintan lo que arman Comparativo, Graficas, Concepto e
   Informe, y llaman a Decision, que valida, guarda, firma y audita. */

const FILTRO15 = { nivel:'capitulo', capitulo:'', soloAlertas:false, pesoMinPct:0, todas:false };
const GRAFICAS = { capitulo:'', ofertaId:'', resaltado:'' };
const FILAS_INICIALES = 400;
const TAG_SEMAFORO = { verde:'ok', amarillo:'warn', rojo:'bad' };

/** Celda de requisito × proponente: un clic abre la verificación, con el documento, la página y la regla (criterio 7). */
function celdaEval(ofertaId, codigo, contenido){ return '<button class="celda-eval" type="button" data-accion="verificar" data-of="' + ofertaId + '" data-req="' + esc(codigo) + '">' + contenido + '</button>'; }

/* ── Cuadro comparativo ── */
function tablaComparativo(p, R, C){
  const cols = R.ofertas;
  const filas = FILTRO15.todas ? C.filas : C.filas.slice(0, FILAS_INICIALES);
  const celda = x => !x ? '<td class="n muted">—</td><td></td><td></td>' :
    '<td class="n cmp ' + x.clase + '">' + money(x.valor) + '</td><td class="n small">' + pctD(x.pctBase) + '</td><td class="n small muted">' + pctD(x.pctMediana) + '</td>';
  const fila = f => '<tr class="' + (f.tipo === 'cap' ? 'cmp-cap' : f.tipo === 'sub' ? 'cmp-sub' : f.tipo === 'pie' ? 'cmp-pie' : 'cmp-act') + '">' +
    '<td class="cod">' + esc(f.codigo || '') + (f.alerta ? ' <span class="punto-alerta" title="Tiene alertas"></span>' : '') + '</td><td>' + esc(f.nombre) + '</td><td class="n">' + money(f.base) + '</td>' + cols.map(o => celda(f.celdas[o.id])).join('') + '</tr>';
  return '<div class="tw scroll comparativo"><table class="t"><thead><tr><th rowspan="2">Código</th><th rowspan="2">Descripción</th><th class="n" rowspan="2">Presupuesto base</th>' +
    cols.map(o => '<th colspan="3" class="n">' + pastilla(p, o) + esc(o.nombre) + '</th>').join('') + '</tr><tr>' + cols.map(() => '<th class="n">Valor</th><th class="n">Δ base</th><th class="n">Δ mediana</th>').join('') + '</tr></thead><tbody>' +
    filas.map(fila).join('') + (C.filas.length > filas.length ? '<tr><td colspan="' + (3 + cols.length * 3) + '" class="small">' + boton('cmp-todas', 'Mostrar las ' + C.filas.length + ' filas', 'xs') + ' Se muestran ' + filas.length + '.</td></tr>' : '') +
    C.pie.map(fila).join('') + '</tbody></table></div>';
}
function filtrosComparativo(R){
  const caps = (R.ctx.base.capitulos || []).map(c => [c.codigo, c.codigo + ' · ' + c.nombre]);
  const sel = (k, opts) => '<select data-f15="' + k + '">' + opts.map(([v, n]) => '<option value="' + esc(v) + '"' + (String(FILTRO15[k]) === String(v) ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>';
  return '<div class="row filtros" style="gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' +
    sel('nivel', [['capitulo', 'Por capítulo'], ['subcapitulo', 'Por subcapítulo'], ['actividad', 'Por actividad']]) +
    sel('capitulo', [['', 'Todos los capítulos']].concat(caps)) +
    '<label class="checkline"><input type="checkbox" data-f15="soloAlertas"' + (FILTRO15.soloAlertas ? ' checked' : '') + '> Solo con alertas</label>' +
    '<label class="small">Pesan más de <input type="number" min="0" max="100" step="0.1" data-f15="pesoMinPct" value="' + esc(FILTRO15.pesoMinPct) + '" style="width:70px"> %</label></div>';
}

/* ── Cuadro gerencial ── */
function tablaGerencial(p, R, G){
  return '<div class="portada-cuadro ' + (G.recomendado ? 'ok' : '') + '"><div class="eyebrow">Cuadro gerencial · ' + esc(p.codigo) + '</div><div class="titulo">' + esc(G.portada) + '</div>' +
      (G.provisional ? '<div class="small">Puntaje provisional.</div>' : '') + '</div>' +
    '<div class="tw scroll"><table class="t"><thead><tr><th class="n">Puesto</th><th>Proponente</th><th class="n">Valor total</th><th class="n">Δ base</th><th class="n">Plazo</th><th class="n">AIU</th><th>Habilitación</th>' +
      G.grupos.map(g => '<th class="n">' + esc(g) + '</th>').join('') + '<th class="n">Total</th><th class="n">Experiencia</th><th>Financieros</th><th class="n">Críticas</th><th>Semáforo</th></tr></thead><tbody>' +
    G.filas.map(f => { const o = R.ofertas.find(x => x.id === f.id);
      return '<tr><td class="n"><b>' + (f.puesto || '—') + '</b></td><td class="proponente">' + pastilla(p, o) + esc(f.nombre) + '</td><td class="n">' + money(f.total) + '</td><td class="n">' + pctD(f.pctBase) + '</td>' +
        '<td class="n">' + (f.plazo === null ? '—' : f.plazo + ' d') + '</td><td class="n">' + Util.pct(f.aiuPct) + '</td><td>' + tagHabilitacion({ estado:f.habilitacion }) + '</td>' +
        G.grupos.map(g => '<td class="n">' + (f.grupos[g] === undefined ? '—' : cant(f.grupos[g])) + '</td>').join('') + '<td class="n">' + (f.puntaje === null ? '—' : '<button class="celda-eval" type="button" data-accion="ir-puntajes" title="Ver el puntaje por requisito"><b>' + cant(f.puntaje) + '</b></button>') + '</td>' +
        '<td class="n">' + (f.experiencia ? cant(Util.redondear(f.experiencia.suma)) + ' SMMLV' : '—') + '</td><td class="small">' + f.financieros.map(i => '<span class="' + (i.cumple ? '' : 'txt-bad') + '">' + esc(i.nombre) + ' ' + (Math.abs(i.valor) >= 1000 ? money(i.valor) : cant(Util.redondearDec(i.valor, 2))) + '</span>').join('<br>') + '</td>' +
        '<td class="n">' + f.criticas + '</td><td>' + UI.tag(f.semaforo, TAG_SEMAFORO[f.semaforo]) + '</td></tr>'; }).join('') + '</tbody></table></div>';
}

/* ── Gráficas ── */
function tarjetaGrafica(p, R, g, enInforme){
  const selOferta = (g.id === 'cascada' || g.id === 'desbalance') ? '<select data-goferta="' + g.id + '">' + R.ofertas.map(o => '<option value="' + o.id + '"' + (GRAFICAS.ofertaId === o.id ? ' selected' : '') + '>' + esc(o.nombre) + '</option>').join('') + '</select>' : '';
  const volver = g.id === 'calor' && GRAFICAS.capitulo ? boton('g-volver', '← Todos los capítulos', 'xs') : '';
  return '<div class="card grafica-card" id="gr-' + g.id + '"><div class="card-head"><h3>' + g.numero + '. ' + esc(g.titulo) + '</h3><div class="btn-row">' + selOferta + volver +
      '<button class="btn xs" type="button" data-accion="g-exportar" data-g="' + g.id + '" data-f="png">PNG</button><button class="btn xs" type="button" data-accion="g-exportar" data-g="' + g.id + '" data-f="svg">SVG</button>' +
      '<button class="btn xs" type="button" data-accion="g-exportar" data-g="' + g.id + '" data-f="pdf">PDF</button><button class="btn xs" type="button" data-accion="g-completa" data-g="' + g.id + '">Pantalla completa</button>' +
      (Permisos.puede('generarInforme') ? '<button class="btn xs ' + (enInforme ? 'brass' : 'ghost') + '" type="button" data-accion="g-informe" data-g="' + g.id + '">' + (enInforme ? 'En el informe ✓' : 'Agregar al informe') + '</button>' : '') + '</div></div>' +
    '<div class="card-body"><div class="lienzo">' + g.svg + '</div><p class="small muted">' + esc(g.descripcion) + '</p></div></div>';
}
function galeria(p, R, soloIds){
  const op = { colores:Decision.colores(p, R), ofertaId:GRAFICAS.ofertaId || undefined, capitulo:GRAFICAS.capitulo || undefined };
  const enInforme = new Set(Decision.configInforme(p, R).graficas);
  return '<div class="graficas' + (GRAFICAS.resaltado ? ' hay-resalte' : '') + '">' + Graficas.LISTA.filter(x => !soloIds || soloIds.indexOf(x.id) >= 0).map(x => {
    try { return tarjetaGrafica(p, R, Graficas.una(x.id, R, op), enInforme.has(x.id)); }
    catch(e){ RegistroTecnico.anotar('gráfica ' + x.id, e); return '<div class="nota bad">No se pudo dibujar «' + esc(x.nombre) + '»: ' + esc(e.message) + '</div>'; }
  }).join('') + '</div>';
}
/** Interacción de las gráficas: un clic en un proponente lo resalta en todas; en un capítulo, baja a sus subcapítulos. */
function conectarGraficas(){
  const raiz = $('#stage .graficas'); if (!raiz) return;
  const marcar = () => { raiz.classList.toggle('hay-resalte', !!GRAFICAS.resaltado); $$('[data-of]', raiz).forEach(el => el.classList.toggle('on', el.getAttribute('data-of') === GRAFICAS.resaltado)); };
  marcar();
  raiz.addEventListener('click', e => {
    const cap = e.target.closest('[data-cap]');
    if (cap && raiz.contains(cap)){ GRAFICAS.capitulo = cap.getAttribute('data-cap'); App.render(); setTimeout(() => { const c = $('#gr-calor'); if (c) c.scrollIntoView({ block:'start' }); }, 0); return; }
    const of = e.target.closest('[data-of]');
    if (of && raiz.contains(of)){ const id = of.getAttribute('data-of'); GRAFICAS.resaltado = GRAFICAS.resaltado === id ? '' : id; marcar(); }
  });
  $$('[data-goferta]', raiz).forEach(s => s.onchange = () => { GRAFICAS.ofertaId = s.value; App.render(); });
}
function accionesGraficas(p){
  return {
    'g-exportar':el => Decision.exportarGrafica(p, el.dataset.g, el.dataset.f, { ofertaId:GRAFICAS.ofertaId || undefined, capitulo:GRAFICAS.capitulo || undefined }),
    'g-completa':el => { const c = $('#gr-' + el.dataset.g); if (c && c.requestFullscreen) return c.requestFullscreen(); },
    'g-informe':async el => { const dentro = await Decision.alternarGrafica(p, el.dataset.g); UI.toast(dentro ? 'La gráfica va en el informe.' : 'La gráfica sale del informe.', 'ok'); App.render(); },
    'g-volver':() => { GRAFICAS.capitulo = ''; App.render(); }
  };
}

/* ─────────────── 15 · Comparativo y cuadro gerencial ─────────────── */
Vistas['15'] = function(){
  const c = contextoEvaluacion('15', 'Comparativo y cuadro gerencial');
  if (!c.R) return c;
  const { p, R } = c;
  const oculto = ocultarPrecios();
  if (oculto) return { html:cabecera('15', 'Comparativo y cuadro gerencial', c.sub) + '<div class="nota">Los precios están ocultos para los evaluadores técnicos hasta terminar la calificación técnica.</div>' };
  const tab = UI.pestanaActiva('c15', 'comparativo');
  const pest = UI.pestanas('c15', [['comparativo', 'Cuadro comparativo'], ['gerencial', 'Cuadro gerencial'], ['requisitos', 'Requisitos'], ['graficas', 'Gráficas']], tab);
  let cuerpo = '';
  if (tab === 'comparativo'){
    const C = Comparativo.cuadro(R, FILTRO15);
    cuerpo = '<div class="card"><div class="card-head"><h3>Presupuesto base y una columna por proponente</h3><div class="btn-row">' + boton('cmp-excel', 'Excel', 'xs') + boton('cmp-pdf', 'PDF', 'xs') + '</div></div><div class="card-body">' +
      filtrosComparativo(R) + '<div class="small muted" style="margin-bottom:6px">Color por desviación frente a la base: azul más barato, rojo más caro. Δ mediana es frente a la mediana de las ofertas en ese renglón.</div>' +
      (C.filas.length ? tablaComparativo(p, R, C) : UI.vacio('Ningún renglón cumple el filtro', '')) + '</div></div>';
  } else if (tab === 'gerencial'){
    const G = Comparativo.gerencial(R, { alertas:Evaluacion.alertas(p.id), concepto:Decision.estadoRapido(p) });
    cuerpo = '<div class="card"><div class="card-head"><h3>Cuadro gerencial</h3><div class="btn-row">' + boton('ger-excel', 'Excel', 'xs') + boton('ger-pdf', 'PDF', 'xs') + '</div></div><div class="card-body">' + tablaGerencial(p, R, G) + '</div></div>';
  } else if (tab === 'requisitos'){
    const L = Comparativo.requisitos(R);
    cuerpo = '<div class="card"><div class="card-head"><h3>Cada requisito, por proponente</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Requisito</th>' + R.ofertas.map(o => '<th>' + pastilla(p, o) + esc(o.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
      L.map(f => '<tr><td class="req-nombre"><b>' + esc(f.codigo) + '</b> ' + esc(f.nombre) + ' <span class="small muted">' + esc(f.grupo) + '</span>' + (f.adicional ? ' ' + UI.tag('creado por usted', 'info') : '') + '</td>' +
        R.ofertas.map(o => { const x = f.celdas[o.id]; return '<td>' + celdaEval(o.id, f.codigo, UI.tag(x.cumple, TAG_CUMPLE[x.cumple]) + (x.puntos !== null ? ' <span class="num small">' + cant(x.puntos) + ' pts</span>' : '')) + '</td>'; }).join('') + '</tr>').join('') + '</tbody></table></div></div></div>';
  } else {
    cuerpo = '<div class="nota">Un clic en un proponente lo resalta en todas las gráficas; un clic en un capítulo del mapa de calor, de la cascada o de la caja baja a sus subcapítulos.</div>' + galeria(p, R);
  }
  const html = cabecera('15', 'Comparativo y cuadro gerencial', c.sub) + (R.puntaje.provisional ? '<div class="nota warn">Puntaje <b>provisional</b>: faltan verificaciones o subsanaciones.</div>' : '') + pest + cuerpo;
  const descargarCuadro = (formato, gerencial) => {
    const A = Informe.armar(R, { secciones:Informe.secciones(R).map(s => ({ id:s.id, marcada:s.id === (gerencial ? 'cuadros' : 'analisisCap') })) }, { alertas:Evaluacion.alertas(p.id), concepto:Decision.estadoRapido(p).estado === 'firmado' ? { estado:'firmado', final:{ recomendado:Decision.estadoRapido(p).recomendado } } : null });
    const base = 'ARKEN_ANALYTICA_' + Util.codigoArchivo(p.codigo) + (gerencial ? '_Cuadro_gerencial' : '_Comparativo') + '_' + Util.hoyISO().replace(/-/g, '');
    if (formato === 'xlsx'){
      const C = Comparativo.tabla(Comparativo.cuadro(R, FILTRO15), true);
      const wb = XLSX.utils.book_new();
      if (gerencial) A.hojas.forEach(h => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(h.filas), h.nombre));
      else XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([C.cabeza].concat(C.filas.map(f => f.celdas))), 'Comparativo');
      UI.descargar(base + '.xlsx', new Blob([XLSX.write(wb, { type:'array', bookType:'xlsx' })]));
    } else UI.descargar(base + '.pdf', Pdf.generar({ titulo:gerencial ? 'Cuadro gerencial' : 'Cuadro comparativo', subtitulo:p.codigo + ' · ' + p.nombre + (p.demo ? ' · DEMOSTRACIÓN' : ''), documento:gerencial ? 'Cuadro gerencial' : 'Cuadro comparativo', orientacion:'l', bloques:A.bloques }).blob);
    return Auditoria.registrar('exportar', gerencial ? 'cuadro gerencial' : 'cuadro comparativo', formato, p.id);
  };
  return { html, alPintar:() => {
    $$('#stage [data-f15]').forEach(el => el.onchange = () => { const k = el.dataset.f15; FILTRO15[k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) || 0 : el.value; FILTRO15.todas = false; App.render(); });
    conectarGraficas();
  }, acciones:Object.assign(accionesGraficas(p), accionesVerificar(p, R), {
    'ir-puntajes':() => App.ir('14'),
    'cmp-todas':() => { FILTRO15.todas = true; App.render(); },
    'cmp-excel':() => descargarCuadro('xlsx', false), 'cmp-pdf':() => descargarCuadro('pdf', false),
    'ger-excel':() => descargarCuadro('xlsx', true), 'ger-pdf':() => descargarCuadro('pdf', true)
  }) };
};

/* ─────────────── 16 · Concepto e informe ─────────────── */
function listaTexto(L){ return (L || []).join('\n'); }
function deTexto(t){ return String(t || '').split('\n').map(x => x.trim()).filter(Boolean); }

function vistaConcepto(p, R, k){
  const nom = id => (R.ofertas.find(o => o.id === id) || {}).nombre || id;
  const c = k.final, puede = Permisos.puede('redactarConcepto') && k.estado !== 'firmado';
  const ta = (id, v, filas) => '<textarea id="' + id + '" rows="' + (filas || 3) + '"' + (puede ? '' : ' disabled') + '>' + esc(v || '') + '</textarea>';
  return '<div class="card"><div class="card-head"><h3>Concepto de adjudicación ' + UI.tag(k.estado === 'firmado' ? 'firmado' : 'borrador: no es una decisión', k.estado === 'firmado' ? 'ok' : 'warn') + '</h3><div class="btn-row">' +
      boton('concepto-pdf', 'PDF del concepto', 'xs') + (puede ? boton('concepto-guardar', 'Guardar los textos', 'xs primary') : '') +
      (k.estado !== 'firmado' && Permisos.puede('decidirComite') ? boton('concepto-firmar', 'Firmar (comité)', 'xs brass') : '') +
      (k.estado === 'firmado' && Permisos.puede('decidirComite') ? boton('concepto-anular', 'Anular las firmas', 'xs ghost') : '') +
      (k.estado === 'firmado' && Permisos.puede('exportarAdjudicado') ? boton('exportar-adjudicado', 'Presupuesto adjudicado para ARKEN CONTROL', 'xs brass') : '') + '</div></div><div class="card-body">' +
    '<div id="avisoFirma"></div>' +
    (c.provisional ? '<div class="nota warn">El puntaje es provisional: el concepto se puede redactar, pero no firmar.</div>' : '') +
    '<div class="field"><label for="cc_resumen">Resumen del proceso y de las ofertas</label>' + ta('cc_resumen', c.resumen, 4) + '</div>' +
    '<h4 class="chk-grupo">Por requisito y grupo: quién fue el mejor y por qué</h4><div class="tw scroll"><table class="t"><thead><tr><th>Grupo</th><th>Requisito</th>' + R.ofertas.map(o => '<th>' + pastilla(p, o) + esc(o.nombre) + '</th>').join('') + '<th>Mejor</th></tr></thead><tbody>' +
      c.porGrupo.map(g => g.requisitos.map((r, i) => '<tr><td class="small">' + (i ? '' : '<b>' + esc(g.grupo) + '</b>') + '</td><td class="req-nombre"><b>' + esc(r.codigo) + '</b> ' + esc(r.nombre) + '</td>' +
        R.ofertas.map(o => { const x = r.resultados[o.id]; return '<td>' + celdaEval(o.id, r.codigo, UI.tag(x.cumple, TAG_CUMPLE[x.cumple]) + (x.puntos !== null ? ' <span class="num small">' + cant(x.puntos) + '</span>' : '')) + '</td>'; }).join('') +
        '<td class="small">' + esc(r.mejor.map(nom).join(', ') || '—') + '<div class="muted">' + esc(r.porque) + '</div></td></tr>').join('')).join('') + '</tbody></table></div>' +
    '<h4 class="chk-grupo">Cada proponente: fortalezas y lo que no es adecuado</h4><div class="grid g2">' +
      R.ofertas.map(o => '<div class="card"><div class="card-head"><h3>' + pastilla(p, o) + esc(o.nombre) + '</h3></div><div class="card-body small">' +
        '<b>Fortalezas</b><ul>' + ((c.fortalezas[o.id] || []).map(f => '<li>' + esc(f.texto) + '</li>').join('') || '<li class="muted">—</li>') + '</ul>' +
        '<b>Lo que no es adecuado, y por qué</b><ul>' + ((c.debilidades[o.id] || []).map(f => '<li>' + esc(f.texto) + '</li>').join('') || '<li class="muted">Nada, según las alertas confirmadas y los requisitos.</li>') + '</ul></div></div>').join('') + '</div>' +
    '<h4 class="chk-grupo">Orden de elegibilidad y recomendación</h4><ol>' + c.orden.map(f => '<li>' + esc(f.nombre) + ' · <span class="num">' + cant(f.total) + '</span> puntos</li>').join('') + '</ol>' +
    (c.noHabilitadas.length ? '<p class="small muted">No habilitadas: ' + c.noHabilitadas.map(x => esc(x.nombre)).join(', ') + '.</p>' : '') +
    '<div class="field"><label for="cc_recomendacion">Recomendación</label>' + ta('cc_recomendacion', c.recomendacion, 3) + '</div>' +
    '<div class="field"><label for="cc_condiciones">Condiciones de la recomendación (una por línea)</label>' + ta('cc_condiciones', listaTexto(c.condiciones), 4) + '</div>' +
    c.orden.slice(0, 2).map(f => '<div class="field"><label for="cc_riesgo_' + idDom(f.id) + '">Riesgos de adjudicar a ' + esc(f.nombre) + ' (uno por línea)</label>' + ta('cc_riesgo_' + idDom(f.id), listaTexto(c.riesgos[f.id]), 3) + '</div>').join('') +
    '<div class="field"><label for="cc_notas">Notas del comité</label>' + ta('cc_notas', c.notas || '', 2) + '</div>' +
    '<h4 class="chk-grupo">Firmas del comité</h4>' + (k.firmas.length ? '<ul>' + k.firmas.map(f => '<li>' + esc(f.nombre) + ' (' + esc(f.usuario) + ') · ' + Util.fmtSello(f.fecha) + '</li>').join('') + '</ul><p class="small muted huella">Huella del texto firmado: ' + esc(k.huella) + '</p>' : '<p class="small muted">Sin firmas. Mientras no esté firmado, cada página lleva la marca «Borrador: no es una decisión».</p>') +
    '</div></div>';
}
function vistaInforme(p, R){
  const cfg = Decision.configInforme(p, R);
  const puede = Permisos.puede('generarInforme');
  return '<div class="card"><div class="card-head"><h3>Secciones del informe</h3><div class="btn-row">' + (puede ? boton('informe-generar', 'Generar el informe (PDF y Excel)', 'primary') : '') + '</div></div><div class="card-body">' +
    '<p class="small">Marque las secciones que lleva y ordénelas arrastrándolas o con las flechas. Las de los requisitos que usted creó aparecen solas.</p>' +
    '<ol class="lista-secciones" id="listaSecciones">' + cfg.secciones.map((s, i) => '<li draggable="' + (puede ? 'true' : 'false') + '" data-sec="' + esc(s.id) + '"><span class="asa" aria-hidden="true">⋮⋮</span>' +
      '<label class="checkline"><input type="checkbox" data-secc="' + esc(s.id) + '"' + (s.marcada ? ' checked' : '') + (puede ? '' : ' disabled') + '> ' + esc(s.nombre) + (s.adicional ? ' ' + UI.tag('creado por usted', 'info') : '') + '</label>' +
      (puede ? '<span class="btn-row"><button class="btn xs ghost" type="button" data-mover="-1" data-i="' + i + '" aria-label="Subir">↑</button><button class="btn xs ghost" type="button" data-mover="1" data-i="' + i + '" aria-label="Bajar">↓</button></span>' : '') + '</li>').join('') + '</ol>' +
    '<h4 class="chk-grupo">Gráficas del informe</h4><div class="row" style="gap:6px;flex-wrap:wrap">' + Graficas.LISTA.map((g, i) => '<label class="checkline small"><input type="checkbox" data-grafinf="' + g.id + '"' + (cfg.graficas.indexOf(g.id) >= 0 ? ' checked' : '') + (puede ? '' : ' disabled') + '> ' + (i + 1) + '. ' + esc(g.nombre) + '</label>').join('') + '</div>' +
    '</div></div>';
}
function vistaVersiones(p){
  const L = Decision.informes(p);
  return '<div class="card"><div class="card-head"><h3>Versiones del informe</h3></div><div class="card-body flush">' + (L.length ? '<div class="tw"><table class="t"><thead><tr><th class="n">Versión</th><th>Fecha</th><th>Usuario</th><th class="n">Páginas</th><th>Concepto</th><th>Huella del PDF</th><th></th></tr></thead><tbody>' +
    L.slice().reverse().map(x => '<tr><td class="n">' + x.version + '</td><td>' + Util.fmtSello(x.fecha) + '</td><td>' + esc(x.usuario) + '</td><td class="n">' + x.paginas + '</td><td>' + UI.tag(x.concepto, x.concepto === 'firmado' ? 'ok' : 'warn') + (x.provisional ? ' ' + UI.tag('provisional', 'warn') : '') + '</td>' +
      '<td class="huella small">' + esc(x.sha256Pdf.slice(0, 16)) + '…</td><td>' + '<button class="btn xs" type="button" data-accion="informe-bajar" data-sha="' + x.sha256Pdf + '" data-nombre="' + esc(x.nombrePdf) + '">PDF</button> <button class="btn xs" type="button" data-accion="informe-bajar" data-sha="' + x.sha256Xlsx + '" data-nombre="' + esc(x.nombreXlsx) + '">Excel</button></td></tr>').join('') +
    '</tbody></table></div>' : '<div class="card-body">' + UI.vacio('Aún no se ha generado ningún informe', 'Cada informe generado queda aquí como versión, con su configuración y su huella.') + '</div>') + '</div></div>';
}
function leerTextosConcepto(c){
  const v = id => { const el = $('#' + id); return el ? el.value : ''; };
  const riesgos = {};
  c.orden.slice(0, 2).forEach(f => { riesgos[f.id] = deTexto(v('cc_riesgo_' + idDom(f.id))); });
  return { resumen:v('cc_resumen'), recomendacion:v('cc_recomendacion'), condiciones:deTexto(v('cc_condiciones')), riesgos, notas:v('cc_notas') };
}
function conectarInforme(p, R){
  const lista = $('#listaSecciones'); if (!lista) return;
  const leer = () => ({ secciones:$$('li[data-sec]', lista).map(li => ({ id:li.dataset.sec, marcada:$('input[data-secc]', li).checked })), graficas:$$('#stage [data-grafinf]').filter(x => x.checked).map(x => x.dataset.grafinf) });
  const guardar = () => Decision.guardarConfigInforme(p, leer()).catch(e => UI.error(e, 'informe'));
  $$('input[data-secc], input[data-grafinf]').forEach(x => x.onchange = guardar);
  $$('button[data-mover]', lista).forEach(b => b.onclick = async () => {
    const items = $$('li[data-sec]', lista), i = Number(b.dataset.i), j = i + Number(b.dataset.mover);
    if (j < 0 || j >= items.length) return;
    if (j > i) items[j].after(items[i]); else items[j].before(items[i]);
    await guardar(); App.render();
  });
  let arrastrado = null;
  $$('li[data-sec]', lista).forEach(li => {
    li.addEventListener('dragstart', () => { arrastrado = li; li.classList.add('arrastrando'); });
    li.addEventListener('dragend', () => { li.classList.remove('arrastrando'); arrastrado = null; });
    li.addEventListener('dragover', e => { e.preventDefault(); if (!arrastrado || arrastrado === li) return; const r = li.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) li.before(arrastrado); else li.after(arrastrado); });
    li.addEventListener('drop', async e => { e.preventDefault(); await guardar(); App.render(); });
  });
}

Vistas['16'] = function(){
  const c = contextoEvaluacion('16', 'Concepto e informe');
  if (!c.R) return c;
  const { p, R } = c;
  const tab = UI.pestanaActiva('c16', 'concepto');
  const pest = UI.pestanas('c16', [['concepto', 'Concepto de adjudicación'], ['informe', 'Informe'], ['versiones', 'Versiones del informe'], ['asistente', 'Asistente de IA']], tab);
  const reg = (S.conceptos || []).find(x => x.procesoId === p.id) || { textos:{}, firmas:[] };
  const final = Concepto.aplicarTextos(Concepto.generar(R, { alertas:Evaluacion.alertas(p.id) }), reg.textos);
  const firmado = Concepto.estado(reg) === 'firmado';
  const k = { final, estado:firmado ? 'firmado' : 'borrador', firmas:firmado ? reg.firmas : [], huella:firmado ? reg.huella : null };
  let cuerpo = tab === 'concepto' ? vistaConcepto(p, R, k) : tab === 'informe' ? vistaInforme(p, R) : tab === 'versiones' ? vistaVersiones(p) : (typeof VistaAsistente !== 'undefined' ? VistaAsistente.html(p, R) : '');
  const html = cabecera('16', 'Concepto e informe', c.sub) + pest + cuerpo;
  return { html, alPintar:() => {
    if (tab === 'informe') conectarInforme(p, R);
    if (tab === 'asistente' && typeof VistaAsistente !== 'undefined') VistaAsistente.conectar(p, R);
    // La huella de lo firmado se comprueba contra la evaluación de hoy: si cambió, el concepto vuelve a borrador.
    if (tab === 'concepto' && firmado) Decision.concepto(p).then(x => { const el = $('#avisoFirma'); if (el && x && x.cambioDespuesDeFirmar) el.innerHTML = '<div class="nota bad">La evaluación cambió después de firmar: el texto firmado ya no corresponde a ella. El concepto vuelve a ser un borrador hasta que el comité lo firme de nuevo.</div>'; }).catch(e => RegistroTecnico.anotar('huella del concepto', e));
  }, acciones:Object.assign(accionesVerificar(p, R), {
    'concepto-guardar':async () => { await Decision.guardarTextos(p, leerTextosConcepto(final)); UI.toast('Textos del concepto guardados.', 'ok'); App.render(); },
    'concepto-firmar':async () => {
      if (Permisos.puede('redactarConcepto')) await Decision.guardarTextos(p, leerTextosConcepto(final));
      const v = await UI.pedir({ titulo:'Firmar el concepto de adjudicación', textoAceptar:'Firmar',
        antes:'<p class="small">Firman dos miembros distintos del comité, cada uno con su usuario y su contraseña. Se firma el texto que está en pantalla, con el orden de elegibilidad y el recomendado.</p>',
        campos:[{ k:'u1', lab:'Miembro 1 · usuario' }, { k:'c1', lab:'Contraseña', tipo:'password' }, { k:'u2', lab:'Miembro 2 · usuario' }, { k:'c2', lab:'Contraseña', tipo:'password' }],
        validar:z => !z.u1 || !z.c1 || !z.u2 || !z.c2 ? 'Escriba los dos usuarios con su contraseña.' : '' });
      if (!v) return;
      await Decision.firmar(p, [{ usuario:v.u1, clave:v.c1 }, { usuario:v.u2, clave:v.c2 }]);
      UI.toast('Concepto firmado.', 'ok'); App.render();
    },
    'concepto-anular':async () => {
      const v = await UI.pedir({ titulo:'Anular las firmas del concepto', textoAceptar:'Anular', campos:[{ k:'motivo', lab:'Motivo', tipo:'textarea', filas:3, c2:true }], validar:z => !z.motivo ? 'Escriba el motivo.' : '' });
      if (!v) return;
      await Decision.anularFirmas(p, v.motivo); App.render();
    },
    'concepto-pdf':async () => { const r = await Decision.pdfConcepto(p); UI.descargar(r.nombre, r.blob); },
    'exportar-adjudicado':() => Decision.exportarAdjudicado(p),
    'informe-generar':async (el) => {
      el.disabled = true; el.textContent = 'Generando…';
      try {
        const r = await Decision.generarInforme(p);
        UI.descargar(r.nombrePdf, r.pdf); UI.descargar(r.nombreXlsx, r.xlsx);
        UI.toast('Informe versión ' + r.version + ': ' + r.paginas + ' páginas.', 'ok');
      } finally { App.render(); }
    },
    'informe-bajar':el => Archivos.descargar(el.dataset.sha, el.dataset.nombre)
  }, typeof VistaAsistente !== 'undefined' ? VistaAsistente.acciones(p, R) : {}) };
};
