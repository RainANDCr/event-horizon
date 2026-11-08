export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function capturePng(canvas: HTMLCanvasElement, watermark: boolean, onError: () => void) {
  let source = canvas
  if (watermark) {
    source = document.createElement('canvas')
    source.width = canvas.width
    source.height = canvas.height
    const context = source.getContext('2d')
    if (!context) return onError()
    context.drawImage(canvas, 0, 0)
    const size = Math.max(12, Math.round(canvas.height * 0.024))
    context.font = `${size}px system-ui`
    context.textAlign = 'right'
    context.shadowColor = '#000'
    context.shadowBlur = 5
    context.fillStyle = '#fff'
    context.fillText('EVENT HORIZON', canvas.width - size, canvas.height - size)
  }
  source.toBlob(blob => blob ? downloadBlob(blob, 'event-horizon.png') : onError(), 'image/png')
}

export function mountRecorder(canvas: HTMLCanvasElement, button: HTMLButtonElement, status: HTMLElement, redraw: () => void, signal: AbortSignal) {
  const supported = typeof canvas.captureStream === 'function' && typeof MediaRecorder === 'function'
  const mime = supported && ['video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type))
  button.disabled = !mime
  if (!mime) {
    button.textContent = 'WebM 不可用'
    button.title = '此浏览器不支持画布 WebM 录制'
  }
  let active: MediaRecorder | undefined
  let disposed = false

  function stop() {
    if (active?.state === 'recording') active.stop()
  }

  button.addEventListener('click', () => {
    if (active) {
      stop()
      return
    }
    if (!mime) return
    let stream: MediaStream | undefined
    try {
      stream = canvas.captureStream(30)
      const recorder = new MediaRecorder(stream, { mimeType: mime })
      const chunks: Blob[] = []
      let failed = false
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data)
      }
      recorder.onerror = () => {
        failed = true
        status.textContent = 'WebM 录制失败'
        stop()
      }
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach(track => track.stop())
        active = undefined
        button.textContent = '录制 WebM'
        if (disposed) return
        if (failed) return
        if (chunks.length) downloadBlob(new Blob(chunks, { type: 'video/webm' }), 'event-horizon.webm')
        status.textContent = chunks.length ? 'WebM 已保存' : '录制未获得画面'
      }
      recorder.start(1000)
      active = recorder
      button.textContent = '结束录制'
      status.textContent = '正在录制画布 · WebM'
      redraw()
    } catch {
      stream?.getTracks().forEach(track => track.stop())
      status.textContent = '无法启动 WebM 录制'
    }
  }, { signal })
  signal.addEventListener('abort', () => {
    disposed = true
    stop()
    active?.stream.getTracks().forEach(track => track.stop())
  }, { once: true })
  return { stop, recording: () => active?.state === 'recording', setAvailable: (available: boolean) => { button.disabled = !available || !mime } }
}
