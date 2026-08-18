import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, ChevronDown, History, Loader2, MessageSquarePlus, Send, ShieldAlert, Trash2, X } from 'lucide-react'
import { aiApi, ApiError, type AiProposalResponse } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

type FieldValues = Record<string, string>
type ProjectCandidate = { id: string | number; name: string; code?: string }

function missingFieldNames(proposal?: AiProposalResponse): string[] {
  const missing = proposal?.missingFields
  if (Array.isArray(missing)) return missing.filter((field): field is string => typeof field === 'string')
  if (missing && typeof missing === 'object') {
    const fields = (missing as { missingFields?: unknown; fields?: unknown }).missingFields
      ?? (missing as { fields?: unknown }).fields
    if (Array.isArray(fields)) return fields.filter((field): field is string => typeof field === 'string')
  }
  return []
}

function proposalProjects(proposal?: AiProposalResponse): ProjectCandidate[] {
  const missing = proposal?.missingFields
  if (missing && typeof missing === 'object' && Array.isArray((missing as { projects?: unknown }).projects)) {
    return (missing as { projects: ProjectCandidate[] }).projects
  }
  return []
}

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    projectId: '所属项目', id: '计划或项目 ID', year: '年份', weekNumber: '周序号', weekday: '星期',
    content: '计划内容', name: '项目名称', code: '项目编号', assistOrg: '协作单位', resource: '查询对象',
  }
  return labels[field] ?? field
}

function isProjectOperation(operationType?: string): boolean {
  return Boolean(operationType?.startsWith('PROJECT_'))
}

function isDelete(operationType?: string): boolean {
  return Boolean(operationType?.includes('DELETE'))
}

function isQuery(operationType?: string): boolean {
  return operationType === 'QUERY'
}

