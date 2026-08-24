import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { ApiError, companyApi, moduleApi } from '@/services/api'
import type { Company, FeatureModule } from '@/types'

export function CompanyManagementPage() {
  const [companies, setCompanies] = useState<Company[]>([])
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { setCompanies(await companyApi.getAll()) }
    catch (err) { setError(err instanceof ApiError ? err.message : '无法加载公司列表') }
    finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const create = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    try {
      await companyApi.create({ name, code })
      setName('')
      setCode('')
      await load()
    } catch (err) { setError(err instanceof ApiError ? err.message : '创建公司失败') }
  }

  const remove = async (company: Company) => {
    if (!window.confirm(`确定删除“${company.name}”吗？仅无关联用户和项目的公司可删除。`)) return
    setError('')
    try { await companyApi.delete(company.id); await load() }
    catch (err) { setError(err instanceof ApiError ? err.message : '删除公司失败') }
  }

  return <main className="ml-64 min-h-screen p-[var(--spacing-2xl)] max-w-5xl">
    <header className="mb-[var(--spacing-xl)]">
      <div className="flex items-center gap-3"><Building2 className="text-accent" /><h2 className="text-2xl font-bold">公司管理</h2></div>
      <p className="text-secondary mt-2">创建公司后，用户注册时可选择所属公司。存在业务数据的公司不能删除。</p>
    </header>
    <form onSubmit={create} className="card flex gap-3 items-end mb-[var(--spacing-xl)]">
      <label className="flex-1 text-sm font-medium">公司名称<input value={name} onChange={(event) => setName(event.target.value)} required maxLength={128} className="mt-2 w-full px-3 py-2 surface-3 rounded-[var(--radius-md)] border border-[var(--border)]" /></label>
      <label className="flex-1 text-sm font-medium">稳定编码<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required maxLength={64} pattern="[A-Za-z0-9_-]+" className="mt-2 w-full px-3 py-2 surface-3 rounded-[var(--radius-md)] border border-[var(--border)]" /></label>
      <button className="btn-primary flex items-center gap-2" type="submit"><Plus className="w-4 h-4" />创建</button>
    </form>
    {error && <p className="mb-4 text-sm text-[var(--status-error)]">{error}</p>}
    <section className="card overflow-x-auto">
      {loading ? <p className="text-secondary">正在加载...</p> : <table className="w-full min-w-[42rem] text-left"><thead className="text-sm text-secondary"><tr><th className="w-[34%] pb-3">公司名称</th><th className="w-[36%] pb-3">编码</th><th className="w-[30%] pb-3">操作</th></tr></thead><tbody>{companies.map((company) => <CompanyRow key={company.id} company={company} onDelete={() => void remove(company)} />)}</tbody></table>}
    </section>
  </main>
}

function CompanyRow({ company, onDelete }: { company: Company; onDelete: () => void }) {
  const [modules, setModules] = useState<FeatureModule[] | null>(null)
  const [open, setOpen] = useState(false)
  const [moduleError, setModuleError] = useState('')
  const load = async () => {
    setModuleError('')
    try { setModules(await moduleApi.getCompany(company.id)) }
    catch (error) { setModuleError(error instanceof ApiError ? error.message : '模块配置加载失败') }
  }
  const togglePanel = () => { setOpen((value) => !value); if (!modules) void load() }
  const toggleModule = async (code: string, enabled: boolean) => {
    setModuleError('')
    try { await moduleApi.setCompanyEnabled(company.id, code, enabled); await load() }
    catch (error) { setModuleError(error instanceof ApiError ? error.message : '模块配置更新失败') }
  }
  return <>
    <tr className="border-t border-[var(--border)]"><td className="py-4 font-medium">{company.name}</td><td className="py-4 font-mono text-sm text-secondary">{company.code}</td><td className="py-4"><div className="flex items-center gap-4"><button onClick={togglePanel} aria-expanded={open} className="font-medium text-accent hover:opacity-75">{open ? '收起模块配置' : '模块配置'}</button><button onClick={onDelete} className="inline-flex items-center gap-1 text-[var(--status-error)]"><Trash2 className="w-4 h-4" />删除</button></div></td></tr>
    {open && <tr className="border-t border-[var(--border)] bg-[var(--surface-2)]"><td colSpan={3} className="p-5"><div className="max-w-3xl"><div className="flex items-baseline justify-between gap-4"><h3 className="text-base font-semibold">{company.name} 可用模块</h3><p className="text-sm text-secondary">开启后，该公司的成员才可在个人模块管理中选择启用。</p></div>{moduleError ? <p className="mt-3 text-sm text-[var(--status-error)]">{moduleError}</p> : modules ? <div className="mt-4 divide-y rounded-[var(--radius-md)] border surface-1">{modules.map((module) => <label key={module.code} className="flex cursor-pointer items-start justify-between gap-6 p-4 hover:bg-[var(--surface-2)]"><span><strong className="block text-sm">{module.name}</strong><span className="mt-1 block text-sm text-secondary">{module.description}</span></span><span className="flex shrink-0 items-center gap-2 text-sm font-medium"><input type="checkbox" checked={module.enabled} onChange={(event) => void toggleModule(module.code, event.target.checked)} />{module.enabled ? '已开放' : '未开放'}</span></label>)}</div> : <p className="mt-3 text-sm text-secondary">正在加载模块配置…</p>}</div></td></tr>}
  </>
}
