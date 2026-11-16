# Pixxel

Engine 2D de navegador no estilo Kome: canvas + HUD em DOM, scripts clássicos, zero dependências, roda de `file://`.
Gerado por `node tools/docs.js` a partir dos comentários do código (não edite à mão: edite o código e rode de novo).

## Começar um projeto novo

```html
<link rel="stylesheet" href="pixxel.css">   <!-- só se usar E.UI -->
<script src="pixxel.js"></script>           <!-- gere com: node tools/build.js -->
<script>
  const E = Pixxel, stage = E.Stage({ width: 960, height: 540 }), input = E.Input(stage), g = stage.g;
  let t = 0;
  E.Loop({ input, update(dt) { t += dt; }, render() { stage.begin(); E.drawShiba(g, 480, 400, 'wag', t, { scale: 3 }); } }).start();
</script>
```

Exemplo completo e pequeno: `demos/koi.html` (lago de carpas usando só o bundle). Uma demo por módulo em `demos/`.

## Estilo (vale pra tudo que for desenhado)
- Contorno `#3B2818` (`E.PAL.line`), paleta `E.PAL`, 3 tons por material (sombra, base, luz).
- Personagens e objetos pequenos em pixel art (`E.Pix` / `E.sprite`); máquinas grandes vetoriais articuladas (`E.Draw` + `E.Rig`).
- Nada parado: use `E.Nature.wind(t, x)` e `t` pra balançar, piscar e respirar.
- Pedido tipo "um alce" / "um carro": monte com `E.Pix` (pequeno) ou `E.Draw`/`E.Rig` (grande), contorno e 3 tons, e
  uma demo em `demos/` verificada com `node tools/shot.js`.

## Ferramentas
- `node tools/build.js` — bundle `pixxel.js` + `pixxel.css`.
- `node tools/docs.js` — este arquivo.
- `node tools/shot.js <pagina.html> <saida.png> [--eval js] [--size 960x540]` — screenshot headless.

## Módulos

### core.js

Pixxel v1.0 — core.js Base de tudo: utilitários (U), RNG, ruído, eventos, pool, tweens, Stage (canvas escalável), Input (ponteiro + teclado), Loop, Scenes, Save e timers. Zero dependências. Script clássico: carregue ANTES de qualquer outro módulo.

- `lin(t)` — linear
- `in(t)` — cúbica acelerando
- `out(t)` — cúbica desacelerando (a do rascunho)
- `inOut(t)` — cúbica acelera e desacelera (a do rascunho)
- `back(t)` — passa do alvo e volta (a do rascunho)
- `backIn(t)` — recua antes de ir
- `backInOut(t)` — recua, vai e passa do alvo
- `elastic(t)` — mola que balança no fim
- `elasticIn(t)` — mola que balança no começo
- `bounce(t)` — quica no fim
- `bounceIn(t)` — quica no começo
- `quadIn(t) / quadOut(t) / quadInOut(t)` — quadráticas
- `expoIn(t) / expoOut(t)` — exponenciais
- `sine(t)` — senoidal suave (inOut); sineIn / sineOut
- `arc(t)` — 0 -> 1 -> 0 (pulo, pulso); não termina em 1
- `clamp(v,a,b)` — limita v ao intervalo [a,b]
- `lerp(a,b,t)` — interpolação linear
- `invLerp(a,b,v)` — onde v está entre a e b (0..1, sem limitar)
- `remap(v,a,b,c,d)` — leva v de [a,b] para [c,d] (limitado)
- `smooth(t)` — smoothstep 0..1 (limitado)
- `damp(a,b,k,dt)` — aproxima a de b com suavização exponencial independente de fps
- `approach(a,b,step)` — anda de a até b no máximo 'step', sem passar
- `sign(v)` — -1, 0 ou 1
- `wrap(v,a,b)` — dá a volta em [a,b)
- `dist(x0,y0,x1,y1)` — distância entre dois pontos
- `angLerp(a,b,t)` — interpola ângulos pelo caminho mais curto (radianos)
- `rnd(a,b)` — float em [a,b); rnd() = [0,1); rnd(a) = [0,a)
- `irnd(a,b)` — inteiro em [a,b], inclusivo
- `pick(arr)` — elemento aleatório
- `chance(p)` — true com probabilidade p (0..1)
- `shuffle(arr)` — embaralha no lugar (Fisher-Yates) e devolve arr
- `fmtInt(n)` — inteiro com separador de milhar ('1.234.567')
- `fmt(n)` — número curto pt-BR: 1.234 / 12,3 mil / 4,56 mi / bi / tri / ... / deci; acima disso '1,23e36'
- `fmtTime(s)` — duração curta: '45s' / '3min 20s' / '1h 02min' / '2d 03h'
- `pct(f, casas=0)` — fração 0..1 -> '42%'
- `hex(h) -> [r,g,b,a255]` — aceita '#rgb', '#rrggbb', '#rrggbbaa', 'rgb(a)(...)' ou array (devolve cópia)
- `rgba(c,a) -> 'rgba(r,g,b,a)'` — cor (hex ou array) com alfa 0..1
- `css(c) -> string CSS` — string passa direto; [r,g,b,a] vira '#rrggbb' ou 'rgba(...)'
- `mix(a,b,t) -> [r,g,b,255]` — mistura duas cores (hex ou array)
- `mixCss(a,b,t) -> '#rrggbb' (com cache quando a e b são strings)`
- `shade(c,k) -> css` — k<0 escurece com marrom, k>0 clareia com creme (estilo Kome)
- `E.hash(n, m=0) -> 0..1` — hash determinístico de um número (inteiro ou fracionário); m é um segundo número opcional
- `E.RNG(seed) -> r()` — gerador mulberry32 determinístico; seed pode ser número ou string
- `r()` — float em [0,1)
- `r.range(a,b)` — float em [a,b)
- `r.int(a,b)` — inteiro em [a,b], inclusivo
- `r.pick(arr)` — elemento aleatório
- `r.chance(p)` — true com probabilidade p
- `r.sign()` — -1 ou 1
- `r.gauss()` — normal aproximada (média 0, desvio ~1)
- `r.shuffle(arr)` — embaralha no lugar
- `r.fork(n)` — novo RNG independente derivado de (seed, n); não consome o estado deste
- `r.reset()` — volta ao começo da sequência
- `n1(x, seed=0) -> 0..1` — ruído suave 1D
- `n2(x, y, seed=0) -> 0..1` — ruído suave 2D
- `fbm1(x, oct=4, seed=0) -> 0..1` — soma de oitavas 1D
- `fbm2(x, y, oct=4, seed=0) -> 0..1` — soma de oitavas 2D
- `E.Emitter() -> { on(ev,fn)->off, off(ev,fn), once(ev,fn)->off, emit(ev,a,b,c,d)->n, clear(ev?) }`
- `on(ev, fn) -> off()` — escuta um evento; devolve a função que cancela
- `off(ev, fn)` — para de escutar
- `once(ev, fn) -> off()` — escuta só a próxima emissão
- `emit(ev, a, b, c, d) -> quantos ouviram (até 4 argumentos, sem alocar)`
- `clear(ev?)` — remove os ouvintes de um evento, ou todos
- `E.Pool(make, reset) -> { get(...args), free(o), size (livres), made (criados), prealloc(n) }`
- `get(a,b,c)` — pega um objeto livre (ou cria) e chama reset(o,a,b,c)
- `free(o)` — devolve o objeto ao pool
- `prealloc(n)` — cria n objetos de antemão
- `cancel()` — para o tween onde está (não chama onDone)
- `finish()` — pula pro valor final e chama onDone
- `to(obj, {prop:valor}, dur, {ease, delay, onUpdate(obj,k), onDone(obj), repeat, yoyo}) -> handle{cancel(), finish(), done}`
- `wait(dur, fn) -> handle` — chama fn depois de dur segundos (no tempo do jogo)
- `update(dt)` — avança todos os tweens (o Loop chama sozinho)
- `killOf(obj)` — cancela todos os tweens de um objeto
- `clear()` — cancela tudo
- `E.every(sec, fn) -> { tick(dt), reset(), sec, t }` — chama fn a cada 'sec' segundos (recupera atrasos, até 1000 por tick)
- `E.cooldown(sec) -> { ready(), use()->bool, tick(dt), reset(), frac (0..1; 1 = pronto), sec, left }`
- `ready()` — pode usar?
- `use()` — se estiver pronto, começa a recarga e devolve true
- `tick(dt)` — avança a recarga
- `reset()` — fica pronto na hora
- `E.Stage({canvas|parent, width=960, height=540, fit='contain'|'cover'|'none', maxDpr=2, bg, pixelated=false, integer=false, maxScale, margin=0}) -> stage`
- `on('resize', fn(stage)) -> off`
- `toStage(evt|{clientX,clientY}, out?) -> {x,y}` — coordenadas do cliente -> coordenadas lógicas do stage
- `toClient(x, y) -> {x,y}` — coordenadas do stage -> coordenadas do cliente (pra posicionar DOM fora do stage)
- `resize()` — recalcula escala, posição e resolução (chamado sozinho em resize/rotação)
- `begin()` — setTransform(dpr) + limpa (com bg se houver); chamar no começo de cada render
- `layer(className?) -> div` — cria uma camada DOM do tamanho do stage por cima do canvas (escala junto)
- `destroy()` — remove ouvintes (o DOM fica)
- `E.Input(stage, {wheel=true, keys=true}) -> input`
- `on('down'|'up'|'move'|'tap'|'key'|'keyup'|'wheel', fn) -> off ; down/up/move/tap` — fn(x,y,evt) ; key: fn(code,evt)
- `keyPressed(code)` — a tecla foi apertada neste frame?
- `keyReleased(code)` — a tecla foi solta neste frame?
- `axis(neg, pos)` — -1/0/1 a partir de duas teclas (ex.: axis('KeyA','KeyD'))
- `endFrame()` — zera as flags de 1 frame (o Loop chama se receber {input})
- `reset()` — solta tudo (usado quando a janela perde o foco)
- `destroy()` — remove todos os ouvintes
- `E.Loop({update(dt), render(alpha, dt), fixed=0, maxDt=.05, input, maxSteps=5, tweens=true, onVisibility(hidden)}) -> loop`
- `start()` — começa (idempotente)
- `stop()` — para
- `step(dtReal)` — roda um frame na mão (testes, replays); respeita maxDt, timeScale e paused
- `E.Scenes.create() -> gerenciador de cenas independente (E.Scenes é o global)`
- `on('change', fn(nome, cena)) -> off`
- `add(nome, {enter(args), exit(), update(dt), render(g), pause(), resume()}) -> Scenes`
- `has(nome) -> bool`
- `go(nome, args)` — sai de todas as cenas da pilha e entra na nova
- `push(nome, args)` — empilha por cima (a de baixo recebe pause() e continua sendo desenhada)
- `pop()` — tira a do topo (exit) e volta pra de baixo (resume)
- `update(dt)` — atualiza só a cena do topo
- `render(g)` — desenha a pilha de baixo pra cima (cena com opaque:true esconde as de baixo)
- `depth() -> tamanho da pilha`
- `E.Save(key, {version=1, migrate(old, vAntiga)->novo, defaults(), beforeSave(data), autoSave=false}) -> save`
- `load() -> data` — lê, migra e completa com defaults; nunca lança
- `save() -> bool` — grava agora (data.__t = agora, data.__v = versão)
- `saveSoon(ms=1500)` — agenda um save; chamadas repetidas dentro da janela não adiam (no máx. 1 gravação por janela)
- `clear() -> data` — apaga o save (e o backup) e volta aos defaults
- `exportStr() -> string base64 do save atual (pra copiar/colar)`
- `importStr(s) -> bool` — troca o save pelo conteúdo da string (base64 ou JSON puro); false se inválida
- `offlineSeconds() -> segundos desde o último save/load (>= 0, mesmo se o relógio voltar)`

