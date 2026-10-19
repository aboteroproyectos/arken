/* ─────────────── Asistente de IA (§18.13): la parte sin pantalla ───────────────
   Arma las solicitudes a la API de Claude y revisa lo que vuelve. No llama a
   la red (eso lo hace el principal con el SDK oficial) y corre en Node para
   las pruebas, con una API simulada.

   · Lectura: la IA devuelve cada dato con la herramienta registrar_dato
     (strict:true), con el texto literal y la página. Un dato se acepta solo
     si ese texto está en el texto que pdf.js sacó del documento y si el valor
     está dentro de ese texto. La herramienta no tiene campos de cumplimiento
     ni de puntaje: la IA no puede escribirlos.
   · Redacción: la IA propone los textos del concepto a partir de los hechos
     de la evaluación (Concepto.generar y las alertas confirmadas). Una
     propuesta con una cifra o un nombre que no estén en esos hechos se
     rechaza por partes. Lo aceptado lo acepta una persona. */
const AsistenteIA = (function(){
  /* Dólares por millón de tokens (precios públicos de la API, los mismos de ARKEN PRECIOS). */
  const MODELOS = [
    { id:'claude-opus-5-5', nombre:'Claude Opus 5.5', entrada:4, salida:20, maxTokens:16000 },
    { id:'claude-sonnet-5-5', nombre:'Claude Sonnet 5.5', entrada:2, salida:10, maxTokens:16000 },
    { id:'claude-haiku-4-5', nombre:'Claude Haiku 4.5', entrada:1, salida:5, maxTokens:8000 }
  ];
  const POR_DEFECTO = { modelo:'claude-opus-5-5', topeMensualUsd:10 };
  /* Tokens que cuenta la API por página de PDF (texto más imagen), estimados por lo alto. */
  const TOKENS_PAGINA = 2600;

  function perfil(id){ return MODELOS.find(m => m.id === id) || { id, nombre:id, entrada:5, salida:25, maxTokens:8000 }; }
  function configuracion(c){
    const x = Object.assign({}, POR_DEFECTO, c || {});
    x.modelo = String(x.modelo || POR_DEFECTO.modelo).trim() || POR_DEFECTO.modelo;
    x.topeMensualUsd = Math.max(0, Number(x.topeMensualUsd) || 0);
    return x;
  }
  function mes(fecha){ return String(fecha || new Date().toISOString()).slice(0, 7); }
  function usd(n){ return 'US$ ' + (Math.round(Number(n || 0) * 100) / 100).toFixed(2); }

  /* ── Lo que el evaluador puede pedir que se lea ── */
  const CAMPOS = [
    ['fecha_expedicion', 'Fecha de expedición del documento'], ['objeto_social', 'Objeto social'], ['facultades', 'Facultades y límites del representante legal'],
    ['representante_legal', 'Nombre del representante legal'], ['valor_asegurado', 'Valor asegurado'], ['vigencia_desde', 'Vigencia: desde'], ['vigencia_hasta', 'Vigencia: hasta'],
    ['contratante', 'Contratante (certificado de experiencia)'], ['objeto_contrato', 'Objeto del contrato'], ['valor_contrato', 'Valor del contrato'],
    ['fecha_inicio', 'Fecha de inicio del contrato'], ['fecha_terminacion', 'Fecha de terminación del contrato'], ['area_construida', 'Área construida'], ['participacion', 'Porcentaje de participación'],
    ['activo_corriente', 'Activo corriente'], ['pasivo_corriente', 'Pasivo corriente'], ['activo_total', 'Activo total'], ['pasivo_total', 'Pasivo total'], ['patrimonio', 'Patrimonio'],
    ['utilidad_operacional', 'Utilidad operacional'], ['gastos_intereses', 'Gastos de intereses'], ['matricula_profesional', 'Matrícula profesional'], ['otro', 'Otro dato que pide el evaluador']
  ].map(([k, n]) => ({ k, nombre:n }));
  /* Los campos que suelen servir para cada grupo de requisitos. */
  const POR_GRUPO = {
    'Jurídico':['fecha_expedicion', 'objeto_social', 'facultades', 'representante_legal', 'valor_asegurado', 'vigencia_desde', 'vigencia_hasta'],
    'Financiero':['activo_corriente', 'pasivo_corriente', 'activo_total', 'pasivo_total', 'patrimonio', 'utilidad_operacional', 'gastos_intereses'],
    'Organizacional':['activo_total', 'patrimonio', 'utilidad_operacional'],
    'Experiencia':['contratante', 'objeto_contrato', 'valor_contrato', 'fecha_inicio', 'fecha_terminacion', 'area_construida', 'participacion'],
    'Personal':['matricula_profesional', 'fecha_expedicion', 'representante_legal']
  };
  function camposDe(grupo){ return (POR_GRUPO[grupo] || ['fecha_expedicion', 'vigencia_hasta', 'otro']).slice(); }
  const NUMERICOS = new Set(['valor_asegurado', 'valor_contrato', 'area_construida', 'participacion', 'activo_corriente', 'pasivo_corriente', 'activo_total', 'pasivo_total', 'patrimonio', 'utilidad_operacional', 'gastos_intereses']);

  const HERRAMIENTA_LECTURA = {
    name:'registrar_dato',
    description:'Registra un dato que usted leyó en el documento adjunto. Haga una llamada por dato. El programa comprueba que el texto literal esté en esa página del documento y que el valor esté dentro de ese texto; lo que no esté se descarta.',
    strict:true,
    input_schema:{
      type:'object', additionalProperties:false, required:['campo', 'valor', 'texto_literal', 'pagina'],
      properties:{
        campo:{ type:'string', enum:CAMPOS.map(c => c.k), description:'Qué dato es.' },
        valor:{ type:'string', description:'El dato tal como aparece en el texto literal (una fecha, un nombre, una cifra con sus separadores).' },
        texto_literal:{ type:'string', description:'Fragmento continuo copiado exactamente del documento (10 a 300 caracteres) que contiene el valor.' },
        pagina:{ type:'integer', description:'Número de la página del documento donde está el texto literal, contando desde 1.' }
      }
    }
  };
  const SISTEMA_LECTURA = [
    'Usted ayuda a un evaluador de propuestas de obra en Colombia a leer un documento de un proponente (un certificado, una póliza, unos estados financieros, una hoja de vida). Recibe el documento en PDF y la lista de datos que el evaluador busca.',
    'Reglas:',
    '1. Registre cada dato encontrado con registrar_dato. Si un dato no está en el documento, no lo registre.',
    '2. texto_literal: copie exactamente, carácter por carácter, un fragmento continuo del documento que contenga el valor. No resuma, no corrija y no use puntos suspensivos.',
    '3. valor: el dato tal como está escrito dentro del texto literal. No calcule, no convierta unidades ni monedas, no sume y no deduzca.',
    '4. pagina: la página del PDF donde está el texto literal, contando desde 1.',
    '5. Usted no decide si el proponente cumple ni asigna puntajes: eso lo hace el evaluador.',
    '6. Al terminar responda en una línea cuántos datos registró.'
  ].join('\n');

  /** Solicitud de lectura: doc = { nombre, base64, paginas }, campos = claves de CAMPOS, otro = texto libre. */
  function solicitudLectura(cfg0, doc, campos, otro){
    const cfg = configuracion(cfg0), p = perfil(cfg.modelo);
    const lista = (campos || []).map(k => CAMPOS.find(c => c.k === k)).filter(Boolean);
    const texto = 'Documento: «' + doc.nombre + '» (' + doc.paginas + ' página' + (doc.paginas === 1 ? '' : 's') + ').\nDatos que busca el evaluador:\n' +
      lista.map(c => '- ' + c.k + ': ' + c.nombre + (c.k === 'otro' && otro ? ' (' + otro + ')' : '')).join('\n');
    return { model:cfg.modelo, max_tokens:Math.min(4000, p.maxTokens), system:SISTEMA_LECTURA, tools:[HERRAMIENTA_LECTURA], tool_choice:{ type:'auto' },
      messages:[{ role:'user', content:[{ type:'document', source:{ type:'base64', media_type:'application/pdf', data:doc.base64 }, title:doc.nombre }, { type:'text', text:texto }] }] };
  }

  /* ── Comprobación literal ── */
  function plano(t){ return String(t || '').normalize('NFKC').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function digitos(t){ return String(t || '').replace(/\D/g, ''); }
  /** Revisa los datos que devolvió la IA contra el texto de cada página (paginas[i] = texto de la página i+1). */
  function validarLectura(datos, paginas){
    const P = (paginas || []).map(plano);
    return (datos || []).map(d0 => {
      const d = { campo:String(d0.campo || ''), valor:String(d0.valor || ''), texto:String(d0.texto_literal || ''), pagina:Math.round(Number(d0.pagina) || 0) };
      const lit = plano(d.texto);
      const campo = CAMPOS.find(c => c.k === d.campo);
      if (!campo) return Object.assign(d, { aceptado:false, motivo:'Campo desconocido.' });
      if (lit.length < 4) return Object.assign(d, { aceptado:false, motivo:'El texto literal está vacío o es muy corto.' });
      let pag = d.pagina >= 1 && d.pagina <= P.length && P[d.pagina - 1].indexOf(lit) >= 0 ? d.pagina : 0, corregida = false;
      if (!pag){ const k = P.findIndex(t => t.indexOf(lit) >= 0); if (k >= 0){ pag = k + 1; corregida = true; } }
      if (!pag) return Object.assign(d, { aceptado:false, motivo:'El texto literal no está en el documento leído: se descarta.' });
      const enLiteral = NUMERICOS.has(d.campo) && digitos(d.valor) ? digitos(d.texto).indexOf(digitos(d.valor)) >= 0 : lit.indexOf(plano(d.valor)) >= 0;
      if (!plano(d.valor) || !enLiteral) return Object.assign(d, { aceptado:false, motivo:'El valor no está dentro del texto literal: se descarta.' });
      return Object.assign(d, { pagina:pag, aceptado:true, nombreCampo:campo.nombre, motivo:corregida ? 'El texto está en la página ' + pag + ', no en la ' + d.pagina + ' que dijo la IA.' : '' });
    });
  }
  /** Los datos de las herramientas en un mensaje de la API. */
  function datosDe(msg){ return ((msg && msg.content) || []).filter(b => b.type === 'tool_use' && b.name === 'registrar_dato').map(b => b.input || {}); }

  /* ── Redacción ── */
  const HERRAMIENTA_REDACCION = {
    name:'proponer_redaccion',
    description:'Propone los textos del concepto de adjudicación. Use solo los hechos entregados; cada cifra y cada nombre deben estar en ellos.',
    strict:true,
    input_schema:{
      type:'object', additionalProperties:false, required:['resumen', 'recomendacion', 'condiciones', 'riesgos'],
      properties:{
        resumen:{ type:'string', description:'Resumen del proceso y de las ofertas, en uno o dos párrafos.' },
        recomendacion:{ type:'string', description:'Recomendación al comité, con su porqué.' },
        condiciones:{ type:'array', items:{ type:'string' }, description:'Condiciones de la recomendación, una por elemento.' },
        riesgos:{ type:'array', description:'Riesgos de adjudicar a cada uno de los dos primeros del orden.', items:{ type:'object', additionalProperties:false, required:['proponente', 'riesgos'],
          properties:{ proponente:{ type:'string', description:'Nombre exacto del proponente, como está en los hechos.' }, riesgos:{ type:'array', items:{ type:'string' } } } } }
      }
    }
  };
  const SISTEMA_REDACCION = [
    'Usted redacta, para el comité evaluador de una empresa constructora en Colombia, el borrador del concepto de adjudicación de un proceso de contratación de obra. Recibe los hechos de la evaluación en JSON: el orden de elegibilidad, los puntajes, las alertas confirmadas, los requisitos y lo que el programa ya redactó.',
    'Reglas:',
    '1. Use solo esos hechos. No agregue cifras, nombres, fechas ni hechos que no estén en ellos; no suponga nada sobre los proponentes.',
    '2. Escriba en español de Colombia, formal y claro, en tercera persona. Las cifras, como están en los hechos.',
    '3. Recomiende al primero del orden de elegibilidad, si el puntaje no es provisional, y diga por qué con los hechos. Si es provisional, diga que no se recomienda aún.',
    '4. Es un borrador: la decisión es del comité. No diga que el contrato está adjudicado.',
    '5. Entregue los textos con proponer_redaccion, una sola vez.'
  ].join('\n');
  /** Los hechos que se entregan a la IA para redactar: lo del concepto generado, sin los textos del comité. */
  function hechos(generado, alertasConfirmadas){
    const g = generado || {};
    return { resumenPrograma:g.resumen, recomendacionPrograma:g.recomendacion, provisional:!!g.provisional, recomendado:g.recomendado ? (g.orden.find(f => f.id === g.recomendado) || {}).nombre : null,
      orden:(g.orden || []).map(f => ({ puesto:f.puesto, nombre:f.nombre, total:f.total })), noHabilitadas:(g.noHabilitadas || []).map(x => ({ nombre:x.nombre, causales:x.causales || [] })),
      porGrupo:(g.porGrupo || []).map(x => ({ grupo:x.grupo, requisitos:x.requisitos.map(r => ({ codigo:r.codigo, nombre:r.nombre, porque:r.porque })) })),
      fortalezas:g.fortalezas, debilidades:g.debilidades, condicionesPrograma:g.condiciones, riesgosPrograma:g.riesgos,
      alertasConfirmadas:(alertasConfirmadas || []).map(a => ({ titulo:a.titulo, nivel:a.nivel, porque:a.porque })) };
  }
  function solicitudRedaccion(cfg0, H){
    const cfg = configuracion(cfg0), p = perfil(cfg.modelo);
    return { model:cfg.modelo, max_tokens:Math.min(6000, p.maxTokens), system:SISTEMA_REDACCION, tools:[HERRAMIENTA_REDACCION], tool_choice:{ type:'tool', name:'proponer_redaccion' },
      messages:[{ role:'user', content:'Hechos de la evaluación (JSON):\n' + JSON.stringify(H) }] };
  }
  /** Cifras de un texto: grupos de dígitos con sus separadores, normalizados a solo dígitos (de 2 o más). */
  function cifras(t){ return (String(t || '').match(/\d[\d.,]*/g) || []).map(digitos).filter(x => x.length >= 2); }
  /** Revisa la propuesta: cada cifra debe estar en los hechos; cada proponente de los riesgos, en el orden. */
  function validarRedaccion(prop, H){
    const fuente = JSON.stringify(H);
    const conocidas = new Set(cifras(fuente));
    // Los puntajes y valores se pueden escribir con o sin decimales.
    (H.orden || []).forEach(f => { conocidas.add(digitos(Math.round(f.total))); conocidas.add(digitos(f.total)); });
    const nombres = (H.orden || []).map(f => f.nombre);
    const revisar = t => { const malas = cifras(t).filter(x => !conocidas.has(x) && !Array.from(conocidas).some(c => c.indexOf(x) === 0 && x.length >= 4)); return malas.length ? 'Tiene cifras que no están en la evaluación: ' + malas.slice(0, 3).join(', ') + '.' : ''; };
    const out = { partes:[] };
    const parte = (clave, valor, nombre) => { const motivo = revisar(Array.isArray(valor) ? valor.join(' ') : valor); out.partes.push({ clave, nombre, valor, aceptable:!motivo && !!(Array.isArray(valor) ? valor.length : String(valor || '').trim()), motivo }); };
    const P = prop || {};
    parte('resumen', String(P.resumen || ''), 'Resumen');
    parte('recomendacion', String(P.recomendacion || ''), 'Recomendación');
    parte('condiciones', (P.condiciones || []).map(String), 'Condiciones');
    (P.riesgos || []).forEach(r => {
      const n = nombres.find(x => plano(x) === plano(r.proponente));
      if (!n){ out.partes.push({ clave:'riesgos', nombre:'Riesgos de ' + r.proponente, valor:r.riesgos, aceptable:false, motivo:'Ese proponente no está en el orden de elegibilidad.' }); return; }
      const motivo = revisar((r.riesgos || []).join(' '));
      out.partes.push({ clave:'riesgos', proponente:n, nombre:'Riesgos de ' + n, valor:(r.riesgos || []).map(String), aceptable:!motivo, motivo });
    });
    return out;
  }
  function propuestaDe(msg){ const b = ((msg && msg.content) || []).find(x => x.type === 'tool_use' && x.name === 'proponer_redaccion'); return b ? b.input : null; }

  /* ── Costo y tope ── */
  function costo(uso, modelo){
    const p = perfil(modelo), u = uso || {};
    const entrada = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) * 1.25 + (u.cache_read_input_tokens || 0) * 0.1;
    return (entrada * p.entrada + (u.output_tokens || 0) * p.salida) / 1e6;
  }
  /** Costo estimado por lo alto antes de ejecutar. t = { paginas, caracteres, salida } */
  function estimar(cfg0, t){
    const cfg = configuracion(cfg0), p = perfil(cfg.modelo);
    const entrada = 1200 + (t.paginas || 0) * TOKENS_PAGINA + Math.ceil((t.caracteres || 0) / 3);
    const salida = t.salida || 2000;
    return { entrada, salida, usd:(entrada * p.entrada + salida * p.salida) / 1e6 };
  }
  /** Lo gastado en el mes, de los registros de uso { fecha, usd }. */
  function gastoMes(registros, ahora){ const m = mes(ahora); return (registros || []).filter(r => mes(r.fecha) === m).reduce((t, r) => t + (Number(r.usd) || 0), 0); }
  /** Por qué no se puede ejecutar ahora (o '' si se puede). */
  function impedimento(cfg0, gastado, estimado){
    const cfg = configuracion(cfg0);
    if (!(cfg.topeMensualUsd > 0)) return 'El tope de gasto del mes está en cero.';
    if (gastado + estimado > cfg.topeMensualUsd) return 'Con lo estimado (' + usd(estimado) + ') se pasaría el tope del mes: van ' + usd(gastado) + ' de ' + usd(cfg.topeMensualUsd) + '.';
    return '';
  }

  return { MODELOS, POR_DEFECTO, CAMPOS, NUMERICOS, HERRAMIENTA_LECTURA, HERRAMIENTA_REDACCION, perfil, configuracion, camposDe, solicitudLectura, validarLectura, datosDe,
    hechos, solicitudRedaccion, validarRedaccion, propuestaDe, costo, estimar, gastoMes, impedimento, usd, mes, plano };
})();
