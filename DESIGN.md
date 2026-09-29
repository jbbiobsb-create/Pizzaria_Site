# DESIGN.md · Sesconetto's Pizzeria

Sistema de design para o site/app de pedidos (CSS puro, sem build) e base para o app nativo.
Formato de cada item: **token** + **regra** + **porquê**. Valores em px (mobile-first, 390 de referência).

Leitura de direção (design-taste 0.B): *redesign-overhaul de um app de delivery de pizzaria artesanal, público que pede pelo celular, linguagem "selo e forno": papel claro quente, tinta preta do selo, um único acento tomate, fotografia grande. Sem checkered cloth, sem creme+terracota+serif genérico.* Dials: VARIANCE 5 · MOTION 4 · DENSITY 6 (app de pedidos, não landing).

---

## 0. Como usar este arquivo

- Todos os tokens vivem em `:root` de `css/style.css`. Os nomes antigos que o JS lê (`--header-h`, `--header-base`, `--sub-h`, `--tab-h`, `--chips-h`, `--barra-h`, `--banner-h`, `--safe-b`) **continuam existindo**; `js/ui.js` grava `--barra-h`/`--banner-h` no `body` e isso não muda.
- Tokens antigos de cor (`--creme`, `--tomate`, `--forno`, `--queijo`, `--manjericao`, `--pedra`, `--linha`, `--texto`, `--texto-2`, `--verde-ok`, `--erro`) viram **aliases** dos novos durante a migração (`--creme: var(--papel)` etc.) para nada quebrar. Depois, remover.
- Não mudar nomes de classes/ids/`data-*`. Mudar só o estilo. Onde a estrutura HTML precisa mudar está marcado com **[HTML]** no plano por página (aud-visual.md).
- Dark mode: **não** (ver §10).

---

## 1. Cor

### 1.1 Papel (superfícies claras)

| token | hex | papel |
|---|---|---|
| `--papel` | `#FBF9F6` | fundo da página. Branco levemente quente (farinha), não creme. |
| `--papel-2` | `#F3EFE8` | superfície rebaixada: chips inativos, fundo de input, skeleton, caixa "eta", thumb vazia. |
| `--branco` | `#FFFFFF` | cards, painéis, sheet, header, tab bar, barra fixa. |
| `--linha` | `#E8E3DC` | hairline entre itens de lista, borda de card, borda do header/tab bar. |
| `--linha-2` | `#D6CFC6` | borda de input em repouso (o input também tem fundo `--papel-2`, então a borda não precisa passar em 3:1 sozinha). |

**Regra:** a página é `--papel`; tudo que "flutua" ou agrupa é `--branco` com hairline `--linha`; sombra só no que é realmente fixo/flutuante (§5).
**Porquê:** o brief pede fundo claro quente para leitura e apetite. Mas o creme `#F7F0E6` atual é exatamente a paleta-padrão de IA ("warm cream + serif + terracota", frontend-design e design-taste 4.2). Um branco quase puro com 1 ponto de calor deixa a fotografia (que já é quente e escura) carregar o apetite, e o app fica limpo como um app de pedidos precisa ser.

### 1.2 Tinta (texto)

| token | hex | contraste sobre `--papel` / `--branco` / `--papel-2` | papel |
|---|---|---|---|
| `--tinta` | `#1A1A1A` | 16,6 / 17,4 / 15,2 | texto principal, preços, títulos. Preto neutro do selo (não "espresso" tingido). |
| `--tinta-2` | `#5F5B57` | 6,4 / 6,7 / 5,9 | texto secundário, descrições, labels. |
| `--tinta-3` | `#6F6A65` | 5,1 / 5,4 / 4,7 | placeholder de input, helper text. Passa AA em qualquer superfície clara. |
| `--tinta-4` | `#8C8680` | 3,4 / 3,6 / 3,1 | só ícone decorativo, texto desabilitado, ícone de estado vazio. Nunca texto informativo. |

**Regra:** texto informativo usa `--tinta` ou `--tinta-2`. Placeholder usa `--tinta-3` (design-taste "form contrast check"). `--tinta-4` nunca carrega informação.
**Porquê:** o site atual usa `--texto-2 #6f645b` (5,1:1) e `--pedra-clara #c9c0b6` em placeholders (falha AA). WCAG AA 4,5:1 para texto normal é requisito, não polimento.

### 1.3 Forno (momentos escuros)

| token | hex | papel |
|---|---|---|
| `--forno` | `#171717` | fundo do hero (por trás da foto), cartão do cashback, chip ativo, tag "Mais pedida", toast. |
| `--forno-2` | `#262626` | superfície elevada dentro do escuro (chip de nível no cartão, faixa da barra de progresso). |
| `--forno-texto` | `#FFFFFF` | texto sobre forno (17,9:1). |
| `--forno-texto-2` | `#B5AEA6` | texto secundário sobre forno (8,2:1 em `--forno`, 6,9:1 em `--forno-2`). |
| `--forno-linha` | `rgba(255,255,255,.12)` | hairline sobre forno. |

**Regra:** escuro é **componente**, nunca **seção** inteira: hero (foto), cartão do cashback, banner do Clube, toast, chip ativo. Rodapé, "Nossa massa", barra fixa e header passam a ser claros.
**Porquê:** o brief pede momentos "forno" (hero, cashback). design-taste 4.11 (theme lock) proíbe seções alternando claro/escuro no meio do scroll. As duas coisas se conciliam se o escuro for um objeto com raio dentro da página clara, não uma faixa de borda a borda. O rodapé escuro + faixa xadrez atuais são exatamente o "flip" que parece colagem.

### 1.4 Acento: tomate (um só)

| token | hex | contraste | papel |
|---|---|---|---|
| `--tomate` | `#C8321F` | branco sobre ele 5,3:1 · ele sobre `--papel` 5,1:1 · sobre `--branco` 5,3:1 · sobre `--papel-2` 4,7:1 | botão primário, "+" do card, stepper, tab ativa, link de ação, foco, badge de contagem. |
| `--tomate-2` | `#A8281A` | branco 7,0:1 · sobre `--tomate-tint` 6,0:1 | hover/pressed do primário, texto sobre `--tomate-tint`. |
| `--tomate-tint` | `#FBEAE7` | | fundo de opção selecionada, tag "Novidade", fundo do ícone em estado vazio de destaque. |

**Regra (color lock):** vermelho = ação ou estado selecionado. **Preço não é vermelho** (é `--tinta` 700). Nenhum outro acento decorativo: o dourado `--queijo` atual sai da borda do logo, do `em` do hero, do saldo do cashback e da barra de progresso.
**Porquê:** um acento (design-taste 4.2, redesign "more than one accent color: pick one"). Molho San Marzano é o material real da marca, então o vermelho é justificado como cor da marca, não como default "food = laranja/vermelho" do banco (ui-ux-pro-max sugere `#DC2626` + fundo rosado `#FEF2F2`; aceito a família, rejeito o fundo rosado porque tinge a foto e compete com o molho). Saturação HSL 73% (<80%, design-taste). Preço em preto lê como "cardápio impresso" e deixa o vermelho apontar só o que é clicável.

### 1.5 Semânticas

