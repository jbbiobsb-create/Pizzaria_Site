import { montarLayout, montarFooter, skeletonCards } from '../ui.js';
import { carregarCardapio } from '../api.js';
import { cardSabor, cardProduto, cardMonte, ativarAddRapido, atualizarSteppers, normalizar } from '../cards.js';
import { qs, qsa, esc, debounce, param, track, rolarAte } from '../util.js';
import { icone } from '../icons.js';

montarLayout({ pagina: 'cardapio' });
montarFooter();
ativarAddRapido();
track('ver_cardapio', { cat: param('cat') || null, hash: location.hash || null });
// ?cat=bebidas: só essa categoria na página (o atalho da home não cai no meio de uma página de 200 itens)
const SO_CAT = param('cat');

const ICONES = { pizza: 'pizza', doce: 'doce', calzone: 'calzone', combo: 'combo', entrada: 'entrada', sanduiche: 'sanduiche', sobremesa: 'sobremesa', molho: 'molho', bebida: 'bebida', cerveja: 'cerveja', vinho: 'vinho', drink: 'drink', 'mais-pedidas': 'estrela' };
const LIMITE_COLAPSO = 12; // categorias maiores que isso mostram "ver todos"

// o skeleton inicial já vem no cardapio.html (antes do JS); aqui só garante quando a página é reaproveitada
if (!qs('[data-secoes] .skeleton-card')) qs('[data-secoes]').innerHTML = `<div class="grade" aria-busy="true">${skeletonCards(6, true)}</div>`;

