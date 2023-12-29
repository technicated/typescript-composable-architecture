import { Effect } from './effect'

export abstract class Reducer<in out State extends object, in out Action> {
  abstract reduce(state: State, action: Action): Effect<Action>
}
