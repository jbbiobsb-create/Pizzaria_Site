# Pesquisa de UX, UI e acessibilidade (base do `ux-guia.md`)
Feita em 2026-11-18. Régua: pessoa de 50 anos, lê com dificuldade, pouca paciência. Celular deitado + PC.
Marcação: **[lido]** = página aberta e lida nesta pesquisa · **[não lido]** = a página bloqueou a leitura automática
(o valor citado é o conhecido da fonte; conferir no link antes de tratar como lei).

Conversão usada: 1 px de CSS = 1/96 pol = 0,265 mm. Então 10 mm ≈ 38 px · 13 mm ≈ 49 px · 15 mm ≈ 57 px.

## 1. Números que mandam (resumo)
| Assunto | Valor | De onde |
|---|---|---|
| Alvo de toque, piso absoluto | 24×24 px CSS (ou círculo de 24 px sem encostar em outro alvo) | WCAG 2.5.8 (AA) |
| Alvo de toque, nível melhor | 44×44 px CSS | WCAG 2.5.5 (AAA) |
| Alvo de toque em JOGO no celular | 15×15 mm ≈ 57 px CSS | XAG 107 |
| Alvo de toque, tamanho físico | mínimo 1×1 cm; MAIOR pra botão principal e pra idoso; ~2 mm entre alvos | NN/g |
| Idoso escolhendo o menor alvo que consegue tocar | mediana 13 mm (jovem: 4 mm) | Franz et al. 2019 (via busca) |
| Texto padrão, celular e PC | 18 px (altura do corpo da letra; no celular = 18 px a 100 DPI, cresce com a densidade) | XAG 101 |
| Escala de letra do jogador | até 200% sem perder conteúdo; rolagem só num sentido | XAG 101 |
| Texto longo | linha ≤ 80 letras, entrelinha ≥ 1,5, frase normal (não TUDO MAIÚSCULO), alinhado à esquerda | XAG 101 |
| Contraste texto normal | ≥ 4,5:1 | WCAG 1.4.3, XAG 102 |
| Contraste texto grande (≥ 24 px, ou ≥ 18,5 px negrito) | ≥ 3:1 | WCAG 1.4.3 |
| Contraste de ícone, borda de botão, item travado | ≥ 3:1 | WCAG 1.4.11, XAG 102 |
| Modo alto contraste | ≥ 7:1 em tudo | XAG 102 |
| Piscadas | no máximo 3 por segundo (vale pra vermelho também); área pequena escapa | WCAG 2.3.1 |
| Segurar botão | evitar; se existir, dar alternativa de toque/alternar; gesto longo < 3 s | XAG 107, GAG |

## 2. O que cada fonte diz (só o que serve aqui)

### Game Accessibility Guidelines — básico **[lido]**
https://gameaccessibilityguidelines.com/basic/
- Elementos de toque grandes e bem separados, ainda mais em tela pequena.
- Controles o mais simples possível, ou um modo mais simples. Controles remapeáveis.
- Linguagem simples e clara; formatação simples; letra padrão fácil de ler; alto contraste.
- Texto avança no ritmo do jogador (nada some sozinho). Tutorial interativo (fazendo, não lendo).
- Começar a jogar sem atravessar vários níveis de menu.
- Nenhuma informação essencial só por cor fixa, nem só por som.
- Volumes separados (efeitos / música). Liga-desliga de vibração.
- Todo ajuste fica salvo. Mostrar os recursos de acessibilidade dentro do jogo.
- Evitar imagem tremeluzente e padrão repetitivo.

### Game Accessibility Guidelines — intermediário **[lido]**
https://gameaccessibilityguidelines.com/intermediate/
- Evitar / dar alternativa a botão que precisa ficar segurado. Evitar toque repetido rápido.
- Não exigir ação simultânea (clicar+arrastar, deslizar). Alvo que pede precisão fica PARADO.
- Lembrete do objetivo atual e dos controles durante o jogo; dicas no contexto.
- Deixar claro o que é clicável. Instrução nunca só em texto: reforçar com desenho.
- Destacar as palavras importantes. Opção de desligar movimento de fundo.
- Sons diferentes pra eventos diferentes. Legenda/visual pra som importante.
- Salvar sozinho + salvar manual. Interface redimensionável.

### GAG — "não segurar botão" **[lido]**
https://gameaccessibilityguidelines.com/avoid-provide-alternatives-to-requiring-buttons-to-be-held-down/
- Segurar exige muito mais da mão que tocar. Melhor solução: um ajuste que deixa o jogador escolher
  entre segurar, alternar (toca liga / toca desliga) ou automático.

