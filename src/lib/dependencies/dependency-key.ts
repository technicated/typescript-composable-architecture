export interface DependencyKey<T> {
  readonly liveValue: T
  readonly testValue?: T
}
