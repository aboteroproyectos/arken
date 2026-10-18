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
    return lista;
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
  return { iniciales, smmlv, enSmmlv };
})();
