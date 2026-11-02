/* ══════════════════════════════════════════════════════════════════════════
   MÓDULO 16 · CENTRO DE AYUDA — el mismo centro de ayuda de ARKEN CONTROL
   (inicio con buscador, primeros pasos, rutas de trabajo, guías por módulo con
   tareas paso a paso, preguntas frecuentes, glosario, información del
   software y manual de usuario en PDF), con el contenido de ARKEN BANK.
   El texto describe lo que el programa hace de verdad: los nombres de los
   botones y pestañas son los que aparecen en pantalla, entre «comillas».
   ══════════════════════════════════════════════════════════════════════════ */
const TABS_16 = [
  { k:'inicio', n:'Inicio' }, { k:'guias', n:'Guías por módulo' }, { k:'rutas', n:'Rutas de trabajo' },
  { k:'faq', n:'Preguntas frecuentes' }, { k:'glosario', n:'Glosario' }, { k:'info', n:'Información del software' }
];
const FAQ_CATEGORIAS = [
  { k:'inicio', n:'Cómo empezar' }, { k:'clientes', n:'Clientes y filtros' }, { k:'documentos', n:'Documentos y lectura' },
  { k:'viabilidad', n:'Viabilidad y conceptos' }, { k:'bancos', n:'Bancos y condiciones' }, { k:'normas', n:'Normas de vivienda' },
  { k:'roles', n:'Roles, datos y respaldos' }
];
const FAQ_POR_MODULO = { '00':['inicio'], '01':['clientes'], '02':['clientes'], '03':['documentos'], '04':['bancos'], '05':['viabilidad'], '06':['normas'], '07':['normas'], 'adm':['roles'], 'cfg':['roles'] };

