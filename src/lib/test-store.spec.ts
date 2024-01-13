import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { interval, map, of, timer } from 'rxjs'
import {
  Effect,
  Reduce,
  Reducer,
  ReducerBuilder,
  TestScheduler,
  TestStore,
} from '..'

test('TestStore, no effects', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'decrement'> | Case<'increment'>
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
        }
      })
    }
  }

  const testStore = new TestStore(t.fail, State(), new CounterReducer())

  await testStore.send(Action.increment(), (state) => {
    state.counter = 1
  })

  await testStore.send(Action.increment(), (state) => {
    state.counter = 2
  })

  await testStore.send(Action.decrement(), (state) => {
    state.counter = 1
  })

  await testStore.send(Action.increment(), (state) => {
    state.counter = 2
  })

  testStore.complete()
  t.pass()
})

test('TestStore, async', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'response', number> | Case<'tap'>
  const Action = makeEnum<Action>()

  class CounterReducer extends Reducer<State, Action> {
    body(): ReducerBuilder<State, Action> {
      return new Reduce((state, action) => {
        switch (action.case) {
          case 'response':
            state.counter = action.p
            return Effect.none()

          case 'tap':
            return Effect.observable(of(Action.response(42)))
        }
      })
    }
  }

  const testStore = new TestStore(t.fail, State(), new CounterReducer())

  await testStore.send(Action.tap())

  await testStore.receive(Action.response(42), (state) => {
    state.counter = 42
  })

  testStore.complete()
  t.pass()
})

test('TestStore, expected state equality must modify', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'finished'> | Case<'noop'>
  const Action = makeEnum<Action>()

  class CounterReducer extends Reducer<State, Action> {
    body(): ReducerBuilder<State, Action> {
      return new Reduce((state, action) => {
        void state

        switch (action.case) {
          case 'finished':
            return Effect.none()

          case 'noop':
            return Effect.observable(of(Action.finished()))
        }
      })
    }
  }

  const testStore = new TestStore(
    (message) => {
      throw new Error(message)
    },
    State(),
    new CounterReducer(),
  )

  await testStore.send(Action.noop())
  await testStore.receive(Action.finished())

  await t.throwsAsync(async () => {
    await testStore.send(Action.noop(), (state) => {
      state.counter = 0
    })
  })

  await t.throwsAsync(async () => {
    await testStore.receive(Action.finished(), (state) => {
      state.counter = 0
    })
  })

  testStore.complete()
  t.pass()
})

test('TestStore, one shot effect', async (t) => {
  const testScheduler = new TestScheduler()

  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action =
    | Case<'decrement'>
    | Case<'delayedDecrement'>
    | Case<'delayedIncrement'>
    | Case<'increment'>

  const Action = makeEnum<Action>()

  class CounterReducer extends Reducer<State, Action> {
    body(): ReducerBuilder<State, Action> {
      return new Reduce((state, action) => {
        switch (action.case) {
          case 'decrement':
            state.counter -= 1
            return Effect.none()

          case 'delayedDecrement':
            return Effect.observable(
              timer(1000, testScheduler).pipe(map(() => Action.decrement())),
            )

          case 'delayedIncrement':
            return Effect.observable(
              timer(1000, testScheduler).pipe(map(() => Action.increment())),
            )

          case 'increment':
            state.counter += 1
            return Effect.none()
        }
      })
    }
  }

  const testStore = new TestStore(t.fail, State(), new CounterReducer())

  await testStore.send(Action.increment(), (state) => {
    state.counter = 1
  })

  await testStore.send(Action.delayedIncrement())

  await testStore.send(Action.decrement(), (state) => {
    state.counter = 0
  })

  testScheduler.advance({ by: 1000 })

  await testStore.receive(Action.increment(), (state) => {
    state.counter = 1
  })

  await testStore.send(Action.delayedDecrement())
  await testStore.send(Action.delayedDecrement())

  testScheduler.advance({ by: 1000 })

  await testStore.receive(Action.decrement(), (state) => {
    state.counter = 0
  })

  await testStore.receive(Action.decrement(), (state) => {
    state.counter = -1
  })

  testStore.complete()
  t.pass()
})

test('TestStore, long living effect', async (t) => {
  const testScheduler = new TestScheduler()

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
                interval(1000, testScheduler).pipe(
                  map(() => Action.timerTicked()),
                ),
              ).cancellable('cancel-id')
            } else {
              return Effect.cancel('cancel-id')
            }
        }
      })
    }
  }

  const testStore = new TestStore(t.fail, State(), new CounterReducer())

  await testStore.send(Action.toggleTimer(), (state) => {
    state.isTimerOn = true
  })

  testScheduler.advance({ by: 1000 })

  await testStore.receive(Action.timerTicked(), (state) => {
    state.counter = 1
  })

  testScheduler.advance({ by: 1000 })

  await testStore.receive(Action.timerTicked(), (state) => {
    state.counter = 2
  })

  testScheduler.advance({ by: 1000 })

  await testStore.receive(Action.timerTicked(), (state) => {
    state.counter = 3
  })

  await testStore.send(Action.toggleTimer(), (state) => {
    state.isTimerOn = false
  })

  testStore.complete()
  t.pass()
})
