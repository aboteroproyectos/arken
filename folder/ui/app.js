// ARKEN FOLDER · el programa (tablero, explorador, vista previa y búsqueda).
//
// No tiene acceso al disco: todo pasa por window.arkenFolder (electron/preload.cjs), y el proceso
// principal solo responde por las carpetas a las que el usuario dio acceso. El programa nunca
// cambia los archivos del usuario: lo que se personaliza (nombres, iconos, colores, grupos, orden)
// vive solo en el tablero.
'use strict';

(() => {
  const AF = window.arkenFolder;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const h = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const ICONOS = window.ICONOS, COLORES = window.COLORES, TIPOS = window.TIPOS_ARCHIVO;

  const PREF = {
    titulo: 'Mi tablero', subtitulo: '', saludo: true, tema: 'claro', acento: '#A98B54', densidad: 'normal',
    estilo: 'clasico', tamano: 'm', mostrarRuta: true, mostrarConteo: true, mostrarSubcarpetas: true, vistaPrevia: true,
    fondo: { tipo: 'ninguno', color: '#E3E5E6', imagen: '', degradado: 'grafito', velo: 0.82 },
  };
  const DEGRADADOS = {
    grafito: ['Grafito', 'linear-gradient(135deg,#2B2F34 0%,#16181A 100%)'],
    laton: ['Latón', 'linear-gradient(135deg,#F3EDE1 0%,#DCCFB4 55%,#A98B54 100%)'],
    niebla: ['Niebla', 'linear-gradient(160deg,#F7F8F8 0%,#E3E5E6 100%)'],
    noche: ['Noche', 'radial-gradient(120% 120% at 0% 0%,#2E3A46 0%,#16181A 60%)'],
    bosque: ['Bosque', 'linear-gradient(135deg,#1D2B23 0%,#3B6E52 100%)'],
    atardecer: ['Atardecer', 'linear-gradient(135deg,#F3EDE1 0%,#E7B98A 50%,#B5653F 100%)'],
  };

  const S = {
    accesos: [], tablero: { grupos: [], tarjetas: [], preferencias: {} }, recientes: [], sistema: {},
    vista: 'tablero',
    exp: { ruta: null, datos: null, sel: null, hist: [], pos: -1, filtro: '', orden: 'nombre', dir: 1, modo: 'lista', ocultos: false },
    info: new Map(), subs: new Map(), abiertos: new Set(), arr: null, busqueda: null, resultados: null,
  };
  const pref = () => S.tablero.preferencias;
  const win = () => S.sistema.plataforma === 'win32';
  const k = (r) => (win() ? String(r).toLowerCase() : String(r));
  const mismo = (a, b) => !!a && !!b && k(a) === k(b);

  /* ─────────────  Utilidades  ───────────── */
  const svg = (nombre, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${(ICONOS[nombre] || ICONOS.carpeta).d}</svg>`;
  const SVG = {
    flecha: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/></svg>',
    lapiz: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m14 6 4 4"/></svg>',
    externo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    basura: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    chev: '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
    asa: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/></svg>',
    atras: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    adelante: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    arriba: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v8"/></svg>',
    copiar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    lista: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    rejilla: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    ojo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    estrella: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/></svg>',
    cerrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    mas2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    tam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
    grupo: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="6" rx="1.5"/><rect x="3" y="14" width="18" height="6" rx="1.5"/></svg>',
    llave: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/></svg>',
    abrir: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  };

  function tamano(b) {
    if (b == null) return '';
    if (b < 1024) return b + ' B';
    const u = ['KB', 'MB', 'GB', 'TB'];
    let i = -1;
    do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
    return b.toLocaleString('es-CO', { maximumFractionDigits: b < 10 ? 1 : 0 }) + ' ' + u[i];
  }
  const fmtFecha = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const fecha = (ms) => (ms ? fmtFecha.format(new Date(ms)) : '');
  function hace(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'hace un momento';
    if (s < 3600) return 'hace ' + Math.round(s / 60) + ' min';
    if (s < 86400) return 'hace ' + Math.round(s / 3600) + ' h';
    if (s < 86400 * 30) return 'hace ' + Math.round(s / 86400) + ' d';
    return new Date(iso).toLocaleDateString('es-CO');
  }
  const plural = (n, uno, varios) => n + ' ' + (n === 1 ? uno : varios);
  const nombreDe = (ruta) => String(ruta).split(/[\\/]/).filter(Boolean).pop() || ruta;
  const tipoDe = (ext) => TIPOS[ext] || { tipo: ext ? 'Archivo ' + ext.toUpperCase() : 'Archivo', color: '#767C83', vista: null };
  function icoEntrada(e) {
    if (e.esCarpeta) return `<span class="ico-arch carp">${svg('carpeta')}</span>`;
    const t = tipoDe(e.ext);
    return `<span class="ico-arch" style="background:${t.color}">${h((e.ext || '?').slice(0, 4))}</span>`;
  }

  function aviso(texto, tipo = '') {
    const el = document.createElement('div');
    el.className = 'aviso ' + tipo;
    el.textContent = texto;
    $('#avisos').append(el);
    setTimeout(() => el.remove(), tipo === 'error' ? 6500 : 3200);
  }
  async function intentar(fn, mensaje) {
    try {
      return await fn();
    } catch (err) {
      aviso((mensaje ? mensaje + ' ' : '') + String(err.message || err), 'error');
      return undefined;
    }
  }

  let tGuardar = null;
  function guardar() {
    clearTimeout(tGuardar);
    tGuardar = setTimeout(() => intentar(() => AF.guardar({ tablero: S.tablero, recientes: S.recientes }), 'No se pudo guardar el tablero:'), 350);
  }

  /* ─────────────  Ventanas  ───────────── */
  function modal({ titulo, cuerpo, pie = [], ancho = false, alAbrir }) {
    const capa = $('#capa');
    capa.innerHTML = `<div class="modal${ancho ? ' ancho' : ''}" role="dialog" aria-modal="true" aria-label="${h(titulo)}">
      <div class="modal-cab"><h2>${h(titulo)}</h2><button class="btn-icono sm" data-cerrar type="button" aria-label="Cerrar">${SVG.cerrar}</button></div>
      <div class="modal-cuerpo">${cuerpo}</div>
      ${pie.length ? `<div class="modal-pie">${pie.map((b, i) => `<button type="button" class="btn ${b.clase || ''}" data-pie="${i}">${h(b.txt)}</button>`).join('')}</div>` : ''}
    </div>`;
    capa.classList.remove('hide');
    const el = $('.modal', capa);
    const cerrar = () => {
      capa.classList.add('hide');
      capa.innerHTML = '';
      document.removeEventListener('keydown', tecla, true);
    };
    const tecla = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); cerrar(); }
    };
    document.addEventListener('keydown', tecla, true);
    $('[data-cerrar]', el).onclick = cerrar;
    capa.onmousedown = (e) => { if (e.target === capa) cerrar(); };
    pie.forEach((b, i) => {
      $(`[data-pie="${i}"]`, el).onclick = async () => {
        if (b.accion) {
          const r = await b.accion(el);
          if (r === false) return;
        }
        cerrar();
      };
    });
    if (alAbrir) alAbrir(el, cerrar);
    const primero = $('input[type=text],textarea', el);
    if (primero) setTimeout(() => primero.focus(), 30);
    return cerrar;
  }
  const confirmar = (titulo, texto, si = 'Aceptar', peligro = false) =>
    new Promise((res) => {
      let r = false;
      const cerrar = modal({
        titulo, cuerpo: `<p>${texto}</p>`,
        pie: [{ txt: 'Cancelar' }, { txt: si, clase: peligro ? 'btn-peligro' : 'btn-brass', accion: () => { r = true; } }],
      });
      const obs = new MutationObserver(() => {
        if ($('#capa').classList.contains('hide')) { obs.disconnect(); res(r); }
      });
      obs.observe($('#capa'), { attributes: true });
      void cerrar;
    });

  /* ─────────────  Menú contextual  ───────────── */
  function menu(x, y, items) {
    const m = $('#menuCtx');
    m.innerHTML = items.map((it, i) => {
      if (it === '-') return '<hr>';
      if (it.titulo) return `<div class="ctx-tit eyebrow">${h(it.titulo)}</div>`;
      return `<button type="button" data-i="${i}" class="${it.peligro ? 'peligro' : ''}">${it.ico || ''}<span>${h(it.txt)}</span></button>`;
    }).join('');
    m.classList.remove('hide');
    const r = m.getBoundingClientRect();
    m.style.left = Math.min(x, innerWidth - r.width - 8) + 'px';
    m.style.top = Math.min(y, innerHeight - r.height - 8) + 'px';
    $$('button', m).forEach((b) => {
      b.onclick = () => { cerrarMenu(); items[+b.dataset.i].accion(); };
    });
  }
  const cerrarMenu = () => $('#menuCtx').classList.add('hide');
  document.addEventListener('mousedown', (e) => { if (!e.target.closest('#menuCtx')) cerrarMenu(); });
  window.addEventListener('blur', cerrarMenu);

  /* ─────────────  Preferencias y apariencia  ───────────── */
  function aplicarPreferencias() {
    const p = pref();
    const raiz = document.documentElement;
    let tema = p.tema;
    if (tema === 'sistema') tema = matchMedia('(prefers-color-scheme: dark)').matches ? 'oscuro' : 'claro';
    raiz.dataset.tema = tema;
    raiz.dataset.densidad = p.densidad;
    raiz.style.setProperty('--acento', p.acento || PREF.acento);
    const f = $('#fondo');
    const fo = p.fondo || PREF.fondo;
    f.style.backgroundImage = '';
    f.style.backgroundColor = '';
    f.classList.toggle('activo', fo.tipo !== 'ninguno');
    if (fo.tipo === 'color') { f.style.backgroundColor = fo.color; f.style.setProperty('--velo', '0'); }
    else if (fo.tipo === 'degradado') { f.style.backgroundImage = (DEGRADADOS[fo.degradado] || DEGRADADOS.grafito)[1]; f.style.setProperty('--velo', String(fo.velo ?? 0.5)); }
    else if (fo.tipo === 'imagen' && fo.imagen) { f.style.backgroundImage = `url("${fo.imagen}")`; f.style.setProperty('--velo', String(fo.velo ?? 0.82)); }
  }

  function completarTablero() {
    const t = S.tablero;
    t.preferencias = { ...PREF, ...(t.preferencias || {}), fondo: { ...PREF.fondo, ...((t.preferencias || {}).fondo || {}) } };
    t.grupos = t.grupos || [];
    t.tarjetas = t.tarjetas || [];
    const ids = new Set(t.grupos.map((g) => g.id));
    if (t.tarjetas.some((c) => !ids.has(c.grupo))) {
      let g = t.grupos.find((x) => x.nombre === 'General');
      if (!g) { g = { id: uid(), nombre: 'General', color: '#41464C', icono: 'carpeta' }; t.grupos.push(g); }
      t.tarjetas.forEach((c) => { if (!ids.has(c.grupo)) c.grupo = g.id; });
    }
  }

  /* ─────────────  Navegación  ───────────── */
  function irA(vista) {
    S.vista = vista;
    $$('.rail-btn').forEach((b) => b.classList.toggle('activo', b.dataset.vista === vista));
    if (vista !== 'explorar') AF.vigilar(null).catch(() => {});
    if (vista === 'tablero') renderTablero();
    else if (vista === 'explorar') {
      if (S.exp.ruta) explorar(S.exp.ruta, { sinHistorial: true, sel: S.exp.sel });
      else if (S.accesos[0]) explorar(S.accesos[0].ruta);
      else renderBienvenida();
    } else if (vista === 'favoritos') renderFavoritos();
    else if (vista === 'recientes') renderRecientes();
    else if (vista === 'resultados') renderResultados();
    $('#vista').scrollTop = 0;
  }

  /* ─────────────  Barra lateral: accesos  ───────────── */
  function renderRail() {
    const el = $('#listaAccesos');
    if (!S.accesos.length) {
      el.innerHTML = '<div class="accesos-vacio">Todavía no hay carpetas. Use «Dar acceso» para empezar.</div>';
      return;
    }
    el.innerHTML = S.accesos.map((a) => `
      <div class="acceso${a.existe ? '' : ' falta'}" data-id="${h(a.id)}" title="${h(a.ruta)}">
        <span class="ic">${svg(a.existe ? 'carpeta' : 'alerta')}</span>
        <span class="t"><b>${h(a.nombre)}</b><span><bdi>${h(a.existe ? a.ruta : 'No se encuentra: ' + a.ruta)}</bdi></span></span>
        <button class="btn-icono sm mas" type="button" aria-label="Opciones del acceso">${SVG.mas}</button>
      </div>`).join('');
    $$('.acceso', el).forEach((n) => {
      const a = S.accesos.find((x) => x.id === n.dataset.id);
      n.onclick = (e) => {
        if (e.target.closest('.mas')) return menuAcceso(a, e.clientX, e.clientY);
        irAExplorar(a.ruta);
      };
      n.oncontextmenu = (e) => { e.preventDefault(); menuAcceso(a, e.clientX, e.clientY); };
    });
  }

  function menuAcceso(a, x, y) {
    menu(x, y, [
      { titulo: a.nombre },
      { txt: 'Explorar aquí', ico: SVG.abrir, accion: () => irAExplorar(a.ruta) },
      { txt: 'Abrir en el Explorador de Windows', ico: SVG.externo, accion: () => intentar(() => AF.abrir(a.ruta)) },
      { txt: 'Agregar al tablero…', ico: SVG.mas2, accion: () => asistenteAcceso(a) },
      { txt: 'Supercarpetas visibles…', ico: SVG.arriba, accion: () => editarSupercarpetas(a) },
      { txt: 'Copiar la ruta', ico: SVG.copiar, accion: () => AF.copiarRuta(a.ruta).then(() => aviso('Ruta copiada.', 'ok')) },
      '-',
      { txt: 'Quitar el acceso', ico: SVG.basura, peligro: true, accion: () => quitarAcceso(a) },
    ]);
  }

  async function quitarAcceso(a) {
    const ok = await confirmar('Quitar el acceso', `ARKEN FOLDER dejará de ver «${h(a.nombre)}», sus subcarpetas y sus supercarpetas. <b>La carpeta y sus archivos no se tocan.</b>`, 'Quitar el acceso', true);
    if (!ok) return;
    const e = await intentar(() => AF.quitarAcceso(a.id));
    if (!e) return;
    cargarEstado(e);
    // Las tarjetas que ya no tienen acceso se quitan del tablero
    const antes = S.tablero.tarjetas.length;
    const sigue = await AF.info(S.tablero.tarjetas.map((t) => t.ruta));
    const sin = new Set(sigue.filter((i) => !i.permitido).map((i) => k(i.ruta)));
    S.tablero.tarjetas = S.tablero.tarjetas.filter((t) => !sin.has(k(t.ruta)));
    S.tablero.grupos = S.tablero.grupos.filter((g) => g.fijo || S.tablero.tarjetas.some((t) => t.grupo === g.id) || !g.acceso || g.acceso !== a.id);
    guardar();
    if (S.exp.ruta && sin.has(k(S.exp.ruta))) S.exp.ruta = null;
    aviso(`Acceso quitado. ${antes - S.tablero.tarjetas.length ? 'Se quitaron ' + plural(antes - S.tablero.tarjetas.length, 'tarjeta', 'tarjetas') + ' del tablero.' : ''}`, 'ok');
    renderRail();
    irA(S.vista === 'explorar' ? 'explorar' : S.vista);
  }

  function editarSupercarpetas(a) {
    let incluir = a.supercarpetas;
    let tope = a.tope || (a.supercarpetasTodas[0] && a.supercarpetasTodas[0].ruta) || null;
    const pintar = (el) => {
      const todas = a.supercarpetasTodas;
      const iTope = Math.max(0, todas.findIndex((s) => mismo(s.ruta, tope)));
      $('.cadena', el).innerHTML = todas.map((s, i) => `<button type="button" class="eslabon${incluir && i >= iTope ? ' activo' : ' fuera'}" data-r="${h(s.ruta)}">${h(s.nombre)}</button>${SVG.flecha}`).join('') +
        `<span class="eslabon propio">${h(a.nombre)}</span>`;
      $$('.eslabon[data-r]', el).forEach((b) => { b.onclick = () => { incluir = true; tope = b.dataset.r; $('#incSup', el).checked = true; pintar(el); }; });
    };
    modal({
      titulo: 'Supercarpetas de «' + a.nombre + '»',
      cuerpo: `<p class="muted">Las supercarpetas son las carpetas que contienen a «${h(a.nombre)}». Toque la más alta que quiere ver: desde ella hacia abajo, ARKEN FOLDER las muestra y puede entrar en ellas.</p>
        <label class="check-fila"><input type="checkbox" id="incSup" ${incluir ? 'checked' : ''}><span><b>Mostrar supercarpetas</b><span>Si lo desmarca, solo se ve «${h(a.nombre)}» y sus subcarpetas.</span></span></label>
        <div class="cadena"></div>`,
      pie: [{ txt: 'Cancelar' }, {
        txt: 'Guardar', clase: 'btn-brass',
        accion: async () => {
          const e = await intentar(() => AF.ajustarAcceso(a.id, { supercarpetas: incluir, tope: incluir ? tope : null }));
          if (!e) return false;
          cargarEstado(e);
          renderRail();
          irA(S.vista);
          return true;
        },
      }],
      alAbrir: (el) => {
        $('#incSup', el).onchange = (ev) => { incluir = ev.target.checked; pintar(el); };
        pintar(el);
      },
    });
  }

  /* ─────────────  Dar acceso y armar el tablero  ───────────── */
  async function darAcceso() {
    const r = await intentar(() => AF.darAcceso());
    if (!r) return;
    cargarEstado(r.estado);
    renderRail();
    if (!r.nuevos.length) {
      if (S.vista === 'tablero') renderTablero();
      return;
    }
    for (const id of r.nuevos) {
      const a = S.accesos.find((x) => x.id === id);
      if (a) await asistenteAcceso(a);
    }
  }

  async function asistenteAcceso(a) {
    const subs = await intentar(() => AF.subcarpetas(a.ruta)) || [];
    const supers = a.supercarpetasVisibles || [];
    const muchas = subs.length > 40;
    return new Promise((res) => {
      const opcionesGrupo = S.tablero.grupos.map((g) => `<option value="${h(g.id)}">${h(g.nombre)}</option>`).join('');
      modal({
        titulo: 'Agregar «' + a.nombre + '» al tablero',
        cuerpo: `<p class="muted">ARKEN FOLDER ya puede ver esta carpeta y todas sus subcarpetas. Elija qué tarjetas poner en el tablero; después puede cambiarles el nombre, el icono, el color y el orden.</p>
          <div class="check-lista">
            <label class="check-fila"><input type="checkbox" id="cCarpeta" checked><span><b>La carpeta «${h(a.nombre)}»</b><span>${h(a.ruta)}</span></span></label>
            <label class="check-fila"><input type="checkbox" id="cSubs" ${subs.length && !muchas ? 'checked' : ''} ${subs.length ? '' : 'disabled'}><span><b>Sus subcarpetas (${subs.length})</b><span>${subs.length ? h(subs.slice(0, 8).map((s) => s.nombre).join(' · ')) + (subs.length > 8 ? ' …' : '') : 'No tiene subcarpetas.'}${muchas ? ' — son muchas: puede agregarlas igual o fijarlas después desde Explorar.' : ''}</span></span></label>
            <label class="check-fila"><input type="checkbox" id="cSupers" ${supers.length ? 'checked' : 'disabled'}><span><b>Sus supercarpetas (${supers.length})</b><span>${supers.length ? h(supers.map((s) => s.nombre).join(' › ')) : 'No hay supercarpetas visibles.'}</span></span></label>
          </div>
          <div class="campo"><label for="cGrupo">Grupo</label>
            <select id="cGrupo"><option value="__nuevo">Un grupo nuevo: «${h(a.nombre)}»</option>${opcionesGrupo}</select></div>`,
        pie: [
          { txt: 'Ahora no', accion: () => { res(); } },
          {
            txt: 'Agregar al tablero', clase: 'btn-brass',
            accion: (el) => {
              let gid = $('#cGrupo', el).value;
              const color = COLORES[S.tablero.grupos.length % COLORES.length][0];
              if (gid === '__nuevo') {
                gid = uid();
                S.tablero.grupos.push({ id: gid, nombre: a.nombre, color, icono: 'carpeta', acceso: a.id });
              }
              const g = S.tablero.grupos.find((x) => x.id === gid);
              const ya = new Set(S.tablero.tarjetas.filter((t) => t.grupo === gid).map((t) => k(t.ruta)));
              const nueva = (ruta, extra) => {
                if (ya.has(k(ruta))) return;
                ya.add(k(ruta));
                S.tablero.tarjetas.push({ id: uid(), ruta, tipo: 'carpeta', nombre: '', icono: 'carpeta', color: g.color, grupo: gid, tamano: '', ...extra });
              };
              if ($('#cSupers', el).checked) supers.forEach((s, i) => nueva(s.ruta, { icono: i === 0 ? 'disco' : 'carpeta', etiqueta: 'Supercarpeta', tamano: 's' }));
              if ($('#cCarpeta', el).checked) nueva(a.ruta, { icono: 'carpeta-estrella', etiqueta: 'Acceso', tamano: 'l' });
              if ($('#cSubs', el).checked) subs.forEach((s) => nueva(s.ruta, {}));
              guardar();
              res();
              irA('tablero');
              aviso('Tablero actualizado.', 'ok');
            },
          },
        ],
      });
      const obs = new MutationObserver(() => { if ($('#capa').classList.contains('hide')) { obs.disconnect(); res(); } });
      obs.observe($('#capa'), { attributes: true });
    });
  }

  /* ─────────────  Tablero  ───────────── */
  function renderBienvenida() {
    $('#vista').innerHTML = `<div class="pagina"><div class="bienvenida">
      <img class="logo" src="logo.png" alt="">
      <div class="eyebrow">Familia ARKEN 360</div>
      <h1>Bienvenido a ARKEN FOLDER</h1>
      <p class="lema">Su información, a un clic. Dé acceso a las carpetas que usa todos los días y organícelas como usted quiera, con nombres, iconos y colores.</p>
      <button class="btn btn-brass btn-grande" id="bAcceso" type="button">${svg('carpeta')}<span>Dar acceso a una carpeta</span></button>
      <div class="pasos">
        <div class="paso"><div class="n">01</div><b>Dé acceso</b><p>Elija una o varias carpetas. ARKEN FOLDER ve esas carpetas, todas sus subcarpetas y las carpetas que las contienen.</p></div>
        <div class="paso"><div class="n">02</div><b>Arme su tablero</b><p>Cada carpeta es una tarjeta. Cambie nombre, icono, color y tamaño; agrúpelas y arrástrelas al orden que quiera.</p></div>
        <div class="paso"><div class="n">03</div><b>Llegue rápido</b><p>Busque, mire el contenido con vista previa y abra cada archivo con doble clic. Sus carpetas nunca se modifican.</p></div>
      </div></div></div>`;
    $('#bAcceso').onclick = darAcceso;
  }

  function saludo() {
    const hr = new Date().getHours();
    return hr < 12 ? 'Buenos días' : hr < 19 ? 'Buenas tardes' : 'Buenas noches';
  }

  function renderTablero() {
    const t = S.tablero, p = pref();
    if (!S.accesos.length && !t.tarjetas.length) return renderBienvenida();
    const total = t.tarjetas.length;
    $('#vista').innerHTML = `<div class="pagina">
      <div class="cab">
        <div class="tit">
          ${p.saludo ? `<div class="eyebrow">${saludo()} · ${new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}</div>` : ''}
          <h1>${h(p.titulo || 'Mi tablero')}</h1>
          <div class="sub">${p.subtitulo ? h(p.subtitulo) + ' · ' : ''}${plural(total, 'tarjeta', 'tarjetas')} en ${plural(t.grupos.length, 'grupo', 'grupos')}</div>
        </div>
        <div class="acciones">
          <button class="btn" id="bGrupo" type="button">${SVG.grupo}<span>Nuevo grupo</span></button>
          <button class="btn" id="bPers" type="button">${svg('estrella')}<span>Personalizar</span></button>
        </div>
      </div>
      <div id="grupos">${t.grupos.map(grupoHTML).join('')}</div>
      ${t.grupos.length ? '' : '<div class="vacio">No hay grupos todavía. Cree uno o agregue una carpeta desde «Carpetas con acceso».</div>'}
    </div>`;
    $('#bGrupo').onclick = () => editarGrupo(null);
    $('#bPers').onclick = personalizar;
    conectarTablero();
    cargarInfo(t.tarjetas.map((c) => c.ruta));
    cargarHijos();
  }

  function grupoHTML(g) {
    const tarjetas = S.tablero.tarjetas.filter((c) => c.grupo === g.id);
    return `<section class="grupo${g.colapsado ? ' colapsado' : ''}" data-g="${h(g.id)}" style="--gc:${h(g.color || '')}">
      <div class="grupo-cab" draggable="true">
        <span class="asa" title="Arrastre para mover el grupo">${SVG.asa}</span>
        <span class="barra"></span>
        <span class="gic">${svg(g.icono || 'carpeta')}</span>
        <h2>${h(g.nombre)}</h2>
        <span class="cuenta">${tarjetas.length}</span>
        <button class="btn-icono sm" data-ga="colapsar" type="button" aria-label="Contraer o expandir">${SVG.chev}</button>
        <span class="acc">
          <button class="btn-icono sm" data-ga="agregar" type="button" title="Agregar una carpeta o archivo">${SVG.mas2}</button>
          <button class="btn-icono sm" data-ga="editar" type="button" title="Personalizar el grupo">${SVG.lapiz}</button>
          <button class="btn-icono sm" data-ga="borrar" type="button" title="Eliminar el grupo">${SVG.basura}</button>
        </span>
      </div>
      <div class="rejilla" data-g="${h(g.id)}">${tarjetas.map(tarjetaHTML).join('') || '<div class="rejilla-vacia">Arrastre tarjetas aquí o use + para agregar</div>'}</div>
    </section>`;
  }

  function tarjetaHTML(c) {
    const p = pref();
    const inf = S.info.get(k(c.ruta));
    const tam = c.tamano || p.tamano || 'm';
    const estilo = c.estilo || p.estilo || 'clasico';
    const nombre = c.nombre || nombreDe(c.ruta);
    const falta = inf && (!inf.permitido || !inf.existe);
    let meta = '';
    if (falta) meta = `<span>${inf.permitido ? 'No se encuentra' : 'Sin acceso'}</span>`;
    else if (inf && p.mostrarConteo) {
      meta = inf.esCarpeta ? `<span><span class="num">${inf.carpetas}</span> ${inf.carpetas === 1 ? 'carpeta' : 'carpetas'}</span><span>·</span><span><span class="num">${inf.archivos}</span> ${inf.archivos === 1 ? 'archivo' : 'archivos'}</span>`
        : `<span>${h(tipoDe((c.ruta.split('.').pop() || '').toLowerCase()).tipo)}</span><span>·</span><span class="num">${tamano(inf.tamano)}</span>`;
    }
    const icono = c.imagen ? `<img src="${h(c.imagen)}" alt="">` : c.tipo === 'archivo' && !c.icono ? icoTexto(c) : svg(c.icono || 'carpeta');
    const hijos = (tam === 'l' || tam === 'xl') && p.mostrarSubcarpetas && c.tipo !== 'archivo' ? `<div class="t-hijos" data-hijos="${h(c.ruta)}"></div>` : '';
    return `<article class="tarjeta tam-${tam} est-${estilo}${falta ? ' falta' : ''}" draggable="true" data-id="${h(c.id)}" style="--c:${h(c.color || p.acento)}" title="${h(c.ruta)}" tabindex="0">
      ${c.favorita ? `<span class="t-fav">${SVG.estrella}</span>` : c.etiqueta && tam !== 's' ? `<span class="t-etq">${h(c.etiqueta)}</span>` : ''}
      <div class="t-ic">${icono}</div>
      <div class="t-cuerpo">
        <div class="t-nombre">${h(nombre)}</div>
        ${p.mostrarRuta ? `<div class="t-ruta"><bdi>${h(c.ruta)}</bdi></div>` : ''}
      </div>
      ${c.nota ? `<div class="t-nota">${h(c.nota)}</div>` : ''}
      ${hijos}
      <div class="t-meta">${meta}</div>
      <div class="t-acc">
        <button class="btn-icono sm" data-ta="windows" type="button" title="Abrir en el Explorador de Windows">${SVG.externo}</button>
        <button class="btn-icono sm" data-ta="editar" type="button" title="Personalizar">${SVG.lapiz}</button>
        <button class="btn-icono sm" data-ta="menu" type="button" title="Más opciones">${SVG.mas}</button>
      </div>
    </article>`;
  }
  const icoTexto = (c) => `<span class="num" style="font-weight:700;font-size:11px;letter-spacing:.04em">${h(((c.ruta.split('.').pop()) || '').slice(0, 4).toUpperCase())}</span>`;

  async function cargarInfo(rutas) {
    const faltan = rutas.filter((r) => !S.info.has(k(r)));
    const todas = rutas.length ? await AF.info(rutas).catch(() => []) : [];
    todas.forEach((i) => S.info.set(k(i.ruta), i));
    if (S.vista === 'tablero') {
      $$('.tarjeta[data-id]').forEach((el) => {
        const c = S.tablero.tarjetas.find((x) => x.id === el.dataset.id);
        if (!c) return;
        const nuevo = document.createElement('div');
        nuevo.innerHTML = tarjetaHTML(c);
        const hijosViejos = $('.t-hijos', el);
        const n = nuevo.firstElementChild;
        if (hijosViejos && $('.t-hijos', n)) $('.t-hijos', n).replaceWith(hijosViejos);
        el.className = n.className;
        el.innerHTML = n.innerHTML;
      });
    }
    void faltan;
  }

  async function cargarHijos() {
    for (const el of $$('[data-hijos]')) {
      const ruta = el.dataset.hijos;
      let subs = S.subs.get(k(ruta));
      if (!subs) {
        subs = await AF.subcarpetas(ruta).catch(() => []);
        S.subs.set(k(ruta), subs);
      }
      const max = el.closest('.tam-xl') ? 14 : 6;
      el.innerHTML = subs.slice(0, max).map((s) => `<button type="button" class="t-hijo" data-r="${h(s.ruta)}" title="${h(s.ruta)}">${svg('carpeta')}<span>${h(s.nombre)}</span></button>`).join('') +
        (subs.length > max ? `<span class="t-hijo" style="cursor:default">+${subs.length - max}</span>` : '');
    }
  }

  function conectarTablero() {
    const raiz = $('#grupos');
    if (!raiz) return;
    raiz.onclick = (e) => {
      const hijo = e.target.closest('.t-hijo[data-r]');
      if (hijo) { e.stopPropagation(); return irAExplorar(hijo.dataset.r); }
      const ga = e.target.closest('[data-ga]');
      if (ga) {
        const g = S.tablero.grupos.find((x) => x.id === ga.closest('.grupo').dataset.g);
        if (ga.dataset.ga === 'colapsar') { g.colapsado = !g.colapsado; guardar(); ga.closest('.grupo').classList.toggle('colapsado', g.colapsado); }
        else if (ga.dataset.ga === 'editar') editarGrupo(g);
        else if (ga.dataset.ga === 'borrar') borrarGrupo(g);
        else if (ga.dataset.ga === 'agregar') agregarAGrupo(g, ga);
        return;
      }
      const el = e.target.closest('.tarjeta');
      if (!el) return;
      const c = S.tablero.tarjetas.find((x) => x.id === el.dataset.id);
      const ta = e.target.closest('[data-ta]');
      if (ta) {
        if (ta.dataset.ta === 'windows') intentar(() => (c.tipo === 'archivo' ? AF.mostrar(c.ruta) : AF.abrir(c.ruta)));
        else if (ta.dataset.ta === 'editar') editarTarjeta(c);
        else menuTarjeta(c, e.clientX, e.clientY);
        return;
      }
      abrirTarjeta(c);
    };
    raiz.onkeydown = (e) => {
      const el = e.target.closest('.tarjeta');
      if (el && e.key === 'Enter') abrirTarjeta(S.tablero.tarjetas.find((x) => x.id === el.dataset.id));
    };
    raiz.oncontextmenu = (e) => {
      const el = e.target.closest('.tarjeta');
      if (!el) return;
      e.preventDefault();
      menuTarjeta(S.tablero.tarjetas.find((x) => x.id === el.dataset.id), e.clientX, e.clientY);
    };
    // Arrastrar tarjetas y grupos
    const limpiar = () => $$('.soltar,.soltar-antes,.arrastrando').forEach((x) => x.classList.remove('soltar', 'soltar-antes', 'arrastrando'));
    raiz.ondragstart = (e) => {
      const t = e.target.closest('.tarjeta');
      const g = e.target.closest('.grupo-cab');
      if (t) { S.arr = { tipo: 'tarjeta', id: t.dataset.id }; t.classList.add('arrastrando'); }
      else if (g) { S.arr = { tipo: 'grupo', id: g.closest('.grupo').dataset.g }; g.closest('.grupo').classList.add('arrastrando'); }
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', 'arken');
    };
    raiz.ondragend = () => { S.arr = null; limpiar(); };
    raiz.ondragover = (e) => {
      if (!S.arr) return;
      e.preventDefault();
      $$('.soltar,.soltar-antes').forEach((x) => x.classList.remove('soltar', 'soltar-antes'));
      if (S.arr.tipo === 'tarjeta') {
        const t = e.target.closest('.tarjeta');
        if (t && t.dataset.id !== S.arr.id) t.classList.add('soltar-antes');
        else { const r = e.target.closest('.rejilla') || ($('.rejilla', e.target.closest('.grupo') || document.createElement('div'))); if (r) r.classList.add('soltar'); }
      } else {
        const g = e.target.closest('.grupo');
        if (g && g.dataset.g !== S.arr.id) g.classList.add('soltar-antes');
      }
    };
    raiz.ondrop = (e) => {
      if (!S.arr) return;
      e.preventDefault();
      const tb = S.tablero;
      if (S.arr.tipo === 'tarjeta') {
        const i = tb.tarjetas.findIndex((x) => x.id === S.arr.id);
        const [c] = tb.tarjetas.splice(i, 1);
        const destino = e.target.closest('.tarjeta');
        if (destino && destino.dataset.id !== c.id) {
          const j = tb.tarjetas.findIndex((x) => x.id === destino.dataset.id);
          c.grupo = tb.tarjetas[j].grupo;
          tb.tarjetas.splice(j, 0, c);
        } else {
          const g = e.target.closest('.grupo');
          if (g) c.grupo = g.dataset.g;
          tb.tarjetas.push(c);
        }
      } else {
        const g = e.target.closest('.grupo');
        if (g && g.dataset.g !== S.arr.id) {
          const i = tb.grupos.findIndex((x) => x.id === S.arr.id);
          const [mov] = tb.grupos.splice(i, 1);
          tb.grupos.splice(tb.grupos.findIndex((x) => x.id === g.dataset.g), 0, mov);
        }
      }
      S.arr = null;
      guardar();
      renderTablero();
    };
  }

  function abrirTarjeta(c) {
    if (!c) return;
    if (c.tipo === 'archivo') abrirArchivo({ ruta: c.ruta, nombre: c.nombre || nombreDe(c.ruta), esCarpeta: false });
    else irAExplorar(c.ruta);
  }

  function menuTarjeta(c, x, y) {
    const otros = S.tablero.grupos.filter((g) => g.id !== c.grupo);
    const items = [
      { titulo: c.nombre || nombreDe(c.ruta) },
      c.tipo === 'archivo'
        ? { txt: 'Abrir el archivo', ico: SVG.abrir, accion: () => abrirTarjeta(c) }
        : { txt: 'Explorar aquí', ico: SVG.abrir, accion: () => abrirTarjeta(c) },
      c.tipo === 'archivo'
        ? { txt: 'Mostrar en el Explorador de Windows', ico: SVG.externo, accion: () => intentar(() => AF.mostrar(c.ruta)) }
        : { txt: 'Abrir en el Explorador de Windows', ico: SVG.externo, accion: () => intentar(() => AF.abrir(c.ruta)) },
      { txt: 'Copiar la ruta', ico: SVG.copiar, accion: () => AF.copiarRuta(c.ruta).then(() => aviso('Ruta copiada.', 'ok'), (e) => aviso(e.message, 'error')) },
      '-',
      { txt: 'Personalizar…', ico: SVG.lapiz, accion: () => editarTarjeta(c) },
      { txt: c.favorita ? 'Quitar de favoritos' : 'Marcar como favorita', ico: SVG.estrella, accion: () => { c.favorita = !c.favorita; guardar(); renderTablero(); } },
      { titulo: 'Tamaño' },
      ...[['s', 'Pequeña'], ['m', 'Mediana'], ['l', 'Grande'], ['xl', 'Muy grande']].map(([v, n]) => ({ txt: n + ((c.tamano || pref().tamano) === v ? '  ✓' : ''), ico: SVG.tam, accion: () => { c.tamano = v; guardar(); renderTablero(); } })),
    ];
    if (otros.length) items.push({ titulo: 'Mover a' }, ...otros.slice(0, 8).map((g) => ({ txt: g.nombre, ico: SVG.grupo, accion: () => { c.grupo = g.id; guardar(); renderTablero(); } })));
    items.push('-', { txt: 'Duplicar la tarjeta', ico: SVG.copiar, accion: () => { const i = S.tablero.tarjetas.indexOf(c); S.tablero.tarjetas.splice(i + 1, 0, { ...c, id: uid() }); guardar(); renderTablero(); } });
    items.push({ txt: 'Quitar del tablero', ico: SVG.basura, peligro: true, accion: () => { S.tablero.tarjetas = S.tablero.tarjetas.filter((x) => x.id !== c.id); guardar(); renderTablero(); aviso('Tarjeta quitada. La carpeta no se tocó.'); } });
    menu(x, y, items);
  }

  async function agregarAGrupo(g, boton) {
    const r = boton.getBoundingClientRect();
    const items = [{ titulo: 'Agregar a «' + g.nombre + '»' }];
    S.accesos.forEach((a) => items.push({ txt: a.nombre, ico: svg('carpeta-estrella'), accion: () => fijar({ ruta: a.ruta, esCarpeta: true }, g.id) }));
    items.push('-', { txt: 'Buscar en Explorar y fijar…', ico: SVG.pin, accion: () => irA('explorar') });
    items.push({ txt: 'Dar acceso a otra carpeta…', ico: SVG.llave, accion: darAcceso });
    menu(r.left, r.bottom + 4, items);
  }

  function fijar(e, grupoId) {
    let gid = grupoId;
    if (!gid) {
      gid = (S.tablero.grupos.find((g) => S.tablero.tarjetas.some((t) => t.grupo === g.id && e.ruta && k(e.ruta).startsWith(k(t.ruta)))) || S.tablero.grupos[0] || {}).id;
      if (!gid) { gid = uid(); S.tablero.grupos.push({ id: gid, nombre: 'General', color: '#41464C', icono: 'carpeta' }); }
    }
    const g = S.tablero.grupos.find((x) => x.id === gid);
    if (S.tablero.tarjetas.some((t) => t.grupo === gid && mismo(t.ruta, e.ruta))) { aviso('Ya está en el grupo «' + g.nombre + '».'); return; }
    S.tablero.tarjetas.push({ id: uid(), ruta: e.ruta, tipo: e.esCarpeta ? 'carpeta' : 'archivo', nombre: '', icono: e.esCarpeta ? 'carpeta' : '', color: g.color, grupo: gid, tamano: '' });
    guardar();
    aviso('Fijado en «' + g.nombre + '».', 'ok');
    if (S.vista === 'tablero') renderTablero();
  }

  /* ─────────────  Personalizar tarjeta, grupo y tablero  ───────────── */
  function selectorIconos(actual) {
    return `<div class="iconos-sel">${Object.entries(ICONOS).map(([id, ic]) => `<button type="button" data-icono="${id}" title="${h(ic.n)}" class="${id === actual ? 'activo' : ''}">${svg(id)}</button>`).join('')}</div>`;
  }
  function selectorColores(actual) {
    return `<div class="colores-sel">${COLORES.map(([c, n]) => `<button type="button" data-color="${c}" title="${h(n)}" style="background:${c}" class="${String(actual).toLowerCase() === c.toLowerCase() ? 'activo' : ''}"></button>`).join('')}
      <input type="color" data-color-libre value="${h(/^#[0-9a-f]{6}$/i.test(actual) ? actual : '#A98B54')}" title="Otro color"></div>`;
  }
  function conectarSelectores(el, alCambiar) {
    $$('[data-icono]', el).forEach((b) => { b.onclick = () => { $$('[data-icono]', el).forEach((x) => x.classList.remove('activo')); b.classList.add('activo'); alCambiar({ icono: b.dataset.icono }); }; });
    $$('[data-color]', el).forEach((b) => { b.onclick = () => { $$('[data-color]', el).forEach((x) => x.classList.remove('activo')); b.classList.add('activo'); alCambiar({ color: b.dataset.color }); }; });
    const libre = $('[data-color-libre]', el);
    if (libre) libre.oninput = () => { $$('[data-color]', el).forEach((x) => x.classList.remove('activo')); alCambiar({ color: libre.value }); };
  }
  const opciones = (nombre, lista, actual) => `<div class="opciones" data-op="${nombre}">${lista.map(([v, n]) => `<button type="button" class="opcion${v === actual ? ' activo' : ''}" data-v="${v}">${h(n)}</button>`).join('')}</div>`;
  function conectarOpciones(el, fn) {
    $$('[data-op]', el).forEach((grupo) => {
      $$('.opcion', grupo).forEach((b) => {
        b.onclick = () => { $$('.opcion', grupo).forEach((x) => x.classList.remove('activo')); b.classList.add('activo'); fn(grupo.dataset.op, b.dataset.v); };
      });
    });
  }

  function editarTarjeta(c) {
    const borrador = { ...c };
    const muestra = (el) => {
      const d = document.createElement('div');
      d.innerHTML = tarjetaHTML({ ...borrador, nombre: borrador.nombre });
      const t = d.firstElementChild;
      t.removeAttribute('draggable');
      $('.t-acc', t)?.remove();
      $('.muestra', el).replaceChildren(t);
    };
    modal({
      titulo: 'Personalizar la tarjeta', ancho: true,
      cuerpo: `<div class="muestra"></div>
        <div class="dos">
          <div class="campo"><label for="eNombre">Nombre en el tablero</label><input type="text" id="eNombre" maxlength="80" value="${h(c.nombre)}" placeholder="${h(nombreDe(c.ruta))}"><span class="ayuda">Solo cambia en ARKEN FOLDER: la carpeta conserva su nombre.</span></div>
          <div class="campo"><label for="eEtiqueta">Etiqueta</label><input type="text" id="eEtiqueta" maxlength="24" value="${h(c.etiqueta || '')}" placeholder="Ej.: En obra, Urgente, 2026"></div>
        </div>
        <div class="campo"><label for="eNota">Nota</label><textarea id="eNota" maxlength="400" placeholder="Algo que quiera recordar de esta carpeta">${h(c.nota || '')}</textarea></div>
        <div class="campo"><span class="lbl">Icono</span>${selectorIconos(c.icono)}
          <div style="display:flex;gap:8px;margin-top:6px"><button type="button" class="btn btn-sm" id="eImagen">Usar una imagen propia…</button>${c.imagen ? '<button type="button" class="btn btn-sm" id="eSinImagen">Quitar la imagen</button>' : ''}</div></div>
        <div class="campo"><span class="lbl">Color</span>${selectorColores(c.color || pref().acento)}</div>
        <div class="dos">
          <div class="campo"><span class="lbl">Tamaño</span>${opciones('tamano', [['', 'Del tablero'], ['s', 'Pequeña'], ['m', 'Mediana'], ['l', 'Grande'], ['xl', 'Muy grande']], c.tamano || '')}</div>
          <div class="campo"><span class="lbl">Estilo</span>${opciones('estilo', [['', 'Del tablero'], ['clasico', 'Clásico'], ['color', 'Color'], ['contorno', 'Contorno'], ['vidrio', 'Vidrio']], c.estilo || '')}</div>
        </div>
        <div class="campo"><label for="eGrupo">Grupo</label><select id="eGrupo">${S.tablero.grupos.map((g) => `<option value="${h(g.id)}" ${g.id === c.grupo ? 'selected' : ''}>${h(g.nombre)}</option>`).join('')}</select></div>
        <div class="campo"><span class="lbl">Ruta</span><span class="small muted" style="word-break:break-all">${h(c.ruta)}</span></div>`,
      pie: [
        { txt: 'Quitar del tablero', clase: 'btn-peligro izq', accion: () => { S.tablero.tarjetas = S.tablero.tarjetas.filter((x) => x.id !== c.id); guardar(); renderTablero(); } },
        { txt: 'Cancelar' },
        { txt: 'Guardar', clase: 'btn-brass', accion: () => { Object.assign(c, borrador); guardar(); renderTablero(); } },
      ],
      alAbrir: (el) => {
        const leer = () => {
          borrador.nombre = $('#eNombre', el).value.trim();
          borrador.etiqueta = $('#eEtiqueta', el).value.trim();
          borrador.nota = $('#eNota', el).value.trim();
          borrador.grupo = $('#eGrupo', el).value;
          muestra(el);
        };
        ['#eNombre', '#eEtiqueta', '#eNota'].forEach((s) => { $(s, el).oninput = leer; });
        $('#eGrupo', el).onchange = leer;
        conectarSelectores(el, (cambio) => { if (cambio.icono) borrador.imagen = ''; Object.assign(borrador, cambio); muestra(el); });
        conectarOpciones(el, (op, v) => { borrador[op] = v; muestra(el); });
        $('#eImagen', el).onclick = async () => {
          const url = await intentar(() => AF.elegirImagen());
          if (url) { borrador.imagen = url; muestra(el); }
        };
        if ($('#eSinImagen', el)) $('#eSinImagen', el).onclick = () => { borrador.imagen = ''; muestra(el); };
        muestra(el);
      },
    });
  }

  function editarGrupo(g) {
    const nuevo = !g;
    const b = g ? { ...g } : { id: uid(), nombre: '', color: COLORES[S.tablero.grupos.length % COLORES.length][0], icono: 'carpeta' };
    modal({
      titulo: nuevo ? 'Nuevo grupo' : 'Personalizar el grupo',
      cuerpo: `<div class="campo"><label for="gNombre">Nombre</label><input type="text" id="gNombre" maxlength="60" value="${h(b.nombre)}" placeholder="Ej.: Obras en curso, Clientes, Contabilidad"></div>
        <div class="campo"><span class="lbl">Icono</span>${selectorIconos(b.icono)}</div>
        <div class="campo"><span class="lbl">Color</span>${selectorColores(b.color)}</div>
        ${nuevo ? '' : '<label class="check-fila"><input type="checkbox" id="gPintar"><span><b>Pintar todas sus tarjetas con este color</b><span>Las tarjetas a las que usted les puso otro color también cambian.</span></span></label>'}`,
      pie: [{ txt: 'Cancelar' }, {
        txt: nuevo ? 'Crear el grupo' : 'Guardar', clase: 'btn-brass',
        accion: (el) => {
          b.nombre = $('#gNombre', el).value.trim() || 'Grupo sin nombre';
          if (nuevo) S.tablero.grupos.push(b);
          else {
            Object.assign(g, b);
            if ($('#gPintar', el).checked) S.tablero.tarjetas.filter((t) => t.grupo === g.id).forEach((t) => { t.color = g.color; });
          }
          guardar();
          renderTablero();
        },
      }],
      alAbrir: (el) => conectarSelectores(el, (c) => Object.assign(b, c)),
    });
  }

  async function borrarGrupo(g) {
    const n = S.tablero.tarjetas.filter((t) => t.grupo === g.id).length;
    const ok = await confirmar('Eliminar el grupo', `Se elimina el grupo «${h(g.nombre)}»${n ? ' y sus ' + plural(n, 'tarjeta', 'tarjetas') : ''} del tablero. <b>Las carpetas no se tocan.</b>`, 'Eliminar', true);
    if (!ok) return;
    S.tablero.grupos = S.tablero.grupos.filter((x) => x.id !== g.id);
    S.tablero.tarjetas = S.tablero.tarjetas.filter((t) => t.grupo !== g.id);
    guardar();
    renderTablero();
  }

  function personalizar() {
    const p = pref();
    const b = JSON.parse(JSON.stringify(p));
    let listo = false;
    const vivo = () => { S.tablero.preferencias = b; aplicarPreferencias(); };
    modal({
      titulo: 'Personalizar el tablero', ancho: true,
      cuerpo: `<div class="dos">
          <div class="campo"><label for="pTitulo">Título</label><input type="text" id="pTitulo" maxlength="60" value="${h(b.titulo)}"></div>
          <div class="campo"><label for="pSub">Subtítulo</label><input type="text" id="pSub" maxlength="80" value="${h(b.subtitulo)}" placeholder="Ej.: Constructora · Antioquia"></div>
        </div>
        <div class="dos">
          <div class="campo"><span class="lbl">Tema</span>${opciones('tema', [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['sistema', 'Como Windows']], b.tema)}</div>
          <div class="campo"><span class="lbl">Densidad</span>${opciones('densidad', [['compacta', 'Compacta'], ['normal', 'Normal'], ['amplia', 'Amplia']], b.densidad)}</div>
        </div>
        <div class="campo"><span class="lbl">Color de acento</span>${selectorColores(b.acento)}</div>
        <div class="dos">
          <div class="campo"><span class="lbl">Estilo de las tarjetas</span>${opciones('estilo', [['clasico', 'Clásico'], ['color', 'Color'], ['contorno', 'Contorno'], ['vidrio', 'Vidrio']], b.estilo)}</div>
          <div class="campo"><span class="lbl">Tamaño de las tarjetas</span>${opciones('tamano', [['s', 'Pequeñas'], ['m', 'Medianas'], ['l', 'Grandes']], b.tamano)}</div>
        </div>
        <div class="campo"><span class="lbl">Fondo</span>${opciones('fondoTipo', [['ninguno', 'Sin fondo'], ['degradado', 'Degradado'], ['color', 'Color'], ['imagen', 'Imagen propia']], b.fondo.tipo)}
          <div id="pFondo"></div></div>
        <div class="campo"><span class="lbl">Qué mostrar</span>
          <div class="check-lista">
            <label class="chk"><input type="checkbox" data-pref="saludo" ${b.saludo ? 'checked' : ''}> Saludo y fecha</label>
            <label class="chk"><input type="checkbox" data-pref="mostrarRuta" ${b.mostrarRuta ? 'checked' : ''}> La ruta de cada carpeta</label>
            <label class="chk"><input type="checkbox" data-pref="mostrarConteo" ${b.mostrarConteo ? 'checked' : ''}> Cuántas carpetas y archivos tiene</label>
            <label class="chk"><input type="checkbox" data-pref="mostrarSubcarpetas" ${b.mostrarSubcarpetas ? 'checked' : ''}> Las subcarpetas en las tarjetas grandes</label>
            <label class="chk"><input type="checkbox" data-pref="vistaPrevia" ${b.vistaPrevia ? 'checked' : ''}> El panel de vista previa en Explorar</label>
          </div></div>`,
      pie: [
        { txt: 'Guardar una copia del tablero…', clase: 'izq', accion: () => { exportar(); return false; } },
        { txt: 'Volver a lo de fábrica', accion: () => { listo = true; S.tablero.preferencias = { ...PREF, fondo: { ...PREF.fondo } }; aplicarPreferencias(); guardar(); renderTablero(); } },
        { txt: 'Listo', clase: 'btn-brass', accion: (el) => { listo = true; b.titulo = $('#pTitulo', el).value.trim() || 'Mi tablero'; b.subtitulo = $('#pSub', el).value.trim(); vivo(); guardar(); renderTablero(); } },
      ],
      alAbrir: (el) => {
        const original = p;
        const pintarFondo = () => {
          const f = b.fondo;
          const c = $('#pFondo', el);
          if (f.tipo === 'degradado') c.innerHTML = `<div style="margin-top:8px">${opciones('degradado', Object.entries(DEGRADADOS).map(([id, [n]]) => [id, n]), f.degradado)}</div>${rangoVelo(f)}`;
          else if (f.tipo === 'color') c.innerHTML = `<div style="margin-top:8px" class="colores-sel"><input type="color" id="pFondoColor" value="${h(f.color)}"> <span class="small muted">Elija el color del fondo</span></div>`;
          else if (f.tipo === 'imagen') c.innerHTML = `<div style="margin-top:8px;display:flex;gap:8px;align-items:center"><button type="button" class="btn btn-sm" id="pFondoImg">Elegir una imagen…</button><span class="small muted">${f.imagen ? 'Imagen elegida' : 'Por ejemplo, una foto de su obra o su logo'}</span></div>${rangoVelo(f)}`;
          else c.innerHTML = '';
          conectarOpciones(c, (op, v) => { if (op === 'degradado') { f.degradado = v; vivo(); } });
          const velo = $('#pVelo', c);
          if (velo) velo.oninput = () => { f.velo = +velo.value; vivo(); };
          const col = $('#pFondoColor', c);
          if (col) col.oninput = () => { f.color = col.value; vivo(); };
          const img = $('#pFondoImg', c);
          if (img) img.onclick = async () => { const u = await intentar(() => AF.elegirImagen()); if (u) { f.imagen = u; vivo(); pintarFondo(); } };
        };
        const rangoVelo = (f) => `<div class="rango" style="margin-top:8px"><span class="small muted">Fondo intenso</span><input type="range" id="pVelo" min="0" max="0.95" step="0.05" value="${f.velo}"><span class="small muted">Fondo suave</span></div>`;
        $$('[data-op]', el).forEach((g) => {
          if (g.closest('#pFondo')) return;
          $$('.opcion', g).forEach((bt) => {
            bt.onclick = () => {
              $$('.opcion', g).forEach((x) => x.classList.remove('activo'));
              bt.classList.add('activo');
              const op = g.dataset.op, v = bt.dataset.v;
              if (op === 'fondoTipo') { b.fondo.tipo = v; pintarFondo(); }
              else b[op] = v;
              vivo();
            };
          });
        });
        conectarSelectores(el, (c) => { if (c.color) { b.acento = c.color; vivo(); } });
        $$('[data-pref]', el).forEach((x) => { x.onchange = () => { b[x.dataset.pref] = x.checked; vivo(); }; });
        pintarFondo();
        // Si se cierra sin «Listo», vuelve a como estaba
        const obs = new MutationObserver(() => {
          if ($('#capa').classList.contains('hide')) {
            obs.disconnect();
            if (!listo) { S.tablero.preferencias = original; aplicarPreferencias(); }
          }
        });
        obs.observe($('#capa'), { attributes: true });
        void original;
      },
    });
  }

  async function exportar() {
    const ok = await intentar(() => AF.exportar());
    if (ok) aviso('Copia del tablero guardada.', 'ok');
  }
  async function importar() {
    const si = await confirmar('Abrir una copia del tablero', 'El tablero y los accesos actuales se reemplazan por los de la copia. Sus carpetas no se tocan.', 'Elegir la copia…');
    if (!si) return;
    const e = await intentar(() => AF.importar());
    if (!e) return;
    cargarEstado(e);
    aplicarPreferencias();
    renderRail();
    irA('tablero');
    aviso('Tablero recuperado.', 'ok');
  }

  /* ─────────────  Explorar  ───────────── */
  function irAExplorar(ruta, sel) {
    S.vista = 'explorar';
    $$('.rail-btn').forEach((b) => b.classList.toggle('activo', b.dataset.vista === 'explorar'));
    explorar(ruta, { sel });
  }

  async function explorar(ruta, { sinHistorial = false, sel = null } = {}) {
    let datos;
    try {
      datos = await AF.listar(ruta, { ocultos: S.exp.ocultos });
    } catch (err) {
      aviso(String(err.message || err), 'error');
      if (!S.exp.datos) renderTablero();
      return;
    }
    if (!sinHistorial && !mismo(S.exp.hist[S.exp.pos], datos.ruta)) {
      S.exp.hist = S.exp.hist.slice(0, S.exp.pos + 1);
      S.exp.hist.push(datos.ruta);
      S.exp.pos = S.exp.hist.length - 1;
    }
    if (!mismo(S.exp.ruta, datos.ruta)) S.exp.filtro = '';
    S.exp.ruta = datos.ruta;
    S.exp.datos = datos;
    S.exp.sel = sel ? datos.entradas.find((e) => mismo(e.ruta, sel)) || null : null;
    datos.migas.forEach((m) => { if (m.permitido) S.abiertos.add(k(m.ruta)); });
    reciente({ ruta: datos.ruta, nombre: datos.nombre, esCarpeta: true });
    AF.vigilar(datos.ruta).catch(() => {});
    renderExplorar();
  }

  function reciente(e) {
    S.recientes = [{ ruta: e.ruta, nombre: e.nombre || nombreDe(e.ruta), esCarpeta: !!e.esCarpeta, cuando: new Date().toISOString() },
      ...S.recientes.filter((r) => !mismo(r.ruta, e.ruta))].slice(0, 60);
    guardar();
  }

  function entradasVisibles() {
    const x = S.exp;
    let lista = x.datos.entradas;
    if (x.filtro) {
      const q = x.filtro.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      lista = lista.filter((e) => e.nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q));
    }
    const col = new Intl.Collator('es', { numeric: true, sensitivity: 'base' });
    const f = {
      nombre: (a, b) => col.compare(a.nombre, b.nombre),
      modificado: (a, b) => (a.modificado || 0) - (b.modificado || 0),
      tamano: (a, b) => (a.tamano || 0) - (b.tamano || 0),
      tipo: (a, b) => col.compare(a.ext, b.ext) || col.compare(a.nombre, b.nombre),
    }[x.orden];
    return [...lista].sort((a, b) => (b.esCarpeta - a.esCarpeta) || f(a, b) * x.dir);
  }

  function renderExplorar() {
    const x = S.exp, d = x.datos, p = pref();
    const lista = entradasVisibles();
    const nC = lista.filter((e) => e.esCarpeta).length, nA = lista.length - nC;
    const migas = d.migas.map((m, i) => `${i ? `<span class="sep">${SVG.flecha}</span>` : ''}<button type="button" class="miga${i === d.migas.length - 1 ? ' ultima' : ''}" data-r="${h(m.ruta)}" ${m.permitido ? '' : 'disabled title="Sin acceso"'}>${h(m.nombre)}</button>`).join('');
    const flecha = (c) => (x.orden === c ? (x.dir > 0 ? ' ↑' : ' ↓') : '');
    $('#vista').innerHTML = `<div class="explorar${p.vistaPrevia ? '' : ' sin-vista-previa'}">
      <aside class="arbol" id="arbol"></aside>
      <section class="centro">
        <div class="barra-exp">
          <button class="btn-icono sm" id="xAtras" type="button" title="Atrás" ${x.pos > 0 ? '' : 'disabled'}>${SVG.atras}</button>
          <button class="btn-icono sm" id="xAdelante" type="button" title="Adelante" ${x.pos < x.hist.length - 1 ? '' : 'disabled'}>${SVG.adelante}</button>
          <button class="btn-icono sm" id="xArriba" type="button" title="Subir a la supercarpeta" ${d.padre ? '' : 'disabled'}>${SVG.arriba}</button>
          <nav class="migas" aria-label="Ruta">${migas}</nav>
          <button class="btn btn-sm" id="xFijar" type="button" title="Fijar esta carpeta al tablero">${SVG.pin}<span>Fijar al tablero</span></button>
          <button class="btn btn-sm" id="xWindows" type="button" title="Abrir en el Explorador de Windows">${SVG.externo}<span>Explorador</span></button>
        </div>
        <div class="herr">
          <input class="filtro" id="xFiltro" type="search" placeholder="Filtrar en esta carpeta…" value="${h(x.filtro)}">
          <div class="segmento"><button type="button" data-modo="lista" class="${x.modo === 'lista' ? 'activo' : ''}" title="Lista">${SVG.lista}</button><button type="button" data-modo="rejilla" class="${x.modo === 'rejilla' ? 'activo' : ''}" title="Miniaturas">${SVG.rejilla}</button></div>
          <select id="xOrden" title="Ordenar">
            ${[['nombre', 'Nombre'], ['modificado', 'Fecha'], ['tamano', 'Tamaño'], ['tipo', 'Tipo']].map(([v, n]) => `<option value="${v}" ${x.orden === v ? 'selected' : ''}>Ordenar por ${n.toLowerCase()}</option>`).join('')}
          </select>
          <label class="chk"><input type="checkbox" id="xOcultos" ${x.ocultos ? 'checked' : ''}> Ocultos</label>
          <span class="resumen">${plural(nC, 'carpeta', 'carpetas')} · ${plural(nA, 'archivo', 'archivos')}${d.recortado ? ' · se muestran los primeros 20 000' : ''}</span>
        </div>
        <div class="contenido" id="contenido" tabindex="0">
          ${!lista.length ? `<div class="vacio">${svg('carpeta-abierta')}<div>${x.filtro ? 'Nada coincide con el filtro.' : 'Esta carpeta está vacía.'}</div></div>`
            : x.modo === 'lista' ? `<table class="tabla"><thead><tr>
                <th data-orden="nombre">Nombre${flecha('nombre')}</th><th data-orden="modificado">Modificado${flecha('modificado')}</th><th data-orden="tipo">Tipo${flecha('tipo')}</th><th data-orden="tamano" class="der">Tamaño${flecha('tamano')}</th>
              </tr></thead><tbody>${lista.map((e, i) => `<tr class="fila${x.sel && mismo(x.sel.ruta, e.ruta) ? ' sel' : ''}" data-i="${i}" draggable="${e.esCarpeta ? 'false' : 'true'}">
                <td class="nom"><div>${icoEntrada(e)}<span>${h(e.nombre)}</span></div></td><td class="mod">${fecha(e.modificado)}</td><td class="mod">${e.esCarpeta ? 'Carpeta' : h(tipoDe(e.ext).tipo)}</td><td class="tam der num">${e.esCarpeta ? '' : tamano(e.tamano)}</td></tr>`).join('')}</tbody></table>`
            : `<div class="cuadricula">${lista.map((e, i) => `<div class="celda${x.sel && mismo(x.sel.ruta, e.ruta) ? ' sel' : ''}" data-i="${i}" draggable="${e.esCarpeta ? 'false' : 'true'}" title="${h(e.nombre)}">
                <div class="mini">${!e.esCarpeta && tipoDe(e.ext).vista === 'imagen' ? `<img loading="lazy" src="${h(AF.urlArchivo(e.ruta))}" alt="">` : icoEntrada(e)}</div><div class="n">${h(e.nombre)}</div></div>`).join('')}</div>`}
        </div>
      </section>
      ${p.vistaPrevia ? '<aside class="previa" id="previa"></aside>' : ''}
    </div>`;
    renderArbol();
    renderPrevia();
    const nav = $('.migas');
    nav.scrollLeft = nav.scrollWidth;

    $('#xAtras').onclick = () => { if (x.pos > 0) { x.pos--; explorar(x.hist[x.pos], { sinHistorial: true }); } };
    $('#xAdelante').onclick = () => { if (x.pos < x.hist.length - 1) { x.pos++; explorar(x.hist[x.pos], { sinHistorial: true }); } };
    $('#xArriba').onclick = () => d.padre && explorar(d.padre, { sel: d.ruta });
    $$('.miga[data-r]').forEach((b) => { b.onclick = () => explorar(b.dataset.r); });
    $('#xFijar').onclick = () => fijar({ ruta: d.ruta, esCarpeta: true });
    $('#xWindows').onclick = () => intentar(() => AF.abrir(d.ruta));
    const filtro = $('#xFiltro');
    filtro.oninput = () => {
      x.filtro = filtro.value;
      const pos = filtro.selectionStart;
      renderExplorar();
      const f2 = $('#xFiltro');
      f2.focus();
      f2.setSelectionRange(pos, pos);
    };
    $$('[data-modo]').forEach((b) => { b.onclick = () => { x.modo = b.dataset.modo; renderExplorar(); }; });
    $('#xOrden').onchange = (e) => { x.orden = e.target.value; x.dir = 1; renderExplorar(); };
    $$('th[data-orden]').forEach((th) => { th.onclick = () => { if (x.orden === th.dataset.orden) x.dir *= -1; else { x.orden = th.dataset.orden; x.dir = 1; } renderExplorar(); }; });
    $('#xOcultos').onchange = (e) => { x.ocultos = e.target.checked; explorar(d.ruta, { sinHistorial: true }); };

    const cont = $('#contenido');
    const entrada = (ev) => { const el = ev.target.closest('[data-i]'); return el ? lista[+el.dataset.i] : null; };
    cont.onclick = (ev) => { const e = entrada(ev); if (e) seleccionar(e); };
    cont.ondblclick = (ev) => { const e = entrada(ev); if (e) abrirEntrada(e); };
    cont.oncontextmenu = (ev) => { const e = entrada(ev); if (!e) return; ev.preventDefault(); seleccionar(e); menuEntrada(e, ev.clientX, ev.clientY); };
    cont.ondragstart = (ev) => { const e = entrada(ev); if (e && !e.esCarpeta) { ev.preventDefault(); AF.arrastrar(e.ruta); } };
    cont.onkeydown = (ev) => {
      const i = x.sel ? lista.findIndex((e) => mismo(e.ruta, x.sel.ruta)) : -1;
      const paso = x.modo === 'rejilla' ? Math.max(1, Math.floor(cont.clientWidth / 150)) : 1;
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowRight') { ev.preventDefault(); seleccionar(lista[Math.min(lista.length - 1, i + (ev.key === 'ArrowDown' ? paso : 1))]); }
      else if (ev.key === 'ArrowUp' || ev.key === 'ArrowLeft') { ev.preventDefault(); seleccionar(lista[Math.max(0, i - (ev.key === 'ArrowUp' ? paso : 1))]); }
      else if (ev.key === 'Enter' && x.sel) abrirEntrada(x.sel);
      else if (ev.key === 'Backspace' && d.padre) explorar(d.padre, { sel: d.ruta });
    };
    const selEl = $('.sel', cont);
    if (selEl) selEl.scrollIntoView({ block: 'nearest' });
  }

  function seleccionar(e) {
    if (!e) return;
    S.exp.sel = e;
    $$('#contenido .sel').forEach((n) => n.classList.remove('sel'));
    const lista = entradasVisibles();
    const i = lista.findIndex((x) => mismo(x.ruta, e.ruta));
    const el = $(`#contenido [data-i="${i}"]`);
    if (el) { el.classList.add('sel'); el.scrollIntoView({ block: 'nearest' }); }
    renderPrevia();
  }

  function abrirEntrada(e) {
    if (e.esCarpeta) explorar(e.ruta);
    else abrirArchivo(e);
  }

  async function abrirArchivo(e) {
    const r = await intentar(() => AF.abrir(e.ruta), 'No se pudo abrir:');
    if (r) { reciente({ ...e, esCarpeta: false }); aviso('Abriendo «' + (e.nombre || nombreDe(e.ruta)) + '»…'); }
  }

  function menuEntrada(e, x, y) {
    menu(x, y, [
      { titulo: e.nombre },
      e.esCarpeta ? { txt: 'Entrar', ico: SVG.abrir, accion: () => explorar(e.ruta) } : { txt: 'Abrir con su programa', ico: SVG.abrir, accion: () => abrirArchivo(e) },
      e.esCarpeta ? { txt: 'Abrir en el Explorador de Windows', ico: SVG.externo, accion: () => intentar(() => AF.abrir(e.ruta)) } : { txt: 'Mostrar en el Explorador de Windows', ico: SVG.externo, accion: () => intentar(() => AF.mostrar(e.ruta)) },
      { txt: 'Copiar la ruta', ico: SVG.copiar, accion: () => AF.copiarRuta(e.ruta).then(() => aviso('Ruta copiada.', 'ok')) },
      '-',
      { txt: 'Fijar al tablero', ico: SVG.pin, accion: () => fijar(e) },
      ...S.tablero.grupos.slice(0, 6).map((g) => ({ txt: 'Fijar en «' + g.nombre + '»', ico: SVG.grupo, accion: () => fijar(e, g.id) })),
    ]);
  }

  async function renderPrevia() {
    const el = $('#previa');
    if (!el) return;
    const e = S.exp.sel || (S.exp.datos && { nombre: S.exp.datos.nombre, ruta: S.exp.datos.ruta, esCarpeta: true, actual: true });
    if (!e) { el.innerHTML = `<div class="previa-nada">${SVG.ojo}<div>Seleccione un archivo para verlo aquí.</div></div>`; return; }
    const t = e.esCarpeta ? { tipo: 'Carpeta', vista: null } : tipoDe(e.ext);
    const url = AF.urlArchivo(e.ruta);
    let marco = icoEntrada(e);
    if (!e.esCarpeta && t.vista === 'imagen') marco = `<img src="${h(url)}" alt="">`;
    else if (t.vista === 'pdf') marco = `<iframe src="${h(url)}" title="${h(e.nombre)}"></iframe>`;
    else if (t.vista === 'video') marco = `<video src="${h(url)}" controls preload="metadata"></video>`;
    else if (t.vista === 'audio') marco = `<audio src="${h(url)}" controls preload="metadata"></audio>`;
    else if (t.vista === 'texto') marco = '<pre>Cargando…</pre>';
    el.innerHTML = `<div class="previa-cuerpo">
      <div class="previa-marco">${marco}</div>
      <h3>${h(e.nombre)}</h3>
      <dl class="datos" id="pDatos">
        <dt>Tipo</dt><dd>${h(t.tipo)}</dd>
        ${e.esCarpeta ? '' : `<dt>Tamaño</dt><dd>${tamano(e.tamano)}</dd>`}
        ${e.modificado ? `<dt>Modificado</dt><dd>${fecha(e.modificado)}</dd>` : ''}
        <dt>Ruta</dt><dd>${h(e.ruta)}</dd>
      </dl>
      <div class="previa-acc">
        ${e.esCarpeta ? (e.actual ? '' : `<button class="btn btn-sm btn-brass" data-pa="entrar" type="button">${SVG.abrir}<span>Entrar</span></button>`) : `<button class="btn btn-sm btn-brass" data-pa="abrir" type="button">${SVG.abrir}<span>Abrir</span></button>`}
        <button class="btn btn-sm" data-pa="windows" type="button">${SVG.externo}<span>${e.esCarpeta ? 'Explorador' : 'Mostrar en carpeta'}</span></button>
        <button class="btn btn-sm" data-pa="fijar" type="button">${SVG.pin}<span>Fijar</span></button>
        <button class="btn btn-sm" data-pa="copiar" type="button">${SVG.copiar}<span>Copiar ruta</span></button>
      </div></div>`;
    $$('[data-pa]', el).forEach((b) => {
      b.onclick = () => {
        const a = b.dataset.pa;
        if (a === 'entrar') explorar(e.ruta);
        else if (a === 'abrir') abrirArchivo(e);
        else if (a === 'windows') intentar(() => (e.esCarpeta ? AF.abrir(e.ruta) : AF.mostrar(e.ruta)));
        else if (a === 'fijar') fijar(e);
        else AF.copiarRuta(e.ruta).then(() => aviso('Ruta copiada.', 'ok'));
      };
    });
    if (t.vista === 'texto') {
      const r = await AF.texto(e.ruta).catch((err) => ({ texto: String(err.message || err) }));
      const pre = $('.previa-marco pre', el);
      if (pre && S.exp.sel && mismo(S.exp.sel.ruta, e.ruta)) pre.textContent = r.texto + (r.recortado ? '\n\n… (se muestran los primeros 256 KB)' : '');
    }
    if (e.esCarpeta) {
      const [inf] = await AF.info([e.ruta]).catch(() => []);
      const dl = $('#pDatos', el);
      if (inf && inf.existe && dl) dl.insertAdjacentHTML('afterbegin', `<dt>Contiene</dt><dd>${plural(inf.carpetas, 'carpeta', 'carpetas')} · ${plural(inf.archivos, 'archivo', 'archivos')}</dd>`);
    }
  }

  /* Árbol: cada acceso con sus supercarpetas arriba y todas sus subcarpetas abajo */
  async function renderArbol() {
    const el = $('#arbol');
    if (!el) return;
    const actual = S.exp.ruta;
    // Carga las subcarpetas de los nodos abiertos que aún no se conocen
    const pendientes = [];
    const recorrer = (ruta) => {
      if (!S.abiertos.has(k(ruta))) return;
      const subs = S.subs.get(k(ruta));
      if (!subs) pendientes.push(ruta);
      else subs.forEach((s) => recorrer(s.ruta));
    };
    S.accesos.forEach((a) => recorrer(a.ruta));
    if (pendientes.length) {
      await Promise.all(pendientes.map(async (r) => S.subs.set(k(r), await AF.subcarpetas(r).catch(() => []))));
      return renderArbol();
    }
    const nodo = (ruta, nombre, nivel) => {
      const abierto = S.abiertos.has(k(ruta));
      const subs = S.subs.get(k(ruta));
      const sinHijos = subs && !subs.length;
      return `<div class="nodo${abierto ? ' abierto' : ''}">
        <div class="nodo-fila${mismo(ruta, actual) ? ' actual' : ''}" data-r="${h(ruta)}" title="${h(ruta)}">
          <button class="flecha" type="button" data-flecha style="${sinHijos ? 'visibility:hidden' : ''}" aria-label="Expandir">${SVG.flecha}</button>
          <svg class="fic" viewBox="0 0 24 24" aria-hidden="true">${(nivel === 0 ? ICONOS['carpeta-estrella'] : ICONOS.carpeta).d}</svg>
          <span>${h(nombre)}</span>
        </div>
        ${abierto && subs && subs.length ? `<div class="nodo-hijos">${subs.map((s) => nodo(s.ruta, s.nombre, nivel + 1)).join('')}</div>` : ''}
      </div>`;
    };
    el.innerHTML = S.accesos.map((a) => `<div class="arbol-raiz">
        ${(a.supercarpetasVisibles || []).length ? `<div class="supers">${a.supercarpetasVisibles.map((s, i) => `<div class="super-fila${mismo(s.ruta, actual) ? ' actual' : ''}" data-r="${h(s.ruta)}" style="padding-left:${6 + i * 6}px" title="${h(s.ruta)}">${svg(i === 0 ? 'disco' : 'carpeta')}<span>${h(s.nombre)}</span></div>`).join('')}</div>` : ''}
        ${a.existe ? nodo(a.ruta, a.nombre, 0) : `<div class="nodo-fila muted" title="${h(a.ruta)}">${svg('alerta')}<span>${h(a.nombre)} (no se encuentra)</span></div>`}
      </div>`).join('') || '<div class="accesos-vacio">Sin carpetas con acceso.</div>';
    el.onclick = async (ev) => {
      const fila = ev.target.closest('[data-r]');
      if (!fila) return;
      const ruta = fila.dataset.r;
      if (ev.target.closest('[data-flecha]')) {
        if (S.abiertos.has(k(ruta))) S.abiertos.delete(k(ruta));
        else S.abiertos.add(k(ruta));
        renderArbol();
        return;
      }
      S.abiertos.add(k(ruta));
      explorar(ruta);
    };
    const act = $('.nodo-fila.actual,.super-fila.actual', el);
    if (act) act.scrollIntoView({ block: 'nearest' });
  }

  /* ─────────────  Favoritos y recientes  ───────────── */
  function renderFavoritos() {
    const favs = S.tablero.tarjetas.filter((t) => t.favorita);
    $('#vista').innerHTML = `<div class="pagina"><div class="cab"><div class="tit"><div class="eyebrow">Acceso rápido</div><h1>Favoritos</h1><div class="sub">Las tarjetas que usted marcó con estrella.</div></div></div>
      ${favs.length ? `<div id="grupos"><section class="grupo" data-g="__fav"><div class="rejilla">${favs.map(tarjetaHTML).join('')}</div></section></div>`
        : `<div class="vacio">${SVG.estrella}<div>Todavía no hay favoritos. En el tablero, toque los tres puntos de una tarjeta y elija «Marcar como favorita».</div></div>`}</div>`;
    conectarTablero();
    $$('.tarjeta').forEach((t) => t.removeAttribute('draggable'));
    cargarInfo(favs.map((c) => c.ruta));
    cargarHijos();
  }

  function renderRecientes() {
    $('#vista').innerHTML = `<div class="pagina"><div class="cab"><div class="tit"><div class="eyebrow">Historial</div><h1>Recientes</h1><div class="sub">Las carpetas y archivos que abrió desde ARKEN FOLDER.</div></div>
        <div class="acciones">${S.recientes.length ? '<button class="btn" id="bLimpiar" type="button">Borrar el historial</button>' : ''}</div></div>
      ${S.recientes.length ? `<div class="lista">${S.recientes.map((r, i) => `<div class="lista-item" data-i="${i}">${icoEntrada({ esCarpeta: r.esCarpeta, ext: (r.ruta.split('.').pop() || '').toLowerCase() })}<div class="t"><b>${h(r.nombre)}</b><span><bdi>${h(r.ruta)}</bdi></span></div><span class="cuando">${hace(r.cuando)}</span></div>`).join('')}</div>`
        : `<div class="vacio">${svg('reloj')}<div>Aún no ha abierto nada.</div></div>`}</div>`;
    $$('.lista-item').forEach((n) => {
      n.onclick = () => irARuta(S.recientes[+n.dataset.i]);
    });
    if ($('#bLimpiar')) $('#bLimpiar').onclick = () => { S.recientes = []; guardar(); renderRecientes(); };
  }

  function irARuta(r) {
    if (r.esCarpeta) irAExplorar(r.ruta);
    else {
      const carpeta = r.ruta.slice(0, Math.max(r.ruta.lastIndexOf('\\'), r.ruta.lastIndexOf('/'))) || r.ruta;
      irAExplorar(carpeta, r.ruta);
    }
  }

  /* ─────────────  Búsqueda  ───────────── */
  const inputBuscar = $('#buscar');
  const cajaSug = $('#sugerencias');
  let tBuscar = null;
  let sugActual = [];
  let sugIndice = -1;

  const resaltar = (texto, q) => {
    const partes = q.toLowerCase().split(/\s+/).filter(Boolean);
    let s = h(texto);
    partes.forEach((p) => {
      const re = new RegExp('(' + h(p).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      s = s.replace(re, '<mark>$1</mark>');
    });
    return s;
  };

  function pintarSugerencias(q, enDisco, estado) {
    const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const partes = norm(q).split(/\s+/).filter(Boolean);
    const coincide = (s) => partes.every((p) => norm(s).includes(p));
    const enTablero = S.tablero.tarjetas.filter((t) => coincide((t.nombre || '') + ' ' + nombreDe(t.ruta) + ' ' + (t.etiqueta || '') + ' ' + (t.nota || ''))).slice(0, 6);
    sugActual = [
      ...enTablero.map((t) => ({ tipo: 'tarjeta', t })),
      ...(enDisco || []).slice(0, 40).map((r) => ({ tipo: 'disco', r })),
    ];
    let html = '';
    if (enTablero.length) {
      html += '<div class="sug-sec eyebrow">En el tablero</div>' + enTablero.map((t, i) => `<button type="button" class="sug-item" data-s="${i}"><span class="ico-arch" style="background:${h(t.color || pref().acento)}">${svg(t.icono || 'carpeta', 'style="width:15px;height:15px;color:#fff"')}</span><span class="t"><b>${resaltar(t.nombre || nombreDe(t.ruta), q)}</b><span><bdi>${h(t.ruta)}</bdi></span></span></button>`).join('');
    }
    html += `<div class="sug-sec eyebrow">En sus carpetas${estado === 'buscando' ? ' · buscando…' : ''}</div>`;
    if (enDisco && enDisco.length) {
      html += enDisco.slice(0, 40).map((r, j) => `<button type="button" class="sug-item" data-s="${enTablero.length + j}">${icoEntrada(r)}<span class="t"><b>${resaltar(r.nombre, q)}</b><span><bdi>${h(r.carpeta)}</bdi></span></span></button>`).join('');
      if (enDisco.length > 40 || (S.resultados && !S.resultados.completa)) html += '<button type="button" class="sug-item" data-todos><span class="t"><b>Ver todos los resultados</b></span></button>';
    } else if (estado !== 'buscando') html += '<div class="sug-vacio">Nada con ese nombre en sus carpetas.</div>';
    cajaSug.innerHTML = html;
    cajaSug.classList.remove('hide');
    sugIndice = -1;
    $$('[data-s]', cajaSug).forEach((b) => { b.onmousedown = (e) => { e.preventDefault(); elegirSugerencia(+b.dataset.s); }; });
    const todos = $('[data-todos]', cajaSug);
    if (todos) todos.onmousedown = (e) => { e.preventDefault(); cajaSug.classList.add('hide'); irA('resultados'); };
  }

  function elegirSugerencia(i) {
    const s = sugActual[i];
    if (!s) return;
    cajaSug.classList.add('hide');
    inputBuscar.value = '';
    inputBuscar.blur();
    if (s.tipo === 'tarjeta') abrirTarjeta(s.t);
    else if (s.r.esCarpeta) irAExplorar(s.r.ruta);
    else irAExplorar(s.r.carpeta, s.r.ruta);
  }

  inputBuscar.addEventListener('input', () => {
    const q = inputBuscar.value.trim();
    clearTimeout(tBuscar);
    if (S.busqueda) AF.cancelarBusqueda(S.busqueda).catch(() => {});
    if (q.length < 2) { cajaSug.classList.add('hide'); return; }
    pintarSugerencias(q, null, 'buscando');
    tBuscar = setTimeout(async () => {
      const id = uid();
      S.busqueda = id;
      const r = await AF.buscar(id, q).catch(() => ({ resultados: [], completa: true }));
      if (S.busqueda !== id || inputBuscar.value.trim() !== q) return;
      S.resultados = { q, ...r };
      pintarSugerencias(q, r.resultados, 'listo');
    }, 280);
  });
  inputBuscar.addEventListener('keydown', (e) => {
    const items = $$('[data-s]', cajaSug);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      sugIndice = Math.max(0, Math.min(items.length - 1, sugIndice + (e.key === 'ArrowDown' ? 1 : -1)));
      items.forEach((b, i) => b.classList.toggle('activo', i === sugIndice));
      items[sugIndice]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (sugIndice >= 0) elegirSugerencia(+items[sugIndice].dataset.s);
      else if (S.resultados) { cajaSug.classList.add('hide'); irA('resultados'); }
    } else if (e.key === 'Escape') {
      cajaSug.classList.add('hide');
      inputBuscar.blur();
    }
  });
  inputBuscar.addEventListener('blur', () => setTimeout(() => cajaSug.classList.add('hide'), 120));
  inputBuscar.addEventListener('focus', () => { if (inputBuscar.value.trim().length >= 2 && cajaSug.innerHTML) cajaSug.classList.remove('hide'); });

  function renderResultados() {
    const r = S.resultados || { q: '', resultados: [] };
    $('#vista').innerHTML = `<div class="pagina"><div class="cab"><div class="tit"><div class="eyebrow">Búsqueda</div><h1>«${h(r.q)}»</h1><div class="sub">${plural(r.resultados.length, 'resultado', 'resultados')} en sus carpetas${r.motivo ? ' · ' + h(r.motivo) : ''}</div></div></div>
      ${r.resultados.length ? `<div class="lista">${r.resultados.map((x, i) => `<div class="lista-item" data-i="${i}">${icoEntrada(x)}<div class="t"><b>${resaltar(x.nombre, r.q)}</b><span><bdi>${h(x.carpeta)}</bdi></span></div><span class="cuando">${x.esCarpeta ? 'Carpeta' : h(tipoDe(x.ext).tipo)}</span></div>`).join('')}</div>` : '<div class="vacio">Sin resultados.</div>'}</div>`;
    $$('.lista-item').forEach((n) => {
      const x = r.resultados[+n.dataset.i];
      n.onclick = () => (x.esCarpeta ? irAExplorar(x.ruta) : irAExplorar(x.carpeta, x.ruta));
      n.ondblclick = () => !x.esCarpeta && abrirArchivo(x);
    });
  }

  /* ─────────────  Arranque  ───────────── */
  function cargarEstado(e) {
    S.accesos = e.accesos;
    S.tablero = e.tablero;
    S.recientes = e.recientes || [];
    S.sistema = e.sistema || S.sistema;
    completarTablero();
    S.info.clear();
    S.subs.clear();
  }

  async function iniciar() {
    if (!AF) {
      document.body.innerHTML = '<p style="padding:40px">ARKEN FOLDER debe abrirse como programa de Windows.</p>';
      return;
    }
    cargarEstado(await AF.estado());
    $('#version').textContent = 'Versión ' + (S.sistema.version || AF.version);
    aplicarPreferencias();
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (pref().tema === 'sistema') aplicarPreferencias(); });
    renderRail();
    $$('.rail-btn').forEach((b) => { b.onclick = () => irA(b.dataset.vista); });
    $('#btnAcceso').onclick = darAcceso;
    $('#btnPersonalizar').onclick = () => { if (S.vista !== 'tablero') irA('tablero'); personalizar(); };
    $('#btnTema').onclick = () => { pref().tema = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro'; aplicarPreferencias(); guardar(); };
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputBuscar.focus(); inputBuscar.select(); }
      if (e.altKey && e.key === 'ArrowLeft' && S.vista === 'explorar') $('#xAtras')?.click();
      if (e.altKey && e.key === 'ArrowRight' && S.vista === 'explorar') $('#xAdelante')?.click();
    });
    AF.alMenu((accion) => {
      if (accion === 'dar-acceso') darAcceso();
      else if (accion === 'exportar') exportar();
      else if (accion === 'importar') importar();
      else if (accion === 'buscar') inputBuscar.focus();
    });
    AF.alCambiar((ruta) => {
      S.subs.delete(k(ruta));
      if (S.vista === 'explorar' && mismo(S.exp.ruta, ruta) && !$('#capa:not(.hide)')) {
        const sel = S.exp.sel && S.exp.sel.ruta;
        const filtroConFoco = document.activeElement && document.activeElement.id === 'xFiltro';
        if (!filtroConFoco) explorar(ruta, { sinHistorial: true, sel });
      }
    });
    irA('tablero');
    // Refresca los conteos de las tarjetas cuando la ventana vuelve a tener el foco
    window.addEventListener('focus', () => {
      if (S.vista === 'tablero') { S.info.clear(); cargarInfo(S.tablero.tarjetas.map((c) => c.ruta)); }
    });
  }

  window.__arkenFolder = { S, irA, explorar: irAExplorar, darAcceso, renderTablero };
  iniciar();
})();
