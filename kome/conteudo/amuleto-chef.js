ficha({
  tipo: 'amuleto', id: 'chef', nome: 'Chef',
  texto: 'Tudo que a fábrica vende vale ×2; arroz cru vale ×0,5. Gastronomia é isso.',
  etiquetas: ['fabrica'], raridade: 'comum', icone: 'onigiri', ai: 0.6,
  fx: { kind: 'mult', values: { fab: 2, sell: 0.5 } },
});
