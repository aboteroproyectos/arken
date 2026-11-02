/* ══════════════════════════════════════════════════════════════════════════
   VISTAS — una función por módulo, como en ARKEN ANALYTICA. Cada vista pinta
   el escenario y declara sus acciones en un mapa { 'accion': fn(boton) },
   que App conecta con los botones que llevan data-accion. Ninguna vista
   calcula la viabilidad ni escribe en S: llama a Modelo y al motor.
   ══════════════════════════════════════════════════════════════════════════ */
const Vistas = {};

const MODULOS = [
  { id:'00', nombre:'Tablero', corto:'Tablero' },
  { id:'01', nombre:'Clientes y filtros', corto:'Clientes' },
  { id:'02', nombre:'Ficha del cliente', corto:'Ficha', cliente:true },
  { id:'03', nombre:'Documentos', corto:'Documentos', cliente:true },
  { id:'04', nombre:'Bancos y opciones', corto:'Bancos' },
  { id:'05', nombre:'Análisis y concepto', corto:'Concepto', cliente:true },
  { id:'06', nombre:'Tipos de crédito', corto:'Créditos' },
  { id:'07', nombre:'Simulador', corto:'Simulador' },
  { id:'16', nombre:'Centro de ayuda', corto:'Ayuda' }
];

function cabecera(num, titulo, sub, acciones){
  return '<div class="page-head"><div><div class="eyebrow">' + (num ? 'Módulo ' + num : '') + '</div><h1>' + esc(titulo) + '</h1>' +
    (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><div class="head-actions">' + (acciones || '') + '</div></div>';
}
function boton(accion, texto, clase, extra){
  return '<button class="btn ' + (clase || '') + '" type="button" data-accion="' + accion + '"' + (extra || '') + '>' + esc(texto) + '</button>';
}
function etiquetaDemo(x){ return x && x.demo ? ' ' + UI.tag('DEMOSTRACIÓN', 'demo') : ''; }
function sinCliente(num, titulo){
  return cabecera(num, titulo) + '<div class="card"><div class="card-body">' +
    UI.vacio('No hay un cliente abierto', 'Abra un cliente en el módulo 01 · Clientes y filtros, o cree uno nuevo.',
      boton('ir', 'Ir a Clientes', 'primary', ' data-m="01"') + (Permisos.puede('crearCliente') ? boton('nuevo-cliente', '+ Nuevo cliente') : '')) + '</div></div>';
}
function tagDictamen(id, corto){
  const d = Motor.dictamen(id);
  return '<span class="dict ' + d.clase + '">' + esc(corto && id === 'condicionado' ? 'Con condiciones' : corto && id === 'ajustado' ? 'Monto ajustado' : d.n) + '</span>';
}
function tagEstado(id){ const e = Modelo.estado(id); return UI.tag(e.n, e.clase); }
function medidor(p, clase){ return '<span class="meter-b ' + (clase || '') + '"><i style="width:' + Math.max(0, Math.min(100, p)) + '%"></i></span>'; }
const ESTADO_CRIT = { ok:['✓', 'ok'], warn:['!', 'warn'], bad:['✕', 'bad'], falta:['?', 'info'], info:['i', 'info'] };
function icCrit(e){ const x = ESTADO_CRIT[e] || ['·', '']; return '<span class="ic-crit ' + x[1] + '">' + x[0] + '</span>'; }

/** Acciones que comparten varias vistas. */
const AccionesComunes = {
  'ir':b => App.ir(b.dataset.m),
  'abrir-cliente':b => { if (b.dataset.id !== Sesion.clienteActivo){ Sesion.analisis = null; Sesion.simulador = null; Sesion.pestanas.bcoProd = ''; } Modelo.abrir(b.dataset.id); App.ir(b.dataset.m || '02'); },
  'nuevo-cliente':() => FichaCliente.nuevo(),
  'cargar-demo':() => DemoApp.cargar(),
  'ver-concepto':b => { if (b.dataset.id !== Sesion.clienteActivo) Sesion.simulador = null; Modelo.abrir(b.dataset.id); Sesion.analisis = { bancoId:b.dataset.banco, producto:b.dataset.producto }; App.ir('05'); }
};

/* ─────────────── 00 · Tablero ─────────────── */
Vistas['00'] = function(){
  const L = Modelo.clientes();
  const ev = L.map(c => ({ c, r:Modelo.mejor(c), docs:Modelo.contexto(c).docs }));
  const cuenta = id => ev.filter(x => x.r && x.r.dictamen === id).length;
  const conc = Modelo.conceptos();
  const enCurso = ev.filter(x => ['prospecto', 'en_estudio', 'radicado'].indexOf(x.c.estado) >= 0);
  const docsPend = ev.filter(x => x.docs.faltantes.length || x.docs.vencidos.length).sort((a, b) => b.docs.faltantes.length - a.docs.faltantes.length).slice(0, 8);
  const hero = '<div class="cover-hero"><div class="inner"><div class="eyebrow" style="color:#DCCFB4">ARKEN BANK · familia ARKEN 360</div>' +
    '<h2>Análisis de <b>créditos</b></h2><p>Organice a sus clientes, reúna y lea sus documentos, compare las opciones de cada banco y emita conceptos de viabilidad con el porqué de cada cifra.</p>' +
    '<div class="cover-rule"></div></div></div>';
  const flujo = '<div class="nota-flujo">' + ['Cliente', 'Crédito', 'Documentos', 'Lectura', 'Bancos', 'Concepto'].map((x, i) => (i ? '<span class="fl">›</span>' : '') + '<span class="paso">' + x + '</span>').join('') + '</div>';
  if (!L.length){
    return { html:cabecera('00', 'Tablero') + hero + flujo + '<div class="btn-row">' + (Permisos.puede('crearCliente') ? boton('nuevo-cliente', '+ Nuevo cliente', 'primary') : '') +
      (Permisos.puede('demostracion') ? boton('cargar-demo', 'Cargar demostración') : '') + boton('ir', 'Abrir el Centro de ayuda', 'ghost', ' data-m="16"') + '</div>', acciones:AccionesComunes };
  }
  const stat = (lab, val, foot, cl) => '<div class="stat' + (cl ? ' ' + cl : '') + '"><div class="lab">' + esc(lab) + '</div><div class="val">' + val + '</div><div class="foot">' + (foot || '') + '</div></div>';
  const barras = Object.keys(Motor.DICTAMENES).filter(k => k !== 'no_ofrece').map(k => {
    const n = cuenta(k), p = L.length ? n / L.length * 100 : 0;
    return '<div class="bar-row"><div class="nm">' + tagDictamen(k) + '</div><div class="bar-track"><i class="b-' + Motor.dictamen(k).clase + '" style="width:' + p + '%"></i></div><div class="vl num">' + n + '</div></div>';
  }).join('');
  const porEstado = ESTADOS_CLIENTE.map(e => { const n = L.filter(c => (c.estado || 'prospecto') === e.id).length; return n ? '<div class="bar-row"><div class="nm">' + tagEstado(e.id) + '</div><div class="bar-track"><i style="width:' + (n / L.length * 100) + '%"></i></div><div class="vl num">' + n + '</div></div>' : ''; }).join('');
  const html = cabecera('00', 'Tablero', 'Su cartera de clientes y su viabilidad, de un vistazo', (Permisos.puede('crearCliente') ? boton('nuevo-cliente', '+ Nuevo cliente', 'brass') : '')) +
    '<div class="grid g4">' +
      stat('Clientes', String(L.length), enCurso.length + ' en curso') +
      stat('Viables', String(cuenta('viable') + cuenta('condicionado')), cuenta('ajustado') + ' con monto ajustado', 'accent') +
      stat('Monto en estudio', money(enCurso.reduce((s, x) => s + (Number(x.c.perfil.montoSolicitado) || 0), 0)), 'Suma de lo solicitado') +
      stat('Conceptos emitidos', String(conc.length), conc[0] ? 'Último: ' + Util.fmtFecha(conc[0].fecha) : '') +
    '</div>' +
    '<div class="grid g2" style="margin-top:var(--gap)">' +
      '<div class="card"><div class="card-head"><h3>Clientes por dictamen (mejor opción)</h3>' + boton('ir', 'Ver filtros', 'sm ghost', ' data-m="01"') + '</div><div class="card-body"><div class="bars">' + barras + '</div></div></div>' +
      '<div class="card"><div class="card-head"><h3>Clientes por estado</h3></div><div class="card-body"><div class="bars">' + porEstado + '</div></div></div>' +
    '</div>' +
    '<div class="grid g2">' +
      '<div class="card"><div class="card-head"><h3>Documentos pendientes</h3></div><div class="card-body flush">' + (docsPend.length ? '<div class="tw"><table class="t"><thead><tr><th>Cliente</th><th>Avance</th><th>Pendiente</th><th></th></tr></thead><tbody>' +
        docsPend.map(x => '<tr><td>' + esc(x.c.nombre) + etiquetaDemo(x.c) + '</td><td>' + medidor(x.docs.avance) + ' <span class="small num">' + x.docs.cargados + '/' + x.docs.requeridos + '</span></td><td class="small">' +
          (x.docs.faltantes.length ? x.docs.faltantes.length + ' por cargar' : '') + (x.docs.vencidos.length ? (x.docs.faltantes.length ? ' · ' : '') + '<span class="bad-txt">' + x.docs.vencidos.length + ' vencido(s)</span>' : '') +
          '</td><td class="act">' + boton('abrir-cliente', 'Documentos', 'xs', ' data-id="' + x.c.id + '" data-m="03"') + '</td></tr>').join('') + '</tbody></table></div>' : UI.vacio('Todo al día', 'Ningún cliente tiene documentos por cargar o vencidos.')) + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Últimos conceptos</h3></div><div class="card-body flush">' + (conc.length ? '<div class="tw"><table class="t"><thead><tr><th>Fecha</th><th>Cliente</th><th>Banco</th><th>Dictamen</th></tr></thead><tbody>' +
        conc.slice(0, 8).map(k => '<tr><td class="small num">' + Util.fmtFecha(k.fecha) + '</td><td>' + esc(k.cliente) + '</td><td class="small">' + esc(k.banco) + '<div class="muted">' + esc(k.productoNombre) + '</div></td><td>' + tagDictamen(k.dictamen, true) + '</td></tr>').join('') +
        '</tbody></table></div>' : UI.vacio('Aún no hay conceptos', 'Se emiten en el módulo 05 · Análisis y concepto.')) + '</div></div>' +
    '</div>' + flujo;
  return { html, acciones:AccionesComunes };
};