| token | hex | contraste | papel |
|---|---|---|---|
| `--manjericao` | `#2F7A46` | branco 5,3:1 · sobre branco 5,3:1 | sucesso, "aberto", cashback creditado, toggle ligado, ícone "vegetariana". |
| `--manjericao-2` | `#1F5A32` | sobre `--manjericao-tint` 7,1:1 · sobre papel 7,8:1 | texto em avisos verdes. |
| `--manjericao-tint` | `#E6F2E9` | | fundo de aviso ok, tag vegetariana/vegana, bloco cashback no checkout. |
| `--queijo` | `#7A4F0A` | sobre `--queijo-tint` 6,4:1 | texto de atenção: "Fechado agora", cashback previsto, nível Ouro. |
| `--queijo-tint` | `#FCF1DC` | | fundo desses avisos. |
| `--erro` | `#B3261E` | branco 6,5:1 · sobre branco 6,5:1 · sobre `--erro-tint` 5,7:1 | mensagem de erro inline, toast de erro, remover item (só no `:active`). |
| `--erro-tint` | `#FCEBE9` | | fundo de aviso de erro. |
| `--wa` | `#25D366` | branco sobre ele 2,0:1 (**falha**) | **só cor de ícone**. Botão WhatsApp = fundo branco, borda `--linha-2`, ícone `--wa`, texto `--tinta`. |

**Regra:** semântica sempre com ícone + texto, nunca só cor. Erro e acento são vermelhos próximos; a diferença é de forma: erro vem em caixa tint com ícone de alerta e texto, ação vem em botão preenchido.
**Porquê:** o botão verde WhatsApp atual com texto branco está em 1,98:1 (reprovado). Manter o verde oficial só no glifo respeita a marca do WhatsApp (pro-rules "correct brand logos") e para de disputar com o primário.

### 1.6 Foco

`--foco: var(--tomate)`; `:focus-visible { outline: 2px solid var(--foco); outline-offset: 2px; }`; em inputs `outline-offset: 0` + `border-color: var(--tomate)`.
**Porquê:** 2px + 3:1 contra o fundo (5,1:1) atende WCAG 2.2 "focus appearance". O amarelo atual (`--queijo`) some sobre creme.

### 1.7 theme-color

`<meta name="theme-color" content="#FFFFFF">` em todas as páginas (hoje `#1f1b18`); `manifest.webmanifest` `theme_color` idem, `background_color` `#FBF9F6`.
**Porquê:** o header vira branco; o vercel-guidelines pede theme-color = cor da página.

---

## 2. Tipografia

### 2.1 Famílias

| token | valor | pesos | uso |
|---|---|---|---|
| `--f-display` | `"Young Serif", Georgia, "Times New Roman", serif` | 400 (única) | h1 do hero, h2 de seção, nome do produto na página dele, título do status do pedido, título de sheet, wordmark no header desktop, estados vazios. **Nunca números/preços.** |
| `--f-ui` | `"Instrument Sans", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` | variável 400..700 (usar 400, 500, 600, 700) | tudo o resto: corpo, cards, botões, inputs, preços, labels, tab bar. |

Carregamento (sem build): baixar os `.woff2` do Google Fonts e servir de `/fonts/` (o service worker já cacheia assets, então fontes ficam disponíveis offline e no app instalado).

```html
<link rel="preload" href="/fonts/instrument-sans-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/young-serif.woff2" as="font" type="font/woff2" crossorigin>
```
```css
@font-face { font-family: "Instrument Sans"; src: url("/fonts/instrument-sans-var.woff2") format("woff2"); font-weight: 400 700; font-display: swap; }
@font-face { font-family: "Young Serif"; src: url("/fonts/young-serif.woff2") format("woff2"); font-weight: 400; font-display: swap; }
body { font-family: var(--f-ui); font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
```
Enquanto os arquivos não estão no repo, a URL do Google Fonts equivalente é `https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&family=Young+Serif&display=swap`.

**Porquê:** Inter (atual) é banida pelas skills high-end/design-taste/redesign como "fonte default de IA". O ui-ux-pro-max devolve para "restaurant" o par *Playfair Display SC + Karla*; rejeitado porque Playfair é justamente a fonte atual que o dono acha genérica, e Playfair+creme+terracota é o tell nº1 listado no frontend-design. Serif fica justificada (design-taste 4.1) porque o logo é um selo heritage com wordmark serifado: **Young Serif** tem letras largas, macias, quase pintadas à mão, que conversam com "Rustic Italian Dishes" sem virar Bodoni de restaurante caro; tem só um peso, o que força disciplina (a boldness gasta em um lugar só, frontend-design). **Instrument Sans** é neutra o suficiente para um app de pedidos, tem números tabulares e leve calor humanista; não é Inter/Roboto/Helvetica. Ambas estão no Google Fonts (confirmado em `google-fonts.csv`) e cobrem `latin-ext` (ç, ã, õ). Self-host: design-taste 3.A ("never link Google Fonts in production") + vercel-guidelines (preload de fonte crítica) + PWA offline.

### 2.2 Escala (px / line-height / peso / tracking)

| token | mobile | ≥900px | família | uso |
|---|---|---|---|---|
| `--t-hero` | 34 / 1.08 / 400 / -0.01em | 52 / 1.04 | display | h1 da home (máx. 2 linhas em 390; máx. 8 palavras). |
| `--t-h1` | 28 / 1.1 / 400 / -0.005em | 36 / 1.08 | display | nome do produto, status do pedido ("Em preparo"), título de estado vazio. |
| `--t-h2` | 22 / 1.15 / 400 | 26 / 1.15 | display | título de seção ("As mais pedidas", "Pizzas"), título de sheet, título de painel. |
| `--t-h3` | 17 / 1.3 / 600 | 17 | ui | bloco dentro da página ("Tamanho", "Quando?", "Pagamento"). |
| `--t-title` | 16 / 1.3 / 600 | 16 | ui | nome no card, item da sacola, nome da loja. |
| `--t-body` | 15 / 1.5 / 400 | 16 / 1.55 | ui | corpo, descrições longas, sheet. |
| `--t-small` | 13 / 1.4 / 400 | 13 | ui | descrição no card (2 linhas), helper, meta ("Lata 310ml"). |
| `--t-caption` | 12 / 1.3 / 600 | 12 | ui | tag, label da tab bar (11), badge, label "Total" na barra. **Sentence case**, tracking 0. |
| `--t-price` | 15 / 1.2 / 700 | 15 | ui + tnum | preço no card e na sacola. |
| `--t-total` | 20 / 1.1 / 700 / -0.01em | 22 | ui + tnum | total na barra fixa, total no resumo. |
| `--t-money-xl` | 40 / 1.0 / 700 / -0.02em | 44 | ui + tnum | saldo do cashback. |
| `--t-btn` | 15 / 1 / 600 | 15 | ui | botão padrão; `btn-lg` 16; `btn-sm` 14. |
| `--t-input` | 16 / 1.3 / 400 | 16 | ui | **sempre 16px** em input/select/textarea. |

**Regras:**
- `h1, h2, .modal h2 { text-wrap: balance; }` e parágrafos longos `text-wrap: pretty`.
- Medida: descrições ≤ 65ch (`max-width: 65ch` em `.produto .desc`, `.sobre p`, `.regulamento`).
- Sem ALL CAPS: tags, labels de barra, eyebrow. Sentence case (frontend-design: "all caps for labels" é tell; ui-ux-pro-max: readable).
- Sem itálico de uma palavra no h1 (o `em` dourado do hero sai).
- Reticências como `…`, aspas curvas, `40 a 60 min` em vez de `40–60 min` (design-taste 9.G; e em pt-BR "a" lê melhor).
- Números sempre `tabular-nums` (preço, hora, contagem, PIN).
**Porquê:** 15px de corpo em 390 é o padrão de apps de delivery (iFood/Rappi) e cabe mais conteúdo acima da dobra; 16px em input evita o zoom do iOS. O contraste serif grande + sans pequena é a hierarquia inteira; não precisa de eyebrow nem de cor para dizer "isto é título".

---

## 3. Espaço

