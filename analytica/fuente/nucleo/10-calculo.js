/* ══════════════════════════════════════════════════════════════════════════
   CALCULO — la única fuente de verdad numérica del presupuesto, igual que
   Calculo en ARKEN CONTROL. Ninguna vista calcula dinero por su cuenta.

   Estructura (la de ARKEN, §4.1):
     pres.capitulos[] = { id, codigo, nombre, subs[] }
     subs[]           = { id, codigo, nombre, acts[] }
     acts[]           = { id, codigo, nombre, unidad, cantidad, apus:[idApu…],
                          obligatorioApu, cantidadIncierta, notas }
     pres.apus[]      = { id, codigo, nombre, unidad, insumos:[{ idInsumo, cantidad }] }
     pres.insumos[]   = { id, codigo, nombre, unidad, categoria, precio }  (precio con IVA)
     pres.aiu         = { a, i, u }  (porcentaje sobre el costo directo)
     pres.iva         = { tarifa, base: 'utilidad' | 'total' | 'ninguno' }

   Unitario del APU = Σ cantidad × precio del insumo. Unitario de la actividad
   = suma de los unitarios de sus APU. Valor = unitario × cantidad. Lo demás,
   por suma. El costo directo no se redondea por renglón (ARKEN tampoco): se
   redondea al presentar y en los totales en pesos enteros.
   ══════════════════════════════════════════════════════════════════════════ */
