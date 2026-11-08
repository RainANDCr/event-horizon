import { downloadBlob } from '../export/media'
import { readStored, writeStored } from '../state/settings'
import { Vector3 } from 'three'

type Point = { name: string; xyz: [number, number, number] }
const key = 'event-horizon.waypoints.v1'
const base: Point[] = [
  { name: '黑洞中心（参考）', xyz: [0, 0, 0] },
  { name: '安全观察点', xyz: [0, 6, 21] },
  { name: '盘面上方', xyz: [0, 13, 10] },
  { name: '光子环观察区', xyz: [0, 3, 8] },
  { name: '远距离观测点', xyz: [8, 14, 50] },
]

export function mountWaypoints(panel: HTMLElement, position: Vector3, signal: AbortSignal) {
  const select = panel.querySelector<HTMLSelectElement>('[data-target]')!
  const name = panel.querySelector<HTMLInputElement>('[data-waypoint-name]')!
  const note = panel.querySelector<HTMLElement>('[data-waypoint-note]')!
  const stored = readStored(key)
  let points: Point[] = Array.isArray(stored) ? stored.filter(point => point && typeof point.name === 'string'
    && Array.isArray(point.xyz) && point.xyz.length === 3 && point.xyz.every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 20000)) : []
  const options = { signal }
  const button = (action: string) => panel.querySelector<HTMLButtonElement>(`[data-waypoint-${action}]`)!
  function refresh(index = Number(select.value)) {
    select.replaceChildren(...[...base, ...points].map((point, i) => new Option(point.name, String(i))))
    select.value = String(Math.max(0, Math.min(index, select.length - 1)))
    button('rename').disabled = button('delete').disabled = Number(select.value) < base.length
  }
  function save(next: Point[], index: number) {
    if (!writeStored(key, next)) {
      note.textContent = '无法写入本地航点'
      return
    }
    points = next
    refresh(index)
    note.textContent = '航点已保存'
  }
  select.addEventListener('change', () => refresh(), options)
  button('save').addEventListener('click', () => {
    save([...points, { name: name.value.trim() || `航点 ${points.length + 1}`, xyz: position.toArray() }], select.length)
  }, options)
  button('rename').addEventListener('click', () => {
    const index = Number(select.value)
    if (index < base.length || !name.value.trim()) {
      note.textContent = '请输入新的航点名称'
      return
    }
    save(points.map((point, i) => i === index - base.length ? { ...point, name: name.value.trim() } : point), index)
  }, options)
  button('delete').addEventListener('click', () => {
    const index = Number(select.value)
    if (index >= base.length) save(points.filter((_, i) => i !== index - base.length), index)
  }, options)
  button('export').addEventListener('click', () => {
    downloadBlob(new Blob([JSON.stringify({ version: 1, waypoints: points }, null, 2)], { type: 'application/json' }), 'event-horizon-waypoints.json')
  }, options)
  refresh(1)
  return (target: Vector3) => target.fromArray((base[Number(select.value)] ?? points[Number(select.value) - base.length] ?? base[1]).xyz)
}
