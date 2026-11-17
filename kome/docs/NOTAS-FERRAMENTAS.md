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

## trembala.js — trembala (Trem-Bala de Arroz, máquina absurda nº 17)
- `G.Tools.trembala`: interface comum + `bites(m)`, `dig(m, heap, area)`, `horizon(g, o)`, `prebake(nível)`, `profile(mode, t)`.
  meta `{zoom:.2, shake:.6, cycle:20, length:≈4040, height:540, wireY:-486, railY:-16, chutes:8, cars:10, chegadaT:11.6, platform, times}`.
  Demo: `demos/trembala.html?mode=normal|chegada&z=&face=-1&night=1&t=&spd=&dig=0&debug=1&horizon=1&n=30&cam=cockpit`.
- Não cava: encosta na estação no pé da montanha, 8 calhas descem da encosta e enchem os 8 vagões ao mesmo tempo, sai com estrondo e
  volta pelo OUTRO lado (deu a volta no Japão). Cabeça = shiba laranja com olho-farol e orelhas no teto; cauda = shiba preto;
  vagões alternam tanque-onigiri (boca-escotilha mostra o nível) e tremonha aberta (monte de arroz). Kome de quepe na cabine.
- Espaço do modelo: origem no chão sob a PONTA DO NARIZ com o trem parado (a doca); +x = sentido da partida (`inp.face`).
  A máquina é dona da doca: `m.x` pega `inp.x` só no 1º update (escrever `m.x` pra mudar a estação). `m.y = inp.y`.
  Plataforma em primeiro plano de dx −300 (à frente do nariz) a +1560 (pra trás), topo em y −30, com 5 shibas de 44 px.
- `inp.floor(x)` = y de mundo da superfície da montanha (o mesmo do Kome-Oh). Calha com montanha ≥150 px acima da boca do vagão
  vira tomada na encosta (mordida ativa); sem montanha, aparece uma torre-funil de carga (sem mordida, o vagão enche igual).
- Montanha: o heap é mapa de alturas, então "perder uma faixa no pé" = cada calha tira do TOPO das colunas no x dela
  (`G.Tools.trembala.dig(m, heap, areaDoQuadro)` reparte `heap.dig(x, area/ativas, 70)` entre as calhas ativas). Ao longo das
  voltas a encosta baixa por igual em ~4.000 px (o comprimento do trem). Na demo: 1.400 px²/s por calha.
- Ciclo (20 s / speedMul): 0 'arrive' · 0.8 'load' (bites ativos até 9.0) · 9.0 'full' · 9.4 'whistle' · 10.0 'depart' (`m.payload`
  = enchimento) · 11.6 'boom' (`m.flash`, `m.shakeK`, `m.speed {on,dir,k}` pra ScreenFX; chapéus voam) · 16.4 'return' (PAGAR AQUI
  com `m.payload`) · 17.4 'brake' · 20 'arrive'. Também 'clank', 'spark' (≤2/s). `inp.digging === false` segura a CARGA parada
  (o resto do ciclo termina sozinho; não dá pra parar o trem no meio da volta ao Japão).
- Modo `create({mode:'chegada'})` (11.6 s, cena de estreia quando destrava): shibas assentam trilho e postes com o trem colado atrás
  buzinando ('horn' 1.2/2.4), encosta ('arrive' 4.0), chefe corta a fita com tesoura gigante ('ribbon' 5.0, confete, título
  `m.title`), 'whistle' 5.8, 'depart' 6.2, 'boom' 7.8, 'return' 8.6, e em 11.6 'arrive' + 'ready' e vira 'normal' (ct = 0).
  `m.cam {x,y,z}` sugere a câmera (segue a obra, fecha na fita, abre pra 0.2 no estrondo).
- Ler: `m.phase` ('abrindo','carregando','fechando','partindo','fora','voltando','chegada'), `m.s`, `m.v`, `m.fill`, `m.lap`
  (tempo da volta, o painel mostra "VOLTA: 4,8 s · RECORDE PESSOAL!").
- Âncoras: `bites(m)` (8 × {x,y,r:70,active}), `bite(m)` = calha do meio (ou 1ª ativa), `dump(m)` = boca do vagão do meio,
  `seat(m)` = cabine.
- Horizonte do Pátio: `horizon(g, {x0,x1,y,k=.12,t,n,tint,haze,night})` desenha viaduto(s) com bocas de túnel e o trem pequenininho
  fazendo o ciclo inteiro (encosta, enche, BUUUM com anel, volta). n≥10: 2 viadutos; n≥25: 3; n≥50: 2 trens por viaduto.
  JÁ LIGADO em `patio-arte.js` (`PA.ABSURD`, camada do meio do horizonte) quando `S.patio.trembala.n > 0`; teste
  `?dev&patio=caminhao:12,bagger:3,trembala:30` (ids das outras absurdas em PA.ABSURD são palpite: acertar com o data.js).
- Custo (canvas de CPU, zoom 0.2, com efeitos): 0,3–0,7 ms por draw (dpr 1 e 2), igual ao Tatuzão. Carrocerias, trilho, poste e
  plataforma pré-renderizados em 4 níveis; `prebake()` evita o engasgo do 1º quadro (≈20 canvases por nível).
- Pontos fracos: é vista lateral pura (calhas "atravessam" o fio da catenária); a mordida baixa o topo das colunas, não o pé
  literal; chapéus/shibas da plataforma viram pontinhos em 0.2; sem som (só eventos); escala fixa 1 (sem opts.scale).

