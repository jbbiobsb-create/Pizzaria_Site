// Cards de sabor e de produto usados na home e no cardápio.
// Produto simples (sem passos) tem "Adicionar" rápido no próprio card, que vira um stepper
// quando o item já está na sacola. Pizzas e combos abrem o configurador (produto.html).
import { brl, esc, qs, qsa, toast, track } from './util.js';
import { tagHTML } from './ui.js';
import { icone } from './icons.js';
import * as cart from './cart.js';
import { carregarCardapio } from './api.js';

// Foto de card/lista: WebP responsivo por convenção (foo.jpg → foo-240.webp, foo-480.webp) com o JPG do banco como
// fallback. Se a variante não existir (foto nova sem conversão), o listener de erro abaixo remove os <source> e recarrega o JPG.
export function fotoHTML(url, { w = 96, cls = 'foto', eager = false, alt = '' } = {}) {
  const base = String(url).replace(/\.(jpe?g|png)$/i, '');
  const temVariante = base !== String(url) && /^img\//.test(url);
  const img = `<img class="${cls}" src="${esc(url)}" alt="${esc(alt)}" width="${w}" height="${w}" loading="${eager ? 'eager' : 'lazy'}" decoding="async"${eager ? ' fetchpriority="high"' : ''}>`;
  if (!temVariante) return img;
  return `<picture><source type="image/webp" srcset="${esc(base)}-240.webp 240w, ${esc(base)}-480.webp 480w" sizes="${w}px">${img}</picture>`;
}
document.addEventListener('error', (ev) => {
  const img = ev.target;
  if (!(img instanceof HTMLImageElement) || img.dataset.fb) return;
  const pic = img.closest('picture'); if (!pic) return;
  img.dataset.fb = '1'; qsa('source', pic).forEach((s) => s.remove());
  const src = img.getAttribute('src'); img.removeAttribute('srcset'); img.src = src; // força nova tentativa com o JPG
}, true);

const FOTO_PADRAO = { pizza: 'pizza', bebida: 'bebida', combo: 'combo', molho: 'molho', sanduiche: 'sanduiche', entrada: 'entrada', sobremesa: 'sobremesa', cerveja: 'cerveja', vinho: 'vinho', drink: 'drink' };

// texto usado pela busca do cardápio (sem acento, minúsculo)
export const normalizar = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// nome sem o parêntese ("Nápoles (Napolitana)" → "Nápoles")
export const nomeCurto = (n) => String(n || '').split(' (')[0];
// descrição começando pelo que diferencia: a frase da massa/molho, igual em todos, fica só no configurador
const PREFIXOS = [/^massa artesanal aberta à mão,\s*/i, /^massa napolitana de longa fermentação,\s*/i, /^calzone recheado com:\s*/i, /^molho de tomate caseiro,\s*/i, /^pomodoro pelat+i italiano,\s*/i];
export function descricaoCurta(d) {
  let t = String(d || '').trim();
  let mudou = true;
  while (mudou) { mudou = false; for (const rx of PREFIXOS) { const n = t.replace(rx, ''); if (n !== t) { t = n; mudou = true; } } }
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}
// tamanhos de um sabor, na ordem em que aparecem no card (menor → maior; o maior é a âncora à direita)
const ORDEM_TAM = ['bambina', 'grande', 'calzone-individual', 'calzone-familia'];
const NOME_TAM = { bambina: 'Bambina', grande: 'Grande', 'calzone-individual': 'Individual', 'calzone-familia': 'Família' };
export function tamanhosDoSabor(s) {
  return Object.entries(s.precos || {}).filter(([, v]) => Number(v) > 0).sort((a, b) => ORDEM_TAM.indexOf(a[0]) - ORDEM_TAM.indexOf(b[0]));
}

