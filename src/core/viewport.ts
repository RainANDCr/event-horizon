import { ACESFilmicToneMapping, WebGLRenderer } from 'three'
import { mountAmbience } from '../audio/ambience'
import { capturePng, mountRecorder } from '../export/media'
import { createCameraController } from '../camera/controller'
import { createBloom } from '../rendering/bloom'
import { mountSettings } from '../state/settings'
import { createLensedView } from '../rendering/lensed-view'
import { createDeepSpace } from '../rendering/deep-space'
import { adaptiveResolution, frameDelta, pixelRatio } from './frame'
import { mountFlight } from '../flight/controller'

export function mountViewport(canvas: HTMLCanvasElement, status: HTMLElement, controls: HTMLFormElement, settings: ReturnType<typeof mountSettings>) {
  const context = canvas.getContext('webgl2')
  if (!context) {
    status.textContent = 'WebGL 2 不可用。请检查浏览器的硬件加速设置。'
    return
  }

  const renderer = new WebGLRenderer({ canvas, context, antialias: true })
  renderer.toneMapping = ACESFilmicToneMapping
  const space = createDeepSpace()
  const view = createLensedView(space.camera)
  const events = new AbortController()
  const audio = mountAmbience(document.querySelector<HTMLElement>('[data-audio]')!, events.signal)
  const options = { signal: events.signal }
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  let values = settings.read()
  const reduce = () => reducedMotion.matches || values.reduceMotion
  const camera = createCameraController(space.camera, canvas, controls, events.signal, reduce)
  const flight = mountFlight(canvas, space.camera, view.scene, document.querySelector<HTMLElement>('[data-camera-fade]')!, events.signal)
  const nebula = (name: string) => document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-nebula-${name}]`)!
  const cloudQuality = nebula('quality')
  const cloudDensity = nebula('density')
  const cloudLight = nebula('light')
  const cloudSize = nebula('size')
  const cloudColor = nebula('color')
  let wasFlying = false
  let previous = 0
  let contextLost = false
  let paused = reduce()
  let density = -1
  let exposure = -1
  let skyDirty = true
  let frameDirty = true
  let captureRequested = false
  let bloom: ReturnType<typeof createBloom> | undefined
  const capture = document.querySelector<HTMLButtonElement>('[data-screenshot]')!
  const watermark = controls.querySelector<HTMLInputElement>('[data-watermark]')!
  const recorder = mountRecorder(canvas, document.querySelector<HTMLButtonElement>('[data-record]')!, status, () => {
    frameDirty = true
  }, events.signal)
  const distance = controls.elements.namedItem('distance') as HTMLInputElement
  const spin = controls.elements.namedItem('spin') as HTMLInputElement
  const modelNote = controls.querySelector<HTMLElement>('[data-model-note]')!
  const distanceNote = controls.querySelector<HTMLElement>('[data-distance]')!
  const playback = controls.querySelector<HTMLButtonElement>('[data-playback]')
  const performanceNote = document.querySelector<HTMLElement>('[data-performance]')!
  const resolution = adaptiveResolution()
  let renderScale = 1
  let sampleStart = 0
  let frames = 0

  function resetSampling() {
    sampleStart = frames = 0
    resolution.resetSample()
  }

  function updatePlayback() {
    if (playback) playback.textContent = paused ? '继续动画' : '暂停动画'
    resetSampling()
    if (paused) performanceNote.textContent = '动画暂停'
  }

  playback?.addEventListener('click', () => {
    paused = !paused
    updatePlayback()
  }, options)
  controls.addEventListener('shotstart', () => {
    if (flight.active()) return
    paused = false
    updatePlayback()
  }, options)

  function updateControls(setDistance = false) {
    const wasReduced = reduce()
    const previousValues = values
    values = settings.read()
    const nextDensity = values.density
    const nextExposure = values.exposure
    skyDirty ||= nextDensity !== density || nextExposure !== exposure
    skyDirty ||= previousValues.dust !== values.dust || previousValues.steps !== values.steps
    density = nextDensity
    exposure = nextExposure
    space.update(values.fov, density, exposure, values.dust, values.steps)
    view.update(values)
    if (setDistance) camera.setDistance(values.distance)
    spin.disabled = values.model === 'schwarzschild'
    modelNote.textContent = spin.disabled ? '史瓦西模型 · 非旋转黑洞' : '旋转视觉近似 · 光路仍采用史瓦西模型'
    if (!wasReduced && reduce() && !paused) {
      paused = true
      updatePlayback()
    }
    frameDirty = true
  }

  function resize() {
    const width = Math.max(canvas.clientWidth, 1)
    const height = Math.max(canvas.clientHeight, 1)
    const ratio = pixelRatio(devicePixelRatio) * renderScale
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio)
    renderer.setSize(width, height, false)
    bloom?.resize(width, height, renderer.getPixelRatio())
    space.camera.aspect = width / height
    space.camera.updateProjectionMatrix()
    frameDirty = true
  }

  function draw(now: number) {
    const delta = previous ? frameDelta(now, previous) : 0
    const flightDelta = previous ? Math.min(0.2, (now - previous) / 1000) : 0
    previous = now
    const elapsed = paused ? 0 : delta * values.timeRate
    const flying = flight.active()
    if (flying !== wasFlying) {
      camera.suspend()
      frameDirty = true
      wasFlying = flying
    }
    let moved: boolean
    if (flying) {
      flight.update(flightDelta, values.steps)
      view.setWorldOrigin(flight.position)
      view.setEnvironment(flight.region.selectedIndex, Math.min(Number(cloudQuality.value), values.steps === 64 || renderScale <= 0.7 ? 2 : 4), Number(cloudDensity.value), Number(cloudLight.value), Number(cloudSize.value), cloudColor.value, flightDelta)
      moved = true
    } else {
      view.setWorldOrigin(null)
      view.setEnvironment(-1, 0, 0, 0, 1, '#000000', 0)
      moved = camera.update(delta, elapsed, values.autoRotate)
    }
    if (paused && !frameDirty && !moved && !recorder.recording()) return
    if ((!paused || flying) && !recorder.recording()) {
      if (!sampleStart) sampleStart = now
      const sampleTime = now - sampleStart
      if (sampleTime >= 1000) {
        const fps = frames * 1000 / sampleTime
        const next = resolution.observe(fps)
        if (next !== renderScale) {
          renderScale = next
          resize()
        }
        performanceNote.textContent = `${Math.round(fps)} FPS · 渲染比例 ${Math.round(renderScale * 100)}%`
        sampleStart = now
        frames = 0
      }
      frames++
    } else if (sampleStart) {
      resetSampling()
    }
    if (skyDirty) {
      view.captureSky(renderer, space.scene)
      skyDirty = false
    }
    frameDirty = false
    view.advance(elapsed * values.speed)
    if (moved) {
      const radius = flying ? flight.position.length() : space.camera.position.length()
      audio.updateDistance(radius)
      distanceNote.textContent = `观察距离 ${radius.toFixed(1)} Rₛ（基准）`
      if (!flying && document.activeElement !== distance) distance.value = String(radius)
    }
    if (values.bloom > 0 || values.optics) {
      bloom ??= createBloom(renderer, view.scene, space.camera)
      bloom.render(values.bloom, values.optics, values.steps)
    } else {
      renderer.render(view.scene, space.camera)
    }
    if (captureRequested) {
      captureRequested = false
      capturePng(canvas, watermark.checked, () => { status.textContent = '无法保存当前画面' })
    }
    if (!canvas.dataset.rendered) canvas.dataset.rendered = 'true'
  }

  function syncLoop() {
    previous = 0
    resetSampling()
    renderer.setAnimationLoop(document.hidden || contextLost ? null : draw)
  }

  window.addEventListener('resize', resize, options)
  controls.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
      if (event.target.name && event.target.name !== 'sceneName') updateControls(event.target === distance)
    }
  }, options)
  controls.addEventListener('change', () => settings.save(settings.read()), options)
  controls.addEventListener('settingsload', () => {
    updateControls(true)
    settings.save(values)
  }, options)
  controls.addEventListener('captureframe', () => {
    captureRequested = true
    frameDirty = true
  }, options)
  document.addEventListener('visibilitychange', syncLoop, options)
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault()
    contextLost = true
    flight.resetInput()
    capture.disabled = true
    recorder.stop()
    recorder.setAvailable(false)
    bloom?.dispose()
    bloom = undefined
    delete canvas.dataset.rendered
    status.textContent = '图形上下文已中断，正在等待恢复…'
    syncLoop()
  }, options)
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false
    capture.disabled = false
    recorder.setAvailable(true)
    skyDirty = true
    status.textContent = 'WebGL 2 · 观测画布在线'
    resize()
    syncLoop()
  }, options)

  updateControls(true)
  updatePlayback()
  resize()
  syncLoop()
  status.textContent = 'WebGL 2 · 观测画布在线'
  capture.disabled = false

  return () => {
    events.abort()
    renderer.setAnimationLoop(null)
    bloom?.dispose()
    view.dispose()
    flight.dispose()
    space.dispose()
    renderer.dispose()
  }
}
