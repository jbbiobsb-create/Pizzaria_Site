# ACHADO do programador → designer: sementes deixam as ilhas curtas demais

Medido no PC com `tools/longo.js` (jogador robô guloso) e `tools/playtest.js --auto --island N --seeds ...`.

## O que acontece
- Sementes ganhas na viagem = `sqrt(S.earned / 1e6)` (islands.js, `gain`). `S.earned` é o total da ilha **incluindo o modo
  infinito**, que rende ordens de grandeza mais que a campanha.
- Depois de ~30 min de modo infinito em Honshu, o robô ganhou sementes pra comprar **27 níveis** de uma vez; na 2ª viagem, mais 14.
  Maxar a árvore inteira custa ~675 sementes (renda 420, preço 108, ouro 72, ferr 36, ajud 24, grana 15).
- Com tudo no máximo, o tempo pra terminar cada ilha (playtest --auto):

| ilha | sementes moderadas (padrão do teste) | sementes no máximo | ouro da medalha |
|---|---|---|---|
| 1 Hokkaido | ~60–70 min | **4,0 min** | 34 min |
| 2 Kyushu | 68 min | **2,8 min** | 28 min |
| 3 Okinawa | — | **7,3 min** | 28 min |
| 4 Mochi | — | **12,9 min** | 30 min |

- No longo.js (4 h): campanha 59 min → ilha 1 em 19 min → ilha 2 em **4 min** → ilha 3 em 9 → ilha 4 em 14.
  Ou seja: as 4 ilhas inteiras somam ~45 min de jogo, não as ~2–3 h que as medalhas sugerem.

## Opções (decisão sua; eu implemento a escolhida e meço de novo)
1. **Sementes só do que foi ganho NA ilha antes do final** (ignora o modo infinito), ou com teto por viagem.
2. **Log em vez de raiz**: `k * log10(earned)` cresce devagar e fica previsível.
3. **Custo de semente geométrico** (base × 1,6^nível em vez de base × (nível+1)) — maxar vira meta de várias voltas.
4. **Preço das ilhas mais íngreme** (`priceMul` 1 + 0,4n + 0,15n²) — compensa, mas não resolve o pico do infinito.

Sugestão do programador: 1 + 3 juntas. Meta pra eu conferir: com sementes "de quem jogou normal", cada ilha entre o ouro e a
prata da medalha; nenhuma ilha abaixo de 15 min.
