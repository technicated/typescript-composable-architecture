import { Hashable, Hasher } from './hashable'

declare global {
  interface String extends Hashable {}
}

String.prototype.hashInto = function hashInto(
  this: string,
  hasher: Hasher,
): void {
  hasher.combine(this)
}
