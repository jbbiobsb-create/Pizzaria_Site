ficha({
  tipo: 'amuleto', id: 'frota_feliz', nome: 'Frota Feliz',
  texto: 'Cada máquina estacionada no pátio dá +5% de renda pra todo mundo.',
  etiquetas: ['motor', 'equipe'], raridade: 'raro', icone: 'trator', ai: 3,
  fx: { kind: 'vivo', values: { porMaquina: 0.05 } },
});
