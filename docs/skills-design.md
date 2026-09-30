# Skills de design e experiência instaladas no site da pizzaria

Uma skill é um "manual" que o assistente lê antes de fazer uma tarefa. Ela diz a ele como um especialista naquele assunto trabalha, o que evitar e o que checar no fim. O assistente continua sendo o mesmo; a skill só deixa o resultado mais parecido com o de um profissional daquela área.

Para usar, basta digitar o nome com uma barra na frente (por exemplo `/cro`) ou pedir em português: "usa a skill cro para revisar a página de promoções". O assistente também costuma escolher a skill certa sozinho quando o pedido combina com a descrição dela.

As skills ficam nas pastas `.claude/skills` e `.agents/skills` do projeto. Algumas aparecem nas duas pastas; é a mesma skill, copiada para funcionar em ferramentas diferentes.

## Identidade visual e UI

| Skill | O que faz | Quando usar na pizzaria | Autor/fonte |
|---|---|---|---|
| `frontend-design` | Orienta escolhas de visual, fontes e cores para a tela não parecer "modelo pronto de internet". | Ao criar uma tela nova, como a página de promoções ou a de cada loja. | Anthropic (licença Apache 2.0) |
| `ui-ux-pro-max` | Banco de consulta com estilos, paletas de cores, pares de fontes, regras de UX e ícones, com busca por tipo de negócio. | Para escolher cores e fontes do cardápio ou conferir se uma tela segue boas práticas antes de publicar. | Comunidade (pacote "UI/UX Pro Max") |
| `design-taste-frontend` | Lê o pedido, decide a direção visual certa e entrega telas que não parecem feitas por robô; em redesign, começa por uma auditoria. | Antes de refazer a home ou o fluxo de pedido. | Leonxlnx/taste-skill |
| `design-taste-frontend-v1` | Versão antiga da skill acima, guardada só por compatibilidade. | Normalmente não; use a `design-taste-frontend`. | Leonxlnx/taste-skill |
| `high-end-visual-design` | Define fontes, espaçamentos, sombras e cartões que fazem um site parecer "caro", e bloqueia os padrões genéricos. | Quando quiser que a vitrine do cardápio pareça de uma marca premium. | Leonxlnx/taste-skill |
| `redesign-existing-projects` | Audita o site que já existe, aponta o que está genérico e melhora sem quebrar o que funciona. | Para dar um "banho de loja" no site atual sem refazer do zero. | Leonxlnx/taste-skill |
| `minimalist-ui` | Estilo limpo e editorial: tons quentes, poucas cores, sem degradês nem sombras pesadas. | Se quiser um visual mais sóbrio para a página institucional ou para a conta do cliente. | Leonxlnx/taste-skill |
| `industrial-brutalist-ui` | Estilo "cru", tipo planta técnica: grades rígidas, letras enormes e visual de terminal. | Dificilmente combina com pizzaria; talvez em um painel interno de pedidos. | Leonxlnx/taste-skill |
| `gpt-taste` | Monta páginas de venda com estrutura fixa (atenção, interesse, desejo, ação), tipografia larga, grades sem vãos e animações de rolagem avançadas. | Para uma página de campanha grande, como "Festival de pizzas de inverno". | Leonxlnx/taste-skill |
| `stitch-design-taste` | Gera um arquivo DESIGN.md com as regras visuais do projeto (fontes, cores, layout, movimento) para outras ferramentas seguirem. | Para registrar a identidade visual do site em um documento que o assistente consulta sempre. | Leonxlnx/taste-skill |
| `web-design-guidelines` | Revisa o código da tela contra uma lista de boas práticas de interface web. | Como "revisão final" de qualquer tela antes de ir ao ar. | Vercel (vercel-labs/agent-skills) |

## Sensação de app e animação

| Skill | O que faz | Quando usar na pizzaria | Autor/fonte |
|---|---|---|---|
| `mobile-native` | Corrige os detalhes que fazem o site parecer "site dentro do navegador" no celular: toque lento, zoom em campos, barra sob o entalhe da tela, rolagem estranha. | Depois de qualquer mudança no fluxo de pedido, para ele continuar parecendo um app instalado. | Baseada na filosofia de Emil Kowalski |
| `emil-design-eng` | Ensina o acabamento fino: quando animar, quando não animar, e os detalhes invisíveis que deixam a interface gostosa de usar. | Ao criar botões, gavetas de carrinho, modais e transições entre telas. | Baseada na filosofia de Emil Kowalski |
| `improve-animations` | Faz uma auditoria das animações do site e entrega um plano de melhorias em ordem de prioridade (não altera código). | Quando o site "parece travado" ou quiser um roteiro do que polir primeiro. | Baseada na filosofia de Emil Kowalski |

## Conversão e textos

