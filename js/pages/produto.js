// Configurador: pizza (tamanho + até 2 sabores) ou produto simples / combo
import { montarLayout, montarFooter, tagHTML } from '../ui.js';
import { carregarCardapio } from '../api.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, brl, param, toast, track } from '../util.js';
import { nomeCurto, fotoHTML } from '../cards.js'; // fotoHTML: lista de sabores (48px); o fallback de <picture> mora em cards.js
import { icone } from '../icons.js';

montarLayout({ pagina: 'cardapio', sacola: false }); // a página tem a própria barra fixa
montarFooter();

const raiz = qs('[data-produto]');
const barra = qs('[data-barra]');
const btnAdd = qs('[data-adicionar]');
const totalEl = qs('[data-total]');

const estado = { tamanho: null, grupo: 'pizza', sabores: [], quantidade: 1, observacao: '', produto: null, escolhas: {} };
let D;

(async () => {
  try {
    D = await carregarCardapio();
    const slugProduto = param('p');
    if (slugProduto) montarProduto(D.produtosPorSlug[slugProduto]);
    else montarPizza(param('sabor'));
  } catch (e) {
    console.error(e);
    raiz.innerHTML = '<p class="aviso erro">Não conseguimos carregar. Tente recarregar a página.</p>';
  }
})();

// ------------------------------------------------------------------
// PIZZA
// ------------------------------------------------------------------
function montarPizza(saborInicial) {
  const sab = saborInicial ? D.saboresPorSlug[saborInicial] : null;
  if (sab && sab.disponivel) estado.sabores = [sab.slug];
  // calzone ou pizza: cada grupo tem seus tamanhos e seus sabores
  estado.grupo = sab?.tipo === 'calzone' ? 'calzone' : 'pizza';
  const CZ = estado.grupo === 'calzone';
  const tamanhosGrupo = D.tamanhos.filter((t) => (t.grupo || 'pizza') === estado.grupo);
  const tamanhosOk = tamanhosGrupo.filter((t) => !sab || sab.precos[t.slug]);
  estado.tamanho = (tamanhosOk.find((t) => t.slug === 'grande') || tamanhosOk[0] || tamanhosGrupo[0]).slug;

  document.title = `${sab ? sab.nome : 'Monte sua pizza'} · Sesconetto's Pizzeria`;
  raiz.removeAttribute('aria-busy');
  raiz.innerHTML = `
    <div>
      <div class="foto-grande ${sab?.imagem_url ? '' : 'vazia'}" data-foto>${sab?.imagem_url ? fotoGrande(sab.imagem_url) : icone('pizza')}</div>
    </div>
    <div class="produto-corpo">
      <div class="tags" style="margin-bottom:6px">${(sab?.tags || []).map(tagHTML).join('')}</div>
      <h1 data-titulo>${sab ? (CZ ? 'Calzone ' : '') + esc(sab.nome) : 'Monte sua pizza'}</h1>
      <p class="desc" data-desc>${sab ? esc(sab.descricao || '') : 'Escolha o tamanho e até dois sabores na mesma pizza.'}</p>

      <div class="bloco">
        <h3>1. Tamanho</h3>
        <p class="ajuda">${CZ ? 'Individual serve 1 pessoa; Família serve 2 ou mais.' : 'Grande já vem marcada: é a mais pedida, 8 fatias, serve 2 a 3 e aceita meio a meio. Bambina (4 fatias) serve 1.'}</p>
        <div class="opcoes tamanho-chips-config" data-tamanhos role="radiogroup" aria-label="Tamanho"></div>
      </div>

      <div class="bloco">
        <h3>2. ${CZ ? 'Recheio' : 'Sabores'} <span class="muted small" data-contagem></span></h3>
        <p class="ajuda" data-ajuda-sabor></p>
        <div class="metades" data-metades></div>
        <input class="busca" type="search" placeholder="Buscar sabor…" aria-label="Buscar sabor" autocomplete="off" enterkeyhint="search" data-busca>
        <div class="filtros-sabor" data-filtros role="group" aria-label="Filtrar sabores" ${CZ ? 'hidden' : ''}>
          <button type="button" data-f="todos" class="ativo" aria-pressed="true">Todos</button>
          <button type="button" data-f="salgada" aria-pressed="false">Salgadas</button>
          <button type="button" data-f="doce" aria-pressed="false">Doces</button>
          <button type="button" data-f="vegetariana" aria-pressed="false">Vegetarianas</button>
        </div>
        <div class="lista-sabores" data-lista-sabores></div>
      </div>

      <div class="bloco">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span class="strong">Quantidade</span>
          <div class="qtd"><button type="button" data-qtd="-1" aria-label="Diminuir quantidade">${icone('menos')}</button><span data-qtd-v aria-live="polite">1</span><button type="button" data-qtd="1" aria-label="Aumentar quantidade">${icone('mais')}</button></div>
        </div>
        <details class="detalhe" data-obs-detalhe style="margin-top:8px">
          <summary>${icone('mais')} Observações para a pizzaria</summary>
          <textarea class="obs" placeholder="Ex.: sem cebola, bem assada, cortar em mais pedaços" data-obs maxlength="200" aria-label="Observações"></textarea>
        </details>
      </div>
      ${D.config.sobre_massa ? `<p class="nota-massa">${icone('trigo')}<span>${esc(D.config.sobre_massa)}</span></p>` : ''}
    </div>`;

  renderTamanhos();
  renderSabores();
  renderMetades();
  qs('[data-busca]').addEventListener('input', renderSabores);
  qsa('[data-filtros] button').forEach((b) => b.addEventListener('click', () => { qsa('[data-filtros] button').forEach((x) => { x.classList.remove('ativo'); x.setAttribute('aria-pressed', 'false'); }); b.classList.add('ativo'); b.setAttribute('aria-pressed', 'true'); renderSabores(); }));
  qs('[data-obs]').addEventListener('input', (e) => (estado.observacao = e.target.value));
  qsa('[data-qtd]').forEach((b) => b.addEventListener('click', () => { estado.quantidade = Math.max(1, Math.min(10, estado.quantidade + Number(b.dataset.qtd))); qs('[data-qtd-v]').textContent = estado.quantidade; atualizarTotal(); }));
  btnAdd.addEventListener('click', adicionarPizza);
  barra.hidden = false; document.body.classList.add('tem-barra');
  atualizarTotal();
}

