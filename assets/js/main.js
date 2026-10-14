// Vinicius. Portfólio
// Monta a página a partir do projects.json, cuida da medição (dataLayer)
// e liga as animações (Motion + Lenis via CDN) só quando o visitante aceita movimento.

const MOTION_URL = 'https://cdn.jsdelivr.net/npm/motion@13.4.3/+esm';
const LENIS_URL = 'https://cdn.jsdelivr.net/npm/lenis@1.3.26/+esm';

const cfg = Object.assign(
  {
    whatsapp: '5566996369065',
    mensagem: 'Oi Vinicius! Vi seu portfólio e quero um site pro meu negócio.',
    instagram: '',
  },
  window.SITE_CONFIG || {}
);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const isDesktop = matchMedia('(min-width: 960px)');

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const waLink = (msg = cfg.mensagem) => `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(msg)}`;
const domain = (url) => { try { return new URL(url).host.replace(/^www\./, '') + new URL(url).pathname.replace(/\/$/, ''); } catch { return url; } };
const icon = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

/* ---------- Medição ---------- */
const params = new URLSearchParams(location.search);
const origem = { utm_source: params.get('utm_source') || '', utm_medium: params.get('utm_medium') || '', utm_campaign: params.get('utm_campaign') || '' };
window.dataLayer = window.dataLayer || [];
function track(event, data = {}) {
  window.dataLayer.push({ event, ...data, ...origem });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-track]');
  if (!a) return;
  track(a.dataset.track, {
    projeto: a.dataset.projeto || '',
    local: a.dataset.local || '',
    link_url: a.href || '',
  });
});

/* ---------- Links globais ---------- */
function wireLinks(root = document) {
  $$('[data-wa]', root).forEach((a) => { a.href = waLink(a.dataset.wa || cfg.mensagem); });
  $$('[data-wa-plain]', root).forEach((a) => { a.href = `https://wa.me/${cfg.whatsapp}`; });
  const ig = String(cfg.instagram || '').replace(/^@/, '').trim();
  $$('[data-instagram]', root).forEach((a) => {
    if (!ig) return;
    a.href = `https://www.instagram.com/${encodeURIComponent(ig)}/`;
    a.hidden = false;
  });
  // links externos sempre em nova aba
  $$('a[href^="http"]', root).forEach((a) => {
    if (a.host === location.host) return;
    a.target = '_blank';
    const rel = new Set((a.rel || '').split(/\s+/).filter(Boolean));
    rel.add('noopener');
    a.rel = [...rel].join(' ');
  });
}

/* ---------- Imagens dos prints ---------- */
function shot(print, alt, { sizes, cls = '', eager = false } = {}) {
  if (!print) return '';
  return `<img class="${cls}" src="${esc(print.src)}" srcset="${esc(print.srcset)}" sizes="${sizes}" width="${print.w}" height="${print.h}" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">`;
}
const placeholder = (p) => `<div class="placeholder"><span>${esc(p.nome)}</span></div>`;

function laptop(p, { sizes = '(min-width: 960px) 52vw, 84vw', eager = false } = {}) {
  const img = shot(p.prints?.desktop, `Site ${artigo(p)} ${p.nome} no computador`, { sizes, eager });
  return `<div class="laptop"><div class="laptop__lid"><div class="laptop__screen">${img || placeholder(p)}</div></div><div class="laptop__base"></div></div>`;
}
function phone(p, { full = true, cls = '', sizes = '(min-width: 960px) 14vw, 30vw' } = {}) {
  const alt = p.urlCelular ? `${p.rotuloCelular || 'Site'} ${artigo(p)} ${p.nome} no celular` : `Site ${artigo(p)} ${p.nome} no celular`;
  let inner = placeholder(p);
  if (full && p.prints?.mobileFull) {
    const pf = p.prints.mobileFull;
    const ratio = pf.h / pf.w / (844 / 390); // quantas telas de altura
    const dur = Math.max(10, Math.min(36, ratio * 3.2));
    inner = shot(pf, alt, { sizes, cls: 'shot-full' }).replace('<img ', `<img style="--dur:${dur.toFixed(1)}s" `);
  } else if (p.prints?.mobile) {
    inner = shot(p.prints.mobile, alt, { sizes, cls: 'shot-fold' });
  }
  return `<div class="phone ${cls}"><div class="phone__screen"><span class="phone__island"></span>${inner}</div></div>`;
}
// "do", "da" ou "de" conforme o nome
function artigo(p) {
  if (p.artigo) return p.artigo;
  if (/^(dra\.|clínica|tornearia|cooperativa|loja|ms |luz )/i.test(p.nome)) return 'da';
  return 'do';
}

/* ---------- Renderização ---------- */
function metaLine(p) {
  return [p.segmento, p.cidade].filter(Boolean).map(esc).join('<span class="sep" aria-hidden="true"></span>');
}

