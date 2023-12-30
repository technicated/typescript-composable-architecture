import test, { ExecutionContext } from 'ava'
import { delay, of } from 'rxjs'
import { TestScheduler } from 'rxjs/testing'
import { Effect } from '..'

const makeTestScheduler = (t: ExecutionContext<unknown>) =>
  new TestScheduler((actual, expected) => t.deepEqual(actual, expected))

test('Effect.fireAndForget', (t) => {
  const testScheduler = makeTestScheduler(t)

  testScheduler.run(({ expectObservable }) => {
    let executed = false
    const e = Effect.fireAndForget(() => (executed = true))

    t.false(executed)
    t.truthy(e.source)

    expectObservable(e.source!).toBe('|')
    testScheduler.flush()

    t.true(executed)
  })
})

test('Effect.merge', (t) => {
  const testScheduler = makeTestScheduler(t)

  testScheduler.run(({ expectObservable }) => {
    const e = Effect.merge(
      Effect.observable(of(1)),
      Effect.observable(of(2).pipe(delay(500))),
      Effect.observable(of(3).pipe(delay(1000))),
    )

    t.truthy(e.source)

    expectObservable(e.source!).toBe('a 499ms b 499ms (c|)', {
      a: 1,
      b: 2,
      c: 3,
    })
  })
})

test('Effect.prototype.map', (t) => {
  const testScheduler = makeTestScheduler(t)

  testScheduler.run(({ expectObservable }) => {
    const e1 = Effect.observable(of(42)).map((n) => `${n * n}`)
    const e2 = Effect.none<number>().map((n) => `${n * n}`)
    t.truthy(e1.source)
    t.falsy(e2.source)
    expectObservable(e1.source!).toBe('(a|)', { a: '1764' })
  })
})

test('Effect.prototype.merge', (t) => {
  const testScheduler = makeTestScheduler(t)

  testScheduler.run(({ expectObservable }) => {
    const base = Effect.observable(of(42))

    const e1 = base.merge(Effect.none())
    const e2 = Effect.none().merge(base)
    const e3 = base.merge(Effect.observable(of(-1)))

    t.truthy(e1.source)
    t.truthy(e2.source)
    t.truthy(e3.source)

    t.true(e1 === base)
    t.true(e2 === base)
    t.true(e3 !== base)

    expectObservable(e1.source!).toBe('(a|)', { a: 42 })
    expectObservable(e2.source!).toBe('(a|)', { a: 42 })
    expectObservable(e3.source!).toBe('(ab|)', { a: 42, b: -1 })
  })
})