### pix.js

Pixxel v1.0 — pix.js O "estilo Kome" pra tudo que não é o cachorro: E.LINE / E.LINE_CSS   contorno marrom escuro oficial E.PAL                 paleta quente e limitada E.Pix                 construtor de pixel art (contorno 4-vizinhos igual ao do Kome) E.sprite              cache de sprites Pix E.drawSprite          desenha um canvas com âncora / rotação / escala / flip E.Draw                primitivas vetoriais no MUNDO (máquinas gigantes) com o mesmo contorno e as mesmas cores chapadas Depende de: core.js (E.U)

- `pack(c) -> uint32` — aceita hex ou [r,g,b,a]; null/alfa 0 -> 0 (vazio)
- `unpack(v) -> [r,g,b,a]`
- `mixPacked(v, alvo[r,g,b], t) -> uint32` — mistura mantendo o alfa
- `E.Pix(w,h) -> P` — tela de pixel art; todos os métodos de desenho são encadeáveis
- `P.set(x,y,c)` — pinta um pixel
- `P.get(x,y) -> [r,g,b,a] | null`
- `P.rect(x,y,w,h,c)` — retângulo cheio
- `P.rrect(x,y,w,h,r,c)` — retângulo com cantos arredondados de raio r
- `P.ell(cx,cy,rx,ry,c)` — elipse cheia
- `P.tri(ax,ay,bx,by,cx,cy,c)` — triângulo cheio
- `P.poly(pts,c)` — polígono cheio (côncavo ou convexo), pts = [[x,y],...]
- `P.line(x0,y0,x1,y1,wd,c)` — linha grossa de pontas redondas; wd < 1.5 = linha de 1px conectada do pixel (x0,y0) ao pixel (x1,y1)
- `P.ring(cx,cy,r,wd,c)` — anel de raio externo r e espessura wd
- `P.arc(cx,cy,r,a0,a1,wd,c)` — arco (radianos, sentido horário na tela) com espessura wd
- `P.erase(x,y,w,h)` — apaga um retângulo (volta a ser transparente)
- `P.dither(x,y,w,h,c,padrão='checker'|'25'|'75'|'hlines'|'vlines',{mask=false})` — retícula; mask = só onde já existe pixel
- `P.shadeBelow(c,k=.28,depth?)` — escurece a borda de baixo/direita das manchas de cor c (volume automático)
- `P.bevel(hi=.32,lo=.26)` — 1px de luz em cima/esquerda e sombra embaixo/direita por dentro da silhueta
- `P.replace(c1,c2)` — troca todos os pixels de cor c1 por c2 (c2 null apaga)
- `P.mask(fn(x,y,[r,g,b,a])->bool)` — mantém só os pixels em que fn devolve verdadeiro
- `P.mirrorX()` — espelha a tela inteira na horizontal
- `P.symX()` — copia a metade esquerda espelhada na direita (pra sprites simétricos)
- `P.stamp(outroP,x,y,{flip=false})` — carimba outro Pix (pixels vazios não cobrem)
- `P.clone() -> novo Pix com os mesmos pixels`
- `P.pad(n=1) -> NOVO Pix com n px de margem vazia em volta (pro contorno não ser cortado quando a arte encosta na borda)`
- `P.touchesEdge() -> bool` — tem pixel pintado encostado na borda? (o contorno seria cortado ali)
- `P.canvas(outline=true, lineColor=E.LINE) -> HTMLCanvasElement (contorno 4-vizinhos como o do Kome)`
- `E.Pix.outline(buf,w,h,c) -> novo buffer com contorno 4-vizinhos (aceita Uint32Array ou o array legado de cores)`
- `E.sprite(nome,w,h,fn(P),outline=true) -> canvas cacheado`
- `E.sprite.clear(nome?)` — esvazia o cache (tudo, ou só um nome)
- `E.sprite.has(nome) -> bool ; E.sprite.get(nome) -> canvas | undefined`
- `E.sprite.names() -> nomes de tudo que já foi desenhado (galeria de sprites)`
- `E.drawSprite(g, cv, x, y, {ax=cv.width/2, ay=cv.height, rot=0, sx=1, sy=1, alpha=1, flip=false, smooth})`
- `Draw.lod(zoom, minPx?)` — informa o zoom da câmera (chamar 1x por frame antes de desenhar o mundo)
- `Draw.beam(g, pts, w, col, {ol=Draw.OL, cap='round', hi, shade})` — polilinha grossa com contorno, luz em cima e sombra embaixo
- `Draw.poly(g, pts, col, {ol, shade, hi, close=true})` — polígono chapado com contorno; shade/hi = cor da faixa de baixo/cima (opcional)
- `Draw.circle(g, x, y, r, col, {ol, hi=true, shade=true})` — disco chapado com contorno, meia-lua de sombra e brilho
- `Draw.ring(g, x, y, r, wd, col, {ol, hi=true})` — anel de raio externo r e espessura wd
- `Draw.cable(g, a, b, {sag=0, lw=1.5, col=LINE, ol=0})` — cabo de a=[x,y] até b com barriga 'sag' (unidades de mundo no meio do vão)
- `Draw.hazard(g, x, y, w, h, {a=amarelo, b=preto, sw, ol})` — faixa zebrada de segurança com contorno
- `Draw.box(g, x, y, w, h, col, {top, shade, ol, r=0, rivets=false, panels=0, stripes})` — caixa chapada com luz no topo e sombra embaixo
- `Draw.window(g, x, y, w, h, {glare=true, r=1.5, ol, col, frame})` — vidro com reflexo diagonal; frame = cor de moldura opcional
- `Draw.truss(g, a, b, depth, w, col, {taper=.6, bays, cross=false, verticals=cross, joints=true, web, ol, hi}):`
- `Draw.lattice(g, x, y, w, h, cell, lw, col, {ol, cross=true, joints, web})` — torre treliçada retangular (canto de cima/esquerda em x,y)
- `Draw.wheel(g, x, y, r, rot, {tire, hub, spokes=6, tread=true, ol})` — pneu fora-de-estrada (r inclui as garras) com aro e parafusos
- `garras (giram)`
- `Draw.track(g, x, y, w, h, phase, {col, wheels, belt, frame=true, ol})` — esteira de trator dentro do retângulo (x,y,w,h);
- `Draw.piston(g, a, b, w, {col, rod, len, max, ol})` — cilindro hidráulico de a=[x,y] até b; a camisa (largura w) fica presa em a,
- `tampa (gaxeta) e anel traseiro`
- `Draw.light(g, x, y, r, col, on, {ol, halo=4.5, add=false})` — lâmpada de raio r; on = bool ou 0..1 (acesa tem halo suave)
- `Draw.rail(g, a, b, {posts=6, h=6, col, lw=1.2, mid=true, ol})` — guarda-corpo sobre a linha a->b (corrimão a 'h' de altura, montantes verticais)
- `Draw.stairs(g, a, b, steps, {col, lw=2, rail=true, railH=7, railCol, stringer=true, ol})` — escada em degraus entre a e b (qualquer ordem)
- `longarina (viga inclinada por baixo dos degraus)`
- `degraus (espelho + piso)`
- `Draw.text(g, txt, x, y, {size=16, col='#FFFAEE', stroke=LINE_CSS, sw=4, align='center', font, weight=900, rot, baseline='middle', shadow=0, alpha})`
- `Draw.sign(g, x, y, w, h, texto, {col, ink, r, border=true, weight=900, font, ol, rivets=false})` — placa com moldura e texto que se ajusta sozinho
- `Draw.pattern(g, nome, base, c2, c3, {size=48, n=170, shape='grain'|'dots'|'hatch'}) -> CanvasPattern cacheado (lado a lado sem emenda)`
- `Draw.pattern.clear(nome?)` — esvazia o cache de texturas
- `Draw.shadow(g, x, y, rx, ry, alpha=.18)` — sombra elíptica no chão
- `Draw.rrect(g, x, y, w, h, r)` — só monta o caminho de um retângulo arredondado (pra fill/stroke/clip por conta própria)
- `E.spriteText(nome, texto, {pal, outline=true, bevel=true, flip}) -> canvas cacheado`

