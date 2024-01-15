import test from 'ava'
import { EmptyReducer, TestStore } from '../..'

test('EmptyReducer', (t) => {
  const state = { counter: 0 }
  const store = new TestStore(state, EmptyReducer())

  store.send(42)
  store.send('hello world')
  store.send(true)

  store.complete()
  t.pass()
})
