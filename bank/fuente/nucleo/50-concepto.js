/* ══════════════════════════════════════════════════════════════════════════
   CONCEPTO — redacta el concepto de viabilidad a partir del resultado del
   motor. Es texto plano en párrafos (lo usan la pantalla y el PDF), escrito
   en español claro, sin adornos: qué se pidió, qué se encontró, qué cumple,
   qué no y qué se recomienda. Cada cifra sale del cálculo; nada se inventa.
   ══════════════════════════════════════════════════════════════════════════ */
const Concepto = (function(){
  const M = v => Util.money(v);

  function redactar(cliente, r, P, empresa){
    const tc = Catalogo.tipoCliente(cliente.tipo) || { nombre:cliente.tipo };
    const pf = cliente.perfil || {}, cf = r.cifras || {};
    const d = Motor.dictamen(r.dictamen);
    const S = [];
    const par = (titulo, textos) => S.push({ titulo, parrafos:textos.filter(Boolean) });

    /* 1. Solicitud */
    const sol = [];
    sol.push(cliente.nombre + ' (' + tc.nombre.toLowerCase() + (cliente.documento ? ', ' + (Catalogo.esNatural(cliente.tipo) ? 'C.C. ' : 'NIT ') + cliente.documento : '') + ') solicita ' +
      r.productoNombre.toLowerCase() + ' con ' + r.banco + (pf.montoSolicitado ? ' por ' + M(pf.montoSolicitado) : '') +
      (pf.plazoAnios ? (r.producto === 'constructor' ? ' a ' + Math.round(pf.plazoAnios * 12) + ' meses' : ' a ' + pf.plazoAnios + ' años') : '') +
      (pf.valorInmueble && Catalogo.producto(r.producto).inmueble ? ', para un inmueble de ' + M(pf.valorInmueble) + (cf.esVIS ? ' (vivienda de interés social)' : '') : '') +
      (r.producto === 'constructor' && pf.nombreProyecto ? ', para el proyecto ' + pf.nombreProyecto : '') + '.');
    par('Solicitud', sol);

    /* 2. Dictamen */
    const dic = ['Dictamen: ' + d.n.toUpperCase() + ' (puntaje ' + r.puntaje + ' de 100).'];
    if (r.dictamen === 'incompleto') dic.push('No es posible emitir concepto porque faltan datos: ' + r.faltan.join(', ') + '. Complételos en la ficha del cliente o léalos de sus documentos.');
    else if (r.dictamen === 'no_ofrece') dic.push(r.motivo || 'El banco no ofrece este crédito.');
    else if (r.dictamen === 'viable') dic.push('Con la información y los documentos aportados, la solicitud cumple las condiciones registradas para ' + r.banco + '.');
    else if (r.dictamen === 'condicionado') dic.push('La solicitud cumple las condiciones esenciales de ' + r.banco + '; quedan observaciones o datos por confirmar antes de radicar, que se detallan abajo.');
    else if (r.dictamen === 'ajustado') dic.push('La solicitud es viable con un monto menor: el monto máximo estimado es ' + M(cf.montoMaximo) + (cf.cuotaAprobable ? ', con una cuota de ' + M(cf.cuotaAprobable) : '') + '.');
    else if (r.dictamen === 'no_viable') dic.push('La solicitud no cumple condiciones de ' + r.banco + ' que no se resuelven reduciendo el monto: ' + r.criterios.filter(c => c.estado === 'bad' && c.duro).map(c => c.nombre.toLowerCase()).join('; ') + '.');
    par('Concepto', dic);

    if (r.dictamen !== 'incompleto' && r.dictamen !== 'no_ofrece'){
      /* 3. Capacidad */
      const cap = [];
      if (r.producto === 'constructor'){
        cap.push('Financiación solicitada: ' + Util.pct(cf.financiacionPct) + ' del costo del proyecto. Preventas: ' + Util.pct(cf.preventasPct) + '. Margen esperado: ' + Util.pct(cf.margenPct) +
          '. Las ventas cubren ' + (Math.round(cf.coberturaVentas * 100) / 100).toFixed(2) + ' veces el crédito.');
        cap.push('Monto máximo estimado: ' + M(cf.montoMaximo) + ' a una tasa de referencia de ' + Util.pct(cf.tasaEA, 2) + ' E.A. Con desembolsos por avance de obra, los intereses del periodo se estiman en ' + M(cf.interesesEstimados) +
          ' (saldo medio del 50 % durante ' + cf.plazoMeses + ' meses).');
      } else if (!Catalogo.esNatural(cliente.tipo)){
        cap.push('La utilidad operacional de ' + M(pf.utilidadOperacional) + ' cubre ' + (isFinite(cf.dscr) ? (Math.round(cf.dscr * 100) / 100).toFixed(2) + ' veces' : 'holgadamente') + ' el servicio anual de la deuda con el nuevo crédito.');
        cap.push('Cuota mensual estimada: ' + M(cf.cuotaSolicitada) + ' a ' + Util.pct(cf.tasaEA, 2) + ' E.A. y ' + cf.plazoAnios + ' años. Monto máximo estimado: ' + M(cf.montoMaximo) + '.');
      } else {
        cap.push('Ingreso familiar considerado: ' + M(cf.ingresos) + '. Cuota máxima por la norma de cuota/ingreso (' + Util.pct(cf.cuotaIngMax, 0) + '): ' + M(cf.cuotaMaxNorma) +
          '; por endeudamiento total (' + Util.pct(cf.endeudMax, 0) + ', descontadas las cuotas actuales): ' + M(Math.max(0, cf.cuotaMaxEnd)) + '. Cuota disponible: ' + M(cf.cuotaDisponible) + '.');
        cap.push('Con una tasa de referencia de ' + Util.pct(cf.tasaEA, 2) + ' E.A. a ' + cf.plazoAnios + ' años, la cuota estimada de lo solicitado es ' + M(cf.cuotaSolicitada) +
          ' (incluye seguros). Monto máximo por capacidad de pago: ' + M(Motor.aCentenaMil(cf.montoCapacidad)) +
          (isFinite(cf.montoGarantia) ? '; por garantía (' + Util.pct(cf.finMax, 0) + ' del inmueble): ' + M(Motor.aCentenaMil(cf.montoGarantia)) : '') + '. Monto aprobable estimado: ' + M(cf.montoAprobable) + '.');
        if (cf.cuotaInicial !== null && cf.cuotaInicial !== undefined) cap.push('Cuota inicial o recursos propios necesarios con ese monto: ' + M(cf.cuotaInicial) + '.');
      }
      par('Capacidad de pago y monto', cap);

      /* 4. Condiciones verificadas */
      const ok = r.criterios.filter(c => c.estado === 'ok'), mal = r.criterios.filter(c => c.estado === 'bad'),
        obs = r.criterios.filter(c => c.estado === 'warn'), fal = r.criterios.filter(c => c.estado === 'falta');
      const lin = c => c.nombre + ': ' + c.valor + (c.limite ? ' (exigido ' + c.limite + ')' : '') + (c.detalle ? '. ' + c.detalle : '');
      par('Condiciones que cumple', ok.length ? [ok.map(c => c.nombre + ' (' + c.valor + ')').join('; ') + '.'] : ['Ninguna verificada.']);
      if (mal.length) par('Condiciones que no cumple', mal.map(lin));
      if (obs.length) par('Observaciones', obs.map(lin));
      if (fal.length) par('Por confirmar', fal.map(lin));
      /* 5. Recomendaciones */
      const rec = (r.recomendaciones || []).slice();
      if (fal.length) rec.push('Complete lo que está por confirmar antes de radicar: ' + fal.map(c => c.nombre.toLowerCase()).join(', ') + '.');
      if (r.notasBanco) rec.push('Nota del banco: ' + r.notasBanco);
      if (rec.length) par('Recomendaciones', rec);
    }

    /* 6. Alcance */
    par('Alcance de este concepto', ['Concepto preliminar, preparado con la información y los documentos aportados por el cliente y con las condiciones registradas para ' + r.banco +
      (r.condicionesActualizadas ? ' (actualizadas el ' + Util.fmtFecha(r.condicionesActualizadas) + ')' : '') + (r.referencia ? ', que son de referencia y deben confirmarse con el banco' : '') +
      '. No es una aprobación del crédito: la decisión es del banco, después de su propio estudio de crédito, el avalúo y el estudio de títulos. Las cifras son estimadas; la tasa, los seguros y el monto definitivos los fija el banco.']);
    return S;
  }

  /** Una línea para listas y tablas. */
  function resumen(r){
    const d = Motor.dictamen(r.dictamen), cf = r.cifras || {};
    if (r.dictamen === 'incompleto') return d.n + ': falta ' + r.faltan.join(', ').toLowerCase();
    if (r.dictamen === 'no_ofrece') return r.motivo || d.n;
    return d.n + (cf.montoAprobable ? ' · ' + Util.money(cf.montoAprobable) : '') + (cf.cuotaAprobable ? ' · cuota ' + Util.money(cf.cuotaAprobable) : '');
  }
  return { redactar, resumen };
})();
