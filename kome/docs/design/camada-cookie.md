# Camada Cookie: o Pátio da Frota
status: aprovado
camada: 2+ · modo infinito de cada ilha   ·   depende de: ilhas (viagem), sementes.md, jogo-infinito.md, E.Sim, Oficina,
tools/planilha.js · pesquisa: `pesquisa-incrementais.md` (princípios P1–P12)

```
PLANILHA (camada-cookie-exemplo.csv): separador ; · 1ª linha = cabeçalho · número com ponto (1.5, 5e4), sem milhar ·
desc sem ponto e vírgula.
tipo      upgrade | conquista | evento
id        único, sem acento (sai do nome se vazio)
nome      o que aparece no cartão
desc      texto de 1 linha, com graça (pt-BR, criança lê)
maquina   id de D.TOOLS (pata…bagger), absurda (tatu, komeoh…), "a+b" (sinergia), "todas", ou vazio
condicao  qtd (tem >= alvo da máquina) · par (as duas >= alvo) · ganho (¥ ganho no total >= alvo) · conquistas · eventos
          (dourados pegos) · viagens · segredo (alvo = código que o programador implementa) · sorteio (só evento)
alvo      número da condição (25, 1e15…) ou código do segredo
efeito    mult_maquina · mult_renda · sinergia · coracao · freq_evento | (evento:) frenesi · chuva · gigante · tempestade ·
          desfile · festival
valor     upgrade: ×valor (2 = dobra; sinergia: +valor por unidade da outra) · conquista: vazio (vale 1 coração) ·
          evento: multiplicador ou minutos de renda (ver tabela de eventos)
preco     upgrade: × custo-base da máquina (10, 50, 500, 5e4…); upgrade sem máquina: segundos de renda · outros: vazio
peso      evento: peso no sorteio (os 6 eventos da tabela somam 100; o exemplo traz 4) · outros: vazio
duracao   evento: segundos · outros: vazio
icone     nome de ícone que já existe no HUD (paw, star, yen, bolt, sack, trophy…)
```

## Em uma frase
Depois do final de cada ilha, abre o **Pátio da Frota**: você compra **muitos** de cada uma das 14 máquinas (50 tratores, 300
patas), cada compra **aparece** no pátio, marcos dobram a produção, eventos dourados fazem festa, e quando a corrida esfria a
viagem pra próxima ilha vira sementes que deixam a próxima corrida maior. Um jogo só, camadas de número e coleção por cima.

## Como funciona (regras)
1. **Abre no final da ilha** (casa pronta). A campanha de cada ilha (70 min em Honshu, 25–35 nas outras) fica como está: é a
   parte com história. O Pátio é o modo infinito novo. (Pergunta 1 abaixo.)
2. **Cada máquina que você já pilotou vira uma "turma"** que dá pra comprar várias vezes. Unidade = um shiba com aquela
   ferramenta, ou aquela máquina com um shiba dentro. Preço `base × 1,15^quantidade`; rende `base × multiplicadores`, somando à
   renda de hoje. Botões ×1 / ×10 / ×máx (P7).
3. **Marcos de quantidade** (13 por máquina): ×2 na produção daquela turma em 1, 5, 25, 50, 100, 150, 200, 250, 300, 350, 400,
   450, 500. Aparecem como cartão na Oficina e no chip "próxima compra" quando a quantidade chega (P3).
4. **Sinergias** (máquinas velhas continuam valendo, P7): quando duas turmas vizinhas passam de 15, abre um cartão que dá ×1,5 nas
   duas, e algumas dão "+1% pra cada unidade da outra" (ex.: Carona no Trator: tratores +1% por Pata). 19 entre vizinhas + extras.
5. **Eventos dourados** (P2): enquanto você joga, a cada 3 a 8 min aparece uma coisa dourada pra tocar (tabela). O prêmio é
   sorteado quando ela nasce e mostrado igual no fim. Sem roleta, sem "quase". Não nascem com a aba escondida nem offline.
