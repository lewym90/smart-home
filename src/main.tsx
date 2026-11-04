import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './store';
import './styles.css';

// iOS potrafi dać aplikacji z ekranu początkowego widok krótszy niż ekran. Mierzymy lukę i rozciągamy interfejs do dołu.
function fitScreen() {
  const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  const inner = Math.max(innerHeight, Math.round(visualViewport?.height ?? 0), document.documentElement.clientHeight);
  const d = Math.max(screen.height, screen.width) - inner;
  const gap = standalone && innerHeight > innerWidth && d > 4 && d < 140 ? d : 0;
  document.documentElement.style.setProperty('--gap', `${gap}px`);
}
fitScreen();
addEventListener('resize', fitScreen);
addEventListener('orientationchange', () => setTimeout(fitScreen, 300));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider><App /></AppProvider>
  </StrictMode>,
);
