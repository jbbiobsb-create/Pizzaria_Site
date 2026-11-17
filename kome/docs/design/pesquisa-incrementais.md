# Pesquisa: por que incrementais prendem (e como prender sem manipular)
status: referência · alimenta: `camada-cookie.md` · feita em 17/11/2026 pelo designer

Pesquisa pedida em `PEDIDO-fable-camada-cookie` (pedido do programador, 18/11). Complementa `docs/incremental-design.md`
(que olhou jogos curtos tipo Potato Please). Aqui o foco é **jogo longo** (Cookie Clicker, AdVenture Capitalist, Paperclips,
Antimatter Dimensions) e **criança jogando**.

**Como ler cada fonte**
- **Rótulo de evidência:** `estudo empírico` (alguém mediu gente), `revisão` (junta vários estudos), `opinião de designer`
  (quem faz jogo dizendo o que funciona), `dado de mercado` (números ou fatos de jogos e lojas), `norma` (lei ou código).
- **[aberto]** = abri e li a página ou o PDF nesta sessão. **[busca]** = só vi o resumo/registro devolvido pela busca; não li o
  texto. Nenhum link aqui foi inventado; quando não tenho link aberto, dou o DOI ou digo que não tenho.
- Quase toda pesquisa sobre jogo é com **adultos** (universitários, Mechanical Turk, jogadores online). Transferir pra criança
  de 7 a 12 anos é sempre um salto. Digo onde o salto é grande.

---

## Resumo em 8 linhas
1. Incremental bom é **planejar mais e clicar menos** com o tempo, e cada virada de sistema funciona como capítulo de história
   (Alharthi 2018; Spiel 2019). Número subindo sozinho não segura; **sistema novo aparecendo** segura.
2. **Recompensa variável agrada quando a variação é pequena e não tem zero**; com faixa larga e chance de nada, as pessoas
   preferem a fixa (Kao 2012). Sorte honesta e com piso, sim; "quase ganhou", nunca (Clark 2009).
3. **Meta perto puxa esforço** (Kivetz 2006) e **vontade de retomar o que ficou pela metade é robusta**; já a "memória melhor do
   inacabado" (Zeigarnik) **não se confirmou** em meta-análise recente (Ghibellini e Meier 2025).
4. Autonomia e competência explicam boa parte do prazer de jogar (Ryan, Rigby e Przybylski 2006): escolha de verdade e
   feedback claro valem mais que bônus.
5. Matemática padrão: custo exponencial (×1,07 a ×1,15 por unidade), produção linear, marcos ×2 que quebram o platô,
   prestígio que deixa ir mais longe na curva (Pecorella 2016; wiki do Cookie Clicker).
6. Humor e absurdo levados até a conclusão lógica são parte do gênero, não enfeite (Spiel 2019, tema 1; Orteil na Vice 2021).
7. O que é "escuro" em espera não é esperar, é **perder por não voltar** (Zagal, Björk e Lewis 2013: o problema do FarmVille é a
   planta murchar). Os próprios designers de idle recomendam **platôs que deixam a pessoa sair** (Spiel 2019).
8. Pra criança: loot box é **proibida no Brasil** em jogo acessível a menores (ECA Digital, Lei 15.211/2025, segundo a
   cobertura jurídica); o código britânico pede não usar recompensa pra prender e deixar sair sem perder nada (ICO).

---

## A. Por que incrementais prendem

**A1. Playing to Wait: A Taxonomy of Idle Games** · Sultan A. Alharthi, Olaa Alsaedi, Phoebe O. Toups Dugas, Theresa J.
Tanenbaum, Jessica Hammer · CHI 2018 · https://par.nsf.gov/servlets/purl/10061230 [aberto, PDF]
- Achado: análise qualitativa (grounded theory) de 66 jogos idle e 10 não-idle. Os incrementais "incentivam o jogador a jogar
  menos e planejar mais" ao longo da curva; esperar **é** jogar; recomendam **descarregar a memória do jogador** (fila de
  tarefas, dicas de "quanto tempo falta", como no Kittens Game).
- Evidência: estudo empírico (qualitativo, sem jogadores medidos: os pesquisadores analisaram os jogos).
- Pro Kome: a fase Cookie tem que **trocar clique por plano** aos poucos (qual máquina, quando viajar). Mostrar "falta 2 min
  pra próxima" e "ficar mais 20 min dá +5 sementes" é recomendação direta do artigo.

