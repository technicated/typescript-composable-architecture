import { BehaviorSubject } from 'rxjs'
import { Reducer } from './reducer'

export class Store<State extends object, Action> {
  private readonly state$: BehaviorSubject<State>

  constructor(
    initialState: State,
    private readonly reducer: Reducer<State, Action>,
  ) {
    this.state$ = new BehaviorSubject(initialState)
  }

  send(action: Action): void {
    // todo: handle recursive / multiple actions

    const state = this.state$.value
    const effect = this.reducer.reduce(state, action)

    if (effect.source) {
      // todo: handle subscription
      effect.source.subscribe((action) => this.send(action))
    }

    this.state$.next(state)
  }
}
