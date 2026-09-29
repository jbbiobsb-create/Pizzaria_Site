import { montarLayout, montarFooter, abrirModalEntrega, config, enderecoLoja, skeletonCards } from '../ui.js';
import { carregarCardapio } from '../api.js';
import { cardSabor, cardProduto, ativarAddRapido, atualizarSteppers } from '../cards.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, resumoHorario, whatsappLink, brl, toast } from '../util.js';
import { icone } from '../icons.js';
import { itensDoUltimoPedido, repetirItens, mensagemRepetir, resumoItens } from '../repetir.js';

montarLayout({ pagina: 'home' });
montarFooter();
ativarAddRapido();
qs('[data-mais-pedidas]').innerHTML = skeletonCards(4);

qsa('[data-pedir]').forEach((a) => a.addEventListener('click', (ev) => {
  ev.preventDefault();
  const tipo = a.dataset.pedir;
  const e = cart.entrega();
  if (e && e.tipo === tipo) { location.href = 'cardapio.html'; return; }
  abrirModalEntrega(tipo);
  window.addEventListener('ses:entrega', () => { if (cart.entrega()) location.href = 'cardapio.html'; }, { once: true });
}));

// "Pedir de novo": aparece quando há um pedido anterior salvo neste aparelho
(async () => {
  const u = await itensDoUltimoPedido();
  if (!u) return;
  const sec = qs('[data-pedir-de-novo]'); const el = qs('[data-repetir-card]');
  el.innerHTML = `
    <div class="repetir">
      <div class="txt"><div class="ic">${icone('repetir')}</div><div style="min-width:0"><b>Pedido #${esc(u.numero)}${u.total ? ` · ${brl(u.total)}` : ''}</b><small>${esc(u.resumo || resumoItens(u.itens))}</small></div></div>
      <button type="button" class="btn" data-repetir>Repetir</button>
    </div>`;
  sec.hidden = false;
  qs('[data-repetir]', el).addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true; b.textContent = 'Adicionando…';
    try {
      const r = await repetirItens(u.itens);
      const m = mensagemRepetir(r); toast(m.msg, m.tipo, 3500);
      if (r.adicionados) setTimeout(() => (location.href = 'carrinho.html'), 700);
    } catch { toast('Não deu para repetir agora. Tente pelo cardápio.', 'erro'); }
    finally { b.disabled = false; b.textContent = 'Repetir'; }
  });
})();

(async () => {
  try {
    const d = await carregarCardapio();
    const c = d.config;
    const mais = d.sabores.filter((s) => s.tags?.includes('mais-pedida') && s.disponivel).slice(0, 6);
    const maisProd = d.produtos.filter((p) => p.tags?.includes('mais-pedida') && p.disponivel && p.categoria !== 'combos').slice(0, 2);
    const grade = qs('[data-mais-pedidas]');
    grade.innerHTML = mais.map(cardSabor).join('') + maisProd.map(cardProduto).join('');
    grade.removeAttribute('aria-busy');
    const combos = d.produtos.filter((p) => p.categoria === 'combos');
    qs('[data-combos]').innerHTML = combos.length ? combos.map(cardProduto).join('') : '<p class="muted">Em breve novos combos.</p>';
    atualizarSteppers();

    // infos
    qs('[data-info-status]').innerHTML = d.aberta ? '<i class="dot aberta"></i> Aberto agora' : `<i class="dot fechada"></i> Fechado · abre ${esc(c.horario?.seg?.[0] || '18:00')} · <a href="carrinho.html" style="text-decoration:underline">agende</a>`;
    qs('[data-info-tempo]').innerHTML = `${icone('moto')} Entrega em ${esc(c.tempo_entrega_min)}–${esc(c.tempo_entrega_max)} min · retirada ${esc(c.tempo_retirada_min)}–${esc(c.tempo_retirada_max)} min`;
    const lojas = d.lojas || [];
    qs('[data-info-endereco]').innerHTML = `${icone('pin')} ${lojas.length > 1 ? `${lojas.length} lojas: ${esc(lojas.map((l) => l.nome).join(', '))}` : esc(c.endereco?.bairro + ', ' + c.endereco?.cidade)}`;
    if (c.sobre_massa) qs('[data-sobre-massa]').textContent = c.sobre_massa;
    if (c.aviso_preparo) qs('[data-aviso-preparo]').innerHTML = `${icone('ampulheta')} ${esc(c.aviso_preparo)}`;
    // lojas: clicar mostra a loja no mapa
    const mapa = (l) => { const e = l.endereco || {}; qs('[data-mapa]').src = `https://maps.google.com/maps?q=${encodeURIComponent(`${e.rua} ${e.numero || ''} - ${e.bairro}, ${e.cidade} - ${e.uf}`)}&z=15&output=embed`; };
    qs('[data-contato-endereco]').innerHTML = `<b>${esc(c.nome_completo || c.nome)}</b>` + lojas.map((l, i) =>
      `<br><a href="#contato" class="link-loja link-acao" data-loja-mapa="${i}">${icone('pin')} <b>${esc(l.nome)}</b></a> · ${esc(enderecoLoja(l))}`).join('');
    qsa('[data-loja-mapa]').forEach((a) => a.addEventListener('click', (ev) => { ev.preventDefault(); mapa(lojas[Number(a.dataset.lojaMapa)]); }));
    qs('[data-contato-horario]').textContent = resumoHorario(c.horario);
    const faixas = (c.faixas_taxa || []);
    qs('[data-contato-entrega]').textContent = (faixas.length ? `até ${c.raio_entrega_km} km · taxa a partir de ${brl(faixas[0].taxa)}` : `até ${c.raio_entrega_km} km`) + (lojas.length > 1 ? ' · sai da loja mais próxima de você' : '');
    const wa = whatsappLink(c.whatsapp, `Olá! Vim pelo site da ${c.nome}.`);
    const a = qs('[data-contato-wa]'); a.href = wa; a.textContent = c.telefone; a.classList.add('link-acao');
    qs('[data-contato-wa-btn]').href = wa;
    if (lojas.length) mapa(lojas.find((l) => l.principal) || lojas[0]);
  } catch (err) {
    console.error(err);
    qs('[data-mais-pedidas]').innerHTML = '<p class="aviso erro">Não conseguimos carregar o cardápio agora. Tente recarregar a página.</p>';
  }
})();
