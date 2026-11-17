# Mundo em dois lados (Zona Industrial × Vila do Kome)
status: no jogo (rodada "sem pontos fracos" feita; ver "Ficou de fora / precisa de decisão")
camada: mundo/cenário   ·   depende de: game-world.js, scenery.js, industry.js, belts.js, game.js (câmera, frota)

## Em uma frase
A montanha divide o mundo: do lado da cava só tem coisa de trabalho, em vagas que não se encavalam; do outro lado fica a
Vila do Kome, toda fofa, que o jogador visita com o botão "Vila".

## Como funciona (regras)
- Lado da cava = ZONA INDUSTRIAL. Lado de lá (x > 8000) = VILA DO KOME, começando em `VB = 8900` (a Bagger Gêmea saiu do
  vão entre a montanha e a vila: agora NADA industrial fica do lado da vila).
- Começo do jogo (até a Britadeira): o lado da cava é só o gramado com a casinha de cachorro (x 1716) e a barraquinha
  (x 1560), fixas. Com o Trator a casinha e a barraquinha mudam pra vila (junto com a compra do terreno).
- **O pátio acompanha a frente de lavra.** Tudo do lado da cava é medido a partir do pé da montanha de agora
  (`X.front = 1800 + X.shift`). `X.shift` persegue o recuo do pé da montanha com aproximação suave (20% da distância por
  segundo, no máximo 40 u/s): como a câmera anda junto com a máquina, o pátio parece parado na tela. Troca de ferramenta,
  montanha nova, save carregado e modo FAST encaixam na hora. Nada disso entra no save (é derivado de `S.footX`).
- O pátio VARRE o chão onde pisa: o tapetinho de arroz que sobra atrás da frente de lavra (menos de 20 de altura) é
  recolhido e pago como qualquer arroz (mesma conta das esteiras da Bagger). Sem isso as vagas ficavam em cima de arroz.
- Largura da frente de lavra (`X.lane`) = o que a máquina NA MÃO precisa (`X.need`): a pé 420; cabine = distância de
  trabalho + ela + coletor (trator ~480, escavadeira ~660, pá de cabo ~910); caminhão ou Bagger 293 = 1500 (também com a
  Bagger em montagem ou com o Goma na cabine); pilotando a Gêmea (1,5×) = 2120.
- Frota com piloto: com o Kome A PÉ e sem Bagger na frente, as pequenas vão até o barranco pela faixa da frente e cavam lá
  (como sempre). Com o Kome numa máquina de cabine, caminhão ou Bagger, elas trabalham NA VAGA, cada uma na sua bancada
  de rechego (montinho de arroz + bloco de concreto na frente da vaga). Não existe mais bancada na encosta: o barranco é
  íngreme (60 a 74 graus), não tinha como subir sem passar por cima da máquina grande nem como apoiar sem entalhar a
  montanha. A renda é a mesma (autoTick), cavada espalhada no pé da montanha.
- Bagger Gêmea (modo infinito): vaga própria do lado da cava, logo atrás da 293. A 293 despeja num MONTE DE ESTOQUE
  (esteira inclinada) e as rodas da Gêmea comem o monte; a lança de descarga dela alimenta a boca do túnel da esteira.
  Pilotando a Gêmea, quem fica na vaga é a 293 com o Goma.
- Esteira: é subterrânea. Entra numa boca de túnel na beira do pátio (do lado do coletor) e sai depois do silo, na porta
  do galpão KOME PACK. Não passa mais por trás das máquinas estacionadas.
- Botão "Vila" ⇄ "Montanha" no topo: a câmera voa por cima da montanha em 1,5 s e volta. O zoom do voo nunca abre mais que
  60% do zoom de quem está mais aberto (pátio ou vila): em vez de afastar, o caminho sobe; montanha quase cavada = voo
  baixo. Nuvens em pixel e riscos de vento passam na tela durante o voo. Na vila, ARRASTAR (ou A/D, setas) passeia pela
  rua; toque simples volta. Comprar etapa da casa ou adereço que mora na vila leva a câmera até lá e ela volta sozinha.
  No modo FAST o voo não acontece (a câmera só anda em quadro de tela) e nada trava a cava.
