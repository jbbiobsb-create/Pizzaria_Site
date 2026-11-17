# Passagem: Fábrica (fase 1 do PLANO-100H) — estado em 17/11

Pra quem continuar (outro chat). Ler antes: `CLAUDE.md` (regras), `MAPA.md` (onde mora cada coisa), `docs/PAPEIS.md`,
`docs/design/fabrica.md` (spec APROVADA, com as 6 perguntas/propostas do programador no fim, todas aceitas).

## O que está pronto (commitado, testes verdes)
- `game/fabrica.js` (~1370 linhas): a Fábrica KOME PACK inteira, portada do protótipo do designer (`demos/fabrica-proto.js`).
  Tela cheia por cima do jogo (stage próprio 960×540, cabe no celular deitado). Grid 8×6, Doca de Entrada/Venda, Panela,
  Moldadora, Pilão (2 receitas), **Divisor** (novo: entra por trás, alterna esquerda/direita), Esteira, Borracha, Desfazer,
  cartão de máquina (nível, receita, ocupada %, gargalo), tutorial de 4 passos, metas (Pilão / Mochi Dourado).
- Economia (decisões do programador, aprovadas na spec):
  - a Doca puxa itens/s (`dockCap`); cada item vale `renda média de cavar (1 min) × pct da doca / itens/s`;
  - o cru já foi pago ao cavar: vender paga só `val - base` (não paga duas vezes, nada se perde);
  - preço = segundos da renda MÉDIA de cavar × `D.FAB.priceK` (NÃO usa G.priceIps: ele guarda o pico do núcleo dourado);
  - doca "esperta": só puxa Arroz Dourado se algum Pilão estiver na receita Mochi Dourado.
- Números: `D.FAB` em `game/data.js` (priceK 3.0, dock pct0 0.025 / +0.035 por nível / máx 0.25, items0 1, moldadora 45).
- Liga no jogo: `game.js · credit()` chama `G.Fab.dig(v)`; `items.js · add()` chama `G.Fab.sacks()`; `G.Sim.add('fabrica')`
  (roda com a tela fechada também); `saveNow` chama `G.Fab.persist()`; save em `S.stats.fab` (vale em todas as ilhas).
- Abre sozinha no final da campanha (banner) + botão "Fábrica" no topo do HUD (zona tc, ao lado do chip das Ilhas).
  A montanha NÃO pausa com a fábrica aberta (ajudantes/frota seguem).
- Offline: só termina o que estava nas esteiras (carta "Enquanto você estava fora" se rendeu algo).
- Produtos entram no Armazém (Casa › Armazém) como contador do Cardápio (`D.ITEMS` cozido/onigiri/mochi/mochi_dourado).
- Admin (`index.html?dev`): botões "FÁBRICA" e "fábrica: tudo liberado".

## Ferramentas
- `node tools/fabrica-sim.js [--verbose] [--min 70]`: joga a campanha, abre a fábrica, um robô monta linhas e confere as
  metas da spec. Último resultado: 1ª compra 1,8 min ok · 1º onigiri 1,9 min ok · Pilão 19 min (~15) ok · 1 h 35% ok ·
  teto 41% ok · **FORA:** 23% aos 15 min (meta ~10%), espera máx 499 s (meta 180), grid não encheu em 70 min (meta 40–60).
  Os FORA dependem muito do estilo do robô (ele sobe nível antes de pôr máquina nova). Calibrar com o designer.
- `node tools/alicerce.js` (agora testa também o save da fábrica) · `node tools/check.js` · `node tools/sweep.js`
  (telas 20 "fábrica" e 21 "fábrica tutorial") · `node tools/monkey.js`.

## Falta (ordem sugerida)
1. Calibrar os 3 FORA com o designer (talvez a meta de 15 min/espaço seja pra um jogador que também gasta na Oficina).
2. Visual no mundo: galpão KOME PACK soltando caixas e kei-truck levando (spec "Visual e som"), máquinas por ficha
   `tipo: 'maquina'` (a spec traz os desenhos; hoje os sprites estão dentro do fabrica.js) e operadores gerados por receita.
3. Sons novos (borbulho, "ploc", "PON!" do pilão): hoje usa os Sfx que existem.
4. `G.Topo`/`engine/board.js` (tela de cima genérica) ficou como peça da engine pra Cidade; a Fábrica NÃO usa.
5. Achado pendente pro designer: `docs/design/ACHADO-sementes.md` (ilhas curtas demais com sementes no máximo).

## Regras que valem
JS clássico sem build, roda de file://; balanço só em data.js; criança joga (sem dinheiro real, culpa, punição);
estruturas/coisas pequenas em pixel, máquinas grandes vetor; celular deitado é o padrão; commitar a cada passo que funciona;
regerar os HTMLs da área de trabalho (`node tools/single.js "<Desktop>/Kome no Japão (celular).html"` e `--dev` pro admin).

## Atualização de 17/11 (noite): tela nova, galpão no mundo, sons, ritmo
- A apresentação foi refeita: `game/fabrica-arte.js` (arte, `G.FabArt`) + `game/fabrica.js` (regras, HUD em canvas, toque).
  Itens 2 e 3 do "Falta" acima estão FEITOS (galpão do pátio trabalhando em `industry.js · working()`; sons `fab-*`).
  As máquinas continuam desenhadas em código (Pix), não por ficha `tipo: 'maquina'`.
- Item 1 (calibrar): decisões do designer e tabela nova no fim de `docs/design/fabrica.md`. A espera máxima ficou em
  ~178 s de mediana, mas só 6 de 12 partidas ficam ≤ 180 s (o estouro é no fim, quando os níveis baratos acabam).
- Não rodei check/sweep/monkey/playtest nesta rodada (o dono testa). Ver "Fábrica com cara de jogo" no CONTINUAR.md.

