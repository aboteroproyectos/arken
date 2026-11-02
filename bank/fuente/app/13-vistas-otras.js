/* ─────────────── 06 · Tipos de crédito ───────────────
   El catálogo: según el tipo de cliente, qué créditos puede pedir y qué
   documentos necesita para cada uno. Sirve para orientar al cliente antes
   de crearlo y para imprimir su lista de documentos. */
Vistas['06'] = function(){
  const c = Modelo.activo();
  const tipo = Sesion.pestanas.tcTipo || (c && c.tipo) || 'asalariado';
  const prods = Catalogo.productosPara(tipo);
  const pid = Sesion.pestanas.tcProd && prods.some(p => p.id === Sesion.pestanas.tcProd) ? Sesion.pestanas.tcProd : (c && c.tipo === tipo && c.perfil.producto) || (prods[0] || {}).id;
  const p = Catalogo.producto(pid);
  const tc = Catalogo.tipoCliente(tipo);
  const docs = p ? Catalogo.documentosRequeridos(tipo, pid) : [];
  const grupos = [];
  docs.forEach(x => { let g = grupos.find(y => y.n === x.doc.grupo); if (!g){ g = { n:x.doc.grupo, L:[] }; grupos.push(g); } g.L.push(x); });
  const bancos = Modelo.bancos().filter(b => Bancos.ofrece(b, pid));
  const html = cabecera('06', 'Tipos de crédito', 'Qué créditos puede pedir cada tipo de cliente y qué documentos necesita', p ? boton('pdf-requisitos', 'Lista de documentos en PDF') : '') +
    '<div class="chips" style="margin-bottom:6px">' + Catalogo.TIPOS_CLIENTE.map(t => '<button type="button" class="chip' + (t.id === tipo ? ' on' : '') + '" data-accion="tc-tipo" data-t="' + t.id + '">' + esc(t.corto) + '</button>').join('') + '</div>' +
    '<p class="small muted" style="margin:0 0 12px">' + esc(tc.desc) + '</p>' +
    '<div class="grid g1-3"><div class="card"><div class="card-head"><h3>Créditos para ' + esc(tc.corto.toLowerCase()) + '</h3></div><div class="card-body flush"><div class="lista-b">' +
      prods.map(x => '<button type="button" class="item-b' + (x.id === pid ? ' on' : '') + '" data-accion="tc-prod" data-p="' + x.id + '"><b>' + esc(x.nombre) + '</b><span class="small muted">' + Modelo.bancos().filter(b => Bancos.ofrece(b, x.id)).length + ' banco(s)</span></button>').join('') +
    '</div></div></div><div>' + (p ? '<div class="card"><div class="card-head"><h3>' + esc(p.nombre) + '</h3>' + UI.tag(p.clase === 'vivienda' ? 'Vivienda · Ley 546' : p.clase, p.clase === 'vivienda' ? 'brass' : 'info') + '</div><div class="card-body">' +
      '<p>' + esc(p.desc) + '</p><ul class="claves">' + p.claves.map(k => '<li>' + esc(k) + '</li>').join('') + '</ul>' +
      '<div class="small muted" style="margin-top:8px">Lo ofrecen: ' + (bancos.length ? esc(bancos.map(b => b.nombre).join(', ')) : 'ningún banco activo') + '.</div></div></div>' +
      '<div class="card"><div class="card-head"><h3>Documentos necesarios (' + docs.filter(x => x.obligatorio).length + ' obligatorios)</h3></div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Documento</th><th>Vigencia</th><th>El programa lee</th></tr></thead><tbody>' +
        grupos.map(g => '<tr class="grupo"><td colspan="3">' + esc(g.n) + '</td></tr>' + g.L.map(x => '<tr><td><b>' + esc(x.doc.nombre) + '</b> ' + (x.obligatorio ? '' : UI.tag('según el caso', 'info')) + '<div class="small muted">' + esc(x.doc.desc || '') + (x.doc.cuando ? ' ' + esc(x.doc.cuando) : '') + '</div></td>' +
          '<td class="small">' + (x.doc.vigencia ? x.doc.vigencia + ' días' : 'No vence') + '</td><td class="small">' + esc(x.doc.lee.filter(k => k !== 'fecha_expedicion').map(k => ((Lector.CAMPOS.find(z => z.k === k) || {}).nombre || k).toLowerCase()).join(', ') || '—') + '</td></tr>').join('')).join('') +
      '</tbody></table></div></div></div>' : '') + '</div></div>';
  return { html, acciones:Object.assign({
    'tc-tipo':b => { Sesion.pestanas.tcTipo = b.dataset.t; Sesion.pestanas.tcProd = ''; App.render(); },
    'tc-prod':b => { Sesion.pestanas.tcProd = b.dataset.p; App.render(); },
    'pdf-requisitos':() => {
      const bl = [{ t:'texto', txt:p.nombre.toUpperCase() + ' · ' + tc.nombre, negrita:true, tam:11 }, { t:'texto', txt:p.desc }, { t:'lista', items:p.claves }];
      grupos.forEach(g => { bl.push({ t:'sec', txt:g.n }); bl.push({ t:'tabla', cabeza:['Documento', 'Detalle', 'Vigencia'], anchos:[40, 60, 14], letraChica:true,
        filas:g.L.map(x => ({ celdas:[x.doc.nombre + (x.obligatorio ? '' : ' (según el caso)'), (x.doc.desc || '') + (x.doc.cuando ? ' ' + x.doc.cuando : ''), x.doc.vigencia ? x.doc.vigencia + ' días' : 'No vence'] })) }); });
      bl.push({ t:'texto', txt:'Cada banco puede pedir documentos adicionales según su política y el resultado del estudio.', gris:true });
      const r = Pdf.generar({ titulo:'Documentos para el crédito', documento:'Requisitos', bloques:bl });
      UI.descargar('Documentos_' + p.corto.replace(/\s+/g, '_') + '_' + tc.corto + '.pdf', r.blob);
    }
  }, AccionesComunes) };
};