## foguete.js — foguete (Foguete de Mochi, máquina absurda nº 18)
- `G.Tools.foguete`: interface comum + `bites(m)`, `dig(m, heap, area)`, `horizon(g, o)`, `prebake(nível)`.
  meta `{zoom:.24, shake:.7, cycle:25, height:1600, chegadaT:11, reach:[1150,1400,1650,1900], times}`.
  Demo: `demos/foguete.html?mode=normal|chegada&z=&face=-1&night=1&t=&spd=&dig=0&debug=1&horizon=1&n=30`.
- Foguete de dango (bolas verde/branca/rosa num espeto) numa base no pé da montanha; torre com braço telescópico faz 4 conchadas
  na encosta (dx 1.150–1.900) e despeja no tanque; contagem 3-2-1, decola com chama e fumaça, some; caixote de ienes desce de
  paraquedas atrás da base enquanto o próximo foguete sobe do silo. Kome na escotilha da bola branca.
- Modelo: origem no chão no centro da base, +x = montanha (`inp.face`); `m.x` pega `inp.x` só no 1º update. `inp.floor(x)` = y da
  superfície (sem floor, encosta suposta em −600; conchada sem montanha não morde).
- Ciclo (25 s): 'bite' ×4 (pegar com `dig(m, heap, area)`, r 120) e 'load' ×4 · 12 'full' · 13/14/15 'count' (`m.count`) ·
  16 'launch' (`m.payload`, `m.flash`, `m.shakeK`) · 18.5 'gone' · 20.5 'rise' · 23 'land' = PAGAR AQUI. `digging === false` pausa
  só a carga. Chegada (11 s): laje cai 'build', torre cresce, 'rise', título, contagem, 'launch' 9.6, 'ready' 11 → normal no voo.
- Âncoras: `bite/bites` (conchada atual), `dump` = escotilha do tanque, `seat` = escotilha do Kome. Horizonte: base(s) no 1º quinto
  da faixa, foguete sobe com rastro e paraquedas desce (n≥10: 2 bases, n≥25: 3).
- data.js (série da camada-cookie.md, ×6,5 custo / ×4,3 renda por degrau): custo base 6,6e14, rende 2,9e10/s; nó Absurdo 500 sementes.

## fuji.js — fuji (Escavadeira do Monte Fuji, máquina absurda nº 19)
- `G.Tools.fuji`: interface comum + `bites`, `dig`, `horizon`, `prebake`. PRECISA de `game/machines-mid.js` antes (cria uma
  `G.Tools.escav` interna, `m.ex`, e desenha com escala 9). meta `{zoom:.13, shake:.8, cycle:5, scale:9, reach:[864,2700], chegadaT:9}`.
  Demo: `demos/fuji.html?mode=normal|chegada&...` (mesmos parâmetros).
- Por cima da escav: neve na lança e no teto, nuvens passando na altura da cabine, passarinhos, plaquinha "KOME" piscando.
  A escav interna recebe alvo na encosta à frente (dx ≈ 2.100, y = floor clampado) e roda a 0,4× (≈5 s por caçamba).
- Eventos: 'bite' (caçamba bate: PEGAR, r ≈ 306, `m.shakeK`), 'scoop', 'swing', 'dump' (despeja ATRÁS, `dump(m)` ≈ dx −1.500;
  pagar aqui se o jogo paga por caçamba). Chegada (9 s): sobe de baixo do horizonte ('rise'), nuvens se abrem 'part' 2.4, 'roar' 4.4,
  título, cava a partir de 6, 'ready' 9. `m.x` segue `inp.x` todo quadro.
- Horizonte: silhueta animada de 1–2 escavs (instâncias próprias num canvas 460×300 tingido) no meio da faixa + nuvenzinha.
- data.js: custo base 4,3e15, rende 1,3e11/s; nó Absurdo 1.200 sementes.

## portal.js — portal (Portal Onigiri, máquina absurda nº 20)
- `G.Tools.portal`: interface comum + `bites`, `dig`, `horizon`, `prebake`. meta `{zoom:.2, shake:.5, cycle:12, chegadaT:8, twinDx:-1500,
  bites:[1300,1600,1900], times}`. Demo: `demos/portal.html?...`.
- Anel-onigiri (~1.300 px, borda de arroz, nori embaixo) com vórtice girando; chupa 3 rios de grãos da encosta (3 bites ativos ao
  mesmo tempo, `dig` reparte a área) e o portal gêmeo em dx −1.500 cospe onigiris dourados (`dump`). Kome sentado no topo (44 px).
- Ciclo (12 s): 0 'open' · 0.8 'suck' (bites até 8) · 8 'full' (fica dourado) · 9 'spit' = PAGAR AQUI (`m.payload`) · cospe até 11.
  `digging === false` deixa o vórtice em marcha lenta. Chegada (8 s): 24 onigiris voam e montam o anel ('clink'), 'ignite' 3.5,
  título, 'twin' 5, 'ready' 8.
- Horizonte: 1–3 aneizinhos no fim da faixa com vórtice e fio de grãos.
- data.js: custo base 2,8e16, rende 5,4e11/s; nó Absurdo 3.000 sementes.
- As três: ids `foguete`/`fuji`/`portal` já estão em `PA.ABSURD` (patio-arte.js chama `horizon` quando `S.patio[id].n > 0`; cada
  uma se põe num pedaço diferente da faixa). Teste: `?dev&patio=trembala:30,foguete:12,fuji:3,portal:30`.
