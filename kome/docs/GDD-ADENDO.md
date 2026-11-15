# Adendo ao GDD (pedidos do dono depois do v4) — tem prioridade sobre o GDD.md

## 1. Britadeira (martelete de arrancar calçada) entra na escada
Fica entre o Carrinho de Mão e o Trator: é "a primeira parte industrial". A escada passa a ter 13 degraus:
pata, hashi, tigela, pá, duas pás, carrinho, **britadeira**, trator, empilhadeira, escavadeira, pá de cabo, caminhão, Bagger 293.

```js
{id:'britadeira', name:'Britadeira', cost:55000, A:210, r:26, pow:3.6, zoom:1.28, spd:230, reach:26, seat:'paw', kind:'jack',
 act:'Kome em pé nas patas de trás segurando a britadeira com as duas patas; o corpo inteiro vibra, bochecha e orelha tremendo, chapéu pulando; ponteira martela e solta lascas e poeira; cabo/mangueira até um compressorzinho amarelo que vem atrás pulando'}
```
- Verbo próprio: fura pra BAIXO (poço estreito e fundo) em vez de comer de lado; é a primeira ferramenta que racha o arroz
  prensado a 100% e lasca o mochi (k≈0,45). Rachaduras visíveis se espalham antes do bloco soltar (antecipação) e aí cai um
  pedação de uma vez (recompensa em rajada).
- Som: tatatatata grave com pitch subindo no combo; compressor em loop.
- Feedback de poder: shake de alta frequência e baixa amplitude, números de ¥ tremendo.
- Depois do trator, a britadeira vira ferramenta dos ajudantes (troca visual: shibas de capacete com mini-britadeira).
- Reequilibrar: trator sobe pra ~¥110k; conferir no sim que o intervalo carrinho→britadeira→trator fica entre 60 e 150 s.

## 2. Textura do arroz
Aprovada a direção "dá pra ver os grãos" (terrain.js). Manter.

## 3. Orçamento curto: prioridade é o JOGO
Cortados/adiados por enquanto: gfx.js (pós-processamento WebGL), demo do lago de carpas, revisões separadas por módulo.
