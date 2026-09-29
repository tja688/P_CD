import { Container, RenderTexture, Sprite, type Renderer } from 'pixi.js'
import type { Synth } from '../audio/synth'
import type { Kernel } from '../kernel/client'
import { SplitMix64 } from '../kernel/rng'
import type { Advance, Catalog, Decision, GameEvent, Option, View } from '../kernel/types'
import { phaseName, reasonName, sourceName, winnerName } from '../play/labels'
import { Director } from '../play/director'
import { reconcile } from '../play/reconcile'
import { applyEvent, emptyShown, shownFromView, type Effect, type Shown, type ShownCard } from '../play/shown'
import { frameTexture } from '../render/bake'
import { createCrtFilter, createPersistFilter, setCrtTime, setPersistSource } from '../render/crt'
import { Digits } from '../render/digits'
import { Glyphs, gray, type Label } from '../render/glyphs'
import { ButtonFace, CardFace } from './widgets'

const W = 640
const H = 360
const BOARD_X = 124
const BOARD_Y = 22
const CELL_W = 86
const CELL_H = 68
const GAP = 5
const HAND_Y = 244
const HAND_W = 78
const HAND_H = 88
const SIDE_X = 400
const HAND_MAX_X = 392

type Mode = 'boot' | 'wake' | 'menu' | 'match' | 'result'
type Arm =
  | { kind: 'none' }
  | { kind: 'play'; instance: number; cell: number | null }
  | { kind: 'cast'; instance: number }
  | { kind: 'card'; instance: number }
  | { kind: 'activate'; id: string }
  | { kind: 'end' }

type Hit = { x: number; y: number; w: number; h: number; id: string }
type Motion = { instance: number; x: number; y: number; tx: number; ty: number; t: number; dur: number }
type Floater = { root: Container; x: number; y: number; age: number; life: number }
type Mark = { snapshot: string; rng: bigint; pending: Decision | null; view: View }

export type DebugRead = {
  mode: Mode
  kernel: string
  idle: boolean
  speed: number
  pending: Decision | null
  view: View | null
  shown: Shown | null
  hits: Hit[]
  mismatches: string[]
  arm: string
  log: string[]
}

export class Terminal {
  readonly screen: Sprite
  readonly world = new Container()
  private boot = new Container()
  private menu = new Container()
  private match = new Container()
  private result = new Container()
  private floats = new Container()
  private scene: RenderTexture
  private front: RenderTexture
  private back: RenderTexture
  private persistSprite: Sprite
  private persistFilter
  private crt
  private director = new Director()
  private mode: Mode = 'boot'
  private time = 0
  private catalog: Catalog | null = null
  private shown: Shown = emptyShown()
  private view: View | null = null
  private pending: Decision | null = null
  private snapshot = ''
  private rng = new SplitMix64(1n)
  private arm: Arm = { kind: 'none' }
  private hits: Hit[] = []
  private hover = ''
  private motions: Motion[] = []
  private floaters: Floater[] = []
  private faces = new Map<number, CardFace>()
  private cellFrames: Sprite[] = []
  private intentFace: CardFace
  private log: string[] = []
  private mismatches: string[] = []
  private reported = ''
  private deckId = ''
  private monsterId = ''
  private seed = 7
  private cursor = 0
  private speed = 1
  private inflight = false
  private think = 0
  private yaml: string | null = null
  private saved = false
  private banner = ''
  private bannerAge = 0
  private inspect = ''
  private header = new Container()
  private side = new Container()
  private notes = new Container()
  private handRow = new Container()
  private handHint: Label
  private cellMarks: Digits[] = []
  private title = ''
  private subtitle = ''
  private bootLabel
  private standby: Sprite
  private scale = 1
  private originX = 0
  private originY = 0
  private kernelMode = ''
  private answers = 0
  private history: Mark[] = []
  private endButton: ButtonFace
  private okButton: ButtonFace
  private noButton: ButtonFace
  private againButton: ButtonFace

  constructor(
    private glyphs: Glyphs,
    private synth: Synth,
    private kernel: Kernel,
    renderer: Renderer,
  ) {
    this.kernelMode = kernel.mode
    this.scene = RenderTexture.create({ width: W, height: H })
    this.front = RenderTexture.create({ width: W, height: H })
    this.back = RenderTexture.create({ width: W, height: H })
    for (const rt of [this.scene, this.front, this.back]) {
      rt.source.scaleMode = 'nearest'
    }
    this.persistFilter = createPersistFilter(this.front)
    this.crt = createCrtFilter()
    this.persistSprite = new Sprite(this.scene)
    this.persistSprite.filters = [this.persistFilter]
    this.screen = new Sprite(this.front)
    this.screen.filters = [this.crt]
    this.screen.texture.source.scaleMode = 'nearest'
    this.intentFace = new CardFace(glyphs, 108, 132)
    this.endButton = new ButtonFace(glyphs, 108, 22)
    this.okButton = new ButtonFace(glyphs, 72, 22)
    this.noButton = new ButtonFace(glyphs, 72, 22)
    this.againButton = new ButtonFace(glyphs, 120, 24)
    this.bootLabel = glyphs.makeLabel()
    this.standby = new Sprite(frameTexture('player', 4, 4))
    this.handHint = glyphs.makeLabel()
    this.world.addChild(this.boot, this.menu, this.match, this.result)
    this.side.addChild(this.notes, this.endButton.root, this.okButton.root, this.noButton.root)
    this.match.addChild(this.header, this.side, this.handRow, this.floats)
    this.boot.addChild(this.bootLabel.root, this.standby)
    this.layoutBoot()
    for (let i = 0; i < 9; i++) {
      const frame = new Sprite(frameTexture('empty', CELL_W, CELL_H))
      const pos = cellOrigin(i + 1)
      frame.x = pos.x
      frame.y = pos.y
      this.cellFrames.push(frame)
      this.match.addChildAt(frame, 0)
      const mark = new Digits()
      mark.set(String(i + 1), 2, 0.34)
      mark.root.position.set(pos.x + CELL_W - 16, pos.y + CELL_H - 18)
      this.cellMarks.push(mark)
      this.match.addChild(mark.root)
    }
    this.intentFace.root.x = 8
    this.intentFace.root.y = 36
    this.match.addChild(this.intentFace.root)
    this.resize(renderer.width / renderer.resolution, renderer.height / renderer.resolution)
    void renderer.render({ container: this.world, target: this.scene, clear: true })
  }

