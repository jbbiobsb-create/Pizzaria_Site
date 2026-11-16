# Tatuzão, KOME-OH e robozinhos — arquivos novos

Copie a pasta `kome/` deste zip por cima da sua (só ACRESCENTA arquivos, não substitui nada existente).

| Arquivo | O que é | Depende de |
|---|---|---|
| game/tbm.js | Tatuzão (máquina de túnel), `G.Tools.tbm` | engine (core, pix, shiba, fx, terrain, rig); usa `G.Scale.pickup` de machines-mine.js se existir |
| game/komeoh.js | KOME-OH (robô gigante feito das máquinas), `G.Tools.komeoh` | engine + machines-mid.js, machines-mine.js, bagger.js e tbm.js (carregar ANTES dele) |
| game/swarm.js | enxame de robozinhos, `KomeGame.Swarm` | engine (core, pix, terrain, fx) |
| demos/*.html | uma demo de cada (abrem com `../engine/` e `../game/`) | |

Ordem de carga no index.html: engine → tools-hand.js, machines-mid.js, machines-mine.js, bagger.js → **tbm.js → komeoh.js → swarm.js** → jogo.
Desenho: montanha → `G.Tools.tbm.drawTunnel(g,m)` → máquinas → `sw.draw(g,view,zoom)` antes do coletor.

Nenhum arquivo do jogo foi alterado: falta ligar os três no data.js/game.js (adendo §10–12 do GDD).

## tbm.js — tbm (Tatuzão)
- `G.Tools.tbm` (kind 'tbm', 1240x300): mesma interface + `drawTunnel(g,m)`. Carregar depois de core/pix/shiba/fx/terrain/rig (machines-mine.js opcional: pickup no transporte).
  meta `{zoom:.3, shake:.35, cycle:4, ringW:36, radius:148, shieldLen:300, trainLen:~1076, axisY:-146, railY:-22}`. Demo: `demos/tbm.html` (?mode=transport&z=&face=&night=&cx=).
- Espaço do modelo: origem no chão sob o plano da face do escudo; escudo Ø288 (centro a 146 acima de inp.y), corpo até x=-300,
  trem de apoio (4 pórticos, cabine com o piloto no 1º) até x≈-1100. A base do escudo fica em inp.y (piso do túnel); trilhos do trem a 22 acima.
- Posição: a máquina é dona de `m.x` (= plano da face, mundo): pega inp.x só no 1º update e avança em direção a `inp.tx` (só pra frente)
  exatamente um anel (36 px) por ciclo enquanto `inp.digging`. Sem inp.tx: escava sem parar. Pra teleportar, escrever m.x (e m.ringW).
- Ciclo 4 s / rate (power, speedMul, boost): 0–.55 avança com os pistões esticando; .55–.66 recolhem; .62–.90 eretor gira um segmento ('ring' em .90);
  .92–1 pistões encostam no anel novo. Cabeça gira com `m.rpm` (sobe com digging, 25% durante a montagem do anel).
- Eventos: 'rev' (começou a cavar), 'push' (início do avanço), 'grind' (4/s avançando: limitar o som), 'ring' (anel montado, clunk), 'done' (chegou em inp.tx; no transporte, parou).
- Âncoras: `bite(m)` = centro da cabeça `{x,y,r:148,active (só avançando),phase}` (só pra contabilizar volume: o heightfield não guarda túnel);
  `dump(m)` = ponta traseira da esteira de material (ativa com `m.flow`>.3; null no transporte); `seat(m)` = cabine.
- Ler: `m.bored` (px escavados desde a boca), `m.tunnel = {x0,x1,y,r}` (x0 = boca, padrão = x do 1º update; o jogo pode escrever), `m.rings`, `m.pushing`, `m.done`, `m.flow`.
- `drawTunnel(g,m)`: chamar depois da montanha e antes de `draw`. Desenha a plataforma de lançamento com trilhos (1000 px atrás da boca), o muro de emboque
  na boca, a cavidade escura em volta da cabeça e o túnel (revestimento cortado, anéis com juntas, duto de ventilação amarelo, cabo, luminárias, trilhos).
  A montanha precisa ter pelo menos ~320 px de altura sobre o túnel pra não "vazar" o tubo no céu.
- Modos (`create({mode})` ou `m.mode`): 'bore' (padrão) e 'transport' (chegada/compra: escudo e trem sobre carretas SPMT laranja, cabeça mais de frente (elipse .7),
  pessoal de capacete laranja/amarelo andando ao lado, pickup na frente; rola a 8 px/s até inp.tx enquanto digging). 'launch' não foi feito (cai no 'bore').
- Noite (`inp.night`): luminárias do túnel, luzes dos pórticos, farol do escudo e vidro da cabine acendem. Texto da placa KOME-TBM nunca espelha.
- Custo (Chromium headless, software): ~0,3–0,4 ms de chamadas por draw; com rasterização ~1,9 ms (máquina + túnel) em zoom .3 dpr 2; ~8 ms em zoom 1 dpr 2
  (tela cheia de imagem). Escudo, trem, SPMT e a face da cabeça são pré-renderizados em 4 níveis (0.4/0.8/1.6/2.4 px por unidade; engasgo único no 1º uso de cada nível).
- Pontos fracos: vista lateral com "3/4 falso" só na face, no eretor e nas juntas; equipe minúscula e repetitiva; a face não tem relevo real (sombra fixa por cima da imagem girando).

## swarm.js — enxame de robozinhos
- Arquivo `game/swarm.js` (registra `KomeGame.Swarm`); demo `demos/swarm.html` (`?n=&z=&cx=&full=1&carry=&spd=&t=`, teclas 1/2/3 = +10/+25/+50,
  `-` = -10, F = cheio, C = grãos por robô; `__demo.step(seg)`, `__demo.perf(frames)`). Print: `docs/prints/robozinhos.png`.
  Depende de core.js e pix.js; usa E.Heap e E.Particles se receber.
- `sw = Swarm.create({count, to:{x,y}, heap, parts, from?, floor?, seed, speed=58, carryPerBot=1, biteArea=1.6, spacing=16, dock=20, climb=22, max=1024})`.
  `from` = `{x}` ou `fn(heap)->x`; sem `from`, procura sozinho o ponto do talude (a partir do coletor) onde a altura passa de `climb`
  (refeito a cada 0,25 s: acompanha a frente de corte). `to` = coletor; os robôs encostam a `dock` px dele. Com `count` no create os
  robôs já nascem espalhados pela rota (`scatter:false` desliga; `sw.scatter()` refaz, útil ao carregar save).
- Laço: `sw.update(dt, {heap, floor, from, to, speedMul, cap})` (cap opcional = espaço livre no coletor; `<= 0` age como `full`) e
  `sw.draw(g, view, zoom)` no espaço de mundo, DEPOIS da montanha e ANTES do coletor (os novos saem de trás dele).
- Integração no jogo: `sw.onDeliver((amt, x, y) => pay(amt * valorDoGrão, x, y, 1))`; a mordida já chama `heap.dig(x, biteArea*amt, 7, {pow:20})`
  (passe `biteArea = 0` e use `sw.onTake(fn(amt,x,y))` se o jogo quiser cavar/contar por conta própria). `sw.full = S.col cheio` → dança.
  Compra de lote: `sw.setCount(sw.count + 25)`; upgrade de carga: `sw.carryPerBot = 2|3` (a pazinha mostra 1/2/3 grãos); velocidade:
  `sw.speed` ou `speedMul`. Som: `sw.ev` traz no máximo 1 de cada por frame ('take', 'deliver', 'beep', 'dance'); 'beep' já tem cooldown 0,35 s.
- Comportamento: pista de volta (vazios, 4 px atrás) e pista de ida (carregados, 2 px à frente); fila com espaçamento que aperta quando
  há robôs demais (`occupancy` 0,62 das duas pistas; abaixo de 14 px vira fila dupla em zigue-zague); mordem em paralelo numa zona no
  pé do talude e entregam em paralelo numa zona no coletor; quem não cabe espera na "garagem" escondida atrás do coletor (u < 0).
  Personalidade: trombada com bamboleio (cooldown global 0,7 s), giro feliz ocasional, quique leve andando, inclinam na encosta.
- Arte: 6 variantes de faixa (vermelho, azul, verde, laranja, sakura, amarelo; orelhas fur/goma/creme), sprite Pix 22x16 com contorno
  LINE, quadros: roda (3) × luz (2) × grãos (0..3) × espelho (2), cacheados sob demanda num array. `Swarm.sprite(v, grãos, luz, roda, flip)`.
- Custo (Chromium headless, software, 250 robôs): update 0,02 ms; draw 0,09 ms em zoom 0,3 (pontinhos: 1 path por cor, ~10 fills no total)
  e ~2,5 ms em zoom 1 (≈190 drawImage visíveis). Sem alocação por frame (struct-of-arrays, ordem por inserção; só 1 getTransform por draw).
- Pontos fracos: rota curta + muitos robôs = fila apertada/garagem cheia (vazão limitada pelas zonas das pontas, ~2,7 entregas/s com 60
  robôs numa rota de 470 px); diminuir a frota é lento (os aposentados terminam a viagem e esperam vaga na pista de ida); o grão na pazinha
  é miúdo em zoom < 1,5; robôs só andam em x (não sobem fundo de cratera nem desviam de máquinas); dança em sincronia passa por largura 0.

## komeoh.js — komeoh (KOME-OH)
- Carga: depois de core, pix, shiba, fx, terrain, rig e das máquinas (machines-mid, machines-mine, bagger, tbm). Cada máquina que
  faltar vira peça genérica (detecção na hora, nunca quebra). Demo: `demos/komeoh.html?mode=idle|walk|dig|rocket|combine|tour&z=&face=&t=&night=1&cam=combine`.
- `G.Tools.komeoh`, kind 'mecha', meta `{zoom:.22, shake:1, cycle, combineT:8, height:1040, walk:92, reach:430, steps}`. Interface comum +
  `glow(g,m)` (halos aditivos; draw() já chama, repetir depois de um filtro de noite) e `prebake(nível 0|1|2)` (evita o engasgo do 1º quadro).
- Peças: pés/botas = trator (frente) e empilhadeira (trás, de pé sobre as rodas); tronco = caminhão; peito = roda da Bagger girando;
  braço esquerdo = lança/braço/caçamba da escavadeira (garra) + casa dela de ombreira; braço direito = lança e caçamba da pá de cabo +
  casa dela de ombreira; punho = disco do tatuzão + ponta cônica; cabeça de shiba de metal com o Kome na cabine da testa e o kasa de capacete.
  As máquinas são desenhadas UMA vez por nível de zoom em canvas fora da tela (instâncias próprias; roda da Bagger e disco do tatuzão
  capturados pelo drawImage que elas fazem). Texto do caminhão tem variante pré-espelhada (face -1 continua legível).
- Espaço do modelo: origem no chão sob a bacia, +x frente. A máquina é dona de `m.x`: pega `inp.x` no 1º update (ou `create({x})`),
  depois ANDA até `inp.x` (passos com IK, pés em `inp.floor(x)`, sobe a encosta). Sem `inp.x` e com alvo, se aproxima sozinha até ~430 do alvo.
- Golpes: `inp.digging` + `inp.tx/ty` alterna garra (crava, arrasta cavando, joga o arroz por cima do ombro até `inp.dumpX`, padrão 700
  atrás) e soco-broca. `inp.boost >= 1` na SUBIDA dispara o soco foguete (carga 0,62 s, voo ~1700 px/s, fura 1,1 s, volta; cooldown 0,8 s).
- Âncoras: `bite(m)` = `{x,y,r,active,phase,kind,deep}` na ponta de verdade (garra/broca r=120; foguete r=190, `deep` até 150 px ao
  longo do voo): usar `heap.digCircle(b.x,b.y,b.r, ...)` enquanto `active`. `dump(m)` = `{x,y,active,tx}` (heap.add em `tx` enquanto ativo).
  `seat(m)` = cabine na testa.
- Eventos: stomp, punch, drill, rocket, return (punho encaixou), roar, toss, lock (peça encaixou na combinação), combined.
  `m.shakeK` (0..1, decai) é uma sugestão de tremor; `m.speed {on,x,y,dir}` liga as linhas de velocidade da ScreenFX durante o voo.
- Combinação: `create({mode:'combine'})` toca 8 s sozinha (passos ceu, pernas, nucleo, tronco, bracos, peito, punho, cabeca, pose);
  ler `m.combine {phase, step, fx, fy, zoom}` pra câmera (close nos encaixes), `m.dark` (0..1) pra escurecer o céu, `m.flash`. No fim
  emite 'combined', `m.mode` vira 'normal' e o título "KOME-OH!" (Draw.text, nunca espelhado) e os raios coloridos somem em ~1,5 s.
- Custo (Chromium headless, rasterização por software, `__demo.bench`): zoom .22 dpr 1: 1,4 ms parado, 2,0 cavando, 1,5 foguete,
  2,5 na pose final (raios); dpr 2: 3,1–3,4 ms. 1º quadro de cada nível assa as peças (dezenas de ms; usar prebake).
- Pontos fracos: vista lateral "de papel" (sem giro 3D); peças da pá de cabo são recortes da máquina inteira (sobra um pedacinho de
  cabo/sela nas bordas); punho voando passa por cima do corpo; as caçambas das botas não giram as rodas ao andar (sprite fixo);
  pés podem atravessar um degrau muito íngreme da montanha (o passo só olha o chão no destino).
