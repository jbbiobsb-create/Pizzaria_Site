#!/usr/bin/env node
/* Kome tools: CONTEÚDO EM MASSA. Transforma uma planilha (CSV, ; ou , como separador) em fichas de conteudo/ e já gera a arte.
   O designer (ou o Elias) faz a tabela no navegador/Excel; um comando põe 50 coisas no jogo.
   uso: node tools/planilha.js conteudo.csv [--sem-arte] [--substituir]
   Colunas (cabeçalho na 1ª linha; só tipo e nome são obrigatórias):
     tipo     enfeite | bicho | roupa | evento | loja | estrutura
     id       (opcional; sai do nome)
     nome, desc
     preco    enfeite/bicho: segundos de renda
     x, y     onde fica (enfeite/bicho: x 0..1 no quintal, y px; roupa: px a partir da cabeça)
     escala
     receita  arte gerada: "gerador=bicho; especie=gato; acessorio=laco; cores.pelo=#E8893A"
     desenho  pixel em texto (linhas separadas por |), ex.: "..RR..|.RYYR.|..RR.."
     dur, mult, icone, sub   (evento)      k, r   (loja)      ilha   (roupa)
   Exemplo de linha: bicho;gato_laranja;Gato Laranja;dorme no sol;90;0.35;34;2;gerador=bicho; especie=gato; acessorio=laco */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const a = process.argv.slice(2), file = a.find(x => !x.startsWith('--'));
if (!file) { console.log('uso: node tools/planilha.js arquivo.csv [--sem-arte] [--substituir]'); process.exit(2); }
const txt = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n').trim();
const sep = (txt.split('\n')[0].match(/;/g) || []).length >= (txt.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
// separa respeitando aspas
function cells(line) { const o = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const c = line[i]; if (c === '"') { if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (c === sep && !q) { o.push(cur); cur = ''; } else cur += c; } o.push(cur); return o.map(s => s.trim()); }
const lines = txt.split('\n').filter(l => l.trim()), head = cells(lines[0]).map(h => h.toLowerCase());
const slug = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const num = v => (v === '' || v === undefined || isNaN(+v) ? undefined : +v);
function receita(s) {   // "gerador=bicho; especie=gato; cores.pelo=#E8893A" -> objeto
  if (!s) return undefined; const o = {};
  for (const part of s.split(/;|\n/)) { const m = part.split('='); if (m.length < 2) continue; const k = m[0].trim(), v0 = m.slice(1).join('=').trim(), v = v0 === 'true' ? true : v0 === 'false' ? false : (num(v0) !== undefined ? num(v0) : v0);
    const ks = k.split('.'); let t = o; ks.slice(0, -1).forEach(x => { t = t[x] = t[x] || {}; }); t[ks[ks.length - 1]] = v; }
  return o;
}
const DIR = path.resolve(__dirname, '..', 'conteudo'); fs.mkdirSync(DIR, { recursive: true });
let n = 0, skip = 0, rec = 0;
for (const line of lines.slice(1)) {
  const c = cells(line), r = {}; head.forEach((h, i) => { r[h] = c[i] || ''; });
  // receita na ÚLTIMA coluna com ; dentro (mesmo separador do CSV): junta o resto da linha nela
  if (head[head.length - 1] === 'receita' && c.length > head.length) r.receita = c.slice(head.length - 1).join(';');
  if (!r.tipo || !r.nome) continue;
  const id = slug(r.id || r.nome), f = { tipo: r.tipo, id, nome: r.nome };
  if (r.desc) f.desc = r.desc;
  if (num(r.preco) !== undefined) f.preco = num(r.preco);
  if (r.x !== '' || r.y !== '') f.onde = { x: num(r.x) !== undefined ? num(r.x) : 0.5, y: num(r.y) || 0 };
  if (num(r.escala) !== undefined) f.escala = num(r.escala);
  if (r.receita) { f.receita = receita(r.receita); rec++; }
  for (const k of ['dur', 'mult', 'r', 'ilha']) if (num(r[k]) !== undefined) f[k] = num(r[k]);
  for (const k of ['icone', 'sub', 'k']) if (r[k]) f[k] = r[k];
  let body = 'ficha(' + JSON.stringify(f, null, 2).replace(/\n}$/, '');
  if (r.desenho) body += ',\n  "desenho": `\n' + r.desenho.split('|').map(l => '    ' + l.trim()).join('\n') + '\n  `';
  body += '\n});\n';
  const out = path.join(DIR, r.tipo + '-' + id + '.js');
  if (fs.existsSync(out) && !a.includes('--substituir')) { skip++; continue; }
  fs.writeFileSync(out, '/* da planilha ' + path.basename(file) + ' */\n' + body); n++;
}
console.log('planilha: ' + n + ' fichas criadas' + (skip ? ', ' + skip + ' já existiam (use --substituir)' : '') + ', ' + rec + ' com receita de arte');
cp.execFileSync(process.execPath, [path.join(__dirname, a.includes('--sem-arte') || !rec ? 'content.js' : 'arte.js'), ...(a.includes('--sem-arte') || !rec ? [] : ['--galeria'])], { stdio: 'inherit' });