  resize(cssW: number, cssH: number): void {
    this.scale = Math.max(1, Math.floor(Math.min(cssW / W, cssH / H)))
    this.screen.scale.set(this.scale)
    this.originX = Math.floor((cssW - W * this.scale) / 2)
    this.originY = Math.floor((cssH - H * this.scale) / 2)
    this.screen.x = this.originX
    this.screen.y = this.originY
  }

  worldPoint(cssX: number, cssY: number): { x: number; y: number } {
    return {
      x: (cssX - this.originX) / this.scale,
      y: (cssY - this.originY) / this.scale,
    }
  }

  forceInstant(): void {
    this.director.instant = true
    this.speed = 4
  }

  read(): DebugRead {
    return {
      mode: this.mode,
      kernel: this.kernelMode,
      idle: this.director.idle && !this.inflight,
      speed: this.speed,
      pending: this.pending,
      view: this.view,
      shown: this.shown,
      hits: this.hits.map((hit) => ({ ...hit })),
      mismatches: this.mismatches.slice(),
      arm: this.arm.kind,
      log: this.log.slice(),
    }
  }

  async bootKernel(): Promise<void> {
    const catalog = (await this.kernel.invoke({ command: 'catalog', content: 'rules' })) as Catalog
    this.catalog = catalog
    this.deckId = catalog.decks[0]?.id ?? ''
    this.monsterId = catalog.monsters[0]?.id ?? ''
    this.paintMenu()
  }

