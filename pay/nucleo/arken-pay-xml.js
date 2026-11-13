/* ARKEN PAY · lectura del XML de la factura electrónica DIAN (UBL 2.1, Anexo técnico 1.9).
 *
 * Acepta el XML de la factura (Invoice), de una nota crédito (CreditNote) o débito (DebitNote), o el
 * contenedor AttachedDocument que entregan los proveedores tecnológicos (la factura va dentro, en
 * un bloque CDATA). Devuelve los datos listos para el formulario de registro; NO registra nada.
 * Necesita un DOMParser (el del navegador o uno equivalente en pruebas).
 */
(function (raiz, fabrica) {
  const X = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = X;
  else raiz.ArkenPayXml = X;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const hijos = (n, nombre) => (n ? [...n.children].filter((c) => c.localName === nombre) : []);
  const hijo = (n, nombre) => hijos(n, nombre)[0] || null;
  /** Ruta de nombres locales: ruta(doc, 'cac:LegalMonetaryTotal/cbc:PayableAmount') */
  function ruta(n, r) {
    let act = n;
    for (const p of r.split('/')) {
      act = hijo(act, p.replace(/^\w+:/, ''));
      if (!act) return null;
    }
    return act;
  }
  const txt = (n) => (n ? n.textContent.trim() : '');
  const buscarTodos = (n, nombre) => (n ? [...n.getElementsByTagNameNS('*', nombre)] : []);

  function centavos(v) {
    const s = String(v || '').trim();
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    const neg = s.startsWith('-');
    const [e, d = ''] = s.replace('-', '').split('.');
    const d3 = (d + '000').slice(0, 3);
    let c = BigInt(e) * 100n + BigInt(d3) / 10n + (Number(d3[2]) >= 5 ? 1n : 0n);
    return Number(neg ? -c : c);
  }
  const ppmDe = (pct) => {
    const s = String(pct || '0').trim();
    const [e, d = ''] = s.split('.');
    return Number(BigInt(e || '0') * 10000n + BigInt((d + '0000').slice(0, 4)));
  };

  function parsear(texto, DOMParserImpl) {
    const P = DOMParserImpl || globalThis.DOMParser;
    if (!P) throw new Error('No hay lector de XML disponible.');
    const doc = new P().parseFromString(String(texto).replace(/^﻿/, ''), 'application/xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    if (err) throw new Error('El archivo no es un XML válido.');
    return doc.documentElement;
  }

  /** Si es un AttachedDocument, extrae el documento interno (Invoice / CreditNote / DebitNote). */
  function desempacar(raizXml, DOMParserImpl) {
    if (raizXml.localName !== 'AttachedDocument') return { doc: raizXml, contenedor: null };
    const desc = buscarTodos(raizXml, 'Description').find((d) => /<(\w+:)?(Invoice|CreditNote|DebitNote)[\s>]/.test(d.textContent));
    if (!desc) throw new Error('El AttachedDocument no trae la factura adentro.');
    const interno = parsear(desc.textContent, DOMParserImpl);
    // Respuesta de la DIAN (ApplicationResponse) que también viaja en el contenedor
    const resp = buscarTodos(raizXml, 'Description').find((d) => /ApplicationResponse/.test(d.textContent));
    let validacion = null;
    if (resp) {
      try {
        const ar = parsear(resp.textContent, DOMParserImpl);
        const codigo = txt(buscarTodos(ar, 'ResponseCode')[0]);
        validacion = { codigo, descripcion: txt(buscarTodos(ar, 'Description')[0]), fecha: txt(ruta(ar, 'cbc:IssueDate')) };
      } catch {}
    }
    return { doc: interno, contenedor: raizXml, validacion };
  }

  function parte(party) {
    if (!party) return null;
    const p = ruta(party, 'cac:Party');
    const tax = hijo(p, 'PartyTaxScheme');
    const legal = hijo(p, 'PartyLegalEntity');
    const idNodo = (tax && hijo(tax, 'CompanyID')) || (legal && hijo(legal, 'CompanyID'));
    return {
      razonSocial: txt(tax && hijo(tax, 'RegistrationName')) || txt(legal && hijo(legal, 'RegistrationName')) || txt(ruta(p, 'cac:PartyName/cbc:Name')),
      documento: txt(idNodo).replace(/[^\dA-Za-z]/g, ''),
      dv: idNodo ? idNodo.getAttribute('schemeID') || '' : '',
      tipoDocumentoDian: idNodo ? idNodo.getAttribute('schemeName') || '' : '',
      municipio: txt(ruta(p, 'cac:PhysicalLocation/cac:Address/cbc:CityName')) || txt(tax && ruta(tax, 'cac:RegistrationAddress/cbc:CityName')),
      responsabilidades: txt(tax && hijo(tax, 'TaxLevelCode')),
      correo: txt(ruta(p, 'cac:Contact/cbc:ElectronicMail')),
    };
  }
  // Tabla 13.2.1 del anexo técnico: tipos de documento
  const TIPO_DOC = { 31: 'NIT', 13: 'CC', 22: 'CE', 41: 'PAS', 42: 'NIT_EXT', 12: 'TI', 47: 'PEP', 48: 'PPT' };

  function impuestos(nodo, etiqueta) {
    // TaxTotal (IVA 01, INC 04, ICA 03) o WithholdingTaxTotal (ReteIVA 05, ReteRenta 06, ReteICA 07)
    const out = [];
    for (const tt of hijos(nodo, etiqueta)) {
      for (const st of hijos(tt, 'TaxSubtotal')) {
        const cat = hijo(st, 'TaxCategory');
        out.push({
          codigo: txt(ruta(cat, 'cac:TaxScheme/cbc:ID')),
          nombre: txt(ruta(cat, 'cac:TaxScheme/cbc:Name')),
          base: centavos(txt(hijo(st, 'TaxableAmount'))),
          valor: centavos(txt(hijo(st, 'TaxAmount'))),
          porcentaje: txt(hijo(cat, 'Percent')),
        });
      }
    }
    return out;
  }

  /**
   * Lee el XML y devuelve:
   * { clase: 'factura'|'credito'|'debito', prefijo, numero, cufe, fechaEmision, horaEmision,
   *   fechaVencimiento, emisor, cliente, resolucion, items, totales, retenciones, referencia, ... }
   */
  function leer(texto, DOMParserImpl) {
    const { doc, validacion } = desempacar(parsear(texto, DOMParserImpl), DOMParserImpl);
    const tipo = doc.localName;
    if (!['Invoice', 'CreditNote', 'DebitNote'].includes(tipo)) throw new Error(`El XML es un ${tipo}, no una factura ni una nota.`);
    const clase = tipo === 'Invoice' ? 'factura' : tipo === 'CreditNote' ? 'credito' : 'debito';
    const avisos = [];
    const id = txt(hijo(doc, 'ID'));
    const uuid = hijo(doc, 'UUID');
    const cufe = txt(uuid).toLowerCase();
    if (!/^[0-9a-f]{96}$/.test(cufe)) avisos.push('El CUFE/CUDE no tiene la forma SHA-384 (96 caracteres).');

    // Resolución y prefijo (extensión DIAN)
    const ctrl = buscarTodos(doc, 'InvoiceControl')[0];
    const resolucion = ctrl
      ? {
          numero: txt(buscarTodos(ctrl, 'InvoiceAuthorization')[0]),
          vigenciaDesde: txt(buscarTodos(ctrl, 'StartDate')[0]),
          vigenciaHasta: txt(buscarTodos(ctrl, 'EndDate')[0]),
          prefijo: txt(buscarTodos(ctrl, 'Prefix')[0]),
          desde: Number(txt(buscarTodos(ctrl, 'From')[0])) || null,
          hasta: Number(txt(buscarTodos(ctrl, 'To')[0])) || null,
        }
      : null;
    let prefijo = resolucion && resolucion.prefijo ? resolucion.prefijo : '';
    if (!prefijo) {
      const m = id.match(/^([A-Za-z]{1,4})(\d+)$/);
      if (m) prefijo = m[1];
    }
    const numero = id.slice(prefijo.length).replace(/^0+/, '') || id;

    const emisor = parte(hijo(doc, 'AccountingSupplierParty'));
    const cliente = parte(hijo(doc, 'AccountingCustomerParty'));
    if (cliente) cliente.tipoDocumento = TIPO_DOC[cliente.tipoDocumentoDian] || (cliente.tipoDocumentoDian ? 'otro' : 'NIT');

    const tot = hijo(doc, 'LegalMonetaryTotal') || hijo(doc, 'RequestedMonetaryTotal');
    const totales = {
      bruto: centavos(txt(hijo(tot, 'LineExtensionAmount'))),
      baseAntesIva: centavos(txt(hijo(tot, 'TaxExclusiveAmount'))),
      conImpuestos: centavos(txt(hijo(tot, 'TaxInclusiveAmount'))),
      descuentos: centavos(txt(hijo(tot, 'AllowanceTotalAmount'))) || 0,
      cargos: centavos(txt(hijo(tot, 'ChargeTotalAmount'))) || 0,
      anticipos: centavos(txt(hijo(tot, 'PrepaidAmount'))) || 0,
      total: centavos(txt(hijo(tot, 'PayableAmount'))),
    };
    const imp = impuestos(doc, 'TaxTotal');
    totales.iva = imp.filter((t) => t.codigo === '01').reduce((s, t) => s + (t.valor || 0), 0);
    totales.otrosImpuestos = imp.filter((t) => t.codigo !== '01');
    const retenciones = impuestos(doc, 'WithholdingTaxTotal').map((r) => ({ ...r, tipo: { '05': 'iva', '06': 'renta', '07': 'ica' }[r.codigo] || 'otra', ppm: ppmDe(r.porcentaje) }));

    const lineas = hijos(doc, tipo === 'Invoice' ? 'InvoiceLine' : tipo === 'CreditNote' ? 'CreditNoteLine' : 'DebitNoteLine').map((l) => {
      const cant = hijo(l, 'InvoicedQuantity') || hijo(l, 'CreditedQuantity') || hijo(l, 'DebitedQuantity');
      const sub = hijo(hijo(l, 'TaxTotal'), 'TaxSubtotal');
      const pct = sub ? txt(ruta(sub, 'cac:TaxCategory/cbc:Percent')) : '0';
      const esquema = sub ? txt(ruta(sub, 'cac:TaxCategory/cac:TaxScheme/cbc:ID')) : '';
      const neto = centavos(txt(hijo(l, 'LineExtensionAmount')));
      const descuentos = hijos(l, 'AllowanceCharge')
        .filter((a) => txt(hijo(a, 'ChargeIndicator')) === 'false')
        .reduce((s, a) => s + (centavos(txt(hijo(a, 'Amount'))) || 0), 0);
      const cantidad = txt(cant) || '1';
      const [ce, cd = ''] = cantidad.split('.');
      const baseIva = sub ? centavos(txt(hijo(sub, 'TaxableAmount'))) : null;
      return {
        descripcion: txt(ruta(l, 'cac:Item/cbc:Description')) || txt(ruta(l, 'cac:Item/cbc:Name')),
        cantidadMil: Number(BigInt(ce || '0') * 1000n + BigInt((cd + '000').slice(0, 3))),
        valorUnitario: centavos(txt(ruta(l, 'cac:Price/cbc:PriceAmount'))),
        descuento: descuentos,
        neto,
        ivaTipo: esquema === '01' && ppmDe(pct) > 0 ? 'gravado' : esquema === '01' ? 'exento' : 'excluido',
        ivaPpm: esquema === '01' ? ppmDe(pct) : 0,
        baseIva: esquema === '01' && baseIva !== null && baseIva !== neto ? baseIva : undefined,
      };
    });

    // Si cantidad × precio − descuento no da el neto de la línea, se usa una sola unidad con el neto
    // (hay proveedores que redondean distinto). Así los totales del registro cuadran con el XML.
    for (const it of lineas) {
      const bruto = Math.round((it.cantidadMil * (it.valorUnitario || 0)) / 1000);
      if (it.neto !== null && bruto - it.descuento !== it.neto) {
        avisos.push(`Línea «${it.descripcion.slice(0, 40)}»: cantidad × precio no da el valor de la línea; se registró por su valor total.`);
        it.cantidadMil = 1000;
        it.valorUnitario = it.neto;
        it.descuento = 0;
      }
    }

    const pago = hijo(doc, 'PaymentMeans');
    const ref = ruta(doc, 'cac:BillingReference/cac:InvoiceDocumentReference');
    const discrepancia = hijo(doc, 'DiscrepancyResponse');
    return {
      clase,
      tipoXml: tipo,
      id,
      prefijo,
      numero,
      cufe,
      esquemaCufe: uuid ? uuid.getAttribute('schemeName') || '' : '',
      ambiente: txt(hijo(doc, 'ProfileExecutionID')) === '2' ? 'pruebas' : 'produccion',
      fechaEmision: txt(hijo(doc, 'IssueDate')),
      horaEmision: txt(hijo(doc, 'IssueTime')),
      fechaVencimiento: txt(hijo(doc, 'DueDate')) || txt(pago && hijo(pago, 'PaymentDueDate')),
      formaPago: pago && txt(hijo(pago, 'ID')) === '1' ? 'contado' : 'credito',
      medioPago: txt(pago && hijo(pago, 'PaymentMeansCode')),
      moneda: txt(hijo(doc, 'DocumentCurrencyCode')) || 'COP',
      trm: txt(ruta(doc, 'cac:PaymentExchangeRate/cbc:CalculationRate')) || null,
      ordenCompra: txt(ruta(doc, 'cac:OrderReference/cbc:ID')),
      notas: hijos(doc, 'Note').map(txt).filter(Boolean),
      emisor,
      cliente,
      resolucion,
      items: lineas,
      totales,
      retenciones,
      referencia: ref ? { id: txt(hijo(ref, 'ID')), cufe: txt(hijo(ref, 'UUID')).toLowerCase(), fecha: txt(hijo(ref, 'IssueDate')) } : null,
      concepto: discrepancia ? txt(hijo(discrepancia, 'ResponseCode')) : '',
      descripcionConcepto: discrepancia ? txt(hijo(discrepancia, 'Description')) : '',
      validacionDian: validacion,
      avisos,
    };
  }

  return { leer, TIPO_DOC };
});
