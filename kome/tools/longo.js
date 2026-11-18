#!/usr/bin/env node
/* Kome tools: SIMULADOR DE HORAS — joga o jogo inteiro acelerado (campanha → modo infinito → ilhas → ...) com um jogador
   guloso e mede o que importa pra um jogo de 100 h: quanto dura cada fase, e principalmente ONDE fica chato
   (trecho sem nada novo aparecendo, renda travada). Só imprime o resumo.
   uso: node tools/longo.js [--horas 10] [--verbose] [--chato 10] [--json saida.json] [--perfil casual] [--campanha-gulosa]
     --chato N   minutos sem novidade que contam como "trecho chato" (padrão 10)
     --perfil casual   JOGADOR DE VERDADE (o pai do dono no celular) em vez do robô guloso: cava em rajadas e para pra olhar
                 (parado ~40% do tempo), mira de vez em quando (não a cada segundo), olha a loja a cada 6–20 s e compra UMA coisa
                 que dá pra comprar entre as que estão à vista (próxima ferramenta, casa, os 3 nós mais baratos), sem planejar;
                 pega só parte dos sacos/onigiris/eventos dourados, escolhe amuleto no escuro e gasta as sementes clicando ao
                 acaso (até 60 cliques). Números do perfil: CAS, logo abaixo. O ritmo das ilhas é afinado pros DOIS perfis
                 (docs/medicoes/ilhas-casual.txt): casual 30–45 min, guloso ≥ 12–15 min.
     --campanha-gulosa   com --perfil casual: a 1ª campanha (Honshu, até a 1ª viagem) joga no guloso pra chegar logo nas ilhas
     --salva arq   guarda o save na chegada de cada ilha (antes de gastar as sementes) em arq.1, arq.2… (nº da viagem)
     --de arq.N    começa daquele save (pula a campanha: afinar uma ilha leva 1–2 min) · --finais N  para depois de N finais
   Novidade = ferramenta, etapa da casa, nó da árvore, peça da Gêmea, nível de fábrica/loja, enfeite/bicho da Casa,
   conquista, ilha nova, montanha nova, marco da Oficina (nível 10/25/50). Roda em segundo plano se quiser:
   `node tools/longo.js --horas 100 > %TEMP%/longo.txt` (100 h simuladas ≈ 1 h real). */
const path = require('path'), fs = require('fs');
const { launch } = require('./pw');
const a = process.argv.slice(2), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d), has = k => a.includes(k);
const HORAS = +val('--horas', 10), CHATO = +val('--chato', 10) * 60, LIM = HORAS * 3600;
const URL = 'file://' + path.resolve(__dirname, '..', 'index.html');
const PERFIL = val('--perfil', 'guloso'), CAMP_GULOSA = has('--campanha-gulosa');
// perfil casual (segundos): rajada cavando / pausa olhando · de quanto em quanto mira · olha a loja · toca nos sacos (e a chance) ·
// chance por segundo de tocar no evento dourado · compras por olhada depois do final (Pátio) · cliques na árvore de sementes
const CAS = { on: [12, 40], off: [8, 30], aim: [3, 7], loja: [6, 20], saco: [4, 9], sacoP: 0.6, dourP: 0.08, patioN: 3, sementes: 60 };

