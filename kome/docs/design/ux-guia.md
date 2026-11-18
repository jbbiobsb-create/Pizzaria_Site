# Guia de UX do Kome (vale pra TODA tela e menu)
Quem joga: de 20 a 60 anos. Régua: uma pessoa de 50 anos, com dificuldade de ler e sem paciência pra pensar muito,
tem que conseguir usar TODAS as funções sem ajuda. Bonito, vivo, mas simples.

## Regras
1. **Uma coisa principal por tela.** O botão do que fazer AGORA é o maior e dourado. O resto é discreto.
2. **Frase "o que fazer agora"** no topo de cada painel, 1 linha, verbo no começo ("Toque numa máquina pra comprar").
3. **Pouco texto.** Nome curto + 1 linha de até ~8 palavras. Nada de parágrafo. Sem jargão (nada de "DPS", "mult", "R0",
   "buff"). Número sempre com o que ele é ("+20% de arroz", "custa ¥ 1,2 mi").
4. **Ícone + palavra** em todo botão. Nunca só ícone, nunca só texto pequeno.
5. **Tamanho:** botão e alvo de toque ≥ 56 px no celular (≥ 48 no PC); texto de corpo ≥ 16 px no celular (≥ 14 no PC);
   título ≥ 20 px. Espaço de ≥ 8 px entre alvos. Use a variável `--k-fs` (escala de letra do jogador) nos tamanhos.
6. **Cores com sentido, sempre as mesmas:** dourado = dá pra comprar/fazer agora · cinza = travado (e DIZ o que falta:
   "falta ¥ 300", "precisa da Escavadeira") · verde = feito/comprado · vermelho só pra erro. Contraste alto (texto escuro
   `#3B2818` em fundo claro creme). Paleta `E.PAL`, contorno `#3B2818`.
7. **Fechar sempre igual:** X grande no canto de cima à direita + tocar fora + Esc. Botão "Voltar" quando tem tela dentro de tela.
8. **Resposta a todo toque:** botão afunda, som curto, número pula, coisa comprada brilha/carimba. Compra impossível
   balança e diz o motivo. Nada acontece em silêncio.
9. **Progresso à vista:** barra ou "3 de 8" em tudo que é coleção/meta. O próximo objetivo sempre aparece.
10. **Sem gesto escondido** (nada de segurar, arrastar ou toque duplo como único caminho). Rolagem só vertical, com
    seta/sombra mostrando que tem mais.
11. **Abas:** no máximo 5, com ícone + palavra, a ativa bem marcada. Bolinha dourada na aba que tem novidade.
12. **Confirmação** só em coisa que não tem volta (viajar, resetar, começar modo), com frase clara do que acontece.
13. **Vivo:** entrada do painel com animação curta (≤ 200 ms), Kome ou arte do jogo no cabeçalho, itens com desenho.
    Reaproveitar a arte que já existe (fichas, Pix, ícones do HUD).

## Técnica (pra não voltar o lag)
- Mexer no DOM só quando o valor muda (nunca todo quadro). Animar só `transform`/`opacity`. Nada de `box-shadow` animado,
  nada de `ctx.filter` por quadro. Listas longas: montar uma vez, atualizar só o que mudou.
- CSS novo de cada área vai no arquivo próprio `game/ux-<área>.css` (já ligado no index.html). Classes comuns em `game/ux-base.css`.
- Modo acelerado (FAST) nunca espera tela nem animação.
- Tem que funcionar em PC, celular deitado e celular em pé. Conferir com `node tools/check.js --fast` e `node tools/sweep.js`.
