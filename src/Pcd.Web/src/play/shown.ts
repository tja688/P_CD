import type { Catalog, GameEvent, View, ViewCard } from '../kernel/types'

export type ShownCard = {
  instance: number
  card: string
  owner: string
  cell: number
  points: number
  spell: boolean
  statuses: string[]
  timer: number
  timerMax: number
}

export type Shown = {
  round: number
  intent: string | null
  playerPoints: number
  monsterPoints: number
  playerOccupancy: number
  monsterOccupancy: number
  deck: number
  playerDiscard: number
  monsterDiscard: number
  playerVoid: number
  monsterVoid: number
  playerDiscardIds: number[]
  monsterDiscardIds: number[]
  polluted: boolean[]
  cells: (ShownCard | null)[]
  hand: ShownCard[]
  pools: { owner: string; id: string; amount: number }[]
  winner: string | null
  reason: string | null
  air: ShownCard[]
}

export type Effect =
  | { kind: 'travel'; instance: number; cell: number; from: 'hand' | 'intent' }
  | { kind: 'float'; instance: number; cell: number; text: string; up: boolean; quiet?: boolean; source?: string }
  | { kind: 'gone'; instance: number; cell: number }
  | { kind: 'draw' }
  | { kind: 'intent' }
  | { kind: 'pollute'; cell: number }
  | { kind: 'banner'; text: string; sfx: string }
  | { kind: 'end'; winner: string }
  | { kind: 'none' }

export function emptyShown(): Shown {
  return {
    round: 0,
    intent: null,
    playerPoints: 0,
    monsterPoints: 0,
    playerOccupancy: 0,
    monsterOccupancy: 0,
    deck: 0,
    playerDiscard: 0,
    monsterDiscard: 0,
    playerVoid: 0,
    monsterVoid: 0,
    playerDiscardIds: [],
    monsterDiscardIds: [],
    polluted: [false, false, false, false, false, false, false, false, false],
    cells: [null, null, null, null, null, null, null, null, null],
    hand: [],
    pools: [],
    winner: null,
    reason: null,
    air: [],
  }
}

export function shownFromView(view: View): Shown {
  const shown = emptyShown()
  shown.round = view.round
  shown.intent = view.revealedIntent
  shown.playerPoints = view.playerPoints
  shown.monsterPoints = view.monsterPoints
  shown.playerOccupancy = view.playerOccupancy
  shown.monsterOccupancy = view.monsterOccupancy
  shown.deck = view.matchDeckCount
  shown.playerDiscard = view.playerDiscardCount
  shown.monsterDiscard = view.monsterDiscardCount
  shown.playerDiscardIds = view.playerDiscard.map((card) => card.instance)
  shown.monsterDiscardIds = view.monsterDiscard.map((card) => card.instance)
  shown.playerVoid = view.playerVoid.length
  shown.monsterVoid = view.monsterVoid.length
  shown.pools = view.pools.map((pool) => ({ ...pool }))
  shown.winner = view.winner
  shown.reason = view.reason
  for (const cell of view.cells) {
    shown.polluted[cell.cell - 1] = cell.polluted
    shown.cells[cell.cell - 1] = cell.card ? fromViewCard(cell.card) : null
  }
  shown.hand = view.hand.map(fromViewCard)
  return shown
}

function fromViewCard(card: ViewCard): ShownCard {
  return {
    instance: card.instance,
    card: card.card,
    owner: card.owner,
    cell: card.cell,
    points: card.currentPoints,
    spell: card.spell,
    statuses: card.statuses.slice(),
    timer: card.timer,
    timerMax: card.timerMax,
  }
}

export function applyEvent(shown: Shown, event: GameEvent, catalog: Catalog): Effect {
  switch (event.type) {
    case 'card-played':
      return play(shown, event, catalog)
    case 'card-entered':
      return enter(shown, event, catalog)
    case 'card-drawn':
      return draw(shown, event, catalog)
    case 'card-removed':
    case 'card-discarded':
      return remove(shown, event)
    case 'card-moved':
      return moved(shown, event)
    case 'points-changed':
      return points(shown, event)
    case 'status-changed':
      return status(shown, event)
    case 'timer-changed':
      return timer(shown, event)
    case 'cell-polluted':
      if (event.cell) {
        shown.polluted[event.cell - 1] = true
        return { kind: 'pollute', cell: event.cell }
      }
      return { kind: 'none' }
    case 'resource-changed':
      return resource(shown, event)
    case 'intent-revealed':
      shown.intent = event.card
      return { kind: 'intent' }
    case 'turn-started':
      shown.round = event.round ?? shown.round
      return { kind: 'banner', text: event.owner === 'monster' ? '怪物回合' : '玩家回合', sfx: 'tick' }
    case 'turn-ended':
      return { kind: 'banner', text: event.owner === 'monster' ? '怪物回合结束' : '玩家回合结束', sfx: 'end' }
    case 'draw-skipped':
      return {
        kind: 'banner',
        text: event.reason === 'hand-full' ? '手牌已满' : '牌组已空',
        sfx: 'tick',
      }
    case 'action-skipped':
      return { kind: 'banner', text: '没有合法落点', sfx: 'cancel' }
    case 'match-ended':
      shown.winner = event.winner
      shown.reason = event.reason
      shown.playerPoints = event.playerPoints ?? shown.playerPoints
      shown.monsterPoints = event.monsterPoints ?? shown.monsterPoints
      shown.playerOccupancy = event.playerOccupancy ?? shown.playerOccupancy
      shown.monsterOccupancy = event.monsterOccupancy ?? shown.monsterOccupancy
      shown.round = event.round ?? shown.round
      return { kind: 'end', winner: event.winner ?? '' }
    default:
      return { kind: 'none' }
  }
}

