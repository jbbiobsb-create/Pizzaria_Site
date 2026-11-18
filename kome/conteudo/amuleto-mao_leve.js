ficha({
  tipo: 'amuleto', id: 'mao_leve', nome: 'Mão Leve',
  texto: 'O Goma abre os sacos sozinho, mas cobra 30% de taxa de serviço.',
  etiquetas: ['sorte', 'equipe'], raridade: 'comum', icone: 'sack_gold', ai: 1.2,
  fx: { kind: 'regra', values: { autosack: 1, sack: 0.7 } },
});
