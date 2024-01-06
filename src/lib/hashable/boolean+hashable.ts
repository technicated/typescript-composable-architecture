import { Hashable, Hasher } from './hashable'

declare global {
  interface Boolean extends Hashable {}
}

Boolean.prototype.hashInto = function hashInto(
  this: boolean,
  hasher: Hasher,
): void {
  hasher.combine(this)
}
