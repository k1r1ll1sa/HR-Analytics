import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Landing from './Landing.tsx'
import LoginPage from './auth/LoginPage.tsx'
import RegisterPage from './auth/RegisterPage.tsx'
import CompanyDashboard from './dashboard/CompanyDashboard.tsx'
import { isAuthenticated } from './api/auth.ts'

const path = window.location.pathname.replace(/\/+$/, '') || '/'
const isAuthorized = isAuthenticated()

if (path === '/dashboard' && !isAuthorized) {
  window.location.replace('/login')
}

const page =
  path === '/login' ? (
    <LoginPage />
  ) : path === '/register' ? (
    <RegisterPage />
  ) : path === '/dashboard' ? (
    isAuthorized ? <CompanyDashboard /> : null
  ) : (
    <Landing />
  )

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {page}
  </StrictMode>,
)