/* ─────────────── 01 · Clientes y filtros ─────────────── */
const Filtros = (function(){
  const VACIO = { texto:'', tipo:'', producto:'', estado:'', dictamen:'', banco:'', docs:'', ingresoMin:'', ingresoMax:'', montoMin:'', montoMax:'' };
  function actuales(){ return Object.assign({}, VACIO, Sesion.filtros || {}); }
  /** Evalúa a cada cliente una vez: sus opciones en todos los bancos, la mejor y el estado de sus documentos. */
  function evaluar(L){
    return L.map(c => {
      const ctx = Modelo.contexto(c);
      const ops = Motor.opciones(c, Modelo.bancos(), S.parametros, ctx, (c.perfil || {}).producto || null);
      return { c, ops, mejor:ops[0] || null, docs:ctx.docs, alertas:ctx.alertas };
    });
  }
  function ingresoDe(c){ const p = c.perfil || {}; return Catalogo.esNatural(c.tipo) ? (Number(p.ingresoMensual) || 0) + (Number(p.ingresosVariables) || 0) + (Number(p.ingresoCodeudor) || 0) : (Number(p.ingresosOperacionales) || 0) / 12; }
  const VIABLES = ['viable', 'condicionado', 'ajustado'];
  function aplicar(E, f){
    const q = Util.normaliza(f.texto);
    const n = v => v === '' || v === null || v === undefined ? null : Number(v);
    return E.filter(x => {
      const c = x.c, p = c.perfil || {};
      if (q && Util.normaliza([c.nombre, c.documento, c.ciudad, c.correo, c.notas, p.nombreProyecto].join(' ')).indexOf(q) < 0) return false;
      if (f.tipo && c.tipo !== f.tipo) return false;
      if (f.producto && p.producto !== f.producto) return false;
      if (f.estado && (c.estado || 'prospecto') !== f.estado) return false;
      if (f.dictamen && (!x.mejor || x.mejor.dictamen !== f.dictamen)) return false;
      if (f.banco){
        const r = x.ops.find(o => o.bancoId === f.banco);
        if (!r || VIABLES.indexOf(r.dictamen) < 0) return false;
      }
      if (f.docs === 'completos' && x.docs.faltantes.length) return false;
      if (f.docs === 'incompletos' && !x.docs.faltantes.length) return false;
      if (f.docs === 'vencidos' && !x.docs.vencidos.length) return false;
      if (f.docs === 'alertas' && !x.alertas.length) return false;
      const ing = ingresoDe(c), mon = Number(p.montoSolicitado) || 0;
      if (n(f.ingresoMin) !== null && ing < n(f.ingresoMin)) return false;
      if (n(f.ingresoMax) !== null && ing > n(f.ingresoMax)) return false;
      if (n(f.montoMin) !== null && mon < n(f.montoMin)) return false;
      if (n(f.montoMax) !== null && mon > n(f.montoMax)) return false;
      return true;
    });
  }
  function cuantos(f){ return Object.keys(VACIO).filter(k => f[k] !== '' && f[k] !== undefined && f[k] !== null).length; }
  return { VACIO, actuales, evaluar, aplicar, ingresoDe, cuantos, VIABLES };
})();

