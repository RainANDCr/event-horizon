export type CameraView = { yaw: number; pitch: number; distance: number }
type Shot = { duration: number; from: CameraView; to: CameraView; descent?: boolean }

export const home: CameraView = { yaw: 0, pitch: 0, distance: 13 }
export const shots = {
  deepSpace: { duration: 7, from: { yaw: 0, pitch: 0.24, distance: 34 }, to: { yaw: 0.38, pitch: 0.32, distance: 30 } },
  approach: { duration: 8, from: { yaw: 0, pitch: 0.22, distance: 30 }, to: { yaw: 0.22, pitch: 0.06, distance: 12 } },
  orbit: { duration: 12, from: { yaw: 0, pitch: 0.28, distance: 16 }, to: { yaw: 2 * Math.PI, pitch: 0.28, distance: 16 } },
  diskEdge: { duration: 7, from: { yaw: 0, pitch: -0.26, distance: 14 }, to: { yaw: 0.7, pitch: -0.15, distance: 11 } },
  photonRing: { duration: 7, from: { yaw: 0, pitch: 0.37, distance: 14 }, to: { yaw: 0.28, pitch: 0.28, distance: 7.5 } },
  descent: { duration: 9, from: { yaw: 0, pitch: 0.52, distance: 14 }, to: { yaw: 0.25, pitch: 0.39, distance: 4.2 }, descent: true },
} satisfies Record<string, Shot>

export type ShotId = keyof typeof shots

function smooth(value: number) {
  const t = Math.min(1, Math.max(0, value))
  return t * t * (3 - 2 * t)
}

export function blendView(from: CameraView, to: CameraView, t: number): CameraView {
  return {
    yaw: from.yaw + (to.yaw - from.yaw) * t,
    pitch: from.pitch + (to.pitch - from.pitch) * t,
    distance: from.distance + (to.distance - from.distance) * t,
  }
}

export function sampleShot(shot: Shot, initial: CameraView, elapsed: number) {
  const entry = 1.6
  const first = { ...shot.from, yaw: initial.yaw + shot.from.yaw }
  const last = { ...shot.to, yaw: initial.yaw + shot.to.yaw }
  const view = elapsed < entry
    ? blendView(initial, first, smooth(elapsed / entry))
    : blendView(first, last, smooth((elapsed - entry) / (shot.duration - entry)))
  return { view, shade: shot.descent ? smooth((elapsed - shot.duration + 2) / 2) : 0 }
}
