import { Case, makeEnum } from '@technicated/ts-enums'
import test, { ExecutionContext } from 'ava'
import { interval, map } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'
import { Effect, Reduce, Reducer, ReducerBuilder, Store } from '../..'

const makeTestScheduler = (t: ExecutionContext<unknown>) =>
  new TestScheduler((actual, expected) => t.deepEqual(actual, expected))

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
  | Case<'increment'>
  | Case<'timerTicked'>
  | Case<'toggleTimer'>

const Action = makeEnum<Action>()

class CounterReducer extends Reducer<State, Action> {
  body(): ReducerBuilder<State, Action> {
    return new Reduce((state, action) => {
      switch (action.case) {
        case 'decrement':
          state.counter -= 1
          return Effect.none()
        case 'increment':
          state.counter += 1
          return Effect.none()
        case 'timerTicked':
          state.counter += 1
          return Effect.none()
        case 'toggleTimer':
          state.isTimerOn = !state.isTimerOn
          if (state.isTimerOn) {
            return Effect.observable(
              interval(1000).pipe(map(() => Action.timerTicked())),
            ).cancellable('timer-id')
          } else {
            return Effect.cancel('timer-id')
          }
      }
    })
  }
}

test('Effect.cancellable', (t) => {
  const testScheduler = makeTestScheduler(t)

  testScheduler.run(({ expectObservable }) => {
    const store = new Store(State(), new CounterReducer())

    expectObservable(store.state$).toBe(
      'a 499ms b 999ms c 999ms d 499ms e 6999ms f',
      {
        a: State(),
        b: State({ isTimerOn: true }),
        c: State({ counter: 1, isTimerOn: true }),
        d: State({ counter: 2, isTimerOn: true }),
        e: State({ counter: 2, isTimerOn: false }),
        f: State({ counter: 3, isTimerOn: false }),
      },
    )

    testScheduler.schedule(() => store.send(Action.toggleTimer()), 500)
    testScheduler.schedule(() => store.send(Action.toggleTimer()), 3000)
    testScheduler.schedule(() => store.send(Action.increment()), 10000)
  })
})
