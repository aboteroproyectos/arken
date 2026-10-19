/* ══════════════════════════════════════════════════════════════════════════
   NIT — dígito de verificación de la DIAN (módulo 11, Anexo C).
   ══════════════════════════════════════════════════════════════════════════ */
const Nit = (function(){
  const PESOS = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

  /** Solo los dígitos del NIT, sin puntos, guiones ni el DV. */
  function limpiar(nit){ return String(nit||'').replace(/[^0-9]/g, ''); }

  function digitoVerificacion(nit){
    const n = limpiar(nit);
    if (!n || n.length > PESOS.length) return null;
    let suma = 0;
    for (let i = 0; i < n.length; i++) suma += Number(n[n.length - 1 - i]) * PESOS[i];
    const r = suma % 11;
    return r > 1 ? 11 - r : r;
  }
  function valido(nit, dv){
    const calculado = digitoVerificacion(nit);
    return calculado !== null && String(dv).trim() !== '' && Number(dv) === calculado;
  }
  /** 900123456 → 900.123.456 */
  function formatear(nit, dv){
    const n = limpiar(nit);
    const conPuntos = n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return conPuntos + (dv !== undefined && dv !== '' && dv !== null ? '-' + dv : '');
  }
  return { digitoVerificacion, valido, formatear, limpiar };
})();

/* ══════════════════════════════════════════════════════════════════════════
   FESTIVOS — días festivos de Colombia (Ley 51 de 1983), calculados por año,
   y días hábiles. Tres clases:
   · fijos, que no se mueven;
   · trasladables al lunes siguiente (Ley 51 de 1983, «ley Emiliani»);
   · los que dependen de la Pascua: Jueves y Viernes Santo (fijos respecto a
     la Pascua) y Ascensión, Corpus Christi y Sagrado Corazón (trasladados
     a lunes: Pascua + 43, + 64 y + 71 días).
   ══════════════════════════════════════════════════════════════════════════ */
const Festivos = (function(){
  const FIJOS = [[1,1,'Año Nuevo'],[5,1,'Día del Trabajo'],[7,20,'Día de la Independencia'],
    [8,7,'Batalla de Boyacá'],[12,8,'Inmaculada Concepción'],[12,25,'Navidad']];
  const TRASLADABLES = [[1,6,'Reyes Magos'],[3,19,'San José'],[6,29,'San Pedro y San Pablo'],
    [8,15,'Asunción de la Virgen'],[10,12,'Día de la Raza'],[11,1,'Todos los Santos'],
    [11,11,'Independencia de Cartagena']];

  /** Domingo de Pascua (algoritmo anónimo gregoriano de Meeus/Jones/Butcher). */
  function pascua(anio){
    const a = anio % 19, b = Math.floor(anio / 100), c = anio % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(anio, mes - 1, dia);
  }
  function masDias(d, n){ const x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }
  function alLunes(d){ const dow = d.getDay(); return dow === 1 ? d : masDias(d, (8 - dow) % 7); }

  const cache = new Map();
  /** Lista ordenada de { fecha:'aaaa-mm-dd', nombre } del año. */
  function delAnio(anio){
    if (cache.has(anio)) return cache.get(anio);
    const lista = [];
    FIJOS.forEach(([m, d, n]) => lista.push({ f:new Date(anio, m-1, d), nombre:n }));
    TRASLADABLES.forEach(([m, d, n]) => lista.push({ f:alLunes(new Date(anio, m-1, d)), nombre:n }));
    const p = pascua(anio);
    lista.push({ f:masDias(p, -3), nombre:'Jueves Santo' });
    lista.push({ f:masDias(p, -2), nombre:'Viernes Santo' });
    lista.push({ f:masDias(p, 43), nombre:'Ascensión del Señor' });
    lista.push({ f:masDias(p, 64), nombre:'Corpus Christi' });
    lista.push({ f:masDias(p, 71), nombre:'Sagrado Corazón de Jesús' });
    const r = lista.sort((x, y) => x.f - y.f).map(x => ({ fecha:Util.isoDe(x.f), nombre:x.nombre }));
    cache.set(anio, r);
    return r;
  }
  function esFestivo(fecha){
    const d = Util.fechaDe(fecha); if (!d) return false;
    const iso = Util.isoDe(d);
    return delAnio(d.getFullYear()).some(x => x.fecha === iso);
  }
  function esHabil(fecha){
    const d = Util.fechaDe(fecha); if (!d) return false;
    const dow = d.getDay();
    return dow !== 0 && dow !== 6 && !esFestivo(d);
  }
  /** Suma n días hábiles (o calendario) a una fecha 'aaaa-mm-dd'. */
  function sumarDias(fecha, n, habiles){
    let d = Util.fechaDe(fecha); if (!d) return fecha;
    if (!habiles){ d.setDate(d.getDate() + n); return Util.isoDe(d); }
    let falta = n;
    const paso = n >= 0 ? 1 : -1;
    while (falta !== 0){ d.setDate(d.getDate() + paso); if (esHabil(d)) falta -= paso; }
    return Util.isoDe(d);
  }
  /** Días entre dos fechas: hábiles cuenta los hábiles posteriores a «desde»
      hasta «hasta» inclusive; calendario, la diferencia simple. */
  function diasEntre(desde, hasta, habiles){
    const a = Util.fechaDe(desde), b = Util.fechaDe(hasta);
    if (!a || !b) return 0;
    a.setHours(0,0,0,0); b.setHours(0,0,0,0);
    if (!habiles) return Math.round((b - a) / 86400000);
    const signo = b >= a ? 1 : -1;
    let n = 0;
    const d = new Date(a.getTime());
    while (signo > 0 ? d < b : d > b){ d.setDate(d.getDate() + signo); if (esHabil(d)) n += signo; }
    return n;
  }
  return { pascua, delAnio, esFestivo, esHabil, sumarDias, diasEntre };
})();
