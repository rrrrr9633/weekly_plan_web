export type CheckinMark = {
  time: string
  dateLine: string
  location: string
}

export async function bitmapFromFile(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return await createImageBitmap(file)
  }
}

export function paintPhotoWithWatermark(
  canvas: HTMLCanvasElement,
  image: ImageBitmap,
  mark: CheckinMark
) {
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(image, 0, 0)
  paintCheckinWatermark(ctx, image.width, image.height, mark)
}

export function paintCheckinWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  mark: CheckinMark
) {
  const unit = Math.max(14, Math.min(width, height) / 18)
  const left = width * 0.045
  const bottom = height * 0.05
  const timeSize = unit * 1.55
  const dateSize = unit * 0.72
  const locSize = unit * 0.62
  const gap = unit * 0.28
  const locLines = wrapText(ctx, mark.location, locSize, width * 0.78)
  const locBlock = locLines.length * locSize * 1.25
  const dateY = height - bottom - locBlock - gap
  const timeY = dateY - dateSize - gap * 1.4

  ctx.save()
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(0, 0, 0, 0.58)'
  ctx.shadowBlur = unit * 0.42
  ctx.shadowOffsetY = unit * 0.08

  const badge = drawBadge(ctx, left, timeY, unit)
  ctx.fillStyle = '#ffffff'
  ctx.font = `700 ${timeSize}px "PingFang SC", "Noto Sans SC", sans-serif`
  ctx.fillText(mark.time, badge.right + unit * 0.35, timeY)

  ctx.font = `600 ${dateSize}px "PingFang SC", "Noto Sans SC", sans-serif`
  ctx.fillText(mark.dateLine, left, dateY)

  ctx.font = `500 ${locSize}px "PingFang SC", "Noto Sans SC", sans-serif`
  locLines.forEach((line, index) => {
    const y = dateY + gap + locSize + index * locSize * 1.25
    drawDot(ctx, left + locSize * 0.28, y - locSize * 0.32, locSize * 0.22)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(line, left + locSize * 0.7, y)
  })
  ctx.restore()
}

function drawBadge(ctx: CanvasRenderingContext2D, x: number, baseline: number, unit: number) {
  const height = unit * 1.02
  const fontSize = height * 0.5
  const label = '打卡'
  ctx.save()
  ctx.shadowColor = 'transparent'
  ctx.font = `700 ${fontSize}px "PingFang SC", "Noto Sans SC", sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const textW = ctx.measureText(label).width
  const padX = height * 0.26
  const checkR = height * 0.26
  const gap = height * 0.18
  const width = padX + checkR * 2 + gap + textW + padX
  const y = baseline - height * 0.8
  const radius = height / 2

  roundRect(ctx, x, y, width, height, radius)
  ctx.fillStyle = '#21C45A'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = Math.max(1, unit * 0.04)
  ctx.stroke()

  const cx = x + padX + checkR
  const cy = y + height * 0.5
  ctx.beginPath()
  ctx.arc(cx, cy, checkR, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.beginPath()
  ctx.strokeStyle = '#21C45A'
  ctx.lineWidth = Math.max(1.6, unit * 0.08)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.moveTo(cx - checkR * 0.42, cy + checkR * 0.04)
  ctx.lineTo(cx - checkR * 0.06, cy + checkR * 0.36)
  ctx.lineTo(cx + checkR * 0.46, cy - checkR * 0.3)
  ctx.stroke()

  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, cx + checkR + gap, cy + height * 0.02)
  ctx.restore()
  return { right: x + width }
}

function drawDot(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.save()
  ctx.shadowColor = 'transparent'
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = '#21C45A'
  ctx.fill()
  ctx.restore()
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, fontSize: number, maxWidth: number): string[] {
  ctx.font = `500 ${fontSize}px "PingFang SC", "Noto Sans SC", sans-serif`
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const lines: string[] = []
  let current = ''
  for (const char of text) {
    const next = current + char
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current)
      current = char
    } else current = next
  }
  if (current) lines.push(current)
  return lines
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, h / 2, w / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
