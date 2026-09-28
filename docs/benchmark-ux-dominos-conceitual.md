# Sesconettos — Benchmark de UX baseado na Domino’s

**Documento de referência para produto, UX/UI e operação**  
**Data da pesquisa:** 28 de setembro de 2026  
**Base analisada:** experiência pública da Domino’s nos EUA e Brasil, incluindo home, entrada de pedido, menu, ofertas e rastreador.

> **Objetivo:** criar uma experiência própria para a Sesconettos inspirada nos princípios que tornam a Domino’s eficiente para vender pizza online — sem copiar marca, layout, textos, cores, imagens ou identidade visual.

---

## 1. Resumo executivo

A Domino’s não é necessariamente a referência de estética artesanal, mas é uma referência muito forte de **produto digital orientado à conversão**. A experiência é construída em torno de uma pergunta simples:

> **Como levar uma pessoa faminta da entrada do site até o pedido confirmado com o mínimo de incerteza e atrito?**

Os princípios mais importantes observados:

1. **O pedido começa antes do cardápio:** primeiro a pessoa escolhe entrega ou retirada e informa sua localização.
2. **O CTA principal é permanente:** “Order Now” aparece como ação central da navegação.
3. **Ofertas são tratadas como produtos:** a pessoa pode adicionar uma promoção diretamente, sem montar tudo do zero.
4. **O cardápio é dividido em categorias fáceis de escanear.**
5. **A pizza pode ser montada passo a passo.**
6. **O carrinho e o preço são tratados como parte da decisão, não como etapa escondida.**
7. **O pedido tem rastreabilidade:** o cliente precisa saber o que está acontecendo depois do pagamento.
8. **A operação é modular:** delivery, retirada, ofertas, recompensas, cardápio e tracker são experiências conectadas.
9. **A conversão é favorecida por combos e preço ancorado.**
10. **A Sesconettos deve absorver a lógica de conversão, mas trocar a estética fast-food por uma identidade autoral, artesanal e contemporânea.**

---

## 2. O que foi observado na arquitetura da Domino’s

### Navegação principal

Na versão norte-americana, a navegação pública apresenta:

- **Order Now** — ação principal de compra;
- **Menu** — navegação por produtos;
- **Deals** — ofertas e cupons;
- **My Rewards** — recompensas e recorrência;
- **Tracker** — acompanhamento do pedido.

Essa estrutura é importante porque separa claramente quatro intenções:

| Intenção do cliente | Entrada ideal na Sesconettos |
|---|---|
| Quero pedir agora | **Pedir agora** |
| Quero escolher algo específico | **Cardápio** |
| Quero economizar | **Ofertas** |
| Já pedi e quero acompanhar | **Acompanhar pedido** |

### Princípio para a Sesconettos

A navegação não deve começar com “Sobre nós” ou uma lista institucional. O site é, antes de tudo, uma **interface de venda e relacionamento**.

Proposta de navegação:

- **Pedir agora**
- **Cardápio**
- **Ofertas**
- **Nossa massa**
- **Acompanhar pedido**
- ícone do carrinho

No desktop, o CTA deve ficar destacado no canto direito. No mobile, o carrinho e o CTA devem permanecer acessíveis pelo polegar.

---

## 3. Primeiro passo: entrega ou retirada

A Domino’s inicia o fluxo com uma escolha explícita entre:

- **Delivery**
- **Carryout** / retirada

Depois, solicita a localização adequada à modalidade.

### Por que isso é bom

Essa decisão inicial evita que o cliente monte um pedido com preços, disponibilidade ou prazo incorretos. Também permite:

- calcular área de entrega;
- aplicar taxa correta;
- escolher loja responsável;
- mostrar itens disponíveis naquele local;
- estimar prazo;
- separar retirada de delivery no PDV.

### Fluxo recomendado para a Sesconettos

```text
Entrada
  ↓
Você quer receber onde?
  ├── Entrega
  │     ↓
  │   CEP/endereço
  │     ↓
  │   validação da área e taxa
  │
  └── Retirar na loja
        ↓
      seleção da unidade
      e horário estimado
  ↓
Cardápio contextualizado
```

