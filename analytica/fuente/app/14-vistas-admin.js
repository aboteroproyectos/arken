/* ─────────────── Riel ───────────────
   Un módulo con «fase» se muestra atenuado y dice qué hará y en qué fase llega.
   Desde la Fase 4 ninguno lo está. */
const MODULOS = [
  { id:'00', nombre:'Tablero del proceso' }, { id:'01', nombre:'Procesos' }, { id:'02', nombre:'Presupuesto base' },
  { id:'03', nombre:'Base de precios' }, { id:'04', nombre:'Condiciones de la oferta' }, { id:'05', nombre:'Documentos del proceso' },
  { id:'06', nombre:'Invitados y confidencialidad' }, { id:'07', nombre:'Pliego, revisión y emisión' },
  { id:'08', nombre:'Preguntas y adendas', texto:'Preguntas de los invitados con su respuesta publicada a todos, y adendas numeradas y firmadas que crean una versión nueva del pliego.' },
  { id:'09', nombre:'Recepción y apertura', texto:'Carga de muchos sobres a la vez, asignación por código de invitación, cierre y apertura con acta, sin abrir nada antes de la hora de cierre.' },
  { id:'10', nombre:'Documentos de proponentes', texto:'Una carpeta por proponente, cuyo nombre empieza por su razón social, con cada documento contra el requisito que responde.' },
  { id:'11', nombre:'Verificación y subsanaciones', texto:'Verificación de cada requisito habilitante por su evaluador, solicitudes de subsanación con plazo y su respuesta.' },
  { id:'12', nombre:'Análisis presupuestal', texto:'Aritmética, capítulos, subcapítulos, actividades, insumos, AIU, desbalance y APU, oferta por oferta contra el presupuesto base.' },
  { id:'13', nombre:'Análisis técnico, legal y financiero', texto:'Requisito por proponente, con su estado y la evidencia: jurídico, financiero, experiencia, personal, equipos, sistemas de gestión y programación.' },
  { id:'14', nombre:'Evaluación y puntajes', texto:'Puntaje de cada requisito ponderable con la regla del pliego, el método económico, el desempate y el orden de elegibilidad.' },
  { id:'15', nombre:'Comparativo y cuadro gerencial', texto:'El comparativo de todas las ofertas y el cuadro gerencial, con las quince gráficas.' },
  { id:'16', nombre:'Concepto e informe', texto:'El concepto de adjudicación para el comité y el informe en PDF y Excel con su lista de casillas.' },
  { id:'17', nombre:'Ayuda' }
];
MODULOS.filter(m => m.fase).forEach(m => {
  Vistas[m.id] = () => ({ html:cabecera(m.id, m.nombre, '<span class="fase">Fase ' + m.fase + '</span>') +
    '<div class="card"><div class="card-body">' + UI.vacio('Este módulo llega en la Fase ' + m.fase, esc(m.texto)) + '</div></div>' });
});

