import { expect, test } from 'vitest'
import { createDeepSpace } from '../src/rendering/deep-space'
import { SHADOW_RADIUS_RS } from '../src/rendering/black-hole'

test('uses the Schwarzschild shadow scale and reproduces a seeded starfield', () => {
  expect(SHADOW_RADIUS_RS).toBeCloseTo(2.598)
  const first = createDeepSpace(42)
  const second = createDeepSpace(42)
  const positions = (space: typeof first) => space.stars[0].geometry.getAttribute('position').array
  expect(positions(first)).toEqual(positions(second))
  first.dispose()
  second.dispose()
})
