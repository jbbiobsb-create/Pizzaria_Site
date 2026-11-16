# Fábrica (MVP)
status: rascunho
camada: 3 · Fábrica   ·   depende de: alicerce (itens tipados, Armazém, E.Sim/offline, save com migração), belts.js

## Em uma frase
O galpão KOME PACK vira um mini-Factorio fofo visto de cima: você põe panela, moldadora e pilão num grid pequeno, liga com
esteira e transforma arroz cru em onigiri e mochi, que valem muito mais. A graça é **montar a linha e ver o gargalo andar**.

## Como funciona (regras)
1. O arroz que você cava continua indo pro coletor e vendendo cru, como hoje.
2. A **Doca de Entrada** (lado esquerdo do grid, uma boca por linha do grid) puxa uma **porcentagem** do arroz que você cava
   (10% no nível 1; assim a fábrica acompanha o seu ritmo de cavar). Esse arroz
   **não é vendido cru** (não paga duas vezes). O que passa da capacidade continua vendendo cru na hora: **nada se perde**.
3. A esteira leva os sacos até as máquinas. Cada máquina recebe por trás e pelos lados e solta pela frente (setinhas no
   desenho). Item que a máquina não usa (ou que sobra enquanto ela espera outro ingrediente) **passa reto**, então a linha
   nunca trava por ingrediente errado.
4. **Divisor** (peça de esteira 1×1, grátis): manda os itens alternando pra esquerda e pra direita. É o que deixa alimentar
   2–3 máquinas em paralelo a partir de uma linha só.
5. Produto que chega na **Doca de Venda** (lado direito) vende sozinho: estoura um "+¥" no prédio e soma na renda.
   Qualquer item pode ser vendido ali, inclusive o intermediário (arroz cozido).
6. **Gargalo nunca perde nada:** se uma máquina está cheia, a esteira para e acumula montinhos visíveis; a Doca de Entrada
   puxa menos e o resto vende cru.
7. Mover máquina é grátis; tirar devolve 100% do preço. Esteira é grátis e infinita (o limite é o espaço).
8. **Offline:** roda a 100%, mas só processa o arroz que entrou no Armazém enquanto você estava fora (dos ajudantes, no
   ritmo offline que já existe). Carta ao voltar: "a fábrica fez 340 onigiris".

## Desbloqueio e progressão
- **Abre no final da campanha** (junto com a Oficina), com um banner "O galpão KOME PACK abriu!" e o botão **Fábrica**
  aparecendo no topo. Primeira visita: tutorial de 4 toques (Doca de Entrada → panela → doca de venda → "pronto, veja o +¥").
- **Já vem montado:** Doca de Entrada → esteira → 1 Panela (grátis) → esteira → Doca de Venda. O 1º arroz cozido vende em
  menos de 30 s.
- **Moldadora** à venda desde o início. **Pilão** abre quando você fizer 600 onigiris (~15 min). **Receita Mochi Dourado** abre
  quando você fizer 20 mochis e tiver Arroz Dourado (koshi) no Armazém.
- Cada máquina sobe de nível (+25% de velocidade por nível, máx. 10 nesta versão). A Doca de Entrada também sobe (capacidade).
- **A fábrica nunca zera:** layout e níveis ficam ao mudar de ilha. Ela não estraga o começo da ilha nova porque só
  processa o que você cava: com pouco arroz entrando, a fábrica rende pouco. É o "sistema novo que o prestígio guarda".

## Números (ponto de partida; o programador calibra com o simulador)
Valores em "× 1 saco de arroz solto vendido cru". Preços em **segundos de renda** (mesmo padrão das fichas, travado pelo
`priceIps`). Velocidade no nível 1.

| Máquina | Grid | Preço | Receita | Tempo | Produto vale |
|---|---|---|---|---|---|
| Panela (donabe) | 1×1 | grátis a 1ª; depois 40 s | 1 saco arroz (solto ou integral) → 1 arroz cozido | 1,0 s | 2× |
| Moldadora | 1×1 | 60 s | 1 cozido → 1 onigiri | 1,0 s | 4× |
| Pilão (mochitsuki) | 2×1 | 240 s | 2 cozidos → 1 mochi | 3,5 s | 12× (6× por saco) |
| Pilão, receita 2 | 2×1 | (mesmo pilão) | 2 cozidos + 1 Arroz Dourado cru → 1 Mochi Dourado | 4,5 s | 48× (vs 8× vendendo cru) |