function play(shown: Shown, event: GameEvent, catalog: Catalog): Effect {
  const instance = event.instance ?? 0
  const cell = event.cell ?? 0
  const handIndex = shown.hand.findIndex((card) => card.instance === instance)
  if (handIndex >= 0) {
    const card = shown.hand.splice(handIndex, 1)[0]!
    card.cell = cell
    shown.air.push(card)
    return { kind: 'travel', instance, cell, from: 'hand' }
  }
  if (instance > 0 && event.card) {
    shown.air.push(make(catalog, event.card, instance, event.owner ?? 'monster', cell, event.points ?? 0))
    return { kind: 'travel', instance, cell, from: 'intent' }
  }
  return { kind: 'none' }
}

function enter(shown: Shown, event: GameEvent, catalog: Catalog): Effect {
  const instance = event.instance ?? 0
  const cell = event.cell ?? 0
  const flying = shown.air.some((item) => item.instance === instance)
  let card = take(shown, instance)
  if (!card && event.card) {
    card = make(catalog, event.card, instance, event.owner ?? 'monster', cell, event.points ?? 0)
  }
  if (!card || cell < 1) {
    return { kind: 'none' }
  }
  card.cell = cell
  card.owner = event.owner ?? card.owner
  if (event.points != null) {
    card.points = event.points
  }
  const def = catalog.cards.find((item) => item.id === card.card)
  if (def && def.countdown > 0 && card.timerMax === 0) {
    card.timer = def.countdown
    card.timerMax = def.countdown
  }
  shown.cells[cell - 1] = card
  recompute(shown)
  if (flying) {
    return { kind: 'none' }
  }
  return { kind: 'travel', instance, cell, from: card.owner === 'player' ? 'hand' : 'intent' }
}

function draw(shown: Shown, event: GameEvent, catalog: Catalog): Effect {
  if (!event.card || event.instance == null) {
    return { kind: 'none' }
  }
  const existing = take(shown, event.instance)
  const card = existing ?? make(catalog, event.card, event.instance, event.owner ?? 'player', 0, event.points ?? 0)
  card.cell = 0
  if (event.owner === 'monster') {
    return { kind: 'none' }
  }
  shown.hand.push(card)
  if (shown.deck > 0) {
    shown.deck -= 1
  }
  return { kind: 'draw' }
}

function remove(shown: Shown, event: GameEvent): Effect {
  const instance = event.instance ?? 0
  const card = take(shown, instance)
  const cell = card?.cell || event.cell || 0
  const owner = event.owner ?? card?.owner ?? 'player'
  if (!card && event.reason === 'sacrifice' && owner === 'player' && shown.deck > 0) {
    shown.deck -= 1
  }
  if (event.zone === 'hand' && card && owner === 'player') {
    card.cell = 0
    card.statuses = []
    shown.hand.push(card)
  } else if (event.zone === 'void') {
    bumpVoid(shown, event.owner)
  } else if (event.zone === 'discard' || event.type === 'card-discarded') {
    bumpDiscard(shown, event.owner, instance)
    if (event.reason === 'hand-full' && (event.owner ?? 'player') === 'player' && shown.deck > 0) {
      shown.deck -= 1
    }
  } else if (event.zone === 'deck') {
    if ((event.owner ?? 'player') === 'player') {
      shown.deck += 1
    }
  }
  recompute(shown)
  return { kind: 'gone', instance, cell }
}

function moved(shown: Shown, event: GameEvent): Effect {
  if (event.instance != null) {
    take(shown, event.instance)
  }
  const owner = event.owner ?? 'player'
  if (event.zone === 'deck' && owner === 'player') {
    shown.deck += 1
  }
  const ids = owner === 'monster' ? shown.monsterDiscardIds : shown.playerDiscardIds
  const index = event.instance == null ? -1 : ids.indexOf(event.instance)
  if (index >= 0) {
    ids.splice(index, 1)
    if (owner === 'monster') {
      shown.monsterDiscard = ids.length
    } else {
      shown.playerDiscard = ids.length
    }
  }
  recompute(shown)
  return { kind: 'banner', text: '洗入牌组', sfx: 'draw' }
}