// i = posição na lista (os 3 primeiros cards da página carregam a foto sem lazy: são candidatos a LCP)
export function cardSabor(s, i = 99) {
  const tags = s.tags || [];
  const href = `produto.html?sabor=${esc(s.slug)}`;
  const foto = s.imagem_url ? fotoHTML(s.imagem_url, { eager: i < 3 }) : `<div class="foto vazia">${icone(s.tipo === 'calzone' ? 'calzone' : 'pizza')}</div>`;
  const tam = tamanhosDoSabor(s);
  // chips: cada um adiciona a pizza inteira em 1 toque; o corpo do card abre o configurador (meio a meio / observações)
  const chips = s.disponivel && tam.length
    ? `<div class="tamanho-chips" role="group" aria-label="Adicionar ${esc(nomeCurto(s.nome))}">${tam.map(([t, v]) => `<button type="button" class="chip-tamanho" data-add-pizza="${esc(s.slug)}" data-tamanho="${esc(t)}" aria-label="Adicionar ${esc(nomeCurto(s.nome))} ${esc(NOME_TAM[t] || t)} por ${brl(v)}"><span>${esc(NOME_TAM[t] || t)}</span><b>${brl(v)}</b></button>`).join('')}</div>`
    : '';
  return `
  <article class="card card-pizza ${s.disponivel ? '' : 'indisponivel'}" data-busca="${esc(normalizar(s.nome + ' ' + (s.descricao || '')))}">
    ${foto}
    <div class="corpo">
      <div class="tags">${tags.map(tagHTML).join('')}${s.disponivel ? '' : tagHTML('esgotado')}</div>
      <h3><a class="card-link" href="${href}">${esc(nomeCurto(s.nome))}</a></h3>
      <p>${esc(descricaoCurta(s.descricao))}</p>
      <div class="rodape rodape-pizza">
        ${chips || `<span class="apartir">${s.disponivel ? '' : 'Acabou por hoje'}</span>`}
        <a class="card-mais" href="${href}">${s.tipo === 'calzone' ? 'Observações' : 'Meio a meio ou observações'}</a>
      </div>
    </div>
  </article>`;
}

export function cardProduto(p, i = 99) {
  const ic = FOTO_PADRAO[p.categoria?.replace(/s$/, '')] || 'pizza';
  const href = `produto.html?p=${esc(p.slug)}`;
  const simples = !(Array.isArray(p.passos) && p.passos.length);
  // latas, garrafas, combos: recorte em fundo branco → multiply sobre o papel (DESIGN.md §8)
  const recorte = ['bebidas', 'cervejas', 'vinhos', 'combos', 'drinks'].includes(p.categoria) ? ' foto--recorte' : '';
  const foto = p.imagem_url ? fotoHTML(p.imagem_url, { cls: 'foto' + recorte, eager: i < 3 }) : `<div class="foto vazia">${icone(ic)}</div>`;
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
  const grande = tamanhos.find((t) => t.slug === 'grande');
  const base = grande?.precoMin ?? Math.min(...tamanhos.map((t) => t.precoMin || Infinity));
  return `
  <div class="card card-destaque card-monte">
    <h3>Meio a meio: dois sabores, uma pizza</h3>
    <p>Grande, 8 fatias, cobramos o sabor de maior valor.</p>
    <a class="btn btn-light" href="produto.html?meio=1">Montar a minha${isFinite(base) ? ` · a partir de ${brl(base)}` : ''}</a>
  </div>`;
}

// ---------- adicionar rápido + stepper ----------
// quantidade de um produto simples na sacola (só itens sem escolhas/observação, que são os do card)
function uidNaSacola(slug) {
  return cart.itens().find((i) => i.tipo === 'produto' && i.slug === slug && !(i.escolhas || []).length && !i.observacao)?.uid;
}

