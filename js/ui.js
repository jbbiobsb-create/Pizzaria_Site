// Componentes compartilhados: header, subheader, tab bar, footer, modais (entrega, upsell)
import * as cart from './cart.js';
import { carregarCardapio, buscarCep, geocodificar, calcularEntrega } from './api.js';
import { brl, esc, qs, qsa, mascaraCep, resumoHorario, whatsappLink, toast, lerLS, gravarLS } from './util.js';
import { LS } from './config.js';
import { icone, hidratarIcones } from './icons.js';

// Ícones: ver js/icons.js
export { icone, hidratarIcones };

let CFG = null;

export async function config() {
  if (CFG) return CFG;
  const d = await carregarCardapio();
  CFG = d.config; CFG.aberta = d.aberta; CFG.lojas = d.lojas || [];
  return CFG;
}

// loja pelo slug (ou a principal)
export function lojaPorSlug(c, slug) {
  const ls = c?.lojas || [];
  return ls.find((l) => l.slug === slug) || ls.find((l) => l.principal) || ls[0] || null;
}
export function enderecoLoja(l) {
  const e = l?.endereco || {};
  return [e.rua, e.numero].filter(Boolean).join(', ') + (e.complemento ? ' - ' + e.complemento : '') + ` — ${e.bairro || ''}`;
}

// ------------------------------------------------------------------
// Layout
// ------------------------------------------------------------------
export function montarLayout({ pagina = '', subheader = true } = {}) {
  const c = lerLS(LS.cardapio)?.dados?.config || {};
  const nome = c.nome || "Sesconetto's Pizzeria";
  document.body.classList.add('com-tabbar');
  const header = `
  <header class="header">
    <div class="container">
      <a href="index.html" class="logo"><img src="img/logo.jpg" alt="${esc(nome)}"><span>${esc(nome)}<small>Napolitana · Brasília</small></span></a>
      <nav class="nav">
        <a href="cardapio.html" class="${pagina === 'cardapio' ? 'ativo' : ''}">Cardápio</a>
        <a href="cardapio.html#combos" class="${pagina === 'combos' ? 'ativo' : ''}">Combos</a>
        <a href="index.html#sobre">Nossa massa</a>
        <a href="pedido.html" class="${pagina === 'pedido' ? 'ativo' : ''}">Acompanhar pedido</a>
      </nav>
      <div class="header-right">
        <a href="cardapio.html" class="btn btn-sm btn-pedir">Pedir agora</a>
        <a href="carrinho.html" class="btn-carrinho" aria-label="Seu pedido">${icone('sacola')}<span class="txt">Pedido</span><span class="badge" data-badge></span></a>
      </div>
    </div>
  </header>
  ${subheader ? `<div class="subheader"><div class="container">
      <div class="seg" data-seg>
        <button data-tipo="entrega">Entrega</button>
        <button data-tipo="retirada"><span class="longo">Retirar na loja</span><span class="curto">Retirada</span></button>
      </div>
      <button class="pill-end" data-abrir-entrega>${icone('pin')}<span data-endereco-txt>Onde você está?</span></button>
      <div class="status-loja" data-status-loja><i></i><span>…</span></div>
  </div></div>` : ''}`;
  const tabbar = `
  <nav class="tabbar">
    <a href="index.html" class="${pagina === 'home' ? 'ativo' : ''}">${icone('casa')}Início</a>
    <a href="cardapio.html" class="${pagina === 'cardapio' ? 'ativo' : ''}">${icone('pizza')}Cardápio</a>
    <a href="carrinho.html" class="${pagina === 'carrinho' ? 'ativo' : ''}">${icone('sacola')}Pedido<span class="badge" data-badge></span></a>
    <a href="pedido.html" class="${pagina === 'pedido' ? 'ativo' : ''}">${icone('relogio')}Acompanhar</a>
  </nav>`;
  document.body.insertAdjacentHTML('afterbegin', header);
  document.body.insertAdjacentHTML('beforeend', tabbar + modalEntregaHTML() + modalUpsellHTML());
  hidratarIcones();
  atualizarBadge();
  cart.onChange(atualizarBadge);
  window.addEventListener('ses:entrega', atualizarSubheader);
  qsa('[data-abrir-entrega]').forEach((b) => b.addEventListener('click', () => abrirModalEntrega()));
  qsa('[data-seg] button').forEach((b) => b.addEventListener('click', () => abrirModalEntrega(b.dataset.tipo)));
  atualizarSubheader();
  config().then(atualizarSubheader).catch(() => {});
}

