import hash from 'hash-it'

export class Hasher {
  private finalized: boolean = false
  private readonly values: unknown[] = []

  combine(value: boolean): void
  combine(value: null): void
  combine(value: number): void
  combine(value: string): void
  combine(value: undefined): void
  combine(value: unknown): void {
    if (this.finalized) {
      throw new Error('Hasher is already finalized')
    }

    this.values.push(value)
  }

  finalize(): number {
    if (this.finalized) {
      throw new Error('Hasher is already finalized')
    }

    this.finalized = true

    return hash(this.values)
  }
}

export interface Hashable {
  hashInto(hasher: Hasher): void
}

export function hashValue<T extends Hashable>(value: T): number {
  const hasher = new Hasher()
  value.hashInto(hasher)
  return hasher.finalize()
}
