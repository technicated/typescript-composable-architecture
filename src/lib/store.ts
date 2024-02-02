import { CasePath, EnumShape } from '@technicated/ts-enums'
import { produce } from 'immer'
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { KeyPath } from './keypath'
import { buildReducer, Reducer, ReducerBuilder } from './reducer'
import { EmptyReducer } from './reducers'
import { isTcaState, TcaState } from './state'

export class Store<State extends TcaState, Action> {
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
    if (!isTcaState(initialState)) {
      throw new Error(
        'The object being passed as the Store state is not a TcaState object',
      )
    }

    this.reducer = buildReducer(reducer)
    this.state_ = new BehaviorSubject(initialState)
  }

  scope<
    State extends TcaState,
    Action extends EnumShape,
    ChildState extends TcaState,
    ChildAction,
  >(
    this: Store<State, Action>,
    toChildState: KeyPath<State, ChildState>,
    toChildAction: CasePath<Action, ChildAction>,
  ): Store<ChildState, ChildAction> {
    return Object.defineProperties(
      new Store<ChildState, ChildAction>(
        toChildState.get(this.state),
        EmptyReducer(),
      ),
      {
        state$: {
          configurable: true,
          enumerable: true,
          get: () => this.state$.pipe(map((state) => toChildState.get(state))),
        },
        state: {
          configurable: true,
          enumerable: true,
          get: () => toChildState.get(this.state),
        },
        send: {
          configurable: true,
          enumerable: true,
          value: (action: ChildAction) =>
            this.send(toChildAction.embed(action)),
          writable: false,
        },
      },
    )
  }

  scopeIf<
    State extends TcaState,
    Action extends EnumShape,
    ChildState extends TcaState,
    ChildAction,
  >(
    this: Store<State, Action>,
    toChildState: KeyPath<State, ChildState | null>,
    toChildAction: CasePath<Action, ChildAction>,
  ): Store<ChildState, ChildAction> | null {
    const initialState = toChildState.get(this.state)

    if (initialState === null) {
      return null
    }

    return Object.defineProperties(
      new Store<ChildState, ChildAction>(initialState, EmptyReducer()),
      {
        state$: {
          configurable: true,
          enumerable: true,
          get: () => this.state$.pipe(map((state) => toChildState.get(state))),
        },
        state: {
          configurable: true,
          enumerable: true,
          get: () => toChildState.get(this.state),
        },
        send: {
          configurable: true,
          enumerable: true,
          value: (action: ChildAction) =>
            this.send(toChildAction.embed(action)),
          writable: false,
        },
      },
    )
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
