import { Effect } from '../effect'
import { Reducer } from '../reducer'

class ReduceReducer<State extends object, Action> extends Reducer<
  State,
  Action
> {
  constructor(
    public readonly reduce: (state: State, action: Action) => Effect<Action>,
  ) {
    super()
  }
}

export function Reduce<State extends object, Action>(
  reduce: (state: State, action: Action) => Effect<Action>,
): ReduceReducer<State, Action> {
  return new ReduceReducer(reduce)
}
