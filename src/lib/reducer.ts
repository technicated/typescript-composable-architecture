import { current } from 'immer'
import { Effect } from './effect'
import { TcaState } from './state'

export type ReducerBuilder<State extends TcaState, Action> =
  | Reducer<State, Action>
  | Array<Reducer<State, Action>>

export function buildReducer<State extends TcaState, Action>(
  builder: ReducerBuilder<State, Action>,
): Reducer<State, Action> {
  return Array.isArray(builder) ? new SequenceMany(builder) : builder
}

export abstract class Reducer<in out State extends TcaState, in out Action> {
  body(): ReducerBuilder<State, Action> {
    return new NeverReducer()
  }

  reduce(state: State, action: Action): Effect<Action> {
    return buildReducer(this.body()).reduce(state, action)
  }

  snapshot(state: State): State {
    return current(state)
  }
}

class NeverReducer<State extends TcaState, Action> extends Reducer<
  State,
  Action
> {
  reduce(): Effect<Action> {
    throw new Error(
      'A Reducer was not implemented correctly, either override `body` (preferred) or `reduce`.',
    )
  }
}

class SequenceMany<State extends TcaState, Action> extends Reducer<
  State,
  Action
> {
  constructor(private readonly reducers: Array<Reducer<State, Action>>) {
    super()
  }

  reduce(state: State, action: Action): Effect<Action> {
    return this.reducers.reduce(
      (effects, reducer) => effects.merge(reducer.reduce(state, action)),
      Effect.none<Action>(),
    )
  }
}
