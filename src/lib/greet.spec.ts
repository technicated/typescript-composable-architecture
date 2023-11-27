import test from 'ava'
import { greet } from './greet'

test('greet', (t) => {
  t.is(greet('user'), 'Hello, user!')
})
