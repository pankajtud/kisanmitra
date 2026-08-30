import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.js';
import './i18n/index.js';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root is missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline shell. A failure here costs the user nothing on this visit, so it is
// logged and ignored rather than surfaced (CLAUDE.md §2.1).
registerSW({ immediate: true, onRegisterError: (error) => console.warn('service worker', error) });
