export type Beat = {
  ms: number
  sfx?: string
  run: () => void
}

export class Director {
  speed = 1
  instant = false
  private queue: Beat[] = []
  private left = 0
  private current: Beat | null = null

  get idle(): boolean {
    return this.current == null && this.queue.length === 0
  }

  push(beat: Beat): void {
    this.queue.push(beat)
  }

  skip(): void {
    if (this.current) {
      this.current = null
      this.left = 0
    }
    while (this.queue.length > 0) {
      this.queue.shift()!.run()
    }
  }

  clear(): void {
    this.queue.length = 0
    this.current = null
    this.left = 0
  }

  update(dt: number): void {
    let budget = dt
    while (budget >= 0) {
      if (!this.current) {
        const next = this.queue.shift()
        if (!next) {
          return
        }
        next.run()
        this.current = next
        const scale = this.instant ? 0 : this.speed
        this.left = scale <= 0 ? 0 : next.ms / scale
      }
      if (this.left > budget) {
        this.left -= budget
        return
      }
      budget -= this.left
      this.left = 0
      this.current = null
    }
  }
}