/* ─────────────── 17 · Ayuda ─────────────── */
Vistas['17'] = function(){
  const pasos = [
    ['Cree el proceso', 'Módulo 01. Código, nombre, objeto, modalidad y tipo de contrato. El proceso trae ya la plantilla de condiciones del Anexo B.'],
    ['Arme el presupuesto base', 'Módulo 02. A mano, importándolo del Excel de ARKEN CONTROL («Excel editable») o copiándolo de otro proceso. «Exportar para ARKEN CONTROL» produce un Excel que ARKEN importa sin editarlo.'],
    ['Mantenga la base de precios', 'Módulo 03. Actualícela con el Excel de ARKEN PRECIOS; cada cambio queda con su fecha y su fuente, y puede pasar los precios nuevos al presupuesto con una vista previa.'],
    ['Defina las condiciones', 'Módulo 04. Active, desactive o edite requisitos. Los ponderables deben sumar 1.000 puntos.'],
    ['Cargue los documentos', 'Módulo 05. Planos, estudios y modelos, con su huella SHA-256. Lo que supere el límite va por enlace.'],
    ['Registre a los invitados y el acuerdo', 'Módulo 06. NIT con dígito de verificación, contacto y el acuerdo de confidencialidad, que aprueba un usuario con rol Jurídico.'],
    ['Revise y emita', 'Módulo 07. Cronograma, condiciones generales, llaves del proceso con su respaldo, pliego en PDF y la revisión completa. «Emitir» se habilita con todo en verde.']
  ];
  const pasos2 = [
    ['Genere un paquete por invitado', 'Módulo 07 › Paquetes y envío. Cada ZIP trae ARKEN OFERTA con el pliego de ese invitado, LEAME_PRIMERO y, según el modo de confidencialidad, el pliego en PDF y los documentos, todo firmado. El programa prepara el correo; usted lo envía.'],
    ['Responda preguntas y emita adendas', 'Módulo 08. Las respuestas salen numeradas, firmadas y sin decir quién preguntó. Una adenda crea la versión siguiente del pliego; después del plazo de adendas solo se admite prorrogar el cierre.'],
    ['Reciba los sobres', 'Módulo 09. Suelte todos los ZIP a la vez: cada uno se asigna a su invitado por el código de invitación y queda sellado, sin abrir. De cada invitado vale el último sobre generado antes del cierre.'],
    ['Cierre y abra', 'Módulo 09. A la hora de cierre, el acta de cierre. La apertura exige la frase del proceso y dos miembros del comité; descifra todo a la vez, verifica cada adjunto, recalcula los totales y deja el acta de apertura.'],
    ['Revise los documentos de cada proponente', 'Módulo 10. Una carpeta por proponente, con su color, cada documento contra su requisito, su vigencia y búsqueda de texto en los PDF.']
  ];
  const pasos3 = [
    ['Verifique los requisitos habilitantes', 'Módulo 11. Una matriz requisito por proponente: cada celda se verifica con su documento, su página y el texto literal, y queda como fila nueva con quién y cuándo. Cada evaluador verifica solo lo de su rol; «No cumple» exige observación.'],
    ['Pida subsanaciones', 'Módulo 11 › Subsanaciones. La solicitud sale en PDF con el plazo en días hábiles; la respuesta del proponente queda en su carpeta. La justificación de un valor bajo la decide el comité.'],
    ['Analice el presupuesto', 'Módulo 12. Aritmética, capítulos, subcapítulos, actividades, insumos, AIU, desbalance y APU contra el presupuesto base, con cada diferencia por renglón.'],
    ['Revise lo técnico, legal y financiero', 'Módulo 13. Indicadores financieros, experiencia en SMMLV, personal, sistemas de gestión, programación y los requisitos que usted creó, con la sugerencia del programa y la decisión del evaluador.'],
    ['Atienda la bandeja de alertas', 'Botón de alertas en la barra. Cada alerta dice qué encontró, por qué importa, la regla y qué hacer, con su evidencia a un clic. Póngala en revisión, confírmela o descártela con motivo.'],
    ['Puntúe y ordene', 'Módulo 14. Puntaje económico con el método del pliego, ponderables, desempate y el orden de elegibilidad. Mientras falte una verificación, el puntaje es provisional.']
  ];
  const pasos4 = [
    ['Compare las ofertas', 'Módulo 15. El comparativo por capítulo, subcapítulo o actividad frente a la base y la mediana; el cuadro gerencial en una página; la matriz de requisitos, y las quince gráficas. Todo se exporta a Excel, PDF o imagen.'],
    ['Firme el concepto', 'Módulo 16 › Concepto. El programa lo genera desde la evaluación y el comité edita cada texto. Lo firman dos miembros del comité; si algo cambia después, vuelve a borrador.'],
    ['Genere el informe', 'Módulo 16 › Informe. Elija y ordene las secciones y las gráficas. Sale en PDF y en Excel, y cada versión queda guardada. Sin el concepto firmado, lleva la marca de borrador.'],
    ['Pase el adjudicado a ARKEN CONTROL', 'Módulo 16 › Concepto, con el concepto firmado: «Presupuesto adjudicado para ARKEN CONTROL» produce el Excel que ARKEN importa. El AIU se digita en ARKEN con los porcentajes del libro.'],
    ['Lea los documentos con el lector', 'Módulo 11 › Verificación › «Leer el documento». Busca en el PDF del proponente las fechas, valores, NIT, porcentajes e indicadores del requisito y muestra la página y el texto donde están. Funciona sin internet y sin costo; los PDF escaneados como imagen no tienen texto que leer.']
  ];
  const html = cabecera('17', 'Ayuda', 'Cómo usar ARKEN ANALYTICA · versión ' + esc(VERSION_PROGRAMA)) +
    '<div class="nota-flujo">' + PASOS_FLUJO.map((x, i) => (i ? '<span class="fl">›</span>' : '') + '<span class="paso">' + x + '</span>').join('') + '</div>' +
    '<div class="card"><div class="card-head"><h3>Preparar un proceso (Fase 1)</h3></div><div class="card-body">' +
      pasos.map((p, i) => '<div class="chk ok"><span class="ic" aria-hidden="true">' + (i + 1) + '</span><div class="tx"><b>' + esc(p[0]) + '.</b> ' + esc(p[1]) + '</div></div>').join('') + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Invitar, recibir y abrir (Fase 2)</h3></div><div class="card-body">' +
      pasos2.map((p, i) => '<div class="chk ok"><span class="ic" aria-hidden="true">' + (i + 8) + '</span><div class="tx"><b>' + esc(p[0]) + '.</b> ' + esc(p[1]) + '</div></div>').join('') + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Verificar, analizar y puntuar (Fase 3)</h3></div><div class="card-body">' +
      pasos3.map((p, i) => '<div class="chk ok"><span class="ic" aria-hidden="true">' + (i + 13) + '</span><div class="tx"><b>' + esc(p[0]) + '.</b> ' + esc(p[1]) + '</div></div>').join('') + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Decidir e informar (Fase 4)</h3></div><div class="card-body">' +
      pasos4.map((p, i) => '<div class="chk ok"><span class="ic" aria-hidden="true">' + (i + 19) + '</span><div class="tx"><b>' + esc(p[0]) + '.</b> ' + esc(p[1]) + '</div></div>').join('') + '</div></div>' +
    '<div class="grid g2"><div class="card"><div class="card-head"><h3>Sus datos</h3></div><div class="card-body small">' +
      '<p>Los datos viven en este navegador (IndexedDB), nunca dentro del archivo del programa ni en internet. Descargue un respaldo .zip con frecuencia desde Administración › Respaldos.</p>' +
      '<p>Las llaves privadas de cada proceso se guardan cifradas con la frase del proceso, que el programa no conoce.</p>' +
      '<p>En el computador, la app de escritorio guarda además una copia por día. En el celular y la tableta, la app solo consulta: los datos llegan restaurando un respaldo.</p></div></div>' +
    '<div class="card"><div class="card-head"><h3>Demostración</h3></div><div class="card-body small">' +
      '<p>«Cargar demostración» crea un proceso ficticio completo, rotulado DEMOSTRACIÓN en cada pantalla y en cada documento. Sus empresas no son reales: los NIT son de la serie 999 y los correos terminan en .invalid.</p>' +
      '<p>Se borra con un botón en Administración › Demostración, sin tocar sus datos reales.</p></div></div></div>';
  return { html };
};

