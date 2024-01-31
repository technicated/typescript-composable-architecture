import { DependencyContext } from './dependency-context'
import {
  DependencyKey,
  DependencyKeyCtor,
  TestDependencyKey,
} from './dependency-key'

class CachedValues {
  private readonly cached = new Map<
    DependencyKeyCtor<unknown>,
    Partial<Record<DependencyContext, unknown>>
  >()

  valueForKey<T>(Key: DependencyKeyCtor<T>, context: DependencyContext): T {
    const record = this.cached.get(Key)

    if (record && context in record) {
      return record[context] as T
    }

    const key = new Key()

    const value = (() => {
      function isLiveKey<T>(k: TestDependencyKey<T>): k is DependencyKey<T> {
        return k instanceof DependencyKey
      }

      switch (context) {
        case DependencyContext.live:
          return isLiveKey(key) ? key.liveValue : null
        case DependencyContext.preview:
          return key.previewValue
        case DependencyContext.test:
          return key.testValue
      }
    })()

    if (value) {
      this.cached.set(Key, { ...record, [context]: value })
      return value
    }

    throw new Error(
      `${Key.name} has no live implementation, but was accessed from a live \
context.

Every dependency registered with the library must conform to \
'${DependencyKey.name}', and that conformance must be visible to the running \
application.

To fix, make sure that '${Key.name}' conforms to '${DependencyKey.name}' by \
providing a live implementation of your dependency.`,
    )
  }
}

// This is a special key and cannot be extracted to its own file because
// otherwise we will have a circular dependency issue: `dependency-values.ts`
// would require access to `context-key.ts` for `DependencyContextKey`, and
// `context-key.ts` would require access to `dependency-values.ts` for
// `registerDependency`. Moreover, the key declaration and the dependency
// registration must be split because we cannot use `DependencyValues` until its
// declaration, so the dependency registration step is at the end of this file.
export class DependencyContextKey extends DependencyKey<DependencyContext> {
  readonly liveValue = DependencyContext.live
  readonly testValue = DependencyContext.test
}

const defaultContext = DependencyContext.test

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class DependencyValues {
  // @internal
  static _current = new DependencyValues()

  private readonly cachedValues = new CachedValues()
  private readonly storage = new Map<unknown, unknown>()

  get<T>(Key: DependencyKeyCtor<T>): T {
    if (this.storage.has(Key)) {
      return this.storage.get(Key) as T
    } else {
      const existing = this.storage.get(DependencyContextKey) as
        | DependencyContext
        | undefined

      return this.cachedValues.valueForKey(Key, existing ?? defaultContext)
    }
  }

  set<T>(Key: DependencyKeyCtor<T>, value: T): void {
    this.storage.set(Key, value)
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

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface DependencyValues {
  context: DependencyContext
}

registerDependency('context', DependencyContextKey)
