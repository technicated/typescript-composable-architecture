import { Effect } from '../effect'
import { Reducer } from '../reducer'
import { TcaState } from '../state'

class ReduceReducer<State extends TcaState, Action> extends Reducer<
  State,
  Action
> {
  constructor(
    public readonly reduce: (state: State, action: Action) => Effect<Action>,
  ) {
    super()
  }
}

export function Reduce<State extends TcaState, Action>(
  reduce: (state: State, action: Action) => Effect<Action>,
): ReduceReducer<State, Action> {
  return new ReduceReducer(reduce)
}
