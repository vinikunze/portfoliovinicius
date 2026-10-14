// npm run verify -- https://endereco-do-site/
//
// Abre a página em 390px (celular) e 1440px (desktop), tira prints, procura rolagem horizontal,
// elementos cortados, imagens quebradas, travessões no texto e testa todos os links e botões de WhatsApp.
// Salva tudo em reports/verificacao/.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'reports/verificacao');
const base = (process.argv[2] || 'http://localhost:8080/').replace(/\/?$/, '/');
const pageUrl = `${base}?utm_source=instagram&utm_medium=bio`;
const WA_NUMBER = '5566996369065';
const WA_MSG = 'Oi Vinicius! Vi seu portfólio e quero um site pro meu negócio.';

// Só para testes locais sem internet: {"https://cdn...": "/caminho/local.js"}
const cdnMap = process.env.CDN_MAP ? JSON.parse(process.env.CDN_MAP) : {};

const problems = [];
const warn = (m) => { problems.push(m); console.log('  ✗ ' + m); };
const ok = (m) => console.log('  ✓ ' + m);

async function routeCdn(context) {
  for (const [url, file] of Object.entries(cdnMap)) {
    await context.route(url, async (route) => route.fulfill({ path: file, contentType: 'text/javascript' }));
  }
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const d = (ms) => new Promise((r) => setTimeout(r, ms));
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(innerHeight * 0.6)) {
      window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : scrollTo(0, y);
      await d(160);
    }
    await d(700);
  });
}