/* ─────────────── Administración ─────────────── */
Vistas['admin'] = function(){
  const tab = UI.pestanaActiva('adm', 'usuarios');
  const pest = [['usuarios','Usuarios y roles'],['auditoria','Auditoría'],['respaldos','Respaldos'],['llaves','Llaves'],['registro','Registro técnico'],['demo','Demostración']];
  const cuerpo = tab === 'auditoria' ? adminAuditoria() : tab === 'respaldos' ? adminRespaldos() : tab === 'llaves' ? adminLlaves() : tab === 'registro' ? adminRegistro() : tab === 'demo' ? adminDemo() : adminUsuarios();
  return { html:cabecera('', 'Administración', 'Usuarios, roles, auditoría, llaves y respaldos') + UI.pestanas('adm', pest, 'usuarios') + cuerpo, acciones:accionesAdmin() };
};
function adminUsuarios(){
  const ed = Permisos.puede('administrar');
  const filas = (S.usuarios||[]).map(u => '<tr' + (u.activo === false ? ' style="opacity:.5"' : '') + '><td class="cod">' + esc(u.usuario) + '</td><td>' + esc(u.nombre) + '<div class="small muted">' + esc(u.cargo || '') + '</div></td><td class="small">' +
    (u.roles||[]).map(r => UI.tag(Roles.nombre(r), r === 'administrador' ? 'brass' : 'info')).join(' ') + '</td><td>' + (u.activo === false ? UI.tag('inactivo', 'bad') : UI.tag('activo', 'ok')) + (u.debeCambiar ? ' ' + UI.tag('debe cambiar la contraseña', 'warn') : '') +
    '</td><td class="act">' + (ed ? boton('editar-usuario', 'Editar', 'xs', ' data-id="' + u.id + '"') + ' ' + boton('clave-usuario', 'Restablecer contraseña', 'xs', ' data-id="' + u.id + '"') : '') + '</td></tr>').join('');
  return '<div class="card"><div class="card-head"><h3>Usuarios</h3>' + (ed ? boton('nuevo-usuario', '+ Usuario', 'sm primary') : '') + '</div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Usuario</th><th>Nombre</th><th>Roles</th><th>Estado</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Qué puede hacer cada rol</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Acción</th>' + Object.keys(Roles.LISTA).map(r => '<th class="small">' + esc(Roles.nombre(r).split(' (')[0]) + '</th>').join('') + '</tr></thead><tbody>' +
      Object.keys(Roles.ACCIONES).map(a => '<tr><td class="small">' + esc(NOMBRES_ACCION[a] || a) + '</td>' + Object.keys(Roles.LISTA).map(r => '<td>' + (Roles.ACCIONES[a].indexOf(r) >= 0 ? '✓' : '') + '</td>').join('') + '</tr>').join('') +
    '</tbody></table></div></div></div><p class="small muted">Los permisos se aplican en la lógica del programa, no solo en la pantalla. El acuerdo de confidencialidad solo lo aprueba el rol Jurídico, ni siquiera el administrador.</p>';
}
const NOMBRES_ACCION = { administrar:'Administrar usuarios y respaldos', editarEmpresa:'Editar los datos de la empresa', editarParametros:'Editar parámetros (SMMLV, IVA)', crearProceso:'Crear y duplicar procesos',
  editarProceso:'Editar la ficha y el cronograma', editarPresupuesto:'Editar el presupuesto base', editarBasePrecios:'Editar la base de precios', editarCondiciones:'Editar las condiciones de la oferta',
  editarDocumentos:'Cargar documentos del proceso', gestionarInvitados:'Gestionar invitados', editarConfidencialidad:'Editar el acuerdo de confidencialidad', aprobarConfidencialidad:'Aprobar el acuerdo (abogado)',
  crearLlaves:'Crear y respaldar las llaves', generarPliego:'Generar el pliego', emitir:'Emitir el proceso', demostracion:'Cargar y borrar la demostración', exportar:'Ver y exportar', respaldar:'Descargar respaldos' };
