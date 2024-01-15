import { CasePath, EnumShape } from '@technicated/ts-enums'
import { Effect } from '../effect'
import { KeyPath } from '../keypath'
import { buildReducer, Reducer, ReducerBuilder } from '../reducer'

class IfLetReducer<
  ParentState extends object,
  ParentAction extends EnumShape,
  ChildState extends object,
  ChildAction,
> extends Reducer<ParentState, ParentAction> {
  constructor(
    private readonly parent: Reducer<ParentState, ParentAction>,
    private readonly child: Reducer<ChildState, ChildAction>,
    private readonly toChildState: KeyPath<ParentState, ChildState | null>,
    private readonly toChildAction: CasePath<ParentAction, ChildAction>,
  ) {
    super()
  }

  reduce(state: ParentState, action: ParentAction): Effect<ParentAction> {
    // todo: ephemeral state
    // todo: cancel child effects, requires KeyPath to be Hashable - must use a class as a "base"

    return this.reduceChild(state, action).merge(
      this.parent.reduce(state, action),
    )
  }

  private reduceChild(
    state: ParentState,
    action: ParentAction,
  ): Effect<ParentAction> {
    const childAction = this.toChildAction.extract(action)

    if (childAction === undefined) {
      return Effect.none()
    }

    const childState = this.toChildState.get(state)

    if (childState === null) {
      // todo: error
      return Effect.none()
    }

    const childEffects = this.child.reduce(childState, childAction.value)
    this.toChildState.set(state, childState)
    return childEffects.map(this.toChildAction.embed)
  }
}

declare module '../..' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Reducer<State, Action> {
    ifLet<
      State extends object,
      Action extends EnumShape,
      WrappedState extends object,
      WrappedAction,
    >(
      this: Reducer<State, Action>,
      toWrappedState: KeyPath<State, WrappedState | null>,
      toWrappedAction: CasePath<Action, WrappedAction>,
      reducer: Reducer<WrappedState, WrappedAction>,
    ): IfLetReducer<State, Action, WrappedState, WrappedAction>
  }
}

Reducer.prototype.ifLet = function ifLet<
  State extends object,
  Action extends EnumShape,
  WrappedState extends object,
  WrappedAction,
>(
  toWrappedState: KeyPath<State, WrappedState | null>,
  toWrappedAction: CasePath<Action, WrappedAction>,
  reducer: ReducerBuilder<WrappedState, WrappedAction>,
): IfLetReducer<State, Action, WrappedState, WrappedAction> {
  return new IfLetReducer(
    this,
    buildReducer(reducer),
    toWrappedState,
    toWrappedAction,
  )
}
