/* ─────────────── Lector de documentos (§18.13), sin internet ───────────────
   Busca en el texto que pdf.js sacó de un documento del proponente los datos
   que pide cada requisito: fechas, valores, porcentajes, áreas, nombres, NIT,
   matrículas e indicadores financieros. Cada dato sale con el fragmento del
   documento donde está y su página, así que todo lo que propone está en el
   documento. No decide si el proponente cumple ni asigna puntajes: el
   evaluador revisa y usa el dato como evidencia si quiere.

   Cómo busca: encuentra en cada página las etiquetas usuales de ese dato
   («valor asegurado», «total activo», «representante legal»…), sin
   importar mayúsculas ni tildes, y toma el primer valor del tipo esperado
   que viene después, en la misma línea o en la siguiente. Prefiere la
   etiqueta más precisa y el valor más cercano, y entrega hasta tres
   coincidencias por dato para que el evaluador elija.

   Límites: no lee imágenes escaneadas (sin texto no hay qué leer) y en
   los estados financieros de varias columnas toma la primera cifra de la
   fila, que suele ser el año más reciente. */
const LectorLocal = (function(){
  const MESES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre';
  const NUM_MES = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, setiembre:9, octubre:10, noviembre:11, diciembre:12 };

  /* Tipos de valor: expresión regular sobre el texto original, a partir de donde termina la etiqueta. */
  const TIPOS = {
    fecha:new RegExp('\\b\\d{1,2}\\s*(?:de\\s+)?(?:' + MESES + ')\\s*(?:de|del)?\\s*(?:\\d{4})\\b|\\b(?:' + MESES + ')\\s+\\d{1,2}\\s*(?:de|,)?\\s*\\d{4}\\b|\\b\\d{4}-\\d{1,2}-\\d{1,2}\\b|\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{4}\\b', 'gi'),
    dinero:/(?:\$|COP\b)\s*\(?-?\d[\d.,\s]*\d\)?|\(?-?\d{1,3}(?:[.,\s]\d{3})+(?:[.,]\d{1,2})?\)?/gi,
    porcentaje:/-?\d{1,3}(?:[.,]\d{1,4})?\s*%/g,
    area:/\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?\s*(?:m2|m²|mts2|mt2|metros\s+cuadrados)/gi,
    nit:/\b\d{3}[.\s]?\d{3}[.\s]?\d{3}(?:\s*-\s*\d)?\b/g,
    matricula:/[A-Z0-9]*\d[A-Z0-9]*(?:[-\s][A-Z0-9]*\d[A-Z0-9]*){0,3}/g,
    nombre:/[A-ZÁÉÍÓÚÜÑ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ&'.-]*(?:\s+(?:(?:de|del|la|las|los|y|e)\s+)?[A-ZÁÉÍÓÚÜÑ&][A-Za-zÁÉÍÓÚÜÑáéíóúüñ&'.-]*){1,7}/g
  };

  /* Los datos que se pueden buscar. Las etiquetas van en minúsculas y sin tildes; la primera es la más precisa. */
  const CAMPOS = [
    { k:'fecha_expedicion', nombre:'Fecha de expedición del documento', tipo:'fecha', etiquetas:['fecha (?:de )?expedicion', 'fecha de (?:emision|generacion|elaboracion)', '(?:se )?expid(?:e|io|ido|ida)(?: el| en| a los)?', 'fecha'] },
    { k:'objeto_social', nombre:'Objeto social', tipo:'texto', etiquetas:['objeto social'] },
    { k:'facultades', nombre:'Facultades y límites del representante legal', tipo:'texto', etiquetas:['facultades(?: del representante legal)?', 'limitaciones(?: del representante legal)?', 'limites? (?:para|de) contratar'] },
    { k:'representante_legal', nombre:'Nombre del representante legal', tipo:'nombre', etiquetas:['representante legal(?: principal)?', 'gerente(?: general)?', 'representad[oa] legalmente por', 'representad[oa] por'] },
    { k:'nit', nombre:'NIT', tipo:'nit', etiquetas:['nit', 'numero de identificacion tributaria'] },
    { k:'valor_asegurado', nombre:'Valor asegurado', tipo:'dinero', etiquetas:['valor asegurado', 'suma asegurada', 'monto asegurado', 'valor de la garantia'] },
    { k:'vigencia_desde', nombre:'Vigencia: desde', tipo:'fecha', etiquetas:['vigencia desde', 'vigente desde', 'inicio de (?:la )?vigencia', 'desde'] },
    { k:'vigencia_hasta', nombre:'Vigencia: hasta', tipo:'fecha', etiquetas:['vigencia hasta', 'vigente hasta', 'fin de (?:la )?vigencia', 'vence(?: el)?', 'hasta'] },
    { k:'contratante', nombre:'Contratante (certificado de experiencia)', tipo:'nombre', etiquetas:['entidad contratante', 'contratante', 'cliente'] },
    { k:'objeto_contrato', nombre:'Objeto del contrato', tipo:'texto', etiquetas:['objeto del contrato', 'objeto(?! social| principal)'] },
    { k:'valor_contrato', nombre:'Valor del contrato', tipo:'dinero', etiquetas:['valor (?:total |final )?(?:ejecutado|del contrato)', 'valor final', 'valor total', 'valor'] },
    { k:'fecha_inicio', nombre:'Fecha de inicio del contrato', tipo:'fecha', etiquetas:['fecha de (?:inicio|iniciacion)', 'acta de inicio', 'inicio'] },
    { k:'fecha_terminacion', nombre:'Fecha de terminación del contrato', tipo:'fecha', etiquetas:['fecha de (?:terminacion|finalizacion)', 'acta de (?:recibo|liquidacion|terminacion)', 'terminacion', 'finalizacion'] },
    { k:'area_construida', nombre:'Área construida', tipo:'area', etiquetas:['area construida', 'area (?:total|intervenida)', 'area'] },
    { k:'participacion', nombre:'Porcentaje de participación', tipo:'porcentaje', etiquetas:['porcentaje de participacion', 'participacion'] },
    { k:'activo_corriente', nombre:'Activo corriente', tipo:'dinero', etiquetas:['(?:total )?activos? corrientes?'] },
    { k:'pasivo_corriente', nombre:'Pasivo corriente', tipo:'dinero', etiquetas:['(?:total )?pasivos? corrientes?'] },
    { k:'activo_total', nombre:'Activo total', tipo:'dinero', etiquetas:['total (?:de )?(?:los )?activos?(?! corriente| no corriente)', 'activos? totale?s?'] },
    { k:'pasivo_total', nombre:'Pasivo total', tipo:'dinero', etiquetas:['total (?:de )?(?:los )?pasivos?(?! corriente| no corriente| y patrimonio| mas patrimonio| \\+ patrimonio)', 'pasivos? totale?s?'] },
    { k:'patrimonio', nombre:'Patrimonio', tipo:'dinero', etiquetas:['total (?:del )?patrimonio', '(?<!y |mas |\\+ )patrimonio(?: neto| total)?'] },
    { k:'utilidad_operacional', nombre:'Utilidad operacional', tipo:'dinero', etiquetas:['utilidad (?:operacional|de operacion|operativa)', '(?:resultado|ganancia) (?:operacional|de operacion|por actividades de operacion)'] },
    { k:'gastos_intereses', nombre:'Gastos de intereses', tipo:'dinero', etiquetas:['gastos? (?:de |por )?intereses', 'gastos financieros', 'costos? financieros'] },
    { k:'matricula_profesional', nombre:'Matrícula profesional', tipo:'matricula', etiquetas:['matricula profesional', 'tarjeta profesional', 'm\\.? ?p\\.?'] },
    { k:'otro', nombre:'Otro dato que pide el evaluador', tipo:'otro', etiquetas:[] }
  ];
  /* Los datos que suelen servir para cada grupo de requisitos. */
  const POR_GRUPO = {
    'Jurídico':['fecha_expedicion', 'nit', 'objeto_social', 'facultades', 'representante_legal', 'valor_asegurado', 'vigencia_desde', 'vigencia_hasta'],
    'Financiero':['activo_corriente', 'pasivo_corriente', 'activo_total', 'pasivo_total', 'patrimonio', 'utilidad_operacional', 'gastos_intereses'],
    'Organizacional':['activo_total', 'patrimonio', 'utilidad_operacional'],
    'Experiencia':['contratante', 'objeto_contrato', 'valor_contrato', 'fecha_inicio', 'fecha_terminacion', 'area_construida', 'participacion'],
    'Personal':['matricula_profesional', 'fecha_expedicion', 'representante_legal']
  };
  function camposDe(grupo){ return (POR_GRUPO[grupo] || ['fecha_expedicion', 'vigencia_hasta']).slice(); }
  const MAX_POR_CAMPO = 3;

  /* ── Texto ── */
  const SIN_TILDE = { 'á':'a', 'é':'e', 'í':'i', 'ó':'o', 'ú':'u', 'ü':'u', 'ñ':'n', 'Á':'a', 'É':'e', 'Í':'i', 'Ó':'o', 'Ú':'u', 'Ü':'u', 'Ñ':'n' };
  /** Minúsculas y sin tildes, letra por letra: las posiciones quedan iguales a las del texto original. */
  function plegar(t){ let s = ''; for (const ch of t) { const c = SIN_TILDE[ch] || ch.toLowerCase(); s += c.length === ch.length ? c : ch; } return s; }
  /** Espacios seguidos, saltos de línea y tabulaciones como un solo espacio. */
  function plano(t){ return String(t || '').replace(/\s+/g, ' ').trim(); }

  function etiquetaRe(fuente){ return new RegExp('(?<![a-z0-9])(?:' + fuente + ')(?![a-z0-9])', 'g'); }

  /** Cifra de un valor de dinero escrito en pesos colombianos (punto de miles, coma decimal), o en el formato inglés. */
  function numero(v){
    let t = String(v).replace(/[^\d.,()-]/g, '');
    const neg = /^\(.*\)$/.test(t) || /^-/.test(t);
    t = t.replace(/[()-]/g, '');
    const ultSep = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','));
    const decimales = ultSep >= 0 ? t.length - ultSep - 1 : 0;
    let n;
    if (ultSep >= 0 && decimales > 0 && decimales <= 2) n = Number(t.slice(0, ultSep).replace(/[.,]/g, '') + '.' + t.slice(ultSep + 1));
    else n = Number(t.replace(/[.,]/g, ''));
    return isFinite(n) ? (neg ? -n : n) : null;
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
    if (tipo === 'fecha') return fechaIso(valor);
    if (tipo === 'nit') return valor.replace(/\D/g, '');
    return null;
  }

  /* Palabras que cierran un nombre: lo que viene después ya no es parte de él. */
  const FIN_NOMBRE = /^(?:C\.?C\.?|NIT|No\.?|N°|CC|T\.?P\.?|M\.?P\.?|Identificad[oa]|Con|Mayor|Quien|Domiciliad[oa]|En|Por)$/i;
  function recortarNombre(v){
    const w = v.split(/\s+/);
    const k = w.findIndex((x, i) => i > 0 && FIN_NOMBRE.test(x));
    const r = (k > 0 ? w.slice(0, k) : w).join(' ').replace(/[.,;:-]+$/, '');
    return r.split(/\s+/).filter(x => /^[A-ZÁÉÍÓÚÜÑ&]/.test(x)).length >= 2 ? r : '';
  }

  /** El valor del tipo pedido que empieza más cerca después de la posición «desde», sin pasar de «hasta». */
  function valorDespues(tipo, texto, desde, hasta){
    const trozo = texto.slice(desde, hasta);
    if (tipo === 'texto'){
      // Lo que sigue a la etiqueta, sin dos puntos ni un «es» al comienzo, hasta el fin de la frase.
      const sep = trozo.match(/^[\s:.,-]*(?:(?:es|son)\s*[:,-]?\s+)?/i);
      const ini = sep ? sep[0].length : 0;
      let t = trozo.slice(ini);
      const fin = t.search(/\.\s|\n\s*\n|;\s/);
      t = (fin >= 30 ? t.slice(0, fin + 1) : t).replace(/\n/g, ' ');
      t = t.slice(0, 280).replace(/\s+\S*$/, t.length > 280 ? '' : '$&').trim();
      return t.length >= 8 ? { valor:t, ini:desde + ini, fin:desde + ini + t.length } : null;
    }
    const re = new RegExp(TIPOS[tipo].source, TIPOS[tipo].flags.replace('g', '') + 'g');
    let m;
    while ((m = re.exec(trozo))){
      let v = m[0].replace(/\s+$/, '');
      if (!v) { re.lastIndex++; continue; }
      if (tipo === 'dinero'){
        v = v.replace(/[\s.,]+$/, '');
        if (v.replace(/\D/g, '').length < 4) continue;
        // Una fecha o un NIT no son dinero.
        if (/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/.test(v) || /\d{3}\.\d{3}\.\d{3}-\d$/.test(trozo.slice(m.index, m.index + v.length + 2))) continue;
      }
      if (tipo === 'matricula' && v.replace(/\D/g, '').length < 4) continue;
      if (tipo === 'nombre'){ v = recortarNombre(v); if (!v) continue; }
      return { valor:v, ini:desde + m.index, fin:desde + m.index + v.length };
    }
    return null;
  }

  /** Cuánto se busca después de la etiqueta: hasta el fin de la línea siguiente, y no más de 160 caracteres. */
  function limite(texto, desde, tipo){
    const tope = Math.min(texto.length, desde + (tipo === 'texto' ? 600 : 160));
    let n = texto.indexOf('\n', desde);
    if (n < 0 || n >= tope) return tope;
    if (tipo === 'nombre' && /\S/.test(texto.slice(desde, n).replace(/[:\s-]/g, ''))) return n;
    const n2 = texto.indexOf('\n', n + 1);
    return n2 < 0 || n2 > tope ? tope : n2;
  }
  /** El fragmento literal: desde el comienzo de la etiqueta (o de su línea, si está cerca) hasta el final del valor. */
  function fragmento(texto, iniEtiqueta, finValor){
    const linea = texto.lastIndexOf('\n', iniEtiqueta - 1) + 1;
    let ini = iniEtiqueta - linea <= 40 ? linea : iniEtiqueta;
    if (finValor - ini > 300) ini = finValor - 300;
    return plano(texto.slice(ini, finValor));
  }

  /** Coincidencias de un campo en todas las páginas, la mejor primero. */
  function buscarCampo(c, paginas, plegadas){
    const hall = [];
    paginas.forEach((texto, i) => {
      // Una etiqueta general («objeto») no repite lo que ya encontró una más precisa («objeto del contrato»).
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
            puntos:prioridad * 40 + (v.ini - desde) + i * 0.01, aceptado:true, motivo:'' });
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
  /** «Otro dato»: cada lugar donde aparece lo que escribió el evaluador, con lo que le sigue en la línea. */
  function buscarOtro(termino, paginas, plegadas){
    const q = plegar(plano(termino));
    if (q.length < 3) return [];
    const out = [];
    paginas.forEach((texto, i) => {
      let j = plegadas[i].indexOf(q);
      while (j >= 0 && out.length < MAX_POR_CAMPO){
        const desde = j + q.length;
        let fin = texto.indexOf('\n', desde);
        if (fin < 0 || fin - desde > 120) fin = Math.min(texto.length, desde + 120);
        const resto = plano(texto.slice(desde, fin)).replace(/^[\s:.,-]+/, '');
        if (resto) out.push({ campo:'otro', nombreCampo:'Otro dato: ' + plano(termino), valor:resto.slice(0, 120), normalizado:null, texto:fragmento(texto, j, fin), pagina:i + 1, aceptado:true, motivo:out.length ? 'Otra coincidencia en el documento.' : '' });
        j = plegadas[i].indexOf(q, desde);
      }
    });
    return out;
  }

  /**
   * Lee los datos pedidos. paginas[i] = texto de la página i+1 (con saltos de línea si los hay).
   * Devuelve los datos encontrados, hasta tres por campo, cada uno con su fragmento literal y su página.
   */
  function leer(paginas, campos, otro){
    const P = (paginas || []).map(t => String(t || '').replace(/\r\n?/g, '\n').replace(/[ \t ]+/g, ' '));
    const F = P.map(plegar);
    const out = [];
    (campos || []).forEach(k => {
      if (k === 'otro'){ if (otro) out.push(...buscarOtro(otro, P, F)); return; }
      const c = CAMPOS.find(x => x.k === k);
      if (c) out.push(...buscarCampo(c, P, F));
    });
    return out;
  }
  /** Los campos pedidos que no se encontraron. */
  function faltantes(datos, campos){ return (campos || []).filter(k => k !== 'otro' && !(datos || []).some(d => d.campo === k)).map(k => (CAMPOS.find(c => c.k === k) || { nombre:k }).nombre); }

  return { CAMPOS, POR_GRUPO, camposDe, leer, faltantes, numero, fechaIso, plegar, plano };
})();
