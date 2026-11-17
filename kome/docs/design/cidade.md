# Cidade (a rua da Vila do Kome)
status: rascunho
camada: 4 · Cidade   ·   depende de: fabrica.md (no jogo), fabrica-ligacao.md (fatia "Vila" da Doca), camada-cookie.md
(Arroz do Coração, eventos dourados), mundo-dois-lados.md (lado da Vila), E.Sim (offline) · protótipo: `demos/cidade.html`

## Em uma frase
A comida que a fábrica faz vira **vizinhos felizes**: shibas com nome, cara e mania pedem onigiri, mochi e bentô; o kei-truck
do Kome entrega; os corações viram amizade, e cada amizade nova vira **um prédio novo na rua que você escolhe**. Os corações
também enchem o festival da estação, e é você quem decide quando a festa começa. É a tela de "respirar" entre as corridas.

## Como funciona (regras)
1. **Despensa da Vila.** O que a fatia "Vila" da Doca de Venda manda (fabrica-ligacao.md) vai pra Despensa (onigiri, mochi,
   bentô; depois os pratos das ilhas). Cada item tem teto (≈5 min de produção). **O que não cabe é vendido na hora**:
   nada se perde, nada estraga.
2. **Pedidos.** 3 vagas, **sem prazo**. Cada pedido é de um morador: "Taro quer 73 onigiris" (balão em cima dele na rua e
   cartão na barra de baixo). Quantidade = ~90 s da produção equilibrada daquele item. Se a despensa tem, o botão **Entregar**
   acende; se não tem, o cartão mostra "44/73, fazendo…" e espera, sem castigo. Vaga vazia mostra o tempo real até o próximo
   pedido (nada de "quase").
3. **Entrega.** Entregar manda o kei-truck com o Kome no volante até o morador (fila se tiver mais de um); ele corre até o
   caminhão, pega a caixa, comemora. Paga 2× o valor de venda em ¥ e dá **corações**: 1, ou **2 se for o prato favorito**,
   +1 por prédio que goste daquele prato (Casa de Chá = mochi, Fliperama = onigiri).
4. **Amizade.** Cada morador tem uma barrinha de corações. Encheu → amizade sobe de nível → abre um cartão com **2 opções
   de construção** (uma do sonho dele, outra da lista geral) pra um terreno livre. Você escolhe, a obra aparece (casa de
   hinoki em estágios, shiba martelando), e o prédio pronto entra na rua com festa. Sem terreno livre: o nível dá 1 grão
   no Arroz do Coração e a casa do morador ganha um enfeite (flores, lanterna). Casa de quem gosta de você nunca fica igual.
5. **Prédios fazem coisas diferentes** (a escolha importa):
   - **Lojas** (Onigiri-ya, Mochiya, Bentô-ya, Konbini): compram sozinhas o que passa de 55% da despensa, por 1,5× o valor.
     Nunca tocam no que está guardado pra pedido. É a renda passiva da Vila.
   - **Afeto** (Casa de Chá, Fliperama): +1 coração em pedidos de um prato.
   - **Ritmo** (Sentô): pedidos novos chegam 2× mais rápido.
   - **Moradia** (Casa nova, Templo): um morador novo se muda (Kuro, músico; Monge Matcha). Templo também enche o festival 50%
     mais rápido. Mais moradores = mais pedidos diferentes ao mesmo tempo.
6. **Foco da fábrica** (a decisão de rota): um toque na fábrica no canto da rua escolhe Equilibrado / Mais onigiri / Mais mochi /
   Mais bentô. Pedido grande de bentô travado? Muda o foco e ele sai em 1 minuto. No jogo, isso é o mesmo cartão das 3 fatias da
   Doca, com um atalho na rua.
7. **Estações e festivais.** Cada coração entregue enche o festival da estação: **Hanami** (primavera), **Hanabi** (verão),
   **Tsukimi** (outono), **Shōgatsu** (inverno, mochitsuki). Cheio, o cartão pisca "Começar o Hanami! (quando você quiser)" e
   espera o tempo que for. Na festa: anoitece, as janelas acendem, varal de chōchin atravessa a rua, barraquinhas e nobori na
   praça, torre do taiko com o Kome batendo, todos os moradores dançam bon-odori em roda, tanukis turistas, fogos. Durante a
   festa os pedidos valem **corações em dobro**. No fim, a estação vira: árvores, chão, partículas (pétala, folha, neve) mudam.
