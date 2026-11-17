/* ==========================================================================
   Pixxel Estúdio — creature.js  (Construtor de Bicho)
   Mesma técnica do Kome (shiba.js): cada quadro é montado por peças —
   rabo, pernas de trás, corpo, barriga, peito, pernas da frente, cabeça,
   orelhas, focinho, olhos, boca, acessório — em índices de cor, com 3 tons
   de pelo, creme, e contorno 4-vizinhos puxado da cor do pelo.
   Generalizado com parâmetros de espécie e resolução 1×/2×/3× (2× e 3×
   ganham detalhes finos: brilho no olho, tufos, dedinhos, bigode).
   ========================================================================== */
(function () {
  'use strict';
  const S = window.Studio;

  /* ---------------- índices de cor ---------------- */
  const FUR = 1, FURS = 2, FURD = 3, CREAM = 4, CREAMS = 5, EYE = 6, NOSE = 7, PINK = 8, BLUSH = 9, ACC = 10, ACCS = 11, ACCL = 12, LINE = 13, WHITE = 14, PAT = 15, PATS = 16, GOLD = 17, FURL = 18, IRIS = 19, HORN = 20, HORNS = 21;
  const NC = 24;

  /* ---------------- espécies (presets) ---------------- */
  const SPECIES = {
    cachorro: { nome: 'Cachorro (shiba)', cabeca: 1, focinho: 1, orelha: 'pontuda', orelhaTam: 1, corpoComp: 1, corpoAlt: 1, pernaComp: 1, pernaGross: 1, rabo: 'enrolado', padrao: 'nenhum', olhos: 'normal', bigode: false, cores: { pelo: '#D9A066', creme: '#EBEBEB', olho: '#2A1A10', nariz: '#2A1A10', lingua: '#D95763', padrao: '#2A1A10' } },
    gato: { nome: 'Gato', cabeca: 0.95, focinho: 0.55, orelha: 'gato', orelhaTam: 1.05, corpoComp: 0.95, corpoAlt: 0.9, pernaComp: 1.05, pernaGross: 0.85, rabo: 'gato', padrao: 'listras', olhos: 'gato', bigode: true, cores: { pelo: '#E2742E', creme: '#FFF3DC', olho: '#5D7A40', nariz: '#D98AA0', lingua: '#D95763', padrao: '#B0531C' } },
    urso: { nome: 'Urso', cabeca: 1.12, focinho: 0.9, orelha: 'redonda', orelhaTam: 1, corpoComp: 1.12, corpoAlt: 1.3, pernaComp: 0.9, pernaGross: 1.45, rabo: 'toco', padrao: 'nenhum', olhos: 'pequeno', bigode: false, cores: { pelo: '#8E5E3C', creme: '#D9B98A', olho: '#1A0F08', nariz: '#2A1A10', lingua: '#D95763', padrao: '#5E3A22' } },
    raposa: { nome: 'Raposa', cabeca: 0.95, focinho: 1.2, orelha: 'pontuda', orelhaTam: 1.25, corpoComp: 1.05, corpoAlt: 0.9, pernaComp: 1.05, pernaGross: 0.85, rabo: 'raposa', padrao: 'meias', olhos: 'normal', bigode: false, cores: { pelo: '#E2742E', creme: '#FFFAEE', olho: '#2A1A10', nariz: '#2A1A10', lingua: '#D95763', padrao: '#3A332D' } },
    coelho: { nome: 'Coelho', cabeca: 1, focinho: 0.55, orelha: 'coelho', orelhaTam: 1, corpoComp: 0.85, corpoAlt: 1.15, pernaComp: 0.7, pernaGross: 1.1, rabo: 'coelho', padrao: 'nenhum', olhos: 'grande', bigode: true, gait: 'pulo', cores: { pelo: '#F1EADB', creme: '#FFFFFF', olho: '#3A2018', nariz: '#E8707A', lingua: '#E8707A', padrao: '#B88E62' } },
    panda: { nome: 'Panda', cabeca: 1.12, focinho: 0.75, orelha: 'redonda', orelhaTam: 1, corpoComp: 1.1, corpoAlt: 1.3, pernaComp: 0.85, pernaGross: 1.5, rabo: 'toco', padrao: 'panda', olhos: 'pequeno', bigode: false, cores: { pelo: '#F4F1EA', creme: '#FFFFFF', olho: '#16181D', nariz: '#16181D', lingua: '#E8707A', padrao: '#2B2A30' } },
    tanuki: { nome: 'Tanuki', cabeca: 1.05, focinho: 0.85, orelha: 'redonda', orelhaTam: 0.85, corpoComp: 1.05, corpoAlt: 1.2, pernaComp: 0.85, pernaGross: 1.15, rabo: 'listrado', padrao: 'mascara', olhos: 'normal', bigode: false, cores: { pelo: '#9C7A55', creme: '#E9D2AE', olho: '#2A1A10', nariz: '#2A1A10', lingua: '#D95763', padrao: '#3A2C22' } },
    porco: { nome: 'Porquinho', cabeca: 1.05, focinho: 0.8, orelha: 'caida', orelhaTam: 0.9, corpoComp: 1.05, corpoAlt: 1.25, pernaComp: 0.75, pernaGross: 1.2, rabo: 'porco', padrao: 'nenhum', olhos: 'normal', bigode: false, focinhoTipo: 'porco', cores: { pelo: '#F4B8C5', creme: '#F8D7DE', olho: '#2A1A10', nariz: '#D98AA0', lingua: '#D95763', padrao: '#D98AA0' } },
    lobo: { nome: 'Lobo', cabeca: 1, focinho: 1.3, orelha: 'pontuda', orelhaTam: 1.15, corpoComp: 1.15, corpoAlt: 1, pernaComp: 1.15, pernaGross: 1, rabo: 'lobo', padrao: 'mascara', olhos: 'bravo', bigode: false, cores: { pelo: '#8E949C', creme: '#E3E8EE', olho: '#B4852A', nariz: '#2A1A10', lingua: '#D95763', padrao: '#5A5F6B' } },
    capivara: { nome: 'Capivara', cabeca: 1.05, focinho: 1.15, orelha: 'redonda', orelhaTam: 0.55, corpoComp: 1.25, corpoAlt: 1.25, pernaComp: 0.65, pernaGross: 1.25, rabo: 'nenhum', padrao: 'nenhum', olhos: 'pequeno', bigode: false, cores: { pelo: '#9C6B45', creme: '#B98A5A', olho: '#1A0F08', nariz: '#3A2418', lingua: '#D95763', padrao: '#6B4528' } },
    cervo: { nome: 'Cervo (Nara)', cabeca: 0.95, focinho: 1.15, orelha: 'pontuda', orelhaTam: 0.85, corpoComp: 1.05, corpoAlt: 0.95, pernaComp: 1.45, pernaGross: 0.8, rabo: 'toco', padrao: 'manchas', olhos: 'grande', bigode: false, chifre: 'cervo', cores: { pelo: '#B9773F', creme: '#F6EEDC', olho: '#2A1A10', nariz: '#2A1A10', lingua: '#D95763', padrao: '#FFFAEE' } },
    ovelha: { nome: 'Ovelha', cabeca: 0.95, focinho: 0.9, orelha: 'caida', orelhaTam: 0.9, corpoComp: 1.05, corpoAlt: 1.3, pernaComp: 0.85, pernaGross: 0.9, rabo: 'toco', padrao: 'nenhum', olhos: 'normal', bigode: false, la: true, cores: { pelo: '#3A332D', creme: '#FFFDF6', olho: '#F2E6C9', nariz: '#1A1612', lingua: '#E8707A', padrao: '#E6DCC4' } },
    vaca: { nome: 'Vaquinha', cabeca: 1.05, focinho: 1, orelha: 'redonda', orelhaTam: 0.7, corpoComp: 1.3, corpoAlt: 1.3, pernaComp: 1, pernaGross: 1.3, rabo: 'cavalo', padrao: 'malhado', olhos: 'normal', bigode: false, chifre: 'vaca', cores: { pelo: '#FFFAEE', creme: '#F4B8C5', olho: '#2A1A10', nariz: '#C9708A', lingua: '#D95763', padrao: '#2E2C30' } },
    cavalo: { nome: 'Cavalo', cabeca: 0.95, focinho: 1.55, orelha: 'pontuda', orelhaTam: 0.8, corpoComp: 1.25, corpoAlt: 1.05, pernaComp: 1.6, pernaGross: 1, rabo: 'cavalo', padrao: 'nenhum', olhos: 'normal', bigode: false, crina: true, cores: { pelo: '#8E5E3C', creme: '#B98A5A', olho: '#1A0F08', nariz: '#3A2418', lingua: '#D95763', padrao: '#2E2018' } },
    hamster: { nome: 'Hamster', cabeca: 1.18, focinho: 0.5, orelha: 'redonda', orelhaTam: 0.7, corpoComp: 0.75, corpoAlt: 1.45, pernaComp: 0.35, pernaGross: 1.1, rabo: 'nenhum', padrao: 'nenhum', olhos: 'grande', bigode: true, cores: { pelo: '#E2A35E', creme: '#FFF6E8', olho: '#2A1A10', nariz: '#E8707A', lingua: '#E8707A', padrao: '#B9773F' } },
  };
  const ACCS_LIST = { nenhum: 'nada', kasa: 'chapéu kasa (Kome)', lenco: 'lenço no pescoço', coleira: 'coleira com plaquinha', laco: 'laço', gorro: 'gorro', oculos: 'óculos' };

  /* ---------------- rasterizador ---------------- */
  const XO = 6, OY = 7, GW = 60, GH = 51;
  let R = 1, BW = 0, BH = 0, buf = null, clip = null, ONLY = null, PART = 'corpo';
  const part = n => { PART = n; };
  const allow = arr => { const m = new Uint8Array(NC); arr.forEach(i => m[i] = 1); return m; };
  function px(x, y, c) { if (ONLY && !ONLY.has(PART)) return; if (x >= 0 && y >= 0 && x < BW && y < BH && c && (!clip || clip[buf[y * BW + x]])) buf[y * BW + x] = c; }
  function ell(cx, cy, rx, ry, c) {
    cx = (cx + XO) * R; cy = (cy + OY) * R; rx *= R; ry *= R; if (rx <= 0 || ry <= 0) return;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) { const dy = (y + 0.5 - cy) / ry, d2 = dy * dy; if (d2 > 1) continue; for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x + 0.5 - cx) / rx; if (dx * dx + d2 <= 1) px(x, y, c); } }
  }
  function rect(x, y, w, h, c) { const X = Math.round((x + XO) * R), Y = Math.round((y + OY) * R); for (let j = 0; j < Math.round(h * R); j++) for (let i = 0; i < Math.round(w * R); i++) px(X + i, Y + j, c); }
  function tri(ax, ay, bx, by, cx, cy, c) {
    ax = (ax + XO) * R; bx = (bx + XO) * R; cx = (cx + XO) * R; ay = (ay + OY) * R; by = (by + OY) * R; cy = (cy + OY) * R;
    const side = (px2, py, qx, qy, rx2, ry2) => (px2 - rx2) * (qy - ry2) - (qx - rx2) * (py - ry2);
    for (let y = Math.floor(Math.min(ay, by, cy)); y <= Math.ceil(Math.max(ay, by, cy)); y++) for (let x = Math.floor(Math.min(ax, bx, cx)); x <= Math.ceil(Math.max(ax, bx, cx)); x++) { const X = x + .5, Y = y + .5, d1 = side(X, Y, ax, ay, bx, by), d2 = side(X, Y, bx, by, cx, cy), d3 = side(X, Y, cx, cy, ax, ay); if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) px(x, y, c); }
  }
  function line(x0, y0, x1, y1, w, c) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2 * R) + 1; for (let i = 0; i <= n; i++) { const t = i / n; ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, w / 2, c); } }
  const dot = (x, y, c) => rect(x, y, 1, 1, c);
  // pixel fino (só aparece de verdade em 2× e 3×): detalhe sem engrossar
  const fine = (x, y, c) => px(Math.floor((x + XO) * R), Math.floor((y + OY) * R), c);
  const over = (cols, fn) => { const p = clip; clip = allow(cols); fn(); clip = p; };

  /* ---------------- peças ---------------- */
  let P, A; // parâmetros e âncoras
  const s = Math.sin;
  function legC(far) { return far ? [FURD, FURS] : [FURS, FUR]; }
  function leg(x0, y0, x1, y1, far) {
    const g = P.pernaGross, [c1, c2] = legC(far), panda = P.padrao === 'panda';
    line(x0, y0, x1, y1 - 1, 3.2 * g, panda ? (far ? PATS : PAT) : c1); line(x0, y0, x1, y1 - 1, 2.2 * g, panda ? PAT : c2);
    if (P.padrao === 'meias' || P.padrao === 'panda') over([FUR, FURS, FURD], () => line(x0 + (x1 - x0) * 0.55, y0 + (y1 - y0) * 0.55, x1, y1 - 1, 3.2 * g, far ? PATS : PAT));
    const pw = Math.max(3, Math.round(3 * g)); rect(Math.round(x1) - Math.floor(pw / 2), Math.round(y1) - 1, pw, 2, P.padrao === 'meias' || panda ? (far ? PATS : PAT) : far ? CREAMS : CREAM);
    if (R >= 2 && !far) { fine(Math.round(x1) - 0.5, y1 - 0.5, LINE); fine(Math.round(x1) + 0.5, y1 - 0.5, LINE); } // dedinhos
  }
  function tail(cx, cy, wag) {
    const a = wag, t = P.rabo;
    if (t === 'enrolado') { line(cx + 4, cy + 4, cx + 1 + a * 0.5, cy + 1, 3.5, FUR); ell(cx + a, cy, 4.8, 4.4, FUR); ell(cx + a - 0.9, cy - 0.7, 3.5, 3.1, CREAM); ell(cx + a + 0.8, cy + 0.8, 2.7, 2.4, FUR); ell(cx + a + 1.1, cy + 1.1, 1.1, 1, FURS); dot(cx + a - 2.6, cy - 2.2, WHITE); return; }
    if (t === 'gato') { const pts = [[cx + 4, cy + 7], [cx, cy + 5], [cx - 3 + a * 0.3, cy + 1], [cx - 4 + a * 0.8, cy - 4], [cx - 2.5 + a * 1.4, cy - 8]]; for (let i = 0; i < pts.length - 1; i++) line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2.6, FUR); ell(pts[4][0], pts[4][1], 1.6, 1.6, P.padrao === 'listras' ? PAT : FURS); if (P.padrao === 'listras') over([FUR], () => { for (let i = 1; i < 4; i++) dot(pts[i][0], pts[i][1], PAT); }); return; }
    if (t === 'nenhum') return;
    if (t === 'cavalo') { const n2 = 5; for (let i = 0; i < n2; i++) { const k2 = i / (n2 - 1); line(cx + 3, cy + 4, cx - 1 - k2 * 2 + a * 0.6, cy + 12 + k2 * 3, 1.4, i % 2 ? PAT : PATS); } ell(cx + 3, cy + 4, 1.8, 1.8, PAT); return; }
    if (t === 'toco') { ell(cx + 2.5, cy + 6, 2.6, 2.4, P.padrao === 'panda' ? PAT : FUR); ell(cx + 2, cy + 5.5, 1.3, 1.1, P.padrao === 'panda' ? PAT : FURL); return; }
    if (t === 'coelho') { ell(cx + 2.2, cy + 5.5, 3, 2.8, CREAM); ell(cx + 1.6, cy + 5, 1.6, 1.4, WHITE); return; }
    if (t === 'porco') { const k = cx + 3, m = cy + 5; dot(k, m, FUR); dot(k - 1, m - 1, FUR); dot(k - 2, m - 1, FUR); dot(k - 3, m, FUR); dot(k - 2, m + 1, FUR); dot(k - 1 + (a > 0 ? 0 : -1), m + 1, FURS); return; }
    // raposa / lobo / listrado: cauda fofa
    const fox = t === 'raposa', down = t === 'lobo' ? 1.4 : 0.6, n = 6, r0 = fox ? 2.4 : 2.2, r1 = fox ? 4.4 : t === 'listrado' ? 3.8 : 3.4;
    const pt = i => { const k = i / (n - 1); return [cx + 3 - k * (fox ? 10 : 8) + a * k * 1.2, cy + 5 + k * k * (fox ? 3 : 7) * down - k * (fox ? 3 : 1)]; };
    for (let i = 0; i < n; i++) { const [x, y] = pt(i), k = i / (n - 1); ell(x, y, r0 + (r1 - r0) * Math.sin(k * 2.6) , (r0 + (r1 - r0) * Math.sin(k * 2.6)) * 0.85, FUR); }
    over([FUR], () => { for (let i = 0; i < n; i++) { const [x, y] = pt(i); ell(x + 0.6, y + 1.4, 2.4, 1.2, FURS); } });
    if (fox) { const [x, y] = pt(n - 1); over([FUR, FURS], () => ell(x - 1.4, y + 0.4, 3, 2.8, WHITE)); }
    if (t === 'listrado') over([FUR, FURS], () => { for (let i = 1; i < n; i += 2) { const [x, y] = pt(i); line(x - 0.5, y - 4, x + 0.5, y + 4, 1.4, PAT); } });
  }
  const EARS = {
    pontuda: (hx, hy, k, tilt, tw, front) => front ? (tri(hx + 1 + tilt, hy - 7, hx + 4 + tilt + tw, hy - 7 - 7 * k, hx + 7, hy - 6, FUR), tri(hx + 2.5 + tilt, hy - 7, hx + 4 + tilt + tw * .8, hy - 7 - 4.5 * k, hx + 5.6, hy - 7, CREAM)) : (tri(hx - 6 + tilt, hy - 6, hx - 4 + tilt, hy - 6 - 7 * k, hx - 1, hy - 7, FURS), tri(hx - 5 + tilt, hy - 7, hx - 4 + tilt, hy - 7 - 4 * k, hx - 2, hy - 7, CREAMS)),
    gato: (hx, hy, k, tilt, tw, front) => front ? (tri(hx + 0.5 + tilt, hy - 6, hx + 2 + tilt + tw, hy - 6 - 7 * k, hx + 6.5, hy - 5.5, FUR), tri(hx + 1.8 + tilt, hy - 6.5, hx + 2.4 + tilt + tw * .8, hy - 6 - 4.5 * k, hx + 4.8, hy - 6, PINK)) : (tri(hx - 7 + tilt, hy - 4.5, hx - 6 + tilt, hy - 4.5 - 7 * k, hx - 2, hy - 7, FURS), tri(hx - 6 + tilt, hy - 5.5, hx - 5.6 + tilt, hy - 5 - 4 * k, hx - 3, hy - 7, BLUSH)),
    redonda: (hx, hy, k, tilt, tw, front) => { const pd = P.padrao === 'panda'; if (front) { ell(hx + 3.5 + tilt, hy - 7.5, 3.2 * k, 3 * k, pd ? PAT : FUR); ell(hx + 3.5 + tilt, hy - 7.2, 1.7 * k, 1.5 * k, pd ? PATS : CREAMS); } else { ell(hx - 5 + tilt, hy - 6.5, 3.1 * k, 2.9 * k, pd ? PATS : FURS); ell(hx - 5 + tilt, hy - 6.2, 1.5 * k, 1.4 * k, pd ? PAT : FURD); } },
    caida: (hx, hy, k, tilt, tw, front) => front ? (tri(hx + 0.5, hy - 7, hx + 6.5, hy - 6.5, hx + 6 + tw * .5, hy - 1 * k, FURS), tri(hx + 1.5, hy - 6.5, hx + 5.5, hy - 6.3, hx + 5.2, hy - 3 * k, BLUSH)) : tri(hx - 6, hy - 6, hx - 1, hy - 7.5, hx - 6.5, hy - 2, FURD),
    coelho: (hx, hy, k, tilt, tw, front) => { if (front) { const bx = hx + 2.5 + tilt, tip = -15 * k; line(bx, hy - 6, bx - 1 + tw, hy - 6 + tip * 0.85, 3.4, FUR); line(bx, hy - 7, bx - 0.8 + tw * .8, hy - 6 + tip * 0.75, 1.3, PINK); } else { const bx = hx - 2 + tilt; line(bx, hy - 6, bx - 3.5, hy - 6 - 13 * k, 3.2, FURS); line(bx, hy - 7, bx - 3.2, hy - 6 - 11 * k, 1.1, BLUSH); } },
    nenhuma: () => { },
  };
  function head(hx, hy, o) {
    o = o || {}; const eyes = o.eyes || 'open', mouth = o.mouth || 'smile', ears = o.ears || 'up', tilt = o.tilt || 0, tw = o.tw || 0;
    const K = P.cabeca, F = P.focinho, ek = P.orelhaTam * (ears === 'back' ? 0.55 : 1), E2 = EARS[P.orelha] || EARS.pontuda;
    A.headX = hx; A.headY = hy;
    part('orelhas'); E2(hx, hy, ek, tilt, tw, false);
    part('cabeca'); ell(hx, hy, 8.6 * K, 8.2 * K, FUR);
    if (P.la) { ell(hx - 2, hy - 6 * K, 5 * K, 3.2 * K, CREAM); ell(hx - 5, hy - 4 * K, 3.4, 3, CREAM); ell(hx + 1.5, hy - 7 * K, 3.2, 2.6, CREAM); }
    if (P.chifre === 'cervo') { part('acessorio'); line(hx - 1, hy - 7 * K, hx - 3, hy - 16, 1.6, HORN); line(hx - 2.4, hy - 12.5, hx - 6.5, hy - 15, 1.3, HORN); line(hx - 2.8, hy - 14.5, hx + 0.5, hy - 18, 1.2, HORNS); line(hx + 3, hy - 7 * K, hx + 4, hy - 15, 1.6, HORN); line(hx + 3.6, hy - 11.5, hx + 7.5, hy - 13.5, 1.3, HORN); part('cabeca'); }
    if (P.chifre === 'vaca') { part('acessorio'); line(hx - 3, hy - 7 * K, hx - 6, hy - 10, 1.8, HORN); line(hx - 6, hy - 10, hx - 5, hy - 12, 1.4, HORNS); line(hx + 3, hy - 7.5 * K, hx + 5.5, hy - 11, 1.8, HORN); line(hx + 5.5, hy - 11, hx + 4, hy - 13, 1.4, HORNS); part('cabeca'); }
    if (P.padrao === 'mascara') over([FUR], () => { ell(hx + 2.5, hy - 0.5, 4.6 * K, 2.8 * K, PAT); });
    if (P.padrao === 'panda') over([FUR], () => { ell(hx + 2.2, hy - 0.4, 2.8, 3.2, PAT); });
    // bochecha e focinho
    part('cremeCabeca'); ell(hx + 0.5, hy + 4.6 * K, 6.4 * K, 3.6 * K, CREAM);
    if (P.focinhoTipo === 'porco') { ell(hx + 7.4 * K, hy + 2.6, 3 * F + 1, 2.8, CREAM); ell(hx + 8.2 * K + F, hy + 2.4, 1.6, 2.4, FURS); dot(hx + 8 * K + F, hy + 1.6, NOSE); dot(hx + 8 * K + F, hy + 3, NOSE); }
    else ell(hx + 5.6 * K * (0.7 + F * 0.3), hy + 3.4, 4.6 * F + 0.3, 3.2 * Math.min(1.1, 0.7 + F * 0.3), CREAM);
    if (P.padrao !== 'panda' && P.padrao !== 'mascara') { rect(hx - 2, hy - 4, 2, 1, CREAM); rect(hx + 2, hy - 4, 2, 1, CREAM); }
    part('cabeca'); if (P.padrao === 'listras') over([FUR], () => { line(hx - 3, hy - 8 * K, hx - 2, hy - 5 * K, 1.2, PAT); line(hx, hy - 8.4 * K, hx, hy - 5.6 * K, 1.2, PAT); line(hx - 6, hy - 5 * K, hx - 4.5, hy - 3 * K, 1.2, PAT); });
    part('rosto'); if (P.bochecha !== false) ell(hx - 2.6, hy + 2.6, 2.2, 1.3, BLUSH);
    // olhos
    let ex = hx + 2, ey = hy - 1; const lk = o.look; if (lk && eyes === 'open') { ex += lk[0]; ey += lk[1]; }
    const st = P.olhos;
    if (eyes === 'closed') { dot(ex - 1, ey + 2, EYE); dot(ex, ey + 2, EYE); dot(ex + 1, ey + 2, EYE); dot(ex + 2, ey + 1, EYE); }
    else if (eyes === 'happy') { dot(ex - 1, ey + 2, EYE); dot(ex, ey + 1, EYE); dot(ex + 1, ey + 1, EYE); dot(ex + 2, ey + 2, EYE); }
    else if (eyes === 'half') { rect(ex - 1, ey + 1, 3, 2, EYE); rect(ex - 1, ey, 3, 1, LINE); }
    else if (st === 'grande') { rect(ex - 2, ey - 2, 4, 5, EYE); rect(ex - 2, ey - 2, 2, 2, WHITE); dot(ex + 1, ey + 1, WHITE); }
    else if (st === 'pequeno') { rect(ex - 0.5, ey, 2, 2, EYE); fine(ex - 0.2, ey + 0.2, WHITE); if (R === 1) dot(ex - 0.5, ey, WHITE); }
    else if (st === 'gato') { rect(ex - 1, ey - 1, 3, 4, IRIS); rect(ex, ey - 1, 1, 4, EYE); dot(ex - 1, ey - 1, WHITE); }
    else if (st === 'bravo') { rect(ex - 1, ey - 0.5, 3, 3, IRIS); dot(ex, ey + 0.5, EYE); dot(ex - 2, ey - 2, LINE); dot(ex - 1, ey - 2, LINE); dot(ex, ey - 1.5, LINE); dot(ex + 1, ey - 1.5, LINE); }
    else { rect(ex - 1, ey - 1, 3, 4, EYE); dot(ex, ey, WHITE); dot(ex - 1, ey - 1, WHITE); }
    if (R >= 2 && (eyes === 'open') && st !== 'pequeno') { fine(ex + 1.5, ey + 2.5, WHITE); } // brilho extra no olho
    // nariz e boca
    const nx = hx + (P.focinhoTipo === 'porco' ? 7 : 5.6 * K * (0.7 + F * 0.3) + 4.6 * F - 1.2), ny = hy + 1;
    if (P.focinhoTipo !== 'porco') { rect(nx, ny, 2, 2, NOSE); dot(nx - 1, ny, NOSE); fine(nx + 0.2, ny + 0.2, CREAMS); }
    const mx = nx - 2, my = hy + 4.5;
    A.mouthX = mx + 1; A.mouthY = my;
    if (mouth === 'open') { rect(mx - 1, my, 4, 2, LINE); rect(mx, my + 1, 2, 2, PINK); }
    else if (mouth === 'tongue') { rect(mx - 1, my, 4, 1, LINE); rect(mx, my + 1, 2, 2, PINK); }
    else if (mouth === 'yawn') { rect(mx - 2, my - 1, 5, 4, LINE); rect(mx - 1, my, 3, 3, PINK); }
    else if (mouth === 'closed') { dot(mx, my, LINE); dot(mx + 1, my + 1, LINE); dot(mx + 2, my, LINE); }
    else { dot(mx - 1, my, LINE); dot(mx, my + 1, LINE); dot(mx + 1, my + 1, LINE); dot(mx + 2, my, LINE); dot(mx, my + 2, PINK); }
    if (P.bigode) { const bx = nx - 1.5; fine(bx + 0, hy + 3.2, LINE); fine(bx + 1.2, hy + 3, LINE); fine(bx + 2.4, hy + 2.8, LINE); if (R >= 2) { fine(bx + 0.4, hy + 4, LINE); fine(bx + 1.6, hy + 4.1, LINE); fine(bx + 2.8, hy + 4.2, LINE); } else { dot(bx + 3.5, hy + 3, LINE); } }
    // acessórios de cabeça
    part('acessorio'); const ac = P.acessorio;
    if (ac === 'kasa') { tri(hx - 9 * K, hy - 6 * K, hx + 8 * K, hy - 7 * K, hx - 1 + tilt * 0.5, hy - 14 * K, ACC); line(hx - 9 * K, hy - 6 * K, hx + 8 * K, hy - 7 * K, 1.4, ACCS); line(hx - 1 + tilt * 0.5, hy - 14 * K, hx - 3, hy - 7 * K, 1, ACCL); }
    if (ac === 'gorro') { ell(hx - 0.5, hy - 5 * K, 8 * K, 4.6 * K, ACC); over([ACC], () => rect(hx - 9, hy - 3.4 * K, 18, 1.6, ACCS)); ell(hx - 1, hy - 10 * K, 2, 2, ACCL); }
    if (ac === 'oculos') { rect(ex - 2.5, ey - 1.5, 5, 4.5, LINE); rect(ex - 1.5, ey - 0.5, 3, 2.5, ACCL); line(ex - 2.5, ey - 0.5, hx - 5, hy - 2, 0.9, LINE); }
    part('orelhas'); if (ears !== 'none') E2(hx, hy, ek, tilt, tw, true);
    part('acessorio'); if (ac === 'laco') { const bx = hx - 2, by = hy - 8 * K; tri(bx, by, bx - 3, by - 2, bx - 3, by + 2, ACC); tri(bx, by, bx + 3, by - 2, bx + 3, by + 2, ACC); dot(bx - 0.5, by - 0.5, ACCS); }
  }
  function neckAcc(x, y) {
    part('acessorio');
    if (P.acessorio === 'lenco') { tri(x - 3.5, y - 2, x + 4.5, y - 3, x + 1.5, y + 4, ACC); line(x - 3.5, y - 2, x + 4.5, y - 3, 1.4, ACCS); dot(x + 0.5, y, ACCL); }
    if (P.acessorio === 'coleira') { line(x - 2.5, y - 3, x + 3.5, y - 3.5, 1.6, ACC); ell(x + 1.5, y - 1.2, 1.2, 1.3, GOLD); }
  }
  // padrões no corpo (só por cima do pelo)
  function bodyPattern(cx, cy, rx, ry, seed) {
    if (P.padrao === 'listras') over([FUR], () => { for (let i = -2; i <= 2; i++) { const x = cx + i * rx * 0.33; line(x, cy - ry, x - 1, cy - ry * 0.25, 1.3, PAT); } });
    if (P.padrao === 'malhado' || P.padrao === 'manchas') over([FUR], () => { const rnd = k => { const v = Math.sin((seed + k) * 127.1) * 43758.5; return v - Math.floor(v); }; const n = P.padrao === 'malhado' ? 3 : 6; for (let i = 0; i < n; i++) { const r = P.padrao === 'malhado' ? 2.6 + rnd(i) * 2 : 0.9; ell(cx - rx * 0.7 + rnd(i + 9) * rx * 1.4, cy - ry * 0.6 + rnd(i + 3) * ry, r * 1.2, r, PAT); } });
    if (P.padrao === 'panda') over([FUR, FURS], () => { ell(cx + rx * 0.45, cy - ry * 0.2, rx * 0.45, ry * 1.2, PAT); });
    if (R >= 2) over([FUR], () => { for (let i = 0; i < 5; i++) fine(cx - rx * 0.6 + i * rx * 0.3, cy - ry * 0.55 + (i % 2) * 0.6, FURL); }); // tufinhos de luz
  }

  // lã (ovelha): bolinhas fofas creme em volta do corpo
  function wool(cx, cy, rx, ry) { if (!P.la) return; const n = 9; for (let i = 0; i < n; i++) { const a = Math.PI + i / (n - 1) * Math.PI * 1.05 - 0.1; ell(cx + Math.cos(a) * rx * 0.82, cy + Math.sin(a) * ry * 0.8, 3.4, 3, CREAM); } ell(cx, cy, rx * 0.95, ry * 0.9, CREAM); over([CREAM], () => { for (let i = 0; i < 6; i++) ell(cx - rx * 0.5 + i * rx * 0.2, cy + ry * 0.5, 2.2, 1.2, CREAMS); }); }

  /* ---------------- poses ---------------- */
  // cada pose: (t) desenha um quadro. Geometria baseada na do Kome, ajustada pelos parâmetros.
  function geo() {
    const cc = P.corpoComp, ca = P.corpoAlt, pl = P.pernaComp;
    const legLen = 8 * pl, foot = 37, hip = foot - legLen, bodyCY = hip - 3 - (ca - 1) * 3.2, bodyCX = 21;
    return { cc, ca, legLen, foot, hip, bodyCY, bodyCX, rx: 10.5 * cc, ry: 6.6 * ca, backHip: bodyCX - 6 * cc, frontHip: bodyCX + 6 * cc };
  }
  const POSES = {
    parado: { n: 8, fn(t, k, n) { stand(t, { breathe: true, blink: k === 5 }); } },
    andar: { n: 8, fn(t, k, n) { if (P.gait === 'pulo') return hop(k / n * Math.PI * 2, 0.8); stand(t, { ph: k / n * Math.PI * 2, amp: 3.5, lift: 2.7, walk: true }); } },
    correr: { n: 6, fn(t, k, n) { if (P.gait === 'pulo') return hop(k / n * Math.PI * 2, 1.5); stand(t, { ph: k / n * Math.PI * 2, amp: 5, lift: 2.6, gal: true }); } },
    pular: { n: 6, fn(t, k, n) { const up = [0, -1, -6, -8, -5, 0][k], tuck = k >= 2 && k <= 4 ? 3 : 0; stand(t, { by: up, air: k >= 2 && k <= 4, crouch: k === 0 || k === 5 ? 1.5 : 0, tuck, mouth: k >= 2 && k <= 4 ? 'open' : 'smile', ears: k >= 2 && k <= 3 ? 'back' : 'up' }); } },
    sentar: { n: 6, fn(t, k, n) { sit(k / n * Math.PI * 2, false, k === 4); } },
    abanar: { n: 6, fn(t, k, n) { sit(k / n * Math.PI * 2, true, false); } },
    dormir: { n: 6, fn(t, k, n) { lie(k / n * Math.PI * 2, true); } },
    comer: { n: 6, fn(t, k, n) { stand(t, { eat: Math.sin(k / n * Math.PI * 2) }); } },
    feliz: { n: 6, fn(t, k, n) { const hop2 = Math.abs(Math.sin(k / n * Math.PI * 2)) * 2.5; stand(t, { by: -hop2, mouth: 'tongue', eyes: 'happy', wag: Math.sin(k / n * Math.PI * 4) * 2 }); } },
  };
  function stepLeg(G, base, off, far, hipX, o) {
    const a = s(o.ph + off), x = base + a * o.amp, y = G.foot - Math.max(0, Math.cos(o.ph + off)) * o.lift - (o.tuck || 0) - (o.fly || 0);
    leg(hipX, G.hip + (o.by || 0) + (o.crouch || 0), o.air ? hipX + (far ? -2 : 2) : x, Math.min(G.foot, y), far);
  }
  function stand(t, o) {
    const G = geo(); o = Object.assign({ ph: 0, amp: 0, lift: 0, by: 0 }, o);
    let bob = 0, headDY = 0, tailW = 0, stretch = 0, ears = o.ears || 'up', mouth = o.mouth || 'smile', eyes = o.eyes || 'open';
    if (o.walk) { bob = Math.abs(s(o.ph)) * 1.15; headDY = s(o.ph * 2 + 1.2) * 0.55; tailW = s(o.ph) * 1.5; }
    else if (o.gal) { bob = Math.max(0, s(o.ph - 0.5)) * 3.2; stretch = 1 + Math.max(0, s(o.ph - 0.5)) * 1.3; ears = 'back'; mouth = 'tongue'; headDY = -s(o.ph - 0.5) * 0.8; tailW = s(o.ph) * 0.9; o.fly = bob * 0.75; }
    else if (o.breathe) { const b = s(t * Math.PI * 2 / 1.6); bob = b * 0.4; tailW = s(t * Math.PI * 4 / 1.6) * 1.2; if (o.blink) eyes = 'closed'; }
    else if (o.eat != null) { headDY = 8 * P.pernaComp + Math.max(0, o.eat) * 1.4; mouth = o.eat > 0.1 ? 'open' : 'closed'; eyes = 'happy'; ears = 'back'; tailW = o.eat * 1.8; }
    if (o.wag != null) tailW = o.wag;
    const by = -bob + (o.by || 0) + (o.crouch || 0); o.by = by - (o.crouch || 0);
    const cc = G.cc, crouch = o.crouch || 0;
    part('rabo'); tail(G.bodyCX - G.rx + 0.5 - stretch, G.bodyCY - G.ry * 0.9 + by, tailW);
    part('pernasTras'); if (o.gal) { stepLeg(G, G.backHip - 1, 0.45, true, G.backHip, o); stepLeg(G, G.backHip + 3, 0, false, G.backHip + 4 * cc, o); }
    else if (o.eat != null) { leg(G.backHip, G.hip + by, G.backHip, G.foot, true); leg(G.backHip + 4 * cc, G.hip + by, G.backHip + 4 * cc, G.foot, false); }
    else { stepLeg(G, G.backHip - 1, Math.PI, true, G.backHip, o); stepLeg(G, G.backHip + 3, 0, false, G.backHip + 4 * cc, o); }
    part('corpo'); ell(G.bodyCX, G.bodyCY + by, G.rx + stretch, G.ry - crouch * 0.3, FUR);
    over([FUR], () => ell(G.bodyCX + 1, G.bodyCY + by + G.ry * 0.55, G.rx * 0.95, G.ry * 0.45, FURS));
    if (P.crina) { const nx2 = G.bodyCX + G.rx * 0.7, ny2 = G.bodyCY + by - G.ry; for (let i = 0; i < 5; i++) ell(nx2 + i * 1.6, ny2 - i * 2.2, 2.2, 2, i % 2 ? PAT : PATS); }
    part('cremeCorpo'); ell(G.bodyCX, G.bodyCY + by + G.ry * 0.6, 7.5 * cc, 2.8 * G.ca, CREAM);
    part('corpo'); bodyPattern(G.bodyCX, G.bodyCY + by, G.rx, G.ry, 7); wool(G.bodyCX, G.bodyCY + by, G.rx + stretch, G.ry);
    part('cremeCorpo'); if (!P.la) ell(G.bodyCX + G.rx * 0.76, G.bodyCY + by - 1, 3.6, 4.6 * G.ca, P.padrao === 'panda' ? FUR : CREAM);
    part('pernasFrente');
    if (o.gal) { stepLeg(G, G.frontHip + 1, Math.PI + 0.45, true, G.frontHip, o); stepLeg(G, G.frontHip + 5, Math.PI, false, G.frontHip + 3, o); }
    else if (o.eat != null) { leg(G.frontHip, G.hip + by, G.frontHip + 1, G.foot, true); leg(G.frontHip + 3, G.hip + by, G.frontHip + 4, G.foot, false); }
    else { stepLeg(G, G.frontHip, 0, true, G.frontHip, o); stepLeg(G, G.frontHip + 4, Math.PI, false, G.frontHip + 3, o); }
    const hx = G.bodyCX + G.rx + 1.5 + stretch * (o.gal ? 0.6 : 1) + (o.eat != null ? 2 : 0), hy = G.bodyCY - 11 * P.cabeca + by + headDY + (P.corpoAlt - 1) * 1.5;
    neckAcc(G.bodyCX + G.rx * 0.8, G.bodyCY + by - G.ry * 0.5);
    head(hx, hy, { eyes, mouth, ears, tw: o.walk ? (s(o.ph * 3) > 0.9 ? 1 : 0) : 0 });
  }
  function hop(ph, k) { // coelho: pulinho
    const G = geo(), up = Math.max(0, s(ph)) * 4 * k, sq = Math.cos(ph) > 0.8 ? 1 : 0;
    stand(0, { by: -up, crouch: sq, air: up > 1.5, tuck: up > 1.5 ? 2 : 0, ears: up > 2 ? 'back' : 'up' });
  }
  function sit(ph, wagHard, blink) {
    const G = geo(), br = s(ph) * 0.7, cc = G.cc, ca = G.ca, gy = G.foot;
    const wag = wagHard ? s(ph * 3) * 2 : s(ph) * 0.9;
    part('rabo'); tail(G.bodyCX - 10 * cc, gy - 10 - (ca - 1) * 2, wag);
    part('pernasTras'); ell(G.bodyCX - 3 * cc, gy - 5.5, 7.5 * cc, 5 * ca, FURS); leg(G.bodyCX - 3 * cc, gy - 4, G.bodyCX + 1 * cc, gy, false);
    part('corpo'); ell(G.bodyCX, gy - 9 - br * 0.25 - (ca - 1) * 2, 8 * cc, (7 + br * 0.45) * ca, FUR);
    bodyPattern(G.bodyCX, gy - 9, 8 * cc, 7 * ca, 3); wool(G.bodyCX, gy - 9 - (ca - 1) * 2, 8 * cc, 7 * ca);
    part('cremeCorpo'); if (!P.la) ell(G.bodyCX + 5 * cc, gy - 9 - br * 0.25, 4 + br * 0.3, (5.4 + br * 0.35) * ca, P.padrao === 'panda' ? FUR : CREAM);
    part('pernasFrente'); leg(G.bodyCX + 4 * cc, gy - 8, G.bodyCX + 4 * cc, gy, true);
    leg(G.bodyCX + 8 * cc, gy - 8, G.bodyCX + 8.5 * cc, gy, false);
    neckAcc(G.bodyCX + 6 * cc, gy - 14 * ca);
    head(G.bodyCX + 9 * cc, gy - 21 * P.cabeca - br * 0.7 - (ca - 1) * 4, { eyes: wagHard ? 'happy' : blink ? 'closed' : 'open', mouth: wagHard ? 'tongue' : 'smile' });
  }
  function lie(ph, sleep) {
    const G = geo(), br = s(ph) * 0.6, cc = G.cc, ca = G.ca, gy = G.foot;
    part('rabo'); tail(G.bodyCX - 12 * cc, gy - 9, s(ph) * 0.5);
    part('corpo'); ell(G.bodyCX - 1, gy - 5.5 - br * 0.3, 12 * cc, (5.2 + br * 0.4) * ca, FUR); ell(G.bodyCX - 6 * cc, gy - 4, 6 * cc, 3.6 * ca, FURS); part('cremeCorpo'); ell(G.bodyCX + 1, gy - 2.6, 8.5 * cc, 2.2, CREAM);
    part('corpo'); bodyPattern(G.bodyCX - 1, gy - 6, 12 * cc, 5 * ca, 5); wool(G.bodyCX - 1, gy - 5.5, 12 * cc, 5.2 * ca);
    part('pernasTras'); rect(G.bodyCX - 10 * cc, gy - 2, 5, 2, P.padrao === 'meias' || P.padrao === 'panda' ? PAT : CREAM);
    part('pernasFrente'); line(G.bodyCX + 8 * cc, gy - 2.5, G.bodyCX + 15 * cc, gy - 1.5, 3 * P.pernaGross, P.padrao === 'panda' ? PAT : FUR); rect(G.bodyCX + 14 * cc, gy - 3, 4, 3, P.padrao === 'meias' || P.padrao === 'panda' ? PAT : CREAM);
    neckAcc(G.bodyCX + 9 * cc, gy - 9);
    head(G.bodyCX + 11 * cc, gy - 12 * P.cabeca - br * 0.5, { eyes: sleep ? 'closed' : 'open', mouth: sleep ? 'closed' : 'smile', ears: sleep ? 'back' : 'up' });
    part('rosto'); if (sleep && R >= 1) { const zx = G.bodyCX + 18 * cc, zy = gy - 26 - (ph % 6.28) * 0.6; if (s(ph) > 0) { dot(zx, zy, WHITE); dot(zx + 1, zy, WHITE); dot(zx + 1, zy + 1, WHITE); dot(zx, zy + 2, WHITE); dot(zx + 1, zy + 2, WHITE); } }
  }

  /* ---------------- paleta compilada ---------------- */
  const hx2 = h => S.hex2c(h);
  const mix = (a, b, t) => S.pack(Math.round(S.R(a) + (S.R(b) - S.R(a)) * t), Math.round(S.G(a) + (S.G(b) - S.G(a)) * t), Math.round(S.B(a) + (S.B(b) - S.B(a)) * t), 255);
  const DARK = S.pack(40, 20, 10, 255), LIGHT = S.pack(255, 250, 230, 255);
  function lutOf(p) {
    const c = p.cores, fur = hx2(c.pelo), cream = hx2(c.creme), pat = hx2(c.padrao), acc = hx2(p.corAcessorio || '#C8423A'), L = new Uint32Array(NC);
    // sombra puxando pro frio (deslocamento de matiz), igual ao que se ensina em pixel art
    const cool = (v, k) => { const [h0, s0, b0] = S.rgb2hsv(S.R(v), S.G(v), S.B(v)); const toward = 255, dh = ((toward - h0 + 540) % 360) - 180; return S.pack(...S.hsv2rgb((h0 + dh * k * 0.18 + 360) % 360, Math.min(1, s0 + k * 0.12), Math.max(0, b0 * (1 - k * 0.55))), 255); };
    L[FUR] = fur; L[FURS] = cool(fur, 0.5); L[FURD] = cool(fur, 0.8); L[FURL] = mix(fur, LIGHT, 0.35); L[CREAM] = cream; L[CREAMS] = mix(cream, fur, 0.35);
    L[EYE] = hx2(c.olho); L[IRIS] = hx2(c.olho); if (p.olhos === 'gato' || p.olhos === 'bravo') { L[IRIS] = hx2(c.olho); L[EYE] = hx2('#1A0F08'); }
    L[NOSE] = hx2(c.nariz); L[PINK] = hx2(c.lingua); L[BLUSH] = mix(fur, hx2(c.lingua), 0.6);
    L[ACC] = acc; L[ACCS] = cool(acc, 0.5); L[ACCL] = mix(acc, LIGHT, 0.4); if (p.acessorio === 'kasa' && !p.corAcessorio) { L[ACC] = hx2('#E3BC62'); L[ACCS] = hx2('#B98A3A'); L[ACCL] = mix(hx2('#E3BC62'), LIGHT, .35); }
    if (p.acessorio === 'oculos') L[ACCL] = hx2('#A8D8EA');
    L[PAT] = pat; L[PATS] = cool(pat, 0.45); L[LINE] = mix(fur, S.pack(20, 10, 5, 255), 0.8); if (S.rgb2hsv(S.R(fur), S.G(fur), S.B(fur))[2] < 0.35) L[LINE] = S.pack(14, 12, 11, 255);
    L[WHITE] = S.pack(255, 255, 255, 255); L[GOLD] = hx2('#FFD65C'); L[HORN] = hx2(p.chifre === 'vaca' ? '#F1EADB' : '#CF9E63'); L[HORNS] = hx2(p.chifre === 'vaca' ? '#CFC8B6' : '#A9763F');
    return L;
  }

  /* ---------------- API ---------------- */
  // render(params, pose, k) -> {buf, w, h}
  // ro = {only: Set de partes, flat: sem sombras (guia), outline: false}
  const FLATMAP = { [FURS]: FUR, [FURD]: FUR, [FURL]: FUR, [CREAMS]: CREAM, [PATS]: PAT, [ACCS]: ACC, [ACCL]: ACC, [HORNS]: HORN };
  function render(params, pose, k, n, ro) {
    ro = ro || {};
    P = Object.assign({}, SPECIES[params.especie] || SPECIES.cachorro, params); P.cores = Object.assign({}, (SPECIES[params.especie] || SPECIES.cachorro).cores, params.cores || {});
    R = params.res || 1; BW = GW * R; BH = GH * R; buf = new Uint8Array(BW * BH); clip = null; A = {}; ONLY = ro.only || null; PART = 'corpo';
    const PO = POSES[pose] || POSES.parado; n = n || PO.n; PO.fn(k / n * 1.6, k, n); ONLY = null;
    const L = lutOf(P), out = new Uint32Array(BW * BH), ln = L[LINE], outl = ro.outline !== false;
    if (ro.flat) for (let i = 0; i < buf.length; i++) if (FLATMAP[buf[i]]) buf[i] = FLATMAP[buf[i]];
    for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) { const i = y * BW + x, v = buf[i]; if (v) out[i] = L[v]; else if (outl && ((x + 1 < BW && buf[i + 1]) || (x > 0 && buf[i - 1]) || (y + 1 < BH && buf[i + BW]) || (y > 0 && buf[i - BW]))) out[i] = ln; }
    if (params.olhaEsq) { for (let y = 0; y < BH; y++) out.subarray(y * BW, y * BW + BW).reverse(); }
    return { buf: out, w: BW, h: BH };
  }
  // todas as poses pedidas -> quadros recortados juntos + tags
  function build(params, poses) {
    poses = poses || Object.keys(POSES); const frames = [], tags = [];
    poses.forEach((p, i) => { const n = POSES[p].n, from = frames.length; for (let k = 0; k < n; k++) frames.push(render(params, p, k, n)); tags.push({ name: p, from, to: frames.length - 1, dir: 'frente', cor: S.tagColor(i) }); });
    // recorte comum (mantém os pés alinhados)
    let bb = null; frames.forEach(f => { const q = S.bboxOf(f.buf, f.w, f.h); if (q) bb = bb ? { x: Math.min(bb.x, q.x), y: Math.min(bb.y, q.y), x2: Math.max(bb.x2, q.x + q.w), y2: Math.max(bb.y2, q.y + q.h) } : { x: q.x, y: q.y, x2: q.x + q.w, y2: q.y + q.h }; });
    const pad = 2, x0 = Math.max(0, bb.x - pad), y0 = Math.max(0, bb.y - pad), x1 = Math.min(frames[0].w, bb.x2 + pad), y1 = Math.min(frames[0].h, bb.y2 + 1);
    const w = x1 - x0, h = y1 - y0;
    return { w, h, tags, frames: frames.map(f => { const o = new Uint32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = f.buf[(y0 + y) * f.w + x0 + x]; return o; }) };
  }
  // camadas separadas: Contorno, Rabo, Pernas de trás, Corpo, Pernas da frente, Cabeça, Rosto (+ Retoques vazia)
  const LAYER_GROUPS = [['Rabo', ['rabo']], ['Pernas de trás', ['pernasTras']], ['Corpo', ['corpo', 'cremeCorpo']], ['Pernas da frente', ['pernasFrente']], ['Cabeça', ['cabeca', 'orelhas', 'cremeCabeca', 'acessorio']], ['Rosto', ['rosto']]];
  function buildLayered(params, poses) {
    poses = poses || Object.keys(POSES); const tags = [], full = [], groups = LAYER_GROUPS.map(() => []), outl = [];
    poses.forEach((p2, i) => { const n = POSES[p2].n, from = full.length; for (let k = 0; k < n; k++) { const f = render(params, p2, k, n), noO = render(params, p2, k, n, { outline: false }); full.push(f); const o = new Uint32Array(f.buf.length); for (let q = 0; q < o.length; q++) if ((f.buf[q] >>> 24) && !(noO.buf[q] >>> 24)) o[q] = f.buf[q]; outl.push(o); LAYER_GROUPS.forEach((gr, gi) => groups[gi].push(render(params, p2, k, n, { only: new Set(gr[1]), outline: false }).buf)); } tags.push({ name: p2, from, to: full.length - 1, dir: 'frente', cor: S.tagColor(i) }); });
    const W0 = full[0].w, H0 = full[0].h; let bb = null; full.forEach(f => { const q = S.bboxOf(f.buf, W0, H0); if (q) bb = bb ? { x: Math.min(bb.x, q.x), y: Math.min(bb.y, q.y), x2: Math.max(bb.x2, q.x + q.w), y2: Math.max(bb.y2, q.y + q.h) } : { x: q.x, y: q.y, x2: q.x + q.w, y2: q.y + q.h }; });
    const x0 = Math.max(0, bb.x - 2), y0 = Math.max(0, bb.y - 2), w = Math.min(W0, bb.x2 + 2) - x0, h = Math.min(H0, bb.y2 + 1) - y0;
    const crop = b => { const o = new Uint32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) o[y * w + x] = b[(y0 + y) * W0 + x0 + x]; return o.some(v => v >>> 24) ? o : null; };
    return { w, h, tags, flat: full.map(f => crop(f.buf)), layers: [['Contorno', outl.map(crop)]].concat(LAYER_GROUPS.map((gr, gi) => [gr[0], groups[gi].map(crop)])) };
  }
  // estágios cumulativos pro modo guiado (sem sombra até o passo de sombra; sem contorno até o final)
  function stages(params, pose, steps) { const acc = new Set(); return steps.map(st => { st.parts.forEach(p2 => acc.add(p2)); return render(params, pose, 0, 1, { only: new Set(acc), flat: !st.shade, outline: !!st.outline }); }); }
  S.Creature = { SPECIES, POSES, ACCS: ACCS_LIST, render, build, buildLayered, stages, LAYER_GROUPS };

  /* ---------------- janela do construtor ---------------- */
  let cur = { especie: 'cachorro', res: 1, acessorio: 'kasa', cores: {} }, pvPose = 'andar';
  S.openCreature = function (startParams) {
    if (startParams) cur = JSON.parse(JSON.stringify(startParams));
    const { h } = S; let raf = 0, k = 0, last = 0;
    const ov = h('div', { class: 'ov' }), box = h('div', { class: 'dlg lib' }), left = h('div', { class: 'cside' }), right = h('div', { class: 'cmain' });
    const close = () => { cancelAnimationFrame(raf); ov.remove(); };
    box.append(h('div', { class: 'dhead' }, h('b', null, 'Construtor de Bicho'), h('span', { class: 'hint' }, 'mesma técnica do Kome: peça por peça, 3 tons de pelo, contorno da cor do pelo'), h('span', { style: 'flex:1' }), h('button', { class: 'ib', onclick: close }, '×')), h('div', { class: 'cbody' }, left, right)); ov.appendChild(box); document.body.appendChild(ov);
    const pv = h('canvas', { width: 420, height: 220, class: 'cpv' }), strip = h('div', { class: 'cstrip' });
    const sp = () => SPECIES[cur.especie];
    const val = key => cur[key] != null ? cur[key] : sp()[key];
    const col = key => (cur.cores && cur.cores[key]) || sp().cores[key];
    function slider(label, key, min, max, step) { const v = val(key); return h('label', { class: 'crow' }, h('span', null, label), h('input', { type: 'range', min, max, step: step || 0.05, value: v, oninput: e => { cur[key] = +e.target.value; refresh(); } })); }
    function select(label, key, opts) { const v = val(key); return h('label', { class: 'crow' }, h('span', null, label), h('select', { onchange: e => { cur[key] = e.target.value; refresh(); } }, ...Object.entries(opts).map(([k2, t]) => h('option', { value: k2, selected: k2 === v }, t)))); }
    function color(label, key) { return h('label', { class: 'crow' }, h('span', null, label), h('input', { type: 'color', value: col(key), oninput: e => { cur.cores = Object.assign({}, cur.cores, { [key]: e.target.value }); refresh(); } })); }
    function buildLeft() {
      left.innerHTML = '';
      left.append(h('h4', null, 'Espécie'), h('div', { class: 'chips' }, ...Object.entries(SPECIES).map(([k2, v]) => h('button', { class: 'chip' + (k2 === cur.especie ? ' on' : ''), onclick: () => { cur = { especie: k2, res: cur.res, acessorio: cur.acessorio, cores: {} }; buildLeft(); refresh(); } }, v.nome))),
        h('h4', null, 'Resolução'), h('div', { class: 'chips' }, ...[[1, '1× (igual Kome)'], [2, '2× detalhado'], [3, '3× HD']].map(([r, t]) => h('button', { class: 'chip' + (cur.res === r ? ' on' : ''), onclick: () => { cur.res = r; buildLeft(); refresh(); } }, t))),
        h('h4', null, 'Corpo'), slider('cabeça', 'cabeca', 0.8, 1.35), slider('focinho', 'focinho', 0.4, 1.6), slider('comprimento', 'corpoComp', 0.75, 1.45), slider('gordinho', 'corpoAlt', 0.75, 1.5), slider('perna', 'pernaComp', 0.6, 1.5), slider('perna grossa', 'pernaGross', 0.7, 1.7),
        h('h4', null, 'Detalhes'), select('orelha', 'orelha', { pontuda: 'pontuda', gato: 'de gato', redonda: 'redonda', caida: 'caída', coelho: 'de coelho', nenhuma: 'nenhuma' }), slider('tamanho da orelha', 'orelhaTam', 0.6, 1.6), select('rabo', 'rabo', { nenhum: 'sem rabo', cavalo: 'de cavalo (fios)', enrolado: 'enrolado (shiba)', gato: 'de gato', toco: 'toquinho', raposa: 'fofo (raposa)', lobo: 'peludo caído', listrado: 'listrado (tanuki)', coelho: 'pompom', porco: 'cachinho' }),
        select('olhos', 'olhos', { normal: 'normal (Kome)', grande: 'grandão', pequeno: 'pequeno', gato: 'de gato', bravo: 'bravo' }), select('padrão', 'padrao', { nenhum: 'liso', listras: 'listras', malhado: 'malhado', manchas: 'pintinhas', meias: 'meias', mascara: 'máscara', panda: 'panda' }),
        select('chifre', 'chifre', { nenhum: 'sem chifre', cervo: 'galhada (cervo)', vaca: 'chifrinho (vaca)' }),
        h('label', { class: 'crow' }, h('span', null, 'crina'), h('input', { type: 'checkbox', checked: !!val('crina'), onchange: e => { cur.crina = e.target.checked; refresh(); } })), h('label', { class: 'crow' }, h('span', null, 'lã fofinha'), h('input', { type: 'checkbox', checked: !!val('la'), onchange: e => { cur.la = e.target.checked; refresh(); } })),
        h('label', { class: 'crow' }, h('span', null, 'bigode'), h('input', { type: 'checkbox', checked: !!val('bigode'), onchange: e => { cur.bigode = e.target.checked; refresh(); } })), h('label', { class: 'crow' }, h('span', null, 'bochecha rosada'), h('input', { type: 'checkbox', checked: val('bochecha') !== false, onchange: e => { cur.bochecha = e.target.checked; refresh(); } })),
        h('h4', null, 'Cores'), color('pelo', 'pelo'), color('creme', 'creme'), color('padrão', 'padrao'), color('olho', 'olho'), color('nariz', 'nariz'), color('língua', 'lingua'),
        h('h4', null, 'Acessório'), select('usar', 'acessorio', ACCS_LIST), h('label', { class: 'crow' }, h('span', null, 'cor'), h('input', { type: 'color', value: cur.corAcessorio || '#C8423A', oninput: e => { cur.corAcessorio = e.target.value; refresh(); } })),
        h('div', { class: 'row' }, h('button', { class: 'tb', onclick: () => { const ks = Object.keys(SPECIES); cur = { especie: ks[Math.floor(Math.random() * ks.length)], res: cur.res, acessorio: Object.keys(ACCS_LIST)[Math.floor(Math.random() * 7)], cores: {} }; const sp2 = SPECIES[cur.especie]; ['cabeca', 'focinho', 'corpoComp', 'corpoAlt', 'pernaComp'].forEach(k2 => cur[k2] = sp2[k2] * (0.88 + Math.random() * 0.24)); const hue = Math.random() * 360; const [r, g, b] = S.hsv2rgb(hue, 0.35 + Math.random() * 0.4, 0.55 + Math.random() * 0.4); if (Math.random() < 0.5) cur.cores.pelo = S.c2hex(S.pack(r, g, b, 255)); buildLeft(); refresh(); } }, 'Sortear bicho')));
    }
    let frames = [];
    function refresh() { frames = []; const n = POSES[pvPose].n; for (let i = 0; i < n; i++) frames.push(S.toCanvas(render(cur, pvPose, i, n).buf, GW * (cur.res || 1), GH * (cur.res || 1))); buildStrip(); }
    function buildStrip() { strip.innerHTML = ''; Object.keys(POSES).forEach(p => { const r = render(cur, p, 1, POSES[p].n), cv = S.toCanvas(r.buf, r.w, r.h); const b = h('button', { class: 'cpose' + (p === pvPose ? ' on' : ''), onclick: () => { pvPose = p; refresh(); } }, cv, h('span', null, p)); strip.appendChild(b); }); }
    right.append(pv, h('div', { class: 'hint' }, 'Prévia na escala do jogo, com o Kome do lado. Clique numa pose pra ver ela animando.'), strip,
      h('div', { class: 'row' }, h('button', { class: 'tb big green', onclick: () => { make(Object.keys(POSES)); close(); } }, 'Criar com 9 animações e camadas separadas'), h('button', { class: 'tb big', onclick: () => { make([pvPose]); close(); } }, 'Só "' + pvPose + '"'), h('span', { class: 'hint' }, 'abre como desenho com tags e uma camada "Retoques" vazia por cima pra você personalizar à mão')));
    function loop(now) {
      if (now - last > 95) { last = now; k++; }
      const g = pv.getContext('2d'); g.imageSmoothingEnabled = false;
      try { S.E.Nature.sky(g, pv.width, pv.height, { tod: 0.35, t: now / 1000 }); S.E.Nature.ground(g, 0, pv.width, pv.height - 30, { t: now / 1000, depth: 30, seed: 2 }); } catch (e) { g.fillStyle = '#9FD3E8'; g.fillRect(0, 0, pv.width, pv.height); }
      const zoom = 3, gy = pv.height - 30;
      if (frames.length) { const fr = frames[k % frames.length], res = cur.res || 1; const z = zoom / res; g.drawImage(fr, Math.round(pv.width * 0.62 - fr.width * z / 2), Math.round(gy - (37 + OY + 1) * res * z), fr.width * z, fr.height * z); }
      try { S.E.drawShiba(g, 90, gy, 'wag', now / 1000, { scale: zoom }); } catch (e) { }
      raf = requestAnimationFrame(loop);
    }
    function make(poses) {
      S.openCreatureDoc(cur, poses);
      return;
      d.meta = { tipo: 'bicho', bicho: JSON.parse(JSON.stringify(cur)), altura: r.h }; S.openDoc(d); S.setWorkspace('draw'); S.toast(nm + ' criado: ' + r.frames.length + ' quadros, ' + r.tags.length + ' animações');
    }
    buildLeft(); refresh(); raf = requestAnimationFrame(loop);
  };
  // abre um bicho como desenho com camadas separadas por parte, tags e paleta
  S.openCreatureDoc = function (params, poses, name) {
    const r = buildLayered(params, poses), nm = name || SPECIES[params.especie].nome.split(' (')[0];
    const d = S.newDoc(r.w, r.h, { name: nm }); d.frames = r.flat.map(() => ({ dur: 100 }));
    d.layers = r.layers.map(([n, cels]) => S.newLayer(n, { cels })).concat([S.newLayer('Retoques', { cels: r.flat.map(() => null) })]); d.cur = { f: 0, l: d.layers.length - 1 }; d.tags = r.tags;
    const set = new Set(); r.flat.forEach(f => f && f.forEach(v => { if (v >>> 24) set.add(v >>> 0); })); d.pal = [...set].slice(0, 64);
    d.meta = { tipo: 'bicho', bicho: JSON.parse(JSON.stringify(params)), altura: r.h }; S.openDoc(d); S.setWorkspace('draw'); S.toast(nm + ': ' + r.flat.length + ' quadros, ' + r.tags.length + ' animações, ' + d.layers.length + ' camadas');
    return d;
  };
})();