async function checkViewport(browser, name, viewport, opts = {}) {
  console.log(`\n${name} (${viewport.width}x${viewport.height})`);
  const context = await browser.newContext({ viewport, deviceScaleFactor: opts.dpr || 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, locale: 'pt-BR', reducedMotion: opts.reducedMotion || 'no-preference' });
  await routeCdn(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const failed = [];
  page.on('requestfailed', (r) => { if (!/googletagmanager|google-analytics/.test(r.url())) failed.push(`${r.url()} (${r.failure()?.errorText})`); });
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base)) failed.push(`${r.url()} (HTTP ${r.status()})`); });

  await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1500);
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  await page.screenshot({ path: path.join(OUT, `${slug}-primeira-dobra.png`) });

  // primeira dobra: o essencial do link da bio precisa estar visível
  const fold = await page.evaluate(() => {
    const vis = (sel) => { const el = document.querySelector(sel); if (!el) return false; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.width > 0; };
    return { logo: vis('.badge__logo'), nome: vis('#titulo'), slogan: vis('.hero__slogan'), whatsapp: vis('[data-hero-cta]'), trabalhos: vis('.hero__ctas a[href="#trabalhos"]') };
  });
  for (const [k, v] of Object.entries(fold)) (v ? ok : warn)(`${name}: ${k} visível sem rolar`);

  await scrollThrough(page);
  await page.evaluate(() => { window.__lenis ? window.__lenis.scrollTo(0, { immediate: true }) : scrollTo(0, 0); });
  await page.waitForTimeout(400);

  const layout = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const sw = document.documentElement.scrollWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.right > vw + 1 || r.left < -1) {
        // ignora o que está dentro de áreas com recorte ou rolagem horizontal intencional
        let p = el.parentElement, clipped = false;
        while (p && p !== document.body) {
          const cs = getComputedStyle(p);
          if (/(hidden|clip|auto|scroll)/.test(cs.overflowX)) { clipped = true; break; }
          p = p.parentElement;
        }
        if (!clipped && getComputedStyle(el).position !== 'fixed') offenders.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (${Math.round(r.left)}..${Math.round(r.right)})`);
      }
    }
    const brokenImgs = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.loading !== 'lazy').map((i) => i.src);
    const text = document.body.innerText + ' ' + document.title + ' ' + (document.querySelector('meta[name="description"]')?.content || '');
    const smallTargets = [...document.querySelectorAll('a[href], button')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && (r.height < 24 || r.width < 24) && !el.closest('[aria-hidden="true"]');
    }).map((el) => (el.innerText || el.getAttribute('aria-label') || el.className).trim().slice(0, 40));
    return { vw, sw, offenders: offenders.slice(0, 15), brokenImgs, dash: /—/.test(text), smallTargets };
  });
  (layout.sw <= layout.vw ? ok : warn)(`${name}: sem rolagem horizontal (largura do conteúdo ${layout.sw}px, tela ${layout.vw}px)`);
  if (layout.offenders.length) warn(`${name}: elementos saindo da tela: ${layout.offenders.join(', ')}`); else ok(`${name}: nenhum elemento cortado na lateral`);
  if (layout.brokenImgs.length) warn(`${name}: imagens quebradas: ${layout.brokenImgs.join(', ')}`); else ok(`${name}: nenhuma imagem quebrada`);
  (layout.dash ? warn : ok)(`${name}: ${layout.dash ? 'encontrado travessão (—) no texto' : 'nenhum travessão no texto'}`);
  if (layout.smallTargets.length) warn(`${name}: alvos de toque pequenos: ${layout.smallTargets.join(' | ')}`);
  if (errors.length) warn(`${name}: erros no console: ${errors.join(' | ')}`); else ok(`${name}: console sem erros`);
  if (failed.length) warn(`${name}: requisições com falha: ${failed.join(' | ')}`); else ok(`${name}: todas as requisições carregaram`);

  await page.screenshot({ path: path.join(OUT, `${slug}-pagina-inteira.jpg`), fullPage: true, type: 'jpeg', quality: 70 });

  // links
  const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => ({
    href: a.href, raw: a.getAttribute('href'), text: (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 60),
    target: a.target, rel: a.rel, track: a.dataset.track || '', projeto: a.dataset.projeto || '', hidden: !!a.closest('[hidden]'),
    anchorOk: a.getAttribute('href').startsWith('#') ? !!document.getElementById(a.getAttribute('href').slice(1)) : null,
  })));

  // eventos do dataLayer ao clicar
  const events = await page.evaluate(() => {
    const before = window.dataLayer.length;
    const prevent = (e) => e.preventDefault();
    document.addEventListener('click', prevent, true);
    const sample = ['[data-hero-cta]', '[data-track="clique_ver_site"]', '[data-track="clique_instagram"]:not([hidden])'];
    for (const s of sample) document.querySelector(s)?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    document.removeEventListener('click', prevent, true);
    return window.dataLayer.slice(before);
  });
  await context.close();
  return { links, events, fold, layout };
}

async function checkUrl(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const r = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (verificacao do portfolio)' } });
    clearTimeout(t);
    return r.status;
  } catch (e) {
    return `erro: ${e.cause?.code || e.message}`;
  }
}

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  console.log(`Verificando ${pageUrl}`);

  const mobile = await checkViewport(browser, 'Celular', { width: 390, height: 844 }, { mobile: true, dpr: 2 });
  const desktop = await checkViewport(browser, 'Desktop', { width: 1440, height: 900 });
  const small = await checkViewport(browser, 'Celular pequeno', { width: 360, height: 640 }, { mobile: true, dpr: 2 });
  const reduced = await checkViewport(browser, 'Sem animacao', { width: 390, height: 844 }, { mobile: true, reducedMotion: 'reduce' });
  await browser.close();

  console.log('\nLinks e botões');
  const all = [...mobile.links, ...desktop.links];
  const uniq = new Map();
  for (const l of all) if (!uniq.has(l.href)) uniq.set(l.href, l);
  const rows = [];
  for (const l of uniq.values()) {
    if (l.raw.startsWith('#')) {
      if (!l.anchorOk) warn(`âncora sem destino: ${l.raw}`);
      rows.push({ ...l, status: l.anchorOk ? 'âncora ok' : 'âncora inexistente' });
      continue;
    }
    const u = new URL(l.href);
    const external = !l.href.startsWith(base);
    if (external && (l.target !== '_blank' || !/noopener/.test(l.rel))) warn(`link externo sem nova aba/noopener: ${l.href}`);
    if (u.host === 'wa.me') {
      const num = u.pathname.replace('/', '');
      const msg = u.searchParams.get('text');
      if (num !== WA_NUMBER) warn(`WhatsApp com número errado: ${l.href}`);
      if (msg !== null && !/^Oi Vinicius!/.test(msg)) warn(`WhatsApp com mensagem inesperada: ${msg}`);
      if (!l.track) warn(`WhatsApp sem evento de medição: ${l.text}`);
    }
    if (l.track === 'clique_ver_site' && !l.projeto) warn(`"Ver site" sem nome do projeto: ${l.href}`);
    if (l.hidden) { rows.push({ ...l, status: 'escondido (sem configuração)' }); continue; }
    const status = await checkUrl(l.href);
    if (typeof status !== 'number' || status >= 400) {
      // instagram e wa.me costumam bloquear robôs; registra mas não reprova por 403/429
      if (!(/instagram\.com|wa\.me/.test(l.href) && [403, 429].includes(status))) warn(`link com problema (${status}): ${l.href}`);
    }
    rows.push({ ...l, status });
  }
  const waCount = rows.filter((r) => r.href.includes('wa.me')).length;
  ok(`${rows.length} links testados, ${waCount} de WhatsApp`);

  const heroWa = mobile.links.find((l) => l.track === 'clique_whatsapp' && l.href.includes('wa.me'));
  if (heroWa) {
    const msg = new URL(heroWa.href).searchParams.get('text');
    (msg === WA_MSG ? ok : warn)(`mensagem pronta do WhatsApp: "${msg}"`);
  }
  const evNames = mobile.events.map((e) => e.event);
  (evNames.includes('clique_whatsapp') ? ok : warn)('evento clique_whatsapp enviado ao dataLayer');
  (evNames.includes('clique_ver_site') && mobile.events.find((e) => e.event === 'clique_ver_site')?.projeto ? ok : warn)('evento clique_ver_site com nome do projeto');
  (mobile.events.every((e) => e.utm_source === 'instagram') ? ok : warn)('eventos carregam utm_source=instagram');

  const report = { url: pageUrl, data: new Date().toISOString(), problemas: problems, links: rows, eventos: mobile.events, celular: mobile.layout, desktop: desktop.layout, celularPequeno: small.layout, semAnimacao: reduced.layout };
  await fs.writeFile(path.join(OUT, 'verificacao.json'), JSON.stringify(report, null, 2));

  const md = [`# Verificação do portfólio`, '', `Página: ${pageUrl}`, `Data: ${report.data}`, '',
    problems.length ? `## ${problems.length} problema(s)\n\n${problems.map((p) => `- ${p}`).join('\n')}` : '## Nenhum problema encontrado',
    '', '## Links testados', '', '| Texto | Destino | Status |', '|---|---|---|',
    ...rows.map((r) => `| ${r.text.replace(/\|/g, '/') || '(sem texto)'} | ${r.href.replace(/\|/g, '%7C')} | ${r.status} |`)].join('\n');
  await fs.writeFile(path.join(OUT, 'verificacao.md'), md + '\n');
  console.log(`\n${problems.length ? problems.length + ' problema(s)' : 'Tudo certo'}. Relatório em reports/verificacao/`);
  process.exitCode = problems.length ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exit(1); });
