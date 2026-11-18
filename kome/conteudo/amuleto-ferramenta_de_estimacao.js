ficha({
  tipo: 'amuleto', id: 'ferramenta_de_estimacao', nome: 'Ferramenta de Estimação',
  texto: 'A ferramenta na mão rende +3% por minuto seguido (até ×2,5). Trocar zera.',
  etiquetas: ['mao', 'motor'], raridade: 'raro', icone: 'hat', ai: 2.6,
  fx: { kind: 'vivo', values: { estimacao: 0.03, estimacaoMax: 2.5 } },
});
