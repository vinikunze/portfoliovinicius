// Resume os relatórios do Lighthouse (reports/lighthouse/*.report.json) em reports/lighthouse/resumo.md
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'reports/lighthouse');
const files = (await fs.readdir(DIR)).filter((f) => f.endsWith('.report.json')).sort();
const nomes = { performance: 'Desempenho', accessibility: 'Acessibilidade', 'best-practices': 'Boas práticas', seo: 'SEO' };
const lines = ['# Lighthouse', ''];
for (const f of files) {
  const r = JSON.parse(await fs.readFile(path.join(DIR, f), 'utf8'));
  const a = r.audits;
  lines.push(`## ${f.replace('.report.json', '')} (${r.configSettings.formFactor})`, '', `URL: ${r.finalDisplayedUrl || r.finalUrl}`, '');
  lines.push('| Categoria | Nota |', '|---|---|');
  for (const [k, c] of Object.entries(r.categories)) lines.push(`| ${nomes[k] || c.title} | **${Math.round(c.score * 100)}** |`);
  lines.push('', `LCP ${a['largest-contentful-paint']?.displayValue} · FCP ${a['first-contentful-paint']?.displayValue} · TBT ${a['total-blocking-time']?.displayValue} · CLS ${a['cumulative-layout-shift']?.displayValue} · Speed Index ${a['speed-index']?.displayValue}`, '');
  const fails = Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode !== 'informative' && x.scoreDisplayMode !== 'notApplicable' && x.scoreDisplayMode !== 'manual').slice(0, 15);
  if (fails.length) lines.push('Itens abaixo de 90:', '', ...fails.map((x) => `- ${x.title}${x.displayValue ? ` (${x.displayValue})` : ''}`), '');
}
const md = lines.join('\n');
await fs.writeFile(path.join(DIR, 'resumo.md'), md + '\n');
console.log(md);
