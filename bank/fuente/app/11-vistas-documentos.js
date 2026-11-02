/* ─────────────── 03 · Documentos ───────────────
   La lista de documentos sale del catálogo según el tipo de cliente y el
   crédito. Cada fila muestra si falta, si está cargado, si ya se leyó y si
   venció. «Leer» saca el texto (pdf.js u OCR) y busca los datos; «Revisar»
   muestra cada dato con su página y su texto literal y deja pasarlos al perfil. */
const ESTADO_DOC = { falta:['Falta', 'bad'], cargado:['Cargado · sin leer', 'warn'], leido:['Leído', 'ok'], vencido:['Vencido', 'bad'] };
const ACEPTA_DOCS = '.pdf,.png,.jpg,.jpeg,.webp,.bmp,.txt';

function filaArchivo(d){
  const L = d.lectura;
  const info = L ? (L.datos.filter(x => !x.motivo).length + ' dato(s) leído(s)' + (L.metodo === 'ocr' ? ' · por OCR' : L.metodo === 'mixto' ? ' · texto y OCR' : '') +
      (L.faltan.length ? ' · <span class="warn-txt">no encontró: ' + esc(L.faltan.join(', ').toLowerCase()) + '</span>' : '') +
      (!L.coincideTipo ? ' · <span class="bad-txt">parece ' + esc(((Catalogo.documento(L.clasificado) || {}).nombre || 'otro documento').toLowerCase()) + '</span>' : ''))
    : 'Sin leer';
  return '<div class="archivo"><div class="nm"><b>' + esc(d.nombre) + '</b><div class="small muted">' + Util.pesoLegible(d.peso) + ' · cargado el ' + Util.fmtFecha(d.cargado) +
    (d.fechaExpedicion ? ' · expedido el ' + Util.fmtFecha(d.fechaExpedicion) : '') + '</div><div class="small">' + info + '</div></div><div class="btn-row" style="margin:0">' +
    boton('ver-doc', 'Ver', 'xs', ' data-id="' + d.id + '"') +
    (Permisos.puede('leerDocumentos') ? boton('leer-doc', L ? 'Leer de nuevo' : 'Leer', 'xs' + (L ? '' : ' primary'), ' data-id="' + d.id + '"') : '') +
    (L ? boton('revisar-doc', 'Revisar datos', 'xs', ' data-id="' + d.id + '"') : '') +
    (Permisos.puede('cargarDocumentos') ? boton('fecha-doc', 'Fecha', 'xs ghost', ' data-id="' + d.id + '" title="Fecha de expedición"') + boton('borrar-doc', '✕', 'xs ghost', ' data-id="' + d.id + '" title="Quitar"') : '') +
    '</div></div>';
}

