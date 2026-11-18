# Guia de UX do Kome (vale pra TODA tela e menu)
> **ATUALIZADO pela pesquisa em 2026-11-18: mudanças =** (5) texto de corpo 16→**18 px** no celular e 14→**16 px** no PC,
> título 20→**22 px**, piso absoluto de qualquer letra **14 px**, alvo nunca abaixo de **44 px**, escala de letra até
> **200%**, entrelinha ≥ 1,5 · (6) contraste com número (**4,5:1** texto, **3:1** ícone/borda/travado) e cor NUNCA sozinha ·
> (7) X de fechar ≥ 56 px + botão "Fechar/Voltar" embaixo · (8) toque dispara ao soltar · (10) CAVAR não pode ser só
> segurar · (11) abas viram barra fixa embaixo · (12) "Desfazer" quando der · (13) animação com limites (≤ 200 ms entrada,
> ≤ 3 piscadas/s, movimento reduzido) · seções novas **"Acessibilidade (da pesquisa)"** (A1–A20) e **"Cara das telas"**
> (V1–V10). Fontes e porquês: `ux-pesquisa.md`.

Quem joga: de 20 a 60 anos. Régua: uma pessoa de 50 anos, com dificuldade de ler e sem paciência pra pensar muito,
tem que conseguir usar TODAS as funções sem ajuda. Bonito, vivo, mas simples.

## Regras
1. **Uma coisa principal por tela.** O botão do que fazer AGORA é o maior e dourado. O resto é discreto.
2. **Frase "o que fazer agora"** no topo de cada painel, 1 linha, verbo no começo ("Toque numa máquina pra comprar").
3. **Pouco texto.** Nome curto + 1 linha de até ~8 palavras. Nada de parágrafo. Sem jargão (nada de "DPS", "mult", "R0",
   "buff"). Número sempre com o que ele é ("+20% de arroz", "custa ¥ 1,2 mi"). Frase em minúscula normal (MAIÚSCULA só
   em rótulo de 1–2 palavras). Texto fica PARADO: não anima, não rola sozinho, não some por tempo.
4. **Ícone + palavra** em todo botão. Nunca só ícone, nunca só texto pequeno.
5. **Tamanho (px de CSS):** botão e alvo de toque ≥ 56 px no celular (≈ 15 mm), ≥ 48 px no PC; NENHUM alvo abaixo de
   44 px em lugar nenhum. Espaço de ≥ 8 px entre alvos. Texto de corpo ≥ 18 px no celular, ≥ 16 px no PC; título ≥ 22 px;
   nenhuma letra abaixo de 14 px (nem etiqueta, nem número no canto). Entrelinha ≥ 1,5 em texto de 2+ linhas; linha
   ≤ 40 letras no celular. Use a variável `--k-fs` (escala de letra do jogador, de 100% a 200%) em TODO tamanho de
   letra e de ícone; em 150% nada pode cortar nem sobrepor, em 200% pode rolar na vertical.
6. **Cores com sentido, sempre as mesmas:** dourado = dá pra comprar/fazer agora · cinza = travado (e DIZ o que falta:
   "falta ¥ 300", "precisa da Escavadeira") · verde = feito/comprado · vermelho só pra erro. **Cor nunca sozinha:** cada
   estado tem também ícone/forma E palavra (travado = cadeado + "falta…"; comprado = carimbo ✓ + "Comprado"; erro =
   "!" + frase). Contraste medido: texto ≥ 4,5:1; texto grande (≥ 24 px), ícone, borda de botão e texto de item travado
   ≥ 3:1. Texto escuro `#3B2818` em fundo claro creme. Texto em cima do mundo/canvas: sempre com placa sólida ou
   contorno atrás. Paleta `E.PAL`, contorno `#3B2818`.
7. **Fechar sempre igual:** X grande (≥ 56 px) no canto de cima à direita + tocar fora + Esc + um botão "Fechar" ou
   "Voltar" embaixo (o canto de cima é o mais difícil pro polegar). "Voltar" quando tem tela dentro de tela.
8. **Resposta a todo toque:** botão afunda, som curto, número pula, coisa comprada brilha/carimba. Compra impossível
   balança e diz o motivo, do lado do botão tocado, sem culpar. Nada acontece em silêncio. A ação dispara ao SOLTAR o
   dedo (arrastar pra fora cancela); exceção: CAVAR e o direcional, que respondem ao encostar.
9. **Progresso à vista:** barra ou "3 de 8" em tudo que é coleção/meta. O próximo objetivo sempre aparece.
10. **Sem gesto escondido** (nada de segurar, arrastar, deslizar, dois dedos ou toque duplo como único caminho). Rolagem
    só vertical, com seta/sombra mostrando que tem mais. CAVAR: segurar continua valendo, mas tem que existir o modo
    "tocar liga / tocar desliga" e o "cavar sozinho" (ver A8).
