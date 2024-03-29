import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { interval, map, NEVER, of, timer } from 'rxjs'
import {
  Effect,
  Property,
  Reduce,
  Reducer,
  SomeReducerOf,
  TcaState,
  TestScheduler,
  TestStore,
} from '..'

test('TestStore, no effects', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'decrement'> | Case<'increment'>
  const Action = makeEnum<Action>()

  class CounterReducer extends Reducer<State, Action> {
    override body(): SomeReducerOf<State, Action> {
      return Reduce((state, action) => {
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

  const store = new TestStore(State.make(), () => new CounterReducer())

  await store.run(async () => {
    await store.send(Action.increment(), (state) => {
      state.counter = 1
    })

    await store.send(Action.increment(), (state) => {
      state.counter = 2
    })

    await store.send(Action.decrement(), (state) => {
      state.counter = 1
    })

    await store.send(Action.increment(), (state) => {
      state.counter = 2
    })
  })

  t.pass()
})

test('TestStore, async', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'response', number> | Case<'tap'>
  const Action = makeEnum<Action>()

  class CounterReducer extends Reducer<State, Action> {
    override body(): SomeReducerOf<State, Action> {
      return Reduce((state, action) => {
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

  const store = new TestStore(State.make(), () => new CounterReducer())

  await store.run(async () => {
    await store.send(Action.tap())

    await store.receive(Action.response(42), (state) => {
      state.counter = 42
    })
  })

  t.pass()
})

test('TestStore, expected state equality must modify', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'finished'> | Case<'noop'>
  const Action = makeEnum<Action>()

  class CounterReducer extends Reducer<State, Action> {
    override body(): SomeReducerOf<State, Action> {
      return Reduce((state, action) => {
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

  const store = new TestStore(State.make(), () => new CounterReducer())

  await store.run(async () => {
    await store.send(Action.noop())
    await store.receive(Action.finished())

    await t.throwsAsync(async () => {
      await store.send(Action.noop(), (state) => {
        state.counter = 0
      })
    })

    await t.throwsAsync(async () => {
      await store.receive(Action.finished(), (state) => {
        state.counter = 0
      })
    })
  })

  t.pass()
})

test('TestStore, one shot effect', async (t) => {
  const testScheduler = new TestScheduler()

  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action =
    | Case<'decrement'>
    | Case<'delayedDecrement'>
    | Case<'delayedIncrement'>
    | Case<'increment'>

  const Action = makeEnum<Action>()

  class CounterReducer extends Reducer<State, Action> {
    override body(): SomeReducerOf<State, Action> {
      return Reduce((state, action) => {
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

  const store = new TestStore(State.make(), () => new CounterReducer())

  await store.run(async () => {
    await store.send(Action.increment(), (state) => {
      state.counter = 1
    })

    await store.send(Action.delayedIncrement())

    await store.send(Action.decrement(), (state) => {
      state.counter = 0
    })

    testScheduler.advance({ by: 1000 })

    await store.receive(Action.increment(), (state) => {
      state.counter = 1
    })

    await store.send(Action.delayedDecrement())
    await store.send(Action.delayedDecrement())

    testScheduler.advance({ by: 1000 })

    await store.receive(Action.decrement(), (state) => {
      state.counter = 0
    })

    await store.receive(Action.decrement(), (state) => {
      state.counter = -1
    })
  })

  t.pass()
})

test('TestStore, long living effect', async (t) => {
  const testScheduler = new TestScheduler()

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
    override body(): SomeReducerOf<State, Action> {
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

  const store = new TestStore(State.make(), () => new CounterReducer())

  store.run(async () => {
    await store.send(Action.toggleTimer(), (state) => {
      state.isTimerOn = true
    })

    testScheduler.advance({ by: 1000 })

    await store.receive(Action.timerTicked(), (state) => {
      state.counter = 1
    })

    testScheduler.advance({ by: 1000 })

    await store.receive(Action.timerTicked(), (state) => {
      state.counter = 2
    })

    testScheduler.advance({ by: 1000 })

    await store.receive(Action.timerTicked(), (state) => {
      state.counter = 3
    })

    await store.send(Action.toggleTimer(), (state) => {
      state.isTimerOn = false
    })
  })

  t.pass()
})

test('TestStore, no state change failure', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State.make(), () => [
    Reduce<State, Action>((state, action) => {
      void state

      switch (action.case) {
        case 'first':
          return Effect.observable(of(Action.second()))

        case 'second':
          return Effect.none()
      }
    }),
  ])

  await store.run(async () => {
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
  })
})

test('TestStore, state change failure', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  const store = new TestStore(State.make(), () => [
    Reduce<State, null>((state, action) => {
      void action
      state.counter += 1
      return Effect.none()
    }),
  ])

  await store.run(async () => {
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
  })
})

test('TestStore, unexpected state change on send failure', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  const store = new TestStore(State.make(), () => [
    Reduce<State, null>((state, action) => {
      void action
      state.counter += 1
      return Effect.none()
    }),
  ])

  await store.run(async () => {
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
  })
})

test('TestStore, unexpected state change on receive failure', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State.make(), () => [
    Reduce<State, Action>((state, action) => {
      switch (action.case) {
        case 'first':
          return Effect.observable(of(Action.second()))

        case 'second':
          state.counter += 1
          return Effect.none()
      }
    }),
  ])

  await store.run(async () => {
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
  })
})

test('TestStore, receive action after complete', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State.make(), () => [
    Reduce<State, Action>((state, action) => {
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
  class State extends TcaState {
    counter: Property<number> = 0
  }

  const store = new TestStore(State.make(), () => [
    Reduce<State, null>((state, action) => {
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
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State.make(), () => [
    Reduce<State, Action>((state, action) => {
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
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'action'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State.make(), () => [
    Reduce<State, Action>((state, action) => {
      void state
      void action
      return Effect.none()
    }),
  ])

  await store.run(async () => {
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
})

test('TestStore, receive unexpected action failure', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  type Action = Case<'first'> | Case<'second'>
  const Action = makeEnum<Action>()

  const store = new TestStore(State.make(), () => [
    Reduce<State, Action>((state, action) => {
      void state

      switch (action.case) {
        case 'first':
          return Effect.observable(of(Action.second()))

        case 'second':
          return Effect.none()
      }
    }),
  ])

  await store.run(async () => {
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
})

test('TestStore, modify lambda throws error failure', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  const store = new TestStore(State.make(), () => [
    Reduce<State, null>((state, action) => {
      void state
      void action
      return Effect.none()
    }),
  ])

  await store.run(async () => {
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
})

test('TestStore, expected state equality must modify failure', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  const store = new TestStore(State.make(), () => [
    Reduce<State, boolean>((state, action) => {
      void state

      if (action) {
        return Effect.observable(of(false))
      } else {
        return Effect.none()
      }
    }),
  ])

  await store.run(async () => {
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
})
