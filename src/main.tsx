import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

console.log("UCC Lancers App: Initializing...");

// Register Service Worker for robust offline caching
if (typeof window !== "undefined") {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log("PWA service worker: update available");
    },
    onOfflineReady() {
      console.log("PWA service worker: ready for offline use");
    },
  });
}

window.addEventListener('error', (event) => {
  console.error("Global Error Caught:", event.error);
  const rootElement = document.getElementById('root');
  if (rootElement && rootElement.innerText.includes('Loading Dashboard...')) {
    rootElement.innerHTML = `
      <div style="background: #0f172a; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; font-family: sans-serif; padding: 20px; text-align: center;">
        <div style="font-size: 24px; font-weight: 800; color: #ef4444;">FATAL ERROR</div>
        <div style="margin-top: 10px; opacity: 0.8; font-size: 14px; max-width: 400px;">${event.message}</div>
        <div style="margin-top: 20px; padding: 15px; background: #1e293b; border-radius: 12px; font-size: 12px; color: #94a3b8;">
          This usually happens when a script fails to load or your configuration is invalid.
          Check your browser's <b>Inspect > Console</b> for more details.
        </div>
      </div>
    `;
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error("Unhandled Promise Rejection:", event.reason);
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Fatal: Root element '#root' not found in index.html");
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
