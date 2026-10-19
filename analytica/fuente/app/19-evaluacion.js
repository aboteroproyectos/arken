/* ══════════════════════════════════════════════════════════════════════════
   EVALUACIÓN (§18) — lo que el programa principal guarda de la verificación
   y el análisis. El cálculo vive en fuente/evaluacion/ (Motor y compañía);
   aquí se arma su entrada con lo guardado, se guarda lo que la persona
   confirma y se mantiene la bandeja de alertas.

   · Cada verificación es una fila nueva de «evaluaciones» (§7): corregir no
     borra; vale la última, y la historia queda.
   · Cada evaluador verifica y califica los requisitos de su rol (§23).
   · La configuración del análisis, los emparejamientos de insumos y las
     decisiones del comité van en proceso.evaluacion: no son del pliego, así
     que cambian después de emitir sin crear una versión, con su auditoría.
   ══════════════════════════════════════════════════════════════════════════ */
const Evaluacion = (function(){

  const ROL_DE = { 'Evaluador jurídico':'juridicoEval', 'Evaluador financiero':'financiero', 'Evaluador técnico':'tecnico' };

  /* ── Lo guardado ── */
  function evaluaciones(procesoId){ return (S.evaluaciones||[]).filter(e => e.procesoId === procesoId); }
  function subsanaciones(procesoId){ return (S.subsanaciones||[]).filter(s => s.procesoId === procesoId).sort((a, b) => a.solicitada < b.solicitada ? -1 : 1); }
  function alertas(procesoId){ return (S.alertas||[]).filter(a => a.procesoId === procesoId); }
  function requisitos(p){ return Modelo.requisitosVersion(p.id, Modelo.versionVigente(p)).length ? Modelo.requisitosVersion(p.id, Modelo.versionVigente(p)) : Modelo.requisitos(p.id); }
  function base(p){ return Modelo.presupuesto(p.id, Modelo.versionVigente(p)) || Modelo.presupuesto(p.id); }
  function nombreOferta(p, o){ return (Modelo.invitados(p.id).find(i => i.id === o.invitadoId) || {}).razonSocial || (o.proponente||{}).razonSocial || 'Proponente'; }
  function firma(p){ const h = Cronograma.hito(p.cronograma, 'firma'); return h && h.fecha ? h.fecha : ''; }
  function hayOfertas(p){ return !!p && Recepcion.ofertas(p.id).length > 0; }

  /** La entrada del motor, con lo que hay guardado hoy. */
  function datos(p){
    const sobres = Recepcion.sobres(p.id);
    return { proceso:p, base:base(p), requisitos:requisitos(p), parametros:S.parametros || [], cierre:Recepcion.cierre(p), firma:firma(p),
      ofertas:Recepcion.ofertas(p.id).map(o => ({ id:o.id, invitadoId:o.invitadoId, nombre:nombreOferta(p, o), oferta:o.oferta, versionPliego:o.versionPliego,
        versionAnterior:!!(sobres.find(s => s.id === o.sobreId) || {}).versionAnterior, documentos:Recepcion.documentos(o.id) })),
      evaluaciones:evaluaciones(p.id), subsanaciones:subsanaciones(p.id), ahora:new Date().toISOString() };
  }

  /* El análisis se recalcula solo cuando cambia algo que lo afecta. */
  let cache = { clave:null, r:null };
  function claveCache(p){
    return JSON.stringify([p.id, p.actualizado, p.evaluacion || null, p.general || null, (S.evaluaciones||[]).length, (S.subsanaciones||[]).map(s => s.id + (s.respuesta ? 'r' : '') + (s.decision || '')),
      (S.ofertas||[]).length, (S.documentosOferta||[]).map(d => d.meta ? 1 : 0).join(''), (S.parametros||[]).length, (S.requisitos||[]).length]);
  }
  function analisis(p){
    if (!hayOfertas(p)) return null;
    const k = claveCache(p);
    if (cache.clave !== k){ cache = { clave:k, r:Motor.analizar(datos(p)) }; }
    return cache.r;
  }
  function invalidar(){ cache = { clave:null, r:null }; }

  /* ── Permisos por requisito ── */
  /** El administrador verifica todo; cada evaluador, los requisitos de su rol. */
  function puedeEvaluar(r){
    const u = Sesion.usuario;
    if (!u) return false;
    const roles = u.roles || [];
    if (roles.indexOf('administrador') >= 0) return true;
    return roles.indexOf(ROL_DE[r.evaluador] || 'tecnico') >= 0;
  }
  function exigirEvaluar(r){
    if (puedeEvaluar(r)) return;
    const err = new Error('El requisito ' + r.codigo + ' lo verifica el ' + (r.evaluador || 'evaluador técnico').toLowerCase() + '. Su usuario no tiene ese rol.');
    err.permiso = true; throw err;
  }

  /* ── Verificar y calificar ── */
  /** Guarda una verificación como fila nueva.
      v = { cumple, valorVerificado, puntaje, observacion, evidencia:[{ docId, pagina, texto }], sinFirma } */
  async function evaluar(p, ofertaId, codigo, v){
    Permisos.exigir('evaluar');
    if (!Recepcion.actas(p.id, 'apertura').length) throw new Error('La verificación empieza después de la apertura de las ofertas.');
    const r = requisitos(p).find(x => x.codigo === codigo);
    if (!r) throw new Error('El requisito ' + codigo + ' no está en el pliego vigente.');
    exigirEvaluar(r);
    const o = Recepcion.ofertas(p.id).find(x => x.id === ofertaId);
    if (!o) throw new Error('La oferta no existe.');
    if (Motor.CUMPLE.indexOf(v.cumple) < 0) throw new Error('Elija si cumple: sí, no, subsanable, pendiente o no aplica.');
    if ((v.cumple === 'no' || v.cumple === 'subsanable') && !String(v.observacion||'').trim()) throw new Error('Escriba por qué ' + (v.cumple === 'no' ? 'no cumple' : 'es subsanable') + ': la observación es obligatoria.');
    if (v.cumple === 'subsanable' && !r.subsanable) throw new Error('El pliego no deja subsanar ' + codigo + '. Márquelo como «no» si no cumple.');
    const fila = { id:Util.uid('ev'), procesoId:p.id, demo:!!p.demo, ofertaId, requisitoId:codigo, ronda:Number(v.ronda) || (subsanaciones(p.id).some(s => s.ofertaId === ofertaId && s.requisito === codigo && s.respuesta) ? 2 : 1),
      valorDeclarado:Motor.declarado(Object.assign({}, o, { documentos:Recepcion.documentos(o.id) }), r), cumple:v.cumple, observacion:String(v.observacion||'').trim(),
      evidencia:(v.evidencia||[]).filter(x => x && x.docId).map(x => { const d = (S.documentosOferta||[]).find(z => z.id === x.docId) || {};
        return { docId:x.docId, sha256:d.sha256, nombre:d.nombre, pagina:Math.max(1, Number(x.pagina)||1), texto:String(x.texto||'').slice(0, 500) }; }),
      evaluador:Sesion.usuario.usuario, rol:r.evaluador, fecha:new Date().toISOString(), secuencia:evaluaciones(p.id).length + 1, sinFirma:!!v.sinFirma };
    if (r.naturaleza === 'ponderable'){
      const rp = r.reglaPuntaje || {};
      if (rp.tipo === 'calificacion'){
        if (v.puntaje !== '' && v.puntaje !== undefined && v.puntaje !== null){
          const n = Number(v.puntaje);
          if (!(n >= 0 && n <= Number(r.puntajeMaximo))) throw new Error('El puntaje de ' + codigo + ' va de 0 a ' + r.puntajeMaximo + '.');
          if (!fila.observacion) throw new Error('La calificación del evaluador exige justificación (§18.10): escríbala en la observación.');
          fila.puntaje = n;
        }
        fila.regla = 'Calificación del evaluador: ' + (rp.criterios || rp.criterio || '');
      } else if (rp.tipo !== 'economica'){
        if (v.valorVerificado !== '' && v.valorVerificado !== undefined && v.valorVerificado !== null) fila.valorVerificado = rp.tipo === 'sino' ? v.valorVerificado : Number(v.valorVerificado);
        fila.regla = (PlantillaCondiciones.TIPOS_REGLA[rp.tipo] || '') + (rp.criterio ? ': ' + rp.criterio : '');
      }
    }
    if (fila.cumple !== 'pendiente' || fila.puntaje !== undefined || fila.valorVerificado !== undefined){
      await Almacen.poner('evaluaciones', fila);
      await Auditoria.registrar('verificar', 'requisito', codigo + ' · ' + nombreOferta(p, o) + ' · ' + fila.cumple + (fila.puntaje !== undefined ? ' · ' + fila.puntaje + ' puntos' : '') +
        (fila.valorVerificado !== undefined ? ' · valor ' + fila.valorVerificado : '') + ' · ronda ' + fila.ronda, p.id);
    }
    invalidar();
    return fila;
  }
  /** Historia de un requisito en una oferta, de la más reciente a la primera. */
  function historia(p, ofertaId, codigo){ return evaluaciones(p.id).filter(e => e.ofertaId === ofertaId && e.requisitoId === codigo).sort((a, b) => b.secuencia - a.secuencia); }

  /* ── Subsanaciones y justificación del valor bajo ── */
  function solicitudPdf(p, o, s){
    const r = requisitos(p).find(x => x.codigo === s.requisito);
    const titulo = s.tipo === 'justificacion' ? 'Solicitud de justificación del valor de la oferta' : 'Solicitud de subsanación';
    return Pdf.generar({ titulo, documento:titulo + ' ' + p.codigo, lineaIzquierda:'Proceso: ' + p.codigo + ' · ' + p.nombre, marcaAgua:p.demo ? 'DEMOSTRACIÓN' : '',
      bloques:[{ tipo:'portada', titulo, subtitulo:p.codigo + ' · ' + nombreOferta(p, o) },
        { tipo:'kv', filas:[['Proceso', p.codigo + ' · ' + p.nombre], ['Proponente', nombreOferta(p, o) + ' · NIT ' + ((o.proponente||{}).nit || '')], ['Fecha de la solicitud', Util.fmtSello(s.solicitada)],
          ['Plazo para responder', Util.fmtFecha(s.plazo) + ' (' + s.dias + ' día(s) hábil(es))']].concat(r ? [['Requisito', r.codigo + ' · ' + r.nombre]] : []) },
        { tipo:'sec', texto:s.tipo === 'justificacion' ? 'Lo que se solicita' : 'Lo que debe subsanar' },
        { tipo:'texto', texto:s.texto },
        { tipo:'texto', texto:s.tipo === 'justificacion'
          ? 'El valor de su oferta está por debajo del umbral del pliego frente a las demás ofertas. Explique y soporte, con cotizaciones, contratos o memorias de cálculo, cómo ejecutará la obra con ese valor. El comité decidirá si acepta la justificación (como referencia, artículo 2.2.1.1.2.2.4 del Decreto 1082 de 2015).'
          : 'La subsanación no puede mejorar la oferta ni asignar puntaje (reglas de subsanación del pliego). Si no responde dentro del plazo, la oferta queda no habilitada.' }] }).blob;
  }
  async function pedir(p, ofertaId, codigo, dias, texto, tipo){
    Permisos.exigir('gestionarSubsanaciones');
    const o = Recepcion.ofertas(p.id).find(x => x.id === ofertaId);
    if (!o) throw new Error('La oferta no existe.');
    if (!String(texto||'').trim()) throw new Error('Escriba qué se le pide al proponente.');
    const n = Math.max(1, Math.round(Number(dias) || 3));
    if (tipo !== 'justificacion'){
      const r = requisitos(p).find(x => x.codigo === codigo);
      if (!r || !r.subsanable) throw new Error('El pliego no deja subsanar ' + codigo + '.');
      if (r.naturaleza === 'ponderable' && !r.tambienHabilitante) throw new Error(codigo + ' asigna puntaje: lo que asigna puntaje no se subsana.');
    }
    const s = { id:Util.uid('su'), procesoId:p.id, demo:!!p.demo, ofertaId, requisito:tipo === 'justificacion' ? null : codigo, tipo:tipo === 'justificacion' ? 'justificacion' : 'requisito',
      solicitada:new Date().toISOString(), dias:n, plazo:Festivos.sumarDias(Util.hoyISO(), n, true), texto:String(texto).trim(), usuario:Sesion.usuario.usuario, respuesta:null, decision:null };
    const pdf = solicitudPdf(p, o, s);
    s.sha256Pdf = await Archivos.huella(pdf);
    await Almacen.ponerArchivo(s.sha256Pdf, pdf);
    await Almacen.poner('subsanaciones', s);
    await Auditoria.registrar('solicitar', tipo === 'justificacion' ? 'justificación de valor bajo' : 'subsanación', (codigo || 'valor de la oferta') + ' · ' + nombreOferta(p, o) + ' · plazo ' + s.plazo + ' · ' + s.sha256Pdf, p.id);
    invalidar();
    return { s, pdf, nombre:(tipo === 'justificacion' ? 'Justificacion_' : 'Subsanacion_') + Util.razonSocialArchivo(nombreOferta(p, o)) + '_' + Util.codigoArchivo(p.codigo) + (codigo ? '_' + codigo : '') + '.pdf' };
  }
  /** Lo que respondió el proponente: los archivos quedan en su carpeta (ronda 2). */
  async function responder(p, subId, files, nota){
    Permisos.exigir('gestionarSubsanaciones');
    const s = Util.copia(subsanaciones(p.id).find(x => x.id === subId));
    if (!s) throw new Error('La solicitud no existe.');
    if (s.respuesta) throw new Error('La respuesta ya se registró.');
    if (!(files||[]).length && !String(nota||'').trim()) throw new Error('Adjunte lo que envió el proponente o escriba la nota de su respuesta.');
    const o = Recepcion.ofertas(p.id).find(x => x.id === s.ofertaId);
    const r = s.requisito ? requisitos(p).find(x => x.codigo === s.requisito) : null;
    const ids = [];
    for (const f of files||[]){
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (Archivos.extension(f.name) === 'pdf'){ const js = Sobre.pdfConScript(bytes); if (js) throw new Error('«' + f.name + '» ' + js + ': no se recibe.'); }
      const g = await Archivos.guardar(f);
      const d = { id:Util.uid('do'), ofertaId:o.id, procesoId:p.id, invitadoId:o.invitadoId, demo:!!p.demo, requisito:s.requisito || 'ECO-04', grupo:r ? r.grupo : 'Económico',
        nombreRequisito:r ? r.nombre : 'Justificación del valor de la oferta', nombre:f.name, ruta:'', sha256:g.sha256, peso:g.peso, fechaDocumento:Util.hoyISO(), vigenteHasta:'',
        estado:'sin verificar', ronda:2, subsanacionId:s.id };
      await Almacen.poner('documentosOferta', d);
      ids.push(d.id);
    }
    const ahora = new Date().toISOString();
    s.respuesta = { fecha:ahora, documentos:ids, nota:String(nota||'').trim(), usuario:Sesion.usuario.usuario, enPlazo:ahora <= s.plazo + 'T23:59:59.999Z' };
    await Almacen.poner('subsanaciones', s);
    await Auditoria.registrar('registrar', 'respuesta del proponente', (s.requisito || 'justificación') + ' · ' + nombreOferta(p, o) + ' · ' + ids.length + ' archivo(s)' + (s.respuesta.enPlazo ? '' : ' · fuera de plazo'), p.id);
    invalidar();
    return s;
  }
  /** El comité acepta o rechaza la justificación del valor bajo. */
  async function decidirJustificacion(p, subId, decision, motivo){
    Permisos.exigir('decidirComite');
    const s = Util.copia(subsanaciones(p.id).find(x => x.id === subId));
    if (!s || s.tipo !== 'justificacion') throw new Error('La solicitud de justificación no existe.');
    if (['aceptada','rechazada'].indexOf(decision) < 0) throw new Error('Elija si el comité acepta o rechaza la justificación.');
    if (!String(motivo||'').trim()) throw new Error('Escriba el motivo de la decisión del comité.');
    Object.assign(s, { decision, motivo:String(motivo).trim(), decididaPor:Sesion.usuario.usuario, decidida:new Date().toISOString() });
    await Almacen.poner('subsanaciones', s);
    await Auditoria.registrar('decidir', 'justificación de valor bajo', decision + ' · ' + nombreOferta(p, Recepcion.ofertas(p.id).find(x => x.id === s.ofertaId)) + ' · ' + s.motivo, p.id);
    invalidar();
  }

  /* ── proceso.evaluacion: configuración, emparejamientos y decisiones ── */
  async function guardarEvaluacion(p, cambio, accion, detalle){
    const x = Util.copia(Modelo.proceso(p.id));
    x.evaluacion = Object.assign({ presupuestal:{}, emparejamientos:{}, experiencia:{}, decisiones:{}, sorteo:null, trm:'', tipologia:'' }, x.evaluacion || {});
    cambio(x.evaluacion);
    x.actualizado = new Date().toISOString();
    await Almacen.poner('procesos', x);
    await Auditoria.registrar(accion, 'evaluación', detalle, p.id);
    invalidar();
    return x;
  }
  /** Umbrales del análisis (§18.3, §18.4), tipología y TRM. */
  function guardarConfig(p, v){
    Permisos.exigir('configurarEvaluacion');
    const num = (x, min, max) => { const n = Number(x); if (!isFinite(n) || n < min || n > max) throw new Error('Revise los umbrales: cada valor va de ' + min + ' a ' + max + '.'); return n; };
    const pr = { desbalance:{ z:num(v.z, 1, 10), pct:num(v.pctDesbalance, 1, 200), pesoMinPct:num(v.pesoMinPct, 0, 50), minPct:num(v.minPct, 0, 100) }, cargue:{ pct:num(v.pctCargue, 1, 100) },
      cantidades:{ pct:num(v.pctCantidades, 1, 200) }, apu:{ rendimientoPct:num(v.rendimientoPct, 1, 500), insumoBajoPct:num(v.insumoBajoPct, 1, 99), pesoFaltantePct:num(v.pesoFaltantePct, 1, 100), desperdicioPct:num(v.desperdicioPct, 1, 500) } };
    const trm = v.trm === '' || v.trm === undefined ? '' : num(v.trm, 1, 100000);
    return guardarEvaluacion(p, e => { e.presupuestal = pr; e.tipologia = String(v.tipologia||'').trim(); e.trm = trm; }, 'configurar',
      'Umbrales del análisis: z ' + pr.desbalance.z + ' · ±' + pr.desbalance.pct + ' % · cargue ' + pr.cargue.pct + ' % · cantidades ' + pr.cantidades.pct + ' %' + (trm ? ' · TRM ' + trm : '') + (v.tipologia ? ' · tipología ' + v.tipologia : ''));
  }
  /** Una persona confirma (o descarta) un emparejamiento de insumos sugerido. */
  function emparejar(p, claveOferta, idBase){
    Permisos.exigir('configurarEvaluacion');
    const b = idBase ? (base(p).insumos||[]).find(i => i.id === idBase) : null;
    if (idBase && !b) throw new Error('El insumo de la base no existe.');
    return guardarEvaluacion(p, e => { e.emparejamientos[claveOferta] = b ? b.id : 'ninguno'; }, 'emparejar', 'Insumo «' + claveOferta.split('|')[0] + '» ' + (b ? '= «' + b.nombre + '» de la base' : 'sin pareja en la base'));
  }
  /** Decisión del comité sobre una oferta presentada sobre una versión anterior del pliego. */
  function decidirVersion(p, ofertaId, decision, motivo){
    Permisos.exigir('decidirComite');
    if (['aceptada','rechazada'].indexOf(decision) < 0) throw new Error('Elija si el comité acepta o rechaza la oferta.');
    if (!String(motivo||'').trim()) throw new Error('Escriba el motivo de la decisión del comité.');
    return guardarEvaluacion(p, e => { e.decisiones[ofertaId] = Object.assign({}, e.decisiones[ofertaId], { version:decision, motivoVersion:String(motivo).trim(), por:Sesion.usuario.usuario, fecha:new Date().toISOString() }); },
      'decidir', 'Oferta sobre versión anterior · ' + nombreOferta(p, Recepcion.ofertas(p.id).find(x => x.id === ofertaId)) + ' · ' + decision + ' · ' + motivo);
  }
  /** Resultado del sorteo en audiencia: los empatados, en el orden en que salieron. */
  function registrarSorteo(p, ids, acta){
    Permisos.exigir('decidirComite');
    if (!(ids||[]).length) throw new Error('Indique el orden en que salieron los empatados.');
    if (!String(acta||'').trim()) throw new Error('Escriba la referencia del acta del sorteo.');
    return guardarEvaluacion(p, e => { e.sorteo = ids.slice(); e.actaSorteo = String(acta).trim(); }, 'sortear', 'Sorteo de desempate · ' + ids.map(id => nombreOferta(p, Recepcion.ofertas(p.id).find(x => x.id === id))).join(' > ') + ' · ' + acta);
  }

  /* ── Bandeja de alertas ── */
  /** Mezcla las alertas del análisis con las guardadas y guarda los cambios. */
  async function actualizarAlertas(p){
    const R = analisis(p);
    if (!R) return 0;
    const guardadas = alertas(p.id).map(a => Object.assign({}, a));
    const cambios = Alertas.mezclar(guardadas, R.alertas, new Date().toISOString());
    for (const c of cambios){
      const reg = Object.assign({ id:(guardadas.find(g => g.clave === c.registro.clave) || {}).id || Util.uid('al'), procesoId:p.id, demo:!!p.demo }, c.registro);
      await Almacen.poner('alertas', reg);
    }
    if (cambios.length) await Auditoria.registrar('analizar', 'alertas', cambios.filter(c => c.cambio === 'nueva').length + ' nueva(s) · ' + cambios.filter(c => c.cambio === 'actualizada').length + ' actualizada(s) · ' +
      cambios.filter(c => c.cambio === 'ya no se presenta').length + ' que ya no se presenta(n)', p.id);
    return cambios.length;
  }
  function abiertas(p){ return alertas(p.id).filter(a => a.vigente !== false && ['nueva','en revisión'].indexOf(Alertas.estado(a)) >= 0); }
  async function cambiarEstadoAlerta(p, id, estado, motivo){
    Permisos.exigir('revisarAlertas');
    if (Alertas.ESTADOS.indexOf(estado) < 0) throw new Error('Estado desconocido.');
    if (estado === 'descartada' && !String(motivo||'').trim()) throw new Error('Para descartar una alerta escriba el motivo.');
    const a = Util.copia(alertas(p.id).find(x => x.id === id));
    if (!a) throw new Error('La alerta no existe.');
    a.estados = (a.estados||[]).concat([{ estado, fecha:new Date().toISOString(), usuario:Sesion.usuario.usuario, motivo:String(motivo||'').trim() }]);
    a.actualizada = new Date().toISOString();
    await Almacen.poner('alertas', a);
    await Auditoria.registrar('revisar', 'alerta', a.alerta.titulo + ' · ' + estado + (motivo ? ' · ' + motivo : ''), p.id);
  }

  /* ── Metadatos de los PDF (autor, ilegible, protegido) ── */
  async function leerMetadatos(d){
    const meta = { leido:new Date().toISOString(), legible:true, autor:'', creador:'', productor:'', paginas:0 };
    if (Archivos.extension(d.nombre) !== 'pdf' || !window.pdfjsLib) return Object.assign(meta, { legible:null });
    try {
      const b = await Almacen.leerArchivo(d.sha256);
      if (!b) return Object.assign(meta, { legible:null, error:'El archivo no está en este equipo.' });
      const pdf = await window.pdfjsLib.getDocument({ data:new Uint8Array(await b.arrayBuffer()), isEvalSupported:false, enableXfa:false }).promise;
      const info = ((await pdf.getMetadata()) || {}).info || {};
      Object.assign(meta, { autor:String(info.Author||'').slice(0, 120), creador:String(info.Creator||'').slice(0, 120), productor:String(info.Producer||'').slice(0, 120), paginas:pdf.numPages });
    } catch(e){
      meta.legible = false;
      meta.error = e && e.name === 'PasswordException' ? 'El PDF está protegido con contraseña.' : 'El PDF no se puede abrir: ' + (e && e.message ? e.message : 'archivo dañado') + '.';
    }
    return meta;
  }
  /** Lee los metadatos de los documentos que aún no los tienen. */
  async function leerDocumentos(p){
    let n = 0;
    for (const o of Recepcion.ofertas(p.id)) for (const d of Recepcion.documentos(o.id).filter(x => !x.meta)){
      await Almacen.poner('documentosOferta', Object.assign(Util.copia(d), { meta:await leerMetadatos(d) }));
      n++;
    }
    if (n) invalidar();
    return n;
  }

  /* ── Precios ocultos a los técnicos hasta terminar su calificación (§23) ── */
  function tecnicaTerminada(p){
    const R = analisis(p);
    if (!R) return false;
    const tecnicos = R.requisitos.filter(r => (ROL_DE[r.evaluador] || 'tecnico') === 'tecnico');
    return R.ofertas.every(o => tecnicos.every(r => { const v = R.vigente(o.id, r.codigo); return v && v.cumple !== 'pendiente' && (r.naturaleza !== 'ponderable' || (r.reglaPuntaje||{}).tipo !== 'calificacion' || v.puntaje !== undefined); }));
  }

  return { ROL_DE, evaluaciones, subsanaciones, alertas, requisitos, base, nombreOferta, hayOfertas, datos, analisis, invalidar, puedeEvaluar, evaluar, historia,
    pedir, responder, decidirJustificacion, guardarConfig, emparejar, decidirVersion, registrarSorteo, actualizarAlertas, abiertas, cambiarEstadoAlerta,
    leerMetadatos, leerDocumentos, tecnicaTerminada };
})();

