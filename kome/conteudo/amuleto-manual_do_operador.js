ficha({
  tipo: 'amuleto', id: 'manual_do_operador', nome: 'Manual do Operador',
  texto: 'Máquinas a motor rendem ×1,4; ferramentas de mão, ×0,6. Leu as letras miúdas.',
  etiquetas: ['motor'], raridade: 'comum', icone: 'book', ai: 1.8,
  fx: { kind: 'mult', values: { motor: 1.4, mao: 0.6 } },
});
