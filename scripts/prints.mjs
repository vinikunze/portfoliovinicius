// npm run prints
//
// Abre cada site do projects.json, confirma se está no ar e tira os prints:
//   desktop 1440x900 (primeira dobra), celular 390x844 (primeira dobra e página inteira).
// Converte para WebP em vários tamanhos, grava o resultado no projects.json
// e gera os ícones e a imagem de compartilhamento (Open Graph).
//
// Opções:
//   npm run prints -- --only=egao-sushi,betao-pneus   só esses projetos
//   npm run prints -- --skip-og                        não gera a imagem Open Graph
import { chromium, devices } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIcons } from './icons.mjs';
import { buildOg } from './og.mjs';
import { buildPosters } from './posters.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'projects.json');
const OUT = path.join(ROOT, 'assets/prints');
const TMP = path.join(ROOT, '.tmp/raw');
const REPORT = path.join(ROOT, 'reports/sites.json');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
// Só para testes: troca URLs por outras (ex.: cópias locais). Formato JSON {"url": "outra-url"}
const urlMap = process.env.PRINTS_URL_MAP ? JSON.parse(process.env.PRINTS_URL_MAP) : {};
const target = (u) => urlMap[u] || u;
const only = typeof args.only === 'string' ? args.only.split(',').map((s) => s.trim()) : null;

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const MOBILE = { ...devices['iPhone 13'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 };
const FULL_MAX_CSS_HEIGHT = 6000; // corta páginas muito longas (limite do WebP e memória do celular)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function launch() {
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  try {
    return await chromium.launch({ executablePath, args: ['--hide-scrollbars', '--force-color-profile=srgb'] });
  } catch (e) {
    if (/Executable doesn't exist/i.test(e.message)) {
      console.error('\nO navegador do Playwright não está instalado. Rode uma vez:\n  npx playwright install chromium\n');
      process.exit(1);
    }
    throw e;
  }
}

// Fecha banners de cookies/LGPD e popups comuns
async function dismissOverlays(page) {
  await page.evaluate(() => {
    const words = /^(aceitar|aceito|aceitar todos|aceitar tudo|concordo|entendi|ok|fechar|accept|accept all|agree|got it|allow all|permitir todos|continuar)$/i;
    const ctx = /cookie|lgpd|privacidade|consent|termos/i;
    const btns = [...document.querySelectorAll('button, a, [role="button"], input[type="button"], input[type="submit"]')];
    for (const b of btns) {
      const t = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim();
      if (!t || t.length > 40 || !words.test(t)) continue;
      let el = b, hit = false;
      for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
        if (ctx.test((el.id || '') + ' ' + (el.className?.baseVal ?? el.className ?? '') + ' ' + (el.innerText || '').slice(0, 400))) { hit = true; break; }
      }
      if (hit) { try { b.click(); } catch {} }
    }
  }).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
}

// Esconde botões flutuantes (WhatsApp, chat, voltar ao topo) e caixas de cookies que sobraram
async function hideFloaters(page) {
  await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const ctx = /cookie|lgpd|consent|privacidade/i;
    const hide = (el) => el.style.setProperty('visibility', 'hidden', 'important');
    for (const el of document.querySelectorAll('body *')) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      if (cs.position === 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const small = r.width <= 260 && r.height <= 260;
      const nearBottom = r.bottom > vh - 300 && r.top > vh * 0.35;
      const nearSide = r.left > vw * 0.55 || r.right < vw * 0.45;
      const text = (el.innerText || '').slice(0, 600) + ' ' + el.id + ' ' + (el.className?.baseVal ?? el.className ?? '');
      if (small && nearBottom && nearSide) hide(el);
      else if (ctx.test(text) && r.top > vh * 0.3) hide(el); // barra de cookies
      else if ((el.getAttribute('role') === 'dialog' || el.getAttribute('aria-modal') === 'true') && r.width * r.height > vw * vh * 0.3) hide(el);
    }
    for (const f of document.querySelectorAll('iframe')) {
      const s = (f.src || '') + (f.title || '') + (f.id || '');
      if (/tawk|zendesk|intercom|crisp|chat|jivo|whatsapp/i.test(s)) hide(f);
    }
    document.documentElement.style.setProperty('scrollbar-width', 'none', 'important');
  }).catch(() => {});
}

