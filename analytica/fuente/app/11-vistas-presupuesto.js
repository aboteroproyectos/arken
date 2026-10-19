/* ─────────────── 02 · Presupuesto base ───────────────
   El mismo árbol de ARKEN CONTROL: capítulo › subcapítulo › actividad, el
   catálogo de APU y la lista de insumos con las siete categorías. */
Vistas['02'] = function(){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso('02', 'Presupuesto base') };
  const pres = Modelo.presupuesto(p.id);
  const ed = Modelo.editable(p) && Permisos.puede('editarPresupuesto');
  const ocultar = ocultarPrecios();
  const tab = UI.pestanaActiva('pres', 'actividades');
  const t = Calculo.totales(pres), c = Calculo.contar(pres);
  const acciones =
    (ed ? boton('importar-arken', 'Importar Excel de ARKEN CONTROL') + boton('copiar-presupuesto', 'Copiar de otro proceso') : '') +
    boton('exportar-arken', 'Exportar para ARKEN CONTROL', 'brass') +
    '<select id="nivelPdf" aria-label="Nivel del PDF">' + Object.keys(Documentos.NIVELES).map(k => '<option value="' + k + '">PDF · ' + Documentos.NIVELES[k] + '</option>').join('') + '</select>' + boton('pdf-presupuesto', 'Generar PDF');
  let cuerpo;
  if (ocultar) cuerpo = '<div class="nota">La configuración del programa oculta los precios a los evaluadores técnicos hasta que terminen su calificación, para que el precio no influya en lo técnico.</div>';
  else if (tab === 'apu') cuerpo = tablaApus(pres, ed);
  else if (tab === 'insumos') cuerpo = tablaInsumos(pres, ed);
  else if (tab === 'aiu') cuerpo = formularioAiu(pres, ed);
  else cuerpo = arbol(p, pres, ed);
  const html = cabecera('02', 'Presupuesto base', esc(p.codigo) + ' · versión del pliego ' + p.versionPliego + (pres.congelado ? ' · congelado' : '') + etiquetaDemo(p), acciones) + avisoCongelado(p) +
    '<div class="sumario">' +
      '<div class="stat"><div class="lab">Costo directo</div><div class="val">' + (ocultar ? '—' : money(t.costoDirecto)) + '</div></div>' +
      '<div class="stat"><div class="lab">AIU</div><div class="val">' + (ocultar ? '—' : money(t.aiu)) + '</div><div class="foot">' + t.pctA + ' / ' + t.pctI + ' / ' + t.pctU + ' %</div></div>' +
      '<div class="stat"><div class="lab">IVA</div><div class="val">' + (ocultar ? '—' : money(t.iva)) + '</div></div>' +
      '<div class="stat accent"><div class="lab">Total</div><div class="val">' + (ocultar ? '—' : money(t.total)) + '</div></div>' +
      '<div class="stat"><div class="lab">Contenido</div><div class="val" style="font-size:14px">' + c.actividades + ' act. · ' + c.apus + ' APU · ' + c.insumos + ' ins.</div><div class="foot">' + c.capitulos + ' capítulos · ' + c.subcapitulos + ' subcapítulos</div></div>' +
    '</div>' +
    UI.pestanas('pres', [['actividades','Capítulos y actividades'],['apu','APU'],['insumos','Insumos'],['aiu','AIU e IVA']], 'actividades') + cuerpo;
  return { html, acciones:accionesPresupuesto(p, pres) };
};
function ocultarPrecios(){
  const u = Sesion.usuario;
  return !!(S.config.ocultarPreciosATecnicos && u && (u.roles||[]).indexOf('tecnico') >= 0 && !(u.roles||[]).some(r => r === 'administrador' || r === 'director'));
}

