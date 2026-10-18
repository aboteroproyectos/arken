/* ══════════════════════════════════════════════════════════════════════════
   CONDICIONES DE LA OFERTA — plantilla base del Anexo B y reglas del módulo 04.
   Cada requisito:
     { id, codigo, grupo, nombre, descripcion, ayuda, activo,
       tipoRespuesta: 'documento' | 'dato' | 'tabla',
       documento: { tipos:[…], pesoMaxMB, varios },  dato: { tipo, opciones[] },
       tabla: { plantilla, columnas:[{ clave, titulo, tipo }] },
       obligatorio, naturaleza: 'habilitante' | 'ponderable' | 'informativo',
       tambienHabilitante (ponderable que además exige un mínimo: «H; P»),
       subsanable, notaSubsanable, puntajeMaximo, reglaPuntaje:{ tipo, … },
       reglasVerificacion:[texto…], evaluador, condicional }
   ══════════════════════════════════════════════════════════════════════════ */
const PlantillaCondiciones = (function(){

  const GRUPOS = ['Jurídico','Financiero','Organizacional','Experiencia','Personal','Equipos','Sistemas de gestión',
    'SG-SST','Ambiental','Programación','Organigrama','Proveedores','Económico','Otro'];
  const NATURALEZAS = ['habilitante','ponderable','informativo'];
  const TIPOS_RESPUESTA = ['documento','dato','tabla'];
  const TIPOS_DATO = ['texto','número','fecha','moneda','porcentaje','sí o no','lista de opciones'];
  const TIPOS_REGLA = {
    proporcional:'Proporcional al mejor', rangos:'Por rangos', sino:'Sí o no', formula:'Por fórmula',
    calificacion:'Calificación del evaluador con criterios escritos', economica:'Método de evaluación económica del pliego'
  };
  const EVALUADORES = ['Evaluador jurídico','Evaluador financiero','Evaluador técnico'];
  const TOTAL_PUNTOS = 1000;

  /* Tablas ya armadas de los grupos estándar (§9). El usuario agrega columnas. */
  const TABLAS = {
    experiencia:[['contratante','Contratante','texto'],['objeto','Objeto del contrato','texto'],['inicio','Fecha de inicio','fecha'],
      ['terminacion','Fecha de terminación','fecha'],['valor','Valor del contrato','moneda'],['participacion','Participación (%)','porcentaje'],
      ['area','Área construida (m²)','número'],['tipologia','Tipología','texto'],['certificado','Certificado','documento']],
    personal:[['cargo','Cargo','texto'],['nombre','Nombre','texto'],['documento','Documento de identidad','texto'],
      ['profesion','Profesión','texto'],['matricula','Matrícula profesional','texto'],['anios','Años de experiencia','número'],
      ['dedicacion','Dedicación (%)','porcentaje'],['hojaVida','Hoja de vida','documento'],['titulo','Título','documento'],
      ['certMatricula','Certificado de vigencia de la matrícula','documento'],['carta','Carta de compromiso','documento']],
    financiero:[['fechaCorte','Fecha de corte','fecha'],['activoCorriente','Activo corriente','moneda'],['pasivoCorriente','Pasivo corriente','moneda'],
      ['activoTotal','Activo total','moneda'],['pasivoTotal','Pasivo total','moneda'],['patrimonio','Patrimonio','moneda'],
      ['utilidadOperacional','Utilidad operacional','moneda'],['gastosIntereses','Gastos de intereses','moneda']],
    equipos:[['equipo','Equipo','texto'],['cantidad','Cantidad','número'],['propiedad','Propio o alquilado','texto'],['soporte','Soporte','documento']],
    proveedores:[['insumo','Insumo','texto'],['proveedor','Proveedor','texto'],['nit','NIT','texto'],['carta','Carta de compromiso','documento']],
    programacion:[['actividad','Actividad (código)','texto'],['inicio','Inicio','fecha'],['fin','Fin','fecha'],
      ['predecesoras','Predecesoras','texto'],['cuadrillas','Cuadrillas','número']]
  };
  function columnas(plantilla){ return (TABLAS[plantilla]||[]).map(([clave, titulo, tipo]) => ({ clave, titulo, tipo })); }

  function evaluadorDe(grupo){
    if (grupo === 'Jurídico') return 'Evaluador jurídico';
    if (grupo === 'Financiero' || grupo === 'Organizacional' || grupo === 'Económico') return 'Evaluador financiero';
    return 'Evaluador técnico';
  }

  /* Constructor corto de cada fila del Anexo B. */
  function r(codigo, grupo, nombre, descripcion, o){
    const x = Object.assign({
      tipoRespuesta:'documento', obligatorio:true, naturaleza:'habilitante', tambienHabilitante:false,
      subsanable:true, notaSubsanable:'', puntajeMaximo:0, reglaPuntaje:null, reglasVerificacion:[], ayuda:'', condicional:''
    }, o||{});
    x.codigo = codigo; x.grupo = grupo; x.nombre = nombre; x.descripcion = descripcion;
    x.evaluador = x.evaluador || evaluadorDe(grupo);
    x.activo = x.activo !== false;
    if (x.tipoRespuesta === 'documento' && !x.documento) x.documento = { tipos:['pdf'], pesoMaxMB:25, varios:false };
    if (x.tipoRespuesta === 'tabla' && x.tabla && x.tabla.plantilla && !x.tabla.columnas) x.tabla.columnas = columnas(x.tabla.plantilla);
    return x;
  }
  const doc = (tipos, pesoMaxMB, varios) => ({ documento:{ tipos:tipos||['pdf'], pesoMaxMB:pesoMaxMB||25, varios:!!varios } });

  function anexoB(){
    const L = [
      /* Jurídico (H) */
      r('JUR-01','Jurídico','Carta de presentación de la oferta','Carta de presentación firmada por el representante legal, según el modelo del pliego.',
        { notaSubsanable:'Subsanable solo en la firma.', reglasVerificacion:['Firmada por el representante legal','Según el modelo del Anexo del pliego'],
          ayuda:'Use el modelo del pliego. La firma del representante legal es obligatoria.' }),
      r('JUR-02','Jurídico','Certificado de existencia y representación legal','Expedido por la Cámara de Comercio máximo 30 días antes del cierre.',
        { reglasVerificacion:['Expedido hace menos de 30 días a la fecha de cierre','Objeto social que permite el contrato',
          'Duración de la sociedad igual al plazo del contrato y un año más','Facultades del representante legal y límites de cuantía'],
          ayuda:'Descárguelo de la Cámara de Comercio. Si las facultades del representante tienen límite de cuantía, adjunte también JUR-03.' }),
      r('JUR-03','Jurídico','Autorización del órgano social','Autorización de la junta o asamblea cuando las facultades del representante legal no alcanzan el valor de la oferta.',
        { obligatorio:false, condicional:'Solo si las facultades del representante no alcanzan.', reglasVerificacion:['Cubre el valor de la oferta','Firmada por presidente y secretario del órgano'] }),
      r('JUR-04','Jurídico','RUT actualizado','Registro Único Tributario actualizado.', { reglasVerificacion:['Expedido o actualizado en el año en curso'] }),
      r('JUR-05','Jurídico','RUP vigente y en firme','Registro Único de Proponentes vigente y en firme, con los códigos UNSPSC exigidos.',
        { obligatorio:false, condicional:'Solo si el pliego lo exige.', reglasVerificacion:['Vigente y en firme a la fecha de cierre','Contiene los códigos UNSPSC exigidos'] }),
      r('JUR-06','Jurídico','Antecedentes disciplinarios, fiscales, judiciales y de medidas correctivas',
        'Certificados de la Procuraduría, la Contraloría, la Policía y el Registro Nacional de Medidas Correctivas, de la empresa y del representante legal.',
        Object.assign(doc(['pdf'], 25, true), { reglasVerificacion:['Consultados máximo 30 días antes del cierre','Sin antecedentes que inhabiliten'],
          ayuda:'Adjunte los cuatro certificados de la empresa y los del representante legal, con la fecha de consulta visible.' })),
      r('JUR-07','Jurídico','Certificación de aportes a seguridad social y parafiscales',
        'Pago de aportes de los últimos 6 meses (artículo 50 de la Ley 789 de 2002), firmada por el revisor fiscal o, si no lo hay, por el representante legal.',
        { reglasVerificacion:['Cubre los 6 meses anteriores al cierre','Firmada por el revisor fiscal con tarjeta profesional y antecedentes vigentes, o por el representante legal'] }),
      r('JUR-08','Jurídico','Garantía de seriedad de la oferta','Póliza o garantía por el 10 % del presupuesto oficial, con vigencia de 90 días desde el cierre.',
        { notaSubsanable:'Subsanable en errores formales, no en su falta.',
          reglasVerificacion:['Valor asegurado mínimo del 10 % del presupuesto oficial','Vigencia mínima de 90 días desde el cierre',
            'Tomador, asegurado y beneficiario correctos','Número del proceso','Firmada, con recibo de pago o certificación de la aseguradora'] }),
      r('JUR-09','Jurídico','Documento de conformación de consorcio o unión temporal',
        'Documento con los integrantes, sus porcentajes, el representante, la responsabilidad solidaria y la duración.',
        { obligatorio:false, condicional:'Solo si la oferta la presenta un consorcio o una unión temporal.',
          reglasVerificacion:['Porcentajes que suman 100 %','Responsabilidad solidaria','Duración igual al plazo del contrato y un año más'] }),
      r('JUR-10','Jurídico','Compromiso anticorrupción y declaración de inhabilidades','Compromiso anticorrupción y declaración de no estar incurso en inhabilidades ni incompatibilidades.',
        { reglasVerificacion:['Firmados por el representante legal'] }),
      r('JUR-11','Jurídico','Declaración de origen de fondos y listas restrictivas','Declaración de origen lícito de fondos y de no estar en listas restrictivas (OFAC, ONU).',
        { reglasVerificacion:['Firmada por el representante legal'] }),
      r('JUR-12','Jurídico','Acuerdo de confidencialidad firmado','El acuerdo de confidencialidad del proceso, firmado.',
        { subsanable:false, reglasVerificacion:['Firmado por quien tiene facultades según el certificado de existencia y representación'] }),

      /* Financiero y organizacional (H) */
      r('FIN-01','Financiero','Estados financieros del último año','Estados financieros con notas, firmados por representante legal, contador y revisor fiscal, y dictamen cuando aplique.',
        Object.assign(doc(['pdf'], 40, true), { reglasVerificacion:['Corte al 31 de diciembre del último año','Firmados por representante, contador y revisor fiscal'] })),
      r('FIN-02','Financiero','Tarjeta profesional y antecedentes del contador y del revisor fiscal','Tarjeta profesional y certificado de antecedentes de la Junta Central de Contadores, vigentes.',
        Object.assign(doc(['pdf'], 25, true), { reglasVerificacion:['Certificado de antecedentes con menos de 3 meses'] })),
      r('FIN-03','Financiero','Índice de liquidez','Activo corriente / pasivo corriente, mayor o igual a 1,5.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'financiero' }, reglasVerificacion:['Liquidez ≥ 1,5'] }),
      r('FIN-04','Financiero','Índice de endeudamiento','Pasivo total / activo total, menor o igual a 0,65.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'financiero' }, reglasVerificacion:['Endeudamiento ≤ 0,65'] }),
      r('FIN-05','Financiero','Razón de cobertura de intereses','Utilidad operacional / gastos de intereses, mayor o igual a 2. Sin gastos de intereses, cumple.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'financiero' }, reglasVerificacion:['Cobertura de intereses ≥ 2'] }),
      r('FIN-06','Financiero','Capital de trabajo','Activo corriente − pasivo corriente, mayor o igual al 20 % del presupuesto oficial.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'financiero' }, reglasVerificacion:['Capital de trabajo ≥ 20 % del presupuesto oficial'] }),
      r('FIN-07','Organizacional','Rentabilidad del patrimonio y del activo','Utilidad operacional / patrimonio ≥ 0,05 y utilidad operacional / activo total ≥ 0,03.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'financiero' }, reglasVerificacion:['Rentabilidad del patrimonio ≥ 0,05','Rentabilidad del activo ≥ 0,03'] }),

      /* Experiencia */
      r('EXP-01','Experiencia','Experiencia general',
        'Hasta 3 contratos terminados en los últimos 10 años cuya suma, en SMMLV, sea al menos 1,5 veces el presupuesto oficial en SMMLV.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'experiencia' },
          reglasVerificacion:['Máximo 3 contratos','Terminados en los últimos 10 años','Suma ≥ 1,5 × presupuesto oficial en SMMLV','Certificado que coincide con lo declarado'],
          ayuda:'Un renglón por contrato, con su certificado. En consorcio se cuenta el valor por su porcentaje de participación.' }),
      r('EXP-02','Experiencia','Experiencia específica en la tipología del proceso','Contratos de la misma tipología del proceso, con área construida mínima.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'experiencia' }, naturaleza:'ponderable', puntajeMaximo:150,
          reglaPuntaje:{ tipo:'proporcional', criterio:'Área construida acreditada en la tipología del proceso' },
          reglasVerificacion:['Tipología similar','Área construida mínima del pliego'] }),

      /* Personal */
      r('PER-01','Personal','Director de obra','Ingeniero civil o arquitecto con 10 años de experiencia general y 3 proyectos similares; dedicación mínima del 50 %.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'personal' }, naturaleza:'ponderable', tambienHabilitante:true, puntajeMaximo:60,
          reglaPuntaje:{ tipo:'rangos', criterio:'Años de experiencia general por encima del mínimo', rangos:[{ desde:0, hasta:2, puntos:20 },{ desde:2, hasta:5, puntos:40 },{ desde:5, hasta:null, puntos:60 }] },
          reglasVerificacion:['Matrícula profesional vigente (COPNIA o CPNAA)','10 años de experiencia general desde la matrícula','3 proyectos similares','Dedicación ≥ 50 %','Carta de compromiso'] }),
      r('PER-02','Personal','Residente de obra','Ingeniero civil o arquitecto con 5 años de experiencia y dedicación del 100 %.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'personal' }, naturaleza:'ponderable', tambienHabilitante:true, puntajeMaximo:40,
          reglaPuntaje:{ tipo:'rangos', criterio:'Años de experiencia por encima del mínimo', rangos:[{ desde:0, hasta:2, puntos:15 },{ desde:2, hasta:5, puntos:30 },{ desde:5, hasta:null, puntos:40 }] },
          reglasVerificacion:['Matrícula profesional vigente','5 años de experiencia','Dedicación del 100 %','Carta de compromiso'] }),
      r('PER-03','Personal','Profesional SST','Profesional en seguridad y salud en el trabajo con licencia vigente y curso de 50 horas del SG-SST.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'personal' }, reglasVerificacion:['Licencia SST vigente','Curso de 50 horas del SG-SST'] }),
      r('PER-04','Personal','Residente administrativo, maestro de obra y demás cargos','Los demás cargos del equipo que el pliego exija.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'personal' }, reglasVerificacion:['Cada cargo exigido con su hoja de vida y carta de compromiso'] }),

      /* Sistemas de gestión y SG-SST */
      r('SG-01','Sistemas de gestión','Certificado ISO 9001','Certificado ISO 9001 vigente, emitido por un organismo acreditado (ONAC u homólogo), con alcance en construcción.',
        { obligatorio:false, naturaleza:'ponderable', puntajeMaximo:40, reglaPuntaje:{ tipo:'sino' },
          reglasVerificacion:['Vigente a la fecha de cierre','Organismo acreditado','Alcance que cubre la construcción'] }),
      r('SG-02','Sistemas de gestión','Certificado ISO 14001','Certificado ISO 14001 vigente, emitido por un organismo acreditado, con alcance en construcción.',
        { obligatorio:false, naturaleza:'ponderable', puntajeMaximo:20, reglaPuntaje:{ tipo:'sino' },
          reglasVerificacion:['Vigente a la fecha de cierre','Organismo acreditado','Alcance que cubre la construcción'] }),
      r('SG-05','Sistemas de gestión','Certificado ISO 45001','Certificado ISO 45001 vigente, emitido por un organismo acreditado, con alcance en construcción.',
        { obligatorio:false, naturaleza:'ponderable', puntajeMaximo:20, reglaPuntaje:{ tipo:'sino' },
          reglasVerificacion:['Vigente a la fecha de cierre','Organismo acreditado','Alcance que cubre la construcción'] }),
      r('SG-03','SG-SST','Autoevaluación de estándares mínimos del SG-SST','Resultado de la autoevaluación (Resolución 0312 de 2019) igual o mayor a 85 %.',
        { reglasVerificacion:['Resultado ≥ 85 %','Firmada por el representante legal y el responsable del SG-SST'] }),
      r('SG-04','Ambiental','Plan de manejo ambiental y de RCD','Plan de manejo ambiental y de residuos de construcción y demolición de la obra.',
        { naturaleza:'ponderable', puntajeMaximo:20, reglaPuntaje:{ tipo:'calificacion', criterios:'Alcance, medidas por actividad, gestor de RCD autorizado y seguimiento' } }),

      /* Técnico */
      r('TEC-01','Programación','Programación de obra','Diagrama de Gantt con dependencias y ruta crítica, dentro del plazo máximo.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'programacion' }, naturaleza:'ponderable', tambienHabilitante:true, puntajeMaximo:60,
          reglaPuntaje:{ tipo:'calificacion', criterios:'Coherencia de duraciones con cantidades, rendimientos y cuadrillas; dependencias lógicas; holguras' },
          reglasVerificacion:['Plazo total ≤ plazo máximo','Toda actividad del presupuesto programada','Dependencias lógicas'] }),
      r('TEC-02','Organigrama','Organigrama de la obra','Organigrama coherente con el personal ofrecido y con la administración del AIU.',
        { reglasVerificacion:['Coincide con el personal ofrecido'] }),
      r('TEC-03','Otro','Metodología y plan de calidad','Metodología constructiva y plan de calidad de la obra.',
        { naturaleza:'ponderable', puntajeMaximo:50, reglaPuntaje:{ tipo:'calificacion', criterios:'Conocimiento de la obra, procesos constructivos, controles de calidad y ensayos' } }),
      r('TEC-04','Equipos','Equipos principales','Equipos principales ofrecidos, propios o alquilados, con soporte.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'equipos' }, reglasVerificacion:['Soporte de propiedad o de alquiler'] }),
      r('TEC-05','Proveedores','Proveedores principales','Proveedores de los insumos de mayor peso, con cartas de compromiso.',
        { tipoRespuesta:'tabla', tabla:{ plantilla:'proveedores' }, naturaleza:'ponderable', puntajeMaximo:40,
          reglaPuntaje:{ tipo:'proporcional', criterio:'Porcentaje del costo directo cubierto con cartas de compromiso' } }),
      r('TEC-06','Otro','Visita de obra','Certificado o acta de asistencia a la visita de obra.',
        { obligatorio:false, condicional:'Solo si el pliego hace obligatoria la visita.', reglasVerificacion:['Aparece en el acta de asistencia'] }),

      /* Económico */
      r('ECO-01','Económico','Formulario de precios completo','Formulario de precios diligenciado, sin modificar cantidades ni descripciones.',
        { tipoRespuesta:'dato', dato:{ tipo:'sí o no' }, subsanable:false, reglasVerificacion:['Toda actividad con precio','Cantidades y descripciones sin cambios'] }),
      r('ECO-02','Económico','APU de las actividades exigidas','Análisis de precios unitarios de las actividades que el pliego exige.',
        { tipoRespuesta:'dato', dato:{ tipo:'sí o no' }, notaSubsanable:'Subsanable en errores aritméticos, no en su falta.',
          reglasVerificacion:['APU en cada actividad exigida','La suma de los APU es el precio unitario'] }),
      r('ECO-03','Económico','AIU con desglose de la administración','A, I y U en porcentaje, con el desglose de la administración que cuadra con A.',
        { tipoRespuesta:'dato', dato:{ tipo:'sí o no' }, reglasVerificacion:['El desglose suma el valor de la administración'] }),
      r('ECO-04','Económico','Oferta económica','Valor total de la oferta, evaluado con el método económico del pliego.',
        { tipoRespuesta:'dato', dato:{ tipo:'moneda' }, naturaleza:'ponderable', puntajeMaximo:500, subsanable:false, reglaPuntaje:{ tipo:'economica' } }),
      r('ECO-05','Económico','Valor no superior al presupuesto oficial','El valor total de la oferta no supera el presupuesto oficial.',
        { tipoRespuesta:'dato', dato:{ tipo:'sí o no' }, subsanable:false, obligatorio:false, condicional:'Solo si el pliego lo exige.',
          reglasVerificacion:['Total de la oferta ≤ presupuesto oficial'] })
    ];
    return L.map((x, i) => Object.assign({ id:'req-' + x.codigo.toLowerCase(), orden:i }, x));
  }

  function puntosPonderables(requisitos){
    return (requisitos||[]).filter(x => x.activo !== false && x.naturaleza === 'ponderable')
      .reduce((t, x) => t + Number(x.puntajeMaximo||0), 0);
  }
  /** Lo que el módulo 04 no deja pasar: puntajes que no suman el total,
      requisito sin evaluador o sin regla, códigos repetidos. */
  function problemas(requisitos, totalProceso){
    const total = totalProceso || TOTAL_PUNTOS;
    const lista = [];
    const activos = (requisitos||[]).filter(x => x.activo !== false);
    const suma = puntosPonderables(activos);
    if (Math.abs(suma - total) > 1e-9) lista.push({ codigo:'', msg:'Los requisitos ponderables suman ' + suma + ' puntos y el proceso reparte ' + total + '.' });
    const vistos = new Map();
    activos.forEach(x => {
      const k = Util.normaliza(x.codigo);
      if (!k) lista.push({ codigo:'', msg:'Hay un requisito sin código («' + (x.nombre||'sin nombre') + '»).' });
      else if (vistos.has(k)) lista.push({ codigo:x.codigo, msg:'El código ' + x.codigo + ' está repetido.' });
      vistos.set(k, true);
      if (!x.evaluador) lista.push({ codigo:x.codigo, msg:x.codigo + ' no tiene evaluador.' });
      if (x.naturaleza === 'ponderable'){
        if (!x.reglaPuntaje || !x.reglaPuntaje.tipo) lista.push({ codigo:x.codigo, msg:x.codigo + ' es ponderable y no tiene regla de puntaje.' });
        if (!(Number(x.puntajeMaximo) > 0)) lista.push({ codigo:x.codigo, msg:x.codigo + ' es ponderable y no tiene puntaje máximo.' });
      }
      if ((x.naturaleza === 'habilitante' || x.tambienHabilitante) && !(x.reglasVerificacion||[]).length)
        lista.push({ codigo:x.codigo, msg:x.codigo + ' es habilitante y no tiene regla de verificación.' });
    });
    return lista;
  }
  return { GRUPOS, NATURALEZAS, TIPOS_RESPUESTA, TIPOS_DATO, TIPOS_REGLA, EVALUADORES, TOTAL_PUNTOS, TABLAS, columnas,
    evaluadorDe, anexoB, puntosPonderables, problemas };
})();
