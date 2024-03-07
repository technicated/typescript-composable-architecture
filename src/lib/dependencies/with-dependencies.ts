import { cloneDeep } from 'lodash'
import { DependencyValues } from './dependency-values'

export function withDependencies<R>(
  updateDependencies: (
    dependencies: DependencyValues,
  ) => DependencyValues | void,
  operation: () => R,
): R {
  const original = DependencyValues._current
  DependencyValues._current = cloneDeep(original)
  const updated = updateDependencies(DependencyValues._current)
  if (updated) DependencyValues._current = updated

  try {
    return operation()
  } finally {
    DependencyValues._current = original
  }
}
