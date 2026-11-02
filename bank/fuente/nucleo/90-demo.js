/* ══════════════════════════════════════════════════════════════════════════
   DEMOSTRACIÓN — clientes ficticios para conocer el programa. Cubren los
   casos típicos: un asalariado viable, un independiente que necesita bajar el
   monto, una pensionada a la que la edad le recorta el plazo, un joven en VIS
   con puntaje bajo, una empresa que pide leasing inmobiliario y una
   constructora con su proyecto. Algunos traen documentos de ejemplo (el texto
   de cada uno; el programa los convierte en PDF) para probar el lector.
   Todo queda marcado como demostración y se borra con un botón.
   ══════════════════════════════════════════════════════════════════════════ */
const Demo = (function(){

  function haceAnios(n, mes, dia, hoy){
    const d = Util.fechaDe(hoy || Util.hoyISO());
    return (d.getFullYear() - n) + '-' + String(mes).padStart(2, '0') + '-' + String(dia).padStart(2, '0');
  }
  function haceDias(n, hoy){ const d = Util.fechaDe(hoy || Util.hoyISO()); d.setDate(d.getDate() - n); return d; }
  function fechaLarga(d){ return d.getDate() + ' de ' + Util.MESES[d.getMonth()] + ' de ' + d.getFullYear(); }

  function clientes(hoy){
    return [
      { id:'cli_demo_laura', tipo:'asalariado', nombre:'Laura Gómez Restrepo', documento:'1.037.588.214', telefono:'300 555 0101', correo:'laura.gomez@ejemplo.co', ciudad:'Medellín',
        estado:'en_estudio', asesor:'', notas:'Compra de apartamento en Envigado.',
        perfil:{ producto:'hipotecario', ingresoMensual:11000000, ingresosVariables:0, ingresoCodeudor:0, cuotasActuales:650000, saldoDeudas:14000000,
          puntajeCredito:762, reportesNegativos:false, fechaNacimiento:haceAnios(35, 4, 12, hoy), fechaIngreso:haceAnios(6, 2, 1, hoy), tipoContrato:'Término indefinido',
          cargo:'Ingeniera de procesos', empleador:'Industrias del Valle S.A.S.', valorInmueble:420000000, montoSolicitado:260000000, plazoAnios:20, esVIS:false } },
      { id:'cli_demo_carlos', tipo:'independiente', nombre:'Carlos Andrés Mejía Duque', documento:'71.789.456', telefono:'310 555 0102', correo:'carlos.mejia@ejemplo.co', ciudad:'Medellín',
        estado:'prospecto', asesor:'', notas:'Arquitecto independiente. Quiere leasing habitacional.',
        perfil:{ producto:'leasing_hab', ingresoMensual:9500000, ingresosVariables:0, ingresoCodeudor:0, cuotasActuales:1800000, saldoDeudas:62000000,
          puntajeCredito:705, reportesNegativos:false, fechaNacimiento:haceAnios(44, 9, 3, hoy), fechaIngreso:haceAnios(9, 1, 15, hoy), tipoContrato:'Prestación de servicios',
          cargo:'Arquitecto', empleador:'Ejercicio independiente', valorInmueble:650000000, montoSolicitado:520000000, plazoAnios:20, esVIS:false } },
      { id:'cli_demo_marta', tipo:'pensionado', nombre:'Marta Lucía Cárdenas Vélez', documento:'42.876.120', telefono:'315 555 0103', correo:'', ciudad:'Rionegro',
        estado:'en_estudio', asesor:'', notas:'Vivienda de interés social para vivir cerca de la familia.',
        perfil:{ producto:'hipotecario', ingresoMensual:4200000, ingresosVariables:0, ingresoCodeudor:0, cuotasActuales:0, saldoDeudas:0,
          puntajeCredito:798, reportesNegativos:false, fechaNacimiento:haceAnios(63, 6, 20, hoy), fechaIngreso:'', tipoContrato:'No aplica',
          valorInmueble:205000000, montoSolicitado:120000000, plazoAnios:15, esVIS:true } },
      { id:'cli_demo_andres', tipo:'asalariado', nombre:'Andrés Felipe Ríos Zapata', documento:'1.152.700.981', telefono:'301 555 0104', correo:'', ciudad:'Bello',
        estado:'prospecto', asesor:'', notas:'Primera vivienda, VIS.',
        perfil:{ producto:'hipotecario', ingresoMensual:3100000, ingresosVariables:250000, ingresoCodeudor:0, cuotasActuales:420000, saldoDeudas:5200000,
          puntajeCredito:612, reportesNegativos:false, fechaNacimiento:haceAnios(27, 11, 2, hoy), fechaIngreso:haceAnios(1, 3, 1, hoy), tipoContrato:'Término fijo',
          cargo:'Auxiliar contable', empleador:'Comercializadora Andina Ltda.', valorInmueble:190000000, montoSolicitado:152000000, plazoAnios:30, esVIS:true } },
      { id:'cli_demo_altamira', tipo:'empresa', nombre:'Inversiones Altamira S.A.S.', documento:'901.245.778-3', telefono:'604 555 0105', correo:'gerencia@altamira.example', ciudad:'Itagüí',
        estado:'en_estudio', asesor:'', notas:'Bodega logística de 2.400 m² en leasing.',
        perfil:{ producto:'leasing_inmob', fechaConstitucion:haceAnios(8, 5, 10, hoy), ingresosOperacionales:7800000000, utilidadOperacional:950000000, utilidadNeta:520000000,
          gastosFinancieros:180000000, activoCorriente:2900000000, pasivoCorriente:1700000000, activoTotal:6100000000, pasivoTotal:3300000000, patrimonio:2800000000,
          cuotasActuales:22000000, saldoDeudas:1100000000, puntajeCredito:720, reportesNegativos:false,
          valorInmueble:1800000000, montoSolicitado:1400000000, plazoAnios:10 } },
      { id:'cli_demo_valle', tipo:'constructora', nombre:'Constructora Valle de Aburrá S.A.S.', documento:'900.611.302-8', telefono:'604 555 0106', correo:'proyectos@valleaburra.example', ciudad:'Sabaneta',
        estado:'radicado', asesor:'', notas:'Proyecto Torres del Bosque: 120 apartamentos No VIS.',
        perfil:{ producto:'constructor', nombreProyecto:'Torres del Bosque', fechaConstitucion:haceAnios(12, 2, 20, hoy), ingresosOperacionales:21000000000, utilidadOperacional:3100000000,
          utilidadNeta:1900000000, gastosFinancieros:640000000, activoCorriente:15200000000, pasivoCorriente:9800000000, activoTotal:31000000000, pasivoTotal:18600000000,
          patrimonio:12400000000, cuotasActuales:0, puntajeCredito:735, reportesNegativos:false,
          costoTotalProyecto:28000000000, valorLote:4500000000, valorVentasProyecto:41000000000, unidadesTotales:120, unidadesVendidas:78,
          aportePropio:10000000000, licenciaVigente:true, fiducia:true, proyectosTerminados:4, montoSolicitado:18000000000, plazoAnios:3 } }
    ].map(c => Object.assign(c, { demo:true, creado:new Date().toISOString() }));
  }

  /* Documentos de ejemplo: { clienteId, tipoDoc, nombre, lineas }. El texto imita el de los documentos reales. */
  function documentos(hoy){
    const h5 = fechaLarga(haceDias(5, hoy)), h12 = fechaLarga(haceDias(12, hoy)), h45 = fechaLarga(haceDias(45, hoy));
    const ing = Util.fechaDe(haceAnios(6, 2, 1, hoy));
    return [
      { clienteId:'cli_demo_laura', tipoDoc:'cert_laboral', nombre:'Certificado laboral - Laura Gomez.pdf', lineas:[
        'INDUSTRIAS DEL VALLE S.A.S.', 'NIT 890.912.345-6', '', 'LA DIRECCIÓN DE GESTIÓN HUMANA', 'CERTIFICA QUE:', '',
        'La señora LAURA GÓMEZ RESTREPO, identificada con cédula de ciudadanía No. 1.037.588.214,',
        'labora en esta empresa desde el ' + fechaLarga(ing) + ', con contrato a término indefinido,',
        'desempeñando el cargo de Ingeniera de procesos, devengando un salario básico mensual de $ 11.000.000.', '',
        'La presente certificación se expide a solicitud de la interesada en Medellín, el ' + h5 + '.', '', 'Sandra Milena Ortiz', 'Directora de Gestión Humana'] },
      { clienteId:'cli_demo_laura', tipoDoc:'desprendibles', nombre:'Desprendibles de nomina - Laura Gomez.pdf', lineas:[
        'INDUSTRIAS DEL VALLE S.A.S.  ·  COMPROBANTE DE PAGO DE NÓMINA', 'Periodo: mes anterior', 'Empleado: LAURA GÓMEZ RESTREPO   C.C. 1.037.588.214',
        'Salario básico: $ 11.000.000', 'Total devengado: $ 11.000.000', 'Salud 4 %: $ 440.000', 'Pensión 4 %: $ 440.000', 'Fondo de solidaridad 1 %: $ 110.000', 'Retención en la fuente: $ 868.000',
        'Total deducciones: $ 1.858.000', 'Neto a pagar: $ 9.142.000', 'Fecha de expedición: ' + h12] },
      { clienteId:'cli_demo_laura', tipoDoc:'extractos', nombre:'Extracto cuenta de ahorros - Laura Gomez.pdf', lineas:[
        'BANCO EJEMPLO S.A.  ·  EXTRACTO DE CUENTA DE AHORROS', 'Titular: LAURA GÓMEZ RESTREPO', 'Fecha de corte: ' + h12,
        'Saldo anterior: $ 18.420.300', 'Total abonos: $ 9.342.000', 'Total cargos: $ 8.052.150', 'Saldo final: $ 19.710.150', 'Saldo promedio del mes: $ 18.960.000'] },
      { clienteId:'cli_demo_laura', tipoDoc:'tradicion', nombre:'Certificado de tradicion - Apto 1204.pdf', lineas:[
        'OFICINA DE REGISTRO DE INSTRUMENTOS PÚBLICOS DE MEDELLÍN SUR', 'CERTIFICADO DE TRADICIÓN Y LIBERTAD', 'Matrícula inmobiliaria: 001-1456789',
        'Fecha de expedición: ' + h5, 'ANOTACIÓN Nro 1: COMPRAVENTA', 'ANOTACIÓN Nro 2: CONSTITUCIÓN DE REGLAMENTO DE PROPIEDAD HORIZONTAL',
        'ANOTACIÓN Nro 3: HIPOTECA ABIERTA SIN LÍMITE DE CUANTÍA a favor de BANCO EJEMPLO', 'ANOTACIÓN Nro 4: CANCELACIÓN HIPOTECA'] },
      { clienteId:'cli_demo_andres', tipoDoc:'cert_laboral', nombre:'Certificado laboral - Andres Rios.pdf', lineas:[
        'COMERCIALIZADORA ANDINA LTDA.', 'NIT 800.456.123-1', 'CERTIFICA:', '',
        'Que el señor ANDRÉS FELIPE RÍOS ZAPATA, identificado con C.C. 1.152.700.981, trabaja en nuestra compañía',
        'desde el 1 de marzo de ' + (Util.fechaDe(hoy || Util.hoyISO()).getFullYear() - 1) + ' con contrato a término fijo de un año, en el cargo de Auxiliar contable,',
        'con una asignación básica mensual de $ 3.100.000.', '', 'Se expide en Bello el ' + h45 + '.'] },
      { clienteId:'cli_demo_valle', tipoDoc:'cuadro_ventas', nombre:'Certificado de preventas - Torres del Bosque.pdf', lineas:[
        'FIDUCIARIA EJEMPLO S.A.', 'CERTIFICADO DE PREVENTAS · ENCARGO FIDUCIARIO TORRES DEL BOSQUE', 'Fecha de expedición: ' + h12,
        'Total de unidades: 120', 'Unidades vendidas: 78', 'Valor total de las ventas del proyecto: $ 41.000.000.000', 'Recaudo de cuotas iniciales a la fecha: $ 6.240.000.000'] },
      { clienteId:'cli_demo_valle', tipoDoc:'estados_financieros', nombre:'Estados financieros 2025 - Valle de Aburra.pdf', lineas:[
        'CONSTRUCTORA VALLE DE ABURRÁ S.A.S.  ·  NIT 900.611.302-8', 'ESTADO DE SITUACIÓN FINANCIERA A 31 DE DICIEMBRE', '',
        'Total activo corriente 15.200.000.000', 'Total activo no corriente 15.800.000.000', 'Total activos 31.000.000.000',
        'Total pasivo corriente 9.800.000.000', 'Total pasivos 18.600.000.000', 'Total patrimonio 12.400.000.000', '',
        'ESTADO DE RESULTADOS', 'Ingresos de actividades ordinarias 21.000.000.000', 'Utilidad operacional 3.100.000.000', 'Gastos financieros 640.000.000',
        'Utilidad neta del ejercicio 1.900.000.000'] }
    ];
  }

  return { clientes, documentos };
})();
