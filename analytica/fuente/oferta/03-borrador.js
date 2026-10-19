/* ══════════════════════════════════════════════════════════════════════════
   ARKEN OFERTA · BORRADOR — la oferta mientras el proponente la prepara.
   Un borrador por código de invitación, en IndexedDB.

     acts[clave]   = { precioUnitario, apus:[{ id, codigo, nombre, unidad,
                       insumos:[{ descripcion, unidad, categoria, precio, cantidad }] }] }
                     clave = capítulo|subcapítulo|actividad (Sobre.claveActividad)
     respuestas    = { <código de requisito>: valor | [filas] }
     adjuntos      = [{ id, requisito, fila, columna, nombre, sha256, peso, fechaDocumento, vigenteHasta }]

   Los valores nunca se calculan aquí a mano: la oferta se convierte en el
   presupuesto de ARKEN con Sobre.presupuestoDeOferta y sus totales salen de
   Calculo, exactamente como los recalculará el programa principal.
   ══════════════════════════════════════════════════════════════════════════ */
const Borrador = (function(){

  /* Módulos 05 a 12 y los grupos de requisitos que muestra cada uno (§15). */
  const MODULOS_REQ = [
    ['05', 'Personal', ['Personal']], ['06', 'Experiencia', ['Experiencia']], ['07', 'Financiero', ['Financiero','Organizacional']],
    ['08', 'Programación', ['Programación']], ['09', 'Organigrama', ['Organigrama']], ['10', 'Proveedores', ['Proveedores']],
    ['11', 'Sistemas de gestión', ['Sistemas de gestión','SG-SST','Ambiental']]
  ];
  const GRUPOS_CON_MODULO = new Set(MODULOS_REQ.flatMap(m => m[2]).concat(['Jurídico','Económico']));
  /** El módulo donde el proponente responde un requisito. Jurídico va en 01. */
  function moduloDe(r){
    if (r.grupo === 'Jurídico') return '01';
    if (r.grupo === 'Económico') return '04';
    const m = MODULOS_REQ.find(x => x[2].indexOf(r.grupo) >= 0);
    return m ? m[0] : '12';
  }
  function requisitosDe(pl, modulo){ return (pl.requisitos||[]).filter(r => moduloDe(r) === modulo && r.grupo !== 'Económico'); }
  /** Los requisitos económicos ECO-* salen del presupuesto: el programa los responde solo. */
  function automatico(r){ return r.grupo === 'Económico'; }

  const DESGLOSE = ['Personal de dirección y administración','Oficina y campamento','Pólizas','Impuestos y contribuciones','Ensayos de laboratorio','Otros'];

  function nuevo(pl){
    const inv = pl.invitado, ahora = new Date().toISOString();
    return { id:inv.codigoInvitacion, proceso:pl.proceso.codigo, versionPliego:pl.versionPliego, creado:ahora, actualizado:ahora, demo:!!pl.proceso.demo,
      proponente:{ razonSocial:inv.razonSocial, nit:inv.nit, tipo:'juridica', integrantes:[], representante:'', documentoRepresentante:'',
        domicilio:'', direccion:'', telefono:'', correo:'' },
      acts:{}, aiu:{ a:0, i:0, u:0 },
      desglose:DESGLOSE.map((c, i) => ({ id:'dg' + i, concepto:c, personal:i === 0, filas:i === 0 ? [] : undefined, valor:0 })),
      respuestas:{}, adjuntos:[], organigrama:[], preguntas:[], respuestasRecibidas:[], adendas:[], pliegoAdenda:null,
      revisar:{ actividades:[], requisitos:[] }, acuerdo:null, sobres:[] };
  }

  /* ── Actividades del formulario ── */
  function actividades(pl){
    const L = [];
    ((pl.formularioCantidades||{}).capitulos||[]).forEach(c => (c.subs||[]).forEach(s => (s.acts||[]).forEach(a =>
      L.push({ clave:Sobre.claveActividad(c.codigo, s.codigo, a.codigo), cap:c.codigo, capNombre:c.nombre, sub:s.codigo, subNombre:s.nombre,
        codigo:a.codigo, nombre:a.nombre, unidad:a.unidad, cantidad:Number(a.cantidad||0), apuObligatorio:!!a.apuObligatorio, cantidadIncierta:!!a.cantidadIncierta }))));
    return L;
  }
  function act(b, clave){ return b.acts[clave] || { precioUnitario:0, apus:[] }; }
  function unitarioApu(ap){ return (ap.insumos||[]).reduce((t, x) => t + Number(x.cantidad||0) * Number(x.precio||0), 0); }

  /** presupuesto de oferta.json (§16) a partir del borrador. */
  function presupuestoOferta(b, pl){
    return { actividades:actividades(pl).filter(a => b.acts[a.clave]).map(a => {
      const x = b.acts[a.clave];
      const apus = (x.apus||[]).filter(ap => (ap.insumos||[]).length).map(ap => ({ codigo:ap.codigo, nombre:ap.nombre, unidad:ap.unidad,
        insumos:ap.insumos.map(i => ({ descripcion:i.descripcion, unidad:i.unidad, categoria:i.categoria, precio:Number(i.precio||0), cantidad:Number(i.cantidad||0) })) }));
      return { capitulo:a.cap, subcapitulo:a.sub, codigo:a.codigo, precioUnitario:apus.length ? Util.redondearDec(apus.reduce((t, ap) => t + unitarioApu(ap), 0), 3) : Number(x.precioUnitario||0), apus };
    }), aiu:{ a:Number(b.aiu.a||0), i:Number(b.aiu.i||0), u:Number(b.aiu.u||0) }, iva:Util.copia(pl.proceso.iva) };
  }
  /** Presupuesto de ARKEN y totales, con el mismo cálculo del principal. */
  function calculo(b, pl){
    const po = presupuestoOferta(b, pl);
    const r = Sobre.presupuestoDeOferta(po, pl.formularioCantidades);
    const t = Calculo.totales(r.pres);
    const unit = new Map();
    Calculo.recorrerActividades(r.pres, (a, s, c) => unit.set(Sobre.claveActividad(c.codigo, s.codigo, a.codigo), Calculo.unitarioActividad(r.pres, a)));
    return { po, pres:r.pres, totales:t, unitario:unit, faltantes:r.faltantes };
  }

  /* ── Validaciones en vivo del presupuesto (§15, módulo 03) ── */
  function avisosActividad(a, x){
    const L = [];
    const apus = x.apus || [];
    const conInsumos = apus.filter(ap => (ap.insumos||[]).length);
    const suma = conInsumos.reduce((t, ap) => t + unitarioApu(ap), 0);
    if (!conInsumos.length && !(Number(x.precioUnitario) > 0)) L.push({ nivel:'bad', txt:'Sin precio' });
    if (a.apuObligatorio && !conInsumos.length) L.push({ nivel:'bad', txt:'El pliego exige APU' });
    apus.forEach(ap => {
      if (!(ap.insumos||[]).length) L.push({ nivel:'warn', txt:'APU ' + (ap.codigo || '') + ' vacío' });
      if ((ap.insumos||[]).some(i => !(Number(i.cantidad) > 0))) L.push({ nivel:'warn', txt:'Rendimiento en cero en ' + (ap.codigo || 'un APU') });
      if ((ap.insumos||[]).some(i => !(Number(i.precio) > 0))) L.push({ nivel:'warn', txt:'Insumo con precio en cero en ' + (ap.codigo || 'un APU') });
      if ((ap.insumos||[]).length && !(ap.insumos||[]).some(i => i.categoria === 'Mano de Obra' || i.categoria === 'Todo Costo')) L.push({ nivel:'warn', txt:'Sin mano de obra en ' + (ap.codigo || 'un APU') });
    });
    if (conInsumos.length && Number(x.precioUnitario) > 0 && !Util.igualDinero(x.precioUnitario, suma))
      L.push({ nivel:'warn', txt:'El precio escrito (' + Util.money3(x.precioUnitario) + ') no es la suma de los APU (' + Util.money3(suma) + '): vale la suma' });
    return L;
  }

  /* ── AIU y desglose de la administración ── */
  function valorDesglose(d){
    if (d.personal) return (d.filas||[]).reduce((t, f) => t + Number(f.dedicacion||0) / 100 * Number(f.meses||0) * Number(f.mensual||0), 0);
    return Number(d.valor||0);
  }
  function totalDesglose(b){ return (b.desglose||[]).reduce((t, d) => t + valorDesglose(d), 0); }
  /** El desglose cuadra con A si la diferencia no pasa de un peso por millón (o de 1.000 pesos). */
  function cuadraDesglose(b, totales){
    const dif = Math.abs(totalDesglose(b) - totales.a);
    return dif <= Math.max(1000, totales.a * 0.001);
  }

  /* ── Requisitos ── */
  function adjuntosDe(b, codigo, fila, columna){
    return (b.adjuntos||[]).filter(x => x.requisito === codigo && (fila === undefined || x.fila === fila) && (columna === undefined || x.columna === columna));
  }
  function filas(b, r){ const v = b.respuestas[r.codigo]; return Array.isArray(v) ? v : []; }
  /** ¿Está respondido? Devuelve la lista de lo que falta (vacía si está completo). */
  function faltaRequisito(b, r){
    const f = [];
    if (r.tipoRespuesta === 'documento'){ if (!adjuntosDe(b, r.codigo).length) f.push('adjunte el documento'); }
    else if (r.tipoRespuesta === 'dato'){ const v = b.respuestas[r.codigo]; if (v === undefined || v === null || String(v).trim() === '') f.push('escriba el dato'); }
    else if (r.tipoRespuesta === 'tabla'){
      const fs = filas(b, r);
      if (!fs.length) f.push('agregue al menos un renglón');
      const cols = (r.tabla||{}).columnas || [];
      fs.forEach((fl, i) => cols.forEach(c => {
        if (c.tipo === 'documento'){ if (!adjuntosDe(b, r.codigo, i, c.clave).length) f.push('renglón ' + (i + 1) + ': adjunte «' + c.titulo + '»'); }
        else if (fl[c.clave] === undefined || String(fl[c.clave]).trim() === '') f.push('renglón ' + (i + 1) + ': «' + c.titulo + '» vacío');
      }));
    }
    return f;
  }
  /** Las respuestas de ECO-01 a ECO-05, calculadas del presupuesto. */
  function respuestasEconomicas(b, pl, k){
    const acts = actividades(pl);
    const conPrecio = acts.filter(a => (k.unitario.get(a.clave) || 0) > 0).length;
    const apuOk = acts.filter(a => a.apuObligatorio).every(a => (act(b, a.clave).apus||[]).some(ap => (ap.insumos||[]).length));
    return { 'ECO-01':conPrecio === acts.length ? 'Sí' : 'No', 'ECO-02':apuOk ? 'Sí' : 'No', 'ECO-03':cuadraDesglose(b, k.totales) ? 'Sí' : 'No',
      'ECO-04':k.totales.total, 'ECO-05':pl.presupuestoOficial ? (k.totales.total <= pl.presupuestoOficial ? 'Sí' : 'No') : 'No aplica' };
  }

  /* ── Lista de verificación del módulo 14 ── */
  /** [{ grupo, texto, ok, modulo, detalle[] }]: todo lo obligatorio, en orden de módulo. */
  function revision(b, pl){
    const L = [];
    const add = (grupo, texto, ok, modulo, detalle) => L.push({ grupo, texto, ok:!!ok, modulo, detalle:detalle || [] });
    const p = b.proponente;
    const faltaP = ['representante','documentoRepresentante','domicilio','correo'].filter(k => !String(p[k]||'').trim());
    add('Proponente', 'Datos del proponente completos', !faltaP.length, '01', faltaP.map(k => ({ representante:'Representante legal', documentoRepresentante:'Documento del representante', domicilio:'Domicilio', correo:'Correo' })[k]));
    if (p.tipo === 'consorcio' || p.tipo === 'union'){
      const suma = (p.integrantes||[]).reduce((t, x) => t + Number(x.porcentaje||0), 0);
      add('Proponente', 'Integrantes del ' + (p.tipo === 'consorcio' ? 'consorcio' : 'unión temporal') + ' que suman 100 %', (p.integrantes||[]).length >= 2 && Math.abs(suma - 100) < 1e-6, '01',
        ['Suman ' + Util.cant(suma) + ' %' + ((p.integrantes||[]).length < 2 ? '; se necesitan al menos dos integrantes' : '')]);
    }
    if (pl.etapa === 'confidencialidad' || (pl.proceso.envios === 'uno')){
      const firmado = adjuntosDe(b, 'ACUERDO').length || (pl.requisitos||[]).some(r => /confidencialidad/i.test(r.nombre) && adjuntosDe(b, r.codigo).length);
      add('Confidencialidad', 'Acuerdo de confidencialidad firmado y adjunto', firmado, pl.etapa === 'confidencialidad' ? '02' : '01');
    }
    if (pl.etapa === 'confidencialidad') return L;
    const k = calculo(b, pl);
    const acts = actividades(pl);
    const sinPrecio = acts.filter(a => !((k.unitario.get(a.clave) || 0) > 0));
    add('Presupuesto', 'Toda actividad con precio (' + (acts.length - sinPrecio.length) + ' de ' + acts.length + ')', !sinPrecio.length, '03', sinPrecio.map(a => a.codigo + ' ' + a.nombre));
    const sinApu = acts.filter(a => a.apuObligatorio && !(act(b, a.clave).apus||[]).some(ap => (ap.insumos||[]).length));
    add('Presupuesto', 'APU en las actividades que el pliego lo exige', !sinApu.length, '03', sinApu.map(a => a.codigo + ' ' + a.nombre));
    const porRevisar = (b.revisar.actividades||[]).filter(c => acts.some(a => a.clave === c));
    if (porRevisar.length) add('Presupuesto', 'Actividades que cambió una adenda, revisadas', false, '03', porRevisar.map(c => (acts.find(a => a.clave === c) || {}).codigo));
    add('AIU', 'Administración, imprevistos y utilidad definidos', Number(b.aiu.a) + Number(b.aiu.i) + Number(b.aiu.u) > 0, '04');
    add('AIU', 'El desglose de la administración cuadra con A', cuadraDesglose(b, k.totales), '04',
      ['Desglose ' + Util.money(totalDesglose(b)) + ' · administración ' + Util.money(k.totales.a)]);
    (pl.requisitos||[]).filter(r => !automatico(r) && r.obligatorio).forEach(r => {
      const f = faltaRequisito(b, r);
      add(r.grupo, r.codigo + ' · ' + r.nombre, !f.length && (b.revisar.requisitos||[]).indexOf(r.codigo) < 0, moduloDe(r),
        f.concat((b.revisar.requisitos||[]).indexOf(r.codigo) >= 0 ? ['Una adenda lo cambió: revíselo y márquelo como revisado'] : []));
    });
    return L;
  }
  function listo(lista){ return lista.length > 0 && lista.every(x => x.ok); }
  /** Avance de diligenciamiento: lo obligatorio que ya está, de 0 a 100. */
  function avance(b, pl){
    const L = revision(b, pl);
    return L.length ? Math.round(L.filter(x => x.ok).length / L.length * 100) : 0;
  }

  /* ── oferta.json (§16) ── */
  function grupoFilas(b, pl, grupos){
    const L = [];
    (pl.requisitos||[]).filter(r => grupos.indexOf(r.grupo) >= 0 && r.tipoRespuesta === 'tabla').forEach(r => filas(b, r).forEach((f, i) => L.push(Object.assign({ requisito:r.codigo, fila:i }, f))));
    return L;
  }
  function oferta(b, pl, rutas){
    const k = calculo(b, pl);
    const p = b.proponente;
    const respuestas = Object.assign({}, b.respuestas, respuestasEconomicas(b, pl, k));
    const prog = (pl.requisitos||[]).find(r => r.grupo === 'Programación' && r.tipoRespuesta === 'tabla');
    const o = { formato:Sobre.FORMATO_OFERTA, version:1, proceso:pl.proceso.codigo, versionPliego:pl.versionPliego, generado:new Date().toISOString(),
      proponente:{ razonSocial:p.razonSocial, nit:p.nit, tipo:p.tipo, representante:p.representante, documentoRepresentante:p.documentoRepresentante,
        domicilio:p.domicilio, direccion:p.direccion, telefono:p.telefono, correo:p.correo, codigoInvitacion:pl.invitado.codigoInvitacion },
      presupuesto:Object.assign(k.po, { desgloseAdministracion:(b.desglose||[]).map(d => ({ concepto:d.concepto, valor:Util.redondear(valorDesglose(d)),
        filas:d.personal ? Util.copia(d.filas||[]) : undefined })), totales:k.totales }),
      personal:grupoFilas(b, pl, ['Personal']), experiencia:grupoFilas(b, pl, ['Experiencia']),
      financiero:b.financiero || null,
      programacion:prog ? { requisito:prog.codigo, filas:filas(b, prog) } : null,
      organigrama:Util.copia(b.organigrama||[]), proveedores:grupoFilas(b, pl, ['Proveedores']),
      sistemasGestion:(pl.requisitos||[]).filter(r => ['Sistemas de gestión','SG-SST','Ambiental'].indexOf(r.grupo) >= 0).map(r => ({ requisito:r.codigo, adjuntos:adjuntosDe(b, r.codigo).length })),
      respuestas,
      adjuntos:(b.adjuntos||[]).map(x => ({ requisito:x.requisito, fila:x.fila === undefined ? null : x.fila, columna:x.columna || null, nombre:x.nombre, ruta:rutas ? rutas.get(x.id) : '',
        sha256:x.sha256, peso:x.peso, fechaDocumento:x.fechaDocumento || '', vigenteHasta:x.vigenteHasta || '' })),
      demo:!!pl.proceso.demo };
    if (p.tipo === 'consorcio' || p.tipo === 'union') o.consorcio = { tipo:p.tipo, integrantes:Util.copia(p.integrantes||[]) };
    return o;
  }

  /* ── Adendas ── */
  /** Aplica una adenda sin perder lo diligenciado: lo que la adenda cambió queda para revisar. */
  function aplicarAdenda(b, plAnterior, adenda){
    const dif = Adendas.diferencias(plAnterior, adenda.pliego);
    const inv = Adendas.invalidaciones(dif);
    const union = (a, c) => Array.from(new Set((a||[]).concat(c)));
    b.revisar.actividades = union(b.revisar.actividades, inv.actividades.concat(inv.actividadesNuevas));
    b.revisar.requisitos = union(b.revisar.requisitos, inv.requisitos);
    dif.actividades.quitadas.forEach(x => { delete b.acts[Sobre.claveActividad(x.cap, x.sub, x.codigo)]; });
    b.pliegoAdenda = adenda.pliego;
    b.versionPliego = adenda.versionNueva;
    b.adendas = (b.adendas||[]).concat([{ numero:adenda.numero, fecha:adenda.fecha, versionNueva:adenda.versionNueva, motivo:adenda.motivo, cambios:adenda.cambios, importada:new Date().toISOString() }]);
    return dif;
  }
  function marcarRevisado(b, tipo, clave){ b.revisar[tipo] = (b.revisar[tipo]||[]).filter(x => x !== clave); }

  /* ── Insumos usados en todos los APU, para cambiar un precio en todos a la vez ── */
  function claveInsumo(i){ return [Util.normaliza(i.descripcion), Util.normaliza(i.unidad), i.categoria].join('|'); }
  function insumosUsados(b){
    const m = new Map();
    Object.values(b.acts).forEach(x => (x.apus||[]).forEach(ap => (ap.insumos||[]).forEach(i => {
      const k = claveInsumo(i);
      const e = m.get(k) || { clave:k, descripcion:i.descripcion, unidad:i.unidad, categoria:i.categoria, precios:new Set(), usos:0 };
      e.precios.add(Number(i.precio||0)); e.usos++; m.set(k, e);
    })));
    return Array.from(m.values()).sort((a, c) => a.descripcion.localeCompare(c.descripcion, 'es'));
  }
  function cambiarPrecioInsumo(b, clave, precio){
    let n = 0;
    Object.values(b.acts).forEach(x => (x.apus||[]).forEach(ap => (ap.insumos||[]).forEach(i => { if (claveInsumo(i) === clave){ i.precio = precio; n++; } })));
    return n;
  }

  return { MODULOS_REQ, GRUPOS_CON_MODULO, DESGLOSE, moduloDe, requisitosDe, automatico, nuevo, actividades, act, unitarioApu, presupuestoOferta, calculo,
    avisosActividad, valorDesglose, totalDesglose, cuadraDesglose, adjuntosDe, filas, faltaRequisito, respuestasEconomicas, revision, listo, avance,
    oferta, aplicarAdenda, marcarRevisado, claveInsumo, insumosUsados, cambiarPrecioInsumo };
})();
