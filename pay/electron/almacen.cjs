// ARKEN PAY · app de escritorio · almacén de la bitácora de eventos.
//
// Toda la información de ARKEN PAY es una lista de eventos encadenados (ver nucleo/). El almacén
// solo guarda y entrega esos eventos; las reglas de negocio las valida el núcleo antes de enviar.
// Garantías del almacén, en los dos modos:
//   · solo agrega: no hay forma de editar ni borrar un evento;
//   · orden estricto: un evento solo entra si su número es el siguiente y enlaza con el hash del
//     último. Si otro usuario escribió primero, la respuesta es «conflicto» y el programa vuelve a
//     leer, revalida y reintenta.
//
// Modos:
//   local · un archivo eventos.jsonl en la carpeta de la app. Para probar o para un solo equipo.
//   nube  · una base PostgreSQL en Supabase (supabase/esquema.sql). Varios usuarios y equipos. La
//           tabla no admite UPDATE ni DELETE (disparador) y solo se escribe por la función
//           arken_pay_agregar_evento, que verifica número y enlace dentro de una transacción.
//           Se guarda una copia local de lo leído (cache.jsonl) para abrir rápido.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const RE_DIARIA = /^ARKEN_PAY_eventos_\d{4}-\d{2}-\d{2}\.jsonl$/;

function validarForma(ev) {
  if (!ev || typeof ev !== 'object') throw new Error('Evento inválido.');
  if (!Number.isSafeInteger(ev.seq) || ev.seq < 1) throw new Error('Número de evento inválido.');
  for (const k of ['id', 'tipo', 'fecha', 'hash']) if (typeof ev[k] !== 'string' || !ev[k]) throw new Error(`Evento sin ${k}.`);
  if (typeof ev.usuario !== 'string' || typeof ev.hashPrevio !== 'string') throw new Error('Evento incompleto.');
  if (!ev.datos || typeof ev.datos !== 'object') throw new Error('Evento sin datos.');
  if (JSON.stringify(ev).length > 5 * 1024 * 1024) throw new Error('Evento demasiado grande (más de 5 MB).');
  return { seq: ev.seq, id: ev.id, tipo: ev.tipo, fecha: ev.fecha, usuario: ev.usuario, datos: ev.datos, hashPrevio: ev.hashPrevio, hash: ev.hash };
}

async function leerJsonl(archivo) {
  let texto;
  try {
    texto = await fsp.readFile(archivo, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const out = [];
  const lineas = texto.split('\n');
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i].trim();
    if (!l) continue;
    try {
      out.push(JSON.parse(l));
    } catch {
      // Una última línea a medias (corte de luz durante la escritura) se descarta; una del medio no.
      if (lineas.slice(i + 1).some((x) => x.trim())) throw new Error(`El archivo de eventos está dañado en la línea ${i + 1}.`);
    }
  }
  return out;
}

async function agregarLinea(archivo, obj) {
  const fh = await fsp.open(archivo, 'a');
  try {
    await fh.write(JSON.stringify(obj) + '\n');
    await fh.sync();
  } finally {
    await fh.close();
  }
}

/* ═════════════  Modo local  ═════════════ */
function crearLocal({ carpeta, diarias = 10 }) {
  const archivo = path.join(carpeta, 'eventos.jsonl');
  const dirDiarias = path.join(carpeta, 'copias-diarias');
  let eventos = null;
  let cola = Promise.resolve();
  const enOrden = (fn) => {
    const r = cola.then(fn, fn);
    cola = r.catch(() => {});
    return r;
  };
  async function cargar() {
    if (!eventos) {
      await fsp.mkdir(carpeta, { recursive: true });
      eventos = await leerJsonl(archivo);
      eventos.forEach((e, i) => {
        if (e.seq !== i + 1) throw new Error(`El archivo de eventos tiene un hueco en el número ${i + 1}.`);
      });
    }
    return eventos;
  }
  async function copiaDiaria() {
    const hoy = new Date().toISOString().slice(0, 10);
    const destino = path.join(dirDiarias, `ARKEN_PAY_eventos_${hoy}.jsonl`);
    await fsp.mkdir(dirDiarias, { recursive: true });
    await fsp.copyFile(archivo, destino);
    const viejas = (await fsp.readdir(dirDiarias)).filter((n) => RE_DIARIA.test(n)).sort();
    for (const n of viejas.slice(0, Math.max(0, viejas.length - diarias))) await fsp.unlink(path.join(dirDiarias, n)).catch(() => {});
  }
  return {
    modo: 'local',
    info: async () => ({ modo: 'local', ubicacion: archivo, eventos: (await cargar()).length }),
    leer: (desde = 0) => enOrden(async () => (await cargar()).filter((e) => e.seq > desde)),
    agregar: (ev) =>
      enOrden(async () => {
        const lista = await cargar();
        const e = validarForma(ev);
        const ultimo = lista[lista.length - 1];
        if (e.seq !== lista.length + 1 || e.hashPrevio !== (ultimo ? ultimo.hash : '')) return { conflicto: true, ultimo: lista.length };
        await agregarLinea(archivo, e);
        lista.push(e);
        copiaDiaria().catch(() => {});
        return { ok: true, seq: e.seq };
      }),
    carpetaCopias: () => dirDiarias,
    // Empezar de cero en este equipo (por ejemplo, si nadie recuerda la contraseña del administrador
    // y no hay código de recuperación). No borra: la bitácora se guarda aparte con la fecha.
    archivar: () =>
      enOrden(async () => {
        await fsp.mkdir(carpeta, { recursive: true });
        const sello = new Date().toISOString().replace(/[:.]/g, '-');
        const destino = path.join(carpeta, `eventos-archivado-${sello}.jsonl`);
        try {
          await fsp.rename(archivo, destino);
        } catch (e) {
          if (e.code !== 'ENOENT') throw e;
        }
        eventos = null;
        return { ok: true, archivo: destino };
      }),
    documentos: crearDocumentosLocales(path.join(carpeta, 'documentos')),
  };
}

