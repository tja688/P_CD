export type GameEvent = {
  seq: number
  type: string
  cause: string[]
  card: string | null
  instance: number | null
  owner: string | null
  cell: number | null
  zone: string | null
  reason: string | null
  source: string | null
  before: number | null
  after: number | null
  winner: string | null
  index: number | null
  round: number | null
  points: number | null
  playerPoints: number | null
  monsterPoints: number | null
  playerOccupancy: number | null
  monsterOccupancy: number | null
}

export type Option = {
  id: string
  kind: string
  instance: number
  cell: number
  card: string | null
}

export type Decision = {
  id: number
  actor: string
  type: string
  ability: string | null
  options: Option[]
}

export type MatchResult = {
  winner: string
  reason: string
  rounds: number
  playerPoints: number
  monsterPoints: number
  playerOccupancy: number
  monsterOccupancy: number
}

export type Advance = {
  protocol: number
  kernel: string
  content: string
  events: GameEvent[]
  pending: Decision | null
  result: MatchResult | null
  snapshot: string
}

export type ViewCard = {
  instance: number
  card: string
  owner: string
  zone: string
  cell: number
  basePoints: number
  currentPoints: number
  back: string | null
  spell: boolean
  timer: number
  timerMax: number
  statuses: string[]
}

export type View = {
  audience: string
  phase: string
  round: number
  remainingOpportunities: number
  revealedIntent: string | null
  playerPoints: number
  monsterPoints: number
  playerOccupancy: number
  monsterOccupancy: number
  handCount: number
  matchDeckCount: number
  playerDiscardCount: number
  monsterDiscardCount: number
  pools: { owner: string; id: string; amount: number }[]
  winner: string | null
  reason: string | null
  cells: { cell: number; polluted: boolean; card: ViewCard | null }[]
  hand: ViewCard[]
  playerDiscard: ViewCard[]
  monsterDiscard: ViewCard[]
  playerVoid: ViewCard[]
  monsterVoid: ViewCard[]
}

export type CatalogCard = {
  id: string
  name: string
  spell: boolean
  points: number
  load: number
  rarity: string
  countdown: number
  text: string
}

export type Catalog = {
  content: string
  contentId: string
  decks: { id: string; name: string; cards: string[] }[]
  monsters: {
    id: string
    name: string
    starting: { card: string; random: boolean; cell: number }[]
    intents: string[]
    skills: string[]
  }[]
  cards: CatalogCard[]
  statuses: { id: string; name: string }[]
  resources: { id: string; name: string }[]
  keywords: { id: string; name: string }[]
}

export type KernelMode = 'wasm' | 'ws'
