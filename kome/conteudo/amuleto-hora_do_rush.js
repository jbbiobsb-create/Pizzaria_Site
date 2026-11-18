ficha({
  tipo: 'amuleto', id: 'hora_do_rush', nome: 'Hora do Rush',
  bom: 'Ferramenta nova: ganho em dobro por 40 s', ruim: 'Fora disso, rende 15% menos', piada: 'Compre rápido.',
  etiquetas: ['motor'], raridade: 'raro', icone: 'horn', ai: 2,
  fx: { kind: 'vivo', values: { rush: 2, rushSec: 40, fora: 0.85 } },
});
