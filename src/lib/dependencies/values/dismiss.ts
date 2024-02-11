import { DependencyKey } from '../dependency-key'
import { DependencyValues } from '../dependency-values'
import { registerDependency } from '../register-dependency'

export type DismissEffect = () => void

declare module '../dependency-values' {
  interface DependencyValues {
    get isPresented(): boolean
    dismiss: DismissEffect
  }
}

export const cannotDismiss = () => {
  throw new Error(
    `A reducer requested dismissal, but couldn't be dismissed. …

This is generally considered an application logic error, and can happen when a \
reducer assumes it runs in a presentation context. If a reducer can run at \
both the root level of an application, as well as in a presentation \
destination, use dependency('isPresented') to determine if the reducer is \
being presented before calling dependency('dismiss').`,
  )
}

class DismissKey extends DependencyKey<DismissEffect> {
  readonly liveValue = cannotDismiss
  readonly testValue = cannotDismiss
}

registerDependency('dismiss', DismissKey)

Object.defineProperty(DependencyValues, 'isPresented', {
  configurable: false,
  enumerable: true,
  get(this: DependencyValues): boolean {
    return this.dismiss !== cannotDismiss
  },
})
