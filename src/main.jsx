// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initErrorReporting } from './lib/errorReporting'

// Pornește raportarea de erori (Supabase + Sentry dacă e configurat + handlere globale)
initErrorReporting()

// Reset CSS global
const style = document.createElement('style')
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { -webkit-font-smoothing: antialiased; }
  input, button { font-family: inherit; }
  a { color: inherit; }
`
document.head.appendChild(style)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
