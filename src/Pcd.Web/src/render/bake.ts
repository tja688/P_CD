import { Texture } from 'pixi.js'

export type FrameKind = 'player' | 'monster' | 'empty' | 'polluted'

const cache = new Map<string, Texture>()

export function frameTexture(kind: FrameKind, w: number, h: number): Texture {
  const key = `${kind}:${w}x${h}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  const edge = kind === 'monster' ? 170 : kind === 'empty' || kind === 'polluted' ? 90 : 230
  const fill = kind === 'polluted' ? 28 : 16
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const border = x === 0 || y === 0 || x === w - 1 || y === h - 1
      const corner = (x === 0 || x === w - 1) && (y === 0 || y === h - 1)
      let value = fill
      if (border) {
        value = corner ? Math.min(255, edge + 25) : edge
      } else if (kind === 'polluted' && (x + y) % 5 === 0) {
        value = 48
      } else if (kind === 'player' && y === 1) {
        value = 70
      } else if (kind === 'monster' && y === 1) {
        value = 46
      }
      const i = (y * w + x) * 4
      img.data[i] = value
      img.data[i + 1] = value
      img.data[i + 2] = value
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'nearest'
  texture.source.autoGenerateMipmaps = false
  cache.set(key, texture)
  return texture
}

export function overlayTexture(w: number, h: number): Texture {
  const key = `overlay:${w}x${h}`
  const cached = cache.get(key)
  if (cached) {
    return cached
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const border = x < 2 || y < 2 || x >= w - 2 || y >= h - 2
      if (!border) {
        continue
      }
      const i = (y * w + x) * 4
      img.data[i] = 255
      img.data[i + 1] = 255
      img.data[i + 2] = 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const texture = Texture.from(canvas)
  texture.source.scaleMode = 'nearest'
  texture.source.autoGenerateMipmaps = false
  cache.set(key, texture)
  return texture
}