### Interface sugerida

Tela ou modal inicial:

**Como você quer receber sua pizza?**

- **Entregar em casa**
  “Receba no seu endereço”
- **Retirar na loja**
  “Peça antes e só passe para buscar”

A ação deve ser rápida e reversível. O cliente deve poder alterar delivery/retirada no carrinho sem perder o pedido.

### Dados mínimos

Para delivery:

- CEP;
- rua;
- número;
- complemento opcional;
- bairro;
- referência opcional;
- nome;
- telefone;
- área de entrega;
- taxa;
- tempo estimado.

Para retirada:

- unidade;
- endereço da loja;
- horário de funcionamento;
- tempo de preparo;
- opção de agendamento.

---

## 4. Home: vender sem transformar a tela em um panfleto

A home da Domino’s combina entrada de pedido, ofertas, novidades, recompensas e categorias de cardápio. A lição é a **hierarquia**, não a quantidade de banners.

### Estrutura recomendada para a Sesconettos

#### Bloco 1 — Hero com CTA

- foto real de uma pizza saindo do forno;
- frase curta de posicionamento;
- botão **Pedir agora**;
- botão secundário **Ver cardápio**;
- informação de prazo ou horário atual.

Exemplo de copy:

> **Pizza de verdade, feita no nosso forno.**  
> Massa de fermentação lenta, ingredientes generosos e entrega sem complicação.

CTAs:

- **Pedir delivery**
- **Retirar na loja**

#### Bloco 2 — Atalhos de alta intenção

- Mais pedidas;
- Combos;
- Monte sua pizza;
- Bebidas e sobremesas;
- Acompanhar pedido.

#### Bloco 3 — Oferta principal

Uma oferta por vez, com:

- nome curto;
- preço anterior, se houver;
- preço atual;
- o que está incluído;
- restrições claras;
- botão **Adicionar oferta**.

#### Bloco 4 — Mais pedidas

Cards com:

- foto;
- nome;
- descrição curta;
- preço inicial;
- selo “mais pedida” ou “nova”;
- botão de adicionar.

#### Bloco 5 — Prova de qualidade

- fermentação;
- ingredientes;
- forno;
- origem dos produtos;
- avaliações reais.

#### Bloco 6 — Recompra

- “Pedir de novo”;
- sabores favoritos;
- histórico recente;
- programa de fidelidade.

### O que evitar

- cinco banners concorrendo ao mesmo tempo;
- pop-up antes do cliente entender o cardápio;
- hero bonito sem CTA;
- textos longos acima da ação principal;
- promoção sem explicar regras;
- foto genérica de banco de imagens.

---

## 5. Ofertas: o padrão de maior valor da Domino’s

A página de ofertas transforma promoções em entradas prontas para compra. Em vez de obrigar o cliente a interpretar uma regra, a oferta aparece como uma composição concreta.

### Padrões observados

- Mix & Match: escolha dois ou mais itens com preço unitário;
- oferta de retirada;
- pizza com borda diferenciada;
- combo com duas pizzas e acompanhamento;
- produto novo com preço de experimentação;
- botão **Add deal** / adicionar oferta;
- link para detalhes e restrições;
- aviso de que preços podem variar por loja.

### O que aplicar na Sesconettos

#### Oferta como configurador

Em vez de apenas mostrar:

> “Pizza em dobro por R$ X”

Mostrar:

> **Dupla Sesconettos**  
> Escolha 2 pizzas médias + 1 bebida de 1,5 L  
> **A partir de R$ XX,XX**

Botão: **Montar combo**

#### Regras visíveis

As regras devem ficar próximas do preço:

- válido para delivery/retirada;
- sabores participantes;
- tamanho permitido;
- cobrança do sabor de maior valor, se aplicável;
- taxa de entrega separada;
- validade da promoção;
- possibilidade ou não de substituições.

#### Ofertas no momento correto

- home: uma oferta prioritária;
- cardápio: selo nos produtos participantes;
- carrinho: sugestão contextual;
- checkout: upsell pequeno, sem bloquear a finalização.

