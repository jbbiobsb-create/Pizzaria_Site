/* ============================================================================
   Pixxel v1.0 — sim.js
   E.Sim: sistemas que rodam por TEMPO, separados do desenho. Base pra ganho offline, fábrica e cidade
   funcionarem fora da tela, e pra simuladores de balanço rodarem rápido em headless.
     const sim = E.Sim();
     sim.add('fabrica', { tick(dt) {...}, offline(dt) { ...; return { yen: 10 } } });
     sim.tick(dt)                 -> chama tick(dt) de todos (no loop do jogo)
     sim.catchUp(secs, {maxStep}) -> tempo fora: chama offline(dt) em passos de até maxStep s (padrão 60),
                                     soma os números que cada sistema devolve -> { fabrica: { yen: 600 }, ... }
     sim.list()                   -> ids registrados
   Sistema sem offline() simplesmente não anda enquanto o jogo está fechado (nada estraga quando você sai).
   Depende de: core.js
   ============================================================================ */
(function () {
  'use strict';
  const E = (window.Pixxel = window.Pixxel || {});
  function Sim() {
    const list = [];
    const merge = (into, r) => { for (const k in r) if (typeof r[k] === 'number') into[k] = (into[k] || 0) + r[k]; };
    const sim = {
      add(id, sys) { const i = list.findIndex(s => s.id === id); const s = Object.assign({ id }, sys); if (i >= 0) list[i] = s; else list.push(s); return sim; },
      get: id => list.find(s => s.id === id) || null,
      list: () => list.map(s => s.id),
      tick(dt) { for (let i = 0; i < list.length; i++) { const s = list[i]; if (s.tick) { try { s.tick(dt); } catch (e) { console.warn('[pixxel] sim ' + s.id, e); } } } },
      catchUp(secs, o) {
        const max = (o && o.maxStep) || 60, out = {};
        let left = Math.max(0, +secs || 0);
        while (left > 0) {
          const d = Math.min(max, left); left -= d;
          for (const s of list) if (s.offline) { try { const r = s.offline(d); if (r) merge(out[s.id] || (out[s.id] = {}), r); } catch (e) { console.warn('[pixxel] sim offline ' + s.id, e); } }
        }
        return out;
      },
    };
    return sim;
  }
  E.Sim = Sim;
})();
