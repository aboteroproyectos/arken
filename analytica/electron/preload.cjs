// ARKEN ANALYTICA · puente entre el programa y el computador.
// Expone window.arkenAnalytica con lo que el programa y la capa de la app necesitan: las copias
// diarias. El programa no tiene acceso a
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

contextBridge.exposeInMainWorld('arkenAnalytica', {
  version,
  plataforma,
  copias: {
    hayDeHoy: () => pedir('analytica:copias:hoy'),
    guardar: (bytes) => pedir('analytica:copias:guardar', bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes),
    abrirCarpeta: () => pedir('analytica:copias:abrir'),
  },
});
