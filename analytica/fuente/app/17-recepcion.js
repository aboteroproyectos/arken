/* ══════════════════════════════════════════════════════════════════════════
   RECEPCIÓN, CIERRE Y APERTURA (§16, §17.2).
   · Recibir: tantos sobres como proponentes, a la vez. Cada uno se lee en el
     orden de §16 y se asigna a su invitado por el código de invitación, nunca
     por el nombre del archivo. Nada se descifra ni se abre al recibir: solo se
     comprueban el ZIP, la cabecera y las huellas. De cada invitado vale el
     último sobre generado antes del cierre; los demás quedan «reemplazado».
   · Cerrar: a la hora de cierre, el acta de cierre con la lista de sobres.
   · Abrir: después del cierre, con la frase del proceso y dos miembros del
     comité autenticados en el momento. Se descifra todo a la vez, se
     verifica cada adjunto, se recalculan los totales y sale el acta de
     apertura, que queda inmutable.
   ══════════════════════════════════════════════════════════════════════════ */
const Recepcion = (function(){

  const COLORES = ['#3C5A76','#A98B54','#3B6E52','#96362E','#6B4E8A','#9A6B1E','#2F7C86','#8A6E4B','#B0555E','#4E6B2F','#5A5F66','#C07A2C'];
  function colorDe(p, invitadoId){ const i = Modelo.invitados(p.id).findIndex(x => x.id === invitadoId); return COLORES[(i < 0 ? 0 : i) % COLORES.length]; }

  function sobres(procesoId){ return (S.sobres||[]).filter(s => s.procesoId === procesoId).sort((a, b) => a.recibido < b.recibido ? -1 : 1); }
  function vigentes(procesoId){ return sobres(procesoId).filter(s => s.tipo === 'oferta' && s.estado === 'recibido sellado'); }
  function ofertas(procesoId){ return (S.ofertas||[]).filter(o => o.procesoId === procesoId); }
  function actas(procesoId, tipo){ return (S.actas||[]).filter(a => a.procesoId === procesoId && (!tipo || a.tipo === tipo)); }
  function documentos(ofertaId){ return (S.documentosOferta||[]).filter(d => d.ofertaId === ofertaId); }
  function cierre(p){ const h = Cronograma.hito(p.cronograma, 'cierre'); return h && h.fecha ? Cronograma.instante(h) : null; }
  function cerrado(p, ahora){ const c = cierre(p); return !!c && (ahora || Date.now()) >= new Date(c).getTime(); }

  function entradas(zip){
    const L = [];
    zip.forEach((ruta, f) => L.push({ nombre:f.unsafeOriginalName || ruta, dir:f.dir, descomprimido:f._data && f._data.uncompressedSize, comprimido:f._data && f._data.compressedSize, f }));
    return L;
  }

  /** Lee un sobre en el orden de §16 y devuelve el registro que se guarda. */
  async function leer(p, file){
    const sha256 = await Archivos.huella(file);
    const reg = { id:Util.uid('so'), procesoId:p.id, demo:!!p.demo, invitadoId:null, archivo:file.name, sha256, peso:file.size, recibido:new Date().toISOString(),
      usuario:Sesion.usuario.usuario, tipo:'oferta', cifrado:false, versionPliego:null, generado:null, estado:'rechazado', motivo:'', avisos:[], versionAnterior:false };
    const rechazo = m => Object.assign(reg, { motivo:m });
    let zip;
    try { zip = await JSZip.loadAsync(file); } catch(e){ return rechazo('No es un archivo ZIP legible.'); }
    const es = entradas(zip);
    const malo = Sobre.revisarZip(es);
    if (malo) return rechazo(malo);
    const fc = zip.file('sobre.json');
    let cab = null;
    if (fc){ try { cab = JSON.parse(await fc.async('string')); } catch(e){ return rechazo('sobre.json no es un JSON válido.'); } }
    const lista = [];
    for (const e of es){ if (!e.dir && e.nombre !== 'sobre.json') lista.push({ ruta:e.nombre, sha256:await Cripto.sha256(await e.f.async('uint8array')) }); }
    const v = Sobre.validarCabecera(cab, { codigoProceso:p.codigo, invitados:Modelo.invitados(p.id), versionVigente:Modelo.versionVigente(p), cierre:cierre(p),
      nombreArchivo:file.name, sha256Calculado:await Sobre.huellaContenido(lista) });
    if (cab){ Object.assign(reg, { tipo:cab.tipo === 'confidencialidad' ? 'confidencialidad' : 'oferta', cifrado:!!cab.cifrado, versionPliego:cab.versionPliego, generado:cab.generado, cabecera:cab }); }
    reg.avisos = v.avisos; reg.versionAnterior = v.versionAnterior;
    if (v.invitado) reg.invitadoId = v.invitado.id;
    if (!v.ok) return rechazo(v.motivo);
    if (reg.tipo === 'oferta' && reg.cifrado && !(zip.file('oferta.cifrada') && zip.file('llave.envuelta'))) return rechazo('El sobre dice estar cerrado y no trae oferta.cifrada y llave.envuelta.');
    if (reg.tipo === 'oferta' && !reg.cifrado && !zip.file('oferta.json')) return rechazo('El sobre no trae oferta.json.');
    if (reg.tipo === 'oferta' && !reg.cifrado && p.sobreCerrado !== false) reg.avisos.push('El proceso exige sobre cerrado y este llegó sin cifrar.');
    reg.estado = reg.tipo === 'confidencialidad' ? 'recibido' : 'recibido sellado';
    reg.zip = zip;
    return reg;
  }

  /** El sobre de confidencialidad: deja el acuerdo firmado en el invitado, para verificar sus facultades. */
  async function recibirConfidencialidad(p, reg){
    const z = reg.zip;
    const cj = z.file('confidencialidad.json');
    if (!cj) return Object.assign(reg, { estado:'rechazado', motivo:'El sobre de confidencialidad no trae confidencialidad.json.' });
    let o; try { o = JSON.parse(await cj.async('string')); } catch(e){ return Object.assign(reg, { estado:'rechazado', motivo:'confidencialidad.json no es un JSON válido.' }); }
    const acuerdo = (o.adjuntos||[]).find(x => x.requisito === 'ACUERDO') || (o.adjuntos||[])[0];
    if (!acuerdo || !z.file(acuerdo.ruta)) return Object.assign(reg, { estado:'rechazado', motivo:'El sobre de confidencialidad no trae el acuerdo firmado.' });
    const bytes = await z.file(acuerdo.ruta).async('uint8array');
    if (await Cripto.sha256(bytes) !== acuerdo.sha256) return Object.assign(reg, { estado:'rechazado', motivo:'El acuerdo firmado no coincide con su huella.' });
    const js = Sobre.pdfConScript(bytes);
    if (js) return Object.assign(reg, { estado:'rechazado', motivo:'El acuerdo firmado ' + js + ': no se recibe.' });
    await Almacen.ponerArchivo(acuerdo.sha256, new Blob([bytes], { type:'application/pdf' }));
    const inv = Util.copia(Modelo.invitados(p.id).find(i => i.id === reg.invitadoId));
    const pr = o.proponente || {};
    inv.confidencialidad = Object.assign({}, inv.confidencialidad, { estado:'firmado', sha256:acuerdo.sha256, nombreArchivo:acuerdo.nombre, peso:bytes.length,
      firmante:pr.representante || '', documentoFirmante:pr.documentoRepresentante || '', calidad:'Representante legal', fecha:String(o.generado||'').slice(0, 10),
      facultades:false, sobreId:reg.id, registrado:new Date().toISOString(), usuario:Sesion.usuario.usuario });
    await Modelo.guardarInvitado(inv, 'sobre de confidencialidad recibido · ' + acuerdo.sha256);
    return reg;
  }

  /** De cada invitado vale el último sobre generado antes del cierre. */
  async function ordenarVigentes(p){
    const porInv = new Map();
    sobres(p.id).filter(s => s.tipo === 'oferta' && (s.estado === 'recibido sellado' || s.estado === 'reemplazado')).forEach(s => {
      const L = porInv.get(s.invitadoId) || []; L.push(s); porInv.set(s.invitadoId, L);
    });
    for (const L of porInv.values()){
      L.sort((a, b) => a.generado < b.generado ? -1 : 1);
      for (let i = 0; i < L.length; i++){
        const est = i === L.length - 1 ? 'recibido sellado' : 'reemplazado';
        if (L[i].estado !== est) await Almacen.poner('sobres', Object.assign(Util.copia(L[i]), { estado:est }));
      }
    }
  }

  /** Recibe muchos sobres a la vez. Devuelve el resumen de cada archivo. */
  async function recibir(p, files){
    Permisos.exigir('recibirOfertas');
    if (!p.emitido) throw new Error('El proceso no se ha emitido: aún no recibe sobres.');
    if (actas(p.id, 'apertura').length) throw new Error('La apertura ya se hizo: no se reciben más sobres.');
    const resumen = [];
    for (const f of files){
      let reg;
      try {
        reg = await leer(p, f);
        if (sobres(p.id).some(s => s.sha256 === reg.sha256)){ resumen.push({ archivo:f.name, estado:'repetido', motivo:'Este mismo archivo ya se había recibido.' }); continue; }
        if (reg.estado !== 'rechazado' && reg.tipo === 'confidencialidad') await recibirConfidencialidad(p, reg);
      } catch(e){
        RegistroTecnico.anotar('recibir sobre', e);
        reg = reg || { id:Util.uid('so'), procesoId:p.id, demo:!!p.demo, invitadoId:null, archivo:f.name, sha256:'', peso:f.size, recibido:new Date().toISOString(), usuario:Sesion.usuario.usuario, tipo:'oferta', avisos:[] };
        Object.assign(reg, { estado:'rechazado', motivo:'No se pudo leer: ' + e.message });
      }
      delete reg.zip;
      if (reg.estado !== 'rechazado') await Almacen.ponerArchivo(reg.sha256, f);
      await Almacen.poner('sobres', reg);
      const inv = Modelo.invitados(p.id).find(i => i.id === reg.invitadoId);
      await Auditoria.registrar('recibir', reg.tipo === 'confidencialidad' ? 'sobre de confidencialidad' : 'sobre de oferta', f.name + ' · ' + (inv ? inv.razonSocial : 'sin invitado') + ' · ' + reg.estado + (reg.motivo ? ' · ' + reg.motivo : '') + ' · ' + reg.sha256, p.id);
      resumen.push({ archivo:f.name, estado:reg.estado, motivo:reg.motivo, avisos:reg.avisos, invitado:inv ? inv.razonSocial : '' });
    }
    await ordenarVigentes(p);
    return resumen;
  }

  /* ── Cierre ── */
  async function actaCierre(p){
    Permisos.exigir('recibirOfertas');
    if (!cerrado(p)) throw new Error('El cierre es el ' + Util.fmtSello(cierre(p)) + ': el acta de cierre se genera a esa hora.');
    if (actas(p.id, 'cierre').length) throw new Error('El acta de cierre ya se generó.');
    const fecha = new Date().toISOString();
    const lista = sobres(p.id).filter(s => s.tipo === 'oferta').map(s => {
      const inv = Modelo.invitados(p.id).find(i => i.id === s.invitadoId);
      return { proponente:inv ? inv.razonSocial : '', archivo:s.archivo, sha256:s.sha256, recibido:s.recibido, estado:s.estado, motivo:s.motivo };
    });
    const pdf = Pdf.generar({ titulo:'', documento:'Acta de cierre ' + p.codigo, lineaIzquierda:'Proceso: ' + p.codigo + ' · ' + p.nombre, marcaAgua:p.demo ? 'DEMOSTRACIÓN' : '', orientacion:'l',
      bloques:Actas.cierre({ proceso:p, empresa:S.empresa, cierre:cierre(p), sobres:lista, usuario:Sesion.usuario.nombre || Sesion.usuario.usuario, fecha }) }).blob;
    const sha256Pdf = await Archivos.huella(pdf);
    await Almacen.ponerArchivo(sha256Pdf, pdf);
    await Almacen.poner('actas', { id:Util.uid('ac'), procesoId:p.id, demo:!!p.demo, tipo:'cierre', fecha, usuario:Sesion.usuario.usuario, sobres:lista, sha256Pdf, inmutable:true });
    p.estado = 'cerrado para ofertas';
    await Modelo.guardarProceso(p, 'Acta de cierre · ' + lista.filter(s => s.estado === 'recibido sellado').length + ' sobre(s) vigente(s) · ' + sha256Pdf);
    return { pdf, nombre:'Acta_de_cierre_' + Util.codigoArchivo(p.codigo) + '.pdf' };
  }

  /* ── Apertura ── */
  /** Los dos (o más) miembros del comité, autenticados en el momento. */
  async function autenticarComite(firmantes){
    const vistos = new Set(), L = [];
    for (const f of firmantes){
      const u = await Usuarios.ingresar(f.usuario, f.clave);
      if (!u) throw new Error('Usuario o contraseña incorrectos para «' + f.usuario + '».');
      if ((u.roles||[]).indexOf('comite') < 0) throw new Error(u.usuario + ' no tiene el rol Comité.');
      if (vistos.has(u.id)) throw new Error('Los miembros del comité deben ser personas distintas.');
      vistos.add(u.id);
      L.push({ nombre:f.nombre || u.nombre || u.usuario, cargo:f.cargo || u.cargo || '', usuario:u.usuario, fecha:new Date().toISOString() });
    }
    if (L.length < 2) throw new Error('La apertura exige al menos dos miembros del comité.');
    return L;
  }
  /** Abre un sobre vigente: descifra, verifica cada adjunto y recalcula. */
  async function abrirUno(p, s, llaves){
    const inv = Modelo.invitados(p.id).find(i => i.id === s.invitadoId);
    const blob = await Almacen.leerArchivo(s.sha256);
    if (!blob) throw new Error('el archivo del sobre no está en este equipo');
    if (await Archivos.huella(blob) !== s.sha256) throw new Error('el archivo guardado ya no coincide con la huella con que se recibió (fue alterado)');
    const z = await JSZip.loadAsync(blob);
    let interno = z;
    if (s.cifrado){
      const env = JSON.parse(await z.file('llave.envuelta').async('string'));
      const claro = await Cripto.abrirSobre(llaves.cifrado, env, await z.file('oferta.cifrada').async('uint8array'));
      interno = await JSZip.loadAsync(claro);
      const malo = Sobre.revisarZip(entradas(interno));
      if (malo) throw new Error(malo);
    }
    const fo = interno.file('oferta.json');
    if (!fo) throw new Error('no trae oferta.json');
    const of = Sobre.leerOferta(await fo.async('string'));
    if (Util.codigoArchivo(of.proceso) !== Util.codigoArchivo(p.codigo)) throw new Error('oferta.json es del proceso ' + of.proceso);
    const novedades = (s.avisos||[]).slice();
    const oferta = { id:Util.uid('of'), procesoId:p.id, demo:!!p.demo, invitadoId:s.invitadoId, sobreId:s.id, versionPliego:s.versionPliego, abierta:new Date().toISOString(),
      proponente:of.proponente, consorcio:of.consorcio || null, oferta:of };
    const declarados = new Set();
    let docs = 0;
    for (const a of of.adjuntos){
      declarados.add(a.ruta);
      const f = a.ruta && interno.file(a.ruta);
      if (!f){ novedades.push('Falta el adjunto «' + a.nombre + '» (' + a.requisito + ').'); continue; }
      const bytes = await f.async('uint8array');
      const sha = await Cripto.sha256(bytes);
      if (sha !== a.sha256){ novedades.push('El adjunto «' + a.nombre + '» (' + a.requisito + ') no coincide con su huella.'); continue; }
      const js = Sobre.pdfConScript(bytes);
      if (js){ novedades.push('El adjunto «' + a.nombre + '» (' + a.requisito + ') ' + js + ': no se abre.'); continue; }
      await Almacen.ponerArchivo(sha, new Blob([bytes], { type:Archivos.extension(a.nombre) === 'pdf' ? 'application/pdf' : '' }));
      const req = Modelo.requisitosVersion(p.id, s.versionPliego).find(r => r.codigo === a.requisito);
      await Almacen.poner('documentosOferta', { id:Util.uid('do'), ofertaId:oferta.id, procesoId:p.id, invitadoId:s.invitadoId, demo:!!p.demo, requisito:a.requisito,
        grupo:req ? req.grupo : (a.requisito === 'ACUERDO' ? 'Jurídico' : 'Otro'), nombreRequisito:req ? req.nombre : a.requisito, fila:a.fila, columna:a.columna,
        nombre:a.nombre, ruta:a.ruta, sha256:sha, peso:bytes.length, fechaDocumento:a.fechaDocumento || '', vigenteHasta:a.vigenteHasta || '', estado:'sin verificar' });
      docs++;
    }
    interno.forEach((ruta, f) => { if (!f.dir && ruta !== 'oferta.json' && !declarados.has(ruta)) novedades.push('El archivo «' + ruta + '» no está declarado en oferta.json: no se tiene en cuenta.'); });
    const formulario = Paquete.formulario(Modelo.presupuesto(p.id, s.versionPliego) || Modelo.presupuesto(p.id), p.politicaApu);
    const rc = Sobre.recalcular(of, formulario);
    if (rc.diferencias.length) novedades.push(rc.diferencias.length + ' actividad(es) con precio unitario declarado distinto del recalculado.');
    if (rc.diferenciasTotales.length) novedades.push('Total declarado ' + Util.money(rc.totalDeclarado) + ' y recalculado ' + Util.money(rc.totales.total) + '.');
    if (rc.faltantes.length) novedades.push(rc.faltantes.length + ' actividad(es) sin precio.');
    if (rc.sobrantes.length) novedades.push(rc.sobrantes.length + ' actividad(es) que no están en el pliego.');
    oferta.recalculo = { totales:rc.totales, totalDeclarado:rc.totalDeclarado, diferencias:rc.diferencias, diferenciasTotales:rc.diferenciasTotales, faltantes:rc.faltantes, sobrantes:rc.sobrantes };
    oferta.novedades = novedades;
    oferta.documentos = docs;
    await Almacen.poner('ofertas', oferta);
    await Almacen.poner('sobres', Object.assign(Util.copia(s), { estado:'abierto', ofertaId:oferta.id }));
    return { proponente:inv ? inv.razonSocial : of.proponente.razonSocial, declarado:rc.totalDeclarado, recalculado:rc.totales.total, documentos:docs, novedades };
  }
  /** La apertura de §17.2. firmantes = [{ usuario, clave, nombre, cargo }]. */
  async function abrir(p, frase, firmantes){
    Permisos.exigir('abrirOfertas');
    if (!cerrado(p)) throw new Error('No se abre ningún sobre antes del cierre (' + Util.fmtSello(cierre(p)) + '). Este equipo marca ' + Util.fmtSello(Date.now()) + '.');
    if (!actas(p.id, 'cierre').length) throw new Error('Genere primero el acta de cierre.');
    if (actas(p.id, 'apertura').length) throw new Error('La apertura ya se hizo.');
    const quienes = await autenticarComite(firmantes);
    let llaves;
    try { llaves = await Cripto.abrirLlaves(Modelo.llaves(p.id), frase); } catch(e){ throw new Error('La frase del proceso no es correcta.'); }
    const filas = [], rechazados = [];
    for (const s of vigentes(p.id)){
      try { filas.push(await abrirUno(p, s, llaves)); }
      catch(e){
        RegistroTecnico.anotar('apertura', e);
        const inv = Modelo.invitados(p.id).find(i => i.id === s.invitadoId);
        rechazados.push({ proponente:inv ? inv.razonSocial : '', archivo:s.archivo, motivo:e.message });
        await Almacen.poner('sobres', Object.assign(Util.copia(s), { estado:'no se pudo abrir', motivo:e.message }));
      }
    }
    const fecha = new Date().toISOString();
    const pdf = Pdf.generar({ titulo:'', documento:'Acta de apertura ' + p.codigo, lineaIzquierda:'Proceso: ' + p.codigo + ' · ' + p.nombre, marcaAgua:p.demo ? 'DEMOSTRACIÓN' : '', orientacion:'l',
      bloques:Actas.apertura({ proceso:p, empresa:S.empresa, fecha, filas, rechazados, firmantes:quienes }) }).blob;
    const sha256Pdf = await Archivos.huella(pdf);
    await Almacen.ponerArchivo(sha256Pdf, pdf);
    await Almacen.poner('actas', { id:Util.uid('ac'), procesoId:p.id, demo:!!p.demo, tipo:'apertura', fecha, usuario:Sesion.usuario.usuario, firmantes:quienes, filas, rechazados, sha256Pdf, inmutable:true });
    p.estado = 'abierto';
    await Modelo.guardarProceso(p, 'Apertura de ofertas · ' + filas.length + ' abierta(s) · ' + rechazados.length + ' sin abrir · acta ' + sha256Pdf);
    await Auditoria.registrar('abrir', 'ofertas', filas.length + ' oferta(s) · comité ' + quienes.map(q => q.usuario).join(', ') + ' · acta ' + sha256Pdf, p.id);
    return { pdf, nombre:'Acta_de_apertura_' + Util.codigoArchivo(p.codigo) + '.pdf', filas, rechazados };
  }

  return { COLORES, colorDe, sobres, vigentes, ofertas, actas, documentos, cierre, cerrado, leer, recibir, actaCierre, autenticarComite, abrir };
})();
