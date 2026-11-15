/* Kome Engine — rig.js
   Máquinas articuladas "de verdade": esqueleto de peças com juntas, IK, juntas com mola (peso e overshoot),
   pistões que esticam, cabos com polias, mastros telescópicos, chassi com suspensão, esteira transportadora
   e escapamento em pulsos. Tudo no estilo Kome (contorno LINE, cores chapadas da E.PAL).
   Depende de: core.js, pix.js.

   Índice
     1. Spring / Joint      mola amortecida; junta com limites, vazão hidráulica e batente
     2. ik2 / ik3           IK de dois ossos; lança + braço + caçamba com ângulo da caçamba controlado
     3. Rig                 esqueleto hierárquico (peças, z, sprites, pistões/links entre peças, world())
     4. Rig.* (desenho)     pin, plate (braço chapado afinado), bucket, pulley, mound
     5. Rope                cabo por polias (tangentes), barriga, polias que giram com o cabo pago
     6. Telescope           mastro/cilindro telescópico em estágios
     7. Chassis             rodas num chão f(x): inclinação da carroceria + compressão da suspensão
     8. Exhaust             fumaça de escapamento em pulsos
     9. Conveyor            esteira transportadora em polilinha com roletes, marcas e montinhos de carga

   Receita de um braço articulado (ver demos/rig.html pras máquinas completas):
     const rig = E.Rig(), J = { boom: E.Joint(-.6, {k:22, d:7.5, min:-1.3, max:0, speed:1.3}), stick: E.Joint(1.5, {k:34, d:9}) };
     rig.part('casa',  { draw: g => Draw.box(g, -40, -40, 80, 40, PAL.yel, {r:5}) });
     rig.part('lanca', { parent:'casa',  x:30, y:-12, z:2, joint:J.boom,  draw: g => { Rig.plate(g, [[0,0,6],[30,-13,10],[80,0,5]], PAL.yel); Rig.pin(g,0,0,3); } });
     rig.part('braco', { parent:'lanca', x:80, y:0,   z:3, joint:J.stick, draw: g => Rig.plate(g, [[-12,-2,4],[3,-1,7],[50,0,4]], PAL.yel) });
     rig.piston('p1', { a:['casa',44,-4],   b:['lanca',32,-6],  w:6, z:2.5 });  rig.calibrate('p1', [['lanca', J.boom.min, J.boom.max]]);
     rig.piston('p2', { a:['lanca',31,-21], b:['braco',-12,-2], w:5, z:3.5 });  rig.calibrate('p2', [['braco', .4, 2.5]]);
     // por frame: alvo no espaço do modelo -> IK -> alvos das juntas (as molas dão o peso e o atraso entre elas)
     const ik = E.ik2(30, -12, alvoX, alvoY, 80, 50, 1, tmp);  J.boom.set(ik.a1);  J.stick.set(ik.rel);
     rig.update(dt);  rig.draw(g, x, y, { face, rot: chassi.tilt });
   Regras de ouro: pino (Rig.pin) em toda junta; braço = Rig.plate afinado, nunca um Draw.beam só; todo movimento passa por
   E.Joint/E.Spring (rigidez diferente por junta = atraso entre elas); o "segundo braço" é a mesma peça mais escura com z atrás. */
