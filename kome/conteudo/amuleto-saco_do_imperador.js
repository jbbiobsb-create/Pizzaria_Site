ficha({
  tipo: 'amuleto', id: 'saco_do_imperador', nome: 'Saco do Imperador',
  texto: 'Todo saco já nasce lendário (×10), mas caem 4× menos.',
  etiquetas: ['sorte'], raridade: 'lendario', icone: 'sack_leg', ai: 3, desbloqueio: 'k29',
  fx: { kind: 'regra', values: { sackFloor: 3, sackRate: 0.25 } },
});
