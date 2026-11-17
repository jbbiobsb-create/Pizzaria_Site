# Pixxel Estúdio

Estúdio de pixel art feito em cima da engine Pixxel. Abra `Pixxel_Estudio.html` no navegador (Chrome/Edge/Firefox). Tudo roda no seu computador; os projetos ficam salvos sozinhos no navegador (IndexedDB) e você pode baixar `.pixxel`.

## Novidades (versão "Photoshop do Kome")
- **Cara e atalhos do Photoshop**: tema escuro (Visualizar → tema claro Kome), menus Arquivo/Editar/Imagem/Camada/Selecionar/Filtro/Construir/Animação/Visualizar, barra de opções, ferramentas em grupos (botão direito no ícone ou Shift+letra), painel de Camadas com mesclagem/opacidade/travas e arrastar pra reordenar, Linha do tempo de quadros, prévia no topo dos painéis. F1 mostra todos os atalhos (V M L W C I J B S E G O T U H Z, Ctrl+T, Ctrl+J, Ctrl+E, Ctrl+Shift+E, Ctrl+U, Ctrl+L, Ctrl+I, Alt/Ctrl+Backspace, 1…0 opacidade, D, X, [ ], Tab, F…).
- **Ferramentas novas**: letreiro elíptico, laço poligonal, cortar demarcação, carimbo, texto pixel, zoom, esponja, pincel corretor, transformação livre com alças (Ctrl+T), opacidade do pincel, travar transparência, 9 modos de mesclagem.
- **✨ Modo guiado**: "Faça um Kome" em 11 passos (também gato, raposa, casa, castelo, onigiri) — camada certa, ferramenta e cor escolhidas, molde piscando, progresso em %, botão "Fazer pra mim".
- **Rascunhos prontos** (Alt+R): animais (15 espécies, 1× e 2×), Kome em todas as pelagens, casas, castelos, vilas, comida, máquinas, rua, objetos e bases dos pacotes — abrem com as camadas separadas e nomeadas, tags de animação e tipo pro jogo.
- **✨ Mágica / Filtro**: Estilo Kome, Sombra de artista, Contorno colorido (sel-out), Limpar traço, Luz de borda, Paleta harmoniosa, Espelhar metade, Pixelizar limpo, Variações de cor.
- **Mais animais**: capivara, cervo (Nara), ovelha, vaca, cavalo, hamster (+ chifres, crina, lã, rabo de cavalo).
- **Castelo japonês** e **Vila** (cena inteira, cada casa numa camada, dia e noite).

## O que tem
- **Construir** (botão verde no topo, ou Ctrl+B):
  - **Bicho**: cachorro, gato, urso, raposa, coelho, panda, tanuki, porco, lobo — feito peça por peça com a MESMA técnica do Kome (3 tons de pelo, creme, contorno da cor do pelo). Ajuste cabeça, focinho, corpo, pernas, orelha, rabo, olhos, padrão (listras, malhado, meias, máscara, panda), cores e acessório (kasa, lenço, coleira, laço, gorro, óculos). Resolução 1× (igual ao Kome), 2× e 3× (mais detalhe). Sai com 9 animações: parado, andar, correr, pular, sentar, abanar, dormir, comer, feliz.
  - **Casa**: japonesa, sobrado, loja com noren, chalé, celeiro, templo, moderna — andares, janelas, beiral, cores, chaminé com fumaça, lanterna, vasos, cerca, placa, varanda. Tags dia/noite (janelas acendem).
  - **Máquina**: trator, caminhão basculante, escavadeira, empilhadeira, carroça, caminhonete, rolo — rodas girando, fumaça, e animação de trabalho (bascular, cavar, levantar).
  - **Rua & chão**: tileset que emenda (grama, terra, pedra, tijolo, asfalto com faixa, calçada, meio-fio, plataforma, tábuas, água animada). Já fica escolhido no Mapa.
  - **Coisas da rua**: poste (acende à noite), semáforo (ciclo), máquina de venda, caixa de correio, banco, placa, lixeira, cone, barril, caixote, hidrante.
  - "Construir → Reabrir o construtor deste desenho" volta pros parâmetros pra mudar e gerar de novo.
