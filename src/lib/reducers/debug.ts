import { diff } from 'deep-object-diff'
import { cloneDeep } from 'lodash'
import { Effect } from '../effect'
import { Reducer } from '../reducer'

export class _ReducerPrinter<State, Action> {
  static customDump<State, Action>(): _ReducerPrinter<State, Action> {
    const isObject = (value: unknown): value is object =>
      typeof value === 'object' && value !== null

    return new _ReducerPrinter((action, oldState, newState) => {
      console.log('received action', action)

      const differences =
        isObject(oldState) && isObject(newState)
          ? diff(oldState, newState)
          : { oldState, newState }

      console.log('differences', differences)
    })
  }

  constructor(
    public readonly printChange: (
      action: Action,
      oldState: State,
      newState: State,
    ) => void,
  ) {}
}

declare module '../..' {
  interface Reducer<State, Action> {
    _printChanges(
      printer?: _ReducerPrinter<State, Action>,
    ): _PrintChangesReducer<State, Action>
  }
}

Reducer.prototype._printChanges = function _printChanges<
  State extends object,
  Action,
>(
  this: Reducer<State, Action>,
  printer: _ReducerPrinter<State, Action> = _ReducerPrinter.customDump(),
): _PrintChangesReducer<State, Action> {
  return new _PrintChangesReducer(this, printer)
}

class _PrintChangesReducer<State extends object, Action> extends Reducer<
  State,
  Action
> {
  constructor(
    private readonly base: Reducer<State, Action>,
    private readonly printer: _ReducerPrinter<State, Action>,
  ) {
    super()
  }

  reduce(state: State, action: Action): Effect<Action> {
    const oldValue = cloneDeep(state)
    const effects = this.base.reduce(state, action)
    const newValue = cloneDeep(state)

    return effects.merge(
      Effect.fireAndForget(() =>
        this.printer.printChange(action, oldValue, newValue),
      ),
    )
  }
}
