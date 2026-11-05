/* Gerador de PDF próprio (sem bibliotecas) – relatório das tabelas do Entrevero */
'use strict';
const EfcPDF = (() => {
  const W = 842, H = 595; // A4 deitado, em pontos
  const enc = new TextEncoder();
  const CP = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
  function str(t) { // texto PDF em WinAnsi, com escapes
    let o = '';
    for (const ch of String(t)) {
      let c = ch.codePointAt(0);
      if (CP[ch]) c = CP[ch]; else if (c > 255) { o += '?'; continue; }
      if (ch === '(' || ch === ')' || ch === '\\') o += '\\' + ch;
      else if (c < 32 || c > 126) o += '\\' + c.toString(8).padStart(3, '0');
      else o += ch;
    }
    return '(' + o + ')';
  }
  const larg = (t, sz, bold) => String(t).length * sz * (bold ? 0.56 : 0.52);
  function corta(t, sz, max, bold) { t = String(t); while (t.length > 1 && larg(t, sz, bold) > max) t = t.slice(0, -1); return t; }
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(v => v.toFixed(3)).join(' '); };

  function Doc() {
    const pages = []; let cur = null;
    const d = {
      page() { cur = []; pages.push(cur); return d; },
      rect(x, y, w, h, cor) { cur.push(`${rgb(cor)} rg ${x.toFixed(1)} ${(H - y - h).toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f`); return d; },
      line(x1, y1, x2, y2, cor, lw = 0.5) { cur.push(`${rgb(cor)} RG ${lw} w ${x1.toFixed(1)} ${(H - y1).toFixed(1)} m ${x2.toFixed(1)} ${(H - y2).toFixed(1)} l S`); return d; },
      text(t, x, y, sz = 9, cor = '#111111', bold = false, alinha = 'l') {
        let xx = x; if (alinha === 'r') xx = x - larg(t, sz, bold); if (alinha === 'c') xx = x - larg(t, sz, bold) / 2;
        cur.push(`BT /${bold ? 'F2' : 'F1'} ${sz} Tf ${rgb(cor)} rg ${xx.toFixed(1)} ${(H - y).toFixed(1)} Td ${str(t)} Tj ET`); return d;
      },
      image(x, y, w, h) { cur.push(`q ${w} 0 0 ${h} ${x} ${H - y - h} cm /Im1 Do Q`); return d; },
      build(img) { // img: {bytes:Uint8Array,w,h} JPEG ou null
        const objs = []; const add = o => { objs.push(o); return objs.length; };
        const cat = add(null), pagesId = add(null);
        const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
        let im = 0;
        if (img) im = add({ head: `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`, bin: img.bytes });
        const kids = pages.map(p => {
          const content = p.join('\n'); const cb = latin(content);
          const c = add({ head: `<< /Length ${cb.length} >>\nstream\n`, bin: cb });
          return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >>${im ? ` /XObject << /Im1 ${im} 0 R >>` : ''} >> /Contents ${c} 0 R >>`);
        });
        objs[cat - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
        objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map(k => k + ' 0 R').join(' ')}] /Count ${kids.length} >>`;
        const parts = []; let off = 0; const xref = [];
        const push = b => { parts.push(b); off += b.length; };
        push(enc.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
        objs.forEach((o, i) => {
          xref.push(off); push(enc.encode(`${i + 1} 0 obj\n`));
          if (typeof o === 'string') push(enc.encode(o + '\n'));
          else { push(enc.encode(o.head)); push(o.bin); push(enc.encode('\nendstream\n')); }
          push(enc.encode('endobj\n'));
        });
        const xo = off;
        push(enc.encode(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map(x => String(x).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size ${objs.length + 1} /Root ${cat} 0 R >>\nstartxref\n${xo}\n%%EOF`));
        return new Blob(parts, { type: 'application/pdf' });
      }
    };
    return d;
  }
  function CanvasDoc(escala = 2) {
    const pages = []; let ctx = null, imgEl = null;
    const font = (sz, b) => `${b ? '700' : '400'} ${sz}px Helvetica, Arial, sans-serif`;
    const d = {
      page() { const c = document.createElement('canvas'); c.width = W * escala; c.height = H * escala; ctx = c.getContext('2d'); ctx.scale(escala, escala);
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); pages.push(c); return d; },
      rect(x, y, w, h, cor) { ctx.fillStyle = cor; ctx.fillRect(x, y, w, h); return d; },
      line(x1, y1, x2, y2, cor, lw = 0.5) { ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return d; },
      text(t, x, y, sz = 9, cor = '#111111', bold = false, alinha = 'l') { ctx.font = font(sz, bold); ctx.fillStyle = cor;
        ctx.textAlign = alinha === 'r' ? 'right' : alinha === 'c' ? 'center' : 'left'; ctx.fillText(String(t), x, y); return d; },
      image(x, y, w, h) { if (imgEl) ctx.drawImage(imgEl, x, y, w, h); return d; },
      setImg(el) { imgEl = el; },
      build() { return pages.map(c => c.toDataURL('image/png')); }
    };
    return d;
  }
  function latin(s) { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; }

  /* imagem do escudo em JPEG (fundo branco) */
  function escudoJPEG(src) {
    return new Promise(ok => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = 160; c.height = Math.round(160 * im.height / im.width);
        const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1], bin = atob(b64), u = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        ok({ bytes: u, w: c.width, h: c.height });
      };
      im.onerror = () => ok(null); im.src = src;
    });
  }

  /* relatório: rel = { titulo, sub, colunas:[{titulo, cab:[], linhas:[[pos,nome,...]] }], extra:{titulo, cab, linhas, larguras}, rodape } */
  async function relatorio(rel, escudoSrc, comoImagem) {
    const LAR = '#e8731e', CINZA = '#dddddd', OURO = '#fff3c4';
    const img = await escudoJPEG(escudoSrc);
    const doc = comoImagem ? CanvasDoc() : Doc();
    if (comoImagem && img) { doc.setImg(await new Promise(ok => { const e = new Image(); e.onload = () => ok(e); e.onerror = () => ok(null); e.src = URL.createObjectURL(new Blob([img.bytes], { type: 'image/jpeg' })); })); }
    const M = 28, GAP = 10, TOPO = 92, RH = 11.2, base = H - 30;
    const cab = (pg) => {
      doc.page();
      if (img) doc.image(M, 18, 46, 46 * img.h / img.w);
      doc.text(rel.titulo, M + 56, 42, 18, '#111111', true).text(rel.sub, M + 56, 58, 10, LAR, true);
      doc.rect(M, 72, W - 2 * M, 2.5, LAR);
      doc.text(rel.rodape + (pg > 1 ? `  •  página ${pg}` : ''), W - M, H - 14, 7, '#888888', false, 'r');
    };
    const cw = (W - 2 * M - GAP * (rel.colunas.length - 1)) / rel.colunas.length;
    const porPag = Math.floor((base - TOPO - 30) / RH);
    const paginas = Math.max(1, ...rel.colunas.map(c => Math.ceil(c.linhas.length / porPag)));
    let pg = 0;
    for (let p = 0; p < paginas; p++) {
      cab(++pg);
      rel.colunas.forEach((c, i) => {
        const x = M + i * (cw + GAP); let y = TOPO;
        doc.text(c.titulo + (p ? ' (cont.)' : ''), x, y + 8, 10.5, '#111111', true); y += 14;
        // larguras: posição 26, nome resto, números 34 cada
        const nNum = c.cab.length - 2, wNum = 34, wNome = cw - 26 - nNum * wNum;
        doc.rect(x, y, cw, 13, LAR);
        doc.text(c.cab[1], x + 28, y + 9.3, 8, '#ffffff', true);
        c.cab.slice(2).forEach((h, k) => doc.text(h, x + 26 + wNome + (k + 1) * wNum - 4, y + 9.3, 8, '#ffffff', true, 'r'));
        y += 13;
        c.linhas.slice(p * porPag, (p + 1) * porPag).forEach(l => {
          if (l[0] === 1) doc.rect(x, y, cw, RH, OURO);
          const b = l[0] === 1;
          doc.text(l[0] + 'º', x + 3, y + 8.2, 8.5, '#555555', b);
          doc.text(corta(l[1], 8.5, wNome - 4, b), x + 28, y + 8.2, 8.5, '#111111', b);
          l.slice(2).forEach((v, k) => doc.text(v, x + 26 + wNome + (k + 1) * wNum - 4, y + 8.2, 8.5, '#111111', b, 'r'));
          doc.line(x, y + RH, x + cw, y + RH, CINZA);
          y += RH;
        });
        if (!c.linhas.length && p === 0) doc.text('—', x + 28, y + 9, 9, '#888888');
      });
    }
    (rel.extras || []).forEach(ex => {
      if (!ex.linhas.length) return;
      cab(++pg);
      let y = TOPO; doc.text(ex.titulo, M, y + 8, 11, '#111111', true); y += 14;
      const tot = W - 2 * M, ws = ex.larguras.map(f => f * tot);
      const linhaTab = (vals, cor, bold, txt) => {
        let x = M; const altura = Math.max(...vals.map((v, k) => quebra(v, 8.2, ws[k] - 6, bold).length)) * 10 + 4;
        if (cor) doc.rect(M, y, tot, altura, cor);
        vals.forEach((v, k) => { quebra(v, 8.2, ws[k] - 6, bold).forEach((ln, q) => doc.text(ln, x + 3, y + 10 + q * 10, 8.2, txt, bold)); x += ws[k]; });
        y += altura; doc.line(M, y, M + tot, y, CINZA);
      };
      linhaTab(ex.cab, LAR, true, '#ffffff');
      ex.linhas.forEach(l => { if (y > base - 40) { cab(++pg); y = TOPO; linhaTab(ex.cab, LAR, true, '#ffffff'); } linhaTab(l, null, false, '#111111'); });
    });
    return doc.build(img);
  }
  function quebra(t, sz, max, bold) {
    const out = []; let cur = '';
    String(t).split(' ').forEach(w => { const tt = cur ? cur + ' ' + w : w; if (larg(tt, sz, bold) > max && cur) { out.push(cur); cur = w; } else cur = tt; });
    out.push(cur); return out;
  }
  return { relatorio };
})();
