const ranges = {
  fov: [53, 38, 75], scale: [1, 0.55, 1.35], density: [1, 0, 1],
  exposure: [1, 0.45, 1.8], inner: [3.2, 2.8, 5], outer: [8.7, 5.2, 11],
  tilt: [78, 0, 86], brightness: [1, 0, 2], heat: [1, 0.35, 1.5],
  turbulence: [0.8, 0, 1], speed: [1, 0, 2], distance: [13, 4.2, 48],
  spin: [0.35, -1, 1], bloom: [0, 0, 1],
} as const

const choices = {
  steps: [96, 64, 144], octaves: [4, 2, 3], timeRate: [1, 0.25, 0.5, 2],
  model: ['schwarzschild', 'rotating'],
  shot: ['deepSpace', 'approach', 'orbit', 'diskEdge', 'photonRing', 'descent'],
} as const

const switches = { lensed: true, autoRotate: false, reduceMotion: false, optics: false, dust: true }

export type Settings = { [K in keyof typeof ranges]: number }
  & { [K in keyof typeof choices]: typeof choices[K][number] }
  & typeof switches

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function normalizeSettings(raw: unknown): Settings {
  const entry = record(raw)
  const input = entry.version === 1 ? record(entry.settings) : entry.version === undefined ? entry : {}
  const result: Record<string, unknown> = {}
  for (const [key, [fallback, min, max]] of Object.entries(ranges)) {
    const value = input[key]
    const number = typeof value === 'number' || typeof value === 'string' && value.trim() ? Number(value) : NaN
    result[key] = Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
  }
  for (const [key, allowed] of Object.entries(choices)) {
    result[key] = allowed.find(value => String(value) === String(input[key])) ?? allowed[0]
  }
  for (const [key, fallback] of Object.entries(switches)) {
    result[key] = typeof input[key] === 'boolean' ? input[key] : fallback
  }
  return result as Settings
}

const key = 'event-horizon.settings'

export function parseSettingsJson(json: string): Settings {
  const raw: unknown = JSON.parse(json)
  const entry = record(raw)
  const input = entry.version === 1 ? record(entry.settings) : entry
  const result = normalizeSettings(raw)
  const keys = Object.keys(input).filter(key => Object.hasOwn(result, key)) as (keyof Settings)[]
  if ((entry.version !== undefined && entry.version !== 1) || !keys.length
    || keys.some(key => input[key] !== result[key]
      && !(entry.version === undefined && typeof result[key] === 'number' && typeof input[key] === 'string'
        && input[key] !== '' && Number(input[key]) === result[key]))) {
    throw new Error('配置版本或参数无效')
  }
  return result
}
export function readStored(name: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(name) ?? 'null')
  } catch {
    return null
  }
}

export function writeStored(name: string, value: unknown) {
  try {
    localStorage.setItem(name, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function mountSettings(form: HTMLFormElement) {
  function apply(settings: Settings) {
    for (const [key, value] of Object.entries(settings)) {
      const input = form.elements.namedItem(key)
      if (input instanceof HTMLInputElement && typeof value === 'boolean') input.checked = value
      else if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) input.value = String(value)
    }
  }

  for (const [key, [, min, max]] of Object.entries(ranges)) {
    const input = form.elements.namedItem(key) as HTMLInputElement
    input.min = String(min)
    input.max = String(max)
  }
  apply(normalizeSettings(readStored(key)))

  return {
    read() {
      const values = Object.fromEntries(new FormData(form))
      values.spin = (form.elements.namedItem('spin') as HTMLInputElement).value
      for (const key of Object.keys(switches)) {
        Object.assign(values, { [key]: (form.elements.namedItem(key) as HTMLInputElement).checked })
      }
      return normalizeSettings(values)
    },
    apply,
    save(settings: Settings) {
      return writeStored(key, { version: 1, settings })
    },
  }
}
