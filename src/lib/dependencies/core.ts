import { cloneDeep } from 'lodash'

export interface DependencyKey<T> {
  readonly liveValue: T
  readonly testValue?: T
}

interface DependencyKeyCtor<T> {
  new (): DependencyKey<T>
}

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
      const key = this.keyCache.get(Key) as DependencyKey<T>
      return key.liveValue // todo: add Context
    } else if (this.parent) {
      return this.parent.get(Key)
    } else {
      const key = new Key()
      this.keyCache.set(Key, key)
      return key.liveValue // todo: add Context
    }
  }

  set<T>(Key: DependencyKeyCtor<T>, value: T): void {
    this.storage.set(Key, value)
  }
}

export function withDependencies<R>(
  updateDependencies: (dependencies: DependencyValues) => void,
  operation: () => R,
): R {
  return DependencyValues.withScopedDependencies(updateDependencies, operation)
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

export function dependency<Prop extends keyof DependencyValues>(
  prop: Prop,
): DependencyValues[Prop] {
  return DependencyValues.current[prop]
}
