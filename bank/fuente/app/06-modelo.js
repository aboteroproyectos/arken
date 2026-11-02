/* ══════════════════════════════════════════════════════════════════════════
   MODELO — clientes, documentos, conceptos y bancos. Toda escritura pasa por
   aquí: exige el permiso, guarda en el almacén y deja la auditoría.
   ══════════════════════════════════════════════════════════════════════════ */
const ESTADOS_CLIENTE = [
  { id:'prospecto', n:'Prospecto', clase:'' }, { id:'en_estudio', n:'En estudio', clase:'info' }, { id:'radicado', n:'Radicado en el banco', clase:'brass' },
  { id:'aprobado', n:'Aprobado', clase:'ok' }, { id:'desembolsado', n:'Desembolsado', clase:'ok' }, { id:'negado', n:'Negado', clase:'bad' }, { id:'desistido', n:'Desistido', clase:'' }
];

const Modelo = (function(){
  const porNombre = (a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');

  /* ── Clientes ── */
  function clientes(){ return (S.clientes || []).slice().sort(porNombre); }
  function cliente(id){ return (S.clientes || []).find(c => c.id === id) || null; }
  function activo(){ return cliente(Sesion.clienteActivo); }
  function estado(id){ return ESTADOS_CLIENTE.find(e => e.id === id) || ESTADOS_CLIENTE[0]; }
  function abrir(id){
    Sesion.clienteActivo = id;
    try { localStorage.setItem('arken-bank-cliente', id || ''); } catch(e){}
  }
  async function guardarCliente(datos){
    Permisos.exigir(datos.id && cliente(datos.id) ? 'editarCliente' : 'crearCliente');
    const previo = datos.id ? cliente(datos.id) : null;
    const c = Object.assign({ id:Util.uid('cli'), estado:'prospecto', perfil:{}, fuentes:{}, creado:new Date().toISOString() }, previo || {}, datos);
    if (!String(c.nombre || '').trim()) throw new Error('Escriba el nombre del cliente.');
    if (!Catalogo.tipoCliente(c.tipo)) throw new Error('Elija el tipo de cliente.');
    if (c.perfil.producto && !Catalogo.productosPara(c.tipo).some(p => p.id === c.perfil.producto)) c.perfil.producto = '';
    c.modificado = new Date().toISOString();
    c.modificadoPor = Sesion.usuario ? Sesion.usuario.usuario : '';
    await Almacen.poner('clientes', c);
    await Auditoria.registrar(previo ? 'editar' : 'crear', 'cliente', c.nombre, c.id);
    return cliente(c.id);
  }
  /** Cambia campos del perfil; «fuentes» dice de qué documento salió cada valor. */
  async function actualizarPerfil(id, cambios, fuentes){
    Permisos.exigir('editarCliente');
    const c = Util.copia(cliente(id)); if (!c) throw new Error('El cliente ya no existe.');
    c.perfil = Object.assign({}, c.perfil, cambios);
    c.fuentes = Object.assign({}, c.fuentes || {});
    Object.keys(cambios).forEach(k => { if (fuentes && fuentes[k]) c.fuentes[k] = fuentes[k]; else delete c.fuentes[k]; });
    c.modificado = new Date().toISOString();
    await Almacen.poner('clientes', c);
    await Auditoria.registrar('editar', 'perfil del cliente', c.nombre + ' · ' + Object.keys(cambios).join(', '), id);
    return cliente(id);
  }
  async function borrarCliente(id){
    Permisos.exigir('borrarCliente');
    const c = cliente(id); if (!c) return;
    for (const d of documentos(id)) await borrarDocumento(d.id, true);
    for (const k of conceptos(id)) await Almacen.borrar('conceptos', k.id);
    await Almacen.borrar('clientes', id);
    if (Sesion.clienteActivo === id) abrir(null);
    await Auditoria.registrar('borrar', 'cliente', c.nombre, id);
  }

  /* ── Documentos ── */
  function documentos(clienteId){ return (S.documentos || []).filter(d => d.clienteId === clienteId).sort((a, b) => a.cargado < b.cargado ? 1 : -1); }
  function documento(id){ return (S.documentos || []).find(d => d.id === id) || null; }
  async function guardarDocumento(d){ await Almacen.poner('documentos', d); return documento(d.id); }
  async function borrarDocumento(id, sinPermiso){
    if (!sinPermiso) Permisos.exigir('cargarDocumentos');
    const d = documento(id); if (!d) return;
    await Almacen.borrar('documentos', id);
    // El archivo se borra solo si ningún otro documento lo usa.
    if (!(S.documentos || []).some(x => x.sha256 === d.sha256)) await Almacen.borrarArchivo(d.sha256);
    await Auditoria.registrar('borrar', 'documento', d.nombre, d.clienteId);
  }

  /* ── Bancos ── */
  function bancos(){ return (S.bancos || []).slice().sort((a, b) => (a.orden || 99) - (b.orden || 99) || porNombre(a, b)); }
  function banco(id){ return (S.bancos || []).find(b => b.id === id) || null; }
  async function asegurarBancos(){
    if ((S.bancos || []).length) return;
    for (const b of Bancos.iniciales(Util.hoyISO())) await Almacen.poner('bancos', b);
  }
  async function guardarBanco(b){
    Permisos.exigir('editarBancos');
    if (!String(b.nombre || '').trim()) throw new Error('Escriba el nombre del banco.');
    const r = Object.assign({ id:Util.uid('bco'), activo:true, productos:{}, orden:(S.bancos || []).length + 1 }, b);
    await Almacen.poner('bancos', r);
    await Auditoria.registrar('editar', 'banco', r.nombre);
    return banco(r.id);
  }
  async function borrarBanco(id){
    Permisos.exigir('editarBancos');
    const b = banco(id); if (!b) return;
    await Almacen.borrar('bancos', id);
    await Auditoria.registrar('borrar', 'banco', b.nombre);
  }

  /* ── Análisis ── */
  function contexto(c){
    const docs = documentos(c.id);
    return { hoy:Util.hoyISO(), docs:Coherencia.estado(c, docs), alertas:Coherencia.alertas(c, docs, S.parametros) };
  }
  /** Todas las opciones del cliente (el crédito que pidió, o todos los de su tipo si no ha elegido). */
  function opciones(c, prod){
    if (!c) return [];
    return Motor.opciones(c, bancos(), S.parametros, contexto(c), prod || (c.perfil || {}).producto || null);
  }
  /** La mejor opción del crédito que pidió el cliente. */
  function mejor(c){ return opciones(c)[0] || null; }
  function evaluar(c, bancoId, prod){
    const b = banco(bancoId); if (!b || !c) return null;
    return Motor.evaluar(c, b, prod, S.parametros, contexto(c));
  }

  /* ── Conceptos emitidos ── */
  function conceptos(clienteId){ return (S.conceptos || []).filter(k => !clienteId || k.clienteId === clienteId).sort((a, b) => a.fecha < b.fecha ? 1 : -1); }
  async function emitirConcepto(c, r, secciones){
    Permisos.exigir('emitirConcepto');
    const k = { id:Util.uid('con'), clienteId:c.id, cliente:c.nombre, bancoId:r.bancoId, banco:r.banco, producto:r.producto, productoNombre:r.productoNombre,
      dictamen:r.dictamen, puntaje:r.puntaje, cifras:r.cifras, criterios:r.criterios, secciones, perfil:Util.copia(c.perfil),
      fecha:new Date().toISOString(), usuario:Sesion.usuario ? Sesion.usuario.usuario : '', nombreUsuario:Sesion.usuario ? (Sesion.usuario.nombre || Sesion.usuario.usuario) : '',
      numero:'CV-' + Util.selloArchivo(Date.now()) + '-' + String(conceptos().length + 1).padStart(4, '0'), demo:!!c.demo };
    await Almacen.poner('conceptos', k);
    await Auditoria.registrar('emitir', 'concepto de viabilidad', k.numero + ' · ' + c.nombre + ' · ' + r.banco + ' · ' + Motor.dictamen(r.dictamen).n, c.id);
    return k;
  }

  return { clientes, cliente, activo, estado, abrir, guardarCliente, actualizarPerfil, borrarCliente,
    documentos, documento, guardarDocumento, borrarDocumento, bancos, banco, asegurarBancos, guardarBanco, borrarBanco,
    contexto, opciones, mejor, evaluar, conceptos, emitirConcepto };
})();
