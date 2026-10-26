import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('ZunoSpark: #root element missing from index.html');
}

// Block iOS pinch-zoom and long-press context menus on the toddler surface.
document.addEventListener('gesturestart', (event) => event.preventDefault());
document.addEventListener('contextmenu', (event) => {
  const target = event.target as HTMLElement | null;
  if (!target || !target.closest('input, textarea, select')) event.preventDefault();
});

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
