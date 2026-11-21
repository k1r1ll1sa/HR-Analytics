import { useEffect, useState, type FormEvent } from 'react'
import { BookOpen, Building2, ClipboardList } from 'lucide-react'
import './CompanyDashboard.css'
import {
  clearAuthToken,
  clearProfile,
  getProfile,
  persistCurrentProfile,
  type StoredProfile,
} from '../api/auth'
import {
  createDepartment,
  deleteDepartment,
  DepartmentApiError,
  updateDepartment,
} from '../api/departments'
import {
  loadAssignments,
  loadCourses,
  loadDepartments,
  resolveProfileDepartments,
  saveAssignments,
  saveCourses,
  saveDepartments,
  type AssignmentRow,
  type CourseRow,
  type DepartmentRow,
} from './dashboardStorage'
import {
  collectDescendantIds,
  createId,
  deleteOrder,
  formatDeadline,
  plural,
  roleLabels,
  toDepartmentRow,
  type StructureView,
  type Tab,
} from './dashboardUtils'
import { CoursesPanel } from './CoursesPanel'
import { DashboardHeader } from './DashboardHeader'
import { StructurePanel } from './StructurePanel'
import '../surveys/Surveys.css'

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

export default function CompanyDashboard() {
  const [tab, setTab] = useState<Tab>('structure')
  const [structureView, setStructureView] = useState<StructureView>('chart')
  const [draftParentId, setDraftParentId] = useState<string | null>(null)
  const [profile] = useState<StoredProfile | null>(getProfile)
  const companyId = profile?.companyId ?? null
  const [departments, setDepartments] = useState(() =>
    loadDepartments(companyId),
  )
  const [busyDepartmentId, setBusyDepartmentId] = useState<string | null>(null)
  const [isDepartmentSaving, setIsDepartmentSaving] = useState(false)
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
    saveDepartments(companyId, departments)
    const current = getProfile()

    if (!current) {
      return
    }

    const departmentNames = resolveProfileDepartments({
      ...current,
      companyId,
    })

    if (
      departmentNames.length === current.departmentNames.length &&
      departmentNames.every((name, index) => name === current.departmentNames[index])
    ) {
      return
    }

    persistCurrentProfile({ ...current, departmentNames })
  }, [companyId, departments])

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

  const openDepartmentForm = (
    department: DepartmentRow | null,
    parentId: string | null = null,
  ) => {
    setEditingDepartment(department)
    setDraftParentId(parentId)
    setIsDepartmentFormOpen(true)
    setDepartmentError('')
  }

  useEffect(() => {
    if (!isDepartmentFormOpen) {
      return
    }

    const form = document.getElementById('department-form')
    form?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [isDepartmentFormOpen, editingDepartment, draftParentId])

  const closeDepartmentForm = () => {
    setIsDepartmentFormOpen(false)
    setEditingDepartment(null)
    setDraftParentId(null)
    setDepartmentError('')
  }

  const requireCompanyId = () => {
    if (!companyId) {
      throw new DepartmentApiError(
        'Не найдена компания. Войдите владельцем, чтобы менять структуру.',
      )
    }

    return companyId
  }

  const handleDepartmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const name = String(formData.get('department_name') ?? '').trim()
    const head = String(formData.get('department_head') ?? '').trim()
    const parent = String(formData.get('department_parent') ?? '').trim()
    const parentId = parent || null

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

    setIsDepartmentSaving(true)
    setDepartmentError('')

    try {
      const currentCompanyId = requireCompanyId()
      const payload = {
        name,
        description: head || null,
        parent_id: parentId,
      }

      if (editingDepartment) {
        const updated = await updateDepartment(
          currentCompanyId,
          editingDepartment.id,
          payload,
        )

        setDepartments((current) =>
          current.map((department) =>
            department.id === editingDepartment.id
              ? toDepartmentRow(updated, { ...department, head: head || '—' })
              : department,
          ),
        )
      } else {
        const created = await createDepartment(currentCompanyId, payload)

        setDepartments((current) => [
          ...current,
          toDepartmentRow(created, {
            id: created.id,
            name: created.name,
            head: head || '—',
            employees: 0,
            parentId,
          }),
        ])
      }

      closeDepartmentForm()
    } catch (error) {
      setDepartmentError(
        error instanceof DepartmentApiError
          ? error.message
          : 'Не удалось сохранить отдел',
      )
    } finally {
      setIsDepartmentSaving(false)
    }
  }

  const handleDeleteDepartment = async (department: DepartmentRow) => {
    const childCount = collectDescendantIds(departments, department.id).size
    const confirmed = window.confirm(
      childCount > 0
        ? `Удалить отдел «${department.name}» и ${childCount} ${plural(childCount, 'подотдел', 'подотдела', 'подотделов')}?`
        : `Удалить отдел «${department.name}»?`,
    )

    if (!confirmed) {
      return
    }

    setBusyDepartmentId(department.id)
    setDepartmentError('')

    try {
      const currentCompanyId = requireCompanyId()
      const ids = deleteOrder(departments, department.id)

      for (const id of ids) {
        await deleteDepartment(currentCompanyId, id)
      }

      const removed = new Set(ids)
      setDepartments((current) =>
        current.filter((item) => !removed.has(item.id)),
      )

      if (editingDepartment && removed.has(editingDepartment.id)) {
        closeDepartmentForm()
      }
    } catch (error) {
      setDepartmentError(
        error instanceof DepartmentApiError
          ? error.message
          : 'Не удалось удалить отдел',
      )
    } finally {
      setBusyDepartmentId(null)
    }
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

    const department = departments.find((item) => item.id === selectedTargetId)

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

  const companyName = profile?.companyName ?? ''
  const userName = profile?.fullName || profile?.email || 'Пользователь'
  const roleLabel = profile ? roleLabels[profile.role] ?? profile.role : '—'

  const handleLogout = () => {
    clearAuthToken()
    clearProfile()
  }

  const blockedParentIds = editingDepartment
    ? collectDescendantIds(departments, editingDepartment.id)
    : new Set<string>()

  const parentOptions = departments.filter(
    (department) =>
      department.id !== editingDepartment?.id &&
      !blockedParentIds.has(department.id),
  )

  return (
    <main className="dashboard">
      <DashboardHeader
        userName={userName}
        companyName={companyName}
        roleLabel={roleLabel}
        onLogout={handleLogout}
      />

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
            <strong>
              {assignments.filter((a) => a.status === 'active').length}
            </strong>
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
          <a href="/surveys">
            <ClipboardList size={17} />
            Опросники
          </a>
        </nav>

        <section className="dashboard-panel" aria-labelledby="panel-title">
          {tab === 'structure' ? (
            <StructurePanel
              departments={departments}
              companyName={companyName || 'Компания'}
              structureView={structureView}
              onStructureViewChange={setStructureView}
              isDepartmentFormOpen={isDepartmentFormOpen}
              editingDepartment={editingDepartment}
              draftParentId={draftParentId}
              parentOptions={parentOptions}
              departmentError={departmentError}
              isDepartmentSaving={isDepartmentSaving}
              busyDepartmentId={busyDepartmentId}
              onToggleCreate={() => {
                if (isDepartmentFormOpen && !editingDepartment) {
                  closeDepartmentForm()
                  return
                }

                openDepartmentForm(null)
              }}
              onSubmit={handleDepartmentSubmit}
              onCancel={closeDepartmentForm}
              onAddChild={(department) =>
                openDepartmentForm(null, department?.id ?? null)
              }
              onEdit={(department) => openDepartmentForm(department)}
              onDelete={handleDeleteDepartment}
            />
          ) : (
            <CoursesPanel
              departments={departments}
              courseCatalog={courseCatalog}
              assignments={assignments}
              activeCourseId={activeCourseId}
              selectedTargetId={selectedTargetId}
              isCourseFormOpen={isCourseFormOpen}
              courseError={courseError}
              assignmentError={assignmentError}
              onToggleCourseForm={() => {
                setIsCourseFormOpen((value) => !value)
                setCourseError('')
              }}
              onAddCourse={handleAddCourse}
              onCancelCourseForm={() => {
                setIsCourseFormOpen(false)
                setCourseError('')
              }}
              onAssignCourse={handleAssignCourse}
              onCourseChange={setSelectedCourseId}
              onTargetChange={setSelectedTargetId}
            />
          )}
        </section>
      </div>
    </main>
  )
}
