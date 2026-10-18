/* ─────────────── 03 · Presupuesto y APU ───────────────
   El formulario de cantidades es de solo lectura. Por actividad, el
   proponente arma sus APU (o escribe el precio donde el pliego no exige APU);
   el precio unitario lo calcula el programa como la suma de los APU. */
const LIMITE_FILAS = 400;
Vistas['03'] = function(){
  const b = Oferta.borrador(), pl = Oferta.pl();
  const tab = UI.pestanaActiva('pre', 'actividades');
  const k = Borrador.calculo(b, pl);
  const t = k.totales;
  const acciones = boton('plantilla-precios', 'Descargar plantilla de precios (Excel)') + boton('importar-precios', 'Importar precios', 'brass');
  const html = cabecera('03', 'Presupuesto y APU', esc(pl.proceso.codigo) + ' · versión ' + pl.versionPliego + ' · ' + esc(pl.proceso.politicaApu === 'todas' ? 'APU en todas las actividades' : pl.proceso.politicaApu === 'pareto' ? 'APU en las actividades que suman el 80 %' : 'APU en las actividades marcadas'), acciones) +
    '<div class="sumario">' +
      '<div class="stat"><div class="lab">Costo directo</div><div class="val">' + money(t.costoDirecto) + '</div></div>' +
      '<div class="stat"><div class="lab">AIU</div><div class="val">' + money(t.aiu) + '</div><div class="foot">' + t.pctA + ' / ' + t.pctI + ' / ' + t.pctU + ' %</div></div>' +
      '<div class="stat"><div class="lab">IVA</div><div class="val">' + money(t.iva) + '</div></div>' +
      '<div class="stat accent"><div class="lab">Valor de la oferta</div><div class="val">' + money(t.total) + '</div></div>' +
      (pl.presupuestoOficial ? '<div class="stat"><div class="lab">Presupuesto oficial</div><div class="val">' + money(pl.presupuestoOficial) + '</div><div class="foot">Total publicado en el pliego</div></div>' : '') +
    '</div>' + UI.pestanas('pre', [['actividades','Actividades'], ['insumos','Mis insumos']], 'actividades') +
    (tab === 'insumos' ? vistaInsumosOferta(b) : vistaActividadesOferta(b, pl, k));
  return { html, acciones:{
    'editar-act':el => editarActividad(b, pl, el.dataset.clave),
    'filtro-pre':() => {},
    'plantilla-precios':() => { const r = Intercambio.plantillaPrecios(b, pl); UI.descargar(r.nombre, r.blob); },
    'importar-precios':() => importarPrecios(b, pl),
    'revisado-act':async el => { Borrador.marcarRevisado(b, 'actividades', el.dataset.clave); await Oferta.guardar(); App.render(); }
  }, cambios:{
    'filtro-pre':el => { Sesion.filtroPre = el.value; App.render(); },
    'buscar-pre':el => { Sesion.buscarPre = el.value; App.render(); },
    'precio-insumo':async el => {
      const v = Number(el.value);
      if (!(v >= 0)) throw new Error('El precio debe ser un número mayor o igual a cero.');
      const n = Borrador.cambiarPrecioInsumo(b, el.dataset.clave, Util.redondearDec(v, 3));
      await Oferta.guardar(); UI.toast('Precio cambiado en ' + n + ' renglón(es) de APU', 'ok'); App.render();
    }
  } };
};
function vistaActividadesOferta(b, pl, k){
  const filtro = Sesion.filtroPre || 'todas', q = Util.normaliza(Sesion.buscarPre || '');
  const revisar = new Set(b.revisar.actividades || []);
  let lista = Borrador.actividades(pl).map(a => Object.assign({ avisos:Borrador.avisosActividad(a, Borrador.act(b, a.clave)), unit:k.unitario.get(a.clave) || 0 }, a));
  if (q) lista = lista.filter(a => Util.normaliza(a.codigo + ' ' + a.nombre).indexOf(q) >= 0);
  if (filtro === 'sin') lista = lista.filter(a => !(a.unit > 0));
  if (filtro === 'avisos') lista = lista.filter(a => a.avisos.length);
  if (filtro === 'revisar') lista = lista.filter(a => revisar.has(a.clave));
  const filas = [];
  let cap = null, sub = null;
  lista.slice(0, LIMITE_FILAS).forEach(a => {
    if (a.cap !== cap){ cap = a.cap; sub = null; filas.push('<tr class="row-cap"><td>' + esc(a.cap) + '</td><td colspan="6">' + esc(a.capNombre) + '</td></tr>'); }
    if (a.sub !== sub){ sub = a.sub; filas.push('<tr class="row-sub"><td><span class="ind1"></span>' + esc(a.sub) + '</td><td colspan="6">' + esc(a.subNombre) + '</td></tr>'); }
    const x = Borrador.act(b, a.clave);
    filas.push('<tr class="row-act' + (revisar.has(a.clave) ? ' revisar' : '') + '"><td class="cod"><span class="ind2"></span>' + esc(a.codigo) + '</td><td>' + esc(a.nombre) +
      '<div class="marcas">' + (a.apuObligatorio ? UI.tag('APU exigido', 'brass') : '') + (a.cantidadIncierta ? UI.tag('cantidad incierta', 'warn') : '') + (revisar.has(a.clave) ? UI.tag('la adenda la cambió', 'warn') : '') +
        a.avisos.map(v => UI.tag(v.txt, v.nivel)).join('') + '</div></td><td>' + esc(a.unidad) + '</td><td class="n">' + cant(a.cantidad) + '</td><td class="n">' + money3(a.unit) +
      '<div class="small muted">' + ((x.apus||[]).length ? (x.apus||[]).map(ap => esc(ap.codigo)).join(', ') : (a.unit > 0 ? 'precio directo' : '')) + '</div></td><td class="n">' + money(a.unit * a.cantidad) + '</td><td class="act">' +
      boton('editar-act', (x.apus||[]).length || a.unit > 0 ? 'Editar' : 'Poner precio', 'xs' + (a.unit > 0 ? '' : ' primary'), ' data-clave="' + esc(a.clave) + '"') +
      (revisar.has(a.clave) ? ' ' + boton('revisado-act', 'Revisada', 'xs', ' data-clave="' + esc(a.clave) + '"') : '') + '</td></tr>');
  });
  return '<div class="card"><div class="card-head"><h3>Formulario de cantidades</h3><div class="btn-row">' +
      '<input type="search" data-cambio="buscar-pre" placeholder="Buscar código o descripción" value="' + esc(Sesion.buscarPre || '') + '" aria-label="Buscar actividad" style="max-width:240px">' +
      '<select data-cambio="filtro-pre" aria-label="Filtrar actividades">' + [['todas','Todas'], ['sin','Sin precio'], ['avisos','Con avisos'], ['revisar','Por revisar (adenda)']].map(([v, n]) => '<option value="' + v + '"' + (v === filtro ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div></div>' +
    '<div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Código</th><th>Descripción</th><th>Unidad</th><th class="n">Cantidad</th><th class="n">Precio unitario</th><th class="n">Valor</th><th></th></tr></thead><tbody>' +
      (filas.join('') || '<tr><td colspan="7">' + UI.vacio('Ninguna actividad con este filtro', '') + '</td></tr>') + '</tbody></table></div>' +
    (lista.length > LIMITE_FILAS ? '<p class="small muted" style="padding:10px 14px">Se muestran ' + LIMITE_FILAS + ' de ' + lista.length + ' actividades. Use la búsqueda o el filtro para ver las demás.</p>' : '') +
    '<p class="small muted" style="padding:10px 14px">Código, descripción, unidad y cantidad son del pliego y no se pueden cambiar. Las observaciones a las cantidades van por preguntas (módulo 13).</p></div></div>';
}
function vistaInsumosOferta(b){
  const L = Borrador.insumosUsados(b);
  return '<div class="card"><div class="card-head"><h3>Mis insumos</h3></div><div class="card-body flush">' + (L.length ? '<div class="tw scroll"><table class="t"><thead><tr><th>Insumo</th><th>Unidad</th><th>Categoría</th><th class="n">Usos</th><th class="n">Precio (IVA incluido)</th></tr></thead><tbody>' +
    L.map(i => '<tr><td>' + esc(i.descripcion) + '</td><td>' + esc(i.unidad) + '</td><td>' + esc(i.categoria) + '</td><td class="n">' + i.usos + '</td><td class="n"><input class="num" type="number" step="any" data-cambio="precio-insumo" data-clave="' + esc(i.clave) + '" value="' + (i.precios.size === 1 ? Array.from(i.precios)[0] : '') + '"' + (i.precios.size > 1 ? ' placeholder="varios precios"' : '') + ' aria-label="Precio de ' + esc(i.descripcion) + '"></td></tr>').join('') +
    '</tbody></table></div><p class="small muted" style="padding:10px 14px">Cambiar un precio aquí lo cambia en todos los APU que usan ese insumo (misma descripción, unidad y categoría).</p>'
    : UI.vacio('Aún no hay insumos', 'Arme los APU de las actividades y aquí verá todos sus insumos para cambiar un precio en todos a la vez.')) + '</div></div>';
}

/** Editor de una actividad: precio directo o APU con insumos. */
function editarActividad(b, pl, clave){
  const a = Borrador.actividades(pl).find(x => x.clave === clave);
  if (!a) return;
  const w = Util.copia(Borrador.act(b, clave));
  w.apus = w.apus || [];
  const sugeridos = (pl.formularioCantidades.insumosSugeridos || []).concat(Borrador.insumosUsados(b).map(i => ({ descripcion:i.descripcion, unidad:i.unidad, categoria:i.categoria })));
  const porNombre = new Map(); sugeridos.forEach(s => { if (!porNombre.has(Util.normaliza(s.descripcion))) porNombre.set(Util.normaliza(s.descripcion), s); });
  const otras = Borrador.actividades(pl).filter(x => x.clave !== clave && (Borrador.act(b, x.clave).apus||[]).some(ap => (ap.insumos||[]).length));
  function leer(m){
    const pu = $('#eaPrecio', m.el); if (pu) w.precioUnitario = pu.value === '' ? 0 : Number(pu.value);
    $$('[data-ap]', m.el).forEach(el => {
      const ap = w.apus[+el.dataset.ap];
      if (el.dataset.ins === undefined) ap[el.dataset.c] = el.value;
      else { const i = ap.insumos[+el.dataset.ins]; i[el.dataset.c] = ['precio','cantidad'].indexOf(el.dataset.c) >= 0 ? (el.value === '' ? 0 : Number(el.value)) : el.value; }
    });
  }
  function cuerpo(){
    return '<p class="small"><b>' + esc(a.codigo) + '</b> · ' + esc(a.nombre) + ' · ' + cant(a.cantidad) + ' ' + esc(a.unidad) + (a.apuObligatorio ? ' · ' + UI.tag('el pliego exige APU', 'brass') : '') + '</p>' +
      (a.apuObligatorio ? '' : '<div class="field" style="max-width:280px"><label for="eaPrecio">Precio unitario escrito (si no entrega APU)</label><input id="eaPrecio" type="number" step="any" value="' + esc(w.precioUnitario || '') + '"></div>') +
      '<datalist id="insSug">' + Array.from(porNombre.values()).map(s => '<option value="' + esc(s.descripcion) + '">').join('') + '</datalist>' +
      w.apus.map((ap, i) => '<div class="card" style="margin-top:12px"><div class="card-head"><div class="row" style="gap:8px;flex-wrap:wrap">' +
        '<input data-ap="' + i + '" data-c="codigo" value="' + esc(ap.codigo) + '" aria-label="Código del APU" style="width:110px" placeholder="Código">' +
        '<input data-ap="' + i + '" data-c="nombre" value="' + esc(ap.nombre) + '" aria-label="Nombre del APU" style="min-width:220px" placeholder="Nombre del APU">' +
        '<input data-ap="' + i + '" data-c="unidad" value="' + esc(ap.unidad) + '" aria-label="Unidad del APU" style="width:70px" placeholder="Unidad"></div>' +
        '<div class="btn-row"><span class="num"><b>' + money3(Borrador.unitarioApu(ap)) + '</b></span><button class="btn xs" type="button" data-ea="ins-mas" data-i="' + i + '">+ Insumo</button><button class="btn xs ghost" type="button" data-ea="apu-menos" data-i="' + i + '">Quitar APU</button></div></div>' +
        '<div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Insumo</th><th>Unidad</th><th>Categoría</th><th class="n">Precio (IVA incl.)</th><th class="n">Rendimiento</th><th class="n">Parcial</th><th></th></tr></thead><tbody>' +
        (ap.insumos||[]).map((x, j) => '<tr><td><input class="ancho" list="insSug" data-ap="' + i + '" data-ins="' + j + '" data-c="descripcion" value="' + esc(x.descripcion) + '" aria-label="Insumo"></td>' +
          '<td><input data-ap="' + i + '" data-ins="' + j + '" data-c="unidad" value="' + esc(x.unidad) + '" style="width:70px;min-width:60px" aria-label="Unidad"></td>' +
          '<td><select data-ap="' + i + '" data-ins="' + j + '" data-c="categoria" aria-label="Categoría">' + Calculo.CATEGORIAS_INSUMO.map(c => '<option' + (c === x.categoria ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></td>' +
          '<td class="n"><input class="num" type="number" step="any" data-ap="' + i + '" data-ins="' + j + '" data-c="precio" value="' + esc(x.precio) + '" aria-label="Precio"></td>' +
          '<td class="n"><input class="num" type="number" step="any" data-ap="' + i + '" data-ins="' + j + '" data-c="cantidad" value="' + esc(x.cantidad) + '" aria-label="Rendimiento"></td>' +
          '<td class="n">' + money3(Number(x.precio||0) * Number(x.cantidad||0)) + '</td><td class="act"><button class="btn xs" type="button" data-ea="ins-menos" data-i="' + i + '" data-j="' + j + '" aria-label="Quitar insumo">✕</button></td></tr>').join('') +
        '</tbody></table></div></div></div>').join('') +
      '<div class="btn-row" style="margin-top:12px"><button class="btn sm" type="button" data-ea="apu-mas">+ APU</button>' +
        (otras.length ? '<select id="eaCopiar" aria-label="Copiar APU de otra actividad"><option value="">Copiar los APU de otra actividad…</option>' + otras.map(o => '<option value="' + esc(o.clave) + '">' + esc(o.codigo + ' · ' + o.nombre).slice(0, 80) + '</option>').join('') + '</select>' : '') + '</div>' +
      '<p class="small muted" style="margin-top:10px">Precio unitario de la actividad = suma de sus APU = <b>' + money3(w.apus.reduce((t, ap) => t + Borrador.unitarioApu(ap), 0) || Number(w.precioUnitario || 0)) + '</b>. Los precios de insumo van con IVA incluido, con 3 decimales.</p>';
  }
  const m = UI.modal({ titulo:'Precio de ' + a.codigo, eyebrow:'Módulo 03 · APU', ancho:'xwide', cuerpo:cuerpo(),
    botones:[{ texto:'Cancelar' }, { texto:'Guardar', clase:'primary', accion:async mm => {
      leer(mm);
      w.apus = w.apus.filter(ap => (ap.insumos||[]).length || ap.nombre);
      w.apus.forEach(ap => { ap.insumos = (ap.insumos||[]).filter(i => String(i.descripcion||'').trim()); (ap.insumos||[]).forEach(i => { i.precio = Util.redondearDec(i.precio, 3); }); });
      const vacio = w.apus.find(ap => !(ap.insumos||[]).length);
      if (vacio) throw new Error('El APU ' + (vacio.codigo || '') + ' no tiene insumos: agrégueselos o quítelo.');
      if (a.apuObligatorio && !w.apus.length) throw new Error('El pliego exige APU para ' + a.codigo + '.');
      if (!(Number(w.precioUnitario) >= 0)) throw new Error('El precio unitario debe ser un número.');
      b.acts[clave] = w;
      Borrador.marcarRevisado(b, 'actividades', clave);
      await Oferta.guardar(); mm.cerrar(); App.render();
    } }] });
  const repintar = () => { $('.modal-body', m.el).innerHTML = cuerpo(); conectar(); };
  function conectar(){
    $$('[data-ea]', m.el).forEach(el => el.onclick = () => {
      leer(m);
      const i = +el.dataset.i;
      if (el.dataset.ea === 'apu-mas') w.apus.push({ id:Util.uid('ap'), codigo:'APU-' + a.codigo + (w.apus.length ? '-' + (w.apus.length + 1) : ''), nombre:a.nombre, unidad:a.unidad, insumos:[{ descripcion:'', unidad:'', categoria:'Materiales', precio:0, cantidad:0 }] });
      if (el.dataset.ea === 'apu-menos') w.apus.splice(i, 1);
      if (el.dataset.ea === 'ins-mas') w.apus[i].insumos.push({ descripcion:'', unidad:'', categoria:'Materiales', precio:0, cantidad:0 });
      if (el.dataset.ea === 'ins-menos') w.apus[i].insumos.splice(+el.dataset.j, 1);
      repintar();
    });
    $$('[data-c="descripcion"]', m.el).forEach(el => el.addEventListener('change', () => {
      const s = porNombre.get(Util.normaliza(el.value)); if (!s) return;
      const ap = w.apus[+el.dataset.ap], x = ap.insumos[+el.dataset.ins];
      leer(m); x.unidad = x.unidad || s.unidad; x.categoria = s.categoria || x.categoria; repintar();
    }));
    $$('[data-c="precio"],[data-c="cantidad"]', m.el).forEach(el => el.addEventListener('change', () => { leer(m); repintar(); }));
    const cp = $('#eaCopiar', m.el);
    if (cp) cp.onchange = () => {
      if (!cp.value) return;
      leer(m);
      Util.copia(Borrador.act(b, cp.value).apus || []).forEach(ap => w.apus.push(Object.assign(ap, { id:Util.uid('ap') })));
      repintar();
    };
  }
  conectar();
}

/** Importación de precios con vista previa: qué coincide, qué falta y qué sobra. */
async function importarPrecios(b, pl){
  const [f] = await UI.elegirArchivos('.xlsx,.xls');
  if (!f) return;
  const plan = Intercambio.leerPrecios(await f.arrayBuffer(), pl);
  const lista = (t, xs, clase) => xs.length ? '<div class="nota ' + clase + '"><b>' + t + ' (' + xs.length + ')</b><ul>' + xs.slice(0, 30).map(x => '<li>' + esc(x) + '</li>').join('') + (xs.length > 30 ? '<li>y ' + (xs.length - 30) + ' más</li>' : '') + '</ul></div>' : '';
  UI.modal({ titulo:'Importar precios', eyebrow:plan.origen + ' · ' + f.name, ancho:'wide',
    cuerpo:'<div class="sumario"><div class="stat"><div class="lab">Coinciden</div><div class="val">' + plan.coinciden.length + '</div></div><div class="stat"><div class="lab">Faltan</div><div class="val">' + plan.faltan.length + '</div></div><div class="stat"><div class="lab">Sobran</div><div class="val">' + plan.sobran.length + '</div></div></div>' +
      lista('Errores: corríjalos en el Excel y cárguelo de nuevo', plan.errores, 'bad') + lista('Avisos', plan.avisos, 'warn') + lista('Actividades del pliego que el archivo no trae (quedan como están)', plan.faltan, '') + lista('Actividades del archivo que no están en el pliego (se ignoran)', plan.sobran, '') +
      '<p class="small">Nada se escribe hasta que usted confirme. Las actividades que coinciden toman el precio y los APU del archivo.</p>',
    botones:[{ texto:'Cancelar' }, { texto:'Importar ' + plan.coinciden.length + ' actividad(es)', clase:'primary', deshabilitado:!!plan.errores.length || !plan.coinciden.length, accion:async m => {
      Intercambio.aplicarPrecios(b, plan); await Oferta.guardar(); m.cerrar(); UI.toast('Precios importados en ' + plan.coinciden.length + ' actividades', 'ok'); App.render();
    } }] });
}

/* ─────────────── 04 · AIU e impuestos ─────────────── */
Vistas['04'] = function(){
  const b = Oferta.borrador(), pl = Oferta.pl();
  const k = Borrador.calculo(b, pl), t = k.totales;
  const iva = pl.proceso.iva || {};
  const dg = b.desglose || [];
  const totalDg = Borrador.totalDesglose(b), cuadra = Borrador.cuadraDesglose(b, t);
  const eco = Borrador.respuestasEconomicas(b, pl, k);
  const ecoReqs = (pl.requisitos||[]).filter(r => r.grupo === 'Económico');
  const personal = dg.find(d => d.personal);
  const html = cabecera('04', 'AIU e impuestos', 'Costo directo ' + money(t.costoDirecto)) +
    '<div class="grid g2"><div class="card"><div class="card-head"><h3>Administración, imprevistos y utilidad</h3></div><div class="card-body">' +
      '<div class="form">' + [['a','Administración (%)'], ['i','Imprevistos (%)'], ['u','Utilidad (%)']].map(([c, n]) => '<div class="field"><label for="aiu_' + c + '">' + n + '</label><input id="aiu_' + c + '" type="number" step="any" min="0" data-cambio="aiu" data-c="' + c + '" value="' + esc(b.aiu[c]) + '"></div>').join('') + '</div>' +
      '<div class="tw" style="margin-top:12px"><table class="t"><tbody>' +
        [['Costo directo', '', t.costoDirecto], ['Administración', Util.pct(t.pctA, 2), t.a], ['Imprevistos', Util.pct(t.pctI, 2), t.i], ['Utilidad', Util.pct(t.pctU, 2), t.u],
         ['IVA ' + Util.pct(t.tarifaIva, 0) + ' ' + ({ utilidad:'sobre la utilidad', total:'sobre el total', ninguno:'(no aplica)' })[t.modoIva], '', t.iva]].map(([n, p, v]) => '<tr><td>' + esc(n) + '</td><td class="n">' + p + '</td><td class="n">' + money(v) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>Valor total de la oferta</td><td></td><td class="n">' + money(t.total) + '</td></tr></tfoot></table></div>' +
      '<p class="small muted">El IVA lo fija el pliego según el tipo de contrato (' + esc(pl.proceso.tipoContrato || '') + '): tarifa ' + esc(iva.tarifa) + ' % ' + (iva.base === 'utilidad' ? 'sobre la utilidad' : iva.base === 'total' ? 'sobre el total' : '') + '.</p></div></div>' +
    '<div class="card"><div class="card-head"><h3>Respuestas económicas</h3></div><div class="card-body"><p class="small">El programa las responde con su presupuesto: no se escriben a mano.</p>' +
      (ecoReqs.length ? ecoReqs.map(r => '<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line-soft)"><span>' + esc(r.codigo) + ' · ' + esc(r.nombre) + '</span><b>' + esc(typeof eco[r.codigo] === 'number' ? money(eco[r.codigo]) : (eco[r.codigo] || '—')) + '</b></div>').join('') : '<p class="small muted">El pliego no trae requisitos económicos.</p>') +
    '</div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Desglose de la administración</h3>' + UI.tag((cuadra ? 'cuadra' : 'no cuadra') + ' · ' + money(totalDg) + ' de ' + money(t.a), cuadra ? 'ok' : 'bad') + '</div><div class="card-body">' +
      (personal ? '<h4 style="margin:0 0 6px">' + esc(personal.concepto) + '</h4><div class="tw"><table class="t"><thead><tr><th>Cargo</th><th class="n">Dedicación (%)</th><th class="n">Meses</th><th class="n">Valor mensual</th><th class="n">Valor</th><th></th></tr></thead><tbody>' +
        (personal.filas||[]).map((f, i) => '<tr><td><input class="ancho" data-cambio="dg-fila" data-i="' + i + '" data-c="cargo" value="' + esc(f.cargo || '') + '" aria-label="Cargo"></td>' +
          ['dedicacion','meses','mensual'].map(c => '<td class="n"><input class="num" type="number" step="any" data-cambio="dg-fila" data-i="' + i + '" data-c="' + c + '" value="' + esc(f[c] === undefined ? '' : f[c]) + '" aria-label="' + c + '"></td>').join('') +
          '<td class="n">' + money(Number(f.dedicacion||0) / 100 * Number(f.meses||0) * Number(f.mensual||0)) + '</td><td class="act">' + boton('dg-menos', '✕', 'xs', ' data-i="' + i + '" aria-label="Quitar cargo"') + '</td></tr>').join('') +
        '</tbody></table></div><div class="btn-row" style="margin:8px 0 14px">' + boton('dg-mas', '+ Cargo', 'sm') + '</div>' : '') +
      '<div class="tw"><table class="t"><thead><tr><th>Concepto</th><th class="n">Valor</th></tr></thead><tbody>' +
        dg.filter(d => !d.personal).map(d => '<tr><td>' + esc(d.concepto) + '</td><td class="n"><input class="num" type="number" step="any" data-cambio="dg-valor" data-id="' + d.id + '" value="' + esc(d.valor || '') + '" aria-label="' + esc(d.concepto) + '"></td></tr>').join('') +
      '</tbody><tfoot><tr><td>Total del desglose</td><td class="n">' + money(totalDg) + '</td></tr><tr><td>Administración (A)</td><td class="n">' + money(t.a) + '</td></tr></tfoot></table></div>' +
      '<p class="small muted">El desglose debe sumar el valor de la administración (se admite una diferencia de hasta 1.000 pesos o el 0,1 % de A).</p></div></div>';
  return { html, acciones:{
    'dg-mas':async () => { personal.filas = (personal.filas||[]).concat([{ cargo:'', dedicacion:100, meses:Math.max(1, Math.round(Number(pl.proceso.plazoMaximoDias||30) / 30)), mensual:0 }]); await Oferta.guardar(); App.render(); },
    'dg-menos':async el => { personal.filas.splice(+el.dataset.i, 1); await Oferta.guardar(); App.render(); }
  }, cambios:{
    'aiu':async el => { const v = Number(el.value || 0); if (!(v >= 0 && v < 100)) throw new Error('El porcentaje debe estar entre 0 y 100.'); b.aiu[el.dataset.c] = v; await Oferta.guardar(); App.render(); },
    'dg-fila':async el => { const f = personal.filas[+el.dataset.i]; f[el.dataset.c] = el.dataset.c === 'cargo' ? el.value.trim() : Number(el.value || 0); await Oferta.guardar(); if (el.dataset.c !== 'cargo') App.render(); },
    'dg-valor':async el => { const d = dg.find(x => x.id === el.dataset.id); d.valor = Number(el.value || 0); await Oferta.guardar(); App.render(); }
  } };
};
