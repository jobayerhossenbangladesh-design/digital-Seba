import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './hooks/useAppInstall';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisteredSW() {
      // Service worker active for PWA installability
    },
    onRegisterError() {
      // Non-fatal if browser blocks SW in private mode
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);