/* ─────────────── 07 · Simulador ─────────────── */
Vistas['07'] = function(){
  const c = Modelo.activo(), pf = (c && c.perfil) || {};
  const s = Object.assign({ monto:pf.montoSolicitado || 200000000, tasa:12.5, anios:pf.plazoAnios || 20, seguro:0.06, ingreso:c && Catalogo.esNatural(c.tipo) ? Filtros.ingresoDe(c) : '', valor:pf.valorInmueble || '' }, Sesion.simulador || {});
  const meses = Math.round(Number(s.anios) * 12);
  const ok = Number(s.monto) > 0 && Number(s.anios) > 0 && Number(s.tasa) >= 0;
  const A = ok ? Motor.amortizacion(Number(s.monto), Number(s.tasa), meses, Number(s.seguro)) : null;
  const P = S.parametros;
  const campos = [
    { k:'monto', lab:'Monto del crédito', tipo:'number', val:s.monto }, { k:'tasa', lab:'Tasa efectiva anual (%)', tipo:'number', val:s.tasa },
    { k:'anios', lab:'Plazo (años)', tipo:'number', val:s.anios }, { k:'seguro', lab:'Seguros (% mensual del saldo)', tipo:'number', val:s.seguro },
    { k:'ingreso', lab:'Ingreso familiar mensual (opcional)', tipo:'number', val:s.ingreso }, { k:'valor', lab:'Valor del inmueble (opcional)', tipo:'number', val:s.valor }
  ];
  let res = '';
  if (A){
    const c1 = A.filas[0].cuota, ci = Number(s.ingreso) > 0 ? c1 / Number(s.ingreso) * 100 : null;
    const fin = Number(s.valor) > 0 ? Number(s.monto) / Number(s.valor) * 100 : null;
    const vis = Number(s.valor) > 0 && Number(s.valor) <= P.topeVISsmmlv * P.smmlv;
    const finMax = vis ? P.finVISLey546 : P.finNoVISLey546;
    const anual = [];
    for (let y = 0; y < Math.ceil(meses / 12); y++){
      const F = A.filas.slice(y * 12, y * 12 + 12);
      anual.push({ y:y + 1, cuota:F.reduce((t, f) => t + f.cuota, 0), interes:F.reduce((t, f) => t + f.interes, 0), abono:F.reduce((t, f) => t + f.abono, 0), seguro:F.reduce((t, f) => t + f.seguro, 0), saldo:F[F.length - 1].saldo });
    }
    res = '<div class="grid g4">' +
      '<div class="stat accent"><div class="lab">Primera cuota</div><div class="val num">' + money(c1) + '</div><div class="foot">' + money(A.cuotaFinanciera) + ' + seguros</div></div>' +
      '<div class="stat"><div class="lab">Tasa mensual</div><div class="val num">' + Util.pct(Motor.tasaMensual(s.tasa) * 100, 3) + '</div><div class="foot">equivalente a ' + Util.pct(s.tasa, 2) + ' E.A.</div></div>' +
      '<div class="stat"><div class="lab">Total de intereses</div><div class="val num">' + money(A.totalIntereses) + '</div><div class="foot">en ' + meses + ' meses</div></div>' +
      '<div class="stat"><div class="lab">Total pagado</div><div class="val num">' + money(A.filas.reduce((t, f) => t + f.cuota, 0)) + '</div><div class="foot">capital, intereses y seguros</div></div></div>' +
      '<div class="card"><div class="card-head"><h3>Frente a la Ley 546 de 1999 (vivienda)</h3></div><div class="card-body">' +
        '<div class="crit-l">' + (ci === null ? '<div>' + icCrit('falta') + ' Escriba el ingreso familiar para medir la relación cuota/ingreso.</div>' :
          '<div>' + icCrit(ci <= P.cuotaIngresoLey546 ? 'ok' : 'bad') + ' Primera cuota / ingreso: <b class="num">' + Util.pct(ci, 1) + '</b> (máximo ' + P.cuotaIngresoLey546 + ' %)' +
            (ci > P.cuotaIngresoLey546 ? ' · ingreso necesario: <b class="num">' + money(c1 / P.cuotaIngresoLey546 * 100) + '</b>' : '') + '</div>') +
        (fin === null ? '<div>' + icCrit('falta') + ' Escriba el valor del inmueble para medir la financiación.</div>' :
          '<div>' + icCrit(fin <= finMax ? 'ok' : 'bad') + ' Financiación: <b class="num">' + Util.pct(fin, 1) + '</b> del inmueble (máximo ' + finMax + ' % ' + (vis ? 'VIS' : 'No VIS') + ') · cuota inicial: <b class="num">' + money(Number(s.valor) - Number(s.monto)) + '</b></div>') +
        '<div>' + icCrit(Number(s.anios) >= P.plazoMinVivienda && Number(s.anios) <= P.plazoMaxVivienda ? 'ok' : 'bad') + ' Plazo: ' + s.anios + ' años (entre ' + P.plazoMinVivienda + ' y ' + P.plazoMaxVivienda + ')</div></div>' +
        '<p class="small muted" style="margin-top:6px">Tope VIS: ' + P.topeVISsmmlv + ' SMMLV = ' + money(P.topeVISsmmlv * P.smmlv) + ' (SMMLV ' + P.anioSmmlv + ': ' + money(P.smmlv) + ').</p></div></div>' +
      '<div class="card"><div class="card-head"><h3>Amortización por año</h3>' + boton('sim-pdf', 'Tabla en PDF', 'xs') + '</div><div class="card-body flush"><div class="tw scroll" style="max-height:420px"><table class="t"><thead><tr><th>Año</th><th class="n">Cuotas</th><th class="n">Intereses</th><th class="n">Abono a capital</th><th class="n">Seguros</th><th class="n">Saldo</th></tr></thead><tbody>' +
        anual.map(a => '<tr><td>' + a.y + '</td><td class="n">' + money(a.cuota) + '</td><td class="n">' + money(a.interes) + '</td><td class="n">' + money(a.abono) + '</td><td class="n">' + money(a.seguro) + '</td><td class="n">' + money(a.saldo) + '</td></tr>').join('') +
      '</tbody></table></div></div></div><p class="small muted">Sistema de cuota fija (francés) en pesos. Los seguros se calculan sobre el saldo, por eso la cuota total baja con el tiempo. Es una simulación: la cuota definitiva la fija el banco.</p>';
  }
  const html = cabecera('07', 'Simulador', 'Cuota, intereses y tabla de amortización' + (c ? ' · datos de ' + esc(c.nombre) : ''), c ? boton('sim-cliente', 'Usar los datos del cliente', 'ghost') : '') +
    '<div class="card"><div class="card-body"><div class="form f3">' + campos.map(x => UI.campo(x, 'sm')).join('') + '</div>' +
    '<div class="btn-row">' + boton('simular', 'Calcular', 'primary') + '<span class="small muted">Tasas de referencia: ' + Catalogo.PRODUCTOS.filter(p => Bancos.BASE[p.id]).slice(0, 3).map(p => p.corto + ' ' + Util.pct(Bancos.BASE[p.id].tasaEA, 1)).join(' · ') + '</span></div></div></div>' + res;
  const leer = () => UI.leer(campos, document, 'sm');
  return { html, acciones:Object.assign({
    'simular':() => { Sesion.simulador = leer(); App.render(); },
    'sim-cliente':() => { Sesion.simulador = null; App.render(); },
    'sim-pdf':() => {
      const bl = [{ t:'texto', txt:'SIMULACIÓN DE CRÉDITO', negrita:true, tam:11 }, { t:'kv', pares:[['Monto', money(s.monto)], ['Tasa', Util.pct(s.tasa, 2) + ' E.A.'], ['Plazo', s.anios + ' años (' + meses + ' meses)'],
        ['Seguros', Util.pct(s.seguro, 3) + ' mensual'], ['Primera cuota', money(A.filas[0].cuota)], ['Total intereses', money(A.totalIntereses)]] },
        { t:'tabla', cabeza:['Mes', 'Cuota', 'Intereses', 'Abono a capital', 'Seguros', 'Saldo'], anchos:[8, 18, 18, 18, 14, 22], letraChica:true, alinear:{ 1:'right', 2:'right', 3:'right', 4:'right', 5:'right' },
          filas:A.filas.map(f => ({ celdas:[String(f.n), money(f.cuota), money(f.interes), money(f.abono), money(f.seguro), money(f.saldo)] })) },
        { t:'texto', txt:'Simulación con cuota fija en pesos. No es una oferta: la cuota definitiva la fija el banco.', gris:true }];
      const r = Pdf.generar({ titulo:'Simulación de crédito', documento:'Simulación', bloques:bl });
      UI.descargar('Simulacion_credito_' + Util.selloArchivo(Date.now()) + '.pdf', r.blob);
    }
  }, AccionesComunes) };
};