function adminAuditoria(){
  const lista = Auditoria.lista();
  const filas = lista.slice(0, 500).map(a => { const p = Modelo.proceso(a.procesoId);
    return '<tr><td class="small num">' + Util.fmtSello(a.fecha) + '</td><td>' + esc(a.usuario) + '</td><td>' + esc(a.accion) + '</td><td>' + esc(a.objeto) + '</td><td class="small">' + esc(a.detalle) + '</td><td class="cod">' + esc(p ? p.codigo : '') + '</td></tr>'; }).join('');
  return '<div class="card"><div class="card-head"><h3>' + lista.length + ' registro(s)</h3>' + boton('exportar-auditoria', 'Exportar a Excel', 'sm') + '</div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Objeto</th><th>Detalle</th><th>Proceso</th></tr></thead><tbody>' + filas + '</tbody></table></div></div></div>' +
    (lista.length > 500 ? '<p class="small muted">Se muestran los 500 más recientes; el Excel los trae todos.</p>' : '') + '<p class="small muted">La auditoría solo agrega registros: no hay forma de editarlos ni de borrarlos.</p>';
}
function adminRespaldos(){
  return '<div class="grid g2"><div class="card"><div class="card-head"><h3>Descargar respaldo</h3></div><div class="card-body"><p class="small">Un .zip con todos los datos de este equipo, los archivos por su huella y un manifiesto con las huellas SHA-256 de cada parte. Las llaves privadas van cifradas con la frase de cada proceso, como están guardadas.</p>' +
      '<div class="btn-row">' + (Permisos.puede('respaldar') ? boton('descargar-respaldo', 'Descargar respaldo completo', 'primary') : '') + '</div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Restaurar respaldo</h3></div><div class="card-body"><p class="small">Antes de restaurar, el programa muestra qué trae el respaldo y qué reemplaza, y verifica cada huella. Nada se sobrescribe sin que usted escriba REEMPLAZAR.</p>' +
      '<div class="btn-row">' + (Permisos.puede('administrar') ? boton('restaurar-respaldo', 'Restaurar desde un .zip', 'danger') : '') + '</div></div></div></div>';
}
function adminLlaves(){
  const filas = Modelo.procesos(true).map(p => { const ll = Modelo.llaves(p.id), r = (ll && ll.respaldo) || {};
    return '<tr><td class="cod">' + esc(p.codigo) + '</td><td>' + esc(p.nombre) + etiquetaDemo(p) + '</td><td>' + (ll ? UI.tag('creadas', 'ok') + '<div class="huella">' + esc(ll.huellaPublicas.slice(0, 24)) + '…</div>' : UI.tag('sin llaves')) +
      '</td><td>' + (ll ? (r.descargado ? UI.tag('descargado', 'ok') : UI.tag('sin descargar', 'bad')) + ' ' + (r.confirmado ? UI.tag('guardado fuera', 'ok') : UI.tag('sin confirmar', 'warn')) : '—') + '</td><td class="act">' +
      (!ll && Permisos.puede('crearLlaves') ? boton('restaurar-llaves', 'Restaurar desde respaldo', 'xs', ' data-id="' + p.id + '"') : '') + '</td></tr>'; }).join('');
  return '<div class="card"><div class="card-head"><h3>Llaves por proceso</h3></div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Código</th><th>Proceso</th><th>Llaves</th><th>Respaldo</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div></div></div>' +
    '<p class="small muted">Las llaves se crean en el módulo 07 de cada proceso. Si este equipo se pierde, el respaldo de llaves (ARKEN-LLAVES) y la frase del proceso las recuperan en otro equipo.</p>';
}
function adminRegistro(){
  const e = RegistroTecnico.entradas().reverse();
  return '<div class="card"><div class="card-head"><h3>Registro técnico de esta sesión</h3>' + boton('bajar-registro', 'Descargar', 'sm') + '</div><div class="card-body flush">' +
    (e.length ? '<div class="tw scroll"><table class="t"><thead><tr><th>Fecha</th><th>Dónde</th><th>Mensaje</th></tr></thead><tbody>' + e.slice(0, 200).map(x => '<tr><td class="small num">' + Util.fmtSello(x.fecha) + '</td><td>' + esc(x.contexto) + '</td><td class="small">' + esc(x.mensaje) + '</td></tr>').join('') + '</tbody></table></div>'
      : UI.vacio('Sin errores registrados', 'Si algo falla, el detalle técnico queda aquí para enviarlo a soporte.')) + '</div></div>';
}
function adminDemo(){
  return '<div class="card"><div class="card-head"><h3>Demostración</h3></div><div class="card-body"><p>La demostración crea un proceso ficticio con presupuesto (22 actividades, 20 APU, 35 insumos), cronograma y cinco invitados. Todo va rotulado DEMOSTRACIÓN y ningún nombre ni NIT es real.</p>' +
    '<div class="btn-row">' + (Permisos.puede('demostracion') ? boton('cargar-demo', 'Cargar demostración', 'primary') + (Modelo.hayDemo() ? boton('borrar-demo', 'Borrar datos de demostración', 'danger') : '') : '') + '</div></div></div>';
}
function accionesAdmin(){
  async function editarUsuario(u){
    const x = u ? Util.copia(u) : { roles:[], activo:true };
    const campos = [{ k:'usuario', lab:'Usuario', val:x.usuario, deshabilitado:!!u }, { k:'nombre', lab:'Nombre completo', val:x.nombre },
      { k:'cargo', lab:'Cargo', val:x.cargo }, { k:'correo', lab:'Correo', tipo:'email', val:x.correo }]
      .concat(Object.keys(Roles.LISTA).map(r => ({ k:'rol_' + r, lab:Roles.nombre(r), tipo:'check', val:(x.roles||[]).indexOf(r) >= 0 })))
      .concat([{ k:'activo', lab:'Usuario activo', tipo:'check', val:x.activo !== false, c2:true }])
      .concat(u ? [] : [{ k:'clave', lab:'Contraseña inicial (la cambiará al ingresar)', tipo:'password', c2:true }]);
    const v = await UI.pedir({ titulo:u ? 'Usuario ' + u.usuario : 'Nuevo usuario', eyebrow:'Administración', campos });
    if (!v) return;
    const datos = Object.assign(x, { usuario:u ? u.usuario : v.usuario, nombre:v.nombre, cargo:v.cargo, correo:v.correo, activo:v.activo,
      roles:Object.keys(Roles.LISTA).filter(r => v['rol_' + r]) });
    if (!u && String(v.clave||'').length < 8) throw new Error('La contraseña inicial debe tener al menos 8 caracteres.');
    await Usuarios.guardar(datos, u ? null : v.clave);
    UI.toast('Usuario guardado', 'ok'); App.render();
  }
  return Object.assign({
    'nuevo-usuario':() => editarUsuario(null).catch(e => UI.error(e, 'Usuario')),
    'editar-usuario':b => editarUsuario((S.usuarios||[]).find(u => u.id === b.dataset.id)).catch(e => UI.error(e, 'Usuario')),
    'clave-usuario':async b => {
      const u = (S.usuarios||[]).find(x => x.id === b.dataset.id);
      const v = await UI.pedir({ titulo:'Restablecer contraseña · ' + u.usuario, ancho:'', campos:[{ k:'clave', lab:'Contraseña temporal (8 caracteres o más)', tipo:'password', c2:true }],
        validar:z => String(z.clave||'').length < 8 ? 'Mínimo 8 caracteres.' : '' });
      if (!v) return;
      await Usuarios.guardar(Object.assign(Util.copia(u)), v.clave);
      UI.toast('Contraseña restablecida: ' + u.usuario + ' deberá cambiarla al ingresar', 'ok'); App.render();
    },
    'exportar-auditoria':() => Documentos.excelAuditoria(),
    'descargar-respaldo':async () => { Permisos.exigir('respaldar'); UI.toast('Preparando el respaldo…'); const r = await Respaldo.generar(); UI.descargar(r.nombre, r.blob); UI.toast('Respaldo descargado', 'ok'); },
    'restaurar-respaldo':async () => { Permisos.exigir('administrar'); const [f] = await UI.elegirArchivos('.zip'); if (f) await Respaldo.restaurar(f, () => App.recargar()); },
    'restaurar-llaves':async b => {
      const p = Modelo.proceso(b.dataset.id);
      const [f] = await UI.elegirArchivos('.json');
      if (!f) return;
      const r = Cripto.leerRespaldoLlaves(await f.text());
      if (r.proceso && r.proceso !== p.codigo) throw new Error('El respaldo es de las llaves del proceso ' + r.proceso + ', no de ' + p.codigo + '.');
      const v = await UI.pedir({ titulo:'Restaurar llaves de ' + p.codigo, ancho:'', textoAceptar:'Restaurar', campos:[{ k:'frase', lab:'Frase del proceso', tipo:'password', c2:true }],
        antes:'<p class="small">Para restaurar, escriba la frase del proceso: el programa comprueba que abre las llaves del respaldo.</p>' });
      if (!v) return;
      if (!(await Cripto.verificarFrase(r, v.frase))) throw new Error('La frase no abre las llaves de este respaldo.');
      Permisos.exigir('crearLlaves');
      delete r.advertencia;
      await Almacen.poner('llaves', Object.assign(r, { id:p.id, procesoId:p.id, demo:!!p.demo, respaldo:{ descargado:true, confirmado:true, restaurado:new Date().toISOString() } }));
      await Auditoria.registrar('restaurar', 'llaves del proceso', 'Huella de las públicas ' + r.huellaPublicas, p.id);
      UI.toast('Llaves restauradas', 'ok'); App.render();
    },
    'bajar-registro':() => UI.descargar('ARKEN_ANALYTICA_registro_tecnico_' + Util.selloArchivo(Date.now(), true) + '.json', JSON.stringify(RegistroTecnico.entradas(), null, 2), 'application/json')
  }, Vistas['01'].accionesComunes);
}