function arbol(p, pres, ed){
  const exigen = Calculo.exigenApu(pres, p.politicaApu);
  const pareto = Calculo.pareto(pres);
  const cd = Calculo.costoDirecto(pres) || 1;
  const filas = [];
  (pres.capitulos||[]).forEach(cap => {
    filas.push('<tr class="row-cap"><td>' + esc(cap.codigo) + '</td><td colspan="4">' + esc(cap.nombre) + '</td><td class="n">' + money(Calculo.valorCapitulo(pres, cap)) + '</td><td class="n">' +
      Util.pct(Calculo.valorCapitulo(pres, cap) / cd * 100) + '</td><td class="act">' + (ed ? boton('nuevo-sub', '+ Subcapítulo', 'xs', ' data-cap="' + cap.id + '"') + ' ' + boton('editar-cap', 'Editar', 'xs', ' data-cap="' + cap.id + '"') + ' ' + boton('borrar-cap', '✕', 'xs', ' data-cap="' + cap.id + '" aria-label="Borrar capítulo"') : '') + '</td></tr>');
    (cap.subs||[]).forEach(sub => {
      filas.push('<tr class="row-sub"><td><span class="ind1"></span>' + esc(sub.codigo) + '</td><td colspan="4">' + esc(sub.nombre) + '</td><td class="n">' + money(Calculo.valorSubcapitulo(pres, sub)) + '</td><td></td><td class="act">' +
        (ed ? boton('nueva-act', '+ Actividad', 'xs', ' data-cap="' + cap.id + '" data-sub="' + sub.id + '"') + ' ' + boton('editar-sub', 'Editar', 'xs', ' data-cap="' + cap.id + '" data-sub="' + sub.id + '"') + ' ' + boton('borrar-sub', '✕', 'xs', ' data-cap="' + cap.id + '" data-sub="' + sub.id + '" aria-label="Borrar subcapítulo"') : '') + '</td></tr>');
      (sub.acts||[]).forEach(a => {
        const cods = (a.apus||[]).map(id => (Calculo.apu(pres, id) || {}).codigo).filter(Boolean).join(', ');
        const marcas = (exigen.has(a.id) ? UI.tag('APU exigido', 'brass') : '') + (pareto.has(a.id) ? UI.tag('80 %', 'info') : '') + (a.cantidadIncierta ? UI.tag('cantidad incierta', 'warn') : '') +
          (!(a.apus||[]).length ? UI.tag('sin APU', 'bad') : '') + (!(Number(a.cantidad) > 0) ? UI.tag('sin cantidad', 'bad') : '');
        filas.push('<tr class="row-act"><td class="cod"><span class="ind2"></span>' + esc(a.codigo) + '</td><td>' + esc(a.nombre) + '<div class="marcas">' + marcas + '</div>' + (a.notas ? '<div class="small muted">' + esc(a.notas) + '</div>' : '') + '</td><td>' + esc(a.unidad) +
          '</td><td class="n">' + cant(a.cantidad) + '</td><td class="n">' + money3(Calculo.unitarioActividad(pres, a)) + '<div class="small muted">' + esc(cods) + '</div></td><td class="n">' + money(Calculo.valorActividad(pres, a)) +
          '</td><td></td><td class="act">' + (ed ? boton('editar-act', 'Editar', 'xs', ' data-cap="' + cap.id + '" data-sub="' + sub.id + '" data-act="' + a.id + '"') + ' ' + boton('borrar-act', '✕', 'xs', ' data-cap="' + cap.id + '" data-sub="' + sub.id + '" data-act="' + a.id + '" aria-label="Borrar actividad"') : '') + '</td></tr>');
      });
    });
  });
  const t = Calculo.totales(pres);
  return '<div class="card"><div class="card-head"><h3>Capítulos, subcapítulos y actividades</h3>' + (ed ? boton('nuevo-cap', '+ Capítulo', 'sm primary') : '') + '</div><div class="card-body flush">' +
    (filas.length ? '<div class="tw scroll"><table class="t"><thead><tr><th>Código</th><th>Descripción</th><th>Unidad</th><th class="n">Cantidad</th><th class="n">Unitario</th><th class="n">Valor</th><th class="n">%</th><th></th></tr></thead><tbody>' + filas.join('') +
      '</tbody><tfoot><tr><td></td><td colspan="4">Costo directo</td><td class="n">' + money(t.costoDirecto) + '</td><td></td><td></td></tr></tfoot></table></div>'
      : UI.vacio('El presupuesto base está vacío', 'Créelo a mano, impórtelo desde el Excel de ARKEN CONTROL o cópielo de otro proceso.', ed ? boton('nuevo-cap', '+ Capítulo', 'primary') + boton('importar-arken', 'Importar Excel de ARKEN CONTROL') : '')) + '</div></div>';
}
function tablaApus(pres, ed){
  const usos = new Map();
  Calculo.recorrerActividades(pres, a => (a.apus||[]).forEach(id => usos.set(id, (usos.get(id)||0) + 1)));
  const filas = (pres.apus||[]).map(ap => '<tr><td class="cod">' + esc(ap.codigo) + '</td><td>' + esc(ap.nombre) + '<div class="small muted">' + (ap.insumos||[]).length + ' insumo(s) · usado en ' + (usos.get(ap.id)||0) + ' actividad(es)</div></td><td>' + esc(ap.unidad) +
    '</td><td class="n">' + money3(Calculo.unitarioAPU(pres, ap.id)) + '</td><td class="act">' + boton('ver-apu', ed ? 'Editar' : 'Ver', 'xs', ' data-apu="' + ap.id + '"') + (ed ? ' ' + boton('borrar-apu', '✕', 'xs', ' data-apu="' + ap.id + '" aria-label="Borrar APU"') : '') + '</td></tr>').join('');
  return '<div class="card"><div class="card-head"><h3>Análisis de precios unitarios</h3>' + (ed ? boton('nuevo-apu', '+ APU', 'sm primary') : '') + '</div><div class="card-body flush">' +
    (filas ? '<div class="tw scroll"><table class="t"><thead><tr><th>Código</th><th>Nombre</th><th>Unidad</th><th class="n">Unitario</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>' : UI.vacio('Sin APU', 'Cree el primero.')) + '</div></div>';
}
function tablaInsumos(pres, ed){
  const q = Calculo.cantidadesInsumo(pres);
  const filas = (pres.insumos||[]).slice().sort((a, b) => (a.categoria + a.nombre).localeCompare(b.categoria + b.nombre)).map(i => '<tr><td class="cod">' + esc(i.codigo) + '</td><td>' + esc(i.categoria) + '</td><td>' + esc(i.nombre) + '</td><td>' + esc(i.unidad) +
    '</td><td class="n">' + money3(i.precio) + '</td><td class="n">' + cant(q.get(i.id) || 0) + '</td><td class="n">' + money((q.get(i.id)||0) * Number(i.precio||0)) + '</td><td class="act">' +
    (ed ? boton('editar-insumo', 'Editar', 'xs', ' data-ins="' + i.id + '"') + ' ' + boton('borrar-insumo', '✕', 'xs', ' data-ins="' + i.id + '" aria-label="Borrar insumo"') : '') + '</td></tr>').join('');
  return '<div class="card"><div class="card-head"><h3>Insumos del presupuesto</h3><div class="btn-row">' + (ed ? boton('nuevo-insumo', '+ Insumo', 'sm primary') + boton('actualizar-desde-base', 'Actualizar precios desde la base de precios', 'sm') : '') + '</div></div><div class="card-body flush">' +
    (filas ? '<div class="tw scroll"><table class="t"><thead><tr><th>Código</th><th>Categoría</th><th>Descripción</th><th>Unidad</th><th class="n">Precio (IVA incl.)</th><th class="n">Cantidad total</th><th class="n">Valor</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>' : UI.vacio('Sin insumos', '')) + '</div></div>';
}
const CAMPOS_AIU = (pres) => [
  { k:'a', lab:'Administración (%)', tipo:'number', val:pres.aiu.a }, { k:'i', lab:'Imprevistos (%)', tipo:'number', val:pres.aiu.i },
  { k:'u', lab:'Utilidad (%)', tipo:'number', val:pres.aiu.u }, { k:'tarifa', lab:'Tarifa de IVA (%)', tipo:'number', val:(pres.iva||{}).tarifa },
  { k:'base', lab:'Base del IVA', tipo:'select', val:(pres.iva||{}).base, opts:[{ v:'utilidad', n:'Sobre la utilidad (contratos con AIU)' }, { v:'total', n:'Sobre el total' }, { v:'ninguno', n:'No aplica' }] }
];
function formularioAiu(pres, ed){
  const t = Calculo.totales(pres);
  return '<div class="card"><div class="card-head"><h3>AIU e IVA</h3>' + (ed ? boton('guardar-aiu', 'Guardar', 'sm primary') : '') + '</div><div class="card-body">' +
    UI.formulario(CAMPOS_AIU(pres).map(c => Object.assign(c, { deshabilitado:!ed })), 'aiu') +
    '<div class="tw" style="margin-top:14px"><table class="t"><tbody>' + Documentos.bloquesPresupuesto(null, pres, 'capitulos').slice(-1)[0].filas.map(f => '<tr><td>' + esc(f.celdas[1]) + '</td><td class="n">' + esc(f.celdas[2]) + '</td></tr>').join('') + '</tbody></table></div>' +
    '<p class="small muted" style="margin-top:10px">Los precios de insumo van con IVA incluido, como en ARKEN CONTROL. El IVA de esta tabla es el del contrato (por defecto sobre la utilidad, propio de los contratos con AIU). Total: ' + money(t.total) + '.</p></div></div>';
}

