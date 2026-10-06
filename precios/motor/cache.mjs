// ARKEN PRECIOS · motor · caché de respuestas.
//
// La red guarda aquí cada respuesta buena con su fecha de vencimiento y sus validadores
// (ETag, Last-Modified). Mientras no vence, no se vuelve a pedir; al vencer se pregunta al
// sitio si cambió (304) antes de descargar de nuevo. Dos almacenes con la misma forma:
// en memoria (pruebas y celular) y en disco (escritorio y servidor).

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

/** Caché en memoria: las últimas `maximo` respuestas. */
export function cacheEnMemoria(maximo = 300) {
  const datos = new Map();
  return {
    async leer(clave) {
      if (!datos.has(clave)) return null;
      const v = datos.get(clave);
      // Lo usado pasa al final: así se va primero lo que lleva más tiempo sin usarse
      datos.delete(clave);
      datos.set(clave, v);
      return v;
    },
    async guardar(clave, valor) {
      datos.delete(clave);
      datos.set(clave, valor);
      while (datos.size > maximo) datos.delete(datos.keys().next().value);
    },
    async borrar(clave) {
      datos.delete(clave);
    },
    async vaciar() {
      datos.clear();
    },
    tamano: () => datos.size,
  };
}

/** Caché en disco: un archivo JSON por respuesta, con nombre derivado de la clave. */
export function cacheEnDisco(carpeta, o = {}) {
  const maximoBytes = o.maximoBytes || 400 * 1024 * 1024;
  const archivo = (clave) => join(carpeta, createHash('sha256').update(clave).digest('hex').slice(0, 40) + '.json');
  let listo = null;
  const preparar = () => (listo = listo || mkdir(carpeta, { recursive: true }));
  return {
    async leer(clave) {
      try {
        const v = JSON.parse(await readFile(archivo(clave), 'utf8'));
        return v && v.clave === clave ? v.valor : null;
      } catch {
        return null;
      }
    },
    async guardar(clave, valor) {
      await preparar();
      const f = archivo(clave);
      // Escritura atómica: nunca queda un archivo a medias si el equipo se apaga
      await writeFile(f + '.tmp', JSON.stringify({ clave, valor }), 'utf8');
      await rename(f + '.tmp', f);
    },
    async borrar(clave) {
      await rm(archivo(clave), { force: true });
    },
    async vaciar() {
      await rm(carpeta, { recursive: true, force: true });
      listo = null;
    },
    /** Borra lo más viejo si la carpeta pasa del máximo. */
    async podar() {
      let lista;
      try {
        lista = await readdir(carpeta);
      } catch {
        return 0;
      }
      const info = [];
      for (const n of lista) {
        if (!n.endsWith('.json')) continue;
        try {
          const s = await stat(join(carpeta, n));
          info.push({ n, t: s.mtimeMs, b: s.size });
        } catch {}
      }
      let total = info.reduce((a, x) => a + x.b, 0);
      let borrados = 0;
      for (const x of info.sort((a, b) => a.t - b.t)) {
        if (total <= maximoBytes) break;
        await rm(join(carpeta, x.n), { force: true });
        total -= x.b;
        borrados++;
      }
      return borrados;
    },
  };
}
