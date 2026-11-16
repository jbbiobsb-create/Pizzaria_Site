# MAPA do Kome — onde mora cada coisa

Leia isto ANTES de procurar no código. Use os nomes de função com `grep -n "function nome"` (número de linha muda; nome não).

## Quero adicionar conteúdo (o caminho barato)
| Coisa | Como | Arquivo |
|---|---|---|
| Roupinha (acessório desenhado), enfeite da Casa, bichinho, evento, loja | `node tools/novo.js <tipo> "Nome"` cria a ficha; editar o desenho em texto; `node tools/content.js` | `conteudo/*.js` → gera `game/content.js` |
| Cor nova do Kome (paleta) | entrada em `PALS` + ficha `roupa` com `cor:` | `engine/shiba.js`, `conteudo/` |
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
| Câmera e zoom | `game/game.js` · camTick, setZoomMul |
| Desenho do mundo | `game/game.js` · render, drawMach (cache) · `game/game-world.js` · drawBack, drawCity, drawYard, props, RULER |
| Construções em pixel do pátio | `game/game-world.js` · sCasinha, sVila, sFabrica… (PSPR), props[] |
| HUD, botões, árvore, menu, trocar | `game/game-ui.js` · HUD.init, openMenu, openSwap, quickBuy |
| Celular: joystick, CAVAR, zoom, layout | `game/game.js` · mobileInit, layoutPad, fitHud · `game/game.css` |
| Casa do Kome (quintal, abas) | `game/home.js` · scene, refresh, list, openHome |
| Modo infinito: Oficina e eventos | `game/infinite.js` · mult, powK, EVENTS, up |
| Bagger Gêmea, fábrica, lojas | `game/industry.js` · D.GIANT, D.SHOPS, drawFactory |
| Esteiras | `game/belts.js` |
| Ilhas e sementes | `game/islands.js` · D.ISLANDS, D.SEEDS, travel, boat |
| Conquistas e missões | `game/goals.js` · ACH, TPL |
| Ferramentas de mão / máquinas | `game/tools-hand.js`, `machines-mid.js`, `machines-mine.js`, `colheitadeira.js`, `bagger.js` (interface G.Tools[id]) |

## Engine Pixxel
`engine/` (docs em PIXXEL.md, gerado por `node tools/docs.js`). Pixel art: `E.sprite`, `E.spriteText` (desenho em texto) em `pix.js`.

## Testar (sempre, nessa ordem)
1. `node tools/check.js --fast` (telas e erros, 20 s) — `node tools/check.js` inclui o balanço (1 min)
2. `node tools/sweep.js` → olhar as 3 folhas de contato (visual de todas as telas)
3. `node tools/monkey.js` → robô apertando tudo aleatório (erros, travas, dinheiro estranho)
4. `node tools/single.js "C:/Users/elias/Desktop/Kome no Japão (celular).html"` → HTML pro celular
