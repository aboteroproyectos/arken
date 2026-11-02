/* ─────────────── 04 · Bancos y opciones ───────────────
   Opciones del cliente abierto en todos los bancos; matriz de qué ofrece cada
   banco; y las condiciones de cada banco por crédito, que el administrador
   mantiene al día (son la base de todos los conceptos). */
function fmtCondicion(k, v){
  if (v === '' || v === null || v === undefined) return '—';
  const u = (Bancos.ETIQUETAS[k] || [])[1] || '';
  if (u.indexOf('%') === 0) return Util.pct(v, k === 'tasaEA' || k === 'seguroMensualPct' ? 2 : 0) + (u.length > 1 ? u.slice(1) : '');
  return String(v).replace('.', ',') + ' ' + u;
}

Vistas['04'] = function(){
  const c = Modelo.activo();
  const tab = UI.pestanaActiva('bco', c ? 'opciones' : 'matriz');
  const B = Modelo.bancos();
  const ed = Permisos.puede('editarBancos');
  const viejos = B.filter(b => b.activo !== false && (!b.actualizado || Coherencia.diasEntre(b.actualizado, Util.hoyISO()) > 45));
  let cuerpo = '';
  if (tab === 'opciones'){
    if (!c) cuerpo = '<div class="card"><div class="card-body">' + UI.vacio('Abra un cliente', 'Las opciones se calculan para el cliente abierto.', boton('ir', 'Ir a Clientes', 'primary', ' data-m="01"')) + '</div></div>';
    else {
      const prodSel = Sesion.pestanas.bcoProd || '';
      const ops = Modelo.opciones(c, prodSel || null);
      const prods = Catalogo.productosPara(c.tipo);
      cuerpo = '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px"><span class="small muted">Crédito:</span>' +
        '<button type="button" class="chip' + (!prodSel ? ' on' : '') + '" data-accion="bco-prod" data-p="">' + esc(c.perfil.producto ? 'El solicitado · ' + Catalogo.producto(c.perfil.producto).corto : 'Todos los que aplican') + '</button>' +
        prods.filter(p => p.id !== c.perfil.producto).map(p => '<button type="button" class="chip' + (prodSel === p.id ? ' on' : '') + '" data-accion="bco-prod" data-p="' + p.id + '">' + esc(p.corto) + '</button>').join('') + '</div>' +
        (ops.length ? '<div class="opciones">' + ops.map((r, i) => {
          const cf = r.cifras || {}, d = Motor.dictamen(r.dictamen);
          const malos = r.criterios.filter(x => x.estado === 'bad'), obs = r.criterios.filter(x => x.estado === 'warn' || x.estado === 'falta');
          return '<div class="opcion ' + d.clase + (i === 0 ? ' mejor' : '') + '"><div class="op-head"><div><div class="eyebrow">' + (i === 0 ? 'Mejor opción · ' : '') + esc(r.productoNombre) + '</div><h4>' + esc(r.banco) + '</h4></div>' + tagDictamen(r.dictamen) + '</div>' +
            (r.dictamen === 'incompleto' ? '<p class="small">Falta: ' + esc(r.faltan.join(', ')) + '</p>' :
            '<div class="op-cifras"><div><span>Monto aprobable</span><b class="num">' + (cf.montoAprobable ? money(cf.montoAprobable) : '—') + '</b></div><div><span>Cuota estimada</span><b class="num">' + (cf.cuotaAprobable ? money(cf.cuotaAprobable) : '—') + '</b></div>' +
            '<div><span>Tasa de referencia</span><b class="num">' + (cf.tasaEA ? Util.pct(cf.tasaEA, 2) + ' E.A.' : '—') + '</b></div><div><span>Plazo</span><b class="num">' + (cf.plazoMeses ? cf.plazoMeses + ' meses' : cf.plazoAnios ? Math.round(cf.plazoAnios * 10) / 10 + ' años' : '—') + '</b></div></div>' +
            '<div class="small">' + (malos.length ? '<span class="bad-txt">No cumple: ' + esc(malos.map(x => x.nombre.toLowerCase()).join(', ')) + '.</span> ' : '') + (obs.length ? '<span class="muted">Observaciones: ' + esc(obs.map(x => x.nombre.toLowerCase()).join(', ')) + '.</span>' : '') + (!malos.length && !obs.length ? '<span class="ok-txt">Cumple todas las condiciones registradas.</span>' : '') + '</div>') +
            '<div class="op-pie"><span class="small muted">Puntaje ' + r.puntaje + '/100' + (r.notasBanco ? ' · ' + esc(r.notasBanco) : '') + '</span>' + boton('ver-concepto', 'Análisis y concepto', 'xs primary', ' data-id="' + c.id + '" data-banco="' + r.bancoId + '" data-producto="' + r.producto + '"') + '</div></div>';
        }).join('') + '</div>' : '<div class="card"><div class="card-body">' + UI.vacio('Ningún banco activo ofrece este crédito', 'Active bancos o revise sus condiciones en la pestaña Condiciones.') + '</div></div>');
    }
  } else if (tab === 'matriz'){
    const P = Catalogo.PRODUCTOS;
    cuerpo = '<div class="card"><div class="card-body flush"><div class="tw scroll"><table class="t matriz-b"><thead><tr><th>Banco</th>' + P.map(p => '<th class="small center">' + esc(p.corto) + '</th>').join('') + '<th>Actualizado</th></tr></thead><tbody>' +
      B.map(b => '<tr' + (b.activo === false ? ' class="inactivo"' : '') + '><td><b>' + esc(b.nombre) + '</b>' + (b.activo === false ? ' ' + UI.tag('inactivo') : '') + '</td>' +
        P.map(p => { const k = Bancos.condiciones(b, p.id); return '<td class="center small">' + (k.ofrece ? '<span class="ok-txt">✓</span><div class="num muted">' + Util.pct(k.tasaEA, 1) + '</div>' : '<span class="muted">—</span>') + '</td>'; }).join('') +
        '<td class="small">' + (b.actualizado ? Util.fmtFecha(b.actualizado) : '—') + (b.referencia ? '<div>' + UI.tag('referencia', 'warn') + '</div>' : '') + '</td></tr>').join('') +
      '</tbody></table></div></div></div><p class="small muted">✓ el banco ofrece el crédito; debajo, su tasa de referencia E.A. Las condiciones completas están en la pestaña Condiciones.</p>';
  } else {
    const bid = Sesion.pestanas.bcoSel && Modelo.banco(Sesion.pestanas.bcoSel) ? Sesion.pestanas.bcoSel : (B[0] || {}).id;
    const b = Modelo.banco(bid);
    cuerpo = '<div class="grid g1-3"><div class="card"><div class="card-head"><h3>Bancos</h3>' + (ed ? boton('nuevo-banco', '+ Banco', 'xs primary') : '') + '</div><div class="card-body flush"><div class="lista-b">' +
      B.map(x => '<button type="button" class="item-b' + (x.id === bid ? ' on' : '') + (x.activo === false ? ' inactivo' : '') + '" data-accion="bco-sel" data-id="' + x.id + '"><b>' + esc(x.nombre) + '</b><span class="small muted">' + Catalogo.PRODUCTOS.filter(p => Bancos.ofrece(x, p.id)).length + ' créditos' + (x.actualizado ? ' · ' + Util.fmtFecha(x.actualizado) : '') + '</span></button>').join('') +
      '</div></div></div>' + (b ? '<div><div class="card"><div class="card-head"><h3>' + esc(b.nombre) + '</h3><div class="btn-row" style="margin:0">' + (ed ? boton('editar-banco', 'Datos del banco', 'xs') + boton('marcar-actualizado', 'Marcar condiciones al día', 'xs') + boton('borrar-banco', 'Eliminar', 'xs ghost') : '') + '</div></div><div class="card-body">' +
        '<div class="kv-l"><span>Estado</span><b>' + (b.activo === false ? 'Inactivo (no se usa en los análisis)' : 'Activo') + '</b><span>Condiciones actualizadas</span><b>' + (b.actualizado ? Util.fmtFecha(b.actualizado) : 'Sin fecha') + '</b><span>Contacto</span><b>' + esc(b.contacto || '—') + '</b><span>Notas</span><b>' + esc(b.notas || '—') + '</b></div>' +
        (b.referencia ? '<div class="nota warn">Condiciones de referencia que trae el programa. Confírmelas con el banco y actualícelas: tasas y políticas cambian cada mes.</div>' : '') + '</div></div>' +
        Catalogo.PRODUCTOS.map(p => { const k = Bancos.condiciones(b, p.id);
          return '<div class="card cond' + (k.ofrece ? '' : ' apagado') + '"><div class="card-head"><h3>' + esc(p.nombre) + ' ' + (k.ofrece ? UI.tag('lo ofrece', 'ok') : UI.tag('no lo ofrece')) + '</h3>' + (ed ? boton('editar-condiciones', 'Editar', 'xs', ' data-p="' + p.id + '"') : '') + '</div>' +
            (k.ofrece ? '<div class="card-body"><div class="cond-g">' + Bancos.camposDe(p.id).map(f => '<div><span>' + esc((Bancos.ETIQUETAS[f] || [f])[0]) + '</span><b class="num">' + esc(fmtCondicion(f, k[f])) + '</b></div>').join('') + '</div>' + (k.notas ? '<p class="small" style="margin-top:6px">' + esc(k.notas) + '</p>' : '') + '</div>' : '') + '</div>'; }).join('') +
      '</div>' : '') + '</div>';
  }
  const html = cabecera('04', 'Bancos y opciones', c ? 'Opciones de ' + esc(c.nombre) + ' en cada banco, y las condiciones con que presta cada uno' : 'Qué ofrece cada banco y con qué condiciones') +
    (viejos.length ? '<div class="nota warn">' + viejos.length + ' banco(s) con condiciones de más de 45 días o sin fecha: ' + esc(viejos.slice(0, 4).map(b => b.nombre).join(', ')) + (viejos.length > 4 ? '…' : '') + '. Actualícelas antes de emitir conceptos.</div>' : '') +
    UI.pestanas('bco', [['opciones', 'Opciones del cliente'], ['matriz', 'Qué ofrece cada banco'], ['condiciones', 'Condiciones por banco']], c ? 'opciones' : 'matriz') + cuerpo;

  const bancoSel = () => Modelo.banco(Sesion.pestanas.bcoSel && Modelo.banco(Sesion.pestanas.bcoSel) ? Sesion.pestanas.bcoSel : (B[0] || {}).id);
  async function editarBanco(b){
    const x = b || { activo:true };
    const v = await UI.pedir({ titulo:b ? b.nombre : 'Nuevo banco', eyebrow:'Bancos', ancho:'', campos:[
      { k:'nombre', lab:'Nombre', val:x.nombre, c2:true }, { k:'contacto', lab:'Contacto (ejecutivo, teléfono, correo)', val:x.contacto, c2:true },
      { k:'notas', lab:'Notas', tipo:'textarea', val:x.notas, c2:true, filas:2 }, { k:'activo', lab:'Activo: se usa en los análisis', tipo:'check', val:x.activo !== false, c2:true }],
      validar:z => !z.nombre ? 'Escriba el nombre.' : '' });
    if (!v) return;
    const r = await Modelo.guardarBanco(Object.assign(Util.copia(x), v, b ? {} : { productos:{}, actualizado:Util.hoyISO(), referencia:false }));
    Sesion.pestanas.bcoSel = r.id; UI.toast('Banco guardado', 'ok'); App.render();
  }
  return { html, acciones:Object.assign({
    'bco-prod':b => { Sesion.pestanas.bcoProd = b.dataset.p; App.render(); },
    'bco-sel':b => { Sesion.pestanas.bcoSel = b.dataset.id; App.render(); },
    'nuevo-banco':() => editarBanco(null),
    'editar-banco':() => editarBanco(bancoSel()),
    'marcar-actualizado':async () => {
      const b = bancoSel();
      if (!(await UI.confirmar({ titulo:'Condiciones al día', mensaje:'¿Confirmó con ' + b.nombre + ' que las condiciones registradas son las vigentes? Se guardará la fecha de hoy y dejarán de ser de referencia.', textoAceptar:'Sí, están al día' }))) return;
      await Modelo.guardarBanco(Object.assign(Util.copia(b), { actualizado:Util.hoyISO(), referencia:false })); UI.toast('Condiciones marcadas al día', 'ok'); App.render();
    },
    'borrar-banco':async () => {
      const b = bancoSel();
      if (!(await UI.confirmar({ titulo:'Eliminar banco', mensaje:'Se elimina ' + b.nombre + ' con sus condiciones. Los conceptos ya emitidos no cambian. Si solo quiere dejar de usarlo, márquelo inactivo.', textoAceptar:'Eliminar', claseAceptar:'danger', palabra:'ELIMINAR' }))) return;
      await Modelo.borrarBanco(b.id); Sesion.pestanas.bcoSel = ''; UI.toast('Banco eliminado', 'ok'); App.render();
    },
    'editar-condiciones':async el => {
      const b = bancoSel(), p = el.dataset.p, k = Bancos.condiciones(b, p), prod = Catalogo.producto(p);
      const campos = [{ k:'ofrece', lab:'El banco ofrece este crédito', tipo:'check', val:k.ofrece, c2:true }]
        .concat(Bancos.camposDe(p).map(f => ({ k:f, lab:(Bancos.ETIQUETAS[f] || [f])[0] + ' (' + ((Bancos.ETIQUETAS[f] || [])[1] || '') + ')', tipo:'number', val:k[f] })))
        .concat([{ k:'notas', lab:'Notas y requisitos propios del banco (salen en el concepto)', tipo:'textarea', val:k.notas, c2:true, filas:2 }]);
      const v = await UI.pedir({ titulo:prod.nombre, eyebrow:b.nombre, campos, textoAceptar:'Guardar condiciones',
        antes:'<p class="small">Escriba las condiciones vigentes del banco. Los porcentajes van sin el signo (12,5 = 12,5 %).</p>',
        validar:z => Bancos.camposDe(p).some(f => z[f] === '' || !(Number(z[f]) >= 0)) ? 'Complete todas las condiciones con números positivos.' : '' });
      if (!v) return;
      const r = Util.copia(b); r.productos = r.productos || {};
      r.productos[p] = Object.assign({}, k, v); r.actualizado = Util.hoyISO(); r.referencia = false;
      await Modelo.guardarBanco(r); UI.toast('Condiciones guardadas', 'ok'); App.render();
    }
  }, AccionesComunes) };
};

