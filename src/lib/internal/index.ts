import hashIt from 'hash-it'
import lodash from 'lodash'

export const isEqual = Symbol('TCA internal symbol for equality')

export interface HasCustomEquality<T> {
  [isEqual](other: T): boolean
}

function hasCustomEquality<T>(
  value: T | HasCustomEquality<T>,
): value is HasCustomEquality<T> {
  return typeof value === 'object' && !!value && isEqual in value
}

export function areEqual<T>(lhs: T, rhs: T): boolean {
  if (hasCustomEquality(lhs) && hasCustomEquality(rhs)) {
    return lhs[isEqual](rhs)
  } else {
    return lodash.isEqualWith(lhs, rhs, function (l, r) {
      if (l === lhs && r === rhs) {
        return undefined
      } else {
        return areEqual(l, r)
      }
    })
  }
}

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