11. **Abas:** no máximo 5, com ícone + palavra, a ativa bem marcada (cor + forma: levantada/sublinhada). Bolinha dourada
    com número na aba que tem novidade. As áreas principais do jogo ficam numa barra FIXA embaixo, sempre visível (ver V1).
12. **Confirmação** só em coisa que não tem volta (viajar, resetar, começar modo), com frase clara do que acontece e do
    que se perde; botão seguro ("Voltar") maior e à esquerda, o perigoso longe dele. No resto, preferir "Desfazer" por
    alguns segundos a perguntar antes.
13. **Vivo:** entrada do painel com animação curta (≤ 200 ms), Kome ou arte do jogo no cabeçalho, itens com desenho.
    Reaproveitar a arte que já existe (fichas, Pix, ícones do HUD). Limites: nada pisca mais de 3 vezes por segundo;
    brilho de tela cheia no máximo 1 por ação; com "Menos movimento" ligado (A5) a entrada vira só opacidade.

## Acessibilidade (da pesquisa)
Cada regra dá pra conferir olhando a tela. Ajustes ficam em **Ajustes → "Conforto"**, com liga-desliga grande, salvos no save.

- **A1. Nunca só cor.** Todo estado tem cor + ícone/forma + palavra. Teste: tela em preto e branco continua dando pra usar.
- **A2. Daltonismo.** Não diferenciar duas coisas só por verde × vermelho. Par seguro: dourado/laranja × azul, um claro
  e um escuro.
- **A3. Tamanho da letra.** Ajuste com 4 passos: 100% · 125% · 150% · 200% (`--k-fs`). Ícone cresce junto.
- **A4. Alto contraste.** Opção que deixa todo texto e ícone ≥ 7:1 e põe placa sólida atrás de texto sobre o mundo.
- **A5. Menos movimento.** Opção própria + obedecer `prefers-reduced-motion` do aparelho (ligado no sistema = ligado no
  jogo na primeira vez). Ligado: sem tremor de tela, sem paralaxe, sem coisa deslizando/crescendo em painel;
  troca por opacidade ≤ 150 ms. Número e cor continuam mudando.
- **A6. Tremor e clarão separados.** Dois liga-desliga: "Tremor de tela" e "Clarões". Desligado = zero, não "menos".
- **A7. Piscar.** Nada pisca mais de 3×/s em nenhum modo. Vermelho forte piscando é proibido. Clarão de tela cheia
  dura ≥ 150 ms pra subir e descer (nada de 1 quadro branco).
- **A8. CAVAR sem segurar.** Ajuste "Jeito de cavar" com 3 escolhas: Segurar · Tocar liga/desliga · Cavar sozinho.
  O estado ligado aparece no botão (cor + ícone + palavra "CAVANDO"). Nenhuma ação do jogo exige segurar mais de 3 s
  nem toque rápido repetido.
- **A9. Sem pressa pra ler.** Nenhum texto some por tempo: fala, dica e tutorial avançam com toque. Aviso flutuante
  que some sozinho fica ≥ 4 s e a mesma informação continua achável (registro/bolinha na aba).
- **A10. Pausa.** Abrir qualquer painel pausa o que pode fazer o jogador perder algo. Botão "Pausar" sempre no mesmo lugar.
- **A11. Lugar fixo.** Mesma função, mesmo canto, em toda tela: barra de abas embaixo, dinheiro em cima à esquerda,
  X em cima à direita, botão principal embaixo à direita. Nada muda de lugar entre telas nem quando destrava coisa nova.
- **A12. Polegares (celular deitado).** Ação frequente nos cantos de baixo e laterais (até ~1/3 da largura de cada
  lado). Topo e centro de cima = só informação (dinheiro, meta). Ação perigosa nunca ao lado da mais usada (≥ 24 px
  de folga). Respeitar `env(safe-area-inset-*)`.
- **A13. Canhoto.** Ajuste "Trocar lados" espelha direcional e CAVAR (e o botão principal dos painéis).
- **A14. PC só com teclado.** Tudo alcançável com Tab/setas + Enter, Esc fecha, foco com contorno visível ≥ 3 px e
  3:1. Teclas remapeáveis nos Ajustes; a dica na tela mostra a tecla atual.
- **A15. Som nunca sozinho.** Todo som que avisa algo (pronto, erro, evento, conquista) tem sinal visual junto:
  ícone + palavra. Volumes separados de Efeitos e Música + "Mudo". Vibração com liga-desliga próprio; nunca é o único aviso.
- **A16. Número legível.** pt-BR com vírgula e palavra: "950" · "1.250" · "12,5 mil" · "1,2 milhão" · "3,4 bilhões" ·
  "1,2 trilhão". No máximo 3 algarismos significativos. Nada de "1.2e6" nem "1,2M". Notação curta (letras) só depois
  de decilhão, e com legenda tocável. Sempre com a unidade ("¥", "de arroz", "por segundo").