- **Coisas do jogo Kome** (Biblioteca): as 12 ferramentas/máquinas do jogo (pata, hashi, tigela, pá, duas pás, carrinho, britadeira, trator carregadeira, empilhadeira, escavadeira, pá de cabo, caminhão de mineração, Bagger 293, colheitadeira) capturadas animadas (trabalhar/parado) dos próprios módulos do jogo; construções e adereços do pátio (fábrica, torre, vila, torii, sakura, barraquinha, casinha, silo, oficina, outdoor…); pickup, kei truck, moega; itens e ícones; e as fichas de `conteudo/`.
- **Desenhar**: telas até 1024×1024, camadas (opacidade, trancar, referência), quadros com duração própria, **tags de animação**, fantasma (onion skin), seleção (retângulo, laço, varinha) com mover/copiar/espelhar/girar/escalar, lápis com pixel perfeito, sombra que anda na rampa da paleta, retícula, degradê Bayer, spray, espelho ↔ ↕, contorno automático, sombra automática, histórico clicável (300 passos).
- **Cor**: seletor HSV + alfa, paletas prontas (Kome, Pico-8, Sweetie 16, Endesga 32, Game Boy…), **rampa com deslocamento de matiz**, importar/exportar `.gpl`/`.hex`.
- **O que é isso?**: desenhe e escolha o tipo (cachorro, gato, pessoa, robô, pássaro, peixe, borboleta, slime, casa, loja, castelo, árvore, planta, fogo, item, moeda, veículo, bandeira…). O estúdio acha patas/cabeça/rabo/braços/rodas, gera as animações com tags e põe na **altura do jogo** que você escolher (Kome ≈ 40 px).
- **Mapa & jogo**: tileset = qualquer desenho fatiado no tamanho do tile; mapa com 3 camadas (sólida pra colisão); **Testar no jogo** com o seu personagem (tags parado/andar/correr/pular) e o Kome seguindo.
- **Biblioteca**: Fábrica (30 receitas, até tamanho Colossal), Kome em todas as poses (animado), cenário do jogo e pacotes convertidos.
- **Exportar**: spritesheet PNG + JSON no formato do Aseprite (serve pra Godot, Unity, Phaser…), GIF animado, PNG por quadro, ficha do jogo (letras), **pacote pra engine** (`.pixxel.js`).

## Usar no seu jogo (módulo novo da engine: `engine/assets.js`)
```html
<script src="engine/core.js"></script>
<script src="engine/pix.js"></script>
<script src="engine/assets.js"></script>
<script src="cachorro.pixxel.js"></script>   <!-- exportado pelo estúdio -->
<script>
  const dog = Pixxel.Anim('cachorro', 'parado');
  // no loop do jogo:
  dog.play(andando ? 'andar' : 'parado');
  dog.flip = olhandoPraEsquerda;
  dog.update(dt);
  dog.draw(g, x, y);            // pés em (x, y)
</script>
```
Também dá pra carregar spritesheet + JSON: `Pixxel.Assets.fromSheet('dog', 'dog.png', 'dog.json')`.

## Código-fonte
`src/` (base, editor, rigs, io, map, library, ui, page.html) + `engine/assets.js`. Pra gerar o HTML: coloque ao lado as pastas `engine/engine` (sua engine) e `fabrica/` (gen.js e pacotes.js) e rode `python3 build.py`.

## Licenças dos pacotes convertidos
Ironblossom e Lantern Street: pode usar e modificar nos seus jogos; **não pode redistribuir os assets nem usar pra treinar IA**. Lantern Street pede crédito (opcional): "Background art by KATO". Não publique o HTML como pacote de assets.
