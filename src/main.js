import './style.css';
import { $, $$, el, renderChrome, initCopyButtons } from './layout.js';
import { t, tpl, getLang, initI18n } from './i18n.js';
import { initHero3D } from './scene/hero3d.js';
import { initMockPanel } from './panel.js';
import { DYLIB_DOWNLOAD, CAPABILITIES } from './data.js';

/* ---------------- nav scroll state ---------------- */
function initNav() {
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------------- dylib download ---------------- */
function initDownload() {
  const card = $('.hero-command--download');
  if (!card) return;
  const link = $('.install-copy--download', card);
  const fileEl = $('.hero-command__line code', card);
  const titleEl = $('.hero-command__meta strong', card);
  const renderTitle = () => { titleEl.textContent = tpl('hero.dl.title', { ver: DYLIB_DOWNLOAD.version }); };
  link.href = DYLIB_DOWNLOAD.url;
  link.setAttribute('download', DYLIB_DOWNLOAD.filename);
  link.setAttribute('aria-label', tpl('hero.dl.title', { ver: DYLIB_DOWNLOAD.version }));
  link.title = `SHA-256: ${DYLIB_DOWNLOAD.sha256}`;
  fileEl.textContent = DYLIB_DOWNLOAD.filename;
  renderTitle();
  document.addEventListener('idh:langchange', renderTitle);
}

/* ---------------- capabilities accordion ---------------- */
function initHomeCaps() {
  const root = $('#caps-accordion');
  if (!root) return;
  const build = () => {
    const en = getLang() === 'en';
    root.innerHTML = '';
    CAPABILITIES.forEach((c, i) => {
      const d = en ? c.en : c;
      const item = el('div', 'capx');
      item.innerHTML = `
        <button type="button" class="capx__head" aria-expanded="false">
          <span class="capx__num">${String(i + 1).padStart(2, '0')}</span>
          <span class="capx__ico"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true">${c.icon}</svg></span>
          <span class="capx__name">${d.title}</span>
          <span class="capx__hint">${d.tags.slice(0, 3).join(' · ')}</span>
          <svg class="capx__chev" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        <div class="capx__body">
          <div class="capx__inner">
            <p>${d.desc}</p>
            <div class="capx__tags">${d.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
          </div>
        </div>`;
      $('.capx__head', item).addEventListener('click', () => {
        const open = item.classList.toggle('open');
        $('.capx__head', item).setAttribute('aria-expanded', String(open));
      });
      root.appendChild(item);
    });
  };
  build();
  document.addEventListener('idh:langchange', build);
}

/* ---------------- reveal on scroll ---------------- */
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  $$('.reveal').forEach((n) => io.observe(n));
}

/* ---------------- boot ---------------- */
function boot() {
  renderChrome('home');
  initNav();
  initCopyButtons();
  initDownload();
  initMockPanel();
  initHomeCaps();
  initReveal();
  initHero3D($('#hero-canvas'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
