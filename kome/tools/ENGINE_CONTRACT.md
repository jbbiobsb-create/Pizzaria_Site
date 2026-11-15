# Kome Engine v1.0 — contrato de arquitetura (documento de trabalho)

Este arquivo é o contrato que todos os módulos seguem. Quem implementa um módulo
segue as assinaturas daqui; pode ADICIONAR coisas, nunca renomear/remover o que está aqui.
No fim ele vira o `KOME_ENGINE.md` definitivo.

## Princípios

1. **Zero dependências, zero build.** JS clássico (sem ES modules, sem import/export), roda
   abrindo o HTML direto do disco (`file://`). Cada arquivo é um IIFE que estende o namespace:
   ```js
   (function(){ 'use strict';
     const E = (window.KomeEngine = window.KomeEngine || {});
     ...
     E.MinhaCoisa = MinhaCoisa;
   })();
   ```
2. **Ordem de carga** (cada módulo só pode depender dos anteriores, e deve conferir no topo:
   `if(!E.U) throw new Error('KomeEngine: carregue core.js antes de X.js')`):
   `core.js → pix.js → shiba.js → fx.js → terrain.js → rig.js → audio.js → cutscene.js → nature.js → ui.js`
   `audio.js` depende só de core. `ui.js` depende só de core (DOM).
3. **Coordenadas.** 1 px de arte = 1 unidade de mundo. Y cresce pra baixo; o chão é `y = 0`,
   pra cima é negativo. O Kome tem ~44 de altura. Tempo sempre em segundos. Ângulos em radianos.
4. **Cores**: aceitar sempre string hex (`'#E3BC62'`) e, onde fizer sentido, `[r,g,b,a]`.
5. **Estilo Kome** (o que faz "já sair estilo Kome"):
   - contorno marrom escuro `LINE = #3B2818` em tudo que é objeto; nada de contorno preto puro;
   - paleta quente e limitada (`E.PAL`), sombras = cor misturada com marrom (`U.mix(c,'#281408',.28)`),
     luzes = cor misturada com creme (`#FFFAE6`); nunca gradiente liso dentro de sprite;
   - formas arredondadas e gordinhas, proporção chibi; 2-3 tons por material (base, sombra, luz);
   - pixel art de verdade para sprites (`Pix` + `imageSmoothingEnabled=false`); máquinas gigantes
     são vetoriais articuladas (`Draw.*`), com o MESMO contorno e as mesmas cores chapadas;
   - nada de emoji nem asset externo no mundo do jogo (emoji só é tolerado em UI DOM; melhor ícone Pix);
   - ferramentas na pata, nunca na boca.
6. **Performance**: 60 fps num notebook mediano com 60 shibas, 2000 partículas e a Bagger na tela.
   Nada de alocar por frame em caminho quente; cachear sprites; `getImageData` nunca por frame.
7. **Robustez**: nenhum módulo pode quebrar se o áudio não existir, se `localStorage` falhar,
   ou se rodar sem interação do usuário. Sem `console.log` barulhento (prefixo `[kome]` se precisar).
8. **Documentação no código**: cada função pública tem um comentário de uma linha em pt-BR com a assinatura.
   Texto visível ao jogador em pt-BR.
9. **Demo por módulo**: cada módulo entrega `kome/demos/<modulo>.html` (carrega só os scripts que precisa,
   na ordem) que mostra tudo que o módulo faz, e é verificado com
   `node kome/tools/shot.js kome/demos/<modulo>.html /caminho/saida.png [--eval ...] [--wait ms]`
   (Chromium headless; o agente DEVE abrir o PNG com a ferramenta Read e olhar o resultado; arte feia = refazer).
   `shot.js` sai com código 1 se houver erro de página.

## Estrutura de pastas

```
kome/
  index.html            o jogo Kome no Japão
  engine/               a Kome Engine (reutilizável)
    core.js pix.js shiba.js fx.js terrain.js rig.js audio.js cutscene.js nature.js ui.js kome.css
  kome-engine.js        bundle (gerado por tools/build.js: concatena engine/*.js na ordem)
  game/                 o jogo: data.js machines.js bagger.js world.js game.js cutscenes.js game.css
  demos/                uma página por módulo + koi.html (lago de carpas) + gallery.html
  tools/                shot.js build.js
  KOME_ENGINE.md
```

