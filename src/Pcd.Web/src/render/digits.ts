import { Container, Sprite, Texture } from 'pixi.js'
import { gray } from './glyphs'

const SHAPES: Record<string, string[]> = {
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '+': ['00100', '00100', '11111', '00100', '00100', '00000', '00000'],
  '-': ['00000', '00000', '11111', '00000', '00000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
}

const dot = Texture.from(fillCanvas())

function fillCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 1, 1)
  return canvas
}

export class Digits {
  readonly root = new Container()
  private text = ''
  private scale = 0
  private bright = -1

  set(text: string, scale: number, bright: number): void {
    if (text === this.text && scale === this.scale && bright === this.bright) {
      return
    }
    this.text = text
    this.scale = scale
    this.bright = bright
    this.root.removeChildren()
    const tint = gray(bright)
    let x = 0
    for (const ch of text) {
      const rows = SHAPES[ch] ?? SHAPES[' ']!
      rows.forEach((row, y) => {
        for (let col = 0; col < row.length; col++) {
          if (row[col] !== '1') {
            continue
          }
          const pixel = new Sprite(dot)
          pixel.x = x + col * scale
          pixel.y = y * scale
          pixel.scale.set(scale)
          pixel.tint = tint
          this.root.addChild(pixel)
        }
      })
      x += 6 * scale
    }
  }

  get width(): number {
    return this.text.length * 6 * this.scale
  }
}

export function digitWidth(text: string, scale: number): number {
  return text.length * 6 * scale
}
