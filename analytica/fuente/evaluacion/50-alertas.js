/* ══════════════════════════════════════════════════════════════════════════
   ALERTAS (§18.11) — cada alerta dice qué encontró, dónde (evidencia: el
   renglón del presupuesto o el documento con su página), por qué importa,
   qué regla la disparó y qué hacer. Ninguna alerta sin evidencia.

   Una alerta tiene una clave estable (tipo, ofertas y objeto): si el análisis
   se vuelve a correr, la misma alerta conserva su estado en la bandeja
   (nueva, en revisión, descartada con motivo, confirmada).

   Posibles acuerdos entre proponentes: el programa no acusa a nadie. Señala
   coincidencias que el comité revisa, y lo recuerda en cada alerta.
   ══════════════════════════════════════════════════════════════════════════ */
const Alertas = (function(){

  const NIVELES = ['crítica','importante','observación'];
  const ESTADOS = ['nueva','en revisión','descartada','confirmada'];
  const RECORDATORIO_COLUSION = 'La colusión en procesos de selección está prohibida (Ley 1340 de 2009 y artículo 410A del Código Penal). Esta alerta señala una coincidencia, no acusa a nadie: la decisión es del comité.';

  /* Por qué importa y qué hacer, por tipo. */
  const TIPOS = {
    'aritmética':['importante','Económico','Los totales declarados no son los que resultan de los precios unitarios y las cantidades del pliego.','Se aplica la regla de corrección del pliego; revise que la diferencia no cambie el orden de elegibilidad.'],
    'sin precio':['crítica','Económico','Una actividad sin precio deja la oferta incompleta frente al formulario de precios.','Verifique ECO-01: el formulario de precios incompleto no es subsanable según el pliego.'],
    'apu no suma':['importante','Económico','El precio unitario declarado no es la suma de sus APU.','Prevalece el precio recalculado; pida aclaración si la diferencia es grande.'],
    'valor bajo':['crítica','Económico','Un precio muy por debajo de las demás ofertas puede no alcanzar para ejecutar la obra.','Pida al proponente que justifique el valor (artículo 2.2.1.1.2.2.4 del Decreto 1082 de 2015, como referencia) y registre la decisión del comité.'],
    'sobre presupuesto':['crítica','Económico','El pliego rechaza las ofertas que superan el presupuesto oficial.','Confirme el valor recalculado; la oferta queda no habilitada.'],
    'desbalance':['importante','Económico','Precios muy por encima o por debajo en actividades de peso permiten cobrar más de lo debido si cambian las cantidades.','Revise las actividades marcadas y considere negociarlas antes de adjudicar.'],
    'cargue al inicio':['importante','Económico','Cobrar caro lo que se ejecuta al principio y barato lo del final adelanta el flujo de caja del contratista a costa del riesgo de la EMPRESA PRINCIPAL.','Compare la programación con los precios y considere ajustar la forma de pago.'],
    'riesgo de cantidades':['importante','Económico','En actividades de cantidad incierta, un precio alto encarece la obra si la cantidad crece; uno bajo anticipa reclamaciones.','Revise el precio frente a la base y decida si se negocia.'],
    'aiu':['importante','Económico','La administración debe alcanzar para el personal, el plazo y los gastos ofrecidos.','Revise el desglose de la A frente al personal y al plazo.'],
    'iva':['importante','Económico','El IVA se calcula sobre una base distinta de la del pliego.','Recalcule el IVA con la base y la tarifa del pliego.'],
    'mano de obra':['importante','Económico','Un jornal por debajo del costo empresa mínimo hace probable el incumplimiento de las obligaciones laborales.','Pida al proponente que aclare el costo de su mano de obra.'],
    'apu':['observación','Económico','El APU se aparta del de la base en un insumo, un rendimiento o un desperdicio.','Revise el APU con el evaluador técnico.'],
    'financiero':['importante','Financiero','Un indicador financiero no alcanza el umbral del pliego.','Verifique las cifras contra los estados financieros adjuntos antes de concluir.'],
    'experiencia':['importante','Experiencia','La experiencia declarada no alcanza lo exigido o tiene inconsistencias.','Verifique cada contrato contra su certificado.'],
    'personal':['importante','Personal','El profesional ofrecido no cumple lo que exige su cargo.','Verifique la hoja de vida, la matrícula y la carta de compromiso.'],
    'programación':['importante','Programación','La programación no es coherente con el plazo, las dependencias o la mano de obra ofrecida.','Revise la programación con el evaluador técnico.'],
    'organigrama':['observación','Organigrama','El organigrama no coincide con el personal ofrecido o con la administración.','Pida aclaración si la diferencia afecta el equipo mínimo.'],
    'documento vencido':['crítica','Jurídico','Un documento vencido a la fecha de cierre no acredita el requisito.','Verifique la fecha; si el requisito es subsanable, pida la subsanación.'],
    'documento vence':['importante','Jurídico','El documento vence antes de la fecha prevista para firmar el contrato.','Exija su renovación antes de la firma.'],
    'documento ilegible':['importante','Otro','El documento no se puede leer (dañado o protegido con contraseña).','Pida el documento legible, si el requisito lo permite.'],
    'sin respuesta':['crítica','Otro','Un requisito obligatorio no tiene respuesta.','Verifique si es subsanable; si no, la oferta no se habilita.'],
    'versión anterior':['importante','Otro','La oferta se preparó sobre una versión anterior del pliego.','El comité decide si la acepta y con qué efectos.'],
    'firma faltante':['importante','Jurídico','El evaluador marcó que el documento no está firmado.','Pida la subsanación de la firma si el pliego lo permite.'],
    'misma persona':['importante','Personal','La misma persona no puede cumplir dos cargos de dedicación completa.','Pida al proponente que aclare la dedicación o reemplace al profesional.'],
    'colusión':['importante','Otro','Coincidencias entre ofertas que, juntas, podrían indicar un acuerdo entre proponentes.','Revise la evidencia con el comité; si se confirma, actúe según el pliego y la ley.']
  };
  function nueva(tipo, x){
    const t = TIPOS[tipo] || ['observación','Otro','',''];
    const a = Object.assign({ tipo, nivel:t[0], grupo:t[1], porque:t[2], accion:t[3], evidencia:[], ofertas:[] }, x);
    if (!a.evidencia.length) throw new Error('Alerta sin evidencia: ' + tipo + ' · ' + a.titulo);
    a.clave = [tipo, a.ofertas.slice().sort().join('+'), a.objeto || ''].join('|');
    return a;
  }
  const renglon = (codigo, pestana) => ({ tipo:'renglon', codigo, pestana:pestana || 'actividades' });
  const requisito = (codigo, modulo) => ({ tipo:'requisito', codigo, modulo:modulo || '13' });
  const documento = (d, pagina) => ({ tipo:'documento', docId:d.id, sha256:d.sha256, nombre:d.nombre, requisito:d.requisito, pagina:pagina || 1 });
  /** Un dato declarado por el proponente en oferta.json (§5.6: el dato del proponente es un origen). */
  const dato = (ofertaId, campo, valor) => ({ tipo:'dato', ofertaId, campo, valor:String(valor === undefined ? '' : valor) });

  /* ── Posibles acuerdos entre proponentes ── */
  function firmaApu(pres, act){
    return Presupuestal.componentes(pres, act).map(y => [Util.normaliza(y.ins.nombre), Util.normaliza(y.ins.unidad), Util.redondearDec(y.cantidad, 4), Util.redondearDec(y.ins.precio, 2)]);
  }
  function casiIguales(a, b){
    if (a.length !== b.length || a.length < 2) return false;
    const mb = new Map(b.map(x => [x[0] + '|' + x[1], x]));
    return a.every(x => { const y = mb.get(x[0] + '|' + x[1]); return y && Math.abs(x[2] - y[2]) <= Math.abs(x[2]) * 0.01 && Math.abs(x[3] - y[3]) <= Math.abs(x[3]) * 0.01; });
  }
  /** APU idénticos o casi idénticos entre dos ofertas (solo APU desglosados). */
  function apusIguales(A, B){
    const ia = Presupuestal.indice(A.pres), ib = Presupuestal.indice(B.pres);
    const iguales = [];
    let comparados = 0;
    ia.acts.forEach((x, k) => {
      const y = ib.acts.get(k);
      if (!y || !Presupuestal.apuDesglosado(A.pres, x.act) || !Presupuestal.apuDesglosado(B.pres, y.act)) return;
      comparados++;
      const fa = firmaApu(A.pres, x.act), fb = firmaApu(B.pres, y.act);
      if (JSON.stringify(fa.slice().sort()) === JSON.stringify(fb.slice().sort())) iguales.push({ codigo:x.codigo, tipo:'idéntico' });
      else if (casiIguales(fa, fb)) iguales.push({ codigo:x.codigo, tipo:'casi idéntico' });
    });
    return { iguales, comparados, alerta:iguales.length >= 3 && iguales.length >= comparados * 0.2 };
  }
  /** Correlación de las desviaciones frente a la base (log del precio de la
      oferta / precio base). Dos ofertas honestas suben y bajan cada una a su
      manera; si una salió de la otra, sus desviaciones se mueven juntas. */
  function correlacion(A, B, base){
    const i0 = Presupuestal.indice(base), ia = Presupuestal.indice(A.pres), ib = Presupuestal.indice(B.pres);
    const xs = [], ys = [], codigos = [];
    i0.acts.forEach((b, k) => { const x = ia.acts.get(k), y = ib.acts.get(k);
      if (b.unitario > 0 && x && y && x.unitario > 0 && y.unitario > 0){ xs.push(Math.log(x.unitario / b.unitario)); ys.push(Math.log(y.unitario / b.unitario)); codigos.push(b.codigo); } });
    const r = xs.length >= 8 ? Estadistica.pearson(xs, ys) : null;
    /* Las actividades que más se apartan de la base, en el mismo sentido en las dos. */
    const muestra = codigos.map((c, i) => ({ c, d:Math.abs(xs[i]) + Math.abs(ys[i]) })).sort((a, b) => b.d - a.d).slice(0, 8).map(x => x.c);
    return { r, n:xs.length, muestra };
  }
  /** Mismos precios unitarios exactos y con un redondeo poco común (no múltiplos de 100). */
  function mismasCifras(A, B){
    const ia = Presupuestal.indice(A.pres), ib = Presupuestal.indice(B.pres);
    const L = [];
    ia.acts.forEach((x, k) => { const y = ib.acts.get(k);
      if (y && x.unitario > 0 && Math.abs(x.unitario - y.unitario) < 0.005 && Math.abs(x.unitario / 100 - Math.round(x.unitario / 100)) > 1e-9) L.push({ codigo:x.codigo, unitario:x.unitario }); });
    return L;
  }
  const AUTORES_GENERICOS = /^(admin|administrador|administrator|usuario|user|owner|propietario|microsoft|hp|dell|lenovo|asus|acer|pc|equipo|windows|desconocido|unknown)$/;
  function autoresDe(o){
    const m = new Map();
    (o.documentos||[]).forEach(d => { const a = Util.normaliza((d.meta||{}).autor); if (a && a.length > 2 && !AUTORES_GENERICOS.test(a)){ const L = m.get(a) || []; L.push(d); m.set(a, L); } });
    return m;
  }
  function telefono(s){ return String(s||'').replace(/\D/g, ''); }

  /** Todas las coincidencias entre cada par de ofertas. */
  function colusion(ofertas, base){
    const L = [];
    for (let i = 0; i < ofertas.length; i++) for (let j = i + 1; j < ofertas.length; j++){
      const A = ofertas[i], B = ofertas[j], ids = [A.id, B.id];
      const par = A.nombre + ' y ' + B.nombre;
      const ap = apusIguales(A, B);
      if (ap.alerta) L.push(nueva('colusión', { ofertas:ids, objeto:'apu', titulo:'APU idénticos o casi idénticos entre ' + par,
        donde:ap.iguales.length + ' de ' + ap.comparados + ' APU comparados: ' + ap.iguales.slice(0, 6).map(x => x.codigo).join(', ') + (ap.iguales.length > 6 ? '…' : ''),
        regla:'Al menos 3 APU desglosados (y el 20 % de los comparados) con los mismos insumos, cantidades y precios (±1 %).',
        evidencia:ap.iguales.slice(0, 12).map(x => renglon(x.codigo, 'apu')), recordatorio:RECORDATORIO_COLUSION }));
      const c = correlacion(A, B, base);
      if (c.r !== null && c.r > 0.98) L.push(nueva('colusión', { ofertas:ids, objeto:'correlación', titulo:'Precios unitarios que se mueven juntos entre ' + par,
        donde:'Correlación de ' + Util.redondearDec(c.r, 4) + ' en ' + c.n + ' actividades, medida sobre la desviación de cada precio frente a la base.',
        regla:'Correlación mayor que 0,98 entre las desviaciones de los precios unitarios de dos ofertas frente a la base (mínimo 8 actividades).',
        evidencia:c.muestra.map(x => renglon(x)), recordatorio:RECORDATORIO_COLUSION }));
      const mc = mismasCifras(A, B);
      if (mc.length >= 3) L.push(nueva('colusión', { ofertas:ids, objeto:'cifras', titulo:'Mismas cifras con el mismo redondeo inusual en ' + par,
        donde:mc.length + ' actividades con el mismo precio unitario exacto: ' + mc.slice(0, 6).map(x => x.codigo + ' (' + Util.money3(x.unitario) + ')').join(', ') + (mc.length > 6 ? '…' : ''),
        regla:'Al menos 3 actividades con el mismo precio unitario, al centavo, que no es múltiplo de 100.', evidencia:mc.slice(0, 12).map(x => renglon(x.codigo)), recordatorio:RECORDATORIO_COLUSION }));
      const aa = autoresDe(A), ab = autoresDe(B);
      aa.forEach((docs, autor) => { if (ab.has(autor)) L.push(nueva('colusión', { ofertas:ids, objeto:'autor ' + autor, titulo:'Mismo autor en los PDF de ' + par,
        donde:'El autor «' + ((docs[0].meta||{}).autor) + '» aparece en ' + docs.length + ' documento(s) de ' + A.nombre + ' y ' + ab.get(autor).length + ' de ' + B.nombre + '.',
        regla:'El mismo autor (metadatos del PDF) en documentos de dos ofertas.', evidencia:[documento(docs[0]), documento(ab.get(autor)[0])], recordatorio:RECORDATORIO_COLUSION })); });
      const pa = A.oferta.proponente || {}, pb = B.oferta.proponente || {};
      const datos = [];
      if (Util.normaliza(pa.direccion).length > 5 && Util.normaliza(pa.direccion) === Util.normaliza(pb.direccion)) datos.push('la dirección (' + pa.direccion + ')');
      if (telefono(pa.telefono).length >= 7 && telefono(pa.telefono) === telefono(pb.telefono)) datos.push('el teléfono (' + pa.telefono + ')');
      if (Util.normaliza(pa.correo).indexOf('@') > 0 && Util.normaliza(pa.correo) === Util.normaliza(pb.correo)) datos.push('el correo (' + pa.correo + ')');
      if (datos.length) L.push(nueva('colusión', { ofertas:ids, objeto:'contacto', titulo:'Mismos datos de contacto en ' + par, donde:'Comparten ' + datos.join(', ') + '.',
        regla:'La misma dirección, teléfono o correo en dos ofertas.', evidencia:[dato(A.id, 'Datos del proponente', datos.join(', ')), dato(B.id, 'Datos del proponente', datos.join(', '))], recordatorio:RECORDATORIO_COLUSION }));
      const pers = mismasPersonas(A, B);
      pers.forEach(x => L.push(nueva('colusión', { ofertas:ids, objeto:'persona ' + x.clave, titulo:'La misma persona ofrecida por ' + par,
        donde:x.nombre + ' (' + x.como + ') aparece como «' + x.cargoA + '» en ' + A.nombre + ' y como «' + x.cargoB + '» en ' + B.nombre + '.',
        regla:'La misma persona, por documento de identidad o por matrícula profesional, en dos ofertas.', evidencia:[requisito(x.requisito, '13')], recordatorio:RECORDATORIO_COLUSION })));
      const contratos = mismosContratos(A, B);
      if (contratos.length) L.push(nueva('experiencia', { nivel:'observación', ofertas:ids, objeto:'contratos', titulo:'El mismo contrato acreditado por ' + par,
        donde:contratos.map(x => x.contratante + ' (' + Util.money(x.valor) + ')').join('; ') + '.', regla:'El mismo contratante, valor y mes de terminación en dos ofertas.',
        porque:'Un contrato solo se puede acreditar por quien lo ejecutó, en su porcentaje de participación.', accion:'Verifique los certificados: pueden ser integrantes de un mismo consorcio.', evidencia:[requisito(contratos[0].requisito, '13')] }));
    }
    return L;
  }
  function personasDe(o){
    const L = [];
    (o.oferta.personal||[]).forEach(f => { const id = Tecnico.idPersona(f); if (id.doc || id.mat) L.push(Object.assign({ id }, f)); });
    return L;
  }
  function mismasPersonas(A, B){
    const pa = personasDe(A), pb = personasDe(B), L = [];
    pa.forEach(x => pb.forEach(y => {
      const porDoc = x.id.doc && x.id.doc === y.id.doc, porMat = x.id.mat && x.id.mat === y.id.mat;
      if (porDoc || porMat) L.push({ clave:porDoc ? 'doc ' + x.id.doc : 'mat ' + x.id.mat, nombre:x.nombre || y.nombre, como:porDoc ? 'mismo documento de identidad' : 'misma matrícula profesional',
        cargoA:x.cargo, cargoB:y.cargo, requisito:x.requisito });
    }));
    return L;
  }
  function mismosContratos(A, B){
    const hb = new Map((B.oferta.experiencia||[]).map(f => [Tecnico.huellaContrato(f), f]));
    return (A.oferta.experiencia||[]).filter(f => f.contratante && hb.has(Tecnico.huellaContrato(f))).map(f => ({ contratante:f.contratante, valor:Number(f.valor||0), requisito:f.requisito }));
  }
  /** La misma persona en dos cargos que juntos pasan del 100 % de dedicación, en una oferta. */
  function dobleCargo(o){
    const m = new Map();
    personasDe(o).forEach(f => { const k = f.id.doc || f.id.mat; const L = m.get(k) || []; L.push(f); m.set(k, L); });
    const R = [];
    m.forEach(L => { const s = L.reduce((t, f) => t + Number(f.dedicacion||0), 0); if (L.length > 1 && s > 100 + 1e-9) R.push({ nombre:L[0].nombre, cargos:L.map(f => f.cargo + ' (' + Number(f.dedicacion||0) + ' %)'), suma:s, requisito:L[0].requisito }); });
    return R;
  }

  /* ── La bandeja ── */
  /** Mezcla las alertas recién calculadas con las guardadas: la misma clave
      conserva su estado; la que ya no aparece queda marcada «ya no se
      presenta», sin borrarse. Devuelve [{ registro, cambio }]. */
  function mezclar(guardadas, nuevas, ahora){
    const porClave = new Map((guardadas||[]).map(g => [g.clave, g]));
    const vistas = new Set();
    const R = [];
    nuevas.forEach(a => {
      vistas.add(a.clave);
      const g = porClave.get(a.clave);
      if (!g) R.push({ cambio:'nueva', registro:{ clave:a.clave, alerta:a, estados:[{ estado:'nueva', fecha:ahora, usuario:'(análisis)', motivo:'' }], vigente:true, creada:ahora, actualizada:ahora } });
      else if (JSON.stringify(g.alerta) !== JSON.stringify(a) || g.vigente === false) R.push({ cambio:'actualizada', registro:Object.assign({}, g, { alerta:a, vigente:true, actualizada:ahora }) });
    });
    (guardadas||[]).forEach(g => { if (!vistas.has(g.clave) && g.vigente !== false) R.push({ cambio:'ya no se presenta', registro:Object.assign({}, g, { vigente:false, actualizada:ahora }) }); });
    return R;
  }
  function estado(registro){ const e = (registro.estados||[]).slice(-1)[0]; return e ? e.estado : 'nueva'; }

  return { NIVELES, ESTADOS, TIPOS, RECORDATORIO_COLUSION, nueva, renglon, requisito, documento, dato, apusIguales, correlacion, mismasCifras, colusion, mismasPersonas, dobleCargo, mezclar, estado };
})();
