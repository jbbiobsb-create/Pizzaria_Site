# Kome no Japão — regras rápidas pro Claude

Jogo incremental de navegador (canvas 2D + HUD em DOM), pt-BR, roda abrindo `index.html` de `file://`.
Duas metades com o mesmo peso: o jogo (`game/`) e a engine Pixxel, reaproveitável (`engine/`).

## PREMISSA (palavra do dono; régua pra TODA decisão)
Tem uma montanha GIGANTE de arroz. Você começa cavando com as patinhas e termina cavando com uma máquina incrivelmente
grande e rápida, com uma fábrica que faz ganhar mais dinheiro. Bem Cookie Clicker: TUDO dá mais dinheiro, o dinheiro
sobe sem parar, dopamina "vap vap vap", incremental. Então:
- Cada sistema tem que responder "como isso me dá mais dinheiro / me faz cavar mais?" em UMA frase, visível na tela dele.
  Se não responde: ligar no dinheiro ou tirar do jogo. Nada de lugar vazio, botão que não faz nada, câmera que só passeia.
- O número de ¥ e a renda (¥/s) ficam sempre grandes e à vista, subindo. Toda compra mostra o salto ("+¥ 1,2 mi/s").
- Sempre tem uma compra perto (segundos, não minutos). Espera longa é defeito.
- Simples: nada escondido, tudo a 2 toques, uma pessoa de 50 anos joga sem ajuda (docs/design/ux-guia.md).

## Economia de token (o dono pediu)
- NÃO mandar print pro dono nem pausar pra aprovação a cada mudança. Seguir em frente.
- Verificar com `node tools/check.js` (saída curta; `--fast` pula o playtest de ~40 s; `--only celular`).
  Só abrir PNG (`--shots`, salva em `%TEMP%/kome-check`) quando o check acusar algo visual que precise de olho.
- Não ler arquivo grande inteiro: `grep -n` e ler só o trecho. `game/game.js` tem ~1700 linhas.
- Ler `CONTINUAR.md` (estado + pendências) só a seção que importa; GDD/notas em `docs/` só quando precisar.
- O projeto está no git: usar `git diff`/`git log` pra ver o que mudou. Commitar ao fim de cada passo que funciona.

## Antes de tudo: leia MAPA.md (onde mora cada coisa). Conteúdo novo = ficha, não código:
- `node tools/novo.js <enfeite|bicho|roupa|evento|loja> "Nome"` cria `conteudo/<tipo>-<id>.js`; editar o desenho em texto
  (letras = cores, ver topo de tools/content.js); `node tools/content.js` gera game/content.js; `node tools/galeria.js`
  mostra todos os desenhos numa imagem. Painel `index.html?dev` pra ajustar números jogando.

## Pedido de ARTE (bicho, casa, loja, máquina pequena, objeto de rua): NÃO desenhar pixel à mão. Escrever ficha com
`receita: { gerador: 'bicho'|'casa'|'maquina'|'props', ... }` em conteudo/, rodar `node tools/arte.js --galeria` (usa os
geradores do Pixxel Estúdio em estudio-pro/, sem abrir janela; sai animado) e olhar %TEMP%/kome-arte.png.
`node tools/arte.js --opcoes` lista espécies, modelos e ajustes. Várias receitas numa mensagem = arte quase de graça.
Máquinas GRANDES do jogo continuam vetoriais (bagger.js etc.).

## Ferramentas (tools/, usam o Chrome/Edge do PC via playwright-core em tools/node_modules)
- `node tools/check.js` — erros de página, sobreposição/fora da tela/botão pequeno/texto miúdo em desktop, celular deitado
  e em pé, + resumo do playtest. Código 1 se falhar.
- `node tools/sweep.js` — LABORATÓRIO: passa por todas as telas (jogo, menu, árvore, ajustes, Casa e abas, noite, oficina,
  gêmea) em PC, celular deitado e em pé e monta 1 folha de contato por aparelho em %TEMP%/kome-sweep. Rodar antes de
  entregar qualquer coisa visual e OLHAR as 3 folhas (3 imagens = barato).
- `node tools/monkey.js [--celular] [--partidas N]` — robô apertando tudo aleatório; só imprime problemas.
- `node tools/playtest.js --auto` (balanço) · `--rungs` (14 ferramentas) · `--verbose`.
- `node tools/longo.js --horas 10` — SIMULADOR DE HORAS: campanha → infinito → ilhas com jogador guloso; mostra duração das
  fases e TRECHOS CHATOS (>10 min sem novidade). Rodar depois de mexer em balanço do pós-final/ilhas.
- `node tools/planilha.js arq.csv [--substituir]` — planilha (tipo;nome;desc;preco;x;y;escala;receita) vira fichas + arte.
- `node tools/cookie.js` — planilha da camada Cookie (`conteudo/cookie*.csv`: upgrade/conquista/evento/nome) → `game/cookie-data.js`. Rodar depois de editar o CSV.
- `node tools/alicerce.js` — itens, save antigo migrando, E.Sim/offline. Rodar sempre que mexer em save ou em camada nova.
- `node tools/shot.js index.html out.png --query "?fresh&nointro" --eval "js" --size 844x390`.
- Ganchos no console: `__kome` (S, addMoney, buyTool, buyNode, buyHouse, setTool, step, hold, aim, play, newMountain, dbg).
- Se `tools/node_modules` sumir: `cd tools && npm i`.

## Regras do projeto
- JS clássico, sem ES modules, sem build, sem dependência no jogo. Tem que rodar de `file://`.
- Estilo: contorno `#3B2818`, paleta `E.PAL`, 3 tons por material, sem emoji/asset externo no mundo. Kome e coisas pequenas
  em pixel art (`Pix`); máquinas grandes vetoriais articuladas (`Draw`/`Rig`).
- Não mudar o desenho das 27 poses antigas do Kome (poses novas pode).
- Balanço só em `game/data.js`. Metas do `--auto`: final 60–90 min, espera máx ≤ 180 s, ≤ 50% cavado na Bagger.
- Toda ferramenta segue `G.Tools[id]` (`docs/NOTAS-FERRAMENTAS.md`).
- PÚBLICO: jovem adulto (20–35 anos) que gosta de idle/incremental (NÃO é jogo de criança). Humor pode ser mais adulto/nerd.
- Proibido mesmo assim (gosto do dono, jogo honesto): dinheiro real, loot box paga, push, culpa, quase-acerto fabricado, punição por parar.

## Gosto do dono
Shiba fofo × maquinário absurdo; toda ferramenta nova MAIOR na tela (upgrade só-número é bug); máquinas articuladas com
peso; nada parado; arroz vai pra algum lugar e é vendido; bem gamificado (metas à vista, suspense, coleção, celebração).
Fala informal em pt-BR.
