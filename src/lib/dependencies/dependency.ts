import { cloneDeep } from 'lodash'
import { DependencyValues } from './dependency-values'

type CompatibleKeysOf_<
  Target extends object,
  Key extends keyof DependencyValues,
> = keyof {
  [Prop in keyof Target as DependencyValues[Key] extends Target[Prop]
    ? Prop
    : never]: unknown
}
type CompatibleKeysOf<
  Target extends object,
  Key extends keyof DependencyValues,
> = CompatibleKeysOf_<Target, Key> extends never
  ? `Expected a variable with a type compatible with DependencyValues.${Key}`
  : CompatibleKeysOf_<Target, Key>

export function Dependency<Key extends keyof DependencyValues>(key: Key) {
  const initialValue = cloneDeep(DependencyValues._current)

  return function <
    Target extends object,
    Prop extends CompatibleKeysOf<Target, Key>,
  >(target: Target, prop: Prop) {
    Object.defineProperty(target, prop, {
      configurable: false,
      enumerable: true,
      get: () => {
        return initialValue.mergingWith(DependencyValues._current)[key]
      },
    })
  }
}