### Regra de ouro

> **A promoção deve reduzir o esforço de decisão, não adicionar uma nova dúvida.**

---

## 6. Cardápio e arquitetura de categorias

A Domino’s organiza o cardápio em grupos previsíveis:

- montar sua pizza;
- pizzas especiais;
- pães;
- frango;
- sobremesas;
- massas;
- sanduíches;
- saladas;
- bebidas;
- acompanhamentos.

### Arquitetura sugerida para a Sesconettos

1. **Mais pedidas**
2. **Pizzas da casa**
3. **Monte sua pizza**
4. **Combos**
5. **Entradas e acompanhamentos**
6. **Bebidas**
7. **Sobremesas**
8. **Molhos e adicionais**

### Regras de navegação

- categorias acessíveis por barra horizontal no mobile;
- sticky header com carrinho;
- rolagem por seção;
- busca opcional, mas não obrigatória;
- filtros simples por perfil: vegetariana, apimentada, mais pedida;
- não esconder o preço inicial;
- descrição curta e útil;
- disponibilidade em tempo real.

### Card de produto ideal

```text
[foto]
Pizza Margherita
Molho da casa, fior di latte, tomate e manjericão.
A partir de R$ 39,90
[Adicionar]
```

Ao tocar em **Adicionar**, abrir o configurador com o mínimo de contexto perdido.

---

## 7. Montagem da pizza: o coração do produto

A Domino’s expõe uma rota específica de **Build Your Pizza**. Para a Sesconettos, essa deve ser uma experiência de produto própria, não um formulário genérico.

### Fluxo recomendado

```text
1. Escolha o tamanho
2. Escolha a massa
3. Escolha a borda
4. Escolha o molho
5. Escolha os sabores
6. Ajuste os ingredientes
7. Adicione extras
8. Revise e adicione ao carrinho
```

### Regras de UX

- mostrar preço atualizado a cada escolha;
- apresentar resumo fixo do pedido;
- permitir voltar sem perder escolhas;
- explicar limites de sabores;
- indicar cobrança do sabor mais caro ou média, quando aplicável;
- separar “remover” de “adicionar extra”;
- permitir adicional por metade quando operacionalmente suportado;
- mostrar ingredientes visualmente;
- dar feedback imediato ao tocar.

### Mobile

O configurador deve ser uma sequência de passos curtos, com:

- indicador “2 de 6”;
- botão inferior fixo **Continuar**;
- preço sempre visível;
- resumo recolhível;
- tap targets grandes;
- confirmação visual ao selecionar.

### Desktop

Usar layout de duas colunas:

- esquerda: etapas e escolhas;
- direita: pizza/resumo/preço;
- CTA fixo no rodapé do configurador.

### Comunicação de complexidade

Nunca apresentar 40 opções de uma vez. Agrupar escolhas por intenção:

- **Base**;
- **Sabor**;
- **Acabamento**;
- **Extras**.

---

## 8. Carrinho: reduzir abandono

A arquitetura da Domino’s favorece um carrinho que funciona como centro de revisão e decisão.

### Carrinho da Sesconettos

Deve mostrar:

- item;
- quantidade;
- personalizações;
- preço unitário;
- subtotal;
- taxa de entrega;
- desconto;
- total;
- prazo estimado;
- modalidade delivery/retirada;
- endereço ou loja;
- botão **Continuar para pagamento**.

### Ações essenciais

- editar item;
- duplicar item;
- remover item;
- alterar quantidade;
- aplicar cupom;
- alterar endereço/modalidade;
- adicionar observação;
- voltar ao cardápio sem perder carrinho.

### Upsell responsável

No carrinho, sugerir no máximo uma ou duas opções relevantes:

- bebida;
- sobremesa;
- molho;
- borda, se ainda não escolhida.

Evitar transformar o carrinho em uma nova página de ofertas.

### Carrinho persistente

- desktop: painel lateral ou bloco fixo;
- mobile: barra inferior com quantidade e total;
- sempre informar quando o carrinho está vazio;
- lembrar o pedido durante a sessão;
- expirar preços e disponibilidade com mensagem clara, não silenciosa.

