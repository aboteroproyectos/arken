// ARKEN PAY · puente entre el programa y el computador. Expone window.arkenPay; el programa no
// tiene acceso a Node ni al sistema: cada función pasa por el proceso principal.

const { contextBridge, ipcRenderer } = require('electron');

const arg = process.argv.find((a) => a.startsWith('--arken-pay-version='));
const version = arg ? arg.slice('--arken-pay-version='.length) : '';

async function pedir(canal, ...args) {
  const r = await ipcRenderer.invoke(canal, ...args);
  if (r && r.ok) return r.valor;
  throw new Error(r && r.error ? String(r.error) : 'La app de escritorio no respondió.');
}
const plano = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

contextBridge.exposeInMainWorld('arkenPay', {
  version,
  escritorio: true,
  conexion: {
    info: () => pedir('pay:conexion:info'),
    probar: (c) => pedir('pay:conexion:probar', plano(c)),
    guardar: (c) => pedir('pay:conexion:guardar', plano(c)),
  },
  eventos: {
    leer: (desde) => pedir('pay:eventos:leer', Number(desde) || 0),
    agregar: (ev) => pedir('pay:eventos:agregar', plano(ev)),
  },
  documentos: {
    guardar: (hash, base64, nombre) => pedir('pay:documentos:guardar', String(hash), String(base64), String(nombre || '')),
    leer: (hash) => pedir('pay:documentos:leer', String(hash)),
  },
  guardarArchivo: (nombre, contenido) => pedir('pay:archivo:guardar', String(nombre), String(contenido)),
  abrirCopias: () => pedir('pay:copias:abrir'),
});