| token | px | uso |
|---|---|---|
| `--e-1` | 4 | gap ícone/texto em chip, entre tag e título. |
| `--e-2` | 8 | gap entre chips, entre linhas de texto de um card, padding vertical de tag. |
| `--e-3` | 12 | padding interno de card compacto, gap entre cards da lista, gap thumb/texto. |
| `--e-4` | 16 | **gutter da página no mobile**, padding de painel, gap entre grupos de opção. |
| `--e-5` | 20 | padding de sheet e de painel de checkout. |
| `--e-6` | 24 | gutter em ≥640, padding do cartão do cashback, espaço entre blocos na página do produto. |
| `--e-7` | 32 | gutter em ≥900, espaço entre seções da home. |
| `--e-8` | 40 | espaço acima do rodapé, padding de estado vazio. |
| `--e-9` | 64 | seção "Nossa massa" e "Lojas" no desktop. |

`.container { width: min(1120px, 100% - 2 * var(--gutter)); }` com `--gutter: 16px` → `24px` (≥640) → `32px` (≥900).
Alturas de chrome: `--header-base: 56px` (mobile e desktop; desktop 64), `--sub-h: 44px`, `--chips-h: 52px`, `--tab-h: 56px`, `--barra-h: 72px` (o JS mede a real).

**Regra:** só valores da escala. Seções da home separadas por `--e-7` (32) no mobile, não 52.
**Porquê:** ritmo 4/8 (pro-rules); a home atual gasta 2 telas em 6 atalhos gigantes antes de mostrar uma pizza. Em app de pedidos, "macro-whitespace py-24" do high-end-visual-design é o oposto do que o usuário quer (skill fora de escopo para "multi-step product UI", como o próprio design-taste §13 admite; aplico as regras de landing só na home acima da dobra).

---

## 4. Raios (shape lock)

| token | px | onde |
|---|---|---|
| `--r-xs` | 6 | tag, badge quadrado do "n" na barra da sacola, caixa de código Pix. |
| `--r-sm` | 10 | thumb de card, foto do item da sacola, ícone do upsell, caixa "eta". |
| `--r-md` | 12 | **botão**, input, select, textarea, opção (radio/check card), tile de entrega/retirada. |
| `--r-lg` | 16 | card, painel, banner do Clube, grupo de lista, banner "Instalar app". |
| `--r-xl` | 24 | sheet (topo), cartão do cashback, "ticket" de info do hero, conteúdo que sobrepõe a foto do produto. |
| `--r-pill` | 999 | chip de categoria, seg Entrega/Retirada, pill de endereço, stepper, badge numérico, toast, chip de nível, botão só-ícone (círculo). |

**Regra escrita (design-taste 4.4):** *ações e campos são retângulos de 12; superfícies são 16; o que "contém uma tela" (sheet, cartão hero) é 24; só o que é "token" (chip, badge, stepper, pill de endereço) é pílula.*
**Porquê:** hoje botão, chip, pill, toast, stepper e badge são todos 999px e o card 14px: tudo parece a mesma cápsula (o "SaaS-card kit" do frontend-design). Botão 12px lê "app", pílula fica reservada para filtros e contadores, como no iOS/Material.

---

## 5. Elevação (sombra e borda)

| token | valor | onde |
|---|---|---|
| `--sombra-0` | `none` + `border: 1px solid var(--linha)` | card, painel, grupo de lista (repouso). |
| `--sombra-1` | `0 1px 2px rgba(26,20,15,.06), 0 1px 1px rgba(26,20,15,.04)` | card em hover (só `@media (hover:hover)`), tile selecionado. |
| `--sombra-2` | `0 8px 24px -8px rgba(26,20,15,.22)` | barra "Ver sacola" flutuante, banner "Instalar app", toast, botão "+" do card. |
| `--sombra-3` | `0 -8px 32px rgba(26,20,15,.16)` | sheet aberto, barra fixa (`.barra-fixa`). |
| `--sombra-forno` | `0 12px 32px -12px rgba(0,0,0,.45)` | cartão do cashback e banner do Clube sobre papel. |

**Regra:** sombra tingida de marrom-quente (26,20,15), nunca preto puro; nada de sombra em card em repouso; `translateY(-2px)` em hover de card sai.
**Porquê:** redesign-skill "generic box-shadow / tint to background hue"; frontend-design lista "the same soft grey shadow under each card" como tell. Card só com hairline sobre papel-quase-branco já dá separação.

---

## 6. Bordas

- Hairline: `1px solid var(--linha)`; sobre forno: `1px solid var(--forno-linha)`.
- Input repouso: `1px solid var(--linha-2)` + fundo `--papel-2`; foco: `border-color: var(--tomate)` + `outline: 2px solid var(--tomate); outline-offset: 0` (visualmente 2px sólidos); erro: `border-color: var(--erro)`.
- Opção selecionada: `2px solid var(--tomate)` + fundo `--tomate-tint` (o 2px substitui o 1.5px, sem mudar o layout: usar `box-shadow: inset 0 0 0 1px var(--tomate)` por cima da borda de 1px).
- Linha divisória de totais: `1px solid var(--linha)` (a linha tracejada sai).
- Nada de `border: 1.5px`: 1 ou 2.
**Porquê:** bordas tracejadas e 1.5px são meio-termo que renderiza serrilhado em 2x/3x; `inset box-shadow` para seleção evita pulo de 1px no layout (pro-rules "pressed-state visuals do not shift layout").

---

## 7. Ícones

- Manter `js/icons.js` (SVG inline, `viewBox 24`, `stroke: currentColor`). Não trocar por biblioteca: sem build, sem dependência, já cobre os 60 glifos usados.
- Padronizar traço: `stroke-width: 1.75` como default no `icone()` (hoje 2) e **remover** os overrides 2.5 (`.card .add .i`, `.stepper .i`, `.qtd .i`) e 1.25/1.5 (foto vazia). Exceção única: ícones ≤16px (`.tag`, `.hero-info`, `.cb-card .venc`) usam `stroke-width: 2` para não sumirem.
- Tamanhos como token: `--ic-sm: 16px`, `--ic-md: 20px` (botões, chips, inputs), `--ic-lg: 24px` (tab bar, header), `--ic-xl: 32px` (estado vazio, tile de entrega). Só esses quatro.
- Ícone junto de texto visível: `aria-hidden="true"` (já é). Botão só-ícone: `aria-label` (já é).
- Glifos a redesenhar na mesma gramática (traço único, cantos redondos): `pizza` (o triângulo com bolinhas parece sinal de trânsito; virar fatia em perspectiva ou pizza redonda com um corte), `meio` (círculo dividido está bom), `moto` (ok), `loja` (ok).
**Porquê:** design-taste 3.C proíbe misturar famílias e pede stroke único; redesign-skill idem. A skill high-end pede "ultra-light 1.5": em 20px sobre foto e em tab bar 1.5 some; 1.75 é o compromisso legível (Phosphor Regular = 1.5 em 256 ≈ 1.75 em 24 com o arredondamento de traço). Não instalar Phosphor porque design-taste 3.F/redesign "não trazer biblioteca sem checar dependências" e o projeto não tem `package.json` de front.

---

## 8. Imagens

