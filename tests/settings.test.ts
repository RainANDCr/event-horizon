import { expect, test } from 'vitest'
import { normalizeSettings, parseSettingsJson } from '../src/state/settings'

test('migrates legacy values, clamps ranges and rejects invalid options', () => {
  const result = normalizeSettings({ scale: '9', fov: 'invalid', steps: 42, lensed: false })
  expect(result).toMatchObject({ scale: 1.35, fov: 53, steps: 96, lensed: false })
  expect(normalizeSettings({ version: 1, settings: result })).toEqual(result)
})

test('validates JSON round trips and rejects invalid fields or future versions', () => {
  const settings = normalizeSettings({ distance: 16, lensed: false })
  expect(parseSettingsJson(JSON.stringify({ version: 1, settings }))).toEqual(settings)
  expect(parseSettingsJson('{"fov":"61"}').fov).toBe(61)
  expect(() => parseSettingsJson('{"version":1,"settings":{"distance":500}}')).toThrow()
  expect(() => parseSettingsJson('{"version":2,"settings":{"fov":53}}')).toThrow()
})
