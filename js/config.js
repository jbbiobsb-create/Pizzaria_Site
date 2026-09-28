// Chaves públicas do Supabase (a chave "publishable" é feita para ficar no navegador;
// a segurança fica nas políticas RLS e nas funções do banco).
export const SUPABASE_URL = 'https://jifjovojwmlnsgoqdloh.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_EfQE4zaak4S8FExCC676IA_PUT3OHAQ';

// Chaves do localStorage
export const LS = {
  carrinho: 'ses_carrinho',
  entrega: 'ses_entrega',
  cliente: 'ses_cliente',
  ultimoPedido: 'ses_ultimo_pedido',
  cardapio: 'ses_cardapio_cache',
};