/* Documentos (XML y PDF de facturas y notas): se guardan por su hash SHA-256 y nunca se reemplazan. */
const crypto = require('node:crypto');
const MAX_DOC = 15 * 1024 * 1024;
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
function validarDoc(hash, base64) {
  if (!/^[0-9a-f]{64}$/.test(String(hash))) throw new Error('Hash de documento inválido.');
  const buf = Buffer.from(String(base64), 'base64');
  if (buf.length === 0 || buf.length > MAX_DOC) throw new Error('El documento está vacío o supera 15 MB.');
  if (sha256(buf) !== hash) throw new Error('El documento no corresponde a su hash.');
  return buf;
}
function crearDocumentosLocales(dir) {
  return {
    guardar: async (hash, base64, nombre) => {
      const buf = validarDoc(hash, base64);
      await fsp.mkdir(dir, { recursive: true });
      const destino = path.join(dir, hash);
      if (!fs.existsSync(destino)) await fsp.writeFile(destino, buf, { flag: 'wx' }).catch((e) => { if (e.code !== 'EEXIST') throw e; });
      return { ok: true, hash, nombre: String(nombre || '') };
    },
    leer: async (hash) => {
      if (!/^[0-9a-f]{64}$/.test(String(hash))) throw new Error('Hash inválido.');
      try {
        return (await fsp.readFile(path.join(dir, hash))).toString('base64');
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
  };
}

/* ═════════════  Modo nube (Supabase)  ═════════════ */
function crearNube({ url, claveAnonima, correo, clave, carpeta, fetch = globalThis.fetch }) {
  const base = String(url || '').replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base) && !/^https:\/\/[\w.-]+(:\d+)?$/i.test(base)) throw new Error('La dirección del proyecto debe ser https://xxxx.supabase.co');
  if (!claveAnonima) throw new Error('Falta la clave pública (anon) del proyecto.');
  const cache = path.join(carpeta, 'cache-nube.jsonl');
  const locales = crearDocumentosLocales(path.join(carpeta, 'documentos'));
  let sesion = null; // { access_token, refresh_token, expira }
  let eventos = null;
  let cola = Promise.resolve();
  const enOrden = (fn) => {
    const r = cola.then(fn, fn);
    cola = r.catch(() => {});
    return r;
  };

  async function pedir(ruta, opciones = {}, conSesion = true) {
    const cab = { apikey: claveAnonima, 'Content-Type': 'application/json', ...(opciones.headers || {}) };
    if (conSesion) cab.Authorization = 'Bearer ' + (await token());
    let r;
    try {
      r = await fetch(base + ruta, { ...opciones, headers: cab });
    } catch (e) {
      throw new Error('Sin conexión con la base de datos en la nube. Revise internet. (' + (e.message || e) + ')');
    }
    const texto = await r.text();
    let cuerpo = null;
    try {
      cuerpo = texto ? JSON.parse(texto) : null;
    } catch {
      cuerpo = texto;
    }
    if (!r.ok) {
      const msg = (cuerpo && (cuerpo.message || cuerpo.msg || cuerpo.error_description || cuerpo.error)) || texto || r.statusText;
      const err = new Error(String(msg));
      err.status = r.status;
      err.cuerpo = cuerpo;
      throw err;
    }
    return { cuerpo, cabeceras: r.headers };
  }

  async function token() {
    const ahora = Date.now();
    if (sesion && sesion.expira - 60000 > ahora) return sesion.access_token;
    let cuerpo;
    try {
      if (sesion && sesion.refresh_token) {
        ({ cuerpo } = await pedir('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: sesion.refresh_token }) }, false));
      }
    } catch {
      cuerpo = null;
    }
    if (!cuerpo) {
      try {
        ({ cuerpo } = await pedir('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: correo, password: clave }) }, false));
      } catch (e) {
        if (e.status === 400) throw new Error('El correo o la contraseña de la conexión a la nube no son válidos.');
        throw e;
      }
    }
    sesion = { access_token: cuerpo.access_token, refresh_token: cuerpo.refresh_token, expira: ahora + (cuerpo.expires_in || 3600) * 1000 };
    return sesion.access_token;
  }

  const deFila = (f) => ({ seq: Number(f.seq), id: f.id, tipo: f.tipo, fecha: f.fecha, usuario: f.usuario, datos: f.datos, hashPrevio: f.hash_previo, hash: f.hash });

  async function cargarCache() {
    if (eventos) return eventos;
    await fsp.mkdir(carpeta, { recursive: true });
    try {
      eventos = await leerJsonl(cache);
      if (eventos.some((e, i) => e.seq !== i + 1)) eventos = [];
    } catch {
      eventos = [];
    }
    return eventos;
  }

  async function traerNuevos() {
    const lista = await cargarCache();
    for (;;) {
      const desde = lista.length;
      const { cuerpo } = await pedir(`/rest/v1/arken_pay_eventos?select=seq,id,tipo,fecha,usuario,datos,hash_previo,hash&seq=gt.${desde}&order=seq.asc&limit=1000`);
      if (!Array.isArray(cuerpo) || cuerpo.length === 0) break;
      for (const f of cuerpo) {
        const ev = deFila(f);
        if (ev.seq !== lista.length + 1) throw new Error('La base de la nube entregó eventos fuera de orden.');
        lista.push(ev);
        await agregarLinea(cache, ev);
      }
      if (cuerpo.length < 1000) break;
    }
    return lista;
  }

  return {
    modo: 'nube',
    info: async () => ({ modo: 'nube', ubicacion: base, correo, eventos: (await cargarCache()).length }),
    probar: async () => {
      await token();
      const { cuerpo } = await pedir('/rest/v1/arken_pay_eventos?select=seq&order=seq.desc&limit=1');
      return { ok: true, eventos: Array.isArray(cuerpo) && cuerpo[0] ? Number(cuerpo[0].seq) : 0 };
    },
    leer: (desde = 0) =>
      enOrden(async () => {
        let lista;
        let sinConexion = false;
        try {
          lista = await traerNuevos();
        } catch (e) {
          lista = await cargarCache();
          if (!lista.length) throw e;
          sinConexion = String(e.message || e);
        }
        const out = lista.filter((e) => e.seq > desde);
        if (sinConexion) out.sinConexion = sinConexion;
        return out;
      }),
    agregar: (ev) =>
      enOrden(async () => {
        const e = validarForma(ev);
        try {
          await pedir('/rest/v1/rpc/arken_pay_agregar_evento', {
            method: 'POST',
            body: JSON.stringify({ p_seq: e.seq, p_id: e.id, p_tipo: e.tipo, p_fecha: e.fecha, p_usuario: e.usuario, p_datos: e.datos, p_hash_previo: e.hashPrevio, p_hash: e.hash }),
          });
        } catch (err) {
          if (/ARKEN_PAY_CONFLICTO/.test(err.message) || err.status === 409) return { conflicto: true };
          throw err;
        }
        const lista = await cargarCache();
        if (lista.length === e.seq - 1) {
          lista.push(e);
          await agregarLinea(cache, e);
        }
        return { ok: true, seq: e.seq };
      }),
    carpetaCopias: () => carpeta,
    documentos: {
      guardar: async (hash, base64, nombre) => {
        validarDoc(hash, base64);
        try {
          await pedir('/rest/v1/arken_pay_documentos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ hash, nombre: String(nombre || '').slice(0, 200), contenido: base64 }) });
        } catch (e) {
          if (e.status !== 409 && !/duplicate key/i.test(e.message)) throw e;
        }
        await locales.guardar(hash, base64, nombre);
        return { ok: true, hash };
      },
      leer: async (hash) => {
        const local = await locales.leer(hash);
        if (local) return local;
        const { cuerpo } = await pedir(`/rest/v1/arken_pay_documentos?select=contenido&hash=eq.${hash}`);
        if (!Array.isArray(cuerpo) || !cuerpo[0]) return null;
        await locales.guardar(hash, cuerpo[0].contenido);
        return cuerpo[0].contenido;
      },
    },
  };
}

module.exports = { crearLocal, crearNube, leerJsonl, validarForma };
