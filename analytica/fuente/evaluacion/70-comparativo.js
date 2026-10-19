/* ─────────────── Comparativo y cuadro gerencial (§19) ───────────────
   Sin pantalla: arma las filas del cuadro comparativo (presupuesto base y
   una columna por proponente, por capítulo, subcapítulo o actividad) y las
   del cuadro gerencial a partir del resultado de Motor.analizar. La vista
   solo pinta; el Excel y el PDF salen de estas mismas filas. */
const Comparativo = (function(){
  const NIVELES = ['capitulo', 'subcapitulo', 'actividad'];

  /** Clase de la escala divergente por desviación (fracción): −3 … +3. */
  function claseDesv(d){
    if (d === null || d === undefined || !isFinite(d)) return '';
    const a = Math.abs(d), s = d < 0 ? 'm' : 'p';
    return a < 0.05 ? 'd0' : a < 0.15 ? 'd' + s + '1' : a < 0.30 ? 'd' + s + '2' : 'd' + s + '3';
  }

  /** Valores por clave de capítulo, subcapítulo y actividad de un presupuesto. */
  function valores(pres){
    const m = new Map();
    (pres.capitulos||[]).forEach(c => {
      m.set(Util.normaliza(c.codigo), Calculo.valorCapitulo(pres, c));
      (c.subs||[]).forEach(s => {
        m.set(Util.normaliza(c.codigo) + '|' + Util.normaliza(s.codigo), Calculo.valorSubcapitulo(pres, s));
        (s.acts||[]).forEach(a => m.set(Util.normaliza(c.codigo) + '|' + Util.normaliza(s.codigo) + '|' + Util.normaliza(a.codigo), Calculo.valorActividad(pres, a)));
      });
    });
    return m;
  }

  /** Renglones alertados: códigos de actividad, subcapítulo o capítulo que aparecen como evidencia. */
  function codigosConAlerta(R){
    const s = new Set();
    (R.alertas||[]).forEach(a => (a.evidencia||[]).forEach(e => { if (e.tipo === 'renglon' && e.codigo) s.add(Util.normaliza(e.codigo)); }));
    return s;
  }

  function fila(clave, tipo, x, base, cols, vals, cd){
    const vb = base.get(clave) || 0;
    const vs = cols.map(o => vals.get(o.id).get(clave)).filter(v => v !== undefined);
    const med = vs.length ? Estadistica.mediana(vs) : null;
    const celdas = {};
    cols.forEach(o => {
      const v = vals.get(o.id).get(clave);
      if (v === undefined){ celdas[o.id] = null; return; }
      celdas[o.id] = { valor:v, difBase:v - vb, pctBase:vb ? (v - vb) / vb : null, difMediana:med === null ? null : v - med, pctMediana:med ? (v - med) / med : null };
      celdas[o.id].clase = claseDesv(celdas[o.id].pctBase);
    });
    return { clave, tipo, codigo:x.codigo, nombre:x.nombre, unidad:x.unidad || '', cantidad:x.cantidad, base:vb, peso:cd ? vb / cd : 0, mediana:med, celdas };
  }

  /** Cuadro comparativo. op = { nivel, capitulo (código), soloAlertas, pesoMinPct } */
  function cuadro(R, op){
    op = op || {};
    const nivel = NIVELES.indexOf(op.nivel) >= 0 ? op.nivel : 'capitulo';
    const pb = R.ctx.base;
    const base = valores(pb);
    const cols = R.ofertas;
    const vals = new Map(cols.map(o => [o.id, valores(o.pres)]));
    const cd = Calculo.costoDirecto(pb);
    const alertados = codigosConAlerta(R);
    const pesoMin = Number(op.pesoMinPct || 0) / 100;
    const filas = [];
    (pb.capitulos||[]).forEach(c => {
      if (op.capitulo && Util.normaliza(op.capitulo) !== Util.normaliza(c.codigo)) return;
      const kc = Util.normaliza(c.codigo);
      const fc = fila(kc, 'cap', c, base, cols, vals, cd);
      const hijos = [];
      if (nivel !== 'capitulo') (c.subs||[]).forEach(s => {
        const ks = kc + '|' + Util.normaliza(s.codigo);
        const fs = fila(ks, 'sub', s, base, cols, vals, cd);
        const acts = nivel === 'actividad' ? (s.acts||[]).map(a => {
          const f = fila(ks + '|' + Util.normaliza(a.codigo), 'act', a, base, cols, vals, cd);
          f.alerta = alertados.has(Util.normaliza(a.codigo));
          return f;
        }).filter(f => f.peso >= pesoMin && (!op.soloAlertas || f.alerta)) : [];
        fs.alerta = alertados.has(Util.normaliza(s.codigo)) || acts.some(f => f.alerta);
        if (nivel === 'actividad' && !acts.length) return;
        if (nivel === 'subcapitulo' && (fs.peso < pesoMin || (op.soloAlertas && !fs.alerta))) return;
        hijos.push(fs); acts.forEach(f => hijos.push(f));
      });
      fc.alerta = alertados.has(kc) || hijos.some(f => f.alerta);
      if (nivel === 'capitulo' && (fc.peso < pesoMin || (op.soloAlertas && !fc.alerta))) return;
      if (nivel !== 'capitulo' && !hijos.length) return;
      filas.push(fc); hijos.forEach(f => filas.push(f));
    });
    const tb = R.totalesBase;
    const pie = [['Costo directo', 'costoDirecto'], ['Administración', 'a'], ['Imprevistos', 'i'], ['Utilidad', 'u'], ['IVA', 'iva'], ['Total', 'total']].map(([n, k]) => {
      const vs = cols.map(o => o.totales[k]);
      const med = Estadistica.mediana(vs);
      const celdas = {};
      cols.forEach(o => { const v = o.totales[k]; celdas[o.id] = { valor:v, difBase:v - tb[k], pctBase:tb[k] ? (v - tb[k]) / tb[k] : null, difMediana:v - med, pctMediana:med ? (v - med) / med : null, clase:claseDesv(tb[k] ? (v - tb[k]) / tb[k] : null) }; });
      return { clave:k, tipo:'pie', nombre:n, base:tb[k], mediana:med, celdas };
    });
    return { nivel, columnas:cols.map(o => ({ id:o.id, nombre:o.nombre })), filas, pie };
  }

  /** Experiencia acreditada en SMMLV (la suma del primer requisito de experiencia que la mide). */
  function experiencia(R, id){
    const ex = R.porOferta[id].experiencia || {};
    const k = Object.keys(ex).find(c => ex[c] && ex[c].exigido !== undefined && ex[c].exigido !== null);
    return k ? { codigo:k, suma:ex[k].suma, exigido:ex[k].exigido, cumple:ex[k].cumpleSuma } : null;
  }

  /** Cuadro gerencial: una fila por proponente. alertas = las guardadas (con estado), opcional. */
  function gerencial(R, op){
    op = op || {};
    const tb = R.totalesBase.total;
    const filaP = new Map(R.puntaje.filas.map(f => [f.id, f]));
    const grupos = [];
    R.puntaje.filas.forEach(f => Object.keys(f.grupos||{}).forEach(g => { if (grupos.indexOf(g) < 0) grupos.push(g); }));
    const criticas = id => (op.alertas
      ? op.alertas.filter(a => a.vigente !== false && a.alerta.nivel === 'crítica' && a.alerta.ofertas.indexOf(id) >= 0 && Alertas.estado(a) !== 'descartada').length
      : R.alertas.filter(a => a.nivel === 'crítica' && a.ofertas.indexOf(id) >= 0).length);
    const filas = R.ofertas.map(o => {
      const po = R.porOferta[o.id], f = filaP.get(o.id);
      const hab = po.habilitacion.estado;
      const fin = [];
      Object.keys(po.financiero||{}).forEach(c => (po.financiero[c].indicadores||[]).forEach(i => fin.push({ nombre:i.nombre, valor:i.valorCalculado, op:i.op, limite:i.limite, cumple:i.cumple })));
      const nc = criticas(o.id);
      const semaforo = hab === 'no habilitada' ? 'rojo' : (hab === 'pendiente' || nc > 0) ? 'amarillo' : 'verde';
      return { id:o.id, nombre:o.nombre, total:o.totales.total, difBase:o.totales.total - tb, pctBase:tb ? (o.totales.total - tb) / tb : null,
        plazo:po.programacion && po.programacion.aplica ? po.programacion.plazo : null, aiuPct:o.totales.pctA + o.totales.pctI + o.totales.pctU,
        habilitacion:hab, causales:po.habilitacion.causales || [], grupos:f ? f.grupos : {}, puntaje:f ? f.total : null, puesto:f ? f.puesto : null,
        experiencia:experiencia(R, o.id), financieros:fin, criticas:nc, semaforo };
    }).sort((a, b) => (a.puesto || 99) - (b.puesto || 99) || a.total - b.total);
    const recomendado = op.concepto && op.concepto.estado === 'firmado' && op.concepto.recomendado
      ? (R.ofertas.find(o => o.id === op.concepto.recomendado) || {}).nombre || null : null;
    return { grupos, filas, recomendado, portada:recomendado ? 'Recomendado: ' + recomendado : 'En evaluación', provisional:R.puntaje.provisional };
  }

  /** Filas planas (AoA) del cuadro comparativo, para Excel y PDF: números como números. */
  function tabla(C, conPct){
    const cab = ['Código', 'Descripción', 'Presupuesto base'];
    C.columnas.forEach(c => { cab.push(c.nombre); if (conPct) cab.push('Δ base %', 'Δ mediana %'); });
    const filas = C.filas.concat(C.pie).map(f => {
      const r = [f.codigo || '', f.nombre, Util.redondear(f.base)];
      C.columnas.forEach(c => {
        const x = f.celdas[c.id];
        r.push(x ? Util.redondear(x.valor) : null);
        if (conPct) r.push(x && x.pctBase !== null ? Util.redondearDec(x.pctBase * 100, 2) : null, x && x.pctMediana !== null ? Util.redondearDec(x.pctMediana * 100, 2) : null);
      });
      return { tipo:f.tipo, celdas:r };
    });
    return { cabeza:cab, filas };
  }

  /** Códigos de la plantilla del Anexo B: lo que no está aquí lo creó el usuario. */
  let codigosPlantilla = null;
  function adicional(r){
    if (!codigosPlantilla) codigosPlantilla = new Set(PlantillaCondiciones.anexoB().map(x => x.codigo));
    return !codigosPlantilla.has(r.codigo);
  }
  /** Requisito × proponente: cumplimiento y puntos (§27.10: los creados por el usuario también). */
  function requisitos(R){
    const filaP = new Map(R.puntaje.filas.map(f => [f.id, f]));
    return R.requisitos.filter(r => r.activo !== false).map(r => ({ codigo:r.codigo, grupo:r.grupo, nombre:r.nombre, naturaleza:r.naturaleza, maximo:Number(r.puntajeMaximo || 0), adicional:adicional(r),
      celdas:Object.fromEntries(R.ofertas.map(o => { const v = R.vigente(o.id, r.codigo), f = filaP.get(o.id);
        return [o.id, { cumple:v ? v.cumple : 'pendiente', puntos:f && f.puntos[r.codigo] !== undefined ? f.puntos[r.codigo] : null, observacion:v ? v.observacion || '' : '' }]; })) }));
  }

  return { NIVELES, claseDesv, cuadro, gerencial, tabla, experiencia, requisitos, adicional };
})();
