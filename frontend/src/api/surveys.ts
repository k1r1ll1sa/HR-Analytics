import { getAuthToken } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''

export type QuestionType = 'slider' | 'checkbox' | 'text' | 'radio'

export type SurveyCategory =
  | 'leadership'
  | 'hard_skills'
  | 'communication'
  | 'soft_skills'
  | 'other'

export interface SurveyQuestionPayload {
  question_text: string
  question_type: QuestionType
  order_index?: number | null
  is_required?: boolean
  options_json?: string[] | null
}

export interface SurveyCreatePayload {
  title: string
  description?: string | null
  category?: SurveyCategory | null
  questions: SurveyQuestionPayload[]
}

export interface SurveyUpdatePayload {
  title?: string
  description?: string | null
  category?: SurveyCategory | null
  is_active?: boolean
}

export interface SurveyQuestionDto {
  id: string
  survey_id: string
  question_text: string
  question_type: QuestionType
  order_index: number | null
  is_required: boolean
  options_json: string[] | null
}

export interface SurveyDto {
  id: string
  company_id: string
  title: string
  description: string | null
  category: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
  questions: SurveyQuestionDto[]
}

export class SurveyApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SurveyApiError'
  }
}

function authHeaders() {
  const token = getAuthToken()

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function surveyFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, init)
  } catch {
    throw new SurveyApiError(
      'Не удалось связаться с сервером. Запустите бэкенд на http://127.0.0.1:8000.',
    )
  }
}

async function readError(response: Response) {
  const result = await response.json().catch(() => null)
  const detail = result?.detail

  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item?.msg === 'string') {
          return item.msg
        }

        if (typeof item === 'string') {
          return item
        }

        return ''
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join('. ')
    }
  }

  if (response.status === 401) {
    return 'Нужно войти в аккаунт'
  }

  if (response.status === 403) {
    return 'Недостаточно прав для управления опросниками'
  }

  if (response.status === 404) {
    return 'Опросник не найден'
  }

  if (response.status >= 500) {
    return 'Сервер недоступен. Проверьте, что бэкенд запущен на порту 8000.'
  }

  return 'Не удалось выполнить запрос к опросникам'
}

function surveysUrl(companyId: string) {
  return `${API_BASE_URL}/api/v1/companies/${companyId}/surveys/`
}

function surveyUrl(companyId: string, surveyId: string) {
  return `${API_BASE_URL}/api/v1/companies/${companyId}/surveys/${surveyId}`
}

export async function createSurvey(
  companyId: string,
  payload: SurveyCreatePayload,
): Promise<SurveyDto> {
  const response = await surveyFetch(surveysUrl(companyId), {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new SurveyApiError(await readError(response))
  }

  return (await response.json()) as SurveyDto
}

export async function getSurvey(
  companyId: string,
  surveyId: string,
): Promise<SurveyDto> {
  const response = await surveyFetch(surveyUrl(companyId, surveyId), {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new SurveyApiError(await readError(response))
  }

  return (await response.json()) as SurveyDto
}

export async function updateSurvey(
  companyId: string,
  surveyId: string,
  payload: SurveyUpdatePayload,
): Promise<SurveyDto> {
  const response = await surveyFetch(surveyUrl(companyId, surveyId), {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  if (response.ok) {
    const dto = (await response.json()) as SurveyDto

    if (Array.isArray(dto.questions)) {
      return dto
    }

    return getSurvey(companyId, surveyId)
  }

  if (response.status >= 500) {
    try {
      return await getSurvey(companyId, surveyId)
    } catch {
      throw new SurveyApiError(await readError(response))
    }
  }

  throw new SurveyApiError(await readError(response))
}

export async function deleteSurvey(companyId: string, surveyId: string) {
  const response = await surveyFetch(surveyUrl(companyId, surveyId), {
    method: 'DELETE',
    headers: authHeaders(),
  })

  if (!response.ok && response.status !== 204) {
    throw new SurveyApiError(await readError(response))
  }
}
