/* ─────────────── LECTOR DE DOCUMENTOS DE CRÉDITO, sin internet ───────────────
   Lee el texto de los documentos que sube el cliente (el texto lo saca pdf.js
   de los PDF, o el reconocimiento de texto de las imágenes y los escaneados) y
   busca los datos que el análisis necesita: salario, fecha de ingreso, tipo de
   contrato, saldos de extractos, patrimonio y renta de la declaración,
   indicadores de los estados financieros, gravámenes del certificado de
   tradición, preventas, costo del proyecto, fechas de expedición…

   Es el mismo método del lector de ARKEN ANALYTICA: en cada página busca las
   etiquetas usuales del dato («salario básico», «total patrimonio bruto»,
   «saldo anterior»…), sin importar mayúsculas ni tildes, y toma el primer valor
   del tipo esperado que viene después, en la misma línea o en la siguiente.
   Cada dato sale con el fragmento literal del documento y su página: todo lo
   que propone está en el documento, y el analista lo confirma antes de usarlo.

   También reconoce de qué documento se trata (clasificar) y propone en qué
   campo del perfil del cliente va cada dato (MAPA). No decide la viabilidad:
   eso lo hace el motor (40-motor.js) con los datos que el analista aceptó.
   ──────────────────────────────────────────────────────────────────────────── */
