import { Effect } from '../effect'
import { Reducer } from '../reducer'

export class Reduce<State extends object, Action> extends Reducer<
  State,
  Action
> {
  constructor(
    public readonly reduce: (state: State, action: Action) => Effect<Action>,
  ) {
    super()
  }
}
