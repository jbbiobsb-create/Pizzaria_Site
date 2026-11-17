#!/usr/bin/env node
/* Kome tools: gera o bundle pixxel.js (na raiz do projeto) concatenando engine/*.js na ordem certa,
   e copia engine/pixxel.css pra raiz. Uso: node tools/build.js
   Um projeto novo só precisa de <link href="pixxel.css"> + <script src="pixxel.js">. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), ENG = path.join(ROOT, 'engine');
const ORDER = ['core', 'pix', 'assets', 'shiba', 'fx', 'terrain', 'rig', 'audio', 'nature', 'ui'];
const extra = fs.readdirSync(ENG).filter(f => f.endsWith('.js') && ORDER.indexOf(f.slice(0, -3)) < 0).map(f => f.slice(0, -3)).sort();
const files = ORDER.concat(extra).filter(n => fs.existsSync(path.join(ENG, n + '.js')));
const stamp = new Date().toISOString().slice(0, 10);
let out = '/* Pixxel — bundle gerado por tools/build.js em ' + stamp + '. Não edite aqui: edite engine/*.js e rode o build.\n   Módulos: ' + files.join(', ') + ' */\n';
for (const n of files) out += '\n/* ===== engine/' + n + '.js ===== */\n' + fs.readFileSync(path.join(ENG, n + '.js'), 'utf8').replace(/^﻿/, '') + '\n';
fs.writeFileSync(path.join(ROOT, 'pixxel.js'), out);
fs.copyFileSync(path.join(ENG, 'pixxel.css'), path.join(ROOT, 'pixxel.css'));
console.log('pixxel.js: ' + files.length + ' módulos, ' + Math.round(out.length / 1024) + ' KB · pixxel.css copiado');
