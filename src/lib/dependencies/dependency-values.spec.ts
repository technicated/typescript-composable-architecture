import test from 'ava'
import {
  DateGenerator,
  dependency,
  DependencyContext,
  DependencyKey,
  DependencyValues,
  registerDependency,
  withDependencies,
} from '../..'

const optionalDependency = 'dependency-values.spec.optionalDependency'

declare module '../..' {
  interface DependencyValues {
    [optionalDependency]: string | null
  }
}

class OptionalDependencyKey implements DependencyKey<string | null> {
  readonly liveValue = 'live'
  get testValue(): string | null {
    throw new Error('unimplemented optionalDependency')
  }
}

registerDependency(optionalDependency, OptionalDependencyKey)

class ReuseClient {
  constructor(
    public readonly count: () => number,
    public readonly setCount: (count: number) => void,
  ) {}
}

class ReuseClientKey implements DependencyKey<ReuseClient> {
  get liveValue(): ReuseClient {
    let count = 0

    return new ReuseClient(
      () => count,
      (newValue) => (count = newValue),
    )
  }
}

const reuseClient = 'dependency-values.spec.reuseClient'

declare module '../..' {
  interface DependencyValues {
    [reuseClient]: ReuseClient
  }
}

registerDependency(reuseClient, ReuseClientKey)

test.beforeEach(() => {
  DependencyValues._current.context = DependencyContext.test
})

const someDate = new Date(1_234_567_890_000)

test('DependencyValues, with values', (t) => {
  const date = withDependencies(
    (dependencies) => {
      dependencies.date = DateGenerator.constant(someDate)
    },
    () => {
      return dependency('date').now
    },
  )

  const defaultDate = withDependencies(
    (dependencies) => {
      dependencies.context = DependencyContext.live
    },
    () => {
      return dependency('date').now
    },
  )

  t.deepEqual(date, someDate)
  t.notDeepEqual(defaultDate, someDate)
})

test('DependencyValues, with value', (t) => {
  withDependencies(
    (dependencies) => {
      dependencies.context = DependencyContext.live
    },
    () => {
      const date = withDependencies(
        (dependencies) => {
          dependencies.date = DateGenerator.constant(someDate)
        },
        () => {
          return dependency('date').now
        },
      )

      t.deepEqual(date, someDate)
      t.notDeepEqual(DependencyValues._current.date.now, someDate)
    },
  )
})

test('DependencyValues, optional dependency', (t) => {
  for (const value of [null, '']) {
    withDependencies(
      (dependencies) => {
        dependencies[optionalDependency] = value
      },
      () => {
        t.is(dependency(optionalDependency), value)
      },
    )
  }
})

test('DependencyValues, optional dependency live', (t) => {
  withDependencies(
    (dependencies) => {
      dependencies.context = DependencyContext.live
    },
    () => {
      t.is(dependency(optionalDependency), 'live')
    },
  )

  withDependencies(
    (dependencies) => {
      dependencies.context = DependencyContext.live
      dependencies[optionalDependency] = null
    },
    () => {
      t.is(dependency(optionalDependency), null)
    },
  )
})

test('DependencyValues, dependency default is reused', (t) => {
  withDependencies(
    () => {
      return new DependencyValues()
    },
    () => {
      withDependencies(
        (dependencies) => {
          dependencies.context = DependencyContext.live
        },
        () => {
          t.is(dependency(reuseClient).count(), 0)
          dependency(reuseClient).setCount(42)
          t.is(dependency(reuseClient).count(), 42)
        },
      )
    },
  )
})

test('DependencyValues, nested with test values', (t) => {
  withDependencies(
    (dependencies) => {
      dependencies.date.now = new Date(1_234_567_890_000)
    },
    () => {
      withDependencies(
        (dependencies) => {
          dependencies.randomNumberGenerator.next = () => 0.5
        },
        () => {
          t.deepEqual(
            DependencyValues._current.date.now,
            new Date(1_234_567_890_000),
          )
          t.is(dependency('randomNumberGenerator').next(), 0.5)
          t.is(dependency('context'), DependencyContext.test)
        },
      )
    },
  )
})
