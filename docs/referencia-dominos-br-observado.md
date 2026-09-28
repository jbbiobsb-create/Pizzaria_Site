# Sesconettos — Referência real do site da Domino's Brasil

**O que é este documento:** o registro do que foi **observado de fato** navegando em
[dominos.com.br](https://www.dominos.com.br) em 28/09/2026, com prints, fluxos, telas, textos e
modelo de dados. É o "como eles fazem" para servirmos de base para o "como nós vamos fazer".

**Como usar junto com o outro doc:** `benchmark-ux-dominos-conceitual.md` é a teoria e a direção
(princípios, o que evitar, MVP). Este aqui é a prática: cada tela, cada botão, cada campo.

**Regra do jogo:** copiar o **formato** (fluxo, hierarquia, componentes, textos de ação), nunca a
**marca** (logo, azul/vermelho Domino's, fotos, nomes de produto registrados, campanhas).

> Prints em `docs/referencia-dominos/`. Modelo de dados observado em
> `docs/referencia-dominos/modelo-de-dados-observado.json`.

---

## 1. Resumo do que aprendemos

1. **É um app, não um site.** É uma SPA (Angular + Ionic) que roda a mesma interface no desktop e no
   celular, com abas no rodapé no mobile. O site inteiro é uma máquina de pedido.
2. **Endereço primeiro.** Sem endereço não existe preço: o menu mostra "Ver preço" e, ao tocar em
   qualquer produto, abre o modal "Para visualizar o produto, informe um endereço de entrega ou
   retirada". Salvou o endereço → o sistema escolhe a loja, calcula taxa e libera tudo.
3. **Delivery / Retirar na loja** vira um toggle fixo no subheader depois do endereço, e volta a
   aparecer no carrinho. Dá para trocar a qualquer momento sem perder o pedido.
4. **Configurador de pizza é uma página** (`/product-details/{sabor}`), não um modal: tamanho
   (select), massa (cards com rádio), borda recheada (modal com sabores), ingredientes
   (toggle ligar/desligar, metade esquerda/direita/inteira, quantidade − Normal +) e uma
   **barra inferior fixa com o total em tempo real + "Adicionar ao carrinho"**.
5. **Upsell logo depois do "Adicionar":** modal "Incremente seu pedido" com Bebidas, Sobremesas e
   Acompanhamentos, botão "Adicionar" em cada card e "Seguir para o carrinho" embaixo.
6. **Meio a meio** e **promoções** usam o mesmo esqueleto do configurador: tamanho + massa no topo,
   depois "Passo 1: Escolha o primeiro sabor", "Passo 2…", com lista de sabores e botão ⊕ Adicionar.
7. **Carrinho = revisão completa:** itens editáveis, Delivery/Buscar na loja, loja escolhida com
   distância, previsão (20–30 min), horário de funcionamento, telefone, **agendar para mais tarde**
   (data + hora em slots de 15 min), cupom, subtotal, taxa, "Você economizou", total.
8. **Checkout em uma tela só:** nome, e-mail, celular, aceite de termos, endereço, observações,
   forma de pagamento (Pagamento na entrega / Cartão ou VR / Pix), resumo à direita,
   "Finalizar pedido". **Sem obrigar cadastro.**
9. **Acompanhar pedido pelo celular:** o botão vermelho "Acompanhar pedidos" está no header de
   todas as páginas e abre um modal pedindo só o número de celular.
10. **Loja fechada não bloqueia:** "Ops... A nossa loja ainda não abriu! Mas não se preocupe, você
    ainda pode agendar o pedido!" e o fluxo continua com agendamento.

---

## 2. Mapa do site (rotas reais)

| Rota | O que é |
|---|---|
| `/tabs/home` | Home: banner, 3 ofertas em destaque, (mobile) botões "Acessar o menu" e "Acompanhar pedidos" |
| `/tabs/menu` | Cardápio: barra de categorias horizontal + seções |
| `/tabs/promotions` | Promoções: banner, campo de cupom, grade de ofertas |
| `/product-details/{flavorCode}` | Configurador de um produto (ex.: `/product-details/PEPPON`) |
| `/product-details-half` | Configurador meio a meio |
| `/promotion-details/{id}` | Configurador de uma promoção (passos) |
| `/cart` | Carrinho / "Confirme seu pedido" |
| `/order-summary` | Checkout: identificação, entrega, observações, pagamento |
| `/addresses` | Gerenciar endereços |
| `/login` | Login com senha, com código, Google, Apple, ou "Entrar como visitante" |
| `/register` | Cadastro completo (dados + endereço) |
| (modal) | "Acompanhar pedidos": informe seu celular |
| (modal) | Endereço: CEP autocompleta rua/bairro/cidade/UF |
| (modal) | "Escolha uma loja" para retirada, ordenada por distância |

---

## 3. Layout global

### Header desktop (azul, fixo)
`[Logo] Home · Menu · Promoções · [Acompanhar pedidos — botão vermelho]  ……  Login ou cadastre-se · [ícone carrinho com badge]`

### Subheader (branco, fixo logo abaixo)
- Antes do endereço: à direita, `📍 Selecione a localização ⌄`
- Depois do endereço: `[Delivery] [Retirar na loja]  📍 Avenida Paulista, 1578 ⌄`

### Mobile
- Header: logo centralizado + carrinho à direita.
- Linha de localização + "Olá, visitante!".
- **Tab bar inferior fixa:** HOME · MENU · PROMOÇÕES · PERFIL (ícones + rótulo, aba ativa em vermelho).
- Na home mobile, dois botões grandes: "Acessar o menu" (contorno) e "Acompanhar pedidos" (cheio).

### Rodapé
Logo + redes sociais (YouTube, Facebook, Instagram, X) · Sobre Nós (Internacional, Sobre a Pizza,
Políticas de Privacidade, Políticas de Cookies) · Atendimento ao Cliente (Seja um Franqueado, Fale
conosco, Termos de Uso) · badges das lojas de app + QR code · texto legal (área de entrega, horário
por loja, promoções não cumulativas, "Cobramos taxa de entrega", alérgenos, "preços a partir de podem
variar por região", SAC) · selo Reclame Aqui · endereço da empresa.

### Cookies
Faixa cinza no rodapé com texto + link de política + botão ×. Não bloqueia a navegação.

---

## 4. Telas, uma a uma

### 4.1 Home (`01-home-desktop.jpg`, `18-mobile-home.jpg`)
- **Banner principal** de campanha (largura total). Clicar leva a um "menu temático" da campanha.
- **3 cards de ofertas** lado a lado (imagem com preço estampado na arte). São as "melhores ofertas"
  da loja (`getBestCoupons`).
- Só isso acima da dobra. Sem texto institucional, sem "sobre nós".
- Mobile: mesma ordem + os dois botões grandes.

**Para a Sesconettos:** hero com foto real + CTA "Pedir agora" / "Retirar na loja", depois 3 ofertas,
depois "Mais pedidas". Mantemos a tab bar no mobile.

### 4.2 Modal de endereço (`02-modal-endereco.jpg`)
Título: **"Por favor, cadastre seu endereço para visualizar produtos e promoções"**

Campos (2 colunas): Nome do endereço (opcional: "Casa, trabalho, etc.") · CEP (`00000-000`) ·
Endereço · Bairro · Número (`0000`) · Complemento · Cidade · Estado (select).
Botões: **Salvar** (vermelho, largo) · "Preencher depois" (link).

Comportamento: digitar o CEP preenche Endereço/Bairro/Cidade/UF automaticamente. Ao salvar, o
sistema geocodifica (lat/long), acha a loja mais próxima que atende, calcula a taxa e recarrega o
menu com preços.

Quando o usuário toca em um produto sem endereço, o mesmo modal abre com o título
**"Para visualizar o produto, informe um endereço de entrega ou retirada."**

### 4.3 Modal "Escolha uma loja" — retirada (`04-modal-escolha-loja-retirada.jpg`)
Lista com rádio: nome da loja, endereço, bairro/cidade, distância (🚶 0.7km) e, se fechada, o aviso
vermelho "Ops... A nossa loja ainda não abriu! Mas não se preocupe, você ainda pode agendar o
pedido!". Botão **Selecionar**.

### 4.4 Menu (`03-…`, `05-menu-categoria-pizzas.jpg`, `19-mobile-menu.jpg`)
- **Barra de categorias horizontal** com ícone + nome, com setas ‹ › no desktop e rolagem por
  toque no mobile. A ativa fica vermelha cheia; as outras, contorno. Categoria de campanha vem
  primeiro.
- Categorias observadas: Campanha · Almoço · Novidades · Pizzas · Acompanhamentos · Molhos ·
  Lasanhas · Calzones · Sanduíche · Sobremesas · Bebidas · Colecionáveis.
- Dentro de Pizzas há **seções**: "Mais pedidas" (8 itens, inclui "Monte sua pizza") · "Clássicas" ·
  "Especiais". Antes delas, um card pequeno "Meio a Meio — A partir de R$ 45,25".
- **Card de produto (desktop, 2 colunas):** foto quadrada à esquerda · nome em negrito · descrição
  curta (lista de ingredientes) · "A partir de: **R$ 35,90**" em vermelho. Sem endereço, no lugar do
  preço aparece o botão azul "Ver preço". O card inteiro é clicável.
- **Card mobile:** lista de 1 coluna, texto à esquerda e foto à direita, separador entre itens.

### 4.5 Configurador de produto (`06-…`, `07-…`)
Página `Pizza de Pepperoni` com layout 2 colunas:

- **Esquerda:** foto grande + descrição em itálico.
- **Direita (painel):** "Escolha o tamanho da pizza" → select `Média • 8 fatias` (opções: Brotinho •
  4 fatias, Média • 8, Grande • 8, Giga • 8). "Selecione a massa:" → 4 cards com rádio: Tradicional
  (Massa tradicional, densa, espessa e macia), Pan (Massa fofa e crocante), Fina (Massa leve, fina e
  crocante), Borda recheada (Massa com borda recheada). Os cards de massa mudam conforme o tamanho
  (Grande mostra "Super fina", não "Pan").
- **Borda recheada** abre modal "Escolha o sabor da borda recheada": Cheddar · Catupiry · Cream
  Cheese · Pasta de Alho + botão **Selecionar**. Tem preço adicional por tamanho.
- **Ingredientes** (grade de cards com borda vermelha): cada um com ícone, nome, **toggle** ligado;
  os principais (Queijo, Molho) têm rádio "Metade esquerda / Metade direita / Pizza inteira" e
  stepper "− Normal +".
- Botão **"Personalizar essa pizza com outros ingredientes"** abre a lista de extras (~20 toppings).
  Texto de regra: *"Cada porção adicional de ingrediente contém 1/3 da porção normal. Valor por
  porção: R$ 7,90"*.
- **Barra inferior fixa (azul):** `Total: R$ 74,50` à esquerda e **"Adicionar ao carrinho"** à
  direita. O total muda a cada escolha (Média Tradicional 74,50 → Grande 87,50).

### 4.6 Upsell (`08-upsell-incremente-seu-pedido.jpg`)
Ao adicionar, abre o modal **"Incremente seu pedido"** com 3 carrosséis: Bebidas · Sobremesas ·
Acompanhamentos. Card pequeno: foto, nome, descrição, preço azul, botão vermelho "Adicionar".
Rodapé do modal: **"Seguir para o carrinho"** (contorno). O badge do carrinho no header já mostra 1.

### 4.7 Meio a meio (`09-…`, `10-…`)
Mesma estrutura do configurador: imagem ilustrativa + "Escolha o tamanho" + "Selecione a massa".
Abaixo: **"Passo 1: Escolha o primeiro sabor"** com a lista de todos os sabores (foto, nome,
descrição, "A partir de R$ 37,25", botão redondo ⊕ "Adicionar"). Ao escolher, abre o modal
**"1º metade"** com os ingredientes daquela metade (toggles + stepper) e os botões "Adicionar ao
carrinho" / "Personalizar outros ingredientes". Depois vem o Passo 2 para a 2ª metade. Barra fixa
com total (começa em R$ 0,00 e o botão fica desabilitado até completar).

### 4.8 Promoções (`11-promocoes.jpg`, `12-promocao-detalhe-configurador.jpg`)
- Título "Promoções", banner de campanha, faixa azul **"Possui um cupom? Adicione aqui [Digite o
  cupom] [APLICAR]"**.
- **Grade de 4 colunas** de cards de oferta: só a arte (com preço grande na imagem) + rodapé
  vermelho "A partir de: R$ 79,90". Sem descrição textual no card.
- Tipos de oferta vistos: 2 pizzas grandes 40% off · pizza grande + borda + refri 2L · 2 pizzas
  grandes + refri 2L · 2 pizzas médias/grandes/gigas a preço unitário · 1 pizza média + refri 600ml ·
  pizza giga + refri 2L · brotinho + mini sobremesa + refri lata · sanduíche/lasanha/calzone + refri
  lata · "Favoritas" por tamanho · "2 ingredientes" por tamanho/massa · combos de campanha.
- **Detalhe da promoção = configurador em passos:** título da oferta, arte, tamanho (fixo pelo
  regulamento), massas permitidas, "Passo 1: Escolha sua Pizza" (inclui a opção Meio a meio),
  Passo 2 (sobremesa), Passo 3 (bebidas)… e barra fixa "Adicionar ao carrinho".

### 4.9 Carrinho (`13-carrinho.jpg`, `20-mobile-carrinho-vazio.jpg`)
Título **"Confirme seu pedido"** · link "Limpar carrinho".

- **Item:** foto, nome, "Tamanho: Grande", "Massa: Tradicional", preço azul, link **Editar**,
  stepper − 1 +.
- **Painel direito "Entrega desejada":** rádio **Delivery** (endereço principal + loja escolhida com
  CEP/rua/distância, *Previsão de entrega: 20–30 min*, *Horário de funcionamento*, *Telefone*) ou
  **Buscar na loja**.
- **"Horário da entrega":** rádio *Pedir agora* (desabilitado se fechada) / *Mais tarde* → "Agendar a
  entrega do seu pedido para:" [📅 data] [🕒 hora] em slots de 15 min.
- **Cupom de desconto:** input + botão Aplicar.
- **Totais:** Subtotal · Taxa de entrega · *Você economizou* (vermelho) · **Total** (azul, grande).
- Botões: **"Adicionar mais itens"** (azul) e **"Ir para pagamento"** (vermelho).
- Vazio: ilustração + "Seu carrinho está vazio..." + botão "Ver o menu".

### 4.10 Checkout (`14-checkout-pagamento.jpg`)
Uma única página, coluna principal + resumo à direita:

1. **Identifique-se:** Nome completo · E-mail · Celular `(00) 00000-0000` · ☐ "Concordo com a
   Política de Privacidade e os Termos de Uso."
2. **Entrega:** card com o endereço principal.
3. **Observações:** textarea "Adicione observações sobre a entrega aqui...".
4. **Pagamento → Forma de pagamento:** rádio com ícone: 🚲 *Pagamento na entrega* · 💳 *Cartão de
   Crédito ou Vale Refeição* · ◇ *Pix*.
5. **Resumo do pedido (direita):** item com foto/tamanho/massa/preço/qtd, subtotal, taxa, economizou,
   total; nota *"Na entrega, aceitamos as seguintes formas de pagamento - cartão de débito e crédito
   e vale refeição."*; botão **"Finalizar pedido"** (desabilitado até preencher).

Não exige conta. O login é opcional e oferecido pelo header.

### 4.11 Acompanhar pedidos (`15-acompanhar-pedido-modal.jpg`)
Modal: **"Informe seu telefone para acompanhar o pedido"** · campo Celular · botão **Buscar**.
O telefone é a chave do pedido, não um login.

### 4.12 Login e cadastro (`16-login.jpg`, `17-cadastro.jpg`)
- Login: logo, "Bem-vindo", "Acesse sua conta", **Login com senha** (vermelho), **Login com código**
  (contorno), "Faça login com" Google / Apple, "Não tem uma conta? Crie agora", **Entrar como
  visitante**.
- Cadastro: Nome · Data de nascimento · CPF · E-mail · Celular · Senha · Confirmar senha · bloco de
  endereço (mesmos campos do modal) · ☐ termos · **Criar minha conta**.

---

## 5. Modelo de dados observado (base para o nosso Supabase)

Detalhes e exemplos reais em `referencia-dominos/modelo-de-dados-observado.json`.

### Produto de pizza
- **Sabor** (`flavorCode`, nome, descrição, foto, categoria, seção, ingredientes padrão).
- **Tamanhos:** Brotinho (4 fatias) · Média (8) · Grande (8) · Giga (8). Cada um com preço de
  "porção extra" próprio.
- **Massas:** Tradicional · Pan · Fina · Super fina · Borda recheada (com sub-opções Cheddar, Catupiry,
  Cream Cheese, Pasta de Alho e **preço adicional por tamanho**: Média +R$ 12, Grande +R$ 14).
- **Variante = tamanho + massa + sabor**, com preço próprio (`GRHTPEPPON`). 26 sabores geram 467
  variantes. Nem toda combinação existe (Brotinho não tem Pan; Giga não tem borda).
- **Ingredientes:** padrão (removíveis, com lado e quantidade) e extras (toppings, com preço por
  porção e restrições por tamanho).
- Produto pode ser `isCombo`, ter `minSize`, `price` ("a partir de") e `price_max`.

### Categoria / seção
Categoria (nome, ícone, ordem, ativa) → seções (Mais pedidas, Clássicas, Especiais) → produtos.
Categorias temáticas têm `startDate`, `endDate`, `activeStartTime`, `activeEndTime`.

### Loja
Nome, endereço, telefone, `deliveryFee`, distância, `isOpen`, `hoursOperation` (open/close),
`scheduleDates` + `timeSlotsByDate` (slots de 15 min), métodos de pagamento aceitos.

### Promoção
`codePromo`, descrição, arte, `usageLimit`, `groupProducts[]` (categoria, tamanhos e massas
permitidos, `requiredQuantity`, `maximumQuantity`, preço, `minimumPrice`, `maximumDiscount`).

### Carrinho / pedido
Itens (variante, ingredientes alterados, qtd, preço) · modalidade (DELIVERY/TAKEOUT) · endereço ou
loja · agendamento (data/hora) · cupom · `subtotal`, `discount`, `deliveryFee`, `total` ·
`preparationTime {min, max}` · cliente (nome, e-mail, celular) · observações · pagamento
(OFFLINE / CREDIT_CARD / PIX).

### Proposta de tabelas (Supabase)
`categorias` · `secoes` · `produtos` · `tamanhos` · `massas` · `bordas` · `variantes_produto`
(produto × tamanho × massa → preço) · `ingredientes` · `produto_ingredientes` (padrão) ·
`toppings_extras` · `lojas` · `horarios_loja` · `areas_entrega` · `promocoes` ·
`promocao_grupos` · `cupons` · `clientes` · `enderecos` · `pedidos` · `pedido_itens` ·
`pedido_item_ingredientes` · `pedido_status_historico` · `pagamentos`.

---

## 6. Textos e microcopy que valem adaptar

| Onde | Domino's | Sesconettos (sugestão) |
|---|---|---|
| Header | Acompanhar pedidos | Acompanhar pedido |
| Header | Login ou cadastre-se | Entrar |
| Subheader | Selecione a localização | Onde você está? |
| Subheader | Delivery / Retirar na loja | Entrega / Retirar na loja |
| Modal | Por favor, cadastre seu endereço para visualizar produtos e promoções | Informe seu endereço para ver preços e ofertas |
| Modal | Preencher depois | Ver o cardápio primeiro |
| Card | A partir de: R$ 35,90 | A partir de R$ 35,90 |
| Card sem endereço | Ver preço | Ver preço |
| Produto | Escolha o tamanho da pizza / Selecione a massa | Tamanho / Massa |
| Produto | Personalizar essa pizza com outros ingredientes | Adicionar ingredientes |
| Produto | Adicionar ao carrinho | Adicionar ao pedido |
| Upsell | Incremente seu pedido / Seguir para o carrinho | Quer completar? / Ir para o pedido |
| Meio a meio | Passo 1: Escolha o primeiro sabor / 1º metade | Escolha a primeira metade |
| Carrinho | Confirme seu pedido / Entrega desejada | Seu pedido / Como você quer receber? |
| Carrinho | Pedir agora / Mais tarde | Agora / Agendar |
| Carrinho | Você economizou | Você economizou |
| Carrinho | Adicionar mais itens / Ir para pagamento | Adicionar mais itens / Continuar para pagamento |
| Checkout | Identifique-se / Finalizar pedido | Seus dados / Confirmar pedido |
| Loja fechada | Ops... A nossa loja ainda não abriu! Mas não se preocupe, você ainda pode agendar o pedido! | Ainda não abrimos, mas você já pode agendar 🙂 |
| Tracker | Informe seu telefone para acompanhar o pedido | Digite seu celular para ver seu pedido |
| Vazio | Seu carrinho está vazio... / Ver o menu | Seu pedido está vazio / Ver cardápio |

---

## 7. Design (para referência, não para copiar)

- **Cores deles:** primário `#FF0000` (CTA), secundário `#0090E2` (header, preços, links), escuro
  `#9D2235` / `#00587C`, fundos `#F7FBFD` e `#EBF8FF`, texto `#000` / `#6b7280`.
  **Nós usamos a paleta do doc conceitual** (grafite forno, creme massa, vermelho tomate queimado,
  amarelo queijo, verde manjericão).
- **Tipografia deles:** Inter var (corpo) + Reddit Sans / OneDot (títulos). Nós: display com
  personalidade + sans limpa.
- **Componentes que funcionam e vamos manter:** chips de categoria com ícone, card horizontal
  foto-esquerda, cards de massa com rádio + descrição, toggle de ingrediente, stepper − Normal +,
  barra inferior fixa com total + CTA, modal de upsell, painel lateral de totais, tab bar mobile.
- **Padrões visuais:** cantos arredondados (12–16 px), sombras suaves, muito branco, CTAs em pílula
  larga, preço sempre em cor de destaque, botão primário cheio + secundário contorno.

---

## 8. O que NÃO vamos repetir

- Logo/cores/campanhas/colecionáveis da Domino's e nomes registrados (Extravaganzza®, Veggie®…).
- Home 100% de banners de campanha; queremos foto real e posicionamento artesanal.
- Card de promoção só com arte (sem texto): vamos ter nome, o que inclui e regra visível.
- Página de produto com rodapé enorme entre as opções e a barra fixa.
- Cadastro pedindo CPF e data de nascimento para começar.
- Rodapé legal em bloco gigante; manter só o essencial (taxa, alérgenos, horário).

---

## 9. Fluxo que vamos construir (resumo)

```text
Home ──► Pedir agora ──► Entrega ou Retirada?
                          ├─ Entrega: CEP → endereço → taxa/prazo
                          └─ Retirada: loja + horário
Cardápio (chips de categoria, Mais pedidas primeiro)
  ├─ Produto → tamanho → massa/borda → ingredientes → total ao vivo → Adicionar
  ├─ Meio a meio → 1ª metade → 2ª metade → Adicionar
  └─ Promoção → passos → Adicionar
Upsell (bebida / sobremesa / entrada) ──► Pedido (carrinho)
  itens · entrega/retirada · agora/agendar · cupom · totais
Checkout (1 tela): dados · endereço · observação · pagamento (Pix / cartão / na entrega)
Confirmação ──► Acompanhar pedido pelo celular (linha do tempo)
```

---

## 10. Como o material foi coletado

Navegação automatizada (Chromium headless) em 28/09/2026: home, menu, promoções, login, cadastro,
modal de endereço (CEP 01310-100, Av. Paulista, SP, loja Jardim Paulista), retirada, produto
(Pepperoni), meio a meio, promoção, carrinho e checkout, no desktop (1366 px) e mobile (390 px).
Nenhum pedido foi finalizado. As respostas da API pública foram lidas apenas para entender a
modelagem.
