export interface DepartmentRow {
  id: string
  name: string
  head: string
  employees: number
}

export interface CourseRow {
  id: string
  title: string
}

export interface AssignmentRow {
  id: string
  course: string
  target: string
  deadline: string
  status: 'active' | 'pending'
}

const DEPARTMENTS_KEY = 'hr_dashboard_departments'
const COURSES_KEY = 'hr_dashboard_courses'
const ASSIGNMENTS_KEY = 'hr_dashboard_assignments'

function readList<T>(key: string, fallback: T[]): T[] {
  const raw = localStorage.getItem(key)

  if (!raw) {
    return fallback
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return fallback
    }

    return parsed.filter(
      (item): item is T =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string',
    )
  } catch {
    return fallback
  }
}

function writeList<T>(key: string, items: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(items))
  } catch {
    return
  }
}

export function loadDepartments(fallback: DepartmentRow[]) {
  return readList<DepartmentRow>(DEPARTMENTS_KEY, fallback)
}

export function loadCourses(fallback: CourseRow[]) {
  return readList<CourseRow>(COURSES_KEY, fallback)
}

export function loadAssignments(fallback: AssignmentRow[]) {
  return readList<AssignmentRow>(ASSIGNMENTS_KEY, fallback)
}

export function saveDepartments(departments: DepartmentRow[]) {
  writeList(DEPARTMENTS_KEY, departments)
}

export function saveCourses(courses: CourseRow[]) {
  writeList(COURSES_KEY, courses)
}

export function saveAssignments(assignments: AssignmentRow[]) {
  writeList(ASSIGNMENTS_KEY, assignments)
}