/* ─────────────── 05 · Análisis y concepto ─────────────── */
Vistas['05'] = function(){
  const c = Modelo.activo();
  if (!c) return { html:sinCliente('05', 'Análisis y concepto'), acciones:AccionesComunes };
  const ops = Modelo.opciones(c);
  const sel = Sesion.analisis && Sesion.analisis.bancoId ? Modelo.evaluar(c, Sesion.analisis.bancoId, Sesion.analisis.producto || c.perfil.producto) : null;
  if (sel && sel.dictamen !== 'no_ofrece' && !ops.some(o => o.bancoId === sel.bancoId && o.producto === sel.producto)) ops.push(sel);
  const r = sel && sel.dictamen !== 'no_ofrece' ? sel : ops[0] || null;
  const hist = Modelo.conceptos(c.id);
  if (!r){
    return { html:cabecera('05', 'Análisis y concepto', esc(c.nombre)) + '<div class="card"><div class="card-body">' + UI.vacio('Sin opciones para analizar', 'Elija el crédito en la ficha del cliente y verifique que algún banco activo lo ofrezca.', boton('ir', 'Ficha del cliente', 'primary', ' data-m="02"')) + '</div></div>', acciones:AccionesComunes };
  }
  const secc = Concepto.redactar(c, r, S.parametros, S.empresa);
  const cf = r.cifras || {}, d = Motor.dictamen(r.dictamen);
  const selector = '<div class="field" style="max-width:520px"><label for="anSel">Banco y crédito analizados</label><select id="anSel">' +
    ops.map(o => '<option value="' + o.bancoId + '|' + o.producto + '"' + (o.bancoId === r.bancoId && o.producto === r.producto ? ' selected' : '') + '>' + esc(o.banco + ' · ' + o.productoNombre + ' — ' + Motor.dictamen(o.dictamen).n) + '</option>').join('') + '</select></div>';
  const cifra = (lab, v, sub) => '<div class="stat"><div class="lab">' + esc(lab) + '</div><div class="val num">' + v + '</div><div class="foot">' + (sub || '') + '</div></div>';
  const esNat = Catalogo.esNatural(c.tipo);
  const cifras = r.dictamen === 'incompleto' ? '' : '<div class="grid g4">' +
    cifra('Monto aprobable', cf.montoAprobable ? money(cf.montoAprobable) : '—', r.montoSolicitado ? 'Solicitado ' + money(r.montoSolicitado) : '') +
    cifra('Cuota estimada', cf.cuotaAprobable ? money(cf.cuotaAprobable) : cf.cuotaInteresMensual ? money(cf.cuotaInteresMensual) : '—', cf.cuotaAprobable ? 'mensual, con seguros' : cf.cuotaInteresMensual ? 'intereses mensuales' : '') +
    (esNat ? cifra('Cuota / ingreso', cf.ingresos && cf.cuotaAprobable ? Util.pct(cf.cuotaAprobable / cf.ingresos * 100, 1) : '—', 'máximo ' + Util.pct(cf.cuotaIngMax, 0)) : cifra('Cobertura', cf.dscr ? (Math.round(cf.dscr * 100) / 100).toFixed(2) + ' veces' : cf.coberturaVentas ? (Math.round(cf.coberturaVentas * 100) / 100).toFixed(2) + ' veces' : '—', cf.dscr ? 'servicio de la deuda' : 'ventas / crédito')) +
    cifra('Tasa de referencia', cf.tasaEA ? Util.pct(cf.tasaEA, 2) + ' E.A.' : '—', cf.plazoMeses ? cf.plazoMeses + ' meses' : cf.plazoAnios ? Math.round(cf.plazoAnios * 10) / 10 + ' años' : '') + '</div>';
  const crit = r.criterios.length ? '<div class="card"><div class="card-head"><h3>Condiciones evaluadas</h3><span class="small muted">Puntaje ' + r.puntaje + ' de 100</span></div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th></th><th>Condición</th><th>Cliente</th><th>Exigido</th><th>Detalle</th></tr></thead><tbody>' +
    r.criterios.map(x => '<tr><td>' + icCrit(x.estado) + '</td><td><b>' + esc(x.nombre) + '</b>' + (x.duro && x.estado === 'bad' ? ' ' + UI.tag('determinante', 'bad') : '') + '</td><td class="num">' + esc(x.valor) + '</td><td class="num small">' + esc(x.limite) + '</td><td class="small">' + esc(x.detalle) + '</td></tr>').join('') +
    '</tbody></table></div></div></div>' : '';
  const texto = '<div class="card concepto"><div class="card-head"><h3>Concepto de viabilidad</h3>' + tagDictamen(r.dictamen) + '</div><div class="card-body">' +
    secc.map(s => '<h4 class="sub-t">' + esc(s.titulo) + '</h4>' + s.parrafos.map(p => '<p>' + esc(p) + '</p>').join('')).join('') + '</div></div>';
  const historial = '<div class="card"><div class="card-head"><h3>Conceptos emitidos</h3></div><div class="card-body flush">' + (hist.length ? '<div class="tw"><table class="t"><thead><tr><th>Número</th><th>Fecha</th><th>Banco y crédito</th><th>Dictamen</th><th>Emitió</th><th></th></tr></thead><tbody>' +
    hist.map(k => '<tr><td class="cod">' + esc(k.numero) + '</td><td class="small num">' + Util.fmtSello(k.fecha) + '</td><td class="small">' + esc(k.banco) + '<div class="muted">' + esc(k.productoNombre) + '</div></td><td>' + tagDictamen(k.dictamen, true) + '</td><td class="small">' + esc(k.nombreUsuario || k.usuario) + '</td><td class="act">' + boton('pdf-concepto', 'PDF', 'xs', ' data-id="' + k.id + '"') + '</td></tr>').join('') +
    '</tbody></table></div>' : UI.vacio('Aún no hay conceptos emitidos', 'Al emitir, el concepto queda guardado con su número, las cifras y el perfil de ese momento.')) + '</div></div>';
  const html = cabecera('05', 'Análisis y concepto', esc(c.nombre) + ' · ' + esc((Catalogo.tipoCliente(c.tipo) || {}).nombre || '') + etiquetaDemo(c),
      (Permisos.puede('emitirConcepto') && r.dictamen !== 'incompleto' ? boton('emitir-concepto', 'Emitir concepto', 'brass') : '') + boton('vista-pdf', 'Vista previa PDF') + boton('ir', 'Documentos', 'ghost', ' data-m="03"')) +
    selector + (r.referencia ? '<div class="nota warn">Las condiciones de ' + esc(r.banco) + ' son de referencia: confírmelas con el banco antes de presentar el concepto.</div>' : '') +
    '<div class="dict-banda ' + d.clase + '"><div><div class="eyebrow">Dictamen</div><b>' + esc(d.n) + '</b></div><div class="small">' + esc(Concepto.resumen(r)) + '</div></div>' +
    cifras + '<div class="grid g2-1"><div>' + texto + '</div><div>' + crit + '</div></div>' + historial;
  return { html, acciones:Object.assign({
    'emitir-concepto':async () => {
      if (!(await UI.confirmar({ titulo:'Emitir concepto', mensaje:'Se guarda el concepto «' + d.n + '» de ' + r.banco + ' con un número consecutivo, las cifras y el perfil de hoy, y se descarga su PDF.', textoAceptar:'Emitir' }))) return;
      const k = await Modelo.emitirConcepto(c, r, secc);
      if (c.estado === 'prospecto') await Modelo.guardarCliente(Object.assign({}, c, { estado:'en_estudio' }));
      Informes.pdfConcepto(k); UI.toast('Concepto ' + k.numero + ' emitido', 'ok'); App.render();
    },
    'vista-pdf':() => Informes.pdfConcepto({ numero:'BORRADOR', fecha:new Date().toISOString(), cliente:c.nombre, clienteId:c.id, banco:r.banco, productoNombre:r.productoNombre, producto:r.producto,
      dictamen:r.dictamen, puntaje:r.puntaje, cifras:r.cifras, criterios:r.criterios, secciones:secc, perfil:c.perfil, nombreUsuario:Sesion.usuario.nombre || Sesion.usuario.usuario, demo:!!c.demo, borrador:true }),
    'pdf-concepto':b => Informes.pdfConcepto((S.conceptos || []).find(k => k.id === b.dataset.id))
  }, AccionesComunes),
  alPintar(){
    const s = $('#anSel'); if (s) s.onchange = () => { const [bancoId, producto] = s.value.split('|'); Sesion.analisis = { bancoId, producto }; App.render(); };
  } };
};