export function AiAssistant() {
  const user = useAuthStore((state) => state.user)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [proposal, setProposal] = useState<AiProposalResponse>()
  const [fields, setFields] = useState<FieldValues>({})
  const [error, setError] = useState<string>()
  const [conversationId, setConversationId] = useState<string | number | null>(null)
  const [showMemories, setShowMemories] = useState(false)
  const [deleteConfirmed, setDeleteConfirmed] = useState(false)
  const { data: conversationList = [] } = useQuery({
    queryKey: ['aiConversations'], queryFn: aiApi.getConversations, enabled: open && Boolean(user),
  })
  const { data: memories = [] } = useQuery({
    queryKey: ['aiMemories'], queryFn: aiApi.getMemories, enabled: open && showMemories && Boolean(user),
  })
  const { data: currentConversation } = useQuery({
    queryKey: ['aiConversation', conversationId],
    queryFn: () => aiApi.getConversation(conversationId!),
    enabled: open && conversationId !== null && Boolean(user),
  })
  const { data: context } = useQuery({
    queryKey: ['aiContext'],
    queryFn: aiApi.getContext,
    enabled: open && Boolean(user),
    staleTime: 5 * 60 * 1000,
  })

  const missingFields = missingFieldNames(proposal)
  const projectChoices = useMemo(() => {
    const choices = proposalProjects(proposal)
    return choices.length > 0 ? choices : context?.projects ?? []
  }, [context?.projects, proposal])
  const hasMissingFields = missingFields.length > 0
  const writeOperation = proposal && !isQuery(proposal.operationType)
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  useEffect(() => {
    if (!open) setDeleteConfirmed(false)
  }, [open])

  const proposalMutation = useMutation({
    mutationFn: (nextMessage?: string) => aiApi.propose(nextMessage ?? message.trim(), conversationId),
    onSuccess: (response) => {
      setProposal(response)
      setMessage('')
      if (response.conversationId) {
        setConversationId(response.conversationId)
        void queryClient.invalidateQueries({ queryKey: ['aiConversation', response.conversationId] })
      }
      void queryClient.invalidateQueries({ queryKey: ['aiConversations'] })
      setError(response.error ?? undefined)
      setDeleteConfirmed(false)
    },
    onError: (requestError) => {
      setError(requestError instanceof ApiError ? requestError.message : 'AI 助手暂时无法处理此请求，请稍后重试。')
    },
  })

  const confirmMutation = useMutation({
    mutationFn: () => aiApi.confirm(proposal!.id),
    onSuccess: (response) => {
      setProposal(response)
      setError(response.error ?? undefined)
      if (response.status === 'COMPLETED') {
        void queryClient.invalidateQueries({ queryKey: ['myPlans'] })
        void queryClient.invalidateQueries({ queryKey: ['weekPlans'] })
        void queryClient.invalidateQueries({ queryKey: ['archivedPlans'] })
        void queryClient.invalidateQueries({ queryKey: ['projects'] })
      }
    },
    onError: (requestError) => {
      setError(requestError instanceof ApiError ? requestError.message : '执行失败，请稍后重试。')
    },
  })

  if (!user) return null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const trimmed = message.trim()
    if (!trimmed || proposalMutation.isPending) return
    setError(undefined)
    setProposal(undefined)
    setFields({})
    proposalMutation.mutate(undefined)
  }

  const submitMissing = () => {
    const incomplete = missingFields.find((field) => !fields[field]?.trim())
    if (incomplete) {
      setError(`请补充${fieldLabel(incomplete)}。`)
      return
    }
    const fieldsToSupplement = missingFields.reduce<Record<string, string>>((result, field) => ({ ...result, [field]: fields[field] }), {})
    setError(undefined)
    void aiApi.supplement(proposal!.id, fieldsToSupplement).then((response) => {
      setProposal(response)
      setError(response.error ?? undefined)
    }).catch((requestError: unknown) => {
      setError(requestError instanceof ApiError ? requestError.message : '补充信息失败，请稍后重试。')
    })
  }

  const startConversation = async () => {
    try {
      const detail = await aiApi.createConversation()
      setConversationId(detail.conversation.id)
      setProposal(undefined)
      setFields({})
      setMessage('')
      setShowMemories(false)
      void queryClient.invalidateQueries({ queryKey: ['aiConversations'] })
      queryClient.setQueryData(['aiConversation', detail.conversation.id], detail)
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : '无法创建新对话。')
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="打开 AI 计划助手"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 grid h-14 w-14 place-items-center rounded-full bg-[var(--accent)] text-white shadow-[var(--shadow-lg)] transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <Bot className="h-6 w-6" />
      </button>

      {open && <div className="fixed inset-0 z-50 bg-slate-950/30" onMouseDown={() => setOpen(false)}>
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-assistant-title"
          onMouseDown={(event) => event.stopPropagation()}
          className="absolute bottom-5 right-5 flex max-h-[min(44rem,calc(100vh-2.5rem))] w-[min(30rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--surface-0)] shadow-[var(--shadow-lg)]"
        >
          <header className="flex items-start justify-between gap-4 border-b p-5">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[var(--accent)]"><Bot className="h-5 w-5" /><span className="text-sm font-semibold">AI 计划助手</span></div>
              <h2 id="ai-assistant-title" className="text-xl">用自然语言管理计划</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">AI 可分析本公司全部成员计划；写入仅管理您本人的计划，项目操作仅管理员可执行。</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="关闭" className="rounded-[var(--radius-sm)] p-1 text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"><X className="h-5 w-5" /></button>
          </header>
          <div className="flex items-center gap-2 overflow-x-auto border-b px-4 py-2">
            <button type="button" onClick={() => void startConversation()} className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs"><MessageSquarePlus className="h-3.5 w-3.5" />新对话</button>
            <button type="button" onClick={() => setShowMemories((value) => !value)} className="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-xs"><History className="h-3.5 w-3.5" />公共记忆</button>
            {conversationList.map((item) => <div key={item.id} className={`flex shrink-0 items-center rounded-full border text-xs ${conversationId === item.id ? 'border-[var(--accent)] bg-[var(--accent)]/10' : ''}`}><button type="button" onClick={() => { setConversationId(item.id); setProposal(undefined); setShowMemories(false) }} className="max-w-28 truncate px-2 py-1">{item.title}</button><button type="button" aria-label={`删除对话 ${item.title}`} onClick={() => { if (window.confirm(`删除“${item.title}”及其中聊天记录？`)) void aiApi.deleteConversation(item.id).then(() => { if (conversationId === item.id) setConversationId(null); void queryClient.invalidateQueries({ queryKey: ['aiConversations'] }) }) }} className="px-1 text-[var(--text-secondary)]">×</button></div>)}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {showMemories && <div className="mb-4 space-y-2"><p className="text-sm font-semibold">公司公共 AI 记忆</p>{memories.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">暂无已确认的 AI 增删改记录。</p> : memories.map((item) => <div key={item.id} className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-3 text-sm"><span className="font-medium">{item.actorDisplayName}</span><span className="mx-1 text-xs text-[var(--text-secondary)]">{item.operationType}</span><span>{item.summary}</span></div>)}</div>}
            {currentConversation?.messages.map((item) => <div key={item.id} className={`mb-3 flex ${item.sender === 'USER' ? 'justify-end' : 'justify-start'}`}><p className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-md)] px-3 py-2 text-sm ${item.sender === 'USER' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-primary)]'}`}>{item.content}</p></div>)}
            {!proposal && !proposalMutation.isPending && !currentConversation?.messages.length && <p className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4 text-sm text-[var(--text-secondary)]">例如：“下周三为项目 A 添加用户访谈计划”或“查看本周我的计划”。AI 会先生成预览，写入前需要您确认。</p>}
            {proposalMutation.isPending && <div className="flex items-center gap-2 py-8 text-sm text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />正在理解您的请求…</div>}
            {error && <div role="alert" className="mb-4 rounded-[var(--radius-md)] bg-[var(--status-error)]/10 p-3 text-sm text-[var(--status-error)]">{error}</div>}
            {proposal && <div className="space-y-4">
              {isProjectOperation(proposal.operationType) && !isAdmin && <div role="alert" className="flex gap-2 rounded-[var(--radius-md)] bg-[var(--status-error)]/10 p-3 text-sm text-[var(--status-error)]"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />项目仅管理员可操作。{proposal.error ? `服务端提示：${proposal.error}` : '此请求无法由当前账号执行。'}</div>}
              <div className="rounded-[var(--radius-md)] bg-[var(--surface-2)] p-4">
                <div className="mb-2 flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[var(--text-secondary)]">{isQuery(proposal.operationType) ? '查询结果' : 'AI 操作预览'}</span><span className="rounded-full bg-white px-2 py-1 text-xs text-[var(--text-secondary)]">{proposal.operationType}</span></div>
                <p className="whitespace-pre-wrap text-sm text-[var(--text-primary)]">{proposal.preview || (isQuery(proposal.operationType) ? '已完成只读查询。' : '已生成操作提案。')}</p>
              </div>

              {hasMissingFields && <div className="rounded-[var(--radius-md)] border p-4">
                <h3 className="text-base">还需要这些信息</h3>
                <div className="mt-3 space-y-3">
                  {missingFields.map((field) => field === 'projectId' ? <label key={field} className="block text-sm font-medium">所属项目<select value={fields[field] ?? ''} onChange={(event) => setFields((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 block w-full rounded-[var(--radius-sm)] border bg-white px-3 py-2 text-sm"><option value="">请选择项目</option>{projectChoices.map((project) => <option key={project.id} value={project.id}>{project.code ? `${project.code} · ` : ''}{project.name}</option>)}</select></label> : field === 'weekday' ? <label key={field} className="block text-sm font-medium">星期<select value={fields[field] ?? ''} onChange={(event) => setFields((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 block w-full rounded-[var(--radius-sm)] border bg-white px-3 py-2 text-sm"><option value="">请选择</option>{['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'pending'].map((weekday) => <option key={weekday} value={weekday}>{weekday}</option>)}</select></label> : field === 'resource (plans 或 projects)' ? <label key={field} className="block text-sm font-medium">查询对象<select value={fields[field] ?? ''} onChange={(event) => setFields((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 block w-full rounded-[var(--radius-sm)] border bg-white px-3 py-2 text-sm"><option value="">请选择</option><option value="plans">计划</option><option value="projects">项目</option></select></label> : <label key={field} className="block text-sm font-medium">{fieldLabel(field)}<input value={fields[field] ?? ''} onChange={(event) => setFields((current) => ({ ...current, [field]: event.target.value }))} type={field === 'year' || field === 'weekNumber' ? 'number' : 'text'} className="mt-1 block w-full rounded-[var(--radius-sm)] border bg-white px-3 py-2 text-sm" /></label>)}
                </div>
                <button type="button" onClick={submitMissing} disabled={proposalMutation.isPending} className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">继续解析<ChevronDown className="h-4 w-4" /></button>
              </div>}

              {writeOperation && !hasMissingFields && proposal.status === 'PENDING' && <div className={`rounded-[var(--radius-md)] p-4 ${isDelete(proposal.operationType) ? 'bg-[var(--status-error)]/10' : 'bg-[var(--accent)]/10'}`}>
                <p className="text-sm font-semibold">{isDelete(proposal.operationType) ? '删除操作不可恢复，请进行二次确认。' : '目标确认无误后，才会执行此操作。'}</p>
                {isDelete(proposal.operationType) && <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={deleteConfirmed} onChange={(event) => setDeleteConfirmed(event.target.checked)} />我确认要删除该内容</label>}
                <button type="button" disabled={confirmMutation.isPending || (isDelete(proposal.operationType) && !deleteConfirmed)} onClick={() => confirmMutation.mutate()} className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 ${isDelete(proposal.operationType) ? 'bg-[var(--status-error)]' : 'bg-[var(--accent)]'}`}>{confirmMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : isDelete(proposal.operationType) ? <Trash2 className="h-4 w-4" /> : null}确认执行</button>
              </div>}
            </div>}
          </div>

          <form onSubmit={submit} className="border-t p-4">
            <label className="sr-only" htmlFor="ai-message">向 AI 描述您的需求</label>
            <div className="flex gap-2"><textarea id="ai-message" value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit() } }} rows={2} placeholder="例如：为本周新增一项计划…" className="min-w-0 flex-1 resize-none rounded-[var(--radius-md)] border bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" /><button type="submit" disabled={!message.trim() || proposalMutation.isPending} className="grid h-10 w-10 place-items-center self-end rounded-full bg-[var(--accent)] text-white disabled:cursor-not-allowed disabled:opacity-50" aria-label="发送"><Send className="h-4 w-4" /></button></div>
          </form>
        </section>
      </div>}
    </>
  )
}
