/* Kome no Japão — evolucoes.js
   EVOLUÇÕES (o tempero do Vampire Survivors): passo 4 de docs/design/jogo-infinito.md. Máquina no nível D.ENDGAME.evo.lvl (25)
   da Oficina + o amuleto certo ativo NAQUELA ilha = evolui numa versão absurda, com desenho próprio e uma cena curta. Enquanto
   evoluída, aquela máquina rende ×D.ENDGAME.evo.mult (3) quando você está com ela. A viagem zera Oficina e amuletos, então a
   evolução é da ilha; a DESCOBERTA é permanente (Caderno, com "?" até achar).
   FICHAS: conteudo/evolucao-<id>.js (tipo 'evolucao': nome, maquina = id do G.Tools, amuleto = id da ficha de amuleto, texto,
   visual, fala) → D.EVOLUCOES (tools/content.js). Começa com 6:
     Pá + Pata de Ouro → Pá Lendária (ouro) · Trator + Frota Feliz → Trator Comboio (carretas) · Escavadeira + Gêmeos →
     Escavadeira de Dois Braços (bracos) · Bagger + Núcleo Vivo → Bagger Dourada (dourada) · Caminhão + Esteira Expressa →
     Caminhão Foguete (foguete) · Colheitadeira + Chef → Colheitadeira Gourmet (chef)
   DESENHO: não redesenha a máquina. Embrulha G.Tools[id].draw: liga m.evo (a ferramenta pode ler, ex.: a lâmina de ouro da Pá
   em tools-hand.js) e desenha por cima/por trás as peças extras de VIS[visual] (carretas, 2º braço, foguetes, chapéu de chef,
   tinta dourada por canvas filter + brilhos). Qualquer lugar que desenha a máquina (jogo, Pátio, Oficina, gêmea) sai evoluído.
   GANCHOS: game.js computeStats → applyStats (×3 na máquina em uso) · goals.js Caderno → caderno(col) · tools-hand.js shovelGold.
   Estado (save): S.stats.evo = {disc: {id: 1}, seen: {id: viagem+1}} (seen = a cena já tocou nesta ilha). MIGR[7] no game.js.
   MODO ACELERADO (FAST): a cena nunca abre (descobre na hora). Demo: index.html?dev&evo=<id> (toca a cena daquela evolução). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const D = G.Data, EG = D.ENDGAME, PAL = E.PAL, Draw = E.Draw, INK = '#3B2818';
  const CFG = EG.evo = Object.assign({ lvl: 25, mult: 3 }, EG.evo || {});   // mover pro data.js junto do resto do balanço
  const DEMO = (() => { const m = /[?&]evo=([a-z_]+)/.exec(location.search || ''); return m && /[?&]dev\b/.test(location.search) ? m[1] : null; })();

  let api = null, active = {}, wrapped = false, chkT = 0, waitT = 2, queue = [];
  const S = () => G.S;
  const list = () => D.EVOLUCOES || [];
  const byId = id => list().find(e => e.id === id) || null;
  const toolName = id => { const t = D.TOOLS.find(x => x.id === id); return t ? t.name : id; };
  const amName = id => { const a = G.Amuletos && G.Amuletos.byId(id); return a ? a.n : id; };
  const est = () => { const s = S().stats; let v = s.evo; if (!v || typeof v !== 'object') v = s.evo = { disc: {}, seen: {} }; if (!v.disc) v.disc = {}; if (!v.seen) v.seen = {}; return v; };
  const tripKey = () => (S().stats.islandsDone | 0) + 1;
  const fast = () => !!(api && api.fast && api.fast());

  // condição: Oficina ≥ lvl naquela máquina + amuleto na build da ilha (amuletos só valem nas ilhas da volta)
  function ready(e) {
    const s = S(); if (!s || !G.Amuletos || !G.Amuletos.run()) return false;
    const lv = (s.stats.lv || {})[e.tool] | 0, a = s.stats.am;
    return lv >= CFG.lvl && !!a && Array.isArray(a.cur) && a.cur.indexOf(e.am) >= 0 && (s.tool | 0) >= (D.toolIndex ? D.toolIndex[e.tool] | 0 : 0);
  }
  function refresh() {
    const nx = {}; let ch = false;
    for (const e of list()) if (ready(e)) nx[e.tool] = e;
    for (const k in nx) if (active[k] !== nx[k]) ch = true;
    for (const k in active) if (!nx[k]) ch = true;
    active = nx;
    return ch;
  }
  const on = id => active[id] || null;

  // computeStats: a máquina evoluída em uso rende ×mult
  function applyStats(s, tool) { if (tool && active[tool.id]) s.sell *= CFG.mult; }

  /* ---- desenho: peças extras por cima/por trás da máquina original ---- */
  const sparkle = (g, x, y, r, t, a) => {
    g.save(); g.translate(x, y); g.rotate(t * 2); g.globalAlpha = a; g.fillStyle = PAL.goldL;
    g.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.3 : r, an = i / 8 * Math.PI * 2; g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } g.closePath(); g.fill();
    g.restore();
  };
  const sparks = (g, cx, cy, R, t, n, sz) => { for (let i = 0; i < n; i++) { const ph = (t * 0.7 + i / n) % 1, an = i * 2.39996 + t * 0.5; sparkle(g, cx + Math.cos(an) * R * (0.4 + ph * 0.6), cy + Math.sin(an) * R * 0.6 * (0.4 + ph * 0.6) - ph * R * 0.3, sz * (1 - ph * 0.5), t + i, Math.sin(ph * Math.PI)); } };
  let FILTER_OK = null;
  function goldFilter(g, on) {
    if (FILTER_OK === false) return false;
    try { g.filter = on ? 'sepia(1) saturate(3.2) hue-rotate(-12deg) brightness(1.12)' : 'none'; if (FILTER_OK === null) FILTER_OK = 'filter' in g; return FILTER_OK; } catch (e) { FILTER_OK = false; return false; }
  }
  const faceOf = m => (m.turn !== undefined ? (m.turn >= 0 ? 1 : -1) : m.face < 0 ? -1 : 1);
  const floorAt = (m, x) => (m.floorF ? m.floorF(x) : m.y);
  const VIS = {
    // Pá Lendária: lâmina de ouro e maior (tools-hand.js lê m.evo) + brilho onde ela morde
    ouro(g, m, draw) {
      draw();
      const b = m.biteO, t = m.t || 0; if (!b) return;
      const sc = m.sc || 1; sparks(g, b.x, b.y - 8 * sc, 22 * sc, t, 5, 4 * sc);
    },
    // Trator Comboio: 3 carretas de arroz engatadas atrás
    carretas(g, m, draw) {
      const sc = m.sc || 1, f = faceOf(m);
      let px = m.x - f * 52 * sc, py = floorAt(m, px) - 18 * sc;
      for (let i = 0; i < 3; i++) {
        const cx = m.x - f * (98 + i * 66) * sc, gy = floorAt(m, cx), w = 54 * sc, h = 22 * sc, top = gy - 12 * sc - h;
        g.strokeStyle = INK; g.lineWidth = 3 * sc; g.beginPath(); g.moveTo(px, py); g.lineTo(cx + f * w * 0.5, top + h * 0.75); g.stroke();
        g.strokeStyle = PAL.steelD; g.lineWidth = 1.4 * sc; g.stroke();
        Draw.shadow(g, cx, gy + 2 * sc, w * 0.55, 3.5 * sc, 0.18);
        // monte de arroz por cima
        g.beginPath(); g.ellipse(cx, top + 2 * sc, w * 0.46, h * 0.55, 0, Math.PI, Math.PI * 2); g.closePath();
        g.fillStyle = PAL.rice; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.4 * sc; g.stroke();
        Draw.box(g, cx - w / 2, top, w, h, i % 2 ? PAL.ora : PAL.red, { r: 3 * sc });
        Draw.text(g, '米', cx, top + h * 0.55, { size: 13 * sc, col: '#FFF8EC', sw: 3 * sc });
        const rot = (m.x || 0) / (9 * sc);
        Draw.wheel(g, cx - w * 0.28, gy - 8 * sc, 8 * sc, rot, { spokes: 5 }); Draw.wheel(g, cx + w * 0.28, gy - 8 * sc, 8 * sc, rot, { spokes: 5 });
        px = cx - f * w * 0.5; py = top + h * 0.75;
      }
      draw();
    },
    // Escavadeira de Dois Braços: a mesma máquina espelhada atrás, só o braço aparece (sai das costas)
    bracos(g, m, draw) {
      const sc = m.sc || 1, f = faceOf(m), cut = 92 * sc;
      g.save();
      g.beginPath(); if (f > 0) g.rect(m.x - 2000, m.y - 2000, 2000 - cut, 4000); else g.rect(m.x + cut, m.y - 2000, 2000, 4000); g.clip();
      g.translate(m.x, 0); g.scale(-1, 1); g.translate(-m.x, 0);
      draw();
      g.restore();
      draw();
    },
    // Bagger Dourada: a máquina inteira em ouro + brilhos
    dourada(g, m, draw) {
      const ok = goldFilter(g, true);
      try { draw(); } finally { if (ok) goldFilter(g, false); }
      const sc = m.sc || 1, b = m.biteO, t = m.t || 0;
      if (b && b.x) sparks(g, b.x, b.y, 160 * sc, t, 7, 14 * sc);
      sparks(g, m.x, m.y - 300 * sc, 260 * sc, t + 3, 6, 12 * sc);
    },
    // Caminhão Foguete: dois foguetes presos na traseira, chama tremendo
    foguete(g, m, draw) {
      draw();
      const sc = m.sc || 1, f = faceOf(m), t = m.t || 0, T = G.Tools.caminhao, W = (T && T.w) || 300;
      const bx = m.x - f * W * 0.42 * sc, gy = floorAt(m, m.x);
      for (let k = 0; k < 2; k++) {
        const y = gy - (70 + k * 46) * sc, L = 70 * sc, r = 13 * sc, x0 = bx - f * L * 0.3;
        const fl = (0.75 + 0.25 * Math.sin(t * 40 + k * 2)) * (1 + 0.4 * Math.min(1, Math.abs(m.vx || 0) / 200));
        g.save(); g.translate(x0, y); g.scale(f, 1);
        g.fillStyle = '#FFB13B'; g.beginPath(); g.moveTo(-L * 0.5, -r * 0.7); g.lineTo(-L * 0.5 - 46 * sc * fl, 0); g.lineTo(-L * 0.5, r * 0.7); g.closePath(); g.fill();
        g.fillStyle = '#FFF0B0'; g.beginPath(); g.moveTo(-L * 0.5, -r * 0.4); g.lineTo(-L * 0.5 - 24 * sc * fl, 0); g.lineTo(-L * 0.5, r * 0.4); g.closePath(); g.fill();
        Draw.box(g, -L * 0.5, -r, L, r * 2, '#E8E2D6', { r: r * 0.9 });
        g.fillStyle = PAL.red; g.beginPath(); g.moveTo(L * 0.5 - 2, -r); g.quadraticCurveTo(L * 0.5 + r * 1.6, 0, L * 0.5 - 2, r); g.closePath(); g.fill(); g.strokeStyle = INK; g.lineWidth = 2 * sc; g.stroke();
        g.fillStyle = PAL.red; g.fillRect(-L * 0.42, -r - 7 * sc, 12 * sc, 7 * sc); g.fillRect(-L * 0.42, r, 12 * sc, 7 * sc);
        g.restore();
      }
    },
    // Colheitadeira Gourmet: chapéu de chef gigante na cabine, vapor e onigiri pulando pra fora
    chef(g, m, draw) {
      draw();
      const sc = m.sc || 1, t = m.t || 0, s = m.seatO || { x: m.x, y: m.y - 90 * sc }, hx = s.x, hy = s.y - 46 * sc;
      for (let i = 0; i < 3; i++) { const q = (t * 0.6 + i / 3) % 1; g.globalAlpha = 0.5 * (1 - q); Draw.circle(g, hx + 30 * sc + q * 20 * sc, hy - 30 * sc - q * 60 * sc, (6 + q * 12) * sc, '#FFFFFF', { ol: 0 }); }
      g.globalAlpha = 1;
      Draw.box(g, hx - 17 * sc, hy - 2 * sc, 34 * sc, 14 * sc, '#FFFFFF', { r: 2 * sc });
      for (const [dx, dy, r] of [[-12, -10, 11], [0, -18, 13], [12, -10, 11]]) Draw.circle(g, hx + dx * sc, hy + dy * sc, r * sc, '#FFFFFF', { ol: 1.6 * sc });
      for (let i = 0; i < 2; i++) {
        const q = (t * 0.45 + i * 0.5) % 1, ox = s.x - 40 * sc - q * 90 * sc, oy = s.y - 20 * sc - Math.sin(q * Math.PI) * 80 * sc;
        g.save(); g.translate(ox, oy); g.rotate(q * 6);
        g.beginPath(); g.moveTo(0, -9 * sc); g.lineTo(9 * sc, 7 * sc); g.lineTo(-9 * sc, 7 * sc); g.closePath(); g.fillStyle = '#FFFFFF'; g.fill(); g.strokeStyle = INK; g.lineWidth = 1.5 * sc; g.stroke();
        g.fillStyle = '#2E3A2E'; g.fillRect(-5 * sc, 2 * sc, 10 * sc, 5 * sc);
        g.restore();
      }
    },
  };
  function wrap() {
    if (wrapped || !G.Tools) return; wrapped = true;
    const tools = {}; for (const e of list()) tools[e.tool] = 1;
    for (const id in tools) {
      const T = G.Tools[id]; if (!T || T.__evo) continue;
      const orig = T.draw; T.__evo = 1;
      T.draw = function (g, m) {
        const e = m && (m.evoForce || active[id]);
        if (!e || !VIS[e.vis]) return orig.call(this, g, m);
        m.evo = e.id;
        try { VIS[e.vis](g, m, () => orig.call(this, g, m)); } finally { m.evo = null; }
      };
    }
  }

  /* ---- cena curta: a máquina parada → clarão → a versão evoluída; não pausa o jogo; toque/botão fecha; 5 s fecha sozinha ---- */
  const INP = { x: 0, y: 0, face: 1, floor: () => 0, digging: false, power: 1, tx: null, ty: null, zoom: 1, night: 0 };
  function scene(e) {
    if (!G.Faixas || !G.Faixas.card) return;
    const T = G.Tools[e.tool]; let m = null;
    try { m = T.create({ pilot: (S().look && S().look.pal) || 'kome' }); for (let i = 0; i < 90; i++) T.update(m, 1 / 60, INP); } catch (err) { m = null; }
    const W0 = (T && T.w) || 200, H0 = (T && T.h) || 140, extra = e.vis === 'carretas' ? 2.6 : e.vis === 'bracos' ? 1.8 : e.vis === 'foguete' ? 1.5 : 1;
    let flashed = false;
    if (api && api.sfx) api.sfx('whoosh');
    G.Faixas.card({
      kick: 'EVOLUÇÃO!', title: e.n + '!', auto: 6, btn: 'Que absurdo!',
      art: { w: 400, h: 160, draw(g, t, w, h) {
        if (!m) return;
        const k = Math.min(w * 0.86 / (W0 * extra), h * 0.78 / H0), evo = t > 1.4;
        if (evo && !flashed) { flashed = true; if (api && api.sfx) { api.sfx('fanfare'); } }
        m.evoForce = evo ? e : null;
        try { T.update(m, 1 / 60, INP); } catch (err) { /* */ }
        const ox = w / 2 + (e.vis === 'carretas' ? W0 * k * 0.75 : e.vis === 'bracos' ? W0 * k * 0.25 : 0);
        const z0 = Draw.zoom, mp0 = Draw.minPx;
        g.save(); g.translate(ox, h - 12); g.scale(k, k); Draw.lod(k, 0);
        const shake = t > 1.0 && t < 1.4 ? Math.sin(t * 90) * 3 : 0; g.translate(shake, 0);
        try { T.draw(g, m); } catch (err) { /* */ }
        g.restore(); Draw.lod(z0, mp0);
        if (t > 1.2 && t < 1.9) { g.globalAlpha = Math.max(0, 1 - Math.abs(t - 1.4) / 0.5); g.fillStyle = '#FFF6D2'; g.fillRect(0, 0, w, h); g.globalAlpha = 1; }
        if (evo) sparks(g, w / 2, h / 2, w * 0.4, t, 8, 7);
      } },
      lines: [
        { t: toolName(e.tool) + ' + ' + amName(e.am) + ' = ' + e.n, cls: 'k-fx-new' },
        { t: e.d },
        { t: e.fala ? '"' + e.fala + '"' : '' },
        { t: 'Rende ×' + CFG.mult + ' com ela nesta ilha · anotado no Caderno', cls: 'k-fx-pay' },
      ],
      onClose: () => { if (m) m.evoForce = null; },
    });
  }

  function tick(dt) {
    if (!S()) return;
    if (!wrapped) wrap();
    if ((chkT -= dt) <= 0) {
      chkT = 0.25;
      if (refresh() && api && api.recompute) api.recompute();
      const v = est(), key = tripKey();
      for (const id in active) {
        const e = active[id]; if (v.seen[e.id] === key) continue;
        v.seen[e.id] = key; v.disc[e.id] = 1;
        if (!fast()) queue.push(e);
        if (api && api.save && !fast()) api.save();
      }
    }
    if (!queue.length || fast()) { if (fast()) queue.length = 0; return; }
    if ((api && api.busy && api.busy()) || (G.AmuletosUI && G.AmuletosUI.isOpen())) { waitT = Math.max(waitT, 1.2); return; }
    if ((waitT -= dt) > 0) return;
    waitT = 2; scene(queue.shift());
  }

  /* ---- Caderno: evoluções descobertas, "?" até achar (goals.js chama) ---- */
  function caderno(col) {
    const UI = E.UI; if (!UI || !UI.el || !list().length) return;
    const L = list(), disc = est().disc, n = L.filter(e => disc[e.id]).length;
    UI.el('div', 'k-h', col, 'Evoluções descobertas · ' + n + '/' + L.length);
    const icon = id => { try { return G.Props && G.Props.ids && G.Props.ids.indexOf(id) >= 0 ? G.Props.icon(id) : 'star'; } catch (err) { return 'star'; } };
    if (UI.album) UI.album(col, { cols: 2, items: L.map(e => ({ id: 'evo_' + e.id, name: e.n, hint: '?', q: toolName(e.tool) + ' no nível ' + CFG.lvl + ' da Oficina + um amuleto certo: ?', a: toolName(e.tool) + ' + ' + amName(e.am) + ' · ' + e.d + ' · ×' + CFG.mult, icon: disc[e.id] ? icon(e.tool) : 'lock', unlocked: !!disc[e.id] })) });
  }

  G.Evolucoes = {
    init(a) { api = a || {}; if (G.Sim) G.Sim.add('evolucoes', { tick }); if (S()) est(); },
    applyStats, on, active: () => Object.assign({}, active), list, byId, ready, caderno, VIS,
    discovered: () => Object.assign({}, est().disc),
    play: id => { const e = byId(id); if (e) scene(e); },   // ?dev / testes
  };
  if (DEMO) { const go = () => { if (!G.Faixas || !G.HUD || !G.HUD.ready || !S()) return setTimeout(go, 300); wrap(); const e = byId(DEMO) || list()[0]; if (e) scene(e); }; setTimeout(go, 1200); }
})();