### GAG — "nunca só cor" **[lido]**
https://gameaccessibilityguidelines.com/ensure-no-essential-information-is-conveyed-by-a-fixed-colour-alone/
- 8–10% dos homens confundem vermelho e verde (os dois viram um marrom-esverdeado). Vermelho parece mais escuro.
- Juntar à cor: palavra, símbolo, forma ou textura. Isso ajuda todo mundo.
- Par seguro pra dois estados: laranja × azul, com diferença de claro/escuro.
- Testar com simulador de daltonismo na severidade máxima.

### Xbox Accessibility Guidelines 101 — texto **[lido]**
https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/101
- Tamanho mínimo padrão: PC 18 px em 1080p; celular 18 px a 100 DPI (escala com a densidade).
  Zoom do sistema NÃO conta como solução pra letra pequena.
- Texto dentro de ícone também respeita o mínimo; ícone cresce junto com a letra.
- Jogador aumenta a letra até 200% sem perder conteúdo; título continua diferente do corpo.
- Opção de fonte sem serifa e não estilizada. Bloco de texto: linha ≤ 80 letras, entrelinha ≥ 1,5.
- Frase em maiúscula/minúscula normal (rótulo de 1–2 palavras pode ser maiúsculo). Não centralizar bloco de texto.

### XAG 102 — contraste **[lido]**
https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/102
- 4,5:1 texto normal · 3:1 texto grande · 3:1 texto de item travado · 7:1 no modo alto contraste.
- Texto em cima de fundo que varia: medir no ponto de PIOR contraste; usar fundo sólido ou contorno atrás do texto.
- Não depender só de cor. Texto não deve estar "pintado" dentro de imagem.

### XAG 107 — entrada / toque **[lido]**
https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/107
- Alvo de toque no celular: 15×15 mm (59 px a 100 DPI). Espaço morto em volta de cada alvo.
- Evitar: segurar por muito tempo, arrastar/deslizar, toque rápido repetido, dois dedos, sacudir o aparelho.
  Se existir, dar alternativa (alternar, automático).
- Ação dispara ao SOLTAR o dedo (dá pra desistir arrastando pra fora). Sem cancelar = precisa de "desfazer".
- Tudo que dá pra fazer no PC tem que dar só com teclado. Controles remapeáveis, e a dica na tela mostra a tecla nova.
- Funcionar em pé e deitado. Tamanho e posição dos controles de toque ajustáveis, com layouts prontos.
- Controle mais simples como opção (ex.: ação automática tira um botão da tela).

### XAG 117 — movimento e distração **[lido]**
https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117
- Coisa que pisca, rola ou se mexe em tela com texto: tem que dar pra pausar, esconder ou desligar.
- Tremor de câmera, balanço e borrão: evitar ou ter liga-desliga (ideal: controle de 0 a 100%).
- Fundo opaco atrás do texto quando tem movimento atrás.

### WCAG 2.2 **[lido]**
- 2.5.8 Tamanho do alvo (AA): 24×24 px CSS. 2.5.5 (AAA): 44×44.
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- 1.4.3 Contraste: 4,5:1; texto grande (18 pt ≈ 24 px, ou 14 pt negrito ≈ 18,5 px) 3:1. 1.4.11: ícone e borda de controle 3:1.
  https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- 2.3.1 Três piscadas: no máximo 3 por segundo. "Piscada" = sobe e desce ≥ 10% de luminância. Vermelho saturado conta à parte.
  https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- 2.3.3 Animação por interação: tem que dar pra desligar movimento não essencial; respeitar `prefers-reduced-motion`.
  Mudança só de cor/opacidade não conta como movimento; coisa deslizando, crescendo e paralaxe contam.
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- **[não lido nesta sessão, texto conhecido da norma]** 1.4.10 Refluxo: sem rolagem em dois sentidos.
  1.4.12 Espaçamento: aguentar entrelinha 1,5 e espaço entre letras 0,12× sem cortar texto.
  2.2.1 Tempo ajustável: nada de prazo pra ler. 2.5.7: arrastar tem que ter alternativa de toque simples.
  https://www.w3.org/TR/WCAG22/

### Apple HIG e Material Design **[não lido — as páginas não abriram na leitura automática]**
- Apple: alvo mínimo 44×44 pt. https://developer.apple.com/design/human-interface-guidelines/accessibility
- Material: alvo mínimo 48×48 dp, 8 dp entre alvos. https://m3.material.io/foundations/designing/structure
- Os dois são piso de APP comum. Pra jogo e pra idoso, valem os 15 mm da XAG.

