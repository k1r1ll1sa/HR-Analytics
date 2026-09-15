import { useState } from 'react'
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  LineChart,
  Menu,
  Network,
  Target,
  TrendingUp,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import './Landing.css'

const modules = [
  {
    icon: Network,
    number: '01',
    title: 'Оргструктура',
    text: 'Отделы, команды и сотрудники в понятной структуре компании.',
    tag: 'Структура компании',
  },
  {
    icon: UsersRound,
    number: '02',
    title: 'Оценка 360°',
    text: 'Сбор обратной связи от коллег и руководителей в одном месте.',
    tag: 'Объективная оценка',
  },
  {
    icon: Target,
    number: '03',
    title: 'План развития',
    text: 'Навыки, цели и индивидуальный план развития сотрудника.',
    tag: 'IDP',
  },
  {
    icon: BarChart3,
    number: '04',
    title: 'Аналитика',
    text: 'Показатели команд и раннее выявление риска выгорания.',
    tag: 'HR-метрики',
  },
]

function Logo() {
  return (
    <a className="logo" href="#top" aria-label="HR Analytics — на главную">
      <span className="logo-icon">
        <LineChart size={19} />
      </span>
      HR Analytics
    </a>
  )
}

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <header className="header">
      <div className="container header-content">
        <Logo />

        <nav className={`navigation ${isMenuOpen ? 'navigation-open' : ''}`}>
          <a href="#modules" onClick={closeMenu}>
            Возможности
          </a>
          <a href="#analytics" onClick={closeMenu}>
            Аналитика
          </a>
        </nav>

        <a className="button button-small header-button" href="#demo">
          Попробовать
        </a>

        <button
          className="menu-button"
          type="button"
          aria-label={isMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((value) => !value)}
        >
          {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
    </header>
  )
}

function SectionHeading({
  label,
  title,
  description,
  centered = false,
}: {
  label: string
  title: string
  description?: string
  centered?: boolean
}) {
  return (
    <div className={`section-heading ${centered ? 'section-heading-centered' : ''}`}>
      <span className="section-label">{label}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  )
}

