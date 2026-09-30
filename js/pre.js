// Roda antes do primeiro paint (script síncrono no <head>, ~300 bytes): lê o cache do cardápio e marca
// <html class="tem-faixa"> quando a faixa "fechado / fechamos em breve" vai aparecer, para o CSS reservar a
// altura dela (--faixa-h) e a página não pular quando js/ui.js a desenha. Sem cache, nada acontece.
(function () {
  // home: o bloco "Pedir de novo" (antes do hero) já aparece com skeleton quando há pedido salvo neste aparelho
  try { if (localStorage.getItem('ses_ultimo_pedido')) document.documentElement.classList.add('tem-repetir'); } catch (e) {}
  try {
    var c = JSON.parse(localStorage.getItem('ses_cardapio_cache') || 'null');
    var d = c && c.dados; if (!d || !d.config) return;
    var faixa = !d.aberta;
    if (!faixa) {
      var h = (d.config.horario || {})[['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][new Date().getDay()]];
      if (h && h[1]) { var p = h[1].split(':'); var f = new Date(); f.setHours(+p[0], +p[1], 0, 0); var min = (f - Date.now()) / 60000; faixa = min > 0 && min < 60; }
    }
    if (faixa) document.documentElement.classList.add('tem-faixa');
  } catch (e) {}
})();