**A2. "It Started as a Joke": On the Design of Idle Games** · Katta Spiel, Sultan A. Alharthi, Andrew J.-L. Cen, Jessica
Hammer, Lennart E. Nacke, P. O. Toups Dugas, Theresa J. Tanenbaum · CHI PLAY 2019 · https://par.nsf.gov/servlets/purl/10174274
[aberto, PDF]
- Achado: entrevistas com 6 designers (Universal Paperclips, Kittens Game, Progress Quest, Cow Clicker, Spaceplan, Tap Titans).
  Cinco temas: atenção ao absurdo; convites ao jogo sem compromisso; **viradas de sistema como batidas de narrativa**;
  **cuidado no design** (vício, monetização, gasto de energia); jogar como motivação pra criar. Diretrizes: espalhar as batidas
  de narrativa em intervalos maiores "pra menos potencial de vício", **desenhar platôs que convidam a sair por um tempo**,
  limitar transações, deixar jogar de graça, nunca deixar o jogador num estado sem saída.
- Evidência: estudo empírico qualitativo, amostra minúscula (6), mas é a única fonte com **a voz dos designers** do gênero.
- Pro Kome: é a fonte mais alinhada com as regras do dono. Cada prestígio/volta precisa de uma **virada** (máquina absurda nova,
  regra nova), não só ×2. E **platô no fim de cada corrida** é desejável: é onde o jogo diz "boa hora de viajar ou de parar".

**A3. Busy Doing Nothing? What Do Players Do in Idle Games?** · Joe Cutting, David Gundry, Paul Cairns · Int. J. of
Human-Computer Studies, 2019 · https://eprints.whiterose.ac.uk/id/eprint/135461/ [aberto, só a página com resumo]
- Achado: questionário com 1.972 jogadores de Neko Atsume (progresso só acontece com o jogo fechado). Engajamento alto, em quatro
  formas: tempo jogando, conversar sobre o jogo, rede social, **frequência de checar**. Sugerem tratar engajamento em idle como
  hábito, não como sessão longa.
- Evidência: estudo empírico (questionário, autosseleção, adultos e adolescentes misturados; não li o texto completo).
- Pro Kome: "abrir 10 min, ver o que cresceu, decidir uma coisa" (PLANO-100H §2.4) é o padrão real do gênero. A carta de volta
  (ganho offline) é o momento mais importante da sessão curta.

**A4. The Motivational Pull of Video Games: A Self-Determination Theory Approach** · Richard M. Ryan, C. Scott Rigby, Andrew
Przybylski · Motivation and Emotion, 2006 · https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf
[aberto, PDF]
- Achado: 4 estudos. Autonomia e competência percebidas no jogo se associam a prazer, preferência e bem-estar depois de jogar;
  controles intuitivos ajudam as duas. Em jogo online, autonomia, competência e relação predizem prazer e intenção de continuar.
- Evidência: estudo empírico (adultos; correlacional na maior parte).
- Pro Kome: o gancho saudável é **"eu escolhi e eu consegui"**. Escolha real (qual máquina, qual evento guardar, quando viajar)
  e feedback claro de que a escolha funcionou. Relação: o Kome não tem multijogador; a "relação" possível é com os shibas da
  turma (nomes, carinhas) e com quem joga junto no sofá.

**A5. A Motivational Model of Video Game Engagement** · Andrew Przybylski, C. Scott Rigby, Richard M. Ryan · Review of General
Psychology, 2010 · https://repository.essex.ac.uk/7228/ [busca]
- Achado (pelo resumo): revisão que liga o apelo dos jogos a satisfazer competência, autonomia e relação, e discute uso
  desordenado.
- Evidência: revisão.
- Pro Kome: reforça A4. Não li o texto.

**A6. Behavioral Game Design** · John Hopson · Gamasutra/Game Developer, 2001 · https://www.gamedeveloper.com/design/behavioral-game-design
[aberto]
- Achado: aplica esquemas de reforço do behaviorismo. Razão fixa gera **pausa depois da recompensa**; razão variável gera
  atividade alta e constante; intervalo variável gera atividade constante e mais calma. Sugere várias atividades em paralelo
  pra cobrir as pausas. Não discute ética no texto (o próprio Hopson, anos depois, diz que a ética disso ainda está em debate).
- Evidência: opinião de designer (base em pesquisa com animais; não testa jogo).
- Pro Kome: os marcos ×2 em 1/5/25/50… são razão fixa (pausa depois do marco: Pecorella observa o mesmo). Os eventos dourados
  são intervalo variável. **Usar intervalo variável, não razão variável ligada a clique**, é a escolha mais calma das duas.