| contexto | proporção | tamanho de origem | tratamento |
|---|---|---|---|
| Hero home (mobile) | 4:5 (390×488) cortado para `min-height: 420px` | 1200×1500 | `object-fit: cover; object-position: 50% 60%`; scrim `linear-gradient(180deg, rgba(23,23,23,0) 30%, rgba(23,23,23,.55) 62%, rgba(23,23,23,.88) 100%)`. Sem filtro de opacidade na foto (hoje `.55` deixa tudo lavado). |
| Hero home (desktop) | 16:7 (1440×630) | 2400×1050 | scrim lateral `linear-gradient(90deg, rgba(23,23,23,.82) 0, rgba(23,23,23,.35) 55%, rgba(23,23,23,.1) 100%)`. |
| Foto do produto (mobile) | 4:3, largura total, sem raio no topo | 1200×900 | conteúdo sobe -20px com `--r-xl` por cima da foto (padrão "sheet sobre imagem" de app). |
| Foto do produto (desktop) | 1:1 em coluna, `--r-lg` | 1200×1200 | |
| Thumb do card (lista) | 1:1, 96×96 mobile / 112 desktop, `--r-sm` | 480×480 | `object-fit: cover`. |
| Card "Mais pedidas" na home (carrossel) | 1:1, 160×160 | 480×480 | |
| Item da sacola / upsell | 1:1, 56 / 120 | 240 | |
| Recorte em fundo branco (latas, garrafas, combos) | 1:1 | 480 | classe `.foto--recorte`: `object-fit: contain; padding: 8px; background: var(--papel-2); mix-blend-mode: multiply` para o retângulo branco sumir sobre o fundo quente. Aplicar por categoria (`bebidas`, `cervejas`, `vinhos`, `combos`) em `cards.js` ou por atributo `data-recorte` no produto. |
| Chef / "Nossa massa" | 4:5 | 1200×1500 | `--r-lg`, sem sombra grande. |
| Logo | selo 36 (header mobile), 40 (desktop), 88 (offline), sempre circular com `border: 1px solid var(--linha)`; **sem** a borda dourada de 2px. | | O selo é preto/branco: qualquer moldura colorida briga com ele. |

**Regras:** `width`/`height` explícitos em todo `<img>` (CLS); `loading="lazy"` abaixo da dobra; hero com `fetchpriority="high"`; sem texto/pill sobre foto (o eyebrow "Forno a lenha" sai da foto); descrever `alt` quando a foto é conteúdo (produto), `alt=""` quando decorativa.
**Porquê:** a foto é o argumento de venda. Hoje o hero mostra a pizza a 55% de opacidade sobre toalha xadrez e a página do produto corta uma foto 1:1 em 16:9 com raio de 14. Na lista, latas em fundo branco puro dentro de card branco sobre creme criam "caixas" (visível em `ux-cardapio-stepper.png`).

---

## 9. Movimento

| token | valor | uso |
|---|---|---|
| `--dur-1` | 120ms | pressed (`:active` scale .97), troca de cor de chip, hover de botão. |
| `--dur-2` | 200ms | toggle do switch, aparecer/sumir de badge, stepper trocando de "+" para pílula, toast. |
| `--dur-3` | 320ms | sheet entrando (`translateY(100%) → 0`), barra "Ver sacola" subindo, banner "Instalar". |
| `--dur-saida` | 160ms | qualquer saída (sheet fechando, toast sumindo). Saída mais rápida que entrada. |
| `--ease-out` | `cubic-bezier(.2,.8,.2,1)` | entradas e hover. |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` | saídas. |
| `--ease-std` | `cubic-bezier(.4,0,.2,1)` | mudanças de estado no lugar (switch, cor). |

**Regras:**
- Só `transform` e `opacity` animam (nada de `top/left/height`); `transition` lista propriedades, nunca `all`.
- Um único momento não solicitado por página: na home, o h1 + botões do hero entram com `opacity 0→1, translateY(12px→0)` em `--dur-3` uma vez. Sem reveal por seção, sem parallax, sem hover-lift em card.
- Feedback de ação sempre: `:active` em botão/chip/opção/card = `transform: scale(.97)` (já existe; manter), `--dur-1`.
- Badge da sacola: `pulse` existente (manter, 350ms). "+" do card virando "✓" e depois stepper: cross-fade `--dur-2`.
- Sheet: usa a `@keyframes sobe` existente, mas com `translateY(100%)` em vez de 30px, `--dur-3 --ease-out`; fechar com classe `.saindo` `--dur-saida`.
- Timeline: passo atual pulsa (`pulsa`, já existe) 1.6s; é o único loop infinito permitido (é estado real, ui-ux-pro-max "motion conveys meaning").
- `@media (prefers-reduced-motion: reduce)` mantém o bloco atual (zera tudo).
**Porquê:** frontend-design: "one orchestrated moment lands better than scattered effects"; design-taste "motion must be motivated"; ui-ux-pro-max §7 "exit faster than enter". O high-end pede scroll-reveal em tudo e cubic-bezier de 700ms; rejeitado porque num app de pedidos cada reveal é 300ms entre o cliente e a pizza.

---

## 10. Dark mode

**Não.** O tema é claro e travado (`color-scheme: light` no `html`). Justificativa: (1) apetite depende de foto quente sobre fundo claro; (2) os momentos "forno" já dão o contraste dramático; (3) o time é pequeno e dual-mode dobra o QA de contraste (pro-rules). Design-taste 6.C pede dark por padrão; o brief diz não; brief vence. Deixar os tokens semânticos prontos (já estão) para o app nativo decidir depois.

---

## 11. Componentes

Cada bloco: seletor existente → tokens → regra → porquê. Nomes de classe/id não mudam.

### 11.1 Header (`.header`, `.logo`, `.nav`, `.header-right`, `.btn-carrinho`, `.btn-pedir`)

- Fundo `--branco`, `border-bottom: 1px solid var(--linha)`, altura `--header-base` 56 (mobile) / 64 (desktop), `padding-top: env(safe-area-inset-top)` (manter). Sem sombra.
- `.logo img`: 36px (mobile) / 40 (desktop), circular, `border: 1px solid var(--linha)`, sem borda dourada. `.logo span`: wordmark "Sesconetto's" em `--f-display` 18px `--tinta`; `small` ("Napolitana · Brasília") sai no mobile e no desktop (é o tipo de "meta string com middle dot" que o frontend-design cita).
- **[HTML]** No mobile, a `.pill-end` (endereço) passa a ficar **dentro do header**, entre logo e sacola, com `flex: 1`. Em `ui.js` mover o `<button class="pill-end">` para dentro de `.header .container` (o JS acha por `[data-abrir-entrega]`, não por posição). No desktop ela fica no mesmo lugar, à direita da nav.
- `.pill-end`: `--r-pill`, fundo `--papel-2`, sem borda, altura 40 (44 em `pointer: coarse`), ícone `pin` `--tomate` 20px, texto 14/600 `--tinta` com ellipsis, chevron `--tinta-2` 16px à direita (**[HTML]** adicionar `${icone('chevron-baixo')}` ao final; criar glifo `chevron-baixo` em icons.js).
- `.btn-carrinho`: 44px circular `--papel-2`, ícone 24 `--tinta`; `.badge`: `--tomate`, branco, 18px, `--t-caption`, `top:-2px; right:-2px`.
- `.nav a` (desktop): 15/500 `--tinta-2`; ativo `--tinta` 600 com `border-bottom: 2px solid var(--tomate)` alinhado ao fundo do header. `.btn-pedir`: botão primário `btn-sm`.
**Porquê:** o header preto de 54px + subheader branco de 48 é chrome demais e o preto full-bleed é o "flip" de tema. Endereço no header é a convenção que o público já conhece (iFood, Rappi): a primeira coisa que o app pergunta é "onde entregar". Logo sem moldura respeita o selo.

### 11.2 Subheader (`.subheader`, `.seg`, `.status-loja`, `.faixa-fechada`)

- Fundo `--branco`, altura `--sub-h` 44, `border-bottom: 1px solid var(--linha)`, `top: var(--header-h)` (manter sticky). Sem borda entre header e subheader (mesma superfície).
- `.seg`: trilho `--papel-2` `--r-pill` altura 36; botão ativo `--forno` com texto branco 13/600 (o vermelho fica para CTA); inativo `--tinta-2`.
- `.status-loja`: texto 13/600 à direita: "Aberto · até 23:30" (verde `--manjericao`) ou "Fechado · abre 18:00" (`--queijo`); o ponto `i` é semântico (estado real), 8px, permitido. **[JS opcional]** incluir a hora de fechamento no texto (hoje só "Aberto").
- `.faixa-fechada`: fundo `--queijo-tint`, texto `--queijo`, 13/500, ícone relógio, link "Agendar" sublinhado `--tinta`.
- **Fase 2 (opcional, muda JS):** o toggle Entrega/Retirada já existe dentro do sheet (`.escolha-entrega`); o `.seg` pode sair do mobile e o tipo aparecer como prefixo na pill ("Entrega · QMSW 5, 10"), liberando 44px. Não fazer agora.
**Porquê:** um bloco branco contínuo de 100px com hairline única lê como app bar; dois blocos com cores diferentes leem como site.

### 11.3 Tab bar (`.tabbar`, `.tabbar a`, `.tabbar .badge`)

- Fundo `--branco`, `border-top: 1px solid var(--linha)`, altura `--tab-h` 56 + `--safe-b`. Sem `::before` (a barrinha vermelha no topo sai).
- Item: ícone 24 (`stroke-width` 1.75), label 11/600, gap 2px; inativo `--tinta-2`; ativo `--tomate` (ícone e label), `aria-current="page"` (já é).
- Badge: `--tomate`, 16px, `--t-caption` 11, posicionada `top: 6px; right: calc(50% - 22px)`.
- `:active` do item: `opacity .7` em `--dur-1` (não scale, para o rótulo não tremer).
**Porquê:** 4 abas, cor + peso indicam a ativa; indicador de linha no topo é Android antigo. Manter o ícone da aba "Cardápio" igual ao glifo `pizza` redesenhado.

### 11.4 Botão (`.btn` e variantes `.btn-outline`, `.btn-ghost`, `.btn-light`, `.btn-dark`, `.btn-lg`, `.btn-sm`, `.btn-block`, `.btn-wa`, `.btn-icone`)

| variante | fundo | texto | borda | uso |
|---|---|---|---|---|
| primário `.btn` | `--tomate` | `#FFF` | none | uma ação principal por tela. |
| hover/active | `--tomate-2` | | | `@media (hover:hover)`; `:active` scale .97. |
| secundário `.btn-outline` | `--branco` | `--tinta` | `1px solid var(--linha-2)` | segunda ação (Retirar na loja, Adicionar mais itens, Ligar). **Texto preto, não vermelho.** |
| terciário `.btn-ghost` | transparent | `--tinta-2` (600) | none | "Limpar", "Voltar à sacola", links de rodapé de sheet. |
| `.btn-light` | `--branco` | `--tinta` | `1px solid var(--linha-2)` | sobre foto/forno (hero "Retirar na loja", cartão do cashback). Alias visual de `.btn-outline`. |
| `.btn-dark` | `--forno` | `#FFF` | none | ações dentro de superfícies escuras; "Saiba mais" do Clube vira `.btn-light`. |
| `.btn-wa` | `--branco` | `--tinta` | `1px solid var(--linha-2)` | ícone `wa` em `--wa` 20px. |
| `.btn-icone` | `--papel-2` | `--tinta` | none | 44px circular. |

