// ARKEN OBRA · puente de la pantalla de inicio. Solo deja ver qué apps trae el programa y abrirlas.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('arkenObra', {
  apps: () => ipcRenderer.invoke('obra:apps'),
  abrir: (id) => ipcRenderer.invoke('obra:abrir', String(id)),
});