function renderFeatured(list) {
  const box = $('[data-featured]');
  box.innerHTML = list.map((p, i) => {
    const extras = (p.linksExtras || []).map((l) => `<a class="link-arrow" href="${esc(l.url)}" target="_blank" rel="noopener" data-track="clique_ver_site" data-projeto="${esc(p.nome)}" data-local="destaque_extra">${esc(l.rotulo)} ${icon('i-out')}</a>`).join('');
    return `
    <article class="feat" data-cat="${esc(p.categoria)}">
      <div class="feat__media" data-reveal>
        <div class="stage tilt" data-tilt>
          <div class="stage__bg" aria-hidden="true"></div>
          <div data-parallax="-24" style="position:absolute;inset:0">${laptop(p)}</div>
          <div data-parallax="36" class="stage__phone" style="position:absolute;inset:0;pointer-events:none">${phone(p)}</div>
          ${p.urlCelular && p.rotuloCelular ? `<span class="stage__tag">${esc(p.rotuloCelular)}</span>` : ''}
          <span class="tilt__glare" aria-hidden="true"></span>
        </div>
      </div>
      <div class="feat__info">
        <p class="feat__meta" data-reveal><span class="feat__num">${String(i + 1).padStart(2, '0')}</span>${metaLine(p)}</p>
        <h3 class="feat__title" data-split>${esc(p.nome)}</h3>
        <p class="feat__type" data-reveal>${esc(p.tipo || '')}</p>
        <ul class="feat__list">
          ${(p.destaques || []).slice(0, 3).map((d) => `<li data-reveal>${icon('i-check')}<span>${esc(d)}</span></li>`).join('')}
        </ul>
        <div class="feat__ctas" data-reveal>
          <a class="btn btn--ghost" href="${esc(p.url)}" target="_blank" rel="noopener" data-track="clique_ver_site" data-projeto="${esc(p.nome)}" data-local="destaque">Ver site no ar ${icon('i-out', 'btn__arrow')}</a>
          ${extras}
          <a class="link-arrow" href="${waLink(`Oi Vinicius! Vi o site ${artigo(p)} ${p.nome} no seu portfólio e quero um assim pro meu negócio.`)}" target="_blank" rel="noopener" data-track="clique_whatsapp" data-projeto="${esc(p.nome)}" data-local="destaque_quero_assim">Quero um assim ${icon('i-wa')}</a>
        </div>
      </div>
    </article>`;
  }).join('');
}

function cardHtml(p) {
  return `
  <article class="card tilt" data-cat="${esc(p.categoria)}" data-tilt>
    <a href="${esc(p.url)}" target="_blank" rel="noopener" data-track="clique_ver_site" data-projeto="${esc(p.nome)}" data-local="grade_print" tabindex="-1" aria-hidden="true">
      <div class="browser">
        <div class="browser__bar"><span class="browser__dots"><i></i><i></i><i></i></span><span class="browser__url">${icon('i-lock')}${esc(domain(p.url))}</span></div>
        <div class="browser__view">${shot(p.prints?.desktop, `Site ${artigo(p)} ${p.nome} no computador`, { sizes: '(min-width: 1100px) 380px, (min-width: 640px) 46vw, 92vw' }) || placeholder(p)}</div>
      </div>
    </a>
    <div class="card__body">
      <p class="card__meta">${esc(p.categoria)}${p.cidade ? ` · ${esc(p.cidade)}` : ''}</p>
      <h3 class="card__title">${esc(p.nome)}</h3>
      <p class="card__type">${esc(p.tipo || '')}</p>
    </div>
    <div class="card__foot">
      <a class="link-arrow" href="${esc(p.url)}" target="_blank" rel="noopener" data-track="clique_ver_site" data-projeto="${esc(p.nome)}" data-local="grade">Ver site no ar ${icon('i-out')}</a>
      <a class="wa-mini" href="${waLink(`Oi Vinicius! Vi o site ${artigo(p)} ${p.nome} no seu portfólio e quero um assim pro meu negócio.`)}" target="_blank" rel="noopener" data-track="clique_whatsapp" data-projeto="${esc(p.nome)}" data-local="grade_quero_assim">Quero um assim</a>
    </div>
    <span class="tilt__glare" aria-hidden="true"></span>
  </article>`;
}

