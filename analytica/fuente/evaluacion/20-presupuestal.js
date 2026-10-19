/* ══════════════════════════════════════════════════════════════════════════
   ANÁLISIS PRESUPUESTAL (§18.1 a §18.4) — aritmética, capítulos,
   subcapítulos, actividades, insumos, AIU, categorías, desbalance, cargue
   al inicio, riesgo de cantidades, valor artificialmente bajo y APU.

   Todo parte del contexto que arma el programa (o la prueba):
     ctx = { base,                          presupuesto base con la estructura de ARKEN
             ofertas:[{ id, nombre, pres,   la oferta vuelta presupuesto de ARKEN con las
                        totales, oferta,    cantidades del pliego (Sobre.presupuestoDeOferta)
                        recalculo }],
             config,                        umbrales (Presupuestal.CONFIG, editables por proceso)
             emparejamientos,               { clave de insumo de oferta: id de insumo base | 'ninguno' }
             laboral }                      costo empresa mínimo (Parametros.costoEmpresaMinimo)
   Nada se corrige en silencio: cada función devuelve la diferencia, el
   umbral y la regla, y las alertas salen de aquí con su evidencia.
   ══════════════════════════════════════════════════════════════════════════ */
const Presupuestal = (function(){

  /* Valores por defecto, del prompt maestro (§18.3, §18.4). El proceso los
     puede cambiar en 12 › Configuración; el cambio queda en la auditoría. */
  const CONFIG = {
    desbalance:{ z:3.5, pct:30, pesoMinPct:0.5, minPct:10 },
    cargue:{ pct:10 },
    cantidades:{ pct:30 },
    apu:{ rendimientoPct:50, insumoBajoPct:40, pesoFaltantePct:20, desperdicioPct:30 }
  };
  function config(c){
    const r = Util.copia(CONFIG);
    Object.keys(r).forEach(k => Object.assign(r[k], (c||{})[k] || {}));
    return r;
  }

  /* ── Índices ── */
  const claveCap = c => Util.normaliza(c.codigo);
  const claveSub = (c, s) => Util.normaliza(c.codigo) + '|' + Util.normaliza(s.codigo);
  const cache = new WeakMap();
  /** Actividades, subcapítulos y capítulos del presupuesto por su clave. */
  function indice(pres){
    if (cache.has(pres)) return cache.get(pres);
    const acts = new Map(), subs = new Map(), caps = new Map();
    (pres.capitulos||[]).forEach(c => {
      caps.set(claveCap(c), { codigo:c.codigo, nombre:c.nombre, valor:Calculo.valorCapitulo(pres, c) });
      (c.subs||[]).forEach(s => {
        subs.set(claveSub(c, s), { codigo:s.codigo, nombre:s.nombre, capitulo:c.codigo, valor:Calculo.valorSubcapitulo(pres, s) });
        (s.acts||[]).forEach(a => {
          const u = Calculo.unitarioActividad(pres, a);
          acts.set(Sobre.claveActividad(c.codigo, s.codigo, a.codigo), { act:a, sub:s, cap:c, codigo:a.codigo, nombre:a.nombre, unidad:a.unidad,
            cantidad:Number(a.cantidad||0), unitario:u, valor:u * Number(a.cantidad||0) });
        });
      });
    });
    const r = { acts, subs, caps, cd:Calculo.costoDirecto(pres) };
    cache.set(pres, r);
    return r;
  }

  /* ── §18.1 Aritmética ── */
  function sumaApu(ap){ return (ap.insumos||[]).reduce((t, i) => t + Number(i.precio||0) * Number(i.cantidad||0), 0); }
  /** Renglón por renglón: el precio unitario declarado frente al recalculado
      (suma de los APU), las actividades sin precio o en cero, y los totales.
      Regla por defecto: prevalece el precio unitario recalculado y el total
      se recalcula con la cantidad del pliego. */
  function aritmetica(of){
    const rc = of.recalculo || {};
    const renglones = [];
    const declaradas = new Map(((of.oferta||{}).presupuesto||{}).actividades ? of.oferta.presupuesto.actividades.map(a => [Util.normaliza(a.codigo), a]) : []);
    const ix = indice(of.pres);
    ix.acts.forEach(x => {
      const d = declaradas.get(Util.normaliza(x.codigo));
      const declarado = d ? Number(d.precioUnitario||0) : null;
      const apus = d ? (d.apus||[]).filter(ap => (ap.insumos||[]).length) : [];
      const sumaApus = apus.reduce((t, ap) => t + sumaApu(ap), 0);
      const problemas = [];
      if (!d || (!apus.length && !(declarado > 0))) problemas.push('sin precio');
      else if (!(x.unitario > 0)) problemas.push('precio en cero');
      if (apus.length && declarado !== null && !Util.igualDinero(declarado, sumaApus)) problemas.push('el APU no suma el precio unitario');
      if (problemas.length) renglones.push({ codigo:x.codigo, nombre:x.nombre, cantidad:x.cantidad, declarado, recalculado:x.unitario,
        diferencia:declarado === null ? null : x.unitario - declarado, valorRecalculado:x.valor,
        valorDeclarado:declarado === null ? null : declarado * x.cantidad, problemas });
    });
    return { renglones, totales:rc.diferenciasTotales || [], totalDeclarado:Number(rc.totalDeclarado||0), totalRecalculado:(of.totales||{}).total || 0,
      sobrantes:rc.sobrantes || [], regla:'Prevalece el precio unitario: el total de cada actividad se recalcula con la cantidad del pliego.' };
  }

  /* ── §18.2 Por nivel ── */
  /** Filas de capítulo, subcapítulo o actividad: valor de cada proponente,
      de la base, mínimo, máximo, mediana y promedio, y la desviación de cada
      uno frente a la base y frente a la mediana. */
  function niveles(ctx, nivel){
    const ib = indice(ctx.base);
    const io = ctx.ofertas.map(o => ({ id:o.id, ix:indice(o.pres) }));
    const mapa = nivel === 'capitulo' ? 'caps' : nivel === 'subcapitulo' ? 'subs' : 'acts';
    const filas = [];
    ib[mapa].forEach((b, clave) => {
      const valores = {}, unitarios = {};
      io.forEach(o => { const x = o.ix[mapa].get(clave); valores[o.id] = x ? x.valor : 0; if (nivel === 'actividad') unitarios[o.id] = x ? x.unitario : 0; });
      const vs = Object.values(valores);
      const est = Estadistica.resumen(vs);
      const desvBase = {}, desvMediana = {};
      Object.keys(valores).forEach(id => { desvBase[id] = Estadistica.desviacion(valores[id], b.valor); desvMediana[id] = Estadistica.desviacion(valores[id], est.mediana); });
      filas.push(Object.assign({ clave, codigo:b.codigo, nombre:b.nombre, base:b.valor, valores, desvBase, desvMediana, peso:ib.cd ? b.valor / ib.cd : 0 },
        nivel === 'actividad' ? { unidad:b.unidad, cantidad:b.cantidad, unitarioBase:b.unitario, unitarios, capitulo:b.cap.codigo, cantidadIncierta:!!b.act.cantidadIncierta } : {},
        nivel === 'subcapitulo' ? { capitulo:b.capitulo } : {}, { estadisticos:est }));
    });
    return filas;
  }

  /* ── §18.2 Por insumo ── */
  function claveInsumo(i){ return Util.normaliza(i.nombre || i.descripcion) + '|' + Util.normaliza(i.unidad); }
  function palabras(s){ return Util.normaliza(s).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w.length > 2); }
  /** Parecido entre dos descripciones: coeficiente de Jaccard de sus palabras. */
  function parecido(a, b){
    const A = new Set(palabras(a)), B = new Set(palabras(b));
    if (!A.size || !B.size) return 0;
    let c = 0; A.forEach(w => { if (B.has(w)) c++; });
    return c / (A.size + B.size - c);
  }
  /** Bandeja de emparejamientos: cada insumo de las ofertas con el insumo
      base que se le parece. Exacto si coinciden descripción normalizada y
      unidad; sugerido si se parecen (Jaccard ≥ 0,5) con la misma unidad.
      Una persona confirma: lo confirmado manda sobre lo sugerido. */
  function emparejar(ctx){
    const base = (ctx.base.insumos||[]);
    const porClave = new Map(base.map(i => [claveInsumo(i), i]));
    const conf = ctx.emparejamientos || {};
    const filas = new Map();
    ctx.ofertas.forEach(o => (o.pres.insumos||[]).forEach(i => {
      if (/^precio unitario de /i.test(i.nombre)) return;
      const k = claveInsumo(i);
      const f = filas.get(k) || { clave:k, nombre:i.nombre, unidad:i.unidad, categoria:i.categoria, precios:{}, base:null, estado:'sin pareja', parecido:0 };
      f.precios[o.id] = f.precios[o.id] === undefined ? Number(i.precio||0) : Math.min(f.precios[o.id], Number(i.precio||0));
      filas.set(k, f);
    }));
    filas.forEach(f => {
      if (conf[f.clave]){
        f.estado = conf[f.clave] === 'ninguno' ? 'sin pareja (confirmado)' : 'confirmado';
        f.base = conf[f.clave] === 'ninguno' ? null : base.find(b => b.id === conf[f.clave]) || null;
        if (f.base) f.parecido = 1;
        return;
      }
      const ex = porClave.get(f.clave);
      if (ex){ f.base = ex; f.estado = 'exacto'; f.parecido = 1; return; }
      let mejor = null, p = 0;
      base.forEach(b => { if (Util.normaliza(b.unidad) !== Util.normaliza(f.unidad)) return; const s = parecido(b.nombre, f.nombre); if (s > p){ p = s; mejor = b; } });
      if (mejor && p >= 0.5){ f.base = mejor; f.estado = 'sugerido'; f.parecido = p; }
    });
    return Array.from(filas.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }
  /** Solo lo exacto y lo confirmado cuenta para comparar precios. */
  function pareja(f){ return f.base && (f.estado === 'exacto' || f.estado === 'confirmado') ? f.base : null; }
  function insumos(ctx){
    return emparejar(ctx).map(f => {
      const b = pareja(f);
      const desv = {};
      Object.keys(f.precios).forEach(id => desv[id] = b ? Estadistica.desviacion(f.precios[id], Number(b.precio)) : null);
      return Object.assign(f, { precioBase:b ? Number(b.precio) : null, desvBase:desv });
    });
  }

  /* ── §18.2 Por AIU ── */
  function aiu(ctx, proceso){
    const tb = Calculo.totales(ctx.base);
    return ctx.ofertas.map(o => {
      const t = o.totales, po = (o.oferta||{}).presupuesto || {};
      const desglose = po.desgloseAdministracion || [];
      const totalDesglose = desglose.reduce((s, d) => s + Number(d.valor||0), 0);
      const personalDesglose = [];
      desglose.forEach(d => (d.filas||[]).forEach(f => personalDesglose.push({ cargo:f.cargo || f.concepto || '', dedicacion:Number(f.dedicacion||0), meses:Number(f.meses||0), mensual:Number(f.mensual||0),
        valor:Number(f.dedicacion||0) / 100 * Number(f.meses||0) * Number(f.mensual||0) })));
      const ivaOf = po.iva || {}, ivaP = (proceso && proceso.iva) || ctx.base.iva || {};
      const ivaBien = String(ivaOf.base || '') === String(ivaP.base || '') && Number(ivaOf.tarifa) === Number(ivaP.tarifa);
      const conAiu = t.pctA + t.pctI + t.pctU > 0;
      return { id:o.id, pctA:t.pctA, pctI:t.pctI, pctU:t.pctU, a:t.a, i:t.i, u:t.u, aiu:t.aiu, iva:t.iva, baseIva:t.baseIva, modoIva:t.modoIva, tarifaIva:t.tarifaIva,
        desglose, totalDesglose, cuadra:!desglose.length ? false : Math.abs(totalDesglose - t.a) <= Math.max(1000, t.a * 0.001), personalDesglose,
        ivaBien, ivaEsperado:ivaP, aiuSobreBase:{ a:t.pctA - tb.pctA, i:t.pctI - tb.pctI, u:t.pctU - tb.pctU }, conAiu };
    });
  }
  /** La A frente al personal ofrecido (§18.2): si el personal de dirección y
      administración de la oferta, con su dedicación, durante el plazo, cuesta
      más que la A, la A no alcanza. personal = filas de la tabla de personal. */
  function administracionAlcanza(fila, personal, plazoMeses){
    const hallazgos = [];
    if (fila.desglose.length && fila.totalDesglose > fila.a + Math.max(1000, fila.a * 0.001))
      hallazgos.push({ tipo:'desglose mayor que A', detalle:'El desglose de la administración suma ' + Util.money(fila.totalDesglose) + ' y la A es ' + Util.money(fila.a) + '.' });
    if (fila.desglose.length && fila.totalDesglose < fila.a - Math.max(1000, fila.a * 0.001))
      hallazgos.push({ tipo:'desglose menor que A', detalle:'El desglose de la administración suma ' + Util.money(fila.totalDesglose) + ' y la A es ' + Util.money(fila.a) + ': la diferencia no está explicada.' });
    if (!fila.desglose.length) hallazgos.push({ tipo:'sin desglose', detalle:'La oferta no trae el desglose de la administración.' });
    (personal||[]).forEach(p => {
      const ded = Number(p.dedicacion||0);
      if (!(ded > 0)) return;
      const enA = fila.personalDesglose.find(x => Util.normaliza(x.cargo) === Util.normaliza(p.cargo));
      if (fila.personalDesglose.length && !enA) hallazgos.push({ tipo:'personal sin costear', detalle:'El cargo «' + p.cargo + '» (dedicación ' + ded + ' %) no aparece costeado en la administración.' });
      if (enA && plazoMeses && enA.meses + 1e-9 < plazoMeses * 0.9) hallazgos.push({ tipo:'meses insuficientes', detalle:'«' + p.cargo + '» está costeado ' + Util.cant(enA.meses) + ' meses y el plazo es de ' + Util.cant(plazoMeses) + ' meses.' });
      if (enA && enA.dedicacion + 1e-9 < ded) hallazgos.push({ tipo:'dedicación insuficiente', detalle:'«' + p.cargo + '» se ofrece con dedicación de ' + ded + ' % y se costea al ' + enA.dedicacion + ' %.' });
    });
    return hallazgos;
  }

  /* ── §18.2 Por categoría de insumo ── */
  function categorias(ctx){
    const fila = (pres) => { const r = Calculo.porCategoria(pres), cd = Calculo.costoDirecto(pres) || 1; const pct = {}; Object.keys(r).forEach(k => pct[k] = r[k] / cd); return { valor:r, pct }; };
    const R = { base:fila(ctx.base), ofertas:{} };
    ctx.ofertas.forEach(o => R.ofertas[o.id] = fila(o.pres));
    return R;
  }

  /* ── §18.3 Desbalance ── */
  /** Para cada actividad, el precio de cada proponente frente a la base y a
      la mediana. Se marca si su z robusto pasa de 3,5, o si se aparta más del
      30 % de la base en una actividad que pesa más del 0,5 % del presupuesto.
      Indicador por oferta: Σ peso × |precio / base − 1|. */
  function desbalance(ctx){
    const c = config(ctx.config).desbalance;
    const filas = niveles(ctx, 'actividad');
    const n = ctx.ofertas.length;
    const usaZ = n >= Estadistica.MINIMO_Z;
    const marcadas = [];
    const indicador = {};
    ctx.ofertas.forEach(o => indicador[o.id] = 0);
    /* El z robusto se calcula sobre el precio relativo al nivel de la propia
       oferta (precio / costo directo de la oferta): una oferta pareja, toda
       más barata, no queda desbalanceada en cada renglón; la que sube unos
       precios y baja otros, sí. */
    const nivel = {};
    ctx.ofertas.forEach(o => { const cd = Calculo.costoDirecto(o.pres); nivel[o.id] = cd > 0 ? cd : null; });
    filas.forEach(f => {
      const us = ctx.ofertas.map(o => f.unitarios[o.id]);
      const m = Estadistica.mediana(us);
      const rel = ctx.ofertas.map(o => nivel[o.id] && f.unitarios[o.id] > 0 ? f.unitarios[o.id] / nivel[o.id] : null).filter(x => x !== null);
      const mr = Estadistica.mediana(rel), dr = Estadistica.mad(rel, mr);
      f.mediana = m; f.mad = dr; f.z = {}; f.razonBase = {}; f.razonMediana = {}; f.marca = {};
      ctx.ofertas.forEach(o => {
        const u = f.unitarios[o.id];
        f.razonBase[o.id] = f.unitarioBase ? u / f.unitarioBase : null;
        f.razonMediana[o.id] = m ? u / m : null;
        const r = nivel[o.id] && u > 0 ? u / nivel[o.id] : null;
        f.z[o.id] = usaZ && r !== null && rel.length >= Estadistica.MINIMO_Z ? Estadistica.zRobusto(r, mr, dr) : null;
        if (f.unitarioBase) indicador[o.id] += f.peso * Math.abs(u / f.unitarioBase - 1);
        /* Con pocas ofertas parejas el MAD es muy pequeño: el z solo marca si además se aparta un mínimo de la mediana relativa. */
        const porZ = f.z[o.id] !== null && Math.abs(f.z[o.id]) > c.z && mr > 0 && Math.abs(r / mr - 1) * 100 >= c.minPct;
        const porPct = f.razonBase[o.id] !== null && Math.abs(f.razonBase[o.id] - 1) * 100 > c.pct && f.peso * 100 > c.pesoMinPct;
        if (u > 0 && (porZ || porPct)){
          const reglas = [];
          if (porZ) reglas.push('z robusto ' + Util.redondearDec(f.z[o.id], 2) + ' (umbral ' + c.z + ')');
          if (porPct) reglas.push(Util.redondearDec((f.razonBase[o.id] - 1) * 100, 1) + ' % frente a la base, en una actividad que pesa ' + Util.redondearDec(f.peso * 100, 2) + ' % (umbral ±' + c.pct + ' % y ' + c.pesoMinPct + ' %)');
          f.marca[o.id] = reglas;
          marcadas.push({ ofertaId:o.id, codigo:f.codigo, nombre:f.nombre, unitario:u, base:f.unitarioBase, mediana:m, z:f.z[o.id], razonBase:f.razonBase[o.id], peso:f.peso, reglas });
        }
      });
    });
    return { filas, marcadas, indicador, usaZ, config:c,
      nota:usaZ ? '' : 'Con menos de ' + Estadistica.MINIMO_Z + ' ofertas no se usa el z robusto: solo la comparación con la base (Anexo C).' };
  }

  /* ── §18.3 Cargue al inicio ── */
  /** programacion = [{ actividad, inicio, fin }] de la oferta. Desviación
      ponderada por valor base de las actividades que empiezan en el primer
      tercio del plazo y de las que empiezan en el último. */
  function cargueInicio(ctx, of, programacion){
    const c = config(ctx.config).cargue;
    const ib = indice(ctx.base), io = indice(of.pres);
    const porCodigo = new Map();
    ib.acts.forEach((b, k) => porCodigo.set(Util.normaliza(b.codigo), k));
    const filas = (programacion||[]).map(r => ({ k:porCodigo.get(Util.normaliza(r.actividad)), i:Util.fechaDe(r.inicio), f:Util.fechaDe(r.fin) })).filter(r => r.k && r.i && r.f);
    if (filas.length < 3) return { aplica:false, motivo:'La programación no trae al menos tres actividades del presupuesto con fechas.' };
    const t0 = Math.min.apply(null, filas.map(r => r.i.getTime())), t1 = Math.max.apply(null, filas.map(r => r.f.getTime()));
    const dur = Math.max(1, t1 - t0);
    const tercio = (r) => { const x = (r.i.getTime() - t0) / dur; return x < 1 / 3 ? 0 : x < 2 / 3 ? 1 : 2; };
    const grupos = [[], [], []];
    filas.forEach(r => {
      const b = ib.acts.get(r.k), o = io.acts.get(r.k);
      if (!b || !o || !(b.unitario > 0) || !(o.unitario > 0)) return;
      grupos[tercio(r)].push({ codigo:b.codigo, peso:b.valor, desv:o.unitario / b.unitario - 1 });
    });
    const pond = (g) => { const w = g.reduce((t, x) => t + x.peso, 0); return w ? g.reduce((t, x) => t + x.peso * x.desv, 0) / w : null; };
    const d = grupos.map(pond);
    const alerta = d[0] !== null && d[2] !== null && d[0] * 100 > c.pct && d[2] * 100 < -c.pct;
    return { aplica:true, desviaciones:d, grupos, alerta, config:c,
      detalle:'Primer tercio del plazo ' + (d[0] === null ? '—' : Util.redondearDec(d[0] * 100, 1) + ' %') + ' frente a la base; último tercio ' + (d[2] === null ? '—' : Util.redondearDec(d[2] * 100, 1) + ' %') + ' (umbral ±' + c.pct + ' %).' };
  }

  /* ── §18.3 Riesgo de cantidades ── */
  function riesgoCantidades(ctx){
    const c = config(ctx.config).cantidades;
    const L = [];
    niveles(ctx, 'actividad').filter(f => f.cantidadIncierta && f.unitarioBase > 0).forEach(f => ctx.ofertas.forEach(o => {
      const r = f.unitarios[o.id] / f.unitarioBase;
      if (!(f.unitarios[o.id] > 0)) return;
      if ((r - 1) * 100 > c.pct) L.push({ ofertaId:o.id, codigo:f.codigo, nombre:f.nombre, razon:r, tipo:'sobrecosto', unitario:f.unitarios[o.id], base:f.unitarioBase });
      else if ((1 - r) * 100 > c.pct) L.push({ ofertaId:o.id, codigo:f.codigo, nombre:f.nombre, razon:r, tipo:'reclamación', unitario:f.unitarios[o.id], base:f.unitarioBase });
    }));
    return { lista:L, config:c };
  }

  /* ── §18.3 Valor artificialmente bajo ── */
  /** Total de cada oferta frente a la mediana de las ofertas y a la base.
      Se marca la que queda más de umbralPct por debajo de la mediana (lo
      que dice el pliego). validas = ids de las ofertas habilitadas. */
  function valorBajo(ctx, umbralPct, validas){
    const lista = ctx.ofertas.filter(o => !validas || validas.indexOf(o.id) >= 0);
    const totales = lista.map(o => o.totales.total);
    const m = Estadistica.mediana(totales);
    const base = Calculo.totales(ctx.base).total;
    const u = Number(umbralPct === undefined ? 15 : umbralPct);
    return { mediana:m, base, umbralPct:u, filas:ctx.ofertas.map(o => {
      const dm = Estadistica.desviacion(o.totales.total, m), db = Estadistica.desviacion(o.totales.total, base);
      return { id:o.id, total:o.totales.total, desvMediana:dm, desvBase:db, bajo:lista.indexOf(o) >= 0 && dm !== null && dm * 100 < -u };
    }) };
  }

  /* ── §18.4 APU ── */
  const UNIDADES_TIEMPO = { jornal:'jornal', jornales:'jornal', dia:'jornal', 'día':'jornal', dias:'jornal', 'días':'jornal', jor:'jornal', hora:'hora', horas:'hora', hh:'hora', hr:'hora', h:'hora', mes:'mes' };
  function unidadTiempo(u){ return UNIDADES_TIEMPO[Util.normaliza(u).replace(/[^a-z]/g, '')] || null; }
  /** Jornales de mano de obra por unidad de la actividad (Σ cantidad de los
      insumos de mano de obra con unidad de tiempo; las horas se pasan a
      jornales con las horas del jornal). */
  function jornalesPorUnidad(pres, act, horasJornal){
    let j = 0, hay = false;
    (act.apus||[]).forEach(id => { const ap = Calculo.apu(pres, id); if (!ap) return;
      (ap.insumos||[]).forEach(x => { const ins = Calculo.insumo(pres, x.idInsumo); if (!ins || ins.categoria !== 'Mano de Obra') return;
        const t = unidadTiempo(ins.unidad); if (t === 'jornal'){ j += Number(x.cantidad||0); hay = true; } else if (t === 'hora'){ j += Number(x.cantidad||0) / (horasJornal || 7); hay = true; } }); });
    return hay ? j : null;
  }
  /** Insumos del APU de una actividad, con su peso en el precio unitario. */
  function componentes(pres, act){
    const L = [];
    (act.apus||[]).forEach(id => { const ap = Calculo.apu(pres, id); if (!ap) return;
      (ap.insumos||[]).forEach(x => { const ins = Calculo.insumo(pres, x.idInsumo); if (ins) L.push({ ins, cantidad:Number(x.cantidad||0), valor:Number(x.cantidad||0) * Number(ins.precio||0) }); }); });
    const u = L.reduce((t, x) => t + x.valor, 0);
    L.forEach(x => x.peso = u ? x.valor / u : 0);
    return L;
  }
  /** Un APU de verdad (varios insumos), no un precio todo costo de un renglón. */
  function apuDesglosado(pres, act){ return componentes(pres, act).length >= 2; }

  function apu(ctx){
    const c = config(ctx.config).apu;
    const lab = ctx.laboral || null;
    const ib = indice(ctx.base);
    const emp = new Map(emparejar(ctx).map(f => [f.clave, pareja(f)]));
    const hallazgos = [];
    const add = (o, tipo, codigo, detalle, extra) => hallazgos.push(Object.assign({ ofertaId:o.id, tipo, codigo, detalle }, extra || {}));
    const horas = lab ? lab.horasJornal : 7;
    /* Rendimientos de mano de obra: frente a la base y frente a los demás. */
    const rend = new Map();
    ib.acts.forEach((b, k) => {
      const vals = {};
      ctx.ofertas.forEach(o => { const x = indice(o.pres).acts.get(k); vals[o.id] = x && apuDesglosado(o.pres, x.act) ? jornalesPorUnidad(o.pres, x.act, horas) : null; });
      rend.set(k, { base:jornalesPorUnidad(ctx.base, b.act, horas), vals });
    });
    rend.forEach((r, k) => {
      const b = ib.acts.get(k);
      const vs = Object.values(r.vals).filter(v => v !== null);
      const m = Estadistica.mediana(vs), d = Estadistica.mad(vs, m);
      ctx.ofertas.forEach(o => {
        const v = r.vals[o.id];
        if (v === null) return;
        const z = vs.length >= Estadistica.MINIMO_Z ? Estadistica.zRobusto(v, m, d) : null;
        const fueraBase = r.base ? Math.abs(v / r.base - 1) * 100 > c.rendimientoPct : false;
        if ((z !== null && Math.abs(z) > 3.5) || fueraBase)
          add(o, 'rendimiento', b.codigo, 'Mano de obra de ' + Util.cant(v) + ' jornales por ' + b.unidad + (r.base ? ' frente a ' + Util.cant(r.base) + ' de la base' : '') + (z !== null ? ' (z robusto ' + Util.redondearDec(z, 2) + ')' : '') + '.',
            { valor:v, base:r.base, z });
      });
    });
    ctx.ofertas.forEach(o => {
      const io = indice(o.pres);
      const vistosMo = new Set(), vistosBajo = new Set();
      io.acts.forEach((x, k) => {
        const comp = componentes(o.pres, x.act);
        /* Mano de obra por debajo del costo empresa mínimo. */
        if (lab) comp.filter(y => y.ins.categoria === 'Mano de Obra').forEach(y => {
          const t = unidadTiempo(y.ins.unidad);
          const minimo = t === 'jornal' ? lab.jornal : t === 'hora' ? lab.hora : t === 'mes' ? lab.mensual : null;
          const ki = claveInsumo(y.ins);
          if (minimo && Number(y.ins.precio) < minimo - 0.5 && !vistosMo.has(ki)){
            vistosMo.add(ki);
            add(o, 'mano de obra bajo el mínimo', x.codigo, '«' + y.ins.nombre + '» a ' + Util.money3(y.ins.precio) + ' por ' + y.ins.unidad + '; el costo empresa mínimo de la vigencia es ' + Util.money3(minimo) + '.',
              { insumo:y.ins.nombre, precio:Number(y.ins.precio), minimo });
          }
        });
        /* Insumos muy por debajo del mercado (base de precios emparejada). */
        comp.forEach(y => {
          const ki = claveInsumo(y.ins), b = emp.get(ki);
          if (!b || vistosBajo.has(ki) || !(Number(b.precio) > 0)) return;
          const r = Number(y.ins.precio) / Number(b.precio);
          if ((1 - r) * 100 > c.insumoBajoPct){ vistosBajo.add(ki);
            add(o, 'insumo bajo el mercado', x.codigo, '«' + y.ins.nombre + '» a ' + Util.money3(y.ins.precio) + '; la base de precios lo tiene en ' + Util.money3(b.precio) + ' (' + Util.redondearDec((r - 1) * 100, 1) + ' %).',
              { insumo:y.ins.nombre, precio:Number(y.ins.precio), base:Number(b.precio) }); }
        });
        /* Insumos que faltan frente al APU de la base, herramienta menor,
           transporte y desperdicios: solo en APU desglosados. */
        const b = ib.acts.get(k);
        if (!b || comp.length < 2) return;
        const cb = componentes(ctx.base, b.act);
        const tiene = (bi) => comp.find(y => (emp.get(claveInsumo(y.ins)) || {}).id === bi.ins.id || claveInsumo(y.ins) === claveInsumo(bi.ins) || (y.ins.categoria === bi.ins.categoria && parecido(y.ins.nombre, bi.ins.nombre) >= 0.5));
        cb.forEach(bi => {
          const y = tiene(bi);
          if (!y && bi.peso * 100 >= c.pesoFaltantePct) add(o, 'insumo faltante', x.codigo, 'El APU no trae «' + bi.ins.nombre + '», que pesa ' + Util.redondearDec(bi.peso * 100, 1) + ' % del APU de la base.', { insumo:bi.ins.nombre });
          else if (!y && bi.ins.categoria === 'Herramientas') add(o, 'sin herramienta menor', x.codigo, 'El APU no trae herramienta menor y el de la base sí.', { insumo:bi.ins.nombre });
          else if (!y && /transporte/i.test(bi.ins.nombre)) add(o, 'sin transporte', x.codigo, 'El APU no trae «' + bi.ins.nombre + '» y el de la base sí.', { insumo:bi.ins.nombre });
          else if (y && bi.ins.categoria === 'Materiales' && bi.cantidad > 0 && (y.cantidad / bi.cantidad - 1) * 100 > c.desperdicioPct)
            add(o, 'desperdicio inusual', x.codigo, '«' + y.ins.nombre + '»: ' + Util.cant(y.cantidad) + ' ' + y.ins.unidad + ' por ' + b.unidad + ' frente a ' + Util.cant(bi.cantidad) + ' de la base.', { insumo:y.ins.nombre });
        });
      });
    });
    return { hallazgos, config:c };
  }

  return { CONFIG, config, indice, aritmetica, niveles, claveInsumo, parecido, emparejar, pareja, insumos, aiu, administracionAlcanza, categorias,
    desbalance, cargueInicio, riesgoCantidades, valorBajo, unidadTiempo, jornalesPorUnidad, componentes, apuDesglosado, apu };
})();
