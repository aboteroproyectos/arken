/* ─────────────── 07 · Pliego, revisión y emisión ───────────────
   Cronograma, condiciones generales y método económico, llaves del proceso,
   pliego en PDF y la revisión completa de §12.4. «Emitir» solo se habilita
   con todo en verde, y antes dice con todas sus letras qué va a pasar. */
Vistas['07'] = function(){
  const p = Modelo.activo();
  if (!p) return { html:sinProceso('07', 'Pliego, revisión y emisión') };
  const tab = UI.pestanaActiva('emi', 'revision');
  const rev = Modelo.revision(p), enRojo = rev.filter(x => !x.ok).length;
  const cuerpo = tab === 'cronograma' ? vistaCronograma(p) : tab === 'pliego' ? vistaPliego(p) : tab === 'llaves' ? vistaLlaves(p) : vistaRevision(p, rev);
  const html = cabecera('07', 'Pliego, revisión y emisión', esc(p.codigo) + ' · ' + esc(p.estado) + etiquetaDemo(p) + ' · revisión ' + (rev.length - enRojo) + ' / ' + rev.length) + avisoCongelado(p) +
    UI.pestanas('emi', [['revision','Revisión y emisión'],['cronograma','Cronograma'],['pliego','Pliego'],['llaves','Llaves del proceso']], 'revision') + cuerpo;
  return { html, acciones:Object.assign(accionesCronograma(p), accionesPliego(p), accionesLlaves(p), accionesRevision(p, rev)) };
};

