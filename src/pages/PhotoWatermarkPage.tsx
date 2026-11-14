import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Download, ImagePlus, MapPin, Stamp, Upload, X, ZoomIn, ZoomOut } from 'lucide-react'
import { watermarkEnterpriseApi } from '@/services/api'
import type { WatermarkEnterprise } from '@/types'
import {
  dateLine,
  dateValue,
  formatShortcut,
  fromDateParts,
  fromIso,
  hourMinute,
  nowCheckin,
  parseShortcut,
  type CheckinTime,
} from '@/lib/checkinTime'
import { bitmapFromFile, paintPhotoWithWatermark } from '@/lib/checkinWatermark'
import { locationLine, matchesQuery, regionKey, regionLabel } from '@/lib/watermarkPlace'
import { safeFolderName, zipFolder } from '@/lib/folderZip'

type Region = { key: string; city: string; county: string; label: string }

const VISITS = [
  { key: 'visit1At' as const, title: '第一张', hint: '默认用表内第一次时间' },
  { key: 'visit2At' as const, title: '第二张', hint: '默认用表内第二次时间' },
  { key: 'visit3At' as const, title: '第三张', hint: '默认用表内第三次时间' },
]

export function PhotoWatermarkPage() {
  const queryClient = useQueryClient()
  const [regionQuery, setRegionQuery] = useState('')
  const [region, setRegion] = useState<Region | null>(null)
  const [nameQuery, setNameQuery] = useState('')
  const [enterpriseName, setEnterpriseName] = useState('')
  const [extraPlace, setExtraPlace] = useState('')
  const [times, setTimes] = useState<CheckinTime[]>(() => [nowCheckin(), nowCheckin(), nowCheckin()])
  const [shortcuts, setShortcuts] = useState(() => [nowCheckin(), nowCheckin(), nowCheckin()].map(formatShortcut))
  const [timeHints, setTimeHints] = useState(['', '', ''])
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null])
  const [previews, setPreviews] = useState<string[]>(['', '', ''])
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState('')
  const [useCompanyFolder, setUseCompanyFolder] = useState(true)
  const [customFolderName, setCustomFolderName] = useState('')
  const [dragOver, setDragOver] = useState<number | 'all' | null>(null)
  const [viewer, setViewer] = useState<{ index: number; zoom: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRefs = useRef<Array<HTMLInputElement | null>>([null, null, null])
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

  const selectedEnterprise = useMemo(() => {
    const exact = enterprises.filter((item) => item.name === enterpriseName.trim())
    const inPlace = region
      ? exact.filter((item) => item.city === region.city && item.county === region.county)
      : exact
    if (inPlace.length === 1) return inPlace[0]
    if (exact.length === 1) return exact[0]
    return null
  }, [enterprises, enterpriseName, region])

  useEffect(() => {
    const nextTimes = VISITS.map((visit) => fromIso(selectedEnterprise?.[visit.key]) ?? nowCheckin())
    setTimes(nextTimes)
    setShortcuts(nextTimes.map(formatShortcut))
    setTimeHints(VISITS.map((visit) => (
      fromIso(selectedEnterprise?.[visit.key]) ? '' : selectedEnterprise ? '表内无此时间，可手填' : ''
    )))
  }, [selectedEnterprise?.id, selectedEnterprise?.visit1At, selectedEnterprise?.visit2At, selectedEnterprise?.visit3At])

  useEffect(() => {
    setPhotos([null, null, null])
    setPreviews(['', '', ''])
  }, [selectedEnterprise?.id])

  const location = locationLine(region?.city ?? '', region?.county ?? '', enterpriseName, extraPlace)
  const readyCount = photos.filter(Boolean).length
  const folderName = safeFolderName(
    useCompanyFolder ? enterpriseName : (customFolderName.trim() || '新建文件夹'),
  )

  useEffect(() => {
    let revoked = false
    const render = async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const next = ['', '', '']
      setBusy(true)
      try {
        for (let index = 0; index < 3; index++) {
          const photo = photos[index]
          if (!photo) continue
          const bitmap = await bitmapFromFile(photo)
          if (revoked) {
            bitmap.close()
            return
          }
          paintPhotoWithWatermark(canvas, bitmap, {
            time: hourMinute(times[index]),
            dateLine: dateLine(times[index]),
            location,
          })
          bitmap.close()
          next[index] = canvas.toDataURL('image/jpeg', 0.84)
        }
        if (!revoked) setPreviews(next)
      } finally {
        if (!revoked) setBusy(false)
      }
    }
    void render()
    return () => { revoked = true }
  }, [photos, times, location])

  useEffect(() => {
    if (!viewer) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setViewer(null)
      if (event.key === '+' || event.key === '=') {
        setViewer((current) => current ? { ...current, zoom: clampZoom(current.zoom, 0.25) } : current)
      }
      if (event.key === '-' || event.key === '_') {
        setViewer((current) => current ? { ...current, zoom: clampZoom(current.zoom, -0.25) } : current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewer])

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

  const applyTime = (index: number, next: CheckinTime) => {
    setTimes((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))
    setShortcuts((current) => current.map((item, itemIndex) => itemIndex === index ? formatShortcut(next) : item))
    setTimeHints((current) => current.map((item, itemIndex) => itemIndex === index ? '' : item))
  }

  const onShortcut = (index: number, value: string) => {
    setShortcuts((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))
    const parsed = parseShortcut(value)
    if (parsed) {
      setTimes((current) => current.map((item, itemIndex) => itemIndex === index ? parsed : item))
      setTimeHints((current) => current.map((item, itemIndex) => (
        itemIndex === index ? `${dateLine(parsed)} ${hourMinute(parsed)}` : item
      )))
    } else if (value.replace(/\D/g, '').length >= 9) {
      setTimeHints((current) => current.map((item, itemIndex) => (
        itemIndex === index ? '格式应为 261023954，即 26年10月23日 9:54' : item
      )))
    }
  }

  const setPhotoAt = (index: number, file: File | null) => {
    setPhotos((current) => current.map((item, itemIndex) => itemIndex === index ? file : item))
  }

  const takeImages = (files: FileList | File[]) => [...files].filter((file) =>
    file.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(file.name)
  )

  const fillPhotos = (files: File[], start = 0) => {
    if (!files.length) return
    setPhotos((current) => {
      const next = [...current]
      files.slice(0, 3 - start).forEach((file, offset) => {
        next[start + offset] = file
      })
      return next
    })
  }

  const onDragOverZone = (event: DragEvent, zone: number | 'all') => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragOver(zone)
  }

  const onDropSlot = (index: number, event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setDragOver(null)
    const images = takeImages(event.dataTransfer.files)
    if (!images.length) return
    if (images.length === 1) setPhotoAt(index, images[0])
    else fillPhotos(images, index)
  }

  const onDropAll = (event: DragEvent) => {
    event.preventDefault()
    setDragOver(null)
    const images = takeImages(event.dataTransfer.files)
    if (!images.length) return
    const firstEmpty = photos.findIndex((item) => !item)
    fillPhotos(images, firstEmpty === -1 ? 0 : firstEmpty)
  }

  const bumpZoom = (delta: number) => {
    setViewer((current) => current ? { ...current, zoom: clampZoom(current.zoom, delta) } : current)
  }

  const importFile = async (file?: File) => {
    if (!file) return
    setImporting(true)
    setImportMessage('')
    try {
      const result = await watermarkEnterpriseApi.importWorkbook(file)
      await queryClient.invalidateQueries({ queryKey: ['watermarkEnterprises'] })
      setImportMessage(`新增 ${result.inserted} 家，更新 ${result.updated} 家，未改动 ${result.unchanged} 家，跳过 ${result.skipped} 行`)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '企业表导入失败')
    } finally {
      setImporting(false)
    }
  }

  const downloadReady = async () => {
    const canvas = canvasRef.current
    if (!canvas || !enterpriseName.trim() || readyCount === 0) return
    setBusy(true)
    try {
      const files: { blob: Blob; name: string }[] = []
      for (let index = 0; index < 3; index++) {
        const photo = photos[index]
        if (!photo) continue
        const bitmap = await bitmapFromFile(photo)
        paintPhotoWithWatermark(canvas, bitmap, {
          time: hourMinute(times[index]),
          dateLine: dateLine(times[index]),
          location,
        })
        bitmap.close()
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
        if (!blob) continue
        files.push({ blob, name: `${index + 1}.jpg` })
      }
      if (!files.length) return
      const zip = await zipFolder(folderName, files)
      const url = URL.createObjectURL(zip)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `${folderName}.zip`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="ml-64 min-h-screen max-w-[52rem] p-[var(--spacing-2xl)]">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Stamp className="text-accent" />
            <h2>照片加水印</h2>
          </div>
          <p className="mt-2 text-secondary">同一页传最多三张，点一次下载已选的。时间默认用表里的三次时间。</p>
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
          还没有企业名录。请上传带表头的清单：企业名称、市、区(县)、第一次/第二次/第三次诊断时间。
        </p>
      )}

      <section className="card space-y-5">
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
        <p className="rounded-[var(--radius-md)] bg-[var(--surface-2)] px-3 py-2 text-sm text-secondary">{location || '地点将显示在水印第三行'}</p>

        <div
          className={`space-y-3 rounded-[var(--radius-md)] p-1 ${dragOver === 'all' ? 'bg-teal-50' : ''}`}
          onDragOver={(event) => onDragOverZone(event, 'all')}
          onDragLeave={() => setDragOver((current) => current === 'all' ? null : current)}
          onDrop={onDropAll}
        >
          <p className="text-sm font-medium">三张照片 <span className="ml-2 font-normal text-xs text-secondary">可拖入图片，有几张传几张，时间来自表格</span></p>
          {VISITS.map((visit, index) => (
            <div key={visit.key} className="rounded-[var(--radius-md)] border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{visit.title}</p>
                <p className="text-xs text-secondary">{visit.hint}</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                <input
                  ref={(node) => { photoRefs.current[index] = node }}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const images = takeImages(event.target.files ?? [])
                    event.target.value = ''
                    if (images.length <= 1) setPhotoAt(index, images[0] ?? null)
                    else fillPhotos(images, index)
                  }}
                />
                <button
                  type="button"
                  className={`flex min-h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed px-3 py-2 text-sm hover:border-[var(--accent)] hover:text-accent ${
                    dragOver === index ? 'border-[var(--accent)] bg-teal-50 text-accent' : 'text-secondary'
                  }`}
                  onClick={() => photoRefs.current[index]?.click()}
                  onDragOver={(event) => {
                    event.stopPropagation()
                    onDragOverZone(event, index)
                  }}
                  onDragLeave={() => setDragOver((current) => current === index ? null : current)}
                  onDrop={(event) => onDropSlot(index, event)}
                >
                  <ImagePlus className="h-4 w-4" />
                  <span className="truncate">{photos[index]?.name ?? '拖到这里，或点选照片'}</span>
                </button>
                <input
                  type="date"
                  value={dateValue(times[index])}
                  onChange={(event) => {
                    const parsed = fromDateParts(event.target.value, times[index].hour, times[index].minute)
                    if (parsed) applyTime(index, parsed)
                  }}
                  className="rounded-[var(--radius-md)] border p-2 text-sm"
                />
                <div className="flex items-center gap-1">
                  <ClockPartInput
                    value={times[index].hour}
                    max={23}
                    onCommit={(hour) => {
                      const parsed = fromDateParts(dateValue(times[index]), hour, times[index].minute)
                      if (parsed) applyTime(index, parsed)
                    }}
                  />
                  <span>:</span>
                  <ClockPartInput
                    value={times[index].minute}
                    max={59}
                    onCommit={(minute) => {
                      const parsed = fromDateParts(dateValue(times[index]), times[index].hour, minute)
                      if (parsed) applyTime(index, parsed)
                    }}
                  />
                </div>
              </div>
              <input
                value={shortcuts[index]}
                onChange={(event) => onShortcut(index, event.target.value)}
                inputMode="numeric"
                placeholder="快捷时间 261023954"
                className="mt-2 w-full rounded-[var(--radius-md)] border p-2 text-sm"
              />
              {timeHints[index] && <p className="mt-1 text-xs text-secondary">{timeHints[index]}</p>}
              {photos[index] && (
                <button type="button" className="mt-1 text-xs text-secondary" onClick={() => setPhotoAt(index, null)}>清除这张</button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2 rounded-[var(--radius-md)] border px-3 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useCompanyFolder}
              onChange={(event) => setUseCompanyFolder(event.target.checked)}
            />
            默认用公司名作为文件夹
          </label>
          {!useCompanyFolder && (
            <input
              value={customFolderName}
              onChange={(event) => setCustomFolderName(event.target.value)}
              placeholder="自命名，留空则为新建文件夹"
              className="w-full rounded-[var(--radius-md)] border p-2 text-sm"
            />
          )}
          <p className="text-xs text-secondary">将下载为「{folderName}」文件夹，照片按诊断次数命名为 1.jpg / 2.jpg / 3.jpg</p>
        </div>

        <button
          className="btn-primary flex w-full items-center justify-center gap-2"
          disabled={readyCount === 0 || !enterpriseName.trim() || busy}
          onClick={() => void downloadReady()}
        >
          <Download className="h-4 w-4" />
          {readyCount ? `下载 ${folderName}（${readyCount} 张）` : '先选照片再下载'}
        </button>
        <canvas ref={canvasRef} className="hidden" />
      </section>

      <section className="mt-6">
        <div className="mb-2 flex items-center gap-2 text-sm text-secondary">
          <Camera className="h-4 w-4" />
          预览
          {busy && <span>正在生成…</span>}
          {readyCount > 0 && <span>点图可放大缩小</span>}
        </div>
        {readyCount ? (
          <div className="flex gap-3 overflow-x-auto">
            {VISITS.map((visit, index) => (
              previews[index] ? (
                <figure key={visit.key} className="w-40 shrink-0">
                  <button type="button" className="block w-full" onClick={() => setViewer({ index, zoom: 1 })}>
                    <img src={previews[index]} alt={`${visit.title}预览`} className="h-28 w-40 rounded-[var(--radius-md)] object-cover" />
                  </button>
                  <figcaption className="mt-1 text-center text-xs text-secondary">{visit.title}</figcaption>
                </figure>
              ) : null
            ))}
          </div>
        ) : (
          <p className="text-sm text-secondary">把照片拖进上方格子后，缩略图会显示在这里</p>
        )}
      </section>

      {viewer && previews[viewer.index] && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/72"
          onClick={() => setViewer(null)}
          onWheel={(event) => {
            event.preventDefault()
            bumpZoom(event.deltaY > 0 ? -0.15 : 0.15)
          }}
        >
          <div className="flex items-center justify-between gap-3 px-5 py-3 text-white" onClick={(event) => event.stopPropagation()}>
            <p className="text-sm">{VISITS[viewer.index].title} · {Math.round(viewer.zoom * 100)}%</p>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded-full bg-white/15 p-2" aria-label="缩小" onClick={() => bumpZoom(-0.25)}>
                <ZoomOut className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-full bg-white/15 p-2" aria-label="放大" onClick={() => bumpZoom(0.25)}>
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" className="rounded-full bg-white/15 px-3 py-2 text-sm" onClick={() => setViewer((current) => current ? { ...current, zoom: 1 } : current)}>
                重置
              </button>
              <button type="button" className="rounded-full bg-white/15 p-2" aria-label="关闭预览" onClick={() => setViewer(null)}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-6">
            <img
              src={previews[viewer.index]}
              alt={`${VISITS[viewer.index].title}大图`}
              style={{ transform: `scale(${viewer.zoom})`, transformOrigin: 'center center' }}
              className="max-h-full max-w-full rounded-md object-contain transition-transform"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </div>
      )}
    </main>
  )
}

function ClockPartInput({
  value,
  max,
  onCommit,
}: {
  value: number
  max: number
  onCommit: (n: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(String(value))
  }, [value, focused])

  return (
    <input
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={2}
      value={focused ? text : String(value)}
      onFocus={(event) => {
        setFocused(true)
        setText(String(value))
        event.target.select()
      }}
      onChange={(event) => {
        const raw = event.target.value.replace(/\D/g, '').slice(0, 2)
        setText(raw)
        if (raw === '') return
        const n = Number(raw)
        if (n <= max) onCommit(n)
      }}
      onBlur={() => {
        setFocused(false)
        if (text === '') {
          setText(String(value))
          return
        }
        const n = Math.min(max, Number(text))
        onCommit(n)
        setText(String(n))
      }}
      className="w-16 rounded-[var(--radius-md)] border p-2 text-sm"
    />
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

function clampZoom(zoom: number, delta: number) {
  return Math.min(4, Math.max(0.4, Number((zoom + delta).toFixed(2))))
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
