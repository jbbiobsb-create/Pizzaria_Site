# Kome no Japão — passagem de bastão pro próximo chat

Cole este arquivo (ou peça pro Claude ler `kome/CONTINUAR.md`) no começo da próxima conversa, junto com a pasta `kome/`.

## Prompt pronto pra colar

> Estou continuando o jogo **Kome no Japão** (pasta `kome/`). Leia `kome/CONTINUAR.md` inteiro antes de mexer em qualquer coisa,
> depois `kome/docs/NOTAS-JOGO.md` e `kome/docs/GDD-ADENDO.md`. Trabalhe no modo econômico: um passo por vez, me mostre um
> print depois de cada mudança visual e espere eu dizer se segue. Comece pelo item 1 da lista "O que fazer agora".

## O que é

Jogo incremental de navegador (canvas 2D + HUD em DOM, sem dependências, sem build, texto em pt-BR). O Kome, um shiba chibi de
chapéu de palha, cava uma montanha de arroz com 13 ferramentas, da pata até uma Bagger 293 que ele mesmo pilota, pra comprar
uma casa no Japão. Roda abrindo `kome/index.html` direto do disco.

O projeto tem duas metades com o mesmo peso pro dono:
1. **O jogo.**
2. **A Kome Engine** (`kome/engine/`), reaproveitável: a ideia é pedir "um lago de carpas", "um alce", "um carro" e já sair no
   estilo Kome.

## Como rodar e testar

- Jogo: abrir `kome/index.html`. `?fresh` na URL começa do zero. Save em localStorage, chave `kome-no-japao-v4`.
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
  engine/                 Kome Engine (classic scripts; ordem: core, pix, shiba, fx, terrain, rig, audio, nature, ui)
    core.js     U, RNG, Noise, Tween, Stage, Input, Loop, Scenes, Save
    pix.js      PAL (paleta), Pix (pixel art), sprite, Draw.* (treliça, esteira, pistão, pneu, escada, placa...)
    shiba.js    o Kome: 39 poses, 11 paletas, drawShiba, drawShibaHead, shibaAnchor, Actor
    fx.js       Camera, Particles, Floaters, ScreenFX
    terrain.js  Heap (montanha de arroz em camadas, grãos visíveis), Pile, Grains
    rig.js      Rig, ik2/ik3, Joint, Chassis, Exhaust, Conveyor, Rope, Telescope, Spring
    audio.js    Sfx, Loops, Music generativa
    nature.js   cenário japonês: céu por hora do dia, Fuji, árvores, torii, casa em estágios, Pond, Koi
    ui.js + kome.css   HUD em DOM, árvore em mapa, painéis, toasts
  game/
    data.js            TODO o balanceamento (ferramentas, materiais, árvore de 68 nós, casa, economia)
    game.js            estado, economia, drivers das ferramentas, compras, celebração, câmera, laço
    game-world.js      fundo, "régua do mundo", casa, coletor
    game-ui.js         HUD, árvore, ajustes
    tools-hand.js      pata, hashi, tigela, pa, duaspas, carrinho, britadeira (+ G.Props: sacos, ícones)
    machines-mid.js    trator, empilhadeira, escav
    machines-mine.js   pacabo (pá de cabo), caminhao (+ G.Scale: pickup, keitruck, moega)
    bagger.js          Bagger 293
  demos/                 uma página por módulo/arquivo de máquina
  tools/                 shot.js, playtest.js, ENGINE_CONTRACT.md, ART_DIRECTION.md
  docs/
    GDD.md               design completo (v4)
    GDD-ADENDO.md        pedidos do dono depois do v4 — TEM PRIORIDADE sobre o GDD
    NOTAS-JOGO.md        estado do jogo, o que falta, pontos de extensão no código
    NOTAS-FERRAMENTAS.md como cada ferramenta se comporta (interface G.Tools, eventos, âncoras)
    bagger-anatomy.md, incremental-design.md, cutscenes.md, audio.md   pesquisas
    prints/              screenshots de referência
```

**Não existem ainda**: `engine/gfx.js` (efeitos na placa de vídeo), `engine/cutscene.js`, `kome-engine.js` (bundle),
`KOME_ENGINE.md` (documentação definitiva da engine). O contrato deles está em `tools/ENGINE_CONTRACT.md`.

## Estado atual (etapa 1 pronta)

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

1. **Arrumar o pátio.** As máquinas antigas estacionadas e os prédios da régua ficam um em cima do outro. Dar faixas/espaço,
   ordenar por tamanho, e garantir que a fábrica e a torre apareçam ao lado da Bagger (é o que vende a escala).
2. **Máquinas antigas trabalhando sozinhas.** Hoje ajudantes e pilotos só rendem dinheiro (`autoTick()` em `game.js`); as
   máquinas ficam paradas. Fazer os shibas pilotarem de verdade (trator, empilhadeira, escavadeira, pá de cabo, caminhão) em
   bancadas próprias da montanha, entregando no coletor. É a parte "Potato Please" do jogo.
3. **Textos de ganho embolados.** Quando vários "+¥" estouram juntos eles se sobrepõem. Agrupar/empilhar.
4. **Trombada do carrinho de mão** (adendo §4): a batida derruba o barranco em avalanche pra dentro da caçamba; despeja pra
   trás; de vez em quando soterra o Kome até o chapéu.
5. **Britadeira**: rachaduras se espalhando antes do bloco cair.
6. **Cavar mais da montanha.** A partida termina com ~70% cavado; o alvo é 85–95%. Ajustar em `data.js`.
7. **Nós da árvore sem efeito visível** (lista em `NOTAS-JOGO.md`): cada upgrade tem que mudar algo na tela.
8. **Ciclo de dia e volta pra casa** (adendo §8): dia de 8–10 min, pagamento no pôr do sol, cena curta no quintal, casa
   crescendo de caminha de cachorro até mansão de luxo, hora extra opcional. Ir pra casa é prêmio, nunca castigo.
9. **Achados enterrados cosméticos** (adendo §7): chapéus, óculos, capas, cores do Kome, pinturas de máquina; guarda-roupa.
10. **Cutscenes** (abertura, revelação da Bagger, final), **conquistas, missões, álbum** (GDD §8.3 e §12).
11. **Modo infinito**: montanhas diferentes (mochi, oca, vulcão de curry, gelada, gêmea) escolhidas entre 2–3 sorteadas;
    jardim pra decorar; recordes e desafios. Nada de prestígio que zera tudo.
12. **Tatuzão** (adendo §10): `game/tbm.js` já feito como máquina avulsa; falta ligar no jogo (modo infinito).
13. **KOME-OH** (adendo §11): todas as máquinas se juntam num robô gigante pilotado pelo Kome, com cena de transformação
    estilo anime e soco foguete. Topo do modo infinito. O dono amou: tratar como peça de destaque.
14. **Enxame de robozinhos** (adendo §12): automação com dezenas de robôs carregando grão em fila até o coletor.
15. **Engine**: `gfx.js`, `cutscene.js`, demo do lago de carpas usando só a engine, bundle e `KOME_ENGINE.md` com modelo de
    prompt pra pedir cenas novas; catálogo de bichos e veículos.

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
