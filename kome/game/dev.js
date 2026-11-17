/* Kome no Japão — dev.js
   Painel de desenvolvedor: abra o jogo com ?dev no fim do endereço (ex.: index.html?dev).
   Pra testar e ajustar SEM programar: dar dinheiro, pular pra qualquer ferramenta, acelerar o tempo, liberar tudo e
   mexer nos números do balanço com controles deslizantes. "Copiar ajustes" gera o texto pra colar pro Claude
   (ele cola em game/data.js). Nada daqui é salvo no jogo; recarregar a página volta tudo ao normal. */
(function () {
  'use strict';
  if (!/[?&]dev\b/.test(location.search) && !window.KOME_DEV) return;   // ?dev no endereço, ou o HTML de admin
  const G = (window.KomeGame = window.KomeGame || {});
  const box = document.createElement('div'); box.className = 'k-dev';
  box.innerHTML = '<button class="k-dev-t">DEV ▾</button><div class="k-dev-b"></div>';
  const css = document.createElement('style');
  css.textContent = `.k-dev{position:fixed;left:6px;top:50%;transform:translateY(-50%);z-index:99990;font:600 12px system-ui;color:#2A1A10}
  .k-dev-t{background:#2A1A10;color:#FFF;border:0;border-radius:8px;padding:6px 10px;font-weight:800;cursor:pointer}
  .k-dev-b{display:none;margin-top:4px;background:#FFFAEE;border:2px solid #2A1A10;border-radius:10px;padding:8px;width:250px;max-height:78vh;overflow:auto;box-shadow:0 4px 0 #2A1A10}
  .k-dev.on .k-dev-b{display:block}.k-dev h4{margin:8px 0 4px;font-size:12px}.k-dev button.b{margin:2px;padding:4px 7px;border:2px solid #2A1A10;border-radius:7px;background:#F3DC9A;font:700 11px system-ui;cursor:pointer}
  .k-dev label{display:block;margin:4px 0}.k-dev input[type=range]{width:100%}.k-dev select{width:100%}`;
  document.head.appendChild(css);
  function start() {
    const K = window.__kome; if (!K) return setTimeout(start, 300);
    const D = K.data, S = K.S, EC = D.ECON, base = JSON.parse(JSON.stringify({ COST_TOOL: EC.COST_TOOL, COST_NODE: EC.COST_NODE, COST_HOUSE: EC.COST_HOUSE, P0: EC.P0 }));
    document.body.appendChild(box);
    const b = box.querySelector('.k-dev-b');
    box.querySelector('.k-dev-t').onclick = () => box.classList.toggle('on');
    const H = t => { const h = document.createElement('h4'); h.textContent = t; b.appendChild(h); };
    const btn = (t, fn) => { const x = document.createElement('button'); x.className = 'b'; x.textContent = t; x.onclick = () => { fn(); x.blur(); }; b.appendChild(x); };
    // atalhos de fase: deixa o jogo como se você tivesse jogado até ali (árvore até aquele degrau, casa e dinheiro)
    H('Pular pra fase');
    const fase = (tool, house, money, extra) => () => {
      K.setTool(tool); for (const n of D.TREE) if (n.tier <= tool + 1 && !n.needs) S.own[n.id] = true; S.house = Math.max(S.house, house);
      K.addMoney(money); if (extra) extra(); K.step(0.1);
    };
    const TI = D.toolIndex;
    btn('começo (pá)', fase(TI.pa, 0, 3000));
    btn('trator', fase(TI.trator, 1, 2e5));
    btn('escavadeira', fase(TI.escav, 2, 3e6));
    btn('caminhão', fase(TI.caminhao, 3, 1e7));
    btn('Bagger', fase(D.TOOLS.length - 1, 4, 5e7));
    btn('final + infinito', fase(D.TOOLS.length - 1, D.HOUSE.length, 1e12, () => { S.ended = true; for (const n of D.TREE) S.own[n.id] = true; }));
    btn('Gêmea pronta', () => { fase(D.TOOLS.length - 1, D.HOUSE.length, 1e13, () => { S.ended = true; })(); const r = G.Ind && G.Ind.run(); if (r) { r.giant = 4; r.fab = 8; } if (G.Ind) G.Ind.showTwin(); });
    btn('pilotar a Gêmea', () => { fase(D.TOOLS.length - 1, D.HOUSE.length, 1e13, () => { S.ended = true; })(); const r = G.Ind && G.Ind.run(); if (r) r.giant = 4; K.playAs(D.TOOLS.length - 1, true); });
    btn('viajar pra próxima ilha', () => { S.ended = true; S.earned = Math.max(S.earned, 4e9); if (G.Islands) G.Islands.go(Math.min(4, (S.island | 0) + 1)); });
    H('Volta ao Japão (ilhas)');
    (D.ISLANDS || []).forEach((I, i) => btn('ir pra ' + I.n.replace('Ilha Flutuante de ', ''), () => { K.setIsland(i); }));
    btn('evento da ilha', () => K.islandEvent && K.islandEvent(true));
    btn('RESETAR (apaga o save)', () => { if (confirm('Apagar o save do admin e começar do zero?')) G.Game.reset(); });
    btn('TATUZÃO', () => { S.ended = true; if (G.Tatu) G.Tatu.own(); });
    btn('FÁBRICA', () => { S.ended = true; if (G.Fab) { G.Fab.unlock(); G.Fab.open(); } });
    btn('fábrica: tudo liberado', () => { S.ended = true; if (G.Fab) { G.Fab.unlock(); G.Fab.unlockAll(); G.Fab.skipTut(); K.addMoney(1e15); G.Fab.open(); } });
    btn('tela de cima (E.Board)', () => { if (G.Topo) G.Topo.open(); });
    btn('mapa das ilhas', () => { S.ended = true; if (G.IslandsUI) G.IslandsUI.open(); });
    btn('cutscene Volta ao Japão', () => K.play && K.play('ilhas'));
    btn('tutorial das ilhas', () => { S.ended = true; if (G.IslandsUI) G.IslandsUI.tour(); });
    btn('cutscene chegada', () => K.play && K.play('chegada'));
    btn('cutscene fim de ilha', () => { S.islandRes = S.islandRes || { medal: 3, sec: 1900, bonus: 5, newBest: true }; K.play && K.play('ilhafim'); });
    btn('Grande Final (Kome-Oh)', () => K.play && K.play('finale'));
    H('Abrir telas');
    btn('Casa', () => G.Home && G.Home.open('jardim'));
    btn('Oficina', () => { S.ended = true; if (G.Inf) G.Inf.open(); });
    btn('cena da noite', () => { S.dayT = 9999; });
    btn('cutscene da Bagger', () => K.play && K.play('bagger'));
    btn('cutscene final', () => K.play && K.play('final'));
    H('Dinheiro');
    for (const [t, v] of [['+1 mil', 1e3], ['+1 mi', 1e6], ['+1 bi', 1e9], ['+1 tri', 1e12]]) btn(t, () => K.addMoney(v));
    H('Pular pra ferramenta');
    const sel = document.createElement('select'); D.TOOLS.forEach((t, i) => { const o = document.createElement('option'); o.value = i; o.textContent = (i + 1) + '. ' + t.name; sel.appendChild(o); });
    sel.onchange = () => { K.setTool(+sel.value); sel.blur(); }; b.appendChild(sel);
    H('Tempo');
    const sp = document.createElement('label'); sp.innerHTML = 'velocidade <b>×1</b><input type="range" min="1" max="20" value="1">';
    sp.querySelector('input').oninput = e => { G.devSpeed = +e.target.value; sp.querySelector('b').textContent = '×' + G.devSpeed; }; b.appendChild(sp);
    btn('virar o dia', () => { S.dayT = 9999; });
    H('Liberar');
    btn('árvore toda', () => { for (const n of D.TREE) S.own[n.id] = true; K.step(0.05); });
    btn('todas as roupas', () => { S.closet = D.CLOSET.map(c => c.id); });
    btn('casa pronta', () => { S.house = D.HOUSE.length; });
    btn('terminar campanha', () => { K.setTool(D.TOOLS.length - 1); S.ended = true; });
    btn('Casa: tudo', () => { const d = G.Home && G.Home.data(); if (d) D.DECOR.forEach(x => d.own[x.id] = 1); });
    H('Balanço (ao vivo)');
    const slider = (key, lab, min, max, step) => {
      const l = document.createElement('label'); l.innerHTML = lab + ' <b>' + EC[key] + '</b><input type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + EC[key] + '">';
      l.querySelector('input').oninput = e => { EC[key] = +e.target.value; l.querySelector('b').textContent = EC[key]; K.step(0.01); };
      b.appendChild(l);
    };
    slider('COST_TOOL', 'preço das ferramentas ×', 0.3, 3, 0.01);
    slider('COST_NODE', 'preço da árvore ×', 0.3, 3, 0.01);
    slider('COST_HOUSE', 'preço da casa ×', 0.3, 3, 0.01);
    slider('P0', 'valor do arroz (P0)', +(base.P0 * 0.2).toFixed(4), +(base.P0 * 5).toFixed(4), +(base.P0 / 50).toFixed(5));
    H('Mandar pro Claude');
    btn('Copiar ajustes', () => {
      const ch = Object.keys(base).filter(k => EC[k] !== base[k]).map(k => k + ': ' + EC[k] + '   (era ' + base[k] + ')');
      const txt = ch.length ? 'Ajustes do painel dev (game/data.js, D.ECON):\n' + ch.join('\n') : 'nenhum ajuste mudado';
      (navigator.clipboard ? navigator.clipboard.writeText(txt).then(() => alert('Copiado! Cola na conversa com o Claude.\n\n' + txt), () => prompt('Copie:', txt)) : prompt('Copie:', txt));
    });
    const info = document.createElement('div'); info.style.marginTop = '6px'; b.appendChild(info);
    setInterval(() => { info.textContent = 'ferramenta ' + (S.tool + 1) + '/' + D.TOOLS.length + ' · ¥/s ' + Math.round(S.ips) + ' · tempo ' + Math.round(S.time / 60) + ' min'; }, 500);
  }
  if (document.readyState === 'complete') start(); else addEventListener('load', start);
})();
