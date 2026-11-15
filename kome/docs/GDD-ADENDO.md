# Adendo ao GDD (pedidos do dono depois do v4) — tem prioridade sobre o GDD.md

## 1. Britadeira (martelete de arrancar calçada) entra na escada
Fica entre o Carrinho de Mão e o Trator: é "a primeira parte industrial". A escada passa a ter 13 degraus:
pata, hashi, tigela, pá, duas pás, carrinho, **britadeira**, trator, empilhadeira, escavadeira, pá de cabo, caminhão, Bagger 293.

```js
{id:'britadeira', name:'Britadeira', cost:55000, A:210, r:26, pow:3.6, zoom:1.28, spd:230, reach:26, seat:'paw', kind:'jack',
 act:'Kome em pé nas patas de trás segurando a britadeira com as duas patas; o corpo inteiro vibra, bochecha e orelha tremendo, chapéu pulando; ponteira martela e solta lascas e poeira; cabo/mangueira até um compressorzinho amarelo que vem atrás pulando'}
```
- Verbo próprio: fura pra BAIXO (poço estreito e fundo) em vez de comer de lado; é a primeira ferramenta que racha o arroz
  prensado a 100% e lasca o mochi (k≈0,45). Rachaduras visíveis se espalham antes do bloco soltar (antecipação) e aí cai um
  pedação de uma vez (recompensa em rajada).
- Som: tatatatata grave com pitch subindo no combo; compressor em loop.
- Feedback de poder: shake de alta frequência e baixa amplitude, números de ¥ tremendo.
- Depois do trator, a britadeira vira ferramenta dos ajudantes (troca visual: shibas de capacete com mini-britadeira).
- Reequilibrar: trator sobe pra ~¥110k; conferir no sim que o intervalo carrinho→britadeira→trator fica entre 60 e 150 s.

## 2. Textura do arroz
Aprovada a direção "dá pra ver os grãos" (terrain.js). Manter.

## 3. Orçamento curto: prioridade é o JOGO
Cortados/adiados por enquanto: gfx.js (pós-processamento WebGL), demo do lago de carpas, revisões separadas por módulo.

## 4. Carrinho de mão: a trombada (aprovado pelo dono)
- O Kome pega embalo e bate o carrinho de frente no barranco (aríete). A batida derruba um pedaço do barranco: o arroz de
  cima desliza em avalanche pra DENTRO da caçamba (usar heap.digRect/dig na face + grãos caindo com E.Grains na caçamba),
  enchendo de uma vez. Pequeno hit-stop + shake na batida, Kome quica pra trás, chapéu pula.
- Ele recua e despeja pra TRÁS, num montinho que os ajudantes/barraquinha recolhem; o ¥ cai no despejo.
- De vez em quando (≈1 em 8) a avalanche é grande demais e enterra o Kome até o chapéu por meio segundo (ele sai sacudindo):
  conta como "carga coroada" com bônus pequeno.

## 5. Escala no cenário: "a régua do mundo" (pedido do dono)
O jogador tem que SENTIR que cada ferramenta nova é maior. Regras:
- **Objetos de referência fixos no pé da montanha**, sempre os mesmos, que a câmera vai deixando pequenos a cada degrau:
  a casinha de cachorro do Kome (≈ altura dele) → barraquinha → cerejeira → torii → poste de luz com fios → casa de dois
  andares da vila → torre de transmissão → prédio/fábrica de onigiri de 6 andares → Monte Fuji ao fundo.
  A cada zoom-out, o objeto que parecia grande vira miniatura e um maior entra no quadro.
- **As ferramentas antigas ficam estacionadas/trabalhando ao lado da nova**: o trator que parecia enorme fica do tamanho do
  pneu do caminhão; o caminhão cabe embaixo da lança da Bagger. É a comparação mais forte, porque o jogador já usou cada uma.
