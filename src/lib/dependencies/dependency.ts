import { getDependencyEngine } from './dependency-engine'
import { Ctor } from './types'

export function dependency<T extends object>(token: Ctor<T>): T {
  const dependencyEngine = getDependencyEngine()

  return new Proxy(dependencyEngine.resolve(token), {
    apply<This, Args extends unknown[], Result>(
      target: T,
      thisArg: This,
      args: Args,
    ): Result {
      void target
      const fn = getDependencyEngine().resolve(token) as (
        this: This,
        ...args: Args
      ) => Result
      return fn.apply(thisArg, args)
    },
    get<Prop extends keyof T & (string | symbol), Result>(
      target: T,
      prop: Prop,
    ): Result {
      void target
      const obj = getDependencyEngine().resolve(token) as Record<Prop, Result>
      return obj[prop]
    },
    set<Prop extends keyof T & (string | symbol), Value>(
      target: T,
      prop: Prop,
      value: Value,
    ): boolean {
      void target
      const obj = getDependencyEngine().resolve(token) as Record<Prop, Value>
      obj[prop] = value
      return true
    },
  })
}
