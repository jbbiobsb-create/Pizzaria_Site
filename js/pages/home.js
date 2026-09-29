import { montarLayout, montarFooter, config, enderecoLoja, skeletonCards, horarioHoje, proximaAbertura } from '../ui.js';
import { carregarCardapio } from '../api.js';
import { cardSabor, cardProduto, ativarAddRapido, atualizarSteppers } from '../cards.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, resumoHorario, whatsappLink, brl, toast, lerLS, faixaMin, rotuloPagamento, track } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';
import { itensDoUltimoPedido, repetirItens, mensagemRepetir, resumoItens } from '../repetir.js';
import { cfgFidelidade, programaAtivo, nivelBase, nivelTopo, telefoneSalvo, abrirRegulamento, calcularPrevisto } from '../fidelidade.js';

// chamada do Clube Sesconetto's (cashback), quando o programa está ativo
function montarClube(c) {
  if (!programaAtivo(c)) return;
  const F = cfgFidelidade(c); const b = nivelBase(F); const t = nivelTopo(F);
  const tel = telefoneSalvo();
  qs('[data-clube-banner]').innerHTML = `
    <div class="ic">${icone('presente')}</div>
    <div style="min-width:0"><b>Ganhe <em>${esc(b.pct)}% a ${esc(t.pct)}% de cashback</em> em todo pedido</b><small>Clube Sesconetto's: sem cadastro, sem app. Parte do que você paga volta para a próxima pizza.</small></div>
    <div class="acoes">
      <button type="button" class="btn btn-sm btn-light" data-clube-regras>Saiba mais</button>
      ${tel ? `<a class="btn btn-sm btn-ghost" href="conta.html">${icone('moeda')} Ver meu saldo</a>` : ''}
    </div>`;
  qs('[data-clube]').hidden = false;
  qs('[data-clube-regras]').addEventListener('click', () => abrirRegulamento(F));
}

montarLayout({ pagina: 'home' });
montarFooter();
ativarAddRapido();
qs('[data-mais-pedidas]').innerHTML = skeletonCards(4);

qs('[data-ver-cardapio]')?.addEventListener('click', () => track('ver_cardapio', { origem: 'hero' }));

// "Pedir de novo": primeiro bloco da home quando há um pedido anterior salvo neste aparelho.
// "Repetir e confirmar" reconstrói a sacola e vai direto para "Fechar pedido" (endereço, dados e pagamento já lembrados).
(async () => {
  const u = await itensDoUltimoPedido();
  if (!u) return;
  const sec = qs('[data-pedir-de-novo]'); const el = qs('[data-repetir-card]');
  const cli = lerLS(LS.cliente, {});
  const e = cart.entrega();
  const nome = (cli.nome || '').trim().split(' ')[0];
  qs('[data-boas-vindas]').textContent = nome ? `Bem-vindo de volta, ${nome}.` : 'Pedir de novo';
  const canal = e ? (e.tipo === 'retirada' ? `Retirar na loja ${e.loja_nome || ''}` : `Entrega em ${e.endereco.rua}, ${e.endereco.numero}`) : (u.endereco_txt ? (u.tipo_entrega === 'retirada' ? `Retirar na loja ${u.endereco_txt}` : `Entrega em ${u.endereco_txt}`) : '');
  const pag = cli.pagamento ? rotuloPagamento(cli.pagamento, e?.tipo || u.tipo_entrega) : '';
  const linha2 = [canal, pag].filter(Boolean).join(' · ');
  let cb = '';
  try {
    const c = await config(); const F = cfgFidelidade(c);
    if (programaAtivo(c)) { const base = (u.itens || []).reduce((n, i) => n + Number(i.preco || 0) * Number(i.quantidade || 1), 0); const g = calcularPrevisto(F, nivelBase(F).pct, base); if (g > 0) cb = `<small class="cb-ganho-sacola">${icone('presente')} <span>Não perca <b>${brl(g)} de volta</b> neste pedido</span></small>`; }
  } catch {}
  el.innerHTML = `
    <div class="repetir repetir-completo">
      <div class="txt"><div class="ic">${icone('repetir')}</div><div style="min-width:0"><b>Pedido #${esc(u.numero)}${u.total ? ` · ${brl(u.total)}` : ''}</b><small>${esc(u.resumo || resumoItens(u.itens))}</small>${linha2 ? `<small>${esc(linha2)}</small>` : ''}${cb}</div></div>
      <button type="button" class="btn btn-lg" data-repetir>Repetir e confirmar</button>
      <a class="link-acao small" href="cardapio.html" data-outra-coisa>Quero outra coisa: ver cardápio</a>
    </div>`;
  sec.hidden = false;
  qs('[data-repetir]', el).addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true; b.textContent = 'Montando a sacola…';
    try {
      const r = await repetirItens(u.itens);
      const m = mensagemRepetir(r);
      track('add_item', { origem: 'repetir', itens: r.adicionados });
      if (r.adicionados) { location.href = 'checkout.html?repetir=1'; return; }
      toast(m.msg, m.tipo, 3500);
    } catch { toast('Não deu para repetir agora. Tente pelo cardápio.', 'erro'); }
    finally { b.disabled = false; b.textContent = 'Repetir e confirmar'; }
  });
})();