function renderGrid(list, categorias) {
  const section = $('[data-more]');
  if (!list.length) return;
  section.hidden = false;
  const grid = $('[data-grid]');
  grid.innerHTML = list.map(cardHtml).join('');

  const counts = {};
  list.forEach((p) => { counts[p.categoria] = (counts[p.categoria] || 0) + 1; });
  const cats = categorias.filter((c) => counts[c]);
  const filters = $('[data-filters]');
  if (cats.length < 2) { filters.hidden = true; return; }
  filters.innerHTML = [`<button class="chip" type="button" aria-pressed="true" data-filter="*">Todos <small>${list.length}</small></button>`]
    .concat(cats.map((c) => `<button class="chip" type="button" aria-pressed="false" data-filter="${esc(c)}">${esc(c)} <small>${counts[c]}</small></button>`))
    .join('');
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    $$('[data-filter]', filters).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const f = b.dataset.filter;
    $$('.card', grid).forEach((card) => {
      const show = f === '*' || card.dataset.cat === f;
      card.hidden = !show;
      card.classList.remove('is-entering');
      if (show && !reduceMotion.matches) { void card.offsetWidth; card.classList.add('is-entering'); }
    });
    track('filtro_categoria', { categoria: f === '*' ? 'Todos' : f });
  });
}

function renderVideos(list) {
  const withVideo = list.filter((p) => p.video);
  if (!withVideo.length) return;
  $('[data-videos]').hidden = false;
  const box = $('[data-reels]');
  box.innerHTML = withVideo.map((p) => `
    <figure class="reel">
      <div class="reel__frame">
        <video preload="none" playsinline ${p.videoPoster ? `poster="${esc(p.videoPoster)}"` : ''} src="${esc(p.video)}" aria-label="Vídeo do site ${artigo(p)} ${esc(p.nome)}"></video>
        <button class="reel__play" type="button" aria-label="Assistir ao vídeo do site ${artigo(p)} ${esc(p.nome)}"><span>${icon('i-play')}</span></button>
      </div>
      <figcaption><b>${esc(p.nome)}</b><span>${esc(p.cidade || p.categoria)}</span></figcaption>
    </figure>`).join('');
  box.addEventListener('click', (e) => {
    const btn = e.target.closest('.reel__play');
    if (!btn) return;
    const video = btn.parentElement.querySelector('video');
    $$('video', box).forEach((v) => { if (v !== video) v.pause(); });
    btn.hidden = true;
    video.controls = true;
    video.play().catch(() => { btn.hidden = false; });
    track('play_video', { projeto: video.getAttribute('aria-label').replace(/^Vídeo do site (do|da|de) /, '') });
  });
}

function renderHeroStage(featured) {
  const stage = $('[data-hero-stage]');
  if (!stage || !isDesktop.matches || !featured.length) return;
  const [a, b] = featured;
  stage.innerHTML = `
    <div class="stage-hero" data-hero-parallax>
      ${laptop(a, { sizes: '46vw', eager: true })}
      ${b ? phone(b, { full: false, cls: 'phone--b', sizes: '12vw' }) : ''}
      ${phone(a, { cls: 'phone--a', sizes: '14vw' })}
      <p class="stage-hero__label"><i></i><span><b>${esc(a.nome)}</b> no ar · ${esc(a.cidade || '')}</span></p>
    </div>`;
  const hero = $('.hero');
  if (!finePointer.matches || reduceMotion.matches) return;
  let raf = 0;
  hero.addEventListener('pointermove', (e) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = hero.getBoundingClientRect();
      stage.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      stage.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  });
}

function renderMarquee(list) {
  const m = $('[data-marquee]');
  if (!m || !list.length) return;
  const items = list.map((p) => `<span class="marquee__item">${esc(p.nome)}</span>`).join('');
  $('.marquee__track', m).innerHTML = `<div class="marquee__group">${items}</div><div class="marquee__group" aria-hidden="true">${items}</div>`;
  m.style.setProperty('--marquee-dur', `${Math.max(30, list.length * 6)}s`);
}

/* ---------- Interações ---------- */
function setupTilt(root = document) {
  if (!finePointer.matches || reduceMotion.matches) return;
  $$('[data-tilt]', root).forEach((el) => {
    let raf = 0;
    const max = el.classList.contains('stage') ? 5 : 7;
    el.style.transition = 'transform .6s cubic-bezier(.2,.7,.1,1)';
    el.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.transform = `perspective(1100px) rotateX(${((0.5 - y) * max).toFixed(2)}deg) rotateY(${((x - 0.5) * max).toFixed(2)}deg)`;
        el.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
        el.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
      });
    });
    el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); el.style.transform = ''; });
  });
}

// o celular só rola o print enquanto está visível na tela
function setupLivePhones() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => en.target.classList.toggle('is-live', en.isIntersecting));
  }, { rootMargin: '0px 0px -10% 0px' });
  $$('.phone').forEach((ph) => io.observe(ph));
}

