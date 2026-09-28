// Carrinho no localStorage. Preço é só para exibir: o servidor recalcula tudo ao criar o pedido.
import { LS } from './config.js';
import { lerLS, gravarLS } from './util.js';

const EVT = 'ses:carrinho';

export function itens() { return lerLS(LS.carrinho, []); }

function salvar(lista) {
  gravarLS(LS.carrinho, lista);
  window.dispatchEvent(new CustomEvent(EVT));
}

export function onChange(fn) { window.addEventListener(EVT, fn); window.addEventListener('storage', fn); }

// item: {uid, tipo:'pizza'|'produto', nome, descricao, imagem, preco, quantidade, tamanho?, sabores?[slug], slug?, escolhas?[slug], observacao?}
export function adicionar(item) {
  const lista = itens();
  const chave = assinatura(item);
  const igual = lista.find((i) => assinatura(i) === chave);
  if (igual) { igual.quantidade += item.quantidade || 1; }
  else { lista.push({ ...item, uid: Math.random().toString(36).slice(2, 10), quantidade: item.quantidade || 1 }); }
  salvar(lista);
}

function assinatura(i) {
  return JSON.stringify([i.tipo, i.tamanho, i.sabores, i.slug, i.escolhas, i.observacao || '']);
}

export function alterarQtd(uid, delta) {
  const lista = itens();
  const it = lista.find((i) => i.uid === uid);
  if (!it) return;
  it.quantidade = Math.max(0, Math.min(20, it.quantidade + delta));
  salvar(lista.filter((i) => i.quantidade > 0));
}

export function remover(uid) { salvar(itens().filter((i) => i.uid !== uid)); }
export function limpar() { salvar([]); }

export function quantidadeTotal() { return itens().reduce((n, i) => n + i.quantidade, 0); }
export function subtotal() { return itens().reduce((n, i) => n + i.preco * i.quantidade, 0); }

// formato que a função criar_pedido espera
export function paraPedido() {
  return itens().map((i) => i.tipo === 'pizza'
    ? { tipo: 'pizza', tamanho: i.tamanho, sabores: i.sabores, quantidade: i.quantidade, observacao: i.observacao || null }
    : { tipo: 'produto', slug: i.slug, escolhas: i.escolhas || [], quantidade: i.quantidade, observacao: i.observacao || null });
}

// ---------- entrega / retirada escolhida ----------
export function entrega() { return lerLS(LS.entrega, null); }
export function salvarEntrega(e) { gravarLS(LS.entrega, e); window.dispatchEvent(new CustomEvent('ses:entrega')); }
export function limparEntrega() { localStorage.removeItem(LS.entrega); window.dispatchEvent(new CustomEvent('ses:entrega')); }
