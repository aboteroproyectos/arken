/* ══════════════════════════════════════════════════════════════════════════
   ARKEN OFERTA · VISTAS — una función por módulo, como en el principal:
   cada vista devuelve { html, acciones, cambios } y App conecta los botones
   (data-accion) y los campos que guardan al cambiar (data-cambio).
   Ninguna vista calcula dinero: todo sale de Borrador.calculo (Calculo).
   ══════════════════════════════════════════════════════════════════════════ */
const Vistas = {};

/** El borrador abierto. Toda escritura pasa por Oferta.guardar. */
const Oferta = (function(){
  let b = null;
  function borrador(){ return b; }
  function usar(x){ b = x; }
  async function guardar(){
    b.actualizado = new Date().toISOString();
    await AlmacenOferta.poner('borradores', b);
  }
  return { borrador, usar, guardar, pl:() => Plg.actual() };
})();

function cabecera(num, titulo, sub, acciones){
  return '<div class="page-head"><div><div class="eyebrow">' + (num ? 'Módulo ' + num : '') + '</div><h1>' + esc(titulo) + '</h1>' +
    (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div><div class="head-actions">' + (acciones||'') + '</div></div>';
}
function boton(accion, texto, clase, extra){
  return '<button class="btn ' + (clase||'') + '" type="button" data-accion="' + accion + '"' + (extra||'') + '>' + esc(texto) + '</button>';
}
function etiquetaDemo(pl){ return pl.proceso.demo ? ' ' + UI.tag('DEMOSTRACIÓN', 'demo') : ''; }
function itemChk(ok, textoHtml, extra){
  return '<div class="chk ' + (ok ? 'ok' : 'no') + '"><span class="ic" aria-hidden="true">' + (ok ? '✓' : '✕') + '</span><div class="tx"><b>' + (ok ? 'Listo' : 'Falta') + ':</b> ' + textoHtml + (extra ? '<div>' + extra + '</div>' : '') + '</div></div>';
}
function instanteCierre(pl){ const h = (pl.cronograma||[]).find(x => x.clave === 'cierre'); return h && h.fecha ? new Date(Cronograma.instante(h)).getTime() : NaN; }
function textoCierre(pl){ const h = (pl.cronograma||[]).find(x => x.clave === 'cierre'); return h && h.fecha ? Util.fmtFecha(h.fecha) + ' ' + (h.hora || '') : 'sin fecha'; }

/** Los módulos que aparecen: los de 05 a 12 solo si el pliego tiene requisitos para ellos. */
function modulosOferta(pl){
  if (pl.etapa === 'confidencialidad')
    return [['00','Resumen'], ['01','Datos del proponente'], ['02','Acuerdo de confidencialidad'], ['14','Generar sobre de confidencialidad'], ['15','Ayuda']];
  const L = [['00','Resumen y avance'], ['01','Datos del proponente'], ['02','Documentos del proceso'], ['03','Presupuesto y APU'], ['04','AIU e impuestos']];
  Borrador.MODULOS_REQ.forEach(([id, nombre]) => { if (Borrador.requisitosDe(pl, id).length) L.push([id, nombre]); });
  if (Borrador.requisitosDe(pl, '12').length) L.push(['12', 'Requisitos adicionales']);
  L.push(['13','Preguntas'], ['14','Revisar y generar sobre'], ['15','Ayuda']);
  return L;
}

/* ─────────────── 00 · Resumen y avance ─────────────── */
Vistas['00'] = function(){
  const b = Oferta.borrador(), pl = Oferta.pl();
  const rev = Borrador.revision(b, pl), av = Borrador.avance(b, pl);
  const grupos = [];
  rev.forEach(x => { if (grupos.indexOf(x.grupo) < 0) grupos.push(x.grupo); });
  const k = pl.etapa === 'confidencialidad' ? null : Borrador.calculo(b, pl);
  const html = cabecera('00', pl.etapa === 'confidencialidad' ? 'Resumen' : 'Resumen y avance', esc(pl.proceso.codigo) + ' · versión ' + pl.versionPliego + ' del pliego' + etiquetaDemo(pl), boton('cargar-borrador', 'Cargar borrador desde archivo', 'sm')) +
    '<div class="cover-hero"><div class="inner"><div class="eyebrow" style="color:#DCCFB4">' + esc(pl.empresaPrincipal.razonSocial || 'EMPRESA PRINCIPAL') + ' · ' + esc(pl.proceso.modalidad || '') + '</div>' +
      '<h2>' + esc(pl.proceso.nombre) + ' <b>' + esc(pl.proceso.codigo) + '</b></h2><p>' + esc(pl.proceso.objeto || '') + '</p><div class="cover-rule"></div></div></div>' +
    (pl.etapa === 'confidencialidad' ? '<div class="nota" style="margin-top:var(--gap)">Este es el primer envío del proceso: solo el acuerdo de confidencialidad. Fírmelo, adjúntelo en el módulo 02 y genere el sobre de confidencialidad en el módulo 14. Cuando la EMPRESA PRINCIPAL lo verifique, le enviará el paquete completo.</div>' : '') +
    '<div class="grid g4" style="margin-top:var(--gap)">' +
      '<div class="stat"><div class="lab">Invitado</div><div class="val" style="font-size:14px">' + esc(pl.invitado.razonSocial) + '</div><div class="foot">NIT ' + esc(pl.invitado.nit) + ' · código ' + esc(pl.invitado.codigoInvitacion) + '</div></div>' +
      '<div class="stat accent"><div class="lab">Avance</div><div class="val">' + av + ' %</div><div class="meter"><i style="width:' + av + '%;background:var(--brass)"></i></div></div>' +
      (k ? '<div class="stat"><div class="lab">Valor de la oferta</div><div class="val">' + money(k.totales.total) + '</div><div class="foot">Costo directo ' + money(k.totales.costoDirecto) + '</div></div>' : '<div class="stat"><div class="lab">Entrega</div><div class="val" style="font-size:14px">Sobre de confidencialidad</div></div>') +
      '<div class="stat"><div class="lab">Cierre</div><div class="val" style="font-size:14px">' + esc(textoCierre(pl)) + '</div><div class="foot">Hora de Colombia</div></div>' +
    '</div>' +
    '<div class="grid g2" style="margin-top:var(--gap)"><div class="card"><div class="card-head"><h3>Lo obligatorio</h3>' + boton('ir-14', 'Revisar y generar sobre', 'sm primary') + '</div><div class="card-body">' +
      grupos.map(g => { const xs = rev.filter(x => x.grupo === g); const ok = xs.filter(x => x.ok).length;
        return '<div class="row" style="justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line-soft)"><span>' + esc(g) + '</span>' + UI.tag(ok + ' / ' + xs.length, ok === xs.length ? 'ok' : 'bad') + '</div>'; }).join('') +
    '</div></div><div class="card"><div class="card-head"><h3>Cronograma del proceso</h3></div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Hito</th><th>Fecha</th><th>Hora</th></tr></thead><tbody>' +
      (pl.cronograma||[]).map(h => '<tr><td>' + esc(h.nombre) + '</td><td>' + Util.fmtFecha(h.fecha) + '</td><td>' + esc(h.hora || '—') + '</td></tr>').join('') +
    '</tbody></table></div></div></div></div>' +
    ((b.adendas||[]).length ? '<div class="nota ok" style="margin-top:var(--gap)">Adendas importadas: ' + b.adendas.map(a => 'N.º ' + a.numero + ' (versión ' + a.versionNueva + ')').join(', ') + '.</div>' : '');
  return { html, acciones:{ 'ir-14':() => App.ir('14') } };
};

/* ─────────────── 01 · Datos del proponente ─────────────── */
const TIPOS_PROPONENTE = [{ v:'juridica', n:'Persona jurídica' }, { v:'natural', n:'Persona natural' }, { v:'consorcio', n:'Consorcio' }, { v:'union', n:'Unión temporal' }];
Vistas['01'] = function(){
  const b = Oferta.borrador(), pl = Oferta.pl(), p = b.proponente;
  const tipos = pl.proceso.consorcios === false ? TIPOS_PROPONENTE.slice(0, 2) : TIPOS_PROPONENTE;
  const campos = [
    { k:'razonSocial', lab:'Razón social (del paquete, no se modifica)', val:p.razonSocial, deshabilitado:true },
    { k:'nit', lab:'NIT (del paquete, no se modifica)', val:p.nit, deshabilitado:true },
    { k:'tipo', lab:'Tipo de proponente', tipo:'select', opts:tipos, val:p.tipo },
    { k:'representante', lab:'Representante legal', val:p.representante },
    { k:'documentoRepresentante', lab:'Documento del representante', val:p.documentoRepresentante },
    { k:'domicilio', lab:'Domicilio (ciudad)', val:p.domicilio }, { k:'direccion', lab:'Dirección', val:p.direccion },
    { k:'telefono', lab:'Teléfono', val:p.telefono }, { k:'correo', lab:'Correo para notificaciones', tipo:'email', val:p.correo }
  ];
  const cons = p.tipo === 'consorcio' || p.tipo === 'union';
  const suma = (p.integrantes||[]).reduce((t, x) => t + Number(x.porcentaje||0), 0);
  const integrantes = cons ? '<div class="card"><div class="card-head"><h3>Integrantes del ' + (p.tipo === 'consorcio' ? 'consorcio' : 'unión temporal') + '</h3>' + boton('integrante-mas', '+ Integrante', 'sm') + '</div><div class="card-body flush"><div class="tw"><table class="t"><thead><tr><th>Razón social</th><th>NIT</th><th class="n">Participación (%)</th><th></th></tr></thead><tbody>' +
    (p.integrantes||[]).map((x, i) => '<tr><td><input class="ancho" data-cambio="integrante" data-i="' + i + '" data-c="razonSocial" value="' + esc(x.razonSocial) + '" aria-label="Razón social"></td>' +
      '<td><input data-cambio="integrante" data-i="' + i + '" data-c="nit" value="' + esc(x.nit) + '" aria-label="NIT"></td><td class="n"><input class="num" type="number" step="any" data-cambio="integrante" data-i="' + i + '" data-c="porcentaje" value="' + esc(x.porcentaje) + '" aria-label="Participación"></td>' +
      '<td class="act">' + boton('integrante-menos', '✕', 'xs', ' data-i="' + i + '" aria-label="Quitar integrante"') + '</td></tr>').join('') +
    '</tbody><tfoot><tr><td colspan="2">Suma</td><td class="n ' + (Math.abs(suma - 100) < 1e-6 ? 'ok-txt' : 'bad-txt') + '">' + Util.cant(suma) + ' %</td><td></td></tr></tfoot></table></div></div></div>' : '';
  const jur = pl.etapa === 'confidencialidad' ? [] : Borrador.requisitosDe(pl, '01');
  const html = cabecera('01', 'Datos del proponente', esc(pl.invitado.razonSocial)) +
    '<div class="card"><div class="card-head"><h3>Proponente</h3>' + boton('guardar-proponente', 'Guardar', 'sm primary') + '</div><div class="card-body">' + UI.formulario(campos, 'pr') +
      '<p class="small muted" style="margin-top:10px">La razón social y el NIT vienen en el paquete, que es personal. Si hay un error en ellos, avísele a la EMPRESA PRINCIPAL por preguntas.</p></div></div>' +
    integrantes + (pl.proceso.envios === 'uno' && pl.etapa !== 'confidencialidad' ? Requisitos.tarjetaAcuerdo(b, pl) : '') +
    (jur.length ? '<h3 style="margin:18px 0 10px">Requisitos jurídicos</h3>' + jur.map(r => Requisitos.tarjeta(b, r)).join('') : '');
  return { html, acciones:Object.assign({
    'guardar-proponente':async () => {
      const v = UI.leer(campos, document, 'pr');
      if (v.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.correo)) throw new Error('El correo no tiene un formato válido.');
      Object.assign(p, { tipo:v.tipo, representante:v.representante, documentoRepresentante:v.documentoRepresentante, domicilio:v.domicilio, direccion:v.direccion, telefono:v.telefono, correo:v.correo });
      if ((p.tipo === 'consorcio' || p.tipo === 'union') && !(p.integrantes||[]).length) p.integrantes = [{ razonSocial:p.razonSocial, nit:p.nit, porcentaje:'' }];
      S.empresa = empresaPdf(b);
      await Oferta.guardar(); UI.toast('Datos del proponente guardados', 'ok'); App.render();
    },
    'integrante-mas':async () => { p.integrantes = (p.integrantes||[]).concat([{ razonSocial:'', nit:'', porcentaje:'' }]); await Oferta.guardar(); App.render(); },
    'integrante-menos':async el => { p.integrantes.splice(+el.dataset.i, 1); await Oferta.guardar(); App.render(); }
  }, Requisitos.acciones(b, pl)), cambios:Object.assign({
    'integrante':async el => { const x = p.integrantes[+el.dataset.i]; x[el.dataset.c] = el.dataset.c === 'porcentaje' ? Number(el.value || 0) : el.value.trim(); await Oferta.guardar(); if (el.dataset.c === 'porcentaje') App.render(); }
  }, Requisitos.cambios(b, pl)) };
};
/** El proponente es quien firma los PDF de ARKEN OFERTA. */
function empresaPdf(b){
  const p = b.proponente, partes = String(p.nit||'').split('-');
  return { razonSocial:p.razonSocial, nit:Nit.limpiar(partes[0]), dv:partes[1] || '' };
}

