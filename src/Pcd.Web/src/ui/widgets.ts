import { Container, Sprite } from 'pixi.js'
import { frameTexture, overlayTexture, type FrameKind } from '../render/bake'
import { Digits } from '../render/digits'
import { Glyphs, type Label } from '../render/glyphs'

export class CardFace {
  readonly root = new Container()
  private bg: Sprite
  private edge: Sprite
  private title: Label
  private sub: Label
  private points = new Digits()
  private kind: FrameKind = 'empty'
  readonly w: number
  readonly h: number
  private signature = ''

  constructor(
    private glyphs: Glyphs,
    w: number,
    h: number,
  ) {
    this.w = w
    this.h = h
    this.bg = new Sprite(frameTexture('empty', w, h))
    this.edge = new Sprite(overlayTexture(w, h))
    this.edge.visible = false
    this.title = glyphs.makeLabel()
    this.sub = glyphs.makeLabel()
    this.title.root.x = 4
    this.title.root.y = 4
    this.points.root.y = h > 100 ? 22 : h > 80 ? 34 : 26
    this.sub.root.x = 4
    this.sub.root.y = h - 16
    this.root.addChild(this.bg, this.edge, this.title.root, this.points.root, this.sub.root)
  }

  show(opts: {
    kind: FrameKind
    title: string
    sub: string
    points: string
    bright: number
    hot: boolean
    legal: boolean
  }): void {
    const signature = `${opts.kind}|${opts.title}|${opts.sub}|${opts.points}|${opts.bright}|${opts.hot}|${opts.legal}`
    if (signature === this.signature) {
      return
    }
    this.signature = signature
    if (opts.kind !== this.kind) {
      this.kind = opts.kind
      this.bg.texture = frameTexture(opts.kind, this.w, this.h)
    }
    this.title.set(opts.title, this.w - 8, opts.bright)
    this.sub.set(opts.sub, this.w - 8, opts.bright * 0.72)
    this.points.set(opts.points, opts.points.length > 2 ? 2 : 2, opts.bright)
    this.points.root.x = Math.max(4, Math.round((this.w - this.points.width) / 2))
    this.edge.visible = opts.hot || opts.legal
    this.edge.alpha = opts.hot ? 0.95 : 0.45
    this.root.alpha = 1
  }
}

export class ButtonFace {
  readonly root = new Container()
  private label: Label
  private bg: Sprite
  private w: number
  private h: number
  private text = ''
  private hot = false

  constructor(
    private glyphs: Glyphs,
    w: number,
    h: number,
  ) {
    this.w = w
    this.h = h
    this.bg = new Sprite(frameTexture('empty', w, h))
    this.label = glyphs.makeLabel()
    this.label.root.y = Math.round((h - 12) / 2)
    this.root.addChild(this.bg, this.label.root)
  }

  set(text: string, hot: boolean): void {
    if (text === this.text && hot === this.hot) {
      return
    }
    this.text = text
    this.hot = hot
    this.bg.texture = frameTexture(hot ? 'player' : 'empty', this.w, this.h)
    this.label.set(text, this.w - 8, hot ? 1 : 0.72)
    this.label.root.x = Math.max(4, Math.round((this.w - this.glyphs.measure(text)) / 2))
  }
}
