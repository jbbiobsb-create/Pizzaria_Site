// Configurador: pizza (tamanho + até 2 sabores) ou produto simples / combo
import { montarLayout, montarFooter, abrirUpsell, tagHTML } from '../ui.js';
import { carregarCardapio } from '../api.js';
import * as cart from '../cart.js';
import { qs, qsa, esc, brl, param, toast } from '../util.js';

montarLayout({ pagina: 'cardapio' });
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

  document.title = `${sab ? sab.nome : 'Monte sua pizza'} — Sesconetto's Pizzeria`;
  raiz.innerHTML = `
    <div>
      <div class="foto-grande ${sab?.imagem_url ? '' : 'vazia'}" data-foto>${sab?.imagem_url ? `<img src="${esc(sab.imagem_url)}" alt="${esc(sab.nome)}">` : '🍕'}</div>
      <p class="small muted" style="margin-top:10px">${esc(D.config.sobre_massa || '')}</p>
    </div>
    <div>
      <div class="tags" style="margin-bottom:6px">${(sab?.tags || []).map(tagHTML).join('')}</div>
      <h1 data-titulo>${sab ? (CZ ? 'Calzone ' : '') + esc(sab.nome) : 'Monte sua pizza'}</h1>
      <p class="desc" data-desc>${sab ? esc(sab.descricao || '') : 'Escolha o tamanho e até dois sabores na mesma pizza.'}</p>

      <div class="bloco">
        <h3>1. Tamanho</h3>
        <p class="ajuda">${CZ ? 'Individual serve 1 pessoa; Família serve 2 ou mais.' : 'Bambina (4 fatias) serve 1 pessoa; Grande (8 fatias) serve 2 a 3.'}</p>
        <div class="opcoes" data-tamanhos></div>
      </div>

      <div class="bloco">
        <h3>2. ${CZ ? 'Recheio' : 'Sabores'} <span class="muted small" data-contagem></span></h3>
        <p class="ajuda" data-ajuda-sabor></p>
        <div class="metades" data-metades></div>
        <input class="busca" placeholder="Buscar sabor…" data-busca>
        <div class="filtros-sabor" data-filtros ${CZ ? 'hidden' : ''}>
          <button data-f="todos" class="ativo">Todos</button>
          <button data-f="salgada">Salgadas</button>
          <button data-f="doce">Doces</button>
          <button data-f="vegetariana">Vegetarianas</button>
        </div>
        <div class="lista-sabores" data-lista-sabores></div>
      </div>

      <div class="bloco">
        <h3>3. Observações <span class="muted small">opcional</span></h3>
        <textarea class="obs" placeholder="Ex.: sem cebola, bem assada, cortar em mais pedaços…" data-obs maxlength="200"></textarea>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
          <span class="strong">Quantidade</span>
          <div class="qtd"><button type="button" data-qtd="-1">−</button><span data-qtd-v>1</span><button type="button" data-qtd="1">+</button></div>
        </div>
      </div>
    </div>`;

  renderTamanhos();
  renderSabores();
  renderMetades();
  qs('[data-busca]').addEventListener('input', renderSabores);
  qsa('[data-filtros] button').forEach((b) => b.addEventListener('click', () => { qsa('[data-filtros] button').forEach((x) => x.classList.remove('ativo')); b.classList.add('ativo'); renderSabores(); }));
  qs('[data-obs]').addEventListener('input', (e) => (estado.observacao = e.target.value));
  qsa('[data-qtd]').forEach((b) => b.addEventListener('click', () => { estado.quantidade = Math.max(1, Math.min(10, estado.quantidade + Number(b.dataset.qtd))); qs('[data-qtd-v]').textContent = estado.quantidade; atualizarTotal(); }));
  btnAdd.addEventListener('click', adicionarPizza);
  barra.hidden = false; document.body.classList.add('tem-barra');
  atualizarTotal();
}

function tamanhoAtual() { return D.tamanhosPorSlug[estado.tamanho]; }

