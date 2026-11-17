# MAPA do Kome — onde mora cada coisa

Leia isto ANTES de procurar no código. Use os nomes de função com `grep -n "function nome"` (número de linha muda; nome não).

## Quero adicionar conteúdo (o caminho barato)
| Coisa | Como | Arquivo |
|---|---|---|
| Roupinha (acessório desenhado), enfeite da Casa, bichinho, evento, loja | `node tools/novo.js <tipo> "Nome"` cria a ficha; editar o desenho em texto; `node tools/content.js` | `conteudo/*.js` → gera `game/content.js` |
| Cor nova do Kome (paleta) | entrada em `PALS` + ficha `roupa` com `cor:` | `engine/shiba.js`, `conteudo/` |
| Arte animada por receita (bicho, casa, loja, objeto) | ficha com `receita:` + `node tools/arte.js --galeria` (geradores do Pixxel Estúdio) | `conteudo/` → `conteudo/arte/*.pixxel.js` |
| Conteúdo em massa (planilha CSV → fichas + arte) | `node tools/planilha.js conteudo.csv` (modelo em `docs/design/modelo-planilha.csv`) | `conteudo/` |
| Medir 10–100 h de jogo (onde fica chato) | `node tools/longo.js --horas 10` (3 h simuladas ≈ 50 s) | ganchos `sim` em infinite/industry/home/islands |
| Itens / Armazém (arroz por tipo) | `G.Items` (add, has, take, put, list, fill) · dados `D.ITEMS`, `D.ITEM_AREA` | `game/items.js`, aba Armazém da Casa |
| Sistema que roda por tempo / offline | `G.Sim = E.Sim()`; `G.Sim.add(id, {tick, offline})`; resultado do tempo fora em `S.away` | `engine/sim.js`, boot em `game.js` |
| Save novo de camada | sobe `SAVE_V` e põe 1 função em `MIGR` (topo do game.js); testar com `node tools/alicerce.js` | `game/game.js` |
| Segunda tela vista de cima (grid, toque, arrastar caminho, barra de ferramentas) | `E.Board({cols, rows, tools, drawCell, onTap, onDrag})` | `engine/board.js` |
| Tela da Fábrica (em obras; só no ?dev) | `G.Topo.open()`; esteira de teste na memória | `game/topo.js` |
| FÁBRICA (grid, máquinas, doca, divisor, save, offline, HUD, toque) | `G.Fab` (open, place, belt, state, persist) · números `D.FAB` · metas `node tools/fabrica-sim.js --runs 8` | `game/fabrica.js` (ver docs/PASSAGEM-fabrica.md) |
| ARTE da Fábrica (galpão 3/4, máquinas por nível, esteiras, itens, toucas, kei-truck) | `G.FabArt` (geo, bg, belts, panela/moldadora/pilao/divisor, item, spr, worker) | `game/fabrica-arte.js` (carrega antes do fabrica.js) |
| ARTE+SOM dos eventos dourados (gatilho, Frenesi, Chuva, Gigante, Desfile, Tempestade, Festival) e Livro dos Eventos | `G.EventArt` (spawn, hitTrigger, take, start, on, tap, pop, end, openBook) · demo `?dev&evento=<id>` · `?dev&livro=demo` | `game/eventos-arte.js` (topo explica como ligar) |
| Galpão KOME PACK do pátio trabalhando (porta, caixas, kei-truck, vapor) | `working()` dentro de `drawFactory`; aparece com `G.Fab.on()`; vapor por `G.Fab.activity()` | `game/industry.js` |
| Vida no quintal da Casa (bichos andam/param) | `brain()`/`think()` | `game/home.js` |
| Ver todos os desenhos | `node tools/galeria.js` → 1 imagem | `%TEMP%/kome-galeria.png` |
| Ajustar números jogando | abrir o jogo com `?dev` (painel de desenvolvedor) | `game/dev.js` |

Formato da ficha e paleta das letras: ver cabeçalho de `tools/content.js`.

## Balanço (só números)
`game/data.js`: `D.ECON` (COST_TOOL/NODE/HOUSE, P0, EXTRA_BY_TOOL, BOOST), `D.TOOLS` (cost, A, r, pow, zoom), `D.TREE` (nós, c, fx),
`D.HOUSE`, `D.MATS` (camadas), `D.COMBO`, `D.DECOR`, `D.THEMES`, `D.CLOSET`. Metas: `node tools/playtest.js --auto`.

