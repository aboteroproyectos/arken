/* ══════════════════════════════════════════════════════════════════════════
   MOTOR DE EVALUACIÓN — une el análisis presupuestal, la verificación, las
   alertas, la habilitación y el puntaje en un solo resultado, a partir de
   los datos guardados. No escribe nada: el programa guarda lo que la persona
   confirma (Evaluacion, en la interfaz) y vuelve a correr el motor.

   datos = { proceso, base, requisitos, parametros, cierre, firma,
             ofertas:[{ id, nombre, oferta, versionAnterior, documentos:[…] }],
             evaluaciones:[…], subsanaciones:[…] }
   El resultado es el mismo en el navegador y en Node: así se prueba contra
   los cálculos hechos a mano.
   ══════════════════════════════════════════════════════════════════════════ */
const Motor = (function(){

  const CUMPLE = ['sí','no','subsanable','pendiente','no aplica'];

  function configuracion(p){
    const e = (p && p.evaluacion) || {};
    return { presupuestal:Presupuestal.config(e.presupuestal), emparejamientos:e.emparejamientos || {}, experiencia:e.experiencia || {},
      tipologia:e.tipologia || '', trm:e.trm || '', decisiones:e.decisiones || {}, sorteo:e.sorteo || null };
  }

  /* ── Filas de evaluación: la vigente es la última; nada se sobrescribe ── */
  function vigentes(evaluaciones){
    const m = new Map();
    (evaluaciones||[]).slice().sort((a, b) => a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : (a.secuencia||0) - (b.secuencia||0))
      .forEach(e => m.set(e.ofertaId + '|' + e.requisitoId, e));
    return m;
  }
  function ultimaSubsanacion(subs, ofertaId, codigo, tipo){
    return (subs||[]).filter(s => s.ofertaId === ofertaId && (tipo === 'justificacion' ? s.tipo === 'justificacion' : s.tipo !== 'justificacion' && s.requisito === codigo))
      .sort((a, b) => a.solicitada < b.solicitada ? -1 : 1).slice(-1)[0] || null;
  }

  /* ── Lo que el proponente declaró para un requisito ── */
  function filasDe(oferta, r){
    const v = (oferta.respuestas||{})[r.codigo];
    return Array.isArray(v) ? v : [];
  }
  function adjuntosDe(o, codigo){ return (o.documentos||[]).filter(d => d.requisito === codigo); }
  function sinRespuesta(o, r){
    if (r.grupo === 'Económico') return false;
    if (r.tipoRespuesta === 'documento') return !adjuntosDe(o, r.codigo).length;
    if (r.tipoRespuesta === 'tabla') return !filasDe(o.oferta, r).length;
    const v = (o.oferta.respuestas||{})[r.codigo];
    return v === undefined || v === null || String(v).trim() === '';
  }
  function declarado(o, r){
    if (r.tipoRespuesta === 'documento') return adjuntosDe(o, r.codigo).length + ' documento(s)';
    if (r.tipoRespuesta === 'tabla') return filasDe(o.oferta, r).length + ' renglón(es)';
    const v = (o.oferta.respuestas||{})[r.codigo];
    return v === undefined || v === null ? '' : typeof v === 'number' ? (r.dato && r.dato.tipo === 'moneda' ? Util.money(v) : Util.cant(v)) : String(v);
  }

  /** Estados financieros declarados; en consorcio, si cada integrante trae
      los suyos, se combinan por participación (Anexo C). */
  function estadosFinancieros(oferta, r){
    const ints = ((oferta.consorcio||{}).integrantes||[]).filter(x => x.financiero);
    if (ints.length >= 2) return { f:Tecnico.combinarConsorcio(ints), consorcio:true };
    const fila = filasDe(oferta, r)[0];
    return { f:oferta.financiero || fila || null, consorcio:false };
  }

  /* ── El análisis completo ── */
  function analizar(d){
    const p = d.proceso, cfg = configuracion(p), general = Object.assign(Pliego.generalPorDefecto(), p.general || {});
    const formulario = Paquete.formulario(d.base, p.politicaApu);
    const tb = Calculo.totales(d.base);
    const PO = tb.total;
    const requisitos = (d.requisitos||[]).filter(r => r.activo !== false);
    const laboral = Parametros.costoEmpresaMinimo(d.parametros, String(d.cierre || Util.hoyISO()).slice(0, 10));
    const ofertas = d.ofertas.map(o => {
      const rc = Sobre.recalcular(o.oferta, formulario);
      return Object.assign({}, o, { pres:rc.pres, totales:rc.totales, recalculo:rc });
    });
    const ctx = { base:d.base, ofertas, config:cfg.presupuestal, emparejamientos:cfg.emparejamientos, laboral };
    const R = { proceso:p, general, cierre:d.cierre, firma:d.firma, ctx, formulario, totalesBase:tb, presupuestoOficial:PO, laboral, config:cfg, requisitos, ofertas, alertas:[], porOferta:{} };

    /* Presupuestal */
    R.desbalance = Presupuestal.desbalance(ctx);
    R.cantidades = Presupuestal.riesgoCantidades(ctx);
    R.valorBajo = Presupuestal.valorBajo(ctx, general.umbralBajoPct);
    R.aiu = Presupuestal.aiu(ctx, { iva:d.base.iva });
    R.apu = Presupuestal.apu(ctx);
    R.umbralesFinancieros = Tecnico.umbralesFinancieros(requisitos);
    ofertas.forEach(o => {
      const x = R.porOferta[o.id] = { aritmetica:Presupuestal.aritmetica(o) };
      const prog = (o.oferta.programacion||{}).filas || [];
      x.programacion = Tecnico.programacion(prog, o, { plazoMaximoDias:Number(p.plazoMaximoDias||0), horasJornal:laboral ? laboral.horasJornal : 7 });
      x.cargue = Presupuestal.cargueInicio(ctx, o, prog);
      const plazoMeses = x.programacion.aplica ? x.programacion.plazo / 30.4375 : Number(p.plazoMaximoDias||0) / 30.4375;
      x.aiu = R.aiu.find(a => a.id === o.id);
      x.administracion = Presupuestal.administracionAlcanza(x.aiu, o.oferta.personal, plazoMeses);
      x.financiero = {};
      requisitos.filter(r => (r.tabla||{}).plantilla === 'financiero').forEach(r => {
        const ef = estadosFinancieros(o.oferta, r);
        x.financiero[r.codigo] = { consorcio:ef.consorcio, f:ef.f, indicadores:ef.f ? Tecnico.financiero(ef.f, R.umbralesFinancieros.filter(u => u.requisito === r.codigo), PO) : [] };
      });
      x.experiencia = {};
      requisitos.filter(r => (r.tabla||{}).plantilla === 'experiencia').forEach(r => {
        const reglas = Object.assign(Tecnico.reglasExperiencia(r), cfg.experiencia[r.codigo] || {});
        x.experiencia[r.codigo] = Tecnico.experiencia(filasDe(o.oferta, r), reglas, { fechaCierre:d.cierre, presupuestoOficial:PO, parametros:d.parametros, tipologia:reglas.tipologia ? cfg.tipologia : '' });
      });
      x.personal = {};
      requisitos.filter(r => (r.tabla||{}).plantilla === 'personal').forEach(r => { x.personal[r.codigo] = Tecnico.personal(filasDe(o.oferta, r), r); });
      x.organigrama = Tecnico.organigrama(o.oferta.organigrama, o.oferta.personal, ((o.oferta.presupuesto||{}).desgloseAdministracion) || []);
      x.dobleCargo = Alertas.dobleCargo(o);
    });

    /* Alertas */
    R.alertas = alertas(R, d);

    /* Habilitación y puntaje */
    const vig = vigentes(d.evaluaciones);
    R.vigente = (ofertaId, codigo) => vig.get(ofertaId + '|' + codigo) || null;
    R.sugerencias = {};
    ofertas.forEach(o => { R.sugerencias[o.id] = sugerencias(R, o); });
    const bajos = new Set(R.valorBajo.filas.filter(f => f.bajo).map(f => f.id));
    ofertas.forEach(o => {
      const dec = cfg.decisiones[o.id] || {};
      R.porOferta[o.id].habilitacion = Puntaje.habilitacion({ requisitos, ahora:d.ahora || new Date().toISOString(),
        vigente:c => R.vigente(o.id, c), subsanacion:c => ultimaSubsanacion(d.subsanaciones, o.id, c),
        economico:{ sobrePresupuesto:o.totales.total > PO + 0.5, rechazarSobrePresupuesto:general.rechazarSobrePresupuesto, valorBajo:bajos.has(o.id),
          justificacion:ultimaSubsanacion(d.subsanaciones, o.id, null, 'justificacion') },
        versionAnterior:!!o.versionAnterior, decisionVersion:dec.version });
    });
    R.puntaje = puntuar(R, cfg);
    return R;
  }

  /* ── Lo que el programa propone para cada requisito (la persona confirma) ── */
  function sugerencias(R, o){
    const S = {}, x = R.porOferta[o.id];
    const fecha = String(R.cierre || '').slice(0, 10);
    R.requisitos.forEach(r => {
      const s = { cumple:null, motivo:'', valor:null };
      if (r.grupo === 'Económico'){
        const ar = x.aritmetica;
        if (r.codigo === 'ECO-01'){ const sp = ar.renglones.filter(z => z.problemas.indexOf('sin precio') >= 0); s.cumple = sp.length ? 'no' : 'sí'; s.motivo = sp.length ? sp.length + ' actividad(es) sin precio.' : 'Toda actividad tiene precio.'; }
        else if (r.codigo === 'ECO-02'){ const exig = R.formulario.capitulos.flatMap(c => c.subs.flatMap(sb => sb.acts.filter(a => a.apuObligatorio).map(a => a.codigo)));
          const io = Presupuestal.indice(o.pres); const falta = []; io.acts.forEach(a => { if (exig.indexOf(a.codigo) >= 0 && a.act.sinApu) falta.push(a.codigo); });
          s.cumple = falta.length ? 'subsanable' : 'sí'; s.motivo = falta.length ? 'Sin APU en ' + falta.join(', ') + '.' : 'Las actividades exigidas traen APU.'; }
        else if (r.codigo === 'ECO-03'){ s.cumple = x.aiu.cuadra ? 'sí' : 'subsanable'; s.motivo = 'Desglose ' + Util.money(x.aiu.totalDesglose) + ' frente a A ' + Util.money(x.aiu.a) + '.'; }
        else if (r.codigo === 'ECO-05'){ s.cumple = o.totales.total <= R.presupuestoOficial + 0.5 ? 'sí' : 'no'; s.motivo = 'Total recalculado ' + Util.money(o.totales.total) + ' frente a ' + Util.money(R.presupuestoOficial) + '.'; }
        else if (r.codigo === 'ECO-04'){ s.valor = o.totales.total; s.motivo = 'Total recalculado.'; }
      } else if (x.financiero[r.codigo]){
        const ind = x.financiero[r.codigo].indicadores;
        if (ind.length){ s.cumple = ind.every(i => i.cumple) ? 'sí' : 'no'; s.motivo = ind.map(i => i.nombre + ': ' + i.calculo).join(' · '); }
      } else if (x.experiencia[r.codigo]){
        const e = x.experiencia[r.codigo];
        s.valor = e.area;
        if (e.cumpleSuma !== null){ s.cumple = e.cumpleSuma && e.cumpleIndividual !== false ? 'sí' : 'no'; s.motivo = 'Suma ' + Util.cant(Util.redondearDec(e.suma, 2)) + ' SMMLV frente a ' + Util.cant(Util.redondearDec(e.exigido, 2)) + ' exigidos.'; }
        else s.motivo = 'Área acreditada en la tipología: ' + Util.cant(e.area) + ' m².';
      } else if (x.personal[r.codigo]){
        const L = x.personal[r.codigo];
        if (L.length){ s.cumple = L.every(f => f.cumple) ? 'sí' : 'subsanable'; s.valor = L[0].sobreMinimo; s.motivo = L.map(f => f.cargo + ': ' + (f.cumple ? 'cumple' : f.faltas.join('; '))).join(' · '); }
      } else if (r.grupo === 'Programación' && x.programacion.aplica){
        const malos = x.programacion.hallazgos.filter(h => h.tipo === 'plazo' || h.tipo === 'sin programar' || h.tipo === 'ciclo');
        s.cumple = malos.length ? 'subsanable' : 'sí'; s.motivo = malos.length ? malos.map(h => h.detalle).join(' ') : 'Plazo de ' + x.programacion.plazo + ' días; todas las actividades programadas.';
      } else if (r.tipoRespuesta === 'documento'){
        const docs = adjuntosDe(o, r.codigo);
        const venc = docs.filter(dd => !Tecnico.vigenteA(dd, fecha || Util.hoyISO()));
        if (r.reglaPuntaje && r.reglaPuntaje.tipo === 'sino') s.valor = docs.length && !venc.length ? 'Sí' : 'No';
        if (!docs.length && r.obligatorio){ s.cumple = r.subsanable ? 'subsanable' : 'no'; s.motivo = 'No adjuntó el documento.'; }
        else if (venc.length){ s.cumple = r.subsanable ? 'subsanable' : 'no'; s.motivo = 'Vencido: ' + venc.map(dd => dd.nombre + ' (' + Util.fmtFecha(dd.vigenteHasta) + ')').join(', ') + '.'; }
        else if (docs.length) s.motivo = docs.length + ' documento(s); verifique su contenido.';
      }
      S[r.codigo] = s;
    });
    return S;
  }

  /* ── Puntaje, orden y sensibilidad ── */
  function puntuar(R, cfg){
    const g = R.general;
    const ponderables = R.requisitos.filter(r => r.naturaleza === 'ponderable');
    const estado = id => R.porOferta[id].habilitacion.estado;
    const habilitadas = R.ofertas.filter(o => estado(o.id) === 'habilitada');
    const provisional = !habilitadas.length || R.ofertas.some(o => estado(o.id) === 'pendiente');
    /* Mientras haya pendientes, el cálculo es provisional y usa las que no están descartadas. */
    const validas = habilitadas.length && !provisional ? habilitadas : R.ofertas.filter(o => estado(o.id) !== 'no habilitada');
    const puntos = {}, faltan = {};
    validas.forEach(o => { puntos[o.id] = {}; faltan[o.id] = []; });
    const economicos = {};
    ponderables.forEach(r => {
      const rp = r.reglaPuntaje || {};
      if (rp.tipo === 'economica'){
        let e;
        try { e = Puntaje.economico(g.metodoEconomico || 'menor', validas.map(o => ({ id:o.id, valor:o.totales.total })),
          { pmax:r.puntajeMaximo, presupuestoOficial:R.presupuestoOficial, kBajo:g.kBajo, kAlto:g.kAlto, trm:cfg.trm }); }
        catch(err){ e = { puntajes:{}, detalle:err.message, error:true }; }
        economicos[r.codigo] = e;
        validas.forEach(o => { if (e.puntajes[o.id] === undefined) faltan[o.id].push(r.codigo); else puntos[o.id][r.codigo] = e.puntajes[o.id]; });
        return;
      }
      if (Puntaje.automatica(r)){
        const valores = {};
        validas.forEach(o => { const v = R.vigente(o.id, r.codigo); if (v && v.valorVerificado !== undefined && v.valorVerificado !== null && v.valorVerificado !== '') valores[o.id] = v.valorVerificado; else faltan[o.id].push(r.codigo); });
        /* La regla compara a los que tienen valor verificado; si falta alguno, el puntaje queda provisional. */
        const res = Object.keys(valores).length ? Puntaje.regla(r, valores) : {};
        Object.keys(res||{}).forEach(id => puntos[id][r.codigo] = res[id]);
        return;
      }
      validas.forEach(o => { const v = R.vigente(o.id, r.codigo); if (v && v.puntaje !== undefined && v.puntaje !== null && v.puntaje !== '') puntos[o.id][r.codigo] = Math.min(Number(r.puntajeMaximo), Number(v.puntaje)); else faltan[o.id].push(r.codigo); });
    });
    const filas = validas.map(o => {
      const grupos = {};
      ponderables.forEach(r => { if (puntos[o.id][r.codigo] !== undefined) grupos[r.grupo] = (grupos[r.grupo] || 0) + puntos[o.id][r.codigo]; });
      const total = Object.values(grupos).reduce((t, x) => t + x, 0);
      const economico = grupos['Económico'] || 0;
      return { id:o.id, nombre:o.nombre, total:Util.redondearDec(total, 2), economico:Util.redondearDec(economico, 2), tecnico:Util.redondearDec(total - economico, 2), grupos, puntos:puntos[o.id], faltan:faltan[o.id] };
    });
    const ord = Puntaje.orden(filas, g.reglasEmpate, cfg.sorteo);
    return { filas, orden:ord.orden, empates:ord.empates, economicos, provisional:provisional || filas.some(f => f.faltan.length), ponderables:ponderables.map(r => r.codigo),
      noHabilitadas:R.ofertas.filter(o => estado(o.id) === 'no habilitada').map(o => o.id),
      sensibilidad:filas.length > 1 ? Puntaje.sensibilidad(filas, g.reglasEmpate, cfg.sorteo) : [] };
  }

  /* ── Alertas de todo el análisis ── */
  function alertas(R, d){
    const L = [];
    const add = (tipo, x) => { try { L.push(Alertas.nueva(tipo, x)); } catch(e){ /* sin evidencia: no se publica */ } };
    const { renglon, requisito, documento, dato } = Alertas;
    const cierre = String(d.cierre || '').slice(0, 10), firma = String(d.firma || '').slice(0, 10);
    R.ofertas.forEach(o => {
      const x = R.porOferta[o.id], ids = [o.id], N = o.nombre;
      /* §18.1 */
      const ar = x.aritmetica;
      const sinPrecio = ar.renglones.filter(z => z.problemas.some(q => q === 'sin precio' || q === 'precio en cero'));
      if (sinPrecio.length) add('sin precio', { ofertas:ids, objeto:'', titulo:N + ': ' + sinPrecio.length + ' actividad(es) sin precio o en cero', donde:sinPrecio.slice(0, 8).map(z => z.codigo).join(', '),
        regla:'Toda actividad del formulario lleva precio (§18.1).', evidencia:sinPrecio.slice(0, 12).map(z => renglon(z.codigo, 'aritmetica')) });
      const noSuma = ar.renglones.filter(z => z.problemas.indexOf('el APU no suma el precio unitario') >= 0);
      if (noSuma.length) add('apu no suma', { ofertas:ids, titulo:N + ': ' + noSuma.length + ' precio(s) unitario(s) que no son la suma de su APU',
        donde:noSuma.slice(0, 6).map(z => z.codigo + ' (declarado ' + Util.money3(z.declarado) + ', APU ' + Util.money3(z.recalculado) + ')').join('; '),
        regla:'Tolerancia de medio peso por renglón; prevalece el precio unitario recalculado.', evidencia:noSuma.slice(0, 12).map(z => renglon(z.codigo, 'aritmetica')) });
      if (ar.totales.length) add('aritmética', { ofertas:ids, titulo:N + ': los totales declarados no cuadran con el recálculo',
        donde:ar.totales.map(t => t.concepto + ' declarado ' + Util.money(t.declarado) + ' y recalculado ' + Util.money(t.recalculado)).join('; '),
        regla:'Los totales se recalculan con las cantidades del pliego y los precios unitarios (§5.5).', evidencia:[renglon('', 'aritmetica'), dato(o.id, 'Total declarado', Util.money(ar.totalDeclarado))] });
      /* §18.3 */
      const vb = R.valorBajo.filas.find(f => f.id === o.id);
      if (vb && vb.bajo) add('valor bajo', { ofertas:ids, titulo:N + ': valor artificialmente bajo', donde:Util.money(vb.total) + ', ' + Util.redondearDec(-vb.desvMediana * 100, 1) + ' % por debajo de la mediana de las ofertas (' + Util.money(R.valorBajo.mediana) + ')' +
        (vb.desvBase !== null ? ' y ' + Util.redondearDec(-vb.desvBase * 100, 1) + ' % por debajo del presupuesto base' : '') + '.', regla:'Más de ' + R.valorBajo.umbralPct + ' % por debajo de la mediana de las ofertas (pliego).',
        evidencia:[renglon('', 'aritmetica'), dato(o.id, 'Valor recalculado', Util.money(vb.total))] });
      if (o.totales.total > R.presupuestoOficial + 0.5 && R.general.rechazarSobrePresupuesto) add('sobre presupuesto', { ofertas:ids, titulo:N + ': supera el presupuesto oficial',
        donde:Util.money(o.totales.total) + ' frente a ' + Util.money(R.presupuestoOficial) + '.', regla:'El pliego rechaza las ofertas por encima del presupuesto oficial.', evidencia:[dato(o.id, 'Valor recalculado', Util.money(o.totales.total))] });
      const db = R.desbalance.marcadas.filter(z => z.ofertaId === o.id);
      if (db.length) add('desbalance', { ofertas:ids, titulo:N + ': ' + db.length + ' actividad(es) desbalanceada(s)', donde:'Indicador de desbalance ' + Util.redondearDec(R.desbalance.indicador[o.id] * 100, 2) + ' %. ' +
        db.slice(0, 6).map(z => z.codigo + ' (' + (z.razonBase !== null ? (z.razonBase >= 1 ? '+' : '') + Util.redondearDec((z.razonBase - 1) * 100, 1) + ' %' : '—') + ')').join(', '),
        regla:'z robusto mayor que ' + R.desbalance.config.z + ', o más de ±' + R.desbalance.config.pct + ' % frente a la base en una actividad que pesa más del ' + R.desbalance.config.pesoMinPct + ' %.' + (R.desbalance.nota ? ' ' + R.desbalance.nota : ''),
        evidencia:db.slice(0, 12).map(z => renglon(z.codigo, 'desbalance')) });
      if (x.cargue.aplica && x.cargue.alerta) add('cargue al inicio', { ofertas:ids, titulo:N + ': precios cargados al inicio de la obra', donde:x.cargue.detalle,
        regla:'Primer tercio por encima de +' + x.cargue.config.pct + ' % y último tercio por debajo de −' + x.cargue.config.pct + ' % frente a la base, ponderado por valor.',
        evidencia:x.cargue.grupos[0].concat(x.cargue.grupos[2]).slice(0, 12).map(z => renglon(z.codigo, 'desbalance')) });
      ['sobrecosto', 'reclamación'].forEach(tipo => { const L2 = R.cantidades.lista.filter(z => z.ofertaId === o.id && z.tipo === tipo);
        if (L2.length) add('riesgo de cantidades', { ofertas:ids, objeto:tipo, nivel:tipo === 'sobrecosto' ? 'importante' : 'observación', titulo:N + ': ' + L2.length + ' actividad(es) de cantidad incierta con riesgo de ' + tipo,
          donde:L2.map(z => z.codigo + ' (' + Util.redondearDec((z.razon - 1) * 100, 1) + ' % frente a la base)').join(', '), regla:'Actividad marcada «cantidad incierta» con precio más de ±' + R.cantidades.config.pct + ' % frente a la base.',
          evidencia:L2.slice(0, 12).map(z => renglon(z.codigo)) }); });
      /* §18.2 AIU */
      if (x.administracion.length) add('aiu', { ofertas:ids, titulo:N + ': la administración no cuadra con el personal o el plazo', donde:x.administracion.map(h => h.detalle).join(' '),
        regla:'El desglose de A cuadra con A y cubre el personal ofrecido, con su dedicación, durante el plazo.', evidencia:[renglon('', 'aiu'), dato(o.id, 'Administración', Util.money(x.aiu.a))] });
      if (!x.aiu.ivaBien) add('iva', { ofertas:ids, titulo:N + ': el IVA no está sobre la base del pliego', donde:'La oferta liquida el IVA con base «' + ((o.oferta.presupuesto||{}).iva||{}).base + '» y tarifa ' + (((o.oferta.presupuesto||{}).iva||{}).tarifa) + ' %; el pliego dice «' + x.aiu.ivaEsperado.base + '» y ' + x.aiu.ivaEsperado.tarifa + ' %.',
        regla:'IVA sobre la utilidad en contratos con AIU, o sobre el total, según el pliego.', evidencia:[renglon('', 'aiu')] });
      /* §18.4 APU */
      const H = R.apu.hallazgos.filter(h => h.ofertaId === o.id);
      const mo = H.filter(h => h.tipo === 'mano de obra bajo el mínimo');
      if (mo.length) add('mano de obra', { ofertas:ids, titulo:N + ': mano de obra por debajo del costo empresa mínimo', donde:mo.map(h => h.detalle).join(' '),
        regla:'Jornal o hora por debajo del SMMLV de la vigencia con prestaciones y seguridad social (Parámetros).', evidencia:mo.slice(0, 12).map(h => renglon(h.codigo, 'apu')) });
      ['rendimiento','insumo bajo el mercado','insumo faltante','sin herramienta menor','sin transporte','desperdicio inusual'].forEach(t => { const L2 = H.filter(h => h.tipo === t);
        if (L2.length) add('apu', { ofertas:ids, objeto:t, titulo:N + ': ' + L2.length + ' APU con ' + t, donde:L2.slice(0, 4).map(h => h.codigo + ': ' + h.detalle).join(' '),
          regla:{ rendimiento:'Jornales por unidad con z robusto mayor que 3,5 o más de ±' + R.apu.config.rendimientoPct + ' % frente a la base.', 'insumo bajo el mercado':'Más de ' + R.apu.config.insumoBajoPct + ' % por debajo de la base de precios (insumos emparejados).',
            'insumo faltante':'Falta un insumo que pesa ' + R.apu.config.pesoFaltantePct + ' % o más del APU de la base.', 'desperdicio inusual':'Cantidad de material más de ' + R.apu.config.desperdicioPct + ' % por encima de la base.' }[t] || 'Comparado con el APU de la base.',
          evidencia:L2.slice(0, 12).map(h => renglon(h.codigo, 'apu')) }); });
      /* §18.6 a §18.9 */
      Object.keys(x.financiero).forEach(c => { const malos = x.financiero[c].indicadores.filter(i => i.cumple === false);
        if (malos.length) add('financiero', { ofertas:ids, objeto:c, titulo:N + ': ' + malos.map(i => i.nombre).join(', ') + ' por fuera del umbral', donde:malos.map(i => i.calculo).join(' · '),
          regla:malos.map(i => i.texto).join('; ') + ' (' + c + ').', evidencia:[requisito(c)].concat(adjuntosDe(o, 'FIN-01').slice(0, 1).map(dd => documento(dd))) }); });
      Object.keys(x.experiencia).forEach(c => { const e = x.experiencia[c];
        if (e.cumpleSuma === false) add('experiencia', { ofertas:ids, objeto:c, titulo:N + ': la experiencia no alcanza lo exigido (' + c + ')', donde:'Suma ' + Util.cant(Util.redondearDec(e.suma, 2)) + ' SMMLV frente a ' + Util.cant(Util.redondearDec(e.exigido, 2)) + ' exigidos.',
          regla:'Suma ≥ ' + e.reglas.multiplo + ' × presupuesto oficial en SMMLV; ' + (e.reglas.maxContratos ? 'máximo ' + e.reglas.maxContratos + ' contratos; ' : '') + (e.reglas.anios ? 'últimos ' + e.reglas.anios + ' años.' : ''), evidencia:[requisito(c)] });
        e.avisos.forEach(a => add('experiencia', { ofertas:ids, objeto:c + ' ' + a.tipo + ' ' + a.filas.join('-'), nivel:a.tipo === 'repetido' ? 'importante' : 'observación', titulo:N + ': contrato ' + a.tipo + ' en ' + c, donde:a.detalle,
          regla:'Un contrato se acredita una sola vez.', evidencia:[requisito(c)] })); });
      Object.keys(x.personal).forEach(c => x.personal[c].filter(f => !f.cumple).forEach(f => add('personal', { ofertas:ids, objeto:c + ' ' + f.fila, titulo:N + ': ' + (f.cargo || c) + ' no cumple lo exigido', donde:(f.nombre || '') + ': ' + f.faltas.join('; ') + '.',
        regla:'Lo que exige el requisito ' + c + ' para el cargo.', evidencia:[requisito(c)] })));
      x.dobleCargo.forEach(z => add('misma persona', { ofertas:ids, objeto:z.nombre, titulo:N + ': ' + z.nombre + ' en dos cargos que suman ' + z.suma + ' % de dedicación', donde:z.cargos.join(' y ') + '.',
        regla:'Una persona no supera el 100 % de dedicación.', evidencia:[requisito(z.requisito)] }));
      const pr = x.programacion;
      pr.hallazgos.forEach((h, k) => add('programación', { ofertas:ids, objeto:h.tipo + ' ' + (h.codigo || k), nivel:h.tipo === 'plazo' ? 'crítica' : h.tipo === 'orden lógico' ? 'observación' : 'importante',
        titulo:N + ': ' + ({ plazo:'plazo programado mayor que el máximo', 'sin programar':'actividades sin programar', dependencia:'dependencia que no se respeta', ciclo:'dependencias en ciclo', 'predecesora inexistente':'predecesora inexistente',
          'orden lógico':'orden constructivo dudoso', 'duración incoherente':'duración incoherente con su mano de obra', 'sin programación':'sin programación' })[h.tipo], donde:h.detalle,
        regla:{ plazo:'Plazo total ≤ plazo máximo del pliego.', 'duración incoherente':'Duración ≥ la mitad de cantidad × jornales por unidad ÷ cuadrillas.' }[h.tipo] || 'Programación con dependencias lógicas y toda actividad programada (§18.9).',
        evidencia:[requisito((R.requisitos.find(r => r.grupo === 'Programación') || {}).codigo || '')].concat(h.codigo ? [renglon(h.codigo)] : []) }));
      if (x.organigrama.length) add('organigrama', { ofertas:ids, titulo:N + ': el organigrama no coincide con el equipo', donde:x.organigrama.slice(0, 4).join(' '), regla:'Organigrama, personal ofrecido y administración del AIU coherentes.',
        evidencia:[requisito((R.requisitos.find(r => r.grupo === 'Organigrama') || {}).codigo || '')] });
      /* Documentos y requisitos */
      (o.documentos||[]).forEach(dd => {
        if (dd.vigenteHasta && cierre && dd.vigenteHasta < cierre) add('documento vencido', { ofertas:ids, objeto:dd.id, titulo:N + ': «' + dd.nombre + '» vencido (' + dd.requisito + ')', donde:'Vigente hasta el ' + Util.fmtFecha(dd.vigenteHasta) + '; el cierre fue el ' + Util.fmtFecha(cierre) + '.',
          regla:'Todo documento vigente a la fecha de cierre.', evidencia:[documento(dd)] });
        else if (dd.vigenteHasta && firma && dd.vigenteHasta < firma) add('documento vence', { ofertas:ids, objeto:dd.id, titulo:N + ': «' + dd.nombre + '» vence antes de la firma del contrato', donde:'Vigente hasta el ' + Util.fmtFecha(dd.vigenteHasta) + '; la firma está prevista para el ' + Util.fmtFecha(firma) + '.',
          regla:'Vigencia hasta la fecha prevista de firma.', evidencia:[documento(dd)] });
        if (dd.meta && dd.meta.legible === false) add('documento ilegible', { ofertas:ids, objeto:dd.id, titulo:N + ': «' + dd.nombre + '» no se puede leer', donde:dd.meta.error || 'El PDF no abre.', regla:'Todo documento legible.', evidencia:[documento(dd)] });
      });
      R.requisitos.filter(r => r.obligatorio && sinRespuesta(o, r)).forEach(r => add('sin respuesta', { ofertas:ids, objeto:r.codigo, titulo:N + ': ' + r.codigo + ' sin respuesta', donde:r.nombre + '.', regla:'Requisito obligatorio del pliego.', evidencia:[requisito(r.codigo, '11')] }));
      if (o.versionAnterior) add('versión anterior', { ofertas:ids, titulo:N + ': oferta sobre la versión ' + o.versionPliego + ' del pliego', donde:'La versión vigente al cierre es otra.', regla:'Toda oferta sobre la versión vigente (§16).', evidencia:[dato(o.id, 'Versión del pliego', o.versionPliego)] });
      (d.evaluaciones||[]).filter(e => e.ofertaId === o.id && e.sinFirma).forEach(e => { const v = vigentes(d.evaluaciones).get(o.id + '|' + e.requisitoId); if (v === e) add('firma faltante', { ofertas:ids, objeto:e.requisitoId, titulo:N + ': ' + e.requisitoId + ' sin firma',
        donde:e.observacion || 'El evaluador marcó que falta la firma.', regla:'Documento firmado por quien corresponde.', evidencia:(e.evidencia||[]).filter(z => z.docId).slice(0, 2).map(z => ({ tipo:'documento', docId:z.docId, sha256:z.sha256, nombre:z.nombre, pagina:z.pagina || 1 })).concat([requisito(e.requisitoId, '11')]) }); });
    });
    Alertas.colusion(R.ofertas, R.ctx.base).forEach(a => L.push(a));
    return L;
  }

  return { CUMPLE, configuracion, vigentes, ultimaSubsanacion, filasDe, adjuntosDe, sinRespuesta, declarado, analizar };
})();
