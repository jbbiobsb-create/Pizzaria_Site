# Pedido pro Fable: a "camada Cookie" (100 h sem inventar 5 jogos)

Contexto da conversa do dono com o programador (18/11). Tua tarefa no fim.

## A pergunta do dono
"O que falta pro nosso jogo ter 100 h de diversão pura?" e "como a gente faz pra ser tipo um Cookie Clicker, pra expandir
foda com o que temos hoje, mas sem precisar inventar 4/5 jogos diferentes?"

O PLANO-100H previa 6 camadas (Fábrica completa, Cidade, Japão, Absurdo...), com umas 15 a 25 rodadas. O dono quer um
caminho mais barato: **um jogo só, com muitas camadas de número e coleção por cima**, como o Cookie Clicker (100+ h).

## O que o jogo tem hoje (estimativa: 5 a 8 h boas)
- Campanha da montanha (~70 min), a parte mais redonda.
- 4 ilhas e voltas (~2 a 3 h por volta completa; as voltas repetem as ilhas mais caras).
- Modo infinito: Oficina, Bagger Gêmea, lojas, Tatuzão.
- Fábrica (1 a 2 h), ainda solta do resto.

## Medição: "jogador de dopamina" (`tools/dopamina.js`)
Um modelo SIMPLES, não diversão de verdade: cada novidade dá um pico de dopamina (peso por tipo); a mesma coisa repetida
vale cada vez menos (habituação, esquece em ~20 min); a dopamina cai sozinha (meia-vida ~4 min); 15 min seguidos abaixo
do limiar = larga o jogo. Serve pra COMPARAR versões com a mesma régua.

**Jogo de hoje** (6 h simuladas pelo `tools/longo.js`, eventos reais):
```
dopamina a cada 15 min: ▃██▆█▆·██▃·█▃·██▃▁█▃···▃▃      (█ alto · ▁ baixo · · entediado)
```
- Não largou em 6 h; engajado 81% do tempo; 505 novidades.
- 13 trechos de 10 a 16 min SEM NOVIDADE, todos no **modo infinito** entre ilhas.
- Padrão "picos e buracos": a campanha e o começo de cada ilha são ótimos; o modo infinito morre.

**Modelo "camada Cookie"** (matemática pura, 100 h): 14 máquinas, cada uma comprável VÁRIAS vezes (preço ×1,15),
marcos ×2 em 1/5/25/50/100…, conquistas por marco, evento dourado a cada 3 a 8 min, prestígio que zera e dá bônus.
- Aguentou as 100 h; engajado 96%. Nunca fica tão alto quanto a campanha, mas quase nunca zera. Cada prestígio dá um pico.
- Ressalva: o modelo gosta muito de "comprinha a cada 3 s"; um jogador real pode achar repetitivo se não tiver VISUAL
  (o pátio enchendo de tratores com shibas).

## A proposta: mapa Cookie Clicker → Kome
| Cookie Clicker | Já temos | Falta |
|---|---|---|
| Prédios (cursor, vovó, fazenda…) | 14 ferramentas + frota | **Comprar VÁRIAS de cada** (50 tratores), cada uma rende e APARECE no pátio |
| Upgrade de prédio (×2 em 1/5/25/50/100) | árvore de 71 nós | **centenas** de upgrades por marco de quantidade, vindos de PLANILHA |
| Cookie dourado | sacos dourados, onigiri, bolsões | mais tipos (frenesi, chuva de arroz, Kome gigante), raros e com festa |
| Conquistas + "leite" (bônus por conquista) | 30 conquistas, selo +1% cada | **centenas**, por planilha |
| Prestígio (chips celestiais) | viagem de ilha + sementes | árvore de sementes MUITO maior; voltas infinitas |
| Minijogos (jardim, bolsa) | Fábrica, Tatuzão | ficam opcionais (a Cidade pode virar um minijogo depois) |
| Números absurdos | já chega a "quatri" | seguir com nomes engraçados |
| Ganho offline | `E.Sim` pronto, não ligado | ligar |

O único SISTEMA novo é "quantidade de cada máquina". O resto é tabela (`tools/planilha.js` já transforma CSV em conteúdo).
Custo estimado: 3 a 5 rodadas pro sistema, conteúdo em volume por planilha.

## TUA TAREFA
### 1. Pesquisa (antes de desenhar)
Procure **artigos científicos e de psicologia** (e bons textos de designers) sobre jogos incrementais/idle — Cookie
Clicker, Adventure Capitalist, Universal Paperclips, Antimatter Dimensions, Melvor, Clicker Heroes, Egg Inc. e similares.
Temas que interessam:
- por que incrementais prendem: esquemas de reforço (razão variável, intervalo), "near-miss", efeito Zeigarnik, metas à
  vista, progresso visível, coleção/completude, autonomia e competência (teoria da autodeterminação), flow;
- curvas de custo/produção e o "ritmo de novidade" (quanto tempo entre coisas novas em cada fase); prestígio como
  renovação; o papel do humor e do absurdo (Cookie Clicker) e da narrativa que se revela aos poucos (Paperclips);
- o que dá TÉDIO e abandono nesses jogos (paredes de espera, número sem significado, falta de decisão);
- **ética e crianças**: o que é manipulação (dark patterns, culpa, streak, FOMO, loot box) e como ter o gancho SEM isso.
Traga as fontes (título, autor, ano, link quando tiver) e, pra cada ideia, **"o que isso significa pro Kome"**.
Seja honesto quando a evidência for fraca ou for só opinião de designer.

### 2. Spec de 1 página: `docs/design/camada-cookie.md` (status `rascunho`, formato do README)
Usando a pesquisa: quantidade de máquinas (preço, rendimento, quanto aparece no pátio sem virar bagunça), marcos de
upgrade, eventos dourados novos, árvore de prestígio maior, conquistas em massa, ganho offline, e **metas de ritmo** que eu
consigo medir no `tools/longo.js` + `tools/dopamina.js` (ex.: "nunca mais de 5 min sem novidade no modo infinito",
"um prestígio a cada X h", "100 h até a última conquista").

### 3. Planilha-modelo
Um CSV curto de exemplo (10 a 20 linhas) dos upgrades, conquistas e eventos, no formato que você achar melhor; eu adapto o
`tools/planilha.js` pra ler.

## Regras de sempre
Criança joga: sem dinheiro real, sem loot box, sem culpa, sem streak que pune, sem push, sem "quase ganhou" fabricado.
Nada estraga enquanto o jogador está fora. Números só em `game/data.js`. Celular deitado. O dono aprova a spec antes de eu
construir. No resumo, diga o que você NÃO conseguiu verificar.
