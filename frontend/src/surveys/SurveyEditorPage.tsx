import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import {
  clearAuthToken,
  clearProfile,
  getProfile,
  type StoredProfile,
} from '../api/auth'
import {
  createSurvey,
  getSurvey,
  SurveyApiError,
  updateSurvey,
  type QuestionType,
  type SurveyCategory,
  type SurveyDto,
  type SurveyQuestionPayload,
} from '../api/surveys'
import { createId, roleLabels } from '../dashboard/dashboardUtils'
import { SurveyShell } from './SurveyShell'
import { upsertSurvey } from './surveyStorage'
import {
  needsOptions,
  questionTypeLabel,
  questionTypes,
  surveyCategories,
} from './surveyUtils'

interface SurveyEditorPageProps {
  surveyId?: string
}

interface QuestionDraft {
  key: string
  question_text: string
  question_type: QuestionType
  is_required: boolean
  options: string[]
}

function emptyQuestion(): QuestionDraft {
  return {
    key: createId(),
    question_text: '',
    question_type: 'slider',
    is_required: true,
    options: ['', ''],
  }
}

export default function SurveyEditorPage({ surveyId }: SurveyEditorPageProps) {
  const isCreate = !surveyId
  const [profile] = useState<StoredProfile | null>(getProfile)
  const companyId = profile?.companyId ?? null
  const [survey, setSurvey] = useState<SurveyDto | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<SurveyCategory | ''>('')
  const [isActive, setIsActive] = useState(true)
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(!isCreate)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    document.title = isCreate
      ? 'Новый опросник — HR Analytics'
      : 'Опросник — HR Analytics'
  }, [isCreate])

  useEffect(() => {
    if (!surveyId || !companyId) {
      if (!companyId) {
        setError('Не удалось определить компанию')
        setIsLoading(false)
      }

      return
    }

    let cancelled = false

    getSurvey(companyId, surveyId)
      .then((result) => {
        if (cancelled) {
          return
        }

        setSurvey(result)
        setTitle(result.title)
        setDescription(result.description ?? '')
        setCategory((result.category as SurveyCategory) || '')
        setIsActive(result.is_active)
        upsertSurvey(companyId, {
          id: result.id,
          title: result.title,
          description: result.description,
          category: result.category,
          is_active: result.is_active,
          created_at: result.created_at,
          questionCount: result.questions.length,
        })
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(
            caught instanceof SurveyApiError
              ? caught.message
              : 'Не удалось загрузить опросник',
          )
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [companyId, surveyId])

  const sortedQuestions = useMemo(() => {
    if (!survey) {
      return []
    }

    return [...survey.questions].sort(
      (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0),
    )
  }, [survey])

  const handleLogout = () => {
    clearAuthToken()
    clearProfile()
  }

  const updateQuestion = (key: string, patch: Partial<QuestionDraft>) => {
    setQuestions((current) =>
      current.map((question) =>
        question.key === key ? { ...question, ...patch } : question,
      ),
    )
  }

  const requireCompanyId = () => {
    if (!companyId) {
      throw new Error('Не удалось определить компанию')
    }

    return companyId
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setError('Введите название опросника')
      return
    }

    const payloadQuestions: SurveyQuestionPayload[] = []

    for (const [index, question] of questions.entries()) {
      const questionText = question.question_text.trim()

      if (!questionText) {
        setError(`Заполните текст вопроса ${index + 1}`)
        return
      }

      let options_json: string[] | null = null

      if (needsOptions(question.question_type)) {
        options_json = question.options.map((option) => option.trim()).filter(Boolean)

        if (options_json.length < 2) {
          setError(`У вопроса ${index + 1} должно быть минимум два варианта ответа`)
          return
        }
      }

      payloadQuestions.push({
        question_text: questionText,
        question_type: question.question_type,
        order_index: index,
        is_required: question.is_required,
        ...(options_json ? { options_json } : {}),
      })
    }

    if (payloadQuestions.length === 0) {
      setError('Добавьте хотя бы один вопрос')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const created = await createSurvey(requireCompanyId(), {
        title: trimmedTitle,
        description: description.trim() || null,
        category: category || null,
        questions: payloadQuestions,
      })

      upsertSurvey(companyId, {
        id: created.id,
        title: created.title,
        description: created.description,
        category: created.category,
        is_active: created.is_active,
        created_at: created.created_at,
        questionCount: created.questions.length,
      })

      window.location.replace(`/surveys/${created.id}`)
    } catch (caught) {
      setError(
        caught instanceof SurveyApiError
          ? caught.message
          : 'Не удалось создать опросник',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!surveyId) {
      return
    }

    const trimmedTitle = title.trim()

    if (!trimmedTitle) {
      setError('Введите название опросника')
      return
    }

    setIsSaving(true)
    setError('')

    try {
      const updated = await updateSurvey(requireCompanyId(), surveyId, {
        title: trimmedTitle,
        description: description.trim() || null,
        category: category || null,
        is_active: isActive,
      })

      setSurvey(updated)
      upsertSurvey(companyId, {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        category: updated.category,
        is_active: updated.is_active,
        created_at: updated.created_at,
        questionCount: updated.questions.length,
      })
    } catch (caught) {
      setError(
        caught instanceof SurveyApiError
          ? caught.message
          : 'Не удалось сохранить опросник',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SurveyShell
      userName={profile?.fullName || profile?.email || 'Пользователь'}
      companyName={profile?.companyName ?? ''}
      roleLabel={profile ? roleLabels[profile.role] ?? profile.role : '—'}
      title={isCreate ? 'Новый опросник' : survey?.title || 'Опросник'}
      description={
        isCreate
          ? 'Название, категория и набор вопросов для оценки сотрудников.'
          : 'Параметры опросника. Состав вопросов задаётся при создании.'
      }
      active="editor"
      onLogout={handleLogout}
    >
      <div className="survey-toolbar">
        <div>
          <h2>{isCreate ? 'Конструктор опросника' : 'Карточка опросника'}</h2>
          <p>
            {isCreate
              ? 'Добавьте хотя бы один вопрос — шкалу, варианты или свободный ответ.'
              : 'Можно обновить название, категорию и видимость опросника.'}
          </p>
        </div>
        <a className="dashboard-btn dashboard-btn--ghost" href="/surveys">
          <ArrowLeft size={15} />
          К опросникам
        </a>
      </div>

      {isLoading ? (
        <p className="survey-hint">Загрузка опросника…</p>
      ) : (
        <form
          className="survey-editor"
          onSubmit={isCreate ? handleCreate : handleUpdate}
        >
          {error && <p className="survey-error">{error}</p>}

          <section className="survey-section">
            <div className="survey-section-head">
              <div>
                <h3>Параметры</h3>
                <p>Как опросник будет отображаться в списке.</p>
              </div>
            </div>

            <div className="dashboard-form-row">
              <div className="dashboard-field">
                <label htmlFor="survey_title">Название</label>
                <input
                  id="survey_title"
                  placeholder="Например, Оценка лидерства"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </div>
              <div className="dashboard-field">
                <label htmlFor="survey_category">Категория</label>
                <select
                  id="survey_category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as SurveyCategory | '')
                  }
                >
                  <option value="">Без категории</option>
                  {surveyCategories.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="dashboard-field">
              <label htmlFor="survey_description">Описание</label>
              <textarea
                id="survey_description"
                placeholder="Коротко, для чего этот опрос и кому его назначать"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>

            {!isCreate && (
              <div className="dashboard-field">
                <span>Видимость</span>
                <label className="survey-check" htmlFor="survey_active">
                  <input
                    id="survey_active"
                    type="checkbox"
                    checked={isActive}
                    onChange={(event) => setIsActive(event.target.checked)}
                  />
                  Опросник доступен для назначения
                </label>
              </div>
            )}
          </section>

          {isCreate && (
            <section className="survey-section">
              <div className="survey-section-head">
                <div>
                  <h3>Вопросы</h3>
                  <p>Порядок карточек — порядок в опросе.</p>
                </div>
                <button
                  className="dashboard-btn dashboard-btn--ghost"
                  type="button"
                  onClick={() =>
                    setQuestions((current) => [...current, emptyQuestion()])
                  }
                >
                  <Plus size={16} />
                  Вопрос
                </button>
              </div>

              <div className="survey-question-list">
                {questions.map((question, index) => (
                  <div className="survey-question" key={question.key}>
                    <div className="survey-question-head">
                      <div className="survey-question-index">
                        <span>{index + 1}</span>
                        Вопрос
                      </div>
                      {questions.length > 1 && (
                        <button
                          className="dashboard-btn dashboard-btn--ghost"
                          type="button"
                          onClick={() =>
                            setQuestions((current) =>
                              current.filter((item) => item.key !== question.key),
                            )
                          }
                        >
                          <Trash2 size={15} />
                          Удалить
                        </button>
                      )}
                    </div>

                    <div className="dashboard-field">
                      <label htmlFor={`question_text_${question.key}`}>
                        Формулировка
                      </label>
                      <textarea
                        id={`question_text_${question.key}`}
                        placeholder="Как сотрудник проявляет инициативу в команде?"
                        value={question.question_text}
                        onChange={(event) =>
                          updateQuestion(question.key, {
                            question_text: event.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="dashboard-form-row survey-question-meta">
                      <div className="dashboard-field">
                        <label htmlFor={`question_type_${question.key}`}>Тип ответа</label>
                        <select
                          id={`question_type_${question.key}`}
                          value={question.question_type}
                          onChange={(event) =>
                            updateQuestion(question.key, {
                              question_type: event.target.value as QuestionType,
                            })
                          }
                        >
                          {questionTypes.map((item) => (
                            <option key={item.value} value={item.value}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="dashboard-field">
                        <span>Обязательность</span>
                        <label className="survey-check" htmlFor={`question_required_${question.key}`}>
                          <input
                            id={`question_required_${question.key}`}
                            type="checkbox"
                            checked={question.is_required}
                            onChange={(event) =>
                              updateQuestion(question.key, {
                                is_required: event.target.checked,
                              })
                            }
                          />
                          Обязательный вопрос
                        </label>
                      </div>
                    </div>

                    {needsOptions(question.question_type) && (
                      <div className="survey-question-options">
                        {question.options.map((option, optionIndex) => (
                          <div className="survey-option-row" key={optionIndex}>
                            <div className="dashboard-field">
                              <label htmlFor={`${question.key}_option_${optionIndex}`}>
                                Вариант {optionIndex + 1}
                              </label>
                              <input
                                id={`${question.key}_option_${optionIndex}`}
                                placeholder="Текст варианта"
                                value={option}
                                onChange={(event) => {
                                  const next = [...question.options]
                                  next[optionIndex] = event.target.value
                                  updateQuestion(question.key, { options: next })
                                }}
                              />
                            </div>
                            {question.options.length > 2 && (
                              <button
                                className="dashboard-btn dashboard-btn--ghost"
                                type="button"
                                onClick={() =>
                                  updateQuestion(question.key, {
                                    options: question.options.filter(
                                      (_, itemIndex) => itemIndex !== optionIndex,
                                    ),
                                  })
                                }
                              >
                                Убрать
                              </button>
                            )}
                          </div>
                        ))}
                        <button
                          className="dashboard-btn dashboard-btn--ghost"
                          type="button"
                          onClick={() =>
                            updateQuestion(question.key, {
                              options: [...question.options, ''],
                            })
                          }
                        >
                          Добавить вариант
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {!isCreate && (
            <section className="survey-section">
              <div className="survey-section-head">
                <div>
                  <h3>Состав вопросов</h3>
                  <p>{sortedQuestions.length} в опроснике</p>
                </div>
              </div>
              <div className="survey-readonly">
                {sortedQuestions.map((question, index) => (
                  <div className="survey-readonly-item" key={question.id}>
                    <div className="survey-question-index">
                      <span>{index + 1}</span>
                      {questionTypeLabel(question.question_type)}
                      {question.is_required ? '' : ' · необязательный'}
                    </div>
                    <p>{question.question_text}</p>
                    {question.options_json && question.options_json.length > 0 && (
                      <div className="survey-readonly-meta">
                        {question.options_json.map((option) => (
                          <span className="survey-chip" key={option}>
                            {option}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="survey-editor-actions">
            <button
              className="dashboard-btn"
              type="submit"
              disabled={isSaving}
              aria-busy={isSaving}
            >
              {isCreate ? 'Сохранить опросник' : 'Сохранить изменения'}
            </button>
          </div>
        </form>
      )}
    </SurveyShell>
  )
}
