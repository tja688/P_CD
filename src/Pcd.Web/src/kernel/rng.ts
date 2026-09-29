/** SplitMix64，与内核 DeterministicRng 同一条递推。 */
export class SplitMix64 {
  constructor(private state: bigint) {}

  get word(): bigint {
    return this.state
  }

  nextInt(exclusiveMax: number): number {
    if (exclusiveMax <= 0) {
      throw new Error('range')
    }
    let z = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn
    this.state = z
    z = (z ^ (z >> 30n)) & 0xffffffffffffffffn
    z = (z * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn
    z = (z ^ (z >> 27n)) & 0xffffffffffffffffn
    z = (z * 0x94d049bb133111ebn) & 0xffffffffffffffffn
    z = (z ^ (z >> 31n)) & 0xffffffffffffffffn
    return Number(z % BigInt(exclusiveMax))
  }
}
