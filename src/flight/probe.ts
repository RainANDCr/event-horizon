import { BoxGeometry, BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, Points, PointsMaterial } from 'three'

export function createProbe() {
  const model = new Group()
  const metal = new MeshStandardMaterial({ color: 0xa5b4be, roughness: 0.32, metalness: 0.48 })
  const panel = new MeshStandardMaterial({ color: 0x183872, roughness: 0.38, metalness: 0.2 })
  const dark = new MeshStandardMaterial({ color: 0x232935, roughness: 0.7 })
  const lamp = new MeshStandardMaterial({ color: 0x60dff9, emissive: 0x43c0ff, emissiveIntensity: 2 })
  const jet = new MeshStandardMaterial({ color: 0xa7ecff, emissive: 0x76ceff, emissiveIntensity: 3, transparent: true, opacity: 0.65, depthWrite: false })
  function add(geometry: BufferGeometry, material: MeshStandardMaterial, x: number, y: number, z: number) {
    const mesh = new Mesh(geometry, material)
    mesh.position.set(x, y, z)
    model.add(mesh)
    return mesh
  }
  add(new BoxGeometry(0.72, 0.38, 0.93), metal, 0, 0, 0)
  add(new BoxGeometry(0.38, 0.24, 0.32), dark, 0, 0.22, -0.28)
  const dish = add(new ConeGeometry(0.24, 0.13, 12, 1, true), metal, 0, 0.39, 0.14)
  dish.rotation.z = Math.PI
  add(new CylinderGeometry(0.024, 0.024, 0.24), dark, 0, 0.46, 0.14)
  for (const side of [-1, 1]) {
    add(new BoxGeometry(0.86, 0.045, 0.09), metal, side * 0.66, 0, 0)
    add(new BoxGeometry(0.95, 0.048, 0.51), panel, side * 1.03, 0, 0)
    for (let cell = 0; cell < 4; cell++) add(new BoxGeometry(0.013, 0.051, 0.51), metal, side * 1.03 - 0.36 + cell * 0.24, 0, 0)
    add(new BoxGeometry(0.07, 0.08, 0.1), lamp, side * 1.5, 0, -0.15)
    const nozzle = add(new CylinderGeometry(0.08, 0.12, 0.2, 8), dark, side * 0.28, 0, 0.53)
    nozzle.rotation.x = Math.PI / 2
  }
  const plume = add(new ConeGeometry(0.13, 0.7, 8), jet, 0, 0, 0.87)
  plume.rotation.x = Math.PI / 2
  const trailGeometry = new BufferGeometry()
  const points = new Float32Array(48 * 3)
  trailGeometry.setAttribute('position', new Float32BufferAttribute(points, 3))
  const trailMaterial = new PointsMaterial({ color: new Color('#9bddff'), size: 0.044, transparent: true, opacity: 0.48, depthWrite: false })
  const trail = new Points(trailGeometry, trailMaterial)
  trail.frustumCulled = false
  model.add(trail)
  return {
    model,
    update(time: number, thrust: number, count: number) {
      plume.visible = trail.visible = thrust > 0.04
      plume.scale.y = (0.45 + 0.55 * thrust) * (0.9 + 0.1 * Math.sin(time * 28))
      trailGeometry.setDrawRange(0, count)
      const positions = trailGeometry.getAttribute('position')
      for (let i = 0; i < count; i++) {
        const phase = (i / count + time * 0.6) % 1
        positions.setXYZ(i, 0.13 * phase * Math.sin(i * 2.4), 0.1 * phase * Math.cos(i * 2.4), 0.6 + phase * 2.2)
      }
      positions.needsUpdate = true
    },
    dispose() {
      model.traverse(object => { if (object instanceof Mesh) object.geometry.dispose() })
      trailGeometry.dispose()
      for (const material of [metal, panel, dark, lamp, jet, trailMaterial]) material.dispose()
    },
  }
}