const Lector = (function(){
  const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
  const NUM_MES = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, setiembre:9, octubre:10, noviembre:11, diciembre:12 };
  const MAX_POR_CAMPO = 3;

  const TIPOS = {
    fecha:new RegExp('\\b\\d{1,2}\\s*(?:de\\s+)?(?:' + MESES + ')\\s*(?:de|del)?\\s*(?:\\d{4})\\b|\\b(?:' + MESES + ')\\s+\\d{1,2}\\s*(?:de|,)?\\s*\\d{4}\\b|\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b|\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}\\b', 'gi'),
    dinero:/(?:\$|COP\b)\s*\(?-?\d[\d.,\s]*\d\)?|\(?-?\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?\)?/gi,
    porcentaje:/-?\d{1,3}(?:[.,]\d{1,4})?\s*%/g,
    area:/\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?\s*(?:m2|m²|mts2|mt2|metros\s+cuadrados)/gi,
    nit:/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}(?:\s*-\s*\d)?\b/g,
    cedula:/\b\d{1,3}(?:[.\s]\d{3}){1,3}\b|\b\d{6,10}\b/g,
    numero:/\b\d{1,3}(?:[.,]\d{3})+\b|\b\d{1,6}\b/g,
    anio:/\b(?:19|20)\d{2}\b/g,
    matricula:/[A-Z0-9]*\d[A-Z0-9]*(?:[-\s][A-Z0-9]*\d[A-Z0-9]*){0,3}/g,
    matinm:/\b\d{2,3}\s*[-–]\s*\d{2,8}\b/g,
    nombre:/[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ&'.-]*(?:\s+(?:(?:de|del|la|las|los|y|e)\s+)?[A-ZÁÉÍÓÚÜÑ&][A-Za-zÁÉÍÓÚÜÑáéíóúüñ&'.-]*){1,7}/g
  };

  /* Los datos que se buscan. Etiquetas en minúsculas y sin tildes; la primera es la más precisa.
     tipo 'linea': el resto de la línea. tipo 'clave': se busca en todo el documento una de las
     palabras de «claves» y se devuelve su valor. tipo 'gravamen': cada mención de la lista. */
  const CAMPOS = [
    { k:'nombre_titular', nombre:'Nombre del titular', tipo:'nombre', etiquetas:['nombres? y apellidos', 'nombre del (?:titular|solicitante|empleado|trabajador|cliente|afiliado|pensionado|deudor|comprador|arrendatario)', 'certifica(?:mos)? que(?: el| la)?(?: senor(?:a)?| sr\\.?| sra\\.?)?', 'senor(?:a)?', 'nombre'] },
    { k:'numero_documento', nombre:'Número de documento de identidad', tipo:'cedula', etiquetas:['identificad[oa] con (?:la )?(?:cedula de ciudadania|c\\.? ?c\\.?)(?: no\\.?| numero| n°| nro\\.?)?', 'cedula de ciudadania(?: no\\.?| numero| n°| nro\\.?)?', 'numero de (?:documento|identificacion|cedula)', 'documento de identidad(?: no\\.?)?', 'c\\.? ?c\\.?(?: no\\.?| n°| nro\\.?)?'] },
    { k:'fecha_nacimiento', nombre:'Fecha de nacimiento', tipo:'fecha', etiquetas:['fecha de nacimiento', 'nacid[oa] (?:el|en)'] },
    { k:'monto_solicitado', nombre:'Monto solicitado', tipo:'dinero', etiquetas:['monto solicitado', 'valor solicitado', 'valor del (?:credito|prestamo|leasing)', 'monto del (?:credito|prestamo)'] },
    { k:'puntaje_credito', nombre:'Puntaje en centrales de riesgo', tipo:'numero', etiquetas:['puntaje(?: de credito| acierta| datacredito)?', 'score(?: de credito)?', 'acierta(?: a| \\+)?'] },
    { k:'reportes_negativos', nombre:'Reportes negativos', tipo:'clave', claves:[['cartera castigada', 'Sí: cartera castigada'], ['dudoso recaudo', 'Sí: dudoso recaudo'], ['en mora', 'Sí: obligación en mora'], ['mora (?:de |mayor a )?\\d+', 'Sí: obligación en mora'], ['reporte negativo', 'Sí: reporte negativo']] },
    { k:'salario', nombre:'Salario mensual', tipo:'dinero', etiquetas:['salario (?:basico |integral )?(?:mensual)?(?: de)?', 'asignacion (?:basica )?(?:mensual)?(?: de)?', 'devengando(?: un salario)?(?: (?:basico )?mensual)?(?: de)?', 'devenga(?: un salario)?(?: (?:basico )?mensual)?(?: de)?', 'sueldo(?: basico)?(?: mensual)?', 'ingreso (?:basico )?mensual'] },
    { k:'cargo', nombre:'Cargo', tipo:'linea', etiquetas:['cargo(?: actual)?(?: de)?', 'desempen(?:a|ando|ado)(?: el cargo de| como)', 'ocupa(?:ndo)? el cargo de'] },
    { k:'fecha_ingreso', nombre:'Fecha de ingreso al empleo', tipo:'fecha', etiquetas:['fecha de ingreso', 'labora(?: en| con| para)? (?:esta|nuestra|la) (?:empresa|compania|entidad|organizacion|institucion) desde(?: el)?', 'vinculad[oa] (?:a (?:esta|nuestra|la) (?:empresa|compania|entidad) )?(?:desde|a partir)(?: del?)?(?: el)?', 'desde(?: el)?'] },
    { k:'tipo_contrato', nombre:'Tipo de contrato', tipo:'clave', claves:[['termino indefinido', 'Término indefinido'], ['contrato indefinido', 'Término indefinido'], ['termino fijo', 'Término fijo'], ['obra o labor', 'Obra o labor'], ['obra labor', 'Obra o labor'], ['prestacion de servicios', 'Prestación de servicios']] },
    { k:'nit', nombre:'NIT', tipo:'nit', etiquetas:['nit', 'numero de identificacion tributaria'] },
    { k:'fecha_expedicion', nombre:'Fecha de expedición', tipo:'fecha', etiquetas:['fecha (?:de )?expedicion', 'fecha de (?:emision|generacion|elaboracion|impresion|corte|consulta)', 'se expide[^\\n]{0,90}?(?: el| a los| en)', 'expedid[oa](?: el| en)?', 'fecha'] },
    { k:'total_devengado', nombre:'Total devengado', tipo:'dinero', etiquetas:['total devengado', 'total devengos', 'total ingresos', 'devengado'] },
    { k:'total_deducciones', nombre:'Total deducciones', tipo:'dinero', etiquetas:['total deducciones', 'total descuentos', 'deducciones', 'descuentos'] },
    { k:'neto_pagado', nombre:'Neto pagado', tipo:'dinero', etiquetas:['neto (?:a )?pagar', 'neto pagado', 'total neto', 'valor neto', 'neto'] },
    { k:'ingresos_brutos_anuales', nombre:'Ingresos brutos del año', tipo:'dinero', etiquetas:['total ingresos brutos', 'ingresos brutos(?: totales)?', 'total (?:de )?ingresos recibidos', 'total ingresos'] },
    { k:'anio_gravable', nombre:'Año gravable', tipo:'anio', etiquetas:['ano gravable', 'periodo gravable', 'ano'] },
    { k:'patrimonio_bruto', nombre:'Patrimonio bruto', tipo:'dinero', etiquetas:['total patrimonio bruto', 'patrimonio bruto'] },
    { k:'deudas', nombre:'Deudas (declaración de renta)', tipo:'dinero', etiquetas:['total deudas', 'deudas'] },
    { k:'patrimonio_liquido', nombre:'Patrimonio líquido', tipo:'dinero', etiquetas:['total patrimonio liquido', 'patrimonio liquido'] },
    { k:'renta_liquida', nombre:'Renta líquida', tipo:'dinero', etiquetas:['renta liquida gravable', 'renta liquida(?: ordinaria)?'] },
    { k:'ingreso_mensual_certificado', nombre:'Ingreso mensual certificado', tipo:'dinero', etiquetas:['ingresos? (?:mensual(?:es)? )?promedio(?: mensual)?(?: de| por)?(?: valor de)?', 'percibe (?:unos )?ingresos (?:mensuales )?(?:promedio )?(?:por (?:un )?valor )?(?:de)?', 'ingresos? mensual(?:es)?(?: de| por)?(?: valor de)?', 'promedio mensual'] },
    { k:'tarjeta_profesional', nombre:'Tarjeta profesional', tipo:'matricula', etiquetas:['tarjeta profesional(?: no\\.?| numero| n°| nro\\.?)?', 't\\.? ?p\\.?(?: no\\.?| n°)?'] },
    { k:'actividad_economica', nombre:'Actividad económica', tipo:'linea', etiquetas:['actividad (?:economica )?principal', 'actividad economica', 'codigo ciiu'] },
    { k:'saldo_anterior', nombre:'Saldo anterior', tipo:'dinero', etiquetas:['saldo anterior', 'saldo inicial'] },
    { k:'total_abonos', nombre:'Total abonos del periodo', tipo:'dinero', etiquetas:['total (?:abonos|creditos|depositos|consignaciones)', '(?:mas )?(?:abonos|creditos|depositos|consignaciones)(?: del mes| del periodo)?'] },
    { k:'total_cargos', nombre:'Total cargos del periodo', tipo:'dinero', etiquetas:['total (?:cargos|debitos|retiros)', '(?:menos )?(?:cargos|debitos|retiros)(?: del mes| del periodo)?'] },
    { k:'saldo_final', nombre:'Saldo final', tipo:'dinero', etiquetas:['saldo (?:final|actual|a la fecha|total)', 'nuevo saldo', 'saldo disponible'] },
    { k:'saldo_promedio', nombre:'Saldo promedio', tipo:'dinero', etiquetas:['saldo promedio(?: del mes| mensual| del periodo)?'] },
    { k:'valor_contrato', nombre:'Valor del contrato', tipo:'dinero', etiquetas:['valor (?:total )?del contrato', 'valor total', 'valor'] },
    { k:'fecha_inicio', nombre:'Fecha de inicio', tipo:'fecha', etiquetas:['fecha de (?:inicio|iniciacion)', 'acta de inicio', 'inicio'] },
    { k:'fecha_terminacion', nombre:'Fecha de terminación', tipo:'fecha', etiquetas:['fecha de (?:terminacion|finalizacion)', 'terminacion', 'finalizacion'] },
    { k:'canon_mensual', nombre:'Canon mensual de arrendamiento', tipo:'dinero', etiquetas:['canon (?:de arrendamiento )?(?:mensual)?(?: de| por)?(?: la suma de)?', 'renta mensual', 'valor (?:del|de la) (?:canon|renta)(?: mensual)?'] },
    { k:'razon_social', nombre:'Razón social', tipo:'linea', etiquetas:['razon social', 'nombre o razon social', 'denominacion(?: social)?'] },
    { k:'fecha_matricula', nombre:'Fecha de matrícula o constitución', tipo:'fecha', etiquetas:['fecha de (?:matricula|constitucion|inscripcion)', 'matriculad[oa] (?:el|en)', 'constituid[oa] (?:el|mediante [^\\n]{0,80}? del?)'] },
    { k:'representante_legal', nombre:'Representante legal', tipo:'nombre', etiquetas:['representante legal(?: principal)?', 'gerente(?: general)?', 'representad[oa] legalmente por'] },
    { k:'mesada_pensional', nombre:'Mesada pensional', tipo:'dinero', etiquetas:['mesada(?: pensional)?(?: mensual)?(?: de)?', 'valor (?:de la )?(?:mesada|pension)(?: mensual)?', 'pension (?:mensual|de vejez|de jubilacion|de invalidez|de sobrevivientes)(?: de)?'] },
    { k:'saldo_deudas', nombre:'Saldo de deudas', tipo:'dinero', etiquetas:['saldo (?:total )?(?:de la |del )?(?:deuda|obligacion|credito|capital)(?:es)?', 'saldo a capital', 'total (?:saldo|obligaciones)'] },
    { k:'cuotas_mensuales', nombre:'Cuota mensual de deudas', tipo:'dinero', etiquetas:['total cuotas(?: mensuales)?', 'valor (?:de la )?cuota(?: mensual)?', 'cuota mensual'] },
    { k:'activo_corriente', nombre:'Activo corriente', tipo:'dinero', etiquetas:['(?:total )?activos? corrientes?'] },
    { k:'pasivo_corriente', nombre:'Pasivo corriente', tipo:'dinero', etiquetas:['(?:total )?pasivos? corrientes?'] },
    { k:'activo_total', nombre:'Activo total', tipo:'dinero', etiquetas:['total (?:de )?(?:los )?activos?(?! corriente| no corriente)', 'activos? totale?s?'] },
    { k:'pasivo_total', nombre:'Pasivo total', tipo:'dinero', etiquetas:['total (?:de )?(?:los )?pasivos?(?! corriente| no corriente| y patrimonio| mas patrimonio| \\+ patrimonio)', 'pasivos? totale?s?'] },
    { k:'patrimonio', nombre:'Patrimonio', tipo:'dinero', etiquetas:['total (?:del )?patrimonio(?! bruto| liquido)', '(?<!y |mas |\\+ )patrimonio(?: neto| total)?(?! bruto| liquido)'] },
    { k:'ingresos_operacionales', nombre:'Ingresos operacionales', tipo:'dinero', etiquetas:['ingresos (?:de actividades ordinarias|operacionales|ordinarios)', 'total ingresos operacionales', 'ventas(?: netas)?'] },
    { k:'utilidad_operacional', nombre:'Utilidad operacional', tipo:'dinero', etiquetas:['utilidad (?:operacional|de operacion|operativa)', '(?:resultado|ganancia) (?:operacional|de operacion|por actividades de operacion)'] },
    { k:'utilidad_neta', nombre:'Utilidad neta', tipo:'dinero', etiquetas:['(?:utilidad|ganancia|resultado) (?:neta|neto|del ejercicio|del periodo)', 'utilidad (?:liquida )?del ejercicio'] },
    { k:'gastos_financieros', nombre:'Gastos financieros', tipo:'dinero', etiquetas:['gastos? (?:de |por )?intereses', 'gastos financieros', 'costos? financieros'] },
    { k:'numero_licencia', nombre:'Número de licencia', tipo:'matricula', etiquetas:['licencia (?:de construccion )?(?:no\\.?|numero|n°|nro\\.?)', 'resolucion(?: no\\.?| numero| n°)?'] },
    { k:'fecha_ejecutoria', nombre:'Fecha de ejecutoria', tipo:'fecha', etiquetas:['fecha de ejecutoria', 'ejecutoriad[oa](?: el| el dia)?', 'ejecutoria'] },
    { k:'vigencia_hasta', nombre:'Vigente hasta', tipo:'fecha', etiquetas:['vigencia hasta', 'vigente hasta', 'fin de (?:la )?vigencia', 'vence(?: el)?', 'hasta'] },
    { k:'area_construida', nombre:'Área construida', tipo:'area', etiquetas:['area (?:total )?construida', 'area (?:total|intervenida|aprobada)', 'area'] },
    { k:'unidades_totales', nombre:'Unidades del proyecto', tipo:'numero', etiquetas:['total (?:de )?unidades', 'numero (?:total )?de (?:unidades|viviendas|apartamentos|casas)', 'unidades (?:de vivienda|totales|del proyecto)'] },
    { k:'unidades_vendidas', nombre:'Unidades vendidas', tipo:'numero', etiquetas:['unidades vendidas', '(?:numero de )?unidades (?:separadas|promesadas)', 'total vendidas', 'vendidas', 'preventas(?: unidades)?'] },
    { k:'valor_ventas_proyecto', nombre:'Valor total de ventas', tipo:'dinero', etiquetas:['valor total (?:de )?(?:las )?ventas', 'ventas totales(?: del proyecto)?', 'ingresos por ventas', 'total ventas'] },
    { k:'costo_total_proyecto', nombre:'Costo total del proyecto', tipo:'dinero', etiquetas:['costo total(?: del proyecto| de la obra)?', 'total (?:costos|presupuesto)(?: del proyecto| de obra)?', 'valor total (?:del )?presupuesto', 'presupuesto total'] },
    { k:'costo_directo', nombre:'Costo directo', tipo:'dinero', etiquetas:['total costos? directos?', 'costos? directos?'] },
    { k:'matricula_inmobiliaria', nombre:'Matrícula inmobiliaria', tipo:'matinm', etiquetas:['matricula inmobiliaria(?: no\\.?| numero| n°| nro\\.?)?', 'folio de matricula(?: inmobiliaria)?(?: no\\.?)?', 'nro\\.? matricula', 'matricula(?: no\\.?)?'] },
    { k:'gravamenes', nombre:'Gravámenes y limitaciones', tipo:'gravamen', claves:[['hipoteca', 'Hipoteca'], ['embargo', 'Embargo'], ['patrimonio (?:de )?familia', 'Patrimonio de familia'], ['afectacion a vivienda familiar', 'Afectación a vivienda familiar'], ['demanda', 'Demanda'], ['medida cautelar', 'Medida cautelar'], ['usufructo', 'Usufructo'], ['condicion resolutoria', 'Condición resolutoria'], ['falsa tradicion', 'Falsa tradición'], ['servidumbre', 'Servidumbre']] },
    { k:'proyectos_terminados', nombre:'Proyectos terminados', tipo:'numero', etiquetas:['proyectos (?:terminados|entregados|ejecutados)', 'numero de proyectos'] },
    { k:'valor_inmueble', nombre:'Precio del inmueble', tipo:'dinero', etiquetas:['precio (?:total )?(?:de venta )?(?:del inmueble|de la compraventa)', 'valor (?:total )?(?:del inmueble|de la venta|de la compraventa)', 'por (?:la )?(?:suma|cantidad) (?:total )?de', 'precio(?: total)?'] },
    { k:'valor_avaluo', nombre:'Valor del avalúo', tipo:'dinero', etiquetas:['valor (?:comercial|del avaluo|total del avaluo|razonable)', 'avaluo comercial', 'valor total'] },
    { k:'avaluo_catastral', nombre:'Avalúo catastral', tipo:'dinero', etiquetas:['avaluo (?:catastral|fiscal)', 'base gravable'] }
  ];

  /* De qué documento se trata: palabras que lo delatan. Gana el que más reúne (mínimo dos). */
  const FIRMAS = {
    cert_laboral:['certifica', 'labora|trabaja|vinculad', 'salario|asignacion|devenga|sueldo', 'cargo', 'contrato'],
    desprendibles:['desprendible|comprobante de (?:pago|nomina)|colilla|volante de pago', 'devengad|devengo', 'deduccion|descuento', 'neto'],
    extractos:['extracto', 'saldo anterior|saldo inicial', 'abono|credito|deposito|consignacion', 'cargo|debito|retiro', 'cuenta (?:de )?(?:ahorros|corriente)'],
    declaracion_renta:['declaracion de renta|formulario 210|renta y complementario', 'patrimonio bruto', 'renta liquida', 'ano gravable', 'dian'],
    renta_empresa:['formulario 110|personas juridicas', 'patrimonio bruto', 'renta liquida', 'dian'],
    cert_ingresos_ret:['certificado de ingresos y retenciones|formulario 220', 'retenciones', 'ano gravable'],
    cert_contador:['contador publico', 'tarjeta profesional', 'certifica', 'ingresos'],
    tp_contador:['junta central de contadores', 'antecedentes', 'tarjeta profesional'],
    rut:['registro unico tributario', 'actividad economica', 'dian'],
    camara_comercio:['camara de comercio', 'existencia y representacion legal|certificado de matricula', 'representante legal|matricula mercantil', 'nit'],
    estados_financieros:['estado (?:de situacion financiera|de resultados)|balance general', 'activo', 'pasivo', 'patrimonio', 'utilidad|ganancia'],
    resolucion_pension:['resolucion', 'pension', 'reconoce'],
    desprendibles_pension:['mesada|pension', 'colpensiones|fondo de pensiones|pensionado', 'neto|descuento'],
    reporte_centrales:['datacredito|transunion|cifin|centrales de riesgo', 'puntaje|score|acierta', 'obligacion|habito'],
    tradicion:['certificado de tradicion|tradicion y libertad', 'matricula inmobiliaria', 'anotacion', 'registro de instrumentos publicos|oficina de registro'],
    promesa:['promesa de compraventa', 'prometiente|promitente', 'precio', 'escritura'],
    avaluo:['avaluo', 'valor comercial|valor razonable', 'avaluador|raa', 'area'],
    predial:['impuesto predial|predial unificado', 'avaluo catastral', 'pago'],
    licencia_construccion:['licencia de construccion', 'curaduria|curador', 'ejecutoria', 'resolucion'],
    presupuesto_obra:['presupuesto', 'costo directo|costos directos', 'capitulo|actividad|apu', 'total'],
    cuadro_ventas:['ventas|preventas', 'unidades', 'vendid|separad|promesad', 'fiduciaria|encargo'],
    contrato_fiducia:['fiducia|fiduciaria|encargo fiduciario', 'contrato', 'fideicomiso|preventas'],
    contratos_arriendo:['contrato de arrendamiento', 'arrendador', 'arrendatario', 'canon'],
    credito_actual:['certificacion de deuda|estado de cuenta|certificado de deuda', 'saldo', 'cuota', 'obligacion|credito'],
    experiencia:['experiencia', 'proyectos?', 'terminad|entregad|ejecutad', 'certifica']
  };

  const SIN_TILDE = { 'á':'a', 'é':'e', 'í':'i', 'ó':'o', 'ú':'u', 'ü':'u', 'ñ':'n', 'Á':'a', 'É':'e', 'Í':'i', 'Ó':'o', 'Ú':'u', 'Ü':'u', 'Ñ':'n' };
  /** Minúsculas y sin tildes, letra por letra: las posiciones quedan iguales a las del texto original. */
  function plegar(t){ let s = ''; for (const ch of String(t)) { const c = SIN_TILDE[ch] || ch.toLowerCase(); s += c.length === ch.length ? c : ch; } return s; }
  function plano(t){ return String(t || '').replace(/\s+/g, ' ').trim(); }
  function etiquetaRe(fuente){ return new RegExp('(?<![a-z0-9])(?:' + fuente + ')(?![a-z0-9])', 'g'); }

  /** Cifra escrita en pesos colombianos (punto de miles, coma decimal) o en formato inglés. */
  function numero(v){
    let t = String(v).replace(/[^\d.,()-]/g, '');
    const neg = /^\(.*\)$/.test(t) || /^-/.test(t);
    t = t.replace(/[()-]/g, '');
    const ultSep = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
    const decimales = ultSep >= 0 ? t.length - ultSep - 1 : 0;
    let n;
    if (ultSep >= 0 && decimales > 0 && decimales <= 2) n = Number(t.slice(0, ultSep).replace(/[.,]/g, '') + '.' + t.slice(ultSep + 1));
    else n = Number(t.replace(/[.,]/g, ''));
    return isFinite(n) && t !== '' ? (neg ? -n : n) : null;
  }
  /** Fecha AAAA-MM-DD de una fecha escrita de las formas usuales en Colombia (día antes que mes). */
  function fechaIso(v){
    const t = plegar(String(v));
    const dos = n => String(n).padStart(2, '0');
    let m = t.match(new RegExp('(\\d{1,2})\\s*(?:de\\s+)?(' + MESES + ')\\s*(?:de|del)?\\s*(\\d{4})'));
    if (m) return m[3] + '-' + dos(NUM_MES[m[2]]) + '-' + dos(m[1]);
    m = t.match(new RegExp('(' + MESES + ')\\s+(\\d{1,2})\\s*(?:de|,)?\\s*(\\d{4})'));
    if (m) return m[3] + '-' + dos(NUM_MES[m[1]]) + '-' + dos(m[2]);
    m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '-' + dos(m[2]) + '-' + dos(m[3]);
    m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (m && Number(m[2]) <= 12 && Number(m[1]) <= 31) return m[3] + '-' + dos(m[2]) + '-' + dos(m[1]);
    return null;
  }
  function normalizado(tipo, valor){
    if (tipo === 'dinero' || tipo === 'area') return numero(valor.replace(/m2|m²|mts2|mt2|metros\s+cuadrados/gi, ''));
    if (tipo === 'porcentaje'){ const n = numero(valor.replace('%', '')); return n === null ? null : n; }
    if (tipo === 'numero' || tipo === 'anio') return numero(valor);
    if (tipo === 'fecha') return fechaIso(valor);
    if (tipo === 'nit' || tipo === 'cedula') return valor.replace(/\D/g, '');
    return null;
  }

  const FIN_NOMBRE = /^(?:C\.?C\.?|NIT|No\.?|N°|CC|T\.?P\.?|M\.?P\.?|Identificad[oa]|Con|Mayor|Quien|Domiciliad[oa]|En|Por|Labora|Trabaja|Desde|Mediante|Cargo|Cédula|Cedula)$/i;
  function recortarNombre(v){
    const w = v.split(/\s+/);
    const k = w.findIndex((x, i) => i > 0 && FIN_NOMBRE.test(x));
    const r = (k > 0 ? w.slice(0, k) : w).join(' ').replace(/[.,;:-]+$/, '');
    return r.split(/\s+/).filter(x => /^[A-ZÁÉÍÓÚÜÑ&]/.test(x)).length >= 2 ? r : '';
  }

  function valorDespues(tipo, texto, desde, hasta){
    const trozo = texto.slice(desde, hasta);
    if (tipo === 'linea'){
      const sep = trozo.match(/^[\s:.,-]*(?:(?:es|de|como)\s+)?/i);
      const ini = sep ? sep[0].length : 0;
      let t = trozo.slice(ini);
      const n = t.indexOf('\n'); if (n >= 0) t = t.slice(0, n);
      const corte = t.search(/,\s|\.\s|;|\s(?:con|desde|devengando|identificad|mediante|y con)\s/i);
      if (corte >= 3) t = t.slice(0, corte);
      t = t.replace(/[.,;:\s]+$/, '').slice(0, 100).trim();
      return t.length >= 3 ? { valor:t, ini:desde + ini, fin:desde + ini + t.length } : null;
    }
    const re = new RegExp(TIPOS[tipo].source, TIPOS[tipo].flags.replace('g', '') + 'g');
    let m;
    while ((m = re.exec(trozo))){
      let v = m[0].replace(/\s+$/, '');
      if (!v) { re.lastIndex++; continue; }
      if (tipo === 'dinero'){
        v = v.replace(/[\s.,]+$/, '');
        if (v.replace(/\D/g, '').length < 4) continue;
        if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(v) || /\d{3}\.\d{3}\.\d{3}-\d$/.test(trozo.slice(m.index, m.index + v.length + 2))) continue;
      }
      if (tipo === 'numero'){
        // Un número que es parte de una fecha, de un año o de una cifra de dinero no es una cantidad.
        const antes = trozo.slice(Math.max(0, m.index - 2), m.index), despues = trozo.slice(m.index + v.length, m.index + v.length + 2);
        if (/[/$-]/.test(antes) || /^[/-]\d/.test(despues) || /^(?:19|20)\d{2}$/.test(v)) continue;
      }
      if (tipo === 'cedula' && v.replace(/\D/g, '').length < 6) continue;
      if (tipo === 'matricula' && v.replace(/\D/g, '').length < 3) continue;
      if (tipo === 'nombre'){ v = recortarNombre(v); if (!v) continue; }
      return { valor:v, ini:desde + m.index, fin:desde + m.index + v.length };
    }
    return null;
  }
  function limite(texto, desde, tipo){
    const tope = Math.min(texto.length, desde + 160);
    let n = texto.indexOf('\n', desde);
    if (n < 0 || n >= tope) return tope;
    if ((tipo === 'nombre' || tipo === 'linea') && /\S/.test(texto.slice(desde, n).replace(/[:\s-]/g, ''))) return n;
    const n2 = texto.indexOf('\n', n + 1);
    return n2 < 0 || n2 > tope ? tope : n2;
  }
  function fragmento(texto, iniEtiqueta, finValor){
    const linea = texto.lastIndexOf('\n', iniEtiqueta - 1) + 1;
    let ini = iniEtiqueta - linea <= 40 ? linea : iniEtiqueta;
    if (finValor - ini > 300) ini = finValor - 300;
    return plano(texto.slice(ini, finValor));
  }

  function buscarCampo(c, paginas, plegadas){
    const hall = [];
    paginas.forEach((texto, i) => {
      const usadas = [];
      c.etiquetas.forEach((fuente, prioridad) => {
        const re = etiquetaRe(fuente);
        let m;
        while ((m = re.exec(plegadas[i]))){
          const desde = m.index + m[0].length;
          if (usadas.some(u => m.index < u[1] && desde > u[0])) continue;
          usadas.push([m.index, desde]);
          const v = valorDespues(c.tipo, texto, desde, limite(texto, desde, c.tipo));
          if (!v) continue;
          hall.push({ campo:c.k, nombreCampo:c.nombre, valor:v.valor, normalizado:normalizado(c.tipo, v.valor), texto:fragmento(texto, m.index, v.fin), pagina:i + 1,
            puntos:prioridad * 40 + (v.ini - desde) + i * 0.01, motivo:'' });
        }
      });
    });
    hall.sort((a, b) => a.puntos - b.puntos);
    const vistos = new Set(), out = [];
    for (const h of hall){
      const clave = plano(h.valor).toLowerCase();
      if (vistos.has(clave)) continue;
      vistos.add(clave); out.push(h);
      if (out.length >= MAX_POR_CAMPO) break;
    }
    out.forEach((h, k) => { delete h.puntos; if (k) h.motivo = 'Otra coincidencia en el documento.'; });
    return out;
  }
  /** 'clave': la primera palabra de la lista que aparece en el documento. */
  function buscarClave(c, paginas, plegadas){
    for (const [fuente, valor] of c.claves){
      const re = etiquetaRe(fuente);
      for (let i = 0; i < paginas.length; i++){
        const m = re.exec(plegadas[i]);
        if (m) return [{ campo:c.k, nombreCampo:c.nombre, valor, normalizado:valor, texto:fragmento(paginas[i], m.index, m.index + m[0].length), pagina:i + 1, motivo:'' }];
      }
    }
    return [];
  }
  /** 'gravamen': cada limitación mencionada, una vez, con el aviso si el documento también habla de cancelaciones. */
  function buscarGravamenes(c, paginas, plegadas){
    const out = [];
    const hayCancelacion = plegadas.some(p => /cancelacion/.test(p));
    c.claves.forEach(([fuente, valor]) => {
      const re = etiquetaRe(fuente);
      for (let i = 0; i < paginas.length; i++){
        const m = re.exec(plegadas[i]);
        if (!m) continue;
        const fin = Math.min(paginas[i].length, m.index + m[0].length + 80);
        out.push({ campo:c.k, nombreCampo:c.nombre, valor, normalizado:valor, texto:fragmento(paginas[i], m.index, fin), pagina:i + 1,
          motivo:hayCancelacion ? 'El certificado también registra cancelaciones: verifique si esta anotación quedó cancelada.' : '' });
        break;
      }
    });
    return out;
  }

  /** Lee los datos pedidos (o todos, si no se piden). paginas[i] = texto de la página i+1. */
  function leer(paginas, campos){
    const P = (paginas || []).map(t => String(t || '').replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' '));
    const F = P.map(plegar);
    const out = [];
    (campos && campos.length ? campos : CAMPOS.map(c => c.k)).forEach(k => {
      const c = CAMPOS.find(x => x.k === k);
      if (!c) return;
      if (c.tipo === 'clave') out.push(...buscarClave(c, P, F));
      else if (c.tipo === 'gravamen') out.push(...buscarGravamenes(c, P, F));
      else out.push(...buscarCampo(c, P, F));
    });
    return out;
  }
  function faltantes(datos, campos){ return (campos || []).filter(k => !(datos || []).some(d => d.campo === k)).map(k => (CAMPOS.find(c => c.k === k) || { nombre:k }).nombre); }

  /** El tipo de documento más probable: { id, puntos, de } o null. */
  function clasificar(paginas){
    const t = plegar((paginas || []).join('\n'));
    let mejor = null;
    Object.keys(FIRMAS).forEach(id => {
      const pts = FIRMAS[id].filter(f => new RegExp(f).test(t)).length;
      if (pts >= 2 && (!mejor || pts / FIRMAS[id].length > mejor.puntos / mejor.de)) mejor = { id, puntos:pts, de:FIRMAS[id].length };
    });
    return mejor;
  }

  /* ── Del documento al perfil del cliente ──
     Cada dato leído propone un valor para un campo del perfil. conv: cómo se convierte. */
  const MAPA = {
    salario:{ k:'ingresoMensual' }, ingreso_mensual_certificado:{ k:'ingresoMensual' }, mesada_pensional:{ k:'ingresoMensual' },
    canon_mensual:{ k:'ingresoMensual', nota:'Canon de arrendamiento: súmelo a los demás ingresos si hay varios contratos.' },
    ingresos_brutos_anuales:{ k:'ingresoMensual', conv:'anualAMensual', nota:'Promedio mensual de los ingresos brutos del año (÷ 12).', solo:['independiente', 'rentista'] },
    fecha_ingreso:{ k:'fechaIngreso' }, fecha_nacimiento:{ k:'fechaNacimiento' }, tipo_contrato:{ k:'tipoContrato' }, cargo:{ k:'cargo' },
    puntaje_credito:{ k:'puntajeCredito' }, reportes_negativos:{ k:'reportesNegativos', conv:'si' },
    patrimonio_liquido:{ k:'patrimonioLiquido' }, deudas:{ k:'saldoDeudas' }, saldo_deudas:{ k:'saldoDeudas' }, cuotas_mensuales:{ k:'cuotasActuales' },
    activo_corriente:{ k:'activoCorriente' }, pasivo_corriente:{ k:'pasivoCorriente' }, activo_total:{ k:'activoTotal' }, pasivo_total:{ k:'pasivoTotal' },
    patrimonio:{ k:'patrimonio' }, ingresos_operacionales:{ k:'ingresosOperacionales' }, utilidad_operacional:{ k:'utilidadOperacional' },
    utilidad_neta:{ k:'utilidadNeta' }, gastos_financieros:{ k:'gastosFinancieros' }, fecha_matricula:{ k:'fechaConstitucion' },
    costo_total_proyecto:{ k:'costoTotalProyecto' }, valor_ventas_proyecto:{ k:'valorVentasProyecto' }, unidades_totales:{ k:'unidadesTotales' },
    unidades_vendidas:{ k:'unidadesVendidas' }, proyectos_terminados:{ k:'proyectosTerminados' },
    valor_inmueble:{ k:'valorInmueble' }, valor_avaluo:{ k:'valorInmueble', nota:'Valor del avalúo comercial.' }, monto_solicitado:{ k:'montoSolicitado' },
    gravamenes:{ k:'gravamenes', conv:'lista' }, vigencia_hasta:{ k:'licenciaVigente', conv:'vigente', solo:['constructora'] }
  };
  /** El valor que un dato leído propone para el perfil, o null si no aplica. */
  function propuesta(dato, tipoCliente, todos, hoy){
    const m = MAPA[dato.campo];
    if (!m || (m.solo && m.solo.indexOf(tipoCliente) < 0)) return null;
    let v = dato.normalizado === null || dato.normalizado === undefined ? dato.valor : dato.normalizado;
    if (m.conv === 'anualAMensual') v = typeof v === 'number' ? Math.round(v / 12) : null;
    else if (m.conv === 'si') v = true;
    else if (m.conv === 'lista') v = (todos || [dato]).filter(d => d.campo === 'gravamenes').map(d => d.valor).join(', ');
    else if (m.conv === 'vigente') v = v ? v >= (hoy || new Date().toISOString().slice(0, 10)) : null;
    if (v === null || v === undefined || v === '') return null;
    return { k:m.k, valor:v, nota:m.nota || '' };
  }

  return { CAMPOS, FIRMAS, MAPA, leer, faltantes, clasificar, propuesta, numero, fechaIso, plegar, plano };
})();
