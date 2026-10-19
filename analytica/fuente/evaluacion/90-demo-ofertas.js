/* ══════════════════════════════════════════════════════════════════════════
   OFERTAS DE DEMOSTRACIÓN (Fase 3) — cinco ofertas ficticias para el
   proceso de demostración, cada una con un rasgo que el análisis debe
   encontrar (§26, prueba punta a punta):
     Alfa     pareja, sin problemas.
     Beta     desbalanceada: precios cargados en las actividades del inicio.
     Gamma    valor artificialmente bajo y mano de obra bajo el mínimo legal.
     Delta    consorcio, con el certificado de existencia vencido y el mismo
              director de obra que Épsilon.
     Épsilon  aritmética errada: precios unitarios que no son la suma de sus
              APU y un total declarado que no cuadra.
   Todo es ficticio y va marcado como demostración: nombres con «DEMO»,
   NIT de la serie 999, correos .invalid y personas «(ficticio)».
   ══════════════════════════════════════════════════════════════════════════ */
const DemoOfertas = (function(){

  /** Ruido determinista en [−1, 1], para que cada corrida dé lo mismo. */
  function ruido(s){
    let h = 2166136261;
    for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 20001) / 10000 - 1;
  }

  /* [clave, nivel general, ruido, factor por capítulo] */
  const PERFILES = {
    alfa:   { nivel:0.93, ruido:0.03 },
    beta:   { nivel:0.92, ruido:0.03, capitulo:{ '01':1.45, '02':1.45, '03':1.40, '06':0.95, '07':0.68, '08':0.68 } },
    gamma:  { nivel:0.73, ruido:0.015 },
    delta:  { nivel:0.87, ruido:0.03 },
    epsilon:{ nivel:0.975, ruido:0.03, errados:['03.01.01','05.01.01','08.01.01'] }
  };
  const ORDEN = ['alfa','beta','gamma','delta','epsilon'];

  /* Ventanas de la programación por capítulo, en días desde el inicio. */
  const VENTANAS = { '01':[0, 9], '02':[10, 39], '03':[40, 79], '04':[80, 149], '05':[150, 199], '06':[200, 229], '07':[230, 259], '08':[260, 289] };

  const PERSONAS = {
    alfa:   [['Director de obra','Ing. Tomás Arango (ficticio)','99910000101','99901-DEMO-A1',16,50,9000000],['Residente de obra','Arq. Sara Vélez (ficticia)','99910000102','99901-DEMO-A2',8,100,5500000],
             ['Profesional SST','Pablo Correa (ficticio)','99910000103','SST-DEMO-A3',6,30,4000000],['Maestro de obra','Hernán Toro (ficticio)','99910000104','',20,100,3000000]],
    beta:   [['Director de obra','Ing. Felipe Duque (ficticio)','99920000101','99901-DEMO-B1',12,50,9000000],['Residente de obra','Ing. Daniela Mora (ficticia)','99920000102','99901-DEMO-B2',11,100,5500000],
             ['Profesional SST','Lina Zapata (ficticia)','99920000103','SST-DEMO-B3',5,30,4000000],['Maestro de obra','Óscar Gil (ficticio)','99920000104','',18,100,3000000]],
    gamma:  [['Director de obra','Arq. Natalia Cano (ficticia)','99930000101','99901-DEMO-G1',11,50,8000000],['Residente de obra','Ing. Julián Ríos (ficticio)','99930000102','99901-DEMO-G2',3,100,4500000],
             ['Profesional SST','Diana Serna (ficticia)','99930000103','SST-DEMO-G3',4,30,3500000],['Maestro de obra','Iván Pino (ficticio)','99930000104','',15,100,2600000]],
    delta:  [['Director de obra','Ing. Ricardo Henao (ficticio)','99950000101','99901-DEMO-E1',14,50,9500000],['Residente de obra','Ing. Paula Rendón (ficticia)','99940000102','99901-DEMO-D2',6,100,5800000],
             ['Profesional SST','Camilo Ochoa (ficticio)','99940000103','SST-DEMO-D3',7,30,4200000],['Maestro de obra','Gustavo Marín (ficticio)','99940000104','',22,100,3100000]],
    epsilon:[['Director de obra','Ing. Ricardo Henao (ficticio)','99950000101','99901-DEMO-E1',14,50,9500000],['Residente de obra','Arq. Valentina Mesa (ficticia)','99950000102','99901-DEMO-E2',7,100,5600000],
             ['Profesional SST','Esteban Ruiz (ficticio)','99950000103','SST-DEMO-E3',5,30,4000000],['Maestro de obra','Fabio Lopera (ficticio)','99950000104','',19,100,3000000]]
  };
  const AREAS = { alfa:2400, beta:1800, gamma:1500, delta:3000, epsilon:2100 };
  const FINANCIERO = {
    alfa:   { activoCorriente:2400e6, pasivoCorriente:900e6, activoTotal:4100e6, pasivoTotal:1800e6, patrimonio:2300e6, utilidadOperacional:520e6, gastosIntereses:80e6 },
    beta:   { activoCorriente:1900e6, pasivoCorriente:1000e6, activoTotal:3300e6, pasivoTotal:1700e6, patrimonio:1600e6, utilidadOperacional:310e6, gastosIntereses:60e6 },
    gamma:  { activoCorriente:1300e6, pasivoCorriente:700e6, activoTotal:2200e6, pasivoTotal:1200e6, patrimonio:1000e6, utilidadOperacional:150e6, gastosIntereses:0 },
    epsilon:{ activoCorriente:2600e6, pasivoCorriente:1500e6, activoTotal:5000e6, pasivoTotal:3600e6, patrimonio:1400e6, utilidadOperacional:420e6, gastosIntereses:90e6 }
  };
  const INTEGRANTES_DELTA = [
    { nombre:'DEMO Delta Obras S.A.S.', nit:'999100041', porcentaje:60, financiero:{ activoCorriente:2100e6, pasivoCorriente:800e6, activoTotal:3600e6, pasivoTotal:1500e6, patrimonio:2100e6, utilidadOperacional:430e6, gastosIntereses:70e6 } },
    { nombre:'DEMO Campestre Ingeniería S.A.S.', nit:'999100042', porcentaje:40, financiero:{ activoCorriente:1200e6, pasivoCorriente:500e6, activoTotal:2000e6, pasivoTotal:900e6, patrimonio:1100e6, utilidadOperacional:210e6, gastosIntereses:30e6 } }
  ];

  function iso(fecha, dias){ const d = Util.fechaDe(fecha); d.setDate(d.getDate() + dias); return Util.isoDe(d); }

  /** El APU de la base para una actividad, con los precios de la oferta. */
  function apusDe(base, act, factor){
    return (act.apus||[]).map(id => {
      const ap = Calculo.apu(base, id);
      return { codigo:ap.codigo, nombre:ap.nombre, unidad:ap.unidad,
        insumos:(ap.insumos||[]).map(x => { const i = Calculo.insumo(base, x.idInsumo);
          /* La herramienta menor de la base es un valor global por unidad: se deja tal cual, con su cantidad escalada. */
          return { descripcion:i.nombre, unidad:i.unidad, categoria:i.categoria, precio:Util.redondearDec(Number(i.precio) * (i.codigo === 'HER-001' ? 1 : factor), 2),
            cantidad:i.codigo === 'HER-001' ? Util.redondearDec(Number(x.cantidad) * factor, 2) : Number(x.cantidad) }; }) };
    });
  }
  function sumaApu(ap){ return ap.insumos.reduce((t, i) => t + i.precio * i.cantidad, 0); }

  /** Las cinco ofertas como oferta.json, con sus documentos (sin archivo:
      quien las use genera el PDF de cada uno con su nombre y su fecha).
      ctx = { proceso, base, requisitos, invitados:[5], cierre, versionPliego } */
  function generar(ctx){
    const base = ctx.base, formulario = Paquete.formulario(base, ctx.proceso.politicaApu);
    const cierre = String(ctx.cierre).slice(0, 10);
    const inicioObra = iso(cierre, 30);
    const requisitos = (ctx.requisitos||[]).filter(r => r.activo !== false);
    const reqDoc = requisitos.filter(r => r.tipoRespuesta === 'documento' && r.obligatorio);
    return ORDEN.map((clave, k) => {
      const pf = PERFILES[clave], inv = ctx.invitados[k];
      /* Presupuesto */
      const actividades = [];
      const programacion = [];
      Calculo.recorrerActividades(base, (a, s, c) => {
        const f = pf.nivel * ((pf.capitulo||{})[c.codigo] || 1) * (1 + pf.ruido * ruido(clave + a.codigo));
        const apus = apusDe(base, a, f);
        let pu = Util.redondearDec(apus.reduce((t, ap) => t + sumaApu(ap), 0), 3);
        if ((pf.errados||[]).indexOf(a.codigo) >= 0) pu = Util.redondearDec(pu * 1.08, 3);
        actividades.push({ capitulo:c.codigo, subcapitulo:s.codigo, codigo:a.codigo, precioUnitario:pu, apus });
        const v = VENTANAS[c.codigo] || [0, 289];
        const jpu = apus.reduce((t, ap) => t + ap.insumos.filter(i => i.categoria === 'Mano de Obra' && /JORNAL|DIA/i.test(i.unidad)).reduce((u, i) => u + i.cantidad, 0), 0);
        const dias = v[1] - v[0] + 1;
        const primera = Object.keys(VENTANAS).indexOf(c.codigo) > 0 ? primerasDe(base)[Object.keys(VENTANAS)[Object.keys(VENTANAS).indexOf(c.codigo) - 1]] : '';
        programacion.push({ actividad:a.codigo, inicio:iso(inicioObra, v[0]), fin:iso(inicioObra, v[1]), predecesoras:primera || '',
          cuadrillas:Math.max(1, Math.ceil(Number(a.cantidad) * jpu / (dias * 0.6))) });
      });
      const aiu = { a:20, i:3, u:5 };
      const iva = Util.copia(ctx.proceso.iva || base.iva);
      const po = { actividades, aiu, iva };
      const rc = Sobre.recalcular({ presupuesto:po }, formulario);
      const t = rc.totales;
      /* Administración: el personal ofrecido, costeado por el plazo, y el resto en «Otros». */
      const meses = 9;
      let filasPer = PERSONAS[clave].map(([cargo, , , , , ded, mensual]) => ({ cargo, dedicacion:ded, meses, mensual }));
      const costo = L => L.reduce((s, f) => s + f.dedicacion / 100 * f.meses * f.mensual, 0);
      if (costo(filasPer) > t.a * 0.85){ const esc = t.a * 0.85 / costo(filasPer); filasPer.forEach(f => f.mensual = Util.redondear(f.mensual * esc)); }
      const valorPer = Util.redondear(costo(filasPer));
      const desglose = [{ concepto:'Personal de dirección y administración', valor:valorPer, filas:filasPer },
        { concepto:'Pólizas', valor:Util.redondear((t.a - valorPer) * 0.4) }, { concepto:'Otros', valor:t.a - valorPer - Util.redondear((t.a - valorPer) * 0.4) }];
      const totalesDeclarados = Util.copia(t);
      if (clave === 'epsilon'){ totalesDeclarados.total = t.total - 3250000; totalesDeclarados.costoDirecto = t.costoDirecto - 2730000; }
      po.desgloseAdministracion = desglose;
      po.totales = totalesDeclarados;
      /* Personal */
      const porReq = { 'Director de obra':'PER-01', 'Residente de obra':'PER-02', 'Profesional SST':'PER-03', 'Maestro de obra':'PER-04' };
      const respuestas = {};
      const personal = [];
      PERSONAS[clave].forEach(([cargo, nombre, documento, matricula, anios, dedicacion]) => {
        const codigo = porReq[cargo];
        const fila = { cargo, nombre, documento, profesion:/Ing\./.test(nombre) ? 'Ingeniería civil' : /Arq\./.test(nombre) ? 'Arquitectura' : cargo === 'Profesional SST' ? 'Seguridad y salud en el trabajo' : 'Construcción',
          matricula, anios, dedicacion };
        respuestas[codigo] = (respuestas[codigo] || []).concat([fila]);
        personal.push(Object.assign({ requisito:codigo, fila:respuestas[codigo].length - 1 }, fila));
      });
      /* Experiencia: tres contratos ficticios terminados, de 0,8 veces el presupuesto oficial cada uno. */
      const contratos = [2021, 2023, 2024].map((anio, i) => ({ contratante:'DEMO Contratante ficticio ' + (i + 1) + ' de ' + inv.razonSocial.replace(/^DEMO /, ''),
        objeto:'Construcción de vivienda campestre (demostración)', inicio:(anio - 1) + '-03-01', terminacion:anio + '-06-30',
        valor:Util.redondear(t.total * 0.8), participacion:100, area:Math.round(AREAS[clave] / 3), tipologia:'Vivienda campestre' }));
      respuestas['EXP-01'] = contratos;
      respuestas['EXP-02'] = contratos;
      /* Financiero */
      const fin = clave === 'delta' ? null : Object.assign({ fechaCorte:(Number(cierre.slice(0, 4)) - 1) + '-12-31' }, FINANCIERO[clave]);
      requisitos.filter(r => (r.tabla||{}).plantilla === 'financiero').forEach(r => { respuestas[r.codigo] = fin ? [fin] : [Object.assign({ fechaCorte:(Number(cierre.slice(0, 4)) - 1) + '-12-31' }, Tecnico.combinarConsorcio(INTEGRANTES_DELTA))]; });
      respuestas['TEC-01'] = programacion;
      respuestas['TEC-04'] = [{ equipo:'Retroexcavadora de llantas (demostración)', cantidad:1, propiedad:'Alquilado' }];
      const proveedores = [{ insumo:'Concreto premezclado', proveedor:'DEMO Concretos ficticios S.A.S.', nit:'999300001' }, { insumo:'Acero de refuerzo', proveedor:'DEMO Aceros ficticios S.A.S.', nit:'999300002' }];
      respuestas['TEC-05'] = proveedores;
      const organigrama = PERSONAS[clave].map(([cargo, nombre], i) => ({ cargo, nombre, reportaA:i === 0 ? '' : 'Director de obra' }));
      /* Económicos, como los calcula ARKEN OFERTA */
      respuestas['ECO-01'] = 'Sí'; respuestas['ECO-02'] = 'Sí'; respuestas['ECO-03'] = 'Sí'; respuestas['ECO-04'] = totalesDeclarados.total;
      respuestas['ECO-05'] = t.total <= Calculo.totales(base).total ? 'Sí' : 'No';
      /* Documentos */
      const documentos = reqDoc.map(r => ({ requisito:r.codigo, nombre:r.codigo + ' ' + r.nombre + ' (DEMO).pdf', fechaDocumento:iso(cierre, -10), vigenteHasta:iso(cierre, 400), autor:inv.razonSocial }));
      ['SG-01','SG-05'].concat(clave === 'alfa' || clave === 'delta' ? ['SG-02'] : []).forEach(c => { const r = requisitos.find(x => x.codigo === c);
        if (r && !(clave === 'gamma' && c === 'SG-05')) documentos.push({ requisito:c, nombre:c + ' ' + r.nombre + ' (DEMO).pdf', fechaDocumento:iso(cierre, -120), vigenteHasta:iso(cierre, 600), autor:inv.razonSocial }); });
      if (clave === 'delta'){
        const jur = documentos.find(d => d.requisito === 'JUR-02');
        if (jur){ jur.fechaDocumento = iso(cierre, -50); jur.vigenteHasta = iso(cierre, -5); }
        const r9 = requisitos.find(x => x.codigo === 'JUR-09');
        if (r9) documentos.push({ requisito:'JUR-09', nombre:'JUR-09 ' + r9.nombre + ' (DEMO).pdf', fechaDocumento:iso(cierre, -20), vigenteHasta:'', autor:inv.razonSocial });
      }
      const oferta = { formato:Sobre.FORMATO_OFERTA, version:1, proceso:ctx.proceso.codigo, versionPliego:ctx.versionPliego, generado:iso(cierre, -2) + 'T15:00:00.000Z',
        proponente:{ razonSocial:inv.razonSocial, nit:inv.nit, tipo:clave === 'delta' ? 'consorcio' : 'juridica', representante:inv.contacto.nombre, documentoRepresentante:'CC 99900000' + (k + 1),
          domicilio:'Medellín (dirección ficticia)', direccion:'Calle ficticia ' + (k + 10) + ' # 00-0' + k, telefono:'300 000 00' + String(k + 10), correo:inv.contacto.correo, codigoInvitacion:inv.codigoInvitacion },
        presupuesto:po, personal, experiencia:contratos.map((c, i) => Object.assign({ requisito:'EXP-01', fila:i }, c)), financiero:fin,
        programacion:{ requisito:'TEC-01', filas:programacion }, organigrama, proveedores:proveedores.map((p, i) => Object.assign({ requisito:'TEC-05', fila:i }, p)),
        sistemasGestion:[], respuestas, adjuntos:[], demo:true };
      if (clave === 'delta') oferta.consorcio = { tipo:'consorcio', integrantes:Util.copia(INTEGRANTES_DELTA) };
      return { clave, invitadoId:inv.id, oferta, documentos };
    });
  }
  const primeras = new WeakMap();
  /** Primera actividad de cada capítulo (la predecesora del capítulo siguiente). */
  function primerasDe(base){
    if (primeras.has(base)) return primeras.get(base);
    const m = {};
    (base.capitulos||[]).forEach(c => { const a = ((c.subs||[])[0] || { acts:[] }).acts[0]; if (a) m[c.codigo] = a.codigo; });
    primeras.set(base, m);
    return m;
  }

  return { ORDEN, PERFILES, generar, ruido };
})();