### NN/g — tamanho de alvo **[lido]**
https://www.nngroup.com/articles/touch-target-size/
- Mínimo físico 1×1 cm. Ponta do dedo: 1,6–2 cm; polegar: ~2,5 cm.
- Espaço não salva alvo pequeno: primeiro o tamanho, depois ~2 mm de folga.
- Fazer MAIOR: botão principal, idoso, tela com poucos elementos.

### NN/g — usuários mais velhos **[lido]**
https://www.nngroup.com/articles/usability-for-senior-citizens/
- Letra miúda e texto claro/apagado são a barreira nº 1, principalmente no celular.
- Botão e link pequenos demais. Interface que não perdoa erro.
- Mensagem de erro: aparecer onde a pessoa está olhando, dizer o problema e como resolver, sem culpar.
- Evitar pop-up intrometido e som que assusta.
- A habilidade de usar interface cai ~0,8% por ano entre 25 e 60 anos; quem tem 40+ já pede letra maior.

### NN/g — baixa leitura **[lido]**
https://www.nngroup.com/articles/writing-for-lower-literacy-users/
- Lê palavra por palavra, linha por linha; NÃO passa o olho. Não vê o que está fora da coluna principal.
- Pega a primeira opção que parece servir e pula texto denso.
- Rolar quebra a concentração (perde onde estava).
- Receita: o mais importante no topo; uma coluna só; menu em lista reta; texto PARADO (nada de texto animado);
  frases de nível de 6ª série.
- Reescrever simples subiu o acerto de 46% → 82% (e também ajudou quem lê bem: 68% → 93%).

### Tamanho de alvo pra idoso **[resumo de busca, artigos não abertos]**
- Franz et al. 2019: quem tem 60+ escolhe como "menor que consigo tocar" 13 mm (jovens: 4 mm).
  https://faculty.washington.edu/wobbrock/pubs/assets-19.06.pdf
- Leitão & Silva 2012 (40 idosos, celular): alvo maior e mais espaçado = menos erro em tocar e deslizar.
  https://mural.maynoothuniversity.ie/id/eprint/6045/

### Como as pessoas seguram o celular **[lido]**
https://www.uxmatters.com/mt/archives/2013/02/how-do-users-really-hold-mobile-devices.php
https://www.smashingmagazine.com/2016/09/the-thumb-zone-designing-for-mobile-users/
- 49% uma mão, 36% apoiado, 15% duas mãos. Com uma mão: 67% polegar direito, 33% esquerdo.
  Canhoto não é detalhe (20–30%).
- Não pôr função perigosa nem pouco usada em canto difícil esperando que a pessoa "se estique".
- Navegação mais usada fica na faixa de baixo, fixa. X de fechar no canto de cima é o pior lugar pro polegar:
  ter também um jeito de fechar embaixo.
- O autor corrigiu depois: as pessoas tocam o CENTRO da tela mais rápido e com mais acerto que cantos e bordas.
- Sobre celular deitado, as fontes dão pouco dado. Dedução (nossa): deitado, com duas mãos, os polegares
  alcançam os dois cantos de baixo e as laterais; o centro de cima é o mais longe.

### Jogos idle no celular **[lido: Mind Studios, PocketGamer; busca]**
https://mindstudiosgames.com/post/idle-clicker-game-design-and-monetization/
https://www.pocketgamer.biz/egg-inc-idle-games-gold-standard/
- Interface simples, quase sem curva de aprender; "menu complexo e lotado distrai".
- Primeira sessão: entrada rápida, recompensa cedo. Botões aparecem só quando passam a servir.
- Meta visível sempre: uma grande + pequenas. Recompensa pequena e frequente no começo.
- Ganho offline: dizer com clareza quanto rendeu e qual o limite (o Egg, Inc. avisa o teto em vez de esconder).
  Ausência não pune.
- Aviso de novidade só pra recompensa, conteúdo novo e evento importante; aviso demais irrita.
- Relato de jogador (AdVenture Capitalist): esconder botão de compra atrás de outro botão irrita, porque se compra o tempo todo.
- **[não achei fonte escrita boa; padrão observado nos jogos do gênero, conferir jogando]** barra de abas fixa embaixo,
  botão de quantidade ×1 / ×10 / Máx, bolinha de novidade na aba, cartão "Enquanto você esteve fora" ao voltar.

## 3. Inspirações visuais
**Aviso honesto:** Pinterest, Dribbble, Behance, gameuidatabase.com e uiverse.io bloquearam a leitura automática
(página vazia ou erro 403), e o interfaceingame.com entrega só a lista de telas, sem imagem. Então NÃO vi as imagens.
Abaixo: (a) links pra o dono abrir e olhar, (b) padrões tirados das descrições em texto que consegui ler e do que
se sabe desses jogos. Copiar PADRÃO, nunca o desenho.

