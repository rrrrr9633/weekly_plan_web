import { useAuthStore } from '@/store/authStore'
import { useTenantContextStore } from '@/store/tenantContextStore'
import type { Company, Project, User, WeekPlan } from '@/types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://tianxiadiyi.xyz/api'
const TIMEOUT_MS = 190_000
const toApiWeekday = (weekday: WeekPlan['weekday']) => weekday.toUpperCase()

type Query = Record<string, string | number | boolean | undefined | null>

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

function buildUrl(path: string, params?: Query): string {
  const url = new URL(`${API_BASE_URL}${path}`)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: { body?: unknown; params?: Query } = {}
): Promise<T> {
  const token = useAuthStore.getState().token
  const user = useAuthStore.getState().user
  const companyId = useTenantContextStore.getState().companyId
  const companyContext: Record<string, string> = user?.role === 'super_admin' && companyId
    ? { 'X-Company-Id': companyId }
    : {}

  const response = await fetch(buildUrl(path, options.params), {
    method,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...companyContext,
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  const payload = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    if (response.status === 401 && token && !path.startsWith('/auth/')) {
      useAuthStore.getState().logout()
      window.location.assign('/login?reason=session-invalid')
    }
    const message =
      (payload as { message?: string } | null)?.message ?? `请求失败 (${response.status})`
    throw new ApiError(response.status, payload, message)
  }

  return payload as T
}

async function download(path: string, filename: string, params?: Query): Promise<void> {
  const token = useAuthStore.getState().token
  const user = useAuthStore.getState().user
  const companyId = useTenantContextStore.getState().companyId
  const response = await fetch(buildUrl(path, params), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(user?.role === 'super_admin' && companyId ? { 'X-Company-Id': companyId } : {}),
    },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new ApiError(response.status, payload, (payload as { message?: string } | null)?.message ?? `请求失败 (${response.status})`)
  }

  const objectUrl = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

export const api = {
  get: <T>(path: string, options?: { params?: Query }) =>
    request<T>('GET', path, { params: options?.params }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export interface AuthResponse {
  token: string
  user: User
}

export interface AiProposalResponse {
  id: string | number
  operationType: string
  status: string
  preview?: string | null
  message?: string | null
  error?: string | null
  missingFields?: unknown
  conversationId?: string | number | null
}

export interface AiConversationSummary {
  id: string | number
  title: string
  createdAt: string
  updatedAt: string
  expiresAt: string
}

export interface AiConversationDetail {
  conversation: AiConversationSummary
  messages: Array<{ id: string | number; sender: 'USER' | 'ASSISTANT'; content: string; proposalId?: string | number | null; createdAt: string }>
}

export interface AiMemory {
  id: string | number
  actorUserId: string | number
  actorDisplayName: string
  operationType: string
  summary: string
  createdAt: string
}

export interface AiContext {
  projects?: Array<{ id: string | number; name: string; code?: string }>
}

export const aiApi = {
  propose: (message: string, conversationId?: string | number | null) => api.post<AiProposalResponse>('/ai/proposals', { message, conversationId }),
  getContext: () => api.get<AiContext>('/ai/context'),
  confirm: (id: string | number) => api.post<AiProposalResponse>(`/ai/proposals/${id}/confirm`),
  supplement: (id: string | number, fields: Record<string, string>) => api.post<AiProposalResponse>(`/ai/proposals/${id}/supplement`, { fields }),
  getOperations: () => api.get<AiProposalResponse[]>('/ai/operations'),
  deleteOperation: (id: string | number) => api.delete<void>(`/ai/operations/${id}`),
  getMemories: () => api.get<AiMemory[]>('/ai/memories'),
  getConversations: () => api.get<AiConversationSummary[]>('/ai/conversations'),
  createConversation: (title?: string) => api.post<AiConversationDetail>('/ai/conversations', { title }),
  getConversation: (id: string | number) => api.get<AiConversationDetail>(`/ai/conversations/${id}`),
  deleteConversation: (id: string | number) => api.delete<void>(`/ai/conversations/${id}`),
}

// Auth API
export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),

  register: (username: string, password: string, companyId: string) =>
    api.post<AuthResponse>('/auth/register', { username, password, companyId }),

  logout: () => api.post<void>('/auth/logout'),
}

export const companyApi = {
  getRegistrationCompanies: () => api.get<Company[]>('/companies/public'),
  getAll: () => api.get<Company[]>('/companies'),
  create: (data: { code: string; name: string }) => api.post<Company>('/companies', data),
  delete: (id: string) => api.delete<void>(`/companies/${id}`),
}

// User API
export const userApi = {
  getAll: () => api.get<User[]>('/users'),
  getMe: () => api.get<User>('/users/me'),
  updateMyProfile: (displayName: string) => api.put<User>('/users/me', { displayName }),
  updateMyPassword: (currentPassword: string, newPassword: string) =>
    api.put<void>('/users/me/password', { currentPassword, newPassword }),
  getById: (id: string) => api.get<User>(`/users/${id}`),
  create: (data: { username: string; password: string; role: User['role'] }) =>
    api.post<User>('/users', data),
  update: (id: string, data: { username: string; displayName: string; role: User['role'] }) =>
    api.put<User>(`/users/${id}`, data),
  delete: (id: string) => api.delete<void>(`/users/${id}`),
  moveToCompany: (id: string, companyId: string) =>
    api.put<User>(`/users/${id}/company`, { companyId }),
}

// Project API
export const projectApi = {
  getAll: () => api.get<Project[]>('/projects'),
  getById: (id: string) => api.get<Project>(`/projects/${id}`),
  create: (data: { name: string; code: string; description?: string; assistOrg?: string }) =>
    api.post<Project>('/projects', data),
  update: (
    id: string,
    data: Partial<{ name: string; description: string; status: Project['status']; hidden: boolean }>
  ) => api.put<Project>(`/projects/${id}`, data),
  delete: (id: string) => api.delete<void>(`/projects/${id}`),
}

// WeekPlan API
export const weekPlanApi = {
  // 获取指定周的所有计划（团队大板用）
  getByWeek: (year: number, week: number) =>
    api.get<WeekPlan[]>(`/plans/week/${year}/${week}`),

  // 获取当前用户指定周的计划（个人视图用）
  getMyPlans: (year: number, week: number) =>
    api.get<WeekPlan[]>(`/plans/my/${year}/${week}`),

  exportMyWeekReport: (year: number, week: number, projectIds: string[]) =>
    download(`/plans/my/${year}/${week}/report`, `${year}年第${week}周个人周报.xlsx`, { projectIds: projectIds.join(',') }),

  create: (data: {
    projectId: string
    year: number
    weekNumber: number
    weekday: WeekPlan['weekday']
    content: string
  }) => api.post<WeekPlan>('/plans', { ...data, weekday: toApiWeekday(data.weekday) }),

  createBatch: (data: {
    projectId: string
    year: number
    weekNumber: number
    plans: Array<{ content: string; weekday: WeekPlan['weekday'] }>
  }) => api.post<WeekPlan[]>('/plans/batch', {
    ...data,
    plans: data.plans.map((plan) => ({ ...plan, weekday: toApiWeekday(plan.weekday) })),
  }),

  update: (id: string, data: { projectId: string; content: string; weekday: WeekPlan['weekday'] }) =>
    api.put<WeekPlan>(`/plans/${id}`, { ...data, weekday: toApiWeekday(data.weekday) }),

  delete: (id: string) => api.delete<void>(`/plans/${id}`),

  getArchived: () => api.get<WeekPlan[]>('/plans/archived'),

  archive: (id: string) => api.put<WeekPlan>(`/plans/${id}/archive`),

  claim: (id: string) => api.post<WeekPlan>(`/plans/${id}/claim`),

  leave: (id: string) => api.delete<void>(`/plans/${id}/claim`),

  restore: (id: string) => api.put<WeekPlan>(`/plans/${id}/restore`),

  saveBoardOrder: (data: { projectId: string; year: number; weekNumber: number; weekday: WeekPlan['weekday']; planIds: string[] }) =>
    api.put<WeekPlan[]>('/plans/board/order', { ...data, weekday: toApiWeekday(data.weekday), planIds: data.planIds.map(Number) }),

  restoreBoardOrder: (data: { projectId: string; year: number; weekNumber: number; weekday: WeekPlan['weekday'] }) =>
    api.delete<void>(`/plans/board/order?${new URLSearchParams({ projectId: data.projectId, year: String(data.year), weekNumber: String(data.weekNumber), weekday: toApiWeekday(data.weekday) }).toString()}`),

  // 管理员分配计划
  assign: (data: {
    projectId: string
    userId: string
    year: number
    weekNumber: number
    weekday: WeekPlan['weekday']
    content: string
  }) => api.post<WeekPlan>('/plans/assign', { ...data, weekday: toApiWeekday(data.weekday) }),

  search: (query: string, year?: number, week?: number) =>
    api.get<WeekPlan[]>('/plans/search', { params: { query, year, week } }),
}
