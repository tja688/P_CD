import type { View } from '../kernel/types'
import type { Shown, ShownCard } from './shown'

/** 静止时只读核对。不一致只返回文字，调用方只写日志。 */
export function reconcile(shown: Shown, view: View): string[] {
  const issues: string[] = []
  if (shown.air.length > 0) {
    issues.push('仍有未落地的牌')
  }
  if (shown.round !== view.round) {
    issues.push(`回合 ${shown.round} / ${view.round}`)
  }
  if ((shown.intent ?? null) !== (view.revealedIntent ?? null)) {
    issues.push(`意图 ${shown.intent ?? '无'} / ${view.revealedIntent ?? '无'}`)
  }
  if (shown.playerPoints !== view.playerPoints || shown.monsterPoints !== view.monsterPoints) {
    issues.push(`总点数 ${shown.playerPoints}-${shown.monsterPoints} / ${view.playerPoints}-${view.monsterPoints}`)
  }
  if (shown.playerOccupancy !== view.playerOccupancy || shown.monsterOccupancy !== view.monsterOccupancy) {
    issues.push(`占格 ${shown.playerOccupancy}-${shown.monsterOccupancy} / ${view.playerOccupancy}-${view.monsterOccupancy}`)
  }
  if (shown.deck !== view.matchDeckCount) {
    issues.push(`牌组 ${shown.deck} / ${view.matchDeckCount}`)
  }
  if (shown.playerDiscard !== view.playerDiscardCount || shown.monsterDiscard !== view.monsterDiscardCount) {
    issues.push(`弃牌 ${shown.playerDiscard}-${shown.monsterDiscard} / ${view.playerDiscardCount}-${view.monsterDiscardCount}`)
  }
  for (let i = 0; i < 9; i++) {
    const cell = view.cells[i]
    if (!cell) {
      continue
    }
    if (shown.polluted[i] !== cell.polluted) {
      issues.push(`格${i + 1} 污染`)
    }
    compareCard(issues, `格${i + 1}`, shown.cells[i] ?? null, cell.card)
  }
  if (shown.hand.length !== view.hand.length) {
    issues.push(`手牌张数 ${shown.hand.length} / ${view.hand.length}`)
  }
  const n = Math.max(shown.hand.length, view.hand.length)
  for (let i = 0; i < n; i++) {
    compareCard(issues, `手牌${i + 1}`, shown.hand[i] ?? null, view.hand[i] ?? null)
  }
  return issues
}

function compareCard(issues: string[], label: string, shown: ShownCard | null, view: View['cells'][number]['card'] | View['hand'][number] | null): void {
  if (!shown && !view) {
    return
  }
  if (!shown || !view) {
    issues.push(`${label} ${shown ? shown.card : '空'} / ${view ? view.card : '空'}`)
    return
  }
  if (shown.instance !== view.instance || shown.card !== view.card || shown.owner !== view.owner) {
    issues.push(`${label} ${shown.card}#${shown.instance} / ${view.card}#${view.instance}`)
  }
  if (shown.points !== view.currentPoints) {
    issues.push(`${label} 点数 ${shown.points} / ${view.currentPoints}`)
  }
  if (shown.timer !== view.timer || shown.timerMax !== view.timerMax) {
    issues.push(`${label} 计时 ${shown.timer}/${shown.timerMax} / ${view.timer}/${view.timerMax}`)
  }
  const a = shown.statuses.slice().sort().join(',')
  const b = view.statuses.slice().sort().join(',')
  if (a !== b) {
    issues.push(`${label} 状态 ${a} / ${b}`)
  }
}