/* ─────────────── Administración ─────────────── */
const NOMBRES_ACCION = { administrar:'Administrar usuarios y respaldos', editarEmpresa:'Editar los datos de la empresa', editarParametros:'Editar parámetros (SMMLV, topes)',
  editarBancos:'Editar bancos y sus condiciones', crearCliente:'Crear clientes', editarCliente:'Editar la ficha del cliente', borrarCliente:'Eliminar clientes',
  cargarDocumentos:'Cargar documentos', leerDocumentos:'Leer documentos', analizar:'Analizar la viabilidad', emitirConcepto:'Emitir conceptos',
  demostracion:'Cargar y borrar la demostración', exportar:'Ver y exportar informes', respaldar:'Descargar respaldos' };
Vistas['admin'] = function(){
  const tab = UI.pestanaActiva('adm', 'usuarios');
  const ed = Permisos.puede('administrar');
  let cuerpo;
  if (tab === 'auditoria'){
    const lista = Auditoria.lista();
    cuerpo = '<div class="card"><div class="card-head"><h3>' + lista.length + ' registro(s)</h3>' + boton('exportar-auditoria', 'Exportar a Excel (CSV)', 'sm') + '</div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Objeto</th><th>Detalle</th><th>Cliente</th></tr></thead><tbody>' +
      lista.slice(0, 500).map(a => '<tr><td class="small num">' + Util.fmtSello(a.fecha) + '</td><td>' + esc(a.usuario) + '</td><td>' + esc(a.accion) + '</td><td>' + esc(a.objeto) + '</td><td class="small">' + esc(a.detalle) + '</td><td class="small">' + esc((Modelo.cliente(a.clienteId) || {}).nombre || '') + '</td></tr>').join('') +
      '</tbody></table></div></div></div><p class="small muted">La auditoría solo agrega registros: no hay forma de editarlos ni de borrarlos.</p>';
  } else if (tab === 'respaldos'){
    cuerpo = '<div class="grid g2"><div class="card"><div class="card-head"><h3>Descargar respaldo</h3></div><div class="card-body"><p class="small">Un .zip con los clientes, documentos, conceptos, bancos, usuarios y auditoría de este equipo, los archivos por su huella y un manifiesto con las huellas SHA-256 de cada parte.</p>' +
      '<div class="btn-row">' + (Permisos.puede('respaldar') ? boton('descargar-respaldo', 'Descargar respaldo completo', 'primary') : '') + '</div></div></div>' +
      '<div class="card"><div class="card-head"><h3>Restaurar respaldo</h3></div><div class="card-body"><p class="small">Antes de restaurar, el programa muestra qué trae el respaldo y verifica cada huella. Nada se sobrescribe sin que usted escriba REEMPLAZAR.</p>' +
      '<div class="btn-row">' + (ed ? boton('restaurar-respaldo', 'Restaurar desde un .zip', 'danger') : '') + '</div></div></div></div>' +
      '<div class="nota info">Los clientes y sus documentos viven en este navegador. Descargue un respaldo con frecuencia y guárdelo fuera del equipo.</div>';
  } else if (tab === 'registro'){
    const e = RegistroTecnico.entradas().reverse();
    cuerpo = '<div class="card"><div class="card-head"><h3>Registro técnico de esta sesión</h3>' + boton('bajar-registro', 'Descargar', 'sm') + '</div><div class="card-body flush">' +
      (e.length ? '<div class="tw scroll"><table class="t"><thead><tr><th>Fecha</th><th>Dónde</th><th>Mensaje</th></tr></thead><tbody>' + e.slice(0, 200).map(x => '<tr><td class="small num">' + Util.fmtSello(x.fecha) + '</td><td>' + esc(x.contexto) + '</td><td class="small">' + esc(x.mensaje) + '</td></tr>').join('') + '</tbody></table></div>'
        : UI.vacio('Sin errores registrados', 'Si algo falla, el detalle técnico queda aquí para enviarlo a soporte.')) + '</div></div>';
  } else if (tab === 'demo'){
    cuerpo = '<div class="card"><div class="card-head"><h3>Demostración</h3></div><div class="card-body"><p>La demostración crea seis clientes ficticios (asalariada, independiente, pensionada, joven en VIS, empresa y constructora) y convierte en PDF sus documentos de ejemplo, que el lector lee como cualquier otro. Todo va rotulado DEMOSTRACIÓN.</p>' +
      '<div class="btn-row">' + (Permisos.puede('demostracion') ? boton('cargar-demo', 'Cargar demostración', 'primary') + (DemoApp.hayDemo() ? boton('borrar-demo', 'Borrar datos de demostración', 'danger') : '') : '') + '</div></div></div>';
  } else {
    cuerpo = '<div class="card"><div class="card-head"><h3>Usuarios</h3>' + (ed ? boton('nuevo-usuario', '+ Usuario', 'sm primary') : '') + '</div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Usuario</th><th>Nombre</th><th>Roles</th><th>Estado</th><th></th></tr></thead><tbody>' +
      (S.usuarios || []).map(u => '<tr' + (u.activo === false ? ' style="opacity:.5"' : '') + '><td class="cod">' + esc(u.usuario) + '</td><td>' + esc(u.nombre) + '<div class="small muted">' + esc(u.cargo || '') + '</div></td><td class="small">' +
        (u.roles || []).map(r => UI.tag(Roles.nombre(r), r === 'administrador' ? 'brass' : 'info')).join(' ') + '</td><td>' + (u.activo === false ? UI.tag('inactivo', 'bad') : UI.tag('activo', 'ok')) + (u.debeCambiar ? ' ' + UI.tag('debe cambiar la contraseña', 'warn') : '') +
        '</td><td class="act">' + (ed ? boton('editar-usuario', 'Editar', 'xs', ' data-id="' + u.id + '"') + ' ' + boton('clave-usuario', 'Restablecer contraseña', 'xs', ' data-id="' + u.id + '"') : '') + '</td></tr>').join('') +
      '</tbody></table></div></div></div>' +
      '<div class="card"><div class="card-head"><h3>Qué puede hacer cada rol</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Acción</th>' + Object.keys(Roles.LISTA).map(r => '<th class="small center">' + esc(Roles.nombre(r)) + '</th>').join('') + '</tr></thead><tbody>' +
        Object.keys(Roles.ACCIONES).map(a => '<tr><td class="small">' + esc(NOMBRES_ACCION[a] || a) + '</td>' + Object.keys(Roles.LISTA).map(r => '<td class="center">' + (Roles.ACCIONES[a].indexOf(r) >= 0 ? '✓' : '') + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div></div></div><p class="small muted">Los permisos se aplican en la lógica del programa, no solo en la pantalla.</p>';
  }
  async function editarUsuario(u){
    const x = u ? Util.copia(u) : { roles:[], activo:true };
    const campos = [{ k:'usuario', lab:'Usuario', val:x.usuario, deshabilitado:!!u }, { k:'nombre', lab:'Nombre completo', val:x.nombre },
      { k:'cargo', lab:'Cargo', val:x.cargo }, { k:'correo', lab:'Correo', tipo:'email', val:x.correo }]
      .concat(Object.keys(Roles.LISTA).map(r => ({ k:'rol_' + r, lab:Roles.nombre(r), tipo:'check', val:(x.roles || []).indexOf(r) >= 0 })))
      .concat([{ k:'activo', lab:'Usuario activo', tipo:'check', val:x.activo !== false, c2:true }])
      .concat(u ? [] : [{ k:'clave', lab:'Contraseña inicial (la cambiará al ingresar)', tipo:'password', c2:true }]);
    const v = await UI.pedir({ titulo:u ? 'Usuario ' + u.usuario : 'Nuevo usuario', eyebrow:'Administración', campos });
    if (!v) return;
    const datos = Object.assign(x, { usuario:u ? u.usuario : v.usuario, nombre:v.nombre, cargo:v.cargo, correo:v.correo, activo:v.activo, roles:Object.keys(Roles.LISTA).filter(r => v['rol_' + r]) });
    if (!u && String(v.clave || '').length < 8) throw new Error('La contraseña inicial debe tener al menos 8 caracteres.');
    await Usuarios.guardar(datos, u ? null : v.clave);
    UI.toast('Usuario guardado', 'ok'); App.render();
  }
  return { html:cabecera('', 'Administración', 'Usuarios, roles, auditoría y respaldos') +
      UI.pestanas('adm', [['usuarios', 'Usuarios y roles'], ['auditoria', 'Auditoría'], ['respaldos', 'Respaldos'], ['registro', 'Registro técnico'], ['demo', 'Demostración']], 'usuarios') + cuerpo,
    acciones:Object.assign({
      'nuevo-usuario':() => editarUsuario(null),
      'editar-usuario':b => editarUsuario((S.usuarios || []).find(u => u.id === b.dataset.id)),
      'clave-usuario':async b => {
        const u = (S.usuarios || []).find(x => x.id === b.dataset.id);
        const v = await UI.pedir({ titulo:'Restablecer contraseña · ' + u.usuario, ancho:'', campos:[{ k:'clave', lab:'Contraseña temporal (8 caracteres o más)', tipo:'password', c2:true }],
          validar:z => String(z.clave || '').length < 8 ? 'Mínimo 8 caracteres.' : '' });
        if (!v) return;
        await Usuarios.guardar(Util.copia(u), v.clave);
        UI.toast('Contraseña restablecida: ' + u.usuario + ' deberá cambiarla al ingresar', 'ok'); App.render();
      },
      'exportar-auditoria':() => Informes.csvAuditoria(),
      'descargar-respaldo':async () => { Permisos.exigir('respaldar'); UI.toast('Preparando el respaldo…'); const r = await Respaldo.generar(); UI.descargar(r.nombre, r.blob); UI.toast('Respaldo descargado', 'ok'); },
      'restaurar-respaldo':async () => { Permisos.exigir('administrar'); const [f] = await UI.elegirArchivos('.zip'); if (f) await Respaldo.restaurar(f, () => App.recargar()); },
      'bajar-registro':() => UI.descargar('ARKEN_BANK_registro_tecnico_' + Util.selloArchivo(Date.now(), true) + '.json', JSON.stringify(RegistroTecnico.entradas(), null, 2), 'application/json'),
      'borrar-demo':() => DemoApp.borrar()
    }, AccionesComunes) };
};

/* ─────────────── Configuración ─────────────── */
const CAMPOS_EMPRESA = (e) => [
  { k:'razonSocial', lab:'Razón social', val:e.razonSocial, c2:true }, { k:'nit', lab:'NIT', val:e.nit }, { k:'ciudad', lab:'Ciudad', val:e.ciudad },
  { k:'direccion', lab:'Dirección', val:e.direccion, c2:true }, { k:'telefono', lab:'Teléfono', val:e.telefono }, { k:'correo', lab:'Correo', tipo:'email', val:e.correo }
];
const CAMPOS_APARIENCIA = (c) => [
  { k:'tema', lab:'Tema', tipo:'select', val:c.tema || 'claro', opts:[{ v:'claro', n:'Claro' }, { v:'oscuro', n:'Oscuro' }] },
  { k:'densidad', lab:'Densidad', tipo:'select', val:c.densidad || 'normal', opts:[{ v:'compacta', n:'Compacta' }, { v:'normal', n:'Normal' }, { v:'amplia', n:'Amplia' }] },
  { k:'colorPrimario', lab:'Color principal', tipo:'color', val:c.colorPrimario || '#16181A' }, { k:'colorSecundario', lab:'Color secundario (acento)', tipo:'color', val:c.colorSecundario || '#A98B54' },
  { k:'fuente', lab:'Fuente del texto', tipo:'select', val:c.fuente || 'Inter', opts:['Inter', 'Segoe UI', 'Helvetica Neue', 'Arial', 'Georgia'] },
  { k:'escalaLogo', lab:'Escala del logo (%)', tipo:'number', val:c.escalaLogo || 200 }
];
const CAMPOS_PARAMETROS = (p) => [
  { k:'smmlv', lab:'Salario mínimo mensual (SMMLV)', tipo:'number', val:p.smmlv }, { k:'anioSmmlv', lab:'Año del SMMLV', tipo:'number', val:p.anioSmmlv },
  { k:'topeVISsmmlv', lab:'Tope VIS (SMMLV)', tipo:'number', val:p.topeVISsmmlv }, { k:'topeVIPsmmlv', lab:'Tope VIP (SMMLV)', tipo:'number', val:p.topeVIPsmmlv },
  { k:'cuotaIngresoLey546', lab:'Primera cuota / ingreso máxima, Ley 546 (%)', tipo:'number', val:p.cuotaIngresoLey546 },
  { k:'finVISLey546', lab:'Financiación máxima VIS, Ley 546 (%)', tipo:'number', val:p.finVISLey546 }, { k:'finNoVISLey546', lab:'Financiación máxima No VIS, Ley 546 (%)', tipo:'number', val:p.finNoVISLey546 },
  { k:'plazoMinVivienda', lab:'Plazo mínimo de vivienda (años)', tipo:'number', val:p.plazoMinVivienda }, { k:'plazoMaxVivienda', lab:'Plazo máximo de vivienda (años)', tipo:'number', val:p.plazoMaxVivienda },
  { k:'diasVigenciaPorDefecto', lab:'Vigencia de documentos sin regla propia (días)', tipo:'number', val:p.diasVigenciaPorDefecto },
  { k:'toleranciaIngresos', lab:'Tolerancia al cruzar ingresos entre documentos (%)', tipo:'number', val:p.toleranciaIngresos }
];
const CAMPOS_PROGRAMA = (c) => [{ k:'minutosInactividad', lab:'Cerrar la sesión tras estos minutos sin uso', tipo:'number', val:c.minutosInactividad || 15 }];
Vistas['config'] = function(){
  const tab = UI.pestanaActiva('cfg', 'empresa');
  const e = S.empresa || {}, c = S.config || {};
  const edE = Permisos.puede('editarEmpresa'), edP = Permisos.puede('editarParametros');
  let cuerpo;
  if (tab === 'apariencia') cuerpo = '<div class="card"><div class="card-head"><h3>Apariencia</h3>' + boton('guardar-apariencia', 'Guardar', 'sm primary') + '</div><div class="card-body">' + UI.formulario(CAMPOS_APARIENCIA(c), 'ap') +
    '<p class="small muted" style="margin-top:10px">Los mismos ajustes de la familia ARKEN 360: tema, densidad, colores, fuente y escala del logo.</p></div></div>';
  else if (tab === 'parametros') cuerpo = '<div class="card"><div class="card-head"><h3>Parámetros normativos</h3>' + (edP ? boton('guardar-parametros', 'Guardar', 'sm primary') + boton('parametros-defecto', 'Valores de partida', 'sm ghost') : '') + '</div><div class="card-body">' +
    UI.formulario(CAMPOS_PARAMETROS(S.parametros).map(x => Object.assign(x, { deshabilitado:!edP })), 'pm') +
    '<p class="small muted" style="margin-top:10px">La Ley 546 de 1999 y sus decretos fijan para vivienda: plazo de 5 a 30 años, primera cuota hasta el 30 % de los ingresos familiares y financiación hasta el 80 % (VIS) o el 70 % (No VIS). Actualice el SMMLV cada enero.</p></div></div>';
  else if (tab === 'programa') cuerpo = '<div class="card"><div class="card-head"><h3>Programa</h3>' + (Permisos.puede('administrar') ? boton('guardar-programa', 'Guardar', 'sm primary') : '') + '</div><div class="card-body">' + UI.formulario(CAMPOS_PROGRAMA(c).map(x => Object.assign(x, { deshabilitado:!Permisos.puede('administrar') })), 'pg') + '</div></div>';
  else cuerpo = '<div class="grid g2"><div class="card"><div class="card-head"><h3>EMPRESA</h3>' + (edE ? boton('guardar-empresa', 'Guardar', 'sm primary') : '') + '</div><div class="card-body">' +
      UI.formulario(CAMPOS_EMPRESA(e).map(x => Object.assign(x, { deshabilitado:!edE })), 'em') + '<p class="small muted" style="margin-top:8px">Sale en el encabezado de los conceptos y los informes.</p></div></div>' +
    '<div class="card"><div class="card-head"><h3>Logo de la empresa</h3></div><div class="card-body">' + (e.logo ? '<img src="' + esc(e.logo) + '" alt="Logo de la empresa" style="max-width:220px;max-height:90px;display:block;margin-bottom:12px">' : '<p class="small muted">Sin logo. Aparece en la barra superior y en el encabezado de todos los PDF.</p>') +
      (edE ? '<div class="btn-row">' + boton('cargar-logo', 'Cargar logo (PNG o JPG)') + (e.logo ? boton('quitar-logo', 'Quitar', 'ghost') : '') + '</div>' : '') + '</div></div></div>';
  return { html:cabecera('', 'Configuración', 'Empresa, apariencia, parámetros normativos y sesión') + UI.pestanas('cfg', [['empresa', 'Empresa'], ['apariencia', 'Apariencia'], ['parametros', 'Parámetros'], ['programa', 'Programa']], 'empresa') + cuerpo,
    acciones:{
      'guardar-empresa':async () => {
        Permisos.exigir('editarEmpresa');
        const v = UI.leer(CAMPOS_EMPRESA(S.empresa || {}), document, 'em');
        if (!v.razonSocial) throw new Error('Escriba la razón social.');
        await Almacen.guardarEmpresa(Object.assign({}, S.empresa, v));
        await Auditoria.registrar('editar', 'empresa', v.razonSocial);
        UI.toast('Datos de la empresa guardados', 'ok'); App.aplicarApariencia(); App.render();
      },
      'cargar-logo':async () => {
        Permisos.exigir('editarEmpresa');
        const [f] = await UI.elegirArchivos('.png,.jpg,.jpeg');
        if (!f) return;
        if (f.size > 600 * 1024) throw new Error('El logo pesa ' + Util.pesoLegible(f.size) + '. Use una imagen de menos de 600 KB.');
        if (!/^image\/(png|jpeg)$/.test(f.type)) throw new Error('El logo debe ser PNG o JPG.');
        const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('No se pudo leer la imagen.')); r.readAsDataURL(f); });
        await Almacen.guardarEmpresa(Object.assign({}, S.empresa, { logo:url }));
        await Auditoria.registrar('editar', 'empresa', 'Logo cargado'); App.aplicarApariencia(); App.render();
      },
      'quitar-logo':async () => { Permisos.exigir('editarEmpresa'); const x = Object.assign({}, S.empresa); delete x.logo; await Almacen.guardarEmpresa(x); App.aplicarApariencia(); App.render(); },
      'guardar-apariencia':async () => {
        const v = UI.leer(CAMPOS_APARIENCIA(S.config), document, 'ap');
        await Almacen.guardarConfig(Object.assign({}, S.config, v, { escalaLogo:Math.min(300, Math.max(50, Number(v.escalaLogo) || 200)) }));
        App.aplicarApariencia(); UI.toast('Apariencia guardada', 'ok'); App.render();
      },
      'guardar-parametros':async () => {
        Permisos.exigir('editarParametros');
        const v = UI.leer(CAMPOS_PARAMETROS(S.parametros), document, 'pm');
        if (Object.keys(v).some(k => !(Number(v[k]) > 0))) throw new Error('Todos los parámetros deben ser números mayores que cero.');
        if (v.plazoMinVivienda > v.plazoMaxVivienda) throw new Error('El plazo mínimo no puede ser mayor que el máximo.');
        await Almacen.guardarParametros(v);
        await Auditoria.registrar('editar', 'parámetros', 'SMMLV ' + v.anioSmmlv + ' = ' + v.smmlv + ' · VIS ' + v.topeVISsmmlv + ' SMMLV · cuota/ingreso ' + v.cuotaIngresoLey546 + ' %');
        UI.toast('Parámetros guardados', 'ok'); App.render();
      },
      'parametros-defecto':async () => {
        Permisos.exigir('editarParametros');
        if (!(await UI.confirmar({ titulo:'Valores de partida', mensaje:'Se vuelven a los parámetros que trae el programa (SMMLV ' + Bancos.PARAMETROS.anioSmmlv + ').', textoAceptar:'Restablecer' }))) return;
        await Almacen.guardarParametros(Bancos.PARAMETROS); await Auditoria.registrar('editar', 'parámetros', 'Valores de partida'); App.render();
      },
      'guardar-programa':async () => {
        Permisos.exigir('administrar');
        const v = UI.leer(CAMPOS_PROGRAMA(S.config), document, 'pg');
        if (!(v.minutosInactividad >= 1)) throw new Error('Escriba al menos 1 minuto.');
        await Almacen.guardarConfig(Object.assign({}, S.config, v));
        await Auditoria.registrar('editar', 'configuración', 'Inactividad ' + v.minutosInactividad + ' min');
        Inactividad.reiniciar(); UI.toast('Configuración guardada', 'ok'); App.render();
      }
    } };
};
