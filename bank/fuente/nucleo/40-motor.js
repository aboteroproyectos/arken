/* ══════════════════════════════════════════════════════════════════════════
   MOTOR DE VIABILIDAD — cliente × crédito × banco.
   Con el perfil del cliente (lo que escribió el analista y lo que el lector
   sacó de los documentos y el analista aceptó) y las condiciones del banco,
   calcula la capacidad de pago, el monto máximo, la cuota, y verifica cada
   condición. Cada criterio sale con su valor, su límite y su explicación,
   para que el concepto diga exactamente por qué.

   Dictámenes:
     viable        cumple todo lo que se puede verificar.
     condicionado  cumple lo esencial; quedan observaciones o datos por confirmar.
     ajustado      viable con un monto menor (o más cuota inicial): el monto máximo lo dice.
     no_viable     incumple una condición que no se arregla bajando el monto.
     incompleto    faltan datos para evaluar.
     no_ofrece     el banco no ofrece ese crédito.
   El motor no consulta a nadie ni usa internet: todo sale de los datos guardados.
   ══════════════════════════════════════════════════════════════════════════ */
const Motor = (function(){

  const DICTAMENES = {
    viable:{ n:'Viable', clase:'ok', orden:1 },
    condicionado:{ n:'Viable con condiciones', clase:'brass', orden:2 },
    ajustado:{ n:'Viable con monto ajustado', clase:'warn', orden:3 },
    incompleto:{ n:'Información incompleta', clase:'info', orden:4 },
    no_viable:{ n:'No viable', clase:'bad', orden:5 },
    no_ofrece:{ n:'No ofrece el crédito', clase:'', orden:6 }
  };
  /* Créditos a los que aplica el tope de la Ley 546 (cuota ≤ 30 % del ingreso familiar). */
  const LEY546_CUOTA = ['hipotecario', 'leasing_hab', 'compra_cartera'];
  /* Créditos a los que aplica el tope de financiación de la Ley 546 (70 % / 80 %). */
  const LEY546_FIN = ['hipotecario', 'compra_cartera'];
  /* Gravámenes que impiden constituir la garantía y los que hay que levantar o cancelar. */
  const GRAV_GRAVES = ['Embargo', 'Demanda', 'Medida cautelar', 'Falsa tradición', 'Condición resolutoria'];

  /* ── Matemática financiera ── */
  function tasaMensual(ea){ return Math.pow(1 + (Number(ea) || 0) / 100, 1 / 12) - 1; }
  /** Cuota fija mensual (sistema francés). */
  function cuota(monto, im, n){
    if (!(n > 0)) return 0;
    if (!im) return monto / n;
    return monto * im / (1 - Math.pow(1 + im, -n));
  }
  /** Tabla de amortización en pesos, cuota fija. */
  function amortizacion(monto, ea, meses, seguroPct){
    const im = tasaMensual(ea), c = cuota(monto, im, meses), seg = (Number(seguroPct) || 0) / 100;
    const filas = []; let saldo = monto;
    for (let k = 1; k <= meses; k++){
      const interes = saldo * im, abono = c - interes, seguro = saldo * seg;
      saldo = Math.max(0, saldo - abono);
      filas.push({ n:k, cuota:c + seguro, interes, abono, seguro, saldo });
    }
    return { cuotaFinanciera:c, filas, totalIntereses:filas.reduce((s, f) => s + f.interes, 0) };
  }
  function num(v){ return v === '' || v === null || v === undefined || !isFinite(Number(v)) ? null : Number(v); }
  function aniosEntre(desde, hoy){
    const a = Util.fechaDe(desde), b = Util.fechaDe(hoy); if (!a || !b) return null;
    let n = b.getFullYear() - a.getFullYear();
    if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) n--;
    return n;
  }
  function mesesEntre(desde, hoy){
    const a = Util.fechaDe(desde), b = Util.fechaDe(hoy); if (!a || !b) return null;
    let n = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) n--;
    return n;
  }
  /** Redondea hacia abajo a la centena de mil: así se expresan los montos aprobables. */
  function aCentenaMil(v){ return v > 0 ? Math.floor(v / 100000) * 100000 : 0; }
  const pct = (v, d) => Util.pct(v, d === undefined ? 1 : d);
  const veces = v => (Math.round(v * 100) / 100).toFixed(2) + ' veces';

  /* ── Criterios ── */
  function nuevo(){ return []; }
  /** estado: ok · warn · bad · falta · info. duro: un incumplimiento que no se arregla con menos monto. */
  function crit(L, k, nombre, estado, valor, limite, detalle, duro){ L.push({ k, nombre, estado, valor:valor === undefined ? '' : valor, limite:limite || '', detalle:detalle || '', duro:!!duro }); }

  /** Documentos y coherencia, que el programa calcula aparte (ctx.docs y ctx.alertas). */
  function criteriosDocumentos(L, ctx){
    const d = (ctx && ctx.docs) || null;
    if (d){
      if (d.faltantes.length) crit(L, 'documentos', 'Documentos obligatorios', 'falta', d.cargados + ' de ' + d.requeridos, 'Todos',
        'Faltan: ' + d.faltantes.join('; ') + '.');
      else crit(L, 'documentos', 'Documentos obligatorios', 'ok', d.cargados + ' de ' + d.requeridos, 'Todos', 'Están cargados todos los documentos obligatorios.');
      if (d.vencidos.length) crit(L, 'vigencia', 'Vigencia de los documentos', 'warn', d.vencidos.length + ' vencido(s)', 'Dentro de su vigencia',
        'Hay que actualizar: ' + d.vencidos.join('; ') + '.');
      if (d.sinLeer && d.sinLeer.length) crit(L, 'lectura', 'Lectura de documentos', 'info', d.sinLeer.length + ' sin leer', '', 'No se han leído: ' + d.sinLeer.join('; ') + '.');
    }
    ((ctx && ctx.alertas) || []).forEach((a, i) => crit(L, 'coherencia' + i, a.titulo, a.grave ? 'bad' : 'warn', a.valor || '', a.limite || '', a.detalle, !!a.grave));
  }
  function criterioPuntaje(L, perfil, c){
    const p = num(perfil.puntajeCredito);
    if (perfil.reportesNegativos === true) crit(L, 'reportes', 'Reportes negativos en centrales', 'bad', 'Sí', 'Ninguno', 'El cliente tiene reportes negativos vigentes: los bancos niegan el crédito hasta que se pongan al día y se actualice el reporte.', true);
    else if (perfil.reportesNegativos === false) crit(L, 'reportes', 'Reportes negativos en centrales', 'ok', 'No', 'Ninguno', 'Sin reportes negativos.');
    if (p === null) crit(L, 'puntaje', 'Puntaje en centrales de riesgo', 'falta', '—', '≥ ' + c.puntajeMin, 'Consulte el puntaje del cliente (DataCrédito o TransUnion) para confirmar este criterio.');
    else if (p >= c.puntajeMin) crit(L, 'puntaje', 'Puntaje en centrales de riesgo', 'ok', String(p), '≥ ' + c.puntajeMin, 'Cumple el puntaje mínimo del banco.');
    else if (p >= c.puntajeMin - 30) crit(L, 'puntaje', 'Puntaje en centrales de riesgo', 'warn', String(p), '≥ ' + c.puntajeMin, 'Está a menos de 30 puntos del mínimo: el banco puede aprobar con codeudor o con condiciones especiales.');
    else crit(L, 'puntaje', 'Puntaje en centrales de riesgo', 'bad', String(p), '≥ ' + c.puntajeMin, 'El puntaje está por debajo del mínimo del banco.', true);
  }

  /* ═════ Persona natural (vivienda, consumo y leasing) ═════ */
  function evaluarNatural(cliente, prod, c, P, ctx){
    const pf = cliente.perfil || {}, L = nuevo(), faltan = [], rec = [];
    const hoy = (ctx && ctx.hoy) || Util.hoyISO();
    const ingresoTitular = num(pf.ingresoMensual), variables = num(pf.ingresosVariables) || 0, codeudor = num(pf.ingresoCodeudor) || 0;
    const valor = num(pf.valorInmueble), monto = num(pf.montoSolicitado), plazo = num(pf.plazoAnios);
    const cuotasAct = num(pf.cuotasActuales) || 0;
    if (ingresoTitular === null) faltan.push('Ingreso mensual demostrable');
    if (prod.inmueble && valor === null) faltan.push(prod.id === 'remodelacion' ? 'Valor del inmueble a remodelar' : 'Valor del inmueble');
    if (monto === null) faltan.push('Monto solicitado');
    if (plazo === null) faltan.push('Plazo solicitado');
    const ingresos = (ingresoTitular || 0) + variables + codeudor;

    /* Límites del banco, con los topes de la ley donde aplican. */
    const smmlv = P.smmlv;
    const esVIS = pf.esVIS === true || (pf.esVIS !== false && valor !== null && valor <= P.topeVISsmmlv * smmlv && Catalogo.producto(prod.id).clase === 'vivienda');
    let finMax = Number(esVIS ? c.finVIS : c.finNoVIS);
    if (!isFinite(finMax)) finMax = Number(c.finActivo) || 70;
    if (LEY546_FIN.indexOf(prod.id) >= 0) finMax = Math.min(finMax, esVIS ? P.finVISLey546 : P.finNoVISLey546);
    let cuotaIngMax = Number(c.cuotaIngresoMax) || 40;
    if (LEY546_CUOTA.indexOf(prod.id) >= 0) cuotaIngMax = Math.min(cuotaIngMax, P.cuotaIngresoLey546);
    const endeudMax = Number(c.endeudamientoMax) || 55;
    const plazoMinB = Number(c.plazoMin) || 1, plazoMaxB = Number(c.plazoMax) || 15;
    const edadMax = Number(c.edadMaxFinal) || 75;

    const edad = aniosEntre(pf.fechaNacimiento, hoy);
    let plazoAplicable = plazo === null ? plazoMaxB : Math.min(plazo, plazoMaxB);
    if (edad !== null) plazoAplicable = Math.min(plazoAplicable, edadMax - edad);
    plazoAplicable = Math.max(0, Math.floor(plazoAplicable));

    if (faltan.length) return { faltan, criterios:L, cifras:{ ingresos }, recomendaciones:rec };

    const im = tasaMensual(c.tasaEA), seg = (Number(c.seguroMensualPct) || 0) / 100;
    const nSol = Math.round(Math.min(plazo, plazoMaxB) * 12), nApl = plazoAplicable * 12;
    const cuotaSol = nApl > 0 ? cuota(monto, im, nApl) + monto * seg : Infinity;
    const cuotaMaxNorma = ingresos * cuotaIngMax / 100;
    const cuotaMaxEnd = ingresos * endeudMax / 100 - cuotasAct;
    const cuotaDisp = Math.max(0, Math.min(cuotaMaxNorma, cuotaMaxEnd));
    const fa = nApl > 0 ? cuota(1, im, nApl) : Infinity;
    const montoCap = nApl > 0 ? cuotaDisp / (fa + seg) : 0;
    const montoGar = prod.inmueble ? valor * finMax / 100 : Infinity;
    const montoMax = aCentenaMil(Math.min(montoCap, montoGar));
    const montoAprob = Math.min(monto, montoMax);
    const cuotaAprob = nApl > 0 ? cuota(montoAprob, im, nApl) + montoAprob * seg : 0;

    /* 1. Ingreso mínimo */
    const ingMin = (Number(c.ingresoMinSmmlv) || 0) * smmlv;
    if (ingresos >= ingMin) crit(L, 'ingresoMin', 'Ingreso mínimo', 'ok', Util.money(ingresos), '≥ ' + Util.money(ingMin) + ' (' + c.ingresoMinSmmlv + ' SMMLV)', 'Ingreso familiar considerado: titular ' + Util.money(ingresoTitular) + (variables ? ', variables ' + Util.money(variables) : '') + (codeudor ? ', codeudor ' + Util.money(codeudor) : '') + '.');
    else crit(L, 'ingresoMin', 'Ingreso mínimo', 'bad', Util.money(ingresos), '≥ ' + Util.money(ingMin) + ' (' + c.ingresoMinSmmlv + ' SMMLV)', 'El ingreso familiar no alcanza el mínimo del banco. Un codeudor con ingresos demostrables puede completarlo.', true);
    /* 2-3. Centrales */
    criterioPuntaje(L, pf, c);
    /* 4. Edad y plazo */
    if (edad === null) crit(L, 'edad', 'Edad al terminar el crédito', 'falta', '—', '≤ ' + edadMax + ' años', 'Registre la fecha de nacimiento para verificar la edad máxima al final del plazo.');
    else if (edad + plazo <= edadMax) crit(L, 'edad', 'Edad al terminar el crédito', 'ok', (edad + plazo) + ' años', '≤ ' + edadMax + ' años', 'Hoy tiene ' + edad + ' años; con ' + plazo + ' años de plazo termina a los ' + (edad + plazo) + '.');
    else if (plazoAplicable >= plazoMinB) crit(L, 'edad', 'Edad al terminar el crédito', 'warn', (edad + plazo) + ' años', '≤ ' + edadMax + ' años', 'Con ' + edad + ' años, el plazo máximo posible es de ' + plazoAplicable + ' años; el cálculo usa ese plazo.');
    else crit(L, 'edad', 'Edad al terminar el crédito', 'bad', (edad + plazoMinB) + ' años', '≤ ' + edadMax + ' años', 'Con ' + edad + ' años no alcanza ni el plazo mínimo del banco (' + plazoMinB + ' años).', true);
    /* 5. Antigüedad y estabilidad */
    const meses = mesesEntre(pf.fechaIngreso, hoy);
    const esEmpleado = cliente.tipo === 'asalariado' || cliente.tipo === 'exterior';
    if (cliente.tipo !== 'pensionado'){
      const minMeses = esEmpleado ? Number(c.antiguedadMinMeses) || 6 : Number(c.antiguedadIndepMeses) || 24;
      const que = esEmpleado ? 'Antigüedad laboral' : 'Antigüedad de la actividad';
      if (meses === null) crit(L, 'antiguedad', que, 'falta', '—', '≥ ' + minMeses + ' meses', 'Registre la fecha de ingreso al empleo o de inicio de la actividad.');
      else if (meses >= minMeses) crit(L, 'antiguedad', que, 'ok', meses + ' meses', '≥ ' + minMeses + ' meses', 'Cumple la antigüedad mínima.');
      else crit(L, 'antiguedad', que, 'bad', meses + ' meses', '≥ ' + minMeses + ' meses', 'No cumple la antigüedad mínima del banco; podrá solicitarlo cuando la complete' + (minMeses - meses > 0 ? ' (faltan ' + (minMeses - meses) + ' meses)' : '') + '.', true);
      if (esEmpleado && pf.tipoContrato){
        if (/fijo|obra/i.test(pf.tipoContrato)) crit(L, 'contrato', 'Tipo de contrato', 'warn', pf.tipoContrato, 'Indefinido', 'Con contrato a término fijo u obra labor, los bancos suelen pedir que lleve al menos una renovación o un año de antigüedad.');
        else if (/servicios/i.test(pf.tipoContrato)) crit(L, 'contrato', 'Tipo de contrato', 'warn', pf.tipoContrato, 'Laboral', 'Con prestación de servicios el banco lo analiza como independiente: declaración de renta y extractos de 6 meses.');
        else crit(L, 'contrato', 'Tipo de contrato', 'ok', pf.tipoContrato, 'Indefinido', 'Contrato laboral estable.');
      }
    }
    /* 6. Plazo */
    if (plazo < plazoMinB) crit(L, 'plazo', 'Plazo', 'warn', plazo + ' años', plazoMinB + ' a ' + plazoMaxB + ' años', 'El plazo solicitado es menor que el mínimo del banco.');
    else if (plazo > plazoMaxB) crit(L, 'plazo', 'Plazo', 'warn', plazo + ' años', plazoMinB + ' a ' + plazoMaxB + ' años', 'El banco presta hasta ' + plazoMaxB + ' años para este crédito; el cálculo usa ese plazo.');
    else crit(L, 'plazo', 'Plazo', 'ok', plazo + ' años', plazoMinB + ' a ' + plazoMaxB + ' años', 'Dentro del rango del banco.');
    /* 7. Financiación (garantía) */
    if (prod.inmueble){
      const fin = monto / valor * 100;
      const tope = 'Hasta ' + pct(finMax, 0) + (esVIS ? ' (VIS)' : ' (No VIS)');
      if (fin <= finMax + 1e-9) crit(L, 'financiacion', 'Financiación sobre el valor del inmueble', 'ok', pct(fin), tope, 'Cuota inicial o recursos propios: ' + Util.money(valor - monto) + '.');
      else {
        crit(L, 'financiacion', 'Financiación sobre el valor del inmueble', 'bad', pct(fin), tope, 'El banco financia hasta ' + Util.money(montoGar) + '. El cliente necesita ' + Util.money(valor - montoGar) + ' de cuota inicial (hoy aporta ' + Util.money(valor - monto) + ').');
        rec.push('Aumentar la cuota inicial a ' + Util.money(valor - montoGar) + ' o solicitar ' + Util.money(aCentenaMil(montoGar)) + '.');
      }
    }
    /* 8. Cuota / ingreso */
    const ci = cuotaSol / ingresos * 100;
    const normaTxt = LEY546_CUOTA.indexOf(prod.id) >= 0 ? ' (Ley 546 de 1999 y política del banco)' : ' (política del banco)';
    if (ci <= cuotaIngMax + 1e-9) crit(L, 'cuotaIngreso', 'Primera cuota frente al ingreso', 'ok', pct(ci), '≤ ' + pct(cuotaIngMax, 0) + normaTxt, 'Cuota estimada ' + Util.money(cuotaSol) + ' (incluye seguros) sobre ingresos de ' + Util.money(ingresos) + '.');
    else crit(L, 'cuotaIngreso', 'Primera cuota frente al ingreso', 'bad', pct(ci), '≤ ' + pct(cuotaIngMax, 0) + normaTxt, 'La cuota de ' + Util.money(cuotaSol) + ' supera el ' + pct(cuotaIngMax, 0) + ' del ingreso (' + Util.money(cuotaMaxNorma) + ').');
    /* 9. Endeudamiento total */
    const en = (cuotasAct + cuotaSol) / ingresos * 100;
    if (en <= endeudMax + 1e-9) crit(L, 'endeudamiento', 'Endeudamiento total con la nueva cuota', 'ok', pct(en), '≤ ' + pct(endeudMax, 0), 'Cuotas actuales ' + Util.money(cuotasAct) + ' + nueva cuota ' + Util.money(cuotaSol) + '.');
    else {
      crit(L, 'endeudamiento', 'Endeudamiento total con la nueva cuota', 'bad', pct(en), '≤ ' + pct(endeudMax, 0), 'Las cuotas actuales (' + Util.money(cuotasAct) + ') más la nueva superan el ' + pct(endeudMax, 0) + ' del ingreso.');
      if (cuotasAct > 0) rec.push('Prepagar o recoger deudas actuales libera capacidad: cada ' + Util.money(100000) + ' menos de cuota permite unos ' + Util.money(aCentenaMil(100000 / (fa + seg))) + ' más de crédito.');
    }
    /* 10. Gravámenes del inmueble */
    if (prod.inmueble && pf.gravamenes){
      const g = String(pf.gravamenes);
      const graves = GRAV_GRAVES.filter(x => g.indexOf(x) >= 0);
      if (graves.length) crit(L, 'gravamenes', 'Situación jurídica del inmueble', 'bad', graves.join(', '), 'Libre de gravámenes', 'El certificado de tradición registra ' + graves.join(', ').toLowerCase() + ': no se puede constituir la garantía mientras no se levante.', true);
      else crit(L, 'gravamenes', 'Situación jurídica del inmueble', 'warn', g, 'Libre de gravámenes', 'Hay limitaciones que deben cancelarse o levantarse al escriturar (hipoteca anterior, patrimonio de familia o afectación a vivienda familiar).');
    }
    if (montoMax < monto) rec.push('Monto máximo con la capacidad de pago y la garantía: ' + Util.money(montoMax) + ' a ' + plazoAplicable + ' años.');
    if (codeudor === 0 && montoCap < monto) rec.push('Sumar un codeudor con ingresos demostrables aumenta la capacidad de pago.');
    if (plazoAplicable < plazoMaxB && (edad === null || edad + plazoMaxB <= edadMax) && montoCap < monto) rec.push('Ampliar el plazo hasta ' + plazoMaxB + ' años baja la cuota.');

    return { faltan, criterios:L, recomendaciones:rec,
      cifras:{ ingresos, cuotaSolicitada:cuotaSol, cuotaDisponible:cuotaDisp, cuotaMaxNorma, cuotaMaxEnd, montoCapacidad:montoCap, montoGarantia:montoGar,
        montoMaximo:montoMax, montoAprobable:montoAprob, cuotaAprobable:cuotaAprob, plazoAnios:plazoAplicable, plazoSolicitado:plazo, tasaEA:Number(c.tasaEA),
        finMax, cuotaIngMax, endeudMax, esVIS, edad, antiguedadMeses:meses, cuotaInicial:prod.inmueble ? valor - montoAprob : null,
        seguroPct:Number(c.seguroMensualPct) || 0, mesesSolicitados:nSol } };
  }

  /* ═════ Crédito constructor ═════ */
  function evaluarConstructor(cliente, prod, c, P, ctx){
    const pf = cliente.perfil || {}, L = nuevo(), faltan = [], rec = [];
    const hoy = (ctx && ctx.hoy) || Util.hoyISO();
    const costo = num(pf.costoTotalProyecto), lote = num(pf.valorLote) || 0, ventas = num(pf.valorVentasProyecto);
    const ut = num(pf.unidadesTotales), uv = num(pf.unidadesVendidas), monto = num(pf.montoSolicitado), aporte = num(pf.aportePropio);
    const plazoMeses = num(pf.plazoAnios) === null ? null : Math.round(num(pf.plazoAnios) * 12);
    [['Costo total del proyecto', costo], ['Valor total de ventas', ventas], ['Unidades del proyecto', ut], ['Unidades vendidas', uv], ['Monto solicitado', monto]]
      .forEach(([n, v]) => { if (v === null) faltan.push(n); });
    if (faltan.length) return { faltan, criterios:L, cifras:{}, recomendaciones:rec };

    const im = tasaMensual(c.tasaEA);
    const montoFin = costo * c.finCostoMax / 100, montoCob = ventas / c.coberturaVentasMin;
    const montoMax = aCentenaMil(Math.min(montoFin, montoCob));
    const montoAprob = Math.min(monto, montoMax);
    const meses = Math.min(plazoMeses || c.plazoMaxMeses, c.plazoMaxMeses);
    /* Intereses: el crédito se desembolsa por avance de obra; con un saldo medio del 50 % durante el plazo. */
    const intereses = montoAprob * 0.5 * im * meses;

    /* Preventas */
    const pv = uv / ut * 100, faltanU = Math.max(0, Math.ceil(ut * c.preventasMin / 100) - uv);
    if (pv >= c.preventasMin) crit(L, 'preventas', 'Preventas (punto de equilibrio)', 'ok', pct(pv) + ' (' + uv + ' de ' + ut + ')', '≥ ' + pct(c.preventasMin, 0), 'Alcanzó el punto de equilibrio que exige el banco para desembolsar.');
    else if (pv >= c.preventasMin - 20) { crit(L, 'preventas', 'Preventas (punto de equilibrio)', 'warn', pct(pv) + ' (' + uv + ' de ' + ut + ')', '≥ ' + pct(c.preventasMin, 0), 'El banco puede aprobar, pero no desembolsa hasta el punto de equilibrio: faltan ' + faltanU + ' unidades.'); rec.push('Vender ' + faltanU + ' unidades más para llegar al punto de equilibrio del banco.'); }
    else { crit(L, 'preventas', 'Preventas (punto de equilibrio)', 'bad', pct(pv) + ' (' + uv + ' de ' + ut + ')', '≥ ' + pct(c.preventasMin, 0), 'Las preventas están lejos del punto de equilibrio: faltan ' + faltanU + ' unidades.', true); rec.push('Vender ' + faltanU + ' unidades más antes de radicar.'); }
    /* Financiación del costo */
    const fin = monto / costo * 100;
    if (fin <= c.finCostoMax + 1e-9) crit(L, 'financiacion', 'Financiación del costo del proyecto', 'ok', pct(fin), '≤ ' + pct(c.finCostoMax, 0), 'Monto ' + Util.money(monto) + ' sobre costo ' + Util.money(costo) + '.');
    else { crit(L, 'financiacion', 'Financiación del costo del proyecto', 'bad', pct(fin), '≤ ' + pct(c.finCostoMax, 0), 'El banco financia hasta ' + Util.money(montoFin) + ' del costo.'); }
    /* Cobertura de las ventas */
    const cob = ventas / monto;
    if (cob >= c.coberturaVentasMin) crit(L, 'cobertura', 'Cobertura de las ventas sobre el crédito', 'ok', veces(cob), '≥ ' + veces(c.coberturaVentasMin), 'Las ventas cubren el crédito con holgura.');
    else crit(L, 'cobertura', 'Cobertura de las ventas sobre el crédito', 'bad', veces(cob), '≥ ' + veces(c.coberturaVentasMin), 'Las ventas no cubren el crédito con la holgura que pide el banco.');
    /* Aporte propio */
    const base = costo + lote;
    if (aporte === null) crit(L, 'aporte', 'Aporte propio (lote y recursos)', 'falta', '—', '≥ ' + pct(c.aporteMin, 0), 'Registre el aporte propio: lote más recursos ya invertidos.');
    else {
      const ap = aporte / base * 100;
      if (ap >= c.aporteMin) crit(L, 'aporte', 'Aporte propio (lote y recursos)', 'ok', pct(ap), '≥ ' + pct(c.aporteMin, 0), Util.money(aporte) + ' sobre ' + Util.money(base) + ' (costo más lote).');
      else crit(L, 'aporte', 'Aporte propio (lote y recursos)', 'bad', pct(ap), '≥ ' + pct(c.aporteMin, 0), 'El aporte propio es menor al que exige el banco: faltan ' + Util.money(base * c.aporteMin / 100 - aporte) + '.', true);
      const cierre = base - aporte - montoAprob;
      if (cierre > 0) crit(L, 'cierre', 'Cierre financiero', 'info', Util.money(cierre), 'Cubierto con cuotas iniciales', 'Lo que no cubren el aporte propio ni el crédito debe salir de las cuotas iniciales de los compradores en la fiducia.');
    }
    /* Margen */
    const margen = (ventas - costo - lote) / ventas * 100;
    if (margen >= c.margenMin) crit(L, 'margen', 'Margen del proyecto', 'ok', pct(margen), '≥ ' + pct(c.margenMin, 0), 'Utilidad esperada ' + Util.money(ventas - costo - lote) + '.');
    else if (margen >= c.margenMin / 2) crit(L, 'margen', 'Margen del proyecto', 'warn', pct(margen), '≥ ' + pct(c.margenMin, 0), 'El margen es estrecho: cualquier sobrecosto lo absorbe.');
    else crit(L, 'margen', 'Margen del proyecto', 'bad', pct(margen), '≥ ' + pct(c.margenMin, 0), 'El margen no soporta el riesgo del proyecto.', true);
    /* Licencia, fiducia, experiencia */
    if (pf.licenciaVigente === true) crit(L, 'licencia', 'Licencia de construcción', 'ok', 'Vigente', 'Ejecutoriada y vigente', '');
    else if (pf.licenciaVigente === false) crit(L, 'licencia', 'Licencia de construcción', 'bad', 'No vigente', 'Ejecutoriada y vigente', 'Sin licencia vigente el banco no aprueba el crédito.', true);
    else crit(L, 'licencia', 'Licencia de construcción', 'falta', '—', 'Ejecutoriada y vigente', 'Cargue la licencia o confirme su vigencia.');
    if (pf.fiducia === true) crit(L, 'fiducia', 'Fiducia o encargo fiduciario', 'ok', 'Constituida', 'Constituida', '');
    else crit(L, 'fiducia', 'Fiducia o encargo fiduciario', pf.fiducia === false ? 'warn' : 'falta', pf.fiducia === false ? 'No' : '—', 'Constituida', 'Los bancos exigen que las preventas se recauden en una fiducia.');
    const pt = num(pf.proyectosTerminados);
    if (pt === null) crit(L, 'experiencia', 'Experiencia en proyectos terminados', 'falta', '—', '≥ ' + c.proyectosMin, 'Registre los proyectos terminados.');
    else if (pt >= c.proyectosMin) crit(L, 'experiencia', 'Experiencia en proyectos terminados', 'ok', String(pt), '≥ ' + c.proyectosMin, '');
    else crit(L, 'experiencia', 'Experiencia en proyectos terminados', 'warn', String(pt), '≥ ' + c.proyectosMin, 'Con poca experiencia el banco puede pedir un socio con trayectoria, más aporte o un interventor de su confianza.');
    criteriosEmpresa(L, pf, c, hoy, rec);
    criterioPuntaje(L, pf, c);
    if (plazoMeses !== null && plazoMeses > c.plazoMaxMeses) crit(L, 'plazo', 'Plazo', 'warn', plazoMeses + ' meses', '≤ ' + c.plazoMaxMeses + ' meses', 'El cálculo usa el plazo máximo del banco.');
    if (montoMax < monto) rec.push('Monto máximo con la financiación del costo y la cobertura de ventas: ' + Util.money(montoMax) + '.');
    return { faltan, criterios:L, recomendaciones:rec,
      cifras:{ montoMaximo:montoMax, montoAprobable:montoAprob, tasaEA:Number(c.tasaEA), plazoMeses:meses, interesesEstimados:intereses, cuotaInteresMensual:montoAprob * im,
        preventasPct:pv, margenPct:margen, coberturaVentas:cob, financiacionPct:fin } };
  }

  /** Indicadores de la empresa: antigüedad, liquidez y endeudamiento. */
  function criteriosEmpresa(L, pf, c, hoy, rec){
    const anios = aniosEntre(pf.fechaConstitucion, hoy);
    if (anios === null) crit(L, 'anios', 'Años de constituida', 'falta', '—', '≥ ' + c.aniosMin, 'Registre la fecha de matrícula mercantil (Cámara de Comercio).');
    else if (anios >= c.aniosMin) crit(L, 'anios', 'Años de constituida', 'ok', anios + ' años', '≥ ' + c.aniosMin, '');
    else crit(L, 'anios', 'Años de constituida', 'bad', anios + ' años', '≥ ' + c.aniosMin, 'La empresa no tiene la trayectoria mínima del banco.', true);
    const ac = num(pf.activoCorriente), pc = num(pf.pasivoCorriente), at = num(pf.activoTotal), pt = num(pf.pasivoTotal);
    if (ac !== null && pc){
      const rc = ac / pc;
      crit(L, 'razonCorriente', 'Razón corriente', rc >= c.razonCorrienteMin ? 'ok' : 'warn', veces(rc), '≥ ' + veces(c.razonCorrienteMin), rc >= c.razonCorrienteMin ? '' : 'La liquidez de corto plazo está por debajo de lo que pide el banco.');
    } else crit(L, 'razonCorriente', 'Razón corriente', 'falta', '—', '≥ ' + veces(c.razonCorrienteMin), 'Registre activo y pasivo corriente (estados financieros).');
    if (pt !== null && at){
      const en = pt / at * 100;
      if (en <= c.endeudamientoEmpresaMax) crit(L, 'endeudamientoEmp', 'Endeudamiento de la empresa', 'ok', pct(en), '≤ ' + pct(c.endeudamientoEmpresaMax, 0), '');
      else if (en <= c.endeudamientoEmpresaMax + 10) crit(L, 'endeudamientoEmp', 'Endeudamiento de la empresa', 'warn', pct(en), '≤ ' + pct(c.endeudamientoEmpresaMax, 0), 'Endeudamiento alto: el banco puede pedir capitalización o garantías adicionales.');
      else crit(L, 'endeudamientoEmp', 'Endeudamiento de la empresa', 'bad', pct(en), '≤ ' + pct(c.endeudamientoEmpresaMax, 0), 'El endeudamiento supera ampliamente el límite del banco.', true);
    } else crit(L, 'endeudamientoEmp', 'Endeudamiento de la empresa', 'falta', '—', '≤ ' + pct(c.endeudamientoEmpresaMax, 0), 'Registre activo y pasivo total (estados financieros).');
  }

  /* ═════ Empresa: leasing inmobiliario, capital de trabajo, libre inversión con garantía ═════ */
  function evaluarEmpresa(cliente, prod, c, P, ctx){
    const pf = cliente.perfil || {}, L = nuevo(), faltan = [], rec = [];
    const hoy = (ctx && ctx.hoy) || Util.hoyISO();
    const monto = num(pf.montoSolicitado), plazo = num(pf.plazoAnios), uo = num(pf.utilidadOperacional), gf = num(pf.gastosFinancieros) || 0;
    const valor = num(pf.valorInmueble), ventas = num(pf.ingresosOperacionales), cuotasAct = num(pf.cuotasActuales) || 0;
    if (monto === null) faltan.push('Monto solicitado');
    if (plazo === null) faltan.push('Plazo solicitado');
    if (uo === null) faltan.push('Utilidad operacional');
    if (prod.inmueble && valor === null) faltan.push('Valor del inmueble o activo');
    if (prod.id === 'capital_trabajo' && ventas === null) faltan.push('Ingresos operacionales');
    if (faltan.length) return { faltan, criterios:L, cifras:{}, recomendaciones:rec };

    const plazoMax = Number(c.plazoMax) || 10, n = Math.round(Math.min(plazo, plazoMax) * 12);
    const im = tasaMensual(c.tasaEA), fa = cuota(1, im, n);
    const cuotaMes = cuota(monto, im, n);
    const servicio = (cuotaMes + cuotasAct) * 12;
    const dscr = servicio > 0 ? uo / servicio : Infinity;
    const dscrMin = Number(c.dscrMin) || 1.2;
    const cuotaMaxCap = Math.max(0, (uo / dscrMin) / 12 - cuotasAct);
    const montoCap = cuotaMaxCap / fa;
    const finMax = prod.id === 'libre_garantia' ? Number(c.finNoVIS) || 50 : Number(c.finActivo) || 80;
    const montoGar = prod.inmueble ? valor * finMax / 100 : Infinity;
    const montoVentas = prod.id === 'capital_trabajo' ? ventas * (Number(c.montoMaxPctIngresos) || 25) / 100 : Infinity;
    const montoMax = aCentenaMil(Math.min(montoCap, montoGar, montoVentas));
    const montoAprob = Math.min(monto, montoMax);

    if (dscr >= dscrMin) crit(L, 'dscr', 'Cobertura del servicio de la deuda', 'ok', veces(dscr), '≥ ' + veces(dscrMin), 'La utilidad operacional (' + Util.money(uo) + ') cubre el servicio anual de la deuda (' + Util.money(servicio) + ').');
    else crit(L, 'dscr', 'Cobertura del servicio de la deuda', 'bad', veces(dscr), '≥ ' + veces(dscrMin), 'La utilidad operacional no cubre el servicio de la deuda con la holgura del banco.');
    if (gf > 0){
      const ci = uo / gf;
      crit(L, 'coberturaIntereses', 'Cobertura de intereses', ci >= c.coberturaInteresesMin ? 'ok' : 'warn', veces(ci), '≥ ' + veces(c.coberturaInteresesMin), ci >= c.coberturaInteresesMin ? '' : 'Los intereses actuales consumen buena parte de la utilidad operacional.');
    }
    if (prod.inmueble){
      const fin = monto / valor * 100;
      crit(L, 'financiacion', 'Financiación del activo', fin <= finMax + 1e-9 ? 'ok' : 'bad', pct(fin), '≤ ' + pct(finMax, 0), fin <= finMax + 1e-9 ? '' : 'El banco financia hasta ' + Util.money(montoGar) + '.');
    }
    if (prod.id === 'capital_trabajo') crit(L, 'montoVentas', 'Monto frente a los ingresos', monto <= montoVentas ? 'ok' : 'bad', pct(monto / ventas * 100), '≤ ' + pct(c.montoMaxPctIngresos, 0) + ' de los ingresos', '');
    criteriosEmpresa(L, pf, c, hoy, rec);
    criterioPuntaje(L, pf, c);
    if (plazo > plazoMax) crit(L, 'plazo', 'Plazo', 'warn', plazo + ' años', '≤ ' + plazoMax + ' años', 'El cálculo usa el plazo máximo del banco.');
    if (montoMax < monto) rec.push('Monto máximo con la capacidad de pago de la empresa: ' + Util.money(montoMax) + '.');
    return { faltan, criterios:L, recomendaciones:rec,
      cifras:{ montoMaximo:montoMax, montoAprobable:montoAprob, cuotaSolicitada:cuotaMes, cuotaAprobable:cuota(montoAprob, im, n), tasaEA:Number(c.tasaEA),
        plazoAnios:n / 12, dscr, montoCapacidad:montoCap, montoGarantia:montoGar } };
  }

  /** Dictamen y puntaje a partir de los criterios. */
  function dictaminar(r){
    if (r.faltan.length) return { dictamen:'incompleto', puntaje:0 };
    const C = r.criterios;
    const duros = C.filter(x => x.estado === 'bad' && x.duro), blandos = C.filter(x => x.estado === 'bad' && !x.duro);
    const warns = C.filter(x => x.estado === 'warn').length, faltas = C.filter(x => x.estado === 'falta').length;
    let puntaje = 100 - duros.length * 30 - blandos.length * 15 - warns * 6 - faltas * 4;
    puntaje = Math.max(0, Math.min(100, Math.round(puntaje)));
    let dictamen;
    if (duros.length) dictamen = 'no_viable';
    else if (blandos.length){
      /* Se arregla con menos monto: es viable si el monto máximo es al menos el 30 % de lo pedido. */
      const m = r.cifras.montoMaximo || 0;
      dictamen = m > 0 && m >= 0.3 * (r.montoSolicitado || m) ? 'ajustado' : 'no_viable';
    }
    else if (warns || faltas) dictamen = 'condicionado';
    else dictamen = 'viable';
    return { dictamen, puntaje };
  }

  /**
   * Evalúa un cliente para un crédito en un banco.
   * ctx: { hoy, docs:{requeridos, cargados, faltantes[], vencidos[], sinLeer[]}, alertas:[{titulo, detalle, grave}] }
   */
  function evaluar(cliente, banco, prodId, P, ctx){
    const prod = Catalogo.producto(prodId);
    const base = { bancoId:banco.id, banco:banco.nombre, producto:prodId, productoNombre:prod ? prod.nombre : prodId, fecha:new Date().toISOString(),
      condicionesActualizadas:banco.actualizado || null, referencia:!!banco.referencia };
    if (!prod) return Object.assign(base, { dictamen:'no_ofrece', puntaje:0, criterios:[], cifras:{}, faltan:[], recomendaciones:[] });
    if (prod.clientes.indexOf(cliente.tipo) < 0) return Object.assign(base, { dictamen:'no_ofrece', puntaje:0, criterios:[], cifras:{}, faltan:[], recomendaciones:[], motivo:'Este crédito no aplica a ' + (Catalogo.tipoCliente(cliente.tipo) || {}).nombre + '.' });
    if (!Bancos.ofrece(banco, prodId)) return Object.assign(base, { dictamen:'no_ofrece', puntaje:0, criterios:[], cifras:{}, faltan:[], recomendaciones:[], motivo:banco.nombre + ' no ofrece ' + prod.nombre.toLowerCase() + '.' });
    const c = Bancos.condiciones(banco, prodId);
    let r;
    if (prod.clase === 'constructor') r = evaluarConstructor(cliente, prod, c, P, ctx);
    else if (!Catalogo.esNatural(cliente.tipo)) r = evaluarEmpresa(cliente, prod, c, P, ctx);
    else r = evaluarNatural(cliente, prod, c, P, ctx);
    if (!r.faltan.length) criteriosDocumentos(r.criterios, ctx);
    r.montoSolicitado = num((cliente.perfil || {}).montoSolicitado);
    const d = dictaminar(r);
    return Object.assign(base, r, d, { condiciones:c, notasBanco:c.notas || '' });
  }

  /** Todas las opciones de un cliente: los créditos que aplican a su tipo (o el que pidió) en cada banco. */
  function opciones(cliente, bancos, P, ctx, soloProducto){
    const prods = soloProducto ? [soloProducto] : Catalogo.productosPara(cliente.tipo).map(p => p.id);
    const out = [];
    prods.forEach(p => (bancos || []).filter(b => b.activo !== false).forEach(b => {
      if (!Bancos.ofrece(b, p)) return;
      out.push(evaluar(cliente, b, p, P, ctx));
    }));
    return ordenar(out);
  }
  /** Mejor primero: dictamen, puntaje, el monto aprobable más alto y, a igual monto, la tasa más baja. */
  function ordenar(L){
    const cf = r => r.cifras || {};
    return L.slice().sort((a, b) => (DICTAMENES[a.dictamen].orden - DICTAMENES[b.dictamen].orden) || (b.puntaje - a.puntaje) ||
      ((cf(b).montoAprobable || 0) - (cf(a).montoAprobable || 0)) || ((cf(a).tasaEA || 99) - (cf(b).tasaEA || 99)) || a.banco.localeCompare(b.banco, 'es'));
  }
  function dictamen(id){ return DICTAMENES[id] || { n:id, clase:'' }; }

  return { DICTAMENES, tasaMensual, cuota, amortizacion, aniosEntre, mesesEntre, evaluar, opciones, ordenar, dictamen, aCentenaMil };
})();
