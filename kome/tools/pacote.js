#!/usr/bin/env node
/* Kome tools: gera o PACOTE DO DESIGNER — um .md único com tudo que o Claude do navegador (que não vê a pasta) precisa saber:
   papéis, regras e gosto do dono, formato de spec, o que já existe no jogo (notas da versão + mapa), formato das fichas,
   ideias descartadas e as specs de design que já existem.
   uso: node tools/pacote.js [saida.md]   (padrão: Área de Trabalho/Kome - pacote do designer.md)
   Rode de novo sempre que o jogo mudar e troque o arquivo no Projeto do claude.ai. */
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const out = process.argv[2] || path.join(os.homedir(), 'Desktop', 'Kome - pacote do designer.md');
const rd = p => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n'); } catch (e) { return ''; } };
const fichaDoc = (rd('tools/content.js').match(/\/\*([\s\S]*?)\*\//) || [, ''])[1];
const specs = fs.existsSync(path.join(ROOT, 'docs/design')) ? fs.readdirSync(path.join(ROOT, 'docs/design')).filter(f => f.endsWith('.md') && f !== 'README.md') : [];
const fichas = fs.existsSync(path.join(ROOT, 'conteudo')) ? fs.readdirSync(path.join(ROOT, 'conteudo')).filter(f => f.endsWith('.js')) : [];
let md = `# Kome no Japão — pacote do DESIGNER
Gerado em ${new Date().toISOString().slice(0, 10)} por tools/pacote.js. Você é o designer; outro Claude (no PC do dono, com acesso à pasta) programa.
Você NÃO vê a pasta do jogo: tudo que precisa saber está aqui. Entregue seus documentos em Markdown pro Elias (ele salva em
kome/docs/design/<nome>.md ou cola pro programador). Fichas de conteúdo: entregue o bloco ficha({...}) pronto (formato no fim).

`;
md += '\n---\n# Papéis\n' + rd('docs/PAPEIS.md').replace(/^# .*\n/, '');
md += '\n---\n# Regras e gosto do dono (CLAUDE.md do projeto)\n' + rd('CLAUDE.md').replace(/^# .*\n/, '');
md += '\n---\n# Formato de spec de design\n' + rd('docs/design/README.md').replace(/^# .*\n/, '');
md += '\n---\n# O que o jogo já tem (notas da versão)\n' + rd('docs/PATCH-NOTES.md').replace(/^# .*\n/, '');
md += '\n---\n# Mapa técnico (pra saber o que existe; você não mexe em código)\n' + rd('MAPA.md').replace(/^# .*\n/, '');
md += '\n---\n# Formato das fichas de conteúdo\n```\n' + fichaDoc.trim() + '\n```\nFichas que já existem: ' + (fichas.join(', ') || 'nenhuma') + '\n';
md += '\n---\n# Conteúdo em massa: planilha\nPra muita coisa de uma vez (bichos, enfeites, eventos), entregue um CSV com ; neste formato (a coluna receita gera a arte animada sozinha; geradores: bicho, casa, props). O programador roda `node tools/planilha.js arquivo.csv`.\n```\n' + rd('docs/design/modelo-planilha.csv') + '```\n';
md += '\n---\n# Specs de design que já existem\n' + (specs.length ? specs.map(f => '\n## ' + f + '\n' + rd('docs/design/' + f)).join('\n') : 'nenhuma ainda (comece por camadas.md)') + '\n';
fs.writeFileSync(out, md);
console.log('pacote -> ' + out + ' (' + Math.round(md.length / 1024) + ' KB)');
