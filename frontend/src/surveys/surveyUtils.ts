import type { QuestionType, SurveyCategory } from '../api/surveys'

export const surveyCategories: { value: SurveyCategory; label: string }[] = [
  { value: 'leadership', label: 'Лидерство' },
  { value: 'hard_skills', label: 'Hard skills' },
  { value: 'communication', label: 'Коммуникация' },
  { value: 'soft_skills', label: 'Soft skills' },
  { value: 'other', label: 'Другое' },
]

export const questionTypes: { value: QuestionType; label: string }[] = [
  { value: 'slider', label: 'Шкала' },
  { value: 'radio', label: 'Один вариант' },
  { value: 'checkbox', label: 'Несколько вариантов' },
  { value: 'text', label: 'Текст' },
]

export function categoryLabel(category: string | null) {
  return (
    surveyCategories.find((item) => item.value === category)?.label ??
    category ??
    'Без категории'
  )
}

export function questionTypeLabel(type: string) {
  return questionTypes.find((item) => item.value === type)?.label ?? type
}

export function needsOptions(type: QuestionType) {
  return type === 'radio' || type === 'checkbox'
}

export function formatSurveyDate(value: string) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString('ru-RU')
}
