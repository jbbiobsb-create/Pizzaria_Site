// Página /offline (servida pelo service worker quando a rede cai): recarrega ao voltar a conexão
// e mostra o telefone da loja a partir do cardápio guardado no localStorage (funciona sem rede).
import { qs, lerLS, telefoneDiscavel } from '../util.js';
import { LS } from '../config.js';

const cfg = lerLS(LS.cardapio)?.dados?.config || {};
const tel = telefoneDiscavel(cfg.telefone, cfg.whatsapp);   // sempre com o DDI 55
const ligar = qs('[data-ligar]');
if (tel && ligar) { ligar.href = 'tel:+' + tel; ligar.hidden = false; }

// destino: a página que o cliente tentou abrir (o SW serve /offline no lugar dela, então a URL é a original)
const voltar = () => location.reload();
qs('[data-tentar]').addEventListener('click', voltar);
window.addEventListener('online', () => {
  const st = qs('[data-status]');
  if (st) st.innerHTML = '<i class="dot aberta"></i> Conexão de volta! Recarregando…';
  setTimeout(voltar, 600);
});
