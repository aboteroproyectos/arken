/* ─────────────── 04 · Condiciones de la oferta ───────────────
   La plantilla del Anexo B, editable por proceso. Lo que el módulo no deja
   pasar (puntajes que no suman, requisitos sin regla) se muestra arriba y
   también bloquea la emisión en el módulo 07. */
Vistas['04'] = function(){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso('04', 'Condiciones de la oferta') };
  const lista = Modelo.requisitos(p.id);
  const ed = Modelo.editable(p) && Permisos.puede('editarCondiciones');
  const total = p.puntajeTotal || PlantillaCondiciones.TOTAL_PUNTOS;
  const suma = PlantillaCondiciones.puntosPonderables(lista);
  const probl = PlantillaCondiciones.problemas(lista, total);
  const activos = lista.filter(x => x.activo !== false);
  const grupos = PlantillaCondiciones.GRUPOS.filter(g => lista.some(x => x.grupo === g));
  const tabla = grupos.map(g => {
    const del = lista.filter(x => x.grupo === g);
    const pts = PlantillaCondiciones.puntosPonderables(del);
    return '<tr class="row-cap"><td colspan="6">' + esc(g) + '</td><td class="n">' + pts + '</td><td></td></tr>' + del.map(x => {
      const nat = x.naturaleza === 'ponderable' ? UI.tag('P', 'brass') + (x.tambienHabilitante ? UI.tag('H', 'info') : '') : x.naturaleza === 'habilitante' ? UI.tag('H', 'info') : UI.tag('I');
      const conProblema = probl.some(pr => pr.codigo && Util.normaliza(pr.codigo) === Util.normaliza(x.codigo));
      return '<tr' + (x.activo === false ? ' style="opacity:.5"' : '') + '><td class="cod">' + esc(x.codigo) + (conProblema ? ' ' + UI.tag('revisar', 'bad') : '') + '</td><td><b>' + esc(x.nombre) + '</b><div class="small muted">' + esc(x.descripcion) + '</div>' +
        (x.condicional ? '<div class="small muted">Condicional: ' + esc(x.condicional) + '</div>' : '') + '</td><td>' + nat + '</td><td>' + esc(x.tipoRespuesta) + '</td><td>' + (x.obligatorio ? 'Sí' : 'No') + (x.subsanable ? '<div class="small muted">subsanable</div>' : '') +
        '</td><td class="small">' + esc(x.evaluador) + '</td><td class="n">' + (x.naturaleza === 'ponderable' ? Number(x.puntajeMaximo||0) : '—') + '</td><td class="act">' +
        boton('editar-req', ed ? 'Editar' : 'Ver', 'xs', ' data-id="' + x.id + '"') + (ed ? ' ' + boton('activar-req', x.activo === false ? 'Activar' : 'Desactivar', 'xs ghost', ' data-id="' + x.id + '"') : '') + '</td></tr>';
    }).join('');
  }).join('');
  const html = cabecera('04', 'Condiciones de la oferta', esc(p.codigo) + ' · qué se pide y cómo se evalúa' + etiquetaDemo(p),
      (ed ? boton('nuevo-req', '+ Requisito', 'primary') + boton('restaurar-anexo', 'Restaurar la plantilla del Anexo B') + boton('cargar-plantilla', 'Cargar plantilla propia') : '') +
      boton('guardar-plantilla', 'Guardar como plantilla')) + avisoCongelado(p) +
    '<div class="sumario">' +
      '<div class="stat ' + (Math.abs(suma - total) < 1e-9 ? 'accent' : '') + '"><div class="lab">Puntos ponderables</div><div class="val">' + suma + ' / ' + total + '</div><div class="foot">' + (Math.abs(suma - total) < 1e-9 ? 'Cuadran con el total del proceso' : 'Deben sumar exactamente ' + total) + '</div></div>' +
      '<div class="stat"><div class="lab">Requisitos activos</div><div class="val">' + activos.length + '</div><div class="foot">' + (lista.length - activos.length) + ' desactivado(s)</div></div>' +
      '<div class="stat"><div class="lab">Habilitantes</div><div class="val">' + activos.filter(x => x.naturaleza === 'habilitante' || x.tambienHabilitante).length + '</div></div>' +
      '<div class="stat"><div class="lab">Ponderables</div><div class="val">' + activos.filter(x => x.naturaleza === 'ponderable').length + '</div></div>' +
    '</div>' +
    (probl.length ? '<div class="nota bad"><b>Antes de emitir hay que resolver ' + probl.length + ' punto(s):</b><ul>' + probl.slice(0, 12).map(x => '<li>' + esc(x.msg) + '</li>').join('') + (probl.length > 12 ? '<li>… y ' + (probl.length - 12) + ' más.</li>' : '') + '</ul></div>'
      : '<div class="nota ok">Las condiciones están completas: los puntajes cuadran y todo requisito tiene evaluador y regla.</div>') +
    '<div class="card"><div class="card-body flush"><div class="tw scroll"><table class="t"><thead><tr><th>Código</th><th>Requisito</th><th>Naturaleza</th><th>Respuesta</th><th>Obligatorio</th><th>Evaluador</th><th class="n">Puntos</th><th></th></tr></thead><tbody>' + tabla + '</tbody></table></div></div></div>' +
    '<p class="small muted">H: habilitante (cumple o no cumple). P: ponderable (asigna puntaje). I: informativo. Todo requisito que cree aquí aparece en ARKEN OFERTA, en la evaluación, en el comparativo, en el concepto y en la lista de casillas del informe.</p>';
  return { html, acciones:accionesCondiciones(p, lista, ed) };
};

