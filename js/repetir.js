// "Pedir de novo": reconstrói a sacola a partir de um pedido anterior, revalidando cada item
// contra o cardápio atual (tamanho, sabores, produto, escolhas, disponibilidade e preço de hoje).
// Aceita tanto os itens salvos em LS.ultimoPedido (formato da sacola) quanto os devolvidos
// pela RPC consultar_pedido (itens com `detalhes`).
import * as cart from './cart.js';
import { carregarCardapio, consultarPedido } from './api.js';
import { brl, lerLS, gravarLS } from './util.js';
import { LS } from './config.js';

// normaliza um item para {tipo, tamanho, sabores[], slug, escolhas[], quantidade, observacao, nome}
function normalizarItem(i) {
  const d = i.detalhes || {};
  const slugs = (arr) => (arr || []).map((x) => (typeof x === 'string' ? x : x?.slug)).filter(Boolean);
  if (i.tipo === 'pizza') return { tipo: 'pizza', tamanho: i.tamanho || d.tamanho, sabores: slugs(i.sabores || d.sabores), quantidade: i.quantidade || 1, observacao: i.observacao || d.observacao || null, nome: i.nome };
  return { tipo: 'produto', slug: i.slug || d.slug, escolhas: slugs(i.escolhas || d.escolhas), quantidade: i.quantidade || 1, observacao: i.observacao || d.observacao || null, nome: i.nome };
}

// último pedido salvo neste aparelho ({id, numero, em, total?, itens?})
export function ultimoPedidoLocal() { return lerLS(LS.ultimoPedido); }

// garante que o último pedido tem itens (busca na RPC se o LS antigo não tinha)
export async function itensDoUltimoPedido() {
  const u = ultimoPedidoLocal(); if (!u) return null;
  if (Array.isArray(u.itens) && u.itens.length) return u;
  if (!u.id) return null;
  try {
    const p = await consultarPedido(u.id);
    if (!p?.itens?.length) return null;
    const atualizado = { ...u, itens: p.itens, total: p.total, resumo: resumoItens(p.itens) };
    gravarLS(LS.ultimoPedido, atualizado);
    return atualizado;
  } catch { return null; }
}

// "1× Pizza Grande Napolitana · 2× Coca-Cola" (curto, para o card)
export function resumoItens(itens) {
  return (itens || []).map((i) => `${i.quantidade}× ${i.nome}${i.descricao ? ' ' + i.descricao : ''}`).join(' · ');
}

// adiciona os itens à sacola. Retorna {adicionados, ignorados:[nomes], alterados:[nomes]}
export async function repetirItens(itens) {
  const D = await carregarCardapio();
  const r = { adicionados: 0, ignorados: [], alterados: [] };
  for (const bruto of itens || []) {
    const it = normalizarItem(bruto);
    if (it.tipo === 'pizza') {
      const t = D.tamanhosPorSlug[it.tamanho];
      const sabores = it.sabores.map((s) => D.saboresPorSlug[s]).filter(Boolean);
      const ok = t && sabores.length && sabores.length === it.sabores.length && sabores.every((s) => s.disponivel && s.precos[t.slug]);
      if (!ok) { r.ignorados.push(it.nome || 'Pizza'); continue; }
      const preco = Math.max(...sabores.map((s) => Number(s.precos[t.slug])));
      const nomes = sabores.map((s) => s.nome);
      cart.adicionar({
        tipo: 'pizza', tamanho: t.slug, sabores: sabores.map((s) => s.slug),
        nome: t.grupo === 'calzone' ? `Calzone ${t.nome}` : `Pizza ${t.nome} (${t.fatias} fatias)`,
        descricao: nomes.length > 1 ? `Meio a meio: ${nomes.join(' / ')}` : nomes[0],
        imagem: sabores[0].imagem_url || null, preco, quantidade: it.quantidade, observacao: it.observacao,
      });
      r.adicionados += it.quantidade;
    } else {
      const p = D.produtosPorSlug[it.slug];
      if (!p || !p.disponivel) { r.ignorados.push(it.nome || it.slug || 'Produto'); continue; }
      const escolhas = it.escolhas.filter((s) => D.produtosPorSlug[s]?.disponivel);
      const passos = Array.isArray(p.passos) ? p.passos : [];
      // combo: cada passo obrigatório precisa continuar atendido
      if (passos.some((ps) => (ps.min || 0) > 0 && !escolhas.some((s) => (ps.opcoes || []).includes(s)))) { r.ignorados.push(p.nome); continue; }
      if (escolhas.length !== it.escolhas.length) r.alterados.push(p.nome);
      cart.adicionar({
        tipo: 'produto', slug: p.slug, escolhas, nome: p.nome,
        descricao: escolhas.map((s) => D.produtosPorSlug[s]?.nome).filter(Boolean).join(', ') || null,
        imagem: p.imagem_url, preco: Number(p.preco), quantidade: it.quantidade, observacao: it.observacao,
      });
      r.adicionados += it.quantidade;
    }
  }
  return r;
}

// mensagem curta para o toast depois de repetir
export function mensagemRepetir(r) {
  if (!r.adicionados) return { msg: 'Nenhum item desse pedido está disponível hoje.', tipo: 'erro' };
  if (r.ignorados.length) return { msg: `Adicionado. Fora do cardápio hoje: ${r.ignorados.join(', ')}.`, tipo: 'ok' };
  return { msg: `${r.adicionados} ${r.adicionados === 1 ? 'item adicionado' : 'itens adicionados'} à sacola · ${brl(cart.subtotal())}`, tipo: 'ok' };
}
