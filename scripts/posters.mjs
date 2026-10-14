// Gera o pôster (capa) de cada vídeo listado no projects.json.
// Tenta capturar um quadro do próprio vídeo usando o Google Chrome instalado
// (o Chromium do Playwright não toca MP4/H.264). Se não der, usa o print do celular.
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function frameFromVideo(file) {
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome' });
  } catch {
    return null;
  }
  try {
    const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
    const tmp = path.join(ROOT, '.tmp');
    await fs.mkdir(tmp, { recursive: true });
    const html = path.join(tmp, 'poster.html');
    await fs.writeFile(html, `<style>html,body{margin:0;background:#000}video{width:720px;height:1280px;object-fit:cover;display:block}</style><video muted playsinline preload="auto" src="${pathToFileURL(file).href}"></video>`);
    await page.goto(pathToFileURL(html).href);
    const ok = await page.evaluate(() => new Promise((res) => {
      const v = document.querySelector('video');
      const t = setTimeout(() => res(false), 15000);
      const seek = () => { v.currentTime = Math.min(1.2, (v.duration || 2) / 3); };
      if (v.readyState >= 2) seek(); else v.addEventListener('loadeddata', seek, { once: true });
      v.addEventListener('seeked', () => { clearTimeout(t); res(true); }, { once: true });
      v.addEventListener('error', () => { clearTimeout(t); res(false); }, { once: true });
    }));
    if (!ok) return null;
    return await page.locator('video').screenshot();
  } finally {
    await browser.close();
  }
}

export async function buildPosters(data) {
  let changed = false;
  for (const p of data.projetos) {
    if (!p.video) continue;
    const file = path.join(ROOT, p.video);
    try { await fs.access(file); } catch { console.warn(`  vídeo não encontrado: ${p.video}`); continue; }
    const out = p.video.replace(/\.[a-z0-9]+$/i, '-poster.webp');
    let img = await frameFromVideo(file);
    if (!img && p.prints?.mobile) img = await fs.readFile(path.join(ROOT, p.prints.mobile.src));
    if (!img) continue;
    await sharp(img).resize({ width: 540, height: 960, fit: 'cover', position: 'top' }).webp({ quality: 78 }).toFile(path.join(ROOT, out));
    p.videoPoster = out;
    changed = true;
    console.log(`✓ Pôster gerado: ${out}`);
  }
  if (changed) await fs.writeFile(path.join(ROOT, 'projects.json'), JSON.stringify(data, null, 2) + '\n');
}
