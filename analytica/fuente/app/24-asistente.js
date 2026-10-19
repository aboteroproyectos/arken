/* ══════════════════════════════════════════════════════════════════════════
   ASISTENTE DE IA (§18.13) — opcional, con la clave de API del usuario.
   Sigue el patrón del Investigador IA de ARKEN PRECIOS: el SDK oficial
   (@anthropic-ai/sdk) va dentro del archivo, en el bloque
   «arken-analytica-sdk»; la clave se guarda cifrada en este equipo (por el
   sistema operativo en la app de escritorio, con AES-GCM y una llave no
   exportable en el navegador) y nunca entra en el HTML, en los respaldos, en
   los paquetes ni en los sobres.

   Lo que arma las solicitudes y revisa las respuestas está en
   fuente/evaluacion/95-asistente.js (AsistenteIA). Aquí: la bóveda, la
   clave, el cliente, el aviso con el costo estimado, el tope del mes y las
   pantallas. La IA no escribe un «cumple» ni un puntaje: en la verificación
   solo llena la evidencia cuando el evaluador lo pide, y lo que redacta queda
   marcado hasta que una persona lo acepta.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Bóveda de secretos de este equipo ── */
const Boveda = (function(){
  let cifraEscritorio = null;
  function escritorio(){ const e = window.arkenAnalytica; return e && e.secretos ? e.secretos : null; }
  async function revisar(){
    const E = escritorio();
    if (!E) return;
    try { cifraEscritorio = !!(await E.disponible()); } catch(e){ cifraEscritorio = false; RegistroTecnico.anotar('cifrado del equipo', e); }
  }
  function disponible(){ return escritorio() ? cifraEscritorio !== false : !!(window.crypto && crypto.subtle) && Almacen.hayBoveda(); }
  function sinCifrado(){ return escritorio() ? 'El sistema operativo de este equipo no ofrece cifrado (en Linux hace falta el llavero del escritorio)' : 'Este navegador no deja guardar cifrado (la base está en memoria)'; }
  async function llave(id){
    const r = await Almacen.secreto(id);
    if (r && r.llave) return r.llave;
    const k = await crypto.subtle.generateKey({ name:'AES-GCM', length:256 }, false, ['encrypt', 'decrypt']);
    await Almacen.ponerSecreto({ id, llave:k, creada:new Date().toISOString() });
    return k;
  }
  async function guardar(id, idLlave, valor, meta){
    const E = escritorio();
    if (E){
      if (!(await E.disponible())) throw new Error('El sistema operativo de este equipo no ofrece cifrado para guardarla. Úsela solo en esta sesión.');
      return E.guardar(id, String(valor), Object.assign({}, meta));
    }
    const k = await llave(idLlave);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const datos = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, k, new TextEncoder().encode(String(valor)));
    await Almacen.ponerSecreto(Object.assign({}, meta, { id, iv, datos }));
  }
  async function info(id){
    const E = escritorio();
    if (E) return (await E.info(id)) || null;
    const r = await Almacen.secreto(id);
    if (!r || !r.datos) return null;
    const m = Object.assign({}, r); delete m.datos; delete m.iv; delete m.id;
    return m;
  }
  async function leer(id, idLlave){
    const E = escritorio();
    if (E) return (await E.leer(id)) || null;
    const r = await Almacen.secreto(id), l = await Almacen.secreto(idLlave);
    if (!r || !r.datos || !l || !l.llave) return null;
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name:'AES-GCM', iv:r.iv }, l.llave, r.datos));
  }
  async function borrar(id, idLlave){
    const E = escritorio();
    if (E){ try { await E.borrar(id); } catch(e){ RegistroTecnico.anotar('borrar un secreto', e); } }
    await Almacen.borrarSecreto(id); if (idLlave) await Almacen.borrarSecreto(idLlave);
  }
  return { escritorio, revisar, disponible, sinCifrado, guardar, info, leer, borrar };
})();

