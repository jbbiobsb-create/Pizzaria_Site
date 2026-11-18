# Jogo infinito: o Kome que nunca acaba
status: rascunho
camada: todas   ·   depende de: ilhas, sementes.md, fabrica.md, fabrica-ligacao.md, PLANO-100H.md

## Em uma frase
O dono quer um jogo que a pessoa jogue por MUITO tempo, na linha de Cookie Clicker (ideal), Balatro e Vampire Survivors.
Esta spec troca tudo que tinha **teto** por coisa que **nunca acaba**, e faz cada volta ao Japão ser uma **partida com
build própria**. Ela ajusta `sementes.md` e o "fim de jogo da fábrica" (as duas continuam valendo, com as mudanças abaixo).

## O que cada jogo ensina (e o que entra no Kome)
| Jogo | Por que dura | No Kome |
|---|---|---|
| Cookie Clicker | números sem teto, prestígio que acelera, centenas de conquistas, sempre 1 compra à vista | nada tem nível máximo; Sementes sem teto; conquistas em escada; "próxima compra" sempre na tela |
| Balatro | cada partida é uma build diferente; apostas (stakes) que sobem; desbloqueios | **Amuletos** escolhidos a cada ilha; **Faixas** de dificuldade por volta; coleção de amuletos |
| Vampire Survivors | escolher 1 de 3 a cada pouco; evoluções por combinação; partidas de 30 min | escolha 1 de 3 em cada marco da ilha; **evoluções** de máquina por combinação; ilha = partida de ~30 min |

## Como funciona (regras)

### 1. Nada tem teto
- **Sementes Douradas:** saem os níveis máximos. Custo `base × 1,45^nível` pra sempre (do `sementes.md`). Só as que não
  fazem sentido infinito têm fim: Mala de Viagem (3) e Turma do Kome (viram "+1 ajudante a cada 5 níveis").
- **Oficina:** depois do nível 50, um marco a cada 25 níveis (75, 100, 125…), cada um dobrando o bônus daquela máquina e
  dando uma medalha nova nela.
- **Fábrica:** o **Selo de Qualidade** não para em 3 estrelas: sem limite, cada estrela +50% no valor e o preço dos níveis
  daquela máquina ×3. A 5ª, 10ª, 25ª estrela mudam a cor da placa (bronze, prata, ouro, arco-íris).
- **Números grandes de verdade:** o formato de ¥ segue até onde for (…decilhão, depois notação 1,23e45). Ver o número
  mudar de nome é recompensa.

### 2. Cada ilha é uma partida com build: os Amuletos (omamori)
- Ao chegar numa ilha você escolhe **1 de 3 amuletos**, e ganha mais uma escolha em cada marco (1ª máquina a motor,
  Escavadeira, Bagger): até **5 por ilha**. Valem só naquela ilha. A viagem zera.
- Cada amuleto muda **como** você joga, não só quanto ganha. Exemplos (ficha `amuleto`, começar com 30, crescer até 100+):
  - **Pata de Ouro**: ferramentas de mão rendem ×10, máquinas a motor ×0,5 (partida "só na mão").
  - **Chuva de Sacos**: sacos caem 3× mais, mas valem metade (partida de clicar).
  - **Combo Eterno**: o combo não cai, mas sobe 3× mais devagar.
  - **Frota Feliz**: cada máquina estacionada dá +8% pras outras.
  - **Núcleo Vivo**: os bolsões dourados voltam a crescer devagar.
  - **Chef**: tudo que a fábrica vende vale ×2; arroz cru vale ×0,5.
  - **Gêmeos**: a 2ª máquina de cada tipo sai de graça e trabalha junto.
  - **Preguiça Boa**: renda offline ×3 e limite de 24 h (partida "idle").
- **Sinergias** (o tempero do Balatro): amuletos têm etiquetas (mão, motor, sorte, fábrica, equipe). 3 da mesma etiqueta
  acendem um bônus de conjunto com nome e brilho ("Trio da Sorte: todo saco é pelo menos dourado").
- **Raridade:** comum, raro, lendário (borda da cor). Lendários só aparecem depois de desbloqueados por conquista.
- **Rerrolar** as 3 opções custa Sementes (1, 2, 4, 8…).

### 3. Evoluções (o tempero do Vampire Survivors)
- Máquina no nível 25 da Oficina **+** o amuleto certo naquela ilha = **evolui** numa versão absurda, com desenho próprio e
  cena: Pá + Pata de Ouro → **Pá Lendária**; Trator + Frota Feliz → **Trator Comboio** (puxa 3 carretas);
  Escavadeira + Gêmeos → **Escavadeira de Dois Braços**; Bagger + Núcleo Vivo → **Bagger Dourada**.
- Cada evolução descoberta entra no Caderno (coleção) e fica marcada com "?" até ser achada. Começar com 6, crescer por ficha.

- **FEITO (19/11):** `game/evolucoes.js` + 6 fichas `conteudo/evolucao-*.js`: Pá + Pata de Ouro → Pá Lendária; Trator + Frota
  Feliz → Trator Comboio; Escavadeira + Gêmeos → Escavadeira de Dois Braços; Bagger + Núcleo Vivo → Bagger Dourada;
  Caminhão + Esteira Expressa → Caminhão Foguete; Colheitadeira + Chef → Colheitadeira Gourmet. ×3 na máquina evoluída
  em uso. Desenho por bandeira (`m.evo`) e peças extras por cima da máquina vetorial (não redesenha).

