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
| `pedido.html?id=…` | Acompanhamento com linha do tempo, previsão em horário, WhatsApp/ligar (ou busca pelo celular) |
| `conta.html` | Minha conta (aba "Conta" da tab bar) |
| `admin/` | Painel da equipe: pedidos em tempo real, loja, cardápio, cupons |

## UX mobile ("cara de app")

- Tab bar com 4 abas (Início · Cardápio · Sacola · Conta) e barra fixa de CTA acima dela, sempre respeitando `safe-area-inset-bottom`
  (`body.tem-barra` / `body.tem-sacola` reservam o espaço para nada ficar escondido).
- Cardápio: chips de categoria fixos com scroll-spy (`js/pages/cardapio.js`), busca sem acento (lupa ao lado dos chips), "Adicionar" rápido
  com stepper nos produtos simples (`js/cards.js`); pizzas e combos abrem o configurador.
- Modais são bottom sheets no celular (`.modal.sheet` em `js/ui.js`): puxador, arrastar para baixo fecha, `Esc`, corpo rolável e rodapé fixo com o CTA.
- "Pedir de novo" (`js/repetir.js`): o checkout guarda os itens em `LS.ultimoPedido`; home, sacola vazia e acompanhamento reconstroem a sacola
  revalidando cada item contra o cardápio atual (indisponível → aviso).
- `pedido.html` tem um contêiner `[data-push]` (com `data-pedido-id`/`data-pedido-status`) reservado para o botão de aviso por push.

## PWA (site como app)

O site é instalável e funciona como um app "quase nativo": ícone na tela de início, abre sem a barra do
navegador (`display: standalone`), cache offline e avisos por push do status do pedido.

- **Arquivos**: `manifest.webmanifest` (nome, ícones `any` + `maskable` em `img/icons/`, atalhos Cardápio/Sacola/Pedido/Conta),
  `sw.js` (service worker na raiz, escopo `/`), `offline.html` + `js/pages/offline.js` (página sem internet), `js/pwa.js`
  (registro do SW, toast de atualização, banner de instalação, push). Os `<head>` de todas as páginas têm manifest, favicons,
  `apple-touch-icon` e as metas da Apple (`black-translucent`: o header cresce com `env(safe-area-inset-top)` no app instalado).
- **Cache** (`sw.js`): HTML/CSS/JS/manifest são *network-first* (cada visita busca a versão nova; sem rede cai no cache e, por fim,
  em `/offline`); imagens e fontes locais *stale-while-revalidate*; `esm.sh` e Google Fonts SWR em cache próprio.
  Supabase, ViaCEP, Nominatim, Google Maps e `/admin` **nunca** passam pelo cache.
- **Como instalar**: Android/Chrome — banner "Instalar app" (aparece a partir da 2ª visita ou após um pedido; some por 14 dias
  se dispensado) ou menu ⋮ → *Instalar app*. iPhone — Safari → Compartilhar → *Adicionar à Tela de Início* (o site mostra o
  passo a passo). Desktop Chrome/Edge — ícone de instalar na barra de endereço.
- **Push (avisos do pedido)**: na página do pedido, o botão "Avisar quando sair para entrega" (retirada: "quando estiver pronto")
  pede a permissão em resposta ao toque, assina com a `VAPID_PUBLIC_KEY` de `js/config.js` e envia a subscription pela RPC
  `push_assinar(p_pedido, p_subscription)` (prova de posse = UUID do pedido; máx. 3 aparelhos por pedido). O servidor manda
  `{title, body, icon, badge, data:{url:'/pedido?id=…'}}`; o SW mostra a notificação e, ao tocar, foca/abre a página do pedido.
  No iPhone o push só funciona com o app instalado (iOS 16.4+), então o botão mostra a dica de instalar.
- **Testar push num celular**: publique (HTTPS é obrigatório), abra o site no celular, faça um pedido, toque em "Avisar quando…"
  e aceite a permissão (no iPhone: instale antes e abra pelo ícone). Depois mude o status no painel `/admin` e veja a notificação
  chegar com a tela bloqueada. No Chrome desktop, DevTools → Application → Service Workers → "Push" simula um envio.
- **Publicar nova versão**: altere a constante `VERSAO` no topo de `sw.js` a cada deploy (ex.: `2026-09-29-2`). O navegador
  instala o SW novo em silêncio e a página mostra o toast "Nova versão disponível — Atualizar"; só ao tocar é que o SW novo
  assume (`SKIP_WAITING`) e a página recarrega. `sw.js` é servido com `Cache-Control: no-cache` (`vercel.json`).
- **Checar instalabilidade**: Chrome → DevTools → Application → Manifest ("Installability") e Service Workers (testar "Offline").

## Conta e cashback no site (Clube Sesconetto's)

Programa de fidelidade sem cadastro: a identidade é o celular do pedido e o acesso ao saldo é por PIN de 4 dígitos.
Os parâmetros vêm de `config.fidelidade` (`{ativo, validade_dias, min_resgate, max_pct_pedido, niveis:[{nome, min_pedidos_90d, pct}]}`),
que chega ao front pelo `cardapio()`; com `ativo=false` nada aparece no site. Lógica compartilhada em `js/fidelidade.js`
(cálculo da prévia, uso máximo, textos, regulamento, "esqueci o PIN", "trocar PIN"); RPCs em `js/api.js` (`fidelidade*`).

- **Acumular**: todo pedido entregue e pago credita `pct` do nível (Bronze 5 % · Prata 7 % · Ouro 10 %, pelo nº de pedidos
  entregues em 90 dias) sobre `subtotal − cupom − cashback usado` (taxa fora), truncado no centavo, válido por 90 dias.
  A sacola e o checkout mostram a prévia ("você ganha R$ X quando o pedido for entregue").
- **Criar PIN** (`pedido.html?id=…`): o card "Crie seu PIN" aparece quando o celular do pedido ainda não tem PIN; a prova de
  posse é o UUID do pedido (`fidelidade_criar_pin`). Depois de entregue, a página mostra "R$ X creditados" e o botão "Ver meu saldo".
- **Ver saldo** (`conta.html`, aba Conta): celular + PIN → `fidelidade_saldo` devolve saldo, nível, progresso para o próximo
  nível, próximo vencimento e histórico. Só o celular fica salvo no aparelho (`LS.fidelidadeTel`); o PIN é pedido a cada visita.
  Erros de PIN mostram as tentativas restantes; 5 erros bloqueiam por 15 min. "Esqueci meu PIN" abre o WhatsApp com mensagem
  pronta (a equipe reseta pelo painel e o cliente cria outro pelo link do último pedido). "Trocar PIN" usa `fidelidade_trocar_pin`.
- **Usar no checkout**: ao preencher o celular, `fidelidade_resumo` (sem saldo) diz se há PIN. Com PIN, o toggle "Usar meu
  cashback" pede o PIN, consulta o saldo e aplica `min(saldo, max_pct_pedido % dos produtos)` (só se saldo ≥ `min_resgate`);
  o pedido vai com `usar_cashback: true, pin`. Se o servidor recusar o PIN, `criar_pedido` responde `{ok:false, erro}` e o
  checkout mostra o erro no bloco do cashback sem perder o formulário. O valor exato vem do servidor em `cashback_usado`.
- **Home**: banner "Ganhe 5 % a 10 % de cashback" → sheet com níveis e regulamento resumido; "Ver meu saldo" se houver celular salvo.

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