6. **Conquistas em massa** (~420, por planilha). Cada conquista enche 1 grão do **Arroz do Coração**: +1% de renda (o selo de hoje).
   As 8 **Tigelas do Coração** (upgrades em 25/50/100/150/200/250/300/400 conquistas) fazem cada conquista valer +1% a mais.
   Com 400 conquistas e 8 tigelas: "Coração 400 × 9% = +3.600%" (o HUD mostra a conta com o ícone de coração).
7. **Viagem = prestígio** (P8). As sementes da viagem passam a ser: **campanha da ilha** (sementes.md, sem mudança) **+ Sementes do
   Pátio** = `floor((ganho no Pátio / ganho da campanha da ilha) ^ 0,15)`. Substitui o "+10% por ×10, teto +50%" do sementes.md:
   expoente baixo já segura o farm (ficar ×100 mais no ganho ≈ só ×2 sementes do pátio). O cartão de partir mostra a previsão:
   "agora: 24 · se ficar mais 20 min: ~28". O chip **"hora de partir"** acende quando as sementes do pátio ≥ as da ilha **e** nada
   novo aconteceu há 4 min (é o platô que convida a viajar ou parar, P9).
8. **Viajar zera o Pátio** (quantidades e marcos). Ficam: sementes e árvore, conquistas e coração, Livro dos Eventos, coleção,
   Vila, fábrica (layout/selos), Oficina? (Pergunta 2). Volta 2+ e Faixas como no `jogo-infinito.md`.
9. **Ganho offline** (E.Sim, P9): ao voltar, carta "Enquanto você estava fora (3 h 12 min): a frota cavou ¥X, a fábrica terminou 40
   onigiris, 2 conquistas novas!" e um botão grande "Pegar!". Nada decai, nada some, nada é comprado sozinho.
10. **Minijogos ficam opcionais e alimentam o Pátio** (dá pra fechar a corrida sem eles, com eles ~20–30% mais rápido + conquistas):
    **Oficina** = nível de cada máquina multiplica a turma toda (×1,05 por nível; marcos dela continuam) e é onde moram os cartões
    de marco; **Fábrica** = cada produto diferente feito na corrida dá +2% na renda do Pátio (Cardápio); **Tatuzão** = cada
    bolsão/fóssil achado guarda 1 **Evento na Mochila**: você escolhe quando soltar um evento dourado (autonomia, P5).
