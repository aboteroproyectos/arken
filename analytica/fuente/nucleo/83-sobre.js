/* ══════════════════════════════════════════════════════════════════════════
   SOBRE DE OFERTA (§16, contrato) — nombre, cabecera, contenido, lectura en
   el principal y recálculo de la oferta.

   El sobre es un ZIP:
     sobre.json        cabecera en claro
     oferta.cifrada    oferta.json y adjuntos, en un ZIP interno cifrado (§14)
     llave.envuelta    la llave AES del contenido, envuelta para el proceso
   o, sin sobre cerrado, oferta.json y Adjuntos/<código de requisito>/<archivo>.

   sha256Contenido es la huella de la lista ordenada «ruta⇥sha256» de todos
   los archivos del sobre menos sobre.json: con o sin cifrado se verifica igual.

   Recalcular, nunca creer (§5): la oferta se vuelve un presupuesto con la
   estructura de ARKEN y las cantidades del pliego, y sus totales salen de
   Calculo, el mismo módulo que usa el evaluador y que usó el proponente.
   ══════════════════════════════════════════════════════════════════════════ */
const Sobre = (function(){

  const FORMATO = 'ARKEN-SOBRE', VERSION = 1, FORMATO_OFERTA = 'ARKEN-OFERTA';
  const FORMATO_CONF = 'ARKEN-CONFIDENCIALIDAD';

  /* Límites contra ZIP maliciosos. */
  const LIMITES = { archivos:2000, descomprimidoMB:4096, razonBomba:200, minimoBombaMB:20, largoRuta:240 };

  function nombre(razonSocial, codigo, version, ts){
    return Util.razonSocialArchivo(razonSocial) + '_' + Util.codigoArchivo(codigo) + '_OFERTA_v' + version + '_' + Util.selloArchivo(ts, true) + '.zip';
  }
  function nombreConfidencialidad(razonSocial, codigo, ts){
    return Util.razonSocialArchivo(razonSocial) + '_' + Util.codigoArchivo(codigo) + '_CONFIDENCIALIDAD_' + Util.selloArchivo(ts, true) + '.zip';
  }
  function rutaAdjunto(codigoRequisito, nombreArchivo){
    return 'Adjuntos/' + Paquete.nombreSeguro(codigoRequisito || 'GENERAL') + '/' + Paquete.nombreSeguro(nombreArchivo);
  }

  /** Huella del contenido: lista «ruta⇥sha256» ordenada por ruta. */
  async function huellaContenido(lista){
    const lineas = lista.filter(a => a.ruta !== 'sobre.json').map(a => a.ruta + '\t' + a.sha256).sort();
    return Cripto.sha256(lineas.join('\n'));
  }

  function cabecera(c){
    return { formato:FORMATO, version:VERSION, tipo:c.tipo || 'oferta', proceso:c.proceso, versionPliego:c.versionPliego, huellaPliego:c.huellaPliego || '',
      invitado:{ razonSocial:c.invitado.razonSocial, nit:c.invitado.nit, codigoInvitacion:c.invitado.codigoInvitacion },
      generado:c.generado || new Date().toISOString(), programa:'ARKEN OFERTA ' + (c.versionPrograma || ''),
      sha256Contenido:c.sha256Contenido, cifrado:!!c.cifrado };
  }

  /* ── ZIP maliciosos ── */
  /** Revisa las entradas de un ZIP antes de leer su contenido.
      entradas = [{ nombre, dir, descomprimido, comprimido }] (tamaños en bytes). */
  function revisarZip(entradas){
    if (entradas.length > LIMITES.archivos) return 'El ZIP trae ' + entradas.length + ' archivos; el máximo es ' + LIMITES.archivos + '.';
    let total = 0;
    for (const e of entradas){
      const n = String(e.nombre||'');
      if (/<|>/.test(n)) return 'El ZIP trae un nombre de archivo con HTML («' + n.slice(0, 60) + '»): se rechaza.';
      if (/[\x00-\x1f\x7f]/.test(n)) return 'El ZIP trae un nombre de archivo con caracteres de control: se rechaza.';
      if (n.length > LIMITES.largoRuta) return 'El ZIP trae una ruta de más de ' + LIMITES.largoRuta + ' caracteres: se rechaza.';
      const partes = n.replace(/\\/g, '/').split('/');
      if (n.indexOf('\\') >= 0 || /^\//.test(n) || /^[a-zA-Z]:/.test(n) || partes.some(p => p === '..'))
        return 'El ZIP trae una ruta que sale de su carpeta («' + n.slice(0, 60) + '»): se rechaza.';
      if (e.dir) continue;
      const d = Number(e.descomprimido||0), c = Number(e.comprimido||0);
      total += d;
      if (d > LIMITES.minimoBombaMB * 1048576 && c > 0 && d / c > LIMITES.razonBomba)
        return 'El archivo «' + n.slice(0, 60) + '» se expande ' + Math.round(d / c) + ' veces al descomprimirse (bomba ZIP): se rechaza.';
    }
    if (total > LIMITES.descomprimidoMB * 1048576) return 'El ZIP descomprimido pesaría ' + Util.pesoLegible(total) + ': supera el límite.';
    return '';
  }
  /** Un PDF que trae JavaScript o acciones automáticas no entra (§24). */
  function pdfConScript(bytes){
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (!(b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46)) return '';
    // Se buscan los nombres de PDF que ejecutan algo, también en su forma con #xx.
    let s = '';
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    s = s.replace(/#([0-9a-fA-F]{2})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
    if (/\/JavaScript\b/.test(s) || /\/JS\s*[(<\[]/.test(s) || /\/JS\s+\d+\s+\d+\s+R/.test(s)) return 'trae JavaScript';
    if (/\/Launch\b/.test(s)) return 'trae una acción que abre programas (/Launch)';
    return '';
  }

  /* ── Lectura en el principal (§16), en orden, deteniéndose en el primer fallo ── */
  /** ctx = { codigoProceso, invitados:[…], versionVigente, cierre (ISO), nombreArchivo, sha256Calculado, ahora }
      Devuelve { ok, motivo, avisos:[], invitado, versionAnterior }. */
  function validarCabecera(cab, ctx){
    const r = { ok:false, motivo:'', avisos:[], invitado:null, versionAnterior:false };
    if (!cab) { r.motivo = 'El ZIP no trae sobre.json: no es un sobre de ARKEN OFERTA.'; return r; }
    if (cab.formato !== FORMATO){ r.motivo = 'sobre.json no tiene el formato ARKEN-SOBRE: no es un sobre de ARKEN OFERTA.'; return r; }
    if (cab.version !== VERSION){ r.motivo = 'El sobre tiene la versión de formato ' + cab.version + ' y este programa lee la ' + VERSION + '.'; return r; }
    if (Util.codigoArchivo(cab.proceso) !== Util.codigoArchivo(ctx.codigoProceso)){ r.motivo = 'El sobre es del proceso ' + cab.proceso + ', no de ' + ctx.codigoProceso + '.'; return r; }
    const ci = cab.invitado || {};
    const inv = (ctx.invitados||[]).find(i => i.codigoInvitacion === ci.codigoInvitacion);
    if (!inv){ r.motivo = 'El código de invitación ' + (ci.codigoInvitacion || '(vacío)') + ' no corresponde a ningún invitado de este proceso.'; return r; }
    if (Nit.limpiar(inv.nit) !== Nit.limpiar(String(ci.nit||'').split('-')[0]) ){ r.motivo = 'El NIT del sobre (' + (ci.nit||'—') + ') no coincide con el del invitado ' + inv.razonSocial + '.'; return r; }
    if (inv.estado === 'retirado'){ r.motivo = inv.razonSocial + ' fue retirado del proceso: su sobre no se recibe.'; return r; }
    r.invitado = inv;
    if (ctx.nombreArchivo && String(ctx.nombreArchivo).indexOf(Util.razonSocialArchivo(inv.razonSocial)) !== 0)
      r.avisos.push('El nombre del archivo no empieza por la razón social de ' + inv.razonSocial + ' («' + Util.razonSocialArchivo(inv.razonSocial) + '»). Se recibe porque todo lo demás coincide, y queda registrado.');
    if (cab.sha256Contenido !== ctx.sha256Calculado){ r.motivo = 'La huella del contenido no coincide con la de sobre.json: el sobre fue alterado o está incompleto.'; return r; }
    if (cab.tipo !== 'confidencialidad'){
      if (Number(cab.versionPliego) > Number(ctx.versionVigente)){ r.motivo = 'El sobre dice ser de la versión ' + cab.versionPliego + ' del pliego, que no existe (la vigente es la ' + ctx.versionVigente + ').'; return r; }
      if (Number(cab.versionPliego) < Number(ctx.versionVigente)){
        r.versionAnterior = true;
        r.avisos.push('Oferta sobre la versión ' + cab.versionPliego + ' del pliego; la vigente es la ' + ctx.versionVigente + '. El comité debe decidir si la acepta.');
      }
      const gen = new Date(cab.generado).getTime();
      if (!isFinite(gen)){ r.motivo = 'sobre.json no trae una fecha de generación válida.'; return r; }
      if (ctx.cierre && gen > new Date(ctx.cierre).getTime()){ r.motivo = 'El sobre se generó el ' + Util.fmtSello(gen) + ', después del cierre (' + Util.fmtSello(ctx.cierre) + ').'; return r; }
      const ahora = ctx.ahora || Date.now();
      if (gen - ahora > 5 * 60000) r.avisos.push('La hora del sobre (' + Util.fmtSello(gen) + ') está más de 5 minutos adelante del reloj de este equipo. Revise la hora de los dos equipos.');
    }
    r.ok = true;
    return r;
  }

  /* ── La oferta como presupuesto de ARKEN ── */
  function claveActividad(cap, sub, act){ return [cap, sub, act].map(x => Util.normaliza(x)).join('|'); }
  /** Convierte oferta.presupuesto en un presupuesto con la estructura de
      ARKEN, con las cantidades del pliego (nunca las del proponente). */
  function presupuestoDeOferta(presOferta, formulario){
    const po = presOferta || {};
    const porClave = new Map(), porCodigo = new Map();
    (po.actividades||[]).forEach(a => {
      porClave.set(claveActividad(a.capitulo, a.subcapitulo, a.codigo), a);
      if (!porCodigo.has(Util.normaliza(a.codigo))) porCodigo.set(Util.normaliza(a.codigo), a);
    });
    const insumos = [], apus = [];
    const insPorClave = new Map();
    function insumo(i){
      const k = [Util.normaliza(i.descripcion), Util.normaliza(i.unidad), Util.normaliza(i.categoria), Util.redondearDec(Number(i.precio||0), 3)].join('|');
      if (insPorClave.has(k)) return insPorClave.get(k);
      const x = { id:'oi' + (insumos.length + 1), codigo:'OI-' + (insumos.length + 1), nombre:String(i.descripcion||''), unidad:String(i.unidad||''),
        categoria:Calculo.CATEGORIAS_INSUMO.indexOf(i.categoria) >= 0 ? i.categoria : 'Materiales', precio:Number(i.precio||0) };
      insumos.push(x); insPorClave.set(k, x.id);
      return x.id;
    }
    const usadas = new Set(), faltantes = [], diferencias = [];
    const capitulos = (formulario.capitulos||[]).map(c => ({ id:'c_' + c.codigo, codigo:c.codigo, nombre:c.nombre,
      subs:(c.subs||[]).map(s => ({ id:'s_' + c.codigo + '_' + s.codigo, codigo:s.codigo, nombre:s.nombre,
        acts:(s.acts||[]).map(a => {
          const of = porClave.get(claveActividad(c.codigo, s.codigo, a.codigo)) || porCodigo.get(Util.normaliza(a.codigo));
          const act = { id:'a_' + c.codigo + '_' + s.codigo + '_' + a.codigo, codigo:a.codigo, nombre:a.nombre, unidad:a.unidad, cantidad:Number(a.cantidad||0), apus:[] };
          if (!of){ faltantes.push(a.codigo); return act; }
          usadas.add(of);
          const lista = (of.apus||[]).filter(ap => (ap.insumos||[]).length);
          if (lista.length){
            lista.forEach(ap => {
              const x = { id:'oa' + (apus.length + 1), codigo:ap.codigo || 'APU-' + (apus.length + 1), nombre:ap.nombre || a.nombre, unidad:ap.unidad || a.unidad,
                insumos:(ap.insumos||[]).map(i => ({ idInsumo:insumo(i), cantidad:Number(i.cantidad||0) })) };
              apus.push(x); act.apus.push(x.id);
            });
          } else if (Number(of.precioUnitario) > 0){
            // Precio escrito directamente (actividad sin APU obligatorio): un APU de un renglón.
            const x = { id:'oa' + (apus.length + 1), codigo:'PU-' + a.codigo, nombre:'Precio unitario sin APU', unidad:a.unidad,
              insumos:[{ idInsumo:insumo({ descripcion:'Precio unitario de ' + a.codigo, unidad:a.unidad, categoria:'Todo Costo', precio:Number(of.precioUnitario) }), cantidad:1 }] };
            apus.push(x); act.apus.push(x.id); act.sinApu = true;
          } else faltantes.push(a.codigo);
          act.precioDeclarado = Number(of.precioUnitario||0);
          return act;
        }) })) }));
    const pres = { capitulos, apus, insumos, aiu:Object.assign({ a:0, i:0, u:0 }, po.aiu ? { a:Number(po.aiu.a||0), i:Number(po.aiu.i||0), u:Number(po.aiu.u||0) } : {}),
      iva:po.iva ? { tarifa:Number(po.iva.tarifa||0), base:po.iva.base || 'utilidad' } : { tarifa:19, base:'utilidad' } };
    Calculo.recorrerActividades(pres, act => {
      if (act.precioDeclarado === undefined) return;
      const u = Calculo.unitarioActividad(pres, act);
      if (!Util.igualDinero(u, act.precioDeclarado)) diferencias.push({ codigo:act.codigo, nombre:act.nombre, declarado:act.precioDeclarado, recalculado:u });
    });
    const sobrantes = (po.actividades||[]).filter(a => !usadas.has(a)).map(a => a.codigo);
    return { pres, faltantes, sobrantes, diferencias };
  }
  /** Totales recalculados, comparados con los declarados. */
  function recalcular(oferta, formulario){
    const r = presupuestoDeOferta(oferta.presupuesto, formulario);
    const t = Calculo.totales(r.pres);
    const dec = (oferta.presupuesto && oferta.presupuesto.totales) || {};
    const diferenciasTotales = ['costoDirecto','a','i','u','iva','total'].filter(k => dec[k] !== undefined && !Util.igualDinero(dec[k], t[k]))
      .map(k => ({ concepto:k, declarado:Number(dec[k]), recalculado:t[k] }));
    return Object.assign(r, { totales:t, totalDeclarado:Number(dec.total||0), diferenciasTotales });
  }

  /** Revisión mínima de oferta.json antes de guardarla. */
  function leerOferta(texto){
    let o;
    try { o = JSON.parse(texto); } catch(e){ throw new Error('oferta.json no es un JSON válido.'); }
    if (!o || o.formato !== FORMATO_OFERTA) throw new Error('oferta.json no tiene el formato ARKEN-OFERTA.');
    if (o.version !== 1) throw new Error('oferta.json tiene la versión de formato ' + o.version + ' y este programa lee la 1.');
    if (!o.presupuesto || !Array.isArray(o.presupuesto.actividades)) throw new Error('oferta.json no trae el presupuesto.');
    if (!Array.isArray(o.adjuntos)) o.adjuntos = [];
    return o;
  }

  return { FORMATO, VERSION, FORMATO_OFERTA, FORMATO_CONF, LIMITES, nombre, nombreConfidencialidad, rutaAdjunto, huellaContenido, cabecera,
    revisarZip, pdfConScript, validarCabecera, claveActividad, presupuestoDeOferta, recalcular, leerOferta };
})();
