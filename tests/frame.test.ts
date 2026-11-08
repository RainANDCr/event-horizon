import { expect, test } from 'vitest'
import { adaptiveResolution, frameDelta, pixelRatio } from '../src/core/frame'

test('bounds frame jumps and caps the drawing resolution', () => {
  expect(frameDelta(1016, 1000)).toBeCloseTo(0.016)
  expect(frameDelta(2000, 1000)).toBe(0.05)
  expect(pixelRatio(3)).toBe(1.5)
  expect(pixelRatio(1.25)).toBe(1.25)
})

test('resolution uses consecutive slow windows and slower recovery', () => {
  const resolution = adaptiveResolution()
  expect(resolution.observe(25)).toBe(1)
  expect(resolution.observe(25)).toBe(0.85)
  expect(resolution.observe(50)).toBe(0.85)
  for (let i = 0; i < 3; i++) expect(resolution.observe(60)).toBe(0.85)
  expect(resolution.observe(60)).toBe(1)
})