(async () => {
  try {
    const d = await carregarCardapio();
    const c = d.config;
    montarClube(c);
    // 6 pizzas com chips de tamanho (1 toque) + até 2 produtos simples; menos opções, decisão mais rápida
    const mais = d.sabores.filter((s) => s.tags?.includes('mais-pedida') && s.disponivel).slice(0, 6);
    const maisProd = d.produtos.filter((p) => p.tags?.includes('mais-pedida') && p.disponivel && p.categoria !== 'combos').slice(0, 2);
    const grade = qs('[data-mais-pedidas]');
    grade.innerHTML = mais.map(cardSabor).join('') + maisProd.map(cardProduto).join('');
    grade.removeAttribute('aria-busy');
    const combos = d.produtos.filter((p) => p.categoria === 'combos');
    qs('[data-combos]').innerHTML = combos.length ? combos.map(cardProduto).join('') : '<p class="muted">Em breve novos combos.</p>';
    atualizarSteppers();

    // infos
    // linha de prova (dados reais: horário, tempos, lojas, ano de fundação)
    const hoje = horarioHoje(c);
    qs('[data-info-status]').innerHTML = d.aberta ? `<i class="dot aberta"></i> Aberto agora${hoje ? ` · fecha às ${esc(hoje[1])}` : ''}` : `<i class="dot fechada"></i> Ainda não abrimos, o forno acende às ${esc(proximaAbertura(c))}. <a href="cardapio.html" style="text-decoration:underline">Agendar para hoje</a>`;
    qs('[data-info-tempo]').innerHTML = `${icone('moto')} Chega em ${esc(faixaMin(c.tempo_entrega_min, c.tempo_entrega_max))} · retirada em ${esc(faixaMin(c.tempo_retirada_min, c.tempo_retirada_max))}, sem taxa`;
    const lojas = d.lojas || [];
    qs('[data-info-endereco]').innerHTML = `${icone('pin')} ${lojas.length > 1 ? `${lojas.length} lojas: ${esc(lojas.map((l) => l.nome).join(', '))}` : esc(c.endereco?.bairro + ', ' + c.endereco?.cidade)} · desde ${esc(c.fundacao || 2022)}`;
    if (!d.aberta) qs('.hero h1').textContent = `Ainda não abrimos, o forno acende às ${proximaAbertura(c)}. Agende que a gente assa na hora.`;
    if (!d.aberta) { const cta = qs('[data-ver-cardapio]'); cta.innerHTML = `${icone('calendario')} Agendar para hoje`; }
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