### shiba.js

Pixxel v1.0 · shiba.js O Kome (shiba chibi de chapéu kasa) desenhado em pixel art procedural numa grade 48x44. - E.ShibaPX      rasterizador original do rascunho (poses antigas pixel a pixel iguais) + poses novas - E.PALS         paletas {h,g,o,c,k,n,p} - E.drawShiba    desenha com os pés em (x,y), com cache de frames (aguenta 100+ shibas por frame) - E.drawShibaHead close de rosto com expressões para cutscenes - E.shibaAnchor  âncoras (pata, boca, cabeça, costas, topo do chapéu) por pose - E.Actor        shiba com estado, objeto na pata e balão de fala Depende só de core.js.

- `under (opcional) = pixels que aparecem onde o sprite é vazio (a sombra do chão, já pronta em Uint32)`
- `ShibaPX.frame(cv, mode, t, pal)` — desenha um frame 48x44 (com sombra) no canvas dado. API do rascunho.
- `ShibaPX.still(pal, mode='sit', scale=1) -> dataURL de um frame parado (ícones de UI)`
- `drawShiba.frameT(t, opts?) -> o t que realmente é desenhado (quantizado a 1/fps quando o frame vem do cache)`
- `drawShiba(g,x,y,pose,t,{face=1,scale=1,squash=0,rot=0,pal='kome',hat=true,mouth,eyes,alpha=1,shadow=true,fast,exact,smooth})` — pés em (x,y)
- `drawShiba.clear()` — esvazia o cache de frames ; drawShiba.stats -> {hits, misses, exact}
- `drawShiba.fps (get/set)` — quadros de animação por segundo guardados no cache (padrão 30; 20 economiza mais)
- `shibaCanvas(pose,t,opts) -> canvas 48x44 NOVO (cópia), pra ícones/sprites que você quer guardar`
- `shibaAnchor(pose,t,nome:'paw'|'mouth'|'head'|'back'|'hatTop'|'hold'|'eye', out?, {hat,fast}?) -> {x,y} local (multiplique x por face)`
- `drawShibaHead(g,x,y,t,{scale=6,expr='normal',pal='kome',face=1,hat=true,alpha=1,rot=0,still=false})` — close de rosto centrado em (x,y)
- `drawBubble(g,x,y,texto|B,{size=11,maxW=150,k=1 (0..1 pop),side=1,col,ink})` — balão creme com a ponta em (x,y)
- `say(texto, seg=2.5, {size=11, maxW=150, typing=true})` — abre o balão de fala
- `shutUp()` — fecha o balão já
- `hop(v=120)` — pulinho com squash na aterrissagem
- `update(dt)` — avança tempo, posição, pulinho, balão
- `anchor(nome, out?) -> {x,y} em coordenadas de mundo (considera face, escala, squash e rot), no mesmo t do frame desenhado`
- `draw(g)` — desenha o shiba, o objeto na pata e o balão
- `drawHold(g, hold, y)` — desenha o sprite preso à âncora (padrão 'hold' = pata)
- `drawBubble(g)` — balão acima da cabeça, com pop de entrada/saída

### fx.js

Pixxel v1.0 · fx.js Câmera, partículas, textos flutuantes e efeitos de tela. - E.Camera     câmera 2D: follow suave, zoom em escala logarítmica (não treme em zoom minúsculo), shake por trauma (ruído suave, não aleatório por frame), limites, fit, parallax - E.Particles  partículas em typed arrays (sem alocar por frame, swap-remove), 13 formas, chão com quique/pouso, desenho em lotes por cor - E.Floaters   textos "+¥123" que sobem, com pop e contorno no estilo Kome - E.ScreenFX   flash, fade, barras de cinema, vinheta, linhas de velocidade, hitstop, confete, anel de impacto e íris Depende de core.js (pix.js é opcional: só usa E.PAL / E.Draw.FONT se existirem).

