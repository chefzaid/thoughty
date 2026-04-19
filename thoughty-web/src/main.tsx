import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

// Handle OAuth callback for cloud provider connections (popup window)
if (globalThis.location.pathname === '/cloud-callback') {
  const params = new URLSearchParams(globalThis.location.search);
  const code = params.get('code');
  const error = params.get('error');

  if (window.opener) {
    if (code) {
      window.opener.postMessage(
        { type: 'cloud-oauth-callback', code },
        globalThis.location.origin,
      );
    } else if (error) {
      window.opener.postMessage(
        { type: 'cloud-oauth-callback', error },
        globalThis.location.origin,
      );
    }
  }

  createRoot(rootElement).render(
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
      <p>Connecting your cloud account... This window will close automatically.</p>
    </div>
  );

  setTimeout(() => window.close(), 1000);
} else {
  createRoot(rootElement).render(
    <StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </StrictMode>
  );
}
