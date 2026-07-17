let touchTarget = null;
let touchStartX = 0;
let touchStartY = 0;
function interactiveTarget(target) {
    return target instanceof HTMLElement
        ? target.closest('button, a[href], input[type="checkbox"], input[type="radio"], [role="button"], summary')
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
    if (!target || target !== touchTarget || moved > 14 || target.hasAttribute('disabled'))
        return;
    event.preventDefault();
    target.click();
    touchTarget = null;
}, { passive: false, capture: true });
document.addEventListener('touchcancel', () => { touchTarget = null; }, { passive: true });
export {};
//# sourceMappingURL=mobile-interactions.js.map