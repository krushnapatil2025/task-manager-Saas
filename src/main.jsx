import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { injectCSPMeta } from './utils/security.js';

// ── Security: inject Content-Security-Policy meta tag before rendering ──────
injectCSPMeta();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