/* ── Clave de API: cifrada en este equipo, o solo durante la sesión ── */
const ClaveIA = (function(){
  const RE = /^sk-ant-[A-Za-z0-9_-]{20,}$/;
  const ID_LLAVE = 'llave-equipo', ID_CLAVE = 'clave-ia';
  let enSesion = null, descifrada = null, info = null;
  async function iniciar(){
    info = null;
    await Boveda.revisar();
    try { const m = await Boveda.info(ID_CLAVE); if (m) info = { final:m.final || '', guardada:m.guardada || '', usuario:m.usuario || '' }; }
    catch(e){ RegistroTecnico.anotar('leer la clave de API guardada', e); }
  }
  function hay(){ return !!(enSesion || info); }
  function estado(){
    if (enSesion) return { donde:'sesión', final:enSesion.slice(-4) };
    if (info) return { donde:'equipo', final:info.final, guardada:info.guardada, usuario:info.usuario, escritorio:!!Boveda.escritorio() };
    return { donde:'ninguna' };
  }
  function formatoValido(k){ return RE.test(String(k || '').trim()); }
  async function guardar(clave, recordar){
    const k = String(clave || '').trim();
    if (!formatoValido(k)) throw new Error('Eso no tiene la forma de una clave de API de Anthropic: empieza por «sk-ant-».');
    if (recordar){
      if (!Boveda.disponible()) throw new Error(Boveda.sinCifrado() + ': use la clave solo en esta sesión.');
      const meta = { final:k.slice(-4), guardada:new Date().toISOString(), usuario:Sesion.usuario ? Sesion.usuario.usuario : '' };
      await Boveda.guardar(ID_CLAVE, ID_LLAVE, k, meta);
      info = meta; enSesion = null; descifrada = k;
    } else { enSesion = k; descifrada = null; }
  }
  async function obtener(){
    if (enSesion) return enSesion;
    if (descifrada) return descifrada;
    if (!info) return null;
    try { descifrada = await Boveda.leer(ID_CLAVE, ID_LLAVE); return descifrada; }
    catch(e){ RegistroTecnico.anotar('descifrar la clave de API', e); throw new Error('No se pudo descifrar la clave guardada en este equipo. Bórrela y escríbala de nuevo.'); }
  }
  async function borrar(){ enSesion = null; descifrada = null; info = null; await Boveda.borrar(ID_CLAVE, ID_LLAVE); }
  function olvidarSesion(){ enSesion = null; descifrada = null; }
  return { iniciar, hay, estado, formatoValido, guardar, obtener, borrar, olvidarSesion };
})();

/* ── Cliente de la API: el SDK oficial, con dos reintentos ante errores pasajeros ── */
const ClienteIA = (function(){
  let cliente = null, conClave = null;
  function sdk(){ if (typeof AnthropicSDK === 'undefined' || !AnthropicSDK.Anthropic) throw new Error('El SDK de Anthropic no está dentro de este archivo.'); return AnthropicSDK; }
  async function obtener(){
    const k = await ClaveIA.obtener();
    if (!k) throw new Error('No hay clave de API: escríbala en el módulo 16 › Asistente de IA.');
    if (!cliente || conClave !== k){ cliente = new (sdk().Anthropic)({ apiKey:k, dangerouslyAllowBrowser:true, maxRetries:2, timeout:5 * 60 * 1000 }); conClave = k; }
    return cliente;
  }
  async function llamar(cuerpo){ return (await obtener()).messages.create(cuerpo); }
  async function probar(modelo){ const m = await (await obtener()).models.retrieve(modelo); return { id:m.id, nombre:m.display_name || m.id }; }
  function sinClaves(t){ return String(t || '').replace(/sk-ant-[A-Za-z0-9_-]+/g, 'sk-ant-…'); }
  /** El error en español, con el paso siguiente. */
  function explicar(e){
    const S = typeof AnthropicSDK !== 'undefined' ? AnthropicSDK : {};
    const es = C => !!C && e instanceof C, st = e && e.status, msj = sinClaves((e && e.message) || e).replace(/\s+/g, ' ').slice(0, 300);
    if (es(S.AuthenticationError) || st === 401) return 'La clave de API no es válida o fue revocada.';
    if (es(S.PermissionDeniedError) || st === 403) return 'La clave no tiene permiso para esta solicitud (el modelo puede estar desactivado para su organización).';
    if (es(S.NotFoundError) || st === 404) return 'El modelo elegido no existe o su clave no tiene acceso a él. Elija otro.';
    if (es(S.RateLimitError) || st === 429) return 'Su cuenta llegó al límite de solicitudes por minuto. Intente en un momento.';
    if (st === 413) return 'El documento es demasiado grande para enviarlo a la API.';
    if (es(S.BadRequestError) || st === 400) return /credit balance|billing/i.test(msj) ? 'La cuenta de la clave no tiene saldo.' : 'La API rechazó la solicitud: ' + msj;
    if (es(S.APIConnectionError)) return 'No hay conexión con la API de Claude. Revise internet o si un cortafuegos bloquea api.anthropic.com.';
    if (st >= 500) return 'El servicio de Claude falló o está saturado. Intente más tarde.';
    return msj || 'Error desconocido.';
  }
  function olvidar(){ cliente = null; conClave = null; ClaveIA.olvidarSesion(); }
  return { llamar, probar, explicar, olvidar };
})();

