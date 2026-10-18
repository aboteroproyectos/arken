/* ══════════════════════════════════════════════════════════════════════════
   CRONOGRAMA DEL PROCESO (§12.2). Hitos con fecha y hora en la zona del
   proceso (America/Bogota por defecto). Los plazos se cuentan en días
   hábiles de Colombia o en días calendario, a elección del proceso.
   ══════════════════════════════════════════════════════════════════════════ */
const Cronograma = (function(){

  /* [clave, nombre, opcional, desfase propuesto desde la emisión (días), hora] */
  const HITOS = [
    ['emision','Emisión del pliego', false, 0, '08:00'],
    ['visita','Visita de obra', true, 3, '09:00'],
    ['preguntas','Plazo para preguntas', false, 5, '17:00'],
    ['respuestas','Publicación de respuestas', false, 8, '17:00'],
    ['adendas','Plazo para adendas', false, 10, '17:00'],
    ['cierre','Cierre y entrega de ofertas', false, 15, '15:00'],
    ['apertura','Apertura de ofertas', false, 15, '15:30'],
    ['informe','Publicación del informe de evaluación', false, 22, '17:00'],
    ['observaciones','Plazo de observaciones al informe', false, 25, '17:00'],
    ['adjudicacion','Adjudicación', false, 28, '10:00'],
    ['firma','Firma del contrato', false, 33, '10:00']
  ];

  function nuevo(){
    return { habiles:true, zona:'America/Bogota', minHabilesAdendasCierre:3,
      hitos: HITOS.map(([clave, nombre, opcional]) => ({ clave, nombre, opcional, activo:!opcional, fecha:'', hora:'' })) };
  }
  /** Propone fechas a partir de la emisión, en días hábiles o calendario. */
  function proponer(cron, fechaEmision){
    const c = Util.copia(cron || nuevo());
    c.hitos.forEach(h => {
      const def = HITOS.find(x => x[0] === h.clave); if (!def) return;
      h.fecha = Festivos.sumarDias(fechaEmision, def[3], c.habiles);
      h.hora = h.hora || def[4];
    });
    return c;
  }
  /** Instante ISO con la zona del proceso. Colombia no tiene horario de
      verano: siempre UTC−05:00. Para otras zonas se guarda la hora local tal
      cual y la zona aparte. */
  function instante(h){
    if (!h || !h.fecha) return null;
    return h.fecha + 'T' + (h.hora || '00:00') + ':00-05:00';
  }
  function hito(cron, clave){ return ((cron && cron.hitos) || []).find(h => h.clave === clave) || null; }
  function activos(cron){ return ((cron && cron.hitos) || []).filter(h => h.activo !== false); }

  /** Problemas del cronograma: hitos sin fecha, fuera de orden, y el cierre
      demasiado cerca del plazo de adendas. */
  function validar(cron){
    const lista = [];
    if (!cron || !cron.hitos) return [{ clave:'', msg:'El proceso no tiene cronograma.' }];
    const act = activos(cron);
    act.forEach(h => { if (!h.fecha || !h.hora) lista.push({ clave:h.clave, msg:h.nombre + ': falta la fecha o la hora.' }); });
    for (let i = 1; i < act.length; i++){
      const a = instante(act[i-1]), b = instante(act[i]);
      if (a && b && new Date(b) < new Date(a)) lista.push({ clave:act[i].clave, msg:act[i].nombre + ' queda antes de ' + act[i-1].nombre.toLowerCase() + '.' });
    }
    const ad = hito(cron, 'adendas'), ci = hito(cron, 'cierre');
    if (ad && ci && ad.fecha && ci.fecha){
      const min = Number(cron.minHabilesAdendasCierre === undefined ? 3 : cron.minHabilesAdendasCierre);
      const dias = Festivos.diasEntre(ad.fecha, ci.fecha, true);
      if (dias < min) lista.push({ clave:'cierre', msg:'Entre el plazo de adendas y el cierre hay ' + dias + ' día(s) hábil(es); se exigen al menos ' + min + '.' });
    }
    act.forEach(h => {
      if (h.fecha && cron.habiles && !Festivos.esHabil(h.fecha) && h.clave !== 'visita')
        lista.push({ clave:h.clave, msg:h.nombre + ' cae en un día no hábil (' + Util.fmtFecha(h.fecha) + ').', aviso:true });
    });
    return lista;
  }
  /** Siguiente hito a partir de ahora. */
  function siguiente(cron, ahora){
    const t = ahora || Date.now();
    return activos(cron).find(h => instante(h) && new Date(instante(h)).getTime() > t) || null;
  }
  return { HITOS, nuevo, proponer, instante, hito, activos, validar, siguiente };
})();

/* ══════════════════════════════════════════════════════════════════════════
   REVISIÓN ANTES DE EMITIR (§12.4). Devuelve la lista completa, cada punto
   con su estado, su detalle y el módulo donde se corrige. «Emitir» solo se
   habilita si todos están en verde.
   ══════════════════════════════════════════════════════════════════════════ */
