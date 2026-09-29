// Clube Sesconetto's (fidelidade / cashback) — regras, textos e sheets compartilhados
// entre home, checkout, página do pedido e "Minha conta".
//
// Regras (parâmetros vêm de config.fidelidade, via cardapio()):
//   níveis por nº de pedidos entregues nos últimos 90 dias (Bronze 5 % · Prata 7 % · Ouro 10 %);
//   base do cashback = subtotal − cupom − cashback usado (taxa de entrega fora), truncado no centavo;
//   crédito quando o pedido é entregue; validade `validade_dias`; mínimo `min_resgate` para usar;
//   máximo `max_pct_pedido` % do valor dos produtos por pedido; cumulativo com cupom.
// O servidor recalcula tudo — aqui é só prévia e apresentação.
import { criarSheet, abrirModal, fecharModal } from './ui.js';
import { fidelidadeTrocarPin } from './api.js';
import { brl, esc, qs, lerLS, gravarLS, soDigitos, whatsappLink, toast, mascaraTelefone } from './util.js';
import { LS } from './config.js';
import { icone } from './icons.js';

export const NOME_CLUBE = "Clube Sesconetto's";

// visual de cada nível (cor do selo)
export const NIVEIS_UI = {
  Bronze: { classe: 'bronze', icone: 'medalha' },
  Prata: { classe: 'prata', icone: 'medalha' },
  Ouro: { classe: 'ouro', icone: 'medalha' },
};

// ---------- parâmetros ----------
export function cfgFidelidade(c) { return c?.fidelidade || null; }
export function programaAtivo(c) { return !!cfgFidelidade(c)?.ativo; }
export function niveis(cfg) {
  return [...(cfg?.niveis || [])].sort((a, b) => Number(a.min_pedidos_90d || 0) - Number(b.min_pedidos_90d || 0));
}
export function nivelBase(cfg) { return niveis(cfg)[0] || { nome: 'Bronze', pct: 5, min_pedidos_90d: 0 }; }
export function nivelTopo(cfg) { const n = niveis(cfg); return n[n.length - 1] || nivelBase(cfg); }
export function nivelPorNome(cfg, nome) { return niveis(cfg).find((n) => n.nome === nome) || null; }
export function validadeDias(cfg) { return Number(cfg?.validade_dias || 90); }
export function minResgate(cfg) { return Number(cfg?.min_resgate || 0); }
export function maxPctPedido(cfg) { return Number(cfg?.max_pct_pedido || 0); }

// ---------- cálculos ----------
// trunca no centavo (a favor da casa, igual ao servidor)
export function truncar2(v) { return Math.floor(Math.round(Number(v || 0) * 1000) / 10) / 100; }

// cashback previsto para uma base (subtotal − cupom − cashback usado) e um % de nível
export function calcularPrevisto(cfg, nivelPct, base) {
  const pct = Number(nivelPct ?? nivelBase(cfg).pct ?? 0);
  return truncar2(Math.max(Number(base || 0), 0) * pct / 100);
}

// quanto do saldo dá para usar num pedido: min(saldo, max_pct % dos produtos), só se saldo ≥ mínimo
export function calcularUso(cfg, saldo, baseProdutos) {
  const s = Number(saldo || 0); const min = minResgate(cfg);
  const teto = truncar2(Math.max(Number(baseProdutos || 0), 0) * maxPctPedido(cfg) / 100);   // trunca no centavo, como o servidor (53,99 e não 54,00)
  if (s < min || s <= 0) return { valor: 0, teto, abaixoMinimo: s < min, faltam: Math.max(min - s, 0) };
  return { valor: Math.max(Math.min(s, teto), 0), teto, abaixoMinimo: false, faltam: 0 };
}

// ---------- textos ----------
export function textoNivel(nome, pct) { return `${nome || 'Bronze'} · ${Number(pct || 0)}% de cashback`; }
// "Faltam 2 pedidos para Prata (7%)" · null quando já está no topo
export function textoProximo(proximo) {
  if (!proximo?.nome) return null;
  const n = Number(proximo.faltam || 0);
  if (n <= 0) return `Próximo nível: ${proximo.nome} (${proximo.pct}%)`;
  return `${n === 1 ? 'Falta 1 pedido' : `Faltam ${n} pedidos`} para ${proximo.nome} (${proximo.pct}%)`;
}
// selo do nível: <span class="nivel-chip ouro">★ Ouro · 10%</span>
export function seloNivel(nome, pct, cls = '') {
  const ui = NIVEIS_UI[nome] || NIVEIS_UI.Bronze;
  return `<span class="nivel-chip ${ui.classe}${cls ? ' ' + cls : ''}">${icone(ui.icone)}${esc(nome || 'Bronze')}${pct != null ? ` · ${esc(Number(pct))}%` : ''}</span>`;
}
// "(61) •••••-1234"
export function telefoneMascarado(tel) {
  const d = soDigitos(tel);
  if (d.length < 10) return mascaraTelefone(d);
  return `(${d.slice(0, 2)}) ${'•'.repeat(d.length - 6)}-${d.slice(-4)}`;
}
export function dataCurta(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
export function diasAte(iso) {
  if (!iso) return null;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000));
}
// "R$ 4,80 vencem em 12 dias (19/12)"
export function textoVencimento(v) {
  if (!v?.em || !(Number(v.valor) > 0)) return null;
  const d = diasAte(v.em);
  const quando = d === 0 ? 'vencem hoje' : d === 1 ? 'vencem amanhã' : `vencem em ${d} dias`;
  return { texto: `${brl(v.valor)} ${quando} (${dataCurta(v.em)})`, urgente: d <= 3 };
}

