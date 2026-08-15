import type { User } from '@/types'

export const getRoleHomePath = (user: User | null): string =>
  user?.role === 'admin' ? '/board' : '/personal'
