#!/usr/bin/env node
/* Kome tools: gera o jogo num HTML só (scripts, CSS e ícone embutidos), pra mandar pro celular / abrir em qualquer lugar.
   uso: node tools/single.js [saida.html] [--in outra.html] [--dev = painel de admin ligado]   (padrão: "Kome no Japão (celular).html" na raiz do projeto)
   Tira o service worker e o manifest (não funcionam fora de um servidor). O save fica no navegador de quem abrir. */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2), flag = k => args.includes(k), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const out = args.find((x, i) => !x.startsWith('--') && args[i - 1] !== '--in') || path.join(ROOT, 'Kome no Japão (celular).html');
let html = fs.readFileSync(path.join(ROOT, opt('--in', 'index.html')), 'utf8');
if (flag('--dev')) html = html.replace('<head>', '<head>\n<script>window.KOME_DEV = 1;</script>');   // HTML de admin: painel de desenvolvedor ligado
const read = p => fs.readFileSync(path.join(ROOT, p.split('?')[0]), 'utf8').replace(/^﻿/, '');
let nCss = 0, nJs = 0;
html = html.replace(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>|<link[^>]+href=["']([^"']+)["'][^>]*rel=["']stylesheet["'][^>]*>/g, (m, a, b) => {
  const p = a || b; if (/^https?:/.test(p)) return m; nCss++; return '<style>\n' + read(p) + '\n</style>';
});
html = html.replace(/<script\s+src=["']([^"']+)["']\s*><\/script>/g, (m, p) => {
  if (/^https?:/.test(p)) return m; nJs++; return '<script>\n' + read(p).replace(/<\/script/gi, '<\\/script') + '\n</script>';
});
html = html.replace(/<script>[^<]*serviceWorker[^<]*<\/script>/g, '');
html = html.replace(/<link[^>]+rel=["']manifest["'][^>]*>/g, '');
const icon = path.join(ROOT, 'icon-192.png');
if (fs.existsSync(icon)) {
  const data = 'data:image/png;base64,' + fs.readFileSync(icon).toString('base64');
  html = html.replace(/<link[^>]+rel=["'](?:icon|apple-touch-icon)["'][^>]*>/g, '');
  html = html.replace('</head>', '<link rel="icon" href="' + data + '">\n<link rel="apple-touch-icon" href="' + data + '">\n</head>');
}
const left = (html.match(/<script\s+src=|rel=["']stylesheet["']/g) || []).length;
fs.writeFileSync(out, html);
console.log('ok: ' + out + ' · ' + nJs + ' scripts, ' + nCss + ' css embutidos · ' + Math.round(html.length / 1024) + ' KB' + (left ? ' · ATENÇÃO: ' + left + ' externos sobraram' : ''));
