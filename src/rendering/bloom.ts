import { Camera, Scene, Vector2, WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'

export function createBloom(renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  const composer = new EffectComposer(renderer)
  const render = new RenderPass(scene, camera)
  const bloom = new UnrealBloomPass(renderer.getSize(new Vector2()), 0, 0.25, 0.72)
  const optics = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, texel: { value: new Vector2() } },
    vertexShader: `
      varying vec2 texCoord;
      void main() {
        texCoord = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 texCoord;
      uniform sampler2D tDiffuse;
      uniform vec2 texel;
      void main() {
        vec2 offset = texCoord - 0.5;
        float edge = smoothstep(0.19, 0.52, dot(offset, offset));
        vec2 fringe = offset * edge * texel * 2.2;
        vec3 rgb = texture2D(tDiffuse, texCoord).rgb;
        rgb.r = texture2D(tDiffuse, clamp(texCoord + fringe, 0.0, 1.0)).r;
        rgb.b = texture2D(tDiffuse, clamp(texCoord - fringe, 0.0, 1.0)).b;
        gl_FragColor = vec4(rgb * (1.0 - edge * 0.29), 1.0);
      }
    `,
  })
  const output = new OutputPass()
  composer.addPass(render)
  composer.addPass(bloom)
  composer.addPass(optics)
  composer.addPass(output)
  let budget = 0

  function sizePasses(steps: number) {
    const { width, height } = composer.readBuffer
    const scale = steps === 64 ? 0.45 : steps === 96 ? 0.7 : 1
    bloom.setSize(Math.max(2, Math.floor(width * scale)), Math.max(2, Math.floor(height * scale)))
    optics.uniforms.texel.value.set(1 / width, 1 / height)
  }

  return {
    resize(width: number, height: number, ratio: number) {
      composer.setPixelRatio(ratio)
      composer.setSize(width, height)
      sizePasses(budget)
    },
    render(amount: number, lens: boolean, steps: number) {
      if (budget !== steps) {
        budget = steps
        sizePasses(steps)
      }
      bloom.enabled = amount > 0
      bloom.strength = amount * 0.18
      optics.enabled = lens
      composer.render()
    },
    dispose() {
      bloom.dispose()
      optics.dispose()
      output.dispose()
      composer.dispose()
    },
  }
}
