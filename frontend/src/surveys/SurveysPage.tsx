import { useEffect, useState, type FormEvent } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import {
  clearAuthToken,
  clearProfile,
  getProfile,
  type StoredProfile,
} from '../api/auth'
import { deleteSurvey, SurveyApiError } from '../api/surveys'
import { roleLabels } from '../dashboard/dashboardUtils'
import { SurveyShell } from './SurveyShell'
import {
  loadSurveys,
  removeSurvey,
  type SurveyListItem,
} from './surveyStorage'
import { categoryLabel, formatSurveyDate } from './surveyUtils'

export default function SurveysPage() {
  const [profile] = useState<StoredProfile | null>(getProfile)
  const companyId = profile?.companyId ?? null
  const [surveys, setSurveys] = useState(() => loadSurveys(companyId))
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    document.title = 'Опросники — HR Analytics'
  }, [])

  const handleLogout = () => {
    clearAuthToken()
    clearProfile()
  }

  const handleOpenById = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const surveyId = String(formData.get('survey_id') ?? '').trim()

    if (!surveyId) {
      setError('Укажите код опросника')
      return
    }

    window.location.href = `/surveys/${surveyId}`
  }

  const handleDelete = async (survey: SurveyListItem) => {
    if (!companyId) {
      setError('Не удалось определить компанию')
      return
    }

    const confirmed = window.confirm(`Удалить опросник «${survey.title}»?`)

    if (!confirmed) {
      return
    }

    setBusyId(survey.id)
    setError('')

    try {
      await deleteSurvey(companyId, survey.id)
      setSurveys(removeSurvey(companyId, survey.id))
    } catch (caught) {
      setError(
        caught instanceof SurveyApiError
          ? caught.message
          : 'Не удалось удалить опросник',
      )
    } finally {
      setBusyId(null)
    }
  }

  return (
    <SurveyShell
      userName={profile?.fullName || profile?.email || 'Пользователь'}
      companyName={profile?.companyName ?? ''}
      roleLabel={profile ? roleLabels[profile.role] ?? profile.role : '—'}
      title="Опросники"
      description="Опросы 360° и пульс-опросы команды."
      active="list"
      onLogout={handleLogout}
    >
      <div className="survey-toolbar">
        <div>
          <h2 id="panel-title">Все опросники</h2>
          <p>
            {surveys.length > 0
              ? `${surveys.length} опросник${surveys.length === 1 ? '' : surveys.length < 5 ? 'а' : 'ов'} в компании`
              : 'Создайте первый опросник и назначайте его сотрудникам'}
          </p>
        </div>
        <a className="dashboard-btn" href="/surveys/new">
          <Plus size={16} />
          Новый опросник
        </a>
      </div>

      <form className="survey-search" onSubmit={handleOpenById}>
        <input
          id="survey_id"
          name="survey_id"
          placeholder="Открыть по коду опросника"
          autoComplete="off"
          aria-label="Код опросника"
        />
        <button className="dashboard-btn dashboard-btn--ghost" type="submit">
          Найти
        </button>
      </form>

      {error && <p className="survey-error">{error}</p>}

      {surveys.length === 0 ? (
        <div className="survey-empty">
          <div className="survey-empty-icon" aria-hidden="true">
            <ClipboardList size={24} />
          </div>
          <strong>Опросников пока нет</strong>
          <p>Добавьте вопросы по лидерству, навыкам или коммуникации.</p>
          <a className="dashboard-btn" href="/surveys/new">
            <Plus size={16} />
            Создать опросник
          </a>
        </div>
      ) : (
        <div className="survey-grid">
          {surveys.map((survey) => (
            <article className="survey-card" key={survey.id}>
              <div className="survey-card-top">
                <div>
                  <h3 className="survey-card-title">{survey.title}</h3>
                  {survey.description ? (
                    <p className="survey-card-copy">{survey.description}</p>
                  ) : null}
                </div>
                <span
                  className={`survey-status ${survey.is_active ? 'is-on' : 'is-off'}`}
                >
                  {survey.is_active ? 'Активен' : 'Скрыт'}
                </span>
              </div>
              <div className="survey-card-meta">
                <span className="survey-chip">{categoryLabel(survey.category)}</span>
                <span className="survey-chip">
                  {survey.questionCount}{' '}
                  {survey.questionCount === 1
                    ? 'вопрос'
                    : survey.questionCount < 5
                      ? 'вопроса'
                      : 'вопросов'}
                </span>
                <span className="survey-chip">{formatSurveyDate(survey.created_at)}</span>
              </div>
              <div className="survey-card-actions">
                <a
                  className="dashboard-btn"
                  href={`/surveys/${survey.id}`}
                >
                  Открыть
                </a>
                <button
                  className="dashboard-btn dashboard-btn--ghost"
                  type="button"
                  disabled={busyId === survey.id}
                  onClick={() => handleDelete(survey)}
                >
                  Удалить
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

    </SurveyShell>
  )
}
