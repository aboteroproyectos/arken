/* ══════════════════════════════════════════════════════════════════════════
   PARÁMETROS POR VIGENCIA (§7, Anexo C). Valores de partida; el usuario los
   edita en Configuración › Parámetros y cada cambio queda en la auditoría.
   Cada valor dice su norma, su fuente y quién lo verificó.
   ══════════════════════════════════════════════════════════════════════════ */
const Parametros = (function(){

  const FUENTE_SMMLV = 'Decreto anual del Gobierno Nacional que fija el salario mínimo';
  /* 2010 a 2026: los valores del prompt maestro (Anexo C). 2026, Decreto 1469
     de 2025, verificado el 2 de octubre de 2026 al construir ARKEN PRECIOS.
     2000 a 2009 se agregan para la experiencia más antigua y quedan marcados
     «por verificar» hasta que alguien los confronte con su decreto. */
  const SMMLV = [
    [2000, 260100, ''], [2001, 286000, ''], [2002, 309000, ''], [2003, 332000, ''], [2004, 358000, ''],
    [2005, 381500, ''], [2006, 408000, ''], [2007, 433700, ''], [2008, 461500, ''], [2009, 496900, ''],
    [2010, 515000, 'prompt'], [2011, 535600, 'prompt'], [2012, 566700, 'prompt'], [2013, 589500, 'prompt'],
    [2014, 616000, 'prompt'], [2015, 644350, 'prompt'], [2016, 689455, 'prompt'], [2017, 737717, 'prompt'],
    [2018, 781242, 'prompt'], [2019, 828116, 'prompt'], [2020, 877803, 'prompt'], [2021, 908526, 'prompt'],
    [2022, 1000000, 'prompt'], [2023, 1160000, 'prompt'], [2024, 1300000, 'prompt'], [2025, 1423500, 'prompt'],
    [2026, 1750905, 'prompt']
  ];

  function iniciales(){
    const lista = SMMLV.map(([anio, valor, origen]) => ({
      id:'smmlv-' + anio, clave:'smmlv', anio, valor,
      vigenteDesde:anio + '-01-01',
      norma: anio === 2026 ? 'Decreto 1469 de 2025' : 'Decreto de salario mínimo ' + anio,
      fuente:FUENTE_SMMLV,
      verificadoPor: origen === 'prompt' ? 'Prompt maestro de ARKEN ANALYTICA (Anexo C)' : '',
      porVerificar: origen !== 'prompt'
    }));
    lista.push({ id:'iva-general', clave:'iva', valor:19, vigenteDesde:'2017-01-01', norma:'Estatuto Tributario, artículo 468 (Ley 1819 de 2016)',
      fuente:'Tarifa general del IVA', verificadoPor:'', porVerificar:false });
    return lista.concat(laborales());
  }

  /* Costo empresa mínimo de la mano de obra (§18.4), con los parámetros de
     ARKEN PRECIOS verificados el 2 de octubre de 2026. Para el salario mínimo:
     auxilio de transporte, prestaciones sobre salario más auxilio, vacaciones y
     aportes sobre el salario, ARL clase V (construcción), y salud, ICBF y SENA
     exonerados (artículo 114-1 del Estatuto Tributario, salarios menores de
     10 SMMLV). Sin dotación, elementos de protección ni FIC: es un piso. */
  const LABORALES = [
    ['auxilioTransporte', 200000, '2025-01-01', 'Decreto 1573 de 2024', 'Para quienes devengan hasta 2 SMMLV.'],
    ['auxilioTransporte', 249095, '2026-01-01', 'Decreto 1470 de 2025', 'Para quienes devengan hasta 2 SMMLV.'],
    ['divisorMensual', 230, '2024-07-15', 'Ley 2101 de 2021', 'Horas al mes para el valor de la hora (jornada de 46 horas).'],
    ['divisorMensual', 220, '2025-07-15', 'Ley 2101 de 2021', 'Horas al mes para el valor de la hora (jornada de 44 horas).'],
    ['divisorMensual', 210, '2026-07-15', 'Ley 2101 de 2021', 'Horas al mes para el valor de la hora (jornada de 42 horas).'],
    ['horasJornal', 7, '2000-01-01', '', 'Horas por jornal: 7 horas × 6 días.'],
    ['cesantias', 8.33, '2000-01-01', 'Código Sustantivo del Trabajo, artículo 249', 'Porcentaje sobre salario más auxilio de transporte.'],
    ['interesesCesantias', 1, '2000-01-01', 'Ley 52 de 1975', '12 % anual sobre las cesantías.'],
    ['prima', 8.33, '2000-01-01', 'Código Sustantivo del Trabajo, artículo 306', 'Porcentaje sobre salario más auxilio de transporte.'],
    ['vacaciones', 4.17, '2000-01-01', 'Código Sustantivo del Trabajo, artículo 186', 'Porcentaje sobre el salario.'],
    ['pension', 12, '2000-01-01', 'Ley 100 de 1993, artículo 20', 'A cargo del empleador.'],
    ['arl', 6.96, '2000-01-01', 'Decreto 1772 de 1994', 'Clase de riesgo V, la de la construcción.'],
    ['caja', 4, '2000-01-01', 'Ley 21 de 1982', 'Caja de compensación familiar.']
  ];
  function laborales(){
    return LABORALES.map(([clave, valor, desde, norma, nota]) => ({ id:'lab-' + clave + '-' + desde, clave, valor, vigenteDesde:desde, norma, fuente:nota,
      verificadoPor:'Parámetros de ARKEN PRECIOS, verificados el 2 de octubre de 2026', porVerificar:false }));
  }
  /** El valor vigente de un parámetro en una fecha: el de vigenteDesde más reciente que no pase de la fecha. */
  function vigente(lista, clave, fecha){
    const f = String(fecha || Util.hoyISO()).slice(0, 10);
    const c = (lista||[]).filter(p => p.clave === clave && String(p.vigenteDesde||'') <= f).sort((a, b) => a.vigenteDesde < b.vigenteDesde ? 1 : -1);
    return c.length ? Number(c[0].valor) : null;
  }
  /** Costo empresa mínimo de un trabajador con el salario mínimo, en una fecha:
      { mensual, hora, jornal, divisor, horasJornal, smmlv } o null si falta un parámetro. */
  function costoEmpresaMinimo(lista, fecha){
    const f = String(fecha || Util.hoyISO()).slice(0, 10);
    const s = smmlv(lista, Number(f.slice(0, 4)));
    const v = k => vigente(lista, k, f);
    const aux = v('auxilioTransporte'), div = v('divisorMensual'), horas = v('horasJornal') || 7;
    if (!s || aux === null || !div) return null;
    const base = s + aux;
    const mensual = s + aux + base * (v('cesantias') + v('interesesCesantias') + v('prima')) / 100 + s * (v('vacaciones') + v('pension') + v('arl') + v('caja')) / 100;
    const hora = mensual / div;
    return { mensual, hora, jornal:hora * horas, divisor:div, horasJornal:horas, smmlv:s, fecha:f };
  }

  /** SMMLV del año, o null si la tabla no lo tiene. */
  function smmlv(lista, anio){
    const f = (lista||[]).find(p => p.clave === 'smmlv' && Number(p.anio) === Number(anio));
    return f ? Number(f.valor) : null;
  }
  /** Experiencia en SMMLV (Anexo C): valor / SMMLV del año de terminación ×
      porcentaje de participación. */
  function enSmmlv(lista, valor, anioTerminacion, participacionPct){
    const s = smmlv(lista, anioTerminacion);
    if (!s) return null;
    const part = participacionPct === undefined || participacionPct === null || participacionPct === '' ? 100 : Number(participacionPct);
    return Number(valor||0) / s * part / 100;
  }
  return { iniciales, laborales, smmlv, enSmmlv, vigente, costoEmpresaMinimo };
})();
