/* ══════════════════════════════════════════════════════════════════════════
   VISTAS — una función por módulo. Cada vista pinta el escenario y declara
   sus acciones en un mapa { 'nombre-de-accion': fn(boton) }, que App
   conecta con los botones que llevan data-accion. Ninguna vista calcula
   dinero ni escribe en S: llama a Calculo y a Modelo.
   ══════════════════════════════════════════════════════════════════════════ */
const Vistas = {};

function cabecera(num, titulo, sub, acciones){
  return '<div class="page-head"><div><div class="eyebrow">' + (num ? 'Módulo ' + num : '') + '</div><h1>' + esc(titulo) + '</h1>' +
    (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><div class="head-actions">' + (acciones||'') + '</div></div>';
}
function boton(accion, texto, clase, extra){
  return '<button class="btn ' + (clase||'') + '" type="button" data-accion="' + accion + '"' + (extra||'') + '>' + esc(texto) + '</button>';
}
function sinProceso(num, titulo){
  return cabecera(num, titulo) + '<div class="card"><div class="card-body">' +
    UI.vacio('No hay un proceso abierto', 'Abra un proceso en el módulo 01 · Procesos, o cree uno nuevo.', boton('ir-01', 'Ir a Procesos', 'primary')) + '</div></div>';
}
function avisoCongelado(p){
  return Modelo.editable(p) ? '' : '<div class="congelado">El proceso fue emitido: la versión ' + p.versionPliego + ' del pliego está congelada y aquí solo se consulta. Los cambios se hacen con una adenda (módulo 08).</div>';
}
function etiquetaDemo(x){ return x && x.demo ? ' ' + UI.tag('DEMOSTRACIÓN', 'demo') : ''; }
const PASOS_FLUJO = ['Presupuesto','Condiciones','Documentos','Emisión','Ofertas','Apertura','Evaluación','Concepto','Informe'];

/* ─────────────── 00 · Tablero del proceso ─────────────── */
Vistas['00'] = function(){
  const p = Modelo.activo();
  if (!p){
    return { html:cabecera('00', 'Tablero del proceso') + '<div class="cover-hero"><div class="inner"><div class="eyebrow" style="color:#DCCFB4">ARKEN ANALYTICA</div>' +
      '<h2>Evaluación de <b>propuestas</b></h2><p>Arme el presupuesto base, defina las condiciones de la oferta, emita un paquete por invitado y evalúe las ofertas con la evidencia a la vista. La decisión es del comité.</p>' +
      '<div class="cover-rule"></div></div></div><div class="nota-flujo" style="margin-top:var(--gap)">' + PASOS_FLUJO.map((x, i) => (i ? '<span class="fl">›</span>' : '') + '<span class="paso">' + x + '</span>').join('') + '</div>' +
      '<div class="btn-row">' + (Permisos.puede('crearProceso') ? boton('nuevo-proceso', 'Nuevo proceso', 'primary') : '') + boton('ir-01', 'Ver procesos') +
      (Permisos.puede('demostracion') ? boton('cargar-demo', 'Cargar demostración') : '') + '</div>',
      acciones:Vistas['01'].accionesComunes };
  }
  const pres = Modelo.presupuesto(p.id), t = Calculo.totales(pres);
  const inv = Modelo.invitados(p.id).filter(i => i.estado !== 'retirado');
  const firmados = inv.filter(i => i.confidencialidad && i.confidencialidad.estado === 'firmado').length;
  const rev = Modelo.revision(p), enRojo = rev.filter(x => !x.ok).length;
  const paso = Modelo.editable(p) ? (Calculo.contar(pres).actividades === 0 ? 0 : PlantillaCondiciones.problemas(Modelo.requisitos(p.id), p.puntajeTotal).length ? 1 : Modelo.documentos(p.id).length === 0 ? 2 : 3) : 4;
  const sig = Cronograma.siguiente(p.cronograma);
  const titulo = esc(p.nombre).replace(/^(\S+)/, '$1');
  const html = cabecera('00', 'Tablero del proceso', esc(p.codigo) + ' · ' + esc(p.estado) + etiquetaDemo(p)) +
    '<div class="cover-hero"><div class="inner"><div class="eyebrow" style="color:#DCCFB4">' + esc(p.modalidad) + ' · ' + esc(p.tipoContrato) + '</div>' +
      '<h2>' + titulo + ' <b>' + esc(p.codigo) + '</b></h2><p>' + esc(p.objeto || 'Sin objeto definido.') + '</p><div class="cover-rule"></div></div></div>' +
    '<div class="nota-flujo" style="margin-top:var(--gap)">' + PASOS_FLUJO.map((x, i) => (i ? '<span class="fl">›</span>' : '') + '<span class="paso' + (i === paso ? ' fuerte' : '') + '">' + x + '</span>').join('') +
      '<em>' + (Modelo.editable(p) ? (enRojo ? 'Faltan ' + enRojo + ' punto(s) de la revisión antes de emitir (módulo 07).' : 'La revisión está en verde: el proceso se puede emitir.') : 'Proceso emitido. Recepción y apertura de ofertas: Fase 2.') + '</em></div>' +
    '<div class="grid g5">' +
      '<div class="stat accent"><div class="lab">Presupuesto base</div><div class="val">' + money(t.total) + '</div><div class="foot">Costo directo ' + money(t.costoDirecto) + '</div></div>' +
      '<div class="stat"><div class="lab">Invitados</div><div class="val">' + inv.length + '</div><div class="foot">' + firmados + ' acuerdo(s) firmado(s)</div></div>' +
      '<div class="stat"><div class="lab">Ofertas recibidas</div><div class="val">0</div><div class="foot">Recepción en la Fase 2</div></div>' +
      '<div class="stat"><div class="lab">Alertas abiertas</div><div class="val">0</div><div class="foot">Crítica 0 · importante 0 · observación 0</div></div>' +
      '<div class="stat"><div class="lab">Revisión antes de emitir</div><div class="val">' + (rev.length - enRojo) + ' / ' + rev.length + '</div><div class="foot">' + (enRojo ? enRojo + ' en rojo' : 'Todo en verde') + '</div></div>' +
    '</div>' +
    '<div class="grid g2" style="margin-top:var(--gap)"><div class="card"><div class="card-head"><h3>Cronograma</h3>' + boton('ir-07', 'Editar', 'sm') + '</div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Hito</th><th>Fecha</th><th>Hora</th></tr></thead><tbody>' +
      Cronograma.activos(p.cronograma).map(h => '<tr' + (sig && sig.clave === h.clave ? ' style="font-weight:700"' : '') + '><td>' + esc(h.nombre) + (sig && sig.clave === h.clave ? ' ' + UI.tag('siguiente', 'brass') : '') + '</td><td>' + Util.fmtFecha(h.fecha) + '</td><td>' + esc(h.hora || '—') + '</td></tr>').join('') +
    '</tbody></table></div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Composición del presupuesto base</h3></div><div class="card-body">' + composicion(pres) + '</div></div></div>';
  return { html, acciones:Object.assign({ 'ir-07':() => App.ir('07') }, Vistas['01'].accionesComunes) };
};
function composicion(pres){
  const pc = Calculo.porCategoria(pres), total = Object.values(pc).reduce((a, b) => a + b, 0) || 1;
  const COLORES = { 'Materiales':'#A98B54', 'Mano de Obra':'#3C5A76', 'Herramientas':'#767C83', 'Equipos':'#3B6E52', 'Ferretería':'#9A6B1E', 'Consumibles':'#8A6E4B', 'Todo Costo':'#96362E' };
  return Calculo.CATEGORIAS_INSUMO.map(k => '<div style="margin-bottom:8px"><div class="row" style="justify-content:space-between"><span class="small"><span class="dot" style="background:' + COLORES[k] + '"></span> ' + k + '</span>' +
    '<span class="num small">' + money(pc[k]) + ' · ' + Util.pct(pc[k] / total * 100) + '</span></div><div class="meter"><i style="width:' + (pc[k] / total * 100).toFixed(1) + '%;background:' + COLORES[k] + '"></i></div></div>').join('');
}

/* ─────────────── 01 · Procesos ─────────────── */
Vistas['01'] = function(){
  const lista = Modelo.procesos(Sesion.verArchivados);
  const filas = lista.map(p => {
    const pres = Modelo.presupuesto(p.id);
    const ci = Cronograma.hito(p.cronograma, 'cierre');
    return '<tr' + (p.id === Sesion.procesoActivo ? ' style="box-shadow:inset 3px 0 0 var(--brass)"' : '') + '><td class="cod">' + esc(p.codigo) + '</td><td><b>' + esc(p.nombre) + '</b>' + etiquetaDemo(p) + (p.archivado ? ' ' + UI.tag('archivado') : '') +
      '<div class="small muted">' + esc(p.modalidad) + ' · ' + esc(p.tipoContrato) + '</div></td><td>' + UI.tag(p.estado, p.estado === 'emitido' ? 'ok' : 'info') + '</td>' +
      '<td class="n">' + money(pres ? Calculo.totales(pres).total : 0) + '</td><td>' + (ci && ci.fecha ? Util.fmtFecha(ci.fecha) + ' ' + esc(ci.hora) : '—') + '</td><td>' + esc(p.responsable || '—') + '</td>' +
      '<td class="act">' + boton('abrir-proceso', 'Abrir', 'sm primary', ' data-id="' + p.id + '"') + ' ' + boton('duplicar-proceso', 'Duplicar', 'sm', ' data-id="' + p.id + '"') + ' ' +
      boton('archivar-proceso', p.archivado ? 'Desarchivar' : 'Archivar', 'sm ghost', ' data-id="' + p.id + '"') + '</td></tr>';
  }).join('');
  const p = Modelo.activo();
  const html = cabecera('01', 'Procesos', 'Licitaciones e invitaciones a cotizar de la empresa',
      (Permisos.puede('crearProceso') ? boton('nuevo-proceso', 'Nuevo proceso', 'primary') : '') +
      (Permisos.puede('demostracion') ? boton('cargar-demo', 'Cargar demostración') + (Modelo.hayDemo() ? boton('borrar-demo', 'Borrar datos de demostración', 'danger') : '') : '')) +
    '<div class="card"><div class="card-head"><h3>Procesos</h3><label class="checkline"><input type="checkbox" data-accion="ver-archivados"' + (Sesion.verArchivados ? ' checked' : '') + '> Ver archivados</label></div>' +
    '<div class="card-body flush">' + (lista.length ? '<div class="tw"><table class="t"><thead><tr><th>Código</th><th>Proceso</th><th>Estado</th><th class="n">Presupuesto base</th><th>Cierre</th><th>Responsable</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : UI.vacio('Aún no hay procesos', 'Cree el primero o cargue la demostración para conocer el programa.')) + '</div></div>' +
    (p ? fichaProceso(p) : '');
  return { html, acciones:Object.assign({
    'abrir-proceso':b => App.abrirProceso(b.dataset.id),
    'duplicar-proceso':b => duplicarProceso(b.dataset.id),
    'archivar-proceso':async b => { const x = Modelo.proceso(b.dataset.id); await Modelo.archivar(x.id, !x.archivado); App.render(); },
    'ver-archivados':b => { Sesion.verArchivados = b.checked; App.render(); },
    'guardar-ficha':() => guardarFicha(p)
  }, Vistas['01'].accionesComunes) };
};
const CAMPOS_PROCESO = (p) => [
  { k:'codigo', lab:'Código del proceso', val:p.codigo, placeholder:'LIC-2026-014' },
  { k:'nombre', lab:'Nombre', val:p.nombre },
  { k:'objeto', lab:'Objeto', tipo:'textarea', val:p.objeto, c2:true, filas:3 },
  { k:'modalidad', lab:'Modalidad', tipo:'select', opts:Pliego.MODALIDADES, val:p.modalidad },
  { k:'tipoContrato', lab:'Tipo de contrato', tipo:'select', opts:Pliego.TIPOS_CONTRATO, val:p.tipoContrato },
  { k:'pais', lab:'País', val:p.pais || 'Colombia' }, { k:'moneda', lab:'Moneda', val:p.moneda || 'COP' },
  { k:'ciudad', lab:'Ciudad', val:p.ciudad }, { k:'ubicacionObra', lab:'Ubicación de la obra', val:p.ubicacionObra },
  { k:'areaConstruida', lab:'Área construida (m²)', tipo:'number', val:p.areaConstruida },
  { k:'plazoMaximoDias', lab:'Plazo máximo (días calendario)', tipo:'number', val:p.plazoMaximoDias },
  { k:'responsable', lab:'Responsable', val:p.responsable },
  { k:'politicaApu', lab:'APU exigido a los proponentes', tipo:'select', val:p.politicaApu,
    opts:[{ v:'todas', n:'En todas las actividades' }, { v:'pareto', n:'Solo en las que suman el 80 % del valor (Pareto)' }, { v:'manual', n:'Solo en las marcadas a mano' }] },
  { k:'presupuestoOficialVisible', lab:'Los proponentes conocen el valor total del presupuesto oficial', tipo:'check', val:p.presupuestoOficialVisible, c2:true },
  { k:'sobreCerrado', lab:'Sobre cerrado: las ofertas viajan cifradas y solo se abren después del cierre', tipo:'check', val:p.sobreCerrado !== false, c2:true }
];
function fichaProceso(p){
  const ed = Modelo.editable(p) && Permisos.puede('editarProceso');
  const campos = CAMPOS_PROCESO(p).map(c => Object.assign(c, { deshabilitado:!ed || (c.k === 'codigo' && !Modelo.editable(p)) }));
  return '<div class="card"><div class="card-head"><h3>Ficha del proceso abierto · ' + esc(p.codigo) + '</h3>' + (ed ? boton('guardar-ficha', 'Guardar ficha', 'primary sm') : '') + '</div>' +
    '<div class="card-body">' + avisoCongelado(p) + UI.formulario(campos, 'fp') + '</div></div>';
}
async function guardarFicha(p){
  const v = UI.leer(CAMPOS_PROCESO(p), document, 'fp');
  if (!v.codigo) throw new Error('El código del proceso no puede quedar vacío.');
  if (Modelo.procesos(true).some(x => x.id !== p.id && Util.normaliza(x.codigo) === Util.normaliza(v.codigo))) throw new Error('Ya existe otro proceso con el código ' + v.codigo + '.');
  Object.assign(p, v, { areaConstruida:Number(v.areaConstruida||0), plazoMaximoDias:Number(v.plazoMaximoDias||0) });
  await Modelo.guardarProceso(p, 'Ficha del proceso');
  UI.toast('Ficha guardada', 'ok'); App.render();
}
async function nuevoProceso(){
  const base = Modelo.procesos(true).length + 1;
  const campos = CAMPOS_PROCESO({ codigo:'LIC-' + new Date().getFullYear() + '-' + String(base).padStart(3,'0'), nombre:'', modalidad:'invitación cerrada', tipoContrato:'precios unitarios', pais:'Colombia', moneda:'COP', politicaApu:'todas',
    responsable:Sesion.usuario.nombre || Sesion.usuario.usuario });
  const v = await UI.pedir({ titulo:'Nuevo proceso', eyebrow:'Módulo 01', campos, textoAceptar:'Crear proceso',
    validar:x => !x.codigo ? 'Escriba el código del proceso.' : !x.nombre ? 'Escriba el nombre del proceso.' : '' });
  if (!v) return;
  const p = await Modelo.crearProceso(v);
  UI.toast('Proceso ' + p.codigo + ' creado con la plantilla de condiciones del Anexo B', 'ok');
  App.abrirProceso(p.id, '02');
}
async function duplicarProceso(id){
  const o = Modelo.proceso(id);
  const v = await UI.pedir({ titulo:'Duplicar ' + o.codigo, campos:[
    { k:'codigo', lab:'Código del proceso nuevo', val:o.codigo + '-B' }, { k:'nombre', lab:'Nombre', val:o.nombre + ' (copia)' },
    { k:'presupuesto', lab:'Copiar el presupuesto base', tipo:'check', val:true, c2:true }, { k:'condiciones', lab:'Copiar las condiciones de la oferta', tipo:'check', val:true, c2:true },
    { k:'documentos', lab:'Copiar los documentos del proceso', tipo:'check', val:false, c2:true }], textoAceptar:'Duplicar',
    despues:'<p class="small muted" style="margin-top:12px">El proceso nuevo empieza en borrador, sin invitados, sin llaves y con el acuerdo de confidencialidad sin aprobar.</p>' });
  if (!v) return;
  const p = await Modelo.duplicar(id, v);
  UI.toast('Proceso ' + p.codigo + ' creado', 'ok');
  App.abrirProceso(p.id, '01');
}
Vistas['01'].accionesComunes = {
  'nuevo-proceso':() => nuevoProceso(),
  'ir-01':() => App.ir('01'),
  'cargar-demo':async () => {
    const p = await Modelo.cargarDemo();
    UI.toast('Demostración cargada: ' + p.codigo + '. Todo lo ficticio va rotulado y se borra con un botón.', 'ok');
    App.abrirProceso(p.id, '00');
  },
  'borrar-demo':async () => {
    if (!(await UI.confirmar({ titulo:'Borrar datos de demostración', mensaje:'Se borran todos los procesos de demostración, con su presupuesto, sus condiciones, sus invitados, sus documentos y sus llaves. Sus datos reales no se tocan.', textoAceptar:'Borrar demostración', claseAceptar:'danger' }))) return;
    await Modelo.borrarDemo(); UI.toast('Datos de demostración borrados', 'ok'); App.render();
  }
};
