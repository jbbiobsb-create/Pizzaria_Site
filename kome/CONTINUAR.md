# Kome no Japão — passagem de bastão pro próximo chat

Cole este arquivo (ou peça pro Claude ler `kome/CONTINUAR.md`) no começo da próxima conversa, junto com a pasta `kome/`.

## Prompt pronto pra colar

> Estou continuando o jogo **Kome no Japão** (pasta `kome/`). Leia `kome/CONTINUAR.md` inteiro antes de mexer em qualquer coisa,
> depois `kome/docs/NOTAS-JOGO.md` e `kome/docs/GDD-ADENDO.md`. Trabalhe no modo econômico (ver `CLAUDE.md`): não precisa
> me mandar print nem esperar aprovação a cada passo; verifique com `node tools/check.js`.
> Continue de onde a "Rodada de 16/11" parou.

## O que é

Jogo incremental de navegador (canvas 2D + HUD em DOM, sem dependências, sem build, texto em pt-BR). O Kome, um shiba chibi de
chapéu de palha, cava uma montanha de arroz com 13 ferramentas, da pata até uma Bagger 293 que ele mesmo pilota, pra comprar
uma casa no Japão. Roda abrindo `kome/index.html` direto do disco.

O projeto tem duas metades com o mesmo peso pro dono:
1. **O jogo.**
2. **A Pixxel** (`kome/engine/`), reaproveitável: a ideia é pedir "um lago de carpas", "um alce", "um carro" e já sair no
   estilo Kome.

## Como rodar e testar

- Jogo: abrir `kome/index.html`. Controles: mouse (segurar) ou teclado (A/D ou setas anda, W/S/Espaço cava). `?fresh` na URL começa do zero. Save em localStorage, chave `kome-no-japao-v4`.
- Demos da engine: `kome/demos/index.html`.
- Screenshot headless (Chromium + Playwright já instalados no ambiente de nuvem):
  `node kome/tools/shot.js <pagina.html> <saida.png> [--wait ms] [--query "?a=1"] [--eval "js"] [--scale 2] [--size 960x540]`
  Sai com código 1 se houver erro de página. **Sempre abrir o PNG e olhar.**
- Teste do jogo: `node kome/tools/playtest.js [--rungs] [--auto] [--prints] [--min N] [--verbose]`
  `--rungs` compra e usa as 13 ferramentas; `--auto` joga uma partida inteira acelerada e imprime a linha do tempo.
- Ganchos no console: `__kome.S` (estado), `.addMoney(v)`, `.buyTool()`, `.buyNode(id)`, `.buyHouse()`, `.setTool(i)`,
  `.step(dt)`, `.hold(x,y,on)`, `.reset()`.

## Mapa dos arquivos

```
kome/
  index.html              o jogo
  CONTINUAR.md            este arquivo
  LEIA-ME.txt
  engine/                 Pixxel (classic scripts; ordem: core, pix, shiba, fx, terrain, rig, audio, nature, ui)
    core.js     U, RNG, Noise, Tween, Stage, Input, Loop, Scenes, Save
    pix.js      PAL (paleta), Pix (pixel art), sprite, Draw.* (treliça, esteira, pistão, pneu, escada, placa...)
    shiba.js    o Kome: 39 poses, 11 paletas, drawShiba, drawShibaHead, shibaAnchor, Actor
    fx.js       Camera, Particles, Floaters, ScreenFX
    terrain.js  Heap (montanha de arroz em camadas, grãos visíveis), Pile, Grains
    rig.js      Rig, ik2/ik3, Joint, Chassis, Exhaust, Conveyor, Rope, Telescope, Spring
    audio.js    Sfx, Loops, Music generativa
    nature.js   cenário japonês: céu por hora do dia, Fuji, árvores, torii, casa em estágios, Pond, Koi
    ui.js + pixxel.css   HUD em DOM, árvore em mapa, painéis, toasts
  game/
    data.js            TODO o balanceamento (ferramentas, materiais, árvore de 68 nós, casa, economia)
    game.js            estado, economia, drivers das ferramentas, compras, celebração, câmera, laço
    game-world.js      fundo, "régua do mundo", casa, coletor
    game-ui.js         HUD, árvore, ajustes
    tools-hand.js      pata, hashi, tigela, pa, duaspas, carrinho, britadeira (+ G.Props: sacos, ícones)
    machines-mid.js    trator, empilhadeira, escav
    machines-mine.js   pacabo (pá de cabo), caminhao (+ G.Scale: pickup, keitruck, moega)
    bagger.js          Bagger 293
    colheitadeira.js   Colheitadeira
    home.js            Casa do Kome (quintal, bichinhos, roupas, temas, caderno)
    infinite.js        modo infinito: Oficina e eventos
    islands.js / islands-ui.js / scenery.js   volta ao Japão: ilhas, mapa, cenário de cada ilha
    goals.js           conquistas, missões, caderno
  demos/                 uma página por módulo/arquivo de máquina
  tools/                 shot.js, playtest.js, ENGINE_CONTRACT.md, ART_DIRECTION.md
  CLAUDE.md               regras curtas pro Claude (economia de token)
  docs/
    GDD.md               design completo (v4)
    GDD-ADENDO.md        pedidos do dono depois do v4 — TEM PRIORIDADE sobre o GDD
    NOTAS-JOGO.md        estado do jogo, o que falta, pontos de extensão no código
    NOTAS-FERRAMENTAS.md como cada ferramenta se comporta (interface G.Tools, eventos, âncoras)
    bagger-anatomy.md, incremental-design.md, cutscenes.md, audio.md   pesquisas
    prints/              screenshots de referência
```

**Não existem ainda**: `engine/gfx.js` (efeitos na placa de vídeo), `engine/cutscene.js`, `pixxel.js` (bundle),
`PIXXEL.md` (documentação definitiva da engine). O contrato deles está em `tools/ENGINE_CONTRACT.md`.

## Estado atual (rodada de 16/11 pronta; ver "Noite de 16/11" no fim)

Jogável do primeiro arranhão de pata até a Bagger, as 6 etapas da casa e o cartão de final.
- 13 ferramentas funcionando com "posição do ponteiro + segurar"; teste automático passa nas 13.
- Montanha em 4 materiais + núcleo dourado + 28 bolsões; "duro demais" quando a ferramenta é fraca.
- Combo, sacos com suspense, onigiri da sorte, grão dourado, árvore de 68 nós em mapa.
- Arroz viaja até um coletor que evolui (cesto → saco → barraquinha → kei-truck → silo → moega); o ¥ estoura lá.
- Celebração de compra em todas; sequência grande da Bagger em 3 partes.
- "Régua do mundo" no pátio (casinha, barraquinha, cerejeira, torii, poste, casa, torre, fábrica de 6 andares).
- HUD, som, save. **18/11: casa voltava a "nunca comprada" a cada recarga/versão** — `S.house/S.time/S.dug` estavam dentro de um comentário no `loadState` desde a importação; corrigido + MIGR[10] (SAVE_V 10) recupera casa (ilha terminada = pronta; sem viagem, conquistas k07/k18); fixture `tools/fixtures/save-v3-casa.json` no alicerce.
- Jogador automático: final em ~75 min, maior espera entre compras 138–168 s, Bagger aos ~65 min.

## O que fazer agora (em ordem; cada item é um passo separado)

A rodada de 16/11 (etapas 1 a 5) e quase toda a lista antiga foram FEITAS na noite de 16/11 (ver "Noite de 16/11" no fim). Sobrou:

1. **Testar num celular de verdade** (deitado e em pé): joystick, CAVAR, zoom +/-, Casa, Oficina, troca de lugar. E ouvir o som.
2. **Pé da montanha industrial** (esteiras, Komes empacotando, braços mecânicos, robôs) e cidade com turismo/lojas que compram
   mais arroz (hoje a cidade do fundo só cresce visualmente).
3. **Cortar upgrades fracos** da árvore (rever nós que não mudam nada na tela).
4. **Pinturas de máquina** (roupinha pras máquinas; hoje só o Kome tem roupa).
5. **Multiplayer em PCs diferentes** (precisa de servidor/WebRTC; hoje só Jogador 2 no controle, mesma tela).
6. **Engine**: `gfx.js` (efeitos na placa de vídeo) e mover as cutscenes de `game.js` pra `engine/cutscene.js`.

Ajustes menores conhecidos: tigela/pá trocam de pose no meio do giro (falta pose do Kome em pé com dois braços em
`shiba.js`); Kome rotacionado fica serrilhado; giro da pá de cabo é fingido; treliça da Bagger mais clara que a real (o dono
aprovou assim); tela em pé no celular e toque não testados; **o som nunca foi ouvido por ninguém** (só medido).

## Gosto do dono (o que ele já disse)

- Quer o contraste **shiba fofo × maquinário absurdo**; quando a Bagger chega tem que dar "caramba" / "UHUUUL AÍ SIM".
- **Toda ferramenta nova tem que parecer maior e mais forte**, e isso tem que estar na tela, não só no número. Upgrade
  só-número é bug.
- **Máquinas articuladas**, com juntas, pistões e peso. Ele odiou um braço "duro tipo uma vara" no rascunho.
- **Nada parado**: movimento secundário em tudo.
- **Arroz com grão visível** de perto (aprovado como está).
- **Bem gamificado**: metas sempre à vista, recompensa com suspense, coleção, celebração.
- O arroz **tem que ir pra algum lugar e ser vendido**, não sumir no chão.
- Escala por comparação: casas, árvores, prédio, ferramentas antigas ao lado da nova.
- Aprovou: as 39 poses do Kome (a `roll` foi redesenhada de barriga pra cima com a cabeça invertida), a Bagger atual, as
  máquinas médias e de mineração, o cenário, a interface.
- Fala informal em pt-BR; gosta de ver print e opinar. Tem pouco limite de uso: **gastar pouco e mostrar cedo**.

## Regras do projeto

- JS clássico, sem ES modules, sem build, sem dependências; tem que rodar de `file://`.
- Estilo Kome: contorno `#3B2818`, paleta `E.PAL`, 3 tons por material, sem emoji nem asset externo no mundo do jogo.
  Kome e objetos pequenos são pixel art (`Pix`); máquinas grandes são vetoriais articuladas (`Draw`/`Rig`).
- **Não mudar o desenho das 27 poses antigas do Kome** (são do dono). Poses novas podem ser adicionadas.
- Todo balanceamento mora em `game/data.js`. Depois de mexer, rodar `playtest.js --auto` e conferir: final em 60–90 min,
  espera máxima ≤ 180 s, ≤ 50% da montanha cavada quando a Bagger chega.
- Excluído de propósito: dinheiro real, loot box paga, notificação push, mensagem de culpa, quase-acerto fabricado, qualquer
  punição por parar. O jogo é grátis, offline e criança pode jogar.
- Toda ferramenta segue a interface comum `G.Tools[id]` (ver `NOTAS-FERRAMENTAS.md`).
- Verificar sempre de verdade: screenshot olhado ou `playtest.js`, zero erro de página.


## Mudanças da etapa 1.3
- Som do combo: moeda sobe por grau da escala (não desafina) e toca no máximo ~6x/s; escada do combo vira sino suave a cada 3 níveis.
- Cesto nas costas preso no ponto `back` da pose (`G.Tools[id].back(m)` nas ferramentas de mão) e desenhado por cima do corpo com alça.
- Teclado WASD/setas/Espaço.
- Jogador 2 no controle (Gamepad API): entra com qualquer botão, analógico/direcional anda, A/RT cava, Start sai, some se o controle desconectar. Shiba 'goma' com a melhor ferramenta de mão; código em `game.js` (P2, padRead, p2Tick, p2Draw).
- Ajustes › Salvar: Baixar arquivo / Abrir arquivo (save em .txt). Aviso se o navegador não guardar o progresso.
- Aviso de virar o celular em retrato. Toque testado em tela de celular (deitado funciona bem).
- Balanço: Bagger A e casas h4-h6 x1,5 (h6 ajustada): fim com 80-89% cavado, 69-75 min, espera máx <= 165 s.
- Pops de ganho em sequência empilham (popN em credit()).

## Mudanças de 15/11 à noite (rodada sozinho)
- Grãos de arroz polidos (engine/terrain.js tileGrains: menos grãos, maiores, com brilho).
- Arroz da beirada escorre pra dentro do buraco ao cavar e nas avalanches (trickle() em game.js).
- Fundo (céu, sol, nuvens, Fuji, morros) em pixel art: tela 3x menor ampliada sem suavizar; opção "Fundo em pixel" nos Ajustes.
- Plaquinha "Como jogar" nos primeiros 30 s (tipTick em game.js, estilo .k-tipcontrols em game.css).
- NOVA FERRAMENTA: Colheitadeira (id 'colheita', game/colheitadeira.js), degrau 9, entre Trator e Empilhadeira. Kind 'trator'
  (usa driveMachine). Estados idle/harvest/dump: tanque enche em 4,2 s, tubo levanta e despeja ('dump' = pagamento).
  Agora são 14 degraus: tiers >= 9 de TREE e HOUSE subiram 1; EXTRA_BY_TOOL e COLLECTOR ganharam uma posição; música e playtest ajustados.
  Saves antigos (sem d.tv) com tool >= 8 sobem 1 índice pra continuar na mesma máquina.

