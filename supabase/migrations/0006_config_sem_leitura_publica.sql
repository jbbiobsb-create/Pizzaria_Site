-- Pen test: a política "config: leitura publica" deixava o anon ler TODAS as colunas de config
-- pela API REST, incluindo chave_pix (vazaria quando cadastrada), lat/lng e horários brutos.
-- O site público não lê a tabela direto — usa a função cardapio() (security definer, já sem chave_pix).
-- A equipe continua lendo/escrevendo via política "config: equipe" (is_equipe()).
drop policy if exists "config: leitura publica" on public.config;