**A7. Reward Preference in Video Games** · Kung-Chien Dominic Kao · tese de mestrado, Princeton, 2012 ·
https://people.csail.mit.edu/dkao/pdf/kao2012rewardpreference.pdf [aberto, PDF]
- Achado: participantes escolhiam entre um mundo com recompensa fixa (10 pontos) e um com recompensa variável de mesma média.
  Variável 5–15: **preferido**. Variável 0–20 ou 0/20: preferência some ou vira pra fixa. Variável 0/50 (raro e grande): **fixa
  preferida**. "Aversão a recompensas menores".
- Evidência: estudo empírico (Mechanical Turk, adultos, jogo feito pra pesquisa; tese, não artigo revisado).
- Pro Kome: sorteio com **piso alto e teto moderado**. Evento dourado nunca paga quase nada; o "lendário" é raro mas o comum já é
  bom. Isso vale também pros sacos de hoje (`D.SACK.gacha` tem um 0,5×: pensar em subir esse piso).

**A8. Gambling near-misses enhance motivation to gamble and recruit win-related brain circuitry** · Luke Clark, Andrew J.
Lawrence e coautores · Neuron, 2009 · https://pmc.ncbi.nlm.nih.gov/articles/PMC2658737 [aberto]
- Achado: o "quase" (rolo parando a uma posição do prêmio) é **menos agradável** que errar feio, mas **aumenta a vontade de
  continuar**, e ativa áreas de recompensa como uma vitória. O efeito só aparece quando o jogador sente que controlou a jogada.
- Evidência: estudo empírico (40 universitários no comportamental, 15 no fMRI; caça-níquel de laboratório).
- Pro Kome: é a prova de por que "quase-acerto fabricado" está proibido no CLAUDE.md: ele aumenta a vontade de jogar **fazendo a
  pessoa se sentir pior**. Nenhuma animação de roleta parando "por um triz", nenhum saco que "quase" era lendário.

**A9. The Goal-Gradient Hypothesis Resurrected: Purchase Acceleration, Illusionary Goal Progress, and Customer Retention** ·
Ran Kivetz, Oleg Urminsky, Yuhuang Zheng · Journal of Marketing Research, 2006 · https://ideas.repec.org/p/feb/natura/00658.html
[aberto, resumo]
- Achado: cartão de café: as pessoas compram mais rápido quando estão perto do prêmio; num site, voltam mais e persistem mais
  perto da meta. Um cartão de 12 selos com 2 já carimbados é completado mais rápido que um de 10 vazio (**progresso ilusório**).
- Evidência: estudo empírico (campo, adultos, consumo).
- Pro Kome: barra de "próxima conquista" e "próximo marco" sempre à vista funciona. Mas **o truque dos selos de brinde é
  manipulação leve**: no Kome a barra mostra o progresso real, sem selo de presente fingido.

**A10. Interruption, recall and resumption: a meta-analysis of the Zeigarnik and Ovsiankina effects** · Ghibellini e Meier ·
Humanities and Social Sciences Communications, 2025 · https://ideas.repec.org/a/pal/palcom/v12y2025i1d10.1057_s41599-025-05000-w.html
[aberto, resumo]
- Achado: **sem vantagem de memória para tarefas inacabadas** (Zeigarnik não tem validade universal); mas há uma **tendência
  geral a retomar** tarefas interrompidas (Ovsiankina).
- Evidência: revisão (meta-análise).
- Pro Kome: não apostar em "a criança vai ficar pensando no jogo" (isso é fraco e, se fosse forte, seria ruim). Apostar em
  **ao voltar, a coisa começada está lá, visível e pronta pra continuar** (barra a 80%, máquina quase comprada). Sem culpa.

**A11. Flow in Games (and Everything Else)** · Jenova Chen · Communications of the ACM, 2007 ·
https://khoury.northeastern.edu/~lieber/courses/csu670/f08/materials/p31-chen-flow-in-games.pdf [aberto, PDF]
- Achado: resume os componentes de flow de Csikszentmihalyi (desafio que pede habilidade, metas claras, feedback imediato,
  concentração, controle…). Pra públicos diferentes: oferecer escolhas que adaptam o desafio, mas **embutidas na atividade
  principal**; escolha demais ou frequente demais atrapalha o flow.
