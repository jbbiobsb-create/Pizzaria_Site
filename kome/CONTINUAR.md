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
- HUD, som, save.
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
