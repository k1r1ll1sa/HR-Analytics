import { useEffect, useState } from 'react'
import { ArrowRight, Building2, CheckCircle2, UserRound } from 'lucide-react'
import {
  RegistrationApiError,
  registerCompany,
  registerEmployee,
  saveProfile,
  type RegisterFieldErrors,
  type RegisterFieldName,
  type RegisterResponse,
} from '../api/auth'
import { AuthLayout } from './AuthLayout'
import { PasswordField, TextField } from './FormFields'

type RegistrationType = 'company' | 'employee'

function getValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? '').trim()
}

function getRawValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? '')
}

const namePartPattern = /^[А-Яа-яЁёA-Za-z-]+$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const innPattern = /^\d{10}$|^\d{12}$/
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const specialCharacterPattern = /[#^%@!$&*()_+\-=[\]{};':"\\|,.<>/?]/
const simpleNumberSequencePattern = /(012|123|234|345|456|567|678|789|890)/
const simpleLetterSequencePattern =
  /(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i
const forbiddenPasswordPatterns = [
  /^1234567890/i,
  /^qwerty/i,
  /^password/i,
  /^admin/i,
  /^1111111111/i,
  /^0000000000/i,
  /^abcdefghij/i,
]

function validatePassword(password: string) {
  if (!password) {
    return 'Введите пароль'
  }
  if (password.length < 10) {
    return 'Пароль должен содержать минимум 10 символов'
  }
  if (!specialCharacterPattern.test(password)) {
    return 'Пароль должен содержать хотя бы один специальный символ (!@#$% и пр.)'
  }
  if (forbiddenPasswordPatterns.some((pattern) => pattern.test(password))) {
    return 'Пароль содержит примитивную комбинацию (11111, qwerty или др.)'
  }
  if (simpleNumberSequencePattern.test(password)) {
    return 'Пароль содержит простую числовую последовательность'
  }
  if (simpleLetterSequencePattern.test(password)) {
    return 'Пароль содержит простую буквенную последовательность'
  }

  return ''
}

function validateRegistration(
  formData: FormData,
  registrationType: RegistrationType,
) {
  const errors: RegisterFieldErrors = {}
  const fullName = getValue(formData, 'full_name')
  const email = getValue(formData, 'email')
  const password = getRawValue(formData, 'password')
  const passwordConfirmation = getRawValue(
    formData,
    'password_confirmation',
  )

  if (registrationType === 'company') {
    const companyName = getValue(formData, 'company_name')
    const inn = getValue(formData, 'inn')

    if (!companyName) {
      errors.company_name = 'Введите название компании'
    }
    if (inn && !innPattern.test(inn)) {
      errors.inn = 'ИНН должен содержать 10 или 12 цифр'
    }
  } else {
    const companyId = getValue(formData, 'company_id')
    const departmentId = getValue(formData, 'department_id')

    if (!companyId) {
      errors.company_id = 'Введите ID компании'
    } else if (!uuidPattern.test(companyId)) {
      errors.company_id = 'Введите корректный UUID компании'
    }
    if (!departmentId) {
      errors.department_id = 'Введите ID отдела'
    } else if (!uuidPattern.test(departmentId)) {
      errors.department_id = 'Введите корректный UUID отдела'
    }
  }

  if (!fullName) {
    errors.full_name = 'Введите фамилию и имя'
  } else {
    const nameParts = fullName.split(/\s+/)
    if (nameParts.length < 2) {
      errors.full_name = 'Укажите как минимум фамилию и имя'
    } else if (nameParts.some((part) => !namePartPattern.test(part))) {
      errors.full_name =
        'ФИО может содержать только буквы, пробелы и дефисы'
    }
  }

  if (!email) {
    errors.email = 'Введите электронную почту'
  } else if (!emailPattern.test(email)) {
    errors.email = 'Введите корректный адрес электронной почты'
  }

  const passwordError = validatePassword(password)
  if (passwordError) {
    errors.password = passwordError
  }

  if (!passwordConfirmation) {
    errors.password_confirmation = 'Повторите пароль'
  } else if (password !== passwordConfirmation) {
    errors.password_confirmation = 'Пароли не совпадают'
  }

  if (formData.get('agreement') !== 'on') {
    errors.agreement = 'Необходимо принять условия использования'
  }

  return errors
}

export default function RegisterPage() {
  const [registrationType, setRegistrationType] =
    useState<RegistrationType>('company')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<RegisterFieldErrors>({})
  const [result, setResult] = useState<RegisterResponse | null>(null)

  useEffect(() => {
    document.title = 'Регистрация — HR Analytics'
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.currentTarget)
    const validationErrors = validateRegistration(formData, registrationType)

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors)
      return
    }

    setFieldErrors({})
    setIsSubmitting(true)
    const password = getRawValue(formData, 'password')

    try {
      const response =
        registrationType === 'company'
          ? await registerCompany({
              company: {
                name: getValue(formData, 'company_name'),
                inn: getValue(formData, 'inn') || undefined,
                description:
                  getValue(formData, 'company_description') || undefined,
              },
              owner: {
                full_name: getValue(formData, 'full_name'),
                email: getValue(formData, 'email'),
                password,
              },
            })
          : await registerEmployee({
              employee: {
                full_name: getValue(formData, 'full_name'),
                email: getValue(formData, 'email'),
                password,
              },
              company_id: getValue(formData, 'company_id'),
              department_id: getValue(formData, 'department_id'),
            })

      setResult(response)
      saveProfile(
        {
          userId: response.user.id,
          email: response.user.email,
          fullName: response.user.full_name,
          role: response.user.role,
          companyId: response.company?.id ?? null,
          companyName: response.company?.name ?? '',
          companyInn: response.company?.inn ?? '',
        },
        true,
      )
    } catch (requestError) {
      if (requestError instanceof RegistrationApiError) {
        setFieldErrors(requestError.fieldErrors)
        if (Object.keys(requestError.fieldErrors).length === 0) {
          setError(requestError.message)
        }
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Не удалось выполнить регистрацию',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearFieldError = (field: RegisterFieldName) => {
    setError('')
    setFieldErrors((current) => {
      if (!current[field]) {
        return current
      }

      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const changeRegistrationType = (type: RegistrationType) => {
    setRegistrationType(type)
    setError('')
    setFieldErrors({})
  }

  if (result) {
    return (
      <AuthLayout
        eyebrow="Регистрация завершена"
        title="Добро пожаловать!"
        description={result.message}
        footer={
          <p>
            Уже зарегистрированы? <a href="/login">Войти</a>
          </p>
        }
      >
        <div className="success-message">
          <CheckCircle2 size={32} />
          <div>
            <strong>{result.user.full_name}</strong>
            <span>{result.user.email}</span>
            {result.company && <span>{result.company.name}</span>}
          </div>
        </div>
        <a className="submit-button" href="/login">
          Перейти ко входу <ArrowRight size={18} />
        </a>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Создание аккаунта"
      title="Регистрация"
      description="Выберите подходящий вариант и заполните данные."
      footer={
        <p>
          Уже есть аккаунт? <a href="/login">Войти</a>
        </p>
      }
    >
      <div className="registration-tabs" role="tablist">
        <button
          className={registrationType === 'company' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={registrationType === 'company'}
          onClick={() => changeRegistrationType('company')}
        >
          <Building2 size={18} />
          Компания
        </button>
        <button
          className={registrationType === 'employee' ? 'active' : ''}
          type="button"
          role="tab"
          aria-selected={registrationType === 'employee'}
          onClick={() => changeRegistrationType('employee')}
        >
          <UserRound size={18} />
          Сотрудник
        </button>
      </div>

      <form
        key={registrationType}
        className="auth-form"
        noValidate
        onSubmit={handleSubmit}
      >
        {registrationType === 'company' ? (
          <fieldset>
            <legend>Данные компании</legend>
            <TextField
              id="company-name"
              name="company_name"
              label="Название компании"
              placeholder="Например, Альфа"
              autoComplete="organization"
              error={fieldErrors.company_name}
              onChange={() => clearFieldError('company_name')}
              required
            />
            <TextField
              id="inn"
              name="inn"
              label="ИНН"
              placeholder="10 или 12 цифр"
              inputMode="numeric"
              hint="Необязательное поле"
              error={fieldErrors.inn}
              onChange={() => clearFieldError('inn')}
            />
            <TextField
              id="company-description"
              name="company_description"
              label="Описание"
              placeholder="Коротко о компании"
              hint="Необязательное поле"
            />
          </fieldset>
        ) : (
          <fieldset>
            <legend>Компания</legend>
            <TextField
              id="company-id"
              name="company_id"
              label="ID компании"
              placeholder="UUID компании"
              error={fieldErrors.company_id}
              onChange={() => clearFieldError('company_id')}
              required
            />
            <TextField
              id="department-id"
              name="department_id"
              label="ID отдела"
              placeholder="UUID отдела"
              error={fieldErrors.department_id}
              onChange={() => clearFieldError('department_id')}
              required
            />
          </fieldset>
        )}

        <fieldset>
          <legend>
            {registrationType === 'company'
              ? 'Данные владельца'
              : 'Личные данные'}
          </legend>
          <TextField
            id="full-name"
            name="full_name"
            label="Фамилия и имя"
            placeholder="Иван Иванов"
            autoComplete="name"
            error={fieldErrors.full_name}
            onChange={() => clearFieldError('full_name')}
            required
          />
          <TextField
            id="email"
            name="email"
            type="email"
            label="Электронная почта"
            placeholder="name@company.ru"
            autoComplete="email"
            error={fieldErrors.email}
            onChange={() => clearFieldError('email')}
            required
          />
          <PasswordField
            id="password"
            name="password"
            label="Пароль"
            placeholder="Минимум 10 символов"
            autoComplete="new-password"
            hint="Используйте специальный символ и избегайте простых последовательностей"
            error={fieldErrors.password}
            onChange={() => clearFieldError('password')}
            required
          />
          <PasswordField
            id="password-confirmation"
            name="password_confirmation"
            label="Повторите пароль"
            placeholder="Введите пароль ещё раз"
            autoComplete="new-password"
            error={fieldErrors.password_confirmation}
            onChange={() => clearFieldError('password_confirmation')}
            required
          />
        </fieldset>

        <label
          className={`agreement ${fieldErrors.agreement ? 'agreement-invalid' : ''}`}
        >
          <input
            type="checkbox"
            name="agreement"
            aria-invalid={Boolean(fieldErrors.agreement)}
            onChange={() => clearFieldError('agreement')}
          />
          <span>
            Я принимаю условия использования и политику конфиденциальности
          </span>
          {fieldErrors.agreement && (
            <small className="field-error">{fieldErrors.agreement}</small>
          )}
        </label>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Создаём аккаунт…' : 'Создать аккаунт'}
          {!isSubmitting && <ArrowRight size={18} />}
        </button>
      </form>
    </AuthLayout>
  )
}