## Onde está cada sistema
| Sistema | Arquivo · funções |
|---|---|
| Estado, save, carregar | `game/game.js` · S (topo), saveNow, loadState |
| Efeitos de árvore/casa/selos/ilha/oficina | `game/game.js` · computeStats (tudo que multiplica renda passa aqui) |
| Montanha: formato, camadas, bolsões | `game/game.js` · mountainShape, SHAPE_MATS, MATS, buildWorld · `engine/terrain.js` (E.Heap, E.SlideFX) |
| Renda: cavar, pagar, combo, sacos, onigiri | `game/game.js` · digAt, pay, credit, ecoTick, spawnSack, tapOnigiri |
| Ajudantes, frota, Goma pilotando | `game/game.js` · autoTick, fleetWork, fleetTick, helpersTick, rebuildFleet |
| Dirigir ferramentas | `game/game.js` · driveHand, driveMachine, driveHaul, driveBagger; `setTool`, `playAs` (trocar) |
| Compras e festa | `game/game.js` · buyTool, buyNode, buyHouse, celebrate, ending |
| Dia/noite | `game/game.js` · DAY_SEC, dayTick, drawDayEnd |
| Cutscenes | arte e falas: `game/cutscenes.js` (SHOTS) · controle: `game/game.js` · csPlay, csNext, drawCutscene |
| Câmera e zoom | `game/game.js` · camTick, setZoomMul (prints: `S.camLock = {x, y, z}`) |
| Desenho do mundo | `game/game.js` · render, drawMach (cache) · `game/game-world.js` · drawBack, drawCity, drawYard, props, RULER |
| Construções em pixel do pátio | `game/game-world.js` · sCasinha, sVila, sFabrica… (PSPR), props[] |
| HUD, botões, árvore, menu, trocar | `game/game-ui.js` · HUD.init, openMenu, openSwap, quickBuy |
| Celular: joystick, CAVAR, zoom, layout | `game/game.js` · mobileInit, layoutPad, fitHud · `game/game.css` |
| Casa do Kome (quintal, abas) | `game/home.js` · scene, refresh, list, openHome |
| Modo infinito: Oficina e eventos | `game/infinite.js` · mult, powK, EVENTS, up |
| Bagger Gêmea, fábrica, lojas | `game/industry.js` · D.GIANT, D.SHOPS, drawFactory |
| Esteiras | `game/belts.js` |
| Ilhas (fichas, sementes, viagem, medalhas, evento da ilha) | `game/islands.js` · D.ISLANDS (scene = perfil de cena), D.SEEDS, travel, makeSave, onEnding, evTick · números em `D.ENDGAME` (data.js) |
| Cenário de cada ilha (fundo, pátio, crista da montanha, partículas, mapa do Japão) | `game/scenery.js` · far (peaks/volcano/sea/mochi), YARD, crest, air, japan |
| Mapa das ilhas, chip do HUD, tutorial | `game/islands-ui.js` · open, chipTick, tour |
| Montanha espelhada (ilha com scene.mirror) | `engine/fx.js` Camera `mx` + `game/game.js` setMirror (só desenho/entrada viram; simulação igual) |
| Kome sente o clima (frio, calor, praia) | `game/game.js` · FEEL, feelFlags, feelTick, drawFeel, drawBreath |
| Cutscenes do fim de jogo | `game/cutscenes.js` · ilhas, chegada, ilhafim, finale (Kome-Oh de `game/komeoh.js`) |
| Conquistas e missões | `game/goals.js` · ACH, TPL |
| Ferramentas de mão / máquinas | `game/tools-hand.js`, `machines-mid.js`, `machines-mine.js`, `colheitadeira.js`, `bagger.js` (interface G.Tools[id]) |

## Engine Pixxel
`engine/` (docs em PIXXEL.md, gerado por `node tools/docs.js`). Pixel art: `E.sprite`, `E.spriteText` (desenho em texto) em `pix.js`.

## Testar (sempre, nessa ordem)
1. `node tools/check.js --fast` (telas e erros, 20 s) — `node tools/check.js` inclui o balanço (1 min)
2. `node tools/sweep.js` → olhar as 3 folhas de contato (visual de todas as telas)
3. `node tools/monkey.js` → robô apertando tudo aleatório (erros, travas, dinheiro estranho)
4. `node tools/single.js "C:/Users/elias/Desktop/Kome no Japão (celular).html"` → HTML pro celular
