import { Case, CasePath, EnumShape } from '@technicated/ts-enums'
import { Effect } from '../effect'
import { KeyPath } from '../keypath'
import { buildReducer, Reducer, ReducerBuilder } from '../reducer'

class ScopeReducer<ParentState extends object, ParentAction> extends Reducer<
  ParentState,
  ParentAction
> {
  static casePath<
    ParentState extends EnumShape & Case<string, object>,
    ParentAction extends EnumShape,
    ChildState,
    ChildAction,
  >(
    toChildState: CasePath<ParentState, ChildState>,
    toChildAction: CasePath<ParentAction, ChildAction>,
    reduce: (
      childState: ChildState,
      childAction: ChildAction,
    ) => Effect<ChildAction>,
  ): ScopeReducer<ParentState, ParentAction> {
    return new ScopeReducer((parentState, parentAction) => {
      const childAction = toChildAction.extract(parentAction)

      if (childAction === undefined) {
        return Effect.none()
      }

      const childState = toChildState.extract(parentState)

      if (childState === undefined) {
        // error
        return Effect.none()
      }

      const childEffects = reduce(childState.value, childAction.value)
      Object.assign(parentState.p, toChildState.embed(childState.value).p)
      return childEffects.map(toChildAction.embed)
    })
  }

  static keyPath<
    ParentState extends object,
    ParentAction extends EnumShape,
    ChildState,
    ChildAction,
  >(
    toChildState: KeyPath<ParentState, ChildState>,
    toChildAction: CasePath<ParentAction, ChildAction>,
    reduce: (
      childState: ChildState,
      childAction: ChildAction,
    ) => Effect<ChildAction>,
  ): ScopeReducer<ParentState, ParentAction> {
    return new ScopeReducer((parentState, parentAction) => {
      const childAction = toChildAction.extract(parentAction)

      if (childAction === undefined) {
        return Effect.none()
      }

      const childState = toChildState.get(parentState)
      const childEffects = reduce(childState, childAction.value)
      toChildState.set(parentState, childState)
      return childEffects.map(toChildAction.embed)
    })
  }

  constructor(
    public readonly reduce: (
      state: ParentState,
      action: ParentAction,
    ) => Effect<ParentAction>,
  ) {
    super()
  }
}

export function Scope<
  ParentState extends EnumShape,
  ParentAction extends EnumShape,
  ChildState extends object,
  ChildAction,
>(
  toChildState: CasePath<ParentState, ChildState>,
  toChildAction: CasePath<ParentAction, ChildAction>,
  child: ReducerBuilder<ChildState, ChildAction>,
): ScopeReducer<ParentState, ParentAction>
export function Scope<
  ParentState extends object,
  ParentAction extends EnumShape,
  ChildState extends object,
  ChildAction,
>(
  toChildState: KeyPath<ParentState, ChildState>,
  toChildAction: CasePath<ParentAction, ChildAction>,
  child: ReducerBuilder<ChildState, ChildAction>,
): ScopeReducer<ParentState, ParentAction>
export function Scope<
  ParentState extends EnumShape & Case<string, object>,
  ParentAction extends EnumShape,
  ChildState extends object,
  ChildAction,
>(
  toChildState:
    | CasePath<ParentState, ChildState>
    | KeyPath<ParentState, ChildState>,
  toChildAction: CasePath<ParentAction, ChildAction>,
  child: ReducerBuilder<ChildState, ChildAction>,
): ScopeReducer<ParentState, ParentAction> {
  if (toChildState instanceof KeyPath) {
    return ScopeReducer.keyPath(
      toChildState,
      toChildAction,
      (state, action) => {
        return buildReducer(child).reduce(state, action)
      },
    )
  } else {
    return ScopeReducer.casePath(
      toChildState,
      toChildAction,
      (state, action) => {
        return buildReducer(child).reduce(state, action)
      },
    )
  }
}