(function () {
  'use strict';
  const E = (window.KomeEngine = window.KomeEngine || {});
  if (!E.U) throw new Error('KomeEngine: carregue core.js antes de rig.js');
  if (!E.Draw) throw new Error('KomeEngine: carregue pix.js antes de rig.js');

  const U = E.U, PAL = E.PAL, Draw = E.Draw, LINE = E.LINE_CSS;
  const TAU = Math.PI * 2, PI = Math.PI, NO = Object.freeze({});
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const olW = o => {                                   // contorno efetivo (respeita Draw.OL e Draw.minPx)
    const v = o && o.ol !== undefined ? o.ol : Draw.OL;
    if (v <= 0) return 0;
    const m = (Draw.minPx || 0) / (Draw.zoom || 1);
    return v > m ? v : m;
  };
  const shadeCache = new Map();                        // U.shade com cache (strings prontas, zero alocação por frame)
  function sh(c, k) {
    const key = c + '|' + k;
    let v = shadeCache.get(key);
    if (v === undefined) { v = U.shade(c, k); shadeCache.set(key, v); }
    return v;
  }
  function mixc(a, b, t) {
    const key = a + '>' + b + '|' + t;
    let v = shadeCache.get(key);
    if (v === undefined) { v = U.mixCss(a, b, t); shadeCache.set(key, v); }
    return v;
  }

  /* ======================================================================
     1. Spring / Joint
     ====================================================================== */
  // integra uma mola amortecida em subpassos estáveis (Euler semi-implícito)
  function stepSpring(s, target, dt) {
    if (!(dt > 0)) return;
    const hMax = Math.min(1 / 120, 0.4 / Math.sqrt(s.k > 1 ? s.k : 1));
    let n = Math.ceil(dt / hMax); if (n > 12) n = 12;
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      s.v += ((target - s.x) * s.k - s.v * s.d) * h;
      s.x += s.v * h;
    }
  }

  // E.Spring(v, {k=120, d=14}) -> { x, v, target, k, d, update(dt)->x, kick(impulso), snap(x) }: mola amortecida (balanço de carroceria, antena, carga pendurada)
  function Spring(v, o) {
    o = o || NO;
    const s = {
      x: v || 0, v: 0, target: v || 0,
      k: o.k !== undefined ? o.k : 120, d: o.d !== undefined ? o.d : 14,
      // update(dt) -> x: avança a mola em direção a target
      update(dt) { stepSpring(s, s.target, dt); return s.x; },
      // kick(impulso): soma velocidade (tranco)
      kick(imp) { s.v += imp; return s; },
      // snap(x): teleporta e zera a velocidade
      snap(x) { s.x = s.target = x; s.v = 0; return s; },
    };
    return s;
  }

  // E.Joint(ang, {k=60, d=11, min, max, speed=Infinity, bounce=.2}) -> junta com peso: acelera, passa um pouco do ponto e assenta
  //   target = onde você quer; speed = "vazão hidráulica" (rad/s máx. do alvo interno); min/max = batentes (bate e quica 'bounce');
  //   campos: x (ângulo atual), v, target, goal, hit (velocidade da batida no batente neste frame, senão 0), moving
  //   amortecimento: zeta = d / (2*sqrt(k)); ~.7 dá um overshoot leve, 1 = sem overshoot
  function Joint(ang, o) {
    o = o || NO;
    const j = {
      x: ang || 0, v: 0, target: ang || 0, goal: ang || 0,
      k: o.k !== undefined ? o.k : 60, d: o.d !== undefined ? o.d : 11,
      min: o.min !== undefined ? o.min : -Infinity, max: o.max !== undefined ? o.max : Infinity,
      speed: o.speed !== undefined ? o.speed : Infinity, bounce: o.bounce !== undefined ? o.bounce : 0.2,
      hit: 0, moving: false,
      // update(dt) -> x
      update(dt) {
        if (j.target < j.min) j.target = j.min; else if (j.target > j.max) j.target = j.max;
        const step = j.speed * dt, dg = j.target - j.goal;
        j.goal = Math.abs(dg) <= step ? j.target : j.goal + (dg > 0 ? step : -step);
        stepSpring(j, j.goal, dt);
        j.hit = 0;
        if (j.x < j.min) { j.hit = -j.v; j.x = j.min; j.v = -j.v * j.bounce; }
        else if (j.x > j.max) { j.hit = j.v; j.x = j.max; j.v = -j.v * j.bounce; }
        j.moving = Math.abs(j.v) > 0.02 || Math.abs(j.goal - j.x) > 0.004;
        return j.x;
      },
      // set(alvo): define o alvo (respeita os limites)
      set(t) { j.target = clamp(t, j.min, j.max); return j; },
      // snap(ang): teleporta
      snap(a) { j.x = j.target = j.goal = clamp(a, j.min, j.max); j.v = 0; return j; },
      // kick(impulso): tranco na junta
      kick(imp) { j.v += imp; return j; },
    };
    return j;
  }

  /* ======================================================================
     2. IK
     ====================================================================== */
  // E.ik2(ax, ay, tx, ty, L1, L2, bend=1, out?) -> {ex,ey, bx,by, a1,a2, rel, reach, clamped}
  //   a1/a2 = ângulos ABSOLUTOS dos dois ossos (rel = a2-a1, pra usar como rot do filho num Rig);
  //   (bx,by) cotovelo, (ex,ey) ponta alcançada; reach = distância pedida / (L1+L2); alcance travado em [|L1-L2|, L1+L2];
  //   bend=1 dobra o cotovelo pra cima quando o alvo está à direita (anti-horário na tela), -1 pro outro lado
  function ik2(ax, ay, tx, ty, L1, L2, bend, out) {
    out = out || {};
    if (bend === undefined) bend = 1;
    const dx = tx - ax, dy = ty - ay, d = Math.hypot(dx, dy), sum = L1 + L2;
    const dc = clamp(d, Math.abs(L1 - L2) * 1.001 + 1e-4, sum * 0.9995);
    const base = d > 1e-6 ? Math.atan2(dy, dx) : 0;
    const alpha = Math.acos(clamp((L1 * L1 + dc * dc - L2 * L2) / (2 * L1 * dc), -1, 1));
    const a1 = base - bend * alpha;
    const bx = ax + Math.cos(a1) * L1, by = ay + Math.sin(a1) * L1;
    const ex = ax + Math.cos(base) * dc, ey = ay + Math.sin(base) * dc;
    const a2 = Math.atan2(ey - by, ex - bx);
    let rel = a2 - a1;
    while (rel > PI) rel -= TAU;
    while (rel < -PI) rel += TAU;
    out.a1 = a1; out.a2 = a2; out.rel = rel; out.bx = bx; out.by = by; out.ex = ex; out.ey = ey;
    out.reach = sum > 0 ? d / sum : 0; out.clamped = dc !== d;
    return out;
  }

  // E.ik3(ax, ay, tx, ty, L1, L2, L3, tip, bend=1, out?) -> {a1,a2,a3, bx,by, wx,wy, ex,ey, rel2, rel3, reach, clamped}
  //   lança + braço + caçamba: a PONTA da caçamba vai em (tx,ty) chegando com o ângulo absoluto 'tip' (você controla a báscula);
  //   (bx,by) = pino lança/braço, (wx,wy) = pino da caçamba; rel2/rel3 = ângulos relativos ao osso anterior
  function ik3(ax, ay, tx, ty, L1, L2, L3, tip, bend, out) {
    out = out || {};
    const c = Math.cos(tip), s = Math.sin(tip);
    ik2(ax, ay, tx - c * L3, ty - s * L3, L1, L2, bend, out);
    out.wx = out.ex; out.wy = out.ey;
    out.ex = out.wx + c * L3; out.ey = out.wy + s * L3;
    out.a3 = tip; out.rel2 = out.rel;
    let r3 = tip - out.a2;
    while (r3 > PI) r3 -= TAU;
    while (r3 < -PI) r3 += TAU;
    out.rel3 = r3;
    return out;
  }

  /* ======================================================================
     3. Rig
     ====================================================================== */
  const IDENT = [1, 0, 0, 1, 0, 0];
  const pa = [0, 0], pb = [0, 0], pistO = { col: null, rod: null, len: 0, max: 0, ol: undefined };

  // E.Rig() -> rig: esqueleto hierárquico de peças.
  //   Espaços: LOCAL da peça (origem no pino dela) -> MODELO (o rig antes de x,y/face/escala; onde se faz IK) -> MUNDO.
  //   Peça sem parent desenha direto no espaço do modelo (é assim que pistões e cabos ligam duas peças).
  function Rig() {
    const parts = [], order = [], byName = Object.create(null), drives = [];
    const R = [1, 0, 0, 1, 0, 0];           // matriz raiz (modelo -> mundo)
    const tmp = { x: 0, y: 0, rot: 0 };

    function need(name) {
      const p = typeof name === 'string' ? byName[name] : name;
      if (!p) throw new Error('KomeEngine.Rig: peça "' + name + '" não existe');
      return p;
    }
    // matriz modelo da peça = pai * T(x,y) * R(rot) * S(sx,sy)
    function poseOne(p) {
      const c = Math.cos(p.rot), s = Math.sin(p.rot), P = p.parent ? p.parent.m : IDENT, m = p.m;
      const la = c * p.sx, lb = s * p.sx, lc = -s * p.sy, ld = c * p.sy;
      m[0] = P[0] * la + P[2] * lb; m[1] = P[1] * la + P[3] * lb;
      m[2] = P[0] * lc + P[2] * ld; m[3] = P[1] * lc + P[3] * ld;
      m[4] = P[0] * p.x + P[2] * p.y + P[4]; m[5] = P[1] * p.x + P[3] * p.y + P[5];
      p.vis = p.visible && (p.parent ? p.parent.vis : true);
    }
    function poseChain(p) { if (p.parent) poseChain(p.parent); poseOne(p); }
    function anchor(a, out) {                // [peça, lx, ly] -> ponto no modelo
      const p = a[0], m = p.m, lx = a[1] || 0, ly = a[2] || 0;
      out[0] = m[0] * lx + m[2] * ly + m[4]; out[1] = m[1] * lx + m[3] * ly + m[5];
      return out;
    }
    function resolveAnchor(a) { return [need(a[0]), a[1] || 0, a[2] || 0]; }
    function drawLink(g, p, rg, t) {
      anchor(p.a, pa); anchor(p.b, pb);
      pa[0] += p.dx; pa[1] += p.dy; pb[0] += p.dx; pb[1] += p.dy;
      p.length = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (p.max > p.min) p.ext = clamp((p.length - p.min) / (p.max - p.min), 0, 1);
      p.render(g, pa, pb, p, rg, t);
    }
    function renderPiston(g, a, b, p) {
      pistO.col = p.col; pistO.rod = p.rod; pistO.ol = p.ol;
      pistO.len = p.len || (p.min ? Math.max(p.min - p.w * 0.9, p.min * 0.6) : 0);
      pistO.max = p.max || 0;
      if (!pistO.len && !pistO.max) pistO.len = undefined;
      Draw.piston(g, a, b, p.w, pistO);
    }

    const rig = {
      parts, time: 0,
      x: 0, y: 0, face: 1, scale: 1, rot: 0,     // pose do último solve/draw

      // part(nome, {parent, x, y, rot=0, z=0, draw(g, part, rig, t), sprite, ax, ay, sx=1, sy=1, visible=true, joint, update(part,dt,rig), data}) -> part
      //   o pai precisa existir antes; sx/sy fazem parte da transformação (os filhos herdam); joint = E.Joint que comanda part.rot no rig.update
      part(name, o) {
        o = o || NO;
        if (byName[name]) throw new Error('KomeEngine.Rig: peça "' + name + '" duplicada');
        const p = {
          name, parent: o.parent ? need(o.parent) : null,
          x: o.x || 0, y: o.y || 0, rot: o.rot || 0, z: o.z || 0,
          sx: o.sx !== undefined ? o.sx : 1, sy: o.sy !== undefined ? o.sy : 1,
          draw: o.draw || null, sprite: o.sprite || null, ax: o.ax, ay: o.ay,
          visible: o.visible !== false, vis: true, joint: o.joint || null, update: o.update || null,
          data: o.data || null, m: [1, 0, 0, 1, 0, 0], idx: parts.length,
        };
        if (p.joint) p.rot = p.joint.x;
        parts.push(p); order.push(p); byName[name] = p;
        poseOne(p);
        return p;
      },
      // set(nome, {rot, x, y, z, visible, ...}) -> part: altera campos da peça
      set(name, props) { const p = need(name); for (const k in props) p[k] = props[k]; return p; },
      // get(nome) -> part | undefined
      get(name) { return byName[name]; },
      // has(nome) -> bool
      has(name) { return !!byName[name]; },

      // link(nome, {a:[peça,lx,ly], b:[peça,lx,ly], z, dx, dy, render(g, a, b, part, rig, t)}) -> part
      //   elemento esticado entre dois pontos de peças diferentes (desenha no espaço do modelo); part.length = distância atual
      link(name, o) {
        const p = rig.part(name, { z: o.z, visible: o.visible });
        p.a = resolveAnchor(o.a); p.b = resolveAnchor(o.b);
        p.dx = o.dx || 0; p.dy = o.dy || 0; p.render = o.render;
        p.length = 0; p.min = o.min || 0; p.max = o.max || 0; p.ext = 0;
        p.draw = drawLink;
        return p;
      },
      // piston(nome, {a:[peça,lx,ly] (camisa), b:[peça,lx,ly] (haste), w=5, z, col, rod, len, min, max, dx, dy, ol}) -> part
      //   cilindro hidráulico que estica sozinho conforme as juntas mexem; part.length / part.ext (0..1 depois de calibrate ou min/max)
      piston(name, o) {
        const p = rig.link(name, o);
        p.w = o.w || 5; p.col = o.col || PAL.yel; p.rod = o.rod || PAL.steelL; p.len = o.len || 0; p.ol = o.ol;
        p.render = renderPiston;
        return p;
      },
      // calibrate(nome, [[peça, rotMin, rotMax], ...], passos=10) -> {min, max}: varre as juntas, mede o curso do pistão/link
      //   e fixa min/max (a camisa passa a ter comprimento constante = um pouco menos que o mínimo)
      calibrate(name, sweeps, steps) {
        const p = need(name), n = steps || 10, ps = sweeps.map(s => need(s[0])), keep = ps.map(q => q.rot);
        let mn = Infinity, mx = 0;
        (function rec(i) {
          if (i === ps.length) {
            poseChain(p.a[0]); poseChain(p.b[0]);
            anchor(p.a, pa); anchor(p.b, pb);
            const d = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
            if (d < mn) mn = d; if (d > mx) mx = d;
            return;
          }
          for (let k = 0; k <= n; k++) { ps[i].rot = U.lerp(sweeps[i][1], sweeps[i][2], k / n); rec(i + 1); }
        })(0);
        ps.forEach((q, i) => { q.rot = keep[i]; });
        rig.pose();
        p.min = mn; p.max = mx;
        return { min: mn, max: mx };
      },
      // drive(nome, prop, mola): liga um E.Spring/E.Joint a um campo da peça (ex.: 'y' numa cabine que balança); atualizado no rig.update
      drive(name, prop, spring) { drives.push({ p: need(name), prop, s: spring }); return spring; },

      // update(dt): avança juntas/molas ligadas às peças e chama part.update
      update(dt) {
        rig.time += dt;
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i];
          if (p.joint) p.rot = p.joint.update(dt);
          if (p.update) p.update(p, dt, rig);
        }
        for (let i = 0; i < drives.length; i++) { const d = drives[i]; d.p[d.prop] = d.s.update(dt); }
      },
      // pose(): recalcula as matrizes de todas as peças no espaço do modelo (sem mexer na raiz)
      pose() { for (let i = 0; i < parts.length; i++) poseOne(parts[i]); return rig; },
      // solve(x, y, face=1, scale=1, rot=0): calcula tudo sem desenhar (depois world() responde no mundo)
      solve(x, y, face, scale, rot) {
        face = face === undefined ? 1 : face; scale = scale === undefined ? 1 : scale; rot = rot || 0;
        rig.x = x || 0; rig.y = y || 0; rig.face = face; rig.scale = scale; rig.rot = rot;
        const c = Math.cos(rot), s = Math.sin(rot);
        R[0] = c * face * scale; R[1] = s * face * scale; R[2] = -s * scale; R[3] = c * scale; R[4] = rig.x; R[5] = rig.y;
        return rig.pose();
      },
      // draw(g, x, y, {face=1, scale=1, rot=0, t}): resolve e desenha as peças por ordem de z (empate = ordem de criação)
      //   face pode ser fracionário (-1..1) pra animar uma virada
      draw(g, x, y, o) {
        o = o || NO;
        rig.solve(x, y, o.face, o.scale, o.rot);
        const t = o.t !== undefined ? o.t : rig.time;
        // ordenação por inserção (estável e quase O(n) quando já está em ordem)
        for (let i = 1; i < order.length; i++) {
          const p = order[i]; let k = i - 1;
          while (k >= 0 && (order[k].z > p.z || (order[k].z === p.z && order[k].idx > p.idx))) { order[k + 1] = order[k]; k--; }
          order[k + 1] = p;
        }
        g.save();
        g.transform(R[0], R[1], R[2], R[3], R[4], R[5]);
        for (let i = 0; i < order.length; i++) {
          const p = order[i], m = p.m;
          if (!p.vis || (!p.draw && !p.sprite)) continue;
          g.save();
          g.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
          if (p.sprite) {
            g.imageSmoothingEnabled = false;
            const cv = p.sprite;
            g.drawImage(cv, -(p.ax !== undefined ? p.ax : cv.width / 2), -(p.ay !== undefined ? p.ay : cv.height));
          }
          if (p.draw) p.draw(g, p, rig, t);
          g.restore();
        }
        g.restore();
      },

      // model(nome, lx=0, ly=0, out?) -> {x,y,rot}: ponto local da peça no espaço do MODELO (sempre atual; use pra IK e âncoras)
      model(name, lx, ly, out) {
        const p = need(name), m = p.m; out = out || {};
        poseChain(p);
        lx = lx || 0; ly = ly || 0;
        out.x = m[0] * lx + m[2] * ly + m[4]; out.y = m[1] * lx + m[3] * ly + m[5];
        out.rot = Math.atan2(m[1], m[0]);
        return out;
      },
      // world(nome, lx=0, ly=0, out?) -> {x,y,rot}: ponto local da peça no MUNDO (usa x,y/face/escala do último solve/draw)
      world(name, lx, ly, out) {
        out = rig.model(name, lx, ly, out);
        const mx = out.x, my = out.y, p = byName[typeof name === 'string' ? name : name.name].m;
        out.x = R[0] * mx + R[2] * my + R[4]; out.y = R[1] * mx + R[3] * my + R[5];
        out.rot = Math.atan2(R[1] * p[0] + R[3] * p[1], R[0] * p[0] + R[2] * p[1]);
        return out;
      },
      // toModel(wx, wy, out?) -> {x,y}: ponto do mundo -> espaço do modelo (ex.: alvo do mouse pra IK)
      toModel(wx, wy, out) {
        out = out || {};
        const det = R[0] * R[3] - R[1] * R[2] || 1e-9, dx = wx - R[4], dy = wy - R[5];
        out.x = (R[3] * dx - R[2] * dy) / det; out.y = (-R[1] * dx + R[0] * dy) / det;
        return out;
      },
      // toLocal(nome, wx, wy, out?) -> {x,y}: ponto do mundo -> espaço local da peça
      toLocal(name, wx, wy, out) {
        const p = need(name), m = p.m;
        poseChain(p);
        out = rig.toModel(wx, wy, out);
        const det = m[0] * m[3] - m[1] * m[2] || 1e-9, dx = out.x - m[4], dy = out.y - m[5];
        out.x = (m[3] * dx - m[2] * dy) / det; out.y = (-m[1] * dx + m[0] * dy) / det;
        return out;
      },
      // dist(nomeA, lxA, lyA, nomeB, lxB, lyB) -> distância entre dois pontos de peças (espaço do modelo)
      dist(a, ax, ay, b, bx, by) {
        rig.model(a, ax, ay, tmp); const x0 = tmp.x, y0 = tmp.y;
        rig.model(b, bx, by, tmp);
        return Math.hypot(tmp.x - x0, tmp.y - y0);
      },
    };
    return rig;
  }

  /* ======================================================================
     4. Rig.* — peças prontas de desenho (coordenadas locais; mesmo contorno e cores chapadas do Draw)
     ====================================================================== */
  // Rig.pin(g, x, y, r, {col=aço, ol}): pino de articulação (disco de aço com miolo escuro)
  Rig.pin = function (g, x, y, r, o) {
    o = o || NO;
    const col = o.col || PAL.steel, ol = olW(o) * 0.6;
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, r + ol, 0, TAU); g.fill();
    g.fillStyle = sh(col, -0.3); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x - r * 0.12, y - r * 0.14, r * 0.8, 0, TAU); g.fill();
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, Math.max(0.5, r * 0.36), 0, TAU); g.fill();
  };

  // caminho da união de cápsulas afinadas entre os nós [x,y,r] (grow = engorda)
  function platePath(g, pts, grow) {
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], r = p[2] + grow;
      g.moveTo(p[0] + r, p[1]); g.arc(p[0], p[1], r, 0, TAU);
      if (i + 1 < pts.length) {
        const q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
        if (L < 1e-6) continue;
        const r2 = q[2] + grow, nx = -dy / L, ny = dx / L;
        // mesmo sentido dos arcos (horário), senão a regra nonzero abre um buraco onde eles se cruzam
        g.moveTo(p[0] - nx * r, p[1] - ny * r); g.lineTo(q[0] - nx * r2, q[1] - ny * r2);
        g.lineTo(q[0] + nx * r2, q[1] + ny * r2); g.lineTo(p[0] + nx * r, p[1] + ny * r); g.closePath();
      }
    }
  }
  function plateEdge(g, pts, k, side) {     // faixa paralela à linha dos nós, a k*raio do centro
    g.beginPath();
    for (let i = 0; i + 1 < pts.length; i++) {
      const p = pts[i], q = pts[i + 1], dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      let nx = dy / L, ny = -dx / L;
      if (ny > 0) { nx = -nx; ny = -ny; }
      nx *= side; ny *= side;
      g.moveTo(p[0] + nx * p[2] * k, p[1] + ny * p[2] * k); g.lineTo(q[0] + nx * q[2] * k, q[1] + ny * q[2] * k);
    }
  }
  // Rig.plate(g, pts, col, {ol, hi=true, shade=true, side=1}): braço/lança de chapa. pts = [[x,y,raio], ...] (2+ nós);
  //   a largura varia de nó a nó (grosso no meio, fino nas pontas = nada de "vara"); side=-1 troca o lado da luz
  Rig.plate = function (g, pts, col, o) {
    o = o || NO;
    const ol = olW(o), side = o.side || 1;
    g.lineJoin = 'round';
    if (ol > 0) { platePath(g, pts, ol); g.fillStyle = LINE; g.fill(); }
    platePath(g, pts, 0); g.fillStyle = col; g.fill();
    if (o.hi === false && o.shade === false) return;
    let rm = 0;
    for (let i = 0; i < pts.length; i++) if (pts[i][2] > rm) rm = pts[i][2];
    g.save(); platePath(g, pts, 0); g.clip();
    g.lineCap = 'butt';
    if (o.shade !== false) { plateEdge(g, pts, 0.78, -side); g.strokeStyle = typeof o.shade === 'string' ? o.shade : sh(col, -0.22); g.lineWidth = rm * 0.5; g.stroke(); }
    if (o.hi !== false) { plateEdge(g, pts, 0.8, side); g.strokeStyle = typeof o.hi === 'string' ? o.hi : sh(col, 0.3); g.lineWidth = rm * 0.4; g.stroke(); }
    g.restore();
  };

  // Rig.mound(g, x, y, hw, h, {col=arroz, shade, ol, grains=true}): montinho (de arroz) com base em (x,y), meia-largura hw e altura h
  Rig.mound = function (g, x, y, hw, h, o) {
    o = o || NO;
    const col = o.col || PAL.rice, lo = o.shade || PAL.riceS, ol = olW(o) * 0.8;
    g.beginPath();
    g.moveTo(x - hw, y); g.bezierCurveTo(x - hw * 0.72, y - h * 1.32, x + hw * 0.72, y - h * 1.32, x + hw, y); g.closePath();
    if (ol > 0) { g.strokeStyle = LINE; g.lineWidth = ol * 2; g.lineJoin = 'round'; g.stroke(); }
    g.fillStyle = lo; g.fill();
    g.beginPath();
    g.moveTo(x - hw, y); g.bezierCurveTo(x - hw * 0.74, y - h * 1.3, x + hw * 0.3, y - h * 1.36, x + hw * 0.52, y); g.closePath();
    g.fillStyle = col; g.fill();
    if (o.grains !== false && hw > 3) {
      g.fillStyle = PAL.riceD;
      g.fillRect(x + hw * 0.3, y - h * 0.3, hw * 0.16, Math.max(0.7, h * 0.07));
      g.fillRect(x - hw * 0.1, y - h * 0.52, hw * 0.14, Math.max(0.7, h * 0.07));
      g.fillRect(x - hw * 0.55, y - h * 0.2, hw * 0.14, Math.max(0.7, h * 0.07));
      g.fillStyle = PAL.white;
      g.fillRect(x - hw * 0.34, y - h * 0.72, hw * 0.26, Math.max(0.8, h * 0.09));
    }
  };

  const BK_LOADER = [[-7, -22], [5, -27], [10, -23], [34, 3], [31, 8], [5, 9], [-4, 6], [-8, -2]];
  const BK_EXC = [[-5, -3], [-1, -12], [9, -17], [20, -14], [27, -5], [29, 2], [22, 3], [5, 4], [-3, 3]];
  const bkPts = [], bkO = { ol: undefined }, moundO = { col: null, shade: null, ol: undefined }, pulO = { col: null };
  // Rig.bucket(g, s, {kind='loader'|'excavator', col, load=0..1, teeth=true, cargo=cor, ol}): caçamba de perfil com o pino em (0,0)
  //   loader: comprimento ~s, boca pra cima/frente (+x); excavator: eixo x = pino -> dente (comprimento s), boca do lado +y
  Rig.bucket = function (g, s, o) {
    o = o || NO;
    const exc = o.kind === 'excavator', src = exc ? BK_EXC : BK_LOADER, k = s / (exc ? 29 : 34);
    const col = o.col || PAL.yel, load = o.load || 0, ol = olW(o);
    while (bkPts.length < src.length) bkPts.push([0, 0]);
    bkPts.length = src.length;
    for (let i = 0; i < src.length; i++) { bkPts[i][0] = src[i][0] * k; bkPts[i][1] = src[i][1] * k; }
    // carga aparecendo pela boca (atrás da chapa lateral)
    if (load > 0.02) {
      const a = exc ? src[7] : src[2], b = exc ? src[5] : src[3];   // boca: do fundo/topo até o dente
      const ax = a[0] * k, ay = a[1] * k, bx = b[0] * k, by = b[1] * k, L = Math.hypot(bx - ax, by - ay);
      let nx = (by - ay) / L, ny = -(bx - ax) / L;
      if (exc) { nx = -nx; ny = -ny; }
      const hgt = L * 0.42 * load, mx = (ax + bx) / 2, my = (ay + by) / 2;
      g.beginPath(); g.moveTo(ax, ay);
      g.quadraticCurveTo(mx + nx * hgt * 2 - (bx - ax) * 0.12, my + ny * hgt * 2 - (by - ay) * 0.12, bx - (bx - ax) * 0.06, by - (by - ay) * 0.06);
      g.lineTo(mx - nx * L * 0.2, my - ny * L * 0.2); g.closePath();
      g.lineJoin = 'round'; g.strokeStyle = LINE; g.lineWidth = ol * 1.6; g.stroke();
      g.fillStyle = o.cargo || PAL.rice; g.fill();
      g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx + nx * hgt * 1.5 + (bx - ax) * 0.2, my + ny * hgt * 1.5 + (by - ay) * 0.2, bx - (bx - ax) * 0.06, by - (by - ay) * 0.06); g.closePath();
      g.fillStyle = o.cargoShade || PAL.riceS; g.fill();
    }
    // dentes
    if (o.teeth !== false) {
      const t = exc ? src[5] : src[3], tx = t[0] * k, ty = t[1] * k;
      g.beginPath();
      if (exc) { g.moveTo(tx - 4 * k, ty - 4 * k); g.lineTo(tx + 5 * k, ty + 4 * k); g.lineTo(tx - 5 * k, ty + 1 * k); }
      else { g.moveTo(tx - 4 * k, ty - 2 * k); g.lineTo(tx + 7 * k, ty + 3 * k); g.lineTo(tx - 3 * k, ty + 4 * k); }
      g.closePath();
      g.lineJoin = 'round'; g.strokeStyle = LINE; g.lineWidth = ol * 2; g.stroke();
      g.fillStyle = PAL.steel; g.fill();
    }
    bkO.ol = o.ol; Draw.poly(g, bkPts, col, bkO);
    // volume: sombra na barriga, luz na borda de cima, reforço da boca
    g.save();
    g.beginPath(); for (let i = 0; i < bkPts.length; i++) { if (i) g.lineTo(bkPts[i][0], bkPts[i][1]); else g.moveTo(bkPts[0][0], bkPts[0][1]); }
    g.closePath(); g.clip();
    g.lineCap = 'butt';
    if (exc) {
      g.strokeStyle = sh(col, -0.24); g.lineWidth = 5 * k;
      g.beginPath(); g.moveTo(-1 * k, -12 * k); g.quadraticCurveTo(12 * k, -20 * k, 22 * k, -13 * k); g.quadraticCurveTo(28 * k, -8 * k, 30 * k, 0); g.stroke();
      g.strokeStyle = sh(col, 0.3); g.lineWidth = 2.4 * k;
      g.beginPath(); g.moveTo(-3 * k, 2.4 * k); g.lineTo(26 * k, 2 * k); g.stroke();
    } else {
      g.strokeStyle = sh(col, -0.24); g.lineWidth = 6 * k;
      g.beginPath(); g.moveTo(-9 * k, -4 * k); g.quadraticCurveTo(-6 * k, 8.5 * k, 6 * k, 8.5 * k); g.lineTo(32 * k, 8 * k); g.stroke();
      g.strokeStyle = sh(col, 0.3); g.lineWidth = 3 * k;
      g.beginPath(); g.moveTo(-7 * k, -21 * k); g.lineTo(5 * k, -26 * k); g.lineTo(10.5 * k, -22 * k); g.lineTo(34 * k, 4 * k); g.stroke();
    }
    g.restore();
  };

  // Rig.pulley(g, x, y, r, rot, {col=amarelo, holes=4, ol}): polia/roldana com furos que giram (rot em radianos)
  Rig.pulley = function (g, x, y, r, rot, o) {
    o = o || NO;
    const col = o.col || PAL.yel, ol = olW(o) * 0.75, holes = o.holes !== undefined ? o.holes : 4;
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, r + ol, 0, TAU); g.fill();
    g.fillStyle = sh(col, -0.26); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    g.fillStyle = col; g.beginPath(); g.arc(x - r * 0.07, y - r * 0.09, r * 0.88, 0, TAU); g.fill();
    g.strokeStyle = sh(col, -0.3); g.lineWidth = Math.max(0.6, r * 0.1);
    g.beginPath(); g.arc(x, y, r * 0.78, 0, TAU); g.stroke();
    if (holes > 0 && r * (Draw.zoom || 1) > 2.5) {
      const hr = r * 0.17, hd = r * 0.46;
      g.fillStyle = LINE; g.beginPath();
      for (let i = 0; i < holes; i++) {
        const a = rot + i / holes * TAU, hx = x + Math.cos(a) * hd, hy = y + Math.sin(a) * hd;
        g.moveTo(hx + hr, hy); g.arc(hx, hy, hr, 0, TAU);
      }
      g.fill();
    }
    g.fillStyle = LINE; g.beginPath(); g.arc(x, y, r * 0.24 + ol * 0.4, 0, TAU); g.fill();
    g.fillStyle = PAL.steelL; g.beginPath(); g.arc(x, y, r * 0.2, 0, TAU); g.fill();
  };

  /* ======================================================================
     5. Rope — cabo que passa por polias
     ====================================================================== */
  // E.Rope({pts:[{x,y,r=0,over=1,sag}], lw=1.5, col=LINE, sag=0, pulleys=true, pulleyCol, fixed='end'|'start'}) -> rope
  //   pts: primeiro e último são as pontas (r=0) ou tambores (r>0); os do meio são polias de raio r.
  //   over=1: o cabo passa por CIMA da polia quando vai da esquerda pra direita; -1 por baixo.
  //   (indo da direita pra esquerda inverte: over=-1 passa por cima.)
  //   Mexa em rope.pts[i].x/.y a cada frame e chame update(dt): calcula as tangentes, o comprimento (rope.length),
  //   o cabo pago desde o início (rope.payout) e gira cada polia pelo cabo que passou nela (pts[i].rot).
  //   fixed='end': o cabo corre a partir do tambor (pts[0]) e a ponta final está presa na carga; 'start' é o contrário.
  //   sag: barriga (unidades no meio do vão) pros vãos frouxos; pts[i].sag vale pro vão que sai do ponto i. rope.sway = mola de balanço lateral.
  function Rope(o) {
    o = o || NO;
    const src = o.pts || [], n = src.length;
    const pts = src.map(p => ({ x: p.x || 0, y: p.y || 0, r: p.r || 0, over: p.over === undefined ? 1 : p.over, sag: p.sag, rot: 0,
      ix: 0, iy: 0, ox: 0, oy: 0, a0: 0, sweep: 0, seg: 0, down: 0, pdown: NaN }));
    const rope = {
      pts, lw: o.lw || 1.5, col: o.col || LINE, sag: o.sag || 0, ol: o.ol || 0,
      pulleys: o.pulleys !== false, pulleyCol: o.pulleyCol || PAL.yel, fixed: o.fixed || 'end',
      length: 0, length0: NaN, payout: 0, speed: 0,
      sway: Spring(0, { k: o.swayK !== undefined ? o.swayK : 50, d: o.swayD !== undefined ? o.swayD : 4 }),
      pvx: 0, plx: NaN,
      // solve(): recalcula tangentes e comprimentos (sem girar polias)
      solve() {
        let total = 0;
        for (let i = 0; i + 1 < n; i++) {
          const p = pts[i], q = pts[i + 1], dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1e-6;
          const c = p.over * p.r - q.over * q.r, th = Math.acos(clamp(c / L, -1, 1));
          const b = Math.atan2(dy, dx) - th, nx = Math.cos(b), ny = Math.sin(b);
          p.ox = p.x + p.over * p.r * nx; p.oy = p.y + p.over * p.r * ny;
          q.ix = q.x + q.over * q.r * nx; q.iy = q.y + q.over * q.r * ny;
          p.seg = Math.hypot(q.ix - p.ox, q.iy - p.oy);
          total += p.seg;
        }
        for (let i = 1; i + 1 < n; i++) {
          const p = pts[i];
          if (!(p.r > 0)) { p.sweep = 0; continue; }
          const a0 = Math.atan2(p.iy - p.y, p.ix - p.x), a1 = Math.atan2(p.oy - p.y, p.ox - p.x);
          let sw = p.over > 0 ? a1 - a0 : a0 - a1;
          sw = ((sw % TAU) + TAU) % TAU;
          if (sw > TAU * 0.8) sw = 0;          // quase zero dando a volta: não abraça
          p.a0 = a0; p.sweep = sw;
          total += sw * p.r;
        }
        // comprimento a jusante de cada ponto (pra girar as polias)
        let acc = 0;
        for (let i = n - 1; i >= 0; i--) {
          const p = pts[i];
          if (i < n - 1) acc += p.seg;
          p.down = acc;
          if (i > 0 && i < n - 1) acc += p.sweep * p.r;
        }
        rope.length = total;
        return rope;
      },
      // update(dt): solve + gira polias pelo cabo que passou + balanço
      update(dt) {
        rope.solve();
        if (rope.length0 !== rope.length0) rope.length0 = rope.length;
        const prev = rope.payout;
        rope.payout = rope.length - rope.length0;
        rope.speed = dt > 0 ? (rope.payout - prev) / dt : 0;
        const fromStart = rope.fixed !== 'start';
        for (let i = 0; i < n; i++) {
          const p = pts[i];
          const run = fromStart ? p.down : rope.length - p.down;
          if (p.pdown === p.pdown && p.r > 0) p.rot += (fromStart ? 1 : -1) * p.over * (run - p.pdown) / p.r;
          p.pdown = run;
        }
        const last = pts[n - 1];
        if (last && dt > 0) {
          const vx = rope.plx === rope.plx ? (last.x - rope.plx) / dt : 0;
          rope.sway.kick(-(vx - rope.pvx) * 0.05);
          rope.pvx = vx; rope.plx = last.x;
        }
        rope.sway.update(dt);
        return rope;
      },
      // draw(g): cabo (com barriga/balanço) e as polias por cima
      draw(g) {
        if (n < 2) return;
        const m = (Draw.minPx || 0) / (Draw.zoom || 1), lw = rope.lw > m ? rope.lw : m, sway = rope.sway.x;
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(pts[0].ox, pts[0].oy);
        for (let i = 0; i + 1 < n; i++) {
          const p = pts[i], q = pts[i + 1], sag = p.sag !== undefined ? p.sag : rope.sag;
          const sw = sway * Math.min(1, p.seg / 60);
          if (sag || Math.abs(sw) > 0.05) g.quadraticCurveTo((p.ox + q.ix) / 2 + sw * 2, (p.oy + q.iy) / 2 + sag * 2, q.ix, q.iy);
          else g.lineTo(q.ix, q.iy);
          if (i + 2 < n && q.r > 0 && q.sweep > 0) g.arc(q.x, q.y, q.r, q.a0, q.a0 + (q.over > 0 ? q.sweep : -q.sweep), q.over < 0);
        }
        if (rope.ol > 0) { g.strokeStyle = LINE; g.lineWidth = lw + rope.ol * 2; g.stroke(); }
        g.strokeStyle = rope.col; g.lineWidth = lw; g.stroke();
        if (rope.pulleys) for (let i = 0; i < n; i++) { const p = pts[i]; if (p.r > 0 && p.draw !== false) { pulO.col = p.col || rope.pulleyCol; Rig.pulley(g, p.x, p.y, p.r + lw * 0.9, p.rot, pulO); } }
      },
    };
    rope.solve();
    return rope;
  }

  /* ======================================================================
     6. Telescope — mastro/cilindro telescópico
     ====================================================================== */
  // E.Telescope({stages=2, len=40, w=8, overlap=.2, taper=.74, col, cols, rod, sequential=false}) -> tel
  //   estágio 0 é o de fora (fixo na base); cada estágio seguinte desliza pra fora. tel.ext = 0..1 (ou passe no draw).
  //   draw(g, x, y, ang, ext?) desenha a partir da base (x,y) apontando pra 'ang' (-PI/2 = pra cima);
  //   tip(x, y, ang, out?) -> {x,y} ponta; stage(i, x, y, ang, out?) -> topo do estágio i; length() comprimento atual; max
  //   sequential: estende um estágio de cada vez (cilindro de basculante); cols = cores por estágio; rod = cor do último (haste cromada)
  function Telescope(o) {
    o = o || NO;
    const n = Math.max(1, o.stages || 2), len = o.len || 40, w = o.w || 8, ov = o.overlap !== undefined ? o.overlap : 0.2;
    const taper = o.taper || 0.74, col = o.col || PAL.yel, seq = !!o.sequential;
    const collar = Math.max(2, w * 0.34), step0 = collar * 1.25, step1 = len * (1 - ov);
    const cols = [];
    for (let i = 0; i < n; i++) cols.push(o.cols && o.cols[i] ? o.cols[i] : i === n - 1 && n > 1 && o.rod !== false ? (o.rod || PAL.steelL) : i === 0 ? col : mixc(col, PAL.steel, Math.min(0.75, 0.38 * i)));
    const boxO = { ol: undefined, top: undefined, shade: undefined };
    const tel = {
      stages: n, len, w, ext: 0, max: (n - 1) * step1 + len, min: (n - 1) * step0 + len,
      // offset(i, ext?) -> distância da base até o início do estágio i
      offset(i, ext) {
        ext = clamp(ext === undefined ? tel.ext : ext, 0, 1);
        let off = 0;
        for (let k = 1; k <= i; k++) off += U.lerp(step0, step1, seq ? clamp(ext * (n - 1) - (k - 1), 0, 1) : ext);
        return off;
      },
      // length(ext?) -> comprimento total atual
      length(ext) { return tel.offset(n - 1, ext) + len; },
      // tip(x, y, ang, out?, ext?) -> {x,y}
      tip(x, y, ang, out, ext) { return tel.stage(n - 1, x, y, ang, out, ext); },
      // stage(i, x, y, ang, out?, ext?) -> {x,y}: topo do estágio i
      stage(i, x, y, ang, out, ext) {
        out = out || {};
        const d = tel.offset(i, ext) + len;
        out.x = x + Math.cos(ang) * d; out.y = y + Math.sin(ang) * d;
        return out;
      },
      // draw(g, x, y, ang, ext?)
      draw(g, x, y, ang, ext) {
        boxO.ol = o.ol;
        g.save(); g.translate(x, y); g.rotate(ang);
        if (Math.cos(ang) < -0.01) g.scale(1, -1);
        for (let i = n - 1; i >= 0; i--) {
          const wi = w * Math.pow(taper, i), off = tel.offset(i, ext), c = cols[i];
          Draw.box(g, off, -wi / 2, len, wi, c, boxO);
          if (i < n - 1 || n === 1) Draw.box(g, off + len - collar, -wi * 0.62, collar, wi * 1.24, sh(c, -0.12), boxO);   // colar/gaxeta
          else Draw.box(g, off + len - collar * 0.7, -wi * 0.6, collar * 0.7, wi * 1.2, sh(c, -0.2), boxO);                 // cabeça
        }
        g.restore();
      },
    };
    return tel;
  }

  /* ======================================================================
     7. Chassis — rodas no terreno, inclinação e suspensão
     ====================================================================== */
  // E.Chassis({wheels:[{x, r, travel=5}], floor(x)->y, k=150, d=13, tiltK=110, tiltD=11, squat=.0016, face=1}) -> ch
  //   update(dt, x, face?): apoia cada roda no chão (encosta no ponto mais alto embaixo dela), tira daí a altura e a inclinação
  //   da carroceria (com molas: atrasa, afunda e balança) e a compressão de cada suspensão.
  //   Saída: ch.x, ch.y, ch.tilt (use em rig.draw(g, ch.x, ch.y, {rot: ch.tilt, face})), ch.vx, ch.ax,
  //          ch.wheels[i] = {lx, ly (posição no MODELO pra peça da roda), rot, comp (>0 comprimida), wx, wy (mundo)}
  //   squat: quanto a aceleração empina/mergulha a carroceria; ch.load = peso extra (afunda 'load' unidades);
  //   ch.bias = inclinação extra em rad (>0 = nariz pra baixo: carga pendurada na frente);
  //   bump(v) tranco vertical, nod(v) tranco de inclinação (ex.: caçamba bateu no monte)
  function Chassis(o) {
    o = o || NO;
    const floorF = typeof o.floor === 'function' ? o.floor : () => o.floor || 0;
    const wheels = (o.wheels || []).map(w => ({ x: w.x || 0, r: w.r || 10, travel: w.travel !== undefined ? w.travel : 5,
      lx: w.x || 0, ly: -(w.r || 10), rot: 0, comp: 0, wx: 0, wy: 0 }));
    let iL = 0, iR = 0;
    for (let i = 0; i < wheels.length; i++) { if (wheels[i].x < wheels[iL].x) iL = i; if (wheels[i].x > wheels[iR].x) iR = i; }
    const ch = {
      wheels, floor: floorF, x: 0, y: 0, tilt: 0, vx: 0, ax: 0, face: o.face || 1, load: 0, bias: 0,
      squat: o.squat !== undefined ? o.squat : 0.0016,
      heave: Spring(0, { k: o.k !== undefined ? o.k : 150, d: o.d !== undefined ? o.d : 13 }),
      lean: Spring(0, { k: o.tiltK !== undefined ? o.tiltK : 110, d: o.tiltD !== undefined ? o.tiltD : 11 }),
      started: false,
      // bump(v): tranco vertical (v>0 afunda)
      bump(v) { ch.heave.kick(v); return ch; },
      // nod(v): tranco de inclinação (rad/s; v>0 gira no sentido horário da tela)
      nod(v) { ch.lean.kick(v); return ch; },
      // update(dt, x, face?)
      update(dt, x, face) {
        if (face !== undefined) ch.face = face;
        const f = ch.face < 0 ? -1 : 1;
        let dx = ch.started ? x - ch.x : 0;
        if (Math.abs(dx) > 240) dx = 0;                        // teleporte: não vira velocidade
        const vx = dt > 0 ? dx / dt : 0;
        ch.ax = dt > 0 ? U.lerp(ch.ax, (vx - ch.vx) / dt, 0.35) : 0;
        ch.vx = vx; ch.x = x;
        for (let i = 0; i < wheels.length; i++) {
          const w = wheels[i], cx = x + f * w.x, r = w.r;
          let cy = Infinity;
          for (let k = -2; k <= 2; k++) {                      // a roda apoia no calombo mais alto embaixo dela
            const ox = k * 0.36 * r, y = floorF(cx + ox) - Math.sqrt(r * r - ox * ox);
            if (y < cy) cy = y;
          }
          w.wx = cx; w.wy = cy;
          w.rot += f * dx / r;
        }
        let Y = 0, T = 0;
        if (wheels.length) {
          const a = wheels[f > 0 ? iL : iR], b = wheels[f > 0 ? iR : iL];   // a = mais à esquerda no mundo
          const ya = a.wy + a.r, yb = b.wy + b.r, span = b.wx - a.wx;
          if (span > 1e-3) { T = Math.atan2(yb - ya, span); Y = ya + (x - a.wx) * (yb - ya) / span; }
          else Y = ya;
        }
                T += f * ch.bias;
        if (!ch.started) { ch.heave.snap(Y + ch.load); ch.lean.snap(T); ch.started = true; }
        ch.heave.target = Y + ch.load; ch.lean.target = T;
        ch.lean.kick(-ch.ax * ch.squat * dt);
        ch.y = ch.heave.update(dt); ch.tilt = ch.lean.update(dt);
        const c = Math.cos(ch.tilt), s = Math.sin(ch.tilt);
        for (let i = 0; i < wheels.length; i++) {
          const w = wheels[i], ddx = w.wx - ch.x, ddy = w.wy - ch.y;
          const ly = -ddx * s + ddy * c;
          w.comp = clamp(-w.r - ly, -w.travel, w.travel);
          w.lx = w.x; w.ly = -w.r - w.comp;
        }
        return ch;
      },
    };
    return ch;
  }

  /* ======================================================================
     8. Exhaust — escapamento em pulsos
     ====================================================================== */
  // E.Exhaust({max=28, col, size=3, rate=5, rise=34, wind=0, life=1.3, ol=true}) -> ex
  //   update(dt, x, y, power=0, dirX=0, dirY=-1): solta baforadas ritmadas na boca do cano (x,y no mundo); power 0..1 acelera o
  //   ritmo, engrossa e escurece a fumaça. ex.pulse = 1 no instante da baforada e decai (use pra tremer capô/tampa do cano).
  //   burst(n, power?) solta n de uma vez (arrancada). draw(g) desenha no mundo (chame fora do rig).
  function Exhaust(o) {
    o = o || NO;
    const max = o.max || 28, F = 8;                       // x, y, vx, vy, idade, vida, tamanho, tom
    const D = new Float32Array(max * F);
    const col = o.col || PAL.grayL, colD = o.colD || PAL.gray;
    const tones = [0, 1, 2, 3].map(i => mixc(col, colD, i / 3));
    const tonesL = tones.map(c => sh(c, 0.35)), tonesO = tones.map(c => mixc(c, LINE, 0.45));
    let head = 0, acc = 0, lx = 0, ly = 0, ldx = 0, ldy = -1, lpow = 0;
    function spawn(x, y, dx, dy, power) {
      const i = head * F; head = (head + 1) % max;
      const sp = 26 + 70 * power + Math.random() * 14;
      D[i] = x; D[i + 1] = y;
      D[i + 2] = dx * sp + (Math.random() - 0.5) * 12; D[i + 3] = dy * sp + (Math.random() - 0.5) * 8;
      D[i + 4] = 0; D[i + 5] = ex.life * (0.75 + Math.random() * 0.5) * (1 + power * 0.35);
      D[i + 6] = ex.size * (0.8 + Math.random() * 0.45) * (1 + power * 0.8);
      D[i + 7] = Math.min(3, Math.round(power * 3 + Math.random() * 0.8));
    }
    const ex = {
      size: o.size || 3, rate: o.rate || 5, rise: o.rise !== undefined ? o.rise : 34, wind: o.wind || 0,
      life: o.life || 1.3, pulse: 0, count: 0, ol: o.ol !== false,
      // update(dt, x, y, power=0, dirX=0, dirY=-1)
      update(dt, x, y, power, dx, dy) {
        power = clamp(power || 0, 0, 1);
        lx = x; ly = y; ldx = dx || 0; ldy = dy === undefined ? -1 : dy; lpow = power;
        ex.pulse = Math.max(0, ex.pulse - dt * 7);
        acc += dt * ex.rate * (1 + power * 2.4);
        while (acc >= 1) { acc -= 1; spawn(x, y, ldx, ldy, power); ex.pulse = 1; }
        const drag = Math.exp(-2.6 * dt);
        let cnt = 0;
        for (let i = 0; i < max * F; i += F) {
          if (!(D[i + 5] > 0)) continue;
          D[i + 4] += dt;
          if (D[i + 4] >= D[i + 5]) { D[i + 5] = 0; continue; }
          D[i + 2] = D[i + 2] * drag + ex.wind * dt; D[i + 3] = D[i + 3] * drag - ex.rise * dt;
          D[i] += D[i + 2] * dt; D[i + 1] += D[i + 3] * dt;
          cnt++;
        }
        ex.count = cnt;
      },
      // burst(n, power=1): baforada grossa (arrancada, esforço)
      burst(n, power) { for (let i = 0; i < n; i++) spawn(lx, ly, ldx, ldy, power === undefined ? 1 : power); ex.pulse = 1; },
      // clear()
      clear() { D.fill(0); ex.count = 0; },
      // draw(g)
      draw(g) {
        const ol = ex.ol ? Math.max(0.7, olW(NO) * 0.45) : 0;
        for (let pass = 0; pass < 3; pass++) {              // 3 passes (contorno, base, luz) pra fumaça fundir numa nuvem só
          if (pass === 0 && !ol) continue;
          for (let k = 0; k < max; k++) {
            const i = ((head + k) % max) * F;               // do mais velho pro mais novo
            if (!(D[i + 5] > 0)) continue;
            const u = D[i + 4] / D[i + 5], tone = D[i + 7] | 0;
            const grow = 0.55 + 1.7 * (1 - (1 - u) * (1 - u)), fade = u > 0.6 ? 1 - (u - 0.6) / 0.4 : 1;
            const r = D[i + 6] * grow * (0.35 + 0.65 * fade);
            if (r < 0.3) continue;
            const x = D[i], y = D[i + 1];
            g.beginPath();
            if (pass === 0) { g.fillStyle = tonesO[tone]; g.arc(x, y, r + ol, 0, TAU); }
            else if (pass === 1) { g.fillStyle = tones[tone]; g.arc(x, y, r, 0, TAU); }
            else { g.fillStyle = tonesL[tone]; g.arc(x - r * 0.22, y - r * 0.26, r * 0.55, 0, TAU); }
            g.fill();
          }
        }
      },
    };
    return ex;
  }

  /* ======================================================================
     9. Conveyor — esteira transportadora
     ====================================================================== */
  const cvP = { x: 0, y: 0, nx: 0, ny: -1, ang: 0 };
  const legA = [[0, 0], [0, 0]], legO = { ol: undefined, cap: 'butt' };

  // E.Conveyor(pts, {w=10, speed=60, col, frame, items=true, legs=true, floor, rollers, accel=3, cargo, cargoShade, maxV=2.2, drawItem}) -> cv
  //   pts = [[x,y], ...] linha de centro da correia (do carregamento até a ponta de despejo). speed em unidades/s (negativo inverte).
  //   put(v=1, s=0): põe um montinho de volume v a s unidades do início (funde com o vizinho se cair em cima);
  //   onDrop(fn(v, x, y, vx, vy)): chamado quando um montinho cai da ponta; end() -> {x,y} ponto de queda; start() -> {x,y} de carga;
  //   running (liga/desliga com rampa), v (velocidade atual), phase, load (volume em cima), count, length, pointAt(s) -> {x,y,nx,ny,ang};
  //   floor (número ou fn(x)->y) = onde os pés de apoio encostam; drawItem(g, x, y, v, ang, item) troca o desenho da carga;
  //   draw(g, t) desenha tudo; ou em camadas: drawBack(g) (pés/estrutura), drawBelt(g), drawItems(g)
  function Conveyor(pts, o) {
    o = o || NO;
    const w = o.w || 10, belt = o.col || PAL.blk, frame = o.frame || PAL.yel;
    const bt = Math.max(1.4, w * 0.2), R = w / 2, ri = R - bt;
    const n = pts.length, segs = [];
    let length = 0;
    for (let i = 0; i + 1 < n; i++) {
      const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy) || 1e-6;
      segs.push({ x: pts[i][0], y: pts[i][1], ux: dx / L, uy: dy / L, len: L, s0: length });
      length += L;
    }
    const per = 2 * length + TAU * R;
    const tickGap = per / Math.max(6, Math.round(per / (o.tread || Math.max(7, w * 0.8))));
    const rollGap = length / Math.max(1, Math.round(length / (o.rollers || w * 1.9)));
    const floorF = o.floor === undefined ? null : typeof o.floor === 'function' ? o.floor : () => o.floor;
    const framePts = pts.map((p, i) => {                 // longarina logo abaixo da correia
      const s = segs[Math.min(i, segs.length - 1)], s2 = segs[Math.max(0, i - 1)];
      let nx = -(s.uy + s2.uy), ny = s.ux + s2.ux; const L = Math.hypot(nx, ny) || 1; nx /= L; ny /= L;
      if (ny < 0) { nx = -nx; ny = -ny; }
      return [p[0] + nx * R * 1.3, p[1] + ny * R * 1.3];
    });
    const legs = [];
    if (o.legs !== false && floorF) {
      const gap = o.legGap || 70;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], k = Math.max(1, Math.round(s.len / gap));
        for (let j = i === 0 ? 0 : 1; j <= k; j++) {
          const d = s.len * j / k, edge = (i === 0 && j === 0) || (i === segs.length - 1 && j === k);
          const d2 = edge ? (j === 0 ? Math.min(R * 1.6, s.len / 2) : s.len - Math.min(R * 1.6, s.len / 2)) : d;
          legs.push([s.x + s.ux * d2, s.y + s.uy * d2 + R * 1.2]);
        }
      }
    }
    const items = [], free = [], drops = [];

    // ponto na linha de centro a s unidades do início (extrapola nas pontas)
    function pointAt(s, out) {
      out = out || cvP;
      let k = 0;
      while (k < segs.length - 1 && s > segs[k].s0 + segs[k].len) k++;
      const sg = segs[k], d = s - sg.s0;
      out.x = sg.x + sg.ux * d; out.y = sg.y + sg.uy * d;
      out.nx = sg.uy; out.ny = -sg.ux;                    // normal do lado da carga (pra cima)
      if (out.ny > 0) { out.nx = -out.nx; out.ny = -out.ny; }
      out.ang = Math.atan2(sg.uy, sg.ux);
      return out;
    }
    // ponto no laço da correia: u anda por cima (0..L), dá a volta no tambor final, volta por baixo e fecha no tambor inicial
    function loopAt(u, out) {
      u = ((u % per) + per) % per;
      const arc = PI * R, a = segs[0], z = segs[segs.length - 1];
      if (u < length) { pointAt(u, out); return out; }
      if (u < length + arc) {
        const th = (u - length) / R, b = Math.atan2(z.uy, z.ux) - PI / 2 + th;
        out.x = pts[n - 1][0]; out.y = pts[n - 1][1]; out.nx = Math.cos(b); out.ny = Math.sin(b);
        return out;
      }
      if (u < 2 * length + arc) { pointAt(length - (u - length - arc), out); out.nx = -out.nx; out.ny = -out.ny; return out; }
      const th = (u - 2 * length - arc) / R, b = Math.atan2(a.uy, a.ux) + PI / 2 + th;
      out.x = pts[0][0]; out.y = pts[0][1]; out.nx = Math.cos(b); out.ny = Math.sin(b);
      return out;
    }
    function beltPath(g) {
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) g.lineTo(pts[i][0], pts[i][1]);
    }
    function drop(it, atEnd) {
      const sg = atEnd ? segs[segs.length - 1] : segs[0], dir = atEnd ? 1 : -1;
      const p = atEnd ? pts[n - 1] : pts[0];
      const x = p[0] + sg.ux * dir * R * 0.9, y = p[1] + sg.uy * dir * R * 0.9 - R * 0.4;
      const vx = sg.ux * cv.v, vy = sg.uy * cv.v;
      for (let i = 0; i < drops.length; i++) drops[i](it.v, x, y, vx, vy, it);
      cv.dropped += it.v;
    }

    const cv = {
      pts, w, speed: o.speed !== undefined ? o.speed : 60, running: true, v: 0, phase: 0, length, load: 0, count: 0, dropped: 0,
      accel: o.accel || 3, items, showItems: o.items !== false, maxV: o.maxV || 2.2,
      cargo: o.cargo || PAL.rice, cargoShade: o.cargoShade || PAL.riceS, drawItem: o.drawItem || null,
      pointAt,
      // put(v=1, s=0) -> item: carrega um montinho
      put(v, s) {
        v = v === undefined ? 1 : v; s = s || 0;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          if (Math.abs(it.s - s) < w * 0.75 && it.v + v <= cv.maxV) { it.v += v; it.pop = 0.55; return it; }
        }
        const it = free.pop() || { s: 0, v: 0, pop: 0, seed: 0 };
        it.s = s; it.v = v; it.pop = 0; it.seed = Math.random();
        items.push(it);
        return it;
      },
      // onDrop(fn(v, x, y, vx, vy, item)) -> cv
      onDrop(fn) { drops.push(fn); return cv; },
      // end(out?) -> {x,y}: ponto onde a carga cai (frente do tambor final)
      end(out) {
        out = out || {};
        const z = segs[segs.length - 1];
        out.x = pts[n - 1][0] + z.ux * R * 0.9; out.y = pts[n - 1][1] + z.uy * R * 0.9 - R * 0.4;
        return out;
      },
      // start(out?) -> {x,y}: ponto de carregamento (em cima da correia, no começo)
      start(out) { out = out || {}; pointAt(0); out.x = cvP.x + cvP.nx * R; out.y = cvP.y + cvP.ny * R; return out; },
      // clear(): tira toda a carga
      clear() { while (items.length) free.push(items.pop()); cv.load = 0; cv.count = 0; },
      // update(dt): anda a correia (rampa de partida/parada) e a carga; despeja o que chega na ponta
      update(dt) {
        cv.v = U.damp(cv.v, cv.running ? cv.speed : 0, cv.accel, dt);
        const ds = cv.v * dt;
        cv.phase += ds;
        let load = 0;
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.s += ds;
          if (it.pop < 1) it.pop = Math.min(1, it.pop + dt * 5);
          if (it.s > length || it.s < 0) {
            drop(it, it.s > length);
            items[i] = items[items.length - 1]; items.pop(); free.push(it);
            continue;
          }
          load += it.v;
        }
        cv.load = load; cv.count = items.length;
      },
      // drawBack(g): pés de apoio e longarina
      drawBack(g) {
        legO.ol = o.ol;
        if (floorF) {
          for (let i = 0; i < legs.length; i++) {
            const l = legs[i], fy = floorF(l[0]);
            if (fy - l[1] < 2) continue;
            legA[0][0] = l[0]; legA[0][1] = l[1]; legA[1][0] = l[0]; legA[1][1] = fy;
            Draw.beam(g, legA, Math.max(2.4, w * 0.3), PAL.steelD, legO);
            Draw.box(g, l[0] - w * 0.45, fy - 2.2, w * 0.9, 2.2, PAL.grayD, legO);
            if (fy - l[1] > w * 2.4) Draw.box(g, l[0] - w * 0.3, l[1] + (fy - l[1]) * 0.45, w * 0.6, 2, PAL.grayD, legO);
          }
        }
        Draw.beam(g, framePts, R, frame, o);
      },
      // drawBelt(g): correia (laço), roletes, tambores e marcas andando
      drawBelt(g) {
        const ol = olW(o);
        g.lineCap = 'round'; g.lineJoin = 'round';
        beltPath(g);
        if (ol > 0) { g.strokeStyle = LINE; g.lineWidth = w + ol * 2; g.stroke(); }
        g.strokeStyle = belt; g.lineWidth = w; g.stroke();
        g.strokeStyle = sh(belt, -0.5); g.lineWidth = ri * 2; g.stroke();
        // roletes de apoio
        const rr = Math.max(1, ri - 0.6), rot = cv.phase / rr;
        for (let s = rollGap; s < length - rollGap * 0.5; s += rollGap) {
          pointAt(s);
          const x = cvP.x, y = cvP.y;
          g.fillStyle = PAL.steelD; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
          g.fillStyle = PAL.steel; g.beginPath(); g.arc(x - rr * 0.15, y - rr * 0.18, rr * 0.72, 0, TAU); g.fill();
          g.fillStyle = LINE; g.beginPath(); g.arc(x + Math.cos(rot + s) * rr * 0.5, y + Math.sin(rot + s) * rr * 0.5, Math.max(0.5, rr * 0.24), 0, TAU); g.fill();
        }
        // tambores das pontas (o final é o motriz)
        for (let e = 0; e < 2; e++) {
          const p = e ? pts[n - 1] : pts[0], a = cv.phase / R;
          g.fillStyle = LINE; g.beginPath(); g.arc(p[0], p[1], ri + 0.4, 0, TAU); g.fill();
          g.fillStyle = sh(frame, -0.2); g.beginPath(); g.arc(p[0], p[1], ri - 0.3, 0, TAU); g.fill();
          g.fillStyle = e ? frame : PAL.steel; g.beginPath(); g.arc(p[0] - ri * 0.1, p[1] - ri * 0.12, ri * 0.78, 0, TAU); g.fill();
          g.strokeStyle = LINE; g.lineWidth = Math.max(0.7, ri * 0.22); g.lineCap = 'round';
          g.beginPath();
          g.moveTo(p[0] - Math.cos(a) * ri * 0.6, p[1] - Math.sin(a) * ri * 0.6); g.lineTo(p[0] + Math.cos(a) * ri * 0.6, p[1] + Math.sin(a) * ri * 0.6);
          g.moveTo(p[0] + Math.sin(a) * ri * 0.6, p[1] - Math.cos(a) * ri * 0.6); g.lineTo(p[0] - Math.sin(a) * ri * 0.6, p[1] + Math.cos(a) * ri * 0.6);
          g.stroke();
        }
        // marcas da correia (taliscas): andam por cima, dão a volta e voltam por baixo
        g.lineCap = 'butt';
        g.strokeStyle = sh(belt, 0.34); g.lineWidth = Math.max(1, w * 0.14);
        g.beginPath();
        const u0 = ((cv.phase % tickGap) + tickGap) % tickGap;
        for (let u = u0; u < per; u += tickGap) {
          loopAt(u, cvP);
          g.moveTo(cvP.x + cvP.nx * (ri + 0.2), cvP.y + cvP.ny * (ri + 0.2));
          g.lineTo(cvP.x + cvP.nx * (R + 0.9), cvP.y + cvP.ny * (R + 0.9));
        }
        g.stroke();
      },
      // drawItems(g): montinhos de carga
      drawItems(g) {
        if (!cv.showItems) return;
        for (let i = 0; i < items.length; i++) {
          const it = items[i];
          pointAt(it.s);
          const k = Math.sqrt(it.v), e = it.pop < 1 ? U.ease.back(it.pop) : 1;
          const hop = Math.max(0, Math.cos((it.s / rollGap) * TAU)) ; // passa em cima do rolete: pulinho
          const j = hop * hop * hop * hop * Math.min(1, Math.abs(cv.v) / 40) * 0.9;
          const x = cvP.x + cvP.nx * (R + 0.4), y = cvP.y + cvP.ny * (R + 0.4) - j;
          if (cv.drawItem) { cv.drawItem(g, x, y, it.v, cvP.ang, it); continue; }
          const hw = Math.min(w * 1.25, w * 0.62 * k) * (0.6 + 0.4 * e), h = hw * 0.8 * e * (1 + j * 0.05);
          g.save(); g.translate(x, y); g.rotate(cvP.ang * 0.55 * (Math.abs(cvP.ang) > PI / 2 ? 0 : 1));
          moundO.col = cv.cargo; moundO.shade = cv.cargoShade; moundO.ol = o.ol; Rig.mound(g, 0, 0, hw, h, moundO);
          g.restore();
        }
      },
      // draw(g, t): tudo na ordem certa
      draw(g) { cv.drawBack(g); cv.drawBelt(g); cv.drawItems(g); },
    };
    return cv;
  }

  /* ---------- exporta ---------- */
  E.Spring = Spring;
  E.Joint = Joint;
  E.ik2 = ik2;
  E.ik3 = ik3;
  E.Rig = Rig;
  E.Rope = Rope;
  E.Telescope = Telescope;
  E.Chassis = Chassis;
  E.suspension = Chassis;      // apelido do contrato ("E.suspension(...)")
  E.Exhaust = Exhaust;
  E.Conveyor = Conveyor;
})();
