import { montarLayout, montarFooter } from '../ui.js';
import { carregarCardapio } from '../api.js';
import { cardSabor, cardProduto, cardMonte } from '../cards.js';
import { qs, qsa, esc } from '../util.js';
import { icone } from '../icons.js';

montarLayout({ pagina: 'cardapio' });
montarFooter();

const ICONES = { pizza: 'pizza', doce: 'doce', calzone: 'calzone', combo: 'combo', entrada: 'entrada', sanduiche: 'sanduiche', sobremesa: 'sobremesa', molho: 'molho', bebida: 'bebida', cerveja: 'cerveja', vinho: 'vinho', drink: 'drink', 'mais-pedidas': 'estrela' };

(async () => {
  try {
    const d = await carregarCardapio();
    const secoes = [];
    const maisPedidas = [...d.sabores.filter((s) => s.tags?.includes('mais-pedida')), ...d.produtos.filter((p) => p.tags?.includes('mais-pedida'))];
    if (maisPedidas.length) secoes.push({ slug: 'mais-pedidas', nome: 'Mais pedidas', icone: 'mais-pedidas', html: maisPedidas.map((x) => (x.precos ? cardSabor(x) : cardProduto(x))).join('') });

    for (const c of d.categorias) {
      let html = '';
      if (c.tipo === 'pizza') {
        const tipo = c.grupo || (c.slug === 'pizzas-doces' ? 'doce' : 'salgada');
        const lista = d.sabores.filter((s) => s.tipo === tipo).sort((a, b) => (b.disponivel - a.disponivel) || a.ordem - b.ordem);
        const monte = c.slug === 'pizzas' ? cardMonte(d.tamanhos.filter((t) => t.grupo !== 'calzone').map((t) => ({ ...t, precoMin: Math.min(...d.sabores.filter((s) => s.disponivel && s.precos[t.slug]).map((s) => Number(s.precos[t.slug]))) }))) : '';
        html = monte + lista.map(cardSabor).join('');
      } else {
        const lista = d.produtos.filter((p) => p.categoria === c.slug).sort((a, b) => (b.disponivel - a.disponivel) || a.ordem - b.ordem);
        html = lista.map(cardProduto).join('');
      }
      if (html) secoes.push({ slug: c.slug, nome: c.nome, icone: c.icone, html });
    }

    qs('[data-chips]').innerHTML = secoes.map((s) => `<a class="chip" href="#${esc(s.slug)}" data-chip="${esc(s.slug)}">${ICONES[s.icone] ? icone(ICONES[s.icone]) : ''}${esc(s.nome)}</a>`).join('');
    qs('[data-secoes]').innerHTML = secoes.map((s) => `
      <section class="secao" id="${esc(s.slug)}" style="padding: 22px 0 10px" data-secao="${esc(s.slug)}">
        <div class="secao-titulo"><h2>${esc(s.nome)}</h2>${s.slug === 'pizzas' || s.slug === 'pizzas-doces' ? '<span class="muted small">Bambina 4 fatias · Grande 8 fatias</span>' : s.slug === 'calzones' ? '<span class="muted small">Individual ou Família</span>' : ''}</div>
        <div class="grade">${s.html}</div>
      </section>`).join('') + (d.config.aviso_preparo ? `<p class="aviso aviso-ic" style="margin-top:20px">${icone('ampulheta')}<span>${esc(d.config.aviso_preparo)}</span></p>` : '');

    // chip ativo conforme rolagem
    const chips = qsa('[data-chip]');
    const obs = new IntersectionObserver((ents) => {
      ents.forEach((en) => { if (en.isIntersecting) {
        chips.forEach((ch) => ch.classList.toggle('ativo', ch.dataset.chip === en.target.dataset.secao));
        const at = chips.find((ch) => ch.classList.contains('ativo'));
        if (at) at.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
      } });
    }, { rootMargin: '-160px 0px -70% 0px' });
    qsa('[data-secao]').forEach((s) => obs.observe(s));
    if (location.hash) setTimeout(() => qs(location.hash)?.scrollIntoView({ behavior: 'smooth' }), 100);
  } catch (err) {
    console.error(err);
    qs('[data-secoes]').innerHTML = '<p class="aviso erro">Não conseguimos carregar o cardápio agora. Tente recarregar a página.</p>';
  }
})();
