/* ══════════════════════════════════════════════════════════════════════════
   ESTADÍSTICA (Anexo C) — mediana, MAD y puntaje z robusto, que no se dejan
   arrastrar por una sola oferta extrema como lo harían el promedio y la
   desviación estándar. También la correlación de Pearson, para comparar dos
   ofertas, y la media geométrica, que calcula en logaritmos para no
   desbordar con valores de miles de millones.

   Carpeta evaluacion/: solo la lleva el programa principal. ARKEN OFERTA no
   necesita saber cómo se analizan las ofertas.
   ══════════════════════════════════════════════════════════════════════════ */
const Estadistica = (function(){

  /* Con menos de 3 proponentes no se usa z robusto (Anexo C). */
  const MINIMO_Z = 3;
  const K_MAD = 0.6745;

  function numeros(xs){ return (xs||[]).map(Number).filter(x => isFinite(x)); }
  function mediana(xs){
    const v = numeros(xs).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  function promedio(xs){ const v = numeros(xs); return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null; }
  function minimo(xs){ const v = numeros(xs); return v.length ? Math.min.apply(null, v) : null; }
  function maximo(xs){ const v = numeros(xs); return v.length ? Math.max.apply(null, v) : null; }
  /** MAD = mediana(|x − m|). */
  function mad(xs, m){
    const v = numeros(xs);
    if (!v.length) return null;
    const c = m === undefined || m === null ? mediana(v) : m;
    return mediana(v.map(x => Math.abs(x - c)));
  }
  /** z robusto = 0,6745 × (x − m) / MAD. Con MAD cero no hay dispersión que
      medir y devuelve null: la vista lo dice en vez de inventar un infinito. */
  function zRobusto(x, m, d){
    if (!(d > 0) || m === null || m === undefined) return null;
    return K_MAD * (Number(x) - m) / d;
  }
  function resumen(xs){
    const v = numeros(xs);
    return { n:v.length, min:minimo(v), max:maximo(v), mediana:mediana(v), promedio:promedio(v) };
  }
  /** Pearson entre dos series del mismo largo; null con menos de 3 pares o
      sin variación. */
  function pearson(xs, ys){
    const n = Math.min((xs||[]).length, (ys||[]).length);
    const a = [], b = [];
    for (let i = 0; i < n; i++){ const x = Number(xs[i]), y = Number(ys[i]); if (isFinite(x) && isFinite(y)){ a.push(x); b.push(y); } }
    if (a.length < 3) return null;
    const ma = promedio(a), mb = promedio(b);
    let sab = 0, saa = 0, sbb = 0;
    for (let i = 0; i < a.length; i++){ const da = a[i] - ma, db = b[i] - mb; sab += da * db; saa += da * da; sbb += db * db; }
    if (!(saa > 0) || !(sbb > 0)) return null;
    return sab / Math.sqrt(saa * sbb);
  }
  /** Media geométrica de valores positivos, en logaritmos. */
  function mediaGeometrica(xs){
    const v = numeros(xs);
    if (!v.length || v.some(x => !(x > 0))) return null;
    return Math.exp(v.reduce((t, x) => t + Math.log(x), 0) / v.length);
  }
  /** Desviación relativa: (x − ref) / ref, o null si no hay referencia. */
  function desviacion(x, ref){ return ref ? (Number(x) - ref) / ref : null; }

  return { MINIMO_Z, K_MAD, mediana, promedio, minimo, maximo, mad, zRobusto, resumen, pearson, mediaGeometrica, desviacion };
})();
