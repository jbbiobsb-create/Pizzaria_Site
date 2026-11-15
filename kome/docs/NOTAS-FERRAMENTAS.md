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
