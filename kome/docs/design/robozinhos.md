# Robozinhos
status: rascunho
camada: 2–3   ·   depende de: swarm.js (pronto, não ligado), coletor, fábrica (Doca de Entrada)

## Em uma frase
O enxame é a **limpeza**: enquanto as máquinas grandes arrancam pedaços, os robozinhos catam o que sobra (grão solto no
chão, beiradas, restinho no fim da montanha) e levam em fila pro coletor. É a automação que você VÊ crescer.

## Como funciona (regras)
1. Comprados em **lotes** num nó novo da árvore (ramo Equipe): 10 → 25 → 50 → 100 → 200. Cada compra faz os novos saírem
   de trás do coletor e entrarem na fila.
2. Trabalham sozinhos: sobem a encosta perto da frente de trabalho, pegam 1 grão (2 e 3 com upgrade) e voltam.
3. **Especialidade: o resto.** Rendem pouco no começo da montanha e **muito no fim**: abaixo de 15% de montanha, quando as
   máquinas grandes ficam sem onde morder, os robôs ganham ×4. Isso resolve o trecho lento do final novo (95% cavado).
4. **Com a fábrica:** dá pra mandar a fila direto pra Doca de Entrada (um interruptor no cartão dos robôs): o que eles
   trazem não conta no limite da doca. É um jeito de alimentar a fábrica sem tirar do que você cava.
5. Coletor cheio (venda relâmpago chegando) → eles param e dançam. Nunca atrapalham máquina: passam por baixo.

## Números (ponto de partida)
| Lote | Preço (s de renda) | Renda do enxame (do total) |
|---|---|---|
| 10 | 60 | ~2% |
| 25 | 150 | ~4% |
| 50 | 400 | ~6% |
| 100 | 1000 | ~8% |
| 200 | 2500 | ~10% (teto) |
Abre com a Escavadeira. No fim da montanha (≤ 15% restante) a parte deles sobe pra até 40% da renda.
Meta: o trecho de 85% → 95% cavado não pode levar mais que 6 min.

## Tela e controles
Cartão dos robôs (toque num robô ou no nó): quantos, grãos por robô, interruptor "coletor / fábrica". Sem mais nada.

## Visual e som
Já está no swarm.js: fila em duas faixas, orelhinha de shiba, luz dourada carregando, dancinha. De longe viram pontinhos.
Som: "bip" raro, nunca em coro.

## Fora do escopo
Robôs que constroem, robôs na Vila, upgrades individuais.

## Perguntas do programador
