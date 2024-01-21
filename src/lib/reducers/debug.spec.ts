import { Case, makeEnum } from '@technicated/ts-enums'
import test from 'ava'
import { Effect, Property, Reducer, TcaState } from '../..'

test('DebugReducer with default logger', (t) => {
  const original = console.log
  const logs: unknown[] = []
  console.log = (...args: unknown[]) => logs.push(...args)

  class State extends TcaState {
    counter: Property<number> = 0
    other: Property<number> = 0
  }

  type Action = Case<'decrement'> | Case<'increment'>
  const Action = makeEnum<Action>()

  class MyReducer extends Reducer<State, Action> {
    override reduce(state: State, action: Action): Effect<Action> {
      switch (action.case) {
        case 'decrement':
          state.counter -= 1
          state.other = 42
          return Effect.none()

        case 'increment':
          state.counter += 1
          state.other = 0
          return Effect.none()
      }
    }
  }

  const r = new MyReducer()._printChanges()
  const s = State.make({ counter: 0, other: 0 })

  Effect.merge(
    r.reduce(s, Action.increment()),
    r.reduce(s, Action.increment()),
    r.reduce(s, Action.decrement()),
  ).source!.subscribe() // todo: change when right Store exists

  t.pass()

  console.log = original

  t.is(logs.length, 12)

  t.is(logs[0], 'received action')
  t.like(logs[1], { case: 'increment' })
  t.is(logs[2], 'differences')
  t.like(logs[3], { counter: 1 })

  t.is(logs[4], 'received action')
  t.like(logs[5], { case: 'increment' })
  t.is(logs[6], 'differences')
  t.like(logs[7], { counter: 2 })

  t.is(logs[8], 'received action')
  t.like(logs[9], { case: 'decrement' })
  t.is(logs[10], 'differences')
  t.like(logs[11], { counter: 1, other: 42 })
})