/* ── Cronograma ── */
function vistaCronograma(p){
  const ed = Modelo.editable(p) && Permisos.puede('editarProceso');
  const c = p.cronograma;
  const probl = Cronograma.validar(c);
  const dis = ed ? '' : ' disabled';
  const filas = c.hitos.map((h, k) => '<tr' + (h.activo === false ? ' style="opacity:.55"' : '') + '><td>' + (h.opcional ? '<label class="checkline"><input type="checkbox" data-hito="' + k + '" data-c="activo"' + (h.activo !== false ? ' checked' : '') + dis + ' aria-label="Incluir ' + esc(h.nombre) + '"> ' + esc(h.nombre) + '</label>' : esc(h.nombre)) +
    '</td><td><input type="date" data-hito="' + k + '" data-c="fecha" value="' + esc(h.fecha) + '"' + dis + ' aria-label="Fecha de ' + esc(h.nombre) + '"></td><td><input type="time" data-hito="' + k + '" data-c="hora" value="' + esc(h.hora) + '"' + dis + ' aria-label="Hora de ' + esc(h.nombre) + '"></td>' +
    '<td class="small">' + (h.fecha ? Util.fmtFechaLarga(h.fecha) + (Festivos.esHabil(h.fecha) ? '' : ' ' + UI.tag(Festivos.esFestivo(h.fecha) ? 'festivo' : 'no hábil', 'warn')) : '') + '</td></tr>').join('');
  return '<div class="card"><div class="card-head"><h3>Cronograma del proceso</h3><div class="btn-row">' + (ed ? boton('proponer-cronograma', 'Proponer fechas', 'sm') + boton('guardar-cronograma', 'Guardar cronograma', 'sm primary') : '') + '</div></div><div class="card-body">' +
    '<div class="form" style="margin-bottom:12px">' + UI.campo({ k:'habiles', lab:'Contar los plazos en días hábiles de Colombia (con festivos)', tipo:'check', val:c.habiles, deshabilitado:!ed }, 'cr') +
      UI.campo({ k:'minHabiles', lab:'Mínimo de días hábiles entre el plazo de adendas y el cierre', tipo:'number', val:c.minHabilesAdendasCierre, deshabilitado:!ed }, 'cr') + '</div>' +
    '<div class="tw"><table class="t"><thead><tr><th>Hito</th><th>Fecha</th><th>Hora</th><th></th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
    '<p class="small muted" style="margin-top:8px">Hora de Colombia (UTC−05:00, sin horario de verano). El cierre es la hora límite de entrega de las ofertas: el programa no abre ningún sobre antes.</p>' +
    (probl.length ? '<div class="nota ' + (probl.some(x => !x.aviso) ? 'bad' : 'warn') + '"><ul>' + probl.map(x => '<li>' + esc(x.msg) + (x.aviso ? ' (aviso)' : '') + '</li>').join('') + '</ul></div>' : '<div class="nota ok">El cronograma está completo y en orden.</div>') +
  '</div></div>';
}
function leerCronograma(p){
  const c = Util.copia(p.cronograma);
  c.habiles = $('#cr_habiles').checked;
  c.minHabilesAdendasCierre = Number($('#cr_minHabiles').value || 0);
  $$('[data-hito]').forEach(el => { const h = c.hitos[+el.dataset.hito]; if (el.dataset.c === 'activo') h.activo = el.checked; else h[el.dataset.c] = el.value; });
  return c;
}
function accionesCronograma(p){
  return {
    'guardar-cronograma':async () => {
      Modelo.exigirEditable(p);
      p.cronograma = leerCronograma(p);
      if (p.pliego) p.pliego.revisado = false;
      await Modelo.guardarProceso(p, 'Cronograma');
      UI.toast('Cronograma guardado', 'ok'); App.render();
    },
    'proponer-cronograma':async () => {
      const c = leerCronograma(p);
      const em = Cronograma.hito(c, 'emision');
      const v = await UI.pedir({ titulo:'Proponer fechas', ancho:'', textoAceptar:'Proponer',
        antes:'<p>A partir de la fecha de emisión, el programa propone las demás con los plazos usuales (preguntas a los 5 días, cierre a los 15, adjudicación a los 28), en días ' + (c.habiles ? 'hábiles' : 'calendario') + '. Usted las ajusta y guarda.</p>',
        campos:[{ k:'fecha', lab:'Fecha de emisión', tipo:'date', val:em.fecha || Festivos.sumarDias(Util.hoyISO(), 1, true), c2:true }], validar:z => !z.fecha ? 'Elija la fecha de emisión.' : '' });
      if (!v) return;
      Modelo.exigirEditable(p);
      p.cronograma = Cronograma.proponer(c, v.fecha);
      if (p.pliego) p.pliego.revisado = false;
      await Modelo.guardarProceso(p, 'Cronograma propuesto desde ' + v.fecha); App.render();
    }
  };
}

