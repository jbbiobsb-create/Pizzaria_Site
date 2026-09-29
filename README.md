# Sesconetto's Pizzeria — site de pedidos

Site próprio de pedidos da Sesconetto's (pizza napolitana, Vicente Pires/DF). Fluxo "pizza antes de
logística": cardápio com preços sempre visíveis → pizza inteira em 1 toque (ou configurador para meio a meio)
→ uma tela "Fechar pedido" (itens, entrega/retirada inline, dados, pagamento) → acompanhamento em tempo real.
Sem cadastro para o cliente; endereço só é pedido na hora de fechar.

## Como funciona

- **Front-end estático** (HTML + CSS + JavaScript puro, sem build). Deploy na Vercel com preset "Other".
- **Backend no Supabase** (Postgres): catálogo, pedidos, configurações da loja e painel da equipe.
  As chaves públicas ficam em `js/config.js`; a segurança está nas políticas RLS e nas funções do banco
  (`supabase/migrations/0001_schema.sql`). O preço do pedido é sempre recalculado no servidor.

## Páginas

| Arquivo | O que é |
|---|---|
| `index.html` | Home: "Pedir de novo" no topo (recorrente, botão "Repetir e confirmar"), hero curto com 1 CTA, "As mais pedidas" com chips de tamanho na 1ª tela, atalhos, combos, nossa massa, contato |
| `cardapio.html` (`?cat=slug` mostra só uma categoria) | Cardápio com chips de categoria; card de pizza com chips "Bambina R$ X / Grande R$ Y" que adicionam em 1 toque |
| `produto.html?sabor=…` / `?meio=1` / `?p=…` | Configurador de pizza (Grande pré-marcada, meio a meio, observações recolhidas) ou produto/combo; "Adicionar" vai direto para "Fechar pedido" |
| `checkout.html` | **Fechar pedido** (tela única): itens editáveis → "Como você recebe?" inline (endereço lembrado com "Usar este", loja de retirada sugerida em 1 toque, agendar recolhido; loja fechada exige agendamento) → "Quem recebe" (nome/celular lembrados) → "Como você paga" (3 opções; última escolha marcada) → opcionais recolhidos (e-mail, observações, cupom, troco) → faixa "Completa com" → barra fixa "Confirmar pedido · total" com a pendência atual |
| `carrinho.html` | Só redireciona para `checkout.html` (links antigos, atalho do PWA, cache do SW) |
| `pedido.html?id=…&novo=1` | Acompanhamento: bloco Pix no topo (chave copiável, valor, comprovante no WhatsApp) quando o pagamento é Pix, status, previsão em horário, linha do tempo, WhatsApp/ligar, "Pedir de novo" (ou busca pelo celular) |
| `conta.html` | Minha conta (aba "Conta" da tab bar) |
| `admin/` | Painel da equipe: pedidos em tempo real, loja, cardápio, cupons |

## Fluxo de compra (conversão)

Princípios (auditoria `aud-conversao.md`): pizza antes de logística, uma pergunta em um só lugar, padrão inteligente sempre
editável, obrigatório visível e opcional recolhido, upsell sem bloquear, sem checkbox de aceite (texto legal abaixo do botão).

- **Entrega/retirada** é um componente único (`entregaHTML()` + `montarEntrega()` em `js/ui.js`) usado inline em `checkout.html`
  e dentro do bottom sheet (pill "Informar endereço" do subheader, "trocar"). "Entrega" já vem aberta; a taxa é calculada sozinha
  quando rua, número e bairro estão preenchidos (`calcular_entrega`), e o último endereço fica em `LS.enderecoLembrado` para "Usar este".
  "Retirar na loja" já escolhe a loja sugerida (mais perto do endereço lembrado ou a principal); a lista permite trocar.
- **Chips de tamanho** no card (`js/cards.js` `cardSabor`, `[data-add-pizza][data-tamanho]`): mostram os dois preços reais (sem
  "a partir de") e adicionam a pizza inteira; o corpo do card abre o configurador. Toast "X na sacola" com ação "Ver sacola".
- **Barra fixa** do cardápio/home: "N · Fechar pedido · R$ X" → `checkout.html`. Na tela de fechamento a barra mostra o total e a
  primeira pendência ("Falta o endereço", "Falta seu nome", "Escolha como paga"…); sem pendência, o texto legal.
- **Gatilhos honestos**: tag "Mais pedida", "desde 2022 · 3 lojas", "Aberto agora · fecha às 23:30", faixa "Fechamos às HH:MM" só
  quando faltam menos de 60 min, Grande pré-marcada com o motivo, cashback com frame de perda ("Não perca R$ X de volta"). Nada de contador falso.
- **Instrumentação** (`track(evento, dados)` em `js/util.js`): grava em `localStorage.ses_eventos` (últimos 200) e `console.debug`.
  Eventos: `ver_cardapio`, `add_item {origem: card|configurador|faixa|repetir}`, `abrir_fechar_pedido`, `endereco_ok`,
  `pagamento_escolhido`, `confirmar`, `pedido_ok`, `pix_copiado`. Sem serviço externo.

