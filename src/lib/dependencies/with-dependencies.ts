import { DependencyValues } from './dependency-values'

export function withDependencies<R>(
  updateDependencies: (
    dependencies: DependencyValues,
  ) => DependencyValues | void,
  operation: () => R,
): R {
  return DependencyValues.withScopedDependencies(updateDependencies, operation)
}