---

## 9. Checkout

O checkout deve ser curto e progressivo. A Domino’s começa pelo contexto da loja/localização, o que reduz erros posteriores.

### Etapas recomendadas

#### Etapa 1 — Entrega ou retirada

Confirmar:

- modalidade;
- endereço ou unidade;
- taxa;
- prazo.

#### Etapa 2 — Dados do cliente

- nome;
- celular;
- e-mail opcional ou solicitado apenas quando útil;
- observação de entrega.

Não obrigar cadastro completo antes da compra. Oferecer conta depois do pedido.

#### Etapa 3 — Pagamento

- Pix;
- cartão online;
- cartão na entrega, se suportado;
- dinheiro e troco, se suportado;
- pagamento na retirada, se suportado.

#### Etapa 4 — Revisão e confirmação

Mostrar uma tela final sem ambiguidade:

- itens;
- endereço;
- modalidade;
- prazo;
- taxa;
- total;
- forma de pagamento;
- botão **Confirmar pedido**.

### Princípios

- não esconder custos até o último momento;
- não exigir senha para comprar;
- usar autofill e máscara de telefone;
- validar endereço antes do pagamento;
- bloquear duplo clique no pagamento;
- mostrar estado de processamento;
- preservar pedido se houver falha de pagamento;
- oferecer retry sem duplicar o pedido.

---

## 10. Confirmação e acompanhamento do pedido

A Domino’s possui uma entrada dedicada de **Tracker**. Mesmo quando a página pública exige localização ou pedido, a arquitetura indica uma área específica para acompanhamento.

### Rastreamento da Sesconettos

Após confirmar, o cliente recebe:

- número do pedido;
- resumo;
- prazo estimado;
- modalidade;
- endereço/unidade;
- forma de pagamento;
- link de acompanhamento;
- contato da loja.

### Estados recomendados

```text
Pedido recebido
  ↓
Pagamento confirmado
  ↓
Pedido aceito pela loja
  ↓
Em preparo
  ↓
No forno
  ↓
Pronto para retirada / Saiu para entrega
  ↓
Entregue / Retirado
```

### UX do tracker

- timeline visual;
- etapa atual destacada;
- horário da última atualização;
- estimativa de conclusão;
- mensagem humana, não apenas código técnico;
- botão para falar com a loja;
- reenvio de link por WhatsApp/SMS/e-mail;
- opção de repetir pedido após a conclusão.

### Estados de exceção

O produto precisa explicar:

- loja temporariamente pausada;
- atraso na cozinha;
- endereço fora da área;
- pagamento pendente;
- item indisponível;
- entregador aguardando instrução;
- tentativa de entrega sem sucesso.

Nunca mostrar apenas “erro”.

---

## 11. Fidelidade e recompra

A Domino’s apresenta **My Rewards** como uma área própria de navegação. Isso mostra que recorrência não deve ser escondida no rodapé.

### Programa da Sesconettos

Possibilidades:

- pontos por pedido;
- pontos extras para pedido direto;
- recompensa após X pedidos;
- cashback para próxima compra;
- benefício de aniversário;
- cupom de primeira compra;
- recompensa por indicação.

### UX recomendada

Na home:

> **Pediu, pontuou.**  
> A cada pedido direto, você se aproxima da próxima recompensa.

No checkout:

- saldo atual;
- pontos gerados;
- benefício aplicado;
- próxima recompensa.

Após a compra:

- “Você ganhou X pontos”;
- CTA **Pedir novamente**;
- recomendação baseada no último pedido.

---

## 12. Copy e microcopy

### Padrões observados na Domino’s

- verbos de ação curtos;
- preço em destaque;
- nome da oferta antes da explicação;
- detalhes e restrições em camada secundária;
- indicação de variação por loja/região.

### Tradução para a Sesconettos

Preferir:

- **Pedir agora** em vez de “Conheça nosso cardápio”;
- **Montar minha pizza** em vez de “Personalize seu produto”;
- **Adicionar ao pedido** em vez de “Comprar”;
- **Continuar para pagamento** em vez de “Próximo”;
- **Acompanhar pedido** em vez de “Status”;
- **Quero retirar na loja** em vez de “Takeout”.

