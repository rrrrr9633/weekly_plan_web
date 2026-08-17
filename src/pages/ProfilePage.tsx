import { useEffect, useState } from 'react'
import { KeyRound, UserRound } from 'lucide-react'
import { ApiError, userApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

export function ProfilePage() {
  const { user, token, setAuth } = useAuthStore()
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (!token) return
    userApi.getMe().then((nextUser) => setAuth(nextUser, token)).catch(() => undefined)
  }, [token, setAuth])

  if (!user || !token) return null
  const sessionToken = token

  const errorMessage = (error: unknown) => error instanceof ApiError ? error.message : '请求失败，请稍后重试'

  async function saveName() {
    const value = displayName.trim()
    if (value.length < 2 || value.length > 30) return setMessage('姓名长度应为 2–30 个字符')
    setSavingName(true)
    setMessage('')
    try {
      const nextUser = await userApi.updateMyProfile(value)
      setAuth(nextUser, sessionToken)
      setDisplayName(nextUser.displayName || nextUser.username)
      setMessage('姓名已保存')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setSavingName(false) }
  }

  async function savePassword() {
    if (!currentPassword) return setMessage('请输入当前密码')
    if (newPassword.length < 8) return setMessage('新密码至少需要 8 位')
    if (newPassword !== confirmPassword) return setMessage('两次输入的新密码不一致')
    setSavingPassword(true)
    setMessage('')
    try {
      await userApi.updateMyPassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('密码已修改')
    } catch (error) { setMessage(errorMessage(error)) }
    finally { setSavingPassword(false) }
  }

  return (
    <main className="ml-64 min-h-screen p-[var(--spacing-2xl)] max-w-4xl">
      <header className="mb-[var(--spacing-xl)]">
        <h2 className="text-2xl font-bold">个人信息</h2>
        <p className="text-secondary mt-2">用户名是登录账号；姓名建议填写真实姓名，方便团队识别计划归属。</p>
      </header>
      <section className="card space-y-[var(--spacing-lg)]">
        <div><label className="block text-sm font-medium mb-2">用户名</label><div className="surface-3 rounded-[var(--radius-md)] px-[var(--spacing-md)] py-[var(--spacing-sm)] text-secondary">{user.username}</div></div>
        <div><label className="block text-sm font-medium mb-2">所属公司</label><div className="surface-3 rounded-[var(--radius-md)] px-[var(--spacing-md)] py-[var(--spacing-sm)] text-secondary">{user.companyName || (user.role === 'super_admin' ? '超级管理员（未绑定公司）' : '未绑定公司')}</div></div>
        <div><label className="block text-sm font-medium mb-2">姓名</label><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={30} className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none" /><button onClick={saveName} disabled={savingName} className="btn-primary inline-flex items-center justify-center gap-2 mt-3 disabled:opacity-50"><UserRound className="w-4 h-4 shrink-0" />{savingName ? '保存中…' : '保存姓名'}</button></div>
      </section>
      <section className="card mt-[var(--spacing-xl)] space-y-[var(--spacing-md)]">
        <h3 className="font-bold text-lg">修改密码</h3>
        <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="当前密码" maxLength={72} className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none" />
        <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="新密码（至少 8 位）" maxLength={72} className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none" />
        <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="确认新密码" maxLength={72} className="w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] surface-3 rounded-[var(--radius-md)] border border-[var(--border)] focus:border-[var(--accent)] focus:outline-none" />
        <button onClick={savePassword} disabled={savingPassword} className="btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"><KeyRound className="w-4 h-4 shrink-0" />{savingPassword ? '修改中…' : '修改密码'}</button>
      </section>
      {message && <p className="mt-4 text-sm text-secondary">{message}</p>}
    </main>
  )
}
