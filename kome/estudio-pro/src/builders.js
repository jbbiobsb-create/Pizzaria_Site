/* ==========================================================================
   Pixxel Estúdio — builders.js  (Construtores: Casa, Máquina, Rua & chão, Coisas da rua)
   Tudo desenhado com o E.Pix da engine (mesmo contorno 4-vizinhos e luz/sombra
   do estilo Kome). Cada construtor tem parâmetros, presets, prévia com o Kome
   do lado pra escala, e gera um desenho com quadros e tags prontos.
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, E = S.E, { h, clamp } = S;

  /* ---------------- cores ---------------- */
  const hx = c => S.hex2c(c);
  function tone(hex, k) { // k<0 escurece puxando pro frio; k>0 clareia puxando pro quente
    const c = hx(hex), [h0, s0, v0] = S.rgb2hsv(S.R(c), S.G(c), S.B(c));
    const toward = k < 0 ? 250 : 50, dh = ((toward - h0 + 540) % 360) - 180, a = Math.abs(k);
    const nh = (h0 + dh * a * 0.22 + 360) % 360, ns = clamp(s0 + (k < 0 ? 0.1 : -0.15) * a, 0, 1), nv = clamp(k < 0 ? v0 * (1 - 0.5 * a) : v0 + (1 - v0) * 0.6 * a, 0, 1);
    return S.c2hex(S.pack(...S.hsv2rgb(nh, ns, nv), 255));
  }
  const rnd = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; };
  const hash2 = (x, y, s) => { let n = (x * 374761393 + y * 668265263 + s * 982451653) | 0; n = (n ^ (n >>> 13)) * 1274126177 | 0; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const pixBuf = (P, outline) => { const cv = P.canvas(outline !== false); return { buf: S.fromCanvas(cv), w: cv.width, h: cv.height }; };

  /* ======================================================================
     CASA
     ====================================================================== */
  const CASA = {
    id: 'casa', nome: 'Casa',
    params: [
      ['estilo', 'estilo', 'select', { castelo: 'castelo japonês', japonesa: 'japonesa', sobrado: 'sobrado japonês', loja: 'loja com noren', chale: 'chalé', celeiro: 'celeiro', templo: 'templo', moderna: 'moderna' }],
      ['largura', 'largura', 'range', 36, 200, 2], ['andares', 'andares', 'range', 1, 5, 1], ['janelas', 'janelas por andar', 'range', 0, 5, 1],
      ['beiral', 'beiral do telhado', 'range', 0, 10, 1], ['res', 'resolução', 'select', { 1: '1× (jogo)', 2: '2× detalhado' }],
      ['parede', 'parede', 'color'], ['madeira', 'madeira', 'color'], ['telhado', 'telhado', 'color'], ['porta', 'porta', 'color'], ['detalhe', 'pano / detalhe', 'color'],
      ['chamine', 'chaminé com fumaça', 'check'], ['lanterna', 'lanterna na porta', 'check'], ['plantas', 'vasos de planta', 'check'], ['cerca', 'cerquinha', 'check'], ['placa', 'placa', 'check'], ['varanda', 'varanda', 'check'],
    ],
    presets: {
      'Casa japonesa': { estilo: 'japonesa', largura: 64, andares: 1, janelas: 2, beiral: 6, parede: '#F6EEDC', madeira: '#7A5228', telhado: '#3F5E92', porta: '#A9763F', detalhe: '#C8423A', lanterna: true, plantas: true },
      'Sobrado': { estilo: 'sobrado', largura: 72, andares: 2, janelas: 3, beiral: 5, parede: '#EFE2C4', madeira: '#5A3A22', telhado: '#3A332D', porta: '#7A5228', detalhe: '#3F7FA6', varanda: true, plantas: true },
      'Lojinha de onigiri': { estilo: 'loja', largura: 70, andares: 1, janelas: 1, beiral: 6, parede: '#FFFAEE', madeira: '#7A5228', telhado: '#93302A', porta: '#A9763F', detalhe: '#3F5E92', lanterna: true, placa: true },
      'Chalé': { estilo: 'chale', largura: 56, andares: 1, janelas: 2, beiral: 4, parede: '#E9D3A8', madeira: '#7A5228', telhado: '#C8423A', porta: '#5D7A40', detalhe: '#F4B8C5', chamine: true, cerca: true, plantas: true },
      'Celeiro de arroz': { estilo: 'celeiro', largura: 80, andares: 1, janelas: 1, beiral: 3, parede: '#B9652A', madeira: '#7A5228', telhado: '#77705F', porta: '#8A4A1E', detalhe: '#FFFAEE' },
      'Templo': { estilo: 'templo', largura: 110, andares: 2, janelas: 2, beiral: 10, parede: '#FFFAEE', madeira: '#C8423A', telhado: '#3A332D', porta: '#93302A', detalhe: '#E3BC62', lanterna: true },
      'Castelo japonês': { estilo: 'castelo', largura: 110, andares: 4, janelas: 3, beiral: 8, parede: '#FFFAEE', madeira: '#3A332D', telhado: '#3F4A5A', porta: '#5A3A22', detalhe: '#E3BC62', lanterna: false },
      'Castelo de ouro': { estilo: 'castelo', largura: 120, andares: 5, janelas: 3, beiral: 9, parede: '#FFF3C4', madeira: '#3A332D', telhado: '#3A332D', porta: '#93302A', detalhe: '#F3C94A' },
      'Casa moderna': { estilo: 'moderna', largura: 70, andares: 2, janelas: 2, beiral: 1, parede: '#E3E8EE', madeira: '#3A332D', telhado: '#5A524A', porta: '#C8423A', detalhe: '#7F9E5C', plantas: true, varanda: true },
    },
    anims: p => p.chamine ? [['dia', 1], ['noite', 1], ['fumaca', 6]] : [['dia', 1], ['noite', 1]],
    draw(p, tag, k) {
      if (p.estilo === 'castelo') return drawCastle(p, tag, k);
      const st = p._stage || 9;
      const r = +p.res || 1, X = v => Math.round(v * r);
      const W = p.largura, fl = Math.min(3, p.andares), fh = p.estilo === 'templo' ? 26 : 22, roofH = p.estilo === 'chale' || p.estilo === 'celeiro' ? 22 : p.estilo === 'moderna' ? 4 : 14, eave = p.beiral;
      const Wt = W + eave * 2 + 8, Ht = fl * fh + roofH + 14 + (p.chamine ? 12 : 0);
      const P = E.Pix(X(Wt), X(Ht)), night = tag === 'noite';
      const R2 = (x, y, w, hh, c) => P.rect(X(x), X(y), Math.max(1, X(w)), Math.max(1, X(hh)), c);
      const x0 = eave + 4, x1 = x0 + W, gy = Ht - 1;
      const wall = p.parede, wallS = tone(wall, -0.25), wood = p.madeira, woodS = tone(wood, -0.3), roof = p.telhado, roofS = tone(roof, -0.35), roofL = tone(roof, 0.25);
      const glass = night ? '#FFD36B' : '#A8D8EA', glassS = night ? '#F3C94A' : '#6FAECB';
      // fundação
      R2(x0 - 1, gy - 3, W + 2, 3, '#A39C8C'); R2(x0 - 1, gy - 1, W + 2, 1, '#77705F');
      for (let f = 0; f < fl; f++) {
        const fy = gy - 3 - (f + 1) * fh, inset = (p.estilo === 'sobrado' || p.estilo === 'templo') ? f * 3 : 0, wx0 = x0 + inset, ww = W - inset * 2;
        R2(wx0, fy, ww, fh, wall); R2(wx0, fy + fh - 2, ww, 2, wallS);
        if (p.estilo === 'celeiro') for (let x = wx0; x < wx0 + ww; x += 4) R2(x, fy, 1, fh, tone(wall, -0.2));
        if (p.estilo === 'moderna') { R2(wx0, fy, ww, 2, tone(wall, -0.1)); }
        else if (p.estilo !== 'celeiro') { // pilares e viga de madeira
          R2(wx0, fy, 2, fh, wood); R2(wx0 + ww - 2, fy, 2, fh, wood); R2(wx0, fy, ww, 2, wood);
          for (let x = wx0 + 18; x < wx0 + ww - 10; x += 18) R2(x, fy, 1, fh, woodS);
        }
        // janelas
        const nw = p.janelas, doorW = f === 0 ? (p.estilo === 'loja' ? Math.min(30, ww * 0.45) : p.estilo === 'celeiro' ? 18 : 9) : 0;
        const slots = []; const free0 = wx0 + 4, free1 = wx0 + ww - 4; const dX = wx0 + ww / 2 - doorW / 2;
        for (let i = 0; i < nw; i++) { const t = (i + 0.5) / nw, cx = free0 + (free1 - free0) * t; if (f === 0 && Math.abs(cx - (dX + doorW / 2)) < doorW / 2 + 6) continue; slots.push(cx); }
        for (const cx of (st >= 3 ? slots : [])) {
          const ww2 = p.estilo === 'moderna' ? 12 : 9, wh = p.estilo === 'moderna' ? 9 : 8, wxx = cx - ww2 / 2, wy = fy + 6;
          R2(wxx - 1, wy - 1, ww2 + 2, wh + 2, wood); R2(wxx, wy, ww2, wh, glass); R2(wxx, wy + wh - 2, ww2, 2, glassS);
          if (p.estilo === 'japonesa' || p.estilo === 'sobrado' || p.estilo === 'templo') { R2(wxx, wy + wh / 2, ww2, 1, woodS); for (let x = wxx + 3; x < wxx + ww2; x += 3) R2(x, wy, 1, wh, woodS); }
          else { R2(wxx + ww2 / 2, wy, 1, wh, wood); R2(wxx, wy + wh / 2, ww2, 1, wood); }
          if (!night) R2(wxx + 1, wy + 1, 2, 1, '#FFFFFF');
          if (p.plantas && f > 0 && !p.varanda) { R2(wxx - 1, wy + wh + 1, ww2 + 2, 2, wood); R2(wxx, wy + wh - 1, 2, 2, '#7F9E5C'); R2(wxx + ww2 - 3, wy + wh - 1, 2, 2, '#F4B8C5'); }
        }
        if (f === 0 && st >= 3) { // porta
          const dy = fy + fh - 15, dh = 15;
          if (p.estilo === 'loja') { R2(dX, fy + 6, doorW, fh - 6, '#3A332D'); R2(dX + 2, fy + 8, doorW - 4, fh - 8, night ? '#F3C94A' : '#6B5038'); for (let i = 0; i < 4; i++) { const nx = dX + i * doorW / 4; R2(nx + 0.5, fy + 5, doorW / 4 - 1, 8, p.detalhe); } R2(dX + doorW / 2 - 2, fy + 7, 4, 4, '#FFFAEE'); R2(dX - 3, fy + fh - 7, 8, 5, wood); R2(dX - 2, fy + fh - 9, 6, 2, '#FFFAEE'); }
          else if (p.estilo === 'celeiro') { R2(dX, dy - 4, doorW, dh + 4, p.porta); P.line(X(dX), X(dy - 4), X(dX + doorW), X(gy - 3), Math.max(1, r), tone(p.porta, -0.3)); P.line(X(dX + doorW), X(dy - 4), X(dX), X(gy - 3), Math.max(1, r), tone(p.porta, -0.3)); }
          else { R2(dX - 1, dy - 1, doorW + 2, dh + 1, wood); R2(dX, dy, doorW, dh, p.porta); R2(dX, dy, doorW, 1, tone(p.porta, -0.3)); if (p.estilo === 'japonesa' || p.estilo === 'templo') { R2(dX + doorW / 2, dy, 1, dh, tone(p.porta, -0.3)); } R2(dX + doorW - 3, dy + dh / 2, 1, 2, '#E3BC62'); }
          if (p.lanterna) { const lx = dX + doorW + 3, ly = fy + 6; R2(lx + 1, ly - 2, 1, 2, woodS); P.ell(X(lx + 1.5), X(ly + 3), X(2.4), X(3), night ? '#FFB347' : '#C8423A'); R2(lx, ly, 3, 1, '#3A332D'); R2(lx, ly + 5, 3, 1, '#3A332D'); }
          if (p.plantas) { for (const px of [x0 + 1, x1 - 7]) { R2(px, gy - 9, 6, 5, '#B9652A'); P.ell(X(px + 3), X(gy - 11), X(3.5), X(3), '#7F9E5C'); P.set(X(px + 2), X(gy - 13), '#F4B8C5'); } }
        }
        if (p.varanda && f > 0 && st >= 4) { R2(wx0 - 2, fy + fh - 4, ww + 4, 1, wood); for (let x = wx0 - 2; x < wx0 + ww + 2; x += 3) R2(x, fy + fh - 8, 1, 4, wood); R2(wx0 - 2, fy + fh - 8, ww + 4, 1, wood); }
        // beiral entre andares
        if (f < fl - 1 && (p.estilo === 'sobrado' || p.estilo === 'templo' || p.estilo === 'japonesa')) { const ey = fy - 1; P.poly([[X(wx0 - eave * 0.7), X(ey + 2)], [X(wx0 + 2), X(ey - 4)], [X(wx0 + ww - 2), X(ey - 4)], [X(wx0 + ww + eave * 0.7), X(ey + 2)]], roof); R2(wx0 - eave * 0.7, ey + 1, ww + eave * 1.4, 1, roofS); }
      }
      // telhado
      const topY = gy - 3 - fl * fh, insetTop = (p.estilo === 'sobrado' || p.estilo === 'templo') ? (fl - 1) * 3 : 0, rx0 = x0 + insetTop - eave, rx1 = x1 - insetTop + eave;
      if (st < 2) { /* sem telhado ainda (guia) */ } else if (p.estilo === 'chale' || p.estilo === 'celeiro') {
        const peak = topY - roofH, mid = (rx0 + rx1) / 2;
        P.poly([[X(rx0), X(topY + 1)], [X(mid), X(peak)], [X(rx1), X(topY + 1)]], roof);
        for (let y = peak + 4; y < topY; y += 3) { const t = (y - peak) / (topY - peak); P.rect(X(mid - (mid - rx0) * t + 1), X(y), X((mid - rx0) * t * 2 - 2), Math.max(1, r), roofS); }
        P.line(X(rx0), X(topY + 1), X(mid), X(peak), Math.max(1, r), roofL);
        if (p.estilo === 'celeiro') { R2(mid - 5, peak + 7, 10, 7, '#3A332D'); R2(mid - 4, peak + 8, 8, 5, p.detalhe); }
      } else if (p.estilo === 'moderna') {
        R2(rx0, topY - 4, rx1 - rx0, 4, roof); R2(rx0, topY - 1, rx1 - rx0, 1, roofS);
      } else {
        const up = p.estilo === 'templo' ? 4 : 2;
        P.poly([[X(rx0), X(topY + 1)], [X(rx0 + eave + 2), X(topY - roofH + 3)], [X(rx1 - eave - 2), X(topY - roofH + 3)], [X(rx1), X(topY + 1)]], roof);
        P.tri(X(rx0 - up), X(topY - up), X(rx0 + 4), X(topY + 1), X(rx0), X(topY + 1), roof); P.tri(X(rx1 + up), X(topY - up), X(rx1 - 4), X(topY + 1), X(rx1), X(topY + 1), roof);
        for (let y = topY - roofH + 6; y < topY; y += 3) R2(rx0 + 3, y, rx1 - rx0 - 6, 1, roofS);
        R2(rx0 + eave + 1, topY - roofH + 1, rx1 - rx0 - eave * 2 - 2, 3, roofS); R2(rx0 + eave, topY - roofH + 1, 3, 3, roofL); R2(rx1 - eave - 3, topY - roofH + 1, 3, 3, roofL);
        R2(rx0, topY, rx1 - rx0, 1, roofS);
        if (p.estilo === 'templo') { R2((rx0 + rx1) / 2 - 1, topY - roofH - 3, 2, 4, p.detalhe); }
      }
      if (p.placa && st >= 4) { const sx = (x0 + x1) / 2 - 12, sy = topY - 2 - (p.estilo === 'loja' ? 0 : 0); R2(sx, sy - 6, 24, 7, wood); R2(sx + 1, sy - 5, 22, 5, '#FFFAEE'); for (let i = 0; i < 4; i++) R2(sx + 3 + i * 5, sy - 4, 3, 3, p.detalhe); }
      if (p.chamine && st >= 4) { const cx = x1 - insetTop - 14, cy = topY - roofH * 0.55; R2(cx, cy - 8, 5, 10, '#A39C8C'); R2(cx - 1, cy - 9, 7, 2, '#77705F');
        if (tag === 'fumaca' || tag === 'noite' || tag === 'dia') { const n = tag === 'fumaca' ? 3 : 1; for (let i = 0; i < n; i++) { const t = ((k / 6) + i / 3) % 1, sx = cx + 2.5 + Math.sin(t * 6) * 2 + t * 4, sy = cy - 11 - t * 10, rr = 1.6 + t * 2.4; if (tag !== 'fumaca' && i > 0) continue; P.ell(X(sx), X(sy), X(rr), X(rr * 0.85), t > 0.6 ? '#D8D2C6' : '#EFEBE4'); } } }
      if (p.cerca && st >= 4) { for (let x = 1; x < Wt - 1; x += 3) { if (x > x0 + W / 2 - 6 && x < x0 + W / 2 + 6) continue; R2(x, gy - 6, 2, 6, '#CF9E63'); } R2(1, gy - 4, x0 + W / 2 - 6, 1, '#A9763F'); R2(x0 + W / 2 + 6, gy - 4, Wt - x0 - W / 2 - 7, 1, '#A9763F'); }
      P.bevel(0.18, 0.15);
      return pixBuf(P);
    },
  };

  // castelo japonês (tenshu): muralha de pedra (ishigaki), andares que afinam, beirais curvados e shachihoko dourado
  function drawCastle(p, tag, k) {
    const r = +p.res || 1, X = v => Math.round(v * r), st = p._stage || 9, night = tag === 'noite';
    const W = p.largura, tiers = p.andares, base = 18, th = 18, roofH = 9, eave = p.beiral, Wt = W + 24 + eave * 2, Ht = base + tiers * (th + roofH) + 22;
    const P = E.Pix(X(Wt), X(Ht)), gy = Ht - 1, cx = Wt / 2, R2 = (x, y, w, hh, c) => P.rect(X(x), X(y), Math.max(1, X(w)), Math.max(1, X(hh)), c);
    const stone = '#A39C8C', stoneS = '#77705F', stoneL = '#CFC8B6', wall = p.parede, wallS = tone(wall, -0.2), wood = p.madeira, roof = p.telhado, roofS = tone(roof, -0.35), roofL = tone(roof, 0.25), gold = p.detalhe;
    // muralha
    const bw0 = W + 20, bw1 = W + 4; P.poly([[X(cx - bw0 / 2), X(gy)], [X(cx + bw0 / 2), X(gy)], [X(cx + bw1 / 2), X(gy - base)], [X(cx - bw1 / 2), X(gy - base)]], stone);
    for (let y = gy - base + 2; y < gy; y += 4) { const t = (gy - y) / base, half = (bw0 + (bw1 - bw0) * t) / 2; R2(cx - half + 1, y, half * 2 - 2, 1, stoneS); for (let x = cx - half + ((y / 4) % 2 ? 3 : 6); x < cx + half - 2; x += 7) R2(x, y - 3, 1, 3, stoneS); }
    R2(cx - bw1 / 2, gy - base, bw1, 1, stoneL);
    let y = gy - base;
    for (let i = 0; i < tiers; i++) {
      const tw = W * (1 - i * 0.16), x0 = cx - tw / 2;
      R2(x0, y - th, tw, th, wall); R2(x0, y - 4, tw, 4, wood); R2(x0, y - th, tw, 1, wallS);
      if (st >= 3) { const n = Math.max(1, Math.round(p.janelas * (1 - i * 0.2))); for (let j = 0; j < n; j++) { const wx = x0 + (j + 0.5) * tw / n - 2.5; R2(wx - 0.5, y - th + 4, 6, 7, wood); R2(wx + 0.5, y - th + 5, 4, 5, night ? '#FFD36B' : '#3A332D'); if (!night) R2(wx + 1, y - th + 5, 1, 1, '#808A96'); } }
      if (i === 0 && st >= 3) { R2(cx - 5, y - 13, 10, 13, wood); R2(cx - 4, y - 12, 8, 12, p.porta); R2(cx, y - 12, 1, 12, tone(p.porta, -0.3)); }
      y -= th;
      if (st >= 2) {
        const ew = tw + eave * 2 - i * 2, ex0 = cx - ew / 2, top = i === tiers - 1;
        P.poly([[X(ex0), X(y + 1)], [X(ex0 + eave + 3), X(y - roofH + 2)], [X(ex0 + ew - eave - 3), X(y - roofH + 2)], [X(ex0 + ew), X(y + 1)]], roof);
        P.tri(X(ex0 - 3), X(y - 3), X(ex0 + 5), X(y + 1), X(ex0), X(y + 1), roof); P.tri(X(ex0 + ew + 3), X(y - 3), X(ex0 + ew - 5), X(y + 1), X(ex0 + ew), X(y + 1), roof);
        for (let q = y - roofH + 4; q < y; q += 2) R2(ex0 + 3, q, ew - 6, 1, roofS);
        R2(ex0, y, ew, 1, roofS); R2(ex0 + eave + 3, y - roofH + 2, ew - eave * 2 - 6, 1, roofL);
        if (!top && i % 2 === 0 && st >= 4) { P.tri(X(cx - 6), X(y - roofH + 2), X(cx + 6), X(y - roofH + 2), X(cx), X(y - roofH - 4), roof); R2(cx - 2, y - roofH - 1, 4, 3, wall); } // empena triangular (chidori)
        if (top && st >= 4) { R2(cx - ew / 2 + eave + 2, y - roofH - 1, 3, 4, gold); R2(cx + ew / 2 - eave - 5, y - roofH - 1, 3, 4, gold); P.set(X(cx - ew / 2 + eave + 2), X(y - roofH - 2), gold); P.set(X(cx + ew / 2 - eave - 3), X(y - roofH - 2), gold); }
        y -= roofH;
      }
    }
    if (p.lanterna && st >= 4) for (const lx of [cx - bw0 / 2 + 4, cx + bw0 / 2 - 7]) { R2(lx, gy - 8, 3, 8, '#A39C8C'); R2(lx - 1, gy - 10, 5, 2, '#77705F'); R2(lx, gy - 7, 3, 2, night ? '#FFD36B' : '#3A332D'); }
    P.bevel(0.18, 0.15);
    return pixBuf(P);
  }

  /* ======================================================================
     MÁQUINA
     ====================================================================== */
  function wheel(P, X, cx, cy, rr, ang, o) {
    o = o || {}; const tire = '#3A332D', tireL = '#5A524A', hub = o.hub || '#C3CBD4', hubS = '#808A96';
    P.ell(X(cx), X(cy), X(rr), X(rr), tire); P.ring(X(cx), X(cy), X(rr), Math.max(1, X(1)), tireL);
    const n = rr > 6 ? 10 : 6; for (let i = 0; i < n; i++) { const a = ang + i / n * Math.PI * 2; P.set(X(cx + Math.cos(a) * (rr - 0.6)), X(cy + Math.sin(a) * (rr - 0.6)), '#1E1A16'); }
    const hr = rr * 0.5; P.ell(X(cx), X(cy), X(hr), X(hr), hub); P.ell(X(cx + 0.4), X(cy + 0.4), X(hr * 0.6), X(hr * 0.6), hubS);
    for (let i = 0; i < 4; i++) { const a = ang * 1 + i * Math.PI / 2; P.set(X(cx + Math.cos(a) * hr * 0.7), X(cy + Math.sin(a) * hr * 0.7), '#E3E8EE'); }
    P.ell(X(cx), X(cy), Math.max(1, X(1)), Math.max(1, X(1)), o.cap || '#EDB93A');
  }
  function smoke(P, X, x, y, k, n) { for (let i = 0; i < 2; i++) { const t = ((k / n) + i / 2) % 1; P.ell(X(x + t * 5 + Math.sin(t * 7)), X(y - t * 9), X(1.3 + t * 2.2), X(1.2 + t * 1.9), t > 0.55 ? '#BDB6A8' : '#E3DED4'); } }
  const MAQ = {
    id: 'maquina', nome: 'Máquina',
    params: [
      ['tipo', 'tipo', 'select', { trator: 'trator', caminhao: 'caminhão basculante', escavadeira: 'escavadeira', empilhadeira: 'empilhadeira', carroca: 'carroça', caminhonete: 'caminhonete', rolo: 'rolo compressor' }],
      ['tamanho', 'tamanho', 'range', 0.7, 2, 0.05], ['roda', 'tamanho da roda', 'range', 0.6, 1.5, 0.05], ['res', 'resolução', 'select', { 1: '1× (jogo)', 2: '2× detalhado' }],
      ['pintura', 'pintura', 'color'], ['cabine', 'cabine / detalhe', 'color'], ['faixa', 'faixa', 'check'], ['fumaca', 'fumaça', 'check'], ['farol', 'farol aceso', 'check'],
    ],
    presets: {
      'Trator vermelho': { tipo: 'trator', tamanho: 1, roda: 1, pintura: '#C8423A', cabine: '#EDB93A', fumaca: true },
      'Caminhão de arroz': { tipo: 'caminhao', tamanho: 1.1, roda: 1, pintura: '#EDB93A', cabine: '#3F5E92', faixa: true, fumaca: true },
      'Escavadeira': { tipo: 'escavadeira', tamanho: 1.1, roda: 1, pintura: '#EDB93A', cabine: '#3A332D', fumaca: true },
      'Empilhadeira': { tipo: 'empilhadeira', tamanho: 0.9, roda: 1, pintura: '#E2742E', cabine: '#3A332D' },
      'Carroça': { tipo: 'carroca', tamanho: 1, roda: 1.1, pintura: '#A9763F', cabine: '#D8C49A' },
      'Caminhonete': { tipo: 'caminhonete', tamanho: 1, roda: 0.9, pintura: '#7F9E5C', cabine: '#FFFAEE', farol: true },
      'Rolo compressor': { tipo: 'rolo', tamanho: 1.1, roda: 1, pintura: '#EDB93A', cabine: '#3A332D', fumaca: true },
    },
    anims: p => { const a = [['parado', 4], ['andar', 8]]; if (p.tipo === 'caminhao') a.push(['bascular', 8]); if (p.tipo === 'escavadeira') a.push(['cavar', 10]); if (p.tipo === 'empilhadeira') a.push(['levantar', 8]); return a; },
    draw(p, tag, k) {
      const r = +p.res || 1, sz = p.tamanho, X = v => Math.round(v * sz * r), t = p.tipo, n = tag === 'andar' ? 8 : tag === 'parado' ? 4 : 8;
      const Wt = t === 'caminhao' ? 92 : t === 'escavadeira' ? 100 : t === 'rolo' ? 72 : 70, Ht = t === 'escavadeira' ? 64 : t === 'empilhadeira' ? 60 : 50;
      const P = E.Pix(X(Wt), X(Ht)), gy = Ht - 1;
      const paint = p.pintura, paintS = tone(paint, -0.32), paintL = tone(paint, 0.3), cab = p.cabine, glass = '#A8D8EA', glassS = '#6FAECB', dark = '#3A332D';
      const R2 = (x, y, w, hh, c) => P.rect(X(x), X(y), Math.max(1, X(w)), Math.max(1, X(hh)), c);
      const RR = (x, y, w, hh, rr, c) => P.rrect(X(x), X(y), Math.max(1, X(w)), Math.max(1, X(hh)), X(rr), c);
      const bob = tag === 'andar' ? (k % 2 ? -1 : 0) : tag === 'parado' ? (k % 2 ? -0.5 : 0) : 0, ang = tag === 'andar' ? k / n * Math.PI * 2 : 0, wk = p.roda;
      const lamp = (x, y) => { R2(x, y, 2, 2, p.farol ? '#FFE68A' : '#E3E8EE'); if (p.farol) { P.dither(X(x + 2), X(y - 2), X(6), X(6), '#FFF1B8', '25'); } };
      if (t === 'trator') {
        const rw = 11 * wk, fw = 6.5 * wk, by = bob;
        RR(10, 22 + by, 44, 12, 3, paint); R2(10, 31 + by, 44, 3, paintS); RR(36, 18 + by, 20, 8, 2, paint); R2(37, 18 + by, 18, 2, paintL);
        for (let x = 44; x < 54; x += 2) R2(x, 21 + by, 1, 4, paintS);
        RR(12, 6 + by, 18, 17, 2, cab); R2(14, 8 + by, 13, 9, glass); R2(14, 15 + by, 13, 2, glassS); R2(15, 9 + by, 3, 1, '#FFFFFF'); R2(11, 5 + by, 20, 2, tone(cab, -0.3));
        R2(46, 8 + by, 2, 11, dark); R2(45, 7 + by, 4, 2, dark); if (p.fumaca) smoke(P, X, 47, 4 + by, k, n);
        lamp(54, 22 + by); if (p.faixa) R2(10, 27 + by, 44, 1, '#FFFAEE');
        wheel(P, X, 20, gy - rw, rw, ang); wheel(P, X, 52, gy - fw, fw, ang * rw / fw);
        P.arc(X(20), X(gy - rw), X(rw + 2), Math.PI, Math.PI * 2, Math.max(1, X(2)), paintS);
      } else if (t === 'caminhao' || t === 'caminhonete') {
        const pick = t === 'caminhonete', by = bob, tilt = tag === 'bascular' ? Math.sin(Math.min(1, k / 5) * Math.PI / 2) * 0.55 * (k < 7 ? 1 : 0.3) : 0, rw = 7.5 * wk;
        // carroceria / caçamba
        const bx0 = pick ? 6 : 6, bx1 = pick ? 40 : 58, byy = pick ? 22 : 12, bh = pick ? 10 : 20;
        const pts = [[bx0, byy + by], [bx1, byy + by], [bx1, byy + bh + by], [bx0, byy + bh + by]];
        const piv = [bx0, byy + bh + by], rot = ([x, y]) => [piv[0] + (x - piv[0]) * Math.cos(-tilt) - (y - piv[1]) * Math.sin(-tilt), piv[1] + (x - piv[0]) * Math.sin(-tilt) + (y - piv[1]) * Math.cos(-tilt)];
        P.poly(pts.map(rot).map(([x, y]) => [X(x), X(y)]), pick ? paint : '#8E949C');
        if (!pick) { const ins = [[bx0 + 2, byy + 2 + by], [bx1 - 2, byy + 2 + by], [bx1 - 2, byy + 5 + by], [bx0 + 2, byy + 5 + by]]; P.poly(ins.map(rot).map(([x, y]) => [X(x), X(y)]), '#D8C49A'); for (let i = 1; i < 5; i++) { const [a1, b1] = rot([bx0 + i * (bx1 - bx0) / 5, byy + by]), [a2, b2] = rot([bx0 + i * (bx1 - bx0) / 5, byy + bh + by]); P.line(X(a1), X(b1), X(a2), X(b2), Math.max(1, r), '#676D75'); } if (tilt > 0.05) for (let i = 0; i < 6; i++) { const q = (k * 0.17 + i * 0.13) % 1; P.ell(X(bx0 - 2 - q * 4), X(byy + bh + by - 2 + q * q * 12), X(1.2), X(1.2), '#FFFDF6'); } }
        R2(4, 32 + by, pick ? 52 : 80, 4, dark);
        // cabine
        const cx0 = pick ? 38 : 60; RR(cx0, 12 + by, 22, 22, 3, paint); R2(cx0 + 10, 14 + by, 10, 9, glass); R2(cx0 + 10, 21 + by, 10, 2, glassS); R2(cx0 + 11, 15 + by, 3, 1, '#FFFFFF'); R2(cx0 + 2, 15 + by, 6, 8, tone(paint, -0.15));
        RR(cx0 + 16, 22 + by, 10, 10, 2, paint); R2(cx0 + 24, 24 + by, 2, 6, paintS); lamp(cx0 + 24, 23 + by); R2(cx0, 30 + by, 26, 2, paintS);
        if (p.faixa) R2(cx0, 26 + by, 26, 1, cab);
        if (p.fumaca && !pick) { R2(cx0 - 2, 2 + by, 2, 14, dark); smoke(P, X, cx0 - 1, 0 + by, k, n); }
        wheel(P, X, pick ? 14 : 16, gy - rw, rw, ang); if (!pick) wheel(P, X, 32, gy - rw, rw, ang); wheel(P, X, cx0 + 14, gy - rw, rw, ang);
      } else if (t === 'escavadeira') {
        const by = bob, ph = tag === 'cavar' ? k / 10 * Math.PI * 2 : 0;
        // esteira
        RR(6, gy - 12, 54, 12, 6, dark); RR(8, gy - 10, 50, 8, 4, '#5A524A'); for (let i = 0; i < 5; i++) wheel(P, X, 13 + i * 10, gy - 6, 3.4, ang, { hub: '#808A96' });
        for (let x = 0; x < 54; x += 4) { const ox = (x + (tag === 'andar' ? k * 2 : 0)) % 54; R2(6 + ox, gy - 12, 2, 1, '#1E1A16'); R2(6 + ox, gy - 1, 2, 1, '#1E1A16'); }
        // corpo e cabine
        RR(8, gy - 26 + by, 46, 14, 3, paint); R2(8, gy - 15 + by, 46, 3, paintS); RR(30, gy - 42 + by, 20, 18, 2, paint); R2(33, gy - 40 + by, 14, 11, glass); R2(33, gy - 31 + by, 14, 2, glassS); R2(34, gy - 39 + by, 3, 1, '#FFFFFF'); RR(8, gy - 30 + by, 18, 6, 2, paintS);
        if (p.fumaca) { R2(14, gy - 36 + by, 2, 8, dark); smoke(P, X, 15, gy - 38 + by, k, n); }
        // braço: lança + braço + caçamba (ângulos animados)
        const a1 = -0.75 + Math.sin(ph) * 0.25, a2 = 1.25 + Math.sin(ph + 1) * 0.45, a3 = 0.9 + Math.sin(ph + 2) * 0.6;
        const sx = 50, sy = gy - 30 + by, L1 = 26, L2 = 20, ex = sx + Math.cos(a1) * L1, ey = sy + Math.sin(a1) * L1, wx = ex + Math.cos(a1 + a2) * L2, wy = ey + Math.sin(a1 + a2) * L2;
        P.line(X(sx), X(sy), X(ex), X(ey), X(5), paint); P.line(X(sx), X(sy + 1), X(ex), X(ey + 1), X(2), paintS); P.line(X(ex), X(ey), X(wx), X(wy), X(4), paint); P.ell(X(ex), X(ey), X(2), X(2), dark);
        const ba = a1 + a2 + a3; P.poly([[X(wx), X(wy)], [X(wx + Math.cos(ba) * 9), X(wy + Math.sin(ba) * 9)], [X(wx + Math.cos(ba + 1.3) * 7), X(wy + Math.sin(ba + 1.3) * 7)]], '#676D75');
        for (let i = 0; i < 3; i++) P.set(X(wx + Math.cos(ba) * 9 + Math.cos(ba + 1.57) * i * 1.5), X(wy + Math.sin(ba) * 9 + Math.sin(ba + 1.57) * i * 1.5), '#E3E8EE');
      } else if (t === 'empilhadeira') {
        const by = bob, lift = tag === 'levantar' ? Math.sin(k / 8 * Math.PI) * 22 : 0, rw = 6 * wk;
        RR(10, gy - 24 + by, 32, 16, 3, paint); R2(10, gy - 11 + by, 32, 3, paintS); RR(6, gy - 22 + by, 8, 12, 2, dark);
        P.line(X(14), X(gy - 24 + by), X(16), X(gy - 44 + by), X(2), dark); P.line(X(36), X(gy - 24 + by), X(34), X(gy - 44 + by), X(2), dark); R2(15, gy - 45 + by, 20, 2, dark);
        R2(20, gy - 36 + by, 8, 1, '#A8D8EA'); R2(18, gy - 28 + by, 10, 4, cab);
        R2(44, gy - 46, 3, 44, '#676D75'); R2(48, gy - 46, 2, 44, '#808A96');
        const fy = gy - 4 - lift; R2(46, fy - 8, 3, 8, '#C3CBD4'); R2(46, fy, 18, 2, '#C3CBD4');
        RR(50, fy - 9, 12, 9, 1, '#A9763F'); R2(50, fy - 5, 12, 1, '#7A5228'); R2(52, fy - 8, 2, 2, '#FFFAEE');
        wheel(P, X, 16, gy - rw, rw, ang); wheel(P, X, 38, gy - rw * 0.8, rw * 0.8, ang);
      } else if (t === 'carroca') {
        const rw = 10 * wk, by = bob;
        R2(8, 20 + by, 44, 12, paint); for (let x = 8; x < 52; x += 6) R2(x, 20 + by, 1, 12, tone(paint, -0.3)); R2(8, 20 + by, 44, 2, tone(paint, 0.25)); R2(8, 30 + by, 44, 2, tone(paint, -0.3));
        P.ell(X(18), X(16 + by), X(7), X(5), cab); P.ell(X(32), X(15 + by), X(8), X(6), cab); P.ell(X(44), X(17 + by), X(6), X(4), tone(cab, -0.15)); R2(14, 14 + by, 2, 2, '#B89E6C');
        P.line(X(52), X(28 + by), X(68), X(34), X(2), tone(paint, -0.3)); wheel(P, X, 30, gy - rw, rw, ang, { hub: '#A9763F', cap: '#7A5228' });
      } else { // rolo
        const by = bob, rr = 11 * wk;
        RR(22, 18 + by, 34, 16, 3, paint); RR(36, 6 + by, 18, 14, 2, cab); R2(39, 8 + by, 12, 7, glass); R2(40, 9 + by, 3, 1, '#FFFFFF');
        P.ell(X(14), X(gy - rr), X(rr), X(rr), '#8E949C'); P.ell(X(14), X(gy - rr), X(rr * 0.75), X(rr * 0.75), '#B4BAC2'); for (let i = 0; i < 4; i++) { const a = ang + i * Math.PI / 2; P.line(X(14), X(gy - rr), X(14 + Math.cos(a) * rr * 0.7), X(gy - rr + Math.sin(a) * rr * 0.7), Math.max(1, r), '#676D75'); }
        P.arc(X(14), X(gy - rr), X(rr + 2), Math.PI * 1.05, Math.PI * 1.95, X(2), paint); R2(12, gy - rr * 2 - 2, 12, 2, paint);
        wheel(P, X, 52, gy - 7 * wk, 7 * wk, ang); if (p.fumaca) { R2(28, 8 + by, 2, 10, dark); smoke(P, X, 29, 6 + by, k, n); }
      }
      P.bevel(0.2, 0.15);
      return pixBuf(P);
    },
  };

  /* ======================================================================
     RUA & CHÃO (tileset que emenda)
     ====================================================================== */
  const TILESET = {
    id: 'chao', nome: 'Rua & chão', tile: true,
    params: [['tile', 'tamanho do tile', 'select', { 16: '16×16', 24: '24×24', 32: '32×32' }], ['grama', 'grama', 'color'], ['terra', 'terra', 'color'], ['pedra', 'pedra', 'color'], ['tijolo', 'tijolo', 'color'], ['asfalto', 'asfalto', 'color'], ['madeira', 'madeira', 'color'], ['agua', 'água', 'color'], ['seed', 'variação', 'range', 1, 99, 1]],
    presets: { 'Kome (dia)': { tile: 16, grama: '#7F9E5C', terra: '#A9763F', pedra: '#A39C8C', tijolo: '#B9652A', asfalto: '#5A524A', madeira: '#CF9E63', agua: '#6FB3D2', seed: 3 }, 'Outono': { tile: 16, grama: '#C8823A', terra: '#8A4A1E', pedra: '#9C8E7A', tijolo: '#93302A', asfalto: '#4A4440', madeira: '#A9763F', agua: '#3F7FA6', seed: 7 }, 'Neve': { tile: 16, grama: '#E6EEF5', terra: '#8E949C', pedra: '#B4BAC2', tijolo: '#9C5A4A', asfalto: '#5A5F6B', madeira: '#A9763F', agua: '#A8D8EA', seed: 5 }, 'HD 32px': { tile: 32, grama: '#7F9E5C', terra: '#A9763F', pedra: '#A39C8C', tijolo: '#B9652A', asfalto: '#5A524A', madeira: '#CF9E63', agua: '#6FB3D2', seed: 3 } },
    NAMES: ['grama em cima', 'terra', 'terra com pedra', 'grama alta', 'flor', 'pedra em cima', 'pedra', 'tijolo', 'asfalto (rua)', 'faixa', 'calçada', 'meio-fio', 'plataforma madeira', 'tábuas', 'água em cima', 'água'],
    anims: () => [['parado', 1], ['agua', 4]],
    draw(p, tag, k) {
      const T = +p.tile, cols = 8, rows = 2, P = E.Pix(T * cols, T * rows), sd = p.seed | 0, q = T / 16;
      const tileAt = (i, fn) => { const ox = (i % cols) * T, oy = Math.floor(i / cols) * T; fn(ox, oy); };
      const noise = (ox, oy, base, d1, d2, dens, sc) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const n = hash2(Math.floor(x / (sc || 1)), Math.floor(y / (sc || 1)), sd); P.set(ox + x, oy + y, n < dens ? d1 : n > 1 - dens * 0.6 ? d2 : base); } };
      const G = p.grama, GS = tone(G, -0.3), GL = tone(G, 0.25), D = p.terra, DS = tone(D, -0.3), DL = tone(D, 0.2), ST = p.pedra, STS = tone(ST, -0.3), STL = tone(ST, 0.25);
      const grassTop = (ox, oy, under, uS, uL) => { noise(ox, oy, under, uS, uL, 0.08, q); for (let x = 0; x < T; x++) { const hgt = Math.round((3 + hash2(x, 1, sd) * 2.4) * q); for (let y = 0; y < hgt; y++) P.set(ox + x, oy + y, y === 0 ? GL : y >= hgt - 1 ? GS : G); if (hash2(x, 7, sd) > 0.8) P.set(ox + x, oy + hgt, GS); } };
      tileAt(0, (ox, oy) => grassTop(ox, oy, D, DS, DL));
      tileAt(1, (ox, oy) => noise(ox, oy, D, DS, DL, 0.1, q));
      tileAt(2, (ox, oy) => { noise(ox, oy, D, DS, DL, 0.1, q); const rr = rnd(sd + 2); for (let i = 0; i < 3; i++) { const x = ox + 2 + rr() * (T - 5), y = oy + 2 + rr() * (T - 5), s2 = (1.2 + rr()) * q; P.ell(x, y, s2 + 0.6, s2, ST); P.set(x - s2 * 0.4, y - s2 * 0.4, STL); P.set(x + s2 * 0.5, y + s2 * 0.4, STS); } });
      tileAt(3, (ox, oy) => { for (let x = 0; x < T; x += Math.max(1, q)) { const hg = (5 + hash2(x, 3, sd) * (T * 0.55)) | 0, lean = hash2(x, 4, sd) > 0.5 ? 1 : -1; P.line(ox + x, oy + T - 1, ox + x + lean * q, oy + T - hg, 1, hash2(x, 5, sd) > 0.5 ? G : GS); P.set(ox + x + lean * q, oy + T - hg, GL); } });
      tileAt(4, (ox, oy) => { const rr = rnd(sd + 4); for (let i = 0; i < 3; i++) { const x = ox + 3 + rr() * (T - 6), top = oy + T * 0.35 + rr() * T * 0.3, c = ['#F4B8C5', '#FFFAEE', '#EDB93A', '#B49BD6'][Math.floor(rr() * 4)]; P.line(x, oy + T - 1, x, top, 1, GS); P.set(x + 1, top + 3 * q, G); P.ell(x + .5, top, 1.6 * q, 1.4 * q, c); P.set(x, top, '#EDB93A'); } });
      tileAt(5, (ox, oy) => { tileStone(ox, oy); for (let x = 0; x < T; x++) { P.set(ox + x, oy, STL); P.set(ox + x, oy + 1, STL); } });
      function tileStone(ox, oy) { P.rect(ox, oy, T, T, STS); const rr = rnd(sd + 9), rowsN = 2; for (let r2 = 0; r2 < rowsN; r2++) { let x = r2 % 2 ? -T / 4 : 0; const y = r2 * T / 2; while (x < T) { const w = T / 2 + Math.floor((rr() - 0.5) * 4 * q); P.rrect(ox + Math.max(0, x) + 1, oy + y + 1, Math.min(w, T - Math.max(0, x)) - 2 + (x < 0 ? x : 0), T / 2 - 2, 2 * q, ST); P.rect(ox + Math.max(0, x) + 2, oy + y + 1, Math.max(1, Math.min(w - 4, T - x - 4)), 1, STL); x += w; } } }
      tileAt(6, tileStone);
      tileAt(7, (ox, oy) => { const B = p.tijolo, BS = tone(B, -0.3), BL = tone(B, 0.2); P.rect(ox, oy, T, T, '#D8C49A'); const bh = T / 4; for (let r2 = 0; r2 < 4; r2++) { const off = r2 % 2 ? T / 4 : 0; for (let x = -off; x < T; x += T / 2) { const x0 = Math.max(0, x), x1 = Math.min(T, x + T / 2) - 1; P.rect(ox + x0, oy + r2 * bh, x1 - x0, bh - 1, B); P.rect(ox + x0, oy + r2 * bh, x1 - x0, 1, BL); P.rect(ox + x0, oy + r2 * bh + bh - 2, x1 - x0, 1, BS); } } });
      const AS = p.asfalto, ASS = tone(AS, -0.25), ASL = tone(AS, 0.2);
      tileAt(8, (ox, oy) => noise(ox, oy, AS, ASS, ASL, 0.12, 1));
      tileAt(9, (ox, oy) => { noise(ox, oy, AS, ASS, ASL, 0.12, 1); P.rect(ox + T * 0.15, oy + T / 2 - q, T * 0.7, Math.max(2, 2 * q), '#FFF1B8'); });
      tileAt(10, (ox, oy) => { P.rect(ox, oy, T, T, '#CFC8B6'); P.rect(ox, oy, T, 1, '#E9E4D8'); P.rect(ox + T / 2, oy, 1, T, '#A39C8C'); P.rect(ox, oy + T / 2, T, 1, '#A39C8C'); });
      tileAt(11, (ox, oy) => { P.rect(ox, oy, T, T, AS); noise(ox, oy + T / 3, AS, ASS, ASL, 0.12, 1); P.rect(ox, oy, T, T / 3, '#CFC8B6'); P.rect(ox, oy + T / 3 - 2, T, 2, '#8E949C'); P.rect(ox, oy, T, 1, '#E9E4D8'); });
      const M = p.madeira, MS = tone(M, -0.3), ML = tone(M, 0.25);
      tileAt(12, (ox, oy) => { P.rect(ox, oy, T, Math.round(T * 0.35), M); P.rect(ox, oy, T, 1, ML); P.rect(ox, oy + Math.round(T * 0.35) - 1, T, 1, MS); P.rect(ox + 1, oy + Math.round(T * 0.35), 2 * q, T * 0.3, MS); P.rect(ox + T - 1 - 2 * q, oy + Math.round(T * 0.35), 2 * q, T * 0.3, MS); P.set(ox + T / 2, oy + 2 * q, MS); });
      tileAt(13, (ox, oy) => { for (let r2 = 0; r2 < 4; r2++) { const y = r2 * T / 4; P.rect(ox, oy + y, T, T / 4 - 1, M); P.rect(ox, oy + y, T, 1, ML); P.rect(ox, oy + y + T / 4 - 1, T, 1, MS); const j = (hash2(r2, 0, sd) * T) | 0; P.rect(ox + j, oy + y, 1, T / 4, MS); P.set(ox + (j + T / 3) % T, oy + y + 2 * q, MS); } });
      const W2 = p.agua, WS = tone(W2, -0.3), WL = tone(W2, 0.35), ph = tag === 'agua' ? k / 4 : 0;
      tileAt(14, (ox, oy) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const wv = Math.sin((x / T) * Math.PI * 2 * 2 + ph * Math.PI * 2) * 1.2 * q, top = 3 * q + wv; if (y < top) continue; P.set(ox + x, oy + y, y < top + 1 ? WL : (hash2(x + Math.floor(ph * 4) * 3, y, sd) > 0.92 ? WL : y > T * 0.7 ? WS : W2)); } });
      tileAt(15, (ox, oy) => { for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) { const n2 = hash2(((x + Math.floor(ph * T)) % T), y >> 1, sd + 5); P.set(ox + x, oy + y, n2 > 0.93 ? WL : n2 < 0.12 ? WS : W2); } });
      return pixBuf(P, false);
    },
  };

  /* ======================================================================
     COISAS DA RUA
     ====================================================================== */
  const PROPS = {
    id: 'props', nome: 'Coisas da rua',
    params: [['tipo', 'o quê', 'select', { poste: 'poste de luz', semaforo: 'semáforo', venda: 'máquina de venda', correio: 'caixa de correio', banco: 'banco', placa: 'placa', lixeira: 'lixeira', cone: 'cone', barril: 'barril', caixote: 'caixote', hidrante: 'hidrante' }], ['altura', 'tamanho', 'range', 0.6, 2.5, 0.05], ['cor', 'cor', 'color'], ['res', 'resolução', 'select', { 1: '1× (jogo)', 2: '2× detalhado' }]],
    presets: { 'Poste': { tipo: 'poste', altura: 1, cor: '#3A332D' }, 'Semáforo': { tipo: 'semaforo', altura: 1, cor: '#3A332D' }, 'Máquina de venda': { tipo: 'venda', altura: 1, cor: '#C8423A' }, 'Caixa de correio': { tipo: 'correio', altura: 1, cor: '#C8423A' }, 'Banco': { tipo: 'banco', altura: 1, cor: '#A9763F' }, 'Placa': { tipo: 'placa', altura: 1, cor: '#3F7FA6' }, 'Lixeira': { tipo: 'lixeira', altura: 1, cor: '#5D7A40' }, 'Cone': { tipo: 'cone', altura: 1, cor: '#E2742E' }, 'Barril': { tipo: 'barril', altura: 1, cor: '#A9763F' }, 'Caixote': { tipo: 'caixote', altura: 1, cor: '#CF9E63' }, 'Hidrante': { tipo: 'hidrante', altura: 1, cor: '#C8423A' } },
    anims: p => p.tipo === 'semaforo' ? [['ciclo', 6]] : p.tipo === 'poste' ? [['dia', 1], ['noite', 2]] : p.tipo === 'venda' ? [['parado', 4]] : [['parado', 1]],
    draw(p, tag, k) {
      const r = +p.res || 1, sz = p.altura, X = v => Math.round(v * sz * r), c = p.cor, cS = tone(c, -0.32), cL = tone(c, 0.3), t = p.tipo;
      const dims = { poste: [22, 64], semaforo: [20, 60], venda: [26, 42], correio: [16, 30], banco: [36, 18], placa: [26, 40], lixeira: [16, 20], cone: [14, 18], barril: [16, 20], caixote: [18, 16], hidrante: [14, 18] }[t];
      const P = E.Pix(X(dims[0]), X(dims[1])), W = dims[0], H = dims[1], gy = H - 1;
      const R2 = (x, y, w, hh, col) => P.rect(X(x), X(y), Math.max(1, X(w)), Math.max(1, X(hh)), col), RR = (x, y, w, hh, rr, col) => P.rrect(X(x), X(y), Math.max(1, X(w)), Math.max(1, X(hh)), X(rr), col);
      if (t === 'poste') { const lit = tag === 'noite'; R2(9, 8, 3, H - 9, c); R2(10, 8, 1, H - 9, cL); R2(7, gy - 3, 7, 3, cS); P.line(X(10), X(9), X(18), X(6), X(2), c); RR(14, 5, 8, 4, 1, c); R2(15, 9, 6, 2, lit ? '#FFE68A' : '#E3E8EE'); if (lit) { P.dither(X(13), X(11), X(10), X(14), k % 2 ? '#FFF1B8' : '#FFE68A', '25'); } }
      if (t === 'semaforo') { R2(9, 18, 2, H - 19, '#676D75'); RR(5, 2, 10, 22, 2, c); const on = ['#4FBF5A', '#4FBF5A', '#4FBF5A', '#F3C94A', '#E8473C', '#E8473C'][k % 6]; [['#E8473C', 6], ['#F3C94A', 12], ['#4FBF5A', 18]].forEach(([col, y]) => { P.ell(X(10), X(y), X(2.4), X(2.4), col === on ? col : tone(col, -0.6)); if (col === on) P.set(X(9), X(y - 1), '#FFFFFF'); }); R2(6, gy - 2, 8, 2, '#5A524A'); }
      if (t === 'venda') { RR(1, 1, 24, H - 2, 2, c); R2(3, 4, 20, 18, '#E3E8EE'); for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) { const col = ['#3F7FA6', '#E2742E', '#7F9E5C', '#F4B8C5', '#EDB93A', '#FFFAEE'][(row * 4 + i) % 6]; R2(4 + i * 5, 5 + row * 6, 3, 4, col); R2(4 + i * 5, 9 + row * 6, 3, 1, '#C3CBD4'); P.set(X(5 + i * 5), X(10 + row * 6), (k + i + row) % 4 === 0 ? '#E8473C' : '#4FBF5A'); } R2(4, 25, 12, 3, '#3A332D'); R2(18, 25, 4, 6, '#808A96'); R2(4, H - 10, 18, 5, '#3A332D'); R2(1, 1, 24, 2, cL); }
      if (t === 'correio') { RR(2, 2, 12, 20, 4, c); R2(2, 9, 12, 1, cS); R2(4, 11, 8, 2, '#3A332D'); R2(7, 22, 2, H - 23, '#3A332D'); R2(4, 4, 2, 4, cL); R2(4, 15, 8, 3, '#FFFAEE'); }
      if (t === 'banco') { R2(2, 6, W - 4, 3, c); R2(2, 6, W - 4, 1, cL); R2(2, 11, W - 4, 3, c); R2(2, 13, W - 4, 1, cS); R2(4, 9, 2, H - 10, '#3A332D'); R2(W - 6, 9, 2, H - 10, '#3A332D'); }
      if (t === 'placa') { R2(12, 16, 2, H - 17, '#808A96'); RR(2, 2, 22, 15, 2, c); R2(4, 4, 18, 11, cL); P.tri(X(8), X(13), X(13), X(5), X(18), X(13), '#FFFAEE'); }
      if (t === 'lixeira') { RR(2, 4, 12, H - 5, 2, c); R2(1, 3, 14, 3, cS); for (let x = 4; x < 14; x += 3) R2(x, 7, 1, H - 9, cS); R2(4, 9, 8, 3, '#FFFAEE'); }
      if (t === 'cone') { P.tri(X(7), X(1), X(2), X(gy - 2), X(12), X(gy - 2), c); R2(1, gy - 2, 12, 2, '#3A332D'); R2(4, 9, 6, 2, '#FFFAEE'); }
      if (t === 'barril') { RR(2, 1, 12, H - 2, 4, c); for (const y of [4, H / 2, H - 6]) R2(2, y, 12, 1, '#676D75'); R2(4, 2, 2, H - 4, cL); }
      if (t === 'caixote') { R2(1, 1, W - 2, H - 2, c); R2(1, 1, W - 2, 2, cL); R2(1, H - 3, W - 2, 2, cS); P.line(X(2), X(3), X(W - 3), X(H - 4), Math.max(1, r), cS); P.line(X(W - 3), X(3), X(2), X(H - 4), Math.max(1, r), cS); }
      if (t === 'hidrante') { RR(3, 4, 8, H - 6, 2, c); P.ell(X(7), X(4), X(4), X(3), c); R2(1, 8, 12, 3, cS); R2(2, gy - 2, 10, 2, cS); R2(5, 5, 1, H - 9, cL); }
      P.bevel(0.2, 0.15);
      return pixBuf(P);
    },
  };

  /* ======================================================================
     janela genérica dos construtores
     ====================================================================== */
  const ALL = { casa: CASA, maquina: MAQ, chao: TILESET, props: PROPS };

  /* ======================================================================
     VILA: cena inteira, cada coisa na sua camada (Céu, Morros, Chão, Casas, Árvores, Postes, Retoques)
     ====================================================================== */
  function captureNature(fn, w, hh) { const c = document.createElement('canvas'); c.width = w; c.height = hh; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; try { fn(g); } catch (e) { } return S.fromCanvas(c); }
  function placeBuf(dst, W, Hh, src, sw, sh, x, y) { for (let j = 0; j < sh; j++) for (let i = 0; i < sw; i++) { const v = src[j * sw + i], X2 = x + i, Y2 = y + j; if ((v >>> 24) && X2 >= 0 && Y2 >= 0 && X2 < W && Y2 < Hh) dst[Y2 * W + X2] = v; } }
  S.openVila = function (o) {
    o = Object.assign({ largura: 480, altura: 200, casas: 5, seed: 7, castelo: true, torii: true, noite: true, ceu: true }, o || {});
    const W = o.largura, Hh = o.altura, gy = Hh - 24, rr = rnd(o.seed), frames = o.noite ? 2 : 1, L = {};
    const lay = name => (L[name] = L[name] || Array.from({ length: frames }, () => new Uint32Array(W * Hh)));
    for (let f = 0; f < frames; f++) {
      const tod = f === 1 ? 0.95 : 0.35;
      if (o.ceu) lay('Céu')[f].set(captureNature(g => E.Nature.sky(g, W, Hh, { tod, stars: true }), W, Hh));
      lay('Morros')[f].set(captureNature(g => { E.Nature.hills(g, W, gy - 10, 0, { seed: o.seed, amp: 26, haze: 0.6, tod, parallax: 0.2 }); E.Nature.hills(g, W, gy, 0, { seed: o.seed + 3, amp: 16, haze: 0.2, tod, col: f ? '#3C5233' : '#8DB46A' }); }, W, Hh));
      // chão: tiles de grama
      const T = TILESET.draw(Object.assign({}, TILESET.presets['Kome (dia)'], { seed: o.seed }), 'parado', 0), chao = lay('Chão')[f];
      for (let x = 0; x < W; x += 16) for (let y = gy; y < Hh; y += 16) { const ti = y === gy ? 0 : 1, src = new Uint32Array(256); for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) src[j * 16 + i] = T.buf[j * T.w + ti * 16 + i]; placeBuf(chao, W, Hh, src, 16, 16, x, y); }
    }
    // casas (e castelo no fundo)
    const r2 = rnd(o.seed * 13 + 1), presets = Object.keys(CASA.presets).filter(n => !/Castelo|Templo|moderna/.test(n));
    if (o.castelo) { const pc = Object.assign({ res: 1 }, CASA.presets['Castelo japonês'], { largura: Math.min(130, W * 0.28), andares: 4 }); for (let f = 0; f < frames; f++) { const b = CASA.draw(pc, f ? 'noite' : 'dia', 0); placeBuf(lay('Castelo')[f], W, Hh, b.buf, b.w, b.h, Math.round(W * 0.62 - b.w / 2), gy - b.h + 4 - 10); } }
    let x = 6; const n = o.casas; for (let i = 0; i < n && x < W - 40; i++) {
      const pr = Object.assign({ res: 1 }, CASA.presets[presets[Math.floor(r2() * presets.length)]]); pr.largura = 44 + Math.floor(r2() * 30); pr.andares = Math.min(pr.andares, 2);
      const name = 'Casa ' + (i + 1); let bw = 0;
      for (let f = 0; f < frames; f++) { const b = CASA.draw(pr, f ? 'noite' : 'dia', 0); bw = b.w; placeBuf(lay(name)[f], W, Hh, b.buf, b.w, b.h, x, gy - b.h + 3); }
      x += bw - 2 + Math.floor(r2() * 10);
      if (r2() < 0.6 && x < W - 30) { const kind = ['sakura', 'round', 'pine', 'maple'][Math.floor(r2() * 4)], tx = x + 8; for (let f = 0; f < frames; f++) lay('Árvores')[f].set(mergeOver(lay('Árvores')[f], captureNature(g => { E.Nature.tod = f ? 0.95 : 0.35; E.Nature.tree(g, tx, gy + 2, { kind, s: 0.8, seed: i, shadow: false }); }, W, Hh))); x += 18; }
    }
    if (o.torii) for (let f = 0; f < frames; f++) lay('Torii')[f].set(mergeOver(lay('Torii')[f], captureNature(g => E.Nature.torii(g, W - 40, gy + 2, 0.8, { shadow: false }), W, Hh)));
    for (let f = 0; f < frames; f++) { const post = PROPS.draw(Object.assign({ res: 1 }, PROPS.presets['Poste']), f ? 'noite' : 'dia', 0); for (let px2 = 60; px2 < W; px2 += 150) placeBuf(lay('Postes')[f], W, Hh, post.buf, post.w, post.h, px2, gy - post.h + 2); }
    const order = ['Céu', 'Morros', 'Castelo', 'Chão'].concat(Object.keys(L).filter(k2 => /^Casa /.test(k2))).concat(['Árvores', 'Torii', 'Postes']);
    const d = S.newDoc(W, Hh, { name: 'Vila' }); d.frames = Array.from({ length: frames }, () => ({ dur: 600 }));
    d.layers = order.filter(k2 => L[k2]).map(k2 => S.newLayer(k2, { cels: L[k2].map(c => c.some(v => v >>> 24) ? c : null), kind: k2 === 'Céu' ? 'normal' : 'normal' })).concat([S.newLayer('Retoques', { cels: Array.from({ length: frames }, () => null) })]);
    d.cur = { f: 0, l: d.layers.length - 1 }; d.tags = frames > 1 ? [{ name: 'dia', from: 0, to: 0, dir: 'frente', cor: S.tagColor(0) }, { name: 'noite', from: 1, to: 1, dir: 'frente', cor: S.tagColor(1) }] : [];
    d.tile = { w: 16, h: 16 }; d.meta = { tipo: 'cenário', vila: o }; S.openDoc(d); S.setWorkspace('draw'); S.toast('Vila criada: ' + d.layers.length + ' camadas (cada casa separada)'); return d;
  };
  function mergeOver(a, b) { const o = a.slice(); for (let i = 0; i < o.length; i++) if (b[i] >>> 24) o[i] = b[i]; return o; }
  S.Builders = ALL;
  const state = {};
  function openBuilder(id, start) {
    const B = ALL[id]; let p = state[id] || Object.assign({ res: 1 }, Object.values(B.presets)[0]); if (start) p = Object.assign({}, p, start); state[id] = p;
    let raf = 0, last = 0, k = 0, tagI = 0, cache = null;
    const ov = h('div', { class: 'ov' }), box = h('div', { class: 'dlg lib' }), left = h('div', { class: 'cside' }), right = h('div', { class: 'cmain' }), pv = h('canvas', { width: 520, height: 260, class: 'cpv' }), info = h('div', { class: 'hint' }), tagsBox = h('div', { class: 'chips' });
    const close = () => { cancelAnimationFrame(raf); ov.remove(); };
    box.append(h('div', { class: 'dhead' }, h('b', null, 'Construtor: ' + B.nome), h('span', { class: 'hint' }, 'desenhado com o E.Pix da engine (contorno e luz do estilo Kome)'), h('span', { style: 'flex:1' }), h('button', { class: 'ib', onclick: close }, '×')), h('div', { class: 'cbody' }, left, right)); ov.appendChild(box); document.body.appendChild(ov);
    function buildLeft() {
      left.innerHTML = '';
      left.append(h('h4', null, 'Modelos'), h('div', { class: 'chips' }, ...Object.keys(B.presets).map(n => h('button', { class: 'chip', onclick: () => { p = state[id] = Object.assign({ res: p.res || 1 }, B.presets[n]); buildLeft(); refresh(); } }, n))));
      left.appendChild(h('h4', null, 'Ajustes'));
      for (const [key, label, type, a, b, st] of B.params) {
        let inp;
        if (type === 'select') inp = h('select', { onchange: e => { p[key] = e.target.value; refresh(); } }, ...Object.entries(a).map(([v, t]) => h('option', { value: v, selected: String(p[key]) === v }, t)));
        else if (type === 'range') inp = h('input', { type: 'range', min: a, max: b, step: st, value: p[key] != null ? p[key] : a, oninput: e => { p[key] = +e.target.value; refresh(); } });
        else if (type === 'color') inp = h('input', { type: 'color', value: p[key] || '#888888', oninput: e => { p[key] = e.target.value; refresh(); } });
        else inp = h('input', { type: 'checkbox', checked: !!p[key], onchange: e => { p[key] = e.target.checked; refresh(); } });
        left.appendChild(h('label', { class: 'crow' }, h('span', null, label), inp));
      }
    }
    function refresh() { const anims = B.anims(p); cache = anims.map(([tag, n]) => ({ tag, frames: Array.from({ length: n }, (_, i) => { const r = B.draw(p, tag, i); return { cv: S.toCanvas(r.buf, r.w, r.h), w: r.w, h: r.h }; }) })); tagI = Math.min(tagI, cache.length - 1); const f0 = cache[0].frames[0]; info.textContent = f0.w + '×' + f0.h + ' px · ' + anims.map(a => a[0] + ' (' + a[1] + ')').join(', ') + (B.tile ? ' · tiles: ' + B.NAMES.join(', ') : ''); tagsBox.innerHTML = ''; cache.forEach((c, i) => tagsBox.appendChild(h('button', { class: 'chip' + (i === tagI ? ' on' : ''), onclick: () => { tagI = i; refresh(); } }, c.tag))); }
    right.append(pv, info, tagsBox, h('div', { class: 'row' }, h('button', { class: 'tb big green', onclick: () => { make(); close(); } }, B.tile ? 'Criar tileset (pronto pro mapa)' : 'Criar desenho com as animações'), h('span', { class: 'hint' }, B.tile ? 'abre como desenho com grade de tiles; depois vá em "Mapa & jogo" e pinte a rua' : 'abre com tags e uma camada "Retoques" vazia por cima')));
    function loop(now) {
      if (now - last > 140) { last = now; k++; }
      const g = pv.getContext('2d'); g.imageSmoothingEnabled = false; const gy = pv.height - 24;
      try { E.Nature.sky(g, pv.width, pv.height, { tod: cache && cache[tagI].tag === 'noite' ? 0.95 : 0.35, t: now / 1000, stars: true }); } catch (e) { g.fillStyle = '#9FD3E8'; g.fillRect(0, 0, pv.width, pv.height); }
      if (cache) {
        const set = cache[tagI].frames, fr = set[k % set.length];
        if (B.tile) { const T = +p.tile, z = Math.max(1, Math.floor(Math.min(4, 480 / fr.w, 220 / fr.h))); g.drawImage(fr.cv, 10, 10, fr.w * z, fr.h * z); g.fillStyle = '#2A1A10'; g.font = 'bold 10px sans-serif'; B.NAMES.forEach((n, i) => { if (T * z >= 40) g.fillText(String(i + 1), 12 + (i % 8) * T * z, 20 + Math.floor(i / 8) * T * z); }); }
        else { g.fillStyle = '#8DB46A'; g.fillRect(0, gy, pv.width, 24); let z = 2; if (fr.w * z > pv.width - 110 || fr.h * z > pv.height - 34) z = Math.max(0.25, Math.min((pv.width - 110) / fr.w, (pv.height - 34) / fr.h)); g.imageSmoothingEnabled = z < 1; g.drawImage(fr.cv, Math.round(110 + (pv.width - 110) / 2 - fr.w * z / 2), Math.round(gy - fr.h * z + z), Math.round(fr.w * z), Math.round(fr.h * z)); g.imageSmoothingEnabled = false; try { E.drawShiba(g, 50, gy, 'wag', now / 1000, { scale: Math.max(1, z) }); } catch (e) { } g.fillStyle = '#2A1A10'; g.font = 'bold 11px sans-serif'; g.fillText(z >= 1 ? 'escala ' + z + '× (Kome do lado no mesmo zoom)' : 'reduzido pra caber', 8, 14); }
      }
      raf = requestAnimationFrame(loop);
    }
    function make() {
      const anims = B.anims(p), frames = [], tags = []; let W = 0, Hh = 0; const raw = [];
      anims.forEach(([tag, n], ti) => { const from = raw.length; for (let i = 0; i < n; i++) { const r = B.draw(p, tag, i); raw.push(r); W = Math.max(W, r.w); Hh = Math.max(Hh, r.h); } tags.push({ name: tag, from, to: raw.length - 1, dir: 'frente', cor: S.tagColor(ti) }); });
      raw.forEach(r => { const c = new Uint32Array(W * Hh), ox = Math.floor((W - r.w) / 2), oy = Hh - r.h; for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) c[(oy + y) * W + ox + x] = r.buf[y * r.w + x]; frames.push(c); });
      const nm = B.tile ? 'Tileset ' + (+p.tile) + 'px' : (Object.keys(B.presets).find(n => JSON.stringify(B.presets[n]) === JSON.stringify(Object.assign({}, B.presets[n], p))) || B.nome);
      const d = S.newDoc(W, Hh, { name: nm }); d.frames = frames.map(() => ({ dur: B.tile ? 220 : 120 })); d.layers = [S.newLayer(B.nome, { cels: frames }), S.newLayer('Retoques', { cels: frames.map(() => null) })]; d.cur = { f: 0, l: 1 }; d.tags = tags;
      if (B.tile) d.tile = { w: +p.tile, h: +p.tile }; else d.tile = { w: 16, h: 16 };
      const set = new Set(); frames.forEach(f => f.forEach(v => { if (v >>> 24) set.add(v >>> 0); })); d.pal = [...set].slice(0, 96);
      d.meta = { tipo: id === 'casa' ? 'construção' : id === 'maquina' ? 'veículo' : 'enfeite', builder: id, params: JSON.parse(JSON.stringify(p)), altura: Hh };
      S.openDoc(d); S.setWorkspace('draw'); if (B.tile && S.map) { S.map.tsId = d.id; } S.toast(nm + ': ' + frames.length + ' quadro(s), ' + tags.length + ' tag(s)');
    }
    buildLeft(); refresh(); raf = requestAnimationFrame(loop);
  }
  S.openBuilder = openBuilder;

  // hub "Construir"
  S.openBuildHub = function () {
    S.dialog('Construir', (box, close) => {
      const items = [['bicho', 'Bicho', 'cachorro, gato, urso, raposa, coelho, panda, tanuki, porco, lobo — nível Kome, com 9 animações', () => S.openCreature()], ['casa', 'Casa', 'japonesa, sobrado, loja, chalé, celeiro, templo, moderna — dia/noite e fumaça', () => openBuilder('casa')], ['maquina', 'Máquina', 'trator, caminhão basculante, escavadeira, empilhadeira, carroça, rolo — rodas girando e trabalho', () => openBuilder('maquina')], ['vila', 'Vila', 'cena inteira com castelo, casas, árvores, torii e postes — cada um na sua camada, dia e noite', () => S.openVila({ seed: 1 + Math.floor(Math.random() * 999) })], ['chao', 'Rua & chão', 'tileset que emenda: grama, terra, pedra, tijolo, asfalto, calçada, tábuas, água animada', () => openBuilder('chao')], ['props', 'Coisas da rua', 'poste, semáforo, máquina de venda, correio, banco, placa, lixeira, cone, barril…', () => openBuilder('props')]];
      const g = h('div', { class: 'hub' }); items.forEach(([id, t, d, fn]) => { const prev = h('canvas', { width: 120, height: 80 }); try { const pg = prev.getContext('2d'); pg.imageSmoothingEnabled = false; let r; if (id === 'bicho') { const b = S.Creature.render({ especie: 'gato', res: 1, cores: {} }, 'sentar', 1); r = { buf: b.buf, w: b.w, h: b.h }; } else if (id === 'vila') { const b = CASA.draw(Object.assign({ res: 1 }, CASA.presets['Castelo japonês']), 'dia', 0); r = b; } else { const B = ALL[id]; r = B.draw(Object.assign({ res: 1 }, Object.values(B.presets)[0]), B.anims(Object.values(B.presets)[0])[0][0], 0); } const cv = S.toCanvas(r.buf, r.w, r.h), z = Math.min(2, 110 / r.w, 74 / r.h); pg.imageSmoothingEnabled = z < 1; pg.drawImage(cv, (120 - r.w * z) / 2, (80 - r.h * z) / 2, r.w * z, r.h * z); } catch (e) { } g.appendChild(h('button', { class: 'hubitem', onclick: () => { close(); fn(); } }, prev, h('b', null, t), h('span', { class: 'hint' }, d))); });
      box.appendChild(g); return [];
    }, { wide: true });
  };
})();
