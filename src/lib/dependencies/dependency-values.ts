import { DependencyContext } from './dependency-context'
import { DependencyContextKey } from './dependency-context-key'
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

const defaultContext = DependencyContext.test

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
