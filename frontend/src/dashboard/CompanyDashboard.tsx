import { useEffect, useState, type FormEvent } from 'react'
import {
  BookOpen,
  Building2,
  LineChart,
  LogOut,
  Pencil,
  Plus,
  Users,
} from 'lucide-react'
import './CompanyDashboard.css'
import {
  clearAuthToken,
  clearProfile,
  getProfile,
  type StoredProfile,
} from '../api/auth'
import {
  loadAssignments,
  loadCourses,
  loadDepartments,
  saveAssignments,
  saveCourses,
  saveDepartments,
  type AssignmentRow,
  type CourseRow,
  type DepartmentRow,
} from './dashboardStorage'

type Tab = 'structure' | 'courses'

const initialDepartments: DepartmentRow[] = [
  { id: '1', name: 'HR и кадры', head: 'Иванова А.С.', employees: 8 },
  { id: '2', name: 'Разработка', head: 'Петров Д.К.', employees: 24 },
  { id: '3', name: 'Продажи', head: 'Сидорова М.В.', employees: 15 },
  { id: '4', name: 'Маркетинг', head: 'Козлов И.П.', employees: 11 },
]

const initialCourseCatalog: CourseRow[] = [
  { id: 'c1', title: 'Лидерство и обратная связь' },
  { id: 'c2', title: 'Охрана труда — базовый курс' },
  { id: 'c3', title: 'Excel для HR-аналитики' },
]

const initialAssignments: AssignmentRow[] = [
  {
    id: 'a1',
    course: 'Лидерство и обратная связь',
    target: 'Отдел «Разработка»',
    deadline: '15.04.2026',
    status: 'active',
  },
  {
    id: 'a2',
    course: 'Охрана труда — базовый курс',
    target: 'Вся компания',
    deadline: '01.05.2026',
    status: 'active',
  },
  {
    id: 'a3',
    course: 'Excel для HR-аналитики',
    target: 'Отдел «HR и кадры»',
    deadline: '20.03.2026',
    status: 'pending',
  },
]

const roleLabels: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  employee: 'Сотрудник',
}

