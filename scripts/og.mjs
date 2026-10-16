// Gera a imagem de compartilhamento (Open Graph, 1200x630) a partir dos prints dos projetos em destaque.
// Usa o mesmo CSS da página, então os mockups ficam idênticos aos do site.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function buildOg() {
  const data = JSON.parse(await fs.readFile(path.join(ROOT, 'projects.json'), 'utf8'));
  const live = data.projetos.filter((p) => p.url && p.online !== false && !p.ocultar && p.prints);
  const feat = live.filter((p) => p.destaque).concat(live.filter((p) => !p.destaque));
  const [a, b] = feat;
  const img = (pr) => (pr ? `<img src="../${pr.src}" style="width:100%;height:100%;object-fit:cover;object-position:top">` : '<div class="placeholder"></div>');

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="stylesheet" href="../assets/css/style.css">
<style>
  html,body{width:1200px;height:630px;margin:0;overflow:hidden}
  body::after{opacity:.05}
  .og{position:relative;width:1200px;height:630px;display:grid;grid-template-columns:500px 1fr;align-items:center;padding:0 0 0 72px;overflow:hidden}
  .og__glow{position:absolute;inset:-30% -10% auto 20%;height:120%;background:radial-gradient(45% 45% at 60% 50%,rgba(214,178,122,.22),transparent 70%)}
  .og__txt{position:relative}
  .og__logo{width:96px;height:96px;border-radius:50%;box-shadow:0 0 0 1px rgba(214,178,122,.4),0 10px 40px -6px rgba(214,178,122,.5)}
  .og h1{font-family:var(--serif);font-weight:500;font-size:132px;line-height:.9;letter-spacing:-.035em;color:var(--cream);margin-top:30px}
  .og h1 b{color:var(--gold);font-weight:500}
  .og .sl{margin-top:16px;font-size:19px;font-weight:600;letter-spacing:.3em;text-transform:uppercase}
  .og .loc{margin-top:26px;font-size:21px;color:var(--muted)}
  .og__stage{position:relative;height:100%}
  .og__stage .laptop{position:absolute;left:24px;top:118px;width:610px}
  .og__stage .phone{position:absolute;width:162px;left:432px;top:248px}
</style></head><body>
<div class="og">
  <div class="og__glow"></div>
  <div class="og__txt">
    <img class="og__logo" src="../assets/brand/logo-384.webp">
    <h1>Vinicius<b>.</b></h1>
    <p class="sl gold-text">Sites Premium &amp; Web IA</p>
    <p class="loc">Sinop, Sorriso e região · Mato Grosso</p>
  </div>
  <div class="og__stage">
    <div class="laptop"><div class="laptop__lid"><div class="laptop__screen">${img(a?.prints?.desktop)}</div></div><div class="laptop__base"></div></div>
    <div class="phone"><div class="phone__screen"><span class="phone__island"></span>${img((b || a)?.prints?.mobile)}</div></div>
  </div>
</div></body></html>`;

  const tmp = path.join(ROOT, '.tmp');
  await fs.mkdir(tmp, { recursive: true });
  const file = path.join(tmp, 'og.html');
  await fs.writeFile(file, html);

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const png = await page.screenshot({ type: 'png' });
  await browser.close();

  await fs.mkdir(path.join(ROOT, 'assets/og'), { recursive: true });
  await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(path.join(ROOT, 'assets/og/og-image.jpg'));
  console.log(`✓ Imagem Open Graph gerada (${esc(a?.nome || 'sem prints ainda')})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildOg().catch((e) => { console.error(e); process.exit(1); });
}
