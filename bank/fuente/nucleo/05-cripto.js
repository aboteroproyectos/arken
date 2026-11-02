/* ══════════════════════════════════════════════════════════════════════════
   CRIPTO — WebCrypto nativo, sin librerías, como en ARKEN ANALYTICA.
   · Contraseñas de usuario: PBKDF2-SHA-256.
   · Huellas SHA-256 en hexadecimal: cada documento cargado se guarda por su
     huella, así un mismo archivo nunca se guarda dos veces.
   ══════════════════════════════════════════════════════════════════════════ */
const Cripto = (function(){
  const ITER_CONTRASENA = 310000;
  const enc = new TextEncoder(), dec = new TextDecoder();

  function aB64(buf){
    // Se reconoce el ArrayBuffer por su etiqueta y no con instanceof, que falla
    // entre contextos (un Worker, o Node en las pruebas).
    const esBuffer = Object.prototype.toString.call(buf) === '[object ArrayBuffer]';
    const b = new Uint8Array(esBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function deB64(s){ const t = atob(s); const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; }
  function hex(buf){ return Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2,'0')).join(''); }
  function azar(n){ return crypto.getRandomValues(new Uint8Array(n)); }

  async function sha256(datos){
    const b = typeof datos === 'string' ? enc.encode(datos) : datos;
    return hex(await crypto.subtle.digest('SHA-256', b));
  }

  /* ── Contraseñas ── */
  async function hashContrasena(clave, salB64, iter){
    const sal = salB64 ? deB64(salB64) : azar(16);
    const it = iter || ITER_CONTRASENA;
    const base = await crypto.subtle.importKey('raw', enc.encode(String(clave)), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', hash:'SHA-256', salt:sal, iterations:it }, base, 256);
    return { hash:aB64(bits), sal:aB64(sal), iter:it };
  }
  async function verificarContrasena(clave, registro){
    if (!registro || !registro.hash) return false;
    const r = await hashContrasena(clave, registro.sal, registro.iter);
    // Comparación de longitud fija: no corta en el primer carácter distinto.
    let d = r.hash.length ^ registro.hash.length;
    for (let i = 0; i < Math.min(r.hash.length, registro.hash.length); i++) d |= r.hash.charCodeAt(i) ^ registro.hash.charCodeAt(i);
    return d === 0;
  }

  /* ── Llave derivada de la frase del proceso ── */
  return { sha256, hashContrasena, verificarContrasena, aB64, deB64 };
})();