- Geometria: `--r-md` 12; altura 44 (`btn-sm` 40, `btn-lg` 52); padding-inline 20 (`lg` 24, `sm` 14); `--t-btn`; gap ícone 8; ícone 20.
- Desabilitado: fundo `--papel-2`, texto `--tinta-4`, sem opacity (opacity deixa o texto ilegível sobre foto); `cursor: not-allowed`.
- Carregando: texto vira "Calculando…" (já faz) + `aria-busy`; manter largura (`min-width` fixo pelo texto mais longo ou `width: 100%`).
- Rótulo cabe em 1 linha em 358px: "Adicionar à sacola", "Confirmar pedido", "Calcular taxa e salvar" cabem em 16/600; `white-space: nowrap` volta para a barra fixa (hoje `normal`).
- Intenção única por tela (design-taste): no hero, "Pedir para entrega" + "Retirar na loja" são intenções diferentes (ok); na sacola, "Continuar" da barra fixa e "Continuar para pagamento" do painel são o mesmo botão em breakpoints diferentes (ok, um por vez).
**Porquê:** pílula vermelha + pílula contornada vermelha em todo lugar (sacola, pedido, offline) é o par "filled + ghost" default que a redesign-skill manda quebrar. Secundário em preto/borda cinza deixa o vermelho contar de verdade.

### 11.5 Card de produto (`.card`, `.card .foto`, `.corpo`, `.tags`, `.rodape`, `.apartir`, `.add`, `.card.indisponivel`, `.card-destaque`, `.grade`)

- `.grade` no mobile vira **grupo de lista**: `background: var(--branco); border: 1px solid var(--linha); border-radius: var(--r-lg); overflow: hidden; gap: 0`. Cada `.card` sem borda/raio/sombra própria, separados por `border-top: 1px solid var(--linha)` (`.card + .card`). Desktop (≥900): volta a grid de cards individuais 2–3 colunas, cada um `--r-lg` + hairline.
- `.card`: `grid-template-columns: 1fr 96px; gap: 12px; padding: 12px 12px 12px 16px; min-height: 120px`. Foto à direita (já é no mobile), 96×96 `--r-sm`.
- `.tags`: tag antes do título; `.tag` = 12/600 sentence case, `--r-xs`, padding 2px 8px. `mais-pedida`: `--forno` + branco. `novidade`: `--tomate-tint` + `--tomate-2`. `vegetariana/vegana`: `--manjericao-tint` + `--manjericao-2` (ícone `folha` 14px). `esgotado`: `--papel-2` + `--tinta-2`.
- `h3`: `--t-title` 16/600 `--tinta`, 2 linhas máx (`-webkit-line-clamp: 2`). `p`: `--t-small` `--tinta-2`, 2 linhas.
- `.apartir`: "a partir de" 12 `--tinta-2` + `b` `--t-price` `--tinta` (preto).
- `.add`: 40px circular `--tomate`, ícone `mais` 20, `--sombra-2` leve; área de toque 44 via `::after` transparente ou `margin: -2px`. `.add.ok`: `--manjericao` + `check`.
- `.card.indisponivel`: foto `filter: grayscale(1); opacity: .6`, texto `--tinta-2`, tag "Esgotado"; o card inteiro não recebe opacity (texto ficaria abaixo de AA).
- `.card-destaque` (Monte sua pizza): fundo `--forno`, `--r-lg`, título `--f-display` 22 branco, texto `--forno-texto-2`, botão `.btn-light`. Único card escuro da lista; fica **primeiro** da seção Pizzas.
- Bebidas/combos com recorte: `.foto.foto--recorte` (§8).
**Porquê:** card individual com borda+sombra+raio repetido 40 vezes é a lista mais genérica possível; lista agrupada com hairline é o padrão de cardápio de app e lê 30% mais itens por tela. Preço preto, ação vermelha.

### 11.6 Chips de categoria (`.chips-wrap`, `.chips`, `.chip`, `.chip.ativo`, `.chip-busca`, `.busca-cardapio`)

