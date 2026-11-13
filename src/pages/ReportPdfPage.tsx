import { useRef, useState } from 'react'
import { FileDown, ImagePlus, Stamp, Upload } from 'lucide-react'
import { reportPdfApi } from '@/services/api'

export function ReportPdfPage() {
  const [word, setWord] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const wordRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const onCover = (file: File | null) => {
    setCover(file)
    setCoverUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return file ? URL.createObjectURL(file) : ''
    })
  }

  const convert = async () => {
    if (!word || !cover) return
    setBusy(true)
    setMessage('')
    try {
      await reportPdfApi.convert(word, cover)
      setMessage('已下载 PDF：第 1 页是封面图，后面是 Word 其余页。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '转换失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="ml-64 min-h-screen max-w-[52rem] p-[var(--spacing-2xl)]">
      <header className="mb-6">
        <div className="flex items-center gap-3">
          <FileDown className="text-accent" />
          <h2>报告转PDF</h2>
        </div>
        <p className="mt-2 text-secondary">上传 Word 报告和盖章封面图。生成的 PDF 第 1 页整页换成这张图，Word 原来的第 1 页不要，后面页保留。</p>
      </header>

      <section className="card space-y-5">
        <div>
          <p className="text-sm font-medium">Word 报告</p>
          <input ref={wordRef} type="file" accept=".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={(event) => setWord(event.target.files?.[0] ?? null)} />
          <button type="button" className="mt-1 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed px-3 py-6 text-sm text-secondary hover:border-[var(--accent)] hover:text-accent" onClick={() => wordRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {word ? word.name : '选择 .doc / .docx'}
          </button>
        </div>

        <div>
          <p className="text-sm font-medium">封面图 <span className="ml-2 font-normal text-xs text-secondary">盖章扫描件，jpg 或 png</span></p>
          <input ref={coverRef} type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" className="hidden" onChange={(event) => onCover(event.target.files?.[0] ?? null)} />
          <button type="button" className="mt-1 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed px-3 py-6 text-sm text-secondary hover:border-[var(--accent)] hover:text-accent" onClick={() => coverRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
            {cover ? cover.name : '选择封面图片'}
          </button>
          {coverUrl && (
            <img src={coverUrl} alt="封面预览" className="mt-3 max-h-64 w-full rounded-[var(--radius-md)] object-contain bg-[var(--surface-2)]" />
          )}
        </div>

        <button className="btn-primary flex w-full items-center justify-center gap-2" disabled={!word || !cover || busy} onClick={() => void convert()}>
          <Stamp className="h-4 w-4" />
          {busy ? '正在转换，请稍候…' : '生成 PDF'}
        </button>
        {message && <p className="text-sm text-secondary">{message}</p>}
      </section>
    </main>
  )
}