/* ─────────────── Configuración ─────────────── */
const CAMPOS_EMPRESA = (e) => [
  { k:'razonSocial', lab:'Razón social', val:e.razonSocial, c2:true }, { k:'nit', lab:'NIT (sin dígito de verificación)', val:e.nit }, { k:'dv', lab:'Dígito de verificación', val:e.dv },
  { k:'ciudad', lab:'Ciudad (domicilio)', val:e.ciudad }, { k:'pais', lab:'País', val:e.pais || 'Colombia' }, { k:'direccion', lab:'Dirección', val:e.direccion, c2:true },
  { k:'telefono', lab:'Teléfono', val:e.telefono }, { k:'correo', lab:'Correo', tipo:'email', val:e.correo },
  { k:'representante', lab:'Representante legal', val:e.representante }, { k:'documentoRepresentante', lab:'Documento del representante', val:e.documentoRepresentante }
];
const CAMPOS_APARIENCIA = (c) => [
  { k:'tema', lab:'Tema', tipo:'select', val:c.tema || 'claro', opts:[{ v:'claro', n:'Claro' }, { v:'oscuro', n:'Oscuro' }] },
  { k:'densidad', lab:'Densidad', tipo:'select', val:c.densidad || 'normal', opts:[{ v:'compacta', n:'Compacta' }, { v:'normal', n:'Normal' }, { v:'amplia', n:'Amplia' }] },
  { k:'colorPrimario', lab:'Color principal', tipo:'color', val:c.colorPrimario || '#16181A' }, { k:'colorSecundario', lab:'Color secundario (acento)', tipo:'color', val:c.colorSecundario || '#A98B54' },
  { k:'fuente', lab:'Fuente del texto', tipo:'select', val:c.fuente || 'Inter', opts:['Inter','Segoe UI','Helvetica Neue','Arial','Georgia'] },
  { k:'escalaLogo', lab:'Escala del logo (%)', tipo:'number', val:c.escalaLogo || 200 }
];
const CAMPOS_PROGRAMA = (c) => [
  { k:'minutosInactividad', lab:'Cerrar la sesión tras estos minutos sin uso', tipo:'number', val:c.minutosInactividad || 15 },
  { k:'limiteArchivoMB', lab:'Límite por archivo (MB)', tipo:'number', val:c.limiteArchivoMB || 500 },
  { k:'limitePaqueteMB', lab:'Límite del paquete (MB)', tipo:'number', val:c.limitePaqueteMB || 1024 },
  { k:'ocultarPreciosATecnicos', lab:'Los evaluadores técnicos no ven los precios hasta terminar su calificación', tipo:'check', val:c.ocultarPreciosATecnicos, c2:true }
];
Vistas['config'] = function(){
  const tab = UI.pestanaActiva('cfg', 'empresa');
  const e = S.empresa || {}, c = S.config || {};
  const edE = Permisos.puede('editarEmpresa'), edP = Permisos.puede('editarParametros');
  let cuerpo;
  if (tab === 'apariencia') cuerpo = '<div class="card"><div class="card-head"><h3>Apariencia</h3>' + boton('guardar-apariencia', 'Guardar', 'sm primary') + '</div><div class="card-body">' + UI.formulario(CAMPOS_APARIENCIA(c), 'ap') +
    '<p class="small muted" style="margin-top:10px">Los mismos ajustes de ARKEN CONTROL: tema, densidad, colores, fuente y escala del logo.</p></div></div>';
  else if (tab === 'parametros') cuerpo = '<div class="card"><div class="card-head"><h3>Salario mínimo (SMMLV) e IVA por vigencia</h3></div><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Parámetro</th><th class="n">Valor</th><th>Norma</th><th>Verificado por</th><th></th></tr></thead><tbody>' +
    (S.parametros||[]).slice().sort((a, b) => (a.clave + (a.anio||'')) < (b.clave + (b.anio||'')) ? 1 : -1).map(x => '<tr><td>' + esc(x.clave === 'smmlv' ? 'SMMLV ' + x.anio : 'IVA general') + (x.porVerificar ? ' ' + UI.tag('por verificar', 'warn') : '') + '</td><td class="n">' + (x.clave === 'smmlv' ? money(x.valor) : x.valor + ' %') +
      '</td><td class="small">' + esc(x.norma) + '</td><td class="small">' + esc(x.verificadoPor || '—') + '</td><td class="act">' + (edP ? boton('editar-parametro', 'Editar', 'xs', ' data-id="' + x.id + '"') : '') + '</td></tr>').join('') +
    '</tbody></table></div></div></div>' + (edP ? '<div class="btn-row">' + boton('nuevo-smmlv', '+ Vigencia del SMMLV') + '</div>' : '');
  else if (tab === 'programa') cuerpo = '<div class="card"><div class="card-head"><h3>Programa</h3>' + (Permisos.puede('administrar') ? boton('guardar-programa', 'Guardar', 'sm primary') : '') + '</div><div class="card-body">' + UI.formulario(CAMPOS_PROGRAMA(c).map(x => Object.assign(x, { deshabilitado:!Permisos.puede('administrar') })), 'pg') + '</div></div>';
  else cuerpo = '<div class="grid g2"><div class="card"><div class="card-head"><h3>EMPRESA PRINCIPAL</h3>' + (edE ? boton('guardar-empresa', 'Guardar', 'sm primary') : '') + '</div><div class="card-body">' +
      (e.demo ? '<div class="nota warn">Estos son los datos ficticios de la demostración. Reemplácelos por los de su empresa.</div>' : '') +
      UI.formulario(CAMPOS_EMPRESA(e).map(x => Object.assign(x, { deshabilitado:!edE })), 'em') + '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Logo de la empresa</h3></div><div class="card-body">' + (e.logo ? '<img src="' + esc(e.logo) + '" alt="Logo de la empresa" style="max-width:220px;max-height:90px;display:block;margin-bottom:12px">' : '<p class="small muted">Sin logo. Aparece en la barra superior y en el encabezado de todos los PDF.</p>') +
      (edE ? '<div class="btn-row">' + boton('cargar-logo', 'Cargar logo (PNG o JPG)') + (e.logo ? boton('quitar-logo', 'Quitar', 'ghost') : '') + '</div>' : '') + '</div></div></div>';
  return { html:cabecera('', 'Configuración', 'Empresa, apariencia, parámetros y límites') + UI.pestanas('cfg', [['empresa','Empresa'],['apariencia','Apariencia'],['parametros','Parámetros'],['programa','Programa']], 'empresa') + cuerpo,
    acciones:accionesConfig() };
};
function accionesConfig(){
  async function editarParametro(x){
    const v = await UI.pedir({ titulo:x.clave === 'smmlv' ? 'SMMLV ' + (x.anio || '') : 'IVA general', ancho:'', campos:[].concat(x.clave === 'smmlv' ? [{ k:'anio', lab:'Año', tipo:'number', val:x.anio }] : [],
      [{ k:'valor', lab:'Valor', tipo:'number', val:x.valor }, { k:'norma', lab:'Norma', val:x.norma, c2:true }, { k:'verificadoPor', lab:'Verificado por', val:x.verificadoPor || (Sesion.usuario.nombre || Sesion.usuario.usuario), c2:true }]),
      validar:z => !(Number(z.valor) > 0) ? 'Escriba un valor mayor que cero.' : '' });
    if (!v) return;
    Permisos.exigir('editarParametros');
    const r = Object.assign({}, x, v, { valor:Number(v.valor), porVerificar:!v.verificadoPor });
    if (x.clave === 'smmlv'){ r.anio = Number(v.anio); r.id = 'smmlv-' + r.anio; r.vigenteDesde = r.anio + '-01-01'; }
    if (r.id !== x.id && x.id) await Almacen.borrar('parametros', x.id);
    await Almacen.poner('parametros', r);
    await Auditoria.registrar('editar', 'parámetro', (r.clave === 'smmlv' ? 'SMMLV ' + r.anio : 'IVA') + ' = ' + r.valor + ' · ' + r.norma);
    App.render();
  }
  return {
    'guardar-empresa':async () => {
      Permisos.exigir('editarEmpresa');
      const v = UI.leer(CAMPOS_EMPRESA(S.empresa || {}), document, 'em');
      if (!v.razonSocial) throw new Error('Escriba la razón social.');
      if (Util.normaliza(v.pais || 'Colombia') === 'colombia' && v.nit && !Nit.valido(v.nit, v.dv)) throw new Error('El NIT no corresponde al dígito de verificación (el correcto es ' + Nit.digitoVerificacion(v.nit) + ').');
      const demo = S.empresa.demo && v.razonSocial === S.empresa.razonSocial && v.nit === S.empresa.nit;
      await Almacen.guardarEmpresa(Object.assign({}, S.empresa, v, { nit:Nit.limpiar(v.nit), demo:!!demo }));
      await Auditoria.registrar('editar', 'empresa', v.razonSocial);
      UI.toast('Datos de la empresa guardados', 'ok'); App.render();
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
    'quitar-logo':async () => { Permisos.exigir('editarEmpresa'); const e = Object.assign({}, S.empresa); delete e.logo; await Almacen.guardarEmpresa(e); App.aplicarApariencia(); App.render(); },
    'guardar-apariencia':async () => {
      const v = UI.leer(CAMPOS_APARIENCIA(S.config), document, 'ap');
      await Almacen.guardarConfig(Object.assign({}, S.config, v, { escalaLogo:Math.min(300, Math.max(50, Number(v.escalaLogo)||200)) }));
      App.aplicarApariencia(); UI.toast('Apariencia guardada', 'ok'); App.render();
    },
    'guardar-programa':async () => {
      Permisos.exigir('administrar');
      const v = UI.leer(CAMPOS_PROGRAMA(S.config), document, 'pg');
      if (!(v.minutosInactividad >= 1 && v.limiteArchivoMB >= 1 && v.limitePaqueteMB >= v.limiteArchivoMB)) throw new Error('Revise los valores: el paquete no puede ser menor que el límite por archivo.');
      await Almacen.guardarConfig(Object.assign({}, S.config, v));
      await Auditoria.registrar('editar', 'configuración', 'Inactividad ' + v.minutosInactividad + ' min · archivo ' + v.limiteArchivoMB + ' MB · paquete ' + v.limitePaqueteMB + ' MB · ocultar precios ' + (v.ocultarPreciosATecnicos ? 'sí' : 'no'));
      Inactividad.reiniciar(); UI.toast('Configuración guardada', 'ok'); App.render();
    },
    'editar-parametro':b => editarParametro((S.parametros||[]).find(x => x.id === b.dataset.id)),
    'nuevo-smmlv':() => editarParametro({ clave:'smmlv', anio:new Date().getFullYear() + 1, valor:'', norma:'', verificadoPor:'' })
  };
}
