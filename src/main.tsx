import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/index.scss';
import App from './App.tsx';

const rootElement = document.querySelector('#root');

if (!rootElement) {
  throw new Error('No se encontró el elemento #root en el documento.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