## UX mobile ("cara de app")

- Tab bar com 4 abas (Início · Cardápio · Sacola · Conta) e barra fixa de CTA acima dela, sempre respeitando `safe-area-inset-bottom`
  (`body.tem-barra` / `body.tem-sacola` reservam o espaço para nada ficar escondido).
- Cardápio: chips de categoria fixos com scroll-spy (`js/pages/cardapio.js`), busca sem acento (lupa ao lado dos chips), "Adicionar" rápido
  com stepper nos produtos simples (`js/cards.js`); pizzas e combos abrem o configurador.
- Modais são bottom sheets no celular (`.modal.sheet` em `js/ui.js`): puxador, arrastar para baixo fecha, `Esc`, corpo rolável e rodapé fixo com o CTA.
- "Pedir de novo" (`js/repetir.js`): o checkout guarda os itens em `LS.ultimoPedido` (com canal e pagamento); a home mostra o card no topo
  com "Repetir e confirmar" (vai direto para "Fechar pedido" já completo), e sacola vazia/acompanhamento reconstroem a sacola
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
- **Como instalar**: Android/Chrome — banner "Sesconetto's na sua tela" (aparece na página do pedido recém-enviado, a partir da 2ª visita ou após um pedido; some por 14 dias
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
- **Criar PIN** (`pedido.html?id=…`): o card "Crie seu PIN" aparece **só depois que o pedido está entregue e pago** e o celular
  ainda não tem PIN (antes disso a página avisa "Depois que o pedido for entregue você cria seu PIN aqui"). A prova de posse é o
  UUID de um pedido entregue nos últimos 30 dias (`fidelidade_criar_pin`, migração `0009`); o pedido usado fica em `clientes.pin_origem_pedido`.
  Se o celular já tinha saldo antes desse pedido e ele é o único entregue, o PIN só é criado pelo atendimento (WhatsApp) — evita
  sequestrar o saldo de outra pessoa fazendo um pedido com o celular dela. Entregue, a página mostra "R$ X creditados" e "Ver meu saldo".
- **Ver saldo** (`conta.html`, aba Conta): celular + PIN → `fidelidade_saldo` devolve saldo, nível, progresso para o próximo
  nível, próximo vencimento e histórico. Só o celular fica salvo no aparelho (`LS.fidelidadeTel`); o PIN é pedido a cada visita.
  Erros de PIN mostram as tentativas restantes; a partir do 5º erro o bloqueio é escalonado (15 min, 30 min, 1 h… até 32 h) e o
  contador só zera quando o PIN certo é digitado. "Esqueci meu PIN" abre o WhatsApp com mensagem
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

## Fidelidade e cashback (Clube Sesconetto's)

Migração `supabase/migrations/0007_fidelidade.sql`. Sem cadastro: a conta é o **celular** do pedido.

- **Regras** (tudo em `config.fidelidade`, editável na aba **Fidelidade** do painel): programa ativo; níveis por pedidos
  entregues nos últimos 90 dias — Bronze 5 % (0–2), Prata 7 % (3–5), Ouro 10 % (6+); base = produtos − cupom − cashback usado
  (taxa de entrega fora), truncado no centavo; crédito só quando o pedido fica `entregue` **e** `pagamento_status` é `pago`/`na_entrega`;
  cada crédito vale 90 dias e é consumido do mais antigo (FIFO); mínimo para usar R$ 10; máximo 50 % do valor dos produtos por pedido;
  pode somar com cupom; sem bônus de boas-vindas. O % do nível fica congelado em cada pedido (`pedidos.fidelidade_pct`).
- **Cancelamentos**: pedido cancelado que usou cashback devolve o valor como crédito novo; pedido cancelado depois de creditado
  sofre estorno — se o crédito já foi gasto, o saldo fica negativo (`clientes.debito_pendente`) e é abatido no próximo crédito.
- **PIN**: para ver ou usar o saldo o cliente cria um PIN de 4 dígitos pelo link de um pedido **entregue e pago** (≤ 30 dias;
  `pedido.html?id=UUID`, prova de posse). PINs proibidos: repetidos (0000…9999), 1234, 4321, 0123, 3210, 2580, 0852, 1212, 6969
  (mesma lista em `fidelidade_pin_valido` e `js/fidelidade.js`). Bloqueio escalonado: 5º erro → 15 min, 6º → 30 min, 7º → 1 h…
  teto de 32 h; as tentativas só zeram no acerto (e 30 erros por IP em 15 min bloqueiam o IP). Esqueceu? A equipe reseta no painel.
  O IP usado nos limites vem de `cf-connecting-ip`, senão do **último** elemento de `x-forwarded-for`, senão `x-real-ip`.
- **Tabelas**: `clientes` (celular, `pin_hash` bcrypt, bloqueio), `fidelidade_movimentos` (crédito/débito/estorno/expirado/ajuste,
  com `restante` e `expira_em`), `fidelidade_tentativas`. Só a equipe lê (RLS); o site usa RPCs `security definer`.
- **RPCs públicas** (anon): `fidelidade_resumo(p_telefone)` → `ativo`, `tem_conta`, `tem_pin`, nível, % e as regras (**nunca** o saldo
  nem o nº de pedidos);
  `fidelidade_saldo(p_telefone, p_pin)` → `{ok, saldo, nivel, pct, pode_usar, proximo_vencimento, movimentos[]}` ou `{ok:false, motivo, bloqueado?}`;
  `fidelidade_criar_pin(p_pedido uuid, p_pin)`; `fidelidade_trocar_pin(p_telefone, p_pin_atual, p_pin_novo)`.
  Equipe: `fidelidade_cliente(p_telefone)` (ficha) e `fidelidade_ajustar(p_telefone, p_valor, p_descricao)` (+ credita, − debita, motivo obrigatório).
- **No pedido**: `criar_pedido` aceita `usar_cashback: true` e `pin` no payload. O servidor calcula o valor (`min(saldo, 50 % dos produtos)`),
  grava `cashback_usado` e o `total` já líquido (que é o que vai à Saipos como `total_discount = desconto + cashback_usado`).
  **PIN errado, saldo abaixo do mínimo ou saldo insuficiente devolvem `{ok:false, erro, cashback:true}` sem exceção** (para o
  contador de tentativas persistir e o checkout zerar o desconto na tela) — o front checa `data.erro`.
  `consultar_pedido` devolve `cashback_usado`, `cashback_ganho` (após entregar), `cashback_previsto`, `fidelidade_nivel`, `fidelidade_pct`,
  `fidelidade_ativa` e `tem_pin`.
- **Painel** (aba Fidelidade): liga/desliga o programa, edita níveis/%, validade, mínimo e máximo; busca por celular mostra nome, nível,
  saldo, PIN e movimentos, com **Ajustar saldo** (valor ± motivo — **o motivo aparece para o cliente** no extrato) e **Resetar PIN**.
  O card/detalhe do pedido mostra o cashback usado e o ganho. Pedido **cancelado não pode ser reaberto** (trigger `tg_pedidos_status`;
  o painel não oferece botões de status para ele).

## Notificações push (status do pedido)

Migração `supabase/migrations/0008_push.sql` + Edge Function `supabase/functions/push-enviar` (`jsr:@negrel/webpush`, só WebCrypto).

- O cliente assina na página do pedido: `push_assinar(p_pedido uuid, p_subscription jsonb)` (prova de posse = UUID; máx. 3 aparelhos por
  pedido; upsert por `endpoint`; recusa pedido já `entregue`/`cancelado`; só endpoints `https` de `fcm.googleapis.com`,
  `*.push.services.mozilla.com`, `web.push.apple.com`/`*.push.apple.com` e `*.notify.windows.com`, JSON < 4 KB). Uma recusa vem como
  `{ok:false, motivo}` e o front mostra o motivo sem marcar "avisos ligados". `push_cancelar(p_endpoint)` remove.
  `push-enviar` compara a `x-internal-key` em tempo constante e loga só contagens; o SW só abre URLs do próprio domínio ao tocar na notificação.
- Quando `pedidos.status` muda (painel, webhook Saipos ou SQL) e o pedido tem assinantes, o trigger `pedidos_push_disparar` chama
  `push-enviar` via `pg_net` com o header `x-internal-key` (mesmo padrão da Saipos). A função lê as chaves `VAPID_*` do Vault
  (`integracao_segredos()`), converte para JWK e envia `{title, body, icon:'/img/icons/icon-192.png', badge:'/img/icons/badge-96.png',
  tag, data:{url:'/pedido.html?id=…'}}`. Textos por status: confirmado ("Pedido #N confirmado! Já vamos preparar."), preparando,
  no_forno ("Sua pizza está no forno 🔥"), saiu_entrega ("Saiu para entrega!"), pronto_retirada ("Pronto para retirar na loja X"), entregue, cancelado.
- Endpoints que respondem 404/410 são apagados; outros erros ficam em `push_assinaturas.ultimo_erro`. Após `entregue`/`cancelado`
  as assinaturas do pedido são removidas; assinaturas com mais de 7 dias somem na próxima chamada de `push_assinar`.
- Depurar: `select * from net._http_response order by id desc limit 5` e os logs da função `push-enviar` no Supabase.

## Três lojas (Asa Sul, SIG, Vicente Pires)

- Tabela `lojas` (migração `0005`): endereço, coordenadas, se faz entrega/retirada, se está ativa e o
  `saipos_cod_store` (o "COD. LOJA" da loja no canal Saipos; vazio = PDV padrão com "LOJA: X" na observação).
- **Entrega**: sai da loja ativa mais próxima do endereço; a taxa é pela distância até ela (faixas da `config`).
- **Retirada**: o cliente escolhe a loja no modal (vem sugerida a mais perto do endereço salvo).
- Horário, taxas, raio e tempos são os da `config`, iguais para as três por enquanto.
- Painel: aba Loja → "Lojas" para ativar/desativar e cadastrar o código Saipos; filtro por loja nos pedidos.