| Outro | Valor |
|---|---|
| Doca de Entrada | puxa 10% do arroz cavado no nível 1; +5 pontos por nível (máx. 50% no nível 9); preço = 30 s × 1,6^nível |
| Divisor | 1×1, grátis, alterna esquerda/direita |
| Nível de máquina | preço = preço base × 1,6^nível; +25% velocidade |
| Esteira | 2 casas/s; grátis |
| Dinheiro inicial | nenhum extra: a 1ª compra sai da renda normal (meta ≤ 2 min) |
| Grid | 8×6 casas (48), fixo nesta versão |

**Metas de ritmo** (pro simulador conferir):
- 1º cozido vendido ≤ 30 s depois de abrir a fábrica.
- 1ª compra (Moldadora) ≤ 2 min; 1º onigiri ≤ 3 min.
- Pilão abre por volta de 15 min de fábrica.
- Fábrica = ~10% da renda aos 15 min, ~30% depois de 1 h, teto ~50% (o resto continua vindo de cavar).
- Espera máxima entre compras da fábrica ≤ 3 min.
- **Primeira vez que falta espaço no grid: 40–60 min.** É o momento da decisão (abaixo).

## A decisão de verdade
- **Espaço é o limite.** 48 casas; esteira ocupa casa. Linha de onigiri é rápida e cabe fácil; linha de mochi rende mais
  por saco mas o pilão é lento e ocupa 2 casas, então precisa de 2–3 pilões alimentados por várias panelas.
- **Cru × processado.** Subir a Doca de Entrada puxa mais arroz, mas se as máquinas não dão conta ele só acumula na
  esteira. Vale mais subir a doca ou mais uma panela?
- **Dourado: vender cru ou virar Mochi Dourado.** O Arroz Dourado já vale bem cru; no pilão vale 6× mais, mas ocupa o pilão
  que faria mochi comum.
- Visível sempre: cada máquina mostra uma barrinha de "ocupada %"; montinho acumulando na esteira = gargalo ali.

## Tela e controles (celular deitado)
Botão **Fábrica** no topo (ao lado do chip das Ilhas) troca pra tela de cima; o botão vira **Montanha** pra voltar.
A montanha continua rodando por trás (ajudantes e frota seguem cavando).

```
┌──────────────────────────────────────────────────────────────┐
│ [Montanha]   Fábrica ¥1,2 mi/s (28% da renda)   onigiri 1.204 │
│                                                               │
│  ENTRADA ▶ ═══ [Panela] ═══ [Moldad.] ═══════════════ ▶ VENDA │
│  (doca)    ║                                          (doca)  │
│            ╚═ [Panela] ═══ [ Pilão  ] ══════════════╝         │
│                 grid 8×6, casas de 52 px                      │
│                                                               │
│ [Panela] [Moldad.] [Pilão] [Esteira] [Divisor] [Borracha] [↶]  │
└──────────────────────────────────────────────────────────────┘
```
- Casas de 52 px (grid 416×312 no meio da tela 960×540); botões da barra ≥ 44 px.
- **Pôr máquina:** toca o botão na barra e toca a casa. **Mover:** arrasta a máquina. **Girar:** toque duplo na máquina.
- **Esteira:** com "Esteira" ativa, arrasta o dedo pelas casas; a direção segue o arrasto. Toque numa esteira gira.
- **Borracha:** toca pra apagar (máquina devolve o preço). **Desfazer** volta a última ação.
- Toque numa máquina (sem ferramenta ativa) abre o cartão: nível, receita (troca entre as receitas dela), ocupada %,
  botão de subir nível.

## Conteúdo
Itens novos em `D.ITEMS`: `cozido` (Arroz Cozido), `onigiri` (Onigiri), `mochi` (Mochi), `mochi_dourado` (Mochi Dourado),
cada um com ícone e a frase do Cardápio:
- Arroz Cozido: "fofinho, ainda soltando vapor"
- Onigiri: "o triângulo que move o Japão"
- Mochi: "batido no pilão com muito esforço e um 'yoisho!'"
- Mochi Dourado: "dizem que dá sorte. dizem que dá MUITA sorte"

Desenhos das máquinas (pixel em texto; contorno e 3 tons automáticos; o programador ajusta o formato da ficha `maquina` se
precisar):