function createId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID()
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function toDateInputValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${date.getFullYear()}-${month}-${day}`
}

function defaultDeadline() {
  const date = new Date()
  date.setDate(date.getDate() + 30)

  return toDateInputValue(date)
}

function formatDeadline(value: string) {
  const [year, month, day] = value.split('-')

  return `${day}.${month}.${year}`
}

export default function CompanyDashboard() {
  const [tab, setTab] = useState<Tab>('structure')
  const [profile] = useState<StoredProfile | null>(getProfile)
  const [departments, setDepartments] = useState(() =>
    loadDepartments(initialDepartments),
  )
  const [courseCatalog, setCourseCatalog] = useState(() =>
    loadCourses(initialCourseCatalog),
  )
  const [assignments, setAssignments] = useState(() =>
    loadAssignments(initialAssignments),
  )
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [selectedTargetId, setSelectedTargetId] = useState('all')
  const [editingDepartment, setEditingDepartment] =
    useState<DepartmentRow | null>(null)
  const [isDepartmentFormOpen, setIsDepartmentFormOpen] = useState(false)
  const [isCourseFormOpen, setIsCourseFormOpen] = useState(false)
  const [departmentError, setDepartmentError] = useState('')
  const [courseError, setCourseError] = useState('')
  const [assignmentError, setAssignmentError] = useState('')

  useEffect(() => {
    document.title = 'Панель управления — HR Analytics'
  }, [])

  useEffect(() => {
    saveDepartments(departments)
  }, [departments])

  useEffect(() => {
    saveCourses(courseCatalog)
  }, [courseCatalog])

  useEffect(() => {
    saveAssignments(assignments)
  }, [assignments])

  const totalEmployees = departments.reduce((sum, d) => sum + d.employees, 0)

  const activeCourseId = courseCatalog.some(
    (course) => course.id === selectedCourseId,
  )
    ? selectedCourseId
    : courseCatalog[0]?.id ?? ''

  const openDepartmentForm = (department: DepartmentRow | null) => {
    setEditingDepartment(department)
    setIsDepartmentFormOpen(true)
    setDepartmentError('')
  }

  const closeDepartmentForm = () => {
    setIsDepartmentFormOpen(false)
    setEditingDepartment(null)
    setDepartmentError('')
  }

  const handleDepartmentSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('department_name') ?? '').trim()
    const head = String(formData.get('department_head') ?? '').trim()

    if (!name) {
      setDepartmentError('Введите название отдела')
      return
    }

    const isDuplicate = departments.some(
      (department) =>
        department.name.toLowerCase() === name.toLowerCase() &&
        department.id !== editingDepartment?.id,
    )

    if (isDuplicate) {
      setDepartmentError('Отдел с таким названием уже существует')
      return
    }

    if (editingDepartment) {
      setDepartments((current) =>
        current.map((department) =>
          department.id === editingDepartment.id
            ? { ...department, name, head: head || '—' }
            : department,
        ),
      )
    } else {
      setDepartments((current) => [
        ...current,
        { id: createId(), name, head: head || '—', employees: 0 },
      ])
    }

    closeDepartmentForm()
  }

  const handleAddCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const title = String(formData.get('course_title') ?? '').trim()

    if (!title) {
      setCourseError('Введите название курса')
      return
    }

    if (
      courseCatalog.some(
        (course) => course.title.toLowerCase() === title.toLowerCase(),
      )
    ) {
      setCourseError('Такой курс уже есть в каталоге')
      return
    }

    const course = { id: createId(), title }

    setCourseCatalog((current) => [...current, course])
    setSelectedCourseId(course.id)
    setCourseError('')
    setIsCourseFormOpen(false)
  }

  const handleAssignCourse = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const deadline = String(formData.get('assignment_deadline') ?? '')
    const course = courseCatalog.find((item) => item.id === activeCourseId)

    if (!course) {
      setAssignmentError('Выберите курс')
      return
    }

    if (!deadline) {
      setAssignmentError('Укажите срок')
      return
    }

    const department = departments.find(
      (item) => item.id === selectedTargetId,
    )

    const assignment: AssignmentRow = {
      id: createId(),
      course: course.title,
      target: department ? `Отдел «${department.name}»` : 'Вся компания',
      deadline: formatDeadline(deadline),
      status: 'active',
    }

    setAssignments((current) => [assignment, ...current])
    setAssignmentError('')
  }

  const companyName = profile?.companyName || 'Компания не указана'
  const roleLabel = profile ? roleLabels[profile.role] ?? profile.role : '—'

  const handleLogout = () => {
    clearAuthToken()
    clearProfile()
  }

  return (
    <main className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <a className="dashboard-logo" href="/" aria-label="HR Analytics">
            <span className="dashboard-logo-icon">
              <LineChart size={18} />
            </span>
            HR Analytics
          </a>

          <div className="dashboard-header-meta">
            <span className="dashboard-company">{companyName}</span>
            <span className="dashboard-role">{roleLabel}</span>
            <a className="dashboard-exit" href="/login" onClick={handleLogout}>
              <LogOut size={15} />
              Выйти
            </a>
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        <div className="dashboard-intro">
          <h1>Панель управления компанией</h1>
          <p>Редактируйте оргструктуру и назначайте обучение сотрудникам.</p>
        </div>

        <div className="dashboard-stats">
          <div className="dashboard-stat">
            <span>Отделов</span>
            <strong>{departments.length}</strong>
          </div>
          <div className="dashboard-stat">
            <span>Сотрудников</span>
            <strong>{totalEmployees}</strong>
          </div>
          <div className="dashboard-stat">
            <span>Активных назначений</span>
            <strong>{assignments.filter((a) => a.status === 'active').length}</strong>
          </div>
        </div>

        <nav className="dashboard-nav" aria-label="Разделы панели">
          <button
            type="button"
            className={tab === 'structure' ? 'is-active' : ''}
            onClick={() => setTab('structure')}
          >
            <Building2 size={17} />
            Структура
          </button>
          <button
            type="button"
            className={tab === 'courses' ? 'is-active' : ''}
            onClick={() => setTab('courses')}
          >
            <BookOpen size={17} />
            Обучение
          </button>
        </nav>

        <section className="dashboard-panel" aria-labelledby="panel-title">
          {tab === 'structure' ? (
            <>
              <div className="dashboard-panel-head">
                <div>
                  <h2 id="panel-title">Организационная структура</h2>
                  <p>Отделы, руководители и численность</p>
                </div>
                <button
                  type="button"
                  className="dashboard-btn"
                  onClick={() => {
                    if (isDepartmentFormOpen && !editingDepartment) {
                      closeDepartmentForm()
                      return
                    }

                    openDepartmentForm(null)
                  }}
                >
                  <Plus size={16} />
                  Добавить отдел
                </button>
              </div>

              {isDepartmentFormOpen && (
                <form
                  key={editingDepartment?.id ?? 'new'}
                  className="dashboard-form"
                  onSubmit={handleDepartmentSubmit}
                  noValidate
                >
                  {editingDepartment && (
                    <p className="dashboard-form-title">
                      Редактирование отдела «{editingDepartment.name}»
                    </p>
                  )}

                  <div className="dashboard-form-row">
                    <div className="dashboard-field">
                      <label htmlFor="department-name">Название отдела</label>
                      <input
                        id="department-name"
                        name="department_name"
                        placeholder="Например, Аналитика"
                        autoComplete="off"
                        defaultValue={editingDepartment?.name ?? ''}
                        autoFocus
                      />
                    </div>
                    <div className="dashboard-field">
                      <label htmlFor="department-head">Руководитель</label>
                      <input
                        id="department-head"
                        name="department_head"
                        placeholder="Иванов И.И."
                        autoComplete="off"
                        defaultValue={
                          !editingDepartment || editingDepartment.head === '—'
                            ? ''
                            : editingDepartment.head
                        }
                      />
                    </div>
                  </div>

                  {departmentError && (
                    <p className="dashboard-form-error" role="alert">
                      {departmentError}
                    </p>
                  )}

                  <div className="dashboard-form-actions">
                    <button type="submit" className="dashboard-btn">
                      {editingDepartment ? 'Сохранить' : 'Добавить отдел'}
                    </button>
                    <button
                      type="button"
                      className="dashboard-btn dashboard-btn--ghost"
                      onClick={closeDepartmentForm}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}

              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Отдел</th>
                      <th>Руководитель</th>
                      <th>Сотрудников</th>
                      <th aria-label="Действия" />
                    </tr>
                  </thead>
                  <tbody>
                    {departments.map((dept) => (
                      <tr key={dept.id}>
                        <td>
                          <strong>{dept.name}</strong>
                        </td>
                        <td>{dept.head}</td>
                        <td>
                          <Users size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                          {dept.employees}
                        </td>
                        <td>
                          <div className="dashboard-table-actions">
                            <button
                              type="button"
                              className="dashboard-icon-btn"
                              aria-label={`Редактировать ${dept.name}`}
                              onClick={() => openDepartmentForm(dept)}
                            >
                              <Pencil size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div className="dashboard-panel-head">
                <div>
                  <h2 id="panel-title">Назначение курсов</h2>
                  <p>Выберите курс и отдел или всю компанию</p>
                </div>
                <button
                  type="button"
                  className="dashboard-btn dashboard-btn--ghost"
                  onClick={() => {
                    setIsCourseFormOpen((value) => !value)
                    setCourseError('')
                  }}
                >
                  <Plus size={16} />
                  Новый курс
                </button>
              </div>

              {isCourseFormOpen && (
                <form
                  className="dashboard-form"
                  onSubmit={handleAddCourse}
                  noValidate
                >
                  <div className="dashboard-form-row dashboard-form-row--single">
                    <div className="dashboard-field">
                      <label htmlFor="course-title">Название курса</label>
                      <input
                        id="course-title"
                        name="course_title"
                        placeholder="Например, Основы наставничества"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>

                  {courseError && (
                    <p className="dashboard-form-error" role="alert">
                      {courseError}
                    </p>
                  )}

                  <div className="dashboard-form-actions">
                    <button type="submit" className="dashboard-btn">
                      Добавить в каталог
                    </button>
                    <button
                      type="button"
                      className="dashboard-btn dashboard-btn--ghost"
                      onClick={() => {
                        setIsCourseFormOpen(false)
                        setCourseError('')
                      }}
                    >
                      Отмена
                    </button>
                  </div>
                </form>
              )}

              <form
                className="dashboard-assign"
                onSubmit={handleAssignCourse}
                aria-label="Назначить курс"
              >
                <div className="dashboard-field">
                  <label htmlFor="course-select">Курс</label>
                  <select
                    id="course-select"
                    value={activeCourseId}
                    onChange={(event) => setSelectedCourseId(event.target.value)}
                  >
                    {courseCatalog.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dashboard-field">
                  <label htmlFor="target-select">Кому</label>
                  <select
                    id="target-select"
                    value={selectedTargetId}
                    onChange={(event) => setSelectedTargetId(event.target.value)}
                  >
                    <option value="all">Вся компания</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="dashboard-field">
                  <label htmlFor="deadline-input">Срок</label>
                  <input
                    id="deadline-input"
                    name="assignment_deadline"
                    type="date"
                    defaultValue={defaultDeadline()}
                  />
                </div>
                <button type="submit" className="dashboard-btn">Назначить</button>

                {assignmentError && (
                  <p
                    className="dashboard-form-error dashboard-assign-error"
                    role="alert"
                  >
                    {assignmentError}
                  </p>
                )}
              </form>

              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Курс</th>
                      <th>Кому</th>
                      <th>Срок</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((row) => (
                      <tr key={row.id}>
                        <td>{row.course}</td>
                        <td>{row.target}</td>
                        <td>{row.deadline}</td>
                        <td>
                          <span
                            className={
                              row.status === 'active'
                                ? 'dashboard-badge dashboard-badge--ok'
                                : 'dashboard-badge dashboard-badge--pending'
                            }
                          >
                            {row.status === 'active' ? 'Активно' : 'Запланировано'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