- Horizonte: atrás da cava, zona industrial em névoa (chaminés com fumaça lenta, guindastes de pórtico, tanques, esferas de
  gás, torres com fios, contêineres, silos), tingida pelo céu da ilha, crescendo com a frota (nada antes do Trator). A
  cidadezinha fofa (pagode, castelo, casinhas) só aparece atrás da vila.
- Ilha espelhada (scene.mirror): nada muda no código, os bairros trocam de lado junto com a montanha.

## Números: tabela de vagas da zona industrial (da montanha pra fora)
`F` = pé da montanha que o pátio acompanha (`X.front`). `x0 = F - X.lane` (com a Gêmea, `x0` fica depois da vaga dela).
Só ocupa espaço o que existe; quem entra depois empurra o resto na compra.

| Vaga | Posição | Largura | Aparece com |
|---|---|---|---|
| Frente de lavra (máquina ativa + coletor) | F - lane .. F | `X.lane` | sempre |
| Coletor (kei-truck / moega pequena / moega) | logo atrás da máquina, nunca à esquerda de `X.keiMin` = F - lane + 60 | 82 a 210 | Britadeira |
| Bagger em montagem | centro em F - 610 | 1390 | nó bg1 |
| Monte de estoque da Gêmea (`X.pilha`) | F - lane - 420 | ~800 | 1ª peça da Gêmea |
| Bagger Gêmea 1,5× (`X.gemea`) | pilha - 170 - 590×1,5 | ~2300 | 1ª peça da Gêmea |
| ESTACIONAMENTO (placa PÁTIO no poste, piso, cerca, vagas pintadas) | começa em x0 - 40 | soma das vagas | Empilhadeira (vaga do trator desde o Trator) |
| Vagas, da menor pra maior, folga 96 (cabe a bancada de rechego) | trator 152, empilhadeira 150, colheitadeira 170, escavadeira 330, caminhão 352, pá de cabo 700 | | cada máquina comprada |
| Boca do túnel da esteira, entrada (`X.tunIn`) | beira do pátio, do lado do coletor | 44 | Trator + silo ou galpão |
| Holofotes (e2b) | nas duas pontas do estacionamento | | e2b |
| Silo | 80 depois da última vaga | 80 | nó Silo (a7) |
| Antena / capataz | silo-52 / silo-90 | 30 | e5 / e3 |
| Boca do túnel, saída (`X.tunOut`) | 138 depois do silo | 44 | junto com o galpão |
| Galpão KOME PACK (escala 3) | 240 depois do silo | 960 | nó Fábrica de Onigiri (m5), Fábrica aberta ou nível do infinito |
| Beco do kei-truck (`X.beco`): ruazinha com meio-fio, bueiro, cancela, espelho, máquina de venda, lixeira, caixotes | colado na ponta de fora do galpão | 260 | junto com o galpão |
| Oficina (escala 3) | depois do beco (sem galpão: 20 de folga) | 330 | nó Oficina (e2a) |
| Caixotes de exportação (m_f) | 150 depois da Oficina | 148 | m_f |
| Torre de energia (referência de escala) | 430 depois da Oficina | 228 | sempre |
| Estátua KOME-OH | 900 depois da Oficina | 340 | Grande Final |

Limite esquerdo da câmera: `X.minX` = 1500 depois da Oficina (anda junto com o pátio).

Vila (fixo, `VB + ...`): placa -120 · sakura 60 · torii 260 · barris de sake 400 · vaga de ilha v4 500 · barraquinha 740 ·
mural 845 · casinha 925 · mesinha 995 · CASA 1200 · kakashi 1490 · v3 1620 · sobrado 1840 · poste 1980 · v2 2080 ·
ekiben 2230 · prédio onigiri 2560 · v1 2880 · outdoor 3140 · fim da rua 3370.
RUA DO COMÉRCIO (modo infinito): a partir de `VB + 3580`, uma loja a cada 290 (ordem de `D.SHOPS`, fichas 'loja'
incluídas). Loja com nível vira prédio (arte gerada `loja_<id>`, escala 3; loja de ficha sem arte usa uma das `cid_*`);
sem nível é terreno com placa "EM BREVE". Freguesia na porta cresce com o nível. A CLIENTE ganha placa vermelha, duas
bandeiras e lanternas acesas. Varal de lanterninhas por cima da rua. A rua (e o limite do arrasto) cresce com as lojas.
Enfeites de ilha (boneco de neve, onsen, shisas, palmeira, mochi, dango, pinheiro) usam v1..v4 e o torii.

