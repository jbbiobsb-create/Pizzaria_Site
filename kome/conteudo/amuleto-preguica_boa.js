ficha({
  tipo: 'amuleto', id: 'preguica_boa', nome: 'Preguiça Boa',
  texto: 'Renda offline ×3 e o limite sobe pra 24 h. Pode dormir, é estratégia.',
  etiquetas: ['equipe'], raridade: 'comum', icone: 'clock', ai: 0.8,
  fx: { kind: 'regra', values: { offline: 3, offCap: 24 } },
});