// um bloco de simulação dentro da página: joga `secs` segundos e devolve as novidades
const CHUNK = `((secs, CAS) => {
  const K = __kome, D = K.data, S = K.S, G = KomeGame, out = [], t0 = S.time;
  const rnd = r => r[0] + Math.random() * (r[1] - r[0]);
  // casual: o estado mora na página (a viagem recarrega e ele recomeça numa rajada)
  const c = CAS ? (window.__cas || (window.__cas = { on: true, left: rnd(CAS.on), aimT: 0, ax: 0, ay: 0, lojaT: rnd(CAS.loja), sacoT: rnd(CAS.saco) })) : null;
  if (G.Amuletos && G.Amuletos.sim) G.Amuletos.sim.acaso = !!CAS;
  const note = (k, txt) => out.push({ t: S.time - t0, k, txt });
  const achN = () => Object.keys(S.stats.ach || {}).length + Object.keys((S.stats.heart || {}).ach || {}).length;
  let ach0 = achN(), esc0 = G.Escada ? G.Escada.total() : 0;
  for (let s = 0; s < secs && !(S.stats.simTravel); s++) {
    const ph = S.time % 20;
    if (c) {   // casual: rajada cavando com a mira velha, pausa olhando a tela
      if ((c.left -= 1) <= 0) { c.on = !c.on; c.left = rnd(c.on ? CAS.on : CAS.off); c.aimT = 0; }
      if (c.on) { if ((c.aimT -= 1) <= 0) { const p = K.aim(); c.ax = p.x; c.ay = p.y; c.aimT = rnd(CAS.aim); } K.hold(c.ax, c.ay, true); } else K.hold(0, 0, false);
      K.step(1);
      if (c.on && (c.sacoT -= 1) <= 0) { c.sacoT = rnd(CAS.saco); if (Math.random() < CAS.sacoP) K.tapAll(); }
      if (c.on && G.Events && G.Events.sim.pending() && Math.random() < CAS.dourP) { const id = G.Events.live(); G.Events.sim.tap(); note('dourado', 'evento ' + id); }
      if ((c.lojaT -= 1) > 0) continue;
      c.lojaT = rnd(CAS.loja);
    } else {
    if (ph < 17) { const p = K.aim(); K.hold(p.x, p.y, true); } else K.hold(0, 0, false);
    K.step(1); K.tapAll();
    if (G.Events && G.Events.sim.pending()) { const id = G.Events.live(); G.Events.sim.tap(); note('dourado', 'evento ' + id); }
    if (s % 3) continue;
    }
    const hs = S.soCasa && !S.ended && D.HOUSE[S.house];   // só falta a casa (montanha acabada): junta tudo pra casa
    if (hs) { if (S.tool + 1 < hs.tier) { if (K.buyTool()) note('tool', 'ferramenta pra casa: ' + K.tool.name); } else if (K.buyHouse()) note('casa', 'casa: ' + hs.n + ' (só faltava a casa)'); }
    for (let guard = 0, gmax = c ? (S.ended ? CAS.patioN : 1) : 8; guard < gmax && !hs; guard++) {
      // candidatos: [custo, rótulo, tipo, compra]
      const C = [];
      const t = D.TOOLS[S.tool + 1];
      if (t && !(t.needs || []).some(id => !S.own[id])) C.push([K.toolCost ? K.toolCost(t) : t.cost, 'ferramenta: ' + t.name, 'tool', () => K.buyTool()]);
      const h = D.HOUSE[S.house];
      if (h && S.tool + 1 >= h.tier) C.push([h.c * D.ECON.COST_HOUSE, 'casa: ' + h.n, 'casa', () => K.buyHouse()]);
      for (const n of D.TREE) if (!S.own[n.id] && K.nodeState(n.id) === 'open') C.push([K.nodeCost(n.id), 'nó: ' + n.n, 'no', () => K.buyNode(n.id)]);
      if (S.ended) {
        const I = G.Inf && G.Inf.sim, R = G.Ind && G.Ind.sim, H = G.Home && G.Home.sim;
        if (I) { const cur = K.tool; const lv = (S.stats.lv || {})[cur.id] | 0; C.push([I.cost(cur), 'oficina: ' + cur.name + ' ' + (lv + 1), lv + 1 === 10 || lv + 1 === 25 || lv + 1 === 50 ? 'marco' : 'oficina', () => { G.S.stats.lv = G.S.stats.lv || {}; const m = S.money; I.up(cur); return S.money < m; }]); }
        if (R) {
          const r = R.run(), gp = r.giant | 0;
          if (gp < 4) C.push([R.cost.giant(), 'Gêmea peça ' + (gp + 1), 'gemea', () => R.pay(R.cost.giant(), 'g', () => { r.giant = gp + 1; })]);
          C.push([R.cost.fab(), 'fábrica nível ' + ((r.fab | 0) + 1), 'fabrica', () => R.pay(R.cost.fab(), 'f', () => { r.fab = (r.fab | 0) + 1; })]);
          const sh = D.SHOPS[(S.time / 60 | 0) % D.SHOPS.length];
          C.push([R.cost.shop(sh.id), 'loja ' + sh.n + ' ' + (((r.shops || {})[sh.id] | 0) + 1), 'loja', () => R.pay(R.cost.shop(sh.id), sh.n, () => { r.shops[sh.id] = (r.shops[sh.id] | 0) + 1; if (!r.client) r.client = sh.id; })]);
        }
        const PT = G.Patio && G.Patio.sim;
        if (PT && G.Patio.on()) {   // Pátio da Frota: compra por melhor retorno (custo / rendimento) e os marcos ×2
          let bestId = null, bestR = Infinity;
          for (const id of PT.types()) { const c = PT.cost(id), r = (D.PATIO.turmas.find(t => t.id === id).r) * Math.pow(2, ((S.stats.patio.m || {})[id] | 0)); if (c / r < bestR) { bestR = c / r; bestId = id; } }
          if (bestId) { const c = PT.cost(bestId); C.push([c, 'pátio: ' + bestId, PT.count(bestId) ? 'compra' : 'novo', () => PT.buy(bestId)]); }
          for (const id of PT.types()) { const mc = PT.marco(id); if (mc < Infinity) C.push([mc, 'marco ' + id, 'marco', () => PT.buyMarco(id)]); }
          if (PT.extras) for (const [c, n, f] of PT.extras()) C.push([c, n, 'upgrade', f]);
        }
        const F = G.Fab;
        if (F && F.on()) {   // Fábrica: a planta mínima do guloso (Moldadora na linha que já vem; com o Pilão liberado, uma linha de mochi)
          const ms = F.state.machines, hasM = t => ms.some(m => m.type === t);
          if (!hasM('moldadora')) C.push([F.price('moldadora'), 'fábrica: moldadora', 'fabrica', () => F.place('moldadora', 4, 2, 0) !== null]);
          else if (F.state.unlocked.pilao && !hasM('pilao')) C.push([F.price('panela') + F.price('pilao'), 'fábrica: linha de mochi', 'fabrica', () => { F.belt([[0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4], [6, 4], [7, 4]], 0); return F.place('panela', 1, 4, 0) !== null && F.place('pilao', 3, 4, 0) !== null; }]);
        }
        if (H) { const own = (S.homeData || {}).own || {}; for (const it of D.DECOR) if (!own[it.id] && (!it.needs || own[it.needs])) C.push([H.cost(it), 'casa: ' + it.n, 'enfeite', () => { const m = S.money; H.buy(it); return S.money < m; }]); }
      }
      C.sort((x, y) => x[0] - y[0]);
      let best = C[0];
      if (c) {   // casual: só o que está à vista (ferramenta, casa, 3 nós mais baratos; depois do final, o resto) e dá pra comprar agora; 1 ao acaso
        let nn = 0; const V = C.filter(x => (x[2] !== 'no' || nn++ < 3) && x[0] <= S.money);
        best = V[Math.random() * V.length | 0];
      }
      if (!best || !(best[0] <= S.money)) break;
      if (best[3]() === false) break;
      note(best[2], best[1]);
    }
    if (G.City && G.City.sim) for (const [k, txt] of G.City.sim.act()) note('cidade', 'cidade: ' + txt);   // Cidade: entrega tudo, começa festival, escolhe a 1ª obra
    const an = achN(); if (an > ach0) { note('conquista', 'conquista ' + an); ach0 = an; }
    const en = G.Escada ? G.Escada.total() : 0; if (en > esc0) { note('escada', 'escada: grau ' + en); esc0 = en; }   // conquistas em escada (meta ~1 grau/10 min)
    // depois do final: montanha nova quando a atual está quase toda cavada
    if (S.ended && K.heap.area < K.heap.total * 0.12) { K.newMountain(); note('montanha', 'montanha nova ' + (S.mount | 0)); }
  }
  return { out, dt: S.time - t0, ended: !!S.ended, island: S.island | 0, ips: S.ips, tool: K.tool.id, house: S.house, money: S.money,
    dug: 1 - K.heap.area / K.heap.total, partir: !!(G.Patio && G.Patio.partir && G.Patio.partir()), seeds: Math.floor(S.stats.seeds || 0), islandsDone: S.stats.islandsDone | 0, earned: S.earned, endT: S.ended ? S.endT : null };
})`;
// viagem: compra sementes (o mais barato primeiro) e vai pra próxima ilha (recarrega a página)
const TRAVEL = `(() => { const K = __kome, S = K.S, G = KomeGame, I = G.Islands; if (!I || !I.sim) return -1;
  const next = ((S.island | 0) + 1) % KomeGame.Data.ISLANDS.length;   // depois da última: Honshu de novo (Volta 2, 3…)
  I.go(next); return next; })()`;
