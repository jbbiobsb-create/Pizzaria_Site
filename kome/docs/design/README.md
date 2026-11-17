# Specs de design

Uma spec por sistema: `docs/design/<sistema>.md` (ex.: `fabrica.md`, `cidade.md`, `camadas.md`).
Comece por `camadas.md` (a visão geral do jogo de 100 horas) e depois uma spec por camada.

## Formato de cada spec

```
# <Nome do sistema>
status: rascunho | aprovado | em código | no jogo
camada: <qual camada do jogo>   ·   depende de: <specs/sistemas que precisam existir antes>

## Em uma frase
O que o jogador faz aqui e por que é divertido.

## Como funciona (regras)
Passo a passo do ponto de vista do jogador. Sem código.

## Desbloqueio e progressão
Quando aparece, o que desbloqueia depois, como cresce (com números de partida).

## Números
Tabela com preços, tempos, multiplicadores e metas de ritmo (ex.: "1ª receita em 2 min", "espera máxima 3 min").

## Tela e controles
O que aparece na tela (desenho simples em texto se ajudar), funcionando no celular deitado.

## Conteúdo
Lista de itens/receitas/personagens. O que for ficha vai em conteudo/ (tools/novo.js mostra os tipos).

## Visual e som
Como deve parecer e soar (estilo Kome; máquina grande = vetor, resto = pixel).

## Fora do escopo
O que NÃO faz parte desta versão.

## Perguntas do programador
(o programador escreve aqui; o designer responde embaixo de cada uma)
```

## Dicas
- Números são ponto de partida: o programador mede com o robô de playtest e devolve o que precisou mudar.
- Uma spec pequena e aprovada vale mais que uma enorme em rascunho. Fatie.
- Antes de inventar, veja `MAPA.md` e `CONTINUAR.md`: muita coisa já existe e pode ser reaproveitada.
