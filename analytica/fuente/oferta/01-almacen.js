/* ══════════════════════════════════════════════════════════════════════════
   ARKEN OFERTA · ALMACÉN — el pliego que viene dentro del programa y lo que
   el proponente guarda en su equipo (IndexedDB «arken-oferta»): borradores
   ligados al código de invitación, usuarios locales, verificaciones del
   paquete y archivos (adjuntos y documentos del proceso) por su huella.
   Nada de esto sale del equipo salvo en el sobre o en el borrador en
   archivo, y siempre porque el proponente lo pide.
   ══════════════════════════════════════════════════════════════════════════ */

/* S y Sesion con la forma que esperan UI y Pdf (compartidos con el principal):
   S.empresa es el proponente, que firma los PDF que genera ARKEN OFERTA. */
const S = { empresa:{}, config:{}, cargado:false };
const Sesion = { usuario:null, modulo:'00', pestanas:{} };

/** El pliego incrustado (§13). Puede ser reemplazado por el de una adenda importada. */
const Plg = (function(){
  let incrustado = null, texto = '', actual = null;
  function leer(){
    const el = document.getElementById('arken-pliego');
    texto = el ? el.textContent.trim() : '';
    if (!texto || texto === 'null') return null;
    incrustado = Paquete.leerPliego(texto);
    actual = incrustado;
    return incrustado;
  }
  return {
    leer,
    texto:() => texto,
    incrustado:() => incrustado,
    actual:() => actual,
    /** Una adenda cambia el pliego vigente, pero el invitado y su código siguen siendo los del paquete. */
    usar(pl){ actual = Object.assign({}, pl, { invitado:incrustado.invitado, etapa:incrustado.etapa }); },
    conf:() => !!incrustado && incrustado.etapa === 'confidencialidad'
  };
})();

const AlmacenOferta = (function(){
  const NOMBRE = 'arken-oferta', VERSION = 1;
  const ALMACENES = [['borradores','id'], ['usuarios','id'], ['verificaciones','id'], ['archivos','sha256']];
  let db = null, enMemoria = false;
  const memoria = new Map(ALMACENES.map(([n]) => [n, new Map()]));
  let alGuardar = () => {};

  function abrirDB(){
    return new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open(NOMBRE, VERSION); } catch(e){ rej(e); return; }
      req.onupgradeneeded = () => { const d = req.result; ALMACENES.forEach(([n, k]) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n, { keyPath:k }); }); };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      req.onblocked = () => rej(new Error('Otra pestaña tiene abierta una versión anterior de ARKEN OFERTA. Ciérrela y recargue.'));
    });
  }
  function st(n, modo){ return db.transaction(n, modo || 'readonly').objectStore(n); }
  function prom(req){ return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

  async function abrir(){
    try { db = await abrirDB(); } catch(e){ RegistroTecnico.anotar('IndexedDB', e); enMemoria = true; }
    return { enMemoria };
  }
  async function leer(n, id){
    if (enMemoria){ const r = memoria.get(n).get(id); return r === undefined ? null : (n === 'archivos' ? r : Util.copia(r)); }
    const r = await prom(st(n).get(id));
    return r === undefined ? null : r;
  }
  async function poner(n, reg){
    if (enMemoria) memoria.get(n).set(n === 'archivos' ? reg.sha256 : reg.id, n === 'archivos' ? reg : Util.copia(reg));
    else await prom(st(n, 'readwrite').put(n === 'archivos' ? reg : Util.copia(reg)));
    if (n === 'borradores') alGuardar();
  }
  async function borrar(n, id){
    if (enMemoria) memoria.get(n).delete(id); else await prom(st(n, 'readwrite').delete(id));
  }
  async function todos(n){
    if (enMemoria) return Array.from(memoria.get(n).values());
    return prom(st(n).getAll());
  }
  async function ponerArchivo(sha256, blob){ if (!(await leer('archivos', sha256))) await poner('archivos', { sha256, blob, peso:blob.size }); }
  async function leerArchivo(sha256){ const r = await leer('archivos', sha256); return r ? r.blob : null; }

  return { abrir, leer, poner, borrar, todos, ponerArchivo, leerArchivo, enMemoria:() => enMemoria, alGuardar:fn => { alGuardar = fn; } };
})();

/** Huella SHA-256 de un Blob sin congelar la pantalla en archivos grandes. */
async function huellaBlob(blob){ return Cripto.sha256(await blob.arrayBuffer()); }
