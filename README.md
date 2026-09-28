# Sesconetto's Pizzeria — site de pedidos

Site próprio de pedidos da Sesconetto's (pizza napolitana, Vicente Pires/DF), inspirado no fluxo
de compra da Domino's: entrega ou retirada → cardápio → monte a pizza (até 2 sabores) → pedido →
pagamento → acompanhamento em tempo real. Sem cadastro para o cliente.

## Como funciona

- **Front-end estático** (HTML + CSS + JavaScript puro, sem build). Deploy na Vercel com preset "Other".
- **Backend no Supabase** (Postgres): catálogo, pedidos, configurações da loja e painel da equipe.
  As chaves públicas ficam em `js/config.js`; a segurança está nas políticas RLS e nas funções do banco
  (`supabase/migrations/0001_schema.sql`). O preço do pedido é sempre recalculado no servidor.

## Páginas

| Arquivo | O que é |
|---|---|
| `index.html` | Home: hero, atalhos, mais pedidas, combos, nossa massa, contato |
| `cardapio.html` | Cardápio com chips de categoria |
| `produto.html?sabor=…` / `?meio=1` / `?p=…` | Configurador de pizza (tamanho + sabores) ou produto/combo |
| `carrinho.html` | Pedido: itens, entrega/retirada, agora/agendar, cupom, totais |
| `checkout.html` | Dados do cliente, observações, pagamento, confirmação |
| `pedido.html?id=…` | Acompanhamento com linha do tempo (ou busca pelo celular) |
| `admin/` | Painel da equipe: pedidos em tempo real, loja, cardápio, cupons |

## Painel da equipe

Acesse `/admin` com o e-mail e senha cadastrados no Supabase (Authentication → Users).
No painel dá para: mudar o status dos pedidos (o cliente vê na hora), fechar a loja manualmente,
alterar horários, taxas por km, tempos, chave Pix, esgotar sabores/produtos, editar preços e criar cupons.

## Dados da loja e cardápio

O cardápio real foi importado para `seed/cardapio.json` e carregado no banco (`supabase/seed.sql`).
Fotos dos produtos em `img/cardapio/`. Depois da carga inicial, tudo se edita pelo painel.

## Deploy na Vercel

- Application Preset: **Other** · Root Directory: `./` · sem build, sem install, sem output directory.
- `vercel.json` já configura URLs limpas e cache das imagens.

## Referências de UX

`docs/` guarda o benchmark da Domino's (conceitual + observado) que orientou o formato do site.