8. **Offline (E.Sim).** A despensa enche (até o teto; o resto vira ¥), obras terminam, lojas vendem. Pedidos esperam. Ninguém se
   muda embora, nada decai. Carta da volta: "Enquanto você estava fora: a Mochiya vendeu ¥X, a obra do Sentô terminou!"
9. **Andar na rua.** Arrastar passeia (a rua é maior que a tela, como a Vila de hoje). Tocar num morador: ele pula, fala uma
   frase dele e mostra gosto/profissão/amizade. Tocar num prédio: o que ele faz.

## Desbloqueio e progressão
- Abre quando a fábrica faz o 1º mochi (mesmo gatilho dos "Pedidos da Vila" do fabrica-ligacao.md, que esta spec substitui).
  Começa com 6 moradores, 4 terrenos livres e o festival Hanami.
- Cresce em 3 frentes: **moradores** (6 → 30, por casas e eventos), **rua** (10 lotes → +1 quarteirão a cada 10 prédios, com
  ponte, estação de trem pra camada 5), **cardápio** (os pratos das ilhas viram pedidos: sorvete de mochi, curry, daifuku…).
- **Permanente**: viajar (prestígio do Pátio) não zera a Cidade (camada-cookie.md item 8). Depois de 30 h, a rua é sua.

## Números (ponto de partida; no jogo: `D.CITY` em game/data.js · protótipo usa ~1/6 dos tempos, bloco CFG)
| Coisa | Jogo | Protótipo |
|---|---|---|
| Teto da despensa | 5 min de produção por item | 220 / 80 / 26 |
| Pedido | 90 s da produção equilibrada · paga 2× · 3 vagas, sem prazo | 35–65 s |
| Próximo pedido | 45 s (Sentô: 22 s) | 7 s |
| Prato favorito | 60% dos pedidos; vale ♥♥ | igual |
| Corações por nível | 5, 8, 12, 16, 20, 25… (+5) | 3, 4, 5… |
| Obra | 2 min (1º prédio) → 10 min (depois do 10º) | 6 s |
| Loja | compra 1 item a cada 6 s acima de 55% · paga 1,5× | 1,6 s |
| Festival | encher: 40 corações (~45 min) · dura 4 min · ♥×2 | 14 ♥ · 32 s |
| Volta pro jogo base | cada nível de amizade = +1 grão no Arroz do Coração (+1% renda); fim de festival = 1 evento dourado "Festival" grátis guardado na Mochila (camada-cookie item 10) | — |

**Metas de ritmo** (medir com `tools/longo.js --horas 10` + `tools/dopamina.js --json`; o bot `__cidade.bot(seg)` do protótipo
já mede o ciclo curto): 1ª entrega ≤ 2 min depois de abrir (protótipo: 7 s) · 1º prédio ≤ 12 min · alguma novidade
(amizade, obra pronta, morador, festival, estação) **a cada ≤ 10 min nas primeiras 5 h** (nenhum "trecho chato" na Cidade) ·
festival a cada 40–60 min · 30 moradores × 6 níveis ≈ 1.800 corações ≈ 1.300 entregas ≈ **20–35 h**. No protótipo, 10 min de bot
dão 31 entregas, 1 morador novo, 4 prédios novos, 3 festivais (log em `__cidade.state.log`).
Eventos pro `dopamina.js` (o gancho `sim` emite): `morador` → peso `novo` (10), prédio pronto → `casa` (6), amizade → `marco` (5),
festival → `dourado` (5), estação → `ilha`? (Pergunta 2).

