/* Kome no Japão — missoes.js (G.Missoes)
   JORNADA: ~25 passos em ordem que passam pelo arco todo (pata → máquinas → casa → ilha → viagem → Pátio/Fábrica/Cidade…).
   Cartão fixo no HUD (zona de cima à esquerda, embaixo do dinheiro): ícone + meta curta + barra "12 de 30"; pronto = botão
   dourado "Pegar" (paga minutos da renda atual, números em D.MISSOES). Tocar no cartão antes de pronto abre a tela certa.
   Sem prazo, sem streak, nada some. Save antigo: na 1ª vez pula calado os passos já feitos. FAST: pega sozinho, sem tela.
   Estado: S.stats.jor = { i: passo atual } (vai no save junto com stats; sem MIGR: nasce sozinho). CSS: game/ux-missoes.css. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data;
  let api = null, S = null, acc = 0, el = null, sig = '';
  const st = () => S.stats;
  const TI = id => (D.toolIndex && D.toolIndex[id] !== undefined ? D.toolIndex[id] : 99);
  const trip = () => (st().islandsDone | 0) > 0;                       // já viajou: tudo da 1ª campanha conta como feito
  const city = () => st().city || {};
  const fab = () => { try { return G.Fab && G.Fab.state; } catch (e) { return null; } };
  const hub = id => () => G.HUD && G.HUD.hub && G.HUD.hub(id);
  const dig = () => { if (G.HUD && G.HUD.hubIsOpen && G.HUD.hubIsOpen()) G.HUD.hubClose(); if (!api.quiet()) UI.toast('Cave a montanha!', { icon: 'paw', sub: 'aperte CAVAR ou toque no arroz' }); };
  const frac = () => (S.heapTotal ? (S.heapTotal - S.heapArea) / S.heapTotal : 0);
  // [id, meta (4–6 palavras), ícone, valor agora, quanto precisa, abrir, conta como feito depois de viajar]
  const T = (id, n, icon, get, need, go, camp) => ({ id, n, icon, get, need, go, camp: !!camp });
  const STEPS = [
    T('pata', 'Cave arroz com a pata', 'paw', () => S.dug, 20, dig, 1),
    T('ferr', 'Compre a 1ª ferramenta', 'yen', () => Math.min(1, S.tool), 1, hub('comprar'), 1),
    T('saco', 'Estoure 3 sacos de arroz', 'sack', () => st().sacks | 0, 3, dig, 1),
    T('troca', 'Troque de ferramenta uma vez', 'swap', () => Math.min(1, st().swaps | 0), 1, hub('comprar'), 1),
    T('casa', 'Compre o terreno da casa', 'house', () => Math.min(1, S.house | 0), 1, hub('comprar'), 1),
    T('combo', 'Segure o combo cheio', 'bolt', () => Math.min(5, Math.floor(st().comboMaxSecs || 0)), 5, dig, 1),
    T('arvore', 'Compre 3 melhorias da árvore', 'tree', () => Math.min(3, Object.keys(S.own).length), 3, () => G.HUD.treePanel && G.HUD.treePanel.open(), 1),
    T('pa', 'Compre a Pá', 'yen', () => Math.min(1, S.tool >= TI('pa') ? 1 : 0), 1, hub('comprar'), 1),
    T('motor', 'Compre o Trator a motor', 'gear', () => (S.tool >= TI('trator') ? 1 : 0), 1, hub('comprar'), 1),
    T('casa3', 'Faça 3 etapas da casa', 'house', () => Math.min(3, S.house | 0), 3, hub('comprar'), 1),
    T('cad', 'Cumpra 5 missões do Caderno', 'book', () => Math.min(5, st().misDone | 0), 5, () => { if (G.Home) G.Home.open('caderno'); if (G.Goals) G.Goals.show('mis'); }),
    T('escav', 'Compre a Escavadeira', 'bolt', () => (S.tool >= TI('escav') ? 1 : 0), 1, hub('comprar'), 1),
    T('bagger', 'Compre a Bagger 293', 'horn', () => (S.tool >= TI('bagger') ? 1 : 0), 1, hub('comprar'), 1),
    T('ilha', 'Termine a casa e a montanha', 'mount', () => (S.ended ? 100 : Math.min(99, Math.floor(frac() / (D.END_DUG || 0.95) * 100))), 100, hub('comprar'), 1),
    T('viajar', 'Viaje pra uma ilha nova', 'boat', () => (trip() ? 1 : 0), 1, () => G.IslandsUI && G.IslandsUI.open()),
    T('semente', 'Compre uma Semente Dourada', 'star', () => (Object.values(st().sl || {}).some(v => v > 0) ? 1 : 0), 1, () => G.HUD.openSeeds && G.HUD.openSeeds()),
    T('amuleto', 'Escolha um amuleto', 'star', () => Math.min(1, st().amPick | 0), 1, hub('viagem')),
    T('patio', 'Ponha uma turma no Pátio', 'paw', () => (Object.values((st().patio && st().patio.n) || {}).some(v => v > 0) ? 1 : 0), 1, () => (G.Patio && G.Patio.on && G.Patio.on() ? G.Patio.open() : hub('lugares')())),
    T('fab', 'Ponha uma máquina na Fábrica', 'factory', () => { const f = fab(); return f && f.machines.length ? 1 : 0; }, 1, () => (G.Fab && G.Fab.on() ? G.Fab.open() : hub('lugares')())),
    T('oni', 'Venda 5 onigiris da Fábrica', 'rice', () => { const f = fab(); return Math.min(5, f ? f.made.onigiri | 0 : 0); }, 5, () => (G.Fab && G.Fab.on() ? G.Fab.open() : hub('lugares')())),
    T('oficina', 'Melhore uma máquina na Oficina', 'bolt', () => (Object.values(st().lv || {}).some(v => v > 0) ? 1 : 0), 1, () => G.Inf && G.Inf.open()),
    T('cidade', 'Entregue um pedido na Cidade', 'house', () => Math.min(1, city().delivered | 0), 1, () => (G.City && G.City.on() ? G.City.open() : hub('lugares')())),
    T('predio', 'Construa um prédio na Cidade', 'house', () => ((city().lots || []).some(l => l && l.b) ? 1 : 0), 1, () => (G.City && G.City.on() ? G.City.open() : hub('lugares')())),
    T('faixa', 'Dê a volta no Japão', 'trophy', () => (((st().fx && st().fx.best) | 0) > 0 || (st().lap | 0) > 0 ? 1 : 0), 1, () => G.IslandsUI && G.IslandsUI.open()),
    T('evo', 'Descubra uma evolução', 'gear', () => Math.min(1, Object.keys((st().evo && st().evo.disc) || {}).length), 1, () => { if (G.Home) G.Home.open('caderno'); if (G.Goals) G.Goals.show('evo'); }),
  ];
  const val = s => { let v = 0; try { v = s.camp && trip() ? s.need : +s.get() || 0; } catch (e) { v = 0; } return Math.max(0, Math.min(s.need, Math.floor(v))); };
  const done = s => val(s) >= s.need;
  const reward = s => Math.max(D.MISSOES.piso, Math.round(Math.max(0, S.ips || 0) * 60 * (D.MISSOES.min[s.id] || 1)));
  function J() {
    let j = st().jor;
    if (!j || typeof j !== 'object') {   // 1ª vez (save novo ou antigo): começa no 1º passo que ainda não foi feito, sem pagar o resto
      let i = 0; while (i < STEPS.length && done(STEPS[i])) i++;
      j = st().jor = { i };
    }
    return j;
  }
  const cur = () => STEPS[J().i] || null;

  function claim() {
    const s = cur(); if (!s || !done(s)) return;
    const r = reward(s);
    J().i++; api.pay(r);
    if (!api.quiet()) {
      api.sfx('pling');
      if (el) { el.root.classList.remove('ux-mis-pop'); void el.root.offsetWidth; el.root.classList.add('ux-mis-pop'); }
      UI.toast('Missão feita: ' + s.n, { icon: s.icon, tone: 'gold', sub: '+¥' + U.fmt(r) });
    }
    sig = ''; paint();
  }

  function build() {
    const Z = G.HUD && G.HUD.zones && G.HUD.zones.tl; if (!Z) return;
    const b = UI.el('button', 'ux-mis', Z); b.type = 'button'; b.setAttribute('aria-label', 'Missão da jornada');
    const ic = UI.el('span', 'ux-mis-ic', b), tx = UI.el('span', 'ux-mis-tx', b);
    const t = UI.el('b', 'ux-mis-t', tx), row = UI.el('span', 'ux-mis-row', tx), bar = UI.el('span', 'ux-mis-bar', row), fill = UI.el('i', null, bar), n = UI.el('span', 'ux-mis-n', row);
    const go = UI.el('span', 'ux-mis-go', b);
    b.addEventListener('click', e => {
      e.stopPropagation(); const s = cur(); if (!s) return;
      if (done(s)) claim(); else { api.sfx('click'); try { s.go(); } catch (er) { console.warn('[kome] missão', er); } }
    });
    el = { root: b, ic, t, fill, n, go, icon: '' };
  }

  // mexe no DOM só quando algo muda
  function paint() {
    if (!el) return;
    const s = cur();
    if (!s) { if (sig !== 'end') { sig = 'end'; el.root.style.display = 'none'; } return; }
    const v = val(s), ok = v >= s.need, k = s.id + '|' + v + '|' + ok + (ok ? '|' + U.fmt(reward(s)) : '');
    if (k === sig) return; sig = k;
    el.root.style.display = '';
    if (el.icon !== s.icon) { el.icon = s.icon; el.ic.innerHTML = ''; const c = UI.icon && UI.icon(s.icon, 28); if (c) el.ic.appendChild(c); }
    el.t.textContent = s.n;
    el.fill.style.transform = 'scaleX(' + (v / s.need) + ')';
    el.n.textContent = v + ' de ' + s.need;
    el.root.classList.toggle('ux-mis-ok', ok);
    el.go.textContent = ok ? 'Pegar +¥' + U.fmt(reward(s)) : 'Ir';
  }

  function tick(dt) {
    if (!S || (acc += dt) < 0.5) return; acc = 0;
    const s = cur();
    if (api.fast()) { if (s && done(s)) { const r = reward(s); J().i++; api.pay(r); } return; }   // modo acelerado: pega calado
    if (!el && G.HUD && G.HUD.ready) build();
    paint();
  }

  G.Missoes = {
    init(a) { api = a; S = G.S; J(); },
    tick, steps: STEPS, step: () => J().i, claim,
  };
})();
