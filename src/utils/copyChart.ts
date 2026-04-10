export async function copyChartToClipboard(el: HTMLElement): Promise<void> {
  const svgEl = el.querySelector('svg')
  if (!svgEl) throw new Error('No SVG found')

  const titleText = el.closest('[class*="rounded-xl"]')?.querySelector('h3')?.textContent?.trim() ?? ''

  const svgData = new XMLSerializer().serializeToString(svgEl)
  const { width, height } = svgEl.getBoundingClientRect()

  const PAD = 16
  const TITLE_H = titleText ? 36 : 0

  const canvas = document.createElement('canvas')
  const scale = 2
  canvas.width = (width + PAD * 2) * scale
  canvas.height = (height + TITLE_H + PAD * 2) * scale
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width + PAD * 2, height + TITLE_H + PAD * 2)

  if (titleText) {
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillStyle = '#1E293B'
    ctx.fillText(titleText, PAD, PAD + 14)
  }

  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => { ctx.drawImage(img, PAD, PAD + TITLE_H); resolve() }
    img.onerror = reject
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)
  })

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return }
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(resolve).catch(reject)
    }, 'image/png')
  })
}
