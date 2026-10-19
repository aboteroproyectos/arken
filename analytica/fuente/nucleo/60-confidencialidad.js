/* ══════════════════════════════════════════════════════════════════════════
   ACUERDO DE CONFIDENCIALIDAD (§14.1, §14.3 y Anexo D)

   El texto es una plantilla por proceso: cada cláusula se puede editar, y
   los valores variables ({{…}}) se toman del proceso y se muestran
   resaltados en la vista previa para que el abogado los revise.

   Aprobación por abogado: queda guardado el texto EXACTO que el abogado
   aprobó. El acuerdo está aprobado solo mientras el texto que hoy resulta
   de la plantilla y de los valores del proceso sea idéntico al aprobado; si
   cambia una coma, una cláusula o un valor (la cláusula penal, el centro de
   arbitraje), vuelve a «borrador» sin que nadie tenga que acordarse.
   Los datos del invitado no entran en la comparación: son marcadores que se
   llenan en el paquete de cada invitado (Fase 2).
   ══════════════════════════════════════════════════════════════════════════ */
const Confidencialidad = (function(){

  function configPorDefecto(){
    return {
      envios:'dos',                     // 'dos' (acuerdo primero, paquete después) | 'uno' (aceptación dentro de ARKEN OFERTA)
      duracionAnios:5,
      penal:{ modo:'porcentaje', valor:2 },  // 'smmlv' (número de SMMLV) | 'porcentaje' (del presupuesto oficial)
      controversias:'arbitraje',        // 'arbitraje' | 'jueces'
      ciudad:'Medellín',
      centro:'Centro de Arbitraje y Conciliación de la Cámara de Comercio de Medellín para Antioquia',
      firma:'electronica',              // 'manuscrita' | 'notario' | 'electronica'
      existenciaReservada:false,
      textos:{},                        // cláusulas editadas: { idClausula: texto }
      aprobacion:null                   // { nombre, tarjetaProfesional, fecha, usuario, texto, huella, registrado }
    };
  }

  /* ── Números en letras, para las cifras de la cláusula penal y los plazos ── */
  const U = ['','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve','diez','once','doce','trece','catorce',
    'quince','dieciséis','diecisiete','dieciocho','diecinueve','veinte','veintiuno','veintidós','veintitrés','veinticuatro',
    'veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'];
  const D = ['','','','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
  const C = ['','ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];
  function menorMil(n){
    if (n === 0) return '';
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100), r = n % 100;
    let t = c ? C[c] : '';
    if (r){
      const dec = r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' y ' + U[r % 10] : '');
      t = (t ? t + ' ' : '') + dec;
    }
    return t;
  }
  function enLetras(num){
    let n = Math.floor(Math.abs(Number(num)||0));
    if (n === 0) return 'cero';
    const partes = [];
    const millones = Math.floor(n / 1e6), miles = Math.floor((n % 1e6) / 1000), resto = n % 1000;
    if (millones) partes.push(millones === 1 ? 'un millón' : enLetras(millones).replace(/uno$/, 'un') + ' millones');
    if (miles) partes.push(miles === 1 ? 'mil' : menorMil(miles).replace(/uno$/, 'un') + ' mil');
    if (resto) partes.push(menorMil(resto));
    return partes.join(' ');
  }
  /** «VEINTIÚN (21) años»: ante un sustantivo, «uno» se apocopa. */
  function cifra(n, unidad){
    let letras = enLetras(n);
    if (unidad) letras = letras.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
    return letras.toUpperCase() + ' (' + Number(n).toLocaleString('en-US') + ')' + (unidad ? ' ' + unidad : '');
  }

  /* ── Valor de la cláusula penal en pesos y advertencia de proporcionalidad ── */
  function valorPenal(cfg, smmlv, presupuestoOficial){
    const p = (cfg && cfg.penal) || {};
    if (p.modo === 'smmlv') return smmlv ? Number(p.valor||0) * smmlv : null;
    return presupuestoOficial ? Util.redondear(presupuestoOficial * Number(p.valor||0) / 100) : null;
  }
  /** Rango sugerido: del 1 % al 5 % del presupuesto oficial. Por encima del
      10 % la pena empieza a parecer desproporcionada frente al daño que una
      divulgación puede causar en la preparación de una oferta, y el juez
      puede reducirla (artículo 1601 del Código Civil). Es una guía para el
      abogado, no una regla legal: él decide. */
  function revisarPenal(cfg, smmlv, presupuestoOficial){
    const valor = valorPenal(cfg, smmlv, presupuestoOficial);
    const r = { valor, nivel:'ok', mensaje:'', sugerido:null };
    if (presupuestoOficial){
      r.sugerido = { desde:Util.redondear(presupuestoOficial * 0.01), hasta:Util.redondear(presupuestoOficial * 0.05) };
      if (smmlv){ r.sugerido.desdeSmmlv = Math.round(r.sugerido.desde / smmlv); r.sugerido.hastaSmmlv = Math.round(r.sugerido.hasta / smmlv); }
    }
    if (valor === null){ r.nivel = 'warn'; r.mensaje = 'No se puede calcular el valor de la cláusula penal: falta ' +
      ((cfg.penal||{}).modo === 'smmlv' ? 'el SMMLV de la vigencia.' : 'el presupuesto oficial (el total del presupuesto base).'); return r; }
    if (!(valor > 0)){ r.nivel = 'bad'; r.mensaje = 'La cláusula penal está en cero: el acuerdo no tendría una pena pactada.'; return r; }
    if (presupuestoOficial && valor > presupuestoOficial * 0.10){
      r.nivel = 'warn';
      r.mensaje = 'La cláusula penal (' + Util.money(valor) + ') supera el 10 % del presupuesto oficial. Puede considerarse desproporcionada y exponerse a reducción judicial (artículo 1601 del Código Civil, cláusula penal enorme). Rango sugerido: ' +
        Util.money(r.sugerido.desde) + ' a ' + Util.money(r.sugerido.hasta) + '.';
    } else if (presupuestoOficial && valor < presupuestoOficial * 0.005){
      r.nivel = 'warn';
      r.mensaje = 'La cláusula penal (' + Util.money(valor) + ') es menor del 0,5 % del presupuesto oficial: puede no disuadir. Rango sugerido: ' +
        Util.money(r.sugerido.desde) + ' a ' + Util.money(r.sugerido.hasta) + '.';
    }
    return r;
  }

  /* ── Valores del proceso que se insertan en el texto ── */
  function valores(ctx){
    const e = ctx.empresa || {}, p = ctx.proceso || {}, cfg = ctx.config || configPorDefecto();
    const pen = valorPenal(cfg, ctx.smmlv, ctx.presupuestoOficial);
    const penal = (cfg.penal||{}).modo === 'smmlv'
      ? cifra(Number(cfg.penal.valor||0), 'salarios mínimos legales mensuales vigentes al momento del pago') + (pen ? ', equivalentes hoy a ' + Util.money(pen) : '')
      : 'el ' + String(Number((cfg.penal||{}).valor||0)).replace('.', ',') + ' % del presupuesto oficial del Proceso' +
        // En pesos solo si el proceso deja ver el presupuesto oficial: de lo
        // contrario la cifra revelaría el total a cada invitado (§13, criterio 2).
        (pen && p.presupuestoOficialVisible ? ', es decir, ' + cifra(pen, 'pesos colombianos') : '');
    const firmas = {
      manuscrita:'firma manuscrita de sus representantes legales',
      notario:'firma manuscrita de sus representantes legales, con presentación personal ante notario',
      electronica:'firma electrónica de sus representantes legales, en los términos de la Ley 527 de 1999 y del Decreto 2364 de 2012 (compilado en el Decreto 1074 de 2015), y la constancia que emita la plataforma de firma hace parte del Acuerdo'
    };
    return {
      'proceso.codigo':p.codigo || '', 'proceso.nombre':p.nombre || '', 'proceso.objeto':p.objeto || '',
      'proceso.ubicacion':[p.ubicacionObra, p.ciudad].filter(Boolean).join(', '),
      'empresa.razonSocial':e.razonSocial || '', 'empresa.nit':e.nit ? Nit.formatear(e.nit, e.dv) : '',
      'empresa.domicilio':e.ciudad || '', 'empresa.direccion':e.direccion || '', 'empresa.correo':e.correo || '',
      'empresa.representante':e.representante || '', 'empresa.documentoRepresentante':e.documentoRepresentante || '',
      'duracion':cifra(Number(cfg.duracionAnios||5), 'años'),
      'penal':penal,
      'ciudad':cfg.ciudad || '', 'centro':cfg.centro || '',
      'firma':firmas[cfg.firma] || firmas.electronica,
      'plazoDestruccion':'diez (10) días hábiles', 'plazoIncidente':'veinticuatro (24) horas',
      'arregloDirecto':'quince (15) días hábiles'
    };
  }
  const MARCADORES_INVITADO = {
    'invitado.razonSocial':'[razón social del invitado]', 'invitado.nit':'[NIT del invitado]',
    'invitado.domicilio':'[domicilio del invitado]', 'invitado.direccion':'[dirección del invitado]',
    'invitado.correo':'[correo del invitado]', 'invitado.representante':'[representante legal del invitado]',
    'invitado.documentoRepresentante':'[documento del representante del invitado]'
  };

  /* ── Plantilla: Anexo D, con el contenido de §14.1 ── */
  const CLAUSULAS = [
    { id:'comparecientes', titulo:'Comparecientes y facultades', texto:
      'Entre los suscritos, {{empresa.representante}}, identificado con el documento {{empresa.documentoRepresentante}}, quien obra en nombre y representación de {{empresa.razonSocial}}, sociedad identificada con NIT {{empresa.nit}} y domiciliada en {{empresa.domicilio}}, en adelante «LA EMPRESA»; y {{invitado.representante}}, identificado con el documento {{invitado.documentoRepresentante}}, quien obra en nombre y representación de {{invitado.razonSocial}}, identificada con NIT {{invitado.nit}} y domiciliada en {{invitado.domicilio}}, en adelante «EL RECEPTOR», y conjuntamente «LAS PARTES», hemos celebrado el presente Acuerdo de Confidencialidad y No Divulgación (el «Acuerdo»). Cada firmante declara que tiene facultades suficientes para obligar a la persona que representa, según su certificado de existencia y representación legal, y que no requiere autorización adicional de ningún órgano social o, si la requiere, que la ha obtenido.' },
    { id:'consideraciones', titulo:'Consideraciones', texto:
      '1. LA EMPRESA adelanta el proceso de selección {{proceso.codigo}}, «{{proceso.nombre}}» (el «Proceso»), cuyo objeto es {{proceso.objeto}}, en {{proceso.ubicacion}}.\n2. Para que EL RECEPTOR pueda preparar su oferta, LA EMPRESA le entregará información técnica, económica, comercial y jurídica que es reservada, que tiene valor comercial por ser secreta y respecto de la cual LA EMPRESA ha adoptado medidas razonables para mantenerla en secreto.\n3. La divulgación o el uso indebido de esa información causaría a LA EMPRESA, a su cliente y a los diseñadores de la obra perjuicios graves y difíciles de reparar.\n4. Por lo anterior, LAS PARTES acuerdan las cláusulas siguientes.' },
    { id:'objeto', titulo:'Cláusula primera · Objeto', texto:
      'El objeto del Acuerdo es proteger la Información Confidencial que LA EMPRESA entregue o ponga a disposición de EL RECEPTOR con el único fin de que este prepare y presente su oferta en el Proceso. EL RECEPTOR solo podrá usar la Información Confidencial para ese fin, y para ningún otro.' },
    { id:'definiciones', titulo:'Cláusula segunda · Definiciones', texto:
      'Se entiende por «Información Confidencial» toda información que LA EMPRESA, su cliente o sus asesores entreguen o pongan a disposición de EL RECEPTOR con ocasión del Proceso, antes o después de la firma de este Acuerdo, en cualquier forma o soporte (escrito, digital, verbal, visual o en modelos), y en especial: planos, diseños, modelos BIM, estudios técnicos, especificaciones, cantidades de obra, presupuestos, valores, análisis de precios, cronogramas, datos del inmueble y del cliente, datos personales, secretos empresariales, el pliego de condiciones y sus anexos, las respuestas a preguntas y las adendas{{existencia}}. Son también Información Confidencial las notas, análisis, compilaciones y demás documentos que EL RECEPTOR prepare a partir de ella.' },
    { id:'excluida', titulo:'Cláusula tercera · Información excluida', texto:
      'No es Información Confidencial la que EL RECEPTOR demuestre que: (a) es o llega a ser de dominio público sin culpa suya ni de las personas por las que responde; (b) conocía antes de recibirla, según prueba escrita anterior a la entrega; (c) recibió de un tercero que tenía derecho a entregarla sin obligación de reserva; o (d) le es exigida por autoridad competente, caso en el cual dará aviso previo y por escrito a LA EMPRESA, tan pronto conozca la exigencia, y entregará solo lo exigido. La carga de probar cualquiera de estas excepciones corresponde a quien la alega.' },
    { id:'obligaciones', titulo:'Cláusula cuarta · Obligaciones del receptor', texto:
      'EL RECEPTOR se obliga a: (a) guardar reserva absoluta sobre la Información Confidencial; (b) usarla exclusivamente para preparar su oferta en el Proceso; (c) no copiarla ni reproducirla salvo en lo estrictamente indispensable para ese fin; (d) no hacer ingeniería inversa sobre planos, modelos, programas o archivos; (e) no usarla para competir con LA EMPRESA ni para otros proyectos, propios o de terceros; (f) no contactar al cliente, a los diseñadores ni a los proveedores de LA EMPRESA por fuera del canal oficial del Proceso; (g) no compartir información del Proceso con otros invitados u oferentes; y (h) adoptar las medidas de seguridad previstas en la cláusula sexta.' },
    { id:'autorizados', titulo:'Cláusula quinta · Personas autorizadas y responsabilidad por ellas', texto:
      'EL RECEPTOR solo dará acceso a la Información Confidencial a sus empleados, asesores, subcontratistas y proveedores que necesiten conocerla para preparar la oferta, que se relacionan en el Anexo 1, y siempre que cada uno se haya obligado por escrito en términos no menos estrictos que los de este Acuerdo. EL RECEPTOR responde por los actos y omisiones de esas personas como si fueran propios.' },
    { id:'seguridad', titulo:'Cláusula sexta · Medidas de seguridad y aviso de incidentes', texto:
      'EL RECEPTOR protegerá la Información Confidencial con medidas de seguridad razonables, y en ningún caso inferiores a las que usa para su propia información reservada: control de acceso, contraseñas, equipos con cifrado y prohibición de almacenarla en servicios no autorizados. Si conoce cualquier divulgación, pérdida o acceso no autorizado, lo informará por escrito a LA EMPRESA dentro de las {{plazoIncidente}} siguientes a conocerlo, y colaborará con ella para mitigarlo.' },
    { id:'datos', titulo:'Cláusula séptima · Datos personales', texto:
      'Los datos personales que contenga la Información Confidencial se tratarán solo para la finalidad del Proceso, conforme a la Ley 1581 de 2012 y al Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015). Respecto de ellos EL RECEPTOR actuará como encargado del tratamiento y cumplirá las obligaciones que la ley impone a los encargados. LAS PARTES aceptan que LA EMPRESA podrá analizar las ofertas con herramientas de análisis y de inteligencia artificial que operen terceros en calidad de encargados del tratamiento.' },
    { id:'propiedad', titulo:'Cláusula octava · Propiedad intelectual', texto:
      'La entrega de la Información Confidencial no transfiere ni licencia derecho alguno sobre planos, diseños, modelos, programas ni demás obras, que siguen protegidos por la Ley 23 de 1982 y la Decisión 351 de 1993 de la Comunidad Andina, salvo el uso indispensable para preparar la oferta en el Proceso.' },
    { id:'devolucion', titulo:'Cláusula novena · Devolución, destrucción y certificación', texto:
      'Si EL RECEPTOR no resulta adjudicatario, al terminar el Proceso o cuando LA EMPRESA lo solicite, devolverá o destruirá la Información Confidencial y todas sus copias, incluidas las digitales, dentro de los {{plazoDestruccion}} siguientes, y entregará a LA EMPRESA una certificación escrita de destrucción firmada por su representante legal, según el formato del Anexo 2.' },
    { id:'duracion', titulo:'Cláusula décima · Duración', texto:
      'El Acuerdo rige desde su firma. Las obligaciones de reserva duran {{duracion}} contados desde la terminación del Proceso; las relativas a secretos empresariales duran mientras la información conserve ese carácter.' },
    { id:'penal', titulo:'Cláusula undécima · Cláusula penal e indemnización de perjuicios', texto:
      'Por cada incumplimiento de este Acuerdo, EL RECEPTOR pagará a LA EMPRESA, a título de pena, {{penal}}, conforme a los artículos 1592 y siguientes del Código Civil. La pena se pacta expresamente sin perjuicio de la indemnización de los perjuicios que excedan su valor, que LA EMPRESA podrá cobrar en los términos del artículo 1600 del Código Civil, y su pago no extingue la obligación principal.' },
    { id:'consecuencias', titulo:'Cláusula duodécima · Otras consecuencias del incumplimiento', texto:
      'El incumplimiento de este Acuerdo da lugar, además, a: (a) la exclusión inmediata de EL RECEPTOR del Proceso; (b) el rechazo de su oferta; (c) la terminación del contrato si ya le fue adjudicado; y (d) su exclusión de procesos futuros de LA EMPRESA. Todo lo anterior, sin perjuicio de las acciones por violación de secretos empresariales (Decisión 486 de 2000 de la Comunidad Andina, artículos 260 a 266, y Ley 256 de 1996, artículo 16) y de las acciones penales a que haya lugar (Código Penal, artículo 308, violación de reserva industrial o comercial).' },
    { id:'ejecutivo', titulo:'Cláusula decimotercera · Mérito ejecutivo', texto:
      'Este Acuerdo, firmado, presta mérito ejecutivo para el cobro de la cláusula penal, en los términos del artículo 422 del Código General del Proceso. EL RECEPTOR renuncia a los requerimientos para ser constituido en mora, en lo que la ley lo permita.' },
    { id:'cautelares', titulo:'Cláusula decimocuarta · Medidas cautelares', texto:
      'LA EMPRESA podrá solicitar a la autoridad competente las medidas cautelares necesarias para impedir o hacer cesar la divulgación o el uso indebido de la Información Confidencial, sin necesidad de agotar previamente la etapa de arreglo directo.' },
    { id:'sinObligacion', titulo:'Cláusula decimoquinta · Ausencia de obligación de contratar', texto:
      'Este Acuerdo no obliga a LA EMPRESA a contratar con EL RECEPTOR ni a adjudicarle el Proceso, ni le genera responsabilidad por la exactitud o integridad de la Información Confidencial, que se entrega «tal como está», para estudio.' },
    { id:'generales', titulo:'Cláusula decimosexta · Cesión, no renuncia, independencia e integralidad', texto:
      'EL RECEPTOR no podrá ceder este Acuerdo. Que LA EMPRESA no ejerza un derecho no significa que renuncie a él. Si una cláusula resulta inválida, las demás conservan su validez. Este Acuerdo contiene todo lo convenido entre LAS PARTES sobre su objeto y reemplaza cualquier acuerdo anterior sobre la misma materia.' },
    { id:'notificaciones', titulo:'Cláusula decimoséptima · Notificaciones', texto:
      'Las comunicaciones se enviarán por escrito a las direcciones y correos siguientes: LA EMPRESA, {{empresa.direccion}}, {{empresa.correo}}; EL RECEPTOR, {{invitado.direccion}}, {{invitado.correo}}. Cualquier cambio se avisará por escrito.' },
    { id:'ley', titulo:'Cláusula decimoctava · Ley aplicable y solución de controversias', texto:
      'Este Acuerdo se rige por la ley colombiana. Las controversias que surjan de él se intentarán resolver primero por arreglo directo durante {{arregloDirecto}} contados desde el aviso escrito de una parte a la otra. {{solucion}}' },
    { id:'firma', titulo:'Cláusula decimonovena · Perfeccionamiento y firma', texto:
      'El Acuerdo se perfecciona con la {{firma}}.' }
  ];
  function textoSolucion(cfg){
    return cfg.controversias === 'jueces'
      ? 'Si no se resuelven así, serán de conocimiento de los jueces ordinarios del domicilio de LA EMPRESA, en ' + (cfg.ciudad||'') + '.'
      : 'Si no se resuelven así, se someterán a un tribunal de arbitramento, conforme a la Ley 1563 de 2012, del ' + (cfg.centro||'') +
        ', integrado por un árbitro si la cuantía es menor o igual a cuatrocientos (400) SMMLV y por tres en los demás casos, que fallará en derecho y sesionará en ' + (cfg.ciudad||'') + '.';
  }

  /** Cláusulas con sus segmentos: [{ t:'texto' } | { v:'clave', valor, invitado }].
      La vista previa pinta los segmentos «v» resaltados. */
  function armar(ctx){
    const cfg = Object.assign(configPorDefecto(), ctx.config||{});
    const val = valores(Object.assign({}, ctx, { config:cfg }));
    val['solucion'] = textoSolucion(cfg);
    val['existencia'] = cfg.existenciaReservada ? ', y la existencia misma del Proceso' : '';
    return CLAUSULAS.map(cl => {
      const texto = (cfg.textos && cfg.textos[cl.id] !== undefined) ? cfg.textos[cl.id] : cl.texto;
      const segmentos = [];
      let ultimo = 0;
      texto.replace(/\{\{([a-zA-Z.]+)\}\}/g, (m, clave, pos) => {
        if (pos > ultimo) segmentos.push({ t:texto.slice(ultimo, pos) });
        if (MARCADORES_INVITADO[clave] !== undefined)
          segmentos.push({ v:clave, valor:(ctx.invitado && ctx.invitado[clave.slice(9)]) || MARCADORES_INVITADO[clave], invitado:true });
        else {
          const opcional = clave === 'existencia';
          const hay = val[clave] !== undefined && (val[clave] !== '' || opcional);
          segmentos.push({ v:clave, valor: hay ? val[clave] : '[' + clave + ' sin diligenciar]', falta:!hay });
        }
        ultimo = pos + m.length;
        return m;
      });
      if (ultimo < texto.length) segmentos.push({ t:texto.slice(ultimo) });
      return { id:cl.id, titulo:cl.titulo, editado: cfg.textos && cfg.textos[cl.id] !== undefined, plantilla:cl.texto, segmentos };
    });
  }
  function textoPlano(clausulas){
    return clausulas.map(c => c.titulo.toUpperCase() + '\n' + c.segmentos.map(s => s.t !== undefined ? s.t : s.valor).join('')).join('\n\n');
  }
  /** Texto que aprueba el abogado: el del proceso, con los marcadores del invitado sin llenar. */
  function textoParaAprobar(ctx){
    return 'ACUERDO DE CONFIDENCIALIDAD Y NO DIVULGACIÓN — PROCESO ' + ((ctx.proceso||{}).codigo||'') + '\n\n' +
      textoPlano(armar(Object.assign({}, ctx, { invitado:null })));
  }
  function faltantes(ctx){
    const f = new Set();
    armar(Object.assign({}, ctx, { invitado:null })).forEach(c => c.segmentos.forEach(s => { if (s.falta) f.add(s.v); }));
    return Array.from(f);
  }
  /** 'aprobado' solo si el texto aprobado es idéntico al de hoy. */
  function estado(ctx){
    const cfg = (ctx.config)||{};
    if (!cfg.aprobacion || !cfg.aprobacion.texto) return 'borrador';
    return cfg.aprobacion.texto === textoParaAprobar(ctx) ? 'aprobado' : 'borrador';
  }

  const ANEXO_1 = 'ANEXO 1 · PERSONAS AUTORIZADAS\nRelación de las personas de EL RECEPTOR autorizadas para conocer la Información Confidencial (cláusula quinta). Cada una firmó un compromiso de reserva no menos estricto que este Acuerdo.\n\nNombre · Documento · Cargo · Empresa · Firma del compromiso';
  function anexo2(ctx){
    const p = ctx.proceso || {};
    return 'ANEXO 2 · CERTIFICACIÓN DE DESTRUCCIÓN DE INFORMACIÓN CONFIDENCIAL\n\nYo, ____________________, identificado con el documento ____________, en mi calidad de representante legal de ' +
      ((ctx.invitado && ctx.invitado.razonSocial) || '____________________') + ', certifico que el día ____ de ____________ de ______ ' +
      'mi representada devolvió o destruyó la totalidad de la Información Confidencial recibida de ' + ((ctx.empresa||{}).razonSocial||'') +
      ' con ocasión del proceso ' + (p.codigo||'') + ', «' + (p.nombre||'') + '», incluidas todas sus copias en papel y en medios digitales, ' +
      'y que no conserva ninguna copia, extracto ni resumen de ella, conforme a la cláusula novena del Acuerdo de Confidencialidad y No Divulgación.\n\n' +
      'Medios destruidos o devueltos: ________________________________________\n\nFirma: ______________________   Fecha: ______________';
  }
  /** Advertencia para procesos fuera de Colombia (§14.1, último párrafo). */
  function advertenciaPais(pais){
    return pais && Util.normaliza(pais) !== 'colombia'
      ? 'Este texto está construido sobre la ley colombiana. Para invitados de ' + pais + ', debe adaptarlo un abogado de ese país.' : '';
  }
  return { configPorDefecto, CLAUSULAS, armar, textoPlano, textoParaAprobar, faltantes, estado, valores, valorPenal, revisarPenal,
    enLetras, ANEXO_1, anexo2, advertenciaPais, MARCADORES_INVITADO };
})();