- `E.Camera(vw, vh) -> cam` — câmera centrada em (x,y) com zoom z; (vw,vh) = tamanho lógico da tela
- `follow(tx,ty,dt,k=6)` — aproxima o centro do ponto (tx,ty); suavização independente de fps
- `moveTo(x,y,k?)` — define um alvo e deixa o update levar a câmera até lá
- `zoomTo(z,k?)` — zoom alvo (suave, em escala log); k = rigidez (padrão 2.2); k=Infinity pula direto
- `zoomAt(z,sx,sy,k?)` — zoom mantendo o ponto de tela (sx,sy) parado (roda do mouse, pinça)
- `fit(x0,y0,x1,y1,margin=0,instant=false)` — enquadra o retângulo de mundo (margem em px de tela)
- `snapTo(x?,y?,z?)` — pula direto pro alvo (ou pros valores dados), sem suavizar
- `apply(g)` — aplica a transformação mundo -> tela (não faz save; use begin/end ou save/restore por fora)
- `unapply(g)` — desfaz o apply (volta pra coordenadas de tela sem precisar de save/restore)
- `begin(g) / end(g)` — save + apply / restore
- `toWorld(sx,sy,out?) -> {x,y}` — tela -> mundo (ignora o tremor, pra clique não tremer junto)
- `toScreen(wx,wy,out?) -> {x,y}` — mundo -> tela (ignora o tremor)
- `view(out?, pad=0) -> {x0,x1,y0,y1}` — retângulo de mundo visível (pad em unidades de mundo)
- `visible(x,y,r=0) -> bool` — o círculo de mundo aparece na tela? (pra não desenhar o que está fora)
- `update(dt)` — zoom suave, alvo automático, limites, tremor e molas; chamar 1x por frame
- `kick(dx,dy)` — empurrão em px de tela que volta com mola (recuo de tiro, pancada com direção)
- `punch(k=.06)` — soco de zoom (aproxima k e volta com mola); negativo afasta
- `addTrauma(v)` — soma trauma (0..1); .2 batidinha, .5 pancada, 1 terremoto
- `parallax(g, fator, fn(g, view), fz=fator)` — desenha fn com a câmera aplicada em fração (0 = colado na tela, 1 = mundo)
- `resize(vw,vh)` — troca o tamanho lógico da tela
- `E.Particles(max=1200) -> ps`
- `add(p) -> bool` — {x,y,vx,vy,g,life,decay,r,vr,w,h,c,shape,land,bounce,drag,grow,fade,sway,flip,ol,txt,onLand(p)}
- `update(dt, floorFn?)` — física; floorFn(x) -> y do chão (só pra quem tem land)
- `draw(g, view?)` — desenha tudo (coordenadas de mundo); view {x0,x1,y0,y1} opcional pula o que está fora
- `clear()` — remove tudo
- `each(fn(x,y,i))` — percorre as posições (debug, colisão simples)
- `burst(x,y,n,{c,speed=[80,340],shape='star',up=120,...campos do add})` — explosão pra todos os lados
- `spray(x,y,n,{dir=-PI/2,spread=.6,speed=[160,420],jitter=3,...campos do add})` — jato num cone
- `puff(x,y,n,size=8,{c,speed,up,life})` — nuvenzinha de poeira de desenho animado (cresce e encolhe)
- `coins(x,y,n,{speed,c,...})` — moedas pulando (quicam e deitam no chão se o update receber floorFn)
- `sparks(x,y,n,{dir,spread=PI,speed,c,...})` — faíscas (riscos que seguem a velocidade)
- `splash(x,y,n,{c,speed})` — respingo de água pra cima + anel
- `sparkle(x,y,n,{c,r=12})` — brilhos que piscam no lugar (ouro, item raro)
- `poeira (puff) e fumaça (smoke)` — duas bolinhas chapadas (sombra + base), sem gradiente
- `E.Floaters(max=160) -> fl`
- `add(x,y,txt,{c='#FFFAEE',size=16,life=1.1,vy=-46,vx=0,stroke=LINE,pop=1,sw,rot,shake=0,delay=0})` — cria um texto que sobe
- `style(valor, out?) -> {size,c,stroke,pop,shake}` — estilo pelo tamanho do número (pequeno creme, grande dourado, absurdo vermelho)
- `money(x,y,valor,{prefix='+¥',...opts do add})` — atalho "+¥1,2 mil" já com o estilo do valor
- `update(dt)`
- `draw(g, cam?)` — com cam, desenha em coords de TELA (chamar fora do cam.apply; texto nítido e do mesmo tamanho em
- `clear()`
- `E.ScreenFX(stage | {w,h}) -> fx`
- `flash(cor='#FFFAEE', dur=.25, alfa=.85)` — clarão que some
- `fade(to, dur=.5, cb, cor)` — escurece (to=1) ou clareia (to=0) a tela; cb quando termina
- `letterbox(on, h=60)` — barras de cinema deslizando
- `vignette(k)` — vinheta marrom suave (0 desliga; .25 sutil; .6 dramática)
- `speedlines(on, {dir, col, col2, n=64, x, y, inner=.36, alpha=.9})` — linhas de anime; sem dir = radiais em volta de (x,y);
- `hitstop(seg=.08) -> timeScale` — congela o jogo por um instante (use: loop.timeScale = fx.timeScale todo frame)
- `slowmo(escala=.3, seg=.6)` — câmera lenta que volta suave pro normal
- `confetti(n=90, {x,y,colors,speed})` — chuva de confete do topo; com x,y = canhão a partir do ponto
- `shock(x,y,{r=170,col,dur=.5,w=14})` — anel de impacto abrindo (coords de tela)
- `iris(open, x=centro, y=centro, dur=.6, cb)` — transição em círculo; open=false fecha no ponto, open=true abre a partir dele
- `impact(x,y,k=1)` — combo de pancada: clarão + anel + hitstop proporcionais a k
- `update(dt)` — avança os efeitos (por padrão pelo relógio real; ver realTime)
- `draw(g)` — desenha por cima de tudo, em coordenadas de tela (depois do mundo e do HUD de canvas)
- `clear()` — desliga tudo na hora
- `resize(w,h)` — se o tamanho lógico mudar

### terrain.js

Pixxel v1.0 — terrain.js Terreno granular: a montanha de arroz (E.Heap), pilhas pequenas que assentam (E.Pile) e grãos voando (E.Grains). Depende de core.js e pix.js. COORDENADAS (importante): - "mundo": x pra direita, y pra baixo; a base da montanha fica em y = heap.y0 (padrão 0), pra cima é negativo. - "altura" (alt): distância ACIMA da base, positiva pra cima. alt = heap.y0 - yMundo. heap.h / heap.h0 / matAt(i, alt) / pocketAt(x, alt) / bolsões {x, y: alt} / elipse {cx, cy: alt} usam ALTURA. surf(x) / digCircle(cx, cy, ...) / bite() / draw() / Grains usam Y DE MUNDO. Seções: 1 texturas de grão · 2 Heap (dados, camadas, cavar, avalanche, desenho) · 3 Pile · 4 Grains

- `polido (15/11)` — grãos um pouco maiores e menos amontoados, cada um com sombra, corpo e brilho legíveis
- `textura(g, kind, col, c2, c3, variante) -> CanvasPattern cacheado`
- `E.Heap({width, colW=4, x0=0, y0=0, repose=3.6, relaxIters=2, minK=0.4, flowRate=0.3, layers?, onPocket?(p)}) -> heap`
- `generate(fn(x)->altura)` — preenche a montanha a partir de uma função do x de mundo (centro da coluna)
- `fromArray(arr)` — alturas originais vindas de um array (uma por coluna)
- `restore()` — volta a montanha ao estado original (bolsões voltam a ficar escondidos)
- `col(x) -> índice da coluna (limitado a 0..n-1)`
- `colX(i) -> x de mundo do centro da coluna`
- `height(x) -> altura atual em x (interpolada entre colunas)`
- `surf(x) -> y de MUNDO da superfície (negativo pra cima)`
- `alt(yMundo) -> altura acima da base`
- `slope(x) -> inclinação (dAltura/dx; positivo = sobe pra direita)`
- `peak() -> {x, h, i} do ponto mais alto atual (objeto reaproveitado)`
- `remaining() -> área que resta (px²)`
- `frac() -> 0..1 do que resta em relação ao original`
- `dugDepth(x) -> quanto já foi cavado em x (altura original - atual; negativo = empilhado)`
- `setLayers([{id,name,hard,val,slope,col,col2,col3,tex, top (fração da altura original) | d0,d1 (profundidade abaixo da superfície original) | ellipse:{cx,cy,rx,ry}}])`
- `matAt(i, alt) -> camada (objeto com id,hard,val,slope,col...) na coluna i e altura alt`
- `matAtX(x, alt) -> camada no x de mundo`
- `topMat(x) -> camada exposta na superfície em x`
- `addPocket({x, y (altura), r, mult=8, kind='gold'}) -> bolsão (ganha .found e .flash)`
- `clearPockets()` — remove todos os bolsões
- `pocketAt(x, alt) -> bolsão que contém o ponto, ou null`
- `dig(cx, area, rad, {pow=1, onTake(i, areaTirada, yTopoMundo)}) -> {got, val, gold, hard, blocked, hardMat, pocket, byMat}`
- `digCircle(cx, cy, r, area, {pow, onTake}) -> igual ao dig + {fell}` — corte da roda de caçambas (cy em Y DE MUNDO)
- `digRect(xa, xb, depth, {pow, onTake}) -> igual ao dig` — tira 'depth' px do topo de cada coluna do vão (garfo da empilhadeira)
- `bite(cx, cy, r, dir=1, amostras=12) -> 0..1` — fração enterrada do semicírculo da frente da roda (cy em Y de mundo)
- `add(x, area, rad=colW*2) -> deposita área em volta de x (perfil parabólico); a avalanche assenta depois`
- `wake(xa?, xb?)` — acorda a avalanche numa faixa (ou em tudo) depois de mexer em heap.h na mão
- `relax(dt) -> área que escorreu` — desliza grão das colunas mais altas que o talude de repouso (por material) permite
- `settle(maxIters=4000)` — roda a avalanche até parar (carregar save, gerar terreno já assentado)
- `draw(g, view{x0,x1,y0,y1}, time, {outline=true, sparkle=true, grains=true, pockets='all'|'found'|'hint'|false, haze:{col,a0,a1}|0, scale, ol})`
- `prewarm(g)` — gera as texturas agora (evita o engasgo do primeiro frame)
- `serialize({full=false}) -> string compacta (Uint16 em base64; só a faixa que mudou em relação ao original)`
- `deserialize(dado) -> true se carregou` — aceita a string do serialize() ou um array de alturas. Chame depois de generate()/addPocket()
- `faixas (da superfície pro fundo)`
- `E.Pile({cap=100, cols=20, slope=.05, max=1.2, col='#F6F1E4', tex='loose', seed}) -> pile`
- `add(v, at=.5 (0..1 ao longo da largura), spread=.16) -> quanto coube (o resto derramou)`
- `take(v, at?) -> quanto saiu` — tira do topo (em volta de 'at', ou das colunas mais altas)
- `set(frac)` — define o volume direto (monte já assentado)
- `clear()` — esvazia
- `update(dt)` — continua assentando e anima a superfície mostrada (opcional, mas é o que dá vida)
- `topAt(at, hmax) -> altura do monte (px) na posição 0..1 (pra pousar grãos em cima)`
- `draw(g, x (centro), y (fundo), w, hmax, {outline=true, grains=true, scale, clip=true})` — monte com grão, crista clara e contorno
- `E.Grains(particles|null, heap, {max=700, g=900, drag=.4, col, onLand(x, y, gold, vol)}) -> grains`
- `emit(x, y, n, {vx=0, vy=-120, spread=60, gold=false, deposit=false, vol=0 (área total que os n grãos carregam), size=1, life=4})`
- `update(dt)` — gravidade, arrasto, quique e pouso (com deposit: heap.add onde pousou)
- `draw(g, view?, scale?)` — grãos com barriga escura e corpo claro (de longe viram pontinhos)
- `floor(x) -> y de mundo do chão (pra passar como floorFn no particles.update)`
- `clear()` — some com todos (sem depositar)
- `flush()` — pousa todos agora (deposita o que carregavam); útil antes de salvar
- `E.SlideFX(heap, {max=240, g=900, onLand(x, y, speed, mat), carry=.45, grainMass=6, active()}) -> { update(dt, view{x0,x1}), draw(g, zoom=1), list, flush() }`
- `flush()` — devolve pro mapa toda massa que está rolando ou esperando (antes de salvar / trocar de montanha)
- `E.Terrain.texture(g, 'loose'|'pressed'|'mochi'|'gold', col, col2?, col3?, 'g'|'s'|'ca'|'cb') -> CanvasPattern (ladrilho em .canvas)`
- `E.Terrain.fill(g, {tex, col}, escala?) preenche o caminho atual com o LOD certo pra escala`

### rig.js

Pixxel — rig.js Máquinas articuladas "de verdade": esqueleto de peças com juntas, IK, juntas com mola (peso e overshoot), pistões que esticam, cabos com polias, mastros telescópicos, chassi com suspensão, esteira transportadora e escapamento em pulsos. Tudo no estilo Kome (contorno LINE, cores chapadas da E.PAL). Depende de: core.js, pix.js. Índice 1. Spring / Joint      mola amortecida; junta com limites, vazão hidráulica e batente 2. ik2 / ik3           IK de dois ossos; lança + braço + caçamba com ângulo da caçamba controlado 3. Rig                 esqueleto hierárquico (peças, z, sprites, pistões/links entre peças, world()) 4. Rig.* (desenho)     pin, plate (braço chapado afinado), bucket, pulley, mound 5. Rope                cabo por polias (tangentes), barriga, polias que giram com o cabo pago 6. Telescope           mastro/cilindro telescópico em estágios 7. Chassis             rodas num chão f(x): inclinação da carroceria + compressão da suspensão 8. Exhaust             fumaça de escapamento em pulsos 9. Conveyor            esteira transportadora em polilinha com roletes, marcas e montinhos de carga Receita de um braço articulado (ver demos/rig.html pras máquinas completas): const rig = E.Rig(), J = { boom: E.Joint(-.6, {k:22, d:7.5, min:-1.3, max:0, speed:1.3}), stick: E.Joint(1.5, {k:34, d:9}) }; rig.part('casa',  { draw: g => Draw.box(g, -40, -40, 80, 40, PAL.yel, {r:5}) }); rig.part('lanca', { parent:'casa',  x:30, y:-12, z:2, joint:J.boom,  draw: g => { Rig.plate(g, [[0,0,6],[30,-13,10],[80,0,5]], PAL.yel); Rig.pin(g,0,0,3); } }); rig.part('braco', { parent:'lanca', x:80, y:0,   z:3, joint:J.stick, draw: g => Rig.plate(g, [[-12,-2,4],[3,-1,7],[50,0,4]], PAL.yel) }); rig.piston('p1', { a:['casa',44,-4],   b:['lanca',32,-6],  w:6, z:2.5 });  rig.calibrate('p1', [['lanca', J.boom.min, J.boom.max]]); rig.piston('p2', { a:['lanca',31,-21], b:['braco',-12,-2], w:5, z:3.5 });  rig.calibrate('p2', [['braco', .4, 2.5]]); // por frame: alvo no espaço do modelo -> IK -> alvos das juntas (as molas dão o peso e o atraso entre elas) const ik = E.ik2(30, -12, alvoX, alvoY, 80, 50, 1, tmp);  J.boom.set(ik.a1);  J.stick.set(ik.rel); rig.update(dt);  rig.draw(g, x, y, { face, rot: chassi.tilt }); Regras de ouro: pino (Rig.pin) em toda junta; braço = Rig.plate afinado, nunca um Draw.beam só; todo movimento passa por E.Joint/E.Spring (rigidez diferente por junta = atraso entre elas); o "segundo braço" é a mesma peça mais escura com z atrás.

- `E.Spring(v, {k=120, d=14}) -> { x, v, target, k, d, update(dt)->x, kick(impulso), snap(x) }` — mola amortecida (balanço de carroceria, antena, carga pendurada)
- `update(dt) -> x` — avança a mola em direção a target
- `kick(impulso)` — soma velocidade (tranco)
- `snap(x)` — teleporta e zera a velocidade
- `E.Joint(ang, {k=60, d=11, min, max, speed=Infinity, bounce=.2}) -> junta com peso` — acelera, passa um pouco do ponto e assenta
- `update(dt) -> x`
- `set(alvo)` — define o alvo (respeita os limites)
- `snap(ang)` — teleporta
- `kick(impulso)` — tranco na junta
- `E.ik2(ax, ay, tx, ty, L1, L2, bend=1, out?) -> {ex,ey, bx,by, a1,a2, rel, reach, clamped}`
- `E.ik3(ax, ay, tx, ty, L1, L2, L3, tip, bend=1, out?) -> {a1,a2,a3, bx,by, wx,wy, ex,ey, rel2, rel3, reach, clamped}`
- `E.Rig() -> rig` — esqueleto hierárquico de peças.
- `part(nome, {parent, x, y, rot=0, z=0, draw(g, part, rig, t), sprite, ax, ay, sx=1, sy=1, visible=true, joint, update(part,dt,rig), data}) -> part`
- `set(nome, {rot, x, y, z, visible, ...}) -> part` — altera campos da peça
- `get(nome) -> part | undefined`
- `has(nome) -> bool`
- `link(nome, {a:[peça,lx,ly], b:[peça,lx,ly], z, dx, dy, render(g, a, b, part, rig, t)}) -> part`
- `piston(nome, {a:[peça,lx,ly] (camisa), b:[peça,lx,ly] (haste), w=5, z, col, rod, len, min, max, dx, dy, ol}) -> part`
- `calibrate(nome, [[peça, rotMin, rotMax], ...], passos=10) -> {min, max}` — varre as juntas, mede o curso do pistão/link
- `drive(nome, prop, mola)` — liga um E.Spring/E.Joint a um campo da peça (ex.: 'y' numa cabine que balança); atualizado no rig.update
- `update(dt)` — avança juntas/molas ligadas às peças e chama part.update
- `pose()` — recalcula as matrizes de todas as peças no espaço do modelo (sem mexer na raiz)
- `solve(x, y, face=1, scale=1, rot=0)` — calcula tudo sem desenhar (depois world() responde no mundo)
- `draw(g, x, y, {face=1, scale=1, rot=0, t})` — resolve e desenha as peças por ordem de z (empate = ordem de criação)
- `model(nome, lx=0, ly=0, out?) -> {x,y,rot}` — ponto local da peça no espaço do MODELO (sempre atual; use pra IK e âncoras)
- `world(nome, lx=0, ly=0, out?) -> {x,y,rot}` — ponto local da peça no MUNDO (usa x,y/face/escala do último solve/draw)
- `toModel(wx, wy, out?) -> {x,y}` — ponto do mundo -> espaço do modelo (ex.: alvo do mouse pra IK)
- `toLocal(nome, wx, wy, out?) -> {x,y}` — ponto do mundo -> espaço local da peça
- `dist(nomeA, lxA, lyA, nomeB, lxB, lyB) -> distância entre dois pontos de peças (espaço do modelo)`
- `Rig.pin(g, x, y, r, {col=aço, ol})` — pino de articulação (disco de aço com miolo escuro)
- `Rig.plate(g, pts, col, {ol, hi=true, shade=true, side=1})` — braço/lança de chapa. pts = [[x,y,raio], ...] (2+ nós);
- `Rig.mound(g, x, y, hw, h, {col=arroz, shade, ol, grains=true})` — montinho (de arroz) com base em (x,y), meia-largura hw e altura h
- `Rig.bucket(g, s, {kind='loader'|'excavator', col, load=0..1, teeth=true, cargo=cor, ol})` — caçamba de perfil com o pino em (0,0)
- `Rig.pulley(g, x, y, r, rot, {col=amarelo, holes=4, ol})` — polia/roldana com furos que giram (rot em radianos)
- `E.Rope({pts:[{x,y,r=0,over=1,sag}], lw=1.5, col=LINE, sag=0, pulleys=true, pulleyCol, fixed='end'|'start'}) -> rope`
- `solve()` — recalcula tangentes e comprimentos (sem girar polias)
- `update(dt)` — solve + gira polias pelo cabo que passou + balanço
- `draw(g)` — cabo (com barriga/balanço) e as polias por cima
- `E.Telescope({stages=2, len=40, w=8, overlap=.2, taper=.74, col, cols, rod, sequential=false}) -> tel`
- `draw(g, x, y, ang, ext?) desenha a partir da base (x,y) apontando pra 'ang' (-PI/2 = pra cima);`
- `tip(x, y, ang, out?) -> {x,y} ponta; stage(i, x, y, ang, out?) -> topo do estágio i; length() comprimento atual; max`
- `offset(i, ext?) -> distância da base até o início do estágio i`
- `length(ext?) -> comprimento total atual`
- `tip(x, y, ang, out?, ext?) -> {x,y}`
- `stage(i, x, y, ang, out?, ext?) -> {x,y}` — topo do estágio i
- `draw(g, x, y, ang, ext?)`
- `E.Chassis({wheels:[{x, r, travel=5}], floor(x)->y, k=150, d=13, tiltK=110, tiltD=11, squat=.0016, face=1}) -> ch`
- `update(dt, x, face?)` — apoia cada roda no chão (encosta no ponto mais alto embaixo dela), tira daí a altura e a inclinação
- `bump(v) tranco vertical, nod(v) tranco de inclinação (ex.` — caçamba bateu no monte)
- `bump(v)` — tranco vertical (v>0 afunda)
- `nod(v)` — tranco de inclinação (rad/s; v>0 gira no sentido horário da tela)
- `update(dt, x, face?)`
- `E.Exhaust({max=28, col, size=3, rate=5, rise=34, wind=0, life=1.3, ol=true}) -> ex`
- `update(dt, x, y, power=0, dirX=0, dirY=-1)` — solta baforadas ritmadas na boca do cano (x,y no mundo); power 0..1 acelera o
- `burst(n, power?) solta n de uma vez (arrancada). draw(g) desenha no mundo (chame fora do rig).`
- `update(dt, x, y, power=0, dirX=0, dirY=-1)`
- `burst(n, power=1)` — baforada grossa (arrancada, esforço)
- `clear()`
- `draw(g)`
- `E.Conveyor(pts, {w=10, speed=60, col, frame, items=true, legs=true, floor, rollers, accel=3, cargo, cargoShade, maxV=2.2, drawItem}) -> cv`
- `put(v=1, s=0)` — põe um montinho de volume v a s unidades do início (funde com o vizinho se cair em cima);
- `onDrop(fn(v, x, y, vx, vy))` — chamado quando um montinho cai da ponta; end() -> {x,y} ponto de queda; start() -> {x,y} de carga;
- `running (liga/desliga com rampa), v (velocidade atual), phase, load (volume em cima), count, length, pointAt(s) -> {x,y,nx,ny,ang};`
- `floor (número ou fn(x)->y) = onde os pés de apoio encostam; drawItem(g, x, y, v, ang, item) troca o desenho da carga;`
- `draw(g, t) desenha tudo; ou em camadas` — drawBack(g) (pés/estrutura), drawBelt(g), drawItems(g)
- `put(v=1, s=0) -> item` — carrega um montinho
- `onDrop(fn(v, x, y, vx, vy, item)) -> cv`
- `end(out?) -> {x,y}` — ponto onde a carga cai (frente do tambor final)
- `start(out?) -> {x,y}` — ponto de carregamento (em cima da correia, no começo)
- `clear()` — tira toda a carga
- `update(dt)` — anda a correia (rampa de partida/parada) e a carga; despeja o que chega na ponta
- `drawBack(g)` — pés de apoio e longarina
- `drawBelt(g)` — correia (laço), roletes, tambores e marcas andando
- `drawItems(g)` — montinhos de carga
- `draw(g, t)` — tudo na ordem certa

