/* ══════════════════════════════════════════════════════════════════════════
   CRIPTO — todo con WebCrypto nativo, sin librerías (§6, §14, §24).
   · Contraseñas de usuario: PBKDF2-SHA-256.
   · Llaves del proceso: firma ECDSA P-384 y cifrado ECDH P-384. Las privadas
     se guardan cifradas con AES-GCM de 256 bits, con llave derivada de la
     frase del proceso (PBKDF2-SHA-256, 600.000 iteraciones). La frase no se
     guarda en ninguna parte: sin ella las privadas no se pueden usar.
   · Huellas SHA-256 en hexadecimal.
   ══════════════════════════════════════════════════════════════════════════ */
const Cripto = (function(){
  const ITER_FRASE = 600000;
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
  async function llaveDeFrase(frase, sal, iter){
    const base = await crypto.subtle.importKey('raw', enc.encode(String(frase)), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', hash:'SHA-256', salt:sal, iterations:iter || ITER_FRASE },
      base, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
  }
  async function cifrarConFrase(frase, textoClaro, iter){
    const sal = azar(16), iv = azar(12);
    const k = await llaveDeFrase(frase, sal, iter);
    const datos = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, k, enc.encode(textoClaro));
    return { alg:'AES-GCM-256', kdf:'PBKDF2-SHA-256', iter:iter || ITER_FRASE, sal:aB64(sal), iv:aB64(iv), datos:aB64(datos) };
  }
  async function descifrarConFrase(frase, sobre){
    const k = await llaveDeFrase(frase, deB64(sobre.sal), sobre.iter);
    try {
      const claro = await crypto.subtle.decrypt({ name:'AES-GCM', iv:deB64(sobre.iv) }, k, deB64(sobre.datos));
      return dec.decode(claro);
    } catch(e){ throw new Error('La frase del proceso no es correcta.'); }
  }

  /** Requisitos mínimos de la frase: 16 caracteres y al menos tres palabras.
      Es lo único que protege las ofertas, y la compartirán varias personas:
      mejor una frase larga que se pueda recordar que una clave corta. */
  function fraseValida(frase){
    const f = String(frase||'').trim();
    if (f.length < 16) return 'La frase debe tener al menos 16 caracteres.';
    if (f.split(/\s+/).filter(Boolean).length < 3) return 'La frase debe tener al menos tres palabras.';
    return '';
  }

  /** Crea los dos pares de llaves del proceso. Devuelve el registro que se
      guarda: públicas en claro (JWK) y privadas cifradas con la frase. */
  async function crearLlaves(frase, codigoProceso, iter){
    const error = fraseValida(frase); if (error) throw new Error(error);
    const firma = await crypto.subtle.generateKey({ name:'ECDSA', namedCurve:'P-384' }, true, ['sign','verify']);
    const cifrado = await crypto.subtle.generateKey({ name:'ECDH', namedCurve:'P-384' }, true, ['deriveKey','deriveBits']);
    const publicaFirma = await crypto.subtle.exportKey('jwk', firma.publicKey);
    const publicaCifrado = await crypto.subtle.exportKey('jwk', cifrado.publicKey);
    const privadas = JSON.stringify({
      firma: await crypto.subtle.exportKey('jwk', firma.privateKey),
      cifrado: await crypto.subtle.exportKey('jwk', cifrado.privateKey)
    });
    const privadasCifradas = await cifrarConFrase(frase, privadas, iter);
    const huella = await sha256(JSON.stringify(publicaFirma) + JSON.stringify(publicaCifrado));
    return { formato:'ARKEN-LLAVES', version:1, proceso:codigoProceso || '', creado:new Date().toISOString(),
      publicaFirma, publicaCifrado, privadasCifradas, huellaPublicas:huella, respaldo:{ descargado:false, confirmado:false } };
  }
  async function abrirLlaves(registro, frase){
    const priv = JSON.parse(await descifrarConFrase(frase, registro.privadasCifradas));
    return {
      firma: await crypto.subtle.importKey('jwk', priv.firma, { name:'ECDSA', namedCurve:'P-384' }, false, ['sign']),
      cifrado: await crypto.subtle.importKey('jwk', priv.cifrado, { name:'ECDH', namedCurve:'P-384' }, false, ['deriveKey','deriveBits'])
    };
  }
  async function verificarFrase(registro, frase){
    try { await descifrarConFrase(frase, registro.privadasCifradas); return true; } catch(e){ return false; }
  }
  /** Contenido del archivo de respaldo de llaves: las privadas siguen
      cifradas con la frase; el archivo sin la frase no abre nada. */
  function respaldoLlaves(registro){
    const r = Util.copia(registro); delete r.respaldo;
    r.advertencia = 'Si se pierden la llave y su respaldo, ninguna oferta de este proceso se podrá abrir. Guarde este archivo en un lugar distinto del computador. Sin la frase del proceso este archivo no sirve.';
    return JSON.stringify(r, null, 2);
  }
  function leerRespaldoLlaves(texto){
    const r = JSON.parse(texto);
    if (r.formato !== 'ARKEN-LLAVES' || r.version !== 1) throw new Error('El archivo no es un respaldo de llaves de ARKEN ANALYTICA (formato ARKEN-LLAVES, versión 1).');
    if (!r.privadasCifradas || !r.publicaFirma || !r.publicaCifrado) throw new Error('El respaldo de llaves está incompleto.');
    return r;
  }

  /* ── Firma del manifiesto (§13); la Fase 2 la usa al emitir paquetes ── */
  async function firmar(llavePrivadaFirma, texto){
    const s = await crypto.subtle.sign({ name:'ECDSA', hash:'SHA-384' }, llavePrivadaFirma, enc.encode(texto));
    return aB64(s);
  }
  async function verificar(publicaFirmaJwk, texto, firmaB64){
    const k = await crypto.subtle.importKey('jwk', publicaFirmaJwk, { name:'ECDSA', namedCurve:'P-384' }, false, ['verify']);
    return crypto.subtle.verify({ name:'ECDSA', hash:'SHA-384' }, k, deB64(firmaB64), enc.encode(texto));
  }

  return { ITER_FRASE, sha256, hashContrasena, verificarContrasena, cifrarConFrase, descifrarConFrase, fraseValida,
    crearLlaves, abrirLlaves, verificarFrase, respaldoLlaves, leerRespaldoLlaves, firmar, verificar, aB64, deB64 };
})();
