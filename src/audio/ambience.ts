export function mountAmbience(panel: HTMLElement, signal: AbortSignal) {
  const power = panel.querySelector<HTMLButtonElement>('[data-audio-power]')!
  const mute = panel.querySelector<HTMLButtonElement>('[data-audio-mute]')!
  const volume = panel.querySelector<HTMLInputElement>('[data-audio-volume]')!
  const status = panel.querySelector<HTMLElement>('[data-audio-status]')!
  const options = { signal }
  let engine: { context: AudioContext; gain: GainNode; filter: BiquadFilterNode } | undefined
  let muted = false
  let distance = 13

  function syncGain() {
    if (!engine) return
    const volumeTarget = muted || document.hidden ? 0 : Number(volume.value) * 0.22
    const now = engine.context.currentTime
    engine.gain.gain.cancelScheduledValues(now)
    engine.gain.gain.setTargetAtTime(volumeTarget, now, 0.04)
    if (volumeTarget === 0) engine.gain.gain.setValueAtTime(0, now + 0.35)
  }

  function updateDistance(next: number) {
    distance = next
    if (!engine) return
    const cutoff = 125 + 470 * Math.max(0, Math.min(1, (25 - distance) / 20))
    engine.filter.frequency.setTargetAtTime(cutoff, engine.context.currentTime, 0.16)
  }

  function close() {
    const previous = engine
    engine = undefined
    if (previous) void previous.context.close().catch(() => {})
    muted = false
    power.textContent = '开启环境音'
    mute.textContent = '静音'
    mute.disabled = true
    status.textContent = '已关闭'
  }

  power.disabled = typeof AudioContext !== 'function'
  if (power.disabled) status.textContent = '此浏览器不支持 Web Audio'
  power.addEventListener('click', async () => {
    if (engine) {
      close()
      return
    }
    let context: AudioContext | undefined
    try {
      context = new AudioContext()
      const gain = context.createGain()
      const filter = context.createBiquadFilter()
      engine = { context, gain, filter }
      gain.gain.value = 0
      filter.type = 'lowpass'
      filter.connect(gain).connect(context.destination)

      const bed = context.createGain()
      bed.gain.value = 0.24
      bed.connect(filter)
      for (const [frequency, type] of [[43, 'sine'], [64.5, 'sine'], [86.4, 'triangle']] as const) {
        const tone = context.createOscillator()
        tone.frequency.value = frequency
        tone.type = type
        tone.connect(bed)
        tone.start()
      }
      const drift = context.createOscillator()
      const depth = context.createGain()
      drift.frequency.value = 0.16
      depth.gain.value = 0.07
      drift.connect(depth).connect(bed.gain)
      drift.start()

      power.textContent = '关闭环境音'
      await context.resume()
      if (engine?.context !== context) return
      mute.disabled = false
      status.textContent = '播放中'
      updateDistance(distance)
      syncGain()
    } catch {
      if (signal.aborted || context && engine?.context !== context) return
      close()
      status.textContent = '无法启动环境音'
    }
  }, options)
  mute.addEventListener('click', () => {
    muted = !muted
    mute.textContent = muted ? '取消静音' : '静音'
    status.textContent = muted ? '已静音' : '播放中'
    syncGain()
  }, options)
  volume.addEventListener('input', syncGain, options)
  document.addEventListener('visibilitychange', syncGain, options)
  signal.addEventListener('abort', close, { once: true })

  return { updateDistance }
}
