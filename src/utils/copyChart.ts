export async function copyChartToClipboard(el: HTMLElement): Promise<void> {
  // Find the largest SVG (the main chart), not the small legend icons
  const allSvgs = Array.from(el.querySelectorAll('svg'))
  if (!allSvgs.length) throw new Error('No SVG found')
  const svgEl = allSvgs.reduce((biggest, svg) => {
    const { width: w, height: h } = svg.getBoundingClientRect()
    const { width: bw, height: bh } = biggest.getBoundingClientRect()
    return w * h > bw * bh ? svg : biggest
  })

  const titleText = el.closest('[class*="rounded-xl"]')?.querySelector('h3')?.textContent?.trim() ?? ''

  const { width, height } = svgEl.getBoundingClientRect()
  if (!width || !height) throw new Error('SVG has no dimensions')

  // Clone SVG and set explicit pixel dimensions so canvas renders it correctly
  const svgClone = svgEl.cloneNode(true) as SVGElement
  svgClone.setAttribute('width', String(width))
  svgClone.setAttribute('height', String(height))
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Add white background rect inside the SVG
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bgRect.setAttribute('width', String(width))
  bgRect.setAttribute('height', String(height))
  bgRect.setAttribute('fill', 'white')
  svgClone.insertBefore(bgRect, svgClone.firstChild)

  const svgData = new XMLSerializer().serializeToString(svgClone)

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

  // Use createObjectURL instead of encodeURIComponent — more reliable for complex SVGs
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  await new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, PAD, PAD + TITLE_H)
      URL.revokeObjectURL(svgUrl)
      resolve()
    }
    img.onerror = () => { URL.revokeObjectURL(svgUrl); reject(new Error('SVG failed to load as image')) }
    img.src = svgUrl
  })

  await new Promise<void>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return }
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        .then(resolve).catch(reject)
    }, 'image/png')
  })
}