- **Vida em escala**: shibas minúsculos, pick-up, kei-truck, passarinhos, trem passando ao fundo, sempre perto da máquina atual.
- **Cartão "tamanho real" na compra**: silhuetas lado a lado (Kome, ferramenta anterior, ferramenta nova) com números
  ("96 m de altura · 14.200 t · 1 shiba") por 2 s, antes de devolver o controle.
- **Sombra**: máquinas gigantes projetam sombra que cobre casas e árvores quando passam.

## 6. O momento da compra (banho de dopamina) — escala cresce com o preço
Toda compra de ferramenta: câmera trava no Kome → caixa/caminhão de entrega → olhos brilhando → zoom-out de 1,5 s revelando
a ferramenta e os objetos de referência encolhendo → nome batendo na tela com som próprio → 3 s de "modo estreia" (x2 de
velocidade, grãos dourados) pra pessoa sentir o poder na hora.

**Bagger 293 (a mais cara do jogo): a maior celebração.**
1. Antecipação longa: as 3 partes foram montadas no pátio ao longo de minutos (o jogador viu crescer). Ao pagar a última,
   tudo para: música corta, tela escurece nas bordas, 1 s de silêncio.
2. Cutscene `bagger_reveal`: Kome sobe a escada sem fim → close do capacete por cima do chapéu → pata na alavanca.
3. BUZINA grave + as luzes acendem em cascata da esteira até o topo dos mastros → a roda começa a girar devagar e acelera.
4. Zoom-out contínuo de 3 s (o maior do jogo) com a vila, o prédio e os caminhões virando formiga; hit-stop e flash no fim.
5. Título carimbado "BAGGER 293" + "96 m. 14.200 t. 1 shiba." + confete, fogos, todos os shibas ajudantes pulando (pose cheer),
   taiko e fanfarra; o contador de ¥/s dá um salto visível com o número antigo riscado.
6. Primeira mordida garantida "MORDIDA PERFEITA" com chuva de grãos dourados e a tela tremendo: o jogador segura o clique e
   vê a montanha, que mal arranhou em uma hora, perder um pedaço enorme em segundos.
7. Conquista + entrada no álbum + a barra da montanha, que estava parada, despenca visivelmente.

## 7. Achados enterrados (cosméticos) — pedido do dono
- A montanha tem ~24 "achados" enterrados em posições fixas pela semente (profundidades crescentes; os melhores no mochi e no núcleo).
  Com a habilidade "Faro de Shiba" eles brilham de leve através do arroz. Ao cavar perto: o Kome fareja (pose sniff), sai um baú/objeto
  quicando, 1-2 s de suspense (treme, brilha) e abre com fanfarra: "ACHOU: Óculos de Sol!". Recompensa variável com antecipação.
- Tipos (todos só visuais, trocáveis num "Guarda-roupa do Kome" dentro do álbum):
  - **Chapéus** (desenhados na âncora `hatTop` do shiba.js, por cima/no lugar do kasa): capacete de obra, boné, coroa, chapéu de
    chef, de pirata, de festa, tigela de ramen virada, cone de trânsito, laço.
  - **Óculos/rosto** (âncora `eye`): óculos de sol, monóculo, óculos de natação, máscara de ladrão, bigode.
  - **Costas** (âncora `back`): capa de super-herói que balança com a velocidade, mochila, asas, cachecol, bandeirinha.
  - **Cores do Kome**: as paletas que já existem em E.PALS (goma, kuro, shiro, aka, cha, yuki, sakura, matcha, kin, sumi).
  - **Pinturas de máquina**: trator rosa, escavadeira de bolinhas, Bagger dourada, caminhão com chamas (troca de cores na criação).
  - **Achados bobos de coleção** (vão pro álbum com uma frase): bola de tênis, osso, chinelo, controle remoto, meia sem par.
- Os ajudantes podem herdar o que o Kome não está usando. O que ele veste aparece em todas as cutscenes.
- Barato de fazer: sprites Pix pequenos + âncoras que já existem. Ordem: cores (grátis) → chapéus → óculos → capas → pinturas.
