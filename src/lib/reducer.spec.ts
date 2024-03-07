import test from 'ava'
import { Effect, Property, Reducer, SomeReducerOf, TcaState } from '..'

test('Reducer not implemented failure', (t) => {
  class MyReducer extends Reducer<never, never> {}
  const r = new MyReducer()

  t.throws(() => r.reduce(null as never, null as never), {
    message: /^A Reducer was not implemented correctly/,
  })
})

test('Reducer body sequencing', (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  const action = Symbol()
  type Action = typeof action

  class Reducer1 extends Reducer<State, Action> {
    override reduce(state: State, action: Action): Effect<Action> {
      void action
      state.counter *= 2
      return Effect.none()
    }
  }

  class Reducer2 extends Reducer<State, Action> {
    override reduce(state: State, action: Action): Effect<Action> {
      void action
      state.counter += 3
      return Effect.none()
    }
  }

  class MyReducer12 extends Reducer<State, Action> {
    override body(): SomeReducerOf<State, Action> {
      return [new Reducer1(), new Reducer2()]
    }
  }

  class MyReducer21 extends Reducer<State, Action> {
    override body(): SomeReducerOf<State, Action> {
      return [new Reducer2(), new Reducer1()]
    }
  }

  const r12 = new MyReducer12()
  const r21 = new MyReducer21()

  const state12 = State.make({ counter: 12 })
  const e12 = r12.reduce(state12, action)

  const state21 = State.make({ counter: 12 })
  const e21 = r21.reduce(state21, action)

  t.falsy(e12.source)
  t.falsy(e21.source)
  t.deepEqual(state12, State.make({ counter: 27 }))
  t.deepEqual(state21, State.make({ counter: 30 }))
})
