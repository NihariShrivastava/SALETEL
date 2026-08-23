import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { AppProvider } from './contexts/AppContext.tsx'
import { Toaster } from 'react-hot-toast'

window.addEventListener('error', (event) => {
  fetch('http://localhost:3001/', {
    method: 'POST',
    body: JSON.stringify({ message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno, error: event.error?.stack })
  }).catch(() => {});
});

window.addEventListener('unhandledrejection', (event) => {
  fetch('http://localhost:3001/', {
    method: 'POST',
    body: JSON.stringify({ message: 'Unhandled Rejection', reason: event.reason?.stack || event.reason })
  }).catch(() => {});
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <AppProvider>
        <App />
        <Toaster toastOptions={{
          style: { background: '#1a1d2e', color: '#fff', border: '1px solid #252840' },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
        }} />
      </AppProvider>
    </AuthProvider>
  </React.StrictMode>,
)
