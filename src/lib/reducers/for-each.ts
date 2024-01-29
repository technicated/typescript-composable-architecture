import {
  Case,
  CasePath,
  EnumShape,
  HKT2,
  makeEnum2,
} from '@technicated/ts-enums'
import { cloneDeep, difference } from 'lodash'
import { Effect } from '../effect'
import { IdentifiedArray } from '../identified-array'
import { areEqual } from '../internal'
import { KeyPath } from '../keypath'
import { buildReducer, Reducer, ReducerBuilder } from '../reducer'
import { TcaState } from '../state'

export type IdentifiedAction<ID, Action> = Case<
  'element',
  { id: ID; action: Action }
>

interface IdentifiedActionHKT extends HKT2 {
  readonly type: IdentifiedAction<this['_A'], this['_B']>
}

export const IdentifiedAction = makeEnum2<IdentifiedActionHKT>()

class ForEachReducer<
  ParentState extends TcaState,
  ParentAction extends EnumShape,
  ElementState extends TcaState,
  ElementAction,
  ID,
> extends Reducer<ParentState, ParentAction> {
  constructor(
    private readonly parent: Reducer<ParentState, ParentAction>,
    private readonly toElementState: KeyPath<
      ParentState,
      IdentifiedArray<ID, ElementState>
    >,
    private readonly toElementAction: CasePath<
      ParentAction,
      { id: ID; action: ElementAction }
    >,
    private readonly element: Reducer<ElementState, ElementAction>,
  ) {
    super()
  }

  reduce(state: ParentState, action: ParentAction): Effect<ParentAction> {
    const elementEffects = this.reduceForEach(state, action)

    const idsBefore = cloneDeep(this.toElementState.get(state).ids)
    const parentEffects = this.parent.reduce(state, action)
    const idsAfter = cloneDeep(this.toElementState.get(state).ids)

    let elementCancelEffects: Effect<ParentAction>

    if (areEqual(idsBefore, idsAfter)) {
      elementCancelEffects = Effect.none()
    } else {
      elementCancelEffects = Effect.merge(
        difference(idsBefore, idsAfter).map(
          (id): Effect<ParentAction> =>
            Effect.cancel([this.toElementState, id]),
        ),
      )
    }

    return Effect.merge(elementEffects, parentEffects, elementCancelEffects)
  }

  private reduceForEach(
    state: ParentState,
    action: ParentAction,
  ): Effect<ParentAction> {
    const identifiedAction = this.toElementAction.extract(action)

    if (identifiedAction === undefined) {
      return Effect.none()
    }

    const { id, action: elementAction } = identifiedAction.value

    const elementState = this.toElementState.get(state).getById(id)

    if (elementState === null) {
      // todo: error
      return Effect.none()
    }

    return this.element
      .reduce(elementState, elementAction)
      .map((a) => this.toElementAction.embed({ id, action: a }))
      .cancellable([this.toElementState, id])
  }
}

declare module '../..' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Reducer<State, Action> {
    forEach<
      State extends TcaState,
      Action extends EnumShape,
      ElementState extends TcaState,
      ElementAction,
      ID,
    >(
      toElementState: KeyPath<State, IdentifiedArray<ID, ElementState>>,
      toElementAction: CasePath<Action, IdentifiedAction<ID, ElementAction>>,
      reducer: ReducerBuilder<ElementState, ElementAction>,
    ): ForEachReducer<State, Action, ElementState, ElementAction, ID>
  }
}

Reducer.prototype.forEach = function forEach<
  State extends TcaState,
  Action extends EnumShape,
  ElementState extends TcaState,
  ElementAction,
  ID,
>(
  this: Reducer<State, Action>,
  toElementState: KeyPath<State, IdentifiedArray<ID, ElementState>>,
  toElementAction: CasePath<Action, IdentifiedAction<ID, ElementAction>>,
  reducer: ReducerBuilder<ElementState, ElementAction>,
): ForEachReducer<State, Action, ElementState, ElementAction, ID> {
  return new ForEachReducer(
    this,
    toElementState,
    toElementAction.appending(IdentifiedAction('element')),
    buildReducer(reducer),
  )
}