/* ─────────────── Informes: concepto en PDF, cartera en PDF y CSV ─────────────── */
const Informes = (function(){
  function nombreArchivo(base){ return base.replace(/[^\wÁÉÍÓÚÑáéíóúñ .-]+/g, '').replace(/\s+/g, '_').slice(0, 80); }
  function pdfConcepto(k){
    if (!k) return;
    const c = Modelo.cliente(k.clienteId) || { nombre:k.cliente, tipo:'', documento:'' };
    const cf = k.cifras || {}, d = Motor.dictamen(k.dictamen);
    const bloques = [
      { t:'texto', txt:'CONCEPTO DE VIABILIDAD DE CRÉDITO · ' + k.numero, negrita:true, tam:11 },
      { t:'kv', pares:[['Cliente', k.cliente], ['Documento', c.documento || ''], ['Tipo de cliente', (Catalogo.tipoCliente(c.tipo) || {}).nombre || ''], ['Banco', k.banco],
        ['Crédito', k.productoNombre], ['Fecha', Util.fmtSello(k.fecha)], ['Dictamen', d.n.toUpperCase()], ['Puntaje', k.puntaje + ' de 100'],
        ['Monto solicitado', (k.perfil || {}).montoSolicitado ? money(k.perfil.montoSolicitado) : ''], ['Monto aprobable', cf.montoAprobable ? money(cf.montoAprobable) : ''],
        ['Cuota estimada', cf.cuotaAprobable ? money(cf.cuotaAprobable) : ''], ['Tasa de referencia', cf.tasaEA ? Util.pct(cf.tasaEA, 2) + ' E.A.' : '']] }
    ];
    (k.secciones || []).forEach(s => { bloques.push({ t:'sec', txt:s.titulo }); s.parrafos.forEach(p => bloques.push({ t:'texto', txt:p })); });
    if ((k.criterios || []).length){
      bloques.push({ t:'sec', txt:'Detalle de las condiciones evaluadas' });
      const E = { ok:'Cumple', warn:'Observación', bad:'No cumple', falta:'Por confirmar', info:'Informativo' };
      bloques.push({ t:'tabla', cabeza:['Condición', 'Estado', 'Cliente', 'Exigido', 'Detalle'], anchos:[30, 16, 22, 22, 50], letraChica:true,
        filas:k.criterios.map(x => ({ celdas:[x.nombre, E[x.estado] || x.estado, String(x.valor), String(x.limite), x.detalle] })) });
    }
    bloques.push({ t:'texto', txt:'\nElaboró: ' + (k.nombreUsuario || k.usuario || ''), gris:true });
    const r = Pdf.generar({ nombre:'Concepto', titulo:'Concepto de viabilidad', documento:k.numero, bloques, marcaAgua:k.demo ? 'DEMOSTRACIÓN' : k.borrador ? 'BORRADOR' : '' });
    UI.descargar(nombreArchivo('Concepto ' + k.numero + ' ' + k.cliente + ' ' + k.banco) + '.pdf', r.blob);
  }
  const csvCelda = v => { const s = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function excelClientes(E){
    Permisos.exigir('exportar');
    const cab = ['Cliente', 'Documento', 'Tipo', 'Ciudad', 'Estado', 'Crédito solicitado', 'Monto solicitado', 'Ingreso mensual', 'Documentos obligatorios', 'Cargados', 'Vencidos', 'Alertas', 'Mejor banco', 'Dictamen', 'Monto aprobable', 'Cuota estimada', 'Tasa E.A.'];
    const filas = E.map(x => { const c = x.c, p = c.perfil || {}, r = x.mejor, cf = (r && r.cifras) || {};
      return [c.nombre, c.documento, (Catalogo.tipoCliente(c.tipo) || {}).nombre, c.ciudad, Modelo.estado(c.estado).n, (Catalogo.producto(p.producto) || {}).nombre || '', p.montoSolicitado || '',
        Math.round(Filtros.ingresoDe(c)), x.docs.requeridos, x.docs.cargados, x.docs.vencidos.length, x.alertas.length, r ? r.banco : '', r ? Motor.dictamen(r.dictamen).n : '',
        cf.montoAprobable || '', cf.cuotaAprobable ? Math.round(cf.cuotaAprobable) : '', cf.tasaEA ? String(cf.tasaEA).replace('.', ',') : '']; });
    const csv = '﻿' + [cab].concat(filas).map(f => f.map(csvCelda).join(';')).join('\r\n');
    UI.descargar('ARKEN_BANK_clientes_' + Util.selloArchivo(Date.now()) + '.csv', csv, 'text/csv;charset=utf-8');
  }
  function pdfCartera(E, f){
    Permisos.exigir('exportar');
    const filtros = Object.keys(f).filter(k => f[k] !== '' && f[k] !== undefined).map(k => k + ': ' + f[k]).join(' · ');
    const bloques = [{ t:'texto', txt:'INFORME DE CARTERA · ' + E.length + ' cliente(s)', negrita:true, tam:11 }, { t:'texto', txt:filtros ? 'Filtros: ' + filtros : 'Sin filtros: todos los clientes.', gris:true },
      { t:'tabla', cabeza:['Cliente', 'Tipo', 'Crédito', 'Monto', 'Estado', 'Docs', 'Mejor opción', 'Monto aprobable', 'Cuota'], anchos:[34, 16, 22, 20, 16, 12, 34, 20, 18], letraChica:true,
        filas:E.map(x => { const c = x.c, p = c.perfil || {}, r = x.mejor, cf = (r && r.cifras) || {};
          return { celdas:[c.nombre + (c.demo ? ' (demo)' : ''), (Catalogo.tipoCliente(c.tipo) || {}).corto || '', (Catalogo.producto(p.producto) || {}).corto || '—', p.montoSolicitado ? money(p.montoSolicitado) : '',
            Modelo.estado(c.estado).n, x.docs.cargados + '/' + x.docs.requeridos, r ? r.banco + ': ' + Motor.dictamen(r.dictamen).n : '—', cf.montoAprobable ? money(cf.montoAprobable) : '', cf.cuotaAprobable ? money(cf.cuotaAprobable) : ''] }; }) }];
    const r = Pdf.generar({ nombre:'Cartera', titulo:'Informe de cartera', documento:'Cartera', orientacion:'l', bloques });
    UI.descargar('ARKEN_BANK_cartera_' + Util.selloArchivo(Date.now()) + '.pdf', r.blob);
  }
  function csvAuditoria(){
    const cab = ['Fecha', 'Usuario', 'Acción', 'Objeto', 'Detalle', 'Cliente'];
    const filas = Auditoria.lista().map(a => [Util.fmtSello(a.fecha), a.usuario, a.accion, a.objeto, a.detalle, (Modelo.cliente(a.clienteId) || {}).nombre || '']);
    UI.descargar('ARKEN_BANK_auditoria_' + Util.selloArchivo(Date.now()) + '.csv', '﻿' + [cab].concat(filas).map(f => f.map(csvCelda).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
  }
  return { pdfConcepto, excelClientes, pdfCartera, csvAuditoria };
})();