## core.js

```js
E.version = '1.0.0'
E.U = {
  TAU, clamp(v,a,b), lerp(a,b,t), invLerp(a,b,v), remap(v,a,b,c,d), smooth(t) /*smoothstep 0..1*/,
  damp(a,b,k,dt) /* suavização exponencial independente de fps */, sign, dist(x0,y0,x1,y1),
  angLerp(a,b,t), rnd(a,b), irnd(a,b) /*inteiro inclusivo*/, pick(arr), chance(p), shuffle(arr),
  ease:{ lin, in, out, inOut, back, backIn, elastic, bounce, quadIn, quadOut, expoOut, sine },
  fmt(n) /* pt-BR: 1.234 / 12,3 mil / 4,56 mi / bi / tri / quatri / quinti / sexti / septi / octi / noni / deci */,
  fmtTime(s) /* '1h 02min' / '3min 20s' / '45s' */,
  hex(h)->[r,g,b,255], rgba(c,a)->'rgba(...)', css(c)->string, mix(a,b,t)->[r,g,b,255], mixCss(a,b,t)->'#rrggbb',
  shade(c,k) /* k<0 escurece com marrom, k>0 clareia com creme; devolve css */,
}
E.RNG(seed) -> r()  /* mulberry32; r.range(a,b), r.int(a,b), r.pick(arr), r.chance(p), r.fork(n) */
E.hash(n) -> 0..1   /* hash determinístico de número */
E.Noise = { n1(x,seed), n2(x,y,seed), fbm1(x,oct,seed), fbm2(x,y,oct,seed) }  /* value noise suave, 0..1 */
E.Emitter() -> { on(ev,fn)->off, once(ev,fn), emit(ev,...args), clear() }
E.Pool(make, reset) -> { get(), free(o), size }
E.Tween  /* gerenciador global simples */
  E.Tween.to(obj, {prop:valor,...}, dur, {ease, delay, onUpdate, onDone}) -> handle{cancel(),done}
  E.Tween.wait(dur, fn) -> handle
  E.Tween.update(dt)   /* o Loop chama sozinho; pode chamar na mão */
  E.Tween.killOf(obj), E.Tween.clear()
E.Stage(opts) -> stage
  /* opts: {canvas|parent, width=960, height=540, fit='contain'|'cover'|'none', maxDpr=2, bg, pixelated=false} */
  /* stage: {cv, g, w, h, dpr, scale, el (wrapper), toStage(evt)->{x,y}, resize(), begin() (setTransform dpr + limpa), on('resize',fn)} */
E.Input(stage) -> input
  /* ponteiro unificado mouse+touch (pointer events), sem menu de contexto, sem scroll no touch */
  /* input: {x,y (coords do stage), down, pressed, released (verdadeiros por 1 frame), inside, */
  /*         keys:{[code]:bool}, keyPressed(code), wheel, on('down'|'up'|'move'|'tap'|'key',fn), endFrame() } */
E.Loop({update(dt), render(alpha), fixed=0, maxDt=.05}) -> { start(), stop(), paused, timeScale, time, fps, frame }
  /* para quando a aba fica oculta e NÃO acumula dt gigante; chama E.Tween.update */
E.Scenes -> { add(nome, {enter(args), exit(), update(dt), render(g)}), go(nome,args), push(nome,args), pop(), current, update(dt), render(g) }
E.Save(key, {version=1, migrate(old)->novo, defaults()}) -> { data, load()->data, save(), saveSoon(ms=1500), clear(), exportStr(), importStr(s), offlineSeconds() }
  /* JSON em localStorage com try/catch; grava data.__t (timestamp) e data.__v; offlineSeconds() = agora - último save, clamp >=0 */
E.Timer  /* helpers: E.every(sec, fn)->handle com tick(dt); E.cooldown(sec)->{ready(), use(), tick(dt), frac} */
```

## pix.js

