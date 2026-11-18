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
| AMULETOS (omamori: build de cada ilha, 1 de 3 na chegada + marcos, até 5; conjuntos de 3 etiquetas; rerrolar com sementes) | ficha `conteudo/amuleto-<id>.js` (tipo `amuleto`, campos no topo do `tools/content.js`) + `node tools/content.js` → `D.AMULETOS`. Sistema `G.Amuletos` (applyStats, credit, mult, val, offer, pick, reroll, sim.best/drain) · números `D.AMULETO` (topo do amuletos.js) · ganchos no game.js: computeStats, PM, credit, ecoTick (combo e sacos), spawnSack, offline do boot; patio.js offlineOnce; fabrica.js sell/sellLoose · tela/chip/Caderno `G.AmuletosUI` · demo `?dev&amuleto=demo` · save `S.stats.am` (MIGR[6]) | `game/amuletos.js`, `game/amuletos-ui.js` |
| FAIXAS (stakes por volta: branca…preta, 1º Dan… sem fim; 1 regra nova por faixa; sementes ×1,5^faixa; faixa amarrada no Kome) | tabela `REGRAS` no topo do `game/faixas.js` (10 regras; do 4º Dan em diante reforça as numéricas até o teto) · `G.Faixas` (level = volta, rulesOf, has/mult/val, seedMul, mats, applyStats, card = tela cheia no estilo das cartas) · faixa no Kome = `E.shibaBelt(paleta, cor)` (engine/shiba.js, camada nova, poses iguais) · ganchos: game.js AM/computeStats/buildWorld/MATS/heap.draw, amuletos.js (max/cartas/chegada/baralho), islands.js gain/evTick/travel, eventos.js nextWait, islands-ui.js mapa · NÃO mexe em preço (preço por viagem já sobe por volta) · save `S.stats.fx` (MIGR[8]) · demo `?dev&faixa=3` | `game/faixas.js` |
| EVOLUÇÕES (máquina Oficina 25 + amuleto certo na ilha = versão absurda, ×3, cena curta, Caderno com "?") | ficha `conteudo/evolucao-<id>.js` (tipo `evolucao`: maquina, amuleto, visual, texto, fala) → `D.EVOLUCOES` · `G.Evolucoes` (ready, on, applyStats, caderno, VIS = peças extras por visual: ouro/carretas/bracos/dourada/foguete/chef) · desenho = embrulho do `G.Tools[id].draw` (liga `m.evo`; tools-hand.js usa pra lâmina de ouro) · números `D.ENDGAME.evo` · save `S.stats.evo` (MIGR[8]) · demo `?dev&evo=<id>` | `game/evolucoes.js` |
| Itens / Armazém (arroz por tipo) | `G.Items` (add, has, take, put, list, fill) · dados `D.ITEMS`, `D.ITEM_AREA` | `game/items.js`, aba Armazém da Casa |
| Sistema que roda por tempo / offline | `G.Sim = E.Sim()`; `G.Sim.add(id, {tick, offline})`; resultado do tempo fora em `S.away` | `engine/sim.js`, boot em `game.js` |
| Save novo de camada | sobe `SAVE_V` e põe 1 função em `MIGR` (topo do game.js); testar com `node tools/alicerce.js` | `game/game.js` |
| Segunda tela vista de cima (grid, toque, arrastar caminho, barra de ferramentas) | `E.Board({cols, rows, tools, drawCell, onTap, onDrag})` | `engine/board.js` |
| Tela da Fábrica (em obras; só no ?dev) | `G.Topo.open()`; esteira de teste na memória | `game/topo.js` |
| FÁBRICA (grid, máquinas, doca, divisor, save, offline, HUD, toque) | `G.Fab` (open, place, belt, state, persist) · números `D.FAB` · metas `node tools/fabrica-sim.js --runs 8` | `game/fabrica.js` (ver docs/PASSAGEM-fabrica.md) |
| PÁTIO DA FROTA (camada Cookie: quantidade, marcos, sinergias, Coração, conquistas) | `G.Patio` (tick, open, rate, heart, sim) · números `D.PATIO` · tabelas `D.COOKIE` | `game/patio.js`, `conteudo/cookie*.csv` → `node tools/cookie.js` → `game/cookie-data.js` |
| MÁQUINAS ABSURDAS no Pátio (turmas 15–20: Tatuzões, Kome-Oh, Trem-Bala, Foguete, Fuji, Portal) | números em `D.PATIO.turmas` (`seed` = nó, `tool` = G.Tools da cena) · nós `absurdo15..20` em `D.SEEDS` (islands.js, `req` = cadeia) · trava em `patio.js` (`unlocked`, adapter `patio()` com `locked/lockTxt`) · cena de chegada `G.Absurdas` (play, check; FAST pula) · demo `?dev&absurda=tatus` · silhueta no horizonte do Pátio = `G.Tools[tool].horizon` (tbm/komeoh/trembala/foguete/fuji/portal, em cache), lida pelo `patio-arte.js` do estado de verdade (`G.PatioArt.real()`) | `game/absurdas.js` |
| ARTE da Fábrica (galpão 3/4, máquinas por nível, esteiras, itens, toucas, kei-truck) | `G.FabArt` (geo, bg, belts, panela/moldadora/pilao/divisor, item, spr, worker) | `game/fabrica-arte.js` (carrega antes do fabrica.js) |
| ARTE+SOM dos eventos dourados (gatilho, Frenesi, Chuva, Gigante, Desfile, Tempestade, Festival) e Livro dos Eventos | `G.EventArt` (spawn, hitTrigger, take, start, on, tap, pop, end, openBook) · demo `?dev&evento=<id>` · `?dev&livro=demo` | `game/eventos-arte.js` (topo explica como ligar) |
| Galpão KOME PACK do pátio trabalhando (porta, caixas, kei-truck, vapor) | `working()` dentro de `drawFactory`; aparece com `G.Fab.on()`; vapor por `G.Fab.activity()` | `game/industry.js` |
| Vida no quintal da Casa (bichos andam/param) | `brain()`/`think()` | `game/home.js` |
| Ver todos os desenhos | `node tools/galeria.js` → 1 imagem | `%TEMP%/kome-galeria.png` |
| Ajustar números jogando | abrir o jogo com `?dev` (painel de desenvolvedor) | `game/dev.js` |

