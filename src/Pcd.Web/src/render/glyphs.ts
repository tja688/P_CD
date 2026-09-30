import { Container, Rectangle, Sprite, Texture } from 'pixi.js'

type Glyph = { x: number; y: number; w: number; h: number; advance: number }

const ATLAS = 1024

export class Glyphs {
  private canvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private map = new Map<string, Glyph>()
  private penX = 1
  private penY = 1
  private rowH = 0
  private dirty = false
  readonly texture: Texture

  constructor() {
    this.canvas.width = ATLAS
    this.canvas.height = ATLAS
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      throw new Error('无法建立字形画布')
    }
    this.ctx = ctx
    ctx.imageSmoothingEnabled = false
    this.texture = Texture.from(this.canvas)
    this.texture.source.scaleMode = 'nearest'
    this.texture.source.autoGenerateMipmaps = false
  }

  async load(): Promise<void> {
    const latin = new FontFace('PcdLatin', 'url(/fonts/ark-pixel-12px-monospaced-latin.otf.woff2)')
    const cjk = new FontFace('PcdCjk', 'url(/fonts/ark-pixel-12px-monospaced-zh_hans.otf.woff2)')
    await Promise.all([latin.load(), cjk.load()])
    const fonts = document.fonts as FontFaceSet & { add: (face: FontFace) => void }
    fonts.add(latin)
    fonts.add(cjk)
    await document.fonts.ready
  }

  measure(text: string): number {
    let width = 0
    for (const ch of text) {
      width += this.ensure(ch).advance
    }
    return width
  }

  lineHeight(): number {
    return 14
  }

  makeLabel(): Label {
    return new Label(this)
  }

  ensure(ch: string): Glyph {
    const cached = this.map.get(ch)
    if (cached) {
      return cached
    }
    const cjk = ch.codePointAt(0)! > 127
    const font = cjk ? '12px PcdCjk' : '12px PcdLatin'
    const scratch = document.createElement('canvas')
    scratch.width = 24
    scratch.height = 20
    const sctx = scratch.getContext('2d')!
    sctx.imageSmoothingEnabled = false
    sctx.font = font
    sctx.textBaseline = 'top'
    sctx.fillStyle = '#fff'
    sctx.fillText(ch, 1, 1)
    const pixels = sctx.getImageData(0, 0, scratch.width, scratch.height)
    let minX = scratch.width
    let minY = scratch.height
    let maxX = -1
    let maxY = -1
    for (let y = 0; y < scratch.height; y++) {
      for (let x = 0; x < scratch.width; x++) {
        const alpha = pixels.data[(y * scratch.width + x) * 4 + 3] ?? 0
        const lum = pixels.data[(y * scratch.width + x) * 4] ?? 0
        if (alpha > 140 && lum > 140) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    }
    sctx.font = font
    const advance = Math.max(4, Math.round(sctx.measureText(ch).width))
    if (maxX < minX) {
      const blank: Glyph = { x: 0, y: 0, w: 0, h: 0, advance }
      this.map.set(ch, blank)
      return blank
    }
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    if (this.penX + w + 1 >= ATLAS) {
      this.penX = 1
      this.penY += this.rowH + 1
      this.rowH = 0
    }
    const dest = this.ctx.getImageData(this.penX, this.penY, w, h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = ((minY + y) * scratch.width + (minX + x)) * 4
        const on = (pixels.data[src + 3] ?? 0) > 140 && (pixels.data[src] ?? 0) > 140
        const i = (y * w + x) * 4
        dest.data[i] = on ? 255 : 0
        dest.data[i + 1] = on ? 255 : 0
        dest.data[i + 2] = on ? 255 : 0
        dest.data[i + 3] = on ? 255 : 0
      }
    }
    this.ctx.putImageData(dest, this.penX, this.penY)
    const glyph: Glyph = { x: this.penX, y: this.penY, w, h, advance }
    this.penX += w + 1
    this.rowH = Math.max(this.rowH, h)
    this.map.set(ch, glyph)
    this.dirty = true
    return glyph
  }

  flush(): void {
    if (!this.dirty) {
      return
    }
    this.texture.source.update()
    this.dirty = false
  }

  frame(ch: string): Texture {
    const glyph = this.ensure(ch)
    if (glyph.w === 0) {
      return Texture.EMPTY
    }
    return new Texture({
      source: this.texture.source,
      frame: new Rectangle(glyph.x, glyph.y, glyph.w, glyph.h),
    })
  }
}

export class Label {
  readonly root = new Container()
  private text = ''
  private width = 0
  private bright = -1
  private lines = 1

  constructor(private glyphs: Glyphs) {}

  set(text: string, maxWidth: number, bright: number): void {
    if (text === this.text && maxWidth === this.width && bright === this.bright) {
      return
    }
    this.text = text
    this.width = maxWidth
    this.bright = bright
    this.root.removeChildren()
    const tint = gray(bright)
    const wrapped = wrap(this.glyphs, text, maxWidth)
    this.lines = wrapped.length
    wrapped.forEach((line, row) => {
      let x = 0
      for (const ch of line) {
        const glyph = this.glyphs.ensure(ch)
        if (glyph.w > 0) {
          const sprite = new Sprite(this.glyphs.frame(ch))
          sprite.x = x
          sprite.y = row * this.glyphs.lineHeight() + (12 - glyph.h)
          sprite.tint = tint
          sprite.roundPixels = true
          this.root.addChild(sprite)
        }
        x += glyph.advance
      }
    })
    this.glyphs.flush()
  }

  get height(): number {
    return this.lines * this.glyphs.lineHeight()
  }
}

function wrap(glyphs: Glyphs, text: string, maxWidth: number): string[] {
  if (maxWidth <= 0) {
    return text.split('\n')
  }
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    let width = 0
    for (const ch of paragraph) {
      const advance = glyphs.ensure(ch).advance
      if (line.length > 0 && width + advance > maxWidth) {
        lines.push(line)
        line = ch
        width = advance
      } else {
        line += ch
        width += advance
      }
    }
    lines.push(line)
  }
  return lines.length === 0 ? [''] : lines
}

export function gray(amount: number): number {
  const v = Math.max(0, Math.min(255, Math.round(amount * 255)))
  return (v << 16) | (v << 8) | v
}