/* ── Acciones del presupuesto ── */
function siguienteCodigo(lista, prefijo, ancho){
  let n = lista.length + 1, c;
  const usados = new Set(lista.map(x => Util.normaliza(x.codigo)));
  do { c = prefijo + String(n).padStart(ancho || 2, '0'); n++; } while (usados.has(Util.normaliza(c)));
  return c;
}
function accionesPresupuesto(p, pres){
  const buscarCap = id => pres.capitulos.find(c => c.id === id);
  const buscarSub = (cid, sid) => buscarCap(cid).subs.find(s => s.id === sid);
  const guardar = async (detalle) => { await Modelo.guardarPresupuesto(pres, detalle); App.render(); };
  async function pedirNodo(titulo, nodo, lista){
    const v = await UI.pedir({ titulo, ancho:'', campos:[{ k:'codigo', lab:'Código', val:nodo.codigo }, { k:'nombre', lab:'Nombre', val:nodo.nombre, c2:true }],
      validar:x => !x.codigo || !x.nombre ? 'Escriba el código y el nombre.' : lista.some(o => o !== nodo && Util.normaliza(o.codigo) === Util.normaliza(x.codigo)) ? 'El código ' + x.codigo + ' ya existe en este nivel.' : '' });
    return v;
  }
  async function editarActividad(cap, sub, act){
    const nueva = !act;
    const a = act || { id:Util.uid('ac'), codigo:siguienteCodigo(sub.acts, sub.codigo + '.'), nombre:'', unidad:'', cantidad:0, apus:[], obligatorioApu:false, cantidadIncierta:false, notas:'' };
    const codsApu = (a.apus||[]).map(id => (Calculo.apu(pres, id) || {}).codigo).filter(Boolean).join(', ');
    const v = await UI.pedir({ titulo:nueva ? 'Nueva actividad en ' + sub.codigo : 'Actividad ' + a.codigo, campos:[
      { k:'codigo', lab:'Código', val:a.codigo }, { k:'unidad', lab:'Unidad', val:a.unidad },
      { k:'nombre', lab:'Descripción', val:a.nombre, c2:true }, { k:'cantidad', lab:'Cantidad', tipo:'number', val:a.cantidad },
      { k:'apus', lab:'Código(s) de APU, separados por coma', val:codsApu, ayuda:'El unitario de la actividad es la suma de sus APU. Disponibles: ' + esc((pres.apus||[]).map(x => x.codigo).slice(0, 40).join(', ') || 'ninguno todavía') + ((pres.apus||[]).length > 40 ? '…' : '') },
      { k:'obligatorioApu', lab:'El proponente debe entregar APU de esta actividad', tipo:'check', val:a.obligatorioApu, c2:true },
      { k:'cantidadIncierta', lab:'Cantidad incierta (riesgo de mayores cantidades)', tipo:'check', val:a.cantidadIncierta, c2:true },
      { k:'notas', lab:'Notas', tipo:'textarea', val:a.notas, c2:true, filas:2 }],
      validar:x => {
        if (!x.codigo || !x.nombre) return 'Escriba el código y la descripción.';
        if (sub.acts.some(o => o.id !== a.id && Util.normaliza(o.codigo) === Util.normaliza(x.codigo))) return 'El código ' + x.codigo + ' ya existe en este subcapítulo.';
        const faltan = String(x.apus||'').split(/[,+]/).map(s => s.trim()).filter(Boolean).filter(cod => !(pres.apus||[]).some(ap => Util.normaliza(ap.codigo) === Util.normaliza(cod)));
        return faltan.length ? 'No existen estos APU: ' + faltan.join(', ') + '. Créelos primero en la pestaña APU.' : '';
      } });
    if (!v) return;
    Object.assign(a, { codigo:v.codigo, nombre:v.nombre, unidad:v.unidad, cantidad:Number(v.cantidad)||0, obligatorioApu:v.obligatorioApu, cantidadIncierta:v.cantidadIncierta, notas:v.notas,
      apus:String(v.apus||'').split(/[,+]/).map(s => s.trim()).filter(Boolean).map(cod => pres.apus.find(ap => Util.normaliza(ap.codigo) === Util.normaliza(cod)).id) });
    if (nueva) sub.acts.push(a);
    await guardar((nueva ? 'Nueva actividad ' : 'Actividad ') + a.codigo);
  }
  async function editarApu(ap){
    const nuevo = !ap;
    const x = ap ? Util.copia(ap) : { id:Util.uid('ap'), codigo:siguienteCodigo(pres.apus, 'APU-', 3), nombre:'', unidad:'', insumos:[] };
    const ed = Modelo.editable(p) && Permisos.puede('editarPresupuesto');
    const opciones = (pres.insumos||[]).map(i => '<option value="' + esc(i.codigo + ' · ' + i.nombre) + '"></option>').join('');
    function lineas(){ return x.insumos.map((l, k) => { const ins = Calculo.insumo(pres, l.idInsumo) || {};
      return '<tr><td><input data-l="' + k + '" data-c="ins" list="dlIns" value="' + esc(ins.codigo ? ins.codigo + ' · ' + ins.nombre : '') + '"' + (ed ? '' : ' disabled') + ' aria-label="Insumo"></td>' +
        '<td>' + esc(ins.unidad || '') + '</td><td class="n">' + money3(ins.precio) + '</td><td><input type="number" step="any" data-l="' + k + '" data-c="q" value="' + esc(l.cantidad) + '"' + (ed ? '' : ' disabled') + ' aria-label="Rendimiento"></td>' +
        '<td class="n">' + money3(Number(l.cantidad||0) * Number(ins.precio||0)) + '</td><td>' + (ed ? '<button class="btn xs" type="button" data-quitar="' + k + '" aria-label="Quitar">✕</button>' : '') + '</td></tr>'; }).join(''); }
    function pintar(m){
      const total = x.insumos.reduce((t, l) => { const ins = Calculo.insumo(pres, l.idInsumo); return t + (ins ? Number(l.cantidad||0) * Number(ins.precio||0) : 0); }, 0);
      $('#apuLineas', m.el).innerHTML = lineas(); $('#apuTotal', m.el).textContent = money3(total);
      $$('[data-quitar]', m.el).forEach(b => b.onclick = () => { x.insumos.splice(+b.dataset.quitar, 1); pintar(m); });
      $$('input[data-c="ins"]', m.el).forEach(inp => inp.onchange = () => {
        const cod = inp.value.split(' · ')[0].trim();
        const ins = pres.insumos.find(i => Util.normaliza(i.codigo) === Util.normaliza(cod) || Util.normaliza(i.nombre) === Util.normaliza(inp.value));
        if (!ins){ UI.toast('No existe ese insumo: créelo primero en la pestaña Insumos', 'bad'); return; }
        x.insumos[+inp.dataset.l].idInsumo = ins.id; pintar(m);
      });
      $$('input[data-c="q"]', m.el).forEach(inp => inp.onchange = () => { x.insumos[+inp.dataset.l].cantidad = Number(inp.value)||0; pintar(m); });
    }
    UI.modal({ titulo:nuevo ? 'Nuevo APU' : 'APU ' + x.codigo, ancho:'xwide',
      cuerpo:UI.formulario([{ k:'codigo', lab:'Código', val:x.codigo, deshabilitado:!ed }, { k:'unidad', lab:'Unidad', val:x.unidad, deshabilitado:!ed }, { k:'nombre', lab:'Nombre', val:x.nombre, c2:true, deshabilitado:!ed }], 'apu') +
        '<datalist id="dlIns">' + opciones + '</datalist><div class="tw" style="margin-top:14px"><table class="t"><thead><tr><th>Insumo</th><th>Unidad</th><th class="n">Precio</th><th class="n">Rendimiento</th><th class="n">Parcial</th><th></th></tr></thead><tbody id="apuLineas"></tbody>' +
        '<tfoot><tr><td colspan="4">Unitario del APU</td><td class="n" id="apuTotal"></td><td></td></tr></tfoot></table></div>' + (ed ? '<button class="btn sm" type="button" id="apuAgregar" style="margin-top:8px">+ Insumo</button>' : ''),
      alAbrir:m => { pintar(m); const b = $('#apuAgregar', m.el); if (b) b.onclick = () => { x.insumos.push({ idInsumo:'', cantidad:0 }); pintar(m); }; },
      botones:ed ? [{ texto:'Cancelar' }, { texto:'Guardar APU', clase:'primary', accion:async m => {
        const v = UI.leer([{ k:'codigo' }, { k:'unidad' }, { k:'nombre' }], m.el, 'apu');
        if (!v.codigo || !v.nombre) throw new Error('Escriba el código y el nombre del APU.');
        if (pres.apus.some(o => o.id !== x.id && Util.normaliza(o.codigo) === Util.normaliza(v.codigo))) throw new Error('El código ' + v.codigo + ' ya existe.');
        if (x.insumos.some(l => !l.idInsumo)) throw new Error('Hay renglones sin insumo: elíjalo o quítelos.');
        Object.assign(x, v);
        const i = pres.apus.findIndex(o => o.id === x.id);
        if (i >= 0) pres.apus[i] = x; else pres.apus.push(x);
        m.cerrar(); await guardar('APU ' + x.codigo);
      } }] : [{ texto:'Cerrar', clase:'primary' }] });
  }
  async function editarInsumo(ins){
    const nuevo = !ins;
    const x = ins || { id:Util.uid('in'), codigo:'', categoria:'Materiales', nombre:'', unidad:'', precio:0 };
    const v = await UI.pedir({ titulo:nuevo ? 'Nuevo insumo' : 'Insumo ' + x.codigo, campos:[
      { k:'codigo', lab:'Código', val:x.codigo || siguienteCodigo(pres.insumos, 'INS-', 4) }, { k:'categoria', lab:'Categoría', tipo:'select', opts:Calculo.CATEGORIAS_INSUMO, val:x.categoria },
      { k:'nombre', lab:'Descripción', val:x.nombre, c2:true }, { k:'unidad', lab:'Unidad', val:x.unidad }, { k:'precio', lab:'Precio unitario con IVA incluido', tipo:'number', paso:'0.001', val:x.precio }],
      validar:z => !z.codigo || !z.nombre ? 'Escriba el código y la descripción.' :
        pres.insumos.some(o => o.id !== x.id && Util.normaliza(o.nombre) === Util.normaliza(z.nombre)) ? 'Ya existe un insumo con esa descripción: ARKEN empareja por descripción y no puede haber dos iguales.' :
        pres.insumos.some(o => o.id !== x.id && Util.normaliza(o.codigo) === Util.normaliza(z.codigo)) ? 'El código ' + z.codigo + ' ya existe.' : !(Number(z.precio) >= 0) ? 'El precio debe ser un número mayor o igual a cero.' : '' });
    if (!v) return;
    Object.assign(x, v, { precio:Util.redondearDec(Number(v.precio)||0, 3) });
    if (nuevo) pres.insumos.push(x);
    await guardar('Insumo ' + x.codigo + ' · ' + money3(x.precio));
  }
  return {
    'importar-arken':async () => { const [f] = await UI.elegirArchivos('.xlsx,.xls'); if (f) await Documentos.importarDeArken(p, f, () => App.render()); },
    'exportar-arken':() => Documentos.exportarParaArken(p, pres),
    'pdf-presupuesto':() => Documentos.pdfPresupuesto(p, $('#nivelPdf').value),
    'copiar-presupuesto':async () => {
      const otros = Modelo.procesos(true).filter(x => x.id !== p.id);
      if (!otros.length) throw new Error('No hay otros procesos de donde copiar.');
      const v = await UI.pedir({ titulo:'Copiar el presupuesto de otro proceso', ancho:'', campos:[{ k:'origen', lab:'Proceso', tipo:'select', opts:otros.map(x => ({ v:x.id, n:x.codigo + ' · ' + x.nombre })), c2:true }],
        antes:'<div class="nota warn">El presupuesto base actual de ' + esc(p.codigo) + ' se reemplaza por la copia.</div>', textoAceptar:'Copiar' });
      if (!v) return;
      const o = Modelo.presupuesto(v.origen);
      Object.assign(pres, Util.copia({ capitulos:o.capitulos, apus:o.apus, insumos:o.insumos, aiu:o.aiu, iva:o.iva }));
      await guardar('Copiado de ' + Modelo.proceso(v.origen).codigo);
    },
    'nuevo-cap':async () => { const n = { id:Util.uid('cp'), codigo:siguienteCodigo(pres.capitulos, ''), nombre:'', subs:[] };
      const v = await pedirNodo('Nuevo capítulo', n, pres.capitulos); if (!v) return; Object.assign(n, v); pres.capitulos.push(n); await guardar('Capítulo ' + n.codigo); },
    'editar-cap':async b => { const c = buscarCap(b.dataset.cap); const v = await pedirNodo('Capítulo ' + c.codigo, c, pres.capitulos); if (!v) return; Object.assign(c, v); await guardar('Capítulo ' + c.codigo); },
    'borrar-cap':async b => { const c = buscarCap(b.dataset.cap);
      if (!(await UI.confirmar({ titulo:'Borrar capítulo', mensaje:'Se borra el capítulo ' + c.codigo + ' «' + c.nombre + '» con sus subcapítulos y actividades.', textoAceptar:'Borrar', claseAceptar:'danger' }))) return;
      pres.capitulos = pres.capitulos.filter(x => x !== c); await guardar('Capítulo borrado ' + c.codigo); },
    'nuevo-sub':async b => { const c = buscarCap(b.dataset.cap); const n = { id:Util.uid('sb'), codigo:siguienteCodigo(c.subs, c.codigo + '.'), nombre:'', acts:[] };
      const v = await pedirNodo('Nuevo subcapítulo en ' + c.codigo, n, c.subs); if (!v) return; Object.assign(n, v); c.subs.push(n); await guardar('Subcapítulo ' + n.codigo); },
    'editar-sub':async b => { const c = buscarCap(b.dataset.cap), s = buscarSub(b.dataset.cap, b.dataset.sub); const v = await pedirNodo('Subcapítulo ' + s.codigo, s, c.subs); if (!v) return; Object.assign(s, v); await guardar('Subcapítulo ' + s.codigo); },
    'borrar-sub':async b => { const c = buscarCap(b.dataset.cap), s = buscarSub(b.dataset.cap, b.dataset.sub);
      if (!(await UI.confirmar({ titulo:'Borrar subcapítulo', mensaje:'Se borra el subcapítulo ' + s.codigo + ' con sus actividades.', textoAceptar:'Borrar', claseAceptar:'danger' }))) return;
      c.subs = c.subs.filter(x => x !== s); await guardar('Subcapítulo borrado ' + s.codigo); },
    'nueva-act':b => editarActividad(buscarCap(b.dataset.cap), buscarSub(b.dataset.cap, b.dataset.sub), null),
    'editar-act':b => { const s = buscarSub(b.dataset.cap, b.dataset.sub); return editarActividad(buscarCap(b.dataset.cap), s, s.acts.find(a => a.id === b.dataset.act)); },
    'borrar-act':async b => { const s = buscarSub(b.dataset.cap, b.dataset.sub), a = s.acts.find(x => x.id === b.dataset.act);
      if (!(await UI.confirmar({ titulo:'Borrar actividad', mensaje:'Se borra la actividad ' + a.codigo + ' «' + a.nombre + '».', textoAceptar:'Borrar', claseAceptar:'danger' }))) return;
      s.acts = s.acts.filter(x => x !== a); await guardar('Actividad borrada ' + a.codigo); },
    'nuevo-apu':() => editarApu(null),
    'ver-apu':b => editarApu(pres.apus.find(a => a.id === b.dataset.apu)),
    'borrar-apu':async b => { const ap = pres.apus.find(a => a.id === b.dataset.apu);
      let usos = 0; Calculo.recorrerActividades(pres, a => { if ((a.apus||[]).indexOf(ap.id) >= 0) usos++; });
      if (usos) throw new Error('El APU ' + ap.codigo + ' está en ' + usos + ' actividad(es): quítelo de ellas antes de borrarlo.');
      if (!(await UI.confirmar({ titulo:'Borrar APU', mensaje:'Se borra el APU ' + ap.codigo + '.', textoAceptar:'Borrar', claseAceptar:'danger' }))) return;
      pres.apus = pres.apus.filter(x => x !== ap); await guardar('APU borrado ' + ap.codigo); },
    'nuevo-insumo':() => editarInsumo(null),
    'editar-insumo':b => editarInsumo(pres.insumos.find(i => i.id === b.dataset.ins)),
    'borrar-insumo':async b => { const ins = pres.insumos.find(i => i.id === b.dataset.ins);
      const usos = pres.apus.filter(ap => (ap.insumos||[]).some(l => l.idInsumo === ins.id)).map(ap => ap.codigo);
      if (usos.length) throw new Error('El insumo está en los APU ' + usos.join(', ') + ': quítelo de ellos antes de borrarlo.');
      if (!(await UI.confirmar({ titulo:'Borrar insumo', mensaje:'Se borra el insumo ' + ins.codigo + ' «' + ins.nombre + '».', textoAceptar:'Borrar', claseAceptar:'danger' }))) return;
      pres.insumos = pres.insumos.filter(x => x !== ins); await guardar('Insumo borrado ' + ins.codigo); },
    'guardar-aiu':async () => {
      const v = UI.leer(CAMPOS_AIU(pres), document, 'aiu');
      if (['a','i','u','tarifa'].some(k => !(Number(v[k]) >= 0))) throw new Error('A, I, U y la tarifa de IVA deben ser números mayores o iguales a cero.');
      pres.aiu = { a:Number(v.a), i:Number(v.i), u:Number(v.u) }; pres.iva = { tarifa:Number(v.tarifa), base:v.base };
      await guardar('AIU ' + v.a + ' / ' + v.i + ' / ' + v.u + ' · IVA ' + v.tarifa + ' % ' + v.base);
    },
    'actualizar-desde-base':() => actualizarDesdeBase(p, pres)
  };
}
/** Vista previa antes y después: precios del presupuesto contra la base de
    precios, emparejados por descripción normalizada. */
