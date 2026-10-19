// ARKEN ANALYTICA · app de escritorio · copias diarias de los datos (§6).
//
// Una vez al día la capa de la app (app/arken-app.js) arma un respaldo completo del programa (el
// mismo ZIP de Administración › Respaldos, con su manifiesto y sus huellas) y lo entrega aquí. Se
// guarda en la carpeta de la app:
//   datos/copias-diarias/ARKEN_ANALYTICA_copia_aaaa-mm-dd.zip   la de cada día, de los últimos 10
// Se restauran con «Restaurar respaldo» del programa. Ninguna lleva la clave de API: la bóveda no
// entra en los respaldos.

const fsp = require('node:fs/promises');
const path = require('node:path');

const RE_DIARIA = /^ARKEN_ANALYTICA_copia_\d{4}-\d{2}-\d{2}\.zip$/;
const MAXIMO = 8 * 1024 * 1024 * 1024; // 8 GB, el límite de un respaldo del programa

/** @param {object} o { carpeta (la de datos), diarias (10), ahora } */
function crearCopias(o) {
  const dir = path.join(o.carpeta, 'copias-diarias');
  const diarias = o.diarias || 10;
  const ahora = o.ahora || Date.now;
  let cola = Promise.resolve();
  const enOrden = (fn) => {
    const r = cola.then(fn, fn);
    cola = r.catch(() => {});
    return r;
  };
  function nombreDe(ms) {
    const d = new Date(ms);
    return 'ARKEN_ANALYTICA_copia_' + [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-') + '.zip';
  }
  async function lista() {
    try {
      return (await fsp.readdir(dir)).filter((n) => RE_DIARIA.test(n)).sort();
    } catch {
      return [];
    }
  }
  return {
    carpeta: () => dir,
    /** ¿Ya hay copia de hoy? */
    hayDeHoy: () => enOrden(async () => (await lista()).includes(nombreDe(ahora()))),
    /** Guarda la copia de hoy (reemplaza la de hoy si ya había) y deja solo las últimas `diarias`. */
    guardar: (bytes) =>
      enOrden(async () => {
        const b = Buffer.from(bytes);
        if (b.length < 22 || b[0] !== 0x50 || b[1] !== 0x4b) throw new Error('La copia no es un ZIP.');
        if (b.length > MAXIMO) throw new Error('La copia pasa el límite de un respaldo.');
        await fsp.mkdir(dir, { recursive: true });
        const destino = path.join(dir, nombreDe(ahora()));
        await fsp.writeFile(destino + '.tmp', b);
        await fsp.rename(destino + '.tmp', destino);
        const L = await lista();
        for (const n of L.slice(0, Math.max(0, L.length - diarias))) await fsp.rm(path.join(dir, n), { force: true });
        return { nombre: path.basename(destino), bytes: b.length };
      }),
    lista: () => enOrden(lista),
  };
}

module.exports = { crearCopias };
