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
