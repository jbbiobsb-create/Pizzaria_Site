// Acesso ao Supabase (catálogo, entrega, pedidos)
import { supabase } from './supabase.js';
import { LS } from './config.js';
import { lerLS, gravarLS, soDigitos } from './util.js';

let _cardapio = null;

// Cardápio inteiro em uma chamada. Cache curto na sessão para navegação rápida.
export async function carregarCardapio(forcar = false) {
  if (_cardapio && !forcar) return _cardapio;
  const cache = lerLS(LS.cardapio);
  if (cache && !forcar && Date.now() - cache.em < 2 * 60 * 1000) { _cardapio = cache.dados; return _cardapio; }
  const { data, error } = await supabase.rpc('cardapio');
  if (error) throw error;
  _cardapio = indexar(data);
  gravarLS(LS.cardapio, { em: Date.now(), dados: _cardapio });
  return _cardapio;
}

function indexar(d) {
  d.saboresPorSlug = Object.fromEntries(d.sabores.map((s) => [s.slug, s]));
  d.produtosPorSlug = Object.fromEntries(d.produtos.map((p) => [p.slug, p]));
  d.tamanhosPorSlug = Object.fromEntries(d.tamanhos.map((t) => [t.slug, t]));
  d.categoriasPorSlug = Object.fromEntries(d.categorias.map((c) => [c.slug, c]));
  // menor preço de cada sabor ("a partir de")
  for (const s of d.sabores) {
    const precos = Object.values(s.precos || {}).map(Number);
    s.precoMin = precos.length ? Math.min(...precos) : null;
  }
  return d;
}

export async function statusLoja() {
  const { data, error } = await supabase.rpc('status_loja');
  if (error) throw error;
  return data;
}

export async function calcularEntrega(lat, lng) {
  const { data, error } = await supabase.rpc('calcular_entrega', { p_lat: lat, p_lng: lng });
  if (error) throw error;
  return data;
}

export async function validarCupom(codigo, subtotal) {
  const { data, error } = await supabase.rpc('validar_cupom', { p_codigo: codigo, p_subtotal: subtotal });
  if (error) throw error;
  return data;
}

export async function criarPedido(payload) {
  const { data, error } = await supabase.rpc('criar_pedido', { p: payload });
  if (error) throw new Error(limparErro(error.message));
  return data;
}

export async function consultarPedido(id) {
  const { data, error } = await supabase.rpc('consultar_pedido', { p_id: id });
  if (error) throw error;
  return data;
}

export async function pedidosPorTelefone(telefone) {
  const { data, error } = await supabase.rpc('pedidos_por_telefone', { p_telefone: soDigitos(telefone) });
  if (error) throw error;
  return data || [];
}

function limparErro(m) {
  // mensagens do "raise exception" chegam limpas; outras a gente simplifica
  if (!m) return 'Não foi possível concluir. Tente de novo.';
  return m.replace(/^.*?exception:\s*/i, '');
}

// ---------- serviços externos (CEP e geocodificação) ----------
export async function buscarCep(cep) {
  const d = soDigitos(cep);
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) return null;
    return { cep: d, rua: j.logradouro || '', bairro: j.bairro || '', cidade: j.localidade || '', uf: j.uf || '' };
  } catch { return null; }
}

export async function geocodificar(end) {
  const partes = [end.rua, end.numero, end.bairro, end.cidade, end.uf, 'Brasil'].filter(Boolean).join(', ');
  const tentativas = [partes, [end.rua, end.bairro, end.cidade, end.uf, 'Brasil'].filter(Boolean).join(', ')];
  if (end.cep) tentativas.push(`${soDigitos(end.cep)}, Brasil`);
  // último recurso: centro do bairro (marcado como aproximado)
  const aprox = [end.bairro, end.cidade, end.uf, 'Brasil'].filter(Boolean).join(', ');
  for (const q of [...tentativas, aprox]) {
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`,
        { headers: { 'Accept-Language': 'pt-BR' } });
      const j = await r.json();
      if (j && j[0]) return { lat: Number(j[0].lat), lng: Number(j[0].lon), aprox: q === aprox };
    } catch {}
  }
  return null;
}
