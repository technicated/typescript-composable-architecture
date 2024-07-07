import {
  Case,
  CasePath,
  EnumShape,
  HKT,
  makeEnum1,
} from '@technicated/ts-enums'
import { map, Observable } from 'rxjs'
import { KeyPath } from './keypath'
import { buildReducer, ReducerBuilder } from './reducer'
import { RootStore } from './root-store'
import { isTcaState, TcaState } from './state'

class PartialToStateProto<State> {
  apply(this: PartialToState<State>, state: unknown): State {
    switch (this.case) {
      case 'closure':
        return this.p(state)
      case 'keyPath':
        return this.p.get(state)
      case 'appended':
        return this.p.keyPath.get(this.p.base(state))
    }
  }

  appending<ChildState>(
    this: PartialToState<State>,
    other: PartialToState<ChildState>,
  ): PartialToState<ChildState> {
    if (this.case === 'keyPath' && other.case === 'keyPath') {
      return PartialToState.keyPath(
        (this.p as KeyPath<object, object>).appending(other.p),
      )
    }

    if (this.case === 'closure' && other.case === 'keyPath') {
      return PartialToState.appended({ base: this.p, keyPath: other.p })
    }

    if (this.case === 'appended' && other.case === 'keyPath') {
      return PartialToState.appended({
        base: this.p.base,
        keyPath: this.p.keyPath.appending(other.p),
      })
    }

    return PartialToState.closure((state) => other.apply(this.apply(state)))
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyKeyPath = KeyPath<any, any>

type PartialToState<State> = PartialToStateProto<State> &
  (
    | Case<'closure', (state: unknown) => State>
    | Case<'keyPath', AnyKeyPath>
    | Case<
        'appended',
        { base: (state: unknown) => unknown; keyPath: AnyKeyPath }
      >
  )

interface PartialToStateHKT extends HKT {
  readonly type: PartialToState<this['_A']>
}

const PartialToState = makeEnum1<PartialToStateHKT>({
  proto: PartialToStateProto,
})

class ToState<State extends object, ChildState> {
  readonly base: PartialToState<ChildState>

  constructor(
    value: ((state: State) => ChildState) | KeyPath<State, ChildState>,
  ) {
    if (value instanceof KeyPath) {
      this.base = PartialToState.keyPath(value)
    } else {
      this.base = PartialToState.closure((state) => value(state as State))
    }
  }
}

const internal = Symbol()
type Internal = typeof internal

type StoreCtorArgs<State extends TcaState, Action> =
  | [initialState: State, reducer: ReducerBuilder<State, Action>]
  | [
      internal: Internal,
      rootStore: RootStore,
      toState: PartialToState<State>,
      fromAction: (action: Action) => unknown,
    ]

// class StoreCollection {
//   constructor(
//     private readonly store: Store<
//       IdentifiedArray<ID, State> & TcaState,
//       IdentifiedAction<ID, Action>
//     >,
//   ) {}
// }

export class Store<State extends TcaState, Action> {
  private readonly rootStore: RootStore
  private readonly toState: PartialToState<State>
  private readonly fromAction: (action: Action) => unknown

  get state$(): Observable<State> {
    return this.rootStore.state$.pipe(map((state) => this.toState.apply(state)))
  }

  get state(): State {
    return this.toState.apply(this.rootStore.state)
  }

  constructor(initialState: State, reducer: ReducerBuilder<State, Action>)
  constructor(
    internal: Internal,
    rootStore: RootStore,
    toState: PartialToState<State>,
    fromAction: (action: Action) => unknown,
  )
  constructor(...args: StoreCtorArgs<State, Action>) {
    switch (args.length) {
      case 2: {
        const [initialState, reducer] = args

        if (!isTcaState(initialState)) {
          throw new Error(
            'The object being passed as the Store state is not a TcaState object',
          )
        }

        this.rootStore = RootStore.create(initialState, buildReducer(reducer))
        this.toState = PartialToState.keyPath(KeyPath.for<State>())
        this.fromAction = (action) => action
        break
      }
      case 4:
        ;[, this.rootStore, this.toState, this.fromAction] = args
        break
    }
  }

  /*scope<
    State extends TcaState,
    Action extends EnumShape,
    ChildState extends TcaState,
    ChildAction,
  >(
    this: Store<State, Action>,
    state: KeyPath<State, ChildState>,
    fromChildAction: CasePath<Action, ChildAction>,
  ): Store<ChildState, ChildAction> {
    return new Store<ChildState, ChildAction>(
      internal,
      this.rootStore,
      this.toState.appending(PartialToState.keyPath(state)),
      (action) => this.fromAction(fromChildAction.embed(action)),
    )
  }

  ifScope<
    State extends TcaState,
    Action extends EnumShape,
    ChildState extends TcaState,
    ChildAction,
  >(
    this: Store<State, Action>,
    state: KeyPath<State, ChildState | null>,
    fromChildAction: CasePath<Action, ChildAction>,
  ): Store<ChildState, ChildAction> | null {
    const optionalChildState = state.get(this.state)

    if (optionalChildState === null) {
      return null
    }

    let childState = optionalChildState

    return new Store<ChildState, ChildAction>(
      internal,
      this.rootStore,
      PartialToState.closure((s) => {
        childState = state.get(s as State) ?? childState
        return childState
      }),
      (action) => this.fromAction(fromChildAction.embed(action)),
    )
  }

  forEachScope<
    State extends TcaState,
    Action extends EnumShape,
    ElementId,
    ElementState extends TcaState,
    ElementAction,
  >(
    this: Store<State, Action>,
    toState: KeyPath<State, IdentifiedArray<ElementId, ElementState>>,
    toAction: CasePath<Action, IdentifiedAction<ElementId, ElementAction>>,
  ): Array<Store<ElementState, ElementAction>> {
    const identifiedArray = toState.get(this.state)

    return identifiedArray.ids.map((id) => {
      const element = identifiedArray.getById(id)!

      return new Store<ElementState, ElementAction>(
        internal,
        this.rootStore,
        PartialToState.closure((state) => {
          return toState.get(state as State).getById(id) ?? element
        }),
        (action) => toAction.embed(IdentifiedAction.element({ id, action })),
      )
    })
  }*/

  send(action: Action): void {
    this.rootStore.send(this.fromAction(action))
  }

  /**
   * @internal
   */
  _scope<ChildState extends TcaState, ChildAction>(
    state: ToState<State, ChildState>,
    fromChildAction: (childAction: ChildAction) => Action,
  ): Store<ChildState, ChildAction> {
    return new Store(
      internal,
      this.rootStore,
      this.toState.appending(state.base),
      (action) => this.fromAction(fromChildAction(action)),
    )
  }

  scope<
    State extends TcaState,
    Action extends EnumShape,
    ChildState extends TcaState,
    ChildAction,
  >(
    this: Store<State, Action>,
    state: KeyPath<State, ChildState>,
    action: CasePath<Action, ChildAction>,
  ): Store<ChildState, ChildAction> {
    return this._scope(new ToState(state), action.embed)
  }

  ifScope<
    State extends TcaState,
    Action extends EnumShape,
    ChildState extends TcaState,
    ChildAction,
  >(
    this: Store<State, Action>,
    state: KeyPath<State, ChildState | null>,
    action: CasePath<Action, ChildAction>,
  ): Store<ChildState, ChildAction> | null {
    const optChildState = state.get(this.state)

    if (optChildState === null) {
      return null
    }

    let childState = optChildState

    return this._scope(
      new ToState((asd) => {
        childState = state.get(asd) ?? childState
        return childState
      }),
      action.embed,
    )
  }

  // forEachScope(): StoreCollection {
  //   return new StoreCollection()
  // }
}
