#!/usr/bin/env node
/* Kome tools: gera PIXXEL.md (na raiz) a partir do próprio código: o cabeçalho de cada engine/*.js e as linhas de
   comentário com assinatura ("// Nome.func(args) -> ...: o que faz"). Rode de novo sempre que mexer na engine:
   node tools/docs.js */
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), ENG = path.join(ROOT, 'engine');
const ORDER = ['core', 'pix', 'shiba', 'fx', 'terrain', 'rig', 'audio', 'nature', 'ui'];
const files = ORDER.concat(fs.readdirSync(ENG).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3)).filter(n => ORDER.indexOf(n) < 0));
let md = `# Pixxel

Engine 2D de navegador no estilo Kome: canvas + HUD em DOM, scripts clássicos, zero dependências, roda de \`file://\`.
Gerado por \`node tools/docs.js\` a partir dos comentários do código (não edite à mão: edite o código e rode de novo).

## Começar um projeto novo

\`\`\`html
<link rel="stylesheet" href="pixxel.css">   <!-- só se usar E.UI -->
<script src="pixxel.js"></script>           <!-- gere com: node tools/build.js -->
<script>
  const E = Pixxel, stage = E.Stage({ width: 960, height: 540 }), input = E.Input(stage), g = stage.g;
  let t = 0;
  E.Loop({ input, update(dt) { t += dt; }, render() { stage.begin(); E.drawShiba(g, 480, 400, 'wag', t, { scale: 3 }); } }).start();
</script>
\`\`\`

Exemplo completo e pequeno: \`demos/koi.html\` (lago de carpas usando só o bundle). Uma demo por módulo em \`demos/\`.

## Estilo (vale pra tudo que for desenhado)
- Contorno \`#3B2818\` (\`E.PAL.line\`), paleta \`E.PAL\`, 3 tons por material (sombra, base, luz).
- Personagens e objetos pequenos em pixel art (\`E.Pix\` / \`E.sprite\`); máquinas grandes vetoriais articuladas (\`E.Draw\` + \`E.Rig\`).
- Nada parado: use \`E.Nature.wind(t, x)\` e \`t\` pra balançar, piscar e respirar.
- Pedido tipo "um alce" / "um carro": monte com \`E.Pix\` (pequeno) ou \`E.Draw\`/\`E.Rig\` (grande), contorno e 3 tons, e
  uma demo em \`demos/\` verificada com \`node tools/shot.js\`.

## Ferramentas
- \`node tools/build.js\` — bundle \`pixxel.js\` + \`pixxel.css\`.
- \`node tools/docs.js\` — este arquivo.
- \`node tools/shot.js <pagina.html> <saida.png> [--eval js] [--size 960x540]\` — screenshot headless.

## Módulos
`;
const sig = /^\s*\/\/\s+((?:E\.|[A-Z][A-Za-z]*\.|[a-z][A-Za-z]*\.)?[A-Za-z_][\w.]*\s*\(.*)$/;
for (const n of files) {
  const p = path.join(ENG, n + '.js'); if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n'), head = (src.match(/\/\*([\s\S]*?)\*\//) || [])[1] || '';
  const desc = head.split('\n').map(l => l.replace(/^\s*[=*]+\s?/, '').replace(/=+\s*$/, '').trim()).filter(l => l && !/^[=-]+$/.test(l)).join(' ');
  const lines = src.split('\n').map(l => (l.match(sig) || [])[1]).filter(Boolean).filter(l => !/^(if|for|while|return|const|let|var)\b/.test(l));
  md += `\n### ${n}.js\n\n${desc}\n`;
  if (lines.length) md += '\n' + lines.map(l => '- `' + l.replace(/`/g, "'").replace(/\s*:\s+/, '` — ').replace(/^([^`]*)$/, '$1`')).join('\n') + '\n';
}
fs.writeFileSync(path.join(ROOT, 'PIXXEL.md'), md);
console.log('PIXXEL.md: ' + md.split('\n').length + ' linhas');