export function montarFooter() {
  config().then((c) => {
    const lojas = (c.lojas || []).map((l) => `<p><b>${esc(l.nome)}</b> · ${esc(enderecoLoja(l))}</p>`).join('');
    const nomes = (c.lojas || []).map((l) => l.nome);
    const html = `
    <div class="xadrez"></div>
    <footer class="footer">
      <div class="container">
        <div>
          <h4>${esc(c.nome)}</h4>
          <p>${esc(c.slogan || '')} · desde ${c.fundacao || 2022}</p>
          <div style="margin-top:8px">${lojas}</div>
          <p>${esc(resumoHorario(c.horario))}</p>
        </div>
        <div>
          <h4>Pedidos</h4>
          <a href="cardapio.html">Cardápio</a>
          <a href="cardapio.html#combos">Combos</a>
          <a href="pedido.html">Acompanhar pedido</a>
          <a href="carrinho.html">Meu pedido</a>
        </div>
        <div>
          <h4>Fale com a gente</h4>
          <a href="${whatsappLink(c.whatsapp, 'Olá! Vim pelo site da ' + c.nome + '.')}" target="_blank" rel="noopener">WhatsApp ${esc(c.telefone || '')}</a>
          <a href="https://instagram.com/${esc(c.instagram || '')}" target="_blank" rel="noopener">Instagram @${esc(c.instagram || '')}</a>
          <a href="admin/index.html" class="muted small">Área da equipe</a>
        </div>
        <div class="legal">Entregamos em Brasília a partir da loja mais próxima${nomes.length ? ' (' + esc(nomes.join(', ')) + ')' : ''}, conforme a área de entrega e o horário de funcionamento. Cobramos taxa de entrega calculada pela distância. Nossos produtos contêm glúten e podem conter leite, ovos e traços de castanhas. Imagens ilustrativas. Bebidas alcoólicas: venda proibida para menores de 18 anos.</div>
      </div>
    </footer>
    <a class="wa-flutuante" href="${whatsappLink(c.whatsapp, 'Olá! Quero fazer um pedido na ' + c.nome + '.')}" target="_blank" rel="noopener" aria-label="Falar no WhatsApp">${icone('wa')}</a>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }).catch(() => {});
}

function atualizarBadge() {
  const n = cart.quantidadeTotal();
  qsa('[data-badge]').forEach((b) => (b.textContent = n ? n : ''));
}

export function atualizarSubheader() {
  const e = cart.entrega();
  qsa('[data-seg] button').forEach((b) => b.classList.toggle('ativo', !!e && b.dataset.tipo === e.tipo));
  const txt = qs('[data-endereco-txt]');
  if (txt) {
    if (!e) txt.textContent = 'Onde você está?';
    else if (e.tipo === 'retirada') txt.textContent = 'Retirar na loja ' + (e.loja_nome || lojaPorSlug(CFG, e.loja)?.nome || '');
    else txt.textContent = `${e.endereco.rua}, ${e.endereco.numero}`;
  }
  const st = qs('[data-status-loja]');
  if (st && CFG) {
    st.classList.toggle('aberta', !!CFG.aberta);
    st.classList.toggle('fechada', !CFG.aberta);
    st.querySelector('span').textContent = CFG.aberta ? 'Aberto agora' : 'Fechado · abre às ' + (CFG.horario?.seg?.[0] || '18:00');
  }
}

// ------------------------------------------------------------------
// Modal genérico
// ------------------------------------------------------------------
export function abrirModal(id) { const m = qs('#' + id); if (m) { m.classList.add('aberto'); document.body.style.overflow = 'hidden'; } }
export function fecharModal(id) { const m = qs('#' + id); if (m) { m.classList.remove('aberto'); document.body.style.overflow = ''; } }
document.addEventListener('click', (ev) => {
  const bg = ev.target.closest('.modal-bg');
  if (ev.target.matches('[data-fechar]') || (bg && ev.target === bg)) { fecharModal(bg.id); }
});

// ------------------------------------------------------------------
// Modal entrega / retirada
// ------------------------------------------------------------------
function modalEntregaHTML() {
  return `
  <div class="modal-bg" id="modal-entrega" role="dialog" aria-modal="true">
    <div class="modal">
      <button class="fechar" data-fechar aria-label="Fechar">×</button>
      <h2>Como você quer receber?</h2>
      <p class="muted small">Precisamos disso para calcular a taxa e o tempo do seu pedido.</p>
      <div class="escolha-entrega">
        <button type="button" data-tipo="entrega"><div class="ic">${icone('moto')}</div><b>Entrega</b><small>Receba em casa</small></button>
        <button type="button" data-tipo="retirada"><div class="ic">${icone('loja')}</div><b>Retirar na loja</b><small>Peça antes e só passe para buscar</small></button>
      </div>
      <form id="form-entrega" novalidate>
        <div class="linha-campos">
          <div class="campo"><label>CEP</label><input name="cep" inputmode="numeric" placeholder="00000-000" autocomplete="postal-code"></div>
          <div class="campo"><label>Número *</label><input name="numero" placeholder="Ex.: 12" autocomplete="off"></div>
        </div>
        <div class="campo"><label>Rua / Quadra *</label><input name="rua" placeholder="Rua, quadra, chácara…" autocomplete="street-address"></div>
        <div class="linha-campos">
          <div class="campo"><label>Complemento</label><input name="complemento" placeholder="Apto, bloco, casa…"></div>
          <div class="campo"><label>Bairro *</label><input name="bairro" placeholder="Bairro"></div>
        </div>
        <div class="linha-campos">
          <div class="campo"><label>Cidade *</label><input name="cidade" value="Brasília"></div>
          <div class="campo"><label>UF</label><input name="uf" value="DF" maxlength="2"></div>
        </div>
        <div class="campo"><label>Ponto de referência</label><input name="referencia" placeholder="Ex.: portão verde, ao lado da padaria"></div>
        <div class="aviso erro" data-erro hidden></div>
        <div class="resumo-entrega" data-resumo hidden></div>
        <div class="acoes"><button class="btn btn-lg" type="submit" data-salvar>Calcular taxa e salvar</button></div>
      </form>
      <div id="bloco-retirada" hidden>
        <p class="small muted" style="margin-bottom:8px">Escolha a loja onde vai buscar:</p>
        <div class="lojas-retirada" data-lojas-retirada></div>
        <div class="resumo-entrega" data-resumo-retirada></div>
        <div class="acoes"><button class="btn btn-lg" type="button" data-salvar-retirada>Vou retirar na loja</button></div>
      </div>
    </div>
  </div>`;
}

let tipoModal = 'entrega';
let lojaRetirada = null;
// distância aproximada em km (só para sugerir a loja de retirada)
function dist(l, e) { const r = Math.PI / 180, x = (e.lng - l.lng) * r * Math.cos(((e.lat + l.lat) / 2) * r), y = (e.lat - l.lat) * r; return Math.hypot(x, y) * 6371; }
export function abrirModalEntrega(tipo) {
  const m = qs('#modal-entrega');
  const atual = cart.entrega();
  tipoModal = tipo || atual?.tipo || 'entrega';
  qsa('.escolha-entrega button', m).forEach((b) => {
    b.classList.toggle('ativo', b.dataset.tipo === tipoModal);
    b.onclick = () => { tipoModal = b.dataset.tipo; abrirModalEntrega(tipoModal); };
  });
  const form = qs('#form-entrega', m); const ret = qs('#bloco-retirada', m);
  form.hidden = tipoModal !== 'entrega'; ret.hidden = tipoModal !== 'retirada';
  qs('[data-erro]', form).hidden = true; qs('[data-resumo]', form).hidden = true;
  if (atual?.tipo === 'entrega' && atual.endereco) {
    for (const [k, v] of Object.entries(atual.endereco)) if (form.elements[k]) form.elements[k].value = v ?? '';
  }
  config().then((c) => {
    // loja sugerida: a já escolhida, senão a mais perto do endereço salvo, senão a principal
    const lojas = (c.lojas || []).filter((l) => l.aceita_retirada);
    let escolhida = atual?.tipo === 'retirada' ? atual.loja : null;
    if (!escolhida && atual?.endereco?.lat) escolhida = [...lojas].sort((a, b) => dist(a, atual.endereco) - dist(b, atual.endereco))[0]?.slug;
    lojaRetirada = lojaPorSlug({ lojas }, escolhida)?.slug;
    const lista = qs('[data-lojas-retirada]', ret);
    const pintar = () => {
      lista.innerHTML = lojas.map((l) => `<button type="button" class="opcao ${l.slug === lojaRetirada ? 'ativo' : ''}" data-loja="${esc(l.slug)}"><b>${icone('loja')} ${esc(l.nome)}</b><small>${esc(enderecoLoja(l))}</small></button>`).join('');
      qsa('[data-loja]', lista).forEach((b) => b.addEventListener('click', () => { lojaRetirada = b.dataset.loja; pintar(); }));
    };
    pintar();
    qs('[data-resumo-retirada]', ret).innerHTML = `<span class="muted">${esc(resumoHorario(c.horario))}</span><br>Fica pronto em <b>${c.tempo_retirada_min}–${c.tempo_retirada_max} min</b> · sem taxa`;
    qsa('.escolha-entrega button', m)[0].disabled = c.aceita_entrega === false;
    qsa('.escolha-entrega button', m)[1].disabled = c.aceita_retirada === false;
  });
  abrirModal('modal-entrega');
}

function ligarFormEntrega() {
  const m = qs('#modal-entrega'); if (!m || m._ligado) return; m._ligado = true;
  const form = qs('#form-entrega', m);
  const cep = form.elements.cep;
  cep.addEventListener('input', async () => {
    cep.value = mascaraCep(cep.value);
    if (cep.value.length === 9) {
      const d = await buscarCep(cep.value);
      if (d) { if (d.rua) form.elements.rua.value = d.rua; if (d.bairro) form.elements.bairro.value = d.bairro; form.elements.cidade.value = d.cidade; form.elements.uf.value = d.uf; form.elements.numero.focus(); }
    }
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const erro = qs('[data-erro]', form); const resumo = qs('[data-resumo]', form); const btn = qs('[data-salvar]', form);
    erro.hidden = true; resumo.hidden = true;
    const end = Object.fromEntries(['cep', 'rua', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'referencia'].map((k) => [k, form.elements[k].value.trim()]));
    if (!end.rua || !end.numero || !end.bairro || !end.cidade) { erro.textContent = 'Preencha rua, número, bairro e cidade.'; erro.hidden = false; return; }
    btn.disabled = true; btn.textContent = 'Calculando…';
    try {
      const geo = await geocodificar(end);
      let calc;
      if (geo) { end.lat = geo.lat; end.lng = geo.lng; end.aprox = !!geo.aprox; calc = await calcularEntrega(geo.lat, geo.lng); if (geo.aprox) calc.a_confirmar = true; }
      else { calc = await calcularEntrega(null, null); }
      if (!calc.ok && calc.motivo === 'sem_loja') { erro.textContent = 'No momento nenhuma loja está fazendo entregas. Você pode retirar na loja ou falar com a gente pelo WhatsApp.'; erro.hidden = false; return; }
      if (!calc.ok) {
        erro.innerHTML = `Esse endereço fica a <b>${calc.distancia_km} km</b> da loja mais próxima, fora da nossa área de entrega (até ${calc.raio_km} km). Você pode <b>retirar na loja</b> ou falar com a gente pelo WhatsApp.`;
        erro.hidden = false; return;
      }
      const c = await config();
      end.distancia_km = calc.distancia_km;
      cart.salvarEntrega({ tipo: 'entrega', endereco: end, taxa: Number(calc.taxa), a_confirmar: !!calc.a_confirmar, distancia_km: calc.distancia_km, loja: calc.loja?.slug, loja_nome: calc.loja?.nome });
      resumo.innerHTML = `Taxa de entrega: <b>${brl(calc.taxa)}</b>${calc.a_confirmar ? ' <span class="muted">(a confirmar pela pizzaria)</span>' : ` · ${calc.distancia_km} km`}${calc.loja ? `<br>Sai da loja <b>${esc(calc.loja.nome)}</b>` : ''}<br>Chega em <b>${c.tempo_entrega_min}–${c.tempo_entrega_max} min</b> depois de confirmado.`;
      resumo.hidden = false;
      toast('Endereço salvo!');
      setTimeout(() => fecharModal('modal-entrega'), 900);
    } catch (e) {
      erro.textContent = 'Não conseguimos calcular agora. Tente de novo em instantes.'; erro.hidden = false;
    } finally { btn.disabled = false; btn.textContent = 'Calcular taxa e salvar'; }
  });
  qs('[data-salvar-retirada]', m).addEventListener('click', () => {
    const l = lojaPorSlug(CFG, lojaRetirada);
    cart.salvarEntrega({ tipo: 'retirada', taxa: 0, loja: l?.slug, loja_nome: l?.nome });
    toast(l ? `Retirada na loja ${l.nome}` : 'Retirada na loja selecionada');
    fecharModal('modal-entrega');
  });
}
document.addEventListener('DOMContentLoaded', ligarFormEntrega);
setTimeout(ligarFormEntrega, 0);

// ------------------------------------------------------------------
// Upsell ("Quer completar?")
// ------------------------------------------------------------------
function modalUpsellHTML() {
  return `
  <div class="modal-bg" id="modal-upsell" role="dialog" aria-modal="true">
    <div class="modal">
      <button class="fechar" data-fechar aria-label="Fechar">×</button>
      <h2>Adicionado! Quer completar?</h2>
      <p class="muted small">Uma bebida gelada ou um docinho pra fechar.</p>
      <div class="upsell-lista" data-upsell></div>
      <div class="acoes">
        <a class="btn btn-outline" href="cardapio.html">Continuar pedindo</a>
        <a class="btn" href="carrinho.html">Ver meu pedido</a>
      </div>
    </div>
  </div>`;
}

export async function abrirUpsell(excluirSlug) {
  const d = await carregarCardapio();
  const bebidas = d.produtos.filter((p) => p.categoria === 'bebidas' && p.disponivel && p.slug !== excluirSlug).slice(0, 4);
  const molhos = d.produtos.filter((p) => p.categoria === 'molhos' && p.disponivel && p.slug !== excluirSlug);
  const doces = d.sabores.filter((s) => s.tipo === 'doce' && s.disponivel).slice(0, 2);
  const lista = qs('[data-upsell]');
  lista.innerHTML = [...molhos, ...bebidas].map((p) => `
    <div class="upsell-item">
      ${p.imagem_url ? `<img src="${esc(p.imagem_url)}" alt="">` : `<div class="ph">${icone('bebida')}</div>`}
      <b>${esc(p.nome)}</b><span class="p">${brl(p.preco)}</span>
      <button class="btn btn-sm" data-add="${esc(p.slug)}">Adicionar</button>
    </div>`).join('') + doces.map((s) => `
    <div class="upsell-item">
      ${s.imagem_url ? `<img src="${esc(s.imagem_url)}" alt="">` : `<div class="ph">${icone('doce')}</div>`}
      <b>${esc(s.nome.split(' (')[0])} (doce)</b><span class="p">a partir de ${brl(s.precoMin)}</span>
      <a class="btn btn-sm btn-outline" href="produto.html?sabor=${esc(s.slug)}">Escolher</a>
    </div>`).join('');
  qsa('[data-add]', lista).forEach((b) => b.addEventListener('click', () => {
    const p = d.produtosPorSlug[b.dataset.add];
    cart.adicionar({ tipo: 'produto', slug: p.slug, nome: p.nome, imagem: p.imagem_url, preco: Number(p.preco), quantidade: 1 });
    b.innerHTML = `${icone('check')} Adicionado`; b.disabled = true;
    toast(`${p.nome} adicionado`);
  }));
  abrirModal('modal-upsell');
}

// garante que há entrega escolhida antes de seguir; retorna true se ok
export function exigirEntrega() {
  if (cart.entrega()) return true;
  abrirModalEntrega();
  return false;
}

export function tagHTML(t) {
  const nomes = { 'mais-pedida': 'Mais pedida', novidade: 'Novidade', vegetariana: 'Vegetariana', vegana: 'Vegana', esgotado: 'Esgotado' };
  return `<span class="tag ${esc(t)}">${nomes[t] || esc(t)}</span>`;
}
