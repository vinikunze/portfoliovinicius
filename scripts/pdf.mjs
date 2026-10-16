// npm run pdf -- --projetos=egao-sushi,dra-gabriela-veigantt,ventures-auto-center
//
// Gera um portfólio em PDF (A4) para mandar para clientes, com a mesma identidade do site
// e os prints reais dos projetos. Sem --projetos, usa todos os projetos no ar (destaques primeiro).
// Saída: materiais/portfolio-vinicius.pdf  (mude com --saida=materiais/outro-nome.pdf)
import { chromium } from 'playwright';
import QRCode from 'qrcode';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const SAIDA = path.join(ROOT, typeof args.saida === 'string' ? args.saida : 'materiais/portfolio-vinicius.pdf');

const WA = '5566996369065';
const WA_MSG = 'Oi Vinicius! Vi seu portfólio e quero um site pro meu negócio.';
const SITE = 'https://vinikunze.github.io/portfoliovinicius/';

const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const dominio = (u) => { try { const x = new URL(u); return x.host.replace(/^www\./, '') + x.pathname.replace(/\/$/, ''); } catch { return u; } };
const qr = (text) => QRCode.toString(text, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0a0908', light: '#00000000' } });
const IMG_DIR = path.join(ROOT, '.tmp/pdf-img');
// converte o print para JPEG (bem mais leve dentro do PDF); crop = fração da altura onde começa o recorte do celular
async function jpg(pr, { width, crop } = {}) {
  await fs.mkdir(IMG_DIR, { recursive: true });
  const name = `${pr.src.replace(/[^a-z0-9]+/gi, '-')}-${width}-${crop ?? 'full'}.jpg`;
  const out = path.join(IMG_DIR, name);
  let pipe = sharp(path.join(ROOT, pr.src), { limitInputPixels: false });
  if (crop !== undefined) {
    const meta = await pipe.metadata();
    const h = Math.round(meta.width * 844 / 390);
    const top = Math.min(Math.round(meta.height * crop), Math.max(0, meta.height - h));
    pipe = pipe.extract({ left: 0, top, width: meta.width, height: Math.min(h, meta.height) });
  }
  await pipe.resize({ width, withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  return `../.tmp/pdf-img/${name}`;
}
const img = (src, extra = '') => `<img src="${esc(src)}" alt="" ${extra}>`;

const ICONS = {
  site: '<rect x="3" y="4" width="18" height="16" rx="2.2"/><path d="M3 8.8h18M6.6 6.4h.01M9.2 6.4h.01M7 12.5h6M7 15.8h4"/><rect x="15" y="11.6" width="3" height="5" rx=".6"/>',
  lp: '<circle cx="12" cy="12" r="8.6"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M18.5 5.5 14 10"/>',
  pedidos: '<path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8V6.6a3 3 0 0 1 6 0V8"/><path d="m9.4 13.6 2 2 3.6-3.6"/>',
  ads: '<path d="M4 19.5h16"/><path d="m5.5 15.5 4-4 3 3 5.5-6.5"/><path d="M14.5 8h3.5v3.5"/>',
  ia: '<path d="m12 3 1.8 4.9 5.2 1.8-5.2 1.8L12 16.4l-1.8-4.9L5 9.7l5.2-1.8L12 3Z"/><path d="m18.6 15 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"/>',
  check: '<circle cx="12" cy="12" r="9.2" opacity=".45"/><path d="m8 12.4 2.7 2.7L16.2 9.4"/>',
};
const ico = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;

const mes = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date());

async function laptop(p) {
  return `<div class="laptop"><div class="laptop__lid"><div class="laptop__screen">${img(await jpg(p.prints.desktop, { width: 1500 }))}</div></div><div class="laptop__base"></div></div>`;
}
async function phone(pr, crop = 0) {
  return `<div class="phone"><div class="phone__screen"><span class="phone__island"></span>${img(await jpg(pr, { width: 480, crop }), 'style="height:100%;object-fit:cover;object-position:top"')}</div></div>`;
}

async function paginaProjeto(p, i, total) {
  const links = [{ rotulo: 'Site no ar', url: p.url }, ...(p.linksExtras || []).map((l) => ({ rotulo: l.rotulo.replace(/^Ver /, ''), url: l.url }))];
  const qrs = await Promise.all(links.map(async (l) => `
      <div class="qr">
        <div class="qr__code">${await qr(l.url)}</div>
        <div><b>${esc(l.rotulo.charAt(0).toUpperCase() + l.rotulo.slice(1))}</b><a href="${esc(l.url)}">${esc(dominio(l.url))}</a></div>
      </div>`));
  const rotuloCel = p.urlCelular ? `${p.rotuloCelular || 'Versão celular'} no celular` : 'Versão para celular';
  return `
  <section class="page proj">
    <header class="proj__head">
      <p class="meta"><span class="num">${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>${[p.segmento, p.cidade].filter(Boolean).map(esc).join('<i></i>')}</p>
      <h2>${esc(p.nome)}</h2>
      <p class="tipo">${esc(p.tipo || '')}</p>
    </header>
    <div class="proj__laptop">${await laptop(p)}</div>
    <div class="proj__body">
      <div class="proj__phones">
        <figure>${await phone(p.prints.mobileFull, 0)}<figcaption>${esc(rotuloCel)}</figcaption></figure>
        <figure>${await phone(p.prints.mobileFull, 0.3)}<figcaption>Rolando a página</figcaption></figure>
      </div>
      <div class="proj__info">
        <p class="label">O que o site tem</p>
        <ul class="list">${(p.destaques || []).map((d) => `<li>${ico('check')}<span>${esc(d)}</span></li>`).join('')}</ul>
        <p class="label" style="margin-top:22px">Veja funcionando</p>
        <div class="qrs${qrs.length > 1 ? ' qrs--multi' : ''}">${qrs.join('')}</div>
      </div>
    </div>
    <footer class="foot"><span>Vinicius<b>.</b> Sites Premium &amp; Web IA</span><span>(66) 99636-9065</span></footer>
  </section>`;
}

async function main() {
  const data = JSON.parse(await fs.readFile(path.join(ROOT, 'projects.json'), 'utf8'));
  let lista;
  const faltando = [];
  if (typeof args.projetos === 'string') {
    lista = [];
    for (const slug of args.projetos.split(',').map((s) => s.trim())) {
      const p = data.projetos.find((x) => x.slug === slug);
      if (!p) { faltando.push(`${slug}: não existe no projects.json`); continue; }
      if (!p.url || !p.prints) { faltando.push(`${p.nome}: ${p.url ? 'sem prints (rode npm run prints)' : 'sem URL no projects.json'}`); continue; }
      lista.push(p);
    }
  } else {
    const live = data.projetos.filter((p) => p.url && p.online !== false && !p.ocultar && p.prints);
    lista = [...live.filter((p) => p.destaque), ...live.filter((p) => !p.destaque)];
  }
  if (!lista.length) throw new Error('Nenhum projeto com prints para colocar no PDF.');

  const capa = lista.find((p) => p.destaque) || lista[0];
  const capaLaptop = await laptop(capa);
  const capaPhone = await phone(capa.prints.mobile);
  const qrWa = await qr(`https://wa.me/${WA}?text=${encodeURIComponent(WA_MSG)}`);
  const qrSite = await qr(SITE);
  const projetos = [];
  for (let i = 0; i < lista.length; i++) projetos.push(await paginaProjeto(lista[i], i, lista.length));

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Portfólio Vinicius. Sites Premium &amp; Web IA</title>
<link rel="stylesheet" href="../assets/css/style.css">
<style>
  @page { size: A4; margin: 0; }
  html, body { background: var(--bg); }
  body { margin: 0; min-height: 0; }
  body::after { display: none; }
  .page { position: relative; width: 210mm; height: 297mm; overflow: hidden; page-break-after: always; break-after: page; padding: 16mm 15mm 14mm; display: flex; flex-direction: column; background: var(--bg); }
  .page:last-child { page-break-after: auto; break-after: auto; }
  .glow { position: absolute; pointer-events: none; border-radius: 50%; background: radial-gradient(closest-side, rgba(214,178,122,.2), transparent); }
  .eyebrow::before { content: none; }
  .label { font-size: 8.5pt; font-weight: 600; letter-spacing: .2em; text-transform: uppercase; color: var(--gold); }
  .foot { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--line); display: flex; justify-content: space-between; font-size: 8pt; color: var(--muted-2); }
  .foot b { color: var(--gold); font-weight: 500; }
  .serif { font-family: var(--serif); }

  /* capa */
  .cover { padding-top: 22mm; }
  .cover__logo { width: 92px; height: 92px; border-radius: 50%; box-shadow: 0 0 0 1px var(--line-strong), 0 10px 40px -6px rgba(214,178,122,.5); }
  .cover h1 { margin-top: 26px; font-family: var(--serif); font-weight: 500; font-size: 92pt; line-height: .88; letter-spacing: -.035em; color: var(--cream); }
  .cover h1 b { color: var(--gold); font-weight: 500; }
  .cover .slogan { margin-top: 14px; font-size: 11pt; font-weight: 600; letter-spacing: .32em; text-transform: uppercase; }
  .cover .pitch { margin-top: 22px; max-width: 120mm; font-size: 14pt; line-height: 1.5; color: var(--muted); }
  .cover .pitch strong { color: var(--cream); font-weight: 500; }
  .cover__tag { display: inline-flex; align-items: center; gap: 10px; padding: 6px 14px; border: 1px solid var(--line-strong); border-radius: 999px; font-size: 8.5pt; letter-spacing: .2em; text-transform: uppercase; color: var(--gold-light); align-self: flex-start; }
  .cover__stage { position: relative; height: 112mm; margin-top: auto; margin-bottom: 10mm; }
  .cover__stage .laptop { position: absolute; left: 6%; top: 0; width: 82%; }
  .cover__stage .phone { position: absolute; right: 0; bottom: -2mm; width: 22%; }
  .cover__foot { display: flex; justify-content: space-between; align-items: flex-end; font-size: 9pt; color: var(--muted); border-top: 1px solid var(--line); padding-top: 12px; }
  .cover__foot b { display: block; color: var(--cream); font-weight: 600; font-size: 10pt; margin-bottom: 2px; }

  /* o que fazemos */
  .ttl { font-family: var(--serif); font-size: 34pt; line-height: .98; letter-spacing: -.02em; color: var(--cream); margin-top: 10px; }
  .ttl em { font-style: italic; color: var(--gold); }
  .intro { margin-top: 10px; font-size: 10.5pt; color: var(--muted); max-width: 150mm; line-height: 1.55; }
  .svcs { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .svc { padding: 13px 15px 12px; gap: 6px; border-radius: 14px; }
  .svc h3 { font-size: 16pt; margin-top: 0; }
  .svc p { font-size: 9pt; line-height: 1.45; }
  .svc__ico { width: 40px; height: 40px; border-radius: 12px; }
  .svc__ico svg { width: 20px; height: 20px; }
  .svc .ex { font-size: 8.2pt; color: var(--gold-light); }
  .svc .ex a { color: var(--gold-light); text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 2px; }
  .ia { margin-top: 10px; display: flex; gap: 12px; align-items: center; padding: 12px 16px; border: 1px dashed var(--line-strong); border-radius: 14px; font-size: 9.4pt; color: var(--muted); }
  .ia svg { width: 22px; height: 22px; color: var(--gold); flex: none; }
  .ia b { color: var(--cream); font-weight: 600; }
  .steps2 { margin-top: 14px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; position: relative; }
  .steps2::before { content: ""; position: absolute; left: 0; right: 0; top: 19px; height: 1px; background: linear-gradient(90deg, var(--gold), var(--line)); }
  .steps2 li { position: relative; }
  .steps2 .n { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--line-strong); background: var(--bg); font-family: var(--serif); font-style: italic; font-size: 13pt; color: var(--gold-light); }
  .steps2 h4 { margin: 10px 0 4px; font-family: var(--serif); font-weight: 500; font-size: 15pt; color: var(--cream); }
  .steps2 p { font-size: 8.8pt; line-height: 1.45; color: var(--muted); }
  .whys { margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
  .whys li { display: flex; gap: 10px; align-items: flex-start; font-size: 9.6pt; color: var(--text); padding: 6px 0; border-bottom: 1px solid var(--line); }
  .whys svg { width: 17px; height: 17px; color: var(--gold); flex: none; margin-top: 1px; }

  /* projeto */
  .proj__head .meta { display: flex; align-items: center; gap: 10px; font-size: 8.5pt; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--gold); }
  .proj__head .meta i { width: 4px; height: 4px; border-radius: 50%; background: var(--line-strong); }
  .proj__head .num { font-family: var(--serif); font-style: italic; font-size: 12pt; letter-spacing: 0; text-transform: none; color: var(--gold-light); margin-right: 4px; }
  .proj__head h2 { margin-top: 8px; font-family: var(--serif); font-size: 44pt; line-height: .95; letter-spacing: -.025em; color: var(--cream); }
  .proj__head .tipo { margin-top: 6px; font-size: 11pt; color: var(--muted); }
  .proj__laptop { margin: 16px auto 0; width: 94%; }
  .proj__body { margin-top: 18px; display: grid; grid-template-columns: 88mm 1fr; gap: 9mm; align-items: start; }
  .proj__phones { display: flex; gap: 5mm; }
  .proj__phones figure { margin: 0; width: 41mm; }
  .proj__phones figcaption { margin-top: 7px; text-align: center; font-size: 7.6pt; color: var(--muted-2); }
  .phone::before, .phone::after { display: none; }
  .list { display: grid; border-top: 1px solid var(--line); margin-top: 8px; }
  .list li { display: grid; grid-template-columns: 20px 1fr; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 10pt; line-height: 1.4; color: var(--text); }
  .list svg { width: 18px; height: 18px; color: var(--gold); }
  .qrs { display: grid; gap: 10px; margin-top: 10px; }
  .qr { display: flex; gap: 12px; align-items: center; }
  .qr__code { flex: none; width: 23mm; height: 23mm; padding: 2.4mm; background: var(--cream); border-radius: 8px; }
  .qr__code svg { width: 100%; height: 100%; }
  .qrs--multi .qr__code { width: 19mm; height: 19mm; padding: 2mm; }
  .qr b { display: block; font-size: 9.5pt; color: var(--cream); font-weight: 600; }
  .qr a { font-size: 9pt; color: var(--gold-light); text-decoration: underline; text-decoration-color: var(--line-strong); text-underline-offset: 2px; word-break: break-all; }

  /* contato */
  .end { justify-content: center; text-align: center; align-items: center; }
  .end .ttl { font-size: 54pt; max-width: 160mm; }
  .end .intro { margin: 18px auto 0; text-align: center; }
  .end__cta { margin-top: 30px; display: inline-flex; align-items: center; gap: 12px; padding: 0 30px; height: 60px; border-radius: 999px; background: var(--gold-grad); color: #15110b; font-weight: 600; font-size: 13pt; }
  .end__cta .btn__ico { margin-left: -14px; }
  .end__qrs { margin-top: 34px; display: flex; gap: 14mm; justify-content: center; }
  .end__qrs .qr { flex-direction: column; text-align: center; }
  .end__qrs .qr__code { width: 34mm; height: 34mm; }
</style></head><body>
  <svg width="0" height="0" style="position:absolute"><symbol id="i-wa" viewBox="0 0 24 24"><path fill="currentColor" d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.59-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.12-.28-.2-.57-.35Zm-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.88 9.89Zm8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41Z"/></symbol></svg>

  <!-- capa -->
  <section class="page cover">
    <div class="glow" style="width:180mm;height:180mm;right:-60mm;top:60mm"></div>
    <span class="cover__tag">Portfólio · ${esc(mes)}</span>
    <img class="cover__logo" style="margin-top:22px" src="../assets/brand/logo-384.webp" alt="">
    <h1>Vinicius<b>.</b></h1>
    <p class="slogan gold-text">Sites Premium &amp; Web IA</p>
    <p class="pitch">Sites e sistemas que fazem o cliente <strong>chamar no seu WhatsApp</strong>. Para empresas de Sinop, Sorriso e região.</p>
    <div class="cover__stage">
      ${capaLaptop}
      ${capaPhone}
    </div>
    <div class="cover__foot">
      <div><b>Vinicius</b>Sinop, Mato Grosso</div>
      <div style="text-align:right"><b>(66) 99636-9065</b>WhatsApp</div>
    </div>
  </section>

  <!-- o que fazemos -->
  <section class="page">
    <p class="label">O que eu faço</p>
    <h2 class="ttl">Tudo para o seu cliente <em>encontrar, confiar e chamar.</em></h2>
    <p class="intro">Crio sites, landing pages e sistemas sob medida para empresas da região. Cada projeto é pensado para o celular, aparece no Google e leva o visitante direto para uma conversa no seu WhatsApp.</p>
    <div class="svcs">
      <article class="svc"><span class="svc__ico">${ico('site')}</span><h3>Site institucional</h3><p>Seu negócio no Google com cara de empresa grande. Rápido no celular e feito para gerar contato.</p><p class="ex">Exemplo: <a href="https://dragabrielaveigantt.com.br">dragabrielaveigantt.com.br</a></p></article>
      <article class="svc"><span class="svc__ico">${ico('lp')}</span><h3>Landing page</h3><p>Uma página focada em uma oferta, pronta para campanha de anúncio e para virar conversa no WhatsApp.</p><p class="ex">Exemplo: <a href="https://betaopneussinop.com.br">betaopneussinop.com.br</a></p></article>
      <article class="svc svc--hl"><span class="svc__ico">${ico('pedidos')}</span><h3>Sistema de pedidos online</h3><p>Cardápio digital com carrinho. O pedido chega pronto no seu WhatsApp, sem pagar comissão para aplicativo de delivery.</p><p class="ex">Exemplo: <a href="https://pedido.egaosushi.com.br">pedido.egaosushi.com.br</a></p></article>
      <article class="svc"><span class="svc__ico">${ico('ads')}</span><h3>Gestão de Google Ads</h3><p>Anúncios para quem já está procurando o que você vende na sua cidade. Acompanhamento de perto e relatório claro.</p></article>
    </div>
    <p class="ia">${ico('ia')}<span><b>Soluções com IA:</b> também crio automações com inteligência artificial, como atendimento automático no WhatsApp.</span></p>

    <p class="label" style="margin-top:18px">Como funciona</p>
    <ol class="steps2">
      <li><span class="n">01</span><h4>Conversa</h4><p>Você me chama no WhatsApp e conta sobre o seu negócio. Sem compromisso.</p></li>
      <li><span class="n">02</span><h4>Proposta</h4><p>Te mando o que vai ter no site, o prazo e o valor. Tudo por escrito.</p></li>
      <li><span class="n">03</span><h4>Criação</h4><p>Crio o site com a cara da sua marca. Você acompanha e pede ajustes.</p></li>
      <li><span class="n">04</span><h4>Site no ar</h4><p>Publico no seu domínio, pronto para o Google e para receber clientes.</p></li>
    </ol>

    <ul class="whys">
      <li>${ico('check')}<span>Atendimento direto comigo, do início ao fim</span></li>
      <li>${ico('check')}<span>Pensado primeiro para o celular</span></li>
      <li>${ico('check')}<span>Todos os botões levam para o seu WhatsApp</span></li>
      <li>${ico('check')}<span>Visual sob medida, nada de modelo pronto</span></li>
    </ul>
    <footer class="foot"><span>Vinicius<b>.</b> Sites Premium &amp; Web IA</span><span>(66) 99636-9065</span></footer>
  </section>

  ${projetos.join('\n')}

  <!-- contato -->
  <section class="page end">
    <div class="glow" style="width:220mm;height:220mm;left:-5mm;top:30mm"></div>
    <img class="cover__logo" src="../assets/brand/logo-384.webp" alt="" style="position:relative">
    <h2 class="ttl" style="margin-top:26px;position:relative">Vamos colocar o seu negócio <em>no ar?</em></h2>
    <p class="intro" style="position:relative">Me chama no WhatsApp, conta o que você precisa e eu te mando uma proposta. Sem compromisso.</p>
    <a class="end__cta" style="position:relative" href="https://wa.me/${WA}?text=${encodeURIComponent(WA_MSG)}"><span class="btn__ico"><svg viewBox="0 0 24 24"><use href="#i-wa"/></svg></span>(66) 99636-9065</a>
    <div class="end__qrs" style="position:relative">
      <div class="qr"><div class="qr__code">${qrWa}</div><div><b>WhatsApp</b><a href="https://wa.me/${WA}">wa.me/${WA}</a></div></div>
      <div class="qr"><div class="qr__code">${qrSite}</div><div><b>Portfólio completo</b><a href="${SITE}">${esc(dominio(SITE))}</a></div></div>
    </div>
    <footer class="foot" style="width:100%;position:relative"><span>Vinicius<b>.</b> Sites Premium &amp; Web IA · Sinop, Mato Grosso</span><span>Atendo Sinop, Sorriso e região</span></footer>
  </section>

</body></html>`;

  const tmp = path.join(ROOT, '.tmp');
  await fs.mkdir(tmp, { recursive: true });
  const file = path.join(tmp, 'portfolio-pdf.html');
  await fs.writeFile(file, html);

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await fs.mkdir(path.dirname(SAIDA), { recursive: true });
  await page.pdf({ path: SAIDA, format: 'A4', printBackground: true, preferCSSPageSize: true, tagged: true });
  if (args.previa) {
    // prévia das páginas em PNG, útil para conferir o layout
    await page.setViewportSize({ width: 794, height: 1123 });
    const n = await page.locator('.page').count();
    for (let i = 0; i < n; i++) await page.locator('.page').nth(i).screenshot({ path: path.join(tmp, `pdf-pagina-${i + 1}.png`) });
  }
  await browser.close();

  const kb = Math.round((await fs.stat(SAIDA)).size / 1024);
  console.log(`✓ PDF gerado: ${path.relative(ROOT, SAIDA)} (${lista.length} projeto(s), ${kb} KB)`);
  if (faltando.length) { console.log('Ficaram de fora:'); for (const f of faltando) console.log(`  - ${f}`); }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