  update(dt: number, renderer: Renderer): void {
    this.time += dt
    setCrtTime(this.crt, this.time / 1000)
    this.director.update(dt)
    this.advanceMotions(dt)
    this.advanceFloats(dt)
    if (this.mode === 'boot') {
      this.standby.alpha = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(this.time / 280))
      this.standby.x = W - 16
      this.standby.y = H - 14
    }
    if (this.banner && this.arm.kind === 'none' && this.director.idle && !this.inflight) {
      this.bannerAge += dt
      if (this.bannerAge > 1600) {
        this.banner = ''
      }
    }
    if (this.mode === 'match' || this.mode === 'result') {
      this.paintMatch()
      this.maybeMonster(dt)
      this.maybeReconcile()
      if (this.mode === 'match' && this.view?.winner && this.director.idle) {
        this.mode = 'result'
        this.paintResult()
        void this.archive()
      }
    }
    if (this.mode === 'menu') {
      this.pulseMenu()
    }
    renderer.render({ container: this.world, target: this.scene, clear: true })
    setPersistSource(this.persistFilter, this.front)
    renderer.render({ container: this.persistSprite, target: this.back, clear: true })
    const swap = this.front
    this.front = this.back
    this.back = swap
    this.screen.texture = this.front
    this.publish()
  }

  pointer(x: number, y: number, down: boolean): void {
    if (this.mode === 'boot' && down) {
      this.powerOn()
      return
    }
    if (x < 0 || y < 0 || x >= W || y >= H) {
      this.hover = ''
      return
    }
    const hit = [...this.hits].reverse().find((item) => x >= item.x && y >= item.y && x < item.x + item.w && y < item.y + item.h)
    this.hover = hit?.id ?? ''
    if (!down || !hit) {
      return
    }
    this.activate(hit.id)
  }

  key(code: string): void {
    if (this.mode === 'boot') {
      this.powerOn()
      return
    }
    if (code === 'KeyF') {
      this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 4 : 1
      this.director.speed = this.speed
      this.synth.play('tick')
      return
    }
    if (code === 'Tab') {
      this.director.skip()
      return
    }
    if (code === 'KeyM') {
      this.synth.muted = !this.synth.muted
      return
    }
    if (this.mode === 'menu') {
      this.menuKey(code)
      return
    }
    if (this.mode === 'result') {
      if (code === 'Enter' || code === 'Escape') {
        this.toMenu()
      }
      return
    }
    if (this.mode !== 'match' || !this.director.idle || this.inflight) {
      return
    }
    if (code === 'Escape') {
      this.arm = { kind: 'none' }
      this.synth.play('cancel')
      return
    }
    if (code === 'KeyU' || code === 'Backspace') {
      void this.undo()
      return
    }
    if (code === 'KeyE') {
      this.armEnd()
      return
    }
    if (code === 'Enter') {
      this.confirmArm()
      return
    }
    if (code.startsWith('Digit')) {
      const cell = Number(code.slice(5))
      if (cell >= 1 && cell <= 9) {
        this.pickCell(cell)
      }
      return
    }
    if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown') {
      this.cycleHand(code === 'ArrowLeft' || code === 'ArrowUp' ? -1 : 1)
    }
  }

  private powerOn(): void {
    if (this.mode !== 'boot') {
      return
    }
    this.synth.resume()
    this.synth.play('power')
    this.mode = 'wake'
    this.boot.visible = true
    this.menu.visible = false
    const title = 'THE CALL'
    this.director.push({
      ms: 280,
      run: () => {
        this.bootLabel.set('', 0, 1)
      },
    })
    for (let i = 1; i <= title.length; i++) {
      const text = title.slice(0, i)
      this.director.push({
        ms: 70,
        sfx: 'tick',
        run: () => {
          this.bootLabel.set(text, 0, 1)
          this.bootLabel.root.x = Math.round((W - this.glyphs.measure(text)) / 2)
          this.bootLabel.root.y = 150
          this.synth.play('tick')
        },
      })
    }
    this.director.push({
      ms: 520,
      run: () => {
        this.mode = 'menu'
        this.boot.visible = false
        this.menu.visible = true
        this.paintMenu()
      },
    })
  }

  private layoutBoot(): void {
    this.bootLabel.set('按下任意键', 0, 0.8)
    this.bootLabel.root.x = Math.round((W - this.glyphs.measure('按下任意键')) / 2)
    this.bootLabel.root.y = 156
    const sub = this.glyphs.makeLabel()
    sub.set('接通磷光', 0, 0.4)
    sub.root.x = Math.round((W - this.glyphs.measure('接通磷光')) / 2)
    sub.root.y = 178
    this.boot.addChild(sub.root)
    this.menu.visible = false
    this.match.visible = false
    this.result.visible = false
  }

  private menuKey(code: string): void {
    const items = this.menuItems()
    if (code === 'ArrowDown') {
      this.cursor = (this.cursor + 1) % items.length
      this.synth.play('move')
      this.paintMenu()
    } else if (code === 'ArrowUp') {
      this.cursor = (this.cursor + items.length - 1) % items.length
      this.synth.play('move')
      this.paintMenu()
    } else if (code === 'ArrowLeft') {
      this.seed = Math.max(1, this.seed - 1)
      this.synth.play('tick')
      this.paintMenu()
    } else if (code === 'ArrowRight') {
      this.seed = Math.min(9999, this.seed + 1)
      this.synth.play('tick')
      this.paintMenu()
    } else if (code === 'Enter') {
      this.activate(items[this.cursor]?.id ?? 'start')
    } else if (code === 'KeyH') {
      void this.reloadContent()
    }
  }

  private menuItems(): { id: string; label: string }[] {
    const catalog = this.catalog
    if (!catalog) {
      return []
    }
    return [
      ...catalog.decks.map((deck) => ({ id: `deck:${deck.id}`, label: deck.name })),
      ...catalog.monsters.map((monster) => ({ id: `monster:${monster.id}`, label: monster.name })),
      { id: 'start', label: '开打' },
    ]
  }

  private paintMenu(): void {
    const catalog = this.catalog
    if (!catalog) {
      return
    }
    this.menu.removeChildren().forEach((child) => child.destroy({ children: true }))
    this.hits = []
    const title = this.glyphs.makeLabel()
    title.set('THE CALL', 0, 1)
    title.root.x = 28
    title.root.y = 28
    const sub = this.glyphs.makeLabel()
    sub.set('九宫格上，先看意图，再比点数', 0, 0.48)
    sub.root.x = 28
    sub.root.y = 48
    this.menu.addChild(title.root, sub.root)
    const headDeck = this.glyphs.makeLabel()
    headDeck.set('牌组', 0, 0.55)
    headDeck.root.position.set(28, 84)
    const headMonster = this.glyphs.makeLabel()
    headMonster.set('怪物', 0, 0.55)
    headMonster.root.position.set(330, 84)
    this.menu.addChild(headDeck.root, headMonster.root)
    const focus = this.menuItems()[this.cursor]?.id ?? ''
    catalog.decks.forEach((deck, index) => {
      const id = `deck:${deck.id}`
      this.menuRow(id, 28, 108 + index * 36, 250, 28, this.deckLine(deck), this.deckId === deck.id, focus === id)
    })
    catalog.monsters.forEach((monster, index) => {
      const id = `monster:${monster.id}`
      this.menuRow(id, 330, 108 + index * 56, 280, 48, this.monsterLine(monster), this.monsterId === monster.id, focus === id)
    })
    const seedLabel = this.glyphs.makeLabel()
    seedLabel.set(`种子 ${String(this.seed).padStart(4, '0')}    ← →`, 0, 0.6)
    seedLabel.root.position.set(28, 300)
    this.menu.addChild(seedLabel.root)
    this.menuRow('start', 470, 292, 120, 28, '开打', focus === 'start', focus === 'start')
    const hint = this.glyphs.makeLabel()
    hint.set('↑↓选择   Enter确认   H重读内容', 0, 0.38)
    hint.root.position.set(28, 332)
    this.menu.addChild(hint.root)
    this.menu.visible = this.mode === 'menu'
  }

  private menuRow(id: string, x: number, y: number, w: number, h: number, text: string, selected: boolean, focused: boolean): void {
    const bg = new Sprite(frameTexture(focused || selected ? 'player' : 'empty', w, h))
    bg.x = x
    bg.y = y
    bg.alpha = focused ? 1 : selected ? 0.78 : 0.55
    const label = this.glyphs.makeLabel()
    const body = focused ? text.replace(/^/, '▸') : text
    label.set(body, w - 12, focused ? 1 : selected ? 0.88 : 0.58)
    label.root.x = x + 6
    label.root.y = y + 6
    this.menu.addChild(bg, label.root)
    this.hits.push({ x, y, w, h, id })
  }

  private pulseMenu(): void {
    const items = this.menuItems()
    const current = items[this.cursor]
    if (!current) {
      return
    }
  }

  private deckLine(deck: Catalog['decks'][number]): string {
    const load = deck.cards.reduce((sum, id) => sum + (this.card(id)?.load ?? 0), 0)
    return `${deck.name}  负荷${load}`
  }

  private monsterLine(monster: Catalog['monsters'][number]): string {
    const intents = monster.intents.map((id) => this.card(id)?.name ?? id).join(' · ')
    return `${monster.name}\n${intents}`
  }

  private activate(id: string): void {
    this.synth.resume()
    if (this.mode === 'boot') {
      this.powerOn()
      return
    }
    if (id.startsWith('deck:')) {
      this.deckId = id.slice(5)
      this.cursor = this.menuItems().findIndex((item) => item.id === id)
      this.synth.play('arm')
      this.paintMenu()
      return
    }
    if (id.startsWith('monster:')) {
      this.monsterId = id.slice(8)
      this.cursor = this.menuItems().findIndex((item) => item.id === id)
      this.synth.play('arm')
      this.paintMenu()
      return
    }
    if (id === 'start' && this.mode === 'menu') {
      void this.beginMatch()
      return
    }
    if (id === 'again') {
      this.toMenu()
      return
    }
    if (this.mode !== 'match' || !this.director.idle || this.inflight) {
      return
    }
    if (id === 'confirm') {
      this.confirmArm()
      return
    }
    if (id === 'cancel') {
      this.arm = { kind: 'none' }
      this.synth.play('cancel')
      return
    }
    if (id === 'end-turn') {
      this.armEnd()
      return
    }
    if (id.startsWith('hand:')) {
      this.armCard(Number(id.slice(5)))
      return
    }
    if (id.startsWith('cell:')) {
      this.pickCell(Number(id.slice(5)))
      return
    }
    if (id.startsWith('board:')) {
      const instance = Number(id.slice(6))
      const cell = this.shown.cells.findIndex((card) => card?.instance === instance) + 1
      if (this.arm.kind === 'play' && cell > 0 && this.legalCell(cell)) {
        this.pickCell(cell)
        return
      }
      this.armInstance(instance)
    }
  }

  private async beginMatch(): Promise<void> {
    const catalog = this.catalog
    const deck = catalog?.decks.find((item) => item.id === this.deckId)
    if (!catalog || !deck) {
      return
    }
    this.synth.play('confirm')
    this.inflight = true
    try {
      const advance = (await this.kernel.invoke({
        command: 'start',
        ...this.contentBody(),
        monster: this.monsterId,
        buildDeck: deck.cards,
        seed: this.seed,
      })) as Advance
      this.snapshot = advance.snapshot
      this.pending = advance.pending
      this.rng = new SplitMix64(BigInt(this.seed))
      this.history = []
      this.answers = 0
      this.saved = false
      this.arm = { kind: 'none' }
      this.shown = emptyShown()
      this.shown.deck = deck.cards.length
      this.mode = 'match'
      this.boot.visible = false
      this.menu.visible = false
      this.match.visible = true
      this.result.visible = false
      this.enqueue(advance.events)
      this.view = (await this.kernel.invoke({
        command: 'view',
        ...this.contentBody(),
        audience: 'player',
        snapshot: this.snapshot,
      })) as View
    } catch (error) {
      this.say(error instanceof Error ? error.message : '无法开局')
      this.synth.play('cancel')
    } finally {
      this.inflight = false
    }
  }

  private async commit(option: Option): Promise<void> {
    if (!this.pending || this.inflight || !this.director.idle) {
      return
    }
    if (this.pending.actor === 'player' && this.view) {
      this.history.push({
        snapshot: this.snapshot,
        rng: this.rng.word,
        pending: this.pending,
        view: this.view,
      })
    }
    this.inflight = true
    this.arm = { kind: 'none' }
    this.synth.play('confirm')
    try {
      const advance = (await this.kernel.invoke({
        command: 'answer',
        ...this.contentBody(),
        snapshot: this.snapshot,
        option: option.id,
      })) as Advance
      this.snapshot = advance.snapshot
      this.pending = advance.pending
      this.answers += 1
      this.enqueue(advance.events)
      this.view = (await this.kernel.invoke({
        command: 'view',
        ...this.contentBody(),
        audience: 'player',
        snapshot: this.snapshot,
      })) as View
    } catch (error) {
      this.say(error instanceof Error ? error.message : '这一步没有成立')
      if (this.pending?.actor === 'player') {
        this.history.pop()
      }
      this.synth.play('cancel')
    } finally {
      this.inflight = false
    }
  }

  private async undo(): Promise<void> {
    if (this.history.length === 0 || this.inflight) {
      this.synth.play('cancel')
      return
    }
    const mark = this.history.pop()
    if (!mark) {
      return
    }
    this.director.clear()
    this.motions = []
    this.floaters.forEach((floater) => floater.root.destroy({ children: true }))
    this.floaters = []
    this.snapshot = mark.snapshot
    this.pending = mark.pending
    this.view = mark.view
    this.rng = new SplitMix64(mark.rng)
    this.shown = shownFromView(mark.view)
    this.arm = { kind: 'none' }
    this.mode = 'match'
    this.result.visible = false
    this.synth.play('undo')
    this.pushLog('悔棋')
  }

  private async archive(): Promise<void> {
    if (this.saved || !this.snapshot) {
      return
    }
    this.saved = true
    try {
      const exported = (await this.kernel.invoke({
        command: 'export',
        ...this.contentBody(),
        snapshot: this.snapshot,
      })) as { replay: string }
      const raw = localStorage.getItem('pcd.replays')
      const list = raw ? (JSON.parse(raw) as unknown[]) : []
      list.unshift({ at: Date.now(), winner: this.view?.winner ?? '', replay: exported.replay })
      localStorage.setItem('pcd.replays', JSON.stringify(list.slice(0, 20)))
    } catch (error) {
      console.info('[pcd] 录像没有写下', error)
    }
  }

  private async reloadContent(): Promise<void> {
    const text = await fetch('/rules/catalog.yaml', { cache: 'no-store' }).then((res) => res.text())
    this.yaml = text
    this.catalog = (await this.kernel.invoke({ command: 'catalog', yaml: text })) as Catalog
    this.paintMenu()
    this.synth.play('tick')
    this.pushLog('内容已重读')
  }

  private enqueue(events: GameEvent[]): void {
    for (const event of events) {
      this.director.push({
        ms: beatMs(event),
        run: () => {
          const from = this.anchor(event.instance)
          const effect = applyEvent(this.shown, event, this.catalog!)
          this.react(effect, from)
          if (event.type !== 'points-changed' && event.type !== 'status-changed' && event.type !== 'timer-changed') {
            const line = caption(event, this.catalog!)
            if (line) {
              this.pushLog(line)
            }
          }
        },
      })
    }
  }

  private react(effect: Effect, from: { x: number; y: number } | null): void {
    if (effect.kind === 'travel') {
      const target = effect.cell >= 1 ? cellOrigin(effect.cell) : { x: 520, y: 300 }
      const start = from ?? (effect.from === 'intent' ? { x: 8, y: 36 } : { x: 300, y: HAND_Y })
      this.motions = this.motions.filter((motion) => motion.instance !== effect.instance)
      this.motions.push({
        instance: effect.instance,
        x: start.x,
        y: start.y,
        tx: target.x,
        ty: target.y,
        t: 0,
        dur: 180,
      })
      this.synth.play(effect.from === 'intent' ? 'intent' : 'play')
    } else if (effect.kind === 'float') {
      const pos = effect.cell >= 1 ? cellOrigin(effect.cell) : from ?? { x: 400, y: 80 }
      this.spawnFloat(pos.x + 8, pos.y + 8, effect.text, effect.up)
      if (effect.source) {
        this.spawnNote(pos.x + 8, pos.y + 28, sourceName(effect.source))
      }
      if (!effect.quiet) {
        this.synth.play(effect.up ? 'up' : 'down')
      }
    } else if (effect.kind === 'gone') {
      this.synth.play('remove')
    } else if (effect.kind === 'draw') {
      this.synth.play('draw')
    } else if (effect.kind === 'intent') {
      this.synth.play('intent')
    } else if (effect.kind === 'pollute') {
      this.synth.play('pollute')
    } else if (effect.kind === 'banner') {
      this.say(effect.text)
      this.synth.play(effect.sfx)
    } else if (effect.kind === 'end') {
      this.synth.play(effect.winner === 'player' ? 'win' : 'lose')
    }
  }

  private maybeMonster(dt: number): void {
    if (this.mode !== 'match' || !this.director.idle || this.inflight || !this.pending) {
      this.think = 0
      return
    }
    if (this.pending.actor === 'player') {
      this.think = 0
      return
    }
    this.think += dt
    const wait = this.director.instant ? 0 : 460 / this.speed
    if (this.think < wait) {
      this.say('怪物落子')
      return
    }
    const option = this.pending.options[this.rng.nextInt(this.pending.options.length)]
    if (option) {
      this.think = 0
      void this.commit(option)
    }
  }

  private maybeReconcile(): void {
    const resting = !!this.view && this.director.idle && !this.inflight
    const playerTurn = this.mode === 'match' && this.pending?.actor === 'player'
    if (!resting || (!playerTurn && this.mode !== 'result')) {
      return
    }
    const view = this.view
    if (!view) {
      return
    }
    const issues = reconcile(this.shown, view)
    const key = `${this.pending?.id ?? 'end'}:${issues.join('|')}`
    if (key === this.reported) {
      return
    }
    this.reported = key
    this.mismatches = issues
    if (issues.length > 0) {
      console.info('[pcd] 核对', issues.join('；'))
    }
  }

  private paintMatch(): void {
    const catalog = this.catalog
    if (!catalog) {
      return
    }
    this.hits = []
    this.paintHeader()
    this.paintCells()
    this.paintCards()
    this.paintIntent()
    this.paintSide()
    this.paintHand()
    this.floats.removeChildren()
    for (const floater of this.floaters) {
      floater.root.x = Math.round(floater.x)
      floater.root.y = Math.round(floater.y)
      this.floats.addChild(floater.root)
    }
  }

  private paintHeader(): void {
    this.header.removeChildren().forEach((child) => child.destroy({ children: true }))
    const left = this.glyphs.makeLabel()
    left.set('THE CALL', 0, 0.85)
    left.root.position.set(8, 4)
    const phase = this.glyphs.makeLabel()
    const phaseText = this.banner || phaseName(this.view?.phase ?? '')
    phase.set(`第${this.shown.round}回合  ${phaseText}`, 0, 0.7)
    phase.root.position.set(160, 4)
    const right = this.glyphs.makeLabel()
    right.set(`×${this.speed}`, 0, 0.45)
    right.root.x = W - 28
    right.root.y = 4
    this.header.addChild(left.root, phase.root, right.root)
  }

  private paintCells(): void {
    this.shown.polluted.forEach((polluted, index) => {
      const frame = this.cellFrames[index]!
      const cell = index + 1
      const occupied = this.shown.cells[index] != null
      frame.texture = frameTexture(polluted && !occupied ? 'polluted' : 'empty', CELL_W, CELL_H)
      frame.visible = !occupied
      const mark = this.cellMarks[index]
      if (mark) {
        mark.root.visible = !occupied
      }
      const legal = this.legalCell(cell)
      if (!occupied) {
        this.hits.push({ ...cellOrigin(cell), w: CELL_W, h: CELL_H, id: `cell:${cell}` })
      }
      frame.alpha = legal ? 0.75 + 0.25 * Math.sin(this.time / 180) : 1
    })
  }

  private paintCards(): void {
    const seen = new Set<number>()
    const place = (card: ShownCard, x: number, y: number, w: number, h: number, hit: string | null, cell = 0) => {
      seen.add(card.instance)
      const face = this.face(card.instance, w, h)
      const motion = this.motions.find((item) => item.instance === card.instance)
      face.root.x = motion ? Math.round(motion.x) : x
      face.root.y = motion ? Math.round(motion.y) : y
      face.show({
        kind: card.owner === 'monster' ? 'monster' : 'player',
        title: this.card(card.card)?.name ?? card.card,
        sub: this.statusLine(card),
        points: card.spell ? '' : String(card.points),
        bright: card.owner === 'monster' ? 0.78 : 1,
        hot: this.cardHot(card.instance) || (cell > 0 && this.legalCell(cell)),
        legal: this.cardLegal(card.instance),
      })
      if (hit && !motion) {
        this.hits.push({ x, y, w, h, id: hit })
      }
      if (!face.root.parent) {
        this.match.addChild(face.root)
      }
    }
    this.shown.cells.forEach((card, index) => {
      if (!card) {
        return
      }
      const pos = cellOrigin(index + 1)
      place(card, pos.x, pos.y, CELL_W, CELL_H, `board:${card.instance}`, index + 1)
    })
    this.shown.air.forEach((card) => {
      const motion = this.motions.find((item) => item.instance === card.instance)
      place(card, motion?.x ?? 8, motion?.y ?? 36, CELL_W, CELL_H, null)
    })
    for (const [instance, face] of this.faces) {
      if (!seen.has(instance) && !this.shown.hand.some((card) => card.instance === instance)) {
        face.root.removeFromParent()
        this.faces.delete(instance)
      }
    }
  }

  private paintHand(): void {
    this.handRow.removeChildren()
    const cards = this.shown.hand
    const count = Math.max(1, cards.length)
    const span = HAND_MAX_X - 8
    const step = Math.min(HAND_W + 4, Math.floor(span / count))
    const total = step * cards.length
    const origin = Math.round((W - total) / 2)
    if (cards.length === 0) {
      const empty = this.glyphs.makeLabel()
      empty.set('手牌空', 0, 0.4)
      empty.root.position.set(28, HAND_Y + 30)
      this.handRow.addChild(empty.root)
    }
    cards.forEach((card, index) => {
      const raised = this.armMentions(card.instance) || this.hover === `hand:${card.instance}`
      const x = origin + index * step
      const y = HAND_Y - (raised ? 10 : 0)
      const face = this.face(card.instance, HAND_W, HAND_H)
      face.root.x = x
      face.root.y = y
      face.show({
        kind: 'player',
        title: this.card(card.card)?.name ?? card.card,
        sub: card.spell ? '法术' : this.statusLine(card),
        points: card.spell ? '' : String(card.points),
        bright: 1,
        hot: this.cardHot(card.instance),
        legal: this.cardLegal(card.instance),
      })
      this.handRow.addChild(face.root)
      this.hits.push({ x, y, w: Math.min(HAND_W, step), h: HAND_H, id: `hand:${card.instance}` })
    })
    this.handHint.set('选牌  确认  Esc取消  E结束  U悔棋  F加速  Tab跳过', 0, 0.4)
    this.handHint.root.position.set(8, 344)
    this.handRow.addChild(this.handHint.root)
  }

  private paintIntent(): void {
    const id = this.shown.intent
    const def = id ? this.card(id) : undefined
    this.intentFace.root.visible = !!def
    if (!def) {
      return
    }
    this.intentFace.show({
      kind: 'monster',
      title: def.name,
      sub: def.spell ? '法术' : '',
      points: def.spell ? '' : String(def.points),
      bright: 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(this.time / 420)),
      hot: false,
      legal: false,
    })
  }

  private paintSide(): void {
    this.notes.removeChildren().forEach((child) => child.destroy({ children: true }))
    const label = (text: string, x: number, y: number, bright = 0.65) => {
      const line = this.glyphs.makeLabel()
      line.set(text, 228, bright)
      line.root.position.set(x, y)
      this.notes.addChild(line.root)
      return line
    }
    label('玩家', SIDE_X, 22, 0.5)
    label('怪物', 520, 22, 0.5)
    const player = new Digits()
    player.set(String(this.shown.playerPoints), 3, 1)
    player.root.position.set(SIDE_X, 38)
    const monster = new Digits()
    monster.set(String(this.shown.monsterPoints), 3, 0.7)
    monster.root.position.set(520, 38)
    this.notes.addChild(player.root, monster.root)
    label(`占格 ${this.shown.playerOccupancy} / ${this.shown.monsterOccupancy}`, SIDE_X, 66, 0.55)
    label(`牌组 ${this.shown.deck}  弃牌 ${this.shown.playerDiscard}`, SIDE_X, 82, 0.55)
    let statY = 98
    if (this.shown.playerVoid + this.shown.monsterVoid > 0) {
      label(`消散 ${this.shown.playerVoid + this.shown.monsterVoid}`, SIDE_X, statY, 0.45)
      statY += 16
    }
    const faith = this.shown.pools.find((pool) => pool.owner === 'player' && pool.id === 'resource.faith')
    if (faith) {
      label(`信仰 ${faith.amount}`, SIDE_X, statY, 0.85)
      statY += 16
    }
    if (this.view?.phase === 'player-action') {
      label(`出牌机会 ${this.view.remainingOpportunities}`, SIDE_X, statY, 0.7)
      statY += 16
    }
    const looked = this.inspectCard()
    if (looked) {
      label(looked.name, SIDE_X, statY + 6, 1)
      label(clipText(looked.text || (looked.spell ? '法术' : '无效果'), 64), SIDE_X, statY + 22, 0.62)
    }
    this.log.slice(-2).forEach((line, index) => label(line, SIDE_X, 312 + index * 14, 0.38))
    const ready = this.armReady()
    this.okButton.set('确认', ready)
    this.okButton.root.position.set(SIDE_X, 276)
    this.okButton.root.visible = ready
    this.noButton.set('取消', this.arm.kind !== 'none')
    this.noButton.root.position.set(478, 276)
    this.noButton.root.visible = this.arm.kind !== 'none'
    this.endButton.set(this.arm.kind === 'end' ? '确认结束' : '结束回合', this.arm.kind === 'end')
    this.endButton.root.position.set(SIDE_X, 248)
    const canEnd = !!this.pending?.options.some((option) => option.kind === 'end-turn')
    this.endButton.root.visible = canEnd && this.pending?.actor === 'player'
    if (ready) {
      this.hits.push({ x: SIDE_X, y: 276, w: 72, h: 22, id: 'confirm' })
    }
    if (this.arm.kind !== 'none') {
      this.hits.push({ x: 478, y: 276, w: 72, h: 22, id: 'cancel' })
    }
    if (canEnd && this.pending?.actor === 'player') {
      this.hits.push({ x: SIDE_X, y: 248, w: 108, h: 22, id: 'end-turn' })
    }
  }

  private paintResult(): void {
    this.result.removeChildren()
    this.result.visible = true
    const dim = new Sprite(frameTexture('empty', W, 80))
    dim.y = 120
    dim.alpha = 0.82
    const title = this.glyphs.makeLabel()
    const name = winnerName(this.view?.winner)
    title.set(name, 0, 1)
    title.root.position.set(Math.round((W - this.glyphs.measure(name)) / 2), 132)
    const why = this.glyphs.makeLabel()
    const reason = `${reasonName(this.view?.reason)}  ${this.shown.playerPoints} : ${this.shown.monsterPoints}`
    why.set(reason, 0, 0.65)
    why.root.position.set(Math.round((W - this.glyphs.measure(reason)) / 2), 154)
    this.againButton.set('返回', true)
    this.againButton.root.position.set(260, 176)
    this.result.addChild(dim, title.root, why.root, this.againButton.root)
    this.hits.push({ x: 260, y: 176, w: 120, h: 24, id: 'again' })
  }

  private inspectCard(): { name: string; text: string; spell: boolean } | null {
    const catalog = this.catalog
    if (!catalog) {
      return null
    }
    const hovered = this.cardByHit(this.hover)
    const armed = this.armInstanceId()
    const id = hovered?.card ?? (armed != null ? this.findCard(armed)?.card : this.shown.intent)
    const def = id ? this.card(id) : undefined
    if (!def) {
      return null
    }
    return { name: def.name, text: def.text, spell: def.spell }
  }

  private cardByHit(id: string): ShownCard | null {
    if (id.startsWith('hand:') || id.startsWith('board:')) {
      return this.findCard(Number(id.split(':')[1])) ?? null
    }
    if (id.startsWith('cell:')) {
      return this.shown.cells[Number(id.slice(5)) - 1] ?? null
    }
    return null
  }

  private armCard(instance: number): void {
    const options = this.pending?.options ?? []
    const plays = options.filter((option) => option.kind === 'play' && option.instance === instance)
    const cast = options.find((option) => option.kind === 'cast' && option.instance === instance)
    const choose = options.find((option) => option.kind === 'card' && option.instance === instance)
    if (plays.length > 0) {
      this.arm = { kind: 'play', instance, cell: plays.length === 1 ? plays[0]!.cell : null }
      this.synth.play('arm')
      if (plays.length === 1) {
        this.say(`格${plays[0]!.cell}  再确认`)
      }
      return
    }
    if (cast) {
      this.arm = { kind: 'cast', instance }
      this.synth.play('arm')
      this.say('确认打出法术')
      return
    }
    if (choose) {
      this.arm = { kind: 'card', instance }
      this.synth.play('arm')
      this.say('确认选择')
    }
  }

  private armInstance(instance: number): void {
    const choose = this.pending?.options.find((option) => option.kind === 'card' && option.instance === instance)
    const activate = this.pending?.options.find((option) => option.kind === 'activate' && option.instance === instance)
    if (choose) {
      this.arm = { kind: 'card', instance }
      this.synth.play('arm')
      return
    }
    if (activate) {
      this.arm = { kind: 'activate', id: activate.id }
      this.synth.play('arm')
    }
  }

  private pickCell(cell: number): void {
    if (this.arm.kind !== 'play') {
      return
    }
    const instance = this.arm.instance
    const match = this.pending?.options.find((item) => item.kind === 'play' && item.instance === instance && item.cell === cell)
    if (!match) {
      this.synth.play('cancel')
      return
    }
    if (this.arm.cell === cell) {
      void this.commit(match)
      return
    }
    this.arm = { kind: 'play', instance, cell }
    this.synth.play('arm')
    this.say(`格${cell}`)
  }

  private armEnd(): void {
    if (!this.pending?.options.some((option) => option.kind === 'end-turn')) {
      return
    }
    if (this.arm.kind === 'end') {
      this.confirmArm()
      return
    }
    this.arm = { kind: 'end' }
    this.synth.play('arm')
    this.say('确认结束回合')
  }

  private confirmArm(): void {
    const option = this.armedOption()
    if (!option) {
      this.synth.play('cancel')
      return
    }
    void this.commit(option)
  }

  private armedOption(): Option | null {
    const options = this.pending?.options ?? []
    const arm = this.arm
    if (arm.kind === 'play' && arm.cell != null) {
      return options.find((option) => option.kind === 'play' && option.instance === arm.instance && option.cell === arm.cell) ?? null
    }
    if (arm.kind === 'cast') {
      return options.find((option) => option.kind === 'cast' && option.instance === arm.instance) ?? null
    }
    if (arm.kind === 'card') {
      return options.find((option) => option.kind === 'card' && option.instance === arm.instance) ?? null
    }
    if (arm.kind === 'activate') {
      return options.find((option) => option.id === arm.id) ?? null
    }
    if (arm.kind === 'end') {
      return options.find((option) => option.kind === 'end-turn') ?? null
    }
    return null
  }

  private armReady(): boolean {
    return this.armedOption() != null && this.pending?.actor === 'player' && this.director.idle
  }

  private legalCell(cell: number): boolean {
    if (this.pending?.actor !== 'player') {
      return false
    }
    const arm = this.arm
    if (arm.kind === 'play') {
      return this.pending.options.some((option) => option.kind === 'play' && option.instance === arm.instance && option.cell === cell)
    }
    return false
  }

  private cardLegal(instance: number): boolean {
    return (this.pending?.options ?? []).some((option) => option.instance === instance && (option.kind === 'play' || option.kind === 'cast' || option.kind === 'card' || option.kind === 'activate'))
  }

  private cardHot(instance: number): boolean {
    return this.armMentions(instance)
  }

  private armMentions(instance: number): boolean {
    return (this.arm.kind === 'play' || this.arm.kind === 'cast' || this.arm.kind === 'card') && this.arm.instance === instance
  }

  private armInstanceId(): number | null {
    if (this.arm.kind === 'play' || this.arm.kind === 'cast' || this.arm.kind === 'card') {
      return this.arm.instance
    }
    return null
  }

  private cycleHand(dir: number): void {
    const cards = this.shown.hand.filter((card) => this.cardLegal(card.instance))
    if (cards.length === 0) {
      return
    }
    const current = this.armInstanceId()
    const index = Math.max(0, cards.findIndex((card) => card.instance === current))
    const next = cards[(index + dir + cards.length) % cards.length]!
    this.armCard(next.instance)
  }

  private face(instance: number, w: number, h: number): CardFace {
    const existing = this.faces.get(instance)
    if (existing?.w === w && existing.h === h) {
      return existing
    }
    existing?.root.destroy({ children: true })
    const face = new CardFace(this.glyphs, w, h)
    this.faces.set(instance, face)
    return face
  }

  private findCard(instance: number): ShownCard | undefined {
    return this.shown.cells.find((card) => card?.instance === instance) ?? this.shown.hand.find((card) => card.instance === instance) ?? this.shown.air.find((card) => card.instance === instance)
  }

  private card(id: string | null | undefined) {
    return this.catalog?.cards.find((card) => card.id === id)
  }

  private statusLine(card: ShownCard): string {
    const names = card.statuses.map((id) => this.catalog?.statuses.find((status) => status.id === id)?.name ?? id)
    const timer = card.timerMax > 0 ? `计时${card.timer}` : ''
    return [names[0] ?? '', timer].filter(Boolean).join(' ')
  }

  private anchor(instance: number | null): { x: number; y: number } | null {
    if (instance == null) {
      return null
    }
    const face = this.faces.get(instance)
    if (!face) {
      return null
    }
    return { x: face.root.x, y: face.root.y }
  }

  private advanceMotions(dt: number): void {
    this.motions = this.motions.filter((motion) => {
      motion.t += dt / motion.dur
      const t = Math.min(1, motion.t)
      const eased = 1 - (1 - t) * (1 - t)
      motion.x = motion.x + (motion.tx - motion.x) * 0.35
      motion.y = motion.y + (motion.ty - motion.y) * 0.35
      if (t >= 1 || Math.abs(motion.x - motion.tx) < 1) {
        motion.x = motion.tx
        motion.y = motion.ty
        return false
      }
      void eased
      return true
    })
  }

  private advanceFloats(dt: number): void {
    this.floaters = this.floaters.filter((floater) => {
      floater.age += dt
      floater.y -= dt * 0.02
      floater.root.alpha = Math.max(0, 1 - floater.age / floater.life)
      if (floater.age >= floater.life) {
        floater.root.destroy({ children: true })
        return false
      }
      return true
    })
  }

  private spawnFloat(x: number, y: number, text: string, up: boolean): void {
    const digits = new Digits()
    digits.set(text, 2, up ? 1 : 0.75)
    this.floaters.push({ root: digits.root, x, y, age: 0, life: 760 })
  }

  private spawnNote(x: number, y: number, text: string): void {
    if (!text) {
      return
    }
    const label = this.glyphs.makeLabel()
    label.set(text, 80, 0.7)
    this.floaters.push({ root: label.root, x, y, age: 0, life: 760 })
  }

  private say(text: string): void {
    if (this.banner === text) {
      return
    }
    this.banner = text
    this.bannerAge = 0
  }

  private pushLog(line: string): void {
    this.log.push(line)
    if (this.log.length > 8) {
      this.log.shift()
    }
  }

  private toMenu(): void {
    this.mode = 'menu'
    this.match.visible = false
    this.result.visible = false
    this.menu.visible = true
    this.pending = null
    this.arm = { kind: 'none' }
    this.paintMenu()
  }

  private contentBody(): { content: string } | { yaml: string } {
    return this.yaml ? { yaml: this.yaml } : { content: 'rules' }
  }

  private publish(): void {
    const cssHits = this.hits.map((hit) => ({
      ...hit,
      cssX: this.originX + hit.x * this.scale,
      cssY: this.originY + hit.y * this.scale,
      cssW: hit.w * this.scale,
      cssH: hit.h * this.scale,
    }))
    window.__PCD__ = {
      read: () => this.read(),
      hits: cssHits,
      mode: this.mode,
      idle: this.director.idle && !this.inflight,
      mismatches: this.mismatches.slice(),
    }
  }
}

