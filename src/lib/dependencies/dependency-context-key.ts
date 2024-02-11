import { DependencyContext } from './dependency-context'
import { DependencyKey } from './dependency-key'

/**
 * This must be separated in its own file because:
 * - `values/context.ts` requires `register-dependency.ts`
 * - `register-dependency.ts` requires `dependency-values.ts`
 * - `dependency-values.ts` requires `DependencyContextKey`
 *
 * If `DependencyContextKey` was inside `values/context.ts`, we would have a
 * circular dependency:
 * - `values/context.ts` requires `register-dependency.ts`
 * - `register-dependency.ts` requires `dependency-values.ts`
 * - `dependency-values.ts` requires `values/context.ts`
 *
 * In this way, we instead have:
 * - `values/context.ts` requires `context-key.ts` and `register-dependency.ts`
 * - `register-dependency.ts` requires `dependency-values.ts`
 * - `dependency-values.ts` requires `context-key.ts`
 *
 * thus avoiding the circular dependency issue.
 */
export class DependencyContextKey extends DependencyKey<DependencyContext> {
  readonly liveValue = DependencyContext.live
  readonly testValue = DependencyContext.test
}
