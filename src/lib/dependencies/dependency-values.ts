import { cloneDeep } from 'lodash'
import { DependencyContext } from './dependency-context'
import { DependencyKey } from './dependency-key'
import { DependencyKeyCtor } from './dependency-key-ctor'

// This is a special key and cannot be extracted to its own file because
// otherwise we will have a circular dependency issue: `dependency-values.ts`
// would require access to `context-key.ts` for `DependencyContextKey`, and
// `context-key.ts` would require access to `dependency-values.ts` for
// `registerDependency`. Moreover, the key declaration and the dependency
// registration must be split because we cannot use `DependencyValues` until its
// declaration, so the dependency registration step is at the end of this file.
export class DependencyContextKey implements DependencyKey<DependencyContext> {
  readonly liveValue = DependencyContext.live
  readonly testValue = DependencyContext.test
}

const defaultContext = DependencyContext.test

export class DependencyValues {
  static current = new DependencyValues()

  static withScopedDependencies<R>(
    updateDependencies: (dependencies: DependencyValues) => void,
    operation: () => R,
  ): R {
    const original = DependencyValues.current
    DependencyValues.current = cloneDeep(original)
    updateDependencies(DependencyValues.current)
    const result = operation()
    DependencyValues.current = original
    return result
  }

  private readonly keyCache = new Map<unknown, unknown>()
  private readonly storage = new Map<unknown, unknown>()

  private constructor(
    private readonly parent: DependencyValues | null = null,
  ) {}

  get<T>(Key: DependencyKeyCtor<T>): T {
    if (this.storage.has(Key)) {
      return this.storage.get(Key) as T
    } else if (this.keyCache.has(Key)) {
      return this.getFromContext(Key)
    } else if (this.parent) {
      return this.parent.get(Key)
    } else {
      this.keyCache.set(Key, new Key())
      return this.getFromContext(Key)
    }
  }

  set<T>(Key: DependencyKeyCtor<T>, value: T): void {
    this.storage.set(Key, value)
  }

  private getFromContext<T>(Key: DependencyKeyCtor<T>): T {
    const existing = this.storage.get(DependencyContextKey) as
      | DependencyContext
      | undefined

    const key = this.keyCache.get(Key) as DependencyKey<T>

    switch (existing ?? defaultContext) {
      case DependencyContext.live:
        return key.liveValue
      case DependencyContext.test:
        if (key.testValue) {
          return key.testValue
        } else {
          throw new Error(
            `${Key} has no test value, but was accessed from a test context.

Dependencies registered with the library are not allowed to use their default, \
live implementations when run from tests.

To fix, override ${Key} with a test value.`,
          )
        }
    }
  }
}

export function registerDependency<Prop extends keyof DependencyValues>(
  prop: Prop,
  key: DependencyKeyCtor<DependencyValues[Prop]>,
): void {
  Object.defineProperty(DependencyValues.prototype, prop, {
    configurable: false,
    enumerable: true,
    get(this: DependencyValues) {
      return this.get(key)
    },
    set(this: DependencyValues, value) {
      this.set(key, value)
    },
  })
}

// Dependency registration for `DependencyContext` / `DependencyContextKey`

declare module '.' {
  interface DependencyValues {
    context: DependencyContext
  }
}

registerDependency('context', DependencyContextKey)
