import { Application } from 'pixi.js'
import { Synth } from './audio/synth'
import { connectKernel } from './kernel/client'
import { Glyphs } from './render/glyphs'
import { Terminal } from './ui/terminal'

const params = new URLSearchParams(location.search)
const app = new Application()
await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  antialias: false,
  preference: 'webgl',
  background: 0x070401,
  resolution: Math.min(2, window.devicePixelRatio || 1),
  autoDensity: true,
  roundPixels: true,
})
document.body.appendChild(app.canvas)

const glyphs = new Glyphs()
const synth = new Synth()
const kernel = await connectKernel((line) => console.info('[pcd]', line))
await glyphs.load()
const terminal = new Terminal(glyphs, synth, kernel, app.renderer)
await terminal.bootKernel()
if (params.has('instant')) {
  terminal.forceInstant()
}
app.stage.addChild(terminal.screen)

app.canvas.addEventListener('pointerdown', (event) => {
  const point = terminal.worldPoint(event.offsetX, event.offsetY)
  terminal.pointer(point.x, point.y, true)
})
app.canvas.addEventListener('pointermove', (event) => {
  const point = terminal.worldPoint(event.offsetX, event.offsetY)
  terminal.pointer(point.x, point.y, false)
})
window.addEventListener('keydown', (event) => {
  if (event.code === 'Tab' || event.code === 'Backspace') {
    event.preventDefault()
  }
  terminal.key(event.code)
})
const fitScreen = () => {
  const cssW = document.documentElement.clientWidth
  const cssH = document.documentElement.clientHeight
  if (cssW < 2 || cssH < 2) {
    return
  }
  app.renderer.resize(cssW, cssH)
  terminal.resize(cssW, cssH)
}
fitScreen()
window.addEventListener('resize', fitScreen)
new ResizeObserver(fitScreen).observe(document.documentElement)

app.ticker.add(() => {
  terminal.update(app.ticker.deltaMS, app.renderer)
})

void params
