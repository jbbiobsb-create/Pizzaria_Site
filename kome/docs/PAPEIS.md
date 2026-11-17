# Papéis: Designer × Programador

Dois Claude trabalham no Kome ao mesmo tempo. Cada um tem seu território; ninguém edita o arquivo do outro.
O dono (Elias) aprova o design antes de virar código e faz a ponte entre os dois.

## Designer (outro chat)
- **Faz:** a visão do jogo e de cada sistema (camadas, regras, progressão, números), o conteúdo (fichas: roupas, enfeites,
  bichinhos, eventos, lojas, desenhos em pixel de texto), textos do jogo (falas, nomes, descrições), lista de prioridades.
- **Escreve só em:** `docs/design/` e `conteudo/`. (Se for o Claude do NAVEGADOR, ele não vê a pasta: entrega o texto e o Elias
  salva em `docs/design/` ou cola pro programador. O contexto dele vem do pacote: `node tools/pacote.js`.)
- **Não mexe em:** `game/`, `engine/`, `tools/`, `index.html`, `game/data.js`. Números de balanço vão na spec (o programador
  passa pro data.js e mede com o playtest).
- **Antes de escrever:** ler `CLAUDE.md` (regras e gosto do dono), `docs/design/README.md` (formato) e `MAPA.md` (o que já existe).

## Programador (este chat)
- **Faz:** sistemas, integração, telas, desempenho, testes, balanço medido, HTMLs de entrega.
- **Escreve em:** `game/`, `engine/`, `tools/`, `index.html`, `MAPA.md`, `CONTINUAR.md`, `docs/PATCH-NOTES.md`.
- **Não muda o design por conta própria:** se uma regra não funciona ou falta informação, escreve a dúvida no fim da spec
  (seção "Perguntas do programador") e implementa o resto.

## Como uma ideia vira jogo
1. Designer escreve `docs/design/<sistema>.md` no formato do README (status: `rascunho`).
2. Elias lê e aprova (muda o status pra `aprovado`), ou pede mudança.
3. Programador implementa só specs `aprovado`, marca `em código` e depois `no jogo` (com o commit), e anota o que mudou.
4. Fichas novas em `conteudo/` entram sozinhas: o programador só roda `node tools/content.js` e os testes.

## Regras que valem pros dois (resumo do CLAUDE.md)
- Fofo × absurdo; toda máquina nova MAIOR na tela; nada parado; o arroz vai pra algum lugar e é vendido.
- Construções e coisas pequenas em pixel art Pixxel; máquinas grandes vetoriais.
- Celular deitado é o padrão. Público: jovem adulto (20–35) fã de idle/incremental. Jogo honesto: sem dinheiro real, sem culpa, sem punição por parar, sem push.
- Nada é publicado (itch.io etc.) sem o Elias pedir.
- Ideias já descartadas pelo dono: túneis na montanha, montanha em pixel/creme-lavanda ("parece areia"), soterramento do
  carrinho, máquinas em pixel.