// Rola a página até o fim para carregar imagens lazy e disparar animações de entrada
async function warmUp(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((r) => setTimeout(r, ms));
    const step = Math.max(300, Math.round(innerHeight * 0.7));
    let y = 0, guard = 0;
    while (y < document.documentElement.scrollHeight && guard++ < 80) {
      y += step; scrollTo(0, y); await delay(140);
    }
    await delay(500);
    scrollTo(0, 0);
  }).catch(() => {});
  await page.evaluate(async () => {
    const wait = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
    await wait(document.fonts?.ready ?? Promise.resolve(), 5000);
    const imgs = [...document.images].filter((i) => !i.complete);
    await wait(Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))), 8000);
  }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
}

async function open(browser, opts, url) {
  const context = await browser.newContext({ ...opts, locale: 'pt-BR', timezoneId: 'America/Cuiaba', ignoreHTTPSErrors: false });
  const page = await context.newPage();
  let resp, error = '';
  try {
    resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  } catch (e) {
    error = e.message.split('\n')[0];
  }
  const status = resp ? resp.status() : 0;
  const ok = !error && status > 0 && status < 400;
  if (ok) {
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
    await sleep(800);
    await dismissOverlays(page);
    await warmUp(page);
    await dismissOverlays(page);
    await hideFloaters(page);
    await sleep(1800); // animações de entrada da primeira dobra
  }
  return { context, page, ok, status, error, finalUrl: page.url() };
}

async function siteInfo(page) {
  return page.evaluate(() => {
    const txt = document.body?.innerText || '';
    const cities = ['Sinop', 'Sorriso', 'Lucas do Rio Verde', 'Nova Mutum', 'Cuiabá', 'Cláudia', 'Vera', 'Santa Carmem', 'Feliz Natal', 'Colíder', 'Alta Floresta', 'Itaúba', 'Matupá', 'Guarantã do Norte', 'Primavera do Leste', 'Rondonópolis'];
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      headings: [...document.querySelectorAll('h1,h2,h3')].map((h) => h.innerText.trim()).filter(Boolean).slice(0, 30),
      cidades: cities.filter((c) => txt.includes(c)),
      parked: /domain (is )?for sale|domínio (está )?à venda|parked|this domain|hostgator.*(em construção|coming soon)|site em construção|index of \//i.test(txt.slice(0, 3000)),
      textLength: txt.length,
    };
  }).catch(() => ({}));
}

async function toWebp(input, outBase, widths, { maxHeight } = {}) {
  const meta = await sharp(input, { limitInputPixels: false }).metadata();
  const results = [];
  for (const w of widths) {
    const width = Math.min(w, meta.width);
    let pipe = sharp(input, { limitInputPixels: false }).resize({ width, withoutEnlargement: true });
    const scaledH = Math.round(meta.height * (width / meta.width));
    let height = scaledH;
    if (maxHeight && scaledH > maxHeight) {
      height = maxHeight;
      pipe = sharp(await pipe.toBuffer(), { limitInputPixels: false }).extract({ left: 0, top: 0, width, height });
    }
    const file = `${outBase}-${width}.webp`;
    await pipe.webp({ quality: 80, effort: 5 }).toFile(file);
    results.push({ file, width, height });
  }
  return results;
}

function describe(list) {
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
  const largest = list[list.length - 1];
  return {
    src: rel(largest.file),
    srcset: list.map((r) => `${rel(r.file)} ${r.width}w`).join(', '),
    w: largest.width,
    h: largest.height,
  };
}

