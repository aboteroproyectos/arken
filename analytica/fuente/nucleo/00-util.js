/* ══════════════════════════════════════════════════════════════════════════
   UTIL — convenciones de ARKEN que comparten el programa principal, ARKEN
   OFERTA y las pruebas en Node. Nada aquí toca la pantalla.
   Convención numérica: punto decimal y coma de miles (1,234,567.890);
   precios de insumo con 3 decimales; totales en pesos enteros; «$» seguido de
   un espacio no separable. Fechas dd/mm/aaaa y sellos dd/mm/aaaa hh:mm.
   ══════════════════════════════════════════════════════════════════════════ */
const Util = (function(){

  /* Dinero comparado con tolerancia, como igualDinero de ARKEN: medio peso. */
  const TOL = 0.5;
  const DEC_INSUMO = 3;
  const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
    'septiembre','octubre','noviembre','diciembre'];

  function redondearDec(n, d){
    const f = Math.pow(10, (d === undefined ? 4 : d));
    const x = Number(n);
    if (!isFinite(x)) return 0;
    return ((x < 0 ? -1 : 1) * Math.round(Math.abs(x) * f + 1e-9)) / f;
  }
  function redondear(n){ return redondearDec(n, 0); }
  function igualDinero(a, b){ return Math.abs(Number(a||0) - Number(b||0)) < TOL; }

  const fmtEntero = new Intl.NumberFormat('en-US', { maximumFractionDigits:0 });
  const fmt3 = new Intl.NumberFormat('en-US', { minimumFractionDigits:3, maximumFractionDigits:3 });
  const fmtQ = new Intl.NumberFormat('en-US', { maximumFractionDigits:4 });
  function money(n){ return '$ ' + fmtEntero.format(redondear(n)); }
  function money3(n){ return '$ ' + fmt3.format(redondearDec(n, DEC_INSUMO)); }
  function cant(n){ return fmtQ.format(redondearDec(n, 4)); }
  function pct(n, d){ return (Number(n)||0).toFixed(d === undefined ? 1 : d) + ' %'; }

  /** Lo que venga de un usuario, de un Excel o (en la Fase 2) de un sobre,
      se escapa antes de pintarse. Nunca se inserta HTML ajeno. */
  function esc(v){
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  /** Minúsculas, sin tildes y sin espacios a los lados: así empareja ARKEN. */
  function normaliza(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }

  let secuencia = 0;
  function uid(prefijo){
    secuencia++;
    return (prefijo||'id') + '_' + Date.now().toString(36) + secuencia.toString(36) + Math.random().toString(36).slice(2,6);
  }

  /* ── Fechas ── Las fechas sin hora se guardan como 'aaaa-mm-dd'; los
     instantes, como ISO completo con zona (America/Bogota, UTC−5, sin horario
     de verano). */
  function fechaDe(iso){
    if (!iso) return null;
    if (iso instanceof Date) return new Date(iso.getTime());
    const s = String(iso);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return new Date(+m[1], +m[2]-1, +m[3]);
    const d = new Date(s);
    return isNaN(d) ? null : d;
  }
  function isoDe(d){
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function hoyISO(){ return isoDe(new Date()); }
  function fmtFecha(iso){
    const d = fechaDe(iso); if (!d) return '—';
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
  }
  function fmtFechaLarga(iso){
    const d = fechaDe(iso); if (!d) return '—';
    return d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  }
  function fmtSello(ts){
    if (!ts) return '—';
    const d = new Date(ts); if (isNaN(d)) return '—';
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear() +
      ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
  /** 'aaaammdd' y 'aaaammdd-hhmm', para los nombres de archivo de §16 y §21. */
  function selloArchivo(ts, conHora){
    const d = new Date(ts || Date.now());
    const f = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
    return conHora ? f + '-' + String(d.getHours()).padStart(2,'0') + String(d.getMinutes()).padStart(2,'0') : f;
  }

  /** Razón social para un nombre de archivo (§13): mayúsculas, sin tildes,
      espacios y signos convertidos en guiones, máximo 40 caracteres. */
  function razonSocialArchivo(s){
    const base = String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return base.slice(0, 40).replace(/-+$/,'') || 'SIN-NOMBRE';
  }
  /** Código del proceso para un nombre de archivo: conserva letras, números
      y guiones; lo demás se vuelve guion. */
  function codigoArchivo(s){
    return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase()
      .replace(/[^A-Z0-9-]+/g, '-').replace(/-+/g,'-').replace(/^-+|-+$/g, '') || 'PROCESO';
  }

  /* ── Código de invitación: 12 caracteres sin ambigüedad (§7). Se quitan
     0/O, 1/I/L, 2/Z, 5/S y 8/B, que se confunden al dictarlos o leerlos. ── */
  const ALFABETO_INVITACION = 'ACDEFGHJKMNPQRTUVWXY34679';
  function codigoInvitacion(azar){
    const bytes = new Uint8Array(12);
    (azar || ((b) => crypto.getRandomValues(b)))(bytes);
    let s = '';
    // Muestreo con rechazo: 25 no divide a 256 y el módulo sesgaría el código.
    for (let i = 0; i < 12; i++){
      let b = bytes[i];
      while (b >= 250){ const x = new Uint8Array(1); crypto.getRandomValues(x); b = x[0]; }
      s += ALFABETO_INVITACION[b % 25];
    }
    return s;
  }
  function codigoInvitacionValido(s){ return new RegExp('^[' + ALFABETO_INVITACION + ']{12}$').test(String(s||'')); }

  /** Solo enlaces http y https (§24). */
  function enlaceSeguro(url){
    try { const u = new URL(String(url||'')); return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : ''; }
    catch(e){ return ''; }
  }

  function pesoLegible(b){
    const n = Number(b)||0;
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n/1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n/1048576).toFixed(1) + ' MB';
    return (n/1073741824).toFixed(2) + ' GB';
  }

  /** Copia profunda de datos planos (lo que se guarda en IndexedDB). */
  function copia(o){ return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  return { TOL, DEC_INSUMO, MESES, redondear, redondearDec, igualDinero, money, money3, cant, pct, esc,
    normaliza, uid, fechaDe, isoDe, hoyISO, fmtFecha, fmtFechaLarga, fmtSello, selloArchivo,
    razonSocialArchivo, codigoArchivo, codigoInvitacion, codigoInvitacionValido, ALFABETO_INVITACION,
    enlaceSeguro, pesoLegible, copia };
})();
