import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { interval, map, NEVER, of, timer } from 'rxjs'
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

  const testStore = new TestStore(State(), new CounterReducer())

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

  const testStore = new TestStore(State(), new CounterReducer())

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

  const testStore = new TestStore(State(), new CounterReducer())

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

  const testStore = new TestStore(State(), new CounterReducer())

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

  const testStore = new TestStore(State(), new CounterReducer())

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

test('TestStore, no state change failure', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State(), [
    new Reduce<State, Action>((state, action) => {
      void state

      switch (action.case) {
        case 'first':
          return Effect.observable(of(Action.second()))

        case 'second':
          return Effect.none()
      }
    }),
  ])

  await t.throwsAsync(
    async () => {
      await store.send(Action.first(), () => undefined)
    },
    {
      message: `Expected state to change, but no change occurred.

The trailing closure made no observable modifications to state. If no change to state is \
expected, omit the trailing closure.`,
    },
  )

  await t.throwsAsync(
    async () => {
      await store.receive(Action.second(), () => undefined)
    },
    {
      message: `Expected state to change, but no change occurred.

The trailing closure made no observable modifications to state. If no change to state is \
expected, omit the trailing closure.`,
    },
  )

  store.complete()
  t.pass()
})

test('TestStore, state change failure', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  const store = new TestStore(State(), [
    new Reduce<State, null>((state, action) => {
      void action
      state.counter += 1
      return Effect.none()
    }),
  ])

  await t.throwsAsync(
    async () => {
      await store.send(null, (state) => (state.counter = 0))
    },
    {
      message: `A state change does not match expectation:

{
\tadded: {},
\tdeleted: {},
\tupdated: {
\t\tcounter: 1
\t}
}`,
    },
  )

  store.complete()
  t.pass()
})

test('TestStore, unexpected state change on send failure', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  const store = new TestStore(State(), [
    new Reduce<State, null>((state, action) => {
      void action
      state.counter += 1
      return Effect.none()
    }),
  ])

  await t.throwsAsync(
    async () => {
      await store.send(null)
    },
    {
      message: `State was not expected to change, but a change occurred:

{
\tadded: {},
\tdeleted: {},
\tupdated: {
\t\tcounter: 1
\t}
}`,
    },
  )

  store.complete()
  t.pass()
})

test('TestStore, unexpected state change on receive failure', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State(), [
    new Reduce<State, Action>((state, action) => {
      switch (action.case) {
        case 'first':
          return Effect.observable(of(Action.second()))

        case 'second':
          state.counter += 1
          return Effect.none()
      }
    }),
  ])

  await store.send(Action.first())

  await t.throwsAsync(
    async () => {
      await store.receive(Action.second())
    },
    {
      message: `State was not expected to change, but a change occurred:

{
\tadded: {},
\tdeleted: {},
\tupdated: {
\t\tcounter: 1
\t}
}`,
    },
  )

  store.complete()
  t.pass()
})

test('TestStore, receive action after complete', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State(), [
    new Reduce<State, Action>((state, action) => {
      void state

      switch (action.case) {
        case 'first':
          return Effect.observable(of(Action.second()))

        case 'second':
          return Effect.none()
      }
    }),
  ])

  await store.send(Action.first())

  t.throws(() => store.complete(), {
    message: `The store received 1 unexpected action(s) after this one: …

Unhandled actions: [
\t{
\t\tcase: 'second',
\t\tp: Symbol(ts-enums: unit value)
\t}
]`,
  })
})

test('TestStore, effects in flight after complete', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  const store = new TestStore(State(), [
    new Reduce<State, null>((state, action) => {
      void state
      void action
      return Effect.observable(NEVER)
    }),
  ])

  await store.send(null)

  t.throws(() => store.complete(), {
    message: `An effect returned for this action is still running. It must complete \
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
  })
})

test('TestStore, send action before receive', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State(), [
    new Reduce<State, Action>((state, action) => {
      void state

      switch (action.case) {
        case 'first':
          return Effect.observable(of(Action.second()))

        case 'second':
          return Effect.none()
      }
    }),
  ])

  await store.send(Action.first())

  await t.throwsAsync(
    async () => {
      await store.send(Action.first())
    },
    {
      message: `Must handle 1 received action(s) before sending an action.

Unhandled actions: [
\t{
\t\tcase: 'second',
\t\tp: Symbol(ts-enums: unit value)
\t}
]`,
    },
  )
})

test('TestStore, receive non existent action failure', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'action'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State(), [
    new Reduce<State, Action>((state, action) => {
      void state
      void action
      return Effect.none()
    }),
  ])

  await t.throwsAsync(
    async () => {
      await store.receive(Action.action())
    },
    {
      message: `Expected to receive the following action, but didn't: …

{
\tcase: 'action',
\tp: Symbol(ts-enums: unit value)
}`,
    },
  )
})

test('TestStore, receive unexpected action failure', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State(), [
    new Reduce<State, Action>((state, action) => {
      void state

      switch (action.case) {
        case 'first':
          return Effect.observable(of(Action.second()))

        case 'second':
          return Effect.none()
      }
    }),
  ])

  await store.send(Action.first())

  await t.throwsAsync(
    async () => {
      await store.receive(Action.first())
    },
    {
      message: `Received unexpected action: …

{
\tcase: 'second',
\tp: Symbol(ts-enums: unit value)
}`,
    },
  )
})

test('TestStore, modify lambda throws error failure', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  const store = new TestStore(State(), [
    new Reduce<State, null>((state, action) => {
      void state
      void action
      return Effect.none()
    }),
  ])

  await t.throwsAsync(
    async () => {
      await store.send(null, () => {
        throw new Error('some error')
      })
    },
    {
      message: 'Threw error: Error: some error',
    },
  )
})

test('TestStore, expected state equality must modify failure', async (t) => {
  interface State {
    counter: number
  }

  const State = (state: Partial<State> = {}): State => ({
    counter: 0,
    ...state,
  })

  const store = new TestStore(State(), [
    new Reduce<State, boolean>((state, action) => {
      void state

      if (action) {
        return Effect.observable(of(false))
      } else {
        return Effect.none()
      }
    }),
  ])

  await store.send(true)
  await store.receive(false)

  await t.throwsAsync(async () => {
    await store.send(true, (state) => {
      state.counter = 0
    })
  })

  await t.throwsAsync(async () => {
    await store.receive(false, (state) => {
      state.counter = 0
    })
  })
})
