ficha({
  tipo: 'amuleto', id: 'gato_da_sorte', nome: 'Gato da Sorte',
  texto: '+12% de chance de crítico, mas o crítico paga ×3 em vez de ×5.',
  etiquetas: ['sorte'], raridade: 'comum', icone: 'star', ai: 1.5,
  fx: { kind: 'mult', values: { crit: 0.12, critMult: 0.6 } },
});
