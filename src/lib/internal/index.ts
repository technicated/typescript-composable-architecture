import hashIt from 'hash-it'
import lodash from 'lodash'

export const isEqual = Symbol('TCA internal symbol for equality')

function hasCustomEquality(
  value: unknown,
): value is { [isEqual]: (other: unknown) => boolean } {
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

export const hashValue = Symbol('TCA internal symbol for hashability')

function hasCustomHash(value: unknown): value is { [hashValue]: number } {
  return typeof value === 'object' && !!value && hashValue in value
}

export function hash<T>(obj: T): number {
  if (hasCustomHash(obj)) {
    return obj[hashValue]
  } else {
    return hashIt(obj)
  }
}
