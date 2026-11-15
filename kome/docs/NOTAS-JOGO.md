# Notas do jogo (etapa 1 pronta) — pra quem continuar

Arquivos: index.html, game/data.js (TODO o balanceamento), game/game.js (estado, economia, um driver por tipo de ferramenta,
compras e celebração, câmera, render, laço, window.__kome), game/game-world.js (fundo, régua do mundo, casa, coletor),
game/game-ui.js (HUD E.UI, árvore, ajustes), game/game.css, tools/playtest.js.

Teste: `node kome/tools/playtest.js [--rungs] [--auto] [--prints] [--min N] [--verbose]`. `?fresh` na URL começa jogo novo.
Jogador automático (última rodada): final em 74,9 min; maior intervalo entre compras 138–168 s; Bagger aos 64,6 min com 37% cavado;
fase Bagger ~10 min; cavado no final 70–73% (alvo era 85–95: ABAIXO); 86 compras.

Ajustes de balanceamento feitos (data.js): `ECON.EXTRA_BY_TOOL` = multiplicador de renda por degrau (1,35–2,6) no lugar da renda que
o GDD conta mas ainda não existe (missões, visitantes, selos, conquistas): BAIXAR conforme esses sistemas entrarem. Bagger A 1900→1300.

## Falta (etapa 2)
- Ajudantes e pilotos são auto-escavação abstrata (`autoTick()`); máquinas com piloto ficam estacionadas.
- Não feito: corvos, visitantes, renda offline, selos, ciclo de dia, caminhão de entrega e cartão de silhuetas na celebração,
  sombras de máquina, Kome soterrado na trombada, rachaduras da britadeira, cutscenes, conquistas, missões, álbum, achados cosméticos.
- Nós só-número: m7a, m7b, s10, a6, b3. Só animação mais rápida: c1, cA, cB, cC, cD. Sem arte própria: c_reach, b2, a5, p4/p5, c6.
- Frota estacionada e prédios da régua se sobrepõem no pátio. Retrato/toque não testados.
- Toasts e cartão de celebração usam relógio real (sobram depois de `step()`).

## Pontos de extensão
- Eventos: `KomeGame.Game.on(ev, fn)`: dug, pay(v,kind), buyTool, buyNode, buyHouse, pocket, sack, ending. `S.stats` é salvo.
- Ajudantes/pilotos: trocar `autoTick()`; `S.helpers`, `S.fleet` ({id,x,y,m} com rigs vivos, `fleetTick`), `stats().pilots/.help`;
  `Game.pay(v,x,y,1)` = pop cinza pequeno.
- Transporte: `S.col` ({x,y,kind,pulse}), `collectorTick`, `World.drawCollector`, fila `pays` em `pay()`/`credit()`.
- Cutscenes: `celebrate()`/`celeTick()`, `S.cele` (passos da Bagger = ramos `c.step`); `buyHouse()`; `ending()`.
- Cosméticos: `PILOT_PAL`/`HELP_PAL`, opção `pilot:` em `setTool` → `T.create`.
- Dia: constante `tod: 0.42` em `World.drawBack`; `inp.night` já vai pros rigs.
- Cenário: `World.props.push({node | when(S), x, draw})`, `World.layers.back/.front`. HUD: `KomeGame.HUD.zones` (tl,tc,tr,mr,dock).
- Notas de engine: `heap.minK` do jogo = 0.41; material é por posição (arroz solto que desliza abaixo da linha do mochi conta como mochi);
  `E.UI.tree` precisa de `tree.openAt()` no `onOpen` do painel.
