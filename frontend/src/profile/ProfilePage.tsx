import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from 'react'
import { ArrowLeft, Camera } from 'lucide-react'
import {
  clearAuthToken,
  clearProfile,
  hasDashboardAccess,
} from '../api/auth'
import {
  ProfileApiError,
  fileToAvatarUrl,
  fitAvatarUrl,
  getMyProfile,
  syncSessionProfile,
  updateMyProfile,
  type UserProfile,
} from '../api/profile'
import { DashboardHeader } from '../dashboard/DashboardHeader'
import { roleLabels } from '../dashboard/dashboardUtils'
import '../dashboard/CompanyDashboard.css'
import './ProfilePage.css'

const namePartPattern = /^[a-zA-Zа-яА-ЯёЁ-]+$/
const phonePattern = /^\+?[0-9\s()-]{10,20}$/
const telegramPattern = /^@?[a-zA-Z0-9_]{5,32}$/

function initials(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  }

  if (parts[0]) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return email.slice(0, 2).toUpperCase() || 'HR'
}

function displayValue(value: string) {
  return value.trim() || 'Не указано'
}

function FactItem({
  label,
  value,
}: {
  label: string
  value: string | string[]
}) {
  const items = Array.isArray(value) ? value.filter((item) => item.trim()) : null

  return (
    <div>
      <dt>{label}</dt>
      <dd>
        {items ? (
          items.length > 0 ? (
            <ul className="profile-facts-list">
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            'Не указано'
          )
        ) : (
          displayValue(typeof value === 'string' ? value : '')
        )}
      </dd>
    </div>
  )
}

