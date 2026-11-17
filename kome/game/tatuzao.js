/* Kome no Japão — tatuzao.js
   O TATUZÃO (tuneladora, game/tbm.js) no jogo: depois da campanha, um chip no topo vende o Tatuzão. Comprado, ele entra
   na base da montanha e vai furando um túnel reto pra dentro dela, com o trem de apoio atrás; cada anel instalado paga
   renda (D.TATU.ringSec segundos da renda de agora). O túnel é só desenho por cima da montanha (o terreno é um mapa de
   alturas): ele é recortado pela superfície, então onde você já cavou o túnel some. Montanha nova = túnel novo.
   Estado no save: S.stats.tatu = 1 (comprado). Números: D.TATU (data.js). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, D = G.Data;
  let api = null, m = null, inp = null, chip = null, chipT = 0, t = 0, mouth = 0, end = 0;
  const T = () => G.Tools && G.Tools.tbm;
  const S = () => G.S;
  const owned = () => !!(S() && S().stats.tatu);
  const price = () => Math.ceil((D.TATU.price * Math.max(10, G.priceIps ? G.priceIps() : S().ips || 10)) / 10) * 10;

  // boca do túnel: primeiro x onde a montanha já é alta o bastante pro escudo caber inteiro
  function findMouth() {
    const h = api.heap(); let x0 = S().footX || 0;
    for (let x = x0; x < x0 + 6000; x += 16) if (h.height(x) > D.TATU.minH) { x0 = x; break; }
    let x1 = x0; for (let x = x0; x < x0 + 9000; x += 32) { if (h.height(x) > D.TATU.minH * 0.8) x1 = x; else if (x - x1 > 400) break; }
    return [x0, x1];
  }
  function spawn() {
    const tb = T(); if (!tb) return;
    [mouth, end] = findMouth();
    m = tb.create({ pilot: 'goma', scale: 1, mode: 'bore' });
    m.tunnel.x0 = mouth;
    inp = { x: mouth + 420, y: 0, face: 1, tx: end, ty: 0, digging: true, power: 1, speedMul: 1, vx: 0, floor: () => 0, load: 0, t: 0, parts: null, boost: 0, night: false, zoom: 0.3 };
  }
  function tick(dt) {
    if (!api) return;
    if (!S() || !owned()) { chipTick(dt); return; }
    chipTick(dt);
    if (!m) spawn(); if (!m) return;
    t += dt; inp.t = t; inp.digging = m.x < end - 40; inp.parts = api.parts && api.parts();
    T().update(m, dt, inp);
    for (const ev of m.ev) if (ev === 'ring') { const v = Math.max(1, S().ips || 0) * D.TATU.ringSec; api.pay(v, m.x, -146); S().stats.tatuRings = (S().stats.tatuRings | 0) + 1; }
  }
  // túnel recortado pela superfície da montanha (onde já foi cavado, não tem túnel)
  function drawTunnel(g, view) {
    if (!m || !owned()) return;
    const h = api.heap(), x0 = Math.max(view.x0, mouth - 40), x1 = Math.min(view.x1, m.x + 200);
    if (x1 <= x0) return;
    g.save(); g.beginPath(); g.moveTo(x0, 4);
    for (let x = x0; x <= x1; x += 16) g.lineTo(x, Math.min(4, h.surf(x)));
    g.lineTo(x1, 4); g.closePath(); g.clip();
    T().drawTunnel(g, m);
    g.restore();
  }
  function draw(g, view) { if (m && owned() && m.x - 1300 < view.x1 && m.x + 400 > view.x0) T().draw(g, m); }

  /* ---- chip de compra no topo (só depois do final, até comprar) ---- */
  function chipTick(dt) {
    if ((chipT -= dt) > 0) return; chipT = 0.5;
    const s = S(); if (!s || !G.HUD || !G.HUD.chip) return;
    if (!chip) { chip = G.HUD.chip({ id: 'tatuzao', icon: 'drill', label: 'Tatuzão', order: 30, tone: '#E2E8EE', show: false, onClick: () => buy() }); if (!chip) return; }
    const on = s.ended && !owned() && !!T(); if (!on) { chip.set({ show: false }); return; }
    const c = price(), can = s.money >= c;
    chip.el.title = 'Tatuzão: ¥' + U.fmt(c);
    chip.set({ show: true, prio: can ? 2.2 : 0, hint: can ? '¥' + U.fmt(c) + ' · comprar!' : '' });
  }
  function buy() {
    const s = S(), c = price();
    if (owned()) return false;
    if (s.money < c) { if (E.UI) E.UI.toast('Faltam ¥' + U.fmt(c - s.money) + ' pro Tatuzão', { icon: 'yen', tone: 'bad' }); return false; }
    s.money -= c; s.stats.tatu = 1; if (G.priceBump) G.priceBump(); spawn();
    if (api.bought) api.bought(m ? m.x : 0);
    return true;
  }
  G.Tatu = {
    init(a) { api = a || {}; },
    tick, drawTunnel, draw, buy, reset() { m = null; },   // reset: montanha nova
    own() { if (S()) { S().stats.tatu = 1; spawn(); } },
    get state() { return m ? { x: Math.round(m.x), mouth, end, rings: m.rings, bored: Math.round(m.bored), done: !!m.done } : null; },
  };
})();
