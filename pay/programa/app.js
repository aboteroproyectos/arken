/* ARKEN PAY · interfaz.
 * Lee la bitácora de eventos del almacén (app de escritorio: local o nube), reconstruye el estado
 * con el núcleo y presenta las pantallas. Cada acción del usuario se convierte en un evento que el
 * núcleo valida ANTES de enviarlo; si otro usuario escribió primero, se relee y se reintenta.
 */
(function () {
  'use strict';
  const N = window.ArkenPayNucleo;
  const X = window.ArkenPayXml;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $p = (c, dec) => N.formatoPesos(c || 0, dec);
  const LOGO = 'logo.png';

  /* ═══════════ Anfitrión: app de escritorio o navegador (demostración) ═══════════ */
  const host = window.arkenPay || anfitrionNavegador();
  function anfitrionNavegador() {
    // Solo para probar en un navegador: guarda en este navegador. La app real usa el almacén.
    const CLAVE = 'arken-pay-demo-eventos';
    const leerTodo = () => {
      try {
        return JSON.parse(localStorage.getItem(CLAVE) || '[]');
      } catch {
        return [];
      }
    };
    const docs = {};
    return {
      navegador: true,
      version: 'navegador',
      conexion: { info: async () => ({ configurada: true, modo: 'navegador', ubicacion: 'Este navegador (solo demostración)' }), guardar: async () => ({}), probar: async () => ({}) },
      eventos: {
        leer: async (desde) => ({ eventos: leerTodo().filter((e) => e.seq > desde), sinConexion: false }),
        agregar: async (ev) => {
          const l = leerTodo();
          const u = l[l.length - 1];
          if (ev.seq !== l.length + 1 || ev.hashPrevio !== (u ? u.hash : '')) return { conflicto: true };
          l.push(ev);
          try {
            localStorage.setItem(CLAVE, JSON.stringify(l));
          } catch {}
          return { ok: true };
        },
      },
      documentos: { guardar: async (h, b) => ((docs[h] = b), { ok: true }), leer: async (h) => docs[h] || null },
      guardarArchivo: async (nombre, contenido) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
        a.download = nombre;
        a.click();
        return nombre;
      },
    };
  }

  /* ═══════════ Estado de la sesión ═══════════ */
  let E = N.crearEstado();
  let USUARIO = null; // id
  let VISTA = 'tablero';
  let CONEXION = null;
  let SIN_CONEXION = false;
  let sondeo = null;
  const pref = {
    get: (k, d) => {
      try {
        return JSON.parse(localStorage.getItem('arken-pay-' + k)) ?? d;
      } catch {
        return d;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem('arken-pay-' + k, JSON.stringify(v));
      } catch {}
    },
  };
  const hoy = () => N.hoyColombia();
  const yo = () => E.usuarios[USUARIO];
  const tieneRol = (...r) => !!yo() && yo().roles.some((x) => r.includes(x));

  async function cargarTodo() {
    const { eventos, sinConexion } = await host.eventos.leer(0);
    const v = await N.verificarCadena(eventos);
    if (!v.ok) throw new Error('La bitácora no pasó la verificación de integridad: ' + v.motivo + ' No se cargan los datos. Comuníquese con el administrador.');
    E = N.reconstruir(eventos);
    SIN_CONEXION = sinConexion;
  }

  async function sincronizar() {
    const { eventos, sinConexion } = await host.eventos.leer(E.seq);
    SIN_CONEXION = sinConexion;
    if (!eventos.length) return false;
    const nuevo = N.clonarEstado(E);
    for (const ev of eventos) {
      if ((ev.hashPrevio || '') !== nuevo.ultimoHash) throw new Error(`El evento ${ev.seq} no enlaza con el anterior.`);
      if ((await N.hashEvento(ev)) !== ev.hash) throw new Error(`El evento ${ev.seq} fue alterado.`);
      N.aplicar(nuevo, ev);
    }
    E = nuevo;
    return true;
  }

  /** Emite uno o varios eventos en orden. Valida con el núcleo; ante conflicto relee y reintenta. */
  async function emitir(tipo, datos, opciones = {}) {
    for (let intento = 0; intento < 5; intento++) {
      await sincronizar();
      const ev = await N.sellarEvento(E, { tipo, datos, usuario: opciones.usuario ?? USUARIO });
      N.probar(E, ev); // lanza ErrorNegocio con el motivo
      const r = await host.eventos.agregar(ev);
      if (r && r.conflicto) continue;
      N.aplicar(E, ev);
      return ev;
    }
    throw new Error('Otros usuarios están registrando al mismo tiempo. Intente de nuevo.');
  }

  /* ═══════════ Avisos ═══════════ */
  let tToast = null;
  function aviso(msg, malo) {
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.className = 'toast' + (malo ? ' bad' : '');
    t.textContent = msg;
    clearTimeout(tToast);
    tToast = setTimeout(() => t.remove(), malo ? 9000 : 4500);
  }
  const fallo = (e) => aviso(e && e.message ? e.message : String(e), true);

  /* ═══════════ Ventanas ═══════════ */
  function ventana({ titulo, cuerpo, pie, clase = '', alAbrir }) {
    const velo = document.createElement('div');
    velo.className = 'velo';
    velo.innerHTML = `<div class="modal ${clase}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}"><div class="modal-head"><h2>${esc(titulo)}</h2><button class="cerrar" aria-label="Cerrar" data-cerrar>×</button></div><div class="modal-body">${cuerpo}</div>${pie ? `<div class="modal-foot">${pie}</div>` : ''}</div>`;
    const cerrar = () => velo.remove();
    velo.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar]')) cerrar();
    });
    velo.addEventListener('keydown', (e) => e.key === 'Escape' && cerrar());
    document.body.appendChild(velo);
    const m = velo.querySelector('.modal');
    m.cerrar = cerrar;
    if (alAbrir) alAbrir(m);
    const f = m.querySelector('input:not([type=hidden]):not([readonly]),select,textarea');
    if (f) f.focus();
    return m;
  }
  function confirmar(titulo, texto, boton = 'Confirmar') {
    return new Promise((res) => {
      const m = ventana({ titulo, clase: 'angosto', cuerpo: `<p>${texto}</p>`, pie: `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-si>${esc(boton)}</button>` });
      m.querySelector('[data-si]').onclick = () => {
        m.cerrar();
        res(true);
      };
      m.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => res(false)));
    });
  }
  // Electron no implementa window.prompt: se pregunta con una ventana propia.
  function pedirTexto(titulo, pregunta) {
    return new Promise((res) => {
      const m = ventana({ titulo, clase: 'angosto', cuerpo: `<label class="f">${esc(pregunta)}<input name="texto"></label>`, pie: `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-si>Aceptar</button>` });
      m.querySelector('[data-si]').onclick = () => {
        const v = m.querySelector('[name=texto]').value.trim();
        m.cerrar();
        res(v);
      };
      m.querySelectorAll('[data-cerrar]').forEach((b) => b.addEventListener('click', () => res('')));
    });
  }
  /** Lee los campos [name] de un contenedor. */
  function leerForm(raiz) {
    const o = {};
    for (const el of $$('[name]', raiz)) {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') {
        if (el.checked) o[el.name] = el.value;
      } else o[el.name] = el.value.trim();
    }
    return o;
  }
  /** Ejecuta la acción del botón con estado ocupado y reporte de error. */
  async function accion(boton, fn) {
    if (boton) boton.disabled = true;
    try {
      return await fn();
    } catch (e) {
      fallo(e);
      return undefined;
    } finally {
      if (boton) boton.disabled = false;
    }
  }

  const opciones = (lista, sel, vacio) => (vacio !== undefined ? `<option value="">${esc(vacio)}</option>` : '') + lista.map(([v, t]) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(t)}</option>`).join('');
  const nombreCliente = (id) => (E.clientes[id] ? E.clientes[id].razonSocial : '—');
  const codProyecto = (id) => (E.proyectos[id] ? E.proyectos[id].codigo : '—');
  const nombreUsuario = (id) => (E.usuarios[id] ? E.usuarios[id].nombre : id || 'Sistema');
  const tagEstado = (f) => {
    const s = N.estadoFactura(f, hoy());
    return `<span class="tag ${s}">${esc(N.NOMBRE_ESTADO[s])}</span>`;
  };
  const pctTxt = (x) => (x === null || x === undefined ? '—' : (x * 100).toFixed(1).replace('.', ',') + ' %');
  async function sha256Base64(buf) {
    const h = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  const aBase64 = (buf) => {
    let s = '';
    const b = new Uint8Array(buf);
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  async function guardarDocumento(archivo) {
    const buf = await archivo.arrayBuffer();
    const hash = await sha256Base64(buf);
    await host.documentos.guardar(hash, aBase64(buf), archivo.name);
    return { hash, nombre: archivo.name, tipo: archivo.type || '', bytes: buf.byteLength };
  }
  async function abrirDocumento(doc) {
    const b64 = await host.documentos.leer(doc.hash);
    if (!b64) return aviso('El documento no está disponible en este equipo ni en la nube.', true);
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bin], { type: doc.tipo || 'application/octet-stream' }));
    a.download = doc.nombre || doc.hash;
    a.click();
  }

  /* ═══════════ Arranque ═══════════ */
  async function arrancar() {
    document.documentElement.dataset.tema = pref.get('tema', 'claro');
    try {
      CONEXION = await host.conexion.info();
    } catch (e) {
      CONEXION = { configurada: false, error: e.message };
    }
    if (!CONEXION.configurada && host.escritorio) return pantallaConexion();
    try {
      await cargarTodo();
    } catch (e) {
      return pantallaError(e);
    }
    if (!E.iniciado) return pantallaInstalacion();
    pantallaIngreso();
  }

  function marcoIngreso(contenido, ancha) {
    document.body.innerHTML = `<main class="ingreso"><div class="ingreso-caja ${ancha ? 'ancha' : ''}"><div class="ingreso-marca"><img src="${LOGO}" alt=""><div><div class="brand-name" style="color:var(--ink)">ARKEN</div><div class="eyebrow">Pay · Control de facturación y cartera</div></div></div>${contenido}<div class="ingreso-pie">ARKEN PAY ${esc(host.version || '')} · ${esc(CONEXION && CONEXION.ubicacion ? CONEXION.ubicacion : '')}</div></div></main>`;
  }

  function pantallaError(e) {
    marcoIngreso(`<div class="ingreso-cuerpo"><div class="aviso bad">${esc(e.message || e)}</div><button class="btn" id="reintentar">Reintentar</button>${host.escritorio ? '<button class="btn" id="cambiarCx">Cambiar la conexión</button>' : ''}</div>`);
    $('#reintentar').onclick = arrancar;
    if ($('#cambiarCx')) $('#cambiarCx').onclick = pantallaConexion;
  }

  function pantallaConexion() {
    marcoIngreso(
      `<div class="ingreso-cuerpo">
        <h2>Dónde se guardan los datos</h2>
        <p class="muted">Para que varias personas trabajen sobre la misma información, ARKEN PAY usa una base de datos en la nube (Supabase). La guía de instalación explica cómo crearla en 10 minutos.</p>
        <label class="f check"><input type="radio" name="modo" value="nube" checked> Base de datos en la nube (recomendado, varios usuarios)</label>
        <label class="f check"><input type="radio" name="modo" value="local"> Solo este equipo (para probar)</label>
        <div id="cxNube" class="form">
          <label class="f full">Dirección del proyecto<input name="url" placeholder="https://xxxx.supabase.co" autocomplete="off"></label>
          <label class="f full">Clave pública (anon public)<input name="claveAnonima" autocomplete="off"></label>
          <label class="f">Correo de la conexión<input name="correo" type="email" autocomplete="off"></label>
          <label class="f">Contraseña de la conexión<input name="clave" type="password" autocomplete="new-password"></label>
          <p class="ayuda full">La contraseña se guarda cifrada por Windows en este equipo. Cada persona entra luego con su propio usuario de ARKEN PAY.</p>
        </div>
        <div id="cxMsg"></div>
        <button class="btn pri" id="cxGuardar">Conectar</button>
      </div>`,
      true,
    );
    const caja = $('.ingreso-caja');
    $$('input[name=modo]').forEach((r) => (r.onchange = () => $('#cxNube').classList.toggle('hide', leerForm(caja).modo !== 'nube')));
    $('#cxGuardar').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(caja);
        $('#cxMsg').innerHTML = '<div class="aviso info">Probando la conexión…</div>';
        try {
          await host.conexion.guardar(d);
        } catch (e) {
          $('#cxMsg').innerHTML = `<div class="aviso bad">${esc(e.message)}</div>`;
          return;
        }
        arrancar();
      });
  }

  function pantallaInstalacion() {
    marcoIngreso(
      `<div class="ingreso-cuerpo">
        <h2>Primer uso</h2>
        <p class="muted">La base está vacía. Cree el usuario administrador. Él configura la empresa, las resoluciones y los demás usuarios; por control interno, el administrador no registra facturas ni pagos.</p>
        <div class="form">
          <label class="f full">Nombre de la instalación<input name="instalacion" value="ARKEN PAY"></label>
          <label class="f">Su nombre<input name="nombre" autocomplete="name"></label>
          <label class="f">Usuario<input name="usuario" autocomplete="username" placeholder="ej. adolfo"></label>
          <label class="f">Contraseña<input name="clave" type="password" autocomplete="new-password"></label>
          <label class="f">Repita la contraseña<input name="clave2" type="password" autocomplete="new-password"></label>
          <p class="ayuda full">Mínimo 10 caracteres, con letras y números.</p>
        </div>
        <button class="btn pri" id="instalar">Crear administrador</button>
      </div>`,
      true,
    );
    $('#instalar').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm($('.ingreso-caja'));
        if (d.clave !== d.clave2) throw new Error('Las contraseñas no coinciden.');
        N.validarClaveNueva(d.clave);
        const claveHash = await N.derivarClave(d.clave);
        const id = N.nuevoId('u');
        await emitir('sistema.iniciado', { nombre: d.instalacion }, { usuario: '' });
        await emitir('usuario.creado', { id, usuario: d.usuario, nombre: d.nombre, roles: ['administrador'], claveHash }, { usuario: '' });
        aviso('Administrador creado. Ingrese con su usuario.');
        pantallaIngreso();
      });
  }

  function pantallaIngreso() {
    clearInterval(sondeo);
    USUARIO = null;
    marcoIngreso(`<form class="ingreso-cuerpo" id="fIngreso">
        <h2>Ingresar</h2>
        <label class="f">Usuario<input name="usuario" autocomplete="username" value="${esc(pref.get('ultimoUsuario', ''))}"></label>
        <label class="f">Contraseña<input name="clave" type="password" autocomplete="current-password"></label>
        <div id="ingMsg"></div>
        <button class="btn pri" type="submit">Ingresar</button>
        ${host.navegador ? '<div class="aviso warn">Modo demostración en el navegador: los datos quedan solo en este navegador.</div>' : ''}
      </form>`);
    const f = $('#fIngreso');
    if (f.usuario.value) f.clave.focus();
    else f.usuario.focus();
    let intentos = 0;
    f.onsubmit = (ev) => {
      ev.preventDefault();
      accion(f.querySelector('button'), async () => {
        try {
          await sincronizar();
        } catch {}
        const d = leerForm(f);
        const u = Object.values(E.usuarios).find((x) => x.usuario === d.usuario.toLowerCase());
        const ok = u && u.activo && (await N.verificarClave(d.clave, u.claveHash));
        if (!ok) {
          intentos++;
          await new Promise((r) => setTimeout(r, Math.min(8000, 400 * 2 ** intentos)));
          $('#ingMsg').innerHTML = '<div class="aviso bad">Usuario o contraseña incorrectos.</div>';
          return;
        }
        USUARIO = u.id;
        pref.set('ultimoUsuario', u.usuario);
        if (u.debeCambiarClave) return cambiarClave(true);
        entrar();
      });
    };
  }

  function cambiarClave(obligatorio) {
    const m = ventana({
      titulo: obligatorio ? 'Defina su contraseña' : 'Cambiar contraseña',
      clase: 'angosto',
      cuerpo: `${obligatorio ? '<div class="aviso info">El administrador le asignó una contraseña temporal. Defina la suya.</div>' : ''}<div class="form"><label class="f full">Contraseña nueva<input name="c1" type="password" autocomplete="new-password"></label><label class="f full">Repítala<input name="c2" type="password" autocomplete="new-password"></label></div>`,
      pie: `<button class="btn pri" data-ok>Guardar</button>`,
    });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        if (d.c1 !== d.c2) throw new Error('Las contraseñas no coinciden.');
        N.validarClaveNueva(d.c1);
        await emitir('usuario.clave_cambiada', { id: USUARIO, claveHash: await N.derivarClave(d.c1) });
        m.cerrar();
        aviso('Contraseña actualizada.');
        if (obligatorio) entrar();
      });
  }

  /* ═══════════ Estructura principal ═══════════ */
  const VISTAS = [
    ['tablero', 'Tablero'],
    ['facturas', 'Facturas'],
    ['recaudos', 'Recaudos'],
    ['cartera', 'Cartera'],
    ['proyectos', 'Proyectos'],
    ['clientes', 'Clientes'],
    ['retenciones', 'Retenciones'],
    ['conciliacion', 'Conciliación'],
    ['reportes', 'Reportes'],
    ['bitacora', 'Bitácora'],
    ['configuracion', 'Configuración'],
  ];

  function entrar() {
    document.body.innerHTML = `
      <header class="topbar">
        <div class="brand"><img class="brand-mark" src="${LOGO}" alt="ARKEN"><div><div class="brand-name">ARKEN</div><div class="brand-sub">Pay</div></div></div>
        <div class="top-div"></div>
        <div class="top-ctx"><span class="lab">Empresa</span><span class="val" id="topEmpresa"></span></div>
        <div class="top-acc"><span class="pill" id="topCx"></span><span class="pill" id="topUsuario"></span>
          <button class="btn peq" id="btnTema" title="Tema claro u oscuro">◐</button>
          <button class="btn peq" id="btnClave">Contraseña</button>
          <button class="btn peq" id="btnSalir">Salir</button></div>
      </header>
      <div class="ledger" id="ledger"></div>
      <div class="shell"><nav class="rail" aria-label="Secciones"><div class="rail-head"><div class="eyebrow">Control de cartera</div></div><div class="rail-list" id="rail"></div><div class="rail-foot" id="railFoot"></div></nav><main class="stage" id="stage"></main></div>`;
    $('#btnSalir').onclick = pantallaIngreso;
    $('#btnClave').onclick = () => cambiarClave(false);
    $('#btnTema').onclick = () => {
      const t = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
      document.documentElement.dataset.tema = t;
      pref.set('tema', t);
    };
    VISTA = pref.get('vista', 'tablero');
    render();
    clearInterval(sondeo);
    sondeo = setInterval(async () => {
      if (!USUARIO || document.querySelector('.velo')) return;
      try {
        if (await sincronizar()) render();
      } catch (e) {
        SIN_CONEXION = e.message;
        pintarMarco();
      }
    }, 20000);
  }

  function pintarMarco() {
    const u = yo();
    const empresas = Object.values(E.empresas);
    $('#topEmpresa').textContent = empresas.length ? empresas.map((x) => x.razonSocial).join(' · ') : 'Sin empresa configurada';
    $('#topUsuario').textContent = `${u.nombre} · ${u.roles.map((r) => N.ROLES[r].split(' ')[0]).join(', ')}`;
    const cx = $('#topCx');
    cx.textContent = SIN_CONEXION ? 'Sin conexión' : CONEXION.modo === 'nube' ? 'Nube' : CONEXION.modo === 'local' ? 'Solo este equipo' : 'Demostración';
    cx.className = 'pill ' + (SIN_CONEXION ? 'warn' : 'ok');
    cx.title = SIN_CONEXION ? String(SIN_CONEXION) : CONEXION.ubicacion || '';
    // Cinta: año en curso
    const anio = hoy().slice(0, 4);
    const r = N.resumenGeneral(E, { desde: anio + '-01-01', hasta: anio + '-12-31', hoy: hoy() });
    const pctVencido = r.porCobrar ? r.vencido / r.porCobrar : 0;
    $('#ledger').innerHTML = `
      <div class="ledger-cell"><span class="lab">Facturado ${anio}</span><span class="val">${$p(r.facturado)}</span></div>
      <div class="ledger-cell"><span class="lab">Recaudado ${anio}</span><span class="val">${$p(r.recaudado)}</span></div>
      <div class="ledger-cell"><span class="lab">Retenciones ${anio}</span><span class="val">${$p(r.retenido)}</span></div>
      <div class="ledger-cell ${r.vencido ? 'alerta' : ''}"><span class="lab">Vencido</span><span class="val">${$p(r.vencido)}</span></div>
      <div class="ledger-cell grow"><span class="lab">Cartera vencida sobre el total</span><div class="ledger-bar"><i style="width:${Math.min(100, pctVencido * 100).toFixed(1)}%"></i></div></div>
      <div class="ledger-cell total"><span class="lab">Por cobrar</span><span class="val">${$p(r.porCobrar)}</span></div>`;
    const vencidas = Object.values(E.facturas).filter((f) => N.estadoFactura(f, hoy()) === 'vencida').length;
    const pendCert = N.retencionesPendientesCertificado(E).length;
    $('#rail').innerHTML = VISTAS.map(
      ([k, t], i) =>
        `<button class="nav-item ${k === VISTA ? 'active' : ''}" data-vista="${k}"><span class="nav-n">${String(i + 1).padStart(2, '0')}</span><span class="nav-t">${t}</span>${k === 'cartera' && vencidas ? `<span class="nav-badge">${vencidas}</span>` : ''}${k === 'retenciones' && pendCert ? `<span class="nav-badge">${pendCert}</span>` : ''}</button>`,
    ).join('');
    $$('#rail [data-vista]').forEach((b) => (b.onclick = () => ir(b.dataset.vista)));
    $('#railFoot').innerHTML = `<span>${E.seq} eventos en la bitácora</span><span class="cufe">${esc(E.ultimoHash.slice(0, 16))}…</span>`;
  }

  function ir(v) {
    VISTA = v;
    pref.set('vista', v);
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    if (!USUARIO) return;
    pintarMarco();
    const st = $('#stage');
    try {
      st.innerHTML = '';
      (PANTALLAS[VISTA] || PANTALLAS.tablero)(st);
    } catch (e) {
      st.innerHTML = `<div class="aviso bad">${esc(e.message)}</div>`;
      console.error(e);
    }
  }

  const cabeza = (titulo, sub, botones = '') => `<div class="page-head"><div><div class="eyebrow">ARKEN PAY</div><h1>${esc(titulo)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><div class="acciones">${botones}</div></div>`;
  const listo = () => {
    const faltan = [];
    if (!Object.keys(E.empresas).length) faltan.push('la empresa emisora');
    if (!Object.keys(E.resoluciones).length) faltan.push('la resolución de facturación');
    return faltan;
  };

  /* ═══════════ Pantallas ═══════════ */
  const PANTALLAS = {};

  PANTALLAS.tablero = (st) => {
    const h = hoy();
    const anio = h.slice(0, 4);
    const r = N.resumenGeneral(E, { desde: anio + '-01-01', hasta: h, hoy: h });
    const mes = N.resumenGeneral(E, { desde: h.slice(0, 8) + '01', hasta: h, hoy: h });
    const prox = N.vencimientosProximos(E, h, 15);
    const cart = N.carteraPorEdades(E, h);
    const num = N.controlNumeracion(E, h).flatMap((x) => x.alertas);
    const plazo = N.alertasPlazoLegal(E, h);
    const faltan = listo();
    st.innerHTML =
      cabeza('Tablero', `Corte al ${h}`) +
      (faltan.length ? `<div class="aviso warn">Para registrar facturas falta configurar ${faltan.join(' y ')}. ${tieneRol('administrador') ? '<a href="#" data-ir="configuracion">Ir a Configuración</a>' : 'Pídaselo al administrador.'}</div>` : '') +
      num.map((a) => `<div class="aviso warn">${esc(a)}</div>`).join('') +
      (plazo.length ? `<div class="aviso info">${plazo.length} factura(s) a grandes empresas superan 60 días sin pago total (Ley 2024 de 2020, plazos justos a mipymes).</div>` : '') +
      (SIN_CONEXION ? `<div class="aviso warn">Sin conexión con la nube: se muestran los datos guardados en este equipo. No se pueden registrar cambios hasta reconectar.</div>` : '') +
      `<div class="grid g4">
        ${kpi('Facturado este mes', $p(mes.facturado), `${mes.facturas} factura(s)`)}
        ${kpi('Recaudado este mes', $p(mes.recaudado), `más ${$p(mes.retenido)} en retenciones`)}
        ${kpi('Cartera total', $p(r.porCobrar), `${$p(r.vencido)} vencida`)}
        ${kpi('Días promedio de cobro', r.dso === null ? '—' : r.dso + ' días', 'DSO, últimos 90 días')}
      </div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Cartera por edades</h2><button class="btn peq" data-ir="cartera">Ver detalle</button></div><div class="card-body">${barrasEdades(cart)}</div></div>
        <div class="card"><div class="card-head"><h2>Vencen en los próximos 15 días</h2></div><div class="card-body flush">${
          prox.length
            ? `<table class="t"><thead><tr><th>Factura</th><th>Cliente</th><th>Vence</th><th class="right">Saldo</th></tr></thead><tbody>${prox
                .slice(0, 12)
                .map((f) => `<tr class="click" data-factura="${f.id}"><td>${esc(f.consecutivo)}</td><td>${esc(nombreCliente(f.clienteId))}</td><td>${f.fechaVencimiento}</td><td class="right num">${$p(N.totalesFactura(f).saldoExigible)}</td></tr>`)
                .join('')}</tbody></table>`
            : '<div class="vacio">Nada vence en los próximos 15 días.</div>'
        }</div></div>
      </div>
      <div class="card"><div class="card-head"><h2>Clientes con mayor saldo vencido</h2></div><div class="card-body flush">${tablaTopVencidos(cart)}</div></div>`;
    enlazar(st);
  };
  const kpi = (lab, val, det) => `<div class="card kpi"><div class="lab">${lab}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  function barrasEdades(cart) {
    const max = Math.max(1, ...N.TRAMOS.map((t) => cart.totales[t.clave]));
    return `<table class="t"><tbody>${N.TRAMOS.map(
      (t) => `<tr><td style="width:120px">${t.nombre}</td><td><div class="barra"><i style="width:${((cart.totales[t.clave] / max) * 100).toFixed(1)}%;${t.clave === 'por_vencer' ? '' : 'background:var(--bad)'}"></i></div></td><td class="right num" style="width:150px">${$p(cart.totales[t.clave])}</td></tr>`,
    ).join('')}</tbody><tfoot><tr><td>Total</td><td></td><td class="right num">${$p(cart.totales.total)}</td></tr></tfoot></table>`;
  }
  function tablaTopVencidos(cart) {
    const filas = cart.filas.map((f) => ({ ...f, vencido: f.total - f.por_vencer })).filter((f) => f.vencido > 0).sort((a, b) => b.vencido - a.vencido).slice(0, 10);
    if (!filas.length) return '<div class="vacio">No hay cartera vencida.</div>';
    return `<table class="t"><thead><tr><th>Cliente</th><th class="right">Vencido</th><th class="right">Más de 90 días</th><th class="right">Saldo total</th></tr></thead><tbody>${filas
      .map((f) => `<tr class="click" data-cliente="${f.clienteId}"><td>${esc(nombreCliente(f.clienteId))}</td><td class="right num">${$p(f.vencido)}</td><td class="right num">${$p(f.d91_180 + f.d181_360 + f.mas_360)}</td><td class="right num">${$p(f.total)}</td></tr>`)
      .join('')}</tbody></table>`;
  }
  function enlazar(raiz) {
    $$('[data-ir]', raiz).forEach((a) => (a.onclick = (e) => (e.preventDefault(), ir(a.dataset.ir))));
    $$('[data-factura]', raiz).forEach((a) => (a.onclick = () => detalleFactura(a.dataset.factura)));
    $$('[data-cliente]', raiz).forEach((a) => (a.onclick = () => estadoCuenta(a.dataset.cliente)));
    $$('[data-proyecto]', raiz).forEach((a) => (a.onclick = () => formProyecto(a.dataset.proyecto)));
  }

  /* ─────────── Facturas ─────────── */
  PANTALLAS.facturas = (st) => {
    const fil = pref.get('filtroFacturas', { texto: '', estado: '', cliente: '', proyecto: '' });
    const puedeReg = tieneRol('facturacion');
    st.innerHTML =
      cabeza('Facturas', 'Facturas electrónicas emitidas por el proveedor tecnológico y registradas aquí. No se borran ni se editan: se ajustan con notas.', puedeReg ? '<button class="btn pri" id="nuevaFactura">Registrar factura</button><button class="btn" id="nuevaNota">Registrar nota</button>' : '') +
      `<div class="filtros">
        <label class="f">Buscar<input id="fTexto" value="${esc(fil.texto)}" placeholder="Número, cliente, CUFE…"></label>
        <label class="f">Estado<select id="fEstado">${opciones(Object.entries(N.NOMBRE_ESTADO), fil.estado, 'Todos')}</select></label>
        <label class="f">Cliente<select id="fCliente">${opciones(Object.values(E.clientes).map((c) => [c.id, c.razonSocial]), fil.cliente, 'Todos')}</select></label>
        <label class="f">Proyecto<select id="fProyecto">${opciones(Object.values(E.proyectos).map((p) => [p.id, p.codigo + ' · ' + p.nombre]), fil.proyecto, 'Todos')}</select></label>
        <button class="btn" id="fCsv">Exportar</button>
      </div><div class="card"><div class="card-body flush" id="tablaFacturas"></div></div>`;
    const pintar = () => {
      const f = { texto: $('#fTexto').value.trim().toLowerCase(), estado: $('#fEstado').value, cliente: $('#fCliente').value, proyecto: $('#fProyecto').value };
      pref.set('filtroFacturas', f);
      const lista = filtrarFacturas(f);
      let tot = 0,
        sal = 0;
      $('#tablaFacturas').innerHTML = lista.length
        ? `<table class="t"><thead><tr><th>Factura</th><th>Emisión</th><th>Vence</th><th>Cliente</th><th>Proyecto</th><th class="right">Total</th><th class="right">Saldo</th><th>Estado</th></tr></thead><tbody>${lista
            .map((x) => {
              const t = N.totalesFactura(x);
              tot += x.total;
              sal += Math.max(0, t.saldo);
              return `<tr class="click" data-factura="${x.id}"><td><b>${esc(x.consecutivo)}</b></td><td>${x.fechaEmision}</td><td>${x.fechaVencimiento}</td><td>${esc(nombreCliente(x.clienteId))}</td><td>${esc(codProyecto(x.proyectoId))}</td><td class="right num">${$p(x.total)}</td><td class="right num">${$p(t.saldo)}</td><td>${tagEstado(x)}</td></tr>`;
            })
            .join('')}</tbody><tfoot><tr><td colspan="5">${lista.length} factura(s)</td><td class="right num">${$p(tot)}</td><td class="right num">${$p(sal)}</td><td></td></tr></tfoot></table>`
        : '<div class="vacio">No hay facturas con esos filtros.</div>';
      enlazar($('#tablaFacturas'));
    };
    ['#fTexto', '#fEstado', '#fCliente', '#fProyecto'].forEach((s) => ($(s).oninput = pintar));
    pintar();
    if ($('#nuevaFactura')) $('#nuevaFactura').onclick = () => formFactura();
    if ($('#nuevaNota')) $('#nuevaNota').onclick = () => formNota();
    $('#fCsv').onclick = () => exportar('ARKEN_PAY_facturas.csv', libroFacturacion(filtrarFacturas(pref.get('filtroFacturas', {}))));
  };
  function filtrarFacturas(f) {
    const h = hoy();
    return Object.values(E.facturas)
      .filter((x) => !f.cliente || x.clienteId === f.cliente)
      .filter((x) => !f.proyecto || x.proyectoId === f.proyecto)
      .filter((x) => !f.estado || N.estadoFactura(x, h) === f.estado)
      .filter((x) => !f.texto || [x.consecutivo, x.cufe, nombreCliente(x.clienteId), codProyecto(x.proyectoId), x.ordenCompra].join(' ').toLowerCase().includes(f.texto))
      .sort((a, b) => (a.fechaEmision < b.fechaEmision ? 1 : a.fechaEmision > b.fechaEmision ? -1 : b.numero - a.numero));
  }

  /** Formulario de registro de factura: manual o desde el XML de la DIAN. */
  function formFactura() {
    const faltan = listo();
    if (faltan.length) return aviso('Antes de registrar facturas, el administrador debe configurar ' + faltan.join(' y ') + '.', true);
    const empresas = Object.values(E.empresas).filter((x) => x.activa);
    let items = [{ descripcion: '', cantidadMil: 1000, valorUnitario: 0, descuento: 0, ivaPpm: 190000, ivaTipo: 'gravado' }];
    let xml = null; // datos leídos
    let adjuntos = [];
    let xmlHash = '';
    const m = ventana({
      titulo: 'Registrar factura',
      clase: 'ancho',
      cuerpo: `
        <div class="aviso info">Cargue el XML que entrega su proveedor tecnológico (AttachedDocument o Invoice): ARKEN PAY lee el número, el CUFE, el cliente, los ítems y los totales. También puede digitarla.</div>
        <div class="acciones" style="margin-bottom:14px"><label class="btn oro">Cargar XML de la DIAN<input type="file" accept=".xml,application/xml,text/xml" id="xmlArchivo" hidden></label><label class="btn">Adjuntar PDF u otros soportes<input type="file" id="adjArchivo" multiple hidden></label><span id="adjLista" class="muted small"></span></div>
        <div id="xmlMsg"></div>
        <div class="form">
          <label class="f">Empresa emisora<select name="empresaId">${opciones(empresas.map((x) => [x.id, x.razonSocial]), empresas[0] && empresas[0].id)}</select></label>
          <label class="f">Resolución<select name="resolucionId"></select></label>
          <label class="f">Prefijo<input name="prefijo" maxlength="4"></label>
          <label class="f">Número<input name="numero" inputmode="numeric"></label>
          <label class="f full">CUFE<input name="cufe" class="cufe" maxlength="96" placeholder="96 caracteres"></label>
          <label class="f">Cliente<select name="clienteId">${opciones(
            Object.values(E.clientes)
              .filter((c) => c.activo)
              .map((c) => [c.id, c.razonSocial]),
            '',
            'Seleccione…',
          )}</select></label>
          <label class="f">Proyecto<select name="proyectoId"></select></label>
          <label class="f">Fecha de emisión<input name="fechaEmision" type="date" value="${hoy()}"></label>
          <label class="f">Fecha de vencimiento<input name="fechaVencimiento" type="date"></label>
          <label class="f">Forma de pago<select name="formaPago">${opciones([['credito', 'Crédito'], ['contado', 'Contado']], 'credito')}</select></label>
          <label class="f">Orden de compra / contrato<input name="ordenCompra"></label>
        </div>
        <h3 style="margin:18px 0 8px">Ítems</h3>
        <div class="card"><div class="card-body flush" id="itemsTabla"></div></div>
        <div class="grid g2">
          <div>
            <h3 style="margin:6px 0 8px">Retenciones que practicará el cliente <span class="ayuda">(estimadas; las definitivas se registran con el pago)</span></h3>
            <div class="form"><label class="f">Concepto de retención en la fuente<select name="concepto">${opciones(
              E.parametros.conceptosRetencion.map((c) => [c.codigo, `${c.nombre} · ${N.formatoTarifa(c.ppm)}`]),
              '',
              'No aplica',
            )}</select></label><label class="f">&nbsp;<button class="btn" id="sugerirRet" type="button">Calcular retenciones</button></label></div>
            <div id="retTabla" style="margin-top:10px"></div>
            <div class="form" style="margin-top:10px">
              <label class="f">Amortización de anticipo<input name="amortizacion" class="num" value="0"><span class="ayuda" id="antDisp"></span></label>
              <label class="f">Retención de garantía<input name="garantia" class="num" value="0"></label>
              <label class="f">Liberación de la garantía<input name="fechaLiberacionGarantia" type="date"></label>
            </div>
          </div>
          <div><div class="card"><div class="card-body" id="resumenFactura"></div></div></div>
        </div>
        <label class="f">Observaciones<textarea name="observaciones" rows="2"></textarea></label>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Registrar factura</button>',
    });
    let retenciones = [];
    const f = (n) => m.querySelector(`[name=${n}]`);
    const actualizarResoluciones = () => {
      const rs = Object.values(E.resoluciones).filter((r) => r.empresaId === f('empresaId').value);
      f('resolucionId').innerHTML = opciones(rs.map((r) => [r.id, `${r.numero} · ${r.prefijo || 'sin prefijo'} ${r.desde}–${r.hasta}`]), rs[0] && rs[0].id);
      elegirResolucion();
    };
    const elegirResolucion = () => {
      const pre = f('prefijo').value.toUpperCase();
      const num = Number(f('numero').value);
      const r = Object.values(E.resoluciones).find((x) => x.empresaId === f('empresaId').value && x.prefijo === pre && num >= x.desde && num <= x.hasta);
      if (r) f('resolucionId').value = r.id;
      else if (!pre && f('resolucionId').value) f('prefijo').value = E.resoluciones[f('resolucionId').value].prefijo;
    };
    const actualizarProyectos = () => {
      const c = f('clienteId').value;
      const ps = Object.values(E.proyectos).filter((p) => p.clienteId === c && p.estado === 'activo');
      f('proyectoId').innerHTML = opciones(
        ps.map((p) => [p.id, p.codigo + ' · ' + p.nombre]),
        ps.length === 1 ? ps[0].id : '',
        ps.length ? 'Seleccione…' : 'El cliente no tiene proyectos activos',
      );
      const cli = E.clientes[c];
      if (cli && !f('fechaVencimiento').value) f('fechaVencimiento').value = N.sumarDias(f('fechaEmision').value || hoy(), cli.plazoDias);
      actualizarConcepto();
    };
    const actualizarConcepto = () => {
      const p = E.proyectos[f('proyectoId').value];
      const emp = E.empresas[f('empresaId').value];
      const cod = (p && p.conceptoRetencion) || (emp && emp.conceptoRetencion) || '';
      if (cod) f('concepto').value = cod;
      const sf = E.saldosFavor[f('clienteId').value];
      const disp = sf ? (sf.porProyecto[f('proyectoId').value] || 0) + (sf.porProyecto[''] || 0) : 0;
      $('#antDisp', m).textContent = disp ? `Disponible: ${$p(disp)}` : '';
      resumen();
    };
    const pintarItems = () => {
      $('#itemsTabla', m).innerHTML = `<table class="t"><thead><tr><th>Descripción</th><th style="width:90px">Cantidad</th><th style="width:150px">Valor unitario</th><th style="width:120px">Descuento</th><th style="width:150px">IVA</th><th style="width:130px">Base IVA (AIU)</th><th class="right" style="width:140px">Valor</th><th></th></tr></thead><tbody>${items
        .map(
          (it, i) => `<tr data-i="${i}"><td><input data-k="descripcion" value="${esc(it.descripcion)}" ${xml ? 'readonly' : ''}></td><td><input class="num" data-k="cantidad" value="${(it.cantidadMil / 1000).toString().replace('.', ',')}" ${xml ? 'readonly' : ''}></td><td><input class="num" data-k="valorUnitario" value="${N.formatoPesos(it.valorUnitario).replace('$ ', '')}" ${xml ? 'readonly' : ''}></td><td><input class="num" data-k="descuento" value="${N.formatoPesos(it.descuento || 0).replace('$ ', '')}" ${xml ? 'readonly' : ''}></td><td><select data-k="iva" ${xml ? 'disabled' : ''}>${opciones(
            [
              ['g190000', 'Gravado 19 %'],
              ['g50000', 'Gravado 5 %'],
              ['exento', 'Exento (0 %)'],
              ['excluido', 'Excluido'],
            ],
            it.ivaTipo === 'gravado' ? 'g' + it.ivaPpm : it.ivaTipo,
          )}</select></td><td><input class="num" data-k="baseIva" value="${it.baseIva !== undefined ? N.formatoPesos(it.baseIva).replace('$ ', '') : ''}" placeholder="Toda" ${xml ? 'readonly' : ''}></td><td class="right num" data-valor></td><td>${xml ? '' : `<button class="btn peq" data-quitar="${i}" type="button">×</button>`}</td></tr>`,
        )
        .join('')}</tbody></table>${xml ? '' : '<div style="padding:8px 12px"><button class="btn peq" id="agregarItem" type="button">Agregar ítem</button></div>'}`;
      $$('#itemsTabla input, #itemsTabla select', m).forEach((el) => (el.onchange = leerItems));
      $$('[data-quitar]', m).forEach((b) => (b.onclick = () => (items.splice(Number(b.dataset.quitar), 1), items.length || items.push({ descripcion: '', cantidadMil: 1000, valorUnitario: 0, ivaPpm: 190000, ivaTipo: 'gravado' }), pintarItems())));
      if ($('#agregarItem', m)) $('#agregarItem', m).onclick = () => (items.push({ descripcion: '', cantidadMil: 1000, valorUnitario: 0, descuento: 0, ivaPpm: 190000, ivaTipo: 'gravado' }), pintarItems());
      resumen();
    };
    const leerItems = () => {
      if (xml) return;
      $$('#itemsTabla tbody tr', m).forEach((tr) => {
        const it = items[Number(tr.dataset.i)];
        const g = (k) => tr.querySelector(`[data-k=${k}]`).value;
        try {
          it.descripcion = g('descripcion');
          const cant = g('cantidad').replace(/\./g, '').replace(',', '.');
          it.cantidadMil = Math.round(Number(cant) * 1000);
          it.valorUnitario = N.aCentavos(g('valorUnitario'));
          it.descuento = N.aCentavos(g('descuento'));
          const iv = g('iva');
          it.ivaTipo = iv.startsWith('g') ? 'gravado' : iv;
          it.ivaPpm = iv.startsWith('g') ? Number(iv.slice(1)) : 0;
          it.baseIva = g('baseIva') ? N.aCentavos(g('baseIva')) : undefined;
        } catch (e) {
          fallo(e);
        }
      });
      resumen();
    };
    const resumen = () => {
      let c;
      try {
        c = N.calcularFactura(items);
      } catch (e) {
        $('#resumenFactura', m).innerHTML = `<div class="aviso warn">${esc(e.message)}</div>`;
        return null;
      }
      $$('#itemsTabla tbody tr', m).forEach((tr, i) => (tr.querySelector('[data-valor]').textContent = $p(c.lineas[i].neto)));
      const total = xml ? xml.totales.total : c.total;
      const ret = retenciones.reduce((s, r) => s + r.valor, 0);
      let amort = 0,
        gar = 0;
      try {
        amort = N.aCentavos(f('amortizacion').value);
        gar = N.aCentavos(f('garantia').value);
      } catch {}
      const neto = total - ret - amort - gar;
      $('#resumenFactura', m).innerHTML = `<dl class="defs">
        <dt>Subtotal</dt><dd class="num right">${$p(c.subtotal)}</dd>
        <dt>Descuentos</dt><dd class="num right">${$p(-c.descuentos)}</dd>
        <dt>Base antes de IVA</dt><dd class="num right">${$p(c.baseAntesIva)}</dd>
        <dt>IVA</dt><dd class="num right">${$p(xml ? xml.totales.iva : c.iva)}</dd>
        <dt><b>Total factura</b></dt><dd class="num right"><b>${$p(total)}</b></dd>
        <dt>Retenciones estimadas</dt><dd class="num right">${$p(-ret)}</dd>
        <dt>Anticipo amortizado</dt><dd class="num right">${$p(-amort)}</dd>
        <dt>Garantía retenida</dt><dd class="num right">${$p(-gar)}</dd>
        <dt><b>Neto a recibir</b></dt><dd class="num right"><b>${$p(neto)}</b></dd></dl>
        ${xml && Math.abs(xml.totales.total - c.total) > 100 ? `<div class="aviso bad" style="margin-top:10px">El total del XML (${$p(xml.totales.total)}) no cuadra con la suma de los ítems (${$p(c.total)}).</div>` : ''}`;
      return c;
    };
    const pintarRet = () => {
      $('#retTabla', m).innerHTML = retenciones.length
        ? `<table class="t"><thead><tr><th>Tipo</th><th class="right">Base</th><th class="right">Tarifa</th><th class="right">Valor</th></tr></thead><tbody>${retenciones
            .map((r, i) => `<tr><td>${{ renta: 'Retención en la fuente', iva: 'ReteIVA', ica: 'ReteICA' }[r.tipo]}</td><td class="right num">${$p(r.base)}</td><td class="right num">${N.formatoTarifa(r.ppm)}</td><td><input class="num" data-ret="${i}" value="${N.formatoPesos(r.valor).replace('$ ', '')}"></td></tr>`)
            .join('')}</tbody></table>`
        : '<div class="muted small">Sin retenciones estimadas.</div>';
      $$('[data-ret]', m).forEach(
        (el) =>
          (el.onchange = () => {
            try {
              retenciones[Number(el.dataset.ret)].valor = N.aCentavos(el.value);
              resumen();
            } catch (e) {
              fallo(e);
            }
          }),
      );
      resumen();
    };
    const calcularRet = () => {
      const c = resumen();
      if (!c || !f('clienteId').value) return;
      const emp = E.empresas[f('empresaId').value];
      const r = N.sugerirRetenciones(E, { clienteId: f('clienteId').value, fecha: f('fechaEmision').value, baseAntesIva: c.baseAntesIva, iva: xml ? xml.totales.iva : c.iva, conceptoRetencion: f('concepto').value, icaPpm: emp ? emp.icaPpm : 0 });
      retenciones = r.retenciones;
      pintarRet();
      if (r.avisos.length) aviso(r.avisos.join(' '));
      const p = E.proyectos[f('proyectoId').value];
      if (p && p.garantiaPpm && N.aCentavos(f('garantia').value) === 0) f('garantia').value = N.formatoPesos(N.aplicarTarifa(c.baseAntesIva, p.garantiaPpm)).replace('$ ', '');
      resumen();
    };
    f('empresaId').onchange = actualizarResoluciones;
    f('prefijo').onchange = f('numero').onchange = elegirResolucion;
    f('clienteId').onchange = actualizarProyectos;
    f('proyectoId').onchange = actualizarConcepto;
    f('amortizacion').onchange = f('garantia').onchange = resumen;
    $('#sugerirRet', m).onclick = calcularRet;
    actualizarResoluciones();
    actualizarProyectos();
    pintarItems();
    pintarRet();

    $('#adjArchivo', m).onchange = (ev) =>
      accion(null, async () => {
        for (const a of ev.target.files) adjuntos.push(await guardarDocumento(a));
        $('#adjLista', m).textContent = adjuntos.map((a) => a.nombre).join(', ');
      });

    $('#xmlArchivo', m).onchange = (ev) =>
      accion(null, async () => {
        const archivo = ev.target.files[0];
        if (!archivo) return;
        const texto = await archivo.text();
        let d;
        try {
          d = X.leer(texto);
        } catch (e) {
          $('#xmlMsg', m).innerHTML = `<div class="aviso bad">${esc(e.message)}</div>`;
          return;
        }
        if (d.clase !== 'factura') {
          $('#xmlMsg', m).innerHTML = `<div class="aviso bad">El XML es una nota ${d.clase}. Regístrela con «Registrar nota».</div>`;
          return;
        }
        const msgs = [...d.avisos];
        if (d.ambiente === 'pruebas') msgs.push('El XML es del ambiente de PRUEBAS de la DIAN: no tiene validez fiscal.');
        if (d.validacionDian && d.validacionDian.codigo && d.validacionDian.codigo !== '02') msgs.push(`Respuesta de la DIAN: ${d.validacionDian.codigo} ${d.validacionDian.descripcion}`);
        // Empresa emisora por NIT
        const emp = Object.values(E.empresas).find((x) => x.nit === N.limpiarNit(d.emisor && d.emisor.documento));
        if (!emp) {
          $('#xmlMsg', m).innerHTML = `<div class="aviso bad">El emisor del XML (NIT ${esc(d.emisor && d.emisor.documento)}, ${esc(d.emisor && d.emisor.razonSocial)}) no es una empresa configurada en ARKEN PAY.</div>`;
          return;
        }
        f('empresaId').value = emp.id;
        actualizarResoluciones();
        // Resolución: si no está registrada y el XML trae los datos, se ofrece registrarla
        let res = Object.values(E.resoluciones).find((r) => r.empresaId === emp.id && r.prefijo === d.prefijo && Number(d.numero) >= r.desde && Number(d.numero) <= r.hasta);
        if (!res && d.resolucion && d.resolucion.numero) {
          const si = await confirmar('Resolución nueva', `La factura usa la resolución ${esc(d.resolucion.numero)} (prefijo ${esc(d.resolucion.prefijo || '—')}, del ${d.resolucion.desde} al ${d.resolucion.hasta}, vigente hasta ${esc(d.resolucion.vigenciaHasta)}), que no está registrada. ¿Registrarla con estos datos?`, 'Registrar resolución');
          if (si) {
            const id = N.nuevoId('res');
            await emitir('resolucion.registrada', { id, empresaId: emp.id, numero: d.resolucion.numero, fecha: d.resolucion.vigenciaDesde, prefijo: d.resolucion.prefijo || '', desde: d.resolucion.desde, hasta: d.resolucion.hasta, vigenciaDesde: d.resolucion.vigenciaDesde, vigenciaHasta: d.resolucion.vigenciaHasta });
            actualizarResoluciones();
            res = E.resoluciones[id];
          }
        }
        // Cliente por documento
        let cli = d.cliente && Object.values(E.clientes).find((c) => c.documento === (c.tipoDocumento === 'NIT' ? N.limpiarNit(d.cliente.documento) : d.cliente.documento));
        if (!cli && d.cliente) {
          const si = await confirmar('Cliente nuevo', `El cliente ${esc(d.cliente.razonSocial)} (${esc(d.cliente.tipoDocumento)} ${esc(d.cliente.documento)}) no está registrado. ¿Crearlo con los datos del XML? Después revise si es agente retenedor.`, 'Crear cliente');
          if (si) cli = await crearClienteDesdeXml(d.cliente);
        }
        f('clienteId').innerHTML = opciones(
          Object.values(E.clientes)
            .filter((c) => c.activo)
            .map((c) => [c.id, c.razonSocial]),
          cli ? cli.id : '',
          'Seleccione…',
        );
        xml = d;
        xmlHash = (await guardarDocumento(archivo)).hash;
        f('prefijo').value = d.prefijo;
        f('numero').value = d.numero;
        f('cufe').value = d.cufe;
        f('fechaEmision').value = d.fechaEmision;
        f('fechaVencimiento').value = d.fechaVencimiento || '';
        f('formaPago').value = d.formaPago;
        f('ordenCompra').value = d.ordenCompra || '';
        f('observaciones').value = d.notas.join(' ').slice(0, 1000);
        ['prefijo', 'numero', 'cufe', 'fechaEmision', 'empresaId'].forEach((n) => (f(n).readOnly = true));
        items = d.items.map((it) => ({ ...it }));
        actualizarProyectos();
        if (res) f('resolucionId').value = res.id;
        if (d.fechaVencimiento) f('fechaVencimiento').value = d.fechaVencimiento;
        pintarItems();
        if (d.retenciones.length) {
          retenciones = d.retenciones.filter((r) => ['renta', 'iva', 'ica'].includes(r.tipo)).map((r) => ({ tipo: r.tipo, base: r.base || 0, ppm: r.ppm, valor: r.valor || 0 }));
          pintarRet();
        } else calcularRet();
        $('#xmlMsg', m).innerHTML = `<div class="aviso ok">XML leído: factura ${esc(d.id)} por ${$p(d.totales.total)}.${msgs.length ? '<br>' + msgs.map(esc).join('<br>') : ''}</div>`;
      });

    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        leerItems();
        const d = leerForm(m);
        if (!d.proyectoId) throw new Error('Toda factura debe asignarse a un proyecto.');
        const datos = {
          id: N.nuevoId('fac'),
          empresaId: d.empresaId,
          clienteId: d.clienteId,
          proyectoId: d.proyectoId,
          resolucionId: d.resolucionId,
          prefijo: d.prefijo,
          numero: Number(d.numero),
          cufe: d.cufe,
          fechaEmision: d.fechaEmision,
          horaEmision: xml ? xml.horaEmision : '',
          fechaVencimiento: d.fechaVencimiento,
          formaPago: d.formaPago,
          medioPago: xml ? xml.medioPago : '',
          moneda: xml ? xml.moneda : 'COP',
          trm: xml ? xml.trm : null,
          ordenCompra: d.ordenCompra,
          observaciones: d.observaciones,
          items: items.map(({ neto, ...it }) => it),
          totalesXml: xml ? { total: xml.totales.total, iva: xml.totales.iva } : undefined,
          retencionesEsperadas: retenciones,
          amortizacionAnticipo: N.aCentavos(d.amortizacion),
          retencionGarantia: N.aCentavos(d.garantia),
          fechaLiberacionGarantia: d.fechaLiberacionGarantia,
          xmlHash,
          adjuntos: [...(xmlHash ? [{ hash: xmlHash, nombre: 'factura.xml', tipo: 'application/xml' }] : []), ...adjuntos],
          origen: xml ? 'xml' : 'manual',
        };
        const evf = await emitir('factura.registrada', datos);
        m.cerrar();
        aviso(`Factura ${E.facturas[evf.datos.id].consecutivo} registrada.`);
        render();
      });
  }

  async function crearClienteDesdeXml(c) {
    const tipo = c.tipoDocumento === 'otro' ? 'NIT' : c.tipoDocumento;
    const doc = tipo === 'NIT' ? N.limpiarNit(c.documento) : c.documento;
    const id = N.nuevoId('cli');
    await emitir('cliente.registrado', { id, tipoDocumento: tipo, documento: doc, dv: tipo === 'NIT' ? N.digitoVerificacion(doc) : undefined, razonSocial: c.razonSocial, municipio: c.municipio, plazoDias: 30, contactos: c.correo ? [{ nombre: '', correo: c.correo }] : [] });
    aviso(`Cliente ${c.razonSocial} creado. Revise en Clientes si practica retenciones.`);
    return E.clientes[id];
  }

  function detalleFactura(id) {
    const f = E.facturas[id];
    const t = N.totalesFactura(f);
    const p = E.proyectos[f.proyectoId];
    const r = E.resoluciones[f.resolucionId];
    const movs = [
      ...f.notasCredito.map((n) => [n.fecha, `Nota crédito ${n.prefijo}${n.numero} (concepto ${n.concepto})`, -n.valor]),
      ...f.notasDebito.map((n) => [n.fecha, `Nota débito ${n.prefijo}${n.numero}`, n.valor]),
      ...f.aplicaciones.map((a) => [a.fecha, `Pago${a.reversado ? ' (REVERSADO)' : ''} · ${E.recaudos[a.recaudoId] ? E.recaudos[a.recaudoId].cuenta + ' ' + E.recaudos[a.recaudoId].referencia : ''}`, a.reversado ? 0 : -a.valor]),
      ...f.retenciones.map((x) => [x.fecha, `Retención ${x.tipo}${x.reversado ? ' (REVERSADA)' : ''}${x.certificado ? ' · certificada' : ' · sin certificado'}`, x.reversado ? 0 : -x.valor]),
      ...f.saldoFavorAplicado.map((s) => [s.fecha, s.motivo, -s.valor]),
    ].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const m = ventana({
      titulo: `Factura ${f.consecutivo}`,
      clase: 'ancho',
      cuerpo: `
        <div class="grid g3">
          <div><dl class="defs"><dt>Estado</dt><dd>${tagEstado(f)}</dd><dt>Cliente</dt><dd><a href="#" data-cliente="${f.clienteId}">${esc(nombreCliente(f.clienteId))}</a></dd><dt>Proyecto</dt><dd>${esc(p.codigo)} · ${esc(p.nombre)}</dd><dt>Emitida</dt><dd>${f.fechaEmision} ${esc(f.horaEmision)}</dd><dt>Vence</dt><dd>${f.fechaVencimiento}</dd><dt>Forma de pago</dt><dd>${f.formaPago === 'contado' ? 'Contado' : 'Crédito'}</dd>${f.ordenCompra ? `<dt>Orden / contrato</dt><dd>${esc(f.ordenCompra)}</dd>` : ''}</dl></div>
          <div><dl class="defs"><dt>Empresa</dt><dd>${esc(E.empresas[f.empresaId].razonSocial)}</dd><dt>Resolución</dt><dd>${esc(r ? r.numero : '—')}</dd><dt>Origen</dt><dd>${f.origen === 'xml' ? 'XML DIAN' : 'Digitada'}</dd><dt>Registrada por</dt><dd>${esc(nombreUsuario(f.registradaPor))}<br><span class="small muted">${esc(f.registradaEl)}</span></dd></dl><div class="cufe" style="margin-top:8px">CUFE ${esc(f.cufe)}</div></div>
          <div class="card"><div class="card-body"><dl class="defs"><dt>Total factura</dt><dd class="num right">${$p(f.total)}</dd><dt>Notas débito</dt><dd class="num right">${$p(t.notasDebito)}</dd><dt>Notas crédito</dt><dd class="num right">${$p(-t.notasCredito)}</dd><dt>Recaudado</dt><dd class="num right">${$p(-t.recaudado)}</dd><dt>Retenciones</dt><dd class="num right">${$p(-t.retenido)}</dd><dt>Anticipos / saldo a favor</dt><dd class="num right">${$p(-t.saldoFavorAplicado)}</dd><dt><b>Saldo</b></dt><dd class="num right"><b>${$p(t.saldo)}</b></dd>${t.garantiaPendiente ? `<dt>de ello, garantía</dt><dd class="num right">${$p(t.garantiaPendiente)}</dd>` : ''}<dt>Neto esperado</dt><dd class="num right">${$p(f.netoEsperado)}</dd></dl></div></div>
        </div>
        <h3 style="margin:16px 0 8px">Ítems</h3>
        <div class="card"><div class="card-body flush"><table class="t"><thead><tr><th>Descripción</th><th class="right">Cantidad</th><th class="right">Valor unitario</th><th class="right">Descuento</th><th class="right">IVA</th><th class="right">Valor</th></tr></thead><tbody>${f.lineas
          .map((l) => `<tr><td>${esc(l.descripcion)}</td><td class="right num">${(l.cantidadMil / 1000).toLocaleString('es-CO')}</td><td class="right num">${$p(l.valorUnitario)}</td><td class="right num">${$p(l.descuento || 0)}</td><td class="right num">${l.ivaTipo === 'gravado' ? N.formatoTarifa(l.ivaPpm) : l.ivaTipo}</td><td class="right num">${$p(l.neto)}</td></tr>`)
          .join('')}</tbody><tfoot><tr><td colspan="4">Base ${$p(f.baseAntesIva)} · IVA ${$p(f.iva)}</td><td></td><td class="right num">${$p(f.total)}</td></tr></tfoot></table></div></div>
        <div class="grid g2">
          <div><h3 style="margin:6px 0 8px">Movimientos</h3><div class="card"><div class="card-body flush">${
            movs.length ? `<table class="t"><tbody>${movs.map((x) => `<tr><td>${x[0]}</td><td>${esc(x[1])}</td><td class="right num">${$p(x[2])}</td></tr>`).join('')}</tbody></table>` : '<div class="vacio">Sin movimientos.</div>'
          }</div></div></div>
          <div><h3 style="margin:6px 0 8px">Retenciones esperadas · eventos DIAN (RADIAN)</h3><div class="card"><div class="card-body">${
            f.retencionesEsperadas.map((x) => `<div>${{ renta: 'Retención en la fuente', iva: 'ReteIVA', ica: 'ReteICA' }[x.tipo]}: <span class="num">${$p(x.valor)}</span></div>`).join('') || '<div class="muted">Sin retenciones esperadas.</div>'
          }<hr style="border:0;border-top:1px solid var(--line-soft)">${f.radian.eventos.map((x) => `<div>${x.fecha} · ${esc(x.nombre)}</div>`).join('') || '<div class="muted">Sin eventos registrados.</div>'}</div></div>
          ${f.adjuntos.length ? `<h3 style="margin:12px 0 8px">Soportes</h3>${f.adjuntos.map((a, i) => `<button class="btn peq" data-adj="${i}">${esc(a.nombre)}</button> `).join('')}` : ''}
          ${f.reclasificaciones.length ? `<h3 style="margin:12px 0 8px">Reclasificaciones</h3>${f.reclasificaciones.map((x) => `<div class="small">${esc(x.fecha.slice(0, 10))}: ${esc(codProyecto(x.de))} → ${esc(codProyecto(x.a))} · ${esc(x.motivo)} (${esc(nombreUsuario(x.por))})</div>`).join('')}` : ''}
          </div>
        </div>`,
      pie: `${tieneRol('facturacion', 'tesoreria') ? '<button class="btn" data-a="radian">Evento DIAN</button>' : ''}${tieneRol('facturacion') && !f.anulada ? '<button class="btn" data-a="nota">Registrar nota</button>' : ''}${tieneRol('tesoreria') && t.saldo > 0 ? '<button class="btn" data-a="favor">Aplicar anticipo / saldo a favor</button><button class="btn pri" data-a="pago">Registrar pago</button>' : ''}${tieneRol('aprobador') ? '<button class="btn" data-a="reclasificar">Reclasificar proyecto</button>' : ''}`,
    });
    enlazar(m);
    $$('[data-adj]', m).forEach((b) => (b.onclick = () => abrirDocumento(f.adjuntos[Number(b.dataset.adj)])));
    const a = (k, fn) => m.querySelector(`[data-a=${k}]`) && (m.querySelector(`[data-a=${k}]`).onclick = () => (m.cerrar(), fn()));
    a('nota', () => formNota(f.id));
    a('pago', () => formRecaudo(f.clienteId, f.id));
    a('radian', () => formRadian(f.id));
    a('favor', () => formSaldoFavor(f.id));
    a('reclasificar', () => formReclasificar(f.id));
  }

  function formNota(facturaId) {
    let xml = null,
      xmlHash = '';
    const facts = Object.values(E.facturas).filter((f) => !f.anulada);
    const m = ventana({
      titulo: 'Registrar nota crédito o débito',
      cuerpo: `<div class="aviso info">Las notas se emiten en el proveedor tecnológico, referidas al CUFE de la factura. Aquí se registran para ajustar el saldo. Una anulación es una nota crédito por el total con concepto 2.</div>
        <div class="acciones" style="margin-bottom:12px"><label class="btn oro">Cargar XML de la nota<input type="file" accept=".xml" id="xmlNota" hidden></label></div><div id="notaMsg"></div>
        <div class="form">
          <label class="f">Clase<select name="clase">${opciones([['credito', 'Nota crédito'], ['debito', 'Nota débito']], 'credito')}</select></label>
          <label class="f">Factura<select name="facturaId">${opciones(
            facts.map((f) => [f.id, `${f.consecutivo} · ${nombreCliente(f.clienteId)}`]),
            facturaId || '',
            'Seleccione…',
          )}</select></label>
          <label class="f">Prefijo<input name="prefijo" maxlength="6"></label>
          <label class="f">Número<input name="numero"></label>
          <label class="f full">CUDE<input name="cude" class="cufe" maxlength="96"></label>
          <label class="f">Fecha<input name="fecha" type="date" value="${hoy()}"></label>
          <label class="f">Concepto de corrección DIAN<select name="concepto"></select></label>
          <label class="f">Valor total de la nota (con IVA)<input name="valor" class="num"></label>
          <label class="f">de ello, IVA<input name="iva" class="num" value="0"></label>
          <label class="f full">Descripción<input name="descripcion"></label>
        </div>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Registrar nota</button>',
    });
    const f = (n) => m.querySelector(`[name=${n}]`);
    const CONC = {
      credito: [['1', '1 · Devolución parcial'], ['2', '2 · Anulación de factura'], ['3', '3 · Rebaja o descuento'], ['4', '4 · Ajuste de precio'], ['5', '5 · Descuento comercial por pronto pago'], ['6', '6 · Descuento comercial por volumen']],
      debito: [['1', '1 · Intereses'], ['2', '2 · Gastos por cobrar'], ['3', '3 · Cambio del valor'], ['4', '4 · Otros']],
    };
    const pintarConc = () => (f('concepto').innerHTML = opciones(CONC[f('clase').value], ''));
    f('clase').onchange = pintarConc;
    pintarConc();
    $('#xmlNota', m).onchange = (ev) =>
      accion(null, async () => {
        const archivo = ev.target.files[0];
        const d = X.leer(await archivo.text());
        if (d.clase === 'factura') throw new Error('Ese XML es una factura, no una nota.');
        const fac = d.referencia && Object.values(E.facturas).find((x) => x.cufe === d.referencia.cufe || x.consecutivo === d.referencia.id);
        if (!fac) throw new Error(`La nota se refiere a la factura ${d.referencia ? d.referencia.id : '(sin referencia)'}, que no está registrada.`);
        xml = d;
        xmlHash = (await guardarDocumento(archivo)).hash;
        f('clase').value = d.clase;
        pintarConc();
        f('facturaId').value = fac.id;
        f('prefijo').value = d.prefijo;
        f('numero').value = d.numero;
        f('cude').value = d.cufe;
        f('fecha').value = d.fechaEmision;
        f('concepto').value = d.concepto;
        f('valor').value = N.formatoPesos(d.totales.total).replace('$ ', '');
        f('iva').value = N.formatoPesos(d.totales.iva).replace('$ ', '');
        f('descripcion').value = d.descripcionConcepto;
        $('#notaMsg', m).innerHTML = `<div class="aviso ok">XML leído: nota ${esc(d.id)} por ${$p(d.totales.total)} a la factura ${esc(fac.consecutivo)}.</div>`;
      });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        if (d.concepto === '2' && !(await confirmar('Anular factura', 'La nota con concepto 2 anula la factura. Esto no se puede deshacer. ¿Continuar?', 'Anular'))) return;
        await emitir('nota.registrada', { id: N.nuevoId('nota'), clase: d.clase, facturaId: d.facturaId, prefijo: d.prefijo, numero: d.numero, cude: d.cude, fecha: d.fecha, concepto: d.concepto, valor: N.aCentavos(d.valor), iva: N.aCentavos(d.iva), descripcion: d.descripcion, xmlHash });
        m.cerrar();
        aviso('Nota registrada.');
        render();
      });
  }

  function formRadian(facturaId) {
    const m = ventana({
      titulo: 'Registrar evento DIAN (RADIAN)',
      clase: 'angosto',
      cuerpo: `<div class="form"><label class="f full">Evento<select name="codigo">${opciones(
        [
          ['030', '030 · Acuse de recibo'],
          ['032', '032 · Recibo del bien o servicio'],
          ['033', '033 · Aceptación expresa'],
          ['034', '034 · Aceptación tácita'],
          ['031', '031 · Reclamo'],
        ],
        '030',
      )}</select></label><label class="f">Fecha<input name="fecha" type="date" value="${hoy()}"></label><label class="f full">CUDE del evento (opcional)<input name="cude" class="cufe"></label><label class="f full">Detalle<input name="detalle"></label></div><p class="ayuda">La aceptación (expresa, o tácita a los 3 días hábiles del recibo sin reclamo) convierte la factura en título valor, lo que permite endosarla o cobrarla ejecutivamente.</p>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Registrar</button>',
    });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        await emitir('factura.evento_radian', { facturaId, ...leerForm(m) });
        m.cerrar();
        aviso('Evento registrado.');
        render();
      });
  }

  function formSaldoFavor(facturaId) {
    const f = E.facturas[facturaId];
    const sf = E.saldosFavor[f.clienteId] || { porProyecto: {} };
    const ant = sf.porProyecto[f.proyectoId] || 0;
    const fav = sf.porProyecto[''] || 0;
    const m = ventana({
      titulo: `Aplicar anticipo o saldo a favor · ${f.consecutivo}`,
      clase: 'angosto',
      cuerpo: `<p>Anticipo del proyecto disponible: <b class="num">${$p(ant)}</b><br>Saldo a favor general del cliente: <b class="num">${$p(fav)}</b><br>Saldo de la factura: <b class="num">${$p(N.totalesFactura(f).saldo)}</b></p><div class="form"><label class="f">Desde<select name="desde">${opciones([['anticipo', 'Anticipo del proyecto'], ['saldo_favor', 'Saldo a favor']], ant ? 'anticipo' : 'saldo_favor')}</select></label><label class="f">Valor<input name="valor" class="num"></label><label class="f">Fecha<input name="fecha" type="date" value="${hoy()}"></label></div>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Aplicar</button>',
    });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        await emitir('saldo_favor.aplicado', { facturaId, desde: d.desde, valor: N.aCentavos(d.valor), fecha: d.fecha });
        m.cerrar();
        aviso('Aplicado.');
        render();
      });
  }

  function formReclasificar(facturaId) {
    const f = E.facturas[facturaId];
    const ps = Object.values(E.proyectos).filter((p) => p.clienteId === f.clienteId && p.id !== f.proyectoId);
    const m = ventana({
      titulo: `Reclasificar proyecto · ${f.consecutivo}`,
      clase: 'angosto',
      cuerpo: `<p>Proyecto actual: <b>${esc(codProyecto(f.proyectoId))}</b>. El cambio queda en la bitácora con su motivo; quien registró la factura no puede aprobarlo.</p><div class="form"><label class="f full">Proyecto nuevo<select name="proyectoId">${opciones(
        ps.map((p) => [p.id, p.codigo + ' · ' + p.nombre]),
        '',
        'Seleccione…',
      )}</select></label><label class="f full">Motivo<input name="motivo"></label></div>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Reclasificar</button>',
    });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        await emitir('factura.reclasificada', { facturaId, ...leerForm(m) });
        m.cerrar();
        aviso('Factura reclasificada.');
        render();
      });
  }

  /* ─────────── Recaudos ─────────── */
  PANTALLAS.recaudos = (st) => {
    const lista = Object.values(E.recaudos).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    st.innerHTML =
      cabeza('Recaudos', 'Pagos recibidos, abonos, anticipos y las retenciones que el cliente practicó.', tieneRol('tesoreria') ? '<button class="btn pri" id="nuevoRecaudo">Registrar recaudo</button>' : '') +
      `<div class="card"><div class="card-body flush">${
        lista.length
          ? `<table class="t"><thead><tr><th>Fecha</th><th>Cliente</th><th>Cuenta · referencia</th><th>Facturas</th><th class="right">Recibido</th><th class="right">Retenciones</th><th>Estado</th><th></th></tr></thead><tbody>${lista
              .map(
                (r) =>
                  `<tr><td>${r.fecha}</td><td>${esc(nombreCliente(r.clienteId))}</td><td>${esc(r.cuenta)} ${esc(r.referencia)}</td><td>${r.aplicaciones.map((a) => esc(E.facturas[a.facturaId].consecutivo)).join(', ')}${r.excedente ? ` <span class="tag info">${r.destinoExcedente === 'anticipo' ? 'Anticipo' : 'Saldo a favor'} ${$p(r.excedente)}</span>` : ''}</td><td class="right num">${$p(r.valor)}</td><td class="right num">${$p(r.retenciones.reduce((s, x) => s + x.valor, 0))}</td><td>${r.reversado ? '<span class="tag bad">Reversado</span>' : r.conciliado ? '<span class="tag ok">Conciliado</span>' : '<span class="tag warn">Por conciliar</span>'}</td><td>${tieneRol('aprobador') && !r.reversado ? `<button class="btn peq peligro" data-reversar="${r.id}">Reversar</button>` : ''}</td></tr>`,
              )
              .join('')}</tbody></table>`
          : '<div class="vacio">Aún no hay recaudos.</div>'
      }</div></div>`;
    if ($('#nuevoRecaudo')) $('#nuevoRecaudo').onclick = () => formRecaudo();
    $$('[data-reversar]', st).forEach((b) => (b.onclick = () => formReversar(b.dataset.reversar)));
  };

  function formRecaudo(clienteId, facturaId) {
    const cuentas = [...new Set(Object.values(E.recaudos).map((r) => r.cuenta))];
    const m = ventana({
      titulo: 'Registrar recaudo',
      clase: 'ancho',
      cuerpo: `<div class="form">
          <label class="f">Cliente<select name="clienteId">${opciones(
            Object.values(E.clientes).map((c) => [c.id, c.razonSocial]),
            clienteId || '',
            'Seleccione…',
          )}</select></label>
          <label class="f">Fecha del pago (extracto)<input name="fecha" type="date" value="${hoy()}"></label>
          <label class="f">Valor recibido en el banco<input name="valor" class="num" value="0"></label>
          <label class="f">Cuenta bancaria<input name="cuenta" list="cuentasBanco" placeholder="Banco y número"><datalist id="cuentasBanco">${cuentas.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></label>
          <label class="f">Medio<select name="medio">${opciones(['Transferencia', 'Consignación', 'Cheque', 'PSE', 'Efectivo', 'Otro'].map((x) => [x, x]), 'Transferencia')}</select></label>
          <label class="f">Referencia bancaria<input name="referencia"></label>
          <label class="f">Proyecto (para anticipos)<select name="proyectoId"></select></label>
          <label class="f full">Observaciones<input name="observaciones"></label>
        </div>
        <div class="acciones" style="margin:14px 0 8px"><h3 style="margin-right:auto">Aplicación a facturas</h3><button class="btn peq" id="sugerirApl" type="button">Sugerir: más antiguas primero</button></div>
        <div class="card"><div class="card-body flush" id="aplTabla"></div></div>
        <div class="grid g2"><div id="aplResumen"></div><div class="form" id="destinoExc"><label class="f">El valor no aplicado es<select name="destinoExcedente">${opciones([['anticipo', 'Anticipo del proyecto'], ['saldo_favor', 'Saldo a favor del cliente']], 'anticipo', 'Seleccione…')}</select></label></div></div>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Registrar recaudo</button>',
    });
    const f = (n) => m.querySelector(`[name=${n}]`);
    let filas = [];
    const pintar = () => {
      const c = f('clienteId').value;
      f('proyectoId').innerHTML = opciones(Object.values(E.proyectos).filter((p) => p.clienteId === c).map((p) => [p.id, p.codigo + ' · ' + p.nombre]), '', 'Ninguno');
      filas = Object.values(E.facturas)
        .filter((x) => x.clienteId === c && !x.anulada && N.totalesFactura(x).saldo > 0)
        .sort((a, b) => (a.fechaVencimiento < b.fechaVencimiento ? -1 : 1))
        .map((x) => {
          const primera = x.aplicaciones.length === 0 && x.retenciones.length === 0;
          const esp = (t) => (primera ? (x.retencionesEsperadas.find((r) => r.tipo === t) || {}).valor || 0 : 0);
          return { f: x, aplicar: x.id === facturaId ? Math.max(0, x.netoEsperado) : 0, renta: x.id === facturaId ? esp('renta') : 0, iva: x.id === facturaId ? esp('iva') : 0, ica: x.id === facturaId ? esp('ica') : 0, esp };
        });
      $('#aplTabla', m).innerHTML = filas.length
        ? `<table class="t"><thead><tr><th>Factura</th><th>Vence</th><th class="right">Saldo</th><th style="width:150px">Pago aplicado</th><th style="width:130px">Ret. fuente</th><th style="width:120px">ReteIVA</th><th style="width:120px">ReteICA</th><th class="right">Saldo final</th></tr></thead><tbody>${filas
            .map(
              (x, i) =>
                `<tr data-i="${i}"><td>${esc(x.f.consecutivo)} <span class="muted small">${esc(codProyecto(x.f.proyectoId))}</span></td><td>${x.f.fechaVencimiento}</td><td class="right num">${$p(N.totalesFactura(x.f).saldo)}</td>${['aplicar', 'renta', 'iva', 'ica'].map((k) => `<td><input class="num" data-k="${k}" value="${N.formatoPesos(x[k]).replace('$ ', '')}"></td>`).join('')}<td class="right num" data-final></td></tr>`,
            )
            .join('')}</tbody></table>`
        : '<div class="vacio">El cliente no tiene facturas con saldo. Si es un anticipo, registre el valor y elija el proyecto.</div>';
      $$('#aplTabla input', m).forEach(
        (el) =>
          (el.onchange = () => {
            try {
              filas[Number(el.closest('tr').dataset.i)][el.dataset.k] = N.aCentavos(el.value);
            } catch (e) {
              fallo(e);
            }
            totales();
          }),
      );
      $$('#aplTabla input[data-k=aplicar]', m).forEach((el) =>
        el.addEventListener('change', () => {
          // Al aplicar un pago a una factura sin abonos se proponen sus retenciones esperadas
          const x = filas[Number(el.closest('tr').dataset.i)];
          if (x.aplicar > 0 && x.renta + x.iva + x.ica === 0) {
            ['renta', 'iva', 'ica'].forEach((k) => {
              x[k] = x.esp(k);
              el.closest('tr').querySelector(`[data-k=${k}]`).value = N.formatoPesos(x[k]).replace('$ ', '');
            });
            totales();
          }
        }),
      );
      totales();
    };
    const totales = () => {
      let apl = 0,
        ret = 0;
      $$('#aplTabla tbody tr', m).forEach((tr) => {
        const x = filas[Number(tr.dataset.i)];
        apl += x.aplicar;
        ret += x.renta + x.iva + x.ica;
        tr.querySelector('[data-final]').textContent = $p(N.totalesFactura(x.f).saldo - x.aplicar - x.renta - x.iva - x.ica);
      });
      let valor = 0;
      try {
        valor = N.aCentavos(f('valor').value);
      } catch {}
      const exc = valor - apl;
      $('#aplResumen', m).innerHTML = `<dl class="defs" style="margin-top:12px"><dt>Recibido</dt><dd class="num">${$p(valor)}</dd><dt>Aplicado a facturas</dt><dd class="num">${$p(apl)}</dd><dt>Retenciones practicadas</dt><dd class="num">${$p(ret)}</dd><dt>${exc >= 0 ? 'Sin aplicar' : 'Falta dinero'}</dt><dd class="num" style="color:${exc < 0 ? 'var(--bad)' : 'inherit'}">${$p(exc)}</dd></dl>`;
      $('#destinoExc', m).classList.toggle('hide', exc <= 0);
    };
    f('clienteId').onchange = pintar;
    f('valor').onchange = totales;
    $('#sugerirApl', m).onclick = () => {
      let resto = N.aCentavos(f('valor').value);
      filas.forEach((x) => {
        const saldo = N.totalesFactura(x.f).saldo;
        ['renta', 'iva', 'ica'].forEach((k) => (x[k] = resto > 0 ? x.esp(k) : 0));
        const maxPago = Math.max(0, saldo - x.renta - x.iva - x.ica);
        x.aplicar = Math.min(maxPago, Math.max(0, resto));
        if (!x.aplicar) ['renta', 'iva', 'ica'].forEach((k) => (x[k] = 0));
        resto -= x.aplicar;
      });
      const guard = filas.map((x) => ({ ...x }));
      pintar();
      filas.forEach((x, i) => Object.assign(x, { aplicar: guard[i].aplicar, renta: guard[i].renta, iva: guard[i].iva, ica: guard[i].ica }));
      $$('#aplTabla tbody tr', m).forEach((tr) => {
        const x = filas[Number(tr.dataset.i)];
        ['aplicar', 'renta', 'iva', 'ica'].forEach((k) => (tr.querySelector(`[data-k=${k}]`).value = N.formatoPesos(x[k]).replace('$ ', '')));
      });
      totales();
    };
    pintar();
    if (facturaId) {
      const x = filas.find((y) => y.f.id === facturaId);
      if (x) f('valor').value = N.formatoPesos(x.aplicar).replace('$ ', '');
      totales();
    }
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        const aplicaciones = filas.filter((x) => x.aplicar > 0).map((x) => ({ facturaId: x.f.id, valor: x.aplicar }));
        const retenciones = [];
        for (const x of filas)
          for (const t of ['renta', 'iva', 'ica'])
            if (x[t] > 0) {
              const esp = x.f.retencionesEsperadas.find((r) => r.tipo === t);
              retenciones.push({ facturaId: x.f.id, tipo: t, base: esp ? esp.base : 0, ppm: esp ? esp.ppm : 0, valor: x[t] });
            }
        await emitir('recaudo.registrado', { id: N.nuevoId('rec'), clienteId: d.clienteId, fecha: d.fecha, valor: N.aCentavos(d.valor), cuenta: d.cuenta, medio: d.medio, referencia: d.referencia, proyectoId: d.proyectoId, observaciones: d.observaciones, aplicaciones, retenciones, destinoExcedente: d.destinoExcedente });
        m.cerrar();
        aviso('Recaudo registrado.');
        render();
      });
  }

  function formReversar(id) {
    const r = E.recaudos[id];
    const m = ventana({
      titulo: 'Reversar recaudo',
      clase: 'angosto',
      cuerpo: `<p>Recaudo de <b class="num">${$p(r.valor)}</b> del ${r.fecha} (${esc(nombreCliente(r.clienteId))}). La reversión devuelve el saldo a las facturas; el registro original queda visible.</p><div class="form"><label class="f">Fecha de la reversión<input name="fecha" type="date" value="${hoy()}"></label><label class="f full">Motivo<input name="motivo"></label></div>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Reversar</button>',
    });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        await emitir('recaudo.reversado', { recaudoId: id, ...leerForm(m) });
        m.cerrar();
        aviso('Recaudo reversado.');
        render();
      });
  }

  /* ─────────── Cartera ─────────── */
  PANTALLAS.cartera = (st) => {
    const corte = pref.get('corteCartera', '') || hoy();
    st.innerHTML =
      cabeza('Cartera por edades', 'Saldo por cliente según los días de vencimiento al corte. La garantía retenida se cuenta desde su fecha de liberación. Base para el deterioro de cartera (NIIF) y la provisión fiscal (art. 145 E.T.).') +
      `<div class="filtros"><label class="f">Fecha de corte<input type="date" id="corte" value="${corte}"></label><label class="f">Proyecto<select id="cProyecto">${opciones(Object.values(E.proyectos).map((p) => [p.id, p.codigo + ' · ' + p.nombre]), '', 'Todos')}</select></label><button class="btn" id="cCsv">Exportar</button></div><div class="card"><div class="card-body flush" id="tCartera"></div></div>`;
    const pintar = () => {
      const c = N.carteraPorEdades(E, $('#corte').value || hoy(), { proyectoId: $('#cProyecto').value });
      pref.set('corteCartera', $('#corte').value === hoy() ? '' : $('#corte').value);
      $('#tCartera').innerHTML = c.filas.length
        ? `<table class="t"><thead><tr><th>Cliente</th>${N.TRAMOS.map((t) => `<th class="right">${t.nombre}</th>`).join('')}<th class="right">Total</th></tr></thead><tbody>${c.filas
            .map((f) => `<tr class="click" data-cliente="${f.clienteId}"><td>${esc(nombreCliente(f.clienteId))}</td>${N.TRAMOS.map((t) => `<td class="right num">${f[t.clave] ? $p(f[t.clave]) : ''}</td>`).join('')}<td class="right num"><b>${$p(f.total)}</b></td></tr>`)
            .join('')}</tbody><tfoot><tr><td>Total</td>${N.TRAMOS.map((t) => `<td class="right num">${$p(c.totales[t.clave])}</td>`).join('')}<td class="right num">${$p(c.totales.total)}</td></tr></tfoot></table>`
        : '<div class="vacio">No hay cartera al corte.</div>';
      enlazar($('#tCartera'));
      $('#cCsv').onclick = () =>
        exportar(
          `ARKEN_PAY_cartera_${c.corte}.csv`,
          N.csv(c.filas, [
            { titulo: 'Cliente', valor: (f) => nombreCliente(f.clienteId) },
            { titulo: 'Documento', valor: (f) => E.clientes[f.clienteId].documento },
            ...N.TRAMOS.map((t) => ({ titulo: t.nombre, valor: (f) => N.numExcel(f[t.clave]) })),
            { titulo: 'Total', valor: (f) => N.numExcel(f.total) },
          ]),
        );
    };
    $('#corte').onchange = $('#cProyecto').onchange = pintar;
    pintar();
  };

  function estadoCuenta(clienteId) {
    const c = E.clientes[clienteId];
    const ec = N.estadoCuentaCliente(E, clienteId);
    const m = ventana({
      titulo: `Estado de cuenta · ${c.razonSocial}`,
      clase: 'ancho',
      cuerpo: `<p class="muted">${esc(c.tipoDocumento)} ${esc(c.documento)}${c.dv !== null ? '-' + c.dv : ''} · plazo ${c.plazoDias} días${ec.saldoFavor ? ` · <b>saldo a favor / anticipos ${$p(ec.saldoFavor)}</b>` : ''}</p><div class="card"><div class="card-body flush"><table class="t"><thead><tr><th>Fecha</th><th>Movimiento</th><th>Documento</th><th class="right">Cargo</th><th class="right">Abono</th><th class="right">Saldo</th></tr></thead><tbody>${ec.filas
        .map((x) => `<tr><td>${x.fecha}</td><td>${esc(x.tipo)}</td><td>${esc(x.doc)}</td><td class="right num">${x.cargo ? $p(x.cargo) : ''}</td><td class="right num">${x.abono ? $p(x.abono) : ''}</td><td class="right num">${$p(x.saldo)}</td></tr>`)
        .join('')}</tbody></table></div></div>`,
      pie: `<button class="btn" data-csv>Exportar</button><button class="btn" data-print>Imprimir</button>${tieneRol('tesoreria') ? '<button class="btn pri" data-pago>Registrar pago</button>' : ''}`,
    });
    m.querySelector('[data-csv]').onclick = () =>
      exportar(
        `ARKEN_PAY_estado_cuenta_${c.documento}.csv`,
        N.csv(ec.filas, [
          { titulo: 'Fecha', valor: 'fecha' },
          { titulo: 'Movimiento', valor: 'tipo' },
          { titulo: 'Documento', valor: 'doc' },
          { titulo: 'Cargo', valor: (x) => N.numExcel(x.cargo) },
          { titulo: 'Abono', valor: (x) => N.numExcel(x.abono) },
          { titulo: 'Saldo', valor: (x) => N.numExcel(x.saldo) },
        ]),
      );
    m.querySelector('[data-print]').onclick = () => window.print();
    if (m.querySelector('[data-pago]')) m.querySelector('[data-pago]').onclick = () => (m.cerrar(), formRecaudo(clienteId));
  }

  /* ─────────── Proyectos ─────────── */
  PANTALLAS.proyectos = (st) => {
    const res = N.resumenProyectos(E);
    st.innerHTML =
      cabeza('Proyectos', 'Qué se ha facturado y cobrado de cada proyecto frente a su valor contratado.', tieneRol('facturacion', 'administrador') ? '<button class="btn pri" id="nuevoProyecto">Nuevo proyecto</button>' : '') +
      `<div class="card"><div class="card-body flush">${
        res.length
          ? `<table class="t"><thead><tr><th>Proyecto</th><th>Cliente</th><th class="right">Contratado</th><th class="right">Facturado neto</th><th>% facturado</th><th class="right">Recaudado</th><th class="right">Retenciones</th><th class="right">Por cobrar</th><th class="right">Garantía</th><th class="right">Anticipo sin amortizar</th><th class="right">Por facturar</th></tr></thead><tbody>${res
              .map(
                (p) =>
                  `<tr class="click" data-proyecto="${p.proyectoId}"><td><b>${esc(p.codigo)}</b> ${esc(p.nombre)} ${E.proyectos[p.proyectoId].estado !== 'activo' ? `<span class="tag">${esc(E.proyectos[p.proyectoId].estado)}</span>` : ''}</td><td>${esc(nombreCliente(p.clienteId))}</td><td class="right num">${p.valorContratado ? $p(p.valorContratado) : '—'}</td><td class="right num">${$p(p.facturadoNeto)}</td><td><div class="barra" title="${pctTxt(p.pctFacturado)}"><i style="width:${Math.min(100, (p.pctFacturado || 0) * 100)}%"></i></div><span class="small muted">${pctTxt(p.pctFacturado)}</span></td><td class="right num">${$p(p.recaudado)}</td><td class="right num">${$p(p.retenido)}</td><td class="right num">${$p(p.porCobrar)}</td><td class="right num">${$p(p.garantiaRetenida)}</td><td class="right num">${$p(p.anticipoDisponible)}</td><td class="right num">${p.porFacturar === null ? '—' : $p(p.porFacturar)}</td></tr>`,
              )
              .join('')}</tbody></table>`
          : '<div class="vacio">Aún no hay proyectos. Cada factura debe pertenecer a uno.</div>'
      }</div></div>`;
    if ($('#nuevoProyecto')) $('#nuevoProyecto').onclick = () => formProyecto();
    enlazar(st);
  };

  function formProyecto(id) {
    const p = id ? E.proyectos[id] : null;
    const editable = tieneRol('facturacion', 'administrador');
    const m = ventana({
      titulo: p ? `Proyecto ${p.codigo}` : 'Nuevo proyecto',
      cuerpo: `<div class="form">
        <label class="f">Código<input name="codigo" value="${esc(p ? p.codigo : '')}" ${p ? 'readonly' : ''}></label>
        <label class="f full">Nombre<input name="nombre" value="${esc(p ? p.nombre : '')}"></label>
        <label class="f">Cliente<select name="clienteId" ${p ? 'disabled' : ''}>${opciones(Object.values(E.clientes).map((c) => [c.id, c.razonSocial]), p ? p.clienteId : '', 'Seleccione…')}</select></label>
        <label class="f">Empresa que factura<select name="empresaId">${opciones(Object.values(E.empresas).map((x) => [x.id, x.razonSocial]), p ? p.empresaId : '', 'Cualquiera')}</select></label>
        <label class="f">Contrato / orden<input name="contrato" value="${esc(p ? p.contrato : '')}"></label>
        <label class="f">Valor contratado (antes de IVA o total, según su política)<input name="valorContratado" class="num" value="${p ? N.formatoPesos(p.valorContratado).replace('$ ', '') : ''}"></label>
        <label class="f">Retención de garantía (%)<input name="garantia" value="${p && p.garantiaPpm ? (p.garantiaPpm / 10000).toString().replace('.', ',') : ''}"></label>
        <label class="f">Concepto de retención en la fuente<select name="conceptoRetencion">${opciones(E.parametros.conceptosRetencion.map((c) => [c.codigo, c.nombre]), p ? p.conceptoRetencion : '', 'El de la empresa')}</select></label>
        <label class="f">Centro de costo<input name="centroCosto" value="${esc(p ? p.centroCosto : '')}"></label>
        <label class="f">Inicio<input name="fechaInicio" type="date" value="${p ? p.fechaInicio : ''}"></label>
        <label class="f">Fin<input name="fechaFin" type="date" value="${p ? p.fechaFin : ''}"></label>
        ${p ? `<label class="f">Estado<select name="estado">${opciones([['activo', 'Activo'], ['suspendido', 'Suspendido'], ['terminado', 'Terminado'], ['liquidado', 'Liquidado']], p.estado)}</select></label>` : ''}
      </div>`,
      pie: editable ? `<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>${p ? 'Guardar cambios' : 'Crear proyecto'}</button>` : '',
    });
    if (!editable) return;
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        const comun = { nombre: d.nombre, contrato: d.contrato, valorContratado: N.aCentavos(d.valorContratado), garantiaPpm: d.garantia ? N.aPpm(d.garantia) : 0, conceptoRetencion: d.conceptoRetencion, centroCosto: d.centroCosto, fechaInicio: d.fechaInicio, fechaFin: d.fechaFin };
        if (p) await emitir('proyecto.actualizado', { id: p.id, ...comun, estado: d.estado });
        else await emitir('proyecto.registrado', { id: N.nuevoId('pro'), codigo: d.codigo, clienteId: d.clienteId, empresaId: d.empresaId, ...comun });
        m.cerrar();
        aviso('Proyecto guardado.');
        render();
      });
  }

  /* ─────────── Clientes ─────────── */
  PANTALLAS.clientes = (st) => {
    const lista = Object.values(E.clientes).sort((a, b) => a.razonSocial.localeCompare(b.razonSocial));
    st.innerHTML =
      cabeza('Clientes', 'Datos tributarios de cada cliente: definen qué retenciones se esperan y el plazo de pago.', tieneRol('facturacion', 'tesoreria', 'administrador') ? '<button class="btn pri" id="nuevoCliente">Nuevo cliente</button>' : '') +
      `<div class="card"><div class="card-body flush">${
        lista.length
          ? `<table class="t"><thead><tr><th>Cliente</th><th>Documento</th><th>Retiene</th><th>Plazo</th><th class="right">Saldo</th><th></th></tr></thead><tbody>${lista
              .map((c) => {
                const ec = N.estadoCuentaCliente(E, c.id);
                return `<tr><td><b>${esc(c.razonSocial)}</b> ${c.activo ? '' : '<span class="tag">Inactivo</span>'}${c.granEmpresa ? ' <span class="tag info">Gran empresa</span>' : ''}</td><td>${esc(c.tipoDocumento)} ${esc(c.documento)}${c.dv !== null ? '-' + c.dv : ''}</td><td>${[c.retieneRenta && 'Renta', c.retieneIva && 'IVA', c.retieneIca && 'ICA'].filter(Boolean).join(' · ') || '—'}</td><td>${c.plazoDias} días</td><td class="right num">${$p(ec.saldo)}</td><td><button class="btn peq" data-ver="${c.id}">Estado de cuenta</button> <button class="btn peq" data-editar="${c.id}">Editar</button></td></tr>`;
              })
              .join('')}</tbody></table>`
          : '<div class="vacio">Aún no hay clientes.</div>'
      }</div></div>`;
    if ($('#nuevoCliente')) $('#nuevoCliente').onclick = () => formCliente();
    $$('[data-ver]', st).forEach((b) => (b.onclick = () => estadoCuenta(b.dataset.ver)));
    $$('[data-editar]', st).forEach((b) => (b.onclick = () => formCliente(b.dataset.editar)));
  };

  function formCliente(id) {
    const c = id ? E.clientes[id] : null;
    const m = ventana({
      titulo: c ? c.razonSocial : 'Nuevo cliente',
      cuerpo: `<div class="form">
        <label class="f">Tipo de documento<select name="tipoDocumento" ${c ? 'disabled' : ''}>${opciones(
          [
            ['NIT', 'NIT'],
            ['CC', 'Cédula de ciudadanía'],
            ['CE', 'Cédula de extranjería'],
            ['PAS', 'Pasaporte'],
            ['NIT_EXT', 'NIT de otro país'],
          ],
          c ? c.tipoDocumento : 'NIT',
        )}</select></label>
        <label class="f">Número<input name="documento" value="${esc(c ? c.documento : '')}" ${c ? 'readonly' : ''}></label>
        <label class="f">DV<input name="dv" value="${c && c.dv !== null ? c.dv : ''}" ${c ? 'readonly' : ''} maxlength="1"><span class="ayuda" id="dvCalc"></span></label>
        <label class="f full">Razón social o nombre<input name="razonSocial" value="${esc(c ? c.razonSocial : '')}"></label>
        <label class="f">Municipio<input name="municipio" value="${esc(c ? c.municipio : 'Bogotá D.C.')}"></label>
        <label class="f">Dirección<input name="direccion" value="${esc(c ? c.direccion : '')}"></label>
        <label class="f">Plazo de pago (días)<input name="plazoDias" inputmode="numeric" value="${c ? c.plazoDias : 30}"></label>
        <label class="f">Correo de cobro<input name="correo" value="${esc(c && c.contactos[0] ? c.contactos[0].correo : '')}"></label>
        <label class="f">Contacto<input name="contacto" value="${esc(c && c.contactos[0] ? c.contactos[0].nombre : '')}"></label>
        <label class="f">Teléfono<input name="telefono" value="${esc(c && c.contactos[0] ? c.contactos[0].telefono : '')}"></label>
        <label class="f check full"><input type="checkbox" name="retieneRenta" ${c && c.retieneRenta ? 'checked' : ''}> Es agente de retención en la fuente (renta)</label>
        <label class="f check full"><input type="checkbox" name="retieneIva" ${c && c.retieneIva ? 'checked' : ''}> Es agente retenedor de IVA (gran contribuyente, entidad pública u otro designado)</label>
        <label class="f check full"><input type="checkbox" name="retieneIca" ${c && c.retieneIca ? 'checked' : ''}> Es agente retenedor de ICA</label>
        <label class="f check full"><input type="checkbox" name="granEmpresa" ${c && c.granEmpresa ? 'checked' : ''}> Es gran empresa (aplica Ley 2024 de 2020 de pago a mipymes en 60 días)</label>
        <label class="f check full"><input type="checkbox" name="autorizacionDatos" ${c && c.autorizacionDatos ? 'checked' : ''}> Hay autorización para el tratamiento de datos personales de sus contactos (Ley 1581 de 2012)</label>
        ${c ? `<label class="f check full"><input type="checkbox" name="activo" ${c.activo ? 'checked' : ''}> Activo</label>` : ''}
      </div>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Guardar</button>',
    });
    const f = (n) => m.querySelector(`[name=${n}]`);
    const dv = () => {
      if (f('tipoDocumento').value === 'NIT' && /^\d{5,}$/.test(N.limpiarNit(f('documento').value))) {
        const v = N.digitoVerificacion(f('documento').value);
        $('#dvCalc', m).textContent = 'Calculado: ' + v;
        if (!f('dv').value) f('dv').value = v;
      }
    };
    f('documento').oninput = dv;
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        const contactos = d.correo || d.contacto || d.telefono ? [{ nombre: d.contacto, correo: d.correo, telefono: d.telefono }] : [];
        const comun = { razonSocial: d.razonSocial, municipio: d.municipio, direccion: d.direccion, plazoDias: Number(d.plazoDias), retieneRenta: d.retieneRenta, retieneIva: d.retieneIva, retieneIca: d.retieneIca, granEmpresa: d.granEmpresa, autorizacionDatos: d.autorizacionDatos, contactos };
        if (c) await emitir('cliente.actualizado', { id: c.id, ...comun, activo: d.activo });
        else await emitir('cliente.registrado', { id: N.nuevoId('cli'), tipoDocumento: d.tipoDocumento, documento: d.documento, dv: d.dv === '' ? undefined : Number(d.dv), ...comun });
        m.cerrar();
        aviso('Cliente guardado.');
        render();
      });
  }

  /* ─────────── Retenciones ─────────── */
  PANTALLAS.retenciones = (st) => {
    const pend = N.retencionesPendientesCertificado(E);
    const anio = pref.get('anioRet', hoy().slice(0, 4));
    const todas = Object.values(E.recaudos)
      .filter((r) => !r.reversado && r.fecha.startsWith(anio))
      .flatMap((r) => r.retenciones.map((x) => ({ ...x, recaudoId: r.id, clienteId: r.clienteId, fecha: r.fecha })));
    const porTipo = { renta: 0, iva: 0, ica: 0 };
    todas.forEach((x) => (porTipo[x.tipo] += x.valor));
    st.innerHTML =
      cabeza('Retenciones', 'Lo que los clientes descontaron al pagar. Contabilidad las toma como anticipos de renta, IVA e ICA, y necesita el certificado de cada una.') +
      `<div class="filtros"><label class="f">Año<input id="anioRet" value="${anio}" maxlength="4"></label><button class="btn" id="csvRet">Exportar</button></div>
      <div class="grid g3">${kpi('Retención en la fuente', $p(porTipo.renta), anio)}${kpi('ReteIVA', $p(porTipo.iva), anio)}${kpi('ReteICA', $p(porTipo.ica), anio)}</div>
      <div class="card"><div class="card-head"><h2>Pendientes de certificado (${pend.length})</h2></div><div class="card-body flush">${
        pend.length
          ? `<table class="t"><thead><tr><th>Fecha</th><th>Cliente</th><th>Factura</th><th>Tipo</th><th class="right">Valor</th><th></th></tr></thead><tbody>${pend
              .map((x) => `<tr><td>${x.fecha}</td><td>${esc(nombreCliente(x.clienteId))}</td><td>${esc(E.facturas[x.facturaId].consecutivo)}</td><td>${x.tipo}</td><td class="right num">${$p(x.valor)}</td><td>${tieneRol('tesoreria', 'facturacion') ? `<button class="btn peq" data-cert="${esc(x.recaudoId)}|${esc(x.id)}">Registrar certificado</button>` : ''}</td></tr>`)
              .join('')}</tbody></table>`
          : '<div class="vacio">Todas las retenciones tienen certificado.</div>'
      }</div></div>`;
    $('#anioRet').onchange = () => (pref.set('anioRet', $('#anioRet').value), render());
    $('#csvRet').onclick = () =>
      exportar(
        `ARKEN_PAY_retenciones_${anio}.csv`,
        N.csv(todas, [
          { titulo: 'Fecha', valor: 'fecha' },
          { titulo: 'Cliente', valor: (x) => nombreCliente(x.clienteId) },
          { titulo: 'NIT', valor: (x) => E.clientes[x.clienteId].documento },
          { titulo: 'Factura', valor: (x) => E.facturas[x.facturaId].consecutivo },
          { titulo: 'Tipo', valor: 'tipo' },
          { titulo: 'Base', valor: (x) => N.numExcel(x.base) },
          { titulo: 'Tarifa %', valor: (x) => (x.ppm / 10000).toString().replace('.', ',') },
          { titulo: 'Valor', valor: (x) => N.numExcel(x.valor) },
          { titulo: 'Certificado', valor: (x) => (x.certificado ? x.certificado.numero || 'Sí' : 'Pendiente') },
        ]),
      );
    $$('[data-cert]', st).forEach(
      (b) =>
        (b.onclick = () => {
          const [recaudoId, retencionId] = b.dataset.cert.split('|');
          let archivo = '';
          const m = ventana({
            titulo: 'Certificado de retención',
            clase: 'angosto',
            cuerpo: `<div class="form"><label class="f">Fecha de recibo<input name="fecha" type="date" value="${hoy()}"></label><label class="f">Número<input name="numero"></label><label class="f">Período<input name="periodo" placeholder="2026 o 2026-03"></label><label class="f full">Archivo<input type="file" id="certArch"></label></div>`,
            pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Registrar</button>',
          });
          $('#certArch', m).onchange = async (ev) => (archivo = (await guardarDocumento(ev.target.files[0])).hash);
          m.querySelector('[data-ok]').onclick = (e2) =>
            accion(e2.target, async () => {
              await emitir('retencion.certificada', { recaudoId, retencionId, ...leerForm(m), archivo });
              m.cerrar();
              render();
            });
        }),
    );
  };

  /* ─────────── Conciliación bancaria ─────────── */
  PANTALLAS.conciliacion = (st) => {
    const movs = Object.values(E.movimientosBanco).filter((x) => !x.recaudoId && x.valor > 0);
    const recs = Object.values(E.recaudos).filter((r) => !r.reversado && !r.conciliado && r.valor > 0);
    st.innerHTML =
      cabeza('Conciliación bancaria', 'Cruce de cada recaudo registrado con el movimiento del extracto. Un recaudo sin movimiento bancario no debe darse por cobrado.', tieneRol('tesoreria') ? '<label class="btn pri">Importar extracto (CSV)<input type="file" id="extracto" accept=".csv,.txt" hidden></label>' : '') +
      `<div class="aviso info">El extracto se importa como CSV con columnas <b>fecha; descripción; referencia; valor</b> (separado por punto y coma o coma, fechas AAAA-MM-DD o DD/MM/AAAA). Solo se toman los créditos (valores positivos).</div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>Recaudos por conciliar (${recs.length})</h2></div><div class="card-body flush">${
          recs.length
            ? `<table class="t"><thead><tr><th>Fecha</th><th>Cliente</th><th class="right">Valor</th><th>Coincidencias en el extracto</th></tr></thead><tbody>${recs
                .map((r) => {
                  const c = movs.filter((x) => x.valor === r.valor && Math.abs(N.diasEntre(x.fecha, r.fecha)) <= 5);
                  return `<tr><td>${r.fecha}</td><td>${esc(nombreCliente(r.clienteId))}<div class="small muted">${esc(r.cuenta)} ${esc(r.referencia)}</div></td><td class="right num">${$p(r.valor)}</td><td>${
                    c.map((x) => `<button class="btn peq" data-conc="${esc(x.id)}|${esc(r.id)}">${x.fecha} · ${esc(x.descripcion.slice(0, 30))}</button>`).join(' ') || '<span class="muted small">Sin coincidencias</span>'
                  }</td></tr>`;
                })
                .join('')}</tbody></table>`
            : '<div class="vacio">Todo conciliado.</div>'
        }</div></div>
        <div class="card"><div class="card-head"><h2>Créditos del extracto sin recaudo (${movs.length})</h2></div><div class="card-body flush">${
          movs.length
            ? `<table class="t"><thead><tr><th>Fecha</th><th>Descripción</th><th class="right">Valor</th></tr></thead><tbody>${movs
                .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
                .map((x) => `<tr><td>${x.fecha}</td><td>${esc(x.descripcion)} <span class="small muted">${esc(x.referencia)}</span></td><td class="right num">${$p(x.valor)}</td></tr>`)
                .join('')}</tbody></table>`
            : '<div class="vacio">No hay créditos pendientes.</div>'
        }</div></div>
      </div>`;
    $$('[data-conc]', st).forEach(
      (b) =>
        (b.onclick = () =>
          accion(b, async () => {
            const [movimientoId, recaudoId] = b.dataset.conc.split('|');
            await emitir('banco.conciliado', { movimientoId, recaudoId });
            render();
          })),
    );
    if ($('#extracto'))
      $('#extracto').onchange = (ev) =>
        accion(null, async () => {
          const archivo = ev.target.files[0];
          const texto = await archivo.text();
          ev.target.value = '';
          const cuenta = await pedirTexto('Cuenta del extracto', '¿De qué cuenta bancaria es este extracto? (banco y número)');
          if (!cuenta) return;
          const movimientos = await leerExtracto(texto, cuenta.trim());
          if (!movimientos.length) throw new Error('No se encontraron créditos en el archivo.');
          await emitir('banco.movimientos_importados', { cuenta: cuenta.trim(), movimientos });
          aviso(`${movimientos.length} créditos leídos del extracto.`);
          render();
        });
  };
  async function leerExtracto(texto, cuenta) {
    const lineas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
    const sep = (lineas[0].match(/;/g) || []).length >= (lineas[0].match(/,/g) || []).length ? ';' : ',';
    const out = [];
    for (const l of lineas) {
      const c = l.split(sep).map((x) => x.replace(/^"|"$/g, '').trim());
      if (c.length < 4) continue;
      let fecha = c[0];
      const m = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (m) fecha = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      if (!N.esFecha(fecha)) continue;
      let valor;
      try {
        valor = N.aCentavos(c[3]);
      } catch {
        continue;
      }
      if (valor <= 0) continue;
      const id = 'mb_' + (await sha256Base64(new TextEncoder().encode(`${cuenta}|${fecha}|${c[1]}|${c[2]}|${valor}|${out.filter((x) => x.fecha === fecha && x.valor === valor).length}`))).slice(0, 24);
      out.push({ id, fecha, descripcion: c[1], referencia: c[2], valor });
    }
    return out;
  }

  /* ─────────── Reportes ─────────── */
  function libroFacturacion(lista) {
    return N.csv(lista, [
      { titulo: 'Empresa', valor: (f) => E.empresas[f.empresaId].nit },
      { titulo: 'Prefijo', valor: 'prefijo' },
      { titulo: 'Número', valor: 'numero' },
      { titulo: 'CUFE', valor: 'cufe' },
      { titulo: 'Emisión', valor: 'fechaEmision' },
      { titulo: 'Vencimiento', valor: 'fechaVencimiento' },
      { titulo: 'Cliente', valor: (f) => nombreCliente(f.clienteId) },
      { titulo: 'NIT cliente', valor: (f) => E.clientes[f.clienteId].documento },
      { titulo: 'Proyecto', valor: (f) => codProyecto(f.proyectoId) },
      { titulo: 'Base', valor: (f) => N.numExcel(f.baseAntesIva) },
      { titulo: 'IVA', valor: (f) => N.numExcel(f.iva) },
      { titulo: 'Total', valor: (f) => N.numExcel(f.total) },
      { titulo: 'Notas crédito', valor: (f) => N.numExcel(N.totalesFactura(f).notasCredito) },
      { titulo: 'Notas débito', valor: (f) => N.numExcel(N.totalesFactura(f).notasDebito) },
      { titulo: 'Recaudado', valor: (f) => N.numExcel(N.totalesFactura(f).recaudado) },
      { titulo: 'Retenciones', valor: (f) => N.numExcel(N.totalesFactura(f).retenido) },
      { titulo: 'Saldo', valor: (f) => N.numExcel(N.totalesFactura(f).saldo) },
      { titulo: 'Estado', valor: (f) => N.NOMBRE_ESTADO[N.estadoFactura(f, hoy())] },
    ]);
  }
  async function exportar(nombre, contenido) {
    try {
      const r = await host.guardarArchivo(nombre, contenido);
      if (r) aviso('Archivo guardado: ' + r);
    } catch (e) {
      fallo(e);
    }
  }
  PANTALLAS.reportes = (st) => {
    const num = N.controlNumeracion(E, hoy());
    st.innerHTML =
      cabeza('Reportes', 'Todos se exportan en CSV con separador punto y coma, que Excel en español abre directamente.') +
      `<div class="grid g3">
        ${rep('libro', 'Libro de facturación', 'Todas las facturas con su CUFE, base, IVA, notas, recaudos y saldo. Para cuadrar con el proveedor tecnológico y la DIAN.')}
        ${rep('recaudos', 'Recaudos del período', 'Pagos recibidos con su cuenta, referencia y facturas aplicadas.')}
        ${rep('proyectos', 'Resumen por proyecto', 'Contratado, facturado, recaudado, por cobrar y garantías.')}
      </div>
      <div class="card"><div class="card-head"><h2>Control de numeración</h2></div><div class="card-body flush"><table class="t"><thead><tr><th>Resolución</th><th>Prefijo</th><th>Rango</th><th>Último registrado</th><th class="right">Registradas</th><th class="right">Disponibles</th><th>Números faltantes en ARKEN PAY</th></tr></thead><tbody>${
        num.map((r) => `<tr><td>${esc(r.numero)}</td><td>${esc(r.prefijo || '—')}</td><td>${r.desde}–${r.hasta}</td><td>${r.ultimo || '—'}</td><td class="right num">${r.registradas}</td><td class="right num">${r.disponibles}</td><td>${r.huecos.length ? `<span class="tag warn">${r.huecos.slice(0, 30).join(', ')}${r.huecos.length > 30 ? '…' : ''}</span>` : '<span class="tag ok">Sin saltos</span>'}</td></tr>`).join('') || '<tr><td colspan="7" class="vacio">Sin resoluciones.</td></tr>'
      }</tbody></table></div></div>
      <p class="ayuda">Un número faltante puede ser una factura emitida en el proveedor que aún no se registró aquí, o una factura rechazada por la DIAN. Revíselo contra el listado del proveedor tecnológico.</p>`;
    $$('[data-rep]', st).forEach(
      (b) =>
        (b.onclick = () => {
          const k = b.dataset.rep;
          if (k === 'libro') exportar('ARKEN_PAY_libro_facturacion.csv', libroFacturacion(Object.values(E.facturas).sort((a, b) => (a.fechaEmision < b.fechaEmision ? -1 : 1))));
          if (k === 'recaudos')
            exportar(
              'ARKEN_PAY_recaudos.csv',
              N.csv(
                Object.values(E.recaudos).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
                [
                  { titulo: 'Fecha', valor: 'fecha' },
                  { titulo: 'Cliente', valor: (r) => nombreCliente(r.clienteId) },
                  { titulo: 'Cuenta', valor: 'cuenta' },
                  { titulo: 'Referencia', valor: 'referencia' },
                  { titulo: 'Medio', valor: 'medio' },
                  { titulo: 'Valor', valor: (r) => N.numExcel(r.valor) },
                  { titulo: 'Retenciones', valor: (r) => N.numExcel(r.retenciones.reduce((s, x) => s + x.valor, 0)) },
                  { titulo: 'Facturas', valor: (r) => r.aplicaciones.map((a) => E.facturas[a.facturaId].consecutivo).join(' ') },
                  { titulo: 'Anticipo / saldo a favor', valor: (r) => N.numExcel(r.excedente) },
                  { titulo: 'Estado', valor: (r) => (r.reversado ? 'Reversado' : r.conciliado ? 'Conciliado' : 'Por conciliar') },
                ],
              ),
            );
          if (k === 'proyectos')
            exportar(
              'ARKEN_PAY_proyectos.csv',
              N.csv(N.resumenProyectos(E), [
                { titulo: 'Código', valor: 'codigo' },
                { titulo: 'Proyecto', valor: 'nombre' },
                { titulo: 'Cliente', valor: (p) => nombreCliente(p.clienteId) },
                { titulo: 'Contratado', valor: (p) => N.numExcel(p.valorContratado) },
                { titulo: 'Facturado neto', valor: (p) => N.numExcel(p.facturadoNeto) },
                { titulo: 'Recaudado', valor: (p) => N.numExcel(p.recaudado) },
                { titulo: 'Retenciones', valor: (p) => N.numExcel(p.retenido) },
                { titulo: 'Por cobrar', valor: (p) => N.numExcel(p.porCobrar) },
                { titulo: 'Garantía retenida', valor: (p) => N.numExcel(p.garantiaRetenida) },
                { titulo: 'Por facturar', valor: (p) => (p.porFacturar === null ? '' : N.numExcel(p.porFacturar)) },
              ]),
            );
        }),
    );
  };
  const rep = (k, t, d) => `<div class="card"><div class="card-body"><h2>${t}</h2><p class="muted small" style="margin-top:6px">${d}</p><button class="btn" data-rep="${k}">Exportar</button></div></div>`;

  /* ─────────── Bitácora ─────────── */
  PANTALLAS.bitacora = (st) => {
    const lista = [...E.bitacora].reverse().slice(0, 500);
    st.innerHTML =
      cabeza('Bitácora', 'Todo lo que ha pasado, en orden, con quién y cuándo. Cada registro está encadenado al anterior con SHA-256: cualquier alteración se detecta.', '<button class="btn" id="verificar">Verificar integridad</button>') +
      `<div id="verMsg"></div><div class="card"><div class="card-body flush"><table class="t"><thead><tr><th>#</th><th>Fecha y hora</th><th>Usuario</th><th>Acción</th><th>Huella</th></tr></thead><tbody>${lista
        .map((b) => `<tr><td class="num">${b.seq}</td><td class="nowrap">${esc(new Date(b.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' }))}</td><td>${esc(nombreUsuario(b.usuario))}</td><td>${esc(b.resumen)}</td><td class="cufe">${esc(b.hash.slice(0, 12))}</td></tr>`)
        .join('')}</tbody></table></div></div>`;
    $('#verificar').onclick = (ev) =>
      accion(ev.target, async () => {
        const { eventos } = await host.eventos.leer(0);
        const v = await N.verificarCadena(eventos);
        $('#verMsg').innerHTML = v.ok ? `<div class="aviso ok">Integridad verificada: ${v.eventos} eventos encadenados sin alteraciones. Última huella ${esc(v.ultimoHash)}.</div>` : `<div class="aviso bad">${esc(v.motivo)}</div>`;
      });
  };

  /* ─────────── Configuración ─────────── */
  PANTALLAS.configuracion = (st) => {
    const adm = tieneRol('administrador');
    const params = tieneRol('administrador', 'aprobador');
    st.innerHTML =
      cabeza('Configuración') +
      `<div class="card"><div class="card-head"><h2>Empresas emisoras</h2>${adm ? '<button class="btn peq" id="nuevaEmpresa">Agregar</button>' : ''}</div><div class="card-body flush"><table class="t"><thead><tr><th>Razón social</th><th>NIT</th><th>Municipio</th><th>CIIU</th><th class="right">ICA</th><th>Retención en la fuente por defecto</th><th></th></tr></thead><tbody>${
        Object.values(E.empresas)
          .map((x) => `<tr><td>${esc(x.razonSocial)}</td><td>${x.nit}-${x.dv}</td><td>${esc(x.municipio)}</td><td>${esc(x.ciiu)}</td><td class="right num">${x.icaPpm ? (x.icaPpm / 1000).toString().replace('.', ',') + ' ‰' : '—'}</td><td>${esc(x.conceptoRetencion || '—')}</td><td>${adm ? `<button class="btn peq" data-empresa="${x.id}">Editar</button>` : ''}</td></tr>`)
          .join('') || '<tr><td colspan="7" class="vacio">Sin empresas.</td></tr>'
      }</tbody></table></div></div>
      <div class="card"><div class="card-head"><h2>Resoluciones de facturación</h2>${tieneRol('administrador', 'facturacion') ? '<button class="btn peq" id="nuevaRes">Agregar</button>' : ''}</div><div class="card-body flush"><table class="t"><thead><tr><th>Número</th><th>Empresa</th><th>Prefijo</th><th>Rango</th><th>Vigencia</th></tr></thead><tbody>${
        Object.values(E.resoluciones)
          .map((r) => `<tr><td>${esc(r.numero)}</td><td>${esc(E.empresas[r.empresaId].razonSocial)}</td><td>${esc(r.prefijo || '—')}</td><td>${r.desde}–${r.hasta}</td><td>${r.vigenciaDesde} a ${r.vigenciaHasta}</td></tr>`)
          .join('') || '<tr><td colspan="5" class="vacio">Sin resoluciones.</td></tr>'
      }</tbody></table></div></div>
      <div class="grid g2">
        <div class="card"><div class="card-head"><h2>UVT</h2>${params ? '<button class="btn peq" id="nuevaUvt">Agregar año</button>' : ''}</div><div class="card-body flush"><table class="t"><tbody>${E.parametros.uvt.map((u) => `<tr><td>${u.anio}</td><td class="right num">${$p(u.valor)}</td><td class="small muted">${esc(u.fuente)}</td></tr>`).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-head"><h2>Períodos cerrados</h2>${tieneRol('aprobador') ? '<button class="btn peq" id="cerrarPeriodo">Cerrar un mes</button>' : ''}</div><div class="card-body">${
          Object.entries(E.periodosCerrados)
            .map(([p, x]) => `<div>${p} · cerrado por ${esc(nombreUsuario(x.por))} ${tieneRol('aprobador') ? `<button class="btn peq" data-reabrir="${p}">Reabrir</button>` : ''}</div>`)
            .join('') || '<span class="muted">Ningún período cerrado. Cerrar un mes impide registrar o reversar movimientos con fecha de ese mes.</span>'
        }</div></div>
      </div>
      <div class="card"><div class="card-head"><h2>Conceptos de retención en la fuente</h2>${params ? '<button class="btn peq" id="nuevoConcepto">Agregar o modificar</button>' : ''}</div><div class="card-body flush"><table class="t"><thead><tr><th>Código</th><th>Concepto</th><th class="right">Tarifa</th><th class="right">Base mínima</th><th>Fuente</th></tr></thead><tbody>${E.parametros.conceptosRetencion
        .map((c) => `<tr><td>${esc(c.codigo)}</td><td>${esc(c.nombre)}</td><td class="right num">${N.formatoTarifa(c.ppm)}</td><td class="right num">${c.baseUvt} UVT</td><td class="small muted">${esc(c.fuente)}</td></tr>`)
        .join('')}</tbody></table><div class="aviso warn" style="margin:12px">Valores de partida verificados en noviembre de 2026 (UVT 2026: Resolución DIAN 000238 de 2025; bases del Decreto 572 de 2025). El contador debe revisarlos cada año: un cambio aquí no altera facturas ya registradas.</div></div></div>
      <div class="card"><div class="card-head"><h2>Usuarios</h2>${adm ? '<button class="btn peq" id="nuevoUsuario">Agregar</button>' : ''}</div><div class="card-body flush"><table class="t"><thead><tr><th>Nombre</th><th>Usuario</th><th>Roles</th><th>Estado</th><th></th></tr></thead><tbody>${Object.values(E.usuarios)
        .map((u) => `<tr><td>${esc(u.nombre)}</td><td>${esc(u.usuario)}</td><td>${u.roles.map((r) => N.ROLES[r]).join(', ')}</td><td>${u.activo ? '<span class="tag ok">Activo</span>' : '<span class="tag">Inactivo</span>'}</td><td>${adm ? `<button class="btn peq" data-usuario="${u.id}">Editar</button>` : ''}</td></tr>`)
        .join('')}</tbody></table></div></div>
      <div class="card"><div class="card-head"><h2>Conexión</h2></div><div class="card-body"><dl class="defs"><dt>Modo</dt><dd>${esc(CONEXION.modo === 'nube' ? 'Base de datos en la nube' : CONEXION.modo === 'local' ? 'Solo este equipo' : 'Demostración')}</dd><dt>Ubicación</dt><dd>${esc(CONEXION.ubicacion || '')}</dd><dt>Eventos</dt><dd>${E.seq}</dd></dl>${host.abrirCopias ? '<button class="btn peq" id="abrirCopias" style="margin-top:10px">Abrir carpeta de copias</button>' : ''}</div></div>`;
    const on = (sel, fn) => $(sel) && ($(sel).onclick = fn);
    on('#nuevaEmpresa', () => formEmpresa());
    $$('[data-empresa]', st).forEach((b) => (b.onclick = () => formEmpresa(b.dataset.empresa)));
    on('#nuevaRes', formResolucion);
    on('#nuevaUvt', formUvt);
    on('#nuevoConcepto', formConcepto);
    on('#nuevoUsuario', () => formUsuario());
    $$('[data-usuario]', st).forEach((b) => (b.onclick = () => formUsuario(b.dataset.usuario)));
    on('#cerrarPeriodo', () => {
      const m = ventana({ titulo: 'Cerrar período', clase: 'angosto', cuerpo: `<div class="form"><label class="f">Mes<input name="periodo" type="month" value="${hoy().slice(0, 7)}"></label></div>`, pie: '<button class="btn pri" data-ok>Cerrar</button>' });
      m.querySelector('[data-ok]').onclick = (ev) => accion(ev.target, async () => (await emitir('periodo.cerrado', leerForm(m)), m.cerrar(), render()));
    });
    $$('[data-reabrir]', st).forEach(
      (b) =>
        (b.onclick = () => {
          const m = ventana({ titulo: `Reabrir ${b.dataset.reabrir}`, clase: 'angosto', cuerpo: '<div class="form"><label class="f full">Motivo<input name="motivo"></label></div>', pie: '<button class="btn pri" data-ok>Reabrir</button>' });
          m.querySelector('[data-ok]').onclick = (ev) => accion(ev.target, async () => (await emitir('periodo.reabierto', { periodo: b.dataset.reabrir, ...leerForm(m) }), m.cerrar(), render()));
        }),
    );
    on('#abrirCopias', () => host.abrirCopias());
  };

  function formEmpresa(id) {
    const x = id ? E.empresas[id] : null;
    const m = ventana({
      titulo: x ? x.razonSocial : 'Empresa emisora',
      cuerpo: `<div class="form">
        <label class="f">NIT<input name="nit" value="${x ? x.nit : ''}" ${x ? 'readonly' : ''}></label>
        <label class="f">DV<input name="dv" value="${x ? x.dv : ''}" maxlength="1" ${x ? 'readonly' : ''}></label>
        <label class="f full">Razón social<input name="razonSocial" value="${esc(x ? x.razonSocial : '')}"></label>
        <label class="f">Régimen<select name="regimen">${opciones([['Responsable de IVA', 'Responsable de IVA'], ['No responsable de IVA', 'No responsable de IVA'], ['Régimen simple', 'Régimen simple de tributación']], x ? x.regimen : 'Responsable de IVA')}</select></label>
        <label class="f">Responsabilidades (RUT)<input name="responsabilidades" value="${esc(x ? x.responsabilidades : '')}" placeholder="O-13, O-15, R-99-PN…"></label>
        <label class="f">Actividad CIIU principal<input name="ciiu" value="${esc(x ? x.ciiu : '')}"></label>
        <label class="f">Municipio<input name="municipio" value="${esc(x ? x.municipio : 'Bogotá D.C.')}"></label>
        <label class="f">Tarifa ICA de la actividad (por mil)<input name="ica" value="${x && x.icaPpm ? (x.icaPpm / 1000).toString().replace('.', ',') : ''}" placeholder="ej. 9,66"><span class="ayuda">Según el CIIU y el municipio. Es la que aplicará el cliente agente retenedor de ICA.</span></label>
        <label class="f">Retención en la fuente usual<select name="conceptoRetencion">${opciones(E.parametros.conceptosRetencion.map((c) => [c.codigo, c.nombre]), x ? x.conceptoRetencion : 'SERV-D', 'Ninguna')}</select></label>
        <label class="f check full"><input type="checkbox" name="declarante" ${!x || x.declarante ? 'checked' : ''}> Declarante del impuesto de renta</label>
      </div>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Guardar</button>',
    });
    m.querySelector('[name=nit]').oninput = (e) => {
      if (/^\d{5,}$/.test(N.limpiarNit(e.target.value))) m.querySelector('[name=dv]').value = N.digitoVerificacion(e.target.value);
    };
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        const datos = { razonSocial: d.razonSocial, regimen: d.regimen, responsabilidades: d.responsabilidades, ciiu: d.ciiu, municipio: d.municipio, icaPpm: d.ica ? N.aPpm(d.ica, 'pormil') : 0, conceptoRetencion: d.conceptoRetencion, declarante: d.declarante };
        if (x) await emitir('empresa.actualizada', { id: x.id, ...datos });
        else await emitir('empresa.registrada', { id: N.nuevoId('emp'), nit: d.nit, dv: Number(d.dv), ...datos });
        m.cerrar();
        render();
      });
  }

  function formResolucion() {
    const m = ventana({
      titulo: 'Resolución de facturación',
      cuerpo: `<div class="form">
        <label class="f">Empresa<select name="empresaId">${opciones(Object.values(E.empresas).map((x) => [x.id, x.razonSocial]), '')}</select></label>
        <label class="f">Número de resolución<input name="numero"></label>
        <label class="f">Fecha<input name="fecha" type="date"></label>
        <label class="f">Prefijo<input name="prefijo" maxlength="4"></label>
        <label class="f">Desde el número<input name="desde" inputmode="numeric"></label>
        <label class="f">Hasta el número<input name="hasta" inputmode="numeric"></label>
        <label class="f">Vigente desde<input name="vigenciaDesde" type="date"></label>
        <label class="f">Vigente hasta<input name="vigenciaHasta" type="date"></label>
      </div><p class="ayuda">Los datos están en el formulario 1876 de la DIAN o en el XML de cualquier factura de esa numeración (al cargar un XML, ARKEN PAY ofrece registrarla).</p>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Guardar</button>',
    });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        await emitir('resolucion.registrada', { id: N.nuevoId('res'), ...d, desde: Number(d.desde), hasta: Number(d.hasta) });
        m.cerrar();
        render();
      });
  }

  function formUvt() {
    const m = ventana({ titulo: 'Valor de la UVT', clase: 'angosto', cuerpo: '<div class="form"><label class="f">Año<input name="anio" inputmode="numeric"></label><label class="f">Valor<input name="valor" class="num"></label><label class="f full">Fuente (resolución DIAN)<input name="fuente"></label></div>', pie: '<button class="btn pri" data-ok>Guardar</button>' });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        await emitir('parametro.registrado', { clase: 'uvt', anio: Number(d.anio), valor: N.aCentavos(d.valor), fuente: d.fuente });
        m.cerrar();
        render();
      });
  }
  function formConcepto() {
    const m = ventana({
      titulo: 'Concepto de retención en la fuente',
      cuerpo: `<div class="form"><label class="f">Código (use uno existente para modificarlo)<input name="codigo" list="codConc"><datalist id="codConc">${E.parametros.conceptosRetencion.map((c) => `<option value="${esc(c.codigo)}">`).join('')}</datalist></label><label class="f full">Nombre<input name="nombre"></label><label class="f">Tarifa (%)<input name="tarifa"></label><label class="f">Base mínima (UVT)<input name="baseUvt" value="0"></label><label class="f full">Fuente normativa<input name="fuente"></label></div>`,
      pie: '<button class="btn pri" data-ok>Guardar</button>',
    });
    const cod = m.querySelector('[name=codigo]');
    cod.onchange = () => {
      const c = E.parametros.conceptosRetencion.find((x) => x.codigo === cod.value);
      if (c) {
        m.querySelector('[name=nombre]').value = c.nombre;
        m.querySelector('[name=tarifa]').value = (c.ppm / 10000).toString().replace('.', ',');
        m.querySelector('[name=baseUvt]').value = c.baseUvt;
        m.querySelector('[name=fuente]').value = c.fuente;
      }
    };
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        await emitir('parametro.registrado', { clase: 'conceptoRetencion', codigo: d.codigo.toUpperCase(), nombre: d.nombre, ppm: N.aPpm(d.tarifa), baseUvt: Number(String(d.baseUvt).replace(',', '.')), fuente: d.fuente });
        m.cerrar();
        render();
      });
  }

  function formUsuario(id) {
    const u = id ? E.usuarios[id] : null;
    const m = ventana({
      titulo: u ? u.nombre : 'Nuevo usuario',
      cuerpo: `<div class="form">
        <label class="f">Nombre<input name="nombre" value="${esc(u ? u.nombre : '')}"></label>
        <label class="f">Usuario<input name="usuario" value="${esc(u ? u.usuario : '')}" ${u ? 'readonly' : ''}></label>
        <label class="f">Correo<input name="correo" value="${esc(u ? u.correo : '')}"></label>
        <label class="f">${u ? 'Nueva contraseña temporal (opcional)' : 'Contraseña temporal'}<input name="clave" type="password" autocomplete="new-password"><span class="ayuda">El usuario deberá cambiarla al ingresar.</span></label>
        <div class="full"><div class="eyebrow" style="margin-bottom:6px">Roles</div>${Object.entries(N.ROLES)
          .map(([k, t]) => `<label class="f check"><input type="checkbox" name="rol_${k}" ${u && u.roles.includes(k) ? 'checked' : ''}> ${t}</label>`)
          .join('')}<p class="ayuda">Separe funciones: quien registra facturas (Facturación) no debería registrar pagos (Tesorería), y las reversiones y reclasificaciones las aprueba otra persona (Aprobador).</p></div>
        ${u ? `<label class="f check full"><input type="checkbox" name="activo" ${u.activo ? 'checked' : ''}> Activo</label>` : ''}
      </div>`,
      pie: '<button class="btn" data-cerrar>Cancelar</button><button class="btn pri" data-ok>Guardar</button>',
    });
    m.querySelector('[data-ok]').onclick = (ev) =>
      accion(ev.target, async () => {
        const d = leerForm(m);
        const roles = Object.keys(N.ROLES).filter((k) => d['rol_' + k]);
        let claveHash;
        if (d.clave) {
          N.validarClaveNueva(d.clave);
          claveHash = await N.derivarClave(d.clave);
        }
        if (u) await emitir('usuario.actualizado', { id: u.id, nombre: d.nombre, correo: d.correo, roles, activo: d.activo, claveHash });
        else {
          if (!claveHash) throw new Error('Asigne una contraseña temporal.');
          await emitir('usuario.creado', { id: N.nuevoId('u'), usuario: d.usuario, nombre: d.nombre, correo: d.correo, roles, claveHash, debeCambiarClave: true });
        }
        m.cerrar();
        aviso('Usuario guardado.');
        render();
      });
  }

  window.addEventListener('error', (e) => console.error(e.error || e.message));
  window.addEventListener('unhandledrejection', (e) => fallo(e.reason));
  document.addEventListener('DOMContentLoaded', arrancar);
})();