export default function ProfilePage() {
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [photo, setPhoto] = useState('')
  const [position, setPosition] = useState('')
  const [city, setCity] = useState('')
  const [telegram, setTelegram] = useState('')
  const [about, setAbout] = useState('')
  const [notifyByEmail, setNotifyByEmail] = useState(true)
  const [nameError, setNameError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [telegramError, setTelegramError] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')

  const fillProfile = (next: UserProfile) => {
    setProfile(next)
    setFullName(next.fullName)
    setPhone(next.phone)
    setPhoto(next.photo)
    setPosition(next.position)
    setCity(next.city)
    setTelegram(next.telegram)
    setAbout(next.about)
    setNotifyByEmail(next.notifyByEmail)
    syncSessionProfile(next)
  }

  useEffect(() => {
    document.title = 'Профиль — HR Analytics'
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const next = await getMyProfile()

        if (cancelled) {
          return
        }

        fillProfile(next)
      } catch (caught) {
        if (cancelled) {
          return
        }

        if (caught instanceof ProfileApiError && caught.status === 401) {
          clearAuthToken()
          clearProfile()
          window.location.replace('/login')
          return
        }

        setLoadError(
          caught instanceof ProfileApiError
            ? caught.message
            : 'Не удалось загрузить профиль',
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <main className="dashboard">
        <DashboardHeader
          userName="Пользователь"
          companyName=""
          roleLabel="—"
          onLogout={() => {
            clearAuthToken()
            clearProfile()
          }}
        />
        <div className="profile-layout">
          <p className="profile-status">Загрузка профиля…</p>
        </div>
      </main>
    )
  }

  if (!profile) {
    return (
      <main className="dashboard">
        <DashboardHeader
          userName="Пользователь"
          companyName=""
          roleLabel="—"
          onLogout={() => {
            clearAuthToken()
            clearProfile()
          }}
        />
        <div className="profile-layout">
          <p className="dashboard-form-error" role="alert">
            {loadError || 'Не удалось загрузить профиль'}
          </p>
        </div>
      </main>
    )
  }

  const roleLabel = roleLabels[profile.role] ?? profile.role
  const userName = profile.fullName || profile.email || 'Пользователь'
  const backHref = hasDashboardAccess() ? '/dashboard' : '/'
  const departmentsLabel = profile.departmentNames.join(' · ')

  const handleLogout = () => {
    clearAuthToken()
    clearProfile()
  }

  const handleBack = (event: MouseEvent<HTMLAnchorElement>) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    event.preventDefault()

    if (window.history.length > 1) {
      window.history.back()
      return
    }

    window.location.assign(backHref)
  }

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    try {
      const nextPhoto = await fileToAvatarUrl(file)
      setPhoto(nextPhoto)
      setPhotoError('')
      setSaved(false)
    } catch (error) {
      setPhotoError(
        error instanceof Error ? error.message : 'Не удалось загрузить фото',
      )
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaved(false)
    setSaveError('')

    const nextName = fullName.trim()
    const nextPhone = phone.trim()
    const nextTelegram = telegram.trim().replace(/^@/, '')
    const nameParts = nextName.split(/\s+/).filter(Boolean)
    let hasError = false

    if (nameParts.length < 2) {
      setNameError('Укажите как минимум фамилию и имя')
      hasError = true
    } else if (nameParts.some((part) => !namePartPattern.test(part))) {
      setNameError('ФИО может содержать только буквы, пробелы и дефисы')
      hasError = true
    } else {
      setNameError('')
    }

    if (nextPhone && !phonePattern.test(nextPhone)) {
      setPhoneError('Введите корректный телефон')
      hasError = true
    } else {
      setPhoneError('')
    }

    if (nextTelegram && !telegramPattern.test(nextTelegram)) {
      setTelegramError('Введите корректный Telegram, например ivanov_hr')
      hasError = true
    } else {
      setTelegramError('')
    }

    if (hasError) {
      return
    }

    const formattedTelegram = nextTelegram ? `@${nextTelegram}` : ''

    setIsSaving(true)

    try {
      const avatarUrl = await fitAvatarUrl(photo)
      const updated = await updateMyProfile({
        full_name: nextName,
        phone: nextPhone,
        telegram: formattedTelegram,
        city: city.trim(),
        about: about.trim(),
        notify_by_email: notifyByEmail,
        position: position.trim(),
        avatar_url: avatarUrl,
      })
      fillProfile(updated)
      setSaved(true)
    } catch (caught) {
      if (caught instanceof ProfileApiError && caught.status === 401) {
        clearAuthToken()
        clearProfile()
        window.location.replace('/login')
        return
      }

      setSaveError(
        caught instanceof ProfileApiError || caught instanceof Error
          ? caught.message
          : 'Не удалось сохранить профиль',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="dashboard">
      <DashboardHeader
        userName={userName}
        companyName={profile.companyName}
        roleLabel={roleLabel}
        onLogout={handleLogout}
      />

      <div className="profile-layout">
        <a className="profile-back" href={backHref} onClick={handleBack}>
          <ArrowLeft size={16} />
          Назад
        </a>

        <h1>Профиль сотрудника</h1>

        <section className="profile-card profile-identity">
          <button
            type="button"
            className="profile-avatar-button"
            aria-label="Загрузить фото профиля"
            onClick={() => photoInputRef.current?.click()}
          >
            {photo ? (
              <img src={photo} alt="" className="profile-avatar-image" />
            ) : (
              <span className="profile-avatar">{initials(profile.fullName, profile.email)}</span>
            )}
            <span className="profile-avatar-edit">
              <Camera size={14} />
              Фото
            </span>
          </button>
          <div>
            <strong>{userName}</strong>
            <p>
              {roleLabel}
              {profile.position ? ` · ${profile.position}` : ''}
            </p>
            <p>
              {profile.companyName || 'Компания не указана'}
              {departmentsLabel ? ` · ${departmentsLabel}` : ''}
            </p>
            <p>{profile.email}</p>
          </div>
        </section>

        <section className="profile-card" aria-labelledby="profile-info-title">
          <h2 id="profile-info-title">Информация</h2>
          <dl className="profile-facts">
            <FactItem label="ФИО" value={displayValue(profile.fullName)} />
            <FactItem label="Роль" value={roleLabel} />
            <FactItem label="Компания" value={displayValue(profile.companyName)} />
            <FactItem label="Должность" value={profile.position} />
            <FactItem label="Отделы" value={profile.departmentNames} />
            <FactItem label="Электронная почта" value={displayValue(profile.email)} />
            <FactItem label="Телефон" value={profile.phone} />
            <FactItem label="Telegram" value={profile.telegram} />
            <FactItem label="Город" value={profile.city} />
          </dl>
          {profile.about && (
            <div className="profile-about">
              <span>О себе</span>
              <p>{profile.about}</p>
            </div>
          )}
        </section>

        <section className="profile-card" aria-labelledby="profile-settings-title">
          <h2 id="profile-settings-title">Настройки профиля</h2>
          <form className="dashboard-form" onSubmit={handleSubmit} noValidate>
            {saved && (
              <p className="profile-success" role="status">
                Настройки сохранены
              </p>
            )}
            {saveError && (
              <p className="dashboard-form-error" role="alert">
                {saveError}
              </p>
            )}
            {photoError && (
              <p className="dashboard-form-error" role="alert">
                {photoError}
              </p>
            )}

            <input
              ref={photoInputRef}
              className="profile-file"
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
            />

            <p className="profile-section-label">Личные данные</p>
            <div className="dashboard-form-row">
              <div className="dashboard-field">
                <label htmlFor="profile-full-name">ФИО</label>
                <input
                  id="profile-full-name"
                  value={fullName}
                  autoComplete="name"
                  onChange={(event) => {
                    setFullName(event.target.value)
                    setNameError('')
                    setSaved(false)
                  }}
                />
                {nameError && (
                  <p className="dashboard-form-error" role="alert">
                    {nameError}
                  </p>
                )}
              </div>
              <div className="dashboard-field">
                <label htmlFor="profile-role">Роль</label>
                <input
                  id="profile-role"
                  value={roleLabel}
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>

            <p className="profile-section-label">Контакты</p>
            <div className="dashboard-form-row">
              <div className="dashboard-field">
                <label htmlFor="profile-phone">Телефон</label>
                <input
                  id="profile-phone"
                  value={phone}
                  placeholder="+7 900 000-00-00"
                  autoComplete="tel"
                  onChange={(event) => {
                    setPhone(event.target.value)
                    setPhoneError('')
                    setSaved(false)
                  }}
                />
                {phoneError && (
                  <p className="dashboard-form-error" role="alert">
                    {phoneError}
                  </p>
                )}
              </div>
              <div className="dashboard-field">
                <label htmlFor="profile-telegram">Telegram</label>
                <input
                  id="profile-telegram"
                  value={telegram}
                  placeholder="@username"
                  onChange={(event) => {
                    setTelegram(event.target.value)
                    setTelegramError('')
                    setSaved(false)
                  }}
                />
                {telegramError && (
                  <p className="dashboard-form-error" role="alert">
                    {telegramError}
                  </p>
                )}
              </div>
            </div>
            <div className="dashboard-form-row">
              <div className="dashboard-field">
                <label htmlFor="profile-city">Город</label>
                <input
                  id="profile-city"
                  value={city}
                  placeholder="Москва"
                  autoComplete="address-level2"
                  onChange={(event) => {
                    setCity(event.target.value)
                    setSaved(false)
                  }}
                />
              </div>
              <div className="dashboard-field">
                <label htmlFor="profile-email">Электронная почта</label>
                <input
                  id="profile-email"
                  value={profile.email}
                  readOnly
                  aria-readonly="true"
                />
              </div>
            </div>

            <p className="profile-section-label">Работа</p>
            <div className="dashboard-field">
              <label htmlFor="profile-position">Должность</label>
              <input
                id="profile-position"
                value={position}
                placeholder="HR-менеджер"
                onChange={(event) => {
                  setPosition(event.target.value)
                  setSaved(false)
                }}
              />
            </div>
            <div className="dashboard-field">
              <label htmlFor="profile-department">Отделы</label>
              <input
                id="profile-department"
                value={departmentsLabel || 'Не указано'}
                readOnly
                aria-readonly="true"
              />
            </div>

            <div className="dashboard-field">
              <label htmlFor="profile-about">О себе</label>
              <textarea
                id="profile-about"
                rows={4}
                value={about}
                placeholder="Кратко расскажите о себе, зоне ответственности и навыках"
                onChange={(event) => {
                  setAbout(event.target.value)
                  setSaved(false)
                }}
              />
            </div>

            <label className="profile-check">
              <input
                type="checkbox"
                checked={notifyByEmail}
                onChange={(event) => {
                  setNotifyByEmail(event.target.checked)
                  setSaved(false)
                }}
              />
              Получать уведомления на почту
            </label>

            <div className="dashboard-form-actions">
              <button type="submit" className="dashboard-btn" disabled={isSaving}>
                {isSaving ? 'Сохранение…' : 'Сохранить'}
              </button>
              {photo && (
                <button
                  type="button"
                  className="dashboard-btn dashboard-btn--ghost"
                  onClick={() => {
                    setPhoto('')
                    setSaved(false)
                  }}
                >
                  Удалить фото
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  )
}
