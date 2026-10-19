/* ══════════════════════════════════════════════════════════════════════════
   APP — arranque, ingreso, barra superior, cinta de totales, riel y
   navegación. Las vistas declaran sus acciones; aquí se conectan con un solo
   escuchador delegado, y todo error llega al usuario con UI.error.
   ══════════════════════════════════════════════════════════════════════════ */
const App = (function(){
  let acciones = {}, alPintar = null;

  /* ── Arranque ── */
  async function arrancar(){
    prepararPdfjs();
    const r = await Almacen.abrir();
    if (!(S.parametros||[]).length) for (const x of Parametros.iniciales()) await Almacen.poner('parametros', x);
    await Usuarios.asegurarAdministrador();
    Almacen.alGuardar(() => UI.marcaGuardado(Almacen.enMemoria() ? 'memoria' : 'guardado'));
    if (r.enMemoria) UI.marcaGuardado('memoria');
    aplicarApariencia();
    $('#gAnio').textContent = new Date().getFullYear();
    conectarIngreso();
    conectarBarra();
    conectarEscenario();
    const u = (S.usuarios||[]).find(x => x.usuario === 'admin');
    if (u && u.debeCambiar && S.usuarios.length === 1) $('#gHint').textContent = 'Primer ingreso: admin / arken';
    if (r.enMemoria) mostrarErrorIngreso('Este navegador no permite guardar datos (IndexedDB). Puede usar el programa, pero lo que haga se pierde al cerrar: descargue un respaldo antes de salir.', 'warn');
    $('#gBtn').disabled = false;
    $('#gUser').focus();
  }
  /** pdf.js necesita su worker; viaja dentro del programa en base64 y se
      carga como blob, sin internet. */
  function prepararPdfjs(){
    const w = $('#pdfjs-worker');
    if (!window.pdfjsLib || !w) return;
    try {
      const bin = atob(w.textContent.trim());
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([bytes], { type:'text/javascript' }));
    } catch(e){ RegistroTecnico.anotar('pdf.js', e); }
  }

  /* ── Ingreso ── */
  function mostrarErrorIngreso(msg, tipo){ $('#gateErr').innerHTML = msg ? '<div class="alert ' + (tipo || 'bad') + '">' + esc(msg) + '</div>' : ''; }
  function conectarIngreso(){
    $('#gUser').addEventListener('keydown', e => { if (e.key === 'Enter') $('#gPass').focus(); });
    $('#gPass').addEventListener('keydown', e => { if (e.key === 'Enter') ingresar(); });
    $('#gBtn').onclick = ingresar;
    $('#gRestaurar').onclick = () => restaurarDesdeIngreso().catch(e => UI.error(e, 'Restaurar respaldo'));
  }
  async function ingresar(){
    const b = $('#gBtn');
    if (b.disabled) return;
    b.disabled = true;
    try {
      const u = await Usuarios.ingresar($('#gUser').value.trim(), $('#gPass').value);
      if (!u){ mostrarErrorIngreso('Usuario o contraseña incorrectos.'); $('#gPass').select(); return; }
      mostrarErrorIngreso('');
      if (u.debeCambiar) cambioObligatorio(u); else await entrar(u);
    } finally { b.disabled = false; }
  }
  function cambioObligatorio(u){
    UI.modal({ titulo:'Cambie su contraseña', eyebrow:'Primer ingreso', fijo:true,
      cuerpo:'<p class="small">Por seguridad, cambie la contraseña inicial antes de continuar. Use al menos 8 caracteres.</p>' +
        '<div class="form"><div class="field c2"><label for="ccA">Contraseña nueva</label><input id="ccA" type="password" autocomplete="new-password"></div>' +
        '<div class="field c2"><label for="ccB">Repita la contraseña</label><input id="ccB" type="password" autocomplete="new-password"></div></div>',
      botones:[{ texto:'Cambiar y continuar', clase:'primary', accion:async m => {
        const a = $('#ccA', m.el).value, c = $('#ccB', m.el).value;
        if (a !== c) throw new Error('Las dos contraseñas no coinciden.');
        if (a === 'arken') throw new Error('Use una contraseña distinta de la inicial.');
        const nuevo = await Usuarios.cambiarClave(u, a);
        m.cerrar();
        await entrar(nuevo);
        await Auditoria.registrar('cambiar', 'contraseña', 'Cambio obligatorio del primer ingreso');
      } }] });
  }
  async function entrar(u){
    Sesion.usuario = u;
    $('#gate').style.display = 'none';
    ['#topbar', '#ledger', '#shell'].forEach(s => $(s).style.display = '');
    $('#gPass').value = '';
    Inactividad.iniciar();
    await ClaveIA.iniciar();
    await Auditoria.registrar('ingresar', 'sesión', u.usuario);
    let ultimo = null;
    try { ultimo = localStorage.getItem('arken-analytica-proceso'); } catch(e){}
    Sesion.procesoActivo = Modelo.proceso(ultimo) ? ultimo : ((Modelo.procesos()[0] || {}).id || null);
    Sesion.modulo = Sesion.procesoActivo ? '00' : '01';
    render();
  }
  function salir(mensaje){
    if (Sesion.usuario) Auditoria.registrar('salir', 'sesión', Sesion.usuario.usuario + (mensaje ? ' · ' + mensaje : ''));
    Sesion.usuario = null; Sesion.pestanas = {}; Sesion.llaves = {};
    ClienteIA.olvidar();
    Inactividad.detener();
    $('#modales').innerHTML = '';
    ['#topbar', '#ledger', '#shell'].forEach(s => $(s).style.display = 'none');
    $('#cintaDemo').classList.add('hide');
    $('#gate').style.display = '';
    mostrarErrorIngreso(mensaje || '', 'info');
    $('#gUser').focus();
  }
  /** Restaurar desde la pantalla de ingreso exige un administrador de los
      datos que hoy tiene este equipo: nadie reemplaza todo sin credenciales. */
  async function restaurarDesdeIngreso(){
    const v = await UI.pedir({ titulo:'Restaurar respaldo', eyebrow:'Requiere un administrador', ancho:'', textoAceptar:'Continuar',
      antes:'<p class="small">Escriba el usuario y la contraseña de un administrador de este equipo. Luego elija el archivo .zip del respaldo.</p>',
      campos:[{ k:'usuario', lab:'Usuario', c2:true }, { k:'clave', lab:'Contraseña', tipo:'password', c2:true }] });
    if (!v) return;
    const u = await Usuarios.ingresar(v.usuario, v.clave);
    if (!u || (u.roles||[]).indexOf('administrador') < 0) throw new Error('Esas credenciales no son de un administrador de este equipo.');
    const [f] = await UI.elegirArchivos('.zip');
    if (!f) return;
    Sesion.usuario = u;
    try { await Respaldo.restaurar(f, () => { mostrarErrorIngreso('Respaldo restaurado. Ingrese con un usuario del respaldo.', 'ok'); }); }
    finally { Sesion.usuario = null; aplicarApariencia(); }
  }
  function recargar(){ Sesion.procesoActivo = null; aplicarApariencia(); salir('Respaldo restaurado. Ingrese de nuevo con un usuario del respaldo.'); }

  /* ── Barra superior ── */
  function conectarBarra(){
    $('#btnSalir').onclick = () => salir();
    $('#btnAdmin').onclick = () => ir('admin');
    $('#btnConfig').onclick = () => ir('config');
    $('#btnCargarOfertas').onclick = () => { if (!Modelo.activo()){ UI.toast('Abra un proceso primero', 'bad'); return; } Sesion.pestanas.rec = 'recepcion'; ir('09'); };
    $('#btnAlertas').onclick = () => Bandeja.abrir().catch(e => UI.error(e, 'Bandeja de alertas'));
  }
  function pintarBarra(){
    const p = Modelo.activo();
    $('#tbProceso').innerHTML = p ? esc(p.codigo + ' · ' + p.estado) + etiquetaDemo(p) : '— sin proceso seleccionado —';
    $('#btnAdmin').style.display = Permisos.puede('administrar') || Permisos.puede('respaldar') ? '' : 'none';
    Bandeja.pintarContador();
    pintarLogoEmpresa();
  }
  function pintarLogoEmpresa(){
    const s = $('#logoEmpresa');
    if (S.empresa.logo){ s.className = 'logo-slot has-logo'; s.innerHTML = '<img alt="Logo empresa">'; $('img', s).src = S.empresa.logo; }
    else { s.className = 'logo-slot'; s.textContent = 'Logo empresa'; }
  }
  function aplicarApariencia(){
    const c = S.config || {}, raiz = document.documentElement;
    raiz.dataset.density = c.densidad || 'normal';
    raiz.dataset.tema = c.tema || 'claro';
    /* Los colores propios solo en tema claro: en oscuro mandan los tokens del tema. */
    const claro = raiz.dataset.tema !== 'oscuro';
    if (claro && c.colorPrimario && c.colorPrimario.toUpperCase() !== '#16181A') raiz.style.setProperty('--ink', c.colorPrimario); else raiz.style.removeProperty('--ink');
    if (claro && c.colorSecundario && c.colorSecundario.toUpperCase() !== '#A98B54') raiz.style.setProperty('--brass', c.colorSecundario); else raiz.style.removeProperty('--brass');
    if (c.fuente && c.fuente !== 'Inter') raiz.style.setProperty('--font-body', '"' + c.fuente + '",system-ui,sans-serif'); else raiz.style.removeProperty('--font-body');
    raiz.style.setProperty('--logo-escala', String((Number(c.escalaLogo)||200) / 100));
    pintarLogoEmpresa();
  }

  /* ── Cinta de totales ── */
  function celda(lab, val, sub, clase){
    return '<div class="ledger-cell' + (clase ? ' ' + clase : '') + '"><div class="lab">' + esc(lab) + '</div><div class="val">' + val + '</div>' +
      (sub ? '<div class="lab" style="margin:2px 0 0;text-transform:none;letter-spacing:0">' + sub + '</div>' : '') + '</div>';
  }
  function pintarCinta(){
    const l = $('#ledger');
    const p = Modelo.activo();
    if (!p){
      const lista = Modelo.procesos();
      l.innerHTML = celda('Procesos', String(lista.length), 'Activos en este equipo') +
        celda('En preparación', String(lista.filter(x => Modelo.editable(x)).length), '') +
        celda('Emitidos', String(lista.filter(x => !Modelo.editable(x)).length), '') +
        '<div class="ledger-cell total grow"><div class="lab">Proceso</div><div class="val">Sin proceso abierto</div></div>';
      return;
    }
    const pres = Modelo.presupuesto(p.id), t = Calculo.totales(pres);
    const inv = Modelo.invitados(p.id).filter(i => i.estado !== 'retirado').length;
    const ci = Cronograma.hito(p.cronograma, 'cierre');
    let dias = '—', sub = 'Sin fecha de cierre';
    if (ci && ci.fecha){
      const falta = new Date(Cronograma.instante(ci)).getTime() - Date.now();
      dias = falta <= 0 ? 'Cerrado' : String(Math.ceil(falta / 86400000));
      sub = Util.fmtFecha(ci.fecha) + ' ' + esc(ci.hora || '');
    }
    const oculto = ocultarPrecios();
    l.innerHTML = celda('Presupuesto base', oculto ? '—' : money(t.total), oculto ? 'Oculto hasta terminar la calificación' : 'Costo directo ' + money(t.costoDirecto)) +
      celda('Invitados / ofertas', inv + ' / ' + Recepcion.vigentes(p.id).length, Recepcion.ofertas(p.id).length ? Recepcion.ofertas(p.id).length + ' abierta(s)' : 'Sobres vigentes') +
      celda('Oferta más baja', masBaja(p), 'Recalculada, después de la apertura') +
      celda('Días al cierre', dias, sub) +
      '<div class="ledger-cell total grow"><div class="lab">Estado del proceso</div><div class="val">' + esc(p.estado) + (p.demo ? ' · DEMO' : '') + '</div></div>';
  }

  function masBaja(p){
    const L = Recepcion.ofertas(p.id).map(o => o.recalculo.totales.total).filter(v => v > 0);
    return L.length ? money(Math.min.apply(null, L)) : '—';
  }

  /* ── Riel ── */
  const REQUIERE_PROCESO = ['00','02','04','05','06','07','08','09','10','11','12','13','14','15','16'];
  function pintarRail(){
    const p = Modelo.activo();
    $('#railList').innerHTML = MODULOS.map(m => {
      const motivo = m.fase ? 'Llega en la Fase ' + m.fase : (!p && REQUIERE_PROCESO.indexOf(m.id) >= 0 && m.id !== '00') ? 'Abra un proceso primero' : '';
      return '<button class="nav-item' + (m.id === Sesion.modulo ? ' active' : '') + (motivo ? ' off' : '') + '" data-m="' + m.id + '" type="button"' + (motivo ? ' title="' + esc(motivo) + '"' : '') +
        (m.id === Sesion.modulo ? ' aria-current="page"' : '') + '><span class="nav-n">' + m.id + '</span><span class="nav-t">' + esc(m.nombre) + '</span></button>';
    }).join('');
    $$('#railList .nav-item').forEach(b => b.onclick = () => ir(b.dataset.m));
    const u = Sesion.usuario;
    $('#railUsuario').innerHTML = u ? '<b>' + esc(u.nombre || u.usuario) + '</b><br>' + esc((u.roles||[]).map(Roles.nombre).map(n => n.split(' (')[0]).join(', ')) : '';
  }

  /* ── Escenario ── */
  function conectarEscenario(){
    const stage = $('#stage');
    stage.addEventListener('click', e => {
      const t = e.target.closest('[data-pestana]');
      if (t && stage.contains(t)){ Sesion.pestanas[t.dataset.pestana] = t.dataset.id; render(); return; }
      const b = e.target.closest('[data-accion]');
      if (!b || !stage.contains(b) || b.tagName === 'INPUT' || b.disabled) return;
      ejecutar(b);
    });
    stage.addEventListener('change', e => {
      const b = e.target.closest('input[data-accion]');
      if (b && stage.contains(b)) ejecutar(b);
    });
  }
  async function ejecutar(el){
    const nombre = el.dataset.accion;
    const fn = acciones[nombre];
    if (!fn){ RegistroTecnico.anotar('acción', new Error('Acción sin definir: ' + nombre)); return; }
    try { await fn(el); }
    catch(e){ UI.error(e, nombre); if (el.type === 'checkbox') render(); }
  }
  function render(){
    if (!Sesion.usuario) return;
    if (Sesion.procesoActivo && !Modelo.proceso(Sesion.procesoActivo)) Sesion.procesoActivo = null;
    pintarBarra(); pintarCinta(); pintarRail();
    const vista = Vistas[Sesion.modulo] || Vistas['01'];
    let v;
    try { v = vista(); }
    catch(e){
      RegistroTecnico.anotar('vista ' + Sesion.modulo, e);
      v = { html:cabecera(Sesion.modulo, 'No se pudo mostrar este módulo') + '<div class="nota bad">' + esc(e.message) + '. El detalle quedó en Administración › Registro técnico.</div>' };
    }
    const stage = $('#stage');
    stage.innerHTML = v.html;
    acciones = v.acciones || {};
    alPintar = v.alPintar || null;
    if (alPintar) try { alPintar(); } catch(e){ RegistroTecnico.anotar('alPintar ' + Sesion.modulo, e); }
    $('#cintaDemo').classList.toggle('hide', !Modelo.hayDemo());
  }
  function ir(modulo){
    Sesion.modulo = modulo;
    render();
    const s = $('#stage'); if (s) s.scrollTop = 0;
    window.scrollTo(0, 0);
  }
  function abrirProceso(id, modulo){
    Sesion.procesoActivo = id;
    try { localStorage.setItem('arken-analytica-proceso', id); } catch(e){}
    ir(modulo || '00');
  }
  return { arrancar, render, ir, abrirProceso, salir, recargar, aplicarApariencia };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.arrancar().catch(e => {
    RegistroTecnico.anotar('arranque', e);
    const el = document.getElementById('gateErr');
    if (el) el.innerHTML = '<div class="alert bad">El programa no pudo arrancar: ' + Util.esc(e.message) + '</div>';
  });
});
