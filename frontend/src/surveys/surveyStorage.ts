import type { SurveyDto } from '../api/surveys'

export interface SurveyListItem {
  id: string
  title: string
  description: string | null
  category: string | null
  is_active: boolean
  created_at: string
  questionCount: number
}

const SURVEYS_KEY = 'hr_dashboard_surveys'

function keyFor(companyId: string | null) {
  return companyId ? `${SURVEYS_KEY}:${companyId}` : SURVEYS_KEY
}

function readRecord(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null
  }

  return value as Record<string, unknown>
}

function readText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toListItem(value: unknown): SurveyListItem | null {
  const record = readRecord(value)

  if (!record || typeof record.id !== 'string' || !record.id) {
    return null
  }

  return {
    id: record.id,
    title: readText(record.title) || 'Без названия',
    description:
      typeof record.description === 'string' ? record.description : null,
    category: typeof record.category === 'string' ? record.category : null,
    is_active: record.is_active !== false,
    created_at: readText(record.created_at),
    questionCount:
      typeof record.questionCount === 'number' ? record.questionCount : 0,
  }
}

export function toSurveyListItem(survey: SurveyDto): SurveyListItem {
  return {
    id: survey.id,
    title: survey.title,
    description: survey.description,
    category: survey.category,
    is_active: survey.is_active,
    created_at: survey.created_at,
    questionCount: survey.questions?.length ?? 0,
  }
}

export function loadSurveys(companyId: string | null): SurveyListItem[] {
  const raw = localStorage.getItem(keyFor(companyId))

  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed
      .map(toListItem)
      .filter((item): item is SurveyListItem => item !== null)
  } catch {
    return []
  }
}

export function saveSurveys(
  companyId: string | null,
  surveys: SurveyListItem[],
) {
  localStorage.setItem(keyFor(companyId), JSON.stringify(surveys))
}

export function upsertSurvey(
  companyId: string | null,
  survey: SurveyListItem,
) {
  const current = loadSurveys(companyId)
  const next = current.some((item) => item.id === survey.id)
    ? current.map((item) => (item.id === survey.id ? survey : item))
    : [survey, ...current]

  saveSurveys(companyId, next)
  return next
}

export function removeSurvey(companyId: string | null, surveyId: string) {
  const next = loadSurveys(companyId).filter((item) => item.id !== surveyId)
  saveSurveys(companyId, next)
  return next
}
