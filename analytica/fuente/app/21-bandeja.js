/* ─────────────── Bandeja de alertas (§18.11) ───────────────
   En la barra superior. Cada alerta con su nivel, qué encontró, por qué
   importa, la regla y qué hacer, y su evidencia: desde la bandeja, un clic
   lleva al renglón del presupuesto, al requisito o al documento con su
   página (criterio 7: a lo sumo dos clics). Estados: nueva, en revisión,
   descartada (con motivo) y confirmada. */
const Bandeja = (function(){
  const TAG_NIVEL = { 'crítica':'bad', 'importante':'warn', 'observación':'info' };
  const TAG_ESTADO = { nueva:'brass', 'en revisión':'info', descartada:'', confirmada:'bad' };
  const filtro = { nivel:'', estado:'abiertas', oferta:'' };

  function pintarContador(){
    const el = $('#tbAlertas'); if (!el) return;
    const p = Modelo.activo();
    const n = p ? Evaluacion.abiertas(p).length : 0;
    el.textContent = String(n);
    el.classList.toggle('hay', n > 0);
  }

  function visibles(p){
    return Evaluacion.alertas(p.id).filter(a => {
      const e = Alertas.estado(a);
      if (filtro.estado === 'abiertas' && (a.vigente === false || ['nueva','en revisión'].indexOf(e) < 0)) return false;
      if (filtro.estado && filtro.estado !== 'abiertas' && filtro.estado !== 'todas' && e !== filtro.estado) return false;
      if (filtro.nivel && a.alerta.nivel !== filtro.nivel) return false;
      if (filtro.oferta && a.alerta.ofertas.indexOf(filtro.oferta) < 0) return false;
      return true;
    }).sort((a, b) => Alertas.NIVELES.indexOf(a.alerta.nivel) - Alertas.NIVELES.indexOf(b.alerta.nivel) || (a.alerta.titulo < b.alerta.titulo ? -1 : 1));
  }

  function evidencia(x, k, i){
    const t = x.tipo === 'renglon' ? (x.codigo ? 'Renglón ' + x.codigo : 'Totales de la oferta') : x.tipo === 'requisito' ? 'Requisito ' + x.codigo : x.tipo === 'documento' ? x.nombre + ' · página ' + (x.pagina || 1) : x.campo + ': ' + x.valor;
    return '<a href="#" class="evid" data-al="' + k + '" data-ev="' + i + '">' + esc(t) + '</a>';
  }
  function tarjeta(p, a, k){
    const x = a.alerta, e = Alertas.estado(a);
    const nombres = x.ofertas.map(id => (Recepcion.ofertas(p.id).find(o => o.id === id) ? Evaluacion.nombreOferta(p, Recepcion.ofertas(p.id).find(o => o.id === id)) : id));
    const ult = (a.estados||[]).slice(-1)[0] || {};
    return '<div class="alerta-item nivel-' + idDom(x.nivel) + '">' +
      '<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><div>' + UI.tag(x.nivel, TAG_NIVEL[x.nivel]) + ' ' + UI.tag(x.grupo, '') + ' ' + UI.tag(a.vigente === false ? 'ya no se presenta' : e, a.vigente === false ? '' : TAG_ESTADO[e]) + '</div>' +
        '<div class="small muted">' + esc(nombres.join(' · ')) + '</div></div>' +
      '<div class="alerta-titulo">' + esc(x.titulo) + '</div>' +
      (x.donde ? '<div class="small">' + esc(x.donde) + '</div>' : '') +
      '<div class="small"><b>Por qué importa:</b> ' + esc(x.porque) + '</div>' +
      '<div class="small"><b>Regla:</b> ' + esc(x.regla) + '</div>' +
      '<div class="small"><b>Qué hacer:</b> ' + esc(x.accion) + '</div>' +
      (x.recordatorio ? '<div class="small muted">' + esc(x.recordatorio) + '</div>' : '') +
      '<div class="small"><b>Evidencia:</b> ' + x.evidencia.map((ev, i) => evidencia(ev, k, i)).join(' · ') + '</div>' +
      (ult.motivo ? '<div class="small muted">' + esc(ult.estado) + ' por ' + esc(ult.usuario) + ' el ' + Util.fmtSello(ult.fecha) + ': ' + esc(ult.motivo) + '</div>' : '') +
      (Permisos.puede('revisarAlertas') && a.vigente !== false ? '<div class="btn-row" style="margin-top:6px">' +
        (e !== 'en revisión' ? '<button class="btn xs" type="button" data-estado="en revisión" data-al="' + k + '">En revisión</button>' : '') +
        (e !== 'confirmada' ? '<button class="btn xs" type="button" data-estado="confirmada" data-al="' + k + '">Confirmar</button>' : '') +
        (e !== 'descartada' ? '<button class="btn xs ghost" type="button" data-estado="descartada" data-al="' + k + '">Descartar…</button>' : '') + '</div>' : '') +
      '</div>';
  }
  function cuerpo(p, L){
    const ofs = Recepcion.ofertas(p.id);
    const sel = (k, opts) => '<select data-filtro="' + k + '">' + opts.map(([v, n]) => '<option value="' + esc(v) + '"' + (filtro[k] === v ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select>';
    return '<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
      sel('estado', [['abiertas','Abiertas'],['todas','Todas'],['nueva','Nuevas'],['en revisión','En revisión'],['confirmada','Confirmadas'],['descartada','Descartadas']]) +
      sel('nivel', [['','Todos los niveles']].concat(Alertas.NIVELES.map(n => [n, n.charAt(0).toUpperCase() + n.slice(1)]))) +
      sel('oferta', [['','Todos los proponentes']].concat(ofs.map(o => [o.id, Evaluacion.nombreOferta(p, o)]))) + '</div>' +
      (L.length ? L.map((a, k) => tarjeta(p, a, k)).join('') : UI.vacio('Sin alertas con este filtro', 'El análisis corre cada vez que cambia una verificación, una subsanación o la configuración.'));
  }

  /** Lleva a la evidencia. */
  function irA(p, ev, m){
    if (ev.tipo === 'documento'){
      const d = (S.documentosOferta||[]).find(x => x.id === ev.docId) || (S.documentosOferta||[]).find(x => x.sha256 === ev.sha256);
      if (!d) throw new Error('El documento ya no está en este equipo.');
      return (ev.pagina > 1 ? TextoPdf.ver(d, ev.pagina, '') : Archivos.ver(d));
    }
    if (ev.tipo === 'dato'){
      const o = Recepcion.ofertas(p.id).find(x => x.id === ev.ofertaId);
      return UI.aviso(ev.campo, '<p>' + esc(o ? Evaluacion.nombreOferta(p, o) : '') + '</p><p><b>' + esc(ev.valor) + '</b></p><p class="small muted">Dato declarado por el proponente en su oferta (oferta.json), tal como llegó en el sobre.</p>');
    }
    m.cerrar();
    if (ev.tipo === 'renglon'){
      Sesion.pestanas.a12 = ev.pestana === 'actividades' ? 'actividades' : ev.pestana || 'aritmetica';
      const a = (S.alertas||[]).find(x => x.alerta && x.alerta.evidencia.indexOf(ev) >= 0);
      if (a && a.alerta.ofertas.length === 1) Sesion.pestanas.of12 = a.alerta.ofertas[0];
      if (ev.codigo) Sesion.resaltar = 'r-' + idDom(ev.codigo);
      App.ir('12');
      return;
    }
    if (ev.tipo === 'requisito'){
      const r = Evaluacion.requisitos(p).find(x => x.codigo === ev.codigo);
      const mod = ev.modulo === '11' || (r && Puntaje.habilitantes([r]).length && MODULO_EVAL[r.grupo] === 'juridico') ? '11' : '13';
      if (mod === '13' && r) Sesion.pestanas.g13 = MODULO_EVAL[r.grupo] || 'otros';
      if (mod === '11') Sesion.pestanas.v11 = 'verificacion';
      Sesion.resaltar = 'q-' + idDom(ev.codigo);
      App.ir(mod);
    }
  }

  async function abrir(){
    const p = Modelo.activo();
    if (!p) throw new Error('Abra un proceso primero.');
    if (Evaluacion.hayOfertas(p)){ await Evaluacion.leerDocumentos(p); await Evaluacion.actualizarAlertas(p); }
    let L = visibles(p);
    const m = UI.modal({ titulo:'Bandeja de alertas', eyebrow:p.codigo + (p.demo ? ' · DEMOSTRACIÓN' : ''), ancho:'xwide', cuerpo:'<div id="bandejaCuerpo">' + cuerpo(p, L) + '</div>', botones:[{ texto:'Cerrar', clase:'primary' }] });
    const repintar = () => { L = visibles(p); $('#bandejaCuerpo', m.el).innerHTML = cuerpo(p, L); conectar(); pintarContador(); };
    function conectar(){
      $$('[data-filtro]', m.el).forEach(s => s.onchange = () => { filtro[s.dataset.filtro] = s.value; repintar(); });
      $$('.evid', m.el).forEach(a => a.onclick = e => { e.preventDefault(); Promise.resolve().then(() => irA(p, L[+a.dataset.al].alerta.evidencia[+a.dataset.ev], m)).catch(er => UI.error(er, 'evidencia')); });
      $$('[data-estado]', m.el).forEach(b => b.onclick = async () => {
        try {
          const a = L[+b.dataset.al];
          let motivo = '';
          if (b.dataset.estado === 'descartada'){
            const v = await UI.pedir({ titulo:'Descartar la alerta', antes:'<p class="small">' + esc(a.alerta.titulo) + '</p>', textoAceptar:'Descartar', campos:[{ k:'motivo', lab:'Motivo', tipo:'textarea', filas:3, c2:true }], validar:z => !z.motivo ? 'Escriba el motivo.' : '' });
            if (!v) return;
            motivo = v.motivo;
          }
          await Evaluacion.cambiarEstadoAlerta(p, a.id, b.dataset.estado, motivo);
          repintar();
        } catch(e){ UI.error(e, 'alerta'); }
      });
    }
    conectar();
    pintarContador();
  }
  return { abrir, pintarContador, visibles };
})();
