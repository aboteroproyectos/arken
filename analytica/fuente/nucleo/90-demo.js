/* ══════════════════════════════════════════════════════════════════════════
   DEMOSTRACIÓN — un proceso ficticio, rotulado como tal en cada pantalla y
   documento, que se borra con un botón (§0.7). Ninguna empresa usa un
   nombre o un NIT reales: los nombres llevan «DEMO» y los NIT empiezan por
   999, una serie que la DIAN no asigna a personas jurídicas.
   Precios de insumo con IVA, de referencia para Antioquia en 2026; son
   ilustrativos, no un corte de mercado.
   ══════════════════════════════════════════════════════════════════════════ */
const Demo = (function(){

  const INSUMOS = [
    ['MAT-001','Materiales','Cemento gris uso general x 50 kg','SC50',33500],
    ['MAT-002','Materiales','Arena de peña lavada','M3',98000],
    ['MAT-003','Materiales','Triturado de 3/4"','M3',112000],
    ['MAT-004','Materiales','Acero de refuerzo corrugado 60.000 psi','KG',5150],
    ['MAT-005','Materiales','Concreto premezclado 3000 psi','M3',612000],
    ['MAT-006','Materiales','Concreto premezclado 4000 psi','M3',668000],
    ['MAT-007','Materiales','Bloque de concreto 12 x 20 x 40 cm','UN',3350],
    ['MAT-008','Materiales','Ladrillo tolete común','UN',1250],
    ['MAT-009','Materiales','Teja termoacústica trapezoidal','M2',89500],
    ['MAT-010','Materiales','Perfil metálico de cubierta en C 150 x 50 x 2 mm','ML',41800],
    ['MAT-011','Materiales','Tubería PVC sanitaria 4"','ML',28900],
    ['MAT-012','Materiales','Tubería PVC presión 1/2" RDE 13,5','ML',5200],
    ['MAT-013','Materiales','Cable de cobre THHN 12 AWG','ML',3400],
    ['MAT-014','Materiales','Porcelanato 60 x 60 cm','M2',78500],
    ['MAT-015','Materiales','Pegante cerámico x 25 kg','UN',36800],
    ['MAT-016','Materiales','Estuco plástico x 25 kg','UN',54000],
    ['MAT-017','Materiales','Pintura vinilo tipo 1 x galón','GL',89000],
    ['MAT-018','Materiales','Madera para formaleta (tabla burra)','UN',14500],
    ['MAT-019','Materiales','Geotextil no tejido NT 2000','M2',6800],
    ['MAT-020','Materiales','Recebo compactable','M3',72000],
    ['MO-001','Mano de Obra','Oficial de construcción (costo empresa)','JORNAL',138000],
    ['MO-002','Mano de Obra','Ayudante de construcción (costo empresa)','JORNAL',112000],
    ['MO-003','Mano de Obra','Electricista (costo empresa)','JORNAL',152000],
    ['MO-004','Mano de Obra','Plomero (costo empresa)','JORNAL',148000],
    ['MO-005','Mano de Obra','Cuadrilla de topografía','DIA',820000],
    ['HER-001','Herramientas','Herramienta menor','GLB',1],
    ['EQU-001','Equipos','Vibrador de concreto','DIA',85000],
    ['EQU-002','Equipos','Retroexcavadora de llantas con operador','HORA',178000],
    ['EQU-003','Equipos','Vibrocompactador tipo rana','DIA',115000],
    ['FER-001','Ferretería','Alambre negro calibre 18','KG',7400],
    ['FER-002','Ferretería','Puntilla con cabeza 2"','LB',6900],
    ['CON-001','Consumibles','Disco de corte para metal 7"','UN',9800],
    ['TC-001','Todo Costo','Transporte y disposición de escombros en sitio autorizado','M3',48000],
    ['TC-002','Todo Costo','Carpintería en madera (puertas, instaladas)','UN',1450000],
    ['TC-003','Todo Costo','Ventanería en aluminio y vidrio templado','M2',465000]
  ];
  const APUS = [
    ['APU-001','Localización y replanteo con equipo de precisión','M2',[['MO-005',0.0012],['MO-002',0.012],['MAT-018',0.02]]],
    ['APU-002','Excavación mecánica en material común','M3',[['EQU-002',0.06],['MO-002',0.04]]],
    ['APU-003','Excavación manual en material común','M3',[['MO-002',1.1],['HER-001',2400]]],
    ['APU-004','Retiro de material sobrante','M3',[['TC-001',1.3],['MO-002',0.08]]],
    ['APU-005','Relleno compactado con recebo','M3',[['MAT-020',1.25],['EQU-003',0.08],['MO-002',0.5]]],
    ['APU-006','Concreto 3000 psi para cimentación','M3',[['MAT-005',1.05],['EQU-001',0.08],['MO-001',0.35],['MO-002',0.9],['HER-001',3500]]],
    ['APU-007','Concreto 4000 psi para columnas y vigas','M3',[['MAT-006',1.05],['MAT-018',4.5],['EQU-001',0.1],['MO-001',0.9],['MO-002',1.8],['FER-002',0.6]]],
    ['APU-008','Acero de refuerzo figurado y amarrado','KG',[['MAT-004',1.05],['FER-001',0.02],['MO-001',0.012],['MO-002',0.012]]],
    ['APU-009','Muro en bloque de concreto 12 cm','M2',[['MAT-007',12.8],['MAT-001',0.25],['MAT-002',0.022],['MO-001',0.22],['MO-002',0.22]]],
    ['APU-010','Muro en ladrillo tolete a la vista','M2',[['MAT-008',58],['MAT-001',0.32],['MAT-002',0.03],['MO-001',0.32],['MO-002',0.32]]],
    ['APU-011','Estructura metálica de cubierta en perfil C','ML',[['MAT-010',1.05],['CON-001',0.05],['MO-001',0.08],['MO-002',0.08]]],
    ['APU-012','Teja termoacústica instalada','M2',[['MAT-009',1.08],['MO-001',0.08],['MO-002',0.08]]],
    ['APU-013','Red sanitaria en PVC 4"','ML',[['MAT-011',1.05],['MO-004',0.12],['MO-002',0.12]]],
    ['APU-014','Red hidráulica en PVC presión 1/2"','ML',[['MAT-012',1.05],['MO-004',0.06]]],
    ['APU-015','Salida eléctrica de iluminación','UN',[['MAT-013',18],['MO-003',0.35]]],
    ['APU-016','Piso en porcelanato 60 x 60','M2',[['MAT-014',1.05],['MAT-015',0.2],['MO-001',0.22],['MO-002',0.15]]],
    ['APU-017','Estuco y pintura sobre muro','M2',[['MAT-016',0.06],['MAT-017',0.04],['MO-001',0.1],['MO-002',0.05]]],
    ['APU-018','Suministro e instalación de puertas en madera','UN',[['TC-002',1]]],
    ['APU-019','Ventanería en aluminio','M2',[['TC-003',1]]],
    ['APU-020','Geotextil para separación de subrasante','M2',[['MAT-019',1.1],['MO-002',0.015]]]
  ];
  /* [capítulo, [subcapítulo, [actividad, unidad, cantidad, [APU…], incierta]]] */
  const CAPITULOS = [
    ['01','PRELIMINARES',[['01.01','Localización y replanteo',[['01.01.01','Localización y replanteo general','M2',620,['APU-001']]]]]],
    ['02','MOVIMIENTO DE TIERRAS',[['02.01','Excavaciones',[
        ['02.01.01','Excavación mecánica para explanación','M3',980,['APU-002','APU-004'],true],
        ['02.01.02','Excavación manual para zapatas y vigas de amarre','M3',86,['APU-003','APU-004']]]],
      ['02.02','Rellenos',[['02.02.01','Relleno compactado con recebo','M3',140,['APU-005']],
        ['02.02.02','Geotextil de separación','M2',420,['APU-020']]]]]],
    ['03','CIMENTACIÓN',[['03.01','Concretos de cimentación',[
        ['03.01.01','Zapatas en concreto 3000 psi','M3',42,['APU-006']],
        ['03.01.02','Vigas de amarre en concreto 3000 psi','M3',28,['APU-006']]]],
      ['03.02','Acero de refuerzo',[['03.02.01','Acero de refuerzo para cimentación','KG',5200,['APU-008']]]]]],
    ['04','ESTRUCTURA',[['04.01','Concretos de estructura',[
        ['04.01.01','Columnas en concreto 4000 psi','M3',24,['APU-007']],
        ['04.01.02','Vigas aéreas en concreto 4000 psi','M3',36,['APU-007']]]],
      ['04.02','Acero de refuerzo',[['04.02.01','Acero de refuerzo para estructura','KG',8600,['APU-008']]]]]],
    ['05','MAMPOSTERÍA',[['05.01','Muros',[
        ['05.01.01','Muro en bloque de concreto 12 cm','M2',780,['APU-009']],
        ['05.01.02','Muro de fachada en ladrillo a la vista','M2',260,['APU-010']]]]]],
    ['06','CUBIERTA',[['06.01','Estructura y teja',[
        ['06.01.01','Estructura metálica de cubierta','ML',640,['APU-011']],
        ['06.01.02','Teja termoacústica','M2',410,['APU-012']]]]]],
    ['07','INSTALACIONES',[['07.01','Hidrosanitarias',[
        ['07.01.01','Red sanitaria en PVC 4"','ML',120,['APU-013'],true],
        ['07.01.02','Red hidráulica en PVC 1/2"','ML',260,['APU-014']]]],
      ['07.02','Eléctricas',[['07.02.01','Salidas de iluminación','UN',96,['APU-015']]]]]],
    ['08','ACABADOS',[['08.01','Pisos y muros',[
        ['08.01.01','Piso en porcelanato 60 x 60','M2',380,['APU-016']],
        ['08.01.02','Estuco y pintura interior','M2',1450,['APU-017']]]],
      ['08.02','Carpintería y ventanería',[['08.02.01','Puertas en madera','UN',14,['APU-018']],
        ['08.02.02','Ventanería en aluminio y vidrio templado','M2',96,['APU-019']]]]]]
  ];

  function presupuesto(){
    const ins = INSUMOS.map(([codigo, categoria, nombre, unidad, precio]) => ({ id:Util.uid('in'), codigo, categoria, nombre, unidad, precio }));
    const porCod = new Map(ins.map(i => [i.codigo, i.id]));
    const apus = APUS.map(([codigo, nombre, unidad, comp]) => ({ id:Util.uid('ap'), codigo, nombre, unidad,
      insumos:comp.map(([c, cantidad]) => ({ idInsumo:porCod.get(c), cantidad })) }));
    const apuCod = new Map(apus.map(a => [a.codigo, a.id]));
    const capitulos = CAPITULOS.map(([cc, cn, subs]) => ({ id:Util.uid('cp'), codigo:cc, nombre:cn,
      subs:subs.map(([sc, sn, acts]) => ({ id:Util.uid('sb'), codigo:sc, nombre:sn,
        acts:acts.map(([ac, an, u, q, aps, incierta]) => ({ id:Util.uid('ac'), codigo:ac, nombre:an, unidad:u, cantidad:q,
          apus:aps.map(c => apuCod.get(c)), obligatorioApu:false, cantidadIncierta:!!incierta, notas:'' })) })) }));
    return { capitulos, apus, insumos:ins, aiu:{ a:18, i:3, u:5 }, iva:{ tarifa:19, base:'utilidad' } };
  }

  const INVITADOS = [
    ['DEMO Constructora Alfa S.A.S.','999100001','Laura Gómez (ficticia)','Directora de licitaciones','licitaciones@alfa.demo.invalid'],
    ['DEMO Obras Beta Ingeniería S.A.S.','999100002','Andrés Restrepo (ficticio)','Gerente técnico','ofertas@beta.demo.invalid'],
    ['DEMO Gamma Edificaciones Ltda.','999100003','Catalina Ruiz (ficticia)','Coordinadora de propuestas','propuestas@gamma.demo.invalid'],
    ['DEMO Consorcio Delta Campestre','999100004','Juan Pablo Mejía (ficticio)','Representante del consorcio','consorcio@delta.demo.invalid'],
    ['DEMO Épsilon Construcciones S.A.','999100005','Mariana Ospina (ficticia)','Directora comercial','comercial@epsilon.demo.invalid']
  ];
  function invitados(procesoId){
    return INVITADOS.map(([razonSocial, nit, nombre, cargo, correo]) => ({
      id:Util.uid('iv'), procesoId, demo:true, razonSocial, nit, dv:Nit.digitoVerificacion(nit), pais:'Colombia',
      direccion:'Dirección ficticia de demostración', ciudad:'Medellín',
      contacto:{ nombre, cargo, correo, telefono:'300 000 0000' },
      codigoInvitacion:Util.codigoInvitacion(), estado:'por invitar', paquetesEmitidos:[], envios:[],
      confidencialidad:{ estado:'pendiente' }
    }));
  }
  const EMPRESA = { razonSocial:'DEMO Empresa Principal Ficticia S.A.S.', nit:'999000001', ciudad:'Medellín', pais:'Colombia',
    direccion:'Dirección ficticia de demostración', telefono:'604 000 0000', correo:'contratacion@principal.demo.invalid',
    representante:'Representante ficticio de demostración', documentoRepresentante:'CC 0000000000' };

  return { presupuesto, invitados, EMPRESA, INSUMOS, APUS };
})();
