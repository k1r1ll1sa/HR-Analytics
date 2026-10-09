import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  getProfile,
  LoginApiError,
  login,
  readTokenClaims,
  saveProfile,
  setAuthToken,
} from '../api/auth'
import { AuthLayout } from './AuthLayout'
import { PasswordField, TextField } from './FormFields'

interface LoginFieldErrors {
  email?: string
  password?: string
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Вход — HR Analytics'
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email') ?? '').trim()
    const password = String(formData.get('password') ?? '')
    const remember = formData.get('remember') === 'on'
    const errors: LoginFieldErrors = {}

    if (!email) {
      errors.email = 'Введите электронную почту'
    } else if (!emailPattern.test(email)) {
      errors.email = 'Введите корректный адрес электронной почты'
    }

    if (!password) {
      errors.password = 'Введите пароль'
    } else if (password.length < 10) {
      errors.password = 'Пароль должен содержать минимум 10 символов'
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setIsSubmitting(true)

    try {
      const token = await login({ email, password })
      const claims = readTokenClaims(token.access_token)
      const previous = getProfile()
      const known =
        previous !== null && previous.email === email ? previous : null

      setAuthToken(token.access_token, remember)
      saveProfile(
        {
          userId: claims.userId,
          email,
          fullName: known?.fullName ?? '',
          role: claims.role,
          companyId: known?.companyId ?? null,
          companyName: known?.companyName ?? '',
          companyInn: known?.companyInn ?? '',
        },
        remember,
      )
      window.location.replace('/dashboard')
    } catch (requestError) {
      if (requestError instanceof LoginApiError) {
        setFieldErrors(requestError.fieldErrors)
        if (Object.keys(requestError.fieldErrors).length === 0) {
          setError(requestError.message)
        }
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Не удалось выполнить вход',
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const clearFieldError = (field: keyof LoginFieldErrors) => {
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

  return (
    <AuthLayout
      eyebrow="Вход в систему"
      title="С возвращением"
      description="Введите данные, указанные при регистрации."
      footer={
        <p>
          Нет аккаунта? <a href="/register">Зарегистрироваться</a>
        </p>
      }
    >
      <form className="auth-form" noValidate onSubmit={handleSubmit}>
        <TextField
          id="login-email"
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
          id="login-password"
          name="password"
          label="Пароль"
          placeholder="Введите пароль"
          autoComplete="current-password"
          error={fieldErrors.password}
          onChange={() => clearFieldError('password')}
          required
        />

        <div className="form-options">
          <label>
            <input type="checkbox" name="remember" />
            <span>Запомнить меня</span>
          </label>
          <a href="mailto:hr-analytics@example.com">Забыли пароль?</a>
        </div>

        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}

        <button className="submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Входим…' : 'Войти'}
          {!isSubmitting && <ArrowRight size={18} />}
        </button>
      </form>
    </AuthLayout>
  )
}
