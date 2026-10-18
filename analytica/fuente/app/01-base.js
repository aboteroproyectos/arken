/* ══════════════════════════════════════════════════════════════════════════
   BASE DE LA INTERFAZ — atajos del DOM y registro técnico.
   Los errores nunca son silenciosos: el usuario ve un mensaje en español con
   el paso siguiente, y el detalle técnico queda en RegistroTecnico, que se
   descarga desde Administración.
   ══════════════════════════════════════════════════════════════════════════ */
const $ = (sel, raiz) => (raiz || document).querySelector(sel);
const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
const esc = Util.esc;
const money = Util.money, money3 = Util.money3, cant = Util.cant;

const VERSION_PROGRAMA = '{{VERSION}}';

const RegistroTecnico = (function(){
  const entradas = [];
  function anotar(contexto, error){
    const mensaje = error && error.message ? error.message : String(error);
    entradas.push({ fecha:new Date().toISOString(), contexto, mensaje, pila:error && error.stack ? String(error.stack).slice(0, 2000) : '' });
    if (entradas.length > 500) entradas.shift();
    try { console.warn('[ARKEN ANALYTICA] ' + contexto + ': ' + mensaje); } catch(e){}
  }
  return { anotar, entradas:() => entradas.slice() };
})();
window.addEventListener('error', e => RegistroTecnico.anotar('ventana', e.error || e.message));
window.addEventListener('unhandledrejection', e => RegistroTecnico.anotar('promesa', e.reason));
