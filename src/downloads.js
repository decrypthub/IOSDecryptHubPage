import { JAILBREAK_RELEASE } from './data.js';
import { tpl } from './i18n.js';

export function initJailbreakDownloads() {
  document.querySelectorAll('[data-jailbreak-download]').forEach((link) => {
    const pkg = JAILBREAK_RELEASE.packages[link.dataset.jailbreakDownload];
    link.href = `/debs/${pkg.filename}`;
    link.download = pkg.filename;
    link.title = `SHA-256: ${pkg.sha256}`;
  });
  document.querySelectorAll('[data-jailbreak-release]').forEach((link) => {
    link.href = JAILBREAK_RELEASE.url;
  });
  const render = () => {
    document.querySelectorAll('[data-jailbreak-title]').forEach((node) => {
      node.textContent = tpl(node.dataset.jailbreakTitle, { ver: JAILBREAK_RELEASE.version });
    });
  };
  render();
  document.addEventListener('idh:langchange', render);
}