## Mudanças da rodada "faz tudo" (15/11)
- Pátio esticado (SP() em game-world.js), máquinas estacionadas por tamanho (PARK em game.js), visita de câmera ao abrir nó de pátio.
- Frota trabalhando de verdade: fleetWork() leva trator, colheitadeira, empilhadeira e escavadeira até a montanha (park→go→dig→back).
- "+¥" pequenos agrupados a cada 1,2 s (smallTick); pops empilhados.
- Carrinho de mão soterra o Kome às vezes (S.bury, drawBury); britadeira racha antes do bloco cair (crackTick/drawCrack).
- Nós com efeito visível: veias, carimbo, suor, faixa na cabeça, fumaça azul do diesel etc.
- Ciclo do dia: DAY_SEC=540; céu vai de manhã a noite (S.tod), tinta de pôr do sol, cena "Fim do dia N" com o Kome dormindo
  ao lado da casa e salário de 15% do ganho do dia (dayTick/drawDayEnd).
- Guarda-roupa: bolsões de ouro têm 40% de chance de dar um achado (D.CLOSET: 5 cores + óculos, cachecol, flor).
  Ajustes › Guarda-roupa veste. S.closet/S.look no save. Acessórios desenhados em drawAcc() presos em T.head.
- Cutscenes (csPlay/SHOTS/drawCutscene em game.js): abertura (só em jogo novo), chegada da Bagger (antes da revelação),
  final estilo Dave the Diver antes do cartão. Clique passa, Esc pula, o jogo pausa por baixo. ?nointro pula a abertura (testes).
- Modo infinito: depois do final, "Continuar cavando" (ou Ajustes › Nova montanha) gera montanha nova. Formatos alternam:
  clássica, dois picos, mesa (mountainShape usa S.mount). Tudo comprado continua. S.mount no save.
- Playtest --auto: final ~72 min, espera máx ~130 s, Bagger com ~37% cavado, fim com ~87% cavado.

## Rodada de 16/11 (feedback da família) — FEITA na noite de 16/11
Plano em 5 etapas (pedido do dono: fazer todas em sequência):
1. FEITA: consertos e "sentir a compra"
   - combo não quebra com máquina (janela de inatividade cresce com o ciclo da ferramenta, ecoTick)
   - ajudantes cavam num canto próprio da encosta (helpBase), sem grudar na máquina
   - trator, colheitadeira, empilhadeira e escavadeira SOBEM a montanha (CLIMB/climbFace/parkClimb); pá de cabo e Bagger ficam no chão
   - frota trabalha mais (cava 26+ s, volta rápido)
   - tremor só na montanha (forte) e no chão (fraco): quake() em vez de cam.addTrauma
   - Bagger não entra na montanha: corpo trava antes do pé (driveBagger, bodyMax); zoom 0.31
   - ordem nova: ... trator, EMPILHADEIRA, COLHEITADEIRA, escav, CAMINHÃO, PÁ DE CABO, bagger (save migra com d.tv=3)
   - caminhão é carregado pela ESCAVADEIRA atrás dele (driveHaul, S.loader = escav)
   - renda pula ~x1,7 a cada máquina: EXTRA_BY_TOOL novo + D.ECON.BOOST escala preços do degrau (data.js, fim do arquivo)
   - casas h3-h6 rebalanceadas; playtest --auto: final 65 min, espera máx 145 s, Bagger 32%, fim 89%
   - festa de verão (Natsu Matsuri) na cutscene final; montanha nova reposiciona Kome/Bagger
   - cavar no chão: "TONC!" e Kome tontinho com estrelinhas (S.stun, drawDizzy)
   - cartão final "Campanha concluída"; avisos calados durante cutscene e cartão (S.endOpen); aria-label em botões e chaves
2. EM ANDAMENTO: celular forte (game.js: MOBILE, mobileInit, VK, pinch; game.css: .k-vpad/.k-joy/.k-dig/.k-full)
   - largura lógica adaptável (W entre 960 e 1280 conforme a tela), HUD com zoom no celular (fitHud)
   - joystick (anda), botão CAVAR, botão tela cheia, tela cheia + paisagem no primeiro toque, pinça e rodinha = zoom (S.zoomMul)
   - FALTA: testar num celular de verdade; conferir que joystick/CAVAR não cobrem os botões de baixo em telas diferentes
     (hoje bottom:168px fixo; o ideal é medir o topo da zona 'dock' do HUD); botões +/- de zoom; textos maiores onde ainda tiver miúdo
3. Casa: botão "ir pra casa", noite mais vezes (DAY_SEC menor) e Kome dorme mais rápido, jardim, decoração, bichinhos, temas de fundo,
   guarda-roupa dentro da casa + aviso visível quando acha roupinha (hoje fica em Ajustes › Guarda-roupa)
4. Loop infinito: pé da montanha industrial (esteiras, Komes empacotando, braços mecânicos, robôs), trilho com trem velho até trem-bala,
   cidade crescendo no fundo (turismo, lojas que compram mais arroz), melhoria por veículo com marcos (nível 10/25/50 dobra),
   eventos (veio de arroz dourado, hora do rush) no lugar de "aparecer montanha nova"; cortar upgrades fracos
5. Botão pra trocar de lugar com um shiba e jogar com qualquer ferramenta/veículo já comprado (todo mundo amou a britadeira)
Outros pedidos: "monte de arroz some quando compra o primeiro trator" (não reproduzido); trem do nó m8 passa atrás da Bagger e parece
entregar arroz dourado (mover pro trilho do fundo na etapa 4). Ideia pra um Kome 2: o governo intima o Kome por vender todo o arroz do
Japão e ele tem que plantar pra encher o estoque nacional.
Testes: python+playwright com ?fresh&nointro; ganchos window.__kome (play, newMountain, dbg, addMoney, buyTool, buyNode...).

## Kit de economia (16/11, Claude Code no PC do dono)
- `CLAUDE.md` na raiz (regras curtas, lido sozinho), projeto no git, `tools/check.js` (verificação com saída curta).
- shot/playtest/check usam `tools/pw.js` (playwright-core + Chrome/Edge do PC); `cd tools && npm i` se faltar.
- O que o check.js acusou pra etapa 2 (celular): joystick cobre a barra do combo; plaquinha "Como jogar" cobre o botão Casa e o
  de tela cheia; em pé: barras do topo se sobrepõem e botões Ajustes/Árvore/dock < 32px; desktop: textos de 10px ("×1,26",
  "precisa: Trator").

## Noite de 16/11 (Claude Code sozinho, dono dormindo) — tudo commitado no git
- Celular: HUD medido em layoutPad() (game.js, mobileInit): joystick/CAVAR no vão entre o HUD de cima e a barra de compras, plaquinha
  "Como jogar" abaixo do HUD; em pé o HUD sai do palco e usa a tela inteira (.k-hudfix); botões +/- de zoom ao lado da tela cheia;
  zoom do HUD limitado pra caber em celular pequeno; textos >= 11px. check.js passa em 6 telas (PC, celulares, tablet).
- Etapa 3 — Casa do Kome (game/home.js): botão Casa (embaixo da engrenagem) abre o quintal com o jogo pausado. Abas Jardim (12
  enfeites), Bichinhos (carpas, capivara, borboletas, vaga-lumes, passarinhos, 3 amigos shiba), Roupas, Tema (primavera/verão/
  outono/inverno: pétalas, folhas ou neve caem também no jogo) e Caderno. Preço = segundos da renda atual (D.DECOR/D.THEMES em
  data.js). Dia de 5 min (DAY_SEC 300) e cena de dormir de 3 s. Achou roupinha: banner + aviso + "!" no botão Casa.
- Etapa 4 — modo infinito (game/infinite.js), só depois do final: Oficina no lugar do botão de ferramenta (nível por veículo, +5%
  cada, marcos 10/25/50 dobram) e eventos a cada ~2 min (hora do rush ×2, veio dourado ×3, festival ×1,5) com contagem no HUD.
  Trem de arroz (m8) agora corre num trilho no fundo e evolui: vapor → diesel → trem-bala. Cidade cresce no fundo.
- Etapa 5 — botão de troca (setinhas, na barra de baixo): escolhe qualquer ferramenta comprada; um amigo shiba assume a máquina.
  S.play em game.js (setTool usa S.play; a renda continua a da melhor ferramenta).
- Conquistas/missões/caderno (game/goals.js): 30 conquistas (selo +1% de renda cada), 3 missões sem prazo (prêmio pequeno),
  aba Caderno na Casa. Pra compensar: COST_TOOL/NODE/HOUSE = 1,36 e Bagger 6,6 mi. --auto: final 64-68 min, espera máx ~158 s.
- Modo infinito parte 2: 6 formatos (clássica, dois picos, mesa, Mochi, Vulcão de Curry, Terraços), cartão pra escolher entre 3
  sorteados (pickMountain em game.js), recorde por formato em S.stats.rec.
- Roupinhas novas: Kome Ruivo, Kome Chocolate, coroa, bandana, gorro, laço, capa (drawAcc em game.js).
- Engine: `node tools/build.js` gera pixxel.js/.css; `demos/koi.html` usa só o bundle; `node tools/docs.js` gera PIXXEL.md.
- NÃO verificado com olho: o cartão de escolher montanha (só testado sem UI), as roupinhas novas no Kome, a cidade à noite.

## Manhã de 17/11 — "low fruit" do pós-final (tudo commitado)
- Ilhas (game/islands.js): Casa › aba Ilhas. Depois do final, "Partir pra X" (cartão + cena do barco) zera montanha/frota/árvore/
  casa/dinheiro e dá Sementes Douradas = raiz(ganho/1 mi). Árvore permanente D.SEEDS (renda +15%/nível, preços -6%, Mala de Viagem
  começa com Pá/Carrinho/Trator, Poupança, ajudantes, Faro de Ouro). 5 ilhas: Honshu, Hokkaido (faixas de Arroz Congelado e Gelo
  Eterno), Kyushu (vulcão, curry, ouro ×1,8), Okinawa (terraços, areia), Ilha de Mochi. Viagem reescreve o save e recarrega.
  Preço por ilha × (1 + 0,4n + 0,15n²). Playtest: `node tools/playtest.js --auto --island 1` (Hokkaido 38 min), `--island 2
  --seeds '{...}'` (Kyushu 30 min). Total estimado ~3 h até a Ilha de Mochi.
- Roupinhas exclusivas por ilha (campo island em D.CLOSET): Kome de Hokkaido, do Vulcão, da Praia.
- Oficina (infinite.js + industry.js), tudo pós-final e zerado na viagem (S.stats.run):
  Bagger Gêmea em 4 peças (esteiras, conveses, lança+roda, segunda roda): 1,5× maior, duas rodas (m.wheels=2 em bagger.js),
  trabalhando do OUTRO lado da montanha (x = MX1+420, virada pra esquerda); câmera visita a cada peça (G.Ind.showTwin). Sem cópia escura.
  Fábrica KOME PACK no pátio (x=-520, à esquerda da pá de cabo): galpão, chaminé, esteira, Komes empacotando, braço robô,
  robozinhos levando sacos. Cidade que compra: 5 lojas com nível + uma cliente escolhida com bônus próprio.
  Especialização: nos marcos 10/25/50 da Oficina escolhe "mais rápida" (bônus da máquina +50%) ou "mais dourada".
- Cidade do fundo refeita no traço do Kome (machiya, lojas com noren e lanterna, prédios com varanda, pagode, castelo).
- `node tools/single.js [saida]` gera o HTML único (scripts/CSS/ícone embutidos) — é o "Kome no Japão (celular).html" da área de
  trabalho. Rodar de novo sempre que mudar o jogo.
- Decisão do dono: máquinas continuam vetoriais (o teste em pixel ficou embaçado). Pixel só no Kome, fundo, cidade, coisas pequenas.
- Conserto: em pé, o resize do stage tirava a classe k-portrait (Árvore saía da tela); agora é recolocada. Bagger 6 mi.
- Falta do plano grande: máquinas 2-6 (trem-escavadeira, robô gigante, cidade-escavadeira, nave, Lua de Mochi), mecânicas
  fundas das ilhas (curry que estoura, peneira de Okinawa), lojas pedindo tipo de arroz, montanhas desafio, carpas raras.

## 17/11 (tarde)
- A engine agora se chama **Pixxel**: global `Pixxel` (o antigo `KomeEngine` continua como apelido), `engine/pixxel.css`,
  bundle `pixxel.js`/`pixxel.css` (`node tools/build.js`), docs `PIXXEL.md` (`node tools/docs.js`).
