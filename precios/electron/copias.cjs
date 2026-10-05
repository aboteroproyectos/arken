// ARKEN PRECIOS · app de escritorio · copia interna y copias diarias de los datos.
//
// La capa de la app (app/precios-app.js) arma un respaldo completo del programa (el mismo de
// Administración › Respaldos, con su formato y su hash) cuando cambian los datos, y lo entrega
// aquí. Se guarda en la carpeta de la app:
//   datos/copia.json.gz                        la última copia, con la que la app recupera los datos
//                                              si el almacenamiento interno se pierde
//   datos/copias-diarias/ARKEN_PRECIOS_copia_aaaa-mm-dd.json.gz
//                                              la última copia de cada día, de los últimos 10 días;
//                                              se restauran con «Restaurar respaldo» del programa
// Van comprimidas porque el historial de precios puede pesar mucho. Ninguna lleva claves: la
// bóveda no entra en los respaldos y la capa no entrega una copia que tenga algo con forma de clave.

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { promisify } = require('node:util');

const comprimir = promisify(zlib.gzip);
const descomprimir = promisify(zlib.gunzip);
const RE_DIARIA = /^ARKEN_PRECIOS_copia_\d{4}-\d{2}-\d{2}\.json\.gz$/;
const MAXIMO_TEXTO = 1024 * 1024 * 1024; // 1 GB sin comprimir

/**
 * @param {object} o { carpeta (la de datos), diarias (10), cadaMs (10 min entre copias del día), ahora }
 */
function crearCopias(o) {
  const carpeta = o.carpeta;
  const diarias = o.diarias || 10;
  const cadaMs = o.cadaMs === undefined ? 10 * 60 * 1000 : o.cadaMs;
  const ahora = o.ahora || Date.now;
  const archivo = path.join(carpeta, 'copia.json.gz');
  const archivoMeta = path.join(carpeta, 'copia-meta.json');
  const dirDiarias = path.join(carpeta, 'copias-diarias');
  let ultimaDiaria = 0;
  let cola = Promise.resolve();
  const enOrden = (fn) => {
    const r = cola.then(fn, fn);
    cola = r.catch(() => {});
    return r;
  };

  function nombreDiario(ms) {
    const d = new Date(ms);
    const f = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
    return path.join(dirDiarias, 'ARKEN_PRECIOS_copia_' + f + '.json.gz');
  }
  async function podar() {
    const lista = (await fsp.readdir(dirDiarias)).filter((n) => RE_DIARIA.test(n)).sort();
    for (const n of lista.slice(0, Math.max(0, lista.length - diarias))) await fsp.rm(path.join(dirDiarias, n), { force: true });
  }
  async function escribirAtomico(destino, datos) {
    const tmp = destino + '.tmp';
    await fsp.writeFile(tmp, datos);
    await fsp.rename(tmp, destino);
  }

  return {
    carpetaDiarias: () => dirDiarias,
    async meta() {
      try {
        return JSON.parse(await fsp.readFile(archivoMeta, 'utf8'));
      } catch {
        return null;
      }
    },
    /** El texto de la última copia, o null. Si la escritura se cortó justo al reemplazar, la anterior. */
    async leer() {
      for (const a of [archivo, archivo + '.tmp']) {
        try {
          return (await descomprimir(await fsp.readFile(a))).toString('utf8');
        } catch {
          // Sigue con la otra
        }
      }
      return null;
    },
    guardar: (texto, actualizado) =>
      enOrden(async () => {
        if (typeof texto !== 'string' || !texto || texto.length > MAXIMO_TEXTO) return false;
        await fsp.mkdir(carpeta, { recursive: true });
        const gz = await comprimir(Buffer.from(texto, 'utf8'));
        await escribirAtomico(archivo, gz);
        const marca = Number(actualizado) > 0 ? Number(actualizado) : ahora();
        await fsp.writeFile(archivoMeta, JSON.stringify({ actualizado: marca, caracteres: texto.length, bytes: gz.length }), 'utf8');
        // La copia del día se renueva cada 10 minutos de trabajo; queda la última de cada día
        const t = ahora();
        if (t - ultimaDiaria >= cadaMs || !fs.existsSync(nombreDiario(t))) {
          ultimaDiaria = t;
          await fsp.mkdir(dirDiarias, { recursive: true });
          await escribirAtomico(nombreDiario(t), gz);
          await podar();
        }
        return true;
      }),
    borrar: () =>
      enOrden(async () => {
        await fsp.rm(archivoMeta, { force: true });
        await fsp.rm(archivo, { force: true });
        return true;
      }),
  };
}

module.exports = { crearCopias, RE_DIARIA };
