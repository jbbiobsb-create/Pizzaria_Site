#!/usr/bin/env node
/* Kome tools: PLANILHA DA CAMADA COOKIE -> game/cookie-data.js (G.Data.COOKIE)
   Lê todos os conteudo/cookie*.csv (separador ; ou ,; cabeçalho na 1ª linha, formato do docs/design/camada-cookie-exemplo.csv):
     tipo;id;nome;desc;maquina;condicao;alvo;efeito;valor;preco;peso;duracao;icone
   tipo upgrade | conquista | evento | nome (nome de número: coluna nome, na ordem) | noticia (Rádio Arroz FM, depois)
   Valida e avisa (id repetido, máquina que não existe, efeito desconhecido). Uso: node tools/cookie.js */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'conteudo');
const files = fs.readdirSync(DIR).filter(f => /^cookie.*\.csv$/i.test(f)).sort();
if (!files.length) { console.log('nenhum conteudo/cookie*.csv'); process.exit(0); }
const MAQ = ['pata', 'hashi', 'tigela', 'pa', 'duaspas', 'carrinho', 'britadeira', 'trator', 'empilhadeira', 'colheita', 'escav', 'caminhao', 'pacabo', 'bagger'];
const EF = ['mult_maquina', 'sinergia', 'coracao', 'frenesi', 'chuva', 'gigante', 'desfile', 'tempestade', 'festival', ''];
const num = v => (v === '' || v === undefined ? undefined : isNaN(+v) ? v : +v);
const out = { up: [], ach: [], ev: [], nomes: [], noticias: [] }, ids = {}, warn = [];
for (const f of files) {
  const txt = fs.readFileSync(path.join(DIR, f), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
  const lines = txt.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  const sep = (lines[0].match(/;/g) || []).length >= (lines[0].match(/,/g) || []).length ? ';' : ',';
  const cells = line => { const o = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === sep && !q) { o.push(cur); cur = ''; } else cur += c; } o.push(cur); return o.map(x => x.trim()); };
  const head = cells(lines[0]).map(h => h.toLowerCase());
  lines.slice(1).forEach((line, li) => {
    const c = cells(line), r = {}; head.forEach((h, i) => { r[h] = c[i] || ''; });
    const where = f + ':' + (li + 2);
    if (r.id && ids[r.id]) warn.push(where + ' id repetido: ' + r.id); if (r.id) ids[r.id] = 1;
    for (const m of (r.maquina || '').split('+').filter(Boolean)) if (m !== 'todas' && MAQ.indexOf(m) < 0) warn.push(where + ' máquina desconhecida: ' + m);
    if (r.efeito && EF.indexOf(r.efeito) < 0) warn.push(where + ' efeito desconhecido: ' + r.efeito);
    const o = { id: r.id, n: r.nome, d: r.desc, maq: r.maquina || '', cond: r.condicao || '', alvo: num(r.alvo), ef: r.efeito || '', v: num(r.valor), preco: num(r.preco), peso: num(r.peso), dur: num(r.duracao), icon: r.icone || 'star' };
    if (r.tipo === 'upgrade') out.up.push(o); else if (r.tipo === 'conquista') out.ach.push(o); else if (r.tipo === 'evento') out.ev.push(o);
    else if (r.tipo === 'nome') out.nomes.push(r.nome); else if (r.tipo === 'noticia') out.noticias.push(o);
    else if (r.tipo) warn.push(where + ' tipo desconhecido: ' + r.tipo);
  });
}
const js = '/* GERADO por tools/cookie.js a partir de conteudo/cookie*.csv. NÃO editar à mão. */\n(function () {\n  const G = (window.KomeGame = window.KomeGame || {});\n  G.Data = G.Data || {};\n  G.Data.COOKIE = ' + JSON.stringify(out) + ';\n})();\n';
fs.writeFileSync(path.join(ROOT, 'game', 'cookie-data.js'), js);
console.log('cookie: ' + out.up.length + ' upgrades · ' + out.ach.length + ' conquistas · ' + out.ev.length + ' eventos · ' + out.nomes.length + ' nomes de número · ' + files.join(', '));
warn.forEach(w => console.log('  AVISO ' + w));