- Celular deitado (print real do dono): palco em modo "cover" (sem faixa preta mesmo quando a barra do navegador some depois de
  abrir), HUD sempre na camada fixa da tela, CAVAR/joystick menores e logo acima da barra de compras, barra compacta abaixo de
  760 px (body.k-tight). Bug do combo em cima do ¥/s: a barra cheia ganha a classe k-full, que colidia com o botão de tela cheia
  (agora .k-fullscr). check.js ganhou a tela "celular-alargou" com combo cheio.
- Decisão: TODAS as construções em pixel art Pixxel (E.sprite + bevel, igual o jardim); máquinas ficam vetoriais. Fábrica já
  convertida (industry.js, drawFactory). Falta: casinha, barraca, poste, vila, torre, prédio 6 andares, silo, casa (game-world.js).
- Oficina corrigida (ideia do irmão do dono): o nível de cada máquina vale SÓ pra ela, enquanto ela está em uso (renda e força
  de penetração, `G.Inf.mult(id)`/`powK(id)` em computeStats). Preço proporcional ao tamanho da máquina. Antes um nível da pata
  dava +5% no jogo todo, igual à Bagger. Aviso "duro demais" agora parte da ferramenta na mão e sugere "troque pra X".
- Trava na escavadeira (o irmão do dono deixou a noite toda): a face da montanha chega no Núcleo Koshihikari (dureza 24) e a
  escavadeira (força 8) não furava; a renda caía pra ~0. Agora escav 10, pá de cabo 12,5 (força em ordem crescente até a
  Bagger 16). Preços ×1,42. Teste novo: `node tools/stall.js <ferramenta> [minutos]` simula ficar parado sem comprar.
- Física da montanha mais viva: `E.SlideFX` (engine/terrain.js) solta grãos de verdade onde a avalanche escorre; eles rolam
  pela encosta (aceleram no íngreme, pulam em borda convexa, param no plano), torrões nos materiais duros, poeira ao cair
  de pulo forte. Deslizamento grande (muito arroz em 0,5 s, escalado pelo zoom) = poeira no pé, tremor leve e "rumble".
  slideTick() em game.js; o "tremidinho" antigo do heap.draw desliga com rolling:false.
- Soterramento do carrinho REMOVIDO (o dono achou horrível nas duas versões).
- Física da montanha (pesquisa do dono: "só o topo tem física"): heap.relax pode emprestar parte do arroz que escorrega
  (heap.divert); o E.SlideFX transforma em grão com massa que rola e devolve a massa ao mapa onde para (heap.add) ou ao
  sair da tela. Só empresta com update rodando em tempo real e dentro da vista (o playtest acelerado não é afetado).
  Testado: massa conservada em jogo, MAS o save/load do playtest divergia (+21 a 42 mil px²) com carry ligado; ficou carry: 0
  em game.js até achar a causa (suspeita: grão em voo entre o "before" e o save do unload).
- Montanha em pixel art + cor creme/lavanda: TESTADO E DESCARTADO (o dono achou "esquisito" e "parece areia, não arroz").
  Ficou: fronteira entre camadas ondulada (bdepth() em terrain.js, mesma função pra desenho e dureza), Fuji à esquerda
  (o topo aparecia atrás da montanha e parecia bug), sombra de contato e grãos soltos na grama no pé (drawFoot em game.js).
- Camadas viraram tipos de arroz (o rosa "mochi" parecia rocha de montanha): Arroz Branco (solto), Arroz Integral (prensado,
  bege), ARROZ NEGRO (id 'mochi' mantido pros saves; grão roxo-escuro, dureza 8), núcleo Koshihikari. Ilhas: Arroz de Curry
  (Kyushu), Arroz Mochigome (Ilha de Mochi).
- Teclado: W / seta pra cima PULA (a pé, com ferramenta de mão); S / seta pra baixo / Espaço cavam.
- Céu cortado em tela larga: game-world.js tinha W fixo em 960; agora recebe a largura do jogo (Wd.setSize). Aparecia no pôr do sol.
- Patas Ligeiras agora também cava +15% (fx dig). Preços ×1,47.
- Dia de 4 min (DAY_SEC 240), cena de dormir de 6 s, casa desenhada em escala inteira sem suavizar (mesmo pixel do jogo),
  e aviso "próxima etapa: X · faltam ¥Y" na cena da noite.
- Rodada de feedback (17/11): joystick move a Bagger a partir da roda (ia de ré) e crawl 70; Goma pilota a Bagger quando o
  Kome troca (roda girando) e ela fica 38% opaca; depois da Bagger qualquer ferramenta fura o núcleo (powMul mínimo);
  ferramenta de mão sobe no pulo (airFloor); botão Casa pulsa quando dá pra comprar algo + aviso aos 2 min + abas maiores;
  construções do pátio em pixel art Pixxel (casinha, sobrado, prédio onigiri, silo, poste, torre) em game-world.js.
- PEDIDOS GRANDES PENDENTES (dono): cidade onde dá pra andar, com comércio e shibas vivendo; esteiras da industrialização
  ligando a montanha ao coletor/fábrica (FEITO); túneis (DESCARTADO pelo dono); Bagger mais fácil de controlar no celular.
- Menu do Kome (baú no canto de cima): Casa, Roupinhas, Trocar ferramenta, Caderno, Oficina, Ilhas, Nova montanha, Ajustes,
  com "!" de novidade e itens bloqueados apagados com dica. O botão de trocar da barra de baixo saiu (mora no menu).
- Esteiras (game/belts.js, E.Conveyor): pé da montanha -> coletor (a partir do Trator) e coletor -> fábrica de onigiri
  (nó Esteira a9 ou Escavadeira); velocidade e quantidade sobem com a renda.
- Túneis: protótipo em demos/tunel.html (montanha como grade de células 320x180, só pedaços 16x16 "acordados" simulam;
  solto cai/escorrega, prensado e negro só caem sem apoio, então túnel fica de pé). Custo medido: ~7 mil células, 0,2 ms.
  Levar pro jogo = trocar o mapa de altura do E.Heap por grade (desenho, dig, save, máquinas que andam na superfície):
  é uma reescrita do terrain.js. DECISÃO DO DONO (17/11): não gostou dos túneis, NÃO levar pro jogo. A demo fica só como teste.
- Rodada 17/11 (celular): desempenho com zoom aberto e Bagger: máquinas desenhadas em cache de imagem quando cam.z < 0,55
  (drawMach em game.js; Bagger do jogador em cache quando cam.z < 0,3). Medido com CPU 4x mais lenta: 11 -> 17 fps.
  Coletor segue a ferramenta NA MÃO (a moega da Bagger seguia o Kome). Trocou de ferramenta: o Goma pilota a melhor e
  garante 75% do ¥/s que você fazia nela (S.stats.topIps = média só do que o jogador cava); `extra` agora é da ferramenta
  na mão e a frota usa sempre o da melhor; níveis da Oficina valem pros shibas que pilotam cada máquina.
  Montanha de mochi = camadas de mochi (arroz, morango, matchá); vulcão = curry (SHAPE_MATS em game.js).
- Preços da Oficina/Casa/lojas travados (G.priceIps = S.stats.pb): só sobem quando você compra algo ou quando o dia vira
  (antes seguiam o ¥/s do momento e mudavam a cada abertura). Guarda-roupa com ícone (rosto com a cor/acessório; bloqueado
  = silhueta), acessório aparece com carrinho, britadeira e no Kome da Casa (drawAccAt).
- Laboratório visual: `node tools/sweep.js` (19 telas x 3 aparelhos, folhas de contato em %TEMP%/kome-sweep). Primeira rodada
  achou e consertou: celular em pé (agora aviso "vira o celular" em tela cheia e o jogo pausa), joystick/CAVAR/zoom por
  cima dos menus (somem com painel aberto), terreno da Casa em vetor feio (agora pixel: estacas, bandeirinhas, placa),
  título do fim do dia sob a barra da montanha (HUD some na cena), guarda-roupa duplicado nos Ajustes (removido).
