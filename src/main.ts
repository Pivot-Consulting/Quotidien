export {};

const root = document.querySelector<HTMLElement>('#app');

function showRecovery(message: string): void {
  if (!root) return;
  root.innerHTML = `<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f2f5f8;color:#172231;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><section style="width:min(440px,100%);background:#fff;border:1px solid #dce4ec;border-radius:22px;padding:24px;box-shadow:0 18px 55px rgba(16,36,63,.12);text-align:center"><h1 style="font-size:24px;margin:0 0 10px">Quotidien n’a pas pu démarrer</h1><p style="color:#66768a;line-height:1.5">Une donnée locale ou un cache iOS bloque l’ouverture. Tes données ne sont pas supprimées.</p><button id="boot-retry" style="margin-top:14px;border:0;border-radius:12px;padding:12px 18px;background:#10243f;color:#fff;font-weight:800">Réessayer</button><p style="margin-top:12px;font-size:11px;word-break:break-word;color:#8a4b55">${message.replace(/[&<>]/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[character] ?? character))}</p></section></main>`;
  document.querySelector('#boot-retry')?.addEventListener('click', () => location.reload());
}

const watchdog = window.setTimeout(() => showRecovery('Délai de démarrage dépassé.'), 9000);

try {
  await import('./app-v61.js');
  window.clearTimeout(watchdog);
  void import('./life-os/hub.js').catch(error => console.error('Life OS indisponible', error));
  void import('./wave-a/app.js').catch(error => console.error('Vague A indisponible', error));
  void import('./version-brand.js').catch(error => console.error('Branding indisponible', error));
} catch (error) {
  window.clearTimeout(watchdog);
  showRecovery(error instanceof Error ? error.message : String(error));
}