// quantidades por slug em um passe só (uma leitura do localStorage por atualização, não uma por card)
function mapaQtd() {
  const m = new Map();
  for (const i of cart.itens()) if (i.tipo === 'produto' && !(i.escolhas || []).length && !i.observacao) m.set(i.slug, (m.get(i.slug) || 0) + i.quantidade);
  return m;
}
// redesenha o "+" ou o stepper de cada card conforme a sacola
export function atualizarSteppers(raiz = document) {
  const qtd = mapaQtd();
  qsa('[data-rapido]', raiz).forEach((el) => {
    if (el.dataset.ok) return; // "✓" de confirmação em curso: vira stepper daqui a pouco (ver ativarAddRapido)
    const slug = el.dataset.rapido; const n = qtd.get(slug) || 0;
    const nome = el.closest('.card, .completa-item')?.querySelector('h3, b')?.textContent || '';
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
    const n = qtd.get(st.dataset.stepper) || 0;
    const menos = qs('[data-step="-1"]', st); if (menos) menos.innerHTML = icone(n === 1 ? 'lixeira' : 'menos');
  });
}

let ativado = false;
// na tela "Fechar pedido" o toast não precisa do botão "Ver sacola"
const acaoSacola = () => (document.body.dataset.pagina === 'checkout' ? null : { rotulo: 'Ver sacola', href: 'checkout.html' });

// liga (uma vez por página) os cliques de "+", dos chips de tamanho e do stepper por delegação
export function ativarAddRapido() {
  if (ativado) return; ativado = true;
  document.addEventListener('click', async (ev) => {
    const add = ev.target.closest('[data-add-rapido]');
    const pizza = ev.target.closest('[data-add-pizza]');
    const step = ev.target.closest('[data-step]');
    if (!add && !step && !pizza) return;
    ev.preventDefault(); ev.stopPropagation();
    const d = await carregarCardapio();
    if (pizza) {
      const s = d.saboresPorSlug[pizza.dataset.addPizza]; const t = d.tamanhosPorSlug[pizza.dataset.tamanho];
      if (!s || !t || !s.disponivel || !s.precos?.[t.slug]) { toast(`A ${nomeCurto(s?.nome || 'pizza')} acabou por hoje.`, 'erro'); return; }
      cart.adicionar({
        tipo: 'pizza', tamanho: t.slug, sabores: [s.slug],
        nome: t.grupo === 'calzone' ? `Calzone ${t.nome}` : `Pizza ${t.nome} (${t.fatias} fatias)`,
        descricao: s.nome, imagem: s.imagem_url || null, preco: Number(s.precos[t.slug]), quantidade: 1,
      });
      // feedback no próprio chip
      const html = pizza.innerHTML; pizza.classList.add('ok'); pizza.innerHTML = `${icone('check')} <span>Na sacola</span>`;
      setTimeout(() => { pizza.classList.remove('ok'); pizza.innerHTML = html; }, 1600);
      toast(`${nomeCurto(s.nome)} ${t.nome} na sacola`, 'ok', 3200, acaoSacola());
      track('add_item', { origem: 'card', tipo: 'pizza', slug: s.slug, tamanho: t.slug });
      try { navigator.vibrate?.(10); } catch {}
      return;
    }
    if (add) {
      const p = d.produtosPorSlug[add.dataset.addRapido];
      if (!p || !p.disponivel) { toast('Esse item acabou por hoje.', 'erro'); return; }
      // o botão vira ✓ ANTES de mudar a sacola (o onChange redesenharia o botão no mesmo tick) e só depois vira stepper
      const wrap = add.closest('[data-rapido]');
      add.classList.add('ok'); add.innerHTML = icone('check'); add.setAttribute('aria-label', `${p.nome} adicionado`);
      if (wrap) { wrap.dataset.ok = '1'; setTimeout(() => { delete wrap.dataset.ok; atualizarSteppers(wrap.parentElement || document); }, 500); }
      cart.adicionar({ tipo: 'produto', slug: p.slug, escolhas: [], nome: p.nome, imagem: p.imagem_url, preco: Number(p.preco), quantidade: 1 });
      toast(`${p.nome} na sacola`, 'ok', 3200, acaoSacola());
      track('add_item', { origem: add.closest('[data-completa]') ? 'faixa' : 'card', tipo: 'produto', slug: p.slug });
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
