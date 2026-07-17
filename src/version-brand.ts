const VERSION = 'V7.1';

function refreshBrand(): void {
  const brand = document.querySelector<HTMLElement>('.brand');
  if (!brand) return;
  brand.innerHTML = `QUOTIDIEN <span>${VERSION}</span>`;
}

refreshBrand();
new MutationObserver(refreshBrand).observe(document.body, { childList: true, subtree: true });
document.title = `Quotidien ${VERSION}`;
document.querySelector('meta[name="description"]')?.setAttribute('content', 'Quotidien V7.1 Life OS — Vague A, tâches, agenda, projets, finances, documents, maison et automatisations.');