### audio.js

Pixxel v1.0 — audio.js Todo o som do jogo, 100% sintetizado (nenhum arquivo de áudio): E.Audio  contexto, cadeia master (compressor + limiter + clip suave), buses e volumes E.Sfx    efeitos com nome, variantes, limite de vozes, gate e "skins" de timbre E.Loops  motores e ambiências contínuos, com regime (rate) e volume sem clique E.Music  trilha generativa japonesa (koto, shakuhachi, taiko, shamisen, baixo, pad) Depende só de core.js. Tudo vira no-op se não houver AudioContext ou se o áudio ainda não foi destravado por um gesto do usuário; nada aqui lança exceção. Como funciona por dentro: quase todo som é pré-renderizado em JS para um Float32Array (kit DSP abaixo) e tocado como AudioBufferSource. A síntese nunca fala com "o" contexto: ela recebe um grafo G (ao vivo ou OfflineAudioContext), então E.Audio.renderSfx/renderLoop/renderMusic produzem exatamente o que toca.

- `mtof(midi) -> Hz`
- `run(x, tipo)` — tipo 0 = passa-baixa, 1 = passa-banda (pico unitário), 2 = passa-alta
- `DSP(sr, seed) -> D` — kit de síntese determinístico (mesma seed = mesmo som)
- `rnd() -> 0..1 (mulberry32 local, rápido)`
- `rr(a,b) -> aleatório em [a,b)`
- `buf(seg) -> Float32Array zerado`
- `grains(out, {n, t0, t1, f0, f1, d0, d1, vol, q})` — n estalinhos de grão (ruído passa-banda curtíssimo) espalhados em [t0,t1]
- `filter(buf, tipo 'lp'|'bp'|'hp', f, q, f1, loop)` — filtra no lugar (f -> f1 varrendo). loop=true aquece o filtro
- `sat(buf, drive)` — saturação suave tanh (gera harmônicos que alto-falante pequeno reproduz)
- `gain(buf, g)`
- `mix(out, src, at, g)` — soma src em out a partir de 'at' segundos
- `wrap(out, src, at, g)` — soma src em out dando a volta no fim (pra montar loops exatos)
- `fold(buf, n) -> Float32Array(n)` — dobra a sobra do fim sobre o começo com crossfade de potência igual (loop sem emenda)
- `peak(buf) -> pico absoluto`
- `renderDrum(D, tipo) -> Float32Array` — taiko e percussão da trilha
- `makeIR(ctx)` — resposta ao impulso sintética, estéreo, que escurece com o tempo (sala de madeira)
- `buildGraph(ctx, offline) -> G` — monta buses, reverb e cadeia master num contexto qualquer
- `ksBuf(G, midi, tipo) -> {buf, rate}` — nota de corda em cache
- `drumBuf(G, tipo, variante) -> AudioBuffer`
- `instBuf(G, inst, midi) -> AudioBuffer (instrumentos não-KS)`
- `noiseLoop(G) -> AudioBuffer de ruído rosa em loop (sopro do shakuhachi)`
- `ready() -> true se o contexto ao vivo existe e está rodando`
- `init() -> bool` — cria o contexto e o grafo (idempotente). Chame num gesto do usuário; devolve false se não há áudio
- `unlock()` — init + resume + "chute" silencioso do iOS. Pode chamar em todo gesto
- `suspend()` — pausa o contexto (economiza bateria); resume(): volta
- `muted (get/set)` — silencia tudo com rampa; suspende o contexto depois de meio segundo mudo
- `persist(chave='kome.audio')` — carrega e passa a gravar {muted, volume, sfxVol, musicVol} no localStorage
- `duck(profundidade=0.5, volta=0.9)` — abaixa a música um instante pra um som importante aparecer
- `on('unlock'|'mute', fn) -> off`
- `prewarm(nomes?)` — renderiza sfx/loops em fatias ociosas pra não engasgar no primeiro uso
- `mtof(midi) -> Hz ; DSP(sr, seed) -> kit de síntese (pra quem define som próprio)`
- `degMidi(grau, escala, raiz) -> midi (graus negativos descem oitava)`
- `steal(G, v)` — cala uma voz em 15 ms (sem clique) pra abrir vaga
- `rnd() -> 0..1 (fixo em render offline, pra testes reproduzíveis)`
- `src(audioBuffer, {rate=1, vol=1, delay=0, pan=0, exact=false})` — toca um AudioBuffer nesta voz
- `buf(chave, fn(D)->Float32Array, opts)` — renderiza (uma vez, com cache) e toca um som próprio
- `tone(f, d, tipo='square', v=.2, slide=0, delay=0)` — oscilador ao vivo com envelope sem clique
- `noise(d, f=1200, v=.2, q=1, delay=0)` — rajada de ruído passa-banda ao vivo
- `note(midi, {inst (padrão = skin atual), vel=.7, delay=0, pan})` — nota afinada de um instrumento de recompensa
- `pluck(midi, {vel, delay, kind='koto'})` — corda dedilhada (koto, shami, bass, harp)
- `drum(tipo, {vel=.7, delay=0, rate=1})` — don, chu, ten, ka, chan, chiki, clap, furin, drop, anvil
- `deg(grau, oitava=1) -> midi na escala corrente da trilha (0 = tônica)`
- `play(nome, opts)` — dispara outro som registrado (voz separada), com delay relativo a este
- `subBuf(G, hz) -> AudioBuffer` — o "grave do impacto" de uma ferramenta (fica mais fundo e longo a cada degrau)
- `def(nome, meta, render)` — atalho interno pra registrar um som pré-renderizado
- `comp(nome, meta, play)` — atalho interno pra som composto (função que usa a api)
- `gate(k, ms) -> bool` — true no máximo uma vez a cada 'ms' por chave (relógio de parede; funciona sem áudio)
- `init()` — igual a E.Audio.unlock() (nome do rascunho)
- `muted (get/set)` — espelho de E.Audio.muted
- `names() -> lista dos sons registrados`
- `has(nome) -> bool`
- `setSkin(n|'A'..'G')` — troca o timbre das recompensas (moeda, combo, pling, fanfarra); getSkin() -> índice
- `skins() -> [{id, inst, label}]`
- `tools() -> os 12 degraus [{id, sub (Hz), w (peso padrão)}] ; setTool(n|id)` — ferramenta usada por dig()
- `tone(f, d, tipo='square', v=.2, slide=0, delay=0)` — bip cru do rascunho
- `noise(d, f=1200, v=.2, q=1, delay=0)` — rajada de ruído do rascunho
- `dig(pitch=1, heavy=0)` — cavada com a ferramenta atual (setTool); heavy 0..1 soma peso no grave
- `combo(n)` — nota da escada do combo (n = 0..30); no 30 solta o glissando
- `coin(combo=0)` — moeda; sobe 1 semitom a cada 5 de combo (GDD §8.2)
- `coinSoft(combo)` — ganho pequeno, uma nota baixa (no máximo ~3 por segundo)
- `gold() buy() big() shake() pop()` — atalhos do rascunho
- `loopDef(nome, meta, render)` — registra um loop. rate/lp/gain = [valor em regime 0, valor em regime 1]
- `bed(D, n, o) -> Float32Array(n)` — cama de ruído contínua e sem emenda (o = opções de D.noise)
- `pulses(D, out, o)` — trem de explosões de motor, escrito dando a volta (loop exato). O jitter é o que dá vida
- `tones(D, out, lista [[tipo, Hz, ganho]...])` — osciladores contínuos com nº inteiro de ciclos no loop (sem emenda)
- `finishLoop(D, canais, pico)` — tira NaN e DC e normaliza os canais juntos
- `startLoopOn(G, h, fade)` — liga o loop num grafo
- `set({vol, rate}, tc=0.15)` — muda volume e regime (0 = marcha lenta, 1 = tudo) deslizando, sem clique
- `stop(fade=0.5)` — desliga com fade e solta os nós
- `stopAll(fade=0.5)` — desliga todos
- `names() -> nomes dos loops ; active() -> handles ligados`
- `define(nome, {render(D)->Float32Array|[L,R] (loop exato), vol, rate:[a,b], lp:[a,b], gain:[a,b]})` — registra um loop próprio
- `buffer(nome) -> AudioBuffer do loop (um ciclo exato), pra inspecionar/exportar; null sem áudio`
- `corda (koto/shami/bass/harp) -> camada`
- `advance(até)` — agenda todos os passos (semicolcheias) que começam antes de 'até'
- `nextBar() -> tempo do próximo compasso`
- `fadeIn(seg) / fadeOut(seg)` — entrada e saída do tema inteiro
- `start(tema='campo', {intensity, fade=1})` — começa a trilha (se já toca outro tema, faz crossfade). Antes de destravar fica pendente
- `stop(fade=1.5)` — para com fade
- `setIntensity(0..1)` — 0 = só pad e koto; 1 = taiko, shamisen, sininho e viradas. Anda suave, de compasso em compasso
- `setTheme(tema, crossfade=2)` — troca de tema com crossfade, entrando no compasso
- `themes() -> nomes ; define(nome, tema)` — registra tema novo (veja THEMES.campo como modelo) ; get(nome) -> dados do tema
- `scaleMidi(grau, oitava=0) -> nota midi na escala que está tocando (pra afinar efeitos com a música)`
- `layerOn(nome) -> bool` — a camada (koto, shaku, bass, shime, don, shami, kane...) está soando?
- `quantDelay(div=2) -> segundos até a próxima subdivisão (div por tempo)` — Sfx.play('fanfare', {delay: Music.quantDelay()}) cai no ritmo
- `on('beat'|'bar'|'section'|'theme', fn) -> off. beat(tempo 0..3, compasso), bar(compasso, intensidade), section(n, escala)`
- `renderSfx(nome, {seconds=3.5, ...opts de play}) -> Promise<AudioBuffer|null>` — o som passando pela cadeia master inteira
- `renderLoop(nome, seg=4, {rate, vol}) -> Promise<AudioBuffer|null>`
- `renderMusic(tema, seg=20, {intensity` — número | fn(t)->0..1, seed=1}) -> Promise<AudioBuffer|null>
- `fft(re, im)` — FFT radix-2 no lugar (tamanho potência de 2)
- `mono(audioBuffer) -> Float32Array com a média dos canais`
- `prewarm(nomes?)` — pré-renderiza sfx (todas as variantes) e loops em fatias de ~8 ms

