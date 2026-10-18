/* ══════════════════════════════════════════════════════════════════════════
   PDF — el estilo de generarPDF de ARKEN CONTROL (§22): jsPDF tamaño carta,
   márgenes de 11 mm, encabezado con el logo de ARKEN, «ARKEN ANALYTICA» y
   «EVALUACIÓN DE PROPUESTAS», empresa, NIT, documento y fecha a la derecha,
   regla de 0,5 por debajo del bloque más bajo; pie con «Generado por»,
   «ARKEN ANALYTICA» y «Página x de y»; tablas con autotable.
   Dibuja los bloques neutros que arman Pliego, Confidencialidad, etc.
   ══════════════════════════════════════════════════════════════════════════ */
const LOGO_ARKEN = '{{LOGO}}';

const Pdf = (function(){

  function disponible(){ return !!(window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && window.jspdf.jsPDF.API.autoTable); }

  /* Helvetica solo conoce WinAnsi: «≥» saldría como «"e». Se traduce lo que tiene
     equivalente y el resto queda como «?», también dentro de las tablas de autoTable. */
  const EQUIVALENTES = { '≥':'>=', '≤':'<=', '−':'-', '→':'->', '✓':'Sí', '✕':'x', 'Σ':'Suma', '◇':'-', '›':'>', '─':'-', '═':'=' };
  const WINANSI = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ');
  function limpiar(t){
    if (Array.isArray(t)) return t.map(limpiar);
    if (typeof t !== 'string') return t;
    return t.normalize('NFC').replace(/[^\x00-\xFF]/g, c => EQUIVALENTES[c] || (WINANSI.has(c) ? c : '?'));
  }
  function paraHelvetica(doc){
    ['text', 'splitTextToSize', 'getTextWidth', 'getStringUnitWidth'].forEach(f => {
      const original = doc[f]; if (typeof original !== 'function') return;
      doc[f] = function(t, ...resto){ return original.call(this, limpiar(t), ...resto); };
    });
  }

  /** cfg = { nombre, titulo, subtitulo, documento, orientacion:'p'|'l', bloques, marcaAgua } → Blob */
  function generar(cfg){
    if (!disponible()) throw new Error('No se pudo cargar jsPDF dentro del programa. Recargue la página; si persiste, descargue de nuevo ARKEN_ANALYTICA.html.');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:cfg.orientacion === 'l' ? 'landscape' : 'portrait', unit:'mm', format:'letter' });
    paraHelvetica(doc);
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 11, BOT = 16;
    const e = S.empresa || {};
    const usuario = Sesion.usuario ? (Sesion.usuario.nombre || Sesion.usuario.usuario) : '';
    const fecha = Util.fmtSello(Date.now());
    const empresa = e.razonSocial || 'EMPRESA PRINCIPAL';
    const nit = e.nit ? 'NIT ' + Nit.formatear(e.nit, e.dv) : '';
    const tituloEnc = cfg.encabezado || 'ARKEN ANALYTICA';
    const subEnc = cfg.subEncabezado || 'EVALUACIÓN DE PROPUESTAS';

    /* La regla del encabezado se traza por debajo del bloque más bajo, como en ARKEN. */
    doc.setFont('helvetica','normal'); doc.setFontSize(6.6);
    const lineasDoc = doc.splitTextToSize((cfg.documento || cfg.titulo || '') + ' · ' + fecha, (W - 2*M) * 0.46);
    const yrBase = e.logo ? 6.5 + 10 + 2.5 : 10.5;
    const Y_REGLA = Math.max(24.5, yrBase + 3.6 + (nit ? 3.4 : 0) + (lineasDoc.length - 1) * 3.4 + 2 + 2.8);
    const TOP = Y_REGLA + 5.5;
    let y = TOP;
    const conCabecera = new Set();
    const sinCabecera = new Set();

    function cabecera(){
      const pag = doc.internal.getNumberOfPages();
      if (conCabecera.has(pag) || sinCabecera.has(pag)) return;
      conCabecera.add(pag);
      try { doc.addImage(LOGO_ARKEN, 'PNG', M, 7, 11, 11); } catch(err){}
      doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(22,24,26);
      doc.text(tituloEnc, M + 14, 12.5);
      doc.setFont('helvetica','normal'); doc.setFontSize(6.6); doc.setTextColor(110,116,122);
      doc.text(subEnc, M + 14, 16.4);
      if (cfg.lineaIzquierda){ doc.setFontSize(7.4); doc.setTextColor(60,64,68); doc.text(doc.splitTextToSize(cfg.lineaIzquierda, (W - 2*M) * 0.48), M + 14, 20.6); }
      let yr = yrBase;
      if (e.logo){
        try {
          const pr = doc.getImageProperties(e.logo);
          const f = Math.min(26 / pr.width, 10 / pr.height);
          doc.addImage(e.logo, undefined, W - M - pr.width * f, 6.5, pr.width * f, pr.height * f, undefined, 'FAST');
        } catch(err){ yr = 10.5; }
      }
      doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(22,24,26);
      doc.text(empresa, W - M, yr, { align:'right' });
      let yd = yr + 3.6;
      doc.setFont('helvetica','normal'); doc.setFontSize(6.6); doc.setTextColor(110,116,122);
      if (nit){ doc.text(nit, W - M, yd, { align:'right' }); yd += 3.4; }
      doc.text(lineasDoc, W - M, yd, { align:'right' });
      doc.setDrawColor(22,24,26); doc.setLineWidth(0.5); doc.line(M, Y_REGLA, W - M, Y_REGLA);
      doc.setTextColor(22,24,26);
    }
    function nuevaPagina(){ doc.addPage(); cabecera(); y = TOP; }
    function espacio(alto){ if (y + alto > H - BOT){ nuevaPagina(); return true; } return false; }

    const indice = [];
    let paginaIndice = 0;

    function portada(b){
      const pag = doc.internal.getNumberOfPages();
      sinCabecera.add(pag);
      // Degradado de 160° del tablero de ARKEN (#1A1D20 → #2C3034 → #3A3F44), en franjas.
      const N = 60;
      for (let i = 0; i < N; i++){
        const t = i / (N - 1);
        const c = t < 0.5 ? mezcla([26,29,32], [44,48,52], t * 2) : mezcla([44,48,52], [58,63,68], (t - 0.5) * 2);
        doc.setFillColor(c[0], c[1], c[2]);
        doc.rect(0, H * i / N, W, H / N + 0.3, 'F');
      }
      doc.setDrawColor(169,139,84); doc.setLineWidth(0.3); doc.circle(W - 18, 30, 62, 'S');
      doc.setDrawColor(70,74,78); doc.circle(W - 6, H - 18, 48, 'S');
      try { doc.addImage(LOGO_ARKEN, 'PNG', M + 8, 26, 16, 16); } catch(err){}
      doc.setTextColor(255,255,255); doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.text(tituloEnc, M + 28, 33);
      doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(197,197,197); doc.text(subEnc, M + 28, 38);
      doc.setFontSize(8); doc.setTextColor(220,207,180); doc.text(String(b.eyebrow||'').toUpperCase(), M + 8, 92, { charSpace:1.2 });
      // Título en peso ligero con la parte clave en negrita, y la regla latón.
      doc.setFont('helvetica','normal'); doc.setFontSize(26); doc.setTextColor(255,255,255);
      const lineas = doc.splitTextToSize(String(b.titulo||''), W - 2*M - 16);
      lineas.forEach((l, k) => doc.text(l, M + 8, 106 + k * 11));
      let yy = 106 + lineas.length * 11;
      if (b.clave){ doc.setFont('helvetica','bold'); doc.setFontSize(26); doc.text(String(b.clave), M + 8, yy); yy += 9; }
      doc.setFillColor(169,139,84); doc.rect(M + 8, yy, 17, 0.6, 'F'); yy += 10;
      doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(200,203,205);
      (b.lineas||[]).forEach(l => { doc.splitTextToSize(String(l), W - 2*M - 16).forEach(s => { doc.text(s, M + 8, yy); yy += 5.2; }); });
      if (b.demo){ doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(214,165,78); doc.text('DEMOSTRACIÓN · DATOS FICTICIOS', M + 8, H - 24); }
      nuevaPagina();
    }
    function mezcla(a, b, t){ return a.map((x, i) => Math.round(x + (b[i] - x) * t)); }

    function seccion(b){
      const nivel = b.nivel || 1;
      y += nivel === 1 ? 2 : 0.8;
      doc.setFont('helvetica','bold'); doc.setFontSize(nivel === 1 ? 9.2 : 8.2);
      const ls = doc.splitTextToSize(nivel === 1 ? String(b.txt||'').toUpperCase() : String(b.txt||''), W - 2*M);
      espacio(ls.length * 4 + 10);
      y += 3; doc.setTextColor(22,24,26);
      ls.forEach((l, i) => doc.text(l, M, y + i * 4));
      y += (ls.length - 1) * 4;
      if (nivel === 1){ doc.setDrawColor(150,155,160); doc.setLineWidth(0.2); doc.line(M, y + 1.4, W - M, y + 1.4); y += 6; }
      else y += 4.5;
      indice.push({ txt:b.txt, nivel, pagina:doc.internal.getNumberOfPages() });
    }
    function texto(b){
      doc.setFont('helvetica', b.negrita ? 'bold' : 'normal');
      const tam = b.tam || 8.6;
      doc.setFontSize(tam); doc.setTextColor(b.gris ? 110 : 22, b.gris ? 116 : 24, b.gris ? 122 : 26);
      const alto = Math.max(3, tam * 0.42);
      String(b.txt||'').split('\n').forEach(par => {
        doc.splitTextToSize(par, W - 2*M).forEach(l => { espacio(alto + 1); doc.text(l, M, y); y += alto; });
        y += 1;
      });
      y += 1.2; doc.setTextColor(22,24,26);
    }
    function lista(b){
      doc.setFont('helvetica','normal'); doc.setFontSize(8.4); doc.setTextColor(22,24,26);
      (b.items||[]).forEach((it, i) => {
        const marca = b.numerada ? (i + 1) + '.' : '•';
        const ls = doc.splitTextToSize(String(it), W - 2*M - 6);
        ls.forEach((l, k) => { espacio(4.6); if (k === 0) doc.text(marca, M + 1, y); doc.text(l, M + 6, y); y += 3.7; });
        y += 0.8;
      });
      y += 1.5;
    }
    function kv(b){
      const cols = b.cols || 2, anchoCol = (W - 2*M) / cols, ALTO = 4.1;
      doc.setFontSize(8);
      const pares = b.pares || [];
      for (let f = 0; f < Math.ceil(pares.length / cols); f++){
        const celdas = [];
        for (let c = 0; c < cols; c++){
          const par = pares[f*cols + c]; if (!par) continue;
          doc.setFont('helvetica','bold');
          const ae = Math.min(anchoCol * 0.36, Math.max(22, doc.getTextWidth(par[0] + ':') + 3));
          const le = doc.splitTextToSize(par[0] + ':', ae - 1.5);
          doc.setFont('helvetica','normal');
          const lv = doc.splitTextToSize(String(par[1] === undefined || par[1] === null || par[1] === '' ? '—' : par[1]), anchoCol - ae - 4);
          celdas.push({ c, ae, le, lv });
        }
        const alto = Math.max(...celdas.map(x => Math.max(x.le.length, x.lv.length))) * ALTO + 1.4;
        espacio(alto + 1);
        celdas.forEach(x => {
          const xx = M + x.c * anchoCol;
          doc.setFont('helvetica','bold'); doc.setTextColor(110,116,122); x.le.forEach((l, k) => doc.text(l, xx, y + k * ALTO));
          doc.setFont('helvetica','normal'); doc.setTextColor(22,24,26); x.lv.forEach((l, k) => doc.text(l, xx + x.ae, y + k * ALTO));
        });
        y += alto;
      }
      y += 2;
    }
    function tabla(b){
      const anchoUtil = W - 2*M;
      const totalAnchos = (b.anchos||[]).reduce((t, x) => t + x, 0) || 1;
      const estilos = {};
      (b.anchos||[]).forEach((a, i) => { estilos[i] = { cellWidth:anchoUtil * a / totalAnchos }; });
      Object.keys(b.alinear||{}).forEach(i => { estilos[i] = Object.assign(estilos[i]||{}, { halign:b.alinear[i] }); });
      const cuerpo = (b.filas||[]).map(f => {
        if (f.tipo === 'cap') return f.celdas.map(c => ({ content:c, styles:{ fillColor:[34,38,42], textColor:[255,255,255], fontStyle:'bold' } }));
        if (f.tipo === 'sub') return f.celdas.map(c => ({ content:c, styles:{ fillColor:[219,221,222], fontStyle:'bold' } }));
        return f.celdas;
      });
      if (!cuerpo.length){ texto({ txt:'(Sin registros.)', gris:true }); return; }
      espacio(14);
      doc.autoTable({
        startY:y, head:[b.cabeza], body:cuerpo, foot:b.pie ? [b.pie] : undefined,
        margin:{ left:M, right:M, top:TOP, bottom:BOT }, theme:'grid', showHead:'everyPage', rowPageBreak:'avoid',
        styles:{ font:'helvetica', fontSize:b.letraChica ? 6.4 : 7.2, cellPadding:1.3, lineColor:[185,185,185], lineWidth:0.1, textColor:[22,24,26], overflow:'linebreak' },
        headStyles:{ fillColor:[228,228,228], textColor:[22,24,26], fontStyle:'bold' },
        footStyles:{ fillColor:[239,239,239], textColor:[22,24,26], fontStyle:'bold' },
        alternateRowStyles:{ fillColor:[251,251,251] },
        columnStyles:estilos,
        didDrawPage:() => cabecera()
      });
      y = doc.lastAutoTable.finalY + 4;
    }

    const bloques = cfg.bloques || [];
    const tienePortada = bloques[0] && bloques[0].t === 'portada';
    if (!tienePortada) cabecera();
    if (!tienePortada && cfg.titulo){
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(22,24,26); doc.text(cfg.titulo, M, y); y += 5.5;
      if (cfg.subtitulo){ doc.setFont('helvetica','normal'); doc.setFontSize(8.4); doc.setTextColor(110,116,122);
        const ls = doc.splitTextToSize(cfg.subtitulo, W - 2*M); doc.text(ls, M, y); y += ls.length * 4; }
      y += 2;
    }
    bloques.forEach(b => {
      if (!b) return;
      switch (b.t){
        case 'portada': portada(b); break;
        case 'indice': paginaIndice = doc.internal.getNumberOfPages(); nuevaPagina(); break;
        case 'sec': seccion(b); break;
        case 'texto': texto(b); break;
        case 'lista': lista(b); break;
        case 'kv': kv(b); break;
        case 'tabla': tabla(b); break;
        case 'salto': nuevaPagina(); break;
      }
    });

    /* Índice con números de página: va en la hoja reservada. */
    if (paginaIndice){
      doc.setPage(paginaIndice);
      let yi = TOP;
      doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(22,24,26); doc.text('Índice', M, yi); yi += 8;
      const entradas = indice.length > 48 ? indice.filter(x => x.nivel === 1) : indice;
      entradas.forEach(x => {
        if (yi > H - BOT - 2) return;
        doc.setFont('helvetica', x.nivel === 1 ? 'bold' : 'normal'); doc.setFontSize(x.nivel === 1 ? 8.6 : 8);
        const sangria = x.nivel === 1 ? 0 : 6;
        const txt = doc.splitTextToSize(String(x.txt), W - 2*M - sangria - 18)[0];
        doc.text(txt, M + sangria, yi);
        const xFin = M + sangria + doc.getTextWidth(txt) + 2;
        doc.setDrawColor(200,200,200); doc.setLineDashPattern([0.4, 0.8], 0); doc.line(xFin, yi, W - M - 10, yi); doc.setLineDashPattern([], 0);
        doc.text(String(x.pagina), W - M, yi, { align:'right' });
        yi += x.nivel === 1 ? 6 : 4.8;
      });
    }

    /* Pie, marca de agua y «Página x de y» en todas las hojas. */
    const total = doc.internal.getNumberOfPages();
    for (let p = 1; p <= total; p++){
      doc.setPage(p);
      if (cfg.marcaAgua){
        doc.saveGraphicsState && doc.saveGraphicsState();
        try { doc.setGState(new doc.GState({ opacity:0.12 })); } catch(err){}
        doc.setFont('helvetica','bold'); doc.setFontSize(cfg.marcaAgua.length > 16 ? 34 : 44); doc.setTextColor(150,54,46);
        doc.text(cfg.marcaAgua, W / 2, H / 2, { align:'center', angle:32 });
        doc.restoreGraphicsState && doc.restoreGraphicsState();
      }
      if (sinCabecera.has(p)) continue;
      doc.setDrawColor(217,219,220); doc.setLineWidth(0.2); doc.line(M, H - 10, W - M, H - 10);
      doc.setFont('helvetica','normal'); doc.setFontSize(6.8); doc.setTextColor(110,116,122);
      doc.text('Generado por: ' + usuario, M, H - 6.5);
      doc.text(tituloEnc, W / 2, H - 6.5, { align:'center' });
      doc.text('Página ' + p + ' de ' + total, W - M, H - 6.5, { align:'right' });
    }
    return { blob:doc.output('blob'), paginas:total };
  }
  return { disponible, generar };
})();
