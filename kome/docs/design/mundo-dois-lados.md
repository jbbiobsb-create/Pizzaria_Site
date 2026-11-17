# Mundo em dois lados (Zona Industrial × Vila do Kome)
status: no jogo (núcleo; ver "Ficou de fora")
camada: mundo/cenário   ·   depende de: game-world.js, scenery.js, industry.js, belts.js, game.js (câmera, frota)

## Em uma frase
A montanha divide o mundo: do lado da cava só tem coisa de trabalho, em vagas que não se encavalam; do outro lado fica a
Vila do Kome, toda fofa, que o jogador visita com o botão "Vila".

## Como funciona (regras)
- Lado da cava (x < 1800) = ZONA INDUSTRIAL. Lado de lá (x > 8000) = VILA DO KOME, começando em `VB = 10150`
  (entre a montanha e a vila fica a pista da Bagger Gêmea, que continua do outro lado).
- Começo do jogo (até a Britadeira): o lado da cava é só o gramado com a casinha de cachorro (x 1716) e a barraquinha
  (x 1560). Com o Trator a casinha e a barraquinha mudam pra vila (junto com a compra do terreno).
- O pátio industrial tem duas eras, trocadas numa compra grande:
  - "canteiro" (Trator até Escavadeira): o pátio começa em `x0 = 1380`.
  - "distrito" (Caminhão em diante, ou peças da Bagger compradas): começa em `x0 = 100`, porque a frente de lavra precisa
    de ~1700 de pista livre (a Bagger ocupa de `bagX-770` a `bagX+620`).
- Botão "Vila" ⇄ "Montanha" no topo (aparece depois da dica de controles): a câmera voa por cima da montanha em 1,5 s e
  volta (o arco passa acima do pico atual da montanha). O jogo continua rodando (modo automático, frota, ajudantes); o dedo/mouse não cava olhando a vila; tocar em
  qualquer lugar volta. Comprar etapa da casa ou adereço que mora na vila leva a câmera até lá e ela volta sozinha.
- Ilha espelhada (scene.mirror): nada muda no código, os bairros trocam de lado junto com a montanha.

## Números: tabela de vagas da zona industrial (da montanha pra fora)
`x0` = 1380 (canteiro) ou 100 (distrito). Só ocupa espaço o que existe; quem entra depois empurra o resto na compra.

| Vaga | Posição | Largura | Aparece com |
|---|---|---|---|
| Frente de lavra (só a máquina ativa, coletor móvel, esteira 1) | x0 .. pé da montanha | livre | sempre |
| Kei-truck (coletor) | nunca à esquerda de x0+60 | 82 | Britadeira |
| Bancadas da frota (com Caminhão/Bagger na frente) | 160 depois da frente da gigante, encosta acima, fila pela largura + 70 | largura da máquina + 22 | piloto comprado |
| ESTACIONAMENTO (placa PÁTIO, piso, cerca, vagas pintadas) | começa em x0-40: é a PRIMEIRA vaga | soma das vagas compradas | Empilhadeira (vaga do trator desde o Trator) |
| Vagas, da menor pra maior, folga 64 (só as compradas ocupam espaço) | trator 152, empilhadeira 150, colheitadeira 170, escavadeira 330, caminhão 352, pá de cabo 700 | | cada máquina comprada |
| Holofotes (e2b) | nas duas pontas do estacionamento | | e2b |
| Silo | 80 depois da última vaga (sem frota: x0-60) | 80 | nó Silo (a7) |
| Capataz / antena | silo-58 / silo-90 | 30 | e3 / e5 |
| Galpão KOME PACK (escala 3) | 150 depois do silo | 960 | nó Fábrica de Onigiri (m5), Fábrica aberta ou nível do infinito |
| Beco do kei-truck do galpão (`X.beco`) | colado na ponta de fora do galpão | 260 | junto com o galpão |
| Oficina (escala 3) | depois do beco (sem galpão: 20 de folga) | 330 | nó Oficina (e2a) |
| Caixotes de exportação (m_f) | 150 depois da Oficina | 148 | m_f |
| Torre de energia (referência de escala) | 430 depois da Oficina | 228 | sempre |
| Estátua KOME-OH | 900 depois da Oficina | 340 | Grande Final |

A esteira 1 (pé da montanha -> silo) corre por trás das máquinas estacionadas. Distrito completo vai até x ≈ -5000
(limite da câmera `X.minX` = -5600).

