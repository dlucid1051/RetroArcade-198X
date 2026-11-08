import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Mount the React application immediately so rendering is never blocked
const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}

// Safely manage Service Worker:
// In development / preview iframe, unregister any stale service workers to prevent cache/network hijacking.
// In production builds (e.g. GitHub Pages), register safely with dynamic import.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  } else {
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        registerSW({ immediate: true });
      })
      .catch((err) => {
        console.warn('PWA service worker registration skipped:', err);
      });
  }
}

