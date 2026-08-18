import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Edit2, Trash2, CalendarPlus } from 'lucide-react'
import { PageTransition } from '@/components/layout/PageTransition'
import { WeekSelector } from '@/components/WeekSelector'
import { PlanModal } from '@/components/PlanModal'
import { companyApi, projectApi, userApi, weekPlanApi } from '@/services/api'
import { useWeekStore } from '@/store/weekStore'
import { useAuthStore } from '@/store/authStore'
import { useTenantContextStore } from '@/store/tenantContextStore'
import type { User, WeekPlan } from '@/types'
import { motion } from 'framer-motion'

export function UserManagementPage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | undefined>()
  const [assigningUser, setAssigningUser] = useState<User | undefined>()
  const [moveError, setMoveError] = useState<string | null>(null)
  const { currentYear, currentWeek } = useWeekStore()
  const currentUser = useAuthStore((state) => state.user)
  const selectedCompanyId = useTenantContextStore((state) => state.companyId)
  const isSuperAdmin = currentUser?.role === 'super_admin'
  const hasCompanyContext = !isSuperAdmin || !!selectedCompanyId

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', isSuperAdmin ? selectedCompanyId : 'current-company'],
    queryFn: userApi.getAll,
    enabled: hasCompanyContext,
  })

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: companyApi.getAll,
    enabled: isSuperAdmin,
  })
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectApi.getAll,
    enabled: hasCompanyContext,
  })
  const userGroups = useMemo(() => {
    if (!isSuperAdmin) return [{ id: 'current-company', name: '', users }]

    const groups = new Map<string, { id: string; name: string; users: User[] }>()
    for (const user of users) {
      const id = user.companyId ?? 'unbound'
      const name = user.companyName || '未绑定公司'
      const group = groups.get(id) ?? { id, name, users: [] }
      group.users.push(user)
      groups.set(id, group)
    }

    return [...groups.values()]
      .map((group) => ({
        ...group,
        users: [...group.users].sort((left, right) => left.username.localeCompare(right.username, 'zh-CN')),
      }))
      .sort((left, right) => {
        if (left.id === 'unbound') return 1
        if (right.id === 'unbound') return -1
        return left.name.localeCompare(right.name, 'zh-CN')
      })
  }, [isSuperAdmin, users])

  const moveCompanyMutation = useMutation({
    mutationFn: ({ userId, companyId }: { userId: string; companyId: string }) => userApi.moveToCompany(userId, companyId),
    onSuccess: () => {
      setMoveError(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (error: Error) => setMoveError(error.message),
  })

  const assignPlanMutation = useMutation({
    mutationFn: ({ userId, projectId, plans }: { userId: string; projectId: string; plans: Array<{ content: string; weekday: WeekPlan['weekday'] }> }) =>
      Promise.all(plans.map((plan) => weekPlanApi.assign({ userId, projectId, year: currentYear, weekNumber: currentWeek, ...plan }))),
    onSuccess: () => {
      setAssigningUser(undefined)
      setMoveError(null)
      queryClient.invalidateQueries({ queryKey: ['weekPlans'] })
    },
    onError: (error: Error) => setMoveError(error.message),
  })

  const deleteMutation = useMutation({
    mutationFn: userApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个用户吗？')) {
      deleteMutation.mutate(id)
    }
  }

  const handleMoveCompany = (user: User, companyId: string) => {
    if (!companyId || companyId === user.companyId) return
    const company = companies.find((item) => item.id === companyId)
    if (!company || !confirm(`确定将“${user.displayName || user.username}”切换到“${company.name}”吗？`)) return
    setMoveError(null)
    moveCompanyMutation.mutate({ userId: user.id, companyId })
  }

  return (
    <PageTransition>
      <div className="min-h-screen ml-64 p-[var(--spacing-2xl)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-[var(--spacing-2xl)]">
            <div>
              <h1 className="mb-2">用户管理</h1>
              <p className="text-secondary">管理系统用户和权限</p>
            </div>
            {!isSuperAdmin && <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              添加用户
            </button>}
          </div>

          {!isSuperAdmin && (
            <div className="mb-[var(--spacing-xl)]">
              <WeekSelector />
            </div>
          )}

          {moveError && (
            <div className="mb-[var(--spacing-lg)] rounded-[var(--radius-md)] border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 px-[var(--spacing-md)] py-[var(--spacing-sm)] text-sm text-[var(--status-error)]">
              {moveError}
            </div>
          )}

          {!hasCompanyContext ? (
            <div className="card px-[var(--spacing-xl)] py-[var(--spacing-2xl)] text-center">
              <p className="font-medium">请先在侧栏选择查看公司</p>
              <p className="mt-2 text-sm text-secondary">选择公司后，将只展示该公司的用户。</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-[var(--spacing-2xl)]">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-[var(--spacing-md)] px-[var(--spacing-lg)] text-sm font-semibold text-secondary">
                      用户名
                    </th>
                    {isSuperAdmin && (
                      <th className="text-left py-[var(--spacing-md)] px-[var(--spacing-lg)] text-sm font-semibold text-secondary">
                        所属公司
                      </th>
                    )}
                    <th className="text-left py-[var(--spacing-md)] px-[var(--spacing-lg)] text-sm font-semibold text-secondary">
                      角色
                    </th>
                    <th className="text-left py-[var(--spacing-md)] px-[var(--spacing-lg)] text-sm font-semibold text-secondary">
                      创建时间
                    </th>
                    {hasCompanyContext && <th className="text-right py-[var(--spacing-md)] px-[var(--spacing-lg)] text-sm font-semibold text-secondary">
                      操作
                    </th>}
                  </tr>
                </thead>
              {userGroups.map((group) => (
                <tbody key={group.id}>
                  {isSuperAdmin && (
                    <tr className="border-y border-[var(--border)] bg-[var(--surface-3)]">
                      <td colSpan={5} className="px-[var(--spacing-lg)] py-[var(--spacing-sm)] text-sm font-semibold text-accent">
                        {group.name} · {group.users.length} 名用户
                      </td>
                    </tr>
                  )}
                  {group.users.map((user: User) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-3)] transition-colors"
                    >
                      <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)] font-medium">
                        {user.username}
                      </td>
                      {isSuperAdmin && <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)]">
                        {user.role === 'super_admin' ? <span className="text-secondary text-sm">未绑定</span> : <select value={user.companyId ?? ''} disabled={moveCompanyMutation.isPending} onChange={(event) => handleMoveCompany(user, event.target.value)} className="max-w-40 px-2 py-1 surface-3 rounded border border-[var(--border)] text-sm disabled:cursor-not-allowed disabled:opacity-60">
                          <option value="" disabled>选择公司</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                        </select>}
                      </td>}
                      <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)]">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-[var(--radius-sm)] font-medium ${
                            user.role === 'super_admin'
                              ? 'bg-[var(--status-warning)]/20 text-[var(--status-warning)]'
                              : user.role === 'admin'
                                ? 'bg-[var(--accent)]/20 text-accent'
                                : 'bg-[var(--surface-4)] text-secondary'
                          }`}
                        >
                          {user.role === 'super_admin' ? '超级管理员' : user.role === 'admin' ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)] text-secondary text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      {hasCompanyContext && <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)] text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setAssigningUser(user)}
                            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--accent)] hover:text-white transition-all"
                            title={`为 ${user.displayName || user.username} 分配计划`}
                          >
                            <CalendarPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingUser(user)
                              setIsModalOpen(true)
                            }}
                            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--accent)] hover:text-white transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id)}
                            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--status-error)] hover:text-white transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>}
                    </motion.tr>
                  ))}
                </tbody>
              ))}
              </table>
            </div>
          )}
        </div>
      </div>

      {hasCompanyContext && <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingUser(undefined)
        }}
        editingUser={editingUser}
      />}

      {hasCompanyContext && assigningUser && (
        <PlanModal
          isOpen
          onClose={() => setAssigningUser(undefined)}
          projects={projects}
          assignee={assigningUser}
          onSubmit={({ projectId, plans }) =>
            assignPlanMutation.mutate({ userId: assigningUser.id, projectId, plans })
          }
        />
      )}
    </PageTransition>
  )
}

// 用户弹窗
function UserModal({
  isOpen,
  onClose,
  editingUser,
}: {
  isOpen: boolean
  onClose: () => void
  editingUser?: User
}) {
  const queryClient = useQueryClient()
  const [username, setUsername] = useState(editingUser?.username || '')
  const [displayName, setDisplayName] = useState(editingUser?.displayName || editingUser?.username || '')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(editingUser?.role || 'user')
  const [formError, setFormError] = useState<string | null>(null)

  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; role: User['role'] }) =>
      userApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { username: string; displayName: string; role: User['role'] } }) =>
      userApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
    onError: (error: Error) => setFormError(error.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: { username, displayName, role } })
    } else {
      createMutation.mutate({ username, password, role })
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
          {editingUser ? '编辑用户' : '添加用户'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-[var(--spacing-lg)]">
          {formError && (
            <p role="alert" className="rounded-[var(--radius-md)] border border-[var(--status-error)]/40 bg-[var(--status-error)]/10 px-[var(--spacing-md)] py-[var(--spacing-sm)] text-sm text-[var(--status-error)]">
              {formError}
            </p>
          )}
          <div>
            <label className="block text-sm font-medium mb-2">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">姓名</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
              minLength={2}
              maxLength={30}
              required
            />
          </div>

          {!editingUser && (
            <div>
              <label className="block text-sm font-medium mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">角色</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as User['role'])}
              className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>

          <div className="flex gap-[var(--spacing-md)] pt-[var(--spacing-md)]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-[var(--spacing-lg)] py-[var(--spacing-sm)] rounded-[var(--radius-full)] surface-3 hover:bg-[var(--surface-4)] transition-all"
            >
              取消
            </button>
            <button type="submit" className="flex-1 btn-primary">
              {editingUser ? '保存' : '创建'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