- `.chips-wrap`: fundo `--papel` (mesma cor da página; sticky a `calc(var(--header-h) + var(--sub-h))`), altura `--chips-h` 52, `border-bottom: 1px solid var(--linha)` só quando rolado (**[JS opcional]** classe `.rolado` via `IntersectionObserver` em um sentinel; senão, hairline sempre).
- `.chip`: `--r-pill`, altura 36, padding 0 14, fundo `--papel-2`, sem borda, texto 14/600 `--tinta`, ícone 16 `--tinta-2`. `.ativo`: fundo `--forno`, texto e ícone brancos. Gap 8. Área de toque 44 via `padding-block` do wrapper `.chips` (altura 52 - 36 = 8 de folga) ou `min-height: 44` mantendo a aparência com `line-height`.
- `.chip-busca`: 36px circular `--papel-2`, ícone 20.
- `.busca-cardapio input`: campo §11.10, `--r-pill`, altura 44, fundo `--papel-2`; `.fechar-busca`: `.btn-ghost`.
**Porquê:** chip ativo preto, não vermelho: o vermelho está a 1 dedo de distância no "+", e preto é a cor do selo. Chips sem borda somem no fundo quando inativos e destacam o ativo por contraste puro.

### 11.7 Stepper (`.stepper`, `.stepper button`, `.stepper output`, `.qtd`, `.qtd-sm`)

- `.stepper` (no card): `--r-pill`, altura 40, fundo `--tomate`, branco; botões 40×40; `output` 15/700 tnum min-width 24; ícone 18 (`menos`/`mais`/`lixeira`).
- `.qtd` (página do produto/sacola): `--r-pill`, altura 44, fundo `--branco`, `border: 1px solid var(--linha-2)`; botões 44 com ícone `--tinta`; número `--t-price`; ao chegar em 1, o "−" vira `lixeira` em `--erro` (já faz no card).
- Transição "+" → stepper: `--dur-2` cross-fade (`opacity`), sem mudar largura do `.rodape` (reservar `min-width: 112px` para o slot `[data-rapido]`).
**Porquê:** dois tamanhos (compacto no card, confortável no produto), mesma gramática; reservar largura evita o texto do preço pular quando o stepper aparece (pro-rules "no layout shift on state").

### 11.8 Sheet / modal (`.modal-bg`, `.modal`, `.modal.sheet`, `.modal-cabeca`, `.alca`, `.modal-corpo`, `.modal-rodape`, `.fechar`, `.link-secundario`)

- `.modal-bg`: `rgba(23,23,23,.5)`; entra com `opacity` `--dur-2`.
- `.modal.sheet`: fundo `--branco`, `border-radius: var(--r-xl) var(--r-xl) 0 0`, `--sombra-3`, `max-height: min(92dvh, 100% - env(safe-area-inset-top))` (manter), `overscroll-behavior: contain` (manter).
- `.alca`: 36×4, `--linha-2`, margem 8 0 12.
- `.modal h2`: `--t-h2` display; subtítulo `--t-body` `--tinta-2`.
- `.fechar`: 36px circular `--papel-2`, ícone 18, `top: 12px; right: 16px`.
- `.modal-corpo`: padding 4 20 16; `.modal-rodape`: padding 12 20 `calc(12px + var(--safe-b))`, `border-top: 1px solid var(--linha)`, fundo branco; botões `.btn-lg btn-block`; `.link-secundario`: `.btn-ghost` centralizado.
- Desktop (≥640): `--r-xl` nos 4 cantos, `max-width: 520`, centralizado (manter).
- Animação: `translateY(100%) → 0` em `--dur-3 --ease-out`; fechar `--dur-saida`.
**Porquê:** já está bem construído (puxador, arraste, foco no título, ESC). Só muda pele e curva.

### 11.9 Barras fixas (`.barra-fixa`, `.total`, `.barra-sacola .btn-sacola`, `.so-mobile`)

- `.barra-fixa` (produto, sacola, checkout): fundo `--branco`, `border-top: 1px solid var(--linha)`, `--sombra-3`, padding 12 0 `calc(12px + var(--safe-b))`, `bottom: calc(var(--tab-h) + var(--safe-b))` no mobile (manter lógica). `.total small`: 12/500 `--tinta-2` sentence case ("Total", "1 sabor · Grande"); `.total b`: `--t-total` `--tinta` tnum. Botão: `.btn.btn-lg` primário vermelho, `flex: 1`, `white-space: nowrap`. `.falta`: 13 `--queijo`.
- `.barra-sacola .btn-sacola` (flutuante no cardápio/home): `--forno`, `--r-lg`, altura 56, `--sombra-2`; `.n`: `--forno-2` `--r-xs` 28px 14/700; texto "Ver sacola" 15/600 branco; `.val`: `--tomate` `--r-sm` 15/700 branco tnum. (Único lugar em que forno e tomate se encontram; é a "sacola" como objeto.)
- Espaço no `body` (`.tem-barra`, `.tem-sacola`): manter.
**Porquê:** barra escura com botão branco inverte a hierarquia (o CTA vira o elemento mais apagado). Barra branca + botão vermelho é a convenção de checkout mobile e mantém o tema claro. A "Ver sacola" flutuante escura funciona porque é um objeto solto, não uma barra.

### 11.10 Input, select, textarea (`.campo`, `.campo label`, `.campo input`, `.erro-msg`, `.linha-campos`, `.check`, `.busca`, `.cupom`, `.pin`, `.form-busca-tel`)

- Label acima: 13/600 `--tinta`; obrigatório com " *" (manter); "opcional" em `--tinta-2` 400.
- Campo: altura 48, padding 0 14, `--r-md`, fundo `--papel-2`, `border: 1px solid var(--linha-2)`, texto 16 `--tinta`, placeholder `--tinta-3` terminando em "…" quando é exemplo ("Ex.: 12", "voce@email.com").
- Foco: fundo `--branco`, `border-color: var(--tomate)`, `outline: 2px solid var(--tomate); outline-offset: 0`.
- Erro: `border-color: var(--erro)`; `.erro-msg` 13 `--erro` com ícone `alerta` 16; `aria-describedby` (**[JS]** já mostra erro inline; garantir foco no primeiro campo com erro no submit do checkout).
- `select`: mesmo estilo + chevron custom (`background-image` SVG `chevron-baixo` 16px à direita, `appearance: none`).
- `textarea.obs`: min-height 88, `--r-md`.
- `.check`: caixa 22px `accent-color: var(--tomate)` (manter), label 15, área de toque 44 (manter).
- `.pin`: 20/700 tnum `letter-spacing: .4em`, centralizado (manter).
- `.cupom input`: `text-transform: uppercase` mantido (cupom é código).
- `autocomplete`, `inputmode`, `enterkeyhint` já corretos; adicionar `spellcheck="false"` em e-mail/cupom/PIN.
**Porquê:** campo preenchido (`--papel-2`) sobre painel branco identifica o campo sem depender de borda de 3:1 (WCAG 1.4.11) e é o padrão iOS/Material 3. 16px evita zoom.

### 11.11 Toast (`.toast`, `.toast-ok`, `.toast-erro`, `.toast-acao`, `#toast-atualizar`)

- `--forno`, branco, `--r-pill`, 14/500, padding 12 18, `--sombra-2`, `max-width: calc(100vw - 32px)`. `.toast-ok`: ícone `check-circulo` `--manjericao` antes do texto (fundo continua forno; sem toast verde-musgo). `.toast-erro`: fundo `--erro`.
- Posição: manter toda a lógica de `bottom` (tab bar / barra / banner) que já existe.
- Entrada `translateY(12px)→0` + opacity `--dur-2`; saída `--dur-saida`; auto-dismiss 3s; `aria-live="polite"` (**[HTML]** conferir no `util.js`).
- `.toast-acao` ("Nova versão"): igual + botão `.btn-sm` `.btn-light`.
**Porquê:** toast verde e toast preto na mesma tela (ver `qa-upsell.png`) são duas linguagens; um toast escuro com ícone colorido resolve.

