import './styles.css';
import { AppStore } from './app/store';
import { mountApp } from './ui/render';

async function bootstrap(): Promise<void> {
  const store = new AppStore();
  await store.init();
  mountApp(document.querySelector<HTMLElement>('#app')!, store);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }
}

bootstrap();
