import { Effect } from '../effect'
import { Reducer } from '../reducer'

export class EmptyReducer<State extends object, Action> extends Reducer<
  State,
  Action
> {
  override reduce(state: State, action: Action): Effect<Action> {
    void state
    void action
    return Effect.none()
  }
}
