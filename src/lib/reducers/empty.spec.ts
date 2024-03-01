import test from 'ava'
import { EmptyReducer, Property, TcaState, TestStore } from '../..'

test('EmptyReducer', async (t) => {
  class State extends TcaState {
    counter: Property<number> = 0
  }

  const store = new TestStore(State.make(), () => EmptyReducer())

  await store.run(async () => {
    await store.send(42)
    await store.send('hello world')
    await store.send(true)
  })

  t.pass()
})
