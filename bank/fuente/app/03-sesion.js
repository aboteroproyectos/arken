/* ══════════════════════════════════════════════════════════════════════════
   USUARIOS, ROLES Y PERMISOS, como en ARKEN ANALYTICA. Los permisos se
   aplican en la lógica (Modelo llama a Permisos.exigir antes de escribir), no
   solo en la pantalla: un botón escondido no es una protección.
   ══════════════════════════════════════════════════════════════════════════ */
const Roles = (function(){
  const LISTA = {
    administrador:'Administrador', director:'Director comercial', analista:'Analista de crédito', asesor:'Asesor comercial', consulta:'Consulta'
  };
  /* Qué puede hacer cada rol. */
  const ACCIONES = {
    administrar:['administrador'],
    editarEmpresa:['administrador'],
    editarParametros:['administrador','director'],
    editarBancos:['administrador','director'],
    crearCliente:['administrador','director','analista','asesor'],
    editarCliente:['administrador','director','analista','asesor'],
    borrarCliente:['administrador','director'],
    cargarDocumentos:['administrador','director','analista','asesor'],
    leerDocumentos:['administrador','director','analista'],
    analizar:['administrador','director','analista'],
    emitirConcepto:['administrador','director','analista'],
    demostracion:['administrador','director'],
    exportar:['administrador','director','analista','asesor','consulta'],
    respaldar:['administrador','director']
  };
  function nombre(rol){ return LISTA[rol] || rol; }
  function puede(usuario, accion){
    if (!usuario || usuario.activo === false) return false;
    const roles = usuario.roles || [];
    const permitidos = ACCIONES[accion];
    if (!permitidos) return false;
    return roles.some(r => permitidos.indexOf(r) >= 0);
  }
  function quienPuede(accion){ return (ACCIONES[accion]||[]).map(nombre); }
  return { LISTA, ACCIONES, nombre, puede, quienPuede };
})();

const Sesion = { usuario:null, clienteActivo:null, modulo:'00', pestanas:{}, filtros:{} };

const Permisos = (function(){
  function soloConsulta(){ return false; }
  function puede(accion){ return Roles.puede(Sesion.usuario, accion); }
  /** Lanza un error con el mensaje para el usuario si no tiene el permiso. */
  function exigir(accion){
    if (puede(accion)) return;
    const err = new Error('Su usuario no tiene permiso para esta acción. Pueden hacerla: ' + Roles.quienPuede(accion).join(', ') + '.');
    err.permiso = true;
    throw err;
  }
  return { puede, exigir, soloConsulta };
})();

const Auditoria = (function(){
  /** La auditoría solo agrega: no hay función para editar ni borrar. */
  async function registrar(accion, objeto, detalle, clienteId){
    const u = Sesion.usuario;
    await Almacen.poner('auditoria', { id:Util.uid('au'), fecha:new Date().toISOString(),
      usuario:u ? u.usuario : '(sistema)', accion, objeto, detalle:detalle || '', clienteId:clienteId || null });
  }
  function lista(){ return (S.auditoria || []).slice().sort((a, b) => a.fecha < b.fecha ? 1 : -1); }
  return { registrar, lista };
})();

const Usuarios = (function(){
  async function asegurarAdministrador(){
    if ((S.usuarios || []).length) return;
    const h = await Cripto.hashContrasena('arken');
    await Almacen.poner('usuarios', { id:'us_admin', usuario:'admin', nombre:'Administrador', cargo:'', correo:'',
      roles:['administrador'], activo:true, debeCambiar:true, clave:h, creado:new Date().toISOString() });
  }
  async function ingresar(usuario, clave){
    const u = (S.usuarios||[]).find(x => Util.normaliza(x.usuario) === Util.normaliza(usuario));
    if (!u || u.activo === false || !(await Cripto.verificarContrasena(clave, u.clave))) return null;
    return u;
  }
  async function cambiarClave(u, nueva){
    if (String(nueva||'').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    const h = await Cripto.hashContrasena(nueva);
    const r = Object.assign({}, u, { clave:h, debeCambiar:false });
    await Almacen.poner('usuarios', r);
    return S.usuarios.find(x => x.id === u.id);
  }
  async function guardar(datos, claveInicial){
    Permisos.exigir('administrar');
    const u = Object.assign({ id:Util.uid('us'), activo:true, roles:[], creado:new Date().toISOString() }, datos);
    if (!u.usuario) throw new Error('Escriba el nombre de usuario.');
    if ((S.usuarios||[]).some(x => x.id !== u.id && Util.normaliza(x.usuario) === Util.normaliza(u.usuario)))
      throw new Error('Ya existe un usuario «' + u.usuario + '».');
    if (!u.roles.length) throw new Error('Asigne al menos un rol.');
    if (claveInicial){ u.clave = await Cripto.hashContrasena(claveInicial); u.debeCambiar = true; }
    if (!u.clave) throw new Error('Escriba una contraseña inicial.');
    const quedanAdmins = (S.usuarios||[]).filter(x => x.id !== u.id && x.activo !== false && (x.roles||[]).indexOf('administrador') >= 0).length +
      (u.activo !== false && u.roles.indexOf('administrador') >= 0 ? 1 : 0);
    if (!quedanAdmins) throw new Error('Debe quedar al menos un administrador activo.');
    await Almacen.poner('usuarios', u);
    await Auditoria.registrar('guardar', 'usuario', u.usuario + ' · ' + u.roles.map(Roles.nombre).join(', '));
    return u;
  }
  return { asegurarAdministrador, ingresar, cambiarClave, guardar };
})();

/* Bloqueo por inactividad, como ARKEN: pasado el tiempo configurado sin uso,
   la sesión se cierra y hay que volver a ingresar. */
const Inactividad = (function(){
  let temporizador = null;
  function minutos(){ return Number(S.config.minutosInactividad) || 15; }
  function reiniciar(){
    if (!Sesion.usuario) return;
    clearTimeout(temporizador);
    temporizador = setTimeout(() => { if (Sesion.usuario) App.salir('La sesión se cerró por inactividad.'); }, minutos() * 60000);
  }
  function iniciar(){ ['mousemove','keydown','click','touchstart'].forEach(ev => document.addEventListener(ev, reiniciar, { passive:true })); reiniciar(); }
  function detener(){ clearTimeout(temporizador); }
  return { iniciar, reiniciar, detener };
})();
