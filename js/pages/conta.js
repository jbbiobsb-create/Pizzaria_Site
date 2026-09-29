// "Minha conta": saldo do Clube Sesconetto's (cashback), nível, histórico e atalhos.
// Sem login: o cliente entra com celular + PIN. Só o celular fica salvo no aparelho (LS.fidelidadeTel);
// o PIN é pedido a cada abertura (o saldo nunca é mostrado sem PIN).
import { montarLayout, montarFooter, config } from '../ui.js';
import { fidelidadeSaldo } from '../api.js';
import { qs, esc, brl, toast, mascaraTelefone, soDigitos, lerLS, dataHoraBR, param } from '../util.js';
import { LS } from '../config.js';
import { icone } from '../icons.js';
import { ultimoPedidoLocal, itensDoUltimoPedido, repetirItens, mensagemRepetir } from '../repetir.js';
import {
  NOME_CLUBE, cfgFidelidade, programaAtivo, nivelBase, nivelTopo, nivelPorNome, validadeDias, minResgate, maxPctPedido,
  seloNivel, textoNivel, textoProximo, textoVencimento, telefoneMascarado, dataCurta, ligarCampoPin,
  telefoneSalvo, salvarTelefone, esquecerTelefone, abrirRegulamento, abrirEsqueciPin, abrirTrocarPin,
} from '../fidelidade.js';

montarLayout({ pagina: 'conta', subheader: false });
montarFooter();

const raiz = qs('[data-raiz]');
let CFG = {}; let FID = null;      // config da loja / parâmetros do programa
let sessao = { tel: '', pin: '', dados: null };   // PIN fica só em memória, nesta aba

(async () => {
  try { CFG = await config(); } catch { CFG = {}; }
  FID = cfgFidelidade(CFG);
  if (!programaAtivo(CFG)) { renderInativo(); return; }
  // celular vindo da página do pedido (?tel=) ou salvo neste aparelho
  const tel = soDigitos(param('tel') || '') || telefoneSalvo() || soDigitos(lerLS(LS.cliente, {}).telefone || '');
  renderEntrar(tel);
})();

// ---------------------------------------------------------------
// Programa desligado: só os atalhos
// ---------------------------------------------------------------
function renderInativo() {
  raiz.innerHTML = `
    <div class="painel">
      <h2>Minha conta</h2>
      <p class="muted small" style="margin-bottom:14px">Seus pedidos e seus dados, sem cadastro.</p>
      <div style="display:grid;gap:10px">
        <a class="btn btn-outline btn-block" href="pedido.html">${icone('relogio')} Acompanhar pedido</a>
        <a class="btn btn-outline btn-block" href="cardapio.html">${icone('pizza')} Ver cardápio</a>
      </div>
    </div>`;
}

