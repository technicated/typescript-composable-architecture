import { DependencyValues } from '../dependency-values'
import { cannotDismiss } from './dismiss'

declare module '../dependency-values' {
  interface DependencyValues {
    get isPresented(): boolean
  }
}

Object.defineProperty(DependencyValues, 'isPresented', {
  configurable: false,
  enumerable: true,
  get(this: DependencyValues): boolean {
    return this.dismiss !== cannotDismiss
  },
})
