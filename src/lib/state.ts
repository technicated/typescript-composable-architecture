import { immerable } from 'immer'

const isProperty = Symbol(
  'Placeholder symbol used only for typings that should never appear in source code.',
)

export type Property<Value> = [null] extends [Value]
  ? [undefined] extends [Value]
    ? (NonNullable<Value> & { [isProperty]?: true }) | null | undefined
    : (NonNullable<Value> & { [isProperty]?: true }) | null
  : [undefined] extends [Value]
    ? (NonNullable<Value> & { [isProperty]?: true }) | undefined
    : NonNullable<Value> & { [isProperty]?: true }

export type InitialValue<Class extends object> = Partial<{
  [K in keyof Class as NonNullable<Class[K]> extends { [isProperty]?: true }
    ? K
    : never]: Class[K]
}>

const tcaState = Symbol('TCA State')

export abstract class TcaState {
  readonly [tcaState] = true

  static make<State extends TcaState>(
    this: { new (): State },
    initialValue: InitialValue<State> = {},
  ): State {
    return Object.assign(new this(), initialValue)
  }

  constructor() {
    Object.assign(this, { [immerable]: true })
  }
}

export function isTcaState(state: TcaState): boolean {
  return state[tcaState]
}

export function makeTcaState<State extends object>(
  state: State,
): State & { [tcaState]: true } {
  return Object.assign(state, { [tcaState]: true, [immerable]: true } as const)
}
