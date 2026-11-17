/* Kome no Japão — belts.js
   Esteiras da industrialização (pedido do dono: automação bem visual, que é o que a turma gosta nesse tipo de jogo).
   - Esteira 1 (a partir do Trator): sai do pé da montanha, onde as máquinas cavam, e leva o arroz até o coletor.
   - Esteira 2 (nó "Esteira" a9, ou a partir da Escavadeira): sai do coletor, atravessa o pátio e entra na fábrica de onigiri.
   Montinhos de arroz andam em cima (E.Conveyor da engine); a velocidade e a quantidade crescem com a renda.
   Recria a esteira quando as pontas andam (o pé da montanha recua conforme cava). G.Belts.tick(dt, ctx) / draw(g, t). */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, PAL = E.PAL, D = G.Data;
  const belts = { a: null, b: null };
  const key = { a: '', b: '' };
  let putA = 0, putB = 0;
  function make(id, pts, speed) {
    const k = pts.map(p => Math.round(p[0] / 48) + ',' + Math.round(p[1] / 24)).join('|');
    if (belts[id] && key[id] === k) return belts[id];
    key[id] = k;
    belts[id] = E.Conveyor(pts, { w: 14, speed, floor: 0, frame: PAL.yel, legs: true, maxV: 2.6 });
    belts[id].running = true;
    return belts[id];
  }
  function tick(dt, ctx) {
    const S = G.S, TI = D.toolIndex || {};
    const col = ctx.col, foot = ctx.footX;
    const rate = U.clamp(Math.log10(Math.max(10, S.ips || 0)) - 1, 0.4, 4);     // 1 a 4 conforme a renda
    // esteira 1: pé da montanha -> coletor
    const showA = S.tool >= (TI.trator || 7) && foot - col.x > 140 && !ctx.noA;   // noA: a Bagger tem a esteira dela (a do chão passaria por dentro da máquina)
    if (showA) {
      const a = make('a', [[foot - 20, -34], [col.x + 34, -30]], 60 + 25 * rate);
      a.speed = 60 + 25 * rate; a.update(dt);
      if ((putA -= dt) <= 0) { putA = 0.42 / rate; a.put(0.7 + Math.random() * 0.5, 0); }
    } else belts.a = null;
    // esteira 2: coletor -> porta da fábrica de onigiri do pátio (esteira comprida atravessando o pátio, sobe um pouco no fim)
    const fab = ctx.fabX;
    // fab = ponta direita do galpão KOME PACK (vaga vizinha do silo): esteira curta e reta, sem atravessar prédio nenhum
    const showB = (S.own.a9 || S.tool >= (TI.escav || 10)) && fab && col.x - fab > 150;
    if (showB) {
      const b = make('b', [[col.x - 30, -30], [fab + 70, -30], [fab + 14, -44]], 55 + 20 * rate);
      b.speed = 55 + 20 * rate; b.update(dt);
      if ((putB -= dt) <= 0) { putB = 0.6 / rate; b.put(0.6 + Math.random() * 0.4, 0); }
    } else belts.b = null;
  }
  function draw(g, t) {
    if (belts.b) belts.b.draw(g, t);
    if (belts.a) belts.a.draw(g, t);
  }
  G.Belts = { tick, draw, belts };
})();
