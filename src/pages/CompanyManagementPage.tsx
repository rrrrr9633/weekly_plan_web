import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, Plus, Trash2 } from 'lucide-react'
import { ApiError, companyApi } from '@/services/api'
import type { Company } from '@/types'

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
    <section className="card overflow-hidden">
      {loading ? <p className="text-secondary">正在加载...</p> : <table className="w-full text-left"><thead className="text-sm text-secondary"><tr><th className="pb-3">公司名称</th><th className="pb-3">编码</th><th className="pb-3">操作</th></tr></thead><tbody>{companies.map((company) => <tr key={company.id} className="border-t border-[var(--border)]"><td className="py-3">{company.name}</td><td className="py-3 font-mono text-sm">{company.code}</td><td className="py-3"><button onClick={() => void remove(company)} className="text-[var(--status-error)] inline-flex items-center gap-1"><Trash2 className="w-4 h-4" />删除</button></td></tr>)}</tbody></table>}
    </section>
  </main>
}
