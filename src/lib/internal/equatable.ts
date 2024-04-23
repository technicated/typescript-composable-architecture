import lodash from 'lodash'

export const isEqualTo = Symbol('TCA internal symbol for equality')

export interface HasCustomEquality {
  [isEqualTo](other: this): boolean
}

function hasCustomEquality(value: unknown): value is HasCustomEquality {
  return typeof value === 'object' && !!value && isEqualTo in value
}

export function areEqual<T>(lhs: T, rhs: T): boolean {
  if (hasCustomEquality(lhs) && hasCustomEquality(rhs)) {
    return lhs[isEqualTo](rhs)
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