function points(shown: Shown, event: GameEvent): Effect {
  const card = event.instance == null ? undefined : find(shown, event.instance)
  if (card && event.after != null) {
    card.points = event.after
  }
  recompute(shown)
  const delta = (event.after ?? 0) - (event.before ?? 0)
  const text = `${delta > 0 ? '+' : ''}${delta}`
  return {
    kind: 'float',
    instance: event.instance ?? 0,
    cell: card?.cell || event.cell || 0,
    text,
    up: delta >= 0,
    source: event.source ?? '',
  }
}

function status(shown: Shown, event: GameEvent): Effect {
  const card = event.instance == null ? undefined : find(shown, event.instance)
  if (card && event.source) {
    if (event.reason === 'cleared') {
      card.statuses = card.statuses.filter((id) => id !== event.source)
    } else if (!card.statuses.includes(event.source)) {
      card.statuses.push(event.source)
    }
  }
  return {
    kind: 'float',
    instance: event.instance ?? 0,
    cell: card?.cell || event.cell || 0,
    text: event.reason === 'cleared' ? '清除' : '标记',
    up: event.reason !== 'cleared',
    quiet: true,
  }
}

function timer(shown: Shown, event: GameEvent): Effect {
  const card = event.instance == null ? undefined : find(shown, event.instance)
  if (card && event.after != null) {
    card.timer = event.after
    card.timerMax = Math.max(card.timerMax, event.after)
  }
  return {
    kind: 'float',
    instance: event.instance ?? 0,
    cell: card?.cell || event.cell || 0,
    text: `计时${event.after ?? ''}`,
    up: false,
    quiet: true,
  }
}

function resource(shown: Shown, event: GameEvent): Effect {
  const owner = event.owner ?? 'player'
  const id = event.source ?? 'resource.faith'
  let pool = shown.pools.find((item) => item.owner === owner && item.id === id)
  if (!pool) {
    pool = { owner, id, amount: 0 }
    shown.pools.push(pool)
  }
  pool.amount = event.after ?? pool.amount
  const delta = (event.after ?? 0) - (event.before ?? 0)
  return {
    kind: 'banner',
    text: `${delta >= 0 ? '+' : ''}${delta} 信仰`,
    sfx: delta >= 0 ? 'up' : 'down',
  }
}

function make(catalog: Catalog, id: string, instance: number, owner: string, cell: number, points: number): ShownCard {
  const def = catalog.cards.find((card) => card.id === id)
  return {
    instance,
    card: id,
    owner,
    cell,
    points: def?.spell ? 0 : points || def?.points || 0,
    spell: def?.spell ?? false,
    statuses: [],
    timer: def?.countdown ?? 0,
    timerMax: def?.countdown ?? 0,
  }
}

function find(shown: Shown, instance: number): ShownCard | undefined {
  for (const card of shown.cells) {
    if (card?.instance === instance) {
      return card
    }
  }
  return shown.hand.find((card) => card.instance === instance) ?? shown.air.find((card) => card.instance === instance)
}

function take(shown: Shown, instance: number): ShownCard | undefined {
  for (let i = 0; i < 9; i++) {
    if (shown.cells[i]?.instance === instance) {
      const card = shown.cells[i]
      shown.cells[i] = null
      return card ?? undefined
    }
  }
  const hand = shown.hand.findIndex((card) => card.instance === instance)
  if (hand >= 0) {
    return shown.hand.splice(hand, 1)[0]
  }
  const air = shown.air.findIndex((card) => card.instance === instance)
  if (air >= 0) {
    return shown.air.splice(air, 1)[0]
  }
  return undefined
}

function bumpDiscard(shown: Shown, owner: string | null, instance: number): void {
  const monster = owner === 'monster'
  const ids = monster ? shown.monsterDiscardIds : shown.playerDiscardIds
  if (instance > 0 && !ids.includes(instance)) {
    ids.push(instance)
  }
  if (monster) {
    shown.monsterDiscard = instance > 0 ? ids.length : shown.monsterDiscard + 1
  } else {
    shown.playerDiscard = instance > 0 ? ids.length : shown.playerDiscard + 1
  }
}

function bumpVoid(shown: Shown, owner: string | null): void {
  if (owner === 'monster') {
    shown.monsterVoid += 1
  } else {
    shown.playerVoid += 1
  }
}

function recompute(shown: Shown): void {
  let player = 0
  let monster = 0
  let playerOcc = 0
  let monsterOcc = 0
  for (const card of shown.cells) {
    if (!card) {
      continue
    }
    if (card.owner === 'monster') {
      monster += card.points
      monsterOcc += 1
    } else {
      player += card.points
      playerOcc += 1
    }
  }
  shown.playerPoints = player
  shown.monsterPoints = monster
  shown.playerOccupancy = playerOcc
  shown.monsterOccupancy = monsterOcc
}