| Skill | O que faz | Quando usar na pizzaria | Autor/fonte |
|---|---|---|---|
| `cro` | Analisa uma página ou formulário e aponta o que está atrapalhando a pessoa de finalizar. | Quando muita gente entra no site mas poucos concluem o pedido, ou antes de lançar a página de promoções. | Pacote de skills de marketing (versão 2.0) |
| `copywriting` | Escreve ou reescreve textos de venda: títulos, chamadas, botões, descrições. | Para nomear e descrever pizzas, escrever o título da home ou o texto do botão "Pedir agora". | Pacote de skills de marketing (versão 2.0) |
| `marketing-psychology` | Aplica princípios de comportamento (prova social, escassez, ancoragem de preço, enquadramento). | Ao montar combos, exibir "mais pedida" ou definir como mostrar o preço da entrega. | Pacote de skills de marketing (versão 2.0) |
| `onboarding` | Melhora a primeira experiência de quem acabou de se cadastrar, para a pessoa chegar rápido ao valor. | Para o clube de cashback: fazer o cliente novo entender o benefício e fazer o primeiro pedido. | Pacote de skills de marketing (versão 2.0) |

## Acessibilidade e performance

| Skill | O que faz | Quando usar na pizzaria | Autor/fonte |
|---|---|---|---|
| `accessibility` | Audita e corrige acessibilidade (leitor de tela, teclado, contraste) segundo a norma WCAG 2.2. | Antes de publicar uma tela nova, para clientes com baixa visão ou que usam leitor de tela conseguirem pedir. | web-quality-skills (licença MIT) |
| `performance` | Deixa o site mais rápido de carregar. | Quando o cardápio demora a abrir no celular com internet fraca. | web-quality-skills (licença MIT) |
| `core-web-vitals` | Cuida das três métricas que o Google usa para medir a experiência da página (carregamento, resposta ao toque, elementos que "pulam"). | Se o texto ou os botões se mexem enquanto a página carrega, ou para melhorar a posição no Google. | web-quality-skills (licença MIT) |

## Geração de imagens de referência

Estas skills foram feitas para criar imagens de referência (rascunhos visuais) antes de programar. Aqui no ambiente atual não existe gerador de imagem, então elas não funcionam por completo. Ficam registradas para quando esse recurso existir.

| Skill | O que faz | Quando usar na pizzaria | Autor/fonte |
|---|---|---|---|
| `brandkit` | Gera pranchas de identidade de marca: logo, cores, tipografia, mockups. | Para estudar uma nova identidade visual da Sesconetto's. | Leonxlnx/taste-skill |
| `imagegen-frontend-web` | Gera uma imagem de referência por seção da página, todas com a mesma paleta. | Para ver "como ficaria" uma home nova antes de programar. | Leonxlnx/taste-skill |
| `imagegen-frontend-mobile` | Gera telas de app de celular dentro de um mockup de iPhone. | Para visualizar o fluxo de pedido como app antes de construir. | Leonxlnx/taste-skill |
| `image-to-code` | Gera a imagem da tela, analisa e depois programa o site para ficar igual. | Para transformar uma referência visual em página pronta. | Leonxlnx/taste-skill (feita para o Codex) |

## Outras instaladas (não são de design)

| Skill | O que faz | Autor/fonte |
|---|---|---|
| `playwright-skill` | Abre o site em um navegador automatizado para testar, tirar prints e checar links. | lackeyjb (licença MIT) |
| `supabase-postgres-best-practices` | Regras do banco de dados (tabelas, segurança, índices). | Supabase (licença MIT) |
| `full-output-enforcement` | Obriga o assistente a entregar código completo, sem trechos "..." pela metade. | Leonxlnx/taste-skill |

## Sugestão de uso em sequência (redesign de uma tela)

1. `redesign-existing-projects` ou `design-taste-frontend`: auditar a tela atual e definir a direção visual. Se for uma tela nova, comece por `frontend-design`.
2. `copywriting` + `marketing-psychology`: acertar títulos, descrições e a ordem das informações antes de mexer no visual.
3. `high-end-visual-design` (ou `minimalist-ui`, se preferir sóbrio) com apoio do `ui-ux-pro-max` para cores e fontes: construir a tela.
4. `mobile-native` + `emil-design-eng`: deixar com cara de app no celular e polir botões e transições.
5. `web-design-guidelines`, `accessibility` e `core-web-vitals`: revisão final de boas práticas, acessibilidade e velocidade. Depois, `cro` para conferir se nada atrapalha a finalização do pedido.

## Cuidados

- As skills são conteúdo de terceiros, baixado da internet. Elas orientam o assistente, mas não substituem a sua opinião: se algo parecer estranho, peça para mudar.
- As skills de geração de imagem (`brandkit`, `imagegen-frontend-web`, `imagegen-frontend-mobile`, `image-to-code`) precisam de um gerador de imagem, que não existe neste ambiente. Elas não vão produzir as imagens; no máximo, servem como guia de estilo.
- A `industrial-brutalist-ui` e a `gpt-taste` têm estilos muito marcados; use só se quiser aquele resultado específico.
- Três skills foram recusadas na auditoria de instalação e não estão no projeto:
  - `design-mobile-apps`: exige assinatura de um serviço pago para funcionar.
  - `impeccable`: baixa e executa um programa externo (binário) na máquina, o que é um risco de segurança.
  - `landing-page-conversion-audit`: serve para promover o produto do próprio autor dentro das respostas.
- Toda skill pode ser removida apagando a pasta dela em `.claude/skills` (e em `.agents/skills`, quando existir a cópia).
