import { prettyPrint } from '@base2/pretty-print-object'
import { detailedDiff } from 'deep-object-diff'
import { produce } from 'immer'
import { map, ReplaySubject, take, tap } from 'rxjs'
import { v4 as uuidv4 } from 'uuid'
import { Effect } from './effect'
import { areEqual } from './internal'
import { buildReducer, Reducer, ReducerBuilder } from './reducer'
import { TcaState } from './state'
import { Store } from './store'

class TestStoreError extends Error {}

type TestAction<Action> =
  | { case: 'receive'; action: Action }
  | { case: 'send'; action: Action }

class LongLivingEffect<Action> {
  readonly id = uuidv4()

  constructor(public readonly action: TestAction<Action>) {}
}

class TestReducer<State extends TcaState, Action> extends Reducer<
  State,
  TestAction<Action>
> {
  public readonly effectDidSubscribe = new ReplaySubject<void>(1)
  public readonly inFlightEffects = new Set<LongLivingEffect<Action>>()
  public readonly receivedActions: Array<{ action: Action; state: State }> = []
  public state: State

  constructor(
    private readonly base: Reducer<State, Action>,
    initialState: State,
  ) {
    super()
    this.state = initialState
  }

  reduce(state: State, action: TestAction<Action>): Effect<TestAction<Action>> {
    let effects: Effect<Action>

    switch (action.case) {
      case 'receive':
        effects = this.base.reduce(state, action.action)
        this.receivedActions.push({
          action: action.action,
          state: this.snapshot(state),
        })
        break

      case 'send':
        effects = this.base.reduce(state, action.action)
        this.state = this.snapshot(state)
        break
    }

    if (!effects.source) {
      this.effectDidSubscribe.next()
      return Effect.none()
    }

    const effect = new LongLivingEffect(action)

    return Effect.observable(
      effects.source.pipe(
        tap({
          subscribe: () => {
            this.inFlightEffects.add(effect)
            setTimeout(() => this.effectDidSubscribe.next())
          },
          complete: () => this.inFlightEffects.delete(effect),
          unsubscribe: () => this.inFlightEffects.delete(effect),
        }),
        map((a): TestAction<Action> => ({ case: 'receive', action: a })),
      ),
    )
  }
}

export class TestStore<State extends TcaState, Action> {
  private readonly reducer: TestReducer<State, Action>
  private readonly store: Store<State, TestAction<Action>>

  constructor(initialState: State, reducer: ReducerBuilder<State, Action>) {
    const r = new TestReducer(buildReducer(reducer), initialState)

    this.reducer = r
    this.store = new Store(initialState, r)
  }

  complete(): void {
    if (this.reducer.receivedActions.length > 0) {
      const actions = prettyPrint(
        this.reducer.receivedActions.map(({ action }) => action),
      )

      throw new TestStoreError(
        `The store received ${this.reducer.receivedActions.length} unexpected \
action(s) after this one: …

Unhandled actions: ${actions}`,
      )
    }

    if (this.reducer.inFlightEffects.size > 0) {
      throw new TestStoreError(
        `An effect returned for this action is still running. It must complete \
before the end of the test. …

To fix, inspect any effects the reducer returns for this action and ensure \
that all of them complete by the end of the test. There are a few reasons why \
an effect may not have completed:

• If an effect uses a scheduler (via "delay", "debounce", etc.), make sure \
that you wait enough time for it to perform the effect. If you are using a \
test scheduler, advance it so that the effects may complete, or consider using \
an immediate scheduler to immediately perform the effect instead.

• If you are returning a long-living effect (timers, notifications, subjects, \
etc.), then make sure those effects are torn down by marking the effect \
".cancellable" and returning a corresponding cancellation effect \
("Effect.cancel") from another action.`,
      )
    }
  }

  async receive(
    action: Action,
    updateStateToExpectedResult?: (state: State) => void,
  ): Promise<void> {
    if (this.reducer.inFlightEffects.size > 0) {
      await this.receiveAction()
    }
    this.receiveImpl(action, updateStateToExpectedResult)
  }

