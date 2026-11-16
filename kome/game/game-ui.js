/* Kome no Japão — game-ui.js
   HUD em DOM (E.UI) no layout do GDD §11: iene, ¥/s com sparkline, combo, montanha, panfleto da casa, botão da próxima
   ferramenta, 3 compras rápidas, Árvore e Ajustes. Lê o estado por G.S e age pela API passada em init(api).
   Ponto de extensão (Fase 2): G.HUD.zones (tl, tc, tr, mr, dock) pra pendurar missões, caderno e medidores. */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  const U = E.U, UI = E.UI, D = G.Data, PAL = E.PAL;
  const HUD = (G.HUD = { ready: false, zones: {} });
  let api, S, ui, swapBtn, swapPanel, yenPill, rate, combo, mount, flyer, toolBtn, slots = [], hornBtn, treeBtn, treePanel, tree, aj, slotNodes = [];
  let acc = 0, sampleT = 0, lastComboTone = '';

  const yen = v => '¥ ' + U.fmt(Math.ceil(v));
  function icon(id) { return G.Props ? G.Props.icon(id) : 'paw'; }

  // descrição curta do efeito de um nó (a partir do fx)
  function fxText(n) {
    const f = n.fx, o = [];
    const pc = v => '+' + Math.round((v - 1) * 100) + '%';
    if (f.dig) o.push(pc(f.dig) + ' de arroz cavado');
    if (f.sell) o.push(pc(f.sell) + ' no preço de venda');
    if (f.val) o.push(pc(f.val) + ' no valor do arroz');
    if (f.sack) o.push('sacos valem ' + pc(f.sack));
    if (f.hm) o.push('ajudantes ' + pc(f.hm) + ' mais rápidos');
    if (f.hv) o.push('arroz dos ajudantes vale ' + pc(f.hv));
    if (f.pm) o.push('máquinas pilotadas ' + pc(f.pm));
    if (f.help) o.push('+' + f.help + ' ajudante' + (f.help > 1 ? 's' : ''));
    if (f.crit) o.push('+' + Math.round(f.crit * 100) + '% de chance de grão dourado (×5)');
    if (f.gold) o.push('bolsões dourados valem ×' + f.gold);
    if (f.comboCap) o.push('combo vai até ×' + String(f.comboCap).replace('.', ','));
    if (f.spd) o.push('Kome anda ' + pc(f.spd) + ' mais rápido');
    if (f.reach) o.push('alcance ' + pc(f.reach));
    if (f.auto) o.push('Kome cava sozinho a ' + Math.round(f.auto * 100) + '% quando você solta');
    if (f.oni) o.push('onigiri da sorte voando pela tela');
    if (f.pilot) o.push('a máquina antiga cava sozinha');
    if (f.part) o.push('uma parte da Bagger 293 chega no pátio');
    if (f.powMul) o.push('força ×' + f.powMul + ': corta o Núcleo a 100%');
    if (f.stomp) o.push('patada sísmica a cada 6 s');
    if (f.furia) o.push('10 s de combo cheio = 5 s de iene ×2');
    if (f.autosack) o.push('recolhe os sacos sozinho');
    if (f.mordida) o.push('mordida perfeita mais larga e ×1,6');
    if (f.horn) o.push('libera a BUZINA');
    if (f.slide) o.push('avalanche grande vira evento ×1,5');
    if (f.silo) o.push('silo no pátio');
    if (f.boom) o.push('lança ' + pc(f.boom) + ' mais longa');
    return (n.size === 2 ? 'KEYSTONE: ' : '') + (o.join(' · ') || 'melhoria');
  }

  // init(api): monta o HUD. api = {stage, buyTool, buyNode, buyHouse, horn, nodeState, exportStr, importStr, reset, setOpt}
  HUD.init = function (a) {
    api = a; S = G.S;
    if (!UI) return;
    try { if (UI.loadFont && !/nofont/.test(location.search)) UI.loadFont(); } catch (e) { /* offline */ }
    ui = UI.mount(api.stage);
    const Z = HUD.zones; ['tl', 'tc', 'tr', 'mr', 'dock'].forEach(k => { Z[k] = ui.zone(k); });

    yenPill = UI.pill(Z.tl, { id: 'yen', icon: 'yen', big: true, value: S.money });
    rate = UI.rate(Z.tl, { icon: 'rice', label: '¥/s', every: 8, lines: [
      () => 'recorde: ¥' + U.fmt(S.stats.bestIps) + '/s',
      () => U.fmt(S.dug * 40) + ' grãos cavados',
      () => 'tempo: ' + U.fmtTime(S.time) ] });
    combo = UI.bar(Z.tl, { size: 'sm', label: 'combo', value: '×1,00', endowed: 0.1 });

    mount = UI.goal(Z.tc, { label: 'Montanha', w: 250, pct: true, done: 'acabou!', endowed: 0.12,
      ticks: [{ at: 0.06, color: PAL.pressD }, { at: 0.23, color: PAL.sakuraD || PAL.pink }, { at: 0.8, color: PAL.gold }] });

    flyer = UI.flyer(Z.tr, { art: 'house', title: 'Casa', sub: '', progress: 0, onClick: () => api.buyHouse() });
    const trCol = UI.el('div', 'k-col k-trcol', Z.tr);   // engrenagem e casa empilhadas: não alarga o canto
    // menu-central: tudo que é legal e ficava escondido (Casa, roupinhas, trocar, caderno, oficina, ilhas...) num lugar só
    const homeBtn = UI.button(trCol, { icon: 'chest', label: 'Menu do Kome', onClick: () => openMenu() });
    UI.tooltip(homeBtn, 'Menu do Kome: Casa, roupinhas, trocar ferramenta, caderno, oficina, ilhas');
    HUD.homeBadge = n => UI.badge(homeBtn.el || homeBtn, n);
    HUD.homeEl = homeBtn.el || homeBtn;
    const gear = UI.button(trCol, { icon: 'gear', onClick: () => aj.toggle ? aj.toggle() : aj.open() });
    trCol.insertBefore(gear.el || gear, trCol.firstChild);
    UI.tooltip(gear, 'Ajustes');
    UI.tooltip(flyer, () => { const h = D.HOUSE[S.house]; return h ? '<b>' + h.n + '</b><br>' + h.draw + (S.tool + 1 < h.tier ? '<br>precisa: ' + D.TOOLS[h.tier - 1].name : '') : 'A casa está pronta!'; });

    toolBtn = UI.button(Z.dock, { icon: icon('hashi'), iconSize: 36, title: '…', sub: '', w: 218, progress: 0, onClick: () => (!D.TOOLS[S.tool + 1] && S.ended && G.Inf) ? G.Inf.open() : api.buyTool() });
    UI.tooltip(toolBtn, () => { const t = D.TOOLS[S.tool + 1]; return t ? '<b>Próxima ferramenta: ' + t.name + '</b><br>' + t.act + '<br>' + t.size : 'Você tem a maior máquina do mundo.'; });
    for (let i = 0; i < 3; i++) slots.push(UI.button(Z.dock, { icon: 'paw', iconSize: 26, title: '…', sub: '', w: 150, progress: 0, onClick: () => quickBuy(i) }));
    slots.forEach((s, i) => UI.tooltip(s, () => { const n = slotNodes[i]; return n ? '<b>' + n.n + '</b><br>' + n.desc + '<br><i>' + n.see + '</i>' : ''; }));
    UI.spacer(Z.dock);
    hornBtn = UI.button(Z.dock, { icon: 'horn', tone: 'red', onClick: () => api.horn() });
    hornBtn.el.style.display = 'none';
    swapBtn = UI.button(Z.dock, { icon: 'swap', label: 'Trocar de ferramenta', onClick: () => openSwap() });   // fica escondido: agora mora no Menu do Kome
    UI.tooltip(swapBtn, 'Trocar de lugar: jogue com qualquer ferramenta que você já comprou');
    treeBtn = UI.button(Z.dock, { icon: 'tree', title: 'Árvore', sub: 'do Kome', badge: 0, onClick: () => treePanel.open() });

    // árvore: mapa de nós da engine
    for (const n of D.TREE) { n.desc = fxText(n); n.icon = n.icon || undefined; }
    treePanel = UI.panel({ title: 'Árvore do Kome', icon: 'tree', bare: true, onOpen: () => { HUD.treeOpen = true; if (tree) { if (tree.openAt) tree.openAt(); else tree.refresh(); } }, onClose: () => { HUD.treeOpen = false; } });
    const kome = document.createElement('canvas'); kome.width = 48; kome.height = 46;
    E.drawShiba(kome.getContext('2d'), 23, 44, 'sit', 0.5, { shadow: false });
    tree = UI.tree(treePanel.body, {
      nodes: D.TREE, branches: D.BRANCHES, synergies: D.SYN, center: { icon: kome, label: 'Kome', scale: 1.45, dy: -2 },
      owned: id => !!S.own[id], money: () => S.money, rate: () => S.ips,
      affordable: n => S.money >= api.nodeCost(n),
      fmtCost: c => '¥ ' + U.fmt(Math.ceil(c * D.ECON.COST_NODE)),
      locked: n => (S.tool + 1 < n.tier ? 'precisa: ' + D.TOOLS[n.tier - 1].name : null),
      onBuy(n) { return api.buyNode(n.id) ? undefined : false; },
    });
    UI.el('div', 'k-tree-hint', tree.el, 'arraste pra andar · roda ou pinça pra zoom · toque num nó, toque de novo pra comprar');
    HUD.tree = tree; HUD.treePanel = treePanel;

    // ajustes
    aj = UI.panel({ title: 'Ajustes', icon: 'gear', side: 'right' });
    UI.el('div', 'k-h', aj.body, 'Som');
    UI.toggle(aj.body, { icon: 'sound', label: 'Efeitos sonoros', value: !S.opts.mute, onChange: v => api.setOpt('mute', !v) });
    UI.toggle(aj.body, { icon: 'music', label: 'Música', sub: 'koto, shakuhachi e taiko', value: !!S.opts.music, onChange: v => api.setOpt('music', v) });
    UI.el('div', 'k-h', aj.body, 'Jogo');
    UI.toggle(aj.body, { icon: 'bolt', label: 'Tremor de tela', value: !!S.opts.shake, onChange: v => api.setOpt('shake', v) });
    UI.toggle(aj.body, { icon: 'star', label: 'Fundo em pixel', sub: 'céu, Fuji e morros no traço do Kome', value: S.opts.pixel !== false, onChange: v => api.setOpt('pixel', v) });
    UI.el('div', 'k-h', aj.body, 'Salvar');
    const r = UI.el('div', 'k-row', aj.body); r.style.flexWrap = 'wrap'; r.style.padding = '4px 0 8px';
    UI.button(r, { title: 'Exportar', size: 'sm', onClick: () => {
      const s = api.exportStr();
      const done = () => UI.toast('Save copiado', { icon: 'check', sub: 'cole num lugar seguro' });
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(done, () => window.prompt('Copie o save:', s)); else window.prompt('Copie o save:', s);
    } });
    UI.button(r, { title: 'Importar', size: 'sm', onClick: () => {
      const s = window.prompt('Cole o save aqui:'); if (!s) return;
      if (!api.importStr(s.trim())) UI.toast('Esse save não abriu', { icon: 'x', tone: 'bad' });
    } });
    UI.button(r, { title: 'Baixar arquivo', size: 'sm', onClick: () => {
      try {
        const s = api.exportStr(), d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/plain' })); a.download = 'kome-save-' + stamp + '.txt';
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
        UI.toast('Save baixado', { icon: 'check', sub: 'guarda o arquivo kome-save' });
      } catch (e) { UI.toast('Não deu pra baixar aqui', { icon: 'x', tone: 'bad', sub: 'use Exportar' }); }
    } });
    UI.button(r, { title: 'Abrir arquivo', size: 'sm', onClick: () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.json,text/plain';
      inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; const fr = new FileReader();
        fr.onload = () => { if (!api.importStr(String(fr.result || '').trim())) UI.toast('Esse save não abriu', { icon: 'x', tone: 'bad' }); }; fr.readAsText(f); };
      inp.click();
    } });
    UI.button(r, { title: 'Apagar tudo', size: 'sm', tone: 'red', onClick: () => UI.confirm('Isso apaga a montanha, a árvore e a casa. O Kome começa do zero.', () => api.reset(), { title: 'Apagar o save?', yes: 'Apagar', no: 'Deixa pra lá', danger: true }) });
    // modo infinito
    UI.button(aj.body, { title: 'Nova montanha (depois do final)', size: 'sm', onClick: () => { if (api.newMountain && api.newMountain()) aj.close && aj.close(); } });
    // guarda-roupa: achados enterrados (cores e acessórios do Kome)
    const wrH = UI.el('div', 'k-h', aj.body, 'Guarda-roupa'); wrH.style.display = 'none';   // agora mora na Casa › Roupas (com ícones)
    const wr = UI.el('div', 'k-row', aj.body); wr.style.display = 'none'; wr.style.flexWrap = 'wrap'; wr.style.padding = '4px 0 8px'; wr.style.gap = '4px';
    HUD.refreshCloset = () => {
      if (!api.closet) return; wr.innerHTML = '';
      const have = api.closet(), look = api.look();
      UI.button(wr, { title: (look.pal === 'kome' ? '✓ ' : '') + 'Kome clássico', size: 'sm', onClick: () => { api.wear('pal', 'kome'); HUD.refreshCloset(); } });
      for (const c of D.CLOSET) {
        const ok = have.indexOf(c.id) >= 0, on = ok && (c.kind === 'pal' ? look.pal === c.id : look.acc === c.id);
        const b = UI.button(wr, { title: ok ? (on ? '✓ ' : '') + c.n : '???', size: 'sm', onClick: () => { if (!ok) return; api.wear(c.kind, c.id); HUD.refreshCloset(); } });
        if (!ok && b && b.el) { b.el.style.opacity = '0.5'; } if (UI.tooltip && b) UI.tooltip(b.el || b, () => ok ? c.d : 'ache cavando bolsões de ouro');
      }
    };
    HUD.refreshCloset();
    HUD.settings = aj;

    HUD.ready = true;
    HUD.refreshSlots(); HUD.update(1, true);
  };

  // refreshSlots(): as 3 compras rápidas = nós abertos mais baratos
  HUD.refreshSlots = function () {
    if (!HUD.ready) return;
    slotNodes = D.TREE.filter(n => api.nodeState(n) === 'open').sort((a, b) => a.c - b.c).slice(0, 3);
    slots.forEach((s, i) => {
      const n = slotNodes[i];
      s.el.style.visibility = n ? '' : 'hidden';
      if (!n) return;
      s.el.style.setProperty('--k-accent', D.BRANCHES[n.branch].color);
      s.set({ title: n.n, icon: D.BRANCHES[n.branch].icon });
    });
    if (tree && HUD.treeOpen) tree.refresh();
  };
  /* ---- Menu do Kome: blocos grandes com ícone, nome, situação e "!" de novidade; bloqueado aparece apagado com dica ---- */
  let menuPanel = null;
  function openMenu() {
    if (!menuPanel) menuPanel = UI.panel({ title: 'Menu do Kome', icon: 'chest', side: 'right', cls: 'k-menupanel' });
    const b = menuPanel.body; b.innerHTML = '';
    const grid = UI.el('div', 'k-menugrid', b);
    const hd = S.homeData || {}, own = hd.own || {}, ach = S.stats.ach ? Object.keys(S.stats.ach).length : 0;
    const closet = (S.closet || []).length, ended = !!S.ended, isl = G.Islands ? G.Islands.island() : null;
    const go = fn => () => { menuPanel.close(); setTimeout(fn, 120); };
    const tiles = [
      { icon: 'house', t: 'Casa do Kome', s: Object.keys(own).filter(k => k.indexOf('th_') < 0).length + ' coisas no quintal', badge: hd.newAch ? '!' : 0, fn: go(() => api.openHome && api.openHome('jardim')) },
      { icon: 'hat', t: 'Roupinhas', s: closet + '/' + D.CLOSET.length + ' achadas cavando', badge: hd.newCloth ? '!' : 0, fn: go(() => api.openHome && api.openHome('roupa')) },
      { icon: 'swap', t: 'Trocar ferramenta', s: S.tool >= 1 ? 'jogue com qualquer uma que já comprou' : 'compre a 2ª ferramenta', lock: S.tool < 1, fn: go(() => openSwap()) },
      { icon: 'book', t: 'Caderno', s: ach + '/30 conquistas · missões', fn: go(() => api.openHome && api.openHome('caderno')) },
      { icon: 'bolt', t: 'Oficina', s: ended ? 'deixe sua máquina favorita mais forte' : 'libera depois de terminar a casa', lock: !ended, fn: go(() => G.Inf && G.Inf.open()) },
      { icon: 'boat', t: 'Ilhas', s: ended ? 'viajar · ' + (S.stats.seeds | 0) + ' sementes' : (isl ? isl.n + ' · ' : '') + 'viagem depois do final', lock: !ended && !(S.stats.islandsDone | 0), fn: go(() => (G.IslandsUI ? G.IslandsUI.open() : api.openHome && api.openHome('ilhas'))) },
      { icon: 'rice', t: 'Nova montanha', s: ended ? 'escolha o formato' : 'depois do final', lock: !ended, fn: go(() => api.newMountain && api.newMountain()) },
      { icon: 'gear', t: 'Ajustes', s: 'som, salvar, tremor', fn: go(() => aj.open()) },
    ];
    for (const it of tiles) {
      const bt = UI.button(grid, { icon: it.icon, iconSize: 30, title: it.t, sub: it.s, cls: 'k-menutile' + (it.lock ? ' k-locked' : ''), onClick: () => { if (it.lock) { UI.toast(it.t, { icon: 'lock', sub: it.s }); return; } it.fn(); } });
      if (it.badge) UI.badge(bt.el || bt, it.badge);
    }
    menuPanel.open();
  }
  // etapa 5: painel de troca (todas as ferramentas compradas; a atual marcada)
  function openSwap() {
    if (!swapPanel) swapPanel = UI.panel({ title: 'Trocar de lugar', icon: 'swap', side: 'right' });
    const b = swapPanel.body; b.innerHTML = '';
    const col = UI.el('div', 'k-col', b);
    UI.el('div', 'k-homehint', col, 'Um amigo shiba assume a máquina e o Kome pega a que você escolher. A renda continua a da sua melhor.');
    const now = api.playing && api.playing();
    for (let i = S.tool; i >= 0; i--) {
      const t = D.TOOLS[i], on = now === t;
      const bt = UI.button(col, { title: (on ? '✓ ' : '') + t.name, sub: on ? 'jogando agora' : (i === S.tool ? 'a melhor' : t.size || ''), icon: icon(t.id), size: 'sm',
        onClick: () => { if (api.playAs(i)) swapPanel.close(); } });
      (bt.el || bt).style.width = '100%';
    }
    // Gêmea pronta: dá pra pilotar ela (a 293 vai pro outro lado com o Goma)
    if (api.twinReady && api.twinReady()) {
      const on = api.twinPlaying && api.twinPlaying();
      const bt = UI.button(col, { title: (on ? '✓ ' : '') + 'Bagger Gêmea', sub: on ? 'pilotando agora' : '50% maior, duas rodas, cava 2x', icon: icon('bagger'), size: 'sm', tone: on ? '' : 'red',
        onClick: () => { if (api.playAs(S.tool, true)) swapPanel.close(); } });
      (bt.el || bt).style.width = '100%';
      col.insertBefore(bt.el || bt, col.children[1]);
    }
    swapPanel.open();
  }
  function quickBuy(i) {
    const n = slotNodes[i]; if (!n) return;
    if (api.buyNode(n.id)) slots[i].pop && slots[i].pop();
    else UI.toast('Faltam ' + yen(api.nodeCost(n) - S.money), { icon: 'yen', tone: 'bad', sub: n.n });
  }

  function goalBtn(btn, title, cost, lockTxt, ic) {
    const f = U.clamp(S.money / cost, 0, 1), can = S.money >= cost && !lockTxt;
    const eta = S.ips > 1 && !can ? ' · ≈ ' + U.fmtTime(Math.max(1, (cost - S.money) / S.ips)) : '';
    const o = { title, sub: lockTxt || (can ? yen(cost) + ' · dá pra comprar!' : 'faltam ' + yen(cost - S.money) + eta), progress: lockTxt ? 0 : 0.12 + 0.88 * f, state: lockTxt ? 'off' : can ? 'can' : '' };
    if (ic) o.icon = ic;
    btn.set(o);
  }

  // update(dt, force): atualiza os números (10x por segundo)
  // a Casa pulsa quando tem coisa pra comprar lá (ou roupinha nova); aviso único aos 2 minutos de jogo
  let homeChk = 0;
  function homeTick(dt) {
    if (!HUD.homeEl || (homeChk -= dt) > 0) return; homeChk = 2;
    const hd = S.homeData || {}, own = hd.own || {}, ips = Math.max(5, S.ips || 0);
    const cheap = D.DECOR ? D.DECOR.filter(x => !own[x.id] && (!x.needs || own[x.needs])).reduce((m, x) => Math.min(m, Math.ceil(x.sec * ips / 10) * 10), Infinity) : Infinity;
    HUD.homeEl.classList.toggle('k-pulse', S.money >= cheap || !!hd.newCloth || !!hd.newAch);
    if (!S.stats.homeTip && S.time > 120 && !S.endOpen) { S.stats.homeTip = 1; UI.toast('Novo: Casa do Kome!', { icon: 'house', tone: 'gold', sub: 'botão da casinha lá em cima: jardim, bichinhos, roupas e temas', dur: 7 }); }
  }
  HUD.update = function (dt, force) {
    homeTick(dt);
    if (!HUD.ready) return;
    acc += dt; sampleT += dt;
    if (acc < 0.1 && !force) return;
    acc = 0;
    yenPill.set(S.money);
    rate.set(S.ips);
    if (sampleT >= 5 || force) { sampleT = 0; rate.push(S.ips); }
    const st = api.stats(), cm = 1 + (st.comboCap - 1) * S.combo / D.COMBO.max;
    combo.set(S.combo / D.COMBO.max, null, { value: (S.furia > 0 ? 'FÚRIA ×' : '×') + (cm * (S.furia > 0 ? 2 : 1)).toFixed(2).replace('.', ',') });
    combo.el.classList.toggle('k-maxed', S.combo >= D.COMBO.max - 0.01);
    const tone = S.furia > 0 ? 'fury' : st.comboCap >= 2 ? 'pink' : st.comboCap > 1.5 ? 'sack' : '';
    if (tone !== lastComboTone && combo.tone) { combo.tone(tone); lastComboTone = tone; }
    mount.set(S.heapTotal - S.heapArea, S.heapTotal);

    const nt = D.TOOLS[S.tool + 1];
    if (nt) {
      let lock = null;
      if (nt.needs) for (const id of nt.needs) if (!S.own[id]) { lock = 'precisa: ' + D.nodeById[id].n; break; }
      goalBtn(toolBtn, nt.name, api.toolCost(nt), lock, toolBtn._id !== nt.id ? icon(nt.id) : null); toolBtn._id = nt.id;
    } else toolBtn.set(S.ended ? { title: 'Oficina', sub: 'melhorar as máquinas', progress: 1, state: '' } : { title: 'Bagger 293', sub: 'a maior máquina do mundo', progress: 1, state: '' });
    const h = D.HOUSE[S.house];
    if (h) {
      const c = api.houseCost(h), lock = S.tool + 1 < h.tier ? 'precisa: ' + D.TOOLS[h.tier - 1].name : null;
      const teaser = h.teaser && S.house < 2 ? h.teaser : c;
      flyer.set({ title: h.n, sub: lock || (S.money >= c ? yen(c) + ' · pagar!' : 'faltam ' + yen(c - S.money)), progress: 0.12 + 0.88 * U.clamp(S.money / teaser, 0, 1), state: lock ? 'off' : S.money >= c ? 'can' : '' });
    } else flyer.set({ title: 'Casa pronta', sub: 'onsen quentinho', progress: 1, state: '' });
    let nAff = 0;
    slots.forEach((s, i) => {
      const n = slotNodes[i]; if (!n) return;
      const c = api.nodeCost(n), can = S.money >= c;
      s.set({ sub: can ? yen(c) : 'faltam ' + yen(c - S.money), progress: 0.12 + 0.88 * U.clamp(S.money / c, 0, 1), state: can ? 'can' : '' });
    });
    for (const n of D.TREE) if (!S.own[n.id] && S.money >= api.nodeCost(n) && api.nodeState(n) === 'open') nAff++;
    treeBtn.set({ badge: nAff });
    hornBtn.el.style.display = S.own.b0 && api.playing && api.playing().kind === 'bagger' ? '' : 'none';
    (swapBtn.el || swapBtn).style.display = 'none';   // trocar ferramenta agora fica no Menu do Kome (menos botão na tela do celular)
  };

  HUD.bump = function () { if (HUD.ready && yenPill.bump) yenPill.bump(); };
  // endCard(rows): cartão simples do final com as estatísticas
  HUD.endCard = function (rows, onMore) {
    if (!UI) return;
    const rank = UI.el('div', 'k-rank', null, rows.rank || 'A');
    if (UI.clearBanners) UI.clearBanners(); document.querySelectorAll('.k-banner').forEach(b => b.remove());
    UI.dialog({ art: rank, kicker: 'Campanha concluída', title: 'O Kome comprou a casa no Japão!', text: 'A casa ficou pronta. O que sobrou da montanha continua lá: dá pra seguir cavando ou abrir uma montanha nova.',
      rows: rows.list, buttons: [{ title: 'Continuar cavando', tone: 'primary', onClick: onMore }] });
  };
})();