/* ── Pliego: condiciones generales y método económico ── */
const CAMPOS_GENERAL = (g) => [
  { k:'alcance', lab:'Alcance del contrato', tipo:'textarea', filas:3, val:g.alcance, c2:true },
  { k:'formaPago', lab:'Forma de pago', tipo:'textarea', filas:2, val:g.formaPago, c2:true },
  { k:'anticipoPct', lab:'Anticipo (%)', tipo:'number', val:g.anticipoPct }, { k:'retenidoPct', lab:'Retención de garantía (%)', tipo:'number', val:g.retenidoPct },
  { k:'polizasOferta', lab:'Garantías de la oferta', val:g.polizasOferta, c2:true },
  { k:'polizasContrato', lab:'Garantías del contrato', tipo:'textarea', filas:2, val:g.polizasContrato, c2:true },
  { k:'regimen', lab:'Régimen jurídico', val:g.regimen, c2:true },
  { k:'consorcios', lab:'Se admiten consorcios y uniones temporales', tipo:'check', val:g.consorcios, c2:true },
  { k:'causalesRechazo', lab:'Causales de rechazo, una por renglón', tipo:'textarea', filas:5, val:(g.causalesRechazo||[]).join('\n'), c2:true },
  { k:'reglasSubsanacion', lab:'Reglas de subsanación', tipo:'textarea', filas:3, val:g.reglasSubsanacion, c2:true },
  { k:'reglasEmpate', lab:'Criterios de desempate, en orden, uno por renglón', tipo:'textarea', filas:3, val:(g.reglasEmpate||[]).join('\n'), c2:true },
  { k:'metodoEconomico', lab:'Método de evaluación económica', tipo:'select', val:g.metodoEconomico, c2:true, opts:Object.keys(Pliego.METODOS).map(k => ({ v:k, n:Pliego.METODOS[k].nombre })) },
  { k:'kBajo', lab:'Cercanía: k por debajo de la base', tipo:'number', val:g.kBajo }, { k:'kAlto', lab:'Cercanía: k por encima de la base', tipo:'number', val:g.kAlto },
  { k:'umbralBajoPct', lab:'Umbral de valor artificialmente bajo (% por debajo de la base)', tipo:'number', val:g.umbralBajoPct },
  { k:'rechazarSobrePresupuesto', lab:'Se rechazan las ofertas por encima del presupuesto oficial', tipo:'check', val:g.rechazarSobrePresupuesto },
  { k:'reglaCorreccion', lab:'Regla de corrección aritmética', val:g.reglaCorreccion, c2:true },
  { k:'versionDocumentoTipo', lab:'Versión del documento tipo de Colombia Compra Eficiente que se cita', val:g.versionDocumentoTipo, c2:true }
];
function vistaPliego(p){
  const ed = Modelo.editable(p) && Permisos.puede('editarProceso');
  const g = p.general;
  const gen = p.pliego && p.pliego.generado;
  const vigente = Modelo.pliegoVigente(p);
  const estado = !gen ? '<div class="nota warn">El pliego aún no se ha generado.</div>'
    : vigente ? '<div class="nota ok">Pliego generado el ' + Util.fmtSello(gen.fecha) + ' por ' + esc(gen.usuario) + ' · ' + gen.paginas + ' páginas. <span class="huella">SHA-256 del PDF: ' + esc(gen.sha256) + '</span></div>'
    : '<div class="nota bad">El contenido del proceso cambió después de generar el pliego (' + Util.fmtSello(gen.fecha) + '). Genérelo de nuevo y revíselo.</div>';
  return '<div class="grid g2"><div class="card"><div class="card-head"><h3>Condiciones generales del pliego</h3>' + (ed ? boton('guardar-general', 'Guardar', 'sm primary') : '') + '</div><div class="card-body">' +
      UI.formulario(CAMPOS_GENERAL(g).map(c => Object.assign(c, { deshabilitado:!ed })), 'gn') +
      '<div class="nota" style="margin-top:12px"><b>' + esc((Pliego.METODOS[g.metodoEconomico]||Pliego.METODOS.menor).nombre) + ':</b> ' + esc(Pliego.formula(g)) + '</div>' +
      '<p class="small muted">Las fórmulas se escribieron siguiendo los documentos tipo de Colombia Compra Eficiente para obra pública; contrástelas con la versión vigente antes de emitir.</p>' +
    '</div></div><div class="card"><div class="card-head"><h3>Pliego en PDF</h3></div><div class="card-body">' + estado +
      '<p class="small">Contenido, en el orden de §12.1: portada, índice, información general, objeto y alcance, cronograma, condiciones de participación, documentos del proceso con sus huellas, condiciones de la oferta, método de evaluación económica, formulario de cantidades <b>sin precios</b>' +
        (p.presupuestoOficialVisible ? ' (con el valor total del presupuesto oficial, porque el proceso lo hace visible)' : '') + ', confidencialidad, causales de rechazo, desempate, garantías e instrucciones para ARKEN OFERTA.</p>' +
      '<div class="btn-row">' + (Permisos.puede('generarPliego') && Modelo.editable(p) ? boton('generar-pliego', gen ? 'Generar de nuevo' : 'Generar pliego', 'primary') : '') + '</div>' +
      (gen && vigente && Modelo.editable(p) ? '<label class="checkline" style="margin-top:14px"><input type="checkbox" data-accion="marcar-revisado"' + (p.pliego.revisado ? ' checked' : '') + '> Revisé el pliego completo y lo apruebo para emitir (' + esc(p.responsable || 'responsable') + ')</label>' : '') +
    '</div></div></div>';
}
function accionesPliego(p){
  return {
    'guardar-general':async () => {
      const v = UI.leer(CAMPOS_GENERAL(p.general), document, 'gn');
      ['anticipoPct','retenidoPct','kBajo','kAlto','umbralBajoPct'].forEach(k => { if (!(Number(v[k]) >= 0)) throw new Error('Revise el valor de «' + CAMPOS_GENERAL(p.general).find(c => c.k === k).lab + '».'); });
      Modelo.exigirEditable(p);
      Object.assign(p.general, v, { anticipoPct:Number(v.anticipoPct), retenidoPct:Number(v.retenidoPct), kBajo:Number(v.kBajo), kAlto:Number(v.kAlto), umbralBajoPct:Number(v.umbralBajoPct),
        causalesRechazo:String(v.causalesRechazo).split('\n').map(s => s.trim()).filter(Boolean), reglasEmpate:String(v.reglasEmpate).split('\n').map(s => s.trim()).filter(Boolean) });
      if (p.pliego) p.pliego.revisado = false;
      await Modelo.guardarProceso(p, 'Condiciones generales del pliego'); UI.toast('Condiciones generales guardadas', 'ok'); App.render();
    },
    'generar-pliego':async () => { UI.toast('Generando el pliego…'); await Documentos.pdfPliego(p); UI.toast('Pliego generado. Revíselo y márquelo como revisado.', 'ok'); App.render(); },
    'marcar-revisado':async b => {
      Modelo.exigirEditable(p);
      if (b.checked && !Modelo.pliegoVigente(p)) throw new Error('El pliego no está vigente: genérelo de nuevo.');
      p.pliego.revisado = b.checked;
      await Modelo.guardarProceso(p, b.checked ? 'Pliego revisado · ' + p.pliego.generado.sha256 : 'Pliego sin revisar'); App.render();
    }
  };
}