function Landing() {
  return (
    <div id="top">
      <Header />

      <main>
        <section className="container hero">
          <div className="hero-content">
            <span className="hero-label">
              HR-платформа для команд и руководителей
            </span>
            <h1>
              Понимайте сотрудников.
              <br />
              Развивайте команды.
            </h1>
            <p>
              Единая веб-платформа для оценки сотрудников, планирования
              развития и анализа состояния команды.
            </p>

            <div className="hero-actions">
              <a className="button" href="#demo">
                Попробовать платформу <ArrowRight size={18} />
              </a>
              <a className="button button-secondary" href="#modules">
                Посмотреть возможности
              </a>
            </div>

            <div className="hero-features">
              <span>
                <CheckCircle2 size={16} /> 4 основных модуля
              </span>
              <span>
                <CheckCircle2 size={16} /> Понятная аналитика
              </span>
              <span>
                <CheckCircle2 size={16} /> Адаптивная веб-версия
              </span>
            </div>
          </div>
        </section>

        <section className="section section-muted">
          <div className="container">
            <SectionHeading
              label="Зачем нужна платформа"
              title="HR-данные должны помогать принимать решения"
              description="Информация о сотрудниках часто хранится в разных таблицах и системах. Из-за этого сложно увидеть общую картину."
              centered
            />

            <div className="problem-grid">
              <article className="card problem-card">
                <FileSpreadsheet size={27} />
                <h3>Данные разрознены</h3>
                <p>
                  Оценки, навыки и планы развития находятся в разных файлах.
                </p>
              </article>
              <article className="card problem-card">
                <ClipboardCheck size={27} />
                <h3>Оценка занимает время</h3>
                <p>
                  Ручной сбор обратной связи усложняет проведение оценки 360°.
                </p>
              </article>
              <article className="card problem-card">
                <TrendingUp size={27} />
                <h3>Риски замечают поздно</h3>
                <p>
                  Снижение вовлеченности становится заметно только после
                  появления проблемы.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="container section" id="modules">
          <SectionHeading
            label="Возможности"
            title="Четыре модуля в одной системе"
            description="Только необходимые инструменты для работы HR, руководителя и сотрудника."
          />

          <div className="module-grid">
            {modules.map(({ icon: Icon, number, title, text, tag }) => (
              <article className="card module-card" key={title}>
                <div className="module-card-header">
                  <span className="module-icon">
                    <Icon size={25} />
                  </span>
                  <small>{number}</small>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="tag">{tag}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="section section-muted">
          <div className="container">
            <SectionHeading
              label="Как это работает"
              title="От данных к понятному действию"
              centered
            />

            <div className="steps">
              <article className="card step-card">
                <span className="step-number">1</span>
                <h3>Соберите данные</h3>
                <p>Добавьте сотрудников и запустите оценку 360°.</p>
              </article>
              <ArrowRight className="step-arrow" size={20} />
              <article className="card step-card">
                <span className="step-number">2</span>
                <h3>Получите результат</h3>
                <p>
                  Система объединит оценки, навыки и прогресс по целям.
                </p>
              </article>
              <ArrowRight className="step-arrow" size={20} />
              <article className="card step-card">
                <span className="step-number">3</span>
                <h3>Примите решение</h3>
                <p>
                  Создайте план развития и обратите внимание на риски.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="container section analytics" id="analytics">
          <SectionHeading
            label="Аналитика"
            title="Состояние команды — на одном экране"
            description="Платформа показывает динамику оценок, выполнение планов развития и сотрудников, которым может потребоваться поддержка."
            centered
          />

          <div className="analytics-grid">
            <article className="card analytics-card">
              <CheckCircle2 size={22} />
              <div>
                <h3>Оценка результатов</h3>
                <p>Динамика оценок сотрудников и отделов</p>
              </div>
            </article>
            <article className="card analytics-card">
              <CheckCircle2 size={22} />
              <div>
                <h3>Контроль развития</h3>
                <p>Прогресс по целям индивидуального плана</p>
              </div>
            </article>
            <article className="card analytics-card">
              <CheckCircle2 size={22} />
              <div>
                <h3>Риск выгорания</h3>
                <p>Сигналы на основе заданных показателей</p>
              </div>
            </article>
          </div>
        </section>

        <section className="section section-muted">
          <div className="container">
            <SectionHeading
              label="Для кого"
              title="Полезно каждому участнику"
              centered
            />

            <div className="role-grid">
              <article className="card role-card">
                <span className="role-icon">
                  <UserRound size={23} />
                </span>
                <h3>Сотруднику</h3>
                <p>
                  Видеть обратную связь, навыки и понятный план развития.
                </p>
              </article>
              <article className="card role-card">
                <span className="role-icon">
                  <UsersRound size={23} />
                </span>
                <h3>Руководителю</h3>
                <p>
                  Понимать состояние команды и помогать сотрудникам расти.
                </p>
              </article>
              <article className="card role-card">
                <span className="role-icon">
                  <BarChart3 size={23} />
                </span>
                <h3>HR-специалисту</h3>
                <p>
                  Проводить оценки и анализировать данные в одной системе.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="container call-to-action" id="demo">
          <div>
            <span>HR Analytics</span>
            <h2>Начните работать с HR-данными проще</h2>
            <p>
              Оценка 360°, планы развития и аналитика — в одной веб-платформе.
            </p>
          </div>
          <a
            className="button button-light"
            href="mailto:hr-analytics@example.com"
          >
            Попробовать платформу <ArrowRight size={18} />
          </a>
        </section>
      </main>

      <footer className="footer">
        <div className="container footer-content">
          <Logo />
          <nav>
            <a href="#modules">Возможности</a>
            <a href="#analytics">Аналитика</a>
          </nav>
          <span>© 2026 HR Analytics</span>
        </div>
      </footer>
    </div>
  )
}

export default Landing