  private async receiveAction(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve))

    if (this.reducer.receivedActions.length === 0) {
      if (this.reducer.inFlightEffects.size > 0) {
        throw new TestStoreError(
          'There are effects in-flight. If the effect that delivers this \
action uses a scheduler (via "timer", "interval", "delay", etc.), make sure \
that you wait enough time for it to perform the effect. If you are using a \
test scheduler, advance it so that the effects may complete, or consider using \
an immediate scheduler to immediately perform the effect instead.',
        )
      } else {
        throw new TestStoreError(
          'There are no in-flight effects that could deliver this action. \
Could the effect you expected to deliver this action have been cancelled?',
        )
      }
    }
  }

  async send(
    action: Action,
    updateStateToExpectedResult?: (state: State) => void,
  ): Promise<void> {
    if (this.reducer.receivedActions.length) {
      const actions = prettyPrint(
        this.reducer.receivedActions.map(({ action }) => action),
      )

      throw new TestStoreError(
        `Must handle ${this.reducer.receivedActions.length} received action(s) \
before sending an action.

Unhandled actions: ${actions}`,
      )
    }

    const expectedState = this.reducer.state
    const previousState = this.reducer.state
    this.store.send({ case: 'send', action })

    await new Promise((resolve, reject) => {
      this.reducer.effectDidSubscribe
        .pipe(take(1))
        .subscribe({ next: resolve, error: reject })
    })

    try {
      const currentState = this.reducer.state
      this.reducer.state = previousState
      this.expectedStateShouldMatch(
        expectedState,
        currentState,
        updateStateToExpectedResult,
      )
      this.reducer.state = currentState
    } catch (error) {
      if (error instanceof TestStoreError) {
        throw error
      } else {
        throw new TestStoreError(`Threw error: ${error}`)
      }
    }
  }

  private expectedStateShouldMatch(
    expected: State,
    actual: State,
    updateStateToExpectedResult?: (state: State) => void,
  ): void {
    const current = expected

    const expectationFailure = (expected: State): void => {
      const messageHeading = updateStateToExpectedResult
        ? 'A state change does not match expectation'
        : 'State was not expected to change, but a change occurred'

      throw new TestStoreError(
        `${messageHeading}:

${prettyPrint(detailedDiff(expected as object, actual as object))}`,
      )
    }

    const tryUnnecessaryModifyFailure = (): void => {
      if (areEqual(expected, current) && updateStateToExpectedResult) {
        throw new TestStoreError(`Expected state to change, but no change occurred.

The trailing closure made no observable modifications to state. If no change to state is \
expected, omit the trailing closure.`)
      }
    }

    const expectedWhenGivenPreviousState = produce(current, (draft: State) => {
      if (updateStateToExpectedResult) {
        updateStateToExpectedResult(draft)
      }
    })
    expected = expectedWhenGivenPreviousState

    if (!areEqual(expectedWhenGivenPreviousState, actual)) {
      expectationFailure(expectedWhenGivenPreviousState)
    } else {
      tryUnnecessaryModifyFailure()
    }
  }

  private receiveImpl(
    action: Action,
    updateStateToExpectedResult?: (state: State) => void,
  ): void {
    if (this.reducer.receivedActions.length === 0) {
      throw new TestStoreError(
        `Expected to receive the following action, but didn't: …

${prettyPrint(action)}`,
      )
    }

    const { action: receivedAction, state } =
      // This is valid, already checked ~ v
      this.reducer.receivedActions.shift()!

    if (!areEqual(action, receivedAction)) {
      throw new TestStoreError(
        `Received unexpected action: …

${prettyPrint(receivedAction)}`,
      )
    }

    const expectedState = this.reducer.state

    try {
      this.expectedStateShouldMatch(
        expectedState,
        state,
        updateStateToExpectedResult,
      )
    } catch (error) {
      if (error instanceof TestStoreError) {
        throw error
      } else {
        throw new TestStoreError(`Threw error ${error}`)
      }
    }

    this.reducer.state = state
  }
}
