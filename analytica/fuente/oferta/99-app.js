/* ══════════════════════════════════════════════════════════════════════════
   ARKEN OFERTA · APP — arranque, entrada (verificación del paquete, usuario
   local y aceptación del acuerdo), barra superior, cinta de totales, riel y
   navegación. Las vistas declaran sus acciones y App las conecta con un solo
   escuchador; todo error llega al usuario con UI.error.
   ══════════════════════════════════════════════════════════════════════════ */
const App = (function(){
  let acciones = {}, cambios = {};
  const gate = () => $('#gateCuerpo');
  const aviso = (msg, tipo) => '<div class="alert ' + (tipo || 'bad') + '">' + msg + '</div>';

  /* ── Arranque ── */
  async function arrancar(){
    $('#gAnio').textContent = new Date().getFullYear();
    aplicarTema();
    let pl;
    try { pl = Plg.leer(); }
    catch(e){ gate().innerHTML = aviso(esc(e.message) + ' Pida a la EMPRESA PRINCIPAL que le envíe de nuevo el paquete.'); return; }
    if (!pl){
      gate().innerHTML = aviso('Este archivo es la plantilla de ARKEN OFERTA y no trae un pliego. Abra el ARKEN_OFERTA que viene dentro del paquete de invitación que le envió la EMPRESA PRINCIPAL.', 'info');
      return;
    }
    document.title = 'ARKEN OFERTA — ' + pl.proceso.codigo + ' · ' + pl.invitado.razonSocial;
    const r = await AlmacenOferta.abrir();
    AlmacenOferta.alGuardar(() => UI.marcaGuardado(AlmacenOferta.enMemoria() ? 'memoria' : 'guardado'));
    $('#cintaDemo').classList.toggle('hide', !pl.proceso.demo);
    const previa = await Verificacion.previa(pl, await Cripto.sha256(Plg.texto()));
    if (r.enMemoria) RegistroTecnico.anotar('almacén', new Error('IndexedDB no disponible: solo en memoria'));
    if (previa) pantallaUsuario(pl, previa); else pantallaVerificar(pl);
  }
  function encabezadoProceso(pl){
    return '<div class="small"><b>' + esc(pl.proceso.codigo) + ' · ' + esc(pl.proceso.nombre) + '</b>' + (pl.proceso.demo ? ' ' + UI.tag('DEMOSTRACIÓN', 'demo') : '') +
      '<br>EMPRESA PRINCIPAL: ' + esc(pl.empresaPrincipal.razonSocial) + (pl.empresaPrincipal.nit ? ' · NIT ' + esc(pl.empresaPrincipal.nit) : '') +
      '<br>Invitado: <b>' + esc(pl.invitado.razonSocial) + '</b> · NIT ' + esc(pl.invitado.nit) + '<br>' + (pl.etapa === 'confidencialidad' ? 'Primer envío: acuerdo de confidencialidad' : 'Pliego versión ' + pl.versionPliego) + '</div>';
  }

  /* ── 1. Verificación del paquete (§13) ── */
  function pantallaVerificar(pl, resultado){
    gate().innerHTML = encabezadoProceso(pl) + (AlmacenOferta.enMemoria() ? aviso('Este navegador no permite guardar datos (IndexedDB): lo que haga se pierde al cerrar. Use «Guardar borrador en archivo» con frecuencia.', 'warn') : '') +
      (resultado || '<p class="small">Antes de empezar, el programa comprueba que el paquete es auténtico y que ningún archivo fue alterado. Elija el archivo <b>' +
        esc(Paquete.nombrePaquete(pl.proceso.codigo, pl.invitado.razonSocial, pl.versionPliego, pl.etapa)) + '</b> que recibió (el ZIP, sin descomprimir o comprimido de nuevo tal cual).</p>') +
      '<button class="btn primary block" id="gVerificar" type="button">Elegir el paquete y verificarlo</button>';
    $('#gVerificar').onclick = async () => {
      const [f] = await UI.elegirArchivos('.zip');
      if (!f) return;
      $('#gVerificar').disabled = true; $('#gVerificar').textContent = 'Verificando…';
      try {
        const r = await Verificacion.verificar(f, pl, Plg.texto());
        if (!r.ok){
          pantallaVerificar(pl, aviso('<b>El paquete no es válido: no se puede ofertar sobre él.</b><ul class="verif">' + r.problemas.map(x => '<li><b>' + esc(x.ruta) + '</b>: ' + esc(x.motivo) + '</li>').join('') + '</ul>' +
            'Pida a la EMPRESA PRINCIPAL que le envíe el paquete de nuevo.' + (r.huellaFirma ? '<span class="huella">Huella de la llave de firma que trae este programa: ' + esc(r.huellaFirma) + '</span>' : '')));
          return;
        }
        const reg = await Verificacion.guardar(pl, r);
        pantallaUsuario(pl, reg, true);
      } catch(e){ RegistroTecnico.anotar('verificar', e); pantallaVerificar(pl, aviso(esc(e.message))); }
    };
  }

  /* ── 2. Usuario local ── */
  async function pantallaUsuario(pl, verif, recien){
    const u = await AlmacenOferta.leer('usuarios', pl.invitado.codigoInvitacion);
    const ok = aviso('<b>Pliego auténtico, versión ' + pl.versionPliego + '.</b> ' + (recien ? 'Se verificaron la firma y ' + verif.archivos + ' archivos.' : 'Verificado el ' + Util.fmtSello(verif.fecha) + '.') +
      '<span class="huella">Huella de la llave de firma del proceso: ' + esc(verif.huellaFirma) + '</span><span class="small">Si tiene dudas, pida a la EMPRESA PRINCIPAL que se la confirme por teléfono.</span>', 'ok');
    const crear = !u;
    gate().innerHTML = encabezadoProceso(pl) + ok +
      '<p class="small">' + (crear ? 'Cree un usuario local con contraseña: sus borradores no quedan abiertos en este equipo.' : 'Ingrese con su usuario local.') + '</p>' +
      '<div class="field"><label for="gUser">Usuario</label><input id="gUser" type="text" autocomplete="username" spellcheck="false" value="' + esc(u ? u.usuario : '') + '"></div>' +
      '<div class="field"><label for="gPass">Contraseña' + (crear ? ' (8 caracteres como mínimo)' : '') + '</label><input id="gPass" type="password" autocomplete="' + (crear ? 'new-password' : 'current-password') + '"></div>' +
      (crear ? '<div class="field"><label for="gPass2">Repita la contraseña</label><input id="gPass2" type="password" autocomplete="new-password"></div>' : '') +
      '<div id="gateErr"></div><button class="btn primary block" id="gBtn" type="button">' + (crear ? 'Crear usuario y empezar' : 'Ingresar') + '</button>' +
      (crear ? '' : '<button class="btn ghost sm" id="gReverificar" type="button">Verificar de nuevo el paquete</button>');
    const entrarConClave = async () => {
      const usuario = $('#gUser').value.trim(), clave = $('#gPass').value;
      const err = m => { $('#gateErr').innerHTML = aviso(esc(m)); };
      if (crear){
        if (!usuario) return err('Escriba un nombre de usuario.');
        if (clave.length < 8) return err('La contraseña debe tener al menos 8 caracteres.');
        if (clave !== $('#gPass2').value) return err('Las dos contraseñas no coinciden.');
        await AlmacenOferta.poner('usuarios', { id:pl.invitado.codigoInvitacion, usuario, clave:await Cripto.hashContrasena(clave), creado:new Date().toISOString() });
        return entrar(pl, usuario);
      }
      if (Util.normaliza(usuario) !== Util.normaliza(u.usuario) || !(await Cripto.verificarContrasena(clave, u.clave))) return err('Usuario o contraseña incorrectos.');
      return entrar(pl, u.usuario);
    };
    $('#gBtn').onclick = () => { $('#gBtn').disabled = true; entrarConClave().catch(e => UI.error(e, 'ingresar')).finally(() => { const b = $('#gBtn'); if (b) b.disabled = false; }); };
    $('#gPass').addEventListener('keydown', e => { if (e.key === 'Enter' && !crear) $('#gBtn').click(); });
    if ($('#gReverificar')) $('#gReverificar').onclick = () => pantallaVerificar(pl);
    (crear ? $('#gUser') : $('#gPass')).focus();
  }

  /* ── 3. Borrador y, si aplica, aceptación del acuerdo ── */
  async function entrar(plIncrustado, usuario){
    let b = await AlmacenOferta.leer('borradores', plIncrustado.invitado.codigoInvitacion);
    if (!b){ b = Borrador.nuevo(plIncrustado); await AlmacenOferta.poner('borradores', b); }
    if (b.pliegoAdenda && Number(b.pliegoAdenda.versionPliego) > Number(plIncrustado.versionPliego)) Plg.usar(b.pliegoAdenda);
    Oferta.usar(b);
    Sesion.usuario = { usuario, nombre:usuario };
    S.empresa = empresaPdf(b);
    const pl = Oferta.pl();
    if (pl.etapa !== 'confidencialidad' && pl.proceso.envios === 'uno' && !b.acuerdo) return pantallaAcuerdo(pl, b);
    mostrar();
  }
  function pantallaAcuerdo(pl, b){
    gate().innerHTML = encabezadoProceso(pl) +
      '<p><b>Acuerdo de confidencialidad</b></p><p class="small">Antes de ver los documentos del proceso debe aceptar el acuerdo de confidencialidad (' + esc(pl.acuerdo.nombre) + ', en la carpeta del paquete). ' +
      'Al aceptarlo, usted declara que tiene facultades para obligar a ' + esc(pl.invitado.razonSocial) + ' y que la información del proceso se usará solo para preparar esta oferta. ' +
      'Además, debe adjuntar el acuerdo firmado antes de generar el sobre.</p>' +
      '<div class="field"><label for="acNombre">Nombre de quien acepta</label><input id="acNombre" type="text"></div><div class="field"><label for="acDoc">Documento de identidad</label><input id="acDoc" type="text"></div>' +
      '<label class="checkline"><input type="checkbox" id="acOk"> Leí y acepto el acuerdo de confidencialidad del proceso ' + esc(pl.proceso.codigo) + '</label><div id="gateErr"></div>' +
      '<button class="btn primary block" id="acBtn" type="button">Aceptar y continuar</button>';
    $('#acBtn').onclick = async () => {
      const n = $('#acNombre').value.trim(), d = $('#acDoc').value.trim();
      if (!n || !d || !$('#acOk').checked){ $('#gateErr').innerHTML = aviso('Escriba su nombre y documento y marque la aceptación.'); return; }
      b.acuerdo = { aceptado:true, nombre:n, documento:d, fecha:new Date().toISOString(), usuario:Sesion.usuario.usuario, huellaTexto:pl.acuerdo.huellaTexto || '' };
      await Oferta.guardar(); mostrar();
    };
  }
  function mostrar(){
    $('#gate').style.display = 'none';
    ['#topbar', '#ledger', '#shell'].forEach(s => $(s).style.display = '');
    Sesion.modulo = '00';
    conectar();
    iniciarInactividad();
    render();
  }
  function salir(motivo){
    Sesion.usuario = null; Oferta.usar(null);
    $('#modales').innerHTML = '';
    ['#topbar', '#ledger', '#shell'].forEach(s => $(s).style.display = 'none');
    $('#gate').style.display = '';
    const pl = Plg.incrustado();
    Plg.usar(pl);
    Cripto.sha256(Plg.texto()).then(h => Verificacion.previa(pl, h)).then(v => { pantallaUsuario(pl, v); if (motivo) $('#gateErr').innerHTML = aviso(esc(motivo), 'info'); });
  }

  /* ── Inactividad: 20 minutos sin uso cierran la sesión ── */
  let temporizador = null, conectado = false;
  function reiniciar(){ if (!Sesion.usuario) return; clearTimeout(temporizador); temporizador = setTimeout(() => { if (Sesion.usuario) salir('La sesión se cerró por inactividad.'); }, 20 * 60000); }
  function iniciarInactividad(){ ['mousemove','keydown','click','touchstart'].forEach(ev => document.addEventListener(ev, reiniciar, { passive:true })); reiniciar(); }

  /* ── Tema ── */
  function aplicarTema(){ let t = 'claro'; try { t = localStorage.getItem('arken-oferta-tema') || 'claro'; } catch(e){} document.documentElement.dataset.tema = t; }
  function cambiarTema(){
    const t = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
    document.documentElement.dataset.tema = t;
    try { localStorage.setItem('arken-oferta-tema', t); } catch(e){}
  }

  /* ── Barra, cinta y riel ── */
  function conectar(){
    if (conectado) return;
    conectado = true;
    $('#btnSalir').onclick = () => salir();
    $('#btnTema').onclick = cambiarTema;
    $('#btnBorradorArchivo').onclick = () => Intercambio.borradorArchivo(Oferta.borrador()).then(r => { UI.descargar(r.nombre, r.blob); UI.toast('Borrador guardado en ' + r.nombre + '. Contiene su oferta: guárdelo en un lugar seguro.', 'ok'); }).catch(e => UI.error(e, 'borrador en archivo'));
    const stage = $('#stage');
    stage.addEventListener('click', e => {
      const t = e.target.closest('[data-pestana]');
      if (t && stage.contains(t)){ Sesion.pestanas[t.dataset.pestana] = t.dataset.id; render(); return; }
      const b = e.target.closest('[data-accion]');
      if (!b || !stage.contains(b) || b.disabled || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      ejecutar(acciones, b.dataset.accion, b);
    });
    stage.addEventListener('change', e => {
      const el = e.target.closest('[data-cambio]');
      if (el && stage.contains(el)) ejecutar(cambios, el.dataset.cambio, el);
    });
  }
  async function ejecutar(mapa, nombre, el){
    const fn = mapa[nombre];
    if (!fn){ RegistroTecnico.anotar('acción', new Error('Acción sin definir: ' + nombre)); return; }
    try { await fn(el); } catch(e){ UI.error(e, nombre); }
  }
  function celda(lab, val, sub, clase){
    return '<div class="ledger-cell' + (clase ? ' ' + clase : '') + '"><div class="lab">' + esc(lab) + '</div><div class="val">' + val + '</div>' + (sub || '') + '</div>';
  }
  function pintarCinta(){
    const b = Oferta.borrador(), pl = Oferta.pl();
    if (!b) return;
    const av = Borrador.avance(b, pl);
    const falta = instanteCierre(pl) - Date.now();
    const dias = !isFinite(falta) ? '—' : falta <= 0 ? 'Cerrado' : Math.ceil(falta / 86400000) + ' día(s)';
    const barra = '<div class="ledger-bar" aria-label="Avance ' + av + ' %"><i style="width:' + av + '%"></i></div>';
    if (pl.etapa === 'confidencialidad'){
      $('#ledger').innerHTML = celda('Entrega', 'Confidencialidad') + celda('Avance', av + ' %', barra) + '<div class="ledger-cell total grow"><div class="lab">Proceso</div><div class="val">' + esc(pl.proceso.codigo) + '</div></div>';
      return;
    }
    const t = Borrador.calculo(b, pl).totales;
    $('#ledger').innerHTML = celda('Valor de la oferta', money(t.total)) + celda('Costo directo', money(t.costoDirecto)) + celda('AIU', money(t.aiu), '<div class="lab" style="margin:2px 0 0;text-transform:none;letter-spacing:0">' + t.pctA + ' / ' + t.pctI + ' / ' + t.pctU + ' %</div>') +
      celda('Avance', av + ' %', barra) + '<div class="ledger-cell total grow"><div class="lab">Días al cierre</div><div class="val">' + esc(dias) + '</div></div>';
  }
  function pintarRail(){
    const pl = Oferta.pl();
    $('#railList').innerHTML = modulosOferta(pl).map(([id, nombre]) => '<button class="nav-item' + (id === Sesion.modulo ? ' active' : '') + '" data-m="' + id + '" type="button"' + (id === Sesion.modulo ? ' aria-current="page"' : '') +
      '><span class="nav-n">' + id + '</span><span class="nav-t">' + esc(nombre) + '</span></button>').join('');
    $$('#railList .nav-item').forEach(b => b.onclick = () => ir(b.dataset.m));
    $('#railUsuario').innerHTML = '<b>' + esc(Sesion.usuario.usuario) + '</b><br>' + esc(Oferta.borrador().proponente.razonSocial);
    $('#tbProceso').innerHTML = esc(pl.proceso.codigo + ' · ' + pl.invitado.razonSocial) + (pl.proceso.demo ? ' ' + UI.tag('DEMO', 'demo') : '');
  }
  function render(){
    if (!Sesion.usuario || !Oferta.borrador()) return;
    const pl = Oferta.pl();
    if (!modulosOferta(pl).some(m => m[0] === Sesion.modulo)) Sesion.modulo = '00';
    pintarCinta(); pintarRail();
    let v;
    try { v = Vistas[Sesion.modulo](); }
    catch(e){ RegistroTecnico.anotar('vista ' + Sesion.modulo, e); v = { html:cabecera(Sesion.modulo, 'No se pudo mostrar este módulo') + '<div class="nota bad">' + esc(e.message) + '</div>' }; }
    $('#stage').innerHTML = v.html;
    acciones = Object.assign({ 'cargar-borrador':cargarBorrador }, v.acciones || {});
    cambios = v.cambios || {};
  }
  async function cargarBorrador(){
    const [f] = await UI.elegirArchivos('.zip');
    if (!f) return;
    const r = await Intercambio.leerBorradorArchivo(f, Plg.incrustado());
    if (!(await UI.confirmar({ titulo:'Cargar borrador', textoAceptar:'Reemplazar mi borrador', claseAceptar:'danger',
      mensaje:'El borrador guardado el ' + Util.fmtSello(r.guardado) + ' reemplaza el que tiene ahora en este equipo (' + Util.fmtSello(Oferta.borrador().actualizado) + ').' }))) return;
    Oferta.usar(r.borrador);
    if (r.borrador.pliegoAdenda) Plg.usar(r.borrador.pliegoAdenda); else Plg.usar(Plg.incrustado());
    await Oferta.guardar(); UI.toast('Borrador cargado', 'ok'); render();
  }
  function ir(m){ Sesion.modulo = m; render(); window.scrollTo(0, 0); }
  return { arrancar, render, ir, salir, pintarCinta };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.arrancar().catch(e => {
    RegistroTecnico.anotar('arranque', e);
    const el = document.getElementById('gateCuerpo');
    if (el) el.innerHTML = '<div class="alert bad">El programa no pudo arrancar: ' + Util.esc(e.message) + '</div>';
  });
});
