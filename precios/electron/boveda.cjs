// ARKEN PRECIOS · app de escritorio · bóveda de secretos.
//
// La clave de API y el token del servidor de recolección, cifrados por el sistema operativo
// (safeStorage de Electron: el llavero en macOS, DPAPI en Windows y el llavero del escritorio en
// Linux), en un archivo de la carpeta de la app (secretos.json, solo para el usuario del equipo).
// Nunca van en la base del programa, en un respaldo, en la copia interna, en una copia ni en un
// paquete: el programa los pide aquí cuando los necesita y solo muestra sus últimos caracteres.
//
// En Linux sin llavero, Electron cifraría con una clave fija («basic_text»), que no protege
// nada: eso cuenta como «sin cifrado», y el programa ofrece usar el secreto solo en la sesión.

const fsp = require('node:fs/promises');
const path = require('node:path');

/** Los únicos secretos que guarda la app (los mismos nombres que usa el programa). */
const NOMBRES = new Set(['clave-ia', 'token-servidor']);
const MAXIMO_VALOR = 4096;
const MAXIMO_META = 2048;

function nombreValido(n) {
  if (typeof n !== 'string' || !NOMBRES.has(n)) throw new Error('La app no guarda un secreto con ese nombre.');
  return n;
}

/** Solo los datos visibles del secreto (los últimos caracteres, quién y cuándo), como texto, número o sí/no. */
function metaLimpia(m) {
  const out = {};
  if (!m || typeof m !== 'object' || Array.isArray(m)) return out;
  for (const [k, v] of Object.entries(m).slice(0, 20)) {
    if (!/^[\w-]{1,40}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 200);
    else if ((typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean') out[k] = v;
  }
  if (JSON.stringify(out).length > MAXIMO_META) return {};
  return out;
}

/**
 * Crea la bóveda.
 * @param {object} o
 *   archivo: ruta de secretos.json
 *   cifrado: { disponible(): boolean, cifrar(texto): Buffer, descifrar(Buffer): string }
 */
function crearBoveda(o) {
  const archivo = o.archivo;
  const cifrado = o.cifrado;
  let cola = Promise.resolve();
  // Una operación a la vez: dos guardados seguidos no se pisan el archivo
  const enOrden = (fn) => {
    const r = cola.then(fn, fn);
    cola = r.catch(() => {});
    return r;
  };

  async function leerTodo() {
    try {
      const x = JSON.parse(await fsp.readFile(archivo, 'utf8'));
      if (x && typeof x === 'object' && x.secretos && typeof x.secretos === 'object') return x;
    } catch {
      // Sin archivo o ilegible: no hay secretos guardados
    }
    return { version: 1, secretos: {} };
  }
  async function escribirTodo(x) {
    await fsp.mkdir(path.dirname(archivo), { recursive: true });
    const tmp = archivo + '.tmp';
    await fsp.rm(tmp, { force: true });
    await fsp.writeFile(tmp, JSON.stringify(x), { encoding: 'utf8', mode: 0o600 });
    await fsp.rename(tmp, archivo);
  }
  const disponible = () => {
    try {
      return !!cifrado.disponible();
    } catch {
      return false;
    }
  };

  return {
    disponible,
    guardar: (n, valor, meta) =>
      enOrden(async () => {
        nombreValido(n);
        if (typeof valor !== 'string' || !valor.trim() || valor.length > MAXIMO_VALOR) throw new Error('El secreto está vacío o es demasiado largo.');
        if (!disponible()) throw new Error('El sistema operativo de este equipo no ofrece cifrado para guardarlo. Úselo solo en esta sesión.');
        const x = await leerTodo();
        x.secretos[n] = { cifrado: Buffer.from(cifrado.cifrar(valor)).toString('base64'), meta: metaLimpia(meta), guardado: new Date().toISOString() };
        await escribirTodo(x);
        return true;
      }),
    info: (n) =>
      enOrden(async () => {
        nombreValido(n);
        const s = (await leerTodo()).secretos[n];
        return s ? Object.assign({}, s.meta) : null;
      }),
    leer: (n) =>
      enOrden(async () => {
        nombreValido(n);
        const s = (await leerTodo()).secretos[n];
        if (!s || typeof s.cifrado !== 'string') return null;
        if (!disponible()) throw new Error('El sistema operativo no deja descifrar ahora el secreto guardado (¿el llavero está bloqueado?).');
        return cifrado.descifrar(Buffer.from(s.cifrado, 'base64'));
      }),
    borrar: (n) =>
      enOrden(async () => {
        nombreValido(n);
        const x = await leerTodo();
        if (x.secretos[n]) {
          delete x.secretos[n];
          await escribirTodo(x);
        }
        return true;
      }),
  };
}

/** El cifrado del sistema operativo con safeStorage. */
function cifradoDelSistema(safeStorage) {
  return {
    disponible() {
      if (!safeStorage.isEncryptionAvailable()) return false;
      if (process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function') {
        const b = safeStorage.getSelectedStorageBackend();
        return b !== 'basic_text' && b !== 'unknown';
      }
      return true;
    },
    cifrar: (texto) => safeStorage.encryptString(texto),
    descifrar: (bytes) => safeStorage.decryptString(bytes),
  };
}

module.exports = { crearBoveda, cifradoDelSistema, NOMBRES };