### Tom da Sesconettos

- caloroso;
- apetitoso;
- direto;
- artesanal sem ser pretensioso;
- brasileiro;
- claro em preço e prazo.

Exemplos:

- “Saiu do forno.”
- “Estamos preparando sua pizza.”
- “Seu pedido está a caminho.”
- “Quer deixar essa pizza ainda melhor?”
- “Essa é uma das favoritas da casa.”

---

## 13. O que copiar como princípio e o que não copiar

| Da Domino’s | Para a Sesconettos |
|---|---|
| CTA de pedido sempre visível | Manter **Pedir agora** fixo e destacado |
| Delivery ou retirada no começo | Confirmar modalidade antes de montar o pedido |
| Ofertas prontas | Criar combos configuráveis |
| Menu por categorias | Separar pizzas, combos, bebidas e sobremesas |
| Build your own | Criar montador visual em etapas |
| Carrinho com total | Mostrar preço e prazo o tempo todo |
| Tracker | Criar timeline de forno e entrega |
| Rewards | Criar pontos/cashback para canal direto |
| Clareza de restrições | Mostrar regras junto da oferta |
| Marca Domino’s | **Não copiar** |
| Azul/vermelho e escudo | **Não copiar** |
| Linguagem fast-food | **Não copiar** |
| Banners em excesso | **Não copiar** |
| Promoções complexas | Simplificar para o contexto brasileiro |

---

## 14. Direção visual recomendada para a Sesconettos

### Posicionamento

**Pizzaria artesanal contemporânea com pedido digital simples.**

A experiência deve parecer:

- mais autoral que uma rede;
- mais fácil que um restaurante artesanal confuso;
- mais calorosa que um marketplace;
- mais confiável que um cardápio improvisado no WhatsApp.

### Paleta sugerida

Não usar a combinação Domino’s de azul e vermelho.

Possível direção:

- **Grafite forno:** `#1F1B18`
- **Creme massa:** `#F7F0E6`
- **Vermelho tomate queimado:** `#B7472A`
- **Amarelo queijo:** `#D99A3D`
- **Verde manjericão:** `#52624C`
- **Cinza pedra:** `#8B8177`

### Tipografia

- display com personalidade para títulos;
- sans-serif limpa para menu, preço e checkout;
- evitar scripts em nomes de produtos;
- manter preços e CTAs altamente legíveis.

### Fotografia

- fotos próprias;
- uma linguagem de luz consistente;
- ângulos de 45° para desejo e textura;
- fotos de cima para comparação do cardápio;
- fundo escuro ou pedra para destacar ingredientes;
- evitar montagem artificial e excesso de efeitos.

### Layout

- bastante espaço negativo;
- cards claros;
- botões grandes;
- sticky cart;
- blocos editoriais curtos;
- mobile first;
- animações discretas, rápidas e funcionais.

---

## 15. Requisitos funcionais do produto próprio

### Cliente

- acessar sem cadastro;
- escolher delivery/retirada;
- cadastrar endereço;
- consultar taxa e prazo;
- navegar pelo cardápio;
- montar pizza;
- configurar borda, massa, sabores e extras;
- aplicar cupom;
- pagar;
- receber confirmação;
- acompanhar status;
- repetir pedido;
- acumular fidelidade;
- receber notificações.

### Operação/PDV

O pedido online deve chegar com o mesmo modelo de dados do pedido feito no balcão:

- número;
- canal;
- cliente;
- telefone;
- modalidade;
- endereço;
- itens;
- personalizações;
- observações;
- pagamento;
- prazo prometido;
- status;
- histórico de alterações.

### Estados do PDV

- novo;
- aceito;
- em preparo;
- no forno;
- pronto;
- saiu para entrega;
- concluído;
- cancelado;
- pendência de pagamento.

### Notificações

- pedido recebido;
- pedido aceito;
- mudança de status;
- atraso;
- saiu para entrega;
- entregue;
- recuperação de carrinho, com consentimento.

