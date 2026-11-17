# Fábrica ligada ao jogo todo
status: rascunho
camada: 3 · Fábrica   ·   depende de: fabrica.md (no jogo), itens/Armazém, ilhas, ajudantes (helpersTick/fleet)

## Em uma frase
A fábrica deixa de ser "entra arroz, sai ¥": o que ela faz vira **comida que o jogo usa**. Você decide, numa régua só, quanto
vai pra **venda**, quanto vai pra **marmita da turma** (shibas cavam mais) e quanto vai pra **Vila** (pedidos e crescimento).

## Como funciona (regras)
1. **Três destinos na Doca de Venda** (toque na doca → cartão com 3 fatias arrastáveis que somam 100%):
   - **Vender** (padrão 100%): como hoje, ¥ na hora.
   - **Marmita**: o produto vai pra cantina da frota. Enche uma barra de **Energia da Turma** (0–100%). Com energia, ajudantes
     e máquinas pilotadas cavam mais rápido. Cada produto alimenta de um jeito (tabela). Sem marmita a barra desce devagar até
     0 e tudo volta ao normal: **não existe fome nem castigo**, só bônus.
   - **Vila**: o produto vai pra despensa da Vila e atende **pedidos** (item 3). Enquanto a camada Cidade não existe, cada
     pedido paga ¥ em dobro do valor de venda + 1 coração do morador.
2. **Cardápio = a meta à vista.** Um livro de receitas (botão na fábrica e no menu): cada produto tem página com desenho,
   frase, quanto já foi feito e 3 selos (fez 1, fez 1.000, fez 100.000). Cada selo dá +1% de renda pra sempre. A página de
   produto ainda não descoberto mostra a silhueta e **onde** ele se abre ("só em Kyushu").
3. **Pedidos da Vila** (3 de cada vez, sem prazo, como as missões): "Vó Kiku quer 40 onigiris". Entregou → ¥, coração e, a
   cada 5 pedidos, a Vila ganha uma casinha ou loja nova na rua (visível no botão Vila ⇄ Montanha). É a ponte pra camada 4.
4. **Receitas por ilha: viajar abre cardápio.** Cada ilha libera 1 ingrediente e 1 receita que **ficam pra sempre**:

   | Ilha | Ingrediente (cai ao cavar lá) | Receita nova | Máquina | Vale | Marmita |
   |---|---|---|---|---|---|
   | Honshu | arroz, Arroz Dourado | cozido, onigiri, mochi, mochi dourado | as de hoje | 2× / 4× / 12× / 48× | cozido +1, onigiri +3, mochi +6 |
   | Hokkaido | Gelo de Arroz | **Sorvete de Mochi** (1 mochi + 1 gelo) | Sorveteira 1×1 | 30× | +10, e a turma não treme de frio |
   | Kyushu | Curry | **Curry Rice** (1 cozido + 1 curry) | Caldeirão 1×1 | 14× | +14 (a melhor marmita) |
   | Okinawa | Açúcar de Cana | **Sata Andagi** (1 cozido + 1 açúcar) | Fritadeira 1×1 | 12×, faz 3 por vez | +5 |
   | Ilha de Mochi | Mochigome | **Daifuku** (1 mochi + 1 mochigome) | usa o Pilão (3ª receita) | 60× | +8 |

   O ingrediente de ilha guardado no Armazém acaba; pra fazer mais, volte lá (ou na Volta 2). Isso dá motivo pra revisitar.
5. **Bentô** (do rascunho "fim de jogo da fábrica") vira o prato que junta tudo: marmita +20 e o pedido mais valioso da Vila.

## Desbloqueio e progressão
- Cartão de destinos e Cardápio: junto com a fábrica (final da campanha). Marmita: ao fazer 100 onigiris.
- Pedidos da Vila: ao fazer o 1º mochi. Receitas de ilha: ao chegar em cada ilha.

## Números (ponto de partida)
| Coisa | Valor |
|---|---|
| Energia da Turma | bônus de cavar dos ajudantes/frota = +0% a **+60%** (linear com a barra) |
| Barra | 100 pontos; desce 1 ponto a cada 6 s (10 min cheia → vazia) |
| Pedido | quantidade = ~90 s da produção atual daquele produto; paga 2× o valor de venda |
| Selos do Cardápio | 3 por produto, +1% de renda cada (9 produtos + bentô = até +30%) |
| Metas de ritmo | 1º pedido entregue em ≤ 5 min; barra de energia cheia em ~3 min com 30% na marmita; decisão sentida: 100% venda rende mais ¥ agora, 30% marmita rende mais em ~4 min |

## Tela e controles
- Doca de Venda: 3 fatias (¥ / marmita / vila) num cartão; arrastar a divisória. Ícones grandes, texto ≥ 17 px no palco.
- HUD da montanha: barrinha "Energia da Turma" perto do ¥/s, com um onigiri piscando quando sobe.
- No mundo: a cantina (um yatai ao lado do estacionamento) com shibas comendo; ajudantes com energia ganham brilho e
  correm; o kei-truck leva caixas pro lado da Vila quando há pedido.

## Visual e som
Página do Cardápio em papel washi com carimbo vermelho; "itadakimasu!" baixinho quando a barra enche.

## Fora do escopo
Estoque com validade, preço que muda, falta de comida com penalidade, cadeias com mais de 2 ingredientes.

## Perguntas do programador