// PIN: 4 dígitos, sem repetição (0000…9999) nem sequência óbvia — MESMA lista de fidelidade_pin_valido (SQL, migração 0009)
export const PINS_PROIBIDOS = ['1234', '4321', '0123', '3210', '2580', '0852', '1212', '6969'];
export function pinValido(pin) {
  const p = String(pin || '');
  return /^\d{4}$/.test(p) && !/^(\d)\1{3}$/.test(p) && !PINS_PROIBIDOS.includes(p);
}
// campo de PIN: só dígitos, 4 no máximo
export function ligarCampoPin(input) {
  if (!input) return;
  input.addEventListener('input', () => { input.value = soDigitos(input.value).slice(0, 4); });
}

// ---------- sessão (só o celular; o PIN é digitado a cada consulta) ----------
export function telefoneSalvo() { return lerLS(LS.fidelidadeTel) || ''; }
export function salvarTelefone(tel) { const d = soDigitos(tel); if (d.length >= 10) gravarLS(LS.fidelidadeTel, d); }
export function esquecerTelefone() { try { localStorage.removeItem(LS.fidelidadeTel); } catch {} }

// ---------- sheets ----------
// Regulamento resumido (texto do estudo, com os parâmetros da config)
export function abrirRegulamento(cfg) {
  const ns = niveis(cfg);
  const b = nivelBase(cfg); const outros = ns.slice(1);
  const niveisTxt = outros.length
    ? `${b.pct}% (${esc(b.nome)})${outros.map((n) => ` ou ${n.pct}% (${esc(n.nome)}, a partir de ${n.min_pedidos_90d} pedidos em 90 dias)`).join('')}`
    : `${b.pct}%`;
  const el = criarSheet('sheet-regulamento', {
    titulo: 'Como funciona o Clube',
    sub: 'Pediu, ganhou. Parte do que você paga volta para a próxima pizza.',
    corpo: `
      <div class="niveis-grade">${ns.map((n) => `<div class="nivel-box ${(NIVEIS_UI[n.nome] || NIVEIS_UI.Bronze).classe}">${icone('medalha')}<b>${esc(n.nome)}</b><span>${esc(n.pct)}%</span><small>${Number(n.min_pedidos_90d) > 0 ? `${n.min_pedidos_90d}+ pedidos em 90 dias` : 'a partir do 1º pedido'}</small></div>`).join('')}</div>
      <ol class="regulamento">
        <li>A cada pedido feito no site, concluído (entregue ou retirado) e pago, você recebe cashback: ${niveisTxt}, calculado sobre o valor dos produtos efetivamente pago (sem taxa de entrega, sem a parte paga com cashback ou cupom).</li>
        <li>O cashback é creditado no celular informado no pedido e fica disponível assim que o pedido é concluído. Pedidos cancelados ou estornados não geram cashback; se já tiver sido creditado, o valor é retirado do saldo.</li>
        <li>Cada crédito vale <b>${validadeDias(cfg)} dias</b>. Avisamos no site antes de vencer. Créditos vencidos não são repostos.</li>
        <li>Para usar é preciso ter pelo menos <b>${brl(minResgate(cfg))}</b> de saldo. Você pode pagar até <b>${maxPctPedido(cfg)}%</b> do valor dos produtos com cashback; a taxa de entrega é paga normalmente. Pode combinar com cupom.</li>
        <li>O cashback é pessoal, ligado ao seu celular, protegido por PIN, intransferível e não pode ser convertido em dinheiro. Guarde seu PIN; se esquecer, fale com a gente pelo WhatsApp.</li>
        <li>Pedidos de teste, da equipe ou com indícios de fraude não participam. Podemos suspender saldos obtidos de forma irregular.</li>
        <li>Podemos alterar estas regras com aviso prévio de 30 dias no site; créditos já concedidos mantêm as regras da data do crédito.</li>
        <li>Seus dados (nome, celular, pedidos) são usados para operar o programa, conforme a LGPD. Para excluir sua participação, fale conosco pelo WhatsApp.</li>
      </ol>`,
    rodape: `<div class="acoes"><button type="button" class="btn btn-lg" data-fechar>Entendi</button></div>`,
  });
  abrirModal(el.id);
}