- Evidência: opinião de designer (com base na pesquisa de Csikszentmihalyi; não li o livro original, "Flow", 1990).
- Pro Kome: escolhas da fase Cookie ficam **no pátio e no cavar** (tocar no evento, escolher a máquina na própria vaga), não em
  menus empilhados. Um "jogo de dar escolhas" não é um "jogo de abrir janelas".

**A12. A Meta-Analytic Review of Experiments Examining the Effects of Extrinsic Rewards on Intrinsic Motivation** · Edward
Deci, Richard Koestner, Richard Ryan · Psychological Bulletin, 1999 · https://depts.washington.edu/techdocs/papers/deciExtrinsicRewardsAndIntrinsicMotivation99.pdf
[busca]
- Achado (pelo resumo): 128 estudos; recompensas dadas **só por participar, completar ou pelo desempenho** reduzem a motivação
  intrínseca em tarefas interessantes (d ≈ −0,40, −0,36, −0,28). Há debate (Cameron e Pierce acham o efeito menor).
- Evidência: revisão (tarefas de laboratório, não jogos; inclui crianças e adultos).
- Pro Kome: não pagar a criança **só por aparecer** (bônus de login, prêmio por dia seguido). Recompensar o que ela **fez** e
  informar ("a frota cavou X enquanto você estava fora") em vez de subornar ("volte amanhã pra ganhar Y"). Transferência pra
  jogo é incerta.

## B. Curvas de custo e produção, ritmo de novidade

**B1. The Math of Idle Games, Part I / II / III** · Anthony Pecorella (Kongregate) · Game Developer, adaptado da palestra MIGS
2016 · https://gamedeveloper.com/design/the-math-of-idle-games-part-i ·
https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii ·
https://gamedeveloper.com/design/the-math-of-idle-games-part-iii [aberto, os três]
- Achado: custo `base × taxa^quantidade` (AdVenture Capitalist: limonada taxa 1,07), produção linear × multiplicadores, marcos
  ×2 em 25/50/100 que puxam a produção pra perto dos custos. **Se a máquina mais nova domina, as velhas ficam irrelevantes e
  some a decisão**; variar os multiplicadores muda a prioridade em cada fase. Jogadores compram em lote, não na ordem ótima.
  Prestígio: AdVenture `150·√(ganho/1e15)`, Cookie Clicker raiz cúbica (dobrar pede ~8× mais), Egg, Inc. expoente ~1/7 (dobrar
  pede ~128×). Deixar o ritmo **"acidentado"**, com trechos lentos e rápidos; espere rajadas de compra depois de marcos.
- Evidência: opinião de designer com matemática (Pecorella produziu AdVenture Capitalist; sem dados de jogadores publicados).
- Pro Kome: base direta dos números da `camada-cookie.md`. Expoente do prestígio decide **com que frequência a criança viaja**.

**B2. Cookie Clicker: dados do jogo** · wiki dos fãs (cookieclicker.wiki.gg) · versão 2.058 · páginas
https://cookieclicker.wiki.gg/wiki/Buildings · https://cookieclicker.wiki.gg/wiki/Upgrades ·
https://cookieclicker.wiki.gg/wiki/Golden_Cookie · https://cookieclicker.wiki.gg/wiki/Milk ·
https://cookieclicker.wiki.gg/wiki/Ascension [aberto, as cinco]
- Achado: prédio custa ×1,15 por unidade (dobra a cada ~5). Upgrades de prédio em 1, 5, 25, 50, 100, 150… até 600 (15 por
  prédio, quase todos ×2; 300 de prédio, 717 normais). Cookie dourado a cada **5 a 15 min**, fica 13 s na tela; Sorte ~40%
  (15 min de produção), Frenesi ~40% (×7 por 77 s), Frenesi de Clique ~3% (×777 no clique, 13 s), Tempestade ~0,7%. "Leite": 4%
  por conquista; upgrades de gatinho multiplicam a produção por `1 + leite × fator`; 622 conquistas contam. Ascensão: nível de
  prestígio = raiz cúbica (biscoitos de sempre / 1 trilhão), +1% por nível; mantém upgrades celestiais.
- Evidência: dado de mercado (dado do jogo, compilado por fãs; confiável pra números, não pra "por que funciona").
- Pro Kome: referência de escala, não de cópia. Cookie Clicker tem **cookie da ira** (efeito negativo) e o Grandmapocalypse:
  **isso fica fora** do Kome.

