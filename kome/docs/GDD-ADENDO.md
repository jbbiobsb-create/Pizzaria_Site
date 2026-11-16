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

## 8. Dia de trabalho e volta pra casa (aprovado; pode ficar pra v2 se pesar)
Regra de ouro: ir pra casa é PRÊMIO, nunca castigo. Não existe barra de cansaço que impede de cavar.
- Dia de 8-10 min com o sol cruzando o céu (E.Nature.sky com tod). Partida ≈ 8-10 dias.
- Pôr do sol = sino + **pagamento do dia**: resumo (cavado, melhor combo, achados) + bônus garantido (≈ 20-30 s de renda).
- Kome vai pra casa: cena curta e pulável (15-20 s na 1ª vez de cada novidade, 5 s depois) no quintal; janta, deita, dorme.
- De noite os ajudantes/máquinas continuam; ao acordar, cartão "enquanto você dormia" com o que renderam.
- **Hora extra opcional**: continuar cavando depois do sino, à noite, com faróis; onigiri vale 2x.
- **A casa cresce do zero ao luxo** (substitui/estende os estágios da casa do GDD §7):
  0 caminha de cachorro ao relento → 1 casinha de cachorro com tigela → 2 barraca/cabana com lampião → 3 terreno com placa VENDIDO →
  4 fundação → 5 estrutura de hinoki → 6 casa com telhado kawara e engawa → 7 jardim com lago de carpas → 8 onsen →
  9 (pós-final) mansão de luxo: segundo andar, garagem da Bagger, piscina de arroz, heliponto do shiba.
  Os estágios 0-2 são baratos e vêm nos primeiros minutos (dão meta cedo); os itens de quintal (cerejeira, tōrō, ponte,
  carpas, varal, churrasqueira) são compras pequenas entre os estágios, visíveis na cena de casa.
- Reconferir a economia: o bônus diário entra na simulação.
- Ordem de implementação: depois do jogo básico funcionar; antes de missões e álbum. Se o orçamento apertar, vira v2
  (o jogo básico fica com céu fixo e a casa só como meta ao fundo).

## 9. O arroz vai pra algum lugar (cadeia visível, sem gargalo) — pedido do dono
Nada de arroz jogado no chão sumindo. Todo arroz cavado VIAJA até um ponto de venda no pátio, e o ¥ nasce lá.
- **Feedback em dois tempos**: (1) na hora do golpe: grãos voam, contador de grãos sobe, som de cavar (resposta imediata);
  (2) o arroz faz um arco/viaja até o coletor e o "+¥" estoura NO COLETOR com som de moeda (atraso máx. ~0,6 s nas ferramentas
  de mão, pra não quebrar a sensação de causa e efeito). Com a câmera longe do pátio, um ícone do coletor na borda da tela
  pisca e mostra o +¥.
- **O destino evolui junto com a escada** (cada um é um sprite que fica no mundo e continua trabalhando):
  cesto de palha nas costas do Kome → saco no chão que enche e é amarrado → barraquinha da obaa-san (fila de clientes
  shibas levando onigiri) → kei-truck indo e voltando → silo com visor de nível → esteira do pé da montanha ao silo →
  fábrica de onigiri (chaminé soltando onigiri de fumaça) → caminhões de mineração descarregando na moega → esteira tronco →
  trem de arroz saindo cheio → (pós-final) navio no porto ao fundo.
- **Sem gargalo punitivo**: o transporte nunca trava a escavação nem perde arroz. A capacidade é só visual + bônus: melhorar o
  transporte (habilidades de Comércio) aumenta o preço de venda, e isso APARECE (mais caminhões, esteira mais rápida, fila maior).
- **Pilha de espera**: se o jogador cava mais rápido do que o transporte anima, forma-se um monte (E.Pile) ao lado do coletor
  que vai sendo consumido; monte grande = "ESTOQUE CHEIO: venda relâmpago x1,5" quando zera (recompensa, não castigo).
- Ajudantes e máquinas antigas entregam no mesmo lugar: dá pra ver a formiguinha de shibas carregando.

## 10. Tatuzão (TBM) — pedido do dono
Máquina de túnel (referência: docs/ref/tatuzao.webp), arquivo game/tbm.js (G.Tools.tbm). Primeira máquina do modo infinito,
depois da Bagger (a Bagger continua sendo o clímax da história). Fura na HORIZONTAL dentro da montanha em corte, deixando o túnel
revestido de anéis de concreto (desenho em `drawTunnel`, o heightfield não guarda túnel). Modo 'transport' em carretas SPMT laranjas
pra cena de compra. Ideia de uso: uma montanha especial em que ele fura de um lado ao outro.

## 11. KOME-OH: as máquinas se juntam num robô gigante — aprovado ("foda")
Topo do modo infinito, depois do tatuzão. TODAS as máquinas compradas viram peças de um robô gigante pilotado pelo Kome:
- pernas: trator + empilhadeira (ou pá de cabo); braços: escavadeira (esquerdo, garra/caçamba) e pá de cabo (direito);
  tronco: caminhão de mineração (a caçamba vira o peito/costas); peito: a roda da Bagger como escudo-broca giratório;
  punho-broca: a cabeça do tatuzão; cabeça: formato de cabeça de shiba com o chapéu de palha como capacete, Kome na cabine
  dentro da cabeça; olhos acendem.
- **Cena de transformação estilo anime (sentai)**: céu escurece, as máquinas da frota decolam/rodam até o centro, cada peça
  encaixa com faísca, close em cada junta, pose final com explosão colorida atrás, nome carimbado "KOME-OH!", fanfarra + taiko.
  É a celebração definitiva: paga a jogada inteira.
- Como cava: anda (pernas com IK, pisadas que tremem a tela e levantam poeira) e SOBE a montanha (a Bagger não sobe); soco
  (braço escavadeira) e broca (punho tatuzão); com combo cheio, **SOCO FOGUETE**: o punho voa, fura a montanha e abre uma
  cratera enorme, volta pro braço.
- Reaproveita o desenho das máquinas existentes (Rig com as peças como filhos), então o custo é o esqueleto bípede + a cena.
- Alternativa mais barata se precisar: Mecha-Shiba (robô com a cara do Kome, rabo que solta vapor).

## 12. Enxame de robozinhos — aprovado
Automação (não é pra pilotar): dezenas de robôs pequenos tipo aspirador, redondos, com orelhinhas de shiba e luzinha, que
carregam grão por grão em FILA da montanha até o coletor, desviando uns dos outros. Comprados em lotes (10, 25, 50...) num nó
da árvore de Equipe/Automação; quanto mais, maior a fila (feedback visual direto). Quando o estoque do coletor enche eles fazem
uma dancinha. Barato: sprite Pix pequeno + comportamento de fila; precisa de cache/batch pra desenhar 100+.
