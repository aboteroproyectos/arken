/* ══════════════════════════════════════════════════════════════════════════
   CATÁLOGO — tipos de cliente, tipos de crédito y documentos.
   Es la base de todo el programa: según el tipo de cliente se ofrecen unos
   créditos, y según el cliente y el crédito se piden unos documentos. Cada
   documento dice qué datos se le leen y cuántos días de vigencia tiene.

   Lo normativo (Colombia) que aplica a vivienda viene de la Ley 546 de 1999
   y sus decretos: plazo entre 5 y 30 años, primera cuota que no supere el 30 %
   de los ingresos familiares y financiación de hasta el 80 % del inmueble en
   vivienda de interés social y del 70 % en las demás. Los bancos pueden pedir
   más; esos límites propios se configuran en Bancos › Condiciones.
   ══════════════════════════════════════════════════════════════════════════ */
const Catalogo = (function(){

  /* ── Tipos de cliente ── */
  const TIPOS_CLIENTE = [
    { id:'asalariado', nombre:'Persona natural asalariada', corto:'Asalariado', persona:'natural',
      desc:'Empleado con contrato laboral (término indefinido, fijo o de obra). Demuestra ingresos con certificado laboral y desprendibles de nómina.' },
    { id:'independiente', nombre:'Persona natural independiente', corto:'Independiente', persona:'natural',
      desc:'Profesional independiente, comerciante o contratista por prestación de servicios. Demuestra ingresos con declaración de renta, extractos y certificación de contador.' },
    { id:'rentista', nombre:'Rentista de capital', corto:'Rentista', persona:'natural',
      desc:'Persona cuyos ingresos vienen de arrendamientos, dividendos o inversiones. Demuestra ingresos con contratos de arrendamiento, certificados y declaración de renta.' },
    { id:'pensionado', nombre:'Persona natural pensionada', corto:'Pensionado', persona:'natural',
      desc:'Recibe mesada pensional. Demuestra ingresos con la resolución de pensión y los desprendibles de pago.' },
    { id:'exterior', nombre:'Colombiano residente en el exterior', corto:'Exterior', persona:'natural',
      desc:'Colombiano que vive fuera del país y compra vivienda en Colombia, por lo general con apoderado en el país.' },
    { id:'empresa', nombre:'Persona jurídica (empresa)', corto:'Empresa', persona:'juridica',
      desc:'Sociedad comercial que necesita financiar inmuebles productivos, maquinaria o capital de trabajo.' },
    { id:'constructora', nombre:'Empresa constructora o promotora', corto:'Constructora', persona:'juridica',
      desc:'Sociedad que desarrolla proyectos inmobiliarios y financia su construcción con crédito constructor contra preventas.' }
  ];
  const NATURALES = ['asalariado', 'independiente', 'rentista', 'pensionado', 'exterior'];

  /* ── Tipos de crédito ──
     clase: 'vivienda' (aplica la Ley 546), 'constructor', 'empresarial' o 'consumo'.
     tasaRef: tasa efectiva anual de referencia para el simulador, si el banco no tiene la suya. */
  const PRODUCTOS = [
    { id:'hipotecario', nombre:'Crédito hipotecario de vivienda', corto:'Hipotecario', clase:'vivienda', inmueble:true,
      clientes:NATURALES,
      desc:'Préstamo para comprar vivienda nueva o usada, garantizado con hipoteca de primer grado sobre el mismo inmueble. Se pacta en pesos o en UVR.',
      claves:['Financiación de hasta el 70 % (No VIS) o el 80 % (VIS) del valor del inmueble.', 'Plazo de 5 a 30 años.', 'La primera cuota no puede superar el 30 % de los ingresos familiares.', 'El cliente es dueño del inmueble desde la escritura.'] },
    { id:'leasing_hab', nombre:'Leasing habitacional', corto:'Leasing habitacional', clase:'vivienda', inmueble:true,
      clientes:NATURALES,
      desc:'El banco compra la vivienda y se la entrega al cliente en arriendo financiero; al final del plazo el cliente ejerce la opción de compra y queda como propietario.',
      claves:['Financiación de hasta el 80 % o 90 % según el banco y el tipo de vivienda.', 'Plazo de 5 a 30 años.', 'Opción de compra al final (suele ser entre el 1 % y el 10 %).', 'Beneficios tributarios por los intereses, según la norma vigente.'] },
    { id:'compra_cartera', nombre:'Compra de cartera hipotecaria', corto:'Compra de cartera', clase:'vivienda', inmueble:true,
      clientes:NATURALES,
      desc:'Traslado de un crédito hipotecario o leasing de otro banco para mejorar tasa, plazo o cuota.',
      claves:['Se financia el saldo de la deuda actual.', 'Exige buen hábito de pago en el crédito que se traslada.', 'Requiere nuevo estudio de títulos y avalúo.'] },
    { id:'lote', nombre:'Crédito para compra de lote', corto:'Compra de lote', clase:'vivienda', inmueble:true,
      clientes:NATURALES,
      desc:'Financiación para comprar un lote urbano o campestre con destino a vivienda. Pocos bancos lo ofrecen y con menor porcentaje de financiación.',
      claves:['Financiación usual del 50 % al 70 % del valor del lote.', 'Plazos más cortos que la vivienda.', 'El lote debe tener matrícula independiente y vías de acceso.'] },
    { id:'remodelacion', nombre:'Crédito para remodelación o mejoras', corto:'Remodelación', clase:'consumo', inmueble:true,
      clientes:NATURALES,
      desc:'Préstamo para remodelar, ampliar o mejorar la vivienda, con o sin garantía hipotecaria.',
      claves:['Monto según el presupuesto de obra y la capacidad de pago.', 'Con hipoteca se consiguen mejores plazos y tasas.'] },
    { id:'libre_garantia', nombre:'Libre inversión con garantía hipotecaria', corto:'Libre inversión hipotecaria', clase:'consumo', inmueble:true,
      clientes:NATURALES.concat(['empresa']),
      desc:'Crédito de libre destino respaldado con un inmueble del cliente libre de deudas.',
      claves:['Financiación usual de hasta el 50 % o 60 % del avalúo.', 'Plazo de hasta 15 años según el banco.', 'El inmueble debe estar libre de gravámenes.'] },
    { id:'constructor', nombre:'Crédito constructor', corto:'Constructor', clase:'constructor', inmueble:false,
      clientes:['constructora'],
      desc:'Financiación de los costos directos de un proyecto de vivienda o comercio, desembolsada por avance de obra y pagada con la subrogación de los créditos de los compradores o con los recursos de las ventas.',
      claves:['Financia por lo general entre el 50 % y el 70 % de los costos directos.', 'Exige punto de equilibrio en preventas (usual: 50 % a 70 % de las unidades).', 'Licencia de construcción vigente y encargo fiduciario o fiducia.', 'Desembolsos contra avance de obra certificado por el interventor del banco.', 'Plazo usual de 24 a 48 meses.'] },
    { id:'leasing_inmob', nombre:'Leasing inmobiliario (comercial)', corto:'Leasing inmobiliario', clase:'empresarial', inmueble:true,
      clientes:['empresa', 'constructora', 'independiente', 'rentista'],
      desc:'El banco adquiere oficinas, bodegas, locales o lotes productivos y se los entrega al cliente en arriendo financiero con opción de compra.',
      claves:['Financiación de hasta el 80 % del activo.', 'Plazo de 5 a 15 años.', 'Se analiza la capacidad de pago de la empresa con sus estados financieros.'] },
    { id:'capital_trabajo', nombre:'Capital de trabajo / tesorería', corto:'Capital de trabajo', clase:'empresarial', inmueble:false,
      clientes:['empresa', 'constructora'],
      desc:'Crédito empresarial de corto o mediano plazo para inventarios, nómina, anticipos a proveedores o el ciclo de caja de un proyecto.',
      claves:['Plazo de 12 a 60 meses.', 'Se mide la cobertura de intereses y el servicio de la deuda.', 'Puede pedir garantía del Fondo Nacional de Garantías o pagaré con aval de los socios.'] }
  ];

  /* ── Documentos ──
     clientes / productos: a quién aplica ('*' = a todos).
     vigencia: días máximos desde la fecha de expedición (0 = no vence).
     lee: los datos que el lector busca en el texto (fuente/nucleo/30-lector.js).
     opcional: el banco lo pide solo en algunos casos (la condición está en «cuando»). */
  const VIV = ['hipotecario', 'leasing_hab', 'compra_cartera', 'lote', 'remodelacion', 'libre_garantia'];
  const EMP = ['leasing_inmob', 'capital_trabajo', 'constructor', 'libre_garantia'];
  const INM = ['hipotecario', 'leasing_hab', 'compra_cartera', 'lote', 'libre_garantia', 'leasing_inmob'];
  const DOCUMENTOS = [
    /* Identificación y solicitud */
    { id:'solicitud', grupo:'Solicitud', nombre:'Formulario de solicitud de crédito del banco', clientes:['*'], productos:['*'], vigencia:0,
      lee:['nombre_titular', 'numero_documento', 'monto_solicitado'], desc:'Diligenciado y firmado por el solicitante (y por los codeudores).' },
    { id:'cedula', grupo:'Identificación', nombre:'Cédula de ciudadanía (ampliada al 150 %)', clientes:NATURALES, productos:['*'], vigencia:0,
      lee:['nombre_titular', 'numero_documento', 'fecha_nacimiento'], desc:'Por las dos caras, legible. En el exterior, también el pasaporte.' },
    { id:'autorizacion_centrales', grupo:'Solicitud', nombre:'Autorización de consulta en centrales de riesgo', clientes:['*'], productos:['*'], vigencia:0,
      lee:[], desc:'Autoriza al banco a consultar DataCrédito y TransUnion (Ley 1266 de 2008).' },
    { id:'reporte_centrales', grupo:'Solicitud', nombre:'Reporte de centrales de riesgo (DataCrédito / TransUnion)', clientes:['*'], productos:['*'], vigencia:30, opcional:true,
      cuando:'Recomendado para anticipar el análisis del banco.', lee:['puntaje_credito', 'reportes_negativos', 'fecha_expedicion'], desc:'Puntaje y hábito de pago del cliente.' },

    /* Ingresos: asalariado */
    { id:'cert_laboral', grupo:'Ingresos', nombre:'Certificado laboral', clientes:['asalariado'], productos:['*'], vigencia:30,
      lee:['nombre_titular', 'numero_documento', 'salario', 'cargo', 'fecha_ingreso', 'tipo_contrato', 'nit', 'fecha_expedicion'],
      desc:'Con cargo, salario, fecha de ingreso y tipo de contrato, expedido hace menos de 30 días.' },
    { id:'desprendibles', grupo:'Ingresos', nombre:'Desprendibles de nómina de los últimos 3 meses', clientes:['asalariado'], productos:['*'], vigencia:90,
      lee:['salario', 'total_devengado', 'total_deducciones', 'neto_pagado', 'fecha_expedicion'], desc:'Si hay ingresos variables (comisiones, horas extra), los de 6 meses.' },
    { id:'cert_ingresos_ret', grupo:'Ingresos', nombre:'Certificado de ingresos y retenciones (formulario 220)', clientes:['asalariado', 'pensionado'], productos:['*'], vigencia:0, opcional:true,
      cuando:'Cuando el cliente no está obligado a declarar renta.', lee:['ingresos_brutos_anuales', 'anio_gravable', 'nit'], desc:'Del último año gravable.' },

    /* Ingresos: independiente y rentista */
    { id:'rut', grupo:'Ingresos', nombre:'RUT actualizado', clientes:['independiente', 'rentista', 'empresa', 'constructora'], productos:['*'], vigencia:0,
      lee:['nit', 'nombre_titular', 'actividad_economica', 'fecha_expedicion'], desc:'Registro Único Tributario con la actividad económica vigente.' },
    { id:'declaracion_renta', grupo:'Ingresos', nombre:'Declaración de renta de los 2 últimos años', clientes:['independiente', 'rentista', 'asalariado', 'pensionado', 'exterior'], productos:['*'], vigencia:0,
      opcional:true, obligatorioPara:['independiente', 'rentista'], cuando:'Obligatoria para independientes y rentistas; para asalariados y pensionados, si son declarantes.',
      lee:['anio_gravable', 'patrimonio_bruto', 'deudas', 'patrimonio_liquido', 'ingresos_brutos_anuales', 'renta_liquida'], desc:'Formulario 210, con sello o número de formulario de la DIAN.' },
    { id:'cert_contador', grupo:'Ingresos', nombre:'Certificación de ingresos firmada por contador público', clientes:['independiente', 'rentista'], productos:['*'], vigencia:30,
      lee:['ingreso_mensual_certificado', 'nombre_titular', 'tarjeta_profesional', 'fecha_expedicion'], desc:'Con el promedio de ingresos mensuales, firmada por contador con tarjeta profesional vigente.' },
    { id:'tp_contador', grupo:'Ingresos', nombre:'Tarjeta profesional y antecedentes del contador (JCC)', clientes:['independiente', 'rentista'], productos:['*'], vigencia:90,
      lee:['tarjeta_profesional', 'fecha_expedicion'], desc:'Certificado de antecedentes de la Junta Central de Contadores, vigente.' },
    { id:'extractos', grupo:'Ingresos', nombre:'Extractos bancarios de los últimos 3 a 6 meses', clientes:['*'], productos:['*'], vigencia:60,
      lee:['saldo_anterior', 'total_abonos', 'total_cargos', 'saldo_final', 'saldo_promedio', 'fecha_expedicion'], desc:'De las cuentas donde recibe los ingresos. Independientes y empresas: 6 meses.' },
    { id:'contratos_servicios', grupo:'Ingresos', nombre:'Contratos de prestación de servicios vigentes', clientes:['independiente'], productos:['*'], vigencia:0, opcional:true,
      cuando:'Si sus ingresos vienen de contratos.', lee:['valor_contrato', 'fecha_inicio', 'fecha_terminacion', 'nit'], desc:'Con su valor, plazo y contratante.' },
    { id:'contratos_arriendo', grupo:'Ingresos', nombre:'Contratos de arrendamiento y certificados de tradición de los inmuebles arrendados', clientes:['rentista'], productos:['*'], vigencia:0,
      lee:['canon_mensual', 'fecha_inicio'], desc:'Demuestran el ingreso por rentas.' },
    { id:'camara_natural', grupo:'Ingresos', nombre:'Certificado de Cámara de Comercio (si es comerciante)', clientes:['independiente'], productos:['*'], vigencia:30, opcional:true,
      cuando:'Si el independiente tiene establecimiento de comercio.', lee:['razon_social', 'nit', 'fecha_matricula', 'fecha_expedicion'], desc:'Expedido hace menos de 30 días.' },

    /* Ingresos: pensionado */
    { id:'resolucion_pension', grupo:'Ingresos', nombre:'Resolución de pensión', clientes:['pensionado'], productos:['*'], vigencia:0,
      lee:['mesada_pensional', 'nombre_titular', 'fecha_expedicion'], desc:'Acto que reconoce la pensión.' },
    { id:'desprendibles_pension', grupo:'Ingresos', nombre:'Desprendibles de pago de la mesada (últimos 3 meses)', clientes:['pensionado'], productos:['*'], vigencia:90,
      lee:['mesada_pensional', 'total_deducciones', 'neto_pagado', 'fecha_expedicion'], desc:'Del fondo o de Colpensiones.' },

    /* Colombiano en el exterior */
    { id:'pasaporte', grupo:'Identificación', nombre:'Pasaporte y documento de residencia en el exterior', clientes:['exterior'], productos:['*'], vigencia:0,
      lee:['nombre_titular', 'numero_documento'], desc:'Permiso de residencia, visa o tarjeta de residente vigente.' },
    { id:'ingresos_exterior', grupo:'Ingresos', nombre:'Certificado laboral o de ingresos en el exterior, con traducción', clientes:['exterior'], productos:['*'], vigencia:30,
      lee:['salario', 'cargo', 'fecha_ingreso', 'fecha_expedicion'], desc:'Con salario, cargo y antigüedad; traducción oficial si no está en español.' },
    { id:'poder', grupo:'Identificación', nombre:'Poder especial autenticado o apostillado al apoderado en Colombia', clientes:['exterior'], productos:['*'], vigencia:0,
      lee:['nombre_titular'], desc:'Para firmar la escritura y el pagaré en Colombia.' },

    /* Empresa y constructora */
    { id:'camara_comercio', grupo:'Empresa', nombre:'Certificado de existencia y representación legal (Cámara de Comercio)', clientes:['empresa', 'constructora'], productos:['*'], vigencia:30,
      lee:['razon_social', 'nit', 'fecha_matricula', 'representante_legal', 'fecha_expedicion'], desc:'Expedido hace menos de 30 días; muestra las facultades del representante legal.' },
    { id:'cedula_rl', grupo:'Empresa', nombre:'Cédula del representante legal', clientes:['empresa', 'constructora'], productos:['*'], vigencia:0,
      lee:['nombre_titular', 'numero_documento'], desc:'Ampliada al 150 %.' },
    { id:'composicion_accionaria', grupo:'Empresa', nombre:'Composición accionaria certificada (beneficiarios finales)', clientes:['empresa', 'constructora'], productos:['*'], vigencia:90,
      lee:['fecha_expedicion'], desc:'Firmada por el revisor fiscal o el contador; socios con más del 5 %.' },
    { id:'estados_financieros', grupo:'Financieros', nombre:'Estados financieros de los 2 últimos cierres, con notas', clientes:['empresa', 'constructora'], productos:['*'], vigencia:0,
      lee:['activo_corriente', 'pasivo_corriente', 'activo_total', 'pasivo_total', 'patrimonio', 'ingresos_operacionales', 'utilidad_operacional', 'utilidad_neta', 'gastos_financieros'],
      desc:'Estado de situación financiera y de resultados, certificados o dictaminados, con notas.' },
    { id:'ef_corte', grupo:'Financieros', nombre:'Estados financieros de corte reciente (no mayor a 6 meses)', clientes:['empresa', 'constructora'], productos:['*'], vigencia:180,
      lee:['activo_corriente', 'pasivo_corriente', 'activo_total', 'pasivo_total', 'patrimonio', 'ingresos_operacionales', 'utilidad_neta', 'fecha_expedicion'], desc:'Firmados por el contador y el representante legal.' },
    { id:'renta_empresa', grupo:'Financieros', nombre:'Declaración de renta de la empresa de los 2 últimos años', clientes:['empresa', 'constructora'], productos:['*'], vigencia:0,
      lee:['anio_gravable', 'patrimonio_bruto', 'patrimonio_liquido', 'ingresos_brutos_anuales', 'renta_liquida'], desc:'Formulario 110.' },
    { id:'relacion_deudas', grupo:'Financieros', nombre:'Relación de obligaciones financieras vigentes', clientes:['empresa', 'constructora', 'independiente'], productos:['*'], vigencia:30,
      lee:['saldo_deudas', 'cuotas_mensuales'], desc:'Entidad, saldo, cuota, plazo y garantía de cada obligación.' },

    /* Proyecto (crédito constructor) */
    { id:'licencia_construccion', grupo:'Proyecto', nombre:'Licencia de construcción ejecutoriada y vigente', clientes:['constructora'], productos:['constructor'], vigencia:0,
      lee:['numero_licencia', 'fecha_ejecutoria', 'vigencia_hasta', 'area_construida', 'unidades_totales'], desc:'Con planos aprobados y resolución de la curaduría.' },
    { id:'presupuesto_obra', grupo:'Proyecto', nombre:'Presupuesto de obra y programación', clientes:['constructora'], productos:['constructor'], vigencia:0,
      lee:['costo_total_proyecto', 'costo_directo'], desc:'Costos directos e indirectos, con su programación de obra. Puede salir de ARKEN CONTROL.' },
    { id:'flujo_caja', grupo:'Proyecto', nombre:'Flujo de caja del proyecto', clientes:['constructora'], productos:['constructor'], vigencia:0,
      lee:['valor_ventas_proyecto', 'costo_total_proyecto'], desc:'Ingresos por ventas, desembolsos del crédito y egresos mes a mes.' },
    { id:'cuadro_ventas', grupo:'Proyecto', nombre:'Cuadro de ventas y certificado de preventas de la fiduciaria', clientes:['constructora'], productos:['constructor'], vigencia:30,
      lee:['unidades_totales', 'unidades_vendidas', 'valor_ventas_proyecto', 'fecha_expedicion'], desc:'Unidades del proyecto, unidades vendidas y valor de la venta, certificado por la fiduciaria.' },
    { id:'contrato_fiducia', grupo:'Proyecto', nombre:'Contrato de fiducia o encargo fiduciario de preventas', clientes:['constructora'], productos:['constructor'], vigencia:0,
      lee:['nit', 'fecha_inicio'], desc:'Donde se recaudan las cuotas iniciales de los compradores.' },
    { id:'tradicion_lote', grupo:'Proyecto', nombre:'Certificado de tradición del lote y estudio de títulos', clientes:['constructora'], productos:['constructor'], vigencia:30,
      lee:['matricula_inmobiliaria', 'gravamenes', 'fecha_expedicion'], desc:'El lote debe estar a nombre de la constructora o de la fiducia, libre de gravámenes distintos de la hipoteca al banco.' },
    { id:'experiencia', grupo:'Proyecto', nombre:'Certificación de experiencia en proyectos terminados', clientes:['constructora'], productos:['constructor'], vigencia:0,
      lee:['proyectos_terminados', 'area_construida'], desc:'Proyectos entregados en los últimos años, con unidades y área.' },
    { id:'estudio_mercado', grupo:'Proyecto', nombre:'Estudio de mercado o de factibilidad', clientes:['constructora'], productos:['constructor'], vigencia:0, opcional:true,
      cuando:'Lo piden algunos bancos en proyectos de más de 100 unidades o en zonas nuevas.', lee:[], desc:'Demanda, precios de la zona y velocidad de ventas.' },

    /* Inmueble (créditos con garantía o leasing) */
    { id:'promesa', grupo:'Inmueble', nombre:'Promesa de compraventa', clientes:['*'], productos:['hipotecario', 'leasing_hab', 'lote', 'leasing_inmob'], vigencia:0,
      lee:['valor_inmueble', 'matricula_inmobiliaria', 'nombre_titular'], desc:'Firmada por comprador y vendedor, con el precio y la forma de pago.' },
    { id:'tradicion', grupo:'Inmueble', nombre:'Certificado de tradición y libertad del inmueble', clientes:['*'], productos:INM, vigencia:30,
      lee:['matricula_inmobiliaria', 'gravamenes', 'fecha_expedicion'], desc:'Expedido hace menos de 30 días. El lector busca hipotecas, embargos, patrimonio de familia, afectación a vivienda familiar y demandas.' },
    { id:'avaluo', grupo:'Inmueble', nombre:'Avalúo comercial del inmueble', clientes:['*'], productos:INM, vigencia:365, opcional:true,
      cuando:'Por lo general lo contrata el banco después de la preaprobación.', lee:['valor_avaluo', 'area_construida', 'fecha_expedicion'], desc:'Hecho por un avaluador inscrito en el RAA.' },
    { id:'predial', grupo:'Inmueble', nombre:'Impuesto predial y paz y salvo de administración', clientes:['*'], productos:INM, vigencia:0,
      lee:['avaluo_catastral'], desc:'Del año en curso.' },
    { id:'credito_actual', grupo:'Inmueble', nombre:'Certificación de deuda del crédito a trasladar', clientes:NATURALES, productos:['compra_cartera'], vigencia:30,
      lee:['saldo_deudas', 'cuotas_mensuales', 'fecha_expedicion'], desc:'Saldo, cuota y comportamiento de pago, expedida por el banco actual.' },
    { id:'presupuesto_remodelacion', grupo:'Inmueble', nombre:'Presupuesto de la remodelación', clientes:NATURALES, productos:['remodelacion'], vigencia:0,
      lee:['costo_total_proyecto'], desc:'Firmado por el contratista o profesional responsable.' }
  ];

  /* ── Campos del perfil del cliente ──
     Lo que el analista escribe o el lector llena. grupo: dónde se muestra.
     para: 'natural', 'juridica', 'constructor' o '*'. tipo: dinero, numero, porcentaje, fecha, texto, si/no, opciones. */
  const CAMPOS = [
    /* Ingresos y deudas (persona natural) */
    { k:'ingresoMensual', lab:'Ingreso mensual demostrable', tipo:'dinero', grupo:'Ingresos y deudas', para:'natural', ayuda:'Salario, mesada, promedio de honorarios o rentas, según el tipo de cliente.' },
    { k:'ingresosVariables', lab:'Ingresos variables mensuales (promedio)', tipo:'dinero', grupo:'Ingresos y deudas', para:'natural', ayuda:'Comisiones, horas extra o bonificaciones que se repiten.' },
    { k:'ingresoCodeudor', lab:'Ingreso del codeudor o cónyuge', tipo:'dinero', grupo:'Ingresos y deudas', para:'natural', ayuda:'Se suma para la capacidad de pago (ingreso familiar).' },
    { k:'cuotasActuales', lab:'Cuotas de deudas actuales (mensual)', tipo:'dinero', grupo:'Ingresos y deudas', para:'*', ayuda:'Suma de las cuotas de créditos, tarjetas y leasing vigentes.' },
    { k:'saldoDeudas', lab:'Saldo total de deudas', tipo:'dinero', grupo:'Ingresos y deudas', para:'*' },
    { k:'puntajeCredito', lab:'Puntaje en centrales de riesgo', tipo:'numero', grupo:'Ingresos y deudas', para:'*', ayuda:'De 150 a 950 (DataCrédito).' },
    { k:'reportesNegativos', lab:'Reportes negativos vigentes', tipo:'si/no', grupo:'Ingresos y deudas', para:'*' },
    { k:'patrimonioLiquido', lab:'Patrimonio líquido (declaración de renta)', tipo:'dinero', grupo:'Ingresos y deudas', para:'natural' },
    /* Perfil laboral */
    { k:'fechaNacimiento', lab:'Fecha de nacimiento', tipo:'fecha', grupo:'Perfil', para:'natural' },
    { k:'fechaIngreso', lab:'Fecha de ingreso al empleo o inicio de la actividad', tipo:'fecha', grupo:'Perfil', para:'natural' },
    { k:'tipoContrato', lab:'Tipo de contrato', tipo:'opciones', grupo:'Perfil', para:'natural',
      opts:['', 'Término indefinido', 'Término fijo', 'Obra o labor', 'Prestación de servicios', 'No aplica'] },
    { k:'cargo', lab:'Cargo u ocupación', tipo:'texto', grupo:'Perfil', para:'natural' },
    { k:'empleador', lab:'Empleador o actividad', tipo:'texto', grupo:'Perfil', para:'natural' },
    /* Empresa */
    { k:'fechaConstitucion', lab:'Fecha de constitución (matrícula mercantil)', tipo:'fecha', grupo:'Empresa', para:'juridica' },
    { k:'ingresosOperacionales', lab:'Ingresos operacionales del último año', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    { k:'utilidadOperacional', lab:'Utilidad operacional del último año', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    { k:'utilidadNeta', lab:'Utilidad neta del último año', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    { k:'gastosFinancieros', lab:'Gastos financieros (intereses) del año', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    { k:'activoCorriente', lab:'Activo corriente', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    { k:'pasivoCorriente', lab:'Pasivo corriente', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    { k:'activoTotal', lab:'Activo total', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    { k:'pasivoTotal', lab:'Pasivo total', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    { k:'patrimonio', lab:'Patrimonio', tipo:'dinero', grupo:'Empresa', para:'juridica' },
    /* Proyecto (constructor) */
    { k:'nombreProyecto', lab:'Nombre del proyecto', tipo:'texto', grupo:'Proyecto', para:'constructor' },
    { k:'costoTotalProyecto', lab:'Costo total del proyecto', tipo:'dinero', grupo:'Proyecto', para:'constructor', ayuda:'Costos directos más indirectos, sin el lote.' },
    { k:'valorLote', lab:'Valor del lote', tipo:'dinero', grupo:'Proyecto', para:'constructor' },
    { k:'valorVentasProyecto', lab:'Valor total de ventas del proyecto', tipo:'dinero', grupo:'Proyecto', para:'constructor' },
    { k:'unidadesTotales', lab:'Unidades del proyecto', tipo:'numero', grupo:'Proyecto', para:'constructor' },
    { k:'unidadesVendidas', lab:'Unidades vendidas (preventas)', tipo:'numero', grupo:'Proyecto', para:'constructor' },
    { k:'aportePropio', lab:'Aporte propio (lote + recursos invertidos)', tipo:'dinero', grupo:'Proyecto', para:'constructor' },
    { k:'licenciaVigente', lab:'Licencia de construcción ejecutoriada y vigente', tipo:'si/no', grupo:'Proyecto', para:'constructor' },
    { k:'fiducia', lab:'Encargo fiduciario o fiducia constituida', tipo:'si/no', grupo:'Proyecto', para:'constructor' },
    { k:'proyectosTerminados', lab:'Proyectos terminados (experiencia)', tipo:'numero', grupo:'Proyecto', para:'constructor' },
    /* La operación que pide el cliente */
    { k:'producto', lab:'Crédito que solicita', tipo:'producto', grupo:'Operación', para:'*' },
    { k:'valorInmueble', lab:'Valor del inmueble (o del activo)', tipo:'dinero', grupo:'Operación', para:'*', ayuda:'Precio de la promesa o avalúo. Si es VIS se marca abajo.' },
    { k:'montoSolicitado', lab:'Monto solicitado', tipo:'dinero', grupo:'Operación', para:'*' },
    { k:'plazoAnios', lab:'Plazo solicitado (años)', tipo:'numero', grupo:'Operación', para:'*' },
    { k:'esVIS', lab:'Vivienda de interés social (VIS)', tipo:'si/no', grupo:'Operación', para:'natural' },
    { k:'gravamenes', lab:'Gravámenes o limitaciones del inmueble', tipo:'texto', grupo:'Operación', para:'*', ayuda:'Lo llena el lector con el certificado de tradición.' }
  ];

  function tipoCliente(id){ return TIPOS_CLIENTE.find(t => t.id === id) || null; }
  function producto(id){ return PRODUCTOS.find(p => p.id === id) || null; }
  function documento(id){ return DOCUMENTOS.find(d => d.id === id) || null; }
  function esNatural(tipo){ return NATURALES.indexOf(tipo) >= 0; }
  function productosPara(tipo){ return PRODUCTOS.filter(p => p.clientes.indexOf(tipo) >= 0); }
  function aplica(lista, x){ return lista.indexOf('*') >= 0 || lista.indexOf(x) >= 0; }

  /** Documentos que pide el crédito para ese cliente: [{ doc, obligatorio }]. */
  function documentosRequeridos(tipo, prod){
    return DOCUMENTOS.filter(d => aplica(d.clientes, tipo) && (!prod || aplica(d.productos, prod)))
      .map(d => ({ doc:d, obligatorio:!d.opcional || (d.obligatorioPara || []).indexOf(tipo) >= 0 }));
  }
  /** Los campos del perfil que se muestran para ese cliente. */
  function camposPara(tipo){
    const nat = esNatural(tipo);
    return CAMPOS.filter(c => c.para === '*' || (c.para === 'natural' && nat) || (c.para === 'juridica' && !nat) || (c.para === 'constructor' && tipo === 'constructora'));
  }
  function campo(k){ return CAMPOS.find(c => c.k === k) || null; }

  return { TIPOS_CLIENTE, NATURALES, PRODUCTOS, DOCUMENTOS, CAMPOS, tipoCliente, producto, documento, esNatural, productosPara,
    documentosRequeridos, camposPara, campo };
})();
