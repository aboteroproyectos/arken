/* ─────────────── Concepto de adjudicación (§18.12) ───────────────
   Sin pantalla. generar() arma el borrador a partir de la evaluación: cómo le
   fue a cada proponente en cada requisito y grupo, quién fue el mejor y por
   qué, las fortalezas y lo que no es adecuado de cada uno (con evidencia),
   el orden, el recomendado, las condiciones y los riesgos de los dos
   primeros. El comité edita los textos (textos = { clave: texto }) y firma.
   Mientras no esté firmado, es un borrador y así se marca en cada página.

   Lo que no es adecuado sale de las alertas CONFIRMADAS por una persona y de
   los requisitos no cumplidos; nunca de una alerta sin revisar. */
const Concepto = (function(){
  const FIRMAS_MINIMAS = 2;
  const pctTxt = d => (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d * 100).toFixed(1).replace('.', ',') + ' %';
  const pts = n => String(Util.redondearDec(n, 2)).replace('.', ',');
  /** Un título con su punto final, sin duplicarlo («S.A.» no lleva otro). */
  const punto = t => /[.!?]$/.test(String(t)) ? String(t) : t + '.';

  /** Alertas confirmadas de una oferta (registros guardados con su historia de estados). */
  function confirmadas(alertas, id){
    return (alertas||[]).filter(a => a.vigente !== false && Alertas.estado(a) === 'confirmada' && a.alerta.ofertas.indexOf(id) >= 0);
  }
  function abiertas(alertas, id){
    return (alertas||[]).filter(a => a.vigente !== false && ['nueva', 'en revisión', 'confirmada'].indexOf(Alertas.estado(a)) >= 0 && a.alerta.ofertas.indexOf(id) >= 0);
  }

  /** Por requisito: el resultado de cada proponente y quién fue el mejor. */
  function porRequisito(R){
    const filaP = new Map(R.puntaje.filas.map(f => [f.id, f]));
    const grupos = [];
    R.requisitos.filter(r => r.activo !== false && r.naturaleza !== 'informativo').forEach(r => {
      let g = grupos.find(x => x.grupo === r.grupo);
      if (!g){ g = { grupo:r.grupo, requisitos:[] }; grupos.push(g); }
      const pond = R.puntaje.ponderables.indexOf(r.codigo) >= 0;
      const resultados = {};
      R.ofertas.forEach(o => {
        const v = R.vigente(o.id, r.codigo);
        const f = filaP.get(o.id);
        resultados[o.id] = { cumple:v ? v.cumple : 'pendiente', puntos:pond && f ? (f.puntos[r.codigo] === undefined ? null : f.puntos[r.codigo]) : null, observacion:v ? v.observacion || '' : '' };
      });
      let mejor = [], porque = '';
      if (pond){
        const conPuntos = R.ofertas.filter(o => resultados[o.id].puntos !== null);
        const max = conPuntos.length ? Math.max(...conPuntos.map(o => resultados[o.id].puntos)) : null;
        mejor = max === null ? [] : conPuntos.filter(o => Math.abs(resultados[o.id].puntos - max) < 0.005).map(o => o.id);
        porque = max === null ? 'Sin puntajes todavía.' : 'Mayor puntaje: ' + pts(max) + ' de ' + pts(Number(r.puntajeMaximo || 0)) + '.';
      } else {
        mejor = R.ofertas.filter(o => ['sí', 'no aplica'].indexOf(resultados[o.id].cumple) >= 0).map(o => o.id);
        porque = mejor.length === R.ofertas.length ? 'Todos cumplen.' : mejor.length ? 'Cumplen ' + mejor.length + ' de ' + R.ofertas.length + '.' : 'Nadie cumple todavía.';
      }
      g.requisitos.push({ codigo:r.codigo, nombre:r.nombre, naturaleza:r.naturaleza, ponderable:pond, maximo:Number(r.puntajeMaximo || 0), resultados, mejor, porque });
    });
    return grupos;
  }

  function fortalezas(R, o, alertas){
    const L = [];
    const f = R.puntaje.filas.find(x => x.id === o.id);
    if (f){
      const max = Graficas.maximosPorGrupo(R);
      Object.keys(f.grupos).forEach(g => {
        const mejor = Math.max(...R.puntaje.filas.map(x => x.grupos[g] || 0));
        if (f.grupos[g] > 0 && Math.abs(f.grupos[g] - mejor) < 0.005) L.push({ texto:'El mejor puntaje en ' + g + ': ' + pts(f.grupos[g]) + (max[g] ? ' de ' + pts(max[g]) : '') + '.', evidencia:{ tipo:'grupo', grupo:g } });
      });
    }
    const vb = (R.valorBajo.filas || []).find(x => x.id === o.id);
    if (vb && vb.desvMediana < -0.02 && !vb.bajo) L.push({ texto:'Valor ' + pctTxt(vb.desvMediana) + ' frente a la mediana de las ofertas, sin llegar a valor artificialmente bajo.', evidencia:{ tipo:'renglon', codigo:'' } });
    const ex = Comparativo.experiencia(R, o.id);
    if (ex && ex.cumple && ex.exigido) L.push({ texto:'Experiencia de ' + Util.cant(Util.redondearDec(ex.suma, 1)) + ' SMMLV, ' + Util.redondearDec(ex.suma / ex.exigido, 1) + ' veces lo exigido.', evidencia:{ tipo:'requisito', codigo:ex.codigo } });
    const po = R.porOferta[o.id];
    const ind = [];
    Object.keys(po.financiero || {}).forEach(c => (po.financiero[c].indicadores || []).forEach(i => ind.push(Object.assign({ codigo:c }, i))));
    if (ind.length && ind.every(i => i.cumple)) L.push({ texto:'Cumple todos los indicadores financieros (' + ind.map(i => i.nombre + ' ' + (Math.abs(i.valorCalculado) >= 1000 ? Util.money(i.valorCalculado) : String(Util.redondearDec(i.valorCalculado, 2)).replace('.', ','))).join(', ') + ').', evidencia:{ tipo:'requisito', codigo:ind[0].codigo } });
    if (po.aritmetica && !(po.aritmetica.renglones || []).length && Math.abs((po.aritmetica.totalDeclarado || 0) - (po.aritmetica.totalRecalculado || 0)) <= 1) L.push({ texto:'Los totales declarados cuadran con los precios unitarios.', evidencia:{ tipo:'renglon', codigo:'' } });
    if (alertas && !abiertas(alertas, o.id).length) L.push({ texto:'Sin alertas abiertas ni confirmadas.', evidencia:{ tipo:'alertas' } });
    return L;
  }

  function debilidades(R, o, alertas){
    const L = [];
    confirmadas(alertas, o.id).forEach(a => L.push({ texto:punto(a.alerta.titulo) + ' ' + a.alerta.porque, evidencia:(a.alerta.evidencia || [])[0] || null, alerta:a.clave, tipo:a.alerta.tipo }));
    R.requisitos.filter(r => r.activo !== false).forEach(r => {
      const v = R.vigente(o.id, r.codigo);
      if (v && v.cumple === 'no') L.push({ texto:'No cumple ' + r.codigo + ' · ' + r.nombre + (v.observacion ? ': ' + v.observacion : '.'), evidencia:{ tipo:'requisito', codigo:r.codigo } });
    });
    (R.porOferta[o.id].habilitacion.pendientes || []).forEach(p => L.push({ texto:'Pendiente: ' + (p.texto || p.codigo || p), evidencia:p.codigo ? { tipo:'requisito', codigo:p.codigo } : null }));
    return L;
  }

  /** Condiciones de la recomendación, a partir de lo confirmado del recomendado. */
  function condiciones(R, id, alertas){
    const C = [];
    confirmadas(alertas, id).forEach(a => {
      const cods = (a.alerta.evidencia || []).filter(e => e.tipo === 'renglon' && e.codigo).map(e => e.codigo);
      const t = a.alerta.tipo;
      if (t === 'desbalance' || t === 'cargue al inicio' || t === 'riesgo de cantidades') C.push('Negociar el precio de ' + (cods.length ? cods.length + ' actividades (' + cods.slice(0, 8).join(', ') + (cods.length > 8 ? '…' : '') + ')' : 'las actividades señaladas') + ' antes de firmar el contrato.');
      else if (t === 'personal' || t === 'misma persona') C.push('Exigir el reemplazo o la acreditación del profesional señalado: ' + punto(a.alerta.titulo));
      else if (t === 'programación') C.push('Ajustar la programación: ' + punto(a.alerta.titulo));
      else if (t === 'valor bajo' || t === 'mano de obra') C.push('Verificar en la ejecución lo que motivó la alerta «' + a.alerta.titulo + '» y dejarlo como obligación en el contrato.');
      else if (t === 'apu no suma' || t === 'aritmética') C.push('Corregir los precios unitarios señalados sin aumentar el valor total ofertado.');
      else C.push('Resolver antes de firmar: ' + punto(a.alerta.titulo));
    });
    return Array.from(new Set(C));
  }

  function riesgos(R, id, alertas, orden){
    const L = [];
    const vb = (R.valorBajo.filas || []).find(x => x.id === id);
    if (vb && vb.bajo) L.push('Su valor está ' + pctTxt(vb.desvMediana) + ' frente a la mediana: riesgo de que no alcance para ejecutar la obra.');
    if (vb && vb.desvBase > 0) L.push('Su valor supera el presupuesto base en ' + pctTxt(vb.desvBase) + '.');
    abiertas(alertas, id).forEach(a => L.push((Alertas.estado(a) === 'confirmada' ? 'Alerta confirmada: ' : 'Alerta por revisar: ') + punto(a.alerta.titulo)));
    const k = orden.findIndex(f => f.id === id);
    if (k === 0 && orden[1] && orden[0].total - orden[1].total < 10) L.push('La ventaja sobre el segundo es de solo ' + pts(orden[0].total - orden[1].total) + ' puntos.');
    const sens = (R.puntaje.sensibilidad || []).filter(s => s.mas.cambiaPrimero || s.menos.cambiaPrimero).map(s => s.grupo);
    if (k === 0 && sens.length) L.push('El primer lugar cambia si se mueve ±10 % el peso de: ' + sens.join(', ') + '.');
    if (!L.length) L.push('No se identifican riesgos adicionales en la evaluación.');
    return L;
  }

  /** El borrador del concepto. op = { alertas (guardadas), proceso, ahora } */
  function generar(R, op){
    op = op || {};
    const alertas = op.alertas || [];
    const orden = R.puntaje.orden.map(f => ({ id:f.id, nombre:f.nombre, total:f.total, economico:f.economico, tecnico:f.tecnico, puesto:f.puesto }));
    const recomendado = orden.length && !R.puntaje.provisional ? orden[0].id : null;
    const tb = R.totalesBase.total;
    const hab = R.ofertas.filter(o => R.porOferta[o.id].habilitacion.estado === 'habilitada').length;
    const rec = recomendado ? R.ofertas.find(o => o.id === recomendado) : null;
    const resumen = 'Se recibieron y abrieron ' + R.ofertas.length + ' ofertas para el proceso ' + (R.proceso.codigo || '') + (R.proceso.nombre ? ' · ' + R.proceso.nombre : '') +
      ', con un presupuesto base de ' + Util.money(tb) + '. ' + hab + ' quedaron habilitadas' + (R.puntaje.noHabilitadas.length ? ' y ' + R.puntaje.noHabilitadas.length + ' no' : '') + '. ' +
      'Los valores van de ' + Util.money(Math.min(...R.ofertas.map(o => o.totales.total))) + ' a ' + Util.money(Math.max(...R.ofertas.map(o => o.totales.total))) + '. ' +
      (R.puntaje.provisional ? 'La evaluación no ha terminado: el puntaje es provisional.' : 'El método de evaluación económica fue ' + Object.values(R.puntaje.economicos).map(e => e.nombre).join(', ') + '.');
    const recomendacion = rec
      ? 'Se recomienda adjudicar a ' + rec.nombre + ', primero en el orden de elegibilidad con ' + pts(orden[0].total) + ' puntos, por ' + Util.money(rec.totales.total) + ' (' + pctTxt((rec.totales.total - tb) / tb) + ' frente al presupuesto base).'
      : 'No hay recomendación todavía: ' + (R.puntaje.provisional ? 'faltan verificaciones o subsanaciones.' : 'no hay ofertas habilitadas.');
    return {
      generado:op.ahora || new Date().toISOString(),
      resumen, recomendacion,
      porGrupo:porRequisito(R),
      fortalezas:Object.fromEntries(R.ofertas.map(o => [o.id, fortalezas(R, o, op.alertas ? alertas : null)])),
      debilidades:Object.fromEntries(R.ofertas.map(o => [o.id, debilidades(R, o, alertas)])),
      orden, noHabilitadas:R.puntaje.noHabilitadas.map(id => ({ id, nombre:(R.ofertas.find(o => o.id === id) || {}).nombre, causales:R.porOferta[id].habilitacion.causales || [] })),
      recomendado, provisional:R.puntaje.provisional,
      condiciones:recomendado ? condiciones(R, recomendado, alertas) : [],
      riesgos:Object.fromEntries(orden.slice(0, 2).map(f => [f.id, riesgos(R, f.id, alertas, orden)]))
    };
  }

  /** El texto final: lo editado por el comité reemplaza lo generado, campo por campo. */
  function aplicarTextos(g, textos){
    const t = textos || {};
    const r = Util.copia(g);
    if (t.resumen) r.resumen = t.resumen;
    if (t.recomendacion) r.recomendacion = t.recomendacion;
    if (Array.isArray(t.condiciones)) r.condiciones = t.condiciones.filter(Boolean);
    Object.keys(t.riesgos || {}).forEach(id => { if (Array.isArray(t.riesgos[id])) r.riesgos[id] = t.riesgos[id].filter(Boolean); });
    if (t.notas) r.notas = t.notas;
    return r;
  }

  /** Estado del concepto guardado: { firmas:[{usuario, fecha}], huella } → 'borrador' | 'firmado'. */
  function estado(c){ return c && (c.firmas || []).length >= FIRMAS_MINIMAS && c.huella ? 'firmado' : 'borrador'; }
  /** Lo que se firma: el texto final más el orden y el recomendado, en forma canónica. */
  function contenidoFirmado(final){ return JSON.stringify({ resumen:final.resumen, recomendacion:final.recomendacion, recomendado:final.recomendado, orden:final.orden.map(f => [f.id, f.total]), condiciones:final.condiciones, riesgos:final.riesgos, notas:final.notas || '' }); }

  return { FIRMAS_MINIMAS, generar, aplicarTextos, estado, contenidoFirmado, confirmadas };
})();