- KIT DE EXPANSÃO BARATA (17/11): MAPA.md (onde mora cada coisa), fichas de conteúdo (conteudo/*.js, pixel em texto via
  E.spriteText, tools/content.js gera game/content.js; tipos enfeite/bicho/roupa/evento/loja), receitas (tools/novo.js),
  galeria (tools/galeria.js), robô aleatório (tools/monkey.js: achou 2 bugs, consertados), painel ?dev (game/dev.js),
  arte das cutscenes separada em game/cutscenes.js. Fichas novas no jogo: lanterninhas, tanuki, boné azul, chuva de onigiri, ramen.
- Pixxel Estúdio (estudio.html; cópia única na área de trabalho "Pixxel Estúdio.html"): imagem -> pixel na paleta do Kome
  (tira fundo e halo), pintar (lápis/balde/borracha/conta-gotas), quadros + animações prontas, prévia com o Kome,
  exporta ficha/PNG, guarda projetos no navegador.
- Admin: "Kome no Japão (admin).html" na área de trabalho = jogo com painel dev ligado (single.js --dev), save SEPARADO
  (kome-admin-v4), atalhos "pular pra fase" (pá, trator, escavadeira, caminhão, Bagger, final, Gêmea, próxima ilha),
  abrir telas e cutscenes. Regerar os 3 HTMLs: single.js (celular), single.js --dev (admin), single.js --in estudio.html.
- Dá pra PILOTAR a Bagger Gêmea (Menu › Trocar ferramenta, depois das 4 peças): a Bagger do jogador vira a Gêmea
  (m.k = 1,5 no bagger.js escala geometria e desenho; duas rodas; pintura; cava 2x; câmera abre) e o Goma leva a 293 pro
  outro lado da montanha (faturando). Atalho no admin: "pilotar a Gêmea".
- FÁBRICA DE ARTE POR RECEITA: Pixxel Estúdio completo em estudio-pro/ (fonte src/ + build.py + HTML). engine/assets.js
  (Pixxel.Assets/Pixxel.Anim) entrou na engine. Ficha com `receita:` -> `node tools/arte.js` gera conteudo/arte/<id>.pixxel.js
  (spritesheet + animações) com os geradores do Estúdio em headless; content.js embute; a Casa toca a animação
  (bicho anda, enfeite parado). Exemplos: gato laranja de laço (9 animações), lojinha de onigiri.
  Licença: pacotes Ironblossom/Lantern Street dentro do Estúdio podem ser usados/modificados em jogo, NÃO redistribuídos
  como assets nem usados pra treinar IA; Lantern Street pede crédito "Background art by KATO".
- Construções trocadas por arte gerada (conteudo/estrutura-*.js, tipo 'estrutura'; desenhadas por art() em game-world.js,
  com versão de noite): prédio da onigiri, sobrado da vila, oficina, barraca de ekiben, galpão KOME PACK (com fumaça), e a
  cidade do fundo (machiya, lojas, sobrados, prédios, templo e castelo, com névoa). Se a arte não carregar, cai no desenho antigo.

## Laboratório da expansão 100 h (17/11)
- `tools/longo.js`: simula horas de jogo (3 h em ~50 s). 1ª rodada achou: ilha 2 (Kyushu) acaba em ~4 min (sementes fortes
  demais); ~18 min sem novidade logo depois do final da campanha; Oficina/Gêmea quase não são compradas no infinito (caro).
  NÃO mexido: o endgame está sendo refeito pelo designer. Rodar de novo quando a spec chegar.
- `tools/planilha.js`: CSV → fichas + arte animada. Testado com raposinha, coelho, poste de luz, Festival da Lua.

## 16/11 (noite) — A VOLTA AO JAPÃO (fim de jogo)
- Cutscene `ilhas` (cutscenes.js) toca depois do cartão do final (ou 2,5 s depois de carregar um save antigo que já terminou);
  depois vem o tutorial de 3 passos (islands-ui.js · tour: chip do HUD, sementes, Partir). Flag S.stats.cs_ilhas. Rever: botão no mapa.
- Chip "Ilhas" no topo (Z.tc, embaixo da barra da montanha): ilha atual/casa ou "Partir pra X +N sementes" (pulsa), e o evento da ilha.
- Mapa das ilhas em tela cheia (Menu › Ilhas, chip, Casa › aba Ilhas › Abrir o mapa). O jogo pausa com ele aberto.
- Perfil de cena por ilha em D.ISLANDS[i].scene (islands.js, só dados) desenhado por scenery.js: céu, longe (Fuji só em Honshu),
  morros, chão, partículas, crista da montanha (neve some onde cava; cinza + fumaça na cratera; riscos de areia; brilho de mochi),
  árvore e enfeites do pátio, neve nos telhados (snowy: pinta o topo dos sprites), música própria (temas hokkaido/kyushu/okinawa/mochi).
- ESPELHO: Kyushu e Okinawa têm a montanha à ESQUERDA. Feito só no desenho: Camera.mx = -1 (engine/fx.js; toWorld/toScreen
  respeitam), fundo virado no render, teclas A/D e joystick trocados, indicadores de borda corrigidos, Draw.text/Draw.sign
  desviram texto em transformação espelhada (texto de máquina virada também ficou legível). A simulação é a mesma: rungs passou
  nas 14 ferramentas em Kyushu (`node tools/playtest.js --rungs --island 2`).
- Kome sente o clima: frio (parado > 1,5 s treme, bafo a cada ~1 s, cachecol automático se não tiver acessório, idle 'shake',
  ajudantes tremem), calor (idle 'pant', suor, calorão), praia (larga a ferramenta e dança às vezes), mochi (pulinho na gravidade fofa).
- Evento por ilha (islands.js · ev, a cada 170-240 s depois da Pá; só fora da campanha de Honshu): nevasca ×2,5 + gelo na crista,
  erupção de curry ×1,5 + 4 sacos dourados, maré baixa ×1,5 + 3 sacos, gravidade fofa ×2 + gravidade 0,4, hanami ×1,8 (volta 2+).
- Medalhas por ilha (D.ENDGAME.medal: ouro/prata em minutos; bronze = terminar), sementes extras na primeira vez. S.stats.isl.
- Fim de ilha (2ª em diante): cutscene `ilhafim` (planície, medalha, próxima parada) + cartão; Continuar abre o mapa.
- Grande Final (Ilha de Mochi, 1ª vez): cutscene `finale` com o Kome-Oh combinando (komeoh.js agora carregado no index), renda
  ×2 pra sempre (D.ENDGAME.legend, S.stats.legend), roupa 'nihon' (Kome Hinomaru), estátua do Kome-Oh no pátio (x=-560).
  Depois da Ilha de Mochi a viagem volta pra Honshu: S.stats.lap++ e preço conta lapStep ilhas a mais por volta.
- Roupinha nova 'momo' (Kome Mochi, só na Ilha de Mochi). Paletas 'momo' e 'nihon' em engine/shiba.js.
- ?dev: ir pra cada ilha (sem viajar, __kome.setIsland), evento da ilha, mapa, tutorial, cutscenes ilhas/chegada/fim de ilha/finale.
- Viagem de verdade: sem ?nointro a chegada toca a cutscene `chegada`; com ?nointro (testes) só o aviso.
- NÃO TESTADO nesta rodada (o dono testa): playtest --auto (campanha e --island 1/2: os eventos de ilha aceleram um pouco as
  ilhas), monkey.js, sweep.js (telas de celular do mapa/tutorial), música das ilhas de ouvido, Volta 2 inteira.

## Fase 0 do PLANO-100H (alicerce) — FEITA
- Itens tipados: game/items.js (G.Items) + D.ITEMS/D.ITEM_AREA (data.js). Cavar (Kome, ajudantes, frota, esteira) enche
  S.stats.inv/got por tipo; o ¥ continua igual (balanço não mudou: --auto 63 min). Aba "Armazém" na Casa.
- engine/sim.js: E.Sim (tick por tempo + catchUp offline em passos). G.Sim criado no boot; G.Sim.tick no update;
  no load roda catchUp do tempo fora (até 8 h) e guarda em S.away (nenhum sistema tem offline ainda: fábrica é o 1º).
- Save versionado: SAVE_V=5 + MIGR no topo do game.js (v4 -> 5 cria o armazém). tools/alicerce.js testa tudo isso.
- Ficou pra fase 1 (de propósito): carta de ganho offline, 2ª tela vista de cima, tipos novos de ficha (receita, maquina...).
- Endgame "A Volta ao Japão" (designer) entrou por merge; shisas viraram arte gerada (estrutura-shisa), estátua do Kome-Oh
  maior, cartão da casa com nome curto. longo.js diz Kyushu em 4 min mas playtest --island 2 --seeds dá 68 min: suspeita
  de bug no longo.js (não no jogo) — investigar antes de mexer em balanço de ilha.

## Enquanto a spec da Fábrica não chega (17/11)
- longo.js estava CERTO: sementes maximizam rápido (ganho = sqrt(earned) inclui o modo infinito). Ilhas com sementes no
  máximo: 4 / 2,8 / 7,3 / 12,9 min. Relatório e opções em docs/design/ACHADO-sementes.md (decisão do designer).
- engine/board.js (E.Board) + game/topo.js: tela de cima 8×6 "Fábrica · em obras", esteira de teste por arraste, pausa a
  montanha. Atalho no ?dev: "tela de cima (fábrica)". Testada no celular deitado (célula 42 px).
- Casa com vida: cerebrinho (anda até um ponto, para fazendo algo) pros bichos de ficha, shibas amigos e o Kome.
- Enfeites das ilhas saíram de trás do silo (pátio esticado: vão livre 1420-1470).
- Bichos novos por planilha: Ursinho, Lobinho, Panda; Tanuki virou arte gerada (mesmo id).

## Fábrica (fase 1) — feita e no jogo (17/11). Estado e o que falta: docs/PASSAGEM-fabrica.md

## Fábrica com cara de jogo (17/11, noite) — pedido do dono: "arruma esse gráfico tosqueira, quero um jogo de verdade"
- **Tela nova** (`game/fabrica-arte.js` = arte, `game/fabrica.js` = regras + HUD + toque). Galpão em vista 3/4 enchendo a
  tela: parede do fundo com vigas, janelas shoji, noren KOME PACK, lanternas, relógio, prateleira; chão de tábuas com sol
  entrando; porta da ENTRADA (montanha de arroz e o Kome cavando lá fora) e porta da VENDA (kei-truck que carrega e sai).
  Grid 8×6 com casas de 80×57 (era 52). Sumiram os dois painéis de texto.
- **Máquinas com volume** (pixel escala 2, mais altas que a casa, desenho por linha): Panela (fogão de tijolo, fogo, tampa
  batendo, vapor, shiba de touca mexendo), Moldadora (prensa com pistão, funil, alavanca, onigiri pulando), Pilão (dois
  shibas, kine com antecipação e amassada, farinha, "PON!"), Divisor (mesa giratória com cancela). Níveis 3, 6 e 10 mudam o
  desenho (chaminé, cobre, tamanho, ouro).
- **Esteiras** com trilho, saia de aço, ripas em V andando e peça de CURVA; item com sombra e balancinho.
- **HUD de jogo**: ← Montanha e ¥ em cima à esquerda, faixa de produção no meio, metas em chips; barra de botões quadrados
  embaixo (ícone + preço, cadeado com progresso); cartão pequeno flutuando ao lado da máquina/doca; botão "?"; tutorial de
  4 passos com o Kome. Selo verde = dá pra subir de nível.
- **Suco**: pop e poeira ao pôr, estrelas e "visual novo!" ao subir, moedas voando da venda pro ¥, cartão de PRODUTO NOVO,
  luz de fim de tarde com lanternas (segue `S.tod`), poeirinha no sol.
- **Sons novos** (definidos no fabrica.js com `E.Sfx.define` / `E.Loops.define`): borbulho da panela (loop), "ploc",
  "PON!" + latidinho, caixa registradora (tom sobe com o preço), pop de pôr, jingle de nível. Respeitam o mudo.
- **Pátio**: o galpão KOME PACK aparece e trabalha assim que a Fábrica abre (industry.js `working()`).
- **Ritmo** (resposta do designer de 17/11, no fim de docs/design/fabrica.md): níveis baratos como tapa-buraco. Conserto
  junto: `G.Fab.dig()` só conta com a fábrica aberta (antes a 1ª média de renda engolia a campanha inteira e os preços do
  começo saíam errados). `tools/fabrica-sim.js --runs 8` mostra mediana e faixa (cada partida varia muito).
- Prints: docs/prints/fabrica-nova*.png e fabrica-mundo.png. Ganchos novos de teste: `G.Fab.quiet()`, `select(x,y|'dock')`,
  `tool(id)`, `activity()`.
- **NÃO testado nesta rodada** (o dono testa no PC dele): check.js, sweep.js, monkey.js, playtest; arrastar esteira/mover
  máquina com dedo de verdade; som no aparelho; HTML único da área de trabalho (rodar `node tools/single.js`).
- Pontos fracos conhecidos: máquina alta esconde um pedaço da esteira da linha de trás; as máquinas não giram o desenho
  (só as setas e a saída mudam); faixa preta dos lados no celular bem largo (o palco é 16:9); o caminhão é enfeite (o ¥ entra
  na hora da venda, como antes).


## 17/11 — caminhão e final (pedido do dono)
- Caminhão de Mineração não carregava com o botão CAVAR do celular (mirava na caçamba, a poucos px do lado "descarregar";
  dava ré pro pátio). game.js · teclado/CAVAR: no 'haul' a mira é sempre do lado da montanha. Ciclo completo testado.
- FINAL agora = casa pronta E montanha cavada até D.END_DUG (95%) (antes: na compra do onsen, com ~80–90% cavado).
  Toast "Casa pronta! agora termine a montanha"; barra "Montanha" chega a 100% no final. Campanha: 71 min (meta 60–90 ok).
  Ilhas (vale pra elas também): --island 1 = 31,5 min, --island 2 = 34 min com sementes moderadas. As medalhas de
  D.ENDGAME.medal foram pensadas pro final antigo: designer rever os tempos de ouro/prata.
## 18/11 — rodada do designer (Fable): fábrica retocada, Oficina nova, mundo em dois lados
- Fábrica (fila item 1): máquinas giram o desenho (4 vistas), topo transparente quando passa item atrás, texto ≥ 17 px no palco,
  selo verde só no upgrade mais barato. Arquivos: game/fabrica-arte.js, game/fabrica.js.
- Oficina (fila item 2a): tela cheia "garagem do Kome" (game/oficina-arte.js, game/oficina.js). G.Inf.open() abre a nova; cai na
  lista antiga se der erro, com ?oficina=lista ou G.Inf.classic = true. Mexido: infinite.js (up devolve {L,mile,cost}, info, open,
  openList), industry.js (G.Ind.buy.*, spec, pay quiet), index.html, sw.js (kome-2.26).
- Mundo em dois lados (pedido do dono): lado de cavar = zona industrial em vagas sem sobreposição + estacionamento da frota; outro
  lado = Vila do Kome; chip "Vila ⇄ Montanha". Spec e lista de funções mexidas: docs/design/mundo-dois-lados.md
  (game.js: PARK, rebuildFleet, fleetWork, fleetTick, collectorTick, camTick, update, readPointer, buyNode, buyHouse, credit, boot).
  NÃO feito: fundo industrial, Gêmea no lado industrial, lojas como prédios na vila.
- Design (rascunhos pro dono aprovar): docs/design/sementes.md; "Fim de jogo da fábrica" em docs/design/fabrica.md.
- NADA desta rodada passou por check/playtest/monkey/sweep depois das últimas mudanças (o dono testa no PC).

## 17/11 — merge da rodada do Fable (mundo em dois lados, Oficina nova)
- Conflito só no G.Game (vila + reset) e no CONTINUAR. Bug achado: o voo da câmera pra Vila (compra de casa) só anda em
  quadro de tela; no modo acelerado ficava "olhando a vila" e o Kome não cavava (playtest empacava na empilhadeira).
  vilaGo não voa em FAST e hold ignora o voo em FAST. Campanha 68 min ok; 14 ferramentas ok nas 5 ilhas; robô ok.
- Botão da Oficina (HUD) mostra "Bagger Gêmea N/4 · peça à venda!" até a Gêmea ficar pronta (o dono não achava).
- sweep.js fecha a Oficina nova (G.Ofi.close) entre telas.

## PRA DEPOIS (pedido do dono, 17/11)
- LIGAR A FÁBRICA AO JOGO TODO (hoje ela só recebe % do arroz e devolve ¥): pedir design ao Fable. Ideias na mesa:
  pedidos da Cidade consumindo onigiri/mochi; receitas por ilha (curry rice em Kyushu, sorvete de mochi em Hokkaido);
  produto ajudando a montanha (ex.: onigiri dá energia aos ajudantes). Dono achou a fábrica "só um mini Satisfactory".
- TATUZÃO no jogo (game/tatuzao.js + game/tbm.js): chip "Tatuzão" no topo depois do final (D.TATU.price s de renda);
  comprado, fura um túnel reto na base da montanha (boca onde a altura > D.TATU.minH); cada anel paga D.TATU.ringSec s da
  renda; túnel recortado pela superfície (onde cavou, some); montanha nova = túnel novo. Admin: botão "TATUZÃO".
  Pro Fable: o design de verdade (onde comprar, o que ele faz além de renda, se vira peça da Oficina) ainda é dele.

## 19/11 — rodada 3 do designer (Fable): só specs (rascunho, esperando o dono aprovar)
- docs/design/fabrica-ligacao.md (fila 1): 3 destinos na Doca de Venda (vender / marmita da turma / Vila), Cardápio com selos,
  pedidos da Vila, receitas por ilha.
- docs/design/sementes.md (fila 2): seção nova "Medalhas recalibradas pro final novo".
- docs/design/tatuzao.md (fila 3): Tatuzão como caçador de tesouro (mira 3 alturas, bolsões/baús/núcleo, atalho pra Vila).
- docs/design/robozinhos.md (fila 5): enxame como "limpeza" (forte no fim da montanha; pode alimentar a fábrica).
- Fila 4 (pontos fracos do mundo novo) NÃO feita nesta rodada. Nenhum código mexido.
- Fila 4 FEITA (mundo-dois-lados.md): estacionamento virou a 1ª vaga do pátio; voo da Vila passa acima do pico; kei-truck do galpão entra num beco; pequenas trabalham em bancadas na encosta com Caminhão/Bagger. Gêmea continua do outro lado.
- RODADA "SEM PONTOS FRACOS" FEITA (docs/design/mundo-dois-lados.md): pátio acompanha o pé da montanha e varre o tapete; frota trabalha na vaga (sem bancada na encosta); Gêmea do lado da cava comendo o monte de estoque; esteira subterrânea; horizonte industrial; rua do comércio com as lojas do infinito (arrastar passeia na vila); voo com zoom mínimo e nuvens; beco virou ruazinha. Oficina: marco pode ficar pendente, "Usar esta máquina", cartões na coluna da direita, G.News (avisos dentro da Oficina/Fábrica). Fábrica: etiqueta na cabeça da máquina, máquina sólida + balãozinho do item escondido, sombra do lado certo. Falta o dono JOGAR (suítes de jogo não rodaram no fim; só check --fast e alicerce).
- HUD SEM PILHA (game-ui.js `G.HUD.chip({id,icon,label,order,tone,onClick})` → `.set({hot,hint,prio,show})`): Vila/Fábrica/Tatuzão/Ilhas numa fileira só embaixo da barra da montanha; só o chip de maior prio abre o texto e pulsa (viagem 3 > Tatuzão 2,2 > Fábrica nova 2 > evento 1,5), os outros ganham bolinha. Vila esconde o HUD de cavar (`body.k-vila`), dica 3 s por sessão. "+¥" grande sobe ao lado do iene (`HUD.lane` + floaters `ui:true`, soma em vez de empilhar). Oficina: lojas uma por linha com nome. Celular deitado: zoom/tela cheia foram pro canto esquerdo embaixo do combo (`body.k-zbl`). `tools/shot.js --mob` emula celular; `__kome.pop(v,crit)` estoura um pagamento. Falta o dono jogar: chips no celular em pé, tour das ilhas apontando o chip novo.

## 17/11 noite — rodada 3b do Fable JUNTADA (commit), testes PARCIAIS (dono pausou)
- Passou: playtest campanha 64,8 min (todas as metas), 14 ferramentas, alicerce, robô PC e celular.
- FALHA no check: celular pequeno EM PÉ, sobreposição k-tipcontrols × k-chips (dica de controles × fileira de chips nova).
- FALTA testar (pedido do Fable): compra da Bagger + 4 peças da Gêmea e desempenho com as duas na tela; save antigo com
  Gêmea + viagem de ilha; voo pra vila no celular; sweep.js (olhar as 3 folhas); fabrica-sim; tutorial das ilhas no chip.
- Decisões do dono pendentes: máquinas pequenas na encosta (montanha em degraus?) e fim do dia usando a câmera da vila.
- HTMLs da área de trabalho AINDA NÃO regerados com a 3b.

## 18/11 — rodada 3b testada + decisões do dono
- Testado: campanha ok, 14 ferramentas, robô PC/celular, alicerce, sweep (3 folhas ok), Gêmea 4 peças + save recarregado,
  viagem de ilha (Gêmea zera na viagem: stats.run = {} é o prestígio; fábrica fica), ~34 fps cavando com as duas Baggers.
- Celular pequeno em pé: a dica de controles some quando não cabe entre os chips e a barra (sobreposição corrigida).
- DECISÃO DO DONO 1 (máquinas pequenas): com máquina de cabine/caminhão/Bagger na frente, a frota trabalha NO CHÃO, atrás
  da máquina grande, perto do pé da montanha, 80% e escurecida (game.js · drawFleetBg). Degraus na encosta: o dono ODIOU,
  não fazer. Renda igual (autoTick); só visual.
- DECISÃO DO DONO 2 (fim do dia): "a cena da casa é meio feia, o que for melhor" → pro Fable: usar a câmera da Vila.

## 18/11 — CAMADA COOKIE, passo 1 (sistema do Pátio) — programador
- Público corrigido: jovem adulto 20–35 fã de idle (CLAUDE.md, PAPEIS.md, memória). Spec camada-cookie.md APROVADA
  (Pátio só depois do final; Oficina zera na viagem; Cochilo do Kome entra, desligável).
- game/patio.js (G.Patio) + D.PATIO (data.js, tabela da spec): 14 turmas, preço custo×R0×1,15^n, rende r×R0×2^marcos,
  marcos comprados em D.PATIO.at (preço custo×R0×mk). R0 = S.stats.topIps no final da ilha. Renda por api.credit (kind 1).
  Chip "Pátio" (G.HUD.chip, order 25) + painel provisório (UI.panel, ×1/×10/×máx). Save S.stats.patio; zera na viagem
  (islands.js makeSave). Offline 50% até 8 h, faz a conta no init (banner). Visual dos patamares: Fable (G.PatioArt).
- longo.js compra no Pátio (melhor retorno) e marcos; 'compra' não conta como novidade nos trechos chatos; viaja depois de
  30 min de Pátio + 4 min sem novidade (ou 2 h). dopamina.js: peso de 'compra' 0,1.
- Falta (passos 2–5): marcos/sinergias/conquistas por planilha, eventos dourados, Sementes do Pátio + chip "hora de partir",
  números com nome, visual (Fable).
- MEDIÇÃO com o Pátio (longo 8 h + dopamina): engajado 99% (antes 81%), 3.138 novidades, não larga; curva
  ▃█████▆▆█▃███▆██▆▆▆▃██▆█▆█▆▁▆▆▃▃▁ (cai no fim do infinito da ilha 4, 2 h). Trechos >5 min sem novidade de verdade: 16;
  os maiores (14–17 min) são NO COMEÇO DAS ILHAS 1–4 (campanha da ilha sem nada novo: sementes/Mala pulam as ferramentas?)
  → pro Fable olhar. Honshu infinito ficou 1h25 (o robô só viaja com 4 min sem novidade; o Pátio sempre tem).
- BUG achado e corrigido: compra da Bagger fora do step abria cutscene que nunca acabava no modo acelerado (tempo congelado,
  robô comprando em laço, node estourava a memória). csTick: em FAST a cena acaba na hora; parte sem duração vale 3 s.
- longo.js: proteções (aviso de bloco com eventos demais, para se o tempo não andar, --mem).
- PASSO 2 (programador) FEITO: tools/cookie.js lê conteudo/cookie*.csv (formato do Fable) → game/cookie-data.js (G.Data.COOKIE).
  Pátio usa: marcos com nome/preço da planilha (mult_maquina @ alvo), sinergias (a+b ≥ alvo; b ganha +v por unidade de a;
  preço preco × custo da maior × R0), Tigelas do Coração (cada conquista +v; preço preco × R0), conquistas (qtd, todas,
  ganho, eventos [S.stats.goldEv, passo 3], segredo) → S.stats.heart (FICA na viagem) → computeStats s.sell × heart.
  Nomes de número: engine vai até vigint (1e63) + U.addUnits; planilha tipo 'nome' (arrozilhão… kome-kome-kome, 1e93).
  conteudo/cookie.csv = exemplo do Fable + nomes; ele enche (~180 upgrades, ~420 conquistas). Medição 8 h: engajado 99%.
- PASSO 3 (programador) FEITO: game/eventos.js (G.Events) + D.EVENTOS (every 180–480 s de jogo, life 15 s). Tipos/pesos/valores
  da planilha (tipo 'evento'): frenesi/festival (×v tudo), gigante (×v na patada, kind 0), chuva/tempestade (paga v min de
  renda em dur s), desfile (maior turma ≥10: +10%/unidade na frota). Prêmio sorteado ao nascer e escrito no botão; aba
  escondida não conta; nunca offline. Livro dos Eventos no painel do Pátio (chance "1 em N"). Chip do evento ativo (G.HUD.chip
  'evento'). credit × G.Events.mult(kind). S.stats.goldEv / evSeen. Admin: "EVENTO DOURADO". longo.js toca os eventos.
  Medição 8 h: engajado 100%, 63 eventos, curva ▃█████████▆▆▆▆█▆█▆▆█████▆▆▆▆▃███▆. Visual: botão DOM provisório; arte do
  Fable via G.Events.on(fn(evento, 'nasce'|'pega'|'fim', k)). Tempestade precisa S.stats.livro (passo 4).
- PASSO 4 (programador) FEITO: sementes da viagem = campanha (sqrt(S.stats.earnedEnd/1e6), gravado no ending) + Sementes do
  Pátio (campanha × (ganho no Pátio/ganho da campanha)^0,15; D.ENDGAME.patioExp). Isso também resolve o ACHADO-sementes.
  seedCost = base × 1,45^nível (D.ENDGAME.seedGrow). D.SEEDS +9 nós (garagem, desc_frota, marco_turbo, sindicato, faro_ev,
  livro, pote, cochilo, cama) com efeitos no patio.js/eventos.js. Chip "Hora de partir" (G.HUD.chip 'partir'): Pátio ≥ ilha,
  4 min sem novidade de verdade e ≥ 30 min de Pátio (D.PATIO.plateau/minRun); abre o mapa. Painel do Pátio mostra a
  previsão "viajar agora: +N sementes (M do Pátio)". Mapa: nós com máx > 12 mostram "Nv X/Y". longo.js viaja pelo chip.
  Medição 8 h: 4 trechos chatos (eram 14), engajado 100%. Ilhas ainda 14–19 min (sementes fortes) e o infinito da ilha 4
  sem 5ª ilha dura 3h24 (o robô não faz a Volta 2): próximos ajustes de número com o Fable. Máquinas absurdas = arte do Fable.
- RÉGUA DE 100 h (docs/medicoes/longo100-base.txt), antes da planilha cheia: o robô aguentou até 80h36 (dopamina 100%
  engajado até lá). 84 viagens em 100 h (17 voltas), ilha média 31 min (mín 14), Pátio médio 39 min (mín 29). PAREDE na
  ilha 4 da volta 17: a campanha da ilha não termina em 20 h (priceMul cresce com lap² e a árvore de sementes já não compra
  nada: "0 melhorias") → jogador larga ~80 h. Trechos >5 min: 90, quase todos no começo da ilha 4 de cada volta (~17 min).
  longo.js agora faz as voltas (ilha 4 → Honshu) e mostra média/mínimo de ilha e Pátio. NÃO calibrado de propósito: esperar
  a planilha e as máquinas absurdas do Fable e medir de novo.
- FEITO (Fable, fila cookie-pesado item 1): visual em patamares do Pátio da Frota em `game/patio-arte.js` (`G.PatioArt.draw(g, view, t, patio)`, já pendurado em `G.World.layers.back`, lê `S.patio` `{id:{n,marcos}}` quando S.ended; teste `?dev&patio=demo|poucos|medio|cheio|absurdo|pata:12`, `G.PatioArt.fake("+trator")`). Fica depois da estátua (X.estatua-260 pra fora, ~5800 de largura): PROGRAMADOR precisa abrir `X.minX` até `G.PatioArt.slots().x0` (ou voo pro pátio com `slots().camHand/camMid`). Patamares 10/25/50/100/150/200/250/300/400/500; ~1,1–1,9 ms/quadro com tudo em 200–500. Números do visual no topo do arquivo ("mover pro data.js"). Prints: docs/prints/patio-*.png.
- FEITO (Fable, fila cookie-pesado item 2): ARTE+SOM dos 6 eventos dourados + Livro dos Eventos em `game/eventos-arte.js` (`G.EventArt`, já pendurado em `G.World.layers.front`; o sistema chama `spawn/hitTrigger/take/start/on/tap/pop/end`, `openBook()`; demo `?dev&evento=frenesi|chuva|gigante|desfile|tempestade|festival|gatilho[&evt=seg]`, `?dev&livro=demo`, `__kome.evento(id)`; números do visual em EA "mover pro data.js"; prints `docs/prints/evento-*.png`). FALTA: sistema G.Events (programador) e decidir de onde o Livro abre.
- FEITO (Fable, fila cookie-pesado item 4, rodada 1/6): TREM-BALA DE ARROZ em `game/trembala.js` (`G.Tools.trembala`, máquina absurda nº 17: encosta, 8 calhas enchem os vagões, BUUUM, volta pelo outro lado; modo `chegada` com trilho+fita; `horizon()` já ligado no `patio-arte.js` via `PA.ABSURD`), demo `demos/trembala.html`, prints `docs/prints/trembala*.png`, notas em NOTAS-FERRAMENTAS.md. Falta o programador: data.js (custo 1,0e14·R0, rende 6,8e9·R0/s, nó Absurdo 200 sementes) e ligar no Pátio/árvore.
- FEITO (rodada 2–4/6, "funcionar primeiro"): FOGUETE DE MOCHI (`game/foguete.js`, nº 18), ESCAVADEIRA DO MONTE FUJI (`game/fuji.js`, nº 19, é a `escav` de machines-mid.js em escala 9) e PORTAL ONIGIRI (`game/portal.js`, nº 20): interface comum + `horizon()` (já aparecem no Pátio via `PA.ABSURD` quando `S.patio.<id>.n > 0`), demos `demos/{foguete,fuji,portal}.html`, prints `docs/prints/{foguete,fuji,portal}.png`, notas em NOTAS-FERRAMENTAS.md. Falta o programador: data.js (6,6e14/2,9e10 · 4,3e15/1,3e11 · 2,8e16/5,4e11; nós 500/1.200/3.000) e ligar na cena; polir depois (sem som, Kome gigante na cabine da Fuji, contagem pálida).
- Fila Fable item 6 (celular, 5 miúdos): +¥ grande em faixa larga sob os chips (HUD.lane, mín. 17 px), chips em 1 linha no celular com balão do chip quente, cartão de toque set({tip,act}) pro preço do Tatuzão/detalhe da Fábrica, cartão das lojas da Oficina abaixo da placa LOJAS, voo automático pra vila mantém a doca (k-vila-auto). Print: docs/prints/celular-miudos.png.
- FEITO (Fable, fila cookie-pesado item 5): INTERFACES da camada Cookie em `game/cookie-ui.js` + `game/cookie-arte.js` contra um ADAPTADOR (`G.CookieUI.use({...})`, contrato no topo do arquivo; falsos em `?dev&cookie=demo`): Painel do Pátio (×1/×10/×máx, segurar repete, marcos com nome/piada, sinergias), cartão Pegar! com chuva de moedas, Arroz do Coração + 8 Tigelas + galeria por família (secretas ???+dica), Árvore de Sementes nova (E.UI.tree, 40 nós, "Subir nível" no cartão), chips Pátio/hora de partir, Cochilo do Kome (60 min de aba visível, toggle nos Ajustes sem editar game-ui.js). PENDENTE (programador): ligar o sistema de verdade no adaptador e apagar a seção 10 + cookie-demo-data.js. Prints: docs/prints/cookie-*.png

## 18/11 noite — polimento geral (13 agentes em paralelo, Fable/Opus). Tudo commitado; game/content.js regerado no fim.
- Celular (item 6): +¥ grande em faixa central, chips numa linha com balão, toque abre cartão (Tatuzão/Fábrica), cartão das lojas
  da Oficina sem tapar a placa, voo automático pra Vila mantém o dock (classe k-vila-auto). game.js: credit(), bloco vila do camTick.
- Interfaces da camada Cookie (item 5): game/cookie-ui.js + cookie-arte.js + cookie-demo-data.js. Adaptador G.CookieUI.use({...})
  (contrato no topo do arquivo); hoje roda com dados falsos em ?dev&cookie=demo. Painel do Pátio, "Pegar!", Arroz do Coração,
  árvore de sementes (40 nós), chip hora de partir, Cochilo do Kome (toggle nos ajustes).
- Eventos dourados (eventos-arte.js), Pátio (patio-arte.js: faixa da frente, QG pagode, ouro, espelho), Trem-Bala, Fuji, Foguete,
  Portal (som próprio em cada um; fuji/trembala/portal expõem sound()/audio()/silence() pra quando entrarem no jogo).
- Poses novas do Kome (hold2, swing2, lean; o.arm/o.arm2/o.lean; âncora paw2) e tools-hand.js usando elas. 39 poses antigas idênticas.
- Casa do Kome em cena (home.js, ?casa=lista = antigo). Ilhas (scenery.js). Vila (game-world.js, só funções da vila; 15 fichas vila_*).
- Cidade: docs/design/cidade.md (rascunho) + demos/cidade.html (protótipo; 15 fichas cid_*).
- Pendências pro programador: ligar G.CookieUI ao sistema real; botão pro Livro dos Eventos; toque do jogo chamar G.EventArt.hitTrigger/tap;
  sons das absurdas quando entrarem no jogo; horizon() da Fuji é caro (cachear); ids de S.closet que não batem com D.CLOSET (achado da Casa).

## 19/11 — polimento do Fable JUNTADO + adaptadores ligados (programador)
- Merge do kome-polimento (base dd90e0b) com os passos 1–4: conflitos só em CONTINUAR e sw.js (lista refeita do index.html).
- G.CookieUI.use(...) ligado ao sistema no patio.js (adapter()): Pátio, marcos, sinergias, Coração/tigelas, conquistas,
  árvore de sementes (D.SEEDS por galho), carta "Pegar!" (offline vira pendAway), "hora de partir". Com a tela do Fable os
  chips/painel provisórios do patio.js somem. Eventos: G.Events usa G.EventArt (spawn/take/start/on/end), toque no canvas
  pelo game.js (G.Events.hit), G.Events.book() pro Livro. check/alicerce/robô OK.
- FALTA (não feito, sem token): botão pro Livro dos Eventos na tela nova; sons das absurdas quando entrarem no jogo;
  silhueta da Fuji em cache (~4 ms/quadro); conferir nomes das roupinhas; absurdas 15–20 compráveis no Pátio; árvore de
  sementes com posições bonitas (hoje colunas por galho); medir 100 h de novo e comparar com docs/medicoes/longo100-base.txt.
- Esperando aprovação do dono: spec da Cidade (docs/design/cidade.md), sementes.md, fim de jogo da fábrica, jogo infinito.
- Fable (pendências 1–3 + mult_par): botão "Eventos" (Livro) no rodapé do Pátio (cookie-ui.js); horizon() da Fuji em cache (12 quadros recortados + tingidos guardados: 2,05 → 0,84 ms/chamada em canvas de CPU, n=12); roupinhas: ids batiam, o problema era a ordem (achados agora primeiro na Casa e nos Ajustes) + fixCloset() no load do game.js (acento/maiúscula/alias/duplicado/desconhecido); efeito mult_par (×valor nas duas) em tools/cookie.js e patio.js (synMult/sinergias).
- FEITO (Fable, fila item 4): MÁQUINAS ABSURDAS 15–20 compráveis no Pátio: `D.PATIO.turmas` (data.js: tatus/komeohs/trembala/foguete/fuji/portal, custo 2,4e12…2,8e16 · rende 3,7e8…5,4e11, `seed`+`tool`), nós `absurdo15..20` (galho Absurdo, 25/75/200/500/1.200/3.000, `req` em cadeia) em D.SEEDS (islands.js, buy checa req), trava no patio.js (`unlocked`; adapter `patio()` mostra as abertas + a próxima "???" com lockTxt; seedTree com galho Absurdo), cena de chegada em `game/absurdas.js` (G.Absurdas; camada própria, não pausa o jogo, pula com toque/Esc, sons trembala.audio/fuji.sound/portal/foguete e para tudo ao fechar; FAST pula via `fast` novo no G.Patio.init do game.js; demo `?dev&absurda=tatus`). PAREDE da volta 17 era ESTOURO de float (Pátio ×10^6 por viagem até 1e308): R0/renda garantida herdavam o Pátio anterior (prêmio de evento contava como "você cavando" no topIps; topIps e o ritmo da Fábrica ficavam no save). Corrigido: game.js credit() só kind 0 no topIps; makeSave zera topIps/topWk e fab.slow/pb; sementes sem `|0` (estourava int32); lapStep 2,5→1. 100 h: sem parede (ilha 4 da volta 16 em 49 min, volta 17 andando), trecho chato máx 17 min (era 104), engajado 100%, não larga (docs/medicoes/longo100-absurdas.txt). FALTA: S.patio não é alimentado pro patio-arte (silhuetas não aparecem no jogo de verdade; tatus/komeohs nem têm horizon()); nós Absurdo saem todos nas 2–3 primeiras viagens (sementes ~10^5 por viagem): subir ×100 se for pra ser 1 por volta.
- FEITO (Fable, jogo-infinito passo 2): AMULETOS (omamori) — 30 fichas `conteudo/amuleto-*.js` (tipo `amuleto` no tools/content.js), sistema `game/amuletos.js` (1 de 3 na chegada + 1ª máquina a motor, Escavadeira, Bagger, casa pronta = até 5 por ilha a partir da 1ª viagem; zera na viagem; rerrolar 1,2,4,8… sementes; conjuntos de 3 etiquetas; lendários por conquista; FAST/longo escolhe sozinho pelo guloso), tela/chip/Caderno `game/amuletos-ui.js` (demo `?dev&amuleto=demo`), save `S.stats.am` (MIGR[6]); longo 8 h: ilhas 18–41 min (média 29) com amuleto × 31–33 sem; A/B: `localStorage kome-sem-amuleto=1`. Prints: docs/prints/amuletos-escolha-*.png.
- FEITO (Fable, item 6 A): ILHAS 25–35 min. Preço das ilhas agora por VIAGEM (`D.ENDGAME.price = {trip: [3.5, 17, 27, 32, 38], grow: 0.3}`, islands.js `priceMul`/`priceBase`/`tripN`; t = ilha + volta×5) + `price` na ficha da ilha (Kyushu ×1,25); `lapStep` saiu. Causa: 1 + 0,4n + 0,15n² com n = ilha + volta deixava Honshu da volta 2 mais barata que a ilha 4 da volta 1, e dinheiro inicial + sementes compravam tudo em 2 min (o resto era 14 min só cavando = os trechos chatos). 8 h com amuletos: 28/28/27/29 min na volta 1 (antes 24/16/14/19); 100 h sem amuletos: média 31 min, mín 23, máx 43, Pátio 42, trechos >5 min 52 (maior 14; antes 73/17), volta 17 sem parede. Medalhas `D.ENDGAME.medal` ouro [31, 28, 24, 29, 33] · prata [45, 40, 35, 40, 47] (ouro = quartil rápido do robô; Honshu vale pras voltas 2+, a campanha fica no bronze); sem lapK (os tempos não encolhem por volta). tools/longo.js mede a hora exata do final (S.endT). Medição: docs/medicoes/longo100-item6.txt. FALTA: régua de 100 h COM amuletos (parada em 84 h a pedido do dono; até lá sem parede, ilhas 17–60 min — os amuletos abrem a variância; se o ouro ficar fácil, apertar pra ~[29, 22, 20, 24, 28]).
- FEITO (Fable, item 6 B): nós Absurdo 15–20 = 70 mil / 140 mil / 250 mil / 400 mil / 600 mil / 850 mil sementes (islands.js D.SEEDS; antes 25…3.000, saíam todos em 2–3 viagens). Com ~110 mil sementes por viagem o robô guloso pega um nas voltas 2, 3, 4, 5, 7, 10 (conferido no longo.js --verbose até a volta 6: 3, 4, 6 com os custos intermediários; modelo em Python bate).
- FEITO (Fable, item 6 C): silhuetas absurdas no Pátio de verdade: patio-arte.js lê `S.stats.patio` (G.PatioArt.real(), objeto reaproveitado; `?patio=` continua mandando), turma → desenho pelo `tool` de D.PATIO.turmas (tatus→tbm, komeohs→komeoh); `horizon()` novo em tbm.js (fila de 1–3 tatuzões) e komeoh.js (1–3 robôs), em cache igual à Fuji (ciclo do rig gravado 1 vez em 12 quadros + tingidos guardados; ~0,1 ms/chamada). Ainda FALTA a câmera chegar no pátio (X.minX ou voo; ele fica depois da estátua) — no jogo normal o jogador não vê o horizonte do pátio.

## 18/11 — jogo-infinito passo 1 (sem tetos) + sementes.md + Selo da fábrica + Ver o Pátio (Fable)
- SEMENTES sem teto: D.SEEDS sem `max` = infinito (custo base×1,45^nível); com fim só Mala (3), compras únicas (garagem, marco turbo, livro, absurdos 70 mil…850 mil intactos), cochilo (5) e cama (4). Turma do Kome = +1 nos níveis 1–3 e depois +1 a cada 5 (`ajudN`); Poupança ×10 até o 5, depois +¥10 mi/nível (`granaOf`); Faro Dourado 10%/nível até o 10, depois 2%. Sementes sem `|0` (patio.js, game-ui, cookie-ui), contas com U.fmt; cartão de partir mostra "X da ilha + Y do Pátio". O "+10% por ×10, teto +50%" do sementes.md ficou substituído pelas Sementes do Pátio (camada-cookie.md item 7). longo.js: guloso compra absurdo primeiro (guarda pra ele), senão a mais barata, até 600 por viagem.
- OFICINA: marco a cada 25 níveis depois do 50 (G.Inf.mileAt/isMile; miles() conta pra sempre), cada um dobra o bônus, dá escolha de caminho e uma medalha de cor nova (oficina-arte medals: 3 estrelas + até 3 medalhas rubi/esmeralda/safira/…/arco-íris com o número; badge colorido); régua do cartão anda de 25 em 25; ×grande vira U.fmt.
- FÁBRICA, Selo de Qualidade sem teto: no Nv. 10 o botão vira "Tirar o Selo ★N" (Nv. 1 + estrela); +50% no valor por estrela que segue NO ITEM (item.q, média dos ingredientes × estrelas: linha toda estrelada multiplica); níveis ×3 por estrela (D.FAB.selo); placa ★N bronze/prata(5)/ouro(10)/arco-íris(25) na máquina e no cartão; tirar a máquina guarda o selo (S.starBank → próxima do tipo); save: 10º campo da máquina + `sb` em S.stats.fab (sem MIGR: campo novo, padrão 0). fabrica-sim 150 min: espera máx 2.859 s → 146 s; teto 52% → 58%. FALTA do fim de jogo da fábrica: Embaladora de Bentô e meta 100 bentôs (arte nova).
- NÚMEROS: o formato já ia até vigintilhão + nomes de comida (cookie) e depois 1,23e45; corrigido 'vigint' (engine) ≠ 'viginti' (CSV) que duplicava o nome e empurrava os de comida ×1000.
- VER O PÁTIO: chip "Ver o Pátio" (depois do final, com turma no Pátio) faz voo de câmera: mão → médias → horizonte das gigantes/absurdas e volta (≈10 s, toque volta antes). Só câmera, dentro do camTick (não roda no FAST, não trava entrada/sim). game.js: patioTour, patioTourCam, 1 linha no camTick, chip no boot, __kome.patioTour/patioTourT.
- RETUNE das sementes depois do longo 8 h (com Cidade/faixas em WIP na mesma árvore): ilhas 19/15/13/22 (volta 1), 15/11/19 (volta 2), média 16 min = abaixo da meta 25–35. Ajuste (sem medir de novo: o dono limitou a 1 rodada de 8 h): Amigo do Corretor -6% até o 8 e -1% depois (`precoK`), Poupança volta a máx 5 (kit de partida, igual à Mala), Faro de Ouro +25% até o 8 e +5% depois. Nos níveis que o guloso alcança (~10) os efeitos ficam iguais aos tetos antigos, então as ilhas devem voltar perto dos ~28 min de antes; MEDIR com `node tools/longo.js --horas 8 --chato 5`. Se ainda curto: Arroz Abençoado é o próximo suspeito (era máx 100 mesmo antes).
- FEITO (Fable, Cidade fatia 1): `game/cidade.js` (G.City, portado do protótipo) — Despensa = 40% dos onigiris/mochis vendidos na doca (fabrica.js sell → G.City.take; cheia = vende na doca), abre no 1º mochi, 8 moradores, 3 pedidos sem prazo (2× o valor da doca via G.Fab.itemV), amizade = +1 grão no Arroz do Coração (patio.js heart), 9 prédios com UMA obra por vez (2,5→30 min), 2º quarteirão, festival/estações, offline (obras+lojas), chip Cidade, rua da Cidade na Vila (game-world.js drawCidade; toque entra), save `S.stats.city` MIGR[7]/SAVE_V 7, robô do longo monta moldadora+linha de mochi e joga a Cidade, 7 checks no alicerce, demo `?dev&cidade=demo|escolha|festa`. Longo 8 h: 61 novidades da Cidade, sem erro; ilhas 14–16 min (sementes sem teto do outro agente? A/B não feito). Falta: ver fim de docs/design/cidade.md.
- FEITO (Fable, jogo-infinito passo 3): FAIXAS — `game/faixas.js` (G.Faixas): faixa = volta (lap 1 = branca … 7 = preta, 8+ = Dan sem fim), 1 regra nova por faixa (montanha 20% maior · só 4 amuletos · bolsões escondidos · duro mais cedo · eventos mais raros · combo frágil · 2 cartas · sacos tímidos · chegada sem presente · núcleo blindado; 4º Dan+ reforça as numéricas até o teto), sementes ×1,5^faixa (islands.js gain), 5 amuletos de faixa (Kiai, Tatame, Randori, Ippon, Faixa Preta: campo `faixa` na ficha), faixa amarrada no Kome em toda tela (E.shibaBelt nova no engine/shiba.js: camada pintada depois da pose, 27/39 poses iguais), cartão de apresentação 1x por faixa e quadro no mapa. NÃO mexe em preço (o preço por viagem já sobe por volta). Save v8 (MIGR[8]: S.stats.fx, S.stats.evo).
- FEITO (Fable, jogo-infinito passo 4): EVOLUÇÕES — `game/evolucoes.js` + 6 fichas `evolucao-*` (Pá Lendária, Trator Comboio, Escavadeira de Dois Braços, Bagger Dourada, Caminhão Foguete, Colheitadeira Gourmet): Oficina 25 + amuleto certo na ilha = ×3 na máquina em uso, cena curta (cartão, 6 s, toque fecha, FAST pula), Caderno com "?" até achar; desenho = embrulho do G.Tools[id].draw (m.evo + peças extras; lâmina de ouro da Pá em tools-hand.js). alicerce: 5 checagens novas.
- NÃO TESTADO (faixas/evoluções): balanço das faixas e do ×1,5^faixa nas voltas 2+ (só 1 longo de 8 h como sanidade, ver abaixo); nós Absurdo agora chegam antes (sementes ×1,5^faixa); jogar de verdade uma evolução (chegar no nível 25 da Oficina com o amuleto certo) e a cena por cima do jogo; Safari sem canvas filter (Bagger Dourada sai sem tinta, só brilho).
- Longo 8 h (sanidade, com faixas): volta 1 ilhas 21/18/24/24 min; volta 2 (Faixa Branca) Honshu 28 min, Hokkaido 15 min (a mais curta: sementes ×1,5 encurtam; se ficar <15 nas próximas, baixar D.ENDGAME.faixa.seeds pra 1,3); 1 trecho chato de 13 min (volta 1); sem erro.

## 19/11 — jogo-infinito passos 5 e 6 (Fable): escada, carta do dia, recordes, modos · SAVE_V 9 (MIGR[9])
- FEITO conquistas em escada: `game/escada.js` (10 escadas sem fim, grau = +1 conquista no Arroz do Coração via patio.js heart(), chip "Sacos 92%" da mais perto de fechar → Caderno; contadores novos dugAll/amPick; calibrado com `longo.js --stats` (novo); "amuletos descobertos" virou "escolhidos" (descobertos acaba em 35)).
- FEITO carta do dia: `game/carta.js` (1x por dia de calendário, tempo fora + fábrica/Cidade + 1 presente: rerrolar grátis/raro garantido (ficha guardada, não acumula) · chuva de sacos · renda ×2 por 10 min de jogo; sem sequência; FAST = presente sem tela; demo `?dev&carta=1&presente=raro`).
- FEITO recordes por ilha×faixa: `game/modos.js` record() (tempo, ¥, medalha em S.stats.recF), no mapa ("Recordes por faixa", tempo de agora × o seu) e no cartão do final ("bater o próprio tempo").
- FEITO modos de partida: `game/modos.js` (Desafio do Dia pela data, 1 tentativa; Só na Pata 20 min sem motor, recorde ¥; Maratona 5 ilhas com a build da 1ª) = ilha normal com S.stats.modo + retrato da partida em d.snap (volta igual + permanente; sem sementes); quadro no mapa depois da 1ª volta; alicerce +11 checagens.
- NÃO TESTADO: jogar de verdade um modo inteiro (só alicerce com finais forçados); Maratona de 5 ilhas real (~2,5 h); cartão do Só na Pata por cima do jogo; carta do dia virando o dia com o jogo aberto (só confere ao abrir); ritmo das escadas fora do robô guloso; ¥ total depois de ~1e300 (×1000/grau usa U.fmt).
- Longo 8 h (o único, com tudo ligado): escadas 51 graus = 1 a cada 10 min (meta), campanha 64 min, ilhas 14–24 min (média 19, igual antes: escada/carta não mexem no preço), maior trecho chato 9 min, sem erro de página.

## 18/11 — botão de trocar máquina + mini tutorial (dicas)
- FEITO trocar de máquina fácil: botão grande com o ícone da máquina atual + setinhas (PC: barra de baixo antes da Árvore, 64×56, tecla T; celular: redondo 60 px colado no CAVAR, em cima deitado / à esquerda em pé) — `game-ui.js` swapTick/swapPlace (DOM só quando muda); Menu do Kome continua com o atalho.
- FEITO chips: secundários (Cidade, Ver o Pátio, Amuletos, Escada) com 2+ ligados vão pra gaveta "Mais N"; fileira estreita dobra também Tatuzão/Modo/Fábrica/Vila/Pátio até caber; chip quente fica sempre na fileira (`game-ui.js` SEC/FOLD2, HUD.chipEl, HUD.chipDemo).
- FEITO dicas: `game/dicas.js` (tabela TIPS, 23 dicas, anel + seta + "Entendi"/toque fecha, fila, 1 por vez, 5 s de respiro, não aparece nos 1os 35 s/cutscene/banner/painel); vistas em S.stats.dicas (sem MIGR); save antigo marca o que já estava aberto; modo acelerado/teste marca quieto; Ajustes › "Dicas de mecânica nova" + "Rever dicas"; demo `?dev&dica=<id>`.
- NÃO TESTADO: cada dica aparecendo jogando de verdade (só a de trocar foi vista; o resto é por condição: Coração/Selo/modos/carta dependem de painel aberto); celular em pé real (a tela de girar cobre tudo no teste); gaveta "Mais" num celular de verdade.
- FEITO (18/11) SÓ FALTA A CASA: montanha acabada (END_DUG) antes da casa = banner+toast 1x e chip fixo "Só falta a casa" (etapa X/Y, preço; toca = buyHouse) + cartão da Casa pulsando; última etapa dá o final mesmo se a montanha cresceu (S.soCasa no save, sem MIGR); recarga só se ¥ + renda não pagam o resto em ECON.HOUSE_WAIT s, anunciada e longe do núcleo dourado (game.js soCasaTick/refillHouse/houseFinal, chip no HUD.init; números ECON.HOUSE_WAIT/GRACE/REFILL_RAD); cena "o último grão" + Kome em casa no 'final', no 'ilhafim' (antes da medalha) e antes do Grande Final ('ultimo'); longo.js junta pra casa. NÃO TESTADO: jogando de verdade até o fim, celular.
- FEITO (18/11) LAG NO CELULAR: culpado nº1 = `ctx.filter` por traço (névoa da fileira de fundo da Vila e do horizonte da cidade, frota de fundo escurecida, Bagger Dourada, Gêmea pilotada): Vila com Cidade caía pra ~3 quadros/s. Agora folha da arte/cores filtradas 1x em cache (`art(..., flt)`, `fcol`) e vetor animado numa tela de apoio carimbada com UM filtro (`G.World.filtered`); + tela coberta (Cidade/Fábrica/Oficina) não desenha a montanha, fim do dia opaco não desenha o mundo, fundo em pixel guardado (câmera parada = redesenha a cada 2 quadros), frota estacionada em imagem até zoom 1,5, chip sem mudança não refaz layout, PORTRAIT em cache, resolução adaptativa (`stage.setMaxDpr`: 2 → 5/3 → 4/3 depois de ~3 s abaixo de ~42 qps; `__kome.res(v)` fixa pra teste). Custo sintético por quadro (Pixel 5, 2560×1080): Vila+Cidade 1508→8 ms, fim do dia 39→13, pós-final 49→42, resto igual. NÃO TESTADO em celular de verdade (GPU real); montanha (heap.draw) continua sendo o maior custo de raster de longe.
- FEITO (18/11) LAG 2: montanha guardada (`heap.draw(..., {cache:true})` em engine/terrain.js: corpo numa tela de apoio na escala da tela, só refaz o retângulo das colunas que mudaram / a faixa nova quando a câmera anda / tudo quando muda zoom; zoom andando = desenho direto; brilhos, flash e grãos rolando vivos; `?nocache` e `__kome.heapCache(v)` pra comparar) · shiba em laço (walk/run guardados por fase do ciclo + piscada, não por t: falhas de cache por quadro 12,8→7,3 no pós-final) · grãos do SlideFX em lote por cor · brilho dos botões (k-glow, kpulse, kfire) só em opacity/transform num pseudo-elemento. Sintético (Pixel 5, 2560×1080) antes→depois: começo 20→7 ms (2× lento: 17→34 qps), Bagger 16→12 ms (17→18 qps), pós-final 46→40 ms (7,7→9 qps), Cidade igual. Comparação pixel a pixel do pós-final com/sem cache: 3,8% dos pixels mudam ≤ meio pixel de borda, 0,03% muito. NÃO TESTADO: celular de verdade (GPU real, onde carimbar a imagem é quase de graça); pós-final continua pesado por coisas espalhadas (pátio/coletor/pé da montanha/Bagger), não pela montanha.
- FEITO (19/11) LAG 3 (pós-final/Pátio): frota de fundo escurecida pelo filtro DENTRO da imagem guardada de cada máquina (era 1 filtro por quadro numa tela do tamanho da frota = o maior custo), imagem de máquina na escala do aparelho e carimbada pixel com pixel, zoom andando = desenha direto, refaz escalonado (frota parada com zoom < 0,45 a cada 8 quadros); shibas de fundo (ajudantes, pilotos) em laço guardado (`E.drawShiba.loose`, tabela LOOSE em engine/shiba.js; Kome e a máquina dele fora) — falhas de cache ~7 → ~1 por quadro; coletor em camadas (`Draw.layer`, novo em engine/pix.js); montanha refaz o cavado a cada 2 quadros; lotes (pé da montanha, cerca, chão do Pátio, pétalas/neve); celular começa em 5/3 (`?dpr=2` volta). Sintético (Pixel 5, mediana, base→agora): pós-final 38–40→16–18 ms (em 2: 39→16), Bagger 14→9, começo 8–11→6–7, Cidade 7–8→6–7, noite 10–13→9, Pátio (passeio) 22–23→13 (média 14–17, ainda acima de 12). NÃO TESTADO em celular de verdade; laço aproximado dá ~1 px de salto na emenda (só shibas de fundo); S.col.pulse = 1 do credit() está dentro de um comentário (coletor não pulsa ao receber — conferir se é de propósito).

## 18/11 — caçada de bugs (QA)
- FEITO código preso no fim de comentário `//` (igual ao bug da casa): credit() `S.col.pulse = 1; S.win.inc[kind] += v` (coletor não pulsava com a renda; win.inc só descia), pop com o coletor fora da tela `x = edge.x; y = edge.y` (o "+¥" nascia fora da tela), setTool `S.col.y = heap.surf(...)`, scenery.js estátua do Kome-Oh sem recorte fora da tela. Varredura de game/ e engine/ por regex: o resto é documentação.
- FEITO ganho miúdo (+¥ juntado a cada 1,2 s) contava 2x no dayEarn (salário do dia) e no ipsAccP (R0 do Pátio) fora do modo acelerado; credit não soma de novo no pop (alicerce: "ganho miúdo conta 1x").
- FEITO botão redondo de trocar máquina (celular) levava ~3 s pra aparecer/mudar de lugar: swapTick contava o relógio com o dt do quadro em vez do tempo acumulado do HUD.update (10x/s). Gancho de teste __kome.patioTourT() sem número zerava o passeio do Ver o Pátio (NaN, nunca acabava). alicerce: até 6 recargas quando o file:// abre com storage falso.
- FEITO modos: voltar da partida de modo (merge) perdia as dicas vistas, os sacos colhidos no total (stats.got) e as cutscenes vistas no modo (repetiam na partida) → entram no PERM/cs_* (alicerce: "dica e cutscene vistas dentro do modo"). Demo ?dev&cidade=festa|escolha caía na cena errada (RegExp.$1 lido dentro do setTimeout).
- FEITO final comprado no meio da noite (fim do dia): S.dayEnd ficava > 0 pra sempre (dayTick saía cedo com S.ended) → amuletos/faixa/modos/carta/mapa nunca abriam até recarregar; agora a noite acaba. Classe k-night sai quando a noite acaba no relógio do jogo (o setTimeout voltava o HUD antes, com o jogo lento). Viagem/modo em ?dev recarregava SEM ?dev (caía no save de verdade). Botão "Trocar as 3" dos amuletos sem sementes não tremia.
- FEITO Só na Pata: com o cartão do resultado atrasado (painel aberto) ele comparava de novo com o recorde que acabou de gravar e dizia "Seu recorde" em vez de "recorde!" (mo.nb/mo.old guardados na hora).
- FEITO Esc fecha o mapa das ilhas (fora do tutorial) e a carta de cima do Pátio/Coração/Sementes (antes só o X); com o mapa por cima, 1 Esc fecha só o mapa.

## 19/11 — bugs v7 da montanha (pilha invisível, Bagger, recarga atrás do trator)
- FEITO "a pilha fica invisível do nada": a montanha guardada (engine/terrain.js drawCached) e o Draw.layer (coletor) confiavam na tela de apoio pra sempre; no celular a aba em 2º plano/tela bloqueada perde o canvas acelerado (fica transparente sem erro) e iOS sem memória devolve contexto nulo → montanha some até mudar o zoom. Agora `E.gfx` (core.js: epoch sobe ao voltar a aba/bfcache/contextlost/contextrestored; lost/ok), cache refaz no epoch novo, contexto perdido = desenha direto, tela que não abre/erro = direto por 2 s (cacheStats.fails), refeita inteira a cada ~7 s (Draw.layer ~15 s), limite 16 Mpx; montanha velha solta a tela no buildWorld. Nos testes scriptados (Playwright, PC+Pixel 5: 14 ferramentas, zoom, resolução, ilhas, montanha nova) cache = direto; a perda do canvas em celular de verdade NÃO foi reproduzida (headless não perde contexto) — simulada apagando a tela de apoio.
- FEITO "a bagger não limpa o chão": lógico, não visual (cache = ?nocache). Zona morta: a roda fica sempre ~560 à frente do corpo e o corpo para 300 antes de arroz > 34 → cavando com a roda no alto sobrava um degrau ~160 entre as esteiras e a roda que ninguém alcançava. game.js shaveShelf (segurando, raspa colunas ≤ 220 entre o pé das esteiras e a roda, orçamento 0,4×Aeff). (O outro agente baixou LMIN pra roda encostar no chão.)
- FEITO "a montanha deu spawn atrás do trator": refillHouse escolhia o ponto LONGE do Kome (score −|x−P.x|) → com o Kome no fim da montanha caía atrás da máquina, que só cava pra frente (CAVAR no celular só procura à frente). Agora refillSpot: pé do monte novo ≥ workFront()+150 (Bagger m.x+520, cabine P.x+park+60, caminhão LX/pá), longe do núcleo, raio encolhe até 50%; sem espaço = seatBefore (máquina vai pra antes do monte) + yardSnap. newMountain usa seatBefore (caminhão: a pá carregadeira não fica dentro do monte). Ganchos __kome.refillSpot/refill. alicerce: cache×direto (Pá/trator/Bagger, tela apagada, tela que não abre), degrau da Bagger, recarga na frente.
- NÃO TESTADO: celular de verdade (perda real de contexto, iOS memória); balanço do shaveShelf no --auto; recarga jogando de verdade até o fim.
- UX CASA (game/home.js + game/ux-casa.css): varanda com 5 abas (Construir · Quintal · Roupas · Caderno · Mais); aba Construir = escada das 6 etapas (desenho, "etapa 2 de 6", preço, ganho, botão dourado Construir → G.Game.buyHouse) + "Casa pronta · Montanha acabada" sempre à vista; Quintal junta Enfeites/Bichos/Estação; Ilhas e Armazém em Mais (com Voltar); CSS .kh-* saiu do JS. Cartão Casa do HUD e chip "Só falta a casa" abrem a escada quando não dá pra pagar. Painel antigo (?casa=lista) ficou como estava.
- FEITO (v7, pai do dono) "preço da fábrica fica mais caro toda hora": o preço seguia a média de 1 min da renda a cada quadro; numa ilha nova a renda sobe ×1000 e a Moldadora foi de ¥1,3 mil a ¥2 mi em 24 min sem comprar nada. Agora PREÇO TRAVADO (fabrica.js priceBase/rebase): renda de referência S.pb só muda ao comprar na fábrica (menor entre média de 1 e 5 min, s5 novo no save sem MIGR) ou desce se a renda cair à metade; repro: preço parado 24 min. Selo ×3/amuleto/faixa não eram a causa. fabrica-sim (4 partidas, antes→depois): fatia 1 h 35→42%, teto 53→60% (FORA ≤55), espera máx 135→151 s, níveis 122→147; se o teto incomodar, D.FAB.priceK 3,0→3,6.
- FEITO "comprei várias sementes de % de custo e a fábrica demorou igual": Amigo do Corretor dizia "todos os preços" mas não valia na fábrica (nem o amuleto Pão-Duro "tudo custa 20% menos"); agora vale (islands.js precoMul, fabrica.js priceCut; 12 níveis = Moldadora −41%). Semente nova Tempero da Vó (+10%/nível na venda da fábrica, +2% depois do 10, fabMul) pra fábrica render mais a cada viagem; layout/níveis já iam junto. Toda semente mostra o efeito de agora (fx em D.SEEDS → mapa das ilhas e cartão da árvore: "agora: −41% nos preços"). alicerce: check do preço travado.
- NÃO TESTADO: longo 3 h depois da mudança (cortado por ordem do dono; a rodada de antes deu ilha 1 = 19 min); robô do longo não compra a Tempero de propósito (gasta sementes nela por ser barata: conferir tempo das ilhas); alicerce/monkey não rodados por mim; check --fast tem 5 falhas de HUD (chips Viagem/Mais/Lugares fora da tela) da rodada de UX, fora dos meus arquivos.

## 19/11 — v7: CAVAR dava ré, máquinas lentas, Bagger não limpava o chão
- FEITO CAVAR/S/Espaço dava RÉ: a mira era `T.bite(S.m).x` no instante do aperto (presa enquanto segura); a caçamba balança no ciclo (escav −175..+239 px do corpo, pá de cabo −173..+504, trator +17..+114, britadeira +2..+5) → apertando com a caçamba recolhida a mira caía atrás e parkClimb/parkAt davam ré e ficavam lá. Agora `digAim()` (game.js): a pé = frente do Kome presa; cabine = barranco à frente (faceAhead), só avança (entra devagar se onde mira está raso); caminhão = lado da montanha; Bagger = roda, avança enquanto morde abaixo da faixa boa. Reproduzido com Playwright Pixel 5 deitado + toque no CAVAR (escav/pacabo BACK), depois 0 ré nos 14 degraus. Não era o botão de trocar nem o joystick.
- FEITO velocidade das máquinas pelo tamanho: `vmax`/`tau` em D.TOOLS (data.js), ~1 tela da máquina (1150/zoom) em ~3,5 s + inércia; `travel()` no game.js (acelera/freia em tau, freia a tempo); Bagger com `inp.crawl/crawlTau` no bagger.js (sem eles, demo igual). Antes→agora px/s: trator 126→300, empilhadeira 120→380, colheita 96→340, escav 114→520, pá do caminhão 30/320→160/520, pá de cabo 30→700, Bagger 70→1000 (Gêmea ×1,5). Playtest --auto: final 63,8 min, espera máx 125 s, Bagger com 31% cavado.
- FEITO Bagger não limpava o chão (geometria): lança descia só até −18° = roda parava 33 px acima do chão (resto ≥33 px, borda do círculo >34 = trava do corpo). LMIN −22° (roda encosta no chão); alvo da roda já respeita o limite do corpo (não bate e volta viajando rápido).
- NÃO TESTADO: celular de verdade; travessia das máquinas que sobem encosta (trator/empilhadeira/colheita/escav) num barranco cavado de verdade (no teste sintético chegaram na vmax mas pararam em paredões); --rungs, alicerce e monkey não rodados (dono pediu menos teste); check --fast acusa "Viagem/Mais/Lugares fora da tela" e dica × botão de trocar = rodada de UX de outro agente (menu-ui.js), não disto.
- FEITO (Fable, UX Fábrica): faixa "o que fazer agora" + guia da 1ª Moldadora em 3 passos (seta no botão/casa), barra de baixo com nome em todo botão, "Arrumar pra mim" (fileiras; desfaz), cartão com "ela rende ¥/s" + Melhorar dourado com salto (+¥/s) / "falta ¥", botões Girar/Mover/Tirar (Mover por toque), confirmação do Selo, topo "a fábrica rende ¥X/s" contando, Ajuda com desenho do caminho. Tudo em funções de tela do game/fabrica.js (arrange, nowLine, drawNow, drawGuide, drawCard, drawSeloAsk, machineYen). Não testado: celular real, monkey/alicerce (ordem do dono).
- FEITO (Fable, UX ilhas): mapa das ilhas refeito (paradas grandes em cima do Japão, abas Ilha/Sementes/Modos, rodapé fixo com "Viajar" dourado + Fechar, seta "tem mais"), confirmação em 3 linhas `G.IslandsUI.ask/askTravel` (fica/recomeça/ganha; islands.js travel e modos.js usam), modos em 3 cartões (`G.Modos.modesInfo/recInfo/news`), quadro da faixa com a regra nova em 1 frase, carta do dia com texto curto; CSS em game/ux-ilhas.css. Falta: cartão de medalha do fim da ilha (lista em game.js islandEnd) e olhar PC/em pé.
- UX amuletos: fichas com bom/ruim/piada (verde ▲ / marrom ▼ Custo + ícone do efeito), escolha com 2 toques (carta → Escolher), X/Esc/fora = Depois, painel "Seus amuletos" com vagas e trios "2 de 3 da Sorte", Caderno em 5 abas (goals.js TABS, G.Goals.show), Metas (escada) e Evoluções em receita; CSS em game/ux-amuletos.css.
- UX Oficina (rodada de UX): abas em cima (Máquinas/Gêmea/Galpão/Lojas) + X Sair; cartão da máquina com dica, barra 'nível N · marco no M', medalhas, seletor x1/x10/máx (G.Ofi.qty, sem segurar), Melhorar dourado com preço+ganho; Lojas viraram janela de cartões (6 por página); marco = 2 cartões de 1 linha + 'não tem escolha errada'. Falta: conferir no celular de verdade; alvos da Oficina seguem a escala do canvas (960×540).
