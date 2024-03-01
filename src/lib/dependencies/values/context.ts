import { DependencyContext } from '../dependency-context'
import { DependencyContextKey } from '../dependency-context-key'
import { registerDependency } from '../register-dependency'

declare module '../dependency-values' {
  interface DependencyValues {
    context: DependencyContext
  }
}

registerDependency('context', DependencyContextKey)
