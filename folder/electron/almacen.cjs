// ARKEN FOLDER · dónde se guarda el tablero.
//
// Un solo archivo JSON en la carpeta del usuario (Windows: %APPDATA%\ARKEN FOLDER\arken-folder.json).
// Se escribe en un archivo temporal y luego se reemplaza, para que un corte de luz no lo deje a medias;
// la versión anterior queda como arken-folder.anterior.json y se usa si la actual no se puede leer.
// Nada sale del computador.

const fs = require('node:fs');
const path = require('node:path');

const VERSION = 1;
const MAX_BYTES = 20 * 1024 * 1024;

function vacio() {
  return {
    version: VERSION,
    accesos: [],
    tablero: { grupos: [], tarjetas: [], preferencias: {} },
    recientes: [],
  };
}

/** Deja el estado con la forma esperada, sin importar lo que traiga el archivo. */
function sanear(e) {
  const v = vacio();
  if (!e || typeof e !== 'object') return v;
  if (Array.isArray(e.accesos)) {
    v.accesos = e.accesos
      .filter((a) => a && typeof a.ruta === 'string' && typeof a.id === 'string')
      .map((a) => ({
        id: a.id,
        ruta: a.ruta,
        supercarpetas: a.supercarpetas !== false,
        tope: typeof a.tope === 'string' ? a.tope : null,
        agregado: typeof a.agregado === 'string' ? a.agregado : new Date().toISOString(),
      }));
  }
  const t = e.tablero && typeof e.tablero === 'object' ? e.tablero : {};
  v.tablero.grupos = Array.isArray(t.grupos) ? t.grupos.filter((g) => g && typeof g.id === 'string') : [];
  v.tablero.tarjetas = Array.isArray(t.tarjetas) ? t.tarjetas.filter((c) => c && typeof c.id === 'string' && typeof c.ruta === 'string') : [];
  v.tablero.preferencias = t.preferencias && typeof t.preferencias === 'object' && !Array.isArray(t.preferencias) ? t.preferencias : {};
  v.recientes = Array.isArray(e.recientes) ? e.recientes.filter((r) => r && typeof r.ruta === 'string').slice(0, 60) : [];
  return v;
}

function crearAlmacen(carpeta) {
  const archivo = path.join(carpeta, 'arken-folder.json');
  const anterior = path.join(carpeta, 'arken-folder.anterior.json');

  function leerDe(ruta) {
    const texto = fs.readFileSync(ruta, 'utf8');
    return sanear(JSON.parse(texto));
  }

  function leer() {
    for (const ruta of [archivo, anterior]) {
      try {
        if (fs.existsSync(ruta)) return leerDe(ruta);
      } catch {}
    }
    return vacio();
  }

  function guardar(estado) {
    const limpio = sanear(estado);
    const texto = JSON.stringify(limpio, null, 1);
    if (Buffer.byteLength(texto) > MAX_BYTES) throw new Error('El tablero es demasiado grande para guardarse.');
    fs.mkdirSync(carpeta, { recursive: true });
    const tmp = archivo + '.tmp';
    fs.writeFileSync(tmp, texto);
    try {
      if (fs.existsSync(archivo)) fs.copyFileSync(archivo, anterior);
    } catch {}
    fs.renameSync(tmp, archivo);
    return limpio;
  }

  return { leer, guardar, archivo };
}

module.exports = { crearAlmacen, sanear, vacio, VERSION };
