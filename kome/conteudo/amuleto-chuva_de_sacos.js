ficha({
  tipo: 'amuleto', id: 'chuva_de_sacos', nome: 'Chuva de Sacos',
  texto: 'Sacos caem 3× mais, mas valem metade. Bom pra quem tem dedo nervoso.',
  etiquetas: ['sorte'], raridade: 'comum', icone: 'sack', ai: 1.6,
  fx: { kind: 'mult', values: { sackRate: 3, sack: 0.5 } },
});
