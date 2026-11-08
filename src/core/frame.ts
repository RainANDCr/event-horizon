export function frameDelta(now: number, previous: number): number {
  return Math.min((now - previous) / 1000, 0.05)
}

export function pixelRatio(deviceRatio: number): number {
  return Math.min(deviceRatio, 1.5)
}

export function adaptiveResolution() {
  const scales = [1, 0.85, 0.7, 0.55]
  let index = 0
  let slow = 0
  let fast = 0
  return {
    observe(fps: number) {
      slow = fps < 32 ? slow + 1 : 0
      fast = fps > 54 ? fast + 1 : 0
      if (slow >= 2 || fast >= 4) {
        index = Math.max(0, Math.min(scales.length - 1, index + (slow >= 2 ? 1 : -1)))
        slow = fast = 0
      }
      return scales[index]
    },
    resetSample() {
      slow = fast = 0
    },
  }
}