/* Los rangos se escriben uno por renglón: «0 a 2 = 20», «5 o más = 60». */
function rangosATexto(rangos){ return (rangos||[]).map(r => r.hasta === null || r.hasta === undefined ? r.desde + ' o más = ' + r.puntos : r.desde + ' a ' + r.hasta + ' = ' + r.puntos).join('\n'); }
function textoARangos(texto){
  const lista = [];
  String(texto||'').split('\n').map(s => s.trim()).filter(Boolean).forEach(l => {
    let m = /^(-?[\d.,]+)\s*a\s*(-?[\d.,]+)\s*=\s*([\d.,]+)$/i.exec(l);
    if (m){ lista.push({ desde:Number(m[1].replace(',', '.')), hasta:Number(m[2].replace(',', '.')), puntos:Number(m[3].replace(',', '.')) }); return; }
    m = /^(-?[\d.,]+)\s*o\s*más\s*=\s*([\d.,]+)$/i.exec(l);
    if (m){ lista.push({ desde:Number(m[1].replace(',', '.')), hasta:null, puntos:Number(m[2].replace(',', '.')) }); return; }
    throw new Error('No se entiende el rango «' + l + '». Escriba, por ejemplo, «0 a 2 = 20» o «5 o más = 60».');
  });
  return lista;
}
function camposRequisito(x){
  const reg = x.reglaPuntaje || {};
  return [
    { k:'codigo', lab:'Código', val:x.codigo }, { k:'grupo', lab:'Grupo', tipo:'select', opts:PlantillaCondiciones.GRUPOS, val:x.grupo },
    { k:'nombre', lab:'Nombre', val:x.nombre, c2:true },
    { k:'descripcion', lab:'Descripción (la lee el proponente)', tipo:'textarea', val:x.descripcion, c2:true, filas:2 },
    { k:'ayuda', lab:'Ayuda para diligenciarlo (ARKEN OFERTA la muestra al lado del campo)', tipo:'textarea', val:x.ayuda, c2:true, filas:2 },
    { k:'tipoRespuesta', lab:'Tipo de respuesta', tipo:'select', opts:PlantillaCondiciones.TIPOS_RESPUESTA, val:x.tipoRespuesta },
    { k:'naturaleza', lab:'Naturaleza', tipo:'select', opts:PlantillaCondiciones.NATURALEZAS, val:x.naturaleza },
    { k:'docTipos', lab:'Documento: tipos permitidos (separados por coma)', val:((x.documento||{}).tipos||['pdf']).join(', ') },
    { k:'docPeso', lab:'Documento: peso máximo (MB)', tipo:'number', val:(x.documento||{}).pesoMaxMB || 25 },
    { k:'docVarios', lab:'Documento: admite varios archivos', tipo:'check', val:(x.documento||{}).varios },
    { k:'datoTipo', lab:'Dato: tipo', tipo:'select', opts:PlantillaCondiciones.TIPOS_DATO, val:(x.dato||{}).tipo || 'texto' },
    { k:'datoOpciones', lab:'Dato: opciones de la lista (separadas por coma)', val:((x.dato||{}).opciones||[]).join(', '), c2:true },
    { k:'tablaPlantilla', lab:'Tabla: plantilla', tipo:'select', opts:[{ v:'', n:'Propia' }].concat(Object.keys(PlantillaCondiciones.TABLAS).map(k => ({ v:k, n:k }))), val:(x.tabla||{}).plantilla || '' },
    { k:'tablaColumnas', lab:'Tabla: columnas, una por renglón (título; tipo)', tipo:'textarea', filas:3, c2:true,
      val:((x.tabla||{}).columnas||[]).map(c => c.titulo + '; ' + c.tipo).join('\n'), ayuda:'Tipos: texto, número, fecha, moneda, porcentaje, sí o no.' },
    { k:'obligatorio', lab:'Obligatorio', tipo:'check', val:x.obligatorio }, { k:'subsanable', lab:'Subsanable', tipo:'check', val:x.subsanable },
    { k:'tambienHabilitante', lab:'Ponderable que además exige un mínimo (H y P)', tipo:'check', val:x.tambienHabilitante, c2:true },
    { k:'notaSubsanable', lab:'Nota sobre la subsanación', val:x.notaSubsanable, c2:true },
    { k:'puntajeMaximo', lab:'Puntaje máximo', tipo:'number', val:x.puntajeMaximo },
    { k:'reglaTipo', lab:'Regla de puntaje', tipo:'select', opts:[{ v:'', n:'Sin regla' }].concat(Object.keys(PlantillaCondiciones.TIPOS_REGLA).map(k => ({ v:k, n:PlantillaCondiciones.TIPOS_REGLA[k] }))), val:reg.tipo || '' },
    { k:'reglaCriterio', lab:'Criterio de la regla', tipo:'textarea', filas:2, val:reg.criterio || '', c2:true },
    { k:'reglaRangos', lab:'Rangos (si la regla es por rangos), uno por renglón', tipo:'textarea', filas:3, val:rangosATexto(reg.rangos), c2:true, ayuda:'Ejemplo: «0 a 2 = 20», «2 a 5 = 40», «5 o más = 60».' },
    { k:'reglasVerificacion', lab:'Reglas de verificación, una por renglón', tipo:'textarea', filas:3, val:(x.reglasVerificacion||[]).join('\n'), c2:true },
    { k:'evaluador', lab:'Evaluador', tipo:'select', opts:PlantillaCondiciones.EVALUADORES, val:x.evaluador },
    { k:'condicional', lab:'Condicional (cuándo aplica)', val:x.condicional },
    { k:'activo', lab:'Activo en este proceso', tipo:'check', val:x.activo !== false, c2:true }
  ];
}
function aplicarCamposRequisito(x, v){
  const tiposCol = ['texto','número','fecha','moneda','porcentaje','sí o no'];
  Object.assign(x, { codigo:v.codigo, grupo:v.grupo, nombre:v.nombre, descripcion:v.descripcion, ayuda:v.ayuda, tipoRespuesta:v.tipoRespuesta,
    naturaleza:v.naturaleza, obligatorio:v.obligatorio, subsanable:v.subsanable, tambienHabilitante:v.naturaleza === 'ponderable' && v.tambienHabilitante,
    notaSubsanable:v.notaSubsanable, puntajeMaximo:v.naturaleza === 'ponderable' ? Number(v.puntajeMaximo||0) : 0, evaluador:v.evaluador,
    condicional:v.condicional, activo:v.activo, reglasVerificacion:String(v.reglasVerificacion||'').split('\n').map(s => s.trim()).filter(Boolean) });
  x.reglaPuntaje = v.reglaTipo ? { tipo:v.reglaTipo, criterio:v.reglaCriterio } : null;
  if (v.reglaTipo === 'rangos') x.reglaPuntaje.rangos = textoARangos(v.reglaRangos);
  if (v.reglaTipo === 'economica') x.reglaPuntaje.metodo = 'pliego';
  x.documento = v.tipoRespuesta === 'documento' ? { tipos:String(v.docTipos||'pdf').split(',').map(s => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean), pesoMaxMB:Number(v.docPeso)||25, varios:v.docVarios } : undefined;
  x.dato = v.tipoRespuesta === 'dato' ? { tipo:v.datoTipo, opciones:String(v.datoOpciones||'').split(',').map(s => s.trim()).filter(Boolean) } : undefined;
  if (v.tipoRespuesta === 'tabla'){
    const cols = String(v.tablaColumnas||'').split('\n').map(s => s.trim()).filter(Boolean).map((l, i) => {
      const [titulo, tipo] = l.split(';').map(s => s.trim());
      return { clave:Util.normaliza(titulo).replace(/[^a-z0-9]+/g, '') || 'col' + (i+1), titulo, tipo:tiposCol.indexOf(tipo) >= 0 ? tipo : 'texto' };
    });
    x.tabla = { plantilla:v.tablaPlantilla || '', columnas:cols.length ? cols : PlantillaCondiciones.columnas(v.tablaPlantilla) };
    if (!x.tabla.columnas.length) throw new Error('La tabla necesita al menos una columna.');
  } else x.tabla = undefined;
  return x;
}
function accionesCondiciones(p, lista, ed){
  async function editar(x){
    const nuevo = !x;
    const req = x ? Util.copia(x) : { id:Util.uid('rq'), codigo:'', grupo:'Otro', nombre:'', descripcion:'', ayuda:'', tipoRespuesta:'documento', naturaleza:'habilitante',
      obligatorio:true, subsanable:true, tambienHabilitante:false, puntajeMaximo:0, reglaPuntaje:null, reglasVerificacion:[], evaluador:'Evaluador técnico', condicional:'', activo:true, orden:lista.length };
    if (!ed){
      UI.aviso(req.codigo + ' · ' + req.nombre, UI.formulario(camposRequisito(req).map(c => Object.assign(c, { deshabilitado:true })), 'vr'), 'wide');
      return;
    }
    const v = await UI.pedir({ titulo:nuevo ? 'Nuevo requisito' : 'Requisito ' + req.codigo, eyebrow:'Módulo 04', campos:camposRequisito(req),
      validar:z => !z.codigo || !z.nombre ? 'Escriba el código y el nombre.' : lista.some(o => o.id !== req.id && Util.normaliza(o.codigo) === Util.normaliza(z.codigo)) ? 'El código ' + z.codigo + ' ya existe.' : '' });
    if (!v) return;
    aplicarCamposRequisito(req, v);
    const nueva = lista.slice();
    const i = nueva.findIndex(o => o.id === req.id);
    if (i >= 0) nueva[i] = req; else nueva.push(req);
    await Modelo.guardarRequisitos(p.id, nueva, (nuevo ? 'Nuevo requisito ' : 'Requisito ') + req.codigo);
    App.render();
  }
  return {
    'nuevo-req':() => editar(null),
    'editar-req':b => editar(lista.find(x => x.id === b.dataset.id)),
    'activar-req':async b => {
      const nueva = lista.map(x => x.id === b.dataset.id ? Object.assign({}, x, { activo:x.activo === false }) : x);
      const x = nueva.find(o => o.id === b.dataset.id);
      await Modelo.guardarRequisitos(p.id, nueva, x.codigo + (x.activo ? ' activado' : ' desactivado')); App.render();
    },
    'restaurar-anexo':async () => {
      if (!(await UI.confirmar({ titulo:'Restaurar la plantilla del Anexo B', mensaje:'Las condiciones de ' + p.codigo + ' se reemplazan por la plantilla base del Anexo B. Los requisitos propios y los cambios que hizo se pierden.', textoAceptar:'Restaurar', claseAceptar:'danger' }))) return;
      await Modelo.guardarRequisitos(p.id, PlantillaCondiciones.anexoB(), 'Plantilla del Anexo B restaurada'); App.render();
    },
    'guardar-plantilla':async () => {
      const v = await UI.pedir({ titulo:'Guardar como plantilla', ancho:'', campos:[{ k:'nombre', lab:'Nombre de la plantilla', val:'Condiciones ' + p.tipoContrato, c2:true }], textoAceptar:'Guardar plantilla',
        validar:z => !z.nombre ? 'Escriba el nombre.' : '' });
      if (!v) return;
      Permisos.exigir('editarCondiciones');
      await Almacen.poner('plantillasCondiciones', { id:Util.uid('pl'), nombre:v.nombre, fecha:new Date().toISOString(), usuario:Sesion.usuario.usuario, lista:Util.copia(lista) });
      await Auditoria.registrar('guardar', 'plantilla de condiciones', v.nombre, p.id);
      UI.toast('Plantilla «' + v.nombre + '» guardada', 'ok');
    },
    'cargar-plantilla':async () => {
      const pls = S.plantillasCondiciones || [];
      if (!pls.length) throw new Error('Aún no hay plantillas propias. Guarde una con «Guardar como plantilla».');
      const v = await UI.pedir({ titulo:'Cargar plantilla propia', ancho:'', textoAceptar:'Cargar', antes:'<div class="nota warn">Las condiciones actuales de ' + esc(p.codigo) + ' se reemplazan por las de la plantilla.</div>',
        campos:[{ k:'id', lab:'Plantilla', tipo:'select', c2:true, opts:pls.map(x => ({ v:x.id, n:x.nombre + ' · ' + Util.fmtFecha(x.fecha) + ' · ' + x.lista.length + ' requisitos' })) }] });
      if (!v) return;
      const pl = pls.find(x => x.id === v.id);
      await Modelo.guardarRequisitos(p.id, Util.copia(pl.lista), 'Plantilla cargada: ' + pl.nombre); App.render();
    }
  };
}

