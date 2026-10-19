/* ══════════════════════════════════════════════════════════════════════════
   VERIFICACIÓN TÉCNICA, LEGAL Y FINANCIERA (§18.5 a §18.9) — lo que se
   puede calcular de lo que declaró el proponente: indicadores financieros,
   experiencia en SMMLV, personal, sistemas de gestión, programación con su
   ruta crítica y su curva S, y organigrama. El evaluador confirma cada punto
   con el documento a la vista; aquí no se escribe ningún «cumple».

   Los umbrales salen de las reglas de verificación del pliego, escritas en
   el módulo 04 («Liquidez ≥ 1,5»): lo que el proponente leyó es lo que se
   aplica. Si una regla no se puede leer, se dice y la verifica la persona.
   ══════════════════════════════════════════════════════════════════════════ */
const Tecnico = (function(){

  /** «1,5» o «1.5» o «0,65» → número. */
  function numero(s){
    const t = String(s||'').trim();
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
    return Number(t.replace(',', '.'));
  }
  const OP = { '≥':'>=', '>=':'>=', '≤':'<=', '<=':'<=', '>':'>', '<':'<' };
  function cumpleOp(v, op, u){ return op === '>=' ? v >= u - 1e-12 : op === '<=' ? v <= u + 1e-12 : op === '>' ? v > u : v < u; }

  /* ── §18.6 Financiero ── */
  const INDICADORES = [
    ['liquidez', 'Liquidez', /liquidez\s*(≥|>=|≤|<=|>|<)\s*([\d.,]+)/i, 'AC / PC'],
    ['endeudamiento', 'Endeudamiento', /endeudamiento\s*(≥|>=|≤|<=|>|<)\s*([\d.,]+)/i, 'PT / AT'],
    ['cobertura', 'Cobertura de intereses', /cobertura de intereses\s*(≥|>=|≤|<=|>|<)\s*([\d.,]+)/i, 'UO / GI'],
    ['capitalTrabajo', 'Capital de trabajo', /capital de trabajo\s*(≥|>=|≤|<=|>|<)\s*([\d.,]+)\s*%\s*del presupuesto oficial/i, 'AC − PC'],
    ['rentPatrimonio', 'Rentabilidad del patrimonio', /rentabilidad del patrimonio\s*(≥|>=|≤|<=|>|<)\s*([\d.,]+)/i, 'UO / P'],
    ['rentActivo', 'Rentabilidad del activo', /rentabilidad del activo\s*(≥|>=|≤|<=|>|<)\s*([\d.,]+)/i, 'UO / AT']
  ];
  /** Umbrales de los requisitos financieros, leídos de sus reglas. */
  function umbralesFinancieros(requisitos){
    const L = [];
    (requisitos||[]).filter(r => r.activo !== false && (r.grupo === 'Financiero' || r.grupo === 'Organizacional')).forEach(r =>
      (r.reglasVerificacion||[]).forEach(t => INDICADORES.forEach(([clave, nombre, re, formula]) => {
        const m = re.exec(t);
        if (m) L.push({ clave, nombre, formula, op:OP[m[1]], valor:numero(m[2]), porcentajePO:clave === 'capitalTrabajo', requisito:r.codigo, texto:t });
      })));
    return L;
  }
  /** Indicadores de unos estados financieros. */
  function indicadores(f){
    const n = k => Number((f||{})[k] || 0);
    const div = (a, b) => b ? a / b : null;
    return { liquidez:div(n('activoCorriente'), n('pasivoCorriente')), endeudamiento:div(n('pasivoTotal'), n('activoTotal')),
      cobertura:n('gastosIntereses') ? n('utilidadOperacional') / n('gastosIntereses') : null, sinIntereses:!n('gastosIntereses'),
      capitalTrabajo:n('activoCorriente') - n('pasivoCorriente'), rentPatrimonio:div(n('utilidadOperacional'), n('patrimonio')),
      rentActivo:div(n('utilidadOperacional'), n('activoTotal')) };
  }
  /** Consorcio (Anexo C): cada componente se suma ponderado por la
      participación antes de dividir. integrantes = [{ porcentaje, financiero }]. */
  function combinarConsorcio(integrantes){
    const claves = ['activoCorriente','pasivoCorriente','activoTotal','pasivoTotal','patrimonio','utilidadOperacional','gastosIntereses'];
    const r = {};
    claves.forEach(k => r[k] = (integrantes||[]).reduce((t, x) => t + Number((x.financiero||{})[k] || 0) * Number(x.porcentaje||0) / 100, 0));
    return r;
  }
  /** Cada indicador con su umbral, el cálculo a la vista y si cumple. */
  function financiero(f, umbrales, presupuestoOficial){
    const ind = indicadores(f);
    return (umbrales||[]).map(u => {
      let valor = ind[u.clave], limite = u.valor, cumple = null, calculo = '';
      const n = k => Util.money(Number((f||{})[k] || 0));
      if (u.clave === 'cobertura' && ind.sinIntereses){ cumple = true; calculo = 'Sin gastos de intereses: cumple (regla del pliego).'; valor = null; }
      else if (u.clave === 'capitalTrabajo'){
        limite = Number(presupuestoOficial||0) * u.valor / 100;
        cumple = cumpleOp(valor, u.op, limite);
        calculo = n('activoCorriente') + ' − ' + n('pasivoCorriente') + ' = ' + Util.money(valor) + ' frente a ' + Util.cant(u.valor) + ' % del presupuesto oficial (' + Util.money(limite) + ')';
      } else if (valor === null){ calculo = 'No se puede calcular: falta el denominador.'; cumple = false; }
      else {
        cumple = cumpleOp(valor, u.op, limite);
        calculo = u.formula + ' = ' + Util.cant(Util.redondearDec(valor, 3)) + '; el pliego exige ' + ({ '>=':'≥', '<=':'≤', '>':'>', '<':'<' })[u.op] + ' ' + Util.cant(limite);
      }
      return Object.assign({}, u, { valorCalculado:valor, limite, cumple, calculo });
    });
  }

  /* ── §18.7 Experiencia ── */
  /** Reglas de experiencia leídas de un requisito (Anexo B, EXP-01). */
  function reglasExperiencia(r){
    const t = (r ? (r.reglasVerificacion||[]).concat([r.descripcion||'']) : []).join(' · ');
    const m1 = /m[aá]ximo\s+(\d+)\s+contratos?/i.exec(t) || /hasta\s+(\d+)\s+contratos?/i.exec(t);
    const m2 = /[uú]ltimos\s+(\d+)\s+a[nñ]os/i.exec(t);
    const m3 = /suma[^·]*?(≥|>=)\s*([\d.,]+)\s*(?:×|x|veces)\s*(?:el\s+)?presupuesto oficial/i.exec(t);
    const m4 = /al menos (?:uno|un contrato)[^·]*?(≥|>=)\s*([\d.,]+)\s*(?:×|x|veces)\s*(?:el\s+)?presupuesto oficial/i.exec(t);
    const m5 = /[aá]rea construida m[ií]nima\s*(?:de)?\s*([\d.,]+)/i.exec(t);
    return { maxContratos:m1 ? Number(m1[1]) : null, anios:m2 ? Number(m2[1]) : null, multiplo:m3 ? numero(m3[2]) : null,
      multiploIndividual:m4 ? numero(m4[2]) : null, areaMinima:m5 ? numero(m5[1]) : null, tipologia:/tipolog[ií]a/i.test(t) };
  }
  function anioDe(iso){ const d = Util.fechaDe(iso); return d ? d.getFullYear() : null; }
  /** Cada contrato en SMMLV del año de terminación × participación; los
      que cuentan (los primeros N, terminados en los últimos años) y la suma
      frente al presupuesto oficial en SMMLV. */
  function experiencia(filas, reglas, ctx){
    const R = reglas || {};
    const cierre = Util.fechaDe(ctx.fechaCierre) || new Date();
    const smmlvPO = ctx.presupuestoOficial && Parametros.smmlv(ctx.parametros, cierre.getFullYear()) ? ctx.presupuestoOficial / Parametros.smmlv(ctx.parametros, cierre.getFullYear()) : null;
    const contratos = (filas||[]).map((f, i) => {
      const anio = anioDe(f.terminacion);
      const smmlv = anio ? Parametros.smmlv(ctx.parametros, anio) : null;
      const enSmmlv = anio ? Parametros.enSmmlv(ctx.parametros, Number(f.valor||0), anio, f.participacion) : null;
      const fin = Util.fechaDe(f.terminacion);
      const dentroPlazo = !R.anios || (fin && (cierre - fin) / (365.25 * 86400000) <= R.anios + 1e-9);
      const terminado = fin && fin <= cierre;
      const tipologiaOk = !ctx.tipologia ? null : Util.normaliza(f.tipologia).indexOf(Util.normaliza(ctx.tipologia)) >= 0 || Util.normaliza(f.objeto).indexOf(Util.normaliza(ctx.tipologia)) >= 0;
      return { fila:i, contratante:f.contratante, objeto:f.objeto, inicio:f.inicio, terminacion:f.terminacion, valor:Number(f.valor||0), participacion:f.participacion === '' || f.participacion === undefined ? 100 : Number(f.participacion),
        area:Number(f.area||0), tipologia:f.tipologia, anio, smmlv, enSmmlv, dentroPlazo:!!dentroPlazo, terminado:!!terminado, tipologiaOk, cuenta:false, motivo:'' };
    });
    let n = 0;
    contratos.forEach(c => {
      if (!c.smmlv){ c.motivo = 'Sin SMMLV para el año de terminación'; return; }
      if (!c.terminado){ c.motivo = 'No está terminado a la fecha de cierre'; return; }
      if (!c.dentroPlazo){ c.motivo = 'Terminado hace más de ' + R.anios + ' años'; return; }
      if (R.maxContratos && n >= R.maxContratos){ c.motivo = 'Pasa del máximo de ' + R.maxContratos + ' contratos (cuentan los primeros, en el orden declarado)'; return; }
      c.cuenta = true; n++;
    });
    const suma = contratos.filter(c => c.cuenta).reduce((t, c) => t + c.enSmmlv, 0);
    const exigido = R.multiplo && smmlvPO ? R.multiplo * smmlvPO : null;
    const individual = R.multiploIndividual && smmlvPO ? R.multiploIndividual * smmlvPO : null;
    const area = contratos.filter(c => c.cuenta && c.tipologiaOk !== false).reduce((t, c) => t + c.area * c.participacion / 100, 0);
    /* Repetidos y traslapes dentro de la misma oferta. */
    const avisos = [];
    contratos.forEach((a, i) => contratos.slice(i + 1).forEach(b => {
      if (Util.normaliza(a.contratante) === Util.normaliza(b.contratante) && Util.igualDinero(a.valor, b.valor))
        avisos.push({ tipo:'repetido', filas:[a.fila, b.fila], detalle:'Los renglones ' + (a.fila + 1) + ' y ' + (b.fila + 1) + ' tienen el mismo contratante y el mismo valor: parecen el mismo contrato dos veces.' });
      else if (Util.normaliza(a.contratante) === Util.normaliza(b.contratante) && a.inicio && b.inicio && a.terminacion && b.terminacion && a.inicio <= b.terminacion && b.inicio <= a.terminacion)
        avisos.push({ tipo:'traslape', filas:[a.fila, b.fila], detalle:'Los renglones ' + (a.fila + 1) + ' y ' + (b.fila + 1) + ' son del mismo contratante y sus fechas se traslapan.' });
    }));
    return { contratos, suma, exigido, smmlvPO, cumpleSuma:exigido === null ? null : suma + 1e-9 >= exigido,
      cumpleIndividual:individual === null ? null : contratos.some(c => c.cuenta && c.enSmmlv + 1e-9 >= individual), individual, area, reglas:R, avisos };
  }
  /** Huella de un contrato para encontrarlo en otra oferta. */
  function huellaContrato(f){ return [Util.normaliza(f.contratante), Util.redondear(Number(f.valor||0)), String(f.terminacion||'').slice(0, 7)].join('|'); }

  /* ── §18.8 Personal ── */
  function exigenciasPersonal(r){
    const t = [(r && r.descripcion) || ''].concat((r && r.reglasVerificacion) || []).join(' · ');
    const a = /(\d+)\s*a[nñ]os de experiencia/i.exec(t);
    const d = /dedicaci[oó]n(?:\s+m[ií]nima)?(?:\s+del?)?\s*(?:≥\s*)?(\d+)\s*%/i.exec(t);
    return { anios:a ? Number(a[1]) : null, dedicacion:d ? Number(d[1]) : null, matricula:/matr[ií]cula/i.test(t) };
  }
  /** Cada persona con lo que exige su cargo. */
  function personal(filas, r){
    const ex = exigenciasPersonal(r);
    return (filas||[]).map((f, i) => {
      const anios = Number(f.anios||0), ded = Number(f.dedicacion||0);
      const faltas = [];
      if (ex.anios !== null && anios + 1e-9 < ex.anios) faltas.push(anios + ' años de experiencia; se exigen ' + ex.anios);
      if (ex.dedicacion !== null && ded + 1e-9 < ex.dedicacion) faltas.push('dedicación de ' + ded + ' %; se exige ' + ex.dedicacion + ' %');
      if (ex.matricula && !String(f.matricula||'').trim()) faltas.push('sin matrícula profesional');
      return { fila:i, cargo:f.cargo, nombre:f.nombre, documento:f.documento, matricula:f.matricula, profesion:f.profesion, anios, dedicacion:ded,
        sobreMinimo:ex.anios !== null ? Math.max(0, anios - ex.anios) : anios, exigido:ex, faltas, cumple:!faltas.length };
    });
  }
  function idPersona(f){
    const doc = String(f.documento||'').replace(/[^0-9a-z]/gi, ''), mat = Util.normaliza(f.matricula).replace(/[^0-9a-z]/g, '');
    return { doc:doc.length >= 5 ? doc : '', mat:mat.length >= 4 ? mat : '' };
  }

  /* ── §18.8 Sistemas de gestión ── */
  /** Resolución 0312 de 2019: < 60 % crítico; 60 % a 85 % moderadamente aceptable; > 85 % aceptable. */
  function clasificarSgsst(pct){
    const v = Number(pct);
    if (!isFinite(v)) return null;
    return v < 60 ? 'crítico' : v <= 85 ? 'moderadamente aceptable' : 'aceptable';
  }
  /** Un documento sirve si existe y su vigencia cubre la fecha de referencia. */
  function vigenteA(doc, fechaISO){ return !doc.vigenteHasta || String(doc.vigenteHasta) >= String(fechaISO).slice(0, 10); }

  /* ── §18.9 Programación ── */
  function diasLaborables(desde, hasta){
    const a = Util.fechaDe(desde), b = Util.fechaDe(hasta);
    if (!a || !b || b < a) return 0;
    let n = 0;
    for (const d = new Date(a.getTime()); d <= b; d.setDate(d.getDate() + 1)) if (d.getDay() !== 0 && !Festivos.esFestivo(d)) n++;
    return n;
  }
  /* Orden lógico mínimo entre capítulos (por su nombre): lo de la izquierda
     empieza antes que lo de la derecha. No se enchapa antes de la mampostería. */
  const ORDEN_LOGICO = [['los preliminares', /preliminar/i, 'la cimentación, la estructura o la mampostería', /cimentaci|estructur|mamposter/i],
    ['la cimentación', /cimentaci/i, 'la estructura', /estructur/i], ['la estructura', /estructur/i, 'la cubierta', /cubierta/i],
    ['la mampostería', /mamposter/i, 'los acabados', /acabad|enchap|pintur|piso/i]];

  /** Ruta crítica con el método del camino crítico (precedencia fin a
      inicio), a partir de las duraciones y las predecesoras declaradas. */
  function rutaCritica(nodos){
    const idx = new Map(nodos.map((n, i) => [n.clave, i]));
    const preds = nodos.map(n => n.predecesoras.map(p => idx.get(p)).filter(i => i !== undefined));
    const grado = nodos.map((n, i) => preds[i].length), sig = nodos.map(() => []);
    preds.forEach((ps, i) => ps.forEach(j => sig[j].push(i)));
    const orden = [], cola = grado.map((g, i) => g === 0 ? i : -1).filter(i => i >= 0);
    while (cola.length){ const i = cola.shift(); orden.push(i); sig[i].forEach(j => { if (--grado[j] === 0) cola.push(j); }); }
    if (orden.length < nodos.length) return { ciclo:true, nodos:nodos.filter((n, i) => orden.indexOf(i) < 0).map(n => n.nombre) };
    const es = [], ef = [];
    orden.forEach(i => { es[i] = preds[i].length ? Math.max.apply(null, preds[i].map(j => ef[j])) : 0; ef[i] = es[i] + nodos[i].duracion; });
    const fin = Math.max.apply(null, ef.concat([0]));
    const lf = [], ls = [];
    orden.slice().reverse().forEach(i => { lf[i] = sig[i].length ? Math.min.apply(null, sig[i].map(j => ls[j])) : fin; ls[i] = lf[i] - nodos[i].duracion; });
    const R = nodos.map((n, i) => ({ clave:n.clave, nombre:n.nombre, es:es[i], ef:ef[i], ls:ls[i], lf:lf[i], holgura:ls[i] - es[i], critica:Math.abs(ls[i] - es[i]) < 1e-9 }));
    return { ciclo:false, duracion:fin, actividades:R, critica:R.filter(x => x.critica).sort((a, b) => a.es - b.es).map(x => x.nombre) };
  }
  /** La programación de una oferta: plazo, actividades sin programar,
      dependencias, ruta crítica, coherencia con la mano de obra del APU y
      curva S. of = { pres } (la oferta como presupuesto de ARKEN). */
  function programacion(filas, of, ctx){
    const ix = Presupuestal.indice(of.pres);
    const porCodigo = new Map(), porNombre = new Map();
    ix.acts.forEach((x, k) => { porCodigo.set(Util.normaliza(x.codigo), k); porNombre.set(Util.normaliza(x.nombre), k); });
    const buscar = s => porCodigo.get(Util.normaliza(s)) || porNombre.get(Util.normaliza(s)) || null;
    const ok = (filas||[]).filter(f => Util.fechaDe(f.inicio) && Util.fechaDe(f.fin));
    const hallazgos = [];
    if (!ok.length) return { aplica:false, hallazgos:[{ tipo:'sin programación', detalle:'La oferta no trae una programación con fechas.' }] };
    const t0 = Math.min.apply(null, ok.map(f => Util.fechaDe(f.inicio).getTime())), t1 = Math.max.apply(null, ok.map(f => Util.fechaDe(f.fin).getTime()));
    const plazo = Math.round((t1 - t0) / 86400000) + 1;
    if (ctx.plazoMaximoDias && plazo > ctx.plazoMaximoDias) hallazgos.push({ tipo:'plazo', detalle:'El plazo programado es de ' + plazo + ' días y el máximo del pliego es de ' + ctx.plazoMaximoDias + '.' });
    const programadas = new Set(ok.map(f => buscar(f.actividad)).filter(Boolean));
    const sinProgramar = [];
    ix.acts.forEach((x, k) => { if (!programadas.has(k)) sinProgramar.push(x.codigo); });
    if (sinProgramar.length) hallazgos.push({ tipo:'sin programar', detalle:sinProgramar.length + ' actividad(es) del presupuesto no están programadas: ' + sinProgramar.slice(0, 8).join(', ') + (sinProgramar.length > 8 ? '…' : '') + '.', codigos:sinProgramar });
    /* Nodos para la ruta crítica, con la clave normalizada de cada renglón. */
    const claveDe = f => Util.normaliza(f.actividad);
    const existe = new Set(ok.map(claveDe));
    const nodos = ok.map(f => {
      const ps = String(f.predecesoras||'').split(/[,;]/).map(s => Util.normaliza(s)).filter(Boolean);
      ps.filter(p => !existe.has(p)).forEach(p => hallazgos.push({ tipo:'predecesora inexistente', detalle:'«' + f.actividad + '» depende de «' + p + '», que no está en la programación.' }));
      return { clave:claveDe(f), nombre:f.actividad, duracion:Math.round((Util.fechaDe(f.fin) - Util.fechaDe(f.inicio)) / 86400000) + 1, predecesoras:ps.filter(p => existe.has(p)), fila:f };
    });
    const porClave = new Map(nodos.map(n => [n.clave, n]));
    nodos.forEach(n => n.predecesoras.forEach(p => { const q = porClave.get(p);
      if (q && Util.fechaDe(n.fila.inicio) <= Util.fechaDe(q.fila.fin)) hallazgos.push({ tipo:'dependencia', detalle:'«' + n.nombre + '» empieza el ' + Util.fmtFecha(n.fila.inicio) + ', antes de que termine su predecesora «' + q.nombre + '» (' + Util.fmtFecha(q.fila.fin) + ').' }); }));
    const cpm = rutaCritica(nodos);
    if (cpm.ciclo) hallazgos.push({ tipo:'ciclo', detalle:'Las dependencias forman un ciclo: ' + cpm.nodos.slice(0, 5).join(', ') + '.' });
    /* Orden lógico entre capítulos. */
    const inicioCap = (re) => { const xs = ok.filter(f => { const k = buscar(f.actividad); return k && re.test(ix.acts.get(k).cap.nombre); }).map(f => Util.fechaDe(f.inicio).getTime()); return xs.length ? Math.min.apply(null, xs) : null; };
    ORDEN_LOGICO.forEach(([na, a, nb, b]) => { const ia = inicioCap(a), ib = inicioCap(b);
      if (ia !== null && ib !== null && ib < ia) hallazgos.push({ tipo:'orden lógico', detalle:'Las actividades de ' + nb + ' empiezan el ' + Util.fmtFecha(Util.isoDe(new Date(ib))) + ', antes que las de ' + na + ' (' + Util.fmtFecha(Util.isoDe(new Date(ia))) + ').' }); });
    /* Coherencia con la mano de obra de su propio APU. */
    const coherencia = [];
    ok.forEach(f => {
      const k = buscar(f.actividad); if (!k) return;
      const x = ix.acts.get(k);
      const jpu = Presupuestal.jornalesPorUnidad(of.pres, x.act, ctx.horasJornal);
      const cuadrillas = Number(f.cuadrillas||0);
      if (!(jpu > 0) || !(cuadrillas > 0)) return;
      const necesarios = x.cantidad * jpu / cuadrillas;
      const programados = diasLaborables(f.inicio, f.fin);
      const fila = { codigo:x.codigo, nombre:x.nombre, cantidad:x.cantidad, jornalesPorUnidad:jpu, cuadrillas, necesarios, programados };
      coherencia.push(fila);
      if (programados < necesarios * 0.5) hallazgos.push({ tipo:'duración incoherente', codigo:x.codigo, detalle:'«' + x.codigo + ' ' + x.nombre + '» está programada en ' + programados + ' días y su propia mano de obra (' + Util.cant(jpu) + ' jornales por ' + x.unidad + ', ' + cuadrillas + ' cuadrilla(s)) necesita ' + Util.cant(Util.redondearDec(necesarios, 1)) + '.' });
    });
    /* Curva S: valor programado por mes, repartido por días. */
    const meses = new Map();
    ok.forEach(f => {
      const k = buscar(f.actividad); if (!k) return;
      const x = ix.acts.get(k);
      const a = Util.fechaDe(f.inicio), b = Util.fechaDe(f.fin);
      const dias = Math.round((b - a) / 86400000) + 1;
      for (const d = new Date(a.getTime()); d <= b; d.setDate(d.getDate() + 1)){
        const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        meses.set(m, (meses.get(m) || 0) + x.valor / dias);
      }
    });
    const claves = Array.from(meses.keys()).sort();
    let acum = 0;
    const total = claves.reduce((t, m) => t + meses.get(m), 0) || 1;
    const curva = claves.map(m => { acum += meses.get(m); return { mes:m, valor:meses.get(m), acumulado:acum, pct:acum / total }; });
    return { aplica:true, plazo, inicio:Util.isoDe(new Date(t0)), fin:Util.isoDe(new Date(t1)), sinProgramar, cpm, coherencia, curva, hallazgos };
  }

  /* ── §18.9 Organigrama ── */
  function organigrama(org, personalFilas, desglose){
    const cargosOrg = new Set((org||[]).map(x => Util.normaliza(x.cargo)).filter(Boolean));
    const L = [];
    if (!(org||[]).length){ L.push('La oferta no trae organigrama.'); return L; }
    (personalFilas||[]).forEach(p => { if (p.cargo && !cargosOrg.has(Util.normaliza(p.cargo))) L.push('El cargo «' + p.cargo + '» del personal ofrecido no está en el organigrama.'); });
    const cargosPer = new Set((personalFilas||[]).map(p => Util.normaliza(p.cargo)));
    (org||[]).forEach(x => { if (x.nombre && x.cargo && !cargosPer.has(Util.normaliza(x.cargo))) L.push('El organigrama tiene «' + x.cargo + '» (' + x.nombre + '), que no está en el personal ofrecido.'); });
    (desglose||[]).forEach(d => (d.filas||[]).forEach(f => { if (f.cargo && !cargosOrg.has(Util.normaliza(f.cargo))) L.push('La administración costea «' + f.cargo + '», que no está en el organigrama.'); }));
    return L;
  }

  return { numero, umbralesFinancieros, indicadores, combinarConsorcio, financiero, reglasExperiencia, experiencia, huellaContrato,
    exigenciasPersonal, personal, idPersona, clasificarSgsst, vigenteA, diasLaborables, rutaCritica, programacion, organigrama };
})();