async function actualizarDesdeBase(p, pres){
  const base = new Map((S.basePrecios||[]).map(b => [Util.normaliza(b.nombre), b]));
  const cambios = (pres.insumos||[]).map(i => ({ i, b:base.get(Util.normaliza(i.nombre)) })).filter(x => x.b && Math.abs(Number(x.b.precio) - Number(x.i.precio)) >= 0.0005);
  if (!cambios.length){ UI.aviso('Sin cambios', '<p>Ningún insumo del presupuesto tiene un precio distinto en la base de precios (se emparejan por descripción).</p>'); return; }
  const antes = Calculo.totales(pres).costoDirecto;
  const copia = Util.copia(pres); cambios.forEach(x => { copia.insumos.find(i => i.id === x.i.id).precio = Number(x.b.precio); });
  const despues = Calculo.totales(copia).costoDirecto;
  const ok = await UI.confirmar({ titulo:'Actualizar precios desde la base', ancho:'wide', textoAceptar:'Actualizar ' + cambios.length + ' precio(s)',
    cuerpo:'<div class="tw scroll"><table class="t"><thead><tr><th>Insumo</th><th class="n">Antes</th><th class="n">Después</th><th>Fuente</th></tr></thead><tbody>' +
      cambios.map(x => '<tr><td>' + esc(x.i.nombre) + '</td><td class="n">' + money3(x.i.precio) + '</td><td class="n">' + money3(x.b.precio) + '</td><td class="small">' + esc(x.b.fuente || '') + ' · ' + Util.fmtFecha(x.b.fecha) + '</td></tr>').join('') +
      '</tbody></table></div><p style="margin-top:10px">Costo directo: ' + money(antes) + ' → <b>' + money(despues) + '</b></p>' });
  if (!ok) return;
  cambios.forEach(x => { x.i.precio = Number(x.b.precio); });
  await Modelo.guardarPresupuesto(pres, 'Precios actualizados desde la base: ' + cambios.length + ' insumo(s)');
  App.render();
}