/* ─────────────── 05 · Documentos del proceso ───────────────
   Como la planoteca de ARKEN: una versión nueva reemplaza a la anterior sin
   borrarla; el paquete de la Fase 2 lleva solo las vigentes. */
Vistas['05'] = function(){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso('05', 'Documentos del proceso') };
  const ed = Modelo.editable(p) && Permisos.puede('editarDocumentos');
  const todos = Modelo.documentos(p.id, true);
  const verTodas = !!Sesion.verVersiones;
  const lista = todos.filter(d => verTodas || d.vigente !== false).sort((a, b) => (a.clase + a.nombre + String(a.version).padStart(4, '0')).localeCompare(b.clase + b.nombre + String(b.version).padStart(4, '0')));
  const vigentes = todos.filter(d => d.vigente !== false);
  const peso = vigentes.reduce((t, d) => t + Number(d.peso||0), 0);
  const filas = lista.map(d => '<tr' + (d.vigente === false ? ' style="opacity:.55"' : '') + '><td><b>' + esc(d.nombre) + '</b>' + (d.demo ? ' ' + UI.tag('DEMOSTRACIÓN', 'demo') : '') +
    '<div class="small muted">' + esc(d.enlace ? 'Por enlace' : Archivos.tipoLegible(d.nombre)) + ' · ' + Util.pesoLegible(d.peso) + (d.notas ? ' · ' + esc(d.notas) : '') + '</div>' +
    (d.sha256 ? '<div class="huella">SHA-256 ' + esc(d.sha256) + '</div>' : '') + '</td><td>' + esc(d.clase) + '</td><td>' + esc(d.disciplina) + '</td><td class="n">v' + (d.version||1) +
    (d.vigente === false ? '<div class="small">reemplazada</div>' : '') + '</td><td>' + (d.visibleParaProponentes !== false ? UI.tag('va al paquete', 'ok') : UI.tag('interno')) +
    (d.enlace ? (d.enlaceVerificado ? UI.tag('enlace verificado', 'ok') : UI.tag('enlace sin verificar', 'bad')) : '') + '</td><td class="small">' + Util.fmtSello(d.fecha) + '<div class="muted">' + esc(d.usuario||'') + '</div></td><td class="act">' +
    (d.enlace ? '<a class="btn xs" href="' + esc(Util.enlaceSeguro(d.enlace)) + '" target="_blank" rel="noopener noreferrer">Abrir enlace</a>' : boton('ver-doc', 'Ver', 'xs', ' data-id="' + d.id + '"') + ' ' + boton('bajar-doc', 'Descargar', 'xs', ' data-id="' + d.id + '"')) +
    (ed && d.vigente !== false ? ' ' + boton('editar-doc', 'Editar', 'xs', ' data-id="' + d.id + '"') + ' ' + boton('version-doc', 'Nueva versión', 'xs', ' data-id="' + d.id + '"') +
      (d.enlace && !d.enlaceVerificado ? ' ' + boton('verificar-enlace', 'Verificar huella', 'xs brass', ' data-id="' + d.id + '"') : '') + ' ' + boton('quitar-doc', '✕', 'xs', ' data-id="' + d.id + '" aria-label="Quitar documento"') : '') + '</td></tr>').join('');
  const html = cabecera('05', 'Documentos del proceso', esc(p.codigo) + ' · planos, estudios, especificaciones y modelos' + etiquetaDemo(p),
      ed ? boton('subir-docs', 'Cargar archivos', 'primary') + boton('doc-enlace', 'Agregar documento por enlace') : '') + avisoCongelado(p) +
    '<div class="sumario"><div class="stat"><div class="lab">Vigentes</div><div class="val">' + vigentes.length + '</div><div class="foot">' + (todos.length - vigentes.length) + ' versión(es) anterior(es)</div></div>' +
      '<div class="stat"><div class="lab">Para los proponentes</div><div class="val">' + vigentes.filter(d => d.visibleParaProponentes !== false).length + '</div></div>' +
      '<div class="stat"><div class="lab">Peso de los vigentes</div><div class="val" style="font-size:15px">' + Util.pesoLegible(peso) + '</div><div class="foot">Límite del paquete: ' + Archivos.limitePaqueteMB() + ' MB</div></div></div>' +
    (peso > Archivos.limitePaqueteMB() * 1048576 ? '<div class="nota warn">Los documentos vigentes superan el límite del paquete. Publique los más pesados por enlace (con su huella) o márquelos como internos.</div>' : '') +
    '<div class="card"><div class="card-head"><h3>Documentos</h3><label class="checkline"><input type="checkbox" data-accion="ver-versiones"' + (verTodas ? ' checked' : '') + '> Ver versiones anteriores</label></div><div class="card-body flush">' +
    (filas ? '<div class="tw scroll"><table class="t"><thead><tr><th>Documento</th><th>Clase</th><th>Disciplina</th><th class="n">Versión</th><th>Paquete</th><th>Cargado</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : UI.vacio('Aún no hay documentos', 'Cargue planos (PDF, DWG, DXF), modelos (RVT, IFC, NWD), estudios, especificaciones e imágenes. Cada archivo queda con su huella SHA-256.', ed ? boton('subir-docs', 'Cargar archivos', 'primary') : '')) + '</div></div>';
  return { html, acciones:accionesDocumentos(p, todos) };
};
const CAMPOS_DOC = (d) => [
  { k:'nombre', lab:'Nombre', val:d.nombre, c2:true },
  { k:'clase', lab:'Clase', tipo:'select', opts:Modelo.CLASES_DOC, val:d.clase }, { k:'disciplina', lab:'Disciplina', tipo:'select', opts:Modelo.DISCIPLINAS, val:d.disciplina },
  { k:'visibleParaProponentes', lab:'Va en el paquete de los proponentes', tipo:'check', val:d.visibleParaProponentes !== false, c2:true },
  { k:'notas', lab:'Notas', val:d.notas, c2:true }
];
function claseSugerida(nombre){
  const e = Archivos.extension(nombre);
  if (['dwg','dxf'].indexOf(e) >= 0) return 'Planos';
  if (['rvt','rfa','ifc','nwd'].indexOf(e) >= 0) return 'Modelos BIM';
  if (/cronograma|programaci/i.test(nombre) || e === 'mpp') return 'Cronograma';
  if (/especificaci/i.test(nombre)) return 'Especificaciones';
  if (/estudio|suelo|geot/i.test(nombre)) return 'Estudios';
  if (/licencia/i.test(nombre)) return 'Licencia';
  if (/plano/i.test(nombre)) return 'Planos';
  return 'Otros';
}
function accionesDocumentos(p, todos){
  const buscar = id => todos.find(d => d.id === id);
  /** Carga un archivo con su huella; avisa si el mismo contenido ya está en el proceso. */
  async function cargar(file, anterior){
    if (file.size > Archivos.limiteArchivoMB() * 1048576)
      throw new Error('«' + file.name + '» pesa ' + Util.pesoLegible(file.size) + ' y supera el límite de ' + Archivos.limiteArchivoMB() + ' MB por archivo. Súbalo a su nube y agréguelo como documento por enlace.');
    UI.toast('Calculando la huella de ' + file.name + '…');
    const sha = await Archivos.huella(file);
    const igual = todos.find(d => d.sha256 === sha);
    if (igual && !(await UI.confirmar({ titulo:'Archivo repetido', mensaje:'«' + file.name + '» tiene el mismo contenido que «' + igual.nombre + '» (v' + (igual.version||1) + '), que ya está en el proceso. ¿Lo agrega de todas formas?', textoAceptar:'Agregar igual' }))) return null;
    await Archivos.guardar(file);
    const d = anterior
      ? Object.assign(Util.copia(anterior), { id:Util.uid('dc'), sha256:sha, peso:file.size, version:(anterior.version||1) + 1, vigente:true, reemplazaA:anterior.id, archivoOriginal:file.name, fecha:'', usuario:'' })
      : { id:Util.uid('dc'), procesoId:p.id, demo:!!p.demo, nombre:file.name, archivoOriginal:file.name, clase:claseSugerida(file.name), disciplina:'General', version:1, sha256:sha, peso:file.size, visibleParaProponentes:true, vigente:true, notas:'' };
    await Modelo.guardarDocumento(d, anterior ? 'reemplaza a la v' + (anterior.version||1) : 'cargado');
    if (anterior){ anterior.vigente = false; await Modelo.guardarDocumento(anterior, 'reemplazado por la v' + d.version); }
    return d;
  }
  return {
    'ver-versiones':b => { Sesion.verVersiones = b.checked; App.render(); },
    'subir-docs':async () => {
      const files = await UI.elegirArchivos('', true);
      let n = 0;
      for (const f of files){ try { if (await cargar(f)) n++; } catch(e){ UI.error(e, 'Cargar documento'); } }
      if (n) UI.toast(n + ' documento(s) cargado(s). Revise su clase y disciplina.', 'ok');
      App.render();
    },
    'version-doc':async b => {
      const ant = buscar(b.dataset.id);
      const [f] = await UI.elegirArchivos('.' + (Archivos.extension(ant.nombre) || '*'));
      if (!f) return;
      const d = await cargar(f, ant);
      if (d) UI.toast('«' + d.nombre + '» queda en la versión ' + d.version + '; la anterior se conserva como reemplazada.', 'ok');
      App.render();
    },
    'doc-enlace':async () => {
      const v = await UI.pedir({ titulo:'Documento por enlace', eyebrow:'Para archivos que superan el límite', campos:[
        { k:'nombre', lab:'Nombre del archivo', c2:true, placeholder:'Modelo_estructural.rvt' }, { k:'enlace', lab:'Enlace https:// de su nube', c2:true },
        { k:'sha256', lab:'Huella SHA-256 del archivo (64 caracteres)', c2:true, ayuda:'Si tiene el archivo en este equipo, déjela vacía y use luego «Verificar huella»: el programa la calcula sin guardar el archivo.' },
        { k:'peso', lab:'Peso aproximado (MB)', tipo:'number' }, { k:'clase', lab:'Clase', tipo:'select', opts:Modelo.CLASES_DOC, val:'Modelos BIM' },
        { k:'disciplina', lab:'Disciplina', tipo:'select', opts:Modelo.DISCIPLINAS, val:'General' }],
        validar:z => !z.nombre ? 'Escriba el nombre.' : !/^https:\/\//i.test(Util.enlaceSeguro(z.enlace)) ? 'El enlace debe empezar por https://.' : z.sha256 && !/^[0-9a-f]{64}$/i.test(z.sha256) ? 'La huella SHA-256 tiene 64 caracteres hexadecimales.' : '' });
      if (!v) return;
      await Modelo.guardarDocumento({ id:Util.uid('dc'), procesoId:p.id, demo:!!p.demo, nombre:v.nombre, clase:v.clase, disciplina:v.disciplina, version:1, enlace:Util.enlaceSeguro(v.enlace),
        sha256:(v.sha256||'').toLowerCase(), peso:Number(v.peso||0) * 1048576, enlaceVerificado:false, visibleParaProponentes:true, vigente:true, notas:'' }, 'por enlace');
      App.render();
    },
    'verificar-enlace':async b => {
      const d = buscar(b.dataset.id);
      UI.aviso('Verificar el documento por enlace', '<p>Elija la copia del archivo que subió a la nube. El programa calcula su huella y la compara; el archivo <b>no</b> se guarda en este equipo.</p>');
      const [f] = await UI.elegirArchivos('');
      if (!f) return;
      const sha = await Archivos.huella(f);
      if (d.sha256 && d.sha256 !== sha) throw new Error('La huella del archivo elegido no coincide con la registrada. Revise que sea la misma versión que está en la nube.');
      Object.assign(d, { sha256:sha, peso:f.size, enlaceVerificado:true });
      await Modelo.guardarDocumento(d, 'enlace verificado'); UI.toast('Huella verificada', 'ok'); App.render();
    },
    'editar-doc':async b => {
      const d = buscar(b.dataset.id);
      const v = await UI.pedir({ titulo:d.nombre, campos:CAMPOS_DOC(d), validar:z => !z.nombre ? 'Escriba el nombre.' : '' });
      if (!v) return;
      Object.assign(d, v); await Modelo.guardarDocumento(d, 'editado'); App.render();
    },
    'quitar-doc':async b => {
      const d = buscar(b.dataset.id);
      if (!(await UI.confirmar({ titulo:'Quitar documento', mensaje:'Se quita «' + d.nombre + '» v' + (d.version||1) + ' del proceso. Sus versiones anteriores se conservan.', textoAceptar:'Quitar', claseAceptar:'danger' }))) return;
      await Modelo.quitarDocumento(d); App.render();
    },
    'ver-doc':b => Archivos.ver(buscar(b.dataset.id)),
    'bajar-doc':b => { const d = buscar(b.dataset.id); return Archivos.descargar(d.sha256, d.nombre); }
  };
}

/* ─────────────── 06 · Invitados y confidencialidad ─────────────── */
Vistas['06'] = function(){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso('06', 'Invitados y confidencialidad') };
  const tab = UI.pestanaActiva('inv', 'invitados');
  const estado = Modelo.estadoConfidencialidad(p);
  const html = cabecera('06', 'Invitados y confidencialidad', esc(p.codigo) + etiquetaDemo(p) + ' · acuerdo ' + UI.tag(estado === 'aprobado' ? 'aprobado por abogado' : 'borrador', estado === 'aprobado' ? 'ok' : 'warn')) +
    UI.pestanas('inv', [['invitados','Invitados'],['acuerdo','Acuerdo de confidencialidad']], 'invitados') +
    (tab === 'acuerdo' ? vistaAcuerdo(p, estado) : vistaInvitados(p));
  return { html, acciones:Object.assign(accionesInvitados(p), accionesAcuerdo(p)) };
};
const ESTADOS_ACUERDO = { pendiente:['pendiente', ''], enviado:['enviado', 'info'], firmado:['firmado y recibido', 'ok'], verificado:['firmado y verificado', 'ok'] };
function vistaInvitados(p){
  const ed = Permisos.puede('gestionarInvitados');
  const lista = Modelo.invitados(p.id);
  const filas = lista.map(i => {
    const col = Util.normaliza(i.pais || 'Colombia') === 'colombia';
    const nitOk = !col || Nit.valido(i.nit, i.dv);
    const ac = ESTADOS_ACUERDO[(i.confidencialidad||{}).estado || 'pendiente'] || ESTADOS_ACUERDO.pendiente;
    return '<tr' + (i.estado === 'retirado' ? ' style="opacity:.5"' : '') + '><td><b>' + esc(i.razonSocial) + '</b>' + etiquetaDemo(i) + '<div class="small muted">' + esc([i.ciudad, i.pais].filter(Boolean).join(', ')) + '</div></td>' +
      '<td class="num">' + esc(Nit.formatear(i.nit, i.dv)) + (nitOk ? '' : ' ' + UI.tag('DV no válido', 'bad')) + '</td><td>' + esc((i.contacto||{}).nombre || '') + '<div class="small muted">' + esc((i.contacto||{}).cargo || '') + '</div><div class="small">' + esc((i.contacto||{}).correo || '') + '</div></td>' +
      '<td class="num">' + esc(i.codigoInvitacion) + '</td><td>' + UI.tag(i.estado, i.estado === 'invitado' ? 'info' : i.estado === 'retirado' ? 'bad' : '') + '<div class="small muted">' + (i.envios||[]).length + ' envío(s)</div></td>' +
      '<td>' + UI.tag(ac[0], ac[1]) + ((i.confidencialidad||{}).firmante ? '<div class="small muted">' + esc(i.confidencialidad.firmante) + '</div>' : '') + '</td><td class="act">' +
      (ed && i.estado !== 'retirado' ? boton('editar-inv', 'Editar', 'xs', ' data-id="' + i.id + '"') + ' ' + boton('envio-inv', 'Registrar envío', 'xs', ' data-id="' + i.id + '"') + ' ' + boton('acuerdo-inv', 'Acuerdo firmado', 'xs', ' data-id="' + i.id + '"') + ' ' +
        boton('pdf-acuerdo-inv', 'PDF del acuerdo', 'xs', ' data-id="' + i.id + '"') + ' ' + boton('paquete-inv', 'Generar paquete', 'xs ghost', ' data-id="' + i.id + '" title="Fase 2"') + ' ' + boton('retirar-inv', 'Retirar', 'xs ghost', ' data-id="' + i.id + '"') : boton('historial-inv', 'Historial', 'xs', ' data-id="' + i.id + '"')) + '</td></tr>';
  }).join('');
  return '<div class="card"><div class="card-head"><h3>' + lista.filter(i => i.estado !== 'retirado').length + ' invitado(s)</h3>' + (ed ? boton('nuevo-inv', '+ Invitado', 'sm primary') : '') + '</div><div class="card-body flush">' +
    (filas ? '<div class="tw scroll"><table class="t"><thead><tr><th>Razón social</th><th>NIT</th><th>Contacto</th><th>Código de invitación</th><th>Estado</th><th>Acuerdo</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : UI.vacio('Aún no hay invitados', 'Registre las empresas que va a invitar. El NIT se verifica con el dígito de verificación de la DIAN.', ed ? boton('nuevo-inv', '+ Invitado', 'primary') : '')) + '</div></div>' +
    '<p class="small muted">El código de invitación identifica a cada proponente: su sobre de oferta llegará firmado con él y se asignará solo a su carpeta. El paquete de invitación y ARKEN OFERTA llegan en la Fase 2.</p>';
}
const CAMPOS_INVITADO = (i) => [
  { k:'razonSocial', lab:'Razón social', val:i.razonSocial, c2:true },
  { k:'pais', lab:'País', val:i.pais || 'Colombia' }, { k:'nit', lab:'NIT (sin dígito de verificación)', val:i.nit },
  { k:'dv', lab:'Dígito de verificación', val:i.dv, ayuda:'Se calcula solo al salir del NIT; para Colombia se verifica con el algoritmo de la DIAN.' },
  { k:'ciudad', lab:'Ciudad', val:i.ciudad }, { k:'direccion', lab:'Dirección', val:i.direccion, c2:true },
  { k:'representante', lab:'Representante legal', val:i.representante }, { k:'documentoRepresentante', lab:'Documento del representante', val:i.documentoRepresentante },
  { k:'contactoNombre', lab:'Contacto: nombre', val:(i.contacto||{}).nombre }, { k:'contactoCargo', lab:'Contacto: cargo', val:(i.contacto||{}).cargo },
  { k:'contactoCorreo', lab:'Contacto: correo', tipo:'email', val:(i.contacto||{}).correo }, { k:'contactoTelefono', lab:'Contacto: teléfono', val:(i.contacto||{}).telefono }
];
function accionesInvitados(p){
  const buscar = id => Modelo.invitados(p.id).find(i => i.id === id);
  async function editar(inv){
    const i = inv ? Util.copia(inv) : { id:Util.uid('iv'), procesoId:p.id, demo:!!p.demo, estado:'por invitar', envios:[], paquetesEmitidos:[], confidencialidad:{ estado:'pendiente' }, pais:'Colombia' };
    const v = await UI.pedir({ titulo:inv ? i.razonSocial : 'Nuevo invitado', eyebrow:'Módulo 06', campos:CAMPOS_INVITADO(i),
      alAbrir:m => { const n = $('#pd_nit', m.el), d = $('#pd_dv', m.el); n.addEventListener('change', () => { if (Nit.limpiar(n.value)) d.value = Nit.digitoVerificacion(n.value); }); },
      validar:z => {
        if (!z.razonSocial) return 'Escriba la razón social.';
        if (Util.normaliza(z.pais) === 'colombia' && !Nit.valido(z.nit, z.dv)) return 'El NIT no corresponde al dígito de verificación ' + z.dv + ' (el correcto es ' + Nit.digitoVerificacion(z.nit) + ').';
        if (!z.contactoNombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(z.contactoCorreo)) return 'Escriba el nombre y un correo válido del contacto.';
        return '';
      } });
    if (!v) return;
    Object.assign(i, { razonSocial:v.razonSocial, pais:v.pais, nit:Nit.limpiar(v.nit), dv:String(v.dv).trim(), ciudad:v.ciudad, direccion:v.direccion,
      representante:v.representante, documentoRepresentante:v.documentoRepresentante,
      contacto:{ nombre:v.contactoNombre, cargo:v.contactoCargo, correo:v.contactoCorreo, telefono:v.contactoTelefono } });
    await Modelo.guardarInvitado(i, inv ? 'editado' : 'registrado'); App.render();
  }
  return {
    'nuevo-inv':() => editar(null),
    'editar-inv':b => editar(buscar(b.dataset.id)),
    'envio-inv':async b => {
      const i = buscar(b.dataset.id);
      const v = await UI.pedir({ titulo:'Registrar envío · ' + i.razonSocial, campos:[
        { k:'fecha', lab:'Fecha', tipo:'date', val:Util.hoyISO() }, { k:'medio', lab:'Medio', tipo:'select', opts:['correo electrónico','enlace de descarga','medio físico','entrega personal'] },
        { k:'que', lab:'Qué se envió', tipo:'select', opts:['acuerdo de confidencialidad','paquete de invitación','adenda','respuesta a preguntas','otro'] },
        { k:'quien', lab:'Quién lo envió', val:Sesion.usuario.nombre || Sesion.usuario.usuario }, { k:'nota', lab:'Nota', c2:true }] });
      if (!v) return;
      i.envios = (i.envios||[]).concat([Object.assign(v, { registrado:new Date().toISOString(), usuario:Sesion.usuario.usuario })]);
      if (i.estado === 'por invitar') i.estado = 'invitado';
      if (v.que === 'acuerdo de confidencialidad' && (i.confidencialidad||{}).estado === 'pendiente') i.confidencialidad = Object.assign({}, i.confidencialidad, { estado:'enviado', enviado:v.fecha });
      await Modelo.guardarInvitado(i, 'envío de ' + v.que + ' por ' + v.medio); App.render();
    },
    'acuerdo-inv':async b => {
      const i = buscar(b.dataset.id);
      const c = i.confidencialidad || {};
      const v = await UI.pedir({ titulo:'Acuerdo firmado · ' + i.razonSocial, eyebrow:'Recepción y verificación',
        antes:'<p class="small">Registre el acuerdo que devolvió el invitado. Verifique que quien firma tiene facultades según el certificado de existencia y representación legal.</p>' +
          (c.sha256 ? '<div class="huella">Archivo registrado: ' + esc(c.nombreArchivo || '') + ' · SHA-256 ' + esc(c.sha256) + '</div>' : ''),
        campos:[{ k:'firmante', lab:'Nombre de quien firma', val:c.firmante }, { k:'documentoFirmante', lab:'Documento de quien firma', val:c.documentoFirmante },
          { k:'calidad', lab:'Calidad en que firma', val:c.calidad || 'Representante legal' }, { k:'fecha', lab:'Fecha de la firma', tipo:'date', val:c.fecha || Util.hoyISO() },
          { k:'facultades', lab:'Verifiqué las facultades del firmante en el certificado de existencia y representación', tipo:'check', val:c.facultades, c2:true },
          { k:'archivo', lab:'Adjuntar el PDF firmado ahora', tipo:'check', val:!c.sha256, c2:true }],
        validar:z => !z.firmante || !z.fecha ? 'Escriba quién firma y la fecha.' : '' });
      if (!v) return;
      let archivo = {};
      if (v.archivo){
        const [f] = await UI.elegirArchivos('.pdf,.png,.jpg,.jpeg');
        if (f){ const r = await Archivos.guardar(f); archivo = { sha256:r.sha256, nombreArchivo:f.name, peso:f.size }; }
      }
      i.confidencialidad = Object.assign({}, c, archivo, { firmante:v.firmante, documentoFirmante:v.documentoFirmante, calidad:v.calidad, fecha:v.fecha, facultades:v.facultades,
        estado:v.facultades ? 'verificado' : 'firmado', registrado:new Date().toISOString(), usuario:Sesion.usuario.usuario,
        huellaTextoAprobado:(p.confidencialidad.aprobacion||{}).huella || '' });
      await Modelo.guardarInvitado(i, 'acuerdo firmado por ' + v.firmante + (archivo.sha256 ? ' · ' + archivo.sha256 : '') + (v.facultades ? ' · facultades verificadas' : '')); App.render();
    },
    'pdf-acuerdo-inv':b => Documentos.pdfConfidencialidad(p, buscar(b.dataset.id)),
    'paquete-inv':() => UI.aviso('Paquete de invitación', '<p>La generación del paquete por invitado (el pliego, los documentos vigentes, el formulario de cantidades sin precios y ARKEN OFERTA, todo firmado con la llave del proceso) llega en la <b>Fase 2</b>.</p><p>En esta fase el proceso ya se puede preparar, revisar y emitir.</p>'),
    'retirar-inv':async b => {
      const i = buscar(b.dataset.id);
      const v = await UI.pedir({ titulo:'Retirar a ' + i.razonSocial, ancho:'', campos:[{ k:'motivo', lab:'Motivo', c2:true }], textoAceptar:'Retirar',
        antes:'<p>El invitado queda retirado del proceso; su registro se conserva en la auditoría.</p>' });
      if (!v) return;
      await Modelo.retirarInvitado(i, v.motivo); App.render();
    },
    'historial-inv':b => { const i = buscar(b.dataset.id);
      UI.aviso('Envíos · ' + i.razonSocial, (i.envios||[]).length ? '<div class="tw"><table class="t"><thead><tr><th>Fecha</th><th>Qué</th><th>Medio</th><th>Quién</th></tr></thead><tbody>' +
        i.envios.map(e => '<tr><td>' + Util.fmtFecha(e.fecha) + '</td><td>' + esc(e.que) + '</td><td>' + esc(e.medio) + '</td><td>' + esc(e.quien) + '</td></tr>').join('') + '</tbody></table></div>' : '<p>Sin envíos registrados.</p>', 'wide'); }
  };
}

/* ── Acuerdo de confidencialidad ── */
const CAMPOS_ACUERDO = (c) => [
  { k:'envios', lab:'Entrega', tipo:'select', val:c.envios, c2:true, opts:[{ v:'dos', n:'Dos envíos: primero el acuerdo; el paquete, cuando llegue firmado' }, { v:'uno', n:'Un envío: aceptación obligatoria dentro de ARKEN OFERTA antes de ver los documentos' }] },
  { k:'duracionAnios', lab:'Duración de la reserva (años)', tipo:'number', val:c.duracionAnios },
  { k:'penalModo', lab:'Cláusula penal', tipo:'select', val:(c.penal||{}).modo, opts:[{ v:'porcentaje', n:'Porcentaje del presupuesto oficial' }, { v:'smmlv', n:'Número de SMMLV' }] },
  { k:'penalValor', lab:'Valor de la cláusula penal (% o número de SMMLV)', tipo:'number', val:(c.penal||{}).valor },
  { k:'controversias', lab:'Solución de controversias', tipo:'select', val:c.controversias, opts:[{ v:'arbitraje', n:'Tribunal de arbitramento' }, { v:'jueces', n:'Jueces ordinarios' }] },
  { k:'ciudad', lab:'Ciudad', val:c.ciudad }, { k:'centro', lab:'Centro de arbitraje', val:c.centro, c2:true },
  { k:'firma', lab:'Forma de firma', tipo:'select', val:c.firma, opts:[{ v:'electronica', n:'Firma electrónica (Ley 527 de 1999)' }, { v:'manuscrita', n:'Firma manuscrita' }, { v:'notario', n:'Manuscrita con presentación personal ante notario' }] },
  { k:'existenciaReservada', lab:'La existencia misma del proceso también es reservada', tipo:'check', val:c.existenciaReservada, c2:true }
];
function vistaAcuerdo(p, estado){
  const c = p.confidencialidad;
  const puedeEditar = Modelo.editable(p) && Permisos.puede('editarConfidencialidad');
  const ctx = Modelo.contextoConfidencialidad(p);
  const pen = Confidencialidad.revisarPenal(c, ctx.smmlv, ctx.presupuestoOficial);
  const falta = Confidencialidad.faltantes(ctx);
  const adv = Confidencialidad.advertenciaPais(p.pais);
  const ap = c.aprobacion;
  const clausulas = Confidencialidad.armar(ctx);
  const estadoHtml = estado === 'aprobado'
    ? '<div class="nota ok"><b>Aprobado por abogado:</b> ' + esc(ap.nombre) + ', T.P. ' + esc(ap.tarjetaProfesional) + ', el ' + Util.fmtFecha(ap.fecha) + '. <span class="huella">Huella del texto aprobado: ' + esc(ap.huella) + '</span></div>'
    : '<div class="nota warn"><b>Borrador.</b> ' + (ap ? 'El texto cambió después de la aprobación de ' + esc(ap.nombre) + ' (' + Util.fmtFecha(ap.fecha) + '): necesita una nueva aprobación. ' : '') +
      'Sin la aprobación de un usuario con rol Jurídico el proceso no se puede emitir.' + (falta.length ? ' Faltan valores: ' + esc(falta.join(', ')) + '.' : '') + '</div>';
  return estadoHtml + (adv ? '<div class="nota warn">' + esc(adv) + '</div>' : '') +
    '<div class="grid g2"><div class="card"><div class="card-head"><h3>Condiciones del acuerdo</h3>' + (puedeEditar ? boton('guardar-acuerdo', 'Guardar', 'sm primary') : '') + '</div><div class="card-body">' +
      UI.formulario(CAMPOS_ACUERDO(c).map(x => Object.assign(x, { deshabilitado:!puedeEditar })), 'nda') +
      '<div class="nota ' + (pen.nivel === 'ok' ? 'ok' : pen.nivel) + '" style="margin-top:12px"><b>Cláusula penal: ' + (pen.valor === null ? '—' : money(pen.valor)) + '.</b> ' + esc(pen.mensaje || 'Dentro del rango sugerido.') +
        (pen.sugerido ? '<div class="small">Rango sugerido: 1 % a 5 % del presupuesto oficial (' + money(pen.sugerido.desde) + ' a ' + money(pen.sugerido.hasta) + (pen.sugerido.desdeSmmlv !== undefined ? ', unos ' + pen.sugerido.desdeSmmlv + ' a ' + pen.sugerido.hastaSmmlv + ' SMMLV' : '') + '). Es una guía para el abogado: él decide.</div>' : '') + '</div>' +
    '</div></div>' +
    '<div class="card"><div class="card-head"><h3>Aprobación y documento</h3></div><div class="card-body">' +
      '<p class="small">El texto es una plantilla editable por proceso, construida sobre la ley colombiana. Queda en borrador hasta que un usuario con rol Jurídico registra «Aprobado por abogado». Todo cambio posterior lo devuelve a borrador.</p>' +
      '<div class="btn-row">' + boton('pdf-acuerdo', estado === 'aprobado' ? 'PDF del acuerdo' : 'PDF del borrador') +
        (Permisos.puede('aprobarConfidencialidad') && Modelo.editable(p) ? boton('aprobar-acuerdo', 'Registrar «Aprobado por abogado»', 'brass') : '') + '</div>' +
      (!Permisos.puede('aprobarConfidencialidad') ? '<p class="small muted" style="margin-top:10px">Solo un usuario con el rol Jurídico puede aprobar. El administrador lo crea en Administración › Usuarios.</p>' : '') +
    '</div></div></div>' +
    '<div class="card"><div class="card-head"><h3>Texto del acuerdo</h3><span class="small muted">Resaltado: valores del proceso · <span class="inv">así</span>: datos de cada invitado · <span class="falta">así</span>: falta diligenciar</span></div><div class="card-body"><div class="doc-legal">' +
      clausulas.map(cl => '<h4>' + esc(cl.titulo) + (cl.editado ? ' ' + UI.tag('editada', 'warn') : '') + (puedeEditar ? ' ' + boton('editar-clausula', 'Editar', 'xs ghost', ' data-id="' + cl.id + '"') : '') + '</h4><p>' +
        cl.segmentos.map(s => s.t !== undefined ? esc(s.t) : '<mark class="' + (s.invitado ? 'inv' : s.falta ? 'falta' : '') + '" title="' + esc(s.v) + '">' + esc(s.valor) + '</mark>').join('') + '</p>').join('') +
    '</div></div></div>';
}
function accionesAcuerdo(p){
  return {
    'guardar-acuerdo':async () => {
      const v = UI.leer(CAMPOS_ACUERDO(p.confidencialidad), document, 'nda');
      if (!(Number(v.duracionAnios) > 0)) throw new Error('La duración de la reserva debe ser mayor que cero.');
      if (!(Number(v.penalValor) >= 0)) throw new Error('El valor de la cláusula penal no es válido.');
      const cfg = Object.assign(Util.copia(p.confidencialidad), { envios:v.envios, duracionAnios:Number(v.duracionAnios), penal:{ modo:v.penalModo, valor:Number(v.penalValor) },
        controversias:v.controversias, ciudad:v.ciudad, centro:v.centro, firma:v.firma, existenciaReservada:v.existenciaReservada });
      await Modelo.guardarConfidencialidad(p, cfg, 'Condiciones del acuerdo'); UI.toast('Condiciones del acuerdo guardadas', 'ok'); App.render();
    },
    'editar-clausula':async b => {
      const cl = Confidencialidad.CLAUSULAS.find(x => x.id === b.dataset.id);
      const actual = (p.confidencialidad.textos||{})[cl.id];
      const v = await UI.pedir({ titulo:cl.titulo, eyebrow:'Cláusula del acuerdo', ancho:'xwide', campos:[
        { k:'texto', lab:'Texto', tipo:'textarea', filas:10, c2:true, val:actual !== undefined ? actual : cl.texto,
          ayuda:'Los valores entre llaves dobles, como {{penal}} o {{invitado.razonSocial}}, se llenan solos. Si los borra, el texto queda fijo.' },
        { k:'restaurar', lab:'Volver al texto de la plantilla', tipo:'check', c2:true }], textoAceptar:'Guardar cláusula' });
      if (!v) return;
      const cfg = Util.copia(p.confidencialidad); cfg.textos = cfg.textos || {};
      if (v.restaurar || v.texto === cl.texto) delete cfg.textos[cl.id]; else cfg.textos[cl.id] = v.texto;
      await Modelo.guardarConfidencialidad(p, cfg, 'Cláusula ' + cl.titulo + (v.restaurar ? ' restaurada' : ' editada')); App.render();
    },
    'pdf-acuerdo':() => Documentos.pdfConfidencialidad(p),
    'aprobar-acuerdo':async () => {
      const v = await UI.pedir({ titulo:'Aprobado por abogado', eyebrow:'Acuerdo de confidencialidad · ' + p.codigo, textoAceptar:'Registrar aprobación',
        antes:'<p>Con este registro usted declara, como abogado, que revisó el texto vigente del acuerdo y que lo aprueba. Queda la huella SHA-256 del texto: cualquier cambio posterior lo devuelve a borrador.</p>',
        campos:[{ k:'nombre', lab:'Nombre del abogado', val:Sesion.usuario.nombre }, { k:'tarjetaProfesional', lab:'Tarjeta profesional' }, { k:'fecha', lab:'Fecha', tipo:'date', val:Util.hoyISO() }],
        validar:z => !z.nombre || !z.tarjetaProfesional || !z.fecha ? 'Escriba el nombre, la tarjeta profesional y la fecha.' : '' });
      if (!v) return;
      await Modelo.aprobarConfidencialidad(p, v); UI.toast('Acuerdo aprobado por ' + v.nombre, 'ok'); App.render();
    }
  };
}