### 11.12 Badge / tag / chip de nível (`.badge`, `.tag`, `.nivel-chip`, `.dot`)

- `.badge` (contagem): `--tomate`, branco, 16–18px, 11/700 tnum, `--r-pill`.
- `.tag`: §11.5.
- `.nivel-chip`: `--r-pill`, 12/600, padding 4 10, ícone 14. `bronze`: `--tomate-tint` + `--tomate-2`; `prata`: `--papel-2` + `--tinta-2`; `ouro`: `--queijo-tint` + `--queijo`. Sobre forno (`.cb-card`): fundo `--forno-2`, texto branco, ícone na cor do nível.
- `.dot`: só para estado da loja (aberta/fechada) e conexão (offline). Remover `.dot` decorativo de qualquer outro lugar.
**Porquê:** design-taste "zero decorative status dots"; níveis com cor semântica, sem gradiente dourado.

### 11.13 Timeline do pedido (`.timeline`, `.passo`, `.passo .bola`, `.passo.feito`, `.passo.atual`, `.status-grande`, `.eta`, `.acoes-pedido`, `.atualizado`)

- `.status-grande .ic`: 72px circular `--tomate-tint`, ícone 32 `--tomate` (sem o halo de 8px). `h2`: `--t-h1` display. Parágrafo `--t-body` `--tinta-2` `max-width: 32ch`.
- `.eta`: fundo `--papel-2`, `--r-sm`, padding 14; `small` 13 `--tinta-2`; `b` (horário): **`--f-ui` 24/700 tnum `--tinta`** (não serif, não vermelho).
- `.passo`: grid 28px 1fr, gap 12, padding-bottom 20; linha vertical 2px `--linha` (manter `::before`). `.bola`: 28px circular; futuro `--papel-2` + ícone `--tinta-4`; `feito` `--forno` + `check` branco; `atual` `--tomate` + ícone branco + `box-shadow: 0 0 0 4px var(--tomate-tint)` pulsando (`pulsa` existente, ajustar cor).
- `.passo b`: 15/600; futuro `--tinta-2`, feito/atual `--tinta`. `small`: 13 `--tinta-2` (hora).
- `.acoes-pedido`: 2 colunas; WhatsApp `.btn-wa` (branco, ícone verde), Ligar `.btn-outline`; "Avisar quando sair" `.btn-outline btn-block` com ícone `sino`.
- `.atualizado`: 12 `--tinta-2`; o ponto verde pulsante é estado real (permitido).
**Porquê:** o status é a informação; tipografia display no nome do status + hora grande tabular fazem o trabalho sem 3 tons de vermelho.

### 11.14 Cartão do cashback e banner do Clube (`.cb-card`, `.saldo`, `.progresso`, `.clube-banner`, `.cb-bloco`, `.cb-pedido`, `.beneficios`)

- `.cb-card`: `--forno`, `--r-xl`, padding 24, `--sombra-forno`; remover o círculo dourado `::after`; em vez disso, o selo do logo em branco 20% (`opacity: .08`, 160px, canto inferior direito, `mix-blend-mode: screen`) como marca d'água (**[asset]** precisa do selo em SVG/PNG mono branco). `.clube`: 13/600 branco sentence case ("Clube Sesconetto's") com ícone `presente` `--forno-texto-2`. `.saldo`: `--t-money-xl` branco tnum. `.saldo-txt`: 15 `--forno-texto-2`. `.venc`: 13 `--forno-texto-2`; `.urgente`: `#F5B1A8` (10:1). `.progresso .barra`: `--forno-2`, 6px, `i`: `--tomate` (3,1:1 sobre forno, ok para UI não-texto). `.tel`: 13 `--forno-texto-2` tnum.
- `.clube-banner` (home/pedido): mesma pele do `.cb-card` mas compacto (padding 16, `--r-lg`); `b em` (o número) fica branco 700, não dourado; botão `.btn-light btn-sm`.
- `.cb-bloco` (checkout): `--manjericao-tint`, `border: 1px solid #C4E0C8`, `--r-md`; textos `--manjericao-2`; `.switch` ligado `--manjericao`; `.usar-ok` branco `--r-sm`.
- `.cb-pedido.previsto`: `--queijo-tint`/`--queijo`; `.creditado`: `--manjericao-tint`/`--manjericao-2`.
- `.beneficios .beneficio`: `--papel-2` `--r-md`; `b` (percentual) `--f-ui` 20/700 `--tinta`.
**Porquê:** o momento escuro pedido pelo brief, sem gradiente 135° nem bola dourada (redesign: "perfectly even gradients", "AI gradient"). O saldo em sans tabular grande é dinheiro, não título.

### 11.15 Opções e tiles (`.opcao`, `.opcao.ativo`, `.opcao.check`, `.radio-lista`, `.opcoes`, `.escolha-entrega button`, `.sabor-item`, `.metade`, `.filtros-sabor button`, `.lojas-retirada`)

- `.opcao`: `--r-md`, `border: 1px solid var(--linha-2)`, fundo `--branco`, padding 12 12 12 40, min-height 52; rádio `::before` 18px a 12px da esquerda, `border: 2px solid var(--linha-2)`; `.ativo`: `box-shadow: inset 0 0 0 1px var(--tomate); border-color: var(--tomate); background: var(--tomate-tint)`; rádio preenchido `--tomate`. `b` 15/600; `small` 13 `--tinta-2`; `.p` (preço extra) `--t-price` `--tinta`.
- `.opcoes` (tamanhos): 2 colunas, gap 10 (manter).
- `.escolha-entrega button`: tile `--r-lg`, `border: 1px solid var(--linha-2)`, `.ic` 44px circular `--papel-2` ícone 24 `--tinta`; `.ativo`: ícone `--tomate` sobre `--tomate-tint`, borda `--tomate` (inset), fundo branco (não tint inteiro, para a foto do ícone respirar).
- `.sabor-item`: linha de lista dentro de grupo branco (hairline entre itens, sem borda própria), thumb 48 `--r-sm`, `.ativo`: fundo `--tomate-tint` + check à direita (**[HTML]** adicionar `<span class="sel">${icone('check')}</span>` no template de `produto.js`; ou só o fundo).
- `.metade`: `--r-md`, `border: 1px dashed var(--linha-2)` (único tracejado permitido: significa "vazio, preencha"); `.cheia`: sólida `--tomate` + tint; `small` 12/600 sentence case ("1ª metade").
- `.filtros-sabor button`: mesma pele dos chips (§11.6).
- `.lojas-retirada .opcao`: `b` com ícone `loja`; `small` endereço; selecionada igual.
**Porquê:** uma única gramática de "selecionado" (borda tomate + tint + rádio cheio) em todo o app. Hoje há 4 variações (`#fdf5f2`, borda 1.5/2, dashed, forno).

### 11.16 Estados vazios (`.vazio`, `.sem-resultado`, `.vazio-movs`, `.offline-card`)

- Ícone 64px circular `--tomate-tint` com glifo 32 `--tomate` (sacola, busca, presente). `h2`: `--t-h1` display. Texto `--t-body` `--tinta-2` `max-width: 30ch`. Ações: 1 primário + 1 `.btn-outline`, empilhados, gap 8, `max-width: 320px`.
- Copy direto, sem "Oops": "Sua sacola está vazia" / "Nada encontrado para 'x'" com sugestões em chips.
- `.offline-card`: `--branco`, `--r-xl`, sem sombra grande (`--sombra-0`); logo 72 circular hairline **sem grayscale**; sair o eyebrow "SEM INTERNET" em caps; h1 display; botões conforme §11.4; `[data-status]` com dot semântico.
**Porquê:** o vazio é convite para agir (frontend-design); a home não precisa do círculo cinza de 84px.

