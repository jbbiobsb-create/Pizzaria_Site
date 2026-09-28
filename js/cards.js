// Cards de sabor e de produto usados na home e no cardápio
import { brl, esc } from './util.js';
import { tagHTML } from './ui.js';

const FOTO_PADRAO = { pizza: '🍕', bebida: '🥤', combo: '🍕', molho: '🫙', sanduiche: '🥪' };

export function cardSabor(s) {
  const tags = (s.tags || []).filter((t) => t !== 'mais-pedida' || true);
  const foto = s.imagem_url ? `<img class="foto" src="${esc(s.imagem_url)}" alt="${esc(s.nome)}" loading="lazy">` : `<div class="foto vazia">🍕</div>`;
  return `
  <a class="card ${s.disponivel ? '' : 'indisponivel'}" href="produto.html?sabor=${esc(s.slug)}">
    ${foto}
    <div class="corpo">
      <div class="tags">${tags.map(tagHTML).join('')}${s.disponivel ? '' : tagHTML('esgotado')}</div>
      <h3>${esc(s.nome)}</h3>
      <p>${esc(s.descricao || '')}</p>
      <div class="rodape">
        <span class="apartir">A partir de <b>${brl(s.precoMin)}</b></span>
        <span class="add" aria-hidden="true">+</span>
      </div>
    </div>
  </a>`;
}

export function cardProduto(p) {
  const icone = FOTO_PADRAO[p.categoria?.replace(/s$/, '')] || '🍕';
  const foto = p.imagem_url ? `<img class="foto" src="${esc(p.imagem_url)}" alt="${esc(p.nome)}" loading="lazy">` : `<div class="foto vazia">${icone}</div>`;
  return `
  <a class="card ${p.disponivel ? '' : 'indisponivel'}" href="produto.html?p=${esc(p.slug)}">
    ${foto}
    <div class="corpo">
      <div class="tags">${(p.tags || []).map(tagHTML).join('')}${p.disponivel ? '' : tagHTML('esgotado')}</div>
      <h3>${esc(p.nome)}</h3>
      <p>${esc(p.descricao || '')}</p>
      <div class="rodape">
        <span class="apartir"><b>${brl(p.preco)}</b></span>
        <span class="add" aria-hidden="true">+</span>
      </div>
    </div>
  </a>`;
}

export function cardMonte(tamanhos) {
  const menor = Math.min(...tamanhos.map((t) => t.precoMin || Infinity));
  return `
  <div class="card card-destaque">
    <h3>Monte sua pizza · meio a meio</h3>
    <p>Escolha o tamanho (Bambina, Média ou Grande) e até 2 sabores na mesma pizza. Massa napolitana de longa fermentação.</p>
    <a class="btn btn-light" href="produto.html?meio=1">Montar minha pizza ${isFinite(menor) ? `· a partir de ${brl(menor)}` : ''}</a>
  </div>`;
}