11. **Amuletos e Faixas ficam por cima depois** (`jogo-infinito.md`): amuleto muda regra do Pátio ("Gêmeos: toda 2ª unidade sai
    de graça"), faixa encarece. A camada Cookie é a base de número e coleção; não depende deles.

## Desbloqueio e progressão
- **1ª corrida (Honshu, depois dos 70 min):** começa com a renda do final (`R0`). Pata a Bagger aparecem em ~75 min.
- **Árvore de Sementes maior** (as 6 do `sementes.md` + ~34 nós, custo `base × 1,45^nível`, sem teto onde fizer sentido):

| Galho | Exemplos (base em sementes) |
|---|---|
| Viagem (já existe) | Arroz Abençoado (2), Amigo do Corretor (3), Mala (6), Poupança (1), Turma do Kome (4), Faro de Ouro (2) |
| Pátio | Garagem Abençoada: começa com 5 de cada mão (4) · Desconto de Frota −1% preço/nível (3) · Marco Turbinado: marcos de 1 e 5 viram ×3 (20) · Shiba Sindicalizado +0,5% por 10 unidades no total (8) · Comprar ×máx desde o início (2) |
| Sorte | Faro Dourado: eventos 10% mais frequentes/nível (3) · Brilho Longo: +2 s na tela (2) · Livro de Receitas: abre Tempestade e Desfile (6) · Mochila Maior: guarda +1 evento (5) |
| Coração | Pote Fundo: +0,1% por conquista/nível (4) · Lupa de Segredos: conquistas secretas ganham dica (3) |
| Poupança | Cochilo Produtivo: offline 50% → +10%/nível até 100% (2) · Cama Grande: teto offline +4 h/nível até 24 h (3) |
| Absurdo | **Destrava a máquina 15, 16… 20** (25, 75, 200, 500, 1.200, 3.000): Frota de Tatuzões, Kome-Oh em série, Trem-Bala de Arroz, Foguete de Mochi, Escavadeira do Monte Fuji, Portal Onigiri. Cada uma com cena curta e desenho no horizonte (virada de sistema por volta, P1, P10) |

- **Voltas sem fim:** ~1 a 2 h por ilha (campanha + Pátio) → ~5–8 h por volta → **~12 voltas em 100 h**. As máquinas absurdas e as
  faixas são a "coisa nova" de cada volta.

## Números
**As 14 (+6) turmas.** Custos em **segundos de renda do final de Honshu (`R0`)**, rendimento em `R0/s`; série `custo 10 × 6,5^i`,
`rende 0,5 × 4,3^i` (retorno do 1º: 20 s na Pata, ~72 min na Bagger). Simulei uma planilha gulosa (sem minijogos, eventos a cada
3–8 min): 14ª turma aos 74–87 min; 30 a 60 compras e 1 a 2 marcos a cada 5 min no começo; depois de ~60 min aparecem buracos
de 6–8 min, que é onde o chip "hora de partir" deve acender. Com bônus permanente ×5 a corrida comprime pra ~20 min: por isso o
guarda de 30 min abaixo.

| # | turma | custo base | rende | # | turma | custo base | rende |
|---|---|---|---|---|---|---|---|
| 1 | Turma da Pata | 10 | 0,5 | 8 | Comboio de Tratores | 4,9e6 | 1,4e4 |
| 2 | Brigada do Hashi | 65 | 2,2 | 9 | Balé das Empilhadeiras | 3,2e7 | 5,8e4 |
| 3 | Clube da Tigela | 420 | 9,2 | 10 | Fila de Colheitadeiras | 2,1e8 | 2,5e5 |
| 4 | Sindicato da Pá | 2,8e3 | 40 | 11 | Escavadeiras Coreografadas | 1,3e9 | 1,1e6 |
| 5 | Dupla Dinâmica (duas pás) | 1,8e4 | 170 | 12 | Caravana de Caminhões | 8,8e9 | 4,7e6 |
| 6 | Esquadrilha do Carrinho | 1,2e5 | 735 | 13 | Pás de Cabo no Horizonte | 5,7e10 | 2,0e7 |
| 7 | Banda da Britadeira | 7,5e5 | 3,2e3 | 14 | Frota Bagger | 3,7e11 | 8,6e7 |

Absurdas 15–20 continuam a série (Tatuzões 2,4e12 · 3,7e8 … Portal Onigiri 2,8e16 · 5,4e11).
Ilhas: multiplicar tudo pelo `priceMul` da ilha; Faixa: começa em ×2,5 como as ilhas e ajusta pelo guarda.

**Marcos:** preço `custo-base × [10, 50, 500, 5e4, 5e6, 5e8, 5e10, … ×100 a cada um]` (Cookie Clicker usa a mesma escada).
**Sinergia:** `30 × custo-base da maior`. **Tigela do Coração:** `600 s de renda` a primeira, ×10 cada próxima.

**Eventos dourados** (a cada 3–8 min jogando, 15 s na tela; prêmio mínimo ≈ 5 min de renda, P2):

| evento | peso | o que faz | duração |
|---|---|---|---|
| Frenesi do Shiba | 40 | renda ×7, shibas correm, música acelera | 60 s |
| Chuva de Arroz | 30 | grãos caem; tocar coleta; o que não tocar cai no coletor valendo metade. Total ≈ 10 min de renda | 12 s |
| Kome Gigante | 12 | Kome cresce, cada patada vale ×50 | 20 s |
| Desfile da Frota | 8 | uma turma com ≥10 desfila: +10% por unidade dela | 30 s |
| Tempestade de Sacos Dourados | 8 | chovem sacos, cada um 1–7 min de renda (precisa do nó Livro de Receitas) | 20 s |
| Festival das Lanternas | 2 | tudo ×2, lanternas e taiko; raríssimo e só visual a mais | 77 s |

No **Livro dos Eventos** cada evento visto fica com desenho e chance escrita ("1 em 50"). Não existe evento negativo.

**Números com nome** (P6, P10): depois de `deci` (já em `engine/core.js`): undeci, duodeci… até vigintilhão (1e63), depois nomes
bobos a cada ×1000: arrozilhão, onigirilhão, mochilhão, shibalhão, baggerlhão, tatuzilhão, fujilhão, luazilhão, kome-kome,
kome-kome-kome (até 1e93). Depois, notação `1,23e96`; opção nos ajustes pra sempre usar notação. Nome novo = novidade (festinha
curta: "O número ganhou nome novo!").

### Metas de ritmo (medir com `tools/longo.js` + `tools/dopamina.js`)
Pro `longo.js`: marcar novidades por tipo novo: `compra` (unidade repetida) **separada** de `tipo` (1ª unidade da turma na
corrida), `visual` (turma muda de patamar: 10, 25, 50, 100…), `marco`, `sinergia`, `evento`, `conquista`, `nome`, `viagem`,
`faixa`. O robô viaja quando o chip "hora de partir" acende.

| meta | valor | como medir |
|---|---|---|
| Sem buraco no Pátio | nenhum trecho > **5 min** sem novidade de verdade (tudo menos `compra`) | `longo.js --horas 100 --chato 5`, ignorando `compra` |
| Compra ou escolha | 1 a cada **≤ 60 s** no Pátio nas primeiras 10 h (espera máx); campanha continua ≤ 180 s | maior intervalo entre compras possíveis |
| Prestígio | 1 viagem a cada **1–2 h** (campanha da ilha + Pátio); Pátio **nunca < 30 min**; ilha nunca < 15 min | `fases` do longo.js |
| 14ª turma | **60–90 min** na 1ª corrida; **≥ 25 min** em qualquer corrida | 1º `tipo 14` da corrida |
| Eventos | 1 a cada 3–8 min jogando (média ~5); **zero** offline | contagem de `evento` / hora |
| Conquistas | ~1 a cada 10–15 min em média; **a última entre 90 e 110 h** | `longo.js --horas 110` |
| Engajamento | **≥ 90%** engajado em 100 h; **nenhum trecho > 10 min abaixo do limiar**; não larga | `dopamina.js` sobre o `--json` |
| Pico por viagem | toda viagem e toda máquina absurda nova dá um pico | curva do dopamina.js |

Sugestão pro `dopamina.js` (não consegui ler o arquivo; ajustar aos pesos que existem): `compra` peso ~0,05 e habitua rápido (pra
régua não premiar "comprinha a cada 3 s", P12); `visual`/`marco` ~1; `evento` ~1,5; `conquista` ~0,7; `nome` ~0,8;
`viagem`/máquina absurda ~3.

## Tela e controles
- **Celular deitado.** O Pátio é o pátio que já existe (vagas, estacionamento, bancadas na encosta, horizonte). Lista das turmas
  num painel lateral recolhível: ícone, `×N`, preço, botão ×1/×10/×máx; a mais barata útil pisca de leve.
- **Como a quantidade aparece sem virar bagunça** (toda compra mostra algo, P6):

| classe | 1 a N individuais | depois | patamares visuais |
|---|---|---|---|
| Mão (pata…britadeira) | até 8 shibas por turma, na encosta | placa `×N` com a turma revezando quem trabalha | 10 boné igual · 25 bandeirinha · 50 barraca da turma · 100 arquibancada · 250 estátua dourada |
| Média (trator…escavadeira) | até 4 nas vagas do pátio | comboio na rua do pátio com placa `×N` | 25 garagem · 50 galpão com portas · 100 estacionamento de andares |
| Gigante (caminhão, pá de cabo, Bagger) e absurdas | 1 de verdade | silhuetas no horizonte (até 3 camadas) | 10 / 25 / 50 o horizonte vai enchendo, à noite com luzinhas |

  Cada compra: o shiba/máquina **entra correndo** pela lateral até a turma, a placa pula com o número novo e o som sobe um tom por
  compra seguida. Compra em lote (×10/×máx) = **uma** festa maior, não 100 animações. Teto de desenho: ~40 sprites extras no total.
- **HUD:** chip "próxima compra" (já existe) mostra também o próximo marco ("Pá: 23/25 → ×2"); chip do Coração; chip "hora de partir".

## Conteúdo
Fichas por planilha (`camada-cookie-exemplo.csv` mostra o formato): ~280 upgrades (13 marcos × 20 turmas + sinergias + tigelas),
~420 conquistas (13 por turma × 20, ¥ ganho a cada ×1000 até 1e100, renda/s, eventos, viagens, faixas, minijogos, ~25
secretas e bobas: "Saudade do Começo: compre 1 hashi tendo 100 Baggers"), 6 eventos. Depois, mesmo formato: `noticia` pra uma
**Rádio Arroz FM** que conta a história aos poucos pelos números (o tanuki rival, o segredo do dinossauro de arroz), P10.

## Visual e som
Estilo Kome: shibas e máquinas pequenas em pixel (gerador de arte), grandes vetoriais; turma com boné da mesma cor. Dourado
sempre com brilho e o "plim" do saco dourado; Frenesi acelera a música; Festival tem taiko. Máquina absurda nova: cena curta
(5–8 s) chegando pelo horizonte.

## Fora do escopo (o que NÃO entra, P11)
Streak ou bônus por dias seguidos · perda diária ou qualquer coisa que murcha · loot box (paga ou grátis com cara de caixa) ·
push · anúncio · oferta por tempo limitado · evento com prêmio exclusivo que some (FOMO) · cookie da ira / evento ruim · animação
de "quase" · frase de culpa ("sentimos sua falta", "você perdeu…") · bônus por tempo jogado seguido · autoplay de corrida nova ·
placar contra outras pessoas. Também fora desta versão: amuletos, faixas, evoluções (vêm do `jogo-infinito.md` depois).

## Ordem de construção (o único sistema novo é a quantidade; o resto é tabela)
1. **Quantidade de cada máquina** (o sistema): `S.patio`, preço ×1,15, rendimento, ×1/×10/×máx, save + migração, E.Sim offline +
   carta, painel, visual mínimo (entra correndo + placa ×N), tipos novos no `longo.js`. Medir.
2. **Tabelas:** `planilha.js` lê upgrade/conquista; marcos, sinergias, Coração e tigelas; nomes de número.
3. **Eventos dourados** (generalizar sacos/onigiri que já existem) + Livro dos Eventos + Mochila do Tatuzão.
4. **Prestígio:** Sementes do Pátio, árvore nova, chip "hora de partir", máquinas absurdas 15–20.
5. **Visual em patamares** (turmas, comboios, horizonte) + conteúdo em volume pela planilha + medição de 100 h.

## Perguntas do programador
(designer deixou estas pro dono/programador decidirem)
1. Pátio só depois do final da ilha (protege a campanha) ou desde o começo da ilha? Proposta: só depois do final.
2. Níveis da Oficina zeram na viagem (hoje sim?) ou ficam? Proposta: seguem a regra de hoje.
3. "Cochilo do Kome": depois de ~60 min seguidos, o Kome boceja e sugere uma pausa (sem perder nada, some com um toque).
   Entra ou fica fora? Proposta: entra, desligável nos ajustes (P9, P11).
