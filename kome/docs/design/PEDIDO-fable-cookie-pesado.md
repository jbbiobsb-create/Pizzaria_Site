# Pedido pro Fable: a parte PESADA da camada Cookie (arte, texto em volume, interface)

Tua spec `docs/design/camada-cookie.md` foi **APROVADA** pelo dono, com as 3 respostas:
1. Pátio da Frota **só depois do final** da ilha.
2. Níveis da Oficina **zeram na viagem** (regra de hoje).
3. **Cochilo do Kome: entra**, desligável nos ajustes.

## CORREÇÃO IMPORTANTE DO DONO: o público NÃO é criança
O jogo é pra **jovem adulto de 20 a 35 anos que gosta de idle/incremental** (quem joga Cookie Clicker, Antimatter Dimensions,
Melvor, Egg Inc.). Os docs antigos diziam "criança joga"; já corrigi o CLAUDE.md e o PAPEIS.md. O que muda pra você:
- **Humor:** pode ser mais nerd e adulto: referência de internet, absurdo, ironia leve, piada de trabalho/boleto/café.
  Continua fofo (shiba), mas pode ter tirada de adulto. Os textos da tua planilha ("Unha Cortada pela Vó") já estão no tom certo.
- **Complexidade:** dá pra ter mais número, mais sinergia, mais "otimizar a build". Esse público gosta de planilha.
- **Ética:** continua um jogo honesto **por gosto do dono** (sem dinheiro real, loot box, culpa, push, punição por parar,
  "quase ganhou"). Mas não é mais por lei de criança: tire as referências a ECA/código infantil como restrição.
- O `tools/dopamina.js` está no zip agora (não tinha chegado em você). Pode ajustar os pesos que você sugeriu.

## Divisão do trabalho (pra ninguém pisar em ninguém)
- **Eu (programador), em paralelo:** o SISTEMA. `S.patio` (quantidade de cada máquina, preço ×1,15, rendimento, ×1/×10/×máx),
  save + migração, offline com E.Sim, marcos/sinergias/coração/tigelas lendo da planilha (`planilha.js`), eventos
  dourados como sistema (sorteio, duração, efeito), Sementes do Pátio, chip "hora de partir", tipos novos no `longo.js`,
  medição de 100 h. Tudo com visual MÍNIMO de placeholder (máquina existente + placa "×N").
- **Você: tudo que gasta muito token**, abaixo. Entregue como zip completo, uma tarefa por vez, nesta ordem.

## Fila do Fable (pesado)
1. **Visual em patamares do Pátio** (o que mais pesa e o que mais vende o jogo):
   - turmas de até 8 shibas por ferramenta de mão, até 4 máquinas médias nas vagas, gigantes como silhuetas no horizonte;
   - mudança visual em 10, 25, 50, 100 (e acima) por turma; placas "×N" bonitas;
   - 50 tratores sem virar bagunça: comboios, filas, poeira, shibas trocando de turno. Lembre do desempenho (a Gêmea
     derrubava pra 3 fps; meça com muita coisa na tela).
   - Entrega: funções de desenho em `game/patio-arte.js` (`G.PatioArt.draw(g, view, t, patio)`), com o formato de `patio` que
     eu vou expor (`{ id: { n, marcos } }`). Pode começar com dados falsos via `?dev`.
2. **Os 6 eventos dourados com visual e som**: Frenesi, Chuva de Arroz, Kome Gigante, Desfile, Tempestade, Festival. Eu faço o
   sorteio, a duração e o efeito numérico (`G.Events.on(id, t, k)`); você desenha a coisa pra tocar, a animação durante o
   evento e a festa no fim. Mais o **Livro dos Eventos** (tela que mostra a chance de cada um).
3. **Planilha cheia** no formato da `camada-cookie-exemplo.csv` (eu adapto o `planilha.js` pra ler):
   ~180 upgrades (13 marcos × 14 máquinas), ~19+ sinergias, ~420 conquistas, nomes de número depois do "deci" (arrozilhão,
   shibalhão…), as 8 Tigelas do Coração. **Tom de jovem adulto**: cada linha com uma piada curta.
4. **Máquinas absurdas da árvore de prestígio** (Trem-Bala, Foguete de Mochi, Escavadeira do Fuji, Portal Onigiri + o que
   faltar até 20): grandes = vetor articulado, como a Bagger (`G.Tools[id]`, ver `docs/NOTAS-FERRAMENTAS.md`). Uma por rodada.
5. **Interfaces no nível da Fábrica:** painel do Pátio (comprar ×1/×10/×máx, marcos, sinergias), cartão "Enquanto você estava
   fora · Pegar!", Arroz do Coração com as tigelas, árvore de sementes nova (~34 nós), chip "hora de partir", **Cochilo do Kome**
   (bocejo depois de 60 min, desligável).
6. **Celular:** os teus 5 miúdos da rodada passada, se ainda não fez (+¥ estreito, chips em 2 linhas, preço do Tatuzão só no
   hover, cartão das lojas tapando a placa, botões sumindo no voo automático).

## Como entregar
Zip completo + uma linha no `CONTINUAR.md` por tarefa. Se mexer em `game/game.js`, `engine/` ou save, diga qual função e por quê.
Números só em `game/data.js`. No resumo, liste o que NÃO testou. Antes de mandar, se puder:
`node tools/check.js --fast` e `node tools/alicerce.js`.
