/* ============================================================================
   Kome Engine v1.0 — pix.js
   O "estilo Kome" pra tudo que não é o cachorro:
     E.LINE / E.LINE_CSS   contorno marrom escuro oficial
     E.PAL                 paleta quente e limitada
     E.Pix                 construtor de pixel art (contorno 4-vizinhos igual ao do Kome)
     E.sprite              cache de sprites Pix
     E.drawSprite          desenha um canvas com âncora / rotação / escala / flip
     E.Draw                primitivas vetoriais no MUNDO (máquinas gigantes) com o mesmo
                           contorno e as mesmas cores chapadas
   Depende de: core.js (E.U)
   ============================================================================ */
(function () {
  'use strict';
  const E = (window.KomeEngine = window.KomeEngine || {});
  if (!E.U) throw new Error('KomeEngine: carregue core.js antes de pix.js');
  const U = E.U, TAU = Math.PI * 2;

  /* ======================================================================
     1. Contorno e paleta
     ====================================================================== */
  const LINE = [59, 40, 24, 255];
  const LINE_CSS = '#3B2818';
  const DARK = [40, 20, 8, 255];      // sombras = cor misturada com este marrom
  const LIGHT = [255, 250, 230, 255]; // luzes = cor misturada com este creme

  // Paleta oficial. Os valores do rascunho (art.js "C" e game.js) foram mantidos.
  const PAL = {
    line: LINE_CSS, ink: '#2A1A10', cream: '#FFFAEE', white: '#FFFFFF',
    // arroz e ouro
    rice: '#FFFDF6', riceS: '#E6DCC4', riceD: '#CFC2A2',
    gold: '#F3C94A', goldL: '#FFE68A', goldD: '#B4852A',
    press: '#E9DCBE', pressD: '#C9B78E',            // arroz prensado (camada dura)
    // madeira, palha, pano
    wood: '#A9763F', woodD: '#7A5228', woodL: '#CF9E63',
    sack: '#D8C49A', sackD: '#B89E6C',
    // tintas de máquina
    red: '#C8423A', redD: '#93302A', redL: '#E8776A',
    yel: '#EDB93A', yelD: '#B88A1E', yelL: '#F8DC7C',
    ora: '#E2742E', oraD: '#B0531C', oraL: '#F3A566',
    // metais e borracha
    steel: '#C3CBD4', steelD: '#808A96', steelL: '#E3E8EE',
    gray: '#8E949C', grayD: '#676D75', grayL: '#B4BAC2',
    blk: '#3A332D', blkL: '#5A524A',
    rust: '#B9652A', rustD: '#8A4A1E',
    glass: '#A8D8EA', glassD: '#6FAECB',
    // natureza
    grass: '#7F9E5C', grassD: '#5D7A40', grassL: '#A9C08A',
    leaf: '#6B8A4B', leafD: '#4F6142',
    sakura: '#F4B8C5', sakuraD: '#D98AA0', pink: '#D95763',
    water: '#6FB3D2', waterD: '#3F7FA6', waterL: '#B5E0EE',
    sky: '#9FD3E8', skyL: '#FBE8C8',
    sand: '#E9D3A8', stone: '#A39C8C', stoneD: '#77705F', stoneL: '#CFC8B6',
    // personagens e comida
    fur: '#D9A066', furS: '#A8773F',
    bowl: '#3F5E92', bowlL: '#6487C0',
    mochi: '#F8E8E2', mochiD: '#E2C4BA',
    // céu
    night: '#2B2A3A', sun: '#FFD36B',
  };

  /* ======================================================================
     2. Cores empacotadas (uint32 little-endian: 0xAABBGGRR). 0 = pixel vazio
     ====================================================================== */
  const packCache = new Map();

  // pack(c) -> uint32: aceita hex ou [r,g,b,a]; null/alfa 0 -> 0 (vazio)
  function pack(c) {
    if (c == null) return 0;
    if (typeof c === 'number') return c >>> 0;
    if (typeof c === 'string') {
      let v = packCache.get(c);
      if (v === undefined) {
        const a = U.hex(c);
        v = ((a[3] << 24) | (a[2] << 16) | (a[1] << 8) | a[0]) >>> 0;
        if (packCache.size >= 2000) packCache.clear();
        packCache.set(c, v);
      }
      return v;
    }
    const al = c.length > 3 ? c[3] : 255;
    return (((al & 255) << 24) | ((c[2] & 255) << 16) | ((c[1] & 255) << 8) | (c[0] & 255)) >>> 0;
  }

  // unpack(v) -> [r,g,b,a]
  function unpack(v) {
    return [v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255];
  }

  // mixPacked(v, alvo[r,g,b], t) -> uint32: mistura mantendo o alfa
  function mixPacked(v, tg, t) {
    const r = v & 255, gg = (v >>> 8) & 255, b = (v >>> 16) & 255, a = v >>> 24;
    const R = Math.round(r + (tg[0] - r) * t), G = Math.round(gg + (tg[1] - gg) * t), B = Math.round(b + (tg[2] - b) * t);
    return ((a << 24) | (B << 16) | (G << 8) | R) >>> 0;
  }

  /* ======================================================================
     3. Pix — construtor de pixel art
     ====================================================================== */
  // E.Pix(w,h) -> P: tela de pixel art; todos os métodos de desenho são encadeáveis
  function Pix(w, h) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    let buf = new Uint32Array(w * h);

    function put(x, y, v) {
      x = Math.round(x); y = Math.round(y);
      if (v && x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = v;
    }
    function disc(cx, cy, rx, ry, v) {
      if (!v || rx <= 0 || ry <= 0) return;
      const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry), x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) put(x, y, v);
      }
    }
    const xs = []; // interseções da varredura do poly (reaproveitado)
    const THIN = 1.5; // abaixo disso line/arc viram traço de 1px

    const P = {
      w, h,
      get buf() { return buf; },

      /* ---------- formas ---------- */
      // P.set(x,y,c): pinta um pixel
      set(x, y, c) { put(x, y, pack(c)); return P; },
      // P.get(x,y) -> [r,g,b,a] | null
      get(x, y) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= w || y >= h) return null;
        const v = buf[y * w + x];
        return v ? unpack(v) : null;
      },
      // P.rect(x,y,w,h,c): retângulo cheio
      rect(x, y, ww, hh, c) {
        const v = pack(c);
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) put(x + i, y + j, v);
        return P;
      },
      // P.rrect(x,y,w,h,r,c): retângulo com cantos arredondados de raio r
      rrect(x, y, ww, hh, r, c) {
        const v = pack(c);
        r = Math.max(0, Math.min(r, ww / 2, hh / 2));
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
          const px = i + 0.5, py = j + 0.5;
          const qx = px < r ? r - px : px > ww - r ? px - (ww - r) : 0;
          const qy = py < r ? r - py : py > hh - r ? py - (hh - r) : 0;
          if (qx * qx + qy * qy <= r * r + 0.01) put(x + i, y + j, v);
        }
        return P;
      },
      // P.ell(cx,cy,rx,ry,c): elipse cheia
      ell(cx, cy, rx, ry, c) { disc(cx, cy, rx, ry, pack(c)); return P; },
      // P.tri(ax,ay,bx,by,cx,cy,c): triângulo cheio
      tri(ax, ay, bx, by, cx, cy, c) {
        const v = pack(c);
        const x0 = Math.floor(Math.min(ax, bx, cx)), x1 = Math.ceil(Math.max(ax, bx, cx));
        const y0 = Math.floor(Math.min(ay, by, cy)), y1 = Math.ceil(Math.max(ay, by, cy));
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
          const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
          const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
          if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) put(x, y, v);
        }
        return P;
      },
      // P.poly(pts,c): polígono cheio (côncavo ou convexo), pts = [[x,y],...]
      poly(pts, c) {
        const v = pack(c), n = pts.length;
        if (n < 3 || !v) return P;
        let y0 = Infinity, y1 = -Infinity;
        for (let i = 0; i < n; i++) { y0 = Math.min(y0, pts[i][1]); y1 = Math.max(y1, pts[i][1]); }
        y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(h - 1, Math.ceil(y1));
        for (let y = y0; y <= y1; y++) {
          const py = y + 0.5; xs.length = 0;
          for (let i = 0, j = n - 1; i < n; j = i++) {
            const ay = pts[i][1], by = pts[j][1];
            if ((ay <= py && by > py) || (by <= py && ay > py)) xs.push(pts[i][0] + (py - ay) / (by - ay) * (pts[j][0] - pts[i][0]));
          }
          xs.sort((a, b) => a - b);
          for (let k = 0; k + 1 < xs.length; k += 2) {
            const xa = Math.ceil(xs[k] - 0.5), xb = Math.floor(xs[k + 1] - 0.5);
            for (let x = xa; x <= xb; x++) put(x, y, v);
          }
        }
        return P;
      },
      // P.line(x0,y0,x1,y1,wd,c): linha grossa de pontas redondas; wd < 1.5 = linha de 1px conectada do pixel (x0,y0) ao pixel (x1,y1)
      //   (traço fino usa a convenção do set(): coordenada = índice do pixel; traço grosso/ell usam coordenada contínua, centro do pixel em +.5)
      line(x0, y0, x1, y1, wd, c) {
        const v = pack(c);
        if (wd < THIN) { // pincel de disco não pega pixel nenhum em coordenada inteira: anda pixel a pixel
          x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1); // mesma convenção do set(): coordenada = índice do pixel
          const m = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
          for (let i = 0; i <= m; i++) { const t = m ? i / m : 0; put(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, v); }
          return P;
        }
        const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
        for (let i = 0; i <= n; i++) { const t = i / n; disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, wd / 2, wd / 2, v); }
        return P;
      },
      // P.ring(cx,cy,r,wd,c): anel de raio externo r e espessura wd
      ring(cx, cy, r, wd, c) {
        const v = pack(c), ri = Math.max(0, r - wd);
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = dx * dx + dy * dy;
          if (d <= r * r && d >= ri * ri) put(x, y, v);
        }
        return P;
      },
      // P.arc(cx,cy,r,a0,a1,wd,c): arco (radianos, sentido horário na tela) com espessura wd
      arc(cx, cy, r, a0, a1, wd, c) {
        const v = pack(c), n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * r * 2));
        for (let i = 0; i <= n; i++) {
          const a = a0 + (a1 - a0) * i / n, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          if (wd < THIN) put(x, y, v);                        // arco fino: 1px, na convenção do set() (centro = índice do pixel)
          else disc(x, y, wd / 2, wd / 2, v);
        }
        return P;
      },
      // P.erase(x,y,w,h): apaga um retângulo (volta a ser transparente)
      erase(x, y, ww, hh) {
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
          const X = Math.round(x + i), Y = Math.round(y + j);
          if (X >= 0 && Y >= 0 && X < w && Y < h) buf[Y * w + X] = 0;
        }
        return P;
      },

      /* ---------- texturas e sombreamento ---------- */
      // P.dither(x,y,w,h,c,padrão='checker'|'25'|'75'|'hlines'|'vlines',{mask=false}): retícula; mask = só onde já existe pixel
      dither(x, y, ww, hh, c, pattern, opts) {
        const v = pack(c), pt = pattern || 'checker', mask = !!(opts && opts.mask);
        x = Math.round(x); y = Math.round(y);
        for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) {
          const X = x + i, Y = y + j;
          let on;
          if (pt === '25') on = (X & 1) === 0 && (Y & 1) === 0 && ((X >> 1) + (Y >> 1)) % 2 === 0 || ((X & 1) === 1 && (Y & 1) === 1 && ((X >> 1) + (Y >> 1)) % 2 === 1);
          else if (pt === '75') on = !((X & 1) === 0 && (Y & 1) === 0);
          else if (pt === 'hlines') on = (Y & 1) === 0;
          else if (pt === 'vlines') on = (X & 1) === 0;
          else on = ((X + Y) & 1) === 0;
          if (!on || X < 0 || Y < 0 || X >= w || Y >= h) continue;
          if (mask && !buf[Y * w + X]) continue;
          buf[Y * w + X] = v;
        }
        return P;
      },
      // P.shadeBelow(c,k=.28,depth?): escurece a borda de baixo/direita das manchas de cor c (volume automático)
      shadeBelow(c, k, depth) {
        const v = pack(c); if (!v) return P;
        if (k === undefined) k = 0.28;
        let x0 = w, x1 = -1, y0 = h, y1 = -1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (buf[y * w + x] === v) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
        if (x1 < 0) return P;
        const d = depth || Math.max(1, Math.round(Math.min(x1 - x0 + 1, y1 - y0 + 1) * 0.16));
        const sh = k < 0 ? mixPacked(v, LIGHT, -k) : mixPacked(v, DARK, k);
        const src = buf.slice();
        const is = (x, y) => x >= 0 && y >= 0 && x < w && y < h && src[y * w + x] === v;
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          if (src[y * w + x] !== v) continue;
          if (!is(x, y + d) || !is(x + d, y) || !is(x + Math.ceil(d * 0.7), y + Math.ceil(d * 0.7))) buf[y * w + x] = sh;
        }
        return P;
      },
      // P.bevel(hi=.32,lo=.26): 1px de luz em cima/esquerda e sombra embaixo/direita por dentro da silhueta
      bevel(hi, lo) {
        if (hi === undefined) hi = 0.32;
        if (lo === undefined) lo = 0.26;
        const src = buf.slice();
        const emp = (x, y) => x < 0 || y < 0 || x >= w || y >= h || !src[y * w + x];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const v = src[y * w + x]; if (!v) continue;
          if (emp(x, y - 1) || emp(x - 1, y)) { if (!(emp(x, y + 1) && emp(x + 1, y))) buf[y * w + x] = mixPacked(v, LIGHT, hi); }
          else if (emp(x, y + 1) || emp(x + 1, y)) buf[y * w + x] = mixPacked(v, DARK, lo);
        }
        return P;
      },
      // P.replace(c1,c2): troca todos os pixels de cor c1 por c2 (c2 null apaga)
      replace(c1, c2) {
        const a = pack(c1), b = pack(c2);
        if (a) for (let i = 0; i < buf.length; i++) if (buf[i] === a) buf[i] = b;
        return P;
      },
      // P.mask(fn(x,y,[r,g,b,a])->bool): mantém só os pixels em que fn devolve verdadeiro
      mask(fn) {
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const v = buf[y * w + x];
          if (v && !fn(x, y, unpack(v))) buf[y * w + x] = 0;
        }
        return P;
      },
      // P.mirrorX(): espelha a tela inteira na horizontal
      mirrorX() {
        for (let y = 0; y < h; y++) for (let x = 0; x < (w >> 1); x++) {
          const i = y * w + x, j = y * w + (w - 1 - x), t = buf[i];
          buf[i] = buf[j]; buf[j] = t;
        }
        return P;
      },
      // P.symX(): copia a metade esquerda espelhada na direita (pra sprites simétricos)
      symX() {
        for (let y = 0; y < h; y++) for (let x = 0; x < (w >> 1); x++) buf[y * w + (w - 1 - x)] = buf[y * w + x];
        return P;
      },
      // P.stamp(outroP,x,y,{flip=false}): carimba outro Pix (pixels vazios não cobrem)
      stamp(o, x, y, opts) {
        const ob = o.buf, flip = !!(opts && opts.flip);
        x = Math.round(x); y = Math.round(y);
        for (let j = 0; j < o.h; j++) for (let i = 0; i < o.w; i++) {
          const v = ob[j * o.w + (flip ? o.w - 1 - i : i)];
          if (v) put(x + i, y + j, v);
        }
        return P;
      },
      // P.clone() -> novo Pix com os mesmos pixels
      clone() { const q = Pix(w, h); q.buf.set(buf); return q; },
      // P.pad(n=1) -> NOVO Pix com n px de margem vazia em volta (pro contorno não ser cortado quando a arte encosta na borda)
      pad(n) {
        n = n === undefined ? 1 : Math.max(0, n | 0);
        const q = Pix(w + n * 2, h + n * 2), qb = q.buf, qw = w + n * 2;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) qb[(y + n) * qw + x + n] = buf[y * w + x];
        return q;
      },
      // P.touchesEdge() -> bool: tem pixel pintado encostado na borda? (o contorno seria cortado ali)
      touchesEdge() {
        for (let x = 0; x < w; x++) if (buf[x] || buf[(h - 1) * w + x]) return true;
        for (let y = 0; y < h; y++) if (buf[y * w] || buf[y * w + w - 1]) return true;
        return false;
      },

      /* ---------- saída ---------- */
      // P.canvas(outline=true, lineColor=E.LINE) -> HTMLCanvasElement (contorno 4-vizinhos como o do Kome)
      canvas(outline, lineColor) {
        const out = outline === false ? buf : Pix.outline(buf, w, h, lineColor || LINE);
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        const g = cv.getContext('2d'), img = g.createImageData(w, h);
        new Uint32Array(img.data.buffer).set(out);
        g.putImageData(img, 0, 0);
        return cv;
      },
    };
    return P;
  }

  // E.Pix.outline(buf,w,h,c) -> novo buffer com contorno 4-vizinhos (aceita Uint32Array ou o array legado de cores)
  Pix.outline = function (buf, w, h, c) {
    const typed = buf instanceof Uint32Array;
    const o = buf.slice(), v = typed ? pack(c) : c;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (buf[i]) continue;
      if ((x + 1 < w && buf[i + 1]) || (x > 0 && buf[i - 1]) || (y + 1 < h && buf[i + w]) || (y > 0 && buf[i - w])) o[i] = v;
    }
    return o;
  };
  Pix.pack = pack;
  Pix.unpack = unpack;

  /* ======================================================================
     4. sprite (cache) e drawSprite
     ====================================================================== */
  const spriteCache = Object.create(null);

  // E.sprite(nome,w,h,fn(P),outline=true) -> canvas cacheado
  function sprite(name, w, h, fn, outline) {
    let cv = spriteCache[name];
    if (!cv) {
      const P = Pix(w, h);
      fn(P);
      cv = spriteCache[name] = P.canvas(outline !== false);
    }
    return cv;
  }
  // E.sprite.clear(nome?): esvazia o cache (tudo, ou só um nome)
  sprite.clear = function (name) {
    if (name === undefined) { for (const k in spriteCache) delete spriteCache[k]; }
    else delete spriteCache[name];
  };
  // E.sprite.has(nome) -> bool ; E.sprite.get(nome) -> canvas | undefined
  sprite.has = name => !!spriteCache[name];
  sprite.get = name => spriteCache[name];

  const NO = Object.freeze({}); // opções vazias compartilhadas (evita alocar por chamada)

  // E.drawSprite(g, cv, x, y, {ax=cv.width/2, ay=cv.height, rot=0, sx=1, sy=1, alpha=1, flip=false, smooth})
  //   smooth: true/false força; sem ele, pixel duro, menos quando o sprite é reduzido pra menos de 75% (|sx| × Draw.zoom),
  //   onde a redução suave evita o contorno picotado
  function drawSprite(g, cv, x, y, o) {
    o = o || NO;
    const ax = o.ax !== undefined ? o.ax : cv.width / 2, ay = o.ay !== undefined ? o.ay : cv.height;
    const sx = (o.sx !== undefined ? o.sx : 1) * (o.flip ? -1 : 1), sy = o.sy !== undefined ? o.sy : 1;
    const rot = o.rot || 0, al = o.alpha !== undefined ? o.alpha : 1;
    if (al <= 0) return;
    const sm = g.imageSmoothingEnabled, pa = g.globalAlpha;
    g.imageSmoothingEnabled = o.smooth !== undefined ? !!o.smooth : Math.min(Math.abs(sx), Math.abs(sy)) * Draw.zoom < 0.75;
    if (al !== 1) g.globalAlpha = pa * al;
    if (!rot && sx === 1 && sy === 1) g.drawImage(cv, x - ax, y - ay);
    else {
      g.save();
      g.translate(x, y);
      if (rot) g.rotate(rot);
      g.scale(sx, sy);
      g.drawImage(cv, -ax, -ay);
      g.restore();
    }
    g.imageSmoothingEnabled = sm;
    if (al !== 1) g.globalAlpha = pa;
  }

  /* ======================================================================
     5. Draw — primitivas vetoriais no mundo
     Convenções:
       - contorno = Draw.OL unidades de mundo pra FORA da forma (traço 2*OL atrás do preenchimento);
       - cores chapadas: base + faixa de luz em cima + faixa de sombra embaixo (nada de gradiente);
       - retângulos (box, lattice, track, window, sign) usam (x,y) = canto de cima/esquerda;
       - Draw.lod(zoom) uma vez por frame liga o nível de detalhe: miudezas (rebites, parafusos,
         garras do pneu) somem quando ficam menores que ~1px de tela, e Draw.minPx garante uma
         espessura mínima de contorno em pixels de tela quando a câmera afasta.
     ====================================================================== */
  const Draw = {
    OL: 2,            // espessura do contorno em unidades de mundo
    zoom: 1,          // zoom atual da câmera (informado por Draw.lod)
    minPx: 0,         // contorno mínimo em px de tela (0 = desliga); ex.: .6 pra Bagger vista de longe
    detailPx: 0.9,    // detalhes menores que isso (px de tela) não são desenhados
    FONT: "'Zen Maru Gothic','M PLUS Rounded 1c','Hiragino Maru Gothic ProN','Nunito',system-ui,sans-serif",
    LINE: LINE_CSS,
  };

  // Draw.lod(zoom, minPx?): informa o zoom da câmera (chamar 1x por frame antes de desenhar o mundo)
  Draw.lod = function (zoom, minPx) {
    Draw.zoom = zoom > 0 ? zoom : 1;
    if (minPx !== undefined) Draw.minPx = minPx;
    return Draw;
  };

  /* ---------- helpers internos ---------- */
  function olOf(o) {
    const v = o.ol !== undefined ? o.ol : Draw.OL;
    if (v <= 0) return 0;
    const m = Draw.minPx / Draw.zoom;
    return v > m ? v : m;
  }
  function big(size) { return size * Draw.zoom >= Draw.detailPx; }
  function col2(c) { return typeof c === 'string' ? c : U.css(c); }
  function hiOf(c, k) { return U.shade(c, k === undefined ? 0.3 : k); }
  function loOf(c, k) { return U.shade(c, -(k === undefined ? 0.22 : k)); }

  function rrPath(g, x, y, w, h, r) {
    g.beginPath();
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    r = Math.min(r, w / 2, h / 2);
    if (!(r > 0)) { g.rect(x, y, w, h); return; }
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function ptsPath(g, pts, close) {
    g.beginPath();
    for (let i = 0; i < pts.length; i++) { if (i) g.lineTo(pts[i][0], pts[i][1]); else g.moveTo(pts[0][0], pts[0][1]); }
    if (close) g.closePath();
  }
  // faixa paralela à polilinha, deslocada pro lado de cima (ou de baixo se side=-1)
  function sidePath(g, pts, off, side) {
    g.beginPath();
    for (let i = 0; i + 1 < pts.length; i++) {
      const ax = pts[i][0], ay = pts[i][1], bx = pts[i + 1][0], by = pts[i + 1][1];
      const L = Math.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
      let nx = -(by - ay) / L, ny = (bx - ax) / L;
      if (ny > 0.0001 || (Math.abs(ny) <= 0.0001 && nx > 0)) { nx = -nx; ny = -ny; } // normal apontando pra cima (ou esquerda)
      g.moveTo(ax + nx * off * side, ay + ny * off * side);
      g.lineTo(bx + nx * off * side, by + ny * off * side);
    }
  }

  /* ---------- formas básicas ---------- */
  // Draw.beam(g, pts, w, col, {ol=Draw.OL, cap='round', hi, shade}): polilinha grossa com contorno, luz em cima e sombra embaixo
  Draw.beam = function (g, pts, w, col, o) {
    o = o || NO; col = col2(col);
    const ol = olOf(o), cap = o.cap || 'round';
    g.lineCap = cap; g.lineJoin = 'round';
    ptsPath(g, pts, false);
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = w + ol * 2; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
    if (o.hi !== false && big(w * 0.4)) {
      g.lineWidth = w * 0.26;
      sidePath(g, pts, w * 0.25, 1);
      g.strokeStyle = typeof o.hi === 'string' ? o.hi : hiOf(col); g.stroke();
      if (o.shade !== false) {
        sidePath(g, pts, w * 0.27, -1);
        g.strokeStyle = typeof o.shade === 'string' ? o.shade : loOf(col); g.stroke();
      }
    }
  };

  // Draw.poly(g, pts, col, {ol, shade, hi, close=true}): polígono chapado com contorno; shade/hi = cor da faixa de baixo/cima (opcional)
  Draw.poly = function (g, pts, col, o) {
    o = o || NO; col = col2(col);
    const ol = olOf(o), close = o.close !== false;
    g.lineJoin = 'round'; g.lineCap = 'round';
    ptsPath(g, pts, close);
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = ol * 2; g.stroke(); }
    g.fillStyle = col; g.fill();
    if (o.shade || o.hi) {
      let y0 = Infinity, y1 = -Infinity, x0 = Infinity, x1 = -Infinity;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      }
      const hh = y1 - y0;
      g.save(); g.clip();
      if (o.shade) { g.fillStyle = o.shade === true ? loOf(col) : col2(o.shade); g.fillRect(x0, y1 - hh * (o.shadeK || 0.3), x1 - x0, hh); }
      if (o.hi) { g.fillStyle = o.hi === true ? hiOf(col) : col2(o.hi); g.fillRect(x0, y0, x1 - x0, hh * (o.hiK || 0.16)); }
      g.restore();
    }
  };

  // Draw.circle(g, x, y, r, col, {ol, hi=true, shade=true}): disco chapado com contorno, meia-lua de sombra e brilho
  Draw.circle = function (g, x, y, r, col, o) {
    o = o || NO; col = col2(col);
    const ol = olOf(o);
    if (ol > 0) { g.fillStyle = LINE_CSS; g.beginPath(); g.arc(x, y, r + ol, 0, TAU); g.fill(); }
    if (o.shade !== false && big(r * 0.3)) {
      g.fillStyle = typeof o.shade === 'string' ? o.shade : loOf(col);
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = col;
      g.beginPath(); g.arc(x - r * 0.1, y - r * 0.12, r * 0.86, 0, TAU); g.fill();
    } else { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    if (o.hi !== false && big(r * 0.3)) {
      g.strokeStyle = typeof o.hi === 'string' ? o.hi : hiOf(col, 0.45);
      g.lineWidth = r * 0.16; g.lineCap = 'round';
      g.beginPath(); g.arc(x, y, r * 0.64, Math.PI * 1.12, Math.PI * 1.45); g.stroke();
    }
  };

  // Draw.ring(g, x, y, r, wd, col, {ol, hi=true}): anel de raio externo r e espessura wd
  Draw.ring = function (g, x, y, r, wd, col, o) {
    o = o || NO; col = col2(col);
    if (!(r > 0)) return;
    if (wd > r) wd = r;                       // mais grosso que o raio: vira disco
    const ol = olOf(o), rm = r - wd / 2;
    g.beginPath(); g.arc(x, y, rm, 0, TAU);
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = wd + ol * 2; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = wd; g.stroke();
    if (o.hi !== false && big(wd * 0.4)) {
      g.lineCap = 'round'; g.lineWidth = wd * 0.3;
      g.strokeStyle = hiOf(col, 0.4);
      g.beginPath(); g.arc(x, y, rm + wd * 0.12, Math.PI * 1.08, Math.PI * 1.62); g.stroke();
      g.strokeStyle = loOf(col);
      g.beginPath(); g.arc(x, y, rm - wd * 0.12, Math.PI * 0.08, Math.PI * 0.62); g.stroke();
    }
  };

  // Draw.cable(g, a, b, {sag=0, lw=1.5, col=LINE, ol=0}): cabo de a=[x,y] até b com barriga 'sag' (unidades de mundo no meio do vão)
  Draw.cable = function (g, a, b, o) {
    o = o || NO;
    const sag = o.sag || 0, lw = o.lw || 1.5, m = Draw.minPx / Draw.zoom;
    g.lineCap = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]);
    if (sag) g.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag * 2, b[0], b[1]);
    else g.lineTo(b[0], b[1]);
    if (o.ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = lw + o.ol * 2; g.stroke(); }
    g.strokeStyle = o.col ? col2(o.col) : LINE_CSS;
    g.lineWidth = lw > m ? lw : m; g.stroke();
  };

  /* ---------- caixas e chapas ---------- */
  const STRIPE_A = PAL.yel, STRIPE_B = PAL.blk;

  // faixas de segurança diagonais dentro de um retângulo (recorta sozinho)
  function hazardFill(g, x, y, w, h, a, b, sw) {
    sw = sw || Math.max(3, h * 0.8);
    g.save();
    g.beginPath(); g.rect(x, y, w, h); g.clip();
    g.fillStyle = a; g.fillRect(x, y, w, h);
    g.fillStyle = b;
    g.beginPath();
    for (let sx = x - h - sw * 2; sx < x + w + sw; sx += sw * 2) {
      g.moveTo(sx, y + h); g.lineTo(sx + sw, y + h); g.lineTo(sx + sw + h, y); g.lineTo(sx + h, y); g.closePath();
    }
    g.fill();
    g.restore();
  }

  // Draw.hazard(g, x, y, w, h, {a=amarelo, b=preto, sw, ol}): faixa zebrada de segurança com contorno
  Draw.hazard = function (g, x, y, w, h, o) {
    o = o || NO;
    const ol = olOf(o);
    if (ol > 0) { g.fillStyle = LINE_CSS; g.fillRect(x - ol, y - ol, w + ol * 2, h + ol * 2); }
    hazardFill(g, x, y, w, h, o.a || STRIPE_A, o.b || STRIPE_B, o.sw);
  };

  // Draw.box(g, x, y, w, h, col, {top, shade, ol, r=0, rivets=false, panels=0, stripes}): caixa chapada com luz no topo e sombra embaixo
  //   top/shade: cor da faixa (false desliga); panels: nº de painéis verticais; rivets: true ou espaçamento;
  //   stripes: true (caixa toda zebrada) | 'top' | 'bottom' | número (altura da faixa zebrada na base)
  Draw.box = function (g, x, y, w, h, col, o) {
    o = o || NO; col = col2(col);
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    const ol = olOf(o), r = o.r || 0;
    if (ol > 0) {
      g.fillStyle = LINE_CSS;
      if (r > 0) { rrPath(g, x - ol, y - ol, w + ol * 2, h + ol * 2, r + ol); g.fill(); }
      else g.fillRect(x - ol, y - ol, w + ol * 2, h + ol * 2);
    }
    const clip = r > 0;
    if (clip) { g.save(); rrPath(g, x, y, w, h, r); g.clip(); }
    g.fillStyle = col; g.fillRect(x, y, w, h);
    const th = Math.max(Math.min(h * 0.14, 7), Math.min(2, h * 0.3)), bh = Math.max(Math.min(h * 0.16, 9), Math.min(2, h * 0.3));
    if (o.stripes === true) hazardFill(g, x, y, w, h, o.stripeA || STRIPE_A, o.stripeB || STRIPE_B, o.stripeW);
    else {
      if (o.top !== false) { g.fillStyle = o.top ? col2(o.top) : hiOf(col); g.fillRect(x, y, w, th); }
      if (o.shade !== false) { g.fillStyle = o.shade ? col2(o.shade) : loOf(col); g.fillRect(x, y + h - bh, w, bh); }
      if (o.stripes) {
        const sh = typeof o.stripes === 'number' ? o.stripes : Math.max(4, Math.min(h * 0.22, 12));
        hazardFill(g, x, o.stripes === 'top' ? y : y + h - sh, w, sh, o.stripeA || STRIPE_A, o.stripeB || STRIPE_B, o.stripeW);
      }
    }
    // linhas de painel
    if (o.panels > 1 && big(w / o.panels * 0.5)) {
      const pw = Math.max(1, Math.min(ol || 1, 1.5)), step = w / o.panels;
      g.fillStyle = loOf(col, 0.36);
      for (let i = 1; i < o.panels; i++) g.fillRect(x + step * i - pw / 2, y + th, pw, h - th - bh * 0.4);
      if (big(pw)) {
        g.fillStyle = hiOf(col, 0.22);
        for (let i = 1; i < o.panels; i++) g.fillRect(x + step * i + pw / 2, y + th, pw * 0.7, h - th - bh);
      }
    }
    // rebites
    if (o.rivets) {
      const rr = Math.max(0.7, Math.min(1.5, h * 0.035));
      if (big(rr * 2.5)) {
        const sp = typeof o.rivets === 'number' ? Math.max(o.rivets, rr * 3) : Math.max(8, rr * 9);
        const n = Math.max(1, Math.floor((w - rr * 6) / sp)), gap = (w - rr * 6) / n;
        g.fillStyle = loOf(col, 0.45);
        g.beginPath();
        for (let i = 0; i <= n; i++) {
          const rx = x + rr * 3 + gap * i;
          g.moveTo(rx + rr, y + th + rr * 2.2); g.arc(rx, y + th + rr * 2.2, rr, 0, TAU);
          g.moveTo(rx + rr, y + h - bh - rr * 2.2); g.arc(rx, y + h - bh - rr * 2.2, rr, 0, TAU);
        }
        g.fill();
      }
    }
    if (clip) g.restore();
  };

  // Draw.window(g, x, y, w, h, {glare=true, r=1.5, ol, col, frame}): vidro com reflexo diagonal; frame = cor de moldura opcional
  Draw.window = function (g, x, y, w, h, o) {
    o = o || NO;
    const ol = olOf(o), r = o.r !== undefined ? o.r : Math.min(1.5, w * 0.2, h * 0.2), c = o.col ? col2(o.col) : PAL.glass;
    if (o.frame) {
      const fw = Math.max(1.5, Math.min(w, h) * 0.1);
      g.fillStyle = LINE_CSS; rrPath(g, x - fw - ol, y - fw - ol, w + (fw + ol) * 2, h + (fw + ol) * 2, r + fw + ol); g.fill();
      g.fillStyle = col2(o.frame); rrPath(g, x - fw, y - fw, w + fw * 2, h + fw * 2, r + fw); g.fill();
    }
    g.fillStyle = LINE_CSS; rrPath(g, x - ol, y - ol, w + ol * 2, h + ol * 2, r + ol); g.fill();
    g.save();
    rrPath(g, x, y, w, h, r); g.clip();
    g.fillStyle = c; g.fillRect(x, y, w, h);
    g.fillStyle = o.col ? loOf(c, 0.25) : PAL.glassD; g.fillRect(x, y + h * 0.62, w, h * 0.38);
    if (o.glare !== false && big(w * 0.2)) {
      g.fillStyle = 'rgba(255,255,255,.62)';
      const s = h * 0.55, a = x + w * 0.16, b = w * 0.16, c2 = w * 0.07;
      g.beginPath();
      g.moveTo(a + s, y); g.lineTo(a + s + b, y); g.lineTo(a + b, y + h); g.lineTo(a, y + h); g.closePath();
      g.moveTo(a + s + b + c2, y); g.lineTo(a + s + b + c2 * 2, y); g.lineTo(a + b + c2 * 2, y + h); g.lineTo(a + b + c2, y + h); g.closePath();
      g.fill();
    }
    g.restore();
  };

  /* ---------- treliças ---------- */
  // caminho das diagonais/montantes de uma treliça (nós: c(q) ± n*half(q))
  function trussWeb(g, ax, ay, dx, dy, nx, ny, d0, d1, N, cross, verts) {
    g.beginPath();
    for (let k = 0; k < N; k++) {
      const q0 = k / N, q1 = (k + 1) / N, h0 = d0 + (d1 - d0) * q0, h1 = d0 + (d1 - d0) * q1;
      const x0 = ax + dx * q0, y0 = ay + dy * q0, x1 = ax + dx * q1, y1 = ay + dy * q1;
      const s = k % 2 ? 1 : -1;
      if (cross || s < 0) { g.moveTo(x0 - nx * h0, y0 - ny * h0); g.lineTo(x1 + nx * h1, y1 + ny * h1); }
      if (cross || s > 0) { g.moveTo(x0 + nx * h0, y0 + ny * h0); g.lineTo(x1 - nx * h1, y1 - ny * h1); }
      if (verts && k > 0) { g.moveTo(x0 + nx * h0, y0 + ny * h0); g.lineTo(x0 - nx * h0, y0 - ny * h0); }
    }
    // montantes das pontas
    g.moveTo(ax + nx * d0, ay + ny * d0); g.lineTo(ax - nx * d0, ay - ny * d0);
    g.moveTo(ax + dx + nx * d1, ay + dy + ny * d1); g.lineTo(ax + dx - nx * d1, ay + dy - ny * d1);
  }
  function trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, off0, off1) {
    g.beginPath();
    if (off0 !== null) { g.moveTo(ax + nx * (d0 + off0), ay + ny * (d0 + off0)); g.lineTo(ax + dx + nx * (d1 + off0), ay + dy + ny * (d1 + off0)); }
    if (off1 !== null) { g.moveTo(ax - nx * (d0 + off1), ay - ny * (d0 + off1)); g.lineTo(ax + dx - nx * (d1 + off1), ay + dy - ny * (d1 + off1)); }
  }

  // Draw.truss(g, a, b, depth, w, col, {taper=.6, bays, cross=false, verticals=cross, joints=true, web, ol, hi}):
  //   viga treliçada entre a=[x,y] e b: dois banzos (espessura w) afastados 'depth' em a e depth*taper em b,
  //   alma em zigue-zague (Warren) ou em X (cross) com montantes; web = cor da alma (padrão: col mais escura)
  Draw.truss = function (g, a, b, depth, w, col, o) {
    o = o || NO; col = col2(col);
    const ax = a[0], ay = a[1], dx = b[0] - ax, dy = b[1] - ay, L = Math.hypot(dx, dy);
    if (L < 1e-6) return;
    let nx = -dy / L, ny = dx / L;
    if (ny > 0.0001 || (Math.abs(ny) <= 0.0001 && nx > 0)) { nx = -nx; ny = -ny; } // +n = lado de cima (ou esquerdo)
    const taper = o.taper !== undefined ? o.taper : 0.6, cross = !!o.cross;
    const d0 = depth / 2, d1 = depth * taper / 2, ol = olOf(o);
    const N = o.bays || Math.max(2, Math.round(L / Math.max(4, (d0 + d1) * (cross ? 1.15 : 0.85))));
    const verts = o.verticals !== undefined ? o.verticals : cross;
    const ww = Math.max(w * 0.55, Math.min(w, 1));
    const webCol = o.web ? col2(o.web) : loOf(col, 0.2);
    g.lineCap = 'round'; g.lineJoin = 'round';

    const detail = big(Math.min(d0 + d1, L / N) * 0.5);
    if (!detail) {
      // de muito longe: só a silhueta dos banzos
      trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, 0, 0);
      if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = w + ol * 2; g.stroke(); }
      g.strokeStyle = col; g.lineWidth = w; g.stroke();
      return;
    }
    // 1) contornos
    if (ol > 0) {
      g.strokeStyle = LINE_CSS;
      trussWeb(g, ax, ay, dx, dy, nx, ny, d0, d1, N, cross, verts);
      g.lineWidth = ww + ol * 2; g.stroke();
      trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, 0, 0);
      g.lineWidth = w + ol * 2; g.stroke();
    }
    // 2) alma (mais escura, fica "atrás")
    trussWeb(g, ax, ay, dx, dy, nx, ny, d0, d1, N, cross, verts);
    g.strokeStyle = webCol; g.lineWidth = ww; g.stroke();
    // 3) banzos
    trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, 0, 0);
    g.strokeStyle = col; g.lineWidth = w; g.stroke();
    // 4) luz no banzo de cima, sombra no de baixo
    if (o.hi !== false && big(w * 0.4)) {
      g.lineWidth = w * 0.28;
      trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, w * 0.24, null);
      g.strokeStyle = hiOf(col); g.stroke();
      trussChords(g, ax, ay, dx, dy, nx, ny, d0, d1, null, w * 0.24);
      g.strokeStyle = loOf(col); g.stroke();
    }
    // 5) chapas de nó (parafusos)
    if (o.joints !== false && big(w * 0.35) && w >= 2.5) {
      const jr = w * 0.2;
      g.fillStyle = loOf(col, 0.5);
      g.beginPath();
      for (let k = 0; k <= N; k++) {
        const q = k / N, hh = d0 + (d1 - d0) * q, cx = ax + dx * q, cy = ay + dy * q;
        g.moveTo(cx + nx * hh + jr, cy + ny * hh); g.arc(cx + nx * hh, cy + ny * hh, jr, 0, TAU);
        g.moveTo(cx - nx * hh + jr, cy - ny * hh); g.arc(cx - nx * hh, cy - ny * hh, jr, 0, TAU);
      }
      g.fill();
    }
  };

  const latA = [0, 0], latB = [0, 0];
  const latO = { taper: 1, cross: true, verticals: true, bays: 0, ol: undefined, hi: undefined, joints: undefined, web: undefined };

  // Draw.lattice(g, x, y, w, h, cell, lw, col, {ol, cross=true, joints, web}): torre treliçada retangular (canto de cima/esquerda em x,y)
  //   com X em cada célula de ~'cell' de altura; se w > h a torre deita (células ao longo da largura)
  Draw.lattice = function (g, x, y, w, h, cell, lw, col, o) {
    o = o || NO;
    const vertical = h >= w, len = vertical ? h : w, dep = (vertical ? w : h) - lw;
    if (vertical) { latA[0] = x + w / 2; latA[1] = y + h; latB[0] = x + w / 2; latB[1] = y; }
    else { latA[0] = x; latA[1] = y + h / 2; latB[0] = x + w; latB[1] = y + h / 2; }
    latO.bays = Math.max(1, Math.round(len / Math.max(1, cell || dep)));
    latO.cross = o.cross !== false; latO.verticals = true;
    latO.ol = o.ol; latO.hi = o.hi; latO.joints = o.joints; latO.web = o.web;
    Draw.truss(g, latA, latB, Math.max(0, dep), lw, col, latO);
  };

  /* ---------- rodas, esteiras, pistões ---------- */
  // Draw.wheel(g, x, y, r, rot, {tire, hub, spokes=6, tread=true, ol}): pneu fora-de-estrada (r inclui as garras) com aro e parafusos
  Draw.wheel = function (g, x, y, r, rot, o) {
    o = o || NO;
    const tire = o.tire ? col2(o.tire) : PAL.blk, hub = o.hub ? col2(o.hub) : PAL.yel;
    const ol = olOf(o), spokes = o.spokes !== undefined ? o.spokes : 6;
    const tread = o.tread !== false && big(r * 0.2);
    const rb = tread ? r * 0.9 : r;   // raio do corpo do pneu
    g.save();
    g.translate(x, y);
    if (!big(r * 0.5)) { // longe demais: bolinha
      g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, r + ol, 0, TAU); g.fill();
      g.fillStyle = tire; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      g.fillStyle = hub; g.beginPath(); g.arc(0, 0, r * 0.45, 0, TAU); g.fill();
      g.restore(); return;
    }
    // garras (giram)
    if (tread) {
      const n = Math.max(8, Math.min(26, Math.round(r * 0.55))), step = TAU / n;
      const lw2 = r * Math.sin(step / 2) * 0.62, l0 = r * 0.78, ll = r - l0;
      g.rotate(rot);
      if (ol > 0) {
        g.fillStyle = LINE_CSS;
        for (let i = 0; i < n; i++) { g.fillRect(l0, -lw2 - ol, ll + ol, (lw2 + ol) * 2); g.rotate(step); }
        g.beginPath(); g.arc(0, 0, rb + ol, 0, TAU); g.fill();
      }
      g.fillStyle = hiOf(tire, 0.12);
      for (let i = 0; i < n; i++) { g.fillRect(l0, -lw2, ll, lw2 * 2); g.rotate(step); }
      g.rotate(-rot);
    } else if (ol > 0) { g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, rb + ol, 0, TAU); g.fill(); }
    // corpo do pneu: sombra embaixo, base, flanco mais claro
    g.fillStyle = loOf(tire, 0.3); g.beginPath(); g.arc(0, 0, rb, 0, TAU); g.fill();
    g.fillStyle = tire; g.beginPath(); g.arc(-r * 0.03, -r * 0.05, rb * 0.95, 0, TAU); g.fill();
    g.strokeStyle = hiOf(tire, 0.16); g.lineWidth = r * 0.07; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, r * 0.74, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    // aro
    const rr = r * 0.52;
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, rr + ol * 0.75, 0, TAU); g.fill();
    g.fillStyle = loOf(hub, 0.26); g.beginPath(); g.arc(0, 0, rr, 0, TAU); g.fill();
    g.fillStyle = hub; g.beginPath(); g.arc(-r * 0.025, -r * 0.035, rr * 0.9, 0, TAU); g.fill();
    g.fillStyle = loOf(hub, 0.2); g.beginPath(); g.arc(0, 0, rr * 0.66, 0, TAU); g.fill();
    // parafusos e cubo (giram)
    g.rotate(rot);
    if (spokes > 0 && big(r * 0.12)) {
      const br = Math.max(r * 0.05, 0.6), bd = rr * 0.5;
      g.fillStyle = LINE_CSS;
      g.beginPath();
      for (let i = 0; i < spokes; i++) { const a = i / spokes * TAU; g.moveTo(Math.cos(a) * bd + br, Math.sin(a) * bd); g.arc(Math.cos(a) * bd, Math.sin(a) * bd, br, 0, TAU); }
      g.fill();
      // raios finos entre o cubo e o aro
      g.strokeStyle = loOf(hub, 0.34); g.lineWidth = Math.max(0.6, r * 0.035);
      g.beginPath();
      for (let i = 0; i < spokes; i++) { const a = (i + 0.5) / spokes * TAU; g.moveTo(Math.cos(a) * rr * 0.3, Math.sin(a) * rr * 0.3); g.lineTo(Math.cos(a) * rr * 0.64, Math.sin(a) * rr * 0.64); }
      g.stroke();
    }
    g.rotate(-rot);
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, rr * 0.3 + ol * 0.5, 0, TAU); g.fill();
    g.fillStyle = hiOf(hub, 0.3); g.beginPath(); g.arc(0, 0, rr * 0.3, 0, TAU); g.fill();
    g.fillStyle = loOf(hub, 0.3); g.beginPath(); g.arc(0, 0, rr * 0.11, 0, TAU); g.fill();
    // brilho fixo no aro
    g.strokeStyle = hiOf(hub, 0.5); g.lineWidth = r * 0.05; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, rr * 0.8, Math.PI * 1.12, Math.PI * 1.45); g.stroke();
    g.restore();
  };

  function stadium(g, cx0, cx1, cy, R) {
    g.beginPath();
    g.moveTo(cx0, cy - R); g.lineTo(cx1, cy - R);
    g.arc(cx1, cy, R, -Math.PI / 2, Math.PI / 2);
    g.lineTo(cx0, cy + R);
    g.arc(cx0, cy, R, Math.PI / 2, Math.PI * 1.5);
    g.closePath();
  }
  // rodinha de esteira com marca que gira
  function bogie(g, x, y, r, ang, col, ol, teeth) {
    if (teeth && big(r * 0.25)) {
      const n = teeth, tw = r * 0.2;
      g.save(); g.translate(x, y); g.rotate(ang);
      g.fillStyle = LINE_CSS;
      for (let i = 0; i < n; i++) { g.fillRect(r * 0.8, -tw, r * 0.36, tw * 2); g.rotate(TAU / n); }
      g.restore();
    }
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(x, y, r + ol * 0.6, 0, TAU); g.fill();
    g.fillStyle = loOf(col, 0.25); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x - r * 0.07, y - r * 0.1, r * 0.86, 0, TAU); g.fill();
    if (big(r * 0.4)) {
      const c = Math.cos(ang), s = Math.sin(ang), br = Math.max(0.5, r * 0.13), d = r * 0.52;
      g.fillStyle = LINE_CSS;
      g.beginPath();
      g.moveTo(x + c * d + br, y + s * d); g.arc(x + c * d, y + s * d, br, 0, TAU);
      g.moveTo(x - c * d + br, y - s * d); g.arc(x - c * d, y - s * d, br, 0, TAU);
      g.moveTo(x - s * d + br, y + c * d); g.arc(x - s * d, y + c * d, br, 0, TAU);
      g.moveTo(x + s * d + br, y - c * d); g.arc(x + s * d, y - c * d, br, 0, TAU);
      g.fill();
      g.fillStyle = hiOf(col, 0.4); g.beginPath(); g.arc(x, y, r * 0.3, 0, TAU); g.fill();
    }
  }
  // caminho com os riscos das sapatas ao redor do "estádio", do raio r0 ao r1
  function shoesPath(g, cx0, cx1, cy, R, r0, r1, phase, n) {
    const Ls = cx1 - cx0, arc = Math.PI * R, per = 2 * Ls + 2 * arc, sp = per / n;
    let s0 = phase % sp; if (s0 < 0) s0 += sp;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const s = s0 + k * sp;
      let px, py, nx, ny;
      if (s < Ls) { px = cx0 + s; py = cy; nx = 0; ny = -1; }
      else if (s < Ls + arc) { const a = -Math.PI / 2 + (s - Ls) / R; px = cx1; py = cy; nx = Math.cos(a); ny = Math.sin(a); }
      else if (s < 2 * Ls + arc) { px = cx1 - (s - Ls - arc); py = cy; nx = 0; ny = 1; }
      else { const a = Math.PI / 2 + (s - 2 * Ls - arc) / R; px = cx0; py = cy; nx = Math.cos(a); ny = Math.sin(a); }
      g.moveTo(px + nx * r0, py + ny * r0); g.lineTo(px + nx * r1, py + ny * r1);
    }
  }

  // Draw.track(g, x, y, w, h, phase, {col, wheels, belt, frame=true, ol}): esteira de trator dentro do retângulo (x,y,w,h);
  //   phase = distância rodada em unidades de mundo (as sapatas e as rodas andam com ela);
  //   col = cor do chassi/rodas, wheels = nº de roletes de apoio, belt = cor da esteira
  Draw.track = function (g, x, y, w, h, phase, o) {
    o = o || NO;
    const belt = o.belt ? col2(o.belt) : PAL.blk, col = o.col ? col2(o.col) : PAL.grayD, ol = olOf(o);
    if (w < h) w = h;
    const gh = h * 0.07, bt = h * 0.12, R = h / 2 - gh;
    const cx0 = x + h / 2, cx1 = x + w - h / 2, cy = y + h / 2, Ls = cx1 - cx0;
    phase = phase || 0;
    if (!big(h * 0.35)) { // longe: só a silhueta
      g.fillStyle = LINE_CSS; stadium(g, cx0, cx1, cy, h / 2 + ol); g.fill();
      g.fillStyle = belt; stadium(g, cx0, cx1, cy, h / 2); g.fill();
      g.fillStyle = loOf(belt, 0.4); stadium(g, cx0, cx1, cy, h / 2 - bt - gh); g.fill();
      return;
    }
    const per = 2 * Ls + TAU * R;
    const n = Math.max(8, Math.round(per / (h * 0.24))), shoeW = per / n * 0.46;
    g.lineCap = 'butt';
    // 1) contornos: garras + cinta
    if (ol > 0) {
      g.strokeStyle = LINE_CSS; g.lineWidth = shoeW + ol * 2;
      shoesPath(g, cx0, cx1, cy, R, R - 1, R + gh + ol, phase, n); g.stroke();
      g.fillStyle = LINE_CSS; stadium(g, cx0, cx1, cy, R + ol); g.fill();
    }
    // 2) cinta
    g.fillStyle = belt; stadium(g, cx0, cx1, cy, R); g.fill();
    // 3) sapatas (placas mais claras que andam) com fresta escura entre elas
    g.strokeStyle = hiOf(belt, 0.2); g.lineWidth = shoeW;
    shoesPath(g, cx0, cx1, cy, R, R - bt, R + gh, phase, n); g.stroke();
    g.strokeStyle = hiOf(belt, 0.36); g.lineWidth = shoeW * 0.3;
    shoesPath(g, cx0, cx1, cy, R, R + gh * 0.1, R + gh, phase + shoeW * 0.25, n); g.stroke();
    // 4) miolo escuro
    const Ri = R - bt;
    g.fillStyle = LINE_CSS; stadium(g, cx0, cx1, cy, Ri + ol * 0.5); g.fill();
    g.fillStyle = loOf(belt, 0.45); stadium(g, cx0, cx1, cy, Ri); g.fill();
    // 5) rodas
    const rBig = Math.max(0.05, Ri - Math.max(0.5, h * 0.02)), rw = Math.min(h * 0.17, Ri * 0.5), rt = h * 0.075;
    const steel = PAL.steelD;
    // roletes de retorno (em cima)
    const nTop = Math.max(0, Math.round(Ls / (h * 1.3)));
    for (let i = 0; i < nTop; i++) {
      const tx = cx0 + Ls * (i + 1) / (nTop + 1);
      bogie(g, tx, cy - Ri + rt, rt, phase / rt, steel, ol, 0);
    }
    // roletes de apoio (embaixo)
    const x0r = cx0 + rBig * 0.55, x1r = cx1 - rBig * 0.55;
    const nB = o.wheels !== undefined ? o.wheels : Math.max(0, Math.floor((x1r - x0r) / (rw * 2.25)) + 1);
    // 6) chassi entre as rodas
    if (o.frame !== false && Ls > h * 0.2) {
      const fh = h * 0.24, fy = cy - fh * 0.35;
      g.fillStyle = LINE_CSS; g.fillRect(cx0 - ol * 0.6, fy - ol * 0.6, Ls + ol * 1.2, fh + ol * 1.2);
      g.fillStyle = col; g.fillRect(cx0, fy, Ls, fh);
      g.fillStyle = hiOf(col, 0.28); g.fillRect(cx0, fy, Ls, fh * 0.26);
      g.fillStyle = loOf(col, 0.24); g.fillRect(cx0, fy + fh * 0.78, Ls, fh * 0.22);
    }
    for (let i = 0; i < nB; i++) {
      const bx = nB === 1 ? (x0r + x1r) / 2 : x0r + (x1r - x0r) * i / (nB - 1);
      bogie(g, bx, cy + Ri - rw, rw, phase / rw, steel, ol, 0);
    }
    // roda motriz (direita, com dentes) e roda guia (esquerda)
    bogie(g, cx1, cy, rBig, phase / R, col, ol, 9);
    bogie(g, cx0, cy, rBig, phase / R, col, ol, 0);
  };

  // Draw.piston(g, a, b, w, {col, rod, len, max, ol}): cilindro hidráulico de a=[x,y] até b; a camisa (largura w) fica presa em a,
  //   a haste cromada sai dela até b. len = comprimento fixo da camisa (padrão 55% de 'max' ou 60% da distância atual)
  Draw.piston = function (g, a, b, w, o) {
    o = o || NO;
    const col = o.col ? col2(o.col) : PAL.yel, rod = o.rod ? col2(o.rod) : PAL.steelL, ol = olOf(o);
    const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    const len = Math.min(o.len || (o.max ? o.max * 0.55 : d * 0.6), d + w), rw = w * 0.42, hw = w / 2;
    let ang = Math.atan2(dy, dx), flip = 1;
    if (Math.cos(ang) < 0) flip = -1; // mantém a luz do lado de cima quando o cilindro aponta pra esquerda
    g.save();
    g.translate(a[0], a[1]); g.rotate(ang);
    if (flip < 0) g.scale(1, -1);
    // haste
    const r0 = Math.min(len * 0.5, d);
    if (d > r0) {
      g.fillStyle = LINE_CSS; g.fillRect(r0, -rw / 2 - ol, d - r0, rw + ol * 2);
      g.fillStyle = rod; g.fillRect(r0, -rw / 2, d - r0, rw);
      g.fillStyle = '#FFFFFF'; g.fillRect(r0, -rw * 0.32, d - r0, rw * 0.22);
      g.fillStyle = PAL.steelD; g.fillRect(r0, rw * 0.2, d - r0, rw * 0.3);
    }
    // olhal da haste
    const er = w * 0.42;
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(d, 0, er + ol, 0, TAU); g.fill();
    g.fillStyle = PAL.steelD; g.beginPath(); g.arc(d, 0, er, 0, TAU); g.fill();
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(d, 0, er * 0.38, 0, TAU); g.fill();
    // olhal da base
    const br = w * 0.56;
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, br + ol, 0, TAU); g.fill();
    g.fillStyle = loOf(col, 0.3); g.beginPath(); g.arc(0, 0, br, 0, TAU); g.fill();
    // camisa
    const b0 = w * 0.2;
    g.fillStyle = LINE_CSS; g.fillRect(b0 - ol, -hw - ol, len - b0 + ol * 2, w + ol * 2);
    g.fillStyle = col; g.fillRect(b0, -hw, len - b0, w);
    g.fillStyle = hiOf(col); g.fillRect(b0, -hw, len - b0, w * 0.24);
    g.fillStyle = loOf(col); g.fillRect(b0, hw - w * 0.24, len - b0, w * 0.24);
    // tampa (gaxeta) e anel traseiro
    const cw = Math.max(1.5, w * 0.3);
    g.fillStyle = LINE_CSS; g.fillRect(len - cw - ol * 0.5, -hw * 1.16 - ol, cw + ol, w * 1.16 + ol * 2);
    g.fillStyle = loOf(col, 0.34); g.fillRect(len - cw, -hw * 1.16, cw, w * 1.16);
    g.fillStyle = col; g.fillRect(len - cw, -hw * 1.16, cw, w * 0.3);
    if (big(w * 0.3)) { g.fillStyle = loOf(col, 0.3); g.fillRect(b0 + w * 0.5, -hw, Math.max(1, w * 0.14), w); }
    // pino da base
    g.fillStyle = LINE_CSS; g.beginPath(); g.arc(0, 0, br * 0.36, 0, TAU); g.fill();
    g.restore();
  };

  /* ---------- luzes ---------- */
  const haloCache = new Map();
  function halo(col) {
    let cv = haloCache.get(col);
    if (!cv) {
      cv = document.createElement('canvas'); cv.width = cv.height = 96;
      const c = cv.getContext('2d'), gr = c.createRadialGradient(48, 48, 2, 48, 48, 48);
      gr.addColorStop(0, U.rgba(col, 0.75)); gr.addColorStop(0.3, U.rgba(col, 0.36));
      gr.addColorStop(0.65, U.rgba(col, 0.1)); gr.addColorStop(1, U.rgba(col, 0));
      c.fillStyle = gr; c.fillRect(0, 0, 96, 96);
      if (haloCache.size >= 48) haloCache.clear();   // cor de luz animada (mixCss por frame) não pode vazar canvases
      haloCache.set(col, cv);
    }
    return cv;
  }

  // Draw.light(g, x, y, r, col, on, {ol, halo=4.5, add=false}): lâmpada de raio r; on = bool ou 0..1 (acesa tem halo suave)
  Draw.light = function (g, x, y, r, col, on, o) {
    o = o || NO; col = col2(col || PAL.red);
    const k = on === true ? 1 : on ? U.clamp(+on, 0, 1) : 0, ol = olOf(o);
    if (k > 0) {
      const hr = r * (o.halo || 4.5), pa = g.globalAlpha;
      g.globalAlpha = pa * k;
      if (o.add) g.globalCompositeOperation = 'lighter';
      g.drawImage(halo(col), x - hr, y - hr, hr * 2, hr * 2);
      if (o.add) g.globalCompositeOperation = 'source-over';
      g.globalAlpha = pa;
    }
    if (ol > 0) { g.fillStyle = LINE_CSS; g.beginPath(); g.arc(x, y, r + ol, 0, TAU); g.fill(); }
    if (k > 0) {
      g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = hiOf(col, 0.55 * k); g.beginPath(); g.arc(x, y, r * 0.66, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.28, r * 0.28, 0, TAU); g.fill();
    } else {
      g.fillStyle = loOf(col, 0.62); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.fillStyle = loOf(col, 0.42); g.beginPath(); g.arc(x - r * 0.12, y - r * 0.15, r * 0.62, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - r * 0.28, y - r * 0.3, r * 0.2, 0, TAU); g.fill();
    }
  };

  /* ---------- passarelas ---------- */
  const railA = [0, 0], railB = [0, 0];
  const railO = { posts: 0, h: 6, col: undefined, lw: undefined, ol: undefined };

  // Draw.rail(g, a, b, {posts=6, h=6, col, lw=1.2, mid=true, ol}): guarda-corpo sobre a linha a->b (corrimão a 'h' de altura, montantes verticais)
  Draw.rail = function (g, a, b, o) {
    o = o || NO;
    const col = o.col ? col2(o.col) : PAL.yel, hh = o.h !== undefined ? o.h : 6, lw = o.lw || 1.2;
    const posts = Math.max(2, o.posts !== undefined ? o.posts : 6);
    const olv = o.ol !== undefined ? o.ol : Math.min(Draw.OL, lw), m = Draw.minPx / Draw.zoom, ol = olv > 0 ? Math.max(olv, m) : 0;
    const detail = big(hh * 0.35);
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(a[0], a[1] - hh); g.lineTo(b[0], b[1] - hh);
    if (detail) {
      if (o.mid !== false) { g.moveTo(a[0], a[1] - hh * 0.5); g.lineTo(b[0], b[1] - hh * 0.5); }
      for (let i = 0; i < posts; i++) {
        const q = i / (posts - 1), px = a[0] + (b[0] - a[0]) * q, py = a[1] + (b[1] - a[1]) * q;
        g.moveTo(px, py); g.lineTo(px, py - hh);
      }
    }
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = lw + ol * 2; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  };

  // Draw.stairs(g, a, b, steps, {col, lw=2, rail=true, railH=7, railCol, stringer=true, ol}): escada em degraus entre a e b (qualquer ordem)
  Draw.stairs = function (g, a, b, steps, o) {
    o = o || NO;
    const col = o.col ? col2(o.col) : PAL.steel, lw = o.lw || 2, ol = olOf(o);
    let lo = a, hi = b;
    if (b[1] > a[1]) { lo = b; hi = a; }            // lo = ponta de baixo (y maior)
    const n = Math.max(1, steps | 0), sx = (hi[0] - lo[0]) / n, sy = (hi[1] - lo[1]) / n; // sy <= 0
    g.lineCap = 'round'; g.lineJoin = 'round';
    // longarina (viga inclinada por baixo dos degraus)
    if (o.stringer !== false) {
      const off = Math.max(lw, Math.abs(sy) * 0.55);
      g.beginPath(); g.moveTo(lo[0] + sx * 0.3, lo[1] + off * 0.3); g.lineTo(hi[0] - sx * 0.2, hi[1] + off);
      if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = lw * 1.3 + ol * 2; g.stroke(); }
      g.strokeStyle = loOf(col, 0.3); g.lineWidth = lw * 1.3; g.stroke();
    }
    // degraus (espelho + piso)
    if (big(Math.abs(sy) * 0.6 + Math.abs(sx) * 0.3)) {
      g.beginPath(); g.moveTo(lo[0], lo[1]);
      for (let i = 0; i < n; i++) {
        const x0 = lo[0] + sx * i, y1 = lo[1] + sy * (i + 1);
        g.lineTo(x0, y1); g.lineTo(x0 + sx, y1);
      }
    } else { g.beginPath(); g.moveTo(lo[0], lo[1]); g.lineTo(hi[0], hi[1]); }
    if (ol > 0) { g.strokeStyle = LINE_CSS; g.lineWidth = lw + ol * 2; g.stroke(); }
    g.strokeStyle = col; g.lineWidth = lw; g.stroke();
    // corrimão
    if (o.rail !== false) {
      railA[0] = lo[0] + sx * 0.5; railA[1] = lo[1] + sy;
      railB[0] = hi[0] - sx * 0.5; railB[1] = hi[1];
      railO.posts = Math.max(2, Math.min(n, Math.ceil(n / 2) + 1)); railO.h = o.railH || 7;
      railO.col = o.railCol; railO.lw = Math.max(1, lw * 0.6); railO.ol = o.ol;
      Draw.rail(g, railA, railB, railO);
    }
  };

  /* ---------- texto e placas ---------- */
  const fontCache = new Map();
  function fontOf(size, weight, family) {
    if (family && family !== Draw.FONT) return weight + ' ' + size + 'px ' + family;
    const k = size * 1000 + weight;
    let f = fontCache.get(k);
    if (!f) {
      f = weight + ' ' + size + 'px ' + Draw.FONT;
      if (fontCache.size >= 300) fontCache.clear();  // tamanho animado (texto que "pula") gera muitas chaves
      fontCache.set(k, f);
    }
    return f;
  }

  // Draw.text(g, txt, x, y, {size=16, col='#FFFAEE', stroke=LINE_CSS, sw=4, align='center', font, weight=900, rot, baseline='middle', shadow=0, alpha})
  //   texto de jogo com traço grosso arredondado; shadow = deslocamento (px) de uma sombra dura embaixo
  Draw.text = function (g, txt, x, y, o) {
    o = o || NO;
    const size = o.size || 16, sw = o.sw !== undefined ? o.sw : 4, stroke = o.stroke !== undefined ? o.stroke : LINE_CSS;
    const rot = o.rot || 0, pa = g.globalAlpha;
    g.font = fontOf(size, o.weight || 900, o.font);
    g.textAlign = o.align || 'center'; g.textBaseline = o.baseline || 'middle';
    g.lineJoin = 'round'; g.lineCap = 'round'; g.miterLimit = 2;
    if (o.alpha !== undefined) g.globalAlpha = pa * o.alpha;
    if (rot) { g.save(); g.translate(x, y); g.rotate(rot); x = 0; y = 0; }
    if (stroke && sw > 0) {
      g.strokeStyle = stroke; g.lineWidth = sw;
      if (o.shadow) g.strokeText(txt, x, y + o.shadow);
      g.strokeText(txt, x, y);
    }
    g.fillStyle = o.col ? col2(o.col) : '#FFFAEE';
    g.fillText(txt, x, y);
    if (rot) g.restore();
    if (o.alpha !== undefined) g.globalAlpha = pa;
  };

  const fitCache = new Map();
  // tamanho de fonte (cacheado) pra um texto caber em maxW x maxH
  function fitSize(g, txt, maxW, maxH, weight, family) {
    const k = txt + '|' + Math.round(maxW * 4) + '|' + Math.round(maxH * 4) + '|' + weight + '|' + (family || '');
    let s = fitCache.get(k);
    if (s === undefined) {
      g.font = fontOf(100, weight, family);
      const tw = g.measureText(txt).width || 1;
      s = Math.max(1, Math.min(maxH, maxW / tw * 100));
      if (fitCache.size > 500) fitCache.clear();
      fitCache.set(k, s);
    }
    return s;
  }

  // Draw.sign(g, x, y, w, h, texto, {col, ink, r, border=true, weight=900, font, ol, rivets=false}): placa com moldura e texto que se ajusta sozinho
  Draw.sign = function (g, x, y, w, h, texto, o) {
    o = o || NO;
    const col = o.col ? col2(o.col) : PAL.cream, ink = o.ink ? col2(o.ink) : PAL.ink, ol = olOf(o);
    const r = o.r !== undefined ? o.r : Math.min(h * 0.18, 3);
    g.fillStyle = LINE_CSS; rrPath(g, x - ol, y - ol, w + ol * 2, h + ol * 2, r + ol); g.fill();
    g.fillStyle = loOf(col, 0.2); rrPath(g, x, y, w, h, r); g.fill();
    g.fillStyle = col; rrPath(g, x, y, w, h - Math.min(h * 0.12, 3), r); g.fill();
    const pad = Math.max(1, Math.min(h * 0.12, 3));
    if (o.border !== false && big(pad) && w > pad * 4 && h > pad * 4) {
      g.strokeStyle = ink; g.lineWidth = Math.max(0.5, pad * 0.35);
      rrPath(g, x + pad, y + pad, w - pad * 2, h - pad * 2.6, Math.max(0, r - pad * 0.5)); g.stroke();
    }
    if (o.rivets && big(pad)) {
      g.fillStyle = ink; const rr = pad * 0.4, e = pad * 2.1;
      g.beginPath();
      g.arc(x + e, y + e, rr, 0, TAU); g.moveTo(x + w - e + rr, y + e); g.arc(x + w - e, y + e, rr, 0, TAU);
      g.moveTo(x + e + rr, y + h - e * 1.2); g.arc(x + e, y + h - e * 1.2, rr, 0, TAU);
      g.moveTo(x + w - e + rr, y + h - e * 1.2); g.arc(x + w - e, y + h - e * 1.2, rr, 0, TAU);
      g.fill();
    }
    if (texto && big(h * 0.4)) {
      const weight = o.weight || 900, size = fitSize(g, texto, w - pad * 5, (h - pad * 3) * 0.78, weight, o.font);
      g.font = fontOf(size, weight, o.font);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = ink;
      g.fillText(texto, x + w / 2, y + (h - pad) / 2 + size * 0.04);
    }
  };

  /* ---------- texturas e sombra ---------- */
  const patCache = new Map();
  function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // Draw.pattern(g, nome, base, c2, c3, {size=48, n=170, shape='grain'|'dots'|'hatch'}) -> CanvasPattern cacheado (lado a lado sem emenda)
  //   'grain' = grãozinhos de arroz (c2 sombra, c3 luz); ladrilha perfeitamente; cache pelo nome
  Draw.pattern = function (g, name, base, c2, c3, o) {
    let p = patCache.get(name);
    if (p) return p;
    o = o || NO;
    const size = o.size || 48, n = o.n !== undefined ? o.n : 170, shape = o.shape || 'grain';
    const cv = document.createElement('canvas'); cv.width = cv.height = size;
    const c = cv.getContext('2d'), r = E.RNG(strHash(name));
    c.fillStyle = col2(base); c.fillRect(0, 0, size, size);
    const A = col2(c2 || loOf(base, 0.14)), B = col2(c3 || hiOf(base, 0.5));
    if (shape === 'hatch') {
      c.lineCap = 'round'; c.lineWidth = 1.4;
      const st = Math.max(4, Math.round(size / Math.max(1, Math.round(Math.sqrt(n)))));
      for (let i = -size; i < size * 2; i += st) {
        c.strokeStyle = (Math.round(i / st) & 1) ? A : B;
        c.beginPath(); c.moveTo(i, size); c.lineTo(i + size, 0); c.stroke();
      }
    } else {
      for (let i = 0; i < n; i++) {
        const x = r() * size, y = r() * size, a = r() * Math.PI, k = r();
        c.fillStyle = k < 0.55 ? A : B;
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { // repete nas bordas pra ladrilhar
          const X = x + ox * size, Y = y + oy * size;
          if (X < -6 || Y < -6 || X > size + 6 || Y > size + 6) continue;
          c.beginPath();
          if (shape === 'dots') c.arc(X, Y, 0.8 + k * 1.1, 0, TAU);
          else c.ellipse(X, Y, 2.3 + k * 0.9, 1.15, a, 0, TAU);
          c.fill();
        }
      }
    }
    p = g.createPattern(cv, 'repeat');
    p.canvas = cv;
    patCache.set(name, p);
    return p;
  };
  // Draw.pattern.clear(nome?): esvazia o cache de texturas
  Draw.pattern.clear = function (name) { if (name === undefined) patCache.clear(); else patCache.delete(name); };

  // Draw.shadow(g, x, y, rx, ry, alpha=.18): sombra elíptica no chão
  Draw.shadow = function (g, x, y, rx, ry, alpha) {
    g.fillStyle = alpha === undefined ? 'rgba(40,20,8,.18)' : 'rgba(40,20,8,' + alpha + ')';
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fill();
  };

  // Draw.rrect(g, x, y, w, h, r): só monta o caminho de um retângulo arredondado (pra fill/stroke/clip por conta própria)
  Draw.rrect = rrPath;

  /* ======================================================================
     6. Exporta
     ====================================================================== */
  E.LINE = LINE;
  E.LINE_CSS = LINE_CSS;
  E.PAL = PAL;
  E.Pix = Pix;
  E.sprite = sprite;
  E.drawSprite = drawSprite;
  E.Draw = Draw;
})();