const Revision = (function(){

  /** ctx = { proceso, presupuesto, requisitos, documentos, invitados, estadoConfidencialidad,
              llaves, pliego:{ generado, revisado }, parametros } */
  function revisar(ctx){
    const L = [];
    const add = (grupo, ok, texto, modulo, detalle) => L.push({ grupo, ok:!!ok, texto, modulo, detalle:detalle||[] });
    const pres = ctx.presupuesto || { capitulos:[], apus:[], insumos:[] };

    /* Presupuesto base */
    const sinCantidad = [], sinUnidad = [], sinApu = [];
    Calculo.recorrerActividades(pres, a => {
      if (!(Number(a.cantidad) > 0)) sinCantidad.push(a.codigo + ' ' + a.nombre);
      if (!String(a.unidad||'').trim()) sinUnidad.push(a.codigo + ' ' + a.nombre);
      if (!(a.apus||[]).length) sinApu.push(a.codigo + ' ' + a.nombre);
    });
    const nAct = Calculo.contar(pres).actividades;
    add('Presupuesto base', nAct > 0, 'El presupuesto base tiene actividades', '02', nAct ? [] : ['No hay actividades.']);
    add('Presupuesto base', nAct > 0 && !sinCantidad.length, 'Toda actividad tiene cantidad mayor que cero', '02', sinCantidad);
    add('Presupuesto base', nAct > 0 && !sinUnidad.length, 'Toda actividad tiene unidad', '02', sinUnidad);
    add('Presupuesto base', nAct > 0 && !sinApu.length, 'Toda actividad tiene al menos un APU', '02', sinApu);
    const sinPrecio = (pres.insumos||[]).filter(i => !(Number(i.precio) > 0)).map(i => i.codigo + ' ' + i.nombre);
    add('Presupuesto base', (pres.insumos||[]).length > 0 && !sinPrecio.length, 'Todo insumo tiene precio', '02', sinPrecio);
    const aiu = pres.aiu || {};
    const aiuOk = ['a','i','u'].every(k => aiu[k] !== '' && aiu[k] !== null && aiu[k] !== undefined && isFinite(Number(aiu[k]))) &&
      (Number(aiu.a) + Number(aiu.i) + Number(aiu.u)) > 0;
    add('Presupuesto base', aiuOk, 'AIU definido', '02', aiuOk ? [] : ['Defina A, I y U del presupuesto base.']);

    /* Condiciones */
    const total = (ctx.proceso && ctx.proceso.puntajeTotal) || PlantillaCondiciones.TOTAL_PUNTOS;
    const probl = PlantillaCondiciones.problemas(ctx.requisitos, total);
    const suma = PlantillaCondiciones.puntosPonderables(ctx.requisitos);
    add('Condiciones de la oferta', Math.abs(suma - total) < 1e-9, 'Los puntajes suman ' + total + ' puntos (hoy ' + suma + ')', '04');
    const sinRegla = probl.filter(p => /regla|evaluador|puntaje máximo|código/.test(p.msg)).map(p => p.msg);
    add('Condiciones de la oferta', !sinRegla.length, 'Todo requisito tiene evaluador y regla; los habilitantes, su regla de verificación', '04', sinRegla);

    /* Documentos */
    const visibles = (ctx.documentos||[]).filter(d => d.visibleParaProponentes !== false && d.vigente !== false);
    const sinHuella = visibles.filter(d => !/^[0-9a-f]{64}$/.test(String(d.sha256||''))).map(d => d.nombre);
    add('Documentos del proceso', visibles.length > 0 && !sinHuella.length, 'Todo documento visible tiene huella SHA-256', '05',
      visibles.length ? sinHuella : ['No hay documentos visibles para los proponentes.']);
    const enlaces = visibles.filter(d => d.enlace && !d.enlaceVerificado).map(d => d.nombre);
    add('Documentos del proceso', !enlaces.length, 'Los documentos por enlace están verificados', '05', enlaces);

    /* Cronograma */
    const cron = Cronograma.validar(ctx.proceso && ctx.proceso.cronograma).filter(x => !x.aviso);
    add('Cronograma', !cron.length, 'Cronograma completo y en orden, con tiempo suficiente entre adendas y cierre', '07', cron.map(x => x.msg));

    /* Confidencialidad */
    add('Confidencialidad', ctx.estadoConfidencialidad === 'aprobado', 'Acuerdo de confidencialidad aprobado por abogado', '06',
      ctx.estadoConfidencialidad === 'aprobado' ? [] : ['Un usuario con rol Jurídico debe registrar «Aprobado por abogado» sobre el texto vigente.']);

    /* Llaves */
    const ll = ctx.llaves;
    add('Llaves del proceso', !!(ll && ll.publicaFirma && ll.publicaCifrado), 'Llaves del proceso creadas', '07');
    add('Llaves del proceso', !!(ll && ll.respaldo && ll.respaldo.descargado && ll.respaldo.confirmado),
      'Respaldo de llaves descargado y guardado fuera de este computador', '07');

    /* Invitados */
    const inv = (ctx.invitados||[]).filter(i => i.estado !== 'retirado');
    const malos = inv.filter(i => (Util.normaliza(i.pais||'colombia') === 'colombia' && !Nit.valido(i.nit, i.dv)) ||
      !(i.contacto && i.contacto.nombre && i.contacto.correo)).map(i => i.razonSocial);
    add('Invitados', inv.length > 0 && !malos.length, 'Invitados con NIT válido y contacto', '06', inv.length ? malos : ['No hay invitados.']);

    /* Pliego */
    add('Pliego', !!(ctx.pliego && ctx.pliego.generado), 'Pliego en PDF generado', '07');
    add('Pliego', !!(ctx.pliego && ctx.pliego.revisado), 'Pliego revisado por el responsable', '07');
    return L;
  }
  function listo(lista){ return lista.length > 0 && lista.every(x => x.ok); }
  return { revisar, listo };
})();
