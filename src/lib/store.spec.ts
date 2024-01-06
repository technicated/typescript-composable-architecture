import { Case, makeEnum } from '@technicated/ts-enums'
import test, { ExecutionContext } from 'ava'
import { delay, of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'
import { Effect, Reducer, Store } from '..'

interface State {
  counter: number
  isTimerOn: boolean
}

const State = (state: Partial<State> = {}): State => ({
  counter: 0,
  isTimerOn: false,
  ...state,
})

type Action =
  | Case<'decrement'>
  | Case<'delayedIncrement', { delay: number }>
  | Case<'increment'>

const Action = makeEnum<Action>()

class CounterReducer extends Reducer<State, Action> {
  override reduce(state: State, action: Action): Effect<Action> {
    switch (action.case) {
      case 'decrement':
        state.counter -= 1
        return Effect.none()

      case 'delayedIncrement':
        return Effect.observable(
          of(Action.increment()).pipe(delay(action.p.delay)),
        )

      case 'increment':
        state.counter += 1
        return Effect.none()
    }
  }
}

const makeTestScheduler = (t: ExecutionContext<unknown>) =>
  new TestScheduler((actual, expected) => t.deepEqual(actual, expected))

test('Store without effects', (t) => {
  const store = new Store(State(), new CounterReducer())
  t.deepEqual(store.state, State())
  store.send(Action.increment())
  t.deepEqual(store.state, State({ counter: 1 }))
  store.send(Action.increment())
  t.deepEqual(store.state, State({ counter: 2 }))
  store.send(Action.decrement())
  t.deepEqual(store.state, State({ counter: 1 }))
  store.send(Action.decrement())
  t.deepEqual(store.state, State({ counter: 0 }))
  store.send(Action.decrement())
  t.deepEqual(store.state, State({ counter: -1 }))
})

test('Store with effects', (t) => {
  const testScheduler = makeTestScheduler(t)

  testScheduler.run(({ expectObservable }) => {
    const store = new Store(State(), new CounterReducer())

    expectObservable(store.state$).toBe(
      'a 99ms b 99ms c 799ms d 99ms e 399ms f',
      {
        a: State({ counter: 0 }),
        b: State({ counter: 0 }),
        c: State({ counter: 1 }),
        d: State({ counter: 1 }),
        e: State({ counter: 2 }),
        f: State({ counter: 3 }),
      },
    )

    testScheduler.schedule(() => {
      store.send(Action.delayedIncrement({ delay: 1000 }))
    }, 100)

    testScheduler.schedule(() => {
      store.send(Action.increment())
    }, 200)

    testScheduler.schedule(() => {
      store.send(Action.delayedIncrement({ delay: 500 }))
    }, 1000)
  })
})