/* ─────────────── 03 · Base de precios ─────────────── */
Vistas['03'] = function(){
  const ed = Permisos.puede('editarBasePrecios');
  const filtro = Util.normaliza(Sesion.filtroBase || '');
  const lista = (S.basePrecios||[]).filter(i => !filtro || Util.normaliza(i.nombre + ' ' + i.codigo + ' ' + i.categoria).indexOf(filtro) >= 0)
    .sort((a, b) => (a.categoria + a.nombre).localeCompare(b.categoria + b.nombre));
  const ocultar = ocultarPrecios();
  const filas = lista.slice(0, 2000).map(i => '<tr><td class="cod">' + esc(i.codigo || '—') + '</td><td>' + esc(i.categoria) + '</td><td>' + esc(i.nombre) + '</td><td>' + esc(i.unidad) +
    '</td><td class="n">' + (ocultar ? '—' : money3(i.precio)) + '</td><td>' + Util.fmtFecha(i.fecha) + '</td><td class="small">' + esc(i.fuente || '') + '</td><td class="act">' +
    boton('historial-base', 'Historial (' + (i.historial||[]).length + ')', 'xs', ' data-id="' + i.id + '"') + (ed ? ' ' + boton('editar-base', 'Editar', 'xs', ' data-id="' + i.id + '"') : '') + '</td></tr>').join('');
  const p = Modelo.activo();
  const html = cabecera('03', 'Base de precios', 'Lista maestra de insumos de la EMPRESA PRINCIPAL, con historial por fecha y fuente',
      (ed ? boton('importar-precios', 'Actualizar desde Excel de ARKEN PRECIOS', 'brass') + boton('nuevo-base', '+ Insumo') +
        (p ? boton('base-desde-presupuesto', 'Agregar insumos de ' + p.codigo, '', ' title="Agregar a la base los insumos del presupuesto de ' + esc(p.codigo) + '"') : '') : '')) +
    '<div class="toolbar"><div class="field grow"><label for="filtroBase">Buscar</label><input id="filtroBase" value="' + esc(Sesion.filtroBase || '') + '" placeholder="Descripción, código o categoría"></div></div>' +
    '<div class="card"><div class="card-head"><h3>' + lista.length + ' insumo(s)</h3></div><div class="card-body flush">' +
    (filas ? '<div class="tw scroll"><table class="t"><thead><tr><th>Código</th><th>Categoría</th><th>Descripción</th><th>Unidad</th><th class="n">Precio (IVA incl.)</th><th>Fecha</th><th>Fuente</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : UI.vacio('La base de precios está vacía', 'Cárguela desde el Excel de ARKEN PRECIOS o desde los insumos de un presupuesto.')) + '</div></div>';
  return { html, alPintar:() => { const f = $('#filtroBase'); if (f) f.oninput = () => { Sesion.filtroBase = f.value; App.render(); const g = $('#filtroBase'); g.focus(); g.setSelectionRange(g.value.length, g.value.length); }; },
    acciones:{
      'importar-precios':async () => { const [f] = await UI.elegirArchivos('.xlsx,.xls'); if (f) await Documentos.importarDePrecios(f, () => App.render()); },
      'nuevo-base':() => editarBase(null),
      'editar-base':b => editarBase((S.basePrecios||[]).find(i => i.id === b.dataset.id)),
      'historial-base':b => { const i = (S.basePrecios||[]).find(x => x.id === b.dataset.id);
        UI.aviso('Historial · ' + i.nombre, '<div class="tw"><table class="t"><thead><tr><th>Fecha</th><th class="n">Precio</th><th class="n">Anterior</th><th>Fuente</th><th>Usuario</th></tr></thead><tbody>' +
          (i.historial||[]).slice().reverse().map(h => '<tr><td>' + Util.fmtSello(h.fecha) + '</td><td class="n">' + money3(h.precio) + '</td><td class="n">' + (h.anterior === null ? '—' : money3(h.anterior)) + '</td><td>' + esc(h.fuente) + '</td><td>' + esc(h.usuario) + '</td></tr>').join('') + '</tbody></table></div>', 'wide'); },
      'base-desde-presupuesto':async () => {
        const pres = Modelo.presupuesto(p.id);
        const ya = new Set((S.basePrecios||[]).map(b => Util.normaliza(b.nombre)));
        const nuevos = (pres.insumos||[]).filter(i => !ya.has(Util.normaliza(i.nombre)));
        if (!nuevos.length){ UI.toast('Todos los insumos del presupuesto ya están en la base', 'ok'); return; }
        if (!(await UI.confirmar({ titulo:'Agregar a la base de precios', mensaje:'Se agregan ' + nuevos.length + ' insumo(s) del presupuesto de ' + p.codigo + ' que no están en la base, con su precio actual.', textoAceptar:'Agregar' }))) return;
        for (const i of nuevos) await Modelo.guardarInsumoBase({ codigo:i.codigo, nombre:i.nombre, unidad:i.unidad, categoria:i.categoria }, Number(i.precio), 'presupuesto ' + p.codigo);
        UI.toast(nuevos.length + ' insumo(s) agregados', 'ok'); App.render();
      }
    } };
};
async function editarBase(ins){
  const x = ins ? Util.copia(ins) : { codigo:'', categoria:'Materiales', nombre:'', unidad:'', precio:0, historial:[] };
  const v = await UI.pedir({ titulo:ins ? 'Insumo de la base' : 'Nuevo insumo en la base', campos:[
    { k:'codigo', lab:'Código', val:x.codigo }, { k:'categoria', lab:'Categoría', tipo:'select', opts:Calculo.CATEGORIAS_INSUMO, val:x.categoria },
    { k:'nombre', lab:'Descripción', val:x.nombre, c2:true }, { k:'unidad', lab:'Unidad', val:x.unidad },
    { k:'precio', lab:'Precio con IVA incluido', tipo:'number', paso:'0.001', val:x.precio }, { k:'fuente', lab:'Fuente del precio', val:'manual' }],
    validar:z => !z.nombre ? 'Escriba la descripción.' : (S.basePrecios||[]).some(o => o.id !== x.id && Util.normaliza(o.nombre) === Util.normaliza(z.nombre)) ? 'Ya existe en la base un insumo con esa descripción.' : !(Number(z.precio) >= 0) ? 'Precio no válido.' : '' });
  if (!v) return;
  Object.assign(x, { codigo:v.codigo, categoria:v.categoria, nombre:v.nombre, unidad:v.unidad });
  await Modelo.guardarInsumoBase(x, Util.redondearDec(Number(v.precio), 3), v.fuente || 'manual');
  App.render();
}
