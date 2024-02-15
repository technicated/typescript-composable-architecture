interface Ctor<T> {
  new (): T
}

export type Provider<T extends object> = { provide: Ctor<T> } & {
  useClass: Ctor<T>
}

export class Injector {
  static _current?: Injector

  private readonly _resolved = new Map<Ctor<object>, object>()

  constructor(
    private readonly dependencies: Provider<object>[] = [],
    private readonly parent?: Injector,
  ) {}

  get<T extends object>(token: Ctor<T>): T {
    return runInInjectionContext(this, () => this.getImpl(token))
  }

  private getImpl<T extends object>(token: Ctor<T>): T {
    if (this._resolved.has(token)) {
      return this._resolved.get(token) as T
    }

    const saveResolvedAndReturn = (resolved: T): T => {
      this._resolved.set(token, resolved)
      return resolved
    }

    for (const dependency of this.dependencies) {
      if (dependency.provide === token) {
        return saveResolvedAndReturn(new token())
      }
    }

    if (this.parent) {
      return saveResolvedAndReturn(this.parent.getImpl(token))
    }

    throw new Error(`Cannot not resolve ${token.name}`)
  }
}

export function runInInjectionContext<R>(injector: Injector, work: () => R): R {
  const old = Injector._current
  Injector._current = injector
  const result = work()
  Injector._current = old
  return result
}

export function withDependencies<R>(
  dependencies: Provider<object>[],
  work: () => R,
): R {
  const injector = new Injector(dependencies, Injector._current)
  return runInInjectionContext(injector, work)
}

export function dependency<T extends object>(token: Ctor<T>): T {
  if (Injector._current) {
    return Injector._current.get(token)
  }

  throw new Error(
    'function `dependency` can only be called from an injection context',
  )
}