**B3. Idle Game Design Principles** · Eric Guan · Substack, 2025 · https://ericguan.substack.com/p/idle-game-design-principles
[aberto]
- Achado: as pessoas sentem **diferença relativa** (100→120 sim, 100→101 não), por isso a escala exponencial; acostumar com o
  novo patamar faz o mesmo ganho parecer menor; a frequência de check-in cai com o tempo (de hora em hora, depois algumas vezes
  por dia). Usa "relógios" com estoque que para quando enche.
- Evidência: opinião de designer.
- Pro Kome: cada passo visível tem que ser ≥ ~20% de diferença pra contar como novidade. O "estoque que para quando enche" é
  aceitável como **teto de offline** (para de somar, não perde nada), nunca como "estraga".

**B4. Interview with Hevipelle (Antimatter Dimensions)** · incrementaldb.com, ~2023 · https://www.incrementaldb.com/community/interview/31
[aberto]
- Achado: as camadas de prestígio vieram do Realm Grinder, automação do Transport Defender, desafios do Idle Wizard; o começo é
  um "simulador de clicar no botão verde"; arrepende-se do trecho Time Dilation (lento demais antes da 1ª Realidade) e de ter
  pouca escolha no começo; terminou o jogo de propósito pra não forçar conteúdo ruim.
- Evidência: opinião de designer.
- Pro Kome: o maior arrependimento de um dos incrementais mais longos é **trecho lento sem escolha**. É exatamente o buraco do
  modo infinito que o `longo.js` mediu (13 trechos de 10 a 16 min).

## C. Prestígio como renovação

- Pecorella III (B1): prestígio dá "efeito de subir a escada" e devolve os números a uma faixa manejável. Não dá cadência
  recomendada: diz que o comportamento de reset é difícil de prever e que se ajusta por iteração.
- Spiel 2019 (A2): cada reset cria um "final temporário" e abre espaço pra **novas batidas de narrativa**; idle games são
  "várias narrativas fechadas em série".
- Alharthi 2018 (A1): resetar dá vantagem e marca conquista; jogos com mais resets ficam "mais rápidos e mais ricos".
- Universal Paperclips (D2): o final oferece recomeçar num universo paralelo com bônus.
- Pro Kome: prestígio = **viagem** (já existe) + algo **novo pra mexer** a cada volta (PLANO-100H §2.5). A conta das sementes
  deve fazer "ficar mais" render pouco e "viajar" render muito no momento certo, e o cartão de partir deve **mostrar a previsão**.

## D. Humor, absurdo e narrativa que se revela

**D1. "Cookie Clicker" Wasn't Meant to Be Fun. Why Is It So Popular 8 Years Later?** · Patrick Klepek · VICE, 2021 ·
https://www.vice.com/en/article/cookie-clicker-wasnt-meant-to-be-fun-why-is-it-so-popular-8-years-later [aberto]
- Achado: Orteil diz que o jogo "foi feito como piada", que atrai pela sensação de "terminar alguma coisa" (diferente da vida,
  onde o progresso é confuso), não tem compra com dinheiro real e ele acha idle viciante + microtransação "exploratório". O
  mesmo texto traz um jogador que passava 3 a 4 h por dia esperando cookie dourado e diz ter "recaído".
- Evidência: opinião de designer + relato jornalístico (anedótico).
- Pro Kome: humor é motor. E o relato do jogador é o alerta: **evento dourado não pode ser motivo pra ficar vigiando a tela**
  (por isso: pausa fora da tela, nada exclusivo, raro mas sem perda).

**D2. Universal Paperclips** · Frank Lantz, 2017 · https://en.wikipedia.org/wiki/Universal_Paperclips [aberto] ·
**2017: Universal Paperclips** · Aaron A. Reed (50 Years of Text Games), 2021 · https://if50.substack.com/p/2017-universal-paperclips
[aberto]
- Achado: começa com 1 botão; a cada platô você investe num salto que **abre um sistema novo** (mercado, autoclipes, computação,
  confiança, drones, espaço); a história aparece pelos **nomes dos projetos** e pelo registro de atividade. Planejado pra um fim de
  semana, virou 9 meses. Segundo a Wired (citada pela Wikipedia), 450 mil pessoas jogaram nos 11 primeiros dias, a maioria até o
  fim. Tem final, sem microtransação. Lantz: o gênero é tido como "lixo" e ele quis fazer a pessoa pensar por que corre atrás de
  um número arbitrário.
