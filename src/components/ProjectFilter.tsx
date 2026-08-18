import { useState } from 'react'
import { Check, ChevronDown, FolderKanban } from 'lucide-react'
import type { Project } from '@/types'

type ProjectFilterProps = {
  projects: Project[]
  selectedProjectIds: string[] | null
  onChange: (projectIds: string[] | null) => void
}

export function ProjectFilter({ projects, selectedProjectIds, onChange }: ProjectFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const visibleProjectIds = projects.filter((project) => !project.hidden).map((project) => project.id)
  const selectedIds = selectedProjectIds ?? []
  const isNoneSelected = selectedProjectIds === null
  const isImplicitAllSelected = !isNoneSelected && selectedIds.length === 0
  const effectiveSelectedIds = isImplicitAllSelected ? visibleProjectIds : selectedIds
  const isAllVisibleSelected = !isNoneSelected && visibleProjectIds.every((id) => effectiveSelectedIds.includes(id))
  const selectedLabel = isNoneSelected
    ? '未选择项目'
    : isAllVisibleSelected && effectiveSelectedIds.length === visibleProjectIds.length
      ? '全部项目'
      : effectiveSelectedIds.length === 1
        ? `[${projects.find((project) => project.id === effectiveSelectedIds[0])?.code ?? '未知'}] 已选项目`
        : `已选 ${effectiveSelectedIds.length} 个项目`

  const toggleProject = (projectId: string) => {
    const nextSelectedIds = isNoneSelected
      ? [projectId]
      : effectiveSelectedIds.includes(projectId)
        ? effectiveSelectedIds.filter((id) => id !== projectId)
        : [...effectiveSelectedIds, projectId]

    onChange(nextSelectedIds.length === 0 ? null : nextSelectedIds)
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-8 max-w-72 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-3 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <FolderKanban className="h-4 w-4 shrink-0 text-[var(--accent-muted)]" />
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-[var(--shadow-lg)]">
          <button
            type="button"
            onClick={() => onChange(isAllVisibleSelected
              ? isImplicitAllSelected
                ? null
                : effectiveSelectedIds.filter((id) => !visibleProjectIds.includes(id))
              : [...effectiveSelectedIds, ...visibleProjectIds.filter((id) => !effectiveSelectedIds.includes(id))])}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${isAllVisibleSelected ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--surface-3)]'}`}
            role="option"
            aria-selected={isAllVisibleSelected}
          >
            <span className={`grid h-4 w-4 place-items-center rounded border ${isAllVisibleSelected ? 'border-white bg-white text-[var(--accent)]' : 'border-[var(--border)]'}`}>
              {isAllVisibleSelected && <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />}
            </span>
            全部项目
          </button>
          <div className="max-h-72 overflow-y-auto border-t border-[var(--border)] py-1">
            {projects.map((project) => {
              const isSelected = !isNoneSelected && effectiveSelectedIds.includes(project.id)
              return (
                <button
                  type="button"
                  key={project.id}
                  onClick={() => toggleProject(project.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--surface-3)]"
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className={`grid h-4 w-4 place-items-center rounded border ${isSelected ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : 'border-[var(--border)]'}`}>
                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden="true" />}
                  </span>
                  <span className="truncate">[{project.code}] {project.name}{project.hidden ? '（已隐藏）' : ''}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
