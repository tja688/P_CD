const reasons: Record<string, string> = {
  'full-board': '满格判定',
  resource: '资源结算',
  special: '特殊结算',
  cover: '覆盖',
  'tie-cover': '同归于尽',
  'points-zero': '点数归零',
  spell: '法术',
  'no-legal-cell': '没有合法落点',
  setup: '初始摆放',
  play: '打出',
  'hand-full': '手牌已满',
  'deck-empty': '牌组已空',
  transform: '转化',
  choose: '选择',
  return: '返魂',
  sacrifice: '献祭',
  copy: '复制',
  link: '链接',
  shuffle: '洗牌',
  leave: '离场',
}

const sources: Record<string, string> = {
  cover: '覆盖',
  'polluted-cell': '污染格',
  'status.seal': '封印',
  'status.mark': '解析标记',
  effect: '效果',
  countdown: '计时',
}

export function reasonName(reason: string | null | undefined): string {
  if (!reason) {
    return ''
  }
  return reasons[reason] ?? reason
}

export function sourceName(source: string | null | undefined): string {
  if (!source) {
    return ''
  }
  return sources[source] ?? source
}

export function phaseName(phase: string): string {
  switch (phase) {
    case 'player-action':
      return '玩家行动'
    case 'monster-action':
      return '怪物行动'
    case 'player-turn-start':
      return '玩家回合开始'
    case 'monster-turn-start':
      return '怪物回合开始'
    case 'reveal-intent':
      return '意图'
    case 'player-draw':
      return '抽牌'
    case 'finished':
      return '对局结束'
    default:
      return phase
  }
}

export function winnerName(winner: string | null | undefined): string {
  switch (winner) {
    case 'player':
      return '玩家胜利'
    case 'monster':
      return '怪物胜利'
    case 'draw':
      return '平局'
    default:
      return '未结束'
  }
}
