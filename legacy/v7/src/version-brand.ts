export {};

const VERSION = 'V7.1.4';

function refreshBrand(): void {
  const brand = document.querySelector<HTMLElement>('.brand');
  if (!brand) return;
  brand.innerHTML = `QUOTIDIEN <span>${VERSION}</span>`;
}

refreshBrand();
new MutationObserver(refreshBrand).observe(document.body, { childList: true, subtree: true });
document.title = `Quotidien ${VERSION}`;
document.querySelector('meta[name="description"]')?.setAttribute('content', 'Quotidien V7.1.4 Life OS — version sans cache persistant.');
