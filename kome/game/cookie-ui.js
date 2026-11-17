/* Kome no Japão — cookie-ui.js
   INTERFACES da CAMADA COOKIE (docs/design/camada-cookie.md, fila do Fable item 5): Painel do Pátio, cartão "Enquanto você
   estava fora · Pegar!", Arroz do Coração (+ 8 Tigelas e galeria de conquistas), Árvore de Sementes nova (E.UI.tree, a mesma
   da Árvore do Kome), chip "hora de partir" e o Cochilo do Kome. Só apresentação e toque: NENHUMA conta mora aqui.
   Arte (coração de arroz, tigelas, moedas, Kome bocejando): game/cookie-arte.js (G.CookieArt).

   ======================================================================================================================
   CONTRATO DO ADAPTADOR (programador: troque os FALSOS por chamadas do sistema de verdade NUM LUGAR SÓ)
   ----------------------------------------------------------------------------------------------------------------------
   A tela lê tudo AO VIVO de G.CookieUI.api (objeto trocável: G.CookieUI.use({...}) mescla os seus métodos por cima).
   Sem sistema e sem ?cookie=demo, api.ready() = false e nada aparece. Números sempre em ¥ (ou sementes), já com todos os
   multiplicadores; textos em pt-BR prontos. Toda função pode ser chamada várias vezes por segundo: tem que ser barata.

   ready() -> bool                    Pátio aberto (S.ended + sistema carregado). Chip "Pátio" só aparece com true.
   money() -> n                       ¥ na carteira (padrão: G.S.money).
   patio() -> [{id, name, n, rate, absurd?, locked?, lockTxt?}]
                                      as turmas na ordem da lista. id = id de D.TOOLS (pata…bagger) ou absurda
                                      (tatus, komeohs, trembala, foguete, fuji, portal). rate = ¥/s da turma inteira.
                                      locked = absurda ainda não destravada (aparece como "???" com lockTxt).
   total() -> {rate, n}               ¥/s do Pátio inteiro e unidades no total (cabeçalho do painel).
   price(id, k) -> n                  custo de comprar k unidades AGORA (soma da série ×1,15).
   maxBuy(id) -> k                    quantas dá pra comprar com o dinheiro de agora (×máx). 0 = nenhuma.
   buy(id, k) -> comprou              compra até k; devolve quantas comprou (0 = nada; a tela faz o som de erro).
   marco(id) -> null | {at, name, desc, mult, price, ready}
                                      PRÓXIMO marco de quantidade da turma (13 por turma: 1, 5, 25, 50, 100…). ready = já tem a
                                      quantidade e falta só pagar (a linha mostra o botão dourado "Marco ×2").
                                      prev opcional: {at} do marco anterior (pra barra começar dali).
   buyMarco(id) -> bool
   sinergias(id) -> [{id, other, otherName, name, desc, mult, state: 'on'|'ready'|'need', need, have, price}]
                                      sinergias que envolvem a turma. state: on = comprada, ready = dá pra comprar, need = falta
                                      (have/need da OUTRA turma ou da menor das duas).
   buySinergia(sid) -> bool
   coracao() -> {n, total, per, bonus, next: {need, name} | null, recent: [conquistaId]}
                                      n = conquistas, per = % por conquista (0.01 × (1 + tigelas)), bonus = n × per (3.6 = +360%).
   conquistas() -> [{id, name, desc, fam, icon, secret, got, hint}]
                                      fam ∈ turmas | riqueza | eventos | viagem | mini | coracao | segredo. desc = condição + piada.
                                      Secreta sem pegar: a tela mostra "???" e `hint` (null se o jogador não tem a Lupa de Segredos).
   tigelas() -> [{id, name, desc, need, price, owned, can}]   as 8 Tigelas do Coração (need = conquistas).
   buyTigela(i) -> bool
   seeds() -> n                       Sementes Douradas na mão.
   seedTree() -> {branches: {id: {name, color, icon}}, nodes: [{id, n, desc, branch, pos: {x, y}, req: [ids], size, icon,
                  max, absurd?}]}     formato do E.UI.tree (pos em unidades de 96 px; size 0/1/2). absurd = nó que destrava
                                      máquina absurda (sai dourado e grandão). max: 1 = compra única; 0 = sem teto.
   seedLevel(id) -> nível · seedCost(id) -> sementes do próximo nível · buySeed(id) -> bool
   away() -> null | {sec, capSec, capped, rows: [{icon, label, value, txt?}], total}
                                      ganho offline pendente (E.Sim). value em ¥ (rola o número) ou txt pronto ("40 onigiris").
                                      Chamado 1× no carregamento (e por G.CookieUI.showAway()). Nada aparece se null ou sem rows.
   claimAway() -> void                o jogador apertou Pegar! (credita; a tela só faz a festa).
   partir() -> null | {ok, patio, island, later, laterMin}
                                      chip "hora de partir": ok = sementes do pátio ≥ as da ilha E nada novo há 4 min (spec).
                                      patio/island = sementes de cada parte agora; later = previsão se ficar mais laterMin min.
   openMap() -> void                  abre o mapa das ilhas (padrão: G.IslandsUI.open()).
   onSettings(key, value)             opcional: avisa a troca de um ajuste desta tela (hoje só 'cochilo', pra secreta
                                      cochilo_desligado). onCochilo('aceito') idem (secreta cochilo_aceito).

   GANCHOS: G.CookieUI.openPatio() · openHeart(tab?) · openSeeds() · showAway() · cochilo(force) · close() · isOpen()
   DEMO: index.html?dev&cookie=demo  (+ &away=cap mostra o teto offline; &cochilo=1 mostra o cochilo em 4 s)
   ====================================================================================================================== */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {});
  if (!E || !E.U) return;
  const U = E.U, UI = E.UI, TAU = Math.PI * 2;
  const Q = location.search || '';
  const DEMO = /[?&]cookie=demo\b/.test(Q);

  /* ===================== MOVER PRO data.js (D.COOKIE_UI) — números da interface ===================== */
  const CFG = {
    HOLD_DELAY: 0.38, HOLD_GAP: [0.16, 0.05],   // segurar o botão de comprar: espera, intervalo inicial → mínimo
    COCHILO_MIN: 60,                             // minutos de jogo seguido (aba visível) até o Kome cochilar
    COCHILO_RESET: 10,                           // minutos de aba escondida que zeram a conta
    MULTS: [1, 10, 'max'],
  };

  /* ======================================================================
     1. ADAPTADOR (o programador troca isto)
     ====================================================================== */
  const fmt = n => (U.fmt ? U.fmt(n) : String(Math.round(n)));
  const NONE = {
    ready: () => false, money: () => (G.S ? G.S.money : 0), patio: () => [], total: () => ({ rate: 0, n: 0 }),
    price: () => Infinity, maxBuy: () => 0, buy: () => 0, marco: () => null, buyMarco: () => false,
    sinergias: () => [], buySinergia: () => false,
    coracao: () => ({ n: 0, total: 0, per: 0.01, bonus: 0, next: null, recent: [] }), conquistas: () => [],
    tigelas: () => [], buyTigela: () => false,
    seeds: () => (G.S && G.S.stats ? G.S.stats.seeds | 0 : 0), seedTree: () => ({ branches: {}, nodes: [] }),
    seedLevel: () => 0, seedCost: () => Infinity, buySeed: () => false,
    away: () => null, claimAway: () => {}, partir: () => null,
    openMap: () => { if (G.IslandsUI && G.IslandsUI.open) G.IslandsUI.open(); },
    onSettings: () => {}, onCochilo: () => {},
  };
  const CU = (G.CookieUI = G.CookieUI || {});
  CU.api = Object.assign({}, NONE, CU.api || {});
  CU.use = impl => { Object.assign(CU.api, impl || {}); if (built) refreshAll(); return CU.api; };
  const A = () => CU.api;
  const ART = () => G.CookieArt;

  /* ======================================================================
     2. CASCA: camada própria por cima do jogo, palco lógico de 540 px de altura (deitado) que estica na largura
     ====================================================================== */
  const INK = '#3B2818';
  const css = document.createElement('style');
  css.textContent = `
.k-cui{position:fixed;inset:0;z-index:56;pointer-events:none;font-family:'Zen Maru Gothic','Hiragino Maru Gothic ProN','M PLUS Rounded 1c','Nunito','Varela Round','Arial Rounded MT Bold','Trebuchet MS','Segoe UI',system-ui,sans-serif;color:#2A1A10;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none;font-variant-numeric:tabular-nums}
.k-cui *{box-sizing:border-box}
.k-cui-v{position:absolute;left:0;top:0;transform-origin:0 0}
.k-cui button{font:inherit;color:inherit;margin:0;cursor:pointer;touch-action:manipulation}
:where(.k-cui) button{border:0;background:none;padding:0}
.k-cui-dim{position:absolute;inset:0;background:rgba(29,20,12,.55);pointer-events:auto;opacity:0;transition:opacity .25s}
.k-cui-dim.on{opacity:1}
.k-cui-card{position:absolute;background:#FFFAEE;border:3px solid ${INK};border-radius:18px;box-shadow:0 5px 0 ${INK},0 10px 24px rgba(40,20,5,.28);pointer-events:auto;display:flex;flex-direction:column;overflow:hidden;opacity:0;transform:translateY(14px) scale(.97);transition:opacity .22s,transform .3s cubic-bezier(.2,1.4,.4,1)}
.k-cui-card.on{opacity:1;transform:none}
.k-cui-head{display:flex;align-items:center;gap:10px;padding:8px 8px 8px 14px;background:#6B4526;border-bottom:3px solid ${INK};color:#FFF6E6;flex:0 0 auto;background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 26px,rgba(0,0,0,.06) 26px 28px)}
.k-cui-head h2{margin:0;font-size:24px;font-weight:900;letter-spacing:.5px;text-shadow:0 2px 0 ${INK};flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.1}
.k-cui-head h2 small{display:block;font-size:17px;font-weight:800;opacity:.92;letter-spacing:0;text-shadow:none;color:#F6E2B8}
.k-cui-x{width:50px;height:50px;border-radius:14px!important;background:#FFFAEE!important;border:3px solid ${INK}!important;box-shadow:0 3px 0 ${INK};font-size:26px!important;font-weight:900!important;line-height:1;flex:0 0 auto;display:flex;align-items:center;justify-content:center;color:${INK}!important}
.k-cui-x:active,.k-cui-b:active{transform:translateY(2px);box-shadow:0 1px 0 ${INK}}
.k-cui-b{min-height:48px;padding:6px 14px;border-radius:14px!important;border:3px solid ${INK}!important;box-shadow:0 4px 0 ${INK};background:#F6ECD4!important;font-weight:900!important;font-size:19px!important;display:inline-flex;align-items:center;justify-content:center;gap:6px;line-height:1.05;text-align:center;white-space:nowrap}
.k-cui-b.gold{background:linear-gradient(#FFE58A,#F0BE48)!important}
.k-cui-b.green{background:linear-gradient(#BFE08F,#8DBE5A)!important}
.k-cui-b.off{background:#E4DCCB!important;color:#7A6A58!important;box-shadow:0 2px 0 ${INK}}
.k-cui-b small{display:block;font-size:17px;font-weight:800}
.k-cui-pop{animation:kcuipop .28s cubic-bezier(.2,1.6,.4,1)}
@keyframes kcuipop{0%{transform:scale(.9)}60%{transform:scale(1.07)}100%{transform:none}}
.k-cui-shake{animation:kcuishake .3s}
@keyframes kcuishake{0%,100%{transform:none}25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}
.k-cui-ico{display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.k-cui-ico canvas{image-rendering:pixelated}
/* ---- Pátio ---- */
.k-cui-patio{top:10px;bottom:10px;right:10px;width:500px;max-width:calc(100% - 20px)}
.k-cui-tools{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#F3E5C4;border-bottom:3px solid ${INK};flex:0 0 auto}
.k-cui-seg{display:flex;border:3px solid ${INK};border-radius:14px;overflow:hidden;box-shadow:0 3px 0 ${INK};flex:0 0 auto}
.k-cui-seg button{min-width:62px;height:46px;font-size:19px;font-weight:900;background:#FFFAEE;border-left:3px solid ${INK}}
.k-cui-seg button:first-child{border-left:0}
.k-cui-seg button.on{background:#FFD866}
.k-cui-seg button:last-child{min-width:76px}
.k-cui-sp{flex:1 1 auto}
.k-cui-list{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:8px 8px 14px;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.k-cui-list::-webkit-scrollbar{width:10px}.k-cui-list::-webkit-scrollbar-thumb{background:#C9A974;border-radius:8px;border:2px solid #FFFAEE}
.k-cui-row{display:grid;grid-template-columns:58px 1fr auto;gap:4px 10px;align-items:center;padding:8px 8px 8px 8px;margin-bottom:8px;border:3px solid ${INK};border-radius:14px;background:#FBF3DF;box-shadow:0 3px 0 rgba(59,40,24,.55);position:relative}
.k-cui-row.can{background:linear-gradient(90deg,#FFF0B8,#FFF8DC 60%);box-shadow:0 3px 0 ${INK},0 0 0 3px #F3C94A inset}
.k-cui-row.locked{background:#E9E1D0;opacity:.85}
.k-cui-row .k-cui-ico{width:58px;height:58px;border-radius:12px;background:#FFFAEE;border:2px solid rgba(59,40,24,.35);grid-row:1 / span 2;align-self:start;position:relative}
.k-cui-n{position:absolute;right:-6px;bottom:-8px;min-width:30px;height:24px;padding:0 5px;border-radius:12px;background:${INK};color:#FFE9A8;font-size:17px;font-weight:900;line-height:24px;text-align:center}
.k-cui-nm{font-size:20px;font-weight:900;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.k-cui-rt{font-size:17px;font-weight:800;color:#6B5640;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k-cui-buy{grid-column:3;grid-row:1 / span 2;min-width:124px;min-height:62px;flex-direction:column;gap:1px;padding:4px 10px}
.k-cui-buy b{font-size:17px;font-weight:900}
.k-cui-buy span{font-size:19px;font-weight:900}
.k-cui-mile{grid-column:1 / span 3;display:flex;align-items:center;gap:8px;min-width:0}
.k-cui-bar{position:relative;flex:1 1 auto;height:24px;border:2px solid ${INK};border-radius:12px;background:#E9DCC0;overflow:hidden;min-width:0}
.k-cui-bar i{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(#FFE58A,#E9B23E);border-right:2px solid rgba(59,40,24,.4)}
.k-cui-bar span{position:relative;display:block;padding:0 8px;font-size:17px;font-weight:900;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k-cui-mb{min-height:44px!important;padding:2px 10px!important;font-size:17px!important;flex:0 0 auto}
.k-cui-low{grid-column:1 / span 3;display:flex;align-items:center;gap:8px;min-width:0}
.k-cui-joke{flex:1 1 auto;font-size:17px;font-weight:700;color:#6B5640;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic;min-width:0}
.k-cui-syn{flex:0 0 auto;display:flex;gap:6px}
.k-cui-syn:empty{display:none}
.k-cui-badge{display:inline-flex;align-items:center;gap:4px;min-height:44px;min-width:44px;padding:2px 7px;border:2px solid ${INK};border-radius:12px;font-size:17px;font-weight:900;background:#EDE3CF;color:#6B5640;white-space:nowrap}
.k-cui-badge.on{background:#D7EBC0;color:#33502A}
.k-cui-badge.ready{background:linear-gradient(#FFE58A,#F0BE48);color:#2A1A10;box-shadow:0 3px 0 ${INK};cursor:pointer}
.k-cui-foot{display:flex;gap:8px;padding:8px 10px;border-top:3px solid ${INK};background:#F3E5C4;flex:0 0 auto}
.k-cui-foot .k-cui-b{flex:1 1 0;font-size:18px!important;min-width:0}
.k-cui-float{position:absolute;pointer-events:none;font-size:24px;font-weight:900;color:#FFE16A;-webkit-text-stroke:5px ${INK};paint-order:stroke;animation:kcuifl .9s ease-out forwards;white-space:nowrap}
@keyframes kcuifl{0%{transform:translate(-50%,0) scale(.7);opacity:0}15%{transform:translate(-50%,-8px) scale(1.15);opacity:1}100%{transform:translate(-50%,-56px);opacity:0}}
/* ---- Pegar ---- */
.k-cui-away{left:50%;top:50%;width:600px;max-width:calc(100% - 20px);transform:translate(-50%,-46%) scale(.96)}
.k-cui-away.on{transform:translate(-50%,-50%)}
.k-cui-away .k-cui-body{padding:12px 18px 16px;display:flex;flex-direction:column;gap:8px}
.k-cui-kick{font-size:17px;font-weight:900;letter-spacing:1.5px;color:#9A6A20;text-transform:uppercase}
.k-cui-big{font-size:30px;font-weight:900;line-height:1.05}
.k-cui-arow{display:flex;align-items:center;gap:10px;padding:6px 10px;border:2px solid rgba(59,40,24,.35);border-radius:12px;background:#FBF3DF;font-size:19px;font-weight:800}
.k-cui-arow b{margin-left:auto;font-weight:900;font-size:21px;white-space:nowrap}
.k-cui-note{font-size:17px;font-weight:700;color:#6B5640}
.k-cui-pegar{min-height:76px!important;font-size:34px!important;letter-spacing:1px;margin-top:4px}
/* ---- Coração ---- */
.k-cui-heart{left:50%;top:10px;bottom:10px;width:940px;max-width:calc(100% - 20px);transform:translate(-50%,10px) scale(.97)}
.k-cui-heart.on{transform:translate(-50%,0)}
.k-cui-tabs{display:flex;gap:6px;flex:0 0 auto}
.k-cui-tab{white-space:nowrap;flex:0 0 auto}
.k-cui-tab{min-height:48px;padding:4px 16px;border-radius:12px!important;border:3px solid ${INK}!important;background:#C9A974!important;font-size:19px!important;font-weight:900!important;color:${INK}!important}
.k-cui-tab.on{background:#FFFAEE!important}
.k-cui-pane{flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:10px 12px 14px;touch-action:pan-y;overscroll-behavior:contain}
.k-cui-hgrid{display:flex;gap:14px;flex-wrap:wrap}
.k-cui-hl{flex:0 0 300px;display:flex;flex-direction:column;align-items:center;gap:6px}
.k-cui-hr{flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:8px}
.k-cui-sum{font-size:22px;font-weight:900;text-align:center;line-height:1.15}
.k-cui-sum small{display:block;font-size:17px;font-weight:800;color:#6B5640}
.k-cui-h3{font-size:19px;font-weight:900;margin:2px 0 0;display:flex;align-items:center;gap:6px}
.k-cui-h3 small{font-size:17px;font-weight:800;color:#6B5640}
.k-cui-bowls{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.k-cui-bowl{border:3px solid ${INK};border-radius:14px;background:#FBF3DF;padding:4px 4px 6px;display:flex;flex-direction:column;align-items:center;gap:2px;text-align:center;min-width:0}
.k-cui-bowl.owned{background:#FFF0C4}
.k-cui-bowl canvas{width:96px;height:64px}
.k-cui-bowl b{font-size:17px;font-weight:900;line-height:1.05;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.k-cui-bowl .k-cui-b{min-height:44px;font-size:17px!important;padding:2px 6px;width:100%}
.k-cui-recent{display:flex;flex-direction:column;gap:6px}
.k-cui-ach{display:flex;align-items:center;gap:10px;padding:6px 10px;border:2px solid rgba(59,40,24,.4);border-radius:12px;background:#FBF3DF;min-width:0;text-align:left;width:100%}
.k-cui-ach>div{min-width:0;flex:1 1 auto}
.k-cui-ach b{display:block;font-size:18px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k-cui-ach span{display:block;font-size:17px;font-weight:700;color:#6B5640;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.k-cui-fams{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.k-cui-fam{min-height:46px;padding:2px 12px;border:3px solid ${INK}!important;border-radius:12px!important;background:#F6ECD4!important;font-size:17px!important;font-weight:900!important;display:inline-flex;align-items:center;gap:6px}
.k-cui-fam.on{background:#FFD866!important;box-shadow:0 3px 0 ${INK}}
.k-cui-fam small{font-size:17px;font-weight:800;color:#6B5640}
.k-cui-gal{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:6px}
.k-cui-cell{display:flex;align-items:center;gap:8px;min-height:56px;padding:4px 8px;border:2px solid rgba(59,40,24,.45);border-radius:12px;background:#EFE6D3;text-align:left;min-width:0}
.k-cui-cell.got{background:#FFF4CF;border-color:${INK}}
.k-cui-cell.sel{box-shadow:0 0 0 3px #F3C94A}
.k-cui-cell b{font-size:17px;font-weight:900;line-height:1.1;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-width:0}
.k-cui-cell:not(.got) b{color:#7A6A58}
.k-cui-detail{position:sticky;bottom:-14px;margin:8px -12px -14px;padding:8px 14px;background:#3B2818;color:#FFF6E6;font-size:18px;font-weight:800;min-height:48px;display:flex;align-items:center;gap:10px}
.k-cui-detail b{color:#FFE16A;white-space:nowrap}
/* ---- Cochilo ---- */
.k-cui-nap{left:12px;bottom:96px;width:430px;max-width:calc(100% - 24px);flex-direction:row;align-items:center;gap:6px;padding:8px 10px 8px 6px}
.k-cui-nap canvas{width:128px;height:96px;flex:0 0 auto;image-rendering:pixelated}
.k-cui-nap .t{font-size:20px;font-weight:900;line-height:1.1}
.k-cui-nap .s{font-size:17px;font-weight:700;color:#6B5640;margin:3px 0 6px;line-height:1.2}
.k-cui-nap .k-cui-b{font-size:17px!important;min-height:46px;padding:2px 10px}
.k-cui-fx{position:absolute;inset:0;pointer-events:none}
`;
  document.head.appendChild(css);
  const root = document.createElement('div'); root.className = 'k-cui';
  const V = document.createElement('div'); V.className = 'k-cui-v'; root.appendChild(V);
  const fxCv = document.createElement('canvas'); fxCv.className = 'k-cui-fx';
  let vw = 960, vh = 540, k = 1;
  function fit() {
    const w = innerWidth, h = innerHeight;
    k = w >= h ? Math.min(w / 960, h / 540) : Math.min(w / 520, h / 900);
    vw = w / k; vh = h / k;
    V.style.width = vw + 'px'; V.style.height = vh + 'px'; V.style.transform = 'scale(' + k + ')';
    const d = Math.min(2, window.devicePixelRatio || 1);
    fxCv.width = Math.round(w * d); fxCv.height = Math.round(h * d); fxCv.style.width = w + 'px'; fxCv.style.height = h + 'px';
  }
  function el(tag, cls, parent, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; if (parent) parent.appendChild(e); return e; }
  function setT(e, s) { s = String(s); if (e.__t !== s) { e.__t = s; e.textContent = s; } }
  function iconCv(id, size) {
    let ic = null;
    if (id && typeof id !== 'string') ic = id;
    else if (G.Props && G.Props.icon && G.Props.ids && G.Props.ids.indexOf(id) >= 0) ic = G.Props.icon(id);
    const c = UI && UI.icon ? UI.icon(ic || id || 'star', size) : null;
    return c || (UI && UI.icon ? UI.icon('star', size) : document.createElement('span'));
  }
  function sfx(name, o) {
    const S = G.S; if ((S && S.opts && S.opts.mute) || !E.Sfx || !E.Sfx.has || !E.Sfx.has(name)) return;
    try { E.Sfx.play(name, o); } catch (e) { /* sem áudio */ }
  }
  function pop(e, cls) { cls = cls || 'k-cui-pop'; e.classList.remove(cls); void e.offsetWidth; e.classList.add(cls); }
  function float(txt, x, y) { const f = el('div', 'k-cui-float', V, txt); f.style.left = x + 'px'; f.style.top = y + 'px'; setTimeout(() => f.remove(), 950); }
  function rectV(e) { const r = e.getBoundingClientRect(); return { x: r.left / k, y: r.top / k, w: r.width / k, h: r.height / k, cx: (r.left + r.width / 2) / k, cy: (r.top + r.height / 2) / k }; }
  function closeBtn(parent, fn) { const x = el('button', 'k-cui-x', parent, '×'); x.type = 'button'; x.setAttribute('aria-label', 'fechar'); x.addEventListener('click', () => { sfx('click'); fn(); }); return x; }
  function button(parent, txt, cls, fn) { const b = el('button', 'k-cui-b' + (cls ? ' ' + cls : ''), parent); b.type = 'button'; if (txt) b.textContent = txt; if (fn) b.addEventListener('click', e => { e.stopPropagation(); fn(e); }); return b; }
  // card(cls) -> {card, dim, open(), close()} com fundo escurecido opcional
  const opened = [];
  function sheet(cls, o) {
    o = o || {};
    const dim = o.dim === false ? null : el('div', 'k-cui-dim', null);
    const card = el('div', 'k-cui-card ' + cls, null);
    const s = { card, dim, isOpen: false,
      open() { if (s.isOpen) return s; s.isOpen = true; opened.push(s); if (dim) V.appendChild(dim); V.appendChild(card); void card.offsetWidth; if (dim) dim.classList.add('on'); card.classList.add('on'); if (o.onOpen) o.onOpen(); return s; },
      close() { if (!s.isOpen) return s; s.isOpen = false; const i = opened.indexOf(s); if (i >= 0) opened.splice(i, 1); if (dim) dim.classList.remove('on'); card.classList.remove('on'); setTimeout(() => { if (!s.isOpen) { card.remove(); if (dim) dim.remove(); } }, 260); if (o.onClose) o.onClose(); return s; },
    };
    if (dim && o.dismiss !== false) dim.addEventListener('pointerdown', e => { if (e.target === dim) s.close(); });
    return s;
  }
  function head(card, title, sub, onX) {
    const h = el('div', 'k-cui-head', card), h2 = el('h2', null, h);
    const t = el('span', null, h2, title), sm = el('small', null, h2, sub || '');
    const x = closeBtn(h, onX);
    return { h, t, sm, x };
  }

  /* ======================================================================
     3. PAINEL DO PÁTIO (lateral, o pátio continua aparecendo à esquerda)
     ====================================================================== */
  const P = { mult: 1, rows: {}, t: 0 };
  const patio = sheet('k-cui-patio', { dim: false, onOpen: () => { buildRows(); tickPatio(true); } });
  {
    const c = patio.card;
    const hd = head(c, 'PÁTIO DA FROTA', '', () => patio.close());
    P.sub = hd.sm;
    const tools = el('div', 'k-cui-tools', c);
    const seg = el('div', 'k-cui-seg', tools);
    P.seg = CFG.MULTS.map(m => {
      const b = el('button', null, seg, m === 'max' ? '×máx' : '×' + m); b.type = 'button';
      b.addEventListener('click', () => { P.mult = m; sfx('click'); P.seg.forEach(x => x.classList.toggle('on', x === b)); tickPatio(true); });
      return b;
    });
    P.seg[0].classList.add('on');
    el('div', 'k-cui-sp', tools);
    P.money = el('div', 'k-cui-rt', tools); P.money.style.fontSize = '19px'; P.money.style.color = '#2A1A10';
    P.list = el('div', 'k-cui-list', c);
    const foot = el('div', 'k-cui-foot', c);
    button(foot, 'Arroz do Coração', '', () => openHeart());
    button(foot, 'Sementes', '', () => openSeeds());
    // Livro dos Eventos (eventos-arte.js): abre por cima do painel (z 57 > 56) e, ao fechar, volta pro Pátio
    const bk = button(foot, 'Eventos', 'k-cui-book', () => { sfx('click'); const EA = G.EventArt; if (!(EA && EA.openBook && EA.openBook())) { sfx('error'); pop(bk, 'k-cui-shake'); } });
    bk.title = 'Livro dos Eventos'; bk.setAttribute('aria-label', 'Livro dos Eventos'); bk.insertBefore(iconCv('book', 22), bk.firstChild);
  }
  const qty = id => { const m = P.mult; if (m === 'max') return Math.max(1, A().maxBuy(id) | 0); return m; };
  function buildRows() {
    P.list.textContent = ''; P.rows = {};
    for (const t of A().patio()) {
      const r = { id: t.id, el: el('div', 'k-cui-row', P.list) };
      r.ico = el('div', 'k-cui-ico', r.el);
      const art = ART() && ART().machineIcon ? ART().machineIcon(t.id, 48) : null;
      r.ico.appendChild(art || iconCv(t.id, 40));
      r.n = el('div', 'k-cui-n', r.ico, '0');
      const mid = el('div', null, r.el); mid.style.minWidth = '0';
      r.nm = el('div', 'k-cui-nm', mid); r.rt = el('div', 'k-cui-rt', mid);
      r.buy = button(r.el, '', 'k-cui-buy'); r.bq = el('b', null, r.buy); r.bp = el('span', null, r.buy);
      holdable(r.buy, () => doBuy(r));
      r.mile = el('div', 'k-cui-mile', r.el);
      r.bar = el('div', 'k-cui-bar', r.mile); r.fill = el('i', null, r.bar); r.bt = el('span', null, r.bar);
      r.mb = button(r.mile, '', 'gold k-cui-mb', () => { if (A().buyMarco(r.id)) { sfx('levelup'); burstAt(r.mb, 26); const m = rectV(r.mb); float('MARCO!', m.cx, m.y); } else { sfx('error'); pop(r.mb, 'k-cui-shake'); } tickPatio(true); });
      r.low = el('div', 'k-cui-low', r.el);
      r.joke = el('div', 'k-cui-joke', r.low);
      r.syn = el('div', 'k-cui-syn', r.low); r.synKey = '';
      P.rows[t.id] = r;
    }
  }
  function doBuy(r) {
    const want = qty(r.id), got = A().buy(r.id, want) | 0;
    if (!got) { sfx('error'); pop(r.buy, 'k-cui-shake'); return false; }
    P.chain = (P.chainT > 0 ? (P.chain || 0) + 1 : 0); P.chainT = 1.2;
    sfx(got >= 10 ? 'kaching' : 'buy', { pitch: Math.min(1.6, 1 + P.chain * 0.03) });
    pop(r.buy); pop(r.n);
    const b = rectV(r.buy); float('+' + got, b.cx, b.y);
    if (got >= 10) burstAt(r.buy, Math.min(40, 8 + got));
    tickPatio(true);
    return true;
  }
  // segurar repete (acelerando); solta, sai ou cancela para. Nada de click duplo: só pointer.
  function holdable(btn, fn) {
    let tm = 0, gap = 0, on = false;
    const stop = () => { on = false; clearTimeout(tm); };
    const rep = () => { if (!on) return; if (fn() === false) return stop(); gap = Math.max(CFG.HOLD_GAP[1], gap * 0.82); tm = setTimeout(rep, gap * 1000); };
    btn.addEventListener('pointerdown', e => { if (e.button > 0) return; e.preventDefault(); on = true; gap = CFG.HOLD_GAP[0]; fn(); clearTimeout(tm); tm = setTimeout(rep, CFG.HOLD_DELAY * 1000); });
    ['pointerup', 'pointerleave', 'pointercancel', 'lostpointercapture'].forEach(n => btn.addEventListener(n, stop));
    btn.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } });
  }
  function tickPatio(force) {
    if (!patio.isOpen) return;
    const api = A(), m = api.money(), tot = api.total();
    setT(P.sub, '¥ ' + fmt(tot.rate) + '/s · ' + fmt(tot.n) + ' na frota');
    setT(P.money, '¥ ' + fmt(m));
    const list = api.patio();
    if (list.length !== Object.keys(P.rows).length || list.some(t => !P.rows[t.id])) buildRows();
    for (const t of list) {
      const r = P.rows[t.id]; if (!r) continue;
      r.el.classList.toggle('locked', !!t.locked);
      if (t.locked) {
        setT(r.nm, '???'); setT(r.rt, t.lockTxt || 'destrave na Árvore de Sementes'); setT(r.n, '?');
        r.buy.style.display = 'none'; r.mile.style.display = 'none'; setT(r.joke, ''); r.syn.textContent = ''; r.el.classList.remove('can');
        r.ico.style.filter = 'brightness(0) opacity(.35)';
        continue;
      }
      r.ico.style.filter = ''; r.buy.style.display = ''; r.mile.style.display = '';
      setT(r.nm, t.name); setT(r.n, fmt(t.n)); setT(r.rt, '¥ ' + fmt(t.rate) + '/s' + (t.absurd ? ' · máquina absurda' : ''));
      const q = qty(t.id), pr = api.price(t.id, q), can = m >= pr && isFinite(pr);
      r.el.classList.toggle('can', can);
      r.buy.className = 'k-cui-b k-cui-buy ' + (can ? 'gold' : 'off');
      setT(r.bq, 'Comprar ×' + fmt(q)); setT(r.bp, isFinite(pr) ? '¥ ' + fmt(pr) : '—');
      const mk = api.marco(t.id);
      if (mk) {
        const from = mk.prev ? mk.prev.at : 0, f = U.clamp((t.n - from) / Math.max(1, mk.at - from), 0, 1);
        r.fill.style.width = (mk.ready ? 100 : f * 100).toFixed(1) + '%';
        setT(r.bt, mk.ready ? 'Marco ' + mk.at + ': ' + mk.name : fmt(t.n) + '/' + fmt(mk.at) + ' → ×' + fmtMul(mk.mult) + ' · ' + mk.name);
        setT(r.joke, mk.desc || '');
        r.mb.style.display = mk.ready ? '' : 'none';
        if (mk.ready) { const ok = m >= mk.price; r.mb.className = 'k-cui-b k-cui-mb ' + (ok ? 'gold' : 'off'); setT(r.mb, '×' + fmtMul(mk.mult) + ' · ¥ ' + fmt(mk.price)); }
      } else { r.fill.style.width = '100%'; setT(r.bt, 'todos os marcos!'); setT(r.joke, ''); r.mb.style.display = 'none'; }
      synBadges(r, api.sinergias(t.id), m);
    }
  }
  function fmtMul(v) { return String(Math.round(v * 100) / 100).replace('.', ','); }
  function synBadges(r, list, money) {
    list = list.slice().sort((a, b) => ({ ready: 0, on: 1, need: 2 })[a.state] - ({ ready: 0, on: 1, need: 2 })[b.state]).slice(0, 2);
    const key = list.map(s => s.id + s.state + (s.state === 'need' ? s.have : '') + (s.state === 'ready' ? (money >= s.price ? 1 : 0) : '')).join('|');
    if (key === r.synKey) return; r.synKey = key; r.syn.textContent = '';
    for (const s of list) {
      const b = el(s.state === 'ready' ? 'button' : 'div', 'k-cui-badge ' + s.state, r.syn);
      const ic = iconCv(s.other, 20); b.appendChild(ic);
      if (s.state === 'on') el('span', null, b, '×' + fmtMul(s.mult));
      else if (s.state === 'ready') { el('span', null, b, '¥ ' + fmt(s.price)); if (money < s.price) b.style.opacity = '.65';
        b.addEventListener('click', () => { if (A().buySinergia(s.id)) { sfx('unlock'); burstAt(b, 22); r.synKey = ''; tickPatio(true); } else { sfx('error'); pop(b, 'k-cui-shake'); } }); }
      else el('span', null, b, fmt(s.have) + '/' + fmt(s.need));
      b.title = 'Sinergia com ' + s.otherName + ': ' + s.name + (s.state === 'on' ? ' (ativa)' : s.state === 'ready' ? ' · toque pra comprar' : ' · falta ' + fmt(s.need - s.have)) + ' · ' + (s.desc || '');
    }
  }

  /* ======================================================================
     4. "ENQUANTO VOCÊ ESTAVA FORA · PEGAR!"
     ====================================================================== */
  const away = sheet('k-cui-away', { dismiss: false });
  function hms(sec) { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60); return h ? h + ' h' + (m ? ' ' + m + ' min' : '') : m ? m + ' min' : sec + ' s'; }
  function showAway(data) {
    const d = data || A().away(); if (!d || !d.rows || !d.rows.length) return false;
    const c = away.card; c.textContent = '';
    const hd = el('div', 'k-cui-head', c), h2 = el('h2', null, hd); el('span', null, h2, 'Enquanto você estava fora'); el('small', null, h2, hms(d.sec) + ' longe · a frota não parou');
    const body = el('div', 'k-cui-body', c);
    const top = el('div', null, body); top.style.cssText = 'display:flex;align-items:center;gap:12px';
    const art = ART() && ART().komeCard ? ART().komeCard('wag', 110, 80) : null; if (art) top.appendChild(art.cv);
    const tt = el('div', null, top); el('div', 'k-cui-kick', tt, 'o arroz rendeu');
    const big = el('div', 'k-cui-big', tt, '¥ 0');
    for (const r of d.rows) {
      const row = el('div', 'k-cui-arow', body); row.appendChild(iconCv(r.icon || 'yen', 26)); el('span', null, row, r.label);
      el('b', null, row, r.txt || (typeof r.value === 'number' ? '+¥ ' + fmt(r.value) : String(r.value)));
    }
    if (d.capped) el('div', 'k-cui-note', body, 'Contou até ' + hms(d.capSec) + ' (o teto de agora). A Cama Grande, na Árvore de Sementes, deixa a soneca render mais.');
    const go = button(body, 'Pegar!', 'gold k-cui-pegar');
    let done = false, rollT = 0;
    const T0 = performance.now();
    const roll = () => { if (!away.isOpen) return; const f = U.clamp((performance.now() - T0) / 900, 0, 1), e = 1 - Math.pow(1 - f, 3); setT(big, '¥ ' + fmt((d.total || 0) * e)); if (f < 1) rollT = requestAnimationFrame(roll); };
    go.addEventListener('click', () => {
      if (done) return; done = true; cancelAnimationFrame(rollT); setT(big, '¥ ' + fmt(d.total || 0));
      try { A().claimAway(); } catch (e) { console.warn('[kome] claimAway', e); }
      sfx('kaching'); sfx('coins', { delay: 0.05 }); sfx('fanfare', { delay: 0.12, vol: 0.6 });
      coinBurst(go, 46, yenTarget());
      pop(go); setTimeout(() => { away.close(); if (art) art.stop(); }, 520);
      if (G.HUD && G.HUD.bump) setTimeout(() => G.HUD.bump(), 900);
    });
    away.open(); rollT = requestAnimationFrame(roll); sfx('chime');
    return true;
  }
  function yenTarget() {   // pílula do ¥ do HUD (pra onde as moedas voam), em coords lógicas daqui
    const p = document.querySelector('.k-zone-tl .k-pill') || document.querySelector('.k-pill');
    if (p) { const r = rectV(p); if (r.w) return { x: r.x + 24, y: r.cy }; }
    return { x: 40, y: 30 };
  }

  /* ======================================================================
     5. ARROZ DO CORAÇÃO (+ 8 Tigelas) e GALERIA de conquistas
     ====================================================================== */
  const FAMS = [
    ['turmas', 'Turmas', 'paw'], ['riqueza', 'Riqueza', 'yen'], ['eventos', 'Eventos', 'bolt'], ['viagem', 'Viagem', 'boat'],
    ['mini', 'Minijogos', 'gear'], ['coracao', 'Coração e tempo', 'clock'], ['segredo', 'Segredos', 'book'],
  ];
  const H = { tab: 'coracao', fam: 'turmas', sel: null };
  const heart = sheet('k-cui-heart', { onOpen: () => renderHeart(), onClose: () => { if (H.art) H.art.stop(); } });
  {
    const c = heart.card, hd = el('div', 'k-cui-head', c);
    const h2 = el('h2', null, hd); H.title = el('span', null, h2, 'ARROZ DO CORAÇÃO'); H.sub = el('small', null, h2, '');
    const tabs = el('div', 'k-cui-tabs', hd);
    H.tabs = [['coracao', 'Coração'], ['galeria', 'Galeria']].map(([id, t]) => { const b = el('button', 'k-cui-tab', tabs, t); b.type = 'button'; b.addEventListener('click', () => { H.tab = id; sfx('click'); renderHeart(); }); b._id = id; return b; });
    closeBtn(hd, () => heart.close());
    H.pane = el('div', 'k-cui-pane', c);
  }
  function renderHeart() {
    const api = A(), co = api.coracao();
    setT(H.sub, co.n + ' conquistas · +' + pctTxt(co.bonus) + ' de renda');
    H.tabs.forEach(b => b.classList.toggle('on', b._id === H.tab));
    if (H.art) { H.art.stop(); H.art = null; }
    H.pane.textContent = ''; H.pane.scrollTop = 0;
    if (H.tab === 'coracao') heartPane(api, co); else galleryPane(api);
  }
  const pctTxt = v => fmt(Math.round(v * 1000) / 10).replace(/\.(\d)$/, ',$1') + '%';
  function heartPane(api, co) {
    const g = el('div', 'k-cui-hgrid', H.pane), L = el('div', 'k-cui-hl', g), R = el('div', 'k-cui-hr', g);
    if (ART() && ART().heart) { H.art = ART().heart(co.n, co.total || 418, 280, 230); L.appendChild(H.art.cv); }
    const s = el('div', 'k-cui-sum', L);
    s.innerHTML = '';
    el('span', null, s, co.n + ' × ' + pctTxt(co.per) + ' = +' + pctTxt(co.bonus));
    el('small', null, s, 'cada conquista é um grão: +' + pctTxt(co.per) + ' de renda pra sempre');
    if (co.next) el('small', null, s, 'próxima tigela em ' + co.next.need + ' (faltam ' + Math.max(0, co.next.need - co.n) + ')');
    const h3 = el('div', 'k-cui-h3', R); h3.appendChild(iconCv('star', 22)); el('span', null, h3, 'Tigelas do Coração');
    const tg = api.tigelas(); el('small', null, h3, tg.filter(t => t.owned).length + ' de ' + tg.length + ' · cada uma: +1% por conquista');
    const bowls = el('div', 'k-cui-bowls', R);
    tg.forEach((t, i) => {
      const b = el('div', 'k-cui-bowl' + (t.owned ? ' owned' : ''), bowls);
      if (ART() && ART().bowl) b.appendChild(ART().bowl(i, t.owned, t.can));
      el('b', null, b, t.name.replace(/^Tigela do Coração [IVX]+: /, ''));
      const bt = button(b, '', t.owned ? 'green' : t.can && api.money() >= t.price ? 'gold' : 'off');
      if (t.owned) bt.textContent = 'cheia!';
      else if (co.n < t.need) bt.textContent = co.n + '/' + t.need;
      else bt.textContent = '¥ ' + fmt(t.price);
      b.title = t.desc || '';
      bt.addEventListener('click', () => {
        if (t.owned) return;
        if (api.buyTigela(i)) { sfx('levelup'); burstAt(b, 30); setTimeout(renderHeart, 380); }
        else { sfx('error'); pop(b, 'k-cui-shake'); }
      });
    });
    const h4 = el('div', 'k-cui-h3', R); h4.appendChild(iconCv('trophy', 22)); el('span', null, h4, 'Pegou agora há pouco');
    const rec = el('div', 'k-cui-recent', R), all = api.conquistas(), by = {};
    for (const c of all) by[c.id] = c;
    const ids = (co.recent || []).slice(0, 4);
    if (!ids.length) el('div', 'k-cui-note', rec, 'Nenhuma ainda nesta sessão. Elas aparecem aqui quando chegarem.');
    for (const id of ids) { const c = by[id]; if (c) achRow(rec, c); }
    const all2 = button(R, 'Ver todas na Galeria', '', () => { H.tab = 'galeria'; renderHeart(); }); all2.style.alignSelf = 'flex-start';
  }
  function achRow(parent, c) {
    const r = el('div', 'k-cui-ach', parent); r.appendChild(iconCv(c.icon || 'trophy', 30));
    const t = el('div', null, r); el('b', null, t, c.name); el('span', null, t, c.desc); return r;
  }
  function galleryPane(api) {
    const all = api.conquistas(), fams = el('div', 'k-cui-fams', H.pane);
    for (const [id, nm, ic] of FAMS) {
      const list = all.filter(c => c.fam === id), got = list.filter(c => c.got).length;
      if (!list.length) continue;
      const b = el('button', 'k-cui-fam' + (H.fam === id ? ' on' : ''), fams); b.type = 'button';
      b.appendChild(iconCv(ic, 20)); el('span', null, b, nm); el('small', null, b, got + '/' + list.length);
      b.addEventListener('click', () => { H.fam = id; H.sel = null; sfx('click'); renderHeart(); });
    }
    const gal = el('div', 'k-cui-gal', H.pane), list = all.filter(c => c.fam === H.fam);
    const det = el('div', 'k-cui-detail', null);
    const show = c => {
      det.textContent = '';
      if (!c) { el('span', null, det, 'Toque numa conquista pra ver o que ela pede.'); return; }
      const hidden = c.secret && !c.got;
      el('b', null, det, hidden ? '???' : c.name);
      el('span', null, det, hidden ? (c.hint ? 'Dica: ' + c.hint : 'Segredo. A Lupa de Segredos (Árvore de Sementes) dá uma dica.') : c.desc + (c.got ? '' : ' (ainda não)'));
    };
    for (const c of list) {
      const hidden = c.secret && !c.got;
      const b = el('button', 'k-cui-cell' + (c.got ? ' got' : '') + (H.sel === c.id ? ' sel' : ''), gal); b.type = 'button';
      const ic = iconCv(hidden ? 'book' : c.icon || 'trophy', 28); if (!c.got) ic.style.opacity = '0.4'; b.appendChild(ic);
      el('b', null, b, hidden ? '???' + (c.hint ? ' · ' + c.hint : '') : c.name);
      b.addEventListener('click', () => { H.sel = c.id; gal.querySelectorAll('.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); show(c); sfx('click', { vol: 0.5 }); });
    }
    H.pane.appendChild(det); show(list.find(c => c.id === H.sel) || null);
  }

  /* ======================================================================
     6. ÁRVORE DE SEMENTES NOVA (E.UI.tree, a mesma da Árvore do Kome) — nó com nível ganha "Subir nível" no cartão
     ====================================================================== */
  const T = { panel: null, tree: null, key: '' };
  function seedNodes() {
    const st = A().seedTree();
    const nodes = st.nodes.map(n => Object.assign({}, n, { c: A().seedCost(n.id) }));
    return { st, nodes };
  }
  function openSeeds() {
    if (!UI || !UI.panel || !UI.tree || !UI.root) return;
    const { st, nodes } = seedNodes();
    const key = nodes.map(n => n.id).join(',');
    if (!T.panel) {
      T.panel = UI.panel({ title: 'Sementes Douradas', icon: 'star', bare: true, onOpen: () => { if (T.tree) T.tree.refresh(); }, onClose: () => { if (T.tick) clearInterval(T.tick); T.tick = 0; } });
      T.count = UI.el('div', 'k-tree-hint', T.panel.head || T.panel.body, '');
      T.count.style.cssText = 'position:absolute;left:auto;right:72px;top:12px;bottom:auto;transform:none;z-index:3;font-size:19px;font-weight:900;background:#FFE9A8;color:#2A1A10;border:3px solid #3B2818;border-radius:14px;box-shadow:0 3px 0 #3B2818;padding:6px 12px;white-space:nowrap;pointer-events:none;opacity:1';
    }
    if (!T.tree || T.key !== key) {
      if (T.tree) T.tree.destroy();
      T.key = key; T.nodes = {}; nodes.forEach(n => { T.nodes[n.id] = n; describe(n); });
      T.tree = UI.tree(T.panel.body, {
        nodes, branches: st.branches, center: { icon: ART() && ART().seedIcon ? ART().seedIcon() : 'star', label: 'Sementes', scale: 1.3 },
        owned: id => A().seedLevel(id) > 0, progress: n => U.clamp(A().seeds() / Math.max(1, A().seedCost(n.id)), 0, 1),
        affordable: n => A().seeds() >= A().seedCost(n.id),
        fmtCost: c => '★ ' + fmt(c),
        onBuy(n) { return buySeed(n.id) ? undefined : false; },
        onSelect(n) { T.sel = n.id; levelBtn(); },
      });
      UI.el('div', 'k-tree-hint', T.tree.el, 'nó dourado grandão = máquina absurda · toque num nó, toque de novo pra comprar');
      T.tree.el.appendChild(T.count);
      T.card = T.tree.el.querySelector('.k-tree-card');
      T.lv = UI.button(T.card, { title: 'Subir nível', icon: 'star', iconSize: 22, center: true, sound: 'none', onClick: () => { if (T.sel) buySeed(T.sel, true); } });
      (T.lv.el || T.lv).style.display = 'none';
    }
    T.panel.open(); countSeeds(); levelBtn();
    if (!T.tick) T.tick = setInterval(() => { countSeeds(); levelBtn(); }, 400);
  }
  function describe(n) {
    const L = A().seedLevel(n.id), max = n.max | 0;
    n.see = (max === 1 ? (L ? 'comprado' : 'compra única') : 'nível ' + L + (max ? ' de ' + max : ' (sem teto)')) + (n.absurd ? ' · destrava máquina absurda' : '');
  }
  function buySeed(id, lvlUp) {
    const n = T.nodes[id];
    if (!A().buySeed(id)) { sfx('error'); return false; }
    if (n) { describe(n); n.c = A().seedCost(id); }
    sfx(n && n.absurd ? 'fanfare' : 'pling');
    if (lvlUp && T.tree) { T.tree.refresh(); const b = T.lv.el || T.lv; burstAt(b, 18); }
    countSeeds(); setTimeout(levelBtn, 30);
    return true;
  }
  function countSeeds() { if (T.count) setT(T.count, '★ ' + fmt(A().seeds()) + ' sementes'); }
  function levelBtn() {
    if (!T.lv || !T.card) return;
    const n = T.sel && T.nodes[T.sel], L = n ? A().seedLevel(n.id) : 0, max = n ? n.max | 0 : 1;
    const show = !!n && L > 0 && (max === 0 || L < max);
    const b = T.lv.el || T.lv; b.style.display = show ? '' : 'none';
    const buy = T.card.querySelector('.k-btn:not(:last-of-type)'); // botão "Já é seu!" do cartão some quando há nível pra subir
    T.card.querySelectorAll('.k-btn').forEach(x => { if (x !== b) x.style.display = show ? 'none' : ''; });
    void buy;
    if (show) { const c = A().seedCost(n.id), can = A().seeds() >= c; T.lv.set({ title: 'Subir pro nível ' + (L + 1), sub: '★ ' + fmt(c), state: can ? 'can' : 'off' }); }
  }

  /* ======================================================================
     7. CHIPS (Pátio · hora de partir) + COCHILO DO KOME
     ====================================================================== */
  let chipP = null, chipGo = null, chipT = 0;
  function chips(dt) {
    if ((chipT -= dt) > 0) return; chipT = 0.5;
    if (!G.HUD || !G.HUD.chip || !G.HUD.ready) return;
    const api = A(), ready = !!api.ready();
    if (!chipP) chipP = G.HUD.chip({ id: 'patio', icon: 'paw', label: 'Pátio', order: 15, tone: '#FFF0C2', show: false, onClick: () => (patio.isOpen ? patio.close() : openPatio()) });
    if (!chipGo) chipGo = G.HUD.chip({ id: 'partir', icon: 'boat', label: 'Partir', order: 41, tone: '#DDEFFF', show: false, onClick: () => { sfx('click'); patio.close(); api.openMap(); } });
    if (!chipP || !chipGo) return;
    let hint = '';
    if (ready) { for (const t of api.patio()) { if (t.locked) continue; const mk = api.marco(t.id); if (mk && mk.ready && api.money() >= mk.price) { hint = 'marco à vista'; break; } } }
    chipP.set({ show: ready, prio: hint ? 1 : 0, hint });
    const p = ready ? api.partir() : null;
    chipGo.set({ show: !!(p && p.ok), prio: p && p.ok ? 3 : 0, hot: 'Hora de partir', hint: p && p.ok ? '+' + fmt((p.patio | 0) + (p.island | 0)) + ' sementes' : '' });
    if (chipGo.el) chipGo.el.title = p && p.ok ? 'Agora: ' + fmt((p.patio | 0) + (p.island | 0)) + ' sementes' + (p.later ? ' · se ficar mais ' + (p.laterMin || 20) + ' min: ~' + fmt(p.later) : '') : '';
  }

  const NAP = { play: 0, hidden: 0, shown: false, card: null };
  const napOn = () => !(G.S && G.S.opts && G.S.opts.cochilo === false);
  const nap = sheet('k-cui-nap', { dim: false, onClose: () => { if (NAP.art) NAP.art.stop(); } });
  function napTick(dt) {
    if (document.hidden) { NAP.hidden += dt; if (NAP.hidden > CFG.COCHILO_RESET * 60) NAP.play = 0; return; }
    NAP.hidden = 0; NAP.play += dt;
    if (NAP.play >= CFG.COCHILO_MIN * 60 && napOn() && !nap.isOpen && !anyBusy()) showNap();
  }
  function anyBusy() {   // nunca por cima de outra tela, cutscene, fábrica ou oficina: espera e tenta depois
    if (opened.some(s => s !== nap && s !== patio)) return true;
    if (document.querySelector('.k-fab.k-fab-open,.k-ofi.k-ofi-open,.k-evbook.k-evbook-open')) return true;
    return !!(UI && UI.root && UI.root.over && UI.root.over.querySelector('.k-dim.k-on'));
  }
  function showNap() {
    NAP.play = 0;
    const c = nap.card; c.textContent = '';
    NAP.art = ART() && ART().komeNap ? ART().komeNap(128, 96) : null; if (NAP.art) c.appendChild(NAP.art.cv);
    const t = el('div', null, c); t.style.minWidth = '0';
    el('div', 't', t, 'O Kome tirou um cochilo.');
    el('div', 's', t, 'O arroz continua rendendo. Boa hora pra esticar as pernas e beber uma água; nada se perde.');
    const row = el('div', null, t); row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap';
    button(row, 'Valeu, Kome', 'gold', () => { try { A().onCochilo('aceito'); } catch (e) { /* */ } nap.close(); });
    button(row, 'Não mostrar mais', '', () => { setNapOpt(false); nap.close(); });
    nap.open(); sfx('yawn', { vol: 0.7 });
  }
  function setNapOpt(v) {
    if (G.S && G.S.opts) G.S.opts.cochilo = !!v;
    try { A().onSettings('cochilo', !!v); } catch (e) { /* */ }
    if (NAP.tg && NAP.tg.set) NAP.tg.set(!!v);
  }
  // linha nos Ajustes (sem mexer no game-ui.js: entra no painel exposto em G.HUD.settings, antes de "Salvar")
  function settingsRow() {
    if (NAP.tg || !G.HUD || !G.HUD.settings || !UI || !UI.toggle) return;
    const body = G.HUD.settings.body; if (!body) return;
    const tmp = document.createElement('div');
    NAP.tg = UI.toggle(tmp, { icon: 'clock', label: 'Cochilo do Kome', sub: 'depois de 1 h seguida, sugere uma pausa (nada para)', value: napOn(), onChange: v => setNapOpt(v) });
    const hs = Array.prototype.filter.call(body.querySelectorAll('.k-h'), h => /Salvar/.test(h.textContent));
    while (tmp.firstChild) body.insertBefore(tmp.firstChild, hs[0] || null);
  }

  /* ======================================================================
     8. EFEITOS: moedas e brilho (canvas por cima de tudo daqui)
     ====================================================================== */
  const parts = []; let fxRaf = 0;
  function burstAt(e, n) { const r = rectV(e); coinBurst(null, n, null, r.cx, r.cy, true); }
  function coinBurst(from, n, to, x, y, sparkOnly) {
    if (from) { const r = rectV(from); x = r.cx; y = r.cy; }
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, sp = 240 + Math.random() * 380;
      parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0, life: sparkOnly ? 0.6 + Math.random() * 0.3 : 1.25 + Math.random() * 0.35, to: to || null, coin: !sparkOnly || i % 3 === 0, r: 7 + Math.random() * 5, sp: Math.random() * TAU, d: Math.random() * 0.25 });
    }
    if (!fxRaf) { fxCv.parentNode || root.appendChild(fxCv); fxRaf = requestAnimationFrame(fxFrame); }
  }
  let fxLast = 0;
  function fxFrame(now) {
    const dt = fxLast ? Math.min(0.05, (now - fxLast) / 1000) : 0.016; fxLast = now;
    const g = fxCv.getContext('2d'), s = fxCv.width / innerWidth * k;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fxCv.width, fxCv.height); g.setTransform(s, 0, 0, s, 0, 0);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.t += dt;
      if (p.t >= p.life) { parts.splice(i, 1); continue; }
      if (p.to && p.t > 0.45 + p.d) {   // segunda metade: voa pra pílula do ¥
        const f = Math.min(1, (p.t - 0.45 - p.d) / Math.max(0.1, p.life - 0.45 - p.d)), e = f * f;
        p.x += (p.to.x - p.x) * Math.min(1, e * 0.5 + dt * 6); p.y += (p.to.y - p.y) * Math.min(1, e * 0.5 + dt * 6);
      } else { p.vy += 900 * dt; p.vx *= 1 - dt * 1.5; p.x += p.vx * dt; p.y += p.vy * dt; }
      const al = p.to ? 1 : 1 - p.t / p.life;
      if (ART() && ART().coin && p.coin) ART().coin(g, p.x, p.y, p.r, p.t * 9 + p.sp, al);
      else { g.globalAlpha = al; g.fillStyle = '#FFE16A'; g.fillRect(p.x - 2, p.y - 2, 4, 4); g.globalAlpha = 1; }
    }
    if (parts.length) fxRaf = requestAnimationFrame(fxFrame); else { fxRaf = 0; fxLast = 0; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, fxCv.width, fxCv.height); }
  }

  /* ======================================================================
     9. LAÇO, ABRIR/FECHAR, GANCHOS
     ====================================================================== */
  let built = false, last = 0;
  function openPatio() { if (!A().ready()) return false; heart.close(); patio.open(); sfx('whoosh', { vol: 0.5 }); return true; }
  function openHeart(tab) { if (tab) H.tab = tab; if (heart.isOpen) { renderHeart(); return true; } heart.open(); sfx('whoosh', { vol: 0.5 }); return true; }
  function refreshAll() { if (patio.isOpen) { buildRows(); tickPatio(true); } if (heart.isOpen) renderHeart(); }
  function loop(now) {
    const dt = last ? Math.min(0.5, (now - last) / 1000) : 0; last = now;
    try {
      chips(dt); napTick(dt);
      if (P.chainT > 0) P.chainT -= dt;
      if (patio.isOpen && (P.t -= dt) <= 0) { P.t = 0.25; tickPatio(); }
      if (!NAP.tg) settingsRow();
    } catch (e) { if (!loop.warned) { loop.warned = true; console.warn('[kome] cookie-ui', e); } }
    requestAnimationFrame(loop);
  }
  function build() {
    if (built) return; built = true;
    document.body.appendChild(root); fit(); addEventListener('resize', () => setTimeout(fit, 60));
    requestAnimationFrame(loop);
    // cartão de offline: um pouco depois do carregamento (deixa a cutscene/boas-vindas passarem)
    setTimeout(() => { try { showAway(); } catch (e) { console.warn('[kome] away', e); } }, DEMO ? 900 : 1800);
    if (/[?&]cochilo=1\b/.test(Q)) setTimeout(showNap, 4000);
  }
  Object.assign(CU, {
    openPatio, closePatio: () => patio.close(), openHeart, openSeeds, showAway, cochilo: force => (force || napOn() ? (showNap(), true) : false),
    close() { opened.slice().forEach(s => s.close()); if (T.panel) T.panel.close(); },
    isOpen: () => opened.length > 0, CFG, fit, seedTreeUI: () => T.tree,
    state: () => ({ patio: patio.isOpen, heart: heart.isOpen, away: away.isOpen, nap: nap.isOpen, napPlay: NAP.play, mult: P.mult }),
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(build, 0)); else setTimeout(build, 0);

  /* ======================================================================
     10. FALSOS (só com ?cookie=demo) — mesmo contrato do topo. Números da spec (custo 10 × 6,5^i em s de R0, rende 0,5 × 4,3^i),
         nomes e piadas da planilha (game/cookie-demo-data.js, carregado só aqui). O programador apaga esta seção.
     ====================================================================== */
  if (!DEMO) return;
  const s = document.createElement('script'); s.src = 'game/cookie-demo-data.js'; const go = () => (G.S && G.HUD && G.HUD.ready ? fakeStart() : setTimeout(go, 100));
  s.onload = go; s.onerror = go;
  document.head.appendChild(s);
  function fakeStart() {
    const DD = window.KOME_COOKIE_DEMO || { up: [], ach: [] };
    const R0 = 1e5, MILES = [1, 5, 25, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
    const IDS = ['pata', 'hashi', 'tigela', 'pa', 'duaspas', 'carrinho', 'britadeira', 'trator', 'empilhadeira', 'colheita', 'escav', 'caminhao', 'pacabo', 'bagger', 'tatus', 'komeohs', 'trembala', 'foguete', 'fuji', 'portal'];
    const NAMES = ['Turma da Pata', 'Brigada do Hashi', 'Clube da Tigela', 'Sindicato da Pá', 'Dupla Dinâmica', 'Esquadrilha do Carrinho', 'Banda da Britadeira', 'Comboio de Tratores', 'Balé das Empilhadeiras', 'Fila de Colheitadeiras', 'Escavadeiras Coreografadas', 'Caravana de Caminhões', 'Pás de Cabo no Horizonte', 'Frota Bagger', 'Frota de Tatuzões', 'Kome-Oh em Série', 'Trem-Bala de Arroz', 'Foguete de Mochi', 'Escavadeira do Monte Fuji', 'Portal Onigiri'];
    const N0 = { pata: 120, hashi: 64, tigela: 30, pa: 23, duaspas: 14, carrinho: 9, britadeira: 6, trator: 26, empilhadeira: 9, colheita: 4, escav: 2, caminhao: 1 };
    const F = { n: {}, marcos: {}, syn: {}, seeds: 140, sl: { renda: 4, preco: 2, ferr: 1, grana: 2, ajud: 1, ouro: 1, garagem: 1, desconto: 3, absurdo15: 1, absurdo16: 1, absurdo17: 1, sorte1: 2, cora1: 1 }, tig: 3, got: {}, recent: [] };
    IDS.forEach((id, i) => { F.n[id] = N0[id] | 0; F.marcos[id] = 0; while (F.marcos[id] < MILES.length && MILES[F.marcos[id]] <= F.n[id] && !(id === 'pa' && MILES[F.marcos[id]] === 25)) F.marcos[id]++; });
    const base = i => 10 * Math.pow(6.5, i) * R0, rend = i => 0.5 * Math.pow(4.3, i) * R0;
    const idx = id => IDS.indexOf(id);
    const absurdOpen = id => { const i = idx(id); return i < 14 || F.sl['absurdo' + (i + 1)] > 0; };
    const mileName = (id, at) => { const r = DD.up.find(u => u[0] === 'm_' + id + '_' + at); return r ? { name: r[1], desc: r[2] } : { name: 'Marco ' + at, desc: 'Mais ' + at + ' e a turma inteira dobra. A física pede desculpas.' }; };
    const mult = id => Math.pow(2, F.marcos[id]) * synMult(id);
    const synList = DD.up.filter(u => u[6] === 'mult_par' || u[6] === 'sinergia');
    function synMult(id) { let m = 1; for (const u of synList) if (F.syn[u[0]]) { const [a, b] = u[3].split('+'); if (u[6] === 'mult_par' && (a === id || b === id)) m *= u[7]; else if (u[6] === 'sinergia' && b === id) m *= 1 + u[7] * F.n[a]; } return m; }
    const money = () => G.S.money, pay = c => { G.S.money -= c; };
    const priceK = (id, kq) => { const i = idx(id), q = F.n[id]; return base(i) * Math.pow(0.99, F.sl.desconto | 0) * Math.pow(1.15, q) * (Math.pow(1.15, kq) - 1) / 0.15; };
    const maxBuy = id => { const i = idx(id), b = base(i) * Math.pow(0.99, F.sl.desconto | 0) * Math.pow(1.15, F.n[id]); return Math.max(0, Math.floor(Math.log(money() * 0.15 / b + 1) / Math.log(1.15))); };
    // conquistas: ~1/3 pegas (sorteio fixo), as de turma conforme a quantidade
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ACH = DD.ach.map(a => ({ id: a[0], name: a[1], desc: a[2], fam: a[3], icon: a[4], secret: !!a[5], hint: a[5] ? a[2] : null }));
    ACH.forEach(c => { if (rnd() < (c.secret ? 0.15 : 0.36)) F.got[c.id] = 1; });
    F.recent = ACH.filter(c => F.got[c.id]).slice(-4).map(c => c.id).reverse();
    const TIG = DD.up.filter(u => /^tigela_coracao_/.test(u[0]));
    // árvore nova: 6 da viagem (D.SEEDS de hoje) + 34 nós (camada-cookie.md, "Árvore de Sementes maior")
    const BR = {
      viagem: { name: 'Viagem', color: '#7DB34A', icon: 'boat' }, patio: { name: 'Pátio', color: '#E8913A', icon: 'paw' },
      sorte: { name: 'Sorte', color: '#E48FA5', icon: 'bolt' }, coracao: { name: 'Coração', color: '#D8574E', icon: 'star' },
      poupanca: { name: 'Poupança', color: '#5B9BD5', icon: 'clock' }, absurdo: { name: 'Absurdo', color: '#E3BC62', icon: 'drill' },
    };
    const NODES = [
      // viagem (os 6 de hoje), pra cima
      ['renda', 'Arroz Abençoado', '+15% de renda por nível', 'viagem', 0, -1.4, [], 0, 'yen', 2, 20], ['preco', 'Amigo do Corretor', '-6% em todos os preços por nível', 'viagem', -0.9, -2.3, ['renda'], 0, 'yen', 3, 8],
      ['ferr', 'Mala de Viagem', 'começa a ilha com Pá → Carrinho → Trator', 'viagem', 0.9, -2.3, ['renda'], 1, 'chest', 6, 3], ['grana', 'Poupança', 'começa a ilha com ¥1 mil, 10 mil, 100 mil…', 'viagem', -1.4, -3.3, ['preco'], 0, 'sack', 1, 5],
      ['ajud', 'Turma do Kome', '+1 shiba ajudante desde o minuto 1', 'viagem', 0, -3.4, ['preco', 'ferr'], 0, 'hat', 4, 3], ['ouro', 'Faro de Ouro', '+25% nos bolsões dourados por nível', 'viagem', 1.4, -3.3, ['ferr'], 0, 'star', 2, 8],
      // pátio, pra direita
      ['garagem', 'Garagem Abençoada', 'começa a corrida com 5 de cada turma de mão', 'patio', 1.4, -0.4, [], 1, 'house', 4, 1], ['desconto', 'Desconto de Frota', '-1% no preço das turmas por nível', 'patio', 2.4, -1.1, ['garagem'], 0, 'yen', 3, 25],
      ['maxbuy', 'Compra no Atacado', 'botão ×máx desde o primeiro minuto', 'patio', 2.4, 0.3, ['garagem'], 0, 'sack', 2, 1], ['marco3', 'Marco Turbinado', 'os marcos de 1 e de 5 viram ×3', 'patio', 3.4, -0.4, ['desconto', 'maxbuy'], 2, 'bolt', 20, 1],
      ['sindicato', 'Shiba Sindicalizado', '+0,5% de renda a cada 10 unidades no total', 'patio', 3.3, -1.8, ['desconto'], 0, 'hat', 8, 10], ['vizinha', 'Boa Vizinhança', 'sinergias pedem 10 em vez de 15', 'patio', 3.3, 1.0, ['maxbuy'], 1, 'swap', 12, 1],
      ['frotaf', 'Frota Fiel', 'a turma mais numerosa rende +25%', 'patio', 4.4, 0.3, ['marco3', 'vizinha'], 0, 'trophy', 15, 4],
      // sorte, pra baixo à direita
      ['sorte1', 'Faro Dourado', 'eventos dourados 10% mais frequentes por nível', 'sorte', 1.0, 1.3, [], 0, 'bolt', 3, 10], ['brilho', 'Brilho Longo', 'a coisa dourada fica +2 s na tela', 'sorte', 1.9, 2.1, ['sorte1'], 0, 'clock', 2, 5],
      ['receitas', 'Livro de Receitas', 'abre a Tempestade e o Desfile', 'sorte', 0.9, 2.5, ['sorte1'], 1, 'book', 6, 1], ['mochila', 'Mochila Maior', 'a Mochila do Tatuzão guarda +1 evento', 'sorte', 1.7, 3.3, ['receitas', 'brilho'], 0, 'chest', 5, 3],
      ['frenesi', 'Café Extra', 'Frenesi dura +10 s por nível', 'sorte', 2.8, 2.6, ['brilho'], 0, 'bolt', 7, 3],
      // coração, pra baixo à esquerda
      ['cora1', 'Pote Fundo', '+0,1% por conquista por nível', 'coracao', -1.0, 1.3, [], 0, 'star', 4, 10], ['lupa', 'Lupa de Segredos', 'conquistas secretas ganham dica', 'coracao', -0.9, 2.5, ['cora1'], 1, 'book', 3, 1],
      ['album', 'Álbum de Família', 'cada família completa da galeria dá +5%', 'coracao', -1.9, 2.1, ['cora1'], 0, 'trophy', 9, 1], ['tigelaf', 'Tigela Achada', 'a 1ª Tigela do Coração sai de graça', 'coracao', -1.7, 3.3, ['lupa', 'album'], 1, 'star', 10, 1],
      // poupança, pra esquerda
      ['cochilo', 'Cochilo Produtivo', 'offline rende 50% → +10% por nível, até 100%', 'poupanca', -1.4, -0.4, [], 0, 'clock', 2, 5], ['cama', 'Cama Grande', 'teto offline +4 h por nível, até 24 h', 'poupanca', -2.4, -1.1, ['cochilo'], 0, 'house', 3, 4],
      ['juros', 'Juros de Arroz', '+1% do dinheiro parado por minuto offline (teto 1 h de renda)', 'poupanca', -2.4, 0.3, ['cochilo'], 0, 'yen', 5, 5], ['cofre', 'Cofre do Tanuki', 'viajar guarda 1% do dinheiro como sementes extras', 'poupanca', -3.4, -0.4, ['cama', 'juros'], 1, 'chest', 18, 1],
      ['fabricaoff', 'Turno da Noite', 'a fábrica trabalha offline com receita nova', 'poupanca', -3.3, 1.0, ['juros'], 0, 'factory', 8, 3],
      // absurdo: cadeia de máquinas, em arco no alto à direita
      ['absurdo15', 'Frota de Tatuzões', 'destrava a turma 15: tatuzões cavando em fila indiana', 'absurdo', 2.6, -2.6, ['ouro', 'desconto'], 2, 'drill', 25, 1, 1],
      ['absurdo16', 'Kome-Oh em Série', 'destrava a turma 16: robôs gigantes de linha de montagem', 'absurdo', 3.6, -3.3, ['absurdo15'], 2, 'gear', 75, 1, 1],
      ['absurdo17', 'Trem-Bala de Arroz', 'destrava a turma 17: 300 km/h de arroz', 'absurdo', 4.7, -2.8, ['absurdo16'], 2, 'bolt', 200, 1, 1],
      ['absurdo18', 'Foguete de Mochi', 'destrava a turma 18: o arroz vai pro espaço', 'absurdo', 5.5, -1.8, ['absurdo17'], 2, 'star', 500, 1, 1],
      ['absurdo19', 'Escavadeira do Monte Fuji', 'destrava a turma 19: a montanha vira pá', 'absurdo', 5.9, -0.5, ['absurdo18'], 2, 'mount', 1200, 1, 1],
      ['absurdo20', 'Portal Onigiri', 'destrava a turma 20: onigiri de outra dimensão', 'absurdo', 5.7, 0.9, ['absurdo19'], 2, 'chest', 3000, 1, 1],
      ['horizonte', 'Horizonte Lotado', 'cada máquina absurda dá +10% em todas as turmas', 'absurdo', 4.7, -1.4, ['absurdo17'], 1, 'mount', 150, 1],
      ['ensaio', 'Ensaio Geral', 'máquina absurda nova chega com 1 unidade', 'absurdo', 4.6, 1.5, ['absurdo19', 'frotaf'], 0, 'horn', 400, 1],
      ['pertinho', 'Pertinho do Céu', 'turmas absurdas -5% de preço por nível', 'absurdo', 4.4, -4.1, ['absurdo16'], 0, 'yen', 60, 10],
      ['saudade', 'Saudade do Começo', 'Pata e Hashi rendem +1% por máquina absurda que você tem', 'absurdo', 1.8, -3.9, ['absurdo15'], 0, 'paw', 40, 1],
    ];
    const TREE = { branches: BR, nodes: NODES.map(r => ({ id: r[0], n: r[1], desc: r[2], branch: r[3], pos: { x: r[4], y: r[5] }, req: r[6], size: r[7], icon: r[8], base: r[9], max: r[10], absurd: !!r[11] })) };
    const nodeBy = {}; TREE.nodes.forEach(n => { nodeBy[n.id] = n; });
    const seedCost = id => { const n = nodeBy[id]; if (!n) return Infinity; const L = F.sl[id] | 0; if (n.max && L >= n.max) return Infinity; return Math.ceil(n.base * Math.pow(1.45, L)); };
    const awayCap = /[?&]away=cap\b/.test(Q);
    let awayOn = true;
    G.S.money = Math.max(G.S.money, 4e13); G.S.ended = true; if (G.S.stats) G.S.stats.tipDone = 1;
    if (G.PatioArt) { const sp = []; for (const id of IDS) if (F.n[id] && idx(id) < 14) sp.push(id + ':' + F.n[id]); G.PatioArt.fake(sp.join(',')); }
    CU.use({
      ready: () => true,
      patio: () => IDS.filter((id, i) => i < 14 || absurdOpen(id) || i === 14 + Object.keys(F.sl).filter(k => /^absurdo/.test(k) && F.sl[k]).length).map(id => {
        const i = idx(id), open = absurdOpen(id);
        return { id, name: NAMES[i], n: F.n[id], rate: F.n[id] * rend(i) * mult(id), absurd: i >= 14, locked: !open, lockTxt: open ? '' : 'nó "' + (nodeBy['absurdo' + (i + 1)] || {}).n + '" na Árvore de Sementes' };
      }),
      total: () => { let r = 0, n = 0; IDS.forEach((id, i) => { r += F.n[id] * rend(i) * mult(id); n += F.n[id]; }); return { rate: r, n }; },
      price: priceK, maxBuy,
      buy(id, kq) { if (!absurdOpen(id)) return 0; let got = 0; while (got < kq) { const c = priceK(id, 1); if (money() < c) break; pay(c); F.n[id]++; got++; } if (got && G.PatioArt && idx(id) < 14) G.PatioArt.fake('+' + got + id); return got; },
      marco(id) {
        const k2 = F.marcos[id]; if (k2 >= MILES.length) return null; const at = MILES[k2], i = idx(id), nm = mileName(id, at);
        return { at, prev: k2 ? { at: MILES[k2 - 1] } : null, name: nm.name, desc: nm.desc, mult: 2, price: base(i) * [10, 50, 500, 5e4, 5e6, 5e8, 5e10, 5e12, 5e14, 5e16, 5e18, 5e20, 5e22][k2], ready: F.n[id] >= at };
      },
      buyMarco(id) { const m = this.marco(id); if (!m || !m.ready || money() < m.price) return false; pay(m.price); F.marcos[id]++; return true; },
      sinergias(id) {
        const out = [];
        for (const u of synList) {
          const [a, b] = u[3].split('+'); if (a !== id && b !== id) continue;
          const other = a === id ? b : a, have = Math.min(F.n[a], F.n[b]), need = u[5];
          const st = F.syn[u[0]] ? 'on' : have >= need ? 'ready' : 'need';
          out.push({ id: u[0], other, otherName: NAMES[idx(other)].split(' ').pop(), name: u[1], desc: u[2], mult: u[6] === 'mult_par' ? u[7] : 1 + u[7], state: st, have, need, price: u[8] * Math.max(base(idx(a)), base(idx(b))) });
        }
        return out;
      },
      buySinergia(sid) { const s = this.sinergias(sid.split('_')[1]).find(x => x.id === sid); if (!s || s.state !== 'ready' || money() < s.price) return false; pay(s.price); F.syn[sid] = 1; return true; },
      coracao() {
        const n = Object.keys(F.got).length, per = 0.01 * (1 + F.tig), nx = TIG[F.tig];
        return { n, total: ACH.length, per, bonus: n * per, next: nx ? { need: nx[5], name: nx[1] } : null, recent: F.recent };
      },
      conquistas: () => ACH.map(c => Object.assign({}, c, { got: !!F.got[c.id], hint: c.secret && (F.sl.lupa > 0 || true) ? c.hint : null })),
      tigelas: () => { const n = Object.keys(F.got).length; return TIG.map((u, i) => ({ id: u[0], name: u[1], desc: u[2], need: u[5], price: u[8] * R0, owned: i < F.tig, can: i === F.tig && n >= u[5] })); },
      buyTigela(i) { const t = this.tigelas()[i]; if (!t || !t.can || money() < t.price) return false; pay(t.price); F.tig++; return true; },
      seeds: () => F.seeds, seedTree: () => TREE, seedLevel: id => F.sl[id] | 0, seedCost,
      buySeed(id) { const c = seedCost(id), n = nodeBy[id]; if (!n || F.seeds < c) return false; if (n.req.some(r => !(F.sl[r] > 0))) return false; F.seeds -= c; F.sl[id] = (F.sl[id] | 0) + 1; return true; },
      away: () => (awayOn ? { sec: awayCap ? 8 * 3600 : 3 * 3600 + 12 * 60, capSec: 8 * 3600, capped: awayCap, total: 8.4e14, rows: [
        { icon: 'paw', label: 'A frota do Pátio cavou', value: 7.9e14 }, { icon: 'factory', label: 'A fábrica terminou 40 onigiris', value: 4.1e13 },
        { icon: 'sack', label: 'Sacos que caíram no coletor', value: 9.2e12 }, { icon: 'trophy', label: 'Conquistas novas', txt: '2' }] } : null),
      claimAway() { awayOn = false; G.S.money += 8.4e14; },
      partir: () => ({ ok: true, patio: 24, island: 22, later: 50, laterMin: 20 }),
    });
    G.CookieUI.fake = F;
  }
})();
