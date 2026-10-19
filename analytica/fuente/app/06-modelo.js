/* ══════════════════════════════════════════════════════════════════════════
   MODELO — las operaciones del programa principal sobre los datos. Toda
   escritura exige su permiso, queda en la auditoría y pasa por Almacen.
   Las vistas leen de aquí y nunca escriben en S por su cuenta.
   ══════════════════════════════════════════════════════════════════════════ */
const Modelo = (function(){

  const ESTADOS = ['borrador','en revisión','emitido','cerrado para ofertas','abierto','en evaluación','en traslado','adjudicado','desierto','cancelado'];
  const CLASES_DOC = ['Planos','Estudios','Especificaciones','Modelos BIM','Licencia','Cronograma','Otros'];
  const DISCIPLINAS = ['Arquitectónica','Estructural','Hidrosanitaria','Eléctrica','Gas','Telecomunicaciones','Geotecnia','Topografía','Paisajismo','General'];

  /* ── Procesos ── */
  function proceso(id){ return (S.procesos||[]).find(p => p.id === id) || null; }
  function activo(){ return proceso(Sesion.procesoActivo); }
  function procesos(conArchivados){ return (S.procesos||[]).filter(p => conArchivados || !p.archivado).sort((a, b) => (a.creado < b.creado ? 1 : -1)); }
  /** Se edita en preparación y, después de emitir, solo mientras se prepara una adenda (versión n+1). */
  function editable(p){ return !!p && (p.estado === 'borrador' || p.estado === 'en revisión' || !!p.adendaEnCurso); }
  /** La versión del pliego que conocen los invitados: la emitida, aunque haya una adenda en preparación. */
  function versionVigente(p){ return p && p.emitido ? p.emitido.version : (p ? p.versionPliego : 1); }
  function exigirEditable(p){
    if (!editable(p)) throw new Error('El proceso ' + (p ? p.codigo : '') + ' ya fue emitido: su versión ' + (p ? p.versionPliego : '') + ' está congelada. Los cambios se hacen con una adenda (módulo 08).');
  }

  function procesoNuevo(d){
    const ahora = new Date().toISOString();
    return {
      id:Util.uid('pc'), codigo:d.codigo || '', nombre:d.nombre || 'Proceso sin nombre', objeto:d.objeto || '',
      modalidad:d.modalidad || 'invitación cerrada', tipoContrato:d.tipoContrato || 'precios unitarios',
      pais:d.pais || 'Colombia', moneda:d.moneda || 'COP', ciudad:d.ciudad || '', ubicacionObra:d.ubicacionObra || '',
      areaConstruida:Number(d.areaConstruida||0), plazoMaximoDias:Number(d.plazoMaximoDias||0),
      presupuestoOficialVisible:!!d.presupuestoOficialVisible, politicaApu:d.politicaApu || 'todas', puntajeTotal:1000,
      sobreCerrado:true, cronograma:Cronograma.nuevo(), estado:'borrador', versionPliego:1,
      responsable:d.responsable || (Sesion.usuario ? Sesion.usuario.nombre || Sesion.usuario.usuario : ''), comite:[],
      general:Pliego.generalPorDefecto(), confidencialidad:Confidencialidad.configPorDefecto(),
      pliego:{ generado:null, revisado:false }, creado:ahora, actualizado:ahora, archivado:false, demo:!!d.demo
    };
  }
  async function crearProceso(d){
    Permisos.exigir('crearProceso');
    if (!String(d.codigo||'').trim()) throw new Error('Escriba el código del proceso (por ejemplo LIC-2026-014).');
    if (procesos(true).some(p => Util.normaliza(p.codigo) === Util.normaliza(d.codigo))) throw new Error('Ya existe un proceso con el código ' + d.codigo + '.');
    const p = procesoNuevo(d);
    await Almacen.poner('procesos', p);
    await Almacen.poner('presupuestosBase', presupuestoVacio(p.id, 1, p.demo));
    await Almacen.poner('requisitos', { id:p.id + '@1', procesoId:p.id, version:1, demo:p.demo, lista:PlantillaCondiciones.anexoB() });
    await Auditoria.registrar('crear', 'proceso', p.codigo + ' · ' + p.nombre, p.id);
    return p;
  }
  async function guardarProceso(p, motivo){
    Permisos.exigir('editarProceso');
    const anterior = proceso(p.id);
    if (anterior && !editable(anterior) && !motivo) exigirEditable(anterior);
    p.actualizado = new Date().toISOString();
    await Almacen.poner('procesos', p);
    await Auditoria.registrar('editar', 'proceso', motivo || p.codigo, p.id);
  }
  async function duplicar(id, op){
    Permisos.exigir('crearProceso');
    const o = proceso(id); if (!o) throw new Error('No se encontró el proceso.');
    const p = procesoNuevo(Object.assign({}, o, { codigo:op.codigo, nombre:op.nombre || o.nombre + ' (copia)', demo:false }));
    Object.assign(p, { general:Util.copia(o.general), confidencialidad:Object.assign(Util.copia(o.confidencialidad), { aprobacion:null }),
      cronograma:Object.assign(Util.copia(o.cronograma), { hitos:o.cronograma.hitos.map(h => Object.assign({}, h, { fecha:'', hora:'' })) }) });
    if (procesos(true).some(x => Util.normaliza(x.codigo) === Util.normaliza(p.codigo))) throw new Error('Ya existe un proceso con el código ' + p.codigo + '.');
    await Almacen.poner('procesos', p);
    const pres = op.presupuesto ? Object.assign(Util.copia(presupuesto(o.id)), { id:p.id + '@1', procesoId:p.id, version:1, congelado:false, demo:false })
      : presupuestoVacio(p.id, 1);
    await Almacen.poner('presupuestosBase', pres);
    const req = op.condiciones ? Util.copia(requisitos(o.id)) : PlantillaCondiciones.anexoB();
    await Almacen.poner('requisitos', { id:p.id + '@1', procesoId:p.id, version:1, lista:req });
    if (op.documentos) for (const d of documentos(o.id)) await Almacen.poner('documentosProceso', Object.assign(Util.copia(d), { id:Util.uid('dc'), procesoId:p.id, demo:false }));
    await Auditoria.registrar('duplicar', 'proceso', o.codigo + ' → ' + p.codigo, p.id);
    return p;
  }
  async function archivar(id, archivado){
    Permisos.exigir('editarProceso');
    const p = proceso(id);
    p.archivado = archivado;
    await Almacen.poner('procesos', p);
    await Auditoria.registrar(archivado ? 'archivar' : 'desarchivar', 'proceso', p.codigo, p.id);
  }

  /* ── Presupuesto base (por proceso y versión) ── */
  function presupuestoVacio(procesoId, version, demo){
    return { id:procesoId + '@' + version, procesoId, version, congelado:false, demo:!!demo, capitulos:[], apus:[], insumos:[],
      aiu:{ a:0, i:0, u:0 }, iva:{ tarifa:19, base:'utilidad' } };
  }
  function presupuesto(procesoId, version){
    const p = proceso(procesoId);
    const v = version || (p ? p.versionPliego : 1);
    return (S.presupuestosBase||[]).find(x => x.procesoId === procesoId && x.version === v) || null;
  }
  async function guardarPresupuesto(pres, detalle){
    Permisos.exigir('editarPresupuesto');
    const p = proceso(pres.procesoId);
    exigirEditable(p);
    if (pres.congelado) throw new Error('Este presupuesto está congelado.');
    Calculo.invalidar(pres);
    await Almacen.poner('presupuestosBase', pres);
    Calculo.invalidar(presupuesto(pres.procesoId));
    if (p.pliego && p.pliego.revisado){ p.pliego.revisado = false; await Almacen.poner('procesos', p); }
    await Auditoria.registrar('editar', 'presupuesto base', detalle || 'cambio', pres.procesoId);
  }

  /* ── Condiciones ── */
  function registroRequisitos(procesoId){ const p = proceso(procesoId); return (S.requisitos||[]).find(x => x.procesoId === procesoId && x.version === (p ? p.versionPliego : 1)) || null; }
  function requisitos(procesoId){ const r = registroRequisitos(procesoId); return r ? r.lista : []; }
  function requisitosVersion(procesoId, version){ const r = (S.requisitos||[]).find(x => x.procesoId === procesoId && x.version === version); return r ? r.lista : []; }
  async function guardarRequisitos(procesoId, lista, detalle){
    Permisos.exigir('editarCondiciones');
    exigirEditable(proceso(procesoId));
    const r = registroRequisitos(procesoId) || { id:procesoId + '@1', procesoId, version:1 };
    r.lista = lista;
    await Almacen.poner('requisitos', r);
    await Auditoria.registrar('editar', 'condiciones de la oferta', detalle || '', procesoId);
  }

  /* ── Documentos del proceso ── */
  function documentos(procesoId, todos){
    return (S.documentosProceso||[]).filter(d => d.procesoId === procesoId && (todos || d.vigente !== false));
  }

  /** Documento del proceso: { id, procesoId, nombre, clase, disciplina, version, sha256, peso,
      visibleParaProponentes, vigente, enlace, enlaceVerificado, reemplazaA, fecha, usuario, notas }.
      Una versión nueva no borra la anterior: la marca no vigente. */
  async function guardarDocumento(d, detalle){
    Permisos.exigir('editarDocumentos');
    exigirEditable(proceso(d.procesoId));
    if (!d.nombre) throw new Error('El documento necesita un nombre.');
    if (d.enlace && !/^https:\/\//i.test(Util.enlaceSeguro(d.enlace))) throw new Error('El enlace debe empezar por https://.');
    if (!d.enlace && !/^[0-9a-f]{64}$/.test(String(d.sha256||''))) throw new Error('El documento no tiene huella SHA-256.');
    d.fecha = d.fecha || new Date().toISOString(); d.usuario = d.usuario || Sesion.usuario.usuario;
    await Almacen.poner('documentosProceso', d);
    await Auditoria.registrar('guardar', 'documento del proceso', d.nombre + ' v' + (d.version||1) + (d.sha256 ? ' · ' + d.sha256 : ' · enlace') + (detalle ? ' · ' + detalle : ''), d.procesoId);
  }
  async function quitarDocumento(d){
    Permisos.exigir('editarDocumentos');
    exigirEditable(proceso(d.procesoId));
    await Almacen.borrar('documentosProceso', d.id);
    const usado = (S.documentosProceso||[]).some(x => x.sha256 && x.sha256 === d.sha256);
    if (d.sha256 && !usado) await Almacen.borrarArchivo(d.sha256);
    await Auditoria.registrar('quitar', 'documento del proceso', d.nombre + ' v' + (d.version||1), d.procesoId);
  }

  /* ── Invitados ── */
  function invitados(procesoId){ return (S.invitados||[]).filter(i => i.procesoId === procesoId); }
  async function guardarInvitado(inv, detalle){
    Permisos.exigir('gestionarInvitados');
    if (!inv.razonSocial) throw new Error('Escriba la razón social.');
    const col = Util.normaliza(inv.pais || 'Colombia') === 'colombia';
    if (col && !Nit.valido(inv.nit, inv.dv)) throw new Error('El NIT ' + Nit.formatear(inv.nit) + ' no corresponde al dígito de verificación ' + inv.dv + ' (el correcto es ' + Nit.digitoVerificacion(inv.nit) + ').');
    if (invitados(inv.procesoId).some(x => x.id !== inv.id && Nit.limpiar(x.nit) === Nit.limpiar(inv.nit) && Nit.limpiar(inv.nit)))
      throw new Error('Ya hay un invitado con el NIT ' + Nit.formatear(inv.nit) + ' en este proceso.');
    if (!inv.codigoInvitacion) inv.codigoInvitacion = codigoUnico();
    await Almacen.poner('invitados', inv);
    await Auditoria.registrar('guardar', 'invitado', inv.razonSocial + ' · ' + (detalle || ''), inv.procesoId);
  }
  async function retirarInvitado(inv, motivo){
    Permisos.exigir('gestionarInvitados');
    inv.estado = 'retirado'; inv.retirado = { fecha:new Date().toISOString(), motivo:motivo || '' };
    await Almacen.poner('invitados', inv);
    await Auditoria.registrar('retirar', 'invitado', inv.razonSocial + (motivo ? ' · ' + motivo : ''), inv.procesoId);
  }
  function codigoUnico(){
    let c;
    do { c = Util.codigoInvitacion(); } while ((S.invitados||[]).some(i => i.codigoInvitacion === c));
    return c;
  }

  /* ── Confidencialidad ── */
  function smmlvVigente(){
    const anio = new Date().getFullYear();
    return Parametros.smmlv(S.parametros, anio) || Parametros.smmlv(S.parametros, anio - 1);
  }
  function contextoConfidencialidad(p, invitado){
    const pres = presupuesto(p.id);
    return { proceso:p, empresa:S.empresa, config:p.confidencialidad, smmlv:smmlvVigente(),
      presupuestoOficial:pres ? Calculo.totales(pres).total : 0, invitado:datosInvitadoAcuerdo(invitado) };
  }
  /** Los datos del invitado con los nombres que usa la plantilla del acuerdo. */
  function datosInvitadoAcuerdo(i){
    if (!i) return null;
    return { razonSocial:i.razonSocial, nit:i.nit ? Nit.formatear(i.nit, i.dv) : '', domicilio:i.ciudad || '', direccion:i.direccion || '',
      correo:(i.contacto||{}).correo || '', representante:i.representante || '', documentoRepresentante:i.documentoRepresentante || '' };
  }
  function estadoConfidencialidad(p){ return Confidencialidad.estado(contextoConfidencialidad(p)); }
  async function guardarConfidencialidad(p, cfg, detalle){
    Permisos.exigir('editarConfidencialidad');
    exigirEditable(p);
    p.confidencialidad = cfg;
    await Almacen.poner('procesos', p);
    await Auditoria.registrar('editar', 'acuerdo de confidencialidad', detalle || '', p.id);
  }
  async function aprobarConfidencialidad(p, datos){
    Permisos.exigir('aprobarConfidencialidad');
    exigirEditable(p);
    if (!datos.nombre || !datos.tarjetaProfesional || !datos.fecha) throw new Error('Escriba el nombre del abogado, su tarjeta profesional y la fecha.');
    const ctx = contextoConfidencialidad(p);
    const falta = Confidencialidad.faltantes(ctx);
    if (falta.length) throw new Error('El acuerdo tiene valores sin diligenciar: ' + falta.join(', ') + '. Complételos antes de aprobar.');
    const texto = Confidencialidad.textoParaAprobar(ctx);
    p.confidencialidad.aprobacion = { nombre:datos.nombre, tarjetaProfesional:datos.tarjetaProfesional, fecha:datos.fecha,
      usuario:Sesion.usuario.usuario, registrado:new Date().toISOString(), texto, huella:await Cripto.sha256(texto) };
    await Almacen.poner('procesos', p);
    await Auditoria.registrar('aprobar', 'acuerdo de confidencialidad', 'Aprobado por ' + datos.nombre + ', T.P. ' + datos.tarjetaProfesional + ' · huella ' + p.confidencialidad.aprobacion.huella, p.id);
  }

  /* ── Llaves ── */
  function llaves(procesoId){ return (S.llaves||[]).find(l => l.id === procesoId) || null; }
  async function crearLlaves(p, frase){
    Permisos.exigir('crearLlaves');
    exigirEditable(p);
    if (llaves(p.id)) throw new Error('Este proceso ya tiene llaves. Por seguridad no se reemplazan.');
    const r = await Cripto.crearLlaves(frase, p.codigo);
    r.id = p.id; r.procesoId = p.id; r.demo = !!p.demo;
    await Almacen.poner('llaves', r);
    await Auditoria.registrar('crear', 'llaves del proceso', 'Huella de las públicas ' + r.huellaPublicas, p.id);
    return r;
  }
  async function marcarRespaldoLlaves(p, campo){
    const r = llaves(p.id);
    r.respaldo = Object.assign({}, r.respaldo, { [campo]:true, [campo + 'En']:new Date().toISOString() });
    await Almacen.poner('llaves', r);
    await Auditoria.registrar(campo === 'descargado' ? 'descargar' : 'confirmar', 'respaldo de llaves', campo, p.id);
  }

  /* ── Revisión y emisión ── */
  function pliegoVigente(p){
    const g = p.pliego && p.pliego.generado;
    return !!(g && g.huellaContenido === Pliego.huellaContenido(Pliego.bloques(contextoPliego(p))));
  }
  function contextoPliego(p){
    return { proceso:p, empresa:S.empresa, presupuesto:presupuesto(p.id), requisitos:requisitos(p.id), documentos:documentos(p.id), versionPliego:p.versionPliego };
  }
  function revision(p){
    return Revision.revisar({ proceso:p, presupuesto:presupuesto(p.id), requisitos:requisitos(p.id), documentos:documentos(p.id),
      invitados:invitados(p.id), estadoConfidencialidad:estadoConfidencialidad(p), llaves:llaves(p.id),
      pliego:{ generado:pliegoVigente(p), revisado:pliegoVigente(p) && !!(p.pliego && p.pliego.revisado) } });
  }
  async function emitir(p){
    Permisos.exigir('emitir');
    exigirEditable(p);
    const lista = revision(p);
    if (!Revision.listo(lista)) throw new Error('No se puede emitir: hay ' + lista.filter(x => !x.ok).length + ' punto(s) de la revisión en rojo.');
    const pres = presupuesto(p.id);
    pres.congelado = true;
    await Almacen.poner('presupuestosBase', pres);
    const req = registroRequisitos(p.id); req.congelado = true; await Almacen.poner('requisitos', req);
    p.estado = 'emitido';
    p.emitido = { fecha:new Date().toISOString(), usuario:Sesion.usuario.usuario, version:p.versionPliego, huellaPliego:p.pliego.generado.sha256 };
    await Almacen.poner('procesos', p);
    await Auditoria.registrar('emitir', 'proceso', p.codigo + ' versión ' + p.versionPliego + ' · pliego ' + p.pliego.generado.sha256, p.id);
  }

  /* ── Base de precios de la EMPRESA PRINCIPAL ── */
  async function guardarInsumoBase(ins, precioNuevo, fuente, detalle){
    Permisos.exigir('editarBasePrecios');
    const ahora = new Date().toISOString();
    if (!ins.id) ins.id = Util.uid('bp');
    ins.historial = ins.historial || [];
    if (precioNuevo !== undefined && precioNuevo !== null && (ins.precio === undefined || Math.abs(Number(ins.precio) - precioNuevo) >= 0.0005 || !ins.historial.length)){
      ins.historial.push({ fecha:ahora, precio:precioNuevo, fuente:fuente || 'manual', usuario:Sesion.usuario.usuario, anterior:ins.precio === undefined ? null : ins.precio });
      ins.precio = precioNuevo; ins.fecha = ahora; ins.fuente = fuente || 'manual';
    }
    await Almacen.poner('basePrecios', ins);
    await Auditoria.registrar('guardar', 'base de precios', ins.nombre + ' · ' + money3(ins.precio) + ' · ' + (fuente||'manual') + (detalle ? ' · ' + detalle : ''));
  }

  /* ── Demostración ── */
  function hayDemo(){ return (S.procesos||[]).some(p => p.demo) || !!S.empresa.demo; }
  async function cargarDemo(){
    Permisos.exigir('demostracion');
    let codigo = 'DEMO-2026-001', n = 1;
    while (procesos(true).some(p => p.codigo === codigo)){ n++; codigo = 'DEMO-2026-' + String(n).padStart(3,'0'); }
    if (!S.empresa.razonSocial){
      await Almacen.guardarEmpresa(Object.assign({}, Demo.EMPRESA, { dv:Nit.digitoVerificacion(Demo.EMPRESA.nit), demo:true }));
    }
    const p = await crearProceso({ codigo, nombre:'Casa campestre en El Retiro (DEMOSTRACIÓN)', demo:true,
      objeto:'Construcción de una casa campestre de dos niveles, con estructura en concreto, cubierta metálica y acabados de alta gama.',
      modalidad:'invitación cerrada', tipoContrato:'precios unitarios', ciudad:'El Retiro, Antioquia', ubicacionObra:'Vereda ficticia, lote de demostración',
      areaConstruida:620, plazoMaximoDias:300, politicaApu:'todas' });
    const pres = Object.assign(presupuesto(p.id), Demo.presupuesto());
    await Almacen.poner('presupuestosBase', pres);
    p.cronograma = Cronograma.proponer(p.cronograma, Festivos.sumarDias(Util.hoyISO(), 3, true));
    await Almacen.poner('procesos', p);
    for (const inv of Demo.invitados(p.id)) await Almacen.poner('invitados', inv);
    await Auditoria.registrar('cargar', 'demostración', codigo, p.id);
    return p;
  }
  /** Borra todo lo marcado como demostración, incluidos sus archivos. */
  async function borrarDemo(){
    Permisos.exigir('demostracion');
    const ids = new Set((S.procesos||[]).filter(p => p.demo).map(p => p.id));
    for (const n of ['presupuestosBase','requisitos','invitados','documentosProceso','llaves','preguntas','adendas','sobres','ofertas','documentosOferta','actas','evaluaciones','subsanaciones','alertas','conceptos','informes']){
      for (const r of (S[n]||[]).filter(x => ids.has(x.procesoId) || x.demo)) await Almacen.borrar(n, r.id);
    }
    for (const id of ids) await Almacen.borrar('procesos', id);
    const usados = new Set((S.documentosProceso||[]).map(d => d.sha256).concat((S.documentosOferta||[]).map(d => d.sha256), (S.sobres||[]).map(s => s.sha256),
      (S.actas||[]).flatMap(a => [a.sha256Pdf, a.sha256Json]), (S.adendas||[]).flatMap(a => [a.sha256Pdf, a.sha256Json]),
      (S.procesos||[]).map(p => p.pliego && p.pliego.generado && p.pliego.generado.sha256), (S.invitados||[]).map(i => (i.confidencialidad||{}).sha256), (S.subsanaciones||[]).map(x => x.sha256Pdf), (S.informes||[]).flatMap(x => [x.sha256Pdf, x.sha256Xlsx])).filter(Boolean));
    for (const a of await Almacen.listaArchivos()) if (!usados.has(a.sha256)) await Almacen.borrarArchivo(a.sha256);
    if (S.empresa.demo) await Almacen.guardarEmpresa({});
    if (ids.has(Sesion.procesoActivo)) Sesion.procesoActivo = null;
    await Auditoria.registrar('borrar', 'demostración', ids.size + ' proceso(s) de demostración');
  }

  return { ESTADOS, CLASES_DOC, DISCIPLINAS, proceso, activo, procesos, editable, exigirEditable, crearProceso, guardarProceso,
    duplicar, archivar, presupuesto, presupuestoVacio, guardarPresupuesto, requisitos, requisitosVersion, versionVigente, guardarRequisitos, documentos, guardarDocumento, quitarDocumento, invitados,
    guardarInvitado, retirarInvitado, codigoUnico, smmlvVigente, contextoConfidencialidad, estadoConfidencialidad, guardarConfidencialidad,
    aprobarConfidencialidad, llaves, crearLlaves, marcarRespaldoLlaves, contextoPliego, pliegoVigente, revision, emitir,
    guardarInsumoBase, hayDemo, cargarDemo, borrarDemo };
})();
