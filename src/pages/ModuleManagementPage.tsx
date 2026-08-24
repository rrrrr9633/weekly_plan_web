import { useQuery, useQueryClient } from '@tanstack/react-query'
import { SlidersHorizontal } from 'lucide-react'
import { moduleApi } from '@/services/api'

export function ModuleManagementPage() {
  const queryClient = useQueryClient()
  const { data: modules = [], isLoading } = useQuery({ queryKey: ['myModules'], queryFn: moduleApi.getMine })
  const change = async (code: string, enabled: boolean) => { await moduleApi.setMineEnabled(code, enabled); await queryClient.invalidateQueries({ queryKey: ['myModules'] }) }
  return <main className="ml-64 min-h-screen p-[var(--spacing-2xl)] max-w-4xl"><header className="mb-[var(--spacing-xl)]"><div className="flex items-center gap-3"><SlidersHorizontal className="text-accent" /><h2 className="text-2xl font-bold">模块管理</h2></div><p className="mt-2 text-secondary">仅显示公司已向你开放的模块。关闭后将同时隐藏入口并禁止访问模块数据。</p></header><section className="card divide-y">{isLoading ? <p className="text-secondary">正在加载模块…</p> : modules.length ? modules.map((module) => <div key={module.code} className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0"><div><h3 className="text-base font-semibold">{module.name}</h3><p className="mt-1 text-sm text-secondary">{module.description}</p></div><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium"><input type="checkbox" checked={module.enabled} onChange={(event) => void change(module.code, event.target.checked)} />{module.enabled ? '已启用' : '未启用'}</label></div>) : <p className="text-secondary">当前公司尚未向你开放任何可选模块。</p>}</section></main>
}