### 11.17 Skeleton (`.skeleton`, `.skeleton-card`, `.chips-skel`, `.skeleton-conta`)

- Base `--papel-2`, brilho `#F8F5F0`, `--r-sm` (blocos) / `--r-pill` (chips) / `--r-lg` (card); animação `sk` 1.4s linear infinita (manter), some em reduced-motion.
- `.skeleton-card` replica a geometria nova do card de lista (§11.5): 1fr 96px, sem borda própria dentro do grupo.
- Regra: skeleton só se a espera passar de 300ms (**[JS opcional]** `setTimeout` antes de injetar), e sempre com `aria-busy="true"` no container (já é).
**Porquê:** ui-ux-pro-max "loading feedback should match the expected wait and avoid flashing".

### 11.18 Painel / grupo (`.painel`, `.secao-titulo`, `.duas-colunas`, `.sticky-lateral`, `.totais`)

- `.painel`: `--branco`, `--r-lg`, hairline, padding 16 (20 em ≥640), sem sombra. `h2` dentro: `--t-h2` display, margin-bottom 12. `h3`: `--t-h3`.
- `.secao-titulo`: h2 display + link à direita 14/600 `--tomate` com `chevron-dir` (manter).
- `.totais`: linhas 15; `div` gap 8; `.total`: `--t-total` tnum, `border-top: 1px solid var(--linha)`, padding-top 12; `.desconto`, `.cashback`: `--manjericao-2`.
- `.duas-colunas`: manter grid; padding-top 16 mobile.
**Porquê:** painel = agrupamento, não elevação.

### 11.19 Hero da home (`.hero`, `.hero img.bg`, `.hero::after`, `.hero h1`, `.hero p`, `.hero-acoes`, `.hero-info`, `.eyebrow`)

- `.hero`: `--forno` de fundo, `min-height: 420px` mobile (`display: flex; align-items: flex-end`), 560 desktop; foto `opacity: 1`, scrim conforme §8.
- **[HTML]** remover `<span class="eyebrow">`; remover `<em>` do h1 (h1 fica "Pizza napolitana de forno a lenha, feita por uma família." ou "A napolitana de Brasília, feita por uma família." em 2 linhas de 34px).
- `.hero p`: 15 branco 90%, `max-width: 34ch`, 2 linhas (clamp mantido), ≤ 20 palavras.
- `.hero-acoes`: 2 botões `btn-lg`: primário vermelho + `.btn-light`; empilhados no mobile (manter), lado a lado no desktop.
- `.hero-info` **sai de dentro da foto**: vira "ticket" branco `--r-xl`, hairline, padding 12 16, `margin: -24px 16px 0` (sobrepõe o fim da foto), 3 linhas 13/500 `--tinta` com ícones 16 `--tinta-2`; o dot de status é semântico. No desktop fica como faixa branca abaixo do hero, dentro do container.
**Porquê:** design-taste 4.7 "hero stack: máx. 4 elementos; trust micro-strip vai para baixo do hero". A foto a 100% com scrim de baixo para cima é o que vende. O ticket sobreposto dá o gesto de app (card sobre header de imagem).

### 11.20 Atalhos da home (`.atalhos`, `.atalho`, `.atalho .ic`)

- Mobile: `display: flex; overflow-x: auto; scroll-snap-type: x mandatory; gap: 12; padding-inline: 16; margin-inline: -16` (fila rolável), cada `.atalho` `flex: 0 0 96px`, sem card: `.ic` 56px circular `--papel-2` ícone 24 `--tinta`, `b` 13/600 abaixo, `small` sai (`display:none`). Desktop: grid 6 colunas, mesma pele, sem borda/sombra.
- Ativo/pressed: `.ic` fundo `--tomate-tint` ícone `--tomate`.
**Porquê:** 6 cards de 150px em 2 colunas empurram a primeira pizza para 1.100px de scroll. Uma fila de 96px ocupa 100px de altura.

### 11.21 Rodapé (`.footer`, `.xadrez`, `.wa-flutuante`)

- `.xadrez`: **remover** (o brief pede sem clichê de toalha xadrez; a faixa é literalmente isso).
- `.footer`: fundo `--papel`, `border-top: 1px solid var(--linha)`, texto 13 `--tinta-2`, títulos `h4` 13/600 `--tinta`; grid manter; `.legal` 12 `--tinta-3`.
- `.wa-flutuante`: só na home (manter regra), 52px, fundo `--branco`, `border: 1px solid var(--linha-2)`, ícone `wa` 26 `--wa`, `--sombra-2`.
**Porquê:** theme lock (§1.3); o botão flutuante verde-neon sobre cards brancos é o item mais "template" da home.

### 11.22 Banner "Instalar app" e push (`.banner-instalar`, `.push-box`, `.passos-ios`)

- `.banner-instalar`: `--branco`, `--r-lg`, hairline, `--sombra-2`; ícone do app 44 `--r-sm`; `b` 14/600; `small` 12 `--tinta-2`; botão primário `btn-sm`; fechar `.btn-icone` 40.
- `.push-box.ativo`: `--manjericao-tint`/`--manjericao-2`; `.negado`: `--papel-2`/`--tinta-2`.
- `.passos-ios .n`: `--forno` (não vermelho; é numeração real de passos, permitido).
**Porquê:** coerência com o tema claro; o banner escuro atual compete com a barra "Ver sacola" escura quando os dois aparecem.

### 11.23 Admin (`admin/admin.css`)

Só coerência: importar os mesmos tokens (já herda `style.css`), trocar Inter por Instrument Sans, botões/inputs/painéis conforme §11.4/§11.10/§11.18, kanban com colunas `--papel-2` e cards brancos hairline. Nada de redesign de layout.

---

## 12. Z-index (escala fechada)

`--z-sticky: 50` (header, subheader 49, chips 40) · `--z-barra: 55` (barra fixa) · `--z-flutuante: 58` (wa, banner) · `--z-tab: 60` · `--z-sheet: 100` · `--z-toast: 200`. Já são esses números; só nomear como tokens e não criar outros.

---

## 13. Checklist de aceite (rodar antes de fechar a implementação)

- [ ] Nenhum `#` fora de `:root` em `style.css` (grep `#[0-9a-f]{3,6}` só dentro de `:root` e `@font-face`).
- [ ] Contraste: todos os pares de texto da §1 ≥ 4,5:1; foco ≥ 3:1; ícone informativo ≥ 3:1.
- [ ] Zero `—`/`–` em texto visível (grep nas páginas e nos templates JS); ranges como "40 a 60 min".
- [ ] Zero `text-transform: uppercase` (exceto `.cupom input`).
- [ ] Um único vermelho (`--tomate`/`--tomate-2`) fora de semânticas; nenhum dourado decorativo.
- [ ] Botão: rótulos em 1 linha em 358px; WhatsApp sem texto branco sobre verde.
- [ ] Alturas: header 56 + sub 44 + chips 52 no cardápio; barra fixa ≤ 72; tab 56.
- [ ] `<img>` com `width/height`; hero `fetchpriority="high"`; fontes com `preload` e servidas de `/fonts/`.
- [ ] `prefers-reduced-motion` zera animações; nenhuma `transition: all`.
- [ ] Screenshots 390×844 e 1280 de: home, cardápio (topo + com stepper), produto (sabor, meio a meio, combo), sacola (cheia + vazia), checkout (cashback), pedido (preparando + entregue), conta (painel), sheet entrega, upsell, offline, toast.
