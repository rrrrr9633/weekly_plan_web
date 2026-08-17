import type { User } from '@/types'

export const getRoleHomePath = (user: User | null): string =>
  user?.role === 'super_admin' ? '/admin/companies' : user?.role === 'admin' ? '/board' : '/personal'