/* ── Llaves del proceso ── */
function vistaLlaves(p){
  const ll = Modelo.llaves(p.id);
  const puede = Permisos.puede('crearLlaves');
  if (!ll){
    return '<div class="card"><div class="card-head"><h3>Crear las llaves del proceso</h3></div><div class="card-body">' +
      '<p>El programa crea dos pares de llaves con WebCrypto: <b>firma</b> (ECDSA P-384) para firmar el pliego y las adendas, y <b>cifrado</b> (ECDH P-384) para el sobre cerrado. Las privadas se guardan cifradas (AES-GCM de 256 bits) con una llave derivada de la <b>frase del proceso</b> (PBKDF2-SHA-256, 600.000 iteraciones).</p>' +
      '<div class="nota warn">La frase solo la deben conocer los miembros del comité. El programa no la guarda: si se olvida, las ofertas de este proceso no se podrán abrir.</div>' +
      (puede && Modelo.editable(p) ? '<div class="form">' + UI.campo({ k:'frase', lab:'Frase del proceso (16 caracteres y tres palabras como mínimo)', tipo:'password', c2:true }, 'll') +
        UI.campo({ k:'frase2', lab:'Repita la frase', tipo:'password', c2:true }, 'll') + '</div><div class="btn-row" style="margin-top:12px">' + boton('crear-llaves', 'Crear llaves', 'primary') + '</div>'
        : '<p class="small muted">Pueden crear las llaves: ' + esc(Roles.quienPuede('crearLlaves').join(', ')) + '.</p>') + '</div></div>';
  }
  const r = ll.respaldo || {};
  return '<div class="card"><div class="card-head"><h3>Llaves del proceso</h3>' + UI.tag('creadas', 'ok') + '</div><div class="card-body">' +
    '<p class="small">Creadas el ' + Util.fmtSello(ll.creado) + '. <span class="huella">Huella de las llaves públicas: ' + esc(ll.huellaPublicas) + '</span></p>' +
    '<div class="nota bad"><b>Si se pierden la llave y su respaldo, ninguna oferta de este proceso se podrá abrir.</b> Descargue el respaldo y guárdelo en un lugar distinto de este computador (otra unidad, la nube de la empresa, una caja fuerte).</div>' +
    itemChk(r.descargado, 'Respaldo descargado' + (r.descargadoEn ? ' el ' + Util.fmtSello(r.descargadoEn) : '')) +
    itemChk(r.confirmado, 'Guardado fuera de este computador' + (r.confirmadoEn ? ' (confirmado el ' + Util.fmtSello(r.confirmadoEn) + ')' : '')) +
    '<div class="btn-row" style="margin-top:12px">' + (puede ? boton('bajar-llaves', 'Descargar respaldo de llaves', 'brass') : '') +
      (puede && r.descargado && !r.confirmado ? boton('confirmar-llaves', 'Confirmo que lo guardé fuera de este computador') : '') + boton('probar-frase', 'Probar la frase') + '</div>' +
    '<p class="small muted" style="margin-top:10px">El respaldo es un archivo ARKEN-LLAVES: las llaves privadas van cifradas con la frase. Sin la frase, el archivo no abre nada.</p></div></div>';
}
function accionesLlaves(p){
  return {
    'crear-llaves':async () => {
      const f = $('#ll_frase').value, f2 = $('#ll_frase2').value;
      const err = Cripto.fraseValida(f); if (err) throw new Error(err);
      if (f !== f2) throw new Error('Las dos frases no coinciden.');
      UI.toast('Creando las llaves…');
      await Modelo.crearLlaves(p, f);
      UI.toast('Llaves creadas. Descargue ahora su respaldo.', 'ok'); App.render();
    },
    'bajar-llaves':async () => {
      Permisos.exigir('crearLlaves');
      UI.descargar('ARKEN_ANALYTICA_' + Util.codigoArchivo(p.codigo) + '_respaldo_llaves.json', Cripto.respaldoLlaves(Modelo.llaves(p.id)), 'application/json');
      await Modelo.marcarRespaldoLlaves(p, 'descargado'); App.render();
    },
    'confirmar-llaves':async () => {
      if (!(await UI.confirmar({ titulo:'Respaldo de llaves', mensaje:'Confirme que guardó el archivo de respaldo en un lugar distinto de este computador. Si se pierden la llave y su respaldo, ninguna oferta de este proceso se podrá abrir.', textoAceptar:'Lo guardé fuera de este computador' }))) return;
      await Modelo.marcarRespaldoLlaves(p, 'confirmado'); App.render();
    },
    'probar-frase':async () => {
      const v = await UI.pedir({ titulo:'Probar la frase del proceso', ancho:'', textoAceptar:'Probar', campos:[{ k:'frase', lab:'Frase del proceso', tipo:'password', c2:true }] });
      if (!v) return;
      const ok = await Cripto.verificarFrase(Modelo.llaves(p.id), v.frase);
      UI.toast(ok ? 'La frase es correcta: abre las llaves del proceso.' : 'La frase no abre las llaves de este proceso.', ok ? 'ok' : 'bad');
    }
  };
}

