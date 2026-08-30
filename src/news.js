import './style.css';
import { $, $$, el, renderChrome } from './layout.js';
import { t, getLang, initI18n } from './i18n.js';
import { NEWS_ARTICLES, LEGACY_SLUG_ALIASES } from './news-data.js';
import { renderMarkdown } from './markdown.js';

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const isEn = () => getLang() === 'en';

const pick = (a) => {
  const d = isEn() && a.en ? a.en : a;
  return { title: d.title, summary: d.summary, content: d.content };
};

const tagOf = (a) => (isEn() ? a.tagEn || a.tag : a.tag) || '';

/* ---------------- reading progress (article only) ---------------- */
let progressEl = null;

function mountProgress() {
  if (!progressEl) {
    progressEl = el('div', 'reading-progress');
    progressEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progressEl);
  }
  updateProgress();
}

function unmountProgress() {
  progressEl?.remove();
  progressEl = null;
}

function updateProgress() {
  if (!progressEl) return;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
  progressEl.style.transform = `scaleX(${pct})`;
}

/* ---------------- article detail ---------------- */
function renderArticle(a) {
  const root = $('#news-root');
  const d = pick(a);
  const tag = tagOf(a);
  root.className = 'article-page';
  root.innerHTML = `
    <header class="article-head">
      <div class="article-head__meta">
        ${tag ? `<span class="article-card__tag">${escapeHtml(tag)}</span>` : ''}
        <time datetime="${a.date}">${a.date}</time>
      </div>
      <h1>${escapeHtml(d.title)}</h1>
      <p class="article-head__summary">${escapeHtml(d.summary)}</p>
    </header>
    <div class="article-layout">
      <aside class="article-toc" aria-label="${t('article.toc')}"><b>${t('article.toc')}</b></aside>
      <article class="article__body">${renderMarkdown(d.content)}</article>
    </div>`;
  mountProgress();

  // 章节锚点 + 左侧目录 + scrollspy
  const headings = $$('.article__body h3', root);
  headings.forEach((h, i) => { h.id = `sec-${i + 1}`; });
  const toc = $('.article-toc', root);
  headings.forEach((h, i) => {
    const link = el('a', '', `<i>${String(i + 1).padStart(2, '0')}</i>${escapeHtml(h.textContent)}`);
    link.href = `#sec-${i + 1}`;
    if (i === 0) link.classList.add('active');
    toc.appendChild(link);
    link.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  const links = $$('a', toc);
  const setActive = (id) => {
    links.forEach((n) => n.classList.toggle('active', n.getAttribute('href') === '#' + id));
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
  }, { rootMargin: '-15% 0px -70% 0px' });
  headings.forEach((h) => io.observe(h));
}

/* ---------------- hash router ---------------- */
function resolveSlug(raw) {
  if (NEWS_ARTICLES.some((a) => a.slug === raw)) return raw;
  if (LEGACY_SLUG_ALIASES[raw]) return LEGACY_SLUG_ALIASES[raw];
  return null;
}

function route() {
  const raw = location.hash.replace(/^#\//, '');
  const slug = raw ? resolveSlug(raw) : null;
  if (slug) {
    // 历史链接归一化到当前 slug，保持地址栏与内容一致
    if (raw !== slug) { location.replace(`#/${slug}`); return; }
    renderArticle(NEWS_ARTICLES.find((x) => x.slug === slug));
  } else {
    renderList();
  }
  window.scrollTo(0, 0);
}

/* ---------------- list ---------------- */
function renderList() {
  const root = $('#news-root');
  unmountProgress();
  root.className = 'articles';
  root.innerHTML = '';
  NEWS_ARTICLES.forEach((a, i) => {
    const d = pick(a);
    const card = el('a', 'article-card' + (i === 0 ? ' article-card--latest' : ''));
    card.href = `#/${a.slug}`;
    const tag = tagOf(a);
    card.innerHTML = `
      <div class="article-card__rail">
        <time datetime="${a.date}">${a.date}</time>
        ${tag ? `<span class="article-card__tag">${escapeHtml(tag)}</span>` : ''}
        ${i === 0 ? `<span class="article-card__tag article-card__tag--latest">${t('news.latest')}</span>` : ''}
      </div>
      <div class="article-card__body">
        <h2>${escapeHtml(d.title)}</h2>
        <p>${escapeHtml(d.summary)}</p>
        <span class="article-card__more" aria-hidden="true">→</span>
      </div>`;
    root.appendChild(card);
  });
}

/* ---------------- boot ---------------- */
function boot() {
  renderChrome('news');
  initI18n();
  route();
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  window.addEventListener('hashchange', route);
  document.addEventListener('idh:langchange', route);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
