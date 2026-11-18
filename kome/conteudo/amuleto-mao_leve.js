ficha({
  tipo: 'amuleto', id: 'mao_leve', nome: 'Mão Leve',
  bom: 'Os sacos abrem sozinhos', ruim: 'Cada saco vale 30% menos', piada: 'O Goma cobra taxa de serviço.',
  etiquetas: ['sorte', 'equipe'], raridade: 'comum', icone: 'sack_gold', ai: 1.2,
  fx: { kind: 'regra', values: { autosack: 1, sack: 0.7 } },
});
