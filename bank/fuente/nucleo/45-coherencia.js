/* ══════════════════════════════════════════════════════════════════════════
   COHERENCIA — el estado de los documentos de un cliente y el cruce de lo
   que dicen entre ellos y con el perfil.
   · Qué documentos pide su crédito, cuáles están cargados, cuáles vencieron
     (la fecha de expedición la lee el lector o la escribe el analista) y
     cuáles no se han leído.
   · Si el salario del certificado laboral, el de los desprendibles y el del
     perfil no coinciden; si los abonos de los extractos no reflejan el
     ingreso; si la cédula cambia de un documento a otro; si los estados
     financieros no cuadran.
   Lo que sale de aquí entra al motor como criterios del concepto.
   ══════════════════════════════════════════════════════════════════════════ */
const Coherencia = (function(){

  function diasEntre(a, b){ const x = Util.fechaDe(a), y = Util.fechaDe(b); return x && y ? Math.round((y - x) / 86400000) : null; }
  function sumarDias(iso, n){ const d = Util.fechaDe(iso); if (!d) return null; d.setDate(d.getDate() + n); return Util.isoDe(d); }

  /** Documentos del catálogo que aplican al cliente según el crédito que pidió (o los generales si no ha elegido). */
  function requeridos(cliente){
    const prod = (cliente.perfil || {}).producto || null;
    return Catalogo.documentosRequeridos(cliente.tipo, prod).filter(r => prod || r.doc.productos.indexOf('*') >= 0);
  }
  /** El primer dato leído de un campo en un documento (el mejor que encontró el lector). */
  function dato(doc, campo){
    const d = doc && doc.lectura && (doc.lectura.datos || []).find(x => x.campo === campo && !x.descartado);
    return d ? d.normalizado : null;
  }
  function fechaExpedicion(doc){ return doc.fechaExpedicion || dato(doc, 'fecha_expedicion') || null; }

  /** Estado de la documentación del cliente. docs: los documentos cargados del cliente. */
  function estado(cliente, docs, hoy){
    hoy = hoy || Util.hoyISO();
    const R = requeridos(cliente), detalle = [];
    const faltantes = [], vencidos = [], sinLeer = [];
    let cargados = 0, obligatorios = 0;
    R.forEach(r => {
      const archivos = (docs || []).filter(d => d.tipoDoc === r.doc.id);
      let est = 'falta', venceEl = null, fecha = null;
      if (archivos.length){
        est = 'cargado';
        // El más reciente decide la vigencia.
        const fechas = archivos.map(fechaExpedicion).filter(Boolean).sort();
        fecha = fechas.length ? fechas[fechas.length - 1] : null;
        if (r.doc.vigencia && fecha){
          venceEl = sumarDias(fecha, r.doc.vigencia);
          if (venceEl < hoy){ est = 'vencido'; vencidos.push(r.doc.nombre + ' (expedido el ' + Util.fmtFecha(fecha) + ', vigencia ' + r.doc.vigencia + ' días)'); }
        }
        if (archivos.some(a => !a.lectura) && r.doc.lee.length) sinLeer.push(r.doc.nombre);
        else if (est === 'cargado') est = 'leido';
      }
      if (r.obligatorio){ obligatorios++; if (archivos.length) cargados++; else faltantes.push(r.doc.nombre); }
      detalle.push({ doc:r.doc, obligatorio:r.obligatorio, archivos, estado:est, fechaExpedicion:fecha, venceEl,
        sinFecha:!!(archivos.length && r.doc.vigencia && !fecha) });
    });
    const otros = (docs || []).filter(d => !R.some(r => r.doc.id === d.tipoDoc));
    return { requeridos:obligatorios, cargados, faltantes, vencidos, sinLeer, detalle, otros,
      avance:obligatorios ? Math.round(cargados / obligatorios * 100) : 100 };
  }

  /** Cruces entre documentos y con el perfil. Devuelve [{ titulo, detalle, valor, limite, grave }]. */
  function alertas(cliente, docs, P){
    const pf = cliente.perfil || {}, out = [], tol = ((P && P.toleranciaIngresos) || 10) / 100;
    const de = id => (docs || []).filter(d => d.tipoDoc === id && d.lectura);
    const primero = (ids, campo) => { for (const id of ids) for (const d of de(id)) { const v = dato(d, campo); if (v !== null && v !== undefined && v !== '') return { v, doc:d }; } return null; };
    const difiere = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) > tol;

    /* Salario: certificado laboral, desprendibles y perfil. */
    const sCert = primero(['cert_laboral', 'ingresos_exterior'], 'salario');
    const sDesp = primero(['desprendibles'], 'salario') || primero(['desprendibles'], 'total_devengado');
    const ing = Number(pf.ingresoMensual) || 0;
    if (sCert && sDesp && difiere(sCert.v, sDesp.v)) out.push({ titulo:'Salario: certificado laboral frente a desprendibles', valor:Util.money(sCert.v) + ' / ' + Util.money(sDesp.v),
      limite:'Diferencia ≤ ' + Math.round(tol * 100) + ' %', detalle:'El salario del certificado laboral (' + sCert.doc.nombre + ') no coincide con el de los desprendibles (' + sDesp.doc.nombre + '). Aclare si hay ingresos variables o un cambio reciente de salario.' });
    if (sCert && ing && difiere(sCert.v, ing) && Math.abs(sCert.v - ing) > (Number(pf.ingresosVariables) || 0)) out.push({ titulo:'Ingreso del perfil frente al certificado laboral', valor:Util.money(ing) + ' / ' + Util.money(sCert.v),
      limite:'Diferencia ≤ ' + Math.round(tol * 100) + ' %', detalle:'El ingreso mensual registrado en el perfil no es el que certifica el empleador. El banco tomará el valor del certificado.' });
    /* Extractos: los abonos deben reflejar el ingreso. */
    const ab = primero(['extractos'], 'total_abonos');
    if (ab && ing && ab.v < ing * 0.7) out.push({ titulo:'Abonos de los extractos frente al ingreso declarado', valor:Util.money(ab.v) + ' / ' + Util.money(ing),
      limite:'Abonos ≥ 70 % del ingreso', detalle:'Los abonos del extracto (' + ab.doc.nombre + ') son menores que el ingreso declarado. El banco puede no reconocer la diferencia; cargue los extractos de la cuenta donde recibe los ingresos.' });
    /* Declaración de renta del independiente. */
    if (cliente.tipo === 'independiente' || cliente.tipo === 'rentista'){
      const ib = primero(['declaracion_renta'], 'ingresos_brutos_anuales');
      if (ib && ing && Math.abs(ib.v / 12 - ing) / Math.max(ib.v / 12, ing) > 0.25) out.push({ titulo:'Ingreso del perfil frente a la declaración de renta', valor:Util.money(ing) + ' / ' + Util.money(ib.v / 12),
        limite:'Diferencia ≤ 25 %', detalle:'El ingreso mensual del perfil difiere del promedio de la declaración de renta (ingresos brutos ÷ 12). Los bancos toman como base lo declarado ante la DIAN.' });
    }
    /* Identidad: el número de documento no debe cambiar entre documentos del titular. */
    const cedulas = new Map();
    (docs || []).filter(d => d.lectura && ['cedula', 'cert_laboral', 'solicitud', 'pasaporte'].indexOf(d.tipoDoc) >= 0).forEach(d => {
      const v = dato(d, 'numero_documento'); if (v && v.length >= 6) cedulas.set(v, (cedulas.get(v) || []).concat(d.nombre));
    });
    if (cedulas.size > 1) out.push({ titulo:'Número de documento distinto entre documentos', valor:[...cedulas.keys()].join(' / '), limite:'Un solo número', grave:true,
      detalle:'Los documentos del titular muestran números de identificación distintos: ' + [...cedulas.entries()].map(([k, v]) => k + ' en ' + v.join(', ')).join('; ') + '. Verifique que todos sean del mismo cliente.' });
    const docCli = String(cliente.documento || '').replace(/\D/g, '');
    if (docCli.length >= 6 && Catalogo.esNatural(cliente.tipo) && cedulas.size === 1 && !cedulas.has(docCli)) out.push({ titulo:'Número de documento del cliente frente a los documentos', valor:cliente.documento + ' / ' + [...cedulas.keys()][0], limite:'Iguales', grave:true,
      detalle:'El documento registrado en la ficha del cliente no es el que aparece en sus documentos.' });
    /* Estados financieros: activo = pasivo + patrimonio. */
    for (const d of de('estados_financieros').concat(de('ef_corte'))){
      const a = dato(d, 'activo_total'), p = dato(d, 'pasivo_total'), q = dato(d, 'patrimonio');
      if (a && p !== null && q !== null && Math.abs(a - (p + q)) / a > 0.01) out.push({ titulo:'Los estados financieros no cuadran', valor:Util.money(a) + ' ≠ ' + Util.money(p + q), limite:'Activo = pasivo + patrimonio',
        detalle:'En ' + d.nombre + ' el activo total no es igual al pasivo más el patrimonio leídos. Puede ser una lectura de otra columna (año anterior): revise los valores en Documentos.' });
    }
    /* Preventas: el cuadro de ventas frente al perfil. */
    const uv = primero(['cuadro_ventas'], 'unidades_vendidas');
    if (uv && pf.unidadesVendidas && Number(pf.unidadesVendidas) > uv.v) out.push({ titulo:'Preventas del perfil frente al certificado de la fiduciaria', valor:pf.unidadesVendidas + ' / ' + uv.v,
      limite:'Las del certificado', detalle:'El perfil registra más unidades vendidas de las que certifica la fiduciaria. El banco solo reconoce las certificadas.' });
    return out;
  }

  return { requeridos, estado, alertas, dato, fechaExpedicion, diasEntre, sumarDias };
})();
