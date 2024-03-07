import { current } from 'immer'
import { Effect } from './effect'
import { TcaState } from './state'

export type ReducerBuilder<State extends TcaState, Action> = () =>
  | Reducer<State, Action>
  | Array<Reducer<State, Action>>

export function buildReducer<State extends TcaState, Action>(
  builder: ReducerBuilder<State, Action>,
): Reducer<State, Action> {
  const reducer = builder()
  return Array.isArray(reducer) ? new SequenceMany(reducer) : reducer
}

export type SomeReducerOf<State extends TcaState, Action> =
  | Reducer<State, Action>
  | Array<Reducer<State, Action>>

export abstract class Reducer<in out State extends TcaState, in out Action> {
  body(): SomeReducerOf<State, Action> {
    return new NeverReducer()
  }

  reduce(state: State, action: Action): Effect<Action> {
    return buildReducer(() => this.body()).reduce(state, action)
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
