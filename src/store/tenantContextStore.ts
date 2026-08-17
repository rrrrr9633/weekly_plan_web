import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface TenantContextState {
  companyId: string | null
  setCompanyId: (companyId: string | null) => void
}

export const useTenantContextStore = create<TenantContextState>()(
  persist(
    (set) => ({
      companyId: null,
      setCompanyId: (companyId) => set({ companyId }),
    }),
    { name: 'tenant-context-storage' }
  )
)