Vistas['01'] = function(){
  const f = Filtros.actuales();
  const todos = Filtros.evaluar(Modelo.clientes());
  const E = Filtros.aplicar(todos, f);
  const tab = UI.pestanaActiva('cli', 'lista');
  const sel = (k, lab, opts) => '<div class="field"><label for="fl_' + k + '">' + esc(lab) + '</label><select id="fl_' + k + '" data-filtro="' + k + '"><option value="">Todos</option>' +
    opts.map(o => '<option value="' + esc(o.v) + '"' + (String(f[k]) === String(o.v) ? ' selected' : '') + '>' + esc(o.n) + '</option>').join('') + '</select></div>';
  const inp = (k, lab, tipo, ph) => '<div class="field"><label for="fl_' + k + '">' + esc(lab) + '</label><input id="fl_' + k + '" data-filtro="' + k + '" type="' + (tipo || 'text') + '" value="' + esc(f[k]) + '"' + (ph ? ' placeholder="' + esc(ph) + '"' : '') + ' autocomplete="off"></div>';
  const barra = '<div class="card filtros"><div class="card-body"><div class="filtros-g">' +
    inp('texto', 'Buscar', 'search', 'Nombre, documento, ciudad, proyecto…') +
    sel('tipo', 'Tipo de cliente', Catalogo.TIPOS_CLIENTE.map(t => ({ v:t.id, n:t.corto }))) +
    sel('producto', 'Crédito solicitado', Catalogo.PRODUCTOS.map(p => ({ v:p.id, n:p.corto }))) +
    sel('estado', 'Estado', ESTADOS_CLIENTE.map(e => ({ v:e.id, n:e.n }))) +
    sel('dictamen', 'Dictamen (mejor opción)', Object.keys(Motor.DICTAMENES).map(k => ({ v:k, n:Motor.dictamen(k).n }))) +
    sel('banco', 'Viable en el banco', Modelo.bancos().filter(b => b.activo !== false).map(b => ({ v:b.id, n:b.nombre }))) +
    sel('docs', 'Documentación', [{ v:'completos', n:'Completa' }, { v:'incompletos', n:'Incompleta' }, { v:'vencidos', n:'Con vencidos' }, { v:'alertas', n:'Con alertas de coherencia' }]) +
    inp('ingresoMin', 'Ingreso mensual desde', 'number') + inp('ingresoMax', 'Ingreso mensual hasta', 'number') +
    inp('montoMin', 'Monto desde', 'number') + inp('montoMax', 'Monto hasta', 'number') +
    '</div><div class="row" style="justify-content:space-between;margin-top:8px;flex-wrap:wrap;gap:8px"><span class="small muted">' + E.length + ' de ' + todos.length + ' cliente(s)' +
    (Filtros.cuantos(f) ? ' · ' + Filtros.cuantos(f) + ' filtro(s) activo(s)' : '') + '</span><div class="btn-row" style="margin:0">' +
    (Filtros.cuantos(f) ? boton('limpiar-filtros', 'Quitar filtros', 'sm ghost') : '') + boton('exportar-clientes', 'Exportar a Excel', 'sm') + boton('informe-cartera', 'Informe PDF de la selección', 'sm') + '</div></div></div></div>';

  let cuerpo;
  if (!todos.length) cuerpo = '<div class="card"><div class="card-body">' + UI.vacio('Aún no hay clientes', 'Cree el primero o cargue la demostración para conocer el programa.',
    (Permisos.puede('crearCliente') ? boton('nuevo-cliente', '+ Nuevo cliente', 'primary') : '') + (Permisos.puede('demostracion') ? boton('cargar-demo', 'Cargar demostración') : '')) + '</div></div>';
  else if (!E.length) cuerpo = '<div class="card"><div class="card-body">' + UI.vacio('Ningún cliente cumple los filtros', 'Quite o cambie algún filtro.', boton('limpiar-filtros', 'Quitar filtros')) + '</div></div>';
  else if (tab === 'matriz'){
    const B = Modelo.bancos().filter(b => b.activo !== false);
    cuerpo = '<div class="card"><div class="card-body flush"><div class="tw scroll"><table class="t matriz-v"><thead><tr><th>Cliente</th>' + B.map(b => '<th class="small">' + esc(b.nombre) + '</th>').join('') + '</tr></thead><tbody>' +
      E.map(x => '<tr><td><button class="lnk" type="button" data-accion="abrir-cliente" data-id="' + x.c.id + '" data-m="02">' + esc(x.c.nombre) + '</button>' + etiquetaDemo(x.c) +
        '<div class="small muted">' + esc((Catalogo.producto(x.c.perfil.producto) || {}).corto || 'Sin crédito elegido') + '</div></td>' +
        B.map(b => { const r = x.ops.find(o => o.bancoId === b.id);
          if (!r) return '<td class="muted small center">—</td>';
          const cf = r.cifras || {};
          return '<td class="celda-v ' + Motor.dictamen(r.dictamen).clase + '"><button type="button" data-accion="ver-concepto" data-id="' + x.c.id + '" data-banco="' + b.id + '" data-producto="' + r.producto + '" title="' + esc(Concepto.resumen(r)) + '">' +
            '<b>' + esc(Motor.dictamen(r.dictamen).n) + '</b>' + (cf.cuotaAprobable ? '<span class="num">' + money(cf.cuotaAprobable) + '</span>' : cf.montoAprobable ? '<span class="num">' + money(cf.montoAprobable) + '</span>' : '') +
            (x.ops.length && !x.c.perfil.producto ? '<span class="small">' + esc((Catalogo.producto(r.producto) || {}).corto) + '</span>' : '') + '</button></td>'; }).join('') + '</tr>').join('') +
      '</tbody></table></div></div></div><p class="small muted">Cada celda es la mejor opción del cliente en ese banco, con la cuota estimada. Pulse una celda para ver el análisis y emitir el concepto.</p>';
  } else {
    cuerpo = '<div class="card"><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Cliente</th><th>Tipo</th><th>Crédito solicitado</th><th>Estado</th><th>Documentos</th><th>Mejor opción</th><th></th></tr></thead><tbody>' +
      E.map(x => { const c = x.c, p = c.perfil || {}, r = x.mejor, cf = (r && r.cifras) || {};
        return '<tr' + (c.id === Sesion.clienteActivo ? ' class="sel"' : '') + '><td><button class="lnk" type="button" data-accion="abrir-cliente" data-id="' + c.id + '" data-m="02"><b>' + esc(c.nombre) + '</b></button>' + etiquetaDemo(c) +
          '<div class="small muted">' + esc(c.documento || '') + (c.ciudad ? ' · ' + esc(c.ciudad) : '') + '</div></td>' +
          '<td class="small">' + esc((Catalogo.tipoCliente(c.tipo) || {}).corto || '') + '</td>' +
          '<td class="small">' + esc((Catalogo.producto(p.producto) || {}).corto || '—') + (p.montoSolicitado ? '<div class="num">' + money(p.montoSolicitado) + '</div>' : '') + '</td>' +
          '<td>' + tagEstado(c.estado) + '</td>' +
          '<td>' + medidor(x.docs.avance, x.docs.vencidos.length ? 'warn' : '') + ' <span class="small num">' + x.docs.cargados + '/' + x.docs.requeridos + '</span>' + (x.alertas.length ? ' ' + UI.tag(x.alertas.length + ' alerta(s)', 'warn') : '') + '</td>' +
          '<td>' + (r ? tagDictamen(r.dictamen, true) + '<div class="small">' + esc(r.banco) + (cf.cuotaAprobable ? ' · cuota <span class="num">' + money(cf.cuotaAprobable) + '</span>' : '') + '</div>' : '<span class="small muted">Elija el crédito en la ficha</span>') + '</td>' +
          '<td class="act">' + boton('abrir-cliente', 'Abrir', 'xs', ' data-id="' + c.id + '" data-m="02"') + (r ? ' ' + boton('ver-concepto', 'Concepto', 'xs primary', ' data-id="' + c.id + '" data-banco="' + r.bancoId + '" data-producto="' + r.producto + '"') : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div></div></div>';
  }
  const html = cabecera('01', 'Clientes y filtros', 'Filtre su cartera por tipo, crédito, estado, viabilidad por banco, documentación, ingresos y monto',
      Permisos.puede('crearCliente') ? boton('nuevo-cliente', '+ Nuevo cliente', 'brass') : '') +
    barra + (todos.length ? UI.pestanas('cli', [['lista', 'Lista de clientes'], ['matriz', 'Matriz de viabilidad por banco']], 'lista') : '') + cuerpo;
  let tmr = null;
  return { html, acciones:Object.assign({
      'limpiar-filtros':() => { Sesion.filtros = {}; App.render(); },
      'exportar-clientes':() => Informes.excelClientes(E),
      'informe-cartera':() => Informes.pdfCartera(E, f)
    }, AccionesComunes),
    alPintar(){
      $$('[data-filtro]').forEach(el => {
        const fn = () => { Sesion.filtros = Object.assign({}, Sesion.filtros, { [el.dataset.filtro]:el.value }); const foco = el.id; App.render(); const x = $('#' + foco); if (x){ x.focus(); if (x.setSelectionRange && x.type === 'search') x.setSelectionRange(x.value.length, x.value.length); } };
        if (el.tagName === 'SELECT') el.onchange = fn;
        else el.oninput = () => { clearTimeout(tmr); tmr = setTimeout(fn, 350); };
      });
    } };
};

/* ─────────────── 02 · Ficha del cliente ─────────────── */
const FichaCliente = (function(){
  function camposBasicos(c){
    return [
      { k:'nombre', lab:Catalogo.esNatural(c.tipo) || !c.tipo ? 'Nombre completo o razón social' : 'Razón social', val:c.nombre, c2:true },
      { k:'tipo', lab:'Tipo de cliente', tipo:'select', val:c.tipo || '', opts:[{ v:'', n:'— Elija —' }].concat(Catalogo.TIPOS_CLIENTE.map(t => ({ v:t.id, n:t.nombre }))) },
      { k:'documento', lab:'Cédula o NIT', val:c.documento },
      { k:'telefono', lab:'Teléfono', val:c.telefono }, { k:'correo', lab:'Correo', tipo:'email', val:c.correo },
      { k:'ciudad', lab:'Ciudad', val:c.ciudad },
      { k:'estado', lab:'Estado', tipo:'select', val:c.estado || 'prospecto', opts:ESTADOS_CLIENTE.map(e => ({ v:e.id, n:e.n })) },
      { k:'asesor', lab:'Asesor responsable', val:c.asesor },
      { k:'notas', lab:'Notas', tipo:'textarea', val:c.notas, c2:true, filas:2 }
    ];
  }
  async function nuevo(){
    Permisos.exigir('crearCliente');
    const v = await UI.pedir({ titulo:'Nuevo cliente', eyebrow:'Clientes', campos:camposBasicos({}), textoAceptar:'Crear cliente',
      antes:'<p class="small muted">Según el tipo de cliente, el programa ofrece los créditos que le aplican y pide sus documentos.</p>',
      validar:z => !z.nombre ? 'Escriba el nombre.' : !z.tipo ? 'Elija el tipo de cliente.' : '' });
    if (!v) return;
    const c = await Modelo.guardarCliente(v);
    Sesion.analisis = null; Sesion.simulador = null; Modelo.abrir(c.id); UI.toast('Cliente creado. Elija el crédito y complete el perfil.', 'ok'); App.ir('02');
  }
  /* Campos del perfil, como campos de formulario. */
  function campoForm(def, c){
    const v = (c.perfil || {})[def.k];
    const fuente = (c.fuentes || {})[def.k];
    const ayuda = (def.ayuda ? esc(def.ayuda) : '') + (fuente ? '<span class="fuente-doc" title="' + esc('«' + fuente.texto + '»') + '">Del documento «' + esc(fuente.documento) + '», pág. ' + fuente.pagina + '</span>' : '');
    const base = { k:def.k, lab:def.lab, ayuda };
    if (def.tipo === 'dinero' || def.tipo === 'numero') return Object.assign(base, { tipo:'number', val:v === undefined ? '' : v });
    if (def.tipo === 'fecha') return Object.assign(base, { tipo:'date', val:v || '' });
    if (def.tipo === 'si/no') return Object.assign(base, { tipo:'select', val:v === true ? 'si' : v === false ? 'no' : '', opts:[{ v:'', n:'— Sin dato —' }, { v:'si', n:'Sí' }, { v:'no', n:'No' }] });
    if (def.tipo === 'opciones') return Object.assign(base, { tipo:'select', val:v || '', opts:def.opts.map(o => ({ v:o, n:o || '— Sin dato —' })) });
    if (def.tipo === 'producto') return Object.assign(base, { tipo:'select', val:v || '', opts:[{ v:'', n:'— Elija el crédito —' }].concat(Catalogo.productosPara(c.tipo).map(p => ({ v:p.id, n:p.nombre }))) });
    return Object.assign(base, { tipo:'text', val:v || '', c2:def.k === 'gravamenes' });
  }
  function leerPerfil(c, raiz){
    const out = {};
    Catalogo.camposPara(c.tipo).forEach(def => {
      const el = $('#pf_' + def.k, raiz); if (!el) return;
      const x = el.value.trim();
      if (def.tipo === 'dinero' || def.tipo === 'numero') out[def.k] = x === '' ? '' : Number(x);
      else if (def.tipo === 'si/no') out[def.k] = x === 'si' ? true : x === 'no' ? false : '';
      else out[def.k] = x;
    });
    return out;
  }
  return { camposBasicos, nuevo, campoForm, leerPerfil };
})();

Vistas['02'] = function(){
  const c = Modelo.activo();
  if (!c) return { html:sinCliente('02', 'Ficha del cliente'), acciones:AccionesComunes };
  const ed = Permisos.puede('editarCliente');
  const tc = Catalogo.tipoCliente(c.tipo);
  const grupos = [];
  Catalogo.camposPara(c.tipo).forEach(def => { let g = grupos.find(x => x.n === def.grupo); if (!g){ g = { n:def.grupo, campos:[] }; grupos.push(g); } g.campos.push(def); });
  const orden = ['Operación', 'Ingresos y deudas', 'Perfil', 'Empresa', 'Proyecto'];
  grupos.sort((a, b) => orden.indexOf(a.n) - orden.indexOf(b.n));
  const prods = Catalogo.productosPara(c.tipo);
  const r = Modelo.mejor(c);
  const html = cabecera('02', c.nombre, esc(tc ? tc.nombre : '') + ' · ' + tagEstado(c.estado) + etiquetaDemo(c),
      (ed ? boton('guardar-ficha', 'Guardar', 'primary') : '') + boton('ir', 'Documentos', '', ' data-m="03"') + boton('ir', 'Opciones en bancos', '', ' data-m="04"') +
      (Permisos.puede('borrarCliente') ? boton('borrar-cliente', 'Eliminar', 'ghost') : '')) +
    (r ? '<div class="resumen-cli"><div><div class="eyebrow">Mejor opción hoy</div><b>' + esc(r.banco) + '</b> · ' + esc(r.productoNombre) + '</div><div>' + tagDictamen(r.dictamen) + '</div>' +
      '<div class="small">' + esc(Concepto.resumen(r)) + '</div>' + boton('ver-concepto', 'Ver análisis', 'sm', ' data-id="' + c.id + '" data-banco="' + r.bancoId + '" data-producto="' + r.producto + '"') + '</div>' : '') +
    '<div class="grid g2-1"><div>' +
      grupos.map(g => '<div class="card"><div class="card-head"><h3>' + esc(g.n) + '</h3></div><div class="card-body">' +
        UI.formulario(g.campos.map(def => Object.assign(FichaCliente.campoForm(def, c), { deshabilitado:!ed })), 'pf') + '</div></div>').join('') +
    '</div><div>' +
      '<div class="card"><div class="card-head"><h3>Datos del cliente</h3></div><div class="card-body">' + UI.formulario(FichaCliente.camposBasicos(c).map(x => Object.assign(x, { c2:true, deshabilitado:!ed })), 'cb') + '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Créditos para ' + esc(tc ? tc.corto.toLowerCase() : '') + '</h3></div><div class="card-body"><div class="chips">' +
        prods.map(p => '<button type="button" class="chip' + (p.id === c.perfil.producto ? ' on' : '') + '" data-accion="elegir-producto" data-p="' + p.id + '"' + (ed ? '' : ' disabled') + '>' + esc(p.corto) + '</button>').join('') +
        '</div><p class="small muted" style="margin-top:8px">' + esc(tc ? tc.desc : '') + '</p>' + boton('ir', 'Ver requisitos de cada crédito', 'sm ghost', ' data-m="06"') + '</div></div>' +
    '</div></div>';
  return { html, acciones:Object.assign({
    'guardar-ficha':async () => {
      const b = UI.leer(FichaCliente.camposBasicos(c), document, 'cb');
      if (!b.nombre) throw new Error('Escriba el nombre del cliente.');
      const perfil = Object.assign({}, c.perfil, FichaCliente.leerPerfil(c, document));
      // Si un valor que vino de un documento se cambió a mano, deja de citar el documento.
      const fuentes = Object.assign({}, c.fuentes || {});
      Object.keys(fuentes).forEach(k => { if (String(perfil[k]) !== String((c.perfil || {})[k])) delete fuentes[k]; });
      await Modelo.guardarCliente(Object.assign({}, c, b, { perfil, fuentes }));
      UI.toast('Ficha guardada', 'ok'); App.render();
    },
    'elegir-producto':async el => {
      const perfil = Object.assign({}, c.perfil, FichaCliente.leerPerfil(c, document), { producto:el.dataset.p });
      await Modelo.guardarCliente(Object.assign({}, c, UI.leer(FichaCliente.camposBasicos(c), document, 'cb'), { perfil }));
      UI.toast('Crédito: ' + Catalogo.producto(el.dataset.p).nombre + '. Revise sus documentos en el módulo 03.', 'ok'); App.render();
    },
    'borrar-cliente':async () => {
      const ok = await UI.confirmar({ titulo:'Eliminar cliente', mensaje:'Se borran ' + c.nombre + ', sus ' + Modelo.documentos(c.id).length + ' documento(s) y sus conceptos. No se puede deshacer.', palabra:'ELIMINAR', textoAceptar:'Eliminar', claseAceptar:'danger' });
      if (!ok) return;
      await Modelo.borrarCliente(c.id); UI.toast('Cliente eliminado', 'ok'); App.ir('01');
    }
  }, AccionesComunes) };
};
