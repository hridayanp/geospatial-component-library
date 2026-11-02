import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@hridayanp/ui/styles.css';
import './styles.css';
import { App } from './App';
import { missingPages } from './content';

// A page listed in site.ts with no markdown file renders an empty article and
// is easy to miss. Fail loudly in development instead.
if (import.meta.env.DEV) {
  const missing = missingPages();
  if (missing.length > 0) {
    console.warn(
      `[docs] ${missing.length} page(s) registered without content: ${missing.join(', ')}`,
    );
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('[docs] #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
