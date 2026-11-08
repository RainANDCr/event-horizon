import { CatmullRomCurve3, Quaternion, Vector3 } from 'three'

export const routes = {
  'First Encounter': [[3, 8, 43], [8, 5, 26], [4, 3, 15]],
  'Orbital Survey': [[0, 6, 18], [18, 7, 0], [0, 6, -18], [-18, 6, 0], [0, 6, 18]],
  'Disk Flyby': [[-16, 4, 20], [-7, 2, 12], [3, 2, 8], [16, 6, 12]],
  'Nebula Journey': [[-32, 18, 64], [-14, 10, 49], [9, 6, 31], [5, 4, 18]],
  'Horizon Approach': [[0, 8, 31], [1, 4, 15], [1, 2.5, 4.4]],
} as const

export function flightPath(start: Vector3, route: keyof typeof routes) {
  const points = routes[route].map(point => new Vector3(...point))
  const from = start.clone().normalize()
  const to = points[0].clone().normalize()
  const entry = [start.clone()]
  if (from.dot(to) < 0.6) {
    const radius = Math.max(16, Math.min(start.length(), points[0].length()))
    const turn = new Quaternion().setFromUnitVectors(from, to)
    const rotation = new Quaternion()
    for (let i = 0; i <= 6; i++) {
      const anchor = from.clone().applyQuaternion(rotation.identity().slerp(turn, i / 6)).multiplyScalar(radius)
      if (anchor.distanceToSquared(entry[entry.length - 1]) > 0.01 && anchor.distanceToSquared(points[0]) > 0.01) entry.push(anchor)
    }
  }
  return new CatmullRomCurve3([...entry, ...points])
}

export function integrateFlight(position: Vector3, velocity: Vector3, target: Vector3, delta: number) {
  const { x, y, z } = position
  const factor = 1 - Math.exp(-5 * delta)
  position.addScaledVector(target, delta).addScaledVector(velocity, factor / 5).addScaledVector(target, -factor / 5)
  velocity.lerp(target, factor)
  const dx = position.x - x
  const dy = position.y - y
  const dz = position.z - z
  const lengthSq = dx * dx + dy * dy + dz * dz
  const along = x * dx + y * dy + z * dz
  const discriminant = along * along - lengthSq * (x * x + y * y + z * z - 16)
  const entry = along < 0 && discriminant >= 0 && lengthSq > 0 ? (-along - Math.sqrt(discriminant)) / lengthSq : Infinity
  if (entry >= 0 && entry <= 1) {
    position.set(x + dx * entry, y + dy * entry, z + dz * entry).setLength(4.001)
    velocity.set(0, 0, 0)
  } else if (position.lengthSq() < 16) {
    if (position.lengthSq() < 0.001) position.set(0, 0, 1)
    position.setLength(4)
    velocity.set(0, 0, 0)
  }
  if (position.lengthSq() > 20000 ** 2) position.setLength(20000)
}