```js
E.LINE = [59,40,24,255]; E.LINE_CSS = '#3B2818'
E.PAL = { /* paleta oficial do Kome; todas strings hex. Usar estas chaves: */
  line, rice, riceS, riceD, gold, goldL, goldD, wood, woodD, woodL, red, redD, redL, steel, steelD, steelL,
  yel, yelD, yelL, ora, oraD, oraL, blk, blkL, gray, grayD, grayL, rust, rustD, glass, glassD,
  grass, grassD, grassL, leaf, leafD, sakura, sakuraD, water, waterD, waterL, sky, skyL, sand, stone, stoneD, stoneL,
  cream, ink, fur, furS, white, pink, bowl, bowlL, sack, sackD, mochi, mochiD, press, pressD, night, sun }
  /* manter os valores do rascunho (art.js C e as cores do game.js) onde já existem */
E.Pix(w,h) -> P   /* construtor de pixel art; todos os métodos encadeáveis */
  P.set(x,y,c) P.rect(x,y,w,h,c) P.ell(cx,cy,rx,ry,c) P.tri(...) P.poly(pts,c) P.line(x0,y0,x1,y1,wd,c)
  P.ring(cx,cy,r,wd,c) P.arc(cx,cy,r,a0,a1,wd,c) P.rrect(x,y,w,h,r,c)
  P.dither(x,y,w,h,c,[padrão='checker'|'25'|'75'|'hlines'|'vlines']) /* só pinta onde já existe pixel se opts.mask */
  P.shadeBelow(c,k) /* sombreia automaticamente a metade de baixo/direita dos pixels de cor c */
  P.bevel() /* luz em cima/esquerda e sombra embaixo/direita por dentro da silhueta, 1px */
  P.replace(c1,c2) P.mirrorX() P.stamp(outroP,x,y) P.mask(fn) P.get(x,y)
  P.canvas(outline=true, lineColor=E.LINE) -> HTMLCanvasElement (contorno 4-vizinhos como o do Kome)
E.Pix.outline(buf,w,h,c)
E.sprite(nome,w,h,fn(P),outline=true) -> canvas cacheado   ; E.sprite.clear(nome?)
E.drawSprite(g, cv, x, y, {ax=cv.width/2, ay=cv.height, rot=0, sx=1, sy=1, alpha=1, flip=false})
E.Draw = {  /* primitivas vetoriais no MUNDO com o mesmo contorno; lw do contorno = Draw.OL (padrão 2, em unidades de mundo) */
  OL: 2,
  beam(g, pts, w, col, {ol=Draw.OL, cap='round', hi}) /* polilinha grossa com contorno */,
  truss(g, a, b, depth, w, col, {taper=.6, bays, cross=false, ol}) /* viga treliçada (zigue-zague ou X) entre a=[x,y] e b */,
  lattice(g, x, y, w, h, cell, lw, col, {ol}) /* torre treliçada retangular com X em cada célula */,
  box(g, x, y, w, h, col, {top, shade, ol, r=0, rivets=false, panels=0, stripes}) /* caixa chapada com luz no topo e sombra embaixo */,
  poly(g, pts, col, {ol, shade}) , circle(g, x, y, r, col, {ol}) , ring(g,x,y,r,wd,col,{ol}),
  cable(g, a, b, {sag=0, lw=1.5, col=LINE}) /* cabo com barriga opcional */,
  wheel(g, x, y, r, rot, {tire, hub, spokes=6, tread=true}) /* pneu de máquina */,
  track(g, x, y, w, h, phase, {col, wheels}) /* esteira de trator com sapatas animadas por phase */,
  piston(g, a, b, w, {col, rod}) /* cilindro hidráulico que estica entre a e b */,
  window(g, x, y, w, h, {glare=true}) , light(g, x, y, r, col, on) /* luz com halo */,
  stairs(g, a, b, steps, {col}) , rail(g, a, b, {posts=6, h=6, col}) /* guarda-corpo */,
  sign(g, x, y, w, h, texto, {col, ink}) ,
  text(g, txt, x, y, {size=16, col='#FFFAEE', stroke=LINE_CSS, sw=4, align='center', font, weight=900, rot}) ,
  pattern(g, nome, base, c2, c3, {size=48, n=170, shape='grain'|'dots'|'hatch'}) -> CanvasPattern cacheado (textura de grãos de arroz),
  shadow(g, x, y, rx, ry, alpha=.18) /* sombra elíptica no chão */,
}
```

