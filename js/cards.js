// Cards de sabor e de produto usados na home e no cardápio.
// Produto simples (sem passos) tem "Adicionar" rápido no próprio card, que vira um stepper
// quando o item já está na sacola. Pizzas e combos abrem o configurador (produto.html).
import { brl, esc, qs, qsa, toast } from './util.js';
import { tagHTML } from './ui.js';
import { icone } from './icons.js';
import * as cart from './cart.js';
import { carregarCardapio } from './api.js';

const FOTO_PADRAO = { pizza: 'pizza', bebida: 'bebida', combo: 'combo', molho: 'molho', sanduiche: 'sanduiche', entrada: 'entrada', sobremesa: 'sobremesa', cerveja: 'cerveja', vinho: 'vinho', drink: 'drink' };

// texto usado pela busca do cardápio (sem acento, minúsculo)
export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function cardSabor(s) {
  const tags = s.tags || [];
  const href = `produto.html?sabor=${esc(s.slug)}`;
  const foto = s.imagem_url ? `<img class="foto" src="${esc(s.imagem_url)}" alt="" loading="lazy">` : `<div class="foto vazia">${icone(s.tipo === 'calzone' ? 'calzone' : 'pizza')}</div>`;
  return `
  <article class="card ${s.disponivel ? '' : 'indisponivel'}" data-busca="${esc(normalizar(s.nome + ' ' + (s.descricao || '')))}">
    ${foto}
    <div class="corpo">
      <div class="tags">${tags.map(tagHTML).join('')}${s.disponivel ? '' : tagHTML('esgotado')}</div>
      <h3><a class="card-link" href="${href}">${esc(s.nome)}</a></h3>
      <p>${esc(s.descricao || '')}</p>
      <div class="rodape">
        <span class="apartir">${s.precoMin != null ? `A partir de <b>${brl(s.precoMin)}</b>` : ''}</span>
        <a class="add" href="${href}" aria-label="Escolher ${esc(s.nome)}">${icone('mais')}</a>
      </div>
    </div>
  </article>`;
}

export function cardProduto(p) {
  const ic = FOTO_PADRAO[p.categoria?.replace(/s$/, '')] || 'pizza';
  const href = `produto.html?p=${esc(p.slug)}`;
  const simples = !(Array.isArray(p.passos) && p.passos.length);
  const foto = p.imagem_url ? `<img class="foto" src="${esc(p.imagem_url)}" alt="" loading="lazy">` : `<div class="foto vazia">${icone(ic)}</div>`;
  const acao = simples
    ? `<span data-rapido="${esc(p.slug)}"><button type="button" class="add" data-add-rapido="${esc(p.slug)}" aria-label="Adicionar ${esc(p.nome)}">${icone('mais')}</button></span>`
    : `<a class="add" href="${href}" aria-label="Montar ${esc(p.nome)}">${icone('mais')}</a>`;
  return `
  <article class="card ${p.disponivel ? '' : 'indisponivel'}" data-busca="${esc(normalizar(p.nome + ' ' + (p.descricao || '')))}">
    ${foto}
    <div class="corpo">
      <div class="tags">${(p.tags || []).map(tagHTML).join('')}${p.disponivel ? '' : tagHTML('esgotado')}</div>
      <h3><a class="card-link" href="${href}">${esc(p.nome)}</a></h3>
      <p>${esc(p.descricao || '')}</p>
      <div class="rodape">
        <span class="apartir"><b>${brl(p.preco)}</b></span>
        ${acao}
      </div>
    </div>
  </article>`;
}

export function cardMonte(tamanhos) {
  const menor = Math.min(...tamanhos.map((t) => t.precoMin || Infinity));
  return `
  <div class="card card-destaque">
    <h3>Monte sua pizza · meio a meio</h3>
    <p>Escolha o tamanho (Bambina ou Grande) e até 2 sabores na mesma pizza. Massa napolitana de longa fermentação.</p>
    <a class="btn btn-light" href="produto.html?meio=1">Montar minha pizza ${isFinite(menor) ? `· a partir de ${brl(menor)}` : ''}</a>
  </div>`;
}

// ---------- adicionar rápido + stepper ----------
// quantidade de um produto simples na sacola (só itens sem escolhas/observação, que são os do card)
function qtdNaSacola(slug) {
  return cart.itens().filter((i) => i.tipo === 'produto' && i.slug === slug && !(i.escolhas || []).length && !i.observacao).reduce((n, i) => n + i.quantidade, 0);
}
function uidNaSacola(slug) {
  return cart.itens().find((i) => i.tipo === 'produto' && i.slug === slug && !(i.escolhas || []).length && !i.observacao)?.uid;
}

// redesenha o "+" ou o stepper de cada card conforme a sacola
export function atualizarSteppers(raiz = document) {
  qsa('[data-rapido]', raiz).forEach((el) => {
    const slug = el.dataset.rapido; const n = qtdNaSacola(slug);
    const nome = el.closest('.card')?.querySelector('h3')?.textContent || '';
    if (!n) {
      if (!qs('[data-add-rapido]', el)) el.innerHTML = `<button type="button" class="add" data-add-rapido="${esc(slug)}" aria-label="Adicionar ${esc(nome)}">${icone('mais')}</button>`;
      return;
    }
    const out = qs('output', el);
    if (out) { out.textContent = n; return; }
    el.innerHTML = `<div class="stepper" data-stepper="${esc(slug)}">
      <button type="button" data-step="-1" aria-label="Tirar um ${esc(nome)}">${icone(n === 1 ? 'lixeira' : 'menos')}</button>
      <output aria-live="polite">${n}</output>
      <button type="button" data-step="1" aria-label="Adicionar mais um ${esc(nome)}">${icone('mais')}</button>
    </div>`;
  });
  // ícone do "−" vira lixeira quando resta 1
  qsa('[data-stepper]', raiz).forEach((st) => {
    const n = qtdNaSacola(st.dataset.stepper);
    const menos = qs('[data-step="-1"]', st); if (menos) menos.innerHTML = icone(n === 1 ? 'lixeira' : 'menos');
  });
}

let ativado = false;
// liga (uma vez por página) os cliques de "+" e do stepper por delegação
export function ativarAddRapido() {
  if (ativado) return; ativado = true;
  document.addEventListener('click', async (ev) => {
    const add = ev.target.closest('[data-add-rapido]');
    const step = ev.target.closest('[data-step]');
    if (!add && !step) return;
    ev.preventDefault(); ev.stopPropagation();
    const d = await carregarCardapio();
    if (add) {
      const p = d.produtosPorSlug[add.dataset.addRapido];
      if (!p || !p.disponivel) { toast('Produto esgotado no momento.', 'erro'); return; }
      cart.adicionar({ tipo: 'produto', slug: p.slug, escolhas: [], nome: p.nome, imagem: p.imagem_url, preco: Number(p.preco), quantidade: 1 });
      add.classList.add('ok'); add.innerHTML = icone('check');
      toast(`${p.nome} na sacola`);
      try { navigator.vibrate?.(10); } catch {}
      return;
    }
    const slug = step.closest('[data-stepper]').dataset.stepper;
    const uid = uidNaSacola(slug);
    if (uid) cart.alterarQtd(uid, Number(step.dataset.step));
  });
  cart.onChange(() => atualizarSteppers());
  atualizarSteppers();
}