const SEEDS = `(() => { const S = __kome.S, G = KomeGame, I = G.Islands; if (!I || !I.sim) return 0; let n = 0;
  // guloso: máquina absurda assim que dá (nó caro e único), senão a semente mais barata; sem teto (jogo-infinito) = pode comprar centenas
  const lv = id => (S.stats.sl || {})[id] | 0, abs = s => s.g === 'Absurdo' ? 0.01 : 1;
  for (let g = 0; g < 600; g++) { const L = KomeGame.Data.SEEDS.filter(s => (!s.max || lv(s.id) < s.max) && (!s.req || lv(s.req))).sort((a, b) => I.sim.seedCost(a) * abs(a) - I.sim.seedCost(b) * abs(b));
    const s = L[0]; if (!s || Math.floor(S.stats.seeds || 0) < I.sim.seedCost(s)) break; I.sim.buy(s); n++; } return n; })()`;

// --stats: a cada 30 min, os contadores que as conquistas em escada leem (calibrar os graus) + graus já fechados
const STATS = `(() => { const S = __kome.S, s = S.stats, G = KomeGame, f = v => Number(v || 0).toExponential(2);
  return JSON.stringify({ graos: f(((s.dugAll || 0) + S.dug) * 40), yen: f((s.earnedAll || 0) + S.earned), sacos: s.sacks | 0, bolsoes: s.pockets | 0, oni: s.onigiri | 0,
    dour: s.goldEv | 0, ilhas: s.islandsDone | 0, faixa: s.lap | 0, amul: s.amPick | 0, cor: (s.city && s.city.hearts) | 0, graus: G.Escada ? G.Escada.total() : 0 }); })()`;
