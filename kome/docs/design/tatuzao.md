# Tatuzão
status: rascunho
camada: 2 · pós-final   ·   depende de: tatuzao.js (encaixe provisório), tbm.js, bolsões/fósseis da montanha

## Em uma frase
O Tatuzão é a **máquina de caçar tesouro**: você escolhe a altura, ele fura a montanha por dentro e vai revelando o que
está escondido lá (bolsões, baús, o núcleo), enquanto as outras máquinas comem a montanha por fora.

## Como funciona (regras)
1. **Chega como prêmio, não como compra de menu.** Ao terminar a casa em Honshu chega uma carta: "encomenda especial no
   porto". Cena curta de chegada (as carretas laranjas do modo `transport` atravessando o pátio, shibas de colete, buzina).
   Aí ele fica no pátio e o chip "Tatuzão" passa a abrir o **cartão de missão**. Nas outras ilhas ele já vem junto.
2. **Você mira.** O cartão mostra a montanha em corte com 3 alturas de túnel (baixo, meio, alto). Com a habilidade Faro de
   Shiba, os bolsões piscam de leve no corte. Escolheu → ele entra e fura sozinho até atravessar ou até você chamar de volta.
3. **O que ele encontra pelo caminho** (cada um com parada, suspense de 1–2 s e estouro):
   - **Bolsão dourado**: paga o bolsão inteiro de uma vez (em vez de aos poucos, cavando).
   - **Baú enterrado**: roupinha, enfeite ou fóssil (coleção) que só o Tatuzão alcança no miolo da montanha.
   - **Núcleo**: ao tocar o núcleo ele abre uma "veia": por 60 s tudo que as máquinas cavam vale +50%.
   - **Atravessou a montanha**: o túnel vira **atalho**: a esteira passa por dentro e, com o mundo em dois lados, o kei-truck
     dos pedidos vai pra Vila por ele (em vez de dar a volta). Bônus fixo de renda enquanto o túnel existir.
4. **Paga por anel**, como hoje (renda de fundo), mas o que importa são os achados.
5. **Um túnel por montanha por altura** (até 3). Montanha nova = túneis novos. Onde a montanha já foi cavada, o túnel some
   (como já está no código).
6. Nada de túnel desabar, máquina quebrar ou gastar combustível.

## Números (ponto de partida)
| Coisa | Valor |
|---|---|
| Velocidade | 1 anel a cada 4 s (como o tbm.js); montanha inteira ≈ 170 anéis ≈ 11 min |
| Anel | `D.TATU.ringSec` 1,2 s de renda (manter) |
| Achados por túnel | 2–4 bolsões, 1 baú (garantido no 1º túnel de cada ilha), núcleo só no túnel do meio |
| Atalho | +8% de renda enquanto existir |
| Melhorias (na Oficina, como as outras máquinas) | nível = mais rápido; marco 10 = fura 2 alturas ao mesmo tempo |

## Tela e controles
Cartão de missão com o corte da montanha e 3 botões grandes de altura (≥ 44 px); botão "chamar de volta". Durante o furo, um
ícone no topo mostra o progresso e pisca quando acha algo; tocar leva a câmera até ele.

## Visual e som
Chegada no estilo da foto de referência; por dentro, lanterna na frente iluminando o que vai aparecer (silhueta do baú antes
de abrir). Som grave contínuo, "clonc" a cada anel, fanfarra curta no achado.

## Fora do escopo
Pilotar o Tatuzão na mão, túneis em curva, túnel como caminho pro Kome andar.

## Perguntas do programador
- (designer) O pacote antigo listava "túneis na montanha" como ideia descartada pelo dono. Como o Tatuzão foi ele quem
  pediu, tratei o túnel como desenho por cima (igual ao encaixe atual), sem mudar o terreno. Se o dono não quiser túnel
  aparecendo, a alternativa é o Tatuzão trabalhar "por baixo" e só os achados subirem.
