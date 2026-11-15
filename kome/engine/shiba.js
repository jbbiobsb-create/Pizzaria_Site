/* Kome Engine v1.0 · shiba.js
   O Kome (shiba chibi de chapéu kasa) desenhado em pixel art procedural numa grade 48x44.
   - E.ShibaPX      rasterizador original do rascunho (poses antigas pixel a pixel iguais) + poses novas
   - E.PALS         paletas {h,g,o,c,k,n,p}
   - E.drawShiba    desenha com os pés em (x,y), com cache de frames (aguenta 100+ shibas por frame)
   - E.drawShibaHead close de rosto com expressões para cutscenes
   - E.shibaAnchor  âncoras (pata, boca, cabeça, costas, topo do chapéu) por pose
   - E.Actor        shiba com estado, objeto na pata e balão de fala
   Depende só de core.js. */
(function () {
  'use strict';
  const E = (window.KomeEngine = window.KomeEngine || {});
  if (!E.U) throw new Error('KomeEngine: carregue core.js antes de shiba.js');
  const U = E.U;

  /* =====================================================================
     1. Rasterizador: buffer de índices de paleta (Uint8) reaproveitado
     ===================================================================== */
  const W = 48, H = 44, OY = 4;

  // índices de cor (0 = vazio). A paleta compilada é um Uint32Array indexado por eles.
  const FUR = 1, FURS = 2, FURD = 3, CREAM = 4, CREAMS = 5, EYE = 6, NOSE = 7, PINK = 8, BLUSH = 9,
    HAT = 10, HATS = 11, HATL = 12, LINE = 13, WHITE = 14, TEAR = 15, TEARL = 16, VEIN = 17, GOLD = 18;
  const NCOL = 32;

  const bodyBuf = new Uint8Array(W * H);
  // alvo atual das primitivas (trocado para o buffer do close de rosto quando preciso)
  let buf = bodyBuf, BW = W, BH = H, BOY = OY;
  let dry = false;                       // true = só calcula âncoras, não pinta

  function set(x, y, c) {
    if (dry) return;
    x = Math.round(x); y = Math.round(y + BOY);
    if (x >= 0 && y >= 0 && x < BW && y < BH && c) buf[y * BW + x] = c;
  }
  // ell/tri varrem pixels inteiros, então escrevem direto no buffer (mesmo resultado de set(), sem arredondar)
  function ell(cx, cy, rx, ry, c) {
    if (dry) return;
    let y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry), x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    if (y0 < -BOY) y0 = -BOY; if (y1 > BH - 1 - BOY) y1 = BH - 1 - BOY;
    if (x0 < 0) x0 = 0; if (x1 > BW - 1) x1 = BW - 1;
    for (let y = y0; y <= y1; y++) {
      const dy = (y + 0.5 - cy) / ry, dy2 = dy * dy, row = (y + BOY) * BW;
      for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx;
        if (dx * dx + dy2 <= 1) buf[row + x] = c;
      }
    }
  }
  function rect(x, y, w, h, c) {
    if (dry) return;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(x + i, y + j, c);
  }
  function triSide(px, py, qx, qy, rx, ry) { return (px - rx) * (qy - ry) - (qx - rx) * (py - ry); }
  function tri(ax, ay, bx, by, cx, cy, c) {
    if (dry) return;
    let minX = Math.floor(Math.min(ax, bx, cx)), maxX = Math.ceil(Math.max(ax, bx, cx));
    let minY = Math.floor(Math.min(ay, by, cy)), maxY = Math.ceil(Math.max(ay, by, cy));
    if (minY < -BOY) minY = -BOY; if (maxY > BH - 1 - BOY) maxY = BH - 1 - BOY;
    if (minX < 0) minX = 0; if (maxX > BW - 1) maxX = BW - 1;
    for (let y = minY; y <= maxY; y++) {
      const row = (y + BOY) * BW;
      for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const d1 = triSide(px, py, ax, ay, bx, by), d2 = triSide(px, py, bx, by, cx, cy), d3 = triSide(px, py, cx, cy, ax, ay);
        const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
        if (!(neg && pos)) buf[row + x] = c;
      }
    }
  }
  function line(x0, y0, x1, y1, w, c) {
    if (dry) return;
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) { const t = i / n; ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, w / 2, c); }
  }

  // contorno 4-vizinhos + conversão índice -> RGBA empacotado, direto no Uint32 do ImageData.
  // under (opcional) = pixels que aparecem onde o sprite é vazio (a sombra do chão, já pronta em Uint32)
  function blit(src, w, h, lut, dst, under) {
    const ln = lut[LINE];
    let i = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
      const v = src[i];
      if (v) dst[i] = lut[v];
      else if ((x + 1 < w && src[i + 1]) || (x > 0 && src[i - 1]) || (y + 1 < h && src[i + w]) || (y > 0 && src[i - w])) dst[i] = ln;
      else dst[i] = under ? under[i] : 0;
    }
  }

  /* =====================================================================
     2. Paletas
     ===================================================================== */
  const PALS = {
    kome:  { h: '#E3BC62', g: '#B98A3A', o: '#D9A066', c: '#EBEBEB', k: '#2A1A10', n: '#2A1A10', p: '#D95763' },
    goma:  { h: '#C9CED6', g: '#8E96A3', o: '#B88E62', c: '#EFE0C4', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' },
    kuro:  { h: '#E3BC62', g: '#B98A3A', o: '#34302C', c: '#C98A4A', k: '#F2E6C9', n: '#0E0C0B', p: '#E8707A' },
    shiro: { h: '#7FA7C9', g: '#4E7397', o: '#F1EADB', c: '#FFFFFF', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' },
    /* novas (mesmo formato: h chapéu, g sombra do chapéu, o pelo, c creme, k olho, n focinho, p língua) */
    aka:    { h: '#E3BC62', g: '#B98A3A', o: '#C8663A', c: '#F6E7CF', k: '#2A1A10', n: '#2A1A10', p: '#E8707A' },
    cha:    { h: '#D9C7A0', g: '#A8946A', o: '#8E5E3C', c: '#E9D2AE', k: '#22140C', n: '#22140C', p: '#E0707A' },
    yuki:   { h: '#D8574E', g: '#A23A36', o: '#E6EEF5', c: '#FFFFFF', k: '#2B3A55', n: '#2B3A55', p: '#F08A96' },
    sakura: { h: '#F29CB4', g: '#C96A88', o: '#F2CDB6', c: '#FFF6EE', k: '#3A2018', n: '#3A2018', p: '#E8607A' },
    matcha: { h: '#8DB255', g: '#5F8236', o: '#D9A066', c: '#EBEBEB', k: '#2A1A10', n: '#2A1A10', p: '#D95763' },
    kin:    { h: '#C8423A', g: '#93302A', o: '#EDBE4A', c: '#FFF3C4', k: '#3A2408', n: '#3A2408', p: '#E8707A' },
    sumi:   { h: '#C8423A', g: '#93302A', o: '#5A5F6B', c: '#D9DDE3', k: '#16181D', n: '#16181D', p: '#E8707A' },
  };

  const LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  function pack(c) {
    return (LE ? (255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0] : (c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0;
  }
  const hexc = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255]; };
  const mixc = (a, b, t) => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)).concat([255]);

  let palSeq = 0;
  // compila {h,g,o,c,k,n,p} -> {lut:Uint32Array, id}; as fórmulas de sombra são as do rascunho
  function compilePal(p) {
    if (p.__K) return p.__K;
    const fur = hexc(p.o), cream = hexc(p.c), hat = hexc(p.h);
    const lut = new Uint32Array(NCOL);
    lut[FUR] = pack(fur); lut[FURS] = pack(mixc(fur, [40, 20, 10], 0.28)); lut[FURD] = pack(mixc(fur, [40, 20, 10], 0.45));
    lut[CREAM] = pack(cream); lut[CREAMS] = pack(mixc(cream, fur, 0.35));
    lut[EYE] = pack(hexc(p.k)); lut[NOSE] = pack(hexc(p.n)); lut[PINK] = pack(hexc(p.p));
    lut[BLUSH] = pack(mixc(fur, hexc(p.p), 0.7));
    lut[HAT] = pack(hat); lut[HATS] = pack(hexc(p.g)); lut[HATL] = pack(mixc(hat, [255, 250, 230], 0.35));
    lut[LINE] = pack(mixc(fur, [20, 10, 5], 0.8)); lut[WHITE] = pack([255, 255, 255, 255]);
    lut[TEAR] = pack([98, 178, 232, 255]); lut[TEARL] = pack([205, 236, 255, 255]);
    lut[VEIN] = pack([214, 64, 54, 255]); lut[GOLD] = pack([255, 214, 92, 255]);
    const K = { lut, id: palSeq++ };
    try { Object.defineProperty(p, '__K', { value: K, enumerable: false, configurable: true }); } catch (e) { p.__K = K; }
    return K;
  }
  // resolve nome ou objeto de paleta
  function getPal(p) {
    if (typeof p === 'string' || p == null) p = PALS[p || 'kome'] || PALS.kome;
    return p;
  }

  /* =====================================================================
     3. Estado de desenho (opções da chamada atual) e âncoras capturadas
     ===================================================================== */
  const ShibaPX = { W, H, OY, quiet: false, tilt: 0, look: null, hatOn: true, mouthOverride: null, eyesOverride: null, mouth: [0, 0] };
  const S = { fast: 0 };                                   // parâmetros extras de pose (drive: orelhas pra trás)
  // âncoras em coordenadas da grade, preenchidas a cada pose()
  const A = { pawX: 0, pawY: 0, headX: 0, headY: 0, mouthX: 0, mouthY: 0, hatX: 0, hatY: 0, backX: 0, backY: 0, holdX: 0, holdY: 0, hasHold: false };

  /* =====================================================================
     4. Peças: perna, rabo, vida ociosa, cabeça  (porte fiel do rascunho)
     ===================================================================== */
  /* leg: do quadril ao pé, grossa, com patinha creme */
  function leg(x0, y0, x1, y1, far) {
    line(x0, y0, x1, y1 - 1, 3.2, far ? FURD : FURS);
    line(x0, y0, x1, y1 - 1, 2.2, far ? FURS : FUR);
    rect(Math.round(x1) - 1, Math.round(y1) - 1, 3, 2, far ? CREAMS : CREAM);
    if (!far) { A.pawX = x1; A.pawY = y1 - 1; }           // a última pata "de perto" vira a âncora padrão
  }
  /* braço dobrado (ombro -> cotovelo -> pata) no mesmo traço da perna */
  function arm(x0, y0, ex, ey, x1, y1, far) {
    line(x0, y0, ex, ey, 3.2, far ? FURD : FURS);
    line(x0, y0, ex, ey, 2.2, far ? FURS : FUR);
    leg(ex, ey, x1, y1, far);
  }
  function tail(cx, cy, wag) {
    const a = wag;
    line(cx + 4, cy + 4, cx + 1 + a * 0.5, cy + 1, 3.5, FUR);
    ell(cx + a, cy, 4.8, 4.4, FUR); ell(cx + a - 0.9, cy - 0.7, 3.5, 3.1, CREAM);
    ell(cx + a + 0.8, cy + 0.8, 2.7, 2.4, FUR); ell(cx + a + 1.1, cy + 1.1, 1.1, 1, FURS);
    set(cx + a - 2.6, cy - 2.2, WHITE);
  }
  /* vida ociosa: tudo derivado do tempo (sem estado salvo). Piscada simples, dupla ou lenta;
     tremida de orelha; inclinada de cabeça; olhar que passeia; rajadas de rabo */
  const hsh = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
  const LF = { blink: false, half: false, tw: 0, tilt: 0, look: null, wagK: 0 };
  const lookArr = [0, 0];
  function life(t) {
    LF.blink = false; LF.half = false; LF.tw = 0; LF.tilt = 0; LF.look = null; LF.wagK = 0;
    if (t < 2) return LF;
    if (ShibaPX.quiet) { LF.blink = (t % 3.7) < 0.12; return LF; }
    const bw = Math.floor(t / 3.1), d = t - bw * 3.1 - (0.4 + hsh(bw) * 2.2), kind = hsh(bw + 0.5);
    if (kind < 0.14) { LF.blink = d >= 0.08 && d < 0.5; LF.half = (d >= 0 && d < 0.08) || (d >= 0.5 && d < 0.62); }
    else LF.blink = (d >= 0 && d < 0.11) || (kind > 0.7 && d >= 0.24 && d < 0.35);
    const ew = Math.floor(t / 4.3), ed = t - ew * 4.3 - (0.5 + hsh(ew + 9.1) * 3.2);
    LF.tw = hsh(ew + 3.3) < 0.55 && ed >= 0 && ed < 0.32 ? (Math.floor(ed / 0.08) % 2 ? 1 : -1) : 0;
    const hw = Math.floor(t / 7.7), ho = t - hw * 7.7, hs = 1 + hsh(hw + 5.7) * 4.5;
    LF.tilt = hsh(hw + 1.9) < 0.3 && ho >= hs && ho < hs + 1.4 ? (hsh(hw + 2.2) < 0.5 ? 1 : -1) : 0;
    const gw = Math.floor(t / 5.3), go = t - gw * 5.3, gs = 0.6 + hsh(gw + 7.7) * 3;
    if (hsh(gw + 4.1) < 0.45 && go >= gs && go < gs + 1.2) {
      lookArr[0] = hsh(gw + 6.6) < 0.5 ? -1 : 1; lookArr[1] = hsh(gw + 8.8) < 0.3 ? -1 : 0; LF.look = lookArr;
    }
    const ww = Math.floor(t / 6.1), wo = t - ww * 6.1, ws = 0.5 + hsh(ww + 2.7) * 3.6;
    LF.wagK = hsh(ww + 0.9) < 0.5 && wo >= ws && wo < ws + 1.6 ? Math.sin((wo - ws) / 1.6 * Math.PI) : 0;
    return LF;
  }

  const EYES = ['open', 'half', 'happy', 'wide', 'spiral', 'squint', 'closed', 'wet', 'shock', 'sparkle', 'tight', 'sad', 'angry'];
  const MOUTHS = ['closed', 'open', 'smile', 'tongue', 'yawn', 'grit', 'teeth', 'frown', 'gasp', 'smug', 'none'];

  /* head(hx,hy,eyes,mouth,ears,hat,tilt,tw,look): a cabeça de perfil com chapéu kasa.
     eyes: ver EYES · mouth: ver MOUTHS · ears: 'up'|'back' */
  function head(hx, hy, eyes, mouth, ears, hatOpt, tilt, tw, look) {
    if (eyes === undefined) eyes = 'open';
    if (mouth === undefined) mouth = 'closed';
    if (ears === undefined) ears = 'up';
    if (tilt === undefined) tilt = ShibaPX.tilt || 0;
    if (tw === undefined) tw = 0;
    const hat = hatOpt !== false && ShibaPX.hatOn !== false;
    const MO = ShibaPX.mouthOverride || (mouth === 'grit' ? 'smile' : mouth);
    if (ShibaPX.eyesOverride) eyes = ShibaPX.eyesOverride;
    A.headX = hx; A.headY = hy; A.mouthX = hx + 8; A.mouthY = hy + 5; A.hatX = hx - 1 + tilt * 0.5; A.hatY = hat ? hy - 14 : hy - 8;
    // orelha de trás
    if (ears === 'back') { tri(hx - 6, hy - 3, hx - 11, hy - 6, hx - 3, hy - 6, FURS); }
    else { tri(hx - 6 + tilt, hy - 6, hx - 4 + tilt, hy - 13, hx - 1, hy - 7, FURS); tri(hx - 5 + tilt, hy - 7, hx - 4 + tilt, hy - 11, hx - 2, hy - 7, CREAMS); }
    ell(hx, hy, 8.6, 8.2, FUR);
    ell(hx + 0.5, hy + 4.6, 6.4, 3.6, CREAM);
    ell(hx + 5.6, hy + 3.4, 4.6, 3.2, CREAM);
    rect(hx - 2, hy - 4, 2, 1, CREAM); rect(hx + 2, hy - 4, 2, 1, CREAM);
    ell(hx - 2.6, hy + 2.6, 2.2, 1.3, BLUSH);
    // olho
    let ex = hx + 2, ey = hy - 1;
    const lk = ShibaPX.look || look;
    if (lk && (eyes === 'open' || eyes === 'wide')) { ex += lk[0]; ey += lk[1]; }
    if (!dry) { ShibaPX.mouth[0] = hx + 8; ShibaPX.mouth[1] = hy + 5 + OY; }   // global do rascunho: só o desenho de verdade atualiza
    if (eyes === 'open') { rect(ex - 1, ey - 1, 3, 4, EYE); rect(ex, ey, 1, 1, WHITE); rect(ex - 1, ey - 1, 1, 1, WHITE); }
    else if (eyes === 'half') { rect(ex - 1, ey + 1, 3, 2, EYE); rect(ex - 1, ey, 3, 1, LINE); set(ex, ey + 1, WHITE); }
    else if (eyes === 'happy') { set(ex - 1, ey + 2, EYE); set(ex, ey + 1, EYE); set(ex + 1, ey + 1, EYE); set(ex + 2, ey + 2, EYE); }
    else if (eyes === 'wide') { rect(ex - 1, ey - 2, 3, 5, EYE); rect(ex - 1, ey - 2, 1, 2, WHITE); set(ex + 1, ey + 1, WHITE); }
    else if (eyes === 'spiral') { rect(ex - 2, ey - 1, 4, 1, EYE); rect(ex + 1, ey, 1, 3, EYE); rect(ex - 2, ey + 2, 3, 1, EYE); set(ex - 2, ey, EYE); set(ex - 1, ey + 1, EYE); }
    else if (eyes === 'squint') { rect(ex - 1, ey, 3, 2, EYE); set(ex + 1, ey, WHITE); set(ex - 1, ey - 2, LINE); set(ex, ey - 2, LINE); set(ex + 1, ey - 1, LINE); set(ex + 2, ey - 1, LINE); }
    /* ---- olhos novos ---- */
    else if (eyes === 'wet') {            // olhão molhado de choro: brilho grande em cima, água embaixo
      rect(ex - 2, ey - 2, 4, 5, EYE); rect(ex - 2, ey - 2, 2, 2, WHITE); set(ex + 1, ey, WHITE);
      rect(ex - 2, ey + 2, 4, 1, TEARL); set(ex - 1, ey - 3, LINE); set(ex, ey - 4, LINE); set(ex + 1, ey - 4, LINE);
    }
    else if (eyes === 'shock') {          // olho arregalado: branco grande com pupila pequena
      rect(ex - 2, ey - 2, 4, 5, WHITE); rect(ex - 1, ey - 3, 2, 1, WHITE); rect(ex - 1, ey + 3, 2, 1, WHITE);
      rect(ex, ey, 1, 2, EYE);
    }
    else if (eyes === 'sparkle') {        // olho brilhando
      rect(ex - 2, ey - 2, 4, 5, EYE); rect(ex - 1, ey - 2, 2, 2, WHITE); set(ex - 2, ey - 1, WHITE); set(ex + 1, ey + 1, WHITE); set(ex - 1, ey + 2, GOLD);
    }
    else if (eyes === 'tight') {          // > apertado de esforço/alegria
      set(ex - 1, ey - 1, EYE); set(ex, ey, EYE); set(ex + 1, ey + 1, EYE); set(ex, ey + 2, EYE); set(ex - 1, ey + 3, EYE);
    }
    else if (eyes === 'sad') {            // olho caído com sobrancelha triste
      rect(ex - 1, ey, 3, 3, EYE); set(ex - 1, ey, WHITE); set(ex, ey + 1, WHITE);
      set(ex - 2, ey - 1, LINE); set(ex - 1, ey - 2, LINE); set(ex, ey - 2, LINE); set(ex + 1, ey - 3, LINE);
    }
    else if (eyes === 'angry') {          // olho aberto com sobrancelha brava
      rect(ex - 1, ey - 1, 3, 4, EYE); set(ex, ey + 1, WHITE);
      set(ex - 2, ey - 3, LINE); set(ex - 1, ey - 3, LINE); set(ex, ey - 2, LINE); set(ex + 1, ey - 2, LINE); set(ex + 2, ey - 1, LINE);
    }
    else { rect(ex - 1, ey + 2, 4, 1, EYE); }
    // focinho e boca
    rect(hx + 9, hy + 1, 2, 2, NOSE); set(hx + 8, hy + 1, NOSE); set(hx + 9, hy + 1, CREAMS);
    if (MO === 'open') { rect(hx + 6, hy + 5, 4, 2, LINE); rect(hx + 7, hy + 6, 2, 2, PINK); }
    else if (MO === 'smile') { set(hx + 6, hy + 4, LINE); set(hx + 7, hy + 5, LINE); set(hx + 8, hy + 5, LINE); set(hx + 9, hy + 4, LINE); set(hx + 7, hy + 6, PINK); set(hx + 8, hy + 6, PINK); }
    else if (MO === 'tongue') { rect(hx + 6, hy + 5, 4, 1, LINE); rect(hx + 7, hy + 6, 2, 2, PINK); }
    else if (MO === 'yawn') { rect(hx + 5, hy + 3, 5, 5, LINE); rect(hx + 6, hy + 5, 3, 3, PINK); }
    else if (MO === 'grit' || MO === 'teeth') { rect(hx + 6, hy + 5, 4, 1, LINE); set(hx + 7, hy + 6, WHITE); set(hx + 9, hy + 6, WHITE); }
    /* ---- bocas novas ---- */
    else if (MO === 'frown') { set(hx + 6, hy + 6, LINE); set(hx + 7, hy + 5, LINE); set(hx + 8, hy + 5, LINE); set(hx + 9, hy + 6, LINE); }
    else if (MO === 'gasp') { rect(hx + 6, hy + 4, 4, 4, LINE); rect(hx + 7, hy + 5, 2, 3, PINK); }
    else if (MO === 'smug') { set(hx + 5, hy + 5, LINE); set(hx + 6, hy + 6, LINE); set(hx + 7, hy + 6, LINE); set(hx + 8, hy + 5, LINE); set(hx + 9, hy + 4, LINE); set(hx + 10, hy + 4, LINE); }
    else if (MO === 'none') { /* sem boca */ }
    else { set(hx + 7, hy + 5, LINE); set(hx + 8, hy + 6, LINE); set(hx + 9, hy + 5, LINE); }
    // chapéu: kasa cônico de lavrador de arroz
    if (hat) { tri(hx - 9, hy - 6, hx + 8, hy - 7, hx - 1 + tilt * 0.5, hy - 14, HAT); line(hx - 9, hy - 6, hx + 8, hy - 7, 1.4, HATS); line(hx - 1 + tilt * 0.5, hy - 14, hx - 3, hy - 7, 1, HATL); set(hx - 1 + tilt * 0.5, hy - 14, HATS); }
    // orelha da frente por cima do chapéu
    if (ears !== 'back') { tri(hx + 1 + tilt, hy - 7, hx + 4 + tilt + tw, hy - 14, hx + 7, hy - 6, FUR); tri(hx + 2.5 + tilt, hy - 7, hx + 4 + tilt + tw * 0.8, hy - 11.5, hx + 5.6, hy - 7, CREAM); }
    else tri(hx - 1, hy - 5, hx - 7, hy - 8, hx + 2, hy - 7, FUR);
  }

  /* =====================================================================
     5. Poses
     ===================================================================== */
  const s = Math.sin;
  const back = (x, y) => { A.backX = x; A.backY = y; };
  const hold = (x, y) => { A.holdX = x; A.holdY = y; A.hasHold = true; };

  // estado da passada das poses em pé (era um closure no rascunho)
  const LG = { ph: 0, amp: 0, lift: 0, fy: 37, tuck: 0, fly: 0, by: 0, air: false };
  function stepLeg(base, off, far, hipX) {
    const a = s(LG.ph + off), x = base + a * LG.amp, y = LG.fy - Math.max(0, Math.cos(LG.ph + off)) * LG.lift - LG.tuck - LG.fly;
    leg(hipX, 29 + LG.by, LG.air ? hipX + (far ? -2 : 2) : x, y, far);
  }

  /* ---------- poses novas (mesma construção das antigas) ---------- */

  // drive: sentado ereto, as duas patas no volante, quicando com o motor; S.fast deita as orelhas
  function poseDrive(t, eyesO) {
    const fast = S.fast > 0.5;
    const rum = s(t * 31) * 0.4 + s(t * 7.3) * (fast ? 0.8 : 0.45), by = rum, st = s(t * 2.3) * 1.1;
    tail(11, 27 + by * 0.4, fast ? s(t * 26) * 1.4 : s(t * 6) * 0.9);
    ell(18, 31.5, 7.5, 5, FURS); leg(18, 33, 25, 37, false);
    ell(21, 28 + by * 0.4, 8, 7, FUR); ell(26, 28 + by * 0.4, 4, 5.4, CREAM);
    back(19, 21 + by * 0.4);
    const gy = 25.5 + by * 0.6;
    leg(27, 26 + by * 0.5, 37.5, gy - 1.5 - st, true);
    head(30, 15.5 + by, fast ? 'happy' : eyesO, fast ? 'tongue' : 'smile', fast ? 'back' : 'up', true, 0, fast ? 0 : LF.tw);
    leg(28, 27.5 + by * 0.5, 38, gy + 1.5 + st, false);
    A.pawX = 38; A.pawY = gy; hold(39, gy - 0.5);
  }

  // push: corpo inclinado pra frente, patas da frente esticadas na altura do peito, patas de trás andando
  function posePush(t, extra) {
    const ph = t * 9.5, bob = Math.abs(s(ph)) * 0.9, by = -bob;
    const fA = 12 + s(ph + Math.PI) * 3.6, fB = 16.5 + s(ph) * 3.6;
    tail(8, 21 + by, s(ph) * 1.2);
    leg(16, 29 + by, fA, 37 - Math.max(0, Math.cos(ph + Math.PI)) * 2.6, true);
    leg(20, 29 + by, fB, 37 - Math.max(0, Math.cos(ph)) * 2.6, false);
    ell(18.5, 27 + by, 7, 6, FUR); ell(24, 22.5 + by, 7.2, 6.4, FUR);
    ell(22.5, 29.5 + by, 5, 2.4, CREAM); ell(28, 24.5 + by, 3.2, 4.4, CREAM);
    back(19, 19 + by);
    leg(28, 22 + by, 40, 21.5 + by, true);
    head(30, 11.5 + by, 'squint', 'teeth', 'back', true);
    leg(29, 25 + by, 41, 25 + by, false);
    A.pawX = 41; A.pawY = 23 + by; hold(42.5, 23 + by);
    if (extra) { const k = (t * 2.2) % 1; if (k < 0.6) { set(19 - k * 8, 6 + by + k * 5, TEARL); set(18 - k * 8, 5 + by + k * 5, WHITE); } }
  }

  // carry: andando nas patas de trás, patas da frente levantadas segurando a carga em cima do chapéu
  function poseCarry(t, eyesO) {
    const ph = t * 9.5, bob = Math.abs(s(ph)) * 1.0, by = 2.2 - bob;
    tail(15, 28 + by, s(ph) * 1.4);
    leg(21, 31 + by, 20 + s(ph + Math.PI) * 2.6, 37 - Math.max(0, Math.cos(ph + Math.PI)) * 2.2, true);
    leg(26, 31 + by, 27 + s(ph) * 2.6, 37 - Math.max(0, Math.cos(ph)) * 2.2, false);
    ell(23.5, 26 + by, 6.6, 7.8, FUR); ell(25.5, 28 + by, 3.4, 5.2, CREAM);
    back(18, 22 + by);
    const hy = 15 + by, py = 1.5 + by * 0.5;
    leg(20, 23 + by, 13.5, py + 1, true);
    leg(29, 23 + by, 37, py + 1, false);
    head(25, hy, eyesO, 'smile', 'up', true, 0, 0);
    A.pawX = 37; A.pawY = py; hold(25, py - 1.5);
  }

  // cheer: pulinho de comemoração com as duas patas pra cima
  function poseCheer(t) {
    const k = Math.abs(s(t * 7)), hop = k * 3.2, by = 2 - hop, air = Math.max(0, hop - 1.4) * 1.3, up = s(t * 14);
    tail(15, 28 + by, s(t * 24) * 1.8);
    leg(21, 31 + by, 19.5 - air * 0.4, 37 - air, true); leg(26, 31 + by, 27.5 + air * 0.4, 37 - air, false);
    ell(23.5, 26 + by, 6.6, 8.2, FUR); ell(25.5, 28 + by, 3.4, 5.4, CREAM);
    back(18, 21 + by);
    leg(20, 22 + by, 13.5 - k, 11.5 + by - k * 1.5 + up * 0.6, true);
    leg(29, 22 + by, 37 + k, 10.5 + by - k * 1.5 - up * 0.6, false);
    head(25, 13.5 + by, 'happy', 'open', 'up', true, Math.round(s(t * 7) * 0.8));
    A.pawX = 37 + k; A.pawY = 9.5 + by - k * 1.5;
  }

  // point: em pé nas patas de trás, braço esticado apontando pra frente
  function posePoint(t, eyesO) {
    const br = s(t * 2.2) * 0.5, by = -br * 0.5, jab = Math.max(0, s(t * 5)) * 1.2;
    tail(14, 27 + by * 0.5, s(t * 6) * 1.2 + s(t * 27) * 1.6 * LF.wagK);
    leg(21, 30 + by, 19.5, 37, true); leg(26, 30 + by, 27.5, 37, false);
    ell(23.5, 25 + by, 6.6, 8.6, FUR); ell(25.5, 27 + by, 3.4, 5.6, CREAM);
    back(18, 20 + by);
    arm(20, 21.5 + by, 16.5, 25 + by, 19.5, 29 + by, true);
    head(26, 11.5 + by, eyesO, 'open', 'up', true, 0, LF.tw);
    leg(28.5, 22.5 + by, 39.5 + jab, 22 + by, false);
    A.pawX = 40 + jab; A.pawY = 21 + by; hold(41 + jab, 21 + by);
  }

  // wave: em pé, dando tchau com a pata da frente
  function poseWave(t) {
    const br = s(t * 2.2) * 0.5, by = -br * 0.5, sw = s(t * 11), a = 0.72 + sw * 0.42;
    tail(14, 27 + by * 0.5, s(t * 20) * 1.6);
    leg(21, 30 + by, 19.5, 37, true); leg(26, 30 + by, 27.5, 37, false);
    ell(23.5, 25 + by, 6.6, 8.6, FUR); ell(25.5, 27 + by, 3.4, 5.6, CREAM);
    back(18, 20 + by);
    arm(20, 21.5 + by, 16.5, 25 + by, 19.5, 29 + by, true);
    head(25.5, 11.5 + by, 'happy', 'open', 'up', true, Math.round(sw * 0.7));
    const ex = 34.5, ey = 22 + by, px = ex + Math.cos(a) * 7.5, py = ey - Math.sin(a) * 7.5;
    arm(28.5, 22.5 + by, ex, ey, px, py + 1, false);
    A.pawX = px; A.pawY = py;
  }

  // base sentada comum a think/cry (igual à pose 'sit' do rascunho, sem a pata de perto)
  function sitBase(t, br, wag) {
    tail(11, 27, wag);
    ell(18, 31.5, 7.5, 5, FURS); leg(18, 33, 22, 37, false);
    ell(21, 28 - br * 0.25, 8, 7 + br * 0.45, FUR); ell(26, 28 - br * 0.25, 4 + br * 0.3, 5.4 + br * 0.35, CREAM);
    back(18, 21 - br * 0.5);
    leg(25, 29, 25, 37, true);
  }

  // think: sentado, pata no queixo, olhando pra cima, reticências
  function poseThink(t, extra) {
    const br = s(t * 2.2) * 0.7, hy = 16 - br * 0.7, cyc = t % 4.6, shut = cyc > 3.6 && cyc < 4.2;
    sitBase(t, br, s(t * 3) * 0.7);
    lookArr[0] = 1; lookArr[1] = -1;
    head(30, hy, shut ? 'closed' : 'open', 'closed', 'up', true, 1, 0, lookArr);
    leg(28.5, 29, 35.5, hy + 9, false);
    A.pawX = 35.5; A.pawY = hy + 8;
    if (extra) {
      const n = Math.floor(t * 2.2) % 4;
      if (n > 0) set(41, 9, WHITE);
      if (n > 1) rect(43, 5, 2, 2, WHITE);
      if (n > 2) { rect(45, 0, 3, 2, WHITE); rect(46, -1, 1, 4, WHITE); }
    }
  }

  // cry: sentado, cabeça baixa, olhão molhado e lágrima escorrendo
  function poseCry(t, extra) {
    const sob = Math.abs(s(t * 8)) * 0.8, br = s(t * 8) * 0.5, hy = 17.4 + sob;
    sitBase(t, br, 0);
    leg(29, 29, 29.5, 37, false);
    head(30, hy, 'wet', s(t * 8) > 0 ? 'frown' : 'open', 'back', true, 0, 0);
    // lágrima: fio descendo pela bochecha + gota caindo
    const k = (t * 1.7) % 1, tx = 31;
    rect(tx, hy + 2, 1, 4, TEAR); set(tx, hy + 2 + ((t * 9) % 4), TEARL);
    set(tx, hy + 6 + k * 13, TEAR); set(tx, hy + 5 + k * 13, TEARL);
    if (extra && k > 0.8) { set(tx - 2, 36, TEARL); set(tx + 2, 36, TEARL); }
  }

  // gasp: choque. Olho arregalado, orelha pra trás, pelo arrepiado, boca aberta, rabo em pé
  function poseGasp(t, extra) {
    const tr = Math.round(s(t * 43)) * 0.5, by = -1.5;
    // rabo arrepiado
    tail(10, 17 + by, 0);
    tri(5, 13 + by, 3, 9 + by, 8, 12 + by, FUR); tri(8, 12 + by, 9, 7.5 + by, 12, 12 + by, FUR); tri(12, 13 + by, 15.5, 9.5 + by, 14, 15 + by, FUR);
    leg(15, 29 + by, 12.5, 37, true); leg(19, 29 + by, 17.5, 37, false);
    // pelo arrepiado nas costas
    for (let i = 0; i < 4; i++) { const x = 14 + i * 3.6; tri(x - 1.6, 21.5 + by, x - 0.8, 16.6 + by + (i & 1), x + 1.8, 21 + by, FUR); }
    ell(21, 26 + by, 10.5, 6.6, FUR); ell(21, 30 + by, 7.5, 2.8, CREAM); ell(29, 25 + by, 3.6, 4.6, CREAM);
    back(20, 19 + by);
    leg(26, 29 + by, 28.5, 37, true); leg(29, 29 + by, 33, 37, false);
    const hx = 32 + tr, hy = 14.5 + by;
    // tufos na nuca
    tri(hx - 7, hy - 1, hx - 12, hy + 0.5, hx - 7.5, hy + 3, FUR); tri(hx - 6, hy + 3, hx - 11, hy + 5.5, hx - 5, hy + 6.5, FUR);
    head(hx, hy, 'shock', 'gasp', 'back', true);
    if (extra) {
      const f = Math.floor(t * 10) % 2;
      line(44 + f, 3.5, 46 + f, 1, 1, WHITE); line(45.5 + f, 9, 47.5, 8, 1, WHITE); line(42, 1.5 - f, 42.5, -1.5, 1, WHITE);
    }
  }

  // proud: peito estufado, patas na cintura, olho fechado feliz, queixo pra cima
  function poseProud(t, extra) {
    const br = s(t * 2.4) * 0.6, by = -Math.max(0, br) * 0.4;
    tail(14, 26.5, s(t * 9) * 1.5);
    leg(21, 30, 19, 37, true); leg(26, 30, 28, 37, false);
    ell(23.5, 25 + by, 6.6, 8.6, FUR); ell(26.4, 25.5 + by, 4.3 + br * 0.3, 6.2, CREAM);
    back(17.5, 20 + by);
    arm(20, 21.5 + by, 15.5, 25 + by, 19.5, 29.5 + by, true);
    head(25, 11 + by, 'happy', 'smile', 'up', true, -1);
    arm(29, 22 + by, 33.5, 25.5 + by, 30, 30 + by, false);
    A.pawX = 30; A.pawY = 29 + by;
    if (extra) {                          // brilho de orgulho piscando
      const f = Math.floor(t * 5) % 4, sx = 39, sy = 5;
      if (f < 3) { set(sx, sy, WHITE); if (f > 0) { set(sx - 1, sy, GOLD); set(sx + 1, sy, GOLD); set(sx, sy - 1, GOLD); set(sx, sy + 1, GOLD); } if (f === 2) { set(sx - 2, sy, GOLD); set(sx + 2, sy, GOLD); set(sx, sy - 2, GOLD); set(sx, sy + 2, GOLD); } }
      const g2 = (f + 2) % 4; if (g2 < 2) { set(43, 12, WHITE); if (g2) { set(42, 12, GOLD); set(44, 12, GOLD); set(43, 11, GOLD); set(43, 13, GOLD); } }
    }
  }

  // climb: de perfil, subindo escada (a escada fica à direita), patas alternando pra cima
  function poseClimb(t) {
    const ph = t * 7, a = s(ph), up = Math.max(0, a), dn = Math.max(0, -a), by = -Math.abs(a) * 1.1 + 1;
    tail(15, 30 + by, s(t * 8) * 1.1);
    leg(20.5, 31.5 + by, 29, 36.5 - dn * 4.5, true);
    leg(22, 32 + by, 30, 36.5 - up * 4.5, false);
    ell(22.5, 25.5 + by, 6.2, 8.8, FUR); ell(26, 26.5 + by, 3.1, 6.2, CREAM);
    back(17, 21 + by);
    leg(26.5, 20.5 + by, 36, 9.5 - up * 5 + by * 0.3, true);
    leg(27.5, 22 + by, 36.5, 10.5 - dn * 5 + by * 0.3, false);
    lookArr[0] = 0; lookArr[1] = -1;
    head(24, 12.5 + by, 'open', 'smile', 'up', true, 0, 0, lookArr);
    A.pawX = 36.5; A.pawY = 9.5 - dn * 5 + by * 0.3;
  }

  /* ---------- pose(): despacha; as poses antigas são o código do rascunho ---------- */
  function pose(mode, t, extra) {
    life(t);
    A.hasHold = false; A.pawX = 32; A.pawY = 36; A.backX = 20; A.backY = 19.5;
    const eyesO = LF.blink ? 'closed' : LF.half ? 'half' : 'open';
    if (mode === 'roll') {
      const wig = s(t * 9) * 1.6, rb = s(t * 3) * 0.5;
      tail(8, 32, s(t * 20) * 1.4);
      ell(21, 31 + rb, 11, 5.6, FUR); ell(21, 28.5 + rb, 8, 3, CREAM);
      leg(15, 28, 13 + wig, 22, false); leg(19, 28, 20 - wig, 21, false);
      leg(25, 28, 24 + wig, 21, false); leg(29, 28, 31 - wig, 22, false);
      head(35, 29 + rb, 'happy', 'tongue', 'back', false);
      back(21, 25);
      return;
    }
    if (mode === 'bow' || mode === 'stretch') {
      const stz = mode === 'stretch', w = stz ? s(t * 3) * 0.8 : s(t * 24) * 1.8;
      tail(11, 15, w);
      leg(15, 25, 14, 37, true); leg(19, 25, 19.5, 37, false);
      ell(18, 23, 7.5, 5.5, FUR); ell(25, 28, 7, 5, FUR); ell(22, 26.5, 5, 4, FUR);
      ell(25, 31, 5, 2.4, CREAM); ell(31, 30, 3.2, 3.4, CREAM);
      leg(27, 32, 35, 37, true); leg(30, 32, 38, 37, false);
      if (stz) head(36, 26 + s(t * 2.4) * 0.8, 'closed', 'yawn', 'back', true);
      else head(36, 26 + Math.abs(s(t * 6)) * 0.6, 'happy', 'tongue', undefined, true);
      back(19, 17.5);
      return;
    }
    if (mode === 'scratch' || mode === 'yawn' || mode === 'howl') {
      const br = s(t * 2) * 0.35;
      tail(11, 27, s(t * 5) * 0.9);
      ell(18, 31.5, 7.5, 5, FURS); if (mode !== 'scratch') leg(18, 33, 22, 37, false);
      ell(21, 28 + br, 8, 7, FUR); ell(26, 28 + br, 4, 5.4, CREAM);
      leg(25, 29, 25, 37, true); leg(29, 29, 29.5, 37, false);
      if (mode === 'scratch') { const k = s(t * 30); head(30, 17 + br, 'happy', 'tongue', undefined, true, -1); leg(17, 30, 21 + k * 1.3, 16 - k * 0.9, true); }
      else if (mode === 'howl') head(29, 13 + br, 'closed', 'open', 'back', true);
      else { const yw = (t % 2.6) < 1.5; head(30, 16 + br + (yw ? -1 : 0), yw ? 'closed' : eyesO, yw ? 'yawn' : 'smile', undefined, true); }
      back(18, 21 + br);
      return;
    }
    if (mode === 'sleep') {
      const br = s(t * 1.6) * 0.8;
      tail(34, 33.5, 0);
      ell(21, 31 - br * 0.35, 12.5, 5.6 + br * 0.5, FUR); ell(21, 34 + br, 9, 2.4, CREAM);
      head(33, 28 + br * 0.5, 'closed', 'closed', 'back', true);
      back(20, 25.5 - br * 0.8); A.pawX = 38; A.pawY = 36;
      return;
    }
    if (mode === 'dance' || mode === 'dance2') {
      const hop = Math.abs(s(t * (mode === 'dance2' ? 11 : 8))) * (mode === 'dance2' ? 3 : 1.6), up = s(t * 8);
      const by = -hop;
      tail(15, 27 + by, s(t * 22) * 1.6);
      leg(21, 30 + by, 20, 37, true); leg(26, 30 + by, 27, 37, false);
      ell(23.5, 25 + by, 6.6, 8.6, FUR); ell(25.5, 27 + by, 3.4, 5.6, CREAM);
      leg(20, 21 + by, 15 - up * 1.5, 14 + by + up * 2, true);
      head(25, 12 + by, 'happy', 'open', undefined, true, Math.round(up));
      leg(28, 21 + by, 34 + up * 1.5, 15 + by - up * 2, false);
      back(18, 20 + by);
      return;
    }
    if (mode === 'sit' || mode === 'wag' || mode === 'sign') {
      const br = s(t * 2.2) * 0.7, wag = mode === 'wag' ? s(t * 30) * 2 : s(t * 5) * 0.9 + s(t * 27) * 2 * LF.wagK;
      tail(11, 27, wag);
      ell(18, 31.5, 7.5, 5, FURS); leg(18, 33, 22, 37, false);
      ell(21, 28 - br * 0.25, 8, 7 + br * 0.45, FUR); ell(26, 28 - br * 0.25, 4 + br * 0.3, 5.4 + br * 0.35, CREAM);
      leg(25, 29, 25, 37, true);
      if (mode === 'sign') { leg(29, 27, 37, 22 + s(t * 6), false); }
      else leg(29, 29, 29.5, 37, false);
      head(30, 16 - br * 0.7, mode === 'wag' ? 'happy' : eyesO, mode === 'wag' ? 'tongue' : mode === 'sign' ? 'open' : LF.wagK > 0.3 ? 'tongue' : 'smile', undefined, true, ShibaPX.tilt || LF.tilt, LF.tw, LF.look);
      back(18, 21 - br * 0.5);
      return;
    }
    if (mode === 'lie') {
      /* deitado de esfinge, acordado: patas pra frente, cabeça erguida */
      const br = s(t * 2) * 0.6, wag = s(t * 4) * 0.7 + s(t * 27) * 1.8 * LF.wagK;
      tail(9, 28, wag);
      ell(20, 31.5 - br * 0.3, 12, 5.2 + br * 0.4, FUR); ell(15, 33, 6, 3.6, FURS); ell(22, 34.4, 8.5, 2.2, CREAM);
      rect(11, 35, 5, 2, CREAM);
      line(29, 34.5, 37, 35.5, 3, FUR); rect(36, 34, 4, 3, CREAM);
      ell(29, 28.5 - br * 0.3, 4, 5, CREAM);
      head(31, 20 - br * 0.5, eyesO, LF.wagK > 0.3 ? 'tongue' : 'smile', undefined, true, ShibaPX.tilt || LF.tilt, LF.tw, LF.look);
      back(19, 26 - br * 0.5); A.pawX = 38; A.pawY = 35;
      return;
    }
    /* poses novas */
    if (mode === 'drive') return poseDrive(t, eyesO);
    if (mode === 'push') return posePush(t, extra);
    if (mode === 'carry') return poseCarry(t, eyesO);
    if (mode === 'cheer') return poseCheer(t);
    if (mode === 'point') return posePoint(t, eyesO);
    if (mode === 'wave') return poseWave(t);
    if (mode === 'think') return poseThink(t, extra);
    if (mode === 'cry') return poseCry(t, extra);
    if (mode === 'gasp') return poseGasp(t, extra);
    if (mode === 'proud') return poseProud(t, extra);
    if (mode === 'climb') return poseClimb(t);

    // em pé e em movimento
    let ph = 0, amp = 0, lift = 0, bob = 0, stretch = 0, ears = 'up', mouth = 'smile', eyes = eyesO, headDY = 0, tw = 0, tilt = ShibaPX.tilt || 0, look = null, tailW = s(t * 7) * 1.3, tailY = 0, gal = 0, bodyRY = 0;
    if (mode === 'walk') { ph = t * 9.5; amp = 3.5; lift = 2.7; bob = Math.abs(s(ph)) * 1.15; headDY = s(ph * 2 + 1.2) * 0.55; tailW = s(ph) * 1.5; tailY = -Math.abs(Math.cos(ph)) * 0.8; tw = LF.tw; }
    else if (mode === 'run') { ph = t * 16; amp = 5; lift = 2.6; gal = 1; bob = Math.max(0, s(ph - 0.5)) * 3.2; stretch = 1 + Math.max(0, s(ph - 0.5)) * 1.3; ears = 'back'; mouth = 'tongue'; headDY = -s(ph - 0.5) * 0.8; tailW = s(ph) * 0.9; }
    else if (mode === 'jump') { amp = 0; lift = 0; stretch = 1; }
    else if (mode === 'dig') { ph = t * 22; headDY = 3 + s(ph * 0.5) * 0.7; mouth = 'open'; bob = -0.6 + s(ph) * 0.35; tailW = s(t * 24) * 1.6; ears = s(t * 3) > 0.6 ? 'back' : 'up'; }
    else if (mode === 'sniff') { ph = t * 5; amp = 1.6; lift = 1; headDY = 4 + s(t * 14) * 0.5; mouth = 'closed'; tailW = s(t * 9) * 1.1; tw = LF.tw; }
    else if (mode === 'surprise') { bob = 1.5; eyes = 'wide'; mouth = 'open'; }
    else if (mode === 'dizzy') { bob = s(t * 4) * 0.6; eyes = 'spiral'; mouth = 'tongue'; ears = 'back'; }
    else if (mode === 'sword') { bob = s(t * 3) * 0.4; eyes = 'squint'; mouth = 'grit'; }
    else if (mode === 'swordrun') { ph = t * 16; amp = 4.2; lift = 2.2; bob = Math.abs(s(ph)) * 1.4; stretch = 1.5; ears = 'back'; mouth = 'grit'; eyes = 'squint'; }
    else if (mode === 'windup') { bob = -2; headDY = 1; eyes = 'squint'; mouth = 'grit'; ears = 'back'; }
    else if (mode === 'slash') { stretch = 2; eyes = 'squint'; mouth = 'grit'; ears = 'back'; }
    else if (mode === 'eat') { const c = s(t * 9); headDY = 9 + Math.max(0, c) * 1.4; mouth = c > 0.1 ? 'open' : 'closed'; eyes = 'happy'; ears = 'back'; }
    else if (mode === 'pant') { const pp = s(t * 12); bob = pp * 0.3; bodyRY = pp * 0.5; mouth = pp > -0.2 ? 'tongue' : 'open'; eyes = (t % 2.4) < 1.5 ? 'happy' : eyesO; headDY = 0.6 + pp * 0.35; tailW = s(t * 10) * 1.4; }
    else { bob = s(t * 2.2) * 0.5; bodyRY = s(t * 2.2) * 0.35; tw = LF.tw; if (!tilt) tilt = LF.tilt; look = LF.look; tailW = s(t * 5) * 1 + s(t * 27) * 1.9 * LF.wagK; if (LF.wagK > 0.3) mouth = 'tongue'; }
    const by = -bob;
    if (mode === 'eat') tailW = s(t * 24) * 1.8;
    tail(10 - stretch, 18 + by + tailY, tailW);
    const air = mode === 'jump' || mode === 'slash', fy = 37, jumpTuck = air ? 3 : 0, flyUp = gal ? bob * 0.75 : 0;
    LG.ph = ph; LG.amp = amp; LG.lift = lift; LG.fy = fy; LG.tuck = jumpTuck; LG.fly = flyUp; LG.by = by; LG.air = air;
    if (mode === 'dig' || mode === 'eat') { leg(15, 29, 15, 37, true); leg(19, 29, 19, 37, false); }
    else if (gal) { stepLeg(14, 0.45, true, 15); stepLeg(18, 0, false, 19); }
    else { stepLeg(14, Math.PI, true, 15); stepLeg(18, 0, false, 19); }
    ell(21, 26 + by - bodyRY * 0.4, 10.5 + stretch, 6.6 + bodyRY * 0.5, FUR); ell(21, 30 + by, 7.5, 2.8, CREAM); ell(29, 25 + by, 3.6, 4.6 + bodyRY * 0.3, CREAM);
    if (mode === 'dig') { const a = s(ph); leg(27, 28, 31 + a * 2.4, 37 - Math.max(0, a) * 2.4, true); leg(30, 28, 33 - a * 2.4, 37 - Math.max(0, -a) * 2.4, false); }
    else if (mode === 'eat') { leg(27, 28, 28, 37, true); leg(30, 28, 31, 37, false); }
    else if (gal) { stepLeg(27, Math.PI + 0.45, true, 26); stepLeg(31, Math.PI, false, 29); }
    else { stepLeg(26, 0, true, 26); stepLeg(30, Math.PI, false, 29); }
    head(33 + stretch * (gal ? 0.6 : 1) + (mode === 'eat' ? 2 : 0), 15 + by + headDY, eyes, mouth, ears, true, tilt, tw, look);
    back(20, 19.5 + by);
    if (mode === 'eat' && extra && s(t * 9) > 0.6) { set(40 + (t * 13 % 3), 35, CREAM); set(38 + (t * 7 % 4), 36, CREAMS); }
    if (mode === 'dig' && extra) { for (let i = 0; i < 7; i++) { const k = (t * 7 + i * 0.27) % 1; set(36 + k * 9, 36 - k * 10 + k * k * 13, i % 2 ? FURD : FURS); } }
    if (mode === 'pant' && extra && s(t * 12) > 0.7) { set(45, 22 + by, WHITE); set(46, 20 + by, WHITE); }
  }

  const SHIBA_POSES = ['sit', 'wag', 'sign', 'lie', 'stand', 'walk', 'run', 'jump', 'dig', 'sniff', 'surprise', 'dizzy',
    'sword', 'swordrun', 'windup', 'slash', 'eat', 'pant', 'roll', 'bow', 'stretch', 'scratch', 'yawn', 'howl', 'sleep',
    'dance', 'dance2', 'shake',
    'drive', 'push', 'carry', 'cheer', 'point', 'think', 'gasp', 'cry', 'proud', 'climb', 'wave'];
  const POSE_ID = Object.create(null);
  SHIBA_POSES.forEach((p, i) => { POSE_ID[p] = i; });
  // poses que não ficam com sombra no chão (penduradas ou dentro de veículo)
  const NO_SHADOW = { climb: 1, drive: 1 };

  /* =====================================================================
     6. Saída para canvas
     ===================================================================== */
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  let img = null, img32 = null, tmpCv = null, tmpG = null;
  const shadowCv = [null, null], shadow32 = [null, null];   // sombra do chão (normal e 'sleep'): canvas e pixels prontos
  function ensureIO() {
    if (img) return;
    tmpCv = mkCanvas(W, H); tmpG = tmpCv.getContext('2d');
    img = tmpG.createImageData(W, H); img32 = new Uint32Array(img.data.buffer);
    for (let k = 0; k < 2; k++) {
      const c = shadowCv[k] = mkCanvas(W, H), g = c.getContext('2d');
      g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(23, 38.4 + OY, k ? 14 : 12, 1.4, 0, 0, Math.PI * 2); g.fill();
      shadow32[k] = new Uint32Array(g.getImageData(0, 0, W, H).data.buffer);   // lido uma única vez, na inicialização
    }
  }
  // rasteriza a pose no ImageData compartilhado (com contorno); under = sombra embutida (ou null)
  function raster(mode, t, K, under) {
    buf = bodyBuf; BW = W; BH = H; BOY = OY; dry = false;
    bodyBuf.fill(0);
    pose(mode === 'shake' ? 'stand' : mode, t, true);
    blit(bodyBuf, W, H, K.lut, img32, under);
  }
  // riscos de tremida da pose 'shake' (igual ao rascunho)
  function shakeMarks(g, t) {
    g.fillStyle = 'rgba(29,27,24,.35)'; const k = Math.floor(t * 12) % 2;
    g.fillRect(4 + k, 22, 1, 4); g.fillRect(2 + k, 26, 1, 3); g.fillRect(43 - k, 20, 1, 4); g.fillRect(45 - k, 24, 1, 3);
  }
  // ShibaPX.frame(cv, mode, t, pal): desenha um frame 48x44 (com sombra) no canvas dado. API do rascunho.
  function frame(cv, mode, t, pal) {
    ensureIO();
    raster(mode, t, compilePal(pal));
    const g = cv.getContext('2d');
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(23, 38.4 + OY, mode === 'sleep' ? 14 : 12, 1.4, 0, 0, Math.PI * 2); g.fill();
    tmpG.putImageData(img, 0, 0);
    const ox = mode === 'shake' ? Math.round(Math.sin(t * 52) * 1.6) : 0;
    g.drawImage(tmpCv, ox, 0);
    if (mode === 'shake') shakeMarks(g, t);
  }
  // caminho rápido usado pelo cache: a sombra já vai dentro do buffer, então é 1 putImageData e pronto.
  // Só a pose 'shake' (sprite deslocado, sombra parada) usa o caminho com composição.
  function frameFast(cv, g, mode, t, K, shadow) {
    const sh = shadow && !NO_SHADOW[mode];
    if (mode !== 'shake') { raster(mode, t, K, sh ? shadow32[mode === 'sleep' ? 1 : 0] : null); g.putImageData(img, 0, 0); return; }
    raster(mode, t, K, null);
    const ox = Math.round(Math.sin(t * 52) * 1.6);
    g.clearRect(0, 0, W, H);
    g.putImageData(img, ox, 0);
    if (sh) { g.globalCompositeOperation = 'destination-over'; g.drawImage(shadowCv[0], 0, 0); g.globalCompositeOperation = 'source-over'; }
    shakeMarks(g, t);
  }
  // ShibaPX.still(pal, mode='sit', scale=1) -> dataURL de um frame parado (ícones de UI)
  function still(pal, mode, scale) {
    if (mode === undefined) mode = 'sit';
    const m0 = ShibaPX.mouth[0], m1 = ShibaPX.mouth[1], sl = ShibaPX.look, st = ShibaPX.tilt;
    ShibaPX.look = null; ShibaPX.tilt = 0;
    const c = mkCanvas(W, H); frame(c, mode, 0.5, getPal(pal));
    ShibaPX.mouth[0] = m0; ShibaPX.mouth[1] = m1; ShibaPX.look = sl; ShibaPX.tilt = st;
    return c.toDataURL();
  }
  ShibaPX.frame = frame; ShibaPX.still = still;

  /* =====================================================================
     7. Cache de frames + drawShiba
     ===================================================================== */
  /* Chave numérica: (t quantizado a 1/30 s) * 2^25 + bits de opções. A "vida ociosa" depende só de t,
     então dois shibas com a mesma paleta/pose/opções no mesmo t quantizado dividem o canvas.
     Anel FIFO de canvases 48x44: as chaves antigas (t passado) saem sozinhas. */
  const KEY_MUL = 33554432, TQ_MAX = 134217727;          // tq acima disso não cabe na chave (2^53): desenha sem cache
  let CACHE_N = 640, CACHE_FPS = 30;
  let slotKey = new Float64Array(CACHE_N).fill(NaN), slotCv = new Array(CACHE_N).fill(null), slotG = new Array(CACHE_N).fill(null);
  const cacheMap = new Map();
  let cacheCur = 0;
  const stats = { hits: 0, misses: 0, exact: 0 };
  let exactCv = null, exactG = null;
  const NOOPTS = {};
  const idOf = (arr, v) => { const i = arr.indexOf(v); return i < 0 ? 15 : i + 1; };

  // t são: número finito (NaN/undefined/Infinity viram 0)
  function saneT(t) { t = +t; return t === t && t !== Infinity && t !== -Infinity ? t : 0; }
  // o desenho pedido cai fora do cache? (opções contínuas, globais do rascunho ligados, paletas demais, t gigante)
  function isExact(o, K, t) {
    return !!(o.exact || o.tilt || o.look || ShibaPX.tilt || ShibaPX.look || ShibaPX.quiet || K.id > 255 || Math.abs(t) * CACHE_FPS > TQ_MAX);
  }
  // drawShiba.frameT(t, opts?) -> o t que realmente é desenhado (quantizado a 1/fps quando o frame vem do cache)
  function frameT(t, o) {
    t = saneT(t); o = o || NOOPTS;
    return isExact(o, compilePal(typeof o.pal === 'object' && o.pal ? o.pal : getPal(o.pal)), t) ? t : Math.round(t * CACHE_FPS) / CACHE_FPS;
  }

  // devolve o canvas 48x44 do frame pedido (do cache, ou rasterizado agora). NÃO guarde: é reaproveitado.
  function frameCanvas(mode, t, o) {
    ensureIO();
    t = saneT(t);
    const K = compilePal(typeof o.pal === 'object' && o.pal ? o.pal : getPal(o.pal));
    const hat = o.hat !== false, shadow = o.shadow !== false;
    const mouth = o.mouth || null, eyes = o.eyes || null, fast = o.fast ? 1 : 0;
    let pid = POSE_ID[mode];
    if (pid === undefined) { mode = 'stand'; pid = POSE_ID.stand; }
    // globais do rascunho: hatOn/mouthOverride/eyesOverride vêm sempre das opções (como no drawShiba original);
    // tilt/look globais, se o jogo os ligar, continuam valendo (compatibilidade) e desviam do cache
    const gH = ShibaPX.hatOn, gM = ShibaPX.mouthOverride, gE = ShibaPX.eyesOverride, gT = ShibaPX.tilt, gL = ShibaPX.look, gF = S.fast;
    let cv;
    if (isExact(o, K, t)) {
      if (!exactCv) { exactCv = mkCanvas(W, H); exactG = exactCv.getContext('2d'); }
      ShibaPX.hatOn = hat; ShibaPX.mouthOverride = mouth; ShibaPX.eyesOverride = eyes; ShibaPX.tilt = o.tilt || gT || 0; ShibaPX.look = o.look || gL || null; S.fast = fast;
      frameFast(exactCv, exactG, mode, t, K, shadow);
      stats.exact++; cv = exactCv;
    } else {
      const tq = Math.round(t * CACHE_FPS);
      const bits = K.id | (pid << 8) | (hat ? 16384 : 0) | (shadow ? 32768 : 0) | ((mouth ? idOf(MOUTHS, mouth) : 0) << 16) | ((eyes ? idOf(EYES, eyes) : 0) << 20) | (fast << 24);
      const key = tq * KEY_MUL + bits;
      const hit = cacheMap.get(key);
      if (hit !== undefined) { stats.hits++; return slotCv[hit]; }
      const i = cacheCur; cacheCur = (cacheCur + 1) % CACHE_N;
      if (!slotCv[i]) { slotCv[i] = mkCanvas(W, H); slotG[i] = slotCv[i].getContext('2d'); }
      else cacheMap.delete(slotKey[i]);
      slotKey[i] = key; cacheMap.set(key, i);
      ShibaPX.hatOn = hat; ShibaPX.mouthOverride = mouth; ShibaPX.eyesOverride = eyes; ShibaPX.tilt = 0; ShibaPX.look = null; S.fast = fast;
      frameFast(slotCv[i], slotG[i], mode, tq / CACHE_FPS, K, shadow);
      stats.misses++; cv = slotCv[i];
    }
    ShibaPX.hatOn = gH; ShibaPX.mouthOverride = gM; ShibaPX.eyesOverride = gE; ShibaPX.tilt = gT; ShibaPX.look = gL; S.fast = gF;
    return cv;
  }

  // drawShiba(g,x,y,pose,t,{face=1,scale=1,squash=0,rot=0,pal='kome',hat=true,mouth,eyes,alpha=1,shadow=true,fast,exact}): pés em (x,y)
  function drawShiba(g, x, y, mode, t, o) {
    o = o || NOOPTS;
    const cv = frameCanvas(mode, t, o);
    const sc = o.scale || 1, face = o.face || 1, sq = o.squash || 0;
    g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot);
    g.scale(face * sc * (1 + sq * 0.6), sc * (1 - sq)); g.imageSmoothingEnabled = false;
    if (o.alpha !== undefined && o.alpha < 1) g.globalAlpha *= o.alpha;
    g.drawImage(cv, -23, -(38.4 + 4)); g.restore();
  }
  // drawShiba.clear(): esvazia o cache de frames ; drawShiba.stats -> {hits, misses, exact}
  drawShiba.clear = function () { cacheMap.clear(); slotKey.fill(NaN); };
  drawShiba.stats = stats;
  drawShiba.frameT = frameT;
  // drawShiba.cacheSize -> frames guardados agora ; drawShiba.cacheMax (get/set, 64..4096): limite de canvases 48x44 do cache
  //   (cada um ~8 KB; 640 = ~5 MB). Aumente se tiver muitos shibas fora de fase na MESMA pose/paleta: quem vem atrás reaproveita
  //   os frames de quem vai na frente enquanto eles ainda estiverem no anel.
  Object.defineProperty(drawShiba, 'cacheSize', { get() { return cacheMap.size; } });
  Object.defineProperty(drawShiba, 'cacheMax', {
    get() { return CACHE_N; },
    set(v) {
      v = Math.max(64, Math.min(4096, v | 0));
      if (v === CACHE_N) return;
      CACHE_N = v; cacheMap.clear(); cacheCur = 0;
      slotKey = new Float64Array(v).fill(NaN); slotCv = new Array(v).fill(null); slotG = new Array(v).fill(null);
    },
  });
  // drawShiba.fps (get/set): quadros de animação por segundo guardados no cache (padrão 30; 20 economiza mais)
  Object.defineProperty(drawShiba, 'fps', { get() { return CACHE_FPS; }, set(v) { v = Math.max(1, Math.min(120, v | 0)); if (v !== CACHE_FPS) { CACHE_FPS = v; drawShiba.clear(); } } });

  // shibaCanvas(pose,t,opts) -> canvas 48x44 NOVO (cópia), pra ícones/sprites que você quer guardar
  function shibaCanvas(mode, t, o) {
    const src = frameCanvas(mode, t === undefined ? 0.5 : t, o || NOOPTS), c = mkCanvas(W, H);
    c.getContext('2d').drawImage(src, 0, 0); return c;
  }

  /* =====================================================================
     8. Âncoras
     ===================================================================== */
  const PAW = { x: 9, y: -6 }, MOUTH = { x: 11, y: -18 }, HEAD = { x: 10, y: -26 };
  // grade -> local (origem nos pés, sem escala, face=1): centro do pixel
  const GX = -22.5, GY = -37.9;
  // shibaAnchor(pose,t,nome:'paw'|'mouth'|'head'|'back'|'hatTop'|'hold'|'eye', out?, {hat,fast}?) -> {x,y} local (multiplique x por face)
  //   t exato; pra colar algo num shiba desenhado pelo cache use t = drawShiba.frameT(t) (o Actor já faz isso)
  function shibaAnchor(mode, t, name, out, o) {
    out = out || { x: 0, y: 0 };
    const b0 = buf, w0 = BW, h0 = BH, o0 = BOY, gH = ShibaPX.hatOn, gF = S.fast;
    if (o) { ShibaPX.hatOn = o.hat !== false; S.fast = o.fast ? 1 : 0; }
    buf = bodyBuf; BW = W; BH = H; BOY = OY; dry = true;
    pose(mode === 'shake' || POSE_ID[mode] === undefined ? 'stand' : mode, saneT(t), false);
    dry = false; buf = b0; BW = w0; BH = h0; BOY = o0; ShibaPX.hatOn = gH; S.fast = gF;
    let x, y;
    if (name === 'mouth') { x = A.mouthX; y = A.mouthY; }
    else if (name === 'head') { x = A.headX; y = A.headY; }
    else if (name === 'hatTop') { x = A.hatX; y = A.hatY; }
    else if (name === 'back') { x = A.backX; y = A.backY; }
    else if (name === 'eye') { x = A.headX + 2; y = A.headY; }
    else if (name === 'hold') { x = A.hasHold ? A.holdX : A.pawX; y = A.hasHold ? A.holdY : A.pawY; }
    else { x = A.pawX; y = A.pawY; }
    out.x = x + GX; out.y = y + GY;
    return out;
  }

  /* =====================================================================
     9. Close de rosto (cutscenes)
     ===================================================================== */
  const HW = 44, HH = 38, HCX = 18, HCY = 19;       // grade do close e centro da cabeça nela
  const headBuf = new Uint8Array(HW * HH);
  let himg = null, himg32 = null;
  const headCache = new Map();
  const EXPRS = ['normal', 'happy', 'shock', 'determined', 'cry', 'smug', 'sleepy', 'angry', 'love', 'sad'];

  function star(x, y, big) {
    set(x, y, WHITE); set(x - 1, y, GOLD); set(x + 1, y, GOLD); set(x, y - 1, GOLD); set(x, y + 1, GOLD);
    if (big) { set(x - 2, y, GOLD); set(x + 2, y, GOLD); set(x, y - 2, GOLD); set(x, y + 2, GOLD); set(x, y, WHITE); }
  }
  function drop(x, y) { set(x, y - 1, TEARL); rect(x - 1, y, 3, 2, TEAR); set(x, y + 2, TEAR); set(x - 1, y, TEARL); }
  function heart(x, y) { rect(x - 2, y - 1, 2, 2, PINK); rect(x + 1, y - 1, 2, 2, PINK); rect(x - 2, y, 5, 2, PINK); rect(x - 1, y + 2, 3, 1, PINK); set(x, y + 3, PINK); set(x - 2, y - 1, WHITE); }

  // rasteriza o close no headBuf; fr = quadro de animação 0..7, blink = piscada
  function headPose(expr, fr, blink, hat) {
    const hx = HCX, hy = HCY, f2 = fr & 1, f4 = fr & 3;
    let eyes = blink ? 'closed' : 'open', mouth = 'smile', ears = 'up', tilt = 0;
    if (expr === 'happy') { eyes = 'happy'; mouth = 'open'; }
    else if (expr === 'shock') { eyes = 'shock'; mouth = 'gasp'; ears = 'back'; }
    else if (expr === 'determined') { eyes = blink ? 'squint' : 'angry'; mouth = 'teeth'; }
    else if (expr === 'cry') { eyes = 'wet'; mouth = f2 ? 'frown' : 'open'; ears = 'back'; }
    else if (expr === 'smug') { eyes = 'half'; mouth = 'smug'; tilt = 1; }
    else if (expr === 'sleepy') { eyes = fr < 6 ? 'closed' : 'half'; mouth = fr < 3 ? 'yawn' : 'closed'; ears = 'back'; }
    else if (expr === 'angry') { eyes = 'squint'; mouth = 'teeth'; ears = 'back'; }
    else if (expr === 'love') { eyes = 'sparkle'; mouth = 'tongue'; }
    else if (expr === 'sad') { eyes = blink ? 'closed' : 'sad'; mouth = 'frown'; ears = 'back'; }
    // ombros / peito pra não ficar cabeça solta
    ell(hx - 4, hy + 17, 12, 8.5, FUR); ell(hx + 3, hy + 16, 5.5, 6.5, CREAM);
    if (expr === 'shock') {                               // pelo arrepiado
      tri(hx - 7, hy - 2, hx - 13, hy - 2.5, hx - 8, hy + 2, FUR); tri(hx - 7, hy + 2, hx - 13, hy + 3.5, hx - 6, hy + 6, FUR);
      tri(hx - 12, hy + 12, hx - 17, hy + 9, hx - 10, hy + 9, FUR); tri(hx - 14, hy + 15, hx - 19, hy + 14, hx - 14, hy + 11, FUR);
    }
    const gH = ShibaPX.hatOn, gM = ShibaPX.mouthOverride, gE = ShibaPX.eyesOverride, gL = ShibaPX.look;
    ShibaPX.hatOn = hat; ShibaPX.mouthOverride = null; ShibaPX.eyesOverride = null; ShibaPX.look = null;
    head(hx, hy, eyes, mouth, ears, true, tilt, 0, null);
    ShibaPX.hatOn = gH; ShibaPX.mouthOverride = gM; ShibaPX.eyesOverride = gE; ShibaPX.look = gL;
    // enfeites de expressão, em pixels
    if (expr === 'happy') {
      set(hx - 4, hy + 2, PINK); set(hx - 2, hy + 2, PINK); set(hx - 3, hy + 3, PINK); set(hx - 1, hy + 3, PINK);
      star(hx + 15, hy - 9 + f2, f4 < 2); star(hx + 20, hy + 1 - f2, f4 >= 2); star(hx - 14, hy - 4, f4 === 1);
    } else if (expr === 'shock') {
      drop(hx + 13, hy - 9 + f4); line(hx + 17, hy - 3, hx + 21, hy - 5, 1, WHITE); line(hx + 17, hy + 2, hx + 22, hy + 2, 1, WHITE); line(hx + 16, hy + 7, hx + 20, hy + 9, 1, WHITE);
    } else if (expr === 'determined') {
      star(hx + 14, hy - 8, f2 === 0);
      ell(hx + 15.5 + f2, hy + 6.5, 1.6 + f2 * 0.5, 1.2, WHITE); if (f4 > 1) set(hx + 19 + f2, hy + 5, WHITE);   // bufada pelo focinho
    } else if (expr === 'cry') {
      const tx = hx + 1;
      rect(tx, hy + 2, 1, 5, TEAR); set(tx, hy + 2 + f4, TEARL); rect(tx - 1, hy + 7, 2, 2, TEAR); set(tx - 1, hy + 7, TEARL);
      drop(tx, hy + 11 + f4 * 2); drop(hx + 13, hy - 6 + f4);
    } else if (expr === 'smug') {
      star(hx + 15, hy - 7, f4 < 2); set(hx - 4, hy + 2, PINK); set(hx - 2, hy + 2, PINK);
    } else if (expr === 'sleepy') {
      const zy = hy - 6 - f4;
      rect(hx + 13, zy, 3, 1, WHITE); set(hx + 14, zy + 1, WHITE); rect(hx + 13, zy + 2, 3, 1, WHITE);
      rect(hx + 18, zy - 6, 4, 1, WHITE); set(hx + 20, zy - 5, WHITE); set(hx + 19, zy - 4, WHITE); rect(hx + 18, zy - 3, 4, 1, WHITE);
      if (fr >= 3) { ell(hx + 12, hy + 4, 1.6 + (fr & 1) * 0.6, 1.6 + (fr & 1) * 0.6, TEARL); }      // bolha no nariz
    } else if (expr === 'angry') {
      const vx = hx + 13, vy = hy - 11 + f2;
      rect(vx, vy + 1, 2, 1, VEIN); rect(vx + 1, vy, 1, 2, VEIN); rect(vx + 4, vy, 1, 2, VEIN); rect(vx + 4, vy + 1, 2, 1, VEIN);
      rect(vx, vy + 4, 2, 1, VEIN); rect(vx + 1, vy + 4, 1, 2, VEIN); rect(vx + 4, vy + 4, 2, 1, VEIN); rect(vx + 4, vy + 4, 1, 2, VEIN);
      rect(hx + 17, hy + 7, 3 + f2 * 2, 1, WHITE);
    } else if (expr === 'love') {
      heart(hx + 15, hy - 8 - f4); heart(hx + 21, hy + 2 - ((fr + 2) & 3));
      set(hx - 4, hy + 2, PINK); set(hx - 2, hy + 2, PINK); set(hx - 3, hy + 3, PINK); set(hx - 1, hy + 3, PINK);
    } else if (expr === 'sad') {
      for (let i = 0; i < 3; i++) rect(hx + 13 + i * 3, hy - 13 + ((i + f2) & 1), 1, 5 + (i & 1) * 2, TEAR);  // nuvem de desânimo
    }
  }

  // drawShibaHead(g,x,y,t,{scale=6,expr='normal',pal='kome',face=1,hat=true,alpha=1,rot=0,still=false}): close de rosto centrado em (x,y)
  function drawShibaHead(g, x, y, t, o) {
    o = o || NOOPTS; t = saneT(t);
    ensureIO();
    if (!himg) { himg = tmpG.createImageData(HW, HH); himg32 = new Uint32Array(himg.data.buffer); }
    const expr = o.expr || 'normal', ei = Math.max(0, EXPRS.indexOf(expr));
    const K = compilePal(typeof o.pal === 'object' && o.pal ? o.pal : getPal(o.pal));
    const hat = o.hat !== false;
    const fr = o.still ? 0 : Math.floor(t * (expr === 'sleepy' ? 2.5 : 8)) & 7;
    life(t);
    const blink = !o.still && (LF.blink || LF.half) ? 1 : 0;
    const key = K.id * 4096 + ei * 64 + fr * 4 + blink * 2 + (hat ? 1 : 0);
    let cv = headCache.get(key);
    if (!cv) {
      buf = headBuf; BW = HW; BH = HH; BOY = 0; dry = false;
      headBuf.fill(0);
      headPose(EXPRS[ei], fr, blink, hat);
      buf = bodyBuf; BW = W; BH = H; BOY = OY;
      blit(headBuf, HW, HH, K.lut, himg32);
      cv = mkCanvas(HW, HH); cv.getContext('2d').putImageData(himg, 0, 0);
      if (headCache.size > 400) headCache.clear();
      headCache.set(key, cv);
    }
    const sc = o.scale || 6, face = o.face || 1;
    let dx = 0, dy = 0;
    if (!o.still) {
      if (expr === 'shock') { dx = Math.round(s(t * 61)) * 0.5; dy = Math.round(s(t * 47)) * 0.5; }
      else if (expr === 'cry' || expr === 'sad') dy = Math.round(Math.abs(s(t * 8)) * 1.2);
      else if (expr === 'happy' || expr === 'love') dy = -Math.round(Math.abs(s(t * 7)) * 1.5);
      else if (expr === 'angry' || expr === 'determined') dx = Math.round(s(t * 40)) * 0.34;
      else dy = Math.round(s(t * 2.2) * 0.8);
    }
    g.save(); g.translate(x, y); if (o.rot) g.rotate(o.rot);
    g.scale(face * sc, sc); g.imageSmoothingEnabled = false;
    if (o.alpha !== undefined && o.alpha < 1) g.globalAlpha *= o.alpha;
    g.drawImage(cv, -HCX - 1.5 + dx, -HCY - 0.5 + dy); g.restore();
  }
  drawShibaHead.exprs = EXPRS;

  /* =====================================================================
     10. Balão de fala no estilo Kome
     ===================================================================== */
  const BUBBLE_FONT = "'Zen Maru Gothic','M PLUS Rounded 1c','Trebuchet MS',system-ui,sans-serif";
  function rrPath(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
  }
  const sharedBubble = { text: null, lines: null, size: 11, maxW: 150 };
  // layout de balão: quebra o texto em linhas (cacheado no próprio objeto B)
  function layoutBubble(g, B) {
    g.font = '900 ' + B.size + 'px ' + BUBBLE_FONT;
    const words = String(B.text).split(/\s+/), lines = []; let cur = '', wmax = 0;
    for (let i = 0; i < words.length; i++) {
      const tryL = cur ? cur + ' ' + words[i] : words[i];
      if (cur && g.measureText(tryL).width > B.maxW) { lines.push(cur); cur = words[i]; } else cur = tryL;
    }
    if (cur) lines.push(cur);
    for (let i = 0; i < lines.length; i++) wmax = Math.max(wmax, g.measureText(lines[i]).width);
    B.lines = lines; B.w = Math.ceil(wmax) + B.size * 1.5; B.h = Math.ceil(lines.length * B.size * 1.25 + B.size * 0.9);
  }
  // drawBubble(g,x,y,texto|B,{size=11,maxW=150,k=1 (0..1 pop),side=1,col,ink}): balão creme com a ponta em (x,y)
  function drawBubble(g, x, y, text, o) {
    o = o || NOOPTS;
    let B = text;
    if (typeof text !== 'object') {                       // texto solto: usa um layout compartilhado
      B = sharedBubble; const size = o.size || 11, maxW = o.maxW || 150;
      if (B.text !== text || B.size !== size || B.maxW !== maxW) { B.text = text; B.size = size; B.maxW = maxW; B.lines = null; }
    }
    if (!B.lines) layoutBubble(g, B);
    const k = o.k === undefined ? 1 : o.k, side = o.side || 1, ink = o.ink || '#2a1a10', col = o.col || '#FFFAE6';
    if (k <= 0) return;
    const w = B.w, h = B.h, bx = -w * 0.5 + side * w * 0.22, by = -h - 9, r = Math.min(9, h / 2);
    g.save(); g.translate(x, y); g.scale(k, k);
    g.lineJoin = 'round'; g.lineWidth = 2;
    // sombra dura
    g.fillStyle = ink; rrPath(g, bx, by + 3, w, h, r); g.fill();
    // corpo + ponta
    g.fillStyle = col; g.strokeStyle = ink;
    rrPath(g, bx, by, w, h, r); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(side * 3 - 5, by + h - 1); g.lineTo(0, -1); g.lineTo(side * 3 + 5, by + h - 1); g.fill();
    g.beginPath(); g.moveTo(side * 3 - 5, by + h); g.lineTo(0, -1); g.lineTo(side * 3 + 5, by + h); g.stroke();
    g.fillStyle = col; g.fillRect(side * 3 - 4, by + h - 2.5, 8, 2.6);
    // texto
    g.font = '900 ' + B.size + 'px ' + BUBBLE_FONT; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#3B2818';
    const lh = B.size * 1.25, y0 = by + h / 2 - (B.lines.length - 1) * lh / 2 + 0.5;
    for (let i = 0; i < B.lines.length; i++) {
      const ln = B.shown !== undefined && B.shown < B.count ? clipLine(B, i) : B.lines[i];
      if (ln) g.fillText(ln, bx + w / 2, y0 + i * lh);
    }
    g.restore();
  }
  // corta a linha i pelo número de letras já "digitadas" (B.shown)
  function clipLine(B, i) {
    let left = Math.floor(B.shown);
    for (let j = 0; j < i; j++) left -= B.lines[j].length + 1;
    return left <= 0 ? '' : B.lines[i].slice(0, left);
  }

  /* =====================================================================
     11. Actor
     ===================================================================== */
  const anchorTmp = { x: 0, y: 0 };
  const drawOpts = { face: 1, scale: 1, squash: 0, rot: 0, pal: 'kome', hat: true, mouth: null, eyes: null, alpha: 1, shadow: true, fast: 0 };
  const bubbleOpts = { k: 1, side: 1 };                  // reaproveitados: nada de alocar por frame
  const anchorOpts = { hat: true, fast: 0, pal: 'kome' };

  /* Actor(opts) -> shiba com estado.
     campos: x,y,face,pose,t,pal,scale,squash,rot,vx,vy,hat,alpha,eyes,mouth,fast,shadow,visible,timeScale,
             hold ({cv,ax,ay,rot,scale,behind,anchor} ou canvas), autoPose (anda/corre/para sozinho pela vx)
     métodos: say(texto,seg,{size,maxW,typing}), shutUp(), hop(força), update(dt), draw(g), anchor(nome,out)->{x,y} no mundo */
  function Actor(opts) {
    const a = {
      x: 0, y: 0, face: 1, pose: 'sit', t: Math.random() * 20, pal: 'kome', scale: 1, squash: 0, rot: 0, vx: 0, vy: 0,
      hat: true, alpha: 1, eyes: null, mouth: null, fast: 0, shadow: true, visible: true, timeScale: 1,
      hold: null, autoPose: false, idlePose: 'stand', walkSpeed: 20, runSpeed: 150,
      gravity: 0, ground: 0, z: 0, vz: 0,                 // z = altura do pulinho (hop), separado de y
      bubble: null,
      // say(texto, seg=2.5, {size=11, maxW=150, typing=true}): abre o balão de fala
      say(text, sec, o) {
        o = o || NOOPTS;
        a.bubble = { text: String(text), lines: null, size: o.size || 11, maxW: o.maxW || 150, age: 0, dur: sec === undefined ? 2.5 : sec,
          count: String(text).length, shown: o.typing === false ? 1e9 : 0, cps: o.cps || 40 };
        return a;
      },
      // shutUp(): fecha o balão já
      shutUp() { a.bubble = null; return a; },
      // hop(v=120): pulinho com squash na aterrissagem
      hop(v) { if (a.z === 0) a.vz = v === undefined ? 120 : v; return a; },
      // update(dt): avança tempo, posição, pulinho, balão
      update(dt) {
        a.t += dt * a.timeScale;
        a.x += a.vx * dt; a.y += a.vy * dt;
        if (a.vx > 1) a.face = 1; else if (a.vx < -1) a.face = -1;
        if (a.autoPose) { const v = Math.abs(a.vx); a.pose = v > a.runSpeed ? 'run' : v > a.walkSpeed ? 'walk' : a.idlePose; }
        if (a.vz !== 0 || a.z > 0) {
          a.z += a.vz * dt; a.vz -= 620 * dt;
          if (a.z <= 0) { a.z = 0; a.vz = 0; a.squash = 0.22; }
        }
        if (a.squash !== 0) { a.squash = U.damp ? U.damp(a.squash, 0, 14, dt) : a.squash * Math.max(0, 1 - dt * 14); if (Math.abs(a.squash) < 0.004) a.squash = 0; }
        const B = a.bubble;
        if (B) { B.age += dt; B.shown += B.cps * dt; if (B.age > B.dur) a.bubble = null; }
      },
      // anchor(nome, out?) -> {x,y} em coordenadas de mundo (considera face, escala, squash e rot), no mesmo t do frame desenhado
      anchor(name, out) {
        const ao = anchorOpts; ao.hat = a.hat; ao.fast = a.fast; ao.pal = a.pal;
        out = shibaAnchor(a.pose, frameT(a.t, ao), name, out, ao);
        const lx = out.x * a.face * a.scale * (1 + a.squash * 0.6), ly = out.y * a.scale * (1 - a.squash);
        const c = Math.cos(a.rot), sn = Math.sin(a.rot);
        out.x = a.x + lx * c - ly * sn; out.y = a.y - a.z + lx * sn + ly * c;
        return out;
      },
      // draw(g): desenha o shiba, o objeto na pata e o balão
      draw(g) {
        if (!a.visible) return;
        const o = drawOpts;
        o.face = a.face; o.scale = a.scale; o.squash = a.squash; o.rot = a.rot; o.pal = a.pal; o.hat = a.hat; o.mouth = a.mouth; o.eyes = a.eyes;
        o.alpha = a.alpha; o.shadow = a.shadow && a.z === 0; o.fast = a.fast;
        const h = a.hold, y = a.y - a.z;
        if (a.z > 0 && a.shadow) {                         // sombra fica no chão durante o pulinho
          const k = 1 / (1 + a.z * 0.03);
          g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(a.x, a.y, 12 * a.scale * k, 1.4 * a.scale * k, 0, 0, U.TAU || Math.PI * 2); g.fill();
        }
        if (h && h.behind) a.drawHold(g, h, y);
        drawShiba(g, a.x, y, a.pose, a.t, o);
        if (h && !h.behind) a.drawHold(g, h, y);
        if (a.bubble) a.drawBubble(g);
      },
      // drawHold(g, hold, y): desenha o sprite preso à âncora (padrão 'hold' = pata)
      drawHold(g, h, y) {
        const ao = anchorOpts; ao.hat = a.hat; ao.fast = a.fast; ao.pal = a.pal;
        // âncora no t do frame que o cache desenha (senão o objeto treme 1px em relação à pata)
        const cv = h.cv || h, p = shibaAnchor(a.pose, frameT(a.t, ao), h.anchor || 'hold', anchorTmp, ao), hs = h.scale || 1;
        g.save(); g.translate(a.x, y); if (a.rot) g.rotate(a.rot);
        g.scale(a.face * a.scale * (1 + a.squash * 0.6), a.scale * (1 - a.squash));
        g.translate(p.x + (h.dx || 0), p.y + (h.dy || 0)); if (h.rot) g.rotate(h.rot);
        g.imageSmoothingEnabled = false; if (a.alpha < 1) g.globalAlpha *= a.alpha;
        g.drawImage(cv, -(h.ax === undefined ? cv.width / 2 : h.ax) * hs, -(h.ay === undefined ? cv.height / 2 : h.ay) * hs, cv.width * hs, cv.height * hs);
        g.restore();
      },
      // drawBubble(g): balão acima da cabeça, com pop de entrada/saída
      drawBubble(g) {
        const B = a.bubble; if (!B) return;
        const p = a.anchor('hatTop', anchorTmp);
        const kin = Math.min(1, B.age / 0.18), kout = Math.min(1, (B.dur - B.age) / 0.12);
        const k = kout < 1 ? Math.max(0, kout) : (U.ease && U.ease.back ? U.ease.back(kin) : kin);
        bubbleOpts.k = k; bubbleOpts.side = a.face;
        drawBubble(g, p.x + a.face * 4 * a.scale, p.y - 3 * a.scale, B, bubbleOpts);
      },
    };
    if (opts) for (const k in opts) a[k] = opts[k];
    return a;
  }

  /* =====================================================================
     12. Exporta
     ===================================================================== */
  E.ShibaPX = ShibaPX;
  E.PALS = PALS;
  E.SHIBA_POSES = SHIBA_POSES;
  E.SHIBA_EYES = EYES;
  E.SHIBA_MOUTHS = MOUTHS;
  E.SHIBA_EXPRS = EXPRS;
  E.drawShiba = drawShiba;
  E.shibaCanvas = shibaCanvas;
  E.drawShibaHead = drawShibaHead;
  E.drawBubble = drawBubble;
  E.PAW = PAW; E.MOUTH = MOUTH; E.HEAD = HEAD;
  E.shibaAnchor = shibaAnchor;
  E.Actor = Actor;
})();