## shiba.js

O personagem é do usuário. **Não mude o desenho das poses existentes**; porte o `ShibaPX` do rascunho
(`engine.js` original) e só adicione.

```js
E.ShibaPX   /* igual ao rascunho: {W:48,H:44,frame(cv,mode,t,pal),still(pal,mode,scale)} */
E.PALS = { kome, goma, kuro, shiro, + novas: aka (vermelho), cha (marrom), yuki (branco gelo), sakura? } /* formato {h,g,o,c,k,n,p} */
E.SHIBA_POSES -> array com todos os nomes de pose
  /* existentes: sit wag sign lie stand walk run jump dig sniff surprise dizzy sword swordrun windup slash eat pant
     roll bow stretch scratch yawn howl sleep dance dance2 shake */
  /* novas (mesmo estilo): drive (sentado, patas no volante, quica), push (empurrando, corpo inclinado),
     carry (andando com as patas da frente levantadas segurando algo em cima da cabeça), cheer (pulinho, patas pra cima),
     point (apontando pra frente), think (pata no queixo), gasp (choque: olho arregalado, orelha pra trás, pelo arrepiado),
     cry (lágrima), proud (peito estufado, olho fechado feliz), climb (subindo escada, de costas/perfil), wave */
E.drawShiba(g, x, y, pose, t, {face=1, scale=1, squash=0, rot=0, pal='kome', hat=true, mouth, eyes, alpha=1, shadow=true})
  /* pés em (x,y). Precisa aguentar 60 shibas/frame: cache de frames por (pal,pose,quantização de t, opções)
     ou buffer Uint32/Uint8Clamped reaproveitado. Sem createImageData por chamada. */
E.drawShibaHead(g, x, y, t, {scale, expr:'happy'|'shock'|'determined'|'cry'|'smug'|'sleepy'|'normal', pal, face, hat})
  /* close de rosto pra cutscene (estilo Dave the Diver): cabeça grande, centrada em (x,y) */
E.PAW = {x:9,y:-6}; E.MOUTH = {x:11,y:-18}; E.HEAD = {x:10,y:-26}   /* âncoras locais (sem escala, face=1) */
E.shibaAnchor(pose, t, nome:'paw'|'mouth'|'head'|'back'|'hatTop') -> {x,y}
E.Actor(opts) -> actor  /* um shiba com estado: {x,y,face,pose,t,pal,scale,squash,rot,vx,vy, hold (sprite na pata), say(texto,seg), update(dt), draw(g)} */
```

## fx.js

```js
E.Camera(vw, vh) -> cam
  /* campos: x,y,z,tz,vw,vh, shake (legado, px), trauma (0..1, shake = trauma² ), bounds{x0,x1,y0,y1}|null */
  /* follow(tx,ty,dt,k=6), zoomTo(z, k?), fit(x0,y0,x1,y1,margin) (ajusta tz/alvo pra caber), apply(g), unapply?,
     toWorld(sx,sy)->{x,y}, toScreen(wx,wy)->{x,y}, view()->{x0,x1,y0,y1}, update(dt), kick(dx,dy), addTrauma(v),
     parallax(g, fator, fn) /* desenha fn com a câmera aplicada em fração (fundos) */ */
E.Particles(max=1200) -> ps
  /* add(p): campos {x,y,vx,vy,g,life,decay,r,vr,w,h,c,shape,land,drag,grow,fade,onLand(p)} */
  /* shapes: grain, star, puff, rect, spark, petal, leaf, ring, smoke, drop, dot, coin, text(p.txt) */
  /* update(dt, floorFn?), draw(g), clear(), count; pool interno, sem splice em caminho quente */
  /* helpers: ps.burst(x,y,n,{c,speed,shape,...}), ps.spray(x,y,n,{dir,spread,speed,...}), ps.puff(x,y,n,size,{c}) */
E.Floaters() -> { add(x,y,txt,{c,size,life,vy,stroke,pop}), update(dt), draw(g, cam) }  /* textos "+¥123" que sobem */
E.ScreenFX(stage) -> fx
  /* flash(cor,dur), fade(to,dur,cb), letterbox(on, h=60), vignette(k), speedlines(on,{dir,col}), hitstop(seg) (devolve escala de tempo),
     confetti(n), shock(x,y) (anel), iris(open,x,y,dur,cb), update(dt), draw(g) (por cima de tudo, coords de tela), timeScale */
```

