import { mountSettings, normalizeSettings, parseSettingsJson, readStored, writeStored, type Settings } from '../state/settings'
import { downloadBlob } from '../export/media'

const collectionKey = 'event-horizon.scenes'

export function mountHud(form: HTMLFormElement, settings: ReturnType<typeof mountSettings>, signal: AbortSignal) {
  const options = { signal }
  const main = form.closest('main')!
  const button = (name: string) => main.querySelector<HTMLButtonElement>(`[data-${name}]`)!
  const dialog = form.querySelector<HTMLDialogElement>('[data-settings-dialog]')!
  const note = dialog.querySelector<HTMLElement>('[data-settings-note]')!
  const list = dialog.querySelector<HTMLSelectElement>('[data-scenes]')!
  const drawer = form.querySelector<HTMLDetailsElement>('.lab-drawer')!
  const mobile = matchMedia('(max-width: 720px)')
  form.addEventListener('submit', event => event.preventDefault(), options)
  function adjustDrawer() {
    drawer.open = !mobile.matches
  }
  adjustDrawer()
  mobile.addEventListener('change', adjustDrawer, options)
  const stored = readStored(collectionKey)
  const scenes: { name: string; settings: Settings }[] = []
  if (Array.isArray(stored)) {
    for (const scene of stored) {
      if (scene && typeof scene.name === 'string') {
        scenes.push({ name: scene.name.slice(0, 40), settings: normalizeSettings(scene.settings) })
      }
    }
  }

  function renderScenes() {
    list.replaceChildren(...scenes.map((scene, index) => new Option(scene.name, String(index))))
    for (const action of ['load-scene', 'rename-scene', 'update-scene', 'delete-scene']) {
      button(action).disabled = scenes.length === 0
    }
  }
  renderScenes()
  button('open-settings').addEventListener('click', () => dialog.showModal(), options)
  button('close-settings').addEventListener('click', () => dialog.close(), options)
  button('reset-settings').addEventListener('click', () => {
    settings.apply(normalizeSettings(null))
    form.dispatchEvent(new Event('settingsload'))
    note.textContent = '已恢复默认参数'
  }, options)
  button('save-scene').addEventListener('click', () => {
    const name = String(new FormData(form).get('sceneName')).trim() || `场景 ${scenes.length + 1}`
    const scene = { name, settings: settings.read() }
    if (!writeStored(collectionKey, [...scenes, scene])) {
      note.textContent = '浏览器无法保存收藏'
      return
    }
    scenes.push(scene)
    renderScenes()
    list.value = String(scenes.length - 1)
    note.textContent = `已收藏「${name}」`
  }, options)
  button('load-scene').addEventListener('click', () => {
    const scene = scenes[Number(list.value)]
    if (!scene) return
    settings.apply(scene.settings)
    form.dispatchEvent(new Event('settingsload'))
    note.textContent = `已载入「${scene.name}」`
  }, options)
  for (const action of ['rename', 'update', 'delete'] as const) {
    button(`${action}-scene`).addEventListener('click', () => {
      const index = Number(list.value)
      const scene = scenes[index]
      if (!scene) return
      const name = String(new FormData(form).get('sceneName')).trim()
      if (action === 'rename' && !name) {
        note.textContent = '请先填写新的收藏名称'
        return
      }
      const next = scenes.slice()
      if (action === 'delete') next.splice(index, 1)
      else next[index] = action === 'rename' ? { ...scene, name } : { ...scene, settings: settings.read() }
      if (!writeStored(collectionKey, next)) {
        note.textContent = '无法更新本地收藏'
        return
      }
      scenes.splice(0, scenes.length, ...next)
      renderScenes()
      if (scenes.length) list.value = String(Math.min(index, scenes.length - 1))
      note.textContent = action === 'delete' ? '已删除收藏' : '已更新收藏'
    }, options)
  }

  button('export-settings').addEventListener('click', () => {
    const json = JSON.stringify({ version: 1, settings: settings.read() }, null, 2)
    downloadBlob(new Blob([json], { type: 'application/json' }), 'event-horizon.json')
  }, options)
  const upload = dialog.querySelector<HTMLInputElement>('[data-import-settings]')!
  upload.addEventListener('change', async () => {
    const file = upload.files?.[0]
    upload.value = ''
    if (!file) return
    try {
      if (file.size > 100_000) throw new Error()
      const imported = parseSettingsJson(await file.text())
      settings.apply(imported)
      form.dispatchEvent(new Event('settingsload'))
      note.textContent = '已导入配置'
    } catch {
      note.textContent = '无法导入。请选择参数与版本有效的 JSON 文件。'
    }
  }, options)

  const fullscreen = button('fullscreen')
  fullscreen.disabled = !document.fullscreenEnabled
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await main.requestFullscreen()
    } catch {
      fullscreen.textContent = '全屏不可用'
    }
  }, options)
  document.addEventListener('fullscreenchange', () => {
    fullscreen.textContent = document.fullscreenElement ? '退出全屏' : '全屏'
  }, options)
  button('screenshot').addEventListener('click', () => form.dispatchEvent(new Event('captureframe')), options)

  const restore = button('show-hud')
  function setHidden(hidden: boolean) {
    main.classList.toggle('clean', hidden)
    restore.hidden = !hidden
    if (hidden) restore.focus()
    else button('hide-hud').focus()
  }
  button('hide-hud').addEventListener('click', () => setHidden(true), options)
  restore.addEventListener('click', () => setHidden(false), options)
  main.addEventListener('keydown', event => {
    if (event.key === 'Escape' && main.classList.contains('clean')) setHidden(false)
  }, options)
  button('screenshot').disabled = true
}
