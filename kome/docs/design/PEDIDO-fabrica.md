# PEDIDO do programador → designer: spec da Fábrica (fase 1 do PLANO-100H)

Oi! A fase 0 (alicerce) está no jogo. Preciso da **spec de 1 página da Fábrica MVP** em `docs/design/fabrica.md`,
no formato do `docs/design/README.md`, com `status: rascunho`. O Elias aprova (vira `aprovado`) e aí eu construo
numa rodada só. Base: PLANO-100H §3.3 e a linha "1. Fábrica MVP" da tabela §6.

## O que já existe e você pode usar
- **Itens tipados**: o Armazém (aba na Casa) já guarda arroz por tipo: `arroz` (solto), `integral`, `negro`, `koshi`,
  e arroz de ilha (curry de Kyushu etc. entra sozinho). 1 saco = 100 px² cavados. Hoje um jogador no início junta
  ~10 sacos por minuto; no fim da campanha, milhares. Produtos novos (onigiri, mochi…) entram como itens em `D.ITEMS`.
- **Tempo/offline**: a fábrica pode rodar com o jogo fechado (até 8 h). Diga SE ela roda offline e quanto (100%? 50%?).
- **Save com migração**: o layout pode ficar entre ilhas sem problema.
- **Arte**: máquina pequena/prédio = ficha com receita (gerador `maquina`, `casa`, `props`, `bicho` pros shibas de touca);
  máquina GRANDE = vetor articulado. Diga qual é qual.
- **Esteiras** (`game/belts.js`) já levam arroz do coletor até o galpão KOME PACK no pátio.

## O que eu preciso que a spec responda (curto, com números)
1. **Grid**: tamanho (o plano diz 8×6), onde fica na tela, como entra/sai (botão "Montanha / Fábrica"?). Celular DEITADO
   é o padrão: alvos de toque ≥ 32 px.
2. **As 3 máquinas do MVP** (panela, moldadora, pilão?): preço, tamanho no grid (1×1? 2×1?), velocidade (itens/s),
   entrada e saída de cada uma.
3. **As 4 receitas**: entrada → saída, tempo, valor de venda de cada produto (em "× arroz solto").
4. **Esteira**: custa? como desenha (arrastar o dedo?), girar, apagar.
5. **Venda**: produto pronto vende sozinho ou vai pro Armazém? O arroz cru que sobra continua vendendo na hora?
6. **Desbloqueio**: quando a fábrica abre (qual ferramenta/marco), e o que abre depois.
7. **Metas de ritmo** pro meu simulador conferir: ex. "1ª máquina em 2 min de fábrica", "1º onigiri em 3 min",
   "fábrica = 30% da renda depois de 1 h", "espera máxima 3 min".
8. **A decisão de verdade**: qual escolha o jogador faz (espaço limitado? vender cru × processar?).
9. **Fora do escopo** desta versão (o que fica pra "Fábrica completa").

Regras de sempre: criança joga (sem dinheiro real, sem culpa, nada estraga enquanto está fora, gargalo nunca perde arroz).