- Evidência: dado de mercado (números de imprensa, via Wikipedia) + crítica.
- Pro Kome: história contada **pelos nomes das coisas** é barata e cabe em planilha: nomes de upgrade, notícias da rádio, nomes
  de número. E "terminou a corrida" pode ser uma batida de história (ver as máquinas absurdas da `camada-cookie.md`).

## E. Tédio e abandono

- **Trecho lento sem escolha** é o arrependimento do Hevipelle (B4) e o buraco medido no nosso modo infinito.
- **Máquina velha irrelevante = sem decisão** (Pecorella II, B1).
- **Acostumar com o patamar** (Guan, B3): o mesmo ×2 vale menos com o tempo; precisa de virada de sistema, não só de tamanho.
- **Excesso de clique**: Alharthi cita "fadiga de clique" como risco do gênero (A1).
- **Esperar como castigo** (Alharthi, A1, sobre FarmVille: limitar ações pra vender o atalho). O Kome não vende nada; o risco
  aqui é só esperar sem nada pra decidir.
- **16 reasons why players are leaving your game** (Game Developer) apareceu na busca dizendo que tédio e frustração são as duas
  causas principais e citando "menos de 40% voltam depois da 1ª sessão" em F2P: **[busca]**, não abri; o número é de F2P em
  geral, de 2013, de segunda mão. Não uso.
- **Evidência fraca:** não achei estudo empírico específico sobre **por que** jogadores de incremental largam. O que existe é
  designer opinando e reclamação de jogador (Reddit, análises de loja). Trate a seção E como opinião de designer.

## F. Ética e crianças

**F1. Dark Patterns in the Design of Games** · José P. Zagal, Staffan Björk, Chris Lewis · FDG 2013 · https://gup.ub.gu.se/file/101018
[aberto, PDF]
- Achado: padrões escuros temporais (moer/grinding, **jogar com hora marcada**), monetários (pagar pra pular, conteúdo
  pré-entregue), sociais (pirâmide social, se passar pelo jogador). Jogar com hora marcada **só fica escuro com o "murchar"**: se
  a planta não colhida não estraga e a hora marcada não trava o progresso, a escuridão some.
- Evidência: opinião de designer/acadêmica (taxonomia, sem dados).
- Pro Kome: regra "nada estraga enquanto está fora" está certa e tem nome. Evento que aparece só em certa hora **pode** existir
  se for opcional e não travar progresso nem conquista exclusiva.

**F2. Against "Dark Game Design Patterns"** · Sebastian Deterding, Jaakko Stenros, Markus Montola · DiGRA 2020 (resumo) ·
https://eprints.whiterose.ac.uk/156460/1/DiGRA_2020_paper_189.pdf [aberto, PDF]
- Achado: crítica ao conceito de F1: chama de "escuro" coisas que dependem do contexto, não diz qual ética usa e carrega um
  preconceito contra jogos casuais. Mas reconhece valores úteis do texto original: **transparência** e **arrependimento** do
  jogador como pontos de partida.
- Evidência: opinião acadêmica (resumo de congresso; o congresso foi cancelado).
- Pro Kome: em vez de lista de proibições só, um teste: **a criança se arrependeria disso se entendesse como funciona?** Se o
  sorteio, o evento ou a carta de volta passam no teste da transparência, estão ok.

**F3. Predatory monetization schemes in video games (e.g. "loot boxes") and internet gaming disorder** · Daniel L. King, Paul
H. Delfabbro · Addiction, 2018 · https://digital.library.adelaide.edu.au/dspace/handle/2440/114018?mode=full [busca]
- Achado (pelo resumo e imprensa): esquemas de compra que escondem o custo de longo prazo, com solicitação inevitável e resultado
  de recompensa manipulado.
- Evidência: opinião acadêmica (editorial).
- Pro Kome: não temos dinheiro; o ponto que sobra é **"resultado manipulado"**: o sorteio do Kome tem que ser o que diz ser.

**F4. Video game loot boxes are linked to problem gambling: Results of a large-scale survey** · David Zendle, Paul Cairns ·
PLOS ONE, 2018 · https://eprints.whiterose.ac.uk/139116 [aberto, resumo]
- Achado: 7.422 jogadores; gasto com loot box se associa à gravidade de jogo-problema (η² = 0,054), mais que gasto com outros
  itens pagos (η² = 0,004). Não dá pra saber a direção da causa.
- Evidência: estudo empírico (questionário, adultos, correlacional).
- Pro Kome: reforça o "sem loot box", mesmo grátis com cara de caixa: não vale treinar o hábito.