const Calculo = (function(){

  const CATEGORIAS_INSUMO = ['Materiales','Mano de Obra','Herramientas','Equipos','Ferretería','Consumibles','Todo Costo'];

  /* Caché por presupuesto. Quien modifica un presupuesto llama a invalidar(),
     y Presupuesto (el módulo que edita) lo hace en un solo punto. */
  const cache = new WeakMap();
  function invalidar(pres){ if (pres) cache.delete(pres); }
  function ctx(pres){
    let c = cache.get(pres);
    if (c) return c;
    c = { ins:new Map(), apu:new Map(), uApu:new Map() };
    (pres.insumos||[]).forEach(i => c.ins.set(i.id, i));
    (pres.apus||[]).forEach(a => {
      c.apu.set(a.id, a);
      let t = 0;
      (a.insumos||[]).forEach(x => {
        const ins = c.ins.get(x.idInsumo);
        if (ins) t += Number(x.cantidad||0) * Number(ins.precio||0);
      });
      c.uApu.set(a.id, t);
    });
    cache.set(pres, c);
    return c;
  }

  function recorrerActividades(pres, fn){
    (pres.capitulos||[]).forEach(cap => (cap.subs||[]).forEach(sub => (sub.acts||[]).forEach(act => fn(act, sub, cap))));
  }
  function insumo(pres, id){ return ctx(pres).ins.get(id) || null; }
  function apu(pres, id){ return ctx(pres).apu.get(id) || null; }

  function unitarioAPU(pres, idApu){ return ctx(pres).uApu.get(idApu) || 0; }
  function unitarioActividad(pres, act){
    const c = ctx(pres);
    return (act.apus||[]).reduce((t, id) => t + (c.uApu.get(id) || 0), 0);
  }
  function valorActividad(pres, act){ return unitarioActividad(pres, act) * Number(act.cantidad||0); }
  function valorSubcapitulo(pres, sub){ return (sub.acts||[]).reduce((t,a) => t + valorActividad(pres,a), 0); }
  function valorCapitulo(pres, cap){ return (cap.subs||[]).reduce((t,s) => t + valorSubcapitulo(pres,s), 0); }
  function costoDirecto(pres){ return (pres.capitulos||[]).reduce((t,c) => t + valorCapitulo(pres,c), 0); }

  /** AIU, IVA y total en pesos enteros. Cada componente se redondea una vez;
      el total es la suma de los componentes ya redondeados, para que la
      suma impresa cuadre siempre con el total impreso. */
  function totales(pres){
    const cd = Util.redondear(costoDirecto(pres));
    const aiu = pres.aiu || {};
    const a = Util.redondear(cd * Number(aiu.a||0) / 100);
    const i = Util.redondear(cd * Number(aiu.i||0) / 100);
    const u = Util.redondear(cd * Number(aiu.u||0) / 100);
    const subtotal = cd + a + i + u;
    const iva = pres.iva || { tarifa:19, base:'utilidad' };
    const tarifa = Number(iva.tarifa||0) / 100;
    let baseIva = 0;
    if (iva.base === 'utilidad') baseIva = u;
    else if (iva.base === 'total') baseIva = subtotal;
    const valorIva = Util.redondear(baseIva * tarifa);
    return { costoDirecto:cd, a, i, u, aiu:a + i + u, subtotal, baseIva, iva:valorIva, total:subtotal + valorIva,
      pctA:Number(aiu.a||0), pctI:Number(aiu.i||0), pctU:Number(aiu.u||0), tarifaIva:Number(iva.tarifa||0), modoIva:iva.base || 'ninguno' };
  }

  /** Cantidad de cada insumo en todo el presupuesto: Σ rendimiento × cantidad. */
  function cantidadesInsumo(pres){
    const c = ctx(pres), q = new Map();
    recorrerActividades(pres, act => {
      const qa = Number(act.cantidad||0);
      (act.apus||[]).forEach(id => {
        const ap = c.apu.get(id); if (!ap) return;
        (ap.insumos||[]).forEach(x => q.set(x.idInsumo, (q.get(x.idInsumo)||0) + Number(x.cantidad||0) * qa));
      });
    });
    return q;
  }
  /** Valor del costo directo por categoría de insumo (las siete de ARKEN). */
  function porCategoria(pres){
    const q = cantidadesInsumo(pres), r = {};
    CATEGORIAS_INSUMO.forEach(k => r[k] = 0);
    q.forEach((cantidad, id) => {
      const ins = insumo(pres, id); if (!ins) return;
      const k = CATEGORIAS_INSUMO.indexOf(ins.categoria) >= 0 ? ins.categoria : 'Materiales';
      r[k] += cantidad * Number(ins.precio||0);
    });
    return r;
  }

  /** Actividades que suman el umbral (80 %) del costo directo, de mayor a
      menor valor (Pareto, §8). Devuelve el conjunto de ids. */
  function pareto(pres, umbral){
    const u = umbral === undefined ? 0.8 : umbral;
    const lista = [];
    recorrerActividades(pres, act => lista.push({ id:act.id, v:valorActividad(pres, act) }));
    lista.sort((x, y) => y.v - x.v);
    const total = lista.reduce((t, x) => t + x.v, 0);
    const ids = new Set();
    if (total <= 0) return ids;
    let acumulado = 0;
    for (const x of lista){
      if (acumulado / total >= u - 1e-12) break;
      ids.add(x.id); acumulado += x.v;
    }
    return ids;
  }
  /** Qué actividades exigen APU al proponente según la política del proceso:
      'todas' | 'pareto' | 'manual' (las marcadas con obligatorioApu). */
  function exigenApu(pres, politica){
    const ids = new Set();
    if (politica === 'pareto') return pareto(pres, 0.8);
    recorrerActividades(pres, act => { if (politica === 'todas' || act.obligatorioApu) ids.add(act.id); });
    return ids;
  }

  function contar(pres){
    let subs = 0, acts = 0;
    (pres.capitulos||[]).forEach(c => { subs += (c.subs||[]).length; (c.subs||[]).forEach(s => acts += (s.acts||[]).length); });
    return { capitulos:(pres.capitulos||[]).length, subcapitulos:subs, actividades:acts,
      apus:(pres.apus||[]).length, insumos:(pres.insumos||[]).length };
  }

  return { CATEGORIAS_INSUMO, invalidar, recorrerActividades, insumo, apu, unitarioAPU, unitarioActividad,
    valorActividad, valorSubcapitulo, valorCapitulo, costoDirecto, totales, cantidadesInsumo, porCategoria,
    pareto, exigenApu, contar };
})();
