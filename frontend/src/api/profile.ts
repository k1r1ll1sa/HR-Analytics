import {
  getAuthToken,
  persistCurrentProfile,
  getProfile,
  type StoredProfile,
} from './auth'

const API_BASE_URL = import.meta.env.VITE_API_URL ?? ''
const PROFILE_PATH = '/api/v1/users/me/profile'
const AVATAR_SIZE = 256
const AVATAR_QUALITY = 0.82

export class ProfileApiError extends Error {
  status: number

  constructor(message: string, status = 0) {
    super(message)
    this.name = 'ProfileApiError'
    this.status = status
  }
}

export interface UserProfile {
  userId: string
  email: string
  fullName: string
  phone: string
  photo: string
  telegram: string
  city: string
  about: string
  notifyByEmail: boolean
  role: string
  companyId: string | null
  companyName: string
  position: string
  departmentNames: string[]
}

export interface ProfileUpdatePayload {
  full_name: string
  phone: string
  telegram: string
  city: string
  about: string
  notify_by_email: boolean
  position: string
  avatar_url?: string
}

interface ProfileResponseDto {
  id: string
  email: string
  full_name?: string | null
  phone?: string | null
  avatar_url?: string | null
  telegram?: string | null
  city?: string | null
  about?: string | null
  notify_by_email?: boolean
  role: string
  company_id?: string | null
  company_name?: string | null
  position?: string | null
  department_names?: string[]
}

function authHeaders() {
  const token = getAuthToken()

  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function mapProfile(dto: ProfileResponseDto): UserProfile {
  return {
    userId: text(dto.id),
    email: text(dto.email),
    fullName: text(dto.full_name),
    phone: text(dto.phone),
    photo: text(dto.avatar_url),
    telegram: text(dto.telegram),
    city: text(dto.city),
    about: text(dto.about),
    notifyByEmail: dto.notify_by_email !== false,
    role: text(dto.role),
    companyId: typeof dto.company_id === 'string' ? dto.company_id : null,
    companyName: text(dto.company_name),
    position: text(dto.position),
    departmentNames: Array.isArray(dto.department_names)
      ? dto.department_names.filter(
          (name): name is string =>
            typeof name === 'string' && Boolean(name.trim()),
        )
      : [],
  }
}

export function toStoredProfile(
  profile: UserProfile,
  previous: StoredProfile | null = getProfile(),
): StoredProfile {
  return {
    userId: profile.userId,
    email: profile.email,
    fullName: profile.fullName,
    role: profile.role,
    companyId: profile.companyId,
    companyName: profile.companyName,
    companyInn: previous?.companyInn ?? '',
    phone: profile.phone,
    photo: profile.photo,
    position: profile.position,
    departmentNames: profile.departmentNames,
    city: profile.city,
    telegram: profile.telegram,
    about: profile.about,
    notifyByEmail: profile.notifyByEmail,
  }
}

export function syncSessionProfile(profile: UserProfile) {
  persistCurrentProfile(toStoredProfile(profile))
}

export async function fileToAvatarUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Выберите файл изображения')
  }

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image()
    const url = URL.createObjectURL(file)

    next.onload = () => {
      URL.revokeObjectURL(url)
      resolve(next)
    }

    next.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Не удалось загрузить фото'))
    }

    next.src = url
  })

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_SIZE
  canvas.height = AVATAR_SIZE
  const context = canvas.getContext('2d')

  if (!context) {
    throw new Error('Не удалось загрузить фото')
  }

  const side = Math.min(image.width, image.height)
  const sx = (image.width - side) / 2
  const sy = (image.height - side) / 2
  context.drawImage(image, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
  return canvas.toDataURL('image/jpeg', AVATAR_QUALITY)
}

export async function fitAvatarUrl(photo: string): Promise<string> {
  return photo
}

function messageFromDetail(detail: unknown, status: number) {
  if (typeof detail === 'string') {
    return detail
  }

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item?.msg === 'string') {
          return item.msg.replace(/^Value error,\s*/i, '')
        }

        return typeof item === 'string' ? item : ''
      })
      .filter(Boolean)

    if (messages.length > 0) {
      return messages.join('. ')
    }
  }

  if (status === 401) {
    return 'Нужно войти в аккаунт'
  }

  if (status === 404) {
    return 'Профиль не найден'
  }

  if (status >= 500) {
    return 'Сервер недоступен. Попробуйте позже.'
  }

  return 'Не удалось обработать запрос профиля'
}

async function readError(response: Response) {
  const result = await response.json().catch(() => null)
  const detail =
    result && typeof result === 'object' && 'detail' in result
      ? (result as { detail: unknown }).detail
      : null

  return messageFromDetail(detail, response.status)
}

async function profileFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, init)
  } catch {
    throw new ProfileApiError(
      'Не удалось связаться с сервером. Запустите бэкенд на http://127.0.0.1:8000.',
    )
  }
}

export async function getMyProfile(): Promise<UserProfile> {
  const response = await profileFetch(`${API_BASE_URL}${PROFILE_PATH}`, {
    method: 'GET',
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new ProfileApiError(await readError(response), response.status)
  }

  return mapProfile((await response.json()) as ProfileResponseDto)
}

export async function updateMyProfile(
  payload: ProfileUpdatePayload,
): Promise<UserProfile> {
  const response = await profileFetch(`${API_BASE_URL}${PROFILE_PATH}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(payload),
  })

  const result = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ProfileApiError(
      messageFromDetail(
        result && typeof result === 'object' && 'detail' in result
          ? (result as { detail: unknown }).detail
          : null,
        response.status,
      ),
      response.status,
    )
  }

  const profile = result?.profile as ProfileResponseDto | undefined

  if (!profile) {
    throw new ProfileApiError('Сервер не вернул обновлённый профиль')
  }

  return mapProfile(profile)
}
