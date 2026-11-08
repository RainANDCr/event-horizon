import { Vector3 } from 'three'
import { expect, test } from 'vitest'
import { flightPath, integrateFlight, routes } from '../src/flight/routes'

test('thrust integrates consistently across frame rates and cannot tunnel through the safety zone', () => {
  function fly(fps: number) {
    const position = new Vector3(0, 2, 16)
    const velocity = new Vector3()
    const target = new Vector3(8, 3, 0)
    for (let i = 0; i < fps; i++) integrateFlight(position, velocity, target, 1 / fps)
    return position
  }
  expect(fly(30).distanceTo(fly(144))).toBeLessThan(1e-10)
  const position = new Vector3(0, 0, 5)
  const speed = new Vector3(0, 0, -108)
  integrateFlight(position, speed, speed.clone(), 0.1)
  expect(position.z).toBeGreaterThanOrEqual(4)
  expect(speed.length()).toBe(0)
})

test('all five cruise paths start at the current position and reach their last waypoint', () => {
  const start = new Vector3(0, 2, 16)
  const names = Object.keys(routes) as (keyof typeof routes)[]
  expect(names).toHaveLength(5)
  for (const name of names) {
    const path = flightPath(start, name)
    expect(path.getPointAt(0).distanceTo(start)).toBeLessThan(1e-8)
    expect(path.getPointAt(1).distanceTo(new Vector3(...routes[name].at(-1)!))).toBeLessThan(1e-8)
    for (let i = 0; i <= 100; i++) expect(path.getPointAt(i / 100).length()).toBeGreaterThan(4)
    const opposite = new Vector3(...routes[name][0]).setLength(-4.1)
    const detour = flightPath(opposite, name)
    for (let i = 0; i <= 100; i++) expect(detour.getPointAt(i / 100).length()).toBeGreaterThan(4)
  }
})
