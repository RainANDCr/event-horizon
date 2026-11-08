import { AmbientLight, DirectionalLight, Euler, MathUtils, Matrix4, PerspectiveCamera, Quaternion, Scene, Vector3 } from 'three'
import { createProbe } from './probe'
import { flightPath, integrateFlight, routes } from './routes'
import { mountWaypoints } from './waypoints'

export function mountFlight(canvas: HTMLCanvasElement, camera: PerspectiveCamera, scene: Scene, fade: HTMLElement, signal: AbortSignal) {
  const panel = document.querySelector<HTMLElement>('[data-flight]')!
  const mode = document.querySelector<HTMLSelectElement>('[data-main-mode]')!
  const telemetry = panel.querySelector<HTMLElement>('[data-telemetry]')!
  const marker = document.querySelector<HTMLElement>('[data-navigation]')!
  const safety = panel.querySelector<HTMLElement>('[data-flight-safety]')!
  const routeChoice = panel.querySelector<HTMLSelectElement>('[data-route]')!
  const region = panel.querySelector<HTMLSelectElement>('[data-region]')!
  const routeSpeed = panel.querySelector<HTMLInputElement>('[data-route-speed]')!
  const chase = panel.querySelector<HTMLInputElement>('[data-chase]')!
  const range = panel.querySelector<HTMLInputElement>('[data-chase-range]')!
  const speedControl = panel.querySelector<HTMLInputElement>('[data-flight-speed]')!
  const pause = panel.querySelector<HTMLButtonElement>('[data-cruise-pause]')!
  const stop = panel.querySelector<HTMLButtonElement>('[data-cruise-stop]')!
  const button = (key: string) => panel.querySelector<HTMLButtonElement>(`[data-${key}]`)!
  const position = new Vector3(0, 2, 16)
  const velocity = new Vector3()
  const targetVelocity = new Vector3()
  const attitude = new Quaternion()
  const look = new Euler(0, 0, 0, 'YXZ')
  const direction = new Vector3()
  const up = new Vector3(0, 1, 0)
  const origin = new Vector3()
  const orientation = new Matrix4()
  const goal = new Quaternion()
  const chaseOffset = new Vector3()
  const targetOffset = new Vector3()
  const leadPoint = new Vector3()
  const previousPosition = new Vector3()
  const observer = new Vector3()
  const probe = createProbe()
  const fill = new AmbientLight(0x9ab7ed, 1.6)
  const key = new DirectionalLight(0xffdfbe, 3)
  key.position.set(-2, 3, 4)
  scene.add(probe.model, fill, key)
  probe.model.visible = false
  const waypoint = mountWaypoints(panel, position, signal)
  const options = { signal }
  const keys = new Set<string>()
  const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ControlLeft', 'ControlRight', 'ShiftLeft', 'ShiftRight', 'KeyR'])
  let active = false
  let dragging = false
  let orbitYaw = 0
  let orbitPitch = 0
  let time = 0
  let hudTime = 1
  let flightTime = 0
  let cruise: { path: ReturnType<typeof flightPath>; elapsed: number; duration: number; id: keyof typeof routes; paused: boolean } | undefined
  let approach = false
  let approachShade = 0
  const approachActions = panel.querySelector<HTMLElement>('[data-approach-actions]')!
  const compass = document.querySelector<HTMLElement>('[data-compass]')!
  const compassAxes = [...compass.querySelectorAll<HTMLElement>('span')]
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)]

  function clearInput() {
    keys.clear()
    dragging = false
  }
  function unlock() {
    if (document.pointerLockElement === canvas) document.exitPointerLock()
    clearInput()
  }
  function stopCruise() {
    if (cruise) velocity.set(0, 0, 0)
    cruise = undefined
    pause.disabled = stop.disabled = true
    pause.textContent = '暂停巡航'
  }
  function clearApproach() {
    approach = false
    approachShade = 0
    approachActions.hidden = true
    fade.style.opacity = '0'
  }
  function reset(safe = false) {
    stopCruise()
    clearApproach()
    position.set(0, safe ? 6 : 2, safe ? 21 : 16)
    velocity.set(0, 0, 0)
    look.set(0, 0, 0, 'YXZ')
    attitude.setFromEuler(look)
    orbitYaw = orbitPitch = 0
  }
  function setMode() {
    const next = mode.value === 'exploration' || mode.value === 'probe'
    if (next && !active && !flightTime) {
      position.copy(camera.position)
      if (position.lengthSq() < 16) position.set(0, 2, 16)
      attitude.copy(camera.quaternion)
      look.setFromQuaternion(attitude, 'YXZ')
    }
    if (!next && active) {
      stopCruise()
      clearApproach()
      velocity.set(0, 0, 0)
    }
    unlock()
    active = next
    panel.hidden = marker.hidden = compass.hidden = !active
    canvas.closest('main')!.classList.toggle('in-flight', active)
    if (!active) probe.model.visible = false
    syncProbeControls()
    if (active) canvas.focus()
    if (mode.value === 'cinematic') document.querySelector<HTMLDetailsElement>('.transport details')!.open = true
  }
  function syncProbeControls() {
    chase.disabled = mode.value !== 'probe'
    range.disabled = button('chase-reset').disabled = chase.disabled || !chase.checked
  }
  mode.addEventListener('change', setMode, options)
  mode.disabled = false
  chase.addEventListener('change', syncProbeControls, options)
  button('return-observation').addEventListener('click', () => {
    mode.value = 'observation'
    setMode()
  }, options)
  button('flight-reset').addEventListener('click', () => reset(), options)
  button('flight-lock').addEventListener('click', async () => {
    try {
      if (!canvas.requestPointerLock) throw new Error()
      await canvas.requestPointerLock()
    } catch {
      safety.textContent = '鼠标锁定不可用。可在画布拖动视角。'
    }
  }, options)
  document.addEventListener('pointerlockchange', () => {
    button('flight-lock').textContent = document.pointerLockElement === canvas ? '已锁定 · Esc 退出' : '锁定鼠标'
    if (document.pointerLockElement !== canvas) clearInput()
  }, options)
  document.addEventListener('pointerlockerror', () => {
    if (active) button('flight-lock').textContent = '锁定失败 · 拖动画布'
  }, options)
  window.addEventListener('blur', clearInput, options)
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput() }, options)
  function editing(target: EventTarget | null) {
    return target instanceof HTMLElement && !!target.closest('input, select, textarea, button, dialog')
  }
  window.addEventListener('keydown', event => {
    if (!active || editing(event.target) || !movement.has(event.code) || event.metaKey || event.altKey) return
    event.preventDefault()
    if (event.code === 'KeyR') { reset(); return }
    if (cruise) stopCruise()
    keys.add(event.code)
  }, options)
  window.addEventListener('keyup', event => { keys.delete(event.code) }, options)
  canvas.addEventListener('pointerdown', event => {
    if (!active || event.button !== 0) return
    canvas.focus()
    dragging = true
    canvas.setPointerCapture(event.pointerId)
  }, options)
  canvas.addEventListener('lostpointercapture', () => { dragging = false }, options)
  document.addEventListener('mousemove', event => {
    if (!active || (!dragging && document.pointerLockElement !== canvas)) return
    if (!event.movementX && !event.movementY) return
    if (cruise) stopCruise()
    if (mode.value === 'probe' && chase.checked && event.shiftKey) {
      orbitYaw -= event.movementX * 0.004
      orbitPitch = MathUtils.clamp(orbitPitch + event.movementY * 0.004, -0.8, 0.8)
    } else {
      look.setFromQuaternion(attitude, 'YXZ')
      look.y -= event.movementX * 0.0026
      look.x = MathUtils.clamp(look.x - event.movementY * 0.0026, -1.53, 1.53)
      attitude.setFromEuler(look)
    }
  }, options)
  canvas.addEventListener('wheel', event => {
    if (!active) return
    event.preventDefault()
    speedControl.value = String(MathUtils.clamp(Number(speedControl.value) * Math.exp(-event.deltaY * 0.001), 0.5, 36))
  }, { ...options, passive: false })
  button('chase-reset').addEventListener('click', () => { orbitYaw = orbitPitch = 0 }, options)
  routeChoice.replaceChildren(...Object.keys(routes).map(name => new Option(name)))
  button('cruise-start').addEventListener('click', () => {
    clearApproach()
    clearInput()
    targetVelocity.set(0, 0, 0)
    const id = routeChoice.value as keyof typeof routes
    const path = flightPath(position, id)
    cruise = { id, path, elapsed: 0, duration: Math.max(8, path.getLength() / 12), paused: false }
    pause.disabled = stop.disabled = false
    pause.textContent = '暂停巡航'
    if (id === 'Nebula Journey') region.value = 'nebula'
  }, options)
  pause.addEventListener('click', () => {
    if (!cruise) return
    cruise.paused = !cruise.paused
    pause.textContent = cruise.paused ? '继续巡航' : '暂停巡航'
  }, options)
  stop.addEventListener('click', stopCruise, options)
  button('approach-continue').addEventListener('click', clearApproach, options)
  button('approach-safe').addEventListener('click', () => reset(true), options)
  signal.addEventListener('abort', unlock, { once: true })
  return {
    active: () => active,
    position,
    region,
    resetInput: unlock,
    update(delta: number, quality: number) {
      time += delta
      flightTime += delta
      const x = Number(keys.has('KeyD')) - Number(keys.has('KeyA'))
      const y = Number(keys.has('Space')) - Number(keys.has('ControlLeft') || keys.has('ControlRight'))
      const z = Number(keys.has('KeyS')) - Number(keys.has('KeyW'))
      const boost = keys.has('ShiftLeft') || keys.has('ShiftRight')
      const roll = Number(keys.has('KeyQ')) - Number(keys.has('KeyE'))
      if (cruise) {
        if (!cruise.paused) {
          previousPosition.copy(position)
          cruise.elapsed = Math.min(cruise.duration, cruise.elapsed + delta * Number(routeSpeed.value))
          cruise.path.getPointAt(cruise.elapsed / cruise.duration, position)
          if (position.lengthSq() < 0.001) position.copy(previousPosition)
          if (position.lengthSq() < 16) position.setLength(4.001)
          velocity.subVectors(position, previousPosition).multiplyScalar(delta > 0 ? 1 / delta : 0)
          orientation.lookAt(position, origin, up)
          attitude.slerp(goal.setFromRotationMatrix(orientation), 1 - Math.exp(-3 * delta))
          if (cruise.elapsed === cruise.duration) {
            approach = cruise.id === 'Horizon Approach'
            approachActions.hidden = !approach
            stopCruise()
          }
        } else velocity.set(0, 0, 0)
      } else if (!approach) {
        if (roll) {
          look.setFromQuaternion(attitude, 'YXZ')
          look.z += roll * delta
          attitude.setFromEuler(look)
        }
        targetVelocity.set(x, y, z).normalize().applyQuaternion(attitude).multiplyScalar(Number(speedControl.value) * (boost ? 3 : 1))
        integrateFlight(position, velocity, targetVelocity, delta)
      }
      if (approach) {
        approachShade = Math.min(0.94, approachShade + delta * 0.8)
        fade.style.opacity = String(approachShade)
      }

      const follow = mode.value === 'probe' && chase.checked
      targetOffset.set(0, 0, 0)
      if (follow) {
        const radius = Number(range.value)
        targetOffset.set(Math.sin(orbitYaw) * radius, (0.24 + Math.sin(orbitPitch)) * radius, Math.cos(orbitYaw) * radius)
          .applyQuaternion(attitude)
      }
      chaseOffset.lerp(targetOffset, 1 - Math.exp(-7 * delta))
      observer.copy(position).add(chaseOffset)
      if (observer.lengthSq() > 0.001 && observer.lengthSq() < 16) chaseOffset.copy(observer.setLength(4)).sub(position)
      camera.position.copy(chaseOffset)
      if (follow && chaseOffset.lengthSq() > 0.04) {
        leadPoint.set(0, 0.85, -3).applyQuaternion(attitude)
        orientation.lookAt(chaseOffset, leadPoint, up)
        camera.quaternion.slerp(goal.setFromRotationMatrix(orientation), 1 - Math.exp(-9 * delta))
      } else {
        camera.quaternion.slerp(attitude, 1 - Math.exp(-12 * delta))
      }
      probe.model.visible = follow && chaseOffset.lengthSq() > 1
      probe.model.quaternion.copy(attitude)
      if (probe.model.visible) {
        probe.update(time, cruise && !cruise.paused ? 0.5 : targetVelocity.lengthSq() > 0 ? (boost ? 1 : 0.55) : 0, quality === 64 ? 12 : quality === 96 ? 24 : 48)
      }
      hudTime += delta
      if (hudTime < 0.09) return
      hudTime = 0
      const distance = position.length()
      const remaining = waypoint(direction).sub(position).length()
      direction.applyQuaternion(goal.copy(camera.quaternion).invert())
      const behind = direction.z >= 0
      const perspective = Math.max(0.001, Math.abs(direction.z) * Math.tan(MathUtils.degToRad(camera.fov) / 2))
      const nx = direction.x / (perspective * camera.aspect)
      const ny = direction.y / perspective
      const margin = Math.max(1, Math.abs(nx) / 0.83, Math.abs(ny) / 0.78)
      const aligned = Math.abs(nx) + Math.abs(ny) < 0.0001
      marker.style.left = `${50 + 50 * (behind && aligned ? 0 : nx / margin)}%`
      marker.style.top = `${50 - 50 * (behind && aligned ? -0.78 : ny / margin)}%`
      marker.textContent = `${behind ? '↶ 后方' : margin > 1 ? '◈ 边缘' : '◇ 目标'} ${remaining.toFixed(1)} Rₛ`
      for (let i = 0; i < axes.length; i++) {
        direction.copy(axes[i]).applyQuaternion(goal)
        compassAxes[i].style.transform = `translate(${direction.x * 19}px, ${-direction.y * 19}px)`
        compassAxes[i].style.opacity = String(0.67 - direction.z * 0.27)
      }
      look.setFromQuaternion(attitude, 'YXZ')
      telemetry.textContent = `${cruise ? (cruise.paused ? '巡航暂停' : cruise.id) : mode.value === 'probe' ? '探测器驾驶' : '自由观察'} · ${position.toArray().map(n => n.toFixed(1)).join(' / ')} Rₛ · 距中心 ${distance.toFixed(1)} Rₛ · ${velocity.length().toFixed(1)} 单位/秒 · ${boost ? '加力' : cruise && !cruise.paused || targetVelocity.lengthSq() > 0 ? '推进' : '滑行'} · 航向 ${Math.round(MathUtils.radToDeg(look.y))}° / 仰角 ${Math.round(MathUtils.radToDeg(look.x))}°`
      safety.textContent = approach ? '艺术化过场 · 仍在事件视界外' : distance < 8 ? '近距离 · 安全边界为软件限制' : distance > 45 ? '远距离 · 远场采用直线近似' : '导航距离与速度为场景单位'
    },
    dispose: probe.dispose,
  }
}