- **A17. Não tem volta = confirma; o resto = desfaz.** Ver regra 12. A frase de confirmação diz o que se ganha e o que
  se perde, com números.
- **A18. Salvar.** Salva sozinho a cada ≤ 30 s e ao sair/esconder a aba. Mostrar "Salvo ✓ há X" nos Ajustes e um selo
  discreto ao salvar. Lembrar de exportar o save 1× a cada ~7 dias de jogo, sem insistir (tem "Agora não").
- **A19. Aprender fazendo.** Tutorial = 1 instrução por vez, apontando o botão de verdade, que o jogador aperta. Sem
  parede de texto. Dá pra rever em Ajustes → "Como jogar". Função nova aparece quando destrava, com 1 frase.
- **A20. Erro que ajuda.** Mensagem ao lado do que foi tocado, dizendo o problema e o que fazer ("Falta ¥ 300. Venda
  arroz."). Sem pop-up surpresa no meio da ação, sem som que assusta.

## Cara das telas
Resolve a queixa "tudo escondido, muito difícil chegar nas partes do jogo". Estilo: pixel art + papel creme + contorno
marrom `#3B2818`, aconchegante e japonês. Copiar padrão, nunca arte de outro jogo.

- **V1. Barra de lugares fixa embaixo.** 5 abas grandes, ícone em pixel art (≥ 32 px desenhado, sem borrar) + palavra
  embaixo, cada aba ≥ 64 px de altura e 1/5 da largura. Sempre visível, inclusive com painel aberto. Toda área do jogo
  mora numa dessas 5 abas, a no máximo 2 toques. No celular deitado pode virar coluna na lateral, mas no mesmo lugar sempre.
- **V2. Aba = lugar em tela cheia.** Abrir uma aba troca a tela inteira por um "lugar" (loja, oficina, casa…), não uma
  janelinha por cima. Cabeçalho ilustrado (cena em pixel art do lugar, com o Kome), 20–25% da altura no PC, faixa
  baixa (≤ 56 px) no celular deitado.
- **V3. Título em fita.** Nome do lugar numa fita/noren de tecido atravessando o cabeçalho, letra ≥ 22 px, 1–2 palavras.
- **V4. Painel de pergaminho.** Fundo creme de papel, contorno `#3B2818` de 3 px, cantos em degrau de pixel. Uma coluna
  só de conteúdo (duas no máximo no PC).
- **V5. Cartão gordo.** Cada item é um cartão: desenho grande à esquerda (≥ 48 px), nome + 1 linha no meio, botão com o
  preço à direita. Contorno 3 px, sombra DURA deslocada 4 px pra baixo/direita em `#3B2818` (sem desfoque, sem animar).
  Ao tocar, o cartão desce os 4 px (só `transform`).
- **V6. Estado como carimbo/adesivo.** Comprado = carimbo vermelho tipo hanko com "✓ Comprado" · Novo = adesivo dourado
  "Novo!" · Travado = cartão acinzentado + cadeado + "falta…". Sempre desenho + palavra (A1).
- **V7. Número em selo grande.** Quantidade, nível e preço em selo redondo/etiqueta com número ≥ 18 px e contorno.
  Bolinha de novidade na aba: ≥ 20 px, dourada, com número.
- **V8. Uma cor forte por tela.** Dourado só no que dá pra fazer agora (regra 1). O resto em creme, marrom e os 3 tons
  de cada material. Vermelho só no carimbo e em erro.
- **V9. Mesmas peças em toda tela.** Botão, aba, cartão, fita, selo e carimbo vêm de `game/ux-base.css`. Tela nova não
  inventa peça nova.
- **V10. Quantidade à vista.** Onde se compra em quantidade: seletor ×1 · ×10 · Máx fixo no topo da lista (3 botões,
  o ativo marcado), nunca escondido em outro menu. Ao voltar ao jogo: cartão "Enquanto você esteve fora" com o ganho
  num número grande e um botão só ("Pegar").

## Técnica (pra não voltar o lag)
- Mexer no DOM só quando o valor muda (nunca todo quadro). Animar só `transform`/`opacity`. Nada de `box-shadow` animado,
  nada de `ctx.filter` por quadro. Listas longas: montar uma vez, atualizar só o que mudou.
- CSS novo de cada área vai no arquivo próprio `game/ux-<área>.css` (já ligado no index.html). Classes comuns em `game/ux-base.css`.
- Modo acelerado (FAST) nunca espera tela nem animação.
- Tem que funcionar em PC, celular deitado e celular em pé. Conferir com `node tools/check.js --fast` e `node tools/sweep.js`.
- Movimento reduzido: `@media (prefers-reduced-motion: reduce)` no CSS + classe no `<body>` pro ajuste do jogo; o canvas
  lê a mesma opção pra tremor e clarão.
