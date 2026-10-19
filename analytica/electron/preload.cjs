// ARKEN ANALYTICA · puente entre el programa y el computador.
// Expone window.arkenAnalytica con lo que el programa y la capa de la app necesitan: la bóveda
// de secretos (la clave de API del asistente) y las copias diarias. El programa no tiene acceso a
// Node ni al sistema: cada función pasa por el proceso principal, que la atiende solo si viene de
// la app.

const { contextBridge, ipcRenderer } = require('electron');

const plataforma = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux';
const argVersion = process.argv.find((a) => a.startsWith('--arken-analytica-version='));
const version = argVersion ? argVersion.slice('--arken-analytica-version='.length) : '';

async function pedir(canal, ...args) {
  const r = await ipcRenderer.invoke(canal, ...args);
  if (r && r.ok) return r.valor;
  throw new Error(r && r.error ? String(r.error) : 'La app de escritorio no respondió.');
}
const plano = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

contextBridge.exposeInMainWorld('arkenAnalytica', {
  version,
  plataforma,
  secretos: {
    disponible: () => pedir('analytica:secretos:disponible'),
    guardar: (nombre, valor, meta) => pedir('analytica:secretos:guardar', String(nombre), String(valor), plano(meta) || {}),
    info: (nombre) => pedir('analytica:secretos:info', String(nombre)),
    leer: (nombre) => pedir('analytica:secretos:leer', String(nombre)),
    borrar: (nombre) => pedir('analytica:secretos:borrar', String(nombre)),
  },
  copias: {
    hayDeHoy: () => pedir('analytica:copias:hoy'),
    guardar: (bytes) => pedir('analytica:copias:guardar', bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes),
    abrirCarpeta: () => pedir('analytica:copias:abrir'),
  },
});
