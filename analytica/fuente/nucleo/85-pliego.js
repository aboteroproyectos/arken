/* ══════════════════════════════════════════════════════════════════════════
   PLIEGO DE CONDICIONES (§12.1) — el contenido, en bloques neutros que el
   módulo Pdf dibuja con el estilo de ARKEN. Separar el contenido del dibujo
   permite probar en Node lo que importa: que el formulario de cantidades no
   lleve un solo precio del presupuesto base (salvo el total, si el proceso
   lo hace visible), y que cada sección esté en su orden.
   ══════════════════════════════════════════════════════════════════════════ */
const Pliego = (function(){

  const METODOS = {
    menor:{ nombre:'Menor valor', formula:'Puntaje = Puntaje máximo × (Valor mínimo entre las ofertas válidas / Valor de la oferta).' },
    cercania:{ nombre:'Cercanía al presupuesto base', formula:'Recibe el puntaje máximo la oferta más cercana al presupuesto base, por debajo o por encima. Las demás pierden puntos en proporción a su distancia: Puntaje = Puntaje máximo × (1 − k × |Valor de la oferta − Presupuesto base| / Presupuesto base), con k = {{kBajo}} por debajo y k = {{kAlto}} por encima, y nunca menos de cero.' },
    media:{ nombre:'Media aritmética', formula:'X̄ = Σ Vi / n. Para Vi ≤ X̄: Puntaje = Puntaje máximo × (1 − (X̄ − Vi) / X̄). Para Vi > X̄: Puntaje = Puntaje máximo × (1 − 2 × |X̄ − Vi| / X̄).' },
    mediaAlta:{ nombre:'Media aritmética alta', formula:'XA = (Vmáx + X̄) / 2, con Vmáx la oferta válida más alta y X̄ la media aritmética. Para Vi ≤ XA: Puntaje = Puntaje máximo × (1 − (XA − Vi) / XA). Para Vi > XA: Puntaje = Puntaje máximo × (1 − 2 × |XA − Vi| / XA).' },
    geometrica:{ nombre:'Media geométrica con presupuesto oficial', formula:'G = (PO^nv × V1 × V2 × … × Vn)^(1 / (n + nv)), donde PO es el presupuesto oficial y nv el número de veces que se incluye: 1 con 1 a 3 ofertas válidas, 2 con 4 a 6, 3 con 7 a 9, y así sucesivamente. Para Vi ≤ G: Puntaje = Puntaje máximo × (1 − (G − Vi) / G). Para Vi > G: Puntaje = Puntaje máximo × (1 − 2 × |G − Vi| / G).' },
    trm:{ nombre:'Método elegido por la TRM del día de la apertura', formula:'El método se elige con los centavos de la tasa representativa del mercado (TRM) vigente el día de la apertura: de 0,00 a 0,24, media aritmética; de 0,25 a 0,49, media aritmética alta; de 0,50 a 0,74, media geométrica con presupuesto oficial; de 0,75 a 0,99, menor valor. Las fórmulas de cada método son las de este numeral.' }
  };
  const MODALIDADES = ['licitación privada','invitación cerrada','concurso de precios','licitación pública'];
  const TIPOS_CONTRATO = ['precios unitarios','precio global fijo','administración delegada','llave en mano'];

  function generalPorDefecto(){
    return { alcance:'', formaPago:'Actas de obra mensuales por cantidades ejecutadas y recibidas a satisfacción, pagaderas a 30 días.',
      anticipoPct:0, retenidoPct:5, polizasOferta:'Garantía de seriedad de la oferta (requisito JUR-08).',
      polizasContrato:'Buen manejo del anticipo, cumplimiento, salarios y prestaciones sociales, estabilidad de la obra y responsabilidad civil extracontractual, en los valores y vigencias que fije el contrato.',
      regimen:'Derecho privado: Código Civil y Código de Comercio de Colombia.',
      consorcios:true,
      causalesRechazo:['La oferta llega después de la fecha y hora de cierre.','El proponente no cumple un requisito habilitante no subsanable, o no subsana en el plazo.',
        'El proponente modifica cantidades, unidades o descripciones del formulario de precios.','El proponente o su representante está incurso en inhabilidad, incompatibilidad o conflicto de interés.',
        'Se comprueba que la información de la oferta no es veraz.','El proponente incumple el acuerdo de confidencialidad.'],
      reglasSubsanacion:'La EMPRESA PRINCIPAL podrá solicitar que se subsane lo que no asigne puntaje y el pliego marque como subsanable, con un plazo de tres (3) días hábiles. Lo que asigna puntaje no se puede mejorar después del cierre.',
      reglasEmpate:['Mayor puntaje en la evaluación económica.','Mayor puntaje técnico (suma de los demás requisitos ponderables).','Sorteo en audiencia, con acta.'],
      umbralBajoPct:15,
      reglaCorreccion:'Prevalece el precio unitario: el total de cada actividad se recalcula con la cantidad del pliego.',
      metodoEconomico:'menor', kBajo:1, kAlto:2, versionDocumentoTipo:'',
      rechazarSobrePresupuesto:true,
      anexos:[]
    };
  }

  function formula(general){
    const m = METODOS[general.metodoEconomico] || METODOS.menor;
    return m.formula.replace('{{kBajo}}', String(general.kBajo)).replace('{{kAlto}}', String(general.kAlto));
  }

  /** Filas del formulario de cantidades: capítulos, subcapítulos y
      actividades con código, descripción, unidad, cantidad y si el APU es
      obligatorio. Sin precios. */
  function formularioCantidades(pres, politicaApu){
    const exigen = Calculo.exigenApu(pres, politicaApu || 'manual');
    const filas = [];
    (pres.capitulos||[]).forEach(c => {
      filas.push({ tipo:'cap', celdas:[c.codigo, c.nombre, '', '', ''] });
      (c.subs||[]).forEach(s => {
        filas.push({ tipo:'sub', celdas:[s.codigo, s.nombre, '', '', ''] });
        (s.acts||[]).forEach(a => filas.push({ tipo:'act', celdas:[a.codigo, a.nombre, a.unidad, Util.cant(a.cantidad), exigen.has(a.id) ? 'Sí' : 'No'] }));
      });
    });
    return filas;
  }

  /** Bloques del pliego, en el orden de §12.1. ctx = { empresa, proceso, presupuesto,
      requisitos, documentos, versionPliego, huella } */
  function bloques(ctx){
    const p = ctx.proceso, e = ctx.empresa || {}, g = Object.assign(generalPorDefecto(), p.general || {});
    const pres = ctx.presupuesto || { capitulos:[] };
    const B = [];
    const n = { s:0 };
    const sec = (titulo) => { n.s++; B.push({ t:'sec', nivel:1, num:String(n.s), txt:n.s + '. ' + titulo }); };
    const sub = (titulo) => B.push({ t:'sec', nivel:2, txt:titulo });
    const texto = (txt, o) => B.push(Object.assign({ t:'texto', txt }, o||{}));

    B.push({ t:'portada', eyebrow:'Pliego de condiciones', titulo:p.nombre || 'Proceso', clave:p.codigo || '',
      lineas:[p.objeto || '', e.razonSocial ? 'EMPRESA PRINCIPAL: ' + e.razonSocial + (e.nit ? ' · NIT ' + Nit.formatear(e.nit, e.dv) : '') : '',
        'Versión del pliego: ' + (ctx.versionPliego || 1), 'Fecha: ' + Util.fmtFechaLarga(ctx.fecha || Util.hoyISO()),
        ctx.huella ? 'Huella del contenido: ' + ctx.huella : ''].filter(Boolean),
      demo: !!p.demo });
    B.push({ t:'indice' });

    sec('Información general');
    B.push({ t:'kv', cols:1, pares:[
      ['Objeto', p.objeto || '—'], ['Alcance', g.alcance || p.objeto || '—'],
      ['Ubicación', [p.ubicacionObra, p.ciudad, p.pais].filter(Boolean).join(', ') || '—'],
      ['Modalidad', p.modalidad || '—'], ['Tipo de contrato', p.tipoContrato || '—'],
      ['Área construida', p.areaConstruida ? Util.cant(p.areaConstruida) + ' m²' : '—'],
      ['Plazo máximo', p.plazoMaximoDias ? p.plazoMaximoDias + ' días calendario' : '—'],
      ['Forma de pago', g.formaPago || '—'],
      ['Anticipo', Number(g.anticipoPct) > 0 ? g.anticipoPct + ' % del valor del contrato' : 'No hay anticipo'],
      ['Retenido de garantía', Number(g.retenidoPct) > 0 ? g.retenidoPct + ' % de cada acta, que se devuelve con la liquidación' : 'No hay retenido'],
      ['Pólizas exigidas con la oferta', g.polizasOferta || '—'], ['Pólizas exigidas en el contrato', g.polizasContrato || '—'],
      ['Régimen jurídico', g.regimen || '—'], ['Moneda', p.moneda || 'COP']
    ]});
    if (p.presupuestoOficialVisible) texto('Presupuesto oficial: ' + Util.money(Calculo.totales(pres).total) + ' (valor total, AIU e IVA incluidos).', { negrita:true });

    sec('Cronograma del proceso');
    const cron = (p.cronograma && p.cronograma.hitos) || [];
    B.push({ t:'tabla', cabeza:['Hito','Fecha','Hora'], anchos:[110, 45, 25],
      filas:cron.filter(h => h.activo !== false).map(h => ({ celdas:[h.nombre, Util.fmtFecha(h.fecha), h.hora || '—'] })) });
    texto('Los plazos se cuentan en ' + ((p.cronograma && p.cronograma.habiles) ? 'días hábiles de Colombia (sin sábados, domingos ni festivos de la Ley 51 de 1983)' : 'días calendario') +
      '. Las horas son de ' + ((p.cronograma && p.cronograma.zona) || 'America/Bogota') + '.', { gris:true });

    sec('Reglas de participación');
    sub('Quién puede ofertar');
    texto('Solo pueden ofertar las personas invitadas a este proceso, con el paquete de invitación que recibieron a su nombre. ' +
      (g.consorcios ? 'Se admiten consorcios y uniones temporales; cada integrante debe cumplir lo exigido a cada uno.' : 'No se admiten consorcios ni uniones temporales.'));
    sub('Causales de rechazo');
    B.push({ t:'lista', items:g.causalesRechazo });
    sub('Subsanación');
    texto(g.reglasSubsanacion);
    sub('Corrección aritmética');
    texto('Los totales de cada oferta se recalculan con las cantidades del pliego y los precios unitarios ofrecidos. ' + g.reglaCorreccion);
    sub('Oferta con valor artificialmente bajo');
    texto('Si el valor total de una oferta queda más de ' + g.umbralBajoPct + ' % por debajo de la mediana de las ofertas válidas, se pedirá al proponente que lo justifique por escrito. El comité decide si acepta la justificación; si no la acepta, la oferta se rechaza.');
    if (g.rechazarSobrePresupuesto) texto('Se rechazará la oferta cuyo valor total supere el presupuesto oficial.');
    sub('Desempate');
    B.push({ t:'lista', items:g.reglasEmpate, numerada:true });
    sub('Método de evaluación económica');
    texto((METODOS[g.metodoEconomico] || METODOS.menor).nombre + '.', { negrita:true });
    texto(formula(g));
    if (g.metodoEconomico !== 'menor' && g.metodoEconomico !== 'cercania')
      texto('Fórmulas tomadas de los documentos tipo de Colombia Compra Eficiente para obra pública' + (g.versionDocumentoTipo ? ', ' + g.versionDocumentoTipo : '') + '.', { gris:true });

    sec('Requisitos de la oferta');
    const req = (ctx.requisitos||[]).filter(r => r.activo !== false);
    const total = PlantillaCondiciones.puntosPonderables(req);
    texto('Los requisitos habilitantes se cumplen o no se cumplen y no dan puntos. Los ponderables reparten ' + total + ' puntos. Una oferta que no cumpla un habilitante no subsanable, o que no lo subsane en el plazo, no se puntúa.');
    PlantillaCondiciones.GRUPOS.forEach(grupo => {
      const del = req.filter(r => r.grupo === grupo);
      if (!del.length) return;
      sub(grupo);
      B.push({ t:'tabla', cabeza:['Código','Requisito','Naturaleza','Cómo se verifica','Puntos'], anchos:[16, 62, 24, 64, 14],
        filas:del.map(r => ({ celdas:[r.codigo, r.nombre + (r.descripcion ? '. ' + r.descripcion : '') + (r.condicional ? ' ' + r.condicional : ''),
          (r.naturaleza === 'ponderable' && r.tambienHabilitante ? 'Habilitante y ponderable' : r.naturaleza.charAt(0).toUpperCase() + r.naturaleza.slice(1)) +
            (r.subsanable ? ' · subsanable' : ' · no subsanable') + (r.obligatorio ? '' : ' · opcional'),
          (r.reglasVerificacion||[]).join('; ') + (r.notaSubsanable ? ' ' + r.notaSubsanable : '') +
            (r.reglaPuntaje ? (r.reglasVerificacion && r.reglasVerificacion.length ? '. ' : '') + 'Puntaje: ' + (PlantillaCondiciones.TIPOS_REGLA[r.reglaPuntaje.tipo]||'') +
              (r.reglaPuntaje.criterio ? ' (' + r.reglaPuntaje.criterio + ')' : r.reglaPuntaje.criterios ? ' (' + r.reglaPuntaje.criterios + ')' : '') : ''),
          r.naturaleza === 'ponderable' ? String(r.puntajeMaximo) : '—'] })) });
    });

    sec('Formulario de cantidades');
    const politica = { todas:'todas las actividades', pareto:'las actividades que suman el 80 % del valor del presupuesto (marcadas con «Sí»)', manual:'las actividades marcadas con «Sí»' }[p.politicaApu || 'manual'];
    texto('El proponente cotiza cada actividad sin cambiar su código, descripción, unidad ni cantidad. Se exige análisis de precios unitarios (APU) en ' + politica + '. Las observaciones a las cantidades se presentan como preguntas, dentro del plazo.');
    B.push({ t:'tabla', cabeza:['Código','Descripción','Unidad','Cantidad','APU obligatorio'], anchos:[20, 100, 18, 24, 22],
      alinear:{ 3:'right', 4:'center' }, filas:formularioCantidades(pres, p.politicaApu) });
    if (p.presupuestoOficialVisible) texto('Valor total del presupuesto oficial: ' + Util.money(Calculo.totales(pres).total) + '.', { negrita:true });

    sec('Documentos del proceso');
    const docs = (ctx.documentos||[]).filter(d => d.visibleParaProponentes !== false && d.vigente !== false);
    B.push({ t:'tabla', cabeza:['Documento','Clase','Disciplina','Versión','Huella SHA-256'], anchos:[54, 24, 26, 14, 66], letraChica:true,
      filas:docs.map(d => ({ celdas:[d.nombre + (d.enlace ? ' (por enlace)' : ''), d.clase || '—', d.disciplina || '—', String(d.version || 1), d.sha256 || '—'] })) });

    sec('Instrucciones para ARKEN OFERTA y para entregar el sobre');
    B.push({ t:'lista', numerada:true, items:[
      'Abra con doble clic el archivo ARKEN_OFERTA_' + Util.codigoArchivo(p.codigo) + '.html que viene en su paquete. Funciona sin internet y sin instalar nada, en Chrome, Edge, Firefox o Safari recientes.',
      'El programa comprueba que el pliego es auténtico y que ningún archivo del paquete fue alterado. Si algo no coincide, no deja ofertar: pida un paquete nuevo.',
      'Cree su usuario local, diligencie cada módulo y adjunte los documentos contra el requisito que corresponde.',
      'En «Revisar y generar sobre», corrija lo que aparezca en rojo y genere el sobre. Su nombre empieza por la razón social de su empresa.',
      'Entregue el sobre antes de la fecha y hora de cierre por el medio que indica la invitación. Puede entregar uno nuevo antes del cierre: se tendrá en cuenta el último.',
      'Las ofertas viajan cifradas y solo se abren después del cierre, en una apertura con acta.'
    ]});

    sec('Anexos');
    B.push({ t:'lista', items:['Anexo 1 · Modelo de carta de presentación de la oferta.', 'Anexo 2 · Compromiso anticorrupción.',
      'Anexo 3 · Acuerdo de confidencialidad (documento aparte en el paquete).'].concat((g.anexos||[]).map((a, i) => 'Anexo ' + (i + 4) + ' · ' + a)) });
    sub('Anexo 1 · Modelo de carta de presentación de la oferta');
    texto('Señores ' + (e.razonSocial || 'EMPRESA PRINCIPAL') + '. Referencia: proceso ' + (p.codigo||'') + ', «' + (p.nombre||'') + '». ' +
      'El suscrito, en nombre de [razón social del proponente], NIT [NIT], presenta oferta para el objeto del proceso. Declaro que conozco y acepto el pliego, sus adendas y las respuestas publicadas; que la oferta es irrevocable y vigente por noventa (90) días desde el cierre; que la información entregada es veraz; que no estamos incursos en inhabilidades, incompatibilidades ni conflictos de interés; y que el valor total de la oferta es el que resulta del formulario de precios. Firma del representante legal: ____________________.');
    sub('Anexo 2 · Compromiso anticorrupción');
    texto('El proponente se compromete a no ofrecer ni dar dádivas, sobornos ni ventajas indebidas a ningún empleado, asesor o contratista de la EMPRESA PRINCIPAL; a no acordar precios, condiciones ni la presentación o abstención de ofertas con otros proponentes (Ley 1340 de 2009 y artículo 410A del Código Penal); y a denunciar cualquier hecho de corrupción que conozca. El incumplimiento de este compromiso es causal de rechazo de la oferta y de terminación del contrato. Firma del representante legal: ____________________.');
    return B;
  }

  /** Huella rápida y síncrona del contenido (FNV-1a de 32 bits, dos pasadas):
      no es criptográfica; solo sirve para saber si el pliego que se revisó
      sigue siendo el de hoy. La huella SHA-256 del PDF se calcula aparte. */
  function huellaContenido(bloquesPliego){
    const s = JSON.stringify(bloquesPliego.filter(b => b.t !== 'portada'));
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < s.length; i++){
      h1 ^= s.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0;
      h2 ^= s.charCodeAt(s.length - 1 - i); h2 = Math.imul(h2, 16777619) >>> 0;
    }
    return h1.toString(16).padStart(8,'0') + h2.toString(16).padStart(8,'0');
  }
  return { METODOS, MODALIDADES, TIPOS_CONTRATO, generalPorDefecto, formula, formularioCantidades, bloques, huellaContenido };
})();