### a) Onde olhar (abrir no navegador)
| Busca / página | O que procurar |
|---|---|
| https://www.pinterest.com/search/pins/?q=cozy%20game%20UI | painéis creme, cantos redondos, botões gordos |
| https://www.pinterest.com/search/pins/?q=mobile%20idle%20game%20UI | barra de abas embaixo, lista de cartões de upgrade |
| https://www.pinterest.com/search/pins/?q=pixel%20art%20game%20menu%20UI | moldura de 9 fatias, ícones em pixel, sombra dura |
| https://www.pinterest.com/search/pins/?q=japanese%20cozy%20game%20interface | papel, carimbo vermelho (hanko), fita/noren, etiqueta |
| https://www.pinterest.com/search/pins/?q=farm%20game%20shop%20UI | cartão de item: desenho grande + preço num botão |
| https://www.pinterest.com/search/pins/?q=game%20HUD%20mobile%20landscape | o que fica em cada canto no celular deitado |
| https://www.pinterest.com/search/pins/?q=skill%20tree%20UI%20game | nó travado × disponível × comprado |
| https://www.pinterest.com/search/pins/?q=quest%20log%20UI%20cozy | lista de metas com caixinha marcada e barra |
| https://www.gameuidatabase.com/ | filtrar por tipo de tela (Shop, Skill Tree, Quest Log) |
| https://interfaceingame.com/games/stardew-valley/ | Store, Collection, Skill level, Quest, Journal, Calendar |
| https://interfaceingame.com/games/animal-crossing-new-horizons/ | NookPhone (grade de ícones grandes), Shop, Achievements, Passport |
| https://dribbble.com/search/cozy-game-ui · https://www.behance.net/search/projects?search=cozy%20game%20ui | conjuntos completos de telas |

### b) Padrões pra copiar
| Referência | Padrão (o que copiar) |
|---|---|
| Animal Crossing NH — NookPhone (lista de telas: interfaceingame, link acima) | UMA grade de ícones grandes com palavra embaixo dá acesso a tudo: nada escondido. Bolinha de aviso no ícone. Cada "app" abre em tela cheia com a mesma cara. |
| Stardew Valley — menu (lista de telas: interfaceingame) | Abas com ícone presas na borda do painel, sempre na mesma ordem; painel com moldura grossa e fundo de papel; item = quadrado com desenho + número no canto. |
| Kits "cozy farm" (descrição lida) https://forum.godotengine.org/t/cozy-farming-ui-kit-interactive-demo-and-ui-assets-for-godot/140448 | Uma linguagem só pra botão, chave, barra e cartão; cartão de item com desenho, nome, dado e estado de selecionado; HUD com contadores fixos. |
| Kits de café/fazenda em pergaminho (descrição lida, via busca) https://www.artstation.com/marketplace/p/bDNkd/hearthleaf-cozy-caf-ui-complete-collection | Paleta curta: madeira quente + papel + UM verde/dourado de destaque. Mesmas peças em toda tela (botão, aba, cartão, painel, lista, dica). |
| "Spritecraft" (descrição lida, via busca; página bloqueada) https://uiverse.io/design/systems/plastic-mule-29-50a112d8 | Pixel art sobre papel: fundo pergaminho, contorno de tinta de 1 cor, relevo em degraus de pixel, UMA cor forte só pra ação principal. |
| "Cozy gamer" (via busca) https://chrislemke.github.io/website_designs/examples/Cozy_Gamer.html | Grade de cartões tipo mural, com leve desalinho/rotação pra parecer feito à mão (só enfeite, não em botão). |
| Sushi On Wheels (via busca) https://80.lv/articles/this-indie-game-might-have-the-cutest-menu-ever | Menu como LUGAR ilustrado: a tela é a lojinha, não uma janela cinza. |
| Idle de celular em geral (Egg, Inc., AdVenture Capitalist — padrão do gênero) | Barra fixa embaixo com 4–5 abas; lista vertical de cartões largos; preço dentro do botão de comprar; ×1/×10/Máx sempre visível no topo da lista. |

## 4. Achados sobre o Kome (pra virar tarefa)
- `tools/check.js` só acusa botão menor que **32 px** no celular; a régua do guia é 56. Subir o limite do check.
- Queixa do dono ("tudo escondido, difícil chegar nas partes"): bate com NN/g baixa leitura (não enxerga o que está
  fora do fluxo principal) e com GAG (começar sem atravessar menus). Remédio: barra de abas fixa, sempre visível.
- CAVAR segurado contraria GAG/XAG 107: precisa de modo alternar e de cavar automático.