Vila (fixo, `VB + ...`): placa -120 · sakura 60 · torii 260 · barris de sake 400 · vaga de ilha v4 500 · barraquinha 740 ·
mural 845 · casinha 925 · mesinha 995 · CASA 1200 · kakashi 1490 · v3 1620 · sobrado 1840 · poste 1980 · v2 2080 ·
ekiben 2230 · prédio onigiri 2560 · v1 2880 · outdoor 3140. Bandeiras (m_c) espalhadas. Fim da rua VB+3370.
Enfeites de ilha (boneco de neve, onsen, shisas, palmeira, mochi, dango, pinheiro) usam v1..v4 e o torii.

## Tela e controles
Chip rosa no topo, junto dos chips de Ilhas/Fábrica. Câmera da vila: centro `VB+1040`, zoom 0,56.

## Funções mexidas fora do game-world.js (pro programador revisar)
- `game/game.js`
  - `PARK` virou função (`Wd.layout(S).park[id]`); `rebuildFleet`, `fleetWork`, `fleetTick` usam ela.
  - `fleetWork`: fila na frente de lavra pela largura real e atrás da máquina do Kome; se a máquina não alcança o
    barranco, `biteX = 0` (a renda cai no caminho padrão do `autoTick`, igual ao modo FAST).
  - `fleetTick`: com Caminhão ou Bagger na frente as pequenas ficam na vaga (uma máquina só no barranco); a renda delas
    não muda (autoTick).
  - `collectorTick`: usa `X.keiMin`; coletor "barraca" vira "kei" quando a barraquinha já está na vila.
  - `vila`/`vilaGo` (novos) + bloco no `camTick`; limite esquerdo da câmera = `Wd.X.minX` (-5000); `update` não cava com
    `vila.k > 0`; `readPointer` volta da vila no toque; `buyNode`/`buyHouse` chamam `vilaGo`; `credit` sobe o "+¥" de
    borda quando se olha a vila; `IND_CTX` passa `fabX = X.fabPorta` e `noA`; chip criado no `boot`; ganchos
    `__kome.vila(on, x, z)`, `__kome.vilaK()`, `G.Game.vila`.
- `game/industry.js`: `level()` (novo, exportado) decide se o galpão existe; `drawFront` desenha na vaga `X.fab` em
  escala 3 (antes AX=-520, escala 4).
- `game/belts.js`: esteira 1 some com a Bagger (`ctx.noA`); esteira 2 termina na ponta do galpão (curta, reta).
- `game/scenery.js`: `YARD` usa as vagas `X.v1..v4` da vila; `legendStatue` usa `X.estatua`.
- Save e colunas da montanha: intocados. Balanço: intocado.

## Rodada 3, item 4 (pontos fracos): funções mexidas
- `game/game-world.js` `layout(S)`: ordem nova (estacionamento primeiro, depois silo, galpão, beco, Oficina); assinatura do
  layout inclui quantas vagas existem; `X.beco` novo; `drawYard` desenha a pista do beco; `X.minX` -5000 -> -5600.
- `game/industry.js` `working()`: o kei-truck do galpão anda só 84 (antes 230) e entra no beco entre o galpão e a Oficina
  (encolhe, sobe e some pro fundo). Não passa mais na frente de porta nenhuma.
- `game/game.js`
  - `camTick` (bloco da vila): arco calculado pelo pico atual (`heap.peak().h`): o centro da câmera passa acima do pico
    + 8% da tela, zoom abre até `H / (pico*1,5 + 500)`, subida rápida e topo chato, smootherstep, mesmos 1,5 s.
    `vilaGo` continua sem voar no modo FAST (conserto do programador mantido).
  - `fleetWork(f, i, dt, solo)` + `giantFront()` + `drawBench()` (novos) e `fleetTick`: com Caminhão/Bagger na frente as
    pequenas com piloto sobem a encosta e cavam numa bancada de madeira (tablado nivelado com pernas), cada uma no seu x.
    A renda é a mesma do `autoTick` (só muda ONDE cava: `f.biteX` na bancada). No modo FAST nada disso roda (ficam na vaga,
    renda pelo autoTick, igual antes). Montanha acabando (sem encosta de 40 de altura): voltam pra vaga.

## Ficou de fora (corte de escopo)
- Fundo industrial do lado da cava (chaminés, guindastes, tanques): o fundo ainda é a cidadezinha fofa nos dois lados.
- Bagger Gêmea continua do outro lado da montanha (entre a montanha e a vila, sem encostar na vila).
- Cena de fim de dia: continua a tela própria com a casa (não usa a câmera da vila).
- Lojas do modo infinito (D.SHOPS) ainda não viram prédios na rua da vila.
- A frente de lavra anda pra direita conforme cava e o pátio não acompanha: no fim de cada era a frota volta a ficar longe.
- Indo e voltando da bancada as pequenas passam por cima do desenho da gigante (faixa da frente) e sobem a encosta sem inclinar.
- Vila aparecendo por cima da montanha cavada: não tratado.

## Perguntas do programador
