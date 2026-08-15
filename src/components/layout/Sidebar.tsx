import { Link, useLocation } from 'react-router-dom'
import { Home, Calendar, Users, Settings, Archive, LogOut } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const location = useLocation()
  const { user, isAdmin, logout } = useAuthStore()

  const navigation = [
    { name: '个人计划', href: '/personal', icon: Calendar, adminOnly: false },
    { name: '团队大板', href: '/board', icon: Home, adminOnly: false },
    { name: '用户管理', href: '/admin/users', icon: Users, adminOnly: true },
    { name: '项目管理', href: '/admin/projects', icon: Settings, adminOnly: true },
    { name: '已归档计划', href: '/archived', icon: Archive, adminOnly: false },
  ]

  const filteredNav = navigation.filter(item => !item.adminOnly || isAdmin())

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 surface-2 border-r border-[var(--border)] flex flex-col">
      <div className="p-[var(--spacing-xl)] border-b border-[var(--border)]">
        <h1 className="text-xl font-bold text-accent">周计划系统</h1>
        <p className="text-sm text-secondary mt-1">{user?.username}</p>
      </div>

      <nav className="flex-1 p-[var(--spacing-md)] space-y-1">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-[var(--spacing-md)] py-[var(--spacing-sm)] rounded-[var(--radius-md)] transition-all duration-200',
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-[var(--shadow-md)]'
                  : 'text-secondary hover:text-primary hover:bg-[var(--surface-3)]'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-[var(--spacing-md)] border-t border-[var(--border)]">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-[var(--spacing-md)] py-[var(--spacing-sm)] rounded-[var(--radius-md)] text-secondary hover:text-primary hover:bg-[var(--surface-3)] transition-all duration-200"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">退出登录</span>
        </button>
      </div>
    </aside>
  )
}
