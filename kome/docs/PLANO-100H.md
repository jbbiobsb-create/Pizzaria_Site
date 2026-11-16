# Kome no Japão — plano pra virar um jogo de 100 horas

Documento de visão e de método. É a fonte da verdade pros chats que forem trabalhar no jogo: antes de começar um sistema
novo, ler este arquivo inteiro; antes de começar uma rodada, ler só a seção da fase em que se está.

---

## 1. A ideia em uma frase

**O que está feito é a primeira hora de um jogo maior.** O Kome hoje tem um verbo (cavar) e números que crescem. Pra durar
100 horas sem perder a essência, cada camada nova abre **um verbo novo e uma tela nova**, não só um número maior.

A essência que não muda:
1. **Shiba fofo × máquina absurda.**
2. **O arroz vai pra algum lugar.** Hoje ele vira ¥ no coletor. Daqui pra frente ele **vira coisa** (onigiri, mochi, sake,
   ramen), e essa coisa alimenta uma **cidade de shibas que cresce**. É essa a espinha das camadas: a matéria flui da
   montanha pra fábrica, da fábrica pra cidade, da cidade pro Japão.

---

## 2. Regras de design (valem pra toda camada)

1. **Camada nova = verbo novo + sistema novo.** Se a camada só multiplica um número, ela não é camada, é um upgrade.
2. **Decisão de verdade.** Cada camada tem pelo menos uma escolha com troca ("produzo mochi ou sake?", "qual loja abro
   primeiro?", "qual região conecto?"). Fim do "compra o mais barato".
3. **Abre quando a anterior está madura**, nunca antes. A criança que joga 1 hora tem um jogo completo (montanha + casa +
   final). Quem continua vai descobrindo.
4. **Sessões curtas por muitos dias.** Abrir 10 minutos, ver o que cresceu, decidir uma coisa, fechar. Sempre tem algo bom
   esperando. **Nunca** tem algo ruim esperando: nada murcha, nada morre, nada se perde por não jogar.
5. **Prestígio que muda o jogo.** Zerar devolve um sistema novo pra mexer, não só +10%.
6. **Tudo visível.** Continua valendo a regra de sempre: toda compra muda algo na tela. Na fábrica e na cidade isso é ainda
   mais fácil, porque o que você constrói fica lá.
7. **Conteúdo é ficha, sistema é código.** Cada sistema novo nasce com o seu tipo de ficha em `conteudo/`, pra que receitas,
   moradores, pedidos e fósseis sejam baratos de adicionar.
8. **Continua proibido:** dinheiro real, loot box paga, notificação push, culpa, quase-acerto fabricado, punição por parar.

---

## 3. As camadas

| # | Camada | Verbo novo | Tela | Abre quando | Horas |
|---|---|---|---|---|---|
| 1 | Montanha (feito) | cavar, comprar máquinas | Montanha (lado) | início | ~1 h |
| 2 | Ilhas (feito) | viajar, escolher sementes | Montanha + Mapa do Japão | final da campanha | +3 h |
| 3 | Fábrica | montar cadeias de produção | Pátio visto de cima | 1ª ilha concluída | +10–20 h |
| 4 | Cidade | atender pedidos, construir a vila | Vila vista de cima, dá pra andar | 10 produtos diferentes feitos | +20–40 h |
| 5 | Japão inteiro | conectar regiões por trem, exportar | Mapa do Japão ampliado | vila nível X + 5 ilhas | +20 h |
| 6 | Absurdo final | meta-prestígio com superpoder | todas | Japão conectado | sem fim |

### 3.1 Camada 1 — A montanha (feita)
Cavar, combo, mordida perfeita, 14 ferramentas, árvore, casa, final. Não mexer na essência. O que ela ganha nas fases
seguintes: **tipos de arroz** (cada ilha e cada camada da montanha dão um arroz diferente) que viram matéria-prima da
fábrica, e **segredos** (fósseis, bolsões raros, o dinossauro de arroz).

### 3.2 Camada 2 — Ilhas (feita)
Prestígio com Sementes Douradas, 5 ilhas, cada uma com cena, regra, evento e medalhas, Volta 2+, Grande Final do Kome-Oh.
O que ela ganha: **cada ilha libera ingredientes e receitas exclusivas** pra fábrica (Hokkaido: arroz gelado → sorvete de
mochi; Kyushu: curry → curry rice; Okinawa: açúcar de cana → sata andagi; Ilha de Mochi: mochigome → daifuku). Assim viajar
deixa de ser só "renda maior" e passa a abrir cardápio novo.

### 3.3 Camada 3 — A Fábrica (próxima)
**Um mini Factorio fofo no pátio.** O arroz que chega no coletor vira insumo. Você constrói máquinas de processamento num
grid visto de cima, liga com esteiras e decide o que produzir.

- **Verbo:** posicionar máquinas, ligar esteiras, escolher receita de cada máquina.
- **Cadeias de exemplo:**
  - arroz → **panela** → arroz cozido → **moldadora** → onigiri
  - arroz cozido + alga → **moldadora** → onigiri de alga (vale mais)
  - mochigome → **pilão** (um shiba batendo com o martelão, o mochitsuki) → mochi → **recheio** + anko → daifuku
  - arroz → **fermentador** → sake (lento, vale muito)
  - arroz → **moinho** → farinha → ramen (precisa de caldo, que vem da cidade)
- **Decisão:** espaço limitado no grid, máquinas com velocidades diferentes, gargalos visíveis (esteira entupindo com
  montinho de onigiri). O jogador otimiza: duplica o pilão lento, reorganiza a linha, escolhe vender cru ou processar.
- **Sem punição:** gargalo nunca perde arroz; o excesso vira estoque que ainda vende como arroz cru.
- **Ligação com o que existe:** `game/belts.js` já leva arroz do coletor até uma fábrica que hoje é enfeite
  (`game/industry.js`). A fábrica de verdade substitui esse enfeite: a esteira 2 passa a entrar no grid.
- **Prestígio:** a planta da fábrica (layout) **fica** entre ilhas; o que zera é o nível das máquinas. Voltar a uma ilha e ver
  a sua fábrica ligando é recompensa.
- **Visual:** shibas de touca operando cada máquina, vapor das panelas, o martelão do mochi, produtos andando na esteira.
  Na tela da montanha, a fábrica aparece no pátio (como hoje), funcionando.
- **Coleção:** "Cardápio do Kome", com cada produto descoberto, a receita e uma frase.

### 3.4 Camada 4 — A Cidade
**Os produtos alimentam a vila.** Shibas se mudam, moram, pedem coisas e abrem lojas.

- **Verbo:** atender pedidos, construir e posicionar casas e lojas, decidir o que a vila vira.
- **Moradores com nome e carinha** (ficha `morador`), cada um com gostos ("a vó Kiku adora daifuku"). Pedidos curtos
  (ficha `pedido`): "12 onigiris de alga pro piquenique" → recompensa + coração com aquele morador.
- **Lojas** (já existe o embrião em `D.SHOPS`): konbini, sushi, mochiya, sake, ramen. Cada loja consome um produto e
  devolve ¥ e moradores novos. **Decisão:** espaço e produção limitados → que lojas abrir, onde.
- **Turistas e estações:** primavera (hanami), verão (festival de fogos), outono (colheita), inverno (ano-novo com mochi).
  Cada estação pede produtos diferentes e traz um festival com decoração.
- **Andar na vila:** o Kome anda pela rua (mesmo controle da montanha), cumprimenta os moradores, entra nas lojas. É a tela
  de "respirar" entre sessões de cavar.
- **Crescimento em tempo real sem punição:** a vila cresce enquanto você está fora (casas sendo construídas, árvores
  crescendo); nada decai.
- **Prestígio:** a cidade é **permanente**. É o que dá peso ao jogo longo: depois de 30 horas, você tem uma vila que é sua.

### 3.5 Camada 5 — O Japão inteiro
**Mapa do Japão com regiões**, e o trem levando carga entre elas.

- **Verbo:** conectar regiões com trilhos, escolher o que cada trem leva, exportar.
- Cada região tem demanda própria (Tóquio quer volume, Kyoto quer qualidade, Osaka quer comida de rua) e uma especialidade.
- **Trens** evoluem do trem velho ao trem-bala (já há trilho com trem no pátio: aproveitar o desenho).
- **Rivais fofos:** outra fazenda de arroz (um tanuki empresário, um gato com a sua própria Bagger) disputando a mesma
  região; competição leve por ranking semanal contra a IA, sem perda.
- **Eventos sazonais nacionais** (festival de Sapporo na neve, Tanabata).

### 3.6 Camada 6 — O absurdo final
**Meta-prestígio "Renascer do Kome":** reinicia tudo (menos coleção, roupas e o meta-recurso) e devolve um **superpoder**
que muda o jogo de novo. Exemplos: começar com o Kome-Oh; cavar o próprio **Monte Fuji**; levar a fábrica pra **Lua de
Mochi** (gravidade baixa, arroz flutua). Sem fim: cada Renascer tem uma meta maior e mais boba.

---

## 4. Sistemas que atravessam todas as camadas

- **Ganho offline:** "Enquanto você dormia, o Kome cavou ¥X, a fábrica fez 300 onigiris e chegou um morador novo." Limite
  de 8–12 horas, sempre positivo, mostrado como uma carta ao abrir.
- **Carta do dia:** ao abrir o jogo, 1 coisa boa nova (um pedido especial, um fóssil revelado, uma carpa nasceu).
- **Coleção longa com raridade:**
  - **Fósseis** enterrados na montanha (ficha `fossil`), montados num museu no quintal; o **dinossauro de arroz** é o raro.
  - **Carpas** que se reproduzem no lago (genética simples de cor e padrão), com variedades raras.
  - **Roupas** (já existe) e **cartas de shiba** (cada morador vira carta quando o coração enche).
  - O Caderno junta tudo, com porcentagem de completo.
- **Habilidade pra quem gosta de jogar:** aprofundar a mordida perfeita e o combo (ritmo, precisão), **montanhas desafio**
  (só hashi, sem combo, 5 minutos) com medalhas, recordes por ilha.
- **Metas à vista sempre:** cada camada tem a sua barra de progresso no topo e a próxima camada aparece como silhueta com
  "?" e a condição pra abrir.

---

## 5. Arquitetura (o que precisa existir antes da Fábrica)

A camada 3 em diante pede coisas que o jogo ainda não tem. Fazer **primeiro**, numa rodada só de alicerce:

1. **Itens tipados.** Hoje o arroz vira ¥ direto. Passa a existir um inventário de itens: `D.ITEMS` (arroz solto, prensado,
   gelado, curry, mochigome, onigiri, mochi, sake...), cada um com valor de venda. O coletor passa a guardar itens; vender
   continua automático pra quem não quer mexer.
2. **Simulação separada do desenho**, rodando por tempo (`sim.tick(dt)`), pra ganho offline e pra fábrica e cidade
   funcionarem fora da tela. O jogo já tem `step(dt)` headless: generalizar pra todos os sistemas.
3. **Segunda tela (vista de cima).** Uma cena nova na engine (`E.Scenes`), com câmera de cima, grid e seleção por toque.
   A montanha continua sendo a tela de ação; a fábrica e a cidade usam a tela de gestão. Troca por um botão sempre visível
   ("Montanha / Pátio / Vila"), com transição curta.
4. **Save versionado com migração por camada** (o `E.Save` já tem `version` e `migrate`). Cada camada adiciona um bloco
   ao save e uma migração; save antigo nunca quebra.
5. **Fichas novas no kit** (`tools/content.js` + `tools/novo.js`): `receita`, `maquina`, `morador`, `pedido`, `predio`,
   `fossil`, `carpa`, `estacao`, `desafio`. Cada tipo é 1 bloco no gerador + 1 leitor no jogo.
6. **Simulador de balanço por camada** (como o `playtest.js --auto`): roda a camada sozinha em velocidade alta e imprime
   tempo pra cada marco. Sem isso, 100 horas viram chute.

---

## 6. Ordem de construção (o método)

Cada fase entrega uma **fatia vertical jogável**: a menor versão da camada que já é divertida, ligada ao resto, salvando,
com balanço medido. Só depois vem o conteúdo em volume. Nunca construir duas camadas ao mesmo tempo.

| Fase | Entrega | Pronto quando | Rodadas (aprox.) |
|---|---|---|---|
| 0. Alicerce | itens tipados, sim por tempo, offline, 2ª tela vazia, migração de save, fichas novas | jogo de hoje funciona igual, coletor mostra itens, carta de offline aparece, tela de cima abre e fecha | 1–2 |
| 1. Fábrica MVP | grid 8×6, esteira, 3 máquinas (panela, moldadora, pilão), 4 receitas, gargalo visível, decisão de receita | dá pra montar uma linha arroz→onigiri e outra arroz→mochi e ver a renda mudar; sim de balanço da fábrica | 2 |
| 2. Fábrica completa | 8–10 máquinas, receitas por ilha, layout que fica no prestígio, Cardápio, upgrades visuais | 20+ produtos; ilhas abrem receitas; 10–20 h medidas no sim | 2–3 |
| 3. Cidade MVP | vila de cima, 5 moradores, pedidos, 3 lojas consumindo produtos, andar na rua | pedido → entrega → coração → morador novo funciona; vila cresce offline | 2–3 |
| 4. Cidade completa | estações e festivais, 30+ moradores, cartas, turistas, decoração | 4 estações com festival; 20–40 h no sim | 3–4 + conteúdo por fichas |
| 5. Japão | mapa de regiões, trens, demanda por região, rivais | 6–8 regiões conectáveis; trem-bala | 2–3 |
| 6. Absurdo | Renascer, superpoderes, Fuji, Lua de Mochi | 3 superpoderes e a Lua jogável | 2–3 |
| contínuo | fósseis, carpas, desafios, roupas, eventos | via fichas, sem sistema novo | barato, a qualquer hora |

**Por que a Fábrica primeiro:** continua direto do que existe (o arroz já anda de esteira até uma fábrica de enfeite), é a
camada que transforma "números" em "decisões", e prepara os itens que a Cidade vai consumir.

---

## 7. Como trabalhar com os chats (pra não se perder)

1. **Este arquivo é a visão.** `CONTINUAR.md` é o estado. `MAPA.md` é onde mora cada coisa. Cada rodada começa lendo
   `CLAUDE.md`, `MAPA.md` e a seção da fase aqui.
2. **Uma rodada = um sistema ou uma fatia de fase.** O pedido de rodada segue este molde:
   > Fase N, item X do `docs/PLANO-100H.md`. Entregar: [lista]. Pronto quando: [critério da tabela]. Não mexer em:
   > [arquivos de outras camadas]. No fim: atualizar `CONTINUAR.md`, `MAPA.md`, `PATCH-NOTES.md`, commitar.
3. **Design curto antes de código** em sistemas grandes: a rodada escreve primeiro `docs/fase-N.md` (1 página: dados, telas,
   decisões do jogador, números iniciais) e só depois implementa. O dono lê em 2 minutos e corrige a direção cedo.
4. **Dados antes de lógica.** Toda tabela nova em `game/data.js` (ou em fichas). Balanço só lá.
5. **Dois chats ao mesmo tempo, sem pisar um no outro:**
   - **Chat de sistemas** faz a fase atual (código novo).
   - **Chat de conteúdo** só cria fichas (`conteudo/`) dos tipos que já existem, e polimento visual em arquivos que o chat de
     sistemas não está mexendo.
   - Antes de começar, cada um anota no topo do `CONTINUAR.md` em quais arquivos está mexendo.
6. **Testes:** o dono tem testador na máquina. Cada rodada roda só `node tools/check.js --fast` no fim e o simulador de
   balanço da camada que mexeu; o resto o dono testa.
7. **Git:** commit ao fim de cada passo que funciona, mensagem curta dizendo a fase.

---

## 8. Custo, sendo honesto

- **Sistemas** (alicerce, fábrica, cidade, mapa, renascer) são o que custa de verdade: cada um parecido com as rodadas
  grandes de hoje (o fim de jogo das ilhas, por exemplo). Somando as fases 0 a 6, são umas 15–25 rodadas grandes.
- **Conteúdo** (receitas, moradores, pedidos, fósseis, roupas, eventos) fica barato graças às fichas: dá pra fazer dezenas
  por rodada.
- **100 horas** vêm de: ~1 h montanha + ~3 h ilhas + 10–20 h fábrica + 20–40 h cidade + ~20 h Japão + absurdo sem fim, com
  sessões curtas por muitos dias e coleção longa costurando tudo.

## 9. Riscos e o que cortar se apertar

| Risco | Como evitar |
|---|---|
| Fábrica virar planilha chata | manter grid pequeno, poucas máquinas por vez, tudo animado e fofo; "vender cru" sempre funciona |
| Celular apertado na tela de cima | grid grande com zoom, toque pra selecionar, sem arrastar fino; testar em pé desde a fase 1 |
| Balanço desandar com 6 camadas | simulador por camada + cada camada multiplica pouco a anterior; a renda nova vem do sistema novo |
| Save quebrar | migração obrigatória por fase; testar save antigo a cada rodada |
| Perder a essência | toda fase passa pelo teste: "o shiba fofo e a máquina absurda aparecem? o arroz vai pra algum lugar?" |

Cortar nesta ordem, se faltar fôlego: rivais → exportação → turistas → festivais extras → andar na vila (vira só vista de
cima). **Nunca cortar:** fábrica com decisão, cidade com moradores e pedidos, offline positivo, coleção.

## 10. Primeiro passo concreto

**Fase 0 — Alicerce**, numa rodada:
1. `D.ITEMS` + inventário no coletor (venda automática continua igual).
2. `sim.tick(dt)` comum a todos os sistemas + ganho offline com carta ao abrir (limite 8 h).
3. Cena de cima vazia com grid e botão "Montanha / Pátio".
4. Migração de save pra nova versão.
5. Fichas `receita` e `maquina` no kit (ainda sem uso).
6. `docs/fase-1-fabrica.md` com o design de 1 página da Fábrica MVP, pro dono aprovar antes da fase 1.
