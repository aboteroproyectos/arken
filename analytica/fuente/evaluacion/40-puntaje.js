/* ══════════════════════════════════════════════════════════════════════════
   PUNTAJE Y ORDEN DE ELEGIBILIDAD (§18.10) — primero lo habilitante, después
   los ponderables con la regla de cada uno, la evaluación económica con el
   método del pliego, el desempate y la sensibilidad del orden a los pesos.

   Las fórmulas económicas son las que el pliego transcribe (Pliego.METODOS),
   tomadas de los documentos tipo de Colombia Compra Eficiente para obra
   pública: lo que el proponente leyó es exactamente lo que se calcula aquí.
   Los puntajes se redondean a dos decimales, que es como se publican y como
   se comparan para el desempate.
   ══════════════════════════════════════════════════════════════════════════ */
const Puntaje = (function(){

  const r2 = n => Util.redondearDec(n, 2);
  const piso = n => Math.max(0, n);

  /* ── Evaluación económica ── */
  /** El método que manda la TRM del día de la apertura, por sus centavos. */
  function metodoPorTrm(trm){
    const t = Number(trm);
    if (!(t > 0)) throw new Error('Escriba la TRM vigente el día de la apertura: con ella se elige el método económico.');
    const c = Math.round(t * 100) % 100;
    return { centavos:c, metodo:c <= 24 ? 'media' : c <= 49 ? 'mediaAlta' : c <= 74 ? 'geometrica' : 'menor' };
  }
  /** nv de la media geométrica: 1 con 1 a 3 ofertas, 2 con 4 a 6, y así. */
  function vecesPO(n){ return Math.max(1, Math.ceil(n / 3)); }
  /** Puntaje frente a una referencia R (media, media alta o geométrica). */
  function frenteA(R, v, pmax){ return v <= R ? pmax * (1 - (R - v) / R) : pmax * (1 - 2 * Math.abs(R - v) / R); }

  /** valores = [{ id, valor }] de las ofertas válidas.
      c = { pmax, presupuestoOficial, kBajo, kAlto, trm, metodo }
      Devuelve { metodo, nombre, referencia, detalle, puntajes:{ id:puntos } }. */
  function economico(metodo, valores, c){
    const L = (valores||[]).filter(x => Number(x.valor) > 0);
    const pmax = Number(c.pmax||0);
    const R = { metodo, puntajes:{}, referencia:null, detalle:'', centavos:null };
    if (!L.length){ R.detalle = 'No hay ofertas válidas para la evaluación económica.'; return R; }
    if (metodo === 'trm'){
      const t = metodoPorTrm(c.trm);
      const r = economico(t.metodo, valores, c);
      return Object.assign(r, { metodoTrm:true, centavos:t.centavos, detalle:'TRM ' + c.trm + ': centavos ' + String(t.centavos).padStart(2, '0') + ' → ' + Pliego.METODOS[t.metodo].nombre + '. ' + r.detalle });
    }
    const vs = L.map(x => Number(x.valor));
    const po = Number(c.presupuestoOficial||0);
    if (metodo === 'menor'){
      const vmin = Math.min.apply(null, vs);
      L.forEach(x => R.puntajes[x.id] = r2(pmax * vmin / x.valor));
      R.referencia = vmin; R.detalle = 'Valor mínimo entre las ofertas válidas: ' + Util.money(vmin) + '.';
    } else if (metodo === 'cercania'){
      if (!(po > 0)) throw new Error('El método de cercanía necesita el valor del presupuesto base.');
      const dmin = Math.min.apply(null, vs.map(v => Math.abs(v - po)));
      const kb = Number(c.kBajo === undefined ? 1 : c.kBajo), ka = Number(c.kAlto === undefined ? 2 : c.kAlto);
      L.forEach(x => { const k = x.valor < po ? kb : ka; R.puntajes[x.id] = r2(piso(pmax * (1 - k * (Math.abs(x.valor - po) - dmin) / po))); });
      R.referencia = po; R.detalle = 'Presupuesto base ' + Util.money(po) + '; la oferta más cercana está a ' + Util.money(dmin) + ' (k = ' + kb + ' por debajo y ' + ka + ' por encima).';
    } else if (metodo === 'media' || metodo === 'mediaAlta'){
      const media = vs.reduce((t, v) => t + v, 0) / vs.length;
      const ref = metodo === 'media' ? media : (Math.max.apply(null, vs) + media) / 2;
      L.forEach(x => R.puntajes[x.id] = r2(piso(frenteA(ref, x.valor, pmax))));
      R.referencia = ref;
      R.detalle = metodo === 'media' ? 'Media aritmética X̄ = ' + Util.money(media) + '.' : 'X̄ = ' + Util.money(media) + '; media aritmética alta XA = (Vmáx + X̄) / 2 = ' + Util.money(ref) + '.';
    } else if (metodo === 'geometrica'){
      if (!(po > 0)) throw new Error('La media geométrica con presupuesto oficial necesita el valor del presupuesto oficial.');
      const nv = vecesPO(vs.length);
      const g = Math.exp((nv * Math.log(po) + vs.reduce((t, v) => t + Math.log(v), 0)) / (vs.length + nv));
      L.forEach(x => R.puntajes[x.id] = r2(piso(frenteA(g, x.valor, pmax))));
      R.referencia = g; R.detalle = 'G = (PO^' + nv + ' × V1 × … × V' + vs.length + ')^(1 / ' + (vs.length + nv) + ') = ' + Util.money(g) + ', con PO = ' + Util.money(po) + ' incluido ' + nv + ' vez (veces).';
    } else throw new Error('Método económico desconocido: ' + metodo + '.');
    R.nombre = Pliego.METODOS[metodo].nombre;
    return R;
  }

  /* ── Reglas de los ponderables ── */
  /** Fórmula escrita por el usuario, sin eval: números, + − × ÷, paréntesis
      y las variables v, vmax, vmin, prom y pmax. */
  function evaluarFormula(texto, vars){
    const s = String(texto||'').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    let i = 0;
    const esp = () => { while (s[i] === ' ') i++; };
    function primario(){
      esp();
      if (s[i] === '('){ i++; const v = suma(); esp(); if (s[i] !== ')') throw new Error('Falta cerrar un paréntesis en la fórmula.'); i++; return v; }
      if (s[i] === '-'){ i++; return -primario(); }
      const n = /^\d+(\.\d+)?/.exec(s.slice(i)); if (n){ i += n[0].length; return Number(n[0]); }
      const id = /^[a-z]+/i.exec(s.slice(i));
      if (id){ i += id[0].length; if (!(id[0] in vars)) throw new Error('La fórmula usa «' + id[0] + '», que no es una variable (use v, vmax, vmin, prom o pmax).'); return Number(vars[id[0]]); }
      throw new Error('No se entiende la fórmula cerca de «' + s.slice(i, i + 10) + '».');
    }
    function producto(){ let v = primario(); for (;;){ esp(); if (s[i] === '*'){ i++; v *= primario(); } else if (s[i] === '/'){ i++; const d = primario(); v = d ? v / d : 0; } else return v; } }
    function suma(){ let v = producto(); for (;;){ esp(); if (s[i] === '+'){ i++; v += producto(); } else if (s[i] === '-'){ i++; v -= producto(); } else return v; } }
    const v = suma(); esp();
    if (i < s.length) throw new Error('Sobra texto en la fórmula: «' + s.slice(i) + '».');
    return v;
  }
  function esSi(v){ return v === true || v === 1 || /^(s[ií]|si|yes|true|1)$/i.test(String(v||'').trim()); }
  /** Puntajes de un ponderable con regla automática. valores = { id:valor verificado }. */
  function regla(req, valores){
    const rp = req.reglaPuntaje || {};
    const pmax = Number(req.puntajeMaximo||0);
    const ids = Object.keys(valores||{});
    const nums = ids.map(id => Number(valores[id])).filter(x => isFinite(x));
    const R = {};
    if (rp.tipo === 'proporcional'){
      const menor = /menor/i.test(rp.criterio || '');
      const ref = menor ? Math.min.apply(null, nums.filter(x => x > 0)) : Math.max.apply(null, nums);
      ids.forEach(id => { const v = Number(valores[id]); R[id] = !(v > 0) || !(ref > 0) ? 0 : r2(menor ? pmax * ref / v : pmax * v / ref); });
    } else if (rp.tipo === 'rangos'){
      ids.forEach(id => { const v = Number(valores[id]); const x = (rp.rangos||[]).find(g => v >= Number(g.desde) && (g.hasta === null || g.hasta === undefined || g.hasta === '' || v < Number(g.hasta)));
        R[id] = x ? Math.min(pmax, Number(x.puntos)) : 0; });
    } else if (rp.tipo === 'sino'){
      ids.forEach(id => R[id] = esSi(valores[id]) ? pmax : 0);
    } else if (rp.tipo === 'formula'){
      const vars = { vmax:Math.max.apply(null, nums), vmin:Math.min.apply(null, nums), prom:nums.reduce((t, x) => t + x, 0) / (nums.length || 1), pmax };
      ids.forEach(id => R[id] = r2(Math.min(pmax, piso(evaluarFormula(rp.formula, Object.assign({ v:Number(valores[id]) }, vars))))));
    } else return null;
    return R;
  }
  /** ¿La regla la calcula el programa, o la califica una persona? */
  function automatica(req){ const t = (req.reglaPuntaje||{}).tipo; return t === 'proporcional' || t === 'rangos' || t === 'sino' || t === 'formula'; }

  /* ── Habilitación ── */
  function habilitantes(requisitos){ return (requisitos||[]).filter(r => r.activo !== false && (r.naturaleza === 'habilitante' || r.tambienHabilitante)); }
  /** Estado de una oferta: 'habilitada' | 'no habilitada' | 'pendiente'.
      c = { requisitos, vigente(codigo) → fila de evaluación, subsanacion(codigo) → solicitud,
            ahora, economico:{ sobrePresupuesto, rechazarSobrePresupuesto, valorBajo, justificacion },
            versionAnterior, decisionVersion } */
  function habilitacion(c){
    const causales = [], pendientes = [];
    habilitantes(c.requisitos).forEach(r => {
      const e = c.vigente(r.codigo);
      const nombre = r.codigo + ' · ' + r.nombre;
      if (!e || e.cumple === 'pendiente'){ pendientes.push({ codigo:r.codigo, texto:nombre + ': sin verificar' }); return; }
      if (e.cumple === 'sí' || e.cumple === 'no aplica') return;
      if (e.cumple === 'no'){ causales.push({ codigo:r.codigo, texto:nombre + ': no cumple' + (e.observacion ? ' (' + e.observacion + ')' : '') + '.' }); return; }
      if (e.cumple === 'subsanable'){
        if (!r.subsanable){ causales.push({ codigo:r.codigo, texto:nombre + ': no cumple y el pliego no lo deja subsanar.' }); return; }
        const s = c.subsanacion(r.codigo);
        if (!s) pendientes.push({ codigo:r.codigo, texto:nombre + ': subsanable; falta pedir la subsanación' });
        else if (s.respuesta) pendientes.push({ codigo:r.codigo, texto:nombre + ': la subsanación llegó; falta verificarla' });
        else if (s.plazo && String(c.ahora||'') > s.plazo + 'T23:59:59') causales.push({ codigo:r.codigo, texto:nombre + ': no subsanó dentro del plazo (' + Util.fmtFecha(s.plazo) + ').' });
        else pendientes.push({ codigo:r.codigo, texto:nombre + ': subsanación pedida, plazo hasta el ' + Util.fmtFecha(s.plazo) });
      }
    });
    const ec = c.economico || {};
    if (ec.sobrePresupuesto && ec.rechazarSobrePresupuesto) causales.push({ codigo:'ECO', texto:'El valor de la oferta supera el presupuesto oficial y el pliego rechaza esas ofertas.' });
    if (ec.valorBajo){
      const j = ec.justificacion;
      if (j && j.decision === 'rechazada') causales.push({ codigo:'ECO', texto:'Valor artificialmente bajo: el comité no aceptó la justificación' + (j.motivo ? ' (' + j.motivo + ')' : '') + '.' });
      else if (!j || j.decision !== 'aceptada') pendientes.push({ codigo:'ECO', texto:'Valor artificialmente bajo: ' + (j ? 'falta la decisión del comité sobre la justificación' : 'falta pedir la justificación') });
    }
    if (c.versionAnterior){
      if (c.decisionVersion === 'rechazada') causales.push({ codigo:'VER', texto:'Oferta sobre una versión anterior del pliego: el comité no la aceptó.' });
      else if (c.decisionVersion !== 'aceptada') pendientes.push({ codigo:'VER', texto:'Oferta sobre una versión anterior del pliego: falta la decisión del comité' });
    }
    return { estado:causales.length ? 'no habilitada' : pendientes.length ? 'pendiente' : 'habilitada', causales, pendientes };
  }

  /* ── Orden de elegibilidad, desempate y sensibilidad ── */
  /** filas = [{ id, total, economico, tecnico }]; reglas = textos del pliego, en orden;
      sorteo = [ids] en el orden que salió del sorteo, si ya se hizo. */
  function orden(filas, reglas, sorteo){
    const criterios = (reglas||[]).map(t => /econ[oó]mic/i.test(t) ? 'economico' : /t[eé]cnic/i.test(t) ? 'tecnico' : /sorteo/i.test(t) ? 'sorteo' : null);
    const L = filas.slice();
    const cmp = (a, b) => {
      if (r2(b.total) !== r2(a.total)) return r2(b.total) - r2(a.total);
      for (const k of criterios){
        if (k === 'economico' && r2(b.economico) !== r2(a.economico)) return r2(b.economico) - r2(a.economico);
        if (k === 'tecnico' && r2(b.tecnico) !== r2(a.tecnico)) return r2(b.tecnico) - r2(a.tecnico);
        if (k === 'sorteo' && sorteo && sorteo.indexOf(a.id) >= 0 && sorteo.indexOf(b.id) >= 0) return sorteo.indexOf(a.id) - sorteo.indexOf(b.id);
      }
      return 0;
    };
    L.sort(cmp);
    const empates = [];
    for (let i = 1; i < L.length; i++) if (cmp(L[i - 1], L[i]) === 0){
      const g = empates.find(e => e.indexOf(L[i - 1].id) >= 0);
      if (g) g.push(L[i].id); else empates.push([L[i - 1].id, L[i].id]);
    }
    L.forEach((x, i) => x.puesto = i + 1);
    return { orden:L, empates, criterios };
  }
  /** Cuánto cambia el orden si el peso de cada grupo se mueve ±10 %.
      filas = [{ id, grupos:{ grupo:puntos }, economico, tecnico }]. */
  function sensibilidad(filas, reglas, sorteo, delta){
    const d = delta === undefined ? 0.1 : delta;
    const grupos = Array.from(new Set(filas.flatMap(f => Object.keys(f.grupos||{}))));
    const base = orden(filas.map(f => Object.assign({}, f)), reglas, sorteo).orden.map(x => x.id);
    return grupos.map(g => {
      const una = (factor) => {
        const o = orden(filas.map(f => { const gs = Object.assign({}, f.grupos); gs[g] = (gs[g] || 0) * factor;
          const total = Object.values(gs).reduce((t, x) => t + x, 0);
          return { id:f.id, total, economico:g === 'Económico' ? f.economico * factor : f.economico, tecnico:g === 'Económico' ? f.tecnico : total - (gs['Económico'] || 0) }; }), reglas, sorteo).orden.map(x => x.id);
        return { orden:o, cambia:o.join() !== base.join(), cambiaPrimero:o[0] !== base[0] };
      };
      return { grupo:g, mas:una(1 + d), menos:una(1 - d) };
    });
  }

  return { metodoPorTrm, vecesPO, economico, evaluarFormula, esSi, regla, automatica, habilitantes, habilitacion, orden, sensibilidad };
})();
