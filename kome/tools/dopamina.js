#!/usr/bin/env node
/* Kome tools: JOGADOR DE DOPAMINA — um modelo (bem simplificado!) de quanto tempo alguém aguenta um jogo incremental.
   Não mede diversão de verdade; serve pra COMPARAR versões do jogo com a mesma régua.
   Modelo:
   - cada novidade dá um pico de dopamina conforme o tipo (ferramenta nova vale muito, nó da árvore vale pouco...);
   - habituação: o mesmo tipo repetido em sequência vale cada vez menos (esquece em ~20 min);
   - a dopamina cai sozinha (meia-vida ~4 min); abaixo do limiar o jogador fica entediado;
   - 15 min seguidos entediado = larga o jogo.
   uso:
     node tools/dopamina.js --json %TEMP%/longo6.json      (eventos do tools/longo.js --json: o jogo de HOJE)
     node tools/dopamina.js --cookie [--horas 100]         (modelo da "camada Cookie": comprar várias de cada máquina) */
const fs = require('fs');
const a = process.argv.slice(2), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d), has = k => a.includes(k);

// peso de cada tipo de novidade (pico de dopamina)
const W = { tool: 10, ilha: 12, casa: 6, gemea: 7, marco: 5, montanha: 4, conquista: 3, enfeite: 2, fabrica: 2, no: 1.5, loja: 1,
  oficina: 1, compra: 0.1, upgrade: 2.2, dourado: 5, prestigio: 12, celeste: 4, novo: 10, amuleto: 6 };   // amuleto: escolha 1 de 3 (amuletos.js)
const HAB_TAU = 20 * 60, D_HALF = 4 * 60, LIM = 1.0, QUIT = 15 * 60;

function play(events, horas) {   // events: [[t, tipo], ...] ordenados
  const hab = {}, curve = []; let D = 3, bored = 0, t = 0, i = 0, quitAt = null, engaged = 0, gaps = [], gapStart = null;
  const end = horas * 3600;
  for (t = 0; t < end; t += 5) {
    D *= Math.pow(0.5, 5 / D_HALF);
    while (i < events.length && events[i][0] <= t) {
      const k = events[i][1], w = W[k] === undefined ? 1 : W[k];
      const h = hab[k] || { v: 0, t: 0 }; h.v *= Math.exp(-(t - h.t) / HAB_TAU); h.t = t;
      D += w / (1 + 0.6 * h.v); h.v += 1; hab[k] = h; i++;
    }
    if (D < LIM) { bored += 5; if (gapStart === null) gapStart = t; } else { if (gapStart !== null && t - gapStart > 300) gaps.push([gapStart, t]); gapStart = null; bored = Math.max(0, bored - 10); engaged += 5; }
    if (t % 900 === 0) curve.push(D);
    if (bored >= QUIT && quitAt === null) { quitAt = t; break; }
  }
  return { quitAt, engaged, t, curve, gaps, n: i };
}

/* ---- modelo da camada Cookie (matemática pura, sem o jogo): 14 máquinas, compra várias de cada ---- */
function cookieModel(horas) {
  const N = 14, ev = [], cnt = new Array(N).fill(0);
  const base = i => 15 * Math.pow(7.5, i), prod = i => 0.2 * Math.pow(6.2, i);
  const MIL = [1, 5, 25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
  let money = 0, mult = 1, ach = 0, prestige = 0, earnedRun = 0, golden = 120, frenzy = 0, lastBuy = 0, upg = new Array(N).fill(0);
  const ips = () => cnt.reduce((s, c, i) => s + c * prod(i) * Math.pow(2, upg[i]), 0) * mult * (1 + 0.04 * ach) * (1 + 0.02 * prestige) * (frenzy > 0 ? 7 : 1) + 1;
  const cost = i => base(i) * Math.pow(1.15, cnt[i]);
  const end = horas * 3600;
  let achEarn = 1e3;
  for (let t = 0; t < end; t += 1) {
    const g = ips(); money += g; earnedRun += g;
    if (frenzy > 0) frenzy--;
    if (--golden <= 0) { golden = 180 + Math.floor(Math.random() * 300); ev.push([t, 'dourado']); if (Math.random() < 0.5) frenzy = 77; else money += g * 900; }
    while (earnedRun > achEarn) { achEarn *= 10; ach++; ev.push([t, 'conquista']); }
    if (t - lastBuy >= 3) {   // ritmo humano: no máximo 1 compra a cada 3 s
      let best = -1, bestR = Infinity;
      for (let i = 0; i < N; i++) { if (i > 0 && cnt[i - 1] === 0) break; const r = cost(i) / (prod(i) * Math.pow(2, upg[i])); if (r < bestR) { bestR = r; best = i; } }
      if (best >= 0 && cost(best) <= money) {
        money -= cost(best); cnt[best]++; lastBuy = t;
        ev.push([t, cnt[best] === 1 ? 'novo' : 'compra']);
        if (MIL.includes(cnt[best])) { upg[best]++; ev.push([t, 'upgrade']); if ([1, 50, 100, 200, 400].includes(cnt[best])) { ach++; ev.push([t, 'conquista']); } }
      }
    }
    // prestígio (viagem): quando o próximo prestígio dobraria o bônus permanente
    const gain = Math.floor(Math.cbrt(earnedRun / 1e12));
    if (gain >= Math.max(10, prestige)) {
      prestige += gain; ev.push([t, 'prestigio']); for (let k = 0; k < Math.min(6, 1 + gain / 50); k++) ev.push([t, 'celeste']);
      money = 0; earnedRun = 0; cnt.fill(0); upg.fill(0); achEarn = 1e3 * Math.pow(10, Math.min(ach, 12) / 3);
    }
  }
  return ev;
}

const fmt = s => (s >= 3600 ? Math.floor(s / 3600) + 'h' : '') + String(Math.floor(s % 3600 / 60)).padStart(2, '0') + 'min';
function report(nome, r, horas) {
  console.log('== ' + nome);
  console.log('  ' + (r.quitAt !== null ? 'LARGA O JOGO em ' + fmt(r.quitAt) : 'aguentou as ' + horas + ' h simuladas sem largar') +
    ' · engajado ' + Math.round(r.engaged / Math.max(1, r.t) * 100) + '% do tempo · ' + r.n + ' novidades');
  console.log('  dopamina a cada 15 min: ' + r.curve.map(v => (v >= 6 ? '█' : v >= 3 ? '▆' : v >= 1.5 ? '▃' : v >= LIM ? '▁' : '·')).join(''));
  const g = r.gaps.sort((x, y) => (y[1] - y[0]) - (x[1] - x[0])).slice(0, 4);
  if (g.length) console.log('  maiores tédios: ' + g.map(([x, y]) => fmt(x) + '→' + fmt(y)).join(' · '));
}

if (has('--json')) {
  const j = JSON.parse(fs.readFileSync(val('--json'), 'utf8'));
  const ev = (j.ev || []).map(e => [e[0], e[1]]).sort((x, y) => x[0] - y[0]);
  report('jogo de HOJE (eventos do longo.js, ' + j.horas.toFixed(1) + ' h)', play(ev, j.horas), j.horas.toFixed(1));
}
if (has('--cookie')) {
  const H = +val('--horas', 100);
  report('modelo CAMADA COOKIE (' + H + ' h)', play(cookieModel(H), H), H);
}
if (!has('--json') && !has('--cookie')) console.log('uso: node tools/dopamina.js --json longo.json | --cookie [--horas 100]');
