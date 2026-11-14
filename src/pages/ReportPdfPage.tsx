import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { FileDown, ImagePlus, Stamp, Upload } from 'lucide-react'
import { reportPdfApi } from '@/services/api'

export function ReportPdfPage() {
  const [word, setWord] = useState<File | null>(null)
  const [cover, setCover] = useState<File | null>(null)
  const [coverUrl, setCoverUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [dragOver, setDragOver] = useState<'word' | 'cover' | null>(null)
  const [format, setFormat] = useState<'pdf' | 'word'>('pdf')
  const wordRef = useRef<HTMLInputElement>(null)
  const coverRef = useRef<HTMLInputElement>(null)

  const onCover = (file: File | null) => {
    setCover(file)
    setCoverUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return file ? URL.createObjectURL(file) : ''
    })
  }

  const setReport = (file: File | null) => {
    setWord(file)
    if (file && isPdf(file)) setFormat('pdf')
  }

  const applyFiles = (files: FileList | File[], prefer: 'word' | 'cover' | 'any') => {
    const list = [...files]
    const reportFile = list.find(isReport)
    const coverFile = list.find(isCover)
    if (prefer === 'word') {
      if (reportFile) setReport(reportFile)
      return
    }
    if (prefer === 'cover') {
      if (coverFile) onCover(coverFile)
      return
    }
    if (reportFile) setReport(reportFile)
    if (coverFile) onCover(coverFile)
  }

  const onDragOverZone = (event: DragEvent, zone: 'word' | 'cover') => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setDragOver(zone)
  }

  const onDropZone = (event: DragEvent, zone: 'word' | 'cover') => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(null)
    applyFiles(event.dataTransfer.files, zone)
  }

  const convert = async () => {
    if (!word || !cover) return
    setBusy(true)
    setMessage('')
    try {
      const exportFormat = isPdf(word) ? 'pdf' : format
      await reportPdfApi.convert(word, cover, exportFormat)
      setMessage(exportFormat === 'word'
        ? '已下载 Word：第 1 页是封面图，原来的封面页已去掉。'
        : '已下载 PDF：第 1 页是封面图，原来的第 1 页已去掉，后面页保留。')
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
        <p className="mt-2 text-secondary">上传 Word 或 PDF，再上传盖章封面图。第 1 页换成这张图，原来的第 1 页去掉，后面页保留。PDF 报告只能导出 PDF。</p>
      </header>

      <section
        className="card space-y-5"
        onDragOver={(event) => {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragOver(null)
          applyFiles(event.dataTransfer.files, 'any')
        }}
      >
        <div>
          <p className="text-sm font-medium">报告</p>
          <input
            ref={wordRef}
            type="file"
            accept=".doc,.docx,.pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            className="hidden"
            onChange={(event) => setReport(event.target.files?.[0] ?? null)}
          />
          <DropButton
            active={dragOver === 'word'}
            onClick={() => wordRef.current?.click()}
            onDragOver={(event) => onDragOverZone(event, 'word')}
            onDragLeave={() => setDragOver((current) => current === 'word' ? null : current)}
            onDrop={(event) => onDropZone(event, 'word')}
          >
            <Upload className="h-4 w-4" />
            {word ? word.name : '拖到这里，或选择 .doc / .docx / .pdf'}
          </DropButton>
        </div>

        <div>
          <p className="text-sm font-medium">封面图 <span className="ml-2 font-normal text-xs text-secondary">盖章扫描件，jpg 或 png</span></p>
          <input
            ref={coverRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(event) => onCover(event.target.files?.[0] ?? null)}
          />
          <DropButton
            active={dragOver === 'cover'}
            onClick={() => coverRef.current?.click()}
            onDragOver={(event) => onDragOverZone(event, 'cover')}
            onDragLeave={() => setDragOver((current) => current === 'cover' ? null : current)}
            onDrop={(event) => onDropZone(event, 'cover')}
          >
            <ImagePlus className="h-4 w-4" />
            {cover ? cover.name : '拖到这里，或选择封面图片'}
          </DropButton>
          {coverUrl && (
            <img src={coverUrl} alt="封面预览" className="mt-3 max-h-64 w-full rounded-[var(--radius-md)] bg-[var(--surface-2)] object-contain" />
          )}
        </div>

        <div>
          <p className="text-sm font-medium">导出格式</p>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={format === 'pdf' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setFormat('pdf')}
            >
              PDF
            </button>
            <button
              type="button"
              className={format === 'word' && !(word && isPdf(word)) ? 'btn-primary' : 'btn-secondary'}
              disabled={!!word && isPdf(word)}
              onClick={() => setFormat('word')}
            >
              Word
            </button>
          </div>
        </div>

        <button className="btn-primary flex w-full items-center justify-center gap-2" disabled={!word || !cover || busy} onClick={() => void convert()}>
          <Stamp className="h-4 w-4" />
          {busy ? '正在生成，请稍候…' : format === 'word' ? '生成 Word' : '生成 PDF'}
        </button>
        {message && <p className="text-sm text-secondary">{message}</p>}
      </section>
    </main>
  )
}

function isPdf(file: File) {
  return /\.pdf$/i.test(file.name) || file.type === 'application/pdf'
}

function isReport(file: File) {
  return isPdf(file)
    || /\.docx?$/i.test(file.name)
    || file.type === 'application/msword'
    || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

function isCover(file: File) {
  return file.type.startsWith('image/') || /\.(jpe?g|png)$/i.test(file.name)
}

function DropButton({
  active,
  children,
  onClick,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
  onDragOver: (event: DragEvent<HTMLButtonElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLButtonElement>) => void
}) {
  return (
    <button
      type="button"
      className={`mt-1 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed px-3 py-6 text-sm hover:border-[var(--accent)] hover:text-accent ${
        active ? 'border-[var(--accent)] bg-teal-50 text-accent' : 'text-secondary'
      }`}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </button>
  )
}