function renderTamanhos() {
  const el = qs('[data-tamanhos]');
  el.innerHTML = D.tamanhos.filter((t) => (t.grupo || 'pizza') === estado.grupo).map((t) => {
    const precos = D.sabores.filter((s) => s.disponivel && s.precos[t.slug]).map((s) => Number(s.precos[t.slug]));
    const minimo = precos.length ? Math.min(...precos) : null;
    // se já há sabor escolhido, mostra o preço dele nesse tamanho
    const escolhido = estado.sabores.length ? Math.max(...estado.sabores.map((sl) => Number(D.saboresPorSlug[sl].precos[t.slug] || 0))) : 0;
    const semPreco = estado.sabores.some((sl) => !D.saboresPorSlug[sl].precos[t.slug]);
    return `<button type="button" class="opcao ${estado.tamanho === t.slug ? 'ativo' : ''}" data-t="${esc(t.slug)}" ${semPreco ? 'disabled' : ''}>
      <b>${esc(t.nome)}</b><small>${t.grupo === 'calzone' ? '1 recheio' : `${t.fatias} fatias · ${t.max_sabores > 1 ? `até ${t.max_sabores} sabores` : '1 sabor'}`}</small>
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
    return `<div class="metade ${s ? 'cheia' : ''}"><small>${rot}${i === 1 ? ' (opcional)' : ''}</small><b>${s ? esc(s.nome) : 'Escolha abaixo'}</b>${s ? `<button type="button" data-rm="${i}" aria-label="Remover">×</button>` : ''}</div>`;
  }).join('');
  qsa('[data-rm]', el).forEach((b) => b.addEventListener('click', () => { estado.sabores.splice(Number(b.dataset.rm), 1); renderTamanhos(); renderSabores(); renderMetades(); atualizarTotal(); }));
  // foto e título acompanham o primeiro sabor
  const s0 = estado.sabores[0] ? D.saboresPorSlug[estado.sabores[0]] : null;
  const s1 = estado.sabores[1] ? D.saboresPorSlug[estado.sabores[1]] : null;
  qs('[data-titulo]').textContent = s0 ? (s1 ? `${s0.nome.split(' (')[0]} + ${s1.nome.split(' (')[0]}` : (estado.grupo === 'calzone' ? 'Calzone ' : '') + s0.nome) : 'Monte sua pizza';
  qs('[data-desc]').textContent = s0 ? (s1 ? `Meio ${s0.nome.split(' (')[0]}: ${s0.descricao} Meio ${s1.nome.split(' (')[0]}: ${s1.descricao}` : s0.descricao) : 'Escolha o tamanho e até dois sabores na mesma pizza.';
  const foto = qs('[data-foto]');
  if (s0?.imagem_url) { foto.classList.remove('vazia'); foto.innerHTML = `<img src="${esc(s0.imagem_url)}" alt="${esc(s0.nome)}">`; }
  else { foto.classList.add('vazia'); foto.innerHTML = '🍕'; }
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
    return `<button type="button" class="sabor-item ${ativo ? 'ativo' : ''}" data-s="${esc(s.slug)}" ${off ? 'disabled' : ''}>
      ${s.imagem_url ? `<img src="${esc(s.imagem_url)}" alt="" loading="lazy">` : '<div class="ph">🍕</div>'}
      <div><b>${esc(s.nome)} ${s.tipo === 'doce' ? '<span class="tag">doce</span>' : ''}${!s.disponivel ? '<span class="tag esgotado">esgotado</span>' : ''}</b><small>${esc(s.descricao || '')}</small></div>
      <span class="p">${preco ? brl(preco) : '—'}</span></button>`;
  }).join('') || '<p class="muted small">Nenhum sabor encontrado.</p>';
  qsa('[data-s]').forEach((b) => b.addEventListener('click', () => {
    const slug = b.dataset.s;
    if (estado.sabores.includes(slug)) estado.sabores = estado.sabores.filter((x) => x !== slug);
    else estado.sabores.push(slug);
    renderTamanhos(); renderSabores(); renderMetades(); atualizarTotal();
    if (estado.sabores.length === 1 && t.max_sabores > 1) toast('Quer meio a meio? Escolha o 2º sabor. Ou adicione assim mesmo.', 'ok', 2500);
  }));
}

function precoPizza() {
  const t = tamanhoAtual();
  if (!estado.sabores.length) return 0;
  return Math.max(...estado.sabores.map((sl) => Number(D.saboresPorSlug[sl].precos[t.slug] || 0)));
}

function atualizarTotal() {
  const p = estado.produto ? precoProduto() : precoPizza();
  totalEl.textContent = brl(p * estado.quantidade);
  btnAdd.disabled = estado.produto ? !passosOk() : estado.sabores.length === 0;
  btnAdd.textContent = estado.produto ? 'Adicionar ao pedido' : (estado.sabores.length ? 'Adicionar ao pedido' : 'Escolha um sabor');
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
  toast(t.grupo === 'calzone' ? 'Calzone adicionado ao pedido!' : 'Pizza adicionada ao pedido!');
  abrirUpsell();
}

// ------------------------------------------------------------------
// PRODUTO SIMPLES / COMBO
// ------------------------------------------------------------------
function montarProduto(p) {
  if (!p) { raiz.innerHTML = '<p class="aviso erro">Produto não encontrado. <a href="cardapio.html">Voltar ao cardápio</a></p>'; return; }
  estado.produto = p;
  document.title = `${p.nome} — Sesconetto's Pizzeria`;
  const passos = Array.isArray(p.passos) ? p.passos : [];
  raiz.innerHTML = `
    <div><div class="foto-grande ${p.imagem_url ? '' : 'vazia'}">${p.imagem_url ? `<img src="${esc(p.imagem_url)}" alt="${esc(p.nome)}">` : '🍕'}</div></div>
    <div>
      <div class="tags" style="margin-bottom:6px">${(p.tags || []).map(tagHTML).join('')}${p.disponivel ? '' : tagHTML('esgotado')}</div>
      <h1>${esc(p.nome)}</h1>
      <p class="desc">${esc(p.descricao || '')}</p>
      <p class="preco" style="font-size:1.4rem;margin-bottom:16px">${brl(p.preco)}</p>
      ${passos.map((ps, i) => `
      <div class="bloco">
        <h3>${i + 1}. ${esc(ps.titulo)} <span class="muted small">${ps.min > 0 ? 'obrigatório' : 'opcional'}</span></h3>
        <div class="radio-lista" data-passo="${i}">
          ${(ps.opcoes || []).map((slug) => { const o = D.produtosPorSlug[slug]; if (!o) return ''; return `<button type="button" class="opcao" data-op="${esc(slug)}" ${o.disponivel ? '' : 'disabled'}><b>${esc(o.nome)}</b>${o.disponivel ? '' : '<small>esgotado</small>'}</button>`; }).join('')}
        </div>
      </div>`).join('')}
      <div class="bloco">
        <h3>Observações <span class="muted small">opcional</span></h3>
        <textarea class="obs" placeholder="Alguma observação?" data-obs maxlength="200"></textarea>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-top:12px">
          <span class="strong">Quantidade</span>
          <div class="qtd"><button type="button" data-qtd="-1">−</button><span data-qtd-v>1</span><button type="button" data-qtd="1">+</button></div>
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
      qsa('[data-op]', grupo).forEach((x) => x.classList.toggle('ativo', (estado.escolhas[i] || []).includes(x.dataset.op)));
      atualizarTotal();
    }));
  });
  qs('[data-obs]').addEventListener('input', (e) => (estado.observacao = e.target.value));
  qsa('[data-qtd]').forEach((b) => b.addEventListener('click', () => { estado.quantidade = Math.max(1, Math.min(10, estado.quantidade + Number(b.dataset.qtd))); qs('[data-qtd-v]').textContent = estado.quantidade; atualizarTotal(); }));
  btnAdd.addEventListener('click', () => {
    if (!p.disponivel) { toast('Produto esgotado no momento.', 'erro'); return; }
    const escolhas = Object.values(estado.escolhas).flat();
    cart.adicionar({
      tipo: 'produto', slug: p.slug, escolhas, nome: p.nome,
      descricao: escolhas.map((s) => D.produtosPorSlug[s]?.nome).filter(Boolean).join(', ') || null,
      imagem: p.imagem_url, preco: Number(p.preco), quantidade: estado.quantidade, observacao: estado.observacao.trim() || null,
    });
    toast(`${p.nome} adicionado!`);
    abrirUpsell(p.slug);
  });
  barra.hidden = false; document.body.classList.add('tem-barra');
  if (!p.disponivel) { btnAdd.disabled = true; btnAdd.textContent = 'Esgotado'; }
  atualizarTotal();
}
function precoProduto() { return Number(estado.produto.preco); }
function passosOk() {
  const passos = Array.isArray(estado.produto.passos) ? estado.produto.passos : [];
  return estado.produto.disponivel && passos.every((ps, i) => (estado.escolhas[i] || []).length >= (ps.min || 0));
}