## terrain.js

```js
E.Heap(opts) -> heap   /* montanha granular em colunas (heightfield) */
  /* opts: {width, colW=4, repose=3.6 (máx desnível por coluna), relaxIters=2} */
  /* heap.n, heap.colW, heap.h (Float32Array alturas atuais), heap.h0 (alturas originais), heap.total, */
  /* generate(fn(x)->altura) | fromArray(arr), surf(x)->y (negativo), height(x), col(x), */
  /* dig(cx, area, rad, {pow=1, onTake(i, take, yTopo)}) -> {got, val, gold, hard}  (perfil parabólico como no rascunho), */
  /* add(x, area, rad=colW*2) (deposita: pilha que cresce), relax(dt) (avalanche), remaining() (área), frac() (0..1 restante), */
  /* layers: setLayers([{id,name,top (fração da altura original),hard,val,col,col2,col3}]) ; matAt(i,y) */
  /* pockets: addPocket({x,y,r,mult,kind}) ; pocketAt(x,y) ; lista heap.pockets */
  /* draw(g, view, time, {outline=true, sparkle=true}) corte em camadas com textura de grãos, bolsões dourados, sombra na base, contorno */
  /* peak()->{x,h}, slope(x), serialize()->array compacto, deserialize(arr) */
E.Pile(opts) -> pile   /* pilha pequena de grãos que assenta (caçamba de caminhão, carrinho, silo): add(v), take(v), frac, draw(g,x,y,w,hmax) */
E.Grains(particles, heap) -> { emit(x,y,n,{vx,vy,gold,deposit:false}), ... }  /* grãos que voam e, se deposit, somam na pilha onde pousam */
```

## rig.js

```js
E.Rig() -> rig   /* esqueleto hierárquico de peças para máquinas articuladas */
  /* rig.part(nome, {parent, x, y, rot=0, z=0, draw(g, part, rig, t), sprite, ax, ay, sx=1, sy=1, visible=true}) -> part */
  /* rig.set(nome,{rot,x,y,...}), rig.get(nome), rig.update(dt), rig.draw(g, x, y, {face=1, scale=1, rot=0, t}), */
  /* rig.world(nome, lx=0, ly=0) -> {x,y,rot} posição no mundo depois do último draw/solve; rig.solve(x,y,face,scale,rot) calcula sem desenhar */
E.ik2(ax, ay, tx, ty, L1, L2, bend=1) -> {ex,ey, bx,by, a1,a2, reach} /* IK de dois ossos (braço de escavadeira) */
E.Conveyor(pts, {w=10, speed=60, col, items=true}) -> { update(dt), draw(g, t), put(v), end()->{x,y}, running, onDrop(fn) }  /* esteira com roletes e montinhos de carga andando */
E.Spring(v, {k=120, d=14}) -> { x, v, target, update(dt) }   /* mola pra balanço de carroceria, cabine etc. */
E.Vehicle helpers: E.suspension(...)? opcional
```

## audio.js