// "Esqueci meu PIN": a equipe reseta pelo WhatsApp (o cliente cria um novo pelo link do último pedido)
export function abrirEsqueciPin(cfg, whatsapp, telefone) {
  const tel = soDigitos(telefone);
  const msg = `Olá! Esqueci o PIN do ${NOME_CLUBE}. Meu celular é ${tel ? mascaraTelefone(tel) : '(informe aqui)'}. Podem resetar, por favor?`;
  const el = criarSheet('sheet-esqueci-pin', {
    titulo: 'Esqueci meu PIN',
    sub: 'Sem problema: a equipe zera o PIN e você cria outro.',
    corpo: `
      <ol class="passos-ios" style="margin-top:12px">
        <li><span class="n">1</span><div>Chame a gente no WhatsApp com o celular usado nos pedidos. Vamos conferir alguns dados (últimos pedidos, endereço).</div></li>
        <li><span class="n">2</span><div>A equipe apaga o PIN antigo. Seu saldo continua guardado.</div></li>
        <li><span class="n">3</span><div>Abra o link do seu último pedido (página "Acompanhar pedido") e crie um PIN novo.</div></li>
      </ol>`,
    rodape: `<div class="acoes"><a class="btn btn-lg btn-wa" data-wa-esqueci href="#" target="_blank" rel="noopener">${icone('wa')} Falar no WhatsApp</a></div>`,
  });
  const a = qs('[data-wa-esqueci]', el);
  a.href = whatsapp ? whatsappLink(whatsapp, msg) : '#';
  abrirModal(el.id);
}

// "Trocar PIN" (Minha conta). onOk é chamado quando a troca dá certo.
export function abrirTrocarPin(telefone, onOk) {
  const el = criarSheet('sheet-trocar-pin', {
    titulo: 'Trocar PIN',
    sub: 'Escolha 4 dígitos que só você saiba. Evite 1234 ou o fim do seu celular.',
    corpo: `
      <form data-form-trocar novalidate style="margin-top:8px">
        <div class="campo"><label for="tp-atual">PIN atual</label><input id="tp-atual" name="atual" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" placeholder="••••"></div>
        <div class="linha-campos">
          <div class="campo"><label for="tp-novo">Novo PIN</label><input id="tp-novo" name="novo" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••"></div>
          <div class="campo"><label for="tp-conf">Repita o novo</label><input id="tp-conf" name="conf" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="new-password" placeholder="••••"></div>
        </div>
        <div class="aviso erro" data-erro hidden></div>
        <button type="submit" class="sr" tabindex="-1" aria-hidden="true"></button>
      </form>`,
    rodape: `<div class="acoes"><button type="submit" form="form-trocar-pin" class="btn btn-lg" data-salvar-pin>Salvar novo PIN</button></div>`,
  });
  const form = qs('[data-form-trocar]', el); form.id = 'form-trocar-pin';
  const erro = qs('[data-erro]', form); const btn = qs('[data-salvar-pin]', el);
  form.reset(); erro.hidden = true;
  if (!form._ligado) {
    form._ligado = true;
    ['atual', 'novo', 'conf'].forEach((k) => ligarCampoPin(form.elements[k]));
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = form.elements; erro.hidden = true;
      if (!/^\d{4}$/.test(f.atual.value)) { erro.textContent = 'Digite o PIN atual (4 dígitos).'; erro.hidden = false; return; }
      if (!pinValido(f.novo.value)) { erro.textContent = 'Escolha um PIN de 4 dígitos que não seja sequência nem repetição.'; erro.hidden = false; return; }
      if (f.novo.value !== f.conf.value) { erro.textContent = 'Os dois PINs novos não conferem.'; erro.hidden = false; return; }
      btn.disabled = true; btn.textContent = 'Salvando…';
      try {
        const r = await fidelidadeTrocarPin(form.dataset.tel, f.atual.value, f.novo.value);
        if (!r.ok) { erro.textContent = r.motivo || 'Não foi possível trocar o PIN.'; erro.hidden = false; return; }
        toast('PIN trocado!'); fecharModal(el.id); form.reset();
        if (typeof form._onOk === 'function') form._onOk();
      } catch (e) { erro.textContent = e.message || 'Não foi possível trocar o PIN agora.'; erro.hidden = false; }
      finally { btn.disabled = false; btn.textContent = 'Salvar novo PIN'; }
    });
  }
  form.dataset.tel = soDigitos(telefone); form._onOk = onOk;
  abrirModal(el.id);
  setTimeout(() => form.elements.atual.focus({ preventScroll: true }), 250);
}
