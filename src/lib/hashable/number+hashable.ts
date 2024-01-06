import { Hashable, Hasher } from './hashable'

declare global {
  interface Number extends Hashable {}
}

Number.prototype.hashInto = function hashInto(
  this: number,
  hasher: Hasher,
): void {
  hasher.combine(this)
}
