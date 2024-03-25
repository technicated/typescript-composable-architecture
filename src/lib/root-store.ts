import { produce } from 'immer'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { Reducer } from './reducer'
import { TcaState } from './state'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyReducer = Reducer<any, any>

export class RootStore {
  static create<State extends TcaState, Action>(
    initialState: State,
    reducer: Reducer<State, Action>,
  ): RootStore {
    return new RootStore(initialState, reducer)
  }

  private readonly bufferedActions: unknown[] = []
  private readonly effectSubscriptions: Partial<Record<string, Subscription>> =
    {}
  private isSending = false
  private readonly reducer: AnyReducer
  private readonly state_: BehaviorSubject<unknown>

  get state$(): Observable<unknown> {
    return this.state_.asObservable()
  }

  get state(): unknown {
    return this.state_.value
  }

  private constructor(initialState: unknown, reducer: AnyReducer) {
    this.reducer = reducer
    this.state_ = new BehaviorSubject(initialState)
  }

  send(action: unknown): void {
    this.bufferedActions.push(action)
    if (this.isSending) return

    this.isSending = true

    const nextState = produce(this.state, (draft) => {
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
