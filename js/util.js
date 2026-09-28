// Funções pequenas usadas em todas as páginas

export const brl = (v) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const soDigitos = (s) => String(s || '').replace(/\D/g, '');

export function mascaraTelefone(v) {
  const d = soDigitos(v).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function mascaraCep(v) {
  const d = soDigitos(v).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const qs = (sel, el = document) => el.querySelector(sel);
export const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

export function param(nome) {
  return new URLSearchParams(location.search).get(nome);
}

export function lerLS(chave, padrao = null) {
  try { const v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch { return padrao; }
}
export function gravarLS(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch {}
}

export const DIAS = { dom: 'Domingo', seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado' };
export const DIAS_ORDEM = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

// "18:00 às 23:30, todos os dias" ou lista por dia
export function resumoHorario(horario) {
  if (!horario) return '';
  const vals = DIAS_ORDEM.map((d) => (horario[d] ? horario[d].join('–') : 'fechado'));
  if (vals.every((v) => v === vals[0]) && vals[0] !== 'fechado') return `Todos os dias, das ${horario.seg[0]} às ${horario.seg[1]}`;
  return DIAS_ORDEM.map((d) => `${DIAS[d].slice(0, 3)}: ${horario[d] ? horario[d].join('–') : 'fechado'}`).join(' · ');
}

export function dataHoraBR(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function horaBR(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export const STATUS = {
  recebido:        { rotulo: 'Pedido recebido',        msg: 'Recebemos seu pedido e já vamos confirmar.', icone: 'entrada' },
  confirmado:      { rotulo: 'Pedido confirmado',      msg: 'A pizzaria confirmou seu pedido.', icone: 'check-circulo' },
  preparando:      { rotulo: 'Em preparo',             msg: 'Estamos abrindo a massa e montando sua pizza.', icone: 'chef' },
  no_forno:        { rotulo: 'No forno',               msg: 'Sua pizza está no forno a lenha!', icone: 'fogo' },
  saiu_entrega:    { rotulo: 'Saiu para entrega',      msg: 'Seu pedido está a caminho.', icone: 'moto' },
  pronto_retirada: { rotulo: 'Pronto para retirada',   msg: 'Pode vir buscar! Está quentinha.', icone: 'pizza' },
  entregue:        { rotulo: 'Concluído',              msg: 'Bom apetite! Obrigado por pedir na Sesconetto\'s.', icone: 'brilho' },
  cancelado:       { rotulo: 'Cancelado',              msg: 'Este pedido foi cancelado. Fale com a gente pelo WhatsApp se tiver dúvida.', icone: 'x-circulo' },
};
export const FLUXO_ENTREGA = ['recebido', 'confirmado', 'preparando', 'no_forno', 'saiu_entrega', 'entregue'];
export const FLUXO_RETIRADA = ['recebido', 'confirmado', 'preparando', 'no_forno', 'pronto_retirada', 'entregue'];

export const PAGAMENTOS = {
  pix: { rotulo: 'Pix', desc: 'Você recebe a chave após confirmar o pedido', icone: 'pix' },
  cartao_entrega: { rotulo: 'Cartão na entrega / retirada', desc: 'Débito ou crédito na maquininha', icone: 'cartao' },
  dinheiro: { rotulo: 'Dinheiro', desc: 'Informe se precisa de troco', icone: 'dinheiro' },
};

export function whatsappLink(numero, msg) {
  return `https://wa.me/${soDigitos(numero)}?text=${encodeURIComponent(msg)}`;
}

export function toast(msg, tipo = 'ok', ms = 3200) {
  let el = qs('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = `toast toast-${tipo} show`;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

export function debounce(fn, ms = 300) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
