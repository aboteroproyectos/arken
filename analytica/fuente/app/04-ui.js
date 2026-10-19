/* ══════════════════════════════════════════════════════════════════════════
   UI — avisos, modales, formularios y descargas, como los de ARKEN CONTROL.
   ══════════════════════════════════════════════════════════════════════════ */
const UI = (function(){

  function toast(msg, tipo){
    const d = document.createElement('div');
    d.className = 'toast' + (tipo ? ' ' + tipo : '');
    d.textContent = msg;
    $('#toasts').appendChild(d);
    setTimeout(() => { d.style.opacity = '0'; d.style.transition = 'opacity .3s'; }, 3600);
    setTimeout(() => d.remove(), 4000);
  }

  let zIndex = 600;
  function modal(cfg){
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.style.zIndex = (++zIndex);
    const botones = (cfg.botones || []).map((b, i) =>
      '<button class="btn ' + (b.clase||'') + '" data-b="' + i + '" type="button"' + (b.id ? ' id="' + b.id + '"' : '') +
      (b.deshabilitado ? ' disabled' : '') + '>' + esc(b.texto) + '</button>').join('');
    ov.innerHTML =
      '<div class="modal ' + (cfg.ancho||'') + '" role="dialog" aria-modal="true" aria-label="' + esc(cfg.titulo||'') + '">' +
        '<div class="modal-head"><div>' + (cfg.eyebrow ? '<div class="eyebrow">' + esc(cfg.eyebrow) + '</div>' : '') +
          '<h3>' + esc(cfg.titulo||'') + '</h3></div>' +
          '<button class="x" data-cerrar="1" type="button" aria-label="Cerrar">✕</button></div>' +
        '<div class="modal-body">' + (cfg.cuerpo||'') + '</div>' +
        (botones ? '<div class="modal-foot">' + botones + '</div>' : '') +
      '</div>';
    $('#modales').appendChild(ov);
    const api = { el:ov, cerrar(){ ov.remove(); if (cfg.alCerrar) cfg.alCerrar(); }, cuerpo(){ return $('.modal-body', ov); } };
    $('[data-cerrar]', ov).onclick = () => api.cerrar();
    ov.addEventListener('mousedown', e => { if (e.target === ov && !cfg.fijo) api.cerrar(); });
    $$('[data-b]', ov).forEach(b => b.onclick = async () => {
      const def = cfg.botones[+b.dataset.b];
      if (!def.accion){ api.cerrar(); return; }
      b.disabled = true;
      try { await def.accion(api); }
      catch(e){ error(e, cfg.titulo); }
      finally { if (document.body.contains(b)) b.disabled = !!def.deshabilitado; }
    });
    document.addEventListener('keydown', function alEsc(e){
      if (!document.body.contains(ov)){ document.removeEventListener('keydown', alEsc); return; }
      if (e.key === 'Escape' && !cfg.fijo && ov.style.zIndex == zIndex){ api.cerrar(); document.removeEventListener('keydown', alEsc); }
    });
    if (cfg.alAbrir) setTimeout(() => { if (document.body.contains(ov)) cfg.alAbrir(api); }, 0);
    const f = $('input:not([type=checkbox]):not([type=file]),select,textarea', ov);
    if (f && !cfg.sinFoco) setTimeout(() => f.focus(), 40);
    return api;
  }
  function aviso(titulo, html, ancho){ return modal({ titulo, ancho:ancho||'', cuerpo:html, botones:[{ texto:'Entendido', clase:'primary' }] }); }

  function confirmar(cfg){
    return new Promise(res => {
      let listo = false;
      modal({ titulo:cfg.titulo || 'Confirmar', eyebrow:cfg.eyebrow, ancho:cfg.ancho || '',
        cuerpo:(cfg.cuerpo || ('<p>' + esc(cfg.mensaje||'') + '</p>')) +
          (cfg.palabra ? '<div class="field" style="margin-top:14px"><label for="cfPalabra">Para confirmar, escriba ' + esc(cfg.palabra) + '</label>' +
            '<input id="cfPalabra" type="text" autocomplete="off" spellcheck="false"></div>' : ''),
        botones:[
          { texto:cfg.textoCancelar || 'Cancelar', accion:m => { listo = true; m.cerrar(); res(false); } },
          { texto:cfg.textoAceptar || 'Aceptar', clase:cfg.claseAceptar || 'primary', accion:m => {
            if (cfg.palabra && ($('#cfPalabra', m.el).value || '').trim().toUpperCase() !== cfg.palabra){ toast('Escriba ' + cfg.palabra + ' para confirmar', 'bad'); return; }
            listo = true; m.cerrar(); res(true); } }
        ],
        alCerrar(){ if (!listo) res(false); } });
    });
  }

  /** Error para el usuario: mensaje claro, y el detalle al registro técnico. */
  function error(e, contexto){
    RegistroTecnico.anotar(contexto || 'acción', e);
    const msg = e && e.message ? e.message : String(e);
    if (e && e.permiso) aviso('No tiene permiso', '<p>' + esc(msg) + '</p>');
    else toast(msg, 'bad');
  }

  /* ── Formularios ──
     campos: [{ k, lab, tipo:'text'|'number'|'date'|'time'|'select'|'textarea'|'check'|'email',
                val, opts:[{v,n}|string], c2, ayuda, paso, min, deshabilitado }] */
  function campo(c, prefijo){
    const id = (prefijo||'f') + '_' + c.k;
    const val = c.val === undefined || c.val === null ? '' : c.val;
    const dis = c.deshabilitado ? ' disabled' : '';
    let control;
    if (c.tipo === 'select'){
      control = '<select id="' + id + '"' + dis + '>' + (c.opts||[]).map(o => {
        const v = typeof o === 'object' ? o.v : o, n = typeof o === 'object' ? o.n : o;
        return '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(n) + '</option>';
      }).join('') + '</select>';
    } else if (c.tipo === 'textarea'){
      control = '<textarea id="' + id + '" rows="' + (c.filas||4) + '"' + dis + '>' + esc(val) + '</textarea>';
    } else if (c.tipo === 'check'){
      return '<label class="checkline' + (c.c2 ? ' c2' : '') + '"><input type="checkbox" id="' + id + '"' + (val ? ' checked' : '') + dis + '> ' + esc(c.lab) + '</label>' +
        (c.ayuda ? '<div class="ayuda' + (c.c2 ? ' c2' : '') + '">' + c.ayuda + '</div>' : '');
    } else {
      control = '<input id="' + id + '" type="' + (c.tipo||'text') + '" value="' + esc(val) + '"' +
        (c.paso ? ' step="' + c.paso + '"' : (c.tipo === 'number' ? ' step="any"' : '')) + (c.min !== undefined ? ' min="' + c.min + '"' : '') +
        (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : '') + dis + ' autocomplete="off">';
    }
    return '<div class="field' + (c.c2 ? ' c2' : '') + '"><label for="' + id + '">' + esc(c.lab) + '</label>' + control +
      (c.ayuda ? '<div class="ayuda">' + c.ayuda + '</div>' : '') + '</div>';
  }
  function formulario(campos, prefijo){ return '<div class="form">' + campos.map(c => campo(c, prefijo)).join('') + '</div>'; }
  function leer(campos, raiz, prefijo){
    const r = {};
    campos.forEach(c => {
      const el = $('#' + (prefijo||'f') + '_' + c.k, raiz); if (!el) return;
      if (c.tipo === 'check') r[c.k] = el.checked;
      else if (c.tipo === 'number') r[c.k] = el.value === '' ? '' : Number(el.value);
      else r[c.k] = el.value.trim();
    });
    return r;
  }
  /** Formulario en un modal; resuelve con los valores o null si se cancela. */
  function pedir(cfg){
    return new Promise(res => {
      let listo = false;
      modal({ titulo:cfg.titulo, eyebrow:cfg.eyebrow, ancho:cfg.ancho || 'wide',
        cuerpo:(cfg.antes||'') + formulario(cfg.campos, 'pd') + (cfg.despues||''),
        alAbrir:cfg.alAbrir,
        botones:[{ texto:'Cancelar' }, { texto:cfg.textoAceptar || 'Guardar', clase:'primary', accion:async m => {
          const v = leer(cfg.campos, m.el, 'pd');
          if (cfg.validar){ const e = cfg.validar(v, m.el); if (e){ toast(e, 'bad'); return; } }
          listo = true; m.cerrar(); res(v);
        } }],
        alCerrar(){ if (!listo) res(null); } });
    });
  }

  /** Pide uno o varios archivos al usuario. */
  function elegirArchivos(acepta, multiples){
    return new Promise(res => {
      const inp = document.createElement('input');
      inp.type = 'file';
      if (acepta) inp.accept = acepta;
      if (multiples) inp.multiple = true;
      inp.style.display = 'none';
      inp.onchange = () => { res(Array.from(inp.files || [])); inp.remove(); };
      document.body.appendChild(inp);
      inp.click();
    });
  }
  function descargar(nombre, contenido, tipo){
    const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type:tipo || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function marcaGuardado(estado){
    const e = $('#tbGuardado'); if (!e) return;
    e.className = 'saved' + (estado === 'memoria' ? ' mem' : estado === 'guardando' ? ' dirty' : '');
    e.lastElementChild.textContent = estado === 'memoria' ? 'Solo en memoria' : estado === 'guardando' ? 'Guardando…' : 'Guardado';
  }
  function pestanas(clave, lista, activa){
    const act = Sesion.pestanas[clave] || activa || lista[0][0];
    return '<div class="tabs" role="tablist">' + lista.map(([id, nombre]) =>
      '<button class="tab' + (id === act ? ' active' : '') + '" role="tab" data-pestana="' + clave + '" data-id="' + id + '" type="button">' + esc(nombre) + '</button>').join('') + '</div>';
  }
  function pestanaActiva(clave, defecto){ return Sesion.pestanas[clave] || defecto; }
  function tag(texto, tipo){ return '<span class="tag ' + (tipo||'') + '">' + esc(texto) + '</span>'; }
  function vacio(titulo, texto, acciones){
    return '<div class="empty"><div class="ic">◇</div><h4>' + esc(titulo) + '</h4><p class="small">' + (texto||'') + '</p>' + (acciones ? '<div class="btn-row" style="justify-content:center;margin-top:10px">' + acciones + '</div>' : '') + '</div>';
  }
  return { toast, modal, aviso, confirmar, error, campo, formulario, leer, pedir, elegirArchivos, descargar, marcaGuardado,
    pestanas, pestanaActiva, tag, vacio };
})();
