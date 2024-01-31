import { DependencyValues } from './dependency-values'

export function dependency<Prop extends keyof DependencyValues>(
  prop: Prop,
): DependencyValues[Prop] {
  return DependencyValues._current[prop]
}
