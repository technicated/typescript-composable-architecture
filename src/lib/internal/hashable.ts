import hashIt from 'hash-it'

export const combineInto = Symbol('TCA internal symbol for hashability')

export interface Hasher {
  combine(value: unknown): void
}

export interface HasCustomHash {
  [combineInto](hasher: Hasher): void
}

function hasCustomHash(value: unknown): value is HasCustomHash {
  return typeof value === 'object' && !!value && combineInto in value
}

export function hash<T>(obj: T): number {
  if (hasCustomHash(obj)) {
    const values: unknown[] = []
    const hasher: Hasher = { combine: (value) => values.push(value) }
    obj[combineInto](hasher)
    return hashIt(hasher)
  } else {
    return hashIt(obj)
  }
}
