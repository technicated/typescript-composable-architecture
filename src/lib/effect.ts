import { defer, EMPTY, Observable, map as rxMap, merge as rxMerge } from 'rxjs'

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class Effect<Action> {
  static fireAndForget<Action>(work: () => void): Effect<Action> {
    return Effect.observable<Action>(
      defer(() => {
        work()
        return EMPTY
      }),
    )
  }

  static observable<Action>(source: Observable<Action>): Effect<Action> {
    return new Effect(source)
  }

  static none<Action>(): Effect<Action> {
    return new Effect()
  }

  private constructor(public readonly source?: Observable<Action>) {}
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace Effect {
  interface MergeFn {
    <Action>(...effects: Effect<Action>[]): Effect<Action>
    <Action>(effects: Effect<Action>[]): Effect<Action>
  }

  export const merge: MergeFn = function merge<Action>(
    ...args: [Effect<Action>[]] | Effect<Action>[] | []
  ): Effect<Action> {
    const effects = (
      Array.isArray(args[0]) ? args[0] : args
    ) as Effect<Action>[]

    return effects.reduce(
      (effects, effect) => effects.merge(effect),
      Effect.none(),
    )
  }
}

export interface Effect<Action> {
  merge(other: Effect<Action>): Effect<Action>
  map<U>(transform: (action: Action) => U): Effect<U>
}

Effect.prototype.merge = function merge<Action>(
  this: Effect<Action>,
  other: Effect<Action>,
): Effect<Action> {
  if (!other.source) {
    return this
  }

  if (!this.source) {
    return other
  }

  return Effect.observable(rxMerge(this.source, other.source))
}

Effect.prototype.map = function map<Action, U>(
  this: Effect<Action>,
  transform: (action: Action) => U,
): Effect<U> {
  return this.source
    ? Effect.observable(this.source.pipe(rxMap(transform)))
    : Effect.none()
}
