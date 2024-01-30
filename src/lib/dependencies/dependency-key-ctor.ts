import { DependencyKey } from './dependency-key'

export interface DependencyKeyCtor<T> {
  new (): DependencyKey<T>
}
