import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Download, ImagePlus, MapPin, Stamp, Upload, X } from 'lucide-react'
import { watermarkEnterpriseApi } from '@/services/api'
import type { WatermarkEnterprise } from '@/types'
import {
  dateLine,
  dateValue,
  formatShortcut,
  fromDateParts,
  hourMinute,
  nowCheckin,
  parseShortcut,
  type CheckinTime,
} from '@/lib/checkinTime'
import { bitmapFromFile, paintPhotoWithWatermark } from '@/lib/checkinWatermark'
import { locationLine, matchesQuery, regionKey, regionLabel } from '@/lib/watermarkPlace'

type Region = { key: string; city: string; county: string; label: string }

export function PhotoWatermarkPage() {
  const queryClient = useQueryClient()
  const [time, setTime] = useState<CheckinTime>(nowCheckin)
  const [shortcut, setShortcut] = useState(() => formatShortcut(nowCheckin()))
  const [shortcutHint, setShortcutHint] = useState('')
  const [regionQuery, setRegionQuery] = useState('')
  const [region, setRegion] = useState<Region | null>(null)
  const [nameQuery, setNameQuery] = useState('')
  const [enterpriseName, setEnterpriseName] = useState('')
  const [extraPlace, setExtraPlace] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const photoRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { data: enterprises = [], isLoading } = useQuery({
    queryKey: ['watermarkEnterprises'],
    queryFn: watermarkEnterpriseApi.list,
  })

  const nameOptions = useMemo(() => {
    const query = nameQuery || enterpriseName
    if (!query.trim()) return []
    return enterprises.filter((item) => matchesQuery(item.name, query)).slice(0, 12)
  }, [enterprises, nameQuery, enterpriseName])
  const regionsFromName = useMemo(
    () => uniqueRegions(enterprises.filter((item) => matchesQuery(item.name, enterpriseName))),
    [enterprises, enterpriseName],
  )
  const regions = useMemo(() => {
    const fromName = enterpriseName.trim() ? regionsFromName : uniqueRegions(enterprises)
    if (!regionQuery.trim() || region) return fromName
    return fromName.filter((item) => matchesQuery(`${item.label}${item.city}${item.county}`, regionQuery))
  }, [enterprises, enterpriseName, regionQuery, region, regionsFromName])
  const regionOptions = regions.slice(0, 12)
  const showRegionMenu = !region && (Boolean(regionQuery.trim()) || (Boolean(enterpriseName.trim()) && regionOptions.length > 0))

  const mark = {
    time: hourMinute(time),
    dateLine: dateLine(time),
    location: locationLine(region?.city ?? '', region?.county ?? '', enterpriseName, extraPlace),
  }

  useEffect(() => {
    if (!photo) {
      setPreviewUrl('')
      return
    }
    let revoked = false
    const render = async () => {
      setBusy(true)
      try {
        const bitmap = await bitmapFromFile(photo)
        const canvas = canvasRef.current
        if (!canvas || revoked) {
          bitmap.close()
          return
        }
        paintPhotoWithWatermark(canvas, bitmap, mark)
        bitmap.close()
        if (!revoked) setPreviewUrl(canvas.toDataURL('image/jpeg', 0.84))
      } finally {
        if (!revoked) setBusy(false)
      }
    }
    void render()
    return () => { revoked = true }
  }, [photo, mark.time, mark.dateLine, mark.location])

  const applyTime = (next: CheckinTime) => {
    setTime(next)
    setShortcut(formatShortcut(next))
    setShortcutHint('')
  }

  const onShortcut = (value: string) => {
    setShortcut(value)
    const parsed = parseShortcut(value)
    if (parsed) {
      setTime(parsed)
      setShortcutHint(`${dateLine(parsed)} ${hourMinute(parsed)}`)
    } else if (value.replace(/\D/g, '').length >= 9) {
      setShortcutHint('格式应为 261023954，即 26年10月23日 9:54')
    } else setShortcutHint('')
  }

  const onDate = (value: string) => {
    const parsed = fromDateParts(value, time.hour, time.minute)
    if (parsed) applyTime(parsed)
  }

  const onClock = (hour: number, minute: number) => {
    const parsed = fromDateParts(dateValue(time), hour, minute)
    if (parsed) applyTime(parsed)
  }

  const pickRegion = (item: Region) => {
    setRegion(item)
    setRegionQuery(item.label)
  }

  const pickEnterprise = (item: WatermarkEnterprise) => {
    const next = toRegion(item)
    setEnterpriseName(item.name)
    setNameQuery('')
    setRegion(next)
    setRegionQuery(next.label)
  }

  const onEnterpriseName = (value: string) => {
    setEnterpriseName(value)
    setNameQuery(value)
    const exact = enterprises.filter((item) => item.name === value.trim())
    const fuzzy = enterprises.filter((item) => matchesQuery(item.name, value))
    const hits = exact.length ? exact : fuzzy
    const places = uniqueRegions(hits)
    if (value.trim() && places.length === 1) {
      setRegion(places[0])
      setRegionQuery(places[0].label)
    } else if (region && !places.some((item) => item.key === region.key)) {
      setRegion(null)
      setRegionQuery('')
    }
  }

  const download = async () => {
    if (!photo || !canvasRef.current) return
    const blob = await new Promise<Blob | null>((resolve) => canvasRef.current?.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    const base = photo.name.replace(/\.[^.]+$/, '')
    anchor.href = url
    anchor.download = `${base}-打卡水印.jpg`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const importFile = async (file?: File) => {
    if (!file) return
    setImporting(true)
    setImportMessage('')
    try {
      const result = await watermarkEnterpriseApi.importWorkbook(file)
      await queryClient.invalidateQueries({ queryKey: ['watermarkEnterprises'] })
      setImportMessage(`已写入 ${result.inserted} 家，已存在 ${result.existed} 家，跳过 ${result.skipped} 行`)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '企业表导入失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <main className="ml-64 min-h-screen max-w-[88rem] p-[var(--spacing-2xl)]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Stamp className="text-accent" />
            <h2>照片加水印</h2>
          </div>
          <p className="mt-2 text-secondary">按打卡样式叠加时间与地点。时间可用 261023954 这种快捷码；输入企业名称后会自动带出市区。</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,text/csv" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
          <button className="btn-secondary flex items-center gap-2" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4" />
            {importing ? '正在导入…' : '上传企业表'}
          </button>
        </div>
      </header>

      {importMessage && <p className="mb-4 text-sm text-secondary">{importMessage}</p>}
      {isLoading && <p className="mb-4 text-sm text-secondary">正在加载企业名录…</p>}
      {!isLoading && enterprises.length === 0 && (
        <p className="mb-4 rounded-[var(--radius-md)] border bg-[var(--surface-2)] px-4 py-3 text-sm text-secondary">
          还没有企业名录。请上传企业清单（xlsx / xls / csv）。有表头时认「企业名称、市、区县」；没有表头也可以，按截图那种列：企业名、代码、行业、市、区县。只保存名称和区县，市用来区分沈阳铁西、鞍山铁西。
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
        <section className="card space-y-5">
          <Field label="照片">
            <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
            <button type="button" className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed px-3 py-8 text-sm text-secondary hover:border-[var(--accent)] hover:text-accent" onClick={() => photoRef.current?.click()}>
              <ImagePlus className="h-5 w-5" />
              {photo ? photo.name : '选择或拍摄照片'}
            </button>
          </Field>

          <Field label="快捷时间" hint="261023954 = 2026年10月23日 09:54，自动补星期">
            <input value={shortcut} onChange={(event) => onShortcut(event.target.value)} inputMode="numeric" placeholder="261023954" className="w-full rounded-[var(--radius-md)] border p-2" />
            {shortcutHint && <p className="mt-1 text-xs text-secondary">{shortcutHint}</p>}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="手选日期">
              <input type="date" value={dateValue(time)} onChange={(event) => onDate(event.target.value)} className="w-full rounded-[var(--radius-md)] border p-2" />
            </Field>
            <Field label="时 / 分">
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={23} value={time.hour} onChange={(event) => onClock(Number(event.target.value) || 0, time.minute)} className="w-full rounded-[var(--radius-md)] border p-2" />
                <span>:</span>
                <input type="number" min={0} max={59} value={time.minute} onChange={(event) => onClock(time.hour, Number(event.target.value) || 0)} className="w-full rounded-[var(--radius-md)] border p-2" />
              </div>
            </Field>
          </div>
          <button type="button" className="text-sm text-accent" onClick={() => applyTime(nowCheckin())}>填入当前时间</button>

          <Field label="企业名称" hint="输入名称后自动带出市区">
            <div className="relative">
              <input
                value={enterpriseName}
                onChange={(event) => onEnterpriseName(event.target.value)}
                placeholder="输入或筛选企业名称"
                className="w-full rounded-[var(--radius-md)] border p-2"
              />
              {nameQuery && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-md)] border bg-white shadow-[var(--shadow-md)]">
                  {nameOptions.length ? nameOptions.map((item) => (
                    <li key={item.id}>
                      <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" onClick={() => pickEnterprise(item)}>
                        <span className="truncate">{item.name}</span>
                        <span className="shrink-0 text-xs text-secondary">{regionLabel(item.city, item.county)}</span>
                      </button>
                    </li>
                  )) : <li className="px-3 py-2 text-sm text-secondary">名录里没有匹配企业，仍可手填</li>}
                </ul>
              )}
            </div>
          </Field>

          <Field
            label="区域"
            hint={regionsFromName.length > 1 ? '该名称对应多个市区，点选一个' : '唯一匹配会自动带出；也可搜铁西手动改'}
          >
            <div className="relative">
              <input
                value={regionQuery}
                onChange={(event) => {
                  setRegionQuery(event.target.value)
                  setRegion(null)
                }}
                placeholder="自动带出，或搜索区县"
                className="w-full rounded-[var(--radius-md)] border p-2"
              />
              {showRegionMenu && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-[var(--radius-md)] border bg-white shadow-[var(--shadow-md)]">
                  {regionOptions.length ? regionOptions.map((item) => (
                    <li key={item.key}>
                      <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--surface-2)]" onClick={() => pickRegion(item)}>
                        <MapPin className="h-3.5 w-3.5 text-accent" />
                        {item.label}
                        <span className="text-xs text-secondary">{item.city}{item.county}</span>
                      </button>
                    </li>
                  )) : <li className="px-3 py-2 text-sm text-secondary">没有匹配区域</li>}
                </ul>
              )}
            </div>
            {region && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-sm text-accent">
                {region.label}
                <button type="button" aria-label="清除区域" onClick={() => { setRegion(null); setRegionQuery('') }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </p>
            )}
          </Field>

          <Field label="地点补充（可选）" hint="例如东站街道，会插在区县和企业名之间">
            <input value={extraPlace} onChange={(event) => setExtraPlace(event.target.value)} placeholder="街道或门牌，可留空" className="w-full rounded-[var(--radius-md)] border p-2" />
          </Field>

          <p className="rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2 text-sm text-secondary">{mark.location || '地点将显示在水印第三行'}</p>

          <button className="btn-primary flex w-full items-center justify-center gap-2" disabled={!photo || !enterpriseName.trim() || busy} onClick={() => void download()}>
            <Download className="h-4 w-4" />
            下载水印照片
          </button>
        </section>

        <section className="card min-h-[28rem] overflow-hidden">
          <div className="mb-3 flex items-center gap-2 text-sm text-secondary">
            <Camera className="h-4 w-4" />
            预览
            {busy && <span>正在生成…</span>}
          </div>
          {previewUrl ? (
            <img src={previewUrl} alt="水印预览" className="max-h-[70vh] w-full rounded-[var(--radius-md)] object-contain" />
          ) : (
            <div className="flex h-[28rem] items-center justify-center rounded-[var(--radius-md)] bg-[var(--surface-2)] text-sm text-secondary">
              选择照片后，左下角会叠上打卡水印
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />
        </section>
      </div>
    </main>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-medium">
        {label}
        {hint && <span className="ml-2 font-normal text-xs text-secondary">{hint}</span>}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function toRegion(item: WatermarkEnterprise): Region {
  return { key: regionKey(item.city, item.county), city: item.city, county: item.county, label: regionLabel(item.city, item.county) }
}

function uniqueRegions(enterprises: WatermarkEnterprise[]): Region[] {
  const map = new Map<string, Region>()
  for (const item of enterprises) {
    const next = toRegion(item)
    if (!map.has(next.key)) map.set(next.key, next)
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}
