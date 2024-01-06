import { produce } from 'immer'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { buildReducer, Reducer, ReducerBuilder } from './reducer'

export class Store<State extends object, Action> {
  private readonly bufferedActions: Action[] = []
  private readonly effectSubscriptions: Partial<Record<string, Subscription>> =
    {}
  private isSending = false
  private readonly reducer: Reducer<State, Action>
  private readonly state_: BehaviorSubject<State>

  get state$(): Observable<State> {
    return this.state_.asObservable()
  }

  get state(): State {
    return this.state_.value
  }

  constructor(initialState: State, reducer: ReducerBuilder<State, Action>) {
    this.reducer = buildReducer(reducer)
    this.state_ = new BehaviorSubject(initialState)
  }

  send(action: Action): void {
    this.bufferedActions.push(action)
    if (this.isSending) return

    this.isSending = true

    const nextState = produce(this.state, (draft: State) => {
      while (this.bufferedActions.length) {
        // The check in the line before ensures this is valid
        //                                                v
        const currentAction = this.bufferedActions.shift()!
        const effect = this.reducer.reduce(draft, currentAction)

        if (effect.source) {
          let didComplete = false
          const uuid = uuidv4()
          const effectSubscription = effect.source.subscribe({
            complete: () => {
              didComplete = true
              delete this.effectSubscriptions[uuid]
            },
            next: (effectAction) => this.send(effectAction),
          })

          if (!didComplete) {
            this.effectSubscriptions[uuid] = effectSubscription
          }
        }
      }
    })

    this.isSending = false
    this.state_.next(nextState)
  }
}
