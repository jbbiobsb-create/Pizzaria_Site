# Pedido pro designer (Fable): o que fazer agora

Oi! A Fábrica nova entrou no jogo e o dono amou: **"esse é o nível de design que eu quero"**. A régua agora é ela.
O programador (Claude Code, no PC) juntou seu zip, rodou todos os testes (check, playtest, robô de cliques no PC e no
celular, folhas de tela, save, offline) e consertou o que apareceu. Base pra trabalhar: o zip mais novo que o dono te mandar.

## O que eu (programador) já consertei no seu trabalho
- Cartão da máquina abria EM CIMA da máquina quando ela estava na metade direita: o 2º toque do toque duplo caía no cartão
  e não girava. Agora o cartão abre do outro lado (`floatCard` recebe a borda esquerda da máquina).
- Offline: a fábrica nunca rodava na volta (o jogo calcula o tempo fora antes da fábrica se registrar) e as esteiras não
  iam pro save. Agora itens nas esteiras e dentro das máquinas vão pro save e a fábrica termina tudo na volta, com a carta.
- "+¥" da doca de venda se embolava: agora estoura a cada 0,8 s em 3 posições alternadas.
- Testado com arraste de verdade no celular deitado: esteira, pôr, mover, girar (toque duplo) e borracha. Tudo ok.

## Fila de trabalho, em ordem (cada item: entrega um zip completo + uma linha no CONTINUAR.md)
1. **Pontos fracos da fábrica que você mesmo apontou** (rápidos):
   - máquina alta tapando a esteira da linha de trás (transparência quando tem item atrás, ou desenhar a esteira por cima
     na faixa coberta);
   - máquinas que não giram o desenho (pelo menos espelhar quando a saída aponta pra esquerda, e uma versão "de costas"
     pra cima/baixo);
   - textos de 9–10 px no celular (regra: nada abaixo de 12 px no aparelho de 844×390);
   - setinhas verdes de "dá pra subir": mostrar só na máquina mais barata, ou só quando o cartão de construção está aberto.
2. **Levar o mesmo nível pra telas que ainda estão "chapadas"**, uma por rodada:
   a) Oficina (painel de upgrades do modo infinito) → virar um lugar, como a fábrica;
   b) Casa do Kome (o painel da direita) → menos lista, mais cena;
   c) Mapa das Ilhas → já é bonito; só a ficha da ilha e a árvore de sementes;
   d) HUD da montanha (botões de baixo, cartão da casa, chip das ilhas/fábrica).
3. **Cidade (camada 4 do PLANO-100H)**: spec de 1 página (`docs/design/cidade.md`, formato do README) + protótipo jogável
   em `demos/` no MESMO nível da fábrica. Ela consome os produtos da fábrica (pedidos de moradores). Status `rascunho`;
   o dono aprova e eu ligo no jogo.
4. **Balanço que é seu**: `docs/design/ACHADO-sementes.md` (ilhas acabam em 3–13 min com sementes no máximo) e a espera
   longa da fábrica depois do minuto ~100 (você mesmo disse: precisa de conteúdo no fim, não número).

## Como trabalhar comigo (pra eu juntar sem dor)
- Mexa à vontade em `game/fabrica-arte.js`, `game/fabrica.js`, `demos/`, `docs/design/`, `conteudo/`. Se precisar mexer
  em `game/game.js`, `engine/` ou save, diga no resumo QUAL função e por quê (eu confiro).
- Números só em `game/data.js`. Nada de asset externo, emoji no mundo ou dinheiro real. Criança joga.
- Arte pequena: pixel (`E.spriteText`/Pix) ou receita do Pixxel Estúdio; máquina grande: vetor articulado.
- No resumo, diga o que NÃO testou (como você fez dessa vez — ajudou muito).
- Se tiver `node`, rode antes de mandar: `node tools/check.js --fast`, `node tools/alicerce.js`, `node tools/fabrica-sim.js`.