### 4. Faixas (as "stakes"): cada volta ao Japão é mais difícil e paga mais
- Terminou as 5 ilhas e o Kome-Oh → abre a **Faixa** seguinte (branca, amarela, laranja, verde, azul, marrom, preta, e daí
  Dan 1, Dan 2… sem fim, como no judô).
- Cada faixa soma **uma regra** que muda a partida (não só preço): preços ×2,5 (já existe `lapStep`); montanha 20% maior;
  só 4 amuletos por ilha; bolsões escondidos; arroz duro mais cedo; eventos mais raros…
- Paga: Sementes ×1,5 por faixa, amuletos novos no baralho, e a faixa aparece amarrada no Kome em todas as telas.
- **Sem punição:** a faixa nunca tira nada do que é permanente (Vila, coleção, sementes, selos).

- **FEITO (19/11):** `game/faixas.js`. Faixa = volta (S.stats.lap). Regras, na ordem das faixas: montanha 20% maior · só 4
  amuletos por ilha · bolsões escondidos · arroz duro mais cedo · eventos mais raros · combo frágil · duas cartas · (Dan) sacos
  tímidos · chegada sem presente · núcleo blindado; do 4º Dan em diante cada faixa reforça uma regra numérica até o teto.
  Paga sementes ×1,5 por faixa (composto), 5 amuletos novos de faixa no baralho (Kiai, Tatame Macio, Randori, Ippon, Faixa
  Preta) e a faixa no Kome (`E.shibaBelt`). **Preço: a faixa NÃO multiplica preço.** O preço por viagem do item 6
  (`D.ENDGAME.price`, t = ilha + volta×5) já sobe a cada volta e é a parte "preço" da aposta; somar ×2,5 por faixa em cima
  dobraria a conta (lapStep saiu pelo mesmo motivo).

### 5. O que é permanente (pra sessão curta valer a pena todo dia)
- A **Vila**, a **fábrica** (layout e selos), a **coleção** (roupas, fósseis, carpas, amuletos e evoluções descobertos, Cardápio),
  as **Sementes** e as **conquistas**.
- **Conquistas em escada** (como Cookie Clicker): cada uma tem graus sem fim ("cave 1 mi / 1 bi / 1 tri… de grãos"),
  +1% de renda por grau. Sempre tem uma a poucos minutos de fechar, mostrada no HUD.
- **Carta do dia** ao abrir: o que rendeu fora + 1 presente pequeno (um rerrolar grátis, um amuleto raro garantido hoje).
- **Recordes por ilha e por faixa** (tempo e ¥), com medalha: jogar de novo pra bater o próprio tempo.

### 6. Modos de partida (pra quem quer variar)
Aparecem no mapa das ilhas depois da 1ª volta: **Desafio do Dia** (ilha, faixa e 3 amuletos sorteados iguais pra todo mundo
naquele dia, 1 tentativa que vale recorde, sem prêmio exclusivo que dê culpa); **Só na Pata** (sem motor); **Maratona**
(as 5 ilhas seguidas com a mesma build de amuletos).

## Números (ponto de partida)
| Coisa | Valor |
|---|---|
| Ilha (uma partida) | 25–35 min na faixa branca; nunca abaixo de 15 |
| Escolhas de amuleto | 1 na chegada + 4 marcos = 5 por ilha |
| Rerrolar | 1, 2, 4, 8… sementes (zera por ilha) |
| Faixa | preço ×2,5, sementes ×1,5, +1 regra |
| Selo da fábrica | sem limite; +50% valor por estrela; níveis daquela máquina ×3 mais caros por estrela |
| Oficina | marco a cada 25 níveis depois do 50 |
| Conquista em escada | +1% por grau; ~1 grau fechando a cada 10 min de jogo |
| Meta de retenção | sempre existir uma compra ou escolha em ≤ 3 min, em qualquer hora de jogo (medir com `tools/longo.js --horas 100`) |

## Tela e controles
- **Escolha de amuleto:** 3 cartas grandes (pixel art, nome, texto de 1 linha, etiqueta, raridade), toque pra escolher,
  botão de rerrolar. É o momento mais gostoso da partida: carta vira, brilha, carimba.
- **Build à vista:** fila de até 5 amuletos no HUD (ícones pequenos; toque mostra o texto); conjunto aceso brilha.
- **Faixa** amarrada no Kome e no mapa das ilhas.

## Conteúdo
Fichas novas: `amuleto` (id, nome, texto, etiquetas, raridade, fx), `evolucao` (máquina + amuleto → nome, desenho),
`faixa` (regra), `conquista` em escada. É conteúdo barato de fazer em volume depois que o sistema existir.

## Ordem de construção
1. Tirar os tetos (sementes, Oficina, selos, formato de número): pequeno, entra junto com o rebalanço das sementes.
2. **Amuletos** (sistema + 30 fichas + tela de escolha): é a peça que mais muda o jogo. Fazer primeiro.
3. Faixas. 4. Evoluções. 5. Conquistas em escada e carta do dia. 6. Modos de partida.
A Fábrica ligada (`fabrica-ligacao.md`) e a Cidade continuam no plano: são o que é permanente entre as partidas.

## Fora do escopo
Multijogador, placar online, loja com dinheiro real, energia/vidas, qualquer coisa que castigue quem ficou sem jogar.

## Perguntas do programador
