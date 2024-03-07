import { DependencyValues } from './dependency-values'

export function dependency<Key extends keyof DependencyValues>(
  key: Key,
): DependencyValues[Key] {
  return DependencyValues._current[key]
}
