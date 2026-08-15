import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Loader2, Edit2, Trash2 } from 'lucide-react'
import { PageTransition } from '@/components/layout/PageTransition'
import { userApi } from '@/services/api'
import type { User } from '@/types'
import { motion } from 'framer-motion'

export function UserManagementPage() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | undefined>()

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: userApi.getAll,
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

  return (
    <PageTransition>
      <div className="min-h-screen ml-64 p-[var(--spacing-2xl)]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-[var(--spacing-2xl)]">
            <div>
              <h1 className="mb-2">用户管理</h1>
              <p className="text-secondary">管理系统用户和权限</p>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-5 h-5" />
              添加用户
            </button>
          </div>

          {isLoading ? (
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
                    <th className="text-left py-[var(--spacing-md)] px-[var(--spacing-lg)] text-sm font-semibold text-secondary">
                      角色
                    </th>
                    <th className="text-left py-[var(--spacing-md)] px-[var(--spacing-lg)] text-sm font-semibold text-secondary">
                      创建时间
                    </th>
                    <th className="text-right py-[var(--spacing-md)] px-[var(--spacing-lg)] text-sm font-semibold text-secondary">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user: User) => (
                    <motion.tr
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-3)] transition-colors"
                    >
                      <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)] font-medium">
                        {user.username}
                      </td>
                      <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)]">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-[var(--radius-sm)] font-medium ${
                            user.role === 'admin'
                              ? 'bg-[var(--accent)]/20 text-accent'
                              : 'bg-[var(--surface-4)] text-secondary'
                          }`}
                        >
                          {user.role === 'admin' ? '管理员' : '普通用户'}
                        </span>
                      </td>
                      <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)] text-secondary text-sm">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-[var(--spacing-md)] px-[var(--spacing-lg)] text-right">
                        <div className="flex items-center justify-end gap-2">
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
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <UserModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingUser(undefined)
        }}
        editingUser={editingUser}
      />
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
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(editingUser?.role || 'user')

  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string; role: User['role'] }) =>
      userApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { username: string; role: User['role'] } }) =>
      userApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onClose()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingUser) {
      updateMutation.mutate({ id: editingUser.id, data: { username, role } })
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