function setupChrome() {
  const topbar = $('[data-topbar]');
  const fab = $('[data-fab]');
  const heroCta = $('[data-hero-cta]');
  const final = $('#contato');
  let heroVisible = true, finalVisible = false;
  const update = () => {
    const on = !heroVisible && !finalVisible;
    fab.classList.toggle('is-on', on);
    fab.setAttribute('aria-hidden', String(!on));
    fab.tabIndex = on ? 0 : -1;
  };
  new IntersectionObserver(([en]) => { heroVisible = en.isIntersecting; update(); }).observe(heroCta);
  new IntersectionObserver(([en]) => { finalVisible = en.isIntersecting; update(); }, { threshold: 0.15 }).observe(final);
  const onScroll = () => topbar.classList.toggle('is-scrolled', scrollY > 20);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- Animações (Motion + Lenis) ---------- */
function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const parts = n.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        parts.forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); return; }
          const w = document.createElement('span');
          w.className = 'w';
          const i = document.createElement('span');
          i.textContent = part;
          w.append(i);
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && !n.classList.contains('w')) {
        walk(n);
      }
    });
  };
  walk(el);
}

async function enhance() {
  if (reduceMotion.matches) return;
  let motion, Lenis;
  try {
    [motion, { default: Lenis }] = await Promise.all([import(MOTION_URL), import(LENIS_URL)]);
  } catch (e) {
    return; // sem internet para o CDN: a página continua completa, só sem animação
  }
  const { animate, inView, scroll, stagger } = motion;
  const ease = [0.2, 0.7, 0.1, 1];

  $$('[data-split]').forEach(splitWords);
  document.documentElement.classList.add('motion');

  $$('[data-split]').forEach((el) => {
    inView(el, () => {
      animate($$('.w > span', el), { transform: ['translateY(110%)', 'translateY(0%)'] }, { duration: 1, delay: stagger(0.045), ease });
    }, { margin: '0px 0px -8% 0px' });
  });

  $$('[data-reveal]').forEach((el) => {
    inView(el, () => {
      const siblings = el.parentElement ? $$(':scope > [data-reveal]', el.parentElement) : [el];
      const idx = Math.max(0, siblings.indexOf(el));
      animate(el, { opacity: [0, 1], transform: ['translateY(26px)', 'translateY(0px)'] }, { duration: 0.9, delay: Math.min(idx, 6) * 0.07, ease });
    }, { margin: '0px 0px -6% 0px' });
  });

  $$('[data-parallax]').forEach((el) => {
    const d = Number(el.dataset.parallax) || 30;
    scroll(animate(el, { transform: [`translateY(${d}px)`, `translateY(${-d}px)`] }, { ease: 'linear' }), {
      target: el.closest('.stage') || el,
      offset: ['start end', 'end start'],
    });
  });

  const fill = $('[data-steps-fill]');
  if (fill) {
    const vertical = !isDesktop.matches;
    scroll(animate(fill, { transform: vertical ? ['scaleY(0)', 'scaleY(1)'] : ['scaleX(0)', 'scaleX(1)'] }, { ease: 'linear' }), {
      target: $('[data-steps]'),
      offset: ['start 85%', 'end 55%'],
    });
  }

  if (finePointer.matches) {
    const lenis = new Lenis({ autoRaf: true, lerp: 0.1, anchors: { offset: -80 } });
    window.__lenis = lenis;
  }
}

/* ---------- Início ---------- */
async function loadProjects() {
  const res = await fetch('projects.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`projects.json: HTTP ${res.status}`);
  return res.json();
}

async function init() {
  $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  wireLinks();
  setupChrome();

  try {
    const data = await loadProjects();
    const live = data.projetos.filter((p) => p.url && p.online !== false);
    const featured = live.filter((p) => p.destaque).slice(0, 3);
    const rest = live.filter((p) => !featured.includes(p));

    renderHeroStage(featured);
    renderFeatured(featured.length ? featured : live.slice(0, 2));
    renderGrid(featured.length ? rest : live.slice(2), data.categorias || []);
    renderVideos(live);
    renderMarquee(live);

    const count = $('[data-count]');
    if (count && live.length) count.innerHTML = `<b>${live.length}</b> projetos no ar`;

    const ig = String(cfg.instagram || '').replace(/^@/, '').trim();
    if (ig) {
      const ld = $('script[type="application/ld+json"]');
      try {
        const j = JSON.parse(ld.textContent);
        j.sameAs = [`https://www.instagram.com/${ig}/`];
        ld.textContent = JSON.stringify(j);
      } catch {}
    }
  } catch (e) {
    console.warn(e);
    $('[data-featured]').innerHTML = `<p class="lead">Não consegui carregar os projetos agora. <a class="link-arrow" href="${waLink()}" target="_blank" rel="noopener">Me chama no WhatsApp</a> que eu te mando os links.</p>`;
  }

  wireLinks($('main'));
  setupTilt();
  setupLivePhones();

  const start = () => (window.requestIdleCallback ? requestIdleCallback(enhance, { timeout: 1500 }) : setTimeout(enhance, 300));
  if (document.readyState === 'complete') start();
  else addEventListener('load', start, { once: true });
}

init();
