/**
 * Application entry point.
 *
 * Uses a minimal hash-based router (no library dependency):
 *   - Default route → estimate form + live preview
 *   - #/admin       → admin CRUD page for clients/companies/managers
 */
import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import AdminPage from './components/AdminPage.jsx'

/** Hash-based router — listens for hashchange events to swap pages. */
function Router() {
  const [path, setPath] = useState(window.location.hash)

  useEffect(() => {
    const onHash = () => setPath(window.location.hash)
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (path === '#/admin') return <AdminPage />
  return <App />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router />
  </StrictMode>,
)
