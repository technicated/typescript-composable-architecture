import test from 'ava'
import { TestScheduler } from '../..'

test('TestScheduler.now', (t) => {
  const testScheduler = new TestScheduler()
  t.deepEqual(testScheduler.now(), 0)

  testScheduler.advance({ to: 1000 })
  t.deepEqual(testScheduler.now(), 1000)

  testScheduler.advance({ by: 1000 })
  t.deepEqual(testScheduler.now(), 2000)

  testScheduler.advance({ to: 10000 })
  t.deepEqual(testScheduler.now(), 10000)
})

test('TestScheduler.schedule', (t) => {
  let flag1 = false
  let flag2 = false
  let flag3 = false

  const testScheduler = new TestScheduler()

  testScheduler.schedule(() => (flag1 = true))
  testScheduler.schedule(() => (flag2 = true), 1000)
  testScheduler.schedule(() => (flag3 = true), 10000)

  t.false(flag1)
  t.false(flag2)
  t.false(flag3)

  testScheduler.advance()
  t.true(flag1)
  t.false(flag2)
  t.false(flag3)

  testScheduler.advance({ to: 1000 })
  t.true(flag1)
  t.true(flag2)
  t.false(flag3)

  testScheduler.run()
  t.true(flag1)
  t.true(flag2)
  t.true(flag3)
})
