import { Effect } from '../effect'
import { Reducer } from '../reducer'
import { TcaState } from '../state'

class EmptyReducerReducer<State extends TcaState, Action> extends Reducer<
  State,
  Action
> {
  override reduce(state: State, action: Action): Effect<Action> {
    void state
    void action
    return Effect.none()
  }
}

export function EmptyReducer<
  State extends TcaState,
  Action,
>(): EmptyReducerReducer<State, Action> {
  return new EmptyReducerReducer()
}