```js
E.Audio = { init() (chamar num gesto do usuário; idempotente), ctx, master, muted (get/set), volume (get/set 0..1),
            sfxVol, musicVol, unlock(), suspend(), resume() }
E.Sfx  /* compatível com o rascunho: init, muted, tone(f,d,type,v,slide,delay), noise(d,f,v,q,delay), gate(k,ms),
          dig(pitch,heavy), combo(n), coin(), gold(), buy(), big(), shake(), pop() */
  + E.Sfx.play(nome, {pitch=1, vol=1, pan=0, delay=0}) ; E.Sfx.define(nome, fn(api,opts)) ; E.Sfx.names()
  /* sons prontos (mínimo): paw, hashi, bowl, shovel, cart, thud, clank, metal, hydraulic, horn, engineStart, beep,
     coin, coins, gold, buy, unlock, levelup, fanfare, pop, sack, shake, whoosh, splash, drip, stomp, rumble, error, click, hover,
     taiko, bell, chime, bark, bark2, whine, yip, typing, crash, sparkle */
E.Loops  /* sons contínuos de motor: E.Loops.start(nome,{vol,rate}) -> handle{set({vol,rate}), stop(fade)} ;
            nomes: diesel, tractor, hydraulic, truck, bagger (gemido metálico lento + clanks), conveyor, wind, water, cicadas, rain */
E.Music  /* trilha generativa que não cansa: escalas japonesas (yo, in, hirajoshi), koto (Karplus-Strong), shakuhachi, taiko, baixo */
  /* E.Music.start(tema='campo'|'trabalho'|'maquinas'|'bagger'|'noite'|'festa'|'calma'), stop(fade), setIntensity(0..1),
     setTheme(tema, crossfade=2), playing, bpm ; nunca repete igual: frases geradas por semente + variação */
```

## cutscene.js

```js
E.Cutscene  /* pipeline de cutscenes declarativo estilo Dave the Diver */
  E.Cutscene.play(def, {stage, onDone, skippable=true, sfx=true}) -> player{ skip(), next(), done }
  E.Cutscene.update(dt) ; E.Cutscene.draw(g) ; E.Cutscene.active
  /* def = { id, letterbox=true, shots:[ shot, ... ] }
     shot = { dur (seg) | hold:true (espera clique), bg: cor | fn(g,t,ctx), cam:{from:{x,y,z}, to:{x,y,z}, ease, shake},
              layers:[fn(g,t,ctx)], actors:[{id, pal, pose, x, y, scale, face, to:{x,y,dur,ease}, expr, hat, enter:'pop'|'slide'|'drop'|'none', at}],
              close:{actor|pal, expr, side:'left'|'right'|'center', speedlines, bg}   // close dramático com linhas de velocidade
              caption:{text, style:'box'|'title'|'shout'|'whisper'|'card'|'price', at, typing=true, speaker},
              title:{big, small, color, stamp:true}                                 // cartão de título com freeze-frame
              sfx:[{name, at, opts}], music:{theme|stop}, fx:[{type:'flash'|'shake'|'zoomPunch'|'speedlines'|'confetti'|'iris'|'hitstop', at, ...}],
              transition:'cut'|'smash'|'fade'|'wipe'|'iris'|'flash', onEnter(ctx), onExit(ctx) }
     ctx = { t, shotT, W, H, g, actor(id), rnd, data } ; clique avança (pula a digitação primeiro), ESC/segurar pula tudo */
  E.Cutscene.define(id, def) ; E.Cutscene.run(id, opts)
```

## nature.js

Kit de cenário japonês, tudo procedural e no estilo Kome. Cada função desenha em coordenadas de mundo com
os pés/base em (x,y) e aceita `t` para animar.

```js
E.Nature = {
  sky(g, w, h, {tod=0..1 (0 manhã, .5 tarde, .75 pôr do sol, 1 noite), stars=true}) , sun(g,x,y,r,{tod}) , moon(g,x,y,r),
  clouds(seed) -> { update(dt), draw(g, w, h, camX) } , fuji(g, x, y, s, {snow=true, alpha}) ,
  hills(g, w, baseY, camX, {col, amp, freq, parallax, seed}) , ground(g, x0, x1, y, {col, tufts=true, depth}),
  tree(g, x, y, {kind:'pine'|'sakura'|'maple'|'bamboo'|'bonsai'|'round', s=1, seed, t (vento)}) , bush(g,x,y,{...}), grassTuft, flower(g,x,y,{kind,seed,t}),
  rock(g,x,y,{w,h,seed,moss}) , torii(g,x,y,s) , lantern(g,x,y,s,{lit,t}) (tōrō de pedra) , bridge(g,x,y,w,{arch}) (ponte vermelha arqueada),
  fence(g,x0,x1,y,{kind:'bamboo'|'wood'}) , paddy(g,x,y,w,h,{t}) (arrozal alagado com mudas) , stall(g,x,y,{...}) (barraquinha) ,
  house(g, x, y, {stage:0..5, s=1, t, lit}) /* casa japonesa (minka/kominka) em estágios: 0 terreno com placa, 1 fundação, 2 estrutura de madeira,
     3 paredes+telhado, 4 casa pronta com engawa e shoji, 5 mansão com segundo andar */ ,
  koinobori(g,x,y,{t}) , windchime, sakuraPetals(particles, view, dt, rate), fireflies(...), birds(seed)->{update,draw}, butterflies,
}
E.Pond(opts) -> pond  /* lago: {x,y,w,h, seed} ; update(dt) ; draw(g,t) (água com borda de pedras, reflexo, ondinhas, vitórias-régias) ;
                        ripple(x,y) ; contains(x,y) ; feed(x,y) (carpas vêm comer) */
E.Koi(pond, n, {seed}) -> { list, update(dt), draw(g,t) }  /* carpas (kohaku, sanke, showa, ogon, asagi...) nadando com corpo ondulando, vistas de cima;
                        fogem do toque, seguem comida, nunca saem do lago */
```

