// ARKEN CONTROL · puente entre el programa y el computador (Windows y macOS).
// Solo expone lo que la capa de la app necesita: la copia interna de los datos y
// el guardado al cerrar. El programa no tiene acceso a Node ni al sistema.

const { contextBridge, ipcRenderer } = require('electron');

const plataforma = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux';

contextBridge.exposeInMainWorld('arkenEscritorio', {
  plataforma,
  leerMetaCopia: () => ipcRenderer.invoke('arken:copia:meta'),
  leerCopia: () => ipcRenderer.invoke('arken:copia:leer'),
  guardarCopia: (texto, actualizado) => ipcRenderer.invoke('arken:copia:guardar', String(texto), Number(actualizado) || Date.now()),
  borrarCopia: () => ipcRenderer.invoke('arken:copia:borrar'),
  abrirCopias: () => ipcRenderer.invoke('arken:copias:abrir'),
  alCerrar: (fn) => {
    ipcRenderer.removeAllListeners('arken:cerrar');
    ipcRenderer.on('arken:cerrar', () => fn());
  },
  listoParaCerrar: () => ipcRenderer.send('arken:listo-para-cerrar'),
});