function clipText(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) {
    return flat
  }
  return `${flat.slice(0, max - 1)}…`
}

function cellOrigin(cell: number): { x: number; y: number } {
  const index = cell - 1
  return {
    x: BOARD_X + (index % 3) * (CELL_W + GAP),
    y: BOARD_Y + Math.floor(index / 3) * (CELL_H + GAP),
  }
}

function beatMs(event: GameEvent): number {
  switch (event.type) {
    case 'intent-revealed':
      return 460
    case 'card-played':
    case 'card-entered':
      return 200
    case 'card-removed':
    case 'card-discarded':
      return 170
    case 'points-changed':
      return 130
    case 'match-ended':
      return 700
    case 'turn-started':
      return 240
    case 'card-drawn':
      return 150
    case 'cell-polluted':
      return 110
    default:
      return 80
  }
}

function caption(event: GameEvent, catalog: Catalog): string {
  const name = catalog.cards.find((card) => card.id === event.card)?.name ?? ''
  switch (event.type) {
    case 'card-entered':
      return `${name} 入场`
    case 'card-drawn':
      return `抽到 ${name}`
    case 'intent-revealed':
      return `意图 ${name}`
    case 'card-played':
      return event.cell ? `打出 ${name}` : `打出 ${name}`
    case 'card-removed':
      return `${name} ${reasonName(event.reason) || '离场'}`
    case 'match-ended':
      return winnerName(event.winner)
    case 'cell-polluted':
      return `格${event.cell ?? ''} 污染`
    case 'turn-started':
      return event.owner === 'monster' ? '怪物回合' : '玩家回合'
    default:
      return ''
  }
}

declare global {
  interface Window {
    __PCD__?: {
      read: () => DebugRead
      hits: (Hit & { cssX: number; cssY: number; cssW: number; cssH: number })[]
      mode: string
      idle: boolean
      mismatches: string[]
    }
  }
}
