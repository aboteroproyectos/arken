/* ══════════════════════════════════════════════════════════════════════════
   BANCOS Y PARÁMETROS — las condiciones con que cada banco presta.
   Cada banco tiene, por tipo de crédito, si lo ofrece y con qué condiciones:
   tasa, porcentaje de financiación, plazo, relación cuota/ingreso,
   endeudamiento, ingreso mínimo, puntaje mínimo, edad, antigüedad y, en el
   crédito constructor y el empresarial, los indicadores que exige.

   IMPORTANTE: las condiciones que trae el programa son de REFERENCIA para
   arrancar. Tasas y políticas cambian cada mes: el administrador las
   actualiza en Bancos › Condiciones con la información vigente de cada banco,
   y la fecha de actualización se imprime en cada concepto.
   ══════════════════════════════════════════════════════════════════════════ */
const Bancos = (function(){

  /* Parámetros generales (Administración › Parámetros). */
  const PARAMETROS = {
    smmlv:1423500, anioSmmlv:2025,
    topeVISsmmlv:150, topeVIPsmmlv:90,
    cuotaIngresoLey546:30, finVISLey546:80, finNoVISLey546:70,
    plazoMinVivienda:5, plazoMaxVivienda:30,
    diasVigenciaPorDefecto:30,
    toleranciaIngresos:10
  };

  /* Condiciones por tipo de crédito: los valores de partida que cada banco ajusta.
     Porcentajes en %; plazos en años salvo plazoMaxMeses. */
  const BASE = {
    hipotecario:   { tasaEA:12.5, finVIS:80, finNoVIS:70, plazoMin:5, plazoMax:30, cuotaIngresoMax:30, endeudamientoMax:50, ingresoMinSmmlv:2, puntajeMin:650, edadMaxFinal:75, antiguedadMinMeses:6, antiguedadIndepMeses:24, seguroMensualPct:0.06 },
    leasing_hab:   { tasaEA:12.9, finVIS:90, finNoVIS:80, plazoMin:5, plazoMax:20, cuotaIngresoMax:30, endeudamientoMax:50, ingresoMinSmmlv:2, puntajeMin:650, edadMaxFinal:75, antiguedadMinMeses:6, antiguedadIndepMeses:24, seguroMensualPct:0.06, opcionCompraPct:10 },
    compra_cartera:{ tasaEA:12.0, finVIS:80, finNoVIS:70, plazoMin:5, plazoMax:20, cuotaIngresoMax:30, endeudamientoMax:50, ingresoMinSmmlv:2, puntajeMin:680, edadMaxFinal:75, antiguedadMinMeses:6, antiguedadIndepMeses:24, seguroMensualPct:0.06 },
    lote:          { tasaEA:15.0, finVIS:60, finNoVIS:60, plazoMin:3, plazoMax:15, cuotaIngresoMax:30, endeudamientoMax:50, ingresoMinSmmlv:3, puntajeMin:700, edadMaxFinal:75, antiguedadMinMeses:12, antiguedadIndepMeses:24, seguroMensualPct:0.05 },
    remodelacion:  { tasaEA:17.0, finVIS:50, finNoVIS:50, plazoMin:1, plazoMax:10, cuotaIngresoMax:35, endeudamientoMax:50, ingresoMinSmmlv:2, puntajeMin:650, edadMaxFinal:75, antiguedadMinMeses:6, antiguedadIndepMeses:24, seguroMensualPct:0.05 },
    libre_garantia:{ tasaEA:16.0, finVIS:50, finNoVIS:50, plazoMin:2, plazoMax:15, cuotaIngresoMax:40, endeudamientoMax:55, ingresoMinSmmlv:3, puntajeMin:680, edadMaxFinal:75, antiguedadMinMeses:12, antiguedadIndepMeses:24, seguroMensualPct:0.06,
                    razonCorrienteMin:1.0, endeudamientoEmpresaMax:70, coberturaInteresesMin:1.5, dscrMin:1.2, aniosMin:2 },
    constructor:   { tasaEA:15.5, finCostoMax:70, preventasMin:60, aporteMin:30, plazoMaxMeses:36, margenMin:15, coberturaVentasMin:1.3, razonCorrienteMin:1.0, endeudamientoEmpresaMax:70, aniosMin:3, proyectosMin:2, puntajeMin:650 },
    leasing_inmob: { tasaEA:14.5, finActivo:80, plazoMin:3, plazoMax:15, razonCorrienteMin:1.0, endeudamientoEmpresaMax:70, coberturaInteresesMin:1.5, dscrMin:1.2, aniosMin:2, puntajeMin:650, opcionCompraPct:10 },
    capital_trabajo:{ tasaEA:16.5, plazoMin:1, plazoMax:5, montoMaxPctIngresos:25, razonCorrienteMin:1.1, endeudamientoEmpresaMax:70, coberturaInteresesMin:1.5, dscrMin:1.2, aniosMin:2, puntajeMin:650 }
  };

  /* Nombre de cada condición, para la pantalla y el concepto. */
  const ETIQUETAS = {
    tasaEA:['Tasa de referencia', '% E.A.'], finVIS:['Financiación máxima VIS', '% del valor'], finNoVIS:['Financiación máxima No VIS', '% del valor'],
    plazoMin:['Plazo mínimo', 'años'], plazoMax:['Plazo máximo', 'años'], cuotaIngresoMax:['Cuota / ingreso máxima', '%'],
    endeudamientoMax:['Endeudamiento total máximo', '% del ingreso'], ingresoMinSmmlv:['Ingreso mínimo', 'SMMLV'], puntajeMin:['Puntaje mínimo en centrales', 'puntos'],
    edadMaxFinal:['Edad máxima al terminar', 'años'], antiguedadMinMeses:['Antigüedad laboral mínima (empleado)', 'meses'],
    antiguedadIndepMeses:['Antigüedad mínima de la actividad (independiente)', 'meses'], seguroMensualPct:['Seguros (vida e incendio)', '% mensual del monto'],
    opcionCompraPct:['Opción de compra', '% del valor'], finCostoMax:['Financiación máxima del costo del proyecto', '%'],
    preventasMin:['Preventas mínimas (punto de equilibrio)', '% de unidades'], aporteMin:['Aporte propio mínimo', '% del costo'],
    plazoMaxMeses:['Plazo máximo', 'meses'], margenMin:['Margen mínimo del proyecto', '% de las ventas'],
    coberturaVentasMin:['Cobertura ventas / crédito mínima', 'veces'], razonCorrienteMin:['Razón corriente mínima', 'veces'],
    endeudamientoEmpresaMax:['Endeudamiento máximo de la empresa', '% pasivo / activo'], aniosMin:['Años mínimos de constitución', 'años'],
    proyectosMin:['Proyectos terminados mínimos', 'proyectos'], finActivo:['Financiación máxima del activo', '%'],
    coberturaInteresesMin:['Cobertura de intereses mínima', 'veces'], dscrMin:['Cobertura del servicio de la deuda mínima', 'veces'],
    montoMaxPctIngresos:['Monto máximo', '% de los ingresos anuales']
  };

  /* Bancos de partida. 'ofrece': los tipos de crédito; 'ajustes': diferencias
     con la base, por tipo de crédito. Son de referencia: ver el aviso de arriba. */
  const BANCOS = [
    { id:'bancolombia', nombre:'Bancolombia', ofrece:['hipotecario','leasing_hab','compra_cartera','lote','remodelacion','libre_garantia','constructor','leasing_inmob','capital_trabajo'],
      ajustes:{ hipotecario:{ tasaEA:12.4 }, leasing_hab:{ tasaEA:12.7 }, constructor:{ preventasMin:60 } } },
    { id:'davivienda', nombre:'Davivienda', ofrece:['hipotecario','leasing_hab','compra_cartera','remodelacion','libre_garantia','constructor','leasing_inmob','capital_trabajo'],
      ajustes:{ hipotecario:{ tasaEA:12.3, puntajeMin:640 }, leasing_hab:{ tasaEA:12.6 }, constructor:{ preventasMin:55, finCostoMax:70 } } },
    { id:'bogota', nombre:'Banco de Bogotá', ofrece:['hipotecario','leasing_hab','compra_cartera','libre_garantia','constructor','leasing_inmob','capital_trabajo'],
      ajustes:{ hipotecario:{ tasaEA:12.6 }, constructor:{ preventasMin:60, aporteMin:30 } } },
    { id:'bbva', nombre:'BBVA Colombia', ofrece:['hipotecario','leasing_hab','compra_cartera','libre_garantia','constructor','leasing_inmob','capital_trabajo'],
      ajustes:{ hipotecario:{ tasaEA:12.5, puntajeMin:680 }, constructor:{ preventasMin:65 } } },
    { id:'cajasocial', nombre:'Banco Caja Social', ofrece:['hipotecario','leasing_hab','compra_cartera','lote','remodelacion','constructor'],
      ajustes:{ hipotecario:{ tasaEA:12.8, ingresoMinSmmlv:1, puntajeMin:620 }, constructor:{ preventasMin:60, finCostoMax:65 } } },
    { id:'fna', nombre:'Fondo Nacional del Ahorro', ofrece:['hipotecario','leasing_hab','compra_cartera','lote','remodelacion'],
      ajustes:{ hipotecario:{ tasaEA:11.5, ingresoMinSmmlv:1, puntajeMin:600, plazoMax:30, notas:'Exige afiliación por cesantías o Ahorro Voluntario Contractual (AVC).' },
        leasing_hab:{ tasaEA:11.8, ingresoMinSmmlv:1, puntajeMin:600 } } },
    { id:'avvillas', nombre:'Banco AV Villas', ofrece:['hipotecario','leasing_hab','compra_cartera','libre_garantia','capital_trabajo'],
      ajustes:{ hipotecario:{ tasaEA:12.7 } } },
    { id:'occidente', nombre:'Banco de Occidente', ofrece:['hipotecario','leasing_hab','compra_cartera','leasing_inmob','capital_trabajo','constructor'],
      ajustes:{ leasing_hab:{ tasaEA:12.8 }, leasing_inmob:{ tasaEA:14.2 } } },
    { id:'colpatria', nombre:'Scotiabank Colpatria', ofrece:['hipotecario','leasing_hab','compra_cartera','libre_garantia','constructor'],
      ajustes:{ hipotecario:{ tasaEA:12.6, puntajeMin:670 } } },
    { id:'itau', nombre:'Itaú', ofrece:['hipotecario','leasing_hab','compra_cartera','leasing_inmob','capital_trabajo'],
      ajustes:{ hipotecario:{ tasaEA:12.9 } } }
  ];

  /** Los bancos de partida, listos para guardar: cada uno con sus condiciones completas. */
  function iniciales(fecha){
    return BANCOS.map((b, i) => ({
      id:'bco_' + b.id, nombre:b.nombre, orden:i + 1, activo:true, contacto:'', notas:'', actualizado:fecha || null, referencia:true,
      productos:Object.keys(BASE).reduce((o, p) => {
        o[p] = Object.assign({ ofrece:b.ofrece.indexOf(p) >= 0, notas:'' }, BASE[p], (b.ajustes || {})[p] || {});
        return o;
      }, {})
    }));
  }
  /** Condiciones de un banco para un crédito, completadas con la base si falta algo. */
  function condiciones(banco, prod){
    const c = (banco && banco.productos && banco.productos[prod]) || {};
    return Object.assign({ ofrece:false }, BASE[prod] || {}, c);
  }
  function ofrece(banco, prod){ return !!(banco && banco.activo !== false && condiciones(banco, prod).ofrece); }
  function camposDe(prod){ return Object.keys(BASE[prod] || {}); }

  return { PARAMETROS, BASE, ETIQUETAS, iniciales, condiciones, ofrece, camposDe };
})();