function tamanhoAtual() { return D.tamanhosPorSlug[estado.tamanho]; }
// foto 4:3 no topo (LCP da página): sem lazy, fetchpriority alto, WebP 480 com o JPG do banco como fallback
function fotoGrande(url) {
  const base = String(url).replace(/\.(jpe?g|png)$/i, '');
  const img = `<img src="${esc(url)}" alt="" width="600" height="600" fetchpriority="high" decoding="async">`;
  if (base === String(url) || !/^img\//.test(url)) return img;
  return `<picture><source type="image/webp" srcset="${esc(base)}-480.webp 480w, ${esc(base)}-600.webp 600w" sizes="(min-width: 900px) 560px, 100vw">${img}</picture>`;
}

function renderTamanhos() {
  const el = qs('[data-tamanhos]');
  // Grande primeiro (âncora e padrão sugerido); Bambina ao lado como opção menor
  const ordem = (t) => (t.slug === 'grande' ? 0 : 1);
  el.innerHTML = D.tamanhos.filter((t) => (t.grupo || 'pizza') === estado.grupo).sort((a, b) => ordem(a) - ordem(b) || a.ordem - b.ordem).map((t) => {
    const precos = D.sabores.filter((s) => s.disponivel && s.precos[t.slug]).map((s) => Number(s.precos[t.slug]));
    const minimo = precos.length ? Math.min(...precos) : null;
    // se já há sabor escolhido, mostra o preço dele nesse tamanho
    const escolhido = estado.sabores.length ? Math.max(...estado.sabores.map((sl) => Number(D.saboresPorSlug[sl].precos[t.slug] || 0))) : 0;
    const semPreco = estado.sabores.some((sl) => !D.saboresPorSlug[sl].precos[t.slug]);
    return `<button type="button" role="radio" aria-checked="${estado.tamanho === t.slug}" class="opcao ${estado.tamanho === t.slug ? 'ativo' : ''}" data-t="${esc(t.slug)}" ${semPreco ? 'disabled' : ''}>
      <b>${esc(t.nome)}${t.slug === 'grande' ? ' <span class="tag mais-pedida">Mais pedida</span>' : ''}</b><small>${t.grupo === 'calzone' ? '1 recheio' : `${t.fatias} fatias · ${t.slug === 'grande' ? 'serve 2 a 3' : 'serve 1'} · ${t.max_sabores > 1 ? `até ${t.max_sabores} sabores` : '1 sabor'}`}</small>
      <span class="p">${semPreco ? 'indisponível p/ este sabor' : (escolhido ? brl(escolhido) : (minimo ? 'a partir de ' + brl(minimo) : ''))}</span></button>`;
  }).join('');
  qsa('[data-t]', el).forEach((b) => b.addEventListener('click', () => {
    estado.tamanho = b.dataset.t;
    const max = tamanhoAtual().max_sabores;
    if (estado.sabores.length > max) estado.sabores = estado.sabores.slice(0, max);
    renderTamanhos(); renderSabores(); renderMetades(); atualizarTotal();
  }));
}

function renderMetades() {
  const t = tamanhoAtual();
  const el = qs('[data-metades]');
  qs('[data-ajuda-sabor]').textContent = estado.grupo === 'calzone'
    ? 'Escolha o recheio do seu calzone.'
    : t.max_sabores > 1
    ? `Escolha 1 sabor inteiro ou 2 sabores (meio a meio). No meio a meio cobramos o sabor de maior valor.`
    : `A ${t.nome} vai com 1 sabor. Para meio a meio, escolha a Grande.`;
  qs('[data-contagem]').textContent = `${estado.sabores.length}/${t.max_sabores}`;
  const slots = t.max_sabores > 1 ? ['1ª metade', '2ª metade'] : [estado.grupo === 'calzone' ? 'Recheio' : 'Sabor'];
  el.innerHTML = slots.map((rot, i) => {
    const s = estado.sabores[i] ? D.saboresPorSlug[estado.sabores[i]] : null;
    const vazio = i === 1 ? (estado.sabores.length === 1 ? 'Quer meio a meio? Escolha o 2º sabor' : 'Escolha abaixo') : 'Escolha abaixo';
    return `<div class="metade ${s ? 'cheia' : ''}"><small>${rot}${i === 1 ? ' (opcional)' : ''}</small><b>${s ? esc(s.nome) : vazio}</b>${s ? `<button type="button" data-rm="${i}" aria-label="Remover ${esc(s.nome)}">${icone('x')}</button>` : ''}</div>`;
  }).join('');
  qsa('[data-rm]', el).forEach((b) => b.addEventListener('click', () => { estado.sabores.splice(Number(b.dataset.rm), 1); renderTamanhos(); renderSabores(); renderMetades(); atualizarTotal(); }));
  // foto e título acompanham o primeiro sabor
  const s0 = estado.sabores[0] ? D.saboresPorSlug[estado.sabores[0]] : null;
  const s1 = estado.sabores[1] ? D.saboresPorSlug[estado.sabores[1]] : null;
  qs('[data-titulo]').textContent = s0 ? (s1 ? `${s0.nome.split(' (')[0]} + ${s1.nome.split(' (')[0]}` : (estado.grupo === 'calzone' ? 'Calzone ' : '') + s0.nome) : 'Monte sua pizza';
  qs('[data-desc]').textContent = s0 ? (s1 ? `Meio ${s0.nome.split(' (')[0]}: ${s0.descricao} Meio ${s1.nome.split(' (')[0]}: ${s1.descricao}` : s0.descricao) : 'Escolha o tamanho e até dois sabores na mesma pizza.';
  const foto = qs('[data-foto]');
  if (s0?.imagem_url) { foto.classList.remove('vazia'); if (foto.dataset.src !== s0.imagem_url) { foto.dataset.src = s0.imagem_url; foto.innerHTML = fotoGrande(s0.imagem_url); } }
  else { foto.classList.add('vazia'); foto.innerHTML = icone('pizza'); }
}

function renderSabores() {
  const t = tamanhoAtual();
  const busca = (qs('[data-busca]').value || '').toLowerCase();
  const filtro = qs('[data-filtros] .ativo').dataset.f;
  const lista = D.sabores.filter((s) => {
    if ((s.tipo === 'calzone') !== (estado.grupo === 'calzone')) return false;
    if (busca && !s.nome.toLowerCase().includes(busca) && !(s.descricao || '').toLowerCase().includes(busca)) return false;
    if (filtro === 'salgada' || filtro === 'doce') return s.tipo === filtro;
    if (filtro === 'vegetariana') return s.tags?.includes('vegetariana') || s.tags?.includes('vegana');
    return true;
  }).sort((a, b) => (b.disponivel - a.disponivel) || (a.tipo === 'doce') - (b.tipo === 'doce') || a.ordem - b.ordem);
  const cheio = estado.sabores.length >= t.max_sabores;
  qs('[data-lista-sabores]').innerHTML = lista.map((s) => {
    const preco = s.precos[t.slug];
    const ativo = estado.sabores.includes(s.slug);
    const off = !s.disponivel || !preco || (cheio && !ativo);
    return `<button type="button" aria-pressed="${ativo}" class="sabor-item ${ativo ? 'ativo' : ''}" data-s="${esc(s.slug)}" ${off ? 'disabled' : ''}>
      ${s.imagem_url ? fotoHTML(s.imagem_url, { w: 48, cls: '' }) : `<div class="ph">${icone('pizza')}</div>`}
      <div><b>${esc(s.nome)} ${s.tipo === 'doce' ? '<span class="tag">doce</span>' : ''}${!s.disponivel ? '<span class="tag esgotado">esgotado</span>' : ''}</b><small>${esc(s.descricao || '')}</small></div>
      <span class="p">${preco ? brl(preco) : ''}</span></button>`;
  }).join('') || '<p class="muted small">Nenhum sabor encontrado.</p>';
  qsa('[data-s]').forEach((b) => b.addEventListener('click', () => {
    const slug = b.dataset.s;
    if (estado.sabores.includes(slug)) estado.sabores = estado.sabores.filter((x) => x !== slug);
    else estado.sabores.push(slug);
    renderTamanhos(); renderSabores(); renderMetades(); atualizarTotal();
  }));
}

function precoPizza() {
  const t = tamanhoAtual();
  if (!estado.sabores.length) return 0;
  return Math.max(...estado.sabores.map((sl) => Number(D.saboresPorSlug[sl].precos[t.slug] || 0)));
}

// total + rótulo do que já foi escolhido; o botão diz exatamente o que falta
function atualizarTotal() {
  const p = estado.produto ? precoProduto() : precoPizza();
  const rotulo = qs('[data-total-rotulo]');
  totalEl.textContent = brl(p * estado.quantidade);
  if (estado.produto) {
    const falta = passoFaltando();
    if (!estado.produto.disponivel) { btnAdd.disabled = true; btnAdd.textContent = 'Esgotado'; }
    else {
      btnAdd.disabled = !!falta;
      const t = falta ? falta.titulo.trim() : '';
      const nPassos = (estado.produto.passos || []).length;
      btnAdd.textContent = falta ? `${/^escolh/i.test(t) ? t : 'Escolha ' + t.toLowerCase()}${nPassos > 1 ? ` (passo ${falta.i + 1})` : ''}` : 'Adicionar à sacola';
      if (!falta) btnAdd.textContent = 'Adicionar à sacola';
    }
    if (rotulo) rotulo.textContent = estado.quantidade > 1 ? `${estado.quantidade}× ${estado.produto.nome}` : 'Total';
    return;
  }
  const t = tamanhoAtual();
  const n = estado.sabores.length;
  btnAdd.disabled = n === 0;
  btnAdd.textContent = n ? 'Adicionar à sacola' : (estado.grupo === 'calzone' ? 'Escolha o recheio' : 'Escolha um sabor');
  if (rotulo) rotulo.textContent = n ? `${n > 1 ? 'Meio a meio' : n + ' sabor'} · ${t.nome}${estado.quantidade > 1 ? ` · ${estado.quantidade}×` : ''}` : `${t.nome} · falta o sabor`;
}

function adicionarPizza() {
  const t = tamanhoAtual();
  const nomes = estado.sabores.map((sl) => D.saboresPorSlug[sl].nome);
  const s0 = D.saboresPorSlug[estado.sabores[0]];
  cart.adicionar({
    tipo: 'pizza', tamanho: t.slug, sabores: [...estado.sabores],
    nome: t.grupo === 'calzone' ? `Calzone ${t.nome}` : `Pizza ${t.nome} (${t.fatias} fatias)`,
    descricao: nomes.length > 1 ? `Meio a meio: ${nomes.join(' / ')}` : nomes[0],
    imagem: s0?.imagem_url || null,
    preco: precoPizza(), quantidade: estado.quantidade, observacao: estado.observacao.trim() || null,
  });
  track('add_item', { origem: 'configurador', tipo: 'pizza', tamanho: t.slug, sabores: estado.sabores.length });
  // sem sheet de upsell: vai direto para "Fechar pedido" (a faixa "Completa com" fica lá, sem bloquear)
  toast(`${nomes.map(nomeCurto).join(' + ')} ${t.nome} na sacola`);
  location.href = 'checkout.html';
}

// ------------------------------------------------------------------
// PRODUTO SIMPLES / COMBO
// ------------------------------------------------------------------
function montarProduto(p) {
  if (!p) { raiz.innerHTML = '<p class="aviso erro">Produto não encontrado. <a href="cardapio.html">Voltar ao cardápio</a></p>'; return; }
  estado.produto = p;
  document.title = `${p.nome} · Sesconetto's Pizzeria`;
  const passos = Array.isArray(p.passos) ? p.passos : [];
  raiz.removeAttribute('aria-busy');
  raiz.innerHTML = `
    <div><div class="foto-grande ${p.imagem_url ? '' : 'vazia'}">${p.imagem_url ? fotoGrande(p.imagem_url) : icone('pizza')}</div></div>
    <div class="produto-corpo">
      <div class="tags" style="margin-bottom:6px">${(p.tags || []).map(tagHTML).join('')}${p.disponivel ? '' : tagHTML('esgotado')}</div>
      <h1>${esc(p.nome)}</h1>
      <p class="desc">${esc(p.descricao || '')}</p>
      <p class="preco">${brl(p.preco)}</p>
      ${passos.map((ps, i) => `
      <div class="bloco">
        <h3>${i + 1}. ${esc(ps.titulo)} <span class="muted small">${ps.min > 0 ? 'obrigatório' : 'opcional'}</span></h3>
        <div class="radio-lista" data-passo="${i}" ${ps.max === 1 ? `role="radiogroup" aria-label="${esc(ps.titulo)}"` : `role="group" aria-label="${esc(ps.titulo)}"`}>
          ${(ps.opcoes || []).map((slug) => { const o = D.produtosPorSlug[slug]; if (!o) return ''; return `<button type="button" ${ps.max === 1 ? 'role="radio" aria-checked="false"' : 'aria-pressed="false"'} class="opcao ${ps.max === 1 ? '' : 'check'}" data-op="${esc(slug)}" ${o.disponivel ? '' : 'disabled'}><b>${esc(o.nome)}</b>${o.disponivel ? '' : '<small>esgotado</small>'}</button>`; }).join('')}
        </div>
      </div>`).join('')}
      <div class="bloco">
        <h3>Observações <span class="muted small">opcional</span></h3>
        <textarea class="obs" placeholder="Alguma observação?" data-obs maxlength="200" aria-label="Observações"></textarea>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
          <span class="strong">Quantidade</span>
          <div class="qtd"><button type="button" data-qtd="-1" aria-label="Diminuir quantidade">${icone('menos')}</button><span data-qtd-v aria-live="polite">1</span><button type="button" data-qtd="1" aria-label="Aumentar quantidade">${icone('mais')}</button></div>
        </div>
      </div>
    </div>`;
  qsa('[data-passo]').forEach((grupo) => {
    const i = Number(grupo.dataset.passo); const ps = passos[i];
    qsa('[data-op]', grupo).forEach((b) => b.addEventListener('click', () => {
      const sel = estado.escolhas[i] || [];
      if (ps.max === 1) estado.escolhas[i] = [b.dataset.op];
      else if (sel.includes(b.dataset.op)) estado.escolhas[i] = sel.filter((x) => x !== b.dataset.op);
      else if (sel.length < ps.max) estado.escolhas[i] = [...sel, b.dataset.op];
      qsa('[data-op]', grupo).forEach((x) => { const on = (estado.escolhas[i] || []).includes(x.dataset.op); x.classList.toggle('ativo', on); x.setAttribute(ps.max === 1 ? 'aria-checked' : 'aria-pressed', String(on)); });
      atualizarTotal();
    }));
  });
  qs('[data-obs]').addEventListener('input', (e) => (estado.observacao = e.target.value));
  qsa('[data-qtd]').forEach((b) => b.addEventListener('click', () => { estado.quantidade = Math.max(1, Math.min(10, estado.quantidade + Number(b.dataset.qtd))); qs('[data-qtd-v]').textContent = estado.quantidade; atualizarTotal(); }));
  btnAdd.addEventListener('click', () => {
    if (!p.disponivel) { toast(`${p.nome} acabou por hoje.`, 'erro'); return; }
    const escolhas = Object.values(estado.escolhas).flat();
    cart.adicionar({
      tipo: 'produto', slug: p.slug, escolhas, nome: p.nome,
      descricao: escolhas.map((s) => D.produtosPorSlug[s]?.nome).filter(Boolean).join(', ') || null,
      imagem: p.imagem_url, preco: Number(p.preco), quantidade: estado.quantidade, observacao: estado.observacao.trim() || null,
    });
    track('add_item', { origem: 'configurador', tipo: 'produto', slug: p.slug });
    toast(`${p.nome} na sacola`);
    location.href = 'checkout.html';
  });
  barra.hidden = false; document.body.classList.add('tem-barra');
  atualizarTotal();
}
function precoProduto() { return Number(estado.produto.preco); }
// primeiro passo obrigatório ainda não atendido ({i, titulo}) ou null
function passoFaltando() {
  const passos = Array.isArray(estado.produto.passos) ? estado.produto.passos : [];
  const i = passos.findIndex((ps, k) => (estado.escolhas[k] || []).length < (ps.min || 0));
  return i < 0 ? null : { i, titulo: passos[i].titulo || 'a opção' };
}
function passosOk() { return estado.produto.disponivel && !passoFaltando(); }