/* ── Demostración de la Fase 3: cinco sobres cerrados de proponentes ficticios ── */
const DemoEvaluacion = (function(){
  const FECHA_ZIP = new Date('2026-01-01T00:00:00Z');
  /** Un PDF ficticio, rotulado, con el autor en sus metadatos. */
  function pdfDemo(d, proponente){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'letter' });
    doc.setProperties({ title:d.nombre, author:d.autor, subject:'Documento de demostración', creator:'ARKEN ANALYTICA (demostración)' });
    doc.setFontSize(16); doc.text('DOCUMENTO DE DEMOSTRACIÓN', 20, 30);
    doc.setFontSize(11);
    [proponente, d.requisito + ' · ' + d.nombre.replace(/\.pdf$/, ''), 'Fecha del documento: ' + (d.fechaDocumento || '—'), 'Vigente hasta: ' + (d.vigenteHasta || 'sin vencimiento'),
      'Documento ficticio, generado por ARKEN ANALYTICA para la demostración. No tiene validez.'].forEach((t, i) => doc.text(doc.splitTextToSize(t, 170), 20, 45 + i * 10));
    return new Uint8Array(doc.output('arraybuffer'));
  }
  /** Arma los sobres como lo hace ARKEN OFERTA y los recibe por el módulo 09. */
  async function recibirOfertas(p){
    Permisos.exigir('demostracion');
    if (!p.demo) throw new Error('Las ofertas de demostración solo se cargan en un proceso de demostración.');
    if (!p.emitido) throw new Error('Emita primero el proceso de demostración (módulo 07).');
    if (Recepcion.cerrado(p)) throw new Error('El cierre ya pasó: los sobres de demostración se generan antes del cierre.');
    const ll = Modelo.llaves(p.id);
    if (!ll || !ll.publicaCifrado) throw new Error('El proceso no tiene llaves.');
    const invitados = Modelo.invitados(p.id).filter(i => i.estado !== 'retirado' && i.demo);
    if (invitados.length < 5) throw new Error('El proceso de demostración necesita sus cinco invitados de demostración.');
    const llave = { kty:'EC', crv:ll.publicaCifrado.crv, x:ll.publicaCifrado.x, y:ll.publicaCifrado.y };
    const version = Modelo.versionVigente(p);
    /* Las fechas de los documentos se cuentan desde hoy, porque el cierre de la demostración se puede adelantar a este momento. */
    const gen = DemoOfertas.generar({ proceso:p, base:Evaluacion.base(p), requisitos:Evaluacion.requisitos(p), invitados, cierre:new Date().toISOString(), versionPliego:version });
    const files = [];
    for (const g of gen){
      const inv = invitados.find(i => i.id === g.invitadoId);
      const archivos = [];
      /* Generados tres minutos antes, para que «Adelantar el cierre» los deje antes del cierre. */
      g.oferta.generado = new Date(Date.now() - 180000).toISOString();
      g.oferta.proponente.codigoInvitacion = inv.codigoInvitacion;
      g.documentos.forEach((d, k) => {
        const bytes = pdfDemo(d, inv.razonSocial);
        const ruta = Sobre.rutaAdjunto(d.requisito, (k + 1) + '_' + d.nombre);
        archivos.push({ ruta, bytes, d });
      });
      for (const a of archivos) g.oferta.adjuntos.push({ requisito:a.d.requisito, fila:null, columna:null, nombre:a.d.nombre, ruta:a.ruta, sha256:await Cripto.sha256(a.bytes), peso:a.bytes.length,
        fechaDocumento:a.d.fechaDocumento, vigenteHasta:a.d.vigenteHasta });
      const interno = new JSZip();
      interno.file('oferta.json', JSON.stringify(g.oferta, null, 1), { date:FECHA_ZIP });
      archivos.forEach(a => interno.file(a.ruta, a.bytes, { date:FECHA_ZIP }));
      const c = await Cripto.cifrarSobre(llave, await interno.generateAsync({ type:'uint8array', compression:'DEFLATE' }));
      const env = new TextEncoder().encode(JSON.stringify(c.envuelta, null, 1));
      const externo = new JSZip();
      externo.file('oferta.cifrada', c.cifrado, { date:FECHA_ZIP }); externo.file('llave.envuelta', env, { date:FECHA_ZIP });
      const lista = [{ ruta:'oferta.cifrada', sha256:await Cripto.sha256(c.cifrado) }, { ruta:'llave.envuelta', sha256:await Cripto.sha256(env) }];
      const cab = Sobre.cabecera({ tipo:'oferta', proceso:p.codigo, versionPliego:version, huellaPliego:'', invitado:{ razonSocial:inv.razonSocial, nit:inv.nit, codigoInvitacion:inv.codigoInvitacion },
        generado:g.oferta.generado, versionPrograma:VERSION_PROGRAMA, sha256Contenido:await Sobre.huellaContenido(lista), cifrado:true });
      externo.file('sobre.json', JSON.stringify(cab, null, 1), { date:FECHA_ZIP });
      const blob = await externo.generateAsync({ type:'blob', compression:'DEFLATE', mimeType:'application/zip' });
      files.push(new File([blob], Sobre.nombre(inv.razonSocial, p.codigo, version, new Date(g.oferta.generado)), { type:'application/zip' }));
    }
    await Auditoria.registrar('cargar', 'ofertas de demostración', files.length + ' sobre(s) cerrado(s) de proponentes ficticios', p.id);
    return Recepcion.recibir(p, files);
  }
  /** Solo en demostración: trae el cierre a este momento, para seguir sin esperar. */
  async function adelantarCierre(p){
    Permisos.exigir('demostracion');
    if (!p.demo) throw new Error('El cierre solo se adelanta en un proceso de demostración.');
    if (Recepcion.cerrado(p)) throw new Error('El cierre ya pasó.');
    const x = Util.copia(Modelo.proceso(p.id));
    const h = Cronograma.hito(x.cronograma, 'cierre');
    /* La hora del cronograma es la de Colombia (UTC−05:00, Cronograma.instante). */
    const d = new Date(Date.now() - 60000 - 5 * 3600000);
    h.fecha = d.toISOString().slice(0, 10); h.hora = d.toISOString().slice(11, 16);
    x.actualizado = new Date().toISOString();
    await Almacen.poner('procesos', x);
    await Auditoria.registrar('adelantar', 'cierre (demostración)', 'Cierre de la demostración llevado a ' + h.fecha + ' ' + h.hora, p.id);
  }
  return { recibirOfertas, adelantarCierre };
})();