/* ── Revisión antes de emitir ── */
/** Un punto de la lista: ícono, texto (ya escapado) y acciones o detalle. */
function itemChk(ok, textoHtml, extra){
  return '<div class="chk ' + (ok ? 'ok' : 'no') + '"><span class="ic" aria-hidden="true">' + (ok ? '✓' : '✕') + '</span><div class="tx"><b>' + (ok ? 'Listo' : 'Pendiente') + ':</b> ' + textoHtml + (extra ? '<div>' + extra + '</div>' : '') + '</div></div>';
}
function pestanaDeRevision(x){
  if (x.modulo === '07') return ' data-pestana-ir="' + (/llave/i.test(x.texto) ? 'llaves' : /cronograma/i.test(x.texto) ? 'cronograma' : 'pliego') + '"';
  if (x.modulo === '06') return ' data-pestana-ir="' + (/acuerdo/i.test(x.texto) ? 'acuerdo' : 'invitados') + '"';
  return '';
}
function vistaRevision(p, rev){
  const grupos = [];
  rev.forEach(x => { if (grupos.indexOf(x.grupo) < 0) grupos.push(x.grupo); });
  const listo = Revision.listo(rev);
  if (!Modelo.editable(p)){
    const e = p.emitido || {};
    return '<div class="nota ok"><b>Proceso emitido</b> el ' + Util.fmtSello(e.fecha) + ' por ' + esc(e.usuario) + ', versión ' + e.version + ' del pliego. <span class="huella">Pliego SHA-256 ' + esc(e.huellaPliego) + '</span></div>' +
      '<p>El presupuesto base y las condiciones quedaron congelados. Lo que sigue (paquetes por invitado, preguntas, adendas y recepción de ofertas) llega en la Fase 2.</p>';
  }
  return '<div class="card"><div class="card-head"><h3>Revisión antes de emitir</h3>' + UI.tag(listo ? 'todo en verde' : rev.filter(x => !x.ok).length + ' en rojo', listo ? 'ok' : 'bad') + '</div><div class="card-body">' +
    grupos.map(g => '<div class="chk-grupo">' + esc(g) + '</div>' + rev.filter(x => x.grupo === g).map(x => itemChk(x.ok, esc(x.texto),
      (x.ok ? '' : boton('ir-modulo', 'Ir al módulo ' + x.modulo, 'xs ghost', ' data-modulo="' + x.modulo + '"' + pestanaDeRevision(x))) +
      (!x.ok && x.detalle.length ? '<ul>' + x.detalle.slice(0, 6).map(d => '<li>' + esc(d) + '</li>').join('') + (x.detalle.length > 6 ? '<li>y ' + (x.detalle.length - 6) + ' más</li>' : '') + '</ul>' : ''))).join('')).join('') +
    '<div class="btn-row" style="margin-top:18px">' + (Permisos.puede('emitir') ? '<button class="btn primary" type="button" data-accion="emitir"' + (listo ? '' : ' disabled title="Hay puntos en rojo"') + '>Emitir el proceso</button>' : '') + '</div>' +
    (listo ? '' : '<p class="small muted">«Emitir» se habilita cuando todos los puntos estén en verde. Entre ellos: el acuerdo de confidencialidad aprobado por abogado y el respaldo de llaves descargado y guardado.</p>') +
  '</div></div>';
}
function accionesRevision(p, rev){
  return {
    'ir-modulo':b => { const clave = b.dataset.modulo === '07' ? 'emi' : b.dataset.modulo === '06' ? 'inv' : null; if (clave && b.dataset.pestanaIr) Sesion.pestanas[clave] = b.dataset.pestanaIr; App.ir(b.dataset.modulo); },
    'emitir':async () => {
      if (!Revision.listo(Modelo.revision(p))) throw new Error('Hay puntos de la revisión en rojo.');
      const ok = await UI.confirmar({ titulo:'Emitir el proceso ' + p.codigo, eyebrow:'Acción que no se puede deshacer', palabra:'EMITIR', textoAceptar:'Emitir', claseAceptar:'danger',
        cuerpo:'<p>Al emitir:</p><ul><li>El presupuesto base, las condiciones de la oferta y el pliego de la versión ' + p.versionPliego + ' quedan <b>congelados</b>: no se pueden editar.</li>' +
          '<li>Cualquier cambio posterior se hace con una adenda numerada (módulo 08, Fase 2).</li><li>Queda registrado en la auditoría con la huella del pliego.</li></ul>' });
      if (!ok) return;
      await Modelo.emitir(p); UI.toast('Proceso ' + p.codigo + ' emitido', 'ok'); App.render();
    }
  };
}