## ui.js + kome.css

HUD em DOM com a cara do rascunho (pílulas creme, borda `#2a1a10`, sombra dura de 3-4px, fonte Zen Maru Gothic com fallback).

```js
E.UI = { mount(stage) -> root (camada DOM por cima do canvas, escala junto com o stage),
  pill(root,{id,icon,label,small}) -> {el,set(v),bump()} , bar(root,{label}) -> {el,set(frac,label)} ,
  button(root,{icon (canvas|texto), title, sub, onClick, progress}) -> {el,set({title,sub,progress,state:'can'|'off'|''})} ,
  panel({title, wide, onClose}) -> {el, body, open(), close(), isOpen} , banner(texto, sub, {dur}) , toast(texto,{icon,dur}) ,
  tooltip(el, htmlFn) , icon(spriteCanvas, size) -> <canvas> pixelado , confirm(texto, onYes) , tabs(...) ,
  fmt = E.U.fmt }
```
`kome.css` contém todas as classes (prefixo `.k-`) e variáveis (`--k-ink`, `--k-cream`, `--k-gold`, ...). Mobile: botões ≥ 44px,
`touch-action:none` no stage, layout que funciona em 960x540 escalado e em retrato estreito.

## Convenções pra máquinas (game/machines.js, game/bagger.js)

Cada máquina é `{ id, w, h, draw(g, x, y, state), anchors, update?(state,dt) }` onde `state` tem pelo menos
`{t, face, digging, power (0..1), target:{x,y}, wheelA, armT, tilt, load (0..1), lights}` e `anchors` dá pontos
locais (`seat`, `cab`, `bucket`, `dump`, `exhaust`). `draw` desenha com os pés/esteiras em (x,y), virado pra `face`.
Sempre com shibas minúsculos (`scale` .2–.3) e/ou pick-up quando a graça é a escala.

## gfx.js (pós-processamento na placa de vídeo, opcional)

Carrega depois de fx.js. O mundo continua sendo desenhado em canvas 2D; `Gfx` pega o canvas pronto como textura e
aplica um passe WebGL por cima. Se WebGL não existir, tudo vira no-op e o jogo roda igual (só sem os efeitos).

```js
E.Gfx(stage, opts) -> gfx | null
  /* opts: {bloom=.6, bloomThreshold=.75, vignette=.25, grade:{tint,contrast,saturation}, grain=0, quality:'low'|'med'|'high'} */
  /* gfx.enabled, gfx.set(opts), gfx.render(time) (chamar no fim do frame), gfx.resize(),
     gfx.lights: add({x,y,r,col,intensity}) em coords de tela -> luz aditiva com halo (faróis, lanternas, solda, ouro),
     gfx.heat(x,y,w,h,amount) (distorção de calor: escapamento, onsen), gfx.water(rect,{t}) (ondulação/reflexo),
     gfx.grade(tod) (correção de cor por hora do dia), gfx.shockwave(x,y) (anel de distorção em impacto grande),
     gfx.godrays(x,y,amount) */
```
Regras: efeito sutil por padrão; opção de qualidade e de desligar no menu; nunca depender dele pra legibilidade.
