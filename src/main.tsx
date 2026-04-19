import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

console.log("UCC Lancers App: Initializing...");

window.addEventListener('error', (event) => {
  console.error("Global Error Caught:", event.error);
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