// ---------------------------------------------------------------
// Entrada: celular + PIN
// ---------------------------------------------------------------
function renderEntrar(telInicial = '', msgErro = '') {
  const b = nivelBase(FID); const t = nivelTopo(FID);
  const ultimo = ultimoPedidoLocal();
  raiz.innerHTML = `
    <div class="painel">
      <div class="entrar-cab">
        <div class="ic">${icone('presente')}</div>
        <h2>${esc(NOME_CLUBE)}</h2>
        <p class="muted small">Pediu, ganhou. Parte do que você paga volta em cashback para a próxima pizza.</p>
      </div>
      <div class="beneficios">
        <div class="beneficio"><b>${esc(b.pct)} a ${esc(t.pct)}%</b>de cashback por pedido</div>
        <div class="beneficio"><b>${esc(validadeDias(FID))} dias</b>de validade</div>
        <div class="beneficio"><b>Sem app</b>é só pedir pelo site</div>
      </div>
      <form data-form-entrar novalidate style="margin-top:14px">
        <div class="campo"><label for="ct-tel">Celular usado nos pedidos</label><input id="ct-tel" name="telefone" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="(61) 99999-9999" value="${esc(telInicial ? mascaraTelefone(telInicial) : '')}" required></div>
        <div class="campo"><label for="ct-pin">PIN <span class="muted">(4 dígitos)</span></label><input id="ct-pin" name="pin" class="pin" type="password" inputmode="numeric" maxlength="4" autocomplete="one-time-code" placeholder="••••" required></div>
        <div class="aviso erro" data-erro ${msgErro ? '' : 'hidden'}>${esc(msgErro)}</div>
        <div class="aviso" data-sem-pin hidden style="margin-top:10px"></div>
        <button class="btn btn-lg btn-block" type="submit" data-entrar style="margin-top:12px">${icone('cadeado')} Ver meu saldo</button>
      </form>
      <div class="links-conta">
        <button type="button" data-esqueci>Esqueci meu PIN</button>
        <button type="button" data-sem-pin-link>Ainda não tenho PIN</button>
        <button type="button" data-regulamento>Como funciona</button>
      </div>
    </div>
    <div class="painel" style="margin-top:16px">
      <h2 style="font-size:1.1rem">Atalhos</h2>
      <div style="display:grid;gap:10px">
        ${ultimo ? `<a class="btn btn-outline btn-block" href="pedido.html?id=${esc(ultimo.id)}">${icone('relogio')} Acompanhar pedido #${esc(ultimo.numero)}</a>` : `<a class="btn btn-outline btn-block" href="pedido.html">${icone('relogio')} Acompanhar pedido</a>`}
        <a class="btn btn-ghost btn-block" href="cardapio.html">${icone('pizza')} Ver cardápio</a>
      </div>
    </div>`;
  const form = qs('[data-form-entrar]'); const tel = form.elements.telefone; const pin = form.elements.pin;
  const erro = qs('[data-erro]', form); const semPin = qs('[data-sem-pin]', form); const btn = qs('[data-entrar]', form);
  tel.addEventListener('input', () => { tel.value = mascaraTelefone(tel.value); semPin.hidden = true; });
  ligarCampoPin(pin);
  pin.addEventListener('input', () => { erro.hidden = true; });
  // celular já preenchido: foco direto no PIN
  if (telInicial) setTimeout(() => pin.focus({ preventScroll: true }), 150);

  const explicarSemPin = () => {
    const u = ultimoPedidoLocal();
    semPin.innerHTML = `<b>Ainda sem PIN?</b> Seu cashback já acumula sozinho. Para ver e usar o saldo, crie um PIN de 4 dígitos pela página do seu último pedido (o link fica só com você, por segurança).${u ? ` <a href="pedido.html?id=${esc(u.id)}" style="text-decoration:underline;font-weight:600">Abrir pedido #${esc(u.numero)}</a>` : ' Não tem o link? Peça pelo WhatsApp.'}`;
    semPin.hidden = false; semPin.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  qs('[data-sem-pin-link]').addEventListener('click', explicarSemPin);
  qs('[data-esqueci]').addEventListener('click', () => abrirEsqueciPin(FID, CFG.whatsapp, tel.value));
  qs('[data-regulamento]').addEventListener('click', () => abrirRegulamento(FID));

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    erro.hidden = true; semPin.hidden = true;
    const d = soDigitos(tel.value);
    if (d.length < 10) { erro.textContent = 'Informe o celular com DDD.'; erro.hidden = false; tel.focus(); return; }
    if (!/^\d{4}$/.test(pin.value)) { erro.textContent = 'O PIN tem 4 dígitos.'; erro.hidden = false; pin.focus(); return; }
    btn.disabled = true; btn.innerHTML = 'Consultando…';
    try {
      const r = await fidelidadeSaldo(d, pin.value);
      if (!r.ok) {
        // sem PIN cadastrado: explica como criar em vez de contar como erro
        if (r.sem_pin) { pin.value = ''; explicarSemPin(); return; }
        erro.innerHTML = esc(r.motivo || 'PIN incorreto.') + (r.bloqueado ? ` <button type="button" class="link-acao" data-esqueci-inline style="text-decoration:underline;font-weight:600;padding:0 4px">Esqueci meu PIN</button>` : '');
        erro.hidden = false; pin.value = ''; pin.focus();
        qs('[data-esqueci-inline]', erro)?.addEventListener('click', () => abrirEsqueciPin(FID, CFG.whatsapp, d));
        return;
      }
      salvarTelefone(d);
      sessao = { tel: d, pin: pin.value, dados: r };
      renderPainel();
    } catch (e) {
      erro.textContent = e.message || 'Não foi possível consultar agora. Tente de novo.'; erro.hidden = false;
    } finally { btn.disabled = false; btn.innerHTML = `${icone('cadeado')} Ver meu saldo`; }
  });
}

// ---------------------------------------------------------------
// Painel: saldo, nível, histórico
// ---------------------------------------------------------------
const TIPOS_MOV = {
  credito: { icone: 'presente', sinal: 'mais', rotulo: 'Cashback do pedido' },
  debito: { icone: 'sacola', sinal: 'menos', rotulo: 'Usado no pedido' },
  estorno_credito: { icone: 'x-circulo', sinal: 'menos', rotulo: 'Estorno (pedido cancelado)' },
  estorno_debito: { icone: 'repetir', sinal: 'mais', rotulo: 'Devolução (pedido cancelado)' },
  expirado: { icone: 'relogio', sinal: 'neutro', rotulo: 'Cashback vencido' },
  ajuste: { icone: 'lapis', sinal: null, rotulo: 'Ajuste da equipe' },
};

function renderPainel() {
  const r = sessao.dados;
  const saldo = Number(r.saldo || 0);
  const nome = r.nivel || nivelBase(FID).nome; const pct = r.pct ?? nivelPorNome(FID, nome)?.pct ?? nivelBase(FID).pct;
  const prox = r.proximo; const txtProx = textoProximo(prox);
  // barra de progresso: pedidos na janela em relação ao mínimo do próximo nível
  const atual = nivelPorNome(FID, nome); const proxCfg = prox?.nome ? nivelPorNome(FID, prox.nome) : null;
  const ini = Number(atual?.min_pedidos_90d || 0); const fim = proxCfg ? Number(proxCfg.min_pedidos_90d) : ini;
  const n = Number(r.pedidos_90d || 0);
  const pctBarra = proxCfg && fim > ini ? Math.min(100, Math.max(0, ((n - ini) / (fim - ini)) * 100)) : 100;
  const venc = textoVencimento(r.proximo_vencimento);
  const min = minResgate(FID);
  const podeUsar = saldo >= min && saldo > 0;
  const movs = Array.isArray(r.movimentos) ? r.movimentos : [];
  const ultimo = ultimoPedidoLocal();

  raiz.innerHTML = `
    <div class="cb-card" aria-live="polite">
      <div class="topo"><span class="clube">${icone('presente')} ${esc(NOME_CLUBE)}</span>${seloNivel(nome, pct)}</div>
      <div class="saldo">${brl(saldo)}</div>
      <div class="saldo-txt">${podeUsar ? 'para usar no próximo pedido' : saldo > 0 ? `de saldo · a partir de ${brl(min)} você pode usar (faltam ${brl(Math.max(min - saldo, 0))})` : 'de saldo · seu próximo pedido já rende cashback'}</div>
      <div class="tel">${icone('usuario')} ${esc(telefoneMascarado(sessao.tel))}</div>
      ${venc ? `<div class="venc ${venc.urgente ? 'urgente' : ''}">${icone('relogio')} ${esc(venc.texto)}</div>` : ''}
      <div class="progresso ${proxCfg ? '' : 'topo'}">
        <div class="txt"><span>${esc(textoNivel(nome, pct))}</span><span>${txtProx ? esc(txtProx) : 'Nível máximo'}</span></div>
        <div class="barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pctBarra)}" aria-label="Progresso para o próximo nível"><i style="width:${pctBarra}%"></i></div>
        <div class="txt" style="margin-top:6px;margin-bottom:0"><span>${n} ${n === 1 ? 'pedido' : 'pedidos'} nos últimos 90 dias</span></div>
      </div>
    </div>

    <div class="acoes-conta">
      ${ultimo ? `<button type="button" class="btn btn-lg" data-repetir>${icone('repetir')} Pedir de novo</button>` : `<a class="btn btn-lg" href="cardapio.html">${icone('pizza')} Ver cardápio</a>`}
      <a class="btn btn-lg btn-outline" href="${ultimo ? `pedido.html?id=${esc(ultimo.id)}` : 'pedido.html'}">${icone('relogio')} Acompanhar pedido</a>
    </div>

    <div class="painel" style="margin-top:16px">
      <h2 style="font-size:1.1rem">Como usar</h2>
      <ul class="regras-curtas">
        <li>${icone('moeda')}<span><b>No checkout</b>, ligue "Usar meu cashback" e digite seu PIN. Dá para pagar até ${esc(maxPctPedido(FID))}% dos produtos com saldo (mínimo ${brl(min)}).</span></li>
        <li>${icone('presente')}<span><b>Ganhe ${esc(pct)}%</b> de cashback em cada pedido entregue (sobre os produtos, sem a taxa). ${txtProx ? esc(txtProx) + '.' : ''}</span></li>
        <li>${icone('relogio')}<span><b>Vale ${esc(validadeDias(FID))} dias.</b> Avisamos aqui antes de vencer. Combina com cupom.</span></li>
      </ul>
    </div>

    <div class="painel" style="margin-top:16px">
      <h2 style="font-size:1.1rem">Histórico</h2>
      <div class="movs">${movs.length ? movs.map(movHTML).join('') : `<div class="vazio-movs">${icone('presente')} Nenhum lançamento ainda. Seu próximo pedido entregue já rende cashback.</div>`}</div>
    </div>

    <div class="links-conta">
      <button type="button" data-trocar-pin>${icone('cadeado')} Trocar PIN</button>
      <button type="button" data-regulamento>Regulamento</button>
      <button type="button" data-sair>Sair</button>
    </div>`;

  qs('[data-repetir]')?.addEventListener('click', async (ev) => {
    const b = ev.currentTarget; b.disabled = true;
    try { const u = await itensDoUltimoPedido(); const res = await repetirItens(u?.itens || []); const m = mensagemRepetir(res); toast(m.msg, m.tipo, 3500); if (res.adicionados) location.href = 'checkout.html'; }
    catch { toast('Não deu para repetir agora.', 'erro'); }
    finally { b.disabled = false; }
  });
  qs('[data-trocar-pin]').addEventListener('click', () => abrirTrocarPin(sessao.tel, () => { sessao.pin = ''; }));
  qs('[data-regulamento]').addEventListener('click', () => abrirRegulamento(FID));
  qs('[data-sair]').addEventListener('click', () => { esquecerTelefone(); sessao = { tel: '', pin: '', dados: null }; toast('Você saiu. O saldo continua guardado no seu celular.'); renderEntrar(''); window.scrollTo({ top: 0 }); });
  window.scrollTo({ top: 0 });
}

function movHTML(m) {
  const t = TIPOS_MOV[m.tipo] || { icone: 'moeda', sinal: null, rotulo: m.tipo };
  const v = Number(m.valor || 0);
  const sinal = t.sinal || (v >= 0 ? 'mais' : 'menos');
  const titulo = m.descricao || t.rotulo;
  const extra = [];
  if (m.pedido_numero && !/#\d+/.test(titulo)) extra.push(`pedido #${m.pedido_numero}`);
  if (m.tipo === 'credito' && m.expira_em) extra.push(Number(m.restante) > 0 ? `vence ${dataCurta(m.expira_em)}` : Number(m.restante) === 0 ? 'já usado' : '');
  return `
    <div class="mov ${sinal}">
      <div class="ic">${icone(t.icone)}</div>
      <div style="min-width:0"><b>${esc(titulo)}</b><small>${esc(dataHoraBR(m.criado_em))}${extra.filter(Boolean).length ? ' · ' + esc(extra.filter(Boolean).join(' · ')) : ''}</small></div>
      <span class="val">${v >= 0 ? '+' : '−'} ${brl(Math.abs(v))}</span>
    </div>`;
}
