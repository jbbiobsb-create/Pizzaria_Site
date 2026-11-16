#!/usr/bin/env node
/* Kome tools: receita pra conteúdo novo. Cria a ficha já no formato certo, monta o game/content.js e diz o que editar.
   uso: node tools/novo.js <enfeite|bicho|roupa|evento|loja> "Nome bonito" [--desc "texto"] [--preco 80]
   Depois: troque o desenho (pixel em texto) no arquivo criado e rode `node tools/content.js` + `node tools/galeria.js`. */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const a = process.argv.slice(2), val = (k, d) => (a.includes(k) ? a[a.indexOf(k) + 1] : d);
const tipo = a[0], nome = a[1];
const TIPOS = ['enfeite', 'bicho', 'roupa', 'evento', 'loja'];
if (!TIPOS.includes(tipo) || !nome) { console.log('uso: node tools/novo.js <' + TIPOS.join('|') + '> "Nome" [--desc "..."] [--preco N]'); process.exit(2); }
const id = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const desc = val('--desc', 'descreva aqui'), preco = +val('--preco', tipo === 'bicho' ? 120 : 60);
const MOLDES = {
  enfeite: `ficha({
  tipo: 'enfeite', id: '${id}', nome: '${nome}', desc: '${desc}',
  preco: ${preco}, onde: { x: 0.5, y: 10 }, escala: 2,
  desenho: \`
    ...KKKK...
    ..KkkkkK..
    ..KkYYkK..
    ..KkkkkK..
    ....kk....
    ....kk....
  \`,
});
`,
  bicho: `ficha({
  tipo: 'bicho', id: '${id}', nome: '${nome}', desc: '${desc}',
  preco: ${preco}, onde: { x: 0.6, y: 30 }, escala: 2,
  desenho: \`
    .EE....EE.
    EEEEEEEEEE
    EENEEEENEE
    .EEEnnEEE.
    ..EEEEEE..
    ..e....e..
  \`,
});
`,
  roupa: `ficha({
  tipo: 'roupa', id: '${id}', nome: '${nome}', desc: '${desc}',
  onde: { x: 0, y: -10 }, escala: 1,      // x/y a partir do centro da cabeça (y negativo = pra cima)
  desenho: \`
    ..RRRR..
    .RRRRRR.
    RRRRRRRR
  \`,
});
`,
  evento: `ficha({
  tipo: 'evento', id: '${id}', nome: '${nome}', sub: '${desc}',
  dur: 30, mult: 2, icone: 'star',          // dura 30 s, renda ×2
});
`,
  loja: `ficha({
  tipo: 'loja', id: '${id}', nome: '${nome}', desc: '${desc}',
  k: 'sell', r: 0.05,                       // sell = renda, val = valor do arroz, gold = bolsões; r = bônus por nível
});
`,
};
const dir = path.resolve(__dirname, '..', 'conteudo'); fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, tipo + '-' + id + '.js');
if (fs.existsSync(file)) { console.log('já existe: ' + path.relative(process.cwd(), file)); process.exit(1); }
fs.writeFileSync(file, MOLDES[tipo]);
cp.execFileSync(process.execPath, [path.join(__dirname, 'content.js')], { stdio: 'inherit' });
console.log('criado: ' + path.relative(process.cwd(), file) + '  (troque o desenho; cores no topo de tools/content.js)');
