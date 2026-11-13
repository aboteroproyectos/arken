// ARKEN FOLDER · puente entre el programa y el computador.
// Expone window.arkenFolder. El programa no tiene acceso a Node ni al disco: cada función pasa por el
// proceso principal, que la atiende solo si la ruta está dentro de un acceso que el usuario dio.

const { contextBridge, ipcRenderer } = require('electron');

const arg = process.argv.find((a) => a.startsWith('--arken-folder-version='));
const version = arg ? arg.slice('--arken-folder-version='.length) : '';

async function pedir(canal, ...args) {
  const r = await ipcRenderer.invoke(canal, ...args);
  if (r && r.ok) return r.valor;
  throw new Error(r && r.error ? String(r.error) : 'La app no respondió.');
}

contextBridge.exposeInMainWorld('arkenFolder', {
  version,
  plataforma: process.platform,
  estado: () => pedir('folder:estado'),
  darAcceso: () => pedir('folder:dar-acceso'),
  quitarAcceso: (id) => pedir('folder:quitar-acceso', id),
  ajustarAcceso: (id, cambios) => pedir('folder:ajustar-acceso', id, cambios),
  guardar: (datos) => pedir('folder:guardar', datos),
  listar: (ruta, opciones) => pedir('folder:listar', ruta, opciones || {}),
  subcarpetas: (ruta) => pedir('folder:subcarpetas', ruta),
  info: (rutas) => pedir('folder:info', rutas),
  texto: (ruta) => pedir('folder:texto', ruta),
  abrir: (ruta) => pedir('folder:abrir', ruta),
  mostrar: (ruta) => pedir('folder:mostrar', ruta),
  copiarRuta: (ruta) => pedir('folder:copiar-ruta', ruta),
  buscar: (id, texto, opciones) => pedir('folder:buscar', id, texto, opciones || {}),
  cancelarBusqueda: (id) => pedir('folder:cancelar-busqueda', id),
  vigilar: (ruta) => pedir('folder:vigilar', ruta || null),
  elegirImagen: () => pedir('folder:elegir-imagen'),
  exportar: () => pedir('folder:exportar'),
  importar: () => pedir('folder:importar'),
  abrirCarpetaDatos: () => pedir('folder:abrir-datos'),
  arrastrar: (ruta) => ipcRenderer.send('folder:arrastrar', ruta),
  alCambiar: (fn) => ipcRenderer.on('folder:cambio', (_e, ruta) => fn(ruta)),
  alMenu: (fn) => ipcRenderer.on('folder:menu', (_e, accion) => fn(accion)),
  urlArchivo: (ruta) => 'arkenarchivo://f/?r=' + encodeURIComponent(ruta),
});
