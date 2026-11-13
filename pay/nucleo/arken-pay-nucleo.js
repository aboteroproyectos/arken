/* ARKEN PAY · núcleo
 *
 * Reglas de negocio, tributarias y de cartera, sin pantalla ni almacenamiento. Lo usan el programa
 * (navegador / app de escritorio) y las pruebas de Node, la misma copia del código.
 *
 * Principios:
 *  · El dinero se maneja en CENTAVOS ENTEROS (Number seguro hasta 90 billones de pesos). Nunca
 *    coma flotante para montos.
 *  · Las tarifas se manejan en PARTES POR MILLÓN (ppm): 19 % = 190000; 9,66 ‰ = 9660.
 *  · Todo cambio es un EVENTO que se agrega a una bitácora encadenada (hash SHA-256). Nada se borra
 *    ni se edita: una factura se ajusta con notas, un recaudo errado se reversa.
 *  · El estado (facturas, saldos, cartera) se reconstruye aplicando los eventos en orden. Cada
 *    evento se valida contra el estado antes de aceptarse.
 */
(function (raiz, fabrica) {
  const N = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = N;
  else raiz.ArkenPayNucleo = N;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION_ESQUEMA = 1;

  /* ═══════════════  Errores  ═══════════════ */
  class ErrorNegocio extends Error {
    constructor(mensaje, codigo) {
      super(mensaje);
      this.name = 'ErrorNegocio';
      this.codigo = codigo || 'regla';
    }
  }
  const exigir = (cond, mensaje, codigo) => {
    if (!cond) throw new ErrorNegocio(mensaje, codigo);
  };

  /* ═══════════════  Dinero y tarifas  ═══════════════ */
  const MILLON = 1000000n;

  /** Redondeo «mitad hacia arriba» (en valor absoluto) de numerador/denominador, ambos BigInt. */
  function dividirRedondeando(num, den) {
    if (den < 0n) {
      num = -num;
      den = -den;
    }
    const neg = num < 0n;
    const a = neg ? -num : num;
    const q = a / den;
    const r = a % den;
    const res = r * 2n >= den ? q + 1n : q;
    return neg ? -res : res;
  }

  /** Aplica una tarifa en ppm a un valor en centavos, con redondeo mitad hacia arriba al centavo. */
  function aplicarTarifa(centavos, ppm) {
    exigir(Number.isSafeInteger(centavos), 'Valor en centavos inválido.');
    exigir(Number.isSafeInteger(ppm) && ppm >= 0, 'Tarifa inválida.');
    return Number(dividirRedondeando(BigInt(centavos) * BigInt(ppm), MILLON));
  }

  /** Redondea centavos al peso entero (mitad hacia arriba). La DIAN acepta retenciones en pesos. */
  function redondearAPeso(centavos) {
    return Number(dividirRedondeando(BigInt(centavos), 100n)) * 100;
  }

  /**
   * Convierte un texto o número en centavos. Acepta formato colombiano («$ 1.234.567,89»),
   * formato con punto decimal («1234567.89») y números. Nunca pasa por coma flotante.
   */
  function aCentavos(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') {
      exigir(Number.isFinite(valor), 'Valor no numérico.');
      return aCentavos(valor.toFixed(2));
    }
    let s = String(valor).trim().replace(/\s|\$|COP/gi, '');
    let neg = false;
    if (s.startsWith('(') && s.endsWith(')')) {
      neg = true;
      s = s.slice(1, -1);
    }
    if (s.startsWith('-')) {
      neg = !neg;
      s = s.slice(1);
    }
    exigir(/^[\d.,]+$/.test(s), `«${valor}» no es un valor válido.`, 'formato');
    const ultimaComa = s.lastIndexOf(',');
    const ultimoPunto = s.lastIndexOf('.');
    let entero, dec;
    if (ultimaComa >= 0 && ultimaComa > ultimoPunto) {
      // coma decimal (formato colombiano)
      entero = s.slice(0, ultimaComa).replace(/\./g, '');
      dec = s.slice(ultimaComa + 1);
    } else if (ultimoPunto >= 0) {
      const partes = s.split('.');
      // «1.234.567» o «1.234» (miles con punto, formato colombiano) vs «1234.56» (punto decimal).
      // Un solo punto seguido de exactamente 3 cifras se lee como separador de miles.
      if (partes.length > 2 || (partes.length === 2 && partes[1].length === 3 && ultimaComa < 0)) {
        entero = s.replace(/\./g, '').replace(/,/g, '');
        dec = '';
      } else {
        entero = s.slice(0, ultimoPunto).replace(/,/g, '');
        dec = s.slice(ultimoPunto + 1);
      }
    } else {
      entero = s;
      dec = '';
    }
    exigir(/^\d*$/.test(entero) && /^\d*$/.test(dec), `«${valor}» no es un valor válido.`, 'formato');
    let cent = BigInt(entero || '0') * 100n;
    if (dec.length) {
      const d3 = (dec + '000').slice(0, 3);
      cent += dividirRedondeando(BigInt(d3), 10n);
    }
    const n = Number(neg ? -cent : cent);
    exigir(Number.isSafeInteger(n), 'Valor demasiado grande.');
    return n;
  }

  /** Decimal con punto, como viene en el XML UBL de la DIAN («1234567.89»). Estricto. */
  function aCentavosXml(valor) {
    const s = String(valor ?? '').trim();
    exigir(/^-?\d+(\.\d+)?$/.test(s), `Valor del XML inválido: «${valor}».`, 'formato');
    const neg = s.startsWith('-');
    const [e, d = ''] = s.replace('-', '').split('.');
    let cent = BigInt(e) * 100n + dividirRedondeando(BigInt((d + '000').slice(0, 3)), 10n);
    return Number(neg ? -cent : cent);
  }

  /** Porcentaje en texto o número («19», «0,966», «9.66 por mil»…) → ppm. */
  function aPpm(valor, unidad) {
    if (valor === null || valor === undefined || valor === '') return 0;
    const porMil = unidad === 'pormil' || /por\s*mil|‰/i.test(String(valor));
    const s = String(valor).replace(/por\s*mil|‰|%/gi, '').trim().replace(',', '.');
    exigir(/^\d+(\.\d+)?$/.test(s), `«${valor}» no es una tarifa válida.`, 'formato');
    const [e, d = ''] = s.split('.');
    // ppm = valor% × 10000  |  valor‰ × 1000
    const escala = porMil ? 3 : 4;
    const dd = (d + '0000000').slice(0, escala);
    const resto = d.slice(escala);
    exigir(!/[1-9]/.test(resto), `La tarifa «${valor}» tiene más decimales de los admitidos.`, 'formato');
    return Number(BigInt(e) * (porMil ? 1000n : 10000n) + BigInt(dd || '0'));
  }

  function formatoPesos(centavos, conDecimales) {
    const neg = centavos < 0;
    const a = Math.abs(centavos);
    const entero = Math.floor(a / 100);
    const dec = String(a % 100).padStart(2, '0');
    const miles = String(entero).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const mostrarDec = conDecimales === true || (conDecimales !== false && dec !== '00');
    return (neg ? '-' : '') + '$ ' + miles + (mostrarDec ? ',' + dec : '');
  }

  function formatoTarifa(ppm) {
    const s = (ppm / 10000).toFixed(4).replace(/\.?0+$/, '');
    return s.replace('.', ',') + ' %';
  }

  /* ═══════════════  Identificación tributaria  ═══════════════ */
  const PESOS_DV = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71];

  /** Dígito de verificación DIAN (Orden Administrativa 4 de 1989 / art. 555-1 E.T.). */
  function digitoVerificacion(nit) {
    const s = String(nit).replace(/\D/g, '');
    exigir(s.length > 0 && s.length <= 15, 'NIT inválido.');
    let suma = 0;
    for (let i = 0; i < s.length; i++) suma += Number(s[s.length - 1 - i]) * PESOS_DV[i];
    const r = suma % 11;
    return r > 1 ? 11 - r : r;
  }

  function limpiarNit(nit) {
    return String(nit || '').replace(/[^\d]/g, '');
  }

  /* ═══════════════  Fechas (ISO AAAA-MM-DD, hora de Colombia)  ═══════════════ */
  const reFecha = /^\d{4}-\d{2}-\d{2}$/;
  function esFecha(f) {
    if (!reFecha.test(String(f))) return false;
    const d = new Date(f + 'T00:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
  }
  function diasEntre(desde, hasta) {
    return Math.round((Date.parse(hasta + 'T00:00:00Z') - Date.parse(desde + 'T00:00:00Z')) / 86400000);
  }
  function sumarDias(fecha, dias) {
    return new Date(Date.parse(fecha + 'T00:00:00Z') + dias * 86400000).toISOString().slice(0, 10);
  }
  /** Fecha de hoy en Colombia (UTC−5, sin horario de verano). */
  function hoyColombia(ahora) {
    const t = (ahora instanceof Date ? ahora.getTime() : ahora || Date.now()) - 5 * 3600000;
    return new Date(t).toISOString().slice(0, 10);
  }
  const periodoDe = (fecha) => String(fecha).slice(0, 7);

  /* ═══════════════  Roles y permisos  ═══════════════ */
  const ROLES = {
    administrador: 'Administrador',
    facturacion: 'Facturación',
    tesoreria: 'Tesorería',
    aprobador: 'Aprobador (contador o gerente)',
    consulta: 'Consulta',
  };

  // Qué rol puede emitir cada tipo de evento. El administrador puede todo lo de configuración, pero
  // no registra ni aprueba movimientos: quien configura no mueve plata.
  const PERMISOS = {
    'sistema.iniciado': ['*'],
    'sistema.recuperacion_definida': ['administrador'],
    'usuario.clave_recuperada': ['*'],
    'usuario.creado': ['administrador'],
    'usuario.actualizado': ['administrador'],
    'usuario.clave_cambiada': ['*'],
    'empresa.registrada': ['administrador'],
    'empresa.actualizada': ['administrador'],
    'resolucion.registrada': ['administrador', 'facturacion'],
    'parametro.registrado': ['administrador', 'aprobador'],
    'cliente.registrado': ['administrador', 'facturacion', 'tesoreria'],
    'cliente.actualizado': ['administrador', 'facturacion', 'tesoreria'],
    'proyecto.registrado': ['administrador', 'facturacion'],
    'proyecto.actualizado': ['administrador', 'facturacion'],
    'factura.registrada': ['facturacion'],
    'factura.reclasificada': ['aprobador'],
    'factura.evento_radian': ['facturacion', 'tesoreria'],
    'nota.registrada': ['facturacion'],
    'recaudo.registrado': ['tesoreria'],
    'recaudo.reversado': ['aprobador'],
    'saldo_favor.aplicado': ['tesoreria'],
    'retencion.certificada': ['tesoreria', 'facturacion'],
    'banco.movimientos_importados': ['tesoreria'],
    'banco.conciliado': ['tesoreria'],
    'periodo.cerrado': ['aprobador'],
    'periodo.reabierto': ['aprobador'],
  };

  function puede(usuario, tipo) {
    const roles = PERMISOS[tipo];
    if (!roles) return false;
    if (roles.includes('*')) return true;
    return !!usuario && usuario.activo !== false && (usuario.roles || []).some((r) => roles.includes(r));
  }

  /* ═══════════════  Parámetros tributarios de partida  ═══════════════
   * Valores de referencia para iniciar. El contador debe revisarlos: todo es editable con
   * vigencia, y un valor nuevo nunca reescribe el anterior.
   * Fuentes: Resolución DIAN 000238 de 15-12-2025 (UVT 2026); Resolución DIAN 000193 de 2024
   * (UVT 2025); Decreto 572 de 2025 (bases de 2 UVT para servicios y 10 UVT para compras y
   * construcción); DUR 1625 de 2016; art. 437-1 E.T. (ReteIVA 15 %).
   */
  const PARAMETROS_INICIALES = {
    uvt: [
      { anio: 2025, valor: 4979900, fuente: 'Resolución DIAN 000193 de 2024' },
      { anio: 2026, valor: 5237400, fuente: 'Resolución DIAN 000238 de 15-12-2025' },
    ],
    conceptosRetencion: [
      { codigo: 'SERV-D', nombre: 'Servicios en general (declarante)', ppm: 40000, baseUvt: 2, fuente: 'Art. 1.2.4.4.14 DUR 1625/2016, mod. Decreto 572/2025' },
      { codigo: 'SERV-ND', nombre: 'Servicios en general (no declarante)', ppm: 60000, baseUvt: 2, fuente: 'Art. 1.2.4.4.1 DUR 1625/2016, mod. Decreto 572/2025' },
      { codigo: 'HON-PJ', nombre: 'Honorarios y comisiones (persona jurídica)', ppm: 110000, baseUvt: 0, fuente: 'Art. 392 E.T.; art. 1.2.4.3.1 DUR 1625/2016' },
      { codigo: 'CONS-ING', nombre: 'Consultoría en ingeniería de infraestructura y edificaciones (declarante)', ppm: 60000, baseUvt: 0, fuente: 'Art. 1.2.4.10.3 DUR 1625/2016' },
      { codigo: 'CONSTR', nombre: 'Contratos de construcción y urbanización', ppm: 20000, baseUvt: 10, fuente: 'Art. 1.2.4.9.1 DUR 1625/2016, mod. Decreto 572/2025' },
      { codigo: 'COMP-D', nombre: 'Compras generales (declarante)', ppm: 25000, baseUvt: 10, fuente: 'Art. 1.2.4.9.1 DUR 1625/2016, mod. Decreto 572/2025' },
      { codigo: 'ARR-MUE', nombre: 'Arrendamiento de bienes muebles', ppm: 40000, baseUvt: 0, fuente: 'Art. 1.2.4.4.10 DUR 1625/2016' },
      { codigo: 'ARR-INM', nombre: 'Arrendamiento de bienes inmuebles', ppm: 35000, baseUvt: 10, fuente: 'Art. 1.2.4.10.6 DUR 1625/2016' },
    ],
    reteIva: { ppm: 150000, baseUvtServicios: 2, baseUvtBienes: 10, fuente: 'Art. 437-1 E.T.; art. 1.3.2.1.12 DUR 1625/2016' },
  };

  /* ═══════════════  Cálculo de facturas  ═══════════════ */
  /**
   * Calcula los totales de una factura a partir de sus ítems.
   * Ítem: { descripcion, cantidadMil (cantidad × 1000), valorUnitario (centavos), descuento (centavos),
   *         ivaPpm, ivaTipo ('gravado'|'exento'|'excluido'), baseIva? (centavos, para AIU u otra base especial) }
   * Cada impuesto se calcula por ítem y los totales se suman de los ítems, como en el XML UBL.
   */
  function calcularFactura(items) {
    exigir(Array.isArray(items) && items.length > 0, 'La factura debe tener al menos un ítem.');
    let subtotal = 0,
      descuentos = 0,
      baseGravada = 0,
      iva = 0;
    const lineas = items.map((it, i) => {
      const cantidadMil = it.cantidadMil ?? 1000;
      exigir(Number.isSafeInteger(cantidadMil) && cantidadMil > 0, `Ítem ${i + 1}: cantidad inválida.`);
      exigir(Number.isSafeInteger(it.valorUnitario) && it.valorUnitario >= 0, `Ítem ${i + 1}: valor unitario inválido.`);
      const bruto = Number(dividirRedondeando(BigInt(cantidadMil) * BigInt(it.valorUnitario), 1000n));
      const desc = it.descuento || 0;
      exigir(desc >= 0 && desc <= bruto, `Ítem ${i + 1}: el descuento supera el valor.`);
      const neto = bruto - desc;
      const ivaTipo = it.ivaTipo || (it.ivaPpm > 0 ? 'gravado' : 'excluido');
      const ivaPpm = ivaTipo === 'gravado' ? it.ivaPpm || 0 : 0;
      let baseIva = ivaTipo === 'gravado' ? (it.baseIva ?? neto) : 0;
      exigir(baseIva >= 0 && baseIva <= neto, `Ítem ${i + 1}: la base del IVA no puede superar el valor del ítem.`);
      const ivaLinea = aplicarTarifa(baseIva, ivaPpm);
      subtotal += bruto;
      descuentos += desc;
      baseGravada += baseIva;
      iva += ivaLinea;
      return { ...it, cantidadMil, ivaTipo, ivaPpm, bruto, neto, baseIva, iva: ivaLinea };
    });
    const baseAntesIva = subtotal - descuentos;
    return { lineas, subtotal, descuentos, baseAntesIva, baseGravada, iva, total: baseAntesIva + iva };
  }

  /** Valor de la UVT vigente para la fecha, desde los parámetros del estado. */
  function uvtPara(estado, fecha) {
    const anio = Number(String(fecha).slice(0, 4));
    const fila = estado.parametros.uvt.find((u) => u.anio === anio);
    return fila ? fila.valor : null;
  }

  /**
   * Sugiere las retenciones que el cliente practicará sobre la factura. Es una estimación: las
   * definitivas son las que el cliente aplica al pagar y certifica.
   */
  function sugerirRetenciones(estado, { clienteId, fecha, baseAntesIva, iva, conceptoRetencion, icaPpm, esServicio = true }) {
    const cliente = estado.clientes[clienteId];
    exigir(cliente, 'Cliente no encontrado.');
    const avisos = [];
    const res = [];
    const uvt = uvtPara(estado, fecha);
    if (!uvt) avisos.push(`No hay UVT registrada para ${String(fecha).slice(0, 4)}: no se verifican las bases mínimas.`);
    if (cliente.retieneRenta && conceptoRetencion) {
      const c = estado.parametros.conceptosRetencion.find((x) => x.codigo === conceptoRetencion);
      if (!c) avisos.push(`Concepto de retención ${conceptoRetencion} no existe.`);
      else {
        const base = c.baseUvt * (uvt || 0);
        if (baseAntesIva >= base) res.push({ tipo: 'renta', concepto: c.codigo, base: baseAntesIva, ppm: c.ppm, valor: redondearAPeso(aplicarTarifa(baseAntesIva, c.ppm)) });
        else avisos.push(`La base (${formatoPesos(baseAntesIva)}) no alcanza el mínimo de ${c.baseUvt} UVT para ${c.nombre}.`);
      }
    }
    if (cliente.retieneIva && iva > 0) {
      const r = estado.parametros.reteIva;
      const base = (esServicio ? r.baseUvtServicios : r.baseUvtBienes) * (uvt || 0);
      if (baseAntesIva >= base) res.push({ tipo: 'iva', concepto: 'RETEIVA', base: iva, ppm: r.ppm, valor: redondearAPeso(aplicarTarifa(iva, r.ppm)) });
    }
    if (cliente.retieneIca && icaPpm > 0) {
      res.push({ tipo: 'ica', concepto: 'RETEICA', base: baseAntesIva, ppm: icaPpm, valor: redondearAPeso(aplicarTarifa(baseAntesIva, icaPpm)) });
    }
    return { retenciones: res, avisos };
  }

  /* ═══════════════  Estado y eventos  ═══════════════ */
  function crearEstado() {
    return {
      version: VERSION_ESQUEMA,
      seq: 0,
      ultimoHash: '',
      iniciado: false,
      recuperacion: null,
      usuarios: {},
      empresas: {},
      resoluciones: {},
      clientes: {},
      proyectos: {},
      facturas: {},
      notas: {},
      recaudos: {},
      movimientosBanco: {},
      periodosCerrados: {},
      parametros: JSON.parse(JSON.stringify(PARAMETROS_INICIALES)),
      // índices
      idx: { cufe: {}, numero: {}, notaNumero: {}, cude: {}, docCliente: {}, codigoProyecto: {}, correo: {}, refBanco: {} },
      saldosFavor: {}, // clienteId → { total, porProyecto: {proyectoId|'': centavos} }
      bitacora: [], // resumen legible de cada evento
    };
  }

  const ordenar = (x) => {
    if (Array.isArray(x)) return x.map(ordenar);
    if (x && typeof x === 'object') {
      const o = {};
      for (const k of Object.keys(x).sort()) if (x[k] !== undefined) o[k] = ordenar(x[k]);
      return o;
    }
    return x;
  };
  /** Serialización canónica de un evento para el hash encadenado. */
  function canonico(ev) {
    return JSON.stringify(ordenar({ seq: ev.seq, id: ev.id, tipo: ev.tipo, fecha: ev.fecha, usuario: ev.usuario, datos: ev.datos, hashPrevio: ev.hashPrevio || '' }));
  }
  async function sha256Hex(texto) {
    const datos = new TextEncoder().encode(texto);
    const h = await globalThis.crypto.subtle.digest('SHA-256', datos);
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  async function hashEvento(ev) {
    return sha256Hex(canonico(ev));
  }
  /** Arma el siguiente evento de la cadena: número, enlace con el anterior y su hash. */
  async function sellarEvento(estado, { tipo, datos, usuario, fecha, id }) {
    const ev = { seq: estado.seq + 1, id: id || nuevoId('ev'), tipo, fecha: fecha || new Date().toISOString(), usuario: usuario || '', datos: JSON.parse(JSON.stringify(datos || {})), hashPrevio: estado.ultimoHash || '' };
    ev.hash = await hashEvento(ev);
    return ev;
  }

  /** Verifica que la cadena de eventos esté completa y sin alteraciones. */
  async function verificarCadena(eventos) {
    let previo = '';
    for (let i = 0; i < eventos.length; i++) {
      const ev = eventos[i];
      if (ev.seq !== i + 1) return { ok: false, en: ev.seq, motivo: `Falta el evento ${i + 1} o está fuera de orden.` };
      if ((ev.hashPrevio || '') !== previo) return { ok: false, en: ev.seq, motivo: `El evento ${ev.seq} no enlaza con el anterior.` };
      const h = await hashEvento(ev);
      if (h !== ev.hash) return { ok: false, en: ev.seq, motivo: `El evento ${ev.seq} fue alterado.` };
      previo = ev.hash;
    }
    return { ok: true, eventos: eventos.length, ultimoHash: previo };
  }

  /* --- contraseñas: PBKDF2-SHA256 --- */
  const ITERACIONES = 210000;
  const aHex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
  const deHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
  async function derivarClave(clave, salHex, iteraciones = ITERACIONES) {
    const sal = salHex ? deHex(salHex) : globalThis.crypto.getRandomValues(new Uint8Array(16));
    const llave = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(clave), 'PBKDF2', false, ['deriveBits']);
    const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: iteraciones }, llave, 256);
    return `pbkdf2$${iteraciones}$${aHex(sal)}$${aHex(bits)}`;
  }
  async function verificarClave(clave, guardada) {
    const [alg, it, sal, h] = String(guardada || '').split('$');
    if (alg !== 'pbkdf2') return false;
    const d = await derivarClave(clave, sal, Number(it));
    const otro = d.split('$')[3];
    let dif = 0;
    for (let i = 0; i < h.length; i++) dif |= h.charCodeAt(i) ^ otro.charCodeAt(i);
    return dif === 0 && h.length === otro.length;
  }
  /** Código de recuperación: 25 caracteres (unos 120 bits) en grupos de 5, sin letras confusas. */
  const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  function generarCodigoRecuperacion() {
    let c = '';
    while (c.length < 25) {
      for (const x of globalThis.crypto.getRandomValues(new Uint8Array(32))) {
        if (x < 248 && c.length < 25) c += ALFABETO_CODIGO[x % 31]; // 248 = 8 × 31: sin sesgo
      }
    }
    return c.match(/.{5}/g).join('-');
  }
  const normalizarCodigo = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function validarClaveNueva(clave) {
    const s = String(clave || '');
    exigir(s.length >= 10, 'La contraseña debe tener al menos 10 caracteres.');
    exigir(/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(s) && /\d/.test(s), 'La contraseña debe combinar letras y números.');
  }

  function nuevoId(prefijo) {
    const b = globalThis.crypto.getRandomValues(new Uint8Array(9));
    return (prefijo ? prefijo + '_' : '') + aHex(b);
  }

  /* --- utilidades de validación --- */
  const texto = (v, nombre, max = 300) => {
    const s = String(v ?? '').trim();
    exigir(s.length > 0, `${nombre} es obligatorio.`, 'falta');
    exigir(s.length <= max, `${nombre} es demasiado largo.`);
    return s;
  };
  const opcional = (v, max = 500) => {
    const s = String(v ?? '').trim();
    exigir(s.length <= max, 'Texto demasiado largo.');
    return s;
  };
  const centavos = (v, nombre, { min = 0, permitirCero = true } = {}) => {
    exigir(Number.isSafeInteger(v), `${nombre}: valor inválido.`);
    exigir(v >= min && (permitirCero || v !== 0), `${nombre}: valor fuera de rango.`);
    return v;
  };
  const fecha = (v, nombre) => {
    exigir(esFecha(v), `${nombre}: fecha inválida (use AAAA-MM-DD).`);
    return v;
  };
  const ppm = (v, nombre) => {
    exigir(Number.isSafeInteger(v) && v >= 0 && v <= MILLON_N, `${nombre}: tarifa inválida.`);
    return v;
  };
  const MILLON_N = 1000000;

  function exigirPeriodoAbierto(e, f) {
    exigir(!e.periodosCerrados[periodoDe(f)], `El período ${periodoDe(f)} está cerrado. Pida a un aprobador que lo reabra.`, 'periodo');
  }

  /* --- saldos --- */
  function totalesFactura(f) {
    const nc = f.notasCredito.reduce((s, n) => s + n.valor, 0);
    const nd = f.notasDebito.reduce((s, n) => s + n.valor, 0);
    const aplicado = f.aplicaciones.filter((a) => !a.reversado).reduce((s, a) => s + a.valor, 0);
    const retenido = f.retenciones.filter((r) => !r.reversado).reduce((s, r) => s + r.valor, 0);
    const favor = f.saldoFavorAplicado.reduce((s, a) => s + a.valor, 0);
    const saldo = f.total + nd - nc - aplicado - retenido - favor;
    const garantiaPendiente = Math.max(0, Math.min(f.retencionGarantia || 0, saldo));
    return { notasCredito: nc, notasDebito: nd, recaudado: aplicado, retenido, saldoFavorAplicado: favor, saldo, garantiaPendiente, saldoExigible: saldo - garantiaPendiente };
  }

  function estadoFactura(f, hoy) {
    const t = totalesFactura(f);
    if (f.anulada) return 'anulada';
    if (t.saldo === 0) return 'pagada';
    if (t.saldo < 0) return 'saldo_a_favor';
    if (f.radian.reclamo && !f.radian.aceptada) return 'en_reclamo';
    if (t.saldoExigible <= 0 && t.garantiaPendiente > 0) return 'garantia';
    const vencida = hoy && t.saldoExigible > 0 && f.fechaVencimiento < hoy;
    if (vencida) return 'vencida';
    if (t.recaudado + t.retenido + t.saldoFavorAplicado > 0) return 'con_abonos';
    if (f.radian.aceptada) return 'aceptada';
    return 'registrada';
  }
  const NOMBRE_ESTADO = {
    registrada: 'Registrada',
    aceptada: 'Aceptada',
    con_abonos: 'Con abonos',
    garantia: 'Solo garantía pendiente',
    pagada: 'Pagada',
    vencida: 'Vencida',
    en_reclamo: 'En reclamo',
    anulada: 'Anulada',
    saldo_a_favor: 'Pagada de más',
  };

  function sumarSaldoFavor(e, clienteId, proyectoId, valor) {
    const s = (e.saldosFavor[clienteId] = e.saldosFavor[clienteId] || { total: 0, porProyecto: {} });
    const k = proyectoId || '';
    s.porProyecto[k] = (s.porProyecto[k] || 0) + valor;
    s.total += valor;
    exigir(s.porProyecto[k] >= 0 && s.total >= 0, 'El saldo a favor del cliente no alcanza.');
  }

  /* ═══════════════  Aplicación de eventos  ═══════════════
   * aplicar(estado, evento) valida y muta el estado. Si la regla no se cumple, lanza ErrorNegocio y
   * el estado queda igual: la validación completa ocurre antes de cualquier cambio.
   */
  const MANEJADORES = {
    'sistema.iniciado'(e, ev) {
      exigir(!e.iniciado && ev.seq === 1, 'El sistema ya fue iniciado.');
      return () => {
        e.iniciado = true;
        e.nombreInstalacion = opcional(ev.datos.nombre, 120);
        if (ev.datos.recuperacionHash) e.recuperacion = { hash: ev.datos.recuperacionHash, fecha: ev.fecha };
        return 'Se inició ARKEN PAY.';
      };
    },

    // Código de recuperación del administrador: se guarda solo su huella PBKDF2. Definirlo de nuevo
    // invalida el anterior.
    'sistema.recuperacion_definida'(e, ev) {
      exigir(/^pbkdf2\$/.test(ev.datos.recuperacionHash || ''), 'Código de recuperación inválido.');
      return () => {
        e.recuperacion = { hash: ev.datos.recuperacionHash, fecha: ev.fecha, por: ev.usuario };
        return 'Se definió un código de recuperación nuevo; el anterior dejó de servir.';
      };
    },

    // Un administrador que olvidó su contraseña la restablece con el código de recuperación. El
    // programa verifica el código antes de emitir el evento; el código usado se reemplaza por uno nuevo.
    'usuario.clave_recuperada'(e, ev) {
      const d = ev.datos;
      exigir(e.recuperacion, 'Esta instalación no tiene código de recuperación.');
      const u = e.usuarios[d.id];
      exigir(u && u.activo && u.roles.includes('administrador'), 'Solo un administrador activo recupera su contraseña con el código; los demás usuarios se la piden al administrador.');
      exigir(/^pbkdf2\$/.test(d.claveHash || ''), 'Contraseña inválida.');
      exigir(/^pbkdf2\$/.test(d.recuperacionHash || '') && d.recuperacionHash !== e.recuperacion.hash, 'Falta el código de recuperación nuevo.');
      return () => {
        u.claveHash = d.claveHash;
        u.debeCambiarClave = false;
        e.recuperacion = { hash: d.recuperacionHash, fecha: ev.fecha, por: u.id };
        return `Usuario ${u.usuario} restableció su contraseña con el código de recuperación (se generó un código nuevo).`;
      };
    },

    'usuario.creado'(e, ev) {
      const d = ev.datos;
      const id = texto(d.id, 'Identificador');
      exigir(!e.usuarios[id], 'El usuario ya existe.');
      const usuario = texto(d.usuario, 'Usuario', 60).toLowerCase();
      exigir(/^[a-z0-9._-]{3,60}$/.test(usuario), 'El usuario solo admite letras, números, punto, guion y guion bajo (mínimo 3).');
      exigir(!Object.values(e.usuarios).some((u) => u.usuario === usuario), 'Ese nombre de usuario ya está en uso.');
      const roles = Array.isArray(d.roles) ? d.roles : [];
      exigir(roles.length > 0 && roles.every((r) => ROLES[r]), 'Roles inválidos.');
      exigir(/^pbkdf2\$/.test(d.claveHash || ''), 'Falta la contraseña.');
      // El primer usuario (creado al iniciar) debe ser administrador.
      const primero = Object.keys(e.usuarios).length === 0;
      if (primero) exigir(roles.includes('administrador'), 'El primer usuario debe ser administrador.');
      return () => {
        e.usuarios[id] = { id, usuario, nombre: texto(d.nombre, 'Nombre', 120), correo: opcional(d.correo, 120), roles, claveHash: d.claveHash, activo: true, debeCambiarClave: !!d.debeCambiarClave, creado: ev.fecha };
        return `Usuario ${usuario} creado (${roles.map((r) => ROLES[r]).join(', ')}).`;
      };
    },

    'usuario.actualizado'(e, ev) {
      const d = ev.datos;
      const u = e.usuarios[d.id];
      exigir(u, 'Usuario no encontrado.');
      if (d.roles) exigir(d.roles.length && d.roles.every((r) => ROLES[r]), 'Roles inválidos.');
      if (d.id === ev.usuario) exigir(d.activo !== false && (!d.roles || d.roles.includes('administrador')), 'No puede desactivarse ni quitarse el rol de administrador a sí mismo.');
      return () => {
        const antes = { roles: u.roles, activo: u.activo, nombre: u.nombre };
        if (d.roles) u.roles = d.roles;
        if (typeof d.activo === 'boolean') u.activo = d.activo;
        if (d.nombre) u.nombre = texto(d.nombre, 'Nombre', 120);
        if (d.correo !== undefined) u.correo = opcional(d.correo, 120);
        if (d.claveHash) {
          u.claveHash = d.claveHash;
          u.debeCambiarClave = true;
        }
        return `Usuario ${u.usuario} actualizado. Antes: ${JSON.stringify(antes)}.`;
      };
    },

    'usuario.clave_cambiada'(e, ev) {
      const u = e.usuarios[ev.usuario];
      exigir(u && ev.datos.id === ev.usuario, 'Cada usuario cambia solo su propia contraseña.');
      exigir(/^pbkdf2\$/.test(ev.datos.claveHash || ''), 'Contraseña inválida.');
      return () => {
        u.claveHash = ev.datos.claveHash;
        u.debeCambiarClave = false;
        return `Usuario ${u.usuario} cambió su contraseña.`;
      };
    },

    'empresa.registrada'(e, ev) {
      const d = ev.datos;
      const id = texto(d.id, 'Identificador');
      exigir(!e.empresas[id], 'La empresa ya existe.');
      const nit = limpiarNit(d.nit);
      exigir(nit.length >= 5, 'NIT inválido.');
      exigir(Number(d.dv) === digitoVerificacion(nit), `El dígito de verificación del NIT ${nit} es ${digitoVerificacion(nit)}.`);
      exigir(!Object.values(e.empresas).some((x) => x.nit === nit), 'Ya hay una empresa con ese NIT.');
      return () => {
        e.empresas[id] = {
          id,
          nit,
          dv: digitoVerificacion(nit),
          razonSocial: texto(d.razonSocial, 'Razón social', 200),
          regimen: opcional(d.regimen, 60),
          responsabilidades: opcional(d.responsabilidades, 200),
          ciiu: opcional(d.ciiu, 20),
          municipio: opcional(d.municipio, 80) || 'Bogotá D.C.',
          icaPpm: d.icaPpm ? ppm(d.icaPpm, 'Tarifa ICA') : 0,
          conceptoRetencion: opcional(d.conceptoRetencion, 20),
          declarante: d.declarante !== false,
          activa: true,
        };
        return `Empresa ${e.empresas[id].razonSocial} (NIT ${nit}-${e.empresas[id].dv}) registrada.`;
      };
    },

    'empresa.actualizada'(e, ev) {
      const d = ev.datos;
      const x = e.empresas[d.id];
      exigir(x, 'Empresa no encontrada.');
      if (d.icaPpm !== undefined) ppm(d.icaPpm, 'Tarifa ICA');
      return () => {
        for (const k of ['razonSocial', 'regimen', 'responsabilidades', 'ciiu', 'municipio', 'conceptoRetencion']) if (d[k] !== undefined) x[k] = opcional(d[k], 200);
        if (d.icaPpm !== undefined) x.icaPpm = d.icaPpm;
        if (typeof d.declarante === 'boolean') x.declarante = d.declarante;
        if (typeof d.activa === 'boolean') x.activa = d.activa;
        return `Empresa ${x.razonSocial} actualizada.`;
      };
    },

    'resolucion.registrada'(e, ev) {
      const d = ev.datos;
      const id = texto(d.id, 'Identificador');
      exigir(!e.resoluciones[id], 'La resolución ya existe.');
      exigir(e.empresas[d.empresaId], 'Empresa no encontrada.');
      const desde = Number(d.desde),
        hasta = Number(d.hasta);
      exigir(Number.isSafeInteger(desde) && Number.isSafeInteger(hasta) && desde > 0 && hasta >= desde, 'Rango de numeración inválido.');
      fecha(d.fecha, 'Fecha de la resolución');
      fecha(d.vigenciaDesde, 'Vigencia desde');
      fecha(d.vigenciaHasta, 'Vigencia hasta');
      exigir(d.vigenciaHasta >= d.vigenciaDesde, 'La vigencia termina antes de empezar.');
      const prefijo = opcional(d.prefijo, 4).toUpperCase();
      exigir(/^[A-Z0-9]{0,4}$/.test(prefijo), 'El prefijo admite hasta 4 letras o números.');
      const solapa = Object.values(e.resoluciones).some((r) => r.empresaId === d.empresaId && r.prefijo === prefijo && !(hasta < r.desde || desde > r.hasta));
      exigir(!solapa, 'El rango se cruza con otra resolución del mismo prefijo.');
      return () => {
        e.resoluciones[id] = { id, empresaId: d.empresaId, numero: texto(d.numero, 'Número de resolución', 40), fecha: d.fecha, prefijo, desde, hasta, vigenciaDesde: d.vigenciaDesde, vigenciaHasta: d.vigenciaHasta, tipo: d.tipo || 'autorizacion' };
        return `Resolución ${d.numero}: prefijo ${prefijo || '(sin prefijo)'} del ${desde} al ${hasta}.`;
      };
    },

    'parametro.registrado'(e, ev) {
      const d = ev.datos;
      exigir(['uvt', 'conceptoRetencion', 'reteIva'].includes(d.clase), 'Parámetro desconocido.');
      if (d.clase === 'uvt') {
        exigir(Number.isSafeInteger(d.anio) && d.anio >= 2000 && d.anio <= 2100, 'Año inválido.');
        centavos(d.valor, 'Valor UVT', { min: 1 });
      }
      if (d.clase === 'conceptoRetencion') {
        texto(d.codigo, 'Código', 20);
        texto(d.nombre, 'Nombre', 200);
        ppm(d.ppm, 'Tarifa');
        exigir(Number(d.baseUvt) >= 0, 'Base en UVT inválida.');
      }
      if (d.clase === 'reteIva') ppm(d.ppm, 'Tarifa ReteIVA');
      return () => {
        const p = e.parametros;
        if (d.clase === 'uvt') {
          const i = p.uvt.findIndex((u) => u.anio === d.anio);
          const fila = { anio: d.anio, valor: d.valor, fuente: opcional(d.fuente) };
          if (i >= 0) p.uvt[i] = fila;
          else p.uvt.push(fila);
          p.uvt.sort((a, b) => a.anio - b.anio);
          return `UVT ${d.anio}: ${formatoPesos(d.valor)}.`;
        }
        if (d.clase === 'conceptoRetencion') {
          const i = p.conceptosRetencion.findIndex((c) => c.codigo === d.codigo);
          const fila = { codigo: d.codigo, nombre: d.nombre, ppm: d.ppm, baseUvt: Number(d.baseUvt), fuente: opcional(d.fuente) };
          if (i >= 0) p.conceptosRetencion[i] = fila;
          else p.conceptosRetencion.push(fila);
          return `Concepto de retención ${d.codigo}: ${formatoTarifa(d.ppm)} desde ${d.baseUvt} UVT.`;
        }
        p.reteIva = { ...p.reteIva, ppm: d.ppm, fuente: opcional(d.fuente) };
        return `ReteIVA: ${formatoTarifa(d.ppm)}.`;
      };
    },

    'cliente.registrado'(e, ev) {
      const d = ev.datos;
      const id = texto(d.id, 'Identificador');
      exigir(!e.clientes[id], 'El cliente ya existe.');
      const tipoDoc = d.tipoDocumento || 'NIT';
      exigir(['NIT', 'CC', 'CE', 'PAS', 'NIT_EXT', 'TI', 'PEP', 'PPT'].includes(tipoDoc), 'Tipo de documento inválido.');
      const doc = tipoDoc === 'NIT' ? limpiarNit(d.documento) : texto(d.documento, 'Documento', 30);
      exigir(doc.length >= 3, 'Documento inválido.');
      if (tipoDoc === 'NIT') exigir(Number(d.dv) === digitoVerificacion(doc), `El dígito de verificación del NIT ${doc} es ${digitoVerificacion(doc)}.`);
      const clave = tipoDoc + ':' + doc;
      exigir(!e.idx.docCliente[clave], 'Ya existe un cliente con ese documento.');
      const plazo = Number(d.plazoDias ?? 30);
      exigir(Number.isInteger(plazo) && plazo >= 0 && plazo <= 365, 'Plazo de pago inválido.');
      return () => {
        e.clientes[id] = {
          id,
          tipoDocumento: tipoDoc,
          documento: doc,
          dv: tipoDoc === 'NIT' ? digitoVerificacion(doc) : null,
          razonSocial: texto(d.razonSocial, 'Razón social', 200),
          retieneRenta: !!d.retieneRenta,
          retieneIva: !!d.retieneIva,
          retieneIca: !!d.retieneIca,
          granEmpresa: !!d.granEmpresa,
          municipio: opcional(d.municipio, 80),
          direccion: opcional(d.direccion, 200),
          plazoDias: plazo,
          contactos: Array.isArray(d.contactos) ? d.contactos.slice(0, 10).map((c) => ({ nombre: opcional(c.nombre, 120), correo: opcional(c.correo, 120), telefono: opcional(c.telefono, 40) })) : [],
          autorizacionDatos: !!d.autorizacionDatos,
          activo: true,
        };
        e.idx.docCliente[clave] = id;
        return `Cliente ${e.clientes[id].razonSocial} (${tipoDoc} ${doc}) registrado.`;
      };
    },

    'cliente.actualizado'(e, ev) {
      const d = ev.datos;
      const c = e.clientes[d.id];
      exigir(c, 'Cliente no encontrado.');
      if (d.plazoDias !== undefined) exigir(Number.isInteger(Number(d.plazoDias)) && d.plazoDias >= 0 && d.plazoDias <= 365, 'Plazo de pago inválido.');
      return () => {
        const cambios = [];
        for (const k of ['razonSocial', 'municipio', 'direccion']) if (d[k] !== undefined && d[k] !== c[k]) cambios.push(`${k}: «${c[k]}» → «${(c[k] = opcional(d[k], 200))}»`);
        for (const k of ['retieneRenta', 'retieneIva', 'retieneIca', 'granEmpresa', 'activo', 'autorizacionDatos'])
          if (typeof d[k] === 'boolean' && d[k] !== c[k]) {
            cambios.push(`${k}: ${c[k]} → ${d[k]}`);
            c[k] = d[k];
          }
        if (d.plazoDias !== undefined && Number(d.plazoDias) !== c.plazoDias) {
          cambios.push(`plazo: ${c.plazoDias} → ${d.plazoDias} días`);
          c.plazoDias = Number(d.plazoDias);
        }
        if (Array.isArray(d.contactos)) c.contactos = d.contactos.slice(0, 10);
        return `Cliente ${c.razonSocial} actualizado. ${cambios.join('; ')}`;
      };
    },

    'proyecto.registrado'(e, ev) {
      const d = ev.datos;
      const id = texto(d.id, 'Identificador');
      exigir(!e.proyectos[id], 'El proyecto ya existe.');
      const codigo = texto(d.codigo, 'Código', 30).toUpperCase();
      exigir(!e.idx.codigoProyecto[codigo], 'Ya existe un proyecto con ese código.');
      exigir(e.clientes[d.clienteId], 'Cliente no encontrado.');
      const valor = d.valorContratado ? centavos(d.valorContratado, 'Valor contratado') : 0;
      const gar = d.garantiaPpm ? ppm(d.garantiaPpm, 'Retención de garantía') : 0;
      return () => {
        e.proyectos[id] = {
          id,
          codigo,
          nombre: texto(d.nombre, 'Nombre', 200),
          clienteId: d.clienteId,
          empresaId: d.empresaId || '',
          contrato: opcional(d.contrato, 80),
          valorContratado: valor,
          anticipoPactado: d.anticipoPactado || 0,
          garantiaPpm: gar,
          centroCosto: opcional(d.centroCosto, 40),
          conceptoRetencion: opcional(d.conceptoRetencion, 20),
          fechaInicio: d.fechaInicio && esFecha(d.fechaInicio) ? d.fechaInicio : '',
          fechaFin: d.fechaFin && esFecha(d.fechaFin) ? d.fechaFin : '',
          estado: 'activo',
        };
        e.idx.codigoProyecto[codigo] = id;
        return `Proyecto ${codigo} · ${e.proyectos[id].nombre} registrado.`;
      };
    },

    'proyecto.actualizado'(e, ev) {
      const d = ev.datos;
      const p = e.proyectos[d.id];
      exigir(p, 'Proyecto no encontrado.');
      if (d.estado) exigir(['activo', 'suspendido', 'terminado', 'liquidado'].includes(d.estado), 'Estado inválido.');
      if (d.valorContratado !== undefined) centavos(d.valorContratado, 'Valor contratado');
      return () => {
        const antes = { nombre: p.nombre, valorContratado: p.valorContratado, estado: p.estado };
        for (const k of ['nombre', 'contrato', 'centroCosto', 'conceptoRetencion']) if (d[k] !== undefined) p[k] = opcional(d[k], 200);
        for (const k of ['valorContratado', 'anticipoPactado', 'garantiaPpm']) if (d[k] !== undefined) p[k] = d[k];
        for (const k of ['fechaInicio', 'fechaFin']) if (d[k] !== undefined) p[k] = d[k] && esFecha(d[k]) ? d[k] : '';
        if (d.estado) p.estado = d.estado;
        return `Proyecto ${p.codigo} actualizado. Antes: ${JSON.stringify(antes)}.`;
      };
    },

    'factura.registrada'(e, ev) {
      const d = ev.datos;
      const id = texto(d.id, 'Identificador');
      exigir(!e.facturas[id], 'La factura ya existe.');
      const empresa = e.empresas[d.empresaId];
      exigir(empresa, 'Empresa emisora no encontrada.');
      const cliente = e.clientes[d.clienteId];
      exigir(cliente, 'Cliente no encontrado.');
      exigir(cliente.activo, 'El cliente está inactivo.');
      const proyecto = e.proyectos[d.proyectoId];
      exigir(proyecto, 'Toda factura debe asignarse a un proyecto.');
      exigir(proyecto.clienteId === d.clienteId, `El proyecto ${proyecto.codigo} es de otro cliente.`);
      fecha(d.fechaEmision, 'Fecha de emisión');
      fecha(d.fechaVencimiento, 'Fecha de vencimiento');
      exigir(d.fechaVencimiento >= d.fechaEmision, 'La factura vence antes de emitirse.');
      exigirPeriodoAbierto(e, d.fechaEmision);
      const prefijo = opcional(d.prefijo, 4).toUpperCase();
      const numero = Number(d.numero);
      exigir(Number.isSafeInteger(numero) && numero > 0, 'Número de factura inválido.');
      const res = e.resoluciones[d.resolucionId];
      exigir(res && res.empresaId === d.empresaId, 'Resolución de facturación no encontrada para la empresa.');
      exigir(res.prefijo === prefijo, `El prefijo ${prefijo || '(vacío)'} no corresponde a la resolución ${res.numero} (${res.prefijo || 'sin prefijo'}).`);
      exigir(numero >= res.desde && numero <= res.hasta, `El número ${numero} está fuera del rango autorizado (${res.desde}–${res.hasta}).`);
      exigir(d.fechaEmision >= res.vigenciaDesde && d.fechaEmision <= res.vigenciaHasta, `La resolución ${res.numero} no estaba vigente el ${d.fechaEmision}.`);
      const claveNum = `${d.empresaId}:${prefijo}:${numero}`;
      exigir(!e.idx.numero[claveNum], `La factura ${prefijo}${numero} ya está registrada.`);
      const cufe = String(d.cufe || '').trim().toLowerCase();
      exigir(/^[0-9a-f]{96}$/.test(cufe), 'El CUFE debe tener 96 caracteres hexadecimales (SHA-384).');
      exigir(!e.idx.cufe[cufe], 'Ese CUFE ya está registrado.');
      const calc = calcularFactura(d.items);
      // Si el XML trae totales, deben coincidir con los ítems (tolerancia: 1 peso por redondeo del proveedor)
      if (d.totalesXml) {
        const tol = 100;
        exigir(Math.abs(d.totalesXml.total - calc.total) <= tol, `El total del XML (${formatoPesos(d.totalesXml.total)}) no cuadra con los ítems (${formatoPesos(calc.total)}).`, 'cuadre');
      }
      const total = d.totalesXml ? d.totalesXml.total : calc.total;
      const iva = d.totalesXml && Number.isSafeInteger(d.totalesXml.iva) ? d.totalesXml.iva : calc.iva;
      const retenciones = Array.isArray(d.retencionesEsperadas) ? d.retencionesEsperadas : [];
      retenciones.forEach((r) => {
        exigir(['renta', 'iva', 'ica'].includes(r.tipo), 'Tipo de retención inválido.');
        centavos(r.valor, 'Retención');
      });
      const totalRet = retenciones.reduce((s, r) => s + r.valor, 0);
      const amort = d.amortizacionAnticipo ? centavos(d.amortizacionAnticipo, 'Amortización del anticipo') : 0;
      const garantia = d.retencionGarantia ? centavos(d.retencionGarantia, 'Retención de garantía') : 0;
      exigir(totalRet + amort + garantia <= total, 'Las retenciones, el anticipo y la garantía superan el total de la factura.');
      if (amort > 0) {
        const sf = e.saldosFavor[d.clienteId];
        const disp = sf ? (sf.porProyecto[d.proyectoId] || 0) + (sf.porProyecto[''] || 0) : 0;
        exigir(disp >= amort, `El cliente solo tiene ${formatoPesos(disp)} de anticipo disponible para amortizar.`);
      }
      return () => {
        const f = {
          id,
          empresaId: d.empresaId,
          clienteId: d.clienteId,
          proyectoId: d.proyectoId,
          resolucionId: d.resolucionId,
          prefijo,
          numero,
          consecutivo: `${prefijo}${numero}`,
          cufe,
          fechaEmision: d.fechaEmision,
          horaEmision: opcional(d.horaEmision, 20),
          fechaVencimiento: d.fechaVencimiento,
          formaPago: d.formaPago === 'contado' ? 'contado' : 'credito',
          medioPago: opcional(d.medioPago, 40),
          moneda: d.moneda || 'COP',
          trm: d.trm || null,
          ordenCompra: opcional(d.ordenCompra, 60),
          observaciones: opcional(d.observaciones, 1000),
          lineas: calc.lineas,
          subtotal: calc.subtotal,
          descuentos: calc.descuentos,
          baseAntesIva: calc.baseAntesIva,
          iva,
          total,
          retencionesEsperadas: retenciones,
          amortizacionAnticipo: amort,
          retencionGarantia: garantia,
          fechaLiberacionGarantia: d.fechaLiberacionGarantia && esFecha(d.fechaLiberacionGarantia) ? d.fechaLiberacionGarantia : '',
          netoEsperado: total - totalRet - amort - garantia,
          xmlHash: opcional(d.xmlHash, 64),
          adjuntos: Array.isArray(d.adjuntos) ? d.adjuntos.slice(0, 20) : [],
          origen: d.origen === 'xml' ? 'xml' : 'manual',
          notasCredito: [],
          notasDebito: [],
          aplicaciones: [],
          retenciones: [],
          saldoFavorAplicado: [],
          radian: { eventos: [], aceptada: false, reclamo: false },
          anulada: false,
          registradaPor: ev.usuario,
          registradaEl: ev.fecha,
          reclasificaciones: [],
        };
        if (amort > 0) {
          const sf = e.saldosFavor[d.clienteId];
          const dePro = Math.min(sf.porProyecto[d.proyectoId] || 0, amort);
          if (dePro) sumarSaldoFavor(e, d.clienteId, d.proyectoId, -dePro);
          if (amort - dePro) sumarSaldoFavor(e, d.clienteId, '', -(amort - dePro));
          f.saldoFavorAplicado.push({ valor: amort, fecha: d.fechaEmision, evento: ev.id, motivo: 'Amortización de anticipo' });
        }
        e.facturas[id] = f;
        e.idx.numero[claveNum] = id;
        e.idx.cufe[cufe] = id;
        return `Factura ${f.consecutivo} a ${cliente.razonSocial} por ${formatoPesos(total)} (proyecto ${proyecto.codigo}).`;
      };
    },

    'factura.reclasificada'(e, ev) {
      const d = ev.datos;
      const f = e.facturas[d.facturaId];
      exigir(f, 'Factura no encontrada.');
      const p = e.proyectos[d.proyectoId];
      exigir(p && p.clienteId === f.clienteId, 'El proyecto nuevo debe ser del mismo cliente.');
      exigir(p.id !== f.proyectoId, 'La factura ya está en ese proyecto.');
      texto(d.motivo, 'Motivo de la reclasificación');
      exigir(f.registradaPor !== ev.usuario, 'Quien registró la factura no puede aprobar su reclasificación.');
      return () => {
        const antes = e.proyectos[f.proyectoId].codigo;
        f.reclasificaciones.push({ de: f.proyectoId, a: p.id, motivo: d.motivo, por: ev.usuario, fecha: ev.fecha });
        f.proyectoId = p.id;
        return `Factura ${f.consecutivo} pasó del proyecto ${antes} al ${p.codigo}. Motivo: ${d.motivo}`;
      };
    },

    'factura.evento_radian'(e, ev) {
      const d = ev.datos;
      const f = e.facturas[d.facturaId];
      exigir(f, 'Factura no encontrada.');
      const TIPOS = { '030': 'Acuse de recibo', '031': 'Reclamo', '032': 'Recibo del bien o servicio', '033': 'Aceptación expresa', '034': 'Aceptación tácita' };
      exigir(TIPOS[d.codigo], 'Evento RADIAN desconocido.');
      fecha(d.fecha, 'Fecha del evento');
      exigir(!f.radian.eventos.some((x) => x.codigo === d.codigo), `El evento ${TIPOS[d.codigo]} ya está registrado.`);
      if (d.codigo === '033' || d.codigo === '034') exigir(!f.radian.reclamo, 'La factura tiene un reclamo: no puede aceptarse.');
      if (d.codigo === '031') exigir(!f.radian.aceptada, 'La factura ya fue aceptada.');
      return () => {
        f.radian.eventos.push({ codigo: d.codigo, nombre: TIPOS[d.codigo], fecha: d.fecha, cude: opcional(d.cude, 96), detalle: opcional(d.detalle, 500) });
        if (d.codigo === '033' || d.codigo === '034') f.radian.aceptada = true;
        if (d.codigo === '031') f.radian.reclamo = true;
        return `Factura ${f.consecutivo}: ${TIPOS[d.codigo]} (${d.fecha}).`;
      };
    },

    'nota.registrada'(e, ev) {
      const d = ev.datos;
      const id = texto(d.id, 'Identificador');
      exigir(!e.notas[id], 'La nota ya existe.');
      exigir(['credito', 'debito'].includes(d.clase), 'Clase de nota inválida.');
      const f = e.facturas[d.facturaId];
      exigir(f, 'La nota debe referirse a una factura registrada.');
      exigir(!f.anulada, 'La factura ya está anulada.');
      fecha(d.fecha, 'Fecha de la nota');
      exigir(d.fecha >= f.fechaEmision, 'La nota no puede ser anterior a la factura.');
      exigirPeriodoAbierto(e, d.fecha);
      const valor = centavos(d.valor, 'Valor de la nota', { min: 1 });
      const cude = String(d.cude || '').trim().toLowerCase();
      exigir(/^[0-9a-f]{96}$/.test(cude), 'El CUDE debe tener 96 caracteres hexadecimales.');
      exigir(!e.idx.cude[cude], 'Ese CUDE ya está registrado.');
      const claveNum = `${f.empresaId}:${d.clase}:${opcional(d.prefijo, 6).toUpperCase()}:${d.numero}`;
      exigir(!e.idx.notaNumero[claveNum], 'Esa nota ya está registrada.');
      // Códigos de corrección DIAN (Anexo técnico 1.9): crédito 1-6, débito 1-4
      const concepto = String(d.concepto || '');
      exigir(d.clase === 'credito' ? /^[1-6]$/.test(concepto) : /^[1-4]$/.test(concepto), 'Concepto de corrección DIAN inválido.');
      if (d.clase === 'credito') {
        const t = totalesFactura(f);
        exigir(valor <= t.saldo, `La nota crédito (${formatoPesos(valor)}) supera el saldo de la factura (${formatoPesos(t.saldo)}). Si ya se recaudó, primero reverse o registre el saldo a favor.`);
      }
      const anula = d.clase === 'credito' && concepto === '2';
      if (anula) exigir(valor === totalesFactura(f).saldo && totalesFactura(f).recaudado === 0, 'Una anulación (concepto 2) debe ser por el total y sobre una factura sin recaudos.');
      return () => {
        const n = {
          id,
          clase: d.clase,
          facturaId: f.id,
          prefijo: opcional(d.prefijo, 6).toUpperCase(),
          numero: String(d.numero),
          cude,
          fecha: d.fecha,
          concepto,
          descripcion: opcional(d.descripcion, 500),
          valor,
          iva: d.iva || 0,
        };
        e.notas[id] = n;
        e.idx.cude[cude] = id;
        e.idx.notaNumero[claveNum] = id;
        (d.clase === 'credito' ? f.notasCredito : f.notasDebito).push(n);
        if (anula) f.anulada = true;
        return `Nota ${d.clase} ${n.prefijo}${n.numero} por ${formatoPesos(valor)} a la factura ${f.consecutivo}${anula ? ' (anulación)' : ''}.`;
      };
    },

    'recaudo.registrado'(e, ev) {
      const d = ev.datos;
      const id = texto(d.id, 'Identificador');
      exigir(!e.recaudos[id], 'El recaudo ya existe.');
      const cliente = e.clientes[d.clienteId];
      exigir(cliente, 'Cliente no encontrado.');
      fecha(d.fecha, 'Fecha del recaudo');
      exigirPeriodoAbierto(e, d.fecha);
      const valor = centavos(d.valor, 'Valor recibido');
      texto(d.cuenta, 'Cuenta bancaria', 80);
      const aplic = Array.isArray(d.aplicaciones) ? d.aplicaciones : [];
      const rets = Array.isArray(d.retenciones) ? d.retenciones : [];
      exigir(valor > 0 || rets.length > 0, 'El recaudo debe tener un valor recibido o retenciones.');
      // Por factura: lo aplicado + lo retenido no puede superar su saldo
      const porFactura = {};
      for (const a of aplic) {
        const f = e.facturas[a.facturaId];
        exigir(f && f.clienteId === d.clienteId, 'Una de las facturas no es de este cliente.');
        exigir(!f.anulada, `La factura ${f.consecutivo} está anulada.`);
        centavos(a.valor, `Valor aplicado a ${f.consecutivo}`, { min: 1 });
        porFactura[f.id] = (porFactura[f.id] || 0) + a.valor;
      }
      for (const r of rets) {
        const f = e.facturas[r.facturaId];
        exigir(f && f.clienteId === d.clienteId, 'Una retención es de una factura de otro cliente.');
        exigir(['renta', 'iva', 'ica'].includes(r.tipo), 'Tipo de retención inválido.');
        centavos(r.valor, 'Retención', { min: 1 });
        if (r.ppm !== undefined) ppm(r.ppm, 'Tarifa de la retención');
        porFactura[f.id] = (porFactura[f.id] || 0) + r.valor;
      }
      for (const [fid, v] of Object.entries(porFactura)) {
        const t = totalesFactura(e.facturas[fid]);
        exigir(v <= t.saldo, `A la factura ${e.facturas[fid].consecutivo} se le aplican ${formatoPesos(v)} y su saldo es ${formatoPesos(t.saldo)}.`);
      }
      const aplicado = aplic.reduce((s, a) => s + a.valor, 0);
      exigir(aplicado <= valor, `Se aplican ${formatoPesos(aplicado)} y solo se recibieron ${formatoPesos(valor)}.`);
      const excedente = valor - aplicado;
      if (excedente > 0) exigir(['anticipo', 'saldo_favor'].includes(d.destinoExcedente), `Quedan ${formatoPesos(excedente)} sin aplicar: indique si es un anticipo o un saldo a favor del cliente.`);
      if (d.proyectoId) exigir(e.proyectos[d.proyectoId] && e.proyectos[d.proyectoId].clienteId === d.clienteId, 'El proyecto no es de este cliente.');
      if (d.referencia) {
        const k = `${d.cuenta}:${d.referencia}`;
        exigir(!e.idx.refBanco[k], `Ya hay un recaudo con la referencia ${d.referencia} en esa cuenta.`);
      }
      return () => {
        const r = {
          id,
          clienteId: d.clienteId,
          proyectoId: d.proyectoId || '',
          fecha: d.fecha,
          valor,
          cuenta: d.cuenta,
          medio: opcional(d.medio, 40),
          referencia: opcional(d.referencia, 80),
          observaciones: opcional(d.observaciones, 500),
          aplicaciones: aplic.map((a) => ({ facturaId: a.facturaId, valor: a.valor })),
          retenciones: rets.map((x) => ({ facturaId: x.facturaId, tipo: x.tipo, base: x.base || 0, ppm: x.ppm || 0, valor: x.valor, certificado: null })),
          excedente,
          destinoExcedente: excedente > 0 ? d.destinoExcedente : '',
          reversado: false,
          conciliado: null,
          registradoPor: ev.usuario,
        };
        r.retenciones.forEach((x, i) => (x.id = `${id}#r${i}`));
        e.recaudos[id] = r;
        if (r.referencia) e.idx.refBanco[`${r.cuenta}:${r.referencia}`] = id;
        for (const a of r.aplicaciones) e.facturas[a.facturaId].aplicaciones.push({ recaudoId: id, valor: a.valor, fecha: r.fecha, reversado: false });
        for (const x of r.retenciones) e.facturas[x.facturaId].retenciones.push({ ...x, recaudoId: id, fecha: r.fecha, reversado: false });
        if (excedente > 0) sumarSaldoFavor(e, r.clienteId, r.destinoExcedente === 'anticipo' ? r.proyectoId : '', excedente);
        return `Recaudo de ${formatoPesos(valor)} de ${cliente.razonSocial} (${r.aplicaciones.length} factura(s)${excedente ? `, ${formatoPesos(excedente)} como ${r.destinoExcedente === 'anticipo' ? 'anticipo' : 'saldo a favor'}` : ''}).`;
      };
    },

    'recaudo.reversado'(e, ev) {
      const d = ev.datos;
      const r = e.recaudos[d.recaudoId];
      exigir(r, 'Recaudo no encontrado.');
      exigir(!r.reversado, 'El recaudo ya fue reversado.');
      texto(d.motivo, 'Motivo de la reversión');
      exigir(r.registradoPor !== ev.usuario, 'Quien registró el recaudo no puede aprobar su reversión.');
      fecha(d.fecha, 'Fecha de la reversión');
      exigirPeriodoAbierto(e, d.fecha);
      if (r.excedente > 0) {
        const sf = e.saldosFavor[r.clienteId];
        const k = r.destinoExcedente === 'anticipo' ? r.proyectoId : '';
        exigir(sf && (sf.porProyecto[k] || 0) >= r.excedente, 'El anticipo o saldo a favor de este recaudo ya se usó: reverse primero esas aplicaciones.');
      }
      return () => {
        r.reversado = { motivo: d.motivo, por: ev.usuario, fecha: d.fecha };
        for (const f of Object.values(e.facturas)) {
          f.aplicaciones.forEach((a) => a.recaudoId === r.id && (a.reversado = true));
          f.retenciones.forEach((x) => x.recaudoId === r.id && (x.reversado = true));
        }
        if (r.excedente > 0) sumarSaldoFavor(e, r.clienteId, r.destinoExcedente === 'anticipo' ? r.proyectoId : '', -r.excedente);
        return `Recaudo de ${formatoPesos(r.valor)} del ${r.fecha} reversado. Motivo: ${d.motivo}`;
      };
    },

    'saldo_favor.aplicado'(e, ev) {
      const d = ev.datos;
      const f = e.facturas[d.facturaId];
      exigir(f, 'Factura no encontrada.');
      exigir(!f.anulada, 'La factura está anulada.');
      const valor = centavos(d.valor, 'Valor', { min: 1 });
      fecha(d.fecha, 'Fecha');
      exigirPeriodoAbierto(e, d.fecha);
      const sf = e.saldosFavor[f.clienteId];
      const k = d.desde === 'anticipo' ? f.proyectoId : '';
      exigir(sf && (sf.porProyecto[k] || 0) >= valor, `El cliente no tiene ${formatoPesos(valor)} ${d.desde === 'anticipo' ? 'de anticipo en este proyecto' : 'de saldo a favor'}.`);
      exigir(valor <= totalesFactura(f).saldo, 'El valor supera el saldo de la factura.');
      return () => {
        sumarSaldoFavor(e, f.clienteId, k, -valor);
        f.saldoFavorAplicado.push({ valor, fecha: d.fecha, evento: ev.id, motivo: d.desde === 'anticipo' ? 'Amortización de anticipo' : 'Saldo a favor' });
        return `${formatoPesos(valor)} de ${d.desde === 'anticipo' ? 'anticipo' : 'saldo a favor'} aplicados a la factura ${f.consecutivo}.`;
      };
    },

    'retencion.certificada'(e, ev) {
      const d = ev.datos;
      const r = e.recaudos[d.recaudoId];
      exigir(r, 'Recaudo no encontrado.');
      const x = r.retenciones.find((y) => y.id === d.retencionId);
      exigir(x, 'Retención no encontrada.');
      exigir(!x.certificado, 'Esa retención ya tiene certificado.');
      fecha(d.fecha, 'Fecha del certificado');
      return () => {
        x.certificado = { fecha: d.fecha, numero: opcional(d.numero, 60), periodo: opcional(d.periodo, 20), archivo: opcional(d.archivo, 200) };
        const fr = e.facturas[x.facturaId].retenciones.find((y) => y.id === x.id);
        if (fr) fr.certificado = x.certificado;
        return `Certificado de retención ${x.tipo} de ${formatoPesos(x.valor)} recibido.`;
      };
    },

    'banco.movimientos_importados'(e, ev) {
      const d = ev.datos;
      texto(d.cuenta, 'Cuenta', 80);
      exigir(Array.isArray(d.movimientos) && d.movimientos.length > 0 && d.movimientos.length <= 5000, 'Movimientos inválidos.');
      for (const m of d.movimientos) {
        texto(m.id, 'Identificador del movimiento');
        fecha(m.fecha, 'Fecha del movimiento');
        exigir(Number.isSafeInteger(m.valor), 'Valor de movimiento inválido.');
      }
      return () => {
        let nuevos = 0;
        for (const m of d.movimientos) {
          if (e.movimientosBanco[m.id]) continue;
          e.movimientosBanco[m.id] = { id: m.id, cuenta: d.cuenta, fecha: m.fecha, valor: m.valor, descripcion: opcional(m.descripcion, 300), referencia: opcional(m.referencia, 80), recaudoId: null };
          nuevos++;
        }
        return `${nuevos} movimientos bancarios importados de ${d.cuenta} (${d.movimientos.length - nuevos} ya existían).`;
      };
    },

    'banco.conciliado'(e, ev) {
      const d = ev.datos;
      const m = e.movimientosBanco[d.movimientoId];
      const r = e.recaudos[d.recaudoId];
      exigir(m && r, 'Movimiento o recaudo no encontrado.');
      exigir(!m.recaudoId && !r.conciliado, 'Ya está conciliado.');
      exigir(!r.reversado, 'El recaudo está reversado.');
      exigir(m.valor === r.valor, `El movimiento (${formatoPesos(m.valor)}) y el recaudo (${formatoPesos(r.valor)}) no son del mismo valor.`);
      return () => {
        m.recaudoId = r.id;
        r.conciliado = { movimientoId: m.id, por: ev.usuario, fecha: ev.fecha };
        return `Recaudo de ${formatoPesos(r.valor)} conciliado con el movimiento del ${m.fecha}.`;
      };
    },

    'periodo.cerrado'(e, ev) {
      const p = ev.datos.periodo;
      exigir(/^\d{4}-\d{2}$/.test(p), 'Período inválido (AAAA-MM).');
      exigir(!e.periodosCerrados[p], 'El período ya está cerrado.');
      return () => {
        e.periodosCerrados[p] = { por: ev.usuario, fecha: ev.fecha };
        return `Período ${p} cerrado.`;
      };
    },
    'periodo.reabierto'(e, ev) {
      const p = ev.datos.periodo;
      exigir(e.periodosCerrados[p], 'El período no está cerrado.');
      texto(ev.datos.motivo, 'Motivo');
      return () => {
        delete e.periodosCerrados[p];
        return `Período ${p} reabierto. Motivo: ${ev.datos.motivo}`;
      };
    },
  };

  /** Valida el evento contra el estado y lo aplica. Lanza ErrorNegocio si no procede. */
  function aplicar(e, ev) {
    exigir(ev && typeof ev === 'object', 'Evento inválido.');
    exigir(ev.seq === e.seq + 1, `Evento fuera de orden (${ev.seq}; se esperaba ${e.seq + 1}).`, 'orden');
    const m = MANEJADORES[ev.tipo];
    exigir(m, `Tipo de evento desconocido: ${ev.tipo}.`);
    if (ev.tipo !== 'sistema.iniciado') exigir(e.iniciado, 'El sistema no ha sido iniciado.');
    // Autorización: el primer administrador se crea en el evento 2, sin usuario previo
    const arranque = (ev.tipo === 'usuario.creado' && Object.keys(e.usuarios).length === 0) || ev.tipo === 'sistema.iniciado' || ev.tipo === 'usuario.clave_recuperada';
    if (!arranque) {
      const u = e.usuarios[ev.usuario];
      exigir(u && u.activo, 'Usuario no autorizado.', 'permiso');
      exigir(puede(u, ev.tipo), `El rol de ${u.usuario} no permite «${ev.tipo}».`, 'permiso');
    }
    exigir(ev.datos && typeof ev.datos === 'object', 'Evento sin datos.');
    const confirmar = m(e, ev);
    const resumen = confirmar();
    e.seq = ev.seq;
    e.ultimoHash = ev.hash || '';
    e.bitacora.push({ seq: ev.seq, fecha: ev.fecha, usuario: ev.usuario, tipo: ev.tipo, resumen, hash: ev.hash || '' });
    return resumen;
  }

  /** Comprueba si un evento se puede aplicar sin modificar el estado real. */
  function probar(e, ev) {
    const copia = clonarEstado(e);
    return aplicar(copia, ev);
  }

  function clonarEstado(e) {
    return typeof structuredClone === 'function' ? structuredClone(e) : JSON.parse(JSON.stringify(e));
  }

  function reconstruir(eventos) {
    const e = crearEstado();
    for (const ev of eventos) aplicar(e, ev);
    return e;
  }

  /* ═══════════════  Consultas  ═══════════════ */
  const TRAMOS = [
    { clave: 'por_vencer', nombre: 'Por vencer', desde: -Infinity, hasta: 0 },
    { clave: 'd1_30', nombre: '1-30 días', desde: 1, hasta: 30 },
    { clave: 'd31_60', nombre: '31-60 días', desde: 31, hasta: 60 },
    { clave: 'd61_90', nombre: '61-90 días', desde: 61, hasta: 90 },
    { clave: 'd91_180', nombre: '91-180 días', desde: 91, hasta: 180 },
    { clave: 'd181_360', nombre: '181-360 días', desde: 181, hasta: 360 },
    { clave: 'mas_360', nombre: 'Más de 360 días', desde: 361, hasta: Infinity },
  ];
  const tramoDe = (dias) => TRAMOS.find((t) => dias >= t.desde && dias <= t.hasta).clave;

  /** Cartera por edades al corte. La garantía retenida se cuenta por su fecha de liberación. */
  function carteraPorEdades(e, corte, filtro = {}) {
    const filas = {};
    const totales = Object.fromEntries(TRAMOS.map((t) => [t.clave, 0]));
    totales.total = 0;
    for (const f of Object.values(e.facturas)) {
      if (f.anulada || f.fechaEmision > corte) continue;
      if (filtro.clienteId && f.clienteId !== filtro.clienteId) continue;
      if (filtro.proyectoId && f.proyectoId !== filtro.proyectoId) continue;
      if (filtro.empresaId && f.empresaId !== filtro.empresaId) continue;
      const t = totalesAlCorte(f, corte);
      if (t.saldo <= 0) continue;
      const fila = (filas[f.clienteId] = filas[f.clienteId] || { clienteId: f.clienteId, ...Object.fromEntries(TRAMOS.map((x) => [x.clave, 0])), total: 0, facturas: [] });
      const partes = [[t.saldoExigible, f.fechaVencimiento]];
      if (t.garantiaPendiente) partes.push([t.garantiaPendiente, f.fechaLiberacionGarantia || f.fechaVencimiento]);
      for (const [v, venc] of partes) {
        if (!v) continue;
        const tr = tramoDe(diasEntre(venc, corte));
        fila[tr] += v;
        totales[tr] += v;
      }
      fila.total += t.saldo;
      totales.total += t.saldo;
      fila.facturas.push({ facturaId: f.id, saldo: t.saldo, diasVencida: Math.max(0, diasEntre(f.fechaVencimiento, corte)) });
    }
    return { corte, tramos: TRAMOS, filas: Object.values(filas).sort((a, b) => b.total - a.total), totales };
  }

  /** Totales de una factura considerando solo movimientos hasta la fecha de corte. */
  function totalesAlCorte(f, corte) {
    if (!corte) return totalesFactura(f);
    const g = {
      ...f,
      notasCredito: f.notasCredito.filter((n) => n.fecha <= corte),
      notasDebito: f.notasDebito.filter((n) => n.fecha <= corte),
      aplicaciones: f.aplicaciones.filter((a) => a.fecha <= corte),
      retenciones: f.retenciones.filter((r) => r.fecha <= corte),
      saldoFavorAplicado: f.saldoFavorAplicado.filter((a) => a.fecha <= corte),
    };
    return totalesFactura(g);
  }

  function resumenGeneral(e, { desde, hasta, hoy }) {
    let facturado = 0,
      notasCredito = 0,
      recaudado = 0,
      retenido = 0,
      porCobrar = 0,
      vencido = 0,
      nFact = 0;
    for (const f of Object.values(e.facturas)) {
      if (f.fechaEmision >= desde && f.fechaEmision <= hasta) {
        facturado += f.total;
        nFact++;
      }
      for (const n of f.notasCredito) if (n.fecha >= desde && n.fecha <= hasta) notasCredito += n.valor;
      for (const a of f.aplicaciones) if (!a.reversado && a.fecha >= desde && a.fecha <= hasta) recaudado += a.valor;
      for (const r of f.retenciones) if (!r.reversado && r.fecha >= desde && r.fecha <= hasta) retenido += r.valor;
      if (!f.anulada) {
        const t = totalesFactura(f);
        if (t.saldo > 0) {
          porCobrar += t.saldo;
          if (f.fechaVencimiento < hoy) vencido += t.saldoExigible;
        }
      }
    }
    return { facturado, notasCredito, recaudado, retenido, porCobrar, vencido, facturas: nFact, dso: dso(e, hoy) };
  }

  /** Días promedio de cobro (DSO) de los últimos 90 días: cartera / ventas del período × días. */
  function dso(e, hoy) {
    const desde = sumarDias(hoy, -90);
    let ventas = 0,
      cartera = 0;
    for (const f of Object.values(e.facturas)) {
      if (f.anulada) continue;
      if (f.fechaEmision > desde && f.fechaEmision <= hoy) ventas += f.total;
      const t = totalesFactura(f);
      if (t.saldo > 0) cartera += t.saldo;
    }
    return ventas > 0 ? Math.round((cartera / ventas) * 90) : null;
  }

  function resumenProyectos(e) {
    return Object.values(e.proyectos).map((p) => {
      let facturado = 0,
        notas = 0,
        recaudado = 0,
        retenido = 0,
        porCobrar = 0,
        garantia = 0,
        favor = 0;
      for (const f of Object.values(e.facturas)) {
        if (f.proyectoId !== p.id) continue;
        facturado += f.total;
        const t = totalesFactura(f);
        notas += t.notasCredito - t.notasDebito;
        recaudado += t.recaudado;
        retenido += t.retenido;
        favor += t.saldoFavorAplicado;
        if (!f.anulada && t.saldo > 0) {
          porCobrar += t.saldo;
          garantia += t.garantiaPendiente;
        }
      }
      const sf = e.saldosFavor[p.clienteId];
      const anticipoDisponible = sf ? sf.porProyecto[p.id] || 0 : 0;
      const neto = facturado - notas;
      return {
        proyectoId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        clienteId: p.clienteId,
        valorContratado: p.valorContratado,
        facturado,
        notasNetas: notas,
        facturadoNeto: neto,
        pctFacturado: p.valorContratado ? neto / p.valorContratado : null,
        recaudado,
        retenido,
        anticipoAmortizado: favor,
        anticipoDisponible,
        porCobrar,
        garantiaRetenida: garantia,
        porFacturar: p.valorContratado ? p.valorContratado - neto : null,
      };
    });
  }

  function vencimientosProximos(e, hoy, dias) {
    const lim = sumarDias(hoy, dias);
    return Object.values(e.facturas)
      .filter((f) => !f.anulada && totalesFactura(f).saldoExigible > 0 && f.fechaVencimiento >= hoy && f.fechaVencimiento <= lim)
      .sort((a, b) => (a.fechaVencimiento < b.fechaVencimiento ? -1 : 1));
  }

  /** Huecos de numeración por resolución (números del rango usado que no están registrados). */
  function controlNumeracion(e, hoy) {
    const out = [];
    for (const r of Object.values(e.resoluciones)) {
      const nums = Object.values(e.facturas)
        .filter((f) => f.resolucionId === r.id)
        .map((f) => f.numero)
        .sort((a, b) => a - b);
      const huecos = [];
      for (let i = 1; i < nums.length; i++) for (let n = nums[i - 1] + 1; n < nums[i] && huecos.length < 200; n++) huecos.push(n);
      const usados = nums.length ? nums[nums.length - 1] - r.desde + 1 : 0;
      const total = r.hasta - r.desde + 1;
      const disponibles = total - usados;
      const diasVig = diasEntre(hoy, r.vigenciaHasta);
      const alertas = [];
      if (disponibles <= Math.max(10, Math.floor(total * 0.1))) alertas.push(`Quedan ${disponibles} números en la resolución ${r.numero}.`);
      if (diasVig < 0) alertas.push(`La resolución ${r.numero} venció el ${r.vigenciaHasta}.`);
      else if (diasVig <= 30) alertas.push(`La resolución ${r.numero} vence en ${diasVig} días.`);
      out.push({ resolucionId: r.id, numero: r.numero, prefijo: r.prefijo, desde: r.desde, hasta: r.hasta, ultimo: nums[nums.length - 1] || null, registradas: nums.length, huecos, disponibles, alertas });
    }
    return out;
  }

  function retencionesPendientesCertificado(e) {
    const out = [];
    for (const r of Object.values(e.recaudos)) {
      if (r.reversado) continue;
      for (const x of r.retenciones) if (!x.certificado) out.push({ ...x, recaudoId: r.id, clienteId: r.clienteId, fecha: r.fecha });
    }
    return out;
  }

  /** Alertas de pago a mipymes (Ley 2024 de 2020): plazo máximo de 60 días para grandes empresas. */
  function alertasPlazoLegal(e, hoy, plazoMax = 60) {
    return Object.values(e.facturas)
      .filter((f) => !f.anulada && e.clientes[f.clienteId].granEmpresa && totalesFactura(f).saldo > 0 && diasEntre(f.fechaEmision, hoy) > plazoMax)
      .map((f) => ({ facturaId: f.id, dias: diasEntre(f.fechaEmision, hoy) }));
  }

  function estadoCuentaCliente(e, clienteId, hasta) {
    const movs = [];
    for (const f of Object.values(e.facturas)) {
      if (f.clienteId !== clienteId) continue;
      movs.push({ fecha: f.fechaEmision, tipo: 'Factura', doc: f.consecutivo, cargo: f.total, abono: 0, facturaId: f.id });
      for (const n of f.notasDebito) movs.push({ fecha: n.fecha, tipo: 'Nota débito', doc: n.prefijo + n.numero, cargo: n.valor, abono: 0 });
      for (const n of f.notasCredito) movs.push({ fecha: n.fecha, tipo: 'Nota crédito', doc: n.prefijo + n.numero, cargo: 0, abono: n.valor });
      for (const a of f.aplicaciones) if (!a.reversado) movs.push({ fecha: a.fecha, tipo: 'Pago', doc: f.consecutivo, cargo: 0, abono: a.valor });
      for (const r of f.retenciones) if (!r.reversado) movs.push({ fecha: r.fecha, tipo: 'Retención ' + r.tipo, doc: f.consecutivo, cargo: 0, abono: r.valor });
      for (const s of f.saldoFavorAplicado) movs.push({ fecha: s.fecha, tipo: s.motivo, doc: f.consecutivo, cargo: 0, abono: s.valor });
    }
    movs.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : b.cargo - a.cargo));
    let saldo = 0;
    const filas = movs.filter((m) => !hasta || m.fecha <= hasta).map((m) => ({ ...m, saldo: (saldo += m.cargo - m.abono) }));
    const sf = e.saldosFavor[clienteId];
    return { filas, saldo, saldoFavor: sf ? sf.total : 0 };
  }

  /** Sugerencia de aplicación: facturas más antiguas primero. */
  function sugerirAplicacion(e, clienteId, valor, proyectoId) {
    const facts = Object.values(e.facturas)
      .filter((f) => f.clienteId === clienteId && !f.anulada && (!proyectoId || f.proyectoId === proyectoId))
      .map((f) => ({ f, saldo: totalesFactura(f).saldo }))
      .filter((x) => x.saldo > 0)
      .sort((a, b) => (a.f.fechaVencimiento < b.f.fechaVencimiento ? -1 : a.f.fechaVencimiento > b.f.fechaVencimiento ? 1 : a.f.numero - b.f.numero));
    let resto = valor;
    const out = [];
    for (const { f, saldo } of facts) {
      if (resto <= 0) break;
      const v = Math.min(saldo, resto);
      out.push({ facturaId: f.id, valor: v });
      resto -= v;
    }
    return { aplicaciones: out, excedente: resto };
  }

  /* ═══════════════  Exportación CSV (Excel en español)  ═══════════════ */
  function csv(filas, columnas) {
    const esc = (v) => {
      const s = v === null || v === undefined ? '' : String(v);
      return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lineas = [columnas.map((c) => esc(c.titulo)).join(';')];
    for (const f of filas) lineas.push(columnas.map((c) => esc(typeof c.valor === 'function' ? c.valor(f) : f[c.valor])).join(';'));
    return '﻿' + lineas.join('\r\n');
  }
  /** Centavos a número para Excel en configuración regional colombiana (coma decimal, sin miles). */
  const numExcel = (c) => (c / 100).toFixed(2).replace('.', ',');

  return {
    VERSION_ESQUEMA,
    ErrorNegocio,
    ROLES,
    PERMISOS,
    PARAMETROS_INICIALES,
    TRAMOS,
    NOMBRE_ESTADO,
    // dinero
    aplicarTarifa,
    redondearAPeso,
    aCentavos,
    aCentavosXml,
    aPpm,
    formatoPesos,
    formatoTarifa,
    numExcel,
    // identificación y fechas
    digitoVerificacion,
    limpiarNit,
    esFecha,
    diasEntre,
    sumarDias,
    hoyColombia,
    // cálculo
    calcularFactura,
    sugerirRetenciones,
    uvtPara,
    // eventos
    crearEstado,
    aplicar,
    probar,
    reconstruir,
    clonarEstado,
    canonico,
    hashEvento,
    sellarEvento,
    verificarCadena,
    nuevoId,
    puede,
    // claves
    derivarClave,
    verificarClave,
    validarClaveNueva,
    generarCodigoRecuperacion,
    normalizarCodigo,
    // consultas
    totalesFactura,
    totalesAlCorte,
    estadoFactura,
    carteraPorEdades,
    resumenGeneral,
    resumenProyectos,
    vencimientosProximos,
    controlNumeracion,
    retencionesPendientesCertificado,
    alertasPlazoLegal,
    estadoCuentaCliente,
    sugerirAplicacion,
    csv,
  };
});
