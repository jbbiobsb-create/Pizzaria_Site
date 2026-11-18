ficha({
  tipo: 'amuleto', id: 'esteira_expressa', nome: 'Esteira Expressa',
  texto: 'Fábrica vende ×1,5 e a frota do Pátio rende +25%.',
  etiquetas: ['fabrica', 'motor'], raridade: 'raro', icone: 'gear', ai: 2,
  fx: { kind: 'mult', values: { fab: 1.5, frota: 1.25 } },
});
