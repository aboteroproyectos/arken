/* ══════════════════════════════════════════════════════════════════════════
   ALMACÉN — IndexedDB con esquema versionado, más una caché en memoria (S)
   que es la única copia que leen las vistas. Toda escritura pasa por aquí:
   actualiza S, escribe en IndexedDB y avisa a la interfaz.
   Los archivos (PDF, planos, modelos) van como Blob en un almacén aparte,
   indexados por su huella SHA-256: un mismo archivo no se guarda dos veces.
   ══════════════════════════════════════════════════════════════════════════ */
const S = { empresa:{}, config:{}, cargado:false };

const Almacen = (function(){
  const NOMBRE = 'arken-analytica';
  const VERSION = 1;
  /* [almacén, índices]. Los de las fases 2 a 4 se crean ya, vacíos, para
     que llegar a ellas no exija una migración. */
  const ESQUEMA = [
    ['procesos', []], ['presupuestosBase', [['procesoId','procesoId']]], ['basePrecios', []],
    ['requisitos', [['procesoId','procesoId']]], ['plantillasCondiciones', []],
    ['documentosProceso', [['procesoId','procesoId'], ['sha256','sha256']]],
    ['invitados', [['procesoId','procesoId']]], ['parametros', []], ['usuarios', []], ['auditoria', []],
    ['llaves', []], ['unicos', []],
    ['preguntas', [['procesoId','procesoId']]], ['adendas', [['procesoId','procesoId']]],
    ['sobres', [['procesoInvitado',['procesoId','invitadoId']]]], ['ofertas', [['procesoId','procesoId']]],
    ['documentosOferta', [['ofertaId','ofertaId'], ['sha256','sha256']]],
    ['evaluaciones', [['procesoOfertaRequisito',['procesoId','ofertaId','requisitoId']]]],
    ['subsanaciones', [['procesoId','procesoId']]], ['alertas', [['procesoId','procesoId']]],
    ['conceptos', [['procesoId','procesoId']]], ['informes', [['procesoId','procesoId']]], ['actas', [['procesoId','procesoId']]]
  ];
  const ALMACENES = ESQUEMA.map(x => x[0]);
  /* Migraciones: una función por versión, de la anterior a esa. */
  const MIGRACIONES = {
    1(db){
      ESQUEMA.forEach(([nombre, indices]) => {
        const st = db.createObjectStore(nombre, { keyPath:'id' });
        indices.forEach(([n, k]) => st.createIndex(n, k, { unique:false }));
      });
      db.createObjectStore('archivos', { keyPath:'sha256' });
    }
  };

  let db = null, enMemoria = false;
  const memoria = new Map();
  let alGuardar = () => {};

  function abrirDB(){
    return new Promise((res, rej) => {
      let req;
      try { req = indexedDB.open(NOMBRE, VERSION); } catch(e){ rej(e); return; }
      req.onupgradeneeded = ev => {
        const d = req.result;
        for (let v = (ev.oldVersion || 0) + 1; v <= VERSION; v++) MIGRACIONES[v](d, req.transaction);
      };
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
      req.onblocked = () => rej(new Error('Otra pestaña tiene abierta una versión anterior de ARKEN ANALYTICA. Ciérrela y recargue.'));
    });
  }
  function tx(nombre, modo){ return db.transaction(nombre, modo || 'readonly').objectStore(nombre); }
  function prom(req){ return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); }

  async function abrir(){
    try { db = await abrirDB(); }
    catch(e){
      RegistroTecnico.anotar('IndexedDB', e);
      enMemoria = true;
      ALMACENES.concat(['archivos']).forEach(n => memoria.set(n, new Map()));
    }
    for (const n of ALMACENES) S[n] = await todos(n);
    const unicos = S.unicos || [];
    S.empresa = (unicos.find(x => x.id === 'empresa') || {}).datos || {};
    S.config = (unicos.find(x => x.id === 'config') || {}).datos || {};
    S.cargado = true;
    return { enMemoria };
  }
  async function todos(nombre){
    if (enMemoria) return Array.from(memoria.get(nombre).values()).map(Util.copia);
    return prom(tx(nombre).getAll());
  }
  function enCache(nombre, reg){
    const lista = S[nombre];
    const i = lista.findIndex(x => x.id === reg.id);
    if (i >= 0) lista[i] = reg; else lista.push(reg);
  }
  /** Escribe un registro (copia profunda: lo guardado no se altera por
      referencia desde la pantalla) y actualiza la caché. */
  async function poner(nombre, reg){
    if (!reg || !reg.id) throw new Error('Registro sin id en ' + nombre);
    const copia = Util.copia(reg);
    enCache(nombre, copia);
    if (enMemoria) memoria.get(nombre).set(copia.id, Util.copia(copia));
    else await prom(tx(nombre, 'readwrite').put(copia));
    alGuardar();
    return copia;
  }
  async function borrar(nombre, id){
    S[nombre] = S[nombre].filter(x => x.id !== id);
    if (enMemoria) memoria.get(nombre).delete(id);
    else await prom(tx(nombre, 'readwrite').delete(id));
    alGuardar();
  }
  async function guardarEmpresa(datos){ S.empresa = Util.copia(datos); await poner('unicos', { id:'empresa', datos:S.empresa }); }
  async function guardarConfig(datos){ S.config = Util.copia(datos); await poner('unicos', { id:'config', datos:S.config }); }

  /* ── Archivos ── */
  async function ponerArchivo(sha256, blob){
    const reg = { sha256, blob, peso:blob.size, tipo:blob.type || '' };
    if (enMemoria) memoria.get('archivos').set(sha256, reg);
    else await prom(tx('archivos', 'readwrite').put(reg));
  }
  async function leerArchivo(sha256){
    if (enMemoria){ const r = memoria.get('archivos').get(sha256); return r ? r.blob : null; }
    const r = await prom(tx('archivos').get(sha256));
    return r ? r.blob : null;
  }
  async function hayArchivo(sha256){
    if (enMemoria) return memoria.get('archivos').has(sha256);
    return !!(await prom(tx('archivos').count(sha256)));
  }
  async function borrarArchivo(sha256){
    if (enMemoria) memoria.get('archivos').delete(sha256);
    else await prom(tx('archivos', 'readwrite').delete(sha256));
  }
  async function listaArchivos(){
    if (enMemoria) return Array.from(memoria.get('archivos').values()).map(r => ({ sha256:r.sha256, peso:r.peso }));
    return prom(tx('archivos').getAllKeys()).then(ks => ks.map(k => ({ sha256:k })));
  }

  /** Reemplaza TODO el contenido (restaurar respaldo). Solo se llama después
      de que el usuario confirmó, con la vista previa a la vista. */
  async function reemplazarTodo(datos, archivos){
    for (const n of ALMACENES){
      if (enMemoria) memoria.get(n).clear(); else await prom(tx(n, 'readwrite').clear());
      for (const reg of (datos[n] || [])){
        if (enMemoria) memoria.get(n).set(reg.id, Util.copia(reg)); else await prom(tx(n, 'readwrite').put(reg));
      }
    }
    if (enMemoria) memoria.get('archivos').clear(); else await prom(tx('archivos', 'readwrite').clear());
    for (const a of archivos) await ponerArchivo(a.sha256, a.blob);
    await abrirDeNuevo();
  }
  async function abrirDeNuevo(){
    for (const n of ALMACENES) S[n] = await todos(n);
    S.empresa = ((S.unicos||[]).find(x => x.id === 'empresa') || {}).datos || {};
    S.config = ((S.unicos||[]).find(x => x.id === 'config') || {}).datos || {};
  }

  return { ALMACENES, VERSION, abrir, todos, poner, borrar, guardarEmpresa, guardarConfig, ponerArchivo, leerArchivo, hayArchivo,
    borrarArchivo, listaArchivos, reemplazarTodo, enMemoria:() => enMemoria, alGuardar:(fn) => { alGuardar = fn; } };
})();
