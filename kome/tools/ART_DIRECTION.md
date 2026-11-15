# Direção de arte — Kome no Japão / Kome Engine

Critérios de revisão visual. Toda peça de arte é renderizada, olhada em screenshot e refeita até cumprir isto.

1. **Profundidade em camadas**: céu, Fuji, morros, vila, montanha de arroz, primeiro plano; cada camada com parallax próprio.
   Camadas distantes mais claras e azuladas (névoa de distância). É o que vende a escala da Bagger.
2. **Luz com hora do dia**: manhã, tarde dourada, pôr do sol, noite; tinge o cenário inteiro. À noite, janelas, lanternas e
   faróis acendem com halo.
3. **Sombra e volume**: todo objeto com 3 tons (base, sombra, luz), sombra no chão; arroz com textura de grão e brilho na crista,
   nunca branco chapado.
4. **Paleta travada**: só `E.PAL` e o contorno `#3B2818`. Peças de autores diferentes têm que parecer do mesmo jogo.
5. **Movimento secundário**: nada parado. Grama e árvores no vento, fumaça, cabos balançando, orelha e rabo do Kome,
   máquina tremendo no motor, nuvens, pássaros, pétalas.
6. **Peso nas animações**: antecipação antes do golpe, squash & stretch no impacto, poeira e shake proporcionais ao tamanho.
7. **Brilho onde importa**: ouro, faíscas e luzes com bloom leve; vinheta suave. Pouco, só pra guiar o olho.
8. **Interface com a mesma cara**: ícones em pixel art (nada de emoji), números e botões no estilo do mundo.
9. **Escala por comparação**: máquina grande sempre ao lado de shibas minúsculos, pick-up, escadas, corrimãos, luzes.
10. **Feedback visual de poder**: toda ferramenta e todo upgrade muda algo visível (cratera, jato de grãos, shake, velocidade
    de animação, tamanho/cor dos números). Upgrade só-número é bug.

Estilo misto assumido: Kome e objetos pequenos são pixel art (`Pix`); máquinas gigantes são vetoriais articuladas (`Draw`)
com o mesmo contorno e as mesmas cores chapadas.

## Máquinas: articuladas, nunca "uma vara"

Pedido explícito do dono do jogo: nada de braço duro tipo um palito colado na máquina.

- Todo braço/lança é uma cadeia de peças com juntas (pinos visíveis), movida por **pistões hidráulicos que esticam e encolhem**
  (`Draw.piston`) e resolvida por IK (`E.ik2`), com a caçamba/garfo/lâmina girando no próprio pino.
- Trator: carregadeira frontal de verdade (dois braços, pistão de levante + pistão de báscula, caçamba que enche, levanta e
  despeja), rodas girando com a velocidade, roda traseira grande, escapamento soltando fumaça em pulsos, capô vibrando,
  carroceria balançando na suspensão (`E.Spring`) ao frear/arrancar e ao levantar carga.
- Empilhadeira: mastro telescópico em dois estágios com correntes, garfos subindo e inclinando, contrapeso, giroflex.
- Escavadeira: lança + braço + caçamba (3 juntas, 3 pistões), cabine girando sobre a esteira, esteiras com sapatas andando.
- Pá de cabo: lança fixa em ângulo, braço (dipper) deslizando no berço, cabos de içamento com polias girando, caçamba com
  fundo que abre pra despejar.
- Caminhão: caçamba basculante com pistão telescópico, suspensão afundando com a carga, pneus gigantes com garras girando.
- Movimento com peso: aceleração e desaceleração suaves (nada de teleporte de ângulo), atraso entre juntas, leve overshoot
  e assentamento, tremor de motor em marcha lenta.