## Tela e controles
Chip rosa no topo, junto dos chips de Ilhas/Fábrica. Câmera da vila: centro `VB+1040`, zoom 0,56; arrastar passeia
(setinhas nas bordas quando tem mais rua; dica escrita até o primeiro arrasto).

## Funções mexidas (rodada "sem pontos fracos") — pro programador revisar
- `game/game-world.js`
  - `layout(S)`: tudo a partir de `X.front`; `X.shift`, `X.need`, `X.mk`, `X.lane`, `X.gemea`, `X.gemeaK`, `X.pilha`,
    `X.tunIn`, `X.tunOut`, `X.lojas0`, `X.lojaStep` novos; `X.minX` dinâmico; assinatura do layout virou texto.
  - `drawCity` (vila) + `drawIndustry` (novo, lado da cava); `drawLot` + `drawBin` (bancadas de rechego) + `lotSign`;
    `drawAlley` (novo); `drawShops` (novo); `drawCollector` desenha moega pequena no tipo 'silo'.
- `game/game.js`
  - `yardTick` / `yardSnap` / `yardTarget` / `yardNeed` / `bagFollow` (novos): pátio atrás do pé da montanha, varredura do
    tapete (`heap.digRect`, mesma conta das esteiras da Bagger), `S.bagX` derivado (montagem em F-610; com o Goma, pé-380).
  - `fleetWork(f, i, dt, atFace)` / `fleetTick`: bancada na vaga; `giantFront`, `drawBench`, `benchFn` removidos.
  - `collectorTick`: tipo 'silo' vira moega pequena atrás da máquina; kei-truck não estaciona em cima da barraquinha.
  - `driveBagger`: de ré, a Bagger para antes do pátio. `setTool`: ferramenta de mão desce na frente de lavra.
  - `camTick`: teto de zoom do voo, `vila.fly`; pátio no quadro com caminhão, pá de cabo e Gêmea. `drawFlight`,
    `drawVilaHint` (novos). `readPointer`: arrastar/teclas passeiam na vila.
  - `drawMach`: cache com `always`/`res`, e desenha já espelhado em ilha espelhada (placas legíveis). `G.drawMach`.
  - `G.Game.playAs`, `G.Game.playIndex` (a Oficina usa). Ganchos `__kome.vilaHold(k)`.
- `game/industry.js`: Gêmea na vaga `X.gemea` (cache de imagem: o filtro de pintura passava por cada peça e derrubava o
  quadro), `drawPile`, `m.boom2`; kei-truck do galpão vira no beco (`keiBack`); `zoomK` 0,82 com a Gêmea.
- `game/bagger.js`: `m.boom2` (abertura entre as duas lanças; padrão 0,3 = igual antes).
- `game/belts.js`: reescrito (túnel de entrada/saída, esteira inclinada pro monte, carga passa pra esteira nova).
- `game/scenery.js`: shisas sentados no pedestal (flutuavam). `game/game.css`: nome comprido no cartão da casa quebra linha.
- `game/infinite.js`: `G.News` (avisos do jogo dentro da Oficina e da Fábrica).
- Arte nova por receita: `conteudo/estrutura-loja_*.js` (6 lojas) e `estrutura-prop_*.js` (5 objetos de rua).
- Save: nenhuma chave nova nem mudada. Balanço (`data.js`): intocado.

## Ficou de fora / precisa de decisão
- Cena de fim de dia: continua a tela própria com a casa (não usa a câmera da vila).
- Vila aparecendo por cima da montanha quase toda cavada: não tratado (a vila agora fica 1250 mais perto da montanha).
- As pequenas não sobem mais na encosta com máquina grande na frente (decisão de desenho explicada acima). Se o dono fizer
  questão de vê-las NO barranco junto com o caminhão/Bagger, precisa de redesenho da frente de lavra (terraços na montanha).

## Perguntas do programador
- Rodada "sem pontos fracos" FEITA (18 itens: mundo, Oficina, Fábrica). O dono joga pra conferir: pátio acompanhando a frente, frota na vaga, Gêmea ao lado da 293, voo e passeio na vila, marco pendente na Oficina.