// casual: clica nas sementes ao acaso entre as que dá pra comprar (a absurda quando aparece), até CAS.sementes cliques
const SEEDS_CAS = `((N) => { const S = __kome.S, G = KomeGame, I = G.Islands; if (!I || !I.sim) return 0; let n = 0;
  const lv = id => (S.stats.sl || {})[id] | 0;
  for (let g = 0; g < N; g++) { const have = Math.floor(S.stats.seeds || 0), L = KomeGame.Data.SEEDS.filter(s => (!s.max || lv(s.id) < s.max) && (!s.req || lv(s.req)) && I.sim.seedCost(s) <= have);
    if (!L.length) break; const a = L.find(s => s.g === 'Absurdo'), s = a || L[Math.random() * L.length | 0]; I.sim.buy(s); n++; } return n; })`;
(async () => {
  const b = await launch(), p = await b.newPage({ viewport: { width: 960, height: 540 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  p.on('dialog', d => d.accept());
  if (!val('--de', '')) { await p.goto(URL + '?fresh&nointro&nofont'); await p.waitForTimeout(800); }
  let spins = 0, T = 0, lastNew = 0, endedAt = null, islandStart = 0, phase = 'campanha', viagens = 0, finais = 0;
  const SEEDS_RUN = () => p.evaluate(PERFIL === 'casual' ? `(${SEEDS_CAS})(${CAS.sementes})` : SEEDS).catch(() => 0);
  const ISL = () => p.evaluate('__kome.S.island + " (volta " + ((__kome.S.stats.lap | 0) + 1) + ")"').catch(() => '?');
  if (val('--de', '')) {   // save guardado na chegada de uma ilha: põe no navegador, recarrega sem ?fresh, gasta as sementes e segue
    const sv = JSON.parse(fs.readFileSync(val('--de'), 'utf8'));
    await p.addInitScript(ls => { try { if (sessionStorage.getItem('longo-de')) return; sessionStorage.setItem('longo-de', '1'); localStorage.clear(); for (const k in ls) localStorage.setItem(k, ls[k]); } catch (e) { /* */ } }, sv.ls);   // 1 vez só (a viagem recarrega a página)
    await p.goto(URL + '?nointro&nofont'); await p.waitForTimeout(1500);
    viagens = sv.viagens | 0; const sb = await SEEDS_RUN(), isl = await ISL(); phase = 'ilha ' + isl;
    console.log('começa do save ' + path.basename(val('--de')) + ' → ilha ' + isl + ' (' + sb + ' melhorias de semente compradas)');
  }
  const ilhas = [];   // [nome, minutos até o final, novidades nos 5 primeiros minutos]
  const ev = [], gaps = [], fases = [], t0 = Date.now(), byKind = {};
  const fmt = s => (s >= 3600 ? Math.floor(s / 3600) + 'h' : '') + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + 'min';
  while (T < LIM) {
    const cas = PERFIL === 'casual' && !(CAMP_GULOSA && viagens === 0);
    const r = await p.evaluate(`(${CHUNK})(300, ${cas ? JSON.stringify(CAS) : 'null'})`).catch(e => ({ erro: e.message.split('\n')[0] }));
    if (r.erro) { console.log('ERRO na simulação: ' + r.erro); break; }
    // proteções: bloco com eventos demais (laço de compra?) ou tempo parado; memória do node por bloco
    if (r.out.length > 3000) console.log('AVISO: ' + r.out.length + ' eventos em 1 bloco (' + r.out.slice(-3).map(e => e.txt).join(' | ') + ')');
    if (!(r.dt > 1)) { spins = (spins || 0) + 1; if (spins > 20) { console.log('PAROU: o tempo não anda (dt=' + r.dt + ')'); console.log('diag: ' + await p.evaluate(() => { const K = __kome, S = K.S, t0 = S.time; K.step(1); return JSON.stringify({ url: location.search, t0, t1: S.time, tool: S.tool, island: S.island, ended: S.ended, money: S.money, endOpen: S.endOpen, home: KomeGame.Home.isOpen(), map: KomeGame.IslandsUI && KomeGame.IslandsUI.isOpen(), last: r => 0 }); }).catch(e => e.message)); console.log('últimos: ' + r.out.slice(-4).map(e => e.k + ':' + e.txt).join(' | ')); break; } } else spins = 0;
    if (has('--mem')) console.log('mem ' + Math.round(process.memoryUsage().heapUsed / 1048576) + ' MB · T ' + Math.round(T / 60) + ' min · ev ' + ev.length + ' · bloco ' + r.out.length + ' · dinheiro ' + r.money);
    for (const e of r.out) {
      const at = T + e.t; if (e.k !== 'compra') { if (at - lastNew > CHATO) gaps.push([lastNew, at, phase]); lastNew = at; }   // comprinha repetida não conta como novidade
      ev.push([at, e.k, e.txt]); byKind[e.k] = (byKind[e.k] || 0) + 1;
      if (has('--verbose')) console.log(fmt(at) + '  ' + e.txt);
    }
    T += r.dt;
    if (has('--stats') && Math.floor(T / 1800) > Math.floor((T - r.dt) / 1800)) console.log(fmt(T) + '  stats ' + await p.evaluate(STATS).catch(e => e.message));
    if (r.ended && endedAt === null) { endedAt = T; if (r.endT > 0 && r.endT <= T - islandStart) endedAt = islandStart + r.endT;   // hora exata do final (S.endT), não o fim do bloco de 5 min
      const Tb = T; T = endedAt; fases.push([phase, T - islandStart]); phase = r.island === 0 && !r.islandsDone ? 'infinito (Honshu)' : 'infinito (ilha ' + r.island + ')'; console.log(fmt(T) + '  FINAL da ilha ' + r.island + ' (' + fmt(T - islandStart) + ')');
      ilhas.push([phase, Math.round((T - islandStart) / 60), ev.filter(e => e[0] >= islandStart && e[0] < islandStart + 300 && /^(tool|no|casa)$/.test(e[1])).length]); T = Tb;
      if (++finais >= +val('--finais', 1e9)) break; }
    // viaja: 30 min de modo infinito OU nada novo há 15 min (o jogador se cansaria), se ainda há ilha
    // viaja como o chip "hora de partir": depois de 30 min de Pátio e 4 min sem novidade de verdade (ou 2 h no máximo)
    if (endedAt !== null && (r.partir || T - endedAt > 7200)) {   // chip "hora de partir" (ou 2 h)
      fases.push([phase, T - endedAt]);
      await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), p.evaluate(TRAVEL).catch(() => {})]);
      await p.waitForTimeout(1500);
      viagens++;
      if (val('--salva', '')) fs.writeFileSync(val('--salva') + '.' + viagens, JSON.stringify({ viagens, ls: await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; }) }));
      const sb = await SEEDS_RUN();
      const isl = await ISL();
      const sx = await p.evaluate('JSON.stringify({sementes: __kome.S.stats.seedsAll, sl: __kome.S.stats.sl, earned: Math.round(__kome.S.earned)})').catch(() => '');
      ev.push([T, 'ilha', 'viagem pra ilha ' + isl]); lastNew = T; islandStart = T; endedAt = null; phase = 'ilha ' + isl;
      console.log(fmt(T) + '  VIAGEM → ilha ' + isl + ' (' + sb + ' melhorias de semente compradas) ' + (has('--verbose') ? sx : ''));
    }
  }
  if (endedAt === null) fases.push([phase + ' (não terminou)', T - islandStart]); else fases.push([phase, T - endedAt]);
  await b.close();
  // ---- relatório ----
  console.log('\n== ' + fmt(T) + ' simuladas em ' + Math.round((Date.now() - t0) / 1000) + ' s reais' + (errs.length ? ' · ERROS DE PÁGINA: ' + errs.slice(0, 2).join(' | ') : ' · sem erro de página'));
  console.log('perfil: ' + PERFIL + (PERFIL === 'casual' && CAMP_GULOSA ? ' (campanha no guloso)' : ''));
  console.log('ILHAS (min até o final · compras nos 5 primeiros min): ' + ilhas.map(i => i[0] + ' ' + i[1] + ' min · ' + i[2]).join(' | '));
  console.log('fases:'); (fases.length > 24 ? fases.slice(0, 12).concat([['…', 0]], fases.slice(-10)) : fases).forEach(([n, d]) => console.log('  ' + n.padEnd(26) + fmt(d)));
  const isl = fases.filter(f => /^ilha/.test(f[0])), inf = fases.filter(f => /^infinito/.test(f[0]));
  const avg = L => L.length ? fmt(L.reduce((a, f) => a + f[1], 0) / L.length) : '—';
  console.log('média: ilha ' + avg(isl) + ' · Pátio ' + avg(inf) + ' · viagens ' + isl.length + ' · ilha mais curta ' + (isl.length ? fmt(Math.min(...isl.map(f => f[1]))) : '—') + ' · Pátio mais curto ' + (inf.length ? fmt(Math.min(...inf.map(f => f[1]))) : '—'));
  const escN = ev.filter(e => e[1] === 'escada').length; console.log('conquistas em escada: ' + escN + ' graus (' + (escN ? Math.round(T / 60 / escN) : '—') + ' min por grau; meta ~10)');
  console.log('novidades por tipo: ' + Object.entries(byKind).map(([k, v]) => k + ' ' + v).join(' · '));
  const longGaps = gaps.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0]));
  console.log('trechos CHATOS (mais de ' + CHATO / 60 + ' min sem novidade): ' + longGaps.length);
  longGaps.slice(0, 8).forEach(([x, y, ph]) => console.log('  ' + fmt(x) + ' → ' + fmt(y) + '  (' + Math.round((y - x) / 60) + ' min, ' + ph + ')'));
  if (has('--json')) fs.writeFileSync(val('--json'), JSON.stringify({ horas: T / 3600, fases, gaps: longGaps, ev }, null, 1));
  process.exit(errs.length ? 1 : 0);
})().catch(e => { console.error('FALHOU', e.message); process.exit(1); });
