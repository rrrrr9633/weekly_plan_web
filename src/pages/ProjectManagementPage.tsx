import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Edit2, Trash2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTenantContextStore } from '@/store/tenantContextStore'
import { PageTransition } from '@/components/layout/PageTransition'
import { projectApi } from '@/services/api'
import type { Project } from '@/types'
import { motion } from 'framer-motion'

export function ProjectManagementPage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | undefined>()
  const isSuperAdmin = useAuthStore((state) => state.user?.role === 'super_admin')
  const companyId = useTenantContextStore((state) => state.companyId)
  const hasCompanyContext = !isSuperAdmin || Boolean(companyId)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', companyId],
    queryFn: projectApi.getAll,
    enabled: hasCompanyContext,
  })

  const deleteMutation = useMutation({
    mutationFn: projectApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个项目吗？')) {
      deleteMutation.mutate(id)
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen ml-64 p-[var(--spacing-2xl)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-[var(--spacing-2xl)]">
            <div>
              <h1 className="mb-2">项目管理</h1>
              <p className="text-secondary">管理系统项目和状态</p>
            </div>
            {!isSuperAdmin && <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              添加项目
            </button>}
          </div>

          {!hasCompanyContext ? (
            <div className="card text-secondary">请先在侧边栏选择要查看的公司。</div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-[var(--spacing-2xl)]">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--spacing-lg)]">
              {projects.map((project: Project) => (
                <motion.div
                  key={project.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card hover:border-[var(--accent)] transition-all group"
                >
                  <div className="flex items-start justify-between mb-[var(--spacing-md)]">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block px-2 py-1 text-xs rounded-[var(--radius-sm)] bg-[var(--accent)]/20 text-accent font-medium">
                          {project.code}
                        </span>
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-[var(--radius-sm)] font-medium ${
                            project.status === 'active'
                              ? 'bg-[var(--status-success)]/20 text-[var(--status-success)]'
                              : 'bg-[var(--surface-4)] text-secondary'
                          }`}
                        >
                          {project.status === 'active' ? '进行中' : '已结束'}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg mb-1">{project.name}</h3>
                      {project.description && (
                        <p className="text-sm text-secondary mb-2">{project.description}</p>
                      )}
                      {project.assistOrg && (
                        <p className="text-xs text-secondary">辅助核算: {project.assistOrg}</p>
                      )}
                    </div>
                  </div>

                  {hasCompanyContext && <div className="flex gap-2 pt-[var(--spacing-md)] border-t border-[var(--border)] opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingProject(project)
                        setIsModalOpen(true)
                      }}
                      className="flex items-center gap-1 text-xs px-3 py-1 rounded-[var(--radius-full)] surface-3 hover:bg-[var(--accent)] hover:text-white transition-all"
                    >
                      <Edit2 className="w-3 h-3" />
                      编辑
                    </button>
                    <button
                      onClick={() => handleDelete(project.id)}
                      className="flex items-center gap-1 text-xs px-3 py-1 rounded-[var(--radius-full)] surface-3 hover:bg-[var(--status-error)] hover:text-white transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                      删除
                    </button>
                  </div>}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {hasCompanyContext && <ProjectModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingProject(undefined)
        }}
        editingProject={editingProject}
      />}
    </PageTransition>
  )
}

// 项目弹窗
function ProjectModal({
  isOpen,
  onClose,
  editingProject,
}: {
  isOpen: boolean
  onClose: () => void
  editingProject?: Project
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(editingProject?.name || '')
  const [code, setCode] = useState(editingProject?.code || '')
  const [description, setDescription] = useState(editingProject?.description || '')
  const [assistOrg, setAssistOrg] = useState(editingProject?.assistOrg || '')
  const [status, setStatus] = useState(editingProject?.status || 'active')

  const createMutation = useMutation({
    mutationFn: (data: { name: string; code: string; description?: string; assistOrg?: string }) =>
      projectApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) =>
      projectApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingProject) {
      updateMutation.mutate({
        id: editingProject.id,
        data: { name, description, status },
      })
    } else {
      createMutation.mutate({ name, code, description, assistOrg })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md surface-2 rounded-[var(--radius-lg)] border border-[var(--border)] shadow-[var(--shadow-lg)] p-[var(--spacing-xl)]"
      >
        <h2 className="text-xl font-bold mb-[var(--spacing-lg)]">
          {editingProject ? '编辑项目' : '添加项目'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-[var(--spacing-lg)]">
          <div>
            <label className="block text-sm font-medium mb-2">项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              required
            />
          </div>

          {!editingProject && (
            <div>
              <label className="block text-sm font-medium mb-2">项目编码</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例如: XM202607290001"
                className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">项目描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none resize-none"
            />
          </div>

          {!editingProject && (
            <div>
              <label className="block text-sm font-medium mb-2">辅助核算</label>
              <input
                type="text"
                value={assistOrg}
                onChange={(e) => setAssistOrg(e.target.value)}
                placeholder="例如: 四川谷露数据科技有限公司"
                className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              />
            </div>
          )}

          {editingProject && (
            <div>
              <label className="block text-sm font-medium mb-2">状态</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Project['status'])}
                className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="active">进行中</option>
                <option value="inactive">已结束</option>
              </select>
            </div>
          )}

          <div className="flex gap-[var(--spacing-md)] pt-[var(--spacing-md)]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-[var(--spacing-lg)] py-[var(--spacing-sm)] rounded-[var(--radius-full)] surface-3 hover:bg-[var(--surface-4)] transition-all"
            >
              取消
            </button>
            <button type="submit" className="flex-1 btn-primary">
              {editingProject ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
