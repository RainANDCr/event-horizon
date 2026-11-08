import {
  Color, CubeCamera, Mesh, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial,
  Vector3, WebGLCubeRenderTarget, WebGLRenderer,
} from 'three'
import { diskShader } from './accretion-disk'
import { SHADOW_RADIUS_RS } from './black-hole'
import type { Settings } from '../state/settings'
import { nebulaShader } from '../flight/nebula'

export function createLensedView(camera: PerspectiveCamera) {
  const sky = new WebGLCubeRenderTarget(1024)
  const skyCamera = new CubeCamera(1, 240, sky)
  const geometry = new PlaneGeometry(2, 2)
  const uniforms = {
    sky: { value: sky.texture },
    inverseProjection: { value: camera.projectionMatrixInverse },
    observerMatrix: { value: camera.matrixWorld },
    worldOrigin: { value: new Vector3() },
    region: { value: -1 },
    nebulaQuality: { value: 4 },
    nebulaColor: { value: new Color('#6a8fee') },
    nebulaDensity: { value: 0.8 },
    nebulaLight: { value: 1 },
    nebulaSize: { value: 1 },
    nebulaTime: { value: 0 },
    criticalImpact: { value: SHADOW_RADIUS_RS },
    massScale: { value: 1 },
    lensed: { value: true },
    steps: { value: 96 },
    diskY: { value: new Vector3(0, 1, 0) },
    diskNormal: { value: new Vector3(0, 0, 1) },
    time: { value: 0 },
    inner: { value: 3.2 },
    outer: { value: 8.7 },
    brightness: { value: 1 },
    heat: { value: 1 },
    turbulence: { value: 0.8 },
    octaves: { value: 4 },
    spinBias: { value: 0 },
  }
  const material = new ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 screenPoint;
      void main() {
        screenPoint = position.xy;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 screenPoint;
      uniform samplerCube sky;
      uniform mat4 inverseProjection, observerMatrix;
      uniform float criticalImpact, massScale;
      uniform bool lensed;
      uniform int steps;
      uniform vec3 diskY, diskNormal;

      ${diskShader}
      ${nebulaShader}

      void crossDisk(vec3 start, vec3 end, inout vec4 emission) {
        float first = dot(start, diskNormal);
        float last = dot(end, diskNormal);
        if ((first > 0.0) == (last > 0.0) || abs(first - last) < 0.00001) return;
        vec3 hit = mix(start, end, first / (first - last));
        vec3 towardObserver = normalize(start - end);
        vec4 disk = shadeDisk(vec2(hit.x, dot(hit, diskY)), vec2(towardObserver.x, dot(towardObserver, diskY)));
        float coverage = (1.0 - emission.a) * disk.a;
        emission += vec4(disk.rgb * coverage, coverage);
      }

      vec3 straightRay(vec3 observer, vec3 ray) {
        float along = dot(observer, ray);
        float radius = criticalImpact * massScale;
        float discriminant = along * along - dot(observer, observer) + radius * radius;
        bool captured = along < 0.0 && discriminant >= 0.0;
        float limit = captured ? max(0.0, -along - sqrt(max(0.0, discriminant))) : 80.0;
        vec4 emission = vec4(0.0);
        crossDisk(observer, observer + limit * ray, emission);
        return emission.rgb + (captured ? vec3(0.0) : (1.0 - emission.a) * environment(ray));
      }

      vec2 orbitDerivative(vec2 orbit) {
        return vec2(orbit.y, orbit.x * (1.5 * orbit.x - 1.0));
      }

      vec3 orbitDirection(vec3 radial, vec3 tangent, float phi) {
        return cos(phi) * radial + sin(phi) * tangent;
      }

      vec3 curvedRay(vec3 observer, vec3 ray) {
        float distance = length(observer);
        if (distance <= massScale * 1.001) return vec3(0.0);
        vec3 radial = observer / distance;
        float radialSpeed = dot(radial, ray);
        vec3 sideways = ray - radialSpeed * radial;
        float angularSpeed = length(sideways);
        if (angularSpeed < 0.001) return straightRay(observer, ray);

        vec3 tangent = sideways / angularSpeed;
        float u = massScale / distance;
        vec2 orbit = vec2(u, -u * sqrt(1.0 - u) * radialSpeed / angularSpeed);
        float phi = 0.0;
        vec3 previous = observer;
        vec4 emission = vec4(0.0);

        for (int i = 0; i < 144; i++) {
          if (i >= steps) break;
          float stepAngle = min(7.6 / float(steps), 0.15 / max(abs(orbit.y), 0.0001));
          vec2 k1 = orbitDerivative(orbit);
          vec2 k2 = orbitDerivative(orbit + 0.5 * stepAngle * k1);
          vec2 k3 = orbitDerivative(orbit + 0.5 * stepAngle * k2);
          vec2 k4 = orbitDerivative(orbit + stepAngle * k3);
          vec2 next = orbit + (stepAngle / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);

          float escape = massScale / 80.0;
          if (next.x <= escape) {
            float edge = clamp((orbit.x - escape) / max(orbit.x - next.x, 0.00001), 0.0, 1.0);
            vec3 farPoint = 80.0 * orbitDirection(radial, tangent, phi + stepAngle * edge);
            crossDisk(previous, farPoint, emission);
            float infinityAngle = phi + stepAngle * edge + escape / max(-next.y, 0.0001);
            return emission.rgb + (1.0 - emission.a) * environment(orbitDirection(radial, tangent, infinityAngle));
          }

          bool captured = next.x >= 1.0;
          float edge = captured ? clamp((1.0 - orbit.x) / max(next.x - orbit.x, 0.00001), 0.0, 1.0) : 1.0;
          vec3 point = orbitDirection(radial, tangent, phi + stepAngle * edge) * (massScale / min(next.x, 1.0));
          crossDisk(previous, point, emission);
          if (captured || emission.a > 0.998) break;
          previous = point;
          phi += stepAngle;
          orbit = next;
        }
        return emission.rgb;
      }

      void main() {
        vec4 cameraPoint = inverseProjection * vec4(screenPoint, -1.0, 1.0);
        vec3 ray = normalize(mat3(observerMatrix) * cameraPoint.xyz);
        vec3 observer = cameraPosition + worldOrigin;
        vec3 color;
        if (region >= 0 && dot(observer, observer) > 45.0 * 45.0) {
          float along = -dot(observer, ray);
          float impactSq = dot(cross(observer, ray), cross(observer, ray));
          if (along <= 0.0 || impactSq >= 45.0 * 45.0) {
            gl_FragColor = vec4(environment(ray), 1.0);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
            return;
          }
          observer += ray * (along - sqrt(45.0 * 45.0 - impactSq));
        }
        color = lensed ? curvedRay(observer, ray) : straightRay(observer, ray);
        gl_FragColor = vec4(color, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  })
  const quad = new Mesh(geometry, material)
  quad.frustumCulled = false
  quad.renderOrder = -10
  const scene = new Scene()
  scene.add(quad)

  return {
    scene,
    setWorldOrigin(origin: Vector3 | null) {
      if (origin) uniforms.worldOrigin.value.copy(origin)
      else uniforms.worldOrigin.value.set(0, 0, 0)
    },
    setEnvironment(region: number, quality: number, density: number, light: number, size: number, color: string, delta: number) {
      uniforms.region.value = region
      uniforms.nebulaQuality.value = quality
      uniforms.nebulaDensity.value = density
      uniforms.nebulaLight.value = light
      uniforms.nebulaSize.value = size
      uniforms.nebulaColor.value.set(color)
      uniforms.nebulaTime.value += delta
    },
    captureSky(renderer: WebGLRenderer, background: Scene) {
      skyCamera.update(renderer, background)
    },
    update(values: Settings) {
      for (const key of ['inner', 'outer', 'brightness', 'heat', 'turbulence', 'octaves', 'steps'] as const) {
        uniforms[key].value = values[key]
      }
      uniforms.brightness.value *= values.exposure
      uniforms.massScale.value = values.scale
      uniforms.lensed.value = values.lensed
      uniforms.spinBias.value = values.model === 'rotating' ? values.spin : 0
      const tilt = values.tilt * Math.PI / 180
      uniforms.diskY.value.set(0, Math.cos(tilt), -Math.sin(tilt))
      uniforms.diskNormal.value.set(0, Math.sin(tilt), Math.cos(tilt))
    },
    advance(seconds: number) {
      uniforms.time.value += seconds
    },
    dispose() {
      sky.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
}
