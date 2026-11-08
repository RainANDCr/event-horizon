import { expect, test } from 'vitest'
import { shots, sampleShot, home } from '../src/camera/shots'

test('all six shots start from the current view and stay outside the horizon', () => {
  expect(Object.keys(shots)).toHaveLength(6)
  for (const shot of Object.values(shots)) {
    expect(sampleShot(shot, home, 0).view).toEqual(home)
    for (let time = 0; time <= shot.duration; time += 0.1) {
      const { view, shade } = sampleShot(shot, home, time)
      expect(view.distance).toBeGreaterThan(1.35)
      expect(Math.abs(view.pitch)).toBeLessThan(Math.PI / 2)
      expect(shade).toBeGreaterThanOrEqual(0)
      expect(shade).toBeLessThanOrEqual(1)
    }
  }
  const ending = sampleShot(shots.descent, home, shots.descent.duration)
  expect(ending.view.distance).toBeCloseTo(shots.descent.to.distance)
  expect(ending.shade).toBe(1)
})
