# Pedido pro Fable — rodada 3

Oi! Tua rodada do mundo em dois lados e da Oficina nova entrou no jogo. Base desta rodada: o `kome-projeto.zip` que vai junto
(é o projeto inteiro, já com tudo abaixo). Trabalhe em cima dele, não do teu zip anterior.

## O que o programador fez desde o teu último zip (pra você não estranhar)
- **Merge** do teu zip com 3 commits meus que vieram antes: botão RESETAR no admin, caminhão consertado e final novo.
- **Bug do teu voo da câmera:** o voo pra Vila só anda nos quadros de tela. No modo acelerado (playtest), o Kome ficava "olhando a
  Vila" pra sempre e não cavava. Agora `vilaGo` não voa no modo acelerado. No jogo normal nada mudou.
- **Testado:** as 14 ferramentas cavam nas 5 ilhas depois do teu layout novo, a campanha fecha em 68 min, o robô de cliques
  passa no PC e no celular, e as folhas de tela saem sem erro.
- **Caminhão de Mineração:** segurar o clique em cima da caçamba fazia ele dar ré pro pátio e nunca carregar. Agora carrega
  (só "leva embora" se clicar bem atrás dele), e a pá dele não segue mais o mouse.
- **FINAL MUDOU:** agora é **casa pronta E montanha 95% cavada** (`D.END_DUG` em data.js). Antes acabava na compra do onsen,
  com ~80% cavado. A campanha passou de ~63 pra ~70 min, e **as ilhas também ficaram mais longas** (31–34 min com sementes
  moderadas).
- **Bagger Gêmea:** o dono não achava. O botão da Oficina no HUD agora mostra "Bagger Gêmea N/4 · peça à venda!".
- **TATUZÃO no jogo** (`game/tatuzao.js` + teu `tbm.js`): um chip "Tatuzão" no topo depois do final; comprado, ele fura um
  túnel na base da montanha e paga por anel instalado. O túnel é recortado pela montanha (onde já cavou, some). Números
  em `D.TATU`. É um **encaixe provisório**: o design é teu (item 3).

## Fila de trabalho (em ordem; cada item = zip completo + uma linha no CONTINUAR.md)
1. **Ligar a Fábrica ao jogo todo** (o dono disse: "achei que era uma camada a mais super complexa, é só um mini Satisfactory?").
   Hoje ela só recebe uma % do arroz e devolve ¥. Faça a spec de 1 página (`docs/design/fabrica-ligacao.md`, status
   `rascunho`) dizendo como a fábrica conversa com o resto. Ideias que já estão na mesa (escolha, corte ou troque):
   - pedidos da **Cidade** consumindo onigiri e mochi (é a camada 4 do PLANO-100H);
   - **receitas por ilha**: curry rice em Kyushu, sorvete de mochi em Hokkaido, sata andagi em Okinawa (viajar abre cardápio);
   - **produto ajudando a montanha**: ex. onigiri dá energia aos shibas ajudantes e eles cavam mais rápido;
   - o **Cardápio** (coleção) como meta à vista.
2. **Tempos das medalhas das ilhas** (`D.ENDGAME.medal`): foram pensados pro final antigo. Recalibre pro final novo e use o teu
   `sementes.md` junto (o achado de que sementes no máximo deixavam as ilhas com 3–13 min).
3. **Tatuzão de verdade**: onde se compra (chip no topo? peça da Oficina? prêmio?), o que ele faz além de renda (furar até um
   bolsão escondido? abrir caminho pros robozinhos?), e um visual de chegada. Hoje ele é só "compra e assiste".
4. **Pontos fracos que você mesmo listou no mundo novo**: a frota fica longe da tela no meio do jogo; o voo da câmera raspa na
   encosta; o kei-truck do galpão passa na frente da Oficina; as máquinas pequenas ficam paradas com caminhão/Bagger na frente.
5. **Robozinhos** (`game/swarm.js`, que veio no zip antigo e nunca foi ligado): se couber, a spec de como eles entram no jogo.

## Aprovar (o dono decide; me diga o que ele escolheu)
- `docs/design/sementes.md` e o rascunho do **fim de jogo da fábrica**: os dois que você mandou na rodada passada estão
  esperando aprovação. Eu só implemento o que estiver marcado como `aprovado`.

## Como trabalhar comigo (igual antes)
- Pode mexer à vontade em `game/*-arte.js`, `game/fabrica.js`, `game/oficina.js`, `demos/`, `docs/design/` e `conteudo/`.
  Se precisar mexer em `game/game.js`, `engine/` ou no save, diga no resumo **qual função** e **por quê**.
- Números só em `game/data.js`. Criança joga: nada de dinheiro real, culpa ou punição. Celular deitado é o padrão
  (nada abaixo de 12 px no aparelho de 844×390).
- No resumo, liste o que **NÃO** testou (isso ajudou muito nas últimas rodadas).
- Se tiver `node`: `node tools/check.js --fast`, `node tools/alicerce.js` e `node tools/playtest.js --auto` antes de mandar.
  Atenção: o playtest roda em **modo acelerado** (FAST). Qualquer coisa que só ande em quadro de tela (câmera, cutscene)
  não pode travar o cavar nesse modo.