/* ── El asistente: aviso, costo, tope, ejecución y registro ── */
const Asistente = (function(){
  function cfg(){ return AsistenteIA.configuracion((S.config || {}).asistente); }
  async function guardarCfg(c){ Permisos.exigir('configurarAsistente'); await Almacen.guardarConfig(Object.assign({}, S.config, { asistente:Object.assign(cfg(), c) })); await Auditoria.registrar('configurar', 'asistente de IA', JSON.stringify(Object.assign(cfg(), c))); }
  function apagado(p){ return !!(p && p.evaluacion && p.evaluacion.asistenteApagado); }
  /** Encendido, con clave, no apagado en el proceso y con permiso. */
  function activo(p){ return !!cfg().activo && ClaveIA.hay() && !apagado(p) && Permisos.puede('usarAsistente'); }
  function porQueNo(p){
    if (!cfg().activo) return 'El asistente está apagado. Lo enciende el administrador aquí abajo.';
    if (!ClaveIA.hay()) return 'Falta la clave de API.';
    if (apagado(p)) return 'El asistente está apagado para este proceso.';
    if (!Permisos.puede('usarAsistente')) return 'Su usuario no puede usar el asistente.';
    return '';
  }
  async function apagarEnProceso(p, apagar){
    Permisos.exigir('configurarAsistente');
    await Evaluacion.guardarEvaluacion(p, e => { e.asistenteApagado = !!apagar; }, 'configurar', 'Asistente de IA ' + (apagar ? 'apagado' : 'encendido') + ' en el proceso');
  }
  function uso(){ return (S.usoIA || []).slice().sort((a, b) => a.fecha < b.fecha ? 1 : -1); }
  function gastado(){ return AsistenteIA.gastoMes(S.usoIA, new Date().toISOString()); }

  /** Aviso antes de cada uso: lo que sale hacia Anthropic, el costo estimado y el tope. */
  async function confirmar(qué, est){
    const c = cfg(), g = gastado();
    const no = AsistenteIA.impedimento(c, g, est.usd);
    if (no) throw new Error(no + ' Súbalo en el módulo 16 › Asistente de IA o espere al mes siguiente.');
    return UI.confirmar({ titulo:'Usar el asistente de IA', textoAceptar:'Enviar a la API',
      cuerpo:'<p>' + qué + ' sale hacia la API de Anthropic para que el modelo ' + esc(AsistenteIA.perfil(c.modelo).nombre) + ' lo lea. El acuerdo de confidencialidad y el pliego dicen que la empresa puede usar herramientas de análisis con encargados del tratamiento.</p>' +
        '<div class="grid g3"><div class="stat"><div class="lab">Costo estimado</div><div class="val">' + AsistenteIA.usd(est.usd) + '</div><div class="foot">Por lo alto: ~' + cant(est.entrada) + ' tokens de entrada</div></div>' +
        '<div class="stat"><div class="lab">Gastado este mes</div><div class="val">' + AsistenteIA.usd(g) + '</div></div><div class="stat"><div class="lab">Tope del mes</div><div class="val">' + AsistenteIA.usd(c.topeMensualUsd) + '</div></div></div>' +
        '<p class="small muted">La IA no decide si un proponente cumple ni asigna puntajes. Lo que devuelve se comprueba contra el documento y queda para que usted lo confirme.</p>' });
  }
  async function registrarUso(p, tipo, msg, detalle){
    const c = cfg(), u = (msg && msg.usage) || {};
    const reg = { id:Util.uid('ia'), fecha:new Date().toISOString(), usuario:Sesion.usuario ? Sesion.usuario.usuario : '', procesoId:p.id, tipo, modelo:(msg && msg.model) || c.modelo,
      usd:Util.redondearDec(AsistenteIA.costo(u, c.modelo), 6), entrada:u.input_tokens || 0, salida:u.output_tokens || 0, demo:!!p.demo };
    await Almacen.poner('usoIA', reg);
    await Auditoria.registrar('usar', 'asistente de IA', tipo + ' · ' + detalle + ' · ' + AsistenteIA.usd(reg.usd), p.id);
    return reg;
  }
  function base64(blob){ return new Promise((res, rej) => { const f = new FileReader(); f.onload = () => res(String(f.result).split(',')[1] || ''); f.onerror = () => rej(f.error); f.readAsDataURL(blob); }); }

  /** Lee un documento: devuelve los datos ya comprobados contra su texto y guarda la lectura. */
  async function leer(p, o, r, doc, campos, otro){
    Permisos.exigir('usarAsistente');
    if (!activo(p)) throw new Error(porQueNo(p));
    if (Archivos.extension(doc.nombre) !== 'pdf') throw new Error('El asistente lee documentos PDF.');
    const blob = await Almacen.leerArchivo(doc.sha256);
    if (!blob) throw new Error('El archivo no está en este equipo.');
    const paginas = await TextoPdf.paginas(doc.sha256);
    if (!paginas.length) throw new Error('No se pudo sacar el texto del PDF: sin ese texto no hay contra qué comprobar lo que lea la IA.');
    if (!paginas.join('').trim()) throw new Error('El PDF no tiene texto (es una imagen escaneada): no hay contra qué comprobar lo que lea la IA.');
    const est = AsistenteIA.estimar(cfg(), { paginas:paginas.length, salida:400 * Math.max(1, campos.length) });
    if (!(await confirmar('El documento «' + esc(doc.nombre) + '» (' + paginas.length + ' página(s)) de ' + esc(o.nombre), est))) return null;
    let msg;
    try { msg = await ClienteIA.llamar(AsistenteIA.solicitudLectura(cfg(), { nombre:doc.nombre, base64:await base64(blob), paginas:paginas.length }, campos, otro)); }
    catch(e){ throw new Error(ClienteIA.explicar(e)); }
    const datos = AsistenteIA.validarLectura(AsistenteIA.datosDe(msg), paginas);
    await registrarUso(p, 'lectura', msg, r.codigo + ' · ' + o.nombre + ' · ' + doc.nombre + ' · ' + datos.filter(d => d.aceptado).length + ' de ' + datos.length + ' dato(s) comprobados');
    const lec = { id:Util.uid('lec'), procesoId:p.id, ofertaId:o.id, requisito:r.codigo, docId:doc.id, sha256:doc.sha256, documento:doc.nombre, fecha:new Date().toISOString(),
      usuario:Sesion.usuario ? Sesion.usuario.usuario : '', modelo:cfg().modelo, datos, demo:!!p.demo };
    await Almacen.poner('lecturasIA', lec);
    return lec;
  }
  /** Dentro de la verificación: elegir documento y datos, leer y usar un dato comprobado como evidencia. */
  async function leerEnVerificacion(p, o, r, docs, el){
    const caja = $('#vrIA', el);
    const pdfs = docs.filter(d => Archivos.extension(d.nombre) === 'pdf');
    if (!pdfs.length) { caja.innerHTML = '<div class="nota warn">Este requisito no tiene documentos PDF.</div>'; return; }
    const sugeridos = new Set(AsistenteIA.camposDe(r.grupo));
    caja.innerHTML = '<div class="card" style="margin-top:8px"><div class="card-body small"><div class="row" style="gap:8px;flex-wrap:wrap;align-items:center"><label>Documento <select id="iaDoc">' + pdfs.map(d => '<option value="' + d.id + '">' + esc(d.nombre) + '</option>').join('') + '</select></label></div>' +
      '<div class="row" style="gap:6px;flex-wrap:wrap;margin:6px 0">' + AsistenteIA.CAMPOS.map(c => '<label class="checkline small"><input type="checkbox" data-iacampo="' + c.k + '"' + (sugeridos.has(c.k) ? ' checked' : '') + '> ' + esc(c.nombre) + '</label>').join('') + '</div>' +
      '<input id="iaOtro" placeholder="Si marcó «Otro dato», escriba cuál" style="max-width:420px"> <button class="btn sm primary" type="button" id="iaLeer">Leer</button><div id="iaRes"></div></div></div>';
    $('#iaLeer', caja).onclick = async () => {
      const doc = pdfs.find(d => d.id === $('#iaDoc', caja).value);
      const campos = $$('[data-iacampo]', caja).filter(x => x.checked).map(x => x.dataset.iacampo);
      if (!campos.length) return UI.toast('Marque al menos un dato.', 'bad');
      const b = $('#iaLeer', caja); b.disabled = true; b.textContent = 'Leyendo…';
      try {
        const lec = await leer(p, o, r, doc, campos, $('#iaOtro', caja).value.trim());
        if (lec) pintarLectura($('#iaRes', caja), lec, el);
      } catch(e){ UI.error(e, 'asistente de IA'); }
      finally { b.disabled = false; b.textContent = 'Leer'; }
    };
  }
  function pintarLectura(caja, lec, el){
    caja.innerHTML = lec.datos.length ? '<div class="tw"><table class="t"><thead><tr><th>Dato</th><th>Valor</th><th>Texto literal</th><th class="n">Pág.</th><th></th></tr></thead><tbody>' +
      lec.datos.map((d, i) => '<tr class="' + (d.aceptado ? '' : 'muted') + '"><td>' + esc(d.nombreCampo || d.campo) + '</td><td><b>' + esc(d.valor) + '</b></td><td class="small">«' + esc(d.texto) + '»' + (d.motivo ? '<div class="' + (d.aceptado ? 'muted' : 'txt-bad') + '">' + esc(d.motivo) + '</div>' : '') + '</td><td class="n">' + (d.pagina || '—') + '</td>' +
        '<td>' + (d.aceptado ? UI.tag('está en el documento', 'ok') + ' <button class="btn xs" type="button" data-iausar="' + i + '">Usar como evidencia</button>' : UI.tag('descartado', 'bad')) + '</td></tr>').join('') + '</tbody></table></div>' +
      '<p class="small muted">Propuesto por el asistente de IA. Usted decide si cumple: «Usar como evidencia» solo llena el documento, la página y el texto literal.</p>'
      : '<div class="nota">El asistente no encontró ninguno de esos datos en el documento.</div>';
    $$('[data-iausar]', caja).forEach(b => b.onclick = async () => {
      const d = lec.datos[Number(b.dataset.iausar)];
      const set = (id, v) => { const x = $('#' + id, el); if (x) x.value = v; };
      set('vr_doc', lec.docId); set('vr_pagina', d.pagina); set('vr_texto', d.texto);
      d.usado = { usuario:Sesion.usuario ? Sesion.usuario.usuario : '', fecha:new Date().toISOString() };
      await Almacen.poner('lecturasIA', lec);
      UI.toast('Evidencia llenada con el dato comprobado. Revise y guarde la verificación.', 'ok');
    });
  }

  /** Propone la redacción del concepto con los hechos de la evaluación. */
  async function redactar(p){
    Permisos.exigir('redactarConcepto');
    if (!activo(p)) throw new Error(porQueNo(p));
    const R = Evaluacion.analisis(p);
    if (!R) throw new Error('No hay ofertas abiertas.');
    const al = Evaluacion.alertas(p.id);
    const conf = al.filter(a => a.vigente !== false && Alertas.estado(a) === 'confirmada').map(a => a.alerta);
    const H = AsistenteIA.hechos(Concepto.generar(R, { alertas:al }), conf);
    const est = AsistenteIA.estimar(cfg(), { caracteres:JSON.stringify(H).length, salida:2500 });
    if (!(await confirmar('Un resumen de la evaluación (orden, puntajes, requisitos y alertas confirmadas, sin los documentos)', est))) return null;
    let msg;
    try { msg = await ClienteIA.llamar(AsistenteIA.solicitudRedaccion(cfg(), H)); }
    catch(e){ throw new Error(ClienteIA.explicar(e)); }
    const prop = AsistenteIA.propuestaDe(msg);
    if (!prop) throw new Error('El asistente no devolvió una propuesta.');
    const rev = AsistenteIA.validarRedaccion(prop, H);
    await registrarUso(p, 'redacción', msg, 'concepto · ' + rev.partes.filter(x => x.aceptable).length + ' de ' + rev.partes.length + ' parte(s) sin cifras ajenas');
    const reg = { id:Util.uid('red'), procesoId:p.id, tipo:'redaccion', fecha:new Date().toISOString(), usuario:Sesion.usuario ? Sesion.usuario.usuario : '', modelo:cfg().modelo,
      partes:rev.partes.map(x => Object.assign(x, { estado:'propuesta' })), demo:!!p.demo };
    await Almacen.poner('lecturasIA', reg);
    return reg;
  }
  function propuestas(p){ return (S.lecturasIA || []).filter(x => x.procesoId === p.id && x.tipo === 'redaccion').sort((a, b) => a.fecha < b.fecha ? 1 : -1); }
  /** Una persona acepta o descarta una parte propuesta; aceptar la pasa a los textos del concepto. */
  async function decidirParte(p, regId, i, aceptar){
    Permisos.exigir('redactarConcepto');
    const reg = Util.copia((S.lecturasIA || []).find(x => x.id === regId));
    const x = reg && reg.partes[i];
    if (!x || x.estado !== 'propuesta') throw new Error('Esa propuesta ya se decidió.');
    if (aceptar){
      if (!x.aceptable) throw new Error('Esta parte tiene cifras o nombres que no están en la evaluación: no se puede aceptar.');
      const c = (S.conceptos || []).find(k => k.procesoId === p.id);
      const t = Util.copia((c && c.textos) || {});
      if (x.clave === 'riesgos'){ const o = Evaluacion.analisis(p).ofertas.find(z => z.nombre === x.proponente); t.riesgos = Object.assign({}, t.riesgos, { [o.id]:x.valor }); }
      else t[x.clave] = x.valor;
      await Decision.guardarTextos(p, t);
    }
    x.estado = aceptar ? 'aceptada' : 'descartada';
    x.decidio = { usuario:Sesion.usuario ? Sesion.usuario.usuario : '', fecha:new Date().toISOString() };
    await Almacen.poner('lecturasIA', reg);
    await Auditoria.registrar(aceptar ? 'aceptar' : 'descartar', 'redacción del asistente de IA', x.nombre, p.id);
  }
  return { cfg, guardarCfg, activo, porQueNo, apagado, apagarEnProceso, uso, gastado, leer, leerEnVerificacion, redactar, propuestas, decidirParte };
})();