Vistas['03'] = function(){
  const c = Modelo.activo();
  if (!c) return { html:sinCliente('03', 'Documentos'), acciones:AccionesComunes };
  const ctx = Modelo.contexto(c), E = ctx.docs;
  const prod = Catalogo.producto((c.perfil || {}).producto);
  const puedeCargar = Permisos.puede('cargarDocumentos');
  const sinLeer = Modelo.documentos(c.id).filter(d => !d.lectura);
  const grupos = [];
  E.detalle.forEach(x => { let g = grupos.find(y => y.n === x.doc.grupo); if (!g){ g = { n:x.doc.grupo, filas:[] }; grupos.push(g); } g.filas.push(x); });
  const filas = grupos.map(g => '<tr class="grupo"><td colspan="3">' + esc(g.n) + '</td></tr>' + g.filas.map(x => {
    const e = ESTADO_DOC[x.estado] || ['', ''];
    return '<tr><td class="doc-nm"><b>' + esc(x.doc.nombre) + '</b> ' + (x.obligatorio ? '' : UI.tag('según el caso', 'info')) +
      '<div class="small muted">' + esc(x.doc.desc || '') + (x.doc.cuando ? ' ' + esc(x.doc.cuando) : '') + (x.doc.vigencia ? ' Vigencia: ' + x.doc.vigencia + ' días.' : '') + '</div></td>' +
      '<td>' + UI.tag(e[0], x.obligatorio || x.estado !== 'falta' ? e[1] : '') + (x.venceEl && x.estado !== 'vencido' ? '<div class="small muted">vence el ' + Util.fmtFecha(x.venceEl) + '</div>' : '') +
      (x.sinFecha ? '<div class="small warn-txt">Sin fecha de expedición</div>' : '') + '</td>' +
      '<td>' + x.archivos.map(filaArchivo).join('') + (puedeCargar ? boton('cargar-doc', x.archivos.length ? '+ Otro archivo' : 'Cargar', 'xs' + (x.archivos.length ? ' ghost' : ''), ' data-tipo="' + x.doc.id + '"') : '') + '</td></tr>';
  }).join('')).join('');
  const alertas = ctx.alertas.length ? '<div class="card"><div class="card-head"><h3>Coherencia entre documentos y perfil</h3></div><div class="card-body">' +
    ctx.alertas.map(a => '<div class="nota ' + (a.grave ? 'bad' : 'warn') + '"><b>' + esc(a.titulo) + '</b>' + (a.valor ? ' · <span class="num">' + esc(a.valor) + '</span>' : '') + '<div class="small">' + esc(a.detalle || '') + '</div></div>').join('') + '</div></div>' : '';
  const html = cabecera('03', 'Documentos', esc(c.nombre) + ' · ' + (prod ? esc(prod.nombre) : 'sin crédito elegido') + etiquetaDemo(c),
      (sinLeer.length && Permisos.puede('leerDocumentos') ? boton('leer-todos', 'Leer ' + sinLeer.length + ' pendiente(s)', 'primary') : '') +
      (puedeCargar ? boton('cargar-doc', 'Cargar y clasificar', '', ' data-tipo=""') : '') + boton('ir', 'Ficha', 'ghost', ' data-m="02"')) +
    (!prod ? '<div class="nota warn">El cliente aún no tiene crédito elegido: se muestran los documentos comunes. Elíjalo en la ficha para ver la lista completa.</div>' : '') +
    '<div class="grid g4">' +
      '<div class="stat"><div class="lab">Obligatorios cargados</div><div class="val">' + E.cargados + ' / ' + E.requeridos + '</div><div class="foot">' + medidor(E.avance) + '</div></div>' +
      '<div class="stat"><div class="lab">Por cargar</div><div class="val">' + E.faltantes.length + '</div><div class="foot">obligatorios</div></div>' +
      '<div class="stat"><div class="lab">Vencidos</div><div class="val' + (E.vencidos.length ? ' bad-txt' : '') + '">' + E.vencidos.length + '</div><div class="foot">por fecha de expedición</div></div>' +
      '<div class="stat"><div class="lab">Sin leer</div><div class="val">' + sinLeer.length + '</div><div class="foot">archivos</div></div>' +
    '</div>' + alertas +
    '<div class="card"><div class="card-head"><h3>Documentos para ' + esc(prod ? prod.corto.toLowerCase() : 'el estudio') + '</h3></div><div class="card-body flush"><div class="tw"><table class="t docs"><thead><tr><th>Documento</th><th>Estado</th><th>Archivos</th></tr></thead><tbody>' + filas + '</tbody></table></div></div></div>' +
    (E.otros.length ? '<div class="card"><div class="card-head"><h3>Otros documentos del cliente</h3></div><div class="card-body">' + E.otros.map(d => '<div class="small muted">' + esc((Catalogo.documento(d.tipoDoc) || { nombre:'Sin clasificar' }).nombre) + '</div>' + filaArchivo(d)).join('') + '</div></div>' : '') +
    '<p class="small muted">Los archivos quedan guardados en este equipo, dentro del programa. La lectura funciona sin internet: el texto de los PDF se extrae directamente y las páginas escaneadas o las fotos pasan por reconocimiento de texto (OCR) en español.</p>';

  async function leerConProgreso(lista){
    const m = UI.modal({ titulo:'Leyendo documentos', eyebrow:'Lectura', fijo:true, cuerpo:'<p id="lecAviso" class="small">Preparando…</p><div class="meter-l"><i id="lecBarra" style="width:0%"></i></div>' });
    const av = t => { const e = $('#lecAviso', m.el); if (e) e.textContent = t; };
    let ok = 0; const errores = [];
    for (let i = 0; i < lista.length; i++){
      const d = lista[i];
      $('#lecBarra', m.el).style.width = Math.round(i / lista.length * 100) + '%';
      try { await Lectura.leer(d, t => av((lista.length > 1 ? (i + 1) + ' de ' + lista.length + ' · ' : '') + d.nombre + ' · ' + t)); ok++; }
      catch(e){ RegistroTecnico.anotar('lectura', e); errores.push(d.nombre + ': ' + e.message); }
    }
    m.cerrar();
    if (errores.length) UI.aviso('Lectura con problemas', '<p>' + ok + ' documento(s) leído(s).</p><ul>' + errores.map(x => '<li class="small">' + esc(x) + '</li>').join('') + '</ul>');
    else UI.toast(ok + ' documento(s) leído(s). Revise los datos y páselos al perfil.', 'ok');
    App.render();
  }

  return { html, acciones:Object.assign({
    'cargar-doc':async b => {
      const files = await UI.elegirArchivos(ACEPTA_DOCS, true);
      if (!files.length) return;
      const hechos = await Archivos.cargar(c, b.dataset.tipo || 'otro', files);
      if (!hechos.length){ App.render(); return; }
      UI.toast(hechos.length + ' archivo(s) cargado(s)', 'ok');
      if (Permisos.puede('leerDocumentos')) await leerConProgreso(hechos.map(d => Modelo.documento(d.id)));
      else App.render();
    },
    'leer-doc':b => leerConProgreso([Modelo.documento(b.dataset.id)]),
    'leer-todos':() => leerConProgreso(Modelo.documentos(c.id).filter(d => !d.lectura)),
    'ver-doc':b => Archivos.ver(Modelo.documento(b.dataset.id)),
    'revisar-doc':b => RevisionLectura.abrir(c, Modelo.documento(b.dataset.id)),
    'fecha-doc':async b => {
      const d = Modelo.documento(b.dataset.id);
      const v = await UI.pedir({ titulo:'Fecha de expedición', eyebrow:d.nombre, ancho:'', campos:[
        { k:'fecha', lab:'Fecha de expedición', tipo:'date', val:d.fechaExpedicion || '', c2:true },
        { k:'tipoDoc', lab:'Tipo de documento', tipo:'select', val:d.tipoDoc, c2:true, opts:[{ v:'otro', n:'Sin clasificar' }].concat(Catalogo.DOCUMENTOS.map(x => ({ v:x.id, n:x.nombre }))) }],
        antes:'<p class="small">La vigencia se cuenta desde la fecha de expedición. El lector la toma del documento; corríjala aquí si hace falta.</p>' });
      if (!v) return;
      Permisos.exigir('cargarDocumentos');
      await Modelo.guardarDocumento(Object.assign(Util.copia(d), { fechaExpedicion:v.fecha, tipoDoc:v.tipoDoc }));
      await Auditoria.registrar('editar', 'documento', d.nombre + ' · expedido ' + (v.fecha || '—'), c.id);
      App.render();
    },
    'borrar-doc':async b => {
      const d = Modelo.documento(b.dataset.id);
      if (!(await UI.confirmar({ titulo:'Quitar documento', mensaje:'Se quita «' + d.nombre + '» de este cliente.', textoAceptar:'Quitar', claseAceptar:'danger' }))) return;
      await Modelo.borrarDocumento(d.id); UI.toast('Documento quitado', 'ok'); App.render();
    }
  }, AccionesComunes) };
};