const ICONOS_AYUDA = {
  tablero:'M4 20V10M10 20V4M16 20v-7M22 20H2',
  clientes:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M17 4.5a3.5 3.5 0 0 1 0 6.5M19 14.5c2 .8 3 2.6 3 5',
  ficha:'M5 3h14v18H5zM9 8a2 2 0 1 0 4 0 2 2 0 0 0-4 0M8 14h8M8 17h5',
  documentos:'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5M9 9h3',
  bancos:'M3 21h18M4 10h16M12 3l9 5H3zM6 10v8M10 10v8M14 10v8M18 10v8',
  concepto:'M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6zM9 12l2 2 4-4',
  creditos:'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M9 10h.01M15 10h.01',
  simulador:'M5 3h14v18H5zM8 7h8v3H8zM8 13h2M11 13h2M14 13h2M8 16h2M11 16h2M14 16h2',
  ayuda:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01',
  admin:'M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1L11 21h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4z',
  config:'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  ruta:'M5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM19 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM7 17h6a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h6',
  lupa:'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L21 21',
  libro:'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7'
};
function iconoAyuda(k, cls){ return '<svg class="' + (cls || 'ay-ic') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="' + (ICONOS_AYUDA[k] || ICONOS_AYUDA.ayuda) + '"/></svg>'; }
function fmtAy(t){ return esc(t).replace(/«([^«»]+)»/g, '<span class="ay-chip">$1</span>'); }

/* ═══════════════════ Guías por módulo ═══════════════════ */
const GUIAS_MODULO = [
  { id:'00', ic:'tablero', lema:'La cartera de clientes de un vistazo',
    para:'Muestra cuántos clientes tiene, cuántos son viables, el monto en estudio, los documentos pendientes y los últimos conceptos emitidos. Cada cifra se calcula con la mejor opción de cada cliente en los bancos activos.',
    quien:'Dirección comercial, analistas y asesores.',
    pestanas:[['Cifras', 'Clientes, viables, monto en estudio y conceptos emitidos.'], ['Clientes por dictamen', 'Cuántos clientes quedan viables, con condiciones, con monto ajustado, incompletos o no viables.'],
      ['Clientes por estado', 'Prospecto, en estudio, radicado, aprobado, desembolsado, negado o desistido.'], ['Documentos pendientes', 'Los clientes con documentos por cargar o vencidos, con el botón «Documentos».'], ['Últimos conceptos', 'Los conceptos emitidos más recientes.']],
    tareas:[
      { t:'Conocer el programa con la demostración', pasos:['Con el programa vacío, pulse «Cargar demostración».', 'Espere a que el programa cree los seis clientes y lea sus documentos de ejemplo.', 'Abra «Clientes y filtros» y recorra cada cliente.'], res:'Seis clientes ficticios con documentos leídos y opciones calculadas en diez bancos.' },
      { t:'Ver qué clientes tienen documentos pendientes', pasos:['Mire la tarjeta «Documentos pendientes».', 'Pulse «Documentos» en la fila del cliente para ir directo a su lista.'] }],
    consejos:['El tablero se recalcula cada vez que entra: si cambia condiciones de un banco, los dictámenes cambian al instante.'], cuidado:[] },

  { id:'01', ic:'clientes', lema:'Toda la cartera, filtrada como la necesite',
    para:'Lista los clientes con su tipo, crédito, estado, avance de documentos y mejor opción. Los filtros combinan tipo de cliente, crédito, estado, dictamen, banco en el que es viable, estado de la documentación, rango de ingresos y rango de monto. La «Matriz de viabilidad por banco» muestra el dictamen de cada cliente en cada banco.',
    quien:'Analistas, asesores y dirección comercial.',
    pestanas:[['Lista de clientes', 'Una fila por cliente con su mejor opción, la cuota estimada y los botones «Abrir» y «Concepto».'], ['Matriz de viabilidad por banco', 'Clientes en filas y bancos en columnas: cada celda es el dictamen de la mejor opción del cliente en ese banco.']],
    tareas:[
      { t:'Crear un cliente', pasos:['Pulse «+ Nuevo cliente».', 'Escriba el nombre y elija el tipo de cliente (asalariado, independiente, rentista, pensionado, residente en el exterior, empresa o constructora).', 'Complete documento, contacto y ciudad, y pulse «Crear cliente».', 'En la ficha, elija el crédito que solicita.'], res:'El cliente queda abierto y el programa ya sabe qué créditos le aplican y qué documentos pedirle.' },
      { t:'Encontrar los clientes viables en un banco', pasos:['En «Viable en el banco» elija el banco.', 'Combine con «Crédito solicitado» o «Tipo de cliente» si lo necesita.', 'Pulse «Informe PDF de la selección» o «Exportar a Excel» para compartir el resultado.'], res:'Solo quedan los clientes cuyo dictamen en ese banco es viable, con condiciones o con monto ajustado.' },
      { t:'Ver la viabilidad de toda la cartera en todos los bancos', pasos:['Abra la pestaña «Matriz de viabilidad por banco».', 'Lea cada celda: dictamen y cuota estimada.', 'Pulse una celda para abrir el análisis de ese cliente en ese banco.'] },
      { t:'Buscar clientes por rango de ingresos o de monto', pasos:['Escriba los valores en «Ingreso mensual desde/hasta» o «Monto desde/hasta».', 'La lista se filtra al escribir.', '«Quitar filtros» vuelve a la lista completa.'] }],
    consejos:['En empresas, el ingreso que usa el filtro es el ingreso operacional anual dividido por 12.', 'Los filtros se conservan mientras no cierre la sesión.'], cuidado:[] },

  { id:'02', ic:'ficha', lema:'El perfil financiero que decide la viabilidad',
    para:'Reúne los datos del cliente y su perfil: la operación que pide (crédito, valor del inmueble, monto, plazo, VIS), sus ingresos y deudas, su perfil laboral o, en empresas, sus estados financieros y, en constructoras, los datos del proyecto. Cada valor que vino de un documento muestra de qué archivo y página salió.',
    quien:'Analistas y asesores.',
    pestanas:[['Operación', 'Crédito solicitado, valor del inmueble, monto, plazo, VIS y gravámenes.'], ['Ingresos y deudas', 'Ingreso, variables, codeudor, cuotas y saldo de deudas, puntaje y reportes.'], ['Perfil, Empresa o Proyecto', 'Según el tipo de cliente: fechas y contrato, estados financieros o datos del proyecto.'], ['Créditos para este cliente', 'Los créditos que aplican a su tipo; uno se elige con un clic.']],
    tareas:[
      { t:'Elegir el crédito que solicita el cliente', pasos:['En «Créditos para…», pulse el crédito.', 'El programa lo guarda y ajusta la lista de documentos del módulo 03.'] },
      { t:'Completar el perfil', pasos:['Escriba los datos o tráigalos de los documentos (módulo 03 › «Revisar datos» › «Pasar al perfil»).', 'Pulse «Guardar».'], res:'El motor recalcula la viabilidad en todos los bancos con los datos nuevos.' },
      { t:'Cambiar el estado del cliente', pasos:['En «Datos del cliente», elija el estado: prospecto, en estudio, radicado, aprobado, desembolsado, negado o desistido.', 'Pulse «Guardar».'] }],
    consejos:['Si corrige a mano un valor que vino de un documento, el programa deja de citar el documento como fuente.'],
    cuidado:['El ingreso del codeudor se suma a la capacidad de pago: regístrelo solo si firmará el crédito.'] },

  { id:'03', ic:'documentos', lema:'Los documentos correctos, leídos y vigentes',
    para:'Según el tipo de cliente y el crédito, el programa arma la lista de documentos obligatorios y los que se piden según el caso. Los archivos (PDF o fotos) quedan guardados en el equipo. «Leer» extrae el texto, reconoce el texto de las páginas escaneadas con OCR en español, identifica el tipo de documento y busca sus datos: salario, fechas, cifras de los estados financieros, gravámenes del certificado de tradición, preventas… Cada dato queda con la página y el texto literal de donde salió.',
    quien:'Asesores (cargan) y analistas (leen y revisan).',
    pestanas:[['Cifras', 'Obligatorios cargados, por cargar, vencidos y sin leer.'], ['Coherencia', 'Cruces entre documentos y con el perfil: salario del certificado frente a desprendibles, abonos de extractos frente al ingreso, cédula, balance que no cuadra…'],
      ['Documentos para el crédito', 'Una fila por documento con su estado, sus archivos y los botones «Ver», «Leer», «Revisar datos», «Fecha» y «✕».'], ['Otros documentos', 'Archivos que no corresponden a la lista del crédito.']],
    tareas:[
      { t:'Cargar un documento', pasos:['En la fila del documento, pulse «Cargar».', 'Elija uno o varios archivos (PDF, JPG o PNG).', 'El programa los guarda y, si usted puede leer documentos, los lee enseguida.'], res:'El documento queda cargado, leído y con su fecha de expedición si el texto la trae.' },
      { t:'Cargar varios documentos sin saber qué son', pasos:['Pulse «Cargar y clasificar».', 'Elija los archivos.', 'El lector reconoce el tipo de cada uno por su contenido y lo ubica en la fila que corresponde.'] },
      { t:'Revisar los datos leídos y pasarlos al perfil', pasos:['Pulse «Revisar datos» en el archivo.', 'Compare cada dato con la evidencia: página y texto literal.', 'Marque los valores que deben pasar al perfil y pulse «Pasar al perfil».'], res:'El perfil queda con esos valores y cada uno recuerda de qué documento y página salió.' },
      { t:'Corregir la fecha de expedición o el tipo', pasos:['Pulse «Fecha» en el archivo.', 'Escriba la fecha de expedición y, si hace falta, cambie el tipo de documento.', 'Guarde: la vigencia se recalcula.'] }],
    consejos:['Los PDF generados por computador se leen con precisión total; las fotos dependen de la luz y del enfoque.', 'Si un documento sale «Vencido», pida uno nuevo: la vigencia se cuenta desde la fecha de expedición.'],
    cuidado:['Con OCR, compare las cifras con la evidencia antes de pasarlas al perfil.', 'Un certificado de tradición con embargo, demanda o falsa tradición impide la garantía hasta que se levante.'] },

  { id:'04', ic:'bancos', lema:'Qué ofrece cada banco y con qué condiciones',
    para:'Calcula las opciones del cliente abierto en todos los bancos activos, ordenadas de la mejor a la peor, con monto aprobable, cuota, tasa y plazo. Muestra la matriz de qué crédito ofrece cada banco y guarda las condiciones de cada banco por crédito: tasa, financiación, plazo, cuota/ingreso, endeudamiento, ingreso y puntaje mínimos, edad, antigüedad y, para empresas y constructoras, sus indicadores.',
    quien:'Analistas (consultan), administrador y director (mantienen las condiciones).',
    pestanas:[['Opciones del cliente', 'Una tarjeta por banco con el dictamen, las cifras y lo que no cumple; los chips cambian el crédito evaluado.'], ['Qué ofrece cada banco', 'Matriz bancos × créditos con la tasa de referencia.'], ['Condiciones por banco', 'La lista de bancos y, para el elegido, sus condiciones por crédito, con «Editar».']],
    tareas:[
      { t:'Ver las opciones del cliente en todos los bancos', pasos:['Abra el cliente.', 'Entre a «Opciones del cliente».', 'Use los chips para comparar otro crédito (por ejemplo leasing habitacional frente a hipotecario).', 'Pulse «Análisis y concepto» en la opción que quiere presentar.'] },
      { t:'Actualizar las condiciones de un banco', pasos:['Entre a «Condiciones por banco» y elija el banco.', 'Pulse «Editar» en el crédito.', 'Escriba las condiciones vigentes y guarde.'], res:'La fecha de actualización del banco pasa a hoy y deja de ser de referencia.' },
      { t:'Agregar un banco o una cooperativa', pasos:['Pulse «+ Banco».', 'Escriba el nombre y el contacto.', 'Edite las condiciones de cada crédito que ofrece y márquelo «El banco ofrece este crédito».'] }],
    consejos:['Las condiciones de partida son de referencia: confírmelas con cada banco antes de emitir conceptos.', '«Marcar condiciones al día» guarda la fecha de hoy cuando verificó que nada cambió.'],
    cuidado:['El programa avisa cuando un banco tiene condiciones de más de 45 días.'] },

  { id:'05', ic:'concepto', lema:'El concepto de viabilidad, con el porqué de cada cifra',
    para:'Analiza una opción (banco y crédito) y redacta el concepto: la solicitud, el dictamen, la capacidad de pago y el monto, las condiciones que cumple y las que no, las observaciones, lo que falta por confirmar, las recomendaciones y el alcance del concepto. «Emitir concepto» lo guarda con número consecutivo y descarga el PDF.',
    quien:'Analistas y dirección comercial.',
    pestanas:[['Dictamen y cifras', 'Monto aprobable, cuota, cuota/ingreso o cobertura, y tasa.'], ['Concepto de viabilidad', 'El texto completo, tal como sale en el PDF.'], ['Condiciones evaluadas', 'Cada condición con el valor del cliente, lo exigido por el banco y el detalle.'], ['Conceptos emitidos', 'El historial del cliente, con su PDF.']],
    tareas:[
      { t:'Emitir el concepto de viabilidad', pasos:['Elija el banco y el crédito en «Banco y crédito analizados».', 'Lea el dictamen y las condiciones evaluadas.', 'Pulse «Vista previa PDF» para revisarlo.', 'Pulse «Emitir concepto».'], res:'Un concepto con número CV-aaaammdd-0001, guardado con las cifras y el perfil de ese día, y su PDF.' },
      { t:'Entender por qué un cliente no es viable', pasos:['Busque en «Condiciones evaluadas» las filas con ✕.', 'Las marcadas «determinante» no se arreglan bajando el monto (edad, reportes, gravámenes, licencia…).', 'Lea las «Recomendaciones» del concepto.'] }],
    consejos:['«Viable con monto ajustado» trae el monto máximo y su cuota: es la contraoferta para el cliente.'],
    cuidado:['El concepto es preliminar: la decisión es del banco después de su estudio, el avalúo y el estudio de títulos.'] },

  { id:'06', ic:'creditos', lema:'Qué crédito puede pedir cada cliente y con qué papeles',
    para:'El catálogo del programa: los siete tipos de cliente, los créditos que aplican a cada uno (hipotecario, leasing habitacional, compra de cartera, lote, remodelación, libre inversión con garantía, crédito constructor, leasing inmobiliario y capital de trabajo) y los documentos que pide cada combinación, con su vigencia y los datos que el programa lee de cada uno.',
    quien:'Asesores, para orientar al cliente desde la primera reunión.',
    pestanas:[['Tipos de cliente', 'Chips para elegir el tipo.'], ['Créditos', 'Los créditos que aplican y cuántos bancos los ofrecen.'], ['Documentos necesarios', 'La lista por grupo, con vigencia y los datos que se leen.']],
    tareas:[
      { t:'Entregarle al cliente la lista de documentos', pasos:['Elija el tipo de cliente y el crédito.', 'Pulse «Lista de documentos en PDF».', 'Envíe el PDF al cliente.'] }],
    consejos:['Si abre el módulo con un cliente activo, arranca con su tipo y su crédito.'], cuidado:[] },

  { id:'07', ic:'simulador', lema:'La cuota antes de pedir los papeles',
    para:'Calcula la cuota fija (sistema francés en pesos) de un monto, tasa efectiva anual, plazo y seguros; muestra la tasa mensual equivalente, los intereses totales, la tabla de amortización por año y la verificación frente a la Ley 546: primera cuota hasta el 30 % del ingreso, financiación del 70 % u 80 % y plazo de 5 a 30 años.',
    quien:'Asesores y clientes, en la primera reunión.',
    pestanas:[['Datos', 'Monto, tasa, plazo, seguros, ingreso y valor del inmueble.'], ['Resultado', 'Primera cuota, tasa mensual, intereses y total pagado.'], ['Ley 546', 'Cuota/ingreso, financiación y plazo, con el ingreso necesario si no alcanza.'], ['Amortización', 'Tabla por año; el PDF trae la tabla mes a mes.']],
    tareas:[
      { t:'Simular un crédito', pasos:['Escriba monto, tasa, plazo y seguros.', 'Escriba el ingreso y el valor del inmueble para ver la verificación de la Ley 546.', 'Pulse «Calcular».', 'Pulse «Tabla en PDF» para entregarla.'] }],
    consejos:['Con un cliente abierto, «Usar los datos del cliente» trae su monto, plazo, ingreso y valor del inmueble.'], cuidado:['La simulación no es una oferta del banco.'] },

  { id:'adm', ic:'admin', lema:'Usuarios, auditoría y respaldos',
    para:'Crea usuarios con sus roles (administrador, director comercial, analista, asesor y consulta), muestra la auditoría de todo lo que se hace, descarga y restaura respaldos, guarda el registro técnico y carga o borra la demostración.',
    quien:'Administrador.',
    pestanas:[['Usuarios y roles', 'Usuarios y la matriz de qué puede hacer cada rol.'], ['Auditoría', 'Cada acción con fecha, usuario y cliente; se exporta a Excel.'], ['Respaldos', 'Descargar y restaurar el .zip con todos los datos y archivos.'], ['Registro técnico', 'Errores de la sesión, para soporte.'], ['Demostración', 'Cargar y borrar los clientes ficticios.']],
    tareas:[
      { t:'Crear un usuario', pasos:['Pulse «+ Usuario».', 'Escriba usuario, nombre y cargo, y marque sus roles.', 'Escriba una contraseña inicial de 8 caracteres o más: la cambiará al ingresar.'] },
      { t:'Descargar un respaldo', pasos:['Entre a «Respaldos».', 'Pulse «Descargar respaldo completo».', 'Guarde el .zip fuera del equipo.'], res:'Un respaldo con clientes, documentos, conceptos, bancos, usuarios y auditoría, verificado con huellas SHA-256.' }],
    consejos:['Descargue un respaldo cada semana: los datos viven en este navegador.'], cuidado:['Restaurar reemplaza todos los datos del equipo; el programa pide escribir REEMPLAZAR.'] },

  { id:'cfg', ic:'config', lema:'Empresa, apariencia y parámetros normativos',
    para:'Guarda los datos y el logo de la empresa (salen en los PDF), la apariencia de la familia ARKEN 360 (tema claro u oscuro, densidad, colores y fuente), los parámetros normativos (SMMLV, topes VIS y VIP, límites de la Ley 546, plazos de vivienda, tolerancias) y el tiempo de cierre de sesión por inactividad.',
    quien:'Administrador y director.',
    pestanas:[['Empresa', 'Razón social, NIT, contacto y logo.'], ['Apariencia', 'Tema, densidad, colores, fuente y escala del logo.'], ['Parámetros', 'SMMLV y topes normativos.'], ['Programa', 'Minutos de inactividad.']],
    tareas:[
      { t:'Actualizar el SMMLV del año', pasos:['Entre a «Parámetros».', 'Escriba el salario mínimo y el año.', 'Pulse «Guardar».'], res:'El tope VIS (150 SMMLV) y el ingreso mínimo de cada banco se recalculan.' }],
    consejos:['Actualice el SMMLV cada enero.'], cuidado:[] }
];

/* ═══════════════════ Rutas de trabajo ═══════════════════ */
const RUTAS_TRABAJO = [
  { id:'marcha', t:'Poner en marcha el programa', d:'Lo que se hace una sola vez, antes del primer cliente.', pasos:[
    ['cfg', 'Registre la empresa y su logo en Configuración › Empresa.'], ['cfg', 'Revise el SMMLV y los parámetros en Configuración › Parámetros.'],
    ['adm', 'Cree los usuarios con sus roles.'], ['04', 'Confirme con cada banco sus condiciones y actualícelas en «Condiciones por banco».']] },
  { id:'vivienda', t:'Estudiar un crédito de vivienda', d:'De la primera reunión al concepto para el banco.', pasos:[
    ['07', 'Simule la cuota con el cliente y verifique la Ley 546.'], ['01', 'Cree el cliente con su tipo.'], ['02', 'Elija hipotecario o leasing habitacional y registre la operación.'],
    ['06', 'Entréguele la lista de documentos en PDF.'], ['03', 'Cargue y lea los documentos; revise los datos y páselos al perfil.'], ['03', 'Atienda las alertas de coherencia y los documentos vencidos.'],
    ['04', 'Compare las opciones en todos los bancos.'], ['05', 'Emita el concepto de la mejor opción y radique.'], ['02', 'Cambie el estado a «Radicado en el banco».']] },
  { id:'constructor', t:'Estudiar un crédito constructor', d:'Para la constructora que financia su proyecto contra preventas.', pasos:[
    ['01', 'Cree el cliente como «Empresa constructora o promotora».'], ['02', 'Registre el proyecto: costo, lote, ventas, unidades, preventas, aporte, licencia y fiducia.'],
    ['03', 'Cargue estados financieros, renta, presupuesto, flujo de caja, licencia, certificación de preventas y fiducia.'], ['04', 'Compare preventas, financiación del costo, cobertura y margen en cada banco.'],
    ['05', 'Emita el concepto y radíquelo con el banco elegido.']] },
  { id:'cartera', t:'Revisar la cartera cada semana', d:'Saber qué clientes están listos y qué falta.', pasos:[
    ['00', 'Mire los clientes por dictamen y los documentos pendientes.'], ['01', 'Filtre «Documentación: con vencidos» y pida los documentos nuevos.'],
    ['01', 'Filtre «Viable en el banco» para preparar las radicaciones de la semana.'], ['01', 'Descargue el «Informe PDF de la selección» para el comité.'], ['adm', 'Descargue un respaldo.']] }
];
const PRIMEROS_PASOS = [
  ['cfg', 'Registre su empresa', 'Razón social, NIT y logo para los PDF.'], ['adm', 'Cree los usuarios', 'Cada persona con su rol.'],
  ['04', 'Actualice los bancos', 'Tasas y condiciones vigentes.'], ['01', 'Cree el cliente', 'Con su tipo: así sabe qué créditos aplican.'],
  ['03', 'Cargue sus documentos', 'El programa los lee y los cruza.'], ['05', 'Emita el concepto', 'Con el porqué de cada cifra.']
];

/* ═══════════════════ Preguntas frecuentes y glosario ═══════════════════
   { q: pregunta o término, a: respuesta en HTML breve }. */
const AYUDA_CONTENIDO = {
  inicio:[
    { q:'¿Por dónde empiezo?', a:'<p>Si es la primera vez, cargue la demostración desde el <b>Tablero</b>: crea seis clientes ficticios con documentos de ejemplo ya leídos. Para trabajar con clientes reales: Configuración › Empresa, luego <b>04 · Bancos</b> para actualizar condiciones y después <b>01 · Clientes</b> › «+ Nuevo cliente».</p>' },
    { q:'¿Necesito internet?', a:'<p>No. ARKEN BANK es un solo archivo HTML que funciona abierto desde el disco. La lectura de PDF y el reconocimiento de texto (OCR) viajan dentro del programa. Ningún dato sale del equipo.</p>' },
    { q:'¿Dónde se guardan los datos?', a:'<p>En el almacenamiento del navegador de este equipo (IndexedDB). Cada cambio se guarda solo. Para llevarlos a otro equipo o protegerlos, descargue un respaldo en <b>Administración › Respaldos</b>.</p>' },
    { q:'¿Qué es el «cliente abierto»?', a:'<p>El cliente sobre el que trabajan los módulos 02, 03 y 05. Su nombre aparece en la barra superior. Se abre desde la lista de clientes o desde cualquier botón «Abrir».</p>' }
  ],
  clientes:[
    { q:'¿Qué tipos de cliente maneja el programa?', a:'<p>Asalariado, independiente, rentista de capital, pensionado, colombiano residente en el exterior, persona jurídica (empresa) y empresa constructora o promotora. El tipo decide los créditos que aplican, los documentos y la forma de medir la capacidad de pago.</p>' },
    { q:'¿Qué filtra «Viable en el banco»?', a:'<p>Deja los clientes cuya mejor opción en ese banco es viable, viable con condiciones o viable con monto ajustado.</p>' },
    { q:'¿Qué significa cada color de la matriz de viabilidad?', a:'<p>Verde: viable. Latón: viable con condiciones. Ámbar: monto ajustado. Azul: falta información. Rojo: no viable. Gris: el banco no ofrece ese crédito.</p>' },
    { q:'¿Puedo exportar la cartera?', a:'<p>Sí: «Exportar a Excel» descarga un CSV (separado por punto y coma, se abre en Excel) y «Informe PDF de la selección» un informe horizontal. Ambos respetan los filtros activos.</p>' }
  ],
  documentos:[
    { q:'¿Qué documentos lee el programa?', a:'<p>Certificado laboral, desprendibles, extractos, declaración de renta, certificado de ingresos y retenciones, certificación de contador, resolución de pensión, contratos de arrendamiento, reporte de centrales, cámara de comercio, RUT, estados financieros, certificado de tradición, avalúo, promesa de compraventa, presupuesto y flujo de caja del proyecto, licencia de construcción, certificación de preventas y fiducia, entre otros. Cada tipo dice en el módulo 06 qué datos se le leen.</p>' },
    { q:'¿Qué tan preciso es el lector?', a:'<p>En un PDF generado por computador el texto se extrae tal cual, sin errores. El lector busca cada dato por su etiqueta («salario», «total activo», «fecha de expedición»…) y lo guarda con la página y el texto literal, para que usted lo compare. En fotos y escaneos usa OCR en español: compare las cifras con la evidencia antes de pasarlas al perfil.</p>' },
    { q:'¿Por qué un documento sale «Vencido»?', a:'<p>Cada documento tiene una vigencia (por ejemplo, 30 días el certificado laboral y el de tradición, 90 los desprendibles). Se cuenta desde la fecha de expedición, que el lector toma del documento o que usted corrige con «Fecha».</p>' },
    { q:'¿Qué revisa la coherencia entre documentos?', a:'<p>Que el salario del certificado laboral coincida con los desprendibles y con el perfil; que los abonos de los extractos respalden el ingreso; que el ingreso de la renta corresponda al de un independiente; que la cédula sea la misma en todos los documentos; que activo = pasivo + patrimonio; y que las preventas certificadas coincidan con el proyecto.</p>' },
    { q:'Cargué un documento en la fila equivocada, ¿qué hago?', a:'<p>El lector avisa cuando el contenido parece otro documento. Pulse «Fecha» en el archivo y cambie el tipo.</p>' }
  ],
  viabilidad:[
    { q:'¿Cómo decide el programa el dictamen?', a:'<p>Evalúa cada condición del banco con los datos del cliente. Si una condición determinante no se cumple (edad, reportes negativos, gravámenes graves, licencia…), el dictamen es <b>No viable</b>. Si lo que no se cumple se arregla con menos monto, es <b>Viable con monto ajustado</b>, con el monto máximo. Si hay observaciones o datos por confirmar, <b>Viable con condiciones</b>. Si todo se cumple, <b>Viable</b>.</p>' },
    { q:'¿Cómo calcula el monto aprobable de una persona natural?', a:'<p>Toma el menor de dos montos: el que permite la capacidad de pago (la cuota disponible es la menor entre el tope de cuota/ingreso y el endeudamiento total menos las cuotas actuales) y el que permite la garantía (porcentaje de financiación del banco y de la Ley 546 sobre el valor del inmueble). El plazo se limita por la edad máxima al terminar.</p>' },
    { q:'¿Y en el crédito constructor?', a:'<p>Mide preventas frente al punto de equilibrio, financiación del costo del proyecto, aporte propio, margen, cobertura de las ventas sobre el crédito, licencia, fiducia, experiencia y los indicadores de la empresa (razón corriente, endeudamiento, años de constitución).</p>' },
    { q:'¿El concepto es una aprobación?', a:'<p>No. Es un concepto preliminar con la información aportada y las condiciones registradas del banco. La aprobación es del banco después de su estudio, el avalúo y el estudio de títulos.</p>' }
  ],
  bancos:[
    { q:'¿De dónde salen las condiciones de los bancos?', a:'<p>El programa trae condiciones de referencia de diez bancos colombianos para arrancar. Tasas y políticas cambian cada mes: confírmelas con cada banco y actualícelas en <b>04 · Bancos › Condiciones por banco</b>. La fecha de actualización sale en cada concepto.</p>' },
    { q:'¿Puedo agregar cooperativas o fondos de empleados?', a:'<p>Sí: «+ Banco» crea una entidad nueva; luego edite cada crédito que ofrece.</p>' },
    { q:'¿Qué pasa si marco un banco inactivo?', a:'<p>Deja de aparecer en las opciones, la matriz y los filtros. Los conceptos ya emitidos no cambian.</p>' }
  ],
  normas:[
    { q:'¿Qué exige la Ley 546 de 1999 para vivienda?', a:'<p>Plazo entre 5 y 30 años; la primera cuota no puede superar el 30 % de los ingresos familiares; la financiación llega hasta el 80 % del valor del inmueble en vivienda de interés social y hasta el 70 % en las demás. Los bancos pueden exigir más.</p>' },
    { q:'¿Qué es VIS y cuál es su tope?', a:'<p>Vivienda de interés social: la que no supera 150 salarios mínimos mensuales (90 en la VIP). El tope se recalcula con el SMMLV de Configuración › Parámetros.</p>' },
    { q:'¿En qué se diferencian hipotecario y leasing habitacional?', a:'<p>En el hipotecario el cliente es dueño desde la escritura y el banco tiene la hipoteca. En el leasing el banco compra el inmueble, se lo entrega en arriendo financiero y el cliente queda como dueño al ejercer la opción de compra.</p>' }
  ],
  roles:[
    { q:'¿Qué puede hacer cada rol?', a:'<p>La matriz completa está en <b>Administración › Usuarios y roles</b>. En resumen: el asesor crea clientes y carga documentos; el analista además lee, analiza y emite conceptos; el director también mantiene bancos y parámetros; el administrador maneja usuarios y respaldos; consulta solo ve y exporta.</p>' },
    { q:'¿Cómo llevo los datos a otro equipo?', a:'<p>Descargue un respaldo en Administración › Respaldos y restáurelo en el otro equipo. El respaldo trae los archivos de los documentos y un manifiesto con sus huellas SHA-256.</p>' },
    { q:'¿Se puede borrar la auditoría?', a:'<p>No. La auditoría solo agrega registros.</p>' }
  ],
  glosario:[
    { q:'Amortización', a:'Pago gradual de una deuda: cada cuota abona a capital y paga intereses.' },
    { q:'Capacidad de pago', a:'La cuota que el cliente puede pagar según sus ingresos, sus deudas y los límites del banco.' },
    { q:'Compra de cartera', a:'Traslado de un crédito a otro banco para mejorar la tasa, el plazo o la cuota.' },
    { q:'Codeudor', a:'Persona que firma el crédito con el titular y responde por él; su ingreso puede sumarse.' },
    { q:'Concepto de viabilidad', a:'Documento que dice si una solicitud cumple las condiciones de un banco, con sus cifras y su porqué.' },
    { q:'Crédito constructor', a:'Financiación de la construcción de un proyecto, desembolsada por avance de obra y pagada con la subrogación o las ventas.' },
    { q:'Cuota/ingreso', a:'La cuota del crédito dividida por el ingreso. En vivienda no puede superar el 30 % (Ley 546).' },
    { q:'DSCR', a:'Cobertura del servicio de la deuda: utilidad operacional dividida por las cuotas anuales de todas las deudas.' },
    { q:'Endeudamiento', a:'En personas, la suma de las cuotas frente al ingreso; en empresas, el pasivo total frente al activo total.' },
    { q:'Estudio de títulos', a:'Revisión jurídica de la tradición del inmueble que hace el banco antes de aprobar la garantía.' },
    { q:'Fiducia', a:'Encargo fiduciario en el que se manejan los recursos de las preventas de un proyecto.' },
    { q:'Gravamen', a:'Limitación del inmueble registrada en el certificado de tradición: hipoteca, embargo, patrimonio de familia, afectación a vivienda familiar…' },
    { q:'Leasing habitacional', a:'Arriendo financiero de una vivienda con opción de compra al final.' },
    { q:'Ley 546 de 1999', a:'Ley de vivienda: plazos, límite de la primera cuota frente al ingreso y porcentajes de financiación.' },
    { q:'OCR', a:'Reconocimiento óptico de caracteres: convierte una imagen o un escaneo en texto.' },
    { q:'Opción de compra', a:'Valor que paga el cliente de un leasing al final para quedarse con el bien.' },
    { q:'Preventas', a:'Unidades de un proyecto vendidas antes de construir; el banco exige un mínimo (punto de equilibrio).' },
    { q:'Puntaje de crédito', a:'Calificación de las centrales de riesgo (DataCrédito, TransUnion) sobre el hábito de pago.' },
    { q:'Razón corriente', a:'Activo corriente dividido por pasivo corriente: liquidez de la empresa.' },
    { q:'SMMLV', a:'Salario mínimo mensual legal vigente.' },
    { q:'Subrogación', a:'Cuando el comprador de una unidad toma su parte del crédito constructor como su crédito de vivienda.' },
    { q:'Tasa E.A.', a:'Tasa efectiva anual. La mensual equivalente es (1 + E.A.)^(1/12) − 1.' },
    { q:'VIS / VIP', a:'Vivienda de interés social (hasta 150 SMMLV) y prioritaria (hasta 90 SMMLV).' }
  ]
};

/* ═══════════════════ Funciones del centro de ayuda ═══════════════════ */
function guiaPorId(id){ return GUIAS_MODULO.find(g => g.id === id); }
function nombreGuia(id){ if (id === 'adm') return 'Administración'; if (id === 'cfg') return 'Configuración'; const m = MODULOS.find(x => x.id === id); return m ? m.nombre : id; }
function cortoGuia(id){ if (id === 'adm') return 'Administración'; if (id === 'cfg') return 'Configuración'; const m = MODULOS.find(x => x.id === id); return m ? m.corto : id; }
function etiquetaGuia(id){ return id === 'adm' ? 'ADMINISTRACIÓN' : id === 'cfg' ? 'CONFIGURACIÓN' : 'MÓDULO ' + id; }
function numGuia(id){ return id === 'adm' ? 'ADM' : id === 'cfg' ? 'CFG' : id; }
function irDesdeAyuda(id){ App.ir(id === 'adm' ? 'admin' : id === 'cfg' ? 'config' : id); }
function abrirGuia(id, tarea){ Sesion.tab16 = 'guias'; Sesion.guia16 = id; Sesion.tarea16 = tarea === undefined ? null : tarea; Sesion.q16 = ''; if (Sesion.modulo !== '16') App.ir('16'); else App.render(); }

function normAy(s){ return [...String(s || '')].map(c => (c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() || c)[0]).join(''); }
function resaltarAy(texto, terms, max){
  let t = String(texto || '').replace(/[«»]/g, '"');
  const n = normAy(t);
  if (max && t.length > max){
    let i = -1; terms.some(w => (i = n.indexOf(w)) >= 0);
    const ini = Math.max(0, i - Math.round(max / 3));
    t = (ini ? '…' : '') + t.slice(ini, ini + max) + (ini + max < texto.length ? '…' : '');
    return resaltarAy(t, terms, 0);
  }
  const marcas = new Array(t.length).fill(false);
  terms.forEach(w => { if (!w) return; let i = n.indexOf(w); while (i >= 0){ for (let k = i; k < i + w.length; k++) marcas[k] = true; i = n.indexOf(w, i + w.length); } });
  let out = '', dentro = false;
  for (let k = 0; k < t.length; k++){
    if (marcas[k] && !dentro){ out += '<mark>'; dentro = true; }
    if (!marcas[k] && dentro){ out += '</mark>'; dentro = false; }
    out += esc(t[k]);
  }
  return out + (dentro ? '</mark>' : '');
}
function textoPlanoAy(html){ return String(html || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim(); }
const PALABRAS_VACIAS_AY = ['de','la','el','en','y','a','los','las','del','un','una','por','con','para','que','al','se','lo','como','o','mi','su','sus','es'];
function buscarEnAyuda(q){
  const terms = normAy(q).split(/\s+/).filter(w => w.length > 1 && PALABRAS_VACIAS_AY.indexOf(w) < 0);
  const R = { terms, guias:[], tareas:[], rutas:[], faq:[], glos:[] };
  if (!terms.length) return R;
  const cumple = txt => { const n = normAy(txt); return terms.every(w => n.indexOf(w) >= 0); };
  GUIAS_MODULO.forEach(g => {
    if (cumple(nombreGuia(g.id) + ' ' + g.lema + ' ' + g.para + ' ' + g.pestanas.map(p => p.join(' ')).join(' '))) R.guias.push(g);
    g.tareas.forEach((t, i) => { if (cumple(t.t + ' ' + t.pasos.join(' ') + ' ' + (t.res || ''))) R.tareas.push({ g, i, t }); });
  });
  RUTAS_TRABAJO.forEach(r => { if (cumple(r.t + ' ' + r.d + ' ' + r.pasos.map(p => p[1]).join(' '))) R.rutas.push(r); });
  FAQ_CATEGORIAS.forEach(c => (AYUDA_CONTENIDO[c.k] || []).forEach(x => { const plano = textoPlanoAy(x.a); if (cumple(x.q + ' ' + plano)) R.faq.push({ c, x, plano }); }));
  AYUDA_CONTENIDO.glosario.forEach(x => { if (cumple(x.q + ' ' + x.a)) R.glos.push({ x, plano:x.a }); });
  return R;
}
function htmlResultadosAyuda(q){
  const R = buscarEnAyuda(q);
  const total = R.guias.length + R.tareas.length + R.rutas.length + R.faq.length + R.glos.length;
  if (!total) return '<div class="ay-vacio">' + iconoAyuda('lupa', 'ay-ic xl') + '<h3>Sin resultados para «' + esc(q) + '»</h3><p>Pruebe con una palabra más corta o más general: «leasing», «vencido», «cuota», «constructor».</p></div>';
  const grupo = (tit, n, html) => n ? '<section class="ay-rgrupo"><h3>' + esc(tit) + ' <span>' + n + '</span></h3>' + html + '</section>' : '';
  return '<div class="ay-rtotal">' + total + ' resultado' + (total === 1 ? '' : 's') + ' para «' + esc(q) + '»</div>' +
    grupo('Cómo hacerlo, paso a paso', R.tareas.length, R.tareas.slice(0, 30).map(r => '<button class="ay-res" data-ayg="' + r.g.id + '" data-ayt="' + r.i + '" type="button">' + iconoAyuda(r.g.ic) +
      '<span class="ay-res-c"><span class="ay-res-e">' + etiquetaGuia(r.g.id) + ' · ' + esc(cortoGuia(r.g.id)) + '</span><b>' + resaltarAy(r.t.t, R.terms) + '</b><span class="ay-res-s">' + resaltarAy(r.t.pasos.join(' '), R.terms, 180) + '</span></span></button>').join('')) +
    grupo('Guías de módulo', R.guias.length, R.guias.map(g => '<button class="ay-res" data-ayg="' + g.id + '" type="button">' + iconoAyuda(g.ic) +
      '<span class="ay-res-c"><span class="ay-res-e">' + etiquetaGuia(g.id) + '</span><b>' + resaltarAy(nombreGuia(g.id), R.terms) + '</b><span class="ay-res-s">' + resaltarAy(g.para, R.terms, 180) + '</span></span></button>').join('')) +
    grupo('Rutas de trabajo', R.rutas.length, R.rutas.map(r => '<button class="ay-res" data-ayr="' + r.id + '" type="button">' + iconoAyuda('ruta') +
      '<span class="ay-res-c"><span class="ay-res-e">RUTA · ' + r.pasos.length + ' PASOS</span><b>' + resaltarAy(r.t, R.terms) + '</b><span class="ay-res-s">' + resaltarAy(r.d, R.terms) + '</span></span></button>').join('')) +
    grupo('Preguntas frecuentes', R.faq.length, R.faq.slice(0, 30).map(r => '<details class="ay-item"><summary>' + resaltarAy(r.x.q, R.terms) + '<span class="ay-cat">' + esc(r.c.n) + '</span></summary><div class="ay-body">' + r.x.a + '</div></details>').join('')) +
    grupo('Glosario', R.glos.length, '<div class="ay-glos-grid">' + R.glos.map(r => '<div class="ay-term"><div class="ay-term-t">' + resaltarAy(r.x.q, R.terms) + '</div><div class="ay-term-d">' + resaltarAy(r.plano, R.terms) + '</div></div>').join('') + '</div>');
}
function conectarEnlacesAyuda(cont){
  $$('[data-ayg]', cont).forEach(b => b.onclick = () => abrirGuia(b.dataset.ayg, b.dataset.ayt !== undefined && b.dataset.ayt !== '' ? Number(b.dataset.ayt) : null));
  $$('[data-ayr]', cont).forEach(b => b.onclick = () => { Sesion.tab16 = 'rutas'; Sesion.ruta16 = b.dataset.ayr; Sesion.q16 = ''; App.render(); });
  $$('[data-ayir]', cont).forEach(b => b.onclick = e => { e.stopPropagation(); irDesdeAyuda(b.dataset.ayir); });
}

function tarjetaGuiaHTML(g){
  return '<button class="ay-mod" data-ayg="' + g.id + '" type="button"><span class="ay-mod-n">' + numGuia(g.id) + '</span>' + iconoAyuda(g.ic, 'ay-ic lg') +
    '<span class="ay-mod-t">' + esc(nombreGuia(g.id)) + '</span><span class="ay-mod-l">' + esc(g.lema) + '</span><span class="ay-mod-f">' + g.tareas.length + ' tareas guiadas  →</span></button>';
}
function htmlInicioAyuda(){
  return '<section class="ay-sec"><div class="ay-sec-h"><div><div class="ay-eb">Para empezar</div><h3>Primeros pasos</h3></div><p>El orden recomendado para quien abre ARKEN BANK por primera vez.</p></div>' +
      '<div class="ay-pasos6">' + PRIMEROS_PASOS.map((p, i) => '<button class="ay-paso" data-ayg="' + p[0] + '" type="button"><span class="ay-paso-n">' + (i + 1) + '</span><span class="ay-paso-t">' + esc(p[1]) + '</span><span class="ay-paso-d">' + esc(p[2]) + '</span><span class="ay-paso-m">' + esc(cortoGuia(p[0])) + '</span></button>').join('') + '</div></section>' +
    '<section class="ay-sec"><div class="ay-sec-h"><div><div class="ay-eb">Procesos completos</div><h3>Rutas de trabajo</h3></div><p>Cada ruta recorre, en orden, los módulos que intervienen en un estudio de crédito real.</p></div>' +
      '<div class="ay-rutas-g">' + RUTAS_TRABAJO.map((r, i) => '<button class="ay-ruta-c" data-ayr="' + r.id + '" type="button"><span class="ay-ruta-n">' + String(i + 1).padStart(2, '0') + '</span><span class="ay-ruta-t">' + esc(r.t) + '</span><span class="ay-ruta-d">' + esc(r.d) + '</span>' +
        '<span class="ay-ruta-m">' + [...new Set(r.pasos.map(p => p[0]))].map(id => '<i>' + numGuia(id) + '</i>').join('') + '</span></button>').join('') + '</div></section>' +
    '<section class="ay-sec"><div class="ay-sec-h"><div><div class="ay-eb">Módulo por módulo</div><h3>Guías del sistema</h3></div><p>Para qué sirve cada módulo, qué hay en cada pestaña y cómo se hace cada tarea.</p></div>' +
      '<div class="ay-mods">' + GUIAS_MODULO.map(tarjetaGuiaHTML).join('') + '</div></section>' +
    '<section class="ay-banda"><div class="ay-banda-t">' + iconoAyuda('libro', 'ay-ic lg') + '<div><b>Manual de usuario</b><span>Todo este centro de ayuda en un documento con portada, índice, rutas de trabajo, guías y glosario, listo para imprimir o compartir.</span></div></div>' +
      '<button class="btn brass" data-accion="ay-manual" type="button">Manual de usuario (PDF)</button></section>';
}
function faqRelacionadas(id){
  const out = [], vistos = new Set();
  (FAQ_POR_MODULO[id] || []).forEach(k => (AYUDA_CONTENIDO[k] || []).forEach(x => { if (!vistos.has(x.q)){ vistos.add(x.q); out.push(x); } }));
  return out.slice(0, 10);
}
function htmlGuiaAyuda(){
  const id = guiaPorId(Sesion.guia16) ? Sesion.guia16 : '00';
  const g = guiaPorId(id), i = GUIAS_MODULO.indexOf(g), ant = GUIAS_MODULO[i - 1], sig = GUIAS_MODULO[i + 1];
  const rel = faqRelacionadas(id), abierta = Sesion.tarea16;
  return '<div class="ay-guia"><nav class="ay-gnav">' + GUIAS_MODULO.map(x => '<button class="ay-gnav-b' + (x.id === id ? ' on' : '') + '" data-ayg="' + x.id + '" type="button"><span>' + numGuia(x.id) + '</span>' + esc(cortoGuia(x.id)) + '</button>').join('') + '</nav>' +
    '<article class="ay-gdoc"><header class="ay-ghead">' + iconoAyuda(g.ic, 'ay-ic xl') + '<div class="ay-ghead-c"><div class="ay-eb">' + etiquetaGuia(id) + '</div><h2>' + esc(nombreGuia(id)) + '</h2><p>' + esc(g.lema) + '</p></div>' +
      '<div class="ay-ghead-a"><button class="btn brass" data-ayir="' + id + '" type="button">' + (id === 'adm' ? 'Abrir administración' : id === 'cfg' ? 'Abrir configuración' : 'Ir al módulo') + '</button><button class="btn" data-accion="ay-guia-pdf" data-g="' + id + '" type="button">PDF de esta guía</button></div></header>' +
    '<section class="ay-para"><div><div class="ay-eb">Para qué sirve</div><p>' + fmtAy(g.para) + '</p></div><div class="ay-quien"><div class="ay-eb">Quién lo usa</div><p>' + esc(g.quien) + '</p></div></section>' +
    '<section class="ay-gsec"><h3>' + (g.pestanas.length > 1 ? 'Sus ' + g.pestanas.length + ' partes' : 'Lo que encuentra') + '</h3><div class="ay-pests">' + g.pestanas.map((p, k) => '<div class="ay-pest"><span class="ay-pest-n">' + String(k + 1).padStart(2, '0') + '</span><b>' + esc(p[0]) + '</b><span>' + fmtAy(p[1]) + '</span></div>').join('') + '</div></section>' +
    '<section class="ay-gsec"><h3>Paso a paso</h3><div class="ay-tareas">' + g.tareas.map((t, k) => '<details class="ay-tarea" data-k="' + k + '"' + (abierta === k || ((abierta === null || abierta === undefined) && k === 0) ? ' open' : '') + '><summary><span class="ay-tarea-n">' + (k + 1) + '</span><span class="ay-tarea-t">' + esc(t.t) + '</span><span class="ay-tarea-c">' + t.pasos.length + ' pasos</span></summary>' +
      '<ol class="ay-pasos">' + t.pasos.map(s => '<li>' + fmtAy(s) + '</li>').join('') + '</ol>' + (t.res ? '<div class="ay-res-final"><b>Resultado</b>' + fmtAy(t.res) + '</div>' : '') + '</details>').join('') + '</div></section>' +
    (g.consejos.length || g.cuidado.length ? '<section class="ay-dos">' + (g.consejos.length ? '<div class="ay-consejo"><div class="ay-eb">Consejos</div><ul>' + g.consejos.map(c => '<li>' + fmtAy(c) + '</li>').join('') + '</ul></div>' : '') +
      (g.cuidado.length ? '<div class="ay-cuidado"><div class="ay-eb">Atención</div><ul>' + g.cuidado.map(c => '<li>' + fmtAy(c) + '</li>').join('') + '</ul></div>' : '') + '</section>' : '') +
    (rel.length ? '<section class="ay-gsec"><h3>Preguntas relacionadas</h3><div class="ay-faq-l">' + rel.map(x => '<details class="ay-item"><summary>' + esc(x.q) + '</summary><div class="ay-body">' + x.a + '</div></details>').join('') + '</div></section>' : '') +
    '<nav class="ay-gpie">' + (ant ? '<button class="ay-gpie-b" data-ayg="' + ant.id + '" type="button"><span>← Anterior</span>' + esc(nombreGuia(ant.id)) + '</button>' : '<span></span>') +
      (sig ? '<button class="ay-gpie-b der" data-ayg="' + sig.id + '" type="button"><span>Siguiente →</span>' + esc(nombreGuia(sig.id)) + '</button>' : '<span></span>') + '</nav></article></div>';
}
function htmlRutasAyuda(){
  return '<div class="ay-rutas">' + RUTAS_TRABAJO.map((r, i) => '<section class="ay-ruta' + (r.id === Sesion.ruta16 ? ' on' : '') + '" id="ayRuta_' + r.id + '"><header><span class="ay-ruta-n">' + String(i + 1).padStart(2, '0') + '</span><div><h3>' + esc(r.t) + '</h3><p>' + esc(r.d) + '</p></div></header>' +
    '<ol class="ay-linea">' + r.pasos.map(p => '<li><button class="ay-linea-m" data-ayg="' + p[0] + '" type="button" title="Ver la guía">' + numGuia(p[0]) + '</button><div class="ay-linea-c"><span class="ay-linea-mod">' + esc(nombreGuia(p[0])) + '</span>' + fmtAy(p[1]) + '</div>' +
      '<button class="ay-ir" data-ayir="' + p[0] + '" type="button">Ir →</button></li>').join('') + '</ol></section>').join('') + '</div>';
}
function htmlFaqAyuda(){
  const cat = FAQ_CATEGORIAS.some(c => c.k === Sesion.faq16) ? Sesion.faq16 : 'inicio';
  return '<div class="ay-faq"><nav class="ay-faq-cats">' + FAQ_CATEGORIAS.map(c => '<button class="ay-faq-cat' + (c.k === cat ? ' on' : '') + '" data-accion="ay-faq-cat" data-c="' + c.k + '" type="button">' + esc(c.n) + '<span>' + (AYUDA_CONTENIDO[c.k] || []).length + '</span></button>').join('') + '</nav>' +
    '<div class="ay-faq-c"><div class="ay-faq-h"><h3>' + esc(FAQ_CATEGORIAS.find(c => c.k === cat).n) + '</h3><button class="btn sm ghost" data-accion="ay-abrir-todo" type="button">Abrir todas</button></div>' +
    '<div class="ay-faq-l">' + (AYUDA_CONTENIDO[cat] || []).map(x => '<details class="ay-item"><summary>' + esc(x.q) + '</summary><div class="ay-body">' + x.a + '</div></details>').join('') + '</div></div></div>';
}
function htmlGlosarioAyuda(){
  const lista = AYUDA_CONTENIDO.glosario.map(x => ({ q:x.q, d:x.a, l:normAy(x.q).charAt(0).toUpperCase() })).sort((a, b) => a.q.localeCompare(b.q, 'es'));
  const letras = [...new Set(lista.map(x => x.l))];
  return '<div class="ay-glos"><div class="ay-glos-bar"><div class="ay-letras">' + letras.map(l => '<button data-ayl="' + l + '" type="button">' + l + '</button>').join('') + '</div><input id="ayGlosF" type="search" placeholder="Filtrar términos…" aria-label="Filtrar términos"></div>' +
    letras.map(l => '<section class="ay-glos-sec" id="ayL_' + l + '"><div class="ay-glos-l">' + l + '</div><div class="ay-glos-grid">' +
      lista.filter(x => x.l === l).map(x => '<div class="ay-term" data-n="' + esc(normAy(x.q + ' ' + x.d)) + '"><div class="ay-term-t">' + esc(x.q) + '</div><div class="ay-term-d">' + esc(x.d) + '</div></div>').join('') + '</div></section>').join('') + '</div>';
}
function ayudaInfoSoftware(){
  const anio = new Date().getFullYear();
  const fila = (lab, val) => '<div class="ay-fila"><div class="ay-fila-lab">' + esc(lab) + '</div><div class="ay-fila-val">' + val + '</div></div>';
  return '<div class="ay-placa"><div class="ay-sello"><div class="ay-medallon"><svg class="ay-anillo" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92" class="ay-anillo-base"/><circle cx="100" cy="100" r="92" class="ay-anillo-trazo"/></svg>' +
      '<div class="ay-escudo-disco"></div><img class="ay-escudo" src="' + LOGO_ARKEN + '" alt=""></div>' +
      '<div class="ay-marca"><div class="ay-marca-nombre">ARKEN<span>BANK</span></div><div class="ay-marca-linea"></div><div class="ay-marca-lema">Análisis de créditos bancarios</div></div></div>' +
    '<div class="ay-rotulo">' + fila('Creador', 'ARKEN 360') + fila('Versión', '<span class="num">' + esc(VERSION_PROGRAMA) + '</span>') + fila('Copyright', '© ' + anio + ' ARKEN 360 — todos los derechos reservados') +
      fila('Naturaleza', 'Software de propiedad privada, bajo licencia de uso') + fila('Familia', 'ARKEN 360 · ARKEN CONTROL · ARKEN ANALYTICA · ARKEN BANK') + '</div>' +
    '<div class="ay-clausula"><div class="ay-clausula-tit">Aviso legal</div><p>Este software —su código fuente, su estructura de datos, su interfaz y su documentación— es obra protegida por las leyes de propiedad intelectual y derechos de autor vigentes. Queda prohibida su reproducción, distribución, ingeniería inversa, modificación o copia, total o parcial, sin autorización expresa y escrita de ARKEN 360.</p>' +
      '<p>Los conceptos que emite el programa son preliminares y no constituyen una aprobación de crédito: la decisión corresponde a cada entidad financiera. Las condiciones de los bancos que trae el programa son de referencia y deben confirmarse con cada entidad.</p><p>El uso no autorizado da lugar a las acciones civiles y penales a que haya lugar.</p></div>' +
    '<div class="ay-tecnica"><div class="ay-tecnica-tit">Identificación técnica</div><div class="ay-tecnica-grid">' +
      fila('Tipo de aplicación', 'Programa autocontenido de análisis de crédito (HTML/JavaScript)') + fila('Lectura de documentos', 'pdf.js para el texto de los PDF y Tesseract (OCR en español) para escaneos e imágenes, dentro del archivo') +
      fila('Almacenamiento', 'Local — en el navegador del equipo, sin servidores externos') + fila('Idioma', 'Español (Colombia)') + '</div>' +
      '<p class="ay-soporte">Para reportar un defecto o solicitar una mejora, use el canal que su empresa tenga dispuesto con el desarrollador del sistema.</p></div>' +
    '<div class="ay-lema"><div class="ay-lema-linea"></div><div class="ay-lema-txt">La plataforma de gestión de la construcción de alta gama</div><div class="ay-lema-sub">Libera tu talento para construir el futuro</div></div></div>';
}

/* ─────────── PDF: guía y manual de usuario ─────────── */
function bloquesGuiaAyuda(g){
  const s = t => String(t).replace(/[«»]/g, '"');
  const B = [{ t:'texto', txt:g.lema, gris:true }, { t:'kv', cols:1, pares:[['Para qué sirve', s(g.para)], ['Quién lo usa', g.quien]] },
    { t:'tabla', cabeza:['Parte', 'Qué contiene'], anchos:[30, 70], filas:g.pestanas.map(p => ({ celdas:[p[0], s(p[1])] })) }];
  g.tareas.forEach((t, k) => {
    B.push({ t:'sec', txt:(k + 1) + '. ' + t.t, nivel:2 });
    B.push({ t:'lista', numerada:true, items:t.pasos.map(s) });
    if (t.res) B.push({ t:'texto', txt:'Resultado: ' + s(t.res), gris:true });
  });
  if (g.consejos.length) B.push({ t:'texto', txt:'Consejos: ' + g.consejos.map(s).join(' · ') });
  if (g.cuidado.length) B.push({ t:'texto', txt:'Atención: ' + g.cuidado.map(s).join(' · ') });
  return B;
}
function pdfGuiaAyuda(g){
  const r = Pdf.generar({ titulo:'Guía de uso — ' + nombreGuia(g.id), documento:'Ayuda · ' + cortoGuia(g.id), bloques:[{ t:'sec', txt:'Guía de uso — ' + nombreGuia(g.id) }].concat(bloquesGuiaAyuda(g)) });
  UI.descargar('ARKEN_BANK_guia_' + g.id + '.pdf', r.blob);
}
function pdfManualUsuario(){
  const B = [{ t:'portada', eyebrow:'Manual de usuario', titulo:'ARKEN BANK', clave:'Análisis de créditos', lineas:[(S.empresa && S.empresa.razonSocial) || 'Familia ARKEN 360',
      GUIAS_MODULO.length + ' guías · ' + GUIAS_MODULO.reduce((t, g) => t + g.tareas.length, 0) + ' tareas · ' + RUTAS_TRABAJO.length + ' rutas de trabajo', Util.fmtFechaLarga(Util.hoyISO())] },
    { t:'indice' }, { t:'sec', txt:'1. Introducción' },
    { t:'texto', txt:'ARKEN BANK organiza el estudio de créditos bancarios: según el tipo de cliente muestra los créditos que aplican y los documentos que se necesitan; guarda y lee esos documentos; compara las condiciones de cada banco y emite conceptos de viabilidad con el porqué de cada cifra. Funciona sin internet y los datos no salen del equipo.' },
    { t:'texto', txt:'Los nombres de botones y pestañas van entre comillas tal como aparecen en pantalla. Los conceptos son preliminares: la decisión del crédito es siempre del banco.' },
    { t:'sec', txt:'2. Primeros pasos' }, { t:'tabla', cabeza:['#', 'Paso', 'Cómo', 'Dónde'], anchos:[6, 30, 44, 24], filas:PRIMEROS_PASOS.map((p, i) => ({ celdas:[String(i + 1), p[1], p[2], nombreGuia(p[0])] })) },
    { t:'sec', txt:'3. Rutas de trabajo' }];
  RUTAS_TRABAJO.forEach((r, i) => { B.push({ t:'sec', txt:'3.' + (i + 1) + ' ' + r.t, nivel:2 }); B.push({ t:'texto', txt:r.d, gris:true });
    B.push({ t:'tabla', cabeza:['#', 'Módulo', 'Qué hacer'], anchos:[6, 30, 64], filas:r.pasos.map((p, k) => ({ celdas:[String(k + 1), nombreGuia(p[0]), p[1]] })) }); });
  B.push({ t:'sec', txt:'4. Guías por módulo', nueva:true });
  GUIAS_MODULO.forEach((g, i) => { B.push({ t:'sec', txt:'4.' + (i + 1) + ' ' + (g.id.length === 2 ? 'Módulo ' + g.id + ' · ' : '') + nombreGuia(g.id), nivel:2 }); bloquesGuiaAyuda(g).forEach(b => B.push(b)); });
  B.push({ t:'sec', txt:'5. Preguntas frecuentes', nueva:true });
  FAQ_CATEGORIAS.forEach(c => { B.push({ t:'sec', txt:c.n, nivel:2 }); (AYUDA_CONTENIDO[c.k] || []).forEach(x => { B.push({ t:'texto', txt:x.q, negrita:true }); B.push({ t:'texto', txt:textoPlanoAy(x.a) }); }); });
  B.push({ t:'sec', txt:'6. Glosario', nueva:true });
  B.push({ t:'tabla', cabeza:['Término', 'Significado'], anchos:[28, 72], filas:AYUDA_CONTENIDO.glosario.slice().sort((a, b) => a.q.localeCompare(b.q, 'es')).map(x => ({ celdas:[x.q, x.a] })) });
  const r = Pdf.generar({ titulo:'Manual de usuario', documento:'Manual de usuario', bloques:B });
  UI.descargar('ARKEN_BANK_manual_de_usuario.pdf', r.blob);
}

/* ─────────── Vista ─────────── */
Vistas['16'] = function(){
  if (!TABS_16.some(t => t.k === Sesion.tab16)) Sesion.tab16 = 'inicio';
  const sub = Sesion.tab16;
  const nPasos = GUIAS_MODULO.reduce((s, g) => s + g.tareas.length, 0);
  const nFaq = FAQ_CATEGORIAS.reduce((s, c) => s + (AYUDA_CONTENIDO[c.k] || []).length, 0);
  const buscador = '<div class="ay-buscar">' + iconoAyuda('lupa') + '<input id="ayBuscar" type="search" autocomplete="off" aria-label="Buscar en la ayuda" placeholder="¿Qué necesita hacer? Escriba: leasing, documento vencido, cuota, constructor…" value="' + esc(Sesion.q16 || '') + '"></div>';
  const hero = sub === 'inicio' ? '<div class="ay-hero"><div class="ay-hero-in"><div class="ay-hero-eb">Centro de ayuda · ARKEN BANK</div><h2 class="ay-hero-t">¿Qué necesita hacer hoy?</h2>' +
      '<p class="ay-hero-p">Guías paso a paso de cada módulo, rutas de trabajo de principio a fin, respuestas a las preguntas frecuentes y el significado de cada término.</p>' + buscador +
      '<div class="ay-sug">' + ['leasing', 'documento vencido', 'monto ajustado', 'constructor', 'OCR', 'Ley 546', 'respaldo', 'filtros'].map(s => '<button class="ay-sug-b" data-aysug="' + esc(s) + '" type="button">' + esc(s) + '</button>').join('') + '</div>' +
      '<div class="ay-hero-cifras"><div><b>' + GUIAS_MODULO.length + '</b><span>guías</span></div><div><b>' + nPasos + '</b><span>tareas paso a paso</span></div><div><b>' + RUTAS_TRABAJO.length + '</b><span>rutas de trabajo</span></div><div><b>' + nFaq + '</b><span>preguntas</span></div><div><b>' + AYUDA_CONTENIDO.glosario.length + '</b><span>términos</span></div></div></div></div>'
    : '<div class="ay-barra">' + buscador + '</div>';
  const cuerpo = sub === 'info' ? ayudaInfoSoftware() : sub === 'guias' ? htmlGuiaAyuda() : sub === 'rutas' ? htmlRutasAyuda() : sub === 'faq' ? htmlFaqAyuda() : sub === 'glosario' ? htmlGlosarioAyuda() : htmlInicioAyuda();
  const tabs = '<div class="tabs" role="tablist">' + TABS_16.map(t => '<button class="tab' + (t.k === sub ? ' active' : '') + '" role="tab" type="button" data-accion="ay-tab" data-k="' + t.k + '">' + esc(t.n) + '</button>').join('') + '</div>';
  const html = cabecera('16', 'Centro de ayuda', 'Guías paso a paso de cada módulo, rutas de trabajo, preguntas frecuentes y glosario') + hero +
    '<div id="ayResultados" class="ay-resultados"></div><div id="ayCuerpo">' + tabs + '<div id="c16">' + cuerpo + '</div></div>';
  return { html, acciones:{
      'ay-tab':b => { Sesion.tab16 = b.dataset.k; Sesion.q16 = ''; App.render(); },
      'ay-manual':() => pdfManualUsuario(),
      'ay-guia-pdf':b => pdfGuiaAyuda(guiaPorId(b.dataset.g)),
      'ay-faq-cat':b => { Sesion.faq16 = b.dataset.c; App.render(); },
      'ay-abrir-todo':() => { const L = $$('.ay-faq-l details'); const abrir = !L.every(d => d.open); L.forEach(d => d.open = abrir); }
    },
    alPintar(){
      const st = $('#stage');
      conectarEnlacesAyuda(st);
      const aplicar = v => {
        Sesion.q16 = v; const q = v.trim();
        if (q.length < 2){ $('#ayResultados').innerHTML = ''; $('#ayCuerpo').style.display = ''; return; }
        $('#ayCuerpo').style.display = 'none';
        $('#ayResultados').innerHTML = htmlResultadosAyuda(q); conectarEnlacesAyuda($('#ayResultados'));
      };
      let tmr = null;
      $('#ayBuscar').oninput = e => { clearTimeout(tmr); tmr = setTimeout(() => aplicar(e.target.value), 120); };
      $$('[data-aysug]').forEach(b => b.onclick = () => { $('#ayBuscar').value = b.dataset.aysug; aplicar(b.dataset.aysug); $('#ayBuscar').focus(); });
      if (Sesion.q16) aplicar(Sesion.q16);
      $$('[data-ayl]').forEach(b => b.onclick = () => { const s = $('#ayL_' + b.dataset.ayl); if (s) s.scrollIntoView({ block:'start', behavior:'smooth' }); });
      const gf = $('#ayGlosF');
      if (gf) gf.oninput = e => { const q = normAy(e.target.value.trim());
        $$('.ay-term', st).forEach(t => t.style.display = !q || t.dataset.n.indexOf(q) >= 0 ? '' : 'none');
        $$('.ay-glos-sec', st).forEach(s => s.style.display = $$('.ay-term', s).some(t => t.style.display !== 'none') ? '' : 'none'); };
      if (Sesion.tarea16 !== null && Sesion.tarea16 !== undefined){ const d = $('.ay-tarea[data-k="' + Sesion.tarea16 + '"]'); if (d) setTimeout(() => d.scrollIntoView({ block:'center', behavior:'smooth' }), 60); Sesion.tarea16 = null; }
      if (Sesion.ruta16){ const s = $('#ayRuta_' + Sesion.ruta16); if (s) setTimeout(() => s.scrollIntoView({ block:'start', behavior:'smooth' }), 60); Sesion.ruta16 = null; }
    } };
};
