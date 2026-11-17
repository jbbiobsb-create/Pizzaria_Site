# Sementes Douradas (rebalanço)
status: rascunho
camada: 2 · Ilhas   ·   depende de: islands.js (gain, seedCost), D.SEEDS, D.ENDGAME

## Em uma frase
Resposta ao `ACHADO-sementes.md`: as sementes passam a medir **como você jogou a ilha**, não quanto tempo deixou o modo
infinito ligado, e maxar a árvore vira meta de várias voltas.

## Como funciona (regras)
1. **Sementes da viagem = campanha da ilha + bônus pequeno do infinito.**
   - Base: `sqrt(ganho até o final da casa / 1e6)`. O jogo guarda `S.earnedEnd` no momento do final (ending()).
   - Bônus do infinito: `+10%` da base pra cada ×10 que o total passou do `earnedEnd`, **teto de +50%**.
     Ex.: base 20; ficou no infinito até ganhar 1000× mais → +30% → 26 sementes.
   - Medalhas continuam somando por fora (prata +2, ouro +5 na primeira vez).
2. **Custo geométrico:** `custo = base × 1,45^nível` (arredonda pra cima), no lugar de `base × (nível+1)`.
3. **O cartão de partir mostra a conta**: "20 da ilha + 6 do infinito (teto +50%) + 5 da medalha de ouro".
   Quando o bônus do infinito chega no teto, o chip do topo avisa: "sementes no máximo: hora de partir!".
4. Quem já tem save com sementes demais: nada é tirado. Os níveis comprados ficam; só o preço dos próximos muda.

## Números
| Semente | base | máx | custo total antes | custo total agora (≈) |
|---|---|---|---|---|
| Arroz Abençoado (renda) | 2 | 20 | 420 | ~7.400 |
| Amigo do Corretor (preço) | 3 | 8 | 108 | ~120 |
| Mala de Viagem | 6 | 3 | 36 | ~27 |
| Poupança | 1 | 5 | 15 | ~12 |
| Turma do Kome | 4 | 3 | 24 | ~18 |
| Faro de Ouro | 2 | 8 | 72 | ~80 |

- As pequenas ficam parecidas (fecham em 2–3 ilhas). **Arroz Abençoado** é a meta longa: os 10 primeiros níveis custam
  ~180 no total (1ª volta), os 10 últimos pedem as voltas 2 e 3.
- **Metas pro simulador:** jogando normal (sem farmar infinito), 15–30 sementes por ilha na 1ª volta; cada ilha entre o
  tempo de ouro e o de prata; **nenhuma ilha abaixo de 15 min** na 1ª volta; árvore maxada só na volta 3+.
- Se alguma ilha ainda ficar abaixo de 15 min: subir `priceMul` daquela ilha, não mexer nas sementes.

## Medalhas recalibradas pro final novo (casa pronta + 95% cavado) — 19/11
Medido pelo programador: campanha ~70 min; ilhas 31–34 min com sementes moderadas. As medalhas antigas eram do final velho.

| | Honshu | Hokkaido | Kyushu | Okinawa | Mochi |
|---|---|---|---|---|---|
| Ouro (antes) | 70 | 34 | 28 | 28 | 30 |
| **Ouro (agora)** | **75** | **30** | **30** | **30** | **32** |
| Prata (antes) | 100 | 50 | 42 | 42 | 45 |
| **Prata (agora)** | **105** | **42** | **42** | **42** | **45** |

- Regra: prata ≈ tempo de quem joga normal + 25%; ouro ≈ 10% mais rápido que o normal (pede atenção, não farm).
- Com o rebalanço das sementes acima (nenhuma ilha abaixo de 15 min na 1ª volta), o ouro continua sendo conquista.
- **Na Volta 2+** os tempos das medalhas encolhem 20% por volta (`ouro × 0,8^(volta-1)`), senão viram brinde.
- `D.ENDGAME.medal = { ouro: [75, 30, 30, 30, 32], prata: [105, 42, 42, 42, 45], lapK: 0.8, seeds: {bronze: 0, prata: 2, ouro: 5} }`

## Fora do escopo
Sementes novas, reset de árvore, converter sementes sobrando.

## Perguntas do programador