### nature.js

Pixxel v1.0 — nature.js Kit de cenário japonês, todo procedural e no estilo Kome: E.Nature   céu com hora do dia, sol, lua, estrelas, nuvens, Fuji, morros com névoa, chão, árvores (pine/sakura/maple/bamboo/bonsai/round), moita, capim, flores, pedras, torii, tōrō, ponte, cercas, arrozal, barraquinha, casa em 6 estágios, onsen, koinobori, fūrin, pétalas, vaga-lumes, pássaros, borboletas E.Pond     lago orgânico com borda de pedras, cáusticas, ondinhas e vitórias-régias E.Koi      carpas vistas de cima (corpo em cadeia de espinha) que fogem, comem e nunca saem do lago Convenções: pés/base em (x,y); y cresce pra baixo; `t` em segundos anima (vento, luz, água). Sprites estáticos são pixel art (Pix) cacheada; o que precisa dobrar/ondular é vetorial com o mesmo contorno. Ordem de um frame com hora do dia:  sky -> celestial -> fuji/hills -> mundo -> grade() -> fireflies Depende de: core.js, pix.js   (fx.js é opcional: sakuraPetals usa E.Particles)

- `Nature.wind(t, x=0) -> ~-1..1.6` — vento com rajadas que viajam pelo mundo (use pra balançar qualquer coisa)
- `Nature.light(tod) -> {top,mid,bot,haze,tint,cloud,cloudS,sun,night(0..1),bands[]}` — cores da hora (0 manhã, .5 tarde, .75 pôr do sol, 1 noite)
- `Nature.sky(g, w, h, {tod=0..1, stars=true, t=0})` — céu em faixas com a cor da hora; também define Nature.tod pro resto do kit
- `Nature.sun(g, x, y, r, {tod, t=0})` — sol chapado com halo em degraus e raios girando devagar
- `Nature.moon(g, x, y, r, {t=0, alpha=1})` — lua cheia creme com crateras e halo frio
- `Nature.celestial(g, w, horizon, {tod, t, r=18})` — põe sol e lua no arco do céu conforme a hora (nasce à esquerda, se põe à direita)
- `Nature.glow(g, x, y, r, col='#FFD98A', alpha=1)` — halo aditivo (lanterna, janela, vaga-lume); desenhe DEPOIS de grade()
- `Nature.glows(g)` — descarrega os halos dos objetos acesos desenhados neste frame (grade() já chama)
- `Nature.grade(g, w, h, {tod, horizon, top=100, fade=80, x=0, y=0, strength=1})` — tinge o cenário com a luz da hora (multiply) e acende os halos.
- `Nature.clouds(seed, {n=7}) -> { list, update(dt), draw(g, w, h, camX=0) }` — nuvens gordinhas de base reta, com parallax e cor da hora
- `update(dt)` — avança o vento das nuvens
- `draw(g, w, h, camX=0, {tod})` — desenha na área (w,h) do céu
- `Nature.fuji(g, x, y, s=1, {snow=true, alpha=1, tod, t=0})` — Monte Fuji (base em x,y; ~330*s de largura, 107*s de altura) com névoa na base
- `Nature.hills(g, w, baseY, camX, {col, amp=40, freq=.006, parallax=.3, seed=1, haze=0, tod, trees=0, bottom, step=6}):`
- `Nature.ground(g, x0, x1, y, {col=grama, tufts=true, depth=160, t=0, seed=0, texture=true})` — chão com crista clara, textura de capim e tufos no vento
- `Nature.grassTuft(g, x, y, {seed=0, t=0, s=1, col, n})` — tufo de capim com lâminas que dobram no vento
- `Nature.tree(g, x, y, {kind:'pine'|'sakura'|'maple'|'bamboo'|'bonsai'|'round', s=1, seed=0, t=0, flip, shadow=true}):`
- `Nature.bush(g, x, y, {kind:'bush'|'azalea', s=1, seed=0, t=0, shadow=true})` — moita gordinha (azalea = florida)
- `Nature.flower(g, x, y, {kind:'daisy'|'tulip'|'tanpopo'|'iris'|'higanbana'|'ajisai', seed=0, t=0, s=1})` — flor com caule que dobra no vento
- `Nature.rock(g, x, y, {w=22, h=14, seed=0, moss=false, shadow=true, s=1})` — pedra arredondada em 3 tons, com musgo opcional
- `Nature.torii(g, x, y, s=1, {t=0, rope=true, shadow=true})` — portal torii vermelho (84 de largura, 74 de altura) com shimenawa balançando
- `Nature.lantern(g, x, y, s=1, {lit, t=0, shadow=true})` — tōrō de pedra com musgo; aceso tem janela dourada e halo que tremula (lit padrão: acende à noite)
- `Nature.chochin(g, x, y, {t=0, lit, s=1, col=vermelho, seed=0})` — lanterna de papel pendurada em (x,y), balança no vento
- `Nature.bridgeY(px, x, w, arch) -> altura do tabuleiro (negativa) no ponto px de uma ponte que começa em x` — pra andar por cima
- `Nature.bridge(g, x, y, w, {arch=w*.2, drop=6, shadow=true})` — ponte vermelha arqueada (taikobashi) de x a x+w, com corrimão e giboshi dourados
- `Nature.fence(g, x0, x1, y, {kind:'bamboo'|'wood'})` — cerca de x0 a x1 (bambu amarrado yotsume-gaki, ou tábuas escuras)
- `Nature.paddy(g, x, y, w, h=18, {t=0, seed=0})` — arrozal alagado (canto de cima/esquerda em x,y): taipas de terra, água que reflete o céu e mudas no vento
- `Nature.nobori(g, x, y, {t=0, col=vermelho, h=58, s=1})` — bandeira vertical de feira num mastro de bambu, pano ondulando
- `Nature.stall(g, x, y, {t=0, lit, col=vermelho, lanterns=true, s=1})` — barraquinha de feira com toldo listrado, onigiri e dango no balcão, chōchin balançando
- `Nature.koinobori(g, x, y, {t=0, h=104, s=1})` — mastro com cata-vento, fitas e três carpas de pano (preta, vermelha, azul) nadando no vento
- `Nature.windchime(g, x, y, {t=0, s=1, seed=0, col})` — fūrin de vidro pendurado em (x,y); o sino balança e o papel (tanzaku) rodopia no vento
- `Nature.onsen(g, x, y, {t=0, s=1, guest=true, screen=true})` — rotenburo de pedras com vapor, bica de bambu (shishi-odoshi) e uma capivara de molho com yuzu
- `Nature.house(g, x, y, {stage=0..5, s=1, t=0, lit, floors, garden, onsen, sign='VENDIDO'})` — casa japonesa em estágios de obra.
- `Nature.sakuraPetals(particles, view{x0,x1,y0,y1}, dt, rate=6, from{x,y,r}?)` — solta pétalas (E.Particles, shape 'petal') no topo da vista
- `Nature.fireflies({x0,x1,y0,y1, n=14, seed=1}) -> { update(dt), draw(g, alpha?) }` — vaga-lumes que vagam e piscam (desenhe depois de grade();
- `Nature.birds(seed, {n=6, y=.22, speed=34}) -> { update(dt), draw(g, w, h, camX=0) }` — revoada distante em V batendo asa e planando
- `Nature.butterflies({x0,x1,y0,y1, n=5, seed=1}) -> { list, update(dt), draw(g) }` — borboletas que esvoaçam dentro da área
- `E.Pond({x, y, w=320, h=180, seed=1, pads, reeds=2, stones=1}) -> pond` — lago com centro em (x,y) e contorno orgânico.
- `update(dt) · draw(g,t) (desenha tudo, inclusive as carpas ligadas por E.Koi) · drawUnder(g,t)/drawOver(g,t) (camadas separadas)`
- `ripple(x,y,{size,scare=true}) toque` — ondinha + susto nas carpas · feed(x,y,n=4) ração · contains(x,y) · rho(x,y) 0 centro..1 borda
- `rho(x,y) -> 0 no centro .. 1 na borda (coords de mundo)`
- `contains(x,y) -> bool`
- `ripple(x, y, {size, scare=true}) -> bool` — toque na água; devolve false se foi fora do lago
- `feed(x, y, n=4) -> bool` — joga ração; as carpas vêm comer
- `randomPoint(rnd, maxRho, out{x,y}) -> out` — ponto local aleatório dentro do lago
- `update(dt)` — ondinhas, ração, sustos e uma gota ocasional
- `drawUnder(g, t)` — margem, água em degraus de profundidade, fundo, sombra da margem e cáusticas
- `drawOver(g, t)` — reflexos, ondinhas, ração, vitórias-régias, pedras da borda e juncos
- `draw(g, t)` — desenha o lago inteiro; se houver carpas (E.Koi) ligadas, elas entram na camada certa (embaixo das vitórias-régias)
- `E.Koi(pond, n=8, {seed=1, size=1, kinds, sfx=false}) -> { list, update(dt), draw(g,t), add(kind) }` — carpas que vagam, desviam da borda,
- `add(kind?) -> peixe` — põe mais uma carpa no lago
- `update(dt)` — direção (vagar + borda + fuga + comida + espaço entre peixes), velocidade e a cadeia da espinha
- `draw(g, t)` — só as carpas (recortadas na água). Não desenha de novo se pond.draw() já desenhou neste frame.

### ui.js

Pixxel v1.0 · ui.js — HUD em DOM por cima do canvas (par do pixxel.css) Depende só de core.js. Se pix.js estiver carregado, os ícones embutidos são pixel art (E.UI.icons); sem ele, viram glifos de texto (nunca emoji). Índice: 1. base (DOM, relógio próprio, som opcional)      9. missões, metas 2. ícones                                        10. álbum 3. mount / zonas                                 11. ajustes (linha, toggle, slider) 4. pílula, número rolante                        12. sparkline, taxa, medidor radial 5. barra, meta                                   13. árvore (grafo de nós com pan/zoom) 6. botão                                         14. export 7. painel, abas, diálogo, confirmar 8. banner, toast, conquista, celebração, tooltip

- `h(tag, classe?, pai?, texto?) -> elemento`
- `par(p)` — resolve o pai de um componente (elemento, handle com .el, ou a raiz atual)
- `tick(fn(dt,t))` — registra uma animação; fn devolve false pra sair
- `E.UI.sfx(nome, opts)` — toca um som da engine se audio.js existir e E.UI.sound estiver ligado (nunca quebra)
- `pressable(el)` — estado .k-press confiável no toque (o :active do iOS falha) + pulinho .k-pop ao soltar
- `replay(el, classe)` — reinicia uma animação CSS de classe
- `srcIcon(icon) -> canvas-fonte | null` — aceita nome embutido ou um canvas de sprite
- `silhouette(canvas) -> canvas chapado em marrom (névoa da árvore, cartas trancadas)`
- `E.UI.icon(spriteCanvas|nome, size=24) -> <canvas> nítido (pixels ampliados por fator inteiro; o navegador só reduz)`
- `iconEl(icon, size) -> elemento` — canvas/nome embutido vira ícone pixelado; outro texto vira glifo; nó DOM passa direto
- `E.UI.defineIcon(nome, fn(P, PAL))` — acrescenta/troca um ícone 16x16 do conjunto embutido
- `E.UI.badge(el, n)` — bolinha vermelha com contador no canto (n=0/null tira; n=true vira só um ponto)
- `E.UI.mount(stage, {parent?}) -> root` — camada DOM por cima do canvas (é um <div>; ganha zone(), stage, layout())
- `root.zone('tl'|'tc'|'tr'|'ml'|'mr'|'bl'|'bc'|'br'|'dock') -> div âncora (flex) naquela posição`
- `root.layout()` — reavalia retrato/paisagem e a área de toque extra (chamado sozinho no resize do stage)
- `E.UI.spacer(pai)` — elemento elástico pra empurrar vizinhos numa zona flex (ex.: barra de baixo)
- `E.UI.roll(el, {fmt=U.fmt, speed=10, value=0}) -> {set(v, instant?), value, shown}` — número que rola até o alvo
- `E.UI.pill(root, {id, icon, label, small, value, big, sm, tone:'gold', roll=true, fmt}) -> {el, set(v, instant?), bump(), gain(txt, crit?), small(txt), value}`
- `set(v, instant?)` — número rola até v; texto entra direto
- `bump()` — pulinho (dinheiro entrou)
- `gain(txt, crit?)` — "+¥120" subindo da pílula
- `small(txt)` — troca o sufixo pequeno
- `E.UI.bar(root, {label, icon, endowed=0, tone, size:'sm'|'lg', w, fluid, ticks:[frac|{at,color}], near=.9, value}) -> {el, set(frac, label?, {left, value}?), tone(t), frac}`
- `set(frac 0..1, label?, {left:'faltam ¥X', value:'×1,35'}?)`
- `tone('gold'|'green'|'red'|'blue'|'sack'|'pink'|'fury'|'')` — troca a cor do preenchimento
- `E.UI.goal(root, {label, icon, endowed=.12, unit='¥', pct=false, ...bar}) -> {el, bar, set(tem, precisa, taxaPorSeg?)}` — barra de meta com "faltam X · ≈ 40s"
- `E.UI.goals(root) -> {el, add(opts) -> goal}` — coluna de barras de meta sempre visíveis
- `E.UI.button(root, {icon (canvas|nome|texto), iconSize, title, sub, onClick, progress, badge, state, tone:'primary'|'green'|'red'|'dark',`
- `pop()` — pulinho de confirmação (compra feita)
- `E.UI.flyer(root, {art (canvas|nó), title, sub, onClick}) -> botão vertical tipo panfleto (casa` — arte em cima, preço e barra embaixo)
- `E.UI.tabs(pai, {tabs:[{id,label,icon,badge}], value, onChange(id)}) -> {el, panes, set(id), pane(id) -> div, badge(id,n), value}`
- `E.UI.panel({title, icon, wide, full, bare, side:'right'|'left'|'bottom', tabs:[...], dim=true, dismiss=true, onClose, onOpen, cls})`
- `E.UI.dialog({kicker, title, text, art (canvas|nó), big:{label, value, prefix, icon}, rows:[{icon,label,value}],`
- `E.UI.confirm(texto, onYes, {title, yes='Sim', no='Agora não', onNo, danger}) -> diálogo com dois botões iguais`
- `E.UI.stat(pai, {icon, label, value}) -> {el, set(v)}` — linha "rótulo ........ valor" (placar, recordes)
- `E.UI.banner(texto, sub, {dur, level=2 (1 = toast, 2 = desce do topo, 3 = faixa de lado a lado), icon, tone:'gold', sound, onDone})`
- `E.UI.toast(texto, {icon, sub, dur=2.2, tone:'light'|'gold'|'bad'})` — fila de avisos curtos (3 visíveis, acima da barra de baixo)
- `E.UI.achievement(título, {sub, icon='paw', kicker='Conquista!', dur=3.4})` — cartão que entra pela direita com o selo carimbando (0,6 s)
- `E.UI.celebrate({title, sub, kicker, icon, iconSize=72, seal='novo!', dur=2.6, block=false, hint, onDone}) -> {el, close()}`
- `E.UI.tooltip(el, htmlFn|texto, {hold=2.4})` — dica; mouse = ao passar, toque = ao encostar (some sozinha), não bloqueia o clique
- `E.UI.missions(root, {slots=3, title='Missões', collapsed=false, onClaim(i), onTap(i)}) -> {el, set(i, {icon, text, frac, count, done, empty}), collapse(bool), collapsed}`
- `E.UI.album(pai, {items:[{id, name, icon, q (pergunta), a (resposta), unlocked, isNew}], cols=4, iconSize=36, onOpen(item)})`
- `unlock(id)` — vira a carta (pergunta -> resposta)
- `E.UI.row(pai, {icon, label, sub}) -> {el, ctl}` — linha de ajustes; pendure o controle em .ctl
- `E.UI.toggle(pai, {icon, iconOff, label, sub, value=false, onChange(v)}) -> {el, value, set(v, silent?)}; sem label devolve só a chave`
- `E.UI.slider(pai, {icon, label, sub, min=0, max=1, step=0, value, w, fmt(v)->texto, onChange(v), onEnd(v)}) -> {el, value, set(v, silent?)}`
- `E.UI.sparkline(pai, {w=64, h=14, max=60 (amostras), color, fill, size:'lg'}) -> {el, push(v), set(arr), last}`
- `E.UI.rate(root, {label='¥/s', icon, lines:[texto|fn()->texto], every=8, w=64, max=60}) -> {el, set(v), push(v), lines(arr), spark}`
- `E.UI.gauge(pai, {size=72, label, sweep=270 (graus), zones:[[de,ate]] (0..1, faixa verde), needle=false, over=false (texto branco, pra cima do canvas), tone (cor)})`
- `E.UI.tree(pai, {nodes:[{id,n,c,branch,pos:{x,y},req:[ids],size:0|1|2,desc,see,icon}], branches:{id:{name,color,icon}},`
- `owned(id)->bool, affordable(node)->bool, visible(node)->bool?, locked(node)->texto|null ("precisa` — Trator"), money()->n, progress(node)->0..1,
- `fmtCost(c)->texto, onBuy(node)->false cancela, onSelect(node), synergies:[{a,b}], center:{icon,label}, unit=96, zoomMin=.5, zoomMax=1.5, zoom=1, chips=true, plain})`
- `cheapest(branch?) -> nó aberto mais barato (de um ramo, ou de todos)`
- `focus(id|node, {zoom, instant})` — leva a câmera até um nó
- `select(id|node|null)` — abre/fecha o cartão de um nó
- `openAt(id?)` — recentra (no nó aberto mais barato, se não passar id); chamar ao abrir o painel
- `count() -> {have, total, can}`
- `E.UI.loadFont()` — pede a Zen Maru Gothic ao Google Fonts sem travar a página (offline o fallback do pixxel.css assume)
- `E.UI.icons() -> nomes do conjunto embutido`
- `E.UI.iconSrc(nome) -> canvas-fonte 16x16 (pra desenhar o mesmo ícone dentro do canvas do jogo)`
