# Pedido pro Fable: pendências depois do polimento (o dono testa no PC dele)

Teu polimento entrou: merge com a camada Cookie (passos 1–4 do programador) e as tuas telas LIGADAS no sistema de verdade.
Base desta rodada: o `kome-projeto.zip` que vai junto. Trabalhe em cima dele, não do teu zip anterior.

## O que o programador ligou (pra você não refazer)
- `G.CookieUI.use({...})` está implementado no `game/patio.js` (função `adapter()`). Ele cobre Pátio, marcos (nome e preço da
  planilha), sinergias, Coração/tigelas, conquistas, árvore de sementes (`D.SEEDS`, por galho), carta "Pegar!" (offline vira
  `pendAway`) e "hora de partir". Com a tua tela ativa, os chips e o painel provisórios do programador somem.
- Eventos: `G.Events` chama `G.EventArt` (spawn/take/start/on/end) e o toque no canvas passa por `G.Events.hit(x, y)` (game.js).
  `G.Events.book()` devolve `{id: {seen, locked}}` pro Livro.
- `conteudo/cookie.csv` ainda é o teu exemplo (10 upgrades, 6 conquistas, 4 eventos) + os nomes de número.

## Fila (em ordem; zip completo + uma linha no CONTINUAR.md por item)
1. **Botão do Livro dos Eventos** na tua tela nova (no painel do Pátio ou no Coração), abrindo `G.EventArt.openBook()`.
2. **Silhueta da Fuji em cache**: hoje custa ~4 ms por quadro. Desenhar uma vez num canvas e reaproveitar (como a estátua do
   Kome-Oh em `scenery.js`).
3. **Roupinhas achadas com nome que não bate**: conferir a lista e corrigir.
4. **Máquinas absurdas compráveis no Pátio**: hoje o Pátio vai até a Frota Bagger. Pôr as absurdas (Tatuzões, Kome-Oh em
   série, Trem-Bala, Foguete de Mochi, Escavadeira do Fuji, Portal Onigiri) como turmas 15–20 em `D.PATIO.turmas` (data.js;
   a spec já tem custo/rendimento: Tatuzões 2,4e12 · 3,7e8 … Portal 2,8e16 · 5,4e11), travadas até o nó da árvore de
   sementes que destrava cada uma (galho Absurdo: 25, 75, 200, 500, 1.200, 3.000 sementes), com cena curta de chegada e os
   SONS que você já fez. O adaptador lista `D.PATIO.turmas`; use `locked`/`lockTxt` no `patio()` pra mostrar "???".
   Atenção: a medição de 100 h achou uma PAREDE na volta 17 (~80 h): a ilha 4 não termina porque a árvore de sementes já não
   compra nada. As absurdas são exatamente o que deve furar essa parede (`docs/medicoes/longo100-base.txt`).
5. **Planilha cheia** (`conteudo/cookie.csv`, mesmo formato): ~180 upgrades, ~19+ sinergias, ~420 conquistas, as 8 Tigelas,
   tom jovem adulto 20–35. Depois de editar: `node tools/cookie.js` (gera `game/cookie-data.js` e avisa linha errada).
6. **Ilhas fáceis** (14–19 min no simulador) e **medalhas** (`D.ENDGAME.medal`) pro final novo: só depois do item 5, porque a
   planilha muda o ritmo.

## Como testar antes de mandar (o dono testa no PC dele também)
- `node tools/check.js --fast` · `node tools/alicerce.js` · `node tools/monkey.js --partidas 2`.
- Ritmo: `node tools/longo.js --horas 8 --chato 5 --json saida.json` e `node tools/dopamina.js --json saida.json`.
  Regra de ouro: tudo que só anda em quadro de tela (câmera, cutscene, animação de compra) NÃO pode travar o modo acelerado
  (FAST): já quebrou 2 vezes (voo da Vila, cena da Bagger).
- Admin: `index.html?dev` → "final + infinito", "EVENTO DOURADO", "TATUZÃO", "RESETAR".
- No resumo: o que NÃO testou. Se mexer em `game.js`, `engine/` ou no save, diga qual função e por quê.
- Zip pro dono: SEM `docs/prints` (limite de 30 MB).

Esperando aprovação do dono (não construir antes): spec da Cidade, sementes.md, fim de jogo da fábrica, jogo infinito.
