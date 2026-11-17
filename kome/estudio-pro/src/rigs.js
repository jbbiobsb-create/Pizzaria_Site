/* ==========================================================================
   Pixxel Estúdio — rigs.js  ("O que é isso?")
   Você desenha, escolhe o tipo (cachorro, casa, pessoa, peixe…) e o estúdio:
     1) acha as partes do desenho (patas, cabeça, rabo, braços, rodas, asas)
     2) cria as animações certas com tags (parado, andar, correr, pular…)
     3) põe na escala do jogo (altura em px ao lado do Kome) — você escolhe
   Cada parte anima por mapeamento inverso (sem buracos), na ordem certa de
   profundidade (rabo atrás, pata de trás, corpo, pata da frente, cabeça).
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio, { clamp, A } = S;

  /* ---------------- análise ---------------- */
  function analyze(buf, W, H) {
    const bb = S.bboxOf(buf, W, H); if (!bb) return null;
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (buf[y * W + x] >>> 24) > 40;
    const runs = y => { const r = []; let s = -1; for (let x = bb.x; x <= bb.x + bb.w; x++) { const o = x < bb.x + bb.w && on(x, y); if (o && s < 0) s = x; if (!o && s >= 0) { r.push([s, x - 1]); s = -1; } } return r; };
    const bot = bb.y + bb.h - 1;
    // patas: linhas de baixo pra cima enquanto houver vão (>=2 trechos), até 45% da altura
    let legTop = bot + 1;
    for (let y = bot; y >= bb.y + bb.h * 0.5; y--) { const r = runs(y).filter(q => q[1] - q[0] >= 0); if (r.length >= 2) legTop = y; else if (y < bot - 1) break; }
    let legs = [];
    if (legTop <= bot - 1) {
      // projeta colunas na faixa das patas
      const col = []; for (let x = bb.x; x < bb.x + bb.w; x++) { let n = 0; for (let y = legTop; y <= bot; y++) if (on(x, y)) n++; col.push(n > 0); }
      let s = -1; col.push(false); col.forEach((o, i) => { if (o && s < 0) s = i; if (!o && s >= 0) { legs.push({ x0: bb.x + s, x1: bb.x + i - 1 }); s = -1; } });
    }
    // lado da cabeça: o terço mais alto
    const topOf = (x0, x1) => { for (let y = bb.y; y <= bot; y++) for (let x = x0; x <= x1; x++) if (on(x, y)) return y; return bot; };
    const third = Math.max(1, Math.floor(bb.w / 3)), tl = topOf(bb.x, bb.x + third - 1), tr = topOf(bb.x + bb.w - third, bb.x + bb.w - 1);
    const facing = tl <= tr ? -1 : 1; // -1 = olha pra esquerda
    const cx = bb.x + bb.w / 2, cy = bb.y + bb.h / 2;
    return { bb, on, legs, legTop, bot, facing, cx, cy, W, H };
  }
  S.analyze = analyze;

  /* ---------------- partes ---------------- */
  function maskWhere(an, fn) { const { W, H, on } = an, m = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y) && fn(x, y)) m[y * W + x] = 1; return m; }
  function partsFor(an, kind) {
    const { bb, legs, legTop, facing } = an, P = {};
    const headSide = facing < 0 ? x => x < bb.x + bb.w * 0.38 : x => x > bb.x + bb.w * 0.62;
    const tailSide = facing < 0 ? x => x > bb.x + bb.w * 0.84 : x => x < bb.x + bb.w * 0.16;
    const legOf = (x, y) => { if (y < legTop) return -1; for (let i = 0; i < legs.length; i++) if (x >= legs[i].x0 && x <= legs[i].x1) return i; return -1; };
    if (kind === 'quad') {
      P.legs = legs.map((_, i) => maskWhere(an, (x, y) => legOf(x, y) === i));
      P.head = maskWhere(an, (x, y) => y < bb.y + bb.h * 0.62 && headSide(x) && legOf(x, y) < 0);
      P.tail = maskWhere(an, (x, y) => y < legTop && y < bb.y + bb.h * 0.8 && tailSide(x) && legOf(x, y) < 0);
      P.body = maskWhere(an, (x, y) => legOf(x, y) < 0 && !P.head[y * an.W + x] && !P.tail[y * an.W + x]);
    } else if (kind === 'biped') {
      const armBand = (y) => y > bb.y + bb.h * 0.28 && y < bb.y + bb.h * 0.66;
      P.legs = legs.map((_, i) => maskWhere(an, (x, y) => legOf(x, y) === i));
      P.armL = maskWhere(an, (x, y) => armBand(y) && x < bb.x + bb.w * 0.24 && legOf(x, y) < 0);
      P.armR = maskWhere(an, (x, y) => armBand(y) && x > bb.x + bb.w * 0.76 && legOf(x, y) < 0);
      P.head = maskWhere(an, (x, y) => y < bb.y + bb.h * 0.3 && !P.armL[y * an.W + x] && !P.armR[y * an.W + x]);
      P.body = maskWhere(an, (x, y) => legOf(x, y) < 0 && !P.armL[y * an.W + x] && !P.armR[y * an.W + x] && !P.head[y * an.W + x]);
    } else if (kind === 'wings') { // borboleta / pássaro de frente: metades
      P.wingL = maskWhere(an, (x) => x < an.cx - bb.w * 0.12); P.wingR = maskWhere(an, (x) => x > an.cx + bb.w * 0.12); P.body = maskWhere(an, (x) => x >= an.cx - bb.w * 0.12 && x <= an.cx + bb.w * 0.12);
    } else if (kind === 'vehicle') {
      // rodas: manchas escuras na faixa de baixo
      const dark = (x, y) => { const v = an.buf[y * an.W + x], l = 0.3 * (v & 255) + 0.59 * ((v >>> 8) & 255) + 0.11 * ((v >>> 16) & 255); return l < 90; };
      const band = bb.y + bb.h * 0.62, seen = new Uint8Array(an.W * an.H), wheels = [];
      for (let y = Math.floor(band); y < bb.y + bb.h; y++) for (let x = bb.x; x < bb.x + bb.w; x++) { if (seen[y * an.W + x] || !an.on(x, y) || !dark(x, y)) continue; const st = [x, y], pts = []; while (st.length) { const b = st.pop(), a = st.pop(); if (a < 0 || b < band || a >= an.W || b >= an.H || seen[b * an.W + a] || !an.on(a, b) || !dark(a, b)) continue; seen[b * an.W + a] = 1; pts.push([a, b]); st.push(a + 1, b, a - 1, b, a, b + 1, a, b - 1); } if (pts.length >= 4) { let sx = 0, sy = 0; pts.forEach(p => { sx += p[0]; sy += p[1]; }); const wx = sx / pts.length, wy = sy / pts.length, r = Math.sqrt(pts.length / Math.PI) + 0.8; wheels.push({ x: wx + 0.5, y: wy + 0.5, r }); } }
      P.wheels = wheels.map(w => maskWhere(an, (x, y) => Math.hypot(x + .5 - w.x, y + .5 - w.y) <= w.r)); P.wheelInfo = wheels;
      P.body = maskWhere(an, (x, y) => !P.wheels.some(m => m[y * an.W + x]));
    } else P.body = maskWhere(an, () => true);
    return P;
  }

  /* ---------------- warp: compõe as partes com transformações ---------------- */
  // layers = [{mask, inv(x,y)->[sx,sy] | null}] na ordem de trás pra frente
  function compose(buf, W, H, layers, margin) {
    const out = new Uint32Array(W * H), M = margin || 6;
    for (const L of layers) {
      if (!L.mask) continue; const bb = S.bboxOf(maskToBuf(L.mask), W, H); if (!bb) continue;
      for (let y = Math.max(0, bb.y - M); y < Math.min(H, bb.y + bb.h + M); y++) for (let x = Math.max(0, bb.x - M); x < Math.min(W, bb.x + bb.w + M); x++) {
        const s = L.inv(x + 0.5, y + 0.5); if (!s) continue; const sx = Math.floor(s[0]), sy = Math.floor(s[1]);
        if (sx < 0 || sy < 0 || sx >= W || sy >= H || !L.mask[sy * W + sx]) continue; const v = buf[sy * W + sx]; if (v >>> 24) out[y * W + x] = v;
      }
    }
    return out;
  }
  const mbufCache = new WeakMap();
  function maskToBuf(m) { let b = mbufCache.get(m); if (!b) { b = new Uint32Array(m.length); for (let i = 0; i < m.length; i++) if (m[i]) b[i] = 0xFF000000; mbufCache.set(m, b); } return b; }
  const T = (dx, dy) => (x, y) => [x - dx, y - dy];
  const rotAbout = (cx, cy, a, dx, dy) => { const c = Math.cos(-a), s = Math.sin(-a); dx = dx || 0; dy = dy || 0; return (x, y) => { x -= dx; y -= dy; const X = x - cx, Y = y - cy; return [cx + X * c - Y * s, cy + X * s + Y * c]; }; };
  const shearLeg = (top, bot, swing, lift, dy) => (x, y) => { const t = clamp((y - top) / Math.max(1, bot - top), 0, 1); const yy = y - (dy || 0) + (t > 0.6 ? lift : 0); return [x - swing * t, yy]; };
  const scaleAbout = (cx, cy, sx, sy, dx, dy) => (x, y) => [cx + (x - (dx || 0) - cx) / sx, cy + (y - (dy || 0) - cy) / sy];
  const centroid = (m, W) => { let sx = 0, sy = 0, n = 0; for (let i = 0; i < m.length; i++) if (m[i]) { sx += i % W; sy += (i / W) | 0; n++; } return n ? [sx / n + .5, sy / n + .5, n] : null; };
  // raiz do rabo: ponto do rabo mais perto do centro do corpo
  function rootOf(m, W, towardX, towardY) { let best = null, bd = 1e9; for (let i = 0; i < m.length; i++) if (m[i]) { const x = i % W + .5, y = ((i / W) | 0) + .5, d = Math.hypot(x - towardX, y - towardY); if (d < bd) { bd = d; best = [x, y]; } } return best; }

  /* ---------------- animações por família ---------------- */
  const S2 = Math.sin, TAU = Math.PI * 2;
  const FAM = {
    quad(buf, an, tag, k, n, amp) {
      const P = partsFor(an, 'quad'), W = an.W, ph = k / n * TAU, legs = P.legs, nl = legs.length;
      const bc = centroid(P.body, W) || [an.cx, an.cy], tr = rootOf(P.tail, W, bc[0], bc[1]) || [an.cx, an.cy];
      const hc = centroid(P.head, W) || [an.cx, an.cy];
      let bob = 0, hdy = 0, tailA = 0, swing = 0, lift = 0, hdx = 0, jump = 0, sq = 0;
      if (tag === 'parado') { bob = 0; hdy = Math.round(S2(ph) * 0.6 * amp / 2); tailA = S2(ph * 2) * 0.35; }
      if (tag === 'andar') { bob = (k % 2) ? -1 : 0; swing = 1.5 * amp; lift = 1; hdy = (k % 2) ? -1 : 0; tailA = S2(ph * 2) * 0.3; }
      if (tag === 'correr') { bob = Math.round(-Math.abs(S2(ph)) * 1.5 * amp / 2); swing = 2.6 * amp; lift = 2; hdy = bob; hdx = 0; tailA = -0.35 * an.facing; }
      if (tag === 'abanar') { tailA = S2(ph * 2) * 0.6; hdy = 0; }
      if (tag === 'pular') { const p = k / n; jump = -Math.round(Math.sin(p * Math.PI) * an.bb.h * 0.22 * amp / 2); sq = k === 0 ? 0.1 : 0; tailA = 0.3; swing = p < 0.5 ? 1.5 : -1.5; }
      if (tag === 'farejar') { hdy = Math.round(1 + S2(ph * 2) * 0.8); hdx = 0; tailA = S2(ph * 2) * 0.25; }
      const layers = [];
      if (P.tail) layers.push({ mask: P.tail, inv: rotAbout(tr[0], tr[1], tailA * -an.facing, 0, bob + jump) });
      // patas: pares diagonais alternados; as "de trás" desenhadas antes do corpo
      const legMove = i => { const pair = (i % 2) ? 1 : -1; const sgn = (i === 0 || i === nl - 1) ? pair : -pair; const s = tag === 'parado' || tag === 'abanar' || tag === 'farejar' ? 0 : Math.round(S2(ph) * swing * sgn); const lf = s * sgn * -an.facing > 0 ? lift : 0; return { mask: legs[i], inv: shearLeg(an.legTop, an.bot, s, lf, jump) }; };
      legs.forEach((_, i) => { if (i % 2 === 1) layers.push(legMove(i)); });
      layers.push({ mask: P.body, inv: scaleAbout(an.cx, an.bot, 1 + sq, 1 - sq, 0, bob + jump) });
      legs.forEach((_, i) => { if (i % 2 === 0) layers.push(legMove(i)); });
      layers.push({ mask: P.head, inv: T(hdx, bob + hdy + jump) });
      return compose(buf, W, an.H, layers);
    },
    biped(buf, an, tag, k, n, amp) {
      const P = partsFor(an, 'biped'), W = an.W, ph = k / n * TAU, legs = P.legs;
      const sh = an.bb.y + an.bb.h * 0.3, aL = centroid(P.armL, W), aR = centroid(P.armR, W);
      let bob = 0, swing = 0, arm = 0, jump = 0, wave = 0, sq = 0, hdy = 0;
      if (tag === 'parado') { const t = S2(ph); sq = t * 0.02 * amp; hdy = Math.round(t * 0.6); }
      if (tag === 'andar') { bob = (k % 2) ? -1 : 0; swing = 1.4 * amp; arm = 0.35; }
      if (tag === 'correr') { bob = Math.round(-Math.abs(S2(ph)) * 2); swing = 2.4 * amp; arm = 0.7; }
      if (tag === 'pular') { const p = k / n; jump = -Math.round(Math.sin(p * Math.PI) * an.bb.h * 0.2 * amp / 2); sq = k === 0 ? 0.1 : -0.04; arm = -0.6; }
      if (tag === 'acenar') { wave = 1; }
      const layers = [];
      const legL = i => ({ mask: legs[i], inv: shearLeg(an.legTop, an.bot, Math.round(S2(ph + (i % 2) * Math.PI) * swing), S2(ph + (i % 2) * Math.PI) > 0.3 && swing ? 1 : 0, jump) });
      legs.forEach((_, i) => layers.push(legL(i)));
      layers.push({ mask: P.body, inv: scaleAbout(an.cx, an.bot, 1 - sq * 0.5, 1 + sq, 0, bob + jump) });
      const armRot = (m, c, a) => m && c ? { mask: m, inv: rotAbout(c[0], sh, a, 0, bob + jump) } : null;
      const aa = S2(ph) * arm;
      if (wave) { layers.push(armRot(P.armL, aL, 0)); layers.push({ mask: P.armR, inv: aR ? rotAbout(aR[0] - 1, sh + 1, -2.2 - S2(ph * 2) * 0.4, 0, 0) : T(0, 0) }); }
      else { layers.push(armRot(P.armL, aL, aa)); layers.push(armRot(P.armR, aR, -aa)); }
      layers.push({ mask: P.head, inv: T(0, bob + jump + hdy) });
      return compose(buf, W, an.H, layers.filter(Boolean));
    },
    wings(buf, an, tag, k, n, amp) {
      const P = partsFor(an, 'wings'), ph = k / n * TAU, f = Math.max(0.15, Math.abs(Math.cos(ph))), bob = Math.round(S2(ph) * amp * 0.7);
      return compose(buf, an.W, an.H, [{ mask: P.wingL, inv: scaleAbout(an.cx - an.bb.w * 0.12, an.cy, f, 1, 0, bob) }, { mask: P.wingR, inv: scaleAbout(an.cx + an.bb.w * 0.12, an.cy, f, 1, 0, bob) }, { mask: P.body, inv: T(0, bob) }]);
    },
    vehicle(buf, an, tag, k, n, amp) {
      const P = partsFor(an, 'vehicle'), bob = tag === 'andar' ? ((k % 2) ? -1 : 0) : 0, layers = [{ mask: P.body, inv: T(0, bob) }];
      P.wheels.forEach((m, i) => { const w = P.wheelInfo[i]; layers.unshift({ mask: m, inv: rotAbout(w.x, w.y, tag === 'andar' ? -k / n * TAU * an.facing : 0) }); });
      return compose(buf, an.W, an.H, layers);
    },
    simple(buf, an, fx, k, n, amp) { return fx(buf, an, k, n, amp); },
  };
  // efeitos de corpo inteiro
  const whole = (fn) => (buf, an, k, n, amp) => compose(buf, an.W, an.H, [{ mask: partsFor(an, 'all').body, inv: fn(an, k, n, amp) }], 40);
  const FX = {
    respirar: whole((an, k, n, a) => { const t = S2(k / n * TAU) * 0.035 * a; return scaleAbout(an.cx, an.bot + 0.5, 1 - t * .5, 1 + t); }),
    quicar: whole((an, k, n, a) => { const p = k / n, hgt = Math.round(Math.abs(S2(p * Math.PI)) * an.bb.h * 0.16 * a), sq = [0.16, -0.08, -0.04, 0, -0.04, -0.08][Math.floor(p * 6)] * a / 2; return scaleAbout(an.cx, an.bot + 0.5, 1 + sq, 1 - sq, 0, -hgt); }),
    flutuar: whole((an, k, n, a) => T(0, Math.round(S2(k / n * TAU) * a))),
    vento: whole((an, k, n, a) => (x, y) => { const hh = clamp((an.bot - y) / an.bb.h, 0, 1); return [x - hh * hh * (S2(k / n * TAU) + 0.6) * a * Math.max(1, an.bb.h / 24), y]; }),
    nadar: whole((an, k, n, a) => (x, y) => [x, y - Math.round(S2((x - an.bb.x) / an.bb.w * TAU + k / n * TAU) * Math.max(1, an.bb.h / 14) * a / 2)]),
    girar: whole((an, k, n) => { const c = Math.cos(k / n * TAU), sx = Math.max(0.08, Math.abs(c)); return (x, y) => { let u = (x - an.cx) / sx; if (c < 0) u = -u; return [an.cx + u, y]; }; }),
    pulsar: whole((an, k, n, a) => { const t = 1 + Math.max(0, S2(k / n * TAU)) * 0.06 * a; return scaleAbout(an.cx, an.cy, t, t); }),
    tremer: whole((an, k) => { const d = [[0, 0], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1]][(k * 7 + 1) % 6]; return T(d[0], d[1]); }),
    crescer: whole((an, k, n) => { const t = [0.2, 0.5, 0.8, 1.08, 0.97, 1][Math.min(5, Math.round(k / (n - 1) * 5))]; return scaleAbout(an.cx, an.bot + 0.5, t, t); }),
    balancar: whole((an, k, n, a) => { const t = S2(k / n * TAU) * 0.1 * a; return (x, y) => [x + (an.bot - y) * t, y]; }),
    estatico: whole(() => T(0, 0)),
    chama: whole((an, k, n, a) => (x, y) => { const hh = clamp((an.bot - y) / an.bb.h, 0, 1); return [x - Math.round(S2(y * 0.7 + k * 2.1) * hh * a), y + (hh > .7 && k % 2 ? 1 : 0)]; }),
  };
  // pós-efeitos de cor
  function litWindows(buf) { const o = buf.slice(); for (let i = 0; i < o.length; i++) { const v = o[i]; if (!(v >>> 24)) continue; const r = v & 255, g = (v >>> 8) & 255, b = (v >>> 16) & 255; if (b > 150 && b > r + 30 && g > 120) o[i] = S.hex2c(g > 200 ? '#FFE68A' : '#F3C94A'); else { o[i] = S.pack(Math.round(r * .55), Math.round(g * .55), Math.round(b * .75), v >>> 24); } } return o; }
  function sparkle(buf, an, k) { const o = buf.slice(), r = Pixxel.Fab ? Pixxel.Fab.rng(99 + k * 31) : { r: (a, b) => a + Math.random() * (b - a), chance: p => Math.random() < p }; for (let i = 0; i < 2 + Math.floor(an.bb.w / 14); i++) { const x = Math.round(r.r(an.bb.x - 1, an.bb.x + an.bb.w)), y = Math.round(r.r(an.bb.y - 1, an.bb.y + an.bb.h * 0.6)); const pts = r.chance(0.5) ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] : [[0, 0]]; for (const [dx, dy] of pts) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < an.W && Y < an.H) o[Y * an.W + X] = S.hex2c(dx || dy ? '#F3C94A' : '#FFFFFF'); } } return o; }
  function blink(buf, an) { const o = buf.slice(), W = an.W, isEye = v => { if (!(v >>> 24)) return false; const l = 0.3 * (v & 255) + 0.59 * ((v >>> 8) & 255) + 0.11 * ((v >>> 16) & 255); return l < 70; }; for (let x = 0; x < W; x++) { let y = 0; while (y < an.H) { if (isEye(buf[y * W + x])) { let y2 = y; while (y2 < an.H && isEye(buf[y2 * W + x])) y2++; if (y2 - y >= 2 && y2 - y <= 4 && y > 0 && (buf[(y - 1) * W + x] >>> 24)) for (let q = y; q < y2 - 1; q++) o[q * W + x] = buf[(y - 1) * W + x]; y = y2; } else y++; } } return o; }

  /* ---------------- tipos ---------------- */
  // tags: [nome, quadros, fn(buf, an, k, n, amp)]; altura = px no jogo (o Kome tem ~40)
  const q = (t) => (buf, an, k, n, amp) => FAM.quad(buf, an, t, k, n, amp);
  const bp = (t) => (buf, an, k, n, amp) => FAM.biped(buf, an, t, k, n, amp);
  const fx = (name, post) => (buf, an, k, n, amp) => { let o = FX[name](buf, an, k, n, amp); if (post) o = post(o, an, k, n); return o; };
  const TYPES = [
    { id: 'cachorro', nome: 'Cachorro', grupo: 'Bichos', altura: 40, tipo: 'bicho', tags: [['parado', 6, q('parado')], ['andar', 8, q('andar')], ['correr', 6, q('correr')], ['abanar', 4, q('abanar')], ['farejar', 6, q('farejar')], ['pular', 6, q('pular')]] },
    { id: 'gato', nome: 'Gato', grupo: 'Bichos', altura: 32, tipo: 'bicho', tags: [['parado', 6, q('parado')], ['andar', 8, q('andar')], ['correr', 6, q('correr')], ['pular', 6, q('pular')]] },
    { id: 'quadrupede', nome: 'Bicho de 4 patas (urso, porco, cavalo…)', grupo: 'Bichos', altura: 48, tipo: 'bicho', tags: [['parado', 6, q('parado')], ['andar', 8, q('andar')], ['correr', 6, q('correr')]] },
    { id: 'passaro', nome: 'Pássaro', grupo: 'Bichos', altura: 20, tipo: 'bicho', tags: [['parado', 4, fx('respirar')], ['pulinho', 6, fx('quicar')], ['voar', 6, fx('flutuar')]] },
    { id: 'peixe', nome: 'Peixe', grupo: 'Bichos', altura: 20, tipo: 'bicho', tags: [['nadar', 6, fx('nadar')], ['parado', 6, fx('flutuar')]] },
    { id: 'borboleta', nome: 'Borboleta / inseto', grupo: 'Bichos', altura: 16, tipo: 'bicho', tags: [['voar', 6, (b, an, k, n, a) => FAM.wings(b, an, 'voar', k, n, a)]] },
    { id: 'slime', nome: 'Bolinha / slime / mochi', grupo: 'Bichos', altura: 24, tipo: 'bicho', tags: [['parado', 6, fx('respirar', (o, an, k, n) => k === Math.floor(n / 2) ? blink(o, an) : o)], ['andar', 6, fx('quicar')], ['pular', 6, fx('quicar')]] },
    { id: 'pessoa', nome: 'Pessoa / personagem', grupo: 'Gente', altura: 56, tipo: 'personagem', tags: [['parado', 6, bp('parado')], ['andar', 8, bp('andar')], ['correr', 6, bp('correr')], ['pular', 6, bp('pular')], ['acenar', 6, bp('acenar')]] },
    { id: 'robo', nome: 'Robô', grupo: 'Gente', altura: 52, tipo: 'personagem', tags: [['parado', 4, bp('parado')], ['andar', 8, bp('andar')]] },
    { id: 'fantasma', nome: 'Fantasma / voador', grupo: 'Gente', altura: 40, tipo: 'personagem', tags: [['flutuar', 8, fx('flutuar')], ['assustar', 4, fx('tremer')]] },
    { id: 'casa', nome: 'Casa', grupo: 'Construções', altura: 120, tipo: 'construção', tags: [['dia', 1, fx('estatico')], ['noite', 1, fx('estatico', o => litWindows(o))]] },
    { id: 'loja', nome: 'Loja / barraca', grupo: 'Construções', altura: 90, tipo: 'construção', tags: [['dia', 1, fx('estatico')], ['noite', 1, fx('estatico', o => litWindows(o))]] },
    { id: 'castelo', nome: 'Castelo / templo', grupo: 'Construções', altura: 200, tipo: 'construção', tags: [['dia', 1, fx('estatico')]] },
    { id: 'arvore', nome: 'Árvore', grupo: 'Natureza', altura: 110, tipo: 'planta', tags: [['vento', 8, fx('vento')], ['crescer', 6, fx('crescer')]] },
    { id: 'planta', nome: 'Planta / flor', grupo: 'Natureza', altura: 28, tipo: 'planta', tags: [['vento', 6, fx('vento')], ['crescer', 6, fx('crescer')]] },
    { id: 'pedra', nome: 'Pedra / móvel', grupo: 'Natureza', altura: 24, tipo: 'enfeite', tags: [['parado', 1, fx('estatico')]] },
    { id: 'fogo', nome: 'Fogo / tocha', grupo: 'Natureza', altura: 28, tipo: 'enfeite', tags: [['queimar', 6, fx('chama')]] },
    { id: 'item', nome: 'Item / poção / comida', grupo: 'Coisas', altura: 16, tipo: 'objeto', tags: [['flutuar', 8, fx('flutuar')], ['brilhar', 6, fx('estatico', (o, an, k) => sparkle(o, an, k))], ['pegar', 6, fx('quicar')]] },
    { id: 'moeda', nome: 'Moeda / joia', grupo: 'Coisas', altura: 14, tipo: 'objeto', tags: [['girar', 8, fx('girar')], ['brilhar', 6, fx('estatico', (o, an, k) => sparkle(o, an, k))]] },
    { id: 'veiculo', nome: 'Veículo (carro, carroça…)', grupo: 'Coisas', altura: 48, tipo: 'veículo', tags: [['parado', 1, (b, an, k, n, a) => FAM.vehicle(b, an, 'parado', k, n, a)], ['andar', 8, (b, an, k, n, a) => FAM.vehicle(b, an, 'andar', k, n, a)]] },
    { id: 'bandeira', nome: 'Bandeira / pano', grupo: 'Coisas', altura: 40, tipo: 'enfeite', tags: [['vento', 8, fx('nadar')]] },
    { id: 'roupa', nome: 'Roupa / chapéu', grupo: 'Coisas', altura: 12, tipo: 'roupa', tags: [['parado', 1, fx('estatico')]] },
  ];
  S.TYPES = TYPES;

  /* ---------------- escala de pixel art ---------------- */
  // redução pela "moda" (cor mais frequente do bloco) preserva contorno e cor; ampliação por vizinho
  function pxScale(buf, W, H, k) {
    if (Math.abs(k - 1) < 1e-3) return { buf: buf.slice(), w: W, h: H };
    const nw = Math.max(1, Math.round(W * k)), nh = Math.max(1, Math.round(H * k)), o = new Uint32Array(nw * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      if (k >= 1) { o[y * nw + x] = buf[Math.min(H - 1, Math.floor((y + .5) / k)) * W + Math.min(W - 1, Math.floor((x + .5) / k))]; continue; }
      const x0 = Math.floor(x / k), x1 = Math.max(x0 + 1, Math.floor((x + 1) / k)), y0 = Math.floor(y / k), y1 = Math.max(y0 + 1, Math.floor((y + 1) / k));
      const cnt = new Map(); let best = 0, bn = 0, opaque = 0, tot = 0;
      for (let yy = y0; yy < Math.min(H, y1); yy++) for (let xx = x0; xx < Math.min(W, x1); xx++) { const v = buf[yy * W + xx]; tot++; if (!(v >>> 24)) continue; opaque++; const n = (cnt.get(v) || 0) + 1; cnt.set(v, n); if (n > bn) { bn = n; best = v; } }
      o[y * nw + x] = opaque >= tot * 0.4 ? best : 0;
    }
    return { buf: o, w: nw, h: nh };
  }
  S.pxScale = pxScale;

  /* ---------------- aplicar no documento ---------------- */
  // opts: {type, altura, tags:[nomes], amp, replace, frameDur}
  S.applyType = function (doc, H, opts) {
    const T = TYPES.find(t => t.id === opts.type); if (!T) return;
    const f0 = doc.cur.f, base = S.compose(doc, f0, { skipRef: true });
    let bb = S.bboxOf(base, doc.w, doc.h); if (!bb) { S.toast('Desenhe alguma coisa primeiro'); return; }
    H.begin('virar ' + T.nome, 'all');
    // 1) escala: o desenho passa a ter a altura pedida
    const alt = opts.altura || T.altura, k = alt / bb.h;
    let crop = new Uint32Array(bb.w * bb.h); for (let y = 0; y < bb.h; y++) for (let x = 0; x < bb.w; x++) crop[y * bb.w + x] = base[(bb.y + y) * doc.w + bb.x + x];
    const sc = pxScale(crop, bb.w, bb.h, k);
    // 2) tela nova com folga pra animação (pulo, rabo, braço)
    const padX = Math.ceil(sc.w * 0.25) + 4, padTop = Math.ceil(sc.h * 0.35) + 4, nw = Math.min(512, sc.w + padX * 2), nh = Math.min(512, sc.h + padTop + 2);
    const work = new Uint32Array(nw * nh), ox = Math.floor((nw - sc.w) / 2), oy = nh - 1 - sc.h;
    for (let y = 0; y < sc.h; y++) for (let x = 0; x < sc.w; x++) { const v = sc.buf[y * sc.w + x]; if (v >>> 24) work[(oy + y) * nw + ox + x] = v; }
    const an = analyze(work, nw, nh); an.buf = work;
    // 3) quadros
    const want = T.tags.filter(t => !opts.tags || opts.tags.includes(t[0])), amp = opts.amp || 2;
    const frames = [], tags = [];
    for (const [name, n, fn] of want) { const from = frames.length; for (let i = 0; i < n; i++) frames.push(fn(work, an, i, n, amp)); tags.push({ name, from, to: frames.length - 1, dir: 'frente', cor: tagColor(tags.length) }); }
    if (!frames.length) frames.push(work);
    const keepOld = !opts.replace;
    if (keepOld) {
      // mantém a arte original como camada escondida "original" e anima numa camada nova
    }
    doc.w = nw; doc.h = nh;
    const dur = opts.frameDur || 110;
    doc.frames = frames.map(() => ({ dur }));
    const orig = S.newLayer('Original (' + bb.w + '×' + bb.h + ')', { vis: false, lock: true, cels: frames.map(() => null) }); orig.cels[0] = (() => { const c = new Uint32Array(nw * nh); const s2 = pxScale(crop, bb.w, bb.h, Math.min(1, (nw - 2) / bb.w, (nh - 2) / bb.h)); for (let y = 0; y < s2.h; y++) for (let x = 0; x < s2.w; x++) c[(nh - s2.h + y) * nw + Math.floor((nw - s2.w) / 2) + x] = s2.buf[y * s2.w + x]; return c; })();
    const main = S.newLayer(T.nome, { cels: frames.map(b => b.some(v => v >>> 24) ? b : null) });
    doc.layers = [orig, main]; doc.tags = tags; doc.cur = { f: 0, l: 1 }; doc.sel = null;
    doc.meta = Object.assign(doc.meta || {}, { tipo: T.tipo, rig: T.id, altura: alt, ancora: 'pés' });
    H.end(); S.emit('structure', doc); S.emit('change', doc);
    return { frames: frames.length, tags: tags.map(t => t.name), w: nw, h: nh, partes: describe(an, T) };
  };
  function describe(an, T) {
    const fam = T.tags[0] && T.tags[0][2].toString();
    const bits = [];
    if (/quad\(/.test(fam) || ['cachorro', 'gato', 'quadrupede'].includes(T.id)) bits.push(an.legs.length + ' pata(s)', 'cabeça olhando pra ' + (an.facing < 0 ? 'esquerda' : 'direita'));
    if (['pessoa', 'robo'].includes(T.id)) bits.push(an.legs.length + ' perna(s)', 'braços nas laterais');
    return bits.join(', ');
  }
  const TAG_COLORS = ['#E2742E', '#6FB3D2', '#7F9E5C', '#D95763', '#8E6FB3', '#EDB93A', '#A9763F', '#3F7FA6'];
  const tagColor = i => TAG_COLORS[i % TAG_COLORS.length];
  S.tagColor = tagColor;
  // gera os quadros de UMA tag sem mexer no doc (pra prévia no diálogo)
  S.previewType = function (buf, W, H, typeId, altura, amp) {
    const T = TYPES.find(t => t.id === typeId), bb = S.bboxOf(buf, W, H); if (!T || !bb) return null;
    const crop = new Uint32Array(bb.w * bb.h); for (let y = 0; y < bb.h; y++) for (let x = 0; x < bb.w; x++) crop[y * bb.w + x] = buf[(bb.y + y) * W + bb.x + x];
    const sc = pxScale(crop, bb.w, bb.h, (altura || T.altura) / bb.h), padX = Math.ceil(sc.w * 0.25) + 4, padTop = Math.ceil(sc.h * 0.35) + 4, nw = sc.w + padX * 2, nh = sc.h + padTop + 2, work = new Uint32Array(nw * nh), ox = Math.floor((nw - sc.w) / 2), oy = nh - 1 - sc.h;
    for (let y = 0; y < sc.h; y++) for (let x = 0; x < sc.w; x++) if (sc.buf[y * sc.w + x] >>> 24) work[(oy + y) * nw + ox + x] = sc.buf[y * sc.w + x];
    const an = analyze(work, nw, nh); an.buf = work;
    return { w: nw, h: nh, an, tags: T.tags.map(([name, n, fn]) => ({ name, frames: Array.from({ length: n }, (_, i) => fn(work, an, i, n, amp || 2)) })) };
  };
})();
