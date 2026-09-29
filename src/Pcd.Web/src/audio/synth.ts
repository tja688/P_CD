import { voices, type Step } from './voices'

export class Synth {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private hum: OscillatorNode | null = null
  private noise: AudioBuffer | null = null
  muted = false

  resume(): void {
    if (!this.ctx) {
      const ctx = new AudioContext()
      const master = ctx.createGain()
      master.gain.value = 0.9
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.knee.value = 8
      comp.ratio.value = 3
      comp.attack.value = 0.005
      comp.release.value = 0.12
      master.connect(comp)
      comp.connect(ctx.destination)
      const count = ctx.sampleRate
      const buffer = ctx.createBuffer(1, count, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      let seed = 0x1234567
      for (let i = 0; i < data.length; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0
        data[i] = ((seed & 255) / 255) * 2 - 1
      }
      this.noise = buffer
      this.ctx = ctx
      this.master = master
      this.startHum()
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume()
    }
  }

  play(name: string): void {
    if (this.muted || !this.ctx || !this.master) {
      return
    }
    const steps = voices[name]
    if (!steps) {
      return
    }
    let at = this.ctx.currentTime + 0.012
    for (const step of steps) {
      this.schedule(step, at)
      at += step.ms / 1000
    }
  }

  private schedule(step: Step, at: number): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master) {
      return
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = step.wave
    osc.frequency.setValueAtTime(step.freq, at)
    if (step.slide) {
      osc.frequency.linearRampToValueAtTime(Math.max(40, step.freq + step.slide), at + step.ms / 1000)
    }
    gain.gain.setValueAtTime(0.0001, at)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, step.gain), at + 0.008)
    gain.gain.exponentialRampToValueAtTime(0.0001, at + step.ms / 1000)
    osc.connect(gain)
    gain.connect(master)
    osc.start(at)
    osc.stop(at + step.ms / 1000 + 0.02)
    if (step.noise && this.noise) {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      const ng = ctx.createGain()
      const filter = ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = 1400
      filter.Q.value = 0.7
      ng.gain.setValueAtTime(step.noise * 0.08, at)
      ng.gain.exponentialRampToValueAtTime(0.0001, at + step.ms / 1000)
      src.connect(filter)
      filter.connect(ng)
      ng.connect(master)
      src.start(at)
      src.stop(at + step.ms / 1000)
    }
  }

  private startHum(): void {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || this.hum) {
      return
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 60
    gain.gain.value = 0.012
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.18
    lfoGain.gain.value = 0.004
    lfo.connect(lfoGain)
    lfoGain.connect(gain.gain)
    osc.connect(gain)
    gain.connect(master)
    osc.start()
    lfo.start()
    this.hum = osc
  }
}