/* ─────────────── 02 · Documentos del proceso (lectura) / acuerdo ─────────────── */
Vistas['02'] = function(){
  const b = Oferta.borrador(), pl = Oferta.pl();
  if (pl.etapa === 'confidencialidad'){
    return { html:cabecera('02', 'Acuerdo de confidencialidad', esc(pl.proceso.codigo)) +
      '<div class="nota">El paquete trae el archivo <b>' + esc(pl.acuerdo.nombre) + '</b>. Fírmelo ' + (pl.acuerdo.firma === 'manuscrita' ? 'a mano (y escanéelo)' : 'con firma electrónica o a mano') +
        ' por quien tiene facultades según el certificado de existencia y representación legal, y adjúntelo aquí en PDF.</div>' + Requisitos.tarjetaAcuerdo(b, pl),
      acciones:Requisitos.acciones(b, pl), cambios:Requisitos.cambios(b, pl) };
  }
  const docs = pl.documentos || [];
  const filas = docs.map((d, i) => '<tr><td>' + esc(d.clase) + '</td><td><b>' + esc(d.nombre) + '</b><div class="small muted">' + esc(d.disciplina || '') + ' · versión ' + esc(d.version) + '</div></td>' +
    '<td class="n">' + (d.enlace ? 'enlace' : Util.pesoLegible(d.peso)) + '</td><td><span class="huella">' + esc(d.sha256 || '—') + '</span></td><td class="act">' +
    (d.enlace ? '<span class="small">' + esc(d.enlace) + '</span>' : boton('bajar-doc', 'Descargar', 'xs', ' data-i="' + i + '"')) + '</td></tr>').join('');
  const html = cabecera('02', 'Documentos del proceso', 'Solo lectura · ' + docs.length + ' documento(s) · verificados con su huella al abrir el paquete') +
    '<div class="card"><div class="card-head"><h3>Pliego y acuerdo</h3></div><div class="card-body">' +
      '<p class="small">' + (pl.pliegoPdf ? '<b>' + esc(pl.pliegoPdf.nombre) + '</b> <span class="huella">SHA-256 ' + esc(pl.pliegoPdf.sha256) + '</span>' : '') + '</p>' +
      '<p class="small"><b>' + esc(pl.acuerdo.nombre) + '</b>' + (pl.acuerdo.aprobadoPor ? ' · texto aprobado por ' + esc(pl.acuerdo.aprobadoPor) : '') + '</p>' +
      '<p class="small muted">Están en la carpeta del paquete. Las observaciones a los documentos y a las cantidades se hacen como preguntas (módulo 13).</p></div></div>' +
    '<div class="card"><div class="card-head"><h3>Documentos</h3></div><div class="card-body flush">' + (docs.length ? '<div class="tw"><table class="t"><thead><tr><th>Clase</th><th>Documento</th><th class="n">Peso</th><th>Huella SHA-256</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : UI.vacio('El pliego no trae documentos', '')) + '</div></div>';
  return { html, acciones:{ 'bajar-doc':async el => {
    const d = docs[+el.dataset.i];
    const blob = await AlmacenOferta.leerArchivo(d.sha256);
    if (!blob) throw new Error('El documento no quedó en este equipo. Ábralo desde la carpeta del paquete: ' + d.ruta);
    UI.descargar(d.nombre, blob);
  } } };
};

/* ─────────────── 15 · Ayuda ─────────────── */
Vistas['15'] = function(){
  const pl = Oferta.pl();
  const html = cabecera('15', 'Ayuda', 'ARKEN OFERTA ' + esc(VERSION_PROGRAMA)) + '<div class="card"><div class="card-body" style="line-height:1.7">' +
    '<h3>Cómo se presenta la oferta</h3><ol>' +
    (pl.etapa === 'confidencialidad' ? '<li>Diligencie sus datos (módulo 01).</li><li>Firme el acuerdo de confidencialidad y adjúntelo (módulo 02).</li><li>Genere el sobre de confidencialidad (módulo 14) y envíelo a la EMPRESA PRINCIPAL.</li>'
      : '<li>Diligencie sus datos (01) y lea los documentos del proceso (02).</li><li>Ponga precio a cada actividad, con sus APU donde el pliego los exige (03). Puede descargar la plantilla de precios en Excel o importar el Excel de ARKEN CONTROL.</li>' +
        '<li>Defina el AIU y desglose la administración (04).</li><li>Responda cada requisito y adjunte sus documentos (05 a 12).</li><li>Si tiene dudas, escriba preguntas y genere el archivo de preguntas (13) dentro del plazo.</li>' +
        '<li>En «Revisar y generar sobre» (14) corrija lo que esté en rojo y genere el sobre. Entréguelo antes del cierre: ' + esc(textoCierre(pl)) + '.</li>') + '</ol>' +
    '<h3>Seguridad</h3><ul><li>Su oferta queda en este equipo (IndexedDB), protegida por su usuario local. Para seguir en otro equipo use «Guardar borrador en archivo» y ábralo allí con el mismo paquete.</li>' +
      '<li>' + (pl.proceso.sobreCerrado !== false ? 'El sobre va <b>cerrado</b>: cifrado con la llave del proceso. Nadie, ni siquiera la EMPRESA PRINCIPAL, puede abrirlo antes del cierre.' : 'Este proceso no usa sobre cerrado: el sobre va con huellas pero sin cifrar.') + '</li>' +
      '<li>Puede generar un sobre nuevo antes del cierre: la EMPRESA PRINCIPAL se queda con el último que usted generó antes del cierre.</li>' +
      '<li>El programa no se conecta a internet. Ningún dato sale de su equipo salvo en los archivos que usted genera y envía.</li></ul>' +
    '<h3>Contacto</h3><p>' + esc(pl.empresaPrincipal.razonSocial) + (pl.empresaPrincipal.correo ? ' · ' + esc(pl.empresaPrincipal.correo) : '') + (pl.empresaPrincipal.telefono ? ' · ' + esc(pl.empresaPrincipal.telefono) : '') + '</p></div></div>';
  return { html };
};
