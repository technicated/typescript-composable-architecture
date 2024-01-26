import {
  Case,
  CasePath,
  EnumShape,
  HKT,
  makeEnum1,
} from '@technicated/ts-enums'
import { Effect } from '../effect'
import { KeyPath } from '../keypath'
import { buildReducer, Reducer, ReducerBuilder } from '../reducer'
import { TcaState } from '../state'

const presentationSymbol = Symbol(
  'TCA internal symbol for Presentation helpers',
)

export interface PresentationState<State> {
  [presentationSymbol]: true
  wrappedValue: State | null
}

export function PresentationState<State extends TcaState>(
  wrappedValue: State | null,
): PresentationState<State> {
  return { [presentationSymbol]: true, wrappedValue }
}

class PresentationActionProto {
  readonly [presentationSymbol] = true
}

export type PresentationAction<Action> = PresentationActionProto &
  (Case<'dismiss'> | Case<'presented', Action>)

interface PresentationActionHKT extends HKT {
  readonly type: PresentationAction<this['_A']>
}

export const PresentationAction = makeEnum1<PresentationActionHKT>({
  proto: PresentationActionProto,
})

class PresentationReducer<
  BaseState extends TcaState,
  BaseAction extends EnumShape,
  DestinationState extends TcaState,
  DestinationAction,
> extends Reducer<BaseState, BaseAction> {
  constructor(
    private readonly base: Reducer<BaseState, BaseAction>,
    private readonly destination: Reducer<DestinationState, DestinationAction>,
    private readonly toPresentationState: KeyPath<
      BaseState,
      PresentationState<DestinationState>
    >,
    private readonly toPresentationAction: CasePath<
      BaseAction,
      PresentationAction<DestinationAction>
    >,
  ) {
    super()
  }

  reduce(state: BaseState, action: BaseAction): Effect<BaseAction> {
    // todo: ephemeral state

    const initialPresentationState =
      this.toPresentationState.get(state).wrappedValue
    const presentationAction = this.toPresentationAction.extract(action)

    let destinationEffects: Effect<BaseAction>
    let baseEffects: Effect<BaseAction>

    if (presentationAction !== undefined) {
      switch (presentationAction.value.case) {
        case 'dismiss':
          if (initialPresentationState !== null) {
            destinationEffects = Effect.none()
            baseEffects = this.base.reduce(state, action)
            this.toPresentationState.modify(state, (presentationState) => {
              presentationState.wrappedValue = null
            })
            break
          } else {
            // todo: error
            destinationEffects = Effect.none()
            baseEffects = this.base.reduce(state, action)
            break
          }
        case 'presented':
          if (initialPresentationState !== null) {
            destinationEffects = this.destination
              .reduce(initialPresentationState, presentationAction.value.p)
              .map((a) =>
                this.toPresentationAction.embed(
                  PresentationAction.presented(a),
                ),
              )
              .cancellable(this.toPresentationState)
            baseEffects = this.base.reduce(state, action)
            break
          } else {
            // todo: error
            destinationEffects = Effect.none()
            baseEffects = this.base.reduce(state, action)
            break
          }
      }
    } else {
      destinationEffects = Effect.none()
      baseEffects = this.base.reduce(state, action)
    }

    const presentationIdentityChanged =
      (initialPresentationState !== null) !==
      (this.toPresentationState.get(state).wrappedValue !== null)

    let dismissEffects: Effect<BaseAction>
    if (presentationIdentityChanged && initialPresentationState !== null) {
      dismissEffects = Effect.cancel(this.toPresentationState)
    } else {
      dismissEffects = Effect.none()
    }

    return Effect.merge(destinationEffects, baseEffects, dismissEffects)
  }
}

declare module '../..' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface Reducer<State, Action> {
    presentation<
      State extends TcaState,
      Action extends EnumShape,
      DestinationState extends TcaState,
      DestinationAction,
    >(
      this: Reducer<State, Action>,
      toPresentationState: KeyPath<State, PresentationState<DestinationState>>,
      toPresentationAction: CasePath<
        Action,
        PresentationAction<DestinationAction>
      >,
      reducer: ReducerBuilder<DestinationState, DestinationAction>,
    ): PresentationReducer<State, Action, DestinationState, DestinationAction>
  }
}

Reducer.prototype.presentation = function presentation<
  State extends TcaState,
  Action extends EnumShape,
  DestinationState extends TcaState,
  DestinationAction,
>(
  toPresentationState: KeyPath<State, PresentationState<DestinationState>>,
  toPresentationAction: CasePath<Action, PresentationAction<DestinationAction>>,
  reducer: ReducerBuilder<DestinationState, DestinationAction>,
): PresentationReducer<State, Action, DestinationState, DestinationAction> {
  return new PresentationReducer(
    this,
    buildReducer(reducer),
    toPresentationState,
    toPresentationAction,
  )
}
