ficha({
  tipo: 'amuleto', id: 'hora_do_rush', nome: 'Hora do Rush',
  texto: 'Ferramenta nova = renda ×2 por 40 s; fora do rush, ×0,85. Compre rápido.',
  etiquetas: ['motor'], raridade: 'raro', icone: 'horn', ai: 2,
  fx: { kind: 'vivo', values: { rush: 2, rushSec: 40, fora: 0.85 } },
});
