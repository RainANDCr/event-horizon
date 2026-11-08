import {
  BackSide, BufferGeometry, Color, Float32BufferAttribute, Mesh, PerspectiveCamera,
  Points, PointsMaterial, Scene, ShaderMaterial, SphereGeometry,
} from 'three'

export function createDeepSpace(seed = 2177) {
  const scene = new Scene()
  const camera = new PerspectiveCamera(53, 1, 0.1, 240)
  camera.position.z = 13

  const sky = new Mesh(new SphereGeometry(210, 32, 16), new ShaderMaterial({
    side: BackSide,
    uniforms: { exposure: { value: 1 } },
    vertexShader: `
      varying vec3 direction;
      void main() {
        direction = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float exposure;
      varying vec3 direction;
      void main() {
        vec3 d = normalize(direction);
        float band = d.y + 0.5 * d.x - 0.12;
        float cloud = exp(-15.0 * band * band);
        float ripple = sin(16.0 * d.x + 7.0 * d.y + sin(22.0 * d.y));
        float detail = 0.65 + 0.20 * ripple + 0.1 * sin(51.0 * d.x - 27.0 * d.y);
        vec3 color = vec3(0.003, 0.005, 0.011)
                   + cloud * detail * vec3(0.017, 0.028, 0.051);
        gl_FragColor = vec4(color * exposure, 1.0);
        #include <colorspace_fragment>
      }
    `,
  }))
  scene.add(sky)

  let randomState = seed >>> 0
  function random() {
    randomState = (Math.imul(1664525, randomState) + 1013904223) >>> 0
    return randomState / 4294967296
  }

  function layer(count: number, size: number, distance: number, dust = false) {
    const geometry = new BufferGeometry()
    const positions: number[] = []
    const colors: number[] = []
    const tint = new Color()

    for (let index = 0; index < count; index++) {
      const height = dust ? (random() + random() - 1) * 0.32 : random() * 2 - 1
      const angle = random() * Math.PI * 2
      const radius = distance + random() * 18
      const ring = radius * Math.sqrt(1 - height * height)
      const x = ring * Math.cos(angle)
      positions.push(x, radius * height - (dust ? x * 0.36 : 0), ring * Math.sin(angle))
      tint.setHSL(0.52 + random() * 0.13, 0.22, dust ? 0.065 + random() * 0.05 : 0.23 + random() ** 2 * 0.69)
      colors.push(tint.r, tint.g, tint.b)
    }

    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
    return new Points(geometry, new PointsMaterial({ size, vertexColors: true }))
  }

  const distant = layer(5400, 0.22, 125)
  const bright = layer(700, 0.25, 67)
  const dust = layer(3600, 0.22, 95, true)
  const stars = [distant, bright, dust]
  scene.add(...stars)

  return {
    scene,
    camera,
    stars,

    update(fov: number, density: number, exposure: number, showDust: boolean, steps: number) {
      camera.fov = fov
      camera.updateProjectionMatrix()

      sky.material.uniforms.exposure.value = exposure
      for (const layer of stars) {
        const quality = steps === 64 ? 0.38 : steps === 96 ? 0.68 : 1
        const amount = layer === dust ? (showDust ? density * quality : 0) : density
        layer.geometry.setDrawRange(0, Math.round(layer.geometry.getAttribute('position').count * amount))
        layer.material.color.setScalar(exposure)
      }
    },
    dispose() {

      sky.geometry.dispose()
      sky.material.dispose()
      for (const layer of stars) {
        layer.geometry.dispose()
        layer.material.dispose()
      }
      scene.clear()
    },
  }
}
