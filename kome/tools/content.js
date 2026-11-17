#!/usr/bin/env node
/* Kome tools: junta as fichas de conteudo/*.js num arquivo só (game/content.js), que o jogo carrega.
   uso: node tools/content.js        (rode depois de criar/editar uma ficha; o novo.js já roda sozinho)

   FICHA (um arquivo por coisa, em conteudo/<tipo>-<id>.js):
     ficha({
       tipo: 'enfeite' | 'bicho' | 'roupa' | 'evento' | 'loja',
       id: 'lanterna_papel', nome: 'Lanterna de papel', desc: 'texto curto',
       preco: 60,                 // enfeite/bicho: segundos de renda (vira ¥ sozinho)
       onde: { x: 0.3, y: 10 },   // enfeite/bicho: x = 0..1 da largura do quintal, y = px abaixo do chão (+ = mais pra frente)
                                  // roupa: x/y em px a partir do centro da cabeça do Kome (x + = pra frente, y - = pra cima)
       escala: 2,                 // tamanho do pixel (enfeite 2, roupa 1)
       desenho: `
         ..RRRR..
         .RYYYYR.
       `,                         // pixel em texto: letras = cores (abaixo); '.' = vazio. Contorno e 3 tons são automáticos.
       // evento: dur (s), mult (×renda), icone ('star'|'clock'|'rice'...), sub (texto do aviso)
       // loja: k ('sell' renda | 'val' valor do arroz | 'gold' bolsões), r (bônus por nível, ex.: 0.06)
       // roupa: ilha (0..4) = só aparece enterrada naquela ilha
     });

   CORES (minúscula = tom escuro da mesma cor):
     R vermelho  O laranja  Y amarelo/ouro  G verde  B azul  C céu/vidro  P rosa  V roxo  K madeira  S aço
     A arroz/creme  W branco  N preto  E pelo do Kome  T palha/saco  M pedra */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), DIR = path.join(ROOT, 'conteudo'), OUT = path.join(ROOT, 'game', 'content.js');
const API = `/* GERADO por tools/content.js a partir de conteudo/*.js — não edite aqui, edite as fichas e rode o tools/content.js */
(function () {
  'use strict';
  const E = window.Pixxel, G = (window.KomeGame = window.KomeGame || {}), D = G.Data;
  const lista = (G.Fichas = G.Fichas || []);
  function ficha(f) {
    try {
      const id = String(f.id || f.nome).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
      const spr = () => (f.desenho ? E.spriteText('ficha/' + id, f.desenho) : null);
      // receita (tools/arte.js) = arte animada do Pixxel Estúdio, tocada com Pixxel.Anim; senão, desenho em texto
      const base = { id, n: f.nome, d: f.desc || '', fromCard: true, sprite: spr, onde: f.onde || {}, escala: f.escala, anim: f.receita ? id : null, tagAnda: f.anda, tagParado: f.parado };
      if (f.tipo === 'enfeite' || f.tipo === 'bicho') {
        if (D.decorById && D.decorById[id]) return;
        const it = Object.assign(base, { kind: f.tipo === 'bicho' ? 'pet' : 'decor', sec: f.preco || 60, anda: f.tipo === 'bicho' });
        D.DECOR.push(it); if (D.decorById) D.decorById[id] = it;
      } else if (f.tipo === 'estrutura') {
        // construção do cenário (pátio, cidade): só a arte; o game-world.js desenha pelo id
      } else if (f.tipo === 'roupa') {
        if (D.CLOSET.some(c => c.id === id)) return;
        D.CLOSET.push(Object.assign(base, { kind: 'acc', island: f.ilha }));
      } else if (f.tipo === 'evento') {
        if (G.Inf && G.Inf.addEvent) G.Inf.addEvent({ id, n: f.nome, sub: f.sub || f.desc || '', dur: f.dur || 30, mult: f.mult || 2, icon: f.icone || 'star' });
      } else if (f.tipo === 'loja') {
        if (D.SHOPS && !D.SHOPS.some(s => s.id === id)) D.SHOPS.push({ id, n: f.nome, d: f.desc || '', k: f.k || 'sell', r: f.r || 0.05 });
      } else { console.warn('[kome] ficha com tipo desconhecido:', f.tipo, f.nome); return; }
      lista.push(Object.assign({ tipo: f.tipo }, base));
    } catch (e) { console.warn('[kome] ficha quebrada:', f && f.nome, e); }
  }
`;
const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter(f => f.endsWith('.js')).sort() : [];
let out = API;
// pacotes de arte animada gerados pelo tools/arte.js (conteudo/arte/*.pixxel.js)
const ART = path.join(DIR, 'arte'), packs = fs.existsSync(ART) ? fs.readdirSync(ART).filter(f => f.endsWith('.pixxel.js')).sort() : [];
for (const f of packs) out += '\n  /* ===== conteudo/arte/' + f + ' ===== */\n  if (window.Pixxel && Pixxel.Assets) ' + fs.readFileSync(path.join(ART, f), 'utf8').replace(/^\/\*.*\*\/\n/, '') + '\n';
for (const f of files) out += '\n  /* ===== conteudo/' + f + ' ===== */\n' + fs.readFileSync(path.join(DIR, f), 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n') + '\n';
out += '})();\n';
fs.writeFileSync(OUT, out);
console.log('game/content.js: ' + files.length + ' fichas, ' + packs.length + ' artes animadas');