**F5. Age Appropriate Design Code, padrão 5 (Detrimental use of data)** · ICO (Reino Unido), 2020 ·
https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/5-detrimental-use-of-data/
[aberto]
- Achado: cita "reward loops, continuous scrolling, notifications and auto-play" como estratégias pra estender o uso; pede não
  explorar a busca de recompensa, **não dar vantagem no jogo em troca de jogar mais**, apresentar a opção de continuar **de forma
  neutra, sem sugerir que a criança vai perder algo**, e considerar **pausa sem perder progresso**. Não fala de streak pelo nome.
- Evidência: norma (aplica-se a serviço que usa dado pessoal; o Kome não coleta nada, mas o espírito vale).
- Pro Kome: nenhuma frase tipo "se sair agora você perde o frenesi"; botão de pausa/fechar sempre neutro; bônus nunca por "tempo
  jogado seguido".

**F6. Disrupted Childhood: The Cost of Persuasive Design** · 5Rights Foundation (Beeban Kidron e outros) · 2018, atualizado
2023 · https://5rightsfoundation.com/in-action/disrupted-childhood-the-cost-of-persuasive-design-2023.html [aberto, só a página]
- Achado: design persuasivo é comum nos produtos que crianças usam e serve sobretudo a objetivos comerciais; o progresso desde
  2018 veio de lei (como o código do ICO), não da indústria. A página não lista as técnicas; segundo a cobertura de imprensa
  devolvida pela busca, o relatório de 2018 cita autoplay, feed infinito, notificações e recompensas [busca].
- Evidência: revisão de advocacy (relatório de ONG).
- Pro Kome: o Kome já está do lado certo (sem push, sem autoplay de corrida nova). Manter.

**F7. ECA Digital (Lei 15.211/2025)** · Brasil · sancionada em 17/09/2025 · cobertura: Piero Sellan e Leonardo A. Melo, ConJur,
22/10/2025 · https://www.conjur.com.br/2025-out-22/impactos-do-eca-digital-no-segmento-de-jogos-eletronicos/ [aberto]
- Achado: o artigo diz que o ECA Digital "vai além ao proibir expressamente as loot boxes" em jogos acessíveis a crianças e
  adolescentes, pede supervisão parental ligada por padrão com limite de tempo e "limitação de recursos que prolongam o uso", e
  condiciona venda de itens a verificação de idade e consentimento dos pais. Pela busca (não li o texto da lei): art. 20 veda
  caixas de recompensa; art. 2º, IV define loot box como aquisição **mediante pagamento** de itens aleatórios; vigência a partir
  de 17/03/2026 [busca].
- Evidência: norma (lida por advogados; não li a lei).
- Pro Kome: sorteio **grátis** não é loot box pela definição legal, mas a lei mostra a direção. O Kome fica longe: nenhum sorteio
  com cara de caixa/abrir pacote, nada pago, nada que "prolongue o uso" de propósito.

**F8. Streaks (sequências de dias)** · evidência só por busca [busca]
- A busca devolveu um estudo qualitativo com adolescentes de Viena sobre "snapstreaks" (Hristova e outros; n=7 na parte analisada)
  e menções a um estudo quantitativo (van Essen e outros, 2023) com associação **pequena** entre streak e uso problemático de
  celular. Não abri nenhum dos dois.
- Evidência: fraca e mista.
- Pro Kome: **não precisa de evidência de dano pra não usar**. Streak não traz nada que o Kome queira (o progresso já existe
  sem ele) e o mecanismo é perda (quebrar a sequência). Fica fora.

**F9. Interpassivity and the Joy of Delegated Play in Idle Games** · Sonia Fizek · ToDiGRA, 2018 ·
https://todigra.org/index.php/todigra/article/view/1754 [busca]
- Achado (pelo resumo): idle games questionam a ideia de jogo como escolha significativa; o prazer de "deixar a máquina jogar
  por mim" (interpassividade).
- Evidência: opinião acadêmica (ensaio teórico). Não li.
- Pro Kome: ver a frota trabalhar sozinha **é** um prazer legítimo do gênero. O pátio cheio de shibas trabalhando é recompensa
  por si.

