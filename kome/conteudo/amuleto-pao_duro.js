ficha({
  tipo: 'amuleto', id: 'pao_duro', nome: 'Pão-Duro',
  texto: 'Tudo custa 20% menos; o Kome cavando ganha 30% menos. Cupom é cupom.',
  etiquetas: ['fabrica'], raridade: 'comum', icone: 'coin', ai: 1.8,
  fx: { kind: 'mult', values: { preco: 0.8, kome: 0.7 } },
});
