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
  // PWA (js/pwa.js)
  visitas: 'ses_visitas',                 // contagem de visitas (banner de instalação só a partir da 2ª)
  instalarDispensado: 'ses_instalar_dispensado', // timestamp de quando o banner foi dispensado (14 dias)
  pushPedidos: 'ses_push_pedidos',        // ids dos pedidos com aviso por push ligado
};

// Chave pública VAPID (Web Push). A privada fica só no servidor (Vault do Supabase).
export const VAPID_PUBLIC_KEY = 'BE6sdw2OmPqtmTH6qDrN4I2sDlS_eBzP9sFcenvbI8C0kHVFGo21-91w_xNAkWbHUMcxrkZGZZxOUCYAGgaNDBM';
