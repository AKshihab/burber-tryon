import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './App.tsx';
import { SessionProvider } from './session.tsx';
import { registerNotificationWorker } from './turnAlert.ts';
import './styles.css';

registerNotificationWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