Formato da ficha e paleta das letras: ver cabeçalho de `tools/content.js`.

### Interfaces da camada Cookie (adaptador: `game/cookie-ui.js`)
Painel do Pátio, cartão "Enquanto você estava fora · Pegar!", Arroz do Coração (+8 Tigelas, galeria), Árvore de Sementes nova
(E.UI.tree), chips "Pátio" e "hora de partir", Cochilo do Kome (linha nos Ajustes entra sozinha em `G.HUD.settings`). A tela só
lê `G.CookieUI.api`; o sistema troca os falsos com **`G.CookieUI.use({ready, money, patio, total, price, maxBuy, buy, marco,
buyMarco, sinergias, buySinergia, coracao, conquistas, tigelas, buyTigela, seeds, seedTree, seedLevel, seedCost, buySeed, away,
claimAway, partir, openMap, onSettings, onCochilo})`** (formato de cada um no topo do arquivo). Falsos e a árvore proposta de
34+6 nós: seção 10 do arquivo (apagar quando o sistema existir); textos da planilha no demo vêm de `game/cookie-demo-data.js`
(gerado do CSV, carregado só no demo). Arte: `game/cookie-arte.js` (`G.CookieArt`). Demo: `?dev&cookie=demo` (`&away=cap`,
`&cochilo=1`). Ajuste salvo: `S.opts.cochilo` (false = desligado).

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
| Ilhas (fichas, sementes, viagem, medalhas, evento da ilha) | `game/islands.js` · D.ISLANDS (scene = perfil de cena), D.SEEDS, travel, makeSave, onEnding, evTick, priceMul (preço por viagem: `D.ENDGAME.price.trip`/`grow`) · números em `D.ENDGAME` (data.js) |
| Cenário de cada ilha (fundo, pátio, crista da montanha, partículas, mapa do Japão) | `game/scenery.js` · far (peaks/volcano/sea/mochi), YARD, crest, air, japan |
| Mapa das ilhas, chip do HUD, tutorial | `game/islands-ui.js` · open, chipTick, tour |
| Montanha espelhada (ilha com scene.mirror) | `engine/fx.js` Camera `mx` + `game/game.js` setMirror (só desenho/entrada viram; simulação igual) |
| Kome sente o clima (frio, calor, praia) | `game/game.js` · FEEL, feelFlags, feelTick, drawFeel, drawBreath |
| Cutscenes do fim de jogo | `game/cutscenes.js` · ilhas, chegada, ilhafim, finale (Kome-Oh de `game/komeoh.js`) |
| Conquistas e missões | `game/goals.js` · ACH, TPL |
| Ferramentas de mão / máquinas | `game/tools-hand.js`, `machines-mid.js`, `machines-mine.js`, `colheitadeira.js`, `bagger.js`, absurdas `tbm.js`, `komeoh.js`, `trembala.js` (interface G.Tools[id]) |

## Engine Pixxel
`engine/` (docs em PIXXEL.md, gerado por `node tools/docs.js`). Pixel art: `E.sprite`, `E.spriteText` (desenho em texto) em `pix.js`.

## Testar (sempre, nessa ordem)
1. `node tools/check.js --fast` (telas e erros, 20 s) — `node tools/check.js` inclui o balanço (1 min)
2. `node tools/sweep.js` → olhar as 3 folhas de contato (visual de todas as telas)
3. `node tools/monkey.js` → robô apertando tudo aleatório (erros, travas, dinheiro estranho)
4. `node tools/single.js "C:/Users/elias/Desktop/Kome no Japão (celular).html"` → HTML pro celular