async function captureProject(browser, p) {
  const dir = path.join(OUT, p.slug);
  await fs.mkdir(dir, { recursive: true });
  await fs.mkdir(TMP, { recursive: true });
  const info = {};

  // Desktop
  const d = await open(browser, DESKTOP, target(p.url));
  info.site = { status: d.status, error: d.error, finalUrl: d.finalUrl, ...(d.ok ? await siteInfo(d.page) : {}) };
  if (!d.ok || info.site.parked) {
    await d.context.close();
    return { online: false, motivo: d.error || (info.site.parked ? 'Página de domínio estacionado ou em construção' : `HTTP ${d.status}`), info };
  }
  const rawDesk = path.join(TMP, `${p.slug}-desktop.png`);
  await d.page.screenshot({ path: rawDesk, animations: 'allow' });
  await d.context.close();

  // Celular (pode usar outra URL, ex.: sistema de pedidos)
  const mUrl = p.urlCelular || p.url;
  const m = await open(browser, MOBILE, target(mUrl));
  if (!m.ok) {
    await m.context.close();
    return { online: false, motivo: `Versão celular (${mUrl}): ${m.error || 'HTTP ' + m.status}`, info };
  }
  if (p.urlCelular) info.celular = { status: m.status, ...(await siteInfo(m.page)) };
  const rawMob = path.join(TMP, `${p.slug}-mobile.png`);
  const rawFull = path.join(TMP, `${p.slug}-mobile-full.png`);
  await m.page.screenshot({ path: rawMob });
  const docH = await m.page.evaluate(() => document.documentElement.scrollHeight).catch(() => 844);
  if (docH > FULL_MAX_CSS_HEIGHT) {
    await m.page.screenshot({ path: rawFull, fullPage: true, clip: { x: 0, y: 0, width: 390, height: FULL_MAX_CSS_HEIGHT } });
  } else {
    await m.page.screenshot({ path: rawFull, fullPage: true });
  }
  await m.context.close();

  const desktop = describe(await toWebp(rawDesk, path.join(dir, 'desktop'), [640, 1024, 1600]));
  const mobile = describe(await toWebp(rawMob, path.join(dir, 'mobile'), [390, 780]));
  const mobileFull = describe(await toWebp(rawFull, path.join(dir, 'mobile-full'), [390, 600], { maxHeight: 16000 }));
  return {
    online: true,
    info,
    prints: { atualizadoEm: new Date().toISOString(), desktop, mobile, mobileFull },
  };
}

async function main() {
  const data = JSON.parse(await fs.readFile(DATA, 'utf8'));
  const report = await fs.readFile(REPORT, 'utf8').then(JSON.parse).catch(() => ({}));
  const browser = await launch();
  const todo = data.projetos.filter((p) => p.url && (!only || only.includes(p.slug)));
  log(`Capturando ${todo.length} site(s)...\n`);

  for (const p of todo) {
    process.stdout.write(`• ${p.nome.padEnd(28)} `);
    let r;
    try {
      r = await captureProject(browser, p);
    } catch (e) {
      r = { online: false, motivo: e.message.split('\n')[0], info: {} };
    }
    p.online = r.online;
    p.verificadoEm = new Date().toISOString();
    if (r.online) {
      delete p.motivoOffline;
      p.prints = r.prints;
      log('no ar ✓');
    } else {
      p.motivoOffline = r.motivo;
      log(`FORA DO AR: ${r.motivo}`);
    }
    report[p.slug] = { nome: p.nome, url: p.url, online: r.online, motivo: r.motivo || '', verificadoEm: p.verificadoEm, ...r.info };
  }
  await browser.close();

  for (const p of data.projetos) {
    if (!p.url) { p.online = false; p.motivoOffline = p.pendente || 'URL não informada'; }
  }

  await fs.writeFile(DATA, JSON.stringify(data, null, 2) + '\n');
  await fs.mkdir(path.dirname(REPORT), { recursive: true });
  await fs.writeFile(REPORT, JSON.stringify(report, null, 2) + '\n');
  await fs.rm(TMP, { recursive: true, force: true });

  await buildIcons();
  await buildPosters(data).catch((e) => console.warn('Pôsteres dos vídeos:', e.message));
  if (!args['skip-og']) await buildOg().catch((e) => console.warn('Imagem Open Graph:', e.message));

  const on = data.projetos.filter((p) => p.online);
  const off = data.projetos.filter((p) => p.online === false);
  log(`\n${on.length} no ar, ${off.length} fora da página:`);
  for (const p of off) log(`  - ${p.nome}: ${p.motivoOffline}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
