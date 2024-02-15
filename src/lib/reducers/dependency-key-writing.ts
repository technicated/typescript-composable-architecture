import { DependencyValues, withDependencies } from '../dependencies'
import { Effect } from '../effect'
import { Reducer } from '../reducer'
import { TcaState } from '../state'

type ObjectDependencyKeys = keyof {
  [K in keyof DependencyValues as DependencyValues[K] extends object
    ? K
    : never]: unknown
}

declare module '../..' {
  interface Reducer<State, Action> {
    dependency<Prop extends keyof DependencyValues>(
      prop: Prop,
      value: DependencyValues[Prop],
    ): _DependencyKeyWritingReducer<State, Action>

    transformDependency<Prop extends ObjectDependencyKeys>(
      prop: Prop,
      transform: (dependency: DependencyValues[Prop]) => void,
    ): _DependencyKeyWritingReducer<State, Action>
  }
}

Reducer.prototype.dependency = function dependency<
  State extends TcaState,
  Action,
  Prop extends keyof DependencyValues,
>(
  this: Reducer<State, Action>,
  prop: Prop,
  value: DependencyValues[Prop],
): _DependencyKeyWritingReducer<State, Action> {
  return new _DependencyKeyWritingReducer(this, (dependencies) => {
    dependencies[prop] = value
  })
}

Reducer.prototype.transformDependency = function transformDependency<
  State extends TcaState,
  Action,
  Prop extends ObjectDependencyKeys,
>(
  this: Reducer<State, Action>,
  prop: Prop,
  transform: (dependency: DependencyValues[Prop]) => void,
): _DependencyKeyWritingReducer<State, Action> {
  return new _DependencyKeyWritingReducer(this, (dependencies) => {
    transform(dependencies[prop])
  })
}

class _DependencyKeyWritingReducer<
  State extends TcaState,
  Action,
> extends Reducer<State, Action> {
  constructor(
    private readonly base: Reducer<State, Action>,
    private readonly update: (dependencies: DependencyValues) => void,
  ) {
    super()
  }

  override dependency<Prop extends keyof DependencyValues>(
    prop: Prop,
    value: DependencyValues[Prop],
  ): _DependencyKeyWritingReducer<State, Action> {
    return new _DependencyKeyWritingReducer(this.base, (dependencies) => {
      dependencies[prop] = value
      this.update(dependencies)
    })
  }

  reduce(state: State, action: Action): Effect<Action> {
    return withDependencies(this.update, () => {
      return this.base.reduce(state, action)
    })
  }

  override transformDependency<Prop extends ObjectDependencyKeys>(
    prop: Prop,
    transform: (dependency: DependencyValues[Prop]) => void,
  ): _DependencyKeyWritingReducer<State, Action> {
    return new _DependencyKeyWritingReducer(this.base, (dependencies) => {
      transform(dependencies[prop])
      this.update(dependencies)
    })
  }
}
