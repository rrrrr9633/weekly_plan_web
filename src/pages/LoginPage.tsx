import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogIn, UserPlus } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { authApi, ApiError } from '@/services/api'
import { getRoleHomePath } from '@/lib/auth'

export function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setAuth } = useAuthStore()
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const sessionError = searchParams.get('reason') === 'session-invalid'
    ? '登录后会话校验失败，请确认线上后端和前端使用的是同一版本。'
    : ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!isLogin && password.length < 8) {
      setError('注册密码至少需要 8 位')
      return
    }

    setLoading(true)

    try {
      const response = isLogin
        ? await authApi.login(username, password)
        : await authApi.register(username, password)

      setAuth(response.user, response.token)
      navigate(getRoleHomePath(response.user), { replace: true })
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : '网络连接失败，请确认后端服务已启动')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-[var(--spacing-2xl)]">
          <h1 className="text-3xl font-bold text-accent mb-2">周计划系统</h1>
          <p className="text-secondary">高效管理你的周计划</p>
        </div>

        <div className="card">
          <div className="flex gap-2 mb-[var(--spacing-xl)] p-1 surface-3 rounded-[var(--radius-full)]">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-[var(--spacing-sm)] rounded-[var(--radius-full)] font-medium transition-all duration-200 ${
                isLogin
                  ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-md)]'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-[var(--spacing-sm)] rounded-[var(--radius-full)] font-medium transition-all duration-200 ${
                !isLogin
                  ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-md)]'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-[var(--spacing-lg)]">
            <div>
              <label className="block text-sm font-medium mb-2">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isLogin ? '请输入密码' : '至少 8 位密码'}
                minLength={isLogin ? undefined : 8}
                className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none transition-colors"
                required
              />
              {!isLogin && <p className="mt-2 text-xs text-secondary">密码长度为 8–72 位</p>}
            </div>

            {(error || sessionError) && (
              <div className="text-sm text-[var(--status-error)] bg-[var(--status-error)]/10 px-[var(--spacing-md)] py-[var(--spacing-sm)] rounded-[var(--radius-md)]">
                {error || sessionError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {isLogin ? '登录中...' : '注册中...'}
                </>
              ) : (
                <>
                  {isLogin ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {isLogin ? '登录' : '注册'}
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  )
}