/** Revisión de la lectura: cada dato con su evidencia, y lo que propone para el perfil. */
const RevisionLectura = (function(){
  function valorLegible(x){
    const v = x.normalizado === null || x.normalizado === undefined ? x.valor : x.normalizado;
    const def = Lector.CAMPOS.find(c => c.k === x.campo) || {};
    if (typeof v === 'number' && def.tipo === 'dinero') return money(v);
    if (typeof v === 'number' && def.tipo === 'porcentaje') return Util.pct(v, 2);
    if (def.tipo === 'fecha' && /^\d{4}-\d{2}-\d{2}$/.test(String(v))) return Util.fmtFecha(v);
    return String(v);
  }
  function legiblePerfil(k, v){
    const def = Catalogo.campo(k) || {};
    if (v === '' || v === null || v === undefined) return '—';
    if (def.tipo === 'dinero') return money(v);
    if (def.tipo === 'fecha') return Util.fmtFecha(v);
    if (def.tipo === 'si/no') return v === true ? 'Sí' : v === false ? 'No' : '—';
    return String(v);
  }
  function abrir(c, d){
    const L = d.lectura; if (!L) return;
    const P = Lectura.propuestas(c, d);
    const tdef = Catalogo.documento(d.tipoDoc);
    const datos = L.datos.map((x, i) => '<tr><td><b>' + esc(x.nombreCampo || x.campo) + '</b></td><td class="num">' + esc(valorLegible(x)) + (x.motivo ? '<div class="small warn-txt">' + esc(x.motivo) + '</div>' : '') + '</td>' +
      '<td class="small center">' + x.pagina + '</td><td class="small evid">«' + esc(x.texto) + '»</td></tr>').join('');
    const props = P.length ? '<table class="t"><thead><tr><th></th><th>Campo del perfil</th><th>Hoy</th><th>Leído</th></tr></thead><tbody>' + P.map((p, i) => {
      const def = Catalogo.campo(p.k) || { lab:p.k };
      const igual = String(p.actual) === String(p.valor);
      return '<tr><td><input type="checkbox" id="rv_' + i + '"' + (igual ? '' : ' checked') + (Permisos.puede('editarCliente') ? '' : ' disabled') + '></td><td>' + esc(def.lab) + (p.nota ? '<div class="small muted">' + esc(p.nota) + '</div>' : '') +
        '</td><td class="num small">' + esc(legiblePerfil(p.k, p.actual)) + '</td><td class="num"><b>' + esc(legiblePerfil(p.k, p.valor)) + '</b>' + (igual ? ' ' + UI.tag('igual', 'ok') : '') + '</td></tr>'; }).join('') + '</tbody></table>'
      : '<p class="small muted">Este documento no trae datos que cambien el perfil.</p>';
    const cuerpo = '<div class="kv-l"><span>Tipo</span><b>' + esc(tdef ? tdef.nombre : 'Sin clasificar') + '</b><span>Método</span><b>' + (L.metodo === 'ocr' ? 'Reconocimiento de texto (OCR)' : L.metodo === 'mixto' ? 'Texto y OCR (páginas ' + L.paginasOcr.join(', ') + ')' : 'Texto del PDF') +
      '</b><span>Páginas</span><b>' + L.numPaginas + '</b><span>Leído</span><b>' + Util.fmtSello(L.fecha) + ' · ' + esc(L.usuario) + '</b></div>' +
      (!L.coincideTipo ? '<div class="nota bad">El contenido parece un «' + esc((Catalogo.documento(L.clasificado) || {}).nombre || L.clasificado) + '», no un «' + esc(tdef ? tdef.nombre : '') + '». Cambie el tipo con el botón «Fecha» si se cargó en la fila equivocada.</div>' : '') +
      (L.faltan.length ? '<div class="nota warn">No se encontró: ' + esc(L.faltan.join(', ')) + '. Verifíquelo a mano en el documento.</div>' : '') +
      (L.metodo !== 'texto' ? '<div class="nota info">Parte del texto viene de OCR: compare cada cifra con la evidencia antes de pasarla al perfil.</div>' : '') +
      '<h4 class="sub-t">Pasar al perfil del cliente</h4>' + props +
      '<h4 class="sub-t">Datos leídos y su evidencia</h4>' + (datos ? '<div class="tw scroll" style="max-height:340px"><table class="t"><thead><tr><th>Dato</th><th>Valor</th><th>Pág.</th><th>Texto del documento</th></tr></thead><tbody>' + datos + '</tbody></table></div>' : '<p class="small muted">No se encontraron datos.</p>') +
      '<details style="margin-top:10px"><summary class="small">Ver el texto extraído</summary><pre class="texto-ext">' + esc((L.texto || []).map((t, i) => '── Página ' + (i + 1) + ' ──\n' + t).join('\n\n')) + '</pre></details>';
    UI.modal({ titulo:d.nombre, eyebrow:'Datos leídos', ancho:'wide', cuerpo, botones:[{ texto:'Cerrar' }].concat(P.length && Permisos.puede('editarCliente') ? [{ texto:'Pasar al perfil', clase:'primary', accion:async m => {
      const elegidos = P.filter((p, i) => { const el = $('#rv_' + i, m.el); return el && el.checked; });
      if (!elegidos.length){ UI.toast('Marque al menos un dato.', 'bad'); return; }
      await Lectura.aplicar(Modelo.cliente(c.id), d, elegidos);
      m.cerrar(); UI.toast(elegidos.length + ' dato(s) pasados al perfil, con su documento de origen.', 'ok'); App.render();
    } }] : []) });
  }
  return { abrir };
})();

