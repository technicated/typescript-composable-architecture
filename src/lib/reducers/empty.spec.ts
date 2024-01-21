import test from 'ava'
import { EmptyReducer, Property, TcaState, TestStore } from '../..'

test('EmptyReducer', (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  const store = new TestStore(State.make(), EmptyReducer())

  store.send(42)
  store.send('hello world')
  store.send(true)

  store.complete()
  t.pass()
})
