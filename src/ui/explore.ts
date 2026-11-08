import { normalizeSettings, writeStored, readStored, type mountSettings, type Settings } from '../state/settings'

const presets: Record<string, Partial<Settings>> = {
  Schwarzschild: { model: 'schwarzschild', lensed: true },
  'Rotating Concept': { model: 'rotating', spin: 0.7 },
  'Edge-on Disk': { tilt: 86, distance: 16 },
  'Face-on Disk': { tilt: 0, distance: 19 },
  'Deep Space': { distance: 34, density: 1 },
  Cinematic: { bloom: 0.45, optics: true, exposure: 1.15, tilt: 78, distance: 13 },
}

const topics: [string, string, Partial<Settings>][] = [
  ['黑洞是什么', '黑洞是一个连光也无法从内部逃逸的时空区域。画面中的可见光来自背景星光和周围的热物质。', { distance: 18 }],
  ['事件视界', '事件视界是向外发出的信号无法到达远处观察者的边界。本实验从视界外观察。', { model: 'schwarzschild', lensed: true, distance: 6.5 }],
  ['黑洞阴影', '阴影是背景光无法沿观察方向抵达相机的区域。它的表观范围由光路与观察位置决定。', { lensed: true, brightness: 0, distance: 12 }],
  ['吸积盘', '落向黑洞的物质可形成旋转盘。模拟用径向温度渐变和随半径变化的角速度表现盘面流动。', { tilt: 23, brightness: 1, distance: 19 }],
  ['引力透镜', '黑洞附近的时空弯曲改变光路。背侧盘面可以出现在阴影上方。可用「引力透镜」开关对比。', { lensed: true, tilt: 78, brightness: 1, distance: 13 }],
  ['光子球与光子环', '光子球由不稳定的圆形光轨道构成。沿这些轨道附近绕行的光可在图像中形成细环。当前积分仅展示亮环的宽尺度结构。', { lensed: true, tilt: 78, brightness: 1, distance: 8, steps: 144 }],
  ['旋转黑洞', '自旋会影响真实黑洞附近的时空。本场景只改变盘面流动与亮度偏置，光路继续采用史瓦西模型。', { model: 'rotating', spin: 0.8, brightness: 1, distance: 13 }],
  ['相对论性亮度变化', '朝向观察者运动的盘面可显得更亮。这里用局部速度投影近似这种方向差异。', { tilt: 82, brightness: 1, heat: 1, distance: 13 }],
]

export function mountExplore(form: HTMLFormElement, settings: ReturnType<typeof mountSettings>, signal: AbortSignal) {
  const options = { signal }
  const main = form.closest('main')!
  const guide = main.querySelector<HTMLDialogElement>('[data-guide-dialog]')!
  const topic = guide.querySelector<HTMLSelectElement>('[data-topic]')!
  const explanation = guide.querySelector<HTMLElement>('[data-explanation]')!
  const preset = guide.querySelector<HTMLSelectElement>('[data-preset]')!
  const intro = main.querySelector<HTMLElement>('[data-intro]')!
  function load(values: Partial<Settings>) {
    settings.apply(normalizeSettings(values))
    form.querySelector<HTMLButtonElement>('[data-reset-camera]')?.click()
    form.dispatchEvent(new Event('settingsload'))
  }
  topic.replaceChildren(...topics.map(([name], index) => new Option(name, String(index))))
  preset.replaceChildren(...Object.keys(presets).map(name => new Option(name)))
  const describe = () => { explanation.textContent = topics[Number(topic.value)][1] }
  describe()
  topic.addEventListener('change', describe, options)
  guide.querySelector('[data-show-topic]')?.addEventListener('click', () => {
    load(topics[Number(topic.value)][2])
    guide.close()
  }, options)
  guide.querySelector('[data-load-preset]')?.addEventListener('click', () => {
    load(presets[preset.value])
    guide.close()
  }, options)
  guide.querySelector('[data-close-guide]')?.addEventListener('click', () => guide.close(), options)
  main.querySelector('[data-open-guide]')?.addEventListener('click', () => guide.showModal(), options)
  const key = 'event-horizon.intro'
  intro.hidden = readStored(key) === true
  intro.querySelector('button')?.addEventListener('click', () => {
    intro.hidden = true
    writeStored(key, true)
  }, options)
}
