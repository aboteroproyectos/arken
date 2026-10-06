// ARKEN PRECIOS · puente entre el programa y el computador.
// Expone window.arkenPrecios con lo que el programa y la capa de la app necesitan: el motor de
// conectores, la bóveda de secretos y la copia interna. El programa no tiene acceso a Node ni
// al sistema: cada función pasa por el proceso principal, que la atiende solo si viene de la app.

const { contextBridge, ipcRenderer } = require('electron');

const plataforma = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux';
const argVersion = process.argv.find((a) => a.startsWith('--arken-precios-version='));
const version = argVersion ? argVersion.slice('--arken-precios-version='.length) : '';

async function pedir(canal, ...args) {
  const r = await ipcRenderer.invoke(canal, ...args);
  if (r && r.ok) return r.valor;
  throw new Error(r && r.error ? String(r.error) : 'La app de escritorio no respondió.');
}
const plano = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

contextBridge.exposeInMainWorld('arkenPrecios', {
  version,
  plataforma,
  secretos: {
    disponible: () => pedir('precios:secretos:disponible'),
    guardar: (nombre, valor, meta) => pedir('precios:secretos:guardar', String(nombre), String(valor), plano(meta) || {}),
    info: (nombre) => pedir('precios:secretos:info', String(nombre)),
    leer: (nombre) => pedir('precios:secretos:leer', String(nombre)),
    borrar: (nombre) => pedir('precios:secretos:borrar', String(nombre)),
  },
  motor: {
    correr: (plan) => pedir('precios:motor:correr', plano(plan)),
    /** Avance de la lectura en curso. Devuelve la función que deja de escuchar. */
    alEvento: (fn) => {
      const oyente = (_e, ev) => {
        try {
          fn(ev);
        } catch {}
      };
      ipcRenderer.on('precios:motor:evento', oyente);
      return () => ipcRenderer.removeListener('precios:motor:evento', oyente);
    },
    cancelar: () => pedir('precios:motor:cancelar'),
    probar: (ficha, o) => pedir('precios:motor:probar', plano(ficha), plano(o) || {}),
  },
  copia: {
    meta: () => pedir('precios:copia:meta'),
    leer: () => pedir('precios:copia:leer'),
    guardar: (texto, actualizado) => pedir('precios:copia:guardar', String(texto), Number(actualizado) || Date.now()),
    borrar: () => pedir('precios:copia:borrar'),
    abrirCarpeta: () => pedir('precios:copias:abrir'),
  },
  alCerrar: (fn) => {
    ipcRenderer.removeAllListeners('precios:cerrar');
    ipcRenderer.on('precios:cerrar', () => fn());
  },
  listoParaCerrar: () => ipcRenderer.send('precios:listo-para-cerrar'),
});
