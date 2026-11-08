import { mountViewport } from './core/viewport'
import { mountSettings } from './state/settings'
import { mountHud } from './ui/hud'
import { mountExplore } from './ui/explore'
import './styles/main.css'

const canvas = document.querySelector('canvas')
const status = document.querySelector<HTMLElement>('[role="status"]')
const controls = document.querySelector('form')

if (canvas && status && controls) {
  const events = new AbortController()
  try {
    const settings = mountSettings(controls)
    mountHud(controls, settings, events.signal)
    mountExplore(controls, settings, events.signal)
    const dispose = mountViewport(canvas, status, controls, settings)
    function cleanup() {
      events.abort()
      dispose?.()
    }
    window.addEventListener('pagehide', event => {
      if (!event.persisted) cleanup()
    }, { signal: events.signal })
    import.meta.hot?.dispose(cleanup)
  } catch (error) {
    status.textContent = '观测画布初始化失败，请检查浏览器的图形设置。'
    console.error(error)
  }
}
