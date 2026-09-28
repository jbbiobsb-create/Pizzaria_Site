import { montarLayout, montarFooter, abrirModalEntrega, config } from '../ui.js';
import { carregarCardapio } from '../api.js';
import { cardSabor, cardProduto } from '../cards.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, resumoHorario, whatsappLink, brl } from '../util.js';
import { icone } from '../icons.js';

montarLayout({ pagina: 'home' });
montarFooter();

qsa('[data-pedir]').forEach((a) => a.addEventListener('click', (ev) => {
  ev.preventDefault();
  const tipo = a.dataset.pedir;
  const e = cart.entrega();
  if (e && e.tipo === tipo) { location.href = 'cardapio.html'; return; }
  abrirModalEntrega(tipo);
  window.addEventListener('ses:entrega', () => { if (cart.entrega()) location.href = 'cardapio.html'; }, { once: true });
}));

(async () => {
  try {
    const d = await carregarCardapio();
    const c = d.config;
    const mais = d.sabores.filter((s) => s.tags?.includes('mais-pedida') && s.disponivel).slice(0, 6);
    const maisProd = d.produtos.filter((p) => p.tags?.includes('mais-pedida') && p.disponivel && p.categoria !== 'combos').slice(0, 2);
    qs('[data-mais-pedidas]').innerHTML = mais.map(cardSabor).join('') + maisProd.map(cardProduto).join('');
    const combos = d.produtos.filter((p) => p.categoria === 'combos');
    qs('[data-combos]').innerHTML = combos.length ? combos.map(cardProduto).join('') : '<p class="muted">Em breve novos combos.</p>';

    // infos
    qs('[data-info-status]').innerHTML = d.aberta ? '<i class="dot aberta"></i> Aberto agora' : `<i class="dot fechada"></i> Fechado · abre ${esc(c.horario?.seg?.[0] || '18:00')}`;
    qs('[data-info-tempo]').innerHTML = `${icone('moto')} Entrega em ${esc(c.tempo_entrega_min)}–${esc(c.tempo_entrega_max)} min · retirada ${esc(c.tempo_retirada_min)}–${esc(c.tempo_retirada_max)} min`;
    qs('[data-info-endereco]').innerHTML = `${icone('pin')} ${esc(c.endereco?.bairro)}, ${esc(c.endereco?.cidade)}`;
    if (c.sobre_massa) qs('[data-sobre-massa]').textContent = c.sobre_massa;
    if (c.aviso_preparo) qs('[data-aviso-preparo]').innerHTML = `${icone('ampulheta')} ${esc(c.aviso_preparo)}`;
    const e = c.endereco || {};
    qs('[data-contato-endereco]').innerHTML = `<b>${esc(c.nome_completo || c.nome)}</b><br>${esc(e.rua)}, ${esc(e.numero)} ${esc(e.complemento || '')}<br>${esc(e.bairro)} — ${esc(e.cidade)}/${esc(e.uf)} · CEP ${esc(e.cep)}`;
    qs('[data-contato-horario]').textContent = resumoHorario(c.horario);
    const faixas = (c.faixas_taxa || []);
    qs('[data-contato-entrega]').textContent = faixas.length ? `até ${c.raio_entrega_km} km · taxa a partir de ${brl(faixas[0].taxa)}` : `até ${c.raio_entrega_km} km`;
    const wa = whatsappLink(c.whatsapp, `Olá! Vim pelo site da ${c.nome}.`);
    const a = qs('[data-contato-wa]'); a.href = wa; a.textContent = c.telefone;
    qs('[data-contato-wa-btn]').href = wa;
    qs('[data-mapa]').src = `https://maps.google.com/maps?q=${encodeURIComponent(`${e.rua}, ${e.numero} - ${e.bairro}, ${e.cidade} - ${e.uf}`)}&z=15&output=embed`;
  } catch (err) {
    console.error(err);
    qs('[data-mais-pedidas]').innerHTML = '<p class="aviso erro">Não conseguimos carregar o cardápio agora. Tente recarregar a página.</p>';
  }
})();