## Tela e controles
```
[¥]  [Despensa: onigiri 216 | mochi 69 | bentô 17]  [♥ 61]  [Primavera · Hanami]  [1× 2× 5×][♪]
 céu + Fuji ............................................................................
 FÁBRICA | casa Kiku | casa Taro | TERRENO | casa Hana | ... (rua rola de lado, arrastar)
 ======= rua: kei-truck do Kome, moradores andando, balões "×73" ======================
 canteiros, máquina de bebida, bancos, praça com torre do taiko (festival), árvore da estação
[pedido 1: retrato, ×N, ♥♥, Entregar] [pedido 2] [pedido 3] [Festival: 9/14 ♥ | Começar!]
```
Celular deitado: canvas 960×540 escalado; botões ≥ 42 px de canvas, texto principal 14–20 px (ver pontos fracos).

## Conteúdo (fichas)
- **Moradores** (ficha `morador` nova: id, nome, paleta do shiba, chapéu, prato favorito, profissão, 3–6 falas, 2 prédios dos
  sonhos). Os 8 do protótipo: Vó Kiku (mochi, rainha do karaokê), Taro (onigiri, entregador de bicicleta), Hana (bentô,
  florista), Sr. Genji (bentô, pescador mentiroso), Yuki (onigiri, streamer das 4 da manhã), Momo (mochi, confeiteira
  perfeccionista), Kuro (onigiri, músico de rua), Monge Matcha (bentô, monge que ri de tudo). Meta: 30.
- **Prédios** = ficha `estrutura` com `receita` (já existem: `conteudo/estrutura-cid_*.js`, loja_mochiya, loja_konbini,
  lojinha_onigiri, cid_templo) + efeito (loja/afeto/ritmo/moradia) em `D.CITY.BUILD`.
- **Festivais**: 4 (um por estação), depois variações (Tanabata, Obon, Setsubun) por ficha `evento`.

## Visual e som
Mesmo padrão da Fábrica: contorno #3B2818, E.PAL, luz quente de fim de tarde, nada parado (gato dormindo no telhado, pétalas,
pássaros, nuvens, vapor do sentô, moradores andando e conversando). Casas/lojas/kei-truck/props por receita (`tools/arte.js`),
céu/Fuji/árvores/barracas/obra/lanternas do `E.Nature`, moradores com `E.drawShiba`, retratos com `drawShibaHead`. Noite do
festival usa o quadro "noite" das artes (janelas acesas) + `Nature.grade`. Som: kaching + chirin na entrega, pop quando
chega pedido, fanfarra no prédio novo, taiko e fogos no festival.

## Como liga no jogo (pro programador)
- `game/cidade.js` (novo) com `G.City` (open, state, persist, sim) seguindo o padrão do `G.Fab`; abre pelo botão Vila: na rua
  da Vila aparece a placa "Entrar na rua" (ou tocar na rua). Os prédios construídos aparecem também na Vila de lado
  (game-world.js, mesmas artes por receita, nos slots de `mundo-dois-lados.md`).
- Despensa: a fatia "Vila" do cartão da Doca (`fabrica-ligacao.md`) passa a encher `S.city.stock` em vez de pagar ¥ direto.
- Save: `S.city = { stock, orders, people:[{id,lv,hearts}], lots:[{b,obra}], season, fest }` + 1 função em MIGR.
- Arroz do Coração: amizade chama o mesmo crédito da conquista. Festival terminado: `G.EventArt` guarda um "festival" na Mochila.
- Protótipo: `demos/cidade.html` (`?cena=pedido|escolha|festa|cheia`; console `__cidade`).

## Fora do escopo
Prazo em pedido, morador que vai embora ou fica triste, preço que muda, comida que estraga, posicionar prédio livre no grid
(o lote é escolhido automático pelo mais perto da casa do morador), interior das lojas, turistas com pedido, trem (camada 5).

## Perguntas do programador
1. Escolher o lote na mão (arrastar o prédio pra um terreno) vale a complexidade? No protótipo é automático.
2. Estação = festival (ritmo do jogador) ou estação real do calendário? Proposta: ritmo do jogador (nada de "volte em março").
3. Lojas compram ¥ fixo por item; no fim de jogo isso fica pequeno perto do Pátio. Escalar pelo ¥/s (como `D.SHOPS`) ou deixar
   a Cidade valer pelos corações/eventos e não pelo ¥?
