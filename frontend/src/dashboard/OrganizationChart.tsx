import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Maximize2, Minimize2, Pencil, Trash2 } from 'lucide-react'
import type { DepartmentRow } from './dashboardStorage'
import { plural } from './dashboardUtils'

interface OrganizationChartProps {
  departments: DepartmentRow[]
  companyName: string
  busyId: string | null
  onAddChild: (department: DepartmentRow | null) => void
  onEdit: (department: DepartmentRow) => void
  onDelete: (department: DepartmentRow) => void
}

export function OrganizationChart({
  departments,
  companyName,
  busyId,
  onAddChild,
  onEdit,
  onDelete,
}: OrganizationChartProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState({ scale: 1, width: 0, height: 0 })
  const [expanded, setExpanded] = useState(false)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    const inner = innerRef.current

    if (!viewport || !inner) {
      return
    }

    const MIN_SCALE = expanded ? 0.35 : 0.72
    const gutter = expanded ? 48 : 24

    const measure = () => {
      const needed = inner.scrollWidth
      const height = inner.scrollHeight
      const availableWidth = Math.max(0, viewport.clientWidth - gutter)
      const availableHeight = Math.max(
        0,
        viewport.clientHeight - (expanded ? 48 : 0),
      )

      if (needed <= 0 || availableWidth <= 40) {
        return
      }

      const widthScale = availableWidth / needed
      const heightScale =
        expanded && height > 0
          ? availableHeight / height
          : Number.POSITIVE_INFINITY
      const rawScale = Math.min(1, widthScale, heightScale)
      const scale = expanded
        ? rawScale
        : Math.max(MIN_SCALE, Math.min(1, widthScale))
      setFit((current) => {
        if (
          Math.abs(current.scale - scale) < 0.01 &&
          current.width === needed &&
          current.height === height
        ) {
          return current
        }

        return { scale, width: needed, height }
      })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    observer.observe(inner)

    return () => observer.disconnect()
  }, [departments, companyName, expanded])

  useEffect(() => {
    if (!expanded) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setExpanded(false)
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [expanded])

  const leaveFullscreenThen = (action: () => void) => {
    setExpanded(false)
    action()
  }

  const ids = new Set(departments.map((department) => department.id))
  const topLevel = departments.filter(
    (department) => !department.parentId || !ids.has(department.parentId),
  )
  const roots = topLevel.length > 0 ? topLevel : departments
  const highlightedIds = new Set<string>()

  if (hoveredId) {
    const byId = new Map(
      departments.map((department) => [department.id, department]),
    )
    let current: string | null = hoveredId

    while (current && !highlightedIds.has(current)) {
      highlightedIds.add(current)
      current = byId.get(current)?.parentId ?? null
    }
  }

  const renderNode = (department: DepartmentRow) => (
    <div
      className={`org-node ${highlightedIds.has(department.id) ? 'is-path' : ''}`}
      onMouseEnter={() => setHoveredId(department.id)}
      onMouseLeave={() => setHoveredId(null)}
    >
      <div className="org-node-tools">
        <button
          type="button"
          className="org-tool"
          aria-label={`Редактировать отдел «${department.name}»`}
          disabled={busyId === department.id}
          onClick={() => leaveFullscreenThen(() => onEdit(department))}
        >
          <Pencil size={11} />
        </button>
        <button
          type="button"
          className="org-tool org-tool--danger"
          aria-label={`Удалить отдел «${department.name}»`}
          disabled={busyId === department.id}
          onClick={() => onDelete(department)}
        >
          <Trash2 size={11} />
        </button>
        <button
          type="button"
          className="org-tool"
          aria-label={`Добавить подотдел в «${department.name}»`}
          disabled={Boolean(busyId)}
          onClick={() => leaveFullscreenThen(() => onAddChild(department))}
        >
          +
        </button>
      </div>

      <span className="org-node-title">{department.name}</span>
      <span className="org-node-meta">{department.head}</span>
      <span className="org-node-meta">
        {department.employees}{' '}
        {plural(
          department.employees,
          'сотрудник',
          'сотрудника',
          'сотрудников',
        )}
      </span>
    </div>
  )

  const renderBranch = (
    department: DepartmentRow,
    visited: Set<string>,
  ) => {
    if (visited.has(department.id)) {
      return null
    }

    const nextVisited = new Set(visited)
    nextVisited.add(department.id)

    const children = departments.filter(
      (item) => item.parentId === department.id,
    )

    return (
      <div className="org-branch" key={department.id}>
        {renderNode(department)}
        {children.length > 0 && (
          <div className="org-level">
            {children.map((child) => renderBranch(child, nextVisited))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`org-chart-shell${expanded ? ' is-expanded' : ''}`}>
      <button
        type="button"
        className="org-expand"
        aria-label={
          expanded ? 'Свернуть схему' : 'Развернуть схему на весь экран'
        }
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
      <div
        className="org-chart"
        ref={viewportRef}
        onMouseLeave={() => setHoveredId(null)}
      >
        <div
          className="org-chart-frame"
          style={
            fit.width
              ? {
                  width: fit.width * fit.scale,
                  height: fit.height * fit.scale,
                }
              : undefined
          }
        >
          <div
            className="org-chart-scale"
            style={{
              width: fit.width || undefined,
              height: fit.height || undefined,
              transform: `scale(${fit.scale})`,
            }}
          >
            <div className="org-chart-inner" ref={innerRef}>
              <div
                className={`org-node org-node--root ${hoveredId ? 'is-path' : ''}`}
              >
                <div className="org-node-tools">
                  <button
                    type="button"
                    className="org-tool"
                    aria-label="Добавить отдел"
                    disabled={Boolean(busyId)}
                    onClick={() => leaveFullscreenThen(() => onAddChild(null))}
                  >
                    +
                  </button>
                </div>

                <span className="org-node-title">{companyName}</span>
                <span className="org-node-meta">
                  {departments.length}{' '}
                  {plural(departments.length, 'отдел', 'отдела', 'отделов')}
                </span>
              </div>

              {roots.length > 0 && (
                <div className="org-level">
                  {roots.map((department) =>
                    renderBranch(department, new Set()),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
