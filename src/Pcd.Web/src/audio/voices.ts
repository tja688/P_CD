export type Step = {
  wave: OscillatorType
  freq: number
  ms: number
  gain: number
  slide?: number
  noise?: number
}

/** 8bit 音色参数。画面、按键与这些数字是同一台机器。 */
export const voices: Record<string, Step[]> = {
  power: [
    { wave: 'square', freq: 82, ms: 70, gain: 0.045 },
    { wave: 'square', freq: 164, ms: 110, gain: 0.04, slide: 40 },
    { wave: 'triangle', freq: 330, ms: 180, gain: 0.03 },
  ],
  tick: [{ wave: 'square', freq: 988, ms: 22, gain: 0.03 }],
  move: [{ wave: 'square', freq: 740, ms: 18, gain: 0.025 }],
  arm: [{ wave: 'square', freq: 523, ms: 36, gain: 0.035 }],
  confirm: [
    { wave: 'square', freq: 523, ms: 42, gain: 0.04 },
    { wave: 'square', freq: 784, ms: 64, gain: 0.04 },
  ],
  cancel: [{ wave: 'square', freq: 196, ms: 70, gain: 0.035, slide: -60 }],
  play: [
    { wave: 'square', freq: 349, ms: 50, gain: 0.04, noise: 0.15 },
    { wave: 'triangle', freq: 523, ms: 80, gain: 0.03 },
  ],
  cover: [
    { wave: 'square', freq: 98, ms: 40, gain: 0.05, noise: 0.45 },
    { wave: 'square', freq: 73, ms: 120, gain: 0.04 },
  ],
  draw: [{ wave: 'triangle', freq: 659, ms: 48, gain: 0.03, slide: 80 }],
  up: [
    { wave: 'square', freq: 440, ms: 40, gain: 0.03 },
    { wave: 'square', freq: 554, ms: 40, gain: 0.03 },
    { wave: 'square', freq: 659, ms: 70, gain: 0.028 },
  ],
  down: [
    { wave: 'square', freq: 392, ms: 46, gain: 0.03 },
    { wave: 'square', freq: 311, ms: 70, gain: 0.028 },
  ],
  intent: [{ wave: 'square', freq: 146, ms: 160, gain: 0.04, slide: -12 }],
  pollute: [{ wave: 'square', freq: 123, ms: 90, gain: 0.03, noise: 0.25 }],
  remove: [{ wave: 'square', freq: 220, ms: 30, gain: 0.035, noise: 0.35, slide: -80 }],
  end: [{ wave: 'triangle', freq: 294, ms: 80, gain: 0.025 }],
  win: [
    { wave: 'square', freq: 262, ms: 90, gain: 0.04 },
    { wave: 'square', freq: 330, ms: 90, gain: 0.04 },
    { wave: 'square', freq: 392, ms: 90, gain: 0.04 },
    { wave: 'square', freq: 523, ms: 220, gain: 0.045 },
  ],
  lose: [
    { wave: 'triangle', freq: 392, ms: 120, gain: 0.035 },
    { wave: 'triangle', freq: 330, ms: 120, gain: 0.03 },
    { wave: 'triangle', freq: 262, ms: 140, gain: 0.028 },
    { wave: 'triangle', freq: 196, ms: 240, gain: 0.03 },
  ],
  undo: [{ wave: 'square', freq: 311, ms: 50, gain: 0.03, slide: 90 }],
}
