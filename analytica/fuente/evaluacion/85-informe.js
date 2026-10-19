/* ─────────────── Informe de evaluación (§21) ───────────────
   Sin pantalla. secciones() da la lista de casillas por defecto, con una
   sección por cada requisito que creó el usuario (aparecen solas en el
   lugar 17). armar() devuelve, para las secciones elegidas y en su orden,
   los bloques neutros que dibuja Pdf.generar y las hojas del Excel (una por
   sección tabular, números como números).

   x = { proceso, empresa, concepto:{ final, estado, firmas }, alertas (guardadas),
         actas:[{ tipo, fecha, usuario, sha256Pdf }], documentos:[{ oferta, requisito,
         nombre, sha256, ronda }], imagenes:{ idGrafica:{ src, ancho, alto } },
         graficas:[ids], usuario, fecha } */
const Informe = (function(){
  const money = Util.money;
  const pctTxt = d => d === null || d === undefined || !isFinite(d) ? '—' : (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d * 100).toFixed(1).replace('.', ',') + ' %';
  const num2 = n => n === null || n === undefined ? '—' : String(Util.redondearDec(n, 2)).replace('.', ',');
  const r2 = n => n === null || n === undefined ? null : Util.redondearDec(n, 2);

  const BASE = [
    ['portada', 'Portada y resumen ejecutivo'], ['totales', 'Valores totales de las propuestas'], ['base', 'Presupuesto base'],
    ['capitulos', 'Presupuesto resumido por capítulos de cada proponente'], ['subcapitulos', 'Presupuesto hasta subcapítulos de cada proponente'],
    ['analisisCap', 'Análisis presupuestal por capítulo'], ['analisisSub', 'Análisis presupuestal por subcapítulo'], ['analisisAct', 'Análisis presupuestal por actividad'],
    ['aiu', 'Análisis del AIU'], ['apu', 'Análisis de APU e insumos'], ['desbalance', 'Desbalance, valor artificialmente bajo y riesgo de cantidades'],
    ['legal', 'Análisis legal de las propuestas'], ['financiero', 'Análisis financiero y organizacional'], ['experiencia', 'Experiencia de los proponentes'],
    ['personal', 'Personal, equipos y sistemas de gestión'], ['programacion', 'Análisis de programación'],
    ['adicionales', '(requisitos adicionales)'],
    ['alertas', 'Alertas confirmadas'], ['puntajes', 'Puntajes y orden de elegibilidad'], ['cuadros', 'Cuadro comparativo y cuadro gerencial'],
    ['graficas', 'Gráficas elegidas'], ['concepto', 'Concepto de adjudicación y recomendación'], ['anexos', 'Anexos: actas, documentos con huellas, metodología y trazabilidad']
  ];

  /** La lista de casillas por defecto, con las secciones de los requisitos del usuario en el lugar 17. */
  function secciones(R){
    const L = [];
    BASE.forEach(([id, nombre]) => {
      if (id !== 'adicionales'){ L.push({ id, nombre, marcada:true }); return; }
      R.requisitos.filter(r => r.activo !== false && Comparativo.adicional(r)).forEach(r => L.push({ id:'req:' + r.codigo, nombre:r.grupo + ' · ' + r.codigo + ' ' + r.nombre, marcada:true, adicional:true }));
    });
    return L;
  }
  /** Una configuración guardada, puesta al día: las secciones nuevas entran marcadas al final de su lugar; las que ya no existen salen. */
  function normalizar(R, cfg){
    const def = secciones(R);
    const ids = new Set(def.map(s => s.id));
    const guardadas = ((cfg && cfg.secciones) || []).filter(s => ids.has(s.id));
    const conocidas = new Set(guardadas.map(s => s.id));
    const nuevas = def.filter(s => !conocidas.has(s.id));
    return guardadas.map(s => Object.assign({}, def.find(d => d.id === s.id), { marcada:s.marcada !== false })).concat(nuevas);
  }

  function nombreArchivo(codigo, fecha, ext){ return 'ARKEN_ANALYTICA_' + Util.codigoArchivo(codigo) + '_Informe_' + String(fecha || Util.hoyISO()).slice(0, 10).replace(/-/g, '') + '.' + (ext || 'pdf'); }

  /* ── Ayudas para tablas ── */
  const nombres = R => R.ofertas.map(o => o.nombre);
  function hoja(nombre, cabeza, filas){ return { nombre, filas:[cabeza].concat(filas) }; }
  function cuadroBloques(R, nivel, conPct, titulo){
    const C = Comparativo.cuadro(R, { nivel });
    const cab = ['Código', 'Descripción', 'Base'].concat(...C.columnas.map(c => conPct ? [c.nombre, 'Δ base'] : [c.nombre]));
    const filas = C.filas.concat(C.pie).map(f => ({ tipo:f.tipo === 'cap' && nivel !== 'capitulo' ? 'cap' : f.tipo === 'sub' && nivel === 'actividad' ? 'sub' : f.tipo === 'pie' ? 'sub' : '',
      celdas:[f.codigo || '', f.nombre, money(f.base)].concat(...C.columnas.map(c => { const x = f.celdas[c.id]; return conPct ? [x ? money(x.valor) : '—', x ? pctTxt(x.pctBase) : '—'] : [x ? money(x.valor) : '—']; })) }));
    const n = C.columnas.length;
    const anchos = [8, 26, 12].concat(...C.columnas.map(() => conPct ? [12, 7] : [12]));
    const alinear = {}; for (let i = 2; i < 3 + n * (conPct ? 2 : 1); i++) alinear[i] = 'right';
    const T = Comparativo.tabla(C, conPct);
    return { bloques:[{ t:'tabla', cabeza:cab, filas, anchos, alinear, letraChica:n > 4 || nivel === 'actividad' }], hoja:hoja(titulo, T.cabeza, T.filas.map(f => f.celdas)) };
  }
  function matrizRequisitos(R, filtro){
    const filas = Comparativo.requisitos(R).filter(filtro);
    const cab = ['Requisito'].concat(nombres(R));
    const celda = x => x.cumple + (x.puntos !== null ? ' · ' + num2(x.puntos) + ' pts' : '') + (x.observacion ? '\n' + x.observacion : '');
    return {
      bloques:filas.length ? [{ t:'tabla', cabeza:cab, filas:filas.map(f => ({ celdas:[f.codigo + ' · ' + f.nombre].concat(R.ofertas.map(o => celda(f.celdas[o.id]))) })), anchos:[24].concat(R.ofertas.map(() => 16)), letraChica:true }] : [{ t:'texto', txt:'El pliego no tiene requisitos en este grupo.', gris:true }],
      filas:filas.map(f => [f.codigo, f.grupo, f.nombre].concat(...R.ofertas.map(o => [f.celdas[o.id].cumple, f.celdas[o.id].puntos, f.celdas[o.id].observacion])))
    };
  }
  const cabMatriz = R => ['Código', 'Grupo', 'Requisito'].concat(...R.ofertas.map(o => [o.nombre + ' · cumple', o.nombre + ' · puntos', o.nombre + ' · observación']));

  /* ── Las secciones ── */
  const SEC = {};
  SEC.portada = (R, x) => {
    const c = x.concepto && x.concepto.final;
    const p = x.proceso || R.proceso;
    return { bloques:[
      { t:'portada', eyebrow:'Informe de evaluación de propuestas', titulo:p.nombre || p.codigo, clave:p.codigo, lineas:[(x.empresa && x.empresa.razonSocial) || '', 'Generado el ' + Util.fmtFechaLarga(x.fecha || Util.hoyISO()) + (x.usuario ? ' por ' + x.usuario : ''), x.concepto && x.concepto.estado === 'firmado' ? 'Concepto firmado por el comité' : 'Borrador: no es una decisión'], demo:!!p.demo },
      { t:'indice' },
      { t:'sec', txt:'Resumen ejecutivo' },
      { t:'texto', txt:c ? c.resumen : '' },
      { t:'texto', txt:c ? c.recomendacion : '', negrita:true },
      { t:'kv', cols:2, pares:[['Presupuesto base', money(R.totalesBase.total)], ['Ofertas abiertas', R.ofertas.length], ['Habilitadas', R.ofertas.filter(o => R.porOferta[o.id].habilitacion.estado === 'habilitada').length],
        ['Alertas confirmadas', (x.alertas || []).filter(a => a.vigente !== false && Alertas.estado(a) === 'confirmada').length], ['Puntaje', R.puntaje.provisional ? 'Provisional' : 'Definitivo'], ['Concepto', x.concepto ? x.concepto.estado : 'sin generar']] }
    ] };
  };
  SEC.totales = R => {
    const tb = R.totalesBase;
    const filas = R.ofertas.map(o => [o.nombre, o.totales.costoDirecto, o.totales.aiu, o.totales.iva, o.totales.total, tb.total ? (o.totales.total - tb.total) / tb.total : null, R.porOferta[o.id].habilitacion.estado]);
    return { bloques:[{ t:'tabla', cabeza:['Proponente', 'Costo directo', 'AIU', 'IVA', 'Total', 'Δ base', 'Habilitación'], anchos:[30, 14, 13, 11, 14, 8, 12], alinear:{ 1:'right', 2:'right', 3:'right', 4:'right', 5:'right' },
        filas:[{ tipo:'sub', celdas:['Presupuesto base', money(tb.costoDirecto), money(tb.aiu), money(tb.iva), money(tb.total), '', ''] }].concat(filas.map(f => ({ celdas:[f[0], money(f[1]), money(f[2]), money(f[3]), money(f[4]), pctTxt(f[5]), f[6]] }))) }],
      hojas:[hoja('Valores totales', ['Proponente', 'Costo directo', 'AIU', 'IVA', 'Total', 'Δ base %', 'Habilitación'], [['Presupuesto base', Util.redondear(tb.costoDirecto), Util.redondear(tb.aiu), Util.redondear(tb.iva), Util.redondear(tb.total), null, '']].concat(filas.map(f => [f[0], Util.redondear(f[1]), Util.redondear(f[2]), Util.redondear(f[3]), Util.redondear(f[4]), f[5] === null ? null : r2(f[5] * 100), f[6]])))] };
  };
  SEC.base = R => {
    const pb = R.ctx.base, filas = [], aoa = [];
    (pb.capitulos||[]).forEach(c => {
      filas.push({ tipo:'cap', celdas:[c.codigo, c.nombre, '', '', '', money(Calculo.valorCapitulo(pb, c))] }); aoa.push([c.codigo, c.nombre, '', null, null, Util.redondear(Calculo.valorCapitulo(pb, c))]);
      (c.subs||[]).forEach(s => {
        filas.push({ tipo:'sub', celdas:[s.codigo, s.nombre, '', '', '', money(Calculo.valorSubcapitulo(pb, s))] }); aoa.push([s.codigo, s.nombre, '', null, null, Util.redondear(Calculo.valorSubcapitulo(pb, s))]);
        (s.acts||[]).forEach(a => { const u = Calculo.unitarioActividad(pb, a); filas.push({ celdas:[a.codigo, a.nombre, a.unidad, Util.cant(a.cantidad), Util.money3(u), money(u * a.cantidad)] }); aoa.push([a.codigo, a.nombre, a.unidad, Number(a.cantidad), Util.redondearDec(u, 3), Util.redondear(u * a.cantidad)]); });
      });
    });
    const tb = R.totalesBase;
    return { bloques:[{ t:'tabla', cabeza:['Código', 'Descripción', 'Und', 'Cantidad', 'Unitario', 'Valor'], anchos:[9, 44, 6, 11, 14, 16], alinear:{ 3:'right', 4:'right', 5:'right' }, filas,
        pie:['', 'Total (costo directo ' + money(tb.costoDirecto) + ' + AIU ' + money(tb.aiu) + ' + IVA ' + money(tb.iva) + ')', '', '', '', money(tb.total)] }],
      hojas:[hoja('Presupuesto base', ['Código', 'Descripción', 'Unidad', 'Cantidad', 'Unitario', 'Valor'], aoa)] };
  };
  SEC.capitulos = R => { const c = cuadroBloques(R, 'capitulo', false, 'Por capítulos'); return { bloques:c.bloques, hojas:[c.hoja], orientacion:R.ofertas.length > 3 ? 'l' : 'p' }; };
  SEC.subcapitulos = R => { const c = cuadroBloques(R, 'subcapitulo', false, 'Hasta subcapítulos'); return { bloques:c.bloques, hojas:[c.hoja], orientacion:'l' }; };
  SEC.analisisCap = R => { const c = cuadroBloques(R, 'capitulo', true, 'Análisis por capítulo'); return { bloques:[{ t:'texto', txt:'Valor de cada oferta y su desviación frente al presupuesto base. La mediana y la diferencia frente a ella están en el Excel.', gris:true }].concat(c.bloques), hojas:[c.hoja], orientacion:'l' }; };
  SEC.analisisSub = R => { const c = cuadroBloques(R, 'subcapitulo', true, 'Análisis por subcapítulo'); return { bloques:c.bloques, hojas:[c.hoja], orientacion:'l' }; };
  SEC.analisisAct = R => { const c = cuadroBloques(R, 'actividad', true, 'Análisis por actividad'); return { bloques:c.bloques, hojas:[c.hoja], orientacion:'l' }; };
  SEC.aiu = R => {
    const filas = R.aiu.map(a => { const o = R.ofertas.find(x => x.id === a.id) || {}; const ad = R.porOferta[a.id].administracion || {};
      return [o.nombre, a.pctA, a.pctI, a.pctU, a.a, a.totalDesglose, a.cuadra ? 'sí' : 'no', a.modoIva + ' · ' + a.tarifaIva + ' %', ad.texto || ad.detalle || ''] });
    const tb = R.totalesBase;
    return { bloques:[{ t:'texto', txt:'AIU del presupuesto base: A ' + Util.pct(tb.pctA) + ' · I ' + Util.pct(tb.pctI) + ' · U ' + Util.pct(tb.pctU) + '.' },
        { t:'tabla', cabeza:['Proponente', 'A %', 'I %', 'U %', 'Administración', 'Desglose', 'Cuadra', 'IVA'], anchos:[28, 7, 7, 7, 15, 15, 8, 13], alinear:{ 1:'right', 2:'right', 3:'right', 4:'right', 5:'right' },
          filas:filas.map(f => ({ celdas:[f[0], num2(f[1]), num2(f[2]), num2(f[3]), money(f[4]), money(f[5]), f[6], f[7]] })) }],
      hojas:[hoja('AIU', ['Proponente', 'A %', 'I %', 'U %', 'Administración', 'Desglose de la administración', 'Cuadra', 'IVA'], filas.map(f => [f[0], f[1], f[2], f[3], Util.redondear(f[4]), Util.redondear(f[5]), f[6], f[7]]))] };
  };
  SEC.apu = R => {
    const nom = id => (R.ofertas.find(o => o.id === id) || {}).nombre || id;
    const h = (R.apu.hallazgos || []).map(z => [nom(z.ofertaId), z.codigo, z.tipo, z.detalle]);
    return { bloques:h.length ? [{ t:'tabla', cabeza:['Proponente', 'Actividad', 'Hallazgo', 'Detalle'], anchos:[24, 10, 20, 46], filas:h.map(c => ({ celdas:c })) }] : [{ t:'texto', txt:'Sin hallazgos en los APU.', gris:true }],
      hojas:[hoja('APU e insumos', ['Proponente', 'Actividad', 'Hallazgo', 'Detalle'], h)] };
  };
  SEC.desbalance = R => {
    const nom = id => (R.ofertas.find(o => o.id === id) || {}).nombre || id;
    const vb = R.valorBajo.filas.map(f => [nom(f.id), f.total, f.desvMediana, f.desvBase, f.bajo ? 'sí' : 'no']);
    const db = R.desbalance.marcadas.map(m => [nom(m.ofertaId), m.codigo, m.nombre, m.unitario, m.base, m.razonBase - 1, (m.reglas || []).join('; ')]);
    const cq = (R.cantidades.lista || []).map(c => [nom(c.ofertaId), c.codigo, c.nombre, c.tipo, c.unitario, c.base, c.razon - 1]);
    return { bloques:[
        { t:'sec', nivel:2, txt:'Valor artificialmente bajo (umbral ' + R.valorBajo.umbralPct + ' % bajo la mediana)' },
        { t:'tabla', cabeza:['Proponente', 'Total', 'Δ mediana', 'Δ base', 'Valor bajo'], anchos:[34, 18, 14, 14, 12], alinear:{ 1:'right', 2:'right', 3:'right' }, filas:vb.map(f => ({ celdas:[f[0], money(f[1]), pctTxt(f[2]), pctTxt(f[3]), f[4]] })) },
        { t:'sec', nivel:2, txt:'Actividades desbalanceadas' },
        db.length ? { t:'tabla', cabeza:['Proponente', 'Actividad', 'Descripción', 'Unitario', 'Base', 'Δ base', 'Regla'], anchos:[18, 9, 24, 12, 12, 8, 17], alinear:{ 3:'right', 4:'right', 5:'right' }, letraChica:true,
          filas:db.map(f => ({ celdas:[f[0], f[1], f[2], Util.money3(f[3]), Util.money3(f[4]), pctTxt(f[5]), f[6]] })) } : { t:'texto', txt:'Ninguna actividad marcada.', gris:true },
        { t:'sec', nivel:2, txt:'Riesgo de cantidades' },
        cq.length ? { t:'tabla', cabeza:['Proponente', 'Actividad', 'Descripción', 'Riesgo', 'Unitario', 'Base', 'Δ base'], anchos:[18, 9, 26, 12, 12, 12, 8], alinear:{ 4:'right', 5:'right', 6:'right' }, letraChica:true,
          filas:cq.map(f => ({ celdas:[f[0], f[1], f[2], f[3], Util.money3(f[4]), Util.money3(f[5]), pctTxt(f[6])] })) } : { t:'texto', txt:'Sin riesgos de cantidades.', gris:true }
      ],
      hojas:[hoja('Valor bajo', ['Proponente', 'Total', 'Δ mediana %', 'Δ base %', 'Valor bajo'], vb.map(f => [f[0], Util.redondear(f[1]), r2(f[2] * 100), f[3] === null ? null : r2(f[3] * 100), f[4]])),
        hoja('Desbalance', ['Proponente', 'Actividad', 'Descripción', 'Unitario', 'Base', 'Δ base %', 'Regla'], db.map(f => [f[0], f[1], f[2], Util.redondearDec(f[3], 3), Util.redondearDec(f[4], 3), r2(f[5] * 100), f[6]])),
        hoja('Riesgo de cantidades', ['Proponente', 'Actividad', 'Descripción', 'Riesgo', 'Unitario', 'Base', 'Δ base %'], cq.map(f => [f[0], f[1], f[2], f[3], Util.redondearDec(f[4], 3), Util.redondearDec(f[5], 3), r2(f[6] * 100)]))] };
  };
  const grupoSec = (titulo, grupos) => R => { const m = matrizRequisitos(R, f => grupos.indexOf(f.grupo) >= 0); return { bloques:m.bloques, hojas:[hoja(titulo, cabMatriz(R), m.filas)], orientacion:R.ofertas.length > 3 ? 'l' : 'p' }; };
  SEC.legal = grupoSec('Legal', ['Jurídico']);
  SEC.financiero = R => {
    const filas = [];
    R.ofertas.forEach(o => { const po = R.porOferta[o.id]; Object.keys(po.financiero || {}).forEach(c => (po.financiero[c].indicadores || []).forEach(i => filas.push([o.nombre, c, i.nombre, i.formula, i.valorCalculado, (i.op === '>=' ? '≥ ' : i.op === '<=' ? '≤ ' : i.op + ' ') + i.limite, i.cumple ? 'sí' : 'no', po.financiero[c].consorcio ? 'consorcio o unión temporal' : '']))); });
    const m = matrizRequisitos(R, f => f.grupo === 'Financiero' || f.grupo === 'Organizacional');
    return { bloques:[{ t:'tabla', cabeza:['Proponente', 'Req.', 'Indicador', 'Fórmula', 'Valor', 'Exigido', 'Cumple'], anchos:[26, 8, 20, 10, 12, 12, 8], alinear:{ 4:'right' }, letraChica:true,
        filas:filas.map(f => ({ celdas:[f[0], f[1], f[2], f[3], Math.abs(f[4]) >= 1000 ? money(f[4]) : num2(f[4]), f[5], f[6]] })) }].concat(m.bloques),
      hojas:[hoja('Indicadores financieros', ['Proponente', 'Requisito', 'Indicador', 'Fórmula', 'Valor', 'Exigido', 'Cumple', 'Figura'], filas.map(f => f.slice(0, 4).concat([Util.redondearDec(f[4], 4)], f.slice(5)))), hoja('Financiero', cabMatriz(R), m.filas)] };
  };
  SEC.experiencia = R => {
    const filas = [];
    R.ofertas.forEach(o => { const ex = R.porOferta[o.id].experiencia || {}; Object.keys(ex).forEach(c => (ex[c].contratos || []).forEach(k => filas.push([o.nombre, c, k.contratante, k.objeto, k.terminacion, k.valor, k.participacion, k.enSmmlv, k.cuenta ? 'sí' : 'no', k.motivo || '']))); });
    const res = R.ofertas.map(o => { const e = Comparativo.experiencia(R, o.id); return [o.nombre, e ? e.suma : null, e ? e.exigido : null, e ? (e.cumple ? 'sí' : 'no') : '—']; });
    return { bloques:[{ t:'tabla', cabeza:['Proponente', 'SMMLV acreditados', 'Exigidos', 'Cumple'], anchos:[40, 20, 20, 12], alinear:{ 1:'right', 2:'right' }, filas:res.map(f => ({ celdas:[f[0], f[1] === null ? '—' : Util.cant(Util.redondearDec(f[1], 1)), f[2] === null ? '—' : Util.cant(Util.redondearDec(f[2], 1)), f[3]] })) },
        { t:'tabla', cabeza:['Proponente', 'Req.', 'Contratante', 'Terminación', 'Valor', 'SMMLV', 'Cuenta'], anchos:[20, 7, 30, 11, 14, 9, 9], alinear:{ 4:'right', 5:'right' }, letraChica:true,
          filas:filas.map(f => ({ celdas:[f[0], f[1], f[2], f[4], money(f[5]), Util.cant(Util.redondearDec(f[7] || 0, 1)), f[8] + (f[9] ? ' · ' + f[9] : '')] })) }],
      hojas:[hoja('Experiencia', ['Proponente', 'Requisito', 'Contratante', 'Objeto', 'Terminación', 'Valor', 'Participación %', 'SMMLV', 'Cuenta', 'Motivo'], filas.map(f => f.slice(0, 7).concat([Util.redondearDec(f[7] || 0, 2)], f.slice(8))))] };
  };
  SEC.personal = R => {
    const filas = [];
    R.ofertas.forEach(o => { const pe = R.porOferta[o.id].personal || {}; Object.keys(pe).forEach(c => (pe[c] || []).forEach(x => filas.push([o.nombre, c, x.cargo, x.nombre, x.profesion, x.anios, x.dedicacion, x.cumple ? 'sí' : 'no', (x.faltas || []).join('; ')]))); });
    const dc = [];
    R.ofertas.forEach(o => (R.porOferta[o.id].dobleCargo || []).forEach(d => dc.push(o.nombre + ': ' + (d.texto || d.nombre || JSON.stringify(d)))));
    const m = matrizRequisitos(R, f => ['Personal', 'Equipos', 'Sistemas de gestión', 'SG-SST', 'Ambiental'].indexOf(f.grupo) >= 0);
    return { bloques:[{ t:'tabla', cabeza:['Proponente', 'Req.', 'Cargo', 'Nombre', 'Años', 'Ded. %', 'Cumple'], anchos:[22, 7, 18, 26, 7, 8, 12], alinear:{ 4:'right', 5:'right' }, letraChica:true,
        filas:filas.map(f => ({ celdas:[f[0], f[1], f[2], f[3], f[5], f[6], f[7] + (f[8] ? ' · ' + f[8] : '')] })) }].concat(dc.length ? [{ t:'lista', items:dc }] : [], m.bloques),
      hojas:[hoja('Personal', ['Proponente', 'Requisito', 'Cargo', 'Nombre', 'Profesión', 'Años', 'Dedicación %', 'Cumple', 'Faltas'], filas), hoja('Equipos y sistemas', cabMatriz(R), m.filas)], orientacion:R.ofertas.length > 3 ? 'l' : 'p' };
  };
  SEC.programacion = R => {
    const filas = R.ofertas.map(o => { const pg = R.porOferta[o.id].programacion || {}; return [o.nombre, pg.aplica ? pg.plazo : null, pg.inicio || '', pg.fin || '', pg.cpm ? (pg.cpm.ciclo ? 'ciclo en las dependencias' : (pg.cpm.critica || []).length + ' actividades') : '', (pg.hallazgos || []).map(h => h.texto || h.detalle || h).join('; ') || 'sin hallazgos', (pg.sinProgramar || []).length]; });
    return { bloques:[{ t:'tabla', cabeza:['Proponente', 'Plazo', 'Inicio', 'Fin', 'Ruta crítica', 'Hallazgos'], anchos:[24, 8, 11, 11, 16, 30], filas:filas.map(f => ({ celdas:[f[0], f[1] === null ? '—' : f[1] + ' días', f[2], f[3], f[4], f[5] + (f[6] ? ' · ' + f[6] + ' sin programar' : '')] })) }],
      hojas:[hoja('Programación', ['Proponente', 'Plazo (días)', 'Inicio', 'Fin', 'Ruta crítica', 'Hallazgos', 'Actividades sin programar'], filas)] };
  };
  function adicional(codigo){
    return R => {
      const r = R.requisitos.find(x => x.codigo === codigo);
      const m = matrizRequisitos(R, f => f.codigo === codigo);
      return { titulo:r ? r.grupo + ' · ' + r.codigo + ' ' + r.nombre : codigo, bloques:[{ t:'texto', txt:r ? r.descripcion || '' : '', gris:true }].concat(m.bloques), hojas:[hoja(('Req ' + codigo).slice(0, 31), cabMatriz(R), m.filas)] };
    };
  }
  SEC.alertas = (R, x) => {
    const nom = id => (R.ofertas.find(o => o.id === id) || {}).nombre || id;
    const L = (x.alertas || []).filter(a => a.vigente !== false && Alertas.estado(a) === 'confirmada');
    const ult = a => (a.estados || []).slice(-1)[0] || {};
    const filas = L.map(a => [a.alerta.nivel, a.alerta.titulo, a.alerta.ofertas.map(nom).join(' · '), a.alerta.porque, a.alerta.regla, a.alerta.accion, ult(a).usuario || '', ult(a).fecha || '']);
    return { bloques:filas.length ? [{ t:'tabla', cabeza:['Nivel', 'Alerta', 'Proponentes', 'Por qué importa', 'Regla', 'Confirmó'], anchos:[9, 26, 17, 22, 17, 9], letraChica:true,
        filas:filas.map(f => ({ celdas:[f[0], f[1], f[2], f[3], f[4], f[6]] })) }] : [{ t:'texto', txt:'No hay alertas confirmadas.', gris:true }],
      hojas:[hoja('Alertas confirmadas', ['Nivel', 'Alerta', 'Proponentes', 'Por qué importa', 'Regla', 'Qué hacer', 'Confirmó', 'Fecha'], filas)], orientacion:'l' };
  };
  SEC.puntajes = R => {
    const grupos = [];
    R.puntaje.filas.forEach(f => Object.keys(f.grupos).forEach(g => { if (grupos.indexOf(g) < 0) grupos.push(g); }));
    const orden = R.puntaje.orden;
    const eco = Object.keys(R.puntaje.economicos).map(k => k + ' · ' + R.puntaje.economicos[k].nombre + ': ' + R.puntaje.economicos[k].detalle);
    const noH = R.puntaje.noHabilitadas.map(id => (R.ofertas.find(o => o.id === id) || {}).nombre + ': ' + (R.porOferta[id].habilitacion.causales || []).map(c => c.texto).join(' · '));
    return { bloques:[{ t:'texto', txt:R.puntaje.provisional ? 'PUNTAJE PROVISIONAL: faltan verificaciones o subsanaciones.' : 'Puntaje definitivo.', negrita:true },
        { t:'tabla', cabeza:['Puesto', 'Proponente'].concat(grupos, ['Total']), anchos:[6, 24].concat(grupos.map(() => 8), [9]), alinear:Object.fromEntries(grupos.map((g, i) => [i + 2, 'right']).concat([[grupos.length + 2, 'right']])), letraChica:grupos.length > 6,
          filas:orden.map(f => ({ celdas:[f.puesto, f.nombre].concat(grupos.map(g => num2(f.grupos[g] || 0)), [num2(f.total)]) })) },
        { t:'lista', items:eco }].concat(noH.length ? [{ t:'sec', nivel:2, txt:'No habilitadas' }, { t:'lista', items:noH }] : [], (R.puntaje.empates || []).length ? [{ t:'texto', txt:'Hay empates sin resolver: se decide con la regla de desempate del pliego o con sorteo registrado en acta.' }] : []),
      hojas:[hoja('Puntajes', ['Puesto', 'Proponente'].concat(grupos, ['Total']), orden.map(f => [f.puesto, f.nombre].concat(grupos.map(g => r2(f.grupos[g] || 0)), [r2(f.total)])))], orientacion:grupos.length > 6 ? 'l' : 'p' };
  };
  SEC.cuadros = (R, x) => {
    const G = Comparativo.gerencial(R, { alertas:x.alertas, concepto:x.concepto ? { estado:x.concepto.estado, recomendado:x.concepto.final && x.concepto.final.recomendado } : null });
    const filas = G.filas.map(f => [f.puesto || '—', f.nombre, f.total, f.pctBase, f.plazo, f.aiuPct, f.habilitacion, f.puntaje, f.experiencia ? f.experiencia.suma : null, f.criticas, f.semaforo]);
    const c = cuadroBloques(R, 'capitulo', true, 'Cuadro comparativo');
    return { bloques:[{ t:'texto', txt:G.portada, negrita:true },
        { t:'tabla', cabeza:['Puesto', 'Proponente', 'Total', 'Δ base', 'Plazo', 'AIU %', 'Habilitación', 'Puntaje', 'SMMLV', 'Críticas', 'Semáforo'], anchos:[6, 22, 12, 7, 6, 6, 11, 7, 8, 6, 8], alinear:{ 2:'right', 3:'right', 7:'right', 8:'right' }, letraChica:true,
          filas:filas.map(f => ({ celdas:[f[0], f[1], money(f[2]), pctTxt(f[3]), f[4] === null ? '—' : f[4], num2(f[5]), f[6], f[7] === null ? '—' : num2(f[7]), f[8] === null ? '—' : Util.cant(Util.redondear(f[8])), f[9], f[10]] })) },
        { t:'sec', nivel:2, txt:'Cuadro comparativo por capítulo' }].concat(c.bloques),
      hojas:[hoja('Cuadro gerencial', ['Puesto', 'Proponente', 'Total', 'Δ base %', 'Plazo (días)', 'AIU %', 'Habilitación', 'Puntaje', 'Experiencia SMMLV', 'Alertas críticas', 'Semáforo'], filas.map(f => [f[0], f[1], Util.redondear(f[2]), f[3] === null ? null : r2(f[3] * 100), f[4], r2(f[5]), f[6], f[7], f[8] === null ? null : r2(f[8]), f[9], f[10]])), c.hoja], orientacion:'l' };
  };
  SEC.graficas = (R, x) => {
    const B = [];
    (x.graficas || Graficas.LISTA.map(g => g.id)).forEach(id => {
      const g = Graficas.una(id, R, x.opcionesGraficas || {});
      const img = (x.imagenes || {})[id];
      B.push({ t:'sec', nivel:2, txt:g.numero + '. ' + g.titulo });
      if (img) B.push({ t:'imagen', src:img.src, ancho:img.ancho, alto:img.alto });
      B.push({ t:'texto', txt:g.descripcion, gris:true });
    });
    return { bloques:B, hojas:[] };
  };
  SEC.concepto = (R, x) => {
    const c = x.concepto && x.concepto.final;
    if (!c) return { bloques:[{ t:'texto', txt:'El concepto de adjudicación aún no se ha generado.', gris:true }], hojas:[] };
    const nom = id => (R.ofertas.find(o => o.id === id) || {}).nombre || id;
    const B = [{ t:'texto', txt:c.resumen }];
    B.push({ t:'sec', nivel:2, txt:'Cómo le fue a cada proponente, por grupo' });
    B.push({ t:'tabla', cabeza:['Grupo', 'Requisito', 'Mejor', 'Por qué'], anchos:[14, 34, 26, 26], letraChica:true,
      filas:c.porGrupo.flatMap(g => g.requisitos.filter(r => r.ponderable || r.mejor.length < R.ofertas.length).map(r => ({ celdas:[g.grupo, r.codigo + ' · ' + r.nombre, r.mejor.map(nom).join(', ') || '—', r.porque] }))) });
    R.ofertas.forEach(o => {
      B.push({ t:'sec', nivel:2, txt:o.nombre });
      const f = c.fortalezas[o.id] || [], d = c.debilidades[o.id] || [];
      B.push({ t:'texto', txt:'Fortalezas', negrita:true }, f.length ? { t:'lista', items:f.map(z => z.texto) } : { t:'texto', txt:'—', gris:true });
      B.push({ t:'texto', txt:'Lo que no es adecuado, y por qué', negrita:true }, d.length ? { t:'lista', items:d.map(z => z.texto) } : { t:'texto', txt:'Nada, según las alertas confirmadas y los requisitos.', gris:true });
    });
    B.push({ t:'sec', nivel:2, txt:'Orden de elegibilidad y recomendación' });
    B.push({ t:'lista', numerada:true, items:c.orden.map(f => f.nombre + ' · ' + num2(f.total) + ' puntos') });
    B.push({ t:'texto', txt:c.recomendacion, negrita:true });
    if (c.condiciones.length) B.push({ t:'texto', txt:'Condiciones de la recomendación', negrita:true }, { t:'lista', items:c.condiciones });
    Object.keys(c.riesgos || {}).forEach(id => B.push({ t:'texto', txt:'Riesgos de adjudicar a ' + nom(id), negrita:true }, { t:'lista', items:c.riesgos[id] }));
    if (c.notas) B.push({ t:'texto', txt:c.notas });
    B.push({ t:'sec', nivel:2, txt:'Firmas del comité' });
    const firmas = (x.concepto.firmas || []);
    B.push(firmas.length ? { t:'kv', cols:2, pares:firmas.map(fi => [fi.nombre || fi.usuario, 'Firmó el ' + Util.fmtSello(fi.fecha)]) } : { t:'texto', txt:'Sin firmas: borrador, no es una decisión.', gris:true });
    if (x.concepto.huella) B.push({ t:'texto', txt:'Huella SHA-256 del texto firmado: ' + x.concepto.huella, gris:true, tam:7 });
    return { bloques:B, hojas:[] };
  };
  SEC.anexos = (R, x) => {
    const actas = (x.actas || []).map(a => [a.tipo, Util.fmtSello(a.fecha), a.usuario || '', a.sha256Pdf || '']);
    const docs = (x.documentos || []).map(d => [d.oferta, d.requisito || '', d.nombre, d.ronda === 2 ? 'subsanación' : 'oferta', d.sha256]);
    const traza = [];
    R.puntaje.filas.forEach(f => Object.keys(f.puntos).forEach(cod => {
      const r = R.requisitos.find(z => z.codigo === cod) || {}, v = R.vigente(f.id, cod) || {};
      const regla = cod === 'ECO-04' || (r.reglaPuntaje || {}).tipo === 'economica' ? ((R.puntaje.economicos[cod] || {}).nombre || 'económica') : (r.reglaPuntaje ? r.reglaPuntaje.tipo + (r.reglaPuntaje.criterio ? ' · ' + r.reglaPuntaje.criterio : '') : 'manual');
      traza.push([f.nombre, cod, r.nombre || '', f.puntos[cod], Number(r.puntajeMaximo || 0), regla, v.valorVerificado === undefined ? '' : v.valorVerificado, v.evaluador || '', v.fecha || '']);
    }));
    const metodo = Object.keys(R.puntaje.economicos).map(k => R.puntaje.economicos[k].nombre + ': ' + R.puntaje.economicos[k].detalle)
      .concat(['Desbalance: z robusto (mediana y MAD) sobre el precio relativo al nivel de cada oferta, umbral ' + R.desbalance.config.z + ' y al menos ' + R.desbalance.config.minPct + ' % de la mediana; y ±' + R.desbalance.config.pct + ' % frente a la base.',
        'Valor artificialmente bajo: más de ' + R.valorBajo.umbralPct + ' % por debajo de la mediana de las ofertas.',
        'Experiencia: valor de cada contrato dividido por el SMMLV del año de terminación, por la participación del proponente.',
        'Totales recalculados con las cantidades del pliego y los precios unitarios de la oferta; los puntajes se redondean a dos decimales.']);
    return { bloques:[{ t:'sec', nivel:2, txt:'Actas' }, actas.length ? { t:'tabla', cabeza:['Acta', 'Fecha', 'Usuario', 'Huella SHA-256 del PDF'], anchos:[12, 16, 12, 60], letraChica:true, filas:actas.map(c => ({ celdas:c })) } : { t:'texto', txt:'Sin actas.', gris:true },
        { t:'sec', nivel:2, txt:'Documentos recibidos, con su huella' }, docs.length ? { t:'tabla', cabeza:['Proponente', 'Req.', 'Documento', 'Ronda', 'SHA-256'], anchos:[18, 7, 27, 9, 39], letraChica:true, filas:docs.map(c => ({ celdas:c })) } : { t:'texto', txt:'Sin documentos.', gris:true },
        { t:'sec', nivel:2, txt:'Metodología y fórmulas' }, { t:'lista', items:metodo },
        { t:'sec', nivel:2, txt:'Trazabilidad de cada puntaje' }, { t:'tabla', cabeza:['Proponente', 'Req.', 'Puntos', 'Máx.', 'Regla', 'Verificado', 'Evaluador', 'Fecha'], anchos:[20, 8, 8, 7, 22, 10, 11, 14], alinear:{ 2:'right', 3:'right' }, letraChica:true,
          filas:traza.map(t => ({ celdas:[t[0], t[1], num2(t[3]), num2(t[4]), t[5], String(t[6]), t[7], t[8] ? Util.fmtSello(t[8]) : ''] })) }],
      hojas:[hoja('Actas', ['Acta', 'Fecha', 'Usuario', 'SHA-256'], actas), hoja('Documentos', ['Proponente', 'Requisito', 'Documento', 'Ronda', 'SHA-256'], docs),
        hoja('Trazabilidad', ['Proponente', 'Requisito', 'Nombre', 'Puntos', 'Máximo', 'Regla', 'Valor verificado', 'Evaluador', 'Fecha'], traza)], orientacion:'l' };
  };

  /** Bloques del PDF y hojas del Excel para la configuración elegida. */
  function armar(R, cfg, x){
    x = x || {};
    const lista = normalizar(R, cfg).filter(s => s.marcada);
    const bloques = [], hojas = [];
    const usados = new Set();
    lista.forEach((s, k) => {
      const f = s.id.indexOf('req:') === 0 ? adicional(s.id.slice(4)) : SEC[s.id];
      if (!f) return;
      const r = f(R, x);
      if (s.id === 'portada'){ r.bloques.forEach(b => bloques.push(b)); }
      else {
        bloques.push({ t:'sec', txt:(k + 1) + '. ' + (r.titulo || s.nombre), orientacion:r.orientacion || 'p', nueva:true });
        r.bloques.forEach(b => bloques.push(b));
      }
      (r.hojas || []).forEach(h => {
        let n = String(h.nombre).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31), i = 2;
        while (usados.has(n)) n = String(h.nombre).slice(0, 28) + ' ' + (i++);
        usados.add(n); hojas.push({ nombre:n, filas:h.filas });
      });
    });
    const firmado = x.concepto && x.concepto.estado === 'firmado';
    return { bloques, hojas, secciones:lista.map(s => s.id), marcaAgua:firmado ? null : 'BORRADOR: NO ES UNA DECISIÓN' };
  }

  return { BASE:BASE.map(([id, nombre]) => ({ id, nombre })), secciones, normalizar, armar, nombreArchivo };
})();
