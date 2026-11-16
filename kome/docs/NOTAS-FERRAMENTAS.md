# Notas pro programador do jogo: ferramentas (G.Tools)

Ordem de carga: core, pix, shiba, fx, terrain, rig, depois game/tools-hand.js e game/machines-mid.js.
Interface comum: `G.Tools[id] = {id,name,kind,w,h,meta:{zoom,shake,cycle},create(opts),update(m,dt,inp),draw(g,m),bite(m),dump(m),seat(m)}`, `m.ev` = eventos do frame.

## tools-hand.js — pata, hashi, tigela, pa, duaspas, carrinho, britadeira
- Espaço do modelo: origem em inp.x,inp.y; +x pra frente; espelhado por inp.face. inp.tx/ty são ignorados.
- Partículas vão pra inp.parts em coords de mundo: desenhar DEPOIS de tool.draw.
- Eventos: hit (pata, pá, duas pás, carrinho), tic (hashi), scoop/toss (tigela; pá também toss), spin (duas pás, a cada 8 golpes),
  dump/squeak (carrinho), tat (britadeira, ~15/s).
- Momento de pagar: toss (tigela, pá), hit (duas pás), dump (carrinho).
- Estado só leitura: m.ph, m.busy, m.load, m.off (avanço do carrinho), m.n, m.hits (duas pás).
- dump(m) é null pra pata e britadeira. bite(m).r é raio VISUAL (~6/8/11/15/19/22/10 × escala), não o r do GDD.
- Britadeira: bite fica na ponteira (~8 px à frente de inp.x) e traz w=14·sc, h=40·sc pra poço estreito e fundo (usar heap.digRect).
  O compressor segue no mundo: atrasa e quica; dá um salto se o Kome teleportar mais de 90 px.
- Ferramentas de ciclo (hashi, tigela, pá, duas pás, carrinho) terminam o ciclo iniciado depois de soltar; pata e britadeira param na hora.
- G.Props: sack('plain'|'golden'|'legendary'), onigiri(), coin(), crate(), pallet(), sold(), hardhat() -> {cv,ax,ay}; icon(id) -> canvas 16x16 (13 ids em Props.ids).
- Pontos fracos conhecidos: carrinho despeja pra frente; tigela/pá trocam de pose no meio do giro (falta pose em pé com dois braços no shiba.js);
  Kome rotacionado fica serrilhado; rachaduras da britadeira antes do bloco soltar não foram feitas; sem som.

## machines-mid.js — trator, empilhadeira, escav
- Ver o comentário no topo do arquivo: m.off, m.ph, m.busy, m.load, m.power.

## bagger.js — bagger (Bagger 293)
- `G.Tools.bagger`: mesma interface + `glow(g,m)`. meta `{zoom:.26, shake:1, boom:560, wheelR:134, pivot:[60,-340], luffMin, luffMax, maxCrawl:40}`.
  Mastros ~725 px de altura; máquina ocupa x ≈ −776..+700 no espaço do modelo (origem no chão sob o eixo de giro, +x = lado da roda).
- Posição: a máquina é dona de `m.x` (pega inp.x só no 1º update e depois rasteja até `inp.tx` a no máx 40 px/s; se inp.tx for null segue inp.x).
  `m.y = inp.y`. Pra teleportar, escrever `m.x`.
- Controles: `inp.tx` = x de mundo que o centro da roda deve alcançar; `inp.ty` = y de mundo do centro da roda (vira ângulo da lança,
  −18°..+32°, mola pesada); `inp.digging` gira a roda (0→100% em 2 s); `inp.horn` buzina; `inp.night` 0..1; `inp.zoom` = zoom da câmera.
- O jogo pode escrever: `m.bite01` (0..1 fração enterrada, null esconde o medidor), `m.band` (faixa perfeita, padrão [0.4,0.7]),
  `m.stage` (1,2,3: montagem em 3 partes; `create({stage})`), `m.deferGlow` (se escurecer a cena com overlay, chamar `glow(g,m)` depois).
- Ler: `m.luff, m.rpm, m.vx, m.fill, m.flow, m.perfect, m.stalled`. Acima de 0.85 de mordida a roda cai pra 30% e emite 'stall'.
- Eventos: 'rev' (começou), 'clank' (~6/s mordendo: limitar o som), 'horn', 'stall'.
- Âncoras (mundo): `bite(m)` = centro da roda `{x,y,r:134,active,phase}` (usar com heap.digCircle e heap.bite);
  `dump(m)` = ponta da esteira de descarga; `seat(m)` = cabine.
- Custo: 0,9 ms (dpr 1) a 2,9 ms (dpr 2, pior caso) por draw em zoom 0.26. Conjuntos estáticos pré-renderizados em 3 níveis (engasgo único na 1ª vez de cada).
- Pontos fracos: treliça mais clara que a real (ajustar C_LAT/C_WEB no topo); vista lateral pura; Kome é um pontinho em zoom 0.26;
  ponte e unidade de carga rígidas com o corpo; face +1 pouco testada depois do último ajuste.

## machines-mine.js — pacabo, caminhao (+ G.Scale.pickup/keitruck/moega)
- `pacabo` (kind rope, 700x470, ciclo 3,6 s): fases 0.10–0.38 morde, 0.41–0.60 gira, 0.62 abre a porta (dump ativo enquanto derrama),
  0.76–0.98 volta. Eventos: hit, scoop, rev, dump, clank. bite = dentes, r=56, varre de ~(280,−7) a (480,−180) no modelo:
  estacionar com a face ~262 à frente do centro (`meta.reach`=280). `m.load` 0..1. `meta.dumpAt={x:-160,y:-293}`.
- `caminhao` (kind haul, 352x202, pneus 100): `m.state` idle→load→haul→dump→back. Entra em load com inp.digging e inp.tx do lado da
  montanha; parte ao soltar ou ao apontar pra trás. ¥ no evento 'dump'; ler `m.payload` (0..1.15) e `m.crowned` (definidos em 'depart').
  Eventos: load, full, spill, depart, rev, raise, dump, empty, back, clank, arrive. `m.off` = deslocamento próprio (x de mundo =
  inp.x + face·off·scale). Distância: `inp.dumpX` se dado, senão inp.tx se >220 atrás, senão 430 (`meta.haul`).
  `m.wantsLoad`, `m.bedO={x,y,w}` (boca da caçamba, mundo).
- Par pá+caminhão: `G.Tools.caminhao.parkX(shovelX, shovelFace, shovelScale, truckScale)` dá o x do caminhão; desenhar o caminhão
  DEPOIS da pá. Passar `inp.loader=true` pro caminhão e chamar `G.Tools.caminhao.fill(m, frac)` enquanto `pacabo.dump(m).active`
  (0.34 por passada → 3 passadas = 105%).
- `G.Scale.pickup` (128x46), `.keitruck` (82x44), `.moega` (300x160, aceita `fill`): `draw(g,x,y,{face,t,pal})`. `opts.showScale` estaciona uma pick-up.
- Pontos fracos: giro da pá é fingido (em quadro parado a lança vira uma linha vertical); jato de carga do caminhão sozinho é provisório.

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