(async () => {
  try {
    const d = await carregarCardapio();
    const secoes = [];
    const maisPedidas = [...d.sabores.filter((s) => s.tags?.includes('mais-pedida')), ...d.produtos.filter((p) => p.tags?.includes('mais-pedida'))];
    if (maisPedidas.length) secoes.push({ slug: 'mais-pedidas', nome: 'Mais pedidas', icone: 'mais-pedidas', html: maisPedidas.map((x, i) => (x.precos ? cardSabor(x, i) : cardProduto(x, i))).join(''), n: maisPedidas.length });

    for (const c of d.categorias) {
      let html = ''; let n = 0;
      if (c.tipo === 'pizza') {
        const tipo = c.grupo || (c.slug === 'pizzas-doces' ? 'doce' : 'salgada');
        const lista = d.sabores.filter((s) => s.tipo === tipo).sort((a, b) => (b.disponivel - a.disponivel) || a.ordem - b.ordem);
        const monte = c.slug === 'pizzas' ? cardMonte(d.tamanhos.filter((t) => t.grupo !== 'calzone').map((t) => ({ ...t, precoMin: Math.min(...d.sabores.filter((s) => s.disponivel && s.precos[t.slug]).map((s) => Number(s.precos[t.slug]))) }))) : '';
        const primeira = !secoes.length; // sem "mais pedidas": as 3 primeiras fotos desta seção são as candidatas a LCP
        html = monte + lista.map((s, i) => cardSabor(s, primeira ? i : 99)).join(''); n = lista.length + (monte ? 1 : 0);
      } else {
        const lista = d.produtos.filter((p) => p.categoria === c.slug).sort((a, b) => (b.disponivel - a.disponivel) || a.ordem - b.ordem);
        html = lista.map((p, i) => cardProduto(p, !secoes.length ? i : 99)).join(''); n = lista.length;
      }
      if (html) secoes.push({ slug: c.slug, nome: c.nome, icone: c.icone, html, n });
    }

    const visiveis = SO_CAT && secoes.some((s) => s.slug === SO_CAT) ? secoes.filter((s) => s.slug === SO_CAT) : secoes;
    // com ?cat, os chips das outras categorias levam ao cardápio completo (link normal, sem scroll-spy)
    qs('[data-chips]').innerHTML = secoes.map((s) => `<a class="chip ${visiveis.includes(s) ? '' : 'chip-externo'}" href="${visiveis.includes(s) ? '' : 'cardapio.html'}#${esc(s.slug)}" data-chip="${esc(s.slug)}">${ICONES[s.icone] ? icone(ICONES[s.icone]) : ''}${esc(s.nome)}</a>`).join('');
    qs('[data-secoes]').innerHTML = visiveis.map((s) => `
      <section class="secao" id="${esc(s.slug)}" style="padding: 22px 0 10px" data-secao="${esc(s.slug)}">
        <div class="secao-titulo"><h2>${esc(s.nome)}</h2>${s.slug === 'pizzas' || s.slug === 'pizzas-doces' ? '<span class="muted small">Bambina 4 fatias · Grande 8 fatias</span>' : s.slug === 'calzones' ? '<span class="muted small">Individual ou Família</span>' : `<span class="muted small">${s.n} ${s.n === 1 ? 'item' : 'itens'}</span>`}</div>
        <div class="grade ${s.n > LIMITE_COLAPSO ? 'colapsada' : ''}">${s.html}</div>
        ${s.n > LIMITE_COLAPSO ? `<button type="button" class="btn btn-outline ver-todos" data-ver-todos>Ver todos (${s.n})</button>` : ''}
      </section>`).join('') + (d.config.aviso_preparo ? `<p class="aviso aviso-ic" style="margin-top:20px">${icone('ampulheta')}<span>${esc(d.config.aviso_preparo)}</span></p>` : '');
    qs('[data-secoes]').removeAttribute('aria-busy');
    atualizarSteppers();

    qsa('[data-ver-todos]').forEach((b) => b.addEventListener('click', () => { b.previousElementSibling.classList.remove('colapsada'); b.remove(); }));

    ligarChips();
    ligarBusca(d, secoes);
    if (location.hash && !SO_CAT) setTimeout(() => { try { qs(location.hash)?.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch {} }, 100);
  } catch (err) {
    console.error(err);
    qs('[data-secoes]').innerHTML = '<p class="aviso erro">Não conseguimos carregar o cardápio agora. Tente recarregar a página.</p>';
  }
})();

// ------------------------------------------------------------------
// Chips: scroll-spy por rolagem (rAF) + clique rola a página até a seção.
// Enquanto a rolagem programática está em curso o spy fica em pausa, e o chip
// ativo é centralizado rolando SÓ o trilho horizontal (não a página).
// ------------------------------------------------------------------
function ligarChips() {
  const trilho = qs('[data-chips]');
  const chips = qsa('[data-chip]');
  const secoes = qsa('[data-secao]');
  const wrap = qs('.chips-wrap');
  let rolando = false; let timerRolando = 0; let agendado = false;

  const ativar = (slug) => {
    let at = null;
    chips.forEach((ch) => { const on = ch.dataset.chip === slug; ch.classList.toggle('ativo', on); if (on) { at = ch; ch.setAttribute('aria-current', 'true'); } else ch.removeAttribute('aria-current'); });
    if (at) trilho.scrollTo({ left: at.offsetLeft - trilho.clientWidth / 2 + at.offsetWidth / 2, behavior: 'smooth' });
  };
  const spy = () => {
    agendado = false;
    if (rolando) return;
    const limite = wrap.getBoundingClientRect().bottom + 8;
    let atual = secoes[0];
    for (const s of secoes) { if (s.getBoundingClientRect().top <= limite) atual = s; else break; }
    if (atual && !qs(`[data-chip="${atual.dataset.secao}"]`)?.classList.contains('ativo')) ativar(atual.dataset.secao);
  };
  const fimRolagem = () => { rolando = false; spy(); };
  window.addEventListener('scroll', () => { if (!agendado) { agendado = true; requestAnimationFrame(spy); } }, { passive: true });
  window.addEventListener('scrollend', () => { if (rolando) { clearTimeout(timerRolando); fimRolagem(); } });

  chips.forEach((ch) => ch.addEventListener('click', (ev) => {
    const alvo = qs('#' + CSS.escape(ch.dataset.chip)); if (!alvo) return; // seção fora desta página: navega normalmente
    ev.preventDefault();
    rolando = true; ativar(ch.dataset.chip);
    history.replaceState(null, '', '#' + ch.dataset.chip);
    // longe (> 2 telas): rolagem instantânea, senão parece lento; perto: suave
    const longe = Math.abs(alvo.getBoundingClientRect().top) > 2 * innerHeight;
    rolarAte(alvo, longe ? { behavior: 'instant' } : {});
    clearTimeout(timerRolando); timerRolando = setTimeout(fimRolagem, 1200); // fallback sem scrollend
  }));
  spy();
}

// ------------------------------------------------------------------
// Busca: filtra sabores e produtos por nome/descrição (sem acento)
// ------------------------------------------------------------------
function ligarBusca(d, secoes) {
  const linha = qs('[data-chips-linha]'); const caixa = qs('[data-busca-cardapio]');
  const input = qs('input', caixa); const limpar = qs('[data-limpar-busca]', caixa);
  const resultados = qs('[data-resultados]'); const lista = qs('[data-secoes]');
  const topo = () => window.scrollTo({ top: 0, behavior: 'instant' });
  const abrir = () => { linha.hidden = true; caixa.hidden = false; topo(); input.focus(); };
  const fechar = () => { input.value = ''; aplicar(); caixa.hidden = true; linha.hidden = false; };
  qs('[data-abrir-busca]').addEventListener('click', abrir);
  qs('[data-fechar-busca]', caixa).addEventListener('click', fechar);
  limpar.addEventListener('click', () => { input.value = ''; aplicar(); input.focus(); });
  input.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); fechar(); } });
  input.addEventListener('input', debounce(aplicar, 120));

  const sugestoes = ['margherita', 'calabresa', 'coca', 'vinho', 'doce'];
  function aplicar() {
    const q = normalizar(input.value.trim());
    limpar.hidden = !q;
    if (!q) { resultados.hidden = true; resultados.innerHTML = ''; lista.hidden = false; return; }
    const sab = d.sabores.filter((s) => normalizar(s.nome + ' ' + (s.descricao || '')).includes(q));
    const prod = d.produtos.filter((p) => normalizar(p.nome + ' ' + (p.descricao || '')).includes(q));
    lista.hidden = true; resultados.hidden = false; topo();
    if (!sab.length && !prod.length) {
      resultados.innerHTML = `<div class="sem-resultado"><div class="ic">${icone('busca')}</div><h3>Nada com “${esc(input.value.trim())}”</h3><p class="muted small">Confira a grafia ou tente uma destas:</p>
        <div class="sugestoes">${sugestoes.map((s) => `<button type="button" class="chip" data-sugestao="${s}">${s}</button>`).join('')}</div></div>`;
      qsa('[data-sugestao]', resultados).forEach((b) => b.addEventListener('click', () => { input.value = b.dataset.sugestao; aplicar(); }));
      return;
    }
    const n = sab.length + prod.length;
    resultados.innerHTML = `<section class="secao" style="padding: 22px 0 10px"><div class="secao-titulo"><h2>Resultados</h2><span class="muted small">${n} ${n === 1 ? 'item' : 'itens'}</span></div>
      <div class="grade">${sab.map(cardSabor).join('')}${prod.map(cardProduto).join('')}</div></section>`;
    atualizarSteppers(resultados);
  }
}
