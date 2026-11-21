import type { ReactNode } from 'react'
import { BookOpen, Building2, ClipboardList } from 'lucide-react'
import { DashboardHeader } from '../dashboard/DashboardHeader'
import '../dashboard/CompanyDashboard.css'
import './Surveys.css'

interface SurveyShellProps {
  userName: string
  companyName: string
  roleLabel: string
  title: string
  description?: string
  active: 'list' | 'editor'
  onLogout: () => void
  children: ReactNode
}

export function SurveyShell({
  userName,
  companyName,
  roleLabel,
  title,
  description,
  active,
  onLogout,
  children,
}: SurveyShellProps) {
  return (
    <main className="dashboard">
      <DashboardHeader
        userName={userName}
        companyName={companyName}
        roleLabel={roleLabel}
        onLogout={onLogout}
      />

      <div className="dashboard-layout">
        <div className="dashboard-intro">
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </div>

        <nav className="dashboard-nav" aria-label="Разделы панели">
          <a href="/dashboard">
            <Building2 size={17} />
            Структура
          </a>
          <a href="/dashboard">
            <BookOpen size={17} />
            Обучение
          </a>
          <a
            href="/surveys"
            className={active === 'list' || active === 'editor' ? 'is-active' : ''}
          >
            <ClipboardList size={17} />
            Опросники
          </a>
        </nav>

        <section className="dashboard-panel">{children}</section>
      </div>
    </main>
  )
}
