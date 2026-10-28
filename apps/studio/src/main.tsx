import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { playerRef } from './playerRef';
import { useStore } from './store';
import { TooltipProvider } from './components/ui/tooltip';
import { ThemeProvider } from './lib/theme';
import './index.css';

if (import.meta.env.DEV) {
  // debug handles for the browser console
  (window as any).__store = useStore;
  (window as any).__player = playerRef;
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <TooltipProvider>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
