import { Case, makeEnum } from '@technicated/ts-enums'
import test, { ExecutionContext } from 'ava'
import { interval, map } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'
import {
  Effect,
  Property,
  Reduce,
  Reducer,
  ReducerBuilder,
  Store,
  TcaState,
} from '../..'

const makeTestScheduler = (t: ExecutionContext<unknown>) =>
  new TestScheduler((actual, expected) => t.deepEqual(actual, expected))

class State extends TcaState {
  counter: Property<number> = 0
  isTimerOn: Property<boolean> = false
}

type Action =
  | Case<'decrement'>
  | Case<'increment'>
  | Case<'timerTicked'>
  | Case<'toggleTimer'>

const Action = makeEnum<Action>()

class CounterReducer extends Reducer<State, Action> {
  body(): ReducerBuilder<State, Action> {
    return Reduce((state, action) => {
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
    const store = new Store(State.make(), new CounterReducer())

    expectObservable(store.state$).toBe(
      'a 499ms b 999ms c 999ms d 499ms e 6999ms f',
      {
        a: State.make(),
        b: State.make({ isTimerOn: true }),
        c: State.make({ counter: 1, isTimerOn: true }),
        d: State.make({ counter: 2, isTimerOn: true }),
        e: State.make({ counter: 2, isTimerOn: false }),
        f: State.make({ counter: 3, isTimerOn: false }),
      },
    )

    testScheduler.schedule(() => store.send(Action.toggleTimer()), 500)
    testScheduler.schedule(() => store.send(Action.toggleTimer()), 3000)
    testScheduler.schedule(() => store.send(Action.increment()), 10000)
  })
})