/* ── Pestaña «Asistente de IA» del módulo 16 ── */
const VistaAsistente = (function(){
  function html(p){
    const c = Asistente.cfg(), k = ClaveIA.estado(), adm = Permisos.puede('configurarAsistente');
    const no = Asistente.porQueNo(p), props = Asistente.propuestas(p);
    const ult = props[0];
    return '<div class="nota">Opcional. Lee documentos de los proponentes y propone la redacción del concepto. Cada uso muestra antes el costo estimado y lo que sale hacia la API de Anthropic; nunca escribe un «cumple» ni un puntaje.</div>' +
      '<div class="grid g2"><div class="card"><div class="card-head"><h3>Configuración</h3>' + UI.tag(no ? 'no disponible' : 'listo', no ? 'warn' : 'ok') + '</div><div class="card-body small">' +
        (no ? '<p>' + esc(no) + '</p>' : '') +
        '<label class="checkline"><input type="checkbox" id="iaActivo"' + (c.activo ? ' checked' : '') + (adm ? '' : ' disabled') + '> Asistente encendido en este equipo</label>' +
        '<div class="field"><label for="iaModelo">Modelo</label><select id="iaModelo"' + (adm ? '' : ' disabled') + '>' + AsistenteIA.MODELOS.map(m => '<option value="' + m.id + '"' + (m.id === c.modelo ? ' selected' : '') + '>' + esc(m.nombre) + ' · US$ ' + m.entrada + ' / ' + m.salida + ' por millón</option>').join('') + '</select></div>' +
        '<div class="field"><label for="iaTope">Tope de gasto del mes (US$)</label><input id="iaTope" type="number" min="0" step="1" value="' + esc(c.topeMensualUsd) + '"' + (adm ? '' : ' disabled') + '></div>' +
        (adm ? boton('ia-guardar', 'Guardar la configuración', 'sm primary') : '') +
        '<h4 class="chk-grupo">Clave de API</h4><p>' + (k.donde === 'ninguna' ? 'Sin clave.' : k.donde === 'sesión' ? 'Clave …' + esc(k.final) + ' solo en esta sesión (se olvida al salir).' : 'Clave …' + esc(k.final) + ' guardada cifrada en este equipo' + (k.escritorio ? ' por el sistema operativo' : '') + (k.guardada ? ' el ' + Util.fmtSello(k.guardada) : '') + '.') + '</p>' +
        '<p class="muted">La clave no entra en el archivo del programa, en los respaldos, en los paquetes ni en los sobres.</p>' +
        (adm ? '<div class="btn-row">' + boton('ia-clave', k.donde === 'ninguna' ? 'Escribir la clave' : 'Cambiar la clave', 'sm') + (k.donde !== 'ninguna' ? boton('ia-probar', 'Probar', 'sm') + boton('ia-borrar-clave', 'Borrar la clave', 'sm ghost') : '') + '</div>' : '') +
        (adm ? '<h4 class="chk-grupo">Este proceso</h4><label class="checkline"><input type="checkbox" id="iaApagado"' + (Asistente.apagado(p) ? ' checked' : '') + '> Apagar el asistente en ' + esc(p.codigo) + '</label>' : '') +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>Gasto del mes</h3></div><div class="card-body small"><div class="stat"><div class="lab">Gastado / tope</div><div class="val">' + AsistenteIA.usd(Asistente.gastado()) + ' / ' + AsistenteIA.usd(c.topeMensualUsd) + '</div></div>' +
        (Asistente.uso().length ? '<div class="tw"><table class="t"><thead><tr><th>Fecha</th><th>Uso</th><th>Usuario</th><th class="n">US$</th></tr></thead><tbody>' + Asistente.uso().slice(0, 10).map(u => '<tr><td>' + Util.fmtSello(u.fecha) + '</td><td>' + esc(u.tipo) + '</td><td>' + esc(u.usuario) + '</td><td class="n">' + u.usd.toFixed(4) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="muted">Sin usos todavía.</p>') +
      '</div></div></div>' +
      '<div class="card"><div class="card-head"><h3>Redacción del concepto</h3>' + (Permisos.puede('redactarConcepto') && !no ? boton('ia-redactar', 'Proponer la redacción', 'sm primary') : '') + '</div><div class="card-body">' +
        '<p class="small">Propone el resumen, la recomendación, las condiciones y los riesgos a partir de las evaluaciones y las alertas confirmadas. Una parte con una cifra o un nombre que no estén en la evaluación no se puede aceptar.</p>' +
        (ult ? ult.partes.map((x, i) => '<div class="propuesta-ia ' + x.estado + '"><div class="row" style="justify-content:space-between;gap:8px"><b>' + esc(x.nombre) + '</b><span>' +
            (x.estado === 'propuesta' ? UI.tag('propuesta de la IA, sin aceptar', 'warn') : UI.tag(x.estado, x.estado === 'aceptada' ? 'ok' : '')) + '</span></div>' +
            (Array.isArray(x.valor) ? '<ul>' + x.valor.map(v => '<li>' + esc(v) + '</li>').join('') + '</ul>' : '<p>' + esc(x.valor) + '</p>') +
            (x.motivo ? '<div class="nota bad small">' + esc(x.motivo) + '</div>' : '') +
            (x.estado === 'propuesta' && Permisos.puede('redactarConcepto') ? '<div class="btn-row">' + (x.aceptable ? '<button class="btn xs primary" type="button" data-accion="ia-aceptar" data-reg="' + ult.id + '" data-i="' + i + '">Aceptar y pasar al concepto</button>' : '') +
              '<button class="btn xs ghost" type="button" data-accion="ia-descartar" data-reg="' + ult.id + '" data-i="' + i + '">Descartar</button></div>' : '') + '</div>').join('') +
          '<p class="small muted">Propuesta del ' + Util.fmtSello(ult.fecha) + ' con ' + esc(AsistenteIA.perfil(ult.modelo).nombre) + '.</p>' : UI.vacio('Sin propuestas', 'La redacción propuesta aparece aquí, marcada, hasta que una persona la acepte o la descarte.')) +
      '</div></div>';
  }
  function conectar(p){
    const ap = $('#iaApagado');
    if (ap) ap.onchange = () => Asistente.apagarEnProceso(p, ap.checked).then(() => App.render()).catch(e => UI.error(e, 'asistente de IA'));
  }
  function acciones(p){
    return {
      'ia-guardar':async () => { await Asistente.guardarCfg({ activo:$('#iaActivo').checked, modelo:$('#iaModelo').value, topeMensualUsd:Number($('#iaTope').value) || 0 }); UI.toast('Configuración del asistente guardada.', 'ok'); App.render(); },
      'ia-clave':async () => {
        const v = await UI.pedir({ titulo:'Clave de API de Anthropic', textoAceptar:'Guardar', campos:[{ k:'clave', lab:'Clave (empieza por sk-ant-)', tipo:'password', c2:true },
          { k:'recordar', lab:'Guardarla cifrada en este equipo (si no, solo durante esta sesión)', tipo:'check', val:true, c2:true }],
          validar:z => ClaveIA.formatoValido(z.clave) ? '' : 'Eso no tiene la forma de una clave de API de Anthropic.' });
        if (!v) return;
        await ClaveIA.guardar(v.clave, v.recordar);
        await Auditoria.registrar('guardar', 'clave de API del asistente', v.recordar ? 'cifrada en este equipo' : 'solo en la sesión');
        UI.toast('Clave guardada.', 'ok'); App.render();
      },
      'ia-probar':async () => { try { const m = await ClienteIA.probar(Asistente.cfg().modelo); UI.toast('La clave funciona con ' + m.nombre + '.', 'ok'); } catch(e){ UI.error(new Error(ClienteIA.explicar(e)), 'asistente de IA'); } },
      'ia-borrar-clave':async () => { if (!(await UI.confirmar({ titulo:'Borrar la clave de API', cuerpo:'<p>Se borra de este equipo, con la llave que la cifraba.</p>', textoAceptar:'Borrar' }))) return; await ClaveIA.borrar(); ClienteIA.olvidar(); await Auditoria.registrar('borrar', 'clave de API del asistente', ''); App.render(); },
      'ia-redactar':async el => { el.disabled = true; el.textContent = 'Redactando…'; try { const r = await Asistente.redactar(p); if (r) UI.toast('Propuesta lista: revísela parte por parte.', 'ok'); } finally { App.render(); } },
      'ia-aceptar':async el => { await Asistente.decidirParte(p, el.dataset.reg, Number(el.dataset.i), true); UI.toast('Pasó a los textos del concepto.', 'ok'); App.render(); },
      'ia-descartar':async el => { await Asistente.decidirParte(p, el.dataset.reg, Number(el.dataset.i), false); App.render(); }
    };
  }
  return { html, conectar, acciones };
})();
