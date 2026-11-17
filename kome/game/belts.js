/* Kome no Japão — belts.js
   Esteiras da industrialização (pedido do dono: automação bem visual, que é o que a turma gosta nesse tipo de jogo).
   A esteira NÃO atravessa mais o estacionamento: ela é subterrânea.
   - Entrada (a): sai do coletor (kei-truck / moega), anda um pedacinho e mergulha numa boca de túnel na beira do pátio.
   - Saída (b): reaparece depois do silo, numa boca virada pro galpão KOME PACK, e sobe pra porta dele.
   - Com a Bagger Gêmea (modo infinito): a entrada vira uma esteira inclinada que sobe do coletor da 293 até o topo do monte de
     estoque (a roda da Gêmea come o monte); a lança de descarga da Gêmea alimenta a boca do túnel (c).
   Montinhos de arroz andam em cima (E.Conveyor da engine); a velocidade e a quantidade crescem com a renda.
   Recria a esteira quando as pontas andam (o pátio acompanha o pé da montanha), levando a carga junto pra não piscar vazia.
   G.Belts.tick(dt, ctx) / draw(g, t). ctx = { col } (coletor); as vagas vêm de G.World.X (tunIn, tunOut, fab, pilha, gemea). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, PAL = E.PAL, D = G.Data, Draw = E.Draw;
  const belts = { a: null, b: null, c: null };
  const key = { a: '', b: '', c: '' }, put = { a: 0, b: 0, c: 0 };
  const PILE_H = 350;                                   // altura do monte de estoque da Gêmea (industry.js desenha)
  let showIn = false, showOut = false;
  function make(id, pts, speed, gap) {
    const k = pts.map(p => Math.round(p[0] / 24) + ',' + Math.round(p[1] / 24)).join('|');
    if (belts[id] && key[id] === k) return belts[id];
    key[id] = k;
    const old = belts[id], nb = E.Conveyor(pts, { w: 14, speed, floor: 0, frame: PAL.yel, legs: true, legGap: gap || 70, maxV: 2.6 });
    nb.running = true;
    if (old) { nb.v = old.v; nb.phase = old.phase; const r = nb.length / Math.max(1, old.length); for (const it of old.items) nb.put(it.v, it.s * r); }
    else for (let s = 30; s < nb.length - 20; s += 70 + Math.random() * 60) nb.put(0.7 + Math.random() * 0.5, s);   // já nasce carregada
    return (belts[id] = nb);
  }
  function run(id, pts, speed, every, dt, gap) {
    const b = make(id, pts, speed, gap); b.speed = speed; b.update(dt);
    if ((put[id] -= dt) <= 0) { put[id] = every; b.put(0.6 + Math.random() * 0.5, 0); }
  }
  function tick(dt, ctx) {
    const S = G.S, TI = D.toolIndex || {}, X = G.World.X, col = ctx.col, kind = col.kind;
    const rate = U.clamp(Math.log10(Math.max(10, S.ips || 0)) - 1, 0.4, 4);     // 1 a 4 conforme a renda
    const off = kind === 'moega' ? 104 : kind === 'silo' ? 64 : 38;             // meia largura do coletor
    const on = S.tool >= (TI.trator || 7) && (kind === 'kei' || kind === 'silo' || kind === 'moega') && !!(S.own.a7 || X.fab);
    const gk = X.gemeaK;
    showIn = on && (gk ? !!(G.Ind && (G.Ind.run().giant | 0) >= 3) : col.x - off - X.tunIn > 46);
    showOut = on && !!X.fab;
    if (on && gk) run('a', [[col.x - off, -40], [X.pilha + 26, -PILE_H - 30]], 70 + 25 * rate, 0.4 / rate, dt, 210);
    else if (showIn) run('a', [[col.x - off, -30], [X.tunIn + 6, -30]], 60 + 25 * rate, 0.42 / rate, dt);
    else belts.a = null;
    const twinDigs = gk && G.Ind && (G.Ind.run().giant | 0) >= 3;   // sem a lança (peças 1 e 2) a Gêmea ainda não descarrega: o monte só junta estoque
    if (on && twinDigs) run('c', [[X.gemea - 752 * gk + 40, -34], [X.tunIn + 6, -30]], 60 + 25 * rate, 0.42 / rate, dt); else belts.c = null;
    if (showOut) run('b', [[X.tunOut - 6, -30], [X.fab + 70, -30], [X.fab + 14, -44]], 55 + 20 * rate, 0.6 / rate, dt); else belts.b = null;
  }
  // boca do túnel da esteira: casamata de concreto vista de lado (a esteira entra pela face `dir`: +1 = pela direita)
  function portal(g, x, dir) {
    g.save(); g.translate(x, 0); g.scale(dir, 1);
    Draw.poly(g, [[-30, 2], [-30, -40], [-8, -52], [14, -52], [14, 2]], '#B9BEC6', { ol: 1.6 });
    g.fillStyle = '#9299A3'; g.fillRect(-28, -8, 40, 8);                                   // rodapé
    g.fillStyle = '#2B2622'; g.fillRect(2, -44, 11, 40);                                   // a boca (sombra por onde a esteira some)
    g.fillStyle = PAL.yel; g.fillRect(-2, -50, 16, 5);                                     // verga amarela com faixas pretas
    g.fillStyle = PAL.line; for (let i = 0; i < 3; i++) g.fillRect(i * 6, -50, 3, 5);
    g.fillStyle = PAL.yel; g.beginPath(); g.moveTo(-22, -30); g.lineTo(-10, -30); g.lineTo(-16, -18); g.closePath(); g.fill();   // seta "pra baixo": vai por baixo do pátio
    g.strokeStyle = PAL.line; g.lineWidth = 1.2; g.stroke();
    g.restore();
  }
  function draw(g, t) {
    const X = G.World.X;
    if (belts.b) belts.b.draw(g, t);
    if (belts.c) belts.c.draw(g, t);
    if (belts.a) belts.a.draw(g, t);
    if ((belts.a || belts.c) && showIn && X.tunIn) portal(g, X.tunIn - 8, 1);   // (com a Gêmea só depois da lança: antes não chega esteira nenhuma na boca)
    if (belts.b && X.tunOut) portal(g, X.tunOut + 8, -1);
  }
  G.Belts = { tick, draw, belts, PILE_H };
})();