/* ─────────────── Demostración ───────────────
   Crea los clientes de ejemplo y convierte el texto de sus documentos en PDF
   reales (jsPDF), que luego lee el mismo lector que los documentos del usuario. */
const DemoApp = (function(){
  function pdfDe(lineas){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'mm', format:'letter' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    let y = 22;
    lineas.forEach(l => {
      doc.splitTextToSize(String(l), 175).forEach(s => {
        if (y > 260){ doc.addPage(); y = 22; }
        doc.text(s, 20, y); y += 5.6;
      });
      if (!l) y += 1.5;
    });
    doc.setFontSize(7); doc.setTextColor(150, 54, 46); doc.text('DOCUMENTO DE DEMOSTRACIÓN · DATOS FICTICIOS', 20, 272);
    return doc.output('arraybuffer');
  }
  function hayDemo(){ return (S.clientes || []).some(c => c.demo); }
  async function cargar(){
    Permisos.exigir('demostracion');
    if (hayDemo()){ UI.toast('La demostración ya está cargada.'); App.ir('01'); return; }
    const m = UI.modal({ titulo:'Cargando la demostración', fijo:true, cuerpo:'<p id="dmAviso" class="small">Creando clientes…</p>' });
    const av = t => { const e = $('#dmAviso', m.el); if (e) e.textContent = t; };
    try {
      const hoy = Util.hoyISO();
      for (const c of Demo.clientes(hoy)) await Almacen.poner('clientes', c);
      const docs = Demo.documentos(hoy);
      for (const x of docs){
        av('Generando y leyendo «' + x.nombre + '»…');
        const bytes = new Uint8Array(pdfDe(x.lineas));
        const sha = await Cripto.sha256(bytes);
        if (!(await Almacen.hayArchivo(sha))) await Almacen.ponerArchivo(sha, new Blob([bytes], { type:'application/pdf' }));
        const d = { id:Util.uid('doc'), clienteId:x.clienteId, tipoDoc:x.tipoDoc, nombre:x.nombre, sha256:sha, peso:bytes.length, tipo:'application/pdf',
          cargado:new Date().toISOString(), usuario:Sesion.usuario.usuario, lectura:null, fechaExpedicion:'', demo:true };
        await Modelo.guardarDocumento(d);
        try { await Lectura.leer(Modelo.documento(d.id)); } catch(e){ RegistroTecnico.anotar('demostración', e); }
      }
      await Auditoria.registrar('crear', 'demostración', Demo.clientes(hoy).length + ' clientes y ' + docs.length + ' documentos de ejemplo');
      Modelo.abrir('cli_demo_laura');
      m.cerrar(); UI.toast('Demostración cargada: 6 clientes ficticios con documentos de ejemplo.', 'ok'); App.ir('01');
    } catch(e){ m.cerrar(); throw e; }
  }
  async function borrar(){
    Permisos.exigir('demostracion');
    if (!(await UI.confirmar({ titulo:'Borrar la demostración', mensaje:'Se borran los clientes de demostración, sus documentos y sus conceptos. Sus propios clientes no se tocan.', textoAceptar:'Borrar', claseAceptar:'danger' }))) return;
    for (const c of (S.clientes || []).filter(x => x.demo)){
      for (const d of Modelo.documentos(c.id)) await Modelo.borrarDocumento(d.id, true);
      for (const k of Modelo.conceptos(c.id)) await Almacen.borrar('conceptos', k.id);
      await Almacen.borrar('clientes', c.id);
    }
    if (Sesion.clienteActivo && !Modelo.cliente(Sesion.clienteActivo)) Modelo.abrir(null);
    await Auditoria.registrar('borrar', 'demostración', 'Datos de demostración borrados');
    UI.toast('Demostración borrada', 'ok'); App.render();
  }
  return { cargar, borrar, hayDemo, pdfDe };
})();
