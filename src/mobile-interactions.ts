export {};

let touchTarget: HTMLElement | null = null;
let touchStartX = 0;
let touchStartY = 0;

function interactiveTarget(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement
    ? target.closest<HTMLElement>('button, a[href], input[type="checkbox"], input[type="radio"], [role="button"], summary')
    : null;
}

document.addEventListener('touchstart', event => {
  const touch = event.changedTouches[0];
  touchTarget = interactiveTarget(event.target);
  touchStartX = touch?.clientX ?? 0;
  touchStartY = touch?.clientY ?? 0;
}, { passive: true, capture: true });

document.addEventListener('touchend', event => {
  const touch = event.changedTouches[0];
  const target = interactiveTarget(event.target);
  const moved = touch ? Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY) : 0;
  if (!target || target !== touchTarget || moved > 14 || target.hasAttribute('disabled')) return;

  // iOS peut perdre le click après une mise à jour de service worker ou dans une PWA restaurée.
  // On déclenche explicitement l'action à la fin d'un tap réel, sans toucher au défilement.
  event.preventDefault();
  target.click();
}, { passive: false, capture: true });

document.addEventListener('touchcancel', () => { touchTarget = null; }, { passive: true });

// Garantit qu'aucune couche masquée ne puisse intercepter les taps.
for (const element of document.querySelectorAll<HTMLElement>('[hidden]')) element.style.setProperty('display', 'none', 'important');

new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.hidden) node.style.setProperty('display', 'none', 'important');
      for (const hidden of node.querySelectorAll<HTMLElement>('[hidden]')) hidden.style.setProperty('display', 'none', 'important');
    }
  }
}).observe(document.body, { childList: true, subtree: true });