---

## 16. Métricas para validar se a experiência funciona

### Funil principal

1. visita na home;
2. clique em pedir;
3. modalidade escolhida;
4. cardápio visualizado;
5. item adicionado;
6. carrinho iniciado;
7. checkout iniciado;
8. pagamento concluído;
9. pedido aceito;
10. pedido concluído;
11. recompra.

### Métricas essenciais

- conversão de visita para pedido;
- tempo até primeiro item no carrinho;
- abandono no endereço;
- abandono no configurador;
- abandono no pagamento;
- valor médio do pedido;
- taxa de venda de bebida/sobremesa;
- taxa de uso de ofertas;
- tempo real de aceite no PDV;
- tempo de preparo;
- atraso por modalidade;
- recompra em 30 dias;
- participação do canal próprio versus marketplaces.

### Eventos de analytics

```text
home_view
order_intent_clicked
fulfillment_selected
address_validated
category_viewed
product_viewed
customizer_started
customizer_step_completed
item_added
cart_viewed
coupon_applied
checkout_started
payment_started
order_confirmed
order_status_changed
order_completed
reorder_clicked
loyalty_reward_viewed
```

---

## 17. MVP recomendado para a Sesconettos

### Fase 1 — Comprar sem atrito

- home;
- delivery/retirada;
- endereço;
- cardápio;
- produtos prontos;
- montador básico;
- carrinho;
- checkout;
- Pix/cartão;
- confirmação;
- painel de pedidos do restaurante.

### Fase 2 — Operação profissional

- status de forno;
- tracker;
- impressão/cozinha;
- área de entrega;
- horários;
- cupons;
- combos;
- agendamento;
- cancelamento e reembolso operacional.

### Fase 3 — Crescimento

- fidelidade;
- repetir pedido;
- CRM;
- notificações por WhatsApp;
- relatórios;
- estoque por ficha técnica;
- integração com marketplaces;
- múltiplas unidades.

---

## 18. Decisões finais de produto

1. **A Sesconettos deve ter canal próprio de pedido.**
2. **A primeira tela deve perguntar delivery ou retirada.**
3. **O cliente não precisa criar conta para comprar.**
4. **O cardápio deve privilegiar as mais pedidas e ofertas, sem esconder o menu completo.**
5. **O montador de pizza precisa ser visual, progressivo e com preço em tempo real.**
6. **O carrinho deve ficar acessível em todas as telas.**
7. **O checkout precisa ser curto e transparente.**
8. **O PDV deve receber pedidos online com dados estruturados, não como texto solto.**
9. **O cliente precisa acompanhar o pedido por estados operacionais reais.**
10. **A estética será própria da Sesconettos — artesanal contemporânea — e não uma cópia da Domino’s.**

---

## 19. Fontes consultadas

### Domino’s — experiência de pedido

- [Domino’s US — Home / Order Now](https://www.dominos.com/en/)
- [Domino’s US — Menu](https://www.dominos.com/menu)
- [Domino’s US — Build Your Own](https://www.dominos.com/menu/build-your-own)
- [Domino’s US — Deals](https://www.dominos.com/deals)
- [Domino’s US — Tracker](https://www.dominos.com/tracker)
- [Domino’s Brasil](https://www.dominos.com.br/)

### Referências complementares de UX de pizza

- [Push — Best Pizza Restaurant Websites](https://pushhere.com/news/best-pizza-restaurant-websites-to-inspire-your-next-redesign)
- [Muffin Group — Pizza Website Design Examples](https://muffingroup.com/blog/pizza-websites/)
- [Nice Branding — Valeo’s Pizza Website Case Study](https://nice-branding.com/work/pizza-restaurant-website-design/)

### Nota sobre a pesquisa

Algumas rotas da Domino’s US foram exibidas em modo de conteúdo público, mas a continuação do pedido ficou protegida por CAPTCHA e seleção de loja. Por isso, este documento registra com segurança os padrões observáveis de arquitetura, navegação, ofertas, cardápio, montagem, entrada de pedido e rastreamento, sem inventar telas internas que não puderam ser validadas.