```js
ficha({ tipo: 'maquina', id: 'panela', nome: 'Panela', desc: 'cozinha o arroz', escala: 3, desenho: `
  ....oOOOOo....
  ...OOOOOOOO...
  ..oOOOOOOOOo..
  .NNNNNNNNNNNN.
  .oKKKKKKKKKKo.
  oKKKKKKKKKKKKo
  oKKKKKKKKKKKKo
  .oKKKKKKKKKKo.
  ..MMMMMMMMMM..
  .MRYRRYRRYRRM.
  .MMMMMMMMMMMM.
` });
ficha({ tipo: 'maquina', id: 'moldadora', nome: 'Moldadora', desc: 'aperta o arroz em triângulo', escala: 3, desenho: `
  ....SSSSSSSS....
  ....SssssssS....
  ......SSSS......
  ......SssS......
  .......AA.......
  ......AAAA......
  .....AAAAAA.....
  SSSSSSSSSSSSSSSS
  SBBBBBBBBBBBBBBS
  SBbbbbbbbbbbbbBS
  SSSSSSSSSSSSSSSS
  .SS..........SS.
` });
ficha({ tipo: 'maquina', id: 'pilao', nome: 'Pilão', desc: 'um shiba bate o mochi com o martelão', escala: 3, desenho: `
  ...AAAAAAAA...
  ..KAAAAAAAAK..
  .KKKKKKKKKKKK.
  .KkkkkkkkkkkK.
  ..KKKKKKKKKK..
  ..KkkkkkkkkK..
  ...KKKKKKKK...
  ..KKKKKKKKKK..
` });
```
- Operadores: shibas de touca feitos com o gerador de bicho (`receita: { gerador: 'bicho', especie: 'cachorro',
  acessorio: 'gorro' }`), um em cada máquina, animando quando ela trabalha.
- No pilão, o martelão (kine) é peça separada que sobe e desce; um segundo shiba vira o mochi entre as batidas.

## Visual e som
- Galpão de madeira clara visto de cima, chão de tábuas, janelinhas com luz; produtos andando na esteira como montinhos
  (arroz) e mini-ícones (onigiri, mochi).
- Panela solta vapor quando trabalha; moldadora "carimba" com um pistãozinho; pilão: martelada com squash do mochi e
  partícula de farinha.
- Na tela da montanha, o galpão KOME PACK passa a soltar caixas por uma porta e um kei-truck leva embora (a fábrica
  funcionando aparece no mundo).
- Som: borbulho da panela, "ploc" da moldadora, "PON!" do pilão com latidinho "yoisho!", caixa registradora na doca com
  tom mais agudo pra produto mais caro.
- Máquinas desta versão são pequenas (pixel). Nenhuma vetorial grande.

## Fora do escopo
- Aumentar o grid, filtros de esteira por tipo, prioridade de receita.
- Receitas por ilha (curry rice, sorvete de mochi, sata andagi, daifuku), alga, anko, sake, ramen.
- Pedidos da cidade e guardar produto pra entregar (fase 4).
- Linha industrial grande e vetorial, energia, qualidade de produto, o Kome andando dentro do galpão.
- O Cardápio completo (nesta versão só a lista dos 4 produtos na aba Armazém).

## Mudanças depois do protótipo (17/11)
O protótipo jogável (`demos/fabrica.html`) mostrou 7 problemas; a spec acima já está corrigida:
1. Pilão abria cedo demais (50 onigiris = 77 s): agora 600 (~15 min).
2. Doca fixa em 2 sacos/s fazia a fábrica piorar quanto mais você cava (33% → 3%): agora puxa % do arroz cavado.
3. Pilão fraco pelo preço e espaço: 3,5 s e 12× (6× por saco, contra 4× do onigiri).
4. Máquinas em paralelo exigiam uma linha por máquina: entrou o **Divisor**.
5. Panela (0,67/s) contra doca (2/s) parecia quebrado desde o 1º segundo: panela 1,0 s e doca por %.
6. Mochi Dourado raro com 5% de dourado: no jogo o dourado vem do Núcleo Koshihikari e dos bolsões, então aparece em rajadas
   quando você cava ali; manter e medir. Se ficar raro demais, a doca ganha prioridade pro dourado.
7. Dinheiro inicial comprava tudo no 1º quadro: sem dinheiro extra.
Também ficou como regra (era improviso do protótipo): máquina recebe por trás e pelos lados, e item sem uso passa reto.

## Perguntas do programador
(o programador escreve aqui; o designer responde embaixo de cada uma)
