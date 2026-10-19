/* ─────────────── Las 15 gráficas (§20) ───────────────
   SVG puro, sin librerías, armado como texto a partir del resultado de
   Motor.analizar. Cada gráfica devuelve { id, titulo, descripcion, svg }:
   la descripción es el texto que la explica para quien no la ve.

   · Los colores del tema van como style="fill:var(--x,#claro)", así siguen
     el tema claro u oscuro en pantalla y, al exportar, quedan en claro.
   · Cada marca de un proponente lleva data-of; cada capítulo, data-cap (para
     bajar a sus subcapítulos). La vista resalta y baja con esos atributos.
   · Los textos se escapan: los nombres vienen de los proponentes. */
const Graficas = (function(){
  const T = { ink:'var(--ink,#16181A)', steel:'var(--steel,#41464C)', slate:'var(--slate,#767C83)', line:'var(--line,#D9DBDC)', soft:'var(--line-soft,#EBECED)',
    brass:'var(--brass,#A98B54)', ok:'var(--ok,#3B6E52)', bad:'var(--bad,#96362E)', warn:'var(--warn,#9A6B1E)', info:'var(--info,#3C5A76)', surface:'var(--surface,#FFFFFF)' };
  const CAT = { 'Materiales':'#A98B54', 'Mano de Obra':'#3C5A76', 'Herramientas':'#767C83', 'Equipos':'#3B6E52', 'Ferretería':'#9A6B1E', 'Consumibles':'#8A6E4B', 'Todo Costo':'#96362E' };
  const PALETA = ['#3C5A76','#A98B54','#3B6E52','#96362E','#6B4E8A','#9A6B1E','#2F7C86','#8A6E4B','#B0555E','#4E6B2F','#5A5F66','#C07A2C'];
  const W = 720;
  const esc = Util.esc;
  const r1 = n => Math.round(n * 10) / 10;

  /* ── Ayudas ── */
  function millones(n){ const a = Math.abs(n); return (n < 0 ? '−' : '') + '$ ' + (a >= 1e9 ? (a / 1e9).toFixed(2).replace('.', ',') + ' mil M' : a >= 1e6 ? Math.round(a / 1e6) + ' M' : Util.money(a).slice(2)); }
  function pctTxt(d, dec){ return (d > 0 ? '+' : d < 0 ? '−' : '') + Math.abs(d * 100).toFixed(dec === undefined ? 1 : dec).replace('.', ',') + ' %'; }
  function corto(s, n){ s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  /** Nombre para rótulos: sin «DEMO», sin la forma societaria ni «Consorcio». */
  function nombreCorto(n){
    const t = String(n || '').replace(/^DEMO\s+/, '').replace(/(^|\s)(S\.?\s?A\.?\s?S\.?|S\.?\s?A\.?|Ltda\.?|Consorcio|Unión Temporal)(?=\s|$)/gi, ' ').replace(/[\s.,]+$/, '').replace(/\s+/g, ' ').trim();
    return corto(t || n, 22);
  }
  function texto(x, y, t, o){
    o = o || {};
    return '<text x="' + r1(x) + '" y="' + r1(y) + '"' + (o.anchor ? ' text-anchor="' + o.anchor + '"' : '') + (o.rot ? ' transform="rotate(' + o.rot + ' ' + r1(x) + ' ' + r1(y) + ')"' : '') +
      ' style="fill:' + (o.color || T.steel) + ';font-size:' + (o.size || 10) + 'px' + (o.bold ? ';font-weight:700' : '') + (o.mono ? ';font-family:var(--font-num,monospace)' : '') + '">' + esc(t) + '</text>';
  }
  /** extra puede traer su propio style (que entonces reemplaza al relleno) u otros atributos. */
  function rect(x, y, w, h, color, extra){
    const propio = /style=/.test(extra || '');
    return '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(Math.max(0, w)) + '" height="' + r1(Math.max(0, h)) + '"' + (propio ? '' : ' style="fill:' + color + '"') + (extra || '') + '/>';
  }
  function linea(x1, y1, x2, y2, color, ancho, guion){ return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(x2) + '" y2="' + r1(y2) + '" style="stroke:' + color + ';stroke-width:' + (ancho || 1) + (guion ? ';stroke-dasharray:' + guion : '') + '"/>'; }
  function svg(id, h, titulo, cuerpo){
    return '<svg xmlns="http://www.w3.org/2000/svg" class="grafica g-' + id + '" viewBox="0 0 ' + W + ' ' + h + '" width="' + W + '" height="' + h + '" role="img" aria-label="' + esc(titulo) + '" style="font-family:var(--font-body,Helvetica,Arial,sans-serif)">' +
      rect(0, 0, W, h, T.surface) + cuerpo + '</svg>';
  }
  function colorDe(op, id, k){ return (op.colores && op.colores[id]) || PALETA[k % PALETA.length]; }
  function escala(min, max, a, b){ const d = max - min || 1; return v => a + (v - min) / d * (b - a); }
  /** Marcas «bonitas» de un eje. */
  function marcas(min, max, n){
    const paso0 = (max - min) / (n || 5) || 1;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(paso0))));
    const paso = [1, 2, 2.5, 5, 10].map(x => x * mag).find(x => x >= paso0) || paso0;
    const L = [];
    for (let v = Math.ceil(min / paso) * paso; v <= max + paso * 1e-9; v += paso) L.push(Math.round(v / paso) * paso);
    return L;
  }
  function leyenda(items, x, y){
    let cx = x, cy = y, s = '';
    items.forEach(it => {
      const w = 18 + it.txt.length * 5.6;
      if (cx + w > W - 10){ cx = x; cy += 16; }
      s += '<g' + (it.of ? ' data-of="' + esc(it.of) + '"' : '') + '>' + rect(cx, cy - 8, 10, 10, it.color) + texto(cx + 14, cy + 1, it.txt, { size:9.5 }) + '</g>';
      cx += w + 8;
    });
    return { svg:s, alto:cy - y + 16 };
  }
  function ofertasOrdenadas(R){ return R.ofertas.slice(); }

  /* ── 1. Valor total frente al presupuesto base ── */
  function totales(R, op){
    const L = ofertasOrdenadas(R).sort((a, b) => a.totales.total - b.totales.total);
    const base = R.totalesBase.total, med = Estadistica.mediana(L.map(o => o.totales.total));
    const IZ = 170, DE = W - 90, alto = 26, top = 34, H = top + L.length * alto + 40;
    const max = Math.max(base, ...L.map(o => o.totales.total)) * 1.05;
    const x = escala(0, max, IZ, DE);
    let s = marcas(0, max, 5).map(v => linea(x(v), top - 6, x(v), top + L.length * alto, T.soft) + texto(x(v), top + L.length * alto + 14, millones(v), { anchor:'middle', size:9 })).join('');
    L.forEach((o, k) => {
      const y = top + k * alto, v = o.totales.total, d = (v - base) / base;
      s += '<g data-of="' + esc(o.id) + '">' + texto(IZ - 8, y + 15, nombreCorto(o.nombre), { anchor:'end', size:10.5, color:T.ink }) +
        rect(IZ, y + 5, x(v) - IZ, alto - 10, colorDe(op, o.id, R.ofertas.indexOf(o)), ' rx="2"') +
        texto(x(v) + 6, y + 15, millones(v) + ' · ' + pctTxt(d), { size:9.5, mono:true }) + '</g>';
    });
    s += linea(x(base), top - 10, x(base), top + L.length * alto + 2, T.brass, 2) + texto(x(base), top - 14, 'Base ' + millones(base), { anchor:'middle', size:9.5, color:T.brass, bold:true });
    s += linea(x(med), top - 4, x(med), top + L.length * alto + 2, T.slate, 1.2, '4 3') + texto(x(med), H - 8, 'Mediana ' + millones(med), { anchor:'middle', size:9, color:T.slate });
    const menor = L[0];
    return { id:'totales', titulo:'Valor total de cada oferta frente al presupuesto base', svg:svg('totales', H, 'Valor total de cada oferta', s),
      descripcion:'La oferta más baja es ' + menor.nombre + ' con ' + Util.money(menor.totales.total) + ' (' + pctTxt((menor.totales.total - base) / base) + ' frente a la base de ' + Util.money(base) + '). La mediana de las ' + L.length + ' ofertas es ' + Util.money(med) + '.' };
  }

  /* ── 2. Cascada del presupuesto base a una oferta, por capítulo ── */
  function cascada(R, op){
    const o = R.ofertas.find(x => x.id === op.ofertaId) || R.ofertas[0];
    const pb = R.ctx.base;
    const caps = (pb.capitulos||[]).map(c => {
      const co = (o.pres.capitulos||[]).find(x => Util.normaliza(x.codigo) === Util.normaliza(c.codigo));
      return { codigo:c.codigo, nombre:c.nombre, d:(co ? Calculo.valorCapitulo(o.pres, co) : 0) - Calculo.valorCapitulo(pb, c) };
    });
    const base = R.totalesBase.total, fin = o.totales.total;
    const resto = fin - base - caps.reduce((t, c) => t + c.d, 0);
    const pasos = [{ nombre:'Base', v:base, tipo:'total' }].concat(caps.map(c => ({ nombre:c.codigo + ' ' + c.nombre, v:c.d, tipo:'delta', cap:c.codigo })), [{ nombre:'AIU e IVA', v:resto, tipo:'delta' }, { nombre:nombreCorto(o.nombre), v:fin, tipo:'total' }]);
    let acc = 0;
    const barras = pasos.map(p => { if (p.tipo === 'total'){ acc = p.v; return { p, a:0, b:p.v }; } const a = acc; acc += p.v; return { p, a, b:acc }; });
    const lo = Math.min(...barras.map(b => Math.min(b.a, b.b))) , hi = Math.max(...barras.map(b => Math.max(b.a, b.b)));
    const min = Math.max(0, lo - (hi - lo) * 1.5);
    const top = 20, H = 300, abajo = H - 92, IZ = 70;
    const y = escala(min, hi * 1.02, abajo, top);
    const ancho = (W - IZ - 20) / barras.length;
    let s = marcas(min, hi, 4).map(v => linea(IZ, y(v), W - 10, y(v), T.soft) + texto(IZ - 6, y(v) + 3, millones(v), { anchor:'end', size:9 })).join('');
    barras.forEach((b, k) => {
      const x = IZ + k * ancho + 4, w = ancho - 8;
      const color = b.p.tipo === 'total' ? (k ? colorDe(op, o.id, R.ofertas.indexOf(o)) : T.brass) : b.p.v < 0 ? T.ok : T.bad;
      const y0 = b.p.tipo === 'total' ? y(Math.max(min, 0)) : y(b.a), y1 = y(b.b);
      s += '<g' + (b.p.cap ? ' data-cap="' + esc(b.p.cap) + '"' : b.p.tipo === 'total' && k ? ' data-of="' + esc(o.id) + '"' : '') + '>' + rect(x, Math.min(y0, y1), w, Math.abs(y1 - y0) || 1, color) +
        texto(x + w / 2, Math.min(y0, y1) - 4, b.p.tipo === 'total' ? millones(b.p.v) : (b.p.v >= 0 ? '+' : '') + millones(b.p.v), { anchor:'middle', size:8.5, mono:true }) +
        texto(x + w / 2, abajo + 10, corto(b.p.nombre, 22), { anchor:'end', size:8.5, rot:-40 }) + '</g>';
      if (k < barras.length - 1 && barras[k + 1].p.tipo === 'delta') s += linea(x + w, y1, x + ancho + 4, y1, T.slate, 0.8, '2 2');
    });
    const peor = caps.slice().sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
    return { id:'cascada', titulo:'Del presupuesto base a la oferta de ' + o.nombre + ', por capítulo', svg:svg('cascada', H, 'Cascada del presupuesto base a la oferta', s),
      descripcion:'De la base (' + Util.money(base) + ') a la oferta de ' + o.nombre + ' (' + Util.money(fin) + '). El capítulo que más mueve el valor es ' + (peor ? peor.codigo + ' ' + peor.nombre + ' (' + (peor.d >= 0 ? '+' : '') + Util.money(peor.d) + ')' : '—') + '.' };
  }

  /* ── 3. Mapa de calor proponente × capítulo (o × subcapítulo de un capítulo) ── */
  function colorDesv(d){
    if (d === null || !isFinite(d)) return T.soft;
    const t = Math.min(1, Math.abs(d) / 0.4);
    const a = [247, 247, 247], b = d < 0 ? [60, 90, 118] : [150, 54, 46];
    const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
    return 'rgb(' + c.join(',') + ')';
  }
  function calor(R, op){
    const C = Comparativo.cuadro(R, { nivel:op.capitulo ? 'subcapitulo' : 'capitulo', capitulo:op.capitulo });
    const filas = C.filas.filter(f => op.capitulo ? f.tipo === 'sub' : f.tipo === 'cap');
    const cols = R.ofertas;
    const IZ = 220, top = 50, alto = 22, ancho = Math.min(90, (W - IZ - 10) / cols.length), H = top + filas.length * alto + 44;
    let s = cols.map((o, j) => '<g data-of="' + esc(o.id) + '">' + texto(IZ + j * ancho + ancho / 2, top - 22, nombreCorto(o.nombre), { anchor:'middle', size:9, color:T.ink }) + rect(IZ + j * ancho + 4, top - 14, ancho - 8, 4, colorDe(op, o.id, j)) + '</g>').join('');
    let maxAbs = { v:0 };
    filas.forEach((f, i) => {
      const y = top + i * alto;
      s += '<g' + (f.tipo === 'cap' ? ' data-cap="' + esc(f.codigo) + '"' : '') + '>' + texto(IZ - 8, y + 15, corto(f.codigo + ' ' + f.nombre, 36), { anchor:'end', size:9.5, color:T.ink }) + '</g>';
      cols.forEach((o, j) => {
        const c = f.celdas[o.id], d = c ? c.pctBase : null;
        if (d !== null && Math.abs(d) > maxAbs.v) maxAbs = { v:Math.abs(d), f, o, d };
        s += '<g data-of="' + esc(o.id) + '">' + rect(IZ + j * ancho + 1, y + 1, ancho - 2, alto - 2, colorDesv(d)) +
          texto(IZ + j * ancho + ancho / 2, y + 15, d === null ? '—' : pctTxt(d, 0), { anchor:'middle', size:9, mono:true, color:d !== null && Math.abs(d) > 0.25 ? '#FFFFFF' : '#16181A' }) + '</g>';
      });
    });
    const ly = top + filas.length * alto + 18;
    [-0.4, -0.2, 0, 0.2, 0.4].forEach((d, k) => { s += rect(IZ + k * 60, ly, 58, 10, colorDesv(d)) + texto(IZ + k * 60 + 29, ly + 22, pctTxt(d, 0), { anchor:'middle', size:8.5 }); });
    return { id:'calor', titulo:'Desviación frente a la base: proponente × ' + (op.capitulo ? 'subcapítulo del capítulo ' + op.capitulo : 'capítulo'), svg:svg('calor', H + 14, 'Mapa de calor de desviaciones', s),
      descripcion:maxAbs.f ? 'La mayor desviación es la de ' + maxAbs.o.nombre + ' en ' + maxAbs.f.codigo + ' ' + maxAbs.f.nombre + ': ' + pctTxt(maxAbs.d) + ' frente a la base. Azul es más barato que la base; rojo, más caro.' : 'Sin datos.' };
  }

  /* ── 4. Caja y bigotes por capítulo: dispersión de los proponentes y la base ── */
  function cuartiles(v){
    const s = v.slice().sort((a, b) => a - b);
    const q = p => { const i = (s.length - 1) * p, a = Math.floor(i), b = Math.ceil(i); return s[a] + (s[b] - s[a]) * (i - a); };
    return { min:s[0], q1:q(0.25), med:q(0.5), q3:q(0.75), max:s[s.length - 1] };
  }
  function caja(R, op){
    const C = Comparativo.cuadro(R, { nivel:'capitulo' });
    const filas = C.filas.filter(f => f.base > 0);
    const IZ = 210, top = 30, alto = 24, H = top + filas.length * alto + 40;
    const razones = filas.map(f => R.ofertas.map(o => f.celdas[o.id] ? f.celdas[o.id].valor / f.base : null).filter(x => x !== null));
    const todas = razones.flat();
    const lo = Math.min(0.6, ...todas), hi = Math.max(1.4, ...todas);
    const x = escala(lo, hi, IZ, W - 20);
    let s = marcas(lo, hi, 6).map(v => linea(x(v), top - 6, x(v), top + filas.length * alto, T.soft) + texto(x(v), top + filas.length * alto + 14, Math.round(v * 100) + ' %', { anchor:'middle', size:9 })).join('');
    s += linea(x(1), top - 10, x(1), top + filas.length * alto, T.brass, 2) + texto(x(1), top - 14, 'Base = 100 %', { anchor:'middle', size:9.5, color:T.brass, bold:true });
    let masAncho = null;
    filas.forEach((f, i) => {
      const y = top + i * alto + alto / 2, q = cuartiles(razones[i]);
      if (!masAncho || q.max - q.min > masAncho.r) masAncho = { r:q.max - q.min, f };
      s += '<g data-cap="' + esc(f.codigo) + '">' + texto(IZ - 8, y + 4, corto(f.codigo + ' ' + f.nombre, 34), { anchor:'end', size:9.5, color:T.ink }) +
        linea(x(q.min), y, x(q.max), y, T.slate, 1) + linea(x(q.min), y - 5, x(q.min), y + 5, T.slate) + linea(x(q.max), y - 5, x(q.max), y + 5, T.slate) +
        rect(x(q.q1), y - 7, x(q.q3) - x(q.q1), 14, T.soft, ' style="fill:var(--line-soft,#EBECED);stroke:var(--steel,#41464C);stroke-width:.8"') + linea(x(q.med), y - 7, x(q.med), y + 7, T.ink, 1.6) + '</g>';
      R.ofertas.forEach((o, j) => { const c = f.celdas[o.id]; if (c) s += '<circle data-of="' + esc(o.id) + '" cx="' + r1(x(c.valor / f.base)) + '" cy="' + r1(y) + '" r="3.2" style="fill:' + colorDe(op, o.id, j) + '"/>'; });
    });
    return { id:'caja', titulo:'Dispersión de los proponentes por capítulo (valor ÷ base)', svg:svg('caja', H, 'Caja y bigotes por capítulo', s),
      descripcion:'Cada caja va del primer al tercer cuartil de las ofertas en ese capítulo, con la mediana en negro; la línea latón es la base. ' + (masAncho ? 'La mayor dispersión está en ' + masAncho.f.codigo + ' ' + masAncho.f.nombre + '.' : '') };
  }

  /* ── 5. Pareto del presupuesto base, con la posición de cada proponente ── */
  function pareto(R, op){
    const C = Comparativo.cuadro(R, { nivel:'actividad' });
    const acts = C.filas.filter(f => f.tipo === 'act').sort((a, b) => b.base - a.base);
    const total = acts.reduce((t, f) => t + f.base, 0) || 1;
    let acc = 0, n80 = 0;
    acts.forEach((f, i) => { acc += f.base; f.acum = acc / total; if (!n80 && f.acum >= 0.8) n80 = i + 1; });
    const L = acts.slice(0, Math.min(Math.max(n80, 8), 30));
    const IZ = 70, DE = W - 50, top = 20, H = 300, abajo = H - 70;
    const max = Math.max(...L.map(f => Math.max(f.base, ...R.ofertas.map(o => f.celdas[o.id] ? f.celdas[o.id].valor : 0)))) * 1.08;
    const y = escala(0, max, abajo, top), yp = escala(0, 1, abajo, top);
    const ancho = (DE - IZ) / L.length;
    let s = marcas(0, max, 4).map(v => linea(IZ, y(v), DE, y(v), T.soft) + texto(IZ - 6, y(v) + 3, millones(v), { anchor:'end', size:9 })).join('');
    [0.2, 0.4, 0.6, 0.8, 1].forEach(p => { s += texto(DE + 6, yp(p) + 3, Math.round(p * 100) + ' %', { size:9, color:T.brass }); });
    s += linea(IZ, yp(0.8), DE, yp(0.8), T.brass, 0.8, '4 3');
    let puntos = '';
    L.forEach((f, i) => {
      const x = IZ + i * ancho;
      s += rect(x + 2, y(f.base), ancho - 4, abajo - y(f.base), i < n80 ? 'var(--line,#D9DBDC)' : 'var(--line-soft,#EBECED)') + texto(x + ancho / 2, abajo + 10, f.codigo, { anchor:'end', size:8, rot:-50, mono:true });
      R.ofertas.forEach((o, j) => { const c = f.celdas[o.id]; if (c) s += '<circle data-of="' + esc(o.id) + '" cx="' + r1(x + ancho / 2) + '" cy="' + r1(y(c.valor)) + '" r="2.8" style="fill:' + colorDe(op, o.id, j) + '"/>'; });
      puntos += (i ? ' L ' : 'M ') + r1(x + ancho / 2) + ' ' + r1(yp(f.acum));
    });
    s += '<path d="' + puntos + '" style="fill:none;stroke:' + T.brass + ';stroke-width:1.6"/>';
    return { id:'pareto', titulo:'Pareto del presupuesto base y la posición de cada proponente', svg:svg('pareto', H, 'Pareto del presupuesto base', s),
      descripcion:n80 + ' de ' + acts.length + ' actividades hacen el 80 % del costo directo de la base. Las barras son la base; los puntos, el valor de cada proponente en esa actividad; la curva latón, el acumulado.' };
  }

  /* ── 6. Composición por categoría de insumo (barras apiladas al 100 %) ── */
  function composicion(R, op){
    const series = [{ id:'', nombre:'Presupuesto base', pc:Calculo.porCategoria(R.ctx.base) }].concat(R.ofertas.map(o => ({ id:o.id, nombre:o.nombre, pc:Calculo.porCategoria(o.pres) })));
    const IZ = 170, top = 20, alto = 26, H = top + series.length * alto + 60;
    const x = escala(0, 1, IZ, W - 20);
    let s = [0, 0.25, 0.5, 0.75, 1].map(v => texto(x(v), top + series.length * alto + 14, Math.round(v * 100) + ' %', { anchor:'middle', size:9 })).join('');
    series.forEach((se, k) => {
      const y = top + k * alto, tot = Calculo.CATEGORIAS_INSUMO.reduce((t, c) => t + (se.pc[c] || 0), 0) || 1;
      let a = 0;
      s += '<g' + (se.id ? ' data-of="' + esc(se.id) + '"' : '') + '>' + texto(IZ - 8, y + 15, se.id ? nombreCorto(se.nombre) : se.nombre, { anchor:'end', size:10, color:T.ink, bold:!se.id });
      Calculo.CATEGORIAS_INSUMO.forEach(c => { const f = (se.pc[c] || 0) / tot; if (f > 0){ s += rect(x(a), y + 5, x(a + f) - x(a), alto - 10, CAT[c]); if (f > 0.07) s += texto(x(a + f / 2), y + 16, Math.round(f * 100) + ' %', { anchor:'middle', size:8.5, color:'#FFFFFF' }); } a += f; });
      s += '</g>';
    });
    const lg = leyenda(Calculo.CATEGORIAS_INSUMO.map(c => ({ txt:c, color:CAT[c] })), IZ, top + series.length * alto + 34);
    const mo = series.map(se => ({ n:se.nombre, f:(se.pc['Mano de Obra'] || 0) / (Calculo.CATEGORIAS_INSUMO.reduce((t, c) => t + (se.pc[c] || 0), 0) || 1) }));
    const menor = mo.slice(1).sort((a, b) => a.f - b.f)[0];
    return { id:'composicion', titulo:'Composición de cada oferta por categoría de insumo', svg:svg('composicion', H + lg.alto, 'Composición por categoría de insumo', s + lg.svg),
      descripcion:'La mano de obra pesa ' + Math.round(mo[0].f * 100) + ' % del costo directo en la base' + (menor ? '; la oferta con menos mano de obra es ' + menor.n + ' (' + Math.round(menor.f * 100) + ' %)' : '') + '.' };
  }

  /* ── 7. AIU de cada oferta y desglose de la administración ── */
  function aiu(R, op){
    const tb = R.totalesBase;
    const series = [{ id:'', nombre:'Presupuesto base', a:tb.pctA, i:tb.pctI, u:tb.pctU, desg:[] }].concat(R.aiu.map(x => {
      const o = R.ofertas.find(y => y.id === x.id);
      return { id:x.id, nombre:o ? o.nombre : x.id, a:x.pctA, i:x.pctI, u:x.pctU, desg:(x.desglose||[]).map(d => ({ concepto:d.concepto, valor:d.valor })), A:x.a };
    }));
    const IZ = 170, MID = 450, top = 34, alto = 26, H = top + series.length * alto + 54;
    const maxP = Math.max(...series.map(se => se.a + se.i + se.u)) * 1.1 || 1;
    const x = escala(0, maxP, IZ, MID - 20);
    let s = texto(IZ, 16, 'A · I · U, en % del costo directo', { size:10, bold:true, color:T.ink }) + texto(MID, 16, 'Desglose de la administración', { size:10, bold:true, color:T.ink });
    const COL = { a:'#3C5A76', i:'#A98B54', u:'#3B6E52' };
    const conceptos = [];
    series.forEach(se => se.desg.forEach(d => { if (conceptos.indexOf(d.concepto) < 0) conceptos.push(d.concepto); }));
    const COLD = ['#24272B', '#767C83', '#B4B9BF', '#A98B54', '#2F7C86', '#8A6E4B'];
    const xd = escala(0, 1, MID, W - 20);
    series.forEach((se, k) => {
      const y = top + k * alto;
      s += '<g' + (se.id ? ' data-of="' + esc(se.id) + '"' : '') + '>' + texto(IZ - 8, y + 15, se.id ? nombreCorto(se.nombre) : se.nombre, { anchor:'end', size:10, color:T.ink, bold:!se.id });
      let a = 0;
      [['a', se.a], ['i', se.i], ['u', se.u]].forEach(([c, v]) => { s += rect(x(a), y + 5, x(a + v) - x(a), alto - 10, COL[c]); if (v >= 2) s += texto(x(a + v / 2), y + 16, String(Util.redondearDec(v, 1)).replace('.', ','), { anchor:'middle', size:8.5, color:'#FFFFFF' }); a += v; });
      s += texto(x(a) + 4, y + 16, Util.pct(a), { size:9, mono:true });
      const tot = se.desg.reduce((t, d) => t + d.valor, 0);
      if (tot > 0){ let b = 0; se.desg.forEach(d => { const f = d.valor / tot; s += rect(xd(b), y + 5, xd(b + f) - xd(b), alto - 10, COLD[conceptos.indexOf(d.concepto) % COLD.length]); if (f > 0.1) s += texto(xd(b + f / 2), y + 16, Math.round(f * 100) + ' %', { anchor:'middle', size:8.5, color:'#FFFFFF' }); b += f; }); }
      else if (se.id) s += texto(MID, y + 16, 'Sin desglose', { size:9, color:T.slate });
      s += '</g>';
    });
    const lg = leyenda([{ txt:'Administración', color:COL.a }, { txt:'Imprevistos', color:COL.i }, { txt:'Utilidad', color:COL.u }].concat(conceptos.map((c, k) => ({ txt:c, color:COLD[k % COLD.length] }))), IZ, top + series.length * alto + 22);
    const mayor = series.slice(1).sort((p, q) => (q.a + q.i + q.u) - (p.a + p.i + p.u))[0];
    return { id:'aiu', titulo:'AIU de cada oferta y desglose de la administración', svg:svg('aiu', H + lg.alto, 'AIU de cada oferta', s + lg.svg),
      descripcion:'La base lleva un AIU de ' + Util.pct(tb.pctA + tb.pctI + tb.pctU) + '. ' + (mayor ? 'El mayor AIU es el de ' + mayor.nombre + ' (' + Util.pct(mayor.a + mayor.i + mayor.u) + ').' : '') + ' A la derecha, en qué se va la administración de cada oferta.' };
  }

  /* ── 8. Radar de puntajes por grupo ── */
  function maximosPorGrupo(R){
    const m = {};
    R.requisitos.filter(r => R.puntaje.ponderables.indexOf(r.codigo) >= 0).forEach(r => { m[r.grupo] = (m[r.grupo] || 0) + Number(r.puntajeMaximo || 0); });
    return m;
  }
  function radar(R, op){
    const max = maximosPorGrupo(R);
    const grupos = Object.keys(max).filter(g => max[g] > 0);
    const filas = R.puntaje.filas;
    const cx = W / 2 - 80, cy = 190, rad = 140, H = 400;
    const ang = k => -Math.PI / 2 + k * 2 * Math.PI / grupos.length;
    let s = '';
    [0.25, 0.5, 0.75, 1].forEach(t => { s += '<polygon points="' + grupos.map((g, k) => r1(cx + Math.cos(ang(k)) * rad * t) + ',' + r1(cy + Math.sin(ang(k)) * rad * t)).join(' ') + '" style="fill:none;stroke:' + T.soft + '"/>'; });
    grupos.forEach((g, k) => {
      const ex = cx + Math.cos(ang(k)) * rad, ey = cy + Math.sin(ang(k)) * rad;
      s += linea(cx, cy, ex, ey, T.soft) + texto(cx + Math.cos(ang(k)) * (rad + 14), cy + Math.sin(ang(k)) * (rad + 14) + 3, g + ' (' + Util.redondearDec(max[g], 0) + ')', { anchor:Math.abs(Math.cos(ang(k))) < 0.2 ? 'middle' : Math.cos(ang(k)) > 0 ? 'start' : 'end', size:9.5, color:T.ink });
    });
    filas.forEach(f => {
      const j = R.ofertas.findIndex(o => o.id === f.id), color = colorDe(op, f.id, j);
      s += '<polygon data-of="' + esc(f.id) + '" points="' + grupos.map((g, k) => { const t = Math.min(1, (f.grupos[g] || 0) / max[g]); return r1(cx + Math.cos(ang(k)) * rad * t) + ',' + r1(cy + Math.sin(ang(k)) * rad * t); }).join(' ') + '" style="fill:' + color + ';fill-opacity:.12;stroke:' + color + ';stroke-width:1.8"/>';
    });
    const lg = filas.map((f, k) => '<g data-of="' + esc(f.id) + '">' + rect(W - 190, 40 + k * 18, 10, 10, colorDe(op, f.id, R.ofertas.findIndex(o => o.id === f.id))) + texto(W - 175, 49 + k * 18, f.puesto + '. ' + nombreCorto(f.nombre) + ' · ' + String(f.total).replace('.', ','), { size:9.5 }) + '</g>').join('');
    const pri = filas.slice().sort((a, b) => a.puesto - b.puesto)[0];
    return { id:'radar', titulo:'Puntaje por grupo de requisitos', svg:svg('radar', H, 'Radar de puntajes', s + lg),
      descripcion:'Cada eje es un grupo con su puntaje máximo; cada polígono, un proponente habilitado. ' + (pri ? 'Primero en el orden: ' + pri.nombre + ' con ' + pri.total + ' puntos.' : '') + (R.puntaje.provisional ? ' El puntaje es provisional.' : '') };
  }

  /* ── 9. Dispersión puntaje técnico × valor ofertado ── */
  function dispersion(R, op){
    const filas = R.puntaje.filas.map(f => ({ f, o:R.ofertas.find(o => o.id === f.id) })).filter(x => x.o);
    const IZ = 70, DE = W - 30, top = 20, H = 340, abajo = H - 50;
    if (!filas.length) return { id:'dispersion', titulo:'Puntaje técnico × valor ofertado', svg:svg('dispersion', 80, 'Dispersión', texto(W / 2, 40, 'Aún no hay ofertas habilitadas con puntaje.', { anchor:'middle' })), descripcion:'Sin puntajes todavía.' };
    const vs = filas.map(x => x.o.totales.total), ts = filas.map(x => x.f.tecnico);
    const vmin = Math.min(...vs) * 0.95, vmax = Math.max(...vs) * 1.05, tmin = Math.min(...ts) * 0.9, tmax = Math.max(...ts) * 1.05;
    const x = escala(vmin, vmax, IZ, DE), y = escala(tmin, tmax, abajo, top);
    const mv = Estadistica.mediana(vs), mt = Estadistica.mediana(ts);
    let s = rect(IZ, top, x(mv) - IZ, y(mt) - top, 'var(--ok,#3B6E52)', ' style="fill:var(--ok,#3B6E52);fill-opacity:.08"') + texto(IZ + 6, top + 14, 'Ideal: más puntaje técnico y menor valor', { size:9.5, color:T.ok, bold:true });
    s += marcas(vmin, vmax, 5).map(v => linea(x(v), top, x(v), abajo, T.soft) + texto(x(v), abajo + 14, millones(v), { anchor:'middle', size:9 })).join('');
    s += marcas(tmin, tmax, 4).map(v => linea(IZ, y(v), DE, y(v), T.soft) + texto(IZ - 6, y(v) + 3, String(Util.redondearDec(v, 0)), { anchor:'end', size:9 })).join('');
    s += linea(x(mv), top, x(mv), abajo, T.slate, 1, '4 3') + linea(IZ, y(mt), DE, y(mt), T.slate, 1, '4 3');
    s += texto(W / 2, H - 10, 'Valor ofertado', { anchor:'middle', size:9.5 }) + texto(16, (top + abajo) / 2, 'Puntaje técnico', { anchor:'middle', size:9.5, rot:-90 });
    filas.forEach(({ f, o }) => { const j = R.ofertas.indexOf(o); s += '<g data-of="' + esc(o.id) + '"><circle cx="' + r1(x(o.totales.total)) + '" cy="' + r1(y(f.tecnico)) + '" r="7" style="fill:' + colorDe(op, o.id, j) + '"/>' + (x(o.totales.total) > W - 170 ? texto(x(o.totales.total) - 10, y(f.tecnico) + 4, nombreCorto(o.nombre), { size:9.5, color:T.ink, anchor:'end' }) : texto(x(o.totales.total) + 10, y(f.tecnico) + 4, nombreCorto(o.nombre), { size:9.5, color:T.ink })) + '</g>'; });
    const ideales = filas.filter(({ f, o }) => o.totales.total <= mv && f.tecnico >= mt).map(({ o }) => o.nombre);
    return { id:'dispersion', titulo:'Puntaje técnico frente al valor ofertado', svg:svg('dispersion', H, 'Puntaje técnico frente al valor', s),
      descripcion:'Las líneas punteadas son las medianas. ' + (ideales.length ? 'En el cuadrante ideal (más puntaje técnico y menor valor que la mediana): ' + ideales.join(', ') + '.' : 'Ningún proponente queda en el cuadrante ideal.') };
  }

  /* ── 10. Curvas S de inversión ── */
  function curvas(R, op){
    const series = R.ofertas.map((o, j) => ({ o, j, c:(R.porOferta[o.id].programacion || {}).curva || [] })).filter(x => x.c.length);
    const meses = Array.from(new Set(series.flatMap(x => x.c.map(p => p.mes)))).sort();
    const IZ = 60, DE = W - 20, top = 20, H = 300, abajo = H - 60;
    if (!meses.length) return { id:'curvas', titulo:'Curvas S de inversión', svg:svg('curvas', 80, 'Curvas S', texto(W / 2, 40, 'Ninguna oferta trae programación.', { anchor:'middle' })), descripcion:'Ninguna oferta trae programación.' };
    const x = k => IZ + (meses.length > 1 ? k / (meses.length - 1) : 0.5) * (DE - IZ), y = escala(0, 1, abajo, top);
    let s = [0, 0.25, 0.5, 0.75, 1].map(v => linea(IZ, y(v), DE, y(v), T.soft) + texto(IZ - 6, y(v) + 3, Math.round(v * 100) + ' %', { anchor:'end', size:9 })).join('');
    meses.forEach((m, k) => { if (meses.length <= 14 || k % 2 === 0) s += texto(x(k), abajo + 12, Util.MESES ? Util.MESES[Number(m.slice(5)) - 1].slice(0, 3) + ' ' + m.slice(2, 4) : m, { anchor:'end', size:8.5, rot:-40 }); });
    series.forEach(({ o, j, c }) => {
      const d = c.map(p => r1(x(meses.indexOf(p.mes))) + ' ' + r1(y(p.pct))).join(' L ');
      s += '<path data-of="' + esc(o.id) + '" d="M ' + d + '" style="fill:none;stroke:' + colorDe(op, o.id, j) + ';stroke-width:2"/>';
    });
    const lg = leyenda(series.map(({ o, j }) => ({ txt:nombreCorto(o.nombre), color:colorDe(op, o.id, j), of:o.id })), IZ, H - 12);
    const mitad = series.map(({ o, c }) => ({ n:o.nombre, k:(c.find(p => p.pct >= 0.5) || {}).mes })).filter(x => x.k).sort((a, b) => a.k < b.k ? -1 : 1);
    return { id:'curvas', titulo:'Curvas S de inversión superpuestas', svg:svg('curvas', H + lg.alto, 'Curvas S de inversión', s + lg.svg),
      descripcion:'Porcentaje acumulado del valor de cada oferta, mes a mes, según su programación. ' + (mitad.length ? 'Llega primero a la mitad ' + mitad[0].n + ' (' + mitad[0].k + ').' : '') };
  }

  /* ── 11. Gantt comparativo: plazo y ruta crítica ── */
  function gantt(R, op){
    const filas = R.ofertas.map((o, j) => {
      const pg = R.porOferta[o.id].programacion || {};
      const prog = ((o.oferta.programacion || {}).filas || []).filter(f => f.inicio && f.fin);
      const crit = new Set(((pg.cpm || {}).actividades || []).filter(a => a.critica).map(a => Util.normaliza(a.clave)));
      return { o, j, pg, prog, crit };
    }).filter(x => x.pg.aplica && x.prog.length);
    const IZ = 170, DE = W - 20, top = 30, alto = 34, H = top + filas.length * alto + 40;
    if (!filas.length) return { id:'gantt', titulo:'Gantt comparativo', svg:svg('gantt', 80, 'Gantt', texto(W / 2, 40, 'Ninguna oferta trae programación.', { anchor:'middle' })), descripcion:'Ninguna oferta trae programación.' };
    const ms = s => Date.parse(s + 'T00:00:00Z');
    const t0 = Math.min(...filas.map(f => ms(f.pg.inicio))), t1 = Math.max(...filas.map(f => ms(f.pg.fin)));
    const x = escala(t0, t1, IZ, DE);
    let s = '';
    for (let d = new Date(t0); d.getTime() <= t1; d.setUTCMonth(d.getUTCMonth() + 1, 1)){ const xx = x(d.getTime()); s += linea(xx, top - 8, xx, top + filas.length * alto, T.soft) + texto(xx + 2, top - 12, d.toISOString().slice(0, 7), { size:8.5 }); }
    filas.forEach(({ o, j, pg, prog, crit }, k) => {
      const y = top + k * alto, color = colorDe(op, o.id, j);
      s += '<g data-of="' + esc(o.id) + '">' + texto(IZ - 8, y + 14, nombreCorto(o.nombre), { anchor:'end', size:10, color:T.ink }) + texto(IZ - 8, y + 26, pg.plazo + ' días', { anchor:'end', size:8.5, color:T.slate }) +
        rect(x(ms(pg.inicio)), y + 6, x(ms(pg.fin)) - x(ms(pg.inicio)), 18, color, ' style="fill:' + color + ';fill-opacity:.18"');
      prog.filter(f => crit.has(Util.normaliza(f.actividad))).forEach(f => { s += rect(x(ms(f.inicio)), y + 10, Math.max(1.5, x(ms(f.fin)) - x(ms(f.inicio))), 10, color); });
      s += '</g>';
    });
    s += texto(IZ, H - 10, 'Barra clara: plazo total · tramos oscuros: actividades de la ruta crítica', { size:9, color:T.slate });
    const corto2 = filas.slice().sort((a, b) => a.pg.plazo - b.pg.plazo)[0];
    return { id:'gantt', titulo:'Gantt comparativo: plazo y ruta crítica', svg:svg('gantt', H, 'Gantt comparativo', s),
      descripcion:'El plazo más corto es el de ' + corto2.o.nombre + ' (' + corto2.pg.plazo + ' días). Los tramos oscuros son las actividades de la ruta crítica de cada programación.' };
  }

  /* ── 12. Indicadores financieros frente a sus umbrales ── */
  function financieros(R, op){
    const ind = [];
    (R.umbralesFinancieros || []).forEach(u => { if (!ind.some(i => i.clave === u.clave && i.requisito === u.requisito)) ind.push(u); });
    const usar = ind.filter(u => !u.porcentajePO);
    const panelH = 26 + R.ofertas.length * 16 + 14, H = 20 + usar.length * panelH;
    let s = '', malos = [];
    usar.forEach((u, k) => {
      const y0 = 20 + k * panelH;
      const vals = R.ofertas.map(o => { const fo = (R.porOferta[o.id].financiero || {})[u.requisito]; const i = fo && (fo.indicadores || []).find(z => z.clave === u.clave); return { o, v:i ? i.valorCalculado : null, ok:i ? i.cumple : null }; });
      const max = Math.max(u.valor * 1.6, ...vals.map(v => v.v || 0)) * 1.05;
      const x = escala(0, max, 170, W - 70);
      s += texto(20, y0 + 10, u.nombre + ' (' + u.formula + ') ' + (u.op === '>=' ? '≥' : u.op === '<=' ? '≤' : u.op) + ' ' + String(u.valor).replace('.', ','), { size:10, bold:true, color:T.ink });
      vals.forEach(({ o, v, ok }, j) => {
        const y = y0 + 18 + j * 16;
        if (ok === false) malos.push(o.nombre + ' (' + u.nombre + ')');
        s += '<g data-of="' + esc(o.id) + '">' + texto(162, y + 10, nombreCorto(o.nombre), { anchor:'end', size:9 }) + (v === null ? texto(170, y + 10, 'sin dato', { size:9, color:T.slate }) :
          rect(170, y + 2, x(v) - 170, 10, ok === false ? T.bad : colorDe(op, o.id, j)) + texto(x(v) + 4, y + 11, String(Util.redondearDec(v, 2)).replace('.', ','), { size:9, mono:true, color:ok === false ? T.bad : T.steel })) + '</g>';
      });
      s += linea(x(u.valor), y0 + 14, x(u.valor), y0 + 18 + R.ofertas.length * 16, T.brass, 2);
    });
    return { id:'financieros', titulo:'Indicadores financieros frente a los umbrales del pliego', svg:svg('financieros', Math.max(60, H), 'Indicadores financieros', s || texto(W / 2, 40, 'El pliego no fija indicadores financieros.', { anchor:'middle' })),
      descripcion:'La línea latón es el umbral del pliego; en rojo, lo que no lo cumple. ' + (malos.length ? 'No cumplen: ' + malos.join(', ') + '.' : 'Todos los proponentes cumplen.') };
  }

  /* ── 13. Experiencia en SMMLV frente a lo exigido ── */
  function experienciaG(R, op){
    const L = R.ofertas.map((o, j) => ({ o, j, e:Comparativo.experiencia(R, o.id) })).filter(x => x.e);
    const IZ = 170, top = 30, alto = 26, H = top + L.length * alto + 34;
    if (!L.length) return { id:'experiencia', titulo:'Experiencia en SMMLV', svg:svg('experiencia', 80, 'Experiencia', texto(W / 2, 40, 'El pliego no mide la experiencia en SMMLV.', { anchor:'middle' })), descripcion:'Sin experiencia en SMMLV.' };
    const exigido = L[0].e.exigido, max = Math.max(exigido, ...L.map(x => x.e.suma)) * 1.1;
    const x = escala(0, max, IZ, W - 80);
    let s = marcas(0, max, 5).map(v => linea(x(v), top - 6, x(v), top + L.length * alto, T.soft) + texto(x(v), top + L.length * alto + 14, Util.cant(v), { anchor:'middle', size:9 })).join('');
    L.forEach(({ o, j, e }, k) => { const y = top + k * alto; s += '<g data-of="' + esc(o.id) + '">' + texto(IZ - 8, y + 15, nombreCorto(o.nombre), { anchor:'end', size:10, color:T.ink }) + rect(IZ, y + 5, x(e.suma) - IZ, alto - 10, e.cumple ? colorDe(op, o.id, j) : T.bad) + texto(x(e.suma) + 6, y + 15, Util.cant(Util.redondearDec(e.suma, 1)) + ' SMMLV', { size:9, mono:true }) + '</g>'; });
    s += linea(x(exigido), top - 10, x(exigido), top + L.length * alto, T.brass, 2) + texto(x(exigido), top - 14, 'Exigido ' + Util.cant(Util.redondearDec(exigido, 1)) + ' SMMLV', { anchor:'middle', size:9.5, color:T.brass, bold:true });
    const no = L.filter(x => !x.e.cumple).map(x => x.o.nombre);
    return { id:'experiencia', titulo:'Experiencia acreditada en SMMLV frente a lo exigido', svg:svg('experiencia', H, 'Experiencia acreditada', s),
      descripcion:'Suma de los contratos que cuentan, en SMMLV del año de terminación. Se exigen ' + Util.cant(Util.redondearDec(exigido, 1)) + '. ' + (no.length ? 'No alcanzan: ' + no.join(', ') + '.' : 'Todos alcanzan lo exigido.') };
  }

  /* ── 14. Desbalance a lo largo de la programación ── */
  function desbalance(R, op){
    const ind = R.desbalance.indicador || {};
    const marcadas = id => R.desbalance.marcadas.filter(m => m.ofertaId === id).length;
    const id = op.ofertaId || R.ofertas.map(o => o.id).sort((a, b) => marcadas(b) - marcadas(a) || (ind[b] || 0) - (ind[a] || 0))[0];
    const o = R.ofertas.find(x => x.id === id) || R.ofertas[0];
    const prog = ((o.oferta.programacion || {}).filas || []).filter(f => f.inicio);
    const inicio = new Map(prog.map(f => [Util.normaliza(f.actividad), f.inicio]));
    const filas = R.desbalance.filas.map(f => ({ codigo:f.codigo, nombre:f.nombre, d:(f.desvBase || {})[o.id], ini:inicio.get(Util.normaliza(f.codigo)) || '9999', marcada:R.desbalance.marcadas.some(m => m.ofertaId === o.id && m.codigo === f.codigo) }))
      .filter(f => f.d !== undefined && f.d !== null).sort((a, b) => a.ini < b.ini ? -1 : a.ini > b.ini ? 1 : a.codigo < b.codigo ? -1 : 1);
    const IZ = 60, DE = W - 20, top = 24, H = 280, abajo = H - 56;
    const lim = Math.max(0.4, ...filas.map(f => Math.abs(f.d))) * 1.05;
    const y = escala(-lim, lim, abajo, top), ancho = (DE - IZ) / (filas.length || 1);
    let s = [-lim, -lim / 2, 0, lim / 2, lim].map(v => linea(IZ, y(v), DE, y(v), v === 0 ? T.steel : T.soft) + texto(IZ - 6, y(v) + 3, pctTxt(v, 0), { anchor:'end', size:9 })).join('');
    s += linea(IZ, y(0.3), DE, y(0.3), T.brass, 0.8, '4 3') + linea(IZ, y(-0.3), DE, y(-0.3), T.brass, 0.8, '4 3');
    filas.forEach((f, k) => { s += rect(IZ + k * ancho + 1, Math.min(y(0), y(f.d)), Math.max(1, ancho - 2), Math.abs(y(f.d) - y(0)), f.d > 0 ? T.bad : T.info, f.marcada ? '' : ' style="fill:' + (f.d > 0 ? T.bad : T.info) + ';fill-opacity:.45"'); });
    s += texto(IZ, abajo + 18, 'Inicio de la obra →', { size:9, color:T.slate }) + texto(DE, abajo + 18, '→ Final', { size:9, color:T.slate, anchor:'end' });
    s += texto(IZ, abajo + 34, 'Desviación de cada actividad frente a la base, en el orden de su programación. Las líneas latón marcan ±30 %; en color pleno, las marcadas por desbalance.', { size:9, color:T.slate });
    const cg = R.porOferta[o.id].cargue || {};
    return { id:'desbalance', titulo:'Desbalance de ' + o.nombre + ' a lo largo de la programación', svg:svg('desbalance', H, 'Desbalance a lo largo de la programación', s),
      descripcion:(cg.aplica && cg.desviaciones ? 'Desviación media por tercio de la obra: ' + cg.desviaciones.map(d => pctTxt(d)).join(' · ') + '. ' : '') + R.desbalance.marcadas.filter(m => m.ofertaId === o.id).length + ' actividades marcadas por desbalance.' };
  }

  /* ── 15. Sensibilidad del orden a los pesos (tornado) ── */
  function sensibilidad(R, op){
    const filas = R.puntaje.filas;
    const orden0 = filas.slice().sort((a, b) => b.total - a.total);
    if (orden0.length < 2) return { id:'tornado', titulo:'Sensibilidad del orden de elegibilidad', svg:svg('tornado', 80, 'Sensibilidad', texto(W / 2, 40, 'Hacen falta dos proponentes con puntaje.', { anchor:'middle' })), descripcion:'Hacen falta dos proponentes con puntaje.' };
    const a = orden0[0].id, b = orden0[1].id;
    const margen = (g, f) => { const tot = x => Object.keys(x.grupos).reduce((t, k) => t + x.grupos[k] * (k === g ? f : 1), 0); return tot(filas.find(x => x.id === a)) - tot(filas.find(x => x.id === b)); };
    const m0 = orden0[0].total - orden0[1].total;
    const grupos = Object.keys(orden0[0].grupos).map(g => ({ g, mas:margen(g, 1.1), menos:margen(g, 0.9) })).map(x => Object.assign(x, { rango:Math.abs(x.mas - x.menos) })).sort((p, q) => q.rango - p.rango);
    const lim = Math.max(Math.abs(m0), ...grupos.map(x => Math.max(Math.abs(x.mas), Math.abs(x.menos)))) * 1.15 || 1;
    const IZ = 170, DE = W - 30, top = 40, alto = 24, H = top + grupos.length * alto + 44;
    const x = escala(-lim, lim, IZ, DE);
    let s = texto(IZ, 16, 'Ventaja de ' + nombreCorto(orden0[0].nombre) + ' sobre ' + nombreCorto(orden0[1].nombre) + ' si cada grupo pesa ±10 %', { size:10, bold:true, color:T.ink });
    s += linea(x(0), top - 8, x(0), top + grupos.length * alto, T.bad, 1.2) + texto(x(0), top + grupos.length * alto + 14, 'cambia el primero', { anchor:'middle', size:8.5, color:T.bad });
    s += linea(x(m0), top - 8, x(m0), top + grupos.length * alto, T.brass, 1.6, '4 3') + texto(x(m0), top - 12, 'Hoy: ' + String(Util.redondearDec(m0, 2)).replace('.', ','), { anchor:'middle', size:9, color:T.brass, bold:true });
    grupos.forEach((gr, k) => {
      const y = top + k * alto, lo = Math.min(gr.mas, gr.menos), hi = Math.max(gr.mas, gr.menos);
      s += texto(IZ - 8, y + 15, gr.g, { anchor:'end', size:10, color:T.ink }) + rect(x(lo), y + 5, Math.max(1, x(hi) - x(lo)), alto - 10, lo < 0 ? T.bad : T.info) +
        texto(x(hi) + 4, y + 15, String(Util.redondearDec(hi, 1)).replace('.', ','), { size:8.5, mono:true }) + texto(x(lo) - 4, y + 15, String(Util.redondearDec(lo, 1)).replace('.', ','), { size:8.5, mono:true, anchor:'end' });
    });
    const cambia = grupos.filter(g => Math.min(g.mas, g.menos) < 0).map(g => g.g);
    return { id:'tornado', titulo:'Sensibilidad del orden de elegibilidad a los pesos', svg:svg('tornado', H, 'Tornado de sensibilidad', s),
      descripcion:'Cada barra muestra la ventaja del primero sobre el segundo cuando ese grupo pesa un 10 % más o menos. ' + (cambia.length ? 'El primero cambia si se mueve: ' + cambia.join(', ') + '.' : 'Ningún cambio de ±10 % en un grupo cambia el primero.') };
  }

  const LISTA = [
    ['totales', 'Valor total frente a la base', totales], ['cascada', 'Cascada por capítulo', cascada], ['calor', 'Mapa de calor', calor], ['caja', 'Caja y bigotes', caja],
    ['pareto', 'Pareto de la base', pareto], ['composicion', 'Composición por insumo', composicion], ['aiu', 'AIU y administración', aiu], ['radar', 'Radar de puntajes', radar],
    ['dispersion', 'Técnico × valor', dispersion], ['curvas', 'Curvas S', curvas], ['gantt', 'Gantt comparativo', gantt], ['financieros', 'Indicadores financieros', financieros],
    ['experiencia', 'Experiencia en SMMLV', experienciaG], ['desbalance', 'Desbalance en el tiempo', desbalance], ['tornado', 'Sensibilidad (tornado)', sensibilidad]
  ];
  /** Una gráfica por su id. op = { colores:{ofertaId:hex}, ofertaId, capitulo } */
  function una(id, R, op){
    const x = LISTA.find(l => l[0] === id);
    if (!x) throw new Error('No existe la gráfica «' + id + '».');
    return Object.assign(x[2](R, op || {}), { numero:LISTA.indexOf(x) + 1, corto:x[1] });
  }
  function todas(R, op){ return LISTA.map(l => una(l[0], R, op)); }
  /** SVG listo para exportar: los colores del tema se fijan en el tema claro. */
  function paraExportar(s){ return String(s).replace(/var\(--[a-z0-9-]+,\s*([^)]+)\)/gi, '$1'); }

  return { LISTA:LISTA.map(l => ({ id:l[0], nombre:l[1] })), una, todas, paraExportar, millones, colorDesv, maximosPorGrupo };
})();
