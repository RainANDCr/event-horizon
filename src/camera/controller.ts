import { MathUtils, PerspectiveCamera } from 'three'
import { blendView, home, sampleShot, shots, type ShotId } from './shots'

export function createCameraController(
  camera: PerspectiveCamera,
  canvas: HTMLCanvasElement,
  form: HTMLFormElement,
  signal: AbortSignal,
  reducedMotion: () => boolean,
) {
  const select = form.querySelector<HTMLSelectElement>('[name="shot"]')!
  const stop = form.querySelector<HTMLButtonElement>('[data-stop-shot]')!
  const caption = form.querySelector<HTMLElement>('[data-camera-caption]')!
  const fade = document.querySelector<HTMLElement>('[data-camera-fade]')!
  const options = { signal }
  const pointers = new Map<number, PointerEvent>()
  let current = home
  let target = home
  let film: { id: ShotId; initial: typeof home; time: number } | undefined
  let dirty = true

  function leaveFilm() {
    film = undefined
    target = current
    fade.style.opacity = '0'
    stop.disabled = true
    caption.textContent = '自由观察'
    dirty = true
  }

  function move(yaw: number, pitch: number, zoom: number) {
    if (canvas.closest('main')?.classList.contains('in-flight')) return
    if (film) leaveFilm()
    target = {
      yaw: target.yaw + yaw,
      pitch: MathUtils.clamp(target.pitch + pitch, -1.42, 1.42),
      distance: MathUtils.clamp(target.distance * zoom, 4.2, 48),
    }
    dirty = true
  }

  form.querySelector('[data-start-shot]')?.addEventListener('click', () => {
    const id = select.value as ShotId
    if (!Object.hasOwn(shots, id)) return
    film = { id, initial: current, time: 0 }
    fade.style.opacity = '0'
    stop.disabled = false
    caption.textContent = select.selectedOptions[0].textContent
    dirty = true
    form.dispatchEvent(new Event('shotstart'))
  }, options)
  stop.addEventListener('click', leaveFilm, options)
  form.querySelector('[data-reset-camera]')?.addEventListener('click', () => {
    leaveFilm()
    target = { ...home, yaw: current.yaw - Math.atan2(Math.sin(current.yaw), Math.cos(current.yaw)) }
  }, options)

  canvas.addEventListener('pointerdown', event => {
    if (canvas.closest('main')?.classList.contains('in-flight')) return
    if (event.button !== 0) return
    if (film) leaveFilm()
    pointers.set(event.pointerId, event)
    canvas.setPointerCapture(event.pointerId)
  }, options)
  canvas.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId)
    if (!previous) return
    pointers.set(event.pointerId, event)
    if (pointers.size === 1) {
      move((previous.clientX - event.clientX) * 0.005, (event.clientY - previous.clientY) * 0.005, 1)
    } else if (pointers.size === 2) {
      const other = [...pointers.values()].find(pointer => pointer.pointerId !== event.pointerId)!
      const before = Math.hypot(previous.clientX - other.clientX, previous.clientY - other.clientY)
      const after = Math.hypot(event.clientX - other.clientX, event.clientY - other.clientY)
      if (before > 2 && after > 2) move(0, 0, before / after)
    }
  }, options)
  canvas.addEventListener('lostpointercapture', event => pointers.delete(event.pointerId), options)
  canvas.addEventListener('wheel', event => {
    event.preventDefault()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.clientHeight : 1
    move(0, 0, Math.exp(MathUtils.clamp(event.deltaY * unit * 0.0012, -1, 1)))
  }, { ...options, passive: false })
  canvas.addEventListener('keydown', event => {
    if (canvas.closest('main')?.classList.contains('in-flight')) return
    switch (event.key) {
      case 'ArrowLeft': move(0.15, 0, 1); break
      case 'ArrowRight': move(-0.15, 0, 1); break
      case 'ArrowUp': move(0, 0.12, 1); break
      case 'ArrowDown': move(0, -0.12, 1); break
      case '+': case '=': move(0, 0, 0.86); break
      case '-': move(0, 0, 1.16); break
      default: return
    }
    event.preventDefault()
  }, options)

  return {
    suspend: leaveFilm,
    setDistance(distance: number) {
      if (film) leaveFilm()
      target = { ...target, distance }
      dirty = true
    },
    update(delta: number, elapsed: number, autoRotate: boolean) {
      if (film) {
        const shot = shots[film.id]
        if (!dirty && (elapsed === 0 || film.time === shot.duration)) return false
        film.time = Math.min(shot.duration, film.time + elapsed)
        const sample = sampleShot(shot, film.initial, film.time)
        current = sample.view
        fade.style.opacity = String(sample.shade)
        if (film.time === shot.duration && film.id === 'descent') {
          caption.textContent = '演出结束 · 视界外停止观测'
        }
        dirty = false
      } else {
        if (autoRotate && elapsed > 0 && !reducedMotion()) {
          target = { ...target, yaw: target.yaw + elapsed * 0.11 }
          dirty = true
        }
        if (!dirty) return false
        const close = Math.abs(current.yaw - target.yaw) + Math.abs(current.pitch - target.pitch)
          + Math.abs(current.distance - target.distance) < 0.0001
        dirty = !close && !reducedMotion()
        current = dirty ? blendView(current, target, 1 - Math.exp(-14 * delta)) : target
      }
      const horizontal = current.distance * Math.cos(current.pitch)
      camera.position.set(horizontal * Math.sin(current.yaw), current.distance * Math.sin(current.pitch), horizontal * Math.cos(current.yaw))
      camera.lookAt(0, 0, 0)
      return true
    },
  }
}