**F10. A study of interaction in idle games & perceptions on the definition of a game** · Imran Khaliq, Blair Purkiss · IEEE
GEM 2015 · DOI 10.1109/GEM.2015.7377233 [busca, sem link aberto]
- Achado (pelo resumo): compara definições acadêmicas de jogo com um questionário de jogadores sobre idle games.
- Evidência: estudo empírico (questionário). Só vi o resumo; não sei os números.
- Pro Kome: nada acionável sem o texto.

**F11. Dados de mercado: "The rise of games you (mostly) don't play"** · Simon Parkin sobre palestra de Anthony Pecorella (GDC
2015) · Game Developer, 2015 · https://gamedeveloper.com/design/the-rise-of-games-you-mostly-don-t-play [aberto]
- Achado: retenção "incrível"; 3 dos 10 jogos mais jogados no Kongregate no mês eram idle; ganho offline (popularizado pelo
  AdVenture Capitalist) virou padrão; "sistema de energia natural" sem moeda de energia; alguns jogadores gastaram mais de US$1.000.
- Evidência: dado de mercado (qualitativo; sem números de retenção).
- Pro Kome: offline é padrão do gênero e esperado. O "gastou mais de mil dólares" é exatamente o lado que o Kome não tem.

---

## Princípios pro Kome
Números usados na `camada-cookie.md` como (P1)…(P12).

1. **P1 Virada, não só número.** Cada corrida e cada volta abre um sistema ou uma máquina nova; número sozinho cansa (A2, B3,
   B4, D2).
2. **P2 Sorte com piso.** Aleatório pequeno e honesto, piso alto, nunca zero, nunca "quase" (A7, A8, F3).
3. **P3 Meta à vista e real.** Sempre uma barra perto de fechar, mostrando progresso verdadeiro, sem selo de brinde (A9).
4. **P4 Retomar, não remoer.** Ao voltar, o que estava pela metade aparece pronto pra continuar; nada de "não esqueça de voltar"
   (A10, A12).
5. **P5 Escolha dentro do jogo.** Decisões no pátio e no cavar (qual máquina, quando viajar, quando usar o evento guardado), poucas
   e reais (A4, A11).
6. **P6 Número que vira imagem e piada.** Toda grandeza tem um desenho no pátio e um nome engraçado; passo visível ≥ 20% (B3, D1,
   D2, A2).
7. **P7 Curva clássica com máquinas velhas vivas.** Custo ×1,15, produção linear, marcos ×2, sinergias que dão motivo pra comprar a
   Pata com 300 Baggers (B1, B2).
8. **P8 Prestígio previsível e renovador.** Cartão de partir com previsão honesta; viajar abre coisa nova (B1, C, A1).
9. **P9 Esperar é presente.** Nada murcha; offline vira carta; platô no fim da corrida convida a parar ou viajar (F1, A2, A3).
10. **P10 Absurdo até o fim.** Escala de máquinas e nomes cada vez mais bobos, com história nos nomes (A2, D1, D2).
11. **P11 Criança primeiro.** Sem loot box, streak, push, culpa, FOMO, autoplay, bônus por tempo seguido; opções de sair neutras
   (F1–F8, A12).
12. **P12 Régua certa.** Compra repetida não é novidade; medir "novidade de verdade" separada de "comprinha" (A6, B3, e o próprio
   aviso do programador sobre o modelo de dopamina).

## O que não consegui verificar
- **`tools/dopamina.js` não está no repositório** (nem nesta branch nem nas outras do remoto). Usei só a descrição do pedido
  (pico por tipo, habituação ~20 min, meia-vida ~4 min, 15 min abaixo do limiar = larga). As metas da spec assumem isso.
- Textos completos que **não li**: Przybylski 2010, Deci 1999, King e Delfabbro 2018, Fizek 2018, Khaliq e Purkiss 2015, o
  relatório 5Rights (só a página), o texto da Lei 15.211 (só a análise do ConJur e resumos de busca), os estudos de streak.
- O artigo original de Hopson (2001) li; a retrospectiva dele de 2012 só pela busca.
- Não achei: palestra do Hevipelle em vídeo (só a entrevista escrita), palestras de design idle do grupo da Spiel além do artigo,
  números de retenção publicados de qualquer idle, estudo empírico sobre por que jogadores largam incrementais, nenhum estudo de
  incremental **com crianças**. Toda a parte "criança" é transferência de estudos com adultos + norma.
- O nome "Frank Lantz on Paperclips" em entrevista longa (Postgame, Y Combinator) não abri; uso só Wikipedia e o ensaio do Reed.
- Os números de Cookie Clicker vêm de wiki de fãs (versão 2.058), não do código.
