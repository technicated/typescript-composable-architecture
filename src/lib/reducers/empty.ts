import { Effect } from '../effect'
import { Reducer } from '../reducer'

class EmptyReducerReducer<State extends object, Action> extends Reducer<
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
  State extends object,
  Action,
>(): EmptyReducerReducer<State, Action> {
  return new EmptyReducerReducer()
}
