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

O cardápio foi importado do Anota Aí (`seed/cardapio.json`, `supabase/seed.sql`) e depois atualizado com a planilha de
códigos de integração da Saipos (`supabase/seed_saipos.sql`): tamanhos Bambina/Grande, calzones, entradas, sobremesas,
bebidas, cervejas, vinhos e drinks. Os códigos Saipos ficam nas colunas `codigo_saipos`.
Fotos dos produtos em `img/cardapio/`. Depois da carga inicial, tudo se edita pelo painel.

## Deploy na Vercel

- Application Preset: **Other** · Root Directory: `./` · sem build, sem install, sem output directory.
- `vercel.json` já configura URLs limpas e cache das imagens.

## Referências de UX

`docs/` guarda o benchmark da Domino's (conceitual + observado) que orientou o formato do site.

## Integração com o PDV Saipos

Pedidos prontos para o PDV (pagos no site ou com pagamento na entrega) vão sozinhos para a Saipos,
e as mudanças de status feitas no PDV voltam para o site.

- `supabase/migrations/0002_saipos.sql`: `pagamento_status` e colunas `saipos_*` em `pedidos`; triggers que
  chamam a Edge Function `saipos-enviar` (via `pg_net`) quando o pedido fica `pago` ou `na_entrega`;
  tabela `saipos_eventos` com os avisos recebidos.
- `supabase/functions/saipos-enviar`: monta o pedido no formato da API de Pedidos da Saipos (`POST /order`).
  Pizzas usam o `codigo_saipos` de `sabor_precos` (`ITEM.COMPLEMENTO`: item antes do ponto, sabor como complemento).
- `supabase/functions/saipos-webhook`: recebe `CONFIRMED`, `DISPATCHED`, `CONCLUDED` e `CANCELLED`.
  URL no Saipos Developer: `https://<projeto>.supabase.co/functions/v1/saipos-webhook?key=<SAIPOS_WEBHOOK_KEY>`.
- Credenciais no **Vault** do Supabase (nunca no front): `SAIPOS_ID_PARTNER`, `SAIPOS_SECRET`, `SAIPOS_COD_STORE`
  (o "COD. LOJA" do canal, não o ID da loja), `SAIPOS_BASE_URL`, `SAIPOS_WEBHOOK_KEY`, `SAIPOS_INTERNAL_KEY`,
  `SUPABASE_FUNCTIONS_URL`.
- Cancelar no site (status `cancelado`) cancela também na Saipos (`POST /cancel-order`); a Saipos não avisa
  pelo webhook os cancelamentos feitos pela API.
- O token da Saipos fica salvo em `integracao_tokens` e é reaproveitado: cada login novo invalida o anterior,
  então pedidos simultâneos não podem pedir um token cada um.
- Painel: etiquetas de pagamento e de envio, botão **Pix recebido** (confirma Pix manual e envia) e
  **Reenviar à Saipos** quando o envio der erro.

## Segurança e antifraude

- **Painel só para a equipe**: quem pode usar o `/admin` está na tabela `equipe` (não basta ter conta no Supabase).
  Para dar acesso a alguém: crie o usuário em Authentication → Users e rode
  `insert into equipe (user_id, nome) select id, 'Nome' from auth.users where email = 'pessoa@email.com';`.
- **Pedidos** (`criar_pedido`, migração `0004`): no máximo 3 pedidos por celular e 5 por IP a cada 15 min; no máximo 2
  pedidos aguardando pagamento por celular; combos só aceitam as opções configuradas; cupom com `uso_por_cliente`
  (padrão 1 por celular); troco coerente com o total; limites de tamanho em nome, observações e itens.
- **Privacidade**: a busca por celular mostra só status e resumo (sem link); os detalhes do pedido abrem só pelo link.
- **Webhook Saipos**: exige a chave da URL e o `cod_store` da loja.
- **Cabeçalhos** (`vercel.json`): CSP, HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`; `/admin` sem cache e fora do Google.

## Três lojas (Asa Sul, SIG, Vicente Pires)

- Tabela `lojas` (migração `0005`): endereço, coordenadas, se faz entrega/retirada, se está ativa e o
  `saipos_cod_store` (o "COD. LOJA" da loja no canal Saipos; vazio = PDV padrão com "LOJA: X" na observação).
- **Entrega**: sai da loja ativa mais próxima do endereço; a taxa é pela distância até ela (faixas da `config`).
- **Retirada**: o cliente escolhe a loja no modal (vem sugerida a mais perto do endereço salvo).
- Horário, taxas, raio e tempos são os da `config`, iguais para as três por enquanto.
- Painel: aba Loja → "Lojas" para ativar/desativar e cadastrar o código Saipos; filtro por loja nos pedidos.
